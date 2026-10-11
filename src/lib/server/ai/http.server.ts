import { error, isHttpError, json } from '@sveltejs/kit';
import { logProviderFailure } from '../log.server.ts';
import { classifyProviderError } from './provider-errors.ts';

import type { RequestEvent } from '@sveltejs/kit';
import type { AiProviderErrorClass } from './provider-errors.ts';

const requests = new Map<string, { count: number; resetAt: number }>();
const MAX_RATE_LIMIT_BUCKETS = 2_500;

function pruneRateLimitBuckets(now: number): void {
  if (requests.size < 2_000) return;
  for (const [bucket, value] of requests) if (value.resetAt <= now) requests.delete(bucket);
  // A stream of never-before-seen client addresses must not grow process memory forever.
  for (const oldest of requests.keys()) {
    if (requests.size < MAX_RATE_LIMIT_BUCKETS) break;
    requests.delete(oldest);
  }
}

export function assertSameOrigin(event: RequestEvent, requireOrigin = false): void {
  if (event.request.headers.get('sec-fetch-site') === 'cross-site')
    throw error(403, 'Požadavek pochází z jiné domény.');
  const origin = event.request.headers.get('origin');
  if (!origin) {
    if (requireOrigin) throw error(403, 'Mutační požadavek nemá ověřitelný původ.');
    return;
  }
  if (!URL.canParse(origin)) throw error(403, 'Požadavek má neplatný původ.');
  if (new URL(origin).origin !== event.url.origin)
    throw error(403, 'Požadavek pochází z jiné domény.');
}

export function assertJsonRequest(event: RequestEvent): void {
  assertSameOrigin(event);
  const contentType = event.request.headers.get('content-type') ?? '';
  if (!contentType.toLocaleLowerCase().includes('application/json')) {
    throw error(415, 'Požadavek musí být JSON.');
  }
}

export async function readJsonRequest(event: RequestEvent, maxBytes: number): Promise<unknown> {
  assertJsonRequest(event);
  const declaredLength = event.request.headers.get('content-length');
  if (declaredLength) {
    const bytes = Number(declaredLength);
    if (!Number.isInteger(bytes) || bytes < 0) {
      throw error(400, 'Požadavek má neplatnou délku.');
    }
    if (bytes > maxBytes) throw error(413, 'AI zadání je příliš velké.');
  }

  let text = '';
  let bytes = 0;
  const reader = event.request.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    try {
      for (;;) {
        // Bound unknown-length request bodies while receiving them, before allocating the full input.
        // oxlint-disable-next-line no-await-in-loop
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes) {
          void reader.cancel().catch(() => {});
          throw error(413, 'AI zadání je příliš velké.');
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  if (!text.trim()) throw error(400, 'Požadavek neobsahuje JSON data.');

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw error(400, 'Požadavek obsahuje neplatný JSON.');
  }
}

export function assertRateLimit(event: RequestEvent, limit = 12, windowMs = 10 * 60_000): void {
  let address = 'local';
  try {
    address = event.getClientAddress();
  } catch {
    // Některé lokální adaptéry adresu neposkytují. Pro vývoj stačí společný bucket.
  }
  // Encoded URLs can match the same route. They must share its request budget.
  const key = `${address}:${event.route.id ?? 'unmatched'}`;
  const now = Date.now();
  pruneRateLimitBuckets(now);
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) throw error(429, 'Příliš mnoho AI požadavků. Zkus to za chvíli.');
  current.count += 1;
}

const AI_ERRORS: Partial<Record<AiProviderErrorClass, [status: number, message: string]>> = {
  auth: [401, 'AI připojení nebylo přijato. Zkontroluj nastavení poskytovatele.'],
  quota: [429, 'AI služba má právě vyčerpaný limit. Zkus to později nebo zkontroluj kvótu.'],
  abort: [499, 'AI požadavek byl zrušen.'],
  timeout: [504, 'AI služba neodpověděla včas. Zkus kratší zadání.'],
  network: [504, 'AI služba neodpověděla včas. Zkus kratší zadání.'],
  schema: [502, 'Model nevrátil požadovaný JSON. V nastavení zkus jiný režim odpovědi nebo model.'],
  validation: [
    400,
    'Poskytovatel nepřijal model nebo formát požadavku. Zkontroluj ID modelu a režim odpovědi v nastavení AI.',
  ],
};

/** Converts any failure into a client-safe `{ error }` response; provider messages stay server-side. */
export function aiErrorResponse(value: unknown): Response {
  if (isHttpError(value)) return json({ error: value.body.message }, { status: value.status });
  const errorClass = classifyProviderError(value);
  if (errorClass !== 'abort') logProviderFailure('ai', value, errorClass);
  const [status, message] = AI_ERRORS[errorClass] ?? [
    502,
    'AI návrh se nepodařilo vytvořit. Zadání zůstalo beze změny.',
  ];
  return json({ error: message }, { status });
}
