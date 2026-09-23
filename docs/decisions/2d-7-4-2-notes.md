# Phase 2d-7-4-2 — the instrument, page side and shakedowns

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2, the *2d-7-4* block and its *Addendum
2026-09-23*; bound by §3 entries 2–7, 14–16, 19, 20 and 34, read with §5.11, §5.14 and §5.16. The
open items handed on are [`2d-7-3-notes.md`](2d-7-3-notes.md) §6 and
[`2d-7-4-1-notes.md`](2d-7-4-1-notes.md) §8.
**Risk:** `high`. **Touched:** `src/probe.ts` (untracked), one doc comment in
`src-tauri/src/probe.rs` (untracked), `launch-7.sh` under the harness root, and this file. No tracked
source changed. No real-config file was opened, copied or quoted.
**Its review is THE instrument review** (entry 6): the whole instrument, both probe files, the two
hook files, `launch-7.sh` and `tools/*`, against the entry-7 checklist (§4).

---

## 0. Provenance (entry 3, §5.16)

| Copy | SHA-256 | What it is |
|---|---|---|
| `/private/tmp/2d7-4-probe.ts.orig` | `cba6c61a4958f07083d2292722a4441c9be9672c3dd955de085892cf430d22b7` | pre-step `src/probe.ts`, copied before any change (`cmp` clean); equals 2d-7-4-1 §0's hash |
| `/private/tmp/2d7-3-probe.rs.orig` | `d2f6681d255c5767dc65e9454bce18cdcd0ad714184ee477536558c94f4c0942` | pre-2d-7-3 `probe.rs`; equals 2d-7-3 notes §0 |
| `/private/tmp/2d7-4-2-probe.rs.before` | `7db7e05865efdd72979440b6f6f6993ce8a991d228c22a06f65bd2d5861b4789` | `probe.rs` at this step's start (2d-7-3's post-fix hash) |
| `/private/tmp/2d7-4-2-launch-7.sh.before` | `aac7c94ad0084605a20ec2a4301159400260d674b03b595385f1adf91c0db074` | `launch-7.sh` at this step's start (2d-7-4-1 §5) |

`git diff --no-index --stat /private/tmp/2d7-4-probe.ts.orig src/probe.ts`: `1 file changed, 1122
insertions(+), 426 deletions(-)` (5210 lines before, 5906 after). `probe.rs` differs from its
step-start copy by one doc comment (§1.10). `launch-7.sh`: `46 insertions(+), 15 deletions(-)` plus the
one-line fix of §6 item 1.

---

## 1. What changed in `src/probe.ts`, and why

### 1.1 `PROBE_OWN_COMMANDS`, checked against Rust at run time (entry 7 item 2)

The set now lists all **fourteen** names of `probe.rs`'s `PROBE_COMMANDS` (it held eight, so
`probe_remove_other` and the other five were recorded as application traffic; 2d-7-4-1's `S7-L02`
transcript shows `--- ipc … probe_remove_other`). `checkInstrument()` asks `probe_tally` for
`probe_commands` after `goLive()` and prints `--- instrument ok probe-commands=14 page=14`, or
`--- instrument MISMATCH … page-only=[…] rust-only=[…]` on any set difference. The same call keeps
Rust's `write_commands`, from which each span names its write dispatches (no copy of the six names
lives in the page). **TypeScript cannot force the parity at compile time**; the comment says so.

### 1.2 The event spy (entry 14)

`installSpy()` runs synchronously inside the recording `fetch` when the command is
`plugin:event|listen` and the parsed body's `event` is `workspace://reconciliation-ready`. It reads
`window.__TAURI_INTERNALS__.callbacks`. If that is not a `Map`, or holds no function for the body's
`handler`, it prints `--- spy unavailable reason=…` and sets `spy=unavailable`, which voids every
event claim at later checkpoints. Otherwise it replaces the entry with a wrapper that counts, prints
`--- delivered n=… handler=… eventId=… payload=…`, and calls the original once with the same
argument. Its installation line prints the parsed body, which is §5.13's check of the installed
`@tauri-apps/api`: `{"event":"workspace://reconciliation-ready","target":{"kind":"Any"},"handler":<id>}`.

Spy, delivery and plan-wait lines follow the recorder's mode through `instrumentLine()`. They are
buffered until `goLive`, printed once live, and dropped with no plan. `standDown()` also puts back
every entry the spy wrapped, if that entry still holds the wrapper, so the no-plan control keeps
neither the recorder nor the spy.

### 1.3 `--- tally` checkpoints and reconciliation (entries 11, 12, 15, 16)

`checkpoint(tag)` first reads the tallies **at a moment the transport holds still**: no recorded
command in flight, and none issued while `probe_tally` was being read. It retries up to 20 times.
It then prints:
- `--- tally <tag> rust-app=[…] rust-writes=N rust-probe=[…] wakes-installed=N first-installed-us=… emitted=N`;
- `--- tally <tag> page=[…] not-issued=[…] delivered=N spy=<status>`;
- `--- reconcile <tag> commands=… rust-surplus=[…] page-surplus=[…] probe-half=… events=…`;
- `--- witness <tag> entries=N files=[path ino size ctime sha…]`, with numbers kept as strings.

The reconciliation classes are entry 15's.
- Rust > page is `VOID(rust>page)`.
- Page > Rust is allowed only for `plugin:event|*`. Any other name is `VOID(page>rust)`. A
  substitution that never issued is left out of the page count.
- A recorded name that is in Rust's probe list is `probe-half=VOID[…]`.
- Events are classed as follows:
  - nothing on either side: `none-emitted`;
  - emitted = delivered: `observed`;
  - emitted > delivered: `application-fact(emitted>delivered)`;
  - delivered > emitted: `VOID(delivered>emitted)`;
  - an emit with no installed spy: `VOID(spy=…)`.

`reportSpan(from, to, written)` prints entry 16's line:
`--- span A→B writes=N write-commands=[…] emitted+=N delivered+=N witness=unchanged|CHANGED(except
path:as-written=yes|NO …) identical=[…] transient=[…] changed=[…] added=[…] removed=[…]`.
`compareWitness()` implements entry 12's classes:
- **unchanged:** same inode, `ctime` and hash;
- **identical:** a new inode with the same size and hash;
- **transient:** same inode, new `ctime`, same hash;
- **changed:** any other change, and **added** / **removed** for entries on one side only.

