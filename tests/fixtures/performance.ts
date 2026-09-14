import { createSeedData } from '../../src/lib/data/seed.ts';
import { createCourseProgress } from '../../src/lib/domain/course/course-progress.ts';
import { learningEvidenceFromReview } from '../../src/lib/domain/learning/evidence.ts';
import { scheduleReview } from '../../src/lib/domain/scheduler/fsrs.ts';
import { localDateKey } from '../../src/lib/domain/stats/learning.ts';

import type { AnswerSignal, AppBackup, Note, ReviewLog } from '../../src/lib/domain/types.ts';

export function performanceSignal(correct = true): AnswerSignal {
  return {
    exercise: 'typing',
    submittedText: correct ? 'Hund' : 'Hunt',
    expectedText: 'Hund',
    wordCorrect: correct,
    articleCorrect: true,
    exact: correct,
    keyboardEquivalent: false,
    editDistance: correct ? 0 : 1,
    responseMs: 800,
    hintsUsed: 0,
    attempt: 1,
  };
}

// Stable IDs, varied words/tags, two card directions, new/due/future cards,
// recent/old/disputed/cram reviews, and a hot word with 10% of all history.
// Dates are relative to the recorded run date so the 31-day window stays exercised.
export function createPerformanceFixture(
  noteCount: number,
  reviewCount: number,
  now = new Date(),
): AppBackup {
  const seed = createSeedData(now);
  const dayMs = 86_400_000;
  const old = new Date(now.getTime() - 400 * dayMs);
  const scheduled = scheduleReview(seed.cards[0], 'good', 0.9, old).after;
  const notes: Note[] = Array.from({ length: noteCount }, (_, index) => {
    const source = seed.notes[index % seed.notes.length];
    const suffix = String(index).padStart(5, '0');
    return {
      ...source,
      id: `perf-note-${suffix}`,
      german: `${source.german} ${suffix}`,
      normalizedGerman: `${source.normalizedGerman} ${suffix}`,
      czech: `${source.czech} ${suffix}`,
      source: 'import',
      tags: [`group-${index % 20}`, index % 2 === 0 ? 'school' : 'travel'],
      createdAt: old.toISOString(),
      updatedAt: new Date(old.getTime() + index * 1_000).toISOString(),
    };
  });
  const cards = notes.flatMap((note, index) =>
    (['cs-de', 'de-cs'] as const).map((direction) => ({
      ...seed.cards[0],
      id: `${note.id}:${direction}`,
      noteId: note.id,
      direction,
      createdAt: note.createdAt,
      dueAt: new Date(now.getTime() + (index % 5 === 0 ? dayMs : -dayMs)).toISOString(),
      fsrs:
        index % 4 === 0
          ? undefined
          : {
              ...scheduled,
              reps: 10,
              due: new Date(now.getTime() + (index % 5 === 0 ? dayMs : -dayMs)).toISOString(),
            },
    })),
  );
  const recentCount = Math.min(1_000, Math.floor(reviewCount / 10));
  const reviews: ReviewLog[] = Array.from({ length: reviewCount }, (_, index) => {
    const noteIndex = index % 10 === 0 ? 0 : 1 + (index % (noteCount - 1));
    const reviewedAt = new Date(
      index >= reviewCount - recentCount
        ? now.getTime() - dayMs + index
        : old.getTime() + index * 60_000,
    ).toISOString();
    const correct = index % 13 !== 0;
    return {
      id: `perf-review-${String(index).padStart(6, '0')}`,
      operationId: `perf-operation-${index}`,
      noteId: notes[noteIndex].id,
      cardId: cards[noteIndex * 2 + (index % 2)].id,
      deckId: seed.deck.id,
      reviewedAt,
      localDay: localDateKey(new Date(reviewedAt)),
      mode: index % 7 === 0 ? 'cram' : 'long-term',
      excludedFromLearning: index % 11 === 0,
      exercise: 'typing',
      rating: correct ? 'good' : 'again',
      xpAwarded: index % 11 === 0 || !correct ? 0 : 1,
      signal: performanceSignal(correct),
    };
  });
  return {
    schemaVersion: 8,
    exportedAt: now.toISOString(),
    decks: [seed.deck],
    notes,
    cards,
    reviews,
    learningEvidence: reviews.map((review, index) =>
      learningEvidenceFromReview(review, index % 2 === 0 ? 'cs-de' : 'de-cs'),
    ),
    settings: { ...seed.settings, onboardingCompleted: true },
    course: createCourseProgress(now),
  };
}
