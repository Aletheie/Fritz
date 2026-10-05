import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import lockfile from 'proper-lockfile';
import { z } from 'zod';

export const SESSION_LIFETIME = 30 * 24 * 60 * 60_000;
export const GRANT_LIFETIME = 10 * 60_000;
export const CHALLENGE_LIFETIME = 5 * 60_000;
const hashSchema = z.string().regex(/^[\w-]{43}$/u);
const timestamp = z.number().int().nonnegative();
const sessionSchema = z.object({
  expiresAt: timestamp,
  authenticatedAt: timestamp,
  method: z.enum(['password', 'passkey', 'desktop']),
  credentialId: z.string().optional(),
});
const grantSchema = z.object({
  purpose: z.enum(['setup', 'recovery']),
  stage: z.enum(['link', 'enrollment']),
  expiresAt: timestamp,
});
const challengeSchema = z.object({
  challenge: z.string(),
  purpose: z.enum(['authenticate', 'register']),
  expiresAt: timestamp,
  grantHash: hashSchema.optional(),
  sessionHash: hashSchema.optional(),
  // Incremented whenever a security change invalidates in-flight ceremonies.
  generation: z.number().int().nonnegative(),
});
const profileSchema = z
  .object({
    version: z.literal(2),
    accountId: hashSchema,
    username: z.string().min(1).max(80),
    createdAt: z.string().datetime(),
    passwordHash: z
      .string()
      .regex(/^scrypt\$[\w-]+\$[\w-]+$/u)
      .optional(),
    sessions: z.record(hashSchema, sessionSchema),
    passkeys: z
      .array(
        z.object({
          id: z.string().min(1),
          publicKey: z.string().min(1),
          counter: z.number().int().nonnegative(),
          transports: z.array(z.string()),
          name: z.string().min(1).max(80),
          createdAt: z.string().datetime(),
        }),
      )
      .max(20),
    grants: z.record(hashSchema, grantSchema),
    challenges: z.record(hashSchema, challengeSchema),
    generation: z.number().int().nonnegative(),
    recoveryHash: hashSchema.optional(),
    ai: z
      .discriminatedUnion('state', [
        z.object({ state: z.literal('connected'), encrypted: z.string().max(16_384) }),
        z.object({ state: z.literal('disabled') }),
      ])
      .optional(),
  })
  .strict();
const legacySchema = z
  .object({
    version: z.literal(1),
    username: z.string().min(1).max(80),
    createdAt: z.string().datetime(),
    passwordHash: z.string().regex(/^scrypt\$[\w-]+\$[\w-]+$/u),
    sessions: z.record(hashSchema, timestamp),
  })
  .strict();

/** @typedef {import('zod').infer<typeof profileSchema>} Profile */
/** @typedef {import('zod').infer<typeof sessionSchema>} ProfileSession */
/** @typedef {import('zod').infer<typeof challengeSchema>} ProfileChallenge */

/** @param {Record<string, string | undefined>} environment */
export function profileDirectory(environment = process.env) {
  return resolve(
    environment.FRITZ_AUTH_DATA_DIR?.trim() ||
      environment.WORTLY_AUTH_DATA_DIR?.trim() ||
      (environment.NODE_ENV === 'production' ? '/data' : 'data'),
  );
}

export function randomToken() {
  return randomBytes(32).toString('base64url');
}
/** @param {string} value */
export function tokenHash(value) {
  return createHash('sha256').update(value, 'utf8').digest('base64url');
}

/** @param {number} now @returns {Profile} */
export function newProfile(now = Date.now()) {
  return {
    version: 2,
    accountId: randomToken(),
    username: 'local',
    createdAt: new Date(now).toISOString(),
    sessions: {},
    passkeys: [],
    grants: {},
    challenges: {},
    generation: 0,
  };
}

