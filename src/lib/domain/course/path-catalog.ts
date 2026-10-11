import { detailedCefrRank } from '../levels.ts';
import { coachScenarioById } from './coach.ts';
import {
  CORE_COURSE_CHAPTER_IDS,
  COURSE_CONTENT_VERSION,
  LEGACY_COURSE_CHAPTER_IDS,
} from './content-version.ts';
import { informationGapForChapter } from './content/activities/course-information-gaps.ts';
import { courseMilestoneForChapter } from './content/activities/course-milestones.ts';
import { courseWritingProfiles } from './content/activities/course-writing-profiles.ts';
import { applyCourseCoherenceOverride } from './content/chapters/course-coherence-overrides.ts';
import { courseChapterContentSupplements } from './content/chapters/course-content-supplement.ts';
import { chapterDefinitions } from './content/chapters/course-core-chapters.ts';
import { createDiversityCourseChapterDefinitions } from './content/chapters/course-diversity-chapters.ts';
import { createExpandedCourseChapterDefinitions } from './content/chapters/course-expansion-v3.ts';
import { additionalCourseChapterDefinitions } from './content/chapters/course-expansion.ts';
import { courseFoundations } from './content/vocabulary/course-foundations.ts';
import { grammarLessonById } from './grammar.ts';
import type {
  CourseChapterDefinition,
  CourseLexeme,
  CoursePathChapter,
  CoursePathNode,
  CourseWord,
} from './path-types.ts';

import type { DetailedCefrLevel } from '../types.ts';

function chapterNodes(definition: CourseChapterDefinition): CoursePathNode[] {
  const prefix = definition.id;
  const grammarLesson = grammarLessonById(definition.grammarLessonId);
  const coachScenario = coachScenarioById(definition.coachScenarioId);
  return [
    {
      id: `${prefix}:vocabulary`,
      chapterId: prefix,
      order: 1,
      type: 'vocabulary',
      phase: 'foundation',
      title: `Slovní základ: ${definition.title}`,
      description: `Poznej ${definition.words.length} výrazů v celých větách a ulož je do dlouhodobého učení.`,
      minutes: 4,
      xp: 20,
      required: true,
    },
    {
      id: `${prefix}:practice`,
      chapterId: prefix,
      order: 2,
      type: 'practice',
      phase: 'foundation',
      title: 'Od významu k němčině',
      description:
        'Nejdřív rozpoznej význam, potom napiš německé výrazy zpaměti. U podstatných jmen přidej člen.',
      minutes: 4,
      xp: 20,
      required: true,
    },
    {
      id: `${prefix}:grammar`,
      chapterId: prefix,
      order: 3,
      type: 'grammar',
      phase: 'connection',
      title: `Pravidlo: ${grammarLesson?.shortTitle ?? definition.grammarIdea}`,
      description:
        grammarLesson?.subtitle ??
        `Pochop princip „${definition.grammarIdea}“ na krátkých příkladech.`,
      minutes: grammarLesson?.minutes ?? 6,
      xp: 25,
      required: true,
      grammarLessonId: definition.grammarLessonId,
    },
    {
      id: `${prefix}:mix`,
      chapterId: prefix,
      order: 4,
      type: 'mix',
      phase: 'connection',
      title: 'Poslech a věty',
      description: courseMilestoneForChapter(prefix)
        ? 'Po diktátu a větách si poslechni novou zprávu. Zachyť hlavní sdělení a jeden důležitý detail.'
        : `Zachyť jednu větu sluchem a potom rozliš ${Math.max(0, definition.modelSentences.length - 1)} další, ve kterých nové výrazy drží právě naučené pravidlo.`,
      minutes: courseMilestoneForChapter(prefix) ? 8 : 5,
      xp: 25,
      required: true,
    },
    {
      id: `${prefix}:sentence`,
      chapterId: prefix,
      order: 5,
      type: 'sentence',
      phase: 'production',
      title: 'Psaní',
      description: 'Napiš vlastní text podle zadání, projdi kontrolní body a uprav ho.',
      minutes: courseWritingProfiles[definition.level].minutes,
      xp: 20,
      required: true,
    },
    {
      id: `${prefix}:coach`,
      chapterId: prefix,
      order: 6,
      type: 'coach',
      phase: 'production',
      title: `Situace: ${coachScenario?.title ?? definition.title}`,
      description: coachScenario?.goal ?? 'Použij obsah kapitoly ve třech navazujících replikách.',
      minutes: coachScenario?.minutes ?? 6,
      xp: 30,
      required: true,
      coachScenarioId: definition.coachScenarioId,
    },
    {
      id: `${prefix}:checkpoint`,
      chapterId: prefix,
      order: 7,
      type: 'checkpoint',
      phase: 'check',
      title: `Ověření: ${definition.title}`,
      description: courseMilestoneForChapter(prefix)
        ? 'Vybav si výrazy, oprav větu a vyřeš závěrečnou situaci. U nového textu rozliš potvrzený, rozporný a chybějící údaj.'
        : 'Napiš výrazy zpaměti, doplň větu a sama oprav chybný úsek. Od třetí kapitoly úrovně se vrací i starší látka.',
      minutes: courseMilestoneForChapter(prefix) || informationGapForChapter(prefix) ? 10 : 8,
      xp: 50,
      required: true,
    },
    {
      id: `${prefix}:reading`,
      chapterId: prefix,
      order: 8,
      type: 'reading',
      phase: 'bonus',
      title: 'Bonusová četba',
      description: 'Přečti si příběh, projdi slovíčka a odpověz na otázky k ději.',
      minutes: 8,
      xp: 0,
      required: false,
      storyBookId: definition.storyBookId,
    },
  ];
}

function contentSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('de-DE')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

const lexicalCorrections: Record<string, Partial<CourseWord>> = {
  Schule: {
    collocations: ['zur Schule gehen', 'in der Schule lernen'],
  },
  Stunde: {
    collocations: ['die erste Stunde', 'eine Stunde dauern'],
  },
  Heft: {
    collocations: ['ins Heft schreiben', 'das Heft aufschlagen'],
  },
  Mitschüler: {
    collocations: ['mit einem Mitschüler sprechen', 'ein neuer Mitschüler'],
  },
  lernen: {
    collocations: ['Deutsch lernen', 'für einen Test lernen'],
  },
  morgens: {
    collocations: ['morgens früh aufstehen', 'morgens zur Schule gehen'],
  },
  aufstehen: {
    collocations: ['früh aufstehen', 'um sieben Uhr aufstehen'],
  },
  Frühstück: {
    collocations: ['Frühstück machen', 'zum Frühstück'],
  },
  brauchen: {
    collocations: ['zehn Minuten brauchen', 'Hilfe brauchen'],
  },
  Fahrkarte: {
    collocations: ['eine Fahrkarte kaufen', 'eine Fahrkarte nach Berlin'],
  },
  umsteigen: {
    collocations: ['in Leipzig umsteigen', 'einmal umsteigen'],
  },
  Abfahrt: {
    collocations: ['Abfahrt um 9:20 Uhr', 'vor der Abfahrt'],
  },
  'hin und zurück': {
    collocations: ['eine Fahrkarte hin und zurück', 'hin und zurück fahren'],
  },
  Verabredung: {
    collocations: ['eine Verabredung haben', 'eine Verabredung absagen'],
  },
  verschieben: {
    collocations: ['einen Termin verschieben', 'auf morgen verschieben'],
  },
  deshalb: {
    collocations: ['deshalb später kommen', 'und deshalb'],
  },
  zusagen: {
    collocations: ['einem Termin zusagen', 'verbindlich zusagen'],
  },
  leider: {
    role: 'review',
    usageNote: 'Běžný A1 výraz se zde znovu používá při změně plánů.',
    collocations: ['leider nicht', 'leider absagen'],
  },
  'aus diesem Grund': {
    collocations: ['aus diesem Grund ablehnen', 'aus diesem Grund verschieben'],
  },
  Vermieter: {
    collocations: ['den Vermieter anrufen', 'mit dem Vermieter sprechen'],
  },
  Heizung: {
    collocations: ['die Heizung ist kaputt', 'die Heizung reparieren'],
  },
  reparieren: {
    collocations: ['die Heizung reparieren', 'fachgerecht reparieren'],
  },
  zuverlässig: {
    collocations: ['zuverlässig arbeiten', 'eine zuverlässige Lösung'],
  },
  Bewerbung: {
    collocations: ['eine Bewerbung schreiben', 'eine Bewerbung einreichen'],
  },
  Aufgabe: {
    collocations: ['eine Aufgabe übernehmen', 'eine Aufgabe erledigen'],
  },
  Erfahrung: {
    collocations: ['Erfahrung sammeln', 'Berufserfahrung haben'],
  },
  übernehmen: {
    collocations: ['Verantwortung übernehmen', 'eine Aufgabe übernehmen'],
  },
  Ergebnis: {
    collocations: ['ein Ergebnis präsentieren', 'zu einem Ergebnis kommen'],
  },
  selbstständig: {
    collocations: ['selbstständig arbeiten', 'eine Aufgabe selbstständig lösen'],
  },
  Vorschlag: {
    collocations: ['einen Vorschlag machen', 'einen Vorschlag prüfen'],
  },
  Auswirkung: {
    collocations: ['Auswirkungen auf etwas haben', 'mögliche Auswirkungen'],
  },
  abwägen: {
    collocations: ['Kosten und Nutzen abwägen', 'Vor- und Nachteile abwägen'],
  },
  obwohl: {
    role: 'review',
    usageNote: 'B1 spojka se zde opakuje v argumentaci B2.',
    collocations: ['obwohl es regnet', 'obwohl die Frist knapp ist'],
  },
  'aus meiner Sicht': {
    collocations: ['aus meiner Sicht sinnvoll', 'aus meiner Sicht überwiegt'],
  },
  Kompromiss: {
    collocations: ['einen Kompromiss finden', 'einen Kompromiss aushandeln'],
  },
  'unter der Voraussetzung': {
    collocations: ['unter der Voraussetzung, dass', 'nur unter der Voraussetzung'],
  },
  Einwand: {
    collocations: ['einen Einwand äußern', 'auf einen Einwand eingehen'],
  },
  'im Vergleich zu': {
    collocations: ['im Vergleich zum Vorjahr', 'im Vergleich zu anderen'],
  },
  'insofern als': {
    collocations: ['insofern relevant, als', 'insofern zutreffend, als'],
  },
  Behauptung: {
    collocations: ['eine Behauptung aufstellen', 'eine Behauptung belegen'],
  },
  Standpunkt: {
    collocations: ['einen Standpunkt vertreten', 'einen Standpunkt begründen'],
  },
  widerlegen: {
    collocations: ['eine Behauptung widerlegen', 'durch Daten widerlegen'],
  },
  Formulierung: {
    collocations: ['eine präzise Formulierung', 'eine Formulierung überarbeiten'],
  },
  präzisieren: {
    collocations: ['eine Aussage präzisieren', 'sprachlich präzisieren'],
  },
  überarbeiten: {
    collocations: ['einen Absatz überarbeiten', 'gründlich überarbeiten'],
  },
  pünktlich: {
    czech: 'včas',
    acceptedCzech: ['dochvilně'],
    role: 'stretch',
    usageNote: 'V této A1.2 kapitole jde o výhledový výraz úrovně A2.',
    collocations: ['pünktlich ankommen', 'pünktlich beginnen'],
  },
  Gleis: {
    czech: 'nástupištní kolej',
    acceptedCzech: ['kolej', 'nástupiště'],
    senseId: 'railway-track-platform-context',
    usageNote:
      'V nádražním hlášení označuje kolej označenou číslem; české „nástupiště“ je přijatelné pouze v tomto situačním překladu.',
    collocations: ['von Gleis drei abfahren', 'an Gleis zwei ankommen'],
  },
  Entscheidung: {
    role: 'review',
    collocations: ['eine Entscheidung treffen', 'zu einer Entscheidung kommen'],
    usageNote: 'B1 lexém se zde opakuje v projektovém kontextu B2.',
  },
  Frist: {
    czech: 'lhůta',
    acceptedCzech: ['termín'],
    senseId: 'deadline-period',
    collocations: ['eine Frist setzen', 'eine Frist verlängern'],
    usageNote: 'Primárně časový úsek určený ke splnění povinnosti.',
  },
  einräumen: {
    czech: 'připustit',
    acceptedCzech: ['uznat'],
    senseId: 'concede-admit',
    collocations: ['einen Fehler einräumen', 'einräumen, dass'],
    usageNote:
      'Zde pouze ve významu „připustit/uznat“. Význam „poskytnout prostor či lhůtu“ je jiný sense.',
  },
  demnach: {
    czech: 'tudíž',
    acceptedCzech: ['z toho vyplývá'],
    senseId: 'inferential-therefore',
    collocations: ['demnach wäre', 'demnach gilt'],
    usageNote: 'Formální závěrový konektor odkazující na předchozí argument.',
  },
  Einordnung: {
    czech: 'zasazení do souvislostí',
    acceptedCzech: ['kontextualizace'],
    senseId: 'contextual-assessment',
    collocations: ['eine sachliche Einordnung', 'historische Einordnung'],
    usageNote: 'Zde jde o interpretační zasazení výroku, nikoli o administrativní zařazení.',
  },
  Voraussetzung: {
    czech: 'předpoklad',
    acceptedCzech: ['podmínka'],
    senseId: 'necessary-precondition',
    collocations: ['eine Voraussetzung erfüllen', 'unter der Voraussetzung'],
    usageNote: 'Nutná podmínka, která musí být splněna před dalším krokem.',
  },
  hinsichtlich: {
    czech: 's ohledem na',
    acceptedCzech: ['ohledně'],
    senseId: 'with-regard-to',
    collocations: ['hinsichtlich der Kosten', 'hinsichtlich des Verfahrens'],
    usageNote: 'Formální předložka, zpravidla s genitivem.',
  },
};

