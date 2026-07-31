import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Svelte 5, runes mode only. `runes: true` is deliberate rather than left to
// auto-detection: a component that happens to contain no rune would otherwise
// compile in legacy mode, and legacy reactivity is not something this project
// wants to acquire by accident.
export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    runes: true
  }
};
