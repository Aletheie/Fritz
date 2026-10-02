import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWritingAutosave,
  type WritingSaveStatus,
} from '../src/lib/client/writing-autosave.ts';
import {
  courseFoundations,
  foundationRevisionForWord,
} from '../src/lib/domain/course/course-foundations.ts';
import {
  courseInformationGaps,
  informationGapReady,
} from '../src/lib/domain/course/course-information-gaps.ts';
import { createCourseProgress } from '../src/lib/domain/course/course-progress.ts';
import { sentenceUsesCourseWord } from '../src/lib/domain/course/course-word-usage.ts';
import { coursePathQuestionsForNode } from '../src/lib/domain/course/path-activities.ts';
import {
  completeCoursePathNode,
  coursePathChapterById,
  coursePathChapters,
} from '../src/lib/domain/course/path.ts';
import {
  buildCourseVocabularyCompletion,
  buildCourseVocabularyMutation,
  removeNoteFromCourseVocabularyEvents,
} from '../src/lib/domain/course/vocabulary.ts';
import { courseWordMeaning } from '../src/lib/i18n/vocabulary.ts';

test('the A1 path teaches essential everyday words and all seven weekdays in context', () => {
  const words = coursePathChapters
    .filter((chapter) => chapter.level.startsWith('A1'))
    .flatMap((chapter) => chapter.words);
  for (const lemma of [
    'Name',
    'heißen',
    'sein',
    'haben',
    'Mutter',
    'Vater',
    'Familie',
    'Wasser',
    'Brot',
    'heute',
    'morgen',
    'Bus',
    'Zug',
    'Montag',
    'Dienstag',
    'Mittwoch',
    'Donnerstag',
    'Freitag',
    'Samstag',
    'Sonntag',
  ]) {
    const word = words.find((candidate) => candidate.german === lemma);
    assert.ok(word, lemma);
    assert.ok(word.exampleDe && word.exampleCs);
  }
  const foundations = Object.values(courseFoundations).flat();
  assert.equal(foundations.length, 115);
  assert.equal(new Set(foundations.map((word) => word.german)).size, 115);
  for (const word of foundations) {
    assert.equal(courseWordMeaning(word, 'en'), word.english);
    assert.equal(
      sentenceUsesCourseWord(word.exampleDe!, [word]),
      true,
      `${word.german}: example must be usable in writing`,
    );
  }
  assert.equal(
    sentenceUsesCourseWord('Du hast Zeit.', [foundations.find((word) => word.german === 'haben')!]),
    true,
  );
  assert.equal(
    sentenceUsesCourseWord('Das Zimmer ist warm.', [
      foundations.find((word) => word.german === 'haben')!,
    ]),
    false,
  );
  const massNouns = new Set(['Wasser', 'Milch', 'Wetter']);
  const imported = ['chapter-34-simple-order', 'chapter-103-weather-and-clothing']
    .flatMap(
      (chapterId) =>
        buildCourseVocabularyMutation({
          progress: createCourseProgress(),
          nodeId: `${chapterId}:vocabulary`,
          notes: [],
          deckId: 'deck',
        }).notesToPut,
    )
    .filter((note) => massNouns.has(note.german));
  assert.equal(imported.length, 3);
  assert.ok(
    imported.every((note) => note.plural === undefined && note.learningNote),
    'mass nouns must not create a plural exercise whose answer is a dash',
  );
});

test('information-gap decisions require complementary information rather than repeated or unrelated questions', () => {
  assert.equal(new Set(courseInformationGaps.map((gap) => gap.level)).size, 10);
  for (const gap of courseInformationGaps) {
    const [first, second] = gap.requiredQueryIds;
    const extra = gap.queries.find((query) => !gap.requiredQueryIds.includes(query.id))!;
    assert.equal(informationGapReady(gap, []), false);
    assert.equal(informationGapReady(gap, [first, first, extra.id, 'unknown']), false);
    assert.equal(informationGapReady(gap, [second, first]), true);
    const chapter = coursePathChapterById(gap.chapterId)!;
    for (const language of ['cs', 'en'] as const) {
      const question = coursePathQuestionsForNode(chapter, 'checkpoint', language).find(
        (entry) => entry.kind === 'information-gap',
      );
      assert.ok(question);
      assert.equal(question.options.filter((option) => option === gap.answer).length, 1);
      assert.equal(question.interaction, gap);
      assert.equal(question.context, undefined);
      assert.equal(question.explanation, gap.explanation[language]);
    }
  }
});

