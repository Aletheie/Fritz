const BASE64URL_KEY = /^[A-Za-z0-9_-]{43}$/u;
const HEX_KEY = /^[A-Fa-f0-9]{64}$/u;

export type ParsedMasterKey = {
  bytes: Buffer;
  encoding: 'base64url' | 'hex';
};

/** Accepts exactly 32 encoded random bytes; arbitrary long passphrases are deliberately rejected. */
export function parseEncryptionMasterKey(
  rawValue: string | undefined,
): ParsedMasterKey | undefined {
  if (rawValue !== rawValue?.trim()) return undefined;
  const value = rawValue;
  if (!value || /\s/u.test(value)) return undefined;
  if (HEX_KEY.test(value)) return { bytes: Buffer.from(value, 'hex'), encoding: 'hex' };
  if (BASE64URL_KEY.test(value)) {
    const bytes = Buffer.from(value, 'base64url');
    return bytes.length === 32 ? { bytes, encoding: 'base64url' } : undefined;
  }
  return undefined;
}

export function isUsableEncryptionSecret(rawValue: string | undefined): boolean {
  return parseEncryptionMasterKey(rawValue) !== undefined;
}

export function validKeyId(value: string | undefined): value is string {
  return Boolean(value && /^[a-z0-9][a-z0-9_-]{0,31}$/u.test(value));
}
