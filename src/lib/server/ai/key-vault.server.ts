import { env } from '$env/dynamic/private';

import {
  localProvidersAllowed,
  hasUserAiPreference,
  readUserAiConnection,
  userAiEnabled,
} from './connection-store.server.ts';
import { inklingProviderConfig } from './providers.server.ts';

import type { AiOutputMode } from '$lib/domain/ai/connection.ts';
import type { AiFeature, AiProviderId } from '$lib/domain/ai/policy.ts';
import type { AiKeySource, AiKeyStatus } from '$lib/domain/ai/types.ts';
import type { Cookies } from '@sveltejs/kit';

const DEFAULT_MODEL = 'gemini-3.6-flash';
const DEMO_MODEL = 'Fritz Demo Coach';

export type ResolvedAiProvider = {
  id: AiProviderId;
  apiKey: string;
  model: string;
  baseURL?: string;
  outputMode?: AiOutputMode;
  allowLocal?: boolean;
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

export function resolveAiAccess(cookies: Cookies, _feature: AiFeature): ResolvedAiAccess {
  const userConnection = readUserAiConnection(cookies);
  if (userConnection) {
    const { provider: id, ...configuration } = userConnection;
    return {
      mode: 'byok-only',
      source: 'user',
      providers: [{ id, ...configuration, allowLocal: localProvidersAllowed() }],
      allowFallback: false,
      sponsored: false,
    };
  }
  if (hasUserAiPreference(cookies) || !sponsoredPrivateEnabled()) {
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
    canStoreUserKey: userAiEnabled(),
    mode: access.mode,
    provider: primary?.id,
    fallbackConfigured: false,
    fallbackConsentFeatures: [],
    sponsoredAvailable: sponsoredPrivateEnabled(),
    localProvidersAllowed: localProvidersAllowed(),
    userConnectionNeedsAttention: access.source === 'demo' && hasUserAiPreference(cookies),
    connection:
      primary && access.source === 'user'
        ? {
            provider: primary.id as 'google-gemini' | 'anthropic' | 'openai-compatible',
            model: primary.model,
            baseURL: primary.baseURL,
            outputMode: primary.outputMode,
          }
        : undefined,
    dataRecipient:
      primary?.id === 'google-gemini'
        ? 'Google Gemini'
        : primary?.id === 'anthropic'
          ? 'Anthropic'
          : primary?.id === 'openai-compatible' && primary.baseURL
            ? new URL(primary.baseURL).host
            : primary?.id === 'inkling-compatible'
              ? 'Vlastní služba kompatibilní s OpenAI'
              : 'Žádný externí provider',
  };
}