test('a revision-one learner gets only the second additions and previously deleted foundations stay deleted', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const chapterId = 'chapter-31-first-introduction';
  const nodeId = `${chapterId}:vocabulary`;
  const initial = buildCourseVocabularyMutation({
    progress: createCourseProgress(now),
    nodeId,
    notes: [],
    deckId: 'deck',
    now,
  });
  assert.ok(initial.event);
  const earlierNotes = initial.notesToPut.filter(
    (note) => foundationRevisionForWord(chapterId, note.german) !== 2 && note.german !== 'Name',
  );
  const event = {
    ...initial.event,
    foundationRevision: 1 as const,
    addedNoteIds: earlierNotes.map((note) => note.id),
  };
  const progress = { ...createCourseProgress(now), vocabularyEvents: [event] };
  const upgraded = buildCourseVocabularyMutation({
    progress,
    nodeId,
    notes: earlierNotes,
    deckId: 'deck',
    now,
  });
  assert.deepEqual(upgraded.notesToPut.map((note) => note.german).toSorted(), [
    'Deutsch',
    'Land',
    'sprechen',
  ]);
  assert.equal(upgraded.event?.foundationRevision, 2);
  assert.equal(upgraded.event?.completedAt, event.completedAt);
  assert.ok(!upgraded.notesToPut.some((note) => note.german === 'Name'));
  assert.ok(upgraded.event);
  const repeated = buildCourseVocabularyMutation({
    progress: { ...progress, vocabularyEvents: [upgraded.event] },
    nodeId,
    notes: [...earlierNotes, ...upgraded.notesToPut],
    deckId: 'deck',
    now,
  });
  assert.equal(repeated.summary.added, 0);
  assert.equal(repeated.event, undefined);
});

test('revisiting a legacy vocabulary step imports its new foundations once without resurrecting deleted words or adding XP', () => {
  const now = new Date('2026-09-13T12:00:00Z');
  let progress = createCourseProgress(now);
  for (const node of coursePathChapters[0].nodes.filter((entry) => entry.required))
    progress = completeCoursePathNode(progress, node.id, 3, now).progress;
  const chapter = coursePathChapterById('chapter-31-first-introduction')!;
  const nodeId = `${chapter.id}:vocabulary`;
  const initial = buildCourseVocabularyCompletion({
    progress,
    nodeId,
    notes: [],
    deckId: 'deck',
    now,
  });
  const foundationLemmas = new Set(courseFoundations[chapter.id].map((word) => word.german));
  const notes = initial.vocabulary.notesToPut.filter((note) => !foundationLemmas.has(note.german));
  const event = initial.progress.vocabularyEvents.find((entry) => entry.nodeId === nodeId)!;
  // Represent a backup made before this content addition, including a learner's deletion.
  delete event.foundationRevision;
  event.addedNoteIds = notes.map((note) => note.id);
  const removed = notes.shift()!;
  progress = removeNoteFromCourseVocabularyEvents(initial.progress, removed.id, now);
  const upgraded = buildCourseVocabularyCompletion({
    progress,
    nodeId,
    notes,
    deckId: 'deck',
    now,
  });
  assert.equal(upgraded.vocabulary.summary.added, 9);
  assert.ok(upgraded.vocabulary.notesToPut.every((note) => foundationLemmas.has(note.german)));
  assert.equal(upgraded.completion.xpAwarded, 0);
  assert.equal(
    upgraded.progress.vocabularyEvents.filter((entry) => entry.nodeId === nodeId).length,
    1,
  );
  assert.equal(upgraded.vocabulary.event?.foundationRevision, 2);
  const newNotes = [...notes, ...upgraded.vocabulary.notesToPut];
  const removedFoundation = newNotes.find((note) => note.german === 'Name')!;
  const afterDeletion = removeNoteFromCourseVocabularyEvents(
    upgraded.progress,
    removedFoundation.id,
    now,
  );
  const repeat = buildCourseVocabularyCompletion({
    progress: afterDeletion,
    nodeId,
    notes: newNotes.filter((note) => note.id !== removedFoundation.id),
    deckId: 'deck',
    now,
  });
  assert.equal(repeat.vocabulary.notesToPut.length, 0);
  assert.equal(repeat.completion.xpAwarded, 0);
});

test('draft writes are serialized and a stale save cannot report the newest revision as saved', async () => {
  const statuses: WritingSaveStatus[] = [];
  const writes: string[] = [];
  const firstGate = Promise.withResolvers<void>();
  const secondGate = Promise.withResolvers<void>();
  const saver = createWritingAutosave(
    async (text) => {
      writes.push(text);
      await (text === 'first' ? firstGate.promise : secondGate.promise);
    },
    (status) => statuses.push(status),
  );
  saver.update('first');
  const first = saver.flush();
  await Promise.resolve();
  saver.update('second');
  const second = saver.flush();
  assert.deepEqual(writes, ['first']);
  firstGate.resolve();
  await first;
  assert.notEqual(statuses.at(-1), 'saved');
  secondGate.resolve();
  assert.equal(await second, true);
  assert.deepEqual(writes, ['first', 'second']);
  assert.equal(statuses.at(-1), 'saved');
});

test('failed draft saves retain the latest text for retry and preserve intentional empty drafts', async () => {
  let fail = true;
  const writes: string[] = [];
  const statuses: WritingSaveStatus[] = [];
  const saver = createWritingAutosave(
    async (text) => {
      if (fail) throw new Error('Storage unavailable');
      writes.push(text);
    },
    (status) => statuses.push(status),
  );
  saver.update('unfinished');
  assert.equal(await saver.flush(), false);
  assert.equal(statuses.at(-1), 'error');
  fail = false;
  assert.equal(await saver.flush(), true);
  saver.update('');
  assert.equal(await saver.flush(), true);
  assert.deepEqual(writes, ['unfinished', '']);
});
