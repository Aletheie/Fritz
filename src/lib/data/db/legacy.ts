import {
  DB_NAME,
  LEGACY_DB_NAME,
  ensureIndexedDb,
  requestResult,
  transactionDone,
} from './connection.ts';

type LegacyIndexSnapshot = {
  name: string;
  keyPath: string | string[];
  multiEntry: boolean;
  unique: boolean;
};

type LegacyStoreSnapshot = {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: LegacyIndexSnapshot[];
  records: Array<{ key: IDBValidKey; value: unknown }>;
};

type LegacyDatabaseSnapshot = {
  version: number;
  stores: LegacyStoreSnapshot[];
};

async function readLegacyDatabase(): Promise<LegacyDatabaseSnapshot> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = ensureIndexedDb().open(LEGACY_DB_NAME);
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('Původní lokální databázi se nepodařilo otevřít.')),
      { once: true },
    );
  });

  try {
    const storeNames = [...database.objectStoreNames];
    if (storeNames.length === 0) return { version: database.version, stores: [] };
    const transaction = database.transaction(storeNames, 'readonly');
    const done = transactionDone(transaction);
    const stores = await Promise.all(
      storeNames.map(async (name): Promise<LegacyStoreSnapshot> => {
        const store = transaction.objectStore(name);
        const indexes = [...store.indexNames].map((indexName): LegacyIndexSnapshot => {
          const index = store.index(indexName);
          return {
            name: index.name,
            keyPath: index.keyPath,
            multiEntry: index.multiEntry,
            unique: index.unique,
          };
        });
        const [values, keys] = await Promise.all([
          requestResult(store.getAll()),
          requestResult(store.getAllKeys()),
        ]);
        return {
          name,
          keyPath: store.keyPath,
          autoIncrement: store.autoIncrement,
          indexes,
          records: values.map((value, index) => ({ key: keys[index] as IDBValidKey, value })),
        };
      }),
    );
    await done;
    return { version: database.version, stores };
  } finally {
    database.close();
  }
}

function cloneLegacyDatabase(snapshot: LegacyDatabaseSnapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = ensureIndexedDb().open(DB_NAME, snapshot.version);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      for (const source of snapshot.stores) {
        const store = database.createObjectStore(source.name, {
          keyPath: source.keyPath,
          autoIncrement: source.autoIncrement,
        });
        for (const index of source.indexes) {
          store.createIndex(index.name, index.keyPath, {
            multiEntry: index.multiEntry,
            unique: index.unique,
          });
        }
        for (const record of source.records) {
          if (source.keyPath === null) store.put(record.value, record.key);
          else store.put(record.value);
        }
      }
    });
    request.addEventListener(
      'success',
      () => {
        request.result.close();
        resolve();
      },
      { once: true },
    );
    request.addEventListener(
      'error',
      () =>
        reject(request.error ?? new Error('Původní data se nepodařilo převést do aplikace Fritz.')),
      { once: true },
    );
    request.addEventListener(
      'blocked',
      () => reject(new Error('Převod dat blokuje jiná otevřená karta aplikace.')),
      { once: true },
    );
  });
}

export async function migrateLegacyDatabaseIfNeeded(): Promise<void> {
  const factory = ensureIndexedDb();
  if (typeof factory.databases !== 'function') return;
  const databaseNames = new Set(
    (await factory.databases())
      .map((database) => database.name)
      .filter((name): name is string => typeof name === 'string'),
  );
  if (databaseNames.has(DB_NAME) || !databaseNames.has(LEGACY_DB_NAME)) return;
  await cloneLegacyDatabase(await readLegacyDatabase());
}
