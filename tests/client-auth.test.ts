import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { AuthConnectionError, getAuthSession } from '../src/lib/client/auth.ts';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('only a failed connection is eligible for offline authentication fallback', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(() => getAuthSession(), AuthConnectionError);
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 });
  await assert.rejects(
    () => getAuthSession(),
    (error: unknown) => error instanceof Error && !(error instanceof AuthConnectionError),
  );
});

test('leaving the login flow aborts the pending session request', async () => {
  let requestSignal: AbortSignal | null | undefined;
  globalThis.fetch = (_input, init) => {
    requestSignal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      requestSignal?.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      );
    });
  };
  const controller = new AbortController();
  const pending = getAuthSession(controller.signal);
  controller.abort();
  await assert.rejects(() => pending, AuthConnectionError);
  assert.equal(requestSignal?.aborted, true);
});
