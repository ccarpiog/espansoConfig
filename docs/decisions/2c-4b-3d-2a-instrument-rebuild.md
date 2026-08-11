# Phase 2c-4b step 3d-2a — the window-reading instrument, rebuilt

Step 3d-2b is the re-take window reading over six Svelte components. **This step is not that
reading**, and nothing here judges a screen. It rebuilds the half of the reapply instrument that was
lost — the scratch tree — and shows, with six launches and one per write surface, that the rebuilt
whole runs before 3d-2b depends on it, exactly as 3b exercised the instrument before 3c-2's reading
and 2c-4a-3c-1 provoked a true `SaveResult::Conflict` before its own reading.

**Rebuilding it faithfully was not the same as making it sufficient, and the review of this step is
what found the difference.** Six launches showed that a tree built from the records reaches every
write surface; they could not show what the records never described. Two of the four obligations
`PROGRESS.md`'s "What 3d-2 owes" list numbers had **no case at all** — `browser.notice.gone` had
never been drawn in this project's history, and no fixture could make a drafted editor field
ineligible. §8 is the round that built the three cases and took the five launches that close them;
§6.7 is what the instrument reaches and what it does not, obligation by obligation, keeping a path
with no case apart from a path with a case and no launch.

**The harness has two halves and one of them survived.** `src/probe.ts`, `src-tauri/src/probe.rs`
and the four hook lines were still in the working tree, untracked or unstaged. The scratch tree that
held `launch.sh`, the fixtures and `launches/L01`…`L110` is gone. **`src/probe.ts` was extended by
this step's own fix round** — §8, three new cases — and `src-tauri/src/probe.rs` and the four hook
lines were not; §1 says how strong that second claim can be made from the artifacts that survive.

**What was rebuilt was rebuilt from prose, and that is the sharpest limit of this step.** The sweep
§1 describes found no copy of the deleted tree, so every fixture rebuilt here is **re-authored from
the descriptions** in `2c-4b-3b-instrument.md` §4, `2c-4b-3c-1-notes.md` §2 and
`2c-4b-3c-2-window-reading.md` §1.3, not recovered. The two fixtures §8 adds are neither rebuilt nor
re-authored: no record describes them, because the instrument the records describe had no case that
needed them.

**Byte-identity with the originals is contradicted for two files and unknown for the other
seventeen, and those are different statements.** §4.2 has an old digest and a new one for
`base-r0.yml` and `elsewhere-r1.yml`, and they differ — so for those two, byte-identity is
positively contradicted. For the other seventeen rebuilt files there is **no surviving original, no
old digest and no before-manifest**, so byte-identity is neither claimed nor contradicted; it is not
established either way. §6 says what follows from both halves.

---

## 1. Where the tree is, and what happened to the old one

**The new scratch tree is `/private/tmp/espansoconfig-harness-2c-4b-3d/`**, outside the repository.
3d-2b and 3d-3 both need that path.

```
/private/tmp/espansoconfig-harness-2c-4b-3d/
  launch.sh                     one launch: the case table, the seed, a fresh bundle, the wait, the byte checks
  fixtures/                     21 files — 12 R0/R1 documents and 9 authored expected-bytes documents
  launches/P01…P11/             per launch: xdg/, xdg-before/, home/, espansoConfig.app, probe.log, probe.err, bytes.txt
  manifest-3d-2a-post.sha256    46 entries — a post-image, in 3c-1 §5.7's sense
```

**Nineteen of the fixtures and six of the launches are the rebuild's; two fixtures and five launches
are the fix round's** (§8). Every count in this record is the tree as it now stands unless it says
otherwise.

