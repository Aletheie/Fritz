export type AiProviderErrorClass =
  | 'abort'
  | 'auth'
  | 'validation'
  | 'safety'
  | 'quota'
  | 'timeout'
  | 'network'
  | 'provider-unavailable'
  | 'schema'
  | 'unknown';

function statusCode(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  for (const key of ['status', 'statusCode', 'status_code']) {
    const candidate = (value as Record<string, unknown>)[key];
    if (typeof candidate === 'number') return candidate;
  }
  return undefined;
}

/** Maps provider failures to a coarse class; the provider's own message never reaches the client. */
export function classifyProviderError(value: unknown): AiProviderErrorClass {
  const name = value instanceof Error ? value.name : '';
  const message = value instanceof Error ? value.message : String(value ?? '');
  const normalized = `${name} ${message}`.toLocaleLowerCase('en-US');
  const status = statusCode(value);
  // Deadline aborts say "aborted due to timeout", so timeouts are checked before cancellations.
  if (status === 408 || /timeout|timed.?out/u.test(normalized)) return 'timeout';
  if (/abort|cancelled|canceled/u.test(normalized)) return 'abort';
  if (
    status === 401 ||
    status === 403 ||
    /invalid.?key|unauth|permission|forbidden/u.test(normalized)
  )
    return 'auth';
  if (/safety|policy|content.?filter|refusal|blocked.?prompt/u.test(normalized)) return 'safety';
  if (/noobjectgenerated|schema|structured.?output|parse.?output/u.test(normalized))
    return 'schema';
  if (
    status === 400 ||
    status === 404 ||
    /bad.?request|validation|invalid.?argument/u.test(normalized)
  )
    return 'validation';
  if (status === 429 || /quota|rate.?limit|resource.?exhausted/u.test(normalized)) return 'quota';
  if (status === 502 || status === 503 || status === 504) return 'provider-unavailable';
  if (/network|fetch failed|econn|enotfound|socket|dns/u.test(normalized)) return 'network';
  return 'unknown';
}
