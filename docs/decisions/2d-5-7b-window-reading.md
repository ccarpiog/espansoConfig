# Phase 2d-5-7b — the harness rebuild and the narrow window lifecycle reading

**Date:** 2026-09-21
**Phase:** 2d-5-7b, the second half of the split `docs/decisions/2d-5-split-notes.md` §2 made of
2d-5-7 on 2026-09-21. 2d-5-7a is closed; this phase is the reading it left owing
(`2d-5-7a-notes.md` §6 item 2).
**Instrument:** `/private/tmp/espansoconfig-harness-2d-5-7b/`, **rebuilt** this phase — §1 to §3 are
the rebuild record, kept in this file rather than in a separate `…-instrument-rebuild.md` because the
rebuild is small and every launch of it is this reading's.
**Binary every launch of the proof generation ran:**
`c163c487b6df00adb3c7e3a591f09e042baffffd7b73f41d674588290fe3b27a`.

This is a **window reading**: a claim about what a real WKWebView window built from this tree does,
backed by real launches of a real macOS bundle. A green test suite is not a screen, and this record
rests on twelve retained launches and their transcripts. **It produced no production source.** The
only repository files it changed are the instrument's own — `src/probe.ts` and
`src-tauri/src/probe.rs`, both untracked, both deleted by 2d-8 — plus this record. The two hook
files still read `5 insertions(+), 1 deletion(-)` (§8).

**What it establishes, in one paragraph, each claim cited below.** In a real window built from this
tree, the shell's registration through `plugin:event|listen` for `workspace://reconciliation-ready`
**resolved** under the two-entry capability on every one of ten plan launches, with no access-control
refusal (§4.2); the open produced **exactly one** `drain_external_changes`, with `afterSequence: 0`,
answered `epoch=1 newest_sequence=0 observations=0` (§4.2); an external replacement of the watched
document while the window was open produced a **new** `drain_external_changes` — issued 263-275 ms
and answered 265-342 ms after `writerAt`, the driver's timestamp taken **before** the
`probe_second_writer` invoke (`L03` 267/270, `L04` 275/342, `L05` 263/265), so each figure is an
upper bound on the delay from the rename itself — whose answer carried one `Changed` observation with
`seq=1` and the disk revision equal to the fixture's SHA-256, on three launches including one over a
CRLF block-scalar fixture (§4.3, §4.4); the no-plan
control ran a live window that wrote no transcript line and changed no byte (§4.6); and **no
window-close path in this application runs `dispose()`** — a real Apple Event quit ended the process
with no `plugin:event|unlisten` and, by construction, no unmount (§4.5, §5).

**What it may not claim.** Nothing about what a window *draws* for an external conflict — that surface
is 2d-6's, and no launch here opened a document or a write surface. And, per `2d-5-split-notes.md` §6
item 7, this is a narrow regression reading and **not** the native watcher matrix: §4.3 is an
observation of this build on this host, with one watcher configuration, over one synthetic file, and
2d-7 owns the matrix.

---

## 1. What the filesystem showed when this phase began