function canonicalizeWord(word: CourseWord): CourseLexeme {
  const corrected = { ...word, ...lexicalCorrections[word.german] };
  const lemma = corrected.german.trim();
  const senseId = corrected.senseId ?? `${contentSlug(lemma)}:default`;
  return {
    ...corrected,
    id: `lexeme:${contentSlug(lemma)}:${contentSlug(senseId)}`,
    lemma,
    displayGerman: corrected.article ? `${corrected.article} ${lemma}` : lemma,
    primaryCzech: corrected.czech.trim(),
    acceptedGerman: [...new Set(corrected.acceptedGerman ?? [])],
    acceptedCzech: [...new Set(corrected.acceptedCzech ?? [])],
    senseId,
    role: corrected.role ?? 'target',
    contexts: corrected.contexts?.length ? corrected.contexts : [corrected.exampleDe ?? lemma],
    collocations: corrected.collocations?.length
      ? corrected.collocations
      : [corrected.article ? `${corrected.article} ${lemma}` : lemma],
    usageNote: corrected.usageNote ?? corrected.learningNote,
  };
}

function addContentSupplement(definition: CourseChapterDefinition): CourseChapterDefinition {
  const supplement = courseChapterContentSupplements[definition.id];
  if (!supplement) return definition;
  return {
    ...definition,
    words: [...definition.words, ...supplement.words],
    grammarLessonIds: [
      ...new Set([
        ...(definition.grammarLessonIds ?? [definition.grammarLessonId]),
        ...supplement.grammarLessonIds,
      ]),
    ],
    coachScenarioIds: [
      ...new Set([
        ...(definition.coachScenarioIds ?? [definition.coachScenarioId]),
        ...supplement.coachScenarioIds,
      ]),
    ],
  };
}

