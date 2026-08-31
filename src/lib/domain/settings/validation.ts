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
    throw new Error('Neplatný mateřský jazyk.');
  }
  if (!isValidAccentTheme(settings.accentTheme)) {
    throw new Error('Neplatná hlavní barva rozhraní.');
  }
  if (typeof settings.onboardingCompleted !== 'boolean') {
    throw new Error('Neplatný stav úvodního nastavení.');
  }
  if (!isValidLearningGoal(settings.learningGoal)) {
    throw new Error('Neplatný studijní cíl.');
  }
  if (!isValidDailyMinutes(settings.dailyMinutes)) {
    throw new Error('Denní čas musí být 5, 10 nebo 20 minut.');
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
      throw new Error('Plán na písemku obsahuje neplatné údaje.');
    }
  }
  if (
    !isValidFavoriteIds(settings.favoriteCoachScenarioIds) ||
    !isValidFavoriteIds(settings.favoriteStoryBookIds)
  ) {
    throw new Error('Seznam oblíbených položek obsahuje neplatná data.');
  }
  if (
    settings.trainingSourceFilter !== 'all' &&
    settings.trainingSourceFilter !== 'own' &&
    settings.trainingSourceFilter !== 'course' &&
    settings.trainingSourceFilter !== 'without-course'
  ) {
    throw new Error('Neplatný filtr zdroje slov.');
  }
  if (settings.profileName.trim().length > limits.profileName) {
    throw new Error(`Jméno může mít nejvýše ${limits.profileName} znaků.`);
  }
  if (!isDetailedCefrLevel(settings.grammarLevel)) {
    throw new Error('Neplatná výchozí úroveň gramatiky.');
  }
  if (
    !Number.isFinite(settings.desiredRetention) ||
    settings.desiredRetention < limits.desiredRetention.min ||
    settings.desiredRetention > limits.desiredRetention.max
  ) {
    throw new Error('Cílová retence musí být mezi 80 a 95 %.');
  }
  if (
    !isIntegerInRange(settings.dailyNewLimit, limits.dailyNewLimit.min, limits.dailyNewLimit.max)
  ) {
    throw new Error('Počet nových slovíček musí být celé číslo od 0 do 30.');
  }
  if (!isIntegerInRange(settings.dailyGoal, limits.dailyGoal.min, limits.dailyGoal.max)) {
    throw new Error('Denní cíl musí být celé číslo od 5 do 200.');
  }
  if (!isValidExerciseMix(settings.exerciseMix)) {
    throw new Error('Interní mix úloh musí obsahovat celá čísla od 0 do 100 a mít součet 100 %.');
  }
  if (!isValidExercisePreferences(settings.exercisePreferences)) {
    throw new Error(
      'Nech zapnuté alespoň psaní, mluvení, kartičku nebo doplňovačku; ostatní režimy nejsou dostupné u každého slova.',
    );
  }
  if (settings.studyPace !== 'guided' && settings.studyPace !== 'focused') {
    throw new Error('Neplatný režim tempa procvičování.');
  }
  if (typeof settings.rivalryEnabled !== 'boolean') {
    throw new Error('Neplatné nastavení soukromého AI duelu.');
  }
}
