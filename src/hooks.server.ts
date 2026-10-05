import type { Handle } from '@sveltejs/kit';

import { authenticatedUser } from '$lib/server/auth/store.server.ts';

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

function isPublicRequest(event: Parameters<Handle>[0]['event']): boolean {
  const pathname = event.url.pathname;
  return (
    (event.route.id === null && !pathname.startsWith('/api/')) ||
    pathname === '/login' ||
    pathname === '/login/' ||
    pathname === '/healthz' ||
    PUBLIC_AUTH_ROUTES.has(event.route.id ?? '')
  );
}

function secureResponse(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);

  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set(
    'Permissions-Policy',
    'camera=(), geolocation=(), microphone=(self), payment=(), usb=()',
  );

  if (pathname.startsWith('/api/')) {
    headers.set('Cache-Control', 'no-store, max-age=0');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const handle: Handle = async ({ event, resolve }) => {
  const pathname = event.url.pathname;
  if (!isPublicRequest(event)) {
    let user;
    try {
      user = authenticatedUser(event.cookies);
    } catch {
      return secureResponse(
        new Response(
          JSON.stringify({
            error: 'Osobní profil nejde načíst. Uložený pokrok zůstává zachovaný.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          },
        ),
        pathname,
      );
    }
    if (!user) {
      const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
      const response = pathname.startsWith('/api/')
        ? new Response(JSON.stringify({ error: 'Přihlášení je vyžadováno.' }), {
            status: 401,
            headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
          })
        : new Response(null, {
            status: 303,
            headers: {
              ...headers,
              Location: `/login/?redirect=${encodeURIComponent(`${pathname}${event.url.search}`)}`,
            },
          });
      return secureResponse(response, pathname);
    }
    event.locals.user = user;
  }

  return secureResponse(await resolve(event), pathname);
};
