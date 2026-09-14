import { localized } from '../../i18n/index.ts';
import { courseWordMeaning } from '../../i18n/vocabulary.ts';
import { keyboardFoldGerman, parseGermanAnswer } from '../grading/normalize.ts';

import type { MotherTongue } from '../types.ts';
import { courseCommunicationForChapter } from './course-communication.ts';
import { informationGapForChapter, type CourseInformationGap } from './course-information-gaps.ts';
import { courseMilestoneForChapter } from './course-milestones.ts';
import { courseDictationWordCount, gradeCourseDictation } from './dictation.ts';
import { coursePathChapters } from './path.ts';
import type {
  CourseModelSentence,
  CoursePathChapter,
  CoursePathNodeType,
  CourseWord,
} from './path.ts';

export type CoursePathQuestion = {
  id: string;
  instruction: string;
  prompt: string;
  promptLang: 'cs' | 'en' | 'de';
  answer: string;
  answerLang: 'cs' | 'en' | 'de';
  options: string[];
  explanation: string;
  kind:
    | 'word'
    | 'sentence'
    | 'dictation'
    | 'listening'
    | 'error'
    | 'cloze'
    | 'situation'
    | 'evidence'
    | 'information-gap';
  interaction?: CourseInformationGap;
  response?: 'recall';
  acceptedAnswers?: string[];
  reviewChapterId?: string;
  context?: { title: string; text: string };
  wordCount?: number;
  audio?: { title: string; transcript: string };
};

