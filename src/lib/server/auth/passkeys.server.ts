import { env } from '$env/dynamic/private';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { error, isHttpError, json } from '@sveltejs/kit';
import { z } from 'zod';
import {
  CHALLENGE_LIFETIME,
  GRANT_LIFETIME,
  issueSession,
  randomToken,
  rotateRecoveryCode,
  tokenHash,
  updateProfile,
  webAuthnOrigin,
} from '../../../../scripts/lib/profile-store.mjs';
import { assertRateLimit, assertSameOrigin, readJsonRequest } from '../ai/http.server.ts';
import {
  clearSession,
  currentProfile,
  dataDirectory,
  findSession,
  requireSession,
  setSession,
} from './store.server.ts';

import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { Cookies, RequestEvent, RequestHandler } from '@sveltejs/kit';
import type { Profile, ProfileChallenge } from '../../../../scripts/lib/profile-store.mjs';

const tokenInput = z.object({ token: z.string().regex(/^[\w-]{43}$/u) });
const responseInput = z.object({
  response: z.record(z.string(), z.unknown()),
  name: z.string().trim().min(1).max(80).default('Osobní passkey'),
});
type Operation = (event: RequestEvent) => Promise<unknown>;

export function authMutation(operation: Operation): RequestHandler {
  return async (event) => {
    try {
      assertSameOrigin(event, true);
      assertRateLimit(event, 8, 10 * 60_000);
      return json(await operation(event));
    } catch (value) {
      if (isHttpError(value)) return json({ error: value.body.message }, { status: value.status });
      if (value instanceof z.ZodError)
        return json({ error: 'Údaje pro ověření přístupu nemají platný formát.' }, { status: 400 });
      return json(
        {
          error:
            'Přístup se nepodařilo bezpečně ověřit. Zkus to znovu; uložený pokrok zůstává zachovaný.',
        },
        { status: 503 },
      );
    }
  };
}

function rp(event: RequestEvent) {
  let config;
  try {
    config = webAuthnOrigin(env.ORIGIN || 'http://localhost:3000');
  } catch {
    throw error(503, 'Passkey potřebuje HTTPS doménu; lokálně použij localhost.');
  }
  if (config.origin !== event.url.origin) throw error(403, 'Adresa neodpovídá osobní instalaci.');
  return config;
}

function cookieValue(cookies: Cookies, purpose: string) {
  return cookies.get(`__Secure-fritz_${purpose}`) ?? cookies.get(`fritz_${purpose}`);
}
function clearCookie(cookies: Cookies, purpose: string) {
  for (const prefix of ['', '__Secure-'])
    cookies.delete(`${prefix}fritz_${purpose}`, { path: '/api/auth' });
}
function setCookie(event: RequestEvent, purpose: string, token: string, lifetime: number) {
  clearCookie(event.cookies, purpose);
  const secure = event.url.protocol === 'https:';
  event.cookies.set(`${secure ? '__Secure-' : ''}fritz_${purpose}`, token, {
    path: '/api/auth',
    secure,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: Math.floor(lifetime / 1_000),
  });
}

export function enrollmentPurpose(cookies: Cookies) {
  const token = cookieValue(cookies, 'enrollment');
  const grant = token ? currentProfile()?.grants[tokenHash(token)] : undefined;
  return grant?.stage === 'enrollment' && grant.expiresAt > Date.now() ? grant.purpose : undefined;
}

export async function exchangeSetup(event: RequestEvent) {
  rp(event);
  const { token } = tokenInput.parse(await readJsonRequest(event, 1_024));
  const next = randomToken();
  await updateProfile(dataDirectory(), (profile) => {
    const hash = tokenHash(token);
    const grant = profile.grants[hash];
    if (!grant || grant.stage !== 'link' || grant.expiresAt <= Date.now())
      throw error(400, 'Aktivační odkaz vypršel nebo už byl použitý.');
    if (grant.purpose === 'setup' && (profile.passkeys.length || profile.passwordHash))
      throw error(409, 'Tato instalace už má vlastníka.');
    delete profile.grants[hash];
    profile.grants[tokenHash(next)] = { ...grant, stage: 'enrollment' };
  });
  setCookie(event, 'enrollment', next, GRANT_LIFETIME);
  return { enrollmentPending: true };
}

export async function exchangeRecovery(event: RequestEvent) {
  rp(event);
  const { token } = tokenInput.parse(await readJsonRequest(event, 1_024));
  const next = randomToken();
  await updateProfile(dataDirectory(), (profile) => {
    if (!profile.recoveryHash || tokenHash(token) !== profile.recoveryHash)
      throw error(400, 'Obnovovací kód není platný nebo už byl použitý.');
    delete profile.recoveryHash;
    profile.generation += 1;
    profile.challenges = {};
    profile.grants = {
      [tokenHash(next)]: {
        purpose: 'recovery',
        stage: 'enrollment',
        expiresAt: Date.now() + GRANT_LIFETIME,
      },
    };
  });
  setCookie(event, 'enrollment', next, GRANT_LIFETIME);
  return { enrollmentPending: true };
}

