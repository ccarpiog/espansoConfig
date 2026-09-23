# Phase 2d-7-6-1 — G2: surface retention, conflict timing and the locale switch (notes)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-6*, its *Addendum 2026-09-23 — the
orchestrator's cut* (this is the `2d-7-6-1` half) and the §2 preamble. It is bound by §3 entries 15–18,
23 and 25, and by §5.8. G2's rows are the consult's (`docs/reviews/phase-2d-7-design.md:408-416`). Owed
in: [`2d-7-5-notes.md`](2d-7-5-notes.md) §5, §8 and §9.
**Risk:** `high`. **Driven:** yes. **Records only:** this file and
[`2d-7-6-1-window-reading.md`](2d-7-6-1-window-reading.md). No tracked source changed. The instrument
and the harness were not edited. No real-config file was opened, copied or quoted.

---

## 1. The frozen instrument, checked before any reading and after the gates

`/private/tmp/2d7-6-1-hashcheck.sh` hashes every path in `/private/tmp/2d7-instrument-reviewed/SHA256SUMS`
live, `repo/…` against the repository and `harness/…` against
`/private/tmp/espansoconfig-harness-2d-6-6c-2/`, and compares each with the recorded value:

| When | Result | Record |
|---|---|---|
| 11:06:28, before the first launch | **18 of 18 `OK`**, 0 `DIFF` | `/private/tmp/2d7-6-1-hashes-start.txt` |
| 11:18:43, after the last launch and the gates | **18 of 18 `OK`**, 0 `DIFF` | `/private/tmp/2d7-6-1-hashes-end.txt` |

The four instrument paths are 2d-7-4-2 §5.3's:
- `main.rs` `b3836a28…c3e5`
- `main.ts` `215f8507…8615`
- `probe.rs` `c65d1cb5…9688`
- `probe.ts` `22661785…4d3e`

`launch-7.sh` is `5d5f6397…82ec`. `target/debug/espansoconfig` was `53d84fb2…510b` at both checks and in
every launch's `binary.sha256`. That is the binary 2d-7-4-2 §9.6 built, and it was not rebuilt.

`git diff --stat src-tauri/src/main.rs src/main.ts` read `2 files changed, 5 insertions(+), 1
deletion(-)` at the start and after the gates.

---

## 2. What was done, and why

**Twenty launches, `G2-01` … `G2-20`, one plan each.** Each went through `launch-7.sh launch` to a fresh
bundle path and bundle identifier, and each had its language set through the picker. `G2-01` …
`G2-10` are EN and `G2-11` … `G2-20` are their ES twins, plan for plan. The screen was locked
throughout. Every launch therefore ran with `:keepalive`, which is allowed in a hidden launch and
disclosed in the reading, and every visual claim is unread.

**Plans, chosen from what the frozen instrument offers.** No plan was invented, and nothing was
substituted by hand.
- **Retention:** the eight retained external plans, one per surface: `external-editor`, `-creator`,
  `-recovery`, `-deleter`, `-mover`, `-duplicator`, `-raw` and `-restore`. Each opens its surface with
  a draft, a request or a candidate, has a probe writer change the file, and reads what the conflict
  panel holds.
- **Disabled-state timing:** `status-held`. It is the only plan that arms `delay` on a send's answer
  and runs a writer during the hold.
- **Enabled-state timing:** the same eight retention launches. They print the surface's control list
  before the writer and at the first conflict.
- **Locale switch:** `external-raw-cr`. It is the only plan that switches language with a write surface
  open. It was run once from each side (EN → ES, ES → EN).

G2's rows **only read the parts of these plans that come before any G3 choice.** The same launches go
on to draw G3 material (copy, keep, reload, supersession, the adoption arms), and this step does not
read it (reading §7).

---

## 3. Acceptance, clause by clause

1. **Hashes equal the frozen set before the first launch and after the gates; hook diff unchanged.**
   **Met** (§1).
