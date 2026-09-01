import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('CSP is enforcing, nonce-aware and never enables unsafe-eval', () => {
  const config = source('svelte.config.js');
  for (const directive of [
    "'default-src': ['self']",
    "'base-uri': ['none']",
    "'object-src': ['none']",
    "'frame-ancestors': ['none']",
    "'form-action': ['self']",
    "'script-src': ['self']",
    "'connect-src': ['self']",
  ]) {
    assert.match(config, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
  assert.match(config, /mode: 'auto'/u);
  assert.doesNotMatch(config, /unsafe-eval/u);
});

test('dev server is localhost-only unless an explicit LAN flag is set', () => {
  const config = source('vite.config.ts');
  assert.match(config, /FRITZ_DEV_LAN/u);
  assert.match(config, /127\.0\.0\.1/u);
  assert.doesNotMatch(config, /host:\s*true/u);
});

test('service worker never caches APIs, private responses or arbitrary navigations/query URLs', () => {
  const worker = source('src/service-worker.ts');
  assert.match(worker, /pathname\.startsWith\('\/api\/'\)/u);
  assert.match(worker, /no-store/u);
  assert.match(worker, /private/u);
  assert.match(worker, /request\.mode === 'navigate'/u);
  assert.doesNotMatch(worker, /cache\.put\(request,/u);
  assert.match(worker, /PRECACHE_PATHS\.has/u);
  assert.match(worker, /FRITZ_SKIP_WAITING/u);
});

test('private Fritz PWA metadata is installable and explicitly non-indexable', () => {
  const html = source('src/app.html');
  const manifest = JSON.parse(source('static/manifest.webmanifest')) as {
    name?: string;
    short_name?: string;
    id?: string;
    start_url?: string;
    scope?: string;
    display?: string;
    icons?: Array<{ sizes?: string; purpose?: string }>;
  };

  assert.equal(manifest.name, 'Fritz – jazyková laboratoř');
  assert.equal(manifest.short_name, 'Fritz');
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons?.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'));
  assert.ok(manifest.icons?.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any'));
  assert.ok(
    manifest.icons?.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'),
  );
  assert.match(html, /<meta name="application-name" content="Fritz"/u);
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive"/u);
  assert.match(html, /<link rel="manifest"/u);
  assert.match(html, /<link rel="apple-touch-icon"/u);
});

test('permissions policy allows only this origin to use the speaking microphone', () => {
  const hook = source('src/hooks.server.ts');
  const staticHeaders = source('static/_headers');
  assert.match(hook, /microphone=\(self\)/u);
  assert.match(staticHeaders, /microphone=\(self\)/u);
  assert.doesNotMatch(hook, /microphone=\(\)/u);
  assert.doesNotMatch(staticHeaders, /microphone=\(\)/u);
});

test('BYOK validation probes the same configured model as real requests', () => {
  const client = source('src/lib/server/ai/client.server.ts');
  assert.match(client, /model: google\(aiModelId\(\)\)/u);
  assert.doesNotMatch(client, /model: google\(['"]gemini-/u);
});
