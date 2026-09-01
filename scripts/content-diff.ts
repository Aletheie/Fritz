import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { coursePathChapters } from '../src/lib/domain/course/path.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chapterIndex = process.argv.indexOf('--chapter');
const chapterId = chapterIndex >= 0 ? process.argv[chapterIndex + 1] : undefined;
const chapter = coursePathChapters.find((candidate) => candidate.id === chapterId);
if (!chapter) {
  console.error('Použití: pnpm content:diff --chapter <existující-chapter-id>');
  process.exit(2);
}

const file = path.join(root, 'content-staging', `${chapter.id}.candidate.json`);
const staged = JSON.parse(await readFile(file, 'utf8')) as {
  status?: string;
  candidate?: {
    lexemes?: unknown[];
    modelSentences?: unknown[];
    dialogue?: unknown[];
    assessment?: unknown;
  };
};
console.log(
  JSON.stringify(
    {
      chapterId: chapter.id,
      production: {
        lexemes: chapter.words.length,
        modelSentences: chapter.modelSentences.length,
        dialogueTurns: chapter.dialogue.length,
        assessment: Boolean(chapter.assessment),
      },
      staging: {
        status: staged.status ?? 'invalid',
        lexemes: staged.candidate?.lexemes?.length ?? 0,
        modelSentences: staged.candidate?.modelSentences?.length ?? 0,
        dialogueTurns: staged.candidate?.dialogue?.length ?? 0,
        assessment: Boolean(staged.candidate?.assessment),
      },
      publishAllowed: false,
    },
    null,
    2,
  ),
);
