# Phase 1b-1 — the shell, the scaffold and i18n

Phase 1b-1 is the first commit in this repository that contains a user interface. It builds three
things and deliberately stops there:

1. **`src-tauri/`** — a Tauri v2 application shell that opens a window, holds the IPC boundary and
   owns no domain logic. Bundle identifier `cc.carpio.espansoConfig` (plan §10).
2. **`src/`** — a Svelte 5 + TypeScript + Vite frontend in runes mode, strict everywhere, whose
   whole visible surface is a header, a placeholder and a language picker.
3. **The i18n layer, in both languages, with the key set enforced by the compiler.**

**Out of scope, deliberately not started:** every IPC command (`commands.rs` is a documented empty
module), every event (`events.rs` likewise), and the Rust-code→string dictionaries — `DiagnosticCode`,
`UnknownReason`, `WorkspaceError`, `IdentityError`, `MatchBadge`. Those are Phase 1b-2. The
three-pane browser and search are Phase 1c; CodeMirror is Phase 3.

Acceptance is `npm run check` (0 errors, 0 warnings over 328 files), `npm test` (71 tests in 8 files)
and the unchanged Rust suite, now **472 tests** — Phase 1a's 471 plus one that asserts the core
dependency is callable from `src-tauri`'s test target.

The phase was **held open by its own adversarial review**
([`docs/reviews/phase-1b-1-shell-and-i18n.md`](../reviews/phase-1b-1-shell-and-i18n.md)) and nothing
was committed until every finding was closed or rejected in writing. §11 is the disposition. Where a
finding showed a sentence in this document to be false, the sentence is corrected in place rather
than annotated below — the counts above are the post-review ones.

---

## 1. Versions, and why each one is pinned to an exact number

Every dependency in `package.json` is pinned exactly, with no `^`. A caret range on a toolchain this
young means the next `npm install` on a different machine can produce a different `svelte-check`
verdict from the same source, and a lint whose answer depends on when you ran it is not a lint.
`package-lock.json` is committed for the same reason `Cargo.lock` is (`.gitignore` already says so
for the Rust side: "this ships as a binary, not a library").

| Package | Pin | Why this one |
|---|---|---|
| `svelte` | 5.56.8 | Svelte 5 is plan §6.1's choice. Runes mode is forced on in `svelte.config.js` rather than left to auto-detection — a component containing no rune would otherwise silently compile in legacy mode, and legacy reactivity is not something to acquire by accident. |
| `vite` | 8.2.0 | Latest, and the only major `@sveltejs/vite-plugin-svelte@7` accepts (`^8.0.0`). |
| `@sveltejs/vite-plugin-svelte` | 7.2.0 | The version whose peer range matches the svelte and vite pins above. |
| `typescript` | 6.0.3 | **Not the latest.** TypeScript 7.0.2 is out, but `svelte-check@4.7.4` declares `typescript: ^5.0.0 \|\| ^6.0.0`. 6.0.3 is the newest release the whole toolchain claims to support, and running outside a declared peer range to gain nothing is how a type checker starts producing answers nobody can reproduce. Revisit when svelte-check widens its range. |
| `svelte-check` | 4.7.4 | Latest. It is the only thing that type-checks `.svelte` files, so it, not `tsc`, is `npm run check`. |
| `vitest` | 4.1.10 | Latest, and the natural runner for a Vite project: it reuses `vite.config.ts`, so the tests compile `.svelte.ts` rune modules through exactly the plugin the app uses. |
| `@tauri-apps/cli` | 2.11.4 | Added as a **devDependency and driven through `npm run tauri`**, not installed globally. A globally installed CLI is a machine fact that no clone inherits; a devDependency is checked into the lockfile. |
| `@tauri-apps/api` | 2.11.1 | The frontend half of the IPC boundary. Unused in 1b-1 and present on purpose, so 1b-2 adds a command without also adding a dependency. |
| `@types/node` | 26.1.2 | Only the lint scanner's test reads the filesystem; nothing in `src/` does. |
| `tauri` / `tauri-build` (Rust) | `2` via `[workspace.dependencies]`, resolving to 2.11.5 / 2.6.3 | Declared in the **root** `Cargo.toml` alongside every other pinned version, so the workspace cannot end up with two Tauris. It is inheritable, not inherited: `espansoconfig-core` does not name it. §5. |

`rust-version` stays at 1.82 and the workspace builds; Tauri 2.11 did not push the MSRV past it.

### The Node runtime, which the first version of this phase forgot to pin

Pinning every package and then leaving the *interpreter* unpinned is half a lockfile. Vite 8
requires Node `^20.19.0 || >=22.12.0`; on Node 18 an install is not prohibited by anything in the
repository and the frontend commands then warn or fail depending on npm's configuration — a failure
whose message points at Vite rather than at the machine. So:

- **`package.json` declares `engines.node: "^20.19.0 || >=22.12.0"`**, copied from what Vite 8
  actually requires rather than invented. npm surfaces a mismatch as `EBADENGINE`.
- **`.nvmrc` pins `26.5.0`**, the development runtime, in the exact-version style the rest of the
  toolchain uses. **The suite in this document was verified on Node 26.5.0 with npm 11.17.0.**
