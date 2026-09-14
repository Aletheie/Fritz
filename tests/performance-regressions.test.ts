// oxlint-disable-next-line import/no-unassigned-import -- installs IndexedDB globals for Node.
import 'fake-indexeddb/auto';

import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';

import { instrumentDatabaseReads } from '../scripts/performance/measure.ts';
import {
  buildLibraryIndex,
  selectLibraryNotes,
} from '../src/lib/components/vocabulary/library-model.ts';
import {
  closeDatabaseConnection,
  DB_VERSION,
  getAll,
  getOne,
  openDatabase,
  readRecentReviewsForNote,
  replaceWithBackup,
} from '../src/lib/data/db.ts';
import { addImportedNotes, saveNote } from '../src/lib/data/repository.ts';
import { learningEvidenceFromReview } from '../src/lib/domain/learning/evidence.ts';
import { deriveReviewStats } from '../src/lib/domain/stats/review-stats.ts';
import { draftFromNote } from '../src/lib/domain/vocabulary/draft.ts';
import { createPerformanceFixture } from './fixtures/performance.ts';

import type { Note, ReviewLog, StudyCard } from '../src/lib/domain/types.ts';

async function resetDatabase(): Promise<void> {
  await closeDatabaseConnection();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('fritz');
    request.addEventListener('success', () => resolve(), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
    request.addEventListener(
      'blocked',
      () => reject(new Error('An open test connection blocks cleanup.')),
      { once: true },
    );
  });
}
beforeEach(resetDatabase);
after(resetDatabase);

test('library search covers all pages and sorting leaves the cached index and input notes intact', () => {
  const fixture = createPerformanceFixture(1_000, 0);
  const before = fixture.notes.map((note) => note.id);
  const index = buildLibraryIndex(fixture.notes, fixture.cards, 'cs');
  const filters = { query: ' 00999 ', kind: 'all', tag: 'all', sort: 'recent' } as const;
  assert.deepEqual(
    selectLibraryNotes(index, filters).map((note) => note.id),
    [fixture.notes[999].id],
  );
  assert.equal(selectLibraryNotes(index, { ...filters, query: '', tag: 'group-1' }).length, 50);
  assert.ok(
    selectLibraryNotes(index, { ...filters, query: '', kind: 'verb' }).every(
      (note) => note.kind === 'verb',
    ),
  );
  for (const sort of ['recent', 'alphabetical', 'mastery', 'due'] as const) {
    const result = selectLibraryNotes(index, { ...filters, query: '', sort });
    assert.equal(result.length, fixture.notes.length);
    assert.deepEqual(
      index.entries.map((entry) => entry.note.id),
      before,
    );
    assert.deepEqual(
      fixture.notes.map((note) => note.id),
      before,
    );
  }
});

test('library index refreshes translations and edited words and orders due dates including the Unix epoch', () => {
  const fixture = createPerformanceFixture(3, 0);
  const notes = fixture.notes.map((note, index) => ({
    ...note,
    german: ['Hund', 'Katze', 'Buch'][index],
  }));
  const filters = { query: 'dog', kind: 'all', tag: 'all', sort: 'recent' } as const;
  assert.equal(selectLibraryNotes(buildLibraryIndex(notes, [], 'cs'), filters).length, 0);
  assert.equal(selectLibraryNotes(buildLibraryIndex(notes, [], 'en'), filters)[0]?.id, notes[0].id);
  const edited = notes.map((note, index) => (index === 0 ? { ...note, german: 'Haus' } : note));
  assert.equal(selectLibraryNotes(buildLibraryIndex(edited, [], 'en'), filters).length, 0);
  const cards = fixture.cards
    .filter((card) => card.direction === 'cs-de')
    .map((card, index) => ({
      ...card,
      dueAt: ['1970-01-01T00:00:00.000Z', 'invalid', '2026-01-01T00:00:00.000Z'][index],
    }));
  const sorted = selectLibraryNotes(buildLibraryIndex(notes, cards, 'cs'), {
    ...filters,
    query: '',
    sort: 'due',
  });
  assert.deepEqual(
    sorted.map((note) => note.id),
    [notes[1].id, notes[0].id, notes[2].id],
  );
});

