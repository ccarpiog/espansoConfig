# Phase 2d-7-5 — G1: delivery, watcher and counters (notes)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-5* and its §2 preamble, bound by §3
entries 15–19, 23 and 24; G1's rows are the consult's (`docs/reviews/phase-2d-7-design.md` Q8). Owed in:
[`2d-7-4-2-notes.md`](2d-7-4-2-notes.md) §8 and §9.5.
**Risk:** `high`. **Driven:** yes. **Records only:** this file and
[`2d-7-5-window-reading.md`](2d-7-5-window-reading.md). No tracked source changed; the instrument and
the harness were not edited; no real-config file was opened, copied or quoted.

---

## 1. The frozen instrument, checked before any reading and after the last

Every path in `/private/tmp/2d7-instrument-reviewed/SHA256SUMS` was hashed live (`repo/…` against the
repository, `harness/…` against `/private/tmp/espansoconfig-harness-2d-6-6c-2/`) and compared with
the recorded value:

| When | Result | Record |
|---|---|---|
| 10:23:41, before the first launch | **18 of 18 `OK`**, 0 `DIFF` | `/private/tmp/2d7-5-hashes-start.txt` |
| 10:30:45, after the last launch and the gates | **18 of 18 `OK`**, 0 `DIFF` | `/private/tmp/2d7-5-hashes-end.txt` |

The four instrument paths among them are those of 2d-7-4-2 §5.3: `main.rs` `b3836a28…c3e5`, `main.ts`
`215f8507…8615`, `probe.rs` `c65d1cb5…9688`, `probe.ts` `22661785…4d3e`; `launch-7.sh` is
`5d5f6397…82ec`. The binary `target/debug/espansoconfig` was `53d84fb2…510b` before the first launch
and after the gates, which is 2d-7-4-2 §9.6's binary built from those bytes. It was not rebuilt.

`git diff --stat src-tauri/src/main.rs src/main.ts` read `2 files changed, 5 insertions(+), 1
deletion(-)` at the start and at the end.

---

## 2. What was done, and why

Ten launches, `G1-01` … `G1-10`, one plan each, each on a fresh bundle path and bundle identifier
through `launch-7.sh launch`, each with its language set through the picker (English). The screen was
locked throughout, so every launch ran with `:keepalive` (allowed in a hidden launch, disclosed in the
reading) and every visual claim is named unread.

The plan choice follows what the frozen instrument offers:
- **The three G1 plans** 2d-7-4-2 added (`both-roots`, `burst-fast`, `burst-slow`) cover both roots and
  the burst against its control. The burst pair was run twice each (`G1-08`, `G1-09`) so that each of
  the two points rests on two launches.
- **Retained plans** cover the rest as far as they reach: `external-raw`'s first half is the raw
  viewer refreshing on an external change; `status-membership` and `status-removed` are add and remove
  through the probe writers (and the first also reopens the workspace); `restore-registry` holds the
  only unsubstituted, committed `save_match` of any plan; `lifecycle-delivery` is the plain wake.
- **No plan was invented, and nothing was substituted by hand.** Rows no plan reaches are named unread
  (§3), as the brief and 2d-7-4-2 §8 item 1 require.

---

## 3. G1, one line per row (entry 17)

Tallies are Rust's `rust-writes` and the reconciled `emitted`/`delivered`; the witness is the probe's
span witness unless stated; the class is entry 17's.