- **`engine-strict` is deliberately *not* set** in an `.npmrc`. It applies to every transitive
  dependency's declaration as well as to ours, and a dependency that *enumerates* majors
  (`^20 || ^22`) rather than stating a floor would then fail an install on a newer Node that works
  perfectly well. The declaration is a warning that names the real requirement, which is what was
  missing; turning it into a hard gate would buy a different class of false failure.

---

## 2. The typed key union — what it enforces, and how

Plan §9 asks for "a typed key union so a missing key is a compile error". That sentence has two
directions and the obvious implementation only covers one.

`src/lib/i18n/dictionaries.ts`:

```ts
export type TranslationKey = keyof typeof en;

export type ExactDictionary<T> = Record<TranslationKey, string> &
  Record<Exclude<keyof T, TranslationKey>, never>;

const spanish: ExactDictionary<typeof es> = es;
```

- **`TranslationKey` is derived from `en.json`.** The English file *is* the schema. There is no
  second declaration of the key set anywhere, so there is nothing for the key set to drift against.
  `t('nope')` is a type error.
- **The first half of `ExactDictionary` catches a key missing from `es.json`.**
- **The second half catches a key that exists only in `es.json`.** This is the direction plain
  `Record<TranslationKey, string>` misses: excess-property checking does not apply to a non-literal
  assignment, so a surplus Spanish key would have been accepted silently. Mapping every surplus key
  to `never` makes it unassignable.

**The oracle can disagree, and this was checked rather than assumed.** Four disabling experiments,
each run and then reverted:

| Experiment | `npm run check` | `npm test` |
|---|---|---|
| Remove the `@ts-expect-error` above the missing-key pin | 1 error, naming `'app.tagline'` as missing | — |
| Remove the `@ts-expect-error` above the surplus-key pin | 1 error, `Type 'string' is not assignable to type 'never'` | — |
| Add `probe.key` to `en.json` only | 5 errors | 3 failures |
| Add `probe.key` to `es.json` only | 2 errors | 1 failure |

`src/lib/i18n/types.test.ts` holds the pins permanently. Each is an `@ts-expect-error` on a line that
must not compile; TypeScript reports an *unused* `@ts-expect-error` as an error of its own, so if the
union were ever widened to `string`, or the exactness constraint dropped, `npm run check` fails on
those exact lines instead of quietly passing. `svelte-check`'s `tsconfig.json` includes
`src/**/*.ts` and `scripts/lint/**/*.ts`, which was confirmed by planting a type error in
`scripts/lint/hardcoded-strings.ts` and watching it get reported.

`npm run check` runs with `--fail-on-warnings`, so "0 errors 0 warnings" is enforced rather than
observed.

### What the type system cannot see

- **Whether a Spanish value was left as its English one.** `"language.label": "Language"` in
  `es.json` type-checks. Covered at runtime by `dictionaries.test.ts` (§3) — but only as an
  *identity* check. Nothing here, and nothing in this repository, establishes that a value is in
  Spanish; see §3 for the precise shape of that limit.
- **Whether the two locales agree on their `{placeholder}` tokens.** A translator dropping
  `{language}` produces a string that type-checks and renders. Covered at runtime.
- **A key declared twice in the same JSON file.** `{"a": 1, …, "a": 2}` is legal JSON; the import
  exposes the last occurrence and every check downstream of the parse sees a consistent object. The
  review found this and it is now covered by a scanner over the **raw file text**,
  `scripts/lint/duplicate-json-keys.ts` (§3).
- **Anything about `Cargo`-side codes**, which do not exist yet. 1b-2.

---

## 3. The runtime dictionary checks, and the exception list

`src/lib/i18n/dictionaries.test.ts`:

- **Key-set parity is asserted from the files**, `Object.keys(en)` against `Object.keys(es)`, never
  from a hand-written list. It duplicates the compile-time check on purpose: a compile-time check
  that has been accidentally loosened leaves no trace, and this one would notice. It is guarded by a
  companion assertion that the key set is non-empty, so an empty-file bug cannot satisfy it
  vacuously.
- **Placeholder sets must match** between locales, per key.
- **Every value must be a non-blank, already-trimmed string** in both locales.
- **No Spanish value may be byte-identical to its English one** unless it is on an explicit list.

### What that last check is, exactly — and what it is not

It is an **untranslated-value heuristic**. It fires when a translator copied the English string
instead of translating it, which is the mistake that actually happens. It establishes **non-identity
and nothing else**.

The first version of this document said these tests covered "whether a Spanish value is actually
Spanish". That is false, and the review demonstrated it with a one-line counterexample: set
`es.json`'s `language.label` to `"Sprache"` and every assertion in the file still passes — the value
is non-blank, trimmed, unequal to English, and carries the same placeholders. The suite name, the
test name and both module doc comments now say *untranslated-value heuristic*, because this
project's standing rule is that **an oracle must be able to disagree**, and a test whose name claims
more than its body can fail on is the exact failure mode the risk register calls R24.

Establishing that a value is Spanish needs a bilingual reviewer or a set of reviewed expected
translations. Neither is automatable here, so it is a hole (§9) rather than a check.

### Duplicate keys, which no assertion about a parsed object can see

`scripts/lint/duplicate-json-keys.ts` reads the **text** of `en.json` and `es.json` and reports a key
declared twice inside one object. It has to read the text: `JSON.parse` accepts the document and
keeps the last occurrence, so the compile-time exactness constraint, the key-set parity assertion and
the untranslated-value heuristic all see one clean object and pass. A translator who edits the first
of two `"app.name"` lines watches the change vanish with no error from anything.

