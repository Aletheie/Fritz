import { localizedError } from '../errors.ts';
import {
  coursePathChapterById,
  coursePathNodeById,
  visibleCoursePathChapters,
} from './path-catalog.ts';
import type {
  CompleteCoursePathNodeResult,
  CoursePathChapter,
  CoursePathChapterView,
  CoursePathNode,
  CoursePathNodeState,
} from './path-types.ts';

import type {
  CourseDoubleXpBoost,
  CoursePathEvent,
  CourseProgress,
  DetailedCefrLevel,
} from '../types.ts';

function nodeCompleted(progress: CourseProgress, node: CoursePathNode): boolean {
  if (node.required && progress.grandfatheredChapterIds.includes(node.chapterId)) return true;
  if (node.type === 'reading' && node.storyBookId) {
    return (progress.storyBooks[node.storyBookId]?.completedEpisodeIds.length ?? 0) > 0;
  }
  return Boolean(progress.pathNodes[node.id]?.completedAt);
}

export function checkpointForChapter(chapter: CoursePathChapter): CoursePathNode {
  const checkpoint = chapter.nodes.find((node) => node.type === 'checkpoint');
  if (!checkpoint) throw new Error(`Kapitola ${chapter.id} nemá checkpoint.`);
  return checkpoint;
}

export function coursePathChapterCompleted(
  progress: CourseProgress,
  chapter: CoursePathChapter,
): boolean {
  return nodeCompleted(progress, checkpointForChapter(chapter));
}

export function coursePathChapterUnlocked(
  progress: CourseProgress,
  chapter: CoursePathChapter,
  minimumLevel: DetailedCefrLevel,
): boolean {
  const visible = visibleCoursePathChapters(minimumLevel);
  const index = visible.findIndex((candidate) => candidate.id === chapter.id);
  if (index < 0) return false;
  if (index === 0) return true;
  return coursePathChapterCompleted(progress, visible[index - 1]);
}

function firstIncompleteRequiredNode(
  progress: CourseProgress,
  chapter: CoursePathChapter,
): CoursePathNode | undefined {
  for (const node of chapter.nodes) {
    if (node.required && !nodeCompleted(progress, node)) return node;
  }
  return undefined;
}

export function currentCoursePathNode(
  progress: CourseProgress,
  minimumLevel: DetailedCefrLevel,
): CoursePathNode | undefined {
  const visible = visibleCoursePathChapters(minimumLevel);
  for (const [index, chapter] of visible.entries()) {
    if (index > 0 && !coursePathChapterCompleted(progress, visible[index - 1])) break;
    const next = firstIncompleteRequiredNode(progress, chapter);
    if (next) return next;
  }
  return undefined;
}

export function recommendedCoursePathNode(
  progress: CourseProgress,
  minimumLevel: DetailedCefrLevel,
): CoursePathNode | undefined {
  const current = currentCoursePathNode(progress, minimumLevel);
  if (current) return current;
  const visible = visibleCoursePathChapters(minimumLevel);
  for (const chapter of visible) {
    for (const node of chapter.nodes) {
      if (
        node.type === 'reading' &&
        node.storyBookId &&
        progress.unlockedStoryBooks.includes(node.storyBookId) &&
        !nodeCompleted(progress, node)
      ) {
        return node;
      }
    }
  }
  return visible.at(-1)?.nodes.find((node) => node.type === 'checkpoint');
}

export function coursePathNodeState(
  progress: CourseProgress,
  node: CoursePathNode,
  minimumLevel: DetailedCefrLevel,
): CoursePathNodeState {
  if (nodeCompleted(progress, node)) return 'completed';
  const chapter = coursePathChapterById(node.chapterId);
  if (!chapter || !coursePathChapterUnlocked(progress, chapter, minimumLevel)) return 'locked';

  if (node.type === 'reading') {
    return node.storyBookId && progress.unlockedStoryBooks.includes(node.storyBookId)
      ? 'bonus'
      : 'locked';
  }

  const current = currentCoursePathNode(progress, minimumLevel);
  if (current?.id !== node.id) return 'locked';
  return progress.pathNodes[node.id]?.startedAt ? 'in-progress' : 'current';
}

