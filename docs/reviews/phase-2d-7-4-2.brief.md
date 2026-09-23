# Review brief — Phase 2d-7-4-2: the instrument, page side and shakedowns — THE instrument review

- **Repo:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; rules in `CLAUDE.md`,
  especially §4 and §6 *Window readings*).
- **Review file:** `docs/reviews/phase-2d-7-4-2.md`. **Time budget:** 25 minutes.
- **Phase and goal:** the second half of 2d-7-4 (`docs/decisions/2d-7-split-notes.md` §2, `### 2d-7-4`
  and its *Addendum 2026-09-23*). It delivers the page side of the window-reading instrument, runs the
  five shakedown controls, and records the hashes, the reviewed-set copy and the baselines.
- **This is THE instrument review, and there is exactly one** (entry 6 of the split notes). It covers
  **the whole instrument**:
  - `src/probe.ts` and `src-tauri/src/probe.rs`;
  - the two hook files, `src-tauri/src/main.rs` and `src/main.ts`;
  - `launch-7.sh` and `tools/*` under the harness root, with its fixture manifest.

  **Your acceptance is the entry-7 checklist:** the consult's eleven items
  (`docs/reviews/phase-2d-7-design.md:109-170`) plus items 12-14 in split-notes §3 entry 7. A finding
  outside that list goes in as an open item, not a blocker.

## The subject is mostly outside the diff — read these paths directly

The review script sees only the uncommitted repo tree. The instrument files are untracked or carry a
fixed hook diff, and the harness lives outside the repository.

