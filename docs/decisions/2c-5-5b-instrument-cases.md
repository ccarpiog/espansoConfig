# Phase 2c-5 step 5b — the restore cases, and the instrument they run on

## 1. The tree was lost a second time, and what the filesystem shows

**`/private/tmp/espansoconfig-harness-2c-5/` did not exist when this step began.** That is a reading
of the filesystem on 2026-08-24, after step 2c-5-5a closed on the same date, and it says nothing about
*when* the tree went or what removed it — `/private/tmp` is a location the operating system clears,
and a reboot would do it, but no artifact here records a cause and this record does not assert one.

**What is gone is everything `2c-5-5a-instrument-rebuild.md` §1 lists as living in that tree**:
`launch.sh`, `inert.sh`, `confine.sh`, `adversary.sh`; the nine fixtures; the **sixty-six retained
launches** `P01…P48`, `N01…N08` and `C01…C10`, four generations including the nineteen-launch complete
proof set; `launches/C09-plant/` and its symlink; C07's planted symlink; and **all three manifests**
(`manifest-2c-5-5a-post.sha256`, `…-fix-post.sha256`, `…-round2.sha256`). Also gone are the **nine
decoy files outside the tree**, `/private/tmp/espansoconfig-probe-decoy-C01.yml` through `…-C09.yml`
— a listing of `/private/tmp/espansoconfig-probe-decoy-*` at the start of this step matched nothing.
Each of those absences is a reading of a present state, bounded exactly as 5a §6.1's general rule
binds every absence sentence.

**What survives is the four harness paths in the repository working tree and the records.**
`src/probe.ts`, `src-tauri/src/probe.rs`, and the two hook lines each in `src/main.ts` and
`src-tauri/src/main.rs`; `git diff --stat` over the two hook files still reads **5 insertions and 1
deletion**, which agrees with 5a §2.1 — an agreement that follows from the files being untouched, not
a comparison with any before-image.

**The rebuilt scripts and fixtures are new instances with no before-image.** The three lost manifests
were post-images and are gone, so nothing can compare any rebuilt file with what 5a's tree held — the
same hole 4a had and 5a inherited, now one rebuild deeper. **None of the three lost manifests is
regenerated here**; §2's manifest is a fresh post-image of the rebuilt tree and claims nothing about
the lost one.

**5a's measurements remain readings of *that* tree's binary.** Every figure, rectangle, digest and
refusal `2c-5-5a-instrument-rebuild.md` quotes was produced by launches of the executable whose
digest is `0a2d3506630256f6a3193de3352b32b23244e4e8ff7c07b9642a85c393954d92`, whose retained copies
were in the lost bundles and are gone with them. Nothing here re-establishes those readings. The
controls in §2 below are the **re-takes for this step's own binary**, whose digest is
`08229f8cda683767c9a77fc239709df66d6876f42f32f2e5f0b3b721fd409137` — a different digest, as expected
from a rebuild, and recorded rather than hidden.

## 2. What was rebuilt, file by file, and the launches that prove it

The tree was rebuilt at the **same path**, `/private/tmp/espansoconfig-harness-2c-5/` — `HARNESS_ROOT`
in `src-tauri/src/probe.rs` is a compile-time constant that must agree with `launch.sh`'s `HARNESS`
(5a §8.1), and **none of the four harness paths was edited**. New launches are numbered **P49+, N09+,
C11+**, fresh ranges continuing after the lost ones, so no rebuilt launch can be mistaken for a 5a
artifact.