export function coursePathViews(
  progress: CourseProgress,
  minimumLevel: DetailedCefrLevel,
): CoursePathChapterView[] {
  const visible = visibleCoursePathChapters(minimumLevel);
  const currentNode = currentCoursePathNode(progress, minimumLevel);
  const completedChapters = visible.map((chapter) => coursePathChapterCompleted(progress, chapter));
  const unlockedStoryBooks = new Set(progress.unlockedStoryBooks);

  return visible.map((chapter, chapterIndex) => {
    const completedNodeIds = new Set<string>();
    let completedRequired = 0;
    let requiredTotal = 0;
    for (const node of chapter.nodes) {
      const completed = nodeCompleted(progress, node);
      if (completed) completedNodeIds.add(node.id);
      if (!node.required) continue;
      requiredTotal += 1;
      if (completed) completedRequired += 1;
    }
    const unlocked = chapterIndex === 0 || completedChapters[chapterIndex - 1];
    const completed = completedChapters[chapterIndex];
    return {
      chapter,
      unlocked,
      completed,
      current: currentNode?.chapterId === chapter.id,
      completedRequired,
      requiredTotal,
      percent: Math.round((completedRequired / Math.max(1, requiredTotal)) * 100),
      nodes: chapter.nodes.map((node) => {
        const state: CoursePathNodeState = completedNodeIds.has(node.id)
          ? 'completed'
          : !unlocked
            ? 'locked'
            : node.type === 'reading'
              ? node.storyBookId && unlockedStoryBooks.has(node.storyBookId)
                ? 'bonus'
                : 'locked'
              : currentNode?.id !== node.id
                ? 'locked'
                : progress.pathNodes[node.id]?.startedAt
                  ? 'in-progress'
                  : 'current';
        return {
          node,
          state,
          progress: progress.pathNodes[node.id],
          lockReason:
            state !== 'locked'
              ? undefined
              : !unlocked
                ? 'Dokonči checkpoint předchozí kapitoly.'
                : node.type === 'reading'
                  ? 'Četbu odemkne checkpoint této kapitoly.'
                  : 'Nejdřív dokonči předchozí krok.',
        };
      }),
    };
  });
}

function assertCoursePathNodeCanAdvance(
  progress: CourseProgress,
  node: CoursePathNode,
  minimumLevel: DetailedCefrLevel,
): void {
  if (nodeCompleted(progress, node)) return;
  const current = currentCoursePathNode(progress, minimumLevel);
  if (current?.id !== node.id) {
    throw localizedError(
      'Tento krok je zatím zamčený. Nejdřív dokonči předchozí uzel cesty.',
      'This step is still locked. Finish the previous path step first.',
    );
  }
}

export function startCoursePathNode(
  progress: CourseProgress,
  nodeId: string,
  now = new Date(),
  minimumLevel: DetailedCefrLevel = 'A1.1',
): CourseProgress {
  const node = coursePathNodeById(nodeId);
  if (!node || node.type === 'reading') {
    throw localizedError(
      'Tento uzel kurzové cesty nelze spustit.',
      'This course path step cannot be started.',
    );
  }
  assertCoursePathNodeCanAdvance(progress, node, minimumLevel);
  const timestamp = now.toISOString();
  const current = progress.pathNodes[nodeId];
  if (current?.startedAt || current?.completedAt) return progress;
  return {
    ...progress,
    pathNodes: {
      ...progress.pathNodes,
      [nodeId]: {
        nodeId,
        startedAt: timestamp,
        attempts: 0,
        bestStars: 0,
        xpAwarded: 0,
        updatedAt: timestamp,
      },
    },
    updatedAt: timestamp,
  };
}

function activeDoubleXpBoost(progress: CourseProgress): CourseDoubleXpBoost | undefined {
  return progress.wallet.boosts.find((boost) => boost.status === 'active');
}

function clampStars(value: number): 1 | 2 | 3 {
  if (value >= 3) return 3;
  if (value >= 2) return 2;
  return 1;
}

