# Review brief — phase 3-8-2

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** working tree against `HEAD`).
- **Phase:** 3-8-2 — the local raw UI: the components and the i18n (step 3-8 of `docs/decisions/3-split-notes.md` §2 and its 2026-09-24 addendum; rulings 11, 12, 13, 30). 3-8-1 (the model, `src/lib/browser/rawSnippet.ts`) is closed; 3-8-3 (window half) is later.
- **Goal:** a new `RawSnippetEditor.svelte` drawing 3-8-1's model (load via `match_item_text`, draft, save via `save_match_item_text`, refusals, conflict/refusal retention, the `ItemRangeNotContiguous` whole-document fallback, uncertain-write reconciliation / `diverged`), integrated into `DetailPane.svelte` with a new write-surface kind `rawSnippetEditor`; CF-55 (Undo/Redo disabled and non-mutating under a held save) with a mounted test on **both** raw surfaces; EN+ES wording through typed accessors.
- **Changed files:** `src/lib/components/RawSnippetEditor.svelte` (new), `RawSnippetEditor.test.ts` (new), `DetailPane.svelte`, `DetailPane.test.ts`, `RawEditor.test.ts`, `RestorePane.test.ts`; `src/lib/browser/rawSnippet.ts`, `rawSnippet.test.ts`, `restore.ts`, `restore.test.ts`, `surfaceReceivers.ts`, `writeSurfaceRegistry.test.ts`; `src/lib/i18n/en.json`, `es.json`, `restoreCodes.test.ts`; `scripts/lint/composition-guards.test.ts`; notes `docs/decisions/3-8-2-notes.md`. (`PROGRESS.json` is a workflow record — ignore.)
- **Verification run (orchestrator, all exit 0):** `cargo test --workspace -- --test-threads=1` (33 ok lines, 1465 passed; no Rust changed); `npm test` 3769 passed (78 files); `npm run check` 470 files 0/0; `npm run build` 204 modules; bundle oracle: server-only markers absent, client-only present. Rung `1465 / 470 / 3769 / 204` from `1465 / 468 / 3730 / 202`.
- **Risks to probe:**
  1. Model changes beyond the brief: `rawSnippet.ts` reconciliation now also answers `diverged` when the snippet starts on a different line; `identityStaleRevision` now marks the identity stale (no retry). Are these correct and tested, and do they break 3-8-1's review fixes (reconcile only onto base or sent text; outcome cleared at `beginSave`; *Keep editing* refused while saving)?
  2. The write-surface registration and its competition with restore (`restore.ts`, `surfaceReceivers.ts`): can a snippet editor and a restore / whole-document editor / match editor hold writes on one document at once?
  3. `\r` handling (CLAUDE.md §6): refused at load, edit and send; a `<textarea>` normalizes CRLF — is any path reconstructing or silently dropping `\r`?
  4. Sentences claiming more than their producer guarantees (R39; CLAUDE.md §5 last bullet), EN/ES parity, keys built by hand instead of accessors, hardcoded strings.
  5. CF-55 on both surfaces: are the mounted tests proving the controls disabled and a click non-mutating under a held save?
  6. The trailing-blank-line explanation shown only when the refused text ends with a blank line — is that condition right?
  7. Stale `MatchId` handling across reparse (D2v) and a committed write never reported as an error.
- **Review file:** `docs/reviews/phase-3-8-2.md`.
- **Time budget:** 15 minutes.