| Path | State | Before-copy for a diff |
|---|---|---|
| `src/probe.ts` | untracked; **changed in this phase** | `/private/tmp/2d7-4-probe.ts.orig` (pre-step, `cba6c61a…`) |
| `src-tauri/src/probe.rs` | untracked; one doc comment changed here (`:108-111`); the rest is 2d-7-3's | `/private/tmp/2d7-3-probe.rs.orig` (pre-2d-7-3); `/private/tmp/2d7-4-2-probe.rs.before` (this step's start) |
| `src-tauri/src/main.rs`, `src/main.ts` | modified; the hook diff, unchanged | `git diff src-tauri/src/main.rs src/main.ts` (must stay `5 insertions(+), 1 deletion(-)`) |
| `/private/tmp/espansoconfig-harness-2d-6-6c-2/launch-7.sh` | changed in this phase (no-plan mode, `:keepalive`, `--conflict`, summary lines, one bash 3.2 fix) | `/private/tmp/2d7-4-2-launch-7.sh.before` |
| `/private/tmp/espansoconfig-harness-2d-6-6c-2/tools/*` | `post-input.swift`, `lockstate.swift`, `pbstate.swift` (2d-7-4-1's, unchanged here) and older helpers | `docs/decisions/2d-7-4-1-notes.md` §1.2 and §9 |
| `/private/tmp/espansoconfig-harness-2d-6-6c-2/fixtures-7.manifest` | unchanged | 2d-7-4-1 notes §5 |

A frozen copy of all of the above, with `SHA256SUMS`, is in `/private/tmp/2d7-instrument-reviewed/`.
Launch transcripts are in `/private/tmp/espansoconfig-harness-2d-6-6c-2/launches/K2-2*/`
(`probe.log`, `launch.txt`, `bytes.txt`, `writers.log`).

**Records changed in the repo:** `docs/decisions/2d-7-4-2-notes.md` (new) and this brief. The notes hold:
- §1 and §2: what changed and why;
- §3: the five shakedown transcripts and six further launches;
- §4: the entry-7 checklist, each item with its command and observed output;
- §5: gates, baselines and hashes;
- §6: deviations;
- §7: limits;
- §8: open items.

## What to check (the checklist, compressed)

1. **Command parity and one probe list.**
   - Does `PROBE_OWN_COMMANDS` equal `probe.rs`'s `PROBE_COMMANDS`?
   - Is the run-time `--- instrument MISMATCH` check sound?
2. **Truthful comments.** Does any comment in either probe file, or in `launch-7.sh`, claim something
   the code does not force? This is the project's worst defect class (`CLAUDE.md` §5).
3. **Confinement (probe.rs).** Are the four rebindings' words unchanged, and the fifth and sixth
   disclosed?
4. **Snapshot attribution.** Can `shot()` or the keep-alive ever accept another request's token? The
   forced overlap did **not** achieve two requests pending at once (notes §3.5). Judge whether the
   attribution evidence suffices.
5. **Substitutions.** Can any substitution answer with a rejected `fetch`? Does `mayHaveWritten`
   commit first (K2-25 shows `writes=1`)?
6. **Reconciliation** (`checkpoint`, `readTallyQuietly`, `reportSpan`, `compareWitness`):
   - Can a race make a checkpoint print `equal` when the transport was not seen whole, or `VOID`
     spuriously?
   - Are entry 15's classes applied as written?
   - Are entry 12's witness classes right?
7. **The spy** (`installSpy`, `standDown`):
   - Does the wrapper call the original exactly once, and return its value?
   - Is the no-plan control's page truly inert, including the unwrap?
8. **Heartbeat, keep-alive flag, plan-wait.**
   - Is the keep-alive reachable only through `:keepalive`?
   - Does `parsePlan` refuse anything wider than `<case>[:en|es][:keepalive]`?
9. **Field naming** (`sourceTextName`, `reportDiskText`). Can `--- disk` still carry a field's value?
10. **The harness.**
    - Per-launch identifier and path, and reuse refused.
    - Window-only captures.
    - Script writers confined to the four targets.
    - The no-plan path, including the bash 3.2 `set -u` fix.
    - `--conflict` staging only a manifest-verified fixture.
11. **The input tool** (`tools/post-input.swift`). Does it post only to one pid for one window id, and
    refuse on a locked screen? It is built only, never exercised on a real window (entry 20).
12. **Recorder ordering, the pre-step copies and the hashes.** Items 12 and 14: do the `.orig` hashes
    match the notes, and does `/private/tmp/2d7-instrument-reviewed/SHA256SUMS` match the live files?
13. **The prune and the added cases** (notes §1.8, §1.11). Were any cases a later step needs pruned?
    Is the added G1 plan code sound?

## Verification already run (instrument present, all exit 0 unless noted)

| Command | Result |
|---|---|
| `cargo fmt --check` | exit 0 |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo test --workspace -- --test-threads=1` | **1330** passed |
| `npm run check` | **462** files, 0/0 |
| `npm test` | **3547** |
| `npm run build` | **201** modules |
| server-only bundle oracle | absent |
| client-only bundle oracle | present |

- Pristine `git archive HEAD` baselines: **1323 / 461 / 3546 / 200**. The instrument's share is 7/1/1/1.
- Hook diff: `5 insertions(+), 1 deletion(-)`.
- `git status --short --untracked-files=all` shows no real-config path.
- Final shakedowns ran on binary `69f4d955…`, `probe.ts` `212f8939…` and `launch-7.sh` `bf8778d0…`:
  `K2-20` (no plan), `K2-21` (agreement), `K2-22` (spy), `K2-23` (identical bytes) and `K2-24`
  (overlap), plus `K2-25` … `K2-30`.
- All have 0 `failed`, 0 `MISMATCH` and 0 `VOID` lines.

## Risks the orchestrator sees

- **The screen was locked for every launch.** No `used=window` capture and no visual claim exist.
- **The forced snapshot overlap is attribution evidence, not a timing collision** (notes §6 item 3).
- **"Zero tallies" in the no-plan control is not readable by construction** (notes §6 item 2).
- **Plan coverage for 2d-7-5 … 2d-7-8 was not inventoried row by row** (notes §8 item 1). Some G1 rows
  and 2d-7-7's fifteen-fixture plan have no plan in the frozen instrument. Under entry 6, a blocker here
  is fixed inside 2d-7-4.
- **`probe_plan` round-trip load.** About 26 000 round trips in 7 s from `pause`/`hold` loops (notes
  §6 item 4). It is policy, but visible.
- Status plans no longer get the keep-alive implicitly (notes §1.6).

Do not run `git stash`, `git checkout`, `git restore` or `git reset`. Do not launch the app. Do not read
the gitignored real corpus (`crates/espansoconfig-core/tests/corpus/real/`), and never quote real config
content.
