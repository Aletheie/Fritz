import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { speechRecognitionErrorMessage } from '../src/lib/client/speech-recognition.ts';
import { coachScenarios } from '../src/lib/domain/course/coach.ts';
import { grammarCategories, grammarLessons } from '../src/lib/domain/course/grammar.ts';
import { coursePathChapters } from '../src/lib/domain/course/path.ts';
import { coachScenarioCopy } from '../src/lib/i18n/coach.ts';
import { courseChapterCopy, loadCourseCopyCatalog } from '../src/lib/i18n/course.ts';
import {
  grammarCategoryCopy,
  grammarLessonCopy,
  hasEnglishGrammarTitle,
} from '../src/lib/i18n/grammar.ts';
import { localized, t } from '../src/lib/i18n/index.ts';
import { hasEnglishCourseMeaning, sourceMeaning } from '../src/lib/i18n/vocabulary.ts';
import { demoVocabulary } from '../src/lib/server/ai/demo.server.ts';
import { localizedAiSystem } from '../src/lib/server/ai/prompts.server.ts';
import { vocabularyRequestSchema } from '../src/lib/server/ai/schemas.server.ts';

function unescapeSingleQuoted(value: string): string {
  return value.replace(/\\'/gu, "'").replace(/\\\\/gu, '\\');
}

function storyGlossaryTerms(): string[] {
  const source = readFileSync(
    new URL('../src/lib/domain/stories/catalog.ts', import.meta.url),
    'utf8',
  );
  return [...source.matchAll(/glossary\(\s*'(?:\\.|[^'])*'\s*,\s*'((?:\\.|[^'])*)'/gu)].map(
    (match) => unescapeSingleQuoted(match[1]),
  );
}

function demoVocabularyTerms(): string[] {
  const source = readFileSync(
    new URL('../src/lib/server/ai/demo.server.ts', import.meta.url),
    'utf8',
  );
  return [...source.matchAll(/entry\(\s*'((?:\\.|[^'])*)'/gu)].map((match) =>
    unescapeSingleQuoted(match[1]),
  );
}

test('core UI translations switch between Czech and English', () => {
  assert.equal(t('cs', 'shell.today'), 'Dnes');
  assert.equal(t('en', 'shell.today'), 'Today');
  assert.equal(t('en', 'home.fullSyllabus'), 'Full course map');
  assert.equal(localized('cs', { cs: 'Čeština', en: 'English' }), 'Čeština');
  assert.equal(localized('en', { cs: 'Čeština', en: 'English' }), 'English');
  assert.match(speechRecognitionErrorMessage('not-allowed', 'en'), /microphone access/u);
});

test('every course chapter, grammar category, and grammar lesson has English copy', async () => {
  await loadCourseCopyCatalog();
  assert.equal(coursePathChapters.length, 120);
  for (const chapter of coursePathChapters) {
    const copy = courseChapterCopy('en', chapter);
    assert.notStrictEqual(copy, chapter, `missing English chapter copy for ${chapter.id}`);
    assert.notEqual(copy.title, chapter.title, `chapter title stayed Czech for ${chapter.id}`);
  }

  assert.equal(grammarLessons.length, 125);
  for (const lesson of grammarLessons) {
    assert.equal(hasEnglishGrammarTitle(lesson.id), true, `missing title for ${lesson.id}`);
    assert.notEqual(grammarLessonCopy('en', lesson).title, lesson.title);
  }

  for (const category of grammarCategories) {
    assert.notEqual(grammarCategoryCopy('en', category).title, category.title);
  }
});

test('all built-in course, story, and demo vocabulary has an English meaning', () => {
  const courseTerms = coursePathChapters.flatMap((chapter) =>
    chapter.words.map((word) => word.german),
  );
  const storyTerms = storyGlossaryTerms();
  const demoTerms = demoVocabularyTerms();

  assert.ok(courseTerms.length > 350);
  assert.ok(storyTerms.length > 200);
  assert.ok(demoTerms.length > 40);

  for (const term of [...courseTerms, ...storyTerms, ...demoTerms]) {
    assert.equal(hasEnglishCourseMeaning(term), true, `missing English meaning for ${term}`);
  }
});

test('all conversation scenarios expose English learner-facing copy and keep German dialogue', () => {
  assert.ok(coachScenarios.length >= 50);
  for (const scenario of coachScenarios) {
    const copy = coachScenarioCopy(scenario, 'en');
    assert.notEqual(
      copy.title,
      scenario.title,
      `missing English scenario title for ${scenario.id}`,
    );
    assert.equal(copy.opening, scenario.opening);
    assert.match(copy.goal, /German/u);
  }
});

test('maximum-size English demo vocabulary never falls back to Czech meanings', () => {
  for (const focus of ['balanced', 'nouns', 'verbs', 'phrases'] as const) {
    const result = demoVocabulary({
      mode: 'generate',
      motherTongue: 'en',
      topic: 'everyday life',
      level: 'A2',
      count: 20,
      focus,
      includeMnemonics: false,
    });

    assert.equal(result.items.length, 20);
    for (const item of result.items) {
      const baseGerman = item.german.replace(/\s+\(\d+\)$/u, '');
      const expected = sourceMeaning(baseGerman, '__missing__', 'en');
      assert.notEqual(expected, '__missing__', `missing demo meaning for ${baseGerman}`);
      assert.equal(item.czech, expected);
    }
  }
});

test('AI requests default safely to Czech and explicitly support English output', () => {
  const base = {
    mode: 'generate' as const,
    topic: 'school',
    focus: 'balanced' as const,
    count: 5,
    level: 'A2' as const,
    includeMnemonics: false,
  };
  assert.equal(vocabularyRequestSchema.parse(base).motherTongue, 'cs');
  assert.equal(vocabularyRequestSchema.parse({ ...base, motherTongue: 'en' }).motherTongue, 'en');

  const system = localizedAiSystem('Keep the answer in German.', 'en');
  assert.match(system, /mother tongue is English/u);
  assert.match(system, /target-language examples.*German/u);
});
