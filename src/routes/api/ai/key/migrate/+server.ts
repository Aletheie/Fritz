import { migrateLegacyAiConnection } from '$lib/server/ai/connection-store.server.ts';
import { assertRateLimit, assertSameOrigin } from '$lib/server/ai/http.server.ts';
import { keyStatus } from '$lib/server/ai/key-vault.server.ts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event, true);
  assertRateLimit(event, 6, 10 * 60_000);
  await migrateLegacyAiConnection(event.cookies);
  return json(keyStatus(event.cookies));
};
