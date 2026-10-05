import { authMutation, logoutAll } from '$lib/server/auth/passkeys.server.ts';

export const POST = authMutation(logoutAll);
