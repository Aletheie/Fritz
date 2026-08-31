import { isDetailedCefrLevel } from '../levels.ts';
import { storyBookIds } from '../stories/progress.ts';
import {
  SETTINGS_LIMITS,
  isValidAccentTheme,
  isValidExerciseMix,
  isValidExercisePreferences,
} from './validation.ts';

import type { StoryBookId } from '../stories/types.ts';
import type {
  AccentTheme,
  AppSettings,
  DailyMinutes,
  ExamPlan,
  ExerciseMix,
  ExercisePreferences,
  LearningGoal,
  MotherTongue,
  StudyPace,
  TrainingSourceFilter,
} from '../types.ts';

export const CURRENT_SETTINGS_SCHEMA = 9 as const;

export const DEFAULT_EXERCISE_PREFERENCES: ExercisePreferences = {
  typing: true,
  choice: true,
  flashcard: false,
  wordOrder: true,
  cloze: true,
  sentence: true,
  matching: true,
  speaking: true,
};

export function createDefaultSettings(now = new Date()): AppSettings {
  const timestamp = now.toISOString();
  return {
    key: 'app',
    schemaVersion: CURRENT_SETTINGS_SCHEMA,
    motherTongue: 'cs',
    profileName: '',
    grammarLevel: 'A1.1',
    onboardingCompleted: false,
    learningGoal: 'school',
    dailyMinutes: 10,
    favoriteCoachScenarioIds: [],
    favoriteStoryBookIds: [],
    accentTheme: 'green',
    desiredRetention: 0.9,
    dailyNewLimit: 15,
    dailyGoal: 20,
    exerciseMix: { typing: 60, choice: 20, flashcard: 20 },
    exercisePreferences: { ...DEFAULT_EXERCISE_PREFERENCES },
    studyPace: 'guided',
    allowKeyboardFallback: true,
    autoSpeakGerman: false,
    celebrations: true,
    gamificationEnabled: true,
    rivalryEnabled: true,
    requireCorrection: true,
    showKeyboardHints: true,
    showStudyTips: true,
    reduceMotion: false,
    trainingSourceFilter: 'all',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

function migratedMix(value: unknown, fallback: ExerciseMix): ExerciseMix {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const record = value as Partial<ExerciseMix>;
  const candidate: ExerciseMix = {
    typing: finiteNumber(record.typing, Number.NaN),
    choice: finiteNumber(record.choice, Number.NaN),
    flashcard: finiteNumber(record.flashcard, Number.NaN),
  };
  return isValidExerciseMix(candidate) ? candidate : fallback;
}

function booleanPreference(
  record: Partial<ExercisePreferences>,
  key: keyof ExercisePreferences,
  fallback: boolean,
): boolean {
  return typeof record[key] === 'boolean' ? record[key] : fallback;
}

function migratedExercisePreferences(
  value: unknown,
  legacyMix: ExerciseMix,
  fallback: ExercisePreferences,
): ExercisePreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const migrated: ExercisePreferences = {
      typing: legacyMix.typing > 0,
      choice: legacyMix.choice > 0,
      flashcard: legacyMix.flashcard > 0,
      wordOrder: true,
      cloze: true,
      sentence: true,
      matching: true,
      speaking: true,
    };
    return isValidExercisePreferences(migrated) ? migrated : { ...fallback };
  }

  const record = value as Partial<ExercisePreferences>;
  const candidate: ExercisePreferences = {
    typing: booleanPreference(record, 'typing', fallback.typing),
    choice: booleanPreference(record, 'choice', fallback.choice),
    flashcard: booleanPreference(record, 'flashcard', fallback.flashcard),
    wordOrder: booleanPreference(record, 'wordOrder', fallback.wordOrder),
    cloze: booleanPreference(record, 'cloze', fallback.cloze),
    sentence: booleanPreference(record, 'sentence', fallback.sentence),
    matching: booleanPreference(record, 'matching', fallback.matching),
    speaking: booleanPreference(record, 'speaking', fallback.speaking),
  };
  return isValidExercisePreferences(candidate) ? candidate : { ...fallback };
}

function migratedStudyPace(value: unknown, fallback: StudyPace): StudyPace {
  return value === 'focused' || value === 'guided' ? value : fallback;
}

function migratedMotherTongue(value: unknown, fallback: MotherTongue): MotherTongue {
  return value === 'cs' || value === 'en' ? value : fallback;
}

function migratedAccentTheme(value: unknown, fallback: AccentTheme): AccentTheme {
  return isValidAccentTheme(value) ? value : fallback;
}

function migratedDailyMinutes(value: unknown, fallback: DailyMinutes): DailyMinutes {
  return value === 5 || value === 10 || value === 20 ? value : fallback;
}

function migratedLearningGoal(value: unknown, fallback: LearningGoal): LearningGoal {
  return value === 'school' || value === 'memory' || value === 'conversation' ? value : fallback;
}

