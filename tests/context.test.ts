import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildClozeExercise,
  buildWordOrderExercise,
  gradeContextAnswer,
  gradeWordOrder,
  wordOrderAnswer,
} from '../src/lib/domain/exercises/context.ts';

import type { Note } from '../src/lib/domain/types.ts';

const timestamp = '2026-08-04T12:00:00.000Z';

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-haus',
    deckId: 'deck',
    german: 'Haus',
    normalizedGerman: 'das:haus',
    czech: 'dům',
    kind: 'noun',
    article: 'das',
    plural: 'die Häuser',
    acceptedGerman: [],
    acceptedCzech: [],
    tags: ['bydlení'],
    exampleDe: 'Das Haus steht am See.',
    exampleCs: 'Dům stojí u jezera.',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

test('slovosled zachová duplicitní tokeny pomocí stabilních ID', () => {
  const exercise = buildWordOrderExercise(
    note({
      id: 'phrase',
      kind: 'phrase',
      german: 'Sehr sehr gern',
      czech: 'Velmi rád',
      article: undefined,
    }),
    1,
  );
  assert.ok(exercise);
  assert.equal(exercise.tokens.length, 3);
  assert.equal(new Set(exercise.tokens.map((token) => token.id)).size, 3);
  assert.equal(wordOrderAnswer(exercise.tokens), 'Sehr sehr gern');
  assert.equal(gradeWordOrder(exercise.tokens, exercise).rating, 'good');
  assert.equal(gradeWordOrder(exercise.tokens.toReversed(), exercise).rating, 'again');
});

test('doplňovačka využije příklad nebo gramatický tvar a má bezpečný fallback', () => {
  const rich = buildClozeExercise(note(), 0);
  assert.ok(rich.answer.length > 0);
  assert.ok(rich.before.length + rich.after.length > 0);

  const fallback = buildClozeExercise(
    note({
      id: 'plain',
      german: 'morgen',
      normalizedGerman: ':morgen',
      czech: 'zítra',
      kind: 'other',
      article: undefined,
      plural: undefined,
      exampleDe: undefined,
      exampleCs: undefined,
    }),
    0,
  );
  assert.equal(fallback.source, 'recall');
  assert.equal(fallback.answer, 'morgen');
});

test('kontextová odpověď rozliší přesnost, klávesnicovou náhradu a chybu', () => {
  const exact = gradeContextAnswer({
    submitted: 'Häuser',
    accepted: ['Häuser'],
    allowKeyboardFallback: true,
  });
  const folded = gradeContextAnswer({
    submitted: 'Haeuser',
    accepted: ['Häuser'],
    allowKeyboardFallback: true,
  });
  const wrong = gradeContextAnswer({
    submitted: 'Wohnung',
    accepted: ['Häuser'],
    allowKeyboardFallback: true,
  });

  assert.equal(exact.rating, 'good');
  assert.equal(folded.rating, 'hard');
  assert.equal(folded.keyboardEquivalent, true);
  assert.equal(wrong.rating, 'again');
});

test('bezpečný recall u podstatného jména skutečně vyžaduje člen', () => {
  const exercise = buildClozeExercise(
    note({
      id: 'plain-noun',
      german: 'Hund',
      normalizedGerman: 'der:hund',
      czech: 'pes',
      article: 'der',
      plural: undefined,
      exampleDe: undefined,
      exampleCs: undefined,
      acceptedGerman: ['Köter'],
    }),
    0,
  );

  assert.equal(exercise.source, 'recall');
  assert.equal(exercise.label, 'Doplň výraz včetně členu');
  assert.equal(
    gradeContextAnswer({
      submitted: 'Hund',
      accepted: exercise.acceptedAnswers,
      allowKeyboardFallback: true,
    }).rating,
    'again',
  );
  assert.equal(
    gradeContextAnswer({
      submitted: 'der Hund',
      accepted: exercise.acceptedAnswers,
      allowKeyboardFallback: true,
    }).rating,
    'good',
  );
  assert.equal(
    gradeContextAnswer({
      submitted: 'der Köter',
      accepted: exercise.acceptedAnswers,
      allowKeyboardFallback: true,
    }).rating,
    'good',
  );
});

test('perfektum ukazuje správné pomocné sloveso v osobním tvaru', () => {
  const exercise = buildClozeExercise(
    note({
      id: 'gehen',
      german: 'gehen',
      normalizedGerman: ':gehen',
      czech: 'jít',
      kind: 'verb',
      article: undefined,
      plural: undefined,
      exampleDe: undefined,
      exampleCs: undefined,
      verbForms: { participle: 'gegangen', auxiliary: 'sein' },
    }),
    0,
  );

  assert.equal(exercise.source, 'verb-participle');
  assert.equal(exercise.before, 'er / sie / es ist');
  assert.equal(exercise.answer, 'gegangen');
});
