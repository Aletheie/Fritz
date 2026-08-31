import assert from 'node:assert/strict';
import test from 'node:test';

import { createCourseProgress } from '../src/lib/domain/course/grammar.ts';
import { coursePathChapterById } from '../src/lib/domain/course/path.ts';
import {
  buildCourseVocabularyCompletion,
  buildCourseVocabularyMutation,
  removeNoteFromCourseVocabularyEvents,
} from '../src/lib/domain/course/vocabulary.ts';
import { normalizeGermanKey } from '../src/lib/domain/grading/normalize.ts';

import type { Note, StudyCard } from '../src/lib/domain/types.ts';

const now = new Date('2026-08-06T08:00:00.000Z');
const nodeId = 'chapter-01-school:vocabulary';

function existingSchool(): Note {
  return {
    id: 'note-school',
    deckId: 'deck',
    german: 'Schule',
    normalizedGerman: normalizeGermanKey('Schule', 'die'),
    czech: 'škola',
    kind: 'noun',
    article: 'die',
    plural: 'Schulen',
    acceptedGerman: [],
    acceptedCzech: [],
    tags: ['maturita', 'test-biologie'],
    source: 'manual',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
  };
}

test('první absolvování přidá nová kurzová slova se stabilním původem a tagy', () => {
  const mutation = buildCourseVocabularyMutation({
    progress: createCourseProgress(now),
    notes: [],
    deckId: 'deck',
    nodeId,
    now,
  });
  const chapter = coursePathChapterById('chapter-01-school');
  assert.ok(chapter);
  assert.equal(mutation.notesToPut.length, chapter.words.length);
  assert.equal(mutation.cardsToPut.length, chapter.words.length);
  assert.equal(mutation.summary.added, chapter.words.length);
  assert.equal(
    mutation.notesToPut.every((note) => note.source === 'course'),
    true,
  );
  assert.equal(
    mutation.notesToPut.every((note) => note.systemTags?.includes('kurz')),
    true,
  );
  assert.equal(
    mutation.notesToPut.every((note) => note.systemTags?.includes('kurz:skola')),
    true,
  );
  assert.equal(
    mutation.notesToPut.every((note) => note.systemTags?.includes('kurz:kapitola-01')),
    true,
  );
  assert.equal(
    mutation.cardsToPut.every((card) => card.fsrs === undefined),
    true,
  );
  assert.equal(mutation.summary.message, 'Do dlouhodobého učení bylo přidáno 5 nových slov.');
});

test('živé dokončení používá jeden čas pro import slov i uzel cesty', () => {
  const result = buildCourseVocabularyCompletion({
    progress: createCourseProgress(now),
    notes: [],
    deckId: 'deck',
    nodeId,
  });
  const vocabularyEvent = result.vocabulary.event;
  const pathNode = result.progress.pathNodes[nodeId];
  const pathEvent = result.progress.pathEvents.find((event) => event.nodeId === nodeId);
  assert.ok(vocabularyEvent);
  assert.ok(pathNode?.completedAt);
  assert.ok(pathEvent);
  assert.equal(vocabularyEvent.completedAt, pathNode.completedAt);
  assert.equal(pathEvent.completedAt, pathNode.completedAt);
});

