import { json } from '@sveltejs/kit';

import { authenticatedUser } from '$lib/server/auth/store.server.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies }) => {
  const user = authenticatedUser(cookies);
  return json({ authenticated: Boolean(user), username: user?.username });
};
