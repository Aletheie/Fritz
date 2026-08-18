import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultRoots = ['.svelte-kit/output/client', 'build/client', 'static'].map((entry) =>
  path.join(projectRoot, entry),
);

const textExtensions = new Set([
  '.css',
  '.csv',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.svg',
  '.ts',
  '.txt',
  '.webmanifest',
  '.xml',
  '.yaml',
  '.yml',
]);

const secretPatterns = [
  { id: 'private-key', pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/gu },
  { id: 'google-api-key', pattern: /AIza[0-9A-Za-z_-]{30,}/gu },
  { id: 'openai-style-key', pattern: /\bsk-(?:proj-)?[0-9A-Za-z_-]{20,}\b/gu },
  { id: 'github-token', pattern: /\b(?:ghp|gho|ghu|ghs|github_pat)_[0-9A-Za-z_]{20,}\b/gu },
  { id: 'aws-access-key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/gu },
] as const;

export type LeakageFinding = {
  path: string;
  rule: string;
};

function knownFixture(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 40), index + 100).toLocaleLowerCase('en-US');
  return /(?:fake|fixture|placeholder|test-key|example|replace-with)/u.test(window);
}

async function walk(root: string): Promise<string[]> {
  const info = await stat(root).catch(() => undefined);
  if (!info) return [];
  if (info.isFile()) return [root];
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(root, entry.name);
      if (entry.isSymbolicLink()) return [];
      if (entry.isDirectory()) return walk(target);
      return entry.isFile() ? [target] : [];
    }),
  );
  return nested.flat();
}

export async function scanPublicArtifacts(roots = defaultRoots): Promise<LeakageFinding[]> {
  const files = (await Promise.all(roots.map(walk))).flat();
  const scannedFiles = await Promise.all(
    files.map(async (file): Promise<LeakageFinding[]> => {
      const relative = path.relative(projectRoot, file) || path.basename(file);
      const basename = path.basename(file);
      if (/^\.env(?:\.|$)/u.test(basename) && !basename.endsWith('.example')) {
        return [{ path: relative, rule: 'runtime-env-file' }];
      }
      if (path.extname(file) === '.map') {
        return [{ path: relative, rule: 'source-map' }];
      }
      if (!textExtensions.has(path.extname(file).toLocaleLowerCase('en-US'))) return [];
      const info = await stat(file);
      if (info.size > 8 * 1024 * 1024) return [];
      const contents = await readFile(file, 'utf8');
      const findings: LeakageFinding[] = [];
      for (const { id, pattern } of secretPatterns) {
        pattern.lastIndex = 0;
        for (const match of contents.matchAll(pattern)) {
          if (!knownFixture(contents, match.index ?? 0)) {
            findings.push({ path: relative, rule: id });
            break;
          }
        }
      }
      return findings;
    }),
  );

  return scannedFiles.flat().toSorted((left, right) => left.path.localeCompare(right.path));
}

async function main(): Promise<void> {
  const requested = process.argv.slice(2).map((entry) => path.resolve(projectRoot, entry));
  const roots = requested.length > 0 ? requested : defaultRoots;
  const findings = await scanPublicArtifacts(roots);
  if (findings.length > 0) {
    for (const finding of findings) console.error(`${finding.rule}: ${finding.path}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Leakage scan PASS: ${roots.length} scoped public/distribution roots, no secret values printed.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
