import assert from 'node:assert/strict';
import test from 'node:test';

import { DETAILED_CEFR_LEVELS } from '../src/lib/domain/levels.ts';
import { recommendStartingLevel } from '../src/lib/domain/onboarding/calibration.ts';
import { onboardingLevels, parseOnboardingDraft } from '../src/lib/domain/onboarding/setup.ts';

test('setup recovery accepts only complete supported choices', () => {
  const draft = { step: 3, goal: 'conversation', level: 'B1.2', minutes: 20 };
  assert.deepEqual(parseOnboardingDraft(draft), draft);
  for (const value of [
    null,
    [],
    {},
    { ...draft, step: 4 },
    { ...draft, level: 'C2' },
    { ...draft, minutes: 99 },
    { ...draft, goal: 'unknown' },
  ]) {
    assert.equal(parseOnboardingDraft(value), undefined);
  }
});

test('every selectable starting level has a distinct practical description and German example', () => {
  assert.deepEqual(
    onboardingLevels.map((option) => option.level),
    DETAILED_CEFR_LEVELS,
  );
  assert.equal(new Set(onboardingLevels.map((option) => option.example)).size, 10);
  assert.ok(
    onboardingLevels.every((option) => option.title && option.description && option.example),
  );
});

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
