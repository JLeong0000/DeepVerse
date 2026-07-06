import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // precache the app shell + wasm; the 135 MB bible.db is too big to precache, so it is
        // runtime-cached (CacheFirst) — after the first load the whole app works offline.
        globPatterns: ['**/*.{js,css,html,wasm}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/bible.db'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'bible-db',
              expiration: { maxEntries: 1 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'DeepVerse',
        short_name: 'DeepVerse',
        description: 'Offline-first Bible study — English next to the original languages.',
        theme_color: '#1c1813',
        background_color: '#f2ede2',
        display: 'standalone',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    // bible.db smoke test loads a large file into wasm; give it room.
    testTimeout: 30000,
  },
});
