I found two High-severity issues.

1. **High — The generated frontend can crash on the declared minimum macOS version**

   Files: [vite.config.ts](/Users/ccarpio/Developer/espansoConfig/vite.config.ts:24), [tauri.conf.json](/Users/ccarpio/Developer/espansoConfig/src-tauri/tauri.conf.json:35), [dictionaries.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/dictionaries.ts:81), [AppShell.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/AppShell.svelte:26)

   Concrete reproduction: the bundle declares macOS 11.0 support but targets Safari 16 and retains `Object.hasOwn`. An unpatched macOS 11 WKWebView lacks that API. Initial rendering calls `t('language.active', params)`, reaches `Object.hasOwn`, and throws `TypeError: Object.hasOwn is not a function`, potentially leaving a blank window.

   Minimal fix: either raise `minimumSystemVersion` to a Safari-16-era macOS, or target the oldest supported WebKit and replace/polyfill `Object.hasOwn`, e.g. `Object.prototype.hasOwnProperty.call(params, name)`.

2. **High — `core:default` is not a minimal capability and includes local-file access**

   File: [default.json](/Users/ccarpio/Developer/espansoConfig/src-tauri/capabilities/default.json:4)

   Concrete reproduction: under resolved Tauri 2.11.5, `core:default` expands to path, event, window, webview, image, menu and tray defaults. In particular, the image defaults include `allow-from-path` and `allow-rgba`. Compromised renderer code can load a local image path and retrieve its pixels even though the phase claims to grant no filesystem permission. It also permits frontend menu/tray mutation and event emission despite none being needed.

   Minimal fix: use an empty permission list—or remove the capability—until frontend Tauri APIs are actually introduced, then enumerate individual permissions.

3. **Medium — The “never hardcode a user-facing string” rule is already violated**

   Files: [main.ts](/Users/ccarpio/Developer/espansoConfig/src/main.ts:13), [main.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/main.rs:26), [Info.plist](/Users/ccarpio/Developer/espansoConfig/src-tauri/Info.plist:25), [index.html](/Users/ccarpio/Developer/espansoConfig/index.html:2), [1b-1-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1b-1-notes.md:272)

   Concrete reproductions:

   - A missing `#app` produces a fixed English exception.
   - Webview startup failure produces a fixed English panic message.
   - Finder’s Get Info shows “MIT licensed. See LICENSE.” in English under a Spanish locale.
   - Before JavaScript runs—or if it fails—the document declares `lang="en"` for Spanish users.
   - The default macOS menu remains unlocalized, explicitly admitted at notes lines 293–297.

   The product name itself is a reasonable proper-noun exception; these other strings are not.

   Minimal fix: add localized error keys where the frontend can render them; use localized bundle resources for plist/menu/startup text; set the detected document language before mounting. Do not mark this phase complete against the non-negotiable rule while the menu remains open.

4. **Medium — The production CSP unnecessarily permits inline styles**

   Files: [tauri.conf.json](/Users/ccarpio/Developer/espansoConfig/src-tauri/tauri.conf.json:26), [1b-1-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1b-1-notes.md:216)

   Concrete reproduction: injected markup such as `<style>main{display:none} body::before{content:"Re-enter credentials"}</style>` is accepted by the production CSP. The inspected production bundle emits an external CSS asset, so production does not need `'unsafe-inline'`; only Vite development does.

   Minimal fix: keep the production `csp` without `'unsafe-inline'` and place the relaxed policy in Tauri’s development-only CSP setting.

5. **Medium — The test cannot establish that translations are Spanish**

   Files: [1b-1-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1b-1-notes.md:93), [dictionaries.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/dictionaries.test.ts:56)

   Concrete reproduction: change Spanish `"language.label"` to `"Sprache"`. It remains nonblank, trimmed, unequal to English, and contains no placeholders; every dictionary test passes. Therefore the claim that runtime tests cover “whether a Spanish value is actually Spanish” is false. They establish only non-identity.

   Minimal fix: rename/document the assertion as an untranslated-value heuristic. Actual language correctness requires reviewed expected translations or a bilingual review gate.

6. **Medium — “Follow the system” stops following while the app remains open**

   File: [locale.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/stores/locale.svelte.ts:60)

   Concrete reproduction: start with `navigator.languages = ['en']` and no override, then change the platform preference to Spanish and dispatch `languagechange`. `system` is the immutable value computed at line 64, so `current` remains English until restart.

   Minimal fix: make `system` reactive and refresh it from `platformLanguageTags()` on `window.languagechange`, or explicitly narrow the claim to “detected at startup.”

7. **Low — Duplicate JSON keys bypass every compile-time and runtime parity check**

   Files: [dictionaries.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/dictionaries.ts:36), [dictionaries.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/dictionaries.test.ts:35)

   Concrete reproduction: put `"app.name": "Nombre accidental"` earlier in `es.json` and retain the final `"app.name": "espansoConfig"`. TypeScript 6.0.3 reports no diagnostic; the JSON import exposes only the final property, and all runtime tests pass. A translator editing the first occurrence sees their change silently discarded.

   Minimal fix: add a JSON duplicate-key lint/parser check.

   The central distinct-key guarantee is otherwise true: under pinned TypeScript 6.0.3 and this tsconfig, missing and surplus Spanish keys fail compilation; numeric and nested-object values also fail. Key order is irrelevant, and `dictionaries.ts` is included in type-checking.

8. **Low — The “core crate is linked into the shell” test names a stronger property than it checks**

   Files: [commands.rs](/Users/ccarpio/Developer/espansoConfig/src-tauri/src/commands.rs:22), [1b-1-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1b-1-notes.md:17)

   Concrete reproduction: the only core reference is inside `#[cfg(test)]`. A production build contains no core reference, while the test passes. The notes themselves acknowledge this at lines 209–214.

   Minimal fix: rename the assertion to “the core dependency is callable from the test target,” or introduce a real non-test reference before claiming production linkage.

9. **Low — The required Node runtime is not pinned or declared**

   Files: [package.json](/Users/ccarpio/Developer/espansoConfig/package.json:1), [package-lock.json](/Users/ccarpio/Developer/espansoConfig/package-lock.json:1706)

   Concrete reproduction: on Node 18, installation is not prohibited by the project manifest, but Vite 8 requires Node `^20.19.0 || >=22.12.0`; frontend commands then warn or fail depending on npm configuration.

   Minimal fix: add the matching `engines.node` constraint and pin the development runtime through the project’s chosen version-manager file.

Confirmed claims: regional locale negotiation, empty-language fallback, invalid stored overrides, absence-of-override persistence, SSR-safe storage access, frontend/dist wiring, `.gitignore` coverage, and the no-Tauri-in-core dependency rule all hold. No private corpus content was accessed, and none of the synthetic fixtures appears in the changed file set.

Codex session ID: 019fb70a-5ebe-7973-a012-a13b1de9be02
Resume in Codex: codex resume 019fb70a-5ebe-7973-a012-a13b1de9be02
