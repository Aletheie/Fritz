import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { coursePathChapters } from '../src/lib/domain/course/path.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chapterIndex = process.argv.indexOf('--chapter');
const chapterId = chapterIndex >= 0 ? process.argv[chapterIndex + 1] : undefined;
const chapter = coursePathChapters.find((candidate) => candidate.id === chapterId);
if (!chapter) {
  console.error('Použití: pnpm content:generate --chapter <existující-chapter-id>');
  process.exit(2);
}

const candidate = {
  format: 'fritz-content-candidate',
  version: 1,
  status: 'human-review-required',
  generatedAt: new Date().toISOString(),
  sourceChapterId: chapter.id,
  sourceContentVersion: chapter.contentVersion,
  approvedSpec: {
    title: chapter.title,
    detailedLevel: chapter.level,
    situation: chapter.situation,
    mission: chapter.mission,
    outcomes: chapter.outcomes,
    objectiveIds: chapter.grammarLessonIds,
    targetLexemeIds: chapter.targetLexemeIds,
  },
  candidate: {
    lexemes: [],
    modelSentences: [],
    dialogue: [],
    assessment: null,
  },
  gates: [
    'schema',
    'referential-integrity',
    'cefr',
    'lexical-morphology',
    'duplicate',
    'human-diff',
  ],
};

const directory = path.join(root, 'content-staging');
await mkdir(directory, { recursive: true });
const target = path.join(directory, `${chapter.id}.candidate.json`);
await writeFile(target, `${JSON.stringify(candidate, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
console.log(
  `Staging candidate vytvořen: ${path.relative(root, target)}. Produkční katalog nebyl změněn.`,
);
