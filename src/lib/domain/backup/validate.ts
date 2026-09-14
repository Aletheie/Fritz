import {
  COURSE_CONTENT_VERSION,
  grandfatheredChaptersForLegacyProgress,
  normalizeGrandfatheredChapterIds,
} from '../course/content-version.ts';
import { DOUBLE_XP_NEXT_NODE } from '../course/wallet.ts';
import { deriveLegacyLearningEvidence } from '../learning/evidence.ts';
import { assertFsrsDueMatchesCard, parseSerializedFsrsCard } from '../scheduler/fsrs-schema.ts';
import { migrateSettings } from '../settings/defaults.ts';
import { normalizeStoryProgressMap, storyBookIds } from '../stories/progress.ts';
import { MISTAKE_TAGS as MISTAKE_TAG_VALUES } from '../types.ts';
import { normalizeDraft } from '../vocabulary/draft.ts';
import { assertValidVocabularyDraft } from '../vocabulary/validation.ts';

import type {
  EvidenceModality,
  EvidenceOutcome,
  EvidenceSource,
  LearningEvidence,
} from '../learning/types.ts';
import type {
  AnswerSignal,
  AppBackup,
  AppSettings,
  CoachSessionEvent,
  CourseAnswerEvent,
  CourseDoubleXpBoost,
  CoursePathEvent,
  CoursePathNodeProgress,
  CourseProgress,
  CoursePurchaseTransaction,
  CourseVocabularyEvent,
  CourseVocabularyLink,
  Article,
  CardDirection,
  CefrLevel,
  Deck,
  ExerciseKind,
  ExerciseMix,
  GermanAuxiliary,
  LexemeKind,
  Note,
  RatingKey,
  ReviewLog,
  ReviewDisputeReason,
  MistakeTag,
  StudyCard,
  StudyMode,
  VocabularySource,
} from '../types.ts';

const MAX_COLLECTION_ITEMS = 100_000;
const MAX_TEXT_LENGTH = 10_000;
const SUPPORTED_BACKUP_VERSIONS = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const ARTICLES = new Set<Article>(['der', 'die', 'das']);
const LEXEME_KINDS = new Set<LexemeKind>(['noun', 'verb', 'adjective', 'phrase', 'other']);
const DIRECTIONS = new Set<CardDirection>(['cs-de', 'de-cs']);
const EXERCISES = new Set<ExerciseKind>([
  'typing',
  'choice',
  'flashcard',
  'word-order',
  'cloze',
  'sentence',
  'matching',
  'speaking',
]);
const MODES = new Set<StudyMode>(['long-term', 'cram']);
const RATINGS = new Set<RatingKey>(['again', 'hard', 'good', 'easy']);
const CEFR_LEVELS = new Set<CefrLevel>(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const SOURCES = new Set<VocabularySource>(['seed', 'manual', 'import', 'ai', 'course']);
const AUXILIARIES = new Set<GermanAuxiliary>(['haben', 'sein']);
const EVIDENCE_SOURCES = new Set<EvidenceSource>([
  'vocabulary-review',
  'grammar-answer',
  'listening-dictation',
  'transfer',
  'coach-session',
  'path-node',
  'reading',
]);
const EVIDENCE_MODALITIES = new Set<EvidenceModality>([
  'recognition',
  'guided-recall',
  'dictation',
  'free-production',
  'reading',
]);
const EVIDENCE_OUTCOMES = new Set<EvidenceOutcome>([
  'correct',
  'incorrect',
  'completed',
  'skipped',
]);
const MISTAKE_TAGS = new Set<MistakeTag>(MISTAKE_TAG_VALUES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  options: { allowEmpty?: boolean; maxLength?: number } = {},
): string {
  const value = record[key];
  const allowEmpty = options.allowEmpty ?? false;
  const maxLength = options.maxLength ?? MAX_TEXT_LENGTH;
  if (
    typeof value !== 'string' ||
    (!allowEmpty && value.length === 0) ||
    value.length > maxLength
  ) {
    throw new Error(`Záloha má neplatné pole „${key}“.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) {
    throw new Error(`Záloha má neplatné pole „${key}“.`);
  }
  return value;
}

function requireDate(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key, { maxLength: 100 });
  if (Number.isNaN(Date.parse(value))) throw new Error(`Záloha má neplatné datum „${key}“.`);
  return value;
}

function optionalDate(record: Record<string, unknown>, key: string): string | undefined {
  if (record[key] === undefined) return undefined;
  return requireDate(record, key);
}

function requireNumber(
  record: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Záloha má neplatné číselné pole „${key}“.`);
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new Error(`Pole „${key}“ musí být celé číslo.`);
  }
  if (options.min !== undefined && value < options.min) {
    throw new Error(`Pole „${key}“ je mimo povolený rozsah.`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new Error(`Pole „${key}“ je mimo povolený rozsah.`);
  }
  return value;
}

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number | undefined {
  if (record[key] === undefined) return undefined;
  return requireNumber(record, key, options);
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw new Error(`Záloha má neplatné pole „${key}“.`);
  return value;
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  if (record[key] === undefined) return undefined;
  return requireBoolean(record, key);
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Záloha neobsahuje platné pole „${label}“.`);
  if (value.length > MAX_COLLECTION_ITEMS) throw new Error(`Pole „${label}“ je příliš velké.`);
  return value;
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
  maxItems = 200,
): string[] {
  const value = record[key];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`Záloha má neplatné pole „${key}“.`);
  }
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length > MAX_TEXT_LENGTH) {
      throw new Error(`Pole „${key}“ obsahuje neplatnou hodnotu.`);
    }
    result.push(item);
  }
  return result;
}

function assertUniqueIds(items: Array<{ id: string }>, label: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`V poli „${label}“ je duplicitní ID „${item.id}“.`);
    ids.add(item.id);
  }
}

function assertUniqueStrings(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Pole „${label}“ obsahuje duplicitní hodnotu „${value}“.`);
    seen.add(value);
  }
}

