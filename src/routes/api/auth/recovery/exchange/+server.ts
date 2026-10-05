import { authMutation, exchangeRecovery } from '$lib/server/auth/passkeys.server.ts';

export const POST = authMutation(exchangeRecovery);
