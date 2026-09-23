# Design consult — Phase 2d-7, the reviewed temporary instrument and the bilingual WKWebView reading

- **Provider:** Claude Opus agent (Codex out of quota until 2026-09-26 19:14). An independent consultant; it wrote
  none of the code, the brief or the records it rules on.
- **Date:** 2026-09-23.
- **Inputs read:** `docs/decisions/2d-7-design-brief.md` (all of it); `CLAUDE.md` (all of it; §6 *Window readings*
  `:228-237`, §7 `:239`); `PROGRESS.md:1-244`; `docs/reviews/phase-2d-design.md:118-138`;
  `docs/reviews/phase-2c-5-7-removal.md:40-49`; `docs/reviews/phase-2d-6-design.md:235-269` (and its shape);
  `docs/decisions/2d-6-split-notes.md:583-586`; `docs/decisions/2d-6-window-readings-consolidated.md:60-212`;
  `docs/decisions/2c-5-5a-instrument-rebuild.md:2152-2200`; `src-tauri/src/probe.rs` (all 975 lines);
  `src/probe.ts:1-240`, `:530-818`, `:944-960`, `:2194-2217`, `:3125-3160`, `:4028-4094`, `:4940-5210`;
  the hook diff (`git diff src-tauri/src/main.rs src/main.ts`); `src-tauri/src/main.rs:200-262`;
  `src-tauri/src/events.rs:1-72`; `src-tauri/src/commands.rs:565-584`, `:1800-1990`;
  `src-tauri/src/reconciliation.rs:990-992`; `crates/espansoconfig-core/src/persist/save.rs:1167`;
  `crates/espansoconfig-core/src/watch/engine.rs:241-252`; `src/lib/browser/observationTransitions.ts:1195-1215`;
  `src/lib/browser/workspace.svelte.ts:4640-4665`; `src/lib/browser/matchEditor.ts:2660-2667`;
  `src-tauri/tauri.conf.json:5`; the harness `/private/tmp/espansoconfig-harness-2d-6-6c-2/launch.sh` (all) and its
  directory listing; `/private/tmp` listing; Tauri 2.11.5 from the cargo registry: `scripts/core.js`,
  `scripts/ipc-protocol.js`, `src/event/mod.rs:165-235`, `src/app.rs:1658`, `:1773-1779`, `src/ipc/mod.rs:43`, `:543`.
- **Not run:** no `cargo`, no `npm`, no launch (the brief forbids them). `cargo fmt --check`'s failure is taken
  from the brief and is consistent with the unformatted lines visible at `probe.rs:847`, `:858`, `:879`, `:947`.
  The real corpus was not opened.

## VERDICT

**Adopt, prune and repair the existing instrument; do not rebuild it from nothing; keep it uncommitted; and
make the review of the step that finishes it *the* instrument review — one review, fixed once, closed.** The
instrument is closer to what item 7 needs than the brief suggests: the Rust command counter belongs in
`probe.rs` as a wrapper around the handler it already owns, and the page-side **event** spy is possible
after all, because Tauri exposes its callback table as a mutable `Map` (`core.js:64-66`) and every event
delivery goes through it (`event/mod.rs:223-235`). But the instrument has defects the brief did not list,
and three matter for what a reading may claim: the snapshot state is one global shared by the keep-alive and
`shot()`, so a `webview=written` line can report the wrong request; `probe_lock_other` changes permissions
by pathname and so opens a **fifth** rebinding the "four" disclosure does not cover; and every harness bundle
carries the **shipped app's bundle identifier**, so probe launches write the owner's real app's WebKit
storage. No instrument writer reaches `config/`, so "real external writes under both roots" cannot be read
with today's instrument.

2d-7 is cut into **ten steps**. Two small production corrective steps come first, so that the reading sees
settled behaviour: the `stale` ruling and fix, and three presentation fixes. Then two instrument steps, the
second carrying the instrument review. Then four driven reading steps, which prefer a visible window and
fall back to a named hidden one. Then **one owner-present session**, which no driven run may simulate: real
foregrounding, real keyboard and pointer, the copy under a gesture, and the visual judgements. Last, a
consolidation step writes the matrix with every state marked *reached*, *constructed* or *unread*, and
re-derives the baselines. 2d-8 keeps item 8's deletion scope, plus a longer file list than any record now
names and the `CLAUDE.md` §6 rewrite.

### Q1 — Adopt, review, rebuild, or replace; and whether any of it is committed

**Ruling: (c) adopt, prune and repair. Keep "never commit". Format `probe.rs` in 2d-7-3, so every gate,
`cargo fmt --check` included, can exit 0 with the instrument present.**

*Why not (b), a smaller rebuild.* The 2d-7 matrix is largely the 2d-6 cases re-run against counters: the
`external-*` cases for the eight surfaces, `status-*`, `foreground-activate` and `lifecycle-delivery`
(`probe.ts:5010-5097`). A rebuild would rewrite and re-review them for nothing. The kernel is the part worth
reviewing hard: the recorder (`:543-588`), the substitutions (`:590-778`), `pause`/`hold` (`:944-951`,
`:4089-4094`), `shot`/`keepAlive` (`:2194-2217`, `:4028-4063`), `startProbe` (`:5179-5210`), and all of
`probe.rs`. **Prune** the cases the step-10 matrix does not name, so the review is not spent on dead plans.
Keep the pruned file at `/private/tmp/2d7-probe.ts.orig` as the reference copy, which puts one more file on
2d-8's list.

*Why not commit.* Committing the hook commits `probe::register_with_probe` into `main()` (hook diff,
`main.rs:266-269`). Every normal build would then register twelve probe commands in the shipped binary,
guarded only by an environment variable (`probe.rs:284-288`, `:730-732`), and would link the raw
Objective-C snapshot code. That is a shipped-surface change, not a bookkeeping choice. The module itself
refuses a feature flag (`probe.rs:6-9`), and this consult does not overturn that. Committing would also make
2d-8's deletion a reviewable diff, but it buys nothing the next paragraph cannot buy more cheaply.

*What replaces the missing history.* In 2d-7-4, when the instrument review is accepted, record the SHA-256 of
the four instrument paths and of `launch-7.sh` in the 2d-7-4 notes. Every reading launch already records the
binary's hash (`launch.sh`, `binary.sha256`). Each reading step also prints the four source hashes in its
notes. "This reading ran on the reviewed instrument" then becomes a comparison of hashes, not a claim.

*Interactions.*
- **The `5 insertions(+), 1 deletion(-)` invariant stays.** Every change goes into `probe.rs`/`probe.ts`,
  including the counter, which wraps the handler `register_with_probe` already installs (Q3). None goes into
  `main.rs`/`main.ts`.
- **`AUTOCLAUDE_PREFLIGHT_DIRTY`** keeps naming the same four paths. Nothing new is added under `src/` or
  `src-tauri/src/`. The new script, fixtures and tools live under the harness root.
- **Never `git stash`** stands, and every worker brief says so.
- **fmt.** Run `rustfmt --edition 2021 src-tauri/src/probe.rs` in 2d-7-3, on that file only. The gate is then
  honestly green, and a red gate that everyone has learned to ignore disappears. Leaving it to 2d-8's deletion
  would keep `cargo fmt --check` red for the whole of 2d-7, which is exactly how a real regression hides.
