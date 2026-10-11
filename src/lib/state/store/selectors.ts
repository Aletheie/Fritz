import { derived } from 'svelte/store';
import {
  creditedCoachTurnsOnDay,
  courseAnswersOnDay,
} from '../../domain/course/course-progress.ts';
import { dailyLearningTargets } from '../../domain/course/daily.ts';
import { activeDoubleXp, availableXpBalance } from '../../domain/course/wallet.ts';
import { gamificationSummary } from '../../domain/gamification.ts';
import { selectDueCards } from '../../domain/scheduler/queue.ts';
import { localDateKey, remainingDailyNewCards, reviewsOnDay } from '../../domain/stats/learning.ts';
import type { ReviewStats } from '../../domain/stats/review-stats.ts';
import { localized } from '../../i18n/index.ts';
import { clock, state } from './core.ts';

import type { DailySessionRecord } from '../../domain/learning/types.ts';
import type { CourseProgress, ReviewLog, StudyCard } from '../../domain/types.ts';

export const appClock = { subscribe: clock.subscribe };

export const motherTongue = derived(state, ($state) => $state.settings?.motherTongue ?? 'cs');

/** `$tr('česky', 'English')` picks the copy for the learner's interface language. */
export const tr = derived(
  motherTongue,
  ($language) => (cs: string, en: string) => localized($language, { cs, en }),
);

export const dueCards = derived([state, clock], ([$state, $clock]) =>
  selectDueCards(
    $state.cards,
    new Date($clock),
    50,
    remainingDailyNewCards(
      $state.recentReviews,
      $state.settings?.dailyNewLimit ?? 15,
      new Date($clock),
    ),
  ),
);

let dailyReviewCache: { reviews: ReviewLog[]; day: string; result: ReviewLog[] } | undefined;

function cachedReviewsOnDay(reviews: ReviewLog[], now: Date): ReviewLog[] {
  const day = localDateKey(now);
  if (dailyReviewCache?.reviews === reviews && dailyReviewCache.day === day) {
    return dailyReviewCache.result;
  }
  const result = reviewsOnDay(reviews, now);
  dailyReviewCache = { reviews, day, result };
  return result;
}

let dailyProgressCache:
  | {
      reviews: ReviewLog[];
      course: CourseProgress;
      dailySessions: DailySessionRecord[];
      dailyMinutes: number;
      day: string;
      result: {
        completed: number;
        vocabularyCompleted: number;
        grammarCompleted: number;
        coachCompleted: number;
        minutes: 5 | 10 | 20;
        vocabularyGoal: number;
        grammarGoal: number;
        coachGoal: number;
        goal: number;
        percent: number;
        reached: boolean;
      };
    }
  | undefined;

