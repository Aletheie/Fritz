import assert from 'node:assert/strict';
import test from 'node:test';

import {
  courseDictationWordCount,
  gradeCourseDictation,
} from '../src/lib/domain/course/dictation.ts';

test('diktát hodnotí slyšená slova a ne interpunkci nebo velikost písmen', () => {
  const result = gradeCourseDictation(
    'ich fahre morgen mit dem zug',
    'Ich fahre morgen mit dem Zug.',
  );

  assert.equal(result.correct, true);
  assert.equal(result.exact, true);
  assert.equal(result.keyboardEquivalent, false);
  assert.equal(result.submittedWordCount, 6);
  assert.equal(result.expectedWordCount, 6);
});

test('diktát přijme českou klávesnicovou náhradu, ale ne špatný slovosled', () => {
  const keyboard = gradeCourseDictation('Die Strasse ist schoen', 'Die Straße ist schön.');
  const wrongOrder = gradeCourseDictation('Schön ist die Straße', 'Die Straße ist schön.');

  assert.equal(keyboard.correct, true);
  assert.equal(keyboard.exact, false);
  assert.equal(keyboard.keyboardEquivalent, true);
  assert.equal(wrongOrder.correct, false);
});

test('počet slov pro nápovědu odpovídá slyšitelným tokenům', () => {
  assert.equal(courseDictationWordCount('Wann fährt der ICE nach München?'), 6);
});
