import { localizedError } from '../errors.ts';
import { isDetailedCefrLevel } from '../levels.ts';
import type {
  AccentTheme,
  AppSettings,
  DailyMinutes,
  ExerciseMix,
  ExercisePreferences,
  LearningGoal,
  MotherTongue,
} from '../types.ts';

export const SETTINGS_LIMITS = {
  profileName: 50,
  desiredRetention: { min: 0.8, max: 0.95 },
  dailyNewLimit: { min: 0, max: 30 },
  dailyGoal: { min: 5, max: 200 },
} as const;

function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function isValidExerciseMix(mix: ExerciseMix): boolean {
  return (
    isIntegerInRange(mix.typing, 0, 100) &&
    isIntegerInRange(mix.choice, 0, 100) &&
    isIntegerInRange(mix.flashcard, 0, 100) &&
    mix.typing + mix.choice + mix.flashcard === 100
  );
}

export function enabledExerciseCount(preferences: ExercisePreferences): number {
  return Object.values(preferences).filter(Boolean).length;
}

/**
 * Typ úlohy, který funguje i s jedinou kartou, bez příkladu a bez AI klíče.
 * Mluvení má vždy textový fallback; výběr, párování, slovosled a AI věta potřebují další kontext.
 */
export function hasUniversalExercise(preferences: ExercisePreferences): boolean {
  return Boolean(
    preferences.typing || preferences.flashcard || preferences.cloze || preferences.speaking,
  );
}

export function isValidExercisePreferences(preferences: ExercisePreferences): boolean {
  return (
    Object.values(preferences).every((value) => typeof value === 'boolean') &&
    enabledExerciseCount(preferences) > 0 &&
    hasUniversalExercise(preferences)
  );
}

export function isValidAccentTheme(value: unknown): value is AccentTheme {
  return (
    value === 'green' ||
    value === 'moss' ||
    value === 'magenta' ||
    value === 'rose' ||
    value === 'blue' ||
    value === 'teal'
  );
}

export function isValidMotherTongue(value: unknown): value is MotherTongue {
  return value === 'cs' || value === 'en';
}

export function isValidDailyMinutes(value: unknown): value is DailyMinutes {
  return value === 5 || value === 10 || value === 20;
}

export function isValidLearningGoal(value: unknown): value is LearningGoal {
  return value === 'school' || value === 'memory' || value === 'conversation';
}

function isValidFavoriteIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 250 &&
    new Set(value).size === value.length &&
    value.every((item) => typeof item === 'string' && item.length > 0 && item.length <= 200)
  );
}

export function assertValidSettings(settings: AppSettings): void {
  const limits = SETTINGS_LIMITS;
  if (!isValidMotherTongue(settings.motherTongue)) {
    throw localizedError('Neplatný mateřský jazyk.', 'Invalid interface language.');
  }
  if (!isValidAccentTheme(settings.accentTheme)) {
    throw localizedError('Neplatná hlavní barva rozhraní.', 'Invalid accent colour.');
  }
  if (typeof settings.onboardingCompleted !== 'boolean') {
    throw localizedError('Neplatný stav úvodního nastavení.', 'Invalid onboarding state.');
  }
  if (!isValidLearningGoal(settings.learningGoal)) {
    throw localizedError('Neplatný studijní cíl.', 'Invalid learning goal.');
  }
  if (!isValidDailyMinutes(settings.dailyMinutes)) {
    throw localizedError(
      'Denní čas musí být 5, 10 nebo 20 minut.',
      'Daily time must be 5, 10 or 20 minutes.',
    );
  }
  if (settings.examPlan) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/u.test(settings.examPlan.examDate) ||
      Number.isNaN(new Date(`${settings.examPlan.examDate}T12:00:00`).getTime()) ||
      settings.examPlan.tag.length > 100 ||
      !settings.examPlan.tag.trim() ||
      !isValidDailyMinutes(settings.examPlan.dailyMinutes) ||
      Number.isNaN(new Date(settings.examPlan.createdAt).getTime()) ||
      Number.isNaN(new Date(settings.examPlan.updatedAt).getTime())
    ) {
      throw localizedError(
        'Plán na písemku obsahuje neplatné údaje.',
        'The test plan contains invalid data.',
      );
    }
  }
  if (
    !isValidFavoriteIds(settings.favoriteCoachScenarioIds) ||
    !isValidFavoriteIds(settings.favoriteStoryBookIds)
  ) {
    throw localizedError(
      'Seznam oblíbených položek obsahuje neplatná data.',
      'The favourites list contains invalid data.',
    );
  }
  if (
    settings.trainingSourceFilter !== 'all' &&
    settings.trainingSourceFilter !== 'own' &&
    settings.trainingSourceFilter !== 'course' &&
    settings.trainingSourceFilter !== 'without-course'
  ) {
    throw localizedError('Neplatný filtr zdroje slov.', 'Invalid word source filter.');
  }
  if (settings.profileName.trim().length > limits.profileName) {
    throw localizedError(
      `Jméno může mít nejvýše ${limits.profileName} znaků.`,
      `The name can have at most ${limits.profileName} characters.`,
    );
  }
  if (!isDetailedCefrLevel(settings.grammarLevel)) {
    throw localizedError('Neplatná výchozí úroveň gramatiky.', 'Invalid starting grammar level.');
  }
  if (
    !Number.isFinite(settings.desiredRetention) ||
    settings.desiredRetention < limits.desiredRetention.min ||
    settings.desiredRetention > limits.desiredRetention.max
  ) {
    throw localizedError(
      'Cílová retence musí být mezi 80 a 95 %.',
      'Target retention must be between 80 and 95%.',
    );
  }
  if (
    !isIntegerInRange(settings.dailyNewLimit, limits.dailyNewLimit.min, limits.dailyNewLimit.max)
  ) {
    throw localizedError(
      'Počet nových slovíček musí být celé číslo od 0 do 30.',
      'New words per day must be a whole number from 0 to 30.',
    );
  }
  if (!isIntegerInRange(settings.dailyGoal, limits.dailyGoal.min, limits.dailyGoal.max)) {
    throw localizedError(
      'Denní cíl musí být celé číslo od 5 do 200.',
      'The daily goal must be a whole number from 5 to 200.',
    );
  }
  if (!isValidExerciseMix(settings.exerciseMix)) {
    throw localizedError(
      'Interní mix úloh musí obsahovat celá čísla od 0 do 100 a mít součet 100 %.',
      'The internal exercise mix must use whole numbers from 0 to 100 that add up to 100%.',
    );
  }
  if (!isValidExercisePreferences(settings.exercisePreferences)) {
    throw new Error(
      'Nech zapnuté alespoň psaní, mluvení, kartičku nebo doplňovačku; ostatní režimy nejsou dostupné u každého slova.',
    );
  }
  if (settings.studyPace !== 'guided' && settings.studyPace !== 'focused') {
    throw localizedError('Neplatný režim tempa procvičování.', 'Invalid practice pace.');
  }
  if (typeof settings.rivalryEnabled !== 'boolean') {
    throw localizedError(
      'Neplatné nastavení soukromého AI duelu.',
      'Invalid private AI duel setting.',
    );
  }
}
