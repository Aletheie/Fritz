import { json } from '@sveltejs/kit';

import { enrollmentPurpose } from '$lib/server/auth/passkeys.server.ts';
import { accessMode, authenticatedUser, currentProfile } from '$lib/server/auth/store.server.ts';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies }) => {
  const user = authenticatedUser(cookies);
  const profile = currentProfile();
  return json({
    authenticated: Boolean(user),
    username: user?.username,
    accountId: user?.accountId,
    accountCreatedAt: user?.accountCreatedAt,
    accessMode: accessMode(),
    enrollmentPending: Boolean(enrollmentPurpose(cookies)),
    enrollmentPurpose: enrollmentPurpose(cookies),
    setupRequired: accessMode() === 'web' && !profile?.passwordHash && !profile?.passkeys.length,
    loginMethods: profile?.passkeys.length
      ? ['passkey']
      : profile?.passwordHash
        ? ['password']
        : [],
  });
};
