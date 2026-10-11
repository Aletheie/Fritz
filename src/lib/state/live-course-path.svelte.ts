import { loadCoursePath } from './course-path.ts';

import type { CoursePathChapterView, CoursePathNode } from '../domain/course/path.ts';
import type { CourseProgress, DetailedCefrLevel, MotherTongue } from '../domain/types.ts';

/**
 * The course path for the current progress, level and language. Call `load` from an
 * effect: every change reloads it, and a slower earlier load can never win.
 * Chapter views are large, so they stay raw instead of deeply proxied.
 */
export class LiveCoursePath {
  chapters = $state.raw<CoursePathChapterView[]>([]);
  recommendation = $state.raw<CoursePathNode | undefined>(undefined);
  ready = $state(false);

  #request = 0;

  async load(
    progress: CourseProgress,
    minimumLevel: DetailedCefrLevel,
    language: MotherTongue,
  ): Promise<void> {
    const request = ++this.#request;
    const path = await loadCoursePath(progress, minimumLevel, language);
    if (request !== this.#request) return;
    this.chapters = path.chapters;
    this.recommendation = path.recommendation;
    this.ready = true;
  }
}
