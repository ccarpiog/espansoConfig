# Review brief — Phase 2d-6-6b (registration and delivery wiring)

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig — macOS Tauri v2 + Svelte 5 + TypeScript app that
  edits espanso YAML without reformatting untouched bytes. Review the **uncommitted** working tree against
  `HEAD` (`2fc8a76`).
- **Ignore the four instrument paths**: `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`,
  `src/probe.ts` — a deliberately uncommitted window-reading instrument, not part of this phase.
  `PROGRESS.json` is a workflow record.
- **Phase and goal:** 2d-6-6b, the second of three sub-phases of 2d-6-6 (spec:
  `docs/decisions/2d-6-split-notes.md` §2, the 2d-6-6 entry and "The orchestrator's cut"; the binding consult
  is `docs/reviews/phase-2d-6-design.md`). It (1) makes the six reload transitions on the editor, creator,
  deleter, mover, duplicator and recovery form take a **required** installed-session reader, read before and
  after `adoptDiskVersion`; (2) registers receivers for the editor, creator and recovery form from
  `DetailPane.svelte` through `registerObservationReceiver`, a form with no chosen file registered over every
  eligible file, the surface transition routed through `observeExternalChange` (first live path to
  `supersedeConflict`); (3) makes recovery the eighth `OpenWriteSurfaceKind` (`restore.ts` plus the pane's
  `satisfies Record<…>` assembly); (4) keeps the shell mounted while a surface is open over an empty document
  list; (5) gates the creator's destination control on `canChooseDestination`; (6) passes the real standing
  origin rather than `null`; (7) adds mounted delivery tests. Rendering of the conflict on the three panels is
  **2d-6-6c's, not this phase's** — do not report its absence.
- **Changed files:** new `src/lib/browser/surfaceReceivers.ts` (+ test), `docs/decisions/2d-6-6b-notes.md`
  (the phase record — read it; its §4 lists open items the worker deliberately left); modified
  `src/lib/browser/{matchEditor,matchCreation,recovery,matchDeletion,matchMove,matchDuplication,restore,
  writeSurfaceRegistry,workspace.svelte,observationDelivery,observationTransitions,conflictSource,saveOutcome}.ts`,
  components `DetailPane`, `AppShell`, `MatchEditor`, `MatchCreator`, `RecoveryPanel`, `MatchDeleter`,
  `MatchMover`, `MatchDuplicator` (`.svelte` and tests), `src/lib/i18n/{en,es}.json` (one new key
  `browser.restore.refused.recoveryOpen`), several test suites, one sentence in `2d-6-split-notes.md`.
- **Verification run (orchestrator, each exit read directly):** `npm run check` 449 files 0 errors 0
  warnings; `npm test` 2875 passed / 65 files; `npm run build` 193 modules, server-only markers absent,
  client-only present. No `src-tauri/` or `crates/` change beyond the instrument, so Rust not re-run (1323).
- **Risks to probe hardest:**
  1. **This project's recurring defect class**: a caller-controlled read (a getter, a `Proxy`, a projection
     read) delivering an observation between a check and a spend — especially in the six new reload readers
     and in the components' `current` closures (`() => (session === held ? derived : session)`).
  2. **Delivery correctness through the real registry**: a reopened editor receiving an old instance's
     delivery; host and recovery over one file getting two decisions; recovery over B not protecting B; a
     destination-less creator/recovery form not blocking every eligible file; settlement order.
  3. **The worker's declared gap**: the consult asks that an observation be *held* for a surface whose
     receiver has not been reported; the transition instead does nothing and relies on children reporting
     before the surface registers. Judge whether that ordering is actually guaranteed in Svelte 5 mount order
     or whether a delivery can be silently lost.
  4. Shell retention over an empty document list — can a retained session still be unmounted?
  5. Any doc comment or record sentence claiming a guarantee the code does not give (worst defect class here).
  6. i18n: the new key in both dictionaries, rendered only through a typed accessor.
- **Review file:** `docs/reviews/phase-2d-6-6b.md` — verdict line (`ready` / `ship-with-fixes` /
  `do-not-ship`), then BLOCKERS and SHOULD-FIX, each with file:line and a concrete failure scenario.
- **Time budget:** 20 minutes.
