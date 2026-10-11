// The course path facade: types, catalog and progression live in ./path-*.ts.
export type {
  CoursePathNodeType,
  CoursePathPhase,
  CoursePathNodeState,
  CourseWord,
  CourseLexeme,
  CourseDialogueTurn,
  CourseAssessment,
  CourseModelSentence,
  CoursePathNode,
  CoursePathChapter,
  CoursePathNodeView,
  CoursePathChapterView,
  CompleteCoursePathNodeResult,
  CourseChapterDefinition,
} from './path-types.ts';
export {
  coursePathChapters,
  coursePathChapterById,
  coursePathNodeById,
  chapterForPathNode,
  visibleCoursePathChapters,
  courseSystemTags,
} from './path-catalog.ts';
export {
  checkpointForChapter,
  coursePathChapterCompleted,
  coursePathChapterUnlocked,
  currentCoursePathNode,
  recommendedCoursePathNode,
  coursePathNodeState,
  coursePathViews,
  startCoursePathNode,
  completeCoursePathNode,
  pathXp,
} from './path-progress.ts';
export { storyBookIsUnlocked, storyBookUnlockReason } from './story-unlocks.ts';
