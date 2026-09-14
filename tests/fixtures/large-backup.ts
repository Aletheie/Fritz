import { createSeedData } from '../../src/lib/data/seed.ts';
import { createCourseProgress } from '../../src/lib/domain/course/grammar.ts';

import type { AppBackup } from '../../src/lib/domain/types.ts';

export function backupWithLongHistory(): AppBackup {
  const now = new Date('2026-08-07T12:00:00.000Z');
  const seed = createSeedData(now);
  const card = seed.cards[0];
  return {
    schemaVersion: 8,
    exportedAt: now.toISOString(),
    decks: [seed.deck],
    notes: seed.notes,
    cards: seed.cards,
    reviews: Array.from({ length: 1_000 }, (_, index) => ({
      id: `large-backup-review-${index}`,
      operationId: `large-backup-operation-${index}`,
      cardId: card.id,
      noteId: card.noteId,
      deckId: card.deckId,
      reviewedAt: now.toISOString(),
      mode: 'long-term',
      exercise: 'sentence',
      rating: 'again',
      xpAwarded: 0,
      signal: {
        exercise: 'sentence',
        submittedText: 'Ich übe Deutsch. '.repeat(500),
        expectedText: 'Ich lerne Deutsch.',
        wordCorrect: false,
        articleCorrect: true,
        exact: false,
        keyboardEquivalent: false,
        editDistance: 10,
        responseMs: 1_200,
        hintsUsed: 0,
        attempt: 1,
      },
    })),
    learningEvidence: [],
    settings: { ...seed.settings, onboardingCompleted: true },
    course: createCourseProgress(now),
  };
}
