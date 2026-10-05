import { currentProfile, requireSession } from '$lib/server/auth/store.server.ts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies }) => {
  const profile = currentProfile()!;
  const current = requireSession(profile, cookies);
  return json({
    passkeys: profile.passkeys.map(({ id, name, createdAt }) => ({
      id,
      name,
      createdAt,
      current: current.session.credentialId === id,
    })),
    freshUntil: current.session.authenticatedAt + 5 * 60_000,
  });
};