function registrationAuthority(profile: Profile, cookies: Cookies) {
  const token = cookieValue(cookies, 'enrollment');
  const grantHash = token ? tokenHash(token) : undefined;
  const grant = grantHash ? profile.grants[grantHash] : undefined;
  if (grant && grant.stage === 'enrollment' && grant.expiresAt > Date.now()) return { grantHash };
  return { sessionHash: requireSession(profile, cookies, true).hash };
}

function assertRegistrationAuthority(profile: Profile, challenge: ProfileChallenge) {
  if (challenge.grantHash) {
    const grant = profile.grants[challenge.grantHash];
    if (
      !grant ||
      grant.stage !== 'enrollment' ||
      grant.expiresAt <= Date.now() ||
      (grant.purpose === 'setup' && (profile.passkeys.length || profile.passwordHash))
    )
      throw error(403, 'Aktivace vypršela. Otevři nový soukromý odkaz.');
    return grant.purpose === 'recovery';
  }
  const session = challenge.sessionHash ? profile.sessions[challenge.sessionHash] : undefined;
  if (
    !session ||
    session.expiresAt <= Date.now() ||
    session.authenticatedAt < Date.now() - CHALLENGE_LIFETIME ||
    session.method === 'desktop'
  ) {
    throw error(403, 'Nejdřív znovu potvrď svůj přístup.');
  }
  return false;
}

async function saveChallenge(
  event: RequestEvent,
  challenge: string,
  purpose: ProfileChallenge['purpose'],
) {
  const token = randomToken();
  await updateProfile(dataDirectory(), (profile) => {
    if (Object.keys(profile.challenges).length >= 64)
      throw error(429, 'Probíhá příliš mnoho ověření. Zkus to za chvíli.');
    const old = cookieValue(event.cookies, 'challenge');
    if (old) delete profile.challenges[tokenHash(old)];
    profile.challenges[tokenHash(token)] = {
      challenge,
      purpose,
      expiresAt: Date.now() + CHALLENGE_LIFETIME,
      generation: profile.generation,
      ...(purpose === 'register' ? registrationAuthority(profile, event.cookies) : {}),
    };
  });
  setCookie(event, 'challenge', token, CHALLENGE_LIFETIME);
}

async function takeChallenge(event: RequestEvent, purpose: ProfileChallenge['purpose']) {
  const token = cookieValue(event.cookies, 'challenge');
  clearCookie(event.cookies, 'challenge');
  if (!token) throw error(400, 'Ověření vypršelo. Zkus to znovu.');
  const record = await updateProfile(dataDirectory(), (profile) => {
    const hash = tokenHash(token);
    const challenge = profile.challenges[hash];
    delete profile.challenges[hash];
    return challenge;
  });
  if (!record || record.purpose !== purpose || record.expiresAt <= Date.now())
    throw error(400, 'Ověření vypršelo nebo už bylo použité.');
  return record;
}

export async function registrationOptions(event: RequestEvent) {
  const config = rp(event);
  const profile = currentProfile();
  if (!profile) throw error(403, 'Nejdřív otevři soukromý aktivační odkaz.');
  const authority = registrationAuthority(profile, event.cookies);
  const recovering =
    authority.grantHash && profile.grants[authority.grantHash]?.purpose === 'recovery';
  if (profile.passkeys.length >= 20 && !recovering)
    throw error(409, 'Nejdřív odeber některý uložený passkey.');
  const options = await generateRegistrationOptions({
    ...config,
    userID: new Uint8Array(Buffer.from(profile.accountId, 'base64url')),
    userName: 'Osobní Fritz',
    userDisplayName: 'Osobní Fritz',
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: profile.passkeys.map((key) => ({
      id: key.id,
      transports: key.transports as AuthenticatorTransport[],
    })),
  });
  await saveChallenge(event, options.challenge, 'register');
  return options;
}