/** Missing is distinct from damaged: never replace an unreadable identity. @param {string} directory @returns {Profile | undefined} */
export function readProfile(directory) {
  try {
    const raw = readFileSync(join(directory, 'auth.json'), 'utf8');
    if (Buffer.byteLength(raw) > 2_000_000) throw new Error('Profile too large');
    const value = JSON.parse(raw);
    if (value?.version === 1) {
      const old = legacySchema.parse(value);
      return {
        version: 2,
        accountId: tokenHash(
          `${old.createdAt}\u0000${old.username.trim().toLocaleLowerCase('en-US')}`,
        ),
        username: old.username,
        createdAt: old.createdAt,
        passwordHash: old.passwordHash,
        sessions: Object.fromEntries(
          Object.entries(old.sessions).map(([hash, expiresAt]) => [
            hash,
            { expiresAt, authenticatedAt: 0, method: /** @type {const} */ ('password') },
          ]),
        ),
        passkeys: [],
        grants: {},
        challenges: {},
        generation: 0,
      };
    }
    return profileSchema.parse(value);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw new Error('Osobní profil nejde bezpečně načíst. Existing data has been preserved.', {
      cause: error,
    });
  }
}

/** @param {Profile} profile @param {number} now */
function prune(profile, now) {
  for (const records of [profile.sessions, profile.grants, profile.challenges]) {
    for (const [hash, record] of Object.entries(records))
      if (record.expiresAt <= now) delete records[hash];
  }
}

/** All runtime/CLI writers share this lock. Never hold it while calling a provider or authenticator.
 * @template T
 * @param {string} directory
 * @param {(profile: Profile) => T} mutate
 * @param {{create?: boolean, now?: number}} options
 * @returns {Promise<T>}
 */
export async function updateProfile(directory, mutate, { create = false, now = Date.now() } = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  /** @type {Error | undefined} */
  let compromised;
  const release = await lockfile.lock(directory, {
    lockfilePath: join(directory, '.profile.lock'),
    realpath: false,
    retries: { retries: 30, minTimeout: 10, maxTimeout: 100 },
    onCompromised: (error) => {
      compromised = error;
    },
  });
  let temporary;
  try {
    const profile = readProfile(directory) ?? (create ? newProfile(now) : undefined);
    if (!profile) throw new Error('Osobní profil ještě není aktivovaný.');
    prune(profile, now);
    const result = mutate(profile);
    const validated = profileSchema.parse(profile);
    if (compromised) throw compromised;
    temporary = join(directory, `auth.json.${process.pid}.${randomToken()}.tmp`);
    writeFileSync(temporary, `${JSON.stringify(validated)}\n`, { mode: 0o600 });
    renameSync(temporary, join(directory, 'auth.json'));
    return result;
  } finally {
    if (temporary) rmSync(temporary, { force: true });
    await release();
  }
}

/** @param {Profile} profile @param {ProfileSession['method']} method @param {string | undefined} credentialId @param {number} now */
export function issueSession(profile, method, credentialId = undefined, now = Date.now()) {
  prune(profile, now);
  const entries = Object.entries(profile.sessions).toSorted(
    (a, b) => a[1].expiresAt - b[1].expiresAt,
  );
  for (const [hash] of entries.slice(0, Math.max(0, entries.length - 63)))
    delete profile.sessions[hash];
  const token = randomToken();
  const expiresAt = now + SESSION_LIFETIME;
  profile.sessions[tokenHash(token)] = {
    expiresAt,
    authenticatedAt: now,
    method,
    ...(credentialId ? { credentialId } : {}),
  };
  return { token, expiresAt };
}

/** @param {Profile} profile */
export function rotateRecoveryCode(profile) {
  const code = randomToken();
  profile.recoveryHash = tokenHash(code);
  return code;
}

/** @param {string} value */
export function webAuthnOrigin(value) {
  const url = new URL(value);
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) ||
    !/^[a-z0-9.-]+$/iu.test(url.hostname) ||
    /^[\d.]+$/u.test(url.hostname)
  ) {
    throw new Error(
      'Pro passkey nastav ORIGIN na HTTPS doménu; lokálně použij http://localhost:3000.',
    );
  }
  return { origin: url.origin, rpID: url.hostname, rpName: 'Fritz' };
}

/** @param {string} directory @param {boolean} recovery @param {number} now */
export async function createAccessGrant(directory, recovery = false, now = Date.now()) {
  return updateProfile(
    directory,
    (profile) => {
      if (!recovery && (profile.passkeys.length || profile.passwordHash)) {
        throw new Error(
          'Profil už má přístup. Pro obnovu použij --recover; uložený pokrok zůstane zachovaný.',
        );
      }
      const token = randomToken();
      profile.grants = {
        [tokenHash(token)]: {
          purpose: recovery ? 'recovery' : 'setup',
          stage: 'link',
          expiresAt: now + GRANT_LIFETIME,
        },
      };
      return token;
    },
    { create: !recovery, now },
  );
}