function migratedExamPlan(value: unknown): ExamPlan | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Partial<ExamPlan>;
  if (
    typeof record.examDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(record.examDate) ||
    Number.isNaN(new Date(`${record.examDate}T12:00:00`).getTime()) ||
    typeof record.tag !== 'string' ||
    record.tag.length > 100 ||
    (record.dailyMinutes !== 5 && record.dailyMinutes !== 10 && record.dailyMinutes !== 20) ||
    typeof record.createdAt !== 'string' ||
    Number.isNaN(new Date(record.createdAt).getTime()) ||
    typeof record.updatedAt !== 'string' ||
    Number.isNaN(new Date(record.updatedAt).getTime())
  ) {
    return undefined;
  }
  return {
    examDate: record.examDate,
    tag: record.tag.trim().slice(0, 100) || 'all',
    dailyMinutes: record.dailyMinutes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function migratedFavoriteIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || id.length > 200 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length === 250) break;
  }
  return result;
}

function migratedTrainingSourceFilter(
  value: unknown,
  fallback: TrainingSourceFilter,
): TrainingSourceFilter {
  return value === 'all' || value === 'own' || value === 'course' || value === 'without-course'
    ? value
    : fallback;
}

export function migrateSettings(value: AppSettings | Record<string, unknown>): AppSettings {
  const defaults = createDefaultSettings();
  const record = value as Partial<AppSettings> & { createdAt?: string; updatedAt?: string };
  const originalSchemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
  const retention = finiteNumber(record.desiredRetention, defaults.desiredRetention);
  const newLimit = finiteNumber(record.dailyNewLimit, defaults.dailyNewLimit);
  const dailyGoal = finiteNumber(record.dailyGoal, defaults.dailyGoal);
  const exerciseMix = migratedMix(record.exerciseMix, defaults.exerciseMix);

  return {
    ...defaults,
    ...record,
    key: 'app',
    schemaVersion: CURRENT_SETTINGS_SCHEMA,
    motherTongue: migratedMotherTongue(record.motherTongue, defaults.motherTongue),
    profileName:
      typeof record.profileName === 'string'
        ? record.profileName.trim().slice(0, SETTINGS_LIMITS.profileName)
        : defaults.profileName,
    grammarLevel: isDetailedCefrLevel(record.grammarLevel)
      ? record.grammarLevel
      : defaults.grammarLevel,
    onboardingCompleted:
      typeof originalSchemaVersion === 'number' && originalSchemaVersion < 8
        ? true
        : typeof record.onboardingCompleted === 'boolean'
          ? record.onboardingCompleted
          : defaults.onboardingCompleted,
    learningGoal: migratedLearningGoal(record.learningGoal, defaults.learningGoal),
    dailyMinutes: migratedDailyMinutes(record.dailyMinutes, defaults.dailyMinutes),
    examPlan: migratedExamPlan(record.examPlan),
    favoriteCoachScenarioIds: migratedFavoriteIds(record.favoriteCoachScenarioIds),
    favoriteStoryBookIds: migratedFavoriteIds(record.favoriteStoryBookIds).filter((id) =>
      storyBookIds.includes(id as StoryBookId),
    ) as StoryBookId[],
    accentTheme: migratedAccentTheme(record.accentTheme, defaults.accentTheme),
    desiredRetention: clamp(
      retention,
      SETTINGS_LIMITS.desiredRetention.min,
      SETTINGS_LIMITS.desiredRetention.max,
    ),
    dailyNewLimit: clampInteger(
      newLimit,
      SETTINGS_LIMITS.dailyNewLimit.min,
      SETTINGS_LIMITS.dailyNewLimit.max,
    ),
    dailyGoal: clampInteger(
      dailyGoal,
      SETTINGS_LIMITS.dailyGoal.min,
      SETTINGS_LIMITS.dailyGoal.max,
    ),
    exerciseMix,
    exercisePreferences: migratedExercisePreferences(
      record.exercisePreferences,
      exerciseMix,
      defaults.exercisePreferences,
    ),
    studyPace: migratedStudyPace(record.studyPace, defaults.studyPace),
    allowKeyboardFallback:
      typeof record.allowKeyboardFallback === 'boolean'
        ? record.allowKeyboardFallback
        : defaults.allowKeyboardFallback,
    autoSpeakGerman:
      typeof record.autoSpeakGerman === 'boolean'
        ? record.autoSpeakGerman
        : defaults.autoSpeakGerman,
    celebrations:
      typeof record.celebrations === 'boolean' ? record.celebrations : defaults.celebrations,
    gamificationEnabled:
      typeof record.gamificationEnabled === 'boolean'
        ? record.gamificationEnabled
        : defaults.gamificationEnabled,
    rivalryEnabled:
      typeof record.rivalryEnabled === 'boolean' ? record.rivalryEnabled : defaults.rivalryEnabled,
    requireCorrection:
      typeof record.requireCorrection === 'boolean'
        ? record.requireCorrection
        : defaults.requireCorrection,
    showKeyboardHints:
      typeof record.showKeyboardHints === 'boolean'
        ? record.showKeyboardHints
        : defaults.showKeyboardHints,
    showStudyTips:
      typeof record.showStudyTips === 'boolean' ? record.showStudyTips : defaults.showStudyTips,
    reduceMotion:
      typeof record.reduceMotion === 'boolean' ? record.reduceMotion : defaults.reduceMotion,
    trainingSourceFilter: migratedTrainingSourceFilter(
      record.trainingSourceFilter,
      defaults.trainingSourceFilter,
    ),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : defaults.createdAt,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : defaults.updatedAt,
  };
}
