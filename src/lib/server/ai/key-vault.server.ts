import { env } from '$env/dynamic/private';

import { inklingProviderConfig } from './providers.server.ts';

import type { AiFeature, AiProviderId } from '$lib/domain/ai/policy.ts';
import type { AiKeySource, AiKeyStatus } from '$lib/domain/ai/types.ts';
import type { Cookies } from '@sveltejs/kit';

const DEFAULT_MODEL = 'gemini-3.6-flash';
const DEMO_MODEL = 'Fritz Demo Coach';

export type ResolvedAiProvider = {
  id: AiProviderId;
  apiKey: string;
  model: string;
};

export type ResolvedAiAccess = {
  mode: 'demo' | 'byok-only' | 'server-only' | 'sponsored-private' | 'explicit-fallback';
  source: AiKeySource;
  providers: ResolvedAiProvider[];
  allowFallback: boolean;
  sponsored: boolean;
};

export function aiModelId(): string {
  const configured = env.AI_MODEL?.trim();
  return configured && /^[a-z0-9._-]+$/iu.test(configured) ? configured : DEFAULT_MODEL;
}

export function sponsoredPrivateEnabled(): boolean {
  // `private` is an explicit opt-in for the single-owner deployment. No provider key is
  // activated merely because it exists in the environment.
  return env.AI_SPONSORED_MODE === 'private';
}

export function resolveAiAccess(_cookies: Cookies, _feature: AiFeature): ResolvedAiAccess {
  if (!sponsoredPrivateEnabled()) {
    return { mode: 'demo', source: 'demo', providers: [], allowFallback: false, sponsored: false };
  }

  const providers: ResolvedAiProvider[] = [];
  const serverKey = env.GEMINI_API_KEY?.trim();
  if (serverKey) {
    providers.push({ id: 'google-gemini', apiKey: serverKey, model: aiModelId() });
  }
  const inkling = inklingProviderConfig();
  if (inkling) {
    providers.push({ id: 'inkling-compatible', apiKey: inkling.apiKey, model: inkling.model });
  }
  if (providers.length === 0) {
    return { mode: 'demo', source: 'demo', providers: [], allowFallback: false, sponsored: false };
  }
  return {
    mode: 'server-only',
    source: providers[0].id === 'google-gemini' ? 'server' : 'inkling',
    providers: providers.slice(0, 1),
    allowFallback: false,
    sponsored: false,
  };
}

export function keyStatus(cookies: Cookies): AiKeyStatus {
  const access = resolveAiAccess(cookies, 'explain');
  const primary = access.providers[0];
  return {
    configured: access.mode !== 'demo',
    source: access.source,
    model: primary?.model ?? DEMO_MODEL,
    canStoreUserKey: false,
    mode: access.mode,
    provider: primary?.id,
    fallbackConfigured: false,
    fallbackConsentFeatures: [],
    sponsoredAvailable: sponsoredPrivateEnabled(),
    dataRecipient:
      primary?.id === 'google-gemini'
        ? 'Google Gemini'
        : primary?.id === 'inkling-compatible'
          ? 'Důvěryhodný OpenAI-compatible endpoint'
          : 'Žádný externí provider',
  };
}
