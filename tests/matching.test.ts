import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMatchingRound,
  buildVocabularyMatchingExercise,
} from '../src/lib/domain/exercises/matching.ts';

import type { Note } from '../src/lib/domain/types.ts';

function note(id: string, german: string, czech: string, kind: Note['kind'] = 'noun'): Note {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return {
    id,
    deckId: 'deck',
    german,
    normalizedGerman: german.toLocaleLowerCase('de-DE'),
    czech,
    kind,
    article: kind === 'noun' ? 'der' : undefined,
    acceptedGerman: [],
    acceptedCzech: [],
    tags: ['téma'],
    cefr: 'A1',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

test('párování promíchá oba sloupce, ale zachová právě jednu položku z každé dvojice', () => {
  const pairs = [
    { id: 'a', czech: 'pes', german: 'der Hund' },
    { id: 'b', czech: 'dům', german: 'das Haus' },
    { id: 'c', czech: 'strom', german: 'der Baum' },
    { id: 'd', czech: 'stůl', german: 'der Tisch' },
  ];
  const round = buildMatchingRound(pairs, 'stejné-semeno');

  assert.deepEqual(round, buildMatchingRound(pairs, 'stejné-semeno'));
  assert.equal(round.pairs.length, 4);
  assert.equal(new Set(round.czechOptions.map((option) => option.pairId)).size, 4);
  assert.equal(new Set(round.germanOptions.map((option) => option.pairId)).size, 4);
  assert.equal(
    round.czechOptions.every(
      (option, index) => option.pairId === round.germanOptions[index]?.pairId,
    ),
    false,
  );
});

test('slovní spojovačka vždy obsahuje aktuální kartu a podobné unikátní výrazy', () => {
  const current = note('hund', 'Hund', 'pes');
  const exercise = buildVocabularyMatchingExercise(
    current,
    [
      current,
      note('haus', 'Haus', 'dům'),
      note('baum', 'Baum', 'strom'),
      note('tisch', 'Tisch', 'stůl'),
      note('duplikat', 'Tisch', 'tabule'),
      note('laufen', 'laufen', 'běžet', 'verb'),
    ],
    4,
    7,
  );

  assert.ok(exercise);
  assert.equal(exercise.currentPairId, current.id);
  assert.equal(exercise.pairs.length, 4);
  assert.ok(exercise.pairs.some((pair) => pair.id === current.id));
  assert.equal(new Set(exercise.pairs.map((pair) => pair.german)).size, 4);
});
