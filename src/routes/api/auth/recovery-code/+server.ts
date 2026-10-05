import { authMutation, replaceRecoveryCode } from '$lib/server/auth/passkeys.server.ts';

export const POST = authMutation(replaceRecoveryCode);
