# Review brief — Phase 3-14 (delete-conflict wording and action placement)

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig
- **Phase and goal:** implement the owner's rulings of 2026-09-26 (quoted verbatim in `docs/decisions/3-14-notes.md`
  and the `PROGRESS.md` Next action): **CF-52** — the delete panel's conflict choice row drawn before the long
  disk-version comparison, visible at 1180x728 in EN and ES, keyboard order and focus unchanged; **CF-54** — the
  two repeated opening paragraphs of the external-conflict delete panel merged into one that keeps every distinct
  fact, EN and ES. Then the window half (a model's look, both save-origin and external-origin panels). The one
  Tab-order swap in the unknown-outcome state was accepted by the owner (notes §4 item 1).
- **Changed files:** `src/lib/components/MatchDeleter.svelte`, `src/lib/browser/matchDeletion.ts`,
  `src/lib/i18n/en.json`, `src/lib/i18n/es.json`, `src/lib/components/MatchDeleter.test.ts`,
  `src/lib/components/DetailPane.test.ts`, `src/lib/browser/matchDeletion.test.ts`; new
  `docs/decisions/3-14-notes.md`, `docs/decisions/3-14-window-reading.md`; `PROGRESS.md`/`PROGRESS.json`
  (the previous phase's SHA row and the in-progress marker only). The uncommitted instrument was deleted
  before this review.
- **Verification run (orchestrator, all exit 0):** `cargo test --workspace -- --test-threads=1` 1555 passed;
  `npm run check` 487 files 0/0; `npm test` 4074 passed; `npm run build` 214 modules; bundle oracle
  (server-only markers absent, client-only present).
- **What to check:**
  1. The merged paragraph loses no distinct fact of the two old sentences, and the ES text says the same as the EN.
  2. The old keys, still drawn by six other surfaces and used as refusal sentences, are unchanged there; the delete
     panel no longer draws the repeated line in any state (both origins, both reload steps, unknown outcome).
     `externalLinesUnderMergedOpening` in `matchDeletion.ts` is correct and cannot drop a line that is not a repeat.
  3. The choice row move: Tab order and focus unchanged except the one accepted swap; no sentence now says
     "above"/"below" falsely (the readiness line was deliberately kept under the disk version — check that
     reasoning); `revealOutcome` scroll targets still right.
  4. No hardcoded user-facing string; i18n key parity/placeholders; JSDoc and closing-bracket comments.
  5. The records claim nothing the captures or tests do not give (unread rows marked unread).
- **Risks:** a lost fact in the merged wording; a stale "shown above" sentence; a regression on the other conflict
  surfaces that share the old keys.
- **Review file:** `docs/reviews/phase-3-14.md`
- **Time budget:** 10 minutes.
