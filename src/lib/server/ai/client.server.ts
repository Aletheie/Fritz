import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, Output } from 'ai';

import { aiFeaturePolicy } from '$lib/domain/ai/policy.ts';
import {
  assertProviderCircuit,
  recordProviderFailure,
  recordProviderSuccess,
  sponsoredBudgetStore,
} from './budget.server.ts';
import { aiModelId } from './key-vault.server.ts';
import { classifyProviderError, runProviderChain } from './provider-chain.ts';
import { inklingProviderConfig } from './providers.server.ts';

import type { AiFeature, AiProviderId } from '$lib/domain/ai/policy.ts';
import type { LanguageModel } from 'ai';
import type { z } from 'zod';
import type { ResolvedAiAccess, ResolvedAiProvider } from './key-vault.server.ts';
import type { AiGeneration, AiProviderAttempt } from './provider-chain.ts';

type StructuredGenerationInput<T> = {
  access: ResolvedAiAccess;
  feature: AiFeature;
  principal?: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  signal?: AbortSignal;
  temperature?: number;
  maxOutputTokens?: number;
};

function combinedSignal(requestSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const deadline = AbortSignal.timeout(timeoutMs);
  return requestSignal ? AbortSignal.any([requestSignal, deadline]) : deadline;
}

async function generateWithModel<T>(input: {
  provider: ResolvedAiProvider;
  model: LanguageModel;
  request: StructuredGenerationInput<T>;
  signal?: AbortSignal;
  temperature?: number;
  maxOutputTokens: number;
}): Promise<Omit<AiGeneration<T>, 'provider' | 'trace'>> {
  const policy = aiFeaturePolicy(input.request.feature);
  const result = await generateText({
    model: input.model,
    system: input.request.system,
    prompt: input.request.prompt,
    output: Output.object({ schema: input.request.schema }),
    temperature: input.temperature ?? input.request.temperature ?? 0.2,
    maxOutputTokens: input.maxOutputTokens,
    maxRetries: policy.maxRetries,
    abortSignal: combinedSignal(input.signal, policy.timeoutMs),
  });
  return {
    output: result.output,
    model: input.provider.model,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    },
  };
}

function providerModel(provider: ResolvedAiProvider): {
  model: LanguageModel;
  temperature?: number;
} {
  if (provider.id === 'google-gemini') {
    const google = createGoogleGenerativeAI({ apiKey: provider.apiKey });
    return { model: google(provider.model) };
  }
  const config = inklingProviderConfig();
  if (!config || config.apiKey !== provider.apiKey || config.model !== provider.model) {
    throw new Error('OpenAI-compatible provider configuration changed before request execution.');
  }
  const compatible = createOpenAICompatible({
    name: 'trusted-openai-compatible',
    baseURL: config.baseURL,
    apiKey: provider.apiKey,
    supportsStructuredOutputs: true,
  });
  return { model: compatible.chatModel(provider.model), temperature: 0 };
}

function providerAttempt<T>(
  provider: ResolvedAiProvider,
  request: StructuredGenerationInput<T>,
  maxOutputTokens: number,
): AiProviderAttempt<T> {
  return {
    provider: provider.id,
    run: async (signal) => {
      const policy = aiFeaturePolicy(request.feature);
      const budget = request.access.sponsored ? sponsoredBudgetStore() : undefined;
      if (request.access.sponsored && (!budget || !request.principal)) {
        throw new Error('Sponsored AI budget store or principal is unavailable.');
      }
      if (request.access.sponsored) assertProviderCircuit(provider.id);
      const lease = budget
        ? await budget.reserve({
            principal: request.principal!,
            feature: request.feature,
            provider: provider.id,
            estimatedInputBytes: new TextEncoder().encode(`${request.system}\n${request.prompt}`)
              .byteLength,
            maxOutputTokens,
            policy,
          })
        : undefined;
      try {
        const selected = providerModel(provider);
        const result = await generateWithModel({
          provider,
          model: selected.model,
          request,
          signal,
          temperature: selected.temperature,
          maxOutputTokens,
        });
        if (lease && budget) await budget.commit(lease, result.usage ?? {});
        if (request.access.sponsored) recordProviderSuccess(provider.id);
        return result;
      } catch (error) {
        if (lease && budget) await budget.release(lease, 'provider-error');
        const errorClass = classifyProviderError(error);
        if (request.access.sponsored && !signal?.aborted) {
          recordProviderFailure(provider.id, errorClass);
        }
        throw error;
      }
    },
  };
}

export function hasLiveAiProvider(access: ResolvedAiAccess): boolean {
  return access.providers.length > 0 && access.mode !== 'demo';
}

export async function generateStructured<T>(
  input: StructuredGenerationInput<T>,
): Promise<AiGeneration<T>> {
  const policy = aiFeaturePolicy(input.feature);
  const requestedTokens = input.maxOutputTokens ?? policy.maxOutputTokens;
  const maxOutputTokens = Math.max(64, Math.min(requestedTokens, policy.maxOutputTokens));
  const attempts = input.access.providers.map((provider) =>
    providerAttempt(provider, input, maxOutputTokens),
  );
  return runProviderChain(attempts, {
    allowFallback: input.access.allowFallback,
    signal: input.signal,
  });
}

export async function testApiKey(apiKey: string, signal?: AbortSignal): Promise<void> {
  const google = createGoogleGenerativeAI({ apiKey });
  await generateText({
    model: google(aiModelId()),
    prompt: 'Odpověz pouze slovem OK.',
    temperature: 0,
    maxOutputTokens: 16,
    maxRetries: 0,
    abortSignal: combinedSignal(signal, 12_000),
  });
}

export function providerName(provider: AiProviderId): string {
  return provider === 'google-gemini' ? 'Google Gemini' : 'Důvěryhodný AI endpoint';
}
