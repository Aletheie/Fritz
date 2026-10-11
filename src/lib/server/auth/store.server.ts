import { statSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import {
  issueSession,
  profileDirectory,
  readProfile,
  SESSION_LIFETIME,
  tokenHash,
  updateProfile,
  verifyPassword,
} from '../../../../scripts/lib/profile-store.mjs';

import type { Cookies } from '@sveltejs/kit';
import type { Profile } from '../../../../scripts/lib/profile-store.mjs';

export type AuthUser = { username: string; accountId: string; accountCreatedAt: string };
const COOKIE_NAMES = [
  '__Secure-fritz_session',
  'fritz_session',
  '__Secure-wortly_session',
  'wortly_session',
] as const;
export const dataDirectory = () => profileDirectory(env);
export const accessMode = () =>
  env.FRITZ_RUNTIME === 'desktop' ? ('desktop' as const) : ('web' as const);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

let cached: { key: string; profile: Readonly<Profile> | undefined } | undefined;

/**
 * Read-only view of the profile, re-parsed only when `auth.json` changes. Writes always replace
 * the file by rename, so inode, mtime and size identify a version across processes. Mutate the
 * profile only through `updateProfile`.
 */
export function currentProfile(): Readonly<Profile> | undefined {
  const directory = dataDirectory();
  let key = `${directory}:missing`;
  try {
    const stat = statSync(join(directory, 'auth.json'));
    key = `${directory}:${stat.ino}:${stat.mtimeMs}:${stat.size}`;
  } catch (value) {
    if (!(value instanceof Error && 'code' in value && value.code === 'ENOENT')) throw value;
  }
  if (cached?.key !== key) cached = { key, profile: deepFreeze(readProfile(directory)) };
  return cached.profile;
}

function candidates(cookies: Cookies) {
  return COOKIE_NAMES.flatMap((name) => {
    const token = cookies.get(name);
    return token ? [{ name, token, hash: tokenHash(token) }] : [];
  });
}

export function findSession(profile: Profile, cookies: Cookies) {
  for (const candidate of candidates(cookies)) {
    const session = profile.sessions[candidate.hash];
    if (session?.expiresAt > Date.now()) return { ...candidate, session };
  }
  return undefined;
}

export function requireSession(profile: Profile, cookies: Cookies, fresh = false) {
  const current = findSession(profile, cookies);
  if (!current) throw error(401, 'Přihlášení je vyžadováno.');
  if (
    fresh &&
    (current.session.authenticatedAt < Date.now() - 5 * 60_000 ||
      current.session.method === 'desktop')
  )
    throw error(403, 'Nejdřív znovu potvrď svůj přístup.');
  return current;
}

export function setSession(
  cookies: Cookies,
  token: string,
  secure: boolean,
  maxAge = SESSION_LIFETIME / 1_000,
) {
  const name = secure ? '__Secure-fritz_session' : 'fritz_session';
  cookies.set(name, token, { path: '/', httpOnly: true, secure, sameSite: 'strict', maxAge });
  for (const other of COOKIE_NAMES) if (other !== name) cookies.delete(other, { path: '/' });
}

export function authenticatedUser(cookies: Cookies): AuthUser | undefined {
  const profile = currentProfile();
  if (!profile) return undefined;
  const current = findSession(profile, cookies);
  if (!current) return undefined;
  if (current.name.includes('wortly'))
    setSession(
      cookies,
      current.token,
      current.name.startsWith('__Secure-'),
      Math.max(1, Math.floor((current.session.expiresAt - Date.now()) / 1_000)),
    );
  return {
    username: profile.username,
    accountId: profile.accountId,
    accountCreatedAt: profile.createdAt,
  };
}

export function hasAccount() {
  return Boolean(currentProfile());
}

export async function loginWithPassword(
  username: string,
  password: string,
  cookies: Cookies,
  secure: boolean,
) {
  const result = await updateProfile(dataDirectory(), (profile) => {
    if (
      !profile.passwordHash ||
      profile.passkeys.length ||
      profile.username.trim().toLocaleLowerCase('en-US') !==
        username.trim().toLocaleLowerCase('en-US') ||
      !verifyPassword(password, profile.passwordHash)
    )
      return undefined;
    for (const candidate of candidates(cookies)) delete profile.sessions[candidate.hash];
    return issueSession(profile, 'password');
  });
  if (!result) return false;
  setSession(cookies, result.token, secure);
  return true;
}

export async function clearSession(cookies: Cookies, all = false) {
  // Clearing browser access is also valid before this installation has a profile.
  if (all || currentProfile()) {
    await updateProfile(dataDirectory(), (profile) => {
      if (all) {
        requireSession(profile, cookies, true);
        profile.sessions = {};
        profile.challenges = {};
        profile.grants = {};
        profile.generation += 1;
      } else {
        for (const candidate of candidates(cookies)) delete profile.sessions[candidate.hash];
      }
    });
  }
  for (const name of COOKIE_NAMES) cookies.delete(name, { path: '/' });
}