- **Baselines.** They are still normalised by subtraction from a pristine `git archive HEAD` copy
  (`PROGRESS.md:233`). The instrument's Rust share becomes non-zero once 2d-7-3 adds its parity test.

### Q2 — What "reviewed instrument" means concretely

**Ruling: the review of step 2d-7-4 is the instrument review. It covers the whole instrument (both probe
files, the hooks, `launch-7.sh`, the tools and the fixtures) and nothing else. It runs once, under the
workflow's one-review rule; its blockers are fixed and the shakedown is re-run; the step closes. Its
acceptance is the checklist below. Every item can be checked by `rg`, by a test or by a shakedown
transcript, and none is a matter of prose.**

**Who and when.** It is the autoclaude reviewer for 2d-7-4: the fallback agent until Codex returns. It is not
a separate phase and not an item in this consult record's review. 2d-7-3's own review covers only 2d-7-3's
Rust diff. It is not the instrument review, and it may not raise page-side items; those wait for 2d-7-4.

**What stops a repeat of the 2c-5-5a tail.** That tail was *prose about its own review history*
(`2c-5-5a-instrument-rebuild.md:2160-2167`). Three rules stop it here:
- the instrument record is a table of checks, each with its command and its observed output, and carries no
  narrative of the rounds;
- a fix to a review finding is not reviewed (`CLAUDE.md` §7);
- a finding about the record's wording is corrected in place and never commissions anything (§7, "records
  are records").

**The acceptance checklist.** 2d-7-4's notes must show each item with its evidence.

1. **Command parity is enforced by a test.** A `#[cfg(test)]` test in `probe.rs` reads `main.rs` and
   `probe.rs` with `include_str!`. It extracts the command paths from `register`'s `generate_handler!`
   (`main.rs:242-260`) and from `register_with_probe`'s (`probe.rs:213-243`), and requires every application
   command to appear in both. This replaces the unchecked sentence at `probe.rs:201-203`. What it cannot
   force: a command registered through some mechanism other than those two macros.
2. **One list of probe commands.** The Rust tally (Q3) classifies commands through a `const PROBE_COMMANDS`
   array, and the parity test requires that array to equal the probe half of the macro. `probe.ts`'s
   `PROBE_OWN_COMMANDS` (`:183-192`) is then checked against the Rust answer at run time: `startProbe` asks
   `probe_tally` for the list and prints `--- instrument MISMATCH` if the two differ. TypeScript cannot
   force this at compile time; the run-time line makes drift loud.
3. **The header and the comments tell the truth.** "Eight IPC commands" (`probe.rs:11`, `:193`, `:197`)
   becomes the real count. "Those last two are the dangerous part" (`:31`) now points at the snapshot
   commands while describing the writers. "The four probe commands are never recorded" (`probe.ts:174-175`)
   and "Every one of the four probe commands" (`:535-536`) are wrong. "`which` - `"second"` or `"third"`"
   (`:255`, `:368`, `:417`, `:465`, `:521`) no longer holds either. The check: `rg -n
   "Eight|four probe|eight commands" src-tauri/src/probe.rs src/probe.ts` finds nothing stale.
4. **Confinement.** The four disclosed rebindings stay written as open and accepted (`probe.rs:41-54`); the
   review checks that the words did not change. It also finds and closes or discloses the two that 9c added:
   - (a) `probe_lock_other` resolves the target, then calls `set_permissions` by pathname (`:929-930`), which
     follows a symlink planted at the final component. The fix: open with `O_NOFOLLOW` through
     `OpenOptionsExt::custom_flags`, then `File::set_permissions`, which acts on the descriptor.
   - (b) `probe_snapshot` joins `shots` without checking it (`:751`), and Cocoa's `writeToFile:atomically:`
     follows a symlinked `shots`. So the doc sentence "nothing is written outside a launch tree"
     (`:713-714`) is not enforced. The fix: canonicalise `shots` and require it to be `<launch>/shots`, or
     restate the sentence.
   A disclosure that stays open is listed as the fifth and sixth rebinding. It is never folded into "four".
5. **Snapshot attribution.** `SNAPSHOT_PATH`/`SNAPSHOT_STATE` are single globals (`probe.rs:553-556`).
   `shot()` sets `shotInProgress` but does not wait for a keep-alive request already in flight
   (`probe.ts:2194-2207` against `:4046-4057`). The keep-alive's completion handler can therefore write its
   image to the shot's path and set `written`, and the shot then reports success for an image requested
   before the shot. The fix: a monotonically increasing request token, carried into the completion's state
   (`written#<n>`), which `shot()` requires to match. The check: a shakedown that forces the overlap prints the
   token it waited for.
6. **Substitutions.** Every armed substitution prints `--- substituted` (`probe.ts:725`, `:742`, `:751`,
   `:763`, `:772`). The review confirms two things. First, no substitution answers with a rejected `fetch`,
   because Tauri would re-send the command through `postMessage` and the recorder would go blind
   (`ipc-protocol.js:59-70`; the rule is already at `probe.ts:603-606`). Second, `mayHaveWritten` runs the
   real save first (`:760-767`), so its launch has a committed write, which the Rust tally must show.
7. **The plan-wait is disclosed.** The listen and the first drain wait for `probe_plan` in every instrumented
   launch (`probe.ts:564-567`), which costs one IPC round trip. The shakedown prints that delay, and every
   reading that makes a claim about late-listener timing cites it.
8. **`pause`, `hold` and the keep-alive are policy, not defaults.** `pause` is capped at 400 round trips
   (`:66`, `:944-951`) and is itself IPC traffic that keeps the page busy. The keep-alive is switched on by
   the prefix `status-`/`foreground-` (`:4071-4073`). It becomes an explicit plan flag, and it is forbidden in
   the foreground and visible readings (Q6).
9. **A heartbeat.** A `--- beat t=` line about once a second while the plan runs. A launch whose beats stop
   while `alive-at-kill=yes` is a page stop, not a crash (Q6, P8-09/P9-06).
10. **The harness.** One `launch-7.sh` replaces the five per-phase scripts, which stay in the tree for 2d-8.
    It must:
    - give each launch its own bundle identifier, `cc.carpio.espansoConfig.probe.<launch>`, because
      `launch.sh`'s Info.plist uses the shipped identifier (`tauri.conf.json:5`);
    - take window captures only, and **never** `screencapture -x` of the whole screen in an unlocked session
      (`launch.sh`, `$tag-screen.png`), which would capture the owner's desktop;
    - provide a script-side writer for `config/` and a timed burst writer (Q8);
    - copy the fixtures by SHA-256 (Q7).
11. **Shakedown controls, each one launch.** Every launch goes to a fresh bundle path, and transcripts are kept.
    - A no-plan control: an empty transcript and zero tallies.
    - An agreement control: the Rust and page tallies are equal by name (Q4).
    - A spy control: one external write gives one emit and one delivery.
    - An identical-bytes control: the script renames an identical copy over the file, and the witness shows a
      new inode with the same size, which proves the witness separates "identical write" from "no write".
    - A forced snapshot overlap: the token matches.

