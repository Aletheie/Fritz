import { authMutation, exchangeSetup } from '$lib/server/auth/passkeys.server.ts';

export const POST = authMutation(exchangeSetup);
