import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import type { TestContext } from 'node:test';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts: { 'account:create': string };
};
const [, ...command] = manifest.scripts['account:create'].split(' ');

function accountCommand(context: TestContext, dotenv?: string, override?: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'fritz-account-test-'));
  context.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, 'scripts'));
  copyFileSync(
    new URL('../scripts/account-create.mjs', import.meta.url),
    join(cwd, 'scripts/account-create.mjs'),
  );
  if (dotenv !== undefined) writeFileSync(join(cwd, '.env'), dotenv);
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'development' };
  delete env.FRITZ_AUTH_DATA_DIR;
  delete env.WORTLY_AUTH_DATA_DIR;
  if (override !== undefined) env.FRITZ_AUTH_DATA_DIR = override;
  const result = spawnSync(
    process.execPath,
    [...command, '--username', 'test', '--password', 'synthetic account test password'],
    { cwd, env, encoding: 'utf8', timeout: 10_000 },
  );
  assert.equal(result.status, 0, result.error?.message ?? `${result.stdout}${result.stderr}`);
  return cwd;
}

test('account:create uses the auth directory configured in .env', (context) => {
  const cwd = accountCommand(context, 'FRITZ_AUTH_DATA_DIR="./configured auth"\n');
  const account = JSON.parse(readFileSync(join(cwd, 'configured auth/auth.json'), 'utf8'));
  assert.equal(account.username, 'test');
  assert.match(account.passwordHash, /^scrypt\$/u);
  assert.equal(existsSync(join(cwd, 'data/auth.json')), false);
});

test('account:create keeps an explicitly supplied environment authoritative', (context) => {
  const cwd = accountCommand(context, 'FRITZ_AUTH_DATA_DIR=./dotenv-auth\n', './injected-auth');
  assert.equal(existsSync(join(cwd, 'injected-auth/auth.json')), true);
  assert.equal(existsSync(join(cwd, 'dotenv-auth/auth.json')), false);
  assert.equal(existsSync(join(cwd, 'data/auth.json')), false);
});

test('account:create still works without a .env file', (context) => {
  const cwd = accountCommand(context);
  assert.equal(existsSync(join(cwd, 'data/auth.json')), true);
});
