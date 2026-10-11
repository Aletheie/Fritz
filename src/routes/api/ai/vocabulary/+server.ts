import { demoVocabulary } from '$lib/server/ai/demo.server.ts';
import { aiEndpoint } from '$lib/server/ai/endpoint.server.ts';
import { vocabularyPrompt } from '$lib/server/ai/prompts.server.ts';
import { vocabularyOutputSchema, vocabularyRequestSchema } from '$lib/server/ai/schemas.server.ts';

export const POST = aiEndpoint(
  'vocabulary',
  vocabularyRequestSchema,
  'Zadání pro AI je neúplné nebo příliš dlouhé.',
  async (request, ai) => {
    if (!ai.live) return demoVocabulary(request);
    const enrich = request.mode === 'enrich';
    const { output, model } = await ai.generate({
      schema: vocabularyOutputSchema,
      ...vocabularyPrompt(request),
      temperature: enrich ? 0.1 : 0.25,
      maxOutputTokens: enrich ? 1_800 : undefined,
    });
    return { ...output, items: output.items.slice(0, enrich ? 1 : request.count), model };
  },
);
