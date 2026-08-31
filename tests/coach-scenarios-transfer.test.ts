import assert from 'node:assert/strict';
import test from 'node:test';

import { assessCoachMessage } from '../src/lib/domain/course/coach-relevance.ts';
import {
  transferCoachScenarios,
  transferCoachScenarioIdByChapterId,
} from '../src/lib/domain/course/coach-scenarios-transfer.ts';
import { coursePathChapters } from '../src/lib/domain/course/path.ts';

test('cílené transferové mise pokrývají 35 největších tematických mezer', () => {
  assert.equal(transferCoachScenarios.length, 35);
  assert.equal(Object.keys(transferCoachScenarioIdByChapterId).length, 35);
  assert.equal(new Set(transferCoachScenarios.map((scenario) => scenario.id)).size, 35);

  for (const [chapterId, scenarioId] of Object.entries(transferCoachScenarioIdByChapterId)) {
    const chapter = coursePathChapters.find((candidate) => candidate.id === chapterId);
    assert.ok(chapter, `chybí kapitola ${chapterId}`);
    assert.equal(chapter.coachScenarioId, scenarioId, `${chapterId} potřebuje cílenou misi`);
    assert.ok(chapter.coachScenarioIds.includes(scenarioId));
  }
});

test('každý ukázkový tah transferové mise je relevantní a okamžitě hratelný', () => {
  for (const scenario of transferCoachScenarios) {
    assert.equal(scenario.turns, 3);
    assert.equal(scenario.starterPrompts.length, 3);
    assert.equal(scenario.contextCues.length, 8);

    if (scenario.level === 'A1' || scenario.level === 'A2') {
      assert.equal(scenario.guidedHints?.length, 3, `${scenario.id} potřebuje tři nápovědy`);
    }

    for (const [index, message] of scenario.starterPrompts.entries()) {
      const result = assessCoachMessage({
        scenario,
        message,
        turn: index + 1,
        history: [{ role: 'coach', text: scenario.opening }],
      });
      assert.equal(
        result.accepted,
        true,
        `${scenario.id}, tah ${index + 1}: ${result.issue ?? 'odmítnuto'}`,
      );
    }
  }
});