Run against `es.json` with a duplicate `app.name` planted: `npm run check` reported **0 errors, 0
warnings**, the 22 other dictionary tests **all passed**, and the new scanner failed with
`src/lib/i18n/es.json:3 duplicate key "app.name", first seen on line 2`. That is the whole argument
for its existence, reproduced rather than asserted.

The exception list is a `Map<TranslationKey, string>` of key to *reason*, and it is asserted in three
directions so it cannot rot into a suppression list:

| Key | Reason it is identical |
|---|---|
| `app.name` | the product name, a proper noun |
| `language.english` | an endonym: a language is offered under its own name |
| `language.spanish` | an endonym: a language is offered under its own name |

1. A key not on the list whose values are identical → fail (the check itself).
2. A key **on** the list whose values have since **diverged** → fail. A stale exception is a bug.
3. A key on the list that is not a real key → fail.

Direction 2 is the one that matters: without it, the list only ever grows and only ever silences.

---

## 4. Locale detection and the override policy

Plan §9: "Language follows the system locale, with a manual override in preferences."

**Detection.** `platformLanguageTags()` in `src/lib/stores/locale.svelte.ts` reads
`navigator.languages` — the full ordered list, not `navigator.language`, which is only its head. In a
macOS WKWebView that list is the system's language order. `negotiateLocale()` then takes **the first
tag the app can actually serve**: a user whose macOS order is `fr, es, en` gets Spanish, where taking
the head would have given them English. Only the primary subtag is compared, so `es-419`, `es-MX` and
`es` all resolve to `es`; the dictionaries do not distinguish regions and pretending otherwise would
promise an `es-MX` translation that does not exist.

**Override.** Persisted in `localStorage` under `espansoconfig.locale.override`. Chosen because it is
the only durable store the frontend can reach with **no IPC command**, and 1b-1 has no commands by
design. In a Tauri v2 webview it lives in the app's own WebKit data directory, so it is per-app and
survives restarts.

**The one claim worth pinning: "follow the system" is stored as the *absence* of an override, never
as a snapshot.** A snapshot implementation — writing `"en"` when the user picks "follow the system"
while macOS is in English — passes every obvious test and then silently freezes the choice the day
the user changes macOS's language. `locale.store.test.ts` has a test for exactly that sequence.

**The same claim, within one run — and the first version of this phase lost it there.** `system` was
negotiated once at construction from an array of tags handed in by the caller, so changing the
platform language while the app was open left "follow the system" following a language the system
had stopped using, until the next restart. The review found it. The fix is two changes with one
idea behind them:

- `createLocaleState` takes a **function** that reads the platform tags, not a captured array. A
  captured array is a snapshot, and this section is entirely about why snapshots are the wrong
  shape for this.
- The store subscribes to `window`'s **`languagechange`** event and re-negotiates `system` from a
  fresh reading. The event target is a two-method parameter (`LanguageChangeTarget`), so the
  behaviour is testable in the `environment: 'node'` runner with a plain object and no DOM.

`refreshSystem()` writes `system` and **never touches `override`**. That asymmetry is the point and
has its own test: a user who chose Spanish keeps Spanish when macOS switches to English. An
operating-system preference must not overwrite an explicit one — that would be a different and worse
bug than the one being fixed.

The listener is removed by `dispose()`. The application-wide instance never calls it, which is not a
leak: that instance lives exactly as long as the document holding the listener, so there is nothing
left behind. Every instance a test builds does call it, and one test asserts the listener count goes
1 → 0 and that a detached store stops following the platform.

Storage is a **port** (`LocaleStorage`, two methods) rather than a direct `localStorage` call, for
two reasons: the policy is testable with no DOM, and when Phase 2 introduces a real preferences file
the migration touches one adapter and no policy. `webLocaleStorage()` is inert outside a browser and
wraps every access in a `try`, because WebKit privacy settings make `localStorage` *throw* rather
than return `null`, and failing to remember a language preference must never stop the app starting.

**Reactivity.** `t()` reads `locale.current` — a `$state` — on every call, so any Svelte 5 template
calling `t(...)` re-renders when the language changes. No component subscribes to anything and there
is no reload.

**The document language is written twice, on purpose.** A screen reader picks its voice from
`document.documentElement.lang`, so it has to be right from the first painted frame and has to stay
right afterwards. `App.svelte`'s `$effect` only delivers the second half — an effect runs *after* the
first render, so a Spanish user's opening frame declared English. `bootstrap()` in
`src/lib/bootstrap.ts` writes the negotiated locale before the mount, and the effect keeps it in step
with both things that can change it later (the picker, and a platform `languagechange`).

`bootstrap()` exists as its own module for exactly one reason: **the claim is an order, and an order
inside `main.ts` cannot be tested.** `main.ts` imports Svelte's `mount` and a real component, so
exercising it needs a DOM implementation this project has not adopted (§9 hole 2). Taking the
document and the mount call as arguments moves the ordering somewhere a plain object can check it —
`bootstrap.test.ts` reads `documentElement.lang` *inside* the mount callback, so moving the
assignment after the mount fails the test rather than passing on the final value.

---

## 5. The architecture rule, and the check that replaces the old one

CLAUDE.md §3: `crates/espansoconfig-core` must never depend on `tauri`, directly or transitively.