The review's verdict is on this list. A finding outside it is written into 2d-7-4's notes as an open item
(§7, "a fix answers the findings the review named").

### Q3 — The Rust command counter

**Ruling: count application command dispatches by name, in `probe.rs`, by wrapping the handler
`register_with_probe` already installs. Pair the count with a read-only file witness and a wake-emit tally.
Never place a counter in `commands.rs`, `run_one_save` or the core.**

*Where.* `tauri::generate_handler!` produces a value of type `Fn(Invoke<R>) -> bool`
(`tauri/src/ipc/mod.rs:43`). `register_with_probe` builds it (`probe.rs:213`) and can wrap it:
`let inner = generate_handler![…]; builder.invoke_handler(move |invoke| { tally(invoke.message.command()); inner(invoke) })`.
`InvokeMessage::command` exists (`ipc/mod.rs:543`), and `invoke_handler` is a plain setter (`app.rs:1658`),
which is exactly what the probe already relies on. No production file is touched beyond the existing hook.

*What it counts.* Every dispatched application command by name, with a sequence number and a monotonic
timestamp, in a `static Mutex<Vec<(u64, String, u128)>>`. The probe's own commands are counted separately,
so `pause`'s hundreds of `probe_plan` trips cannot drown the tally. The reading distinguishes the six
**write** commands (`move_match`, `save_match`, `create_match`, `delete_match`, `save_raw_document`,
`duplicate_match`, as listed at `main.rs:205-208`) from the reads.

*Why dispatches and not commits.* Whether a save committed is already on the wire in the command's answer
(`committed`), which the recorder captures. What the page cannot see is a dispatch it did not record: a
`postMessage` fallback (`ipc-protocol.js:59-81`). A `run_one_save` or `save_document` counter would put
instrument code beside the non-reentrant lock and the ledger gate (`commands.rs:1916-1930`) for no
information the answer lacks.

*The file witness (`probe_witness`).* A read-only command. It walks `<launch>/xdg` and the launch's backup
root with `symlink_metadata`, which never follows a link, and returns, for each entry, the relative path, the
inode, the size and `mtime`/`ctime` in nanoseconds. It never opens a file for writing. This is what separates
the three cases:
- **no write:** the inode and `ctime` are unchanged;
- **an identical write:** a new inode, because `save_document` commits by rename, with the same size, and the
  script's closing SHA-256 is the same;
- **a transient write:** a new inode or `ctime`, with the same final SHA-256.

The final bytes alone cannot separate these cases (`phase-2c-5-7-removal.md:47`).

*The wake-emit tally.* Wrap `crate::events::wake_emitter(handle)` (`events.rs:67-71`) in a counting
`Arc<dyn Fn>` and install it with `WorkspaceSession::install_wake_emitter`. That is a replacing setter
(`commands.rs:581-583`, `reconciliation.rs:990-992`). **It must not be installed with `Builder::setup`**:
that is also a replacing setter (`app.rs:1773-1779`), so a probe `.setup` would silently discard `register`'s
emitter installation (`main.rs:236-241`). Install it from `Builder::on_page_load`, which `register` does not
set, and guard it with a `OnceLock`. The shakedown's spy control proves it was installed.

*How it is read.* `probe_tally` returns the tallies and the witness as JSON, and the page prints them as
`--- tally <tag> …` lines at each checkpoint and before `--- end`. There is no print at quit: a killed
process prints nothing.

*Why it cannot become a writer.* The wrapper calls `inner(invoke)` exactly once and does nothing else. The
witness only reads metadata. Neither mentions `WorkspaceSession` except to install the emitter, which takes
only the queue's own wake mutex (`reconciliation.rs:991`). **What Rust forces:** nothing about any of this.
The type system would let the wrapper call anything in the crate. **What the review forces:**
`rg -n "save_document|replace_file_atomically|replace_locked_file|run_one_save|begin_commit|\.lock\(\)" src-tauri/src/probe.rs`
must find only the probe's own statics' locks. That is a check the review item names, not a guarantee.

### Q4 — The frontend invoke/event spy

**Ruling: observe a delivery by wrapping the listener's entry in `window.__TAURI_INTERNALS__.callbacks`, keyed
by the `handler` id the recorder reads from the `plugin:event|listen` request. Reconcile Rust against page by
name. Treat a disagreement as an instrument failure, except where the direction names a delivery fact.**

*Feasibility, which the brief did not establish.* `invoke` and `runCallback` are non-writable, but core.js
publishes the callback table itself: `Object.defineProperty(window.__TAURI_INTERNALS__, 'callbacks',
{ value: callbacks })` (`core.js:64-66`), a `Map` whose entries are mutable. Every event reaches the page as
`runCallback(listener.handlerId, eventData)` (`event/mod.rs:223-235`), which is `callbacks.get(id)`
(`core.js:39-41`). The recorder already parses the `listen` request's body (`probe.ts:560`). When the
command is `plugin:event|listen` and the event is `workspace://reconciliation-ready`, the spy runs
`callbacks.set(id, wrapped)` synchronously, before the request is issued, so no delivery can precede the
wrap. `wrapped` counts, prints `--- delivered epoch=… seq=… t=`, and calls the original. The argument name
`handler` is my reading of Tauri's JS API and is **not verified here**: the spy control prints the parsed body
on its first launch. If `callbacks` is not a `Map`, the spy prints `--- spy unavailable` and every
delivery claim in that launch is void. The property is documented as "just for debugging purposes"
(`core.js:63`), so it holds for the pinned 2.11.5 only.

*Reconciliation.* At each checkpoint, compare the Rust dispatch tally against the page recorder, per
application command name.
- **Equal:** the transport was seen whole.
- **Rust > page:** a command crossed outside `fetch`, which after a rejected fetch is the `postMessage`
  fallback (`ipc-protocol.js:59-70`), or a probe name is missing from the page's list. **The launch is
  instrument-void**, is re-run, and makes no claim about the application.
- **Page > Rust:** only for commands Rust never dispatches through the application handler (`plugin:event|*`)
  or for a substitution that never issues (`listenRefused`, `probe.ts:724-727`). Any other name is
  instrument-void.

Events are compared the same way: **Rust emits** against **page deliveries**.
- **emitted = delivered:** delivery was observed.
- **emitted > delivered:** an application fact, and a reportable one: a wake emitted and not delivered (page
  stopped, listener absent, or epoch churn). It is written down, and it is never a failure of the reading.
- **delivered > emitted:** impossible, so instrument-void.

*"Command count zero on every no-write path" (item 7), exactly.*
- **Commands:** the six write commands named in Q3. Reads are allowed and printed. The witness must also show
  every file under `<launch>/xdg` and the backup root unchanged (inode and `ctime`), except the files a
  probe or script writer changed, which must equal the witness taken right after that writer returned.
- **Window of time:** from the checkpoint taken just before the path's first action to the checkpoint taken
  after the transport has been quiet for `IPC_QUIET_MS` (`probe.ts:216`) **and** at least 2 s have passed,
  so a debounced echo would have landed.
- **Paths:**
  - an external change arriving at each of the eight open surfaces;
  - compare, copy, keep and cancel on each;
  - the reload's first step;
  - recovery offered but not confirmed;
  - a disabled send pressed through `pressDisabled`;
  - a locale switch with a surface open;
  - each acknowledgement press;
  - every refusal arm;
  - self-save suppression **after** the save's own single commit;
  - workspace reopen;
  - add and remove observed.
  Each path's line reads `writes=0 witness=unchanged(except …)`.

