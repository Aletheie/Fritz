import { createId } from '../id.ts';
import { localDateKey } from '../stats/learning.ts';
import { normalizeStoryProgressMap, storyBookIds } from '../stories/progress.ts';
import {
  COURSE_CONTENT_VERSION,
  grandfatheredChaptersForLegacyProgress,
  normalizeGrandfatheredChapterIds,
} from './content-version.ts';
import { grammarLessonIdSet } from './grammar-lesson-ids.ts';

import type { CoachSessionEvent, CourseProgress, MistakeTag } from '../types.ts';

export function createCourseProgress(now = new Date()): CourseProgress {
  const timestamp = now.toISOString();
  return {
    key: 'course',
    schemaVersion: 6,
    contentVersion: COURSE_CONTENT_VERSION,
    grandfatheredChapterIds: [],
    events: [],
    coachEvents: [],
    lessonBestStars: {},
    claimedRewards: [],
    storyBooks: {},
    pathNodes: {},
    pathEvents: [],
    vocabularyEvents: [],
    unlockedStoryBooks: [],
    wallet: { purchases: [], boosts: [] },
    appliedOperations: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function timestampsAreNear(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return (
    Number.isFinite(leftTime) &&
    Number.isFinite(rightTime) &&
    Math.abs(leftTime - rightTime) <= 1_000
  );
}

function repairLivePathConsistency(input: {
  pathNodes: CourseProgress['pathNodes'];
  pathEvents: CourseProgress['pathEvents'];
  vocabularyEvents: CourseProgress['vocabularyEvents'];
}): Pick<CourseProgress, 'pathNodes' | 'pathEvents' | 'vocabularyEvents'> {
  let pathNodes = input.pathNodes;
  let vocabularyEvents = input.vocabularyEvents;
  const eventByNodeId = new Map(input.pathEvents.map((event) => [event.nodeId, event]));

  for (const event of input.pathEvents) {
    const node = pathNodes[event.nodeId];
    if (!node?.completedAt) continue;
    const repairTimestamp =
      node.completedAt !== event.completedAt &&
      timestampsAreNear(node.completedAt, event.completedAt);
    const repairStartedXp = node.xpAwarded === 0 && event.xpAwarded > 0;
    if (!repairTimestamp && !repairStartedXp) continue;
    if (pathNodes === input.pathNodes) pathNodes = { ...input.pathNodes };
    pathNodes[event.nodeId] = {
      ...node,
      completedAt: repairTimestamp ? event.completedAt : node.completedAt,
      xpAwarded: repairStartedXp ? event.xpAwarded : node.xpAwarded,
    };
  }

  const repairedVocabularyEvents = input.vocabularyEvents.map((event) => {
    const pathEvent = eventByNodeId.get(event.nodeId);
    if (
      !pathEvent ||
      event.completedAt === pathEvent.completedAt ||
      !timestampsAreNear(event.completedAt, pathEvent.completedAt)
    ) {
      return event;
    }
    return { ...event, completedAt: pathEvent.completedAt };
  });
  if (repairedVocabularyEvents.some((event, index) => event !== input.vocabularyEvents[index])) {
    vocabularyEvents = repairedVocabularyEvents;
  }

  return { pathNodes, pathEvents: input.pathEvents, vocabularyEvents };
}

export function normalizeCourseProgress(
  value: CourseProgress | undefined,
  now = new Date(),
): CourseProgress {
  if (!value || value.key !== 'course') return createCourseProgress(now);
  const legacy = value as CourseProgress & {
    schemaVersion?: number;
    coachEvents?: CoachSessionEvent[];
    lessonBestStars?: unknown;
    storyBooks?: unknown;
    pathNodes?: unknown;
    pathEvents?: unknown;
    vocabularyEvents?: unknown;
    unlockedStoryBooks?: unknown;
    wallet?: unknown;
    appliedOperations?: unknown;
    contentVersion?: unknown;
    grandfatheredChapterIds?: unknown;
  };
  if (![1, 2, 3, 4, 5, 6].includes(legacy.schemaVersion ?? 0)) {
    return createCourseProgress(now);
  }

  const lessonBestStars: CourseProgress['lessonBestStars'] = {};
  if (
    legacy.lessonBestStars &&
    typeof legacy.lessonBestStars === 'object' &&
    !Array.isArray(legacy.lessonBestStars)
  ) {
    for (const [lessonId, rawStars] of Object.entries(legacy.lessonBestStars).slice(0, 500)) {
      if (
        grammarLessonIdSet.has(lessonId) &&
        lessonId.length > 0 &&
        lessonId.length <= 200 &&
        Number.isInteger(rawStars) &&
        Number(rawStars) >= 0 &&
        Number(rawStars) <= 3
      ) {
        lessonBestStars[lessonId] = Number(rawStars) as 0 | 1 | 2 | 3;
      }
    }
  }

  const storyBooks = normalizeStoryProgressMap(legacy.storyBooks);
  const hasPathData = (legacy.schemaVersion ?? 0) >= 5;
  const rawWallet =
    legacy.wallet && typeof legacy.wallet === 'object' && !Array.isArray(legacy.wallet)
      ? (legacy.wallet as { purchases?: unknown; boosts?: unknown })
      : undefined;
  const rawPathNodes =
    hasPathData &&
    legacy.pathNodes &&
    typeof legacy.pathNodes === 'object' &&
    !Array.isArray(legacy.pathNodes)
      ? (legacy.pathNodes as CourseProgress['pathNodes'])
      : {};
  const rawPathEvents = hasPathData && Array.isArray(legacy.pathEvents) ? legacy.pathEvents : [];
  const rawVocabularyEvents =
    hasPathData && Array.isArray(legacy.vocabularyEvents) ? legacy.vocabularyEvents : [];
  const repairedPath = repairLivePathConsistency({
    pathNodes: rawPathNodes,
    pathEvents: rawPathEvents,
    vocabularyEvents: rawVocabularyEvents,
  });
  const previousContentVersion =
    typeof legacy.contentVersion === 'number' && Number.isInteger(legacy.contentVersion)
      ? legacy.contentVersion
      : 1;
  const preservedGrandfathering = normalizeGrandfatheredChapterIds(legacy.grandfatheredChapterIds);
  const migratedGrandfathering =
    previousContentVersion < COURSE_CONTENT_VERSION
      ? grandfatheredChaptersForLegacyProgress(repairedPath.pathNodes, previousContentVersion)
      : [];

  return {
    ...legacy,
    key: 'course',
    schemaVersion: 6,
    contentVersion: COURSE_CONTENT_VERSION,
    grandfatheredChapterIds: [...new Set([...preservedGrandfathering, ...migratedGrandfathering])],
    events: Array.isArray(legacy.events) ? legacy.events : [],
    coachEvents: Array.isArray(legacy.coachEvents) ? legacy.coachEvents : [],
    lessonBestStars,
    claimedRewards: Array.isArray(legacy.claimedRewards) ? legacy.claimedRewards : [],
    storyBooks,
    pathNodes: repairedPath.pathNodes,
    pathEvents: repairedPath.pathEvents,
    vocabularyEvents: repairedPath.vocabularyEvents,
    // Before schema 5 every book was directly reachable. Preserve that access
    // instead of silently relocking content a returning learner could open.
    unlockedStoryBooks:
      hasPathData && Array.isArray(legacy.unlockedStoryBooks)
        ? legacy.unlockedStoryBooks
        : [...storyBookIds],
    wallet: {
      purchases: hasPathData && Array.isArray(rawWallet?.purchases) ? rawWallet.purchases : [],
      boosts: hasPathData && Array.isArray(rawWallet?.boosts) ? rawWallet.boosts : [],
    },
    appliedOperations: Array.isArray(legacy.appliedOperations)
      ? [
          ...new Set(
            legacy.appliedOperations.filter((item): item is string => typeof item === 'string'),
          ),
        ].slice(-2_000)
      : [],
  };
}

export type RecordCoachSessionInput = {
  scenarioId: string;
  score: number;
  turns: number;
  independentTurns?: number;
  mistakeTags?: MistakeTag[];
  now?: Date;
};

export type RecordCoachSessionResult = {
  progress: CourseProgress;
  event: CoachSessionEvent;
  xpAwarded: number;
};

export function recordCoachSession(
  progress: CourseProgress,
  input: RecordCoachSessionInput,
): RecordCoachSessionResult {
  const now = input.now ?? new Date();
  const today = localDateKey(now);
  const alreadyCompletedToday = progress.coachEvents.some(
    (event) =>
      event.scenarioId === input.scenarioId && localDateKey(new Date(event.completedAt)) === today,
  );
  const score = Math.min(100, Math.max(0, Math.round(input.score)));
  const turns = Math.min(20, Math.max(1, Math.round(input.turns)));
  const independentTurns = Math.min(
    turns,
    Math.max(0, Math.round(input.independentTurns ?? (score >= 70 ? turns : 0))),
  );
  const mistakeTags = [...new Set(input.mistakeTags ?? [])].slice(0, 3);
  const xpAwarded = alreadyCompletedToday ? 0 : 15 + Math.round(score / 10);
  const event: CoachSessionEvent = {
    id: createId('coach'),
    scenarioId: input.scenarioId,
    completedAt: now.toISOString(),
    score,
    turns,
    independentTurns,
    mistakeTags: mistakeTags.length ? mistakeTags : undefined,
    xpAwarded,
  };
  return {
    event,
    xpAwarded,
    progress: {
      ...progress,
      coachEvents: [...progress.coachEvents, event],
      updatedAt: now.toISOString(),
    },
  };
}

export function coachSessionsOnDay(
  progress: CourseProgress,
  day = new Date(),
): CoachSessionEvent[] {
  const key = localDateKey(day);
  return progress.coachEvents.filter((event) => localDateKey(new Date(event.completedAt)) === key);
}

export function creditedCoachTurnsOnDay(progress: CourseProgress, day = new Date()): number {
  return coachSessionsOnDay(progress, day).reduce(
    (sum, session) => sum + (session.xpAwarded > 0 ? session.turns : 0),
    0,
  );
}

export function claimCourseReward(
  progress: CourseProgress,
  rewardId: string,
  now = new Date(),
): CourseProgress {
  if (progress.claimedRewards.includes(rewardId)) return progress;
  return {
    ...progress,
    claimedRewards: [...progress.claimedRewards, rewardId],
    updatedAt: now.toISOString(),
  };
}

export function courseActivityDates(progress: CourseProgress): string[] {
  const dates = new Set<string>();
  for (const event of progress.events) dates.add(localDateKey(new Date(event.answeredAt)));
  return [...dates];
}

export function courseXpOnDay(progress: CourseProgress, day = new Date()): number {
  const key = localDateKey(day);
  let xp = 0;
  for (const event of progress.events) {
    if (localDateKey(new Date(event.answeredAt)) === key) xp += event.xpAwarded;
  }
  return xp;
}

export function courseAnswersOnDay(progress: CourseProgress, day = new Date()): number {
  const key = localDateKey(day);
  const answers = new Set<string>();
  for (const event of progress.events) {
    if (event.correct && localDateKey(new Date(event.answeredAt)) === key) {
      answers.add(`${event.lessonId}:${event.questionId}`);
    }
  }
  return answers.size;
}