**The old check is now dead.** `rg -c tauri Cargo.lock` stopped meaning anything the moment
`src-tauri/` existed, because the lockfile legitimately contains tauri. Quoting it as evidence after
this phase would be quoting a check that cannot fail. From here the check is:

```sh
cargo tree -p espansoconfig-core | rg tauri     # must find NOTHING; rg exits 1
```

Run at the end of this phase: **no output, `rg` exit status 1.** The rule holds.

Three structural supports, so the rule does not rest on the check alone:

- `crates/espansoconfig-core/Cargo.toml` carries the prohibition as a comment block at the top of
  `[dependencies]`, and its dependency list is four crates long.
- `tauri` and `tauri-build` are declared in the **root** `[workspace.dependencies]`, which makes them
  available for inheritance but does not confer them. `espansoconfig-core` does not name them.
- The edge is *used* only in the direction that is allowed: `src-tauri` depends on the core by path.

---

## 6. The Tauri shell, and what it deliberately does not contain

`src-tauri/src/main.rs` builds a window and runs. That is the entire program. `commands.rs` and
`events.rs` exist as modules whose doc comments say what they will hold and why neither could
honestly be written first:

- **`commands.rs`** — 1b-2 adds plan §6.4's read-only five: `open_workspace`, `list_documents`,
  `get_document`, `get_match`, `reload_document`, each a one-to-one wrapper over
  `espansoconfig_core::workspace::Workspace`. The module records three constraints it inherits: no
  mutating command may appear before Phase 2's save transaction exists; `Workspace` takes `&mut self`
  where it fills its cache, so the Tauri state holds it behind a `Mutex`; and Rust returns codes plus
  operands, never prose — the `Display` impls are developer renderings for logs and are not the IPC
  representation.
- **`events.rs`** — every event it will carry comes from a producer that does not exist: the watcher
  (plan §6.5) and the save transaction (plan §6.6). Naming events now would be inventing a protocol
  for nobody.

`commands.rs` does carry one `#[cfg(test)]` test,
`the_core_dependency_is_callable_from_the_test_target()`, which calls the pure `resolve_config_dir()`
in `crates/espansoconfig-core/src/discovery.rs` with two non-existent probe paths and asserts it
errors rather than inventing a directory. **In a non-test build the core dependency is declared but
not yet referenced**, so a production binary of this shell contains no reference to the core at all
and this test would pass unchanged if it did not. It was called
`the_core_crate_is_linked_and_callable` until the review pointed out that the name claimed the
property the body cannot fail on; the name now states only what it checks — that the dependency edge
in `Cargo.toml` resolves and 1b-2 can add commands without touching a manifest.

**Development builds and production builds are different programs, and the crate did not say so.**
`tauri::is_dev()` is literally `!cfg!(feature = "custom-protocol")`: without that feature the webview
loads `build.devUrl` and expects a Vite dev server on port 1420, and with it the webview loads the
assets embedded from `build.frontendDist` under the production `app.security.csp`. The first version
of `src-tauri/Cargo.toml` declared no such feature, which means `npm run tauri build` could not have
succeeded — and it means the hand smoke-launch this phase originally recorded was a `cargo build`
binary pointed at a dead `devUrl`. It proved a window existed and, quite literally, nothing about
what was painted in it. The feature is now declared and left off by default, so `cargo build` stays a
development build and

```sh
npm run build && cargo build -p espansoconfig --features custom-protocol
```

reproduces a production run without invoking the bundler. **That is how the CSP and the capability
set below were verified, and it is the first time anything in this project has seen the interface.**

**Security posture.**

- **CSP.** `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `object-src 'none'`,
  `base-uri 'none'`, `form-action 'none'`. **`'unsafe-inline'` is not in the production policy.** It
  was, on the argument that Vite injects component styles inline — which is true of the *dev server*
  and false of the build, where `vite build` emits `dist/assets/index-*.css` as an external
  stylesheet and `dist/index.html` contains no `<style>` element and no `style=` attribute. Under
  the old policy an injected `<style>{...}</style>` was accepted by the shipping app for the benefit
  of a tool that never runs in it. The relaxed policy now lives in `app.security.devCsp`, which
  applies only to a development build, and adds `ws://localhost:1420` for HMR while it is there.
- **Capabilities.** `capabilities/default.json` grants **`"permissions": []`** — the empty set. It
  granted `core:default`, described here as "nothing else — no filesystem permission", and that
  description was wrong: under Tauri 2.11.5 `core:default` expands to the path, event, window,
  webview, image, menu and tray defaults, and the image defaults include `image:allow-from-path` and
  `image:allow-rgba`, which let a compromised renderer load a local image path and read its pixels.
  The 1b-1 frontend calls no Tauri API whatsoever, so the minimal set is the empty one and anything
  else was a grant made by inheritance rather than by decision. The capability file itself is kept,
  with its reasoning in its own `description`, so 1b-2 adds back individual permissions rather than
  re-deriving the file. Every later phase enumerates the narrowest permissions its feature needs —
  never a wildcard, and never a `*:default` set.

**Both were verified by running the app, not by reading the config.** A production-mode binary built
as above launches, the window appears, and the interface renders completely: header, language picker
with "System language detected as English.", the placeholder heading and body, and the footer — all
of it styled from the external stylesheet, which is the CSP claim, with an empty permission list,
which is the capability claim. The process wrote nothing to stderr.

