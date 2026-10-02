import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import {
  parseAiConnection,
  parseUserProviderUrl,
  isPublicProviderAddress,
  userConnectionsAllowed,
} from '../src/lib/server/ai/connection-policy.ts';
import {
  encryptStoredApiKey,
  decryptStoredApiKey,
} from '../src/lib/server/ai/key-crypto.server.ts';
import {
  createProviderFetch,
  resolveProviderAddress,
} from '../src/lib/server/ai/provider-fetch.server.ts';
import { configuredProviderModel } from '../src/lib/server/ai/provider-model.server.ts';

const schema = z.object({ status: z.literal('ok') });
const baseConfig = {
  provider: 'openai-compatible',
  apiKey: 'test-only-key',
  model: 'account/model:free',
  baseURL: 'https://provider.example/api/v1',
  outputMode: 'json',
};

test('all documented disabled user connection flags turn off BYOK', () => {
  for (const value of ['off', 'false', '0', ' FALSE '])
    assert.equal(userConnectionsAllowed(value), false);
  for (const value of [undefined, '', 'on', 'true'])
    assert.equal(userConnectionsAllowed(value), true);
});

test('user connections validate model, credentials, endpoint, output mode and keyless local access', () => {
  assert.deepEqual(parseAiConnection(baseConfig, false), baseConfig);
  assert.equal(parseAiConnection({ ...baseConfig, apiKey: '' }, false), undefined);
  assert.equal(
    parseAiConnection({ ...baseConfig, apiKey: 'key\r\nx-extra: secret' }, false),
    undefined,
  );
  assert.equal(
    parseAiConnection({ ...baseConfig, model: '../../model with spaces' }, false),
    undefined,
  );
  assert.equal(parseAiConnection({ ...baseConfig, outputMode: 'unknown' }, false), undefined);
  assert.equal(
    parseAiConnection({ ...baseConfig, baseURL: 'http://localhost:11434/v1', apiKey: '' }, false),
    undefined,
  );
  assert.equal(
    parseAiConnection({ ...baseConfig, baseURL: 'http://localhost:11434/v1', apiKey: '' }, true)
      ?.apiKey,
    '',
  );
  for (const provider of ['google-gemini', 'anthropic']) {
    const config = parseAiConnection(
      { ...baseConfig, provider, baseURL: 'https://attacker.example' },
      false,
    );
    assert.equal(config?.baseURL, undefined, 'native provider keys never follow a custom endpoint');
  }
});

test('custom endpoints permit API path prefixes but reject unsafe URL components and private targets', () => {
  assert.equal(
    parseUserProviderUrl('https://router.example/api/v1/', false),
    'https://router.example/api/v1',
  );
  for (const value of [
    'http://remote.example/v1',
    'https://key@remote.example/v1',
    'https://remote.example/v1?key=secret',
    'https://remote.example/v1#hash',
    'https://127.0.0.1/v1',
    'https://10.0.0.1/v1',
    'https://169.254.169.254/v1',
    'https://[::ffff:127.0.0.1]/v1',
    'https://[fd00::1]/v1',
    'https://service.internal/v1',
    'https://2130706433/v1',
    'https://0x7f000001/v1',
  ])
    assert.equal(parseUserProviderUrl(value, false), undefined, value);
  for (const ip of [
    '0.0.0.0',
    '192.168.1.1',
    '100.64.1.1',
    '172.31.1.1',
    '::1',
    'fe80::1',
    '::ffff:8.8.8.8',
    '2002:0808:0808::1',
    '2001:db8::1',
    '2001::1',
    '2001:0000:1234::1',
    '3fff::1',
  ]) {
    assert.equal(isPublicProviderAddress(ip), false, ip);
  }
  assert.equal(isPublicProviderAddress('8.8.8.8'), true);
  assert.equal(isPublicProviderAddress('2606:4700:4700::1111'), true);
});

test('DNS answers cannot point remote endpoints into private networks, including mixed records', async () => {
  await assert.rejects(
    () =>
      resolveProviderAddress(
        'provider.example',
        false,
        async () =>
          [
            { address: '8.8.8.8', family: 4 },
            { address: '127.0.0.1', family: 4 },
          ] as never,
      ),
    /veřejnou IP/u,
  );
  assert.deepEqual(await resolveProviderAddress('localhost', true), {
    address: '127.0.0.1',
    family: 4,
  });
  await assert.rejects(() => resolveProviderAddress('127.0.0.1', false), /veřejnou IP/u);
});

for (const outputMode of ['schema', 'json', 'text'] as const) {
  test(`compatible adapter uses the selected model and ${outputMode} mode with real schema validation`, async () => {
    let captured: Record<string, unknown> = {};
    const mockedFetch: typeof fetch = async (url, init) => {
      assert.equal(String(url), 'https://provider.example/api/v1/chat/completions');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-only-key');
      captured = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        id: 'test',
        object: 'chat.completion',
        created: 1,
        model: 'account/model:free',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '{"status":"ok"}' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });
    };
    const result = await generateText({
      model: configuredProviderModel(
        { id: 'openai-compatible', ...baseConfig, outputMode },
        mockedFetch,
      ),
      prompt: 'Connection test',
      output: Output.object({ schema }),
      maxOutputTokens: 256,
      maxRetries: 0,
    });
    assert.deepEqual(result.output, { status: 'ok' });
    assert.equal(captured.model, baseConfig.model);
    assert.equal(captured.temperature, undefined);
    if (outputMode === 'schema')
      assert.equal((captured.response_format as { type: string }).type, 'json_schema');
    else {
      assert.match(JSON.stringify(captured.messages), /JSON Schema/u);
      assert.match(JSON.stringify(captured.messages), /status/u);
      assert.deepEqual(
        captured.response_format,
        outputMode === 'json' ? { type: 'json_object' } : undefined,
      );
    }
  });
}