2. **"All eight surfaces retain their values with `writes=0` and an unchanged witness"** (the cut's
   acceptance, `2d-7-split-notes.md` §2 *2d-7-6* addendum, verbatim). **NOT MET** (reading §2; the
   disposition is §3a):
   - **Retained value:** read in the DOM on seven surfaces in both languages (editor, creator, deleter,
     mover, duplicator, raw, restore). The raw box and the restore candidate were also matched byte
     for byte against their fixtures, out of app. Recovery is **partial**: its panel's
     retained-draft sentence and the host panel's draft value are read, but the plan prints none of
     the recovery form's own field values.
   - **`writes=0`, per action:** as a *separate observation*, the page recorded no write command in any
     surface's action window, and Rust's tally reconciled `equal`.
   - **Unchanged per-action witness (entry 16):** **UNREAD on all eight.** They are retained plans,
     with no action-boundary checkpoint and no witness taken after the probe writer. This is S5 /
     2d-7-5 §9, which this step inherits and does not work around.
3. **"Each timing state is read or classed per family"** (verbatim), disabled-state half. **Met by
   classing** (reading §3):
   - **whole file:** raw editor *reached under a held answer* (EN and ES) for the held sentence, the
     disabled controls and the panel's presence after the release; whether the panel existed during
     the hold is unread; restore unread;
   - **authored text:** unread;
   - **operation:** unread.

   The reason is the same everywhere: no frozen plan arms `delay` on those sends.
4. **"Each timing state is read or classed per family"** (verbatim), enabled-state half. **Met**
   (reading §4):
   - **operation:** read on all three (*reached*);
   - **whole file:** read on both (*reached*);
   - **authored text:** partial. The editor's and the recovery form's send state before the writer is
     not printed. The creator plan never enables its send.
5. **"The locale switch is read on each family"** (verbatim). **NOT MET** (reading §5; the
   disposition is §3a):
   - **whole file:** read on the raw editor, both directions (*reached*); restore unread;
   - **authored text:** unread;
   - **operation:** unread.

   No frozen plan switches language with those surfaces open (§3a).
6. **"EN in full and ES covering each distinct sentence these reads draw"** (verbatim). **Met** (reading §6):
   - every row was run in EN, and again in ES through the same plan;
   - the out-of-app scripts found 0 problems;
   - the EN and ES sets of attributed dictionary keys are equal: 115 = 115, none only-EN and none
     only-ES.
7. **`CLAUDE.md` §4 gates with the instrument present, each exit 0; rung `1330 / 462 / 3547 / 201`.**
   **Met** (§5).
8. **`git status --short --untracked-files=all` shows only the four instrument paths plus the two new
   docs.** **Met, with two paths already modified at the start**: `PROGRESS.json` and
   `docs/decisions/2d-7-split-notes.md` (the orchestrator's cut addendum). Both were in the starting
   snapshot, and this step did not touch them.

**Entry 17:** every row is *reached* except disabled-state timing, which is *held*. Nothing is
*constructed*: the only substitution armed in any launch is `status-held`'s `delay`.
**Entry 18:** every visual claim is unread (screen locked; `used=webview`; `visibility=hidden focus=no`).
**Entry 19:** every launch reached its terminal line.
**Entry 23 / §5.8:** nothing was pre-credited. The open-surface refusal belongs to 2d-7-6-2.

**Two of the cut's acceptance requirements are therefore NOT MET: retention (clause 2) and the locale
switch (clause 5).** The step does not close G2 on them; §3a says what closing them needs, and records
the owner's ruling of 2026-09-23 that closes the step with both recorded unread.

### 3a. Disposition of the two unmet requirements

Both are **unreachable with the frozen instrument**. Neither can be read by running more launches of
the frozen plans.

1. **Retention with an unchanged per-action witness.** The missing plan capability is **action-boundary
   checkpoints around each surface's external change, plus a `probe_witness` taken immediately after
   each probe writer returns**, so that entry 16's line `writes=0 witness=unchanged(except …)` can be
   printed for that action. All eight external plans are retained plans with only the launch-wide
   `start`/`end` checkpoints (`2d-7-4-2-notes.md` §8 item 7; `2d-7-5-notes.md` §9). The recovery row
   also needs the plan to print the recovery form's own retained field values.
2. **The locale switch on each family.** The missing plan capability is **a `pickLanguage` switch with
   the conflict standing, followed by a re-read of the panel and the retained value**, in a plan for at
   least one authored-text surface (editor, creator or recovery), one operation surface (deleter, mover
   or duplicator), and, if the whole-file family is to cover both members, the restore pane. Only
   `external-raw-cr` does this today.

**Closing them needs one of two things:**
- **An instrument revision** that adds those capabilities. It changes the frozen hashes, and it meets
  entry 6's single instrument review: the review already spent in 2d-7-4-2 cannot be reused, and a
  second one is not provided for.
- **An owner ruling** that records both as unread here and hands them on: the visual and locale
  judgements to 2d-7-9 (owner-present), and the unread rows to 2d-7-10's consolidation.

**This is an owner decision.** An agent's message cannot make it. The orchestrator stopped the
driven run `BLOCKED` on it on 2026-09-23. The ruling follows.

#### The owner's ruling — 2026-09-23

The owner ruled option **(a)** in their own message, in the interactive session that relaunched the
driver. Quoted verbatim, the whole message:

> º1. a)
> 2. The ruling is that clause 2 and 5 must be recorded unread and handed further down th eline. 2d-7-6-1 should be closed
>
>
> Commit and push. Then, relaunch autoclaude

