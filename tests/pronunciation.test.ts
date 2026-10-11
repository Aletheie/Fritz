import assert from 'node:assert/strict';
import test from 'node:test';

import { assessPronunciation } from '../src/lib/domain/grading/pronunciation.ts';

test('a matching transcript is clear regardless of case and punctuation', () => {
  const result = assessPronunciation('der Bahnhof', 'Der Bahnhof.', 0.92);
  assert.equal(result.level, 'clear');
  assert.equal(result.score, 100);
  assert.equal(result.lowConfidence, false);
  assert.deepEqual(
    result.words.map((word) => word.word),
    ['der', 'Bahnhof'],
  );
});

test('lost umlauts and near misses are flagged per word', () => {
  const result = assessPronunciation('die Tür ist schön', 'die Tur ist schon');
  assert.deepEqual(
    result.words.map((word) => word.status),
    ['clear', 'umlaut', 'clear', 'umlaut'],
  );
  assert.equal(result.level, 'mostly');

  const near = assessPronunciation('Wohnung', 'Wohnnung');
  assert.equal(near.words[0].status, 'close');
});

test('missing words and filler are handled without misalignment', () => {
  const result = assessPronunciation('ich gehe nach Hause', 'äh ich gehe Hause', 0.4);
  assert.deepEqual(
    result.words.map((word) => word.status),
    ['clear', 'clear', 'missing', 'clear'],
  );
  assert.equal(result.lowConfidence, true);
  assert.equal(assessPronunciation('Haus', 'Maus').words[0].status, 'missing');
  assert.equal(assessPronunciation('Haus', '').level, 'unclear');
});
