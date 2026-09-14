import { normalizeText } from '../grading/normalize.ts';
import { DETAILED_CEFR_LEVELS } from '../levels.ts';
import { storyBookIds } from '../stories/progress.ts';
import {
  transferCoachScenarios,
  transferCoachScenarioIdByChapterId,
} from './coach-scenarios-transfer.ts';
import { coachScenarioById, coachScenarios } from './coach.ts';
import {
  CORE_COURSE_CHAPTER_IDS,
  COURSE_CONTENT_VERSION,
  LEGACY_COURSE_CHAPTER_IDS,
} from './content-version.ts';
import { courseCommunications } from './course-communication.ts';
import {
  diversityChapterBlueprints,
  diversityChapterBridges,
} from './course-diversity-chapters.ts';
import { courseFoundations } from './course-foundations.ts';
import { courseInformationGaps } from './course-information-gaps.ts';
import { lessonCourseMap } from './course-map.ts';
import {
  TRANSFER_CHAPTER_THREAD_COUNT,
  transferChapterThreads,
} from './course-transfer-threads.ts';
import { checkCourseWriting } from './course-writing.ts';
import { futureChapterVocabularyPacks } from './future-chapter-vocabulary.ts';
import { grammarCategories, grammarLessonById, grammarLessons } from './grammar.ts';
import { coursePathQuestionsForNode, sentenceUsesCourseWord } from './path-activities.ts';
import { coursePathChapters } from './path.ts';

export type ContentValidationResult = {
  ok: boolean;
  errors: string[];
  counts: {
    chapters: number;
    legacyChapters: number;
    additiveChapters: number;
    nodes: number;
    uniqueLexemes: number;
    modelSentences: number;
    listeningDictations: number;
    errorClinics: number;
    communicationSequences: number;
    foundationalVocabulary: number;
    informationGapScenarios: number;
    dialogues: number;
    coherentDialogues: number;
    assessments: number;
    grammarLessons: number;
    grammarQuestions: number;
    coachScenarios: number;
    dedicatedTransferCoachScenarios: number;
    transferThreads: number;
    diversityBridges: number;
    topicVocabularyPacks: number;
    topicVocabulary: number;
  };
};

