import { normalizeCourseProgress } from '../../domain/course/course-progress.ts';
import { storyBookIsUnlocked } from '../../domain/course/story-unlocks.ts';
import { localizedError } from '../../domain/errors.ts';
import {
  recordStoryEpisodeComplete,
  recordStoryExercise,
  recordStoryPage,
  recordStorySavedWord,
} from '../../domain/stories/progress.ts';
import { mutateCourseProgress } from '../db.ts';
import { markOperation } from './operations.ts';

import type {
  StoryBookId,
  StoryBookProgress,
  StoryExerciseResult,
} from '../../domain/stories/types.ts';
import type { CourseProgress } from '../../domain/types.ts';

function saveStoryMutation(input: {
  progress: CourseProgress;
  bookId: StoryBookId;
  operationId: string;
  now?: Date;
  mutate: (current: StoryBookProgress | undefined) => StoryBookProgress;
}): Promise<CourseProgress> {
  return mutateCourseProgress((stored) => {
    const current = normalizeCourseProgress(stored ?? input.progress, input.now);
    if (!storyBookIsUnlocked(current, input.bookId)) {
      throw localizedError(
        'Tato četba je zatím zamčená. Dokonči příslušný checkpoint cesty.',
        'This reading is still locked. Finish the matching path checkpoint first.',
      );
    }
    if ((current.appliedOperations ?? []).includes(input.operationId)) {
      return { course: current, result: current };
    }
    const nextBookProgress = input.mutate(current.storyBooks[input.bookId]);
    const course = markOperation(
      {
        ...current,
        storyBooks: { ...current.storyBooks, [input.bookId]: nextBookProgress },
        updatedAt: nextBookProgress.updatedAt,
      },
      input.operationId,
    );
    return { course, result: course };
  });
}

export function saveStoryPage(input: {
  progress: CourseProgress;
  operationId: string;
  bookId: StoryBookId;
  episodeId: string;
  pageNumber: number;
  now?: Date;
}): Promise<CourseProgress> {
  return saveStoryMutation({
    ...input,
    mutate: (current) => recordStoryPage(current, input),
  });
}

export function saveStoryCheckpoint(input: {
  progress: CourseProgress;
  operationId: string;
  bookId: StoryBookId;
  episodeId: string;
  checkpointId: string;
  result: StoryExerciseResult;
  now?: Date;
}): Promise<CourseProgress> {
  return saveStoryMutation({
    ...input,
    mutate: (current) => recordStoryExercise(current, input),
  });
}

export function saveStoryEpisode(input: {
  progress: CourseProgress;
  operationId: string;
  bookId: StoryBookId;
  episodeId: string;
  nextEpisodeId?: string;
  now?: Date;
}): Promise<CourseProgress> {
  return saveStoryMutation({
    ...input,
    mutate: (current) => recordStoryEpisodeComplete(current, input),
  });
}

export function saveStoryWord(input: {
  progress: CourseProgress;
  operationId: string;
  bookId: StoryBookId;
  episodeId: string;
  now?: Date;
}): Promise<CourseProgress> {
  return saveStoryMutation({
    ...input,
    mutate: (current) => recordStorySavedWord(current, input),
  });
}