export const dailyProgress = derived([state, clock], ([$state, $clock]) => {
  const now = new Date($clock);
  const day = localDateKey(now);
  const dailyMinutes = $state.settings?.dailyMinutes ?? 10;
  const targets = dailyLearningTargets(dailyMinutes);
  if (
    dailyProgressCache?.reviews === $state.recentReviews &&
    dailyProgressCache.course === $state.course &&
    dailyProgressCache.dailySessions === $state.dailySessions &&
    dailyProgressCache.dailyMinutes === dailyMinutes &&
    dailyProgressCache.day === day
  ) {
    return dailyProgressCache.result;
  }
  const dailySession = $state.dailySessions
    .filter(
      (candidate) => candidate.plan.localDay === day && candidate.plan.minutes === dailyMinutes,
    )
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  if (dailySession) {
    const completedIds = new Set(dailySession.completedActivityIds);
    const completedActivities = dailySession.plan.activities.filter((activity) =>
      completedIds.has(activity.id),
    );
    const vocabularyGoal = dailySession.plan.activities.filter(
      (activity) => activity.kind === 'review',
    ).length;
    const grammarGoal = dailySession.plan.activities.filter(
      (activity) => activity.kind === 'grammar' || activity.kind === 'listening',
    ).length;
    const coachGoal = dailySession.plan.activities.filter(
      (activity) => activity.kind === 'transfer',
    ).length;
    const result = {
      completed: completedActivities.length,
      vocabularyCompleted: completedActivities.filter((activity) => activity.kind === 'review')
        .length,
      grammarCompleted: completedActivities.filter(
        (activity) => activity.kind === 'grammar' || activity.kind === 'listening',
      ).length,
      coachCompleted: completedActivities.filter((activity) => activity.kind === 'transfer').length,
      minutes: dailySession.plan.minutes,
      vocabularyGoal,
      grammarGoal,
      coachGoal,
      goal: dailySession.plan.activities.length,
      percent:
        dailySession.plan.activities.length === 0
          ? 100
          : Math.min(
              100,
              Math.round((completedActivities.length / dailySession.plan.activities.length) * 100),
            ),
      reached: Boolean(dailySession.completedAt),
    };
    dailyProgressCache = {
      reviews: $state.recentReviews,
      course: $state.course,
      dailySessions: $state.dailySessions,
      dailyMinutes,
      day,
      result,
    };
    return result;
  }
  const vocabularyCompleted = Math.min(
    targets.vocabulary,
    new Set(
      cachedReviewsOnDay($state.recentReviews, now).map((storedReview) => storedReview.noteId),
    ).size,
  );
  const grammarCompleted = Math.min(targets.grammar, courseAnswersOnDay($state.course, now));
  const coachCompleted = Math.min(targets.coach, creditedCoachTurnsOnDay($state.course, now));
  const completed = vocabularyCompleted + grammarCompleted + coachCompleted;
  const result = {
    completed,
    vocabularyCompleted,
    grammarCompleted,
    coachCompleted,
    minutes: targets.minutes,
    vocabularyGoal: targets.vocabulary,
    grammarGoal: targets.grammar,
    coachGoal: targets.coach,
    goal: targets.total,
    percent: Math.min(100, Math.round((completed / targets.total) * 100)),
    reached: completed >= targets.total,
  };
  dailyProgressCache = {
    reviews: $state.recentReviews,
    course: $state.course,
    dailySessions: $state.dailySessions,
    dailyMinutes,
    day,
    result,
  };
  return result;
});

let gameProgressCache:
  | {
      reviews: ReviewLog[];
      reviewStats: ReviewStats;
      cards: StudyCard[];
      course: CourseProgress;
      dailyGoal: number;
      day: string;
      result: ReturnType<typeof gamificationSummary>;
    }
  | undefined;

export const gameProgress = derived([state, clock], ([$state, $clock]) => {
  const now = new Date($clock);
  const dailyGoal = $state.settings?.dailyGoal ?? 20;
  const day = localDateKey(now);
  if (
    gameProgressCache?.reviews === $state.recentReviews &&
    gameProgressCache.reviewStats === $state.reviewStats &&
    gameProgressCache.cards === $state.cards &&
    gameProgressCache.course === $state.course &&
    gameProgressCache.dailyGoal === dailyGoal &&
    gameProgressCache.day === day
  ) {
    return gameProgressCache.result;
  }
  const result = gamificationSummary(
    $state.recentReviews,
    $state.cards,
    now,
    dailyGoal,
    $state.course,
    $state.reviewStats,
  );
  gameProgressCache = {
    reviews: $state.recentReviews,
    reviewStats: $state.reviewStats,
    cards: $state.cards,
    course: $state.course,
    dailyGoal,
    day,
    result,
  };
  return result;
});

export const walletProgress = derived([state, gameProgress], ([$state, $game]) => ({
  balance: availableXpBalance($game.totalXp, $state.course),
  spent: $state.course.wallet.purchases.reduce((sum, purchase) => sum + purchase.price, 0),
  activeBoost: activeDoubleXp($state.course),
}));