### Q5 — Answer substitutions and constructed states

**Ruling: substitutions stay allowed, under a three-way classification: *reached* (real disk, real answers),
*reached under a held answer* (a `delay` substitution only: real bytes, real answer, probe-chosen timing) and
*constructed* (any substitution that changes an answer's content). A constructed state is never credited as
reached. Under item 7's last sentence it is named **unreachable by the disk, drawn from a substituted
answer**.**

Reasons.
- A `delay` changes when the page learns something and never what it learns (`probe.ts:769-776`). It is
  the only honest route to "late old callback" and to the adoption race arms, and the Rust tally and the
  witness still show the real backend behaviour.
- `mayHaveWritten`, `listenRefused`, `epochZero` and `discardOnce` rewrite content (`:708-712`, `:724-727`,
  `:741-755`), so what they prove is that *the renderer draws that state*. That is a mounted-test-grade claim
  made in a real webview, not evidence that the state arises.
- The wording is 9c's, kept: "the cause of that state is the probe's, never the disk's" (`:600-601`).

Two restrictions:
- A plan that makes a no-write claim may arm only `delay`.
- No substitution may be armed in the foreground reading or in any owner-present step: the owner reads a
  window, not a transcript, and cannot see a `--- substituted` line.

### Q6 — A visible window when the screen may be locked

**Ruling: "visible" means all three of the following at the moment of the claim. A driven step checks the
lock first. If the screen is locked, it runs its hidden-window half, names every visual claim unread, and does
not stop the phase. The foreground reading, the real input and the visual judgements need the owner present
and cannot be run by a driven session.**

"Visible", in checkable terms:
1. `CGSSessionScreenIsLocked` is absent or false. 2d-6-10 read this key (consolidated §2.6), and the script
   prints it.
2. `screencapture -l <windowid>` succeeds and the image is not the lock screen. `launch.sh` already attempts
   this; it answered "could not create image" when locked (consolidated §4).
3. The transcript shows `visibilityState=visible` at the checkpoint (`probe.ts:4940-4941` prints it).
   `hasFocus()` is required only where focus is the claim.

A person's eyes are required only for a *visual judgement*: fold position, wrapping, whether a disabled
control looks disabled, near-synonym labels. Those claims are made by the owner in step 2d-7-9 and recorded
as the owner's.

*Driven steps (2d-7-5 … 2d-7-8).* These steps measure transport, tallies, the witness and the DOM text,
which a hidden window does measure. Each launch records the lock state. The keep-alive may run **only** in
hidden launches, and it is disclosed. **In a visible launch it is forbidden**, because its snapshot every
second is exactly what stops the occlusion stop from happening (`probe.ts:4035-4041`). A visible launch that
used it could not tell a live page from a kept-alive one.

*Real input without the owner.* When the session is unlocked, OS-level synthesised events do go through the
window server as real input: a `CGEvent` posted by a small Swift tool beside `tools/winid`, or System Events
`key code`/`click at`. These may carry the Tab/Enter and pointer readings in a driven but unlocked session.
Three conditions apply:
- the page prints `event.isTrusted` for each event;
- the tool needs Accessibility permission, so the owner must grant it once;
- a locked screen makes it impossible.
Whether WebKit counts a `CGEvent`-posted click as user activation for `navigator.clipboard.writeText` is
**unverified**. The copy reading therefore stays with the owner (5.1 item 4). The paste into another app,
and a judgement that it holds the draft, are the owner's.

*The silent stops (P8-09, P9-06).* The heartbeat (Q2 item 9) makes the next one diagnosable. The rule
follows from it:
- a launch without a terminal line makes **no claim at all**;
- its last beat and `alive-at-kill` are recorded as a host event;
- it is re-run under a new launch name.
Nothing obliges 2d-7 to explain the two historical stops.

### Q7 — Hard fixture shapes (R38, ruling 38)

**Ruling: carry all fifteen `CLAUDE.md` §4 fixtures byte-exact, and retire 7c's shaped-after set except
where a writer needs a successor revision of a hard file. What closes R38's window half: each of the fifteen
drawn in the raw **viewer** and on at least one external-conflict panel, with a zero-write witness, and a
sample in ES. Each fixture also has a hard shape under `config/`.**

- *Copy.* `launch-7.sh` copies from `crates/espansoconfig-core/tests/corpus/synthetic/<name>` into the
  harness `fixtures/` with `cp -p`, and records the SHA-256 of the source and of the copy, which must be
  equal. It records the launch file's SHA-256 before the launch and after the kill.
  `tests/corpus_integrity.rs` pins only the committed copies. The harness copies are pinned by this hash
  comparison, which `bytes.txt` prints. **A mismatch voids the launch.** The fifteen files exist
  (`ls` of the synthetic directory, 2026-09-23).
- *Per fixture.* Place it as `match/conflict.yml`. Open the raw viewer. Deliver one external change: a script
  writer renames a successor in which one trigger's `replace` is changed. The successor is **generated by
  the script with a byte-level edit that leaves the fixture's line endings, BOM and final-newline state
  alone**, and it is hashed. Draw the resulting conflict panel on the match editor, or on the raw viewer's
  refresh where the file has no editable match. Take the witness.
- *What may be claimed.* Only that the file's text was drawn and matched the bytes, compared out of app by the
  verbatim tool. That covers the raw viewer, `SourceText`, and the disk text on the conflict panel.
- *What may not be claimed.* Any edit's byte-exactness over these shapes (that is the Phase 0 gate's, not
  the window's). Any claim about sends not made. Anything about a raw **editor** over a file holding `\r`,
  which is refused by design (`CLAUDE.md` §6).
- *Which fixtures draw what.* Some fixtures may not project a match (e.g. `single-line-no-line-ending.yml`).
  Those are read in the viewer only, and the record says so per fixture.
- *Both roots.* `config/default.yml` gets a CRLF+BOM synthetic config of neutral content, and one external
  change is delivered there. The fifteen are match-file shapes and are not forced into `config/`.
- *Languages.* All fifteen in EN. Three in ES: `crlf-line-endings.yml`, `unicode-offsets.yml` and
  `file-comments-and-mixed-endings.yml`, chosen because their drawing interacts with the ES layout.

### Q8 — The state list

**Ruling: four driven groups and one owner group. Each state is pre-classed below. The classes are
predictions, and the reading records what actually happened.**

**G1 — delivery, watcher and counters (2d-7-5). Driven.**
- **Both roots.** A script writer renames a successor over `match/conflict.yml` and over
  `config/default.yml`. Today no probe writer reaches `config/`: every target tail is under `match/`
  (`probe.rs:77`, `:86`, `:864`). *Reached.*
- **Burst.** The script writes three versions 60 ms apart, which should coalesce into one observation with
  the final bytes. A control writes two versions 600 ms apart, which should give two. The timing is the
  script's own, and each line prints its offset. Acceptance: one or two emits as predicted, the delivered
  drain's revision equal to the final file's hash, and the witness consistent. The 150–300 ms window is the
  engine's. This reading shows it only at two points and must not claim the boundary. *Reached.*
- **Self-save suppression.** One `save_match` from the editor. Acceptance: the write tally is 1, one inode
  change, and no `Changed` observation for our own revision in the drains of the following 2 s. *Reached.*
- **Raw-view automatic refresh.** An external change with the viewer open gives a refresh drawn with the new
  text, and writes stay at 0. *Reached.*
- **Add and remove.** `probe_extra_writer` and `probe_remove_extra`, plus a script-side create and remove under
  `config/`. Note that the extra writer writes in place, not by rename (`probe.rs:877-885`), so the watcher
  may see a partial file. That is a *real* foreign-write shape, and the record says so. *Reached.*
- **Workspace reopen with a late old callback.** Arm `delay` on one drain. Make an external write, reopen the
  workspace while the delayed answer is held, then release it. Acceptance: the stale epoch's answer installs
  nothing, and the tallies show it. *Reached under a held answer.*
- **Emits against deliveries** at every checkpoint (Q4). The wake is thereby observed, closing 5-7b WR §5
  item 1.
- **The watermark's advance** (5-7b's leftover). It is read from the drains' `afterSequence` (`probe.ts:836-841`).
  *Reached.*

