import { grammarLessonIdSet } from './course/grammar-lesson-ids.ts';
import { isCountedReview, localDateKey, reviewLocalDay, streakDays } from './stats/learning.ts';

import type { ReviewStats } from './stats/review-stats.ts';
import type { CourseProgress, ExerciseKind, RatingKey, ReviewLog, StudyCard } from './types.ts';

export type MasteryTier = 'new' | 'learning' | 'familiar' | 'strong' | 'mastered';
export type MasteryDistribution = Record<MasteryTier, number>;

export type LevelProgress = {
  level: number;
  title: string;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  percent: number;
};

export type DailyMission = {
  id: 'reviews' | 'recall' | 'perfect';
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  rewardXp: number;
};

export const DAILY_MISSION_REWARD_XP = 5;
export const DAILY_MISSION_SET_BONUS_XP = 15;

const czechShortDateFormatter = new Intl.DateTimeFormat('cs-CZ', {
  day: 'numeric',
  month: 'short',
});
export const DAILY_MISSION_MAX_BONUS_XP = DAILY_MISSION_REWARD_XP * 3 + DAILY_MISSION_SET_BONUS_XP;

export type MissionSummary = {
  completed: number;
  total: number;
  percent: number;
  allCompleted: boolean;
};

export type RivalProfile = {
  id: 'mila' | 'konrad' | 'nora';
  name: string;
  initials: string;
  style: string;
};

export type WeeklyRival = {
  profile: RivalProfile;
  weekLabel: string;
  endsAt: string;
  daysLeft: number;
  userXp: number;
  rivalXp: number;
  targetXp: number;
  userPercent: number;
  rivalPercent: number;
  difference: number;
  standing: 'leading' | 'trailing' | 'tied';
  message: string;
};

export type PersonalRecords = {
  bestDayXp: number;
  bestDayKey?: string;
  longestCleanRun: number;
  unassistedAnswers: number;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
};

export type GamificationSummary = {
  totalXp: number;
  todayXp: number;
  level: LevelProgress;
  streak: number;
  longestStreak: number;
  missions: DailyMission[];
  missionSummary: MissionSummary;
  rival: WeeklyRival;
  records: PersonalRecords;
  achievements: Achievement[];
  nextAchievement?: Achievement;
  masteredCards: number;
  reviewXp: number;
  grammarXp: number;
  coachXp: number;
  pathXp: number;
  coachSessions: number;
  completedGrammarLessons: number;
  reward: {
    id: 'xp-2000';
    target: 2000;
    progress: number;
    percent: number;
    unlocked: boolean;
    claimed: boolean;
  };
};

const exerciseBase: Record<ExerciseKind, number> = {
  typing: 12,
  choice: 8,
  flashcard: 5,
  'word-order': 10,
  cloze: 12,
  sentence: 15,
  matching: 10,
  speaking: 14,
};

function ratingXp(base: number, rating: RatingKey): number {
  if (rating === 'again') return 2;
  if (rating === 'hard') return Math.max(4, Math.round(base * 0.65));
  if (rating === 'easy') return base + 2;
  return base;
}

export function calculateReviewXp(
  review: Pick<ReviewLog, 'exercise' | 'rating' | 'mode' | 'signal'>,
  previousSameCardToday = 0,
): number {
  let xp = ratingXp(exerciseBase[review.exercise], review.rating);

  if (review.mode === 'cram') xp = Math.max(1, Math.round(xp * 0.65));
  if (review.signal.attempt > 1 || review.signal.hintsUsed > 0) {
    xp = Math.max(1, Math.round(xp * 0.7));
  }

  // A sprint can repeat one card many times. After four attempts the learning still counts,
  // but it no longer becomes a way to farm levels.
  if (previousSameCardToday >= 4) xp = Math.min(1, xp);
  return xp;
}

function reviewXpWithFallback(review: ReviewLog, previousSameCardToday: number): number {
  return typeof review.xpAwarded === 'number' && Number.isFinite(review.xpAwarded)
    ? Math.max(0, Math.round(review.xpAwarded))
    : calculateReviewXp(review, previousSameCardToday);
}

