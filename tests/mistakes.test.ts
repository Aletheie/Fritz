import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateMistakes,
  buildWeeklyLearningReport,
  classifyMistakes,
} from '../src/lib/domain/learning/mistakes.ts';
import type { AnswerSignal, Note, ReviewLog } from '../src/lib/domain/types.ts';

const note: Note = {
  id: 'note-1',
  deckId: 'deck-1',
  german: 'aufstehen',
  normalizedGerman: 'aufstehen',
  czech: 'vstát',
  kind: 'verb',
  acceptedGerman: [],
  acceptedCzech: [],
  tags: [],
  verbForms: {
    thirdPerson: 'steht auf',
    preterite: 'stand auf',
    participle: 'aufgestanden',
    auxiliary: 'sein',
  },
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function signal(overrides: Partial<AnswerSignal> = {}): AnswerSignal {
  return {
    exercise: 'typing',
    submittedText: 'stehen',
    expectedText: 'aufstehen',
    wordCorrect: false,
    articleCorrect: true,
    exact: false,
    keyboardEquivalent: false,
    editDistance: 3,
    responseMs: 4_000,
    hintsUsed: 0,
    attempt: 1,
    ...overrides,
  };
}

test('mistake taxonomy classifies article, spelling, prefix, meaning and fluency deterministically', () => {
  assert.deepEqual(
    classifyMistakes({ signal: signal({ articleCorrect: false, editDistance: 1 }), note }),
    ['article', 'gender', 'spelling', 'separable-prefix'],
  );
  assert.deepEqual(classifyMistakes({ signal: signal(), note }), ['separable-prefix']);
  assert.deepEqual(
    classifyMistakes({ signal: signal({ exercise: 'choice', editDistance: 5 }), note }),
    ['meaning', 'separable-prefix'],
  );
  assert.deepEqual(
    classifyMistakes({
      signal: signal({ wordCorrect: true, exact: true, responseMs: 20_000 }),
      note,
    }),
    ['fluency'],
  );
});

test('weekly report stores only structured clusters and keeps cram separate from long-term work', () => {
  const base = {
    id: 'review-1',
    operationId: 'op-1',
    cardId: 'card-1',
    noteId: 'note-1',
    deckId: 'deck-1',
    reviewedAt: '2026-08-06T10:00:00.000Z',
    localDay: '2026-08-06',
    exercise: 'typing' as const,
    rating: 'again' as const,
    signal: signal(),
    mistakeTags: ['separable-prefix' as const],
  };
  const reviews: ReviewLog[] = [
    { ...base, mode: 'long-term' },
    { ...base, id: 'review-2', operationId: 'op-2', mode: 'cram', mistakeTags: ['article'] },
    {
      ...base,
      id: 'review-3',
      operationId: 'op-3',
      mode: 'long-term',
      excludedFromLearning: true,
      mistakeTags: ['article'],
    },
  ];
  assert.equal(aggregateMistakes(reviews)[0].count, 1);
  const report = buildWeeklyLearningReport(reviews, new Date('2026-08-07T12:00:00.000Z'));
  assert.equal(report.totalReviews, 2);
  assert.equal(report.longTermReviews, 1);
  assert.equal(report.cramReviews, 1);
  assert.equal(report.activeDays, 1);
  assert.equal(report.recommendations.length, 2);
});
