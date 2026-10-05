import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { updateProfile } from '../../../../scripts/lib/profile-store.mjs';
import {
  authenticatedUser,
  currentProfile,
  dataDirectory,
  requireSession,
} from '../auth/store.server.ts';
import { parseAiConnection, userConnectionsAllowed } from './connection-policy.ts';
import { decryptStoredApiKey } from './key-crypto.server.ts';
import { isUsableEncryptionSecret } from './key-policy.ts';
import { decryptAiProfile, encryptAiProfile } from './profile-crypto.server.ts';

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
  return Boolean(currentProfile()?.ai) || cookies.get(PREFERENCE_COOKIE) === 'user';
}
export function userConnectionNeedsAttention(cookies: Cookies): boolean {
  return (
    currentProfile()?.ai?.state !== 'disabled' &&
    hasUserAiPreference(cookies) &&
    !readUserAiConnection(cookies)
  );
}

function connectionSecret(create: boolean): string | undefined {
  if (env.AI_KEY_ENCRYPTION_SECRET)
    return isUsableEncryptionSecret(env.AI_KEY_ENCRYPTION_SECRET)
      ? env.AI_KEY_ENCRYPTION_SECRET
      : undefined;
  const directory = dataDirectory();
  const path = join(directory, 'ai-key-secret');
  try {
    const existing = readFileSync(path, 'utf8').trim();
    return isUsableEncryptionSecret(existing) ? existing : undefined;
  } catch (value) {
    if (!create || !(value instanceof Error && 'code' in value && value.code === 'ENOENT'))
      return undefined;
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const generated = randomBytes(32).toString('base64url');
  try {
    writeFileSync(path, generated, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return generated;
  } catch (value) {
    if (value instanceof Error && 'code' in value && value.code === 'EEXIST')
      return connectionSecret(false);
    throw value;
  }
}

function readLegacyConnection(cookies: Cookies): AiConnectionInput | undefined {
  if (!userAiEnabled() || currentProfile()?.ai) return undefined;
  const encrypted = cookies.get(COOKIE_NAME);
  const secret = connectionSecret(false);
  if (!encrypted || !secret) return undefined;
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

export function legacyMigrationAvailable(cookies: Cookies): boolean {
  return Boolean(readLegacyConnection(cookies));
}

export function readUserAiConnection(cookies: Cookies): AiConnectionInput | undefined {
  if (!userAiEnabled()) return undefined;
  const account = authenticatedUser(cookies);
  if (!account) return undefined;
  const stored = currentProfile();
  if (!stored || stored.accountId !== account.accountId) return undefined;
  if (!stored.ai) return readLegacyConnection(cookies);
  if (stored.ai.state === 'disabled') return undefined;
  const secret = connectionSecret(false);
  if (!secret) return undefined;
  const decrypted = decryptAiProfile(stored.ai.encrypted, secret, account.accountId);
  if (!decrypted) return undefined;
  try {
    return parseAiConnection(JSON.parse(decrypted), localProvidersAllowed());
  } catch {
    return undefined;
  }
}

export async function storeUserAiConnection(
  cookies: Cookies,
  connection: AiConnectionInput,
): Promise<void> {
  if (!userAiEnabled()) throw error(403, 'Uložení AI připojení není dostupné.');
  await updateProfile(dataDirectory(), (profile) => {
    requireSession(profile, cookies);
    const secret = connectionSecret(true);
    if (!secret) throw new Error('Úložiště AI připojení není dostupné.');
    profile.ai = {
      state: 'connected',
      encrypted: encryptAiProfile(JSON.stringify(connection), secret, profile.accountId),
    };
  });
  clearLegacyAiCookies(cookies);
}

export async function migrateLegacyAiConnection(cookies: Cookies): Promise<void> {
  const connection = readLegacyConnection(cookies);
  if (!connection)
    throw error(409, 'Staré AI připojení už není dostupné. Připoj poskytovatele znovu.');
  await updateProfile(dataDirectory(), (profile) => {
    requireSession(profile, cookies);
    if (profile.ai) throw error(409, 'AI připojení této instalace se mezitím změnilo.');
    const secret = connectionSecret(false);
    if (!secret) throw error(503, 'Šifrovací klíč není dostupný.');
    profile.ai = {
      state: 'connected',
      encrypted: encryptAiProfile(JSON.stringify(connection), secret, profile.accountId),
    };
  });
  clearLegacyAiCookies(cookies);
}

export async function clearUserAiConnection(cookies: Cookies): Promise<void> {
  await updateProfile(dataDirectory(), (profile) => {
    requireSession(profile, cookies);
    // Tombstone prevents older browsers from resurrecting a revoked connection.
    profile.ai = { state: 'disabled' };
  });
  clearLegacyAiCookies(cookies);
}

export function clearLegacyAiCookies(cookies: Cookies): void {
  cookies.delete(COOKIE_NAME, { path: COOKIE_PATH });
  cookies.delete(PREFERENCE_COOKIE, { path: COOKIE_PATH });
}