test('note history reads only the requested newest rows across both directions, including bounded invalid limits', async () => {
  const fixture = createPerformanceFixture(100, 5_000);
  const hotReviews = fixture.reviews.filter((review) => review.noteId === fixture.notes[0].id);
  for (const [index, review] of hotReviews.entries()) review.cardId = fixture.cards[index % 2].id;
  hotReviews.at(-2)!.reviewedAt = hotReviews.at(-1)!.reviewedAt;
  fixture.learningEvidence = fixture.reviews.map((review) =>
    learningEvidenceFromReview(review, review.cardId.endsWith('de-cs') ? 'de-cs' : 'cs-de'),
  );
  await replaceWithBackup(fixture);
  const noteId = fixture.notes[0].id;
  const expected = fixture.reviews
    .filter((review) => review.noteId === noteId)
    .toSorted(
      (left, right) =>
        right.reviewedAt.localeCompare(left.reviewedAt) || right.id.localeCompare(left.id),
    );
  for (const [limit, count] of [
    [5, 5],
    [50, 50],
    [Number.NaN, 5],
    [Infinity, 50],
    [0, 1],
    [-1, 1],
  ]) {
    const audit = instrumentDatabaseReads();
    try {
      // oxlint-disable-next-line no-await-in-loop -- isolate instrumentation for each limit.
      const history = await readRecentReviewsForNote(noteId, limit);
      assert.deepEqual(
        history.map((review) => review.id),
        expected.slice(0, count).map((review) => review.id),
      );
      assert.ok(
        audit.cursorSteps() <= count,
        `${audit.cursorSteps()} cursor steps for ${count} rows`,
      );
      assert.equal(audit.reads.length, 0);
      if (count > 1) assert.equal(new Set(history.map((review) => review.cardId)).size, 2);
    } finally {
      audit.restore();
    }
  }
  assert.deepEqual(await readRecentReviewsForNote('missing-note'), []);
});

test('v8 migration builds the chronological note index without losing reviews or rebuilding stored statistics', async () => {
  const fixture = createPerformanceFixture(10, 100);
  const stats = deriveReviewStats(fixture.reviews);
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('fritz', 8);
    request.addEventListener(
      'upgradeneeded',
      () => {
        const reviews = request.result.createObjectStore('reviews', { keyPath: 'id' });
        reviews.createIndex('noteId', 'noteId');
        reviews.createIndex('reviewedAt', 'reviewedAt');
        for (const review of fixture.reviews) reviews.put(review);
        request.result.createObjectStore('reviewStats', { keyPath: 'key' }).put(stats);
      },
      { once: true },
    );
    request.addEventListener(
      'success',
      () => {
        request.result.close();
        resolve();
      },
      { once: true },
    );
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
  const database = await openDatabase();
  assert.equal(database.version, DB_VERSION);
  const index = database.transaction('reviews').objectStore('reviews').index('noteAndReviewedAt');
  assert.deepEqual(index.keyPath, ['noteId', 'reviewedAt']);
  assert.equal((await getAll<ReviewLog>('reviews')).length, fixture.reviews.length);
  assert.deepEqual(await getOne('reviewStats', 'reviews'), stats);
  const history = await readRecentReviewsForNote(fixture.notes[0].id);
  assert.equal(history.length, 5);
  assert.ok(history.every((review) => review.noteId === fixture.notes[0].id));
});

test('indexed note edits keep card schedules and metadata, and concurrent renames cannot create duplicates', async () => {
  const fixture = createPerformanceFixture(100, 1_000);
  fixture.notes[1].learningNote = 'Keep my context';
  await replaceWithBackup(fixture);
  const audit = instrumentDatabaseReads();
  try {
    const saved = await saveNote(fixture.notes[1].id, {
      ...draftFromNote(fixture.notes[1]),
      czech: 'nový význam',
    });
    assert.equal(saved.czech, 'nový význam');
    assert.equal(saved.learningNote, 'Keep my context');
    assert.equal(saved.createdAt, fixture.notes[1].createdAt);
    assert.equal(saved.source, fixture.notes[1].source);
    assert.equal(audit.reads.length, 0, 'A single edit must not use getAll on any store or index.');
  } finally {
    audit.restore();
  }
  const results = await Promise.allSettled(
    fixture.notes.slice(1, 3).map((note) =>
      saveNote(note.id, {
        ...draftFromNote(note),
        german: 'Einzigartig',
        kind: 'other',
        article: undefined,
      }),
    ),
  );
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  const stored = await getAll<Note>('notes');
  assert.equal(stored.filter((note) => note.german === 'Einzigartig').length, 1);
  assert.deepEqual(
    (await getAll<StudyCard>('cards')).toSorted((a, b) => a.id.localeCompare(b.id)),
    fixture.cards.toSorted((a, b) => a.id.localeCompare(b.id)),
  );
  await assert.rejects(
    () => saveNote('deleted-note', draftFromNote(fixture.notes[0])),
    /už v knihovně není/u,
  );
});

test('bulk import does not load card records just to check duplicate words', async () => {
  const fixture = createPerformanceFixture(100, 1_000);
  await replaceWithBackup(fixture);
  const audit = instrumentDatabaseReads();
  try {
    const result = await addImportedNotes(fixture.decks[0].id, fixture.notes.map(draftFromNote));
    assert.equal(result.duplicates, 100);
    assert.deepEqual(result.addedCards, []);
    assert.ok(audit.reads.every((read) => read.store === 'notes'));
  } finally {
    audit.restore();
  }
});
