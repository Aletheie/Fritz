import { normalizeCourseProgress } from '../domain/course/course-progress.ts';
import { updateRivalry } from '../domain/rival/engine.ts';
import type { RivalAction, RivalQuestion } from '../domain/rival/types.ts';
import { parseRivalry } from '../domain/rival/validation.ts';
import type { CourseProgress } from '../domain/types.ts';
import { mutateCourseProgress } from './db.ts';

export function saveRivalAction(
  action: RivalAction,
  pool: RivalQuestion[],
): Promise<CourseProgress> {
  return mutateCourseProgress((stored) => {
    const now = new Date();
    const current = normalizeCourseProgress(stored, now);
    const rivalry = parseRivalry(
      updateRivalry(current.rivalry ?? { history: [] }, action, pool, now),
    );
    const course = { ...current, rivalry, updatedAt: now.toISOString() };
    return { course, result: course };
  });
}
