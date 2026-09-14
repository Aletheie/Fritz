import assert from 'node:assert/strict';
import { test } from 'node:test';
import { caseFiles } from '../src/lib/domain/cases/catalog.ts';
import { createCaseProgress, updateCaseProgress } from '../src/lib/domain/cases/engine.ts';
import { caseEvidenceAvailable, caseRules } from '../src/lib/domain/cases/rules.ts';
import type { CaseCommand, CaseId, CaseProgress } from '../src/lib/domain/cases/types.ts';
import { parseCaseProgressMap } from '../src/lib/domain/cases/validation.ts';

const started = new Date('2026-09-13T12:00:00.000Z');
const later = new Date('2026-09-13T12:05:00.000Z');

function move(
  progress: CaseProgress,
  caseId: CaseId,
  command: CaseCommand,
  now = later,
): CaseProgress {
  return updateCaseProgress(progress, { ...command, caseId, revision: progress.revision }, now);
}

function solveStep(progress: CaseProgress, caseId: CaseId): CaseProgress {
  const rule = caseRules[caseId].steps[progress.stepIndex];
  let next = move(progress, caseId, { type: 'choose', choiceId: rule.choiceId });
  for (const clueId of rule.clueIds) next = move(next, caseId, { type: 'evidence', clueId });
  return move(next, caseId, { type: 'submit' });
}

test('authored cases have complete bilingual support, unique evidence and grounded solutions at each reveal', () => {
  assert.deepEqual(caseFiles.map((item) => item.id).toSorted(), Object.keys(caseRules).toSorted());
  for (const item of caseFiles) {
    const rules = caseRules[item.id];
    assert.equal(item.steps.length, 3);
    assert.ok(item.documents.length >= 3 && item.documents.length <= 5);
    assert.equal(
      new Set(item.documents.map((document) => document.id)).size,
      item.documents.length,
    );
    const lines = item.documents.flatMap((document) => document.lines);
    assert.equal(new Set(lines.map((line) => line.id)).size, lines.length);
    assert.deepEqual(lines.map((line) => line.id).toSorted(), [...rules.clueIds].toSorted());
    assert.ok(lines.some((line) => line.textDe === item.previewDe));
    for (const [index, step] of item.steps.entries()) {
      assert.deepEqual(step.choices.map((choice) => choice.id).toSorted(), ['a', 'b', 'c']);
      assert.equal(new Set(step.choices.map((choice) => choice.textDe)).size, 3);
      assert.ok(step.choices.some((choice) => choice.id === rules.steps[index].choiceId));
      assert.ok(rules.steps[index].clueIds.length > 0);
      for (const id of rules.steps[index].clueIds) {
        const document = item.documents.find((candidate) =>
          candidate.lines.some((line) => line.id === id),
        );
        assert.ok(
          document && (document.availableFrom ?? 0) <= index,
          `${item.id}/${index}: solution must be available`,
        );
        assert.ok(caseEvidenceAvailable(item.id, index, id));
      }
      assert.ok(
        item.documents.some(
          (document) =>
            document.id === step.startDocumentId && (document.availableFrom ?? 0) <= index,
        ),
      );
      assert.ok(step.promptDe && step.replyDe && step.language.de);
    }
    const copy = [
      item.title,
      item.introduction,
      item.focus,
      item.takeaway,
      ...(item.reconstruction?.map((moment) => moment.event) ?? []),
      ...item.documents.flatMap((document) => [
        document.title,
        ...document.glossary.map((word) => word.meaning),
      ]),
      ...item.steps.flatMap((step) => [
        step.title,
        step.question,
        step.context,
        step.finding,
        step.hint,
        step.explanation,
        step.language.explanation,
        ...step.choices.map((choice) => choice.feedback),
      ]),
    ];
    for (const text of copy) {
      assert.ok(text.cs.trim().length > 0);
      assert.ok(text.en.trim().length > 0);
    }
    for (const document of item.documents) {
      for (const line of document.lines) {
        assert.equal(
          rules.unlockSteps?.[line.id] ?? 0,
          document.availableFrom ?? 0,
          'UI and persisted evidence access must agree',
        );
      }
    }
    // At least one conclusion in each case actually combines separate documents.
    assert.ok(
      rules.steps.some(
        (rule) =>
          new Set(
            rule.clueIds.map(
              (id) =>
                item.documents.find((document) => document.lines.some((line) => line.id === id))
                  ?.id,
            ),
          ).size > 1,
      ),
    );
  }
});

