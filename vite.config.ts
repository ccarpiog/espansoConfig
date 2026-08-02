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
 *
 * A function rather than an object because one option has to exist under
 * `vitest` and be **absent** — not empty — everywhere else. See `resolve` below.
 */
export default defineConfig(({ mode }) => {
  const underTest = mode === 'test';
  return {
    plugins: [svelte()],
    // Tauri serves the built assets from a custom protocol, so every asset
    // reference has to be relative to the document rather than to a server root.
    base: './',
    clearScreen: false,
    // **Present only under `vitest`, and spread rather than set to `[]`.**
    // Svelte publishes a server build and a client build through conditional
    // exports, and outside a browser-shaped resolution the server one wins —
    // under which `mount()` throws `lifecycle_function_unavailable`, which is
    // what a first attempt at `src/lib/components/RawEditor.test.ts` really did.
    //
    // `resolve.conditions` **replaces** Vite's defaults rather than adding to
    // them, which is why this is a conditional spread and not
    // `conditions: underTest ? ['browser'] : []`. That second form was written
    // first, and it silently cost the production build its `browser` condition:
    // `vite build` began pulling in `svelte/src/internal/server/render-context.js`
    // and externalising `node:async_hooks`. Both directions were checked by
    // running `npm run build` and reading its output.
    ...(underTest ? { resolve: { conditions: ['browser'] } } : {}),
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
      // **The default stays `node`, and that is the decision, not an omission.**
      // Phase 2c-1b took the `jsdom` decision the split reserved for it
      // (`docs/decisions/2c-split-notes.md` section 7) and took it *scoped*: a
      // component test opts in with a `/** @vitest-environment jsdom */` docblock
      // of its own, and every other file in the suite still runs in an
      // environment with no DOM at all. Two reasons for the narrow form rather
      // than a global switch. A model that can only be tested with a DOM present
      // is a model that has drifted into the component, and this project's whole
      // idiom — `src/lib/browser/` holds what a test can reach — depends on
      // noticing that; and the existing six components are deliberately **not**
      // back-filled, so "this file mounts something" stays visible in the file.
      //
      // `environmentMatchGlobs` is gone in vitest 4, so the docblock is the
      // supported way to say it per file.
      environment: 'node',
      include: ['src/**/*.test.ts', 'scripts/lint/**/*.test.ts']
    }
  };
});
