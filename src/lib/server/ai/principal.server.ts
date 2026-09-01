import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

import { parseEncryptionMasterKey } from './key-policy.ts';

import type { RequestEvent } from '@sveltejs/kit';

const SESSION_COOKIE = 'fritz_ai_session';
const LEGACY_SESSION_COOKIE = 'wortly_ai_session';
const SIGNING_PURPOSE = 'fritz:ai-session';
const LEGACY_SIGNING_PURPOSE = 'wortly:ai-session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function sessionSecret(): Buffer | undefined {
  return parseEncryptionMasterKey(env.AI_ANONYMOUS_SESSION_SECRET)?.bytes;
}

function sign(value: string, secret: Buffer, purpose = SIGNING_PURPOSE): string {
  return createHmac('sha256', secret).update(`${purpose}:${value}`).digest('base64url');
}

function validSession(
  value: string | undefined,
  secret: Buffer,
  purpose = SIGNING_PURPOSE,
): string | undefined {
  if (!value) return undefined;
  const [id, signature, extra] = value.split('.');
  if (!id || !signature || extra || !/^[A-Za-z0-9_-]{22}$/u.test(id)) return undefined;
  const expected = Buffer.from(sign(id, secret, purpose));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : undefined;
}

export function resolveAiPrincipal(event: RequestEvent): string | undefined {
  const secret = sessionSecret();
  if (!secret) return undefined;
  const existing = validSession(event.cookies.get(SESSION_COOKIE), secret);
  const legacy = existing
    ? undefined
    : validSession(event.cookies.get(LEGACY_SESSION_COOKIE), secret, LEGACY_SIGNING_PURPOSE);
  const id = existing ?? legacy ?? randomBytes(16).toString('base64url');
  if (!existing || legacy) {
    event.cookies.set(SESSION_COOKIE, `${id}.${sign(id, secret)}`, {
      path: '/api/ai',
      httpOnly: true,
      secure: event.url.protocol === 'https:',
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE,
    });
    event.cookies.delete(LEGACY_SESSION_COOKIE, { path: '/api/ai' });
  }
  return `anonymous:${id}`;
}