**Effect.** Clauses 2 and 5 stand **NOT MET** by the frozen instrument and are **recorded unread**.
What each needs is handed on, not worked around: the per-action no-write witness on all eight surfaces
and the recovery form's retained field values (clause 2), and the locale switch on the authored-text
and operation families and the restore pane (clause 5), go to **2d-7-9** for the owner-present
reading and to **2d-7-10** for the unread-row inventory, together with 2d-7-5's unread rows of the
same kind (`2d-7-5-notes.md` §9). **No instrument revision is authorized:** the frozen hashes and
entry 6's single instrument review stand, and option (b) was not taken. 2d-7-6-1 is **closed** on
this ruling; the next step is 2d-7-6-2 (G3), handoff in §8.

---

## 4. The launch list

| Launch | Plan | Result |
|---|---|---|
| G2-01 | `external-editor:en:keepalive` | `--- end`; instrument ok 14/14; 0 void, 0 mismatch |
| G2-02 | `external-creator:en:keepalive` | the same |
| G2-03 | `external-recovery:en:keepalive` | the same (plain fixture set) |
| G2-04 | `external-deleter:en:keepalive` | the same |
| G2-05 | `external-mover:en:keepalive` | the same |
| G2-06 | `external-duplicator:en:keepalive` | the same |
| G2-07 | `external-raw:en:keepalive` | the same |
| G2-08 | `external-restore:en:keepalive` | the same |
| G2-09 | `status-held:en:keepalive` | the same |
| G2-10 | `external-raw-cr:en:keepalive` | the same |
| G2-11 … G2-20 | the ten above, `:es:keepalive` | the same, every one |

Every launch had its lock preflight and `lock-at-end` both `locked`, `home-files=0` and
`probe.err-bytes=0`, and `lsappinfo-bundle-id` equal to its own identifier. The clipboard was untouched
by the eighteen non-copy launches: `changeCount` was the same before and after. The two copy-case
launches (`G2-01` and `G2-11`) each moved `changeCount` by one and ended with the same empty clipboard.
That belongs to G3's copy row, and it is not read here.

---

## 5. Gates (instrument present)

Exit statuses were read from the tool. `cargo` and `npm` output went to files and was never read
through a pipe.

| Command | Exit | Figure |
|---|---|---|
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings` (`/private/tmp/2d7-6-1-clippy.log`) | 0 | — |
| `cargo test --workspace -- --test-threads=1 > /private/tmp/2d7-6-1-cargo.log` | 0 | 26 `test result:` lines, **1330** passed, 0 failed |
| `npm run check` (`/private/tmp/2d7-6-1-check.log`) | 0 | **462** files, 0 errors, 0 warnings |
| `npm test` (`/private/tmp/2d7-6-1-vitest.log`) | 0 | 72 files, **3547** tests |
| `npm run build` (`/private/tmp/2d7-6-1-build.log`) | 0 | **201** modules |
| server-only oracle `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | absent |
| client-only oracle `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2` |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

The rung is **`1330 / 462 / 3547 / 201`**, unchanged.

---

## 6. Deviations

