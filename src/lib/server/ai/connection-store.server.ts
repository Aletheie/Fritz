import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { env } from '$env/dynamic/private';

import { authenticatedUser } from '../auth/store.server.ts';
import { parseAiConnection, userConnectionsAllowed } from './connection-policy.ts';
import { decryptStoredApiKey, encryptStoredApiKey } from './key-crypto.server.ts';
import { isUsableEncryptionSecret } from './key-policy.ts';

import type { Cookies } from '@sveltejs/kit';
import type { AiConnectionInput } from '../../domain/ai/connection.ts';

const COOKIE_NAME = 'fritz_ai_connection';
const PREFERENCE_COOKIE = 'fritz_ai_preference';
const COOKIE_PATH = '/api/ai';

export function userAiEnabled(): boolean {
  return (
    userConnectionsAllowed(env.AI_USER_CONNECTIONS) &&
    (!env.AI_KEY_ENCRYPTION_SECRET || isUsableEncryptionSecret(env.AI_KEY_ENCRYPTION_SECRET))
  );
}

export function localProvidersAllowed(): boolean {
  return env.AI_ALLOW_LOCAL_PROVIDERS === 'true';
}

export function hasUserAiPreference(cookies: Cookies): boolean {
  return cookies.get(PREFERENCE_COOKIE) === 'user';
}

function connectionSecret(create: boolean): string | undefined {
  if (env.AI_KEY_ENCRYPTION_SECRET) {
    return isUsableEncryptionSecret(env.AI_KEY_ENCRYPTION_SECRET)
      ? env.AI_KEY_ENCRYPTION_SECRET
      : undefined;
  }
  const directory = resolve(
    env.FRITZ_AUTH_DATA_DIR?.trim() ||
      env.WORTLY_AUTH_DATA_DIR?.trim() ||
      (env.NODE_ENV === 'production' ? '/data' : 'data'),
  );
  const path = join(directory, 'ai-key-secret');
  try {
    const existing = readFileSync(path, 'utf8').trim();
    return isUsableEncryptionSecret(existing) ? existing : undefined;
  } catch (error) {
    if (!create || !(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
      return undefined;
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const generated = randomBytes(32).toString('base64url');
  try {
    writeFileSync(path, generated, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return generated;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST')
      return connectionSecret(false);
    throw error;
  }
}

export function readUserAiConnection(cookies: Cookies): AiConnectionInput | undefined {
  if (!userAiEnabled()) return undefined;
  const encrypted = cookies.get(COOKIE_NAME);
  if (!encrypted) return undefined;
  const secret = connectionSecret(false);
  if (!secret) return undefined;
  const decrypted = decryptStoredApiKey(encrypted, secret);
  if (!decrypted) return undefined;
  try {
    const stored = JSON.parse(decrypted) as { accountId?: string; connection?: unknown };
    const account = authenticatedUser(cookies);
    if (!account || stored.accountId !== account.accountId) return undefined;
    return parseAiConnection(stored.connection, localProvidersAllowed());
  } catch {
    return undefined;
  }
}

export function storeUserAiConnection(
  cookies: Cookies,
  connection: AiConnectionInput,
  secure: boolean,
): void {
  const account = authenticatedUser(cookies);
  if (!account || !userAiEnabled()) throw new Error('Uložení AI připojení není dostupné.');
  const secret = connectionSecret(true);
  if (!secret) throw new Error('Úložiště AI připojení není dostupné.');
  cookies.set(
    COOKIE_NAME,
    encryptStoredApiKey(JSON.stringify({ accountId: account.accountId, connection }), secret),
    {
      path: COOKIE_PATH,
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: 30 * 24 * 60 * 60,
    },
  );
  // Keep the routing preference after credentials expire; never silently switch recipients.
  cookies.set(PREFERENCE_COOKIE, 'user', {
    path: COOKIE_PATH,
    httpOnly: true,
    sameSite: 'strict',
    secure,
    maxAge: 365 * 24 * 60 * 60,
  });
}

export function clearUserAiConnection(cookies: Cookies): void {
  cookies.delete(COOKIE_NAME, { path: COOKIE_PATH });
  cookies.delete(PREFERENCE_COOKIE, { path: COOKIE_PATH });
}
