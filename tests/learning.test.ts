import assert from 'node:assert/strict';
import test from 'node:test';

import {
  newCardsStudiedOnDay,
  remainingDailyNewCards,
  uniqueNotesReviewedOnDay,
} from '../src/lib/domain/stats/learning.ts';

import type { ReviewLog } from '../src/lib/domain/types.ts';

function review(
  cardId: string,
  reviewedAt: string,
  options: { mode?: ReviewLog['mode']; scheduled?: boolean; localDay?: string } = {},
): ReviewLog {
  return {
    id: `review-${cardId}-${reviewedAt}`,
    cardId,
    noteId: `note-${cardId}`,
    deckId: 'deck',
    reviewedAt,
    localDay: options.localDay,
    mode: options.mode ?? 'long-term',
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
    scheduleBefore: options.scheduled ? { reps: 2 } : undefined,
  };
}

test('denní limit nových karet počítá jen první dlouhodobé opakování každé karty', () => {
  const now = new Date('2026-08-03T12:00:00.000Z');
  const reviews = [
    review('new-a', '2026-08-03T09:00:00.000Z'),
    review('new-a', '2026-08-03T09:10:00.000Z'),
    review('new-b', '2026-08-03T10:00:00.000Z'),
    review('known', '2026-08-03T11:00:00.000Z', { scheduled: true }),
    review('cram-new', '2026-08-03T11:30:00.000Z', { mode: 'cram' }),
  ];

  assert.equal(newCardsStudiedOnDay(reviews, now), 2);
  assert.equal(remainingDailyNewCards(reviews, 5, now), 3);
});

test('denní slovní blok počítá různá slovíčka, ne opakované pokusy', () => {
  const now = new Date('2026-08-03T12:00:00.000Z');
  const reviews = [
    review('same-word', '2026-08-03T09:00:00.000Z'),
    review('same-word', '2026-08-03T09:03:00.000Z', { mode: 'cram' }),
    review('different-word', '2026-08-03T09:06:00.000Z'),
  ];

  assert.equal(uniqueNotesReviewedOnDay(reviews, now), 2);
});

test('denní statistiky používají den zachycený při review i po změně časového pásma', () => {
  const reviewWithCapturedDay = review('timezone', '2026-08-04T12:00:00.000Z', {
    localDay: '2026-08-03',
  });

  assert.equal(
    newCardsStudiedOnDay([reviewWithCapturedDay], new Date('2026-08-03T12:00:00.000Z')),
    1,
  );
  assert.equal(
    newCardsStudiedOnDay([reviewWithCapturedDay], new Date('2026-08-04T12:00:00.000Z')),
    0,
  );
});
