import { updateCaseProgress } from '../domain/cases/engine.ts';
import type { CaseAction } from '../domain/cases/types.ts';
import { parseCaseProgressMap } from '../domain/cases/validation.ts';
import { normalizeCourseProgress } from '../domain/course/course-progress.ts';
import type { CourseProgress } from '../domain/types.ts';
import { mutateCourseProgress } from './db.ts';

export function saveCaseAction(action: CaseAction): Promise<CourseProgress> {
  return mutateCourseProgress((stored) => {
    const current = normalizeCourseProgress(stored);
    const before = current.cases?.[action.caseId];
    const progress = updateCaseProgress(before, action);
    if (progress === before) return { course: current, result: current };
    const course = {
      ...current,
      cases: parseCaseProgressMap({ ...current.cases, [action.caseId]: progress }),
      updatedAt: progress.updatedAt,
    };
    return { course, result: course };
  });
}
