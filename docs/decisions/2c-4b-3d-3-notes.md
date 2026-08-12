# 2c-4b-3d step 3 — the harness's removal, and a production baseline that was stale

**Status: complete.** This is the last step of 2c-4b-3d and it closes 2c-4b-3d.

It removes the window-reading harness built at 3d-2a and used by the 3d-2b reading, and returns the
four gates to their **measured harness-free working-tree values**. (Those are not the same statement
as "what a fresh clone produces": no clone was made, and a fresh clone needs `npm install` before any
frontend gate will run at all.) It changes **no tracked source file**: the whole of
its effect is the absence of two untracked files, the reversion of four hook lines to what `HEAD`
already held, and the deletion of a 3.0 GB scratch tree.

Its one finding is not in the application. **The production frontend test count this step was told to
return to — `1623` — was stale**, and had been carried forward through three consecutive step records
without being re-derived. The true figure at `HEAD` is **1633**. §3 is that correction.

---

## 1. What was removed, and by which method

The harness had two halves, in two places, exactly as `2c-4b-3d-2a-instrument-rebuild.md` recorded.

### 1.1 The repo-side half

- **`src/probe.ts`** and **`src-tauri/src/probe.rs`** — deleted outright. Both were untracked, so
  deleting them changed no tracked file and required no git operation.
- **Four hook lines**, in two tracked files: `import { startProbe } from './probe';` and the
  `startProbe();` call after the mount in `src/main.ts` (`:20`, `:37`), and `mod probe;` plus
  `probe::register_with_probe(tauri::Builder::default())` in `src-tauri/src/main.rs` (`:47`, `:124`).

**The method was `git checkout -- src/main.ts src-tauri/src/main.rs`, not a hand edit**, and the
difference is worth stating because the checkpoint prescribed the hand edit 2c-4a-3c-5 used. The
condition the checkpoint attached to that prescription — *do not `git checkout` blindly if anything
else is pending in those files* — was **checked before the command was run, not assumed**: the
complete `git diff` was read and was exactly the four hook lines, and `git diff --stat` over the two
paths was **5 insertions and 1 deletion**, the figure the checkpoint predicted.

**Say what the command does, not what it is commonly believed to do.** `git checkout -- <paths>` with
no treeish restores the worktree from the **index**, not from `HEAD`, and a plain `git diff` shows
only the worktree-against-index difference — so neither the command nor that one check would, on its
own, establish equality with `HEAD`. Two observations establish it here, and they are recorded because
the argument rests on them rather than on the command's name:

- **Before**, `git status --short` showed ` M src/main.ts` and ` M src-tauri/src/main.rs` — a **space
  in the index column** for both, so the index already equalled `HEAD` and the restore drew from a
  clean index.
- **After**, `git status --short --untracked-files=all` returns **nothing at all** and `git diff` is
  empty, so worktree, index and `HEAD` are equal.

### 1.2 The scratch half

`/private/tmp/espansoconfig-harness-2c-4b-3d/`, **3.0 GB**, deleted with `rm -rf`. Its inventory was
taken immediately before the deletion and matched the checkpoint's description in every particular:

| Entry | Count |
|---|---|
| `launches/P01…P75/` | **75** launch directories |
| `fixtures/` | **21** files |
| `manifest-3d-2a-post.sha256` | 46 entries |
| `manifest-3d-2b-post.sha256` | 131 entries |
| `manifest-3d-2b-fix-post.sha256` | 177 entries |
| `launch.sh`, `run-batch.sh`, `make-manifest-3d-2b.sh`, `make-manifest-3d-2b-fix.sh` | 4 scripts |

The 21 fixtures were **1 + 11 + 9**: `base-r0.yml`; the eleven R1 files `anchor-changed-r1.yml`,
`elsewhere-r1.yml`,
`reordered-beta-first-r1.yml`, `reordered-r1.yml`, `target-ambiguous-r1.yml`, `target-changed-r1.yml`,
`target-deleted-r1.yml`, `target-empty-quoted-r1.yml`, `target-empty-replace-r1.yml`,
`target-labelled-r1.yml` and `target-satisfied-r1.yml`; and the nine hand-authored expected-bytes
files `creator-front-`, `deleter-exact-`, `duplicator-exact-`, `editor-exact-`, `editor-fallback-`,
`mover-after-`, `mover-end-`, `mover-exact-` and `mover-reordered-expected.yml`.

**The three manifests were deleted with the tree and were not regenerated**, which is what the
checkpoint directed and why: a manifest is a statement about a moment, and `2c-4b-3d-2a`'s §8.5 is
this project's record of what regenerating one destroyed.

