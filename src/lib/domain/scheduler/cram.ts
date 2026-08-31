import { stableHash } from '../deterministic.ts';

import type { RatingKey, StudyCard } from '../types.ts';

export type CramItemState = {
  cardId: string;
  dueAt: string;
  seen: number;
  successes: number;
  failures: number;
  streak: number;
  lastRating?: RatingKey;
  lastReviewedAt?: string;
  mastered: boolean;
};

export type CramSessionState = {
  id: string;
  startedAt: string;
  endsAt: string;
  reviewCount: number;
  lastCardIds: string[];
  items: CramItemState[];
};

const MINUTE = 60_000;

export function createCramSession(
  cards: StudyCard[],
  durationMinutes: number,
  now = new Date(),
): CramSessionState {
  const safeDuration = Math.min(180, Math.max(5, durationMinutes));
  return {
    id: `cram_${now.getTime()}`,
    startedAt: now.toISOString(),
    endsAt: new Date(now.getTime() + safeDuration * MINUTE).toISOString(),
    reviewCount: 0,
    lastCardIds: [],
    items: cards.map((card, index) => ({
      cardId: card.id,
      dueAt: new Date(now.getTime() + index * 25).toISOString(),
      seen: 0,
      successes: 0,
      failures: 0,
      streak: 0,
      mastered: false,
    })),
  };
}

export function cramDelayMs(
  rating: RatingKey,
  item: CramItemState,
  session: CramSessionState,
): number {
  const baseByRating: Record<RatingKey, number> = {
    again: item.failures > 0 ? 2.5 * MINUTE : 0.75 * MINUTE,
    hard: item.successes > 1 ? 7 * MINUTE : 3 * MINUTE,
    good: item.successes > 1 ? 22 * MINUTE : 10 * MINUTE,
    easy: 35 * MINUTE,
  };

  const jitter =
    0.85 + (stableHash(`${item.cardId}:${session.reviewCount}:${rating}`) / 0xffffffff) * 0.3;
  const referenceTime = new Date(item.lastReviewedAt ?? session.startedAt).getTime();
  const remaining = Math.max(20_000, new Date(session.endsAt).getTime() - referenceTime);
  return Math.max(20_000, Math.min(baseByRating[rating] * jitter, remaining * 0.72));
}

export function chooseNextCramCard(
  session: CramSessionState,
  now = new Date(),
): { cardId?: string; waitMs: number; complete: boolean } {
  const nowMs = now.getTime();
  const recent = new Set(session.lastCardIds.slice(-2));
  let earliest: { item: CramItemState; dueAt: number } | undefined;
  let bestDue: { item: CramItemState; dueAt: number } | undefined;
  for (const item of session.items) {
    if (item.mastered) continue;
    const dueAt = new Date(item.dueAt).getTime();
    if (!earliest || dueAt < earliest.dueAt) earliest = { item, dueAt };
    if (!(dueAt <= nowMs)) continue;

    const candidate = { item, dueAt };
    if (!bestDue) {
      bestDue = candidate;
      continue;
    }
    const priority =
      Number(item.seen > 0) - Number(bestDue.item.seen > 0) ||
      Number(recent.has(item.cardId)) - Number(recent.has(bestDue.item.cardId)) ||
      bestDue.item.failures - item.failures ||
      dueAt - bestDue.dueAt;
    if (priority < 0) bestDue = candidate;
  }

  if (bestDue) return { cardId: bestDue.item.cardId, waitMs: 0, complete: false };
  if (!earliest) return { waitMs: 0, complete: true };
  return {
    cardId: earliest.item.cardId,
    waitMs: Math.max(0, earliest.dueAt - nowMs),
    complete: false,
  };
}

export function recordCramReview(
  session: CramSessionState,
  cardId: string,
  rating: RatingKey,
  now = new Date(),
): CramSessionState {
  const item = session.items.find((candidate) => candidate.cardId === cardId);
  if (!item) return session;

  const success = rating === 'good' || rating === 'easy';
  const nextItem: CramItemState = {
    ...item,
    seen: item.seen + 1,
    successes: item.successes + Number(success),
    failures: item.failures + Number(rating === 'again'),
    streak: success ? item.streak + 1 : 0,
    lastRating: rating,
    lastReviewedAt: now.toISOString(),
    mastered: success && item.successes + 1 >= 2 && item.streak + 1 >= 2,
  };

  const nextSession: CramSessionState = {
    ...session,
    reviewCount: session.reviewCount + 1,
    lastCardIds: [...session.lastCardIds, cardId].slice(-6),
    items: session.items.map((candidate) => (candidate.cardId === cardId ? nextItem : candidate)),
  };

  nextItem.dueAt = new Date(
    now.getTime() + cramDelayMs(rating, nextItem, nextSession),
  ).toISOString();
  return nextSession;
}

export function cramProgress(session: CramSessionState): {
  mastered: number;
  total: number;
  percent: number;
} {
  const total = session.items.length;
  const mastered = session.items.filter((item) => item.mastered).length;
  return { mastered, total, percent: total === 0 ? 100 : Math.round((mastered / total) * 100) };
}
