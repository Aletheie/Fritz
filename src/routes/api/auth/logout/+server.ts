import { json } from '@sveltejs/kit';

import { clearLegacyAiCookies } from '$lib/server/ai/connection-store.server.ts';
import { assertSameOrigin } from '$lib/server/ai/http.server.ts';
import { clearSession } from '$lib/server/auth/store.server.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event, true);
  await clearSession(event.cookies);
  clearLegacyAiCookies(event.cookies);
  return json({ authenticated: false });
};
