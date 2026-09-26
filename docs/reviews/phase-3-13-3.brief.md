# Review brief — Phase 3-13-3 (display names and creation defaults: the window half)

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig
- **Phase and goal:** the window half of step 3-13, per ruling 30 and §4.1 of `docs/decisions/3-split-notes.md`
  (the 3-13 addendum in §2). Two launches (EN, ES through the picker) on an unlocked screen, over synthetic
  data and scratch app data, read by a model from `screencapture -l` captures. It closes step 3-13.
- **Changed files (uncommitted):** new `docs/decisions/3-13-3-notes.md`, new `docs/decisions/3-13-3-window-reading.md`;
  `PROGRESS.json` (in-progress marker only). No tracked source file changed. The uncommitted instrument
  `instrument-3-13-3/` was deleted before this review; a byte copy is at `/private/tmp/3-13-3/instrument-copy/`,
  captures and logs under `/private/tmp/3-13-3/`.
- **Verification run:** `npm run check` (487 files, 0/0), `npm test` (4064 passed; re-run by the orchestrator, exit 0),
  `npm run build` (214 modules), the bundle oracle (server-only markers absent, client-only present), no probe string
  in `dist/`. Rust gates not run: no Rust file changed.
- **What to check:**
  1. Every claim in the two records is backed by a named capture or a disk diff, and nothing is credited from
     mounted tests or inferred. Rows that were not seen are recorded unread / read in part.
  2. The line-feed measurement is stated with its bounds (script-dispatched `execCommand('insertText')` and `.value`,
     not a real paste) and not overclaimed; the notes say correctly which on-screen sentence it contradicts.
  3. Privacy: no real config content anywhere; the scratch HOME/XDG isolation of the owner's espanso config and the
     app's sidecar store is stated and credible.
  4. The instrument is truly gone from the repo (`git status --short --untracked-files=all`) and its SHA-256s are recorded.
  5. The candidate defect (seeded `word` default written as `word: 'true'` by *Create*) is recorded as an open item,
     noticed-not-fixed, with enough detail for a later phase to take it.
  6. Any sentence in the records that claims a guarantee the evidence does not give (project's worst defect class).
- **Risks:** overclaiming a reading; a misstated measurement; privacy.
- **Review file:** `docs/reviews/phase-3-13-3.md`
- **Time budget:** 10 minutes.
