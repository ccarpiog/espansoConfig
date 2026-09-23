# Phase 2d-7-7 — R38: the fifteen byte-exact fixtures (notes)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-7*, bound by §3 entries 22 and 34, with
16, 18 and 35 as they apply. Known before starting:
[`2d-7-4-2-notes.md`](2d-7-4-2-notes.md) §8 item 1. Owed in: [`2d-7-6-2-notes.md`](2d-7-6-2-notes.md) §7
(S5 still stands; `emitted=0` on the save races is 2d-7-8's).
**Risk:** `routine`. **Driven:** yes. **Records only:** this file and
[`2d-7-7-window-reading.md`](2d-7-7-window-reading.md). No tracked source changed. The instrument and the
harness were not edited; no plan, fixture or manifest line was added. No real-config file was opened,
copied, quoted or used as a launch input.

**Outcome: one acceptance clause cannot be met with the frozen instrument and the record gives it no
"unread" alternative — "Each fixture has its panel or refresh line". The step stops `BLOCKED` on it
for the owner (§3a).** Everything the frozen instrument could give was read: all fifteen drawn in the
raw viewer, four equal hashes each, the text matched against the bytes out of the app, three in ES.

---

## 1. The frozen instrument, checked before any reading and after the gates

`/private/tmp/2d7-6-1-hashcheck.sh` (unchanged) against `/private/tmp/2d7-instrument-reviewed/SHA256SUMS`:

| When | Result | Record |
|---|---|---|
| 16:56:44, before the first launch | **18 of 18 `OK`**, 0 `DIFF` | `/private/tmp/2d7-7-hashes-start.txt` |
| 17:04:43, after the last launch and the gates | **18 of 18 `OK`**, 0 `DIFF` | `/private/tmp/2d7-7-hashes-end.txt` |

`target/debug/espansoconfig` was `53d84fb2…510b` at both checks and in all 18 launches' `binary.sha256`.
`git diff --stat src-tauri/src/main.rs src/main.ts` read `2 files changed, 5 insertions(+), 1
deletion(-)` after the gates.

---

## 2. The inventory, made before any launch

What the frozen `launch-7.sh`, `fixtures-7.manifest` and `src/probe.ts` plans give each of the fifteen:

| Need | Given? | Why |
|---|---|---|
| Copied byte-exact from the synthetic corpus | **Yes, all 15** | Each has a `repo:` manifest line and is already imported in `fixtures/`; `launch-7.sh verify` printed `ok` for all 15 and for `config-crlf-bom-r0.yml`. |
| Staged as `match/conflict.yml` | **Yes, all 15** | `--conflict <fixture>` replaces `R0` after `select_fixtures` (2d-7-4-2 §2). |
| `config/default.yml` a CRLF+BOM synthetic config | **Yes** | `--config config-crlf-bom-r0.yml` (harness `synthetic-7/`, neutral content). |
| Drawn in the raw viewer, text printed for comparison | **Yes, all 15** | `raw-open-crlf` opens the viewer over `match/conflict.yml`, prints `--- disk crlf-viewer <json>` and does nothing else. Its two CRLF-only sentence expectations print `MISMATCH` on an LF file; that is the plan's wording, not a failure (reading §4). `external-raw` also prints a viewer line, but then writes (below). |
| One external change **written by the script** as a byte-level edit keeping line endings, BOM and final-newline state | **No, for any of the 15** | `launch-7.sh`'s writers (`write`, `burst`, and the page's `--- script-write`/`--- script-burst`) write only **manifest fixtures**, and the manifest holds no successor of any of the fifteen. The probe writers (`probe_second_writer` …) write `R1`/`R2`/`R4`, which `select_fixtures` fixes per case to the hard set (hard LF, hardcr, hardcrlf) — whole-file replacements by unrelated text, not an edit of the fixture, and not the script's. Adding the successors or a manifest line is forbidden. This is exactly 2d-7-4-2 §8 item 1. |
| Drawn on one conflict panel, or on the viewer's refresh | **No, for any of the 15** | Both need the change above. `external-raw --conflict <fixture>` would print a refresh line, but only after `probe_second_writer` replaced the fixture with `hard-alpha-changed-r1.yml`: the refresh and every later panel draw the **hard fixture**, never the fixture under test, so they say nothing about R38's shapes. It was therefore **not launched**. No plan opens an editor over `conflict.yml` and then asks for a script write of a successor (the page cannot learn a successor's name). |
| Four SHA-256 values (source, copy, launch-before, launch-after) | **Yes, out of the app** | Source from the repo; copy from `fixtures/`; launch-before from `xdg-before/` (the tree copy `build_tree` takes before `open`); launch-after from `xdg/` after the kill (also `bytes.txt`'s `conflict.yml=`). The page does not print them; the harness files do. |
| `writes=0` | **Whole-launch only** | `raw-open-crlf` is a retained plan with `start`/`end` checkpoints only; its `--- span start→end writes=0 … witness=unchanged(except none)` is a whole-launch observation (S5). |
| Three in ES | **Yes** | `raw-open-crlf:es`. |

---

## 3. Acceptance, clause by clause

Quoted verbatim from `2d-7-split-notes.md` §2 *2d-7-7*, nothing added.

1. **"For each fixture, four SHA-256 values: source, copy, launch-before and launch-after. The first two
   are equal, and a mismatch voids the launch."** **MET** (reading §2). All four equal in all 18 launches;
   no launch void. launch-after equals launch-before because no change was made (clause 3).
2. **"The viewer's text is compared verbatim against the bytes, out of the app."** **MET** (reading §3).
   Eleven fixtures `EXACT`; `bom-utf8.yml` exact after decoding its one `byte order mark U+FEFF` marker;
   the two CRLF-bearing fixtures exact except that each CRLF is drawn as one break, which is
   `SourceText`'s documented rule and which the DOM cannot distinguish. `verbatim-9c` agrees independently
   on the 17 it has a mode for. The limit is stated in the reading, not hidden.
3. **"Each fixture has its panel or refresh line and `writes=0`."** **NOT MET — BLOCKED.**
   - *Panel or refresh line:* **none, for all fifteen.** No external change could be made with the frozen
     instrument (§2). The clause has no "or named unread" alternative in the record.
   - *`writes=0`:* every launch prints `writes=0` on its whole-launch span, with `rust-writes=0` at both
     checkpoints and an empty tree diff. Under S5 this is a **labelled whole-launch observation**, not an
     entry-16 per-action witness; these launches have no writer at all, but the step does not upgrade it.
4. **"Each fixture's record says what it was drawn in."** **MET** (reading §4): the raw viewer only, for
   every fixture; no panel and no refresh.

**Spec body, not an acceptance clause:** three fixtures read in ES — **done** (reading §5).
`config/default.yml` CRLF+BOM synthetic — **done**.
**Entry 18:** unlocked and visible at every sampled instant; no `:keepalive`; one capture looked at.
**Entry 22:** only "drawn and matched the bytes" is claimed. **Entry 34:** synthetic fixtures only,
window captures only, no `*-screen.png` touched, real corpus never an input. **Entry 19:** every launch
reached its terminal line.

### 3a. The blocked clause, and the owner's options

**Clause:** "Each fixture has its panel or refresh line and `writes=0`." The record allows no unread
alternative, and the 2d-7-6-1 / 2d-7-6-2 rulings are not standing rulings, so the worker does not close
it. What would close it:

- **(a) Owner ruling: unread and close.** Record the panel/refresh half unread for all fifteen (the
  viewer half, the hashes and ES are read), hand it to 2d-7-10's unread-row inventory (and to 2d-7-9 only
  if the owner wants it seen there). No instrument change.
- **(b) Instrument revision.** Add fifteen successor fixtures (a byte-level edit of each, keeping its line
  endings, BOM and final-newline state) to `fixtures-src/` and the manifest, plus a plan that shows
  `conflict.yml` in the viewer and requests a `--- script-write` of a successor it is told by name (for
  example through an env variable `launch-7.sh` passes), then waits for the refresh and prints its
  `--- disk` line — and, for the panel, the same over the raw editor where the fixture has no `\r`. That
  changes the frozen hashes and meets entry 6's single instrument review; the reads would then be re-run.
- **(c) Owner ruling on a narrower reading**, e.g. accept the viewer half plus a refresh over the probe's
  whole-file replacement (`external-raw --conflict`). The worker advises against it: that refresh draws the
  hard fixture, not the fixture under test (§2).

---

## 4. The launch list

`R38-01` … `R38-15` EN (one per fixture, CLAUDE.md §4 order), `R38-16` … `R38-18` ES
(`crlf-line-endings.yml`, `unicode-offsets.yml`, `file-comments-and-mixed-endings.yml`), all
`raw-open-crlf` with `--config config-crlf-bom-r0.yml --conflict <fixture>`. Every one reached `--- end`,
none void, none re-run; details in the reading §1. No other launch was made; no name was spent on a refusal.

---

## 5. Gates (instrument present)

Exit statuses read from the tool; output to files, never read through a pipe for the status.

| Command | Exit | Figure |
|---|---|---|
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings` (`/private/tmp/2d7-7-clippy.log`) | 0 | — |
| `cargo test --workspace -- --test-threads=1 > /private/tmp/2d7-7-cargo.log 2>&1` | 0 | 26 `test result:` lines, **1330** passed, 0 failed |
| `npm run check` (`/private/tmp/2d7-7-check.log`) | 0 | **462** files, 0 errors, 0 warnings |
| `npm test` (`/private/tmp/2d7-7-vitest.log`) | 0 | 72 files, **3547** tests |
| `npm run build` (`/private/tmp/2d7-7-build.log`) | 0 | **201** modules |
| server-only oracle `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 (no match) | absent |
| client-only oracle `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2` |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

Rung **`1330 / 462 / 3547 / 201`**, unchanged. `git status --short --untracked-files=all` before the
records: the four instrument paths and `PROGRESS.json` (the orchestrator's, untouched here).

---

## 6. Deviations

1. **`raw-open-crlf` used over LF fixtures.** It is the only frozen plan that draws the viewer and does
   nothing else. Its two CRLF-only expectations print `MISMATCH` on the thirteen LF fixtures; they are
   recorded as the plan's wording, and `mismatch-lines=2` there is not a void (the reconcile lines are
   the void condition, and all read `equal`).
2. **`external-raw` not launched** (§2): its refresh would draw the hard fixture, not the fixture under
   test.
3. **One out-of-app script added under `/private/tmp`**, outside the harness root and the frozen set:
   `2d7-7-compare.cjs` (reads fixtures, launch trees and transcripts only).

---

## 7. Open items for later steps

1. **The panel/refresh half of R38 for all fifteen** (§3a) — for the owner's ruling now.
2. **The ending of each line break is not observable in the viewer's DOM** (reading §3); a claim about
   CRLF-versus-LF per break would need a different witness (for example the bytes a reseed or a
   successor drew, or a `document_text` answer printed whole). For 2d-7-10.
3. **S5 still stands** for 2d-7-8. The save races' `emitted=0` (2d-7-6-2 §7 item 5) stays 2d-7-8's.
4. **Scratch for 2d-8's list:** `launches/R38-01` … `R38-18` and their ledger lines;
   `~/Library/{WebKit,Caches}/cc.carpio.espansoConfig.probe.R38-*`; `/private/tmp/2d7-7-*` (the `.out`
   files, the hash records, the gate logs, the `verbatim-9c` outputs, the comparison script and its output).

---

## 8. Handoff

- **Same instrument, same binary, same harness** (§1).
- **If (a):** 2d-7-7 closes with clause 3's panel/refresh half unread; 2d-7-10 inventories it; next is 2d-7-8.
- **If (b):** the revision and its review come first; the eighteen reads here remain valid for clauses 1,
  2 and 4 only if the instrument's viewer path is unchanged by it.
