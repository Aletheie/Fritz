import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { assertRateLimit, assertSameOrigin, readJsonRequest } from '$lib/server/ai/http.server.ts';
import { authenticate, createSession, hasAccount } from '$lib/server/auth/store.server.ts';

import type { RequestHandler } from './$types';

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(500),
});

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event, true);
  assertRateLimit(event, 8, 10 * 60_000);

  if (!hasAccount()) {
    return json(
      { error: 'Účet zatím není vytvořen. Vytvoř ho příkazem v Docker terminálu.' },
      { status: 503 },
    );
  }

  try {
    const body = loginSchema.parse(await readJsonRequest(event, 4_096));
    if (!authenticate(body.username, body.password)) {
      return json({ error: 'Nesprávné přihlašovací údaje.' }, { status: 401 });
    }
    createSession(event.cookies, event.url.protocol === 'https:');
    return json({ authenticated: true });
  } catch (value) {
    if (value instanceof z.ZodError) {
      return json({ error: 'Uživatelské jméno nebo heslo má neplatný formát.' }, { status: 400 });
    }
    throw value;
  }
};
