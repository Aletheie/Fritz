import assert from 'node:assert/strict';
import test from 'node:test';

import { cardReturnReason } from '../src/lib/domain/study/return-reason.ts';

import type { ReviewLog } from '../src/lib/domain/types.ts';

const now = new Date('2026-10-11T12:00:00.000Z');

function review(overrides: Partial<ReviewLog>): ReviewLog {
  return {
    id: overrides.id ?? 'r',
    cardId: 'card',
    noteId: 'note',
    deckId: 'deck',
    reviewedAt: '2026-10-08T12:00:00.000Z',
    mode: 'long-term',
    exercise: 'typing',
    rating: 'good',
    signal: {
      exercise: 'typing',
      wordCorrect: true,
      articleCorrect: true,
      exact: true,
      keyboardEquivalent: false,
      editDistance: 0,
      responseMs: 1_000,
      hintsUsed: 0,
      attempt: 1,
    },
    ...overrides,
  } as ReviewLog;
}

test('nová karta nemá důvod návratu', () => {
  assert.equal(cardReturnReason([], 'card', now, 'cs'), undefined);
  assert.equal(cardReturnReason([review({ cardId: 'other' })], 'card', now, 'cs'), undefined);
});

test('důvod vychází z poslední započítané odpovědi a jejích chyb', () => {
  const reviews = [
    review({ id: 'old', reviewedAt: '2026-10-01T12:00:00.000Z', rating: 'good' }),
    review({ id: 'new', rating: 'again', mistakeTags: ['article', 'article', 'unknown'] }),
    review({
      id: 'disputed',
      reviewedAt: '2026-10-10T12:00:00.000Z',
      rating: 'good',
      excludedFromLearning: true,
    }),
  ];
  assert.equal(cardReturnReason(reviews, 'card', now, 'cs'), 'Minulá chyba: člen.');
  assert.equal(cardReturnReason(reviews, 'card', now, 'en'), 'Last mistake: article.');
});

test('těžká a úspěšná odpověď mají vlastní vysvětlení', () => {
  const hinted = review({ rating: 'hard', signal: { ...review({}).signal, hintsUsed: 1 } });
  assert.equal(cardReturnReason([hinted], 'card', now, 'cs'), 'Minule to šlo jen s nápovědou.');
  assert.match(cardReturnReason([review({})], 'card', now, 'cs') ?? '', /po 3 dnech/u);
  assert.match(cardReturnReason([review({})], 'card', now, 'en') ?? '', /after 3 days/u);
});
