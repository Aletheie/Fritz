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