### 1.3 The bound on that — this step verified no manifest before deleting it

**3d-3 did not re-run any manifest, and cannot claim the artifacts were unchanged since 3d-2b closed.**
Two things follow, and both are bounds rather than problems:

- The last verification state of the three manifests is the one 3d-2b recorded (177 verifying in
  full; 131 verifying 130; 46 verifying 45, the single failure in each being `src/probe.ts` and
  nothing else, because the review round instrumented it).
- By the time the scratch tree was deleted, `src/probe.ts` had **already** been deleted in §1.1, so
  `manifest-3d-2b-fix-post.sha256` could no longer have verified in full at that instant even had it
  been run. Re-verification was not an obligation of this step and was not attempted; the ordering is
  recorded so no later reader infers a check that did not happen.

### 1.4 The residue sweep

```sh
rg -in 'startProbe|register_with_probe|ECFG_PROBE|probe_plan|runPlan|probe' src src-tauri/src scripts
```

finds **no harness identifier**. Every remaining hit is the ordinary English word, in production code
that predates the harness: discovery "probes" the standard locations (`commands.rs`,
`workspace.svelte.ts`, `AppShell.svelte`, `errors.ts`, `commands.ts`), a `Probe` type name inside a
`wire_contract.rs` test fixture, a `probe` local in a `menu.rs` test, the `__ignore-probe.yml` guard in
`sync-real-corpus.sh`, and the offset-counting `probe:` key in `build-byte-exact-fixtures.sh`. The
harness itself survives only in the decision records that **describe** it in prose, which is where the
technique is meant to live.

`git status --short --untracked-files=all` returns **nothing**, and `git diff` is empty.

---

## 2. The gates, before and after

Every command was run by the orchestrator on the exact tree, before and after, and no number here is
taken from a worker's report or from an earlier record.

| Gate | With the harness | After the removal | Production figure |
|---|---|---|---|
| `npm test` | 1634 passed, 49 files | **1633 passed, 49 files** | **1633** — see §3 |
| `npm run check` | 419 files, 0 errors, 0 warnings | **418 files, 0 errors, 0 warnings** | 418 ✅ |
| `npm run build` | 176 modules | **175 modules** | 175 ✅ |
| `cargo test --workspace` | 1086 passed, 0 failed | **1086 passed, 0 failed** | 1086 ✅ |
| `cargo clippy --workspace --all-targets -- -D warnings` | — | clean | |
| `cargo fmt --check` | — | clean | |
| `cargo tree -p espansoconfig-core \| rg tauri` | — | finds nothing | |

`cargo test` was **checked rather than assumed**, as the checkpoint required: `src-tauri/src/probe.rs`
declared no test, so the prediction was that removal would not move it, and the run confirms 1086 by
summing the 25 per-binary results.

### 2.1 The module guard, with its arithmetic

**The production baseline stayed 175**, and the observed build count moved **176 → 175** — the
harness's contribution was one module and it is gone. (Those are two different sentences, and the
first is not licence to say the count did not change.)

```
172   the baseline at 2c-4a-3a
+ 1   src/lib/components/reveal.ts   (2c-4a-3c)
+ 1   src/lib/browser/draftKind.ts   (2c-4a-3c-4)
= 174 the baseline at 2c-4a-3c-5
+ 1   src/lib/browser/reapply.ts     (2c-4b-2)
= 175 production, unchanged through 3a, 3b, 3c and 3d
+ 1   src/probe.ts                   (the harness)
= 176 with the harness
```

**The shape is what is checked, not the number** — that is `CLAUDE.md` §6's guard, quoted as this
project's rule: a count that moves by exactly the number of source modules added or removed is a
module change, and a jump toward ~180 with `svelte/internal/server` in the bundle is the
`resolve.conditions` regression.

**The guard is a rule of thumb about this bundle, not a law about bundlers**, and the attribution here
is argued from what was observed on this exact before/after tree rather than from the rule: the only
frontend source file removed was `src/probe.ts`, which `src/main.ts` imported; the count fell by
exactly one; and `rg` over `dist/assets/` finds **no** `svelte/internal/server` and **no**
`async_hooks`. In general a module count need not track source files one-for-one — imports,
tree-shaking and virtual modules all break the correspondence — so the three observations together are
what carry it, not the arithmetic alone.

`svelte-check` moves for the same reason and by the same one file: 419 → 418.

---

## 3. The correction — the production test count was 1623 and is 1633

