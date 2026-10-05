import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { TestContext } from 'node:test';
import {
  createAccessGrant,
  issueSession,
  readProfile,
  tokenHash,
  updateProfile,
  webAuthnOrigin,
} from '../scripts/lib/profile-store.mjs';
import { encryptAiProfile, decryptAiProfile } from '../src/lib/server/ai/profile-crypto.server.ts';
import { hashPassword } from '../src/lib/server/auth/password.server.ts';

async function directory(t: TestContext) {
  const path = await mkdtemp(join(tmpdir(), 'fritz-profile-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('legacy identity and sessions survive migration without refreshing authentication', async (t) => {
  const path = await directory(t);
  const createdAt = '2026-01-01T10:00:00.000Z';
  const token = 'old-test-session';
  const expiresAt = Date.now() + 60_000;
  await writeFile(
    join(path, 'auth.json'),
    JSON.stringify({
      version: 1,
      username: 'Student',
      createdAt,
      passwordHash: hashPassword('test-only-long-password'),
      sessions: { [tokenHash(token)]: expiresAt },
    }),
  );
  const before = readProfile(path)!;
  assert.equal(before.accountId, tokenHash(`${createdAt}\u0000student`));
  assert.equal(before.sessions[tokenHash(token)].authenticatedAt, 0);
  await updateProfile(path, (profile) => {
    profile.ai = { state: 'disabled' };
  });
  const after = readProfile(path)!;
  assert.equal(after.accountId, before.accountId);
  assert.equal(after.createdAt, createdAt);
  assert.equal(after.sessions[tokenHash(token)].expiresAt, expiresAt);
  assert.equal(JSON.parse(await readFile(join(path, 'auth.json'), 'utf8')).version, 2);
  assert.equal((await stat(join(path, 'auth.json'))).mode & 0o777, 0o600);
});

test('profile updates from independent processes do not overwrite each other', async (t) => {
  const path = await directory(t);
  await updateProfile(path, () => {}, { create: true });
  const module = new URL('../scripts/lib/profile-store.mjs', import.meta.url).href;
  const outcomes = await Promise.all(
    Array.from({ length: 6 }, async () => {
      const child = spawn(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import {updateProfile} from ${JSON.stringify(module)}; for(let i=0;i<10;i++) await updateProfile(process.argv[1],p=>{p.generation++});`,
          path,
        ],
        { stdio: 'pipe' },
      );
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      const [code] = await once(child, 'exit');
      assert.equal(code, 0, stderr);
    }),
  );
  assert.equal(outcomes.length, 6);
  assert.equal(readProfile(path)!.generation, 60);
});

test('activation links store only hashes, replace older links and preserve a recovering profile', async (t) => {
  const path = await directory(t);
  const first = await createAccessGrant(path);
  const identity = readProfile(path)!.accountId;
  const second = await createAccessGrant(path);
  const profile = readProfile(path)!;
  assert.equal(profile.accountId, identity);
  assert.equal(profile.grants[tokenHash(first)], undefined);
  assert.equal(profile.grants[tokenHash(second)].stage, 'link');
  assert.ok(!JSON.stringify(profile).includes(second));
  await updateProfile(path, (value) => {
    value.passwordHash = hashPassword('test-only-long-password');
  });
  await assert.rejects(createAccessGrant(path), /recover/u);
  const recovery = await createAccessGrant(path, true);
  assert.equal(readProfile(path)!.grants[tokenHash(recovery)].purpose, 'recovery');
  assert.equal(readProfile(path)!.accountId, identity);
});

test('sessions have bounded storage and hashes; failed writes preserve the previous profile', async (t) => {
  const path = await directory(t);
  const token = await updateProfile(
    path,
    (profile) => {
      for (let i = 0; i < 80; i += 1) issueSession(profile, 'desktop');
      return issueSession(profile, 'desktop').token;
    },
    { create: true },
  );
  const original = await readFile(join(path, 'auth.json'), 'utf8');
  assert.equal(Object.keys(readProfile(path)!.sessions).length, 64);
  assert.ok(!original.includes(token));
  await assert.rejects(
    updateProfile(path, (profile) => {
      profile.accountId = 'broken';
    }),
  );
  assert.equal(await readFile(join(path, 'auth.json'), 'utf8'), original);
});

test('passkey origins require a stable HTTPS domain or development localhost', () => {
  assert.equal(webAuthnOrigin('https://learn.example').rpID, 'learn.example');
  assert.equal(webAuthnOrigin('http://localhost:3000').rpID, 'localhost');
  for (const value of [
    'http://learn.example',
    'https://127.0.0.1',
    'https://user:password@learn.example',
    'https://learn.example/path',
    'https://learn.example/',
  ])
    assert.throws(() => webAuthnOrigin(value));
});

test('persistent AI encryption rejects tampering, a different owner/key and legacy cookie envelopes', () => {
  const secret = Buffer.alloc(32, 7).toString('base64url');
  const second = Buffer.alloc(32, 8).toString('base64url');
  const connection = JSON.stringify({
    apiKey: 'only-a-test-key',
    provider: 'google-gemini',
    model: 'test',
  });
  const encrypted = encryptAiProfile(connection, secret, 'owner-a');
  assert.ok(!encrypted.includes('only-a-test-key'));
  assert.equal(decryptAiProfile(encrypted, secret, 'owner-a'), connection);
  assert.equal(decryptAiProfile(encrypted, secret, 'owner-b'), undefined);
  assert.equal(decryptAiProfile(encrypted, second, 'owner-a'), undefined);
  const parts = encrypted.split('.');
  for (let i = 0; i < parts.length; i += 1) {
    const tampered = [...parts];
    tampered[i] = `x${tampered[i]}`;
    assert.equal(decryptAiProfile(tampered.join('.'), secret, 'owner-a'), undefined);
  }
  assert.equal(decryptAiProfile('v3.key.old.expired.cookie', secret, 'owner-a'), undefined);
});
