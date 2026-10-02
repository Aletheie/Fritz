import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { prepareDesktopAccount, startDesktopServer } from '../desktop/macos/bootstrap.mjs';

test('desktop sessions keep account identity, expire old credentials and use private files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fritz-desktop-account-'));
  try {
    const now = Date.parse('2026-10-02T12:00:00.000Z');
    const first = await prepareDesktopAccount(directory, now);
    const original = JSON.parse(await readFile(join(directory, 'auth.json'), 'utf8'));
    const second = await prepareDesktopAccount(directory, now + 31 * 86_400_000);
    const updated = JSON.parse(await readFile(join(directory, 'auth.json'), 'utf8'));
    assert.equal(updated.createdAt, original.createdAt);
    assert.equal(updated.passwordHash, original.passwordHash);
    assert.notEqual(first.token, second.token);
    assert.equal(first.token.length, 43);
    assert.deepEqual(Object.keys(updated.sessions), [
      createHash('sha256').update(second.token).digest('base64url'),
    ]);
    assert.equal(
      JSON.stringify(updated).includes(second.token),
      false,
      'only the token hash is persisted',
    );
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.equal((await stat(join(directory, 'auth.json'))).mode & 0o777, 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a damaged account is never silently replaced with a new identity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fritz-desktop-corrupt-'));
  try {
    const path = join(directory, 'auth.json');
    const original = '{"version":1,"sessions":{}}';
    await writeFile(path, original);
    await assert.rejects(prepareDesktopAccount(directory), /preserved/u);
    assert.equal(await readFile(path, 'utf8'), original);
    await writeFile(path, 'broken json');
    await assert.rejects(prepareDesktopAccount(directory), /preserved/u);
    assert.equal(await readFile(path, 'utf8'), 'broken json');
    await writeFile(path, 'null');
    await assert.rejects(prepareDesktopAccount(directory), /preserved/u);
    assert.equal(await readFile(path, 'utf8'), 'null');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a damaged saved origin is rejected before it can move browser learning data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fritz-desktop-origin-'));
  try {
    await writeFile(join(directory, 'desktop.json'), JSON.stringify({ port: '12345' }));
    await assert.rejects(startDesktopServer({ dataDirectory: directory }), /preserved/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
