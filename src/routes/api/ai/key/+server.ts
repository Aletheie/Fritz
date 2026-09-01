import { json } from '@sveltejs/kit';

import { keyStatus } from '$lib/server/ai/key-vault.server.ts';

import type { RequestHandler } from './$types';

// AI configuration is deliberately read-only from the browser. Provider keys belong in the
// private deployment environment and are never accepted through an HTTP request.
export const GET: RequestHandler = ({ cookies }) => json(keyStatus(cookies));
