import { isCountedReview } from '../stats/learning.ts';

import type { MistakeTag, ReviewLog, StudyCard } from '../types.ts';

export type WeakSpot = {
  tag: MistakeTag;
  /** Missed or hard answers with this mistake in the window. */
  count: number;
  noteIds: string[];
};

const DAY_MS = 86_400_000;
export const WEAK_SPOT_WINDOW_DAYS = 30;

function struggled(review: ReviewLog): boolean {
  return isCountedReview(review) && (review.rating === 'again' || review.rating === 'hard');
}

/**
 * The learner's most frequent concrete mistakes over the last weeks, most frequent
 * first. Generic `unknown` mistakes say nothing to practise, so they are left out.
 */
export function weakSpots(
  reviews: readonly ReviewLog[],
  now: Date,
  days = WEAK_SPOT_WINDOW_DAYS,
): WeakSpot[] {
  const since = now.getTime() - days * DAY_MS;
  const byTag = new Map<MistakeTag, { count: number; noteIds: Set<string> }>();
  for (const review of reviews) {
    if (!struggled(review) || Date.parse(review.reviewedAt) < since) continue;
    for (const tag of new Set(review.mistakeTags ?? [])) {
      if (tag === 'unknown') continue;
      const spot = byTag.get(tag) ?? { count: 0, noteIds: new Set<string>() };
      spot.count += 1;
      spot.noteIds.add(review.noteId);
      byTag.set(tag, spot);
    }
  }
  return [...byTag]
    .map(([tag, spot]) => ({ tag, count: spot.count, noteIds: [...spot.noteIds] }))
    .toSorted((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

/**
 * Cards for a weak-spot sprint: words the learner recently struggled with, those
 * with the given mistake (or any mistake) first, the most-missed words leading.
 */
export function weakSpotCards(
  cards: readonly StudyCard[],
  reviews: readonly ReviewLog[],
  now: Date,
  tag?: MistakeTag,
  days = WEAK_SPOT_WINDOW_DAYS,
): StudyCard[] {
  const since = now.getTime() - days * DAY_MS;
  const misses = new Map<string, number>();
  for (const review of reviews) {
    if (!struggled(review) || Date.parse(review.reviewedAt) < since) continue;
    if (tag && !(review.mistakeTags ?? []).includes(tag)) continue;
    misses.set(review.cardId, (misses.get(review.cardId) ?? 0) + 1);
  }
  return cards
    .filter((card) => misses.has(card.id))
    .toSorted((left, right) => (misses.get(right.id) ?? 0) - (misses.get(left.id) ?? 0));
}