export function xpBreakdown(reviews: ReviewLog[]): Array<{ review: ReviewLog; xp: number }> {
  const counts = new Map<string, number>();
  const countedReviews: ReviewLog[] = [];
  for (const review of reviews) {
    if (isCountedReview(review)) countedReviews.push(review);
  }
  countedReviews.sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt));

  const breakdown: Array<{ review: ReviewLog; xp: number }> = [];
  for (const review of countedReviews) {
    const key = `${review.cardId}:${reviewLocalDay(review)}`;
    const previous = counts.get(key) ?? 0;
    counts.set(key, previous + 1);
    breakdown.push({ review, xp: reviewXpWithFallback(review, previous) });
  }
  return breakdown;
}

export function totalXp(reviews: ReviewLog[]): number {
  return xpBreakdown(reviews).reduce((sum, item) => sum + item.xp, 0);
}

export function xpOnDay(reviews: ReviewLog[], day = new Date()): number {
  const key = localDateKey(day);
  let xp = 0;
  for (const item of xpBreakdown(reviews)) {
    if (reviewLocalDay(item.review) === key) xp += item.xp;
  }
  return xp;
}

function grammarCourseXp(progress?: CourseProgress): number {
  return progress?.events.reduce((sum, event) => sum + Math.max(0, event.xpAwarded), 0) ?? 0;
}

function coachCourseXp(progress?: CourseProgress): number {
  return progress?.coachEvents.reduce((sum, event) => sum + Math.max(0, event.xpAwarded), 0) ?? 0;
}

function pathCourseXp(progress?: CourseProgress): number {
  return progress?.pathEvents.reduce((sum, event) => sum + Math.max(0, event.xpAwarded), 0) ?? 0;
}

export function totalCourseXp(progress?: CourseProgress): number {
  return grammarCourseXp(progress) + coachCourseXp(progress) + pathCourseXp(progress);
}

function completedGrammarLessonCount(progress?: CourseProgress): number {
  if (!progress) return 0;
  const completed = new Set<string>();
  for (const [lessonId, stars] of Object.entries(progress.lessonBestStars)) {
    if (grammarLessonIdSet.has(lessonId) && stars > 0) completed.add(lessonId);
  }
  const correctQuestionIds = new Map<string, Set<string>>();
  for (const event of progress.events) {
    if (!event.correct || !grammarLessonIdSet.has(event.lessonId)) continue;
    const ids = correctQuestionIds.get(event.lessonId) ?? new Set<string>();
    ids.add(event.questionId);
    correctQuestionIds.set(event.lessonId, ids);
  }
  // Every validated Fritz micro-lesson has exactly five questions. This also
  // recognizes completions saved by schema versions predating best-star data.
  for (const [lessonId, questionIds] of correctQuestionIds) {
    if (questionIds.size >= 5) completed.add(lessonId);
  }
  return completed.size;
}

function courseXpInRange(progress: CourseProgress | undefined, start: Date, end: Date): number {
  if (!progress) return 0;
  const startMs = start.getTime();
  const endMs = end.getTime();
  let xp = 0;
  for (const event of progress.events) {
    const answeredAt = Date.parse(event.answeredAt);
    if (answeredAt >= startMs && answeredAt < endMs) xp += Math.max(0, event.xpAwarded);
  }
  for (const event of progress.coachEvents) {
    const completedAt = Date.parse(event.completedAt);
    if (completedAt >= startMs && completedAt < endMs) xp += Math.max(0, event.xpAwarded);
  }
  for (const event of progress.pathEvents) {
    const completedAt = Date.parse(event.completedAt);
    if (completedAt >= startMs && completedAt < endMs) xp += Math.max(0, event.xpAwarded);
  }
  return xp;
}

function activityDayKeys(
  reviews: ReviewLog[],
  course?: CourseProgress,
  reviewStats?: ReviewStats,
): string[] {
  const days = new Set<string>();
  if (reviewStats) {
    for (const day of reviewStats.activityDays) days.add(day);
  } else {
    for (const review of reviews) {
      if (isCountedReview(review)) days.add(reviewLocalDay(review));
    }
  }
  for (const event of course?.events ?? []) days.add(localDateKey(new Date(event.answeredAt)));
  for (const event of course?.coachEvents ?? []) {
    days.add(localDateKey(new Date(event.completedAt)));
  }
  for (const event of course?.pathEvents ?? []) {
    days.add(localDateKey(new Date(event.completedAt)));
  }
  return [...days].toSorted();
}

