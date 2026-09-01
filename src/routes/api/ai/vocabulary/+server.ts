import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { generateStructured, hasLiveAiProvider } from '$lib/server/ai/client.server.ts';
import { demoVocabulary } from '$lib/server/ai/demo.server.ts';
import { aiErrorResponse, assertRateLimit, readJsonRequest } from '$lib/server/ai/http.server.ts';
import { resolveAiAccess } from '$lib/server/ai/key-vault.server.ts';
import { resolveAiPrincipal } from '$lib/server/ai/principal.server.ts';
import { vocabularyPrompt } from '$lib/server/ai/prompts.server.ts';
import { vocabularyOutputSchema, vocabularyRequestSchema } from '$lib/server/ai/schemas.server.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  assertRateLimit(event, 12, 10 * 60_000);
  const rawBody = await readJsonRequest(event, 24_576);

  try {
    const request = vocabularyRequestSchema.parse(rawBody);
    const access = resolveAiAccess(event.cookies, 'vocabulary');
    if (!hasLiveAiProvider(access)) return json(demoVocabulary(request));

    const prompt = vocabularyPrompt(request);
    const generated = await generateStructured({
      access,
      feature: 'vocabulary',
      principal: access.sponsored ? resolveAiPrincipal(event) : undefined,
      signal: event.request.signal,
      schema: vocabularyOutputSchema,
      ...prompt,
      temperature: request.mode === 'enrich' ? 0.1 : 0.25,
      maxOutputTokens: request.mode === 'enrich' ? 1_800 : 3_500,
    });

    const itemLimit = request.mode === 'enrich' ? 1 : request.count;
    const items = generated.output.items.slice(0, itemLimit);
    return json({ ...generated.output, items, model: generated.model });
  } catch (value) {
    if (value instanceof z.ZodError) {
      return json({ error: 'Zadání pro AI je neúplné nebo příliš dlouhé.' }, { status: 400 });
    }
    return aiErrorResponse(value);
  }
};
