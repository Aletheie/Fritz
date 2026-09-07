// oxlint-disable-next-line import/no-unassigned-import
import 'fake-indexeddb/auto';

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { get } from 'svelte/store';

import { closeDatabaseConnection } from '../src/lib/data/db.ts';
import { loadSnapshot, recordReview } from '../src/lib/data/repository.ts';
import type { AnswerSignal } from '../src/lib/domain/types.ts';
import { appStore } from '../src/lib/state/app.ts';

after(closeDatabaseConnection);

test('retrying a review outside the recent history does not award XP or skill progress twice', async () => {
  const snapshot = await loadSnapshot();
  const card = snapshot.cards[0];
  const note = snapshot.notes.find((candidate) => candidate.id === card.noteId)!;
  const signal: AnswerSignal = {
    exercise: 'typing',
    submittedText: note.german,
    normalizedText: note.german,
    expectedText: note.german,
    wordCorrect: true,
    articleCorrect: true,
    exact: true,
    keyboardEquivalent: false,
    editDistance: 0,
    responseMs: 1_000,
    hintsUsed: 0,
    attempt: 1,
  };
  const operationId = 'historical-review-retry';
  await recordReview({
    operationId,
    cardId: card.id,
    noteId: note.id,
    mode: 'long-term',
    rating: 'good',
    signal,
    now: new Date(Date.now() - 90 * 86_400_000),
  });
  await appStore.initialize();
  const before = get(appStore);
  assert.equal(before.learningEvidence.length, 0);
  assert.ok(before.skillStates.length > 0);
  await appStore.review({ operationId, card, note, mode: 'long-term', rating: 'good', signal });
  const afterRetry = get(appStore);
  assert.deepEqual(afterRetry.skillStates, before.skillStates);
  assert.deepEqual(afterRetry.reviewStats, before.reviewStats);
  assert.deepEqual(afterRetry.cards, before.cards);
  assert.equal(afterRetry.learningEvidence.length, 0);
});
