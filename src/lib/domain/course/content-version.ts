import type { CoursePathNodeProgress } from '../types.ts';
import {
  diversityChapterIdsByPreviousChapter,
  expandedCourseChapterIdsBySource,
} from './course-chapter-ids.ts';

/** Additive catalog version; intentionally independent of the IndexedDB schema. */
export const COURSE_CONTENT_VERSION = 4;

export const LEGACY_COURSE_CHAPTER_IDS = [
  'chapter-01-school',
  'chapter-02-day',
  'chapter-03-travel',
  'chapter-04-plans',
  'chapter-05-home-work',
  'chapter-06-process',
  'chapter-07-project',
  'chapter-08-negotiation',
  'chapter-09-argument',
  'chapter-10-style',
] as const;

/** The content-v2 order is retained as the migration anchor for existing learners. */
export const VERSION_TWO_COURSE_CHAPTER_IDS = [
  'chapter-01-school',
  'chapter-11-classroom',
  'chapter-12-cafe-bakery',
  'chapter-02-day',
  'chapter-13-home-family',
  'chapter-14-city',
  'chapter-03-travel',
  'chapter-15-hotel',
  'chapter-16-health',
  'chapter-04-plans',
  'chapter-17-shopping-returns',
  'chapter-18-housing-neighbors',
  'chapter-19-study-goals',
  'chapter-20-work-experience',
  'chapter-05-home-work',
  'chapter-21-narrative-news',
  'chapter-06-process',
  'chapter-22-opinion-compromise',
  'chapter-07-project',
  'chapter-23-feedback-conflict',
  'chapter-24-remote-work',
  'chapter-08-negotiation',
  'chapter-25-complaint-remedy',
  'chapter-26-data-consequences',
  'chapter-27-expert-discussion',
  'chapter-28-media-indirect-speech',
  'chapter-09-argument',
  'chapter-10-style',
  'chapter-29-mediation',
  'chapter-30-policy-brief',
] as const;

/** The content-v3 order retained as the migration anchor for existing learners. */
export const VERSION_THREE_COURSE_CHAPTER_IDS = VERSION_TWO_COURSE_CHAPTER_IDS.flatMap(
  (chapterId) => [chapterId, ...(expandedCourseChapterIdsBySource[chapterId] ?? [])],
);

/** The 120-chapter core order. Every detailed level closes with two fresh topic chapters. */
export const CORE_COURSE_CHAPTER_IDS = VERSION_THREE_COURSE_CHAPTER_IDS.flatMap((chapterId) => [
  chapterId,
  ...(diversityChapterIdsByPreviousChapter[chapterId] ?? []),
]);

export const ADDITIVE_COURSE_CHAPTER_IDS = CORE_COURSE_CHAPTER_IDS.filter(
  (id) => !(LEGACY_COURSE_CHAPTER_IDS as readonly string[]).includes(id),
);

const coreIndex = new Map(CORE_COURSE_CHAPTER_IDS.map((id, index) => [id, index]));

function chapterIdFromNodeId(nodeId: string): string {
  const separator = nodeId.indexOf(':');
  return separator < 0 ? nodeId : nodeId.slice(0, separator);
}

/**
 * Preserves a learner's position across additive course-map releases. Content-v1
 * progress uses the ten legacy anchors; content-v2 progress uses all thirty v2
 * chapters; content-v3 progress uses all one hundred v3 chapters. Inserted
 * chapters are marked as satisfied without synthetic nodes, vocabulary, reviews,
 * stars, or XP.
 */
export function grandfatheredChaptersForLegacyProgress(
  pathNodes: Record<string, CoursePathNodeProgress>,
  previousContentVersion = 1,
): string[] {
  const anchorIds =
    previousContentVersion >= 3
      ? (VERSION_THREE_COURSE_CHAPTER_IDS as readonly string[])
      : previousContentVersion >= 2
        ? (VERSION_TWO_COURSE_CHAPTER_IDS as readonly string[])
        : (LEGACY_COURSE_CHAPTER_IDS as readonly string[]);
  const anchorIndex = new Map(anchorIds.map((id, index) => [id, index]));
  let exclusiveThreshold = 0;

  for (const [nodeId, progress] of Object.entries(pathNodes)) {
    if (!progress?.startedAt && !progress?.completedAt) continue;
    const chapterId = chapterIdFromNodeId(nodeId);
    if (!anchorIndex.has(chapterId)) continue;
    const position = coreIndex.get(chapterId);
    if (position === undefined) continue;

    exclusiveThreshold = Math.max(exclusiveThreshold, position);
    if (nodeId.endsWith(':checkpoint') && progress.completedAt) {
      const anchorPosition = anchorIndex.get(chapterId);
      const nextAnchorId = anchorPosition === undefined ? undefined : anchorIds[anchorPosition + 1];
      const nextAnchorPosition = nextAnchorId ? coreIndex.get(nextAnchorId) : undefined;
      exclusiveThreshold = Math.max(
        exclusiveThreshold,
        nextAnchorPosition ?? CORE_COURSE_CHAPTER_IDS.length,
      );
    }
  }

  return ADDITIVE_COURSE_CHAPTER_IDS.filter((id) => {
    const position = coreIndex.get(id);
    return position !== undefined && position < exclusiveThreshold;
  });
}

export function normalizeGrandfatheredChapterIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(ADDITIVE_COURSE_CHAPTER_IDS);
  return [
    ...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.has(id))),
  ];
}
