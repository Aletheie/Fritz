import type { CourseProgress } from '../../domain/types.ts';

export function markOperation(progress: CourseProgress, operationId: string): CourseProgress {
  const recent = progress.appliedOperations ?? [];
  if (recent.includes(operationId)) return progress;
  return { ...progress, appliedOperations: [...recent, operationId].slice(-2_000) };
}
