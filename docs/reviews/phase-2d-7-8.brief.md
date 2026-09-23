# Review brief — Phase 2d-7-8 (G4: the reconciliation-status states 9c left unread, a window reading, records only)

- **Repo:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; read `CLAUDE.md` first).
- **Phase goal:** read, through the frozen instrument (`launch-7.sh` under
  `/private/tmp/espansoconfig-harness-2d-6-6c-2/`), each G4 row of the consult
  (`docs/reviews/phase-2d-7-design.md` `:434-452`) and class it exactly once (entry 17: reached / held /
  constructed / unread). Spec: `docs/decisions/2d-7-split-notes.md` §2 *2d-7-8*, §3 entries 16, 17, 18,
  21, 23, 35 and **37** (the owner's standing ruling: a row the frozen instrument cannot read is recorded
  unread, with the missing plan capability named, handed to 2d-7-9 and 2d-7-10, and the step closes).
  `PROGRESS.md` `## Next action` summarises the step.
- **Acceptance, verbatim from the record:** every G4 row appears exactly once with its class. A row no
  frozen plan reaches is classed unread under entry 37, with the missing plan capability named, and the
  step still closes.
- **Changed files (records only; no tracked source changed):**
  `docs/decisions/2d-7-8-window-reading.md` (new), `docs/decisions/2d-7-8-notes.md` (new),
  `PROGRESS.json` (the phase marked `in_progress`). The four uncommitted instrument paths
  (`src-tauri/src/main.rs`, `src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts`) are the owner's
  deliberate temporary instrument, frozen and **out of scope** — do not review or flag them.
- **Verification run:** hashcheck `/private/tmp/2d7-6-1-hashcheck.sh` 18/18 at 17:19:02, 17:27:29 (worker)
  and 17:29:53 (orchestrator); hook diff `5 insertions(+), 1 deletion(-)`; all `CLAUDE.md` §4 gates exit 0
  at rung `1330 / 462 / 3547 / 201`; orchestrator re-ran `npm test` (3547 passed) and read
  `/private/tmp/2d7-8-cargo.log` (26 ok lines, no failures). Launch artefacts are under the harness
  directory and `/private/tmp/2d7-8-*`.
- **Risks to probe:**
  1. A row classed **unread** that a frozen plan could in fact read (entry 37 does not excuse a readable
     row) — check the claimed "missing plan capability" against `launch-7.sh`'s plans and `probe.ts`.
  2. A **constructed** state credited as reached/held (entry 17), or the one **held** row (row 12,
     `stale` behind a panel alone, `G4-02`/`G4-10`) not supported by the launch evidence.
  3. Worker deviations: no `:keepalive` passed (screen unlocked, `visibility=visible`, entry 18 cited);
     the claim that `listenRefused` draws `registrationFailed.rejected`, not `noTransport`; the claim that
     `unavailable` draws no retry control. Check each against the code and the record.
  4. Any sentence claiming a guarantee the evidence does not give (this project's worst defect class); any
     per-action no-write claim on a retained plan (S5); a whole-launch tally used as an entry-16 witness.
  5. Privacy: no real-config content quoted anywhere.
- **Review file:** `docs/reviews/phase-2d-7-8.md`.
- **Time budget:** 15 minutes.
