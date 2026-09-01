import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanRoots = ['src/routes', 'src/lib/components', 'src/lib/i18n', 'src/lib/domain/course'].map(
  (entry) => path.join(root, entry),
);

async function copyFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return copyFiles(target);
      return /\.(?:svelte|ts)$/u.test(entry.name) ? [target] : [];
    }),
  );
  return nested.flat();
}

const bannedPhrases = [
  'Wortly',
  'Skvělá práce',
  'Něco se pokazilo',
  'učební příběh',
  'připravený/á',
  'naučil/a',
  'jistý/á',
  'vybavil/a',
] as const;
const genderSlash = /\p{L}+\/(?:a|á|ka|ky|ý|ého|ému|ou|ovi)\b/gu;
const findings: string[] = [];

const existingRoots = (
  await Promise.all(
    scanRoots.map(async (directory) => {
      try {
        await readdir(directory);
        return directory;
      } catch {
        return undefined;
      }
    }),
  )
).filter((directory): directory is string => Boolean(directory));
const files = (await Promise.all(existingRoots.map(copyFiles))).flat();
const sources = await Promise.all(
  files.map(async (file) => ({ file, contents: await readFile(file, 'utf8') })),
);
for (const { file, contents } of sources) {
  const relative = path.relative(root, file);
  for (const phrase of bannedPhrases) {
    if (contents.includes(phrase)) findings.push(`banned-phrase “${phrase}”: ${relative}`);
  }
  genderSlash.lastIndex = 0;
  if (genderSlash.test(contents)) findings.push(`slash-gender-copy: ${relative}`);
}

if (findings.length > 0) {
  for (const finding of findings.toSorted()) console.error(finding);
  process.exitCode = 1;
} else {
  console.log('Copy check PASS: no vague fallback phrases or slash-gender wording.');
}
