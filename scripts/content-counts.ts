import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

import { transferCoachScenarios } from '../src/lib/domain/course/coach-scenarios-transfer.ts';
import { coachScenarios } from '../src/lib/domain/course/coach.ts';
import { diversityChapterBridges } from '../src/lib/domain/course/course-diversity-chapters.ts';
import { transferChapterThreads } from '../src/lib/domain/course/course-transfer-threads.ts';
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

export function renderContentCounts(): string {
  const c = contentCounts;
  const rows: Array<[string, number]> = [
    ['Course content version', c.courseContentVersion],
    ['Core chapters', c.coreChapters],
    ['Preserved legacy chapters', c.legacyChapters],
    ['Additive chapters', c.additiveChapters],
    ['Path nodes', c.pathNodes],
    ['Unique sense-aware lexemes', c.uniqueLexemes],
    ['Curated topic vocabulary packs', c.curatedTopicVocabularyPacks],
    ['Curated topic vocabulary', c.curatedTopicVocabulary],
    ['Contextual model sentences', c.modelSentences],
    ['Chapter listening dictations', c.chapterListeningDictations],
    ['Chapter error clinics', c.chapterErrorClinics],
    ['Chapter dialogues', c.chapterDialogues],
    ['Chapter dialogues tied to vocabulary', c.coherentChapterDialogues],
    ['Explicit transfer chapter threads', c.transferChapterThreads],
    ['Grammar-linked topic chapter bridges', c.topicChapterBridges],
    ['Deterministic assessments', c.deterministicAssessments],
    ['Grammar categories', c.grammarCategories],
    ['Grammar lessons', c.grammarLessons],
    ['Grammar questions', c.grammarQuestions],
    ['Coach scenarios', c.coachScenarios],
    ['Dedicated transfer coach scenarios', c.dedicatedTransferCoachScenarios],
    ['Reading books', c.storyBooks],
    ['Reading episodes', c.storyEpisodes],
    ['Reading screens', c.storyScreens],
    ['Reading checkpoints', c.storyCheckpoints],
    ['Story glossary entries', c.storyGlossaryEntries],
    ['Advanced story glossary entries', c.advancedStoryGlossaryEntries],
  ];
  const labelWidth = Math.max('Catalog'.length, ...rows.map(([label]) => label.length));
  const countWidth = Math.max('Count'.length, ...rows.map(([, count]) => String(count).length));
  const table = [
    `| ${'Catalog'.padEnd(labelWidth)} | ${'Count'.padStart(countWidth)} |`,
    `| ${'-'.repeat(labelWidth)} | ${'-'.repeat(countWidth - 1)}: |`,
    ...rows.map(
      ([label, count]) => `| ${label.padEnd(labelWidth)} | ${String(count).padStart(countWidth)} |`,
    ),
  ].join('\n');
  return `<!-- Generated by pnpm content:counts. Do not edit counts manually. -->\n\n# Content counts\n\n${table}\n`;
}

const target = new URL('../CONTENT_COUNTS.md', import.meta.url);
const expected = renderContentCounts();
if (process.argv.includes('--check')) {
  const actual = await readFile(target, 'utf8').catch(() => '');
  if (actual !== expected) {
    console.error('CONTENT_COUNTS.md is stale. Run pnpm content:counts.');
    process.exitCode = 1;
  } else {
    console.log('CONTENT_COUNTS.md is current.');
  }
} else {
  await writeFile(target, expected, 'utf8');
  console.log('Updated CONTENT_COUNTS.md.');
}
