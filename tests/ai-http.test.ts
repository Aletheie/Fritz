import assert from 'node:assert/strict';
import test from 'node:test';

import { assertSameOrigin, readJsonRequest } from '../src/lib/server/ai/http.server.ts';

import type { RequestEvent } from '@sveltejs/kit';

function eventFor(request: Request, url = 'https://fritz.example/api/ai/key/'): RequestEvent {
  return {
    request,
    url: new URL(url),
    getClientAddress: () => '192.0.2.1',
  } as RequestEvent;
}

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
