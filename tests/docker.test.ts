import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('Docker bootstrap nepoužívá zastaralý Corepack', () => {
  const dockerfile = read('Dockerfile');

  assert.doesNotMatch(dockerfile, /corepack\s+(?:enable|prepare|install)/u);
  assert.match(dockerfile, /npm install --global[^\n]+"pnpm@\$\{PNPM_VERSION\}"/u);
  assert.match(dockerfile, /test "\$\(pnpm --version\)" = "\$\{PNPM_VERSION\}"/u);
});

test('Dockerfile používá stejnou verzi pnpm jako packageManager', () => {
  const packageJson = JSON.parse(read('package.json')) as { packageManager?: string };
  const dockerfile = read('Dockerfile');
  const packageVersion = packageJson.packageManager?.match(/^pnpm@(.+)$/u)?.[1];
  const dockerVersion = dockerfile.match(/^ARG PNPM_VERSION=(.+)$/mu)?.[1];

  assert.ok(packageVersion, 'package.json musí pinovat pnpm');
  assert.equal(dockerVersion, packageVersion);
});

test('lokální instalační návody nevedou přes zabudovaný Corepack', () => {
  for (const path of ['README.md']) {
    const content = read(path);
    assert.doesNotMatch(content, /corepack enable/u, `${path} stále doporučuje corepack enable`);
    assert.match(content, /npm install --global pnpm@11\.20\.0/u, `${path} nepinoval pnpm`);
  }
});
