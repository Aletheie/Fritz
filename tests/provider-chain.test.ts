import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AiProviderChainError,
  classifyProviderError,
  runProviderChain,
} from '../src/lib/server/ai/provider-chain.ts';

function success(provider: 'google-gemini' | 'inkling-compatible', answer: string) {
  return {
    provider,
    run: async () => ({ output: { answer }, model: `${provider}-test` }),
  } as const;
}

test('primární AI provider se použije bez volání zálohy', async () => {
  let fallbackCalls = 0;
  const result = await runProviderChain(
    [
      success('google-gemini', 'primární'),
      {
        provider: 'inkling-compatible',
        run: async () => {
          fallbackCalls += 1;
          return { output: { answer: 'záloha' }, model: 'inkling-test' };
        },
      },
    ],
    { allowFallback: true },
  );

  assert.equal(result.output.answer, 'primární');
  assert.equal(result.provider, 'google-gemini');
  assert.equal(fallbackCalls, 0);
  assert.deepEqual(result.trace, [{ provider: 'google-gemini', status: 'success' }]);
});

test('transient chyba použije fallback pouze s explicitním souhlasem', async () => {
  const attempts = [
    {
      provider: 'google-gemini' as const,
      run: async () => {
        const error = new Error('provider unavailable') as Error & { status: number };
        error.status = 503;
        throw error;
      },
    },
    success('inkling-compatible', 'záloha'),
  ];

  const result = await runProviderChain(attempts, { allowFallback: true });
  assert.equal(result.provider, 'inkling-compatible');
  assert.equal(result.trace[0].errorClass, 'provider-unavailable');

  await assert.rejects(
    runProviderChain(attempts, { allowFallback: false }),
    (error: unknown) => error instanceof AiProviderChainError && error.trace.length === 1,
  );
});

test('auth, validation, safety a schema chyba se nikdy neposílají jinému providerovi', async () => {
  const cases = [
    Object.assign(new Error('invalid api key'), { status: 401 }),
    Object.assign(new Error('invalid argument'), { status: 400 }),
    new Error('content safety policy refusal'),
    Object.assign(new Error('structured output schema mismatch'), {
      name: 'NoObjectGeneratedError',
    }),
  ];
  await Promise.all(
    cases.map(async (failure) => {
      let fallbackCalls = 0;
      await assert.rejects(
        runProviderChain(
          [
            { provider: 'google-gemini', run: async () => Promise.reject(failure) },
            {
              provider: 'inkling-compatible',
              run: async () => {
                fallbackCalls += 1;
                return { output: { answer: 'wrong' }, model: 'fallback' };
              },
            },
          ],
          { allowFallback: true },
        ),
        AiProviderChainError,
      );
      assert.equal(fallbackCalls, 0);
    }),
  );
});

test('abort před prvním pokusem ani mezi providery nespustí fallback', async () => {
  const before = new AbortController();
  before.abort();
  let calls = 0;
  await assert.rejects(
    runProviderChain(
      [
        {
          provider: 'google-gemini',
          run: async () => {
            calls += 1;
            return { output: {}, model: 'never' };
          },
        },
      ],
      { allowFallback: true, signal: before.signal },
    ),
    (error: unknown) => error instanceof AiProviderChainError && error.errorClass === 'abort',
  );
  assert.equal(calls, 0);

  const between = new AbortController();
  let fallbackCalls = 0;
  await assert.rejects(
    runProviderChain(
      [
        {
          provider: 'google-gemini',
          run: async () => {
            between.abort();
            throw new Error('network failed');
          },
        },
        {
          provider: 'inkling-compatible',
          run: async () => {
            fallbackCalls += 1;
            return { output: {}, model: 'never' };
          },
        },
      ],
      { allowFallback: true, signal: between.signal },
    ),
    (error: unknown) => error instanceof AiProviderChainError && error.errorClass === 'abort',
  );
  assert.equal(fallbackCalls, 0);
});

test('classifier rozlišuje retry policy bez zveřejnění původní zprávy', async () => {
  assert.equal(classifyProviderError(Object.assign(new Error('quota'), { status: 429 })), 'quota');
  assert.equal(classifyProviderError(new Error('mystery')), 'unknown');
  const secret = 'provider-secret-in-error';
  await assert.rejects(
    runProviderChain(
      [{ provider: 'google-gemini', run: async () => Promise.reject(new Error(secret)) }],
      { allowFallback: false },
    ),
    (error: unknown) => {
      assert.ok(error instanceof AiProviderChainError);
      assert.equal(error.message.includes(secret), false);
      return true;
    },
  );
});

test('prázdný řetězec skončí bezpečnou chybou konfigurace', async () => {
  await assert.rejects(runProviderChain([], { allowFallback: false }), AiProviderChainError);
});
