import { rollbackIsAvailable } from '../../data/repository.ts';
import { initialize, refreshClock, state } from './core.ts';
import {
  answerCourseQuestion,
  caseAction,
  claimReward,
  completeCoachSession,
  completeGrammarLessonRun,
  completePathNode,
  completeVocabularyPathNode,
  purchaseDoubleXp,
  rivalAction,
  saveWritingDraft,
  startPathNode,
} from './course.ts';
import { beginDailySession, completeDailySessionActivity } from './daily.ts';
import {
  backup,
  encryptedBackup,
  prepareRestore,
  reset,
  restore,
  undoDestructiveChange,
  updateSettings,
} from './data.ts';
import {
  answerStoryCheckpoint,
  completeStoryEpisode,
  countStorySavedWord,
  readStoryPage,
} from './stories.ts';
import { deleteNote, disputeReview, importNotes, review, updateNote } from './vocabulary.ts';

export const appStore = {
  subscribe: state.subscribe,
  initialize,
  importNotes,
  updateNote,
  review,
  disputeReview,
  answerCourseQuestion,
  completeGrammarLessonRun,
  completeCoachSession,
  startPathNode,
  completePathNode,
  saveWritingDraft,
  completeVocabularyPathNode,
  purchaseDoubleXp,
  claimReward,
  readStoryPage,
  answerStoryCheckpoint,
  completeStoryEpisode,
  countStorySavedWord,
  updateSettings,
  deleteNote,
  beginDailySession,
  completeDailySessionActivity,
  backup,
  encryptedBackup,
  prepareRestore,
  restore,
  reset,
  rollbackIsAvailable,
  undoDestructiveChange,
  refreshClock,
  rivalAction,
  caseAction,
};
