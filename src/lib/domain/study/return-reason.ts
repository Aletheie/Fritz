import { localized } from '../../i18n/index.ts';
import { mistakeLabel } from '../../i18n/mistakes.ts';
import { isCountedReview } from '../stats/learning.ts';

import type { MotherTongue, ReviewLog } from '../types.ts';

const DAY_MS = 86_400_000;

function latestCountedReview(reviews: readonly ReviewLog[], cardId: string): ReviewLog | undefined {
  let latest: ReviewLog | undefined;
  for (const review of reviews) {
    if (review.cardId !== cardId || !isCountedReview(review)) continue;
    if (!latest || review.reviewedAt > latest.reviewedAt) latest = review;
  }
  return latest;
}

/**
 * One short sentence explaining why a card is back, from its latest counted review.
 * Returns undefined for a card the learner has never answered.
 */
export function cardReturnReason(
  reviews: readonly ReviewLog[],
  cardId: string,
  now: Date,
  language: MotherTongue,
): string | undefined {
  const last = latestCountedReview(reviews, cardId);
  if (!last) return undefined;
  const copy = (cs: string, en: string) => localized(language, { cs, en });

  if (last.rating === 'again') {
    const tags = [...new Set(last.mistakeTags ?? [])].filter((tag) => tag !== 'unknown');
    if (tags.length > 0) {
      const labels = tags.slice(0, 2).map((tag) => mistakeLabel(tag, language));
      return copy(`Minulá chyba: ${labels.join(', ')}.`, `Last mistake: ${labels.join(', ')}.`);
    }
    return copy('Minule se výraz nevybavil.', 'Last time you could not recall it.');
  }
  if (last.rating === 'hard') {
    return last.signal.hintsUsed > 0
      ? copy('Minule to šlo jen s nápovědou.', 'Last time you needed a hint.')
      : copy('Minule to šlo ztěžka.', 'Last time it was hard.');
  }
  const days = Math.max(0, Math.round((now.getTime() - Date.parse(last.reviewedAt)) / DAY_MS));
  if (days === 0) return copy('Dnes ho upevňuješ podruhé.', 'You are reinforcing it again today.');
  return copy(
    `Plánované opakování po ${days} ${days === 1 ? 'dni' : 'dnech'}, než ho zapomeneš.`,
    `Scheduled after ${days} ${days === 1 ? 'day' : 'days'}, just before you would forget it.`,
  );
}
