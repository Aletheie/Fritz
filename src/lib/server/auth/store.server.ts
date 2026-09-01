import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

import { verifyPassword } from './password.server.ts';

const SESSION_COOKIE = 'fritz_session';
const SECURE_SESSION_COOKIE = '__Secure-fritz_session';
const LEGACY_SESSION_COOKIE = 'wortly_session';
const LEGACY_SECURE_SESSION_COOKIE = '__Secure-wortly_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const AUTH_FILE = 'auth.json';
const ACCOUNT_VERSION = 1;

type AuthFile = {
  version: 1;
  username: string;
  passwordHash: string;
  createdAt: string;
  sessions: Record<string, number>;
};

export type AuthUser = { username: string };

type SessionCookieCandidate = {
  name: string;
  token: string;
  secure: boolean;
  legacy: boolean;
};

const SESSION_COOKIE_NAMES = [
  SESSION_COOKIE,
  SECURE_SESSION_COOKIE,
  LEGACY_SESSION_COOKIE,
  LEGACY_SECURE_SESSION_COOKIE,
] as const;

function dataDirectory(): string {
  const configured = env.FRITZ_AUTH_DATA_DIR?.trim() || env.WORTLY_AUTH_DATA_DIR?.trim();
  if (configured) return resolve(configured);
  return env.NODE_ENV === 'production' ? '/data' : resolve('data');
}

function authFilePath(): string {
  return join(dataDirectory(), AUTH_FILE);
}

function normalizeUsername(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function isValidAuthFile(value: unknown): value is AuthFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthFile>;
  return (
    candidate.version === ACCOUNT_VERSION &&
    typeof candidate.username === 'string' &&
    candidate.username.length >= 1 &&
    candidate.username.length <= 80 &&
    typeof candidate.passwordHash === 'string' &&
    candidate.passwordHash.startsWith('scrypt$') &&
    typeof candidate.createdAt === 'string' &&
    Boolean(candidate.sessions) &&
    typeof candidate.sessions === 'object'
  );
}

function readAuthFile(): AuthFile | undefined {
  try {
    const parsed = JSON.parse(readFileSync(authFilePath(), 'utf8')) as unknown;
    return isValidAuthFile(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeAuthFile(value: AuthFile): void {
  const directory = dataDirectory();
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    chmodSync(directory, 0o700);
  } catch {}

  const path = authFilePath();
  const temporaryPath = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  try {
    chmodSync(temporaryPath, 0o600);
  } catch {}
  renameSync(temporaryPath, path);
}

function sessionHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}

function sessionCookieCandidates(cookies: Cookies): SessionCookieCandidate[] {
  return SESSION_COOKIE_NAMES.flatMap((name) => {
    const token = cookies.get(name);
    return token
      ? [
          {
            name,
            token,
            secure: name.startsWith('__Secure-'),
            legacy: name === LEGACY_SESSION_COOKIE || name === LEGACY_SECURE_SESSION_COOKIE,
          },
        ]
      : [];
  });
}

function setSessionCookie(cookies: Cookies, name: string, token: string, maxAge: number): void {
  cookies.set(name, token, {
    path: '/',
    httpOnly: true,
    secure: name.startsWith('__Secure-'),
    sameSite: 'strict',
    maxAge,
  });
}

function deleteOtherSessionCookies(cookies: Cookies, activeName?: string): void {
  for (const name of SESSION_COOKIE_NAMES) {
    if (name !== activeName) cookies.delete(name, { path: '/' });
  }
}

export function hasAccount(): boolean {
  return Boolean(readAuthFile());
}

export function authenticate(username: string, password: string): boolean {
  const account = readAuthFile();
  if (!account) return false;
  return (
    normalizeUsername(username) === normalizeUsername(account.username) &&
    verifyPassword(password, account.passwordHash)
  );
}

export function createSession(cookies: Cookies, secureCookie: boolean): void {
  const account = readAuthFile();
  if (!account) throw new Error('Účet Fritz ještě nebyl vytvořen.');

  const token = randomBytes(32).toString('base64url');
  const sessions = Object.fromEntries(
    Object.entries(account.sessions).filter(([, expiresAt]) => expiresAt > Date.now()),
  );
  sessions[sessionHash(token)] = Date.now() + SESSION_MAX_AGE_SECONDS * 1_000;
  writeAuthFile({ ...account, sessions });

  const name = secureCookie ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
  setSessionCookie(cookies, name, token, SESSION_MAX_AGE_SECONDS);
  deleteOtherSessionCookies(cookies, name);
}

export function authenticatedUser(cookies: Cookies): AuthUser | undefined {
  const account = readAuthFile();
  if (!account) return undefined;
  const now = Date.now();
  for (const candidate of sessionCookieCandidates(cookies)) {
    const expiresAt = account.sessions[sessionHash(candidate.token)];
    if (!expiresAt || expiresAt <= now) continue;
    if (candidate.legacy) {
      const name = candidate.secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
      setSessionCookie(
        cookies,
        name,
        candidate.token,
        Math.max(1, Math.floor((expiresAt - now) / 1_000)),
      );
      deleteOtherSessionCookies(cookies, name);
    }
    return { username: account.username };
  }
  return undefined;
}

export function clearSession(cookies: Cookies): void {
  const tokens = sessionCookieCandidates(cookies).map((candidate) => candidate.token);
  const account = readAuthFile();
  if (account && tokens.length > 0) {
    const sessions = { ...account.sessions };
    for (const token of tokens) delete sessions[sessionHash(token)];
    try {
      writeAuthFile({ ...account, sessions });
    } catch {
      // Cookie deletion still logs the browser out if the volume is temporarily unavailable.
    }
  }
  deleteOtherSessionCookies(cookies);
}
