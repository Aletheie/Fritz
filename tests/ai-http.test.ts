import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertRateLimit,
  assertSameOrigin,
  readJsonRequest,
} from '../src/lib/server/ai/http.server.ts';

import type { RequestEvent } from '@sveltejs/kit';

function eventFor(request: Request, url = 'https://fritz.example/api/ai/key/'): RequestEvent {
  return {
    request,
    url: new URL(url),
    route: { id: '/api/ai/key' },
    getClientAddress: () => '192.0.2.1',
  } as RequestEvent;
}

function rateLimitEvent(
  path: string,
  routeId: RequestEvent['route']['id'],
  address = '192.0.2.10',
): RequestEvent {
  const url = `https://fritz.example${path}`;
  return {
    ...eventFor(new Request(url), url),
    route: { id: routeId },
    getClientAddress: () => address,
  };
}

test('encoded URLs share the rate limit of their matched route', () => {
  const route = '/api/auth/login';
  assertRateLimit(rateLimitEvent(route, route), 2);
  assertRateLimit(rateLimitEvent('/api/auth/%6cogin', route), 2);

  for (const path of [
    route,
    '/api/auth/l%6fgin',
    '/api/auth/lo%67in',
    '/api/auth/log%69n',
    '/api/auth/logi%6e',
  ]) {
    assert.throws(() => assertRateLimit(rateLimitEvent(path, route), 2), { status: 429 });
  }
  assert.doesNotThrow(() => assertRateLimit(rateLimitEvent(route, route, '192.0.2.11'), 2));
  assert.doesNotThrow(() =>
    assertRateLimit(rateLimitEvent('/api/ai/explain', '/api/ai/explain'), 2),
  );
});

test('a route gets a fresh request budget after its window expires', (context) => {
  let now = 1_000;
  context.mock.method(Date, 'now', () => now);
  const event = rateLimitEvent('/api/auth/login', '/api/auth/login', '192.0.2.12');
  assertRateLimit(event, 1, 100);
  now = 1_099;
  assert.throws(() => assertRateLimit(event, 1, 100), { status: 429 });
  now = 1_100;
  assert.doesNotThrow(() => assertRateLimit(event, 1, 100));
});

test('BYOK mutation rejects missing, cross-site and malformed Origin', () => {
  const missing = eventFor(new Request('https://fritz.example/api/ai/key/', { method: 'DELETE' }));
  assert.throws(() => assertSameOrigin(missing, true), /původ/u);

  const crossSite = eventFor(
    new Request('https://fritz.example/api/ai/key/', {
      method: 'DELETE',
      headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
    }),
  );
  assert.throws(() => assertSameOrigin(crossSite, true), /jiné domény/u);

  const same = eventFor(
    new Request('https://fritz.example/api/ai/key/', {
      method: 'DELETE',
      headers: { origin: 'https://fritz.example', 'sec-fetch-site': 'same-origin' },
    }),
  );
  assert.doesNotThrow(() => assertSameOrigin(same, true));
});

test('AI JSON reader rejects content type, declared size, actual size and malformed JSON', async () => {
  const wrongType = eventFor(
    new Request('https://fritz.example/api/ai/explain/', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: 'https://fritz.example' },
      body: '{}',
    }),
  );
  await assert.rejects(() => readJsonRequest(wrongType, 100), /JSON/u);

  const declared = eventFor(
    new Request('https://fritz.example/api/ai/explain/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '101',
        origin: 'https://fritz.example',
      },
      body: '{}',
    }),
  );
  await assert.rejects(() => readJsonRequest(declared, 100), /příliš velké/u);

  const actual = eventFor(
    new Request('https://fritz.example/api/ai/explain/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://fritz.example' },
      body: JSON.stringify({ value: 'x'.repeat(200) }),
    }),
  );
  await assert.rejects(() => readJsonRequest(actual, 100), /příliš velké/u);

  const malformed = eventFor(
    new Request('https://fritz.example/api/ai/explain/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://fritz.example' },
      body: '{',
    }),
  );
  await assert.rejects(() => readJsonRequest(malformed, 100), /neplatný JSON/u);
});

test('oversized streaming JSON is cancelled without consuming the rest of the body', async () => {
  let pulled = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new TextEncoder().encode('x'.repeat(64)));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request('https://fritz.example/api/ai/key/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://fritz.example' },
    body: stream,
    duplex: 'half',
  } as RequestInit);
  await assert.rejects(() => readJsonRequest(eventFor(request), 100), { status: 413 });
  assert.equal(cancelled, true);
  assert.ok(pulled <= 3);
});
