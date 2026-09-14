import assert from 'node:assert/strict';
import test from 'node:test';

import { createSeedData } from '../src/lib/data/seed.ts';
import {
  createBackupPreview,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
} from '../src/lib/domain/backup/encrypted.ts';
import { createBackupFile, MAX_BACKUP_FILE_BYTES } from '../src/lib/domain/backup/file.ts';
import { parseBackup } from '../src/lib/domain/backup/validate.ts';
import { createCourseProgress } from '../src/lib/domain/course/grammar.ts';
import { backupWithLongHistory } from './fixtures/large-backup.ts';

import type { AppBackup } from '../src/lib/domain/types.ts';

function validBackup(): AppBackup {
  const now = new Date('2026-08-07T12:00:00.000Z');
  const seed = createSeedData(now);
  return {
    schemaVersion: 8 as const,
    exportedAt: now.toISOString(),
    decks: [seed.deck],
    notes: seed.notes,
    cards: seed.cards,
    reviews: [],
    learningEvidence: [],
    settings: seed.settings,
    course: createCourseProgress(now),
  };
}

const passphrase = 'správná dlouhá testovací fráze';

function bytesBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

async function legacyEncryptedBackup(backup: AppBackup): Promise<Record<string, unknown>> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header = {
    format: 'wortly-encrypted-backup',
    version: 1,
    kdf: { name: 'PBKDF2-SHA-256', salt: encodeBase64Url(salt), iterations: 310_000 },
    cipher: { name: 'AES-256-GCM', iv: encodeBase64Url(iv) },
    createdAt: backup.exportedAt,
    appVersion: '0.5.0',
  };
  const material = await crypto.subtle.importKey(
    'raw',
    bytesBuffer(new TextEncoder().encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bytesBuffer(salt), iterations: 310_000 },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: bytesBuffer(iv),
      additionalData: bytesBuffer(new TextEncoder().encode(JSON.stringify(header))),
      tagLength: 128,
    },
    key,
    bytesBuffer(new TextEncoder().encode(JSON.stringify(backup))),
  );
  return { ...header, ciphertext: encodeBase64Url(new Uint8Array(ciphertext)) };
}

test('šifrovaná záloha projde AES-GCM roundtripem a validací obsahu', async () => {
  const backup = validBackup();
  const envelope = await encryptBackup(backup, passphrase, 'test-version');
  const restored = await decryptBackup(envelope, passphrase);

  assert.equal(isEncryptedBackup(envelope), true);
  assert.equal(envelope.format, 'fritz-encrypted-backup');
  assert.equal(envelope.version, 1);
  assert.equal(envelope.kdf.salt.includes('='), false);
  assert.deepEqual(restored.notes, parseBackup(backup).notes);
  assert.deepEqual(restored.cards, parseBackup(backup).cards);
});

test('šifrovaná záloha vytvořená před přejmenováním zůstává čitelná', async () => {
  const backup = validBackup();
  const envelope = await legacyEncryptedBackup(backup);

  assert.equal(isEncryptedBackup(envelope), true);
  assert.deepEqual((await decryptBackup(envelope, passphrase)).notes, parseBackup(backup).notes);
});

test('nesprávné heslo ani změněný ciphertext nevrátí obsah zálohy', async () => {
  const envelope = await encryptBackup(validBackup(), passphrase);
  const first = envelope.ciphertext[0] === 'A' ? 'B' : 'A';
  const tampered = { ...envelope, ciphertext: `${first}${envelope.ciphertext.slice(1)}` };

  await assert.rejects(() => decryptBackup(envelope, 'jiná dostatečně dlouhá fráze'), /ověřit/u);
  await assert.rejects(() => decryptBackup(tampered, passphrase), /ověřit/u);
});

