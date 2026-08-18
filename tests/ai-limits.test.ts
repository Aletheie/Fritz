import assert from 'node:assert/strict';
import test from 'node:test';

import { AI_VOCABULARY_MAX_ITEMS } from '../src/lib/domain/ai/limits.ts';

test('AI vocabulary limit is a finite positive whole number', () => {
  assert.equal(Number.isInteger(AI_VOCABULARY_MAX_ITEMS), true);
  assert.equal(AI_VOCABULARY_MAX_ITEMS > 0, true);
  assert.equal(AI_VOCABULARY_MAX_ITEMS, 10);
});