| # | Row | Launches | Tallies | Witness | Class | Standing |
|---|---|---|---|---|---|---|
| 1 | Both roots, by the script writer | G1-01 | per root: `writes=0 emitted+=1 delivered+=1`; drains `Changed … config/default.yml disk=09b80d14…` and `Changed … match/conflict.yml disk=0b6c6dfd…` | each span `unchanged(except <that file>:as-written=yes)` | *reached* | **read** |
| 2 | Burst, three writes 60 ms apart | G1-02, G1-08 | `writes=0 emitted+=1 delivered+=1`, one drain, `disk=` = the writer's `final-sha256` `edabfe42…` | `unchanged(except match/conflict.yml:as-written=yes)` | *reached* | **read** (one emit, as predicted) |
| 3 | Control, two writes 600 ms apart | G1-03, G1-09 | `writes=0 emitted+=2 delivered+=2`, drains `a569b4d9→0b6c6dfd→51104dae` | `unchanged(except match/conflict.yml:as-written=yes)` | *reached* | **read** (two emits, as predicted); no boundary claim |
| 4 | Self-save suppression | G1-07 | launch: `rust-writes=2` (`save_match`, then `save_raw_document` 1.3 s later), `emitted=0 delivered=0`, one drain (the open's) | launch span `CHANGED(except none)`: `identical=[match/conflict.yml]`, `added=[` the app's backup batch `]` | *reached* | **partial.** No emit, no delivery and no drain followed two own commits, 3.5 s and more before `end`. **The row's own acceptance (tally 1, one inode change, 2 s of drains, in a span holding one save) is unread**: no frozen plan isolates one save |
| 5 | Raw-view automatic refresh | G1-04 | `reload_document` + `document_text` with no press; launch `rust-writes=0`; viewer text byte-equal to r0 then r1 (out of app) | **per-action no-write: UNREAD** (entry 16; S5). Separate observations: launch span `CHANGED(except none)` over the two probe-written files; out-of-app tree diff lists only those, at `r4`'s and `r3`'s hashes | *reached* | **refresh read in the DOM**; its no-write claim unread; visual unread |
| 6a | Add and remove, probe writers | G1-05, G1-06 | G1-05 `writes=0 emitted=2 delivered=2` (`Unreadable … Unnamed:match/extra.yml`, `Removed … Unnamed`); G1-06 `writes=0 emitted=1 delivered=1` (`Removed … Addressable:match/other.yml`) | **per-action no-write: UNREAD** (entry 16; S5). Separate observations: G1-05 launch span `unchanged(except none)`; G1-06 launch span `removed=[match/other.yml]`, the probe writer's; tree diff agrees | *reached* | **observations read** for an unreadable add and both removals, their no-write claims unread; **a readable add (the in-place, possibly partial shape) is unread**: no plan calls `probe_extra_writer` with `unreadable: false` |
| 6b | Add and remove, script under `config/` | — | — | — | — | **unread**: `launch-7.sh` writes only four fixed targets, by `replace` or `inplace`, and has no removal; the page has no such request |
| 7 | Workspace reopen with a late old callback, under `delay` | — (G1-05 adjacent) | G1-05: `open_workspace×2`, next drain `epoch=2 afterSequence=0`; launch-wide `rust-writes=0` | **per-action no-write: UNREAD** (entry 16; S5); G1-05's launch span `unchanged(except none)` is a separate launch-wide observation | reopen *reached*; late callback — | **unread**: no frozen plan arms `delay` on a drain across a reopen. The reopen alone was observed, without a no-write claim |
| 8 | Emits against deliveries, every checkpoint | all ten | 31 `--- reconcile` lines, every one `observed` or `none-emitted`, commands `equal(except-plugin:event)`, `probe-half=ok` | — | *reached* | **read**: emitted = delivered at every checkpoint; no application fact to record |
| 9 | The watermark's advance | G1-01, -03, -04, -05, -02/-08 | each drain asks after the previous `newest_sequence`; +1 per observation; one sequence for a coalesced burst; reset to 0 under `epoch=2` after the reopen | — | *reached* | **read** |

No row is *held* or *constructed*: none of the plans chosen calls `arm`, and
`rg -c '^--- substituted|^--- armed'` over the ten `G1-*` transcripts finds nothing.

---

## 4. Acceptance, clause by clause

1. **One line per G1 row with its tallies, witness and class (entry 17).** Met by §3: nine rows (six of
   the consult's state rows, split where the reading splits, plus emits and the watermark), each with
   tallies, witness and class, and each marked read, partial or unread.
2. **Emits equal deliveries, or each difference written down as an application fact (entry 15).** Met.
   Every one of the 31 reconcile lines has emitted = delivered. There is no difference to write down.
3. **No launch with a Rust/page command mismatch, or each voided and re-run.** Met. Every launch
   printed `--- instrument ok probe-commands=14 page=14` and `--- recorder-ordering … verdict=ok`, and
   `mismatch-lines=0 void-lines=0`. Nothing was voided; nothing was re-run.
4. **Each window statement carries the three visibility conditions or is named unread (entry 18).**
   Met by naming. The lock preflight read `locked` before and after every launch, so condition one
   fails everywhere, no `screencapture -l` was taken (`used=webview`), and every beat reads
   `visibility=hidden focus=no`. **Every visual claim is unread.** The reading's statements are about
   commands, events, drains, DOM text and files.
5. **Instrument hashes equal the frozen set at start and at end; hook diff unchanged; no tracked source
   changed; gates green at the unchanged rung.** Met: §1 and §6. `git status --short
   --untracked-files=all` shows the four instrument paths, the orchestrator's `PROGRESS.json` and this
   step's two records, nothing else.

**Entry 19:** every launch reached its terminal line, so none was a host event.
**Entry 23:** nothing was pre-credited; row 4's and row 7's predicted classes are not credited, since
the rows are partial and unread. **Entry 24:** both roots and the burst were produced by the script's
writers with the script's own timing (`writers.log`); the 150–300 ms boundary is not claimed.

---

## 5. Owed in from 2d-7-4-2

- **Review S5: retained plans lack per-path no-write evidence.** Each retained-plan row stands as
  follows:
  **Each per-action no-write claim on a retained plan is UNREAD** (entry 16 needs a witness at the
  action's boundaries and after each writer; launch-wide evidence is not a substitute; §9). What stays
  are separate, labelled observations:
  - *Row 5 (G1-04, `external-raw`)*: no-write **unread**. Observations: launch-wide `rust-writes=0`
    and the command reconciliation; `launch-7.sh`'s out-of-app tree diff lists only the two
    probe-written files at their fixtures' hashes; the launch span prints `CHANGED(except none)`
    because probe writers are not named as exceptions. The refresh itself (DOM text, rereads) is read.
  - *Row 6a (G1-05, G1-06)*: no-write **unread**. Observations: `G1-05`'s launch span is
    `unchanged(except none)` with `rust-writes=0` (the one file came and went); `G1-06`'s launch span
    shows the single probe removal, which the tree diff agrees with. The drains are read.
  - *Row 4 (G1-07, `restore-registry`)*: no per-path line, and this is what leaves the row partial.
    Its two writes cannot be separated.
  - *Row 7 (G1-05's reopen)*: no-write after the reopen **unread**. Observations: launch-wide
    `rust-writes=0` and an unchanged launch span.
  - *Rows 8 and 9 (G1-10, `lifecycle-delivery`)*: the span is `CHANGED(except none)` over the probe's
    one write; only the event and drain claims are made from it.
  - The three G1 plans (rows 1–3) have per-action checkpoints and spans and are not affected.
- **`external-recovery` runs on a simpler fixture set** (`base-r0` / `beta-removed-r1`). Not used by
  G1; it bears on 2d-7-6's recovery rows, which must say so.
- **The three operation plans cannot run on the CRLF set.** Not used by G1; it bears on 2d-7-6 and
  2d-7-7.

---

## 6. Gates (instrument present)

Exit statuses read from the tool; `cargo` and `npm` output redirected to files, never read through a
pipe.

| Command | Exit | Figure |
|---|---|---|
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings` (`/private/tmp/2d7-5-clippy.log`) | 0 | — |
| `cargo test --workspace -- --test-threads=1 > /private/tmp/2d7-5-cargo.log` | 0 | 26 `test result:` lines, **1330** passed, 0 failed |
| `npm run check` (`/private/tmp/2d7-5-check.log`) | 0 | **462** files, 0 errors, 0 warnings |
| `npm test` (`/private/tmp/2d7-5-vitest.log`) | 0 | 72 files, **3547** tests |
| `npm run build` (`/private/tmp/2d7-5-build.log`) | 0 | **201** modules |
| server-only oracle `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | absent |
| client-only oracle `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2` |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

Rung **`1330 / 462 / 3547 / 201`**, unchanged.

---

## 7. Deviations

1. **Retained plans were used for G1 rows 4–7** (§2). They were written for other readings, so their
   evidence is launch-wide rather than per-path (§5), so their per-action no-write claims are unread
   (§9). Each such row says so.
2. **`restore-registry` stands in for self-save, partially.** It is the only plan with an
   unsubstituted committed `save_match`. `status-uncertain-editor` also commits a real `save_match`,
   but under a `mayHaveWritten` substitution, which makes it *constructed* (entry 17) and unusable for
   a *reached* claim; it was not run.
3. **The burst plans were run twice** (`G1-08`, `G1-09`). This is repetition, not a void.
4. **Timing figures were taken under the probe's busy page** (2d-7-4-2 §6 item 4) and are cited only
   as "within the wait".

---

## 8. Open items for 2d-7-6 and later, and one question for the orchestrator

1. **Question — whether rows 4, 6a (readable add), 6b and 7 stay unread.** The frozen instrument cannot
   read them:
   - a plan with one unsubstituted `save_match` inside its own span (row 4);
   - a plan arming `delay` on a drain across a workspace reopen (row 7);
   - a plan calling `probe_extra_writer` with `unreadable: false` (row 6a's readable add);
   - a script-side create and remove under `config/`, which also needs `launch-7.sh` (row 6b).

   Adding any of them changes the frozen hashes, and entry 6 allows exactly one instrument review. This
   step judged the gap **not blocking**: G1's central claims (delivery, both roots, the burst pair,
   emits against deliveries, the watermark) were read. The choice between carrying these rows unread
   into 2d-7-10, and a corrective phase that adds the plans and has them reviewed, is the
   orchestrator's (or the owner's). An agent's message cannot make it.
2. **S5 still stands for 2d-7-6 … 2d-7-8.** Their surface rows use retained plans, which have no
   action-boundary checkpoints and no witness right after each probe writer. **A per-action no-write
   claim on such a plan is UNREAD** (entry 16). An out-of-app tree diff, a launch-wide tally or a
   launch-wide span may be recorded only as a separate, labelled observation, never as that claim.
3. **`external-recovery` is on the plain set; the operation plans are on the hard LF set only.** 2d-7-6
   and 2d-7-7 inherit both facts (2d-7-4-2 §8 item 8).
4. **Every visual G1 claim is unread** (locked screen). Nothing in G1 is a visual judgement that 2d-7-9
   owes; the DOM and transport claims stand without eyes.
5. **Scratch outside the repository, for 2d-8's list:** `launches/G1-01` … `G1-10` and their ledger
   lines under the harness root; `~/Library/{WebKit,Caches}/cc.carpio.espansoConfig.probe.G1-*`;
   `/private/tmp/2d7-5-*.log` and `/private/tmp/2d7-5-hashes-{start,end}.txt`.
6. **Carried unchanged:** 2d-7-4-2 §8 items 2, 4, 5 and 6.

---

## 9. Review fix — SHOULD-FIX: launch-wide evidence substituted for per-action no-write witnesses

**The finding** (`docs/reviews/phase-2d-7-5.md`, Codex, `ship-with-fixes`, 0 blockers, 1 SHOULD-FIX):
§8 item 2 let later steps make a no-write claim from an out-of-app tree diff or a launch-wide tally,
where entry 16 requires both the command evidence and witnesses at the action's boundaries.

**Re-derivation: holds.** Entry 16 (`2d-7-split-notes.md` §3) defines a no-write path by four parts at
once. The commands part: none of the six write commands dispatched. The files part: every file
unchanged except those a writer changed, each equal to **the witness taken just after that writer
returned**. The time part: **from the checkpoint before the path's first action** until the transport
is quiet and 2 s have passed. The line it prints is `writes=0 witness=unchanged(except …)`. A retained
plan has only the launch's `start` and `end` checkpoints and no post-writer witness. So the time part
and the per-writer part cannot be met. A launch-wide tally shows only the commands part, over the
wrong window. A tree diff is one before/after pair, with no per-writer witness. The same substitution
was also written into this record's own rows 5, 6a and 7 (§3, §5) and into the reading's §5, §6 and §7.

**Fix (records only; no instrument change).**
- §8 item 2: a per-action no-write claim on a retained plan is **UNREAD**. Launch-wide evidence can
  be recorded only as a labelled observation.
- §3 rows 5, 6a and 7, §5 and §7 item 1: the no-write part is marked **UNREAD**. The DOM, drain,
  command-count and final-file observations are kept as separate observations.
- The window reading's §5, §6 and §7: the same relabelling.

Rows 1–3 are unaffected. Their plans take a checkpoint before and after each script write, and each
span's witness is the one taken after the writer.
