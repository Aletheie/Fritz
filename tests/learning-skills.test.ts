import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyEvidenceToSkillState,
  deriveSkillStates,
  skillStageCap,
} from '../src/lib/domain/learning/skills.ts';
import type { LearningEvidence } from '../src/lib/domain/learning/types.ts';

function evidence(patch: Partial<LearningEvidence> = {}): LearningEvidence {
  return {
    id: patch.id ?? 'evidence:1',
    source: 'grammar-answer',
    sourceId: 'lesson-1',
    skillIds: ['grammar:lesson-1'],
    occurredAt: '2026-08-13T08:00:00.000Z',
    localDay: '2026-08-13',
    mode: 'long-term',
    modality: 'guided-recall',
    outcome: 'correct',
    hintsUsed: 0,
    responseMs: 1200,
    independent: true,
    ...patch,
  };
}

test('independent evidence advances a skill and schedules its next review', () => {
  const first = applyEvidenceToSkillState(undefined, evidence(), 'grammar:lesson-1');
  assert.equal(first.stage, 1);
  assert.equal(first.independentSuccesses, 1);
  assert.equal(first.attempts, 1);
  assert.equal(first.nextReviewAt, '2026-08-14T08:00:00.000Z');

  const second = applyEvidenceToSkillState(
    first,
    evidence({ id: 'evidence:2', occurredAt: '2026-08-14T08:00:00.000Z' }),
    first.skillId,
  );
  assert.equal(second.stage, 2);
  assert.equal(second.nextReviewAt, '2026-08-17T08:00:00.000Z');
});

test('assistance does not advance and an error lowers the stage', () => {
  const established = {
    skillId: 'grammar:lesson-1',
    stage: 3 as const,
    nextReviewAt: '2026-08-20T08:00:00.000Z',
    independentSuccesses: 3,
    attempts: 3,
  };
  const assisted = applyEvidenceToSkillState(
    established,
    evidence({ hintsUsed: 1, independent: false }),
    established.skillId,
  );
  assert.equal(assisted.stage, 3);

  const failed = applyEvidenceToSkillState(
    assisted,
    evidence({ id: 'evidence:failed', outcome: 'incorrect', mistakeTags: ['word-order'] }),
    established.skillId,
  );
  assert.equal(failed.stage, 2);
  assert.equal(failed.lastWeakness, 'word-order');
});

test('recognition is capped at stage 2 and cram never changes long-term state', () => {
  assert.equal(skillStageCap('recognition'), 2);
  const events = Array.from({ length: 6 }, (_, index) =>
    evidence({
      id: `recognition:${index}`,
      occurredAt: new Date(Date.UTC(2026, 7, 13 + index, 8)).toISOString(),
      modality: 'recognition',
    }),
  );
  const [state] = deriveSkillStates(events);
  assert.equal(state.stage, 2);

  const cram = applyEvidenceToSkillState(
    state,
    evidence({ id: 'cram', mode: 'cram', outcome: 'incorrect' }),
    state.skillId,
  );
  assert.deepEqual(cram, state);
});

test('excluded and skipped evidence are ignored', () => {
  assert.deepEqual(
    deriveSkillStates([
      evidence({ id: 'excluded', excludedFromLearning: true }),
      evidence({ id: 'skipped', outcome: 'skipped' }),
    ]),
    [],
  );
});

test('a correct lower-cap exercise preserves previously demonstrated mastery', () => {
  const established = {
    skillId: 'grammar:lesson-1',
    stage: 5 as const,
    nextReviewAt: '2026-09-12T08:00:00.000Z',
    independentSuccesses: 5,
    attempts: 5,
  };
  for (const modality of ['recognition', 'guided-recall', 'reading', 'dictation'] as const) {
    const result = applyEvidenceToSkillState(
      established,
      evidence({ modality }),
      established.skillId,
    );
    assert.equal(result.stage, 5, modality);
    assert.equal(result.attempts, 6);
    assert.equal(result.independentSuccesses, 6);
  }
});
