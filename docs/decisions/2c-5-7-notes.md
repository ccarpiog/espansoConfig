# 2c-5 step 7 — the instrument's removal, and the harness-free baseline re-derived

**Status: the removal is done and every gate passed on the harness-free tree.** This step exists so
an instrument does not become production code (design Q7 item 7,
`docs/reviews/phase-2c-5-design.md`). It produces no product evidence: it changes no tracked source
file, adds no behaviour, and closes no hole. What it produces is a **clean tree** and **the gate
figures measured on it** — which, per `PROGRESS.md`'s handoff, become the only baseline once the
with-harness one ceases to exist with this step.

It is the twin of `2c-4c-6-notes.md`, which did the same job for the 2c-4c harness, and it follows
that record's method. One thing differs from the precedent and is named first because it is this
step's only novelty: **2c-4c-6 verified no manifest before deleting the tree it described; this step
was instructed to verify one, and did** — §1.1 is that verification, and the manifest's own digest
is what survives the deletion.

All dates are 2026-08-24.

---

## 1. What was removed, and by which method

### 1.1 The manifest verification, before anything was deleted

Inside `/private/tmp/espansoconfig-harness-2c-5/`, before any deletion:

```sh
shasum -a 256 -c manifest-2c-5-6b-reading.sha256
```

