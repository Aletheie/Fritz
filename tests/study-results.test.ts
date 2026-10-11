import assert from 'node:assert/strict';
import test from 'node:test';

import { gradeChoiceAnswer, gradeGermanAnswer } from '../src/lib/domain/grading/grade.ts';
import { parseSourceFilter, parseStudySearchParams } from '../src/lib/domain/study/params.ts';
import {
  choiceResult,
  disputedResult,
  formatWait,
  hintText,
  isCleanAnswer,
  matchingResult,
  sentenceRating,
  sentenceResult,
  speakingResult,
  typingResult,
} from '../src/lib/domain/study/results.ts';

import type { AiSentenceEvaluationResult } from '../src/lib/domain/ai/types.ts';
import type { StudyResult } from '../src/lib/domain/study/types.ts';
import type { Note } from '../src/lib/domain/types.ts';

function note(id: string, german: string, article?: Note['article']): Note {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return {
    id,
    deckId: 'deck',
    german,
    normalizedGerman: german.toLocaleLowerCase('de-DE'),
    czech: 'význam',
    kind: article ? 'noun' : 'phrase',
    article,
    acceptedGerman: [],
    acceptedCzech: [],
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function evaluation(overrides: Partial<AiSentenceEvaluationResult> = {}) {
  return {
    accepted: true,
    targetUsedCorrectly: true,
    grammarScore: 90,
    naturalnessScore: 90,
    feedback: 'Dobře.',
    ...overrides,
  } as AiSentenceEvaluationResult;
}

test('URL parametry procvičování mají bezpečné výchozí hodnoty a meze', () => {
  const defaults = parseStudySearchParams(new URLSearchParams(''));
  assert.equal(defaults.mode, 'long-term');
  assert.equal(defaults.cramDuration, 20);
  assert.equal(defaults.sessionSize, undefined);
  assert.equal(defaults.tag, 'all');
  assert.equal(defaults.autoStart, false);

  const cram = parseStudySearchParams(
    new URLSearchParams('mode=cram&minutes=999&size=7&start=1&distinct=1&tag=jídlo'),
  );
  assert.equal(cram.mode, 'cram');
  assert.equal(cram.cramDuration, 180);
  assert.equal(cram.sessionSize, 10, 'neznámá velikost dávky spadne na 10');
  assert.equal(cram.autoStart, true);
  assert.equal(cram.distinct, true);
  assert.equal(cram.tag, 'jídlo');

  assert.equal(parseStudySearchParams(new URLSearchParams('minutes=abc')).cramDuration, 20);
  assert.equal(parseStudySearchParams(new URLSearchParams('minutes=1')).cramDuration, 5);
  assert.equal(parseSourceFilter('own', 'all'), 'own');
  assert.equal(parseSourceFilter('něco', 'course'), 'course');
  assert.equal(parseSourceFilter(null, 'all'), 'all');
});

test('anglická zpětná vazba psaní nahradí českou zprávu, česká zůstane', () => {
  const graded = gradeGermanAnswer({
    expectedGerman: 'Haus',
    expectedArticle: 'das',
    submittedText: 'das Maus',
    responseMs: 2_000,
  });
  assert.equal(typingResult(graded, 'cs'), graded);
  const english = typingResult(graded, 'en');
  assert.match(english.message, /German answer/u);
  assert.equal(english.rating, graded.rating);
});

test('mluvení označí signál jako speaking', () => {
  const graded = gradeGermanAnswer({
    expectedGerman: 'Haus',
    expectedArticle: 'das',
    submittedText: 'das Haus',
    responseMs: 2_000,
  });
  const result = speakingResult(graded, 'cs');
  assert.equal(result.signal.exercise, 'speaking');
  assert.equal(result.message, 'Přepis je správně.');
});

test('výběr ukáže zvolenou i správnou možnost', () => {
  const expected = note('a', 'Haus', 'das');
  const selected = note('b', 'Maus', 'die');
  const graded = gradeChoiceAnswer({ selected: 'b', expected: 'a', responseMs: 1_000 });
  const result = choiceResult(graded, selected, expected, 'cs');
  assert.equal(result.correct, false);
  assert.match(result.message, /die Maus/u);
  assert.match(result.message, /das Haus/u);
});

test('párování s chybami je správné, ale jen hard', () => {
  const target = note('a', 'Haus', 'das');
  const exercise = { pairs: [{ id: 'p1' }, { id: 'p2' }] } as Parameters<typeof matchingResult>[1];
  const clean = matchingResult(target, exercise, 0, 500, 'cs');
  const messy = matchingResult(target, exercise, 2, 500, 'cs');
  assert.equal(clean.rating, 'good');
  assert.equal(messy.rating, 'hard');
  assert.equal(messy.correct, true);
  assert.equal(messy.signal.hintsUsed, 2);
  assert.equal(messy.signal.normalizedText, 'p1 p2');
});

test('AI věta: hodnocení podle průměru gramatiky a přirozenosti', () => {
  assert.equal(sentenceRating(evaluation()), 'good');
  assert.equal(sentenceRating(evaluation({ grammarScore: 80, naturalnessScore: 80 })), 'hard');
  assert.equal(sentenceRating(evaluation({ accepted: false })), 'again');
  assert.equal(sentenceRating(evaluation({ targetUsedCorrectly: false })), 'again');

  const result = sentenceResult(
    evaluation({ grammarScore: 96, naturalnessScore: 91 }),
    note('a', 'Haus', 'das'),
    '  Das Haus ist groß. ',
    1_000,
  );
  assert.equal(result.signal.submittedText, 'Das Haus ist groß.');
  assert.equal(result.signal.exact, true);
  assert.equal(result.signal.aiScore, 94);
});

test('reklamace vynuluje XP i plánovaný termín', () => {
  const previous = {
    rating: 'again',
    correct: false,
    message: 'x',
    expectedDisplay: 'das Haus',
    xp: 12,
    scheduledFor: '2026-01-02T00:00:00.000Z',
    signal: { hintsUsed: 0, attempt: 1 },
  } as StudyResult;
  const disputed = disputedResult(previous, 'content-error', 'en');
  assert.equal(disputed.disputed, true);
  assert.equal(disputed.xp, 0);
  assert.equal(disputed.scheduledFor, undefined);
  assert.match(disputed.message, /flagged/u);
});

test('combo drží jen čistá odpověď bez nápovědy na první pokus', () => {
  const signal = { hintsUsed: 0, attempt: 1 } as StudyResult['signal'];
  assert.equal(isCleanAnswer({ correct: true, signal }), true);
  assert.equal(isCleanAnswer({ correct: true, signal: { ...signal, hintsUsed: 1 } }), false);
  assert.equal(isCleanAnswer({ correct: false, signal }), false);
});

test('nápověda a odpočet čekání', () => {
  assert.equal(hintText(note('a', 'Haus', 'das'), 'cs'), 'Začíná na „H“ a má 4 písmen.');
  assert.equal(hintText(note('b', 'guten Morgen'), 'en'), 'It starts with “g” and has 2 words.');
  assert.equal(formatWait(4_100), '5 s');
  assert.equal(formatWait(65_000), '1:05');
});
