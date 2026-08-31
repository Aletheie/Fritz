import assert from 'node:assert/strict';
import test from 'node:test';

import { nextCoachScenarios } from '../src/lib/domain/course/coach-scenarios-next.ts';
import { coachScenarios } from '../src/lib/domain/course/coach.ts';
import {
  futureChapterVocabulary,
  futureChapterVocabularyPacks,
} from '../src/lib/domain/course/future-chapter-vocabulary.ts';
import { nextGrammarLessons } from '../src/lib/domain/course/grammar-next.ts';
import { grammarLessons } from '../src/lib/domain/course/grammar.ts';
import { coursePathChapters } from '../src/lib/domain/course/path.ts';
import { DETAILED_CEFR_LEVELS } from '../src/lib/domain/levels.ts';

function normalized(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('de-DE');
}

test('další gramatické rozšíření přidává právě 15 hotových lekcí a 75 úloh', () => {
  assert.equal(nextGrammarLessons.length, 15);
  assert.equal(
    nextGrammarLessons.reduce((sum, lesson) => sum + lesson.questions.length, 0),
    75,
  );
  assert.deepEqual(
    nextGrammarLessons.map((lesson) => lesson.unit),
    Array.from({ length: 15 }, (_, index) => index + 111),
  );
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
    assert.equal(
      nextGrammarLessons.filter((lesson) => lesson.cefr === level).length,
      3,
      `${level} má dostat tři nové lekce`,
    );
  }
});

test('další AI rozšíření obsahuje 10 samostatných tříkolových konverzací', () => {
  assert.equal(nextCoachScenarios.length, 10);
  assert.equal(new Set(nextCoachScenarios.map((scenario) => scenario.id)).size, 10);
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
    assert.equal(
      nextCoachScenarios.filter((scenario) => scenario.level === level).length,
      2,
      `${level} má dostat dvě nové konverzace`,
    );
  }
  assert.ok(
    nextCoachScenarios.every(
      (scenario) =>
        scenario.turns === 3 &&
        scenario.starterPrompts.length === 3 &&
        scenario.contextCues.length >= 8,
    ),
  );
});

test('tematická slovní banka napájí dvacet aktivních kapitol po deseti unikátních výrazech', () => {
  assert.equal(futureChapterVocabularyPacks.length, 20);
  assert.equal(futureChapterVocabulary.length, 200);
  assert.ok(futureChapterVocabularyPacks.every((chapterPack) => chapterPack.words.length === 10));
  for (const level of DETAILED_CEFR_LEVELS) {
    assert.equal(
      futureChapterVocabularyPacks.filter((chapterPack) => chapterPack.level === level).length,
      2,
      `${level} musí mít dva nové tematické balíčky`,
    );
  }

  const bankKeys = futureChapterVocabulary.map((word) => normalized(word.german));
  assert.equal(new Set(bankKeys).size, bankKeys.length);
  const activeKeys = new Set(
    coursePathChapters.flatMap((chapter) => chapter.words.map((word) => normalized(word.german))),
  );
  assert.ok(futureChapterVocabulary.every((word) => activeKeys.has(normalized(word.german))));

  for (const word of futureChapterVocabulary) {
    assert.ok(word.exampleDe && word.exampleCs, `${word.german} potřebuje dvojjazyčný příklad`);
    assert.ok(word.contexts?.length, `${word.german} potřebuje kontext`);
    assert.ok(word.collocations?.length, `${word.german} potřebuje kolokaci`);
    if (word.kind === 'noun') {
      assert.ok(word.article, `${word.german} potřebuje člen`);
      assert.ok(word.plural, `${word.german} potřebuje plurál`);
    }
    if (word.kind === 'verb') {
      assert.ok(word.verbForms, `${word.german} potřebuje slovesné tvary`);
    }
  }
});

test('každý tematický slovní balíček je svázaný s gramatikou a AI misí', () => {
  const grammarIds = new Set(grammarLessons.map((lesson) => lesson.id));
  const scenarioIds = new Set(coachScenarios.map((scenario) => scenario.id));
  for (const chapterPack of futureChapterVocabularyPacks) {
    assert.ok(chapterPack.grammarLessonIds.length > 0);
    assert.ok(chapterPack.coachScenarioIds.length > 0);
    assert.ok(chapterPack.grammarLessonIds.every((id) => grammarIds.has(id)));
    assert.ok(chapterPack.coachScenarioIds.every((id) => scenarioIds.has(id)));
  }
});
