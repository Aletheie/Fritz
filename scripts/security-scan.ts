import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(target);
      return /\.(?:svelte|ts|js)$/u.test(entry.name) ? [target] : [];
    }),
  );
  return nested.flat();
}

const findings: string[] = [];
const sources = await sourceFiles(path.join(root, 'src'));
const sourceContents = await Promise.all(
  sources.map(async (file) => ({ file, contents: await readFile(file, 'utf8') })),
);
for (const { file, contents } of sourceContents) {
  const relative = path.relative(root, file);
  for (const [rule, pattern] of [
    ['raw-html', /\{@html\b/u],
    ['inner-html', /\.innerHTML\s*=/u],
    ['eval', /\beval\s*\(/u],
    ['function-constructor', /\bnew\s+Function\s*\(/u],
    ['document-write', /\bdocument\.write\s*\(/u],
  ] as const) {
    if (pattern.test(contents)) findings.push(`${rule}: ${relative}`);
  }
  const isServerOnly = /(?:\.server\.ts|\/\+server\.ts)$/u.test(relative);
  if (!isServerOnly && /\$env\/(?:static|dynamic)\/private/u.test(contents)) {
    findings.push(`private-env-client-import: ${relative}`);
  }
}

const cspConfig = await readFile(path.join(root, 'svelte.config.js'), 'utf8');
for (const directive of [
  "'default-src': ['self']",
  "'base-uri': ['none']",
  "'object-src': ['none']",
  "'frame-ancestors': ['none']",
]) {
  if (!cspConfig.includes(directive)) findings.push(`csp-missing: ${directive}`);
}
if (/unsafe-eval/u.test(cspConfig)) findings.push('csp-unsafe-eval: svelte.config.js');

const vite = await readFile(path.join(root, 'vite.config.ts'), 'utf8');
if (/host\s*:\s*true/u.test(vite)) findings.push('lan-dev-default: vite.config.ts');

const workflow = await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8');
for (const match of workflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gmu)) {
  if (!/@[0-9a-f]{40}$/u.test(match[1])) findings.push(`mutable-action: ${match[1]}`);
}

const dockerfile = await readFile(path.join(root, 'Dockerfile'), 'utf8');
if (!/^ARG NODE_IMAGE=node:[^\s]+@sha256:[0-9a-f]{64}$/mu.test(dockerfile)) {
  findings.push('docker-base-not-digest-pinned: Dockerfile');
}
const trustedDockerStages = new Set([
  '${NODE_IMAGE}',
  'base',
  'dependencies',
  'production-dependencies',
]);
if (
  [...dockerfile.matchAll(/^FROM\s+([^\s]+)/gmu)].some(
    (match) => !trustedDockerStages.has(match[1]),
  )
) {
  findings.push('docker-unpinned-from: Dockerfile');
}

if (findings.length > 0) {
  for (const finding of findings.toSorted()) console.error(finding);
  process.exitCode = 1;
} else {
  console.log(
    `Security static scan PASS: ${sources.length} runtime source files and CI/container policy.`,
  );
}
