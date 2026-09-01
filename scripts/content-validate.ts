import { createServer } from 'vite';

import { validateCourseContent } from '../src/lib/domain/course/content-validation.ts';
import { validateStoryContent } from '../src/lib/domain/stories/validation.ts';

import type { StoryBook } from '../src/lib/domain/stories/types.ts';

const courseResult = validateCourseContent();
const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true, hmr: false },
});
let storyBooks: StoryBook[] = [];
try {
  const { loadStoryBooks } = (await vite.ssrLoadModule('/src/lib/domain/stories/catalog.ts')) as {
    loadStoryBooks: () => Promise<StoryBook[]>;
  };
  storyBooks = await loadStoryBooks();
} finally {
  await vite.close();
}
const storyResult = validateStoryContent(storyBooks);
const errors = [
  ...courseResult.errors.map((error) => `course: ${error}`),
  ...storyResult.errors.map((error) => `stories: ${error}`),
];

console.log(
  JSON.stringify(
    {
      course: courseResult.counts,
      stories: storyResult.counts,
    },
    null,
    2,
  ),
);
if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Content validation passed.');
}