**G2 — surface retention and conflict timing (2d-7-6). Driven.**
- **Retention.** Each of the eight surfaces is opened with a draft, request or candidate. An external change
  arrives, and the retained value is read back from the DOM. The line reads `writes=0` with an unchanged
  witness. *Reached.*
- **Disabled-state timing.** A conflict arrives while the send is disabled in flight: `delay` on the save's
  answer and a writer during the hold. *Reached under a held answer.*
- **Enabled-state timing.** A conflict arrives with the send enabled and unpressed. *Reached.*
- **The locale switch** with each surface family open (entry 35). *Reached.*

**G3 — choices and adoption arms (2d-7-6's second half, or 2d-7-7 if the worker's session budget runs out).
Driven.**
- **Compare, keep, reload (two steps) and recovery** on each family. *Reached.*
- **Copy.** Pressed by `click()`, it reads `draftCopyFailed` in a late launch (consolidated §4). It is
  recorded as such, and the copy under a real gesture goes to G5.
- **The reload's `installed` arm.** *Reached.*
- **`alreadyThere`.** A delayed `reload_document` answer, during which a drain installs the same revision.
  *Reached under a held answer* if the race lands. Otherwise it is named unread.
- **`refused`.** A delayed reload answer and a third writer before the release. *Reached under a held
  answer*, or named unread.
- **Committed-but-reprojection-failed.** **Named unreachable up front.** The save must commit and the
  reprojection fail, and no synthetic disk change produces that between the rename and the reprojection
  inside one command. It may be *constructed* only by an answer substitution, which Q5 would label
  constructed. The consult does not require that construction.
