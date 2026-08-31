import assert from 'node:assert/strict';
import test from 'node:test';

import { supplementalCoachScenarios } from '../src/lib/domain/course/coach-scenarios-supplement.ts';
import {
  courseChapterContentSupplements,
  supplementalCourseWords,
} from '../src/lib/domain/course/course-content-supplement.ts';
import { supplementalGrammarLessons } from '../src/lib/domain/course/grammar-supplement.ts';
import { coursePathChapterById } from '../src/lib/domain/course/path.ts';

test('tematické rozšíření přidává nejméně 50 samostatných obsahových položek', () => {
  const grammarQuestions = supplementalGrammarLessons.flatMap((lesson) => lesson.questions);
  const totalItems =
    supplementalCourseWords.length + grammarQuestions.length + supplementalCoachScenarios.length;

  assert.equal(supplementalCourseWords.length, 50);
  assert.equal(grammarQuestions.length, 25);
  assert.equal(supplementalCoachScenarios.length, 5);
  assert.equal(totalItems, 80);
  assert.equal(
    new Set(supplementalCourseWords.map((word) => word.german.toLocaleLowerCase('de-DE'))).size,
    supplementalCourseWords.length,
  );
});

test('každý tematický balíček je připojený ke kapitole, gramatice i AI konverzaci', () => {
  const lessonIds = new Set(supplementalGrammarLessons.map((lesson) => lesson.id));
  const scenarioIds = new Set(supplementalCoachScenarios.map((scenario) => scenario.id));

  assert.equal(Object.keys(courseChapterContentSupplements).length, 5);
  for (const [chapterId, supplement] of Object.entries(courseChapterContentSupplements)) {
    const chapter = coursePathChapterById(chapterId);
    assert.ok(chapter, `chybí kapitola ${chapterId}`);
    assert.equal(supplement.words.length, 10);
    assert.ok(
      supplement.words.every((word) =>
        chapter.words.some((chapterWord) => chapterWord.german === word.german),
      ),
      `${chapterId} neobsahuje všechna nová slova`,
    );
    assert.ok(
      supplement.grammarLessonIds.every(
        (lessonId) => lessonIds.has(lessonId) && chapter.grammarLessonIds.includes(lessonId),
      ),
      `${chapterId} nemá připojenou doplňkovou gramatiku`,
    );
    assert.ok(
      supplement.coachScenarioIds.every(
        (scenarioId) =>
          scenarioIds.has(scenarioId) && chapter.coachScenarioIds.includes(scenarioId),
      ),
      `${chapterId} nemá připojený AI scénář`,
    );
  }
});
