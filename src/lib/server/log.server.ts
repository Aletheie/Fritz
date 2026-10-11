type LogDetails = Record<string, string | number | boolean | undefined>;

function write(level: 'warn' | 'error', context: string, details: LogDetails): void {
  console[level](JSON.stringify({ time: new Date().toISOString(), level, context, ...details }));
}

/** Logs an unexpected server failure with its stack. Never pass request bodies, tokens or keys. */
export function logServerError(context: string, value: unknown, details: LogDetails = {}): void {
  const error =
    value instanceof Error
      ? { error: value.name, message: value.message, stack: value.stack }
      : { error: typeof value };
  write('error', context, { ...details, ...error });
}

/** Logs a classified provider failure. Provider messages can echo learner data, so only metadata is kept. */
export function logProviderFailure(context: string, value: unknown, errorClass: string): void {
  const status =
    value &&
    typeof value === 'object' &&
    'statusCode' in value &&
    typeof value.statusCode === 'number'
      ? value.statusCode
      : undefined;
  write('warn', context, {
    errorClass,
    error: value instanceof Error ? value.name : typeof value,
    status,
  });
}
