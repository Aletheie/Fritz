import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type ArchitectureBaseline = {
  legacyReactiveStatements: Record<string, number>;
  routeLineLimits: Record<string, number>;
  newRouteLineLimit: number;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'src');
const baseline = JSON.parse(
  await readFile(path.join(root, 'scripts/architecture-baseline.json'), 'utf8'),
) as ArchitectureBaseline;

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

function importSpecifiers(contents: string): string[] {
  return [...contents.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/gu)].map(
    (match) => match[1],
  );
}

const findings: string[] = [];
const files = await sourceFiles(sourceRoot);
const sources = await Promise.all(
  files.map(async (file) => ({ file, contents: await readFile(file, 'utf8') })),
);
for (const { file, contents } of sources) {
  const relative = path.relative(root, file);
  const imports = importSpecifiers(contents);

  if (/\.forEach\s*\(/u.test(contents)) findings.push(`array-for-each: ${relative}`);
  if (contents.includes('$app/stores')) findings.push(`legacy-app-store: ${relative}`);
  if (
    !relative.includes('/server/') &&
    !relative.endsWith('/+server.ts') &&
    !relative.endsWith('/hooks.server.ts') &&
    imports.some((specifier) => specifier.includes('.server'))
  ) {
    findings.push(`server-import-outside-server: ${relative}`);
  }
  if (relative.startsWith('src/lib/domain/')) {
    if (
      imports.some(
        (specifier) =>
          specifier === 'svelte' ||
          specifier.startsWith('svelte/') ||
          specifier.startsWith('$app/') ||
          specifier.startsWith('$env/') ||
          /(?:^|\/)data(?:\/|$)/u.test(specifier) ||
          /(?:^|\/)state(?:\/|$)/u.test(specifier),
      )
    ) {
      findings.push(`domain-layer-import: ${relative}`);
    }
    if (/\b(?:indexedDB|IDBDatabase|IDBTransaction)\b/u.test(contents)) {
      findings.push(`domain-browser-storage: ${relative}`);
    }
  }

  if (relative.startsWith('src/routes/') && relative.endsWith('+page.svelte')) {
    const lineCount = contents.split(/\r?\n/u).length;
    const limit = baseline.routeLineLimits[relative] ?? baseline.newRouteLineLimit;
    if (lineCount > limit) findings.push(`route-size ${lineCount}>${limit}: ${relative}`);
  }

  const reactiveCount = contents.match(/^\s*\$:/gmu)?.length ?? 0;
  const reactiveLimit = baseline.legacyReactiveStatements[relative] ?? 0;
  if (reactiveCount > reactiveLimit) {
    findings.push(`legacy-reactivity ${reactiveCount}>${reactiveLimit}: ${relative}`);
  }
}

if (findings.length > 0) {
  for (const finding of findings.toSorted()) console.error(finding);
  process.exitCode = 1;
} else {
  console.log(
    `Architecture check PASS: ${files.length} source files; layering and complexity ratchets hold.`,
  );
}
