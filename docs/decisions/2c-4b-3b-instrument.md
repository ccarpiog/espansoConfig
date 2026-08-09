# Phase 2c-4b step 3b — the reapply instrument

Step 3c is the window reading 2c-4b-3 owes for six surfaces. **This step is not that
reading**; it rebuilds the external-writer harness `2c-4a-3c-5` deleted, extends it to the design
consult's Q7 mechanism — fixed **R0→R1 fixture pairs**, seeded whole and copied atomically over
`conflict.yml`, synchronized from the plan and never by wall clock — and then **drives every one of
the six write surfaces with it from a running WKWebView**, before any reading depends on it, exactly
as 2c-4a-3c-1 provoked a true `SaveResult::Conflict` before 3c-2 read anything.

**The recipe works.** Twenty-three launches, all six write surfaces driven, eleven fixture-pair cases
each byte-checked against what that case must leave behind, **four of those eleven also run in
Spanish**. A true `SaveResult::Conflict` reaches every one of the six surfaces; *Keep my draft* is
drawn and pressable on all five match surfaces and **absent on the raw editor in both languages**;
five positive cases produce a file byte-identical to the hand-authored post-reapply bytes; six
refusal cases leave the file byte-identical to R1 with **no `.espansoconfig-backups` directory in
existence**.

**The launch-case outcome claims of sections 3 to 5 are observed outcomes, and none of them is a proof
of mechanism.** This instrument presses controls, prints the strings the panels drew, and compares
bytes. Which internal tier, correspondence rule or adoption arm produced a given byte result is **not**
observable from a transcript; those are the hypotheses the cases were built around, and 2c-4b-1's
Rust-side tests are what carries them. Section 8 names each ambiguity case by case.

The rest of the record is a mixture, and the list below is **not exhaustive** — it is the set of
categories worth naming, so that a reader does not carry sections 3 to 5's standing across the whole
file. Statements that are **not** launch observations, marked as such where they appear: claims read
from the harness source rather than from a transcript (section 6, and the residual-IPC paragraph of
section 7); facts read from the **application's** own source, such as section 6.4's account of how
`MatchDeleter.svelte` seeds its session; the contemporaneous diagnoses of L01 and L04, whose causes the
retained artifacts no longer hold (section 3 and sections 6.2–6.3); inferences drawn from a launch
rather than stated by it, such as section 6.6's reading of L15's dump together with the fact that the
fix worked; and the gate results of section 7, for which no transcript was kept.

---

## 1. The harness, and where each file is

| File | What it is |
|---|---|
| `src/probe.ts` | the whole driver: the plans, the DOM walk, the transcript. **Temporary** |
| `src-tauri/src/probe.rs` | `probe_plan`, `render_probe`, `probe_second_writer`, `register_with_probe`. **Temporary** |
| `src/main.ts` | two hooks: `import { startProbe }` and `startProbe()` after the mount |
| `src-tauri/src/main.rs` | two hooks: `mod probe;` and `main()` calling `probe::register_with_probe` |
| `<scratch>/launch.sh` | one launch: the case table, the seed, a fresh bundle, the wait, the byte checks |
| `<scratch>/fixtures/` | three fixture files and five expected-bytes files (section 4) |
| `<scratch>/launches/<name>/` | per launch: `xdg/`, `xdg-before/`, `home/`, `espansoConfig.app`, `probe.log`, `probe.err`, `bytes.txt` |

`<scratch>` is
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad`,
outside the repository. **The owner's real configuration was never opened**: every launch points
`XDG_CONFIG_HOME` at a synthetic two-file tree this script writes and `HOME` at an empty directory, so
neither candidate `resolve_config_dir()` probes (`crates/espansoconfig-core/src/discovery.rs`) can
reach it.

**The harness is deliberately uncommitted, and at the moment this paragraph was written so are this
record and its review** — `git status` lists all six paths as modified or untracked. What 2c-4b-3b
commits is this record, its review and `PROGRESS.md`; the four harness paths are left in the working
tree for 3c to drive, and 2c-4b-3d deletes `src/probe.ts`, `src-tauri/src/probe.rs` and the four hook
lines again.

## 2. The launch recipe, verbatim

```sh
# once, and IN THIS ORDER — see section 6.1
npm run build
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol

