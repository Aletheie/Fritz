import { authMutation, registrationOptions } from '$lib/server/auth/passkeys.server.ts';

export const POST = authMutation(registrationOptions);
