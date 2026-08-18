import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/lib/domain/course/course-expansion.ts')) {
            return 'course-expansion';
          }
        },
      },
    },
  },
  server: {
    host: process.env.WORTLY_DEV_LAN === 'true' ? '0.0.0.0' : '127.0.0.1',
  },
});
