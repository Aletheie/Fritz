import { localizedError } from '../../domain/errors.ts';
import { migrateSettings } from '../../domain/settings/defaults.ts';
import { assertValidSettings } from '../../domain/settings/validation.ts';
import { mutateSettingsAndDeck } from '../db.ts';

import type { AppSettings, Deck } from '../../domain/types.ts';

export async function saveSettings(
  patch: Partial<AppSettings>,
  deckId?: string,
): Promise<{ settings: AppSettings; deck?: Deck }> {
  return mutateSettingsAndDeck(deckId, ({ settings, deck }) => {
    if (!settings)
      throw localizedError(
        'Nastavení už v lokální databázi není dostupné.',
        'Settings are no longer available in the local database.',
      );
    const updatedAt = new Date().toISOString();
    const nextSettings = migrateSettings({
      ...settings,
      ...patch,
      key: 'app',
      createdAt: settings.createdAt,
      updatedAt,
    });
    assertValidSettings(nextSettings);
    const nextDeck = deck
      ? {
          ...deck,
          desiredRetention: nextSettings.desiredRetention,
          dailyNewLimit: nextSettings.dailyNewLimit,
          exerciseMix: nextSettings.exerciseMix,
          updatedAt,
        }
      : undefined;
    return {
      settings: nextSettings,
      deck: nextDeck,
      result: { settings: nextSettings, deck: nextDeck },
    };
  });
}
