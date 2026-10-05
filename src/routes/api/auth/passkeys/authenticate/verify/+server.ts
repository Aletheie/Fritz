import { authMutation, authenticationVerify } from '$lib/server/auth/passkeys.server.ts';

export const POST = authMutation(authenticationVerify);
