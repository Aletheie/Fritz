import assert from 'node:assert/strict';
import test from 'node:test';

import { createCourseProgress } from '../src/lib/domain/course/grammar.ts';
import { completeCoursePathNode, currentCoursePathNode } from '../src/lib/domain/course/path.ts';
import {
  calculateReviewXp,
  dailyMissions,
  gamificationSummary,
  levelProgress,
  masteryTier,
  missionCompletionBonus,
  personalRecords,
  summarizeMissions,
  totalXp,
  weeklyRival,
  xpRequiredForLevel,
} from '../src/lib/domain/gamification.ts';
import { appendReviewStats, deriveReviewStats } from '../src/lib/domain/stats/review-stats.ts';

import type {
  AnswerSignal,
  ExerciseKind,
  RatingKey,
  ReviewLog,
  StudyCard,
  StudyMode,
} from '../src/lib/domain/types.ts';

function signal(exercise: ExerciseKind, overrides: Partial<AnswerSignal> = {}): AnswerSignal {
  return {
    exercise,
    wordCorrect: true,
    articleCorrect: true,
    exact: true,
    keyboardEquivalent: false,
    editDistance: 0,
    responseMs: 1_500,
    hintsUsed: 0,
    attempt: 1,
    ...overrides,
  };
}

function review(options: {
  id: string;
  cardId?: string;
  noteId?: string;
  reviewedAt: string;
  localDay?: string;
  exercise?: ExerciseKind;
  rating?: RatingKey;
  mode?: StudyMode;
  xpAwarded?: number;
  signal?: Partial<AnswerSignal>;
  excludedFromLearning?: boolean;
}): ReviewLog {
  const exercise = options.exercise ?? 'typing';
  return {
    id: options.id,
    cardId: options.cardId ?? `card-${options.id}`,
    noteId: options.noteId ?? `note-${options.id}`,
    deckId: 'deck',
    reviewedAt: options.reviewedAt,
    localDay: options.localDay,
    mode: options.mode ?? 'long-term',
    exercise,
    rating: options.rating ?? 'good',
    signal: signal(exercise, {
      wordCorrect: options.rating !== 'again',
      articleCorrect: options.rating !== 'again',
      exact: options.rating !== 'again',
      ...options.signal,
    }),
    xpAwarded: options.xpAwarded,
    excludedFromLearning: options.excludedFromLearning,
  };
}

function card(id: string, fsrs?: Record<string, unknown>): StudyCard {
  return {
    id,
    deckId: 'deck',
    noteId: `note-${id}`,
    direction: 'cs-de',
    dueAt: '2026-08-05T12:00:00.000Z',
    fsrs,
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-04T12:00:00.000Z',
  };
}

test('psaní má větší XP hodnotu než výběr a flashcard', () => {
  const typing = calculateReviewXp({
    exercise: 'typing',
    rating: 'good',
    mode: 'long-term',
    signal: signal('typing'),
  });
  const choice = calculateReviewXp({
    exercise: 'choice',
    rating: 'good',
    mode: 'long-term',
    signal: signal('choice'),
  });
  const flashcard = calculateReviewXp({
    exercise: 'flashcard',
    rating: 'good',
    mode: 'long-term',
    signal: signal('flashcard'),
  });

  assert.equal(typing, 12);
  assert.equal(choice, 8);
  assert.equal(flashcard, 5);
});

test('sprint, nápověda a opakované pokusy snižují XP', () => {
  const full = calculateReviewXp({
    exercise: 'typing',
    rating: 'good',
    mode: 'long-term',
    signal: signal('typing'),
  });
  const assistedCram = calculateReviewXp({
    exercise: 'typing',
    rating: 'good',
    mode: 'cram',
    signal: signal('typing', { hintsUsed: 1, attempt: 2 }),
  });
  const farmed = calculateReviewXp(
    {
      exercise: 'typing',
      rating: 'easy',
      mode: 'cram',
      signal: signal('typing'),
    },
    4,
  );

  assert.ok(assistedCram < full);
  assert.equal(farmed, 1);
});

test('uložené XP mají přednost a starší review se dopočítá', () => {
  const reviews = [
    review({ id: 'stored', reviewedAt: '2026-08-04T08:00:00.000Z', xpAwarded: 3 }),
    review({ id: 'legacy', reviewedAt: '2026-08-04T09:00:00.000Z' }),
  ];
  assert.equal(totalXp(reviews), 15);
});

test('reklamované hodnocení nepřidá XP ani denní misi', () => {
  const disputed = review({
    id: 'disputed',
    reviewedAt: '2026-08-04T08:00:00.000Z',
    xpAwarded: 20,
    excludedFromLearning: true,
  });
  assert.equal(totalXp([disputed]), 0);
  assert.equal(dailyMissions([disputed], new Date('2026-08-04T12:00:00.000Z'), 5)[0].progress, 0);
});

