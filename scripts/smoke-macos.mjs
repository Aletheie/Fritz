// oxlint-disable no-await-in-loop -- observe each live launch and its persisted origin sequentially.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const index = process.argv.indexOf('--app');
if (index < 0 || !process.argv[index + 1]) throw new Error('Use --app path/to/Fritz.app');
const application = resolve(process.argv[index + 1]);
const resources = join(application, 'Contents/Resources');
const temporary = await mkdtemp(join(tmpdir(), 'fritz-macos-smoke-'));
const directory = join(temporary, 'data');
const environment = { ...process.env, FRITZ_DESKTOP_DATA_DIR: directory };
const active = new Set();

async function stop(child) {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
  active.delete(child);
}

async function waitForNativeQuit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolveExit, reject) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolveExit();
    };
    const timeout = setTimeout(() => {
      child.removeListener('exit', onExit);
      reject(new Error('The native app did not finish its normal Quit lifecycle.'));
    }, 10_000);
    child.once('exit', onExit);
  });
  active.delete(child);
}

async function waitForShutdown(origin) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(500) });
    } catch {
      return;
    }
    await delay(100);
  }
  throw new Error('The app left an orphaned local server running.');
}

async function launchHelper() {
  const child = spawn(join(resources, 'node'), [join(resources, 'bootstrap.mjs')], {
    cwd: resources,
    env: environment,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  active.add(child);
  let buffer = '';
  const ready = await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Bundled server startup timed out.')),
      20_000,
    );
    child.once('error', reject);
    child.once('exit', () => {
      clearTimeout(timeout);
      reject(new Error('Bundled server exited before ready.'));
    });
    child.stdout.on('data', (chunk) => {
      buffer += String(chunk);
      if (!buffer.includes('\n')) return;
      clearTimeout(timeout);
      const payload = JSON.parse(buffer.split('\n')[0]);
      if (payload.type === 'ready') resolveReady(payload);
      else reject(new Error(payload.message));
    });
  });
  return { child, ...ready };
}

async function launchNative(iteration) {
  const reportPath = join(temporary, `native-${iteration}.json`);
  await writeFile(`${reportPath}.download.json`, 'previous-backup');
  const child = spawn(join(application, 'Contents/MacOS/Fritz'), [], {
    env: { ...environment, FRITZ_DESKTOP_SMOKE_REPORT: reportPath, FRITZ_DESKTOP_SMOKE_EXIT: '1' },
    stdio: 'ignore',
  });
  active.add(child);
  child.on('error', () => {});
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const report = await readFile(reportPath, 'utf8')
      .then(JSON.parse)
      .catch(() => undefined);
    if (report) {
      assert.equal(report.ok, true, `Native launch: ${JSON.stringify(report)}`);
      assert.equal(report.httpOnly, true, 'JavaScript must not see the session cookie');
      assert.equal(report.logoutVisible, false, 'the native app has no web logout control');
      assert.ok(report.body?.length > 0, 'WebKit renders the application');
      assert.equal(report.downloaded, true, 'native download delegate saves the Blob export');
      assert.equal(
        report.previousBackupPreserved,
        true,
        'the old backup survives until the replacement has fully downloaded',
      );
      assert.deepEqual(JSON.parse(await readFile(`${reportPath}.download.json`, 'utf8')), {
        test: 'fritz-desktop-export',
      });
      await waitForNativeQuit(child);
      await waitForShutdown(report.origin);
      process.stdout.write(
        `Native launch ${iteration}: ${JSON.stringify({
          path: report.path,
          persisted: report.persisted,
          indexedDbPersisted: report.indexedDbPersisted,
          downloaded: report.downloaded,
          previousBackupPreserved: report.previousBackupPreserved,
          httpOnly: report.httpOnly,
        })}\n`,
      );
      return report;
    }
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('The native app exited without a report.');
    await delay(200);
  }
  throw new Error('Native WKWebView startup timed out.');
}

try {
  const first = await launchHelper();
  const anonymous = await fetch(`${first.origin}/api/ai/key`);
  assert.equal(anonymous.status, 401, 'local APIs still require authentication');
  const cookie = `fritz_session=${first.token}`;
  const authenticated = await fetch(`${first.origin}/api/auth/session`, { headers: { cookie } });
  const user = await authenticated.json();
  assert.equal(user.authenticated, true);
  assert.equal(user.accessMode, 'desktop');
  const home = await fetch(first.origin, { headers: { cookie }, redirect: 'manual' });
  assert.equal(home.status, 200);
  const loggedOut = await fetch(`${first.origin}/api/auth/logout`, {
    method: 'POST',
    headers: { cookie, origin: first.origin },
  });
  assert.equal(loggedOut.status, 200);
  const loggedOutUser = await fetch(`${first.origin}/api/auth/session`, {
    headers: { cookie },
  }).then((response) => response.json());
  assert.equal(loggedOutUser.authenticated, false);
  const renewed = new Promise((resolveRenewal, reject) => {
    const timeout = setTimeout(() => reject(new Error('Local profile recovery timed out.')), 5_000);
    first.child.stdout.once('data', (chunk) => {
      clearTimeout(timeout);
      resolveRenewal(JSON.parse(String(chunk).trim()));
    });
  });
  first.child.stdin.write('authenticate\n');
  const renewedSession = await renewed;
  assert.equal(renewedSession.type, 'ready');
  const recoveredUser = await fetch(`${first.origin}/api/auth/session`, {
    headers: { cookie: `fritz_session=${renewedSession.token}` },
  }).then((response) => response.json());
  assert.equal(recoveredUser.authenticated, true);
  assert.equal(
    recoveredUser.accountId,
    user.accountId,
    'local logout recovery preserves learning identity',
  );
  const wrongHostStatus = await new Promise((resolveStatus, reject) => {
    get(`${first.origin}/healthz`, { headers: { host: 'unrelated.example' } }, (response) => {
      response.resume();
      resolveStatus(response.statusCode);
    }).once('error', reject);
  });
  assert.equal(wrongHostStatus, 421);
  await stop(first.child);
  await waitForShutdown(first.origin);
  const second = await launchHelper();
  assert.equal(second.origin, first.origin, 'the browser storage origin survives restarts');
  const secondUser = await fetch(`${second.origin}/api/auth/session`, {
    headers: { cookie: `fritz_session=${second.token}` },
  }).then((response) => response.json());
  assert.equal(
    secondUser.accountId,
    user.accountId,
    'restart does not reset account-bound learning data',
  );
  await stop(second.child);
  await waitForShutdown(second.origin);
  const nativeFirst = await launchNative(1);
  const nativeSecond = await launchNative(2);
  assert.equal(nativeFirst.origin, first.origin);
  assert.equal(nativeSecond.origin, first.origin);
  assert.equal(nativeSecond.persisted, true, 'WKWebView local storage survives app relaunch');
  assert.equal(nativeSecond.indexedDbPersisted, true, 'WKWebView IndexedDB survives app relaunch');
  process.stdout.write(
    'macOS smoke PASS: bundled runtime, auth, protected APIs, stable account/origin, native WebKit, HttpOnly cookie, persistence and process cleanup.\n',
  );
} finally {
  for (const child of active) await stop(child);
  await rm(temporary, { recursive: true, force: true });
}
