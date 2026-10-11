// IndexedDB access, grouped by concern in ./db. Import from here, not the submodules.
export {
  DB_VERSION,
  closeDatabaseConnection,
  openDatabase,
  getAll,
  getOne,
} from './db/connection.ts';
export type { StoreName } from './db/connection.ts';
export { subscribeDatabaseSync, publishDatabaseSync } from './db/sync.ts';
export type { DatabaseSyncEvent } from './db/sync.ts';
export { getOrCreateDailySession, mutateDailySession } from './db/learning.ts';
export {
  readRecentReviewsForNote,
  readStoredSnapshot,
  seedDatabaseIfEmpty,
  bindLocalAccount,
  replaceWithBackup,
  readBackup,
} from './db/snapshot.ts';
export type { LocalAccountBinding, StoredSnapshot } from './db/snapshot.ts';
export {
  mutateSettingsAndDeck,
  putCourseProgress,
  mutateCourseProgress,
  mutateCourseAndVocabulary,
  mutateCourseWithReviewStats,
  mutateNote,
  mutateVocabularyRecords,
  commitReviewCommand,
  mutateReviewAndCard,
  deleteNoteCascade,
} from './db/mutations.ts';
export type { ReviewCommandSnapshot } from './db/mutations.ts';
