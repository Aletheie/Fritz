import { json } from '@sveltejs/kit';

import { clearUserAiConnection } from '$lib/server/ai/connection-store.server.ts';
import { assertSameOrigin } from '$lib/server/ai/http.server.ts';
import { clearSession } from '$lib/server/auth/store.server.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = (event) => {
  assertSameOrigin(event, true);
  clearSession(event.cookies);
  clearUserAiConnection(event.cookies);
  return json({ authenticated: false });
};
