import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { parseEncryptionMasterKey } from './key-policy.ts';

const PURPOSE = 'fritz:ai-profile:v1';
function key(secret: string): Buffer {
  const parsed = parseEncryptionMasterKey(secret);
  if (!parsed) throw new Error('Neplatný šifrovací klíč osobního profilu.');
  return Buffer.from(hkdfSync('sha256', parsed.bytes, Buffer.alloc(0), Buffer.from(PURPOSE), 32));
}
function identity(value: Buffer) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}
function aad(accountId: string, kid: string) {
  return Buffer.from(`${PURPOSE}|${accountId}|${kid}`);
}

export function encryptAiProfile(plaintext: string, secret: string, accountId: string): string {
  if (!plaintext || Buffer.byteLength(plaintext) > 8_192)
    throw new Error('AI připojení je příliš velké.');
  const encryptionKey = key(secret);
  const kid = identity(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  cipher.setAAD(aad(accountId, kid));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    'p1',
    kid,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptAiProfile(
  envelope: string,
  secret: string,
  accountId: string,
): string | undefined {
  try {
    if (envelope.length > 16_384) return undefined;
    const [version, kid, ...encoded] = envelope.split('.');
    const encryptionKey = key(secret);
    if (version !== 'p1' || kid !== identity(encryptionKey) || encoded.length !== 3)
      return undefined;
    const decoded = encoded.map((value) => Buffer.from(value, 'base64url'));
    if (decoded.some((value, index) => value.toString('base64url') !== encoded[index]))
      return undefined;
    const [iv, tag, ciphertext] = decoded;
    if (iv.length !== 12 || tag.length !== 16 || !ciphertext.length || ciphertext.length > 8_192)
      return undefined;
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAAD(aad(accountId, kid));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return undefined;
  }
}
