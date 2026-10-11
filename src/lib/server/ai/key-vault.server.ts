import { env } from '$env/dynamic/private';

import {
  hasUserAiPreference,
  legacyMigrationAvailable,
  localProvidersAllowed,
  readUserAiConnection,
  userAiEnabled,
  userConnectionNeedsAttention,
} from './connection-store.server.ts';
import { inklingProviderConfig } from './providers.server.ts';

import type { AiOutputMode } from '$lib/domain/ai/connection.ts';
import type { AiProviderId } from '$lib/domain/ai/policy.ts';
import type { AiKeyStatus } from '$lib/domain/ai/types.ts';
import type { Cookies } from '@sveltejs/kit';

const DEFAULT_MODEL = 'gemini-3.6-flash';

export type ResolvedAiProvider = {
  id: AiProviderId;
  source: 'user' | 'server' | 'inkling';
  apiKey: string;
  model: string;
  baseURL?: string;
  outputMode?: AiOutputMode;
  allowLocal?: boolean;
};

function serverKeyEnabled(): boolean {
  return env.AI_SERVER_KEY === 'on' || env.AI_SPONSORED_MODE === 'private';
}

export function aiModelId(): string {
  const configured = env.AI_MODEL?.trim();
  return configured && /^[a-z0-9._-]+$/iu.test(configured) ? configured : DEFAULT_MODEL;
}

/**
 * The user's own connection always wins. Server keys are used only when the owner opted in with
 * `AI_SERVER_KEY=on` (legacy: `AI_SPONSORED_MODE=private`) and has not chosen a personal
 * connection; otherwise AI runs in demo mode.
 */
export function resolveAiProvider(cookies: Cookies): ResolvedAiProvider | undefined {
  const user = readUserAiConnection(cookies);
  if (user) {
    const { provider: id, ...configuration } = user;
    return { id, source: 'user', ...configuration, allowLocal: localProvidersAllowed() };
  }
  if (hasUserAiPreference(cookies) || !serverKeyEnabled()) return undefined;
  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey)
    return { id: 'google-gemini', source: 'server', apiKey: geminiKey, model: aiModelId() };
  const inkling = inklingProviderConfig();
  return inkling && { id: 'inkling-compatible', source: 'inkling', ...inkling };
}

function dataRecipient(provider: ResolvedAiProvider | undefined): string {
  if (!provider) return 'Žádný externí provider';
  if (provider.id === 'google-gemini') return 'Google Gemini';
  if (provider.id === 'anthropic') return 'Anthropic';
  if (provider.id === 'inkling-compatible') return 'Vlastní služba kompatibilní s OpenAI';
  return new URL(provider.baseURL!).host;
}

export function keyStatus(cookies: Cookies): AiKeyStatus {
  const provider = resolveAiProvider(cookies);
  return {
    configured: Boolean(provider),
    source: provider?.source ?? 'demo',
    model: provider?.model ?? 'Fritz Demo Coach',
    provider: provider?.id,
    canStoreUserKey: userAiEnabled(),
    localProvidersAllowed: localProvidersAllowed(),
    userConnectionNeedsAttention: userConnectionNeedsAttention(cookies),
    legacyMigrationAvailable: legacyMigrationAvailable(cookies),
    dataRecipient: dataRecipient(provider),
    connection:
      provider?.source === 'user'
        ? {
            provider: provider.id as 'google-gemini' | 'anthropic' | 'openai-compatible',
            model: provider.model,
            baseURL: provider.baseURL,
            outputMode: provider.outputMode,
          }
        : undefined,
  };
}
