# Review brief — Phase 2d-6-7b

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (uncommitted tree against `HEAD` = `fda92c5`)
- **Phase:** 2d-6-7b — the three operation panels' external-change rendering, the second third of 2d-6-7.
- **Goal:** `MatchDeleter.svelte`, `MatchMover.svelte` and `MatchDuplicator.svelte` draw an external
  conflict (origin, comparison, reapply or manual resolution, reload) in English and Spanish, pinned by
  bilingual mounted tests of every offered control, direct submission refusal while the conflict stands,
  and supersession withdrawing the warning. Scope: `docs/decisions/2d-6-split-notes.md` §2, `### 2d-6-7`
  and *The orchestrator's cut of 2d-6-7* (7b bullet). The record is `docs/decisions/2d-6-7b-notes.md`.
- **Changed files:** `src/lib/components/{MatchDeleter,MatchMover,MatchDuplicator}.svelte` and their
  `.test.ts`, `src/lib/components/DetailPane.test.ts`; `src/lib/browser/{matchDeletion,matchMove,
  matchDuplication,observationDelivery,saveOutcome}.ts`, `matchMove.test.ts`, `observationDelivery.test.ts`;
  `src/lib/i18n/index.ts`; `docs/decisions/2d-6-7b-notes.md`, `docs/decisions/2d-6-split-notes.md`.
  **Not in scope:** `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts` — the
  deliberately uncommitted window-reading instrument; ignore them. `PROGRESS.json` is a workflow record.
- **Verification run (orchestrator, each gate alone):** `npm run check` 449 files / 0 errors / 0 warnings;
  `npm test` 3053 passed (65 files); `npm run build` 193 modules, server-only markers absent, client-only
  present; `cargo test --workspace -- --test-threads=1` 1323 passed 0 failed; clippy `-D warnings` and
  `cargo fmt --check` exit 0.
- **Risks to probe:**
  1. Model changes: the deleter's new `canConfirm` (a held reading disables "Delete it"); the mover's
     `null` "what you asked for" sentences and `awaitingReloadConfirmation` for an untouched draft;
     `noticesBesideRefusal` in `observationDelivery.ts`. Are these predicates true for every producer, or
     do they hide a sentence that should draw / show one that is false (PROGRESS.md R39)?
  2. Direct submission while a conflict stands: can any control on any of the three panels still send?
  3. Supersession: does a newer observation withdraw the warning on all three, with no stale text left?
  4. i18n: every drawn string via a typed accessor, EN and ES both; any hand-built key or literal in
     markup; any reused key whose sentence is false for its new producer.
  5. Comments or the notes claiming a guarantee the code does not give (`CLAUDE.md` §5, last bullet).
  6. Tests that pass vacuously (querying text shared by two controls, e.g. the ES "Dejarlo como está").
- **Binding rules:** `CLAUDE.md` §2, §5, §6 (Frontend structure, Text on the wire).
- **Review file:** `docs/reviews/phase-2d-6-7b.md`
- **Time budget:** 20 minutes.
