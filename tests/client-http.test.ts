import assert from 'node:assert/strict';
import test from 'node:test';

import { ConnectionError, jsonRequest } from '../src/lib/client/http.ts';

test('JSON requests preserve caller headers and pass through the body and abort signal', async (t) => {
  const controller = new AbortController();
  const body = JSON.stringify({ word: 'Zug' });
  const response = { translation: 'vlak' };
  const fetch = t.mock.method(globalThis, 'fetch', async (_path: unknown, init: RequestInit) => {
    const headers = new Headers(init.headers);
    assert.equal(headers.get('accept'), 'application/json');
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(headers.get('x-request-id'), 'test');
    assert.equal(init.method, 'POST');
    assert.equal(init.body, body);
    assert.equal(init.signal, controller.signal);
    assert.equal(init.cache, 'no-store');
    return Response.json(response);
  });

  assert.deepEqual(
    await jsonRequest('/api/test', {
      method: 'POST',
      body,
      signal: controller.signal,
      headers: new Headers({ 'x-request-id': 'test' }),
    }),
    response,
  );
  assert.equal(fetch.mock.calls.length, 1);
});

test('tuple headers can override the JSON defaults', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_path: unknown, init: RequestInit) => {
    const headers = new Headers(init.headers);
    assert.equal(headers.get('accept'), 'application/problem+json');
    assert.equal(headers.get('content-type'), 'text/plain');
    return Response.json({ ok: true });
  });
  await jsonRequest('/api/test', {
    method: 'POST',
    body: 'hello',
    headers: [
      ['accept', 'application/problem+json'],
      ['content-type', 'text/plain'],
    ],
  });
});

test('invalid JSON on a successful response is an error, not an empty result', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Proxy error</html>'));
  await assert.rejects(jsonRequest('/api/test'), (error: unknown) => {
    assert.ok(error instanceof Error && !(error instanceof ConnectionError));
    assert.match(error.message, /neplatnou odpověď/u);
    assert.ok(error.cause instanceof SyntaxError);
    return true;
  });
});

test('HTTP errors use the server message or fall back to the status for non-JSON bodies', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: 'Limit vyčerpán.' }, { status: 429 }),
  );
  await assert.rejects(jsonRequest('/api/test'), /Limit vyčerpán/u);

  fetch.mock.mockImplementation(async () => new Response('Bad Gateway', { status: 502 }));
  await assert.rejects(jsonRequest('/api/test'), /502/u);

  fetch.mock.mockImplementation(async () => Response.json(null, { status: 503 }));
  await assert.rejects(jsonRequest('/api/test'), /503/u);
});

test('network failures retain their cause and remain distinguishable from server errors', async (t) => {
  const cause = new TypeError('Failed to fetch');
  t.mock.method(globalThis, 'fetch', async () => {
    throw cause;
  });
  await assert.rejects(jsonRequest('/api/test'), (error: unknown) => {
    assert.ok(error instanceof ConnectionError);
    assert.equal(error.cause, cause);
    return true;
  });
});

test('cancelling a request preserves AbortError so callers can ignore it', async (t) => {
  const controller = new AbortController();
  const cause = new DOMException('Aborted', 'AbortError');
  t.mock.method(
    globalThis,
    'fetch',
    async (_path: unknown, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(cause), { once: true });
      }),
  );

  const pending = jsonRequest('/api/test', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error: unknown) => error === cause);
});
