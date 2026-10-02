import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { generateStructured } from '$lib/server/ai/client.server.ts';
import { parseAiConnection } from '$lib/server/ai/connection-policy.ts';
import {
  clearUserAiConnection,
  localProvidersAllowed,
  storeUserAiConnection,
  userAiEnabled,
} from '$lib/server/ai/connection-store.server.ts';
import {
  aiErrorResponse,
  assertRateLimit,
  assertSameOrigin,
  readJsonRequest,
} from '$lib/server/ai/http.server.ts';
import { keyStatus } from '$lib/server/ai/key-vault.server.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies }) => json(keyStatus(cookies));

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event, true);
  assertRateLimit(event, 6, 10 * 60_000);
  if (!userAiEnabled())
    return json({ error: 'Vlastní AI připojení je na tomto serveru vypnuté.' }, { status: 403 });
  const connection = parseAiConnection(
    await readJsonRequest(event, 3_072),
    localProvidersAllowed(),
  );
  if (!connection)
    return json(
      {
        error:
          'Zkontroluj poskytovatele, ID modelu, API klíč a adresu API. Vzdálená adresa musí používat HTTPS.',
      },
      { status: 400 },
    );
  const { provider: id, ...configuration } = connection;
  try {
    await generateStructured({
      access: {
        mode: 'byok-only',
        source: 'user',
        allowFallback: false,
        sponsored: false,
        providers: [{ id, ...configuration, allowLocal: localProvidersAllowed() }],
      },
      feature: 'explain',
      schema: z.object({ status: z.literal('ok') }),
      system: 'This is a connection test. Return the JSON object {"status":"ok"}.',
      prompt: 'Confirm the connection with status ok.',
      maxOutputTokens: 256,
      signal: event.request.signal,
    });
  } catch (error) {
    return aiErrorResponse(error);
  }
  try {
    storeUserAiConnection(event.cookies, connection, event.url.protocol === 'https:');
  } catch {
    return json(
      {
        error:
          'Připojení funguje, ale server nemůže bezpečně uložit klíč. Zkontroluj zapisovatelnou datovou složku serveru.',
      },
      { status: 503 },
    );
  }
  return json(keyStatus(event.cookies));
};

export const DELETE: RequestHandler = (event) => {
  assertSameOrigin(event, true);
  clearUserAiConnection(event.cookies);
  return json(keyStatus(event.cookies));
};
