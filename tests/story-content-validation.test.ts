import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

import { validateStoryContent } from '../src/lib/domain/stories/validation.ts';

import type { StoryBook } from '../src/lib/domain/stories/types.ts';

test('celý katalog příběhů projde strukturální i lexikální kontrolou', async () => {
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

  const result = validateStoryContent(storyBooks);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.counts, {
    books: 25,
    episodes: 227,
    screens: 908,
    checkpoints: 454,
    glossaryEntries: 611,
    advancedGlossaryEntries: 357,
  });
});
