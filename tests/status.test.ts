import assert from 'node:assert/strict';
import test from 'node:test';

import { cardLearningStatus } from '../src/lib/domain/scheduler/status.ts';

import type { StudyCard } from '../src/lib/domain/types.ts';

function card(options: { dueAt: string; fsrs?: StudyCard['fsrs'] }): StudyCard {
  return {
    id: 'card',
    deckId: 'deck',
    noteId: 'note',
    direction: 'cs-de',
    dueAt: options.dueAt,
    fsrs: options.fsrs,
    createdAt: '2026-08-03T12:00:00.000Z',
    updatedAt: '2026-08-03T12:00:00.000Z',
  };
}

test('stav nové karty říká, že je připravená dnes', () => {
  const status = cardLearningStatus(
    card({ dueAt: '2026-08-03T11:00:00.000Z' }),
    new Date('2026-08-03T12:00:00.000Z'),
  );

  assert.equal(status.tier, 'new');
  assert.equal(status.dueLabel, 'Připravené dnes');
  assert.equal(status.detail, 'Zatím bez opakování');
  assert.equal(status.dueNow, true);
});

test('stav naučené karty ukazuje relativní návrat i stabilitu', () => {
  const status = cardLearningStatus(
    card({
      dueAt: '2026-08-06T12:00:00.000Z',
      fsrs: { reps: 5, stability: 20 },
    }),
    new Date('2026-08-03T12:00:00.000Z'),
  );

  assert.equal(status.tier, 'strong');
  assert.equal(status.dueLabel, 'Další za 3 d');
  assert.equal(status.detail, '5 opakování · stabilita 20 dní');
  assert.equal(status.dueNow, false);
});
