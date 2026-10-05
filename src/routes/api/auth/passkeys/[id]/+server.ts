import { authMutation, removePasskey } from '$lib/server/auth/passkeys.server.ts';

export const DELETE = authMutation(removePasskey);
