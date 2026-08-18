import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decryptStoredApiKey,
  encryptStoredApiKey,
  keyIdForSecret,
} from '../src/lib/server/ai/key-crypto.server.ts';
import {
  isUsableEncryptionSecret,
  parseEncryptionMasterKey,
} from '../src/lib/server/ai/key-policy.ts';

const secret = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const otherSecret = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
const now = new Date('2026-08-07T12:00:00.000Z');
const apiKey = 'AIza-test-key-that-is-long-enough-for-a-real-form';

test('BYOK cookie používá versioned v3 envelope, HKDF key a vnitřní expiraci', () => {
  const encrypted = encryptStoredApiKey(apiKey, secret, { now });
  const parts = encrypted.split('.');

  assert.equal(parts.length, 7);
  assert.equal(parts[0], 'v3');
  assert.equal(parts[1], keyIdForSecret(secret));
  assert.equal(encrypted.includes(apiKey), false);
  assert.equal(decryptStoredApiKey(encrypted, secret, now), apiKey);
  assert.equal(
    decryptStoredApiKey(encrypted, secret, new Date('2026-09-07T12:00:01.000Z')),
    undefined,
  );
});

test('stejný klíč má díky náhodnému 12B IV pokaždé jiný ciphertext', () => {
  assert.notEqual(
    encryptStoredApiKey(apiKey, secret, { now }),
    encryptStoredApiKey(apiKey, secret, { now }),
  );
});

test('tamper každé autentizované části, wrong key a neznámý kid selžou genericky', () => {
  const encrypted = encryptStoredApiKey(apiKey, secret, { now });
  assert.equal(decryptStoredApiKey(encrypted, otherSecret, now), undefined);

  for (const index of [1, 2, 3, 4, 5, 6]) {
    const parts = encrypted.split('.');
    const value = parts[index];
    parts[index] = `${value.slice(0, -1)}${value.at(-1) === 'A' ? 'B' : 'A'}`;
    assert.equal(decryptStoredApiKey(parts.join('.'), secret, now), undefined, `část ${index}`);
  }

  const keyring = { [keyIdForSecret(otherSecret)]: otherSecret };
  assert.equal(decryptStoredApiKey(encrypted, keyring, now), undefined);
});

test('nekanonický base64url zápis se odmítne, i když dekóduje na stejné bajty', () => {
  const parts = encryptStoredApiKey(apiKey, secret, { now }).split('.');
  const canonical = parts[6];
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const equivalent = [...alphabet]
    .map((last) => `${canonical.slice(0, -1)}${last}`)
    .find(
      (candidate) =>
        candidate !== canonical &&
        Buffer.from(candidate, 'base64url').equals(Buffer.from(canonical, 'base64url')),
    );

  assert.ok(equivalent, 'fixture musí mít nekanonickou reprezentaci se stejnými bajty');
  parts[6] = equivalent;
  assert.equal(decryptStoredApiKey(parts.join('.'), secret, now), undefined);
});

test('future-issued, truncated, oversized, unknown a legacy cookies jsou odmítnuty', () => {
  const future = encryptStoredApiKey(apiKey, secret, {
    now: new Date('2026-08-08T12:00:00.000Z'),
  });
  assert.equal(decryptStoredApiKey(future, secret, now), undefined);
  assert.equal(decryptStoredApiKey('v3.only-two-parts', secret, now), undefined);
  assert.equal(decryptStoredApiKey(`v3.${'x'.repeat(5_000)}`, secret, now), undefined);
  assert.equal(decryptStoredApiKey('v9.abc.def.ghi', secret, now), undefined);
  assert.equal(decryptStoredApiKey('v2.abc.def.ghi', secret, now), undefined);
  assert.equal(decryptStoredApiKey('v1.abc.def.ghi', secret, now), undefined);
});

test('master key policy přijme jen přesně 32 B v base64url nebo hex', () => {
  const base64url = Buffer.alloc(32, 7).toString('base64url');
  assert.equal(isUsableEncryptionSecret(secret), true);
  assert.equal(isUsableEncryptionSecret(base64url), true);
  assert.equal(parseEncryptionMasterKey(secret)?.bytes.length, 32);
  assert.equal(isUsableEncryptionSecret('a-unique-random-secret-with-at-least-32-chars'), false);
  assert.equal(isUsableEncryptionSecret(` ${base64url} `), false);
  assert.equal(isUsableEncryptionSecret(`${base64url}=`), false);
  assert.equal(
    isUsableEncryptionSecret('replace-with-a-long-random-secret-before-deploying'),
    false,
  );
});
