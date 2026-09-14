import type { CaseChoiceId, CaseId, CaseStepProgress } from './types.ts';

type CaseRule = {
  clueIds: readonly string[];
  unlockSteps?: Readonly<Record<string, number>>;
  steps: ReadonlyArray<{ choiceId: CaseChoiceId; clueIds: readonly string[] }>;
};

// Small, stable identifiers belong in backups. Story text is loaded only by the cases routes.
export const caseRules: Record<CaseId, CaseRule> = {
  'empty-frame': {
    clueIds: [
      'frame-missing',
      'frame-guest',
      'frame-opening',
      'frame-identity',
      'frame-empty',
      'frame-coats',
      'frame-cleaning',
      'frame-packed',
      'frame-call',
      'frame-shipped',
      'frame-unopened',
      'frame-motif',
      'frame-stamp',
      'frame-safe',
    ],
    unlockSteps: {
      'frame-cleaning': 1,
      'frame-packed': 1,
      'frame-call': 1,
      'frame-shipped': 1,
      'frame-unopened': 1,
      'frame-motif': 2,
      'frame-stamp': 2,
      'frame-safe': 2,
    },
    steps: [
      { choiceId: 'b', clueIds: ['frame-opening', 'frame-empty'] },
      { choiceId: 'c', clueIds: ['frame-packed', 'frame-shipped'] },
      { choiceId: 'a', clueIds: ['frame-identity', 'frame-stamp'] },
    ],
  },
  backpack: {
    clueIds: [
      'bag-description',
      'bag-last',
      'bag-need',
      'bag-red',
      'bag-blue',
      'bag-stop',
      'bag-hours',
      'bag-proof',
      'bag-saturday',
    ],
    steps: [
      { choiceId: 'b', clueIds: ['bag-description', 'bag-blue'] },
      { choiceId: 'c', clueIds: ['bag-stop', 'bag-hours'] },
      { choiceId: 'a', clueIds: ['bag-proof'] },
    ],
  },
  soundcheck: {
    clueIds: [
      'show-place',
      'show-time',
      'show-ticket',
      'show-move',
      'show-same',
      'show-delay',
      'show-valid',
      'show-rumor',
      'show-arrival',
      'show-refund',
    ],
    steps: [
      { choiceId: 'c', clueIds: ['show-move', 'show-same'] },
      { choiceId: 'a', clueIds: ['show-time', 'show-delay'] },
      { choiceId: 'b', clueIds: ['show-valid'] },
    ],
  },
};

export function caseEvidenceAvailable(caseId: CaseId, stepIndex: number, clueId: string): boolean {
  const rule = caseRules[caseId];
  return rule.clueIds.includes(clueId) && (rule.unlockSteps?.[clueId] ?? 0) <= stepIndex;
}

export function caseAnswerMatches(
  caseId: CaseId,
  stepIndex: number,
  answer: CaseStepProgress,
): boolean {
  const rule = caseRules[caseId].steps[stepIndex];
  return Boolean(
    rule &&
    answer.choiceId === rule.choiceId &&
    answer.clueIds.length === rule.clueIds.length &&
    rule.clueIds.every((id) => answer.clueIds.includes(id)),
  );
}
