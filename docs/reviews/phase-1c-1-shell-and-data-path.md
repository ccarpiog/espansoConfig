## High

1. Stale recovery can silently confirm a different match

File: [selection.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/selection.ts:87), especially lines 87–93 and 152–168.

Concrete failure:

- Before refresh, position 1 contains `{ trigger: ":same", replace: "body", word: "true" }`.
- Position 2 contains `{ trigger: ":same", replace: "body", word: "false" }`.
- An earlier entry is deleted, moving the second match into position 1.
- `word` is absent from `search_text`, produces no badge, and does not affect either shape code.
- The fingerprints are therefore equal, so `reresolve()` returns `sameMatch` and silently selects the wrong snippet.

The same collision applies to variables, form fields, unknown entries, non-primary content, and other options. This is substantially broader than the identical-snippet limitation admitted in [1c-1-notes.md](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1c-1-notes.md:354).

Smallest fix: do not treat this partial display fingerprint as identity evidence. Have the core provide a collision-safe fingerprint of the complete source slice and only recover when it is uniquely matchable; otherwise clear the selection as ambiguous. The safest interim behavior is to clear on stale revision.

2. Recovery installs a fresh identity over a stale cached document

File: [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:227), lines 227–245, 282–288, and 378–383.

Concrete failure:

- The cached document is revision A, with selected node 10.
- An external edit changes the document elsewhere.
- `getMatch()` returns `identityStaleRevision`; `reloadDocument()` returns revision B, where the same match is node 20.
- `applyRepair()` stores the new node-20 identity, but never replaces revision A in `views`.
- `selectedMatch` consequently returns old node 10. The list contains old rows, no row matches node 20, counts remain stale, and the detail pane renders old data.

The same omission leaves deleted or replaced snippets visible after `differentMatch` and `gone`.

Smallest fix: return or otherwise retain the reloaded `DocumentView` and atomically replace that document in `views` before applying the selection outcome.

This invalidates the notes’ claims that `selectedMatch` is live and ready for 1c-2 without another fetch ([lines 383–388](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1c-1-notes.md:383)).

## Medium

1. Overlapping selections can overwrite a newer user choice

File: [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:354), lines 354–383.

Concrete failure:

- The user clicks A; its `getMatch(A)` remains pending.
- The user clicks B; `getMatch(B)` succeeds, leaving B selected.
- A’s delayed request then returns stale and runs `applyRepair()`.
- The state is changed back to A or cleared, despite B being the latest choice.

Smallest fix: assign each selection request a generation token, or verify `selected` still represents `next` after every `await`, before applying its result.

2. Reopening retains an invalid file filter and search query

File: [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:300), lines 300–305.

Concrete failure:

- Workspace A is filtered to document ID 3 with query `sig`.
- `open()` opens workspace B, which lacks ID 3 or reuses it for another file.
- `selection` and `query` were not reset.
- The ready screen is empty or unexpectedly filtered despite B containing snippets.

Smallest fix: reset `selection` to `ALL_DOCUMENTS` and `query` at the start of `open()`. Also clear `documents` and `summary`, and use an open-generation token to prevent overlapping opens from interleaving.

3. Search omits secondary content forms

Files: [match_view.rs](/Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/model/match_view.rs:664), lines 682–684; [fixtures.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/fixtures.ts:173), lines 173–178.

Concrete failure:

- A malformed but browsable match contains `replace: alpha` and `html: needle`.
- `ContentSpec::primary()` chooses `replace`, so the core puts only `alpha` into `search_text`.
- Searching for `needle` returns no result, even though it is content in the file.

The fixture builder misleadingly adds both `replace` and `html`, unlike the real core join. Therefore the notes’ claim that it retranscribes the same join is unsupported.

Smallest fix: have `build_search_text()` add every present content scalar, not only `primary()`, and add a real projection test with multiple content forms.

4. An unreadable file produces a misleading total with no visible failure

Files: [workspace.svelte.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.svelte.ts:321), lines 321–339; [Sidebar.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/Sidebar.svelte:28), lines 28–31.

Concrete failure:

- Two files contain 2 and 100 matches.
- Reading the 100-match file fails.
- The browser reaches `ready` and displays “All 2” with a title meaning “2 snippets”.
- `pending === 1` is never rendered, and the actual error goes only to the developer console.

Smallest fix: when `pending > 0`, localize and display that the total is partial, and expose the per-file read failure in the UI. Alternatively suppress the All total until all match-bearing documents have a result.

This contradicts the justification in the notes that the All total must not become a misleading statement about only loaded files ([lines 48–52](/Users/ccarpio/Developer/espansoConfig/docs/decisions/1c-1-notes.md:48)).

5. A notice code is converted into a key instead of rendered through an accessor

Files: [notices.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/notices.ts:41), lines 41–51; [DetailPane.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/DetailPane.svelte:27).

`DetailPane` renders a code using `t(selectionNoticeKey(...))`. That is precisely the code-to-key path CLAUDE.md forbids components from using, even though the switch is exhaustive and does not concatenate strings.

Concrete failure: swapping two literal keys in `selectionNoticeKey()` still compiles and all four keys remain present and distinct, but users receive the wrong notice.

Smallest fix: add a reactive `tSelectionNotice()` accessor in the i18n layer and have the component call it directly.

I found no hardcoded user-facing prose. The three hardcoded glyphs (`⌗`, `🔒`, `–`) are presentational, aria-hidden or accompanied by translated text.

## Low

1. `buildSidebar()` does not enforce its claim that profiles never affect totals

File: [sidebar.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/sidebar.ts:118), lines 118–127.

Concrete failure: call `buildSidebar()` with a `ConfigProfile` and a known count of 5. It returns `total: 5`, despite `holdsMatches(profile)` being false.

The current workspace caller does not create such a count, but the exported model and its tests claim the stronger property.

Smallest fix: add to `total` only when `holdsMatches(document)` is true.

2. Several test names promise properties their bodies do not establish

- [sidebar.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/sidebar.test.ts:94): “does not wait for a profile, which holds no matches” never supplies a profile count, so it passes while `buildSidebar()` counts one.
- [labels.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/labels.test.ts:40): “does not … deduplicate” contains no duplicate badge.
- [notices.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/notices.test.ts:21): “sentence” checks only nonblank text; `"x"` passes.
- [notices.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/notices.test.ts:34): “different things in the two languages” never compares English with Spanish; identical translations pass.
- [selection.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/selection.test.ts:136): “visible source text” changes only the label, so an implementation ignoring trigger and content passes.
- [selection.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/selection.test.ts:241): “records … the fingerprint” never asserts the fingerprint.
- [workspace.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.test.ts:251): the stale-recovery fixture remains revision A and does not assert a fresh identity or fresh `selectedMatch`.
- [workspace.test.ts](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/workspace.test.ts:350): “dismissed and cleared independently” tests dismissal only.

Smallest fix: add the missing adversarial inputs/assertions or narrow each test name to what its body actually verifies. The notes’ claim that experiment E is already covered is false for the profile-count case.

3. The detail pane has started 1c-2’s field rendering

File: [DetailPane.svelte](/Users/ccarpio/Developer/espansoConfig/src/lib/components/DetailPane.svelte:37), lines 37–58.

It renders `trigger` and `label`, two of the 22 match fields, using list-oriented helpers that deliberately collapse several trigger forms and a trigger list to one display value.

Concrete failure: a match containing both `trigger` and `regex` appears in the detail pane with only the single trigger. In 1c-2 this block must be replaced to render the complete source shape.

Smallest fix: make the stub show only selection identity/file plus the localized placeholder, or explicitly treat this as the initial 1c-2 implementation and render all forms faithfully later. The current claim that field rendering “is not started” is inaccurate.

No privacy leak was found: the new fixtures and documented runtime corpus are neutral synthetic data. I also found no new Tauri dependency in `espansoconfig-core`, no value-derived badge or boolean rendering, and no intrinsic `$state`/`$derived` dependency-capture or effect-loop bug. The reactivity failures above are stale-cache and asynchronous race defects rather than rune tracking defects.

Codex session ID: 019fb87c-24bf-72e2-b45f-a3be06416bca
Resume in Codex: codex resume 019fb87c-24bf-72e2-b45f-a3be06416bca