**`Info.plist`** declares `CFBundleLocalizations = [en, es]` and `CFBundleDevelopmentRegion = en`,
which is the plan §9 item that belongs to the bundle rather than to the webview.

---

## 7. The hardcoded-string check — what it sees, and what it does not

`scripts/lint/hardcoded-strings.ts` masks the `<script>`, `<style>` and comment regions of a
`.svelte` file, then walks the remaining markup and reports any run of text — or any value of a
user-visible attribute — that contains letters and did not arrive through a `{...}` expression.
`scripts/lint/hardcoded-strings.test.ts` runs it over every component under `src/` and demands
silence.

**It can see:**

- a literal in a text node, including inside `{#if}` / `{#each}` bodies;
- a literal in `title`, `placeholder`, `alt`, `label`, `aria-label`, `aria-description`,
  `aria-placeholder`, `aria-roledescription` or `aria-valuetext`.

**It cannot see, and these are holes rather than caveats:**

1. **Anything inside `<script>`.** `const label = 'Save'` followed by `{label}` in the markup is
   invisible. This is the largest hole and this technique cannot close it.
2. **Whether `{expr}` came from `t()`.** `{'Save'}` passes. The scanner checks the *shape* of the
   markup, never the provenance of a value.
3. **Strings in `.ts` and `.svelte.ts` files** — store errors, and anything a future IPC layer
   renders.
4. **Text arriving through a component prop**, `{@html}`, a CSS `content:` rule, or a native menu
   built in Rust.
5. **Attributes outside the nine above.** That list is a judgement about which attributes users read,
   not an enumeration of the platform's.

So **a clean run means "no literal is sitting in markup", not "no hardcoded string exists".** The
remainder of CLAUDE.md §2 is carried by review, and saying otherwise would be the over-claimed check
that is worse than none.

**The oracle can disagree, checked twice.** Four positive fixtures in the test file assert the
scanner *fires* (text node, `{#if}` body, attribute, correct line number), three of its blind spots
are pinned as explicitly-accepted misses so they are visible rather than implicit, and a fifth
experiment was run against the real tree: inserting `<p>Nothing is open yet</p>` into
`AppShell.svelte` produced `src/lib/components/AppShell.svelte:20:8 (text) "Nothing is open yet"` and
one failing test. Reverted.

There is also a guard that the suite is not vacuous — it asserts at least three `.svelte` files were
found — because "the check passed because it scanned nothing" is a failure mode this project has hit
before.

`scripts/lint/` now holds two more checks, both added by the review and both built the same way — a
scanner, a run over the real files demanding silence, and fixtures proving the scanner fires:
`duplicate-json-keys.ts` (§3) and `webview-floor.test.ts` (§11 finding 1). Each carries its own
vacuity guard.

---

## 8. Strings that are deliberately not translated

**This table is meant to be complete**, and the first version of it was not — the review found two
strings that reach a user and were on no list. A partial exception table is worse than none, because
its existence implies the rest were considered. Every user-reachable string outside the dictionaries
is below, each with a reason that has to survive being read aloud.

| Where | Text | Why |
|---|---|---|
| `index.html` `<title>`, `tauri.conf.json` window `title` and `productName`, `app.name` | `espansoConfig` | The product name. A proper noun. The HTML title is replaced on mount by `App.svelte`'s `<svelte:head>`, so it is only the pre-hydration value. |
| `en.json`/`es.json` `language.english`, `language.spanish` | `English`, `Español` | Endonyms. A language picker that renames Spanish to "Spanish" for an English speaker is harder to use, not easier. |
| `src/lib/bootstrap.ts` | `index.html is missing the #app mount point` | Developer-facing. It can only fire if `index.html` lost its mount point, which no user can cause and none could act on. (It lived in `src/main.ts` before the bootstrap was extracted.) |
| `src-tauri/src/main.rs` | `failed to start the espansoConfig window` | Developer-facing, and fires only when the webview cannot be created — before any interface exists to show a message *in*. |
| `index.html` `<html lang>` | `en` | Not prose: a language *tag*, and it must equal `DEFAULT_LOCALE`, because before any script runs there is no `navigator` reading to negotiate against and the fallback is the only honest static answer. Overwritten with the negotiated locale by `bootstrap()` before the first frame. Pinned by `src/lib/bootstrap.test.ts`. |
| `Info.plist` `NSHumanReadableCopyright` | `© 2026 ccarpiog · MIT` | **Changed by the review.** It was `MIT licensed. See LICENSE.` — an English *sentence* that Finder's Get Info shows verbatim to a user running macOS in Spanish, on no exception list and with its argument never made. A plist holds one value for every locale, so the fix is to hold no prose in any language: a symbol, a year, a name and an SPDX identifier. Per-locale `InfoPlist.strings` would be richer and are Phase 5's, because placing them in the bundle is bundling work. |
| `Info.plist` `CFBundleDevelopmentRegion`, `CFBundleLocalizations` | `en`, `[en, es]` | Language tags, not text. This is the declaration that *enables* localization; translating it is not a coherent operation. |
| `Info.plist` `LSApplicationCategoryType` | `public.app-category.developer-tools` | A UTI. macOS renders its own localized category name from it. |

