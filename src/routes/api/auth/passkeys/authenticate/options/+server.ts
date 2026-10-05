import { authMutation, authenticationOptions } from '$lib/server/auth/passkeys.server.ts';

export const POST = authMutation(authenticationOptions);
