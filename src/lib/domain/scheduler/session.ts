import type { StudyCard, StudyPace, TrainingSourceFilter } from '../types.ts';

export const LONG_TERM_SESSION_WINDOW_MS = 25 * 60_000;
export const MAX_CARD_ATTEMPTS_PER_SESSION = 4;
export const MAX_GUIDED_INLINE_WAIT_MS = 45_000;
export const LONG_TERM_SESSION_STORAGE_KEY = 'fritz:long-term-session:v1';
export const LONG_TERM_SESSION_VERSION = 2;

export type LongTermSessionDraft = {
  version: typeof LONG_TERM_SESSION_VERSION;
  selectedTag: string;
  sourceFilter: TrainingSourceFilter;
  requestedSize: number;
  cardIds: string[];
  remainingCardIds: string[];
  reviews: number;
  successes: number;
  xp: number;
  combo: number;
  bestCombo: number;
  startedAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function uniqueStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item)) {
    return undefined;
  }
  return [...new Set(value)];
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function parseLongTermSessionDraft(value: unknown): LongTermSessionDraft | undefined {
  if (!isRecord(value) || (value.version !== 1 && value.version !== LONG_TERM_SESSION_VERSION)) {
    return undefined;
  }

  const cardIds = uniqueStrings(value.cardIds);
  const remainingCardIds = uniqueStrings(value.remainingCardIds);
  if (!cardIds?.length || !remainingCardIds) return undefined;
  const plannedIds = new Set(cardIds);
  const combo = value.combo === undefined ? 0 : value.combo;
  const bestCombo = value.bestCombo === undefined ? 0 : value.bestCombo;
  if (remainingCardIds.some((cardId) => !plannedIds.has(cardId))) return undefined;
  if (
    typeof value.selectedTag !== 'string' ||
    !value.selectedTag ||
    !nonNegativeInteger(value.requestedSize) ||
    !nonNegativeInteger(value.reviews) ||
    !nonNegativeInteger(value.successes) ||
    !nonNegativeInteger(value.xp) ||
    !nonNegativeInteger(combo) ||
    !nonNegativeInteger(bestCombo) ||
    value.successes > value.reviews ||
    combo > value.reviews ||
    bestCombo > value.reviews ||
    combo > bestCombo ||
    !validDate(value.startedAt) ||
    !validDate(value.updatedAt)
  ) {
    return undefined;
  }

  const sourceFilter =
    value.version === 1 || value.sourceFilter === undefined ? 'all' : value.sourceFilter;
  if (
    sourceFilter !== 'all' &&
    sourceFilter !== 'own' &&
    sourceFilter !== 'course' &&
    sourceFilter !== 'without-course'
  ) {
    return undefined;
  }

  return {
    version: LONG_TERM_SESSION_VERSION,
    selectedTag: value.selectedTag,
    sourceFilter,
    requestedSize: value.requestedSize,
    cardIds,
    remainingCardIds,
    reviews: value.reviews,
    successes: value.successes,
    xp: value.xp,
    combo,
    bestCombo,
    startedAt: value.startedAt,
    updatedAt: value.updatedAt,
  };
}

export function createLongTermSessionDraft(
  cards: StudyCard[],
  selectedTag: string,
  requestedSize: number,
  now = new Date(),
  sourceFilter: TrainingSourceFilter = 'all',
): LongTermSessionDraft {
  const cardIds = [...new Set(cards.map((card) => card.id))];
  if (cardIds.length === 0) throw new Error('Studijní dávka musí obsahovat alespoň jednu kartu.');
  const timestamp = now.toISOString();
  return {
    version: LONG_TERM_SESSION_VERSION,
    selectedTag: selectedTag || 'all',
    sourceFilter,
    requestedSize: Math.max(1, Math.round(requestedSize)),
    cardIds,
    remainingCardIds: [...cardIds],
    reviews: 0,
    successes: 0,
    xp: 0,
    combo: 0,
    bestCombo: 0,
    startedAt: timestamp,
    updatedAt: timestamp,
  };
}

export function recordLongTermSessionReview(
  draft: LongTermSessionDraft,
  cardId: string,
  successful: boolean,
  xp: number,
  now = new Date(),
): LongTermSessionDraft {
  if (!draft.remainingCardIds.includes(cardId)) return draft;
  return {
    ...draft,
    remainingCardIds: draft.remainingCardIds.filter((candidate) => candidate !== cardId),
    reviews: draft.reviews + 1,
    successes: draft.successes + (successful ? 1 : 0),
    xp: draft.xp + Math.max(0, Math.round(xp)),
    updatedAt: now.toISOString(),
  };
}

export function reconcileLongTermSessionCards(
  draft: LongTermSessionDraft,
  cards: StudyCard[],
  now = new Date(),
): StudyCard[] {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const nowMs = now.getTime();
  const available: StudyCard[] = [];
  for (const cardId of draft.remainingCardIds) {
    const card = cardsById.get(cardId);
    if (!card) continue;
    const dueAt = Date.parse(card.dueAt);
    if (!Number.isFinite(dueAt) || dueAt <= nowMs) available.push(card);
  }
  return available;
}

export type LongTermQueueDecision = {
  index?: number;
  waitMs: number;
  complete: boolean;
};

export function shouldRepeatInSession(
  card: StudyCard,
  cutoff: Date,
  attempts: number,
  maxAttempts = MAX_CARD_ATTEMPTS_PER_SESSION,
): boolean {
  const dueAt = Date.parse(card.dueAt);
  return Number.isFinite(dueAt) && dueAt <= cutoff.getTime() && attempts < Math.max(1, maxAttempts);
}

export function enqueueSessionRepeat(
  queue: StudyCard[],
  card: StudyCard,
  cutoff: Date,
  attempts: number,
  maxAttempts = MAX_CARD_ATTEMPTS_PER_SESSION,
): StudyCard[] {
  return shouldRepeatInSession(card, cutoff, attempts, maxAttempts) ? [...queue, card] : queue;
}

export function chooseNextLongTermCard(
  queue: StudyCard[],
  fromIndex: number,
  now = new Date(),
): LongTermQueueDecision {
  const safeIndex = Math.max(0, fromIndex);
  if (safeIndex >= queue.length) return { waitMs: 0, complete: true };

  const nowMs = now.getTime();
  let earliestIndex = safeIndex;
  let earliestDue = Number.POSITIVE_INFINITY;

  for (let index = safeIndex; index < queue.length; index += 1) {
    const dueAt = Date.parse(queue[index].dueAt);
    if (!Number.isFinite(dueAt) || dueAt <= nowMs) {
      return { index, waitMs: 0, complete: false };
    }
    if (dueAt < earliestDue) {
      earliestDue = dueAt;
      earliestIndex = index;
    }
  }

  return {
    index: earliestIndex,
    waitMs: Math.max(0, earliestDue - nowMs),
    complete: false,
  };
}

export function shouldWaitInsideSession(waitMs: number, pace: StudyPace): boolean {
  return pace === 'guided' && waitMs > 0 && waitMs <= MAX_GUIDED_INLINE_WAIT_MS;
}
