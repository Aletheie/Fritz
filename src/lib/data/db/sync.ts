import type { StoreName } from './connection.ts';
import { requestResult } from './connection.ts';

export type DatabaseSyncEvent = {
  type: 'mutation-committed' | 'db-versionchange' | 'restore-started' | 'reset-started';
  revision?: number;
  stores?: StoreName[];
};

let syncChannel: BroadcastChannel | undefined;

export const syncListeners = new Set<(event: DatabaseSyncEvent) => void>();

function getSyncChannel(): BroadcastChannel | undefined {
  if (typeof window === 'undefined' || !('BroadcastChannel' in globalThis)) return undefined;
  if (!syncChannel) {
    syncChannel = new BroadcastChannel('fritz-sync-v1');
    syncChannel.addEventListener('message', (event: MessageEvent<DatabaseSyncEvent>) => {
      if (!event.data || typeof event.data.type !== 'string') return;
      for (const listener of syncListeners) listener(event.data);
    });
  }
  return syncChannel;
}

export function subscribeDatabaseSync(listener: (event: DatabaseSyncEvent) => void): () => void {
  syncListeners.add(listener);
  getSyncChannel();
  return () => syncListeners.delete(listener);
}

export function publishDatabaseSync(event: DatabaseSyncEvent): void {
  getSyncChannel()?.postMessage(event);
}

export async function bumpRevision(transaction: IDBTransaction): Promise<number> {
  const store = transaction.objectStore('meta');
  const current = (await requestResult(store.get('state'))) as
    | { key: 'state'; revision: number }
    | undefined;
  const revision = Math.max(0, current?.revision ?? 0) + 1;
  store.put({ key: 'state', revision, updatedAt: new Date().toISOString() });
  return revision;
}

export function announceCommit(revision: number, stores: StoreName[]): void {
  publishDatabaseSync({ type: 'mutation-committed', revision, stores });
}