test('a conclusion alone, a wrong clue, and all clues cannot bypass evidence matching', () => {
  let progress = createCaseProgress(started);
  assert.strictEqual(move(progress, 'backpack', { type: 'continue' }), progress);
  progress = move(progress, 'backpack', { type: 'choose', choiceId: 'b' });
  assert.strictEqual(move(progress, 'backpack', { type: 'submit' }), progress);
  progress = move(progress, 'backpack', { type: 'evidence', clueId: 'bag-description' });
  progress = move(progress, 'backpack', { type: 'evidence', clueId: 'bag-red' });
  progress = move(progress, 'backpack', { type: 'submit' });
  assert.equal(progress.answers[0].feedback, 'evidence');
  assert.equal(progress.answers[0].attempts, 1);
  assert.strictEqual(move(progress, 'backpack', { type: 'submit' }), progress);
  assert.strictEqual(move(progress, 'backpack', { type: 'continue' }), progress);
  progress = move(progress, 'backpack', { type: 'evidence', clueId: 'bag-blue' });
  assert.strictEqual(move(progress, 'backpack', { type: 'submit' }), progress);
  progress = move(progress, 'backpack', { type: 'evidence', clueId: 'bag-red' });
  progress = move(progress, 'backpack', { type: 'submit' });
  assert.equal(progress.answers[0].feedback, 'correct');
  assert.equal(progress.answers[0].attempts, 2);
  assert.strictEqual(move(progress, 'backpack', { type: 'choose', choiceId: 'a' }), progress);
  assert.strictEqual(move(progress, 'backpack', { type: 'restart' }), progress);
});

test('wrong conclusions get separate feedback and a hint does not erase an attempt', () => {
  let progress = createCaseProgress(started);
  progress = move(progress, 'soundcheck', { type: 'choose', choiceId: 'a' });
  for (const clueId of caseRules.soundcheck.steps[0].clueIds)
    progress = move(progress, 'soundcheck', { type: 'evidence', clueId });
  progress = move(progress, 'soundcheck', { type: 'submit' });
  assert.equal(progress.answers[0].feedback, 'choice');
  progress = move(progress, 'soundcheck', { type: 'hint' });
  assert.equal(progress.answers[0].hintUsed, true);
  assert.equal(progress.answers[0].attempts, 1);
  assert.equal(progress.answers[0].feedback, 'choice');
  assert.strictEqual(move(progress, 'soundcheck', { type: 'hint' }), progress);
});