exited **0** and printed **92 lines, every one ending `: OK`** — 92/92, exactly the figure 6b's
closure recorded when the manifest was written (`PROGRESS.md`, "Verification — Phase 2c-5 step
6b"). The final post-image of the five scripts, the thirteen fixtures, both probe sources and the
`probe.log` + `bytes.txt` of every 6b launch P63–P98 was therefore **intact at the moment of
deletion**, not assumed intact from the closure's earlier run.

The manifest file itself was then hashed, because it was about to be deleted with the tree and its
digest is what survives:

```
1877219badd541292cc2369120cd9983c97ab51c25fd88844b3a79e4f1cea769  manifest-2c-5-6b-reading.sha256
```

The other four manifests were hashed the same way — none was verified, none regenerated; the digests
are recorded only because the files are gone:

```
4b771bd0cd06726fa1dbbb7f8f307114cd923f25bc2f57a8c0c16dba71a3da44  manifest-2c-5-5b-rebuild.sha256
3db3ac0a5321401bc52145e037d2d1836a02eb11c02f552eb9a75eb30457c80b  manifest-2c-5-5b-cases.sha256
e846aa30aeed2a789d97ad75db37e487426b4eeedc4a9f8014f439dcc7959650  manifest-2c-5-6a-cases.sha256
2098aedb99931fd3b6bb75bb405fc2b4d012cc98a3e243a514d2da8ccfe1ab9a  manifest-2c-5-6a-fix.sha256
```

**What the verification does and does not establish.** It establishes that the 92 files the 6b
manifest names held, at deletion time, the bytes the closure hashed. It says nothing about any file
the manifest does not name — the earlier manifests' known-failing entries (6a §8, §10.1; the fix
round's edits, kept as the record of what changed) were not re-checked, and their failing sets are
now unreadable; the four digests above are all that can ever be said of them again.

### 1.2 The repo-side half — two reverted hook files and two deleted sources

Four paths were in the working tree when the step began, and `git status --short
--untracked-files=all` named exactly them and nothing else:

```
 M src-tauri/src/main.rs
 M src/main.ts
?? src-tauri/src/probe.rs
?? src/probe.ts
```

The index column of both ` M` lines is **blank** — nothing was staged. `git diff --stat` over the
two hook files read **5 insertions, 1 deletion**, the figure every 2c-5 record since 5a §2.1 has
carried, and the diff was **read in full before anything was deleted**, because after the probe
sources are gone the hook lines cannot be reconstructed from them:

- `src-tauri/src/main.rs` — an added `mod probe;` between `mod menu_contract;` and
  `#[cfg(test)] mod rust_source;`, and in `main()` the line
  `probe::register_with_probe(tauri::Builder::default())` where
  `register(tauri::Builder::default())` stands at `HEAD`;
- `src/main.ts` — an added `import { startProbe } from './probe';` after the `locale` import and
  before `import './app.css';`, and a trailing `startProbe();` preceded by one blank line, after
  the `export default bootstrap(...)` line.

The two tracked files were reverted with the **one git command this step ran**:

```sh
git restore --source=HEAD -- src/main.ts src-tauri/src/main.rs
```

— a by-path restore, never a blanket checkout, and a deliberate difference from the precedent,
which reverted its four lines by hand; the handoff prescribed the command and the proof below makes
the two methods equivalent in what they leave. The two untracked probe sources were then deleted
with `rm src/probe.ts src-tauri/src/probe.rs`. **The probe sources are untracked, so deleting them
leaves no diff**; the evidence for their removal is the empty status at §1.5, not a patch.

The revert was proved rather than asserted, and by the pair of facts the precedent's own review
demanded (a bare `git diff` compares against the index, not `HEAD`): the initial status's blank
index column shows nothing was staged, and `git diff HEAD --stat` — which compares against `HEAD`
with the index included — is **empty**. Together those give byte-identity with `HEAD`'s blobs, and
both were re-run after the builds of §2 with the same result.

### 1.3 The scratch tree — 2.3 GB, inventoried and then deleted

`/private/tmp/espansoconfig-harness-2c-5/` was measured at **2.3 GB** by `du -sh` immediately
before deletion. Unlike the precedent, its top level was **listed before the `rm -rf`**, and the
listing agrees with what the records accumulate:

- the five scripts — `launch.sh`, `inert.sh`, `confine.sh`, `adversary.sh`, `byte-fixtures.sh`;
- `fixtures/` holding **13** files (the 6b manifest's thirteen);
- `launches/` holding **57** entries — `C11`–`C15`, `C14-plant`, `N09`, and `P49`–`P98` — which is
  5b's rebuilt generation (P49–P53, N09, C11–C15 and the plant), 6a's P54–P62, 6b's P63–P86, and
  the twelve re-takes P87–P98 that `2c-5-6-window-reading.md` §13.14 says the tree gained;
- the five manifests of §1.1.

The per-launch `.app` bundles live **inside** their launch directories (`$LAUNCH/espansoConfig.app`,
5a §3's recipe), so no scratch bundle exists outside the tree to be deleted separately. The tree
was removed with `rm -rf`, its absence confirmed by `ls` returning *No such file or directory*, and
a shell glob for `/private/tmp/espansoconfig*` then found **no match at all** — no sibling scratch
tree, no stray bundle, and no decoy survives under that prefix.

### 1.4 The decoys and the planted symlink artifacts

The deletion list outside the tree is exactly what the records name, and the records were followed
rather than a glob trusted first — the glob came after, as confirmation:

- **The four decoys** — `/private/tmp/espansoconfig-probe-decoy-C11.yml` through `…-C14.yml`
  (`2c-5-5b-instrument-cases.md` §2 item 8; restated by 6a §8). All four were listed before
  deletion — four regular files of 50 bytes each — and deleted by exact path. 5b's nine-decoy
  predecessor list (5a §1's C01–C09) was already gone before 5b began, which 5b §1 records; the
  start-of-step glob here matched only the four.
- **The two symlink artifacts of 5b §2 item 8** —
  `launches/C13/xdg/espanso/match/conflict.yml.probe-tmp-adversary-C13` and
  `launches/C14-plant/xdg/espanso/match/conflict.yml` — were confirmed before deletion to still be
  links pointing at their decoys, and went with the tree.
- **The three in-tree symlinks of 6a §8** — P54's and P55's
  `xdg/espanso/.espansoconfig-backups/2026-08-18T090000Z` (the former pointing at its unmarked
  sibling, the latter at the recognised batch's marker), each mirrored in that launch's
  `xdg-before/` copy — were confirmed present before deletion and went with the tree, exactly as
  6a §8 said they would.

`2c-5-6-window-reading.md` §11.9 and §13.14 both state the deletion list was **not lengthened** by
the fix round or the re-takes — no new decoy, no outside-tree file, no new symlink — and the
post-deletion glob finding nothing is this step's agreement with that.

### 1.5 The residue sweep, and why the strong form of it is a git fact

A targeted search for the harness identifiers —

```sh
rg -n "ECFG_PROBE|startProbe|register_with_probe|probe::|from './probe'" \
   --glob '!docs/**' --glob '!PROGRESS.md' .
```

— returns **nothing**. A broader case-insensitive search for the bare word `probe` over the same
ground returns **29 files**, and every one of them is committed history by construction, because of
the git facts below — `discovery.rs` probing standard paths, `recovery.test.ts` probing an export
list, and their kin. (The round-1 review measured this count and corrected it from a recorded 30;
the correction is the review's, re-measured before being written here.) The documents excluded from
the targeted search name the identifiers legitimately, in prose: `rg -l` over `docs/` and
`PROGRESS.md` found them in **29 files** at the pre-record reading — a count taken without a
`| head`, which is the precedent's own recorded scar — and finds **30** once this record exists,
because §1.5's own quoted pattern is a thirtieth naming.

The git facts, both re-run **after** §2's builds:

```sh
git diff HEAD --stat                        # empty — every tracked file, index included
git status --short --untracked-files=all    # empty — nothing modified, nothing untracked
```

**Every tracked file matches `HEAD`, and no non-ignored untracked path remained** at that reading
(this record, written afterwards, is now the one untracked path). `HEAD` never held the harness, so
every surviving occurrence of the word in a tracked file is committed history by construction.

**That proof has the boundary the precedent named, and it is the same one here.** It covers tracked
files and non-ignored untracked ones; it says nothing about **ignored** paths — `dist/`, `target/`,
`node_modules/` — and the greps share the blind spot because ripgrep honours `.gitignore`. What
closes it for `dist/` is that §2's build **empties and regenerates** it from the tracked sources
(`emptyOutDir: true`), and `dist/assets/` afterwards holds exactly one `.js` and one `.css` with no
stale sibling. `target/` and `node_modules/` are rebuilt artifacts of the same kind and were not
inspected.

### 1.6 The bound — what was deleted cannot be re-examined

Every artifact of the rebuilt tree — the launches P49–P98, N09, C11–C15, the plant, the scripts,
the fixtures, the five manifests — is gone. Every claim in `2c-5-5b-instrument-cases.md`,
`2c-5-6a-instrument-extension.md` and `2c-5-6-window-reading.md` that rested on a launch directory
now rests on **the record of that launch alone**. Those records were written and reviewed while the
artifacts existed — 5b's round READY with no findings, 6a's two rounds, 6b's two rounds ending
READY — but from this commit forward they are testimony, not evidence that can be re-derived. This
is the standing price of every harness removal in this project, paid knowingly at 2c-4a-3c-5,
2c-4b-3d-3 and 2c-4c-6 before it. What this step adds over the precedent is §1.1: the deletion was
taken over a tree whose 92 manifest-named files verified intact seconds earlier, and the manifest's
digest outlives it.

The two deleted sources carry the same bound. They were deleted **without being read** — the hook
diff of §1.2 was read; `src/probe.ts` and `src-tauri/src/probe.rs` were not — and the prior finding
stands that no record reproduces either file: 5a rebuilt both from prose because nothing else could.
A future harness will be rebuilt from prose again.

---

## 2. The gates, re-derived on the harness-free tree

`CLAUDE.md` §4 states the rule this section obeys: **a count only a harness-free tree can produce
must be re-derived on such a tree, never copied forward** — the scar is `1623`, a count once copied
through three step records. Every figure recorded during 5a, 5b, 6a and 6b is a **with-harness**
figure, because the probe sources and the four hook lines were in the tree for all of them. The
with-harness baseline retires with this step.

| Gate | With harness (6b's baseline) | **Measured here** | Expected |
|---|---|---|---|
| `cargo test --workspace` | 1153 passed, 0 failed | **1153 passed, 0 failed** | 1153 |
| `npm run check` | 432 files, 0 errors, 0 warnings | **431 files, 0 errors, 0 warnings** | 431 |
| `npm test` | 2126 passed, 56 files | **2125 passed, 56 files** | ~2125 |
| `npm run build` | 185 modules | **184 modules** | 184 |

**All four match the handoff's expectation. Nothing was adjusted to make them match** — the
expectation `1153 / 431 / <re-derive> / 184` was written into `PROGRESS.md` before the measurement,
with the npm-test figure deliberately left to the run itself.

Beside the four: `cargo clippy --workspace --all-targets -- -D warnings` finished **clean** (exit
0), `cargo fmt --check` printed **nothing** (exit 0), and the architecture rule holds —
`cargo tree -p espansoconfig-core | rg tauri` matches **nothing** (ripgrep exit 1, the no-match
exit), with the negative checked for falsifiability: the same pipe searched for `serde` matches
**5** lines, so the pattern engine reaches the tree and the absence is real.

The Rust figure was derived by summing the `N passed` field of every `test result:` line — **25
such lines**, the `Doc-tests espansoconfig_core` binary included — totalling **1153**, with no line
reporting a non-zero `failed` or `ignored`. The command exited 0, twice (the first full run and the
line-collection re-run).

The three moving figures each moved by exactly one, and each has a cause:

- `npm run check` 432 → **431**: `src/probe.ts` was one of the files svelte-check type-checked.
- `npm test` 2126 → **2125**: traced rather than assumed. `scripts/lint/ipc-detail.test.ts:79`
  runs `it.each(scannableFiles().filter(...))`, one case per `.ts`/`.svelte` file under `src/` not
  on its two-entry allow-list. There are now **112** such files, so the block generates **110**
  cases and the suite totals **126** (measured with `--reporter=json`). With `src/probe.ts` present
  there were 113 files, 111 generated cases and 127 — which is the whole of the difference.
- `npm run build` 185 → **184**: `src/probe.ts` was reachable from the entry through
  `src/main.ts`'s `import { startProbe } from './probe';`, so it was one transformed module.
- `cargo test` is **unchanged at 1153**, and this record deliberately offers no explanation of why,
  for the precedent's own reason: the probe sources were deleted without being read (§1.6), so any
  claim about what `src-tauri/src/probe.rs` did or did not declare would be an inference from the
  very count it was being used to explain. What is retained is the observation: **the Rust count
  was 1153 with the harness in the tree and is 1153 without it.**

### 2.1 The module guard, both halves

**The arithmetic.** The with-harness build was 185, being the production 184 plus `src/probe.ts` as
one module (5b §2 measured 185 on the same emitted bundle 5a's proof generation embedded). This
step removes that one module and adds none, so **184** is exactly where the harness-free tree
should sit — four above the harness-free 180 the precedent measured at 2c-4c-6, a climb that
accrued across 2c-5's own product steps and is recorded in their step records, none of it this
step's.

**The bundle search**, with the oracle `CLAUDE.md` §4 corrected to after the vacuous
literal-specifier search was measured empty in both directions — both lines read, the second
proving the search can match at all:

```sh
rg -c '\$\$payload|head_payload|push_element' dist/assets/index-DGAANul9.js   # no match — server-only tokens ABSENT
rg -c 'window\.__svelte|svelte-trusted-html' dist/assets/index-DGAANul9.js    # 2 — client-only tokens PRESENT
```

A further falsifiability control — `rg --count-matches "svelte"` over the same bundle — returns
**566**, so the engine reaches the file and the server-line absence is genuine.

---

## 3. What this step does and does not establish

### 3.1 It changes no tracked source file, so no reading and no mounted test is owed

The only edits to tracked files were the two `git restore` targets, and both are **returns to what
`HEAD` already holds** — proved by the empty `git diff HEAD --stat` at §1.5. Nothing a person can
see changed, so the standing rule that *a window reading is re-taken after any change to a
component* is not triggered, and neither is the mounted-test obligation. Design Q7 item 7 says the
same in advance: this step *adds no model, mounted, or window evidence*. This is the disposition
2c-4c-6 and 2c-4b-3d-3 recorded, for the same reason.

The last change to a tracked source file in this phase remains the 6b fix round's pair —
`src/lib/components/RestorePane.svelte` and `RestorePane.test.ts` — committed before the re-takes
and read in a window across P85–P98.

### 3.2 The four residual rebindings — inherited-open, and now deleted rather than closed

5a §8.1 names four holes in the external writers' confinement, all one shape — a name checked at
one instant and spent at another: the source's final component rebindable between check and read,
the temporary's name rebindable between `create_new` and `rename`, and an ancestor directory of
either the target's or the source's pathname replaceable with a symlink between check and use. 5b
inherited all four as open; its READY review left them "accepted, not proven, unwidened … and still
open for 2c-5-7 to **delete** rather than for any step to **close**" (5b §8). 6a and 6b carried
them unwidened (`src-tauri/src/probe.rs` untouched by either).

This step is that deletion, and the distinction is kept exact: **the code the four holes describe
no longer exists** — `probe.rs` is deleted from the working tree, and every binary compiled from it
went with the launch directories — but **deletion is not closure**. None of the four was ever
proven absent, no launch ever constructed one, and a future harness rebuilt from the records
inherits all four again, because 5a §8.1 is where they live now. They were accepted on grounds the
records name (an operator-controlled `/private/tmp` root, a binary never shipped, this step's
deletion) — none of which was a proof then, and none of which becomes one by the deletion
happening.

### 3.3 It closes no hole 2c-5 left open

The removal is not a fix. Every bound the phase's records state survives it unchanged — 6a §5's
unreached states with their §6 unreachability arguments, 6b §9's limits, the §11.8 half of the
conflict-moment covering that stays unmeasured — and so does the standing bound no 2c step has
discharged: the fixture shapes the harness drives are the easy ones, none of the fifteen corpus
fixtures has been through a window instrument, and the owner's real configuration has never been
opened by one. Removing the instrument does not narrow those bounds and does not widen them; it
ends the ability to re-measure them without rebuilding, which §1.6 states.

---

## 4. What this step did not do

- The step's rule was **one git command only** — the by-path `git restore` of §1.2; no `git add`,
  no commit, no stash, no blanket checkout — and that is stated here as the prescription the step
  ran under, not as proven history: no artifact records which commands were or were not run, and
  what IS observable is the result — every tracked file byte-identical to `HEAD` (§1.5's git
  facts) with the two hook files carrying `HEAD`'s content. The checkpoint commit is the
  orchestrator's, after the review. (The precedent's review rejected the proven-history form of
  this sentence, and round 1 of this step's review rejected it again here.)
- It did **not** regenerate any manifest. §1.1 is a *verification* of an existing manifest followed
  by its digest — a read, not a write.
- It did **not** reopen any 2c-5 step. 5b closed READY; 6a and 6b closed READY at round 2; their
  records and reviews are final.
- It did **not** touch `.gitignore`, the corpus, or the sync script, so `CLAUDE.md` §1's post-touch
  verification is not owed. The fifteen corpus fixtures were not opened.
- It changed **no dictionary key**, so the i18n parity suites carry the same load they did before.
- It deleted **nothing the records do not name**. The deletion list was assembled from 5b §2 item
  8, 6a §8, 6b §11.9 and §13.14 before the first `rm`, and the post-deletion glob is confirmation,
  not the source of the list.

---

## 5. The review round this step owes

Design Q7 item 7 assigns this step no model, mounted or window evidence; what it owes is this
record and the review of it. That round is commissioned by the orchestrator **after** this record,
and nothing here pre-empts its verdict — the precedent's round 1 found its own record declaring
completion before the round had run, and that sentence is deliberately not written here. What can
be said without it: this step contains no executable line of its own, wrote nothing to any user's
file, and left every tracked file byte-identical to `HEAD`, with this record as the only
non-ignored untracked path — a tree holding an untracked record is not byte-identical to `HEAD`,
and round 1 of this step's review found the sentence that claimed it was.
