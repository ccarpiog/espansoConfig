# Phase 2d-7-8 — G4: the reconciliation-status states 9c left unread (notes)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-8*, bound by §3 entries 17 (reached /
held / constructed; a constructed state is never credited as reached), 23 (the classes are predictions;
the 9b-1 §8.3 release-path sequence is named unreachable up front) and **37** (the owner's standing
ruling). The G4 rows are the consult's ([`phase-2d-7-design.md`](../reviews/phase-2d-7-design.md)
`:434-452`). Owed in: [`2d-7-7-notes.md`](2d-7-7-notes.md) §7 and
[`2d-7-6-2-notes.md`](2d-7-6-2-notes.md) §7 (S5; the save races' `emitted=0`).
**Risk:** `routine`. **Driven:** yes. **Records only:** this file and
[`2d-7-8-window-reading.md`](2d-7-8-window-reading.md). No tracked source changed. The instrument and the
harness were not edited; no plan, fixture or manifest line was added. No real-config file was opened,
copied, quoted or used as a launch input.

**Outcome: the step closes under entry 37.** Of the fourteen G4 rows, **one is held** (`stale` behind a
panel alone), **none is reached or constructed**, and **thirteen are unread** — eleven because no frozen
plan reaches them (each with its missing plan capability named, handed to 2d-7-9 and 2d-7-10), one
named unreachable up front (the 9b-1 §8.3 sequence), and the owner row, which is G5's. The owner's
standing ruling, verbatim (record §3 entry 37):

> For the rest of 2d-7, any row the frozen instrument cannot read is recorded unread and hadnded to 2d-7-9 and 2d-7-10.

The record's §2 clause text is not reworded; its acceptance ("every G4 row appears exactly once with its
class") is **met** by §3's table.

---

## 1. The frozen instrument, checked before any reading and after the gates

`/private/tmp/2d7-6-1-hashcheck.sh` (unchanged):

| When | Result | Record |
|---|---|---|
| 17:19:02, before the first launch | **18 of 18 `OK`**, 0 `DIFF` | `/private/tmp/2d7-8-hashes-start.txt` |
| 17:27:29, after the last launch and the gates | **18 of 18 `OK`**, 0 `DIFF` | `/private/tmp/2d7-8-hashes-end.txt` |

`target/debug/espansoconfig` was `53d84fb2…510b` at both checks and in all 13 launches'
`binary.sha256`. `git diff --stat src-tauri/src/main.rs src/main.ts` read `2 files changed, 5
insertions(+), 1 deletion(-)` after the gates.

---

## 2. What was done, and why

1. **Inventory before launching.** The frozen `runCase` switch (`src/probe.ts`) holds the thirteen 9c
   `status-*` plans and the 2d-7 `external-*`/race plans; **no plan was written for G4**
   (2d-7-4-2 §8 item 1 said G4 had not been checked row by row). Each G4 row was matched against those
   plans, the four 9c probe commands (`probe_extra_writer`, `probe_remove_other`, `probe_remove_extra`,
   `probe_lock_other`) and the five substitutions (`mayHaveWritten` armed only on `save_raw_document` and
   `save_match`; `delay` only on `save_raw_document`; `listenRefused`, `epochZero`, `discardOnce`).
2. **Every row a frozen plan touches was launched**, EN, and the four plans that bear on a class got ES
   twins: 13 launches, `G4-01` … `G4-13` (reading §1). None voided, none re-run.
3. **Deviation 1 — no `:keepalive`.** The brief asks status plans to pass `:keepalive` *in a hidden
   window* (2d-7-4-2 §8 item 2). The screen read unlocked and every beat `visibility=visible`, so the
   launches were visible, and **entry 18 forbids the keep-alive in a visible launch**. `G4-01` ran
   without it first, as 2d-7-6-2's `G3-01` did, and reached `--- end`; every later launch followed and
   reached its terminal line. Disclosed here and in the reading's preamble.
4. **Deviation 2 — the four race/stale re-launches** (`G4-07`, `-08`, `-09`, `-13`) serve no G4 row;
   they read the owed `emitted=0` observation (§5).
5. **The screen was unlocked**, so entry 18 does not name every visual claim unread; but only one
   capture was looked at (reading §6), and every other visual claim stays 2d-7-9's.

---

## 3. The G4 rows, each exactly once, with its class

Classes (entry 17): **reached** = real disk, real answers; **held** = a `delay` substitution only;
**constructed** = a content-changing substitution; **unread** = not drawn by any launch here.

| # | G4 row (consult `:434-452`) | Consult's prediction | **Class** | Launch(es) | What was read / missing plan capability |
|---|---|---|---|---|---|
| 1 | The retry enabled and pressed, after a real watcher failure provoked by `probe_lock_other` and then restored | reached | **unread** | `G4-01` (lock half) | The lock half was read: `unavailable` drawn, **no control drawn** in the locked state. **Missing:** a probe command or script action that restores `match/other.yml`'s mode *while the app runs* (only the harness does, after exit), and a plan step that then waits for the retry, prints it enabled and presses it. The one retry control (`externalConflict.action.retry`) was drawn only disabled, under a hold (`G4-02`). |
| 2 | `stale` from a `Named` pending row | reached | **unread** | — | **Missing:** a plan that puts an observation on a path the file list already names while its row is pending, and reads that row. The frozen writers give `Unnamed` (`probe_extra_writer`) or a projected document's change. |
| 3 | Six of the eight panels' acknowledgements (creator, recovery, deleter, mover, duplicator, restore) | reached | **unread** | — | **Missing:** a `mayHaveWritten` substitution armed on those six surfaces' write commands, followed by a writer and a read of each panel's acknowledgement; the frozen plans arm it only on `save_raw_document` and `save_match` (the two 9c already read; re-read here for the raw editor, `G4-03`/`-11`). |
| 4 | A refused acknowledgement press | reached | **unread** | — | **Missing:** a plan that brings an acknowledgement to a disabled state (outlived origin or moved hold) and presses it, printing the refusal and the command count. Every acknowledgement press here was on an enabled control (`G4-03`, `-04`, `-11`). |
| 5 | Empty-workspace retention (remove both documents) | reached | **unread** | — | **Missing:** a remover for `match/conflict.yml` (only `probe_remove_other` and `probe_remove_extra` exist; the script writers never remove) and a plan that removes both match files and reads what the window retains. |
| 6 | `projectionReplaced` reactivity | reached | **unread** | — | **Missing:** a plan that registers an origin and then replaces the projection under it, reading the control change from enabled to disabled with no remount. |
| 7 | The outlived route acknowledgement and its exits note (under a held answer) | held | **unread** | — | **Missing:** a held-answer plan that leaves a route origin standing and then replaces the projection (`route.projectionReplacedExits`). `status-held` builds no route origin (`hd-route absent`). |
| 8 | `pathDrift.changed` (under a held answer) | held | **unread** | `G4-06` (other arms) | `unreadable` and `removed` read again; `changed` not drawn. **Missing:** a writer that changes the content of a path the window never named, as the watcher reads it (a created readable file arrives as an `Added` row, 9c `S9-11`). |
| 9 | The two surface notes, `surface.observationExit` and `surface.holdEnded` (under a held answer) | held | **unread** | `G4-02`, `G4-10` (absent) | After the held release the panel carried no acknowledgement, so no note. **Missing:** a plan that leaves a surface's acknowledgement disabled by `projectionReplaced`/`superseded` or by `holdMoved`. |
| 10 | `noTransport`, constructed by `listenRefused` or unread | constructed or unread | **unread** | `G4-05`, `G4-12` | `listenRefused` drew `registrationFailed.rejected`, not `noTransport` (reading §4): the app gives `noTransport` only for its own `NO_RECONCILIATION_TRANSPORT` error. **Missing:** a substitution that removes the transport (or throws that exact error) before registration. `rejected` is re-read as constructed and not credited to this row. |
| 11 | The 9b-1 §8.3 release-path sequence | named unreachable | **unread — named unreachable up front** (entry 23) | none | 9b-1's own judgement (`2d-6-9b-1-notes.md` §8.3): "It is not reachable as far as I can see. Installing needs a surface holding that origin's `ConflictModel`, and with the surface closed no receiver ever received the model." No launch was spent on it. |
| 12 | After 2d-7-1: `stale` behind a panel alone | — | **held** | `G4-02` EN, `G4-10` ES | After the held save's release the raw editor's external panel was present and the pane drew `externalDocument.stale` alone, no route origin (reading §3). Corroborated, not credited, by the constructed `G4-03`/`-11` (after the acknowledgement). Not 2d-7-1's `writtenHere` shape. |
| 13 | After 2d-7-1: 9b-3 §6 item 1, with its §8 recheck | — | **unread** | `G4-04` (context) | `G4-04` re-read 9b-3's delivered shape (refused automatic reread registered on the route; acknowledge; reread), constructed. **Missing:** a plan that establishes the uncertainty hold *while* an automatic read is out (a `delay` on the automatic read with a `mayHaveWritten` save settling inside it), and, for §8, a substitution making the re-adoption's `get_document` fail. |
| 14 | Owner: the `visibilitychange` arm, the hidden-state refusal, `pagehide`/`unload` on quit | G5 | **unread — G5's, not this step's** | none | 2d-7-9 reads them (entry 21); not run here. |

**Tally:** reached 0 · held 1 · constructed 0 · unread 13 (11 for want of a plan, 1 named unreachable,
1 G5's). The unread rows 1-10 and 13 are **handed to 2d-7-9** (what a visible owner session or a real
gesture can read) **and to 2d-7-10** (the unread-row inventory), with the capabilities named above. No
instrument revision is authorized (entry 6); none was made.

---

## 4. The launch list

`G4-01` `status-unavailable:en` · `G4-02` `status-held:en` · `G4-03` `status-uncertain-raw:en` · `G4-04`
`status-uncertain-route:en` · `G4-05` `status-registration:en` · `G4-06` `status-membership:en` · `G4-07`
`status-stale:en` · `G4-08` `raw-save-race:en` · `G4-09` `restore-save-race:en` · `G4-10`
`status-held:es` · `G4-11` `status-uncertain-raw:es` · `G4-12` `status-registration:es` · `G4-13`
`status-stale:es`. Each on a fresh bundle path and identifier, language set through the picker, no
`:keepalive`, every one reaching `--- end`. Details in the reading §1.

---

## 5. Owed items

- **S5 stands.** No per-action no-write claim is made on any retained plan. The whole-launch `--- span
  start→end` lines and the out-of-app tree diffs are labelled whole-launch observations (reading §7),
  never entry-16 witnesses.
- **The save races' `emitted=0` — read.** `G4-08` and `G4-09` reproduced it (`emitted=0 delivered=0` at
  `end`, 8 s launches, drains 1). `G4-07`/`G4-13` (`status-stale`) show the same over 20 s, so it is not
  the race plan's short wait. In every launch where the foreign write came after this window's save
  committed, Rust emitted 1. Observation: a foreign write followed within about 0.1 s by a save refused on
  those bytes produced no emitted observation. The conflict path's comment in `src-tauri/src/commands.rs`
  (its locked read "marks and does not publish") is consistent with it; the cause was **not
  established**, and it is not classed a defect here (open item 2).

