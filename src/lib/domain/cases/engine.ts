import { caseAnswerMatches, caseEvidenceAvailable, caseRules } from './rules.ts';
import type { CaseAction, CaseProgress, CaseStepProgress } from './types.ts';

export function emptyCaseAnswer(): CaseStepProgress {
  return { clueIds: [], hintUsed: false, attempts: 0 };
}

export function createCaseProgress(now = new Date()): CaseProgress {
  return {
    revision: 0,
    stepIndex: 0,
    answers: [emptyCaseAnswer()],
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** A stale button click or a duplicate command cannot advance a different step. */
export function updateCaseProgress(
  stored: CaseProgress | undefined,
  action: CaseAction,
  now = new Date(),
): CaseProgress {
  const current = stored ?? createCaseProgress(now);
  if (current.revision !== action.revision) return current;
  const rules = caseRules[action.caseId];
  if (!rules) throw new Error('Unknown case.');
  const timestamp = new Date(Math.max(now.getTime(), Date.parse(current.updatedAt))).toISOString();
  if (action.type === 'restart') {
    if (!current.completedAt) return current;
    return {
      ...createCaseProgress(new Date(timestamp)),
      revision: current.revision + 1,
      firstCompletedAt: current.firstCompletedAt,
    };
  }
  if (current.completedAt) return current;
  const answer = current.answers[current.stepIndex];
  const rule = rules.steps[current.stepIndex];
  if (!answer || !rule) throw new Error('Invalid case step.');
  if (action.type === 'continue') {
    if (answer.feedback !== 'correct') return current;
    const stepIndex = current.stepIndex + 1;
    const done = stepIndex === rules.steps.length;
    return {
      ...current,
      revision: current.revision + 1,
      updatedAt: timestamp,
      stepIndex,
      answers: done ? current.answers : [...current.answers, emptyCaseAnswer()],
      completedAt: done ? timestamp : undefined,
      firstCompletedAt: done ? (current.firstCompletedAt ?? timestamp) : current.firstCompletedAt,
    };
  }
  if (answer.feedback === 'correct') return current;
  let next = { ...answer };
  if (action.type === 'choose') {
    if (!['a', 'b', 'c'].includes(action.choiceId)) throw new Error('Unknown case choice.');
    if (answer.choiceId === action.choiceId) return current;
    next = { ...answer, choiceId: action.choiceId, feedback: undefined };
  } else if (action.type === 'evidence') {
    if (!caseEvidenceAvailable(action.caseId, current.stepIndex, action.clueId))
      throw new Error('Case evidence is not available.');
    next = {
      ...answer,
      clueIds: answer.clueIds.includes(action.clueId)
        ? answer.clueIds.filter((id) => id !== action.clueId)
        : [...answer.clueIds, action.clueId],
      feedback: undefined,
    };
  } else if (action.type === 'hint') {
    if (answer.hintUsed) return current;
    next = { ...answer, hintUsed: true };
  } else if (action.type === 'submit') {
    if (!answer.choiceId || answer.clueIds.length !== rule.clueIds.length) return current;
    // Re-submitting an unchanged answer should not inflate the attempt count.
    if (answer.feedback) return current;
    next = {
      ...answer,
      attempts: Math.min(answer.attempts + 1, 1_000),
      feedback:
        answer.choiceId !== rule.choiceId
          ? 'choice'
          : caseAnswerMatches(action.caseId, current.stepIndex, answer)
            ? 'correct'
            : 'evidence',
    };
  }
  return {
    ...current,
    revision: current.revision + 1,
    updatedAt: timestamp,
    answers: current.answers.map((item, index) => (index === current.stepIndex ? next : item)),
  };
}
