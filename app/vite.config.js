import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Dev-only: onnxruntime-web loads its wasm glue via a runtime dynamic import of
// `/tts/ort/*.mjs`. Vite's dev server injects a `?import` query onto same-origin dynamic
// imports and then 500s trying to transform these emscripten glue files as source modules.
// Serve them raw (stripping the query) so Hebrew TTS works in `npm run dev`. No effect on
// the production build (apply: 'serve'), which serves public/ files statically already.
const serveTtsMjsRaw = {
  name: 'serve-tts-mjs-raw',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = (req.url || '').split('?')[0];
      if (pathname.startsWith('/tts/') && pathname.endsWith('.mjs')) {
        const file = fileURLToPath(new URL(`./public${pathname}`, import.meta.url));
        if (existsSync(file)) {
          res.setHeader('Content-Type', 'text/javascript');
          res.end(readFileSync(file));
          return;
        }
      }
      next();
    });
  },
};

// The content hash of the shipped bible.db, written by scripts/copy-assets.mjs (which runs in
// predev/prebuild, so it is always current by the time this config loads). Baked into the bundle
// rather than fetched at runtime — see the CacheFirst note on the bible.db rule below.
function bibleDbVersion() {
  try {
    const p = fileURLToPath(new URL('./public/bible-db.json', import.meta.url));
    return JSON.parse(readFileSync(p, 'utf8')).version || '';
  } catch {
    return ''; // no DB copied yet (fresh clone before install) — fall back to an unversioned URL
  }
}

export default defineConfig({
  define: { __BIBLE_DB_VERSION__: JSON.stringify(bibleDbVersion()) },
  plugins: [
    serveTtsMjsRaw,
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      // Serve the web-app manifest + a dev service worker from `npm run dev` (localhost:5173).
      // Without this, dev exposes no manifest, so Chrome can only "Create Shortcut" (favicon icon
      // on a white square) instead of a real "Install" that uses the maskable icon.
      devOptions: { enabled: true, type: 'module' },
      workbox: {
        // precache the app shell + wasm; the 150 MB bible.db is too big to precache, so it is
        // runtime-cached (CacheFirst) — after the first load the whole app works offline.
        globPatterns: ['**/*.{js,css,html,wasm}'],
        globIgnores: ['**/tts/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // CacheFirst never revalidates, which is what makes 150 MB tolerable — but it also
            // means a fixed URL would pin the FIRST database forever, so an installed PWA would
            // auto-update its code and keep serving stale Bible data. db.js therefore requests
            // `/bible.db?v=<content-hash>` (published by scripts/copy-assets.mjs): new data is a
            // new URL and a cache miss, unchanged data keeps its hash and is not re-downloaded.
            // The pattern matches on pathname, so the query is irrelevant to matching, and
            // maxEntries: 1 evicts the superseded copy rather than keeping two 150 MB entries.
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
          // macOS builds the app-shim (Dock/Launchpad) icon from the `any` icons, so these carry
          // the navy background; the transparent browser-tab favicon lives in index.html (<link rel=icon>).
          { src: '/deepverse-192-app.png', sizes: '192x192', type: 'image/png' },
          { src: '/deepverse-512-app.png', sizes: '512x512', type: 'image/png' },
          { src: '/deepverse-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
    // /tts/ort/ instead. Aliasing straight to the "extern wasm" build (which has no such static
    // reference) avoids the double-bundling without touching resolve.conditions globally — setting
    // resolve.conditions here would replace (not extend) Vite's default conditions array, dropping
    // "browser" and breaking svelte-vite-plugin's browser/client resolution of the svelte package.
    : { alias: { 'onnxruntime-web': fileURLToPath(new URL('./node_modules/onnxruntime-web/dist/ort.min.mjs', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    // bible.db smoke test loads a large file into wasm; give it room.
    testTimeout: 30000,
  },
});
