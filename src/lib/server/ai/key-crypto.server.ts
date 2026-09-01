import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

import { parseEncryptionMasterKey, validKeyId } from './key-policy.ts';

const COOKIE_VERSION = 'v3';
const PURPOSE = 'fritz:ai-key-cookie';
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60_000;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const MAX_COOKIE_LENGTH = 4_096;

export type StoredKeyOptions = {
  kid?: string;
  now?: Date;
  maxAgeMs?: number;
};

function encryptionKey(secret: string): Buffer {
  const parsed = parseEncryptionMasterKey(secret);
  if (!parsed) throw new Error('AI key encryption master key must encode exactly 32 bytes.');
  return Buffer.from(
    hkdfSync('sha256', parsed.bytes, Buffer.alloc(0), Buffer.from(PURPOSE, 'utf8'), 32),
  );
}

export function keyIdForSecret(secret: string): string {
  return createHash('sha256').update(encryptionKey(secret)).digest('hex').slice(0, 12);
}

function encode(value: Buffer): string {
  return value.toString('base64url');
}

function decode(value: string, expectedLength?: number): Buffer | undefined {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return undefined;
  const decoded = Buffer.from(value, 'base64url');
  // Node accepts non-canonical base64url encodings whose unused trailing bits
  // decode to the same bytes. Reject them so every textual envelope mutation is
  // unambiguously detected instead of occasionally surviving a tamper test.
  if (decoded.toString('base64url') !== value) return undefined;
  if (expectedLength !== undefined && decoded.length !== expectedLength) return undefined;
  return decoded;
}

function aad(kid: string, issuedAt: number, expiresAt: number): Buffer {
  return Buffer.from(`${COOKIE_VERSION}|${kid}|${issuedAt}|${expiresAt}|${PURPOSE}`, 'utf8');
}

export function encryptStoredApiKey(
  apiKey: string,
  secret: string,
  options: StoredKeyOptions = {},
): string {
  const now = options.now ?? new Date();
  const issuedAt = now.getTime();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  if (!Number.isSafeInteger(issuedAt) || maxAgeMs <= 0 || maxAgeMs > DEFAULT_MAX_AGE_MS) {
    throw new Error('AI key cookie lifetime is invalid.');
  }
  const expiresAt = issuedAt + maxAgeMs;
  const kid = options.kid ?? keyIdForSecret(secret);
  if (!validKeyId(kid)) throw new Error('AI key encryption key ID is invalid.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  cipher.setAAD(aad(kid, issuedAt, expiresAt));
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const result = [
    COOKIE_VERSION,
    kid,
    String(issuedAt),
    String(expiresAt),
    encode(iv),
    encode(tag),
    encode(encrypted),
  ].join('.');
  if (result.length > MAX_COOKIE_LENGTH) throw new Error('AI key is too large to store safely.');
  return result;
}

export function decryptStoredApiKey(
  value: string,
  secrets: string | Readonly<Record<string, string>>,
  now = new Date(),
): string | undefined {
  if (!value || value.length > MAX_COOKIE_LENGTH) return undefined;
  try {
    const [version, kid, issuedValue, expiresValue, ivValue, tagValue, encryptedValue, extra] =
      value.split('.');
    if (
      version !== COOKIE_VERSION ||
      !validKeyId(kid) ||
      !issuedValue ||
      !expiresValue ||
      !ivValue ||
      !tagValue ||
      !encryptedValue ||
      extra
    ) {
      return undefined;
    }
    const issuedAt = Number(issuedValue);
    const expiresAt = Number(expiresValue);
    const nowMs = now.getTime();
    if (
      !Number.isSafeInteger(issuedAt) ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= issuedAt ||
      expiresAt - issuedAt > DEFAULT_MAX_AGE_MS ||
      issuedAt > nowMs + MAX_CLOCK_SKEW_MS ||
      expiresAt <= nowMs
    ) {
      return undefined;
    }
    const secret = typeof secrets === 'string' ? secrets : secrets[kid];
    if (!secret) return undefined;
    if (typeof secrets === 'string' && keyIdForSecret(secret) !== kid) return undefined;
    const iv = decode(ivValue, 12);
    const tag = decode(tagValue, 16);
    const encrypted = decode(encryptedValue);
    if (!iv || !tag || !encrypted || encrypted.length === 0 || encrypted.length > 1_024) {
      return undefined;
    }
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), iv);
    decipher.setAAD(aad(kid, issuedAt, expiresAt));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      'utf8',
    );
    return plaintext.length > 0 && plaintext.length <= 500 ? plaintext : undefined;
  } catch {
    return undefined;
  }
}
