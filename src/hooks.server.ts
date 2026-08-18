import type { Handle } from '@sveltejs/kit';

import { authenticatedUser } from '$lib/server/auth/store.server.ts';

function isPublicRequest(event: Parameters<Handle>[0]['event']): boolean {
  const pathname = event.url.pathname;
  return (
    (event.route.id === null && !pathname.startsWith('/api/')) ||
    pathname === '/login' ||
    pathname === '/login/' ||
    pathname === '/healthz' ||
    pathname.startsWith('/api/auth/')
  );
}

export const handle: Handle = async ({ event, resolve }) => {
  if (!isPublicRequest(event)) {
    const user = authenticatedUser(event.cookies);
    if (!user) {
      if (event.url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Přihlášení je vyžadováno.' }), {
          status: 401,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      const destination = `${event.url.pathname}${event.url.search}`;
      return new Response(null, {
        status: 303,
        headers: { location: `/login/?redirect=${encodeURIComponent(destination)}` },
      });
    }
    event.locals.user = user;
  }

  const response = await resolve(event);
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

  if (event.url.pathname.startsWith('/api/')) {
    headers.set('Cache-Control', 'no-store, max-age=0');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