function currentStreakFromDays(days: string[], now: Date): number {
  const daySet = new Set(days);
  if (daySet.size === 0) return 0;
  const cursor = new Date(now);
  if (!daySet.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (daySet.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function longestStreakFromDays(days: string[]): number {
  let longest = 0;
  let current = 0;
  let previous: Date | undefined;
  for (const key of days) {
    const day = new Date(`${key}T12:00:00`);
    const difference = previous ? Math.round((day.getTime() - previous.getTime()) / 86_400_000) : 1;
    current = difference === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(90 * Math.pow(level - 1, 1.55));
}

function levelTitle(level: number): string {
  if (level >= 35) return 'Sprachprofi';
  if (level >= 20) return 'Plynulost';
  if (level >= 12) return 'Jistota';
  if (level >= 6) return 'Tempo';
  if (level >= 3) return 'Průzkum';
  return 'Rozjezd';
}

export function levelProgress(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.round(xp));
  let level = 1;
  while (level < 99 && xpRequiredForLevel(level + 1) <= safeXp) level += 1;

  const start = xpRequiredForLevel(level);
  const end = xpRequiredForLevel(level + 1);
  const span = Math.max(1, end - start);
  return {
    level,
    title: levelTitle(level),
    totalXp: safeXp,
    currentLevelXp: safeXp - start,
    nextLevelXp: span,
    percent: Math.min(100, Math.round(((safeXp - start) / span) * 100)),
  };
}

export function masteryTier(card: StudyCard): MasteryTier {
  const reps = Number(card.fsrs?.reps ?? 0);
  const stability = Number(card.fsrs?.stability ?? 0);
  if (reps <= 0) return 'new';
  if (reps < 3 || stability < 3) return 'learning';
  if (stability < 14) return 'familiar';
  if (stability < 45 || reps < 5) return 'strong';
  return 'mastered';
}

export function masteryDistribution(cards: StudyCard[]): MasteryDistribution {
  const counts: MasteryDistribution = {
    new: 0,
    learning: 0,
    familiar: 0,
    strong: 0,
    mastered: 0,
  };
  for (const card of cards) counts[masteryTier(card)] += 1;
  return counts;
}

export function masteryLabel(tier: MasteryTier): string {
  if (tier === 'new') return 'Nové';
  if (tier === 'learning') return 'Rozpracované';
  if (tier === 'familiar') return 'Známé';
  if (tier === 'strong') return 'Pevné';
  return 'Zvládnuté';
}

const activeRecallExercises = new Set<ExerciseKind>([
  'typing',
  'word-order',
  'cloze',
  'sentence',
  'speaking',
]);

function isCleanAnswer(review: ReviewLog): boolean {
  return (
    isCountedReview(review) &&
    review.rating !== 'again' &&
    review.signal.wordCorrect &&
    review.signal.articleCorrect &&
    review.signal.hintsUsed === 0 &&
    review.signal.attempt === 1
  );
}

function longestCleanRun(reviews: ReviewLog[], resetAtDayBoundary = false): number {
  let longest = 0;
  let current = 0;
  let previousDay: string | undefined;
  for (const review of reviews.toSorted((left, right) =>
    left.reviewedAt.localeCompare(right.reviewedAt),
  )) {
    if (!isCountedReview(review)) continue;
    const day = reviewLocalDay(review);
    if (resetAtDayBoundary && previousDay && previousDay !== day) current = 0;
    current = isCleanAnswer(review) ? current + 1 : 0;
    longest = Math.max(longest, current);
    previousDay = day;
  }
  return longest;
}

export function dailyMissions(
  reviews: ReviewLog[],
  day = new Date(),
  reviewGoal = 20,
): DailyMission[] {
  const key = localDateKey(day);
  const today = reviews.filter(
    (review) => isCountedReview(review) && reviewLocalDay(review) === key,
  );
  const activeRecall = today.filter(
    (review) => activeRecallExercises.has(review.exercise) && isCleanAnswer(review),
  ).length;
  const cleanRun = longestCleanRun(today);
  const safeReviewGoal = Math.min(200, Math.max(5, Math.round(reviewGoal)));
  const recallGoal = Math.min(10, Math.max(3, Math.ceil(safeReviewGoal * 0.35)));
  const cleanRunGoal = Math.min(6, Math.max(3, Math.ceil(safeReviewGoal * 0.2)));
  return [
    {
      id: 'reviews',
      title: 'Denní dávka',
      description: `Dokonči ${safeReviewGoal} odpovědí.`,
      target: safeReviewGoal,
      progress: Math.min(safeReviewGoal, today.length),
      completed: today.length >= safeReviewGoal,
      rewardXp: DAILY_MISSION_REWARD_XP,
    },
    {
      id: 'recall',
      title: 'Z hlavy a bez pomoci',
      description: `Zvládni ${recallGoal} aktivních odpovědí napoprvé bez nápovědy.`,
      target: recallGoal,
      progress: Math.min(recallGoal, activeRecall),
      completed: activeRecall >= recallGoal,
      rewardXp: DAILY_MISSION_REWARD_XP,
    },
    {
      id: 'perfect',
      title: 'Čistá série',
      description: `Spoj ${cleanRunGoal} správných odpovědí bez nápovědy za sebou.`,
      target: cleanRunGoal,
      progress: Math.min(cleanRunGoal, cleanRun),
      completed: cleanRun >= cleanRunGoal,
      rewardXp: DAILY_MISSION_REWARD_XP,
    },
  ];
}

export function summarizeMissions(missions: DailyMission[]): MissionSummary {
  const completed = missions.filter((mission) => mission.completed).length;
  const total = missions.length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    allCompleted: total > 0 && completed === total,
  };
}

export function missionCompletionBonus(
  reviews: ReviewLog[],
  nextReview: ReviewLog,
  day = new Date(`${reviewLocalDay(nextReview)}T12:00:00`),
  reviewGoal = 20,
): number {
  const before = summarizeMissions(dailyMissions(reviews, day, reviewGoal));
  const after = summarizeMissions(dailyMissions([...reviews, nextReview], day, reviewGoal));
  const newlyCompleted = Math.max(0, after.completed - before.completed);
  const setBonus = after.allCompleted && !before.allCompleted ? DAILY_MISSION_SET_BONUS_XP : 0;
  const dayKey = localDateKey(day);
  let alreadyAwarded = 0;
  for (const review of reviews) {
    if (reviewLocalDay(review) === dayKey) {
      alreadyAwarded += Math.max(0, review.missionBonusAwarded ?? 0);
    }
  }
  return Math.min(
    newlyCompleted * DAILY_MISSION_REWARD_XP + setBonus,
    Math.max(0, DAILY_MISSION_MAX_BONUS_XP - alreadyAwarded),
  );
}

function startOfLocalWeek(value: Date): Date {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

const rivalDefinitions: Array<{
  profile: RivalProfile;
  pace: number;
  curve: number;
}> = [
  {
    profile: { id: 'mila', name: 'Mila', initials: 'MI', style: 'vyrovnané tempo' },
    pace: 0.94,
    curve: 0.9,
  },
  {
    profile: { id: 'konrad', name: 'Konrad', initials: 'KO', style: 'silný finiš' },
    pace: 1,
    curve: 1.18,
  },
  {
    profile: { id: 'nora', name: 'Nora', initials: 'NO', style: 'krátké denní dávky' },
    pace: 0.97,
    curve: 1,
  },
];

function xpInRange(
  breakdown: Array<{ review: ReviewLog; xp: number }>,
  start: Date,
  end: Date,
): number {
  const startDay = localDateKey(start);
  const endDay = localDateKey(end);
  let xp = 0;
  for (const item of breakdown) {
    const reviewDay = reviewLocalDay(item.review);
    if (reviewDay >= startDay && reviewDay < endDay) xp += item.xp;
  }
  return xp;
}

function statsXpInRange(stats: ReviewStats, start: Date, end: Date): number {
  const startDay = localDateKey(start);
  const endDay = localDateKey(end);
  let xp = 0;
  for (const [day, summary] of Object.entries(stats.byDay)) {
    if (day >= startDay && day < endDay) xp += summary.xp;
  }
  return xp;
}

export function weeklyRival(
  reviews: ReviewLog[],
  now = new Date(),
  dailyGoal = 20,
  breakdown = xpBreakdown(reviews),
  course?: CourseProgress,
  reviewStats?: ReviewStats,
): WeeklyRival {
  const weekStart = startOfLocalWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekKey = localDateKey(weekStart);
  const definition = rivalDefinitions[stableHash(weekKey) % rivalDefinitions.length];
  const previousWeeks: number[] = [];

  for (let offset = 1; offset <= 4; offset += 1) {
    const start = new Date(weekStart);
    start.setDate(start.getDate() - offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const xp =
      (reviewStats ? statsXpInRange(reviewStats, start, end) : xpInRange(breakdown, start, end)) +
      courseXpInRange(course, start, end);
    if (xp > 0) previousWeeks.push(xp);
  }

  const safeGoal = Math.min(200, Math.max(5, Math.round(dailyGoal)));
  const defaultBaseline = safeGoal * 8 * 3;
  const baseline =
    previousWeeks.length > 0
      ? previousWeeks.reduce((sum, value) => sum + value, 0) / previousWeeks.length
      : defaultBaseline;
  const targetXp = Math.min(
    3_500,
    Math.max(180, Math.round(((baseline * 0.7 + safeGoal * 8) * definition.pace) / 10) * 10),
  );
  const elapsed = Math.min(
    1,
    Math.max(0, (now.getTime() - weekStart.getTime()) / (weekEnd.getTime() - weekStart.getTime())),
  );
  const rivalXp = Math.min(
    targetXp,
    Math.max(
      0,
      Math.round((targetXp * Math.pow(elapsed, definition.curve) * definition.pace) / 5) * 5,
    ),
  );
  const userXp =
    (reviewStats
      ? statsXpInRange(reviewStats, weekStart, weekEnd)
      : xpInRange(breakdown, weekStart, weekEnd)) + courseXpInRange(course, weekStart, weekEnd);
  const difference = userXp - rivalXp;
  const standing = difference > 0 ? 'leading' : difference < 0 ? 'trailing' : 'tied';
  const scale = Math.max(1, targetXp, userXp, rivalXp);
  const lastDay = new Date(weekEnd);
  lastDay.setDate(lastDay.getDate() - 1);

  return {
    profile: definition.profile,
    weekLabel: `${czechShortDateFormatter.format(weekStart)}–${czechShortDateFormatter.format(lastDay)}`,
    endsAt: weekEnd.toISOString(),
    daysLeft: Math.max(1, Math.ceil((weekEnd.getTime() - now.getTime()) / 86_400_000)),
    userXp,
    rivalXp,
    targetXp,
    userPercent: Math.round((userXp / scale) * 100),
    rivalPercent: Math.round((rivalXp / scale) * 100),
    difference,
    standing,
    message:
      standing === 'leading'
        ? `Vedeš o ${difference} XP.`
        : standing === 'trailing'
          ? `${definition.profile.name} je o ${Math.abs(difference)} XP vpředu.`
          : 'Začínáte nastejno.',
  };
}

export function personalRecords(
  reviews: ReviewLog[],
  breakdown = xpBreakdown(reviews),
  course?: CourseProgress,
  reviewStats?: ReviewStats,
): PersonalRecords {
  const xpByDay = new Map<string, number>();
  if (reviewStats) {
    for (const [key, summary] of Object.entries(reviewStats.byDay)) {
      xpByDay.set(key, summary.xp);
    }
  } else {
    for (const item of breakdown) {
      const key = reviewLocalDay(item.review);
      xpByDay.set(key, (xpByDay.get(key) ?? 0) + item.xp);
    }
  }
  for (const event of course?.events ?? []) {
    const key = localDateKey(new Date(event.answeredAt));
    xpByDay.set(key, (xpByDay.get(key) ?? 0) + Math.max(0, event.xpAwarded));
  }
  for (const event of course?.coachEvents ?? []) {
    const key = localDateKey(new Date(event.completedAt));
    xpByDay.set(key, (xpByDay.get(key) ?? 0) + Math.max(0, event.xpAwarded));
  }
  for (const event of course?.pathEvents ?? []) {
    const key = localDateKey(new Date(event.completedAt));
    xpByDay.set(key, (xpByDay.get(key) ?? 0) + Math.max(0, event.xpAwarded));
  }
  let bestDayKey: string | undefined;
  let bestDayXp = 0;
  for (const [key, xp] of xpByDay) {
    if (bestDayKey === undefined || xp > bestDayXp) {
      bestDayKey = key;
      bestDayXp = xp;
    }
  }
  let unassistedAnswers = reviewStats?.unassistedAnswers;
  if (unassistedAnswers === undefined) {
    unassistedAnswers = 0;
    for (const review of reviews) {
      if (isCleanAnswer(review)) unassistedAnswers += 1;
    }
  }
  return {
    bestDayXp,
    bestDayKey,
    longestCleanRun: reviewStats?.longestCleanRun ?? longestCleanRun(reviews, true),
    unassistedAnswers,
  };
}

function longestStreak(reviews: ReviewLog[], course?: CourseProgress): number {
  return longestStreakFromDays(activityDayKeys(reviews, course));
}

export function achievements(
  reviews: ReviewLog[],
  cards: StudyCard[],
  xp = totalXp(reviews),
  records = personalRecords(reviews),
  course?: CourseProgress,
  reviewStats?: ReviewStats,
  mastery = masteryDistribution(cards),
): Achievement[] {
  const countedReviews = reviews.filter(isCountedReview);
  const typing =
    reviewStats?.typingAnswers ??
    countedReviews.filter(
      (review) =>
        review.exercise === 'typing' ||
        review.exercise === 'cloze' ||
        review.exercise === 'sentence',
    ).length;
  const streak = reviewStats
    ? longestStreakFromDays(activityDayKeys(countedReviews, course, reviewStats))
    : longestStreak(countedReviews, course);
  const mastered = mastery.mastered;
  const completedGrammarLessons = completedGrammarLessonCount(course);
  const allAnswers =
    (reviewStats?.countedReviews ?? countedReviews.length) +
    (course?.events.length ?? 0) +
    (course?.coachEvents.reduce((sum, session) => sum + session.turns, 0) ?? 0) +
    (course?.pathEvents.length ?? 0);
  const definitions = [
    ['first', 'První krok', 'Dokonči první odpověď.', allAnswers, 1],
    [
      'clean-25',
      'Bez berliček',
      'Zvládni 25 odpovědí napoprvé bez nápovědy.',
      records.unassistedAnswers,
      25,
    ],
    ['run-10', 'Čistá desítka', 'Spoj 10 čistých odpovědí v řadě.', records.longestCleanRun, 10],
    ['typing-100', 'Klávesnice v tempu', 'Napiš 100 německých odpovědí.', typing, 100],
    [
      'reviews-500',
      'Vytrvalost',
      'Dokonči 500 opakování.',
      reviewStats?.countedReviews ?? countedReviews.length,
      500,
    ],
    ['streak-7', 'Týden v rytmu', 'Uč se sedm dní po sobě.', streak, 7],
    ['streak-30', 'Měsíc v rytmu', 'Uč se třicet dní po sobě.', streak, 30],
    ['grammar-5', 'Gramatický základ', 'Dokonči 5 lekcí gramatiky.', completedGrammarLessons, 5],
    [
      'coach-5',
      'Mluvím, i když se učím',
      'Dokonči 5 AI konverzačních misí.',
      course?.coachEvents.length ?? 0,
      5,
    ],
    ['xp-1000', 'Tisíc XP', 'Získej 1 000 zkušenostních bodů.', xp, 1_000],
    ['xp-2000', 'Dva tisíce XP', 'Odemkni osobní odměnu za 2 000 XP.', xp, 2_000],
    ['mastered-10', 'Pevná desítka', 'Dostaň 10 karet do pevné paměti.', mastered, 10],
  ] as const;

  return definitions.map(([id, title, description, progress, target]) => ({
    id,
    title,
    description,
    progress: Math.min(progress, target),
    target,
    unlocked: progress >= target,
  }));
}

export function gamificationSummary(
  reviews: ReviewLog[],
  cards: StudyCard[],
  now = new Date(),
  dailyGoal = 20,
  course?: CourseProgress,
  reviewStats?: ReviewStats,
): GamificationSummary {
  const countedReviews = reviews.filter(isCountedReview);
  const breakdown = reviewStats ? [] : xpBreakdown(countedReviews);
  const reviewXp = reviewStats?.reviewXp ?? breakdown.reduce((sum, item) => sum + item.xp, 0);
  const grammarXp = grammarCourseXp(course);
  const coachXp = coachCourseXp(course);
  const pathXp = pathCourseXp(course);
  const xp = reviewXp + grammarXp + coachXp + pathXp;
  const missions = dailyMissions(countedReviews, now, dailyGoal);
  const records = personalRecords(countedReviews, breakdown, course, reviewStats);
  const mastery = masteryDistribution(cards);
  const achievementList = achievements(
    countedReviews,
    cards,
    xp,
    records,
    course,
    reviewStats,
    mastery,
  );
  let nextAchievement: Achievement | undefined;
  let nextAchievementProgress = -1;
  for (const achievement of achievementList) {
    if (achievement.unlocked) continue;
    const progress = achievement.progress / Math.max(1, achievement.target);
    if (progress > nextAchievementProgress) {
      nextAchievement = achievement;
      nextAchievementProgress = progress;
    }
  }
  const dayKey = localDateKey(now);
  let todayReviewXp = reviewStats?.byDay[dayKey]?.xp;
  if (todayReviewXp === undefined) {
    todayReviewXp = 0;
    for (const item of breakdown) {
      if (reviewLocalDay(item.review) === dayKey) todayReviewXp += item.xp;
    }
  }
  let todayGrammarXp = 0;
  for (const event of course?.events ?? []) {
    if (localDateKey(new Date(event.answeredAt)) === dayKey) {
      todayGrammarXp += Math.max(0, event.xpAwarded);
    }
  }
  let todayCoachXp = 0;
  for (const event of course?.coachEvents ?? []) {
    if (localDateKey(new Date(event.completedAt)) === dayKey) {
      todayCoachXp += Math.max(0, event.xpAwarded);
    }
  }
  let todayPathXp = 0;
  for (const event of course?.pathEvents ?? []) {
    if (localDateKey(new Date(event.completedAt)) === dayKey) {
      todayPathXp += Math.max(0, event.xpAwarded);
    }
  }
  const days = activityDayKeys(countedReviews, course, reviewStats);
  const completedGrammarLessons = completedGrammarLessonCount(course);
  const rewardTarget = 2_000 as const;

  return {
    totalXp: xp,
    todayXp: todayReviewXp + todayGrammarXp + todayCoachXp + todayPathXp,
    level: levelProgress(xp),
    streak: course ? currentStreakFromDays(days, now) : streakDays(countedReviews, now),
    longestStreak: longestStreakFromDays(days),
    missions,
    missionSummary: summarizeMissions(missions),
    rival: weeklyRival(countedReviews, now, dailyGoal, breakdown, course, reviewStats),
    records,
    achievements: achievementList,
    nextAchievement,
    masteredCards: mastery.mastered,
    reviewXp,
    grammarXp,
    coachXp,
    pathXp,
    coachSessions: course?.coachEvents.length ?? 0,
    completedGrammarLessons,
    reward: {
      id: 'xp-2000',
      target: rewardTarget,
      progress: Math.min(rewardTarget, xp),
      percent: Math.min(100, Math.round((xp / rewardTarget) * 100)),
      unlocked: xp >= rewardTarget,
      claimed: course?.claimedRewards.includes('xp-2000') ?? false,
    },
  };
}
