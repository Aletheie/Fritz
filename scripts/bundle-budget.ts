import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

type ManifestEntry = {
  file: string;
  imports?: string[];
  name?: string;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = path.join(root, '.svelte-kit/output/client');
const manifestPath = path.join(clientRoot, '.vite/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, ManifestEntry>;
const findings: string[] = [];

function staticClosure(entryKey: string): Set<string> {
  const keys = new Set<string>();
  const pending = [entryKey];
  while (pending.length > 0) {
    const key = pending.pop();
    if (!key || keys.has(key)) continue;
    keys.add(key);
    for (const imported of manifest[key]?.imports ?? []) pending.push(imported);
  }
  return keys;
}

async function compressedBytes(entryKeys: Iterable<string>): Promise<number> {
  const buffers = await Promise.all(
    [...entryKeys].map((key) => readFile(path.join(clientRoot, manifest[key].file))),
  );
  return buffers.reduce((sum, buffer) => sum + gzipSync(buffer).byteLength, 0);
}

const homeKey = Object.keys(manifest).find((key) => key.endsWith('/nodes/2.js'));
if (!homeKey) throw new Error('V klientském manifestu chybí domovská route. Nejdřív spusť build.');
const homeClosure = staticClosure(homeKey);
const homeGzip = await compressedBytes(homeClosure);
const homeBudget = 160 * 1024;
if (homeGzip > homeBudget) {
  findings.push(`home-static-gzip ${homeGzip}>${homeBudget}`);
}

const heavyCatalogNames = new Set([
  'coach',
  'course-expansion',
  'course-expansion-v3',
  'grammar',
  'path',
  'stories',
]);
for (const key of homeClosure) {
  const name = manifest[key]?.name;
  if (name && heavyCatalogNames.has(name)) findings.push(`home-eager-catalog ${name}`);
}

let largestRaw = { file: '', bytes: 0 };
let largestGzip = { file: '', bytes: 0 };
const javascriptAssets = await Promise.all(
  Object.values(manifest)
    .filter((entry) => entry.file.endsWith('.js'))
    .map(async (entry) => ({
      entry,
      buffer: await readFile(path.join(clientRoot, entry.file)),
    })),
);
for (const { entry, buffer } of javascriptAssets) {
  const compressed = gzipSync(buffer).byteLength;
  if (buffer.byteLength > largestRaw.bytes)
    largestRaw = { file: entry.file, bytes: buffer.byteLength };
  if (compressed > largestGzip.bytes) largestGzip = { file: entry.file, bytes: compressed };
}
if (largestRaw.bytes > 320 * 1024) {
  findings.push(`largest-js-raw ${largestRaw.bytes}>${320 * 1024}: ${largestRaw.file}`);
}
if (largestGzip.bytes > 105 * 1024) {
  findings.push(`largest-js-gzip ${largestGzip.bytes}>${105 * 1024}: ${largestGzip.file}`);
}

if (findings.length > 0) {
  for (const finding of findings.toSorted()) console.error(finding);
  process.exitCode = 1;
} else {
  console.log(
    `Bundle budget PASS: home static ${(homeGzip / 1024).toFixed(1)} KiB gzip; largest chunk ${(largestRaw.bytes / 1024).toFixed(1)} KiB raw / ${(largestGzip.bytes / 1024).toFixed(1)} KiB gzip.`,
  );
}
