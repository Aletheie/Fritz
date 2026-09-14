// oxlint-disable-next-line import/no-unassigned-import -- installs IndexedDB globals for Node.
import 'fake-indexeddb/auto';

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, platform, arch } from 'node:os';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';

import {
  buildLibraryIndex,
  selectLibraryNotes,
} from '../src/lib/components/vocabulary/library-model.ts';
import { closeDatabaseConnection, getOne, replaceWithBackup } from '../src/lib/data/db.ts';
import {
  addImportedNotes,
  exportBackup,
  loadNoteReviewHistory,
  loadSnapshot,
  recordReview,
  saveDoubleXpPurchase,
  saveNote,
  saveSettings,
} from '../src/lib/data/repository.ts';
import { coachScenarios } from '../src/lib/domain/course/coach.ts';
import { grammarLessons } from '../src/lib/domain/course/grammar.ts';
import { coursePathChapters, coursePathViews } from '../src/lib/domain/course/path.ts';
import { buildVocabularyMatchingExercise } from '../src/lib/domain/exercises/matching.ts';
import { gamificationSummary } from '../src/lib/domain/gamification.ts';
import { buildDailyLessonPlan } from '../src/lib/domain/learning/planner.ts';
import {
  buildChoiceOptions,
  chooseAdaptiveExercise,
  selectDueCards,
  selectDueCardsForTraining,
} from '../src/lib/domain/scheduler/queue.ts';
import { isCountedReview } from '../src/lib/domain/stats/learning.ts';
import { draftFromNote } from '../src/lib/domain/vocabulary/draft.ts';
import { createPerformanceFixture, performanceSignal } from '../tests/fixtures/performance.ts';
import { instrumentDatabaseReads, measure } from './performance/measure.ts';

import type { AppSnapshot } from '../src/lib/data/repository.ts';
import type { ReviewStats } from '../src/lib/domain/stats/review-stats.ts';
import type { Measurement } from './performance/measure.ts';

const { values } = parseArgs({
  options: { quick: { type: 'boolean', default: false }, report: { type: 'string' } },
});
const reportPath = resolve(values.report ?? 'artifacts/performance/domain.json');
const now = new Date();
const scales = values.quick ? [100] : [100, 1_000, 10_000];
const results: Array<{
  notes: number;
  cards: number;
  reviews: number;
  fixtureMs: number;
  measurements: Measurement[];
}> = [];

