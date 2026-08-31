import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearLongTermSession,
  loadLongTermSession,
  saveLongTermSession,
} from '../src/lib/client/study-session.ts';
import { createLongTermSessionDraft } from '../src/lib/domain/scheduler/session.ts';

import type { StudyCard } from '../src/lib/domain/types.ts';

const card: StudyCard = {
  id: 'card',
  deckId: 'deck',
  noteId: 'note',
  direction: 'cs-de',
  dueAt: '2026-08-03T12:00:00.000Z',
  createdAt: '2026-08-03T12:00:00.000Z',
  updatedAt: '2026-08-03T12:00:00.000Z',
};

function restoreStorage(original: PropertyDescriptor | undefined): void {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
}

test('blokované nebo plné localStorage nikdy nepřeruší studijní relaci', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const blockedStorage = {
    getItem: () => {
      throw new DOMException('blocked', 'SecurityError');
    },
    setItem: () => {
      throw new DOMException('full', 'QuotaExceededError');
    },
    removeItem: () => {
      throw new DOMException('blocked', 'SecurityError');
    },
  } as unknown as Storage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: blockedStorage,
  });

  const draft = createLongTermSessionDraft([card], 'all', 1);

  try {
    assert.doesNotThrow(() => saveLongTermSession(draft));
    assert.doesNotThrow(() => clearLongTermSession());
    assert.equal(loadLongTermSession(), undefined);
  } finally {
    restoreStorage(original);
  }
});

test('rozpracovaná relace před přejmenováním se jednou převede pod Fritz klíč', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  const draft = createLongTermSessionDraft([card], 'all', 1);
  values.set('wortly:long-term-session:v1', JSON.stringify(draft));
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } as unknown as Storage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

  try {
    assert.deepEqual(loadLongTermSession(), draft);
    assert.equal(values.has('wortly:long-term-session:v1'), false);
    assert.equal(values.has('fritz:long-term-session:v1'), true);
  } finally {
    restoreStorage(original);
  }
});
