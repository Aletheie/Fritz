import assert from 'node:assert/strict';
import test from 'node:test';

import { createSeedData } from '../src/lib/data/seed.ts';
import { dailyLearningTargets } from '../src/lib/domain/course/daily.ts';
import { examPlanDaysRemaining, examPlanReadiness } from '../src/lib/domain/exam-plan.ts';

import type { ExamPlan, ReviewLog } from '../src/lib/domain/types.ts';

const now = new Date('2026-08-13T10:00:00.000Z');
const plan: ExamPlan = {
  examDate: '2026-08-20',
  tag: 'škola',
  dailyMinutes: 10,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

function review(noteId: string, cardId: string, options: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id: `review:${noteId}`,
    cardId,
    noteId,
    deckId: 'deck',
    reviewedAt: now.toISOString(),
    localDay: '2026-08-13',
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
      responseMs: 2_000,
      hintsUsed: 0,
      attempt: 1,
    },
    ...options,
  };
}

test('časové režimy skládají malé dokončitelné denní dávky', () => {
  assert.deepEqual(dailyLearningTargets(5), {
    minutes: 5,
    vocabulary: 2,
    grammar: 2,
    coach: 1,
    total: 5,
  });
  assert.equal(dailyLearningTargets(10).total, 8);
  assert.equal(dailyLearningTargets(20).total, 13);
});

test('plán počítá kalendářní dny a připravenost jen z vybavení bez nápovědy', () => {
  const seed = createSeedData(now);
  const notes = seed.notes.slice(0, 3).map((note) => ({ ...note, tags: ['škola'] }));
  const cards = seed.cards.filter((card) => notes.some((note) => note.id === card.noteId));
  const reviews = [
    review(notes[0].id, cards.find((card) => card.noteId === notes[0].id)!.id),
    review(notes[1].id, cards.find((card) => card.noteId === notes[1].id)!.id, {
      signal: {
        ...review(notes[1].id, '').signal,
        hintsUsed: 1,
      },
    }),
  ];

  const result = examPlanReadiness({ plan, notes, cards, reviews, now });
  assert.equal(examPlanDaysRemaining(plan, now), 7);
  assert.equal(result.total, 3);
  assert.equal(result.ready, 1);
  assert.equal(result.unassistedReviewed, 1);
  assert.equal(result.percent, 33);
  assert.deepEqual(new Set(result.riskNoteIds), new Set([notes[1].id, notes[2].id]));
});

test('reklamovaný verdikt se do připravenosti nepočítá', () => {
  const seed = createSeedData(now);
  const note = { ...seed.notes[0], tags: ['škola'] };
  const card = seed.cards.find((candidate) => candidate.noteId === note.id)!;
  const disputed = review(note.id, card.id, {
    excludedFromLearning: true,
    disputeReason: 'ai-too-strict',
    disputedAt: now.toISOString(),
  });

  const result = examPlanReadiness({
    plan,
    notes: [note],
    cards: [card],
    reviews: [disputed],
    now,
  });
  assert.equal(result.ready, 0);
  assert.deepEqual(result.riskNoteIds, [note.id]);
});

test('plán přizná, když požadované denní tempo přesahuje zvolený čas', () => {
  const seed = createSeedData(now);
  const urgentPlan: ExamPlan = {
    ...plan,
    examDate: '2026-08-13',
    tag: 'all',
    dailyMinutes: 5,
  };
  const result = examPlanReadiness({
    plan: urgentPlan,
    notes: seed.notes,
    cards: seed.cards,
    reviews: [],
    now,
  });

  assert.equal(result.dailyTarget, seed.notes.length);
  assert.equal(result.dailyCapacity, 5);
  assert.equal(result.feasible, false);
});
