import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { AI_FEATURE_POLICY } from '$lib/domain/ai/policy.ts';
import { generateStructured, streamStructured } from './client.server.ts';
import { aiErrorResponse, assertRateLimit, readJsonRequest } from './http.server.ts';
import { resolveAiProvider } from './key-vault.server.ts';

import type { AiFeature } from '$lib/domain/ai/policy.ts';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import type { StructuredRequest } from './client.server.ts';

export type AiContext = {
  event: RequestEvent;
  /** False when no provider is connected; endpoints then answer with deterministic demo data. */
  live: boolean;
  generate<T>(request: StructuredRequest<T>): Promise<{ output: T; model: string }>;
  stream<T>(
    request: StructuredRequest<T>,
    onPartial: (partial: Partial<T>) => void,
  ): Promise<{ output: T; model: string }>;
};

/**
 * Shared AI endpoint envelope: per-route rate limit, bounded JSON body, schema validation and
 * client-safe errors. `handle` returns either a JSON payload or a ready Response.
 */
export function aiEndpoint<Input>(
  feature: AiFeature,
  schema: z.ZodType<Input>,
  invalidMessage: string,
  handle: (input: Input, ai: AiContext) => unknown,
): RequestHandler {
  const policy = AI_FEATURE_POLICY[feature];
  return async (event) => {
    try {
      assertRateLimit(event, policy.requestsPer10Min);
      const input = schema.parse(await readJsonRequest(event, policy.maxInputBytes));
      const provider = resolveAiProvider(event.cookies);
      const result = await handle(input, {
        event,
        live: Boolean(provider),
        generate: (request) => {
          if (!provider) throw new Error('No AI provider is connected.');
          return generateStructured(provider, feature, request, event.request.signal);
        },
        stream: (request, onPartial) => {
          if (!provider) throw new Error('No AI provider is connected.');
          return streamStructured(provider, feature, request, onPartial, event.request.signal);
        },
      });
      return result instanceof Response ? result : json(result);
    } catch (value) {
      if (value instanceof z.ZodError) return json({ error: invalidMessage }, { status: 400 });
      return aiErrorResponse(value);
    }
  };
}

/**
 * Streams newline-delimited JSON events. Failures become a final `{ type: 'error' }` line with
 * the same client-safe message a JSON endpoint would return.
 */
export function ndjsonResponse(run: (send: (event: object) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await run(send);
      } catch (value) {
        const failure = aiErrorResponse(value);
        const payload = (await failure.json().catch(() => ({}))) as { error?: string };
        send({ type: 'error', status: failure.status, error: payload.error ?? 'AI selhala.' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}