The first two rows are on the auditable exception list in §3 and are asserted to actually be
identical. The rest are outside the scanner's reach (§7 holes 3 and 4) and are recorded here instead.

**One string that reaches a user is deliberately *not* on this table, because it is not an accepted
exception**: the macOS application menu, which is English for a Spanish user. It is an open hole, not
a justified one — §9 hole 1, including the reviewer's objection to shipping the phase with it open
and the counter-argument.

Developer-facing text — Rust and TypeScript doc comments, the `description` fields in
`tauri.conf.json` and `capabilities/default.json`, `package.json`'s `description` — is out of this
table's scope by definition and is English under CLAUDE.md §5. None of it is rendered anywhere a user
looks.

Note that JSON has no comment syntax, so the "comments in the Spanish file are in English" clause of
CLAUDE.md §2 is vacuous for `es.json`; its documentation is this file.

---

## 9. Coverage holes, stated as holes

1. **The macOS application menu is not localized.** Plan §9 asks for it and this phase does not
   deliver it. Tauri v2 builds the default menu in Rust, so localizing it means either hardcoding
   Spanish strings in Rust — which plan §9 forbids — or having the frontend hand the menu labels
   across IPC, which needs a command, which is 1b-2. `CFBundleLocalizations` is set; the menu items
   are not. **Open, and owned by 1b-2 or 1c.**

   **The review objected to this hole being open at all**, on the ground that CLAUDE.md §2 is
   non-negotiable and this phase should not be marked complete while a user-facing string is
   untranslated. The objection is recorded rather than absorbed, because it is a fair reading of the
   rule. The counter-argument, and the reason the hole stands: the two ways to close it here are
   both worse than leaving it open. Hardcoding Spanish in `main.rs` violates plan §9's "Rust returns
   codes, never prose" and puts a second, unaudited string table in a language the i18n layer cannot
   see. Handing labels across IPC needs a command, and 1b-1's defining constraint is that it has
   none — inventing one to localize a menu would mean designing the IPC surface around the first
   feature that happened to need it. The honest position is that **the menu is a defect this commit
   ships**, visible in §8, owned by 1b-2, and not disguised as a design decision. A reviewer who
   disagrees with that trade should read the disagreement as live, not as settled.
2. **No test renders a component.** The i18n layer is tested as a pure function and the components
   are only *scanned*. Nothing asserts that `AppShell` actually mounts, or that switching the picker
   re-renders the header. That needs a DOM (`jsdom` or `@testing-library/svelte`), which is a
   deliberate future decision rather than a default; `vite.config.ts` says so at the `environment:
   'node'` line. What *has* now been done, once and by hand, is a production-mode launch whose window
   was photographed rendering the whole shell (§6) — which is evidence about one build on one
   machine and is not a test. The `$effect` in `App.svelte` that keeps `documentElement.lang` in step
   is inside this hole: `bootstrap()`'s half is tested, the effect's half is not.
3. **`npm run tauri build` has never been run.** `cargo build --features custom-protocol` now
   produces a production-mode binary and it was launched (§6), so the embedded assets, the production
   CSP and the empty capability set are no longer untested. The **bundler** still is — DMG, `.app`
   layout, `Info.plist` merge (including the copyright key §8 changed), signing. That is Phase 5's
   subject (plan §10, `SIGN_AND_NOTARIZE.md`) and nothing here should be read as evidence about it.
4. **The application icon is a placeholder, not a design.** Tauri's code generator opens
   `src-tauri/icons/icon.png` unconditionally, so the crate does not compile without one. Rather than
   commit an opaque binary, `scripts/build-placeholder-icon.mjs` generates it from source with no
   dependencies (and the `.icns` via `sips`/`iconutil`). Regenerate with
   `node scripts/build-placeholder-icon.mjs`. **Replace in Phase 5.**
5. **No `src/routes/` directory.** Plan §6.1 lists one. There is no router yet — the shell is a
   single view — and an empty directory cannot be committed. It appears when 1c introduces
   navigation. This is a deviation from the plan's tree, recorded rather than silently taken.
6. **The override is not exposed "in preferences".** Plan §9 says the manual override lives in
   preferences; there is no preferences surface yet, so the picker sits in the header. When Phase 5
   builds preferences the picker moves; the store does not change.
