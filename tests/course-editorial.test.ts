import assert from 'node:assert/strict';
import test from 'node:test';
import { sentenceUsesCourseWord } from '../src/lib/domain/course/course-word-usage.ts';
import { grammarLessons } from '../src/lib/domain/course/grammar.ts';
import { coursePathChapters } from '../src/lib/domain/course/path.ts';
import { englishGrammarRules } from '../src/lib/i18n/grammar-rules.ts';
import { englishGrammarTaskPrompts } from '../src/lib/i18n/grammar-task-prompts.ts';
import {
  grammarLessonCopy,
  grammarQuestionCopy,
  grammarOptionCopy,
  grammarOptionLanguage,
} from '../src/lib/i18n/grammar.ts';

test('every catalog vocabulary example can be used as evidence in the writing activity', () => {
  const words = new Map(
    coursePathChapters.flatMap((chapter) => chapter.words).map((word) => [word.id, word]),
  );
  assert.ok(words.size >= 688);
  for (const word of words.values()) {
    assert.ok(word.exampleDe && word.exampleCs, word.german);
    assert.ok(sentenceUsesCourseWord(word.exampleDe, [word]), `${word.german}: ${word.exampleDe}`);
  }
});

test('natural verb forms keep their required particles and phrase anchors', () => {
  const words = coursePathChapters.flatMap((chapter) => chapter.words);
  const uses = (german: string, sentence: string) =>
    sentenceUsesCourseWord(sentence, [words.find((word) => word.german === german)!]);
  assert.equal(uses('schreiben', 'Schreib deinen Namen.'), true);
  assert.equal(uses('wehtun', 'Mir tut der Rücken weh.'), true);
  assert.equal(uses('wehtun', 'Sie tut das jeden Morgen.'), false);
  assert.equal(uses('sich ausruhen', 'Wir möchten uns ausruhen.'), true);
  assert.equal(uses('Rücksicht nehmen', 'Wir nehmen auf die Nachbarn Rücksicht.'), true);
  assert.equal(uses('Rücksicht nehmen', 'Wir nehmen den Bus.'), false);
  assert.equal(uses('zurückgehen', 'Die Zahl ging zurück.'), true);
  assert.equal(uses('zurückgehen', 'Die Zahl ging verloren.'), false);
  assert.equal(uses('im Vergleich zu', 'Im Vergleich zum Vorjahr ist das gut.'), true);
  assert.equal(uses('verbreiten', 'Konten verbreiteten die Nachricht.'), true);
  assert.equal(uses('schreiben', 'Das Schreibpapier ist weiß.'), false);
});

test('essential fill information is visible before an optional hint is opened', () => {
  const questions = new Map(
    grammarLessons.flatMap((lesson) => lesson.questions).map((question) => [question.id, question]),
  );
  const requiredCues: Record<string, string> = {
    'v2-3': 'arbeiten',
    'pres-3': 'arbeiten',
    'tmp-3': 'autobusem',
    'cmp-2': 'schnell',
    'personal-pronouns-2': 'Tom und Ben',
    'numbers-and-prices-3': '18',
    'ordinal-numbers-3': '3.',
    'praeteritum-lexical-verbs-3': 'bringen',
    'present-for-future-3': 'beginnen',
    'genitive-case-3': 'Experte',
    'adjectives-without-article-3': 'groß',
    'participles-as-adjectives-3': 'weinen',
    'nominalized-adjectives-3': 'bekannten Frau',
    'brauchen-nicht-zu-2': 'warten',
    'nominalized-infinitives-2': 'kochen',
    'ellipsis-parallelism-2': 'Endfassung',
  };
  for (const [id, cue] of Object.entries(requiredCues))
    assert.ok(questions.get(id)?.prompt.includes(cue), id);
});

test('all 625 English tasks retain their own context and every lesson explains its actual rule', () => {
  let total = 0;
  const czechCharacters = /[čďěňřšťůžČĎĚŇŘŠŤŮŽ]/u;
  for (const lesson of grammarLessons) {
    const prompts = englishGrammarTaskPrompts[lesson.id];
    assert.equal(prompts?.length, lesson.questions.length, lesson.id);
    assert.ok(englishGrammarRules[lesson.id]?.length > 80, lesson.id);
    const lessonCopy = grammarLessonCopy('en', lesson);
    assert.ok(lessonCopy.formula.includes(lesson.examples[0].de));
    assert.ok(!czechCharacters.test(lessonCopy.concept), lesson.id);
    for (const [index, question] of lesson.questions.entries()) {
      total++;
      const copy = grammarQuestionCopy('en', question, lessonCopy);
      assert.equal(copy.prompt, prompts[index] ?? question.prompt, question.id);
      assert.ok(!czechCharacters.test(copy.prompt), question.id);
      if (question.kind === 'choice') {
        const labels = question.options.map((option) => grammarOptionCopy('en', option));
        assert.equal(new Set(labels).size, question.options.length, question.id);
        assert.ok(
          labels.every((label) => !czechCharacters.test(label)),
          question.id,
        );
        assert.ok(labels.includes(grammarOptionCopy('en', question.answer)), question.id);
      }
    }
  }
  assert.equal(total, 625);
  const price = grammarLessons.find((lesson) => lesson.id === 'numbers-and-prices')!;
  assert.match(
    grammarQuestionCopy('en', price.questions[2], grammarLessonCopy('en', price)).prompt,
    /18/u,
  );
  const pronouns = grammarLessons.find((lesson) => lesson.id === 'personal-pronouns')!;
  assert.match(
    grammarQuestionCopy('en', pronouns.questions[1], grammarLessonCopy('en', pronouns)).prompt,
    /Tom und Ben/u,
  );
});

test('conceptual option labels keep their interface language for speech output', () => {
  assert.equal(grammarOptionLanguage('cs', 'čas před místem'), 'cs');
  assert.equal(grammarOptionLanguage('en', 'čas před místem'), 'en');
  assert.equal(grammarOptionLanguage('en', 'Ich lerne Deutsch.'), 'de');
});
