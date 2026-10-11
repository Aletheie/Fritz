import type { EvidenceModality, LearningEvidence, SkillStage, SkillState } from './types.ts';

const DAY_MS = 86_400_000;
const STAGE_INTERVAL_DAYS: Record<SkillStage, number> = {
  0: 1,
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

const MODALITY_STAGE_CAP: Record<EvidenceModality, SkillStage> = {
  recognition: 2,
  'guided-recall': 4,
  dictation: 4,
  'free-production': 5,
  reading: 3,
};

export type VocabularySkillAspect = 'meaning' | 'recall' | 'article' | 'plural' | 'form';

export function vocabularySkillId(noteId: string, aspect: VocabularySkillAspect): string {
  return `vocabulary:${noteId}:${aspect}`;
}

export function grammarSkillId(lessonId: string): string {
  return `grammar:${lessonId}`;
}

export function listeningSkillId(chapterId: string): string {
  return `listening:${chapterId}`;
}

export function communicationSkillId(scenarioId: string): string {
  return `communication:${scenarioId}`;
}

function clampStage(value: number): SkillStage {
  return Math.max(0, Math.min(5, value)) as SkillStage;
}

function nextReviewAt(occurredAt: string, stage: SkillStage): string {
  return new Date(Date.parse(occurredAt) + STAGE_INTERVAL_DAYS[stage] * DAY_MS).toISOString();
}

export function applyEvidenceToSkillState(
  current: SkillState | undefined,
  evidence: LearningEvidence,
  skillId: string,
): SkillState {
  const initial: SkillState = current ?? {
    skillId,
    stage: 0,
    nextReviewAt: evidence.occurredAt,
    independentSuccesses: 0,
    attempts: 0,
  };

  if (evidence.excludedFromLearning || evidence.mode === 'cram' || evidence.outcome === 'skipped') {
    return initial;
  }

  const successful = evidence.outcome === 'correct' || evidence.outcome === 'completed';
  const independent = successful && evidence.independent && evidence.hintsUsed === 0;
  const cap = MODALITY_STAGE_CAP[evidence.modality];
  const occurredAt = Date.parse(evidence.occurredAt);
  const previousDueAt = Date.parse(initial.nextReviewAt);
  const due = !Number.isFinite(previousDueAt) || previousDueAt <= occurredAt;
  // A second answer minutes later is practice, not another spaced retrieval.
  // Recognition also cannot renew a skill demonstrated through free production.
  const renewsMastery = independent && due && cap >= initial.stage;
  const stage = successful
    ? renewsMastery
      ? clampStage(Math.max(initial.stage, Math.min(cap, initial.stage + 1)))
      : initial.stage
    : clampStage(initial.stage - 1);

  const nextDueAt = !successful
    ? nextReviewAt(evidence.occurredAt, 0)
    : renewsMastery
      ? nextReviewAt(evidence.occurredAt, stage)
      : current && Number.isFinite(previousDueAt)
        ? initial.nextReviewAt
        : nextReviewAt(evidence.occurredAt, 0);

  return {
    skillId,
    stage,
    nextReviewAt: nextDueAt,
    independentSuccesses: initial.independentSuccesses + (independent ? 1 : 0),
    attempts: initial.attempts + 1,
    lastEvidenceAt: evidence.occurredAt,
    lastWeakness:
      evidence.outcome === 'incorrect'
        ? (evidence.mistakeTags?.[0] ?? initial.lastWeakness)
        : initial.lastWeakness,
  };
}

export function deriveSkillStates(evidence: LearningEvidence[]): SkillState[] {
  const stateBySkill = new Map<string, SkillState>();
  const ordered = evidence.toSorted(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id),
  );
  for (const event of ordered) {
    if (event.excludedFromLearning || event.mode === 'cram' || event.outcome === 'skipped') {
      continue;
    }
    for (const skillId of new Set(event.skillIds)) {
      stateBySkill.set(
        skillId,
        applyEvidenceToSkillState(stateBySkill.get(skillId), event, skillId),
      );
    }
  }
  return [...stateBySkill.values()].toSorted((left, right) =>
    left.skillId.localeCompare(right.skillId),
  );
}

export function deriveSkillState(
  evidence: LearningEvidence[],
  skillId: string,
): SkillState | undefined {
  let state: SkillState | undefined;
  const ordered = evidence.toSorted(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id),
  );
  for (const event of ordered) {
    if (
      event.excludedFromLearning ||
      event.mode === 'cram' ||
      event.outcome === 'skipped' ||
      !event.skillIds.includes(skillId)
    ) {
      continue;
    }
    state = applyEvidenceToSkillState(state, event, skillId);
  }
  return state;
}

export function skillStageCap(modality: EvidenceModality): SkillStage {
  return MODALITY_STAGE_CAP[modality];
}
