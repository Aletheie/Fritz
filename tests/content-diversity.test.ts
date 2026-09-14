import assert from 'node:assert/strict';
import test from 'node:test';

import { diversityCoachScenarios } from '../src/lib/domain/course/coach-scenarios-diversity.ts';
import {
  diversityChapterBlueprints,
  diversityCourseChapterCount,
} from '../src/lib/domain/course/course-diversity-chapters.ts';
import { courseFoundations } from '../src/lib/domain/course/course-foundations.ts';
import { coursePathChapters } from '../src/lib/domain/course/path.ts';
import { DETAILED_CEFR_LEVELS } from '../src/lib/domain/levels.ts';

test('content v4 adds twenty complete topic chapters evenly across detailed CEFR levels', () => {
  const chapters = coursePathChapters.filter((chapter) => chapter.contentVersion === 4);
  assert.equal(diversityCourseChapterCount, 20);
  assert.equal(diversityChapterBlueprints.length, 20);
  assert.equal(chapters.length, 20);

  for (const level of DETAILED_CEFR_LEVELS) {
    assert.equal(
      chapters.filter((chapter) => chapter.level === level).length,
      2,
      `${level} musí dostat dvě nové tematické kapitoly`,
    );
  }

  for (const chapter of chapters) {
    assert.equal(
      chapter.words.length,
      10 + (courseFoundations[chapter.id]?.length ?? 0),
      `${chapter.id} musí učit deset tematických výrazů a připojené základy`,
    );
    assert.equal(chapter.modelSentences.length, 4);
    assert.equal(chapter.dialogue.length, 3);
    assert.match(chapter.themeTag, /^rozmanitost-/u);
    assert.equal(chapter.coachScenarioIds.includes(chapter.coachScenarioId), true);
  }
});

test('new topic lexemes are unique and every original topic has a dedicated speaking mission', () => {
  const chapters = coursePathChapters.filter((chapter) => chapter.contentVersion === 4);
  const lexemeIds = chapters.flatMap((chapter) => chapter.words.map((word) => word.id));
  const foundationCount = chapters.reduce(
    (sum, chapter) => sum + (courseFoundations[chapter.id]?.length ?? 0),
    0,
  );
  assert.equal(lexemeIds.length, 200 + foundationCount);
  assert.equal(new Set(lexemeIds).size, 200 + foundationCount);

  assert.equal(diversityCoachScenarios.length, 10);
  assert.equal(new Set(diversityCoachScenarios.map((scenario) => scenario.id)).size, 10);
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
    assert.equal(diversityCoachScenarios.filter((scenario) => scenario.level === level).length, 2);
  }

  const scenarioIds = new Set(diversityCoachScenarios.map((scenario) => scenario.id));
  const originalTopicChapters = chapters.filter((chapter) =>
    scenarioIds.has(chapter.coachScenarioId),
  );
  assert.equal(originalTopicChapters.length, 10);
});