**The old tree is gone.** It was
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/a95eea9d-1e3d-4344-9470-91a69a4e6e99/scratchpad`;
that directory does not exist, and its parent now holds exactly one unrelated session directory.
A sweep of `/private/tmp` eight levels deep — `rg --files --hidden --no-ignore` — finds exactly one
`launch.sh`, this step's own, and no path carrying the dead session's id. That is a statement about
`/private/tmp` and about nothing else on the machine.
`manifest-3c-1-post.sha256` and `manifest-3c-2-post.sha256` lived in that tree and the sweep did not
find them either, and no manifest is under version control, so **this step had no before-image to
check anything against**.

**The owner's real configuration was never opened.** Every launch points `XDG_CONFIG_HOME` at the
synthetic two-file tree `launch.sh` writes and `HOME` at an empty directory, so neither candidate
`resolve_config_dir()` (`crates/espansoconfig-core/src/discovery.rs:218`) probes can reach it. Every
fixture is neutral and hand-authored: `:alpha`, `:beta`, `:gamma`, `:probe` and nothing else.

**The tracked files that differ from `HEAD` are the two the harness hooks and `PROGRESS.md`, and
`HEAD` is still 3d-1's commit — and that is a reading of the tree *as it stood at the close of the
round-2 fix pass*, never a comparison with a before-image, and never a claim about the tree at any
later moment.** That is a **named event, not "the last time this file was edited"**: this record has
been amended since, by the round-3 fix, and a reading bound to a moving moment would have decayed
with it. `git status --short --untracked-files=all`, read at that event, listed eight paths:
`src/main.ts`, `src-tauri/src/main.rs` and `PROGRESS.md` modified, `src/probe.ts` and
`src-tauri/src/probe.rs` untracked, and three untracked documents under `docs/` — this record and the
two reviews of it. `git diff` over the two hook files was exactly the four lines §2 quotes; the rest
of the diff was `PROGRESS.md`'s own checkpoint entry for this step. The branch tip was `e494095`, the
commit that recorded 3d-1.

**That reading is deliberately taken before this step's checkpoint commit, and the commit changes
it.** The checkpoint stages `PROGRESS.md` and **four** documents under `docs/` **by path** — this
record and its **three** reviews, rounds 1, 2 and 3 — and leaves the four harness paths
(`src/main.ts`, `src-tauri/src/main.rs`, `src/probe.ts`, `src-tauri/src/probe.rs`) in the working
tree for 3d-2b to use and 3d-3 to delete. So after it, the eight-path list above is **four**, and the
branch tip is no longer `e494095`. **The count of reviews is the part of this prediction that has
already moved once**: an earlier draft said *three documents* because only two reviews then existed,
and round 3's review made that arithmetic wrong before the commit it describes was taken. A
prediction naming a set that is still growing is worth stating only with the set enumerated, which is
why the three rounds are named rather than counted. `PROGRESS.md`'s git-state
table is where the commit that replaced it is recorded; this record does not carry its own SHA,
because a record cannot name the commit that contains it.

**What no artifact here can establish is what this step did *not* alter along the way.** No
before-image of the working tree survives: `manifest-3c-1-post.sha256` and
`manifest-3c-2-post.sha256` lived in the deleted tree, no manifest is under version control, and
`manifest-3d-2a-post.sha256` is a post-image by construction. So the categorical *this step touched
no harness file* that a first draft of this record made is not available, and it would have been
**false** in any case: `src/probe.ts` was extended by the fix round (§8). What the artifacts do
support are readings taken **at the moment stated above and at no other**, and they are the whole of
it — the tracked diff against `HEAD` was the four hook lines §2 quotes plus `PROGRESS.md`'s
checkpoint entry, and the branch tip was 3d-1's commit. Both cease to hold at the checkpoint commit,
exactly as the paragraph above says. *No git command that changes anything was run* is
**not** among them: that is an account of what was done, and every artifact here is a post-image.

## 2. What was rebuilt, file by file, and from which record

| Rebuilt file | Rebuilt from |
|---|---|
| `launch.sh` — the recipe, the wait, the checks | 3b §2 (the `open` invocation verbatim), 3b §6.1 (the build order), 3b §8.9 (what it may and may not conjoin) |
| `launch.sh` — the case table, 20 rows as rebuilt, 23 now | 3b §4 (11 cases), 3c-1 §2 (8 cases), 3c-2 §1.3 (`mover-reordered-end`); the three added rows are §8's and come from no record |
| `fixtures/base-r0.yml` | 3b §4: one comment line, a `matches:` sequence of `:alpha`, `:beta`, `:gamma`, each a double-quoted `trigger:` and a plain `replace:` |
| `fixtures/elsewhere-r1.yml`, `target-changed-r1.yml` | 3b §4 |
| `fixtures/target-labelled-r1.yml` | 3c-1 §2.1, which quotes the three lines whole |
| `fixtures/target-satisfied-r1.yml` | 3c-1 §2.2 |
| `fixtures/target-ambiguous-r1.yml` | 3c-1 §2.3, which quotes the two `":beta"` items whole |
| `fixtures/target-deleted-r1.yml` | 3c-1 §2.4 |
| `fixtures/reordered-r1.yml`, `anchor-changed-r1.yml` | 3c-1 §2.5 |
| `fixtures/reordered-beta-first-r1.yml` | 3c-2 §1.3 |
| the 9 `*-expected.yml` files | 3b §4 and 3c-1 §2.5's *Expected afterwards* columns, 3c-2 §1.3 for `mover-end-expected.yml` |
| `fixtures/target-empty-replace-r1.yml`, `target-empty-quoted-r1.yml` | **no record** — §8 authored them, from the eligibility rules in `src/lib/browser/matchEditor.ts` |

**The last row is the fix round's and every row above it is the rebuild's**, and the distinction
matters because "re-authored from a description" and "authored from the code" are different
provenances and neither one is recovery.

**Neither probe source was rebuilt; `src/probe.ts` was extended and `src-tauri/src/probe.rs` was
not.** Both survived, and both are hashed into `manifest-3d-2a-post.sha256` so a later step has a
before-image for them. **That is a post-image and not a verification**: no manifest of 3c-2's tree
survives, so nothing here checks either file against what 3c-2 left. What can be said about
`src/probe.ts` is narrower than it was before the fix round: it now differs from whatever 3c-2 left
by **at least** the three cases §8 adds — one new plan function, one new parameter and a default on
`editorPlan`, three switch arms and their comments — and no artifact can tell whether it differs by
anything else besides. *This step ran no editor over `src-tauri/src/probe.rs`* is an account of what
was done rather than a reading of an artifact; what the tree gives for that file is the digest §8.5
records, and §6.5 is where the difference is stated as a bound.

**What the tree gives for the four hook lines is that they are present and are the four the records
specify.** `git diff` shows exactly `mod probe;` and
`probe::register_with_probe(tauri::Builder::default())` in `src-tauri/src/main.rs`, and
`import { startProbe } from './probe';` and `startProbe();` in `src/main.ts`, and nothing else in
either file. *They were checked and none needed restoring* is an account of what was done, in the
same class as the `probe.rs` sentence above: with no before-image there is no artifact that
distinguishes a line never disturbed from one restored to the same bytes. **For this step's purpose
the distinction does not matter** — what a launch depends on is that the hooks are correct now, and
that the diff does establish.

### 2.1 Two things the step brief said that the surviving driver corrects

Both are corrections to the brief, not deviations of this rebuild, and both are read off
`src/probe.ts` rather than argued.

- **Twenty cases, not nineteen.** `runPlan`'s switch had 20 arms as it survived: 3b's 11, 3c-1's 8,
  and `mover-reordered-end`, which 3c-2 §1.3 added. **Nineteen is the count of *fixture files***,
  which is what the brief's "19 files" names correctly: 3b left 8, 3c-1 added 9 for 17, and 3c-2
  added 2 for 19. The case count and the file count were both 19 when 3c-1 handed over, which is
  where the brief's "19 cases" comes from; 3c-2 moved one of them and not the other. **The tree now
  holds 23 cases and 21 fixture files**, because §8 added three and two; the twenty is what the
  correction to the brief is about, and both later numbers are this step's own doing.
- **`BLOCK_TEXT_LIMIT` is 4000, not 1500.** 3c-1 set 1500; 3c-2 §1.2(4) raised it to 4000 so that
  the editor's readiness sentence would survive in the transcript. The surviving file says 4000.

## 3. The launch recipe, as this tree runs it

```sh
# once, and IN THIS ORDER — 3b §6.1, because the bundle embeds `dist` at *cargo* build time
npm run build
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol

# per launch, into a launch name never used before
/private/tmp/espansoconfig-harness-2c-4b-3d/launch.sh <case>[:<lang>[:twice]] <name>
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

The script refuses a launch name it has already used, seeds `base-r0.yml` as
`xdg/espanso/match/conflict.yml` beside a synthetic `xdg/espanso/config/default.yml`, copies the
tree to `xdg-before/` before launching, assembles the `.app` by **copying whatever `ECFG_BINARY`
names** — `launch.sh:33`, which defaults to `target/debug/espansoconfig`, and `launch.sh:103`, which
copies it — waits for `--- end` or 25 seconds, `cmp`s the target against the case's expected file,
searches for `.espansoconfig-backups`, and diffs the tree against the pristine copy. **It conjoins
none of that** — 3b §8.9 — and this rebuild did not give it the power to.

