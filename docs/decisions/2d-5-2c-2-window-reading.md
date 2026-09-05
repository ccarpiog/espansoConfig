# Phase 2d-5-2c step 2 — the narrow window regression reading of Phase 2d-5-2

**Date:** 2026-09-05
**Step:** 2d-5-2c-2, the second half of the split the orchestrator made on 2026-09-05.
**Instrument:** `/private/tmp/espansoconfig-harness-2d-5/`, inherited whole from
[`2d-5-2c-1-instrument-rebuild.md`](2d-5-2c-1-instrument-rebuild.md).
**Binary every launch of this step ran:**
`0af15a34b2d20c3b83bb1b84e3074fb97681de596afe7f0cd2b9f9f50fde62e9`.

This is a **window reading**: a claim about what a real screen does, backed by real launches of a real
macOS bundle. A green test suite is not a screen. **It produced no production source.** The only files
it changed are the instrument's own — `src/probe.ts`, which is untracked and deleted before this phase's
work lands, and `launch.sh`, which lives under `/private/tmp` and appears in no `git diff` — plus this
record.

**It does not claim real watcher delivery** (`2d-5-split-notes.md` §7 item 7; the full native matrix is
2d-7's), and it does not claim that any stored `WriteSurfaceTransition` was invoked. §6 says both again,
in the section that exists to be read.

---

## 1. What this step inherited, and what it had to build

Everything §9.1 of the instrument record lists was inherited and worked unchanged: the tree, the four
harness paths in the working tree, the launch recipe, the driver's shared machinery, and the rule that
`setTimeout` cannot carry a wait because every launch draws into an occluded WKWebView — every
transcript of this step prints `visibility=hidden`, as every earlier one did.

What it had to build is §9.2 item 1: **the instrument observed neither the write-surface registry nor
restore.** No transcript line reported `openWriteSurfaces()`, the registry's generation, or the
creator's reported destination, and no plan had ever opened the restore pane. §3 is what was added.

**The cost was the one §12.1 corrected the record to state, and it was paid in full**: a plan function,
a `runCase` arm (`src/probe.ts:1115` dispatches on the case name and its `default:` throws), a
case-table row in `launch.sh`, and a full rebuild in §3's order — `npm run build`, then
`touch src-tauri/build.rs`, then `cargo build -p espansoconfig --features custom-protocol`. `npm run
build` alone changes nothing; the bundle embeds `dist` at *cargo* build time. This step paid it once,
because the case worked on its first shakedown launch (§4.1, `S01`).

---

## 2. The ground check: is the `DetailPane` → `RestorePane` `surfaces` path live?

The brief required this verified by reading the files rather than trusted. It was, and the answer has
two halves that must not be collapsed into one.

### 2.1 The path is live, and every link in it was read

- `DetailPane.svelte:1322` passes `surfaces={() => browser.openWriteSurfaces()}` into `<RestorePane>`.
  That is the coordinator's registry, not a list the pane keeps: `openSurfaces` (the `satisfies
  Record<OpenWriteSurfaceKind, PaneWriteSurface>` assembly Phase 2d-5-2 built) is walked by
  `reconcileWriteSurfaces`, which is what puts anything in the registry at all.
- `RestorePane.svelte:340` calls that reader **once** inside `current`'s `$derived.by` and files the
  answer as `context.surfaces`.
- `restore.ts:1993`, inside `restoreRefusal`, asks
  `competingSurfaceFor(session.target, context.surfaces)`. A non-`null` answer is
  `{ kind: 'writeSurfaceOpen', surface }`, which `restoreRefusalKey` (`:743`) delegates to
  `openWriteSurfaceKey` (`:717`), which is a **user-visible, translated** sentence.
- `canPrepareRestore` (`:2005`) *is* `restoreRefusal(...) === null`, so the same answer decides whether
  the *Prepare* control is enabled — `RestorePane.svelte`'s `disabled={!current.view.canPrepare}` — and
  whether the confirmation is offered.
- At the send, `RestorePane.svelte:509` captures `const now = current` and `:515` hands
  `now.context.surfaces` to `browser.restoreDocument`, which rebuilds a `RestoreContext` around that
  very array (`workspace.svelte.ts:3328-3331`); `permitHolds` (`restore.ts:2550`) then re-asks
  `competingSurfaceFor` at `:2581` before spending the permit.

All six sentences exist in **both** dictionaries: `src/lib/i18n/en.json:476-481` and
`src/lib/i18n/es.json:476-481`.

**So the path is live and it is drawn.** The reading in §4 exercises it end to end, in both languages.

### 2.2 What the path cannot draw today, and that is the finding

**None of the six `openWriteSurfaceKey` sentences can be put on this screen**, and the reason is
structural rather than incidental:

- `AppShell.svelte:84` mounts exactly **one** `<DetailPane>`;
- `DetailPane.svelte:999`'s `busy` is true when any of the seven sessions is open, and **every opener is
  withdrawn while any surface is open — but by two different mechanisms, which is worth writing down
  because only one of them is the word `busy`.** The new-snippet form's opener (`:1155`) is guarded by an
  explicit `{#if !busy}` and sits *before* the surface chain. The other six sit *inside* arms of the same
  `{#if} … {:else if}` chain that come **after** all seven surface arms — the five match surfaces' in the
  `{:else if browser.selectedMatch !== null}` arm, the raw editor's and the restore's in the
  `{:else if browser.fileText !== null …}` arm — so an open surface wins the chain and their arm is never
  drawn. Either way, no opener is reachable while any surface is open;
- `competingSurfaceFor` (`restore.ts:471`) **skips `restore` entries**, and `CompetingWriteSurfaceKind`
  (`:363`) is `Exclude<OpenWriteSurfaceKind, 'restore'>`.

A `writeSurfaceOpen` refusal therefore needs a non-`restore` surface open over the same file **while the
restore pane is open**, and `busy` makes that state unreachable from a window.

**This is not a new defect and it is not a correctness defect in source.** `MatchCreator.svelte:415`'s
own doc comment already says it — *"The pane's `busy` rule is what keeps a restore from being open beside
this form at all, and that is a fact about `DetailPane.svelte` rather than a guarantee of this
component's"* — and `PROGRESS.md` records the same `busy` argument about `invalidateEverySurface`. The
guard is the conservative direction: it refuses restores it does not need to refuse, and over-refusing
costs one closed panel. It is recorded in §9 item 1 as a **coverage bound**, marked `recorded only`.

**What the reading therefore observes is the arm that *is* reachable**, and §3.1 explains why that arm
is worth a case rather than a shrug.

---

## 3. What was built

### 3.1 The case: `restore-registry`

One new plan, `restorePlan` (`src/probe.ts:1048`), reached by the `runCase` arm at `:1133`. Its shape,
and the reason for every step:

1. open the synthetic file, select `:beta`, open the **small editor**, type a replacement and save.
   The save commits, which is what puts a backup batch on disk for the restore to have something to
   restore *from*;
2. **close the editor** (`closeSurface`, `:932`, which answers the discard question if one is asked and
   then waits for the section to leave the document);
3. open the **new-snippet form**, press `match/conflict.yml` in its `.destinations` list, and close it
   again. This is Phase 2d-5-2's *other* change: `reportDestination` moves the registry entry's target
   from *names no file* to *names this one*, through the lease's `replaceTarget`;
4. show the file's text, open the **restore pane**;
5. report the refusal set and the enablement of both stages (`reportRestoreRefusal`, `:1005`);
6. list the batches, pick the one batch, pick the entry for this file (`pressOption`, `:966`), report
   again, press *Prepare*, report again, press *Replace entire file with the shown text*;
7. report the outcome panel and the final refusal set.

**Why this is a regression reading of 2d-5-2 and not a shrug.** Before 2d-5-2 the pane assembled its own
surface list *inside* the `{:else if restoring !== null}` arm, so the list could hold nothing but the
restore entry and a leaked registration was not a state the code could reach. After 2d-5-2 the registry
is long-lived and `reconcileWriteSurfaces` is what returns a lease when a kind leaves the assembly — so
**a leaked registration is a failure mode that exists only because of 2d-5-2**. This case is a detector
for it, over the two kinds this plan opens and closes: a `matchEditor` or `matchCreator` registration
this pane failed to return would make the restore that follows refuse **itself**, drawing
`browser.restore.refused.matchEditorOpen` or `…matchCreatorOpen`, disabling *Prepare*, timing the plan
out into `--- failed`, and leaving `bytes=DIFFER`.

**The detector's reach is narrower than "a leaked registration", and the boundary is the leaked
entry's `target`.** `competingSurfaceFor` (`src/lib/browser/restore.ts:476`) `break`s on
`target.kind === 'unknown'` — deliberately, and its comment says why: *a form that names no file
competes with no restore*. `DetailPane.svelte:585` gives the creator `{ kind: 'unknown' }` whenever
`creatorDestination === null`. So a leaked **`matchCreator` registration carrying no destination is
invisible to this case**, and no launch here would fail on it. What the five launches detect is a
leaked entry whose `target` is a `document` equal to the restored file — which is the shape this plan
constructs, because it gives the creator this same file as its destination before closing it. That is
a limit of the detector, **not** a defect in either function: the `unknown` arm is the deliberate
conservative direction, and widening it would refuse restores that compete with nothing.

**The reporter runs before the press it protects.** `reportRestoreRefusal(language, 'candidate')` is
emitted *before* `pressNamed(… 'browser.restore.prepare')`, so a leak would be **named in the transcript**
rather than only showing up as a timeout on a control whose label the timeout message repeats. That is
timing-dependent in one direction and the record says so: if the candidate's asynchronous read has not
landed when the line is written, the line reads `noCandidate` and the diagnostic is lost. In all five
launches of this case it had landed.

**Three small helpers, and no parallel machinery.** `closeSurface` and `reportRestoreRefusal` are built
out of `pressNamed`, `hasControl`, `waitFor`, `say`, `collapse` and `translate`. `pressOption` exists
because the restore pane draws its batches and its entries as two `ul.options` lists with **no class to
tell them apart**, and both labels come from the file system rather than from the dictionary — a batch is
named after a folder this application wrote, an entry after a path inside it — so neither can be matched
the way `pressNamed` matches a label. It takes the list **by position**, prints every label the list drew,
and then presses one **through `pressText`**, so the click still goes to an enabled control whose whole
collapsed text is the literal the transcript recorded.

`RESTORE_REFUSAL_KEYS` (`:94`) is the twelve refusal sentences with the six competing ones first, and
`RESTORE_COMPETING_COUNT` (`:118`) is how many of the leading entries those are. **Nothing in TypeScript
ties that number to `CompetingWriteSurfaceKind`**: a seventh competing sentence added without moving it
would make the reporter under-count, and no compiler would say so.

### 3.2 The case-table row, and what it means

```
restore-registry)   R1="elsewhere-r1.yml";      EXPECT="base-r0.yml" ;;
```

**`R1` is unused by this case** — no plan step runs the second writer — and it is named only because
`ECFG_PROBE_R1` is always passed. `EXPECT` is the **seed itself**: the plan edits the file and saves it,
the save copies the pre-edit bytes into a backup batch, and the restore then puts those bytes back. §4.5
is why `bytes=MATCH` is not vacuous, and it is the one place in this record a reader must not stop at the
word `MATCH`.

### 3.3 The rebuild

Run once, in §3's order, before the first launch: `npm run build` (187 modules), `touch
src-tauri/build.rs`, `cargo build -p espansoconfig --features custom-protocol` (exit 0, 43.20 s). The
binary that came out is the successor to 2d-5-2c-1's `40d1e67b…4c8254`, and its digest is on one line so
it can be searched for:

```
0af15a34b2d20c3b83bb1b84e3074fb97681de596afe7f0cd2b9f9f50fde62e9  target/debug/espansoconfig
```

**Every launch of this step recorded that digest in its own `bytes.txt`**, `N03` included. Three
searches confirm the driver's new code reached **`dist/assets/index-*.js`**, each counted as
**occurrences** rather than as matching lines (a minified bundle is one line, so `rg -c` would answer 1
whatever the truth): `restore-registry` occurs **once**, `probe_second_writer` **once** and
`probe_third_writer` **once**, as at 2d-5-2c-1.

**Those three searches are about `dist`, and they are not evidence about the binary** — a distinction
worth keeping, because the whole reason §3's order exists is that `dist` reaches the executable only at
*cargo* build time. Measured rather than assumed: `restore-registry` occurs **0** times in
`target/debug/espansoconfig`, since Tauri embeds the asset compressed and a plain string search cannot
see through that. **The evidence that the binary carried the new case is the launches themselves** —
`launch.sh restore-registry …` reached `--- end` and printed this case's four observation lines on a
binary whose digest is the one above, which a binary built before the driver edit could not have done;
its `runCase` `default:` would have thrown.

---

## 4. The launches

**Fifteen launches, all on one binary, into fifteen launch names never used before.** One plan per
launch, into a fresh bundle path (`1c-2b-2b-2-notes.md` §6.1). The language was set **explicitly through
the picker** on every plan-driven launch (`2c-2-2-window-reading.md` §1.2 — the webview's `localStorage`
follows the bundle identifier, which every probe bundle shares), and each transcript's second line
records that it took: `--- language picked=… lang=… label=ok`.

`launch.sh` conjoins nothing. **The verdict below is this reader's conjunction** of `reached-end=yes`,
`failed-lines=0`, `probe.err=0` and `bytes=`, read from each launch's own retained `bytes.txt` and
`probe.log`.

### 4.1 The set, and every launch's verdict

| Launch | Plan | `bytes` | `backups` | `tree-diff` | `probe.err` | end / failed | Verdict |
|---|---|---|---|---|---|---|---|
| `S01` | `restore-registry:en` | MATCH | PRESENT | 1 | 0 | 1 / 0 | **pass** (shakedown; passed first time) |
| `R01` | `restore-registry:en` | MATCH | PRESENT | 1 | 0 | 1 / 0 | **pass** |
| `R02` | `restore-registry:es` | MATCH | PRESENT | 1 | 0 | 1 / 0 | **pass** |
| `R03` | `restore-registry:en` | MATCH | PRESENT | 1 | 0 | 1 / 0 | **pass** (repeat) |
| `R04` | `restore-registry:es` | MATCH | PRESENT | 1 | 0 | 1 / 0 | **pass** (repeat) |
| `R05` | `creator-front:en` | MATCH | PRESENT | 9 | 0 | 1 / 0 | **pass** |
| `R06` | `creator-front:es` | MATCH | PRESENT | 9 | 0 | 1 / 0 | **pass** |
| `R07` | `editor-exact:en` | MATCH | PRESENT | 10 | 0 | 1 / 0 | **pass** |
| `R08` | `deleter-exact:es` | MATCH | PRESENT | 8 | 0 | 1 / 0 | **pass** |
| `R09` | `mover-exact:en` | MATCH | PRESENT | 8 | 0 | 1 / 0 | **pass** |
| `R10` | `duplicator-exact:es` | MATCH | PRESENT | 8 | 0 | 1 / 0 | **pass** |
| `R11` | `raw-negative:en` | MATCH | none | 5 | 0 | 1 / 0 | **pass** |
| `R12` | `editor-collision:es` | MATCH | none | 5 | 0 | 1 / 0 | **pass** |
| `R13` | `editor-third:en` | MATCH | none | 9 | 0 | 1 / 0 | **pass** |
| `N03` | *no plan* (`inert.sh`) | — | — | 0 | 0 | zero-byte log | **pass** — `target-unchanged=yes`, `alive-at-kill=yes` |

**Nine cases, every one on this step's binary; fourteen plan-driven launches, eight `:en` and six
`:es`.** Two of the nine cases were run in **both** languages — `restore-registry`, twice in each, and
`creator-front` — and the other seven in one language each, so it is the set that is balanced rather
than each case. `S01` is
retained and reported as a shakedown rather than quietly promoted: it ran the same binary as `R01`–`R13`
and passed on the first attempt, which is a fact about this case and not a claim that shakedowns are
unnecessary.

**`Q01`–`Q13` are a superseded shakedown generation on three earlier binaries** and are **not evidence
for this step**; `Q21`–`Q28` are 2d-5-2c-1's proof set on binary `40d1e67b…`. §4.3 says what this step
does and does not take from them.

### 4.2 What the five `restore-registry` transcripts showed

All five (`S01`, `R01`–`R04`) drew **the same four observation lines**, and here they are **identical
across all five, byte for byte** — the batch's folder label and every language-dependent string live on
the `--- restore options` lines, which these four are not and which are shown separately below:

```
--- restore opened pane=present refusals=[browser.restore.refused.noCandidate] competing=0 prepare=absentOrOff confirm=absentOrOff
--- restore candidate pane=present refusals=[] competing=0 prepare=enabled confirm=absentOrOff
--- restore confirming pane=present refusals=[] competing=0 prepare=absentOrOff confirm=enabled
--- restore final pane=present refusals=[browser.restore.refused.alreadyRestored] competing=0 prepare=absentOrOff confirm=absentOrOff
```

The identity is measured, not eyeballed: the four lines of each of the five `probe.log` files hash to
the same `a0aebd2ff5ba…` under `shasum`, `:es` launches included.

The two lines a launch also writes between `opened` and `candidate` are the ones that do vary, and they
are the reason the caveat belongs here rather than on the block above — this pair is `R01`'s:

```
--- restore options list=0 count=1 [Backup batch named 2026-09-05T025126Z]
--- restore options list=1 count=1 [match/conflict.yml]
```

**The spacing in both blocks is the transcript's own.** An earlier draft of this section
column-aligned the four observation lines for readability while calling them *"character for
character"* in the same sentence, which made the block a paraphrase wearing the shape of a quotation —
the padding appears in no `probe.log`. That draft also hung its *"apart from the batch's folder label
and the language"* caveat on the four lines, none of which can carry either.

Read against `restoreRefusal`'s ordering (`alreadyRestored` → `readOnly` → `inFlight` →
`conflictShowing` → `noCandidate` → `targetMoved` → `writeSurfaceOpen`):

- **`opened`** draws `noCandidate`, which is the correct earlier reason: nothing has been read yet, and
  the pane does not reach the surface question at all;
- **`candidate`** draws **no refusal and `prepare=enabled`**. `canPrepareRestore` is
  `restoreRefusal(...) === null`, so at this moment every one of the seven conditions was `null`,
  the surface question among them: `competingSurfaceFor(session.target, browser.openWriteSurfaces())`
  answered `null` after an editor and a creator had each been opened, used and closed over this same
  file;
- **`confirming`** draws the destructive control enabled, which is `disabled={current.view.refusal !==
  null}` reading the same answer a second time;
- **`final`** draws `alreadyRestored` — the write happened and the pane will not offer another.

The two outcome panels each say the write landed. In English (`S01`, `R01`, `R03`), the editor's:
*"The file was written. What is on disk now is exactly the text that was sent. A copy of this file as it
was before this session's first change to it was kept…"*, and the restore's: *"…This attempt wrote the
whole of this file. Every snippet of it has a new identity now, so nothing this window held about this
file still applies: close this and open the file again."* `R02` and `R04` drew the Spanish of both,
through the picker, with `picked=es lang=es label=ok`.

**No launch needed the acknowledgement branch.** `restorePlan`'s `browser.rawSave.choice.saveAnyway`
arm was written defensively and never fired: no restore in this set was refused with findings.

### 4.3 The eight inherited cases, re-run on this binary

`R05`–`R13` re-run **the eight cases** the instrument already had — one per write surface, the raw
editor's being its negative-capability case, plus the two extra editor variants (`editor-third` and
`editor-collision`) — on **this step's** binary, five `:en` and four `:es`. That is **nine launches
over eight cases**, and all nine pass by the same conjunction. The case run twice is
**`creator-front`** — `R05` (`:en`) and `R06` (`:es`) — because 2d-5-2's second deliverable is the
creator reporting its destination upward, so it is the one inherited case this step had a reason to see
in both languages. The other seven ran once each: `R07` `editor-exact:en`, `R08` `deleter-exact:es`,
`R09` `mover-exact:en`, `R10` `duplicator-exact:es`, `R11` `raw-negative:en`, `R12`
`editor-collision:es`, `R13` `editor-third:en`.

The heading's *eight* counts cases and the *nine* counts launches; an earlier draft enumerated them as
*"all six write surfaces, the raw editor's negative-capability case, and the two editor variants"*,
which sums to nine cases by counting the raw editor twice — once as a surface and again as
`raw-negative`, which is the only case that surface has.

**Why they were re-run rather than inherited from `Q21`–`Q28`.** No production source changed between
2d-5-2c-1 and this step, so `Q21`–`Q28` are evidence about the same production source. What differs is
the **probe binary**: this step edited `src/probe.ts`, which forced a rebuild, so every earlier launch
ran bytes this step's screen did not. Re-running them costs nine launches and removes the need to argue
that a driver edit could not have perturbed the eight cases it did not touch.

### 4.4 The no-plan control

`N03` (`inert.sh`) launched the same bundle with **no** `ECFG_PROBE_*` variable: zero-byte `probe.log`,
zero-byte `probe.err`, `tree-diff=0`, `target-unchanged=yes`, `alive-at-kill=yes`. The kill's status is
what makes the silence a *running window's* silence rather than a bundle that never started. It measures
exactly what `inert.sh`'s own header says and no more: **it does not establish that no writer was
spawned**, because this harness has no invoke spy and no command counter.

### 4.5 Why `bytes=MATCH` is not vacuous on this case, and the one way it could be over-read

`EXPECT=base-r0.yml` is **also what an untouched file looks like** — the launch seeds `base-r0.yml` as
the target. So `bytes=MATCH` alone would be satisfied by a plan that did nothing at all. It is not
over-read here because three readings are conjoined, and all three are in the retained artifacts:

1. **`backups=PRESENT`** — a backup batch exists, so at least one write committed;
2. **`tree-diff=1`**, and the one line is `Only in …/xdg/espanso: .espansoconfig-backups`. The **target
   file itself is byte-identical to the pristine pre-launch copy**, while a write demonstrably happened;
3. the transcript's two committed outcome panels, and the `alreadyRestored` line that follows only a
   committed replacement.

Additionally, the retained backup was compared directly: `S01`'s
`.espansoconfig-backups/<batch>/match/conflict.yml` is **byte-identical to `fixtures/base-r0.yml`**, so
what the restore wrote is the seed and not a coincidence of shape. Note also that the tree holds **one**
batch, not two — a backup is *this session's first change to this file*, so the restore reused the batch
the editor's save opened rather than adding one.

**The way a later reader could over-read it** is by sweeping `launches/` for `bytes=MATCH` and treating a
`restore-registry` hit as a restore having happened. It is not; it is a restore having happened *or*
nothing having happened. §9 item 6 carries this.

---

## 5. Deviations from what the records describe

1. **`ECFG_PROBE_WAIT=70` on every `restore-registry` launch.** The plan drives three surfaces and eleven
   controls, which does not fit `launch.sh`'s default 25-second wait. The variable is the script's own
   documented knob and no script was changed for it; the eight inherited cases ran at the default.
2. **`launch.sh` gained one case row and a five-line comment**, at `:63-68`. That file lives under
   `/private/tmp` and is in no `git diff`. The manifest was **not** regenerated: a new post-image,
   `manifest-2d-5-2c-2-post.sha256` (46 lines), sits beside `manifest-2d-5-2c-1-post.sha256`, which is
   untouched. §9.1 of the instrument record forbids regenerating the old one; writing a second one
   preserves both.
3. **`S01` is retained as a shakedown even though it passed.** The instrument record's Q-generation
   precedent retains failures; this retains a success, and labels it, so a reader counting proof launches
   is not silently given five where the record claims four.
4. **No fixture was added.** `EXPECT` reuses `base-r0.yml`, which is the point of the case rather than a
   shortcut (§4.5).

---

## 6. What this reading does **not** prove

1. **It does not observe the registry.** `AppShell.svelte:24` calls `createBrowserState()` into a
   component-local `const`, so no module singleton exists and the driver cannot read
   `openWriteSurfaces()`, `writeSurfaceGeneration()` or `transitionFor` directly. Making them reachable
   would mean changing production source, which this step did not do. Everything here is an inference
   from what a screen drew.
2. **`prepare=enabled` is a conjunction of seven conditions and this reading cannot isolate the
   registry's.** It is *necessary* that `competingSurfaceFor` answered `null`; it is not *sufficient* to
   say the registry held the right entries.
3. **It cannot tell an empty registry from a correct one.** `competingSurfaceFor` skips `restore`, so
   this pane's own entry is invisible on screen by construction. What the case detects is a **leak** —
   a registration `reconcileWriteSurfaces` failed to return — and nothing about presence.
4. **It says nothing about `reportDestination` firing.** The `--- creator destination="match/conflict.yml"`
   line records that the destination control was pressed and nothing more; no screen draws the reported
   destination. What is observed is that pressing it and then closing the form leaves no residue that
   refuses the restore.
5. **No transition was invoked, and none could be.** `transitionFor` has no production caller until
   2d-5-4/2d-5-5, and `DetailPane.svelte`'s `tellNobodyYet` is a no-op for all seven kinds.
6. **It does not claim real watcher delivery.** Nothing in this instrument observes the file watcher.
   `2d-5-split-notes.md` §7 item 7 forbids the claim and the full native matrix is 2d-7's.
7. **`HTMLElement.click()` is not a mouse click**, no plan uses the keyboard, every window was occluded
   (`visibility=hidden`, `hasFocus=false`) at 1180x728, and **a sentence that is false renders exactly as
   well as one that is true**. A label was matched against the dictionary, never read for meaning.
8. **The six competing-surface sentences were never drawn**, because they cannot be (§2.2). Their
   correctness rests on `restore.test.ts` and on review, not on any screen.
9. **One fixture shape only.** R38 stands: `base-r0.yml` is plain LF, no BOM, no block scalar, no
   item-owned comment, one sequence. A restore over any of `CLAUDE.md` §4's fifteen fixtures is
   unevidenced.

---

## 7. Privacy

Every launch ran with `XDG_CONFIG_HOME` and `HOME` pointed inside its own launch directory, so neither
candidate path `resolve_config_dir()` probes reaches the owner's configuration. The synthetic tree holds
two hand-authored files whose content is neutral.

**The sweep, and what it is a reading of.** The fifteen new launch directories were searched, excluding
the copied `.app` bundles, for `/Users/ccarpio/Library`, for `@`, and for `Dropbox`: **no match in any
retained text artifact**. That is a reading of `probe.log`, `probe.err`, `bytes.txt`, `tree.diff` and the
synthetic YAML trees, and **not** of the retained bundles, which are copies of a binary built from this
repository.

**The sweep is stated by the kinds it read, not by a file count per launch, and that is a correction.**
An earlier draft said *"10 files per restore launch, 8 per other launch"*, which is false in both
directions: the launches that performed a restore carry an extra `.espansoconfig-backups` tree and so
hold more files than the ones that did not, and the total depends entirely on which extensions a
counter includes. The sweep's *result* is what this section claims and it reproduces; the count was a
figure attached to it that nothing measured. No content of the owner's configuration
is quoted anywhere in this record; the batch folder labels that appear in §4 are timestamps this
application wrote inside a launch directory.

---

## 8. The gates

**With the instrument in the working tree the four commands answer `1320 / 439 / 2255 / 187`. That is not
a production figure**; the production baseline is `1320 / 438 / 2254 / 186` and no source file moved this
step, so it is unchanged.

**Every figure was predicted before it was measured**, and the prediction was the trivial one: this step
edited an existing module and added no file, so nothing should move from what 2d-5-2c-1 measured with the
harness in the tree. All seven landed on the prediction.

| Command | Predicted | Measured | Exit |
|---|---|---|---|
| `npm run check` | 439 files, 0 errors, 0 warnings | **439 files, 0 errors, 0 warnings** | 0 |
| `npm test` | 2255 passed | **59 files, 2255 passed** | 0 |
| `npm run build` | 187 modules | **187 modules** | 0 |
| `cargo test --workspace -- --test-threads=1` | 1320 | **1320** | 0 |
| `cargo fmt --check` | clean | clean | 0 |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | clean | 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing | finds nothing | 1 (`rg`, no match) |

**The cargo gate was run in the authoritative form for this host** — `--test-threads=1`, because a
parallel run fails `watch_check` flakily and that is a host finding — and **its status was read from the
command itself, never through a pipe**: the run was redirected to a file and the file was then queried.
The sum was taken over **26** `test result` lines *and* the complementary question was asked: **no `test
result` line lacking `0 failed`** (the filtered count is 0). A sum can be right while a binary is silent.

**Both bundle oracles were read and both lines are reported**, the second because it proves the search can
match at all — searching for `svelte/internal/server` is vacuous, since Vite minifies specifiers away:

```
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-*.js   → no match (ABSENT, as required)
rg -c 'window\.__svelte|svelte-trusted-html'  dist/assets/index-*.js   → 2       (PRESENT, as required)
```

**The working tree is exactly the four harness paths plus this record.** `git status --short
--untracked-files=all` shows ` M src-tauri/src/main.rs`, ` M src/main.ts`, `?? src-tauri/src/probe.rs`,
`?? src/probe.ts` and nothing else under `src/lib/`, `crates/` or `src-tauri/src/`. `git diff --stat` over
the two hook files is **`5 insertions(+), 1 deletion(-)`**, which is what `PROGRESS.md` requires and what
2c-5-5a §2.1's four lines predict. **Nothing was committed.**

---

## 9. Where it is thin

Every item carries one of the two marks `CLAUDE.md` §7.3 defines. **No item here commissions a review
round**; §7.1 is the only mechanism and it reads a diff. **No item here names a correctness defect in a
source file**, so none is a blocker and none holds this step open.

1. **`recorded only` — the six `openWriteSurfaceKey` sentences cannot be drawn on this screen.** §2.2 is
   the argument: one `DetailPane`, `busy` at `:999`, every opener in a later arm of the same chain, and
   `competingSurfaceFor` skipping `restore`. Both dictionaries hold all six in `en` and `es`, and
   `restore.ts`'s own suite covers the predicate; what has no screen behind it is the **drawn** sentence.
   The code is right and the guard is the conservative direction, and `MatchCreator.svelte:415` already
   says so — this is a coverage bound, not a defect. It closes only if some later phase lets a second
   surface be open beside a restore, which would be a behaviour change nobody has asked for.
2. **`recorded only` — `prepare=enabled` is the conjunction of seven refusal conditions.** The transcript
   cannot attribute the enablement to the registry alone (§6 item 2). What the case *can* do is fail when
   a registration leaks, which is the failure mode 2d-5-2 introduced.
3. **`recorded only` — an empty registry and a correct one read identically here** (§6 item 3). Nothing a
   window draws distinguishes them while `competingSurfaceFor` skips `restore`.
4. **`recorded only` — the `candidate` diagnostic line is timing-dependent in one direction.**
   `reportRestoreRefusal(…, 'candidate')` is emitted before the *Prepare* press so a leak is **named**
   rather than only timing the plan out; but if the entry's asynchronous read has not landed the line
   reads `noCandidate` and says nothing about surfaces. It landed in all five launches. Nothing forces
   it to.
5. **`recorded only` — `pressOption` takes an options list by position.** The restore pane draws two
   `ul.options` with no class to tell them apart. A third list inserted before the entries would make
   index 1 select the wrong one, and the plan would press a wrong-but-enabled control rather than fail.
   Nothing tests it, and `src/probe.ts` is untracked instrument code deleted before this phase's work
   lands, so this names no defect in a shipped source file.
6. **`recorded only` — `bytes=MATCH` on `restore-registry` is `EXPECT=base-r0.yml`, which is also the
   seed.** §4.5 gives the three-way conjunction that makes it evidence. A reader sweeping `launches/` for
   `bytes=MATCH` and stopping there would over-read this case, exactly as `2d-5-2c-1` §10 item 4 warns
   about `Q01`–`Q13`.
7. **`recorded only` — `RESTORE_COMPETING_COUNT` is a hand-maintained 6.** Nothing in TypeScript ties it
   to `CompetingWriteSurfaceKind`, so a seventh competing sentence would make the reporter under-count
   silently. Same instrument-code caveat as item 5.
8. **`recorded only` — the four confinement residuals of `2d-5-2c-1` §4.5 are inherited unchanged.** No
   confinement control was re-run this step; `C01`–`C07` stand as that step measured them, on its binary
   and not on this one. The writers this step's plan never calls are the second and third writers, so the
   inheritance was not exercised either way.
9. **`recorded only` — no launch here observes the file watcher, and none may claim it** (§6 item 6).
10. **`recorded only` — R38 is untouched.** Every launch of this step used the same easy fixture shape as
    every earlier reading. A restore, a reapply or a conflict drawn over a block scalar, a BOM or a CRLF
    document remains unevidenced at the window.
11. **`actionable` — the instrument's scratch files outside the harness tree must be deleted separately.**
    Inherited from `2d-5-2c-1` §10 item 8: `/private/tmp/espansoconfig-probe-decoy-C01.yml` …
    **`…-C07.yml`** and their `.before` siblings — **fourteen files**, verified present on disk by this
    step. `rm -rf` on the harness path does not reach them. **The inherited list said `C01`…`C05` and
    was four files short**: `C06` and `C07` were created by 2d-5-2c-1's own fix round, when §12.4
    re-took the two confinement controls to measure the wait-loop fix, and that round did not widen the
    cleanup list it had written earlier. Their `bytes.txt` names binary `40d1e67b…` — 2d-5-2c-1's, not
    this step's — and their mtimes (03:31) fall after that step's manifest (03:13) and before this step
    began, so both facts agree on whose they are. This
    step added **nothing** outside the harness tree — its fifteen launch directories and
    `manifest-2d-5-2c-2-post.sha256` are all under `/private/tmp/espansoconfig-harness-2d-5/`. It names no
    correctness defect in a source file, so a later step adopts it as cleanup and it holds nothing open.

---

## 10. What §7.1 commissions for this step

**Nothing, because §7.1's input is a *fix round's* diff and this step is not a fix round.** §7.1 is the
only mechanism that commissions a review round, and what it reads is the diff of a fix answering a
previous round. This step answers no round. Whether the step gets a review at all is the workflow's
decision, not §7's.

**What this step actually changed, listed so a later reader does not have to reconstruct it:**

- `docs/decisions/2d-5-2c-2-window-reading.md` — new, and on §7's closed list;
- `src/probe.ts` — the instrument's driver: one plan, three helpers, one constant table, one `runCase`
  arm. **This record does not claim that file is exempt from §7's definition of source.** It is in the
  working tree, it is never committed, and a later step deletes it; whether an untracked instrument file
  is "source" for §7's purposes is a question this step does not have to answer and therefore does not,
  because no fix round's diff is being read here. A round that wants to review it can.
- `/private/tmp/espansoconfig-harness-2d-5/launch.sh` — one case row and its comment. Not a file in this
  repository at all; it appears in no `git diff`.
- `/private/tmp/espansoconfig-harness-2d-5/manifest-2d-5-2c-2-post.sha256` — new, beside the untouched
  `manifest-2d-5-2c-1-post.sha256`. Also outside the repository.
- `src-tauri/build.rs` was **`touch`ed** and not edited, which is what §3's rebuild order requires. It
  changes an mtime and not a byte, and `git status --short --untracked-files=all` shows no modification
  to it.

**No file under `src/lib/`, `crates/` or `src-tauri/src/` other than the untracked `probe.rs` — which
this step did not touch — differs from `HEAD`.** The two hook files are unchanged at
`5 insertions(+), 1 deletion(-)`. **Nothing was committed.**

### 10.1 The review, its six findings, and why §7.1 commissions nothing for the fix

The step's one review (`docs/reviews/phase-2d-5-2c-2.md`) returned **`ship-with-fixes` — 0 blockers,
6 SHOULD-FIX**. **The orchestrator re-derived every one against the files before accepting it**, as
2d-5-2c-1 did with its four; all six held, and all six were defects in *this record* rather than in
anything the launches measured. In the order they are fixed above:

1. **The leak detector's reach was unscoped for `matchCreator`** (§3.1). `competingSurfaceFor` breaks
   on `target.kind === 'unknown'` and `DetailPane.svelte:585` gives the creator exactly that when it has
   no destination, so a leaked destination-less creator registration is invisible to this case. The
   claim is now bounded to a leaked entry whose `target` is a `document` equal to the restored file —
   which is what the plan constructs. **This is the record-claims-more-than-the-code class**, and it is
   the one finding of the six that changed what the reading may be said to prove.
2. **Three bundle searches were presented as evidence about the binary** (§3.3). They are searches of
   `dist`. Measured: `restore-registry` occurs **0** times in `target/debug/espansoconfig`, because the
   asset is embedded compressed. The evidence that the binary carried the new case is that the launches
   *ran* it — a pre-edit binary's `runCase` `default:` would have thrown.
3. **A quoted transcript block was column-aligned padding no `probe.log` contains**, while the sentence
   above it said *"character for character"* (§4.2). The block is now the transcript's own spacing, the
   identity is measured (`shasum`, all five equal), and the varying `--- restore options` pair is quoted
   where it belongs.
4. **"The eight inherited cases" was enumerated as nine** by counting the raw editor both as a surface
   and as `raw-negative`, its only case (§4.3). Eight cases, nine launches, and the case run twice is
   now named.
5. **The privacy sweep carried a per-launch file count that nothing measured** (§7). Restore launches
   carry a backups tree and hold more files than the rest, and the total depends on which extensions are
   counted. The sweep is now stated by the kinds it read; its result is unchanged and reproduces.
6. **The `actionable` cleanup item listed `C01`…`C05` and was four files short** (§9 item 11). `C06` and
   `C07` exist, created by 2d-5-2c-1's own fix round; the item now says `C01`…`C07`, fourteen files.
   The review also left this open as a `NOT-VERIFIED` — whose step created them — and it is answered
   above from two agreeing facts, their `bytes.txt` binary digest and their mtimes.

**§7.1 commissions nothing for this fix round.** Its whole diff is this one file,
`docs/decisions/2d-5-2c-2-window-reading.md`, which is under `docs/` and therefore on §7's closed list.
**No source file changed** — not `src/probe.ts`, not `launch.sh`, not a fixture, not a launch artifact,
and nothing under `src/lib/`, `crates/` or `src-tauri/src/`. So §7.2 closes the step, and it closes it
on the shape §7.2 names: *a tail ends the first time a fix stops touching source*. The
`/autoclaude-opus` workflow reaches the same place by its own route — one review per phase, no
re-review inside it.

**Two things the review reported as `NOT-VERIFIED`, carried rather than dropped.** It did not re-run
the gates (the cargo suite alone exceeds its budget); **the orchestrator ran all seven plus both bundle
oracles itself**, and §8 is that measurement, not the worker's. And it could not confirm from an
independent clock that the fifteen launches were taken on a real screen at the stated times — it
confirmed only that the artifacts are internally consistent and all carry one binary digest equal to
the current `target/debug/espansoconfig`. That bound is real and is the same one every window reading in
this project carries.
