import assert from 'node:assert/strict';
import test from 'node:test';

import { aiFeaturePolicy } from '../src/lib/domain/ai/policy.ts';
import {
  AiBudgetExceededError,
  assertProviderCircuit,
  MemoryAiBudgetStore,
  recordProviderFailure,
  recordProviderSuccess,
} from '../src/lib/server/ai/budget.server.ts';

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    principal: 'anonymous:test',
    feature: 'explain' as const,
    provider: 'google-gemini' as const,
    estimatedInputBytes: 100,
    maxOutputTokens: 100,
    policy: { ...aiFeaturePolicy('explain'), dailyRequests: 2, concurrency: 1 },
    ...overrides,
  };
}

test('budget atomically limits concurrency and releases a finished lease', async () => {
  const store = new MemoryAiBudgetStore();
  const first = await store.reserve(reservation());
  await assert.rejects(() => store.reserve(reservation()), AiBudgetExceededError);

  await store.commit(first, { outputTokens: 40 });
  const second = await store.reserve(reservation());
  await store.release(second, 'test');
});

test('budget enforces daily request/input/output caps per principal and feature', async () => {
  const store = new MemoryAiBudgetStore();
  const limited = reservation({
    policy: {
      ...aiFeaturePolicy('explain'),
      dailyRequests: 1,
      dailyInputBytes: 150,
      dailyOutputTokens: 150,
      concurrency: 2,
    },
  });
  const lease = await store.reserve(limited);
  await store.commit(lease, { outputTokens: 50 });
  await assert.rejects(() => store.reserve(limited), AiBudgetExceededError);
});

test('provider circuit počítá jen přechodné chyby, ne auth ani schema selhání', () => {
  for (let index = 0; index < 5; index += 1) {
    recordProviderFailure('google-gemini', 'auth', 0);
    recordProviderFailure('google-gemini', 'schema', 0);
  }
  assert.doesNotThrow(() => assertProviderCircuit('google-gemini', 1));

  for (let index = 0; index < 5; index += 1) {
    recordProviderFailure('inkling-compatible', 'provider-unavailable', 0);
  }
  assert.throws(() => assertProviderCircuit('inkling-compatible', 1), AiBudgetExceededError);
  recordProviderSuccess('inkling-compatible');
});
