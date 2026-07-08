import { fileURLToPath } from 'node:url';
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
      includeAssets: ['deepverse-32.png', 'deepverse-180.png'],
      manifest: {
        name: 'DeepVerse',
        short_name: 'DeepVerse',
        description: 'Offline-first Bible study — English next to the original languages.',
        theme_color: '#1c1813',
        background_color: '#1c1813',
        display: 'standalone',
        icons: [
          { src: '/deepverse-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/deepverse-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/deepverse-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // Under Vitest, resolve Svelte's browser build (not the server/SSR one) so
  // @testing-library/svelte's mount() works — first component test in this repo needed this.
  // sql.js's own package.json also keys its export map off the "browser" condition, which
  // would otherwise flip it to its fetch-based browser build (fails under jsdom); alias it
  // straight to the Node build so the existing db.smoke/db.queries tests keep working.
  resolve: process.env.VITEST
    ? {
        conditions: ['browser'],
        alias: { 'sql.js': fileURLToPath(new URL('./node_modules/sql.js/dist/sql-wasm.js', import.meta.url)) },
      }
    : undefined,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    // bible.db smoke test loads a large file into wasm; give it room.
    testTimeout: 30000,
  },
});
