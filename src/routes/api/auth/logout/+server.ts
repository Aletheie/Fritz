import { json } from '@sveltejs/kit';

import { assertSameOrigin } from '$lib/server/ai/http.server.ts';
import { clearSession } from '$lib/server/auth/store.server.ts';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = (event) => {
  assertSameOrigin(event, true);
  clearSession(event.cookies);
  return json({ authenticated: false });
};