export function completeCoursePathNode(
  progress: CourseProgress,
  nodeId: string,
  rawStars = 1,
  now = new Date(),
  minimumLevel: DetailedCefrLevel = 'A1.1',
): CompleteCoursePathNodeResult {
  const node = coursePathNodeById(nodeId);
  if (!node || node.type === 'reading')
    throw localizedError(
      'Tento uzel kurzové cesty nelze dokončit.',
      'This course path step cannot be completed.',
    );
  const chapter = coursePathChapterById(node.chapterId);
  if (!chapter)
    throw localizedError(
      'Kapitola kurzové cesty už není dostupná.',
      'This course chapter is no longer available.',
    );
  assertCoursePathNodeCanAdvance(progress, node, minimumLevel);

  const timestamp = now.toISOString();
  const current = progress.pathNodes[nodeId];
  const grandfathered = progress.grandfatheredChapterIds.includes(node.chapterId);
  const firstCompletion = !current?.completedAt && !grandfathered;
  const materializedNow = !current?.completedAt;
  const stars = clampStars(rawStars);
  const previousStars = current?.bestStars ?? 0;
  const bestStars = Math.max(previousStars, stars) as 1 | 2 | 3;
  const boost = firstCompletion && node.xp > 0 ? activeDoubleXpBoost(progress) : undefined;
  const baseXp = firstCompletion ? node.xp : 0;
  const bonusXp = boost ? baseXp : 0;
  const xpAwarded = baseXp + bonusXp;
  const event: CoursePathEvent | undefined = materializedNow
    ? {
        id: `path:${node.id}`,
        nodeId: node.id,
        chapterId: node.chapterId,
        completedAt: timestamp,
        stars,
        baseXp,
        bonusXp,
        xpAwarded,
        boosted: Boolean(boost),
      }
    : undefined;

  const nextBoosts = boost
    ? progress.wallet.boosts.map((candidate) =>
        candidate.id === boost.id
          ? {
              ...candidate,
              status: 'consumed' as const,
              consumedAt: timestamp,
              consumedByNodeId: node.id,
            }
          : candidate,
      )
    : progress.wallet.boosts;

  const unlockedStoryBookId =
    firstCompletion && node.type === 'checkpoint' ? chapter.storyBookId : undefined;
  const unlockedStoryBooks =
    unlockedStoryBookId && !progress.unlockedStoryBooks.includes(unlockedStoryBookId)
      ? [...progress.unlockedStoryBooks, unlockedStoryBookId]
      : progress.unlockedStoryBooks;

  const nextProgress: CourseProgress = {
    ...progress,
    pathNodes: {
      ...progress.pathNodes,
      [nodeId]: {
        nodeId,
        ...(current?.writtenResponse === undefined
          ? {}
          : { writtenResponse: current.writtenResponse }),
        ...(current?.writingDraft === undefined ? {} : { writingDraft: current.writingDraft }),
        startedAt: current?.startedAt ?? timestamp,
        completedAt: current?.completedAt ?? timestamp,
        attempts: (current?.attempts ?? 0) + 1,
        bestStars,
        xpAwarded: firstCompletion ? xpAwarded : (current?.xpAwarded ?? 0),
        updatedAt: timestamp,
      },
    },
    pathEvents: event ? [...progress.pathEvents, event] : progress.pathEvents,
    unlockedStoryBooks,
    wallet: boost ? { ...progress.wallet, boosts: nextBoosts } : progress.wallet,
    updatedAt: timestamp,
  };

  return {
    progress: nextProgress,
    firstCompletion,
    starsImproved: bestStars > previousStars,
    previousStars,
    stars: bestStars,
    xpAwarded,
    boosted: Boolean(boost),
    event,
    unlockedStoryBookId:
      unlockedStoryBookId && !progress.unlockedStoryBooks.includes(unlockedStoryBookId)
        ? unlockedStoryBookId
        : undefined,
  };
}

export function pathXp(progress: CourseProgress): number {
  return progress.pathEvents.reduce((sum, event) => sum + Math.max(0, event.xpAwarded), 0);
}
