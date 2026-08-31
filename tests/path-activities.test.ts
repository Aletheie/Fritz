import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coursePathQuestionsForNode,
  sentenceUsesCourseWord,
} from '../src/lib/domain/course/path-activities.ts';
import {
  coursePathChapterMinutes,
  coursePathPhaseInfo,
} from '../src/lib/domain/course/path-presentation.ts';
import { coursePathChapters } from '../src/lib/domain/course/path.ts';

test('každá kapitola vysvětluje cíl, výstupy a větný most do aktivního použití', () => {
  for (const chapter of coursePathChapters) {
    assert.ok(chapter.mission.length >= 40, `${chapter.id} nemá konkrétní komunikační cíl`);
    assert.equal(chapter.outcomes.length, 3, `${chapter.id} nemá tři ověřitelné výstupy`);
    assert.ok(
      chapter.modelSentences.length >= 3 && chapter.modelSentences.length <= 8,
      `${chapter.id} nemá 3–8 modelových vět`,
    );
    assert.ok(chapter.grammarPattern.length > 10, `${chapter.id} nemá větný vzorec`);
    assert.ok(chapter.sentencePrompt.length > 20, `${chapter.id} nemá zadání vlastního výstupu`);
    assert.equal(chapter.sentenceChecklist.length, 3);
    assert.ok(coursePathChapterMinutes(chapter) >= 30);
  }
});

test('fáze kapitoly tvoří čitelný přechod od základu k ověření a bonusu', () => {
  const expected = [
    'foundation',
    'foundation',
    'connection',
    'connection',
    'production',
    'production',
    'check',
    'bonus',
  ];
  for (const chapter of coursePathChapters) {
    assert.deepEqual(
      chapter.nodes.map((node) => node.phase),
      expected,
    );
    for (const node of chapter.nodes) assert.ok(coursePathPhaseInfo[node.phase].description);
  }
});

test('mix a checkpoint ověřují celé věty a nemají odpověď vždy na prvním místě', () => {
  const correctPositions = new Set<number>();
  for (const chapter of coursePathChapters) {
    const correctModelSentences = new Set(chapter.modelSentences.map((model) => model.de));
    const practice = coursePathQuestionsForNode(chapter, 'practice');
    const mix = coursePathQuestionsForNode(chapter, 'mix');
    const checkpoint = coursePathQuestionsForNode(chapter, 'checkpoint');
    assert.equal(practice.length, chapter.words.length);
    assert.equal(mix.length, chapter.modelSentences.length);
    assert.equal(
      mix.filter((question) => question.kind === 'dictation').length,
      1,
      `${chapter.id} nemá právě jeden poslechový diktát`,
    );
    assert.ok(
      mix.find((question) => question.kind === 'dictation')?.wordCount,
      `${chapter.id} diktát neuvádí počet slov`,
    );
    assert.equal(checkpoint.length, 3 + chapter.modelSentences.length);
    assert.equal(checkpoint.filter((question) => question.kind === 'word').length, 2);
    assert.equal(checkpoint.filter((question) => question.kind === 'error').length, 1);
    assert.equal(
      checkpoint.filter((question) => question.kind === 'sentence').length,
      chapter.modelSentences.length,
    );

    for (const question of [...practice, ...mix, ...checkpoint]) {
      assert.equal(question.options.length, 4, `${question.id} nemá čtyři možnosti`);
      assert.equal(new Set(question.options).size, 4, `${question.id} opakuje možnost`);
      assert.ok(question.options.includes(question.answer), `${question.id} neobsahuje odpověď`);
      assert.ok(question.explanation.length > 12, `${question.id} nevysvětluje řešení`);
      if (question.kind === 'sentence' || question.kind === 'dictation') {
        assert.equal(
          question.options.filter(
            (option) => option !== question.answer && correctModelSentences.has(option),
          ).length,
          0,
          `${question.id} nabízí jako distractor jinou správnou modelovou větu`,
        );
      }
      if (question.kind === 'error') {
        assert.equal(question.prompt, chapter.modelSentences[1]?.trap);
        assert.ok(question.explanation.includes(chapter.modelSentences[1]?.de ?? ''));
      }
      correctPositions.add(question.options.indexOf(question.answer));
    }
  }
  assert.deepEqual([...correctPositions].toSorted(), [0, 1, 2, 3]);
});

test('vlastní věta rozpozná i časovaný nebo odlučitelný tvar kurzového slovesa', () => {
  const school = coursePathChapters[0];
  const day = coursePathChapters.find((chapter) => chapter.id === 'chapter-02-day');
  const studyGoal = coursePathChapters.find(
    (chapter) => chapter.id === 'chapter-59-measurable-study-goal',
  );
  const media = coursePathChapters.find((chapter) => chapter.id === 'chapter-112-media-literacy');
  const remedy = coursePathChapters.find(
    (chapter) => chapter.id === 'chapter-83-remedy-with-deadline',
  );
  assert.ok(day);
  assert.ok(studyGoal);
  assert.ok(media);
  assert.ok(remedy);
  assert.equal(sentenceUsesCourseWord('Heute lerne ich Deutsch', school.words), true);
  assert.equal(sentenceUsesCourseWord('Ich stehe morgens um sieben Uhr auf', day.words), true);
  assert.equal(sentenceUsesCourseWord('Wir legen ein Wochenziel fest.', studyGoal.words), true);
  assert.equal(
    sentenceUsesCourseWord('Ich prüfe die Zahl mit einer zweiten Quelle gegen.', media.words),
    true,
  );
  assert.equal(sentenceUsesCourseWord('Wir liefern das Teil morgen nach.', remedy.words), true);
  assert.equal(sentenceUsesCourseWord('Das Wetter ist heute schön', school.words), false);
});

test('cílové slovo se musí shodovat na lexikální hranici', () => {
  const bar = [{ german: 'bar', czech: 'v hotovosti', kind: 'other', cefr: 'A1' }] as const;
  const heftig = [{ german: 'heftig', czech: 'prudký', kind: 'adjective', cefr: 'A2' }] as const;

  assert.equal(sentenceUsesCourseWord('Wir zahlen bar.', [...bar]), true);
  assert.equal(sentenceUsesCourseWord('Das ist einfach wunderbar.', [...bar]), false);
  assert.equal(sentenceUsesCourseWord('Das Heft liegt hier.', [...heftig]), false);
  assert.equal(sentenceUsesCourseWord('Das war eine heftige Debatte.', [...heftig]), true);
});