- **The open-surface refusal** (the removal review's first unreachable state). It has been drawn since 2d-6
  (`RESTORE_REFUSAL_KEYS`, `probe.ts:104-117`). *Reached.*

**G4 — status states left unread by 9c (2d-7-8). Driven.**
- **Reached:**
  - the retry enabled and pressed, after a real watcher failure provoked by `probe_lock_other` and then
    restored;
  - `stale` from a `Named` pending row;
  - six of the eight panels' acknowledgements;
  - a refused acknowledgement press;
  - empty-workspace retention (remove both documents);
  - `projectionReplaced` reactivity.
- **Reached under a held answer:**
  - the outlived route acknowledgement and its exits note;
  - `pathDrift.changed`;
  - the two surface notes.
- **Constructed or named unreachable:**
  - `noTransport` needs the transport to be absent, which a live webview has. It is constructed (by
    `listenRefused`, as 9c did) or named unreachable.
  - The 9b-1 §8.3 release-path sequence is **named unreachable**, citing 9b-1's own judgement.
- **After 2d-7-1 only:** `stale` behind a panel alone, and 9b-3 §6 item 1 with its §8 recheck.
- **Owner:** the `visibilitychange` arm, the hidden-state refusal and `pagehide`/`unload` on quit go to G5.

**G5 — owner present, unlocked, visible (2d-7-9). Not driven.**
- **Foreground**, with no keep-alive and no substitution. The window is occluded by another window for more
  than 10 s, and the transcript shows the page stopped (the beats stop). The owner clicks the Dock icon.
  Recorded:
  - whether `focus` and `visibilitychange` arrive;
  - whether they arrive in one task (the offsets of the page-event lines);
  - whether a drain follows, and how many;
  - whether the beats resume.
- **Tab and default activation** through a surface's controls: `isTrusted` is printed, focus order is read
  from `document.activeElement`, and Enter activates the default.
- **Pointer hit-testing** on one control per family and on the status route.
- ***Copy my text*** pressed, then pasted into TextEdit. The owner confirms that the pasted text is the draft.
- **Quit** with ⌘Q: `pagehide`/`unload` are observed through lines written by a listener.
- **Visual judgements**, at the default window size, stated:
  - the C1 choice row below the fold on each family, in EN and ES;
  - the fixed disabled status control;
  - the `SourceText` marker;
  - the ES row mark;
  - the close and keep labels.
- **A representative visible re-take:** one C1 panel per family, in EN and ES, compared against its hidden
  twin. This is the falsifier for the hidden method.

**Unreachable up front:** committed-but-reprojection-failed; the 9b-1 §8.3 sequence; the "general wake
delivery" and "full native matrix" claims, which no set of launches can make (`phase-2d-6-design.md:267`).

### Q9 — English and Spanish

**Ruling: the full matrix in EN. In ES, every distinct drawn sentence at least once, checked verbatim against
`es.json` out of app, plus every locale switch with a surface open. 2d-7 is a bilingual *reading*, not R35's
bilingual *review*. It produces the inventory a native-speaker review would need; it performs none.**

- The state × language product doubles a matrix that is already the longest this project has run, for little
  evidence. A sentence drawn correctly in ES in one state is drawn by the same accessor in the others; the
  EN pass shows that the state is reached, and the ES pass shows that the words exist and fit. **Exception:**
  every visual judgement in G5 is made in both languages, because layout is where the two differ (the fold
  at 0 of 50 px in ES, consolidated §2.2; the ES row mark).
- The close and keep near-synonyms (11b §6 item 9): the reading **surfaces** them to the owner in G5 and
  records the owner's words. It does not decide them. Changing them is a wording change that needs its own
  ruling, and it goes to a later phase (Q10).
- The ES row-mark wrap is fixed in 2d-7-2, and G5 then confirms it visually.
- R35 stays open. A reading "is not a review" (9c N §6 item 6). No native speaker is available to this
  workflow, and a model is not one. 2d-7-10 writes the ES sentence inventory, with the key, the drawn text and
  the launch, as the input R35's review would need. That review is owed by the owner before Phase 5's
  release, not by 2d-7 or 2d-8.

### Q10 — The handed-on items

**Ruling: the `stale` pair is ruled on and fixed **before** anything reads `stale`, in step 2d-7-1. Three
presentation defects are fixed before the visible reading, in 2d-7-2. Both are steps **inside** 2d-7 that
this consult creates with their own acceptance, which §7 permits: they are not a corrective phase commissioned
by a review, and they re-review nothing. Everything else is either read by 2d-7 or left alone.**

A step created by a consult is not the §7 thing §7 forbids. §7 forbids phases created *to review a fix*, and
lettered re-review phases. A consult cutting its own phase into steps is the ordinary procedure; 2d-6's
consult did the same (`phase-2d-6-design.md`). Reading `stale` today would record states that 2d-7-1 is about
to change: a `stale` mark surviving a `writtenHere` release (`observationTransitions.ts:1204-1206` marks it;
`workspace.svelte.ts:4652-4661` deletes the retained reading and delivers `writtenHere` without clearing
it). That is exactly "a reading records a state about to change".

| Item | First sort | Ruling |
|---|---|---|
| "Six surfaces" undercounts | L | **Confirmed L.** Comments only, and no reading depends on them. A later comment pass (Phase 3's first step, or wherever the next sweep falls) |
| `matchEditor.ts:2664` names `tSupersededEvidence` as a renderer | L or C | **Overturned to 2d-7-2.** It is a false caller claim, `CLAUDE.md` §5's worst defect class, still standing at `matchEditor.ts:2664-2665` after 11b fixed five siblings. One line, in a step that already edits components |
| Refusal wording repeats | C, read by W | **Read as is, and the fix goes to a later phase.** Changing the words needs a wording ruling, and the reading records what is drawn |
| Unused accessors | L | **Confirmed L.** No counter or spy needs them gone |
| Close and keep near-synonyms | W | **W, surfaced only** (Q9) |
| `cargo fmt` on `probe.rs` | depends on Q1 | **2d-7-3** |
| No native-speaker review (R35) | W/L | **L (owner, before Phase 5).** 2d-7-10 writes the inventory |
| `stale` survives a `writtenHere` release | C | **2d-7-1**, before any reading |
| A hold during an automatic read leaves `stale` with nothing to acknowledge (9b-3 §6 item 1) | C | **2d-7-1, joined with the row above.** One ruling on what `stale` means while a surface is open, and one fix. If the ruling needs 9b-3 items 2–3 (the same-bytes merge, `observationRetained` on the automatic path), 2d-7-1 records that and those two go to a named later phase. They stay out |
| Composition-check blind spots | L | **Confirmed L.** No spy obligation. The spy lives in `probe.ts`, which the check never scans |
| `AppShell` last-document removal and the save-origin loops EN-only | C or W | **C, in 2d-7-2**, as mounted ES cases. They are test-only and cheap. The window is not ES evidence for a mounted gap |
| Visible-window foreground reading | W | **2d-7-9** (owner) |
| Every activation costs one drain | W | **2d-7-9 measures it**, through the Rust tally around each activation |
| No window-close `dispose()` | L | **L.** 2d-7-9 *observes* `pagehide`/`unload` on quit. It builds nothing |
| A disabled status control drawn like an enabled one | C | **2d-7-2**, before the reading, with a stylesheet or mounted assertion |
| A long ES row mark breaks mid-word | C | **2d-7-2** |
| 9c's unread states | W | **G4** |
| `P9-06`/`P8-09` | W (instrument) | **The instrument detects the next one** (heartbeat). It does not explain the past two |
| The first `SourceText` is the trigger field (9c §6 item 5) | W (instrument) | **2d-7-4 review item.** The probe's selectors must name the field, not the first match |
| `CLAUDE.md` §6 to gain the `pause` cap and keep-alive facts | W/L | **2d-8**, which rewrites §6's instrument bullet anyway. The occlusion fact is a host fact and survives there. `pause` is an instrument fact and goes with the instrument |
| Same-bytes coalescing into an outlived origin; the automatic path not asking `observationRetained` | C/L | **L**, unless 2d-7-1's ruling needs them (row above) |
| "Nothing draws either today" | L | **L**, comment pass |
| The `acknowledgeSnapshot` dead end | C | **L.** It is a model change (a "hold ended" delivery), and substantial new work. Not 2d-7 |
| 9b-1 §8.3 release path | W/L | **Named unreachable** in the 2d-7-10 matrix |
| `SourceText` `.invisible` wraps inside a line | C, then W | **2d-7-2** (a CSS fix plus a stylesheet assertion, or the comment corrected), confirmed visually in 2d-7-9 |
| C1 choice row below the fold | W, then C | **W only.** It is measured at the default size in 2d-7-9. Whether it is a defect is the owner's ruling, and any fix goes to a later phase |
| A CRLF-only disk text named on neither panel | C | **L.** A display decision (D2u-adjacent), not 2d-7's |
| `main.rs:214-227` `"permissions": []` comment | L | **2d-8**, by record |

**2d-7 must leave alone:** the refusal wording, the unused accessors, the composition check, `dispose()`, the
`acknowledgeSnapshot` model, the CRLF display, the fold, the labels, and `main.rs`'s comment.

### Q11 — The step cut

**Ruling: ten steps, in dependency order (next section). The `cargo fmt` failure is answered by 2d-7-3.
The baselines are re-measured by every step as the workflow requires. The instrument's share is re-derived
from a pristine `git archive HEAD` copy at 2d-7-4 and at 2d-7-10. The corrective work sits at 2d-7-1 and
2d-7-2, before the instrument steps, because readings depend on them and the instrument steps do not.**

### Q12 — What goes to 2d-8

**Ruling: 2d-8 keeps item 8's scope and owes no evidence. 2d-7-10 hands it an explicit deletion manifest and
the carried-forward list. A state left unread by 2d-7 is recorded as **permanently unread by a window
harness**, not moved to 2d-8. No §5.7 item becomes 2d-8's except the `main.rs` comment and the `CLAUDE.md` §6
rewrite.**

The deletion manifest. 2d-7-10 verifies each entry exists with `ls`, and 2d-8 deletes it and verifies it is
gone:
- `src-tauri/src/probe.rs`, `src/probe.ts`, and the two hook lines in `main.rs` and in `main.ts`;
- the harness tree `/private/tmp/espansoconfig-harness-2d-6-6c-2/`, with every launch, bundle copy,
  fixture, tool and script;
- **every** pre-edit copy. The consolidated record names three (consolidated §5.4). This consult found
  seven related files: `/private/tmp/6c2-probe.rs.orig`, `/private/tmp/6c2-probe.ts.orig`,
  `/private/tmp/9c-probe.rs.orig`, `/private/tmp/9c-probe.ts.orig`, `/private/tmp/10-probe.ts.orig`,
  `/private/tmp/espansoconfig-8c-probe.ts.before` and `/private/tmp/espansoconfig-8c-section.ts`, plus
  2d-7's own `2d7-probe.ts.orig`. `/private/tmp/espanso.err` and `/private/tmp/espanso.out` are of unknown
  provenance: 2d-8 checks them and does **not** delete them on a guess;
- the per-launch bundle identifiers' WebKit data, which is a new obligation created by Q2 item 10.
  `~/Library/WebKit/cc.carpio.espansoConfig.probe.*` and any matching `~/Library/Caches` entries: 2d-8 lists
  them and removes them.

**Carried forward:**
- the four rebindings, plus the fifth and sixth if 2d-7-3 disclosed them rather than closing them;
- every *unread* and *constructed* state from the 2d-7-10 matrix;
- R38's residue: shapes read only in the viewer;
- R35;
- the fold and label rulings owed to the owner.

2d-8 also corrects `main.rs:214-227` (by record) and rewrites `CLAUDE.md` §6's instrument bullet. It keeps
the host facts (the occlusion stop and the keep-alive observation; the `localStorage`/bundle-identifier fact;
`screencapture` under a lock) and deletes the instrument facts.

---

### Corrections to the brief and to prior records

1. **Brief §3 and §5.3: "four pathname rebindings" is incomplete for the current instrument.** 9c's
   `probe_lock_other` resolves the target, then calls `std::fs::set_permissions` by pathname
   (`probe.rs:929-930`). `chmod` follows a symlink at the final component, which `rename` does not, so this is
   a target-final-component hole none of the four covers. `probe_snapshot` writes through an unchecked
   `shots` join (`:751`), so the doc claim "nothing is written outside a launch tree" (`:713-714`) is not
   enforced. The inheritance must be "four plus these", never "four".
2. **Brief §3 row "No event spy" implies that a delivery cannot be observed.** It can. `callbacks` is
   exposed as a mutable `Map` (`tauri-2.11.5/scripts/core.js:64-66`), and deliveries go through it
   (`src/event/mod.rs:223-235`).
3. **Undisclosed instrument defects the brief missed:**
   - (a) the keep-alive/`shot` race on the single snapshot state (`probe.rs:553-556`, `probe.ts:2194-2207`,
     `:4046-4057`). 2d-6 transcripts' `webview=written` lines are not proof that the named request's image
     was the one written;
   - (b) the harness Info.plist reuses the shipped identifier `cc.carpio.espansoConfig` (`launch.sh` against
     `tauri.conf.json:5`), so probe launches write the owner's real app's WebKit `localStorage`
     (`CLAUDE.md:233-234`);
   - (c) `launch.sh` takes a full-screen `screencapture -x` on every shot, which in an unlocked session would
     capture the owner's desktop;
   - (d) more stale counts: `probe.ts:174-175` ("the four probe commands are never recorded"), `:535-536`,
     `probe.rs:31` ("those last two"), `:193-197` ("eight").
4. **Item 7's "real external writes under both roots" is unreachable with today's instrument.** Every writer
   targets `match/` (`probe.rs:77`, `:86`, `:864`). The brief does not say so.
5. **A trap for Q3 that the brief does not name.** `Builder::setup` replaces rather than adds
   (`tauri app.rs:1773-1779`). A probe counter installed through `.setup` would silently remove the
   production wake-emitter installation (`main.rs:236-241`).
6. **`2d-6-window-readings-consolidated.md` §5.4** lists three `/private/tmp` pre-edit copies. Seven
   probe-related files exist (Q12). That record's "no record names a deleter" row should name 2d-8 and the
   full list; correct it in 2d-7-10.
7. **`CLAUDE.md` §6 places `save_document` in `persist/write.rs`.** It is defined at `persist/save.rs:1167`
   and re-exported from `persist/mod.rs:159`. The brief's drift note is right, and `CLAUDE.md` is wrong. That is
   a one-line record correction for 2d-7-10, not a review item.
8. **Brief §1 says "your final message IS the deliverable; write no file".** This commission asked for the file,
   so the file is written. Nothing else was touched.

### Handed-on open items — where each goes

| Item | Goes to | Reason |
|---|---|---|
| `stale` pair (11a §5 item 1; 9b-3 §6 item 1) | **2d-7-1** | A reading must not record a state about to change |
| 9b-3 §6 items 2–3 | **later phase**, unless 2d-7-1's ruling needs them | Substantial model work, not needed for reading |
| Disabled status control; ES row-mark wrap; `SourceText` marker; `matchEditor.ts:2664` comment; EN-only mounted cases | **2d-7-2** | Small, certain, and read afterwards |
| `cargo fmt` on `probe.rs`; confinement holes 5–6; snapshot token; counters; witness | **2d-7-3** | Instrument, Rust side |
| Spy; heartbeat; keep-alive policy; `launch-7.sh`; bundle identifiers; fixture import; the instrument review; the 9c `SourceText` artifact | **2d-7-4** | Instrument, page side and harness |
| Wake observed; both roots; burst; self-save; add and remove; late callback | **2d-7-5** | G1 |
| Retention; timing; choices; adoption arms | **2d-7-6** | G2 and G3 |
| R38 window half | **2d-7-7** | Q7 |
| 9c unread states | **2d-7-8** | G4 |
| Foreground; real input; copy gesture; quit events; activation-drain cost; visual judgements | **2d-7-9 (owner)** | Needs an unlocked screen and a person |
| Fold ruling; close/keep labels; refusal wording; CRLF-only display | **later phase** (owner rulings first) | Wording and display decisions, not readings |
| R35 native-speaker review | **owner, before Phase 5** | A process, not a step |
| Unused accessors; comment pass items; `acknowledgeSnapshot`; `dispose()` on close | **later phase** | Not 2d-7's subject |
| `main.rs` permissions comment; `CLAUDE.md` §6 rewrite; the deletion manifest | **2d-8** | By record, and because 2d-8 deletes what they describe |

### Risks, and what would falsify these recommendations

- **The spy depends on an undocumented property.** If `__TAURI_INTERNALS__.callbacks` is not the `Map`
  `runCallback` reads, or the listen body carries no `handler` id, the spy control fails. Delivery then falls
  back to the inference it is today, and the matrix must say so. *Falsifier:* 2d-7-4's spy control.
- **Hidden readings may not match visible ones.** G5's visible re-take is the falsifier. A difference in
  drawn text or controls between a hidden and a visible C1 panel voids the hidden method for the claims
  concerned, and those claims move to *unread*.
- **Synthesised events may not grant user activation, or may not be trusted.** Then real input is owner-only.
  *Falsifier:* `isTrusted=false`, or `draftCopyFailed` after a `CGEvent` click.
- **The owner may be unavailable.** 2d-7 does **not** close without 2d-7-9, unless the owner explicitly rules
  its items recorded unread. The driver must stop at 2d-7-9 as awaiting-owner, not simulate it.
- **The instrument review could grow a tail.** It is bounded by the checklist and §7. If the reviewer
  returns findings outside the checklist, they are open items, not blockers. If more than one worker session
  is needed to fix the blockers, that is evidence the prune was too shallow: the next step prunes further
  and does not re-review.
- **2d-7-1's ruling could be larger than two cases.** If "what `stale` means with a surface open" cannot be
  settled without the 9b-3 items 2–3 changes, 2d-7-1 records that. G4's stale-under-hold rows are then named
  unread, and the ruling goes to its own later phase. The rest of 2d-7 does not wait.
- **The witness could miss a write.** `ctime` changes on every write to an inode, and every rename produces a
  new inode. An app write that restored the same inode and a forged `ctime` is not a real threat model here.
  A write outside `<launch>/xdg` and the backup root would be invisible. The witness therefore also lists
  `<launch>/home`, and it cannot see anything elsewhere, which the record states.
- **Unverified here:** the name of the `listen` body's `handler` argument; whether the application issues any
  command at module-evaluation time, before `probe.ts` installs the recorder (the ordering argument at
  `probe.ts:166-167` was not re-derived); and the exact `cargo fmt` hunk count.

---

## The step cut, dependency-ordered

Each step is one worker in one session, and has one adversarial review under the workflow's rule. **All
steps:** never `git stash`; stage by path; the hook diff stays `5 insertions(+), 1 deletion(-)`; no real
corpus; every reading launch goes to a fresh bundle path with the language set through the picker.

**2d-7-1 — the `stale` ruling and fix.** Production model only: `observationTransitions.ts`,
`workspace.svelte.ts`, and the mounted and model tests.
- *Evidence:* the gates, with model tests in both directions, one of them shown failing first.
- *Acceptance:*
  - a written ruling (in the notes) defining `stale` while a surface is open;
  - a test in which a `writtenHere` release clears a `stale` mark that only the released reading set, and
    leaves one standing from another cause;
  - a test for 9b-3 §6 item 1 in which the file ends acknowledgeable or not `stale`, per the ruling.
- *Driven:* yes.

**2d-7-2 — the presentation and comment fixes.** Touches `SourceText.svelte`, the status-control components,
the row-mark CSS, `matchEditor.ts:2664-2665`, and the ES mounted cases for `AppShell` removal and the
save-origin loops.
- *Evidence:* the gates; a stylesheet or mounted assertion for each visual fix; module-count delta explained.
- *Acceptance:*
  - `rg tSupersededEvidence src/lib/browser/matchEditor.ts` shows no renderer claim;
  - a disabled status control carries a distinct disabled style, asserted;
  - the ES row mark carries `overflow-wrap`/`word-break` rules that keep file names whole, asserted;
  - the `.invisible` marker no longer wraps within a line, or its comment no longer claims that;
  - the new ES mounted cases pass.
- *Driven:* yes. There is no window claim; 2d-7-9 confirms visually.

**2d-7-3 — the instrument, Rust side.** Touches `src-tauri/src/probe.rs` only.
- *Delivers:* `rustfmt`; true header counts; the parity test and `PROBE_COMMANDS`; the dispatch tally;
  `probe_tally`; `probe_witness`; the wake-emit tally through `on_page_load`; the snapshot request token; the
  `shots` confinement; `probe_lock_other` through an `O_NOFOLLOW` descriptor; the fifth and sixth
  rebindings closed or disclosed.
- *Acceptance:*
  - `cargo fmt --check` exits 0 and `cargo clippy … -D warnings` exits 0, with the instrument present;
  - the parity test passes, and **fails** when one command is removed from either list (shown once);
  - `rg` for `save_document|replace_file_atomically|replace_locked_file|run_one_save|begin_commit` in `probe.rs`
    finds nothing;
  - `rg -c "\.setup\(" src-tauri/src/probe.rs` is 0;
  - the Rust test count delta equals the tests added.
- *Driven:* yes.

**2d-7-4 — the instrument, page side and harness, and THE instrument review.** Touches `src/probe.ts`, and
under the harness root `launch-7.sh`, the tools and the fifteen fixtures plus the `config/` fixture.
- *Delivers:*
  - `PROBE_OWN_COMMANDS` checked against Rust at run time;
  - the event spy;
  - the `--- tally` checkpoints;
  - the heartbeat;
  - keep-alive as an explicit flag;
  - the cases the matrix does not name pruned, with the reference copy kept;
  - per-launch bundle identifiers;
  - window-only captures;
  - the script-side `config/` and burst writers;
  - fixture import with SHA-256 checks;
  - the lock-state preflight line;
  - selectors that name fields (the 9c artifact).
- *Evidence:* the five shakedown controls of Q2 item 11, as transcripts, plus the checklist.
- *Acceptance:* every Q2 checklist item is shown with its command and output, and the SHA-256 of the four
  instrument paths and the script are recorded. **Its review is the instrument review, and there is exactly
  one.**
- *Driven:* yes.

**2d-7-5 — G1: delivery, watcher and counters.** Records only. The instrument is frozen, and its hashes must
match 2d-7-4's.
- *Evidence:* launches, in a visible window if the screen is unlocked and otherwise a named hidden one.
- *Acceptance:* one line per G1 row, each with its tallies, its witness and its class (reached, held or
  unread); emits equal deliveries, or each difference explained; zero launches with a Rust/page command
  mismatch, or each such launch voided and re-run.
- *Driven:* yes.

**2d-7-6 — G2 and G3: retention, timing, choices and adoption arms.** Records only.
- *Acceptance:* all eight surfaces retain their values with `writes=0` and an unchanged witness; each choice
  is read on each family; `installed` is reached; `alreadyThere` and `refused` are each marked *held* or
  unread; committed-but-reprojection-failed is named unreachable; the locale switch is read per family.
  EN in full; ES sentence coverage for these panels.
- *Driven:* yes. If the session budget runs out, G3 moves to a step numbered after it; it is not lettered.

**2d-7-7 — R38: the fifteen fixtures.** Records only.
- *Acceptance:* per fixture, the SHA-256 of source, copy, launch-before and launch-after; the viewer text
  verbatim against the file bytes; one conflict panel or the viewer's refresh; `writes=0`; the three ES
  fixtures; the `config/` CRLF+BOM file.
- *Driven:* yes.

**2d-7-8 — G4: the status states left unread by 9c.** Records only, after 2d-7-1.
- *Acceptance:* each G4 row is marked reached, held, constructed or unread, with its launch and tallies;
  `noTransport` and the 9b-1 §8.3 sequence are named as classed in Q8.
- *Driven:* yes.

**2d-7-9 — the owner-present visible session (G5).** Records only. It needs the owner, an unlocked screen and
Accessibility permission for the event tool.
- *Evidence:* the owner's statements, the window captures (`-l` only) and the transcripts.
- *Acceptance:*
  - the three conditions of Q6 printed at each claim;
  - the foreground rows answered (events, tasks, drains, resume after the occlusion stop, all without the
    keep-alive);
  - Tab, Enter and pointer, each with `isTrusted`;
  - the copy and paste confirmed by the owner;
  - quit events;
  - the visual judgements in EN and ES at a stated window size;
  - the hidden/visible re-take compared.
- *Driven:* **no.** The driver stops here, awaiting the owner.

**2d-7-10 — the consolidation.** Touches records only: the 2d-7 matrix, the ES sentence inventory, and the
2d-8 manifest and carried-forward list. It also corrects consolidated §5.4 and `CLAUDE.md` §6's
`save_document` location.
- *Acceptance:*
  - every item-7 clause and every §5.1/§5.2 row appears exactly once, with its class and its launch;
  - the four gates re-measured, with the instrument's share re-derived from a pristine `git archive HEAD` copy;
  - every entry on the deletion manifest verified to exist with `ls`.
- *Driven:* yes.

**To 2d-8:** the deletion manifest (Q12), the `main.rs:214-227` comment, the `CLAUDE.md` §6 rewrite, and
the carried-forward list. No evidence is owed. **Later phases:** the fold and label rulings, the refusal
wording, the CRLF-only display, 9b-3 items 2–3 (unless 2d-7-1 takes them), `acknowledgeSnapshot`, `dispose()`
on close, the comment pass, the unused accessors, and R35's native-speaker review.
