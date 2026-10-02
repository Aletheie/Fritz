import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FSRS_SCHEMA_VERSION,
  FsrsCorruptionError,
  assertFsrsDueMatchesCard,
  parseSerializedFsrsCard,
} from '../src/lib/domain/scheduler/fsrs-schema.ts';
import { previewSchedule, scheduleReview } from '../src/lib/domain/scheduler/fsrs.ts';

import type { StudyCard } from '../src/lib/domain/types.ts';

const due = '2026-08-07T10:00:00.000Z';

function validFsrs(): Record<string, unknown> {
  return {
    due,
    stability: 4.5,
    difficulty: 6.2,
    elapsed_days: 3,
    scheduled_days: 5,
    reps: 4,
    lapses: 1,
    learning_steps: 0,
    state: 2,
    last_review: '2026-08-02T10:00:00.000Z',
  };
}

function card(fsrs?: Record<string, unknown>): StudyCard {
  return {
    id: 'card-fsrs-test',
    deckId: 'deck-test',
    noteId: 'note-test',
    direction: 'cs-de',
    dueAt: due,
    fsrs,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-02T10:00:00.000Z',
  };
}

test('complete legacy FSRS shape is canonicalized to the current schema version', () => {
  const parsed = parseSerializedFsrsCard(validFsrs());
  assert.equal(parsed.schemaVersion, FSRS_SCHEMA_VERSION);
  assert.equal(parsed.due, due);
  assert.equal(parsed.reps, 4);
});

test('partial, non-finite, oversized and unknown-version FSRS payloads are rejected', () => {
  assert.throws(() => parseSerializedFsrsCard({ reps: 2 }), FsrsCorruptionError);
  assert.throws(
    () => parseSerializedFsrsCard({ ...validFsrs(), stability: Number.NaN }),
    FsrsCorruptionError,
  );
  assert.throws(
    () => parseSerializedFsrsCard({ ...validFsrs(), reps: 10_000_001 }),
    FsrsCorruptionError,
  );
  assert.throws(
    () => parseSerializedFsrsCard({ ...validFsrs(), schemaVersion: 99 }),
    FsrsCorruptionError,
  );
});

test('cross-field invariants reject more lapses than repetitions', () => {
  assert.throws(
    () => parseSerializedFsrsCard({ ...validFsrs(), reps: 2, lapses: 3 }),
    /více lapsů/u,
  );
});

test('card dueAt must match the authenticated serialized scheduler due date', () => {
  const parsed = parseSerializedFsrsCard(validFsrs());
  assert.doesNotThrow(() => assertFsrsDueMatchesCard(parsed, due));
  assert.throws(
    () => assertFsrsDueMatchesCard(parsed, '2026-08-08T10:00:00.000Z'),
    FsrsCorruptionError,
  );
});

test('scheduler never silently turns corrupted FSRS into a fresh card', () => {
  const damaged = card({ stability: 42, reps: 10 });
  assert.throws(() => previewSchedule(damaged, 0.9), FsrsCorruptionError);
  assert.throws(() => scheduleReview(damaged, 'good', 0.9), FsrsCorruptionError);
});

test('fresh scheduling writes a complete versioned FSRS card and preserves exact dueAt', () => {
  const fresh = card();
  const result = scheduleReview(fresh, 'good', 0.9, new Date(due));
  assert.equal(result.after.schemaVersion, FSRS_SCHEMA_VERSION);
  assert.equal(result.card.dueAt, result.after.due);
  assert.equal(result.after.reps, 1);
  assert.doesNotThrow(() => parseSerializedFsrsCard(result.after));
});

test('learning steps graduate to spaced review and forgetting returns through relearning', () => {
  const start = new Date(due);
  const failed = scheduleReview(card(), 'again', 0.9, start).card;
  assert.equal(Date.parse(failed.dueAt) - start.getTime(), 60_000);
  assert.equal(failed.fsrs?.state, 1);

  const remembered = scheduleReview(failed, 'good', 0.9, new Date(failed.dueAt)).card;
  assert.equal(Date.parse(remembered.dueAt) - Date.parse(failed.dueAt), 10 * 60_000);
  const graduated = scheduleReview(remembered, 'good', 0.9, new Date(remembered.dueAt)).card;
  assert.equal(graduated.fsrs?.state, 2);
  assert.ok(Date.parse(graduated.dueAt) - Date.parse(remembered.dueAt) >= 86_400_000);

  const forgotten = scheduleReview(graduated, 'again', 0.9, new Date(graduated.dueAt)).card;
  assert.equal(forgotten.fsrs?.state, 3);
  assert.equal(forgotten.fsrs?.lapses, 1);
  assert.equal(Date.parse(forgotten.dueAt) - Date.parse(graduated.dueAt), 10 * 60_000);

  const recovered = scheduleReview(forgotten, 'good', 0.9, new Date(forgotten.dueAt)).card;
  assert.equal(recovered.fsrs?.state, 2);
  assert.equal(recovered.fsrs?.lapses, 1);
  assert.ok(Date.parse(recovered.dueAt) - Date.parse(forgotten.dueAt) >= 86_400_000);
});

test('all rating previews match committed schedules throughout a multi-month lifecycle', () => {
  let current = card();
  const ratings = ['again', 'hard', 'good', 'good', 'easy', 'good', 'again', 'good'] as const;
  for (let index = 0; index < 40; index += 1) {
    const reviewedAt = new Date(current.dueAt);
    const snapshot = structuredClone(current);
    const options = previewSchedule(current, 0.9, reviewedAt);
    for (const option of options) {
      const committed = scheduleReview(current, option.rating, 0.9, reviewedAt);
      assert.equal(committed.card.dueAt, option.dueAt, `${index}: ${option.rating}`);
      assert.ok(option.intervalMs > 0);
      assertFsrsDueMatchesCard(committed.after, committed.card.dueAt);
    }
    assert.deepEqual(current, snapshot, 'preview and alternative ratings do not mutate history');
    current = scheduleReview(current, ratings[index % ratings.length], 0.9, reviewedAt).card;
    assert.equal(current.fsrs?.reps, index + 1);
  }
});

test('higher retention shortens the review interval and overdue reviews stay valid', () => {
  const established = card(validFsrs());
  const reviewedAt = new Date('2026-08-21T10:00:00.000Z');
  const standard = scheduleReview(established, 'good', 0.85, reviewedAt);
  const cautious = scheduleReview(established, 'good', 0.97, reviewedAt);
  assert.ok(Date.parse(cautious.card.dueAt) < Date.parse(standard.card.dueAt));
  assert.ok(Date.parse(cautious.card.dueAt) > reviewedAt.getTime());
  assert.equal(cautious.after.elapsed_days, 19);
  assert.equal(cautious.after.reps, 5);
});
