import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true,
    }),
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'base-uri': ['none'],
        'object-src': ['none'],
        'frame-ancestors': ['none'],
        'form-action': ['self'],
        'script-src': ['self'],
        // Dynamic progress values currently use safe Svelte style attributes. This exception is
        // limited to CSS; scripts remain nonce/hash protected without dynamic code evaluation.
        'style-src': ['self', 'unsafe-inline'],
        'connect-src': ['self'],
        'img-src': ['self', 'data:', 'blob:'],
        'font-src': ['self'],
        'media-src': ['self', 'blob:'],
        'worker-src': ['self'],
        'manifest-src': ['self'],
      },
    },
  },
};

export default config;
