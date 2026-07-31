import { svelte } from '@sveltejs/vite-plugin-svelte';
// `vitest/config` rather than `vite` so the `test` block below is type-checked
// instead of being an unknown extra property.
import { defineConfig } from 'vitest/config';

/**
 * Vite configuration for the espansoConfig frontend.
 *
 * The dev server is pinned to a fixed port with `strictPort` because
 * `src-tauri/tauri.conf.json` hard-codes `devUrl` to the same port: if Vite
 * silently moved to the next free port, the Tauri window would load nothing and
 * the failure would look like a frontend bug rather than a port collision.
 */
export default defineConfig({
  plugins: [svelte()],
  // Tauri serves the built assets from a custom protocol, so every asset
  // reference has to be relative to the document rather than to a server root.
  base: './',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // macOS-only target (plan section 10), so the build may assume a current
    // WebKit rather than the lowest common denominator of the open web.
    target: 'safari16'
  },
  test: {
    // Every test here is either pure or reads only what it is handed, so no DOM
    // implementation is needed. Adding jsdom later is a deliberate decision, not
    // a default.
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/lint/**/*.test.ts']
  }
});
