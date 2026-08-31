import type { DailyMinutes } from '../types.ts';

export type DailyLearningTargets = {
  minutes: DailyMinutes;
  vocabulary: number;
  grammar: number;
  coach: number;
  total: number;
};

const TARGETS: Record<DailyMinutes, Omit<DailyLearningTargets, 'minutes' | 'total'>> = {
  5: { vocabulary: 2, grammar: 2, coach: 1 },
  10: { vocabulary: 3, grammar: 3, coach: 2 },
  20: { vocabulary: 5, grammar: 5, coach: 3 },
};

export function dailyLearningTargets(minutes: DailyMinutes): DailyLearningTargets {
  const target = TARGETS[minutes];
  return {
    minutes,
    ...target,
    total: target.vocabulary + target.grammar + target.coach,
  };
}

// Kept as the full-session aliases for code and imported backups created before time modes.
export const DAILY_VOCABULARY_TARGET = TARGETS[20].vocabulary;
export const DAILY_GRAMMAR_TARGET = TARGETS[20].grammar;
export const DAILY_COACH_TURN_TARGET = TARGETS[20].coach;
export const DAILY_LEARNING_STEP_TARGET = dailyLearningTargets(20).total;