test('úrovně jsou monotónní a procento zůstává v rozsahu', () => {
  assert.equal(xpRequiredForLevel(1), 0);
  assert.ok(xpRequiredForLevel(8) > xpRequiredForLevel(7));

  const progress = levelProgress(xpRequiredForLevel(7));
  assert.equal(progress.level, 7);
  assert.equal(progress.currentLevelXp, 0);
  assert.equal(progress.percent, 0);
  assert.ok(progress.nextLevelXp > 0);
});

test('mastery vychází z historie FSRS, ne z XP', () => {
  assert.equal(masteryTier(card('new')), 'new');
  assert.equal(masteryTier(card('learning', { reps: 2, stability: 2 })), 'learning');
  assert.equal(masteryTier(card('familiar', { reps: 4, stability: 8 })), 'familiar');
  assert.equal(masteryTier(card('strong', { reps: 6, stability: 30 })), 'strong');
  assert.equal(masteryTier(card('mastered', { reps: 7, stability: 55 })), 'mastered');
});

test('denní mise odměňují aktivní vybavení a čistou sérii', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');
  const reviews = [
    review({
      id: 'one',
      reviewedAt: '2026-08-04T08:00:00.000Z',
    }),
    review({
      id: 'two',
      reviewedAt: '2026-08-04T08:01:00.000Z',
      exercise: 'cloze',
    }),
    review({ id: 'fail', reviewedAt: '2026-08-04T08:02:00.000Z', rating: 'again' }),
    review({ id: 'three', reviewedAt: '2026-08-04T08:03:00.000Z' }),
    review({ id: 'four', reviewedAt: '2026-08-04T08:04:00.000Z', exercise: 'sentence' }),
  ];

  const missions = dailyMissions(reviews, now, 10);
  const recall = missions.find((mission) => mission.id === 'recall');
  const perfect = missions.find((mission) => mission.id === 'perfect');
  assert.equal(recall?.progress, 4);
  assert.equal(recall?.completed, true);
  assert.equal(perfect?.progress, 2);
  assert.equal(perfect?.completed, false);
  assert.deepEqual(summarizeMissions(missions), {
    completed: 1,
    total: 3,
    percent: 33,
    allCompleted: false,
  });
});

test('denní mise respektuje nastavený denní cíl', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');
  const missions = dailyMissions([], now, 12);
  const daily = missions.find((mission) => mission.id === 'reviews');
  const recall = missions.find((mission) => mission.id === 'recall');
  const perfect = missions.find((mission) => mission.id === 'perfect');

  assert.equal(daily?.target, 12);
  assert.equal(daily?.description, 'Dokonči 12 odpovědí.');
  assert.equal(recall?.target, 5);
  assert.equal(perfect?.target, 3);
});

test('poslední denní mise udělí jednorázový setový XP bonus', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');
  const existing = Array.from({ length: 4 }, (_, index) =>
    review({
      id: `existing-${index}`,
      reviewedAt: `2026-08-04T08:0${index}:00.000Z`,
    }),
  );
  const finishing = review({ id: 'finishing', reviewedAt: '2026-08-04T08:05:00.000Z' });

  assert.equal(missionCompletionBonus(existing, finishing, now, 5), 20);
  assert.equal(
    missionCompletionBonus(
      [...existing, finishing],
      review({
        id: 'extra',
        reviewedAt: '2026-08-04T08:06:00.000Z',
      }),
      now,
      5,
    ),
    0,
  );
});

test('soukromý rival je deterministický a přizpůsobuje cíl historii', () => {
  const now = new Date('2026-08-05T12:00:00.000Z');
  const reviews = [
    review({ id: 'current', reviewedAt: '2026-08-04T08:00:00.000Z', xpAwarded: 40 }),
    review({ id: 'previous', reviewedAt: '2026-07-29T08:00:00.000Z', xpAwarded: 80 }),
  ];
  const first = weeklyRival(reviews, now, 20);
  const second = weeklyRival(reviews, now, 20);

  assert.deepEqual(first, second);
  assert.equal(first.userXp, 40);
  assert.ok(first.targetXp >= 180);
  assert.ok(first.rivalXp > 0);
  assert.ok(first.userPercent >= 0 && first.userPercent <= 100);
});

test('osobní rekordy počítají nejlepší den a čistou sérii', () => {
  const reviews = [
    review({ id: 'one', reviewedAt: '2026-08-03T08:00:00.000Z', xpAwarded: 10 }),
    review({ id: 'two', reviewedAt: '2026-08-03T08:01:00.000Z', xpAwarded: 12 }),
    review({ id: 'three', reviewedAt: '2026-08-04T08:00:00.000Z', xpAwarded: 8 }),
    review({
      id: 'hinted',
      reviewedAt: '2026-08-04T08:01:00.000Z',
      xpAwarded: 4,
      signal: { hintsUsed: 1 },
    }),
  ];
  const records = personalRecords(reviews);
  assert.equal(records.bestDayXp, 22);
  assert.equal(records.bestDayKey, '2026-08-03');
  assert.equal(records.longestCleanRun, 2);
  assert.equal(records.unassistedAnswers, 3);
});

