import { localizedError } from '../../domain/errors.ts';
import { completeDailyActivity, insertRepairActivity } from '../../domain/learning/planner.ts';
import { getOrCreateDailySession, mutateDailySession } from '../db.ts';

import type { DailySessionRecord, LearningEvidence } from '../../domain/learning/types.ts';

export function loadOrCreateDailySession(
  proposed: DailySessionRecord,
): Promise<DailySessionRecord> {
  return getOrCreateDailySession(proposed);
}

export function saveDailyActivityResult(input: {
  sessionKey: string;
  activityId: string;
  evidence?: LearningEvidence;
  needsRepair?: boolean;
  now?: Date;
}): Promise<DailySessionRecord> {
  const now = input.now ?? new Date();
  return mutateDailySession(input.sessionKey, (stored) => {
    const activity = stored.plan.activities.find((candidate) => candidate.id === input.activityId);
    if (!activity)
      throw localizedError(
        'Tento krok už v dnešní lekci není dostupný.',
        'This step is no longer part of today’s lesson.',
      );
    if (stored.completedActivityIds.includes(activity.id)) {
      return { session: stored, result: stored };
    }
    if (input.evidence && input.evidence.activityId !== activity.id) {
      throw new Error('Důkaz učení neodpovídá dokončenému kroku.');
    }
    const repaired = input.needsRepair ? insertRepairActivity(stored, activity.id, now) : stored;
    const session = completeDailyActivity(repaired, activity.id, input.evidence?.id, now);
    return { session, evidence: input.evidence, result: session };
  });
}