const versionTwoDefinitions = [...chapterDefinitions, ...additionalCourseChapterDefinitions]
  .map(addContentSupplement)
  .map(applyCourseCoherenceOverride);

const versionThreeDefinitions = [
  ...versionTwoDefinitions,
  ...createExpandedCourseChapterDefinitions(versionTwoDefinitions),
];

const definitionById = new Map(
  [
    ...versionThreeDefinitions,
    ...createDiversityCourseChapterDefinitions(versionThreeDefinitions),
  ].map((definition) => [definition.id, definition]),
);

const legacyIds = new Set<string>(LEGACY_COURSE_CHAPTER_IDS);

export const coursePathChapters: CoursePathChapter[] = CORE_COURSE_CHAPTER_IDS.map(
  (chapterId, index) => {
    const source = definitionById.get(chapterId);
    if (!source) throw new Error(`Chybí definice core kapitoly ${chapterId}.`);
    const definition: CourseChapterDefinition = {
      ...source,
      number: index + 1,
      words: [...source.words, ...(courseFoundations[chapterId] ?? [])],
    };
    const nodes = chapterNodes(definition);
    const words = definition.words.map(canonicalizeWord);
    const legacyAnchor = legacyIds.has(definition.id);
    return {
      ...definition,
      words,
      nodes,
      contentVersion: definition.contentVersion ?? (legacyAnchor ? 1 : COURSE_CONTENT_VERSION),
      situation: definition.situation ?? definition.subtitle,
      prerequisites:
        definition.prerequisites ?? (index === 0 ? [] : [CORE_COURSE_CHAPTER_IDS[index - 1]]),
      targetLexemeIds: words
        .filter((word) => word.role === 'target' || word.role === 'stretch')
        .map((word) => word.id),
      reviewLexemeIds: definition.reviewLexemeIds ?? [],
      grammarLessonIds: definition.grammarLessonIds ?? [definition.grammarLessonId],
      coachScenarioIds: definition.coachScenarioIds ?? [definition.coachScenarioId],
      readingIds: definition.readingIds ?? [definition.storyBookId],
      nodeIds: nodes.map((node) => node.id),
      estimatedMinutes:
        definition.estimatedMinutes ??
        nodes.filter((node) => node.required).reduce((sum, node) => sum + node.minutes, 0),
      legacyAnchor,
      legacyNumber: legacyAnchor ? source.number : undefined,
      dialogue:
        definition.dialogue ??
        definition.modelSentences.slice(0, 2).map((sentence, turnIndex) => ({
          speaker: turnIndex === 0 ? 'A' : 'B',
          de: sentence.de,
          cs: sentence.cs,
        })),
      assessment:
        definition.assessment ??
        ({
          id: `${definition.id}:assessment`,
          instruction: definition.sentencePrompt,
          criteria: definition.sentenceChecklist,
          deterministic: true,
        } as const),
    };
  },
);

const chaptersById = new Map(coursePathChapters.map((chapter) => [chapter.id, chapter]));

const nodesById = new Map(
  coursePathChapters.flatMap((chapter) => chapter.nodes.map((node) => [node.id, node] as const)),
);

export function coursePathChapterById(id: string): CoursePathChapter | undefined {
  return chaptersById.get(id);
}

export function coursePathNodeById(id: string): CoursePathNode | undefined {
  return nodesById.get(id);
}

export function chapterForPathNode(nodeId: string): CoursePathChapter | undefined {
  const node = coursePathNodeById(nodeId);
  return node ? coursePathChapterById(node.chapterId) : undefined;
}

export function visibleCoursePathChapters(minimumLevel: DetailedCefrLevel): CoursePathChapter[] {
  const minimumRank = detailedCefrRank(minimumLevel);
  return coursePathChapters.filter((chapter) => detailedCefrRank(chapter.level) >= minimumRank);
}

export function courseSystemTags(chapter: CoursePathChapter): string[] {
  const stableNumber = chapter.legacyNumber ?? chapter.number;
  return [
    'kurz',
    `kurz:${chapter.themeTag}`,
    `kurz:kapitola-${String(stableNumber).padStart(2, '0')}`,
  ];
}