async function resetDatabase(): Promise<void> {
  await closeDatabaseConnection();
  await new Promise<void>((done, reject) => {
    const request = indexedDB.deleteDatabase('fritz');
    request.addEventListener('success', () => done(), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
    request.addEventListener('blocked', () => reject(new Error('Fixture database is blocked.')), {
      once: true,
    });
  });
}

async function runScale(noteCount: number): Promise<void> {
  await resetDatabase();
  globalThis.gc?.();
  const fixture = createPerformanceFixture(noteCount, noteCount * 10, now);
  const fixtureStart = performance.now();
  await replaceWithBackup(fixture);
  const result = {
    notes: fixture.notes.length,
    cards: fixture.cards.length,
    reviews: fixture.reviews.length,
    fixtureMs: Math.round(performance.now() - fixtureStart),
    measurements: [] as Measurement[],
  };
  results.push(result);
  console.log(
    `Performance: ${result.notes} notes / ${result.cards} cards / ${result.reviews} reviews`,
  );
  async function benchmark<T>(input: Parameters<typeof measure<T>>[0]): Promise<void> {
    const measurement = await measure(input);
    result.measurements.push(measurement);
    console.log(
      `  ${measurement.passed ? 'PASS' : 'FAIL'} ${measurement.name}: p50 ${measurement.p50Ms} ms / p95 ${measurement.p95Ms} ms (budget ${measurement.budgetMs} ms)${measurement.error ? ` — ${measurement.error}` : ''}`,
    );
  }

  let snapshot: AppSnapshot = await loadSnapshot();
  const reads = instrumentDatabaseReads();
  try {
    await benchmark({
      name: 'startup',
      samples: 3,
      budgetMs: 4_000,
      run: () => loadSnapshot(),
      verify: (loaded) => {
        snapshot = loaded;
        assert.equal(loaded.notes.length, fixture.notes.length);
        assert.equal(loaded.cards.length, fixture.cards.length);
        assert.equal(loaded.recentReviews.length, Math.min(2_000, fixture.reviews.length));
        assert.equal(loaded.learningEvidence.length, Math.min(1_000, fixture.reviews.length / 10));
        assert.equal(
          loaded.reviewStats.countedReviews,
          fixture.reviews.filter(isCountedReview).length,
        );
        assert.ok(loaded.skillStates.length > 0, 'Skill projections must remain available.');
        assert.ok(
          !reads.reads.some(
            (read) => ['reviews', 'learningEvidence'].includes(read.store) && !read.bounded,
          ),
          'Startup must not read full review/evidence history, even through an index.',
        );
      },
    });
  } finally {
    reads.restore();
  }

  await benchmark({
    name: 'library-index',
    budgetMs: 100,
    run: () => buildLibraryIndex(snapshot.notes, snapshot.cards, 'cs'),
    verify: (index) => {
      assert.equal(index.entries.length, fixture.notes.length);
    },
  });
  const libraryIndex = buildLibraryIndex(snapshot.notes, snapshot.cards, 'cs');
  await benchmark({
    name: 'library-search',
    budgetMs: 50,
    run: () =>
      selectLibraryNotes(libraryIndex, {
        query: String(noteCount - 1).padStart(5, '0'),
        kind: 'all',
        tag: 'all',
        sort: 'recent',
      }),
    verify: (notes) => {
      assert.deepEqual(
        notes.map((note) => note.id),
        [fixture.notes.at(-1)!.id],
      );
    },
  });
  for (const sort of ['recent', 'alphabetical', 'mastery', 'due'] as const) {
    // oxlint-disable-next-line no-await-in-loop -- sorting series must not compete for CPU.
    await benchmark({
      name: `library-sort-${sort}`,
      budgetMs: 100,
      run: () => selectLibraryNotes(libraryIndex, { query: '', kind: 'all', tag: 'all', sort }),
      verify: (notes) => {
        assert.equal(notes.length, snapshot.notes.length);
        assert.equal(new Set(notes.map((note) => note.id)).size, notes.length);
      },
    });
  }

  await benchmark({
    name: 'due-queue',
    budgetMs: 100,
    run: () => selectDueCards(snapshot.cards, now, 50, 15),
    verify: (cards) => {
      assert.equal(cards.length, 50);
      assert.ok(cards.every((card) => Date.parse(card.dueAt) <= now.getTime()));
      assert.ok(cards.filter((card) => !card.fsrs).length <= 15);
      assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
    },
  });
  await benchmark({
    name: 'filtered-due-queue',
    budgetMs: 100,
    run: () =>
      selectDueCardsForTraining(
        snapshot.cards,
        snapshot.notes,
        { tag: 'school', source: 'own' },
        now,
      ),
    verify: (cards) => {
      const noteById = new Map(snapshot.notes.map((note) => [note.id, note]));
      assert.ok(cards.length > 0);
      assert.ok(cards.every((card) => noteById.get(card.noteId)?.tags.includes('school')));
    },
  });
  const note = snapshot.notes[1];
  const card = snapshot.cards.find((candidate) => candidate.noteId === note.id)!;
  await benchmark({
    name: 'choice-options',
    budgetMs: 100,
    run: () => buildChoiceOptions(note, snapshot.notes, 4, 42),
    verify: (options) => {
      assert.equal(options.length, 4);
      assert.ok(options.some((option) => option.id === note.id));
      assert.equal(new Set(options.map((option) => option.id)).size, 4);
    },
  });
  await benchmark({
    name: 'matching-exercise',
    budgetMs: 150,
    run: () => buildVocabularyMatchingExercise(note, snapshot.notes, 4, 42),
    verify: (exercise) => {
      assert.ok(exercise);
    },
  });
  await benchmark({
    name: 'adaptive-exercise',
    budgetMs: 150,
    run: () =>
      chooseAdaptiveExercise({
        card,
        note,
        notes: snapshot.notes,
        reviews: snapshot.recentReviews,
        preferences: snapshot.settings.exercisePreferences,
        sessionIndex: 42,
        aiAvailable: false,
      }),
    verify: (decision) => {
      assert.ok(decision.available.includes(decision.kind));
    },
  });
  for (const minutes of [5, 10, 20] as const) {
    // oxlint-disable-next-line no-await-in-loop -- run each timing series in isolation.
    await benchmark({
      name: `daily-plan-${minutes}min`,
      budgetMs: 200,
      run: () =>
        buildDailyLessonPlan({
          now,
          minutes,
          learningGoal: 'school',
          cards: snapshot.cards,
          notes: snapshot.notes,
          skillStates: snapshot.skillStates,
          learningEvidence: snapshot.learningEvidence,
          grammarLessons,
          coachScenarios,
          chapters: coursePathChapters,
        }),
      verify: (plan) => {
        assert.ok(plan.activities.length > 0 && plan.activities.length < 20);
        const reviews = plan.activities.filter((activity) => activity.kind === 'review');
        assert.ok(reviews.length >= 2);
        assert.equal(new Set(reviews.map((activity) => activity.noteId)).size, reviews.length);
      },
    });
  }
  await benchmark({
    name: 'course-path',
    budgetMs: 50,
    run: () => coursePathViews(snapshot.course, 'A1.1'),
    verify: (chapters) => {
      assert.equal(chapters.length, coursePathChapters.length);
    },
  });
  await benchmark({
    name: 'progress-summary',
    budgetMs: 150,
    run: () =>
      gamificationSummary(
        snapshot.recentReviews,
        snapshot.cards,
        now,
        20,
        snapshot.course,
        snapshot.reviewStats,
      ),
    verify: (summary) => {
      assert.equal(summary.totalXp, snapshot.reviewStats.reviewXp);
    },
  });
  // Export before adding measured reviews: the largest fixture already reaches
  // the supported 100,000-review backup boundary.
  await benchmark({
    name: 'backup-export',
    samples: 1,
    warmups: 0,
    budgetMs: 10_000,
    run: () => exportBackup(),
    verify: (backup) => {
      assert.equal(backup.notes.length, fixture.notes.length);
      assert.equal(backup.reviews.length, fixture.reviews.length);
      assert.equal(backup.learningEvidence.length, fixture.learningEvidence.length);
    },
  });

  const hotNote = fixture.notes[0];
  const expectedHistory = fixture.reviews
    .filter((review) => review.noteId === hotNote.id)
    .toSorted((left, right) => right.reviewedAt.localeCompare(left.reviewedAt))
    .slice(0, 5);
  await benchmark({
    name: 'hot-note-history',
    samples: 3,
    budgetMs: 100,
    run: async () => {
      const audit = instrumentDatabaseReads();
      try {
        const history = await loadNoteReviewHistory(hotNote.id, 5);
        return { history, cursorSteps: audit.cursorSteps() };
      } finally {
        audit.restore();
      }
    },
    verify: ({ history, cursorSteps }) => {
      assert.deepEqual(
        history.map((review) => review.id),
        expectedHistory.map((review) => review.id),
      );
      assert.ok(cursorSteps <= 5, `Read ${cursorSteps} cursor rows to display only five reviews.`);
    },
  });
  const reviewInput = {
    cardId: card.id,
    noteId: note.id,
    mode: 'long-term' as const,
    rating: 'good' as const,
    signal: performanceSignal(),
    now,
  };
  await benchmark({
    name: 'review-commit',
    samples: 5,
    budgetMs: 250,
    run: async (iteration) => {
      const audit = instrumentDatabaseReads();
      try {
        const committed = await recordReview({
          ...reviewInput,
          operationId: `perf-commit-${iteration}`,
        });
        return { committed, reads: audit.reads };
      } finally {
        audit.restore();
      }
    },
    verify: ({ committed, reads: operations }) => {
      assert.equal(committed.replayed, false);
      assert.equal(committed.log.noteId, note.id);
      assert.ok(
        !operations.some(
          (read) => ['reviews', 'notes', 'cards'].includes(read.store) && !read.bounded,
        ),
      );
    },
  });
  const statsBeforeReplay = await getOne<ReviewStats>('reviewStats', 'reviews');
  await benchmark({
    name: 'review-idempotent-replay',
    samples: 5,
    budgetMs: 150,
    run: () => recordReview({ ...reviewInput, operationId: 'perf-commit-0' }),
    verify: (replayed) => {
      assert.equal(replayed.replayed, true);
    },
  });
  assert.deepEqual(await getOne<ReviewStats>('reviewStats', 'reviews'), statsBeforeReplay);
  await benchmark({
    name: 'settings-save',
    samples: 3,
    budgetMs: 100,
    run: () => saveSettings({ dailyMinutes: 20 }),
    verify: (saved) => {
      assert.equal(saved.settings.dailyMinutes, 20);
    },
  });
  await benchmark({
    name: 'vocabulary-edit',
    samples: 3,
    budgetMs: 100,
    run: async () => {
      const audit = instrumentDatabaseReads();
      try {
        const saved = await saveNote(note.id, { ...draftFromNote(note), czech: 'upravený význam' });
        return { saved, reads: audit.reads };
      } finally {
        audit.restore();
      }
    },
    verify: ({ saved, reads: operations }) => {
      assert.equal(saved.czech, 'upravený význam');
      assert.ok(
        !operations.some((read) => ['notes', 'cards'].includes(read.store) && !read.bounded),
        'Editing one word must not read every note or card.',
      );
    },
  });
  await benchmark({
    name: 'duplicate-import-100',
    samples: 3,
    budgetMs: 500,
    run: () =>
      addImportedNotes(fixture.decks[0].id, fixture.notes.slice(0, 100).map(draftFromNote)),
    verify: (imported) => {
      assert.equal(imported.duplicates, 100);
      assert.equal(imported.addedNotes.length, 0);
    },
  });
  await benchmark({
    name: 'reward-purchase',
    samples: 1,
    warmups: 0,
    budgetMs: 100,
    run: async () => {
      const audit = instrumentDatabaseReads();
      try {
        const purchased = await saveDoubleXpPurchase({ progress: snapshot.course, now });
        return { purchased, reads: audit.reads };
      } finally {
        audit.restore();
      }
    },
    verify: ({ reads: operations }) => {
      assert.ok(
        !operations.some((read) => ['reviews', 'cards'].includes(read.store) && !read.bounded),
      );
    },
  });
}

let fatalError: string | undefined;
try {
  for (const scale of scales) {
    // oxlint-disable-next-line no-await-in-loop -- parallel runs invalidate timings and share IndexedDB.
    await runScale(scale);
  }
} catch (cause) {
  fatalError = cause instanceof Error ? (cause.stack ?? cause.message) : String(cause);
} finally {
  await closeDatabaseConnection();
  const failed = results.flatMap((result) => result.measurements.filter((item) => !item.passed));
  const report = {
    schemaVersion: 1,
    startedAt: now.toISOString(),
    environment: {
      node: process.version,
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      indexedDB: 'fake-indexeddb (Node; browser timings are reported separately)',
    },
    profile: values.quick ? 'quick' : 'full',
    memory: {
      heapUsedMiB: Math.round(process.memoryUsage().heapUsed / 1_048_576),
      rssMiB: Math.round(process.memoryUsage().rss / 1_048_576),
    },
    passed: !fatalError && failed.length === 0 && results.length === scales.length,
    results,
    ...(fatalError ? { fatalError } : {}),
  };
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Performance report: ${reportPath}`);
  if (fatalError) console.error(fatalError);
  if (!report.passed) process.exitCode = 1;
}
