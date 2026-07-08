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
        globIgnores: ['**/tts/**'],
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
          {
            urlPattern: ({ url }) => url.pathname.includes('/tts/'),
            handler: 'CacheFirst',
            options: { cacheName: 'tts-assets', expiration: { maxEntries: 8 } },
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
    // onnxruntime-web's default export condition resolves to the "bundle" build, which embeds a
    // static `new URL('ort-*.wasm', import.meta.url)` reference that Vite bundles as a ~27 MB dist/
    // asset — even though mms.js overrides ort.env.wasm.wasmPaths to load the vendored copy under
    // /tts/ort/ instead. This condition switches to the "extern wasm" build, which has no such
    // static reference, so nothing gets double-bundled.
    : { conditions: ['onnxruntime-web-use-extern-wasm'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    // bible.db smoke test loads a large file into wasm; give it room.
    testTimeout: 30000,
  },
});