function parseExerciseMix(value: unknown, label: string): ExerciseMix {
  if (!isRecord(value)) throw new Error(`${label} má neplatný mix úloh.`);
  const typing = requireNumber(value, 'typing', { min: 0, max: 100, integer: true });
  const choice = requireNumber(value, 'choice', { min: 0, max: 100, integer: true });
  const flashcard = requireNumber(value, 'flashcard', { min: 0, max: 100, integer: true });
  if (typing + choice + flashcard !== 100) {
    throw new Error(`${label} má mix úloh, jehož součet není 100 %.`);
  }
  return { typing, choice, flashcard };
}

function parseDeck(value: unknown): Deck {
  if (!isRecord(value)) throw new Error('Záloha obsahuje neplatný balíček.');
  return {
    id: requireString(value, 'id', { maxLength: 200 }),
    title: requireString(value, 'title', { maxLength: 300 }),
    description: requireString(value, 'description', { allowEmpty: true, maxLength: 2_000 }),
    desiredRetention: requireNumber(value, 'desiredRetention', { min: 0.7, max: 0.99 }),
    dailyNewLimit: requireNumber(value, 'dailyNewLimit', { min: 0, max: 1_000, integer: true }),
    exerciseMix: parseExerciseMix(value.exerciseMix, 'Balíček'),
    createdAt: requireDate(value, 'createdAt'),
    updatedAt: requireDate(value, 'updatedAt'),
  };
}

function parseVerbForms(value: unknown): Note['verbForms'] {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('Sloveso má neplatné tvary.');
  const auxiliaryValue = value.auxiliary;
  const auxiliary = auxiliaryValue === undefined ? undefined : (auxiliaryValue as GermanAuxiliary);
  if (auxiliary !== undefined && !AUXILIARIES.has(auxiliary)) {
    throw new Error('Sloveso má neplatné pomocné sloveso.');
  }
  return {
    thirdPerson: optionalString(value, 'thirdPerson'),
    preterite: optionalString(value, 'preterite'),
    participle: optionalString(value, 'participle'),
    auxiliary,
  };
}

function parseCourseVocabularyLinks(value: unknown): CourseVocabularyLink[] {
  if (value === undefined) return [];
  const links = requireArray(value, 'note.courseLinks');
  if (links.length > 200) throw new Error('Slovíčko obsahuje příliš mnoho kurzových vazeb.');
  const result = links.map((item) => {
    if (!isRecord(item)) throw new Error('Slovíčko obsahuje neplatnou kurzovou vazbu.');
    return {
      chapterId: requireString(item, 'chapterId', { maxLength: 200 }),
      nodeId: requireString(item, 'nodeId', { maxLength: 200 }),
      linkedAt: requireDate(item, 'linkedAt'),
    };
  });
  const keys = new Set<string>();
  for (const link of result) {
    const key = `${link.chapterId}\u001f${link.nodeId}`;
    if (keys.has(key)) throw new Error('Slovíčko obsahuje duplicitní kurzovou vazbu.');
    keys.add(key);
  }
  return result;
}

function parseNote(value: unknown): Note {
  if (!isRecord(value)) throw new Error('Záloha obsahuje neplatné slovíčko.');
  const kind = requireString(value, 'kind', { maxLength: 30 }) as LexemeKind;
  if (!LEXEME_KINDS.has(kind)) throw new Error('Slovíčko má neplatný druh.');

  const articleValue = value.article;
  const article = articleValue === undefined ? undefined : (articleValue as Article);
  if (article !== undefined && !ARTICLES.has(article))
    throw new Error('Slovíčko má neplatný člen.');

  const cefrValue = value.cefr;
  const cefr = cefrValue === undefined ? undefined : (cefrValue as CefrLevel);
  if (cefr !== undefined && !CEFR_LEVELS.has(cefr))
    throw new Error('Slovíčko má neplatnou úroveň CEFR.');

  const sourceValue = value.source;
  const source = sourceValue === undefined ? undefined : (sourceValue as VocabularySource);
  if (source !== undefined && !SOURCES.has(source)) throw new Error('Slovíčko má neplatný zdroj.');

  const draft = normalizeDraft({
    german: requireString(value, 'german'),
    normalizedGerman: '',
    czech: requireString(value, 'czech'),
    kind,
    article,
    plural: optionalString(value, 'plural'),
    acceptedGerman: optionalStringArray(value, 'acceptedGerman'),
    acceptedCzech: optionalStringArray(value, 'acceptedCzech'),
    tags: optionalStringArray(value, 'tags', 100),
    exampleDe: optionalString(value, 'exampleDe'),
    exampleCs: optionalString(value, 'exampleCs'),
    cefr,
    learningNote: optionalString(value, 'learningNote'),
    mnemonic: optionalString(value, 'mnemonic'),
    verbForms: parseVerbForms(value.verbForms),
    source,
    sourceLine: 1,
  });
  assertValidVocabularyDraft(draft);

  const { sourceLine: _sourceLine, ...noteValues } = draft;
  return {
    ...noteValues,
    systemTags: optionalStringArray(value, 'systemTags', 100),
    courseLinks: parseCourseVocabularyLinks(value.courseLinks),
    id: requireString(value, 'id', { maxLength: 200 }),
    deckId: requireString(value, 'deckId', { maxLength: 200 }),
    createdAt: requireDate(value, 'createdAt'),
    updatedAt: requireDate(value, 'updatedAt'),
  };
}

function parseCard(value: unknown): StudyCard {
  if (!isRecord(value)) throw new Error('Záloha obsahuje neplatnou studijní kartu.');
  const direction = requireString(value, 'direction', { maxLength: 20 }) as CardDirection;
  if (!DIRECTIONS.has(direction)) throw new Error('Karta má neplatný směr.');
  const dueAt = requireDate(value, 'dueAt');
  const fsrs = value.fsrs === undefined ? undefined : parseSerializedFsrsCard(value.fsrs);
  if (fsrs) assertFsrsDueMatchesCard(fsrs, dueAt);

  return {
    id: requireString(value, 'id', { maxLength: 200 }),
    deckId: requireString(value, 'deckId', { maxLength: 200 }),
    noteId: requireString(value, 'noteId', { maxLength: 200 }),
    direction,
    dueAt,
    fsrs,
    createdAt: requireDate(value, 'createdAt'),
    updatedAt: requireDate(value, 'updatedAt'),
  };
}

