# 2c-4c step 6 — the harness's removal, and a production baseline that matched

**Status: complete.** This step exists so an instrument does not become production code. It produces
no product evidence: it changes no tracked source file, adds no behaviour, and closes no hole. What
it produces is a **clean tree** and **four gate figures measured on it**.

It is the twin of `2c-4b-3d-3`, which did the same job for the 2c-4b harness, and it follows that
step's pair — a record here and a Codex review in `docs/reviews/phase-2c-4c-6.md`.

One thing differs from 3d-3 and is worth naming first, because it is the only interesting fact in
the step: **3d-3 found the production test count stale and had to correct it. This step found all
four figures exactly as predicted.** The prediction was written into `PROGRESS.md`'s "Next action"
before the measurement, and the measurement matched it. That is a weaker result than 3d-3's — a
matching measurement proves less than a correcting one — and §3.3 states what it does and does not
establish.

---

## 1. What was removed, and by which method

### 1.1 The repo-side half — two untracked sources and four hook lines

Four paths were in the working tree when the step began, and `git status --short
--untracked-files=all` named exactly them and nothing else:

```
 M src-tauri/src/main.rs
 M src/main.ts
?? src-tauri/src/probe.rs
?? src/probe.ts
```

**The two probe sources are untracked**, so deleting them leaves no diff. The evidence for their
removal is therefore the empty status at §1.3, not a patch — there is nothing for a patch to show.

**The four hook lines were read before anything was deleted**, by running
`git diff src/main.ts src-tauri/src/main.rs` first, exactly as the handoff instructed and for the
reason it gave: after the probe sources are gone, the hook lines cannot be reconstructed from them.
The diff read, in full:

- `src-tauri/src/main.rs` — an added `mod probe;` declaration between `mod menu_contract;` and
  `#[cfg(test)] mod rust_source;`, and in `main()` the line
  `probe::register_with_probe(tauri::Builder::default())` where `register(tauri::Builder::default())`
  stands at `HEAD`;
- `src/main.ts` — an added `import { startProbe } from './probe';` after the `locale` import and
  before `import './app.css';`, and a trailing `startProbe();` preceded by one blank line, after the
  `export default bootstrap(...)` line.

Each of the four was reverted **by hand**, as four targeted edits rather than a `git restore`, and
the revert was then **proved rather than asserted**:

```sh
git diff src/main.ts src-tauri/src/main.rs    # empty
```

**That command alone is not the whole proof, and an earlier draft of this record said it was.** A
bare `git diff` compares the working tree with the **index**, not with `HEAD`, so an empty result
would also be consistent with a difference that had been staged. Two retained facts close that gap:
the initial short status printed ` M` for both paths — a **blank index column**, so nothing was
staged — and §1.4's `git diff HEAD --stat`, which compares against `HEAD` directly with the index
included, is **also empty**. Together those give byte-identity with `HEAD`'s blobs rather than
similarity.

### 1.2 The scratch half — 2.9 GB

`/private/tmp/espansoconfig-harness-2c-4c/` was measured at **2.9 GB** by `du -sh` immediately
before deletion, which is the figure `PROGRESS.md` recorded at the end of 5b-3. **That size is the
only property of the tree step 6 itself measured** — it was not listed, inventoried or verified
before the `rm -rf`. Earlier step records describe its contents as the launch directories **P01–P73**
with the fixtures and the manifests, accumulated across 4a (P01–P12), 4b (P13–P26), 5 (P27–P53),
5b-1 (P54–P61) and 5b-2 (P62–P73); this record repeats that description on their authority and adds
no evidence of its own for what remained there at deletion time.

It was removed with `rm -rf`, and its absence confirmed by `ls` returning
*No such file or directory*. A shell glob for `/private/tmp/espansoconfig*` then found **no
match at all**, so no sibling scratch tree from an earlier harness generation survives either.

### 1.3 The bound on that — no manifest was verified before the deletion

**This step verified no manifest before deleting the tree it describes**, and that is a deliberate
choice the handoff made rather than an omission here: `PROGRESS.md`'s "What must NOT happen in step
6" forbids regenerating `manifest-2c-4c-4a-post.sha256`, because 5b-3's §1.3 states its 54-OK /
1-FAILED comparison as a **current** result and a regeneration would replace that result with a new
one taken under different conditions.

