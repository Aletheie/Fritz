import assert from 'node:assert/strict';
import test from 'node:test';

import { createId } from '../src/lib/domain/id.ts';

test('entity IDs keep their namespace prefix and remain unique', () => {
  const first = createId('note');
  const second = createId('note');

  assert.match(first, /^note_/u);
  assert.match(second, /^note_/u);
  assert.notEqual(first, second);
});