1. **Nine refused launch attempts, no name spent.** The first loop over `G2-02` … `G2-10` wrote the plan
   as `$c:en:keepalive` in zsh, where `:e` is a history modifier. `launch-7.sh` received
   `n:keepalive` and refused each attempt with exit 68 (a bad plan) before building a tree. The ledger
   holds no entry for those attempts, and the names were then used by the corrected loop.
2. **Retained plans throughout.** No G2 plan exists with action-boundary checkpoints. So every
   per-action no-write claim is unread, and the command-window and launch-wide figures are recorded
   as separate observations (reading §2.3).
3. **`external-recovery` runs on the plain set** (`base-r0` / `beta-removed-r1`), and the three
   operation plans run on the hard LF set only. The reading says so wherever those rows appear. Both
   facts were owed in from 2d-7-5.
4. **"Family" is this reading's grouping.** It is authored text, operation and whole file, the grouping
   of the three 2d-6 panel readings; the record does not define the word (reading §1).
5. **Two out-of-app scripts were added under `/private/tmp`**, outside the harness root and the frozen
   set: `2d7-6-1-window.cjs` and `2d7-6-1-keysets.cjs`. A third, `2d7-6-1-hashcheck.sh`, does the hash
   comparison. They read transcripts and dictionaries only. They are not the instrument, and they
   change no hash.

---

## 7. Open items for 2d-7-6-2 and later, and the owner decision

1. **The owner decision of §3a, and the other G2 gaps.** The frozen instrument cannot read the
   following:
   - **the locale switch** on the authored-text and operation families and on the restore pane;
   - **disabled-state timing** (`delay` on the send's answer plus a writer during the hold) on every
     surface but the raw editor;
   - **the editor's and the recovery form's send state before the writer**, and an enabled creator
     send;
   - **the recovery form's retained field values**;
   - **a per-action no-write witness** on any surface.

   Each needs a new or changed plan, which changes the frozen hashes, and entry 6 allows exactly one
   instrument review. Two of them (the per-action witness and the locale switch) make acceptance
   clauses 2 and 5 **not met**, and they were the owner decision of §3a, on which the driven run
   stopped `BLOCKED`. **Ruled 2026-09-23 (§3a): recorded unread and handed to 2d-7-9 and 2d-7-10; no
   instrument revision.** The others are classed rows that the acceptance allows as unread. The same
   kind of question stood open from 2d-7-5 §8 item 1 and is covered by the same ruling.
2. **For 2d-7-6-2 (compare on the editor):** `external-editor` prints `--- comparison editor
   draft=drawn disk=absent`. It tests for the marker `beta changed on disk`, which among the landed
   fixtures only `target-changed-r1.yml` holds, while `launch-7.sh` stages the hard set, whose second
   writer writes `hard-alpha-changed-r1.yml` (`alpha changed on disk`). So `disk=absent`
   there reflects the plan's marker, **not** evidence that the disk text is missing. 2d-7-6-2's compare
   row must read the editor's disk text another way, or name it unread.
3. **For 2d-7-6-2 (copy):** both copy-case launches drew `draftCopyFailed` after a `click()` copy, and
   `verbatim.cjs` shows `draftCopied` absent. That is G3's row, recorded as whatever it reads.
4. **An observation, not a finding.** In the held state (`G2-09`, `G2-19`), the raw editor's *Undo*
   stayed enabled while *Save*, *Stop editing* and *Redo* were disabled. Whether the box accepts an
   undo while a save is in flight was not exercised. It is recorded for 2d-7-8 / 2d-7-9 to look at
   deliberately, not fixed.
5. **An observation about the held drain.** In `G2-09`, the drain after the foreign write read
   `prev=a569b4d9…` (the pre-save revision), not the app's own committed `d4d2ab17…`. This is
   consistent with self-save suppression (2d-7-5 row 4) and is not claimed as a defect. It bears on
   G4's stale-under-hold rows (2d-7-8).
6. **S5 still stands** for 2d-7-6-2 … 2d-7-8, unchanged (2d-7-5 §8 item 2).
7. **Every visual G2 claim is unread** (locked screen); 2d-7-9 owes them.
8. **Scratch outside the repository, for 2d-8's list:**
   - `launches/G2-01` … `G2-20` and their ledger lines under the harness root;
   - `~/Library/{WebKit,Caches}/cc.carpio.espansoConfig.probe.G2-*`;
   - `/private/tmp/2d7-6-1-*` (logs, `.out` files, verbatim outputs, hash records and the three
     scripts).

---

## 8. Handoff for 2d-7-6-2 (G3)

- **Same instrument, same binary, same harness.** Re-hash against `SHA256SUMS` before the first launch
  and after the gates. `2d7-6-1-hashcheck.sh` does it in one call.
- **The G3 material is already drawn** in the plans this step ran: compare, keep, the two-step reload,
  supersession, copy by `click()`, the reload's retarget and reseed arms, and the restore's final send.
  2d-7-6-2 should run its own launches under its own names (`G3-*`) rather than cite these, so that each
  row's reading has its own lines. These transcripts may be cited as corroboration.
- **Plans to hand:**
  - the eight external plans;
  - `external-mover-untouched`;
  - `external-restore-drop`, for the dropped and re-picked candidate;
  - `external-restore-cr` and `external-raw-cr`, for the CRLF whole-file panels;
  - `raw-save-race` and `restore-save-race`, for the save arm's own conflict.

  **No frozen plan arms `delay` on `reload_document`,** so `alreadyThere` and `refused` are likely
  unread unless a plan's timing lands them on its own.
- **Recovery is the plain set; the operation panels are hard LF only.** Say so on every such row.
- **The open-surface refusal** counts only with a `--- restore` line showing `competing≥1` (§5.8).
- **Commands:** in zsh, quote the plan (`"${c}:en:keepalive"`). A bare `$c:en` is a history modifier
  (§6 item 1).

---

## 9. Review fixes

**The review** (`docs/reviews/phase-2d-7-6-1.md`, Codex) returned `ship-with-fixes` with **1 BLOCKER
and 1 SHOULD-FIX**. Both are in this step's two records. Each was re-derived against the files before
it was fixed, and each holds.

### 9.1 BLOCKER — the binding acceptance was weakened (`2d-7-6-1-notes.md` §3 clause 2)

**Re-derivation: holds.** The cut's acceptance in `2d-7-split-notes.md` §2 (the *2d-7-6* addendum,
lines 303-306) reads "all eight surfaces retain their values with `writes=0` and an unchanged witness;
each timing state is read or classed per family; the locale switch is read on each family; EN in full
and ES covering each distinct sentence these reads draw". It has **no "or named unread" alternative**
for retention or for the locale switch. Clause 2 as first written added one, taken from the worker
brief rather than from the record. It then marked retention met although all eight per-action
witnesses are unread.