Directories are compared for presence only. `settleForSpan()` waits for `IPC_QUIET_MS` of quiet,
then 2 s, then quiet again (entry 16's window).

`startProbe` now takes a `start` checkpoint before the language pick and an `end` checkpoint after the
case, each after the transport has settled, and prints the `start→end` span. Files that script writers
changed during the launch are that span's named exceptions. A probe writer's change is not tracked
there, and the span prints it as `CHANGED`.

### 1.4 The recorder-ordering check (§5.11, entry 7 item 12)

The first checkpoint of every launch also prints `--- recorder-ordering first-checkpoint=<tag>
rust-surplus=[…] verdict=ok|VOID`. A Rust surplus there is a command that crossed before this module
evaluated. The recorder comment now says the claim is **checked, not assumed**, and that TypeScript
cannot force module-evaluation order.

### 1.5 The heartbeat (entry 7 item 9, entry 19)

`beatWhileRunning()` prints `--- beat n=<k> t=<ms> visibility=<state> focus=<yes|no>` about once a
second from `goLive` until the plan ends. It spends the time in backend round trips (`hold`), not in a
timer. The 9c diagnostic plan's own beats were renamed `--- status-beat`, so `launch-7.sh`'s
`last-beat=` line reads only the launch-wide one.

### 1.6 The keep-alive as an explicit plan flag (entry 7 item 8, entry 18)

The plan grammar is now `<case>[:en|es][:keepalive]`. The flag needs the language before it, and any
other third segment is refused. `armForPlan(plan)` starts the keep-alive **only** on the flag. Before
this step it was started for every case named `status-*` or `foreground-*`. The `--- plan` line prints
`keepalive=on|off`. The keep-alive's own wait now asks for its own token (§1.7); it used to compare
against a bare `'pending'`, which tokened answers never equal.

**Consequence:** a status plan in a hidden window now needs `:keepalive` stated.

### 1.7 The snapshot wait reads 2d-7-3's request token (entry 10, 2d-7-3 §6 item 1)

`shot()` parses `requested#<n>` from `probe_snapshot` and polls `probe_snapshot_state({ token: n })`
until the answer is no longer `pending#<n>` (`awaitSnapshot`). It prints `--- shot-done <tag>
webview=<state> awaited=#<n>`. It can report `written#<n>` only for its own token; a keep-alive request
has another token and another image path. An untokened answer prints `untokened …`.

### 1.8 The cases no step names, pruned (entry 1)

The following cases were removed, with the helpers only they used (`sendDeletion`, `chooseOption`,
`valueOf`, `reportReadiness`, `reportConflict`, `ConflictReading`):
- `editor-exact`, `editor-third`, `editor-collision`, `creator-front`, `deleter-exact`, `mover-exact`,
  `duplicator-exact` and `raw-negative`: the 2d-5-era save-conflict cases;
- the `lifecycle-delivery-hard` alias.

The consult's matrix names none of them (consult Q1: "the `external-*` cases for the eight surfaces,
`status-*`, `foreground-activate` and `lifecycle-delivery`").

These were kept:
- `lifecycle-open` and `lifecycle-delivery`;
- `lifecycle-close`, for G5's quit reading;
- `restore-registry`, the open-surface refusal of G3;
- every `external-*`, `raw-open-crlf`, both save races, every `status-*` and `foreground-activate`.

Seven cases were added (§1.11). The switch now has 40 labels, against 42 before.

**The prune's extent is the worker's choice** (§6 item 1 of the record). It does not show that what
remains is correct.

### 1.9 Selectors that name fields: the 9c `SourceText` artifact (`2d-6-9c-notes.md` §6 item 5)

`reportDiskText` used to print the panel's **first** `div.sourceText`, which on the editor's
external panel is the retained trigger field. Each box is now named by `sourceTextName()`:
- `field:<label>`: its parent is a `div.shownValue` (a conflict panel's retained draft) or an `li`
  (the recovery transfer list), and it takes that parent's first `span.marker`;
- `slice`: it directly follows the `browser.detail.valueAsWritten` caption, in either language;
- `file`: anything else.

The function prints `--- sourcetext <tag> boxes=N [names]`, one `--- field` line per field box, and
`--- disk <tag>` for the first box named `file`. **The naming reads today's component markup**
(`MatchEditor.svelte`, `MatchCreator.svelte`, `RecoveryPanel.svelte`, `DetailPane.svelte`). Nothing ties
it to them, and the comment says so.

### 1.10 The 2d-7-4-1 §8 open items

| § 8 item | Disposition |
|---|---|
| 1. `probe.rs:108` names `launch.sh` | **Fixed, comment only:** `probe.rs:108-111` now names `launch-7.sh` (and says the five earlier scripts name the same root). `diff /private/tmp/2d7-4-2-probe.rs.before src-tauri/src/probe.rs` shows only those lines; `cargo fmt --check` exits 0 |
| 2. The page side of `--- script-*` | **Done:** `scriptWrite` / `scriptBurst` print the request lines. Completion is read from the witness, as a change to the target's inode, `ctime` or hash (a same-bytes rename still moves the inode). A burst then holds 1.0 s (fast) or 1.6 s (slow) for its schedule. `--- script-seen` prints the before and after identity. `writers.log` stays the record of what was written |
| 3. Snapshot-token attribution under an unasked keep-alive | **Done:** §1.6 and §1.7 |
| 4. Keep-alive ran unasked | **Done:** §1.6 |
| 5. No `--- beat` | **Done:** §1.5; `launch-7.sh` now also prints `beats=` |
| 6. Launches stage `launch-10.sh`'s set | **Narrowed:** `launch-7.sh launch … --conflict <fixture>` stages any manifest fixture as `match/conflict.yml` (§2). The probe writers' `ECFG_PROBE_R*` set is unchanged. See §8 item 1 for what 2d-7-7 still lacks |
| 7. Checklist item 13 reads `post-input.swift` | §4 item 13 |
| 8. Per-launch WebKit data; `~/Library/{WebKit,Caches}/espansoconfig` | **Reported, not deleted.** Both directories are dated 2026-07-31 08:07 (`ls -ldT`), which is before 2d-7. The lower-case name is the executable's, which fits an unbundled run of `target/debug/espansoconfig`. Their origin was not established. They belong to entry 32's "checked and reported" list. This step added `~/Library/{WebKit,Caches}/cc.carpio.espansoConfig.probe.K2-*`, already covered by entry 32's pattern |
| 9. `COPY_CASES` must follow the page | **Checked:** `rg -n copyDraft src/probe.ts` has one hit, in `externalEditorPlan`, so `COPY_CASES=" external-editor "` still matches |

### 1.11 Cases added

- **The shakedown controls:**
  - `shake-agreement`: open, viewer (`document_text`), checkpoint after each;
  - `shake-spy`: one script write, then its drain;
  - `shake-identical`: the staged file's own bytes renamed over it;
  - `shake-overlap`: a second snapshot request issued in the same task as the shot's own.
- **G1 plans for 2d-7-5:** `burst-fast`, `burst-slow` and `both-roots`, each with checkpoints and
  spans.

2d-7-5 is records-only over a frozen instrument, so a plan it needs has to exist now. Each G1 plan was
run once (§3.3); none of those runs is a reading.

---

## 2. What changed in `launch-7.sh` (harness root)

- **`launch none <name>`**, the no-plan control: the same launch with no `ECFG_PROBE_PLAN`, killed
  after `NOPLAN_POLLS` (100 × 0.1 s). Its page drives nothing, so **it is the one launch whose
  language is not set through the picker**, and the header says so.
- **`:keepalive`** is accepted after the language (`^[a-z0-9-]+:(en|es)(:keepalive)?$`).
- **`--conflict <fixture>`** stages a manifest fixture as `match/conflict.yml` in place of `R0`.
  `--config` and `--conflict` may each be given once, in either order.
- **Summary lines:**
  - `beats=` and `probe.log-bytes=`;
  - `instrument-line=` and `spy-line=`;
  - `reconcile-lines= void-lines=`.
  `last-beat=` now matches `^--- beat ` only.
- **Fix:** `open ${plan_env[@]+"${plan_env[@]}"}`, because bash 3.2 under `set -u` treats an empty
  array as unbound (§6 item 1).

`bash -n launch-7.sh` exits 0.

---

## 3. Evidence: the five shakedown controls (consult Q2 item 11)

**The screen was locked for every launch in this step.** `./launch-7.sh preflight` at 09:30:33,
09:43:20 and at every launch read:
```
lock=locked rule=primary-locked primary="locked source=CGSessionCopyCurrentDictionary CGSSessionScreenIsLocked=1 …" cross-check=…CGSSessionScreenIsLocked=true
```
So every capture is the WebKit page snapshot (`used=webview reason=screen-locked(primary-locked)`),
and no visual claim is made. Plan launches use `:keepalive`, which is permitted in a hidden launch
and disclosed there (entry 18). `K2-27` ran without it.

**The bytes the review read** (superseded by the fix round; §9.6 re-runs the controls on the final bytes):
- `src/probe.ts` `212f8939…f9b2`;
- binary `69f4d955f9a6c50969a3cbf3d5b67d06c07607291494106c0e27393a3a1c5a00`, built with `npm run build`
  then `cargo build -p espansoconfig --features custom-protocol`, and recorded in each launch's
  `binary.sha256`;
- `launch-7.sh` `bf8778d0…eaf3`.

Each launch got its own identifier `cc.carpio.espansoConfig.probe.<name>`, which `lsappinfo` read
back, and its own bundle path `launches/<name>/espansoConfig.app`.

### 3.1 No-plan control — `K2-20` (`launch none K2-20`)

```
reached-terminal=no alive-at-kill=yes          # expected: no plan, no terminal line
language-line=absent   beats=0   probe.log-bytes=0   probe.err-bytes=0
instrument-line=absent spy-line=absent reconcile-lines=0 void-lines=0
clipboard copies=no before=[changeCount=214 …] after=[changeCount=214 …]
running pid=76759 lsappinfo-bundle-id=cc.carpio.espansoConfig.probe.K2-20
$ diff -rq launches/K2-20/xdg-before launches/K2-20/xdg   → no output (tree identical); home-files=0
```
**An empty transcript from a live process, and an unchanged tree.** "Zero tallies" is **not read**.
Rust's tallies are answered only to a page that asks, and a page that asks has written a transcript.
The app's own dispatches (`open_workspace`, …) are not zero in any launch anyway (§6 item 2).

### 3.2 Agreement control — `K2-21` (`shake-agreement:en:keepalive`)

```
--- instrument ok probe-commands=14 page=14
--- reconcile start commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1] probe-half=ok events=none-emitted(spy=installed) emitted=0 delivered=0
--- recorder-ordering first-checkpoint=start rust-surplus=[] verdict=ok
--- tally agree-viewer rust-app=[document_text×1 · drain_external_changes×1 · get_document×3 · list_documents×1 · open_workspace×1 · set_menu_labels×1] rust-writes=0 …
--- tally agree-viewer page=[document_text×1 · drain_external_changes×1 · get_document×3 · list_documents×1 · open_workspace×1 · plugin:event|listen×1 · set_menu_labels×1] not-issued=[] delivered=0 spy=installed
--- reconcile agree-viewer commands=equal(except-plugin:event) rust-surplus=[] page-surplus=[plugin:event|listen+1] probe-half=ok …
--- span agree-open→agree-viewer writes=0 write-commands=[] emitted+=0 delivered+=0 witness=unchanged(except none) …
--- reconcile end commands=equal(except-plugin:event) … ; --- span start→end writes=0 … witness=unchanged(except none)
```
The two tallies are equal by name at all four checkpoints, apart from the one allowed
`plugin:event|listen`. **Four witnesses (`probe_witness`, each hashing every file) caused no wake**
(`emitted=0` throughout). That answers 2d-7-3 §6 item 6 for this host and these reads.

### 3.3 Spy control — `K2-22` (`shake-spy:en:keepalive`)

```
--- spy installed handler=3131652793 body={"event":"workspace://reconciliation-ready","target":{"kind":"Any"},"handler":3131652793} t=5ms
--- tally start … wakes-installed=2 first-installed-us=… emitted=0
--- script-write w1-1575 match/conflict.yml hard-alpha-changed-r1.yml replace
--- script-seen w1-1575 target=match/conflict.yml first-change=209ms ino=404884619→404884737 size=825→836 sha=a569b4d9426631b0→0b6c6dfd8a2c1a05
--- delivered n=1 handler=3131652793 eventId=0 payload={"workspace_epoch":1,"newest_sequence":1} t=2025ms
--- spy-drain #9 afterSequence=0 observations=1
--- reconcile spy-after commands=equal(except-plugin:event) … events=observed emitted=1 delivered=1
--- span spy-before→spy-after writes=0 write-commands=[] emitted+=1 delivered+=1 witness=unchanged(except xdg/espanso/match/conflict.yml:as-written=yes) … changed=[xdg/espanso/match/conflict.yml]
launch.txt: writer id=w1-1575 … done status=0 final-sha256=0b6c6dfd…90db ; script-writer w1-1575 exit=0
```
**One external write gave one emit and one delivery.** The counting emitter was installed by page-load
callbacks (`wakes-installed=2`) before the `start` checkpoint. The spy was installed before the
listener's registration was issued. **Emitted = delivered cannot tell which of the two came first**
(entry 13); the line says both counted the same wake.

### 3.4 Identical-bytes control — `K2-23` (`shake-identical:en:keepalive`)

```
--- script-write w1-1548 match/conflict.yml hard-r0.yml replace          # hard-r0 is the staged file's own fixture
--- script-seen w1-1548 target=match/conflict.yml first-change=204ms ino=404884891→404885005 size=825→825 sha=a569b4d9426631b0→a569b4d9426631b0
--- span ident-before→ident-after writes=0 write-commands=[] emitted+=0 delivered+=0 witness=unchanged(except xdg/espanso/match/conflict.yml:as-written=yes) identical=[xdg/espanso/match/conflict.yml] transient=[] changed=[] added=[] removed=[]
```
The witness classes the rename as **`identical`** (a new inode, the same size and the same hash), not
as `unchanged`. **It separates "identical write" from "no write."** The application emitted no wake for
it, which is written down as an application fact and not claimed further.

### 3.5 Forced snapshot overlap — `K2-24` (`shake-overlap:en:keepalive`)

```
--- shot overlap t=1586ms
--- overlap-sample both-pending=no first=[other=written#2 latest=pending#3 · other=written#2 latest=written#3]
--- shot-done overlap webview=written#3 awaited=#3 t=4192ms
--- overlap other=requested#2 other-final=written#2 t=4195ms
capture overlap used=webview reason=screen-locked(primary-locked) file=shots/overlap-webview.png
$ ls launches/K2-24/shots → keepalive-webview.png  overlap-other-webview.png  overlap-webview.png
```
The other request (#2) was issued in the same task as the shot's own, just before it. **The shot
printed the token it waited for (`awaited=#3`) and reported only that token's `written#3`.** The
other request wrote its own file. **An overlap in time was not forced.** The first sample shows #2
already written while #3 was still pending, and the development launches `K2-05`, `K2-06` and `K2-07`
tried harder, `K2-07` with seven more requests queued ahead of it. None held two requests pending at
once. What this control shows is **attribution by token**, not a timing collision (§6 item 3).

### 3.6 Further launches on the final bytes (not controls)

| Launch | Plan | What it shows |
|---|---|---|
| `K2-25` | `status-uncertain-editor:en:keepalive` | **Field naming:** `--- sourcetext ue-panel boxes=7 [field:Trigger · field:Replacement text · field:Label · field:Whole word · field:Boundary on the left · field:Boundary on the right · file]`, and `--- disk ue-panel` is now the whole file, where 9c's artifact read `":beta"`. **`mayHaveWritten` runs the real save:** `--- substituted #10 save_match real=ok {"outcome":"saved",…} -> error saveFailed may_have_written=true`, and `--- span start→end writes=1 write-commands=[save_match]` |
| `K2-26` | `status-removed:es:keepalive` | The language is set through the picker (`--- language picked=es`). `probe_remove_other` appears only in Rust's probe tally and on the plan's own `--- writer` line, never as an `--- ipc` record (2d-7-4-1's `S7-L02` recorded it as one). `events=observed emitted=1 delivered=1`. `shot-done rm-removed webview=written#3 awaited=#3` |
| `K2-27` | `lifecycle-delivery:en` (no keep-alive) | `keepalive=off`, `beats=5`, the terminal line reached, `events=observed emitted=1 delivered=1` |
| `K2-28` | `burst-fast:en:keepalive` | 3 writes at +0/+60/+120 ms (`writers.log`); `emitted+=1 delivered+=1` |
| `K2-29` | `burst-slow:en:keepalive` | 2 writes at +0/+600 ms; `emitted+=2 delivered+=2` |
| `K2-30` | `both-roots:en:keepalive` | `config/default.yml` then `match/conflict.yml`; one emit and one delivery each; both files `as-written=yes` |

Every launch in §3 reached its terminal line (except `K2-20`, by design) with `failed-lines=0`,
`mismatch-lines=0`, `void-lines=0`, and the clipboard change count unchanged at 214. The G1 rows in
the table are **not readings**; they are 2d-7-5's to read.

---

## 4. The entry-7 checklist

Every item has its command and its observed output. Launch transcripts are under
`/private/tmp/espansoconfig-harness-2d-6-6c-2/launches/<name>/probe.log`.

| # | Item | Command | Observed |
|---|---|---|---|
| 1 | Command parity is a test | `cargo test --workspace -- --test-threads=1 > /private/tmp/2d7-4-2-cargo-test.log`; `rg -n "command_parity\|write_commands_are_registered" …` | `test probe::tests::command_parity ... ok`, `test probe::tests::write_commands_are_registered ... ok`. Shown failing once in 2d-7-3 §3 |
| 2 | One list of probe commands | `sed -n '/^const PROBE_OWN_COMMANDS/,/^\]);/p' src/probe.ts \| rg -c "'"`; any launch | `14`; `--- instrument ok probe-commands=14 page=14` in every plan launch (K2-21 … K2-30) |
| 3 | Header and comments tell the truth | `rg -n "Eight\|four probe\|eight commands" src-tauri/src/probe.rs src/probe.ts`; `rg -n '"second" or "third"' src-tauri/src/probe.rs` | no output (exit 1) for both |
| 4 | Confinement words unchanged; fifth and sixth disclosed | Python: extract `//! **What those rules force` … `none of which is offered as one.` from `/private/tmp/2d7-3-probe.rs.orig` and from `probe.rs`, compare | `orig-lines 14 now-lines 14 identical`. The fifth and sixth are in their own paragraph (2d-7-3 §2), never folded into "four" |
| 5 | Snapshot attribution by token | K2-24 | `--- shot-done overlap webview=written#3 awaited=#3`; the other request `written#2`; time overlap not forced (§3.5) |
| 6 | Substitutions print; no rejected `fetch`; `mayHaveWritten` commits first | `rg -n -- "--- substituted" src/probe.ts`; `rg -n "Promise.reject\|reject\(" src/probe.ts`; K2-25 | six print sites covering the five kinds (listenRefused, epochZero, discardOnce, mayHaveWritten, and delay's held and released lines); no rejected-promise answer; K2-25 `real=ok {"outcome":"saved",…"committed":true…}` then `writes=1 write-commands=[save_match]` |
| 7 | The plan-wait disclosed | any launch | `--- plan-wait #2 plugin:event|listen held=4ms` (3–7 ms across K2-21 … K2-30) |
| 8 | `pause`, `hold`, keep-alive are policy | `rg -n "PAUSE_TRIP_LIMIT = " src/probe.ts`; K2-27 against the rest | `PAUSE_TRIP_LIMIT = 400` unchanged; `--- plan … keepalive=off` (K2-27) and `keepalive=on` only where `:keepalive` was passed. Rust's probe tally shows the cost: `probe_plan×26777` by K2-21's `end` checkpoint at 7.2 s (§6 item 4) |
| 9 | Heartbeat | `launch-7.sh` summary | `beats=5`…`16`, e.g. K2-21 `last-beat=--- beat n=7 t=7065ms visibility=hidden focus=no` |
| 10 | The harness | `rg -n screencapture launch-7.sh`; ledger; `./launch-7.sh verify` | Two lines: the `:50` header comment and one call, `:482 screencapture -x -o -l "$id" …`. Each K2 name has its own `cc.carpio.espansoConfig.probe.K2-*` in `launches-7.ledger` and in `lsappinfo`. `verify` exits 0 with 40 `ok` and no `REFUSED`. Writers and bursts: §3.3, §3.4, §3.6 |
| 11 | Five shakedown controls | §3.1 … §3.5 | as shown |
| 12 | Recorder ordering | every plan launch | `--- recorder-ordering first-checkpoint=start rust-surplus=[] verdict=ok` (K2-21 … K2-30) |
| 13 | The input tool | `rg -n "postToPid\|CGEvent\(" tools/post-input.swift`; `tools/post-input --pid 999999 --window 999999 --dry-run click 10 10` | `:334 event.postToPid(pid)`, the only post; the events are built at `:264-280`. Dry run: `result=refused: the screen is locked`, exit 10. Never run against a real window |
| 14 | Pre-step copies and hashes | `shasum -a 256 /private/tmp/2d7-3-probe.rs.orig /private/tmp/2d7-4-probe.ts.orig` | `d2f6681d…0942` and `cba6c61a…22b7`, equal to 2d-7-3 notes §0 and 2d-7-4-1 notes §0; §0 above |

---

## 5. Gates, baselines and hashes

### 5.1 Gates (instrument present)

Output was redirected to `/private/tmp/2d7-4-2-*.log`, and exit statuses were read from the tool.

| Command | Exit | Figure |
|---|---|---|
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | `2d7-4-2-clippy.log` |
| `cargo test --workspace -- --test-threads=1` | 0 | **1330 passed**, 0 failed (`2d7-4-2-cargo-test.log`, summed `test result:` lines) |
| `npm run check` | 0 | `462 FILES 0 ERRORS 0 WARNINGS` |
| `npm test` | 0 | `72` files, **3547** tests |
| `npm run build` | 0 | **201** modules |
| server-only oracle `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | absent |
| client-only oracle `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2` (`index-Da57ZTJz.js`) |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `2 files changed, 5 insertions(+), 1 deletion(-)` |
| `git status --short --untracked-files=all` | 0 | `PROGRESS.json`, `main.rs`, `main.ts` modified; `probe.rs`, `probe.ts` untracked (plus this file and the brief once written). No real-config path |
| safety `rg` on `probe.rs` (code lines) | 1 | nothing |
| `rg -c "\.setup\(" src-tauri/src/probe.rs` | 1 | nothing |

The Rust gates ran after the `probe.rs` comment change, and no Rust changed afterwards. The TS gates
ran on the final `probe.ts`.

### 5.2 Baselines (entry 5)

The pristine copy is `git archive HEAD` (`88caa96`) extracted to `/private/tmp/2d7-4-2-pristine`,
with `node_modules` symlinked and `CARGO_TARGET_DIR=/private/tmp/2d7-4-2-pristine-target`.

| Figure | Pristine `HEAD` | Instrument present | Instrument share |
|---|---|---|---|
| Rust tests | **1323** | **1330** | 7: the `probe::tests` of 2d-7-3 |
| `svelte-check` files | **461** | **462** | 1: `src/probe.ts` |
| vitest tests | **3546** | **3547** | 1: `scripts/lint/ipc-detail.test.ts` › "src/probe.ts does not name the developer-string accessor", found by diffing the two JSON reports |
| Vite modules | **200** | **201** | 1: `src/probe.ts` |

Rung **`1330 / 462 / 3547 / 201`**, unchanged from 2d-7-4-1, because this step added no module and no test.

### 5.3 SHA-256 of the instrument (entry 3)

**These are the final bytes, after the review fixes (§9).** The §3 launches ran on the pre-fix
`probe.ts` `212f8939…f9b2` and `launch-7.sh` `bf8778d0…eaf3`, which were the bytes the review read. The
§9.6 launches re-ran every control and each retained plan on the final bytes.

| Path | SHA-256 |
|---|---|
| `src-tauri/src/main.rs` | `b3836a284d2c240bc8938e723e2540c5f1b1903067a5e7bcb7a7aba0eb47c3e5` |
| `src/main.ts` | `215f8507230ebce006d45105515efa046aa9b671c5afff5316ae0fd425dd8615` |
| `src-tauri/src/probe.rs` | `c65d1cb50ca10705c1cfd06d67a942e914b9ff472908fb4c7c1e0b57306d9688` |
| `src/probe.ts` | `22661785710f9ae42cf58a8f76cfec2f96f614b0b7a77bca827a7eed50314d3e` |
| `launch-7.sh` | `5d5f6397cae5a96869c2c813dc6449e0f8bd1576bf38a8ae4fc7b342eb0e82ec` |
| `fixtures-7.manifest` | `73840ba8a59a7c87953abda733b2118d7668edc37d7444ffbfd3bc98693d30e5` |
| `tools/lockstate` | `8d063b0dde57062060a79de43838a72c309a7cec219d83a1f1f00d434d11f626` |
| `tools/lockstate.swift` | `b97e8a4f2063c77c84f2f24bb141c893fe2cd8fa263cd90105c16d73be1ddf65` |
| `tools/pbstate` | `5c92bddf29d1b7ce3b6dd6922f67f9fc8983694ea7d1a099650b4d8866e2597f` |
| `tools/pbstate.swift` | `eead41c0141667af6e2c8df4e79a5d0eca211dbcc77728acfe9c7643a9528d25` |
| `tools/post-input` | `d92667c91f94101c0c43602ad4db8b4deeb6531febd7c0a2d8f1e416b653caba` |
| `tools/post-input.swift` | `c2858a4b6256bac56156cfb6f37cf879344a06bd9b7267c9fa441f4412eedd18` |
| `tools/verbatim-7c.cjs` | `92169e47288190ba4175ca8e4146921510cc7359db00f072bb3dc47e8e48d927` |
| `tools/verbatim-8c.cjs` | `330a58d4874897921a965c8e3d47b9732488844496900205dc783f5377f3bb30` |
| `tools/verbatim-9c.cjs` | `36fe24f0d758ac8e633ff76d1a73753aaac0be8fa2f28adf1f9ab006538c8d5e` |
| `tools/verbatim.cjs` | `d9a8131e1bed474a82fbefb95ce666cade9e312c156e7f9f2155ffb6a081fd25` |
| `tools/winid` | `5d066422c58e4402cc9aa72205958ea76e94367f1349e8e961732d2e8458ea24` |
| `tools/winid.swift` | `49cdd1880bdda5a7225bff012f5cab9bd738b3e5239341eaa3b3666fcba89c5f` |

The instrumented binary the §9.6 launches ran is `53d84fb2f2060d03db217cd5381dbaceb884fa1fc236c99b6ce481e0adaa510b`
(§3's was `69f4d955…5a00`). It is not reproducible across
toolchains; the sources are what a review reads.

### 5.4 The reviewed-set copy

`/private/tmp/2d7-instrument-reviewed/` holds three things:
- `repo/src-tauri/src/{main.rs,probe.rs}` and `repo/src/{main.ts,probe.ts}`;
- `harness/launch-7.sh`, `harness/fixtures-7.manifest` and `harness/tools/*`;
- `SHA256SUMS`, the table above.

`shasum -a 256 -c` against the live paths printed `OK` for all four repo files and all 14 harness files.

**Entry 6 says the reviewed set is written only when 2d-7-4 closes, after the last fix.** The set was
re-copied after the review fixes (§9). `shasum -a 256 -c` against the live paths printed 18 `OK`,
so it holds the final bytes of §5.3.

---

## 6. Deviations

1. **`K2-10` is a spent name.** The first no-plan launch failed inside `launch-7.sh` (`plan_env[@]:
   unbound variable`, bash 3.2 with `set -u`) after the name was reserved and before `open`, so no
   app ran. The one-line fix is §2; the control was re-run as `K2-17` and, on the final bytes, `K2-20`.
2. **The no-plan control's "zero tallies" is not read** (§3.1). What it shows is an empty transcript
   from a live process, an unchanged tree, and an untouched clipboard. The page is the only reader of
   `probe_tally`, and reading it would be a plan.
3. **The forced snapshot overlap is attribution, not a timing overlap** (§3.5). Three development
   launches tried to hold two requests pending at once and none did.
4. **The page is busy by policy.** Heartbeat, keep-alive and every wait spend their time in
   `probe_plan` round trips. Rust counted 26 777 of them by K2-21's `end` checkpoint at 7.2 s,
   roughly 3 700 a second. That is the consult's "policy, not default" (item 8), now visible in the probe
   tally. It is not changed here, and a reading that makes a timing claim cites it.
5. **Cases added beyond the *Delivers* list** (§1.11). The four shakedown cases are the controls
   themselves. The three G1 plans were added because 2d-7-5 cannot add code to a frozen instrument.
   Each ran once (§3.6) and is part of this review's subject.
6. **Development launches** on intermediate builds: `K2-01` … `K2-07`, `K2-S1` … `K2-S3`, `K2-11` …
   `K2-18`. They are not evidence. §3 cites only `K2-20` … `K2-30`, all on binary `69f4d955…`.
   The ledger keeps every name.
7. **`launch-7.sh` changed in this step** (§2), although 2d-7-4-1 built it. This step delivers the
   page side of its protocol, and the no-plan control, the flag and `--conflict` needed script
   support. The whole script is in this review's subject.
8. **Scratch outside the harness:**
   - `/private/tmp/2d7-4-2-*.log`, `*.summary`, `*-final-transcripts.txt`, `*-vt-*.json`;
   - `/private/tmp/2d7-4-2-pristine{,-target}`;
   - `/private/tmp/2d7-4-2-probe.rs.before` and `/private/tmp/2d7-4-2-launch-7.sh.before`.
   None of it is instrument. It belongs on 2d-8's list beside entry 32's copies.

---

## 7. What this does not prove

- A clean reconciliation proves that the recorder, Rust's handler and the spy counted the same
  things **in these launches**. It does not prove that no command can cross another way.
- The spy holds for `tauri` 2.11.5 and `@tauri-apps/api` 2.11.1 only (entry 14).
- The witness is a moment (entry 12). It sees only `<launch>/xdg` and `<launch>/home`. WebKit's data
  lives in the real `~/Library` and is outside it.
- The script-writer wait learns *that* the target changed, not that the script finished. For a burst,
  a fixed hold stands in for the end. `writers.log` is the record.
- The field-naming selector reads today's markup. A component change can re-name a box as `file`
  without failing anything.
- No window was seen. The screen was locked throughout, so no `used=window` capture exists and no
  visual claim is made.
- The prune does not show that what remains is correct (entry 1).

---

## 8. Open items for 2d-7-5 (and for the orchestrator)

1. **Plan coverage of the later steps was not inventoried.** 2d-7-5 … 2d-7-8 are records-only over
   the frozen instrument, so a G row with no plan can only be named unread. These rows are known
   uncovered:
   - **G1**, both with no plan today:
     - self-save suppression, one unsubstituted `save_match` with a span;
     - workspace reopen with a late old callback under `delay`.
   - **2d-7-7**, which needs three things:
     - a plan that shows `conflict.yml` in the viewer and then asks for a script write of a
       successor. `--conflict` can stage each of the fifteen, but the page cannot learn a
       successor's name;
     - the successor fixtures themselves (byte-level edits, imported through the manifest);
     - four hashes per fixture.

   G2, G3 and G4 were not checked row by row. Under entry 6, work the review holds as a blocker stays
   inside 2d-7-4.
2. **Status plans need `:keepalive` stated** in a hidden window (§1.6). 2d-7-8's launches must pass
   it and disclose it.
3. **The launch-wide `start→end` span marks probe-writer changes as `CHANGED`** (§1.3). A reading
   that uses probe writers cites the per-writer spans or the probe's `--- writer` lines.
4. **Emitted > delivered at a checkpoint can be a delivery still in flight.** Spans wait for a quiet
   transport and 2 s. A bare checkpoint does not, and its `application-fact` class is not a finding
   on its own.
5. **Checkpoints need a still transport.** A plan that keeps a command permanently in flight makes
   `checkpoint` time out (`IPC_QUIET_LIMIT`) and the launch ends `--- failed`.
6. **Carried unchanged:** 2d-7-3 §6's 2d-7-10 items (the fifth rebinding's directory-above residue,
   the sixth as disclosed); 2d-7-4-1 §8 item 8's `espansoconfig` directories, reported only.
7. **SHOULD-FIX 5 of the instrument review, recorded rather than fixed** (§9.5). The retained
   external and status plans get only the launch-wide `start`/`end` checkpoints. Their probe writers
   take no witness right after they return, and no per-action checkpoints exist. So entry 16's
   per-path `writes=0 witness=unchanged(except …)` line is not available for their no-write paths.
   Before 2d-7-5 … 2d-7-8 rely on those plans, the needed rows must be inventoried (item 1), and the
   following must be added inside 2d-7-4, or the rows named unread:
   - action-boundary checkpoints;
   - an immediate witness after each probe writer.
8. **Noticed during the fix round:**
   - `external-recovery` now stages `launch.sh`'s plain set (`base-r0.yml` with `beta-removed-r1.yml`
     as the second writer), because its plan needs `:beta` removed. Its reading therefore runs on a
     different fixture shape from the hard-set cases.
   - `external-deleter`, `-mover` and `-duplicator` once took a set argument in `launch-7c.sh`
     (`plain`, `hard`, `hardcrlf`). They now always get the hard set, and a `hardcrlf` reading of
     those three is not reachable without `--conflict` plus matching writer fixtures.

---

## 9. Review fixes

The review (`docs/reviews/phase-2d-7-4-2.md`, Codex) returned `ship-with-fixes` with **2 BLOCKERS
and 3 SHOULD-FIX**. Each finding was re-derived before it was fixed. The fixes changed only
`src/probe.ts` and `launch-7.sh`, plus these records. Pre-fix copies are
`/private/tmp/2d7-4-2-probe.ts.prefix` and `/private/tmp/2d7-4-2-launch-7.sh.prefix`:
- `probe.ts`: `157 insertions(+), 42 deletions(-)`;
- `launch-7.sh`: `43 insertions(+), 6 deletions(-)`.

The deterministic checks run the **real function sources**. `/private/tmp/2d7-4-2-fixcheck/build.mjs`
cuts `classifyCommands`, `witnessGaps` and `compareWitness` out of `src/probe.ts`, appends `cases.ts`,
and runs the result with Node 26's type stripping. The output is in `output.txt`, and is quoted below.

### 9.1 BLOCKER 1 — a failed `fetch` can hide an unrecorded fallback dispatch (`probe.ts`, the reconciliation)

**Re-derivation: holds.** Tauri's pinned `scripts/ipc-protocol.js` catches a rejected `fetch` and
calls `sendIpcMessage(message)` again with `customProtocolIpcFailed = true`, which is the
`postMessage` path the recorder never sees. The recording `fetch` files the failed attempt as a
`transport-failed` record. The pre-fix `pageCounts` counted it, and the pre-fix classification had no
other rule. So a `fetch` that failed before Rust dispatched it gives Rust 1 and page 1, and the check
reads `equal`:

```
B1 pre-fix rule (no broken list, as the pre-fix inline code): equal
B1 fixed: VOID(transport-broken[#7:save_match:transport-failed])
```

(The "pre-fix rule" is `classifyCommands` with an empty broken list, which is the pre-fix inline
code moved into a function unchanged apart from the new first branch.)

**Fix.** The classification is now the pure `classifyCommands()`. Any record whose outcome is
`transport-failed` or `unreadable` makes `commands=VOID(transport-broken[#seq:cmd:outcome …])`,
whatever the counts say. Records are never removed, so the void stays for every later checkpoint of
the launch. The doc comment gives the Tauri mechanism.

### 9.2 BLOCKER 2 — the harness cannot run several retained plans (`launch-7.sh`)

**Re-derivation: holds.** The pre-fix script (`bf8778d0…`) was run on fresh bundle paths, on the
same binary as §3:

```
K2-40 external-restore:en:keepalive  → --- failed timed out waiting for the restore pane's options list 0   (no backup batch)
K2-41 external-raw-cr:en:keepalive   → --- failed timed out waiting for the raw external panel after the switch   (LF successor; the plan needs the CR one)
K2-42 raw-open-crlf:en:keepalive     → --- sentence crlf-viewer expect=present drawn=no MISMATCH browser.rawEditor.lineEndingsNotPreserved ; conflict.yml=a569b4d9… (hard-r0, LF)
```

**Fix.**
- `select_fixtures()` restores `launch-8c.sh`'s per-case map:
  - `external-raw-cr` gets the `hardcr` successor;
  - `raw-open-crlf` gets the `hardcrlf` set;
  - `external-restore`, `external-restore-drop` and `restore-save-race` get
    `CAND=hard-candidate.yml`;
  - `external-restore-cr` gets the `hardcrlf` set with `CAND=hardcrlf-candidate.yml`;
  - `external-recovery` gets `launch.sh`'s `base-r0` / `beta-removed-r1`.
- `--conflict` still overrides R0 afterwards.
- `build_tree` verifies every chosen fixture, `CAND` included, against the manifest before it
  reserves the name.
- It then seeds `xdg/espanso/.espansoconfig-backups/2026-09-23T000000Z/match/conflict.yml` from
  `CAND`, re-hashed through `stage_fixture`, with the batch marker and `chmod -R go-rwx`, **before**
  `xdg-before` is copied. The seed therefore never appears in the tree diff. `fixtures.txt` records
  `seeded batch=… candidate=… sha256=…`, and `launch.txt`'s `plan=` line records `cand=`.

Every plan the finding named, and the other retained plans the map touches, ran on the final bytes
(§9.6):
- `K2-55` `external-restore`, `K2-56` `external-restore-cr`, `K2-57` `external-restore-drop` and
  `K2-58` `restore-save-race`, each with the seeded batch;
- `K2-59` `external-raw-cr`, `K2-60` `raw-open-crlf:es` and `K2-61` `external-recovery`.

All seven reached `--- end` with 0 failed, 0 MISMATCH and 0 VOID lines. For example:
- K2-55 `fixtures.txt`: `seeded batch=2026-09-23T000000Z candidate=hard-candidate.yml sha256=61266e29…`.
  Its tree diff shows only the app's own new batch `2026-09-23T090706Z` and the restored
  `conflict.yml`.
- K2-60: `conflict.yml=02f0ab57…`, which is `hardcrlf-r0.yml`, and
  `--- sentence crlf-viewer expect=present drawn=yes ok browser.rawEditor.lineEndingsNotPreserved`.

### 9.3 SHOULD-FIX 3 — incomplete witnesses can certify an unchanged tree (`probe.ts`, `readWitness`)

**Re-derivation: holds.** The pre-fix `readWitness` kept only `entries`. It dropped
`roots[].state` and the `unlisted` diagnostics, and it only printed `truncated`. Two witnesses whose
`xdg` root was `not walked` both give an empty map, and `compareWitness` over two empty maps
classifies nothing, so the span printed `witness=unchanged`:

```
SF3 pre-fix: compareWitness over two empty maps -> {"unchanged":[],"identical":[],"transient":[],"changed":[],"added":[],"removed":[]} (the pre-fix span printed witness=unchanged)
SF3 fixed gaps: ["root:xdg:not walked: ELOOP"]
SF3 fixed gaps, unlisted + truncated: ["unlisted:xdg/espanso","truncated"]
SF3 complete witness gaps: []
```

**Fix, local to `probe.ts`.**
- A witness is now `{ entries, gaps }`, and the pure `witnessGaps()` lists the four kinds of gap:
  - every root not walked, or no roots reported at all;
  - every `unlisted` entry;
  - every `vanished` entry;
  - `truncated`.
- `readWitness` prints `--- witness … INCOMPLETE gaps=[…]`, and each checkpoint's witness line
  carries `complete=yes|NO`.
- `reportSpan` prints `witness=UNREAD(incomplete …)` when either side has a gap, never `unchanged`.

Every §9.6 launch printed `complete=yes`.

### 9.4 SHOULD-FIX 4 — a delivery during the tally read can void a launch (`probe.ts`, `readTallyQuietly`)

**Re-derivation: holds, by the sampling order.** Rust copies `emitted` when it handles `probe_tally`.
The pre-fix code read `spyDeliveries` after the answer arrived. A wake emitted after Rust's copy and
delivered before the answer is read therefore gives `delivered > emitted`, which is
`VOID(delivered>emitted)`. The retry guard looked only at command activity. No launch showed this;
the modelled order (`cases.ts`, which fakes `invoke` with exactly that interleaving) reproduces it:

```
SF4 pre-fix order: emitted 0 delivered 1 -> VOID(delivered>emitted)
SF4 fixed order: attempt 2 emitted 1 delivered 1
```

**Fix, local to `probe.ts`.** `readTallyQuietly` samples `spyDeliveries` before the request. It
retries unless the counter is unchanged after the answer, alongside the command guards, and returns
the pre-request value.

### 9.5 SHOULD-FIX 5 — retained plans lack per-path no-write evidence

**Not implemented, as the orchestrator directed.** It is recorded as open item §8 item 7 for 2d-7-5.
It holds as described: only `startProbe`'s `start`/`end` checkpoints surround a retained plan
(`K2-55`'s `start→end` span reads `CHANGED(except none)`, because it cannot separate its probe
writers' changes).

### 9.6 Re-run on the final bytes

Binary `53d84fb2…510b`, `probe.ts` `22661785…4d3e`, `launch-7.sh` `5d5f6397…82ec`, and each launch on a
fresh bundle path. The screen was still locked (`preflight lock=locked … at=10:05:54`).

| Launch | Plan | Result |
|---|---|---|
| `K2-50` | `none` | `probe.log-bytes=0`, `reached-terminal=no alive-at-kill=yes`, `beats=0` |
| `K2-51` | `shake-agreement:en:keepalive` | `reconcile end commands=equal(except-plugin:event)`; span `witness=unchanged(except none)`; `complete=yes` |
| `K2-52` | `shake-spy:en:keepalive` | `events=observed emitted=1 delivered=1`; `emitted+=1 delivered+=1`; `conflict.yml:as-written=yes` |
| `K2-53` | `shake-identical:en:keepalive` | `identical=[xdg/espanso/match/conflict.yml]`, `emitted+=0` |
| `K2-54` | `shake-overlap:en:keepalive` | `shot-done overlap webview=written#3 awaited=#3`; other `written#2`; `both-pending=no` |
| `K2-55` … `K2-61` | the seven retained plans of §9.2 | all terminal, 0 failed, 0 MISMATCH, 0 VOID |
| `K2-62` | `status-uncertain-editor:en:keepalive` | field naming unchanged (`[field:Trigger · … · file]`); `writes=1 write-commands=[save_match]` |

In every plan launch the lines `--- instrument ok probe-commands=14 page=14` and
`--- recorder-ordering … verdict=ok` are present.

### 9.7 Gates after the fixes (instrument present)

| Command | Exit | Figure |
|---|---|---|
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings` (to `/private/tmp/2d7-4-2-fix-clippy.log`) | 0 | — |
| `cargo test --workspace -- --test-threads=1` (to `/private/tmp/2d7-4-2-fix-cargo-test.log`) | 0 | **1330** passed, 0 failed |
| `npm run check` | 0 | **462** files, 0 errors, 0 warnings |
| `npm test` | 0 | 72 files, **3547** tests |
| `npm run build` | 0 | **201** modules |
| server-only oracle | 1 | absent |
| client-only oracle | 0 | `2` |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |
| `git status --short --untracked-files=all` | 0 | the four instrument paths, `PROGRESS.json`, the notes, the brief and the review. No real-config path |

The rung is unchanged at **`1330 / 462 / 3547 / 201`**. The pristine figures of §5.2 still hold,
because no tracked file changed and no module or test was added.