So the honest consequence, stated plainly: **every artifact P01–P73 is gone and cannot be
re-examined.** Any claim in `2c-4c-4a-instrument-rebuild.md`, `2c-4c-4b-instrument.md`,
`2c-4c-5-window-reading.md`, `2c-4c-5b-1-instrument.md` or `2c-4c-5b-2-notes.md` that rested on a
launch directory now rests on **the record of that launch alone**. Those records were written and
reviewed while the artifacts existed — step 5's record took **three** Codex rounds in all, of which
5b-3 took rounds 2 and 3, round 1 being the one that judged the record as first written and forced
the 5b fix round — but from this commit forward they are testimony, not evidence that can be
re-derived. This is the standing price of every harness removal in this project and it was paid
knowingly at 2c-4a-3c-5 and 2c-4b-3d-3 before it.

The same applies to the two deleted sources, and here this record cites rather than re-derives.
`PROGRESS.md`'s 2c-4c-4a row states that `src-tauri/src/probe.rs` was **authored from the code** at
that step because *no record carries its source*, and that `src/probe.ts` was re-authored from four
construction records — records that **describe** the harness rather than reproduce it. A search of
`docs/` for the probe's own identifiers finds them in **19** files, this record among them, naming
functions in prose. (An earlier draft of this paragraph said *ten*, because the count had been taken
through a `| head` that capped it at ten lines — the fix round's own narrower instance, found by the
sweep that followed it.) **This step did not audit every document to prove no fragment of either file survives
anywhere**, and does not claim to have; what it relies on is the prior finding that the sources were
not recoverable from the records even when a step needed them badly enough to rebuild both from
scratch. A future harness will be rebuilt from prose again, as 4a rebuilt this one.

### 1.4 The residue sweep, and why the strong form of it is a git fact

A targeted search for the four harness identifiers —

```sh
rg -n "ECFG_PROBE|startProbe|register_with_probe|probe::|from './probe'" \
   --glob '!docs/**' --glob '!PROGRESS.md' .
```

— returns **nothing**.

A broader case-insensitive search for the bare word `probe` over the sources returns twenty files,
and **every one of them is ordinary English prose that `HEAD` already contained** — `discovery.rs`
probing standard paths, `recovery.test.ts` probing an export list, and so on.

That last claim does not need the reader to trust a hand inspection, because a git fact carries most
of it:

```sh
git diff HEAD --stat                        # empty — every tracked file, index included
git status --short --untracked-files=all    # empty — nothing modified, nothing untracked
```

**Every tracked file matches `HEAD`, and no non-ignored untracked path remains.** `HEAD` never held
the harness, so every surviving occurrence of the word in a tracked file is committed history by
construction.

**That proof has a boundary, and naming it is the point of this paragraph.** It covers tracked files
and non-ignored untracked ones; it says nothing about **ignored** paths, and this repository has
several — `dist/`, `target/` and `node_modules/`. The greps have the *same* blind spot, because
ripgrep honours `.gitignore` by default, so they are not a supplement that covers it. What closes it
for `dist/` specifically is that §2's build **empties and regenerates** it from the tracked sources
— `vite.config.ts:45` sets `emptyOutDir: true`, and `dist/assets/` afterwards holds exactly one
`.js` and one `.css`, with no stale sibling — and the status above was re-run **after** that build.
`target/` and `node_modules/` are rebuilt artifacts of the same kind, and neither was inspected. So:
the greps and the git facts agree, they check overlapping ground, and neither inspects an ignored
directory.

---

## 2. The gates, re-derived on the harness-free tree

`CLAUDE.md` §4 states the rule this section exists to obey: **a count only a harness-free tree can
produce must be re-derived on such a tree, never copied forward.** Every figure recorded during 4a,
4b, 5, 5b-1, 5b-2 and 5b-3 is a **with-harness** figure, because the probe sources and the two hook
lines were in the tree for all of them.

