import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultSettings, migrateSettings } from '../src/lib/domain/settings/defaults.ts';
import {
  assertValidSettings,
  isValidExerciseMix,
  hasUniversalExercise,
  isValidExercisePreferences,
} from '../src/lib/domain/settings/validation.ts';

test('výchozí nastavení odpovídá produktovým limitům', () => {
  const settings = createDefaultSettings(new Date('2026-08-04T12:00:00.000Z'));
  assert.doesNotThrow(() => assertValidSettings(settings));
  assert.equal(isValidExerciseMix(settings.exerciseMix), true);
  assert.equal(isValidExercisePreferences(settings.exercisePreferences), true);
  assert.equal(settings.accentTheme, 'green');
  assert.equal(settings.grammarLevel, 'A1.1');
  assert.equal(settings.motherTongue, 'cs');
  assert.equal(settings.rivalryEnabled, true);
  assert.equal(settings.schemaVersion, 9);
  assert.equal(settings.onboardingCompleted, false);
  assert.equal(settings.learningGoal, 'school');
  assert.equal(settings.dailyMinutes, 10);
  assert.deepEqual(settings.favoriteCoachScenarioIds, []);
  assert.deepEqual(settings.favoriteStoryBookIds, []);
  assert.equal(settings.trainingSourceFilter, 'all');
});

test('oblíbené položky se migrují bez duplicit a s bezpečným limitem', () => {
  const migrated = migrateSettings({
    ...createDefaultSettings(),
    schemaVersion: 8,
    favoriteCoachScenarioIds: ['coffee', 'coffee', '', 42, ' interview '],
    favoriteStoryBookIds: ['a1-maerchen', 'a1-maerchen', 'unknown-book', 'x'.repeat(201)],
  } as unknown as Record<string, unknown>);

  assert.deepEqual(migrated.favoriteCoachScenarioIds, ['coffee', 'interview']);
  assert.deepEqual(migrated.favoriteStoryBookIds, ['a1-maerchen']);
  assert.doesNotThrow(() => assertValidSettings(migrated));
});

test('staré nastavení začne česky a podporovanou mateřštinu zachová', () => {
  const source = { ...createDefaultSettings(), schemaVersion: 6 } as Record<string, unknown>;
  delete source.motherTongue;

  assert.equal(migrateSettings(source).motherTongue, 'cs');
  assert.equal(migrateSettings({ ...source, motherTongue: 'en' }).motherTongue, 'en');
  assert.equal(migrateSettings({ ...source, motherTongue: 'de' }).motherTongue, 'cs');
});

test('už existující profil nevrací migrace do onboardingu', () => {
  const legacy = { ...createDefaultSettings(), schemaVersion: 7 } as Record<string, unknown>;
  delete legacy.onboardingCompleted;
  delete legacy.dailyMinutes;
  delete legacy.learningGoal;

  const migrated = migrateSettings(legacy);
  assert.equal(migrated.onboardingCompleted, true);
  assert.equal(migrated.dailyMinutes, 10);
  assert.equal(migrated.learningGoal, 'school');
});

test('podrobná úroveň se zachová a stará data bezpečně začínají od A1.1', () => {
  const source = { ...createDefaultSettings() } as Record<string, unknown>;
  delete source.grammarLevel;

  assert.equal(migrateSettings(source).grammarLevel, 'A1.1');
  assert.equal(migrateSettings({ ...source, grammarLevel: 'B1.2' }).grammarLevel, 'B1.2');
  assert.equal(migrateSettings({ ...source, grammarLevel: 'B3.9' }).grammarLevel, 'A1.1');
});

test('staré nastavení bezpečně doplní soukromý AI duel', () => {
  const source = { ...createDefaultSettings() } as Record<string, unknown>;
  delete source.rivalryEnabled;
  assert.equal(migrateSettings(source).rivalryEnabled, true);
  assert.equal(migrateSettings({ ...source, rivalryEnabled: false }).rivalryEnabled, false);
});

