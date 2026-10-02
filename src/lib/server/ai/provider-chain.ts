import type { AiProviderId } from '$lib/domain/ai/policy.ts';

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

export type AiProviderTrace = {
  provider: AiProviderId;
  status: 'success' | 'failed';
  errorClass?: AiProviderErrorClass;
};

export type AiGeneration<T> = {
  output: T;
  model: string;
  provider: AiProviderId;
  trace: AiProviderTrace[];
  usage?: { inputTokens?: number; outputTokens?: number };
};

export type AiProviderAttempt<T> = {
  provider: AiProviderId;
  run: (signal?: AbortSignal) => Promise<Omit<AiGeneration<T>, 'provider' | 'trace'>>;
};

function statusCode(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  for (const key of ['status', 'statusCode', 'status_code']) {
    const candidate = (value as Record<string, unknown>)[key];
    if (typeof candidate === 'number') return candidate;
  }
  return undefined;
}

export function classifyProviderError(value: unknown): AiProviderErrorClass {
  if (value instanceof DOMException && value.name === 'AbortError') return 'abort';
  const name = value instanceof Error ? value.name : '';
  const message = value instanceof Error ? value.message : String(value ?? '');
  const normalized = `${name} ${message}`.toLocaleLowerCase('en-US');
  const status = statusCode(value);
  if (/abort|cancelled|canceled/u.test(normalized)) return 'abort';
  if (
    status === 401 ||
    status === 403 ||
    /invalid.?key|unauth|permission|forbidden/u.test(normalized)
  ) {
    return 'auth';
  }
  if (/safety|policy|content.?filter|refusal|blocked.?prompt/u.test(normalized)) return 'safety';
  if (/noobjectgenerated|schema|structured.?output|parse.?output/u.test(normalized))
    return 'schema';
  if (status === 400 || /bad.?request|validation|invalid.?argument/u.test(normalized)) {
    return 'validation';
  }
  if (status === 404) return 'validation';
  if (status === 429 || /quota|rate.?limit|resource.?exhausted|budget|rozpočet/u.test(normalized)) {
    return 'quota';
  }
  if (status === 408 || /timeout|timed.?out/u.test(normalized)) return 'timeout';
  if (status === 502 || status === 503 || status === 504) return 'provider-unavailable';
  if (/network|fetch failed|econn|enotfound|socket|dns/u.test(normalized)) return 'network';
  return 'unknown';
}

export function isFallbackEligible(errorClass: AiProviderErrorClass): boolean {
  return (
    errorClass === 'quota' ||
    errorClass === 'timeout' ||
    errorClass === 'network' ||
    errorClass === 'provider-unavailable'
  );
}

export class AiProviderChainError extends Error {
  readonly errorClass: AiProviderErrorClass;
  readonly trace: AiProviderTrace[];

  constructor(errorClass: AiProviderErrorClass = 'unknown', trace: AiProviderTrace[] = []) {
    super('AI provider nedokončil požadavek.');
    this.name = 'AiProviderChainError';
    this.errorClass = errorClass;
    this.trace = trace;
  }
}

export async function runProviderChain<T>(
  attempts: readonly AiProviderAttempt<T>[],
  options: { allowFallback: boolean; signal?: AbortSignal },
): Promise<AiGeneration<T>> {
  if (attempts.length === 0) throw new AiProviderChainError();
  const trace: AiProviderTrace[] = [];

  for (const [index, attempt] of attempts.entries()) {
    if (options.signal?.aborted) {
      throw new AiProviderChainError('abort', trace);
    }
    try {
      // Providers must be tried in order so fallback only runs after a classified failure.
      // oxlint-disable-next-line no-await-in-loop
      const generated = await attempt.run(options.signal);
      const successTrace = [...trace, { provider: attempt.provider, status: 'success' as const }];
      return { ...generated, provider: attempt.provider, trace: successTrace };
    } catch (error) {
      const errorClass = options.signal?.aborted ? 'abort' : classifyProviderError(error);
      trace.push({ provider: attempt.provider, status: 'failed', errorClass });
      const hasNext = index + 1 < attempts.length;
      if (!hasNext || !options.allowFallback || !isFallbackEligible(errorClass)) {
        throw new AiProviderChainError(errorClass, trace);
      }
    }
  }

  throw new AiProviderChainError('unknown', trace);
}
