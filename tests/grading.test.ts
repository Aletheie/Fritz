import assert from 'node:assert/strict';
import test from 'node:test';

import { damerauLevenshtein } from '../src/lib/domain/grading/distance.ts';
import { gradeChoiceAnswer, gradeGermanAnswer } from '../src/lib/domain/grading/grade.ts';
import {
  keyboardFoldGerman,
  normalizeGermanKey,
  normalizeText,
  parseGermanAnswer,
} from '../src/lib/domain/grading/normalize.ts';

test('normalizace zvládne německou typografii a člen', () => {
  assert.equal(normalizeText('  „SCHÖN!“  '), 'schön');
  assert.deepEqual(parseGermanAnswer('Das Haus'), { article: 'das', word: 'haus' });
  assert.equal(keyboardFoldGerman('Grüße'), 'gruesse');
  assert.equal(normalizeGermanKey('Haus', 'das'), 'das:haus');
});

test('vzdálenost zachová záměny, transpozice a prázdné vstupy', () => {
  assert.equal(damerauLevenshtein('', 'Haus'), 4);
  assert.equal(damerauLevenshtein('Haus', ''), 4);
  assert.equal(damerauLevenshtein('abcd', 'acbd'), 1);
  assert.equal(damerauLevenshtein('Schlüssel', 'Schlüsel'), 1);
  assert.equal(damerauLevenshtein('CA', 'ABC'), 3);
  assert.equal(damerauLevenshtein('a'.repeat(2_000), `${'a'.repeat(1_999)}b`), 1);
});

test('přesná odpověď se správným členem je Good', () => {
  const result = gradeGermanAnswer({
    expectedGerman: 'Haus',
    expectedArticle: 'das',
    selectedArticle: 'das',
    submittedText: 'Haus',
    responseMs: 2_000,
  });

  assert.equal(result.correct, true);
  assert.equal(result.rating, 'good');
  assert.equal(result.signal.wordCorrect, true);
  assert.equal(result.signal.articleCorrect, true);
});

test('člen lze zadat i přímo v textu', () => {
  const result = gradeGermanAnswer({
    expectedGerman: 'Haus',
    expectedArticle: 'das',
    submittedText: 'das Haus',
    responseMs: 2_000,
  });

  assert.equal(result.correct, true);
  assert.equal(result.signal.selectedArticle, 'das');
});

test('správné slovo se špatným členem je Again', () => {
  const result = gradeGermanAnswer({
    expectedGerman: 'Haus',
    expectedArticle: 'das',
    selectedArticle: 'der',
    submittedText: 'Haus',
    responseMs: 1_000,
  });

  assert.equal(result.correct, false);
  assert.equal(result.rating, 'again');
  assert.equal(result.signal.wordCorrect, true);
  assert.equal(result.signal.articleCorrect, false);
});

test('jediný překlep je Hard, ale vyžaduje opravu', () => {
  const result = gradeGermanAnswer({
    expectedGerman: 'Schlüssel',
    expectedArticle: 'der',
    selectedArticle: 'der',
    submittedText: 'Schlüsel',
    responseMs: 2_800,
  });

  assert.equal(result.correct, false);
  assert.equal(result.nearCorrect, true);
  assert.equal(result.rating, 'hard');
  assert.equal(result.signal.editDistance, 1);
});

test('náhradní zápis přehlásky je tolerovaný jako Hard', () => {
  const result = gradeGermanAnswer({
    expectedGerman: 'Schlüssel',
    expectedArticle: 'der',
    selectedArticle: 'der',
    submittedText: 'Schluessel',
    responseMs: 2_500,
    allowKeyboardFallback: true,
  });

  assert.equal(result.correct, true);
  assert.equal(result.rating, 'hard');
  assert.equal(result.signal.keyboardEquivalent, true);
});

test('zralá karta s rychlou přesnou odpovědí může být Easy', () => {
  const result = gradeGermanAnswer({
    expectedGerman: 'schön',
    submittedText: 'schön',
    responseMs: 700,
    isMatureCard: true,
  });

  assert.equal(result.correct, true);
  assert.equal(result.rating, 'easy');
});

test('výběr hodnotí špatnou odpověď jako Again', () => {
  const result = gradeChoiceAnswer({ selected: 'note_b', expected: 'note_a', responseMs: 500 });
  assert.equal(result.correct, false);
  assert.equal(result.rating, 'again');
  assert.equal(result.signal.selectedChoice, 'note_b');
});
