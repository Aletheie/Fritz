import assert from 'node:assert/strict';
import test from 'node:test';

import { streamRequest } from '../src/lib/client/http.ts';

function mockFetch(response: Response): void {
  globalThis.fetch = async () => response;
}

function ndjson(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'application/x-ndjson' } },
  );
}

test('stream request reassembles split lines and resolves with the result event', async () => {
  mockFetch(
    ndjson([
      '{"type":"reply","text":"Hal',
      'lo"}\n{"type":"reply","text":"Hallo!"}\n',
      '{"type":"result","result":{"ok":true}}\n',
    ]),
  );
  const replies: unknown[] = [];
  const result = await streamRequest<{ ok: boolean }>('/x', {}, (event) =>
    replies.push(event.text),
  );
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(replies, ['Hallo', 'Hallo!']);
});

test('stream request surfaces error events and truncated streams', async () => {
  mockFetch(ndjson(['{"type":"reply","text":"a"}\n{"type":"error","error":"Limit."}\n']));
  await assert.rejects(
    streamRequest('/x', {}, () => {}),
    /Limit\./u,
  );
  mockFetch(ndjson(['{"type":"reply","text":"a"}\n']));
  await assert.rejects(
    streamRequest('/x', {}, () => {}),
    /předčasně/u,
  );
});

test('stream request falls back to plain JSON responses', async () => {
  mockFetch(Response.json({ reply: 'demo' }));
  assert.deepEqual(await streamRequest('/x', {}, () => {}), { reply: 'demo' });
  mockFetch(Response.json({ error: 'Neplatná data.' }, { status: 400 }));
  await assert.rejects(
    streamRequest('/x', {}, () => {}),
    /Neplatná data\./u,
  );
});