function detectCycles(graph: Map<string, string[]>): string[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const errors: string[] = [];

  function visit(id: string, path: string[]): void {
    if (visiting.has(id)) {
      errors.push(`Cyklus prerequisites: ${[...path, id].join(' -> ')}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graph.get(id) ?? []) visit(dependency, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of graph.keys()) visit(id, []);
  return errors;
}

function hasPlaceholder(value: string): boolean {
  return /(?:TODO|FIXME|lorem ipsum|placeholder|\[doplnit(?:\s[^\]]*)?\])/iu.test(value);
}

function normalizeEditorialText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('de-DE').replace(/\s+/gu, ' ');
}

function normalizeExactText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

function normalizeCollocation(value: string): string {
  return normalizeEditorialText(value)
    .replace(/^(?:der|die|das)\s+/u, '')
    .replace(/[.!?,;:]+$/gu, '');
}

function hasContextualCollocation(german: string, collocations: readonly string[]): boolean {
  const lemma = normalizeCollocation(german);
  return collocations.some((collocation) => {
    const normalized = normalizeCollocation(collocation);
    return normalized.length > 0 && normalized !== lemma;
  });
}

function normalizedMultiset(values: readonly string[]): string {
  return values.map(normalizeText).toSorted().join('|');
}

export function validateCourseContent(): ContentValidationResult {
  const errors: string[] = [];
  const chaptersById = new Map(coursePathChapters.map((chapter) => [chapter.id, chapter]));
  const chaptersByThemeTag = new Map(
    coursePathChapters.map((chapter) => [chapter.themeTag, chapter]),
  );
  const chapterIds = new Set(chaptersById.keys());
  const nodeIds = new Set<string>();
  const lexemes = coursePathChapters.flatMap((chapter) => chapter.words);
  const lexemeIds = new Set(lexemes.map((word) => word.id));
  const lexemeById = new Map(lexemes.map((word) => [word.id, word]));
  const chapterIdsByGerman = new Map<string, Set<string>>();
  const chapterCountByLevel = new Map<string, number>();
  for (const chapter of coursePathChapters) {
    chapterCountByLevel.set(chapter.level, (chapterCountByLevel.get(chapter.level) ?? 0) + 1);
    for (const word of chapter.words) {
      const german = normalizeEditorialText(word.german);
      const activeChapterIds = chapterIdsByGerman.get(german) ?? new Set<string>();
      activeChapterIds.add(chapter.id);
      chapterIdsByGerman.set(german, activeChapterIds);
    }
  }
  const diversityBlueprintsById = new Map(
    diversityChapterBlueprints.map((blueprint) => [blueprint.id, blueprint]),
  );
  const lexemeSignatures = new Map<string, string>();
  const chapterGraph = new Map<string, string[]>();
  let listeningDictations = 0;
  let errorClinics = 0;
  let coherentDialogues = 0;

  if (coursePathChapters.length < 120) errors.push('Core mapa má méně než 120 kapitol.');
  for (const level of DETAILED_CEFR_LEVELS) {
    if ((chapterCountByLevel.get(level) ?? 0) < 12) {
      errors.push(`Podúroveň ${level} má méně než 12 kapitol.`);
    }
  }
  if (
    coursePathChapters.map((chapter) => chapter.id).join('|') !== CORE_COURSE_CHAPTER_IDS.join('|')
  ) {
    errors.push('Pořadí core kapitol neodpovídá versioned mapě.');
  }
  for (const legacyId of LEGACY_COURSE_CHAPTER_IDS) {
    if (!chapterIds.has(legacyId)) errors.push(`Chybí legacy kapitola ${legacyId}.`);
  }

  const transferChapters = coursePathChapters.filter((chapter) => chapter.contentVersion === 3);
  const transferThreadIds = Object.keys(transferChapterThreads);
  if (
    transferThreadIds.length !== TRANSFER_CHAPTER_THREAD_COUNT ||
    transferThreadIds.length !== transferChapters.length ||
    transferThreadIds.toSorted().join('|') !==
      transferChapters
        .map((chapter) => chapter.id)
        .toSorted()
        .join('|')
  ) {
    errors.push('Transferové kapitoly a jejich redakční červené nitě nejsou v poměru 1 : 1.');
  }
  for (const [chapterId, thread] of Object.entries(transferChapterThreads)) {
    const chapter = chaptersById.get(chapterId);
    if (!chapter) {
      errors.push(`${chapterId}: červená nit odkazuje na neznámou kapitolu.`);
      continue;
    }
    const expectedWords = [
      ...thread.wordLemmas,
      ...(courseFoundations[chapterId] ?? []).map((word) => word.german),
    ];
    if (chapter.words.map((word) => word.german).join('|') !== expectedWords.join('|')) {
      errors.push(`${chapterId}: slovní zásoba neodpovídá situaci červené nitě.`);
    }
    if (
      chapter.grammarLessonId !== thread.grammarLessonId ||
      chapter.grammarIdea !== thread.grammarIdea ||
      chapter.grammarPattern !== thread.grammarPattern ||
      chapter.sentenceStarter !== thread.sentenceStarter
    ) {
      errors.push(`${chapterId}: gramatika nebo větný startér se odtrhl od červené nitě.`);
    }
    if (
      chapter.coachScenarioId !== thread.coachScenarioId ||
      !chapter.coachScenarioIds.includes(thread.coachScenarioId)
    ) {
      errors.push(`${chapterId}: AI konverzace se odtrhla od cíle kapitoly.`);
    }
    if (
      chapter.modelSentences[0]?.de !== thread.responseDe ||
      chapter.modelSentences[0]?.cs !== thread.responseCs
    ) {
      errors.push(`${chapterId}: hlavní modelová odpověď neuzavírá situaci kapitoly.`);
    }
    if (
      chapter.dialogue[0]?.de !== thread.promptDe ||
      chapter.dialogue[0]?.cs !== thread.promptCs ||
      chapter.dialogue[1]?.de !== thread.responseDe ||
      chapter.dialogue[1]?.cs !== thread.responseCs
    ) {
      errors.push(`${chapterId}: dialog nenavazuje otázkou a cílovou odpovědí.`);
    }
    if (
      !chapter.situation.includes(thread.promptCs) ||
      !chapter.sentencePrompt.includes(thread.promptCs) ||
      !chapter.mission.includes(thread.sentenceStarter)
    ) {
      errors.push(
        `${chapterId}: hratelná role, vstupní replika a vlastní výstup nejsou propojené.`,
      );
    }
    const bridgeLexemeCount = chapter.words.filter((word) =>
      sentenceUsesCourseWord(thread.responseDe, [word]),
    ).length;
    if (bridgeLexemeCount < 2) {
      errors.push(`${chapterId}: hlavní odpověď nepropojuje alespoň dva výrazy kapitoly.`);
    }
  }

  const diversityBridgeIds = Object.keys(diversityChapterBridges);
  const diversityBlueprintIds = diversityChapterBlueprints.map((blueprint) => blueprint.id);
  if (diversityBridgeIds.toSorted().join('|') !== diversityBlueprintIds.toSorted().join('|')) {
    errors.push('Tematické kapitoly a jejich propojující věty nejsou v poměru 1 : 1.');
  }
  for (const [chapterId, bridge] of Object.entries(diversityChapterBridges)) {
    const chapter = chaptersById.get(chapterId);
    const blueprint = diversityBlueprintsById.get(chapterId);
    if (!chapter) {
      errors.push(`${chapterId}: propojující věta odkazuje na neznámou kapitolu.`);
      continue;
    }
    if (
      !blueprint ||
      chapter.grammarLessonId !== blueprint.grammarLessonId ||
      !chapter.grammarLessonIds.includes(blueprint.grammarLessonId)
    ) {
      errors.push(`${chapterId}: primární gramatická lekce neodpovídá větnému vzoru.`);
    }
    if (
      chapter.modelSentences[0]?.de !== bridge.de ||
      chapter.modelSentences[0]?.cs !== bridge.cs ||
      chapter.sentenceStarter !== bridge.sentenceStarter
    ) {
      errors.push(`${chapterId}: diktát, modelová odpověď a produkční startér nejsou propojené.`);
    }
    if (
      !blueprint ||
      !chapter.subtitle.includes(blueprint.dialogue[0].cs) ||
      !chapter.sentencePrompt.includes(blueprint.dialogue[0].cs) ||
      !chapter.mission.includes(blueprint.speakerB.toLocaleLowerCase('cs-CZ'))
    ) {
      errors.push(`${chapterId}: tematická kapitola nemá konkrétní roli a vstupní repliku.`);
    }
    const bridgeLexemeCount = chapter.words.filter((word) =>
      sentenceUsesCourseWord(bridge.de, [word]),
    ).length;
    if (bridgeLexemeCount < 2) {
      errors.push(`${chapterId}: propojující věta nepoužívá alespoň dva nové výrazy.`);
    }
  }

  for (const chapter of coursePathChapters) {
    chapterGraph.set(chapter.id, chapter.prerequisites);
    if (chapter.contentVersion < 1 || chapter.contentVersion > COURSE_CONTENT_VERSION) {
      errors.push(`${chapter.id}: neplatná contentVersion.`);
    }
    if (
      [
        chapter.title,
        chapter.subtitle,
        chapter.themeTag,
        chapter.situation,
        chapter.grammarIdea,
        chapter.grammarPattern,
        chapter.sentencePrompt,
        chapter.sentenceStarter,
      ].some((value) => !value.trim() || hasPlaceholder(value))
    ) {
      errors.push(`${chapter.id}: neúplná nebo placeholderová metadata kapitoly.`);
    }
    if (chapter.mission.trim().length < 40 || hasPlaceholder(chapter.mission)) {
      errors.push(`${chapter.id}: příliš obecná mission.`);
    }
    if (
      [chapter.subtitle, chapter.situation, chapter.mission].some((value) =>
        /^(?:Zaměřený transfer:|Nové téma z reálného života:|Navazující situace|Tvým úkolem je|Použiješ novou slovní zásobu tak)/u.test(
          value,
        ),
      )
    ) {
      errors.push(`${chapter.id}: kapitola stále používá obecnou redakční šablonu.`);
    }
    if (
      chapter.outcomes.length < 3 ||
      chapter.outcomes.some((outcome) => !outcome.trim() || hasPlaceholder(outcome)) ||
      new Set(chapter.outcomes.map(normalizeEditorialText)).size !== chapter.outcomes.length
    ) {
      errors.push(`${chapter.id}: chybí unikátní ověřitelné outcomes.`);
    }
    if (
      chapter.sentenceChecklist.length < 3 ||
      chapter.sentenceChecklist.some((item) => !item.trim() || hasPlaceholder(item)) ||
      new Set(chapter.sentenceChecklist.map(normalizeEditorialText)).size !==
        chapter.sentenceChecklist.length
    ) {
      errors.push(`${chapter.id}: neúplný nebo duplicitní sentence checklist.`);
    }
    if (chapter.modelSentences.length < 3 || chapter.modelSentences.length > 8) {
      errors.push(`${chapter.id}: očekáváno 3–8 modelových vět.`);
    }
    const normalizedModelAnswers = new Set(
      chapter.modelSentences.map((sentence) => normalizeText(sentence.de)),
    );
    if (new Set(chapter.modelSentences.map((sentence) => normalizeText(sentence.trap))).size < 3) {
      errors.push(`${chapter.id}: modelové věty nemají tři unikátní chybné varianty.`);
    }
    const mixQuestions = coursePathQuestionsForNode(chapter, 'mix', 'cs');
    const chapterDictations = mixQuestions.filter((question) => question.kind === 'dictation');
    listeningDictations += chapterDictations.length;
    const dictation = chapterDictations[0];
    if (
      chapterDictations.length !== 1 ||
      mixQuestions[0]?.kind !== 'dictation' ||
      dictation?.answer !== chapter.modelSentences[0]?.de ||
      !dictation?.options.includes(dictation.answer) ||
      (dictation?.wordCount ?? 0) < 2
    ) {
      errors.push(`${chapter.id}: mix nemá jeden úplný poslechový diktát.`);
    }
    const checkpointQuestions = coursePathQuestionsForNode(chapter, 'checkpoint', 'cs');
    const chapterErrorClinics = checkpointQuestions.filter((question) => question.kind === 'error');
    errorClinics += chapterErrorClinics.length;
    const errorClinic = chapterErrorClinics[0];
    if (
      chapterErrorClinics.length !== 1 ||
      !errorClinic?.prompt.trim() ||
      errorClinic.response !== 'recall' ||
      errorClinic.options.length !== 0 ||
      !errorClinic.answer.trim() ||
      errorClinic.prompt.replace('_____', errorClinic.answer) !== chapter.modelSentences[1]?.de ||
      !errorClinic.explanation.includes(chapter.modelSentences[1]?.de ?? '')
    ) {
      errors.push(`${chapter.id}: checkpoint nemá jednu úplnou jazykovou detektivku.`);
    }
    if (
      chapter.dialogue.length < 2 ||
      chapter.dialogue.some((turn) =>
        [turn.speaker, turn.de, turn.cs].some((value) => !value.trim() || hasPlaceholder(value)),
      )
    ) {
      errors.push(`${chapter.id}: chybí úplný krátký dialog.`);
    }
    if (sentenceUsesCourseWord(chapter.dialogue.map((turn) => turn.de).join(' '), chapter.words)) {
      coherentDialogues += 1;
    } else {
      errors.push(`${chapter.id}: dialog nepoužívá žádný výraz své kapitoly.`);
    }
    if (
      !chapter.assessment.deterministic ||
      !chapter.assessment.id.trim() ||
      !chapter.assessment.instruction.trim() ||
      hasPlaceholder(chapter.assessment.instruction) ||
      chapter.assessment.criteria.length < 3 ||
      chapter.assessment.criteria.some(
        (criterion) => !criterion.trim() || hasPlaceholder(criterion),
      ) ||
      new Set(chapter.assessment.criteria.map(normalizeEditorialText)).size !==
        chapter.assessment.criteria.length
    ) {
      errors.push(`${chapter.id}: chybí deterministic assessment.`);
    }
    if (
      chapter.nodes.length !== 8 ||
      chapter.nodeIds.join('|') !== chapter.nodes.map((node) => node.id).join('|') ||
      new Set(chapter.nodes.map((node) => node.type)).size !== chapter.nodes.length
    ) {
      errors.push(`${chapter.id}: nodeIds nebo osm typů uzlů nesedí.`);
    }
    if (
      chapter.estimatedMinutes !==
      chapter.nodes.filter((node) => node.required).reduce((sum, node) => sum + node.minutes, 0)
    ) {
      errors.push(`${chapter.id}: odhad minut neodpovídá povinným uzlům.`);
    }
    for (const dependency of chapter.prerequisites) {
      if (!chapterIds.has(dependency))
        errors.push(`${chapter.id}: neznámý prerequisite ${dependency}.`);
    }
    for (const grammarId of chapter.grammarLessonIds) {
      if (!grammarLessonById(grammarId)) errors.push(`${chapter.id}: neznámá lekce ${grammarId}.`);
    }
    for (const scenarioId of chapter.coachScenarioIds) {
      if (!coachScenarioById(scenarioId))
        errors.push(`${chapter.id}: neznámý scénář ${scenarioId}.`);
    }
    const dedicatedCoachScenarioId = transferCoachScenarioIdByChapterId[chapter.id];
    if (dedicatedCoachScenarioId && chapter.coachScenarioId !== dedicatedCoachScenarioId) {
      errors.push(
        `${chapter.id}: primární coach scénář není cílená mise ${dedicatedCoachScenarioId}.`,
      );
    }
    for (const readingId of chapter.readingIds) {
      if (!storyBookIds.includes(readingId))
        errors.push(`${chapter.id}: neznámá četba ${readingId}.`);
    }
    for (const reviewId of chapter.reviewLexemeIds) {
      if (!lexemeIds.has(reviewId)) errors.push(`${chapter.id}: neznámý review lexém ${reviewId}.`);
    }
    for (const [index, node] of chapter.nodes.entries()) {
      if (nodeIds.has(node.id)) errors.push(`Duplicitní node ID ${node.id}.`);
      nodeIds.add(node.id);
      if (node.chapterId !== chapter.id) errors.push(`${node.id}: nesprávný chapterId.`);
      if (node.order !== index + 1) errors.push(`${node.id}: nesprávné pořadí uzlu.`);
      if (
        [node.title, node.description].some((value) => !value.trim() || hasPlaceholder(value)) ||
        node.minutes < 1 ||
        node.xp < 0
      ) {
        errors.push(`${node.id}: neúplná metadata uzlu.`);
      }
      if (node.grammarLessonId && !chapter.grammarLessonIds.includes(node.grammarLessonId)) {
        errors.push(`${node.id}: grammar lesson neleží v kapitole.`);
      }
      if (node.coachScenarioId && !chapter.coachScenarioIds.includes(node.coachScenarioId)) {
        errors.push(`${node.id}: coach scenario neleží v kapitole.`);
      }
      if (node.storyBookId && !chapter.readingIds.includes(node.storyBookId)) {
        errors.push(`${node.id}: reading neleží v kapitole.`);
      }
    }
    for (const targetId of chapter.targetLexemeIds) {
      if (!chapter.words.some((word) => word.id === targetId)) {
        errors.push(`${chapter.id}: neznámý target lexém ${targetId}.`);
      }
    }
    for (const word of chapter.words) {
      if (!word.id || !word.senseId || !word.lemma || !word.primaryCzech) {
        errors.push(`${chapter.id}: neúplný lexém ${word.german}.`);
      }
      if (/[;,]/u.test(word.primaryCzech)) {
        errors.push(`${chapter.id}/${word.id}: primaryCzech spojuje více významů oddělovačem.`);
      }
      if (!word.contexts.length || !word.collocations.length) {
        errors.push(`${chapter.id}/${word.id}: chybí context nebo collocation.`);
      }
      if (!hasContextualCollocation(word.german, word.collocations)) {
        errors.push(`${chapter.id}/${word.id}: collocation jen opakuje heslo bez vazby.`);
      }
      if (word.kind === 'noun' && (!word.article || !word.plural)) {
        errors.push(`${chapter.id}/${word.id}: noun nemá article/plural.`);
      }
      if (
        word.kind === 'verb' &&
        (!word.verbForms?.thirdPerson ||
          !word.verbForms.preterite ||
          !word.verbForms.participle ||
          !word.verbForms.auxiliary)
      ) {
        errors.push(`${chapter.id}/${word.id}: verb nemá principal parts.`);
      }
      const accepted = [word.primaryCzech, ...word.acceptedCzech].map(normalizeText);
      if (new Set(accepted).size !== accepted.length) {
        errors.push(`${chapter.id}/${word.id}: duplicitní accepted Czech odpověď.`);
      }
      const acceptedGerman = [word.german, ...word.acceptedGerman].map(normalizeText);
      if (new Set(acceptedGerman).size !== acceptedGerman.length) {
        errors.push(`${chapter.id}/${word.id}: duplicitní accepted German odpověď.`);
      }
      const signature = JSON.stringify({
        german: word.german,
        primaryCzech: word.primaryCzech,
        kind: word.kind,
        article: word.article,
        plural: word.plural,
        verbForms: word.verbForms,
      });
      const previousSignature = lexemeSignatures.get(word.id);
      if (previousSignature && previousSignature !== signature) {
        errors.push(`${chapter.id}/${word.id}: opakovaný lexém má konfliktní kanonická data.`);
      } else {
        lexemeSignatures.set(word.id, signature);
      }
      if (
        [word.german, word.primaryCzech, word.exampleDe ?? '', word.exampleCs ?? ''].some(
          hasPlaceholder,
        )
      ) {
        errors.push(`${chapter.id}/${word.id}: placeholder v obsahu.`);
      }
    }
    const availableWords = [
      ...chapter.words,
      ...chapter.reviewLexemeIds.flatMap((id) => {
        const word = lexemeById.get(id);
        return word ? [word] : [];
      }),
    ];
    for (const sentence of chapter.modelSentences) {
      if (/^(?:Das Verb|Der Ausdruck) „[^”]+“ passt hier:/u.test(sentence.de)) {
        errors.push(`${chapter.id}: modelová věta místo přirozené němčiny používá metatext.`);
      }
      if (!sentenceUsesCourseWord(sentence.de, availableWords)) {
        errors.push(`${chapter.id}: modelová věta nepoužívá cílový lexém: ${sentence.de}`);
      }
      if ([sentence.de, sentence.cs, sentence.trap, sentence.note].some(hasPlaceholder)) {
        errors.push(`${chapter.id}: placeholder v modelové větě.`);
      }
      if (
        [sentence.de, sentence.cs, sentence.trap].some((value) =>
          /(?:\.\.\.|…)$/u.test(value.trim()),
        )
      ) {
        errors.push(`${chapter.id}: nedokončená modelová věta.`);
      }
      if (normalizedModelAnswers.has(normalizeText(sentence.trap))) {
        errors.push(`${chapter.id}: trap je totožný s některou správnou modelovou větou.`);
      }
    }
  }

  errors.push(...detectCycles(chapterGraph));
  for (const level of DETAILED_CEFR_LEVELS) {
    const communications = courseCommunications.filter((item) => item.level === level);
    const chapter = coursePathChapters.findLast((item) => item.level === level);
    if (communications.length !== 1 || communications[0].chapterId !== chapter?.id) {
      errors.push(`${level}: závěr úrovně nemá právě jednu navazující komunikační sadu.`);
    }
  }
  for (const item of courseCommunications) {
    const chapter = chaptersById.get(item.chapterId);
    if (!chapter || !checkCourseWriting(chapter, item.writing.model).ready) {
      errors.push(
        `${item.chapterId}: vzorový písemný výstup neodpovídá rozsahu nebo slovní zásobě.`,
      );
    }
    if (item.reading.text === item.listening.transcript || item.reading.text.length < 60) {
      errors.push(`${item.chapterId}: čtení v checkpointu potřebuje nový souvislý text.`);
    }
    if (item.listening.tasks.map((task) => task.focus).join('|') !== 'gist|detail') {
      errors.push(`${item.chapterId}: poslech musí postupovat od hlavní myšlenky k detailu.`);
    }
    for (const task of item.listening.tasks) {
      if (
        new Set([task.answer, ...task.distractors]).size !== 4 ||
        !task.explanation.cs ||
        !task.explanation.en
      ) {
        errors.push(`${item.chapterId}: poslech má neúplné možnosti nebo vysvětlení.`);
      }
    }
  }

  const categoryIds = new Set<string>();
  for (const category of grammarCategories) {
    if (categoryIds.has(category.id)) errors.push(`Duplicitní grammar category ID ${category.id}.`);
    categoryIds.add(category.id);
    if (
      [category.title, category.description].some((value) => !value.trim() || hasPlaceholder(value))
    ) {
      errors.push(`${category.id}: neúplná nebo placeholderová metadata kategorie.`);
    }
  }

  const mappedLessons = new Set(lessonCourseMap.map((mapping) => mapping.lessonId));
  if (mappedLessons.size !== lessonCourseMap.length) {
    errors.push('Grammar lesson má více než jedno course mapping pravidlo.');
  }
  const lessonGraph = new Map(
    lessonCourseMap.map((mapping) => [mapping.lessonId, mapping.prerequisites]),
  );
  const lessonIds = new Set<string>();
  const questionIds = new Set<string>();
  for (const lesson of grammarLessons) {
    if (lessonIds.has(lesson.id)) errors.push(`Duplicitní grammar lesson ID ${lesson.id}.`);
    lessonIds.add(lesson.id);
    if (!categoryIds.has(lesson.categoryId)) {
      errors.push(`${lesson.id}: neznámá grammar category ${lesson.categoryId}.`);
    }
    if (
      [lesson.title, lesson.shortTitle, lesson.subtitle, lesson.concept, lesson.formula].some(
        (value) => !value.trim() || hasPlaceholder(value),
      )
    ) {
      errors.push(`${lesson.id}: neúplná nebo placeholderová metadata lekce.`);
    }
    if (lesson.examples.length < 2) errors.push(`${lesson.id}: chybí vysvětlující příklady.`);
    if (!mappedLessons.has(lesson.id)) errors.push(`Lekce ${lesson.id} není mapovaná.`);
    if (lesson.questions.length !== 5) errors.push(`Lekce ${lesson.id} nemá přesně pět otázek.`);
    for (const question of lesson.questions) {
      if (questionIds.has(question.id))
        errors.push(`Duplicitní grammar question ID ${question.id}.`);
      questionIds.add(question.id);
      if (
        [question.prompt, question.instruction, question.explanation, question.skill].some(
          (value) => !value.trim() || hasPlaceholder(value),
        )
      ) {
        errors.push(`${lesson.id}/${question.id}: neúplné zadání nebo vysvětlení.`);
      }
      if (question.explanation.trim().length < 40) {
        errors.push(`${lesson.id}/${question.id}: vysvětlení je příliš stručné.`);
      }
      if (question.prompt.trim() === 'Která věta je správně?') {
        errors.push(`${lesson.id}/${question.id}: otázka nepojmenovává ověřovanou dovednost.`);
      }
      if (question.kind === 'choice') {
        if (question.options.length < 3) {
          errors.push(`${lesson.id}/${question.id}: příliš málo možností.`);
        }
        const exactOptions = question.options.map(normalizeExactText);
        if (new Set(exactOptions).size !== exactOptions.length) {
          errors.push(`${lesson.id}/${question.id}: přesně duplicitní možnost.`);
        }
        const normalized = question.options.map(normalizeText);
        const orthographyContrast = /(?:pravopis|velk|oslovení|zpodstat)/iu.test(
          `${question.skill} ${question.explanation}`,
        );
        if (!orthographyContrast && new Set(normalized).size !== normalized.length) {
          errors.push(`${lesson.id}/${question.id}: duplicitní distractor.`);
        }
        if (!question.options.includes(question.answer)) {
          errors.push(`${lesson.id}/${question.id}: odpověď není mezi možnostmi.`);
        }
      } else if (question.kind === 'fill') {
        if (!question.before.trim() && !question.after.trim()) {
          errors.push(`${lesson.id}/${question.id}: doplňovačka nemá větný rámec.`);
        }
        const answers = question.answers.map(
          (answer) => normalizeText(answer) || normalizeExactText(answer),
        );
        if (!answers.length || answers.some((answer) => !answer)) {
          errors.push(`${lesson.id}/${question.id}: doplňovačka nemá platnou odpověď.`);
        }
        if (new Set(answers).size !== answers.length) {
          errors.push(`${lesson.id}/${question.id}: duplicitní fill odpověď.`);
        }
        if (
          !question.before.trim() &&
          question.answers.some((answer) => /^\p{Ll}/u.test(answer.trim()))
        ) {
          errors.push(`${lesson.id}/${question.id}: větná odpověď začíná malým písmenem.`);
        }
        if (!question.hint.trim()) errors.push(`${lesson.id}/${question.id}: chybí nápověda.`);
      } else {
        if (question.tokens.length < 2 || question.answer.length !== question.tokens.length) {
          errors.push(`${lesson.id}/${question.id}: neplatný počet tokenů v řazení.`);
        }
        if (normalizedMultiset(question.tokens) !== normalizedMultiset(question.answer)) {
          errors.push(`${lesson.id}/${question.id}: odpověď řazení neodpovídá tokenům.`);
        }
        if (
          question.tokens.map(normalizeText).join('|') ===
          question.answer.map(normalizeText).join('|')
        ) {
          errors.push(`${lesson.id}/${question.id}: řazení už je ve správném pořadí.`);
        }
        if (!question.translation.trim()) {
          errors.push(`${lesson.id}/${question.id}: řazení nemá český překlad.`);
        }
      }
    }
  }
  for (const mapping of lessonCourseMap) {
    if (!grammarLessonById(mapping.lessonId))
      errors.push(`Mapování odkazuje na ${mapping.lessonId}.`);
    if (!mapping.chapters.length) errors.push(`${mapping.lessonId}: chybí chapter mapping.`);
    for (const chapter of mapping.chapters) {
      if (!chapterIds.has(chapter.chapterId)) {
        errors.push(`${mapping.lessonId}: neznámá kapitola ${chapter.chapterId}.`);
      }
    }
  }
  errors.push(...detectCycles(lessonGraph));

  const scenarioIds = new Set<string>();
  for (const scenario of coachScenarios) {
    if (scenarioIds.has(scenario.id)) errors.push(`Duplicitní coach scenario ID ${scenario.id}.`);
    scenarioIds.add(scenario.id);
    if (
      [
        scenario.title,
        scenario.description,
        scenario.goal,
        scenario.opening,
        scenario.openingCs,
        scenario.learnerRole,
        scenario.coachRole,
      ].some((value) => !value.trim() || hasPlaceholder(value))
    ) {
      errors.push(`${scenario.id}: neúplná nebo placeholderová metadata konverzace.`);
    }
    if (scenario.starterPrompts.length < scenario.turns) {
      errors.push(`${scenario.id}: méně startovacích vět než tahů.`);
    }
    if (scenario.focusWords.length < 3 || scenario.contextCues.length < 5) {
      errors.push(`${scenario.id}: příliš řídká slovní nebo situační opora.`);
    }
    if (
      (scenario.level === 'A1' || scenario.level === 'A2') &&
      (!scenario.guidedHints || scenario.guidedHints.length < scenario.turns)
    ) {
      errors.push(`${scenario.id}: začátečnický scénář nemá nápovědu pro každý tah.`);
    } else if (scenario.guidedHints && scenario.guidedHints.length < scenario.turns) {
      errors.push(`${scenario.id}: méně vedených nápověd než tahů.`);
    }
    for (const [label, values] of [
      ['focusWords', scenario.focusWords],
      ['contextCues', scenario.contextCues],
      ['starterPrompts', scenario.starterPrompts],
    ] as const) {
      const normalized = values.map(normalizeEditorialText);
      if (normalized.some((value) => !value) || new Set(normalized).size !== normalized.length) {
        errors.push(`${scenario.id}: prázdné nebo duplicitní ${label}.`);
      }
    }
    for (const hint of scenario.guidedHints ?? []) {
      if ([hint.label, hint.german, hint.czech].some((value) => !value.trim())) {
        errors.push(`${scenario.id}: neúplná vedená nápověda.`);
      }
    }
  }
  const mappedTransferScenarioIds = Object.values(transferCoachScenarioIdByChapterId);
  if (new Set(mappedTransferScenarioIds).size !== mappedTransferScenarioIds.length) {
    errors.push('Cílené transferové coach mise obsahují duplicitní mapování.');
  }
  for (const [chapterId, scenarioId] of Object.entries(transferCoachScenarioIdByChapterId)) {
    if (!chapterIds.has(chapterId)) {
      errors.push(`Cílená coach mise odkazuje na neznámou kapitolu ${chapterId}.`);
    }
    if (!scenarioIds.has(scenarioId)) {
      errors.push(`Cílená coach mise odkazuje na neznámý scénář ${scenarioId}.`);
    }
  }

  const futurePackIds = new Set<string>();
  const futureGerman = new Set<string>();
  for (const chapterPack of futureChapterVocabularyPacks) {
    if (futurePackIds.has(chapterPack.id)) {
      errors.push(`Duplicitní future vocabulary pack ID ${chapterPack.id}.`);
    }
    futurePackIds.add(chapterPack.id);
    if (
      [chapterPack.title, chapterPack.situation].some(
        (value) => !value.trim() || hasPlaceholder(value),
      )
    ) {
      errors.push(`${chapterPack.id}: neúplná metadata future vocabulary packu.`);
    }
    if (chapterPack.words.length !== 10) {
      errors.push(`${chapterPack.id}: chapter-ready pack nemá přesně deset slov.`);
    }
    for (const grammarId of chapterPack.grammarLessonIds) {
      if (!grammarLessonById(grammarId)) {
        errors.push(`${chapterPack.id}: neznámá future grammar lesson ${grammarId}.`);
      }
    }
    for (const scenarioId of chapterPack.coachScenarioIds) {
      if (!coachScenarioById(scenarioId)) {
        errors.push(`${chapterPack.id}: neznámý future coach scenario ${scenarioId}.`);
      }
    }
    const promotedChapter = chaptersByThemeTag.get(`rozmanitost-${chapterPack.id}`);
    if (!promotedChapter) {
      errors.push(`${chapterPack.id}: tematický slovní balíček není aktivní kapitolou.`);
    }
    for (const word of chapterPack.words) {
      const german = normalizeEditorialText(word.german);
      if (!german || !word.czech.trim() || !word.exampleDe?.trim() || !word.exampleCs?.trim()) {
        errors.push(`${chapterPack.id}/${word.german}: neúplný chapter-ready lexém.`);
      }
      if (/[;,]/u.test(word.czech)) {
        errors.push(`${chapterPack.id}/${word.german}: český význam není context-specific.`);
      }
      const activeChapterIds = chapterIdsByGerman.get(german);
      if (
        activeChapterIds?.size !== 1 ||
        !promotedChapter ||
        activeChapterIds?.has(promotedChapter.id) !== true
      ) {
        errors.push(
          `${chapterPack.id}/${word.german}: heslo není unikátně přiřazené své tematické kapitole.`,
        );
      }
      if (futureGerman.has(german)) {
        errors.push(`${chapterPack.id}/${word.german}: duplicitní heslo mezi tematickými balíčky.`);
      }
      futureGerman.add(german);
      if (!hasContextualCollocation(word.german, word.collocations ?? [])) {
        errors.push(`${chapterPack.id}/${word.german}: chybí použitelná kolokace.`);
      }
      if (word.kind === 'noun' && (!word.article || !word.plural)) {
        errors.push(`${chapterPack.id}/${word.german}: noun nemá article/plural.`);
      }
      if (
        word.kind === 'verb' &&
        (!word.verbForms?.thirdPerson ||
          !word.verbForms.preterite ||
          !word.verbForms.participle ||
          !word.verbForms.auxiliary)
      ) {
        errors.push(`${chapterPack.id}/${word.german}: verb nemá principal parts.`);
      }
    }
  }

  for (const gap of courseInformationGaps) {
    const chapter = chaptersById.get(gap.chapterId);
    const ids = gap.queries.map((query) => query.id);
    if (
      chapter?.level !== gap.level ||
      new Set(ids).size !== 3 ||
      gap.requiredQueryIds.length < 2 ||
      gap.requiredQueryIds.some((id) => !ids.includes(id))
    )
      errors.push(`${gap.chapterId}: rozhovoru chybí jednoznačné dotazy nebo návaznost na úroveň.`);
    if (
      new Set([gap.answer, ...gap.alternatives]).size !== 3 ||
      gap.queries.some((query) => !query.question.trim() || !query.reply.trim())
    )
      errors.push(`${gap.chapterId}: rozhovor má neúplné nebo duplicitní odpovědi.`);
    for (const language of ['cs', 'en'] as const)
      if (!gap.title[language] || !gap.goal[language] || !gap.explanation[language])
        errors.push(`${gap.chapterId}: rozhovor nemá úplný překlad ${language}.`);
  }
  if (
    courseInformationGaps.length !== 10 ||
    new Set(courseInformationGaps.map((gap) => gap.level)).size !== 10 ||
    new Set(courseInformationGaps.map((gap) => gap.chapterId)).size !== 10
  )
    errors.push('Každá podúroveň potřebuje jeden samostatný rozhovor s chybějícími údaji.');
  for (const [chapterId, words] of Object.entries(courseFoundations)) {
    const chapter = chaptersById.get(chapterId);
    if (
      !chapter?.level.startsWith('A1') ||
      words.some(
        (word) =>
          !word.english.trim() || !chapter.words.some((entry) => entry.german === word.german),
      )
    )
      errors.push(
        `${chapterId}: základy nejsou připojené k počáteční kapitole nebo nemají anglický význam.`,
      );
  }

  const counts = {
    chapters: coursePathChapters.length,
    foundationalVocabulary: Object.values(courseFoundations).flat().length,
    informationGapScenarios: courseInformationGaps.length,
    legacyChapters: coursePathChapters.filter((chapter) => chapter.legacyAnchor).length,
    additiveChapters: coursePathChapters.filter((chapter) => !chapter.legacyAnchor).length,
    nodes: nodeIds.size,
    uniqueLexemes: lexemeIds.size,
    modelSentences: coursePathChapters.reduce(
      (sum, chapter) => sum + chapter.modelSentences.length,
      0,
    ),
    listeningDictations,
    errorClinics,
    communicationSequences: courseCommunications.length,
    dialogues: coursePathChapters.filter((chapter) => chapter.dialogue.length > 0).length,
    coherentDialogues,
    assessments: coursePathChapters.filter((chapter) => chapter.assessment.deterministic).length,
    grammarLessons: grammarLessons.length,
    grammarQuestions: grammarLessons.reduce((sum, lesson) => sum + lesson.questions.length, 0),
    coachScenarios: coachScenarios.length,
    dedicatedTransferCoachScenarios: transferCoachScenarios.length,
    transferThreads: transferThreadIds.length,
    diversityBridges: diversityBridgeIds.length,
    topicVocabularyPacks: futureChapterVocabularyPacks.length,
    topicVocabulary: futureChapterVocabularyPacks.reduce(
      (sum, chapterPack) => sum + chapterPack.words.length,
      0,
    ),
  };
  if (counts.uniqueLexemes < 550)
    errors.push('Kurz má méně než 550 unikátních sense-aware lexémů.');
  if (counts.modelSentences < 180) errors.push('Kurz má méně než 180 modelových vět.');

  return { ok: errors.length === 0, errors, counts };
}