export function courseWordLabel(word: CourseWord): string {
  return word.article ? `${word.article} ${word.german}` : word.german;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function optionsWithAnswer(
  answer: string,
  candidates: string[],
  questionIndex: number,
  salt: number,
): string[] {
  const pool = unique(candidates).filter((candidate) => candidate !== answer);
  const rotated = pool.map((_, index) => pool[(index + questionIndex) % pool.length]);
  const options = rotated.slice(0, 3);
  const answerPosition = (questionIndex * 3 + salt) % (options.length + 1);
  options.splice(answerPosition, 0, answer);
  return options;
}

function practiceQuestions(
  chapter: CoursePathChapter,
  language: MotherTongue,
): CoursePathQuestion[] {
  const meanings = chapter.words.map((word) => courseWordMeaning(word, language));
  return chapter.words.map((word, index) => {
    if (index >= Math.ceil(chapter.words.length / 2)) {
      return wordRecallQuestion(word, `${chapter.id}:practice:${index + 1}`, language);
    }
    const meaning = courseWordMeaning(word, language);
    return {
      id: `${chapter.id}:practice:${index + 1}`,
      instruction: localized(language, {
        cs: 'Vyber přesný český význam.',
        en: 'Choose the precise English meaning.',
      }),
      prompt: courseWordLabel(word),
      promptLang: 'de',
      answer: meaning,
      answerLang: language,
      options: optionsWithAnswer(meaning, meanings, index, 1),
      explanation: localized(language, {
        cs:
          word.exampleDe && word.exampleCs
            ? `${word.exampleDe} — ${word.exampleCs}`
            : `Výraz „${courseWordLabel(word)}“ znamená „${word.czech}“.`,
        en: `“${courseWordLabel(word)}” means “${meaning}”.`,
      }),
      kind: 'word',
    };
  });
}

function wordRecallQuestion(
  word: CourseWord,
  id: string,
  language: MotherTongue,
): CoursePathQuestion {
  const meaning = courseWordMeaning(word, language);
  return {
    id,
    instruction: localized(language, {
      cs: word.article
        ? 'Napiš německý výraz zpaměti, včetně členu.'
        : 'Napiš německý výraz zpaměti.',
      en: word.article
        ? 'Type the German expression from memory, including its article.'
        : 'Type the German expression from memory.',
    }),
    prompt: meaning,
    promptLang: language,
    answer: courseWordLabel(word),
    answerLang: 'de',
    acceptedAnswers: (word.acceptedGerman ?? []).map((form) =>
      word.article && !parseGermanAnswer(form).article ? `${word.article} ${form}` : form,
    ),
    options: [],
    explanation: localized(language, {
      cs:
        word.exampleDe && word.exampleCs
          ? `${word.exampleDe} — ${word.exampleCs}`
          : `Výraz „${courseWordLabel(word)}“ znamená „${meaning}“.`,
      en: `“${courseWordLabel(word)}” means “${meaning}”.${word.exampleDe ? ` ${word.exampleDe}` : ''}`,
    }),
    kind: 'word',
    response: 'recall',
  };
}

export function gradeCourseRecall(question: CoursePathQuestion, submitted: string): boolean {
  if (question.response !== 'recall' || !submitted.trim()) return false;
  if (question.kind === 'error' || question.kind === 'cloze') {
    return [question.answer, ...(question.acceptedAnswers ?? [])].some(
      (answer) => gradeCourseDictation(submitted, answer).correct,
    );
  }
  const normalized = keyboardFoldGerman(submitted);
  return [question.answer, ...(question.acceptedAnswers ?? [])].some(
    (answer) => keyboardFoldGerman(answer) === normalized,
  );
}

export function courseSpiralReview(
  chapter: CoursePathChapter,
  language: MotherTongue,
): CoursePathQuestion[] {
  const earlier = coursePathChapters.filter(
    (candidate) => candidate.level === chapter.level && candidate.number < chapter.number,
  );
  const distances = [2, 4, 7].filter((distance) => distance <= earlier.length);
  if (!distances.length) return [];
  const distance = distances[(chapter.number - 1) % distances.length];
  const source = earlier[earlier.length - distance];
  const currentIds = new Set(chapter.words.map((word) => word.id));
  const candidates = source.words.filter(
    (word) => !currentIds.has(word.id) && word.role !== 'stretch',
  );
  const word = candidates[(chapter.number - 1) % candidates.length];
  if (!word) return [];
  return [
    {
      ...wordRecallQuestion(word, `${chapter.id}:checkpoint:review:${word.id}`, language),
      reviewChapterId: source.id,
    },
  ];
}

function sentenceRecallQuestion(
  chapter: CoursePathChapter,
  model: CourseModelSentence,
  index: number,
  language: MotherTongue,
): CoursePathQuestion | undefined {
  for (const word of chapter.words) {
    const escaped = word.german.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
    const match = pattern.exec(model.de);
    if (!match) continue;
    return {
      id: `${chapter.id}:checkpoint:${index + 1}`,
      instruction: localized(language, {
        cs: `Doplň chybějící výraz podle významu „${courseWordMeaning(word, language)}“.`,
        en: `Fill in the missing expression meaning “${courseWordMeaning(word, language)}”.`,
      }),
      prompt:
        model.de.slice(0, match.index) + '_____' + model.de.slice(match.index + match[0].length),
      promptLang: 'de',
      answer: match[0],
      answerLang: 'de',
      options: [],
      explanation: localized(language, {
        cs: `${model.de} — ${model.cs} ${model.note}`,
        en: `Complete sentence: “${model.de}” The missing expression means “${courseWordMeaning(word, language)}”.`,
      }),
      kind: 'cloze',
      response: 'recall',
    };
  }
  return undefined;
}

function milestoneQuestions(
  chapter: CoursePathChapter,
  language: MotherTongue,
): CoursePathQuestion[] {
  const milestone = courseMilestoneForChapter(chapter.id);
  if (!milestone) return [];
  return milestone.tasks.map((task, index) => ({
    id: `${chapter.id}:checkpoint:situation:${index + 1}`,
    instruction: localized(language, {
      cs: 'Rozhodni podle situace. Všechny možnosti jsou gramaticky správné.',
      en: 'Decide based on the situation. Every option is grammatical.',
    }),
    prompt: localized(language, task.prompt),
    promptLang: language,
    answer: task.answer,
    answerLang: 'de',
    options: optionsWithAnswer(task.answer, task.distractors, index, chapter.number),
    explanation: localized(language, task.explanation),
    kind: 'situation',
    context: { title: localized(language, milestone.title), text: milestone.scene },
  }));
}

function modelSentenceQuestion(
  chapter: CoursePathChapter,
  model: CourseModelSentence,
  index: number,
  context: 'mix' | 'checkpoint',
  language: MotherTongue,
): CoursePathQuestion {
  const trapPool = chapter.modelSentences.map((candidate) => candidate.trap);
  return {
    id: `${chapter.id}:${context}:${index + 1}`,
    instruction: localized(language, {
      cs: 'Vyber větu, která sedí významem i stavbou.',
      en: 'Choose the sentence that uses the chapter pattern correctly.',
    }),
    prompt: language === 'en' ? 'Which German sentence is correct?' : model.cs,
    promptLang: language,
    answer: model.de,
    answerLang: 'de',
    options: optionsWithAnswer(
      model.de,
      [model.trap, ...trapPool],
      index,
      context === 'mix' ? 2 : 3,
    ),
    explanation:
      language === 'en'
        ? 'The correct sentence follows the chapter’s key word order and form.'
        : model.note,
    kind: 'sentence',
  };
}

function mixQuestions(chapter: CoursePathChapter, language: MotherTongue): CoursePathQuestion[] {
  const [dictationModel, ...remainingModels] = chapter.modelSentences;
  if (!dictationModel) return [];

  const trapPool = chapter.modelSentences.map((candidate) => candidate.trap);
  const dictation: CoursePathQuestion = {
    id: `${chapter.id}:mix:dictation`,
    instruction: localized(language, {
      cs: 'Poslechni si větu a zapiš přesně slova, která slyšíš.',
      en: 'Listen to the sentence and type the words you hear.',
    }),
    prompt:
      language === 'en' ? 'Which German sentence follows the chapter pattern?' : dictationModel.cs,
    promptLang: language,
    answer: dictationModel.de,
    answerLang: 'de',
    options: optionsWithAnswer(dictationModel.de, [dictationModel.trap, ...trapPool], 0, 2),
    explanation:
      language === 'en'
        ? 'Punctuation and letter case are ignored; the German words and their order must match.'
        : `${dictationModel.note} Interpunkce a velikost písmen hodnocení neovlivňují.`,
    kind: 'dictation',
    wordCount: courseDictationWordCount(dictationModel.de),
  };

  return [
    dictation,
    ...remainingModels.map((model, index) =>
      modelSentenceQuestion(chapter, model, index + 1, 'mix', language),
    ),
    ...listeningQuestions(chapter, language),
  ];
}

function listeningQuestions(
  chapter: CoursePathChapter,
  language: MotherTongue,
): CoursePathQuestion[] {
  const communication = courseCommunicationForChapter(chapter.id);
  if (!communication) return [];
  return communication.listening.tasks.map((task, index) => ({
    id: `${chapter.id}:mix:listening:${task.focus}`,
    instruction: localized(
      language,
      task.focus === 'gist'
        ? {
            cs: 'Poslechni si zprávu. Nejdřív zachyť hlavní sdělení.',
            en: 'Listen to the message. First identify its main point.',
          }
        : {
            cs: 'Poslechni si zprávu znovu a najdi konkrétní informaci.',
            en: 'Listen again and find the specific information.',
          },
    ),
    prompt: localized(language, task.prompt),
    promptLang: language,
    answer: task.answer,
    answerLang: 'de',
    options: optionsWithAnswer(task.answer, task.distractors, index, chapter.number),
    explanation: localized(language, task.explanation),
    kind: 'listening',
    audio: {
      title: localized(language, communication.listening.title),
      transcript: communication.listening.transcript,
    },
  }));
}

function evidenceQuestions(
  chapter: CoursePathChapter,
  language: MotherTongue,
): CoursePathQuestion[] {
  const communication = courseCommunicationForChapter(chapter.id);
  if (!communication) return [];
  const labels = {
    supported: localized(language, { cs: 'Text to potvrzuje.', en: 'The text supports this.' }),
    contradicted: localized(language, {
      cs: 'Text tomu odporuje.',
      en: 'The text contradicts this.',
    }),
    'not-stated': localized(language, {
      cs: 'Z textu to nelze určit.',
      en: 'The text does not say.',
    }),
  };
  return [
    {
      id: `${chapter.id}:checkpoint:evidence`,
      instruction: localized(language, {
        cs: 'Posuď tvrzení jen podle nového textu. Chybějící údaj si nedomýšlej.',
        en: 'Judge the claim using only the new text. Do not invent missing information.',
      }),
      prompt: communication.reading.claim,
      promptLang: 'de',
      answer: labels[communication.reading.verdict],
      answerLang: language,
      options: Object.values(labels),
      explanation: localized(language, communication.reading.explanation),
      kind: 'evidence',
      context: {
        title: localized(language, communication.reading.title),
        text: communication.reading.text,
      },
    },
  ];
}

/** Grade only the changed span; the rest of the sentence stays fixed. */
export function courseSentenceRepair(model: CourseModelSentence): {
  prompt: string;
  answer: string;
} {
  const target = model.de.trim().split(/\s+/u);
  const original = model.trap.trim().split(/\s+/u);
  let start = 0;
  while (start < target.length && target[start] === original[start]) start += 1;
  let end = target.length;
  let originalEnd = original.length;
  while (end > start && originalEnd > start && target[end - 1] === original[originalEnd - 1]) {
    end -= 1;
    originalEnd -= 1;
  }
  // Include a neighbouring word for a pure deletion: the answer must never be empty.
  if (start === end) {
    if (start > 0) start -= 1;
    else end = Math.min(1, target.length);
  }
  return {
    prompt: [...target.slice(0, start), '_____', ...target.slice(end)].join(' '),
    answer: target.slice(start, end).join(' '),
  };
}

function checkpointQuestions(
  chapter: CoursePathChapter,
  language: MotherTongue,
): CoursePathQuestion[] {
  const wordIndexes = [
    ...new Set([Math.min(1, chapter.words.length - 1), Math.max(0, chapter.words.length - 1)]),
  ];
  const wordQuestions = wordIndexes.map((wordIndex, index): CoursePathQuestion => {
    const word = chapter.words[wordIndex];
    return wordRecallQuestion(word, `${chapter.id}:checkpoint:word:${index + 1}`, language);
  });
  let hasCloze = false;
  const sentenceQuestions = chapter.modelSentences.map((model, index) => {
    const cloze = !hasCloze ? sentenceRecallQuestion(chapter, model, index, language) : undefined;
    if (cloze) hasCloze = true;
    return cloze ?? modelSentenceQuestion(chapter, model, index, 'checkpoint', language);
  });
  const errorModel = chapter.modelSentences[1] ?? chapter.modelSentences[0];
  const repair = courseSentenceRepair(errorModel);
  const errorClinic: CoursePathQuestion = {
    id: `${chapter.id}:checkpoint:error-clinic`,
    instruction: localized(language, {
      cs: `Uprav větu podle vzorce „${chapter.grammarPattern}“. Doplň jen mezeru; použij slova původní věty a podle potřeby změň jejich tvar. Cílový význam: ${errorModel.cs}`,
      en: `Restore the chapter’s model sentence using the pattern “${chapter.grammarPattern}”. Fill only the gap; use the original words and change their forms where needed.`,
    }),
    prompt: repair.prompt,
    promptLang: 'de',
    answer: repair.answer,
    answerLang: 'de',
    options: [],
    response: 'recall',
    context: {
      title: localized(language, {
        cs: 'Původní věta k úpravě',
        en: 'Original sentence to revise',
      }),
      text: errorModel.trap,
    },
    explanation: localized(language, {
      cs: `Opravená věta: „${errorModel.de}“ ${errorModel.note}`,
      en: `Corrected sentence: “${errorModel.de}” The correction restores the chapter’s intended grammar and meaning.`,
    }),
    kind: 'error',
  };
  return [
    ...wordQuestions,
    errorClinic,
    ...sentenceQuestions,
    ...courseSpiralReview(chapter, language),
    ...evidenceQuestions(chapter, language),
    ...informationGapQuestions(chapter, language),
    ...milestoneQuestions(chapter, language),
  ];
}

function informationGapQuestions(
  chapter: CoursePathChapter,
  language: MotherTongue,
): CoursePathQuestion[] {
  const gap = informationGapForChapter(chapter.id);
  if (!gap) return [];
  return [
    {
      id: `${chapter.id}:checkpoint:information-gap`,
      instruction: localized(language, {
        cs: 'Doptej se na chybějící údaje a domluv řešení.',
        en: 'Ask for the missing details and agree on a solution.',
      }),
      prompt: gap.decision,
      promptLang: 'de',
      answer: gap.answer,
      answerLang: 'de',
      options: optionsWithAnswer(gap.answer, gap.alternatives, 0, chapter.number),
      explanation: localized(language, gap.explanation),
      kind: 'information-gap',
      interaction: gap,
    },
  ];
}

export function coursePathQuestionsForNode(
  chapter: CoursePathChapter,
  nodeType: CoursePathNodeType,
  language: MotherTongue = 'cs',
): CoursePathQuestion[] {
  if (nodeType === 'practice') return practiceQuestions(chapter, language);
  if (nodeType === 'mix') return mixQuestions(chapter, language);
  if (nodeType === 'checkpoint') return checkpointQuestions(chapter, language);
  return [];
}

export { sentenceUsesCourseWord } from './course-word-usage.ts';
