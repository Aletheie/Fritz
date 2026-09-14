import { caseAnswerMatches, caseEvidenceAvailable, caseRules } from './rules.ts';
import type {
  CaseChoiceId,
  CaseFeedback,
  CaseId,
  CaseProgressMap,
  CaseStepProgress,
} from './types.ts';

function invalid(): never {
  throw new Error('Uložený jazykový případ má neplatný formát.');
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function integer(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max)
    invalid();
  return value;
}
function date(value: unknown): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value)))
    invalid();
  return value;
}
function parseAnswer(value: unknown, caseId: CaseId, index: number): CaseStepProgress {
  const source = record(value);
  const rule = caseRules[caseId];
  if (
    !Array.isArray(source.clueIds) ||
    source.clueIds.length > rule.clueIds.length ||
    source.clueIds.some(
      (id) => typeof id !== 'string' || !caseEvidenceAvailable(caseId, index, id),
    ) ||
    new Set(source.clueIds).size !== source.clueIds.length ||
    typeof source.hintUsed !== 'boolean'
  )
    invalid();
  if (
    source.choiceId !== undefined &&
    (typeof source.choiceId !== 'string' || !['a', 'b', 'c'].includes(source.choiceId))
  )
    invalid();
  if (
    source.feedback !== undefined &&
    (typeof source.feedback !== 'string' ||
      !['choice', 'evidence', 'correct'].includes(source.feedback))
  )
    invalid();
  const answer: CaseStepProgress = {
    choiceId: source.choiceId as CaseChoiceId | undefined,
    clueIds: source.clueIds as string[],
    hintUsed: source.hintUsed,
    attempts: integer(source.attempts, 1_000),
    feedback: source.feedback as CaseFeedback | undefined,
  };
  if (answer.feedback) {
    if (
      !answer.attempts ||
      !answer.choiceId ||
      answer.clueIds.length !== rule.steps[index].clueIds.length
    )
      invalid();
    const expected =
      answer.choiceId !== rule.steps[index].choiceId
        ? 'choice'
        : caseAnswerMatches(caseId, index, answer)
          ? 'correct'
          : 'evidence';
    if (answer.feedback !== expected) invalid();
  }
  return answer;
}

export function parseCaseProgressMap(value: unknown): CaseProgressMap {
  if (value === undefined) return {};
  const source = record(value);
  const result: CaseProgressMap = {};
  for (const [key, raw] of Object.entries(source)) {
    if (!Object.hasOwn(caseRules, key)) invalid();
    const caseId = key as CaseId;
    const progress = record(raw);
    const count = caseRules[caseId].steps.length;
    const stepIndex = integer(progress.stepIndex, count);
    if (
      !Array.isArray(progress.answers) ||
      progress.answers.length !== Math.min(stepIndex + 1, count)
    )
      invalid();
    const answers = progress.answers.map((item, index) => parseAnswer(item, caseId, index));
    if (answers.slice(0, stepIndex).some((answer) => answer.feedback !== 'correct')) invalid();
    const startedAt = date(progress.startedAt);
    const updatedAt = date(progress.updatedAt);
    const completedAt = progress.completedAt === undefined ? undefined : date(progress.completedAt);
    const firstCompletedAt =
      progress.firstCompletedAt === undefined ? undefined : date(progress.firstCompletedAt);
    if (
      Date.parse(updatedAt) < Date.parse(startedAt) ||
      Boolean(completedAt) !== (stepIndex === count) ||
      (completedAt && (completedAt !== updatedAt || !firstCompletedAt)) ||
      (firstCompletedAt && Date.parse(firstCompletedAt) > Date.parse(updatedAt))
    )
      invalid();
    result[caseId] = {
      revision: integer(progress.revision, Number.MAX_SAFE_INTEGER),
      stepIndex,
      answers,
      startedAt,
      updatedAt,
      completedAt,
      firstCompletedAt,
    };
  }
  return result;
}