| Rebuilt file | Built from | Notes |
|---|---|---|
| `launch.sh` | 5a §3 (the recipe, the `open` invocation, the three refusals and their exit codes 68/69/65, the wait, the kill), §2 (the twelve-row case table), §5.4 (the two-halved backup search), §5.5 (the `bytes.txt` lines), §5.7 (the hand-assembled bundle, identifier `cc.carpio.espansoConfig`), §5.17 (the name guard in all four scripts) | re-authored from the record |
| `inert.sh` | 5a §4.3 (no `ECFG_PROBE_*` variable at all, the twelve-second window, `alive-at-kill` via `pkill`'s status) | re-authored from the record |
| `confine.sh` | 5a §4.4 (the two static modes, the decoy outside `$HARNESS`, `--- failed` as the pass) | re-authored from the record |
| `adversary.sh` | 5a §4.5 (the three modes; the sibling plant for `target-symlink`, because C08 showed an own-tree symlink never reaches the writer; `ECFG_PROBE_TEMP_NAME` per §5.18, set by this script only) | re-authored from the record |
| `fixtures/base-r0.yml` | 3b §4: one comment line, `:alpha`/`:beta`/`:gamma`, double-quoted `trigger:`, plain `replace:` | re-authored from a description |
| `fixtures/elsewhere-r1.yml` | 3b §4: changes `:alpha`'s replacement, leaves `:beta`'s owned lines byte-identical, no reorder | re-authored from a description |
| `fixtures/target-changed-r1.yml` | 3b §4: changes `:beta`'s replacement, leaves `:alpha` alone | re-authored from a description |
| `fixtures/third-r2.yml` | 5a §5.15 (a third revision, different bytes from R1) | shape authored here — no record fixes its content |
| the 5 `*-expected.yml` files | 3b §4's *Expected afterwards* column over this tree's `elsewhere-r1.yml`; `creator-front-expected.yml`'s emitted item from `choose_scalar` and `render_item` via 5a §2.2 (`  - trigger: ':probe'` / `    replace: probe creation`) | authored predictions |

**Deviations and derivations, each named.** Every byte no record fixes is this step's own choice, and
the following places are where the records under-specified and the surviving driver sources or a
choice decided:

1. **The fixture bytes are new.** 5a §4.2's four digests (`a9990be6…`, `60a66198…`, `9e937f20…`,
   `8b1a27af…`) are positively not this tree's; `shasum -a 256` over this tree's four revision
   fixtures answers `2543689c…` (R0), `beba1b1f…` (`elsewhere-r1.yml`), `27aa3b9e…`
   (`target-changed-r1.yml`) and `358eb1d7…` (`third-r2.yml`), and P49's transcript prints exactly
   those values as its revisions — §4.2's fixture-revision identity holding once more, on this build.
   No later step may use digest equality with 5a's ledger as a continuity check; these are the
   digests to check against.
2. **Five expected-bytes files are un-launched predictions in this part.** Unlike 5a §6.3, this part
   of 5b compares only `third-r2.yml` by a launch; `editor-exact-expected.yml`,
   `creator-front-expected.yml`, `deleter-exact-expected.yml`, `mover-exact-expected.yml` and
   `duplicator-exact-expected.yml` stand authored and uncompared until launches run those cases.
3. **The confinement scripts drive `editor-exact:en`.** No record says which case the lost scripts
   drove; any plan reaching `runSecondWriter()` measures the same refusal, and the choice is recorded
   here rather than implied.
4. **The `bytes.txt` key sets are derived.** The plan-launch block keeps `bytes=` at line 4,
   `backups=` at line 5 and `expect=` at line 6 (3d-2a §5.5's positions) and carries 5a §5.5's ten
   keys; the `expect=` line carries `r1=` and drops 3d-2a's `refusal=<column>` token, whose 5a fate
   is unrecorded. The confinement block's ten keys (`name`, `plan`, `mode`, `decoy`, `target`,
   `refusal`, `tree-diff`, `binary`, `probe.err`, `reached-end`) and the no-plan block's eight are
   derived from the lines 5a §4.3–§4.5 quotes; the lost scripts' exact key order is unrecorded.
5. **Two exit codes are this step's own**: an unknown case name exits 68 (the record documents 68
   only for a malformed plan) and a bad mode in `confine.sh`/`adversary.sh` exits 64 (no record
   describes one).
6. **`inert.sh` waits twelve seconds**, derived from §4.3's "byte-identical after twelve seconds";
   the lost script's wait is not otherwise recorded.
