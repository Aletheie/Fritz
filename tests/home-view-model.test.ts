import assert from 'node:assert/strict';
import test from 'node:test';

import { createHomeViewModel } from '../src/lib/components/home/home-view-model.ts';
import { connectorPath, normalizedPathPosition } from '../src/lib/components/home/path-geometry.ts';
import { createCourseProgress } from '../src/lib/domain/course/grammar.ts';
import { coursePathChapters, coursePathViews } from '../src/lib/domain/course/path.ts';

const daily = {
  completed: 0,
  vocabularyCompleted: 0,
  grammarCompleted: 0,
  coachCompleted: 0,
  minutes: 10 as const,
  vocabularyGoal: 3,
  grammarGoal: 3,
  coachGoal: 2,
  goal: 8,
  percent: 0,
  reached: false,
};

test('due long-term cards are folded into the single daily lesson', () => {
  const chapters = coursePathViews(createCourseProgress(new Date(0)), 'A1.1');
  const model = createHomeViewModel({
    chapters,
    recommended: coursePathChapters[0].nodes[0],
    dueCount: 51,
    daily,
    game: { streak: 0, todayXp: 0, level: 1, levelTitle: 'Začátečnice' },
    activeBoost: false,
  });

  assert.equal(model.primary.kind, 'daily');
  assert.equal(model.primary.href, '/today/');
  assert.equal(model.primary.urgent, true);
  assert.equal(model.courseAction?.node.id, coursePathChapters[0].nodes[0].id);
});

test('the course recommendation stays available beside the daily lesson', () => {
  const chapters = coursePathViews(createCourseProgress(new Date(0)), 'A1.1');
  const recommendation = coursePathChapters[0].nodes[0];
  const model = createHomeViewModel({
    chapters,
    recommended: recommendation,
    dueCount: 0,
    daily,
    game: { streak: 2, todayXp: 12, level: 1, levelTitle: 'Začátečnice' },
    activeBoost: true,
  });

  assert.equal(model.primary.kind, 'daily');
  assert.equal(model.primary.href, '/today/');
  assert.notEqual(model.primary.href, model.courseAction?.href);
  assert.equal(model.courseAction?.xp, recommendation.xp * 2);
});

test('learning goal changes the explanation while keeping one primary destination', () => {
  const chapters = coursePathViews(createCourseProgress(new Date(0)), 'A1.1');
  const base = {
    chapters,
    recommended: coursePathChapters[0].nodes[0],
    dueCount: 0,
    daily,
    game: { streak: 0, todayXp: 0, level: 1, levelTitle: 'Začátečnice' },
    activeBoost: false,
  };

  const school = createHomeViewModel({ ...base, learningGoal: 'school' });
  const memory = createHomeViewModel({ ...base, learningGoal: 'memory' });
  const conversation = createHomeViewModel({ ...base, learningGoal: 'conversation' });
  assert.deepEqual(
    [school.primary.href, memory.primary.href, conversation.primary.href],
    ['/today/', '/today/', '/today/'],
  );
  assert.equal(
    new Set([
      school.primary.description,
      memory.primary.description,
      conversation.primary.description,
    ]).size,
    3,
  );
});

test('path geometry is data-driven, bounded and produces one smooth path', () => {
  const positions = Array.from({ length: 45 }, (_, index) => normalizedPathPosition(index, 45));
  assert.ok(positions.every((position) => Math.abs(position) <= 0.82));
  assert.equal(positions.at(-1), 0);
  assert.match(
    connectorPath([
      { x: 10, y: 10 },
      { x: 30, y: 80 },
      { x: 20, y: 150 },
    ]),
    /^M 10\.00 10\.00 C /u,
  );
  assert.equal(connectorPath([{ x: 1, y: 2 }]), '');
});
