import type {
  StoryBookId,
  StoryBookProgress,
  StoryExerciseResult,
  StoryProgressMap,
} from './types.ts';

export const storyBookIds: StoryBookId[] = [
  'a1-maerchen',
  'a1-haewelmann',
  'a1-bremer',
  'a1-fabeln',
  'a1-haensel-gretel',
  'a2-maerchen',
  'a2-max-moritz',
  'a2-alice',
  'a2-mondfahrt',
  'a2-biene-maja',
  'b1-heidi',
  'b1-kleider',
  'b1-nils',
  'b1-immensee',
  'b1-tom-sawyer',
  'b2-schimmelreiter',
  'b2-sandmann',
  'b2-taugenichts',
  'b2-bahnwaerter',
  'b2-schatzinsel',
  'c1-verwandlung',
  'c1-urteil',
  'c1-krug',
  'c1-wahlverwandtschaften',
  'c1-dorian-gray',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : [];
}

function finiteInteger(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback;
}

export function createStoryBookProgress(
  bookId: StoryBookId,
  episodeId: string,
  now = new Date(),
): StoryBookProgress {
  const timestamp = now.toISOString();
  return {
    bookId,
    furthestPage: 0,
    lastPage: 0,
    currentEpisodeId: episodeId,
    completedEpisodeIds: [],
    completedCheckpointIds: [],
    exerciseAttempts: 0,
    correctExercises: 0,
    savedWords: 0,
    startedAt: timestamp,
    updatedAt: timestamp,
  };
}

export function normalizeStoryProgressMap(value: unknown): StoryProgressMap {
  if (!isRecord(value)) return {};
  const result: StoryProgressMap = {};
  for (const bookId of storyBookIds) {
    const raw = value[bookId];
    if (!isRecord(raw)) continue;
    const startedAt = typeof raw.startedAt === 'string' ? raw.startedAt : new Date(0).toISOString();
    result[bookId] = {
      bookId,
      furthestPage: finiteInteger(raw.furthestPage),
      lastPage: finiteInteger(raw.lastPage),
      currentEpisodeId:
        typeof raw.currentEpisodeId === 'string' ? raw.currentEpisodeId : `${bookId}-e01`,
      completedEpisodeIds: strings(raw.completedEpisodeIds),
      completedCheckpointIds: strings(raw.completedCheckpointIds),
      exerciseAttempts: finiteInteger(raw.exerciseAttempts),
      correctExercises: finiteInteger(raw.correctExercises),
      savedWords: finiteInteger(raw.savedWords),
      startedAt,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : startedAt,
    };
  }
  return result;
}

export function recordStoryPage(
  current: StoryBookProgress | undefined,
  input: {
    bookId: StoryBookId;
    episodeId: string;
    pageNumber: number;
    now?: Date;
  },
): StoryBookProgress {
  const now = input.now ?? new Date();
  const base = current ?? createStoryBookProgress(input.bookId, input.episodeId, now);
  const pageNumber = Math.max(1, Math.round(input.pageNumber));
  return {
    ...base,
    furthestPage: Math.max(base.furthestPage, pageNumber),
    lastPage: pageNumber,
    currentEpisodeId: input.episodeId,
    updatedAt: now.toISOString(),
  };
}

export function recordStoryExercise(
  current: StoryBookProgress | undefined,
  input: {
    bookId: StoryBookId;
    episodeId: string;
    checkpointId: string;
    result: StoryExerciseResult;
    now?: Date;
  },
): StoryBookProgress {
  const now = input.now ?? new Date();
  const base = current ?? createStoryBookProgress(input.bookId, input.episodeId, now);
  const completedCheckpointIds = input.result.completed
    ? [...new Set([...base.completedCheckpointIds, input.checkpointId])]
    : base.completedCheckpointIds;
  const objectivelyScored = input.result.correct !== undefined;
  return {
    ...base,
    currentEpisodeId: input.episodeId,
    completedCheckpointIds,
    exerciseAttempts: base.exerciseAttempts + (objectivelyScored ? 1 : 0),
    correctExercises: base.correctExercises + (input.result.correct ? 1 : 0),
    updatedAt: now.toISOString(),
  };
}

export function recordStoryEpisodeComplete(
  current: StoryBookProgress | undefined,
  input: { bookId: StoryBookId; episodeId: string; nextEpisodeId?: string; now?: Date },
): StoryBookProgress {
  const now = input.now ?? new Date();
  const base = current ?? createStoryBookProgress(input.bookId, input.episodeId, now);
  return {
    ...base,
    currentEpisodeId: input.nextEpisodeId ?? input.episodeId,
    completedEpisodeIds: [...new Set([...base.completedEpisodeIds, input.episodeId])],
    updatedAt: now.toISOString(),
  };
}

export function recordStorySavedWord(
  current: StoryBookProgress | undefined,
  input: { bookId: StoryBookId; episodeId: string; now?: Date },
): StoryBookProgress {
  const now = input.now ?? new Date();
  const base = current ?? createStoryBookProgress(input.bookId, input.episodeId, now);
  return {
    ...base,
    currentEpisodeId: input.episodeId,
    savedWords: base.savedWords + 1,
    updatedAt: now.toISOString(),
  };
}

export function storyBookPercent(
  progress: StoryBookProgress | undefined,
  screenCount: number,
): number {
  if (!progress || screenCount <= 0) return 0;
  return Math.min(100, Math.round((progress.furthestPage / screenCount) * 100));
}

export function storyEpisodeToResume<T extends { id: string }>(
  episodes: readonly T[],
  progress: Pick<StoryBookProgress, 'currentEpisodeId' | 'completedEpisodeIds'> | undefined,
): T {
  const first = episodes[0];
  if (!first) throw new Error('Kniha neobsahuje žádnou epizodu.');
  const current = episodes.find((episode) => episode.id === progress?.currentEpisodeId);
  if (current) return current;
  const completed = new Set(progress?.completedEpisodeIds ?? []);
  return episodes.find((episode) => !completed.has(episode.id)) ?? first;
}

export function storyAccuracy(progress: StoryBookProgress | undefined): number | undefined {
  if (!progress?.exerciseAttempts) return undefined;
  return Math.round((progress.correctExercises / progress.exerciseAttempts) * 100);
}
