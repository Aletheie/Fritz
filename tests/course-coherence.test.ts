import assert from 'node:assert/strict';
import test from 'node:test';

import { courseCoherenceOverrides } from '../src/lib/domain/course/course-coherence-overrides.ts';
import {
  diversityChapterBlueprints,
  diversityChapterBridges,
} from '../src/lib/domain/course/course-diversity-chapters.ts';
import { courseFoundations } from '../src/lib/domain/course/course-foundations.ts';
import {
  TRANSFER_CHAPTER_THREAD_COUNT,
  transferChapterThreads,
} from '../src/lib/domain/course/course-transfer-threads.ts';
import { sentenceUsesCourseWord } from '../src/lib/domain/course/path-activities.ts';
import { coursePathChapters } from '../src/lib/domain/course/path.ts';

test('every transfer chapter follows one explicit vocabulary, grammar, dialogue and coach thread', () => {
  assert.equal(TRANSFER_CHAPTER_THREAD_COUNT, 70);

  for (const [chapterId, thread] of Object.entries(transferChapterThreads)) {
    const chapter = coursePathChapters.find((candidate) => candidate.id === chapterId);
    assert.ok(chapter, chapterId);
    assert.deepEqual(
      chapter.words.map((word) => word.german),
      [...thread.wordLemmas, ...(courseFoundations[chapterId] ?? []).map((word) => word.german)],
      `${chapterId}: vocabulary`,
    );
    assert.equal(chapter.grammarLessonId, thread.grammarLessonId, `${chapterId}: grammar`);
    assert.equal(chapter.grammarPattern, thread.grammarPattern, `${chapterId}: pattern`);
    assert.equal(chapter.coachScenarioId, thread.coachScenarioId, `${chapterId}: coach`);
    assert.equal(chapter.sentenceStarter, thread.sentenceStarter, `${chapterId}: starter`);
    assert.equal(chapter.modelSentences[0]?.de, thread.responseDe, `${chapterId}: model`);
    assert.equal(chapter.dialogue[0]?.de, thread.promptDe, `${chapterId}: prompt`);
    assert.equal(chapter.dialogue[1]?.de, thread.responseDe, `${chapterId}: response`);

    const bridgeLexemes = chapter.words.filter((word) =>
      sentenceUsesCourseWord(thread.responseDe, [word]),
    );
    assert.ok(bridgeLexemes.length >= 2, `${chapterId}: bridge needs two chapter lexemes`);
  }
});

test('every diversity chapter opens with a grammar-linked bridge sentence', () => {
  assert.equal(Object.keys(diversityChapterBridges).length, 20);
  assert.equal(diversityChapterBlueprints.length, 20);

  for (const blueprint of diversityChapterBlueprints) {
    const chapter = coursePathChapters.find((candidate) => candidate.id === blueprint.id);
    const bridge = diversityChapterBridges[blueprint.id];
    assert.ok(chapter, blueprint.id);
    assert.ok(bridge, `${blueprint.id}: bridge`);
    assert.equal(chapter.grammarLessonId, blueprint.grammarLessonId);
    assert.equal(chapter.modelSentences[0]?.de, bridge.de);
    assert.equal(chapter.modelSentences[0]?.cs, bridge.cs);
    assert.equal(chapter.sentenceStarter, bridge.sentenceStarter);

    const bridgeLexemes = chapter.words.filter((word) => sentenceUsesCourseWord(bridge.de, [word]));
    assert.ok(bridgeLexemes.length >= 2, `${blueprint.id}: bridge needs two new lexemes`);
  }
});

test('all generated chapters open as playable scenes and use natural model sentences', () => {
  const generated = coursePathChapters.filter((chapter) => chapter.contentVersion >= 3);
  assert.equal(generated.length, 90);

  for (const chapter of generated) {
    assert.doesNotMatch(
      `${chapter.subtitle}\n${chapter.situation}\n${chapter.mission}`,
      /^(?:Zaměřený transfer:|Nové téma z reálného života:|Navazující situace|Tvým úkolem je|Použiješ novou slovní zásobu tak)/mu,
      `${chapter.id}: boilerplate copy`,
    );
    assert.match(chapter.sentencePrompt, /„.+“/u, `${chapter.id}: concrete opening cue`);
    assert.notEqual(
      chapter.dialogue[0]?.speaker,
      'Partner',
      `${chapter.id}: concrete partner role`,
    );
    assert.notEqual(chapter.dialogue[1]?.speaker, 'Ty', `${chapter.id}: concrete learner role`);
    for (const model of chapter.modelSentences) {
      assert.doesNotMatch(
        model.de,
        /^(?:Das Verb|Der Ausdruck) „[^”]+“ passt hier:/u,
        `${chapter.id}: natural German model`,
      );
    }
  }
});

test('all 120 dialogues stay inside their chapter vocabulary and corrected anchors keep their coach', () => {
  assert.equal(coursePathChapters.length, 120);
  for (const chapter of coursePathChapters) {
    assert.equal(
      sentenceUsesCourseWord(chapter.dialogue.map((turn) => turn.de).join(' '), chapter.words),
      true,
      `${chapter.id}: dialogue must use chapter vocabulary`,
    );
  }

  for (const [chapterId, override] of Object.entries(courseCoherenceOverrides)) {
    const chapter = coursePathChapters.find((candidate) => candidate.id === chapterId);
    assert.ok(chapter, chapterId);
    if (override.coachScenarioId) {
      assert.equal(
        chapter.coachScenarioId,
        override.coachScenarioId,
        `${chapterId}: primary coach`,
      );
      assert.ok(chapter.coachScenarioIds.includes(override.coachScenarioId));
    }
    if (override.grammarLessonId) {
      assert.equal(
        chapter.grammarLessonId,
        override.grammarLessonId,
        `${chapterId}: primary grammar`,
      );
      assert.ok(chapter.grammarLessonIds.includes(override.grammarLessonId));
    }
    if (override.dialogue) assert.deepEqual(chapter.dialogue, override.dialogue);
  }
});