**`PROGRESS.md` told this step that success meant `1623 / 418 / 175`. Two of the three were right.**
The removal produced `1633 / 418 / 175`, and the ten-test gap is not a defect in the removal: the
`1623` was stale.

The arithmetic, so a later session can check it rather than accept it:

```
1623  production at 2c-4b-3a          (PROGRESS.md, "Verification — Phase 2c-4b step 3a")
+ 1   src/probe.ts as a case in scripts/lint/ipc-detail.test.ts
= 1624 with the harness at 3b         (PROGRESS.md, "Verification — Phase 2c-4b step 3b")
+ 10  committed cases added by 3d-1   (PROGRESS.md, "Verification — Phase 2c-4b step 3d-1")
= 1634 with the harness at 3d-1, 3d-2a and 3d-2b
- 1   the probe case, removed by this step
= 1633 production at 3d-3
```

**Both ends of it were verified against artifacts, not read off the record:**

- `scripts/lint/ipc-detail.test.ts:34,49,72` lists every `.ts` and `.svelte` file under `src/` and
  makes each one a case, so an added source file is an added test. That is why the harness moved the
  count by exactly one.
- `a2069db` — the 3d-1 commit — changed **ten** test files (`notices`, `reapply`, `saveOutcome`,
  `MatchCreator`, `MatchDeleter`, `MatchDuplicator`, `MatchEditor`, `MatchMover`, `RawEditor`,
  `reveal`), 348 insertions against 50 deletions, and its own commit message records `npm test 1634`
  with the harness in the tree.

**A ten-file stat is not ten cases, and the first version of this section treated it as one.** Ten
changed files and a commit message are *consistent with* a net +10 and do not enumerate it —
additions and removals could net to any figure. The cases were therefore counted over
`git show a2069db -- 'src/**/*.test.ts'`:

```
34   added   ^+  it( / test(
24   removed ^-  it( / test(
= +10 net, which is exactly the gate delta 1624 → 1634
```

**The condition that makes a line count a case count is checked, not assumed**: `rg -c '^[-+].*\.each'`
over the same diff finds **nothing**, so no `it.each` or `describe.each` block was added or removed on
either side, and no line hides more than one registered case. Both counts are stated so a later
session can re-run them rather than accept them.

**Why it went unnoticed for three steps.** 3d-1 added its ten cases while the harness was in the tree,
so every gate reading from 3d-1 onward was a *with-harness* number, and *with-harness* numbers were
correct in all three records. The **production** figure was never re-derived after 3d-1; it was copied
forward verbatim by 3d-1's own "Next action", then by 3d-2a's, then by 3d-2b's. Nothing could fail for
it, because a production number is only observable on a tree with no harness in it — and there was no
such tree between 3d-2a and this step.

**This is this project's named worst defect class** — a record stating a figure the code does not
give. It is **not** an instance of the narrowing pattern 3d's review rounds kept producing: no round
had closed anything nearby, and nothing here was made wrong by a previous fix. It is a number that was
right when written and was never re-derived after the tree moved under it. It was caught here only
because 3d-3's success criterion forced the record and the tree to be compared. The `418` and the `175` survived because 3d-1 added
no file under `src/` and no source module: it added cases inside test files that already existed.

**The first version of this section said the stale statements "are corrected in place" while all four
still read `1623`** — a record claiming work that had not been done, inside the very section correcting
a record that claimed a figure the code did not give. Codex's round-1 High. It was closed by **doing
the work rather than rewording the sentence**, and these are the four sites, all now carrying the
correction:

| Site | What it said | What was done |
|---|---|---|
| Status table, the 3d-3 row | *"the return to the production gate numbers (1623 / 418 / 175)"* | Rewritten: the row now states `1633 / 418 / 175` and names the correction |
| "Verification — Phase 2c-4b step 3d-2a" | *"The production numbers remain 1623 / 418 / 175"* | Block-quoted correction **beside** the original, not replacing it |
| "Verification — Phase 2c-4b step 3d-2b" | the identical sentence | The same treatment |
| "Next action" | `1623` as 3d-3's success criterion | Superseded by the 2c-4c checkpoint, which states `1633` and says *do not "restore" 1623* |

Each is **annotated rather than silently edited**, the way 3d-2a annotated `BLOCK_TEXT_LIMIT`: a
record of what was believed, kept, with the correction next to it.

