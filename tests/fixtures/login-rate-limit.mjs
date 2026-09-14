import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Run the production router in its own process, without consuming the browser
// suite's login budget or touching its account.
const { Server } = await import(new URL('../../build/server/index.js', import.meta.url).href);
const { manifest } = await import(new URL('../../build/server/manifest.js', import.meta.url).href);
const dataDir = mkdtempSync(join(tmpdir(), 'fritz-login-limit-'));
const env = { ...process.env, FRITZ_AUTH_DATA_DIR: dataDir, AI_SPONSORED_MODE: 'off' };

try {
  execFileSync(
    process.execPath,
    [
      'scripts/account-create.mjs',
      '--username',
      'test',
      '--password',
      'synthetic account test password',
    ],
    { env, timeout: 10_000 },
  );
  const server = new Server(manifest);
  await server.init({ env });
  async function login(path, address = '192.0.2.100') {
    const response = await server.respond(
      new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({ username: 'test', password: 'incorrect test password' }),
      }),
      { getClientAddress: () => address },
    );
    return response.status;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    // oxlint-disable-next-line no-await-in-loop -- requests must exhaust one client's budget in order.
    assert.equal(await login('/api/auth/login'), 401);
  }
  for (const path of [
    '/api/auth/login',
    '/api/auth/%6cogin',
    '/api/auth/l%6fgin',
    '/api/auth/lo%67in',
    '/api/auth/log%69n',
    '/api/auth/logi%6e',
  ]) {
    // oxlint-disable-next-line no-await-in-loop -- check every spelling after the same budget is exhausted.
    assert.equal(await login(path), 429, path);
  }
  assert.equal(await login('/api/auth/login', '192.0.2.101'), 401);
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
