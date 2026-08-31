import { localized } from '../../i18n/index.ts';
import { courseWordMeaning } from '../../i18n/vocabulary.ts';
import {
  containsLexicalForm,
  germanAdjectiveInflectionMatches,
  germanVerbInflectionMatches,
  lexicalTokens,
} from '../grading/lexical.ts';

import type { MotherTongue } from '../types.ts';
import { courseDictationWordCount } from './dictation.ts';
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
  kind: 'word' | 'sentence' | 'dictation' | 'error';
  wordCount?: number;
};

export function courseWordLabel(word: CourseWord): string {
  return word.article ? `${word.article} ${word.german}` : word.german;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function tokenizeSentence(value: string): string[] {
  return (
    value
      .normalize('NFKC')
      .toLocaleLowerCase('de-DE')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

function isWordOrderTrap(model: CourseModelSentence): boolean {
  const answerTokens = tokenizeSentence(model.de);
  const trapTokens = tokenizeSentence(model.trap);
  return (
    answerTokens.join('|') !== trapTokens.join('|') &&
    answerTokens.toSorted().join('|') === trapTokens.toSorted().join('|')
  );
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
  ];
}

function checkpointQuestions(
  chapter: CoursePathChapter,
  language: MotherTongue,
): CoursePathQuestion[] {
  const wordIndexes = unique([
    String(Math.min(1, chapter.words.length - 1)),
    String(Math.max(0, chapter.words.length - 1)),
  ]).map(Number);
  const germanLabels = chapter.words.map(courseWordLabel);
  const wordQuestions = wordIndexes.map((wordIndex, index): CoursePathQuestion => {
    const word = chapter.words[wordIndex];
    const meaning = courseWordMeaning(word, language);
    return {
      id: `${chapter.id}:checkpoint:word:${index + 1}`,
      instruction: localized(language, {
        cs: 'Vybav si německý výraz.',
        en: 'Recall the German expression.',
      }),
      prompt: meaning,
      promptLang: language,
      answer: courseWordLabel(word),
      answerLang: 'de',
      options: optionsWithAnswer(courseWordLabel(word), germanLabels, index, 2),
      explanation: localized(language, {
        cs:
          word.exampleDe && word.exampleCs
            ? `${word.exampleDe} — ${word.exampleCs}`
            : `Správný výraz je „${courseWordLabel(word)}“.`,
        en: `The correct expression is “${courseWordLabel(word)}”.`,
      }),
      kind: 'word',
    };
  });
  const sentenceQuestions = chapter.modelSentences.map((model, index) =>
    modelSentenceQuestion(chapter, model, index, 'checkpoint', language),
  );
  const errorModel = chapter.modelSentences[1] ?? chapter.modelSentences[0];
  const wordOrderError = isWordOrderTrap(errorModel);
  const diagnosis = localized(language, {
    cs: wordOrderError
      ? `Větné členy jsou v chybném pořadí. ${errorModel.note}`
      : `Věta používá chybný tvar nebo vazbu. ${errorModel.note}`,
    en: wordOrderError
      ? 'The sentence elements are in the wrong order, so the chapter pattern is broken.'
      : 'The sentence uses the wrong form or construction for the chapter pattern.',
  });
  const diagnosticDistractors =
    language === 'en'
      ? [
          'The sentence is grammatical; only its punctuation needs changing.',
          'The only issue is that the register is too formal.',
          'Only the final noun needs to be replaced with a synonym.',
        ]
      : [
          'Věta je gramaticky správná; stačí změnit interpunkci.',
          'Problém je pouze ve volbě příliš formálního registru.',
          'Stačí nahradit poslední podstatné jméno synonymem.',
        ];
  const errorClinic: CoursePathQuestion = {
    id: `${chapter.id}:checkpoint:error-clinic`,
    instruction: localized(language, {
      cs: 'Jazyková detektivka: najdi přesný důvod, proč věta nefunguje.',
      en: 'Language detective: identify exactly why the sentence does not work.',
    }),
    prompt: errorModel.trap,
    promptLang: 'de',
    answer: diagnosis,
    answerLang: language,
    options: optionsWithAnswer(diagnosis, diagnosticDistractors, chapter.number, 1),
    explanation: localized(language, {
      cs: `Opravená věta: „${errorModel.de}“ ${errorModel.note}`,
      en: `Corrected sentence: “${errorModel.de}” The correction restores the chapter’s intended grammar and meaning.`,
    }),
    kind: 'error',
  };
  return [...wordQuestions, errorClinic, ...sentenceQuestions];
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

function normalizedForms(word: CourseWord): string[] {
  return unique([
    word.german,
    word.article ? `${word.article} ${word.german}` : '',
    word.plural ?? '',
    word.verbForms?.thirdPerson ?? '',
    word.verbForms?.preterite ?? '',
    word.verbForms?.participle ?? '',
  ]);
}

export function sentenceUsesCourseWord(sentence: string, words: CourseWord[]): boolean {
  const sentenceTokens = lexicalTokens(sentence);
  return words.some(
    (word) =>
      normalizedForms(word).some((form) => containsLexicalForm(sentenceTokens, form)) ||
      (word.kind === 'adjective' &&
        germanAdjectiveInflectionMatches(sentenceTokens, word.german)) ||
      (word.kind === 'verb' && germanVerbInflectionMatches(sentenceTokens, word.german)),
  );
}