**The sweep then found two more, and that is the pattern this project predicts.** The rule is *sweep
for what the tree now says, not for the words the finding used* — so after fixing the four sites the
review named, every occurrence of `1623` in `PROGRESS.md` was re-read. Two more stale instances were
standing, both inside **superseded "Next action" blocks** kept for their work lists: 3d-2a's and
3d-2b's *"if it does not, they are the production ones (1623 / 418 / 175)"*. Both were written after
3d-1 committed its ten cases, so both were stale on the day they were written. Both now carry an
inline `[3d-3: … it is 1633]` annotation. **Six sites, not four.**

The remaining occurrences of `1623` were checked and **left exactly as they are, because each is
accurate history**: the 3a verification section records 1623 as what `npm test` printed at 3a, the 3b
section records `1624 = 1623 + 1`, and the 3a-era and 3c-era checkpoints quote it from before 3d-1
existed. **A figure that was true when written is not a defect**, and rewriting those would destroy
the arithmetic §3 depends on.

---

## 4. What the removal costs, and what it does not close

### 4.1 The five holes survive, and they were never 3d-3's to close

They are 3d-2a §6.7's holes, carried into the 3d-2b reading's §14 and restated as bounds in its §15
item 10. A **hole** has no case row in `launch.sh` and no arm in `runPlan`, so nothing could be
launched for it; it costs a fixture or a plan function *before* there is anything to launch. None is
an obligation of `2c-4b-3d-1-notes.md` §7.

- **Hole 1 — `browser.notice.gone`'s second producer**: `repairSelection`'s `clearSelection` arm,
  `src/lib/browser/selection.ts:292`. The reading drew that sentence from `reresolve`'s **length** arm
  only (P43 en, P44 es).
- **Holes 2–5 — the confirmed-reload transition on the creator, the deleter, the mover and the
  duplicator.** The transition exists on all five match surfaces and had a case on **one**, the editor.

### 4.2 The price of the removal, stated plainly

**Each of the five now costs an instrument rebuild as well as its missing fixture or plan arm.** What
a first new launch actually needs is the *inputs*: the two probe sources, the four hook lines,
`launch.sh`, the driver's case table and the fixtures that case requires — reconstructed from
`2c-4b-3d-2a-instrument-rebuild.md`, which was written to make exactly that possible and carries the
fixtures' content rather than only their descriptions. **It does not need `launches/P01…P75/`**: those
75 directories are retained *output*, and the earlier draft of this section wrongly folded them into
the reconstruction by saying "the whole scratch tree".

For the same reason **3.0 GB is not the reconstruction footprint.** It is what the tree had grown to
after 75 launches, because `launch.sh` assembles a fresh `.app` bundle per launch and every launch
keeps its own; a rebuilt harness starts near zero and grows at that rate.

**That is the accepted trade, and it is the same one 2c-4a-3c-5 took**: the harness costs GBs of
scratch that grow per launch, four hook lines in two production files and a shifted gate baseline for
as long as it stays, against five gaps that are not §7 obligations.

**What the precedent demonstrates is feasibility, and only that.** 2c-4a-3c-5 deleted a harness and
3d-2a rebuilt one from its record, so a rebuild is known to be achievable rather than hoped about —
but **no duration, effort or storage requirement for a future rebuild was measured**, and this record
does not claim one. Calling that cost "measured" was an overclaim in the first version of this
section.

### 4.3 The bound the reading kept, which the removal does not change

**The fixture shape was the easy one** — plain `replace:` scalars, double-quoted triggers, LF, no BOM,
no block scalars, no item-owned comments, no read-only file. **None of the fifteen corpus fixtures
`CLAUDE.md` §4 lists has ever been through this harness, and the owner's real configuration has never
been opened by it.** Deleting the harness neither widens nor narrows that; it is restated here so the
bound is not lost with the instrument that carried it.

---

## 5. What this step did not do

- **It wrote no user file and ran no launch.** There is nothing to read: no component changed.
- **It changed no tracked source file**, so no window reading and no mounted test is owed. The
  standing rule — a reading is re-taken after any change to a component — is not engaged, because the
  tracked files at the end of this step are byte-identical **to `HEAD`**, and therefore to the
  pre-harness versions every existing reading was taken against. **They are not byte-identical to what
  those files held at the step's start**: at the start they carried the four uncommitted hook lines,
  which is precisely what this step removed. The first version of this section conflated the two, and
  the distinction is the whole reason the rule is discharged — no *component* changed, and the two
  files that did change went back to what they had already been read against.
- **It did not touch `.gitignore`, the corpus, or any real-config path.** No real-config path appears
  in `git status --short --untracked-files=all`, which returns nothing at all.