| Gate | With harness (5b-2's run) | **Measured here** | Expected |
|---|---|---|---|
| `cargo test --workspace` | 1112 passed, 0 failed | **1112 passed, 0 failed** | 1112 |
| `npm run check` | 424 files, 0 errors, 0 warnings | **423 files, 0 errors, 0 warnings** | 423 |
| `npm test` | 1768 passed, 51 files | **1767 passed, 51 files** | 1767 |
| `npm run build` | 181 modules | **180 modules** | 180 |

**All four match. Nothing was adjusted to make them match** — the expectation was already written
into `PROGRESS.md` before the measurement, and had a figure differed the handoff required recording
the measurement and investigating, never editing the number.

The three moving figures each moved by exactly one, and each has a cause:

- `npm run check` 424 → **423**: `src/probe.ts` was one of the files svelte-check type-checked.
- `npm test` 1768 → **1767**: traced to a specific case rather than assumed.
  `scripts/lint/ipc-detail.test.ts:79` runs `it.each(scannableFiles().filter(...))`, generating one
  case per `.ts` or `.svelte` file under `src/` that is not on its two-entry allow-list. There are
  now **104** such files, so that block generates **102** cases and the suite totals **118**
  (measured with `--reporter=json`). With `src/probe.ts` present there were 105 files, 103 generated
  cases and 119 — which is the whole of the difference.
- `npm run build` 181 → **180**: `src/probe.ts` was reachable from the entry through
  `src/main.ts`'s `import { startProbe } from './probe';`, so it was one transformed module.
- `cargo test` is **unchanged at 1112**, and this record deliberately offers no explanation of why.
  The two probe sources were deleted **without being read** (§1.1), and §1.3 records that their text
  survives in no record in this repository — so a claim about what `src-tauri/src/probe.rs`
  contained, such as that it declared no `#[cfg(test)]` module of its own, would be an inference
  from the very count it was being used to explain. An earlier draft of this record made exactly
  that claim. What is retained is the observation: **the Rust count was 1112 with the harness in the
  tree and is 1112 without it.**

The Rust figure was derived by summing the `N passed` field of every `test result:` line in the run
— **25 such lines**, including the `Doc-tests espansoconfig_core` binary — which totals **1112**.
No line reports a non-zero `ignored`, and a search of the whole output for `failures:`, `FAILED`,
`error[` and `warning:` finds **nothing**. The command exited **0**.

### 2.1 The module guard, both halves

`CLAUDE.md` §4 records why the old shorthand is spent: **180 is now within one of a legitimate
count**, so the number alone decides nothing. Both halves were run.

**The arithmetic.** 180 is the ladder's current rung — 178 at 2c-4c-3a, then 180 at 2c-4c-3b, which
moved by two for one new styled component (`RecoveryWithoutCreation.svelte`: one for the module, one
for its `<style>` block). Step 6 adds no source module and removes one that was never production, so
180 is exactly where a harness-free tree should sit.

**The bundle search**, which is the half that actually discriminates:

```sh
rg -c "svelte/internal/server|svelte/server|async_hooks" dist/assets/*.js   # nothing
```

None of the three appears in the built bundle.

**That negative was checked for falsifiability rather than accepted**, because a search that cannot
match proves nothing about what it did not find. `rg --count-matches "svelte"` over the same file,
`dist/assets/index-B6rOXX_o.js`, returns **495**. The pattern engine reaches the file and matches
inside it; the three server markers are genuinely absent.

---

## 3. What this step does and does not establish

### 3.1 It changes no tracked source file, so no reading and no mounted test is owed

The only edits were to `src/main.ts` and `src-tauri/src/main.rs`, and both were **returns to what
`HEAD` already holds** — proved by the empty `git diff` at §1.1. Nothing a person can see changed,
so this project's standing rule that *a window reading is re-taken after any change to a component*
is not triggered, and neither is the mounted-test obligation. This is the same disposition
2c-4b-3d-3 recorded, for the same reason.

The last change to a tracked source file in this phase remains 5b-2's single deleted CSS
declaration in `src/lib/components/RecoveryPanel.svelte`, committed at `c23b39e` and read in a
window across twelve launches (P62–P73).

### 3.2 It closes no hole 2c-4c left open

The removal is not a fix. The bounds `2c-4c-5-window-reading.md` §8 records survive it unchanged,
and so does the standing one 2c-4b-3d-2b stated and no step since has discharged: **the fixture
shape the harness drives is the easy one, none of the fifteen corpus fixtures `CLAUDE.md` §4 lists
has been through it, and the owner's real configuration has never been opened by it.**

Removing the instrument does not narrow those bounds and does not widen them. It ends the ability to
*re-measure* them without rebuilding, which §1.3 states.

### 3.3 A matching measurement proves less than a correcting one, and this record does not overstate it

3d-3's value was that it **caught** a stale figure: `1623` had stood in three consecutive step
records after 3d-1 committed ten cases behind a harness that made the production figure
unobservable. This step caught nothing, because there was nothing to catch.

What a matching measurement establishes is narrow, and it is this: **the four figures were produced
by running the four gates on the harness-free working tree this step created** — the tree §1.4
proves matches `HEAD` in every tracked file. It does **not** establish that the with-harness figures recorded during
4a, 4b, 5 and 5b were right about anything other than themselves, and it does not retroactively
validate any earlier record. Those records state with-harness figures and say so.

The prediction matching is worth exactly one sentence of confidence: the four-way delta between a
with-harness and a harness-free tree was understood well enough to be written down in advance and
then observed. That is a small result. It is stated here at its size.

---

## 4. What this step did not do

- It did **not** regenerate `manifest-2c-4c-4a-post.sha256`, or any manifest. §1.3.
- It did **not** reopen step 5. Its record and its three reviews are final, and no round 4 was
  commissioned — 5b-3's verification section carries that decision and its reason.
- It staged **by path**, never with `git commit -a` or `git commit -am`. `PROGRESS.md` forbade those
  two forms while any harness path was in the tree, and that is a prohibition rather than evidence of
  compliance — what the retained state proves is narrower and sufficient: **no harness path remains
  in the tree and none was committed**, which the empty `git status --short --untracked-files=all`
  and the commit's own file list together establish. By the time of the commit the tree was clean of
  the harness anyway, so staging by path cost nothing.
- It did **not** touch `.gitignore`, the corpus, or the sync script, so `CLAUDE.md` §1's
  post-touch verification is not owed.
- It changed **no dictionary key**, so the i18n parity suites carry the same load they did before.

---

## 5. The review round, and what closes with this step

**The Codex round this step owed was run, and it is `docs/reviews/phase-2c-4c-6.md`.** Round 1
returned **NOT READY** on nine findings — three High, five Medium, one Low — and **every one of the
nine was a sentence in this record**, not a defect in the removal or in the application. Three are
worth naming because they are this project's named worst defect class in its purest form, appearing
in a step that does nothing:

- §1.1 offered a bare `git diff` as *the whole of the proof* of byte-identity with `HEAD`, when that
  command compares the working tree with the **index**;
- §2 explained the unchanged Rust count by asserting what `src-tauri/src/probe.rs` contained — a
  file this step deleted **without reading**, so the explanation was an inference from the count it
  claimed to explain;
- §5 declared the phase complete and predicted that no finding in any step-6 round would change a
  byte written to a user's file, **before the round had been run**.

The other six narrowed unretained claims: an inventory of a directory only measured, a chronology
that gave 5b-3 three rounds when it took two, two wrong filenames, a git proof stated more broadly
than ignored paths allow, and a process assertion no artifact could support. **No executable line
changed in the fix round**, because this step has no executable line to change (§3.1).

**The sweep that followed the fix round found a tenth, created by the fix round itself**, and it is
recorded in place at §1.3 rather than quietly corrected: a file count introduced while closing
finding 5 was taken through a `| head` that capped it at ten, and the true figure is 19. That is
the thirteenth consecutive round in this phase to find a narrower instance of what the round before
it closed, and the third in a row where the fix round created the instance rather than missing it.
It was found by re-deriving the two figures the fix round had newly introduced, which is the only
technique that has worked: **check what the record now says, never the words the finding used.**

**What closes.** `PROGRESS.md`'s handoff prescribes that the commit carrying this record, that
review and the checkpoint is the one that closes Phase 2c-4c. Six steps: the Rust contract (1),
recovery as values (2), the UI in two
halves (3a, 3b), the instrument in two halves (4a, 4b), the reading with its three-part fix round
(5, 5b-1, 5b-2, 5b-3), and this removal (6).

The phase's one defect that reached a screen was **M2**, found at 5b-1 and fixed at 5b-2 by deleting
`min-height: 0` from `.recovery`. It is the first defect in this phase to change a tracked source
file, and — measured across 27 launches that passed over it — a reminder that a driver pressing with
`HTMLElement.click()` bypasses hit testing, so a programmatic press succeeds against a control a
pointer could not have reached.

**Step 6 writes nothing to a user's file — it contains no code path that could — and none of round
1's nine findings touched an executable line.**
