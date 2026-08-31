import { parseBackup } from './validate.ts';

import type { AppBackup } from '../types.ts';

const FORMAT = 'fritz-encrypted-backup';
const LEGACY_FORMAT = 'wortly-encrypted-backup';
const VERSION = 1;
const KDF_ITERATIONS = 310_000;
const MIN_KDF_ITERATIONS = 210_000;
const MAX_KDF_ITERATIONS = 2_000_000;
const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;
const MAX_PASSPHRASE_LENGTH = 1_024;

export type EncryptedBackupEnvelope = {
  format: typeof FORMAT | typeof LEGACY_FORMAT;
  version: typeof VERSION;
  kdf: {
    name: 'PBKDF2-SHA-256';
    salt: string;
    iterations: number;
  };
  cipher: {
    name: 'AES-256-GCM';
    iv: string;
  };
  createdAt: string;
  appVersion: string;
  ciphertext: string;
};

export type BackupPreview = {
  exportedAt: string;
  schemaVersion: number;
  decks: number;
  notes: number;
  cards: number;
  reviews: number;
  learningEvidence: number;
  coursePathEvents: number;
  currentDifference?: {
    notes: number;
    cards: number;
    reviews: number;
    learningEvidence: number;
  };
};

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Šifrování zálohy není v tomto prostředí dostupné.');
  }
  return globalThis.crypto;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function assertPassphrase(passphrase: string): void {
  if (passphrase.trim().length < 10 || passphrase.length > MAX_PASSPHRASE_LENGTH) {
    throw new Error('Heslo zálohy musí mít alespoň 10 a nejvýše 1 024 znaků.');
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

function decodeBase64Url(value: string, label: string, expectedLength?: number): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value) || value.length > MAX_ENVELOPE_BYTES * 2) {
    throw new Error(`Šifrovaná záloha má neplatné pole „${label}“.`);
  }
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(value.replace(/-/gu, '+').replace(/_/gu, '/') + padding);
  } catch {
    throw new Error(`Šifrovaná záloha má neplatné pole „${label}“.`);
  }
  if (expectedLength !== undefined && binary.length !== expectedLength) {
    throw new Error(`Šifrovaná záloha má neplatné pole „${label}“.`);
  }
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index);
  // Base64url can otherwise accept alternate final characters whose unused bits
  // decode to the same bytes. Requiring the canonical spelling makes every
  // serialized envelope representation unambiguous and tamper-evident.
  if (encodeBase64Url(result) !== value) {
    throw new Error(`Šifrovaná záloha má neplatné pole „${label}“.`);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireShortString(record: Record<string, unknown>, key: string, maxLength = 500): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`Šifrovaná záloha má neplatné pole „${key}“.`);
  }
  return value;
}

function parseEnvelope(value: unknown): EncryptedBackupEnvelope {
  if (
    !isRecord(value) ||
    (value.format !== FORMAT && value.format !== LEGACY_FORMAT) ||
    value.version !== VERSION
  ) {
    throw new Error('Soubor není podporovaná šifrovaná záloha aplikace Fritz.');
  }
  if (!isRecord(value.kdf) || !isRecord(value.cipher)) {
    throw new Error('Šifrovaná záloha má neplatnou kryptografickou hlavičku.');
  }
  if (value.kdf.name !== 'PBKDF2-SHA-256' || value.cipher.name !== 'AES-256-GCM') {
    throw new Error('Šifrovaná záloha používá nepodporovanou kryptografickou sadu.');
  }
  const iterations = value.kdf.iterations;
  if (
    typeof iterations !== 'number' ||
    !Number.isInteger(iterations) ||
    iterations < MIN_KDF_ITERATIONS ||
    iterations > MAX_KDF_ITERATIONS
  ) {
    throw new Error('Šifrovaná záloha má neplatnou sílu odvození klíče.');
  }
  const createdAt = requireShortString(value, 'createdAt', 100);
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error('Šifrovaná záloha má neplatné datum vytvoření.');
  }
  const envelope: EncryptedBackupEnvelope = {
    format: value.format,
    version: VERSION,
    kdf: {
      name: 'PBKDF2-SHA-256',
      salt: requireShortString(value.kdf, 'salt', 100),
      iterations,
    },
    cipher: {
      name: 'AES-256-GCM',
      iv: requireShortString(value.cipher, 'iv', 100),
    },
    createdAt,
    appVersion: requireShortString(value, 'appVersion', 100),
    ciphertext: requireShortString(value, 'ciphertext', MAX_ENVELOPE_BYTES * 2),
  };
  decodeBase64Url(envelope.kdf.salt, 'salt', 16);
  decodeBase64Url(envelope.cipher.iv, 'iv', 12);
  const ciphertext = decodeBase64Url(envelope.ciphertext, 'ciphertext');
  if (ciphertext.byteLength < 17 || ciphertext.byteLength > MAX_ENVELOPE_BYTES) {
    throw new Error('Šifrovaná záloha má neplatnou velikost ciphertextu.');
  }
  return envelope;
}