7. **`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on from the start.** They are
   cheap now and expensive to adopt later, but they will make the 1b-2 IPC types more verbose than
   the obvious version. That is intended; it is noted here so it is not mistaken for an accident.
8. **Nothing *automatically* verifies the built `dist/` under the production CSP.** It has now been
   verified by hand once (§6, hole 3), which closes the part of this hole that said the CSP had never
   been exercised at all. What remains open is that no command in `npm test` or `cargo test` would
   notice if a future change reintroduced an inline `<style>` — that needs a launched app, and
   nothing in this repository launches one.
9. **Nothing establishes that a Spanish value is Spanish.** The dictionary suite checks identity,
   trimming, blankness and placeholder parity; `"Sprache"` in `es.json` passes all four (§3). This
   needs a bilingual reviewer or a reviewed set of expected translations, and neither is a check.
   Recorded so the suite is not read as covering more than it does.
10. **The duplicate-key scanner compares key *text*, not decoded keys.** A key written `"a"` and
    a key written `"a"` are the same key to `JSON.parse` and different to the scanner, so that one
    pathological pair would slip through. Both dictionaries use plain ASCII key names; closing this
    would mean reimplementing JSON string unescaping to catch a case nobody writes by hand.
11. **The WebKit floor is checked for *consistency*, not for correctness.**
    `scripts/lint/webview-floor.test.ts` fails when `vite.config.ts`'s esbuild target and
    `tauri.conf.json`'s `minimumSystemVersion` disagree (§11, finding 1). It cannot tell whether the
    floor is the right one, and — more importantly — **esbuild's `target` constrains syntax, not
    library APIs**. `target: 'safari16'` does not stop anyone writing a call to a method that
    appeared in Safari 17; that class of mistake is what finding 1 actually was, and only review
    catches it. Widening the floor is Phase 5's decision and would mean lowering the esbuild target,
    not just editing the plist.
12. **Per-locale `InfoPlist.strings` do not exist.** `NSHumanReadableCopyright` is locale-neutral
    instead (§8). If a later key genuinely needs prose, `en.lproj`/`es.lproj` resources are the
    answer and they are Phase 5's bundling work.

---

## 10. What Phase 1b-2 inherits

- **`t(key, params)` exists and is reactive.** Adding a Rust-code dictionary means adding keys to
  `en.json` and `es.json`; both compile-time directions and all four runtime checks then apply to
  them for free. Codes with operands already have `{placeholder}` interpolation, and the
  placeholder-parity test already covers it.
- **Unknown placeholders survive verbatim.** `t('language.active')` with no params renders
  `Interface language: {language}`. Deliberate: a visible `{language}` is a bug report, whereas
  substituting an empty string produces a sentence that reads as finished and is wrong.
- **`commands.rs` is the only file that needs to change on the Rust side**, plus one
  `invoke_handler` line in `main.rs`. The manifest already has the core, `serde` and `serde_json`;
  the frontend already has `@tauri-apps/api`.
- **The capability file starts empty and 1b-2 fills it, permission by permission.** The five
  read-only commands need `core:default`'s *event* half at most, and probably not even that; whatever
  they need gets named individually in `capabilities/default.json`. Re-adding `core:default` because
  it is the template's default would undo §6 and re-grant `image:allow-from-path`.
- **R27 still applies.** A held identity can go stale; `match_by_id` returns
  `Result<_, IdentityError>` and a lookup crossing a `refresh()` may get `StaleRevision`. The UI is
  what holds identities. Nothing in 1b-1 holds one yet.
- **D2u still applies.** Scalars arrive as source text. There is no type to render, and no badge
  derives from a value.

---

## 11. Phase 1b-1 review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-1b-1-shell-and-i18n.md`](../reviews/phase-1b-1-shell-and-i18n.md). Its verdict
was **hold the phase open**: the bundle offered itself to a macOS whose WebKit lacks an API the
frontend calls on its first render, and the capability set described here as minimal was not. Nothing
was committed until every finding was closed or rejected in writing.

**Seven of the nine are closed. Two are closed in part and rejected in part, both in finding 3.**

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | High | `Object.hasOwn` on a declared floor of macOS 11 | **Closed on both sides.** The plist was the mistake, not the target: the notes' own comment in `vite.config.ts` says the build may assume a current WebKit, so `minimumSystemVersion` is now **13.0** — macOS 13 Ventura is the release that ships Safari 16, so the declared floor and the compile target finally state the same thing. And `Object.hasOwn(params, name)` became `Object.prototype.hasOwnProperty.call(params, name)` anyway, belt and braces, because `translate()` is the one function that runs before anything exists to report an error in. A new check, `scripts/lint/webview-floor.test.ts`, fails when the two declarations disagree; its limits are hole 11. §1, §9. |
| 2 | High | `core:default` is not minimal and grants local-image access | **Closed by narrowing to the empty set.** The 1b-1 frontend calls no Tauri API, so `"permissions": []` is the correct answer and anything else was inherited rather than decided. Verified by running it, not by reasoning: a production-mode binary launches and renders the complete interface with an empty permission list. The §6 sentence claiming `core:default` granted "nothing else — no filesystem permission" is corrected in place, naming `image:allow-from-path` and `image:allow-rgba`. §6. |
| 3 | Medium | Hardcoded user-facing strings | **Two closed, two arguments upheld, one hole made explicit.** Closed: `NSHumanReadableCopyright` was an English sentence Finder shows to a Spanish user and is now locale-neutral (§8); `index.html`'s `lang` was English until JavaScript ran and is now written by `bootstrap()` **before the mount**, with an ordering test that reads the attribute inside the mount callback (§4, §9 hole 2). Upheld: the `#app` and webview-startup messages stay English — both are developer-facing, both fire only where no interface exists to render a message in, and neither is user-triggerable. Rejected as a *completion* blocker but recorded as a live disagreement: the unlocalized macOS menu, hole 1, where the reviewer's objection and the counter-argument are both written out. The §8 table is now asserted to be complete, which was the finding's real substance. |
| 4 | Medium | Production CSP permits inline styles | **Closed.** `vite build` emits an external stylesheet and `dist/index.html` contains no `<style>` and no `style=`, so only the dev server ever needed `'unsafe-inline'`. It moved to `app.security.devCsp`; production `style-src` is `'self'`. Verified by launching the production-mode build and seeing the interface fully styled. §6, and hole 8 for what is still not automatic. |
| 5 | Medium | "A Spanish value is actually Spanish" is over-claimed | **Closed by correcting the claim, not by strengthening the test** — the test cannot be strengthened without a bilingual reviewer. The suite is renamed to *the untranslated-value heuristic*, the assertion says it fires on byte-identity, and the three places that claimed more — §2's bullet, §3, and the doc comments in `dictionaries.ts` and `dictionaries.test.ts` — now state the limit and reproduce the reviewer's `"Sprache"` counterexample. Recorded as hole 9. This is R24 caught in the small: a name that claims more than its body can fail on. |
| 6 | Medium | "Follow the system" stops following | **Closed by making it reactive.** `createLocaleState` takes a *function* that reads the platform tags rather than a captured array, and re-negotiates on `window`'s `languagechange`. The asymmetry is the point and has its own test: `refreshSystem()` moves `system` and never touches `override`, so an operating-system preference cannot overwrite an explicit one. `dispose()` detaches the listener; the app-wide instance never needs it and the note says why that is not a leak. §4. |
| 7 | Low | Duplicate JSON keys bypass every check | **Closed** with `scripts/lint/duplicate-json-keys.ts`, a scanner over **raw file text** — the only place the defect exists, since `JSON.parse` keeps the last occurrence and everything downstream sees one clean object. Proven on the real file, not only on fixtures: with a duplicate `app.name` planted in `es.json`, `npm run check` reported 0 errors and the 22 other dictionary tests all passed while the scanner named the line. §3, and hole 10 for its one blind spot. |
| 8 | Low | The core-linkage test names a stronger property than it checks | **Closed by renaming.** `the_core_crate_is_linked_and_callable` → `the_core_dependency_is_callable_from_the_test_target`, and its doc comment now says outright that a production build of the shell contains no reference to the core and that this test would pass unchanged if it did not. §6 already admitted it; the name does now too. |
| 9 | Low | The Node runtime is not pinned | **Closed.** `engines.node: "^20.19.0 \|\| >=22.12.0"`, copied from Vite 8's own requirement, plus `.nvmrc` at 26.5.0. The suite was verified on Node 26.5.0 / npm 11.17.0. `engine-strict` is deliberately not set, and §1 says why. |