**No harness tree existed**: `ls /private/tmp/ | rg espansoconfig` matched nothing.
`/private/tmp/espansoconfig-harness-2d-5/` had gone with the temporary directory, as `PROGRESS.md`'s
"Next action" says. **The four instrument paths were present**: `git status --short
--untracked-files=all` listed ` M src-tauri/src/main.rs`, ` M src/main.ts`, `?? src-tauri/src/probe.rs`
and `?? src/probe.ts` (plus ` M PROGRESS.json`, the orchestrator's), and `git diff --stat -- src/main.ts
src-tauri/src/main.rs` read `2 files changed, 5 insertions(+), 1 deletion(-)`. **No application was
running**: `pgrep -fl espansoConfig` matched only the codex broker processes whose working directory
holds the project name.

Each of those is a reading of a present state and says nothing about when anything went. This phase
deleted nothing.

## 2. What was rebuilt, and from what

**The tree is `/private/tmp/espansoconfig-harness-2d-5-7b/`** — a **new** path, never
`…-harness-2d-5`, for the reason `2d-5-2c-1-instrument-rebuild.md` §1 gives: a shared path reads as a
shared ledger. `HARNESS_ROOT` in `src-tauri/src/probe.rs:63` is a compile-time constant that must agree
with `launch.sh`'s `HARNESS`, and it was moved to the new path; that is the only edit to the Rust half.

```
/private/tmp/espansoconfig-harness-2d-5-7b/
  launch.sh                     one plan-driven launch: the case table, the seed, a fresh bundle,
                                the wait, the kill (or the quit), the byte checks
  inert.sh                      one launch with no plan at all — the no-plan control
  fixtures/                     5 files — 1 R0, 2 R1, 1 R2, and 1 R38 hard-shape R1
  launches/S01…S03, L01…L07,    per launch: xdg/, xdg-before/, home/, espansoConfig.app,
           N01…N02/             probe.log, probe.err, bytes.txt, tree.diff (quit.log on close cases)
  manifest-2d-5-7b-post.sha256  61 entries; 60 verify — a post-image, and only that. The one that
                                does not is the pre-edit `src/probe.ts` line: after the launches the
                                file gained one closing-bracket comment, its new digest was APPENDED
                                (never regenerated, 2d-5-2c-1 §9.1), and the rebuilt bundle stayed
                                `index-B8KejyfY.js`, which is the reading that no executable byte moved
```

The tree is **524 MB** over twelve retained bundles, about 40 MB each.

| Rebuilt file | Built from | Provenance |
|---|---|---|
| `launch.sh` | `2d-5-2c-1` §3 (the recipe, the `open` invocation, the three refusals and exit codes 68/69/65, the wait, the kill), §5.10 (the two-halved backup search), §5.11 (the kill), §5.12 (the hand-assembled bundle, identifier `cc.carpio.espansoConfig`), §12.4 (the wait breaks on either terminal line); `2c-5-5a` §3 | re-authored from the records; the case table and the quit arm are this phase's |
| `inert.sh` | `2d-5-2c-1` §4.3 (no `ECFG_PROBE_*` variable at all, `alive-at-kill` via `pkill`'s status, the twelve-second wait) | re-authored from a record |
| `fixtures/base-r0.yml` | `2d-5-2c-1` §2: one comment line and a `matches:` sequence of `:alpha`, `:beta`, `:gamma`, each a double-quoted `trigger:` and a plain `replace:` | re-authored from a description |
| `fixtures/elsewhere-r1.yml` | the same: changes `:alpha`'s replacement, leaves `:beta`'s owned lines byte-identical, no reorder | re-authored from a description |
| `fixtures/target-changed-r1.yml` | the same: changes `:beta`'s replacement, leaves `:alpha` alone | re-authored from a description |
| `fixtures/third-r2.yml` | a third revision, different bytes from both R1 files; **no launch of this phase uses it** — it is carried so the tree has the four-fixture shape the records describe | shape authored here |
| `fixtures/target-changed-crlf-block-r1.yml` | **R38, new**: `target-changed-r1.yml` with every line ending `\r\n` and `:beta`'s replacement a two-line `\|` block scalar. Written with `printf` so the carriage returns are real bytes; `rg -c '\r'` answers 10 on it and nothing on the others | authored here |
| `src/probe.ts` | the instrument as 2d-5-2c-2 left it, **extended** — §3 | authored from the code |
| `src-tauri/src/probe.rs` | the instrument as 2d-5-2c-2 left it; one constant moved | unchanged but for `HARNESS_ROOT` |

**Not rebuilt: `confine.sh` and `adversary.sh`.** Neither writer confinement control is needed by a
reading that calls the second writer on its own launch tree only, and the four confinement residuals
of `2d-5-2c-1` §4.5 are inherited unchanged and unmeasured here. The five `*-expected.yml` prediction
fixtures and the eight write-surface case rows of 2d-5-2c-1's table were **not** restored either: no
launch of this phase opens a write surface, and a case-table row no launch runs is exactly what
2d-5-2c-1 §4's acceptance criterion forbids. **Every byte no record fixes is this phase's own choice**,
the comment line's wording and the replacement strings included, and byte-identity with any earlier
tree's fixtures is neither claimed nor established (§2.1).

### 2.1 The fixture digests are this tree's own

`shasum -a 256` over `fixtures/`:

```
8c1ea2ba606e1c4f3a232d2ed1bc88b3ea9d1dac62e40c9c22fe9618dbe01118  base-r0.yml
99f2547d2c1286f7e0c7bb245c3820b7ef2d4db21f5448f2fbacc3bf73c82f11  elsewhere-r1.yml
6c40b746cd51abc3b34a766d2fe1c381b7dff4abaa651bad0a147f53d5f4b8e4  target-changed-r1.yml
c0ab89977a430fac3f8d4b9091b4e2c55f7b34eb3d7d492b96c77a92d0a19ca5  target-changed-crlf-block-r1.yml
b45dbaa99fb15838fb59bbc9ce9533e8c460570c1ffa1c9284c458ba7bbe3f31  third-r2.yml
```

The first, third and fourth appear verbatim in the transcripts as `prev=`, `disk=` and `revision`
values (§4.3, §4.4), which is how a transcript's revisions are checkable against the files on disk
without launching anything — an observation of these files on this build, as `2d-5-2c-1` §4.2 said of
its own, and not a documented property of the revision function.

## 3. The instrument extension: the IPC recorder

The evidence this phase needs is invisible to the instrument 2d-5-2c-2 left: no screen draws the
`plugin:event|listen` registration, a drain's watermark, or a batch's sequence numbers. **The recommended
observation point does not exist.** The brief suggested wrapping `window.__TAURI_INTERNALS__.invoke`;
Tauri defines that object with `Object.defineProperty(window, '__TAURI_INTERNALS__', { value })`
(`tauri-2.11.5/src/manager/webview.rs:173`) and its `invoke` the same way (`tauri-2.11.5/scripts/core.js:81`)
— non-writable and non-configurable both — so an assignment throws in module code and a redefinition
throws everywhere. This was read from the crate source in the cargo registry, not tried in a window.

**What was wrapped instead is the transport under it, inside the instrument only.** On macOS every
command leaves the page as `fetch('ipc://localhost/<command>', { method: 'POST', body: <arguments as
JSON>, headers })` (`tauri-2.11.5/scripts/ipc-protocol.js:37`) and its response carries a
`Tauri-Response: ok|error` header and the answer as its body. `window.fetch` is an ordinary writable
global and the init script resolves the name at call time, so `src/probe.ts` replaces it at module
top level — `src/main.ts` imports `./probe` ahead of `bootstrap()`, so the replacement is in place
before the application issues anything, and the transcripts confirm it: `#1 set_menu_labels` at
`t=1ms` is recorded on every plan launch. The wrapper issues every request exactly as it would have
been, takes a `clone()` of the response before handing it back, and records `{seq, cmd, args, outcome,
answer, t, dt}` when the clone's body has been read. **Ordering is by answer, not by issue**: the
transcript prints records in the order their bodies were read, and `#seq` (assigned at issue) and
`t=` carry the issue order.

- **Buffer, then live, or stand down.** Records buffer until `startProbe()` learns whether a plan
  exists. With one, `goLive()` queues the whole buffer in one synchronous block and every later record
  prints as it lands; without one, `standDown()` discards the buffer and puts the original `fetch` back,
  so the no-plan control stays a control — the only thing it ever paid is the wrapper being in place for
  its first moments (§4.6).
- **The four probe commands are never recorded**, because recording one would invoke another.
- **Every transcript line goes through one promise chain** (`say()` → `transcriptTail`), the plan's own
  lines and the recorder's alike, so a recorder line landing while a plan line is in flight prints
  after it. S01 is the launch that found this necessary (§4.1).
- **A drain's answer is summarised, not quoted**: `epoch`, `newest_sequence`, `discarded`, and one
  bracket per observation carrying its arm, `sequence`, document and revisions and the *name* of its
  content arm — never the projection or the disk text. Every other answer is JSON cut at 320 characters.
- **Four reporters** print a reading of the records on demand: `--- listen`, `--- unlisten`,
  `--- drains` and `--- ipc <tag> … commands=[…]`; each is a count over the `--- ipc` lines above it.
- **Three new cases** — `lifecycle-open`, `lifecycle-delivery` (also run as `lifecycle-delivery-hard`
  with the R38 fixture) and `lifecycle-close` — and one wait, `waitForIpcQuiet`, which calls the
  transport idle when nothing is in flight and nothing has been answered for 1.5 s. `waitForWithin`
  generalises `waitFor` to a caller-chosen limit, because the delivery wait is 15 s and the driver's
  default is 6 s.

**What this changes about the instrumented build, stated as narrowly as it can be.** Every instrumented
launch now runs the application's IPC through a `fetch` wrapper that clones every response. That is a
cost on every command, it was not measured, and it goes when the harness goes. The wrapper does not
alter a request or an answer, and `bytes=MATCH` on every launch is the reading that the application
behaved as it does unwrapped in the one respect the byte check sees.

## 4. The launches

**Twelve launches, three generations, two binaries.** `S01` ran `15f44bbb46731c9472a4221e95d62089aeec3078d9e6487ed38c236f7f735288`,
the first build, and found two driver defects (§4.1). **`S02`, `S03`, `L01`–`L07`, `N01` and `N02`
ran `c163c487b6df00adb3c7e3a591f09e042baffffd7b73f41d674588290fe3b27a`**, the build after the fixes,
which was byte-identical to `target/debug/espansoconfig` when read at the close of the launches.
`S02` and `S03` are shakedowns of the delivery and close cases on that binary; they passed first time
and are retained and labelled as shakedowns rather than promoted. **`L01`–`L07` are the proof set**,
one launch per row of the case table in both languages where the row was run twice, and `N01`–`N02`
the no-plan controls. Every launch went into a fresh bundle path, every plan launch set the language
through the picker, and every transcript's `--- language picked=… lang=… label=ok` line records that it
took.

The launch recipe, as run:

```sh
npm run build                                          # 191 modules
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol # Finished `dev` profile
/private/tmp/espansoconfig-harness-2d-5-7b/launch.sh <case>[:<lang>] <name>
/private/tmp/espansoconfig-harness-2d-5-7b/inert.sh <name>
```

and, per plan launch, into a bundle path never used before:

```sh
open --env "ECFG_PROBE_PLAN=$PLAN" \
     --env "ECFG_PROBE_TARGET=$LAUNCH/xdg/espanso/match/conflict.yml" \
     --env "ECFG_PROBE_R1=$FIXTURES/$R1" \
     --env "ECFG_PROBE_R2=" \
     --env "XDG_CONFIG_HOME=$LAUNCH/xdg" --env "HOME=$LAUNCH/home" \
     --stdout "$LAUNCH/probe.log" --stderr "$LAUNCH/probe.err" \
     "$LAUNCH/espansoConfig.app"
```

The three script refusals were exercised on this tree: `launch.sh lifecycle-open:se QXX` printed *the
plan lifecycle-open:se is not `<case>[:en|es]`* and exited **68**; `launch.sh lifecycle-open:en
'bad/name'` printed *the launch name bad/name must be non-empty and only letters, digits, - and _* and
exited **69**; a second `launch.sh lifecycle-open:en L01` printed *launch name L01 has already been
used; pick another* and exited **65**. A listing of `launches/` afterwards shows the twelve names and no
other.

`launch.sh` conjoins nothing. **The verdict column below is this reader's conjunction** of
`reached-end=yes`, `failed-lines=0`, `probe.err=0` and `bytes=`, read from each launch's retained
`bytes.txt`, plus the transcript lines §4.2–§4.5 quote.

### 4.1 The set, and every launch's verdict

| Launch | Plan | Binary | `bytes` | `tree-diff` | `probe.err` | end / failed | Verdict |
|---|---|---|---|---|---|---|---|
| `S01` | `lifecycle-open:en` | `15f44bbb…` | MATCH | 0 | 0 | 1 / 0 | **shakedown** — found §4.1's two defects; not evidence |
| `S02` | `lifecycle-delivery:en` | `c163c487…` | MATCH | 5 | 0 | 1 / 0 | pass (shakedown, first attempt) |
| `S03` | `lifecycle-close:en` | `c163c487…` | MATCH | 0 | 0 | 1 / 0 | pass (shakedown, first attempt) |
| `L01` | `lifecycle-open:en` | `c163c487…` | MATCH | 0 | 0 | 1 / 0 | **pass** |
| `L02` | `lifecycle-open:es` | `c163c487…` | MATCH | 0 | 0 | 1 / 0 | **pass** |
| `L03` | `lifecycle-delivery:en` | `c163c487…` | MATCH | 5 | 0 | 1 / 0 | **pass** |
| `L04` | `lifecycle-delivery:es` | `c163c487…` | MATCH | 5 | 0 | 1 / 0 | **pass** |
| `L05` | `lifecycle-delivery-hard:en` | `c163c487…` | MATCH | 21 | 0 | 1 / 0 | **pass** (R38) |
| `L06` | `lifecycle-close:en` | `c163c487…` | MATCH | 0 | 0 | 1 / 0 | **pass** — `quit-sent=yes status=0 exited-after-quit=yes wait=0s alive-at-kill=no` |
| `L07` | `lifecycle-close:es` | `c163c487…` | MATCH | 0 | 0 | 1 / 0 | **pass** — same three fields |
| `N01` | *no plan* (`inert.sh`) | `c163c487…` | — | 0 | 0 | zero-byte log | **pass** — `target-unchanged=yes alive-at-kill=yes` |
| `N02` | *no plan* (`inert.sh`) | `c163c487…` | — | 0 | 0 | zero-byte log | **pass** — same |

`backups=none` on every plan launch: nothing here writes through the application's save path. The
`tree-diff` of 5 on the delivery launches and 21 on `L05` is the second writer's replacement of the
one synthetic file, and `bytes=MATCH` against that launch's R1 says the file ended holding the fixture
byte for byte. **`S01` is what a first build produced**: its transcript printed the buffered records
interleaved with live ones (`#4` ahead of `#1`, because the flush loop awaited each line) and printed
the language and viewport lines twice (the case repeated what `startProbe()` had already done). Both
are driver defects, both were fixed in `src/probe.ts`, and §3's rebuild order was paid once more —
which is what the two binary digests in the table are.

### 4.2 Registration and the open, from `L01` and `L02`

`L01`'s transcript, the seven `--- ipc` lines in the order they were answered and the reading under
them, quoted verbatim but for the cut answers of `#1`, `#4`–`#6`:

```
--- ipc #1 set_menu_labels args={"labels":{"about":"About espansoConfig",… -> ok answer=null t=1ms dt=6ms
--- ipc #3 open_workspace args={"root":null} -> ok answer={"root":"/private/tmp/espansoconfig-harness-2d-5-7b/launches/L01/xdg/espanso","documents":2,"match_files":1,"config_profiles":1,"packages":0,"disabled":0} t=4ms dt=3ms
--- ipc #4 list_documents args={} -> ok answer=[{"id":0,… t=7ms dt=4ms
--- ipc #2 plugin:event|listen args={"event":"workspace://reconciliation-ready","target":{"kind":"Any"},"handler":2892139858} -> ok answer=0 t=4ms dt=8ms
--- ipc #5 get_document args={"id":0} -> ok answer={… t=11ms dt=1ms
--- ipc #6 get_document args={"id":1} -> ok answer={… t=12ms dt=1ms
--- ipc #7 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=0 discarded=0 observations=0 [] t=15ms dt=4ms
--- listen open count=1 forWake=1 resolved=1 rejected=0 answers=[#2:ok:0]
--- unlisten open count=0 answers=[]
--- drains open count=1 [#7 afterSequence=0 -> ok observations=0]
--- ipc open settled=7 inFlight=0 commands=[set_menu_labels×1 · open_workspace×1 · list_documents×1 · plugin:event|listen×1 · get_document×2 · drain_external_changes×1]
```

What that shows, and what each claim rests on:

1. **The registration resolved.** `#2 plugin:event|listen` for `workspace://reconciliation-ready` was
   answered `-> ok answer=0` — the event id Tauri's `listen` resolves with — and no `-> error` appears on
   it. **The same line, differing only in the callback id and the timings, is on all ten plan
   launches** (`S01`–`S03`, `L01`–`L07`; checked as ten separate matches of `#2 plugin:event|listen …
   -> ok answer=0`). That the transcript *would* show a refusal is not assumed: `L06` and `L07` carry
   one on a different command (§4.5).
2. **The shell issued the registration before the open.** `#2` is the listen and `#3` is
   `open_workspace` on all ten plan launches (`#1` being `main.ts`'s `set_menu_labels`); sequence numbers
   are assigned at issue, so this is the order `AppShell.svelte:73` (`browser.start()`) and `:77`
   (`void browser.open(null)`) were reached in. It is printed *after* `#3` in most transcripts because
   the transcript is in answer order and the registration took 7–9 ms against the open's 3 ms.
3. **The open produced exactly one drain**, `#7 drain_external_changes args={"afterSequence":0}`,
   answered `epoch=1 newest_sequence=0 discarded=0 observations=0`, on all ten plan launches. That is
   consistent with `2d-5-7a-notes.md` §2 item 3 — the registration resolving while the open's gate is
   closed, and `workspaceReady()` issuing one physical drain for both reasons — and it is only
   *consistent with*: a transcript cannot distinguish one drain for two reasons from one drain for one,
   and the registration's `settledAt` (`t=4ms dt=8ms`, so 12 ms) against the drain's issue (`t=15ms`)
   is a millisecond-resolution reading of when a *cloned body* was read, not of when the application's
   promise resolved.
4. **No `plugin:event|unlisten`** was issued during the open on any launch (`--- unlisten open count=0`).

`L02` (`:es`) is the same seven commands plus one: `#8 set_menu_labels` with the Spanish labels, issued
when the picker was set. The listen and drain lines are identical in shape (`#2 … -> ok answer=0`,
`#7 afterSequence=0 … observations=0`). **A side observation the transcripts make of `CLAUDE.md` §6's
rule about `localStorage`:** `L03`, `L04`, `L05` and `L07` each start with a `#1 set_menu_labels` whose
labels are in the language the *previous* launch picked (Spanish after `L02`; `L03`'s `#1` reads
`"about":"Acerca de espansoConfig"`), and each then carries a second `set_menu_labels` after the
picker was set. The override followed the bundle identifier across bundle paths and fresh `HOME`s,
exactly as the rule says, and setting the language through the picker is what corrected it.

### 4.3 Real delivery, from `L03` and `L04`

After the open had settled (`--- ipc open settled=8 inFlight=0`), the plan called
`probe_second_writer`, which replaced the watched document with `target-changed-r1.yml` from outside
the application's save path, and waited for a **new** drain carrying an observation. `L03`, verbatim,
the reload's answer cut:

```
--- writer second wrote=yes
--- delivery writerAt=1593ms seqBefore=8 drainsBefore=1
--- ipc #9 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=1 discarded=0 observations=1 [Changed seq=1 doc=Addressable:match/conflict.yml prev=8c1ea2ba606e1c4f3a232d2ed1bc88b3ea9d1dac62e40c9c22fe9618dbe01118 disk=6c40b746cd51abc3b34a766d2fe1c381b7dff4abaa651bad0a147f53d5f4b8e4 content=Projected] t=1860ms dt=3ms
--- ipc #10 reload_document args={"id":1} -> ok answer={"id":1,…"revision":"6c40b746cd51abc3b34a766d2fe1c381b7dff4abaa651bad0a147f53d5f4b8e4","byte_len":221,"line_ending":"Lf",… t=1865ms dt=1ms
--- delivery drain=#9 afterSequence=0 observations=1 issued=267ms answered=270ms after the write
--- listen after-delivery count=1 forWake=1 resolved=1 rejected=0 answers=[#2:ok:0]
--- unlisten after-delivery count=0 answers=[]
--- drains after-delivery count=2 [#7 afterSequence=0 -> ok observations=0 · #9 afterSequence=0 -> ok observations=1]
```

1. **A new drain came, and it carried the observation.** `#9` was issued 267 ms after the write and
   answered 270 ms after it — "after the write" meaning after `writerAt`, which the driver reads
   **before** it invokes `probe_second_writer` (`src/probe.ts`, `lifecycleDeliveryPlan()`), so every
   figure in this section counts the writer's own round trip and is an upper bound on the delay from
   the rename; `seqBefore=8` and `#9 > 8` is what makes it new. Its answer is a batch with
   `newest_sequence=1` and one `Changed` observation, `seq=1`, for `Addressable:match/conflict.yml`,
   `prev=8c1ea2ba…` (the R0 digest, §2.1) and `disk=6c40b746…` (**the digest of `target-changed-r1.yml`**,
   §2.1), `content=Projected`. **`L04`** (`:es`) is the same shape: `#9 … newest_sequence=1
   observations=1 [Changed seq=1 … disk=6c40b746… content=Projected]`, issued 275 ms and answered 342 ms
   after the write. `S02`, the shakedown, agrees at 280/281 ms.
2. **The drain's watermark was `0`**, the coordinator's after the open's empty batch, and after this
   batch no further drain was issued before the plan ended (`drains after-delivery count=2`), so the
   watermark's advance to 1 is not itself observed here — only that nothing drained again.
3. **A `reload_document {"id":1}` followed within 5 ms**, answering the new revision `6c40b746…` and
   `byte_len 221`. That is the coordinator's `Changed` transition re-reading the file
   (`observationTransitions.ts:1306` → `rereadUnderGuard` → `reload_document`), seen and not claimed:
   nothing here says what the window drew from it.
4. **What made the drain happen is not observed.** The wake — Rust's `handle.emit(RECONCILIATION_READY,
   …)` reaching the registered handler and `onWake` calling `requestDrain('wake')` — crosses in the
   other direction and is invisible to a `fetch` wrapper. What is observed is that a drain was issued
   267 ms after an external write, when nothing else in the plan asked for one: the plan itself invokes
   only the four probe commands, the foreground source is inert, and no open was in progress. The
   inference that the wake carried it is strong and is stated as an inference.

**If the drain had not come**, the plan would have printed `--- finding no drain carrying an
observation landed within 15000ms …` and thrown, and the launch would show `failed-lines=1`. No
launch did.

### 4.4 R38, from `L05`: the same delivery over a CRLF block-scalar fixture

`lifecycle-delivery-hard` is `lifecycle-delivery` with `ECFG_PROBE_R1` pointed at
`target-changed-crlf-block-r1.yml`. `L05`, verbatim:

```
--- ipc #9 drain_external_changes args={"afterSequence":0} -> ok answer=epoch=1 newest_sequence=1 discarded=0 observations=1 [Changed seq=1 doc=Addressable:match/conflict.yml prev=8c1ea2ba606e1c4f3a232d2ed1bc88b3ea9d1dac62e40c9c22fe9618dbe01118 disk=c0ab89977a430fac3f8d4b9091b4e2c55f7b34eb3d7d492b96c77a92d0a19ca5 content=Projected] t=1851ms dt=2ms
--- ipc #10 reload_document args={"id":1} -> ok answer={"id":1,…"revision":"c0ab89977a430fac3f8d4b9091b4e2c55f7b34eb3d7d492b96c77a92d0a19ca5","byte_len":265,"line_ending":"Crlf",… t=1854ms dt=1ms
--- delivery drain=#9 afterSequence=0 observations=1 issued=263ms answered=265ms after the write
```

`disk=c0ab8997…` is the fixture's digest (§2.1), `content=Projected` says the core projected it, and the
reload answered `"line_ending":"Crlf"` and `byte_len 265`. `bytes=MATCH` against the fixture and
`tree.diff` showing every line of the new file ending in `^M` are the byte readings. **What this is
evidence of**: the drain, the observation and the projection over a CRLF block-scalar document behave
as over the plain one, in this one launch. **What it is not**: a reading of any of `CLAUDE.md` §4's
fifteen fixtures, none of which has been through this harness, and not a reading of what a window
draws for it.

### 4.5 Disposal, from `L06` and `L07`: what a real close does and does not do

**Investigated first from source, as the brief asked.** `src/main.ts:35` mounts `App` and nothing in
the tree calls `unmount`; no `beforeunload`, `pagehide` or `unload` handler exists in `src/` outside
the instrument; `src-tauri/src/main.rs` installs no `on_window_event` handler and handles no
`CloseRequested`. So **no window-close path in this application destroys the `AppShell` component**,
and the cleanup its `onMount` returns (`AppShell.svelte:86-88`, `browser.dispose()`) has no
window-close caller. `dispose()` runs when the component is destroyed — which the mounted
`AppShell.test.ts` drives and pins — and a window close destroys the webview, not the component.

**Then measured, as far as a transcript can.** `lifecycle-close` opens and settles, then (1) invokes
`plugin:window|close` from the instrument, (2) prints `--- awaiting close`, after which `launch.sh`
sends `osascript -e 'tell application id "cc.carpio.espansoConfig" to quit'` and waits for the process
to leave. `L06`, verbatim:

```
--- ipc #8 plugin:window|close args={} -> error answer="window.close not allowed. Permissions associated with this command: core:window:allow-close" t=1541ms dt=1ms
--- close-attempt plugin:window|close -> rejected "window.close not allowed. Permissions associated with this command: core:window:allow-close"
--- listen before-quit count=1 forWake=1 resolved=1 rejected=0 answers=[#2:ok:0]
--- unlisten before-quit count=0 answers=[]
--- awaiting close t=3102ms
--- end
```

and `L06/bytes.txt`: `quit-sent=yes status=0`, `exited-after-quit=yes wait=0s`, `alive-at-kill=no`.
`L07` (`:es`) reads the same (`#9` rather than `#8`, because of the Spanish `set_menu_labels`).

1. **The `plugin:window|close` refusal is a control, and it is what makes §4.2's claim non-vacuous.**
   The capability grants no window permission, the transport answered `-> error` with Tauri's own
   access-control sentence, and the recorder printed it. An access-control refusal on
   `plugin:event|listen` would have printed the same way, and none did on any launch.
2. **A real quit ended the process within a second and issued no `plugin:event|unlisten`.** The last
   recorder line before the quit is `--- unlisten before-quit count=0`; nothing follows `--- end` in
   either transcript. **That absence is bounded**: a line issued during teardown that could not be
   flushed before the process died would also be absent, so the transcript cannot distinguish *not
   issued* from *issued and lost*. What decides it is the source reading above — there is no caller — and
   the transcript is consistent with it.
3. **The four page-lifecycle listeners the plan installed (`pagehide`, `beforeunload`, `unload`,
   `visibilitychange`) printed nothing either.** Same bound: an event that fired at teardown could not
   have flushed a line. Whether WKWebView fires them on an application quit is **unobserved**, and
   §10 item 4 names the cheap way to find out.
4. **What the spec sentence therefore comes to.** *"Its `dispose()` runs on window close"* is not a
   property of this application today: the cleanup exists and is wired (`AppShell.test.ts` shows
   destruction calls the unlisten exactly once), and no close path destroys the component. The
   Rust-side listener the registration created is removed by process exit, not by `unlisten`. Whether
   the application *should* unmount on close — a `beforeunload` that calls `unmount`, or a
   `CloseRequested` handler — is a design decision for a later phase and not a fix here (§10 item 1).

### 4.6 The no-plan control, from `N01` and `N02`

`inert.sh` assembles the same bundle and launches it with `XDG_CONFIG_HOME` and `HOME` set and **no**
`ECFG_PROBE_PLAN`, `ECFG_PROBE_TARGET`, `ECFG_PROBE_R1` or `ECFG_PROBE_R2`. Both answered:

```
probe.log=0 bytes  probe.err=0 bytes  tree-diff=0 lines  target-unchanged=yes  alive-at-kill=yes  binary=c163c487…
```

**What that establishes and no more**: with the variable absent, a live window (`pkill` answered 0)
wrote no transcript line in twelve seconds and the synthetic tree was byte-identical afterwards. **What
the recorder adds to the control's honesty**: `standDown()` put the original `fetch` back the moment
`probe_plan` answered `null`, so the control ran the application's IPC unwrapped for all but its first
milliseconds — and, as before, nothing here can distinguish *no write* from *an identical or transient
write*, because a zero-byte transcript is the recorder saying nothing.

## 5. What the reading does **not** prove

1. **It does not observe the wake.** The `fetch` wrapper sees commands the page issues, not events Rust
   emits into it. §4.3's inference that a wake carried the drain is an inference from timing and from
   the absence of any other requester.
2. **It is not the native watcher matrix** (`2d-5-split-notes.md` §6 item 7). One host, one watcher
   configuration, one synthetic file replaced by rename, three launches plus a shakedown. 2d-7 owns the
   matrix, and §4.3 may not be cited as evidence that a wake is delivered in general.
3. **It does not observe `dispose()` on a window close, because nothing calls it there** (§4.5). The
   absence of `plugin:event|unlisten` at quit is consistent with the source and cannot, on its own,
   distinguish *not issued* from *issued and lost at teardown*.
4. **It says nothing about what a window draws.** No plan opened a document or a write surface; the
   `reload_document` after the delivered observation was seen, and what the screen did with it is
   2d-6's surface and unread here. `HTMLElement`s were queried, not looked at; every window was
   occluded (`visibility=hidden`, `hasFocus=false`) at `1180x728 dpr=2`.
5. **One drain for two reasons is consistent with, not shown by, the transcripts** (§4.2 item 3).
6. **The watermark's advance after the delivered batch is unobserved** (§4.3 item 2): no further drain
   was issued before the plan ended, so no transcript carries an `afterSequence` of 1.
7. **R38 is one fixture and one launch** (§4.4). The fifteen corpus fixtures are untouched.
8. **Byte-exactness of the recorder's pass-through is read from `bytes=MATCH` only.** The wrapper
   clones responses and alters nothing by construction; that the application behaved as it does
   unwrapped is a claim the one byte check supports in the one respect it sees.
9. **The general rule that binds every absence sentence here**: an absence is bounded to the time it
   was taken, the corpus it was taken over and the predicate it was taken with.

## 6. Deviations from the records

1. **The rebuild has no separate record.** §1–§3 are it. 2d-5-2c-1 wrote its own file because it
   rebuilt four scripts, nine fixtures and both probe sources from nothing; this phase re-authored two
   scripts and five fixtures, moved one constant and extended one file, and every launch is the
   reading's.
2. **`launch.sh`'s case table is four rows, none of them a write-surface case** (§2). The plan grammar
   admits a case name of any number of hyphen-joined words (`lifecycle-delivery-hard`), where 2d-5-2c-1's
   admitted exactly two; `parsePlan` in `src/probe.ts` is unchanged and splits on `:` alone, so the two
   implementations still differ and still agree on every plan this phase ran.
3. **`launch.sh` has a quit arm.** For a `CLOSE=quit` row it watches for `--- awaiting close`, sends the
   Apple Event quit, waits up to ten seconds for the process to leave on its own, and records
   `quit-sent=`, `exited-after-quit=` and `wait=`; the kill that follows is then a no-op, which
   `alive-at-kill=no` records. No record describes this; it is what §4.5 needed.
4. **`ECFG_PROBE_WAIT` defaults to 60 s** rather than 25, because the delivery cases may wait 15 s for
   a drain on top of the open's settle. Every launch finished in 3–6 s.
5. **`ECFG_PROBE_R2` is always the empty string.** No case here uses the third writer.
6. **The transcript prints in answer order** (§3). Every earlier instrument printed in program order,
   because it printed only what the plan said; a recorder that reports answers cannot.
7. **`confine.sh` and `adversary.sh` were not rebuilt** (§2).
8. **The launches are named `S01`–`S03`, `L01`–`L07`, `N01`–`N02`.** Not a continuation of any earlier
   ledger. `S` marks a shakedown, `L` a lifecycle proof launch, `N` a no-plan control.

## 7. Privacy

Every launch ran with `XDG_CONFIG_HOME` and `HOME` pointed inside its own launch directory, so neither
candidate `resolve_config_dir()` probes reaches the owner's configuration; `open_workspace`'s answer on
every transcript names `…/launches/<name>/xdg/espanso` as the root. The synthetic tree holds two
hand-authored files whose content is neutral, and the five fixtures name `:alpha`, `:beta` and `:gamma`
and nothing else.

**The sweep, and what it is a reading of.** Over the whole harness tree, excluding the twelve copied
`.app` bundles:

- `rg --no-ignore --hidden -l -g '!*.app' 'Library/Application Support/espanso|\.config/espanso|Dropbox|@'`
  — **no match**.
- `rg --no-ignore --hidden -l -g '!*.app' '/Users/ccarpio'` — **two files, `launch.sh` and
  `inert.sh`**, and `rg -o` enumerates exactly one hit in each: the `${REPO:-…}` default naming the
  repository, which every commit of this project already names. There is no other shape.
- A control search for `espansoconfig-harness-2d-5-7b` in `L03/probe.log` answers 5 lines, which is
  what makes the negatives non-vacuous.
- **No transcript quotes fixture text at all**: `rg -l 'alpha|beta|gamma' launches/` matches only the
  synthetic `conflict.yml` copies and the `tree.diff` files that diff them, never a `probe.log`. The
  drain summary drops the disk text and the projection by construction, and every other answer is cut
  at 320 characters.

The same searches were run over this record's own text before it was finished. **That is a reading of
those files for those strings, not of the twelve retained bundles**, which are copies of a binary
built from this repository and were not searched (§10 item 5).

## 8. The gates, with the harness in the tree

**These are with-harness figures.** The harness-free baseline `PROGRESS.md` carries is 2d-5-7a's
**`1323 / 444 / 2474 / 191`**, which was itself measured on a tree holding the instrument; the
committed tree without it builds **190** Vite modules, `src/probe.ts` being the 191st. This phase added
no file, so the prediction was that nothing moves, and nothing did.

| Command | Predicted | Measured | Exit |
|---|---|---|---|
| `cargo test --workspace -- --test-threads=1` | 1323 passed, 0 failed | **1323** passed, 0 failed, over 26 result lines | 0 |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | **clean** (`Finished`, no `warning:` line) | 0 |
| `cargo fmt --check` | clean | **clean** | 0 |
| `npm run check` | 444 files, 0 errors, 0 warnings | **444 files, 0 errors, 0 warnings** | 0 |
| `npm run build` | 191 modules | **191 modules** (`index-B8KejyfY.js`) | 0 |
| `npm test` | 2474 passed | **62 files, 2474 passed** | 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing | **finds nothing** | 1 (`rg`, no match) |

**The instrument's contribution to each count**: Rust **0** (`probe.rs` declares no test); svelte-check
**+1** file (`src/probe.ts`); vitest **+1** case (`scripts/lint/ipc-detail.test.ts`'s per-file sweep,
which `src/probe.ts` is one row of); Vite **+1** module. Those four are what 2d-5-7a's rung already
carries, so the rung is unmoved by this phase.

**The cargo gate was run in the authoritative form for this host** — `--test-threads=1` — and its
status was read from the command itself: the run was redirected to `/tmp/2d-5-7b-cargo-test.txt` and the
file was queried for the `test result` lines (26 lines, none lacking `0 failed`) and
their sum. Both bundle oracles were read over `dist/assets/index-*.js`, the second because it proves
the search can match at all:

```
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   → no match (server-only sentinels ABSENT)
rg -c 'window\.__svelte|svelte-trusted-html'  dist/assets/index-*.js   → 2        (client-only constructs PRESENT)
```

And the checks that the recorder and the close attempt reached the bundle:
`rg -o 'ipc://localhost/' dist/assets/index-*.js | wc -l → 1`,
`rg -o 'plugin:window\|close' … | wc -l → 3` (all three are the instrument's: the call and its two
report strings; `@tauri-apps/api/window` is not in the bundle),
`rg -o 'probe_second_writer' … | wc -l → 2` (the constant table and the call).

**The working tree at the close of this phase.** `git status --short --untracked-files=all` shows
` M PROGRESS.json` (the orchestrator's), ` M src-tauri/src/main.rs`, ` M src/main.ts`,
`?? src-tauri/src/probe.rs`, `?? src/probe.ts` and `?? docs/decisions/2d-5-7b-window-reading.md`, and
nothing else. `git diff --stat -- src/main.ts src-tauri/src/main.rs` reads
`2 files changed, 5 insertions(+), 1 deletion(-)`. **No git command that changes anything was run.**
`pgrep -fl espansoConfig` matches no application process.

## 9. What 2d-6, 2d-7 and 2d-8 inherit

- **The tree is `/private/tmp/espansoconfig-harness-2d-5-7b/`** and `HARNESS_ROOT` agrees with it.
  Nothing outside the tree was created — no decoy files, because no confinement control ran. `rm -rf`
  on the tree removes everything this phase put under `/private/tmp`.
- **The recorder is in `src/probe.ts` and costs a rebuild to change** — §3's order, every time.
- **The four instrument paths stay uncommitted.** Stage by path; never `src-tauri/src/` as a directory.
- **2d-6's reading can reuse `lifecycle-delivery` as its trigger**: after `--- delivery drain=#…`, the
  window holds a delivered `Changed` observation and has re-read the file, which is where 2d-6's
  surface begins.
- **2d-7's matrix owes what §5 items 1 and 2 withhold.**
- **2d-8 deletes `src/probe.ts`, `src-tauri/src/probe.rs`, the two hook lines in each hook file, and
  the tree**, and corrects `main.rs:214-227`.

## 10. Where it is thin

No item names a correctness defect in a shipped source file; none is a blocker.

1. **`recorded only` — `dispose()` has no window-close caller** (§4.5 item 4). The spec's sentence
   describes a lifetime the application does not have on close. Whether to add an unmount on
   `beforeunload` or a `CloseRequested` handler is a deliberate later decision; today the Rust-side
   listener dies with the process, which is harmless and unrecorded anywhere the user can see.
2. **`recorded only` — the wake is inferred, not observed** (§5 item 1). An observation point for
   events would be the `callbacks` map's `runCallback`, which is also non-writable; the honest way to
   see a wake from the page is a handler the instrument registers itself through `listen`, which would
   be a second subscription and a change to what the window does. Not done.
3. **`recorded only` — one-drain-for-two-reasons is consistent with, not shown** (§4.2 item 3).
4. **`recorded only` — whether WKWebView fires `pagehide`/`unload` on an application quit is
   unobserved** (§4.5 item 3). The cheap probe is a synchronous `localStorage.setItem` in the handler
   and a read of it on the next launch, since the store follows the bundle identifier; whether WebKit
   flushes a write made at teardown is its own question. Not done, because nothing this phase claims
   depends on it.
5. **`recorded only` — the privacy sweep did not read the twelve retained bundles** (§7).
6. **`recorded only` — the recorder's `settledAt` is the clone read, not the promise resolution**
   (§4.2 item 3). Millisecond timings in this record are readings of that clock.
7. **`recorded only` — the two plan-grammar implementations differ** (§6 item 2), as they did before;
   nothing tests either, and both are instrument code.
8. **`recorded only` — `third-r2.yml` is carried and never used** (§2). It is there so the tree has the
   shape the records describe; a reader sweeping for fixtures a launch compared against will find four
   and not five.
9. **`recorded only` — the recorder wraps every `fetch`, and the application makes none but IPC.** A
   later frontend that fetched anything else would pass through the wrapper untouched and unrecorded,
   which is the intended behaviour and is untested.
10. **`recorded only` — `S01` ran a different binary and is retained** (§4.1). A reader sweeping
    `launches/` for `bytes=MATCH` will find it among the hits and must read §4's table first.

## 11. The review and its one disposition

The phase's one adversarial review is [`docs/reviews/phase-2d-5-7b.md`](../reviews/phase-2d-5-7b.md),
written by **Codex** (`autoclaude-review.sh` exited 0, so no fallback agent was spawned). Verdict
**`ship-with-fixes`, 0 blockers, 1 SHOULD-FIX** (medium), and it names one sentence of this record:
the opening paragraph's *"produced a new `drain_external_changes` within 270 ms"*, generalized over
three launches. **Re-derived before it was fixed, and it holds**: `L04/probe.log:22` reads
`issued=275ms answered=342ms after the write`, so the bound was false for one launch of the three, and
`writerAt` (`src/probe.ts`, `lifecycleDeliveryPlan()`) is read **before** the `probe_second_writer`
invoke, so "after the write" was also undefined in the summary. §4.3 item 1 already carried the right
per-launch figures. **The fix is in this record only**: the summary now states the two ranges
(issued 263-275 ms, answered 265-342 ms), names each launch's pair, and defines the timestamp as the
pre-writer reading and each figure as an upper bound on the delay from the rename; §4.3 item 1
defines it the same way. No transcript, launch, fixture or instrument file changed, and no launch was
re-run. The review's own header line reads `BLOCKERS: 1` where its body and footer read `0 blocker(s)`
and `BLOCKERS: none`; the finding is filed as SHOULD-FIX and this record treats it as one.
