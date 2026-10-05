import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { issueSession, updateProfile } from '../../scripts/lib/profile-store.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/** @typedef {{ dataDirectory?: string, serverDirectory?: string, loadHandler?: () => Promise<{handler: import('node:http').RequestListener}> }} ServerOptions */

/** @param {string} path @returns {Promise<unknown>} */
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw new Error('Local app data could not be read. Your existing data has been preserved.', {
      cause: error,
    });
  }
}

/** @param {string} path @param {unknown} value */
async function writeJson(path, value) {
  const temporary = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
}

/** @param {string} dataDirectory @param {number} now */
export async function prepareDesktopAccount(dataDirectory, now = Date.now()) {
  return updateProfile(
    dataDirectory,
    (profile) => issueSession(profile, 'desktop', undefined, now),
    { create: true, now },
  );
}

/** @param {ServerOptions} options */
export async function startDesktopServer({ dataDirectory, serverDirectory, loadHandler } = {}) {
  if (!dataDirectory) throw new Error('The local app data directory is missing.');
  const dataPath = resolve(dataDirectory);
  await mkdir(dataPath, { recursive: true, mode: 0o700 });
  await chmod(dataPath, 0o700);
  const configPath = join(dataPath, 'desktop.json');
  const config = /** @type {{port: number, version: number} | undefined} */ (
    await readJson(configPath)
  );
  if (
    config !== undefined &&
    (!config ||
      typeof config !== 'object' ||
      Array.isArray(config) ||
      config.version !== 1 ||
      !Number.isInteger(config.port) ||
      config.port < 1024 ||
      config.port > 65535)
  ) {
    throw new Error('The saved local address is invalid. Your learning data has been preserved.');
  }
  /** @type {import('node:http').RequestListener | undefined} */
  let handler;
  let port = 0;
  const server = createServer((request, response) => {
    // A stable loopback origin keeps IndexedDB and localStorage across updates.
    // Reject DNS rebinding and requests sent to an unrelated Host header.
    if (request.headers.host !== `127.0.0.1:${port}`) {
      response.writeHead(421).end();
    } else if (handler) {
      handler(request, response);
    } else {
      response.writeHead(503).end();
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(config?.port ?? 0, '127.0.0.1', () => resolveListen(undefined));
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('The local server address is unavailable.');
    port = address.port;
    const origin = `http://127.0.0.1:${port}`;
    process.env.NODE_ENV = 'production';
    process.env.FRITZ_RUNTIME = 'desktop';
    process.env.ORIGIN = origin;
    process.env.HOST = '127.0.0.1';
    process.env.PORT = String(port);
    process.env.FRITZ_AUTH_DATA_DIR = dataPath;
    process.env.AI_SPONSORED_MODE = 'off';
    process.env.AI_ALLOW_LOCAL_PROVIDERS = 'true';
    process.env.AI_USER_CONNECTIONS = 'on';
    // Do not inherit credentials from the launcher environment. BYOK belongs
    // to the explicit in-app connection and stays in the user's private store.
    for (const key of [
      'GEMINI_API_KEY',
      'GOOGLE_GENERATIVE_AI_API_KEY',
      'INKLING_API_KEY',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'AI_KEY_ENCRYPTION_SECRET',
    ]) {
      delete process.env[key];
    }
    const credentials = await prepareDesktopAccount(dataPath);
    const module = loadHandler
      ? await loadHandler()
      : await import(
          pathToFileURL(join(serverDirectory ?? join(here, 'server'), 'handler.js')).href
        );
    handler = module.handler;
    if (typeof handler !== 'function') throw new Error('The bundled app could not be loaded.');
    if (!config) await writeJson(configPath, { version: 1, port });
    return { server, origin, ...credentials };
  } catch (error) {
    server.close();
    throw error;
  }
}

async function main() {
  const instance = await startDesktopServer({ dataDirectory: process.env.FRITZ_DESKTOP_DATA_DIR });
  /** @param {{token: string, expiresAt: number}} credentials */
  const sendCredentials = (credentials) => {
    // stdout is a private IPC pipe owned by the native process, never a log file.
    process.stdout.write(
      `${JSON.stringify({ type: 'ready', origin: instance.origin, ...credentials })}\n`,
    );
  };
  const close = () => {
    instance.server.close(() => process.exit(0));
    instance.server.closeAllConnections();
    setTimeout(() => process.exit(0), 2_000).unref();
  };
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
  // The parent holds this pipe open; a native-app crash must not orphan a server.
  process.stdin.on('end', close);
  let input = '';
  let authenticating = false;
  process.stdin.on('data', (chunk) => {
    input += String(chunk);
    if (input.length > 1_024) {
      close();
      return;
    }
    let newline;
    while ((newline = input.indexOf('\n')) >= 0) {
      const command = input.slice(0, newline);
      input = input.slice(newline + 1);
      if (command !== 'authenticate' || authenticating) continue;
      authenticating = true;
      prepareDesktopAccount(process.env.FRITZ_DESKTOP_DATA_DIR ?? '')
        .then(sendCredentials)
        .catch(() =>
          process.stdout.write(
            `${JSON.stringify({ type: 'error', message: 'The local profile could not be reopened. Your existing data has been preserved.' })}\n`,
          ),
        )
        .finally(() => {
          authenticating = false;
        });
    }
  });
  process.stdin.resume();
  sendCredentials({ token: instance.token, expiresAt: instance.expiresAt });
}

if (process.argv[1] && (await realpath(process.argv[1])) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message =
      error?.code === 'EADDRINUSE'
        ? 'Fritz is already running, or its saved local port is occupied. Close the other process and try again.'
        : error instanceof Error
          ? error.message
          : 'The local app could not start.';
    process.stdout.write(`${JSON.stringify({ type: 'error', message })}\n`);
    process.exitCode = 1;
  });
}
