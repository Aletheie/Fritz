import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

import { parseEncryptionMasterKey } from './key-policy.ts';

import type { RequestEvent } from '@sveltejs/kit';

const SESSION_COOKIE = 'wortly_ai_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function sessionSecret(): Buffer | undefined {
  return parseEncryptionMasterKey(env.AI_ANONYMOUS_SESSION_SECRET)?.bytes;
}

function sign(value: string, secret: Buffer): string {
  return createHmac('sha256', secret).update(`wortly:ai-session:${value}`).digest('base64url');
}

function validSession(value: string | undefined, secret: Buffer): string | undefined {
  if (!value) return undefined;
  const [id, signature, extra] = value.split('.');
  if (!id || !signature || extra || !/^[A-Za-z0-9_-]{22}$/u.test(id)) return undefined;
  const expected = Buffer.from(sign(id, secret));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : undefined;
}

export function resolveAiPrincipal(event: RequestEvent): string | undefined {
  const secret = sessionSecret();
  if (!secret) return undefined;
  const existing = validSession(event.cookies.get(SESSION_COOKIE), secret);
  const id = existing ?? randomBytes(16).toString('base64url');
  if (!existing) {
    event.cookies.set(SESSION_COOKIE, `${id}.${sign(id, secret)}`, {
      path: '/api/ai',
      httpOnly: true,
      secure: event.url.protocol === 'https:',
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE,
    });
  }
  return `anonymous:${id}`;
}
