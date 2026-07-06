import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      // bible.db is large; precache the shell here and cache the DB at runtime (configured in M6).
      workbox: { globPatterns: ['**/*.{js,css,html,wasm}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
      manifest: {
        name: 'DeepVerse',
        short_name: 'DeepVerse',
        theme_color: '#1c1813',
        background_color: '#f2ede2',
        display: 'standalone',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    // bible.db smoke test loads a 90MB file into wasm; give it room.
    testTimeout: 30000,
  },
});
