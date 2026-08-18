import { text } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
  text('ok', {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
