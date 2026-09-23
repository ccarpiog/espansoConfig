# Phase 2d-7-6-2 — G3: choices, adoption arms and the open-surface refusal (notes)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-6*, its *Addendum 2026-09-23 — the
orchestrator's cut* (this is the `2d-7-6-2` half) and the §2 preamble. It is bound by §3 entries 15–18,
23, 25 and 35, and by §5.8. G3's rows are the consult's (`docs/reviews/phase-2d-7-design.md:417-432`).
Owed in: [`2d-7-6-1-notes.md`](2d-7-6-1-notes.md) §7 items 2–3 and §8;
[`2d-7-5-notes.md`](2d-7-5-notes.md) §9.
**Risk:** `high`. **Driven:** yes. **Records only:** this file and
[`2d-7-6-2-window-reading.md`](2d-7-6-2-window-reading.md). No tracked source changed. The instrument
and the harness were not edited. No real-config file was opened, copied or quoted.

---

## 1. The frozen instrument, checked before any reading and after the gates

`/private/tmp/2d7-6-1-hashcheck.sh` (2d-7-6-1's, reused unchanged) hashes every path in
`/private/tmp/2d7-instrument-reviewed/SHA256SUMS` live and compares each with the recorded value:

| When | Result | Record |
|---|---|---|
| 16:15:52, before the first launch | **18 of 18 `OK`**, 0 `DIFF` | `/private/tmp/2d7-6-2-hashes-start.txt` |
| 16:29:44, after the last launch attempt and the gates | **18 of 18 `OK`**, 0 `DIFF` | `/private/tmp/2d7-6-2-hashes-end.txt` |

The four instrument paths are 2d-7-4-2 §5.3's: `main.rs` `b3836a28…c3e5`, `main.ts` `215f8507…8615`,
`probe.rs` `c65d1cb5…9688`, `probe.ts` `22661785…4d3e`. `launch-7.sh` is `5d5f6397…82ec`.
`target/debug/espansoconfig` was `53d84fb2…510b` at both checks and in all 28 launches'
`binary.sha256`. `git diff --stat src-tauri/src/main.rs src/main.ts` read `2 files changed, 5
insertions(+), 1 deletion(-)` after the gates.

---

## 2. What was done, and why

**Twenty-eight launches, `G3-01` … `G3-28`, one plan each.** Each went through `launch-7.sh launch` to
a fresh bundle path and bundle identifier, and each had its language set through the picker. `G3-01`
… `G3-14` are EN and `G3-15` … `G3-28` their ES twins, plan for plan. Every launch reached its
terminal line, and none was voided (reading §1).

**The screen read unlocked** at every recorded preflight check, and each of the 295 recorded beats read
`visibility=visible`; the conditions between those samples are unobserved (reading §1). So **no launch
used `:keepalive`**: entry 18 forbids it in a visible launch. `G3-01` was run without it first, as the
test of whether a visible page would run to its end unkept, and it did; every later launch followed.

**Plans, all frozen ones, chosen from 2d-7-6-1 §8's list:**
- the external plans for each family;
- `external-mover-untouched`;
- `external-restore-drop`;
- the two CRLF whole-file plans;
- the two save-race plans;
- `restore-registry`, the only plan that prints `--- restore` refusal lines.

`external-editor`, the only copy plan, could not be launched (§6 item 1). No plan was invented and
nothing was substituted by hand. **No substitution was armed in any launch**, so every read row is
*reached* (entry 17).

**Named unreachable up front** (entry 23): committed-but-reprojection-failed.

---

## 3. Acceptance, clause by clause

The acceptance is the addendum's (`2d-7-split-notes.md` §2, *2d-7-6* addendum), quoted verbatim.

1. **"each choice read on each family".** **NOT MET** (reading §2). Per family:
   - **Operation (hard LF only):** compare, keep (both arms) and the two-step reload are read on all
     three surfaces. Recovery is read as refused (`recovery.unavailable.operationDraft`). *Leave this
     as it is* is **unread**.
   - **Whole file:** compare and the two-step reload are read on raw (reseed) and restore (retarget),
     LF and CRLF. No row read on this family offers a keep or a recovery choice. *Copy my text* (raw)
     and *Keep editing* / *Leave this as it is* are **unread**.
   - **Authored text:** compare is read on the host editor (plain set), the recovery form (plain set)
     and the creator. Keep (*Keep my draft*) is read, manual-resolution arm only (plain set). Recovery
     is read (plain set). **The reload (both steps) is unread on every authored-text surface. So are
     copy (§6 item 1) and *Keep editing*.**

   The unread choices are **unreachable with the frozen instrument**. No frozen plan presses the reload
   on the editor, the creator or the recovery form, and none presses *Keep editing* / *Leave this as it
   is* anywhere. The one copy plan was refused by the harness because of the host clipboard.
2. **"each adoption arm classed".** **MET, by classing** (reading §4):
   - `installed`: ***reached*** (deleter, mover and duplicator, EN and ES);
   - `alreadyThere` and `refused`: **unread**;
   - committed-but-reprojection-failed: **unreachable, named up front**.

   The acceptance asks that each arm be *classed*. The addendum's own read list says "`alreadyThere`
   and `refused` under `delay`, or named unread", which is where the unread class for those two comes
   from; it was not added here. `installed` is credited from a notice that, **in the source**, only
   the installing branch produces. That inference is stated in the reading, not hidden.
3. **"EN in full and ES covering each distinct sentence these reads draw".** **Met for what was drawn**
   (reading §6):
   - every launch has an ES twin;
   - `verbatim-9c` found 0 problems in all 28 launches;
   - the EN and ES sets of attributed dictionary keys are equal: 116 = 116, none only-EN and none
     only-ES.

   **"EN in full" is bounded by clause 1:** the editor plan did not run in either language, and the
   sentences only the unread choices would draw are in neither set.
4. **Hashes equal the frozen set before and after; hook diff unchanged.** **Met** (§1).
5. **`CLAUDE.md` §4 gates with the instrument present, each exit 0; rung `1330 / 462 / 3547 / 201`.**
   **Met** (§5).
6. **`git status --short --untracked-files=all`** shows the four instrument paths, `PROGRESS.json`
   (modified by the orchestrator before this step; not touched here) and the two new records. **Met.**

**Entry 17:** every read row is *reached*; nothing is *held* or *constructed*.
**Entry 18:** the three visibility conditions were observed at the sampled instants only (unlocked at
each recorded check, visible at each recorded beat, a window at each capture), never between them. One capture was looked at (reading
§7); every other visual claim is unread and remains 2d-7-9's.
**Entry 19:** every launch reached its terminal line.
**Entry 23 / §5.8:** the open-surface refusal is **not credited**. All eight `--- restore` lines in
`G3-14` and `G3-28` read `competing=0`, so it stays unread (reading §5).
**Entry 16 / S5:** no per-action no-write claim is made. These are retained plans (2d-7-5 §9).

**One acceptance clause is NOT MET: "each choice read on each family" (clause 1).** Clause 3 is met
only for what was drawn. §3a says what closing clause 1 needs.

### 3a. Disposition of the unmet clause

Clause 1 cannot be met by more launches of the frozen plans. What is missing:

1. **Plan capability:**
   - a *Load the version on disk* press, both steps, on at least one authored-text surface (editor,
     creator with a destination, or recovery form), with the adoption read afterwards;
   - a *Keep editing* / *Leave this as it is* press on each family, with the panel's and the surface's
     state read afterwards.
2. **Host state, not plan capability:** a run of `external-editor` while the clipboard holds only plain
   text, or nothing, for copy on the authored-text family. The raw editor's *Copy my text* has no plan
   at all, which is a capability gap like item 1.

**Closing it needs one of two things, as at 2d-7-6-1 §3a:**
- **an instrument revision** adding the plans, which changes the frozen hashes and meets entry 6's
  single instrument review;
- **an owner ruling** that records these choices unread and hands them on to 2d-7-9 (owner-present,
  where the copy under a real gesture already sits, entry 20) and to 2d-7-10's inventory.

**The worker judges this an owner decision.** The 2d-7-6-1 ruling covered that step's clauses 2 and 5
and does not extend to this clause by an agent's reading. The orchestrator decides whether to stop the
driven run `BLOCKED` on it.

---

## 4. The launch list

| Launch | Plan | Result |
|---|---|---|
| G3-01 | `external-recovery:en` | `--- end`; instrument ok 14/14; 0 void, 0 mismatch (plain fixture set) |
| G3-02 | `external-creator:en` | the same |
| G3-03 | `external-deleter:en` | the same (hard LF only) |
| G3-04 | `external-mover:en` | the same (hard LF only) |
| G3-05 | `external-duplicator:en` | the same (hard LF only) |
| G3-06 | `external-mover-untouched:en` | the same (hard LF only) |
| G3-07 | `external-raw:en` | the same |
| G3-08 | `external-raw-cr:en` | the same (switches to ES mid-plan) |
| G3-09 | `external-restore:en` | the same |
| G3-10 | `external-restore-cr:en` | the same |
| G3-11 | `external-restore-drop:en` | the same |
| G3-12 | `raw-save-race:en` | the same |
| G3-13 | `restore-save-race:en` | the same |
| G3-14 | `restore-registry:en` | the same |
| G3-15 … G3-28 | the fourteen above, `:es` | the same, every one |
| (refused ×3, no name spent) | `external-editor:en` | exit 73: the host clipboard holds more than plain text |

Every launch: lock preflight and `lock-at-end` both `unlocked`, `home-files=0`, `probe.err-bytes=0`,
`lsappinfo-bundle-id` equal to its own identifier, and the clipboard untouched (`copies=no`).

---

## 5. Gates (instrument present)

Exit statuses were read from the tool. `cargo` and `npm` output went to files and was never read through
a pipe.

| Command | Exit | Figure |
|---|---|---|
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings` (`/private/tmp/2d7-6-2-clippy.log`) | 0 | — |
| `cargo test --workspace -- --test-threads=1 > /private/tmp/2d7-6-2-cargo.log` | 0 | 26 `test result:` lines, **1330** passed, 0 failed |
| `npm run check` (`/private/tmp/2d7-6-2-check.log`) | 0 | **462** files, 0 errors, 0 warnings |
| `npm test` (`/private/tmp/2d7-6-2-vitest.log`) | 0 | 72 files, **3547** tests |
| `npm run build` (`/private/tmp/2d7-6-2-build.log`) | 0 | **201** modules |
| server-only oracle `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | no match | absent |
| client-only oracle `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2` |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

The rung is **`1330 / 462 / 3547 / 201`**, unchanged.

---

## 6. Deviations

1. **`external-editor` was never launched.** `launch-7.sh` refuses a copy case unless it can restore the
   clipboard exactly. The host clipboard held `public.utf8-plain-text` plus
   `com.runningwithcrayons.alfred.clipping` at 16:18, at 16:26 and after the gates. All three attempts
   exited 73 before a tree was built, with no ledger line and no name spent. **The worker did not alter
   the owner's clipboard to get past the refusal.** So copy is unread in this step, and the editor's own
   compare line is corroborated only from 2d-7-6-1's `G2-01`/`G2-11` transcripts (reading §2.1, §3).
2. **Visible launches, no keep-alive.** This differs from 2d-7-5 and 2d-7-6-1, whose screens were locked.
   It follows entry 18. Every launch still ended.
3. **Recovery is on the plain set, and the operation panels are on the hard LF set only**, as owed from
   2d-7-5. The reading says so on each such row.
4. **Two out-of-app scripts were added under `/private/tmp`**, outside the harness root and the frozen
   set: `2d7-6-2-fixturein.cjs` and `2d7-6-2-keysets.cjs`, the second a copy of 2d-7-6-1's with the
   launch range changed. They read transcripts, fixtures and dictionaries only.

---

## 7. Open items for later steps

1. **Clause 1's unread choices** (§3a): the authored-text reload, *Keep editing* / *Leave this as it is*
   on every family, copy on authored text and on the raw editor, and the recovery form's own choices.
   These need an owner decision.
2. **`alreadyThere` and `refused` are unread**, and the consult's shape for them may not fit the code
   path. In the operation launches the confirming press issued **no command** (reading §4), so the
   install came from the drain's snapshot. A `delay` on `reload_document` would not hold it; a plan that
   reaches either arm would need a different construction (for example, a second observation standing
   between the two steps, before the confirm). Recorded for 2d-7-10, not designed here.
3. **keep1's adoption is `installed` or `alreadyThere`, undistinguished.** No line tells the two apart.
4. **The open-surface refusal stays unread** (§5.8). The instrument's own comment calls its negative half
   unconstructible from a window.
5. **The save races emitted no wake** (`emitted=0` in `G3-12`/`13`/`26`/`27`). No external panel followed
   within 3 s. This is an observation for 2d-7-8, not a finding.
6. **S5 still stands** for 2d-7-7 and 2d-7-8 (2d-7-5 §8 item 2).
7. **Scratch outside the repository, for 2d-8's list:**
   - `launches/G3-01` … `G3-28` and their ledger lines;
   - `~/Library/{WebKit,Caches}/cc.carpio.espansoConfig.probe.G3-*`;
   - `/private/tmp/2d7-6-2-*` (the `.out` files, the `verbatim-9c` outputs, the hash records, the gate
     logs and the two scripts).

---

## 8. Handoff

- **Same instrument, same binary, same harness.** The hashes are unchanged (§1).
- **If the owner rules clause 1 unread:** 2d-7-9 gets the authored-text reload, *Keep editing* /
  *Leave this as it is* per family, and copy under a real gesture. 2d-7-10 gets the rows of §7
  items 1–4.
- **A copy-case launch needs a plain-text or empty clipboard.** Check `tools/pbstate` before launching
  `external-editor`.

---

## 9. Review and its disposition

One review, by **Codex** through `autoclaude-review.sh` (exit 0, no fallback agent):
[`docs/reviews/phase-2d-7-6-2.md`](../reviews/phase-2d-7-6-2.md), **`ship-with-fixes`, 0 BLOCKERS,
1 SHOULD-FIX**. The reviewer found the adoption-arm classing supported and holding the unmet clause for
an owner ruling justified.

- **SHOULD-FIX (window reading line 27): the entry-18 conditions were claimed at every beat and
  throughout, while lock checks, beats and captures are separate samples.** Re-derived: `G3-03` has 14
  beats and four captures, and the lock is read at preflight only. **Held and fixed** by the
  orchestrator in the records only: the window reading §1 and §7 line, and this file's §2 and §3
  entry-18 lines, now say the conditions were observed at the sampled instants and claim nothing
  between them. No source touched; no gate re-run owed.