# per launch, into a launch name never used before
./launch.sh <case>:<language> <name>
```

which does, per launch, into a bundle path never used before:

```sh
open --env "ECFG_PROBE_PLAN=$PLAN" \
     --env "ECFG_PROBE_TARGET=$LAUNCH/xdg/espanso/match/conflict.yml" \
     --env "ECFG_PROBE_R1=$FIXTURES/$R1" \
     --env "XDG_CONFIG_HOME=$LAUNCH/xdg" --env "HOME=$LAUNCH/home" \
     --stdout "$LAUNCH/probe.log" --stderr "$LAUNCH/probe.err" \
     "$LAUNCH/espansoConfig.app"
```

Cases are the eleven of section 4, each `:en` or `:es`. Every plan sets the language **through the
picker** first and prints the resulting `document.documentElement.lang`; every control is reached by
`HTMLElement.click()`; every element is reported with its own `getBoundingClientRect()`.

The second writer is `/bin/sh -c 'cp "$R1" "$TARGET.probe-tmp"; mv -f "$TARGET.probe-tmp" "$TARGET"'`,
spawned **inside the plan** at its *surface ready* point and waited on. It touches no `Workspace`, no
parse and no cache.

Once `--- end` has appeared in the transcript **or a 25-second ceiling has expired** — the byte checks
run either way, which is why L01 and L04 have a `bytes.txt` beside their `reached-end=no` — `launch.sh`
compares the fixture file with `cmp` against the case's expected bytes, the authored post-reapply file
for a positive case and **exactly R1** for a refusal case, searches the whole synthetic tree for
`.espansoconfig-backups`, and diffs the tree against the pristine copy taken before the launch.

## 3. The launches

| # | Case | Lang | Purpose | Result |
|---|---|---|---|---|
| L01 | `editor-exact` | en | first run of the rebuild | **instrument defect** (6.2): the transcript is `--- begin` and nothing else, no `--- end` |
| L02 | `editor-exact` | en | the editor's field table, positive | **conflict**, reapplied, **bytes MATCH** |
| L03 | `editor-collision` | en | the editor's field collision | **conflict**, `manualResolution` naming *Replacement text*, **bytes = R1**, no backups |
| L04 | `mover-exact` | en | the mover, positive | bytes MATCH but **no `--- end`** (6.3) — discarded |
| L05 | `mover-exact` | en | the same, after the settle helper was changed | **conflict**, reapplied, **bytes MATCH** |
| L06 | `mover-changed` | en | the mover's strict refusal | **conflict**, `manualResolution`, **bytes = R1**, no backups |
| L07 | `deleter-exact` | en | the deleter, positive | **`--- failed`** — **plan defect** (6.4): waited for a control a fresh panel never draws |
| L08 | `deleter-exact` | en | the same, with the failure dump added | **`--- failed`**, and the dump named the cause |
| L09 | `deleter-exact` | en | the same, with the button roll added | **`--- failed`**; the panel was already asking |
| L10 | `deleter-exact` | en | after the corrected plan | **conflict**, reapplied, renewed confirmation, **bytes MATCH** |
| L11 | `deleter-changed` | en | the deleter's strict refusal | **conflict**, `manualResolution`, **bytes = R1**, no backups |
| L12 | `duplicator-exact` | en | the duplicator, positive | **plan defect** (6.5): the acknowledgement was not waited for; **bytes DIFFER** |
| L13 | `duplicator-exact` | en | after the corrected plan | **conflict**, reapplied, *Save anyway*, **bytes MATCH** |
| L14 | `duplicator-changed` | en | the duplicator's strict refusal | **conflict**, `manualResolution`, **bytes = R1**, no backups |
| L15 | `creator-front` | en | the creator, targetless positive | **`--- failed`** — **plan defect** (6.6): the destination lookup matched the sidebar |
| L16 | `creator-front` | en | after the scoped lookup | **conflict**, reapplied, **bytes MATCH** |
| L17 | `creator-anchor` | en | the creator's anchor refusal | **conflict**, `manualResolution` naming the anchor, **bytes = R1**, no backups |
| L18 | `raw-negative` | en | the raw editor's negative capability | **conflict**, and **no reapply control drawn**, **bytes = R1**, no backups |
| L19 | `editor-exact` | es | the Spanish twin of L02 | **conflict**, reapplied, **bytes MATCH** |
| L20 | `mover-changed` | es | the Spanish twin of L06 | **conflict**, `manualResolution`, **bytes = R1**, no backups |
| L21 | `editor-collision` | en | English **straight after two Spanish launches** | English throughout — the picker beats the leaked override |
| L22 | `raw-negative` | es | the Spanish twin of L18 | **conflict**, and **no reapply control drawn** |
| L23 | `deleter-exact` | es | a Spanish positive on an operation-choice surface | **conflict**, reapplied, **bytes MATCH** |

**Twenty-three launches. Twenty-one printed `--- end`, and four of those twenty-one printed
`--- failed` first — L07, L08, L09 and L15. All twenty-three left a zero-byte `probe.err`.**
`--- end` is **not** a success signal: `startProbe()` prints it unconditionally, after the failure
report if there was one, so `launch.sh`'s `reached-end=yes` says only that the wrapper got to its
last line. Section 8.9 says what a launch has to satisfy instead, which parts of that the harness
checks itself, and which parts only a reader ever
conjoins. The two launches that printed no `--- end` at all are L01 and L04, both instrument
defects of this step, both fixed and both re-run.

## 4. The fixture pairs

Three fixture files and five expected-bytes files. Each is a **complete, neutral, hand-authored
document**; nothing is produced by substituting text into another. Several cases name the same R0 or
the same R1 because the case's *question* is the same file arriving twice — the file is seeded whole
and installed whole either way.

`base-r0.yml` is one comment line and a `matches:` sequence of three snippets, `:alpha`, `:beta` and
`:gamma`, each a `trigger:` in double quotes and a plain `replace:`. `:beta` is every plan's target.
`elsewhere-r1.yml` changes **`:alpha`'s** replacement and leaves `:beta`'s owned lines byte-identical.
`target-changed-r1.yml` changes **`:beta`'s** replacement and leaves `:alpha` alone.

| Case | R0 | R1 | Expected afterwards | Observed result |
|---|---|---|---|---|
| `editor-exact` | `base-r0.yml` | `elsewhere-r1.yml` | `editor-exact-expected.yml` | L02 (en), L19 (es): conflict panel, three revisions, four choices including *Keep my draft*; pressed; both report blocks drawn; *Save* pressed. Final bytes **MATCH** — `:beta`'s `replace` is the drafted value and `:alpha`'s externally written line is intact. `backups=PRESENT` |
| `editor-collision` | `base-r0.yml` | `target-changed-r1.yml` | **exactly R1** | L03, L21 (both en): conflict, *Keep my draft* pressed, a `manualResolution` report naming *Replacement text*. Final bytes **exactly R1**, `backups=none` |
| `creator-front` | `base-r0.yml` | `elsewhere-r1.yml` | `creator-front-expected.yml` | L16 (en): destination and placement *At the top of the list* chosen inside the creator's own section, conflict, *Keep my draft* pressed, *Add this snippet* pressed again, a final report saying the file was written. Final bytes **MATCH** — `:probe` is the first item and `:alpha`'s externally written line is intact. `backups=PRESENT` |
| `creator-anchor` | `base-r0.yml` | `target-changed-r1.yml` | **exactly R1** | L17 (en): placement *After :beta*, conflict, *Keep my draft* pressed, a `manualResolution` report naming *the snippet this one was to be placed after*. Final bytes **exactly R1**, `backups=none` |
| `deleter-exact` | `base-r0.yml` | `elsewhere-r1.yml` | `deleter-exact-expected.yml` | L10 (en), L23 (es): conflict, *Keep what I asked for* pressed, then the deletion **request** control and the **confirmation** control were each found and pressed — a missing one would have printed `--- failed`. Final bytes **MATCH** — `:beta` is gone and `:alpha`'s externally written line is intact. `backups=PRESENT` |
| `deleter-changed` | `base-r0.yml` | `target-changed-r1.yml` | **exactly R1** | L11 (en): conflict, *Keep what I asked for* pressed, a `manualResolution` report saying no snippet in that list carries the exact owned-line correspondence. Final bytes **exactly R1**, `backups=none` |
| `duplicator-exact` | `base-r0.yml` | `elsewhere-r1.yml` | `duplicator-exact-expected.yml` | L13 (en): conflict, *Keep what I asked for* pressed, *Duplicate* pressed again, the *Save anyway* acknowledgement waited for and pressed, a final report saying the file was written. Final bytes **MATCH** — two adjacent `:beta` items and `:alpha`'s externally written line intact. `backups=PRESENT` |
| `duplicator-changed` | `base-r0.yml` | `target-changed-r1.yml` | **exactly R1** | L14 (en): the same displayed shape as L11, on the surface that copies. Final bytes **exactly R1**, `backups=none` |
| `mover-exact` | `base-r0.yml` | `elsewhere-r1.yml` | `mover-exact-expected.yml` | L05 (en): conflict, *Keep what I asked for* pressed, a final report saying the file was written and this snippet has been moved. Final bytes **MATCH** — `:beta` is first and `:alpha`'s externally written line is intact. `backups=PRESENT` |
| `mover-changed` | `base-r0.yml` | `target-changed-r1.yml` | **exactly R1** | L06 (en), L20 (es): conflict, *Keep what I asked for* pressed, a `manualResolution` report. Final bytes **exactly R1**, `backups=none` |
| `raw-negative` | `base-r0.yml` | `elsewhere-r1.yml` | **exactly R1** | L18 (en), L22 (es): conflict panel with **three** choices and `keepMyDraft=absent keepMyRequest=absent` — no reapply control under either label. Final bytes **exactly R1**, `backups=none` |

Every positive case's expected file was **authored before the launch that produced it** and matched on
the first launch that ran the plan correctly. That is evidence the write is what was predicted; it is
**not** evidence that the prediction is what espanso wants, which no instrument here can give.

**What each case was designed around is a hypothesis, and this instrument does not test it.** The
mechanisms these fixture pairs were chosen for — the editor's exact-item tier as against its trigger
fallback; a creation needing no correspondence and being revalidated against the new destination; an
`After` placement resolving its anchor; strict owned-run correspondence on delete and duplicate; the
clone being taken from the newly adopted item; `top` being lowered afresh against the new sequence
rather than reused as an old index — are **not** distinguishable from what a transcript prints or from
what `cmp` says. For several of them the fixture pair makes the distinction impossible **in principle**,
not merely unobserved: `elsewhere-r1.yml` — the R1 of every positive case — leaves `:beta`'s owned
lines byte-identical to R0 and does **not** reorder the sequence, so the deleter, the duplicator and
the mover would produce exactly these bytes whether they had adopted the newly parsed document or kept
the old one. Sections 8.5 and 8.6 state each ambiguity; 2c-4b-1's Rust-side tests are what carries the
mechanism claims.

## 5. What the transcripts show, and who did the reading

**A true `SaveResult::Conflict` still reaches a match surface with the fixture-pair writer.** Every
conflicting launch printed three revisions with `expected ≠ found` and `diskRevision` equal to `found`
— a real locked-read mismatch, not an identity refusal. **A person read those digests; the harness did
not check them.** `reportConflict` waits for a status panel holding one run of sixteen or more
hexadecimal characters, prints the first three runs it finds, and calls the block
`outcome=conflict` on that pattern alone: it asserts neither that there are three, nor that
`expected ≠ found`, nor that `diskRevision == found`. What makes those inequalities evidence is that
they are legible in each retained transcript and were compared by hand. The three digests are stable
across launches because the fixtures are: R0 is `507e98f5…`, `elsewhere-r1.yml` is `31be59eb…`,
`target-changed-r1.yml` is `0b198688…`.

```
L02 editor  outcome=conflict panel box=658,44,491x1032   507e98f5… / 31be59eb… / 31be59eb…
    choices: [Keep editing 83x23] [Copy my text 87x23] [Keep my draft 92x23] [Load the version on disk 147x23]
