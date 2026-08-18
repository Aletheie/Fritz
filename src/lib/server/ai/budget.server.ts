import { randomUUID } from 'node:crypto';

import { isFallbackEligible } from './provider-chain.ts';

import type { AiFeature, AiFeaturePolicy, AiProviderId } from '$lib/domain/ai/policy.ts';
import type { AiProviderErrorClass } from './provider-chain.ts';

export type AiBudgetReservation = {
  principal: string;
  feature: AiFeature;
  provider: AiProviderId;
  estimatedInputBytes: number;
  maxOutputTokens: number;
  policy: AiFeaturePolicy;
};

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type AiBudgetLease = {
  id: string;
  reservation: AiBudgetReservation;
};

export type AiBudgetStore = {
  reserve(request: AiBudgetReservation): Promise<AiBudgetLease>;
  commit(lease: AiBudgetLease, usage: AiUsage): Promise<void>;
  release(lease: AiBudgetLease, reason: string): Promise<void>;
};

type Bucket = {
  requests: number;
  inputBytes: number;
  outputTokens: number;
  active: number;
  resetAt: number;
};

export class AiBudgetExceededError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('AI rozpočet pro tuto funkci je dočasně vyčerpaný.');
    this.name = 'AiBudgetExceededError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type CircuitState = {
  failures: number;
  windowStartedAt: number;
  openUntil: number;
};

const circuits = new Map<AiProviderId, CircuitState>();

export function assertProviderCircuit(provider: AiProviderId, now = Date.now()): void {
  const state = circuits.get(provider);
  if (state && state.openUntil > now) {
    throw new AiBudgetExceededError(Math.ceil((state.openUntil - now) / 1_000));
  }
}

export function recordProviderSuccess(provider: AiProviderId): void {
  circuits.delete(provider);
}

export function recordProviderFailure(
  provider: AiProviderId,
  errorClass: AiProviderErrorClass,
  now = Date.now(),
): void {
  if (!isFallbackEligible(errorClass)) return;
  const prior = circuits.get(provider);
  const state =
    prior && now - prior.windowStartedAt < 60_000
      ? prior
      : { failures: 0, windowStartedAt: now, openUntil: 0 };
  state.failures += 1;
  if (state.failures >= 5) state.openUntil = now + 2 * 60_000;
  circuits.set(provider, state);
}

/** Development/test adapter only. Production sponsored mode never selects this adapter. */
export class MemoryAiBudgetStore implements AiBudgetStore {
  readonly #buckets = new Map<string, Bucket>();
  readonly #leases = new Map<string, AiBudgetLease>();

  async reserve(request: AiBudgetReservation): Promise<AiBudgetLease> {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const key = `${day}:${request.principal}:${request.feature}:${request.provider}`;
    const resetAt = Date.parse(`${day}T00:00:00.000Z`) + 24 * 60 * 60_000;
    const bucket = this.#buckets.get(key) ?? {
      requests: 0,
      inputBytes: 0,
      outputTokens: 0,
      active: 0,
      resetAt,
    };
    const blocked =
      bucket.requests >= request.policy.dailyRequests ||
      bucket.inputBytes + request.estimatedInputBytes > request.policy.dailyInputBytes ||
      bucket.outputTokens + request.maxOutputTokens > request.policy.dailyOutputTokens ||
      bucket.active >= request.policy.concurrency;
    if (blocked) {
      throw new AiBudgetExceededError(Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)));
    }
    bucket.requests += 1;
    bucket.inputBytes += request.estimatedInputBytes;
    bucket.outputTokens += request.maxOutputTokens;
    bucket.active += 1;
    this.#buckets.set(key, bucket);
    const lease = { id: randomUUID(), reservation: request };
    this.#leases.set(lease.id, lease);
    this.#prune(now);
    return lease;
  }

  async commit(lease: AiBudgetLease, usage: AiUsage): Promise<void> {
    if (!this.#leases.delete(lease.id)) return;
    const bucket = this.#bucketFor(lease.reservation);
    if (!bucket) return;
    bucket.active = Math.max(0, bucket.active - 1);
    if (usage.outputTokens !== undefined) {
      bucket.outputTokens = Math.max(
        0,
        bucket.outputTokens - lease.reservation.maxOutputTokens + Math.max(0, usage.outputTokens),
      );
    }
  }

  async release(lease: AiBudgetLease, _reason: string): Promise<void> {
    if (!this.#leases.delete(lease.id)) return;
    const bucket = this.#bucketFor(lease.reservation);
    if (bucket) bucket.active = Math.max(0, bucket.active - 1);
  }

  #bucketFor(request: AiBudgetReservation): Bucket | undefined {
    const day = new Date().toISOString().slice(0, 10);
    return this.#buckets.get(`${day}:${request.principal}:${request.feature}:${request.provider}`);
  }

  #prune(now: number): void {
    if (this.#buckets.size < 2_000) return;
    for (const [key, bucket] of this.#buckets) {
      if (bucket.resetAt <= now) this.#buckets.delete(key);
    }
  }
}

let developmentBudgetStore: MemoryAiBudgetStore | undefined;

export function sponsoredBudgetStore(): AiBudgetStore | undefined {
  if (process.env.NODE_ENV === 'production' || process.env.AI_BUDGET_STORE !== 'memory') {
    return undefined;
  }
  developmentBudgetStore ??= new MemoryAiBudgetStore();
  return developmentBudgetStore;
}
