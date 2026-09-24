# Review brief — Phase 3-8-1

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** working tree against `HEAD`).
- **Phase:** 3-8-1 — the local raw UI: the model and the coordination. Defined in
  `docs/decisions/3-split-notes.md` §2, step 3-8, and its 2026-09-24 addendum (the cut into
  3-8-1 / 3-8-2 / 3-8-3). Rulings 11, 12, 13, 30 and §4.2 of that record bind it. It builds on
  3-7 (`docs/decisions/3-7-notes.md`: commands `match_item_text` / `save_match_item_text`,
  `CommandError::ItemTextRefused`).
- **Goal:** a browser raw-snippet model (`src/lib/browser/rawSnippet.ts`) that loads one snippet's
  Rust-cut owned text, drafts and saves it; `\r` refused at load, edit and send; draft retained under
  conflict/refusal; `ItemRangeNotContiguous` offers the whole-document editor; a committed save
  retires old identities; an uncertain write keeps the text and needs reconciliation; **CF-55's model
  half on both raw surfaces** (under one held save *Undo*/*Redo* neither enabled nor mutating, in
  `rawEditor.ts` and the new model). No component draws anything new (3-8-2 does); no window reading.
- **Changed files:** `src/lib/browser/rawSnippet.ts` (new), `rawSnippet.test.ts` (new),
  `rawEditor.ts`, `rawEditor.test.ts`, `workspace.svelte.ts` (a new `matchItemText` read and a
  seventh writer `saveMatchItemText` sharing one body with `saveMatch` — a sizeable refactor),
  `workspace.test.ts`, `src/lib/i18n/{en,es}.json`, `index.ts`, five component test stubs,
  `CLAUDE.md`, `docs/decisions/3-8-1-notes.md` (new), `docs/decisions/3-split-notes.md` (the cut
  addendum), `PROGRESS.json`.
- **Verification run (all exit 0):** `cargo test --workspace -- --test-threads=1` (1465 passed,
  33 result lines); `npm test` 3727 passed (77 files); `npm run check` 468 files 0/0;
  `npm run build` 202 modules; the worker also ran clippy `-D warnings`, `cargo fmt --check` and
  `cargo tree -p espansoconfig-core | rg tauri` (empty). No Rust source changed.
- **Risks to probe:**
  1. The `saveMatch` / `saveMatchItemText` shared-body refactor in `workspace.svelte.ts`: any
     behaviour change for the existing match-editor save path (cache coherency, stale identities,
     committed-write-never-an-error, uncertain outcomes, conflict adoption through
     `adoptDiskVersion`).
  2. CF-55: do `canUndoEdit`/`canRedoEdit` agree with the transitions in every state, and does no
     transition mutate under a held save, on both surfaces?
  3. `\r` refusal at all three points; no JavaScript slicing of byte spans.
  4. The identity retirement after commit (adopting `saved.moved`; saving disabled without it) and
     the uncertain-write reconciliation (`reconcileWithDisk`) — can a stale draft be sent to a new
     revision, or consent be spent on a different text?
  5. Records that claim a guarantee the code does not give (CLAUDE.md §5) — in the notes, the
     `CLAUDE.md` edit and the module comments.
- **Review file:** `docs/reviews/phase-3-8-1.md`.
- **Time budget:** 15 minutes.