test('OpenAI-compatible replies that violate the requested schema are rejected', async () => {
  await assert.rejects(
    () =>
      generateText({
        model: configuredProviderModel(
          {
            id: 'openai-compatible',
            apiKey: 'test',
            model: 'chosen-model',
            baseURL: 'https://api.openai.com/v1',
          },
          async (_url, init) => {
            const body = JSON.parse(String(init?.body));
            assert.equal(body.max_completion_tokens, 256);
            assert.equal(body.max_tokens, undefined);
            return Response.json({
              choices: [
                {
                  index: 0,
                  message: { role: 'assistant', content: '{"status":"wrong"}' },
                  finish_reason: 'stop',
                },
              ],
            });
          },
        ),
        prompt: 'test',
        output: Output.object({ schema }),
        maxOutputTokens: 256,
        maxRetries: 0,
      }),
    /output|schema|validation/iu,
  );
});

test('Gemini adapter sends only the selected key and configured model', async () => {
  const result = await generateText({
    model: configuredProviderModel(
      { id: 'google-gemini', apiKey: 'test-google-key', model: 'chosen-google-model' },
      async (url, init) => {
        assert.match(String(url), /models\/chosen-google-model:generateContent/u);
        assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'test-google-key');
        return Response.json({
          candidates: [
            {
              content: { role: 'model', parts: [{ text: '{"status":"ok"}' }] },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
        });
      },
    ),
    prompt: 'test',
    output: Output.object({ schema }),
    maxOutputTokens: 256,
    maxRetries: 0,
  });
  assert.deepEqual(result.output, { status: 'ok' });
});

test('Anthropic adapter uses its native auth and selected model', async () => {
  const result = await generateText({
    model: configuredProviderModel(
      { id: 'anthropic', apiKey: 'test-anthropic-key', model: 'claude-haiku-4-5' },
      async (url, init) => {
        assert.equal(String(url), 'https://api.anthropic.com/v1/messages');
        assert.equal(new Headers(init?.headers).get('x-api-key'), 'test-anthropic-key');
        assert.equal(JSON.parse(String(init?.body)).model, 'claude-haiku-4-5');
        return Response.json({
          id: 'test',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5',
          content: [{ type: 'text', text: '{"status":"ok"}' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      },
    ),
    prompt: 'test',
    output: Output.object({ schema }),
    maxOutputTokens: 256,
    maxRetries: 0,
  });
  assert.deepEqual(result.output, { status: 'ok' });
});

test('encrypted connection envelope fits complete config and rejects oversized data', () => {
  const secret = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
  const value = JSON.stringify({
    accountId: 'test-account',
    connection: {
      ...baseConfig,
      apiKey: 'k'.repeat(512),
      baseURL: `https://provider.example/${'x'.repeat(400)}`,
    },
  });
  const encrypted = encryptStoredApiKey(value, secret);
  assert.ok(encrypted.length < 4096);
  assert.equal(encrypted.includes('test-account'), false);
  assert.equal(decryptStoredApiKey(encrypted, secret), value);
  assert.throws(() => encryptStoredApiKey('x'.repeat(2501), secret), /large/u);
});

test('pinned provider transport enforces redirect, timeout and response size limits on a mocked endpoint', async () => {
  const server = createServer((request, response) => {
    if (request.url === '/v1/no-content') {
      response.writeHead(205).end('unexpected content');
      return;
    }
    if (request.url === '/v1/redirect') {
      response.writeHead(302, { location: 'http://169.254.169.254/' }).end();
      return;
    }
    if (request.url === '/v1/large') {
      response.end('x'.repeat(1_048_577));
      return;
    }
    if (request.url === '/v1/wait') return;
    response.setHeader('content-type', 'application/json');
    response.end('{"status":"ok"}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  const fetchProvider = createProviderFetch(url, true);
  try {
    assert.deepEqual(
      await (await fetchProvider(`${url}/ok`, { method: 'POST', body: '{}' })).json(),
      { status: 'ok' },
    );
    const empty = await fetchProvider(`${url}/no-content`, { method: 'POST', body: '{}' });
    assert.equal(empty.status, 205);
    assert.equal(await empty.text(), '');
    await assert.rejects(
      () => fetchProvider(`${url}/redirect`, { method: 'POST', body: '{}' }),
      /přesměrovávat/u,
    );
    await assert.rejects(
      () => fetchProvider(`${url}/large`, { method: 'POST', body: '{}' }),
      /size limit/u,
    );
    await assert.rejects(
      () =>
        fetchProvider(`${url}/wait`, {
          method: 'POST',
          body: '{}',
          signal: AbortSignal.timeout(30),
        }),
      /timeout|abort/iu,
    );
    await assert.rejects(
      () => fetchProvider('https://other.example/v1/chat/completions', { body: '{}' }),
      /cíl/u,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
