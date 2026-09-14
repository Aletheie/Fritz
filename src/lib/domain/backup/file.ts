import type { AppBackup } from '../types.ts';
import type { EncryptedBackupEnvelope } from './encrypted.ts';

// A 32 MiB ciphertext needs about 43 MiB as base64url, plus its JSON header.
export const MAX_BACKUP_FILE_BYTES = 48 * 1024 * 1024;

export function createBackupFile(value: AppBackup | EncryptedBackupEnvelope): Blob {
  const file = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  if (file.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error('Záloha je příliš velká. Limit je 48 MiB.');
  }
  return file;
}