test('nekanonický base64url zápis ciphertextu je odmítnut', async () => {
  const envelope = await encryptBackup(validBackup(), passphrase);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const canonicalIndex = alphabet.indexOf(envelope.ciphertext.at(-1) ?? '');
  const remainder = envelope.ciphertext.length % 4;
  const unusedBits = remainder === 2 ? 4 : remainder === 3 ? 2 : 0;

  if (unusedBits === 0) return;
  const alternateIndex = canonicalIndex | 1;
  assert.notEqual(alternateIndex, canonicalIndex);
  const nonCanonical = {
    ...envelope,
    ciphertext: `${envelope.ciphertext.slice(0, -1)}${alphabet[alternateIndex]}`,
  };

  await assert.rejects(() => decryptBackup(nonCanonical, passphrase), /neplatné pole/u);
});

test('hlavička je součástí AAD a zkrácený envelope je odmítnut', async () => {
  const envelope = await encryptBackup(validBackup(), passphrase, '1.0.0');
  const changedHeader = { ...envelope, appVersion: '2.0.0' };
  const truncated = { ...envelope, ciphertext: envelope.ciphertext.slice(0, 8) };

  await assert.rejects(() => decryptBackup(changedHeader, passphrase), /ověřit/u);
  await assert.rejects(() => decryptBackup(truncated, passphrase), /velikost/u);
});

test('preview je validovaný a ukáže počty i rozdíl bez změny databáze', () => {
  const backup = validBackup();
  const evidence = {
    id: 'evidence_preview',
    operationId: 'operation_preview',
    source: 'listening-dictation' as const,
    sourceId: 'chapter-1',
    skillIds: ['listening:chapter-1'],
    occurredAt: backup.exportedAt,
    localDay: '2026-08-07',
    mode: 'long-term' as const,
    modality: 'dictation' as const,
    outcome: 'correct' as const,
    hintsUsed: 0,
    responseMs: 1_000,
    independent: true,
  };
  backup.learningEvidence = [evidence];
  const current = {
    ...backup,
    notes: backup.notes.slice(0, 1),
    cards: backup.cards.slice(0, 1),
    learningEvidence: [],
  };
  const preview = createBackupPreview(backup, current);

  assert.equal(preview.schemaVersion, 8);
  assert.equal(preview.notes, backup.notes.length);
  assert.equal(preview.learningEvidence, 1);
  assert.equal(preview.currentDifference?.notes, backup.notes.length - 1);
  assert.equal(preview.currentDifference?.learningEvidence, 1);
  assert.throws(() => createBackupPreview({ ...backup, cards: [] }), /studijní kartu/iu);
});

test('krátká passphrase je odmítnuta před odvozením klíče', async () => {
  await assert.rejects(() => encryptBackup(validBackup(), 'krátké'), /alespoň 10/u);
});

test('an encrypted download larger than the old 10 MB import limit remains restorable', async () => {
  const backup = backupWithLongHistory();
  const file = createBackupFile(await encryptBackup(backup, passphrase));
  assert.ok(file.size > 10_000_000);
  assert.ok(file.size <= MAX_BACKUP_FILE_BYTES);
  const restored = await decryptBackup(JSON.parse(await file.text()), passphrase);
  assert.deepEqual(restored, parseBackup(backup));
});

test('the download limit counts serialized UTF-8 bytes and rejects files the importer cannot accept', () => {
  const backup = validBackup();
  backup.settings.profileName = '';
  const emptyFileSize = createBackupFile(backup).size;
  // Exercise the file boundary independently of the backup schema's per-field limits.
  const paddingBytes = MAX_BACKUP_FILE_BYTES - emptyFileSize;
  backup.settings.profileName =
    'ü'.repeat(Math.floor(paddingBytes / 2)) + 'x'.repeat(paddingBytes % 2);
  assert.equal(createBackupFile(backup).size, MAX_BACKUP_FILE_BYTES);
  backup.settings.profileName += 'x';
  assert.throws(() => createBackupFile(backup), /48 MiB/u);
});
