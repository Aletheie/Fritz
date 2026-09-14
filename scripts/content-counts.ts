import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { caseFiles } from '../src/lib/domain/cases/catalog.ts';

import { transferCoachScenarios } from '../src/lib/domain/course/coach-scenarios-transfer.ts';
import { coachScenarios } from '../src/lib/domain/course/coach.ts';
import { courseCommunications } from '../src/lib/domain/course/course-communication.ts';
import { diversityChapterBridges } from '../src/lib/domain/course/course-diversity-chapters.ts';
import { courseFoundations } from '../src/lib/domain/course/course-foundations.ts';
import { courseInformationGaps } from '../src/lib/domain/course/course-information-gaps.ts';
import { courseMilestones } from '../src/lib/domain/course/course-milestones.ts';
import { transferChapterThreads } from '../src/lib/domain/course/course-transfer-threads.ts';
import { courseWritingProfiles } from '../src/lib/domain/course/course-writing.ts';
import { futureChapterVocabularyPacks } from '../src/lib/domain/course/future-chapter-vocabulary.ts';
import { grammarCategories, grammarLessons } from '../src/lib/domain/course/grammar.ts';
import {
  coursePathQuestionsForNode,
  sentenceUsesCourseWord,
} from '../src/lib/domain/course/path-activities.ts';
import { coursePathChapters } from '../src/lib/domain/course/path.ts';
import { storyGlossaryTier } from '../src/lib/domain/stories/engine.ts';
import { storyBookIds } from '../src/lib/domain/stories/progress.ts';

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});
const { loadStoryBooks } = (await vite.ssrLoadModule('/src/lib/domain/stories/catalog.ts')) as {
  loadStoryBooks: () => Promise<
    Array<{
      level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
      episodeCount: number;
      screenCount: number;
      glossary: Array<{ cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' }>;
      episodes: Array<{ checkpoints: unknown[] }>;
    }>
  >;
};
const storyBooks = await loadStoryBooks();
await vite.close();

export const contentCounts = {
  languageCases: caseFiles.length,
  caseDocuments: caseFiles.reduce((sum, item) => sum + item.documents.length, 0),
  caseDecisions: caseFiles.reduce((sum, item) => sum + item.steps.length, 0),
  courseContentVersion: Math.max(...coursePathChapters.map((chapter) => chapter.contentVersion)),
  coreChapters: coursePathChapters.length,
  legacyChapters: coursePathChapters.filter((chapter) => chapter.legacyAnchor).length,
  additiveChapters: coursePathChapters.filter((chapter) => !chapter.legacyAnchor).length,
  pathNodes: coursePathChapters.reduce((sum, chapter) => sum + chapter.nodes.length, 0),
  uniqueLexemes: new Set(
    coursePathChapters.flatMap((chapter) => chapter.words.map((word) => word.id)),
  ).size,
  curatedTopicVocabularyPacks: futureChapterVocabularyPacks.length,
  curatedTopicVocabulary: futureChapterVocabularyPacks.reduce(
    (sum, chapterPack) => sum + chapterPack.words.length,
    0,
  ),
  modelSentences: coursePathChapters.reduce(
    (sum, chapter) => sum + chapter.modelSentences.length,
    0,
  ),
  chapterListeningDictations: coursePathChapters.reduce(
    (sum, chapter) =>
      sum +
      coursePathQuestionsForNode(chapter, 'mix', 'cs').filter(
        (question) => question.kind === 'dictation',
      ).length,
    0,
  ),
  chapterErrorClinics: coursePathChapters.reduce(
    (sum, chapter) =>
      sum +
      coursePathQuestionsForNode(chapter, 'checkpoint', 'cs').filter(
        (question) => question.kind === 'error',
      ).length,
    0,
  ),
  courseMilestones: courseMilestones.length,
  communicationSequences: courseCommunications.length,
  foundationalVocabulary: Object.values(courseFoundations).flat().length,
  chaptersWithFoundations: Object.keys(courseFoundations).length,
  informationGapScenarios: courseInformationGaps.length,
  informationGapExchanges: courseInformationGaps.reduce((sum, gap) => sum + gap.queries.length, 0),
  listeningComprehensionQuestions: courseCommunications.reduce(
    (sum, item) => sum + item.listening.tasks.length,
    0,
  ),
  evidenceReadingQuestions: courseCommunications.length,
  guidedWritingTasks: courseCommunications.length,
  writingProgressionProfiles: Object.keys(courseWritingProfiles).length,
  activeSentenceRepairs: coursePathChapters.filter((chapter) =>
    coursePathQuestionsForNode(chapter, 'checkpoint').some(
      (question) => question.kind === 'error' && question.response === 'recall',
    ),
  ).length,
  milestoneQuestions: courseMilestones.reduce((sum, milestone) => sum + milestone.tasks.length, 0),
  chapterSentenceRecalls: coursePathChapters.reduce(
    (sum, chapter) =>
      sum +
      coursePathQuestionsForNode(chapter, 'checkpoint').filter(
        (question) => question.kind === 'cloze',
      ).length,
    0,
  ),
  chapterSpiralReviews: coursePathChapters.reduce(
    (sum, chapter) =>
      sum +
      coursePathQuestionsForNode(chapter, 'checkpoint').filter(
        (question) => question.reviewChapterId,
      ).length,
    0,
  ),
  chapterDialogues: coursePathChapters.filter((chapter) => chapter.dialogue.length > 0).length,
  coherentChapterDialogues: coursePathChapters.filter((chapter) =>
    sentenceUsesCourseWord(chapter.dialogue.map((turn) => turn.de).join(' '), chapter.words),
  ).length,
  transferChapterThreads: Object.keys(transferChapterThreads).length,
  topicChapterBridges: Object.keys(diversityChapterBridges).length,
  deterministicAssessments: coursePathChapters.filter((chapter) => chapter.assessment.deterministic)
    .length,
  grammarCategories: grammarCategories.length,
  grammarLessons: grammarLessons.length,
  grammarQuestions: grammarLessons.reduce((sum, lesson) => sum + lesson.questions.length, 0),
  coachScenarios: coachScenarios.length,
  dedicatedTransferCoachScenarios: transferCoachScenarios.length,
  storyBooks: storyBookIds.length,
  storyEpisodes: storyBooks.reduce((sum, book) => sum + book.episodeCount, 0),
  storyScreens: storyBooks.reduce((sum, book) => sum + book.screenCount, 0),
  storyCheckpoints: storyBooks.reduce(
    (sum, book) =>
      sum +
      book.episodes.reduce((episodeSum, episode) => episodeSum + episode.checkpoints.length, 0),
    0,
  ),
  storyGlossaryEntries: storyBooks.reduce((sum, book) => sum + book.glossary.length, 0),
  advancedStoryGlossaryEntries: storyBooks.reduce(
    (sum, book) =>
      sum +
      book.glossary.filter((entry) => storyGlossaryTier(entry.cefr, book.level) === 'advanced')
        .length,
    0,
  ),
} as const;

const target = new URL('./content-counts.json', import.meta.url);
const expected = `${JSON.stringify(contentCounts, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const actual = await readFile(target, 'utf8').catch(() => '');
  if (actual !== expected) {
    console.error('Content counts are stale. Run pnpm content:counts.');
    process.exitCode = 1;
  } else {
    console.log('Content counts are current.');
  }
} else {
  await writeFile(target, expected, 'utf8');
  console.log('Updated scripts/content-counts.json.');
}
