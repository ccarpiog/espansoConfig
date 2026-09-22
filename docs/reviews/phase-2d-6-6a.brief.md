# Review brief — Phase 2d-6-6a

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (Tauri v2 + Svelte 5 + TypeScript; rules in `CLAUDE.md`).
- **Phase:** 2d-6-6a, the first third of 2d-6-6 (cut recorded in `docs/decisions/2d-6-split-notes.md` §2).
  Model-side obligations the closed steps 2d-6-2 … 2d-6-5 left to 2d-6-6, before any registration wiring.
- **Goal:** (1) the installed-session reader (`current`) is REQUIRED on every door, settling transition and
  reapply of all eight write sessions, and every caller passes one; (2) `confirmDelete` / `beginMove` /
  `beginDuplicate` perform every caller-controlled read (submission, spreads, `projected`) before their single
  final `current()` read, nothing caller-controlled after it (the fix 2d-6-5 §7 finding 1 applied to raw
  `beginSave`); (3) the editor's, creator's and recovery form's reapplies check their blocks before
  `enterReapply` and read the installed session once immediately before adoption (2d-6-4's pattern (c)).
- **Record:** `docs/decisions/2d-6-6a-notes.md` (what changed, rulings, acceptance with pre-fix failures
  verbatim, open items). Check its claims against the code — a record claiming a guarantee the code does not
  give is this project's worst defect class.
- **Changed files (uncommitted):** `src/lib/browser/{matchEditor,matchCreation,recovery,matchDeletion,matchMove,matchDuplication,rawEditor,restore}.ts`,
  `src/lib/browser/workspace.svelte.ts` (`restoreDocument` gained a `current` parameter), their nine test files,
  call sites in `src/lib/components/{MatchEditor,MatchCreator,MatchDeleter,MatchMover,MatchDuplicator,RawEditor,RestorePane,RecoveryPanel,DetailPane}.svelte`,
  and the two docs above. **Ignore** `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`,
  `src/probe.ts` (a deliberately uncommitted instrument) and `PROGRESS.json`.
- **Verification run by the orchestrator:** `npm run check` 447 files 0 errors 0 warnings; `npm test` 2827
  passed / 64 files (from 2817); `npm run build` 192 modules, server-only markers absent, client-only present.
- **Risks to look hardest at:**
  - Any remaining caller-controlled read (getter/Proxy on a submission, `projected`, the session spread,
    a draft `.value`) AFTER a `current()` read in any door or settling transition (CLAUDE.md §6: a check and a
    spend separated by any property read are not atomic).
  - Component readers of the form `() => (session === held ? derived : session)` — can they answer a session
    that is not the installed one, or hide a displacement?
  - `RecoveryPanel` with no form, and `standing` turned into a required `null`-able parameter — does anything
    now silently pass a reader that cannot observe displacement?
  - Reapply rechecks: blocks truly before any evidence read (counting-getter cases), and the recheck mapped to
    the right obstacle on each of the three surfaces.
  - Tests that pass without exercising the claim (the notes disclose one order-dependent case rewritten).
- **Out of scope** (6b/6c): registration of receivers in components, recovery as the eighth `OpenWriteSurface`
  kind, rendering. The worker left the six non-raw/restore reloads without a reader (notes §4 item 1) — say
  whether that is acceptable as an open item or a blocker.
- **Review file:** `docs/reviews/phase-2d-6-6a.md`.
- **Time budget:** 20 minutes.
