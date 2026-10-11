import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dailyActivityEvidence,
  expectedGrammarAnswer,
  gradeMeaning,
  grammarAnswerIsCorrect,
  grammarAnswerIsReady,
  orderedGrammarAnswer,
  toggleOrderIndex,
} from '../src/lib/domain/learning/daily-grading.ts';

import type { GrammarQuestion } from '../src/lib/domain/course/grammar.ts';
import type { DailySessionRecord, LessonActivity } from '../src/lib/domain/learning/types.ts';
import type { Note } from '../src/lib/domain/types.ts';

const note = {
  id: 'n',
  german: 'Haus',
  czech: 'dům',
  acceptedCzech: ['domov'],
} as Note;

test('význam: přijme hlavní i alternativní překlad', () => {
  assert.equal(gradeMeaning(note, ' Dům ', 900, 0, 'cs').correct, true);
  assert.equal(gradeMeaning(note, 'domov', 900, 0, 'cs').rating, 'good');
  const wrong = gradeMeaning(note, 'auto', 900, 1, 'en');
  assert.equal(wrong.rating, 'again');
  assert.equal(wrong.signal.hintsUsed, 1);
  assert.match(wrong.message, /practise/u);
});

test('gramatika: připravenost, správnost a očekávaná odpověď', () => {
  const order = {
    kind: 'order',
    tokens: ['gehe', 'Ich', 'heute'],
    answer: ['Ich', 'gehe', 'heute'],
  } as GrammarQuestion;
  const draft = { choice: '', text: '', orderIndexes: [1, 0] };
  assert.equal(grammarAnswerIsReady(order, draft), false);
  const full = { ...draft, orderIndexes: [1, 0, 2] };
  assert.equal(orderedGrammarAnswer(order, full), 'Ich gehe heute');
  assert.equal(grammarAnswerIsCorrect(order, full), true);
  assert.equal(expectedGrammarAnswer(order, 'cs'), 'Ich gehe heute');

  const fill = { kind: 'fill', answers: ['bin', 'bin ja'] } as GrammarQuestion;
  assert.equal(grammarAnswerIsCorrect(fill, { choice: '', text: ' Bin ', orderIndexes: [] }), true);
  assert.equal(grammarAnswerIsReady(fill, { choice: '', text: '  ', orderIndexes: [] }), false);
});

test('pořadí tokenů se přepíná a zachovává pořadí výběru', () => {
  assert.deepEqual(toggleOrderIndex([2, 0], 1), [2, 0, 1]);
  assert.deepEqual(toggleOrderIndex([2, 0, 1], 0), [2, 1]);
});

test('důkaz z denní lekce má idempotentní ID a kopíruje dovednosti', () => {
  const session = { key: 'day-1', plan: { localDay: '2026-10-11' } } as DailySessionRecord;
  const activity = { id: 'a1', skillIds: ['s1'] } as unknown as LessonActivity;
  const evidence = dailyActivityEvidence({
    session,
    activity,
    source: 'listening-dictation',
    sourceId: 'audio',
    modality: 'dictation',
    correct: false,
    independent: false,
    hintsUsed: 0,
    responseMs: 1200,
    occurredAt: new Date('2026-10-11T10:00:00.000Z'),
    mistakeTags: ['spelling'],
  });
  assert.equal(evidence.id, 'evidence:daily:day-1:a1');
  assert.equal(evidence.outcome, 'incorrect');
  assert.notEqual(evidence.skillIds, activity.skillIds);
  assert.deepEqual(evidence.mistakeTags, ['spelling']);
});
