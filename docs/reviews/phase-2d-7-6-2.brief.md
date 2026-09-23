# Review brief — Phase 2d-7-6-2 (G3)

- **Repo**: /Users/ccarpio/Developer/Utils/espansoConfig (macOS Tauri v2 app; rules in `CLAUDE.md`).
- **Phase**: 2d-7-6-2 — G3, a real-window reading, **records only**: compare, keep, reload (two steps)
  and recovery per family; copy by `click()`; the reload's adoption arms (`installed`, `alreadyThere`,
  `refused`); the open-surface refusal. Spec: the 2d-7-6 addendum in
  `docs/decisions/2d-7-split-notes.md` §2, bound by §3 entries 15-18, 23, 25, 35 and §5.8; the
  executable next action in `PROGRESS.md` (*Next action*, committed HEAD version).
- **Changed files (the whole deliverable)**: `docs/decisions/2d-7-6-2-notes.md`,
  `docs/decisions/2d-7-6-2-window-reading.md` (new, untracked). `PROGRESS.json` carries only the
  orchestrator's in-progress marker. The four uncommitted instrument paths (`src-tauri/src/main.rs`,
  `src/main.ts`, `src-tauri/src/probe.rs`, `src/probe.ts`) are the frozen instrument and are NOT under
  review; do not propose changing them.
- **Verification run**: frozen instrument hashes 18/18 equal (`/private/tmp/2d7-6-1-hashcheck.sh`,
  16:32:52); hook diff `5 insertions(+), 1 deletion(-)`; `npm test` 3547 passed; cargo log
  `/private/tmp/2d7-6-2-cargo.log` 26 `test result: ok`, 0 failures; worker ran all §4 gates exit 0,
  rung `1330 / 462 / 3547 / 201`. 28 launches `G3-01` … `G3-28`; transcripts under
  `/private/tmp/espansoconfig-harness-2d-6-6c-2/`.
- **Worker's outcome**: acceptance clause "each choice read on each family" **NOT MET** (the frozen
  instrument has no plan pressing several choices; the copy plan `external-editor` was refused by
  `launch-7.sh` three times, exit 73, over an unrestorable clipboard type); "each adoption arm classed"
  claimed MET by classing (`installed` inferred from a notice only the installing branch produces;
  `alreadyThere`/`refused` unread); open-surface refusal not credited (`competing=0` on all eight
  `--- restore` lines); screen was **unlocked** and windows visible. The worker judges the phase BLOCKED
  on an owner decision (instrument revision vs a ruling).
- **Risks to check hardest**: (1) any record sentence claiming more than the transcripts show — this
  project's worst defect class; (2) acceptance weakened or marked MET without evidence (2d-7-6-1's
  review found exactly this: an added "or named unread" alternative); (3) whether "adoption arms
  classed" is honestly MET when two of three arms are unread; (4) the `installed` inference; (5) the
  visible-window / keep-alive handling against entry 18; (6) any real-config content quoted (privacy,
  `CLAUDE.md` §1); (7) whether the BLOCKED judgement and the options offered to the owner are correct
  and complete.
- **Review file**: `docs/reviews/phase-2d-7-6-2.md`.
- **Time budget**: 15 minutes.
