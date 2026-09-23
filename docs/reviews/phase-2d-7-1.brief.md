# Review brief — Phase 2d-7-1: the `stale` ruling and its fix

- **Repo:** /Users/ccarpio/Developer/Utils/espansoConfig (review the **uncommitted** tree against `HEAD`).
- **Review file to write:** `docs/reviews/phase-2d-7-1.md`
- **Time budget:** 10 minutes.

## Goal

Rule what a `stale` reconciliation mark means while a write surface is open, decide how a mark's cause
is known (provenance), and fix two handed-on defects in the model, test-first:

1. `docs/decisions/2d-6-11a-notes.md` §5 item 1 — a `stale` mark survives a `writtenHere` release.
2. `docs/decisions/2d-6-9b-3-notes.md` §6 item 1 — a hold begun while an automatic read is out, with a
   successful re-adoption, leaves `stale` with nothing to acknowledge.

The binding spec is `docs/decisions/2d-7-split-notes.md` §2 *2d-7-1* (acceptance list), §3 entries 27
and 28, §5.9.

## Changed files (the phase's deliverables)

- `docs/decisions/2d-7-1-notes.md` (new) — the ruling, the provenance decision, pre-fix failures, what
  stays standing, open items.
- `src/lib/browser/workspace.svelte.ts` — the fix (a clear gated on the file's status-write count
  captured when the cause was taken in, the way `adoptDiskVersion` already did).
- `src/lib/browser/observationTransitions.ts` — comments only.
- `src/lib/browser/workspace.test.ts`, `src/lib/components/DetailPane.test.ts` — tests.

**Not in scope, never review or flag:** `src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`,
`src/probe.ts` (the deliberate uncommitted window-reading instrument), `PROGRESS.json`.

## Verification run (orchestrator, each alone, output to a file)

- `npm test`: exit 0, 3539 passed (72 files) — +4 over 3535.
- `npm run check`: exit 0, 462 files, 0 errors, 0 warnings.
- `npm run build`: exit 0, 201 modules (unchanged; no new module).
- `cargo test --workspace -- --test-threads=1`: exit 0, 1323 passed, 0 failed.
- `cargo clippy --workspace --all-targets -- -D warnings`: exit 0.
- Bundle oracle: server-only markers absent, client-only markers present.

## Risks to probe

- **Does the clear ever drop a mark that a real newer snapshot still backs?** That would hide a real
  external change from the user — the dangerous direction. Check the status-write-count comparison
  against every path that writes a file's status, including arrival-order interleavings.
- Is the claimed provenance ("a registry question, not a new field") actually sound — does every cause
  of `stale` bump the counter that the capture compares against?
- Do the tests shown failing first actually exercise the two handed-on scenarios, and does each
  "stays standing" test pin a real standing case?
- Do comments or the notes claim a guarantee the code does not give (this project's worst defect class,
  `CLAUDE.md` §5)?
- The notes' open items (a failed read, a surface opening and closing mid-read, a re-adoption dropping
  the view, arrival order vs. an older mark) — are they honestly stated, and is any of them actually a
  blocker for this phase's acceptance rather than a later item?

Verdict line format: `VERDICT: ship | ship-with-fixes | do-not-ship`, then `BLOCKERS: <n>`,
`SHOULD-FIX: <n>`, each finding with file:line.
