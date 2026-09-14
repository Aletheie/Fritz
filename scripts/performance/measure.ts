import { performance } from 'node:perf_hooks';

export type Measurement = {
  name: string;
  samplesMs: number[];
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  budgetMs: number;
  heapDeltaMiB: number;
  passed: boolean;
  error?: string;
};

function rounded(value: number): number {
  return Number(value.toFixed(2));
}

export async function measure<T>(input: {
  name: string;
  run: (iteration: number) => T | Promise<T>;
  verify: (result: T) => void;
  budgetMs: number;
  samples?: number;
  warmups?: number;
}): Promise<Measurement> {
  const samplesMs: number[] = [];
  const heapBefore = process.memoryUsage().heapUsed;
  let error: string | undefined;
  try {
    const warmups = input.warmups ?? 1;
    for (let iteration = -warmups; iteration < (input.samples ?? 7); iteration += 1) {
      const start = performance.now();
      // oxlint-disable-next-line no-await-in-loop -- benchmarks must run in isolation.
      const result = await input.run(iteration);
      const elapsed = performance.now() - start;
      if (iteration >= 0) samplesMs.push(elapsed);
      // Correctness assertions and fixture generation do not contribute to timings.
      try {
        input.verify(result);
      } catch (cause) {
        error ??= cause instanceof Error ? cause.message : String(cause);
      }
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  const sorted = samplesMs.toSorted((left, right) => left - right);
  const percentile = (fraction: number) =>
    sorted.length ? sorted[Math.ceil(sorted.length * fraction) - 1] : 0;
  const p95Ms = percentile(0.95);
  return {
    name: input.name,
    samplesMs: samplesMs.map(rounded),
    p50Ms: rounded(percentile(0.5)),
    p95Ms: rounded(p95Ms),
    maxMs: rounded(sorted.at(-1) ?? 0),
    budgetMs: input.budgetMs,
    heapDeltaMiB: rounded((process.memoryUsage().heapUsed - heapBefore) / 1_048_576),
    passed: !error && samplesMs.length === (input.samples ?? 7) && p95Ms <= input.budgetMs,
    ...(error ? { error } : {}),
  };
}

// Track both object-store and index reads: an index can still scan every row.
// Restoring the prototypes in finally keeps instrumentation out of later phases.
export function instrumentDatabaseReads(): {
  reads: Array<{ store: string; index?: string; method: string; bounded: boolean }>;
  cursorSteps: () => number;
  restore: () => void;
} {
  const reads: Array<{ store: string; index?: string; method: string; bounded: boolean }> = [];
  const storeGetAll = IDBObjectStore.prototype.getAll;
  const indexGetAll = IDBIndex.prototype.getAll;
  const cursorContinue = IDBCursor.prototype.continue;
  let cursorSteps = 0;
  IDBObjectStore.prototype.getAll = function getAll(...args) {
    reads.push({
      store: this.name,
      method: 'getAll',
      bounded:
        (args[0] !== null && args[0] !== undefined) || (typeof args[1] === 'number' && args[1] > 0),
    });
    return storeGetAll.apply(this, args);
  };
  IDBIndex.prototype.getAll = function getAll(...args) {
    reads.push({
      store: this.objectStore.name,
      index: this.name,
      method: 'getAll',
      bounded:
        (args[0] !== null && args[0] !== undefined) || (typeof args[1] === 'number' && args[1] > 0),
    });
    return indexGetAll.apply(this, args);
  };
  IDBCursor.prototype.continue = function advance(...args) {
    cursorSteps += 1;
    return cursorContinue.apply(this, args);
  };
  return {
    reads,
    cursorSteps: () => cursorSteps,
    restore: () => {
      IDBObjectStore.prototype.getAll = storeGetAll;
      IDBIndex.prototype.getAll = indexGetAll;
      IDBCursor.prototype.continue = cursorContinue;
    },
  };
}