test('all complete cases survive every saved state, reject stale clicks, and keep the first completion on replay', () => {
  for (const item of caseFiles) {
    let progress = createCaseProgress(started);
    for (let index = 0; index < item.steps.length; index += 1) {
      progress = solveStep(progress, item.id);
      assert.equal(progress.answers[index].feedback, 'correct');
      const staleRevision = progress.revision;
      progress = move(progress, item.id, { type: 'continue' });
      assert.strictEqual(
        updateCaseProgress(
          progress,
          { type: 'continue', caseId: item.id, revision: staleRevision },
          later,
        ),
        progress,
      );
      assert.equal(progress.stepIndex, index + 1);
      const parsed = parseCaseProgressMap(JSON.parse(JSON.stringify({ [item.id]: progress })))[
        item.id
      ]!;
      assert.deepEqual(JSON.parse(JSON.stringify(parsed)), JSON.parse(JSON.stringify(progress)));
    }
    assert.equal(progress.completedAt, later.toISOString());
    assert.equal(progress.firstCompletedAt, later.toISOString());
    assert.strictEqual(move(progress, item.id, { type: 'hint' }), progress);
    const replay = move(
      progress,
      item.id,
      { type: 'restart' },
      new Date('2026-09-14T12:00:00.000Z'),
    );
    assert.equal(replay.completedAt, undefined);
    assert.equal(replay.firstCompletedAt, progress.completedAt);
    assert.equal(replay.stepIndex, 0);
    assert.deepEqual(replay.answers, [{ clueIds: [], hintUsed: false, attempts: 0 }]);
    assert.equal(replay.revision, progress.revision + 1);
    assert.doesNotThrow(() => parseCaseProgressMap({ [item.id]: replay }));
  }
});

test('unreleased evidence cannot be used or restored from a backup, and unlocks only when the investigation advances', () => {
  let progress = createCaseProgress(started);
  assert.throws(() => move(progress, 'empty-frame', { type: 'evidence', clueId: 'frame-packed' }));
  const forged = structuredClone(progress);
  forged.answers[0].clueIds = ['frame-stamp'];
  assert.throws(() => parseCaseProgressMap({ 'empty-frame': forged }));
  progress = solveStep(progress, 'empty-frame');
  assert.equal(caseEvidenceAvailable('empty-frame', progress.stepIndex, 'frame-packed'), false);
  progress = move(progress, 'empty-frame', { type: 'continue' });
  progress = move(progress, 'empty-frame', { type: 'evidence', clueId: 'frame-packed' });
  assert.deepEqual(progress.answers[1].clueIds, ['frame-packed']);
  assert.throws(() => move(progress, 'empty-frame', { type: 'evidence', clueId: 'frame-stamp' }));
  assert.doesNotThrow(() => parseCaseProgressMap({ 'empty-frame': progress }));
});

test('backup validation rejects arrays in place of choice identifiers', () => {
  const progress = createCaseProgress(started);
  assert.throws(() =>
    parseCaseProgressMap({
      backpack: {
        ...progress,
        answers: [{ ...progress.answers[0], choiceId: ['a'] }],
      },
    }),
  );
});

test('backup validation rejects fabricated wins, duplicate and foreign clues, skipped steps and invalid dates', () => {
  const current = solveStep(createCaseProgress(started), 'backpack');
  assert.deepEqual(parseCaseProgressMap(undefined), {});
  const mutations: Array<(value: CaseProgress) => void> = [
    (value) => {
      value.answers[0].clueIds = ['bag-description', 'bag-description'];
    },
    (value) => {
      value.answers[0].clueIds = ['bag-description', 'show-valid'];
    },
    (value) => {
      value.answers[0].choiceId = 'a';
    },
    (value) => {
      value.answers[0].feedback = 'evidence';
    },
    (value) => {
      value.answers[0].attempts = 0;
    },
    (value) => {
      value.stepIndex = 2;
    },
    (value) => {
      value.completedAt = later.toISOString();
    },
    (value) => {
      value.firstCompletedAt = '2029-01-01T00:00:00Z';
    },
    (value) => {
      value.updatedAt = '2025-01-01T00:00:00Z';
    },
    (value) => {
      value.startedAt = 'not a date';
    },
    (value) => {
      value.revision = Infinity;
    },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(current);
    mutate(copy);
    assert.throws(() => parseCaseProgressMap({ backpack: copy }));
  }
  assert.throws(() => parseCaseProgressMap({ unknown: current }));
  assert.throws(() => parseCaseProgressMap(JSON.parse('{"__proto__":{}}')));
  assert.throws(() =>
    move(createCaseProgress(started), 'soundcheck', { type: 'evidence', clueId: 'bag-blue' }),
  );
});
