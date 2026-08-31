import type { DetailedCefrLevel } from '../types.ts';

export type CalibrationAnswer = 'correct' | 'incorrect' | 'unknown';

export type CalibrationRecommendation = {
  level: DetailedCefrLevel;
  correct: number;
  unknown: number;
};

const conservativeStartingLevels: DetailedCefrLevel[] = [
  'A1.1',
  'A1.1',
  'A1.2',
  'A2.1',
  'B1.1',
  'B2.1',
];

/**
 * Five placement prompts can only suggest a safe starting point. The result is
 * deliberately conservative and never claims a C1 placement from a tiny sample.
 */
export function recommendStartingLevel(
  answers: readonly CalibrationAnswer[],
): CalibrationRecommendation {
  const correct = answers.filter((answer) => answer === 'correct').length;
  const unknown = answers.filter((answer) => answer === 'unknown').length;
  return {
    level: conservativeStartingLevels[Math.min(correct, conservativeStartingLevels.length - 1)],
    correct,
    unknown,
  };
}
