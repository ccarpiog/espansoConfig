# Review brief — Phase 3-11-2 (bulk selection: the components and the i18n)

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** working tree against `HEAD`)
- **Review file:** `docs/reviews/phase-3-11-2.md`
- **Time budget:** 15 minutes

## Goal
Draw the bulk model 3-11-1 built (`src/lib/browser/bulkEdit.ts`, `BrowserState.applyBulkOptions` /
`matchOptionSpellings` in `src/lib/browser/workspace.svelte.ts`): multi-select in `SnippetList.svelte`
and a new `BulkInspector.svelte` drawn by `DetailPane.svelte` — Mixed per option, seven textual option
intents, exclusions with reasons, per-file consent review, partial outcomes (exclusions and execution
failures counted apart), draft undo/redo, no disk batch undo promised. EN and ES strings through typed
accessors. Decided in the notes: **no new write-surface kind** — the inspector counts in `DetailPane`'s
`busy`, and the multi-select toggle is refused while any write surface is open.
Plan: `docs/decisions/3-split-notes.md` §2 (3-11 addendum) and §3 rulings 20–22; prior
`docs/decisions/3-11-1-notes.md`; this phase's notes `docs/decisions/3-11-2-notes.md`.

## Changed files
New: `src/lib/components/BulkInspector.svelte`, `src/lib/components/BulkInspector.test.ts`,
`docs/decisions/3-11-2-notes.md`. Modified: `src/lib/browser/bulkEdit.ts` (+17 functions),
`src/lib/browser/bulkEdit.test.ts`, `src/lib/browser/workspace.svelte.ts`,
`src/lib/components/SnippetList.svelte`, `src/lib/components/DetailPane.svelte`,
`src/lib/i18n/{codes.ts,index.ts,en.json,es.json}`, `scripts/lint/composition-guards.test.ts`.
(`PROGRESS.json` is a workflow marker — ignore.)

## Verification run (all exit 0)
`cargo test --workspace -- --test-threads=1` 1505 passed; clippy `-D warnings`; `cargo fmt --check`;
`npm run check` 479 files 0/0; `npm test` 3922 passed; `npm run build` 210 modules; bundle oracle
server-only absent, client-only present.

## Risks to probe
1. **The no-write-surface-kind decision.** Can any other writer (single-match editor, raw item, raw
   document, creation, move, duplicate, recovery, restore) open or commit while the bulk inspector holds
   a draft or an apply is in flight? Does anything rest on `busy` that a path bypasses? Does a comment or
   the notes claim a guarantee the code does not give (CLAUDE.md §5 — the worst defect class)?
2. **Decisions in components.** Anything decided in `BulkInspector.svelte` / `SnippetList.svelte` that
   belongs in `bulkEdit.ts` (CLAUDE.md §6 *Frontend structure*).
3. **Consent binding:** is the acknowledged subset sent exactly as the model bound it (selection +
   intents), and does editing an intent after review invalidate consent? Check-and-spend atomicity.
4. **Selection lifetime:** stale identities after a save/reload/external change; `selectGeneration` /
   `projectionGenerations` discipline for the new selection state on `BrowserState`; reset on workspace
   open; interaction with single selection.
5. **Text controls:** `\r` handling for inputs (CLAUDE.md §6), options stay textual (no checkboxes),
   Mixed never shown as a value that would be written.
6. **i18n:** no hardcoded user-facing strings; accessors not hand-built keys; ES present and sensible.
7. **Tests:** do the mounted tests assert the behaviour claimed (selection, Mixed, exclusion, consent,
   partial outcome, undo/redo), or only that something rendered?
