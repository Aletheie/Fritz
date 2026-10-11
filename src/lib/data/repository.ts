// Intent-based repository commands, grouped by area. Import from here, not the submodules.
export {
  ensureSeeded,
  prepareLocalDataForAccount,
  loadSnapshot,
  exportBackup,
  resetToSeed,
  restoreBackup,
  rollbackIsAvailable,
  rollbackLastDestructiveChange,
} from './repository/snapshot.ts';
export type { AppSnapshot } from './repository/snapshot.ts';
export {
  loadNoteReviewHistory,
  addImportedNotes,
  saveNote,
  recordReview,
  disputeReview,
  removeNote,
} from './repository/vocabulary.ts';
export { saveSettings } from './repository/settings.ts';
export {
  saveCourseAnswer,
  saveGrammarLessonRun,
  saveCoachSession,
  savePathNodeStart,
  savePathWritingDraft,
  savePathNodeCompletion,
  saveVocabularyPathNodeCompletion,
  saveDoubleXpPurchase,
  saveCourseRewardClaim,
} from './repository/course.ts';
export {
  saveStoryPage,
  saveStoryCheckpoint,
  saveStoryEpisode,
  saveStoryWord,
} from './repository/stories.ts';
export { loadOrCreateDailySession, saveDailyActivityResult } from './repository/daily.ts';