test('existující slovo se propojí bez přepsání uživatelských dat, termínu nebo mastery', () => {
  const note = existingSchool();
  const card: StudyCard = {
    id: 'card-school',
    deckId: 'deck',
    noteId: note.id,
    direction: 'cs-de',
    dueAt: '2026-09-15T08:00:00.000Z',
    fsrs: { stability: 42, reps: 10 },
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
  const cardSnapshot = structuredClone(card);
  const mutation = buildCourseVocabularyMutation({
    progress: createCourseProgress(now),
    notes: [note],
    deckId: 'deck',
    nodeId,
    now,
  });
  const linked = mutation.notesToPut.find((candidate) => candidate.id === note.id);

  assert.ok(linked);
  assert.equal(linked.source, 'manual');
  assert.deepEqual(linked.tags, note.tags);
  assert.equal(linked.courseLinks?.[0].nodeId, nodeId);
  assert.equal(mutation.summary.linked, 1);
  assert.deepEqual(card, cardSnapshot);
  assert.equal(
    mutation.cardsToPut.some((candidate) => candidate.noteId === note.id),
    false,
  );
});

test('normalizované porovnání zabrání duplicitě', () => {
  const note = {
    ...existingSchool(),
    german: '  SCHULE ',
    normalizedGerman: normalizeGermanKey('Schule', 'die'),
  };
  const mutation = buildCourseVocabularyMutation({
    progress: createCourseProgress(now),
    notes: [note],
    deckId: 'deck',
    nodeId,
    now,
  });
  assert.equal(
    mutation.notesToPut.filter((candidate) => candidate.normalizedGerman === note.normalizedGerman)
      .length,
    1,
  );
  assert.equal(mutation.cardsToPut.length, 4);
});

test('opakované dokončení stejné lekce nevytvoří další importní událost ani karty', () => {
  const progress = createCourseProgress(now);
  const first = buildCourseVocabularyMutation({ progress, notes: [], deckId: 'deck', nodeId, now });
  assert.ok(first.event);
  const repeated = buildCourseVocabularyMutation({
    progress: { ...progress, vocabularyEvents: [first.event] },
    notes: first.notesToPut,
    deckId: 'deck',
    nodeId,
    now: new Date('2026-08-06T09:00:00.000Z'),
  });
  assert.equal(repeated.event, undefined);
  assert.deepEqual(repeated.notesToPut, []);
  assert.deepEqual(repeated.cardsToPut, []);
  assert.equal(repeated.summary.alreadyLinked, 5);
});

test('smazání kurzového slova odstraní osiřelý odkaz, ale zachová idempotenci lekce', () => {
  const progress = createCourseProgress(now);
  const mutation = buildCourseVocabularyMutation({
    progress,
    notes: [],
    deckId: 'deck',
    nodeId,
    now,
  });
  assert.ok(mutation.event);
  const deletedNoteId = mutation.event.addedNoteIds[0];
  const withEvent = { ...progress, vocabularyEvents: [mutation.event] };
  const scrubbed = removeNoteFromCourseVocabularyEvents(
    withEvent,
    deletedNoteId,
    new Date('2026-08-06T10:00:00.000Z'),
  );

  assert.equal(scrubbed.vocabularyEvents.length, 1);
  assert.equal(scrubbed.vocabularyEvents[0].addedNoteIds.includes(deletedNoteId), false);
  assert.equal(scrubbed.vocabularyEvents[0].addedNoteIds.length, 4);
  assert.equal(scrubbed.vocabularyEvents[0].nodeId, nodeId);
  assert.equal(scrubbed.updatedAt, '2026-08-06T10:00:00.000Z');

  const remainingNotes = mutation.notesToPut.filter((note) => note.id !== deletedNoteId);
  const repeated = buildCourseVocabularyMutation({
    progress: scrubbed,
    notes: remainingNotes,
    deckId: 'deck',
    nodeId,
    now: new Date('2026-08-06T11:00:00.000Z'),
  });
  assert.equal(repeated.summary.alreadyLinked, 4);
  assert.match(repeated.summary.message, /1 dříve odstraněné slovo zůstává odstraněné/u);
  assert.deepEqual(repeated.notesToPut, []);
  assert.deepEqual(repeated.cardsToPut, []);
});

test('smazání nesouvisejícího slova kurzový progres nemění', () => {
  const progress = createCourseProgress(now);
  const mutation = buildCourseVocabularyMutation({
    progress,
    notes: [],
    deckId: 'deck',
    nodeId,
    now,
  });
  assert.ok(mutation.event);
  const withEvent = { ...progress, vocabularyEvents: [mutation.event] };

  assert.equal(removeNoteFromCourseVocabularyEvents(withEvent, 'note-other', now), withEvent);
});
