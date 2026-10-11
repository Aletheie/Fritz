import { get } from 'svelte/store';
import {
  exportBackup,
  resetToSeed,
  restoreBackup,
  rollbackLastDestructiveChange,
  saveSettings,
} from '../../data/repository.ts';
import {
  createBackupPreview,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
} from '../../domain/backup/encrypted.ts';
import { localizedError } from '../../domain/errors.ts';
import { showSnapshot, state } from './core.ts';

import type { BackupPreview, EncryptedBackupEnvelope } from '../../domain/backup/encrypted.ts';
import type { AppBackup, AppSettings } from '../../domain/types.ts';

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = get(state);
  if (!current.settings)
    throw localizedError('Nastavení ještě není načtené.', 'Settings have not loaded yet.');
  const result = await saveSettings(patch, current.decks[0]?.id);
  state.update((value) => ({
    ...value,
    settings: result.settings,
    decks: result.deck
      ? value.decks.map((deck) => (deck.id === result.deck?.id ? result.deck : deck))
      : value.decks,
  }));
}

export async function backup(): Promise<AppBackup> {
  return exportBackup();
}

export async function encryptedBackup(passphrase: string): Promise<EncryptedBackupEnvelope> {
  return encryptBackup(await exportBackup(), passphrase);
}

export async function prepareRestore(
  value: unknown,
  passphrase?: string,
): Promise<{ backup: AppBackup; preview: BackupPreview }> {
  const importedBackup = isEncryptedBackup(value)
    ? await decryptBackup(value, passphrase ?? '')
    : (value as AppBackup);
  const current = await exportBackup();
  return { backup: importedBackup, preview: createBackupPreview(importedBackup, current) };
}

export async function reset(): Promise<void> {
  showSnapshot(await resetToSeed());
}

export async function restore(value: unknown): Promise<void> {
  showSnapshot(await restoreBackup(value));
}

export async function undoDestructiveChange(): Promise<void> {
  showSnapshot(await rollbackLastDestructiveChange());
}
