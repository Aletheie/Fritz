import {
  saveStoryCheckpoint,
  saveStoryEpisode,
  saveStoryPage,
  saveStoryWord,
} from '../../data/repository.ts';
import { createId } from '../../domain/id.ts';
import { currentCourse, setCourse } from './core.ts';

import type { StoryBookId, StoryExerciseResult } from '../../domain/stories/types.ts';
import type { CourseProgress } from '../../domain/types.ts';

type StoryCommand<T> = (
  input: T & { progress: CourseProgress; operationId: string },
) => Promise<CourseProgress>;

/** Page and episode IDs are deterministic so a repeated save is idempotent. */
async function applyStoryCommand<T>(
  command: StoryCommand<T>,
  input: T,
  operationId: string,
): Promise<void> {
  setCourse(await command({ ...input, progress: currentCourse(), operationId }));
}

export function readStoryPage(input: {
  bookId: StoryBookId;
  episodeId: string;
  pageNumber: number;
  now?: Date;
}): Promise<void> {
  return applyStoryCommand(
    saveStoryPage,
    input,
    `story-page:${input.bookId}:${input.episodeId}:${input.pageNumber}`,
  );
}

export function answerStoryCheckpoint(input: {
  bookId: StoryBookId;
  episodeId: string;
  checkpointId: string;
  result: StoryExerciseResult;
  now?: Date;
}): Promise<void> {
  return applyStoryCommand(saveStoryCheckpoint, input, createId('story-checkpoint-operation'));
}

export function completeStoryEpisode(input: {
  bookId: StoryBookId;
  episodeId: string;
  nextEpisodeId?: string;
  now?: Date;
}): Promise<void> {
  return applyStoryCommand(
    saveStoryEpisode,
    input,
    `story-episode:${input.bookId}:${input.episodeId}`,
  );
}

export function countStorySavedWord(input: {
  bookId: StoryBookId;
  episodeId: string;
  now?: Date;
}): Promise<void> {
  return applyStoryCommand(saveStoryWord, input, createId('story-word-operation'));
}
