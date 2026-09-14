import assert from 'node:assert/strict';
import test from 'node:test';

import { courseCommunications } from '../src/lib/domain/course/course-communication.ts';
import {
  checkCourseWriting,
  courseWritingLimits,
  courseWritingCriteria,
} from '../src/lib/domain/course/course-writing.ts';
import {
  coursePathQuestionsForNode,
  courseSentenceRepair,
  gradeCourseRecall,
} from '../src/lib/domain/course/path-activities.ts';
import type { CoursePathQuestion } from '../src/lib/domain/course/path-activities.ts';
import { coursePathChapters } from '../src/lib/domain/course/path.ts';
import { DETAILED_CEFR_LEVELS } from '../src/lib/domain/levels.ts';

test('every band links gist and detail listening, writing, and a different unseen reading text', () => {
  assert.deepEqual(
    courseCommunications.map((item) => item.level),
    DETAILED_CEFR_LEVELS,
  );
  const verdicts = new Set<string>();
  for (const item of courseCommunications) {
    const chapter = coursePathChapters.findLast((candidate) => candidate.level === item.level);
    assert.ok(chapter);
    assert.equal(item.chapterId, chapter.id);
    assert.notEqual(item.listening.transcript, item.reading.text);
    assert.ok(
      !chapter.modelSentences.some((sentence) => sentence.de === item.listening.transcript),
    );
    assert.deepEqual(
      item.listening.tasks.map((task) => task.focus),
      ['gist', 'detail'],
    );
    verdicts.add(item.reading.verdict);
    assert.equal(
      checkCourseWriting(chapter, item.writing.model).ready,
      true,
      `${item.level}: model must meet the actual writing requirements`,
    );
    for (const language of ['cs', 'en'] as const) {
      const listening: CoursePathQuestion[] = coursePathQuestionsForNode(
        chapter,
        'mix',
        language,
      ).filter((question) => question.kind === 'listening');
      assert.equal(listening.length, 2);
      for (const [index, question] of listening.entries()) {
        assert.equal(question.audio?.transcript, item.listening.transcript);
        assert.equal(
          question.context,
          undefined,
          'Transcript must not leak through the shared context panel',
        );
        assert.equal(question.prompt, item.listening.tasks[index].prompt[language]);
        assert.equal(new Set(question.options).size, 4);
        assert.ok(question.options.includes(question.answer));
        assert.equal(question.answerLang, 'de');
      }
      const evidence: CoursePathQuestion[] = coursePathQuestionsForNode(
        chapter,
        'checkpoint',
        language,
      ).filter((question) => question.kind === 'evidence');
      assert.equal(evidence.length, 1);
      assert.equal(evidence[0].context?.text, item.reading.text);
      assert.equal(evidence[0].options.length, 3);
      assert.equal(evidence[0].answerLang, language);
      assert.ok(evidence[0].options.includes(evidence[0].answer));
      assert.equal(courseWritingCriteria(chapter, language).length, 3);
    }
  }
  assert.deepEqual([...verdicts].toSorted(), ['contradicted', 'not-stated', 'supported']);
});

test('all chapter repairs require a constrained written repair and reconstruct the intended sentence', () => {
  for (const chapter of coursePathChapters) {
    const model = chapter.modelSentences[1];
    const repair = courseSentenceRepair(model);
    assert.ok(repair.answer.trim());
    assert.equal(repair.prompt.replace('_____', repair.answer), model.de);
    for (const language of ['cs', 'en'] as const) {
      const question = coursePathQuestionsForNode(chapter, 'checkpoint', language).find(
        (item) => item.kind === 'error',
      );
      assert.ok(question);
      assert.equal(question.response, 'recall');
      assert.deepEqual(question.options, []);
      assert.equal(question.context?.text, model.trap);
      assert.equal(gradeCourseRecall(question, repair.answer), true);
      assert.equal(gradeCourseRecall(question, ''), false);
      assert.equal(gradeCourseRecall(question, 'keine Ahnung'), false);
      assert.ok(question.explanation.includes(model.de));
    }
  }
});

test('repair handles insertions and deletions without asking for an empty response', () => {
  const model = {
    de: 'Ich lerne Deutsch.',
    trap: 'Ich lerne heute Deutsch.',
    cs: 'Učím se německy.',
    note: 'Zkrácení.',
  };
  const deletion = courseSentenceRepair(model);
  assert.ok(deletion.answer.length);
  assert.equal(deletion.prompt.replace('_____', deletion.answer), model.de);
  const insertion = courseSentenceRepair({ ...model, de: model.trap, trap: model.de });
  assert.equal(insertion.answer, 'heute');
  const question: CoursePathQuestion = {
    id: 'punctuation-repair',
    instruction: 'Fill the gap',
    prompt: '_____',
    promptLang: 'de',
    answer: 'komme, weil du Zeit hast',
    answerLang: 'de',
    kind: 'error',
    response: 'recall',
    options: [],
    explanation: 'Verb last after weil.',
  };
  assert.equal(gradeCourseRecall(question, 'komme weil du Zeit hast'), true);
  assert.equal(gradeCourseRecall(question, 'komme weil hast du Zeit'), false);
});

test('writing expands with proficiency, keeps concise editing possible, and rejects empty or unrelated input', () => {
  for (const chapter of coursePathChapters) {
    assert.equal(checkCourseWriting(chapter, '').ready, false);
    assert.equal(checkCourseWriting(chapter, 'hello '.repeat(100)).ready, false);
    assert.equal(
      checkCourseWriting(chapter, `${chapter.words[0].german} `.repeat(2000)).withinLimit,
      false,
    );
    if (chapter.level.startsWith('B') || chapter.level === 'C1.1') {
      assert.equal(
        checkCourseWriting(chapter, `Heute ${chapter.words[0].german} ist wichtig.`).enoughWords,
        false,
      );
    }
  }
  const shortEdit = coursePathChapters.find((chapter) => chapter.id === 'chapter-10-style');
  const advancedMessage = coursePathChapters.at(-1);
  assert.ok(shortEdit && advancedMessage);
  assert.equal(courseWritingLimits(shortEdit).minimumWords, 8);
  assert.ok(courseWritingLimits(advancedMessage).minimumWords >= 40);
});
