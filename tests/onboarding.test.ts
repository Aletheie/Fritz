import assert from 'node:assert/strict';
import test from 'node:test';

import { recommendStartingLevel } from '../src/lib/domain/onboarding/calibration.ts';

test('orientační test doporučí bezpečný start a nepředstírá C1 přesnost', () => {
  assert.equal(
    recommendStartingLevel(['incorrect', 'unknown', 'incorrect', 'incorrect', 'unknown']).level,
    'A1.1',
  );
  assert.equal(
    recommendStartingLevel(['correct', 'correct', 'correct', 'incorrect', 'unknown']).level,
    'A2.1',
  );
  assert.equal(
    recommendStartingLevel(['correct', 'correct', 'correct', 'correct', 'correct']).level,
    'B2.1',
  );
});

test('orientační test vrací průhledný souhrn odpovědí', () => {
  const result = recommendStartingLevel(['correct', 'unknown', 'correct', 'incorrect', 'unknown']);
  assert.deepEqual(result, { level: 'A1.2', correct: 2, unknown: 2 });
});