**"Freshly built" is not a claim these artifacts can carry, and the earlier wording of the paragraph
above made it.** Nothing in the script checks a timestamp, re-runs the build or records a build
transcript, and none was retained; the block above is the recipe in the order 3b §6.1 requires, and
no retained artifact shows those commands running at all. What the retained bundles *do* pin is
**which bytes ran**, and §5.10 is that measurement — including the fact that P01–P06 and P07–P11 ran
two **different** binaries.

## 4. The proof launches

**This section is the rebuild's six. The fix round's five are §8, and they ran a different binary
(§5.10).** Nothing below was re-taken after the fix round, and the retained bundles are what says so:
P01–P06 still carry `3f1b3506…`, which the current `target/debug/espansoconfig` is not.

Six, deliberately bounded — one per write surface, and no more. Each satisfies, by hand, the same
four-part conjunction 3b §8.9 defines
and 3c-1 §4 and 3c-2 §1.5 applied: no `--- failed` line; a conflict block with three revisions where
`expected ≠ found` and `diskRevision == found`; the expected control and action lines for that
surface; and the intended byte predicate. **Nothing in the harness conjoins those four; a reader
did, on all six.**

| # | Case | Surface | Lang | `expect=` | `bytes=` | `backups=` | `probe.err` | `--- end` / `--- failed` |
|---|---|---|---|---|---|---|---|---|
| P01 | `editor-exact` | editor | en | `editor-exact-expected.yml` | **MATCH** | **PRESENT** | 0 bytes | present / absent |
| P02 | `mover-changed` | mover | es | `target-changed-r1.yml (R1)` | **MATCH** | **none** | 0 bytes | present / absent |
| P03 | `creator-front` | creator | es | `creator-front-expected.yml` | **MATCH** | **PRESENT** | 0 bytes | present / absent |
| P04 | `raw-negative` | raw | en | `elsewhere-r1.yml (R1)` | **MATCH** | **none** | 0 bytes | present / absent |
| P05 | `deleter-exact` | deleter | en | `deleter-exact-expected.yml` | **MATCH** | **PRESENT** | 0 bytes | present / absent |
| P06 | `duplicator-exact` | duplicator | es | `duplicator-exact-expected.yml` | **MATCH** | **PRESENT** | 0 bytes | present / absent |

Six launches, **all six write surfaces**, both languages, four positives and two refusals. Every one
picked its language **through the picker** and printed `documentElement.lang` — `en` in P01, P04 and
P05, `es` in P02, P03 and P06 — which is 3b §6.7's rule, and it matters because the WebKit data
store follows the bundle identifier that every probe bundle shares.

### 4.1 What each one showed, quoted from its retained transcript

- **P01** — conflict panel `box=658,44,491x1032`, three revisions with `expected ≠ found` and
  `diskRevision == found`, four choices in the order *Keep editing · Copy my text · Keep my draft ·
  Load the version on disk*, `keepMyDraft=present keepMyRequest=absent`, `readiness ready=present
  box=667,921,472x119`, *Keep my draft* pressed, a `reapplied` report, the editor's send control
  pressed again, and a final block saying the file was written. The file ends byte-identical to
  `editor-exact-expected.yml`: `:beta`'s `replace` is the drafted `probe edit` and `:alpha`'s
  externally written line is intact.
- **P02** — conflict panel `box=658,44,491x775`, `keepMyDraft=absent keepMyRequest=present`,
  *Conservar lo que he pedido* pressed, a Spanish `manualResolution` report. The file ends
  byte-identical to R1, the backup search of §5.4 found nothing, and the tree diff is exactly the
  second writer's own change to `:beta` and nothing else.
- **P03** — placement *Al principio de la lista* chosen inside the creator's own section, conflict
  panel `box=658,44,491x908`, *Conservar mi borrador* pressed, a Spanish `reapplied` report, the
  creation control pressed again, and a final block saying the file was written. The file ends
  byte-identical to `creator-front-expected.yml`.
- **P04** — conflict panel `box=658,196,491x493`, **three** choices and `keepMyDraft=absent
  keepMyRequest=absent`, `readiness ready=absent readyOperation=absent`. The file ends byte-identical
  to R1, `backups=none`.
- **P05** — conflict panel `box=658,44,491x758`, `keepMyRequest=present`, *Keep what I asked for*
  pressed, then the deletion **request** control and the **confirmation** control each found and
  pressed — a missing one would have printed `--- failed` — and a final block saying the file was
  written. The file ends byte-identical to `deleter-exact-expected.yml`: `:beta` is gone and
  `:alpha`'s externally written line is intact.
- **P06** — conflict panel `box=658,44,491x758`, `keepMyRequest=present`, *Conservar lo que he
  pedido* pressed, the duplicate control pressed again, and the ordinary
  `DuplicateKeepsTriggerDefinition` acknowledgement waited for and pressed — *Guardar de todos
  modos*, `box=667,486,150x23` — then a final block saying the file was written. The file ends
  byte-identical to `duplicator-exact-expected.yml`: two adjacent `:beta` items and `:alpha`'s
  externally written line intact.

**A control this list says was "pressed" is one the driver waited for and clicked, and the
transcript prints no line for it.** `pressNamed` throws when the control does not arrive, and
`startProbe()` catches that and prints `--- failed`; no launch printed one, and each positive
launch's final block says the file was written. That conjunction is the evidence, and it is a
reader's, not the harness's.

**Four panel rectangles reproduce 3c-2 §4.1 exactly and two do not, and neither half is judged
here.** The viewport is the same `1180 x 728`, `hasFocus=false visibility=hidden`. Reproduced:
P01's editor `491x1032` at `y = 44`, P03's Spanish creator `491x908` at `y = 44`, P04's raw
`491x493` at `y = 196`, P06's Spanish duplicator `491x758` at `y = 44`. **Taller than 3c-2's figure
by 17 pixels: P05's English deleter, `491x758` against `491x741`, and P02's Spanish mover,
`491x775` against `491x758`.**

**Two things could produce that difference and this step separates neither.** 3d-1 changed the
components between 3c-2's reading and now, and **this tree's fixtures are re-authored** (§4.2), so a
`replace:` value of a different length can wrap the file's own text differently inside a panel that
draws it. Recorded as a measurement for 3d-2b to re-take, **not** as a regression claim.

### 4.2 The revision digests are **not** the recorded ones, and that is evidence about the fixtures

3b §5 records R0 as `507e98f5…` and `elsewhere-r1.yml` as `31be59eb…`; 3c-1 §4 records both
unchanged, and 3c-2's L40 reproduced them on that machine.
**This tree's R0 prints `91f2c4df…` and its `elsewhere-r1.yml` prints `cfa69124…`.** The
digests differ, so either the fixture bytes differ from the originals or the revision function moved
between 3c-2 and now; the fixtures were re-authored from prose, so **byte-identity with the
originals was never claimed and is now positively contradicted for R0 and `elsewhere-r1.yml`**. What
follows practically: **3d-2b cannot use digest equality with 3c-2's ledger as a continuity check**,
and any launch record it writes should print its own digests rather than repeat 3c-2's.