---

## 6. Gates (instrument present)

Each run alone, output to a file; exit statuses from the tool.

| Command | Exit | Figure |
|---|---|---|
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings` (`/private/tmp/2d7-8-clippy.log`) | 0 | — |
| `cargo test --workspace -- --test-threads=1 > /private/tmp/2d7-8-cargo.log 2>&1` | 0 | 26 `test result:` lines, **1330** passed, 0 failed |
| `npm run check` (`/private/tmp/2d7-8-check.log`) | 0 | **462** files, 0 errors, 0 warnings |
| `npm test` (`/private/tmp/2d7-8-vitest.log`) | 0 | 72 files, **3547** tests |
| `npm run build` (`/private/tmp/2d7-8-build.log`) | 0 | **201** modules |
| server-only oracle `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 (no match) | absent |
| client-only oracle `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2` |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

Rung **`1330 / 462 / 3547 / 201`**, unchanged. `git status --short --untracked-files=all`: the four
instrument paths, `PROGRESS.json` (the orchestrator's, untouched here) and this step's two records.

---

## 7. Open items for later steps

1. **The unread G4 rows 1-10 and 13** (§3), each with its missing plan capability — handed to 2d-7-9 and
   2d-7-10 under entry 37. Row 11 stays named unreachable; row 14 is 2d-7-9's own.
2. **The refused-save silence** (§5): a foreign write followed within ~0.1 s by a save refused on those
   bytes emitted no observation in four launches (`G4-07`, `-08`, `-09`, `-13`). For 2d-7-10 to classify (expected coalescing, or a
   gap: the window's only record of the change is then the refused save's own `stale`).
3. **`unavailable` draws no control** (`G4-01`): the consult's premise that the retry follows a watcher
   failure may not match the code, where `externalConflict.action.retry` belongs to a held observation.
   For 2d-7-10 to reconcile with the consult's row 1.
4. **`noTransport` is not reachable by `listenRefused`** (§3 row 10); the consult's "constructed (by
   `listenRefused`, as 9c did)" does not hold — 9c constructed `rejected`. For 2d-7-10.
5. **Scratch for 2d-8's list:** `launches/G4-01` … `G4-13` and their ledger lines;
   `~/Library/{WebKit,Caches}/cc.carpio.espansoConfig.probe.G4-*`; `/private/tmp/2d7-8-*` (the `.out`
   files, the `verbatim-9c` outputs, the hash records, the gate logs).

---

## 8. Handoff

Same instrument, same binary, same harness (§1). 2d-7-8 closes under entry 37. The next step is
**2d-7-9**, owner-present: a driven run reaching it stops `BLOCKED` (entry 21).