function authenticatedHeader(envelope: Omit<EncryptedBackupEnvelope, 'ciphertext'>): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      format: envelope.format,
      version: envelope.version,
      kdf: envelope.kdf,
      cipher: envelope.cipher,
      createdAt: envelope.createdAt,
      appVersion: envelope.appVersion,
    }),
  );
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const api = cryptoApi();
  const material = await api.subtle.importKey(
    'raw',
    asArrayBuffer(new TextEncoder().encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return api.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: asArrayBuffer(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isEncryptedBackup(value: unknown): boolean {
  return isRecord(value) && (value.format === FORMAT || value.format === LEGACY_FORMAT);
}

export function createBackupPreview(value: unknown, current?: AppBackup): BackupPreview {
  const backup = parseBackup(value);
  return {
    exportedAt: backup.exportedAt,
    schemaVersion: backup.schemaVersion,
    decks: backup.decks.length,
    notes: backup.notes.length,
    cards: backup.cards.length,
    reviews: backup.reviews.length,
    learningEvidence: backup.learningEvidence.length,
    coursePathEvents: backup.course.pathEvents.length,
    currentDifference: current
      ? {
          notes: backup.notes.length - current.notes.length,
          cards: backup.cards.length - current.cards.length,
          reviews: backup.reviews.length - current.reviews.length,
          learningEvidence: backup.learningEvidence.length - current.learningEvidence.length,
        }
      : undefined,
  };
}

export async function encryptBackup(
  value: unknown,
  passphrase: string,
  appVersion = 'development',
): Promise<EncryptedBackupEnvelope> {
  assertPassphrase(passphrase);
  const backup = parseBackup(value);
  const plaintext = new TextEncoder().encode(JSON.stringify(backup));
  if (plaintext.byteLength > MAX_ENVELOPE_BYTES - 16) {
    throw new Error('Záloha je pro šifrovaný export příliš velká.');
  }
  const salt = cryptoApi().getRandomValues(new Uint8Array(16));
  const iv = cryptoApi().getRandomValues(new Uint8Array(12));
  const header: Omit<EncryptedBackupEnvelope, 'ciphertext'> = {
    format: FORMAT,
    version: VERSION,
    kdf: { name: 'PBKDF2-SHA-256', salt: encodeBase64Url(salt), iterations: KDF_ITERATIONS },
    cipher: { name: 'AES-256-GCM', iv: encodeBase64Url(iv) },
    createdAt: backup.exportedAt,
    appVersion: appVersion.slice(0, 100) || 'unknown',
  };
  const key = await deriveKey(passphrase, salt, header.kdf.iterations);
  const ciphertext = await cryptoApi().subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: asArrayBuffer(iv),
      additionalData: asArrayBuffer(authenticatedHeader(header)),
      tagLength: 128,
    },
    key,
    asArrayBuffer(plaintext),
  );
  return { ...header, ciphertext: encodeBase64Url(new Uint8Array(ciphertext)) };
}

export async function decryptBackup(value: unknown, passphrase: string): Promise<AppBackup> {
  assertPassphrase(passphrase);
  const envelope = parseEnvelope(value);
  const salt = decodeBase64Url(envelope.kdf.salt, 'salt', 16);
  const iv = decodeBase64Url(envelope.cipher.iv, 'iv', 12);
  const ciphertext = decodeBase64Url(envelope.ciphertext, 'ciphertext');
  const { ciphertext: _ciphertext, ...header } = envelope;
  const key = await deriveKey(passphrase, salt, envelope.kdf.iterations);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await cryptoApi().subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: asArrayBuffer(iv),
        additionalData: asArrayBuffer(authenticatedHeader(header)),
        tagLength: 128,
      },
      key,
      asArrayBuffer(ciphertext),
    );
  } catch {
    throw new Error('Zálohu nelze ověřit. Heslo je nesprávné nebo byl soubor změněn.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
  } catch {
    throw new Error('Dešifrovaná záloha nemá platný formát.');
  }
  return parseBackup(parsed);
}