## 5. Deviations from what the records describe

Each is a place this tree differs from the instrument the records describe. None is an improvement
offered silently. **5.10 is a measurement rather than a deviation** and sits here because it is what
replaces a claim §3 used to make; **5.11 is the fix round's deviation**, and §8 is its detail.

**5.1 A new scratch path, and not a session scratchpad.** The tree is
`/private/tmp/espansoconfig-harness-2c-4b-3d/`, a stable path, rather than this session's own
scratchpad directory. **The reason is what this step exists to repair**: the deleted tree *was* a
session scratchpad, keyed to a session id that no longer exists, and 3d-2b and 3d-3 are different
sessions. The dead path is not reused.

**5.2 The nineteen rebuilt fixtures are re-authored, not recovered.** §4.2 is the observation, and it
reaches **two** of the nineteen: `base-r0.yml` and `elsewhere-r1.yml` are the only files this tree has
an old digest for, so they are the only two whose difference from the originals is established.
Their content follows the records' descriptions — including the three lines 3c-1 §2.1 quotes and the
two items 3c-1 §2.3 quotes, which are reproduced character for character — but every byte no record
fixes is this step's choice. In particular **the leading comment line's wording is this step's own**:
3b §4 says "one comment line" and no record quotes it. **The two fixtures §8 adds are outside this
deviation** — they are not re-authorings of anything, because no record describes them.

**5.3 The second file of the synthetic tree is this step's own.** The records say "a synthetic
two-file tree" and never what the second file holds. Here it is
`xdg/espanso/config/default.yml`, two lines, neutral, never opened by any plan. It exists so the
sidebar draws the *Profiles* group the transcripts show.

**5.4 The backup search does not use `fd`.** `fd` is not installed on this machine, and the records
do not say which tool the old script used — only that it "searches the whole synthetic tree". This
script does it in two halves: a direct `[ -d ]` test on `<config root>/.espansoconfig-backups` — the
name is `BACKUP_DIRECTORY_NAME` in `crates/espansoconfig-core/src/persist/backup.rs:150` and
`persist/mod.rs:108` puts it as a **direct child of the config root**, which P01 and P03 then
confirmed by producing exactly that path — and a sweep with `rg --files --hidden --no-ignore` for
any path passing through a backup directory anywhere. `backups=none` requires both to find nothing.
The directory test is what catches an **empty** backup directory at the root, which a file listing
cannot see; **an empty one somewhere else would still evade both halves**, and no `backups=none`
line in this record claims more than these two searches performed.

**5.5 `bytes.txt` carries an `expect=` line.** The records cite `bytes=` at line 4 and `backups=` at
line 5 of the old `bytes.txt` and never mention an `expect=` line; this step's brief asks for that
field, so line 6 is `expect=<file> r1=<file> refusal=<column>`. The lines the records do cite keep
their positions.

**5.6 The script kills the application after the wait.** `pkill -f "$APP/Contents/MacOS/espansoConfig"`,
then one second. No record describes this; without it every launch leaves a live process sharing the
bundle identifier that the next launch's WebKit data store also uses. This runs **after** the wait
and **before** the byte checks.

**5.7 The bundle is hand-assembled.** `cargo build` produces a bare binary, so `launch.sh` writes an
`Info.plist` carrying `cc.carpio.espansoConfig` — `src-tauri/tauri.conf.json`'s own identifier — and
copies the binary into `Contents/MacOS/espansoConfig`. The records say "assembles a fresh bundle"
and no more; this is one way of doing that and not necessarily the old one.

**5.8 The launches are named `P01…P11`.** Not `L111…`: they belong to no reading's ledger, and
`L…` names would read as a continuation of a ledger whose artifacts are gone. `P01…P06` are the
rebuild's and `P07…P11` are the fix round's (§8); the numbering is continuous because the tree is
one tree.

**5.9 A post-image manifest was written.** `manifest-3d-2a-post.sha256`, **46 entries** — `launch.sh`,
every fixture, both probe sources and every retained `probe.log` and `bytes.txt`. It was 34 when the
rebuild handed over and was **regenerated** by the fix round, so it now covers the two new fixtures,
the extended `src/probe.ts`, the amended `launch.sh` and the five new launches; `shasum -a 256 -c`
succeeds for all 46. This continues 3c-1 §5.7's practice rather than departing from it, and it is
stated here because it is a file in the tree that no record before 3c-1 describes. **It is a
post-image only**, and it is evidence for 3d-2b rather than for this step. **Regenerating it
destroyed the only digest this tree held for the pre-fix-round `launch.sh` and `src/probe.ts`**;
§8.5 carries those two digests in prose so that the replacement is not also an erasure.

**5.10 Two binaries ran, and the artifacts pin which — never their provenance.** Every launch keeps
its whole bundle, so `Contents/MacOS/espansoConfig` is a retained artifact per launch. Measured
across all eleven: P01–P06 ran `3f1b3506…`, P07–P11 ran `21359e1a…`, and the second is byte-identical
to `target/debug/espansoconfig` as it stands now. **That the two digests differ is the whole of what
is established**: no retained artifact binds either executable to a source snapshot or to a build
command, so *the fix round edited `src/probe.ts` and rebuilt* is an account of what was done (§8.1)
and not a reading of these bundles. Nothing else about either binary is established here. **This binds
which bytes ran and says nothing about when they were built, from what tree, or by which command** —
no build transcript was retained (§7), and `launch.sh` would have copied any binary it was pointed at.

**5.11 Three cases and one plan function exist that no record describes, and `src/probe.ts` was
edited.** 3b §8.5 said a new case needs only a case-table row and two fixture files, and 3c-1 §7.6
already recorded one case that needed driver code instead. Two of the fix round's three are the easy
kind — one existing plan over two new fixtures, reached through a new **parameter** — and the third,
`editor-reload-gone`, needed a plan function of its own, because no existing plan answers a conflict
with anything but *Keep my draft*. **That is one more instance of 3c-1 §7.6's requirement and not a
rule about which future cases will need code**, which is exactly what 3c-1 said about its own.
§8.1 is this record's account of what the fix round changed; no before-image of the pre-fix tree
survives against which its completeness could be checked (§1, §8.5).

## 6. What this rebuild does **not** prove

3b §8 and 3c-1 §7 are inherited whole, and this section adds what this step's own shape costs.

