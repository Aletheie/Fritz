import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCourseContent } from '../src/lib/domain/course/content-validation.ts';
import {
  CORE_COURSE_CHAPTER_IDS,
  COURSE_CONTENT_VERSION,
} from '../src/lib/domain/course/content-version.ts';
import { grammarLessonIds } from '../src/lib/domain/course/grammar-lesson-ids.ts';
import { grammarLessonById, grammarLessons } from '../src/lib/domain/course/grammar.ts';
import { coursePathChapters } from '../src/lib/domain/course/path.ts';
import { DETAILED_CEFR_LEVELS } from '../src/lib/domain/levels.ts';

test('versioned course catalog passes referential, lexical and pedagogical validation', () => {
  const result = validateCourseContent();
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(result.counts.chapters, 120);
  assert.equal(result.counts.legacyChapters, 10);
  assert.equal(result.counts.additiveChapters, 110);
  assert.equal(result.counts.nodes, 960);
  assert.ok(result.counts.uniqueLexemes >= 550);
  assert.ok(result.counts.modelSentences >= 480);
  assert.equal(result.counts.listeningDictations, 120);
  assert.equal(result.counts.errorClinics, 120);
  assert.equal(result.counts.dialogues, 120);
  assert.equal(result.counts.coherentDialogues, 120);
  assert.equal(result.counts.assessments, 120);
  assert.equal(result.counts.grammarLessons, 125);
  assert.equal(result.counts.grammarQuestions, 625);
  assert.equal(result.counts.coachScenarios, 96);
  assert.equal(result.counts.dedicatedTransferCoachScenarios, 35);
  assert.equal(result.counts.transferThreads, 70);
  assert.equal(result.counts.diversityBridges, 20);
  for (const level of DETAILED_CEFR_LEVELS) {
    assert.equal(
      coursePathChapters.filter((chapter) => chapter.level === level).length,
      12,
      `${level} musí obsahovat dvanáct kapitol`,
    );
  }
});

test('lightweight migration identities stay identical to the authored catalogs', () => {
  assert.deepEqual(
    [...CORE_COURSE_CHAPTER_IDS],
    coursePathChapters.map((chapter) => chapter.id),
  );
  assert.deepEqual(
    [...grammarLessonIds],
    grammarLessons.map((lesson) => lesson.id),
  );
});

test('all legacy chapter and node IDs remain stable after content v4 expansion', () => {
  for (let legacyNumber = 1; legacyNumber <= 10; legacyNumber += 1) {
    const id = `chapter-${String(legacyNumber).padStart(2, '0')}-${
      [
        'school',
        'day',
        'travel',
        'plans',
        'home-work',
        'process',
        'project',
        'negotiation',
        'argument',
        'style',
      ][legacyNumber - 1]
    }`;
    const chapter = coursePathChapters.find((candidate) => candidate.id === id);
    assert.ok(chapter, id);
    assert.equal(chapter.legacyAnchor, true);
    assert.equal(chapter.legacyNumber, legacyNumber);
    assert.equal(chapter.nodes.length, 8);
    assert.ok(chapter.nodes.every((node) => node.id.startsWith(`${id}:`)));
  }
  assert.equal(COURSE_CONTENT_VERSION, 4);
});

test('graded model answers preserve the exact German meaning taught by their Czech prompts', () => {
  const numbers = grammarLessonById('numbers-and-prices');
  const pronouns = grammarLessonById('indefinite-pronouns');
  const conditional = grammarLessonById('conditional-without-wenn');
  const jobs = coursePathChapters.find((chapter) => chapter.id === 'chapter-05-home-work');
  assert.ok(numbers);
  assert.ok(pronouns);
  assert.ok(conditional);
  assert.ok(jobs);

  const seventySix = numbers.questions.at(-1);
  assert.equal(seventySix?.kind, 'fill');
  if (seventySix?.kind === 'fill') assert.deepEqual(seventySix.answers, ['Sechsundsiebzig']);

  const negation = pronouns.questions.at(-1);
  assert.equal(negation?.kind, 'order');
  assert.match(negation?.explanation ?? '', /„etwas“/u);
  assert.doesNotMatch(negation?.explanation ?? '', /Předmět je „nichts“/iu);

  const counterfactual = conditional.questions.at(-1);
  assert.equal(counterfactual?.kind, 'order');
  if (counterfactual?.kind === 'order') {
    assert.equal(counterfactual.tokens.filter((token) => token === 'es').length, 2);
    assert.equal(counterfactual.answer.join(' '), 'Hätte ich es gewusst, hätte ich es dir gesagt.');
  }

  assert.ok(
    jobs.modelSentences.some(
      (sentence) =>
        sentence.cs === 'Moje žádost odpovídá pozici, pro kterou je moje zkušenost užitečná.' &&
        sentence.de ===
          'Meine Bewerbung passt zu einer Stelle, für die meine Erfahrung nützlich ist.',
    ),
  );
});