test('starší nastavení doplní filtr původu a podporovanou volbu zachová', () => {
  const source = { ...createDefaultSettings(), schemaVersion: 5 } as Record<string, unknown>;
  delete source.trainingSourceFilter;

  assert.equal(migrateSettings(source).trainingSourceFilter, 'all');
  assert.equal(
    migrateSettings({ ...source, trainingSourceFilter: 'without-course' }).trainingSourceFilter,
    'without-course',
  );
  assert.equal(
    migrateSettings({ ...source, trainingSourceFilter: 'neplatný-filtr' }).trainingSourceFilter,
    'all',
  );
});

test('barevný akcent se migruje bezpečně a zachová podporovanou volbu', () => {
  for (const accentTheme of ['green', 'moss', 'magenta', 'rose', 'blue', 'teal'] as const) {
    assert.equal(
      migrateSettings({ ...createDefaultSettings(), accentTheme }).accentTheme,
      accentTheme,
    );
  }
  assert.equal(
    migrateSettings({
      ...createDefaultSettings(),
      accentTheme: 'neon',
    } as unknown as Record<string, unknown>).accentTheme,
    'green',
  );
});

test('migrace ořeže nebezpečně vysoké hodnoty a neplatný mix vrátí na výchozí', () => {
  const migrated = migrateSettings({
    ...createDefaultSettings(),
    profileName: `  ${'K'.repeat(80)}  `,
    desiredRetention: Number.POSITIVE_INFINITY,
    dailyNewLimit: 999,
    dailyGoal: -10,
    exerciseMix: { typing: 99, choice: 99, flashcard: 99 },
  });

  assert.equal(migrated.profileName.length, 50);
  assert.equal(migrated.desiredRetention, 0.9);
  assert.equal(migrated.dailyNewLimit, 30);
  assert.equal(migrated.dailyGoal, 5);
  assert.deepEqual(migrated.exerciseMix, { typing: 60, choice: 20, flashcard: 20 });
});

test('uložení odmítne desetinný mix nebo hodnotu mimo podporovaný rozsah', () => {
  const settings = createDefaultSettings();
  assert.throws(
    () =>
      assertValidSettings({
        ...settings,
        exerciseMix: { typing: 60.5, choice: 19.5, flashcard: 20 },
      }),
    /celá čísla/iu,
  );
  assert.throws(() => assertValidSettings({ ...settings, dailyGoal: 201 }), /Denní cíl/iu);
});

test('starý mix se převede na přepínače a zapne nové kontextové úlohy', () => {
  const migrated = migrateSettings({
    ...createDefaultSettings(),
    schemaVersion: 2,
    exerciseMix: { typing: 100, choice: 0, flashcard: 0 },
    exercisePreferences: undefined,
  } as unknown as Record<string, unknown>);

  assert.deepEqual(migrated.exercisePreferences, {
    typing: true,
    choice: false,
    flashcard: false,
    wordOrder: true,
    cloze: true,
    sentence: true,
    matching: true,
    speaking: true,
  });
});

test('vypnutí všech úloh se při migraci bezpečně vrátí na výchozí volbu', () => {
  const migrated = migrateSettings({
    ...createDefaultSettings(),
    exercisePreferences: {
      typing: false,
      choice: false,
      flashcard: false,
      wordOrder: false,
      cloze: false,
      sentence: false,
      matching: false,
      speaking: false,
    },
  });

  assert.equal(isValidExercisePreferences(migrated.exercisePreferences), true);
  assert.equal(migrated.exercisePreferences.typing, true);
});

test('kontextové bonusy bez univerzální úlohy se nedají uložit jako jediný režim', () => {
  const sentenceOnly = {
    typing: false,
    choice: false,
    flashcard: false,
    wordOrder: false,
    cloze: false,
    sentence: true,
    matching: true,
    speaking: false,
  };

  assert.equal(hasUniversalExercise(sentenceOnly), false);
  assert.equal(isValidExercisePreferences(sentenceOnly), false);
  assert.throws(
    () => assertValidSettings({ ...createDefaultSettings(), exercisePreferences: sentenceOnly }),
    /psaní, mluvení, kartičku nebo doplňovačku/iu,
  );
});

test('mluvení zůstává bezpečným režimem díky ručně upravitelnému přepisu', () => {
  assert.equal(
    isValidExercisePreferences({
      typing: false,
      choice: false,
      flashcard: false,
      wordOrder: false,
      cloze: false,
      sentence: false,
      matching: false,
      speaking: true,
    }),
    true,
  );
});