function parseSignal(value: unknown): AnswerSignal {
  if (!isRecord(value)) throw new Error('Záznam opakování má neplatné signály.');
  const exercise = requireString(value, 'exercise', { maxLength: 30 }) as ExerciseKind;
  if (!EXERCISES.has(exercise)) throw new Error('Signál má neplatný typ úlohy.');

  const selectedArticleValue = value.selectedArticle;
  const selectedArticle =
    selectedArticleValue === undefined ? undefined : (selectedArticleValue as Article);
  if (selectedArticle !== undefined && !ARTICLES.has(selectedArticle)) {
    throw new Error('Signál má neplatný člen.');
  }

  return {
    exercise,
    submittedText: optionalString(value, 'submittedText'),
    normalizedText: optionalString(value, 'normalizedText'),
    selectedArticle,
    selectedChoice: optionalString(value, 'selectedChoice'),
    expectedText: optionalString(value, 'expectedText'),
    wordCorrect: requireBoolean(value, 'wordCorrect'),
    articleCorrect: requireBoolean(value, 'articleCorrect'),
    exact: requireBoolean(value, 'exact'),
    keyboardEquivalent: requireBoolean(value, 'keyboardEquivalent'),
    editDistance: requireNumber(value, 'editDistance', { min: 0, max: 100_000, integer: true }),
    responseMs: requireNumber(value, 'responseMs', { min: 0, max: 86_400_000 }),
    hintsUsed: requireNumber(value, 'hintsUsed', { min: 0, max: 1_000, integer: true }),
    attempt: requireNumber(value, 'attempt', { min: 1, max: 1_000, integer: true }),
    aiAccepted: optionalBoolean(value, 'aiAccepted'),
    aiScore: optionalNumber(value, 'aiScore', { min: 0, max: 100, integer: true }),
  };
}

function parseReview(value: unknown): ReviewLog {
  if (!isRecord(value)) throw new Error('Záloha obsahuje neplatný záznam opakování.');
  const mode = requireString(value, 'mode', { maxLength: 30 }) as StudyMode;
  const exercise = requireString(value, 'exercise', { maxLength: 30 }) as ExerciseKind;
  const rating = requireString(value, 'rating', { maxLength: 30 }) as RatingKey;
  if (!MODES.has(mode) || !EXERCISES.has(exercise) || !RATINGS.has(rating)) {
    throw new Error('Záznam opakování má neplatný režim, typ úlohy nebo rating.');
  }
  const signal = parseSignal(value.signal);
  if (signal.exercise !== exercise) {
    throw new Error('Typ úlohy v review neodpovídá uloženému signálu.');
  }
  const scheduleBefore =
    value.scheduleBefore === undefined ? undefined : parseSerializedFsrsCard(value.scheduleBefore);
  const scheduleAfter =
    value.scheduleAfter === undefined ? undefined : parseSerializedFsrsCard(value.scheduleAfter);
  const localDay = optionalString(value, 'localDay');
  if (localDay !== undefined && !/^\d{4}-\d{2}-\d{2}$/u.test(localDay)) {
    throw new Error('Záznam opakování má neplatný lokální den.');
  }
  const mistakeTagValues = optionalStringArray(value, 'mistakeTags', 20);
  if (mistakeTagValues.some((tag) => !MISTAKE_TAGS.has(tag as MistakeTag))) {
    throw new Error('Záznam opakování má neplatnou kategorii chyby.');
  }
  const disputeReasonValue = optionalString(value, 'disputeReason');
  const allowedDisputeReasons = new Set<ReviewDisputeReason>([
    'ai-too-strict',
    'content-error',
    'other',
  ]);
  if (
    disputeReasonValue !== undefined &&
    !allowedDisputeReasons.has(disputeReasonValue as ReviewDisputeReason)
  ) {
    throw new Error('Záznam opakování má neplatný důvod reklamace.');
  }

  return {
    id: requireString(value, 'id', { maxLength: 200 }),
    operationId: optionalString(value, 'operationId'),
    cardId: requireString(value, 'cardId', { maxLength: 200 }),
    noteId: requireString(value, 'noteId', { maxLength: 200 }),
    deckId: requireString(value, 'deckId', { maxLength: 200 }),
    reviewedAt: requireDate(value, 'reviewedAt'),
    localDay,
    mode,
    exercise,
    rating,
    signal,
    mistakeTags: [...new Set(mistakeTagValues)] as MistakeTag[],
    xpAwarded: optionalNumber(value, 'xpAwarded', { min: 0, max: 100, integer: true }),
    missionBonusAwarded: optionalNumber(value, 'missionBonusAwarded', {
      min: 0,
      max: 60,
      integer: true,
    }),
    dueAtBefore: optionalDate(value, 'dueAtBefore'),
    scheduleBefore,
    scheduleAfter,
    excludedFromLearning: optionalBoolean(value, 'excludedFromLearning'),
    disputedAt: optionalDate(value, 'disputedAt'),
    disputeReason: disputeReasonValue as ReviewDisputeReason | undefined,
  };
}

