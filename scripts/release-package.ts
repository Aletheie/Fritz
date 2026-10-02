import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanPublicArtifacts } from './leakage-scan.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const includeDirectories = ['.github', 'desktop', 'scripts', 'src', 'static', 'tests'];
const includeFiles = new Set([
  '.dockerignore',
  '.editorconfig',
  '.env.docker.example',
  '.env.example',
  '.gitignore',
  '.nvmrc',
  '.oxfmtrc.json',
  '.oxlintrc.json',
  'compose.yaml',
  'content-staging/README.md',
  'Dockerfile',
  'LICENSE',
  'package.json',
  'playwright.config.ts',
  'playwright.performance.config.ts',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'README.md',
  'svelte.config.js',
  'tsconfig.json',
  'vite.config.ts',
]);

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relative = path.posix.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Release allowlist odmítá symlink: ${relative}`);
      if (entry.isDirectory()) return walk(relative);
      if (entry.name.endsWith('.md') && entry.name !== 'README.md') return [];
      return entry.isFile() ? [relative] : [];
    }),
  );
  return nested.flat();
}

const files = [
  ...includeFiles,
  ...(await Promise.all(includeDirectories.map(walk))).flat(),
].toSorted();

await Promise.all(
  files.map(async (file) => {
    if (
      /^(?:\.env|build|node_modules|artifacts|\.svelte-kit)(?:\/|$)/u.test(file) &&
      !/\.env(?:\.docker)?\.example$/u.test(file)
    ) {
      throw new Error(`Zakázaný release asset: ${file}`);
    }
    const info = await stat(path.join(root, file));
    if (!info.isFile()) throw new Error(`Release asset není běžný soubor: ${file}`);
  }),
);

const persistent = process.argv.includes('--package');
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'fritz-release-'));
const outputDirectory = persistent ? path.join(root, 'artifacts/release') : temporaryRoot;
await mkdir(outputDirectory, { recursive: true });
const listPath = path.join(temporaryRoot, 'files.txt');
const archivePath = path.join(outputDirectory, 'fritz-source.tar.gz');
await writeFile(listPath, `${files.join('\n')}\n`, { mode: 0o600 });

const packed = spawnSync('tar', ['-czf', archivePath, '-T', listPath], {
  cwd: root,
  env: { ...process.env, COPYFILE_DISABLE: '1' },
  encoding: 'utf8',
});
if (packed.status !== 0) throw new Error(`Release archive selhal: ${packed.stderr.trim()}`);

const listed = spawnSync('tar', ['-tzf', archivePath], { encoding: 'utf8' });
if (listed.status !== 0) throw new Error(`Release listing selhal: ${listed.stderr.trim()}`);
const archivedFiles = listed.stdout.trim().split('\n').filter(Boolean).toSorted();
if (JSON.stringify(archivedFiles) !== JSON.stringify(files)) {
  throw new Error('Obsah release archivu neodpovídá explicitnímu allowlistu.');
}

const extracted = path.join(temporaryRoot, 'unpacked');
await mkdir(extracted);
const unpacked = spawnSync('tar', ['-xzf', archivePath, '-C', extracted], { encoding: 'utf8' });
if (unpacked.status !== 0)
  throw new Error(`Release verification selhalo: ${unpacked.stderr.trim()}`);
const leakage = await scanPublicArtifacts([extracted]);
if (leakage.length > 0) {
  throw new Error(`Release leakage scan selhal: ${leakage.map((item) => item.rule).join(', ')}`);
}

const digest = createHash('sha256')
  .update(await readFile(archivePath))
  .digest('hex');
if (persistent) {
  await writeFile(
    path.join(outputDirectory, 'fritz-source.tar.gz.sha256'),
    `${digest}  fritz-source.tar.gz\n`,
  );
  await writeFile(path.join(outputDirectory, 'fritz-source.files.txt'), `${files.join('\n')}\n`);
}
console.log(
  `Release allowlist PASS: ${files.length} files; archive SHA-256 ${persistent ? 'recorded' : 'verified'} without exposing contents.`,
);
await rm(temporaryRoot, { recursive: true, force: true });
