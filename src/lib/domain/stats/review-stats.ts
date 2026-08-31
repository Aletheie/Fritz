import { calculateReviewXp } from '../gamification.ts';
import { isCountedReview, reviewLocalDay } from './learning.ts';

import type { ExerciseKind, ReviewLog } from '../types.ts';

export type ReviewDayStats = {
  count: number;
  xp: number;
};

export type ReviewStats = {
  key: 'reviews';
  schemaVersion: 1;
  totalReviews: number;
  countedReviews: number;
  reviewXp: number;
  typingAnswers: number;
  unassistedAnswers: number;
  longestCleanRun: number;
  currentCleanRun: number;
  currentCleanRunDay?: string;
  activityDays: string[];
  byDay: Record<string, ReviewDayStats>;
  updatedAt: string;
};

const typingExercises = new Set<ExerciseKind>(['typing', 'cloze', 'sentence']);

function cleanAnswer(review: ReviewLog): boolean {
  return (
    review.rating !== 'again' &&
    review.signal.wordCorrect &&
    review.signal.articleCorrect &&
    review.signal.hintsUsed === 0 &&
    review.signal.attempt === 1
  );
}

export function createReviewStats(now = new Date()): ReviewStats {
  return {
    key: 'reviews',
    schemaVersion: 1,
    totalReviews: 0,
    countedReviews: 0,
    reviewXp: 0,
    typingAnswers: 0,
    unassistedAnswers: 0,
    longestCleanRun: 0,
    currentCleanRun: 0,
    activityDays: [],
    byDay: {},
    updatedAt: now.toISOString(),
  };
}

export function deriveReviewStats(reviews: ReviewLog[], now = new Date()): ReviewStats {
  const stats = createReviewStats(now);
  const cardDayCounts = new Map<string, number>();
  for (const review of reviews.toSorted((left, right) =>
    left.reviewedAt.localeCompare(right.reviewedAt),
  )) {
    const counted = isCountedReview(review);
    stats.totalReviews += 1;
    if (!counted) continue;
    const day = reviewLocalDay(review);
    const cardDay = `${review.cardId}:${day}`;
    const previousCardReviews = cardDayCounts.get(cardDay) ?? 0;
    cardDayCounts.set(cardDay, previousCardReviews + 1);
    const dayStats = stats.byDay[day] ?? { count: 0, xp: 0 };
    const xp =
      typeof review.xpAwarded === 'number' && Number.isFinite(review.xpAwarded)
        ? Math.max(0, Math.round(review.xpAwarded))
        : calculateReviewXp(review, previousCardReviews);
    stats.byDay[day] = { count: dayStats.count + 1, xp: dayStats.xp + xp };
    stats.countedReviews += 1;
    stats.reviewXp += xp;
    if (typingExercises.has(review.exercise)) stats.typingAnswers += 1;
    const clean = cleanAnswer(review);
    if (clean) stats.unassistedAnswers += 1;
    if (stats.currentCleanRunDay !== day) stats.currentCleanRun = 0;
    stats.currentCleanRun = clean ? stats.currentCleanRun + 1 : 0;
    stats.currentCleanRunDay = day;
    stats.longestCleanRun = Math.max(stats.longestCleanRun, stats.currentCleanRun);
  }
  stats.activityDays = Object.keys(stats.byDay).toSorted();
  return stats;
}

function insertActivityDay(days: string[], day: string): string[] {
  let start = 0;
  let end = days.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (days[middle] < day) start = middle + 1;
    else end = middle;
  }
  if (days[start] === day) return days;
  return [...days.slice(0, start), day, ...days.slice(start)];
}

export function appendReviewStats(
  current: ReviewStats | undefined,
  review: ReviewLog,
  now = new Date(review.reviewedAt),
): ReviewStats {
  const stats = current?.schemaVersion === 1 ? current : createReviewStats(now);
  const next: ReviewStats = {
    ...stats,
    byDay: { ...stats.byDay },
    activityDays: stats.activityDays,
    totalReviews: stats.totalReviews + 1,
    updatedAt: now.toISOString(),
  };
  if (!isCountedReview(review)) return next;

  const day = reviewLocalDay(review);
  const previousDay = next.byDay[day] ?? { count: 0, xp: 0 };
  const xp =
    typeof review.xpAwarded === 'number'
      ? Math.max(0, Math.round(review.xpAwarded))
      : calculateReviewXp(review, previousDay.count);
  next.byDay[day] = { count: previousDay.count + 1, xp: previousDay.xp + xp };
  next.countedReviews += 1;
  next.reviewXp += xp;
  if (typingExercises.has(review.exercise)) next.typingAnswers += 1;
  const clean = cleanAnswer(review);
  if (clean) next.unassistedAnswers += 1;
  next.currentCleanRun =
    next.currentCleanRunDay === day && clean ? next.currentCleanRun + 1 : clean ? 1 : 0;
  next.currentCleanRunDay = day;
  next.longestCleanRun = Math.max(next.longestCleanRun, next.currentCleanRun);
  next.activityDays = insertActivityDay(next.activityDays, day);
  return next;
}
