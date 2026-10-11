import type { Handle, HandleServerError, RequestEvent } from '@sveltejs/kit';

import { authenticatedUser } from '$lib/server/auth/store.server.ts';
import { logServerError } from '$lib/server/log.server.ts';

const PUBLIC_PATHS = new Set(['/login', '/login/', '/healthz']);
const PUBLIC_AUTH_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/auth/setup/exchange',
  '/api/auth/recovery/exchange',
  '/api/auth/passkeys/register/options',
  '/api/auth/passkeys/register/verify',
  '/api/auth/passkeys/authenticate/options',
  '/api/auth/passkeys/authenticate/verify',
]);
const SECURITY_HEADERS = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self), payment=(), usb=()',
};

function isPublic({ route, url }: RequestEvent): boolean {
  // Unmatched non-API paths render the public 404 page.
  if (route.id === null) return !url.pathname.startsWith('/api/');
  return PUBLIC_PATHS.has(url.pathname) || PUBLIC_AUTH_ROUTES.has(route.id);
}

function withSecurityHeaders(response: Response, api: boolean, https: boolean): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  // Browsers ignore HSTS over plain HTTP; localhost development and the desktop app stay on HTTP.
  if (https) headers.set('Strict-Transport-Security', 'max-age=31536000');
  if (api) headers.set('Cache-Control', 'no-store, max-age=0');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname, search } = event.url;
  const api = pathname.startsWith('/api/');
  const https = event.url.protocol === 'https:';
  if (!isPublic(event)) {
    let user;
    try {
      user = authenticatedUser(event.cookies);
    } catch (error) {
      logServerError('profile-read', error);
      return withSecurityHeaders(
        jsonError(503, 'Osobní profil nejde načíst. Uložený pokrok zůstává zachovaný.'),
        api,
        https,
      );
    }
    if (!user) {
      const denied = api
        ? jsonError(401, 'Přihlášení je vyžadováno.')
        : new Response(null, {
            status: 303,
            headers: {
              'Cache-Control': 'private, no-store, max-age=0',
              Location: `/login/?redirect=${encodeURIComponent(pathname + search)}`,
            },
          });
      return withSecurityHeaders(denied, api, https);
    }
    event.locals.user = user;
  }
  return withSecurityHeaders(await resolve(event), api, https);
};

export const handleError: HandleServerError = ({ error, event, status }) => {
  if (status !== 404)
    logServerError('unhandled', error, { route: event.route.id ?? undefined, status });
  return { message: 'Něco se nepovedlo. Uložený pokrok zůstává zachovaný.' };
};
