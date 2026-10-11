import type { MotherTongue } from './types.ts';

export type ErrorCopy = Record<MotherTongue, string>;

/**
 * A user-facing error that carries every interface language. `message` stays Czech so
 * logs, tests and older callers that read `error.message` keep working unchanged.
 */
export class LocalizedError extends Error {
  readonly copy: ErrorCopy;

  constructor(copy: ErrorCopy, options?: ErrorOptions) {
    super(copy.cs, options);
    this.name = 'LocalizedError';
    this.copy = copy;
  }
}

export function localizedError(cs: string, en: string, options?: ErrorOptions): LocalizedError {
  return new LocalizedError({ cs, en }, options);
}

/**
 * The text to show for a caught error. Localized errors speak the learner's language;
 * other errors are only shown verbatim in Czech, because their messages are Czech or
 * technical. Everything else falls back to the caller's own copy.
 */
export function errorText(error: unknown, language: MotherTongue, fallback: ErrorCopy): string {
  if (error instanceof LocalizedError) return error.copy[language];
  if (language === 'cs' && error instanceof Error && error.message) return error.message;
  return fallback[language];
}
