/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const worker = globalThis.self as unknown as ServiceWorkerGlobalScope;
const CACHE_PREFIX = 'wortly-shell-';
const CACHE = `${CACHE_PREFIX}${version}`;
const ROOT_SHELL = '/';
const PRECACHE = [...new Set([...build, ...files])].filter(isSafePrecachePath);
const PRECACHE_PATHS = new Set(
  PRECACHE.map((path) => new URL(path, worker.location.origin).pathname),
);
const SAFE_STATIC_TYPES = [
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/manifest+json',
  'application/json',
  'font/',
  'image/',
];

function isSafePrecachePath(path: string): boolean {
  const url = new URL(path, worker.location.origin);
  return (
    url.origin === worker.location.origin &&
    !url.pathname.startsWith('/api/') &&
    (!url.pathname.startsWith('/audio/') || url.pathname === '/audio/manifest.json') &&
    url.pathname !== '/healthz' &&
    !url.search &&
    !url.hash
  );
}

function cachePolicyAllows(response: Response, expected: 'html' | 'static'): boolean {
  if (!response.ok || response.redirected) return false;
  if (response.type !== 'basic' && response.type !== 'default') return false;
  const cacheControl = (response.headers.get('cache-control') ?? '').toLocaleLowerCase('en-US');
  if (/\bno-store\b|\bprivate\b/u.test(cacheControl)) return false;
  const contentType = (response.headers.get('content-type') ?? '').toLocaleLowerCase('en-US');
  return expected === 'html'
    ? contentType.includes('text/html')
    : SAFE_STATIC_TYPES.some((allowed) => contentType.startsWith(allowed));
}

worker.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(PRECACHE);
      const shell = await fetch(ROOT_SHELL, { cache: 'reload', redirect: 'error' });
      if (!cachePolicyAllows(shell, 'html')) {
        throw new Error('Kořenový app shell nelze bezpečně uložit do offline cache.');
      }
      await cache.put(ROOT_SHELL, shell);
      return undefined;
    }),
  );
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(async (keys) => {
        await Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        );
        return undefined;
      }),
      worker.clients.claim(),
    ]).then(() => undefined),
  );
});

worker.addEventListener('message', (event) => {
  if (event.data === 'WORTLY_SKIP_WAITING') void worker.skipWaiting();
});

worker.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== worker.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(ROOT_SHELL)) ?? Response.error();
      }),
    );
    return;
  }

  // Only immutable/build and explicitly shipped static files are cached. Unknown same-origin GETs
  // stay network-only, so query URLs and private documents cannot grow cache without a bound.
  if (!PRECACHE_PATHS.has(url.pathname) || url.search) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (cachePolicyAllows(response, 'static')) await cache.put(url.pathname, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    }),
  );
});