test('souhrn počítá aktuální i nejdelší sérii', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');
  const reviews = [
    review({ id: 'one', reviewedAt: '2026-08-01T12:00:00.000Z' }),
    review({ id: 'two', reviewedAt: '2026-08-02T12:00:00.000Z' }),
    review({ id: 'three', reviewedAt: '2026-08-03T12:00:00.000Z' }),
    review({ id: 'four', reviewedAt: '2026-08-04T12:00:00.000Z' }),
  ];

  const summary = gamificationSummary(reviews, [card('mastered', { reps: 7, stability: 55 })], now);
  assert.equal(summary.streak, 4);
  assert.equal(summary.longestStreak, 4);
  assert.equal(summary.masteredCards, 1);
  assert.equal(summary.missionSummary.total, 3);
  assert.ok(summary.rival.targetXp >= 180);
});

test('projekce historie zachová přesné celoživotní statistiky s omezeným výřezem review', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');
  const history = [
    review({ id: 'old-one', reviewedAt: '2026-08-01T08:00:00.000Z', xpAwarded: 10 }),
    review({ id: 'old-two', reviewedAt: '2026-08-02T08:00:00.000Z', xpAwarded: 12 }),
    review({ id: 'recent', reviewedAt: '2026-08-04T08:00:00.000Z', xpAwarded: 14 }),
  ];
  const projected = deriveReviewStats(history, now);
  const full = gamificationSummary(history, [], now);
  const bounded = gamificationSummary([history[2]], [], now, 20, undefined, projected);

  assert.equal(bounded.totalXp, full.totalXp);
  assert.equal(bounded.todayXp, full.todayXp);
  assert.equal(bounded.streak, full.streak);
  assert.equal(bounded.longestStreak, full.longestStreak);
  assert.deepEqual(bounded.records, full.records);
  assert.equal(
    bounded.achievements.find((item) => item.id === 'reviews-500')?.progress,
    history.length,
  );
});

test('přírůstková projekce odpovídá úplnému přepočtu', () => {
  const history = [
    review({ id: 'one', reviewedAt: '2026-08-03T08:00:00.000Z', xpAwarded: 10 }),
    review({
      id: 'two',
      reviewedAt: '2026-08-03T08:01:00.000Z',
      exercise: 'sentence',
      xpAwarded: 15,
    }),
    review({
      id: 'miss',
      reviewedAt: '2026-08-04T08:00:00.000Z',
      rating: 'again',
      xpAwarded: 2,
    }),
  ];
  let projected = deriveReviewStats(history.slice(0, 1));
  for (const next of history.slice(1)) projected = appendReviewStats(projected, next);

  assert.deepEqual(
    { ...projected, updatedAt: '' },
    { ...deriveReviewStats(history), updatedAt: '' },
  );
});

test('mise, denní XP a série respektují zachycený lokální den review', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');
  const reviews = [
    review({
      id: 'captured-yesterday',
      reviewedAt: '2026-08-04T12:00:00.000Z',
      localDay: '2026-08-03',
      xpAwarded: 9,
    }),
    review({
      id: 'captured-today',
      reviewedAt: '2026-08-03T12:00:00.000Z',
      localDay: '2026-08-04',
      xpAwarded: 11,
    }),
  ];

  const summary = gamificationSummary(reviews, [], now, 5);
  assert.equal(summary.todayXp, 11);
  assert.equal(summary.missions.find((mission) => mission.id === 'reviews')?.progress, 1);
  assert.equal(summary.streak, 2);
  assert.equal(summary.records.bestDayKey, '2026-08-04');
});

test('kurzová cesta se započítá do XP, dnešního postupu a série, ne do mastery', () => {
  const now = new Date('2026-08-06T12:00:00.000Z');
  const progress = createCourseProgress(now);
  const node = currentCoursePathNode(progress, 'A1.1');
  assert.ok(node);
  const completed = completeCoursePathNode(progress, node.id, 2, now).progress;
  const cards = [card('still-new')];
  const summary = gamificationSummary([], cards, now, 20, completed);

  assert.equal(summary.reviewXp, 0);
  assert.equal(summary.pathXp, node.xp);
  assert.equal(summary.totalXp, node.xp);
  assert.equal(summary.todayXp, node.xp);
  assert.equal(summary.streak, 1);
  assert.equal(summary.masteredCards, 0);
});

test('souhrn zachová dokončenou gramatiku ze starých dat bez hvězd', () => {
  const now = new Date('2026-08-06T12:00:00.000Z');
  const progress = createCourseProgress(now);
  progress.events = ['v2-1', 'v2-2', 'v2-3', 'v2-4', 'v2-5'].map((questionId, index) => ({
    id: `legacy-answer-${index}`,
    lessonId: 'verb-second-position',
    questionId,
    answeredAt: now.toISOString(),
    correct: true,
    firstTry: true,
    xpAwarded: 0,
    responseMs: 1_000,
  }));

  const summary = gamificationSummary([], [], now, 20, progress);
  assert.equal(summary.completedGrammarLessons, 1);
  assert.equal(summary.achievements.find((item) => item.id === 'grammar-5')?.progress, 1);
});
