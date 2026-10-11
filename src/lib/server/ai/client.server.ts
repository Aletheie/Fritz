import { generateText, Output, streamText } from 'ai';

import { AI_FEATURE_POLICY } from '$lib/domain/ai/policy.ts';
import { configuredProviderModel } from './provider-model.server.ts';

import type { AiFeature } from '$lib/domain/ai/policy.ts';
import type { z } from 'zod';
import type { ResolvedAiProvider } from './key-vault.server.ts';

export type StructuredRequest<T> = {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  temperature?: number;
  /** Lowers the feature's output cap; it can never raise it. */
  maxOutputTokens?: number;
};

function callOptions<T>(
  provider: ResolvedAiProvider,
  feature: AiFeature,
  request: StructuredRequest<T>,
  signal?: AbortSignal,
) {
  const policy = AI_FEATURE_POLICY[feature];
  const deadline = AbortSignal.timeout(policy.timeoutMs);
  return {
    model: configuredProviderModel(provider),
    system: request.system,
    prompt: request.prompt,
    output: Output.object({ schema: request.schema }),
    temperature: request.temperature ?? 0.2,
    maxOutputTokens: Math.max(
      64,
      Math.min(request.maxOutputTokens ?? policy.maxOutputTokens, policy.maxOutputTokens),
    ),
    maxRetries: 0,
    abortSignal: signal ? AbortSignal.any([signal, deadline]) : deadline,
  };
}

export async function generateStructured<T>(
  provider: ResolvedAiProvider,
  feature: AiFeature,
  request: StructuredRequest<T>,
  signal?: AbortSignal,
): Promise<{ output: T; model: string }> {
  const result = await generateText(callOptions(provider, feature, request, signal));
  return { output: result.output as T, model: provider.model };
}

/** Like generateStructured, but reports partial objects while the model is still writing. */
export async function streamStructured<T>(
  provider: ResolvedAiProvider,
  feature: AiFeature,
  request: StructuredRequest<T>,
  onPartial: (partial: Partial<T>) => void,
  signal?: AbortSignal,
): Promise<{ output: T; model: string }> {
  let failure: unknown;
  const result = streamText({
    ...callOptions(provider, feature, request, signal),
    onError: ({ error }) => {
      failure = error;
    },
  });
  for await (const partial of result.partialOutputStream) onPartial(partial as Partial<T>);
  if (failure) throw failure;
  return { output: (await result.output) as T, model: provider.model };
}
