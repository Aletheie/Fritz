import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { createProviderFetch } from './provider-fetch.server.ts';

import type { LanguageModel } from 'ai';
import type { ResolvedAiProvider } from './key-vault.server.ts';

export function configuredProviderModel(
  provider: ResolvedAiProvider,
  fetchOverride?: typeof fetch,
): LanguageModel {
  if (provider.id === 'google-gemini') {
    return createGoogleGenerativeAI({
      apiKey: provider.apiKey,
      fetch:
        fetchOverride ?? createProviderFetch('https://generativelanguage.googleapis.com/v1beta'),
    })(provider.model);
  }
  if (provider.id === 'anthropic') {
    return createAnthropic({
      apiKey: provider.apiKey,
      fetch: fetchOverride ?? createProviderFetch('https://api.anthropic.com/v1'),
    })(provider.model);
  }
  if (!provider.baseURL) throw new Error('AI provider base URL is missing.');
  const openAI = new URL(provider.baseURL).hostname === 'api.openai.com';
  return createOpenAICompatible({
    name: 'configured-compatible',
    baseURL: provider.baseURL,
    apiKey: provider.apiKey || undefined,
    fetch: fetchOverride ?? createProviderFetch(provider.baseURL, provider.allowLocal),
    supportsStructuredOutputs: true,
    transformRequestBody: (body) => {
      const transformed = { ...body };
      // Let the selected model choose its supported sampling defaults (including reasoning models).
      delete transformed.temperature;
      if (openAI && transformed.max_tokens !== undefined) {
        transformed.max_completion_tokens = transformed.max_tokens;
        delete transformed.max_tokens;
      }
      const mode = provider.outputMode ?? 'schema';
      if (mode !== 'schema' && transformed.response_format) {
        const format = transformed.response_format as { json_schema?: { schema?: unknown } };
        transformed.messages = [
          {
            role: 'system',
            content: `Return only a JSON object matching this JSON Schema. Do not use markdown fences.\n${JSON.stringify(format.json_schema?.schema)}`,
          },
          ...(transformed.messages as unknown[]),
        ];
        if (mode === 'json') transformed.response_format = { type: 'json_object' };
        else delete transformed.response_format;
      }
      return transformed;
    },
  }).chatModel(provider.model);
}