L05 mover   outcome=conflict panel box=658,44,491x741    507e98f5… / 31be59eb… / 31be59eb…
    choices: [Leave this as it is 108x23] [Keep what I asked for 132x23] [Load the version on disk 147x23]
L18 raw     outcome=conflict panel box=658,196,491x493   507e98f5… / 31be59eb… / 31be59eb…
    choices: [Keep editing 83x23] [Copy my text 87x23] [Load the version on disk 147x23]
```

**`keepMyDraft` is drawn and pressable on all five match surfaces, and absent on the raw editor.** The
roll of controls each surface drew is what `conflictChoicesFor`'s two-gate rule predicts, which is a
prediction matching a screen rather than an observation of the rule firing: the editor and the creator
drew four choices including *Keep my draft*, the mover, the deleter and the duplicator drew three
including *Keep what I asked for* — the draft-kind branch — and the raw editor drew three with
**neither label**, in English (L18) and in Spanish (L22).

**The positive arm writes what was predicted, and the refusal arm leaves the file exactly as the
second writer left it.** Five cases matched their authored post-reapply bytes; six ended with the file
**byte-identical to R1** and **no `.espansoconfig-backups` directory anywhere in the tree**, and the
tree diff for every refusal launch is exactly the second writer's own change and nothing else. That is
a statement about the final filesystem state, and it is the whole of what these artifacts show.
**Nothing here shows whether a save command was issued** — Q7 point 4 asks for exactly that, and this
harness has no invoke spy and no command counter; `reportReapply` only prints status blocks. An
identical or transient write would leave the same final bytes, and the absent backup directory is
consistent with a refusal but is not an observation of the call. Section 8.11.

**The report block and the panel are two blocks, and the report is routinely off-screen.** Every
`manualResolution` report this instrument drew was at a negative `y`: `-53` in L03 and L21, `-87` in
L06, L11, L14 and L17, and `-104` in L20. Two reapply notices were off the top as well — `-102` in L02
and `-170` in L19 — so nine of the twenty-three launches measured a status block above the fold at the
moment `reportReapply` ran, in a pane whose outcome panel had been scrolled into view. The numbers are the transcripts' own
`getBoundingClientRect()` values; **the viewport height is not in any retained artifact**, only the
1180×760 window `src-tauri/tauri.conf.json` configures. That is a **reading finding for 3c**, recorded
here because the instrument measured it, not resolved here.

**The four Spanish twins reached the same arms as their English originals, and four is not the
matrix.** L19/L20/L22/L23 are the Spanish twins of L02/L06/L18/L10 and produced the same outcome arms,
the same revisions and the same byte results; they differ from their originals only in label text and
in layout — L19's fourth choice wraps to a second row and its panel is 1094 px tall against L02's 1032.
Q7 asks for both languages **across the matrix**, and this step did not do that: the creator and the
duplicator have **no** Spanish launch, and the mover's only Spanish launch is a refusal. Section 8.10.

## 6. What the next worker must not re-derive

**6.1 `npm run build` alone changes nothing — the bundle embeds `dist` at *cargo* build time.**
`2c-4a-3c-1-instrument.md` section 5.1, unchanged and still true: `cargo build -p espansoconfig
--features custom-protocol` must follow every `npm run build`, and **`touch src-tauri/build.rs`
first**, because cargo does not otherwise notice `dist/`.

**6.2 Do not settle on an animation frame; use `setTimeout` only.** L01 is the first mistake. **What
the artifact retains** is that `L01/probe.log` holds `--- begin editor-exact:en` and nothing else, with
a zero-byte `probe.err` and `reached-end=no` — indistinguishable from a crash. **The diagnosis made at
the time**, on which the harness was then changed, was that the driver's settle used one animation
frame and that a WKWebView driven by a launch script, never frontmost, does not run animation frames
under that condition. That revision of `src/probe.ts` was **not retained**, so nothing here re-derives
it; the current source settles on `setTimeout` and every launch from L02 on printed past `--- begin`.

**6.3 …and a run of short `setTimeout`s costs seconds, not milliseconds.** L04 is the second mistake.
**What the artifact retains** is a transcript that reaches both reapply reports, a
`bytes=MATCH against mover-exact-expected.yml`, and no `--- end`. **The diagnosis made at the time** was
the *inverse* of the first: the replacement settle was correct, but a reporting helper called it twelve
times in a row, a backgrounded WKWebView clamps each one, and twelve settles spent the whole six-second
budget. **One `setTimeout(…, 300)` beats twelve `setTimeout(…, 0)`.** That harness revision was not
retained either. What stands on the artifact alone is the ruling: a byte match without an `--- end` is
evidence of the **final byte predicate** and of nothing beyond it. It is not sufficient to count the
launch as a completed plan, because the transcript is truncated and what the plan did after the last
printed line is unknown — so L04's bytes are real and L04 is still discarded rather than counted.

**6.4 `MatchDeleter` opens already asking.** `MatchDeleter.svelte` seeds its session with
`requestDelete(startMatchDeletion(projection, match))`, so *Delete this snippet* is **not** drawn when
the panel opens and the send is the confirmation. L07–L09 are the cost of assuming otherwise. A
rebuilt session after a reapply has nothing pending — consult Q4's renewed confirmation — so the
positive tail presses the request **and then** the confirmation. This is a fact about the component,
recorded because it cost three launches; it is not a defect claim.

**6.5 A refusal comes back from a real save transaction, so its control is not there in the next
tick.** L12 pressed *Duplicate*, settled once, found no *Save anyway*, and left the clone unwritten
while every other line of the transcript looked right. Wait for a control; never settle for one.

**6.6 The same text is on screen twice, and the sidebar is first.** L15's `--- failed` line names the
**outcome panel**, which is the symptom and not the cause; the cause is legible only in the `--- pane`
dump beneath it, which shows the creation form still asking *Which file it goes in*. The diagnosis —
the destination lookup matched the **sidebar row** for `match/conflict.yml`, so the form kept no
destination and *Add this snippet* was inert when the plan clicked it — is an inference from that dump
and from the fix working, not something the transcript states: the button roll records labels and
never a control's disabled state. Every lookup for a control whose label is a file path or a trigger
must be **scoped to the surface's own section**.

**6.7 The picker beats the leaked override, and the leak is still real.** L19 and L20 (`es`) followed
immediately by L21 (`en`, fresh bundle path, fresh `HOME`) confirm `2c-2-2-window-reading.md` section
1.2 again: the WebKit data store follows the **bundle identifier**, which every probe bundle shares.
Set the language through the picker and print `documentElement.lang`.

**6.8 The probe registers its commands beside the shipped list, not inside it.**
`probe::register_with_probe` calls `crate::register` and then replaces the handler, leaving `main.rs`'s
own `tauri::generate_handler![…]` untouched — which matters because
`crate::wire_contract::registered_commands()` parses that list textually. **`cargo test -p
espansoconfig` passes with the harness in the tree** because of that one arrangement.

**6.9 Rectangles are measured and never filtered by visibility.** Kept from 2c-4a-3c-1 section 5.6, and
section 5 above is why it still earns its place.

## 7. The gates, with the harness in the tree

| Command | Result |
|---|---|
| `npm test` | **1624** passed, 49 files |
| `npm run check` | **419** files, 0 errors, 0 warnings |
| `npm run build` | **176** modules; `svelte/internal/server` and `async_hooks` both absent from `dist/assets/` |
| `cargo test -p espansoconfig` | **155** passed, 0 failed |
| `cargo test --workspace` | **1086** passed, 0 failed |
| `cargo fmt --check` | clean |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing |

**Every moved number is the shape `CLAUDE.md` section 6 names, and every unmoved one is also
evidence.** 1624 is 1623 plus one, because `scripts/lint/ipc-detail.test.ts` `it.each`-sweeps every
`.ts` under `src/` and `src/probe.ts` is therefore a test case there. 419 is 418 plus that same file.
**176 is 175 plus `src/probe.ts`** — one new source module, one module — and not the
`resolve.conditions` regression, which would be a jump toward ~180 with Svelte's server build in the
bundle. `cargo test --workspace` does **not** move — it is 1086, exactly the number `2c-4b-3a-notes.md`
section 5 recorded — because `probe.rs` declares no test, and that unmoved sum is also the argument
that the 155 of `cargo test -p espansoconfig` is what the crate already had rather than a number this
step measured for the first time. **An unmoved count is evidence of an unmoved count and of nothing
broader**, and **no gate transcript was retained**: these rows are what the commands printed when they
were run, re-checkable only by running them again.

`git status --short --untracked-files=all` shows **four harness paths** — `src/main.ts` and
`src-tauri/src/main.rs` modified by **two hook lines each**, and `src/probe.ts` and
`src-tauri/src/probe.rs` untracked — **accompanied by this decision record and its review**, both also
untracked until they are committed. Nothing else appears. No git command that changes anything was
run, and no scratch path is inside the repository.

**"No production behaviour changed" would be too strong, and the true statement is narrower.** With
`ECFG_PROBE_PLAN` absent, **no plan drives the DOM and no second writer runs**: `startProbe()` returns
as soon as `probe_plan` answers `null`, and `probe_second_writer` is reached only from a plan. But the
instrumented build is not the shipped one. `main()` registers through `probe::register_with_probe`,
which makes `probe_plan`, `render_probe` and `probe_second_writer` **three extra callable IPC
commands** on every launch, and `src/main.ts` calls `startProbe()` unconditionally, so **every startup
pays one extra IPC round trip** to `probe_plan` before finding out there is nothing to do. Both are
gone when 2c-4b-3d removes the harness; neither is gone before then.

## 8. What this instrument does **not** prove

This is the section this project's worst defect class exists to make someone write.

**8.1 Nothing here is a window reading.** Twenty-three launches measured rectangles and printed
strings; not one of them judged whether a person could read, reach or understand what was on screen.
A status block was drawn at a **negative** `y` in nine launches — every one of the seven
`manualResolution` reports, plus L02's and L19's reapply notices — and this record says so without
saying whether that is acceptable. That judgement is 2c-4b-3c's, and 3c must re-take its readings after
any component change 3d makes.

**8.2 It cannot fail because a sentence is untrue.** The transcript prints the strings the panels drew,
and a false one prints exactly as well as a true one. `2c-4b-3a-notes.md` section 6.2 is unchanged: the
twenty-four strings that step added are still argued against the code and not measured against
anything.

**8.3 `HTMLElement.click()` is not a mouse click.** No plan used the keyboard, moved the focus by
tabbing, scrolled anything, or produced an untrusted-event refusal. Focus order, scroll reachability
and keyboard operability are untested here and are part of what 3c owes.

**8.4 One fixture shape was exercised, and it is the easy one.** Every case ran over three snippets in
one file, with plain `replace:` scalars, double-quoted triggers, one leading comment, LF line endings,
no BOM, no block scalars, no item-owned comments, no blank-line runs, no second sequence, no read-only
file and no package. The corpus fixtures `CLAUDE.md` section 4 lists exist precisely because those
shapes behave differently, and **none of them was put through this harness**.

**8.5 Q7 asks for more cases than section 4 builds.** One positive and one refusal per policy is what
this step was scoped to. Not built, and each needs one more fixture pair: the editor's **unique-trigger
fallback** positive (Q7 point 2), the `alreadySatisfied` arm (point 3), the **ambiguous trigger**
refusal (point 5), a move over a **reordered** sequence and a **resolvable `after` anchor** (points 1
and 6), and a creation whose anchor was **deleted** rather than changed (point 7). The case table in
`launch.sh` takes a new row and two files; nothing in the driver has to change.

**8.6 A byte match is not a proof of mechanism, and this is the whole list.** `cmp` says the file
equals a document a person wrote by hand, and a transcript says which strings were drawn. Neither says
*why*. Every mechanism the eleven cases were designed around is invisible here, and section 4's
*Observed result* column is written to claim none of them:

- **Which correspondence tier the editor took.** An `editor-exact` launch whose correspondence had been
  established by the **trigger** fallback rather than by the owned-run digest produces the same bytes.
- **Whether a creation was revalidated against the new destination.** L16 shows a control pressed, a
  conflict and reapply path displayed, and the expected bytes; revalidation and the absence of any
  correspondence requirement are not observed.
- **Whether anchor resolution is what refused L17.** The transcript shows the anchor-naming refusal
  sentence and an unchanged R1 with no backup. Which rule produced that sentence is not observed.
- **Whether the deleter and the duplicator applied strict owned-run correspondence, and whether they
  worked from the adopted item.** `elsewhere-r1.yml` leaves `:beta`'s owned lines **byte-identical to
  R0**, so L10 and L13 cannot tell an adopted target from the old one, and the duplicator's clone
  cannot be attributed to the newly adopted bytes rather than the retained ones.
- **Whether `top` was lowered afresh against the new sequence.** `elsewhere-r1.yml` does **not** reorder
  the sequence, so an implementation reusing the target's former index and one resolving `top` against
  the newly parsed list both yield L05's result. The reordered case section 8.5 lists as missing is
  precisely the one that would separate them.

What distinguishes any of these is the Rust-side tests of 2c-4b-1, not this.

**8.7 The adoption arm is invisible.** `DiskAdoptionOutcome` `installed` and `alreadyThere` are both
successes and both reach `reapplied`; no transcript here can say which one a launch got, so nothing
here is evidence about `BrowserState.adoptDiskVersion`'s generation guard.

**8.8 It says nothing about the real configuration.** By construction: every launch is confined to a
synthetic two-file tree, and the one claim this makes about the owner's files is that none of them was
opened.

**8.9 `--- end` proves that the outer wrapper reached its final logging statement, and nothing else.**
It is **not** a success signal. `startProbe()` wraps `runPlan` in a `try`/`catch`, prints
`--- failed <message>` plus a pane dump and a button roll when the plan throws, and then prints
`--- end` **unconditionally** — the `catch` arm falls through to the same line the success arm reaches.
`launch.sh` sets `reached-end=yes` on the presence of that string alone. **L07 is the standing
demonstration**: its transcript is `--- failed timed out waiting for the deletion request control`
followed immediately by `--- end`, and its `bytes.txt` records `reached-end=yes` beside
`bytes=DIFFER`. L08, L09 and L15 are the same shape.

**Overall success is not mechanised as one conjunction.** A launch counts as successful in this record
only when all four hold together: **no `--- failed`** line; the expected conflict block with three
revisions, `expected ≠ found` and `diskRevision == found`; the expected control and action lines for
that surface; and the intended byte predicate — `bytes=MATCH` against the authored expected file for a
positive case, or `bytes=MATCH` against R1 with `backups=none` for a refusal case. The retained
transcripts named in sections 3 and 4 were checked by hand against all four.

**Parts of that conjunction are mechanised, and the rest is not.** `launch.sh` runs the `cmp` itself and
records `MATCH` or `DIFFER`, measures `probe.err`, searches the tree for `.espansoconfig-backups` and
diffs it against the pristine copy; the driver waits for each control it needs and **throws** when one
does not arrive, which is precisely how L07 came to print `--- failed`. What no part of the harness
does is **conjoin** them: nothing checks for the absence of `--- failed`, nothing asserts the revision
relationships — `reportConflict` labels a status block `outcome=conflict` by recognising one long
hexadecimal run, not by comparing three digests — and nothing refuses to write `reached-end=yes` beside
a `bytes=DIFFER`. A reader supplies that last step, on every launch.

The older warning still stands beside this one: `--- end` also says nothing about what the window did
after the driver's last line, and L04 remains the demonstration that a launch can write the right bytes
and still fail to say so.

**8.10 Bilingual coverage is four cases, not the matrix.** Q7 asks for both languages *across the
matrix*; this step ran Spanish for **four** of the eleven cases — the editor positive (L19), the mover
refusal (L20), the raw negative (L22) and the deleter positive (L23). **The creator and the duplicator
have no Spanish launch at all**, so no Spanish sentence of theirs — including the creator's
anchor-refusal report, which is one of 2c-4b-3a's new strings — was ever put on a screen by this
instrument. **The mover has no Spanish positive**, so its Spanish *reapplied* wording is likewise
undrawn here. Nothing about label truth follows in either language anyway (8.2); this is a limit on
which strings were **rendered at all**.

**8.11 Nothing here shows that a refusal issued no save command.** Q7 point 4 asks for exactly that,
and this harness cannot answer it: there is no invoke spy and no command counter, and `reportReapply`
does nothing but print status blocks. What the six refusal launches show is the **final filesystem
state** — the file byte-identical to R1, no `.espansoconfig-backups` directory in the tree, and a tree
diff equal to the second writer's own change. A write that produced identical bytes, or a transient one
undone before the launch ended, would leave those same artifacts. Closing this needs a counter in the
harness or a Rust-side assertion, not another launch of this one.
