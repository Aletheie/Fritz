import { error, json } from '@sveltejs/kit';
import { AiBudgetExceededError } from './budget.server.ts';
import { AiProviderChainError, classifyProviderError } from './provider-chain.ts';

import type { RequestEvent } from '@sveltejs/kit';

const requests = new Map<string, { count: number; resetAt: number }>();
const MAX_RATE_LIMIT_BUCKETS = 2_500;

function pruneRateLimitBuckets(now: number): void {
  if (requests.size < 2_000) return;

  for (const [bucket, value] of requests) {
    if (value.resetAt <= now) requests.delete(bucket);
  }

  // A stream of never-before-seen client addresses must not grow process memory forever.
  while (requests.size >= MAX_RATE_LIMIT_BUCKETS) {
    const oldest = requests.keys().next().value as string | undefined;
    if (!oldest) break;
    requests.delete(oldest);
  }
}

export function assertSameOrigin(event: RequestEvent, requireOrigin = false): void {
  const fetchSite = event.request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    throw error(403, 'Požadavek pochází z jiné domény.');
  }

  const origin = event.request.headers.get('origin');
  if (!origin) {
    if (requireOrigin) throw error(403, 'Mutační požadavek nemá ověřitelný původ.');
    return;
  }
  try {
    if (new URL(origin).origin !== event.url.origin) {
      throw error(403, 'Požadavek pochází z jiné domény.');
    }
  } catch (value) {
    if (value && typeof value === 'object' && 'status' in value) throw value;
    throw error(403, 'Požadavek má neplatný původ.');
  }
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

  const text = await event.request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw error(413, 'AI zadání je příliš velké.');
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

export function aiErrorResponse(value: unknown): Response {
  if (value instanceof AiBudgetExceededError) {
    return json(
      { error: 'AI rozpočet pro tuto funkci je vyčerpaný. Zkus to později.' },
      { status: 429, headers: { 'retry-after': String(value.retryAfterSeconds) } },
    );
  }
  const errorClass =
    value instanceof AiProviderChainError ? value.errorClass : classifyProviderError(value);
  if (errorClass === 'auth') {
    return json(
      { error: 'AI připojení nebylo přijato. Zkontroluj nastavení poskytovatele.' },
      { status: 401 },
    );
  }
  if (errorClass === 'quota') {
    return json(
      { error: 'AI služba má právě vyčerpaný limit. Zkus to později nebo zkontroluj kvótu.' },
      { status: 429 },
    );
  }
  if (errorClass === 'abort') {
    return json({ error: 'AI požadavek byl zrušen.' }, { status: 499 });
  }
  if (errorClass === 'timeout' || errorClass === 'network') {
    return json({ error: 'AI služba neodpověděla včas. Zkus kratší zadání.' }, { status: 504 });
  }
  return json(
    { error: 'AI návrh se nepodařilo vytvořit. Zadání zůstalo beze změny.' },
    { status: 502 },
  );
}