### One defect this round found on its own

Verifying finding 2 and finding 4 required actually running the production bundle, and it would not
run: **`src-tauri/Cargo.toml` declared no `custom-protocol` feature**, so every `cargo build` binary
loaded `build.devUrl` and showed a blank window with no Vite server behind it, and `npm run tauri
build` could not have succeeded. A static `<h1>` planted in `dist/index.html` did not render either,
which is what distinguished "the assets are not loading" from "the frontend threw". The feature is
now declared, off by default. This is the concrete cost of hole 3 having stood: the phase's original
smoke-launch was a dead `devUrl` and could not have told anyone.

### The disabling experiments

Every new check was broken deliberately, the failure recorded, and the break reverted. An oracle that
cannot disagree is not an oracle.

| # | For | What was broken | What fired |
|---|---|---|---|
| A | 1 | `minimumSystemVersion` set back to `11.0` | `is not undercut by the minimum macOS version the bundle offers itself to` — *"the build targets safari16, which first ships with macOS 13, but the bundle declares minimumSystemVersion 11.0: expected 11 to be greater than or equal to 13"*, which is the review's finding restated by the check |
| B | 7 | a second `"app.name"` planted at the top of `es.json` | the scanner alone: *"src/lib/i18n/es.json:3 duplicate key \"app.name\", first seen on line 2"*. `npm run check` reported **0 errors, 0 warnings** and the other **22** dictionary tests passed — the reviewer's claim reproduced rather than paraphrased |
| C | 3 | `bootstrap()` assigns `documentElement.lang` *after* `mountApp(target)` | `declares the interface language before the application is mounted` — *"expected 'zz' to be 'es'"*, read inside the mount callback, so the final value being right does not rescue it |
| D | 3 | `index.html`'s `lang` changed to `es` | `declares the fallback locale, which is the only honest static answer` |
| E | 6 | `refreshSystem()` emptied — the pre-review "computed once" behaviour | **four** tests, led by `moves the interface when the platform language changes and no override is set` (*"expected 'en' to be 'es'"*) |
| F | 6 | `refreshSystem()` also clears `override` — the OS overruling the user | `leaves a user who chose a language on that language` (*"expected null to be 'en'"*). E and F are separate on purpose: E proves the store follows, F proves it does not follow **too far** |
| G | 6 | `dispose()` made a no-op | `attaches exactly one listener and dispose() removes it` (*"expected 1 to be +0"*) |

F is the one to remember. The obvious experiment for finding 6 is E, and E alone would have licensed
an implementation that re-reads the platform and throws the user's choice away with it — a worse bug
than the one being fixed, and one that every other test in the file tolerates.

### What the review checked and found sound, and is therefore not re-argued here

Regional locale negotiation (`es-419`, `es-MX` → `es`), the empty-language fallback, rejection of an
invalid stored override, "follow the system" persisted as an absence, SSR-safe storage access, the
frontend-to-`dist` wiring, `.gitignore` coverage, the no-`tauri`-in-core rule, and the central
distinct-key guarantee — under the pinned TypeScript and this `tsconfig`, a missing or surplus
Spanish key fails compilation, numeric and nested-object values fail, key order is irrelevant, and
`dictionaries.ts` is inside the type-checked set.
