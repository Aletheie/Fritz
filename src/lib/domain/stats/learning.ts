import type { ReviewLog } from '../types.ts';

export function isCountedReview(review: Pick<ReviewLog, 'excludedFromLearning'>): boolean {
  return review.excludedFromLearning !== true;
}

export function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function reviewLocalDay(review: Pick<ReviewLog, 'localDay' | 'reviewedAt'>): string {
  return review.localDay ?? localDateKey(new Date(review.reviewedAt));
}

function countedOnDay(review: ReviewLog, key: string): boolean {
  return isCountedReview(review) && reviewLocalDay(review) === key;
}

export function reviewsOnDay(reviews: ReviewLog[], day = new Date()): ReviewLog[] {
  const key = localDateKey(day);
  return reviews.filter((review) => countedOnDay(review, key));
}

export function uniqueNotesReviewedOnDay(reviews: ReviewLog[], day = new Date()): number {
  const key = localDateKey(day);
  const noteIds = new Set<string>();
  for (const review of reviews) {
    if (countedOnDay(review, key)) noteIds.add(review.noteId);
  }
  return noteIds.size;
}

export function newCardsStudiedOnDay(reviews: ReviewLog[], day = new Date()): number {
  const key = localDateKey(day);
  const cardIds = new Set<string>();
  for (const review of reviews) {
    if (countedOnDay(review, key) && review.mode === 'long-term' && !review.scheduleBefore) {
      cardIds.add(review.cardId);
    }
  }
  return cardIds.size;
}

export function remainingDailyNewCards(
  reviews: ReviewLog[],
  dailyLimit: number,
  day = new Date(),
): number {
  return Math.max(0, Math.round(dailyLimit) - newCardsStudiedOnDay(reviews, day));
}

export function recentAccuracy(reviews: ReviewLog[], limit = 40): number {
  const safeLimit = Math.max(1, Math.round(limit));
  let counted = 0;
  let successful = 0;
  for (let index = reviews.length - 1; index >= 0 && counted < safeLimit; index -= 1) {
    const review = reviews[index];
    if (!isCountedReview(review)) continue;
    counted += 1;
    if (review.rating !== 'again') successful += 1;
  }
  return counted === 0 ? 0 : Math.round((successful / counted) * 100);
}

export function streakDays(reviews: ReviewLog[], now = new Date()): number {
  const days = new Set<string>();
  for (const review of reviews) {
    if (isCountedReview(review)) days.add(reviewLocalDay(review));
  }
  if (days.size === 0) return 0;

  const cursor = new Date(now);
  if (!days.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function dailyGoalProgress(
  reviews: ReviewLog[],
  goal: number,
  now = new Date(),
): {
  completed: number;
  goal: number;
  percent: number;
  reached: boolean;
} {
  const safeGoal = Math.max(1, Math.round(goal));
  const key = localDateKey(now);
  let completed = 0;
  for (const review of reviews) {
    if (countedOnDay(review, key)) completed += 1;
  }
  return {
    completed,
    goal: safeGoal,
    percent: Math.min(100, Math.round((completed / safeGoal) * 100)),
    reached: completed >= safeGoal,
  };
}

export function reviewedNoteCount(reviews: ReviewLog[]): number {
  const noteIds = new Set<string>();
  for (const review of reviews) {
    if (isCountedReview(review)) noteIds.add(review.noteId);
  }
  return noteIds.size;
}
