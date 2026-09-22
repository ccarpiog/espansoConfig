# Review brief — Phase 2d-6-6c-1

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (Tauri v2 + Svelte 5 + TypeScript; read `CLAUDE.md` first).
- **Phase and goal:** 2d-6-6c-1, the first half of 2d-6-6c (cut recorded in `docs/decisions/2d-6-split-notes.md` §2,
  the 2d-6-6 entry). It draws the external-conflict origin, evidence, comparison, copy and recovery path on the three
  authored panels (`MatchEditor.svelte`, `MatchCreator.svelte`, `RecoveryPanel.svelte`), fixes 6b's carried items
  (`docs/decisions/2d-6-6b-notes.md` §4 items 1, 2, 7; records 4, 5 and the declared gap), and adds bilingual (EN/ES)
  mounted tests of 2d-6-6's six acceptance scenarios. The window reading is **not** this phase (2d-6-6c-2).
- **Record to check the code against:** `docs/decisions/2d-6-6c-1-notes.md`. Binding spec: `2d-6-split-notes.md` §2
  (2d-6-6 entry) and §3 entries 1-5, 10, 23, 25, 31, 34-36, 38; `docs/reviews/phase-2d-6-design.md`.
- **Changed files (uncommitted):** `src/lib/components/{MatchEditor,MatchCreator,RecoveryPanel}.svelte`,
  `src/lib/components/{DetailPane,MatchCreator,RecoveryPanel}.test.ts`, `src/lib/i18n/{en,es}.json`,
  `src/lib/i18n/index.ts`, `src/lib/i18n/{externalConflictCodes,restoreCodes}.test.ts`, comment-only edits in
  `src/lib/browser/{matchEditor,matchCreation,recovery,saveOutcome,observationDelivery}.ts`, the new notes file.
  **Ignore** `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts` (a deliberate
  uncommitted instrument), and `PROGRESS.*` / `2d-6-split-notes.md` (workflow records).
- **Verification run by the orchestrator (each exit 0):** `npm run check` 449 files 0/0; `npm test` 2916 passed
  (+17 from 2899); `npm run build` 193 modules, server-only markers absent, client markers present;
  `cargo test --workspace -- --test-threads=1` 1323 passed, 0 failed.
- **Risks to probe:**
  1. A rendered sentence claiming more than the model gives (this project's worst defect class) — e.g. an origin line
     saying "no save was initiated" where the producer cannot know that; a comparison drawn from a stale session.
  2. Components deciding *what* to draw by their own logic instead of reading the `src/lib/browser/` value; a
     hand-built i18n key rather than a `describe*`/`t*` accessor; any hardcoded user-facing string.
  3. The `\r` rule: text holding `\r` must be drawn through `SourceText`, never into a box, and copy must go through
     `clipboard.ts`'s refusal of the textarea carrier.
  4. Carried item 2: `MatchCreator.svelte` settling a thrown `create` as "may have written" — is it ever reported as
     an error after a committed write, and does it use the installed-session reader (read last, nothing
     caller-controlled after it)?
  5. Carried item 1: recovery destination buttons on `canChooseDestination` — can a destination-less form under an
     external conflict now move forward, and can a form that must not choose one still do so?
  6. The decisions recorded rather than fixed (items 4, 5, the hold gap): is each argument in the notes true of the
     code?
  7. The mounted tests: do they really go through the real registry and coordinator, assert drawn sentences in both
     languages, and would they fail if the rendering were removed?
- **Review file:** `docs/reviews/phase-2d-6-6c-1.md`.
- **Time budget:** 20 minutes.