**The downstream work list is `2c-4b-3d-1-notes.md` §7, and it is newer than either of them.** The
first draft of this section named only 3b §8 and 3c-1 §7, and the omission cost it two Highs: §6.7
below is the disclosure it did not make, and §8 is what closed the two gaps rather than merely
recording them. Read §6.7 before §6.2 and §6.3 — those two are counts, and §6.7 is what the counts
are *about*.

**6.1 Inherited, unchanged, and every word of it still applies.** 3b §8.1 (nothing here is a window
reading — no launch of this step judged whether a person could read, reach or understand anything);
§8.2 (it cannot fail because a sentence is untrue; the transcript prints the strings the panels drew
and a false one prints exactly as well as a true one); §8.3 (`HTMLElement.click()` is not a mouse
click, no plan used the keyboard); §8.7 (the adoption arm is invisible: `installed` and
`alreadyThere` both reach `reapplied`); §8.8 (it says nothing about the real configuration); §8.9
(`--- end` proves the wrapper reached its last logging statement and nothing else); §8.11 and 3c-1
§7.0 (**there is still no invoke spy and no command counter**, so *a refusal issued no save command*
is not established — what P02 and P04 show, and what all five of §8's launches show, is a final
filesystem state, and a write producing identical bytes or a transient one undone before the launch
ended would leave the same artifacts).
3c-1 §7.1 (a byte match is not a proof of mechanism), §7.2 (the correspondence tier is invisible),
§7.3 (refusals are not attributed to the rules they were designed around), §7.4
(`alreadySatisfied` is distinguishable only by its sentence, which P08 is an instance of rather than
an exception to) and §7.7 (bilingual coverage is a count of launches taken, never a claim about label
truth) all hold here without amendment.

3c-1 §7.5 holds **with one amendment**, and it is the fix round's: the shape is still the easy one —
double-quoted triggers, one leading comment, LF endings, no BOM, no block scalars, no item-owned
comments, no blank-line runs, no second sequence, no read-only file, no package — but `replace:` is
no longer always a plain non-empty scalar. §8.2's two fixtures add **exactly two shapes and no
others**: a `replace:` with no value at all, and a `replace: ""`. Both are still one-line entries in
the same three-snippet document, so nothing else in §7.5's list moved.

**6.2 Fourteen of the twenty-three cases were not launched at all.** Nine ran — six in the rebuild
and three more in the fix round, two of those in both languages. Every other case has a fixture pair
and a case-table row and **nothing in this step shows that the pair produces what the case name
says**. The fourteen, named so that none hides in a summary: `editor-collision`, `editor-fallback`,
`editor-satisfied`, `editor-ambiguous`, `editor-missing`, `creator-anchor`, `creator-anchor-gone`,
`deleter-changed`, `duplicator-changed`, `mover-exact`, `mover-reordered`, `mover-reordered-end`,
`mover-after` and `mover-after-changed`. **The list is unchanged from the rebuild's**, because the
fix round added three cases and launched all three; the arithmetic moved from 14-of-20 to 14-of-23
and the names did not.

**Every surface was driven and most cases were not.** Of the nine cases that ran: four are positives
(`editor-exact`, `creator-front`, `deleter-exact`, `duplicator-exact`); three are the **editor's**
refusals and unchanged-byte outcomes, all of them the fix round's (`editor-ineligible`,
`editor-empty-satisfied`, `editor-reload-gone`); and two are `mover-changed` and `raw-negative`.
So **no refusal on the creator, the deleter or the duplicator was launched here**, and of 3c-1's
eight cases none was. A
case-table row is not evidence, and the fixtures behind those fourteen rows were authored by the same
reasoning as the nine that ran — which is an argument for expecting them to work and not an
observation that they do.

**6.3 Five of the nine authored expected-bytes files were never compared against anything, and the
fix round did not change that.** All three of its cases expect R1's own bytes, so they compare no
authored expected file at all. P01, P03, P05 and P06 matched `editor-exact-expected.yml`,
`creator-front-expected.yml`, `deleter-exact-expected.yml` and `duplicator-exact-expected.yml`. The
other five —
`editor-fallback-expected.yml`, `mover-exact-expected.yml`, `mover-reordered-expected.yml`,
`mover-after-expected.yml` and `mover-end-expected.yml` — are **predictions**, authored from the
records' *Expected afterwards* columns and from the byte-preservation reasoning that a move
relocates owned runs without respelling them. **If one of them is wrong, the first launch to use it
reports `bytes=DIFFER`, and the fault will be this file's and not the application's.** 3d-2b should
read a `DIFFER` on an un-launched positive as a suspect fixture first. The four that did match are
the reason to expect the other five to: the same authoring produced the emitted `':probe'` item
byte-for-byte (§4.1, P03), which was the one fixture derived from `choose_scalar` and `render_item`
rather than from byte preservation.

**6.4 Continuity with L01–L110 is not established and cannot be.** No before-image of the deleted
tree survives, so nothing compares this `launch.sh` or these fixtures with what 3c-2 ran, and §4.2
shows the digests differ for the two files it has old digests for. The claim this step can make is
narrower and is the whole of it: **a tree built from the records reaches all six surfaces, draws the
conflict arms those surfaces drew for 3c-2, and produces the byte predicates its case table names,
on the nine cases it ran.**

**6.5 The surviving driver was not verified against anything either.** `src/probe.ts` and
`src-tauri/src/probe.rs` are untracked, so git holds no baseline, and 3c-2's manifest is gone.
`src-tauri/src/probe.rs` being what 3c-2 left is a **claim about what this step did not do** — it
ran no editor over it — and not a comparison anybody can re-run. For `src/probe.ts` even that is no
longer available: the fix round edited it (§8), so what it differs from 3c-2's copy by is *at least*
those three cases and possibly more, and no artifact can tell.

**6.6 Nothing here is a reading, and no finding of 3c-2 was re-checked.** 3c-2's High, its two
Mediums and its Low are untouched by this step; §11.1's negative-`y` report block and §11.3's
selection-repair sentence are 3d-2b's to re-read after 3d-1's changes. **The five fix-round launches
are not an exception**, although two of them print a rendered sentence 3d-2b owes a reading of: a
transcript records that a string was drawn and at what rectangle, and §6.1's inherited §8.1 and §8.2
are exactly why that is not a reading of it.

**6.7 What the instrument can and cannot reach, measured against `2c-4b-3d-1-notes.md` §7 — the
list 3d-2b actually works from.** This is the disclosure the first draft of this section owed and
did not make, and it is stated as a per-obligation table rather than as prose so that nothing hides
in a summary. "Case exists" means a row in `launch.sh` and an arm in `runPlan`; "launched" means an
artifact under `launches/` shows it.

