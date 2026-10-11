import { parseBackup } from '../../domain/backup/validate.ts';
import {
  createCourseProgress,
  normalizeCourseProgress,
} from '../../domain/course/course-progress.ts';
import { localizedError } from '../../domain/errors.ts';
import { migrateSettings } from '../../domain/settings/defaults.ts';
import {
  publishDatabaseSync,
  bindLocalAccount,
  readBackup,
  readStoredSnapshot,
  replaceWithBackup,
  seedDatabaseIfEmpty,
} from '../db.ts';
import { createSeedData } from '../seed.ts';

import type {
  DailySessionRecord,
  LearningEvidence,
  SkillState,
} from '../../domain/learning/types.ts';
import type { ReviewStats } from '../../domain/stats/review-stats.ts';
import type {
  AppBackup,
  AppSettings,
  CourseProgress,
  Deck,
  Note,
  ReviewLog,
  StudyCard,
} from '../../domain/types.ts';

export type AppSnapshot = {
  decks: Deck[];
  notes: Note[];
  cards: StudyCard[];
  recentReviews: ReviewLog[];
  reviewStats: ReviewStats;
  learningEvidence: LearningEvidence[];
  skillStates: SkillState[];
  dailySessions: DailySessionRecord[];
  settings: AppSettings;
  course: CourseProgress;
};

let rollbackBackup: AppBackup | undefined;

function createFreshBackup(): AppBackup {
  const seed = createSeedData();
  return {
    schemaVersion: 8,
    exportedAt: new Date().toISOString(),
    decks: [seed.deck],
    notes: seed.notes,
    cards: seed.cards,
    reviews: [],
    learningEvidence: [],
    settings: seed.settings,
    course: createCourseProgress(new Date(seed.settings.createdAt)),
  };
}

async function replaceDestructivelyWithRollback(backup: AppBackup): Promise<AppSnapshot> {
  const target = parseBackup(backup);
  const previous = parseBackup(await readBackup());
  try {
    await replaceWithBackup(target);
    // A successful commit is not enough: read and validate every invariant before exposing state.
    parseBackup(await readBackup());
    rollbackBackup = previous;
    return loadSnapshot();
  } catch (error) {
    // replaceWithBackup itself is atomic. This restores the previous snapshot only when a later
    // verification/read failed after the replacement transaction had committed.
    try {
      await replaceWithBackup(previous);
    } catch {
      throw localizedError(
        'Obnova selhala a automatický rollback se nepodařilo ověřit.',
        'The restore failed and the automatic rollback could not be verified.',
        {
          cause: error,
        },
      );
    }
    throw error;
  }
}

export async function ensureSeeded(): Promise<void> {
  await seedDatabaseIfEmpty(createFreshBackup());
}

export async function prepareLocalDataForAccount(input: {
  accountId: string;
  accountCreatedAt: string;
}): Promise<boolean> {
  const accountId = input.accountId.trim();
  const accountCreatedAt = Date.parse(input.accountCreatedAt);
  if (!accountId || Number.isNaN(accountCreatedAt)) {
    throw localizedError(
      'Server neposkytl platnou identitu účtu.',
      'The server did not provide a valid account identity.',
    );
  }

  const shouldReset = await bindLocalAccount(accountId, createFreshBackup());
  if (shouldReset) rollbackBackup = undefined;
  return shouldReset;
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  await ensureSeeded();
  const snapshot = await readStoredSnapshot();
  if (!snapshot.settings)
    throw localizedError('Nastavení aplikace není dostupné.', 'App settings are not available.');

  return {
    decks: snapshot.decks,
    notes: snapshot.notes,
    cards: snapshot.cards,
    recentReviews: snapshot.recentReviews,
    reviewStats: snapshot.reviewStats,
    learningEvidence: snapshot.learningEvidence,
    skillStates: snapshot.skillStates,
    dailySessions: snapshot.dailySessions,
    settings: migrateSettings(snapshot.settings),
    course: normalizeCourseProgress(
      snapshot.course ?? createCourseProgress(new Date(snapshot.settings.createdAt)),
    ),
  };
}

export async function exportBackup(): Promise<AppBackup> {
  return parseBackup(await readBackup());
}

export async function resetToSeed(): Promise<AppSnapshot> {
  publishDatabaseSync({ type: 'reset-started' });
  return replaceDestructivelyWithRollback(createFreshBackup());
}

export async function restoreBackup(value: unknown): Promise<AppSnapshot> {
  const backup = parseBackup(value);
  publishDatabaseSync({ type: 'restore-started' });
  return replaceDestructivelyWithRollback(backup);
}

export function rollbackIsAvailable(): boolean {
  return rollbackBackup !== undefined;
}

export async function rollbackLastDestructiveChange(): Promise<AppSnapshot> {
  const target = rollbackBackup;
  if (!target)
    throw localizedError(
      'Žádná krátkodobá záloha pro vrácení změny není dostupná.',
      'No short-term backup is available to undo this change.',
    );
  const current = parseBackup(await readBackup());
  await replaceWithBackup(target);
  parseBackup(await readBackup());
  rollbackBackup = current;
  return loadSnapshot();
}
