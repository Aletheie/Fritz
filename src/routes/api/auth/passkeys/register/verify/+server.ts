import { authMutation, registrationVerify } from '$lib/server/auth/passkeys.server.ts';

export const POST = authMutation(registrationVerify);
