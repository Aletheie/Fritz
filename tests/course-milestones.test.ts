import assert from 'node:assert/strict';
import test from 'node:test';

import { courseMilestones } from '../src/lib/domain/course/course-milestones.ts';
import {
  coursePathQuestionsForNode,
  sentenceUsesCourseWord,
} from '../src/lib/domain/course/path-activities.ts';
import { coursePathChapters } from '../src/lib/domain/course/path.ts';
import { DETAILED_CEFR_LEVELS } from '../src/lib/domain/levels.ts';

test('every course band ends with a new, vocabulary-linked two-part practical mission', () => {
  assert.deepEqual(
    courseMilestones.map((milestone) => milestone.level),
    DETAILED_CEFR_LEVELS,
  );
  for (const milestone of courseMilestones) {
    const chapter = coursePathChapters.findLast((candidate) => candidate.level === milestone.level);
    assert.ok(chapter);
    assert.equal(milestone.chapterId, chapter.id);
    assert.ok(sentenceUsesCourseWord(milestone.scene, chapter.words), milestone.chapterId);
    for (const language of ['cs', 'en'] as const) {
      const checkpoint = coursePathQuestionsForNode(chapter, 'checkpoint', language);
      const tasks = checkpoint.filter((question) => question.kind === 'situation');
      assert.equal(tasks.length, 2);
      assert.deepEqual(checkpoint.slice(-2), tasks);
      for (const task of tasks) {
        assert.equal(task.context?.text, milestone.scene);
        assert.equal(task.context?.title, milestone.title[language]);
        assert.equal(task.promptLang, language);
        assert.equal(task.answerLang, 'de');
        assert.equal(task.options.length, 4);
        assert.equal(new Set(task.options).size, 4);
        assert.ok(task.options.includes(task.answer));
        assert.ok(task.explanation.length > 40);
        assert.ok(chapter.modelSentences.every((model) => model.de !== task.answer));
      }
    }
  }
});

test('reviewed topic nouns teach the correct article and definite form', () => {
  const words = coursePathChapters.flatMap((chapter) => chapter.words);
  for (const [lemma, expected] of [
    ['Übergabeprotokoll', 'das Übergabeprotokoll'],
    ['Gerücht', 'das Gerücht'],
    ['Freiwillige', 'der Freiwillige'],
  ]) {
    assert.equal(words.find((word) => word.german === lemma)?.displayGerman, expected);
  }
});