7. **The second synthetic file's content is this step's own** (5a §5.3 records only "two lines,
   neutral"), as are the `Info.plist` fields beyond the identifier and the `decoy-before.yml`
   pristine copy that makes the `decoy=` line a `cmp` rather than an assumption.
8. **The decoy set is new.** `confine.sh` and `adversary.sh` left
   `/private/tmp/espansoconfig-probe-decoy-C11.yml` through `…-C14.yml` — **four files, outside the
   tree** (C15's mode needs none). Step 2c-5-7's deletion list is these four, not §8.3's nine, which
   are gone; `launches/C13/xdg/espanso/match/conflict.yml.probe-tmp-adversary-C13` and
   `launches/C14-plant/xdg/espanso/match/conflict.yml` are the two symlink artifacts that go with the
   tree.

**The rebuild order was followed and the binary is pinned.** `npm run build` (185 modules — 5a §7's
with-harness figure, and the emitted bundle is the **same** `dist/assets/index-I5AFZyLL.js`, so the
frontend is byte-identical to the one 5a's proof generation embedded), then `touch src-tauri/build.rs`,
then `cargo build -p espansoconfig --features custom-protocol` (finished, no errors). No driver edit
was needed and none was made. `shasum -a 256 target/debug/espansoconfig` answers
`08229f8cda683767c9a77fc239709df66d6876f42f32f2e5f0b3b721fd409137`, every launch below records the
same digest from its own retained bundle copy, and that digest is **not** 5a's `0a2d3506…` — expected
of a rebuild, and no artifact binds either executable to a source snapshot (5a §6.4's limitation,
inherited whole).

### 2.1 The proof launches — seven, on this binary

One plan per launch, into a fresh bundle path every time; runs were serial and the window unoccluded.
Every check below is an independent `bytes.txt` line; the conjunctions are this reader's.

**P49 — `editor-third:en`, the positive plan-proof, 5a §4.1's worked example.** The transcript shape
is the record's: `--- plan case=editor-third requested=en`; language picked through the picker
(`picked=en lang=en`); a first conflict whose three revisions are `2543689c… / beba1b1f… / beba1b1f…`
— `expected ≠ found`, `diskRevision == found` — with four choices, `keepMyDraft=present`,
`readiness ready=present readyOperation=absent`; *Keep my draft* pressed,
`reapplyArm=browser.reapply.reapplied`; then **`editor beforeSecondSave outcomePanel=absent`**,
`--- writer third wrote=yes`, the second save, and a new outcome block
`beba1b1f… / 358eb1d7… / 358eb1d7…` — the reapply's own base against R2. The byte line reads
`bytes=MATCH` against `expect=third-r2.yml (R2)`, which **discriminates the third writer having
run** — no application path produces R2, and a failed writer would have left R1. `backups=none`,
`tree-diff=5 lines` (exactly the writer's own change to `conflict.yml` and nothing else),
`probe.err=0 bytes`, `reached-end=yes end-lines=1 failed-lines=0`. The viewport measured
`1180x728 dpr=2 hasFocus=true visibility=visible`, which is not 5a's `720x728 dpr=1` — one more
instance of §6.8's rule that this harness's geometry compares with no other record's.

**N09 — the no-plan control (§4.3).** `inert.sh` answered
`probe.log=0 bytes probe.err=0 bytes tree-diff=0 lines target-unchanged=yes alive-at-kill=yes` and
the binary digest above. The `alive-at-kill=yes` is what says the silence is a running window's;
what this establishes is 5a §4.3's exact sentence — no plan-driven DOM action was observed and the
final synthetic tree is unchanged — and not that no writer was spawned.

**C11–C15 — the five confinement re-takes, `--- failed` the pass on each.** Each reached `--- end`
with `failed-lines=1`, a zero-byte `probe.err`, `tree-diff=0 lines`, and its target unchanged (the
byte line `cmp`s the launch's own `conflict.yml` against R0; for C15 the pointed-at file is
`default.yml`, and its non-write is carried by the `tree-diff=0` line over the whole tree):

| # | Script, mode | Refusal quoted from the transcript | Decoy |
|---|---|---|---|
| C11 | `confine.sh target` | `refused: the second writer's target (ECFG_PROBE_TARGET) /private/tmp/espansoconfig-probe-decoy-C11.yml is not beneath /private/tmp/espansoconfig-harness-2c-5/launches` | unchanged |
| C12 | `confine.sh source` | `refused: the second writer's source (ECFG_PROBE_R1) /private/tmp/espansoconfig-probe-decoy-C12.yml is not beneath /private/tmp/espansoconfig-harness-2c-5/fixtures` | unchanged |
| C13 | `adversary.sh temp` | `refused: the second writer could not create the temporary /private/tmp/espansoconfig-harness-2c-5/launches/C13/xdg/espanso/match/conflict.yml.probe-tmp-adversary-C13 exclusively: File exists (os error 17)` | unchanged |
| C14 | `adversary.sh target-symlink` | `refused: the second writer's target (ECFG_PROBE_TARGET) /private/tmp/espansoconfig-probe-decoy-C14.yml is not beneath /private/tmp/espansoconfig-harness-2c-5/launches` | unchanged |
| C15 | `adversary.sh target-elsewhere` | `refused: the second writer's target (ECFG_PROBE_TARGET) /private/tmp/espansoconfig-harness-2c-5/launches/C15/xdg/espanso/config/default.yml is not a launch's own <launch>/xdg/espanso/match/conflict.yml beneath /private/tmp/espansoconfig-harness-2c-5/launches` | none |

After C13 and C14, `ls -l` shows each planted link **still a link, still pointing at its decoy**.
What carries each row is the quoted refusal, a positive observation; every `unchanged` beside it is a
reading of final bytes, and this harness still has no invoke spy and no command counter, so the
no-write equivalence of 5a §6.1 binds every one of those readings. **The four residual rebindings of
5a §8.1 are inherited open and untouched** — nothing here constructs or closes any of them, and these
five launches measure the same five refusals 5a's C05–C07 and C09–C10 measured, on this binary.

**The manifest.** `manifest-2c-5-5b-rebuild.sha256` — **29 entries**: the four scripts, the nine
fixtures, both probe sources, and the `probe.log` and `bytes.txt` of all seven launches;
`shasum -a 256 -c` succeeds for all 29. It is a **post-image only**, written fresh; none of the three
lost manifests was regenerated (3d-2a §8.5 is what regenerating one destroyed). Later work should
append or write its own.

**The repository after this part.** `git status --short --untracked-files=all` lists exactly the four
harness paths — `src/main.ts` and `src-tauri/src/main.rs` modified, `src/probe.ts` and
`src-tauri/src/probe.rs` untracked — plus this record untracked; `git diff --stat` over the two hook
files still reads 5 insertions, 1 deletion. No git command that changes anything was run; that is an
account of what was done, and the status reading at this moment is what the tree gives.

## 3. The restore cases — what part 2 built, and from what

Part 2 builds `2c-5-5a-instrument-rebuild.md` §8.2's restore-specific cases onto the tree part 1
rebuilt. Four case names were added, and a case name goes in the three places §8.1 requires — the
`launch.sh` case table, `runCase`'s switch in `src/probe.ts`, and a plan function (`restorePlan`,
with a four-valued tail). The plan string stays `<case>[:en|es]` and nothing else.

| Case | Terminal state | Seeds a catalogue | `EXPECT` |
|---|---|---|---|
| `restore-replace` | the committed whole-file replacement | yes | `restore-entry.yml` |
| `restore-prepare` | the two-control question, then *cancel* | yes | `base-r0.yml` |
| `restore-conflict` | `SaveResult::Conflict`, the second writer having moved the file between the question and the confirmation | yes | `elsewhere-r1.yml` (R1) |
| `restore-none` | the listed-and-empty catalogue (`batchesNone`, root `missing`) | no | `base-r0.yml` |

**One driver edit, one rebuild.** All four arms share `restorePlan`; the edit added no module
(`npm run build` answered **185**, predicted, since edits inside `src/probe.ts` cost 0), and the
rebuild followed §3's order — `npm run build`, `touch src-tauri/build.rs`, `cargo build -p
espansoconfig --features custom-protocol`. The rebuilt binary's digest is
`6d3a80dee9ac1abb2c76ed2406894bf7b6f4bc6ae314d4e2aab6638025a32c01` — not part 1's `08229f8c…`,
as expected of a rebuild whose embedded `dist` changed, and every launch below records it from its
own retained bundle copy. **`src-tauri/src/probe.rs` was not touched**: every restore case's target
is the same `…/xdg/espanso/match/conflict.yml` the existing `TARGET_TAIL` names, so the second
writer reaches it unwidened, and §8.2 item 7's test obligation is not triggered.

### 3.1 The seeded backup catalogue, derived from `backup.rs` rather than inferred

`launch.sh` now seeds a `.espansoconfig-backups` tree **before** the `open`, for the three cases
whose row names a `SEEDBATCH`, and seeds it before the `cp -R` so `xdg-before/` holds the
catalogue's before-image with the rest (§8.2 item 1). Every choice is read off
`crates/espansoconfig-core/src/persist/backup.rs`:

- the root is `.espansoconfig-backups` **directly under the configuration root**
  (`BACKUP_DIRECTORY_NAME`), created `0700` (`BACKUP_DIRECTORY_MODE`) — a group or other bit would
  refuse the whole scan (`BACKUP_DIRECTORY_FORBIDDEN_MODE`, checked by `open_root`, which
  `scan_batches` and every later call share);
- the batch directory is named `2026-08-20T101500Z` — `parse_batch_name`'s grammar,
  `YYYY-MM-DDTHHMMSSZ` optionally `-N`, and a name outside it is skipped as `ForeignName`;
- the batch carries a regular file `.espansoconfig-batch` (`BATCH_MARKER_NAME`) holding
  `espansoconfig-backup-batch 1\n` (`BATCH_MARKER_CONTENT`); `carries_batch_marker` matches on the
  `BATCH_MARKER_FORMAT` prefix, and a batch without it is skipped as `NoMarker`;
- the one entry sits at `match/conflict.yml` inside the batch — the target's own
  config-root-relative path, which is `backup_relative_path`'s forward mapping and the name
  `entry_for_target`/`read_backup_text` require for this file.

The entry's bytes are `fixtures/restore-entry.yml`, a tenth fixture authored here in the shape of
the other revision documents and byte-distinct from all of them; `shasum -a 256` answers
`114cd4e213bc6d180276947094683a27736512545fd1aec440f705ebd80f5140` and P50's transcript prints no
digest for it (a committed raw replacement's outcome carries zero revision runs, exactly as 5a's
P38 did).

### 3.2 The driver's restore machinery, and why a step is resolved by its heading

The restore pane draws up to four `section.step` blocks whose **document order moves** — the
loaded-text step precedes the entries step until a batch is picked — so a positional selector
(`nth-of-type`) would name different steps at different moments. `restoreStep` in `src/probe.ts`
therefore resolves a step **by its `<h3>`'s translated heading**, on every poll, and the four new
helpers (`reportRestoreStep`, `waitForRestoreSentence`, `pressInRestoreStep`,
`pressRestoreEntryRow`) all look inside the step so resolved — §8.2 item 2's scoping, with the
batch list, the entry list and the candidate block each addressed inside their own step. A batch
row is matched on its whole text (`browser.restore.batchNamed` with the seeded name as its
parameter); an entry row is named by the file, so it is matched on the `span.source` **inside the
row's button** — the namespace marker sits outside the button and would poison a whole-row match.
`outcomePanelOf('section.restore')` works unchanged, because the pane's outcome panel is a direct
child of the section; **`reportReapply` is never called on this surface** — there is no
`.panel.reapply` here at all, and a plan that waited for one would time out and print `--- failed`
(§8.2 item 2).

### 3.3 The byte oracle, extended for restore cases — independent lines, nothing conjoined

For every `restore-*` case, `bytes.txt` gains three lines after the shared ten (§8.2 item 4); every
other case keeps its ten-line block byte-identical in shape:

- `entry-cmp=` — the target `cmp`ed against the seeded batch's own live entry;
- `backup-tree=` — `diff -r` of the seeded batch directory against its pristine copy in
  `xdg-before/`, because a restore must not disturb the batch it restored from. The comparison is
  **the batch, not the whole root**: a committed restore takes a backup of its own, so the root
  legitimately grows;
- `batches=before:N after:M` — the entry counts of the backup root in the pristine and the live
  tree, which is the new-backup observation, kept as two counts a reader conjoins.

For `restore-none` the three lines read `unseeded`/`unseeded`/`before:0 after:0`, so the restore
block has one key set across all four cases.

## 4. The proof launches — P50 onward, on this part's binary

One plan per launch, into a fresh bundle path every time; runs serial, the window unoccluded;
numbering continues part 1's ranges (P50+), and no lost number's identity is reused. Every check is
an independent `bytes.txt` line; the conjunctions are this reader's. Every launch below ran the
binary whose digest is `6d3a80de…` (its own retained bundle copy, recorded in its `bytes.txt`).

### 4.1 P50 — `restore-replace:en`: catalogue, entry, candidate, prepare and replace in one launch

`failed-lines=0`, `end-lines=1`, `probe.err=0 bytes`, viewport `1180x728 dpr=2 hasFocus=true
visibility=visible`, `picked=en lang=en`. The five states, each with its transcript line:

- **catalogue** — the batches step (`box=658,248,491x175`) quotes *"The backups folder is there and
  was listed."* (`code.backupRootState.present`) and the row *"Backup batch named
  2026-08-20T101500Z"*, found **inside the step headed "Recognised backup batches"** — the scoped
  lookup working;
- **entry** — the entries step (`box=658,429,491x215`) quotes the selected batch name, the
  `entryIsAName` sentence, the row `match/conflict.yml` with its *"named for a file inside your
  configuration folder"* marker, **and one skipped item**: *"the entry at the name espansoConfig
  uses for a backup folder's ownership marker, which is not a copied file"* — the pane's own
  reading of the seeded `.espansoconfig-batch`, which is a true sentence about this catalogue and
  was not asked for by the plan;
- **candidate** — the candidate step (`box=658,651,491x337`) quotes *"346 bytes of UTF-8, and 346
  characters"*, the `listedAgrees` sentence, the `candidateExact` sentence and the entry's whole
  text; `restore loadedStep=present` is the fourth step drawn;
- **prepare** — after *Prepare to replace file*: the question block (`box=658,574,491x101`) with
  the `question` and `confirmBinding` sentences and exactly two controls, *[Replace entire file
  with the shown text 275x29] [Do not replace this file 161x27]*;
- **replace** — `beforeConfirm outcomePanel=absent`, then *Replace entire file with the shown
  text*; `outcome changed revisions of 0` (a committed replacement carries no revision run);
  `replaced=present`; the final block quotes *"The file was written. What is on disk now is exactly
  the text that was sent."*, the `backupTaken` sentence and the `replaced` sentence, with
  *Dismiss*; and the actions block afterwards holds *Prepare to replace file* again above the
  `refused.alreadyRestored` sentence.

The byte lines: `bytes=MATCH` against `restore-entry.yml`, `backups=PRESENT`, **`entry-cmp=MATCH`**
(the restored file against the entry's own live bytes), **`backup-tree=SAME
batch=2026-08-20T101500Z`** (the seeded batch byte-identical to its pristine copy),
**`batches=before:1 after:2`** (the restore's own backup minted one new batch). `tree-diff=18
lines` and is exactly two things: `Only in …/.espansoconfig-backups: 2026-08-24T121103Z` and the
target's own change. Read outside the oracle: the new batch holds `.espansoconfig-batch` plus
`match/conflict.yml`, whose bytes `cmp` equal to `base-r0.yml` — the restore backed up exactly what
it replaced, into a tree of the same layout §3.1 seeds.

### 4.2 P51 — `restore-prepare:es`: the question reached and declined, and nothing written

`failed-lines=0`, `end-lines=1`, `probe.err=0 bytes`, `picked=es lang=es`, viewport `1180x728 dpr=2
hasFocus=false visibility=visible` (the focus bit differing from P50's is one more instance of the
rule that this harness's geometry and window state compare with nothing outside the launch that
measured them). The same catalogue → entry → candidate walk as P50, in Spanish — *"La carpeta de
copias existe y se listó."*, *"Lote de copias llamado 2026-08-20T101500Z"*, the entry row with
*"con el nombre de un archivo de dentro de tu carpeta de configuración"*, *"346 bytes de UTF-8"*,
*"Al listar esta entrada se anotó el mismo número de bytes."* — then:

- **prepare** — the question block (`box=658,504,491x171`) with the two sentences and exactly two
  controls, *[Sustituir el archivo entero por el texto mostrado 340x29] [No sustituir este archivo
  172x27]*;
- **cancel** — after *No sustituir este archivo*, the actions block holds exactly one control
  again, *[Preparar la sustitución del archivo 235x27]*, and `restore final blocks=0` — no outcome
  panel, because nothing was sent.

The byte lines: `bytes=MATCH` against `base-r0.yml` (the target untouched), `tree-diff=0 lines`
(the whole synthetic tree byte-identical, seeded catalogue included), `entry-cmp=DIFFER` (the
target still holds R0 while the entry holds the restore text — the expected reading of a launch
that wrote nothing), `backup-tree=SAME`, `batches=before:1 after:1` (a declined question takes no
backup). `backups=PRESENT` here is the **seeded** catalogue, not a by-product of any save — the
`batches=` counts are what say no batch was added.

### 4.3 P52 — `restore-conflict:en`: the second writer between the question and the confirmation

§8.2 item 5's shape: restore is a content path on `saveRawDocument`, so its conflict is the raw
editor's, and the second writer is enough to provoke it — no `probe.rs` change, because the
restore's target **is** `TARGET_TAIL`'s file. `failed-lines=0`, `end-lines=1`, `probe.err=0 bytes`,
`picked=en lang=en`. The same walk as P50 up to the question, then `--- writer second wrote=yes`
**after the question was drawn and before the confirmation**, so the send met a revision the pane
never saw:

- the conflict panel (`box=658,78,491x611`) holds three revisions —
  `2543689c… / beba1b1f… / beba1b1f…` — which are **exactly this tree's `base-r0.yml` and
  `elsewhere-r1.yml` digests** (§2's item 1): `expected ≠ found` and `diskRevision == found`, the
  reader's conjunction 3b §8.9 defines;
- the choices are *[Leave this as it is 108x23] [Load the version on disk 147x23]* with
  `keepMyDraft=absent keepMyRequest=absent` and `readiness ready=absent readyOperation=absent` —
  the restore surface offers a reload and **no reapply of either kind**, and no reapply panel was
  waited for (§8.2 item 2);
- the final block quotes *"Nothing was written. The file on disk is exactly as it was."*, the
  withdrawn-confirmation sentence, the three revision sentences, the retained operation (*"You
  asked to replace this file's whole text with the text of the backup entry selected here."*) and
  the **version on disk drawn in full — R1's text**;
- the actions block afterwards holds *Prepare to replace file* above the
  `refused.conflictShowing` sentence.

The byte lines: `bytes=MATCH` against `elsewhere-r1.yml (R1)` — the file ends as the second writer
left it, the conflict having written nothing — `tree-diff=5 lines` (exactly the writer's own
change), `entry-cmp=DIFFER`, `backup-tree=SAME`, `batches=before:1 after:1`: **a conflict takes no
backup**, which agrees with `persist/save.rs`'s ordering (the backup is taken between the verdict
and the commit, and a conflict is refused before either).

### 4.4 P53 — `restore-none:es`: the listed-and-empty catalogue

The one restore case that seeds nothing. `failed-lines=0`, `end-lines=1`, `probe.err=0 bytes`,
`picked=es lang=es`. After *Listar los lotes de copias reconocidos*, the batches step
(`box=658,265,491x220`) quotes **both** empty-state sentences: *"Todavía no hay carpeta de copias,
que es el estado normal de una configuración que espansoConfig nunca ha guardado."*
(`code.backupRootState.missing`) and *"La carpeta de copias se listó y no tiene ninguna carpeta que
esta aplicación reconozca como lote de copias."* (`browser.restore.batchesNone`) — a missing root
is an outcome and not a failure, drawn exactly as `BackupRootState::Missing`'s contract says. The
plan stops there: `restore final blocks=0`, `bytes=MATCH` against `base-r0.yml`, `backups=none`
(both halves of §5.4's search finding nothing), `tree-diff=0 lines`, and the restore block reads
`entry-cmp=unseeded`, `backup-tree=unseeded batch=none`, `batches=before:0 after:0`.

## 5. What this part does not reach and does not prove

Stated in §6.1's bounded style — each is a limit of these artifacts, not a promise about anything
else.

- **States never drawn by any launch here**: `batchesLoading` and `entriesLoading` (transient — the
  driver's waits outlast them by design), `batchesIncomplete`, `batchesSkipped` at the **batch**
  level (a foreign name, an unmarked batch, a symlinked batch name), `entriesNone`,
  `entriesRefused`, `entriesIncomplete`, `listedAgrees`'s two siblings **`listedDiffers` and
  `listedUnreadable`**, `sendFailed`, `mayHaveWritten`, `findingsAreStale`,
  `acknowledgedAsksAgain`, a refused save with findings (the `DocumentDoesNotParse` path — every
  candidate here parses), and every `restoreRefusal` arm except the two P50 and P52 drew
  (`alreadyRestored`, `conflictShowing`): `readOnly`, `targetMoved`, `noCandidate`, `inFlight` and
  all six open-surface refusals. `EntrySkipped` **was** drawn, but only its marker arm (P50, P51
  and P52 — every launch that listed the seeded batch).
- **The conflict's reload choices were reported, never pressed.** *Load the version on disk* and
  what follows a confirmed reload on this surface are 2c-5-6's to read, not this part's.
- **Bilingual coverage is aggregate, not per-state**: the replace and conflict tails ran in
  English, the cancel and empty-catalogue tails in Spanish; no restore state was drawn in both
  languages here. 2c-5-6 owes both languages on every surface.
- **The seeded catalogue is one batch with one entry.** Nothing here lists two batches (so the
  newest-first ordering is never observed over a pair), a batch with several entries, a nested
  entry deeper than `match/`, an `_outside` entry, or a disambiguated entry name.
- **The `batches=` counts count directory entries of the backup root**, by `ls -1`; nothing
  distinguishes a batch from any other entry a writer might leave there. On these launches the
  roots held only batch directories — read, per launch, off the retained trees.
- **No-write equivalence binds every `unchanged`-shaped reading here** exactly as 5a §6.1 states:
  there is still no invoke spy and no command counter, so `tree-diff=0` and `backup-tree=SAME` are
  readings of final bytes, not proofs that nothing wrote and unwrote.
- **The four residual rebindings of 5a §8.1 are inherited open and untouched** — `probe.rs` was not
  edited, so nothing here changes, measures or closes any of them.

## 6. The gates, re-derived with the harness in the tree, after the last driver edit

Predicted before building: **no movement anywhere** — the one driver edit was inside `src/probe.ts`
(0 modules; already among `svelte-check`'s files; no new test), `launch.sh` lives outside the
repository, and `probe.rs` was untouched. Measured:

| Gate | Answer |
|---|---|
| `cargo test --workspace` | **1153** passed, 0 failed |
| `npm run check` | **432** files, 0 errors, 0 warnings |
| `npm test` | **2124** passed (56 files) |
| `npm run build` | **185** modules transformed |
| `cargo clippy --workspace --all-targets -- -D warnings` | finished, no warnings |
| `cargo fmt --check` | clean |
| bundle oracle, server-only (`\$\$payload\|head_payload\|push_element`) | **absent** (`rg -c` exits 1) |
| bundle oracle, client-only (`window\.__svelte\|svelte-trusted-html`) | **2** |

Prediction and build agree on every row; the with-harness baseline stays `1153 / 432 / 2124 / 185`.

## 7. The manifest, and the repository after part 2

**`manifest-2c-5-5b-cases.sha256` — 24 entries**: the four scripts, the ten fixtures
(`restore-entry.yml` now among them), both probe sources by absolute path, and the `probe.log` and
`bytes.txt` of P50–P53. `shasum -a 256 -c` succeeds for all 24. It is a **post-image only**, and
part 1's `manifest-2c-5-5b-rebuild.sha256` was **not regenerated**: checked now, exactly two of its
29 entries fail — `launch.sh` and `src/probe.ts`, precisely the two files this part edited — and
that failing pair is the record of what part 2 changed, kept rather than erased (3d-2a §8.5's
lesson, once more).

**The repository after part 2.** `git status --short --untracked-files=all` lists exactly the four
harness paths — `src/main.ts` and `src-tauri/src/main.rs` modified, `src/probe.ts` and
`src-tauri/src/probe.rs` untracked — plus this record untracked, and nothing else; `git diff
--stat` over the two hook files still reads **5 insertions, 1 deletion**. No git command that
changes anything was run. The decoy set is unchanged from §2's item 8 — no new decoys, symlinks or
outside-tree files were created by any restore case, so 2c-5-7's deletion list is not lengthened by
this part; the tree gains `fixtures/restore-entry.yml`, the four launch directories P50–P53 and the
24-entry manifest.

## 8. Disposition of the round-1 review

One review round ran over the whole of 5b — both parts, this record, the driver, `launch.sh`, the
seeded layout against `backup.rs`, the drive against `RestorePane.svelte`, and the eleven requested
transcript directories. The reviewer's sandbox was read-only and could not create the review file;
the orchestrator captured the final message verbatim to `docs/reviews/phase-2c-5-5b-instrument.md`
under a capture note, exactly as 5a's rounds 6 and 7 were captured.

**The verdict is READY with no findings** — the first READY any instrument step of this project has
returned; 5a never produced one in seven rounds. The review found "no closure change is required",
so no fix round exists and, by the rule 5a's §16.4 restated, nothing here has changed since the
reviewed state: this section and the checkpoint are the only writes after the verdict, and this
section claims nothing about the code beyond what the review file records. The four residual
rebindings of 5a §8.1 were in the reviewer's brief as inherited-open and were not re-raised, which
leaves them exactly as inherited: **accepted, not proven**, unwidened by this step (the review
confirmed `src-tauri/src/probe.rs` was not touched by part 2), and still open for 2c-5-7 to delete
rather than for any step to close.