| §7 obligation | Case | Launched here |
|---|---|---|
| (a) refused *Keep my draft*, report block in the band — editor | `editor-collision`, `editor-ineligible` | **yes**, P07 (en) and P11 (es), through `editor-ineligible` |
| (a) — creator | `creator-anchor` | no |
| (a) — deleter | `deleter-changed` | no |
| (a) — mover | `mover-changed` | **yes**, P02 (es) |
| (a) — duplicator | `duplicator-changed` | no |
| (b) where the conflict panel's first line landed | any case | **yes**, all eleven |
| (c) a **second** press | any case with `:twice` | **no launch of this tree used `:twice`** |
| (d) `fieldCollisions` in full, both languages | `editor-ineligible`, `editor-collision` | **yes**, P07 (en) and P11 (es) — §8.2 |
| (e) `differentMatch` on the L43–L46 pair, beside a block identifying the same snippet | `editor-fallback` | no — and see the caution below |
| (f) success-arm report — editor | `editor-exact` (`reapplied`), `editor-empty-satisfied` (`alreadySatisfied`) | **yes**, P01 (en) and P08 (en) |
| (f) — creator | `creator-front` | **yes**, P03 (es) |
| (f) — deleter | `deleter-exact` | **yes**, P05 (en) |
| (f) — duplicator | `duplicator-exact` | **yes**, P06 (es) |
| (f) — mover | `mover-exact`, `mover-reordered`, `mover-reordered-end`, `mover-after` | **no** |
| RawEditor: no reapply control, no readiness sentence | `raw-negative` | **yes**, P04 (en) |
| `browser.notice.gone` on a screen (`PROGRESS.md` "What 3d-2 owes" item 3) | `editor-reload-gone` | **yes**, P09 (en) and P10 (es) — §8.3 |

Four things this table does **not** say, and they are **not all of one kind** — the table's own two
columns separate them. A **hole** is a path with no case: no row in `launch.sh`, no arm in `runPlan`,
and so nothing a launch could run. A **coverage gap** is a case that exists in this tree and that no
launch of this tree took.

**1 is a hole**: the second `gone` producer has no row and no arm. **3 and 4 are coverage gaps**:
`editor-fallback` and the `:twice` third segment both exist here and neither was launched. **2 is a
scoped justification in one half and a *hole* in the other, and the second half is the correction
this record's round-3 review forced.** The `fieldCollisions` obstacle exists on one surface only, so
the absence of four cross-surface cases is scope rather than anything missing. But the
confirmed-reload transition, which exists on all five match surfaces, has a case on **one** —
`editor-reload-gone`. §6.2's complete list of fourteen existing-but-unlaunched cases contains **no
creator, deleter, mover or duplicator reload case**, so on this section's own definition the other
four are holes, not coverage gaps: there is no row and no arm to launch.

The distinction is what 3d-2b schedules from, and getting it wrong is not cosmetic: a coverage gap
costs a launch, and a hole costs a fixture or a plan function **before** there is anything to launch.
Calling those four a coverage gap would have sent 3d-2b to launch cases this same record says do not
exist.

1. **`browser.notice.gone` has two producers and only one was provoked.** §8.3 draws it through
   `reresolve`'s length predicate — a held position an R1 removes. The second producer,
   `repairSelection`'s `clearSelection` arm (`src/lib/browser/selection.ts:292`, reached from
   `identityRecovery` for `identityNoSuchMatch`, `identityWrongDocument` and `unknownDocument`), has
   **no case in this tree** and was not provoked. Both render the same string, so a reading of the
   sentence is a reading of the sentence; what is unmeasured is the *situation* the second producer
   puts a person in, where nothing was read at all.
2. **Only the editor has an ineligibility case, and only the editor has a reload case.** The
   `fieldCollisions` obstacle is `matchEditor.ts`'s alone, so (d) needs no other surface — but *the
   confirmed-reload transition* exists on all five match surfaces and has a case on one. **The other
   four are holes**: building a reload reading for the creator, the deleter, the mover or the
   duplicator costs a plan function first, not a launch.
3. **(e) is unlaunched, and P08 is not a substitute.** P08's transcript does carry the corrected
   `browser.notice.differentMatch` sentence (`launches/P08/probe.log:27`), incidentally, because its
   reapply adopts a disk version whose `:beta` differs from the selected bytes. That is **not** §7(e),
   which asks for that sentence *beside a reapply block that identifies the same snippet* — the
   contradiction 3c-2 §11.3 opened. P08's neighbouring block says `alreadySatisfied`, which is a
   different pairing. Do not read the two as one.