**Fix (records only).**
- §3 now quotes each clause verbatim from the record.
- Clause 2 (retention) is marked **NOT MET**, and so is clause 5 (the locale switch).
- The new §3a names the missing plan capability for each. It states the two ways to close them (an
  instrument revision under entry 6, or an owner ruling handing them to 2d-7-9 and 2d-7-10), and it
  records that the orchestrator stops the driven run `BLOCKED` on that owner decision.
- §7 item 1 no longer calls the gaps "not blocking".

### 9.2 SHOULD-FIX — the conflict panel's absence during the hold was inferred, not sampled (`2d-7-6-1-window-reading.md` §3)

**Re-derivation: holds.** `statusHeldPlan` (`src/probe.ts`) samples the raw section during the hold
through `reportOutside`. That function lists only the buttons whose closest `div.panel.external` is
null, and it removes that panel from the clone whose text it prints. So `G2-09` and `G2-19` hold no line
that reports the panel's presence or absence before `--- hd released raw-external=present`. The reading
said "no conflict panel was drawn over the editor", and "for the 7 s of the hold", where the held
sentence was sampled once.

**Fix (records only).** The reading's §3 now claims only what was sampled:
- the held sentence and the disabled controls, once, about 0.6 s after the press;
- the held sentence gone after the release;
- the panel present after the release.

**Whether the panel existed during the hold is named UNREAD.** Clause 3 of §3 says the same. No other
sentence in either record claimed it.

No source, instrument or harness file was touched by these fixes, so no gate was re-run.
