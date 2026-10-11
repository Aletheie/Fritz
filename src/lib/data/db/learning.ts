import { localizedError } from '../../domain/errors.ts';
import { normalizeDailySessionRecord } from '../../domain/learning/planner.ts';
import { applyEvidenceToSkillState, deriveSkillState } from '../../domain/learning/skills.ts';
import { abortTransaction, openDatabase, requestResult, transactionDone } from './connection.ts';
import { announceCommit, bumpRevision } from './sync.ts';

import type {
  DailySessionRecord,
  LearningEvidence,
  SkillState,
} from '../../domain/learning/types.ts';

export async function addEvidenceAndAdvanceSkills(
  transaction: IDBTransaction,
  evidence: LearningEvidence,
): Promise<boolean> {
  const evidenceStore = transaction.objectStore('learningEvidence');
  const existing = (await requestResult(evidenceStore.get(evidence.id))) as
    | LearningEvidence
    | undefined;
  if (existing) return false;
  evidenceStore.add(evidence);
  if (evidence.excludedFromLearning || evidence.mode === 'cram' || evidence.outcome === 'skipped') {
    return true;
  }
  const stateStore = transaction.objectStore('skillStates');
  const skillIds = [...new Set(evidence.skillIds)];
  const currentStates = await Promise.all(
    skillIds.map(
      async (skillId) => requestResult(stateStore.get(skillId)) as Promise<SkillState | undefined>,
    ),
  );
  for (const [index, skillId] of skillIds.entries()) {
    stateStore.put(applyEvidenceToSkillState(currentStates[index], evidence, skillId));
  }
  return true;
}

export async function replaceEvidenceAndRebuildSkills(
  transaction: IDBTransaction,
  evidence: LearningEvidence,
): Promise<void> {
  const evidenceStore = transaction.objectStore('learningEvidence');
  evidenceStore.put(evidence);
  const stateStore = transaction.objectStore('skillStates');
  const skillIds = [...new Set(evidence.skillIds)];
  const histories = await Promise.all(
    skillIds.map(
      async (skillId) =>
        requestResult(evidenceStore.index('skillIds').getAll(IDBKeyRange.only(skillId))) as Promise<
          LearningEvidence[]
        >,
    ),
  );
  for (const [index, skillId] of skillIds.entries()) {
    const state = deriveSkillState(histories[index], skillId);
    if (state) stateStore.put(state);
    else stateStore.delete(skillId);
  }
}

export function normalizeDailySessions(values: unknown[]): DailySessionRecord[] {
  const sessions: DailySessionRecord[] = [];
  for (const value of values) {
    const session = normalizeDailySessionRecord(value);
    if (session) sessions.push(session);
  }
  return sessions;
}

function latestDailySession(values: unknown[]): DailySessionRecord | undefined {
  let latest: DailySessionRecord | undefined;
  for (const value of values) {
    const session = normalizeDailySessionRecord(value);
    if (!session) continue;
    if (!latest || session.updatedAt.localeCompare(latest.updatedAt) > 0) latest = session;
  }
  return latest;
}

export async function getOrCreateDailySession(
  proposed: DailySessionRecord,
): Promise<DailySessionRecord> {
  const database = await openDatabase();
  const transaction = database.transaction(['dailySessions', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore('dailySessions');
  try {
    const rawExact = await requestResult(store.get(proposed.key));
    const exact = normalizeDailySessionRecord(rawExact);
    const sameDay = exact
      ? undefined
      : latestDailySession(
          (await requestResult(
            store.index('localDay').getAll(proposed.plan.localDay),
          )) as unknown[],
        );
    const existing = exact ?? sameDay;
    if (existing) {
      const needsMigration =
        (rawExact && (rawExact as { schemaVersion?: unknown }).schemaVersion !== 2) ||
        existing.plan.schemaVersion !== 2;
      if (needsMigration) {
        store.put(existing);
        const revision = await bumpRevision(transaction);
        await done;
        announceCommit(revision, ['dailySessions']);
        return existing;
      }
      await done;
      return existing;
    }
    if (rawExact) throw new Error('Uložená dnešní lekce má neplatný formát.');
    store.add(proposed);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(revision, ['dailySessions']);
    return proposed;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function mutateDailySession<T>(
  key: string,
  mutate: (session: DailySessionRecord) => {
    session: DailySessionRecord;
    evidence?: LearningEvidence;
    result: T;
  },
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ['dailySessions', 'learningEvidence', 'skillStates', 'meta'],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const store = transaction.objectStore('dailySessions');
  try {
    const current = normalizeDailySessionRecord(await requestResult(store.get(key)));
    if (!current)
      throw localizedError(
        'Dnešní lekce už není dostupná nebo má neplatný formát.',
        'Today’s lesson is no longer available or has an invalid format.',
      );
    const mutation = mutate(current);
    if (mutation.session.key !== key || mutation.session.plan.id !== current.plan.id) {
      throw new Error('Zápis dnešní lekce vrátil nekonzistentní identitu.');
    }
    store.put(mutation.session);
    if (mutation.evidence) await addEvidenceAndAdvanceSkills(transaction, mutation.evidence);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(
      revision,
      mutation.evidence ? ['dailySessions', 'learningEvidence', 'skillStates'] : ['dailySessions'],
    );
    return mutation.result;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}
