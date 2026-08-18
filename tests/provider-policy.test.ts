import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTrustedProviderUrl } from '../src/lib/server/ai/provider-policy.ts';

const options = { allowedHosts: new Set(['trusted.example']), allowCustom: false };

test('provider endpoint přijme jen explicitní HTTPS /v1 host', () => {
  assert.deepEqual(parseTrustedProviderUrl('https://trusted.example/v1', options), {
    baseURL: 'https://trusted.example/v1',
    trust: 'documented-allowlist',
  });
  assert.equal(parseTrustedProviderUrl('http://trusted.example/v1', options), undefined);
  assert.equal(parseTrustedProviderUrl('https://evil.example/v1', options), undefined);
  assert.equal(parseTrustedProviderUrl(' https://trusted.example/v1', options), undefined);
});

test('provider endpoint odmítne credentials, query, fragment a nečekanou path', () => {
  for (const value of [
    'https://user:pass@trusted.example/v1',
    'https://trusted.example/v1?key=secret',
    'https://trusted.example/v1#fragment',
    'https://trusted.example/openai/v1',
  ]) {
    assert.equal(parseTrustedProviderUrl(value, options), undefined, value);
  }
});

test('custom endpoint vyžaduje samostatný explicitní trust flag', () => {
  assert.deepEqual(
    parseTrustedProviderUrl('https://self-hosted.example/v1', {
      allowedHosts: new Set(),
      allowCustom: true,
    }),
    { baseURL: 'https://self-hosted.example/v1', trust: 'explicit-custom' },
  );
});
