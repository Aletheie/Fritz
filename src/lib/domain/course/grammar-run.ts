import { stableHash } from '../deterministic.ts';

function nextGrammarRandom(state: number): number {
  let value = state + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return (value ^ (value >>> 14)) >>> 0;
}

export function grammarChoiceOptions(options: readonly string[], seed: string): string[] {
  const shuffled = [...options];
  let state = stableHash(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = nextGrammarRandom(state);
    const target = state % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function completedGrammarRunFirstTry(input: {
  questionIds: readonly string[];
  initiallyMasteredQuestionIds: ReadonlySet<string>;
  attemptedQuestionIds: ReadonlySet<string>;
  sessionCorrectFirstTry: number;
  reviewRun: boolean;
}): number | undefined {
  const completed = input.questionIds.every((questionId) =>
    input.reviewRun
      ? input.attemptedQuestionIds.has(questionId)
      : input.initiallyMasteredQuestionIds.has(questionId) ||
        input.attemptedQuestionIds.has(questionId),
  );
  if (!completed) return undefined;

  const persistedMastery = input.reviewRun
    ? 0
    : input.questionIds.filter((questionId) => input.initiallyMasteredQuestionIds.has(questionId))
        .length;
  return Math.min(
    input.questionIds.length,
    Math.max(0, Math.round(persistedMastery + input.sessionCorrectFirstTry)),
  );
}
