import { get } from 'svelte/store';
import { loadOrCreateDailySession, saveDailyActivityResult } from '../../data/repository.ts';
import { localizedError } from '../../domain/errors.ts';
import { state, stateWithEvidence } from './core.ts';

import type { DailySessionRecord, LearningEvidence } from '../../domain/learning/types.ts';

export async function beginDailySession(proposed: DailySessionRecord): Promise<DailySessionRecord> {
  const dailySession = await loadOrCreateDailySession(proposed);
  state.update((value) => ({
    ...value,
    dailySession,
    dailySessions: value.dailySessions.some((candidate) => candidate.key === dailySession.key)
      ? value.dailySessions.map((candidate) =>
          candidate.key === dailySession.key ? dailySession : candidate,
        )
      : [...value.dailySessions, dailySession],
  }));
  return dailySession;
}

export async function completeDailySessionActivity(input: {
  activityId: string;
  evidence?: LearningEvidence;
  needsRepair?: boolean;
  now?: Date;
}): Promise<DailySessionRecord> {
  const current = get(state);
  if (!current.dailySession)
    throw localizedError('Dnešní lekce ještě není načtená.', 'Today’s lesson has not loaded yet.');
  const dailySession = await saveDailyActivityResult({
    ...input,
    sessionKey: current.dailySession.key,
  });
  state.update((value) => {
    const next = {
      ...value,
      dailySession,
      dailySessions: value.dailySessions.map((candidate) =>
        candidate.key === dailySession.key ? dailySession : candidate,
      ),
    };
    return input.evidence ? stateWithEvidence(next, input.evidence) : next;
  });
  return dailySession;
}
