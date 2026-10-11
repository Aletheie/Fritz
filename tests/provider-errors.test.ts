import assert from 'node:assert/strict';
import test from 'node:test';

import { aiErrorResponse } from '../src/lib/server/ai/http.server.ts';
import { classifyProviderError } from '../src/lib/server/ai/provider-errors.ts';

test('provider failures are classified by status, name and message', () => {
  const cases: Array<[unknown, string]> = [
    [Object.assign(new Error('invalid api key'), { status: 401 }), 'auth'],
    [Object.assign(new Error('invalid argument'), { status: 400 }), 'validation'],
    [new Error('content safety policy refusal'), 'safety'],
    [Object.assign(new Error('mismatch'), { name: 'NoObjectGeneratedError' }), 'schema'],
    [Object.assign(new Error('quota'), { status: 429 }), 'quota'],
    [Object.assign(new Error('provider unavailable'), { status: 503 }), 'provider-unavailable'],
    [new Error('fetch failed'), 'network'],
    [new DOMException('The operation was aborted.', 'AbortError'), 'abort'],
    [new DOMException('The operation was aborted due to timeout', 'TimeoutError'), 'timeout'],
    [new Error('mystery'), 'unknown'],
  ];
  for (const [error, expected] of cases) assert.equal(classifyProviderError(error), expected);
});

test('AI error responses never expose the provider message', async () => {
  const secret = 'provider-secret-in-error';
  const response = aiErrorResponse(new Error(secret));
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes(secret), false);
});
