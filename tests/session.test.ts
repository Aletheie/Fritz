import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chooseNextLongTermCard,
  createLongTermSessionDraft,
  enqueueSessionRepeat,
  parseLongTermSessionDraft,
  reconcileLongTermSessionCards,
  recordLongTermSessionReview,
  shouldRepeatInSession,
  shouldWaitInsideSession,
} from '../src/lib/domain/scheduler/session.ts';

import type { StudyCard } from '../src/lib/domain/types.ts';

function card(id: string, dueAt: string): StudyCard {
  return {
    id,
    deckId: 'deck',
    noteId: `note-${id}`,
    direction: 'cs-de',
    dueAt,
    createdAt: '2026-08-03T12:00:00.000Z',
    updatedAt: '2026-08-03T12:00:00.000Z',
  };
}

test('krátký learning step se vrátí do stejné relace', () => {
  const reviewed = card('a', '2026-08-03T12:10:00.000Z');
  const cutoff = new Date('2026-08-03T12:25:00.000Z');
  const queue = enqueueSessionRepeat([], reviewed, cutoff, 1);
  assert.deepEqual(
    queue.map((item) => item.id),
    ['a'],
  );
});

test('karta za hranicí relace ani po limitu pokusů se znovu nezařadí', () => {
  const cutoff = new Date('2026-08-03T12:25:00.000Z');
  assert.equal(shouldRepeatInSession(card('late', '2026-08-03T13:00:00.000Z'), cutoff, 1), false);
  assert.equal(shouldRepeatInSession(card('limit', '2026-08-03T12:10:00.000Z'), cutoff, 4), false);
});

test('fronta přeskočí budoucí kartu, když je pozdější karta už splatná', () => {
  const queue = [
    card('future', '2026-08-03T12:05:00.000Z'),
    card('due', '2026-08-03T11:59:00.000Z'),
  ];
  const next = chooseNextLongTermCard(queue, 0, new Date('2026-08-03T12:00:00.000Z'));
  assert.deepEqual(next, { index: 1, waitMs: 0, complete: false });
});

test('když nic není splatné, vrátí nejbližší čekání', () => {
  const queue = [
    card('later', '2026-08-03T12:08:00.000Z'),
    card('sooner', '2026-08-03T12:03:00.000Z'),
  ];
  const next = chooseNextLongTermCard(queue, 0, new Date('2026-08-03T12:00:00.000Z'));
  assert.deepEqual(next, { index: 1, waitMs: 180_000, complete: false });
});

test('prázdný zbytek fronty je dokončený', () => {
  const next = chooseNextLongTermCard(
    [card('a', '2026-08-03T12:00:00.000Z')],
    1,
    new Date('2026-08-03T12:00:00.000Z'),
  );
  assert.deepEqual(next, { waitMs: 0, complete: true });
});

test('soustředěné tempo nikdy nezdržuje relaci čekáním', () => {
  assert.equal(shouldWaitInsideSession(5_000, 'focused'), false);
  assert.equal(shouldWaitInsideSession(30_000, 'focused'), false);
});

test('vedené tempo čeká jen na krátký learning step', () => {
  assert.equal(shouldWaitInsideSession(30_000, 'guided'), true);
  assert.equal(shouldWaitInsideSession(46_000, 'guided'), false);
});

test('konečná dávka ukládá zbývající karty a souhrn po každé odpovědi', () => {
  const startedAt = new Date('2026-08-03T12:00:00.000Z');
  const draft = createLongTermSessionDraft(
    [card('a', startedAt.toISOString()), card('b', startedAt.toISOString())],
    'domov',
    10,
    startedAt,
    'without-course',
  );
  const reviewed = recordLongTermSessionReview(
    draft,
    'a',
    true,
    7,
    new Date('2026-08-03T12:01:00.000Z'),
  );

  assert.deepEqual(reviewed.remainingCardIds, ['b']);
  assert.equal(reviewed.reviews, 1);
  assert.equal(reviewed.successes, 1);
  assert.equal(reviewed.xp, 7);
  assert.equal(reviewed.combo, 0);
  assert.equal(reviewed.bestCombo, 0);
  assert.equal(reviewed.sourceFilter, 'without-course');
  assert.deepEqual(parseLongTermSessionDraft(reviewed), reviewed);
});

test('starší uložená dávka dostane bezpečné výchozí hodnoty', () => {
  const draft = createLongTermSessionDraft(
    [card('a', '2026-08-03T12:00:00.000Z')],
    'all',
    5,
    new Date('2026-08-03T12:00:00.000Z'),
  );
  const legacy = { ...draft, version: 1 } as Record<string, unknown>;
  delete legacy.combo;
  delete legacy.bestCombo;
  delete legacy.sourceFilter;
  const parsed = parseLongTermSessionDraft(legacy);
  assert.equal(parsed?.combo, 0);
  assert.equal(parsed?.bestCombo, 0);
  assert.equal(parsed?.sourceFilter, 'all');
});

test('obnovení dávky vynechá smazané a mezitím odložené karty', () => {
  const now = new Date('2026-08-03T12:00:00.000Z');
  const due = card('due', '2026-08-03T11:59:00.000Z');
  const future = card('future', '2026-08-03T13:00:00.000Z');
  const missing = card('missing', '2026-08-03T11:58:00.000Z');
  const draft = createLongTermSessionDraft([due, future, missing], 'all', 5, now);

  assert.deepEqual(
    reconcileLongTermSessionCards(draft, [future, due], now).map((item) => item.id),
    ['due'],
  );
});

test('poškozený uložený stav relace se bezpečně odmítne', () => {
  assert.equal(parseLongTermSessionDraft({ version: 1, cardIds: ['a'] }), undefined);
  assert.equal(
    parseLongTermSessionDraft({
      version: 1,
      selectedTag: 'all',
      requestedSize: 10,
      cardIds: ['a'],
      remainingCardIds: ['b'],
      reviews: 0,
      successes: 0,
      xp: 0,
      startedAt: '2026-08-03T12:00:00.000Z',
      updatedAt: '2026-08-03T12:00:00.000Z',
    }),
    undefined,
  );
});
