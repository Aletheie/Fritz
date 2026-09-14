import { stableHash, takeLowest } from '../deterministic.ts';
import { buildClozeExercise, buildWordOrderExercise } from '../exercises/context.ts';
import { canBuildVocabularyMatchingExercise } from '../exercises/matching.ts';
import { isCountedReview } from '../stats/learning.ts';

import type {
  ExerciseKind,
  ExercisePreferences,
  MotherTongue,
  Note,
  ReviewLog,
  StudyCard,
  TrainingSourceFilter,
} from '../types.ts';

function dueTimestamp(card: StudyCard): number {
  const value = Date.parse(card.dueAt);
  // Poškozené datum nesmí kartu navždy schovat; bezpečně ji nabídneme k opravě.
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

export function selectDueCards(
  cards: StudyCard[],
  now = new Date(),
  limit = 50,
  dailyNewLimit = 15,
): StudyCard[] {
  const safeLimit = Math.max(0, limit);
  const safeNewLimit = Math.max(0, dailyNewLimit);
  if (safeLimit === 0 || Number.isNaN(safeLimit)) return [];
  const resultLimit = Number.isFinite(safeLimit) ? Math.ceil(safeLimit) : cards.length;
  const newLimit = Number.isNaN(safeNewLimit)
    ? 0
    : Number.isFinite(safeNewLimit)
      ? Math.trunc(safeNewLimit)
      : resultLimit;
  const nowMs = now.getTime();
  const existingCandidates: Array<{ card: StudyCard; dueAt: number; order: number }> = [];
  const freshCandidates: Array<{ card: StudyCard; order: number }> = [];
  for (const [order, card] of cards.entries()) {
    const dueAt = dueTimestamp(card);
    if (dueAt > nowMs) continue;
    if (card.fsrs) existingCandidates.push({ card, dueAt, order });
    else freshCandidates.push({ card, order });
  }
  const existing = takeLowest(existingCandidates, resultLimit, (left, right) =>
    left.dueAt === right.dueAt ? left.order - right.order : left.dueAt - right.dueAt,
  );
  const fresh = takeLowest(
    freshCandidates,
    Math.min(resultLimit, newLimit),
    (left, right) =>
      left.card.createdAt.localeCompare(right.card.createdAt) || left.order - right.order,
  );

  const result: StudyCard[] = [];
  let reviewIndex = 0;
  let newIndex = 0;

  // Due reviews are protected from a flood of new cards. One fresh card is introduced
  // after every two existing reviews, then either side is drained without stalling.
  while (result.length < safeLimit && (reviewIndex < existing.length || newIndex < fresh.length)) {
    if (reviewIndex < existing.length) {
      result.push(existing[reviewIndex].card);
      reviewIndex += 1;

      if (
        result.length < safeLimit &&
        newIndex < fresh.length &&
        (reviewIndex % 2 === 0 || reviewIndex >= existing.length)
      ) {
        result.push(fresh[newIndex].card);
        newIndex += 1;
      }
      continue;
    }

    result.push(fresh[newIndex].card);
    newIndex += 1;
  }

  return result;
}

export function selectDistinctNoteCards(cards: StudyCard[], limit = cards.length): StudyCard[] {
  const safeLimit = Math.max(0, Math.round(limit));
  const seenNoteIds = new Set<string>();
  const selected: StudyCard[] = [];
  for (const card of cards) {
    if (selected.length >= safeLimit) break;
    if (seenNoteIds.has(card.noteId)) continue;
    seenNoteIds.add(card.noteId);
    selected.push(card);
  }
  return selected;
}

export function filterCardsByTag(cards: StudyCard[], notes: Note[], tag: string): StudyCard[] {
  if (!tag || tag === 'all') return cards;
  const matchingNoteIds = new Set<string>();
  for (const note of notes) {
    if (note.tags.includes(tag)) matchingNoteIds.add(note.id);
  }
  return cards.filter((card) => matchingNoteIds.has(card.noteId));
}

export type TrainingCardFilter = {
  tag?: string;
  source?: TrainingSourceFilter;
};

export function filterCardsForTraining(
  cards: StudyCard[],
  notes: Note[],
  filter: TrainingCardFilter = {},
): StudyCard[] {
  const source = filter.source ?? 'all';
  const tag = filter.tag ?? 'all';
  if (source === 'all' && (!tag || tag === 'all')) return cards;

  const notesById = new Map<string, Note>();
  for (const note of notes) notesById.set(note.id, note);
  return cards.filter((card) => {
    const note = notesById.get(card.noteId);
    if (!note || (tag && tag !== 'all' && !note.tags.includes(tag))) return false;
    if (source === 'course') return note.source === 'course' || Boolean(note.courseLinks?.length);
    if (source === 'own') return note.source !== 'course' && note.source !== 'seed';
    // Linking a user's word to the course keeps its original source.
    if (source === 'without-course') return note.source !== 'course';
    return true;
  });
}

export function selectDueCardsForTraining(
  cards: StudyCard[],
  notes: Note[],
  filter: TrainingCardFilter = {},
  now = new Date(),
  limit = 50,
  dailyNewLimit = 15,
): StudyCard[] {
  return selectDueCards(filterCardsForTraining(cards, notes, filter), now, limit, dailyNewLimit);
}

const baseWeights: Record<ExerciseKind, number> = {
  typing: 38,
  choice: 13,
  flashcard: 7,
  'word-order': 16,
  cloze: 20,
  sentence: 10,
  matching: 14,
  speaking: 12,
};

export type AdaptiveExerciseDecision = {
  kind: ExerciseKind;
  reason: string;
  available: ExerciseKind[];
};

export type AdaptiveExerciseInput = {
  card: StudyCard;
  note: Note;
  notes: Note[];
  reviews: ReviewLog[];
  preferences: ExercisePreferences;
  sessionIndex: number;
  aiAvailable: boolean;
  language?: MotherTongue;
};

function recentCardReviews(cardId: string, reviews: ReviewLog[]): ReviewLog[] {
  const matching: ReviewLog[] = [];
  for (const review of reviews) {
    if (review.cardId !== cardId || !isCountedReview(review)) continue;
    const insertionIndex = matching.findIndex(
      (candidate) => candidate.reviewedAt.localeCompare(review.reviewedAt) < 0,
    );
    if (insertionIndex < 0) {
      if (matching.length < 8) matching.push(review);
      continue;
    }
    matching.splice(insertionIndex, 0, review);
    if (matching.length > 8) matching.pop();
  }
  return matching;
}

function availableExercises(input: AdaptiveExerciseInput): ExerciseKind[] {
  const available: ExerciseKind[] = [];
  const preferences = input.preferences;
  if (preferences.typing) available.push('typing');
  if (preferences.choice && input.notes.some((note) => note.id !== input.note.id)) {
    available.push('choice');
  }
  if (preferences.flashcard) available.push('flashcard');
  if (preferences.wordOrder && buildWordOrderExercise(input.note, input.sessionIndex)) {
    available.push('word-order');
  }
  // Every card has a safe recall fallback, while rich cards rotate examples, plurals and forms.
  if (preferences.cloze && buildClozeExercise(input.note, input.sessionIndex))
    available.push('cloze');
  if (preferences.sentence && input.aiAvailable) available.push('sentence');
  if (
    preferences.matching &&
    canBuildVocabularyMatchingExercise(input.note, input.notes, input.sessionIndex, input.language)
  ) {
    available.push('matching');
  }
  // The microphone is progressive enhancement; the editable transcript keeps this usable everywhere.
  if (preferences.speaking) available.push('speaking');

  // A malformed/imported card must never make a session impossible to finish.
  return available.length > 0 ? available : ['typing'];
}

function multiply(weights: Map<ExerciseKind, number>, kind: ExerciseKind, factor: number): void {
  const current = weights.get(kind);
  if (current !== undefined) weights.set(kind, Math.max(0.01, current * factor));
}

function decisionReason(
  kind: ExerciseKind,
  input: AdaptiveExerciseInput,
  recent: ReviewLog[],
): string {
  const latest = recent[0];
  const articleMistake = recent.some(
    (review) => review.signal.wordCorrect && !review.signal.articleCorrect,
  );
  if (kind === 'sentence') return 'Přenášíš slovo z kartičky do vlastní věty.';
  if (kind === 'matching') return 'Propojíš význam se slovem mezi podobnými výrazy.';
  if (kind === 'speaking') return 'Výslovnost zapojuje aktivní vybavení bez klávesnice.';
  if (kind === 'word-order') return 'U fráze nebo příkladu je teď důležitý slovosled.';
  if (kind === 'cloze' && articleMistake) return 'Člen nebo tvar byl naposledy slabší.';
  if (kind === 'cloze') return 'Algoritmus střídá překlad s použitím v kontextu.';
  if (kind === 'typing' && latest?.rating === 'again')
    return 'Po chybě dostává přednost aktivní vybavení.';
  if (kind === 'choice' && !input.card.fsrs) return 'Nové slovo nejdřív bezpečně poznáš.';
  if (kind === 'flashcard') return 'Krátká kontrola vybavení bez psaní.';
  return 'Typ úlohy vychází z historie karty a střídání zátěže.';
}

export function chooseAdaptiveExercise(input: AdaptiveExerciseInput): AdaptiveExerciseDecision {
  const available = availableExercises(input);
  const recent = recentCardReviews(input.card.id, input.reviews);
  const weights = new Map<ExerciseKind, number>(available.map((kind) => [kind, baseWeights[kind]]));
  const isNew = !input.card.fsrs || recent.length === 0;
  const reps = Number(input.card.fsrs?.reps ?? recent.length);
  const mature = reps >= 3 && Number(input.card.fsrs?.stability ?? 0) >= 7;
  const againCount = recent.filter((review) => review.rating === 'again').length;
  const articleMistakeCount = recent.filter(
    (review) => review.signal.wordCorrect && !review.signal.articleCorrect,
  ).length;
  const latestExercise = recent[0]?.exercise;

  if (isNew) {
    multiply(weights, 'choice', 1.7);
    multiply(weights, 'flashcard', 1.35);
    multiply(weights, 'word-order', 1.25);
    multiply(weights, 'typing', 0.85);
    multiply(weights, 'sentence', 0.35);
    multiply(weights, 'matching', 1.7);
    multiply(weights, 'speaking', 0.6);
  }

  if (mature) {
    multiply(weights, 'choice', 0.45);
    multiply(weights, 'flashcard', 0.55);
    multiply(weights, 'typing', 1.25);
    multiply(weights, 'cloze', 1.45);
    multiply(weights, 'sentence', 1.8);
    multiply(weights, 'matching', 0.75);
    multiply(weights, 'speaking', 1.7);
  }

  if (againCount > 0) {
    const pressure = Math.min(2.2, 1.25 + againCount * 0.25);
    multiply(weights, 'typing', pressure);
    multiply(weights, 'cloze', pressure);
    multiply(weights, 'choice', 0.6);
    multiply(weights, 'flashcard', 0.65);
    multiply(weights, 'speaking', pressure * 0.9);
  }

  if (articleMistakeCount > 0 && input.note.article) {
    multiply(weights, 'typing', 1.45);
    multiply(weights, 'cloze', 1.8);
    multiply(weights, 'speaking', 1.35);
  }

  if (input.note.kind === 'phrase') {
    multiply(weights, 'word-order', 2.4);
    multiply(weights, 'sentence', 1.35);
    multiply(weights, 'speaking', 1.35);
  }
  if (input.note.exampleDe) {
    multiply(weights, 'cloze', 1.25);
    multiply(weights, 'word-order', 1.2);
  }
  if (input.note.plural || input.note.verbForms) multiply(weights, 'cloze', 1.25);

  if (latestExercise && available.length > 1) multiply(weights, latestExercise, 0.2);

  let total = 0;
  for (const weight of weights.values()) total += weight;
  const entropy = `${input.card.id}:${recent.length}:${input.sessionIndex}:${recent.map((review) => review.rating[0]).join('')}`;
  let roll = ((stableHash(entropy) % 1_000_000) / 1_000_000) * total;
  let kind = available[available.length - 1];
  for (const candidate of available) {
    roll -= weights.get(candidate) ?? 0;
    if (roll <= 0) {
      kind = candidate;
      break;
    }
  }

  return {
    kind,
    available,
    reason: decisionReason(kind, input, recent),
  };
}

export function buildChoiceOptions(current: Note, notes: Note[], limit = 4, seed = 0): Note[] {
  const safeLimit = Math.max(1, Math.round(limit));
  const candidateLimit = Math.min(notes.length, Math.max(0, safeLimit - 1));
  const currentTags = new Set(current.tags);
  const candidates: Array<{ note: Note; score: number; tie: number }> = [];
  for (const note of notes) {
    if (note.id === current.id) continue;
    const kindPenalty = note.kind === current.kind ? 0 : 4;
    const levelPenalty = note.cefr && current.cefr && note.cefr === current.cefr ? 0 : 1;
    const tagOverlap = note.tags.some((tag) => currentTags.has(tag)) ? 0 : 1;
    const candidate = {
      note,
      score: kindPenalty + levelPenalty + tagOverlap,
      tie: stableHash(`${current.id}:${note.id}:${seed}`),
    };
    const insertionIndex = candidates.findIndex(
      (existing) =>
        candidate.score < existing.score ||
        (candidate.score === existing.score && candidate.tie < existing.tie),
    );
    if (insertionIndex < 0) {
      if (candidates.length < candidateLimit) candidates.push(candidate);
      continue;
    }
    candidates.splice(insertionIndex, 0, candidate);
    if (candidates.length > candidateLimit) candidates.pop();
  }

  const options = [current];
  for (const candidate of candidates) options.push(candidate.note);
  options.sort(
    (left, right) =>
      stableHash(`${seed}:${current.id}:${left.id}`) -
      stableHash(`${seed}:${current.id}:${right.id}`),
  );
  return options;
}