function parseLearningEvidence(value: unknown): LearningEvidence {
  if (!isRecord(value)) throw new Error('Záloha obsahuje neplatný důkaz učení.');
  const source = requireString(value, 'source', { maxLength: 40 }) as EvidenceSource;
  const mode = requireString(value, 'mode', { maxLength: 30 }) as StudyMode;
  const modality = requireString(value, 'modality', { maxLength: 40 }) as EvidenceModality;
  const outcome = requireString(value, 'outcome', { maxLength: 30 }) as EvidenceOutcome;
  if (!EVIDENCE_SOURCES.has(source) || !MODES.has(mode)) {
    throw new Error('Důkaz učení má neplatný zdroj nebo režim.');
  }
  if (!EVIDENCE_MODALITIES.has(modality) || !EVIDENCE_OUTCOMES.has(outcome)) {
    throw new Error('Důkaz učení má neplatnou modalitu nebo výsledek.');
  }
  const skillIds = optionalStringArray(value, 'skillIds', 100);
  if (
    skillIds.length === 0 ||
    skillIds.some((skillId) => skillId.length === 0 || skillId.length > 300)
  ) {
    throw new Error('Důkaz učení nemá platné dovednosti.');
  }
  assertUniqueStrings(skillIds, 'learningEvidence.skillIds');
  const localDay = requireString(value, 'localDay', { maxLength: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(localDay)) {
    throw new Error('Důkaz učení má neplatný lokální den.');
  }
  const mistakeTags = optionalStringArray(value, 'mistakeTags', 20);
  if (mistakeTags.some((tag) => !MISTAKE_TAGS.has(tag as MistakeTag))) {
    throw new Error('Důkaz učení má neplatnou kategorii chyby.');
  }
  return {
    id: requireString(value, 'id', { maxLength: 300 }),
    operationId: optionalString(value, 'operationId'),
    activityId: optionalString(value, 'activityId'),
    source,
    sourceId: requireString(value, 'sourceId', { maxLength: 300 }),
    skillIds,
    occurredAt: requireDate(value, 'occurredAt'),
    localDay,
    mode,
    modality,
    outcome,
    hintsUsed: requireNumber(value, 'hintsUsed', { min: 0, max: 1_000, integer: true }),
    responseMs: requireNumber(value, 'responseMs', { min: 0, max: 86_400_000, integer: true }),
    independent: requireBoolean(value, 'independent'),
    mistakeTags: mistakeTags.length ? (mistakeTags as MistakeTag[]) : undefined,
    repairOfEvidenceId: optionalString(value, 'repairOfEvidenceId'),
    excludedFromLearning: optionalBoolean(value, 'excludedFromLearning'),
  };
}

function parseCourseEvent(value: unknown): CourseAnswerEvent {
  if (!isRecord(value)) throw new Error('Záloha obsahuje neplatnou odpověď z kurzu.');
  return {
    id: requireString(value, 'id', { maxLength: 200 }),
    lessonId: requireString(value, 'lessonId', { maxLength: 200 }),
    questionId: requireString(value, 'questionId', { maxLength: 200 }),
    answeredAt: requireDate(value, 'answeredAt'),
    correct: requireBoolean(value, 'correct'),
    firstTry: requireBoolean(value, 'firstTry'),
    xpAwarded: requireNumber(value, 'xpAwarded', { min: 0, max: 100, integer: true }),
    responseMs: requireNumber(value, 'responseMs', {
      min: 0,
      max: 3_600_000,
      integer: true,
    }),
  };
}

function parseCoachSessionEvent(value: unknown): CoachSessionEvent {
  if (!isRecord(value)) throw new Error('Záloha obsahuje neplatnou AI konverzaci.');
  const turns = requireNumber(value, 'turns', { min: 1, max: 20, integer: true });
  const independentTurns = optionalNumber(value, 'independentTurns', {
    min: 0,
    max: turns,
    integer: true,
  });
  const mistakeTags = optionalStringArray(value, 'mistakeTags', 3);
  if (mistakeTags.some((tag) => !MISTAKE_TAGS.has(tag as MistakeTag))) {
    throw new Error('AI konverzace má neplatnou kategorii chyby.');
  }
  return {
    id: requireString(value, 'id', { maxLength: 200 }),
    scenarioId: requireString(value, 'scenarioId', { maxLength: 200 }),
    completedAt: requireDate(value, 'completedAt'),
    score: requireNumber(value, 'score', { min: 0, max: 100, integer: true }),
    turns,
    independentTurns,
    mistakeTags: mistakeTags.length ? (mistakeTags as MistakeTag[]) : undefined,
    xpAwarded: requireNumber(value, 'xpAwarded', { min: 0, max: 100, integer: true }),
  };
}

function parsePathNodeProgress(value: unknown, key: string): CoursePathNodeProgress {
  if (!isRecord(value)) throw new Error('Postup cesty obsahuje neplatný uzel.');
  const nodeId = requireString(value, 'nodeId', { maxLength: 200 });
  if (nodeId !== key) throw new Error('Postup cesty obsahuje uzel pod chybným klíčem.');
  const completedAt = optionalDate(value, 'completedAt');
  const startedAt = optionalDate(value, 'startedAt');
  const attempts = requireNumber(value, 'attempts', { min: 0, max: 100_000, integer: true });
  const bestStars = requireNumber(value, 'bestStars', { min: 0, max: 3, integer: true }) as
    | 0
    | 1
    | 2
    | 3;
  const xpAwarded = requireNumber(value, 'xpAwarded', {
    min: 0,
    max: 100_000,
    integer: true,
  });
  if (completedAt && !startedAt) {
    throw new Error('Dokončenému uzlu cesty chybí začátek.');
  }
  if (completedAt && (attempts < 1 || bestStars < 1)) {
    throw new Error('Dokončený uzel cesty nemá platný pokus a hodnocení.');
  }
  if (!completedAt && (attempts > 0 || bestStars > 0 || xpAwarded > 0)) {
    throw new Error('Nedokončený uzel cesty obsahuje výsledek dokončení.');
  }
  return {
    nodeId,
    startedAt,
    completedAt,
    attempts,
    bestStars,
    xpAwarded,
    updatedAt: requireDate(value, 'updatedAt'),
  };
}

function parsePathNodes(value: unknown): CourseProgress['pathNodes'] {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error('Postup cesty má neplatný formát.');
  const entries = Object.entries(value);
  if (entries.length > 2_000) throw new Error('Postup cesty obsahuje příliš mnoho uzlů.');
  return Object.fromEntries(entries.map(([key, item]) => [key, parsePathNodeProgress(item, key)]));
}

function parsePathEvent(value: unknown): CoursePathEvent {
  if (!isRecord(value)) throw new Error('Postup cesty obsahuje neplatnou událost.');
  const baseXp = requireNumber(value, 'baseXp', { min: 0, max: 100_000, integer: true });
  const bonusXp = requireNumber(value, 'bonusXp', { min: 0, max: 100_000, integer: true });
  const xpAwarded = requireNumber(value, 'xpAwarded', { min: 0, max: 200_000, integer: true });
  if (xpAwarded !== baseXp + bonusXp) {
    throw new Error('Událost cesty má nekonzistentní XP.');
  }
  const boosted = requireBoolean(value, 'boosted');
  if (bonusXp > 0 !== boosted || (boosted && bonusXp !== baseXp)) {
    throw new Error('Událost cesty má nekonzistentní stav double XP.');
  }
  return {
    id: requireString(value, 'id', { maxLength: 240 }),
    nodeId: requireString(value, 'nodeId', { maxLength: 200 }),
    chapterId: requireString(value, 'chapterId', { maxLength: 200 }),
    completedAt: requireDate(value, 'completedAt'),
    stars: requireNumber(value, 'stars', { min: 1, max: 3, integer: true }) as 1 | 2 | 3,
    baseXp,
    bonusXp,
    xpAwarded,
    boosted,
  };
}

function parseVocabularyEvent(value: unknown): CourseVocabularyEvent {
  if (!isRecord(value)) throw new Error('Postup cesty obsahuje neplatný import slov.');
  if (value.foundationRevision !== undefined && value.foundationRevision !== 1)
    throw new Error('Import slov má neplatnou verzi základů.');
  const addedNoteIds = optionalStringArray(value, 'addedNoteIds', 500);
  const linkedNoteIds = optionalStringArray(value, 'linkedNoteIds', 500);
  const systemTags = optionalStringArray(value, 'systemTags', 100);
  assertUniqueStrings(addedNoteIds, 'course.vocabularyEvents.addedNoteIds');
  assertUniqueStrings(linkedNoteIds, 'course.vocabularyEvents.linkedNoteIds');
  assertUniqueStrings(systemTags, 'course.vocabularyEvents.systemTags');
  const linkedSet = new Set(linkedNoteIds);
  if (addedNoteIds.some((noteId) => linkedSet.has(noteId))) {
    throw new Error('Import kurzových slov označuje stejné slovíčko jako nové i existující.');
  }
  if (!systemTags.includes('kurz')) {
    throw new Error('Import kurzových slov nemá systémový tag původu.');
  }
  return {
    id: requireString(value, 'id', { maxLength: 240 }),
    ...(value.foundationRevision === 1 ? { foundationRevision: 1 as const } : {}),
    nodeId: requireString(value, 'nodeId', { maxLength: 200 }),
    chapterId: requireString(value, 'chapterId', { maxLength: 200 }),
    completedAt: requireDate(value, 'completedAt'),
    addedNoteIds,
    linkedNoteIds,
    systemTags,
  };
}

function parsePurchase(value: unknown): CoursePurchaseTransaction {
  if (!isRecord(value)) throw new Error('Peněženka obsahuje neplatný nákup.');
  if (value.itemId !== 'double-xp-next-node') {
    throw new Error('Peněženka obsahuje neznámou odměnu.');
  }
  const price = requireNumber(value, 'price', { min: 0, max: 100_000, integer: true });
  if (price !== DOUBLE_XP_NEXT_NODE.price) {
    throw new Error('Nákup double XP má neplatnou cenu.');
  }
  return {
    id: requireString(value, 'id', { maxLength: 200 }),
    itemId: 'double-xp-next-node',
    price,
    purchasedAt: requireDate(value, 'purchasedAt'),
    boostId: requireString(value, 'boostId', { maxLength: 200 }),
  };
}

function parseBoost(value: unknown): CourseDoubleXpBoost {
  if (!isRecord(value)) throw new Error('Peněženka obsahuje neplatný bonus.');
  if (value.itemId !== 'double-xp-next-node') {
    throw new Error('Peněženka obsahuje neznámý bonus.');
  }
  if (value.status !== 'active' && value.status !== 'consumed') {
    throw new Error('Peněženka obsahuje bonus s neplatným stavem.');
  }
  const result: CourseDoubleXpBoost = {
    id: requireString(value, 'id', { maxLength: 200 }),
    itemId: 'double-xp-next-node',
    purchasedAt: requireDate(value, 'purchasedAt'),
    status: value.status,
    consumedAt: optionalDate(value, 'consumedAt'),
    consumedByNodeId: optionalString(value, 'consumedByNodeId'),
  };
  if (result.status === 'consumed' && (!result.consumedAt || !result.consumedByNodeId)) {
    throw new Error('Spotřebovanému double XP chybí záznam o použití.');
  }
  if (result.status === 'active' && (result.consumedAt || result.consumedByNodeId)) {
    throw new Error('Aktivní double XP nesmí být označené jako použité.');
  }
  return result;
}

function parseWallet(value: unknown): CourseProgress['wallet'] {
  if (value === undefined) return { purchases: [], boosts: [] };
  if (!isRecord(value)) throw new Error('Peněženka má neplatný formát.');
  const purchases = requireArray(value.purchases, 'course.wallet.purchases').map(parsePurchase);
  const boosts = requireArray(value.boosts, 'course.wallet.boosts').map(parseBoost);
  assertUniqueIds(purchases, 'course.wallet.purchases');
  assertUniqueIds(boosts, 'course.wallet.boosts');
  if (boosts.filter((boost) => boost.status === 'active').length > 1) {
    throw new Error('Peněženka obsahuje více aktivních double XP bonusů.');
  }
  const boostById = new Map(boosts.map((boost) => [boost.id, boost]));
  const purchasedBoostIds = new Set<string>();
  for (const purchase of purchases) {
    const boost = boostById.get(purchase.boostId);
    if (!boost) throw new Error('Nákup odkazuje na neexistující bonus.');
    if (purchasedBoostIds.has(purchase.boostId)) {
      throw new Error('Peněženka obsahuje více nákupů stejného bonusu.');
    }
    if (boost.purchasedAt !== purchase.purchasedAt || boost.itemId !== purchase.itemId) {
      throw new Error('Nákup neodpovídá uloženému bonusu.');
    }
    purchasedBoostIds.add(purchase.boostId);
  }
  if (purchasedBoostIds.size !== boosts.length) {
    throw new Error('Peněženka obsahuje bonus bez nákupní transakce.');
  }
  return { purchases, boosts };
}

function parseUnlockedStoryBooks(
  value: unknown,
  legacy: boolean,
): CourseProgress['unlockedStoryBooks'] {
  if (legacy) return [...storyBookIds];
  if (!Array.isArray(value)) throw new Error('Odemčené knihy mají neplatný formát.');
  const result = value.map((item) => {
    if (typeof item !== 'string' || !storyBookIds.includes(item as (typeof storyBookIds)[number])) {
      throw new Error('Odemčené knihy obsahují neznámou knihu.');
    }
    return item as (typeof storyBookIds)[number];
  });
  if (new Set(result).size !== result.length) {
    throw new Error('Odemčené knihy obsahují duplicitu.');
  }
  return result;
}

function parseLessonBestStars(value: unknown): CourseProgress['lessonBestStars'] {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error('Postup kurzem obsahuje neplatné hodnocení lekcí.');
  const entries = Object.entries(value);
  if (entries.length > 500) throw new Error('Postup kurzem obsahuje příliš mnoho hodnocení lekcí.');

  const result: CourseProgress['lessonBestStars'] = {};
  for (const [lessonId, rawStars] of entries) {
    if (lessonId.length === 0 || lessonId.length > 200) {
      throw new Error('Postup kurzem obsahuje neplatné ID lekce.');
    }
    if (
      typeof rawStars !== 'number' ||
      !Number.isInteger(rawStars) ||
      rawStars < 0 ||
      rawStars > 3
    ) {
      throw new Error('Postup kurzem obsahuje neplatný počet hvězd.');
    }
    result[lessonId] = rawStars as 0 | 1 | 2 | 3;
  }
  return result;
}

function parseCourse(value: unknown, fallbackDate: string): CourseProgress {
  if (value === undefined) {
    return {
      key: 'course',
      schemaVersion: 6,
      contentVersion: COURSE_CONTENT_VERSION,
      grandfatheredChapterIds: [],
      events: [],
      coachEvents: [],
      lessonBestStars: {},
      claimedRewards: [],
      storyBooks: {},
      pathNodes: {},
      pathEvents: [],
      vocabularyEvents: [],
      unlockedStoryBooks: [],
      wallet: { purchases: [], boosts: [] },
      appliedOperations: [],
      createdAt: fallbackDate,
      updatedAt: fallbackDate,
    };
  }
  if (!isRecord(value) || value.key !== 'course') {
    throw new Error('Záloha má neplatný postup kurzem.');
  }
  const version = value.schemaVersion;
  if (
    version !== 1 &&
    version !== 2 &&
    version !== 3 &&
    version !== 4 &&
    version !== 5 &&
    version !== 6
  ) {
    throw new Error('Záloha používá nepodporovanou verzi postupu kurzem.');
  }
  const events = requireArray(value.events, 'course.events').map(parseCourseEvent);
  assertUniqueIds(events, 'course.events');
  const coachEvents =
    version >= 2
      ? requireArray(value.coachEvents, 'course.coachEvents').map(parseCoachSessionEvent)
      : [];
  assertUniqueIds(coachEvents, 'course.coachEvents');
  const lessonBestStars = version >= 3 ? parseLessonBestStars(value.lessonBestStars) : {};
  const claimedRewards = optionalStringArray(value, 'claimedRewards', 100);
  if (new Set(claimedRewards).size !== claimedRewards.length) {
    throw new Error('Postup kurzem obsahuje duplicitní odměnu.');
  }
  if (version >= 4 && value.storyBooks !== undefined) {
    if (!isRecord(value.storyBooks)) {
      throw new Error('Postup četbou má neplatný formát.');
    }
    for (const key of Object.keys(value.storyBooks)) {
      if (!storyBookIds.includes(key as (typeof storyBookIds)[number])) {
        throw new Error('Postup četbou odkazuje na neznámou knihu.');
      }
    }
  }
  const pathNodes = version >= 5 ? parsePathNodes(value.pathNodes) : {};
  const rawContentVersion = value.contentVersion;
  if (
    rawContentVersion !== undefined &&
    (typeof rawContentVersion !== 'number' ||
      !Number.isInteger(rawContentVersion) ||
      rawContentVersion < 1 ||
      rawContentVersion > COURSE_CONTENT_VERSION)
  ) {
    throw new Error('Záloha používá nepodporovanou verzi obsahu kurzu.');
  }
  const contentVersion = typeof rawContentVersion === 'number' ? rawContentVersion : 1;
  const preservedGrandfathering = normalizeGrandfatheredChapterIds(value.grandfatheredChapterIds);
  const migratedGrandfathering =
    contentVersion < COURSE_CONTENT_VERSION
      ? grandfatheredChaptersForLegacyProgress(pathNodes)
      : [];
  const pathEvents =
    version >= 5 ? requireArray(value.pathEvents, 'course.pathEvents').map(parsePathEvent) : [];
  assertUniqueIds(pathEvents, 'course.pathEvents');
  if (new Set(pathEvents.map((event) => event.nodeId)).size !== pathEvents.length) {
    throw new Error('Postup cesty obsahuje více prvních dokončení stejného uzlu.');
  }
  const vocabularyEvents =
    version >= 5
      ? requireArray(value.vocabularyEvents, 'course.vocabularyEvents').map(parseVocabularyEvent)
      : [];
  assertUniqueIds(vocabularyEvents, 'course.vocabularyEvents');
  if (new Set(vocabularyEvents.map((event) => event.nodeId)).size !== vocabularyEvents.length) {
    throw new Error('Postup cesty obsahuje více importů slov ze stejného uzlu.');
  }
  return {
    key: 'course',
    schemaVersion: 6,
    contentVersion: COURSE_CONTENT_VERSION,
    grandfatheredChapterIds: [...new Set([...preservedGrandfathering, ...migratedGrandfathering])],
    events,
    coachEvents,
    lessonBestStars,
    claimedRewards,
    storyBooks: version >= 4 ? normalizeStoryProgressMap(value.storyBooks) : {},
    pathNodes,
    pathEvents,
    vocabularyEvents,
    unlockedStoryBooks: parseUnlockedStoryBooks(value.unlockedStoryBooks, version < 5),
    wallet: version >= 5 ? parseWallet(value.wallet) : { purchases: [], boosts: [] },
    appliedOperations: optionalStringArray(value, 'appliedOperations', 2_000),
    createdAt: requireDate(value, 'createdAt'),
    updatedAt: requireDate(value, 'updatedAt'),
  };
}

function parseSettings(value: unknown): AppSettings {
  if (!isRecord(value) || value.key !== 'app') throw new Error('Záloha má neplatné nastavení.');

  const settingsVersion = value.schemaVersion;
  if (
    typeof settingsVersion !== 'number' ||
    !Number.isInteger(settingsVersion) ||
    settingsVersion < 1 ||
    settingsVersion > 9
  ) {
    throw new Error('Záloha používá nepodporovanou verzi nastavení.');
  }

  const record: Record<string, unknown> = {
    key: 'app',
    schemaVersion: settingsVersion,
    motherTongue: optionalString(value, 'motherTongue'),
    profileName: requireString(value, 'profileName', { allowEmpty: true, maxLength: 200 }),
    grammarLevel: optionalString(value, 'grammarLevel'),
    onboardingCompleted: optionalBoolean(value, 'onboardingCompleted'),
    learningGoal: optionalString(value, 'learningGoal'),
    dailyMinutes: optionalNumber(value, 'dailyMinutes', { min: 5, max: 20, integer: true }),
    examPlan: value.examPlan,
    favoriteCoachScenarioIds: optionalStringArray(value, 'favoriteCoachScenarioIds', 250),
    favoriteStoryBookIds: optionalStringArray(value, 'favoriteStoryBookIds', 250),
    accentTheme: optionalString(value, 'accentTheme'),
    desiredRetention: requireNumber(value, 'desiredRetention', { min: 0.7, max: 0.99 }),
    dailyNewLimit: requireNumber(value, 'dailyNewLimit', { min: 0, max: 1_000, integer: true }),
    dailyGoal: optionalNumber(value, 'dailyGoal', { min: 1, max: 500, integer: true }),
    exerciseMix: parseExerciseMix(value.exerciseMix, 'Nastavení'),
    allowKeyboardFallback: requireBoolean(value, 'allowKeyboardFallback'),
    autoSpeakGerman: optionalBoolean(value, 'autoSpeakGerman'),
    celebrations: optionalBoolean(value, 'celebrations'),
    gamificationEnabled: optionalBoolean(value, 'gamificationEnabled'),
    rivalryEnabled: optionalBoolean(value, 'rivalryEnabled'),
    requireCorrection: optionalBoolean(value, 'requireCorrection'),
    showKeyboardHints: optionalBoolean(value, 'showKeyboardHints'),
    showStudyTips: optionalBoolean(value, 'showStudyTips'),
    reduceMotion: optionalBoolean(value, 'reduceMotion'),
    trainingSourceFilter: optionalString(value, 'trainingSourceFilter'),
    exercisePreferences: value.exercisePreferences,
    studyPace: optionalString(value, 'studyPace'),
    createdAt: requireDate(value, 'createdAt'),
    updatedAt: requireDate(value, 'updatedAt'),
  };

  // Undefined optional properties must stay absent so migrateSettings can apply its defaults.
  for (const key of Object.keys(record)) {
    if (record[key] === undefined) delete record[key];
  }
  return migrateSettings(record);
}

export function parseBackup(value: unknown): AppBackup {
  if (!isRecord(value)) throw new Error('Soubor není platná záloha aplikace Fritz.');
  if (
    typeof value.schemaVersion !== 'number' ||
    !SUPPORTED_BACKUP_VERSIONS.has(value.schemaVersion)
  ) {
    throw new Error(`Nepodporovaná verze zálohy: ${String(value.schemaVersion ?? 'chybí')}.`);
  }

  const decks = requireArray(value.decks, 'decks').map(parseDeck);
  const notes = requireArray(value.notes, 'notes').map(parseNote);
  const cards = requireArray(value.cards, 'cards').map(parseCard);
  const reviews = requireArray(value.reviews, 'reviews').map(parseReview);
  const settings = parseSettings(value.settings);
  const exportedAt = requireDate(value, 'exportedAt');
  const course = parseCourse(value.course, settings.createdAt);
  if (value.schemaVersion >= 7 && value.learningEvidence === undefined) {
    throw new Error('Záloha verze ' + String(value.schemaVersion) + ' neobsahuje důkazy učení.');
  }
  const learningEvidence =
    value.learningEvidence === undefined
      ? deriveLegacyLearningEvidence({ reviews, cards, course })
      : requireArray(value.learningEvidence, 'learningEvidence').map(parseLearningEvidence);

  if (decks.length === 0) throw new Error('Záloha neobsahuje žádný balíček.');
  assertUniqueIds(decks, 'decks');
  assertUniqueIds(notes, 'notes');
  assertUniqueIds(cards, 'cards');
  assertUniqueIds(reviews, 'reviews');
  assertUniqueIds(learningEvidence, 'learningEvidence');
  assertUniqueStrings(
    reviews.flatMap((review) => (review.operationId ? [review.operationId] : [])),
    'reviews.operationId',
  );

  const noteKeys = new Set<string>();
  for (const note of notes) {
    const key = `${note.deckId}\u001f${note.normalizedGerman}`;
    if (noteKeys.has(key)) {
      throw new Error(`Záloha obsahuje duplicitní slovíčko „${note.german}“.`);
    }
    noteKeys.add(key);
  }

  const canonicalDecks = decks.map((deck, index) =>
    index === 0
      ? {
          ...deck,
          desiredRetention: settings.desiredRetention,
          dailyNewLimit: settings.dailyNewLimit,
          exerciseMix: settings.exerciseMix,
          updatedAt:
            deck.desiredRetention === settings.desiredRetention &&
            deck.dailyNewLimit === settings.dailyNewLimit &&
            JSON.stringify(deck.exerciseMix) === JSON.stringify(settings.exerciseMix)
              ? deck.updatedAt
              : settings.updatedAt,
        }
      : deck,
  );

  const deckById = new Map(canonicalDecks.map((deck) => [deck.id, deck]));
  const noteById = new Map(notes.map((note) => [note.id, note]));
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const cardKeys = new Set<string>();
  const notesWithCards = new Set<string>();

  for (const note of notes) {
    if (!deckById.has(note.deckId)) {
      throw new Error(`Slovíčko „${note.id}“ odkazuje na neznámý balíček.`);
    }
  }
  for (const card of cards) {
    const note = noteById.get(card.noteId);
    if (!deckById.has(card.deckId) || !note || note.deckId !== card.deckId) {
      throw new Error(`Karta „${card.id}“ má neplatnou vazbu.`);
    }
    const key = `${card.noteId}\u001f${card.direction}`;
    if (cardKeys.has(key)) {
      throw new Error(
        `Slovíčko „${card.noteId}“ má duplicitní kartu ve směru „${card.direction}“.`,
      );
    }
    cardKeys.add(key);
    notesWithCards.add(card.noteId);
  }
  for (const note of notes) {
    if (!notesWithCards.has(note.id)) {
      throw new Error(`Slovíčko „${note.id}“ nemá žádnou studijní kartu.`);
    }
  }
  for (const review of reviews) {
    const card = cardById.get(review.cardId);
    const note = noteById.get(review.noteId);
    if (
      !card ||
      !note ||
      card.noteId !== review.noteId ||
      card.deckId !== review.deckId ||
      note.deckId !== review.deckId
    ) {
      throw new Error(`Review „${review.id}“ má neplatnou vazbu.`);
    }
  }

  for (const note of notes) {
    if (note.source === 'course') {
      if (!(note.systemTags ?? []).includes('kurz') || (note.courseLinks ?? []).length === 0) {
        throw new Error(`Kurzové slovíčko „${note.id}“ nemá úplná metadata původu.`);
      }
    }
  }
  for (const event of course.vocabularyEvents) {
    const pathNode = course.pathNodes[event.nodeId];
    if (!pathNode?.completedAt || pathNode.completedAt !== event.completedAt) {
      throw new Error(`Import slov z uzlu „${event.nodeId}“ neodpovídá uloženému progresu.`);
    }
    const addedIds = new Set(event.addedNoteIds);
    for (const noteId of [...event.addedNoteIds, ...event.linkedNoteIds]) {
      const note = noteById.get(noteId);
      if (!note) throw new Error(`Import kurzových slov odkazuje na neznámé slovíčko „${noteId}“.`);
      if (addedIds.has(noteId) && note.source !== 'course') {
        throw new Error(`Nově přidané kurzové slovíčko „${noteId}“ nemá kurzový původ.`);
      }
      if (
        !(note.courseLinks ?? []).some(
          (link) => link.nodeId === event.nodeId && link.chapterId === event.chapterId,
        )
      ) {
        throw new Error(`Slovíčku „${noteId}“ chybí vazba na kurzový uzel.`);
      }
      if (event.systemTags.some((tag) => !(note.systemTags ?? []).includes(tag))) {
        throw new Error(`Slovíčku „${noteId}“ chybí systémový kurzový tag.`);
      }
    }
  }
  const pathEventByNodeId = new Map(course.pathEvents.map((event) => [event.nodeId, event]));
  for (const event of course.pathEvents) {
    const node = course.pathNodes[event.nodeId];
    if (
      !node?.completedAt ||
      node.completedAt !== event.completedAt ||
      node.xpAwarded !== event.xpAwarded ||
      node.bestStars < event.stars
    ) {
      throw new Error(`Událost uzlu „${event.nodeId}“ neodpovídá uloženému progresu.`);
    }
  }
  for (const [nodeId, node] of Object.entries(course.pathNodes)) {
    if (node.completedAt && !pathEventByNodeId.has(nodeId)) {
      throw new Error(`Dokončenému uzlu „${nodeId}“ chybí první kreditovaná událost.`);
    }
  }

  const consumedBoostsByNodeId = new Map<string, CourseDoubleXpBoost>();
  for (const boost of course.wallet.boosts) {
    if (boost.status !== 'consumed') continue;
    const nodeId = boost.consumedByNodeId as string;
    if (consumedBoostsByNodeId.has(nodeId)) {
      throw new Error(`Uzel „${nodeId}“ spotřeboval více double XP bonusů.`);
    }
    const event = pathEventByNodeId.get(nodeId);
    if (!event?.boosted || event.completedAt !== boost.consumedAt) {
      throw new Error(`Spotřebovaný double XP bonus neodpovídá události uzlu „${nodeId}“.`);
    }
    consumedBoostsByNodeId.set(nodeId, boost);
  }
  for (const event of course.pathEvents) {
    if (event.boosted && !consumedBoostsByNodeId.has(event.nodeId)) {
      throw new Error(`Události uzlu „${event.nodeId}“ chybí spotřebovaný double XP bonus.`);
    }
  }
  for (const bookId of Object.keys(course.storyBooks)) {
    if (!course.unlockedStoryBooks.includes(bookId as (typeof storyBookIds)[number])) {
      throw new Error(`Rozečtená kniha „${bookId}“ není v záloze odemčená.`);
    }
  }
  // Deleted or disputed reviews can reduce earned XP after a valid purchase.
  // Keep that purchase history; availableXpBalance already floors the balance at zero.

  return {
    schemaVersion: 8,
    exportedAt,
    decks: canonicalDecks,
    notes,
    cards,
    reviews,
    learningEvidence,
    settings,
    course,
  };
}