export async function registrationVerify(event: RequestEvent) {
  const config = rp(event);
  const challenge = await takeChallenge(event, 'register');
  const body = responseInput.parse(await readJsonRequest(event, 32_768));
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response as unknown as RegistrationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
    });
  } catch {
    throw error(400, 'Passkey se nepodařilo ověřit. Zkus vytvoření znovu.');
  }
  if (!verification.verified || !verification.registrationInfo)
    throw error(400, 'Passkey nebyl ověřený.');
  const info = verification.registrationInfo;
  const result = await updateProfile(dataDirectory(), (profile) => {
    if (profile.generation !== challenge.generation || challenge.expiresAt <= Date.now())
      throw error(403, 'Přístup se mezitím změnil. Ověř ho znovu.');
    const recovery = assertRegistrationAuthority(profile, challenge);
    const replacing = recovery || profile.passkeys.length === 0;
    if (profile.passkeys.some((key) => key.id === info.credential.id))
      throw error(409, 'Tento passkey už je uložený.');
    if (!recovery && profile.passkeys.length >= 20)
      throw error(409, 'Je uložený maximální počet passkeys.');
    if (replacing) {
      profile.sessions = {};
      profile.grants = {};
      profile.challenges = {};
      profile.generation += 1;
      delete profile.passwordHash;
      if (recovery) profile.passkeys = [];
    }
    if (challenge.sessionHash) delete profile.sessions[challenge.sessionHash];
    profile.passkeys.push({
      id: info.credential.id,
      publicKey: Buffer.from(info.credential.publicKey).toString('base64url'),
      counter: info.credential.counter,
      transports: info.credential.transports ?? [],
      name: body.name,
      createdAt: new Date().toISOString(),
    });
    const recoveryCode = replacing ? rotateRecoveryCode(profile) : undefined;
    return { ...issueSession(profile, 'passkey', info.credential.id), recoveryCode };
  });
  setSession(event.cookies, result.token, event.url.protocol === 'https:');
  clearCookie(event.cookies, 'enrollment');
  return { authenticated: true, recoveryCode: result.recoveryCode };
}

export async function authenticationOptions(event: RequestEvent) {
  const config = rp(event);
  if (!currentProfile()?.passkeys.length) throw error(409, 'Tato instalace zatím nemá passkey.');
  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: 'required',
    allowCredentials: [],
  });
  await saveChallenge(event, options.challenge, 'authenticate');
  return options;
}

export async function authenticationVerify(event: RequestEvent) {
  const config = rp(event);
  const challenge = await takeChallenge(event, 'authenticate');
  const { response } = responseInput.parse(await readJsonRequest(event, 32_768));
  const profile = currentProfile();
  const key = profile?.passkeys.find((item) => item.id === response.id);
  if (!key || !profile) throw error(400, 'Passkey nepatří této instalaci.');
  const body = response as unknown as AuthenticationResponseJSON;
  if (body.response?.userHandle && body.response.userHandle !== profile.accountId)
    throw error(400, 'Passkey nepatří osobnímu profilu.');
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      credential: {
        id: key.id,
        publicKey: new Uint8Array(Buffer.from(key.publicKey, 'base64url')),
        counter: key.counter,
        transports: key.transports as AuthenticatorTransport[],
      },
    });
  } catch {
    throw error(400, 'Passkey se nepodařilo ověřit. Zkus to znovu.');
  }
  if (!verification.verified) throw error(400, 'Passkey nebyl ověřený.');
  const result = await updateProfile(dataDirectory(), (current) => {
    const stored = current.passkeys.find((item) => item.id === key.id);
    if (
      !stored ||
      current.accountId !== profile.accountId ||
      current.generation !== challenge.generation ||
      challenge.expiresAt <= Date.now()
    )
      throw error(403, 'Přístup byl odvolaný.');
    if (
      verification.authenticationInfo.newCounter > 0 &&
      verification.authenticationInfo.newCounter <= stored.counter
    )
      throw error(400, 'Ověření passkey už bylo použité.');
    stored.counter = verification.authenticationInfo.newCounter;
    const prior = findSession(current, event.cookies);
    if (prior) delete current.sessions[prior.hash];
    return issueSession(current, 'passkey', stored.id);
  });
  setSession(event.cookies, result.token, event.url.protocol === 'https:');
  return { authenticated: true };
}

export async function removePasskey(event: RequestEvent) {
  await updateProfile(dataDirectory(), (profile) => {
    requireSession(profile, event.cookies, true);
    const id = event.params.id;
    if (!profile.passkeys.some((key) => key.id === id))
      throw error(404, 'Passkey už není uložený.');
    if (profile.passkeys.length <= 1) throw error(409, 'Nejdřív přidej náhradní passkey.');
    profile.passkeys = profile.passkeys.filter((key) => key.id !== id);
    for (const [hash, session] of Object.entries(profile.sessions))
      if (session.credentialId === id) delete profile.sessions[hash];
    profile.challenges = {};
    profile.generation += 1;
  });
  return { removed: true };
}

export async function replaceRecoveryCode(event: RequestEvent) {
  return updateProfile(dataDirectory(), (profile) => {
    requireSession(profile, event.cookies, true);
    if (!profile.passkeys.length) throw error(409, 'Nejdřív vytvoř passkey.');
    profile.grants = {};
    profile.challenges = {};
    profile.generation += 1;
    return { recoveryCode: rotateRecoveryCode(profile) };
  });
}

export async function logoutAll(event: RequestEvent) {
  await clearSession(event.cookies, true);
  clearCookie(event.cookies, 'enrollment');
  clearCookie(event.cookies, 'challenge');
  return { authenticated: false };
}
