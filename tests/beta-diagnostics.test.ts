import assert from 'node:assert/strict';
import test from 'node:test';

import { createBetaDiagnostics } from '../src/lib/domain/beta-diagnostics.ts';
import { createCourseProgress } from '../src/lib/domain/course/grammar.ts';
import { createDefaultSettings } from '../src/lib/domain/settings/defaults.ts';
import { deriveReviewStats } from '../src/lib/domain/stats/review-stats.ts';

import type { ReviewLog } from '../src/lib/domain/types.ts';

const review: ReviewLog = {
  id: 'review-private',
  cardId: 'card-private',
  noteId: 'note_seed_1',
  deckId: 'deck-private',
  reviewedAt: '2026-08-20T10:00:00.000Z',
  localDay: '2026-08-20',
  mode: 'long-term',
  exercise: 'typing',
  rating: 'good',
  signal: {
    submittedText: 'soukromá odpověď',
    expectedText: 'tajný obsah',
    exercise: 'typing',
    wordCorrect: true,
    articleCorrect: true,
    exact: true,
    keyboardEquivalent: false,
    editDistance: 0,
    responseMs: 2_500,
    hintsUsed: 0,
    attempt: 1,
  },
  disputeReason: 'content-error',
  excludedFromLearning: true,
};

test('beta diagnostika agreguje aktivaci a nikdy neexportuje odpovědi ani profil', () => {
  const settings = { ...createDefaultSettings(), profileName: 'Soukromé jméno' };
  const report = createBetaDiagnostics({
    appVersion: '0.1.0',
    databaseVersion: 8,
    generatedAt: new Date('2026-08-26T12:00:00.000Z'),
    counts: { decks: 1, notes: 1, cards: 2 },
    settings,
    reviewStats: deriveReviewStats([review]),
    recentReviews: [review],
    learningEvidence: [],
    dailySessions: [
      {
        key: 'daily-1',
        schemaVersion: 2,
        plan: {
          id: 'plan-1',
          schemaVersion: 2,
          localDay: '2026-08-20',
          minutes: 10,
          learningGoal: 'school',
          generatedAt: '2026-08-20T09:00:00.000Z',
          estimatedSeconds: 600,
          activities: [],
        },
        cursor: 1,
        completedActivityIds: [],
        evidenceIds: [],
        startedAt: '2026-08-20T09:00:00.000Z',
        updatedAt: '2026-08-20T09:05:00.000Z',
      },
      {
        key: 'daily-2',
        schemaVersion: 2,
        plan: {
          id: 'plan-2',
          schemaVersion: 2,
          localDay: '2026-08-22',
          minutes: 10,
          learningGoal: 'school',
          generatedAt: '2026-08-22T09:00:00.000Z',
          estimatedSeconds: 600,
          activities: [],
        },
        cursor: 1,
        completedActivityIds: [],
        evidenceIds: [],
        startedAt: '2026-08-22T09:00:00.000Z',
        completedAt: '2026-08-22T09:05:00.000Z',
        updatedAt: '2026-08-22T09:05:00.000Z',
      },
    ],
    course: createCourseProgress(new Date('2026-08-20T00:00:00.000Z')),
    notes: [{ id: 'note_seed_1', source: 'seed' }],
  });

  assert.deepEqual(report.retention.activeDays, {
    activeDays: 2,
    day2: false,
    day3: true,
    day7: false,
  });
  assert.equal(report.retention.dailyLessons.started, 2);
  assert.equal(report.retention.dailyLessons.completed, 1);
  assert.deepEqual(report.contentIssues, [
    { source: 'seed', exercise: 'typing', reference: 'note_seed_1', count: 1 },
  ]);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /Soukromé jméno|soukromá odpověď|tajný obsah/u);
  assert.match(serialized, /fritz-beta-diagnostics/u);
});

test('beta diagnostika nesdílí identifikátor vlastního slovíčka', () => {
  const privateReview = { ...review, noteId: 'private-note-uuid' };
  const report = createBetaDiagnostics({
    appVersion: '0.1.0',
    databaseVersion: 8,
    counts: { decks: 1, notes: 1, cards: 1 },
    settings: createDefaultSettings(),
    reviewStats: deriveReviewStats([privateReview]),
    recentReviews: [privateReview],
    learningEvidence: [],
    dailySessions: [],
    course: createCourseProgress(),
    notes: [{ id: 'private-note-uuid', source: 'manual' }],
  });

  assert.equal(report.contentIssues[0]?.reference, undefined);
  assert.doesNotMatch(JSON.stringify(report), /private-note-uuid/u);
});
