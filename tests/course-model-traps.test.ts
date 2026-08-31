import assert from 'node:assert/strict';
import test from 'node:test';

import { createWordOrderTrap } from '../src/lib/domain/course/course-model-traps.ts';
import { lexicalTokens } from '../src/lib/domain/grading/lexical.ts';

test('language-detective traps create plausible word-order errors', () => {
  assert.equal(createWordOrderTrap('Morgens trinke ich Tee.'), 'Morgens ich trinke Tee.');
  assert.equal(createWordOrderTrap('Die Schule beginnt um acht.'), 'Die Schule um acht beginnt.');
  assert.equal(createWordOrderTrap('Können Sie das wiederholen?'), 'Sie das wiederholen können?');
  assert.equal(
    createWordOrderTrap(
      'Wenn das Wetter wechselhaft bleibt, ziehe ich meine wasserdichte Jacke an.',
    ),
    'Wenn das Wetter wechselhaft bleibt, ich ziehe meine wasserdichte Jacke an.',
  );
});

test('word-order traps preserve the complete lexical token set', () => {
  const examples = [
    'Ich möchte ein Brötchen und eine Tasse Tee, bitte.',
    'Am Rathaus steige ich aus und an der nächsten Haltestelle wieder ein.',
    'Fährt dieser Bus zum Rathaus?',
  ];
  for (const example of examples) {
    const trap = createWordOrderTrap(example);
    assert.notEqual(trap, example);
    assert.deepEqual(lexicalTokens(trap).toSorted(), lexicalTokens(example).toSorted());
  }
});
