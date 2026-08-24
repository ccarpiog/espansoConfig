# Phase 2c-5 step 6a — the instrument extended to every restore state 6b must reach

Step 2c-5-6 — the bilingual WKWebView reading over the restore surface — was split by the
orchestrator into 6a and 6b. **This is 6a: it extends the temporary window instrument so that 6b can
reach every restore-surface state the phase design demands, and proves every new case with a
launch.** It takes no bilingual reading and judges no screen; every state below was driven in **one**
language, chosen for aggregate coverage, and 6b owes both languages on every state exactly as
`2c-5-5a-instrument-rebuild.md` §8.3 already says.

The instrument tree is `/private/tmp/espansoconfig-harness-2c-5/`, exactly as 5b left it — verified
present at this step's start (four scripts, ten fixtures, the P49–P53/N09/C11–C15 launches, both 5b
manifests), with the four revision fixtures' digests agreeing with `2c-5-5b-instrument-cases.md` §2
item 1 (`2543689c…`, `beba1b1f…`, `27aa3b9e…`, `358eb1d7…`) and `restore-entry.yml` agreeing with its
§3.1 (`114cd4e2…`). **`src-tauri/src/probe.rs` was not touched**: every new case's target is the same
`…/xdg/espanso/match/conflict.yml` the existing `TARGET_TAIL` names, so §8.2 item 7's test obligation
is not triggered, no confinement control is owed a re-take, and **the four residual rebindings of 5a
§8.1 are inherited open and untouched** — nothing here constructs, measures, closes or widens any of
them.

## 1. The work list — Q7 item 6 against 5b §5, every state dispositioned

`docs/reviews/phase-2c-5-design.md` Q7 item 6 names the states the reading must reach.
`2c-5-5b-instrument-cases.md` §5 names what no case then reached. The diff, and what this step did
about each demanded state:

| Q7 item 6 state | Disposition |
|---|---|
| missing root | **already reached** — 5b's `restore-none` (P53). No work. |
| recognised batches | **already reached** — 5b's P50–P52. No work. |
| unrecognised batches | **new case `restore-skipped`**, proven by P55 (P54 retained, §5.1). |
| valid entries | **already reached** — 5b's P50. No work. |
| non-UTF-8 entries | **new case `restore-notutf8`**, proven by P56. |
| BOM/CRLF/control-character preview | **new case `restore-preview-bytes`**, proven by P58 (P57 retained, §5.3). |
| open-surface refusal | **unreachable through this instrument — argument in §6.1.** |
| confirmation withdrawal | **new case `restore-withdraw`**, proven by P59 (a withdrawal by change, where 5b's P51 was a decline by control). |
| parse-finding acknowledgement | **new case `restore-findings`**, proven by P60. |
| target changed after preview | **two halves.** The send-time discovery is 5b's P52 (the writer moves the file after the question; the send conflicts). The window-side half — the base re-pointed and the confirmation withdrawn on adopting a changed target — is the new `restore-reload`, proven by P62. The `targetMoved` refusal *sentence* is unreachable persistently — argument in §6.2. |
| adoption `installed` | **new case `restore-reload`**, proven by P62 (§4.7 states what discriminates it). |
| adoption `alreadyThere` | **unreachable through this instrument — argument in §6.3.** Q7's own "where reachable" qualifier is what licenses the disposition. |
| adoption `refused` | **unreachable through this instrument — argument in §6.3.** |
| committed restore | **already reached** — 5b's P50. No work. Re-reached here by P60 and P62 on this build. |
| `committed: false` | **new case `restore-nothing`**, proven by P61. |
| committed-but-reprojection-failed | **unreachable through this instrument — argument in §6.4, with P60 as its measured half.** |
| keyboard / focus / scroll / viewport reachability / hit testing | **reporter machinery built** — §3.3 is the decision and its limits; exercised by P58 and P62. |

States 5b §5 lists that Q7 item 6 does **not** demand are left unreached deliberately, each still a
limit of these artifacts: `batchesLoading`/`entriesLoading` (transient — the driver's waits outlast
them by design), `batchesIncomplete` (needs a `BatchSkipped::Unreadable` entry; §2.1 says why the
seed deliberately avoids one), `entriesNone`, `entriesIncomplete`, `listedDiffers` and
`listedUnreadable` (both need a backup entry mutated between listing and read, and both writers are
confined to the target file), `sendFailed`, `mayHaveWritten`, `findingsAreStale`, the `EntrySkipped`
arms other than `marker`, and the `readOnly`, `noCandidate` and `inFlight` refusals. One demanded
state changed column since 5b: `entriesRefused` and `acknowledgedAsksAgain`, unreached at 5b, are
now drawn by P56 and P60 respectively.

## 2. What was added, file by file, with the source of every choice

### 2.1 `launch.sh` — seven case rows, one seed variable, one junk-seed block

The seven rows (`restore-skipped`, `restore-notutf8`, `restore-preview-bytes`, `restore-withdraw`,
`restore-findings`, `restore-nothing`, `restore-reload`) all reuse the seeded catalogue machinery 5b
§3.1 built — root `0700`, batch `2026-08-20T101500Z`, marker `espansoconfig-backup-batch 1\n`, entry
at `match/conflict.yml` — differing only in the entry's fixture, the `EXPECT` file, and one new
variable. `SEEDJUNK=yes` (only `restore-skipped` sets it) seeds three unrecognised entries beside
the recognised batch, one per `BatchSkipped` arm that `scan_batches` rejects **after reading the
entry** (`crates/espansoconfig-core/src/persist/backup.rs`, the loop at `scan_batches` and the enum
at `BatchSkipped`):

- `not-a-batch/` — a directory whose name `parse_batch_name` refuses → `ForeignName`;
- `2026-08-18T090000Z` — a **symlink** at a batch-shaped name, refused rather than resolved →
  `NotADirectory`;
- `2026-08-19T090000Z/` — a real directory, batch-shaped name, no marker → `NoMarker`.

The fourth arm, `Unreadable`, is **deliberately not seeded**: it is the one that flips the listing
incomplete, an unreadable directory also breaks `cp -R` and `diff -r` themselves, and Q7 item 6 does
not demand `batchesIncomplete`. The symlink's target is the recognised batch's own **marker file**,
by relative name, so the pristine copy holds an identical link resolving inside its own tree —
§5.1 records why it is a file and what the first choice (a directory) did to the byte oracle.

`ENTRYFILE=base-r0.yml` on `restore-nothing` is what makes that case's entry byte-identical to the
seeded target, which is the `committed: false` construction: `save_document` computes
`committed = candidate != source` (`crates/espansoconfig-core/src/persist/save.rs`), takes a backup
only when committed, and answers success either way.

### 2.2 `byte-fixtures.sh` — new script, three fixtures whose exact bytes are the point

Built by `printf` and never through an editor, per the same rule that protects the corpus fixtures;
re-runnable because the tree is volatile and has been lost twice. The live digests:

```
3d509835b740ca6337d24147c2adbcd995756bf727b6ccfe85bd8721e8ef9d89  restore-notutf8-entry.yml
9eb67f592839e35432642c656119d536de48d6c6e7b0c6ada37b9ebac25db183  restore-preview-bytes-entry.yml
b7fc1cc6bdcdc529a69dedb11a2a59d5a743d78ac4ca2d3d99826a2b258207ae  restore-broken.yml
```

- `restore-notutf8-entry.yml` — first byte `0xFF`, so `read_backup_text` refuses it with
  `NotUtf8 { offset: 0 }` (`backup.rs`); the rest is neutral ASCII.
- `restore-preview-bytes-entry.yml` — a UTF-8 BOM (`ef bb bf`), CRLF line endings throughout, one
  BEL (U+0007) inside a scalar, and one **bare** CR not followed by LF. The bare CR is this step's
  own addition after P57 (§5.3): `src/lib/browser/sourceText.ts` draws a CRLF pair as **one line
  break** and names only a lone CR, so a CRLF-only document previews with no carriage-return name at
  all. 82 bytes, verified by `xxd` after building.
- `restore-broken.yml` — valid UTF-8 that does not parse (`matches: [` unclosed), for the
  `DocumentDoesNotParse` path. Every fixture is hand-authored, neutral and synthetic.

**One superseded byte set is disclosed rather than hidden**: P57 ran against the first
`restore-preview-bytes-entry.yml` (77 bytes, digest `545f8642…`, no bare CR), which the amended
script then overwrote. P57's transcript quotes that candidate; the live fixture is the 82-byte one,
and P58 is the launch that matches it.

### 2.3 `src/probe.ts` — six new tails, five flow helpers, the geometry reporter

`RestoreTail` grew from four members to ten; each new case name went in the **three places** 5a
§8.1 requires — `launch.sh`'s case table, `runCase`'s switch, and a plan function — and the plan
string stayed `<case>[:en|es]`. `restore-nothing`'s arm calls `restorePlan('replace')`, the
own-arm-borrowed-plan convention `runCase`'s header already states: its walk, question and
confirmation are exactly the replace tail's, and the outcome marks discriminate what came back.
`restorePlan`'s four existing tails kept their statement sequence; the one deliberate change to a
shared path is that the replace tail's single `replaced=` line became `sayRestoreOutcomeMarks()` —
the same line plus `nothingToWrite=` and `windowOutOfStep=`, three independent readings of the
outcome text in the launch's own language. The 5b launches are records of the older driver and are
not re-taken.

New flow helpers, each waiting by dictionary-resolved sentences (never by built keys):
`reportSkippedBatchListing` (the skipped report, the three reason sentences, the recognised row
beside them, and an `batchesIncomplete=` presence line that is reported rather than waited for),
`reportRefusedEntryRead` (the two refusal sentences inside the entries step, then the candidate
step's absence), `withdrawTheQuestionByRelisting` (relist inside the batches step, then the prepare
control back and a `question=absent` reading), `acknowledgeFindingsThenReplace` (the refused panel,
`willNotLoad=`/`acknowledgedAsksAgain=` presence lines, *Save anyway*, the re-asked question, the
second confirmation, the outcome marks), `reloadFromConflictThenReplace` (the conflict report, the
geometry measurement, the two-step reload by the keys `conflictChoiceKey` maps —
`browser.saveOutcome.choice.reloadDiskVersion`, then `…confirmReloadRetargeting`, chosen because
`CONFLICT_CAPABILITIES.draftKind` is `operationChoice` and restore's reload keeps its candidate —
the cleared panel, and the second prepare/confirm), plus `reportOutcomePanel` (a mid-plan sibling of
`reportFinal`, because a refused or warning panel a later press replaces has to be read while it is
there).

### 2.4 The rebuild, in §3's order, and the binary every launch pins

One rebuild after the driver edit and before the first launch: `npm run build` (**185 modules** —
predicted, since edits inside `src/probe.ts` cost 0), `touch src-tauri/build.rs`, `cargo build -p
espansoconfig --features custom-protocol` (finished, no errors). `shasum -a 256
target/debug/espansoconfig` answers
`c4f2ae029dbd2096278c3fb39a739c51e0422178c22040fb9265449508dba659` — not 5b's `6d3a80de…`, as
expected of a rebuild whose embedded `dist` changed — and **every launch below records that digest
from its own retained bundle copy** (`bytes.txt`'s `binary=` line digests the copy inside the
launch's own `.app`). No artifact binds this executable to a source snapshot; 5a §6.4's limitation
is inherited whole.

## 3. The reporter decision — what 6b's keyboard/focus/scroll/hit-testing obligations get

### 3.1 What was read, and what was not rebuilt

`2c-4c-4b-instrument.md` §3.2's five recovery reporters are about the recovery surface —
`section.recovery`'s sentence attribution, its offer control, its form — none of which exists on the
restore pane, so **none of the five is rebuilt**. `2c-4c-5b-1-instrument.md` §2's geometry reporter
is the shape 6b's obligations actually name, and its pieces were re-authored for this surface.

### 3.2 What was built

`describeElement`, `hitTestOf` (the six answers of 5b-1 §2: `isTheControl`,
`descendantOfTheControl`, `containsTheControl`, `somethingElse(named)`, `nullAtPoint`,
`outsideViewport`), `formControlsIn` (buttons plus inputs, selects and textareas — a covered
`<textarea>` is the same defect as a covered button), and one composite `reportRestoreGeometry`:
the section's rectangle, its scroller through `reportReach`'s existing discipline, the sticky
`.actions` rectangle, then per control a line with its label, structural name, rectangle, disabled
state, `tabIndex` and a real `document.elementFromPoint` hit test — and then a **focus walk**:
`focus({ preventScroll: true })` on each enabled control with `document.activeElement` compared in
the same synchronous block, and an attempt (not a promise) to restore the previously focused
element. Every measurement runs inside one `try` whose `catch` prints the failure as an ordinary
transcript line, so a throwing reporter cannot turn a measured launch into `--- failed` (5b-1 §2's
rule). It is called from the `preview` tail (the longest content) and from the `reload` tail while
the conflict is on screen (the state with the most controls).

### 3.3 What keyboard evidence this instrument can and cannot give — recorded, not glossed

A synthetic `KeyboardEvent` is untrusted and runs **no default button activation** in this webview,
and there is no way to synthesize a real Tab keypress from page JavaScript — so **keyboard
activation and real Tab traversal are not measurable by this instrument**, and no transcript line
claims either. What the reporter gives 6b instead: programmatic focusability per control, the
`tabIndex` and document-order roll from which sequential reachability is a *derivation a reader
makes*, and the hit tests for the pointer side. If 6b wants a real Tab walk, it is a by-hand step of
the reading, exactly as a real mouse click would be. The `focus restored=false` P58 and P62 print is
the disclosed limit of the restore attempt: the previously active element was `<body>`, which does
not take focus back, so the last walked control keeps it.

## 4. The proof launches — nine, P54–P62, on this build

One plan per launch, into a fresh bundle path every time; runs serial, the window unoccluded;
numbering continues 5b's ranges (P54+; no N or C launch was owed, since neither `probe.rs` nor any
confinement was touched). Every check below is an independent `bytes.txt` line; **the script
conjoins nothing, and every conjunction here is this reader's.** All nine ran the binary
`c4f2ae02…`. The viewport moved between launches (`1180x728 dpr=2` on most, `1080x728` on P61 and
P62; `hasFocus` and `visibility` varied) — one more instance of the standing rule that this harness's
geometry compares with nothing outside the launch that measured it.

### 4.1 P54 — `restore-skipped:en`, retained as a demonstration, superseded by P55

The plan reached everything (`failed-lines=0`, all three reason sentences, the recognised row
beside them, `batchesIncomplete=absent`) — but `tree-diff=2 lines`, and both lines are
`diff: … Directory loop detected`: the junk symlink then pointed at the unmarked sibling
**directory**, and `diff -r` follows a symlink to a directory into its target and trips its loop
guard on a byte-identical tree. The seed was changed (§2.1) and P54 is retained as the
demonstration, exactly as P01 and C08 are retained in their generations.

### 4.2 P55 — `restore-skipped:en`, the unrecognised-batches proof

`failed-lines=0`, `end-lines=1`, `probe.err=0 bytes`. The batches step quotes the recognised row
*"Backup batch named 2026-08-20T101500Z"* **and** the skipped report with all three reasons —
*"not named the way espansoConfig names a backup folder…"*, *"not a folder…"*, *"carries no
ownership marker…"* — with `batchesIncomplete=absent`, which agrees with `BatchSkipped::is_unreadable`
being false of all three seeded shapes. Byte lines: `bytes=MATCH` (base-r0), `tree-diff=0`,
`entry-cmp=DIFFER`, `backup-tree=SAME`, `batches=before:4 after:4` — the counts count directory
entries of the root, exactly as 5b §5 already discloses, and three of the four are the junk.

### 4.3 P56 — `restore-notutf8:es`, the refused read

The walk in Spanish to the entry row, then the press, and the entries step re-drawn as the refusal:
*"Esta aplicación no obtuvo lo que pidió a la carpeta de copias…"*
(`browser.restore.entriesRefused`) beside *"espansoConfig no pudo completar esta solicitud del
catálogo de copias…"* (`code.commandError.backupReadFailed`), `candidateStep=absent`,
`final blocks=0`. Byte lines: `bytes=MATCH` (base-r0), `tree-diff=0`, `entry-cmp=DIFFER` (the target
against the non-UTF-8 entry — `cmp` is a byte comparison and needs no decoding), `batches=before:1
after:1`. **An observation for 6b, bounded to this launch's screen**: the step drew those two
sentences and nothing else about the cause — the `NotUtf8` offset the wire carries
(`BackupReadFailedError.error`) reached no sentence, `describeCommandError` substitutes only
`path`/`offset` operands at the top level, and `tBackupReadError` — the accessor that *would* name
the offset — has no component caller. Whether that is acceptable wording is 6b's judgement to take,
not this step's; nothing here changed product code.

### 4.4 P57 — `restore-preview-bytes:en`, retained as a demonstration, superseded by P58

`failed-lines=1`: the candidate drew *"byte order mark U+FEFF"* and *"invisible character U+0007"*
and **no** carriage-return name, and the wait for one timed out. That is the design, not a defect:
`sourceText.ts` renders a CRLF pair as one break segment and names only a lone CR (its own header
says a CRLF file shows one break per line rather than one plus a marker). The fixture gained a bare
CR; P57 is retained as the demonstration that a CRLF-only document previews with no named CR.

### 4.5 P58 — `restore-preview-bytes:en`, the preview proof, and the geometry reporter's first run

`failed-lines=0`. The candidate step quotes *"82 bytes of UTF-8, and 80 characters"* (the +2 is the
BOM's), the `listedAgrees` sentence, and all three names — *"byte order mark U+FEFF"*, *"invisible
character U+0007"*, *"carriage return U+000D"* — around the fixture's own text. The geometry block:
five controls, every one `tabIndex=0`; the hit test answered `isTheControl` on four and
`descendantOfTheControl` on the entry row, whose centre lands on its inner `span.source`. The focus walk `focused=true`
on all five, `focus restored=false` (§3.3's disclosed limit). Byte lines: `bytes=MATCH` (base-r0),
`tree-diff=0`, `entry-cmp=DIFFER`, `batches=before:1 after:1` — a preview writes nothing.

### 4.6 P59 — `restore-withdraw:es`, the confirmation withdrawn by a change

The question drawn in Spanish with its two controls, then *Volver a listarlos* pressed inside the
batches step — and the actions row comes back to exactly one control,
`[Preparar la sustitución del archivo 235x27]`, with `question=absent` and `final blocks=0`. That is
consult Q4/Q5's *a catalogue refresh withdraws the confirmation* drawn on a real screen —
`loadingBatches` withdraws with the candidate kept, which is why prepare is immediately offered
again — where P51's cancel was the person declining. Byte lines: `bytes=MATCH` (base-r0),
`tree-diff=0`, `entry-cmp=DIFFER`, `batches=before:1 after:1`.

### 4.7 P60 — `restore-findings:en`, the acknowledgement walked to a committed write

The walk to the unparseable candidate (the step quotes the fixture's text whole), prepare, confirm —
and the refused outcome: *"Nothing was written. The file on disk is exactly as it was."*, the
verdict, the three `rawSave` sentences with **the parser's own position** (*"The YAML reader stopped
at line 3, column 0."*), the `acknowledgedAsksAgain` sentence (`willNotLoad=present`,
`acknowledgedAsksAgain=present` as separate dictionary-resolved readings), and the two choices
*[Save anyway] [Leave this as it is]*. *Save anyway* re-asks the destructive question — the actions
row shows both controls again — and the second confirmation commits: `replaced=present`,
`nothingToWrite=absent`, and the actions row afterwards holds the `alreadyRestored` sentence. Byte
lines: `bytes=MATCH` against `restore-broken.yml` — **the unparseable text is on disk**, the
raw-save-may-write-what-the-parser-rejects ruling measured through the restore path —
`entry-cmp=MATCH`, `backup-tree=SAME`, `batches=before:1 after:2`, `tree-diff=14` and it is exactly
two things: the minted batch and the target's own change. Read outside the oracle, by this reader:
the minted batch's `match/conflict.yml` `cmp`s equal to `base-r0.yml` — the restore backed up
exactly the bytes it displaced.

**And `windowOutOfStep=absent`**, which is a measurement this step did not predict: the committed
unparseable text **reprojected successfully**. §6.4 is what that establishes.

### 4.8 P61 — `restore-nothing:es`, the `committed: false` success

The same walk, question and confirmation as a replace, against an entry byte-identical to the
target — and the outcome is the documented success in which nothing was written:
`nothingToWrite=present` (*"El texto ya era exactamente el que tenía el archivo…"*),
`replaced=absent`, `windowOutOfStep=absent`, and the actions row afterwards offers plain prepare
again — **not** `alreadyRestored`, agreeing with `applyRestore`'s `restored: outcome.committed`.
Byte lines: `bytes=MATCH` (base-r0), `tree-diff=0`, `entry-cmp=MATCH`, `backup-tree=SAME`,
`batches=before:1 after:1` — **a `committed: false` success takes no backup**, agreeing with
`save.rs`'s `backup = if committed`.

### 4.9 P62 — `restore-reload:en`, the conflict adopted and the candidate written over the adopted base

The full chain in one launch. The writer moves the file after the question
(`--- writer second wrote=yes`); the confirmation meets a revision the pane never saw; the conflict
panel holds `2543689c… / beba1b1f… / beba1b1f…` — this tree's R0 and R1 digests, `expected ≠ found`,
`diskRevision == found` — with exactly two choices *[Leave this as it is] [Load the version on
disk]*, no reapply of either kind and no readiness sentence. The geometry reporter, run **while the
conflict is on screen**, measured the pane scrolled to `scrollTop=1338`: four upper-pane controls
`outsideViewport` (*Close*, *List them again*, the batch row and the entry row — the first is the
pane's own and the other three are the catalogue's), the two conflict choices `isTheControl`, and the sticky actions row pinned at
`y=-3` with the disabled prepare control's centre answered as
`somethingElse(tag=header class="svelte-whg6dh")` — **the one covered control this step found, and
it is disabled at that moment**; whether that covering matters is 6b's to judge with the panel in
its read state. The reload warning quotes the withdrawal sentence (*"Your confirmation is
withdrawn, because it was given against the reading this window held before…"*), the three revision
sentences, the retained operation and the disk version whole; *Load it and keep the text selected
here* clears the outcome panel (`afterReload outcomePanel=absent`) and the actions row returns to
enabled prepare. The second prepare/confirm then **commits**: `replaced=present`, the final block
with the backup-taken sentence, `failed-lines=0`.

**What discriminates the adoption as `installed`, stated as the reader's conjunction it is**: a
session resends its frozen base, so had the reload left the base where it was, the second
confirmation would have met R1 with an R0 base and conflicted again — instead it committed, and
`bytes=MATCH` against `restore-entry.yml` with `entry-cmp=MATCH`. And the minted batch
(`batches=before:1 after:2`; `tree-diff=18` is the batch plus the target's change) holds bytes that
`cmp` equal to **`elsewhere-r1.yml`** — the displaced text was the *writer's*, which is only
possible if the write happened over the adopted disk version. The transcript prints no
`DiskAdoptionOutcome` value and cannot; nothing on the screen distinguishes `installed` from
`alreadyThere` — §6.3 is why `alreadyThere` cannot have been the answer here.

## 5. What this step does not reach and does not prove

Bounded as 5a §6.1 binds every absence sentence: each item is a limit of these artifacts, not a
promise about anything else.

- **No bilingual coverage per state.** English drove P55, P58, P60, P62; Spanish drove P56, P59,
  P61. No new state was drawn in both languages here; 6b owes that on every state.
- **No-write equivalence binds every `unchanged`-shaped reading** exactly as 5a §6.1 states: there
  is still no invoke spy and no command counter, so `tree-diff=0` and `backup-tree=SAME` are
  readings of final bytes.
- **The displaced-bytes comparison of a minted batch is a reader's step, not a script line.** The
  two readings here (P60's batch holds R0, P62's holds R1) were taken by hand with `cmp`. Adding a
  `minted-batch=` line to `bytes.txt` would need a per-case displaced-bytes column; it was not
  added, the script still conjoins nothing, and 6b takes the same reading by hand per launch.
- **`--- end` is printed unconditionally, `HTMLElement.click()` bypasses hit testing** (the
  reporter's `elementFromPoint` is the one measurement that does not), and a transcript sentence
  prints whether or not it is true — all of 5a's standing limits, inherited whole.
- **The geometry lines compare with nothing** — not with 5a's, not with each other across launches;
  P58 and P62 even ran at different viewport widths.
- The un-demanded states of §1's closing list remain undrawn, on the arguments given there.

## 6. The unreachability arguments, each grounded in the shipped code

### 6.1 Open-surface refusal (`writeSurfaceOpen`, all six arms)

`RestorePane` draws the refusal when `competingSurfaceFor` finds another surface open over the
target, and `DetailPane.svelte` is the **only producer** of the surface list (`openWriteSurfaces`).
In the shipped window the seven write surfaces are drawn by one `{#if}/{:else if}` chain and their
openers are withdrawn while any is open (`busy`, `DetailPane.svelte:664-672`; the creation opener at
`:820`; the restore opener lives **inside the file-text branch**, which is the chain's last arm and
is only rendered when every other surface state is null). So no reachable sequence of clicks leaves
a competing surface open when the restore pane mounts, and none can open one afterwards — the
openers are gone while `restoring !== null`. The refusal exists as the model's defence for the day
the exclusion stops holding, is driven by 2c-5-4's mounted matrix (which hands `surfaces()` any
value it likes), and **cannot be drawn by driving the shipped window's own controls**, which is all
this instrument does. Reaching it would mean changing product code, which no instrument step may do.

### 6.2 The persistent `targetMoved` refusal sentence

`restoreRefusal` answers `targetMoved` when the observed revision is null or differs from the
session's base — but `RestorePane`'s own `$effect` runs `targetRevisionObserved` on every change,
and that transition **re-points the base and withdraws the confirmation** (`measuredAgainst`,
`restore.ts`) in the same update, so a moved revision never leaves the sentence standing. The
`observed === null` half needs the window to hold **no projection** of a file whose restore pane is
open with a candidate — and the two producers of that state are ordered away: a failed re-read after
a committed restore leaves `session.restored` true, so `alreadyRestored` wins the ordering
(`restoreRefusal`'s first arm), and a file that never projected cannot open the pane at all
(`DetailPane.svelte:1006` gates the opener on `parse !== null`). What the demanded *behaviour* —
"target changed after preview" — looks like on a real screen is therefore P52's conflict and P62's
adoption-with-withdrawal, both launched; the sentence itself is unreachable except transiently
within one update, which no polling driver can honestly pin.

### 6.3 Adoption `alreadyThere` and `refused`

`BrowserState.adoptDiskVersion` (`workspace.svelte.ts:2045-2141`) answers `alreadyThere` only when
the window's held projection **already has the conflict's disk revision**, and `refused` only for a
foreign or spent confirmation, a conflict this state never produced, a dropped projection, or a
projection **generation** moved since the conflict arrived. Between the conflict's arrival and the
reload confirmation, the only surface open is the restore pane (§6.1), and none of its reachable
controls re-reads or re-installs a projection: the pane's transitions move only the session, the
listing commands are read-only, and the Rust-side `conflict_after_the_lock` refresh is backend
cache, not the frontend projection. A double-press of the confirm control cannot produce the spent
arm either — the first press clears the outcome panel synchronously (`adoptDiskVersion` is
synchronous by type — `AdoptTheDiskVersion` returns the outcome, not a promise), so the control is
gone before a second press exists. Both arms are driven by `restore.test.ts` and the mounted matrix;
neither can be produced by this instrument without new machinery (a projection-moving probe command,
i.e. a `probe.rs` change this step is directed to avoid). Q7's "where reachable" qualifier is
carried by this argument.

### 6.4 Committed-but-reprojection-failed

The invalidation fails only when `adoptTheReplacedDocument`'s re-read refuses
(`workspace.svelte.ts:3444-3451`, `commands.getDocument`). **A parse failure does not refuse it**:
`ParseFailed` is a `DiagnosticCode` on a successful projection (`src/lib/ipc/types.ts:269-317`), and
P60 measured exactly that — a committed `matches: [` reprojected, and the saved outcome drew
**no** `windowOutOfStep` sentence (the transcript's reading is `windowOutOfStep=absent`; the
transcript line itself is always printed). What remains is a file that is non-UTF-8, unreadable or gone at the
instant of the re-read: a restore writes a JavaScript string (valid UTF-8 by construction), both
external writers replace the same file whole with valid-UTF-8 fixtures, and the re-read follows the
commit inside the same coordinator call with **no plan step between them** — so producing the
failure needs a new writer racing the commit window, which is a nondeterministic race and a
`probe.rs` change at once. The state stays covered by 2c-5-3's model evidence
(`restore.test.ts`'s committed-invalidation-failure cases); this instrument cannot reach it, and
P60 is the measurement that closed the one deterministic route this step had hypothesized.

## 7. The gates, re-derived with the harness in the tree, after the last driver edit

Predicted before building: **no movement anywhere** — the driver edits are inside `src/probe.ts`
(0 modules; already among `svelte-check`'s files; no new test), `launch.sh` and `byte-fixtures.sh`
live outside the repository, and `probe.rs` was untouched. Measured:

| Gate | Prediction | Measurement |
|---|---|---|
| `cargo test --workspace` | 1153 passed, 0 failed | **1153** passed, 0 failed |
| `npm run check` | 432 files, 0 errors, 0 warnings | **432** files, 0 errors, 0 warnings |
| `npm test` | 2124 passed | **2124** passed (56 files) |
| `npm run build` | 185 modules | **185** modules transformed |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | finished, no warnings |
| `cargo fmt --check` | clean | clean |
| bundle oracle, server-only (`\$\$payload\|head_payload\|push_element`) | absent | **absent** (`rg -c` matched nothing) |
| bundle oracle, client-only (`window\.__svelte\|svelte-trusted-html`) | 2 | **2** |

Prediction and measurement agree on every row; the with-harness baseline stays
**1153 / 432 / 2124 / 185**.

## 8. The manifest, the repository, and the 2c-5-7 deletion-list delta

**`manifest-2c-5-6a-cases.sha256` — 38 entries, written fresh**: the five scripts
(`byte-fixtures.sh` now among them), the thirteen fixtures, both probe sources by absolute path, and
the `probe.log` and `bytes.txt` of P54–P62. `shasum -a 256 -c` succeeds for all 38. **Neither 5b
manifest was regenerated**; checked now, each fails on exactly two entries — `launch.sh` and
`src/probe.ts`, precisely the two files this step edited — and that failing pair is the record of
what 6a changed, kept rather than erased (3d-2a §8.5's lesson, once more).

**The repository after this step.** `git status --short --untracked-files=all` lists exactly the
four harness paths — `src/main.ts` and `src-tauri/src/main.rs` modified, `src/probe.ts` and
`src-tauri/src/probe.rs` untracked — plus this record untracked, and nothing else; `git diff
--stat` over the two hook files still reads **5 insertions, 1 deletion**. No git command that
changes anything was run.

**The 2c-5-7 deletion list is not lengthened.** No new decoy, no outside-tree file and no
outside-tree symlink was created by any 6a case: the list remains 5b §2 item 8's four decoys
(`/private/tmp/espansoconfig-probe-decoy-C11.yml` … `…-C14.yml`) plus the tree itself. Three
symlinks now live **inside** launch directories and go with the tree — P54's
`launches/P54/xdg/espanso/.espansoconfig-backups/2026-08-18T090000Z` (pointing at its unmarked
sibling directory) and P55's same-named link (pointing at the recognised batch's marker file), each
mirrored in that launch's `xdg-before/` copy — named here so no later sweep mistakes them for
residue that outlives an `rm -rf` of the harness path. The tree gains `byte-fixtures.sh`, the three
fixtures of §2.2, the nine launch directories P54–P62 and the 38-entry manifest.

## 9. Under-specified choices, each named

1. **The junk seed's three shapes and names** are this step's own; `backup.rs` fixes the grammar and
   the skip arms, and no record fixes which instances a seed should use.
2. **The symlink's target is a file, chosen after P54** (§4.1, §5.1). The scanner's behaviour is
   identical for both target kinds — `child_directory` refuses the link before resolving it — so
   the choice trades nothing away and keeps `diff -r` usable as the whole-tree oracle.
3. **The language assignment per case** (en: skipped, preview, findings, reload; es: notutf8,
   withdraw, nothing) is this step's own, for aggregate coverage; 6b re-takes every state in both.
4. **`restore-nothing` borrows the replace tail** rather than owning a plan function; the case's own
   `runCase` arm is what the three-places rule requires, and the borrowed-plan convention is
   `runCase`'s documented shape since 5a.
5. **The three outcome-mark lines replaced the replace tail's single `replaced=` line**, a change to
   a shared path whose 5b launches were not re-taken; their transcripts stand as records of the
   older driver, and every consumer of the new lines is a launch of this build.
6. **The geometry reporter's call sites** (preview, and reload's conflict moment) are this step's
   own; 6b may call it from any tail it extends, and nothing outside those two calls exercises it.

## 10. Disposition of the round-1 review

One review round ran over the whole of 6a — the record, the driver edits, both harness scripts, the
seeded layouts against `backup.rs`, the four unreachability arguments against the shipped
components, and the nine retained transcripts. The reviewer's sandbox was read-only and no review
file was created; the orchestrator captured the final message verbatim to
`docs/reviews/phase-2c-5-6a-instrument.md` under a capture note, exactly as 5a's rounds 6–7 and
5b's round 1 were captured. **The verdict was NOT READY, with one Medium and one Low — both prose,
neither an instrument defect**: the review verified all four unreachability arguments against the
shipped code, every case row and fixture against the driver, the seeded catalogue against
`backup.rs`, the byte oracle's independence, the manifest, and that `probe.rs` was untouched and no
confinement widened.

**Finding 1 (Medium) — two `src/probe.ts` comments claimed the `findings` tail reaches a failed
window-side re-read.** The record's own §6.4 said the opposite, correctly, and P60 measured
`windowOutOfStep=absent`; the driver's case-list entry and `acknowledgeFindingsThenReplace`'s
JSDoc were written before P60's measurement and never corrected — the same defect class as the
record over-claim, living in a comment instead. **Fixed**: both comments now state that the
re-read of unparseable text succeeds, installs a projection carrying diagnostics, and that this
tail never reaches committed-but-reprojection-failed, citing P60. The fix changed comments only;
no behavior, no rebuild owed for correctness of any retained launch (each pins the binary that ran
it), and no launch re-taken.

**Finding 2 (Low) — three transcript misreadings in §4.** Fixed: P58's geometry now reads four
`isTheControl` hits plus one `descendantOfTheControl` (the entry row); P62's four off-screen
controls are enumerated (*Close* is the pane's own, not the catalogue's); the `1080x728` width is
credited to P61 and P62 both. Sweeping for the **shape** of finding 1 rather than its words also
sharpened one §6.4 sentence: "drew no `windowOutOfStep` line" now says *sentence*, with the
transcript's always-printed `=absent` line named, so the outcome-panel reading cannot be mistaken
for a claim about the transcript. `src/probe.ts:1246`'s description of what the key *means* was
checked and left standing — it describes the dictionary sentence, not this tail's reach.

**What the fixes change for the artifacts**: `manifest-2c-5-6a-cases.sha256` now fails on exactly
one of its 38 entries — `src/probe.ts`, the fix-round edit — kept as the record of the change
(3d-2a §8.5's lesson, once more); `manifest-2c-5-6a-fix.sha256` is the fresh post-image of the two
files this round touched (`src/probe.ts`, this record — the latter hashed as of this section). The
gates after the fix are unchanged by prediction (comments and markdown only) and were re-derived:
see the checkpoint's verification section. A fix is a change, and its review round follows; this
section records the round-1 disposition and the round-2 brief is scoped to these edits.

### 10.1 The round-2 verdict, closing this step

Round 2, scoped to the fix round, returned **READY with no findings**
(`docs/reviews/phase-2c-5-6a-instrument-round2.md`, captured verbatim as round 1 was): both driver
comments verified true of the shipped code and of P60's transcript, all three §4 corrections
transcript-exact, §10's manifest and gate claims within the evidence, the shape sweep finding no
narrower instance standing, and no fix-round edit regressing a previously true sentence. No fix
round follows. This subsection is the record's only write after that verdict, and it postdates
`manifest-2c-5-6a-fix.sha256`'s entry for this record — that entry now fails, kept as the record of
this write, exactly as `manifest-2c-5-6a-cases.sha256`'s one failing entry records the fix round
itself.