4. **No launch of this tree pressed a reapply control twice**, so (c) has a mechanism
   (`src/probe.ts`'s `repeatIfAsked`, driven by the `:twice` third segment) and no observation.

## 7. The gates, with the harness in the tree

Re-run after the fix round, on the tree as it now stands. Every row is what the command printed, and
the paragraph below the table says what kind of evidence that is.

| Command | Result |
|---|---|
| `npm run build` | **176** modules — the count 3b §7 and 3c-1 §8 record with `src/probe.ts` in the tree |
| `npm run check` | **419** files, 0 errors, 0 warnings |
| `npm test` | **1634** passed, 49 files |
| `cargo test --workspace` | **1086** passed, 0 failed |

**1634 is not 3c-1's 1624, and the difference is not this step's.**
`docs/decisions/2c-4b-3d-1-notes.md` §9 records **1634 = 1624 + the 10 cases 3d-1 added**, and that
step is committed. **All four rows above equal the four that committed step's §9 records with the
harness in the tree** — 1634, 419, 176, 1086. The tree gives a reason to expect that rather than a
proof of it: no file under `src/lib/` or `crates/` differs from `HEAD`, and `src/probe.ts` is a
module the bundle already counted and a file no test imports. **An unmoved count is evidence of an
unmoved count and of nothing broader.** No gate transcript was retained, so these rows are this
record's account of what the commands printed and not an artifact a later reader can re-read.

`git status --short --untracked-files=all`, read **at the close of the round-2 fix pass** — the same
named event §1 binds its reading to, and not "the last time this file was edited" — listed **eight**
paths: three modified tracked files (`src/main.ts`, `src-tauri/src/main.rs` and `PROGRESS.md`), two
untracked probe sources, and three untracked documents under `docs/`, this record and its **then**
two reviews; round 3's review came after that reading. The branch tip was `e494095`, 3d-1's commit. **§1 says what this step's checkpoint commit
then does to both readings**: it stages `PROGRESS.md` and four documents by path — this record and
its three reviews — so the list becomes the four harness paths and the tip moves. Neither sentence is
a claim about the tree a later reader will find.

---

## 8. The fix round: three cases the rebuild could not draw

The review of this step returned **NOT READY**, on two Highs that were the same finding twice: the
rebuilt instrument had **no case capable of drawing `browser.notice.gone`** and **no fixture capable
of making a drafted editor field ineligible**, so two of the four things `PROGRESS.md`'s "What 3d-2
owes" list numbers would have been stranded at the reading. This section is what closed them. Its
five launches ran a binary that is not the one §4's six ran (§5.10).

### 8.1 What changed in the tree

- **`src/probe.ts`** — one new plan function, `editorReloadPlan`; a `draft` parameter with a default
  on `editorPlan`, so the two eligibility cases can type a value the old signature could not express;
  one new transcript line per editor plan saying what was drafted and how long it is; and three
  switch arms. `runPlan`'s switch goes from 20 arms to **23**.
- **`launch.sh`** — three case-table rows and their comment; the `nowrite` note now names three rows
  rather than one.
- **`fixtures/target-empty-replace-r1.yml`** and **`fixtures/target-empty-quoted-r1.yml`** — two new
  R1 documents, hand-authored and neutral (`:alpha`, `:beta`, `:gamma`, nothing else). **They differ
  from each other on one line and by three bytes**: `    replace:` against `    replace: ""` — a
  space and two quotation marks, 206 bytes against 209. That is the whole of their design and §8.2
  is why.
- **Nothing else appears in this round's account of what it changed** — and what the tree supports
  is a present-state reading rather than a before-and-after one. No file under `src/lib/`,
  `src/lib/components/` or `crates/` differs from `HEAD`; `git diff` over the two hook files is
  still exactly the four lines §2 quotes; and `src-tauri/src/probe.rs` carries the digest §8.5
  records. *Nothing else was touched along the way* is not a statement these artifacts can make
  (§1).

### 8.2 The ineligibility arm of `fieldCollisions`, and the twin that isolates it

**What the arm is.** `fieldReapply` (`src/lib/browser/matchEditor.ts:1848`) answers `collision` when
`sameBaselineState` is false and the disk does not already satisfy the intent, and
`sameBaselineState` compares **presence, value and eligibility** (`:1807`). A drafted field whose
value on disk did not change at all therefore lands on `collision` when the projection made it
**ineligible** — which is the disjunction `browser.matchEditor.reapply.fieldCollisions` was reworded
for at 3d-1 §4, and which `editor-collision`'s `target-changed-r1.yml` cannot produce, because that
fixture changes the field's **value** and leaves it editable.

**The refusal chosen, and why that one.** `fieldEligibility` (`:785`) refuses a field for five
reasons. Two requirements decided among them: the snippet must stay **identifiable** across the
revision, and the ineligible field should hold **exactly the value the draft asks for**, which is
what makes the collision attributable to eligibility and nothing else.

| Refusal | Why it was not chosen |
|---|---|
| `triggerNotSingle` | it needs a change to the trigger side, and the editor's weakest correspondence tier is a fingerprint over the source spelling of `trigger`, `triggers` and `regex` in source order (`crates/espansoconfig-core/src/reconcile.rs:774`), so the reapply would refuse on **correspondence** before any field was examined |
| `carriageReturn` | the disk value must contain a `\r`, and no control in this window can produce one — so **no draft can ever equal it** and the isolating twin is impossible |
| `unmodelledShape` | `projectedScalar` answers `null` for it, so **presence** differs too and the collision would have two causes instead of one |
| `notDecodable` | reachable — an invalid escape in a double-quoted scalar — but its twin would have to be an editable field whose *decoded* value equals the undecodable one's raw source slice, which is a contrivance. **Not ruled out; not needed** |
| `ownsNoBytes` | **chosen.** The value is the empty string, and `replace: ""` is an editable field holding exactly that, so the twin costs three bytes |

An entry written `replace:` with no value has a **zero-width** value node
(`crates/espansoconfig-core/src/draft/error.rs:148-154`, R7), and `ScalarView::project` still projects
it as a present, decoded, empty **plain** scalar
(`crates/espansoconfig-core/src/model/scalar.rs:98-105`); `fieldEligibility` reaches its
`scalar.span.start === scalar.span.end` line (`:801`) and refuses.

**Why the pair, and what it isolates.** The plan drafts the **empty string** into the replacement
box. Against `target-empty-replace-r1.yml` the disk field is present, holds exactly the drafted
value, and is **ineligible**; against `target-empty-quoted-r1.yml` it is present, holds exactly the
drafted value, and is **editable**, because `""` owns two bytes. Those are the two operands of
`fieldReapply`'s last line, `now.present && editable && now.value === intent.Set`, with only
`editable` differing. So:

| Launch | Fixture | `:beta`'s replace line | Outcome |
|---|---|---|---|
| P07 (en), P11 (es) | `target-empty-replace-r1.yml` | `    replace:` | `manualResolution`, `fieldCollisions`, naming *Replacement text* |
| P08 (en) | `target-empty-quoted-r1.yml` | `    replace: ""` | `alreadySatisfied` — *"that version already holds what you asked for, so there is nothing left to send"* |

**That is the evidence for which arm produced the refusal, and it is a measurement rather than an
argument.** Two launches, one plan, one draft, disk values equal, fixtures differing by three bytes;
the collision appears only where the field is ineligible, and where it is editable the same disk
value is `satisfied` instead. **A value-collision fixture cannot produce that pair**, because a disk
value that differs from the draft cannot be `satisfied` in either half.

**What this pair does *not* establish.** That the *derivation* runs the way §8.2 describes — that
`fieldEligibility` answered `ownsNoBytes`, that `sameBaselineState` was false on eligibility alone —
is read off the code, not off a transcript: the window prints one sentence for the whole
`fieldCollisions` obstacle and never names the reason a field is ineligible. What the two launches
establish is the **behavioural** claim, which is the one that matters here: with everything else
held equal, the disk field being ineligible is what turns `satisfied` into a refusal. 3c-1 §7.3 is
the same bound in its general form.

Quoted from the transcripts, in full:

- **P07** (`launches/P07/probe.log:27`, box `658,44,491x107`): *"espansoConfig applied nothing.
  Nothing was written, this window was not moved, and what you kept is still here exactly as it was.
  The reason follows. The version on disk does not hold these fields the way the version your draft
  was built on did — a different value, the key added or removed, or a change in whether this app
  will edit it — so espansoConfig will not decide what to do with them: Replacement text."*
- **P11** (`launches/P11/probe.log:27`, box `658,44,491x124`): the Spanish twin, ending *"…o un
  cambio en si esta aplicación los edita—, así que espansoConfig no decide qué hacer con ellos:
  Texto de sustitución."*
- **P08** (`launches/P08/probe.log:28`, box `658,639,491x50`): *"This window now shows the version on
  disk, and that version already holds what you asked for, so there is nothing left to send. Nothing
  was written."*

`launches/P07/probe.log:5` and P11's own line 5 record the draft itself — `editor drafted=""
length=0` — so the transcript says what was typed rather than leaving it to be inferred from the
fixture.

### 8.3 `browser.notice.gone`, drawn for the first time in this project

**What the predicate is.** `reresolve`'s `gone` arm is `view.matches[previous.position] === undefined`
(`src/lib/browser/selection.ts:193-196`) — a statement about the **length** of the list. Every plan
of the surviving driver that holds a selection at all selects `:beta` through
`openSnippet(TARGET_TRIGGER)`, which is position 1 of `base-r0.yml`, and the shortest rebuilt R1
holds two items, so position 1 always existed and the predicate could not fire. That is why no launch
in this project's history had drawn it.

**The shape chosen, and why it was cheaper than the alternative.** Two shapes satisfy the predicate:
give an R1 fewer items than the selected position needs, or move the selection to a position an
**existing** R1 already removes. **The second costs one changed line and no fixture at all**, so
`editorReloadPlan` selects `:gamma` — position 2 — and the case reuses `target-deleted-r1.yml`, which
holds two items. The plan function it sits in was needed either way (§5.11): no shape of fixture can
make an existing plan press *Load the version on disk*.

**How the repair is reached.** The plan answers the conflict with *Load the version on disk* and then
*Discard my text and load it*, not with *Keep my draft*: `BrowserState.adoptDiskVersion` is the only
door that installs a disk projection, and it ends in `installView` + `repairAfter`
(`src/lib/browser/workspace.svelte.ts:1834-1836`). `repairAfter` asks `reresolve` and assigns
`notice = found.outcome` (`:3131-3133`). The two controls are two different controls rather than one
pressed twice — `conflictChoicesFor` names `reloadDiskVersion` while the step is idle and
`confirmReload` once it has been asked (`src/lib/browser/saveOutcome.ts:466`) — and
`launches/P09/probe.log:24` shows the swap, the button list carrying *Discard my text and load it*
where *Load the version on disk* stood.

Quoted in full:

- **P09** (`launches/P09/probe.log:25`, box `658,58,508x103`): *"The selection was cleared, because
  espansoConfig can no longer point at the snippet that was selected. That is not a statement that it
  was removed: nothing here searched this file for it. Dismiss"*
- **P10** (`launches/P10/probe.log:25`, box `658,58,508x103`): *"Se ha borrado la selección porque
  espansoConfig ya no puede señalar el fragmento que estaba seleccionado. Eso no significa que se
  haya eliminado: aquí no se ha buscado el fragmento en este archivo. Descartar"*

**Which producer this is.** `reresolve`'s length arm, and not `repairSelection`'s `clearSelection`
arm. Both render this string; only the first was provoked here, and §6.7's first caution says so
where a reader of the bounds will meet it.

### 8.4 The five launches

Each satisfies the same four-part conjunction §4 applies, checked by a reader and by nothing in the
harness: no `--- failed` line; a conflict block with three revisions where `expected ≠ found` and
`diskRevision == found`; the expected control and action lines; and the intended byte predicate.
Every one picked its language through the picker and printed `documentElement.lang`.

| # | Case | Surface | Lang | `expect=` | `bytes=` | `backups=` | `probe.err` | `--- end` / `--- failed` |
|---|---|---|---|---|---|---|---|---|
| P07 | `editor-ineligible` | editor | en | `target-empty-replace-r1.yml (R1)` | **MATCH** | **none** | 0 bytes | present / absent |
| P08 | `editor-empty-satisfied` | editor | en | `target-empty-quoted-r1.yml (R1)` | **MATCH** | **none** | 0 bytes | present / absent |
| P09 | `editor-reload-gone` | editor | en | `target-deleted-r1.yml (R1)` | **MATCH** | **none** | 0 bytes | present / absent |
| P10 | `editor-reload-gone` | editor | es | `target-deleted-r1.yml (R1)` | **MATCH** | **none** | 0 bytes | present / absent |
| P11 | `editor-ineligible` | editor | es | `target-empty-replace-r1.yml (R1)` | **MATCH** | **none** | 0 bytes | present / absent |

All five expect **R1's own bytes**, and every one matched: each target file ends byte-identical to
the R1 its case installed, and the backup search of §5.4 found nothing in any. **That is a reading
of the final filesystem state and not an observation that nothing was written** — §6.1's inherited
3b §8.11 and 3c-1 §7.0 hold over these five word for word: there is still no invoke spy and no
command counter, so a write producing identical bytes, or a transient one undone before the launch
ended, would leave exactly these artifacts. Every conflict block shows `expected` `91f2c4df…`
against a `found` that equals its `diskRevision` — `8a179988…` for the two empty-`replace:` launches,
`a1bea0dd…` for the quoted one, `615a5a02…` for the two reloads. The viewport is the same
`1180x728 hasFocus=false visibility=hidden` §4.1 reports.

**Five launches, one surface.** Every one drives the **match editor**, because both obligations are
the editor's: `fieldCollisions` is `matchEditor.ts`'s own obstacle, and the reload route was taken on
the surface whose conflict panel §8.2's cases already open. No other surface was driven here, and
§6.7's second caution is where that is stated as a bound rather than as a summary.

### 8.5 What regenerating the manifest destroyed

`manifest-3d-2a-post.sha256` went from 34 entries to 46 and was rewritten rather than appended to, so
the digests it held for the **pre-fix-round** `launch.sh` and `src/probe.ts` are gone from the tree.
They were `0bfa4f544a8284e63d506f809f18f21848ef3ce58459ab4e68ed60dd9d1bf459  launch.sh` and
`2897aedebba17f4562861f6685389046c75e9dad5819144fe33da8636c59efdf  src/probe.ts`, and they are
written here because a post-image that replaces its predecessor without recording it is a
before-image destroyed. The 46-entry manifest's entry for `src-tauri/src/probe.rs` is
`3746fb2ac437c156ebd9ad7d95afbaa27ac4216e593f3aa7e8eca24742a000df`, and this record's account is
that the 34-entry one carried the same digest for it — which is why that is the one file this step
names a stable digest for across both rounds. **What survives of the destroyed manifest is this
record's prose and nothing else**: the two digests above, and the claim that `probe.rs`'s did not
move, are values written down rather than an artifact a later reader can check anything against, and
none of them lets anybody reconstruct the file it names.
