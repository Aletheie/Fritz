import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chooseNextCramCard,
  cramProgress,
  createCramSession,
  recordCramReview,
} from '../src/lib/domain/scheduler/cram.ts';

import type { StudyCard } from '../src/lib/domain/types.ts';

function card(id: string): StudyCard {
  return {
    id,
    deckId: 'deck',
    noteId: `note_${id}`,
    direction: 'cs-de',
    dueAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

test('sprint omezí délku na bezpečný rozsah', () => {
  const now = new Date('2026-08-03T10:00:00.000Z');
  const short = createCramSession([card('a')], 1, now);
  const long = createCramSession([card('a')], 999, now);

  assert.equal(new Date(short.endsAt).getTime() - now.getTime(), 5 * 60_000);
  assert.equal(new Date(long.endsAt).getTime() - now.getTime(), 180 * 60_000);
});

test('fronta upřednostní dosud neviděnou a ne nedávnou kartu', () => {
  const now = new Date('2026-08-03T10:00:01.000Z');
  const session = createCramSession(
    [card('a'), card('b'), card('c')],
    20,
    new Date(now.getTime() - 1_000),
  );
  session.items[0].seen = 1;
  session.lastCardIds = ['a'];

  const next = chooseNextCramCard(session, now);
  assert.equal(next.cardId, 'b');
  assert.equal(next.waitMs, 0);
});

test('karta je zvládnutá až po dvou oddělených úspěších za sebou', () => {
  const start = new Date('2026-08-03T10:00:00.000Z');
  let session = createCramSession([card('a')], 60, start);

  session = recordCramReview(session, 'a', 'good', start);
  assert.equal(session.items[0].mastered, false);

  const secondAt = new Date(session.items[0].dueAt);
  session = recordCramReview(session, 'a', 'good', secondAt);
  assert.equal(session.items[0].mastered, true);
  assert.deepEqual(cramProgress(session), { mastered: 1, total: 1, percent: 100 });
  assert.equal(chooseNextCramCard(session, secondAt).complete, true);
});

test('chyba přeruší úspěšnou sérii', () => {
  const start = new Date('2026-08-03T10:00:00.000Z');
  let session = createCramSession([card('a')], 60, start);
  session = recordCramReview(session, 'a', 'good', start);
  session = recordCramReview(session, 'a', 'again', new Date(session.items[0].dueAt));

  assert.equal(session.items[0].streak, 0);
  assert.equal(session.items[0].failures, 1);
  assert.equal(session.items[0].mastered, false);
});
