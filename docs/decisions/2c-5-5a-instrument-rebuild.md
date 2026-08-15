# Phase 2c-5 step 5a — the window-reading instrument, rebuilt from the records

> **This record was revised seven times, by seven review fix rounds.**
> `docs/reviews/phase-2c-5-5a-instrument.md` returned **NOT READY on eight findings**; §9 names each
> one and how it was addressed. `docs/reviews/phase-2c-5-5a-instrument-round2.md` then returned **NOT
> READY on four more**; **§10** names each of those and how it was addressed.
> `docs/reviews/phase-2c-5-5a-instrument-round3.md` then returned **NOT READY on five more**; **§11**
> names each of those, and **four of the five are this record having claimed a guarantee the code does
> not give**. `docs/reviews/phase-2c-5-5a-instrument-round4.md` then returned **NOT READY on six
> more**; **§12** names each of those, and **four of the six are again a claim the code or the evidence
> does not license**. `docs/reviews/phase-2c-5-5a-instrument-round5.md` then returned **NOT READY on
> three more, all Low**; **§13** names each of those, and **all three are wording**.
> `docs/reviews/phase-2c-5-5a-instrument-round6.md` then returned **NOT READY on three more, again all
> Low and again all prose**; **§14** names each of those, and they are **three distinct shapes, not
> one** — an off-by-one review-file-to-round identity with a false fix lineage behind it (§14.1), this
> record gone stale against its own newest section (§14.2), and an exact count the changes did not
> license (§14.3). **§14.7 names two further instances of §14.2's shape alone**, which round 6 did not
> cite and the fix round's own sweep found. `docs/reviews/phase-2c-5-5a-instrument-round7.md` then
> returned **NOT READY on three more, all Low, all prose, and `Instrument defects: None.` for the second
> consecutive round**; **§15** names each of those, **§15.8 names three further instances its own sweep
> found — two of them in §14, the section written one round earlier to document that very mechanism** —
> and **§15.5 states the convergence question all this raises and deliberately does not decide it**.
> Rounds 1 and 2 changed
> `src-tauri/src/probe.rs`, so every launch taken before them ran a **different binary** and none can
> stand as evidence for the tree that ships; **rounds 3, 4 and 5 changed only doc comments and prose,
> rounds 6 and 7 changed only this record, and none of those five took a new launch**, so every launch
> named below is unmoved. **Two sets are named below and they are not the
> same size**: the **twelve plan-proof launches** are P37–P48, one per case of the case table, and the
> **nineteen-launch complete proof set** is those twelve plus N07/N08 (the no-plan controls), C05/C06
> (the static confinement controls) and C07, C09 and C10 (the adversarial ones round 2 asked for) —
> 12 + 2 + 2 + 3 = 19. Each fix round rewrote the sentences **it identified** as made false by its own
> fixes, and the round after it swept for the ones that round missed — **that is a sweep, not a
> guarantee**, and the weaker verb is load-bearing rather than modest. **A round has missed one every
> time**: round 6 found this very paragraph still claiming four fix rounds after §13 made it five, and
> round 7 then found the replacement's own first clause still asserting that the rewriting was complete.
> **No round of this step has yet identified every sentence its fixes falsified**, and this sentence
> claims only that each tried and the next one looked. Nothing that was an honest limitation has been
> deleted; §9.9 lists the one defect round 1
> found in its own work and deliberately did not close, and **§9.1, §10.1, §11.1, §12.1, §13.5, §14.5
> and §15.6 state
> plainly what is *not* closed** — **four** residual rebindings: the source's final component, the
> temporary's name after `create_new`, an ancestor directory of the target's pathname and an ancestor
> directory of the **source's**, all residual and unproven and **not one of them closed by any round
> from 3 to 7**.

Step 2c-5-6 is the bilingual window reading this phase owes, and 2c-5-5b adds the restore cases it
needs. **This step is neither**, and nothing here judges a screen. It rebuilds **both halves** of the
harness 2c-4c-6 deliberately deleted and shows, with twelve launches covering every one of this
application's six write surfaces, that **the retained executable those launches ran** reaches each of
them and produces the byte predicate its case table names — exactly as 2c-4c-4a proved its rebuild
before 4b extended it, 2c-4b-3d-2a proved its own before the 3d-2b reading, and 2c-4a-3c-1 provoked a
true `SaveResult::Conflict` before any reading depended on one.

**"The rebuilt whole runs" is one claim too many, and §6.4 is why.** No retained artifact binds any
executable here to a source snapshot or to a build command — no build transcript was kept, and
`launch.sh` copies whatever `ECFG_BINARY` names without checking a timestamp — so *this source tree
runs* is not available. What the bundles pin is **which bytes ran**: P37–P48 ran an executable whose
digest is `0a2d3506…`, and the retained bundles still carry those bytes. **That digest equalled
`target/debug/espansoconfig`'s when it was first read and does not now** — the **round-4** run of §7's
`cargo build -p espansoconfig --features custom-protocol` row rewrote that path; measured
at round 4, `target/debug/espansoconfig` is `04988c09…` (§5.10, §12.7). **Rounds 5 and 6 did not re-run
that row at all** (§13.6, §14.6), so nothing after round 4 has rewritten the path and the inequality
above is a claim about what round 4 measured, not about a rebuild each round performs. Source inspection separately
establishes that the plans are coherent. **Those two readings may not be conjoined into source
provenance.**

**Nothing here was recovered.** 2c-4c-6 removed the harness and the tree it lived in; both probe
sources are **authored from the application's current code**, as `2c-4c-4a-instrument-rebuild.md` §2
is the precedent for, and every fixture is **re-authored from the descriptions** in
`2c-4b-3b-instrument.md` §4 and `2c-4b-3c-1-notes.md` §2. `launch.sh` is re-authored from the recipe
`2c-4b-3b-instrument.md` §2 quotes and the checks its §8.9 and `2c-4b-3d-2a-instrument-rebuild.md` §5
describe.

**Byte-identity with any earlier tree's files is neither claimed nor established, and for two files it
is positively contradicted.** 3b §5 records R0 as `507e98f5…` and `elsewhere-r1.yml` as `31be59eb…`;
4a's tree printed `9246ae21…` and `04e4bef8…`; **this tree's are `a9990be6…` and `60a66198…`** (§4.2).
For every other rebuilt file there is no surviving original and no old digest, so byte-identity is not
established either way.

---

## 1. Where the tree is, and what happened to the old one

**The new scratch tree is `/private/tmp/espansoconfig-harness-2c-5/`**, outside the repository.
**Steps 5b, 6 and 7 all need that path.** It is a **new** path, not 2c-4c's: that one is gone, and a
shared path would read as a shared ledger.

```
/private/tmp/espansoconfig-harness-2c-5/
  launch.sh                          one launch: the case table, the seed, a fresh bundle, the wait, the byte checks
  inert.sh                           one launch with no plan at all — the no-plan control of §4.3
  confine.sh                         one launch whose writer is pointed OUTSIDE the tree — §4.4
  adversary.sh                       one launch that plants a symlink where the writer is about to act — §4.5
  fixtures/                          9 files — 1 R0, 2 R1 documents, 1 R2 document, 5 authored expected-bytes documents
  launches/P01…P48, N01…N08,         per launch: xdg/, xdg-before/, home/, espansoConfig.app,
           C01…C10/                  probe.log, probe.err, bytes.txt, tree.diff
  launches/C09-plant/                NOT a launch — adversary.sh's sibling plant, one symlink (§4.5)
  manifest-2c-5-5a-post.sha256       40 entries — the round-0 image; 36 still verify (§9.10)
  manifest-2c-5-5a-fix-post.sha256   78 entries — the round-1 image; 75 still verify (§5.9)
  manifest-2c-5-5a-round2.sha256     55 entries — the round-2 image; all 55 verify (§5.9)
```

It is **2.7 GB**, which is a reading of the tree's size at one moment, over the **sixty-six** launches
§5.8 names and §5.10 tallies — `P01…P48`, `N01…N08` and `C01…C10`, 48 + 8 + 10 — roughly 40 MB each,
because every script assembles a fresh `.app` bundle per launch and every launch keeps its own. That is
the growth rate 4a §1 recorded and not a measurement of what a rebuild costs. **This sentence said
"sixty-five" until round 3**, which agreed with neither of the two sections that name the launches; §11.5
is the correction.

**Four generations of launches are retained, and only one of them carries the complete proof set.** P01–P12 and
N01–N02 ran the **round-0** image and are superseded; P13–P24, N03–N04 and C01–C02 are an
**intermediate** generation, taken after the first round-1 fixes and before two further corrections
round 1's own self-review found (§9.9's first paragraph), and nothing in this record cites them;
P25–P36, N05–N06 and C03–C04 are the **round-1** generation, which the round-1 record cited as its
proof set and which round 2 superseded by changing `probe.rs` again; **P37–P48, N07–N08, C05–C07 and
C09–C10 are the complete proof set — nineteen launches**, being the **twelve plan-proof launches**
P37–P48 plus two no-plan controls, two static confinement controls and three adversarial ones
(12 + 2 + 2 + 3 = 19), and every one of the nineteen ran the binary whose digest is
`0a2d3506630256f6a3193de3352b32b23244e4e8ff7c07b9642a85c393954d92`. **"The proof set" meant twelve in
§4 and nineteen here until round 4**; the two terms are now the *twelve plan-proof launches* and the
*nineteen-launch complete proof set*, and §12.5 is that correction. Keeping the superseded ones is
deliberate: deleting a generation would leave this record asserting a history the tree no longer shows.

**C08 is retained and is in neither set — not among the twelve and not among the nineteen**, for the
same reason P01 is: it is a **discarded
attempt**, and §4.5 says exactly what it does and does not establish. `launches/C09-plant/` is not a
launch at all — it is `adversary.sh`'s sibling plant, a directory holding one symlink, and §4.5 says
why the plant had to be a sibling.

**Nine files sit outside the tree and step 2c-5-7 must delete them too**:
`/private/tmp/espansoconfig-probe-decoy-C01.yml` through `…-C09.yml`, which `confine.sh` and
`adversary.sh` create *outside* `$HARNESS` because being outside it is the whole point of the check.
(C10's mode needs no outside decoy — its "wrong path" is deliberately *inside* the launch tree.)

**The old tree was already gone before this step began, and this step did not delete it.**
`/private/tmp/espansoconfig-harness-2c-4c/` **does not exist now**, which is a reading of the
filesystem at the close of this step and says nothing about *when* it went; "this step did not delete
it" is an account of what was done, not a reading of an artifact. **No manifest is under version
control**,
so this step had no before-image to check anything against — the same hole 4a had, one rebuild deeper.

**The owner's real configuration was never opened.** Every launch points `XDG_CONFIG_HOME` at the
synthetic two-file tree the scripts write and `HOME` at an empty directory created for that launch, so
neither candidate `resolve_config_dir()` (`crates/espansoconfig-core/src/discovery.rs`) probes can
reach it. Every fixture is neutral and hand-authored: `:alpha`, `:beta`, `:gamma`, `:probe` and
nothing else. A sweep with `rg --no-ignore --hidden -l` over every `probe.log`, `probe.err`,
`bytes.txt` and `tree.diff` under `launches/` for the owner's home path **finds nothing** — which is a
reading of *those* files for *that* string, not a proof that no retained artifact anywhere holds
anything of the owner's.

**The tracked files that differ from `HEAD` are the two the harness hooks** — and that is a reading of
the tree **at the close of this step's work**, never a comparison with a before-image and never a claim
about the tree at any later moment. `git status --short --untracked-files=all`, read at the close of the **round-2 fix round**,
listed four harness paths plus three documents: `src/main.ts` and `src-tauri/src/main.rs` modified,
`src/probe.ts` and `src-tauri/src/probe.rs` untracked, and this record,
`docs/reviews/phase-2c-5-5a-instrument.md` and `docs/reviews/phase-2c-5-5a-instrument-round2.md`
untracked under `docs/`. `git diff --stat` over
the two hook files was **5 insertions and 1 deletion** and nothing else — **no fix round has changed
either hook file**, which is what that unmoved diff establishes and the whole of it. **That reading is taken before
this step's checkpoint commit, and the commit changes it**: the checkpoint stages `PROGRESS.md` and
this record **by path** and leaves the four harness paths in the working tree for 5b and 6 to use and 7
to delete.

**The same command, read again at the close of the round-3 fix round**, lists six paths: `src/main.ts`
and `src-tauri/src/main.rs` still modified, `src/probe.ts` and `src-tauri/src/probe.rs` still untracked,
`docs/reviews/phase-2c-5-5a-instrument-round3.md` untracked, and **this record now *modified* rather
than untracked**, because the checkpoint commit above tracked it. The two earlier review files no longer
appear, for the same reason. `git diff --stat` over the two hook files still reads **5 insertions and 1
deletion**. Each of these is a reading at one moment and says nothing about the tree before or after it.

**What no artifact here can establish is what this step did *not* alter along the way.**
`manifest-2c-5-5a-post.sha256` is a **post-image by construction** and cannot say what any file held
before. *No git command that changes anything was run* and *no editor was run over any file outside the
four harness paths and this record* are **accounts of what was done**, not readings of an artifact;
what the tree gives is the four-path `git status` above and the diff, at the moment stated.

## 2. What was rebuilt, file by file, and from what

| Rebuilt file | Built from | Provenance |
|---|---|---|
| `src-tauri/src/probe.rs` | `2c-4a-3c-1-instrument.md` §1 (the four item names), §5.2 (the second writer's shell command, quoted — **and deliberately departed from at round 2, which removed the shell entirely**, §10.1); §5.3 (registration beside the shipped list); 3b §6.8 (the same arrangement); `2c-4c-4b-instrument.md` §3.1 (`probe_third_writer` over `ECFG_PROBE_R2`, and why a third document is needed); and `src-tauri/src/main.rs` for the sixteen commands it must re-register | **authored from the code** — no record carries its source |
| `src/probe.ts` | 3b §2 (the plan-string shape), §6.2–§6.7 (the five rules), §8.9; 3c-1 §3 and §5.6 (`BLOCK_TEXT_LIMIT` 4000); 3c-2 §1.2 via 4a §5.11 (`reportViewport`, `reportReach`, `reportReadiness`); and the six components' own markup for every selector and dictionary key | **authored from the code**, against the records' described behaviour |
| `launch.sh` — the recipe, the wait, the checks | 3b §2 (the `open` invocation verbatim), 3b §6.1 (the build order), 3b §8.9 (what it may and may not conjoin), 3d-2a §3 and §5 | re-authored from a description |
| `launch.sh` — the case table, 12 rows | 3b §4's eleven cases, plus `editor-third` which round 1's fix added (§9.3) | re-authored from a description, plus one row authored here |
| `inert.sh` | **no record** — this step authored it, to measure §4.3 rather than assert it | authored here |
| `confine.sh` | **no record** — round 1's fix authored it, so the writer confinement finding 1 asked for is measured rather than read off the code (§4.4) | authored here |
| `adversary.sh` | **no record** — round 2's fix authored it, because round 2's High was that C03/C04 exercise only *static* outside paths and not a symlink planted where the writer is about to act (§4.5) | authored here |
| `fixtures/third-r2.yml` | **no record** — round 1's fix authored it, as the third revision the `editor-third` case needs (§9.3) | authored here |
| `fixtures/base-r0.yml` | 3b §4: one comment line and a `matches:` sequence of `:alpha`, `:beta`, `:gamma`, each a double-quoted `trigger:` and a plain `replace:` | re-authored from a description |
| `fixtures/elsewhere-r1.yml`, `target-changed-r1.yml` | 3b §4 | re-authored from a description |
| the 5 `*-expected.yml` files | 3b §4's *Expected afterwards* column; `creator-front-expected.yml`'s emitted item additionally from `choose_scalar` and `render_item` | authored from that column, and from the code for the one emitted item |

**Every byte no record fixes is this step's own choice.** In particular the leading comment line's
wording is this step's: 3b §4 says "one comment line" and no record quotes it. The second file of the
synthetic tree is this step's too (§5.3).

### 2.1 The four hook lines, and what the tree establishes about them

`git diff` over the two hook files is exactly:

- `src-tauri/src/main.rs`: `mod probe;` (`:55`) and
  `probe::register_with_probe(tauri::Builder::default())` replacing `register(…)` (`:136`);
- `src/main.ts`: `import { startProbe } from './probe';` (`:20`) and `startProbe();` (`:37`).

Those are the same four lines the earlier records name, and the same `5 insertions, 1 deletion`. **That
is a coincidence worth stating rather than a check**: nothing here compared this tree with any
pre-removal one, and the agreement follows from the records having described the same two edits and
this step having applied them to the same two files.

### 2.2 Four things the records left open that had to be decided from the code

Each is a place where the records name a behaviour and not its mechanism, and each was settled by
reading production source rather than by guessing.

- **How the driver resolves a label.** The records say `pressNamed('browser.matchMove.position.top')` —
  a literal dictionary key — and 3c-2 §1.2(3) says a lookup is "by the text the running language gives
  the key". `src/probe.ts` therefore calls `translate(language, key, params)` from
  `src/lib/i18n/dictionaries.ts` and matches a control's whole collapsed text **exactly**. Exactness is
  load-bearing: `browser.matchDeletion.open` is *"Delete this snippet…"* and
  `browser.matchDeletion.request` is *"Delete this snippet"*, so a containment test would press
  whichever came first.
- **How a *row* is matched, which is not how a control is.** No record says this, and P01 is what
  found it: a sidebar row draws its path in a `span.name` **beside a snippet count**, and a snippet row
  draws its trigger in a `span.trigger` beside a label and badges, so the row's whole text is never the
  name. `pressRow` matches the named part by its own class and clicks the button that contains it. P01
  failed on exactly this — `timed out waiting for the sidebar file row — a control reading
  "match/conflict.yml" in nav.sidebar` — and it is retained as the demonstration.
- **How the creator chooses a placement.** `MatchCreator.svelte:651` draws a `<select>` whose option
  values are model-minted keys, where `MatchMover.svelte:690` draws a `<ul class="destinations">` of
  buttons. The two surfaces therefore need two mechanisms, and no record says so. The driver matches
  the option by its **text** and assigns `select.value` from the option it found, so it never builds a
  key.
- **What `creator-front-expected.yml`'s new item looks like.** `render_item`
  (`crates/espansoconfig-core/src/patch/edit.rs`) writes `marker` spaces then `- ` for the first field
  and two spaces for the rest, and `choose_scalar` (`crates/espansoconfig-core/src/emit/choose.rs`)
  refuses a plain scalar that starts with `:` and falls through to single quotes. So the emitted item is
  `  - trigger: ':probe'` / `    replace: probe creation`. **P39 matched that file byte-for-byte**,
  which is the evidence; the derivation above is why it was written that way.

## 3. The launch recipe, as this tree runs it

```sh
# once, and IN THIS ORDER — 3b §6.1, because the bundle embeds `dist` at *cargo* build time
npm run build
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol

# per launch, into a launch name never used before
/private/tmp/espansoconfig-harness-2c-5/launch.sh <case>[:<lang>] <name>
```

which does, per launch, into a bundle path never used before:

```sh
open --env "ECFG_PROBE_PLAN=$PLAN" \
     --env "ECFG_PROBE_TARGET=$LAUNCH/xdg/espanso/match/conflict.yml" \
     --env "ECFG_PROBE_R1=$FIXTURES/$R1" \
     --env "ECFG_PROBE_R2=$R2PATH" \
     --env "XDG_CONFIG_HOME=$LAUNCH/xdg" --env "HOME=$LAUNCH/home" \
     --stdout "$LAUNCH/probe.log" --stderr "$LAUNCH/probe.err" \
     "$LAUNCH/espansoConfig.app"
```

`ECFG_PROBE_R2` is always passed and is the **empty string** on every case except `editor-third`,
which is the one case that uses the third writer (§9.3).

**The script refuses three things before it assembles anything**, and each refusal was exercised:

- **a plan that is not `<case>[:en|es]`** — `launch.sh editor-exact:se PXX` printed *"the plan
  editor-exact:se is not `<case>[:en|es]`"* and exited 68; a directory listing of `launches/`
  afterwards shows no `PXX`, which is a reading of that listing and not an account of what the script
  did or did not create along the way;
- **a launch name that is not `[A-Za-z0-9_-]+`** — `launch.sh editor-exact:en 'bad/name'` printed
  *"the launch name bad/name must be non-empty and only letters, digits, - and _"* and exited 69. That
  guard is a **typo guard and not a boundary**: the argument comes from whoever runs the script, and
  the boundary that matters is the one §4.4 and §4.5 measure inside `probe.rs`;
- **a launch name it has already used** (verified in the earlier generation: a second
  `launch.sh editor-exact:en P02` printed *"launch name P02 has already been used; pick another"* and
  exited 65).

It then seeds `base-r0.yml` as `xdg/espanso/match/conflict.yml` beside a synthetic
`xdg/espanso/config/default.yml`, copies the tree to `xdg-before/` **before** launching, assembles the
`.app` by copying whatever `ECFG_BINARY` names — defaulting to `target/debug/espansoconfig` — waits for
`--- end` or 25 seconds, kills the process, then `cmp`s the target against the case's expected file,
searches for `.espansoconfig-backups`, and diffs the tree against the pristine copy.

**It conjoins none of that** — 3b §8.9 — and this rebuild did not give it the power to. It records
`end-lines=` and `failed-lines=` as **counts**, it does not compare the three revisions a conflict
panel prints, and it will write `reached-end=yes` beside a `bytes=DIFFER`. A reader supplies the
conjunction, on every launch.

**"Freshly built" is not a claim these artifacts carry.** Nothing in the script checks a timestamp,
re-runs the build or records a build transcript, and **no build transcript was retained**. The block
above is the recipe in the order 3b §6.1 requires. What the retained bundles *do* pin is **which bytes
ran**, and §5.10 is that measurement — including the fact that **five** different binaries ran across
the **four** retained generations (§1 names the four; §5.10's table has five digest rows, because the
round-0 generation itself ran two). **This sentence said "four binaries" and "three generations" until
round 4**, agreeing with neither section; §12.7 is the correction.

## 4. The proof launches

**Twelve plan launches, P37–P48; two no-plan launches, N07–N08; two static confinement launches,
C05–C06; three adversarial confinement launches, C07, C09 and C10.**
**P37–P48 are the twelve *plan-proof* launches** — **one per case of the whole case table**, which is
this step's own acceptance criterion: every state the case table claims to reach has a launch that
reached it, and there is no row in `launch.sh` that no launch of this generation ran. **The
*complete proof set* is all nineteen** — those twelve plus the seven controls named in the line above
(12 + 2 + 2 + 3 = 19), which is the set §1 and §5.10 count. **This section's rows and predicates are
about the twelve**, and every unqualified "proof set" in this record read as one or the other until
round 4 (§12.5).

**P01 is retained from the round-0 generation and is still the diagnosis §2.2's second bullet
describes** — the first run of the rebuilt driver, which printed `--- failed` on the sidebar row
lookup. It is evidence about that defect and about `launch.sh` writing `reached-end=yes` beside
`bytes=DIFFER`; it is **not** evidence about the tree that ships, because it ran neither this binary
nor this driver.

Each launch satisfies, by hand, the same four-part conjunction 3b §8.9 defines: no `--- failed` line; a
conflict block with three revisions where `expected ≠ found` and `diskRevision == found`; the expected
control and action lines for that surface; and the intended byte predicate. **Nothing in the harness
conjoins those four; a reader did, on all twelve.**

| # | Case | Surface | Lang | `expect=` | `bytes=` | `backups=` | `tree-diff` | `probe.err` | `--- end` / `--- failed` |
|---|---|---|---|---|---|---|---|---|---|
| P37 | `editor-third` | editor | en | `third-r2.yml (R2)` | **MATCH** | **none** | 14 | 0 bytes | 1 / 0 |
| P38 | `editor-exact` | editor | en | `editor-exact-expected.yml` | **MATCH** | **PRESENT** | 15 | 0 bytes | 1 / 0 |
| P39 | `creator-front` | creator | es | `creator-front-expected.yml` | **MATCH** | **PRESENT** | 15 | 0 bytes | 1 / 0 |
| P40 | `deleter-exact` | deleter | en | `deleter-exact-expected.yml` | **MATCH** | **PRESENT** | 14 | 0 bytes | 1 / 0 |
| P41 | `mover-exact` | mover | es | `mover-exact-expected.yml` | **MATCH** | **PRESENT** | 15 | 0 bytes | 1 / 0 |
| P42 | `duplicator-exact` | duplicator | en | `duplicator-exact-expected.yml` | **MATCH** | **PRESENT** | 15 | 0 bytes | 1 / 0 |
| P43 | `raw-negative` | raw | es | `elsewhere-r1.yml (R1)` | **MATCH** | **none** | 12 | 0 bytes | 1 / 0 |
| P44 | `editor-collision` | editor | en | `target-changed-r1.yml (R1)` | **MATCH** | **none** | 11 | 0 bytes | 1 / 0 |
| P45 | `creator-anchor` | creator | es | `target-changed-r1.yml (R1)` | **MATCH** | **none** | 11 | 0 bytes | 1 / 0 |
| P46 | `deleter-changed` | deleter | en | `target-changed-r1.yml (R1)` | **MATCH** | **none** | 11 | 0 bytes | 1 / 0 |
| P47 | `mover-changed` | mover | es | `target-changed-r1.yml (R1)` | **MATCH** | **none** | 11 | 0 bytes | 1 / 0 |
| P48 | `duplicator-changed` | duplicator | en | `target-changed-r1.yml (R1)` | **MATCH** | **none** | 11 | 0 bytes | 1 / 0 |

**Every one of the twelve `bytes.txt` files is ten lines, with the same ten keys in the same order**,
which is the check finding 8 made necessary and which the round-0 P02 failed: its eleventh line was a
bare `0` (§9.8). The five confinement launches are also ten lines each and share one key set of their
own (`confine.sh` and `adversary.sh` emit the same block); the two no-plan launches are eight lines.
**Line-shape uniformity is a property of each script's output block, not of the harness**, and it is
checked by reading, exactly as everything else here is.

**Twelve launches, all six write surfaces, five positives, five post-reapply refusals, one
negative-capability case and one third-writer case.** Every launch picked its language **through the
picker** and printed `documentElement.lang`; `picked=` equals `lang=` on all twelve, which is 3b §6.7's
rule, and it matters because the WebKit data store follows the bundle identifier that every probe
bundle shares. Every launch also prints `--- plan case=… requested=…`, so a plan that named no language
is visible as `requested=absent` rather than silently English (§9.4); all twelve read `requested=en` or
`requested=es`.

**That is aggregate bilingual coverage and not per-surface bilingual coverage.** English was used for
the editor, the deleter and the duplicator; Spanish for the creator, the mover and the raw editor;
**no surface here was launched in both.** Step 2c-5-6 is the reading that owes both languages on every
surface; this step does not give it.

### 4.1 What each one showed, quoted from its retained transcript

The viewport is `720 x 728`, `dpr=1`, `hasFocus=false`, `visibility=hidden`, on every one of the
twelve — checked as twelve separate matches, not read off one. **That differs from the
`1180 x 728 dpr=2` every earlier record reports**, so **no geometry in this record may be compared with
3c-2's, 3d-2b's or 2c-4c-5's ledgers.** Nothing here judges why; it is recorded as a measurement.

Every conflict block shows `expected a9990be6…` against a `found` that equals its `diskRevision` —
`60a66198…` on the seven cases whose R1 is `elsewhere-r1.yml`, `9e937f20…` on the five whose R1 is
`target-changed-r1.yml`.

- **P37 — the third-writer case, and the only launch of this step that moves the file twice.** Panel
  `box=407,44,282x1282`; `keepMyDraft=present keepMyRequest=absent`,
  `readiness ready=present readyOperation=absent`; *Keep my draft* pressed,
  `reapplyArm=browser.reapply.reapplied`; then
  `editor beforeSecondSave outcomePanel=absent`, `--- writer third wrote=yes`, the second save pressed,
  and a **new** outcome block whose three revisions are
  `60a66198… / 8b1a27af… / 8b1a27af…` — the reapply's own base against R2. The file ends byte-identical
  to `third-r2.yml`, `backups=none`, and `tree.diff` is 14 lines. **`bytes=MATCH` here discriminates
  the third writer having run**, because no application path produces R2 and a writer that had failed
  would have left R1 (§9.3).
- **P38** — conflict panel `box=407,44,282x1282`; four choices in the order *Keep editing · Copy my
  text · Keep my draft · Load the version on disk*, `keepMyDraft=present keepMyRequest=absent`;
  `readiness ready=present readyOperation=absent`; *Keep my draft* pressed,
  `reapplyArm=browser.reapply.reapplied box=407,605,282x84`; *Save this snippet* pressed again; the new
  outcome block carries **zero** revision runs (`revisions  of 0`) and says *"The file was written.
  What is on disk now is exactly the text that was sent."* The file ends byte-identical to
  `editor-exact-expected.yml`.
- **P39** — destination `match/conflict.yml` and placement *Al principio de la lista* chosen inside the
  creator's own section; panel `box=407,44,282x1208`; `keepMyDraft=present`; *Conservar mi borrador*
  pressed, `reapplyArm=…reapplied box=407,588,282x101`; *Añadir este fragmento* pressed again. The file
  ends byte-identical to `creator-front-expected.yml`, `:probe` first.
- **P40** — panel `box=407,44,282x990`; three choices, `keepMyRequest=present`;
  `readiness ready=absent readyOperation=present`; *Keep what I asked for* pressed,
  `reapplyArm=…reapplied box=407,320,299x84`; then the deletion **request** control and the
  **confirmation** control each found and pressed — a missing one would have printed `--- failed`. The
  file ends byte-identical to `deleter-exact-expected.yml`.
- **P41** — destination *Al principio de la lista* chosen inside `.mover .destinations`; panel
  `box=407,44,282x1120`; *Conservar lo que he pedido* pressed,
  `reapplyArm=…reapplied box=407,588,282x101`; the destination chosen again and *Mover este fragmento*
  pressed. The file ends byte-identical to `mover-exact-expected.yml`, `:beta` first.
- **P42** — panel `box=407,44,282x1007`; *Keep what I asked for* pressed,
  `reapplyArm=…reapplied box=407,385,299x84`; *Duplicate this snippet* pressed again, then the ordinary
  `DuplicateKeepsTriggerDefinition` acknowledgement **waited for** and pressed. The file ends
  byte-identical to `duplicator-exact-expected.yml`: two adjacent `:beta` items.
- **P43** — panel `box=407,66,282x606`; **three** choices — *Seguir editando · Copiar mi texto · Cargar
  la versión del disco* — and `keepMyDraft=absent keepMyRequest=absent`;
  `readiness ready=absent readyOperation=absent`. The file ends byte-identical to R1, `backups=none`,
  and `tree.diff` is 12 lines.
- **P44, P46, P47, P48** — the same shape on four surfaces against `target-changed-r1.yml`: conflict,
  the reapply control pressed, `reapplyArm=browser.reapply.manualResolution`, nothing sent afterwards.
  Panels `282x1282`, `282x1007`, `282x1103` and `282x1024` respectively, each at `407,44`; the reapply
  blocks are `282x192`, `282x209`, `282x243` and `282x209`, each at `407,44` as well. Each file ends
  byte-identical to R1, `backups=none`, each `tree-diff` is 11 lines.
- **P45** — the same, in Spanish, on the creator with placement *Después de :beta*; panel
  `box=407,44,282x1208`, reapply block `box=407,44,282x243`. Its `manualResolution` obstacle names the
  anchor: *"espansoConfig no ha podido identificar en la versión en disco el fragmento tras el cual
  debía colocarse este."*

**The panel rectangles moved between the round-1 generation and this one, on four surfaces, with no
source change that would explain it.** P28's deleter panel was `282x1007` where P40's is `282x990`;
P31's raw panel was `407,49,282x623` where P43's is `407,66,282x606`; P35's mover panel was `282x1120`
where P47's is `282x1103`; P36's duplicator panel was `282x1007` where P48's is `282x1024`. **Nothing
here explains that and nothing here should be read as explaining it** — the geometry of this harness
is already declared incomparable with any other record's (§6.8), and this is one more reason to treat
a rectangle as a measurement of one launch rather than as a property of a surface.

**A control this list says was "pressed" is one the driver waited for and clicked, and the transcript
prints no line for it.** `pressNamed` throws when the control does not arrive **enabled**, and
`startProbe()` **attempts** to print `--- failed`; every one of the **twelve plan-proof launches** has
`failed-lines=0` beside `end-lines=1` — which is **not** true of the complete proof set's other seven,
where a `--- failed` is the pass (§4.4, §4.5) — and each positive launch's final block says the file was
written. That conjunction is a reader's, not the harness's — and `failed-lines=0` beside a reached
`--- end` is the pair that carries it, because a `--- failed` that could not be written would also have
kept `--- end` from arriving (§10.3).

### 4.2 The revision digests are **not** any earlier record's, and a fixture's revision equals its SHA-256

3b §5 records R0 as `507e98f5…` and `elsewhere-r1.yml` as `31be59eb…`; 4a §4.2 records `9246ae21…` and
`04e4bef8…`. **This tree's R0 prints `a9990be6…` and its `elsewhere-r1.yml` prints `60a66198…`.** The
fixtures were re-authored from prose, so byte-identity with any earlier tree's was never claimed and is
now positively contradicted for those two. What follows practically: **steps 5b and 6 cannot use digest
equality with any earlier ledger as a continuity check**, and any launch record they write should print
its own digests.

`shasum -a 256` over the four revision fixtures answers exactly the four values the transcripts print:

```
a9990be61286e0f0c4a1552cde755bc72fa4e57be87e5c869a3175e9f538fd3d  base-r0.yml
60a66198e6351d116cc61ecd06d6c08f2e7f71a45040e484208ae907891a9065  elsewhere-r1.yml
9e937f207731d26750250ea35b5c983b456a9980cbc76850c5d10b1737c3417c  target-changed-r1.yml
8b1a27af14e1f939c10a67bed2059eb6a752bb48c0b34ebb0a4a18b541be5984  third-r2.yml
```

The fourth is round 1's own addition and **P37's second conflict** printed it as `found` and as
`diskRevision`, which is how that launch's transcript and its `bytes=MATCH` say the same thing twice.

That gives 5b and 6 a way to check a transcript's revisions against a file on disk without launching
anything. **It is an observation of these three files on this build**, and 4a §4.2's same observation
holding once more, not a documented property of the revision function.

### 4.3 Without `ECFG_PROBE_PLAN`: no plan-driven action observed, and the final tree unchanged

**The heading this section used to carry said "the hooks are inert", and that was false twice over** —
finding 7. It is false in what the evidence supports, and it is false about the hooks themselves. Both
are corrected here; `inert.sh` keeps its file name, which is now historical.

`inert.sh` assembles the **same** bundle and launches it with `XDG_CONFIG_HOME` and `HOME` set and
**no** `ECFG_PROBE_PLAN`, `ECFG_PROBE_TARGET`, `ECFG_PROBE_R1` or `ECFG_PROBE_R2`. N07 and N08 both
answered:

```
probe.log=0 bytes   probe.err=0 bytes   tree-diff=0 lines   target-unchanged=yes
alive-at-kill=yes   binary=0a2d3506…
```

**A zero-byte transcript is also what a bundle that never started would leave**, which is why both
launches record the kill's status: `pkill` answers 0 only when it signalled a live process, so
`alive-at-kill=yes` is the evidence that the silence is a **running window's** silence. That control is
genuine and is retained as such. Both ran the same binary digest that produced P37–P48's transcripts.

**What these two launches establish is exactly this and no more**: with the variable absent, a live
window wrote **no transcript line**, and the synthetic tree was **byte-identical after twelve seconds**
— zero `tree-diff` lines and `target-unchanged=yes`. That is a reading of a final state.

**What they cannot establish, and what the earlier wording wrongly claimed they did**: that *no writer
was spawned*. There is no invoke spy and no command counter (§6.1), so a write that produced identical
bytes, or a transient one undone before the launch ended, would leave these same artifacts. The honest
sentence is *no plan-driven DOM action was observed and the final synthetic tree is unchanged*.

**What is separately known from the code, and is not a reading of these launches**: `startProbe()`
returns as soon as `probe_plan` answers `null`, and — added at round 1 — `replace_the_target`
refuses on the same question, so a writer reached without a plan answers *"refused: the … writer will
not run without ECFG_PROBE_PLAN"*. **No launch here exercises that particular refusal**, because this
driver has no way to call a writer without a plan; it is stated as a property of the source, not as a
measurement.

**And the hooks are not inert in any reading.** `register_with_probe` adds **four callable IPC
commands** to every instrumented launch and `src/main.ts` calls `startProbe()` unconditionally, so
**every startup pays one extra IPC round trip**. §7's last paragraph says the same thing and is where
that cost belongs; neither was measured, and both are gone when 2c-5-7 removes the harness.

### 4.4 The writer confinement, measured on two static launches

**Round 1's finding 1 — its only High — was that `replace_the_target` would replace whatever path
`ECFG_PROBE_TARGET` named, and that `probe_second_writer` and `probe_third_writer` are callable IPC
commands on every instrumented launch.** That is a path to writing a user's file outside
`espansoconfig_core::persist::save_document`, which is this project's one absolute prohibition.
**Round 2 then found that round 1's fix was itself raceable**, and §4.5 and §10.1 are that half;
**round 3 then found that two of the rebindings round 2 believed closed are still open**, and **round 4
then found a fourth that every one of those lists had omitted — an ancestor of the *source's* pathname,
`fixtures` itself being the nearest**; §9.1 and §10.1 name all four. As the writers now stand,
`replace_the_target` requires a plan, canonicalizes the
target and requires it to be **exactly** `…/launches/<launch>/xdg/espanso/match/conflict.yml`, and
canonicalizes the source and requires it to be a document **directly inside** `…/fixtures` — all three
checks before anything is read or created, **with no shell involved at any point**, and **each a check
on a pathname at one instant**: the source's name is resolved again by `std::fs::read` and the
temporary's again by `std::fs::rename`, each of those walking every directory above it a second time,
so what those checks force is the shape a name had when it was
resolved and not the identity of the object the write reaches (§9.1).

`confine.sh` measures the two *static* refusals rather than reading them off the code. It builds the
same bundle, creates a decoy file **outside** the harness root, and points one of the two paths at it:

| # | Mode | Decoy | Launch's own target | `--- failed` | Refusal quoted from the transcript |
|---|---|---|---|---|---|
| C05 | `target` | **unchanged** | still R0 | 1 | *refused: the second writer's target (ECFG_PROBE_TARGET) …decoy-C05.yml is not beneath …/launches* |
| C06 | `source` | **unchanged** | still R0 | 1 | *refused: the second writer's source (ECFG_PROBE_R1) …decoy-C06.yml is not beneath …/fixtures* |

Both reached `--- end` with a zero-byte `probe.err` and `tree-diff=0 lines`. **`--- failed` is the pass
here, and that inverts every other table in this record**: the writer is supposed to refuse, the
driver's `invoke` then rejects, and the plan throws.

**What carries each row is the quoted `refusal=` line, which is a positive observation.** The
`decoy=unchanged` beside it is a reading of final bytes, and a reading of final bytes cannot on its own
distinguish "nothing was written" from "something identical was written" or "something was written and
undone" — this harness has no invoke spy and no command counter (§6.1), so no artifact it produces can
make that distinction anywhere.

**What these two do not establish.** They measure two refusals on one command; that is not a proof
that no path in this build can write outside the tree. They say nothing about the third writer's own
confinement, which shares the same `replace_the_target` but was not separately pointed outside. **C06
measures the *beneath-`fixtures`* half of the source rule and only that half**: its decoy is outside
the harness root, so the refusal it quotes is `strip_prefix`'s. **Nothing here ever points a writer at a
nested regular file beneath `fixtures`, so the *direct-child* rule at `src-tauri/src/probe.rs:352-358`
is closed by source construction and unmeasured** — §9.1's label said C06 measured both until round 4
(§12.4). And
they are **static**: a path spelled outside the tree before the launch begins, never a path swapped
while the launch runs. §4.5 is the adversarial half, and §10.1 states the cases neither half
constructs. Finally, the confinement does **not** protect everything *inside* the harness tree — it
now protects every file in a launch directory except the one synthetic `conflict.yml` that launch
seeded, which the writers are supposed to replace.

### 4.5 The adversarial confinement controls, and the one case that was not constructed

**Round 2's High was that C03/C04 test only static outside paths.** The old writer checked the
temporary's absence with `symlink_metadata` and then let `/bin/sh`'s `cp` open that pathname a second
time, so a symlink inserted between the two operations was **followed** — an outside file overwritten
through a path that had passed every check. `adversary.sh` is the half that plants such a symlink.

| # | Mode | What is planted | Decoy | Launch's own target | `--- failed` | Refusal quoted from the transcript |
|---|---|---|---|---|---|---|
| C07 | `temp` | a **symlink at the exact temporary path**, pointing outside the harness | **unchanged** | still R0 | 1 | *refused: the second writer could not create the temporary …/launches/C07/xdg/espanso/match/conflict.yml.probe-tmp-adversary-C07 exclusively: File exists (os error 17)* |
| C09 | `target-symlink` | a sibling launch directory whose `conflict.yml` is a **symlink** outside the harness | **unchanged** | still R0 | 1 | *refused: the second writer's target (ECFG_PROBE_TARGET) …decoy-C09.yml is not beneath …/launches* |
| C10 | `target-elsewhere` | nothing — the target is a **real file inside the launch tree that is not the synthetic one** | **unchanged** | still R0 | 1 | *refused: the second writer's target (ECFG_PROBE_TARGET) …/launches/C10/xdg/espanso/config/default.yml is not a launch's own \<launch\>/xdg/espanso/match/conflict.yml beneath …/launches* |

All three reached `--- end` with a zero-byte `probe.err` and `tree-diff=0 lines`, and in all three
`--- failed` is the pass.

- **C07 is the direct measurement of the `O_EXCL` fix.** The old `cp` would have opened the planted
  link and written R1's bytes into `…probe-decoy-C07.yml`. `OpenOptions::create_new` refuses a path
  that exists at all, symlink included, so the writer stopped with `os error 17`; `ls -l` afterwards
  shows the planted link still a link, still pointing at the decoy. **What C07 measures is a plant that
  was already there when `create_new` ran, and only that** — it says nothing about a name rebound after
  the open, which is residual 2 below. The temporary's name is normally
  unpredictable — process id plus a nanosecond stamp — so this control needs `ECFG_PROBE_TEMP_NAME` to
  aim at it, which §5.18 records as a deviation.
- **C09 had to be built as a sibling plant, and C08 is the retained attempt that shows why.** C08
  replaced the launch's *own* `conflict.yml` with a symlink and never reached the writer: it printed
  *"timed out waiting for the sidebar file row — a row whose `span.name` reads `match/conflict.yml`
  in `nav.sidebar`"*. **C08 therefore establishes a sidebar timeout and nothing about any writer** —
  including nothing about whether one ran. It is retained, unaltered, exactly as P01 is.
- **C10 is what the round-2 "exact file" constraint buys.** Under round 1's rule — *beneath
  `launches/`*, plus `is_file()` — that path would have passed both checks and the launch's own profile
  would have been replaced. **That is a reading of round 1's code, not a measurement**: no launch of
  this tree ever pointed a writer at that path under the old rule.

**What this section does not establish, stated as plainly as it can be — and it is four cases, not
one.** Confinement is **not proven** against any of these four rebindings, each of them a name checked
at one instant and spent at another:

1. **the source's final component**, rebound between `confined_source` and the `std::fs::read` that
   resolves that pathname again;
2. **the temporary's name**, rebound between the `create_new` that took it and the `std::fs::rename`
   that spends it — C07 measures a symlink *already present* when `create_new` runs and nothing after
   it;
3. **an *ancestor directory* of the target's pathname** — the launch tree — replaced with a symlink
   between the canonicalization and the create-or-rename that follows it;
4. **an *ancestor directory* of the source's pathname**, replaced with a symlink between
   `confined_source` and the `std::fs::read` that walks it again. The nearest one is **`fixtures`
   itself**, and it is a **sibling** of `launches`: item 3's wording, "an ancestor directory of the
   launch tree", never covered it, which is why this list said three until round 4 (§12.3).

**None of the four is constructed here and none is closed.** Defeating them needs `openat`-style
pinned directory handles, which `std` does not offer; provoking either ancestor case needs a second
process racing a live launch, which this harness has no way to spawn. They are *accepted*, and the
reasons they are
acceptable are the ones that make this a residual risk rather than an argument: the launch root is
created by `launch.sh` beneath an operator-controlled `/private/tmp` path, the instrumented binary is
never shipped and never signed, and **step 2c-5-7 deletes both the binary and the tree**. None of those
three reasons is a proof of impossibility, and this record does not offer them as one. §10.1 is the
finding this paragraph answers, **§11.1 is why the list grew from one to three at round 3, and §12.1 is
why it is four.** Every one of the four is **open and disclosed**.

## 5. Deviations from what the records describe

Each is a place this tree differs from the instrument the records describe. None is an improvement
offered silently. **5.10 is a measurement rather than a deviation** and sits here because it is what
replaces a claim §3 would otherwise make.

**5.1 A new scratch path, and not a session scratchpad.** The tree is
`/private/tmp/espansoconfig-harness-2c-5/`, a stable path, rather than this session's own scratchpad
directory — 3d-2a §5.1's reasoning, unchanged: steps 5b, 6 and 7 are different sessions, and the tree
the original harness lost was a session scratchpad keyed to a session id that no longer existed. It is
**not** 2c-4c's path, which is gone.

**5.2 Both probe sources are authored, not rebuilt, and the writer no longer follows its record.**
`src-tauri/src/probe.rs` follows the four item names `2c-4a-3c-1-instrument.md` §1 gives, the
registration arrangement its §5.3 insists on, and the fourth command `2c-4c-4b-instrument.md` §3.1
describes; everything else — the environment-variable handling, the explicit stdout flush, the error
strings — is this step's. **The one place it now departs from a record is the writer body**:
`2c-4a-3c-1-instrument.md` §5.2 quotes a `/bin/sh` command, and round 2 removed the shell entirely
because a shell is a *second process* re-resolving pathnames the checks approved (§10.1) — which is
narrower than "the checks now cover every resolution", because this process still resolves the source's
name at `std::fs::read` and the temporary's at `std::fs::rename`, **each of them walking every
directory above that name a second time as well** (§9.1's four residuals). What survives of that
record's intent is the *ordering* it existed for — the replacement is inline and synchronous, so it is
finished when the `invoke` resolves. `src/probe.ts` follows every behaviour the records describe; its
internal shape is this step's.

**5.3 The second file of the synthetic tree is this step's own.** The records say "a synthetic two-file
tree" and never what the second file holds. Here it is `xdg/espanso/config/default.yml`, two lines,
neutral, never opened by any plan.

**5.4 The backup search does not use `fd`.** `fd` is not installed on this machine, and the records do
not say which tool the old script used. This script does it in two halves: a direct `[ -d ]` test on
`<config root>/.espansoconfig-backups`, and a sweep with `rg --files --hidden --no-ignore`.
`backups=none` requires both to find nothing. The directory test is what catches an **empty** backup
directory at the root, which a file listing cannot see; **an empty one somewhere else would evade both
halves**, and no `backups=none` line in this record claims more than these two searches performed.

**5.5 `bytes.txt` carries lines the records do not cite.** `bytes=` and `backups=` keep their recorded
positions and 3d-2a §5.5's `expect=` keeps its; this step adds `name=`, `plan=`, `case=`, `tree-diff=`,
`binary=`, `probe.err=` and a `reached-end=` line that also carries `end-lines=` and `failed-lines=`
**as counts**. The counts are not a conjunction — nothing refuses to write `reached-end=yes` beside
`failed-lines=1`, and P01's own `bytes.txt` is the standing demonstration.

**5.6 The script kills the application after the wait.** `pkill -f "$APP/Contents/MacOS/espansoConfig"`,
then one second, **after** the wait and **before** the byte checks. 3d-2a §5.6's reason is unchanged:
without it every launch leaves a live process sharing the bundle identifier the next launch's WebKit
data store also uses.

**5.7 The bundle is hand-assembled**, with an `Info.plist` carrying `cc.carpio.espansoConfig` —
`src-tauri/tauri.conf.json`'s own identifier. 3d-2a §5.7's reason is unchanged.

**5.8 The launches are named `P01…P48`, `N01…N08` and `C01…C10`.** Not a continuation of 4a's or
3d-2a's numbering: those artifacts are gone and a shared numbering would read as a shared ledger. The
`N` prefix marks the launches that carried no plan; the `C` prefix marks a confinement control, static
(round 1's) or adversarial (round 2's). **The numbering is continuous across the four generations §1
describes**, which is why the twelve plan-proof launches start at P37 rather than at P01.

**5.9 Three post-image manifests were written, and the older two are left exactly as they were.**
`manifest-2c-5-5a-post.sha256`, **40 entries**, is the **round-0** image; **36 of its 40 still
verify**, and the four that do not are precisely `launch.sh`, `inert.sh`, `src/probe.ts` and
`src-tauri/src/probe.rs` (§9.10). `manifest-2c-5-5a-fix-post.sha256`, **78 entries**, is the
**round-1** image; after round 2 **75 of its 78 still verify**, and the three that do not are exactly
`confine.sh`, `src/probe.ts` and `src-tauri/src/probe.rs` — the three files round 2 changed. **`launch.sh`
and `inert.sh` still verify against it**, which is the reading that says round 2 did not touch the
script that produced the twelve plan launches. `manifest-2c-5-5a-round2.sha256` is the **round-2**
image — **55 entries**, the four scripts, all 9 fixtures, both probe sources, and the `probe.log` and
`bytes.txt` of every launch of this generation plus the discarded C08 — and `shasum -a 256
-c` succeeds for all 55. Neither older manifest was regenerated; 3d-2a §8.5 is this
project's record of what regenerating one destroyed. **All three are post-images only**: with no
before-image none can establish what was not altered. Steps 5b and 6 should **append rather than
regenerate**.

**5.10 Five binaries ran, and the artifacts pin which — never their provenance.** Every launch keeps
its whole bundle, so `Contents/MacOS/espansoConfig` is a retained artifact per launch, and `bytes.txt`
records its digest. Measured across all launches:

| Digest | Launches | Generation |
|---|---|---|
| `e11c1aa329fdd113edbb68ebb7221f3bbf9844cb4e6d5fff0968a889953a558d` | P01 | round-0, the failed first run |
| `3c45d26fc59b2960708c92e490bc14c352905852f2cae68496a94e4e93c547d9` | P02–P12, N01, N02 | round-0 |
| `a4c8d89f98320d31153d2c6cdcdf68fc75da0049c6ef5809312235e1a63c9b49` | P13–P24, N03, N04, C01, C02 | intermediate |
| `d22a0fdaf15ecd392511b80ca1090c497f96b82d018f950287f11cd6966d157b` | P25–P36, N05, N06, C03, C04 | round-1, superseded by round 2 |
| `0a2d3506630256f6a3193de3352b32b23244e4e8ff7c07b9642a85c393954d92` | **P37–P48, N07, N08, C05–C10** | **the proof generation** — the **nineteen-launch complete proof set** (the twelve plan-proof launches plus seven controls) **plus C08**, the discarded attempt (§1, §4.5) |

The last was byte-identical to `target/debug/espansoconfig` **when that equality was first read, and is
not now**: `cargo build -p espansoconfig --features custom-protocol` is one of §7's seven gate rows and
**each of the first four fix rounds re-ran it**, rewriting that path; **rounds 5, 6 and 7 did not run it
at all** (§13.6, §14.6, §15.7), so nothing since round 4 has rewritten it and the inequality is an
expired equality rather than a rebuild each round performs. **Measured at round 4**:
`shasum -a 256 target/debug/espansoconfig` answers `04988c09…`, while P37's and C10's retained bundle
binaries still answer `0a2d3506…` — the retained copies are what pin which bytes ran, and the working
build tree is not (§12.7). **That the five digests
differ is the whole of what is established**: no retained artifact binds any executable to a source
snapshot or to a build command, so *the fixes were applied and the bundle rebuilt* is an account of
what was done and not a reading of these bundles. `launch.sh` would have copied any binary it was
pointed at.

**5.11 A control must be *enabled* to be pressed, and no record says so.** `pressNamed` and `pressRow`
require `!disabled`. A disabled control accepts `click()` and does nothing, so matching one would turn
a real defect into a launch that looks right and writes nothing; requiring enablement turns it into a
timeout and a `--- failed`. This is stricter than the instrument the records describe, whose button
roll "records labels and never a control's disabled state" (3b §6.6).

**5.12 The twelve cases are 3b §4's eleven plus `editor-third`, and none of 3c-1's, 3d-2a's, 4b's or 5b-1's.** Nothing here
carries `editor-fallback`, `editor-satisfied`, `editor-ambiguous`, `editor-missing`,
`editor-ineligible`, `editor-empty-satisfied`, any reload case, any recovery case, `creator-anchor-gone`,
`mover-reordered`, `mover-reordered-end`, `mover-after` or `mover-after-changed`. That is a deliberate
scope: this step's acceptance criterion is that **every case it ships has a launch**, and a case table
larger than its twelve plan-proof launches would break it. Their fixtures and plans are 5b's to add if
5b needs them —
§8 says which ones it plausibly does.

**5.13 `repeatIfAsked` and the `:twice` third segment do not exist here.** 3d-2a §5.12 and 4a §5.12
record a mechanism that was built and never used in either tree. This rebuild did not build it, so
there is no unexercised third segment to disclose. **Round 1's fix made a third segment impossible
rather than merely absent**: `parsePlan` in `src/probe.ts` rejects any plan with more than two
colon-separated segments, and `launch.sh` refuses it before assembling a bundle (§9.4). A later step
that wants `:twice` back must widen both.

**5.14 The plan string is checked twice, in two places, on purpose.** `launch.sh` refuses a malformed
plan before it assembles anything; `parsePlan` refuses it again inside the window. Neither is
redundant: the script's check saves a whole launch, and the driver's check is what protects a launch
started any other way. **They are two implementations of one rule and nothing enforces that they
agree** — a case name accepted by one and refused by the other would show up as a `--- failed`, not as
a script error, and no test covers either.

**5.15 A third revision fixture and a case that uses it.** `fixtures/third-r2.yml` and the
`editor-third` row are round 1's fix; §9.3 is why they exist and §4.1's first bullet is what they
showed. The row's `EXPECT` is **R2 rather than R1**, which makes its `bytes=MATCH` discriminate the
third writer having run — unlike the other `nowrite` rows, whose `EXPECT` equals R1 by design (§6.1's
inherited limitation).

**5.16 `confine.sh` and `adversary.sh` are the third and fourth scripts, and their `--- failed` is a
pass.** §4.4 and §4.5 are what they measure. They are listed here because a reader sweeping
`launches/` for `failed-lines=0` would otherwise read C05–C10 as failures. **C08 is the one launch
whose `--- failed` is neither a pass nor a proof-set failure** — it is a discarded attempt whose plan
never reached the writer (§4.5).

**5.17 The launch name is checked against `[A-Za-z0-9_-]+` in all four scripts.** A name holding a
slash or a `..` would escape the launches directory and defeat the "already been used" test. This is a
**typo guard, not a boundary** — the argument comes from whoever runs the script — and it is recorded
as a deviation because no record describes it. **`probe.rs` does not repeat it**: the target's shape
check pins four of its five components, and the fifth is one already-canonicalized directory name, so
a charset rule there would refuse future launch names without narrowing anything.

**5.18 `ECFG_PROBE_TEMP_NAME` exists for one control and no record describes it.** The temporary the
writer creates is named from the process id and a nanosecond stamp, which a script outside the process
has no way to name in advance short of guessing the stamp — so the adversarial control that must plant
a symlink *at that path* had nothing to aim at. This variable fixes the name. It is **not** a widening: `probe.rs`
requires the value to begin with the target's own file name followed by `.probe-tmp-` and to contain
no `/`, so the temporary's **pathname** stays inside the target's canonical directory either way — a
property of the name at the moment it is built, which is all a rule over a pathname can force, and not a
claim about the directory that pathname walks through when it is resolved again (§9.1's four
residuals) —
and the refusal for a bad value is a refusal like any other. Only `adversary.sh` sets it; `launch.sh`, `inert.sh` and
`confine.sh` do not, so every proof launch used a generated name. **What this costs is one more
environment knob on a build that already registers four extra IPC commands**, and it goes with the
rest when 2c-5-7 deletes the harness.

## 6. What this rebuild does **not** prove

3b §8, 3c-1 §7, 3d-2a §6 and 4a §6 are inherited whole, and this section adds what this step's own
shape costs.

**6.1 Inherited, unchanged, and every word of it still applies.** 3b §8.1 (**nothing here is a window
reading** — no launch of this step judged whether a person could read, reach or understand anything);
§8.2 (it cannot fail because a sentence is untrue; the transcript prints the strings the panels drew
and a false one prints exactly as well as a true one); §8.3 (`HTMLElement.click()` is not a mouse
click; no plan used the keyboard, tabbed, scrolled or produced an untrusted-event refusal); §8.7 (the
adoption arm is invisible: `installed` and `alreadyThere` both reach `reapplied`); §8.8 (it says
nothing about the real configuration); §8.9 (`--- end` proves the wrapper reached its last logging
statement and nothing else); §8.11 and 3c-1 §7.0 (**there is still no invoke spy and no command
counter**, so *a refusal issued no save command* is not established — what P43–P48 show is a final
filesystem state, and a write producing identical bytes or a transient one undone before the launch
ended would leave the same artifacts).

**The general rule that binds every absence sentence anywhere in this record.** An absence observation
is bounded to **the time it was taken, the corpus it was taken over and the predicate it was taken
with**, and it establishes nothing about any wider history, any wider corpus or any wider predicate. A
search that found nothing found nothing *in the files it read, for the string it looked for, at the
moment it ran*; a directory that is not there now was not there *now*; a final state is a state *at the
end*. Three consequences this record leans on, and they are consequences rather than three separate
rules:

- **Time.** Present absence is not chronology. `/private/tmp/espansoconfig-harness-2c-4c/` not existing
  at the close of this step says nothing about *when* it went or about what removed it (§1).
- **Corpus and predicate.** A string search over selected files for one string is not a proof about any
  file it did not read or any string it did not look for — which is exactly what §1's owner-home-path
  sweep and §5.4's two-halved backup search each say of themselves.
- **The no-write equivalence, which is this harness's own special case of the rule.** There is no invoke
  spy and no command counter, so no artifact it produces — a final tree, a zero-byte log, a
  `bytes=MATCH`, a `tree-diff=0`, an unchanged decoy — can distinguish *no write* from *an identical or
  transient write*, and no sentence here may be read as making that distinction. §9.2's temporary-file
  absence and §4.4's and §4.5's `decoy=unchanged` readings are cases of this one; §1's two are cases of
  the first two.

**This limitation is the widest one in this record.** 3c-1 §7.1
(a byte match is not a proof of mechanism), §7.2 (the
correspondence tier is invisible), §7.3 (refusals are not attributed to the rules they were designed
around) and §7.4 all hold here without amendment.

3c-1 §7.5 holds without 3d-2a's amendment, because this tree has no empty-`replace:` fixtures: the
shape is the easy one — double-quoted triggers, plain non-empty `replace:` scalars, one leading
comment, LF endings, no BOM, no block scalars, no item-owned comments, no blank-line runs, no second
sequence, no read-only file, no package. **R38 is untouched: none of the fifteen corpus fixtures
`CLAUDE.md` §4 lists has been through this harness.**

**6.2 The reapply arm is read off a *string*, and that is weaker than reading a value.**
`reportReapply` compares the block's text against the six `browser.reapply.*` sentences in the
launch's own language. A re-worded sentence would print as `unrecognised`; a sentence that is on the
wrong arm would print as the arm it reads like. What the eleven `reapplyArm=` lines of the twelve
plan-proof launches
establish (the raw case draws no reapply block at all) is that
the sentence drawn matched the dictionary entry named — not that the model took that branch.

**6.3 Every one of the six authored expected-bytes files was compared, and each matched.** Unlike 4a
§6.3 and 3d-2a §6.3, this tree ships **no un-launched prediction fixture**: `editor-exact-expected.yml`,
`creator-front-expected.yml`, `deleter-exact-expected.yml`, `mover-exact-expected.yml`,
`duplicator-exact-expected.yml` and `third-r2.yml` were each `cmp`-ed by one of the twelve plan-proof
launches and each answered `MATCH`.
**That is a statement about the launches `launches/` holds, not about how many attempts preceded
them**: the manifests are post-images, so nothing retained would show a discarded attempt if there had
been one — and this step *did* discard three whole generations, which are retained precisely so the
statement above is checkable. What is also retained is P01, whose `bytes.txt` records `bytes=DIFFER`
against `editor-exact-expected.yml` — and that is evidence about the **driver**, not about the fixture:
**P01 failed at the sidebar lookup and left the final synthetic tree unchanged; it does not establish
whether any writer ran.** It is also the standing demonstration that `launch.sh` writes
`reached-end=yes` beside a `bytes=DIFFER` and conjoins nothing.

**That sentence used to say "so no writer ran", and correcting it is round 2's finding 4** — a
narrower recurrence of round 1's finding 7, which closed the same over-claim one section away in §4.3
and left this one standing. The two share one shape: *inferring that nothing ran from a final
filesystem state*. §6.1's paragraph above now states the general rule the two instances are cases of,
and this record has been swept for the **shape** rather than for the words of either finding; §10.4
lists what that sweep changed.

**6.4 Continuity with any earlier ledger is not established and cannot be.** No before-image of any
deleted tree survives, so nothing compares this `launch.sh`, these fixtures or either probe source with
what 2c-4c-5 ran, and §4.2 shows the digests differ for the two files this step has old digests for.
The claim this step can make is narrower and is the whole of it: **the retained executable P37–P48 ran
— `0a2d3506…`, still in every retained bundle, and equal to `target/debug/espansoconfig` when that
equality was read rather than now (§5.10) — reaches all six write surfaces,
draws the conflict arms those surfaces drew for the earlier readings, and produces the byte predicates
its case table names, on all twelve of its cases.**

**That is deliberately not "a tree rebuilt from the records reaches all six write surfaces."** No
retained artifact binds any executable here to a source snapshot or a build command, so a claim about
*the tree* is a conjunction of two readings that may not be conjoined: source inspection says the plans
are coherent, and the bundles say which bytes ran. **Source-to-binary provenance is unknown here.**

**6.5 Neither probe source was verified against anything.** Both are untracked, so git holds no
baseline, and no manifest of any earlier tree survives. *This `probe.rs` behaves as 4b's did* is **not**
a statement any artifact here supports; what is supported is that this one compiles, passes
`cargo fmt --check` and `cargo clippy --workspace --all-targets -- -D warnings`, leaves
`cargo test --workspace` at 1153, and drove **seventeen of the nineteen launches of the complete proof
set** to `--- end` with a zero-byte `probe.err` — the twelve plan-proof launches, the two static
confinement controls and the three adversarial ones. **The other two are N07 and N08, which wrote no
transcript at all**: a zero-byte `probe.log` is what §4.3 measures there, and it is the opposite of
reaching `--- end`, so the nineteen-launch set was never nineteen launches that reached it. **This
sentence claimed all nineteen until round 4** (§12.7).
**Neither probe source has a test of its own**, on either side of the wire:
`src-tauri/src/probe.rs` declares no `#[test]` and `src/probe.ts` has no spec file, so every rule in
either — the confinement, the strict plan parser, the exclusive writer — is checked only by a launch or
by reading. **Four review rounds have now found defects in the confinement — or in what this record
said about it — that no launch would have shown**, which is what that costs (§9.9, §10.1, §11.1,
§12.1), and
5b's own §8.2 item 7 is the standing note that a rule added to either file should come with a test.

**6.6 `probe_third_writer` is exercised now, and this replaces what this section said before.** The
earlier text said it was built and unexercised and asked 5b to treat it as untested code. **Finding 3
showed that was worse than it read**: `runThirdWriter()` was reachable from nothing but an
`export const thirdWriter = runThirdWriter`, written to defeat tree-shaking, and it **did not defeat
it** — `rg -c 'probe_third_writer' dist/assets/index-*.js` matched nothing in the retained bundle while
`probe_second_writer` matched once. The frontend third-writer path **was not in the bundle that search
read — the one that existed before round 1's fix**, which is the bundle the round-0 and intermediate
generations ran and not the one any launch of the complete proof set did; so 5b would have inherited a
path that could not be called at all. **That sentence said "the executable the proof set ran" until
round 4**, which was false of today's proof set and is one of §12.5's stale readings of that term.

It is now reached from the driver's own plan dispatch — `runCase('editor-third')` → `editorPlan`
→ `runThirdWriter()` — and the unused export is gone. Two things check it, and both are needed:
`rg -c 'probe_third_writer' dist/assets/index-*.js` answers **1** on the built bundle, and **P37 ran
it** and printed `--- writer third wrote=yes` before a second conflict against R2 (§4.1). Round 2
re-ran that search on the bundle its own nineteen-launch complete proof set launched and it still
answers **1**,
with
`probe_second_writer` still answering 1 as the control that makes the search non-vacuous.

**What is still not exercised**, stated so 5b does not read more into P37 than it holds: the third
writer's **empty-variable refusal** (`ECFG_PROBE_R2` is empty on the other eleven cases, and no plan
calls the third writer there, so that arm never runs), and its **confinement and exclusivity
refusals** — §4.4's and §4.5's five launches point the *second* writer at a refused path, never the
third, though both go through the same `replace_the_target` and therefore the same
`confined_target`, `confined_source`, `temporary_beside` and `copy_then_rename`.

**6.7 Nothing about recovery, restore or reload is in this instrument.** There is no
`[data-recovery-without-creation]` reporting, no recovery offer is asserted or pressed, no plan drives
an opened recovery form, no plan presses *Load the version on disk*, and `RestorePane` is never opened.
Those are 5b's, and §8 says what each costs. **P37–P48 nonetheless *drew* a recovery sentence on four
surfaces**, because `MatchDeleter`, `MatchMover`, `MatchDuplicator` and `RawEditor` mount
`RecoveryWithoutCreation` unconditionally (2c-4c-3b) and each of those launches had a conflict; what is
absent is that any of it entered a transcript. **None of §4's twelve rows is evidence about recovery
markup.**

**6.8 The geometry in this record is not comparable with any earlier record's.** §4.1's viewport is
`720x728 dpr=1` where every earlier record reports `1180x728 dpr=2`. Panel rectangles, reach numbers
and negative-`y` observations from this tree therefore say nothing about the ones 3c-2, 3d-2b or
2c-4c-5 recorded, in either direction.

**6.9 Nothing here is a reading, and no finding of any earlier reading was re-checked.** 2c-4c-5's
findings, including its geometry ones, are untouched by this step.

## 7. The gates, **with the harness in the tree**

**These are with-harness figures and are not production numbers.** Step 2c-5-7 re-derives the
production ones on a harness-free tree; carrying a with-harness figure forward as production is exactly
the defect that left `1623` standing in `PROGRESS.md` for three step records. Each row states its
arithmetic against the harness-free baseline `PROGRESS.md`'s "Next action" carries at 2c-5-4b.

| Command | With the harness | Harness-free baseline | Why it moved |
|---|---|---|---|
| `cargo test --workspace` | **1153** passed, 0 failed | 1153 | unmoved: `src-tauri/src/probe.rs` declares no test |
| `npm run check` | **432** files, 0 errors, 0 warnings | 431 | one more file for `svelte-check` to walk |
| `npm test` | **2124** passed, 56 files | 2123 | `src/probe.ts` is one more case of `scripts/lint/ipc-detail.test.ts`'s per-file `it.each` sweep |
| `npm run build` | **185** modules | 184 | one new `.ts` source module, and `src/probe.ts` has no `<style>` block |
| `cargo fmt --check` | clean | — | |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | — | |
| `cargo build -p espansoconfig --features custom-protocol` | finished, no errors | — | |

**All seven rows were re-run after each of the first four fix rounds**, and **every figure is unchanged
across those five readings**. The two rounds after them re-derived a **subset**, and this paragraph says
which rather than implying the whole table: **round 5** re-ran the four gate rows plus `cargo fmt
--check` and `cargo clippy` (§13.6), and **round 6**, which changed **markdown only**, re-ran the four
gate rows, `cargo fmt --check`, `cargo clippy` and the bundle oracle (§14.6), and **round 7 re-ran
exactly the same six rows plus the oracle** (§15.7). Neither round 6 nor round 7 ran the
`cargo build -p espansoconfig --features custom-protocol` row, which is why §1 and §12.7 no longer say
every round re-runs it. What is claimed across **all eight readings** is therefore narrower than "seven
rows every time": **no reading of any round has ever moved a figure in this table.** That is itself the expected result and not a surprise: no round
added a source module — `parsePlan`, `waitForOutcomeChange`, `resolve_existing_file`, `confined_target`,
`confined_source`, `temporary_beside` and `copy_then_rename` all live in the two files that already
existed, and **rounds 3, 4 and 5 changed no executable line at all**, only doc comments in the probe
sources and prose here, while **rounds 6 and 7 changed no file outside markdown** — so the module count
had no reason to move. It is recorded because an unchanged count that
was *predicted* to be unchanged is worth more than one nobody checked. **What the round-3 and round-4
readings are
*not*** is a re-measurement of anything a launch showed: no launch was re-run and none could have been
affected, because the compiled behaviour is unchanged. **What the round-4 reading did move is one thing
no row records**: re-running the `cargo build` row rewrote `target/debug/espansoconfig`, whose digest is
now `04988c09…` and no longer the proof generation's `0a2d3506…` (§5.10, §12.7).

**Round 2's own arithmetic is worth stating because it is the interesting case.** Round 2 *deleted*
code from `src-tauri/src/probe.rs` (`std::process::Command` and the shell body) and *added* code to it,
and touched only comments in `src/probe.ts` — comments the minifier strips. So the built bundle's
content hash is unchanged and the file is still `dist/assets/index-I5AFZyLL.js`, while the **Rust
binary's digest did change** (§5.10). Those two together are the reading: the frontend is byte-identical
across rounds 1 and 2, the backend is not, and that is exactly the shape of a fix confined to
`probe.rs`.

**The module count was predicted before the build and checked both ways**, which `CLAUDE.md` §6
requires and the number alone no longer decides. 185 was written down as 184 + 1 and the build answered
185 on **all eight readings** — this sentence said "all three" beside the paragraph above saying "all
four" (§12.7's fourth swept count), and then stood at "all five" through rounds 5 and 6, which each ran
the build again; **it is the same stale-count shape §14.2 closed in the preamble, found by the same
sweep and corrected at §14.7.** The rounds 5, 6 and 7 builds also emitted the **same**
`index-I5AFZyLL.js` named below, which is the frontend-byte-identity claim holding three rounds further
than §5.10 recorded it. The discriminating oracle over
`dist/assets/index-I5AFZyLL.js`, the bundle every launch of the complete proof set ran:

```
rg -c '\$\$payload|head_payload|push_element'   → no match (server-only sentinels ABSENT)
rg -c 'window\.__svelte|svelte-trusted-html'    → 2       (client-only constructs PRESENT)
```

The second line is what makes the first non-vacuous.

**A third search over that same bundle is what closed finding 3**, and it belongs beside these two
because it is the same kind of check — a claim about what is *in* the executable rather than about what
the source says:

```
rg -c 'probe_third_writer'   → 1   (was NO MATCH before round 1's fix; probe_second_writer → 1)
```

Both were re-run at round 2 on the same bundle file and both still answer 1, which is the check that
round-1 finding 3 has not regressed. **Rounds 3 and 4 each re-ran all four searches on that same
`dist/assets/index-I5AFZyLL.js`** — the file name is unchanged because their only frontend edits are
comments, which the minifier strips, and an unchanged content hash is itself the reading that says so —
and the answers are unchanged: the server-only sentinels absent,
the client-only constructs at 2, `probe_third_writer` at 1 and `probe_second_writer` at 1.

**An unmoved count is evidence of an unmoved count and of nothing broader**, and **no gate transcript
was retained**: these rows are this record's account of what the commands printed, re-checkable only by
running them again.

**One production behaviour did change, and the true statement is narrower than "none did."** With
`ECFG_PROBE_PLAN` absent, no plan-driven DOM action was observed and the final synthetic tree was
unchanged — §4.3 is what that measurement does and does not give. But **the instrumented build is not
the shipped one**: `register_with_probe` makes `probe_plan`, `render_probe`, `probe_second_writer` and
`probe_third_writer` **four extra callable IPC commands** on every launch, and `src/main.ts` calls
`startProbe()` unconditionally, so **every startup pays one extra IPC round trip**. Neither is inert,
neither was measured, and both are gone when step 2c-5-7 removes the harness. **Both fix rounds
narrowed what those four commands can do, and neither removed them**: §4.4 and §4.5 measured that the
writers refuse a path outside the harness tree, a path inside it that is not the synthetic file, and a
temporary someone else has taken — a smaller surface and not no surface, and one whose confinement is
**not proven against any of four rebindings**: the source's final component between its check and
`std::fs::read`, the temporary's name between `create_new` and `std::fs::rename`, an
ancestor-directory symlink swap **above the target**, and another **above the source**, `fixtures`
included (§4.5's last paragraph, §9.1, §10.1, §12.1).

## 8. What 2c-5-5b inherits, and what it must build

### 8.1 Inherited, working, and not to be rebuilt

- **The tree is `/private/tmp/espansoconfig-harness-2c-5/`.** 5b extends its case table and fixtures;
  2c-5-6 launches from it; 2c-5-7 deletes it.
- **The four harness paths stay in the working tree**: `src/main.ts` and `src-tauri/src/main.rs`
  modified by two hook lines each, `src/probe.ts` and `src-tauri/src/probe.rs` untracked.
  **Never `git commit -a` or `git commit -am`. Stage by path.**
- **Rebuild in §3's order after every driver edit**, and before the first launch depending on it.
  `npm run build` alone changes nothing — the bundle embeds `dist` at *cargo* build time.
- **`probe_third_writer` and `ECFG_PROBE_R2` already exist and are exercised**, on both sides: the Rust
  command, the `R2` column in `launch.sh`'s case table, the `R2PATH` that is empty when a row names no
  R2, `runThirdWriter()` in `src/probe.ts`, the `editor-third` case that calls it, and
  `fixtures/third-r2.yml`. **P37 ran it and the bundle contains it** — §6.6 is what is still untested
  about it, which is its empty-variable arm and its own confinement refusals.
- **Both external writers are confined, and 5b must know exactly how far that goes — including that
  four residual holes come with the inheritance.** What **is** forced, each item with what carries it:
  a target resolving **outside the launches root** is refused (**measured** — C05 a path spelled
  outside the tree, C09 a symlinked target resolving outside it); a target **inside** the launch tree
  that is not exactly `…/launches/<launch>/xdg/espanso/match/conflict.yml` is refused (**measured** —
  C10, and that is the launch that measures the *exact-shape* rule; C05 and C09 never reach it); the
  source must resolve **beneath `…/fixtures`** (**measured** — C06, whose decoy is outside the harness
  root); the source must be a **direct child** of `…/fixtures` rather than nested beneath it
  (**source construction, unmeasured** — no launch here points a writer at a nested regular file under
  `fixtures`); a plan is required (**source construction,
  unmeasured** — §4.3 says no launch exercises it); **no shell runs in either writer**, so no exit
  status can mask a failed copy and no *second process* re-resolves the checked names (**source
  construction**); and no pre-existing entry may stand at the temporary's pathname when `create_new`
  runs (**measured** — C07 plants a symlink at the exact temporary path and the writer refuses with
  `File exists` instead of writing through it). Every one of those is a check **at one instant**.
  **What is NOT forced, and 5b inherits all four as open:** the source's final component may be
  rebound between the check and `std::fs::read`, which resolves that pathname again; the temporary's
  name may be rebound between `create_new` and `std::fs::rename`, which resolves that pathname again
  rather than spending the handle; an **ancestor directory of the target's pathname** — the launch
  tree — may be replaced
  with a symlink between the canonicalization and the create-or-rename; and an **ancestor directory of
  the *source's* pathname**, `…/fixtures` itself being the nearest, may be replaced the same way
  between `confined_source` and `std::fs::read`. **`fixtures` is a sibling of `launches`, so the third
  item never covered the fourth** — this bullet said three until round 4 (§12.1, §12.3). **All four are
  one shape — a
  name checked at one instant and spent at another — none is constructed here, and `std` offers no
  pinned-directory (`openat`-style) primitive that would close any of them.** They are accepted because
  the launch root sits beneath an operator-controlled `/private/tmp` path, the instrumented binary is
  never shipped, and 2c-5-7 deletes it — **none of which is a proof, and 5b must not read it as one.**
  **Until round 3 this bullet told 5b there was "no second pathname resolution"; there are two, and
  each of them walks every directory above it as well, which is what the two ancestor items are.**
  `HARNESS_ROOT` in `src-tauri/src/probe.rs` is a **compile-time constant that must agree with
  `launch.sh`'s own `HARNESS`**. Moving the tree means editing both; a mismatch makes every writer
  refuse. §4.4 and §4.5 are the measurements, `confine.sh` and `adversary.sh` are how to re-take them.
- **If 5b seeds any file a writer must replace, it must sit at that exact path.** The target rule is
  now the file, not the directory: a restore case that wants an external writer to move a *different*
  document has to widen `TARGET_TAIL` in `src-tauri/src/probe.rs`, and widening it back to "anything
  beneath `launches/`" undoes what round 2's High bought.
- **The plan string is `<case>[:en|es]` and nothing else.** Both `launch.sh` and `parsePlan` refuse
  anything wider, including a third segment. A 5b case name goes in **three** places — `launch.sh`'s
  case table, `runCase`'s switch and a plan function — and only the first two refuse an unknown name.
- **The driver's shared machinery**: `say`, `pause`/`settle`, `waitFor`, `pressNamed`, `pressText`,
  `pressRow`, `typeInto`, `outcomePanelOf`, `outcomeTextOf`, `waitForOutcomeChange`, `reapplyPanelOf`,
  `reportViewport`, `reportConflict`, `reportReapply`, `reportReadiness`, `reportReach`, `scrollerOf`,
  `reportFinal`, `pickLanguage`, `openFile`, `openSnippet`. All of these are surface-agnostic and take a
  scope. **`waitForOutcomeChange` is the one to use after a *second* send**: `reportConflict` returns on
  the first panel holding a hexadecimal run, which can be a stale one. On this build the reapply clears
  the outcome panel first — P37 printed `outcomePanel=absent` — but that is a measurement of this build,
  not a property to rely on, which is why the transcript prints it every time.
- **None of the three manifests may be regenerated**; append, or write a `2c-5-5b` one (3d-2a §8.5 is
  what regenerating one destroyed). Expect the round-0 manifest's four failing entries and the round-1
  manifest's three to keep failing — §5.9 says which and why.
- **`ECFG_PROBE_TEMP_NAME` exists and only `adversary.sh` sets it** (§5.18). A 5b script that does not
  set it gets the generated per-call name, which is what every proof launch used.

### 8.2 What 5b must build

1. **Backup-root fixtures.** Nothing in this tree writes a `.espansoconfig-backups` directory *before* a
   launch — the five positive cases produce one **during** the launch, which is why they answer
   `backups=PRESENT`, and that is a by-product rather than a seeded catalogue. A restore case needs a
   seeded backup tree under the config root with at least one batch folder and one entry, written by
   `launch.sh` before the `open`, and copied into `xdg-before/` with the rest. `crate::backup` and
   `crates/espansoconfig-core/src/persist/backup.rs` are where the layout is decided; read them rather
   than inferring it from a `backups=PRESENT` line.
2. **The `RestorePane` drive, and its scope.** The pane is `section.restore`
   (`RestorePane.svelte:609`). Its **outcome panel is a direct child** of that section
   (`:898`), so `outcomePanelOf('section.restore')` works exactly as it does for the other six
   surfaces, and there is **no `.panel.reapply` on this surface at all** — a restore has no reapply, so
   `reportReapply` must not be called for it and a plan that calls it will time out and print
   `--- failed`. The pane draws four `section.step` blocks (`:632`, `:704`, `:765`, `:805`); a lookup
   inside one of them must be scoped to that step, because the batch list, the entry list and the
   candidate block each draw rows of their own.
3. **The catalogue / entry / candidate / prepare / replace states**, each with the launch that reaches
   it — this step's acceptance criterion applies to 5b's rows too. The controls are
   `browser.restore.listBatches` and `browser.restore.relistBatches` (`:645`, `:646`),
   `browser.restore.prepare` (`:851`), `browser.restore.confirm` (`:842`) and `browser.restore.cancel`
   (`:845`); the states that draw no control are `browser.restore.batchesLoading`,
   `browser.restore.batchesNone`, `browser.restore.batchesIncomplete`, `browser.restore.batchesSkipped`,
   `browser.restore.entriesLoading`, `browser.restore.entriesNone`, `browser.restore.entriesRefused`,
   `browser.restore.entriesIncomplete`, `browser.restore.entriesSkipped`, `browser.restore.listedAgrees`
   and `browser.restore.listedUnreadable`. A batch row and an entry row are named by the file, not by
   the dictionary, so they are `pressText`/`pressRow` lookups scoped to their own `section.step`.
4. **The byte oracle, extended over the backup tree.** `launch.sh` today `cmp`s **one** file — the
   target — and searches for `.espansoconfig-backups` as a yes/no. A restore case needs more: the
   restored file compared against the entry's own bytes, **and** the backup tree compared against its
   pristine copy, because a restore is a whole-file replacement that itself takes a backup and must not
   disturb the batch it restored from. `tree.diff` already diffs `xdg-before/` against `xdg/` whole, so
   the cheapest extension is a second `cmp` line in `bytes.txt` plus a `backup-tree=` line, and **the
   script must still conjoin none of them.**
5. **A restore conflict, if 5b wants one.** Restore is a content path on `saveRawDocument`, so its
   conflict is the raw editor's; the second writer is enough to provoke it, and the third writer is for
   a form that has already drafted against R1. **`editor-third` is the worked example** — §4.1's first
   bullet is the shape, and its `EXPECT=third-r2.yml` is why its byte line discriminates the writer
   rather than merely agreeing with R1.
6. **Whatever recovery reporting 5b's own scope needs.** §6.7 is the standing statement that none of it
   is here. `2c-4c-4b-instrument.md` §3.2 describes the five reporters that were built for it, and
   `2c-4c-5b-1-instrument.md` §2 describes the geometry reporter; neither is in this tree.
7. **A test, if 5b adds any rule to either probe source.** §6.5 records that neither file has one, so
   every rule in them is carried by a launch or by reading. That was affordable for a driver; it is
   less so for a confinement.

### 8.3 What 2c-5-6 needs, and what 2c-5-7 needs

- **2c-5-6 owes both languages on every surface** (§4's coverage is aggregate, not per-surface), and it
  owes its own geometry: §6.8 means it cannot carry any earlier record's rectangles forward.
- **2c-5-7 must re-derive `1153 / 431 / 2123 / 184` on a harness-free tree** and must not copy §7's
  `1153 / 432 / 2124 / 185`. It removes `src/probe.ts`, `src-tauri/src/probe.rs`, the four hook lines
  and `/private/tmp/espansoconfig-harness-2c-5/`; `2c-4b-3d-3-notes.md` §1.1 is the method, including
  why `git checkout --` needed two observations rather than its name.
- **2c-5-7 must also delete the nine decoy files `confine.sh` and `adversary.sh` left outside the
  tree**: `/private/tmp/espansoconfig-probe-decoy-C01.yml` through `…-C09.yml`. They are outside
  `$HARNESS` by design (§4.4, §4.5), so deleting the harness directory does not reach them, and
  `rm -rf` on the harness path alone would leave them behind. **C07's launch directory also holds a
  symlink into one of them** (`launches/C07/xdg/espanso/match/conflict.yml.probe-tmp-adversary-C07`),
  and `launches/C09-plant/xdg/espanso/match/conflict.yml` is another; both go with the tree.

## 9. Disposition of the eight round-1 review findings

`docs/reviews/phase-2c-5-5a-instrument.md` returned **NOT READY on eight findings**. Each is named
here with what was done and what was measured. **Two of them were closed by re-running rather than by
rewording**, which is this project's precedent; one was left alone deliberately; §9.9 records a
defect round 1's own self-review found and did **not** close; **§10 is round 2, which found that
§9.1's and §9.2's closures were both overstated**; and **§11 is round 3, which found that §9.1's and
§10.1's *corrected* closures were still overstated and that §9.1's "closed and measured" bucket held
two unmeasured items**; **§12 is round 4, which found a fourth residual rebinding none of those
lists named and a per-item label that credited C06 with a rule no launch exercises**; **§13 is round 5,
which closed the residual list at four by enumerating from the code and confirmed every §9.1 label
against its evidence**; and **§14 is round 6, which found no instrument defect at all and three stale
prose claims, one of them this paragraph's own**; and **§15 is round 7, which found no instrument defect
either and three more prose claims, including that §14's own replacement for an exhaustiveness claim was
still one.** Where the seven
disagree, the later section is the later reading, and **§15** is the latest.

**9.1 High — the writers were not confined (`replace_the_target`).** **Partially closed at round 1;
narrowed further at round 2; narrowed again at round 3, which found that two more arms were open and
had been described as closed; narrowed once more at round 4, which found a fourth open arm and a label
that over-credited a launch. Four arms remain open and are stated as open.**

**Every item below carries its own label, because round 3's prose finding 2 was that a bucket headed
"closed and measured" held two items nothing measures.** No item here has a label true of only some of
what it claims; each line says *measured by which launch* or *closed by source construction,
unmeasured*, and where a rule has a measured half and an unmeasured one it is **two lines**. **Round 4
found that two of these lines still failed that test** — one crediting C09 with the exact-shape rule it
never reaches, one crediting C06 with the direct-child rule no launch exercises — which is round 3's
finding 3 recurring narrower, and §12.4 is the record of it.

**What is forced, item by item:**

- **A plan is required** — `replace_the_target` returns *"refused: the … writer will not run without
  ECFG_PROBE_PLAN"* before it reads any other variable. **Closed by source construction, unmeasured**:
  §4.3 says plainly that **no launch exercises this refusal**, because the driver has no way to call a
  writer without a plan.
- **A target that resolves outside the launches root is refused**, at the instant of the check.
  **Measured by C05** (§4.4, a path spelled outside the tree) and **by C09** (§4.5, a symlinked target
  resolving outside it). Both quote `strip_prefix`'s *"is not beneath …/launches"* refusal, which is the
  first half of the target rule and the only half either of them reaches.
- **A target *inside* the launch tree must be exactly
  `…/launches/<launch>/xdg/espanso/match/conflict.yml`**, at the instant of the check — round 1 required
  only "beneath `…/launches`", and round 2 tightened it to the file. **Measured by C10** (§4.5), a real
  file inside the launch tree that is not the synthetic one, refused *by name*. **C10 is the only launch
  that reaches the shape check**; this line credited C09 with it as well until round 4 (§12.4).
- **The source must resolve beneath `…/fixtures`**, at the instant of the check. **Measured by C06**
  (§4.4), which points `ECFG_PROBE_R1` at a decoy outside the harness root and quotes
  *"is not beneath …/fixtures"*.
- **The source must be a *direct child* of `…/fixtures`**, not a document nested deeper
  (`src-tauri/src/probe.rs:352-358`). **Closed by source construction, unmeasured**: C06's decoy is
  outside the harness root, so it never exercises this rule, and nothing in this harness ever points a
  writer at a nested regular file beneath `fixtures`. **§9.1 credited C06 with this until round 4**
  (§12.4).
- **No pre-existing entry may stand at the temporary's pathname when `create_new` runs** —
  `O_CREAT|O_EXCL`, which fails on any entry at all, symlink included. **Measured by C07** (§4.5),
  which plants a symlink at the exact temporary path and quotes *"File exists (os error 17)"*.
- **No shell runs in either writer.** **Closed by source construction, unmeasured as such**: no launch
  distinguishes a shell from its absence; what the source shows is that no `std::process::Command`
  remains, so there is no exit status left to mask and no *second process* re-resolving the checked
  names. That was round 2's High and no static control could have caught it.
- **The third writer is confined by the same code.** `probe_third_writer` and `probe_second_writer` are
  one call of `replace_the_target`, hence one `confined_target`, `confined_source`, `temporary_beside`
  and `copy_then_rename`. **Closed by source construction, unmeasured**: §4.4 and §6.6 both say that
  C05, C06, C07, C09 and C10 point the **second** writer at a refused path and never the third.

**What is NOT forced, in the same breath as the above — four residual rebindings, all open:**

- **The source's final component.** `confined_source` approves a canonical pathname and
  `std::fs::read` **resolves that pathname again**, so the bytes installed are the bytes that name held
  at the read, not necessarily those of the object the check approved.
- **The temporary's name after `create_new`.** Exclusivity was obtained for the file this process
  opened; the handle is then dropped and `std::fs::rename` resolves the **name** a second time, so an
  entry rebound at that name between the two is what gets installed.
- **An ancestor directory of the target's pathname** — the launch tree — replaced with a symlink
  between the canonicalization and the create-or-rename that follows it.
- **An ancestor directory of the *source's* pathname**, `…/fixtures` itself being the nearest,
  replaced with a symlink between `confined_source` and the `std::fs::read` that walks it again.
  `fixtures` is a **sibling** of `launches`, so "an ancestor directory of the launch tree" never
  covered it, and this list said three until round 4 found the fourth (§12.1).

**All four are the same check-and-spend shape, none is constructed by any control here, and `std`
offers no pinned-directory (`openat`-style) primitive that would bind a check to the object it
approved.** They are *accepted* for the three reasons §4.5's last paragraph gives — operator-controlled
`/private/tmp` launch root, a binary that is never shipped, and step 2c-5-7 deleting both — and
**acceptance is not proof**. **Until round 3 this section named only the ancestor arm** — it
called the temporary-name arm closed by construction and did not name the source arm at all; **until
round 4 the ancestor arm was written as the launch tree's alone.** All four are
**open and disclosed**, and rounds 3 and 4 each withdrew a claim rather than closing a hole.

**9.2 Medium — the writer was not atomic (`cp …; mv …`).** **Closed as to what the finding named, and
not one word wider.** Round 1 changed the shell body to `cp … && mv …`; round 2 **deleted the shell
altogether**, which subsumes the finding by construction: there is no exit status left to mask, because
there is no second process. The writer now reads the source in Rust, opens the temporary with
`create_new` (`O_CREAT|O_EXCL`), writes, `sync_all`s, and `rename`s — and a `rename` replaces the final
component itself rather than writing through it, so the target is never seen half-written. **What is
closed is the masking and the partially-written target. What is not closed is that the install spends a
*name*** — `rename` resolves the temporary's pathname a second time rather than the handle
`create_new` returned — and the read spends the source's name the same way; §9.1 lists both, **and the
two ancestor cases those re-resolutions walk**, as open (rounds 3 and 4). A failed run *attempts* to remove the temporary and **discards whether that worked**, stated
in `copy_then_rename`'s own documentation, because the first failure is the one worth reporting.

**No launch of this tree exercised a failing read or a failing write.** What C07 exercises is the
`O_EXCL` refusal. And the "no `.probe-tmp-…` file exists anywhere under `launches/`" reading this
section used to offer is **not** evidence that no temporary was ever created: a temporary that was
created and renamed away leaves exactly that absence, which is the whole point of the design. The
honest reading is that **`rg --files` over `launches/` finds no leftover temporary regular file** —
and that sweep does not list symlinks, so C07's deliberately planted one is known to be there from a
direct `ls` and not from the sweep.

**9.3 Medium — the third-writer path was tree-shaken out of the bundle.** Closed **by making it
reachable and running it**, not by disclosure, because 5b depends on it. §6.6 is the full account: the
`export const thirdWriter` that was supposed to prevent tree-shaking did not, `runThirdWriter()` is now
reached from `runCase('editor-third')`, the export is gone, `rg -c 'probe_third_writer'` answers **1**
on the built bundle, and **P37 ran it** (§4.1). Its `EXPECT` is R2, so its `bytes=MATCH` fails if the
writer fails. **Round 2 re-checked both halves and both still hold** (§7).

**9.4 Medium — the plan parser was lax.** Closed. `parsePlan` accepts exactly `<case>` or
`<case>:en` or `<case>:es` and throws on an unknown language token, an empty case or a third segment;
`launch.sh` refuses the same shapes before assembling anything (exit 68, verified). A missing language
is **supported and reported** rather than silently defaulted: every transcript prints
`--- plan case=… requested=en|es|absent`. This matters for 2c-5-6 because the WebKit data store follows
the bundle identifier every probe bundle shares, so a language a plan fails to name is the previous
launch's language until the picker runs.

**9.5 Low — `render_probe` discarded its I/O errors.** Closed as to the code: both `writeln!` and
`flush` are mapped and returned. **The claim that came with it was still overstated, and round 2's
finding 3 is that** — this paragraph used to say a mid-plan failure "becomes `--- failed`". It does
not. A mid-plan write failure reaches the driver as a rejected `invoke`, and `startProbe`'s catch
**attempts** to emit `--- failed` **through another `say`**; if stdout is still unavailable that call
rejects too and `--- end` is never reached. So **any transcript I/O failure may leave a silently
truncated log**, mid-plan or on the last line alike, and a truncated transcript is indistinguishable
from a plan that stopped early. That is now what `render_probe`'s documentation says, what `say`'s
says, and what `startProbe`'s says about the absence of `--- end`.

**9.6 Observation — the negative cases' byte oracle.** **Left alone, deliberately.** The review said
the record already discloses the limitation correctly, and it does: for the `nowrite` rows `EXPECT`
equals R1 by design, so `MATCH` proves final bytes and not the absence of an identical or transient
write. Nothing here was reworded. §6.1's inherited paragraph is where it lives. **One new row is
different in kind and is not covered by that disclosure**: `editor-third`'s `EXPECT` is R2, which no
application path produces, so its `MATCH` discriminates the third writer having run.

**9.7 Medium — the "inert" claim over-reached.** Closed. §4.3 is rewritten: its heading no longer says
"inert", it states exactly what the two launches give (no transcript line, zero `tree-diff`,
`target-unchanged=yes`, from a live window), it says in its own words that this **cannot exclude an
identical or transient write** and does not attribute "no writer was spawned" to them, and it records
that the hooks register four extra IPC commands and pay one startup IPC round trip. **N07's and N08's
`alive-at-kill=yes` is kept as the positive control it genuinely is.** The same over-claim was swept
out of `probe_plan`'s and `startProbe`'s documentation, and `inert.sh`'s header now says its file name
is historical.

**9.8 Medium — P02's provenance.** Closed **by measuring, not by softening**. P02's retained
`bytes.txt` had **eleven** lines, the last a bare `0`, where the current output block emits ten — the
byte pattern `$(grep -c … || echo 0)` leaves when the count is zero, which the current script documents
avoiding. That identifies a *plausible* earlier script image and is **not** a retained artifact of one:
no image that produced P02 survives, so its provenance stays unknown. It does not matter any more,
because **P02 is not among the twelve plan-proof launches**: `editor-exact` was re-run under the current script and the
current binary — as P26 at round 1, and again as **P38** at round 2 — and **all twelve plan-proof
launches have a ten-line `bytes.txt` with the same ten keys in the same order** (§4). P02 is retained,
unaltered, as a superseded artifact.

**9.9 What round 1 found in its own work and how it was handled.** Two corrections came out of
re-reading the fix before freezing it, and both are the reason an intermediate generation exists
(§1): a doc comment claiming the temporary file *"is removed on a failed run"* when the removal's
result is discarded, and a doc comment asserting that the first conflict's panel *"is still drawn"*
when the second send is clicked — **which turned out to be false**. The second was replaced by a
measurement rather than by a hedge: the driver now prints
`editor beforeSecondSave outcomePanel=present|absent`, and P25 answered **absent**, as P37 did again.
**One defect was found and deliberately not closed**: `launch.sh` interpolates `$NAME` into a path, and
while all four scripts refuse a name outside `[A-Za-z0-9_-]+` (§5.17), that guard is a typo guard and
no launch measures it beyond the one refusal quoted in §3. It is not an instance of finding 1's risk
class — the argument comes from whoever runs the script, never from IPC — and it is recorded here
rather than presented as a boundary.

**9.10 What the manifests say about round 1's blast radius.** After the round-1 fixes, **36 of the
round-0 manifest's 40 entries still verify**, and the four that fail are exactly `launch.sh`,
`inert.sh`, `src/probe.ts` and `src-tauri/src/probe.rs`. That is a real reading of retained artifacts
and it is the strongest statement available about what that round did not touch — **but it covers only
the 40 files that manifest names**, and it is silent about everything else in the repository. The
four-path `git status` in §1 is the other half, and neither is a before-image.

## 10. Disposition of the four round-2 review findings

`docs/reviews/phase-2c-5-5a-instrument-round2.md` returned **NOT READY on four findings**. One is a
real defect in `probe.rs` — a TOCTOU §9.1 had called closed — and the other three are places where this
record claimed more than its artifacts give. Each is named here with what was done, what was measured,
and what is deliberately left open. **§11 is round 3, and it revised 10.1, 10.2 and 10.4 in place**:
Arm A was partially closed rather than closed, §9.1's corrected buckets still mislabelled two members,
and §6.1's rule did not reach two of the five instances §10.4 said it governed. **§12 is round 4, and
it revised 10.1 and 10.2 again**: Arm B is two ancestor cases and not one, and §9.1's per-item labels
still over-credited two launches.

**10.1 High — the TOCTOU in `replace_the_target`.** **Two arms, and they got different treatment —
and round 3 found that Arm A was partially closed rather than closed, so what stands now is one
measured closure and *four* open rebindings, the fourth being round 4's.**

*Arm A — the temporary-file race. **Partially closed, and round 3 is why this no longer says "fixed
properly".*** `temporary_beside` used to test the path with `symlink_metadata` and then let `/bin/sh`'s
`cp` open the same pathname; a symlink inserted between those two operations was followed, so an
outside file could be overwritten through a path that had passed every check. **The shell is gone from
both writers.** `copy_then_rename` reads the source with `std::fs::read`, creates the temporary with
`OpenOptions::new().write(true).create_new(true)`, writes, `sync_all`s, and then `std::fs::rename`s.

What that **forces**: `O_CREAT|O_EXCL` fails on a path that exists *at all*, symlink included, so **no
pre-existing entry stood at the temporary's pathname when this process took that name** — the
pre-open insertion race is defeated outright rather than narrowed, and **C07 is the measurement**, a
symlink planted at the exact temporary path and the writer answering *"could not create the temporary …
exclusively: File exists (os error 17)"* with the decoy unchanged. `temporary_beside` now *chooses a
name and checks nothing*, which is the point: exclusion moved to the one place taking a name is atomic.
**This subsumes round-1 finding 2 by construction** — there is no exit status left to mask, because
there is no second process.

What it does **not** force, and round 3's Medium is exactly this: the install spends a **name**, not the
handle. After `write_all`/`sync_all` the handle is dropped and `std::fs::rename(temporary, target)`
resolves the temporary's pathname a second time, so an entry rebound at that name in between is what
gets installed. The **source** carries the same shape one step earlier — `confined_source` approved a
canonical pathname and `std::fs::read` resolves it again, so outside bytes can be installed through a
name that passed every check. **C07 measures neither of these**: it measures only a symlink already
present when `create_new` runs. Both are **open and disclosed**, listed beside Arm B in §9.1 and in
`src-tauri/src/probe.rs`'s own module note. **And both re-resolutions walk every directory above the
name as well**, which is why Arm B below is two cases rather than one (§12.1).

*Why round 3 was answered by reclassifying rather than by new code.* Binding validation, creation and
installation to pinned objects needs `openat`-style descriptor-relative primitives, which `std` does not
offer; writing them with `libc` here would be new, unproven cleverness in a file that is temporary,
never shipped and deleted at 2c-5-7 — which is the kind of change that produces the next round's
finding. The context is **acceptance, not proof**, and this record says so rather than calling the arm
closed.

*Arm A also — the target is constrained to the exact synthetic file.* `confined_target` now requires
the canonical target, **at the instant of the check**, to be
`…/launches/<launch>/xdg/espanso/match/conflict.yml`, five components with four of them fixed, rather
than anything beneath `…/launches`; `confined_source` requires the source, at that same instant, to be
a document *directly inside* `…/fixtures`. **C10 is the measurement of the target half and of nothing
else**: a real file beneath the launch
directory, refused by name. **The source half is measured only as far as *beneath* `…/fixtures`** — C06,
whose decoy is outside the harness root — and its *direct-child* rule is source construction that no
launch exercises (§9.1, §12.4); this paragraph read as though C10 carried both until round 4. What a
rule over a pathname forces is the shape it had when it was
resolved, which is why the two paragraphs above and the one below are the rest of the sentence.

*Arm B — the ancestor-directory symlink swap, **which is two cases and was written as one until round
4**. **Disclosed, not attempted, and not closed — and since round 3 no longer the only residual**, the
others being the source and temporary rebindings above.*
If something replaces a directory **above the target** with a symlink between the canonicalization
and the create-or-rename, nothing in this instrument catches it. **The same is true of a directory
above the *source*** — most directly `…/fixtures`, which `std::fs::read` walks again after
`confined_source` approved the name, and which is a **sibling** of `launches` and so was never covered
by "above the launch tree" (§12.1, §12.3). Defeating either needs `openat`-style
pinned directory handles, which `std` does not offer; provoking either needs a second process racing a
live launch, which this harness cannot spawn. **Confinement is therefore not proven against an
adversarial ancestor swap on either path, and this record does not claim it is impossible, unreachable
or closed.** It is
*accepted* for three stated reasons — the launch root is created by `launch.sh` beneath an
operator-controlled `/private/tmp` path, the instrumented binary is never shipped or signed, and step
2c-5-7 deletes both — and **none of the three is a proof**. §4.5's last paragraph and §8.1 carry the
same statement where a reader of either will meet it.

*The adversarial controls, and the part that could not be constructed.* `adversary.sh` is new and runs
three modes: C07 (a symlink at the temporary), C09 (a symlinked target) and C10 (a wrong path inside
the tree). **C08 is the retained attempt that did not work**: it replaced the launch's *own*
`conflict.yml` with a symlink, and the plan never reached the writer — the sidebar row for
`match/conflict.yml` never arrived, so **C08 establishes a sidebar timeout and nothing about any
writer**. C09 is the working construction, with the symlink in a sibling launch directory so the
application still opens an ordinary file. The **two ancestor swaps are the part that could not be
constructed** — above the target and above the source alike — and that is said here rather than
omitted.

**10.2 Medium — §9 over-claimed closure.** Corrected, **corrected again at round 3, which found
that round 2's own correction still over-claimed, and corrected once more at round 4.** §9.1 labels
**every item individually** —
*measured by which launch*, or *closed by source construction and unmeasured* — rather than grouping
them into buckets whose heading is true of only some members; it listed **three** open rebindings
where round 2 listed one, and **round 4 made that four** (§12.1). Round 4 also split two of the
individual labels, because *measured by C09* and *measured by C06* were each true of only part of the
rule they sat beside (§12.4). §9.2 says the shell removal subsumed round-1 finding 2 rather than that
`cp … && mv …` fixed it. §8.1 tells 5b the same thing in the same words: exactly what the confinement
forces, what it does not, and that **all four residual rebindings are open and unproven**. Round 2's
specific complaint was that §8 told 5b the truth about the third writer but not about the confinement it
inherits; that gap is what §8.1's rewritten bullet closes, and round 3's and round 4's are what its
second half now adds.

**10.3 Low — the `--- failed` reporting claim.** Corrected in all four places that carried it:
`render_probe`'s doc comment, `say`'s, `startProbe`'s and §9.5. The driver **attempts** to emit
`--- failed`; the attempt goes through another `say`, so a transcript channel that is still unavailable
makes that call reject too and `--- end` is never reached. **Any transcript I/O failure may leave a
silently truncated log.** `startProbe`'s doc now also says that the *absence* of `--- end` does not
discriminate between a plan that stopped early and a transcript that could not report its own failure.

**10.4 Medium — the narrower recurrence of the absence over-claim, and the record-wide sweep.** §6.3
now reads exactly as round 2 asked: *"P01 failed at the sidebar lookup and left the final synthetic
tree unchanged; it does not establish whether any writer ran."* **That is the smaller half of this
finding.** The larger half is that round 1's finding 7 closed the identical shape at §4.3 and left this
one standing one section away, so the whole record was swept for the **shape** — any sentence inferring
*no write happened*, *nothing ran*, *nothing was spawned* or *absence is unambiguous* from a final
filesystem state, a zero-byte log, a byte match or a search that found nothing. What the sweep changed:

- **§6.1** now states a general rule the instances are cases of. **Round 3's finding 3 was that the
  rule it stated at round 2 was too narrow to be the one §10.4 claimed**: *no artifact can distinguish
  "no write" from "an identical or transient write"* governs §9.2's and §§4.4–4.5's readings, but the
  two §1 instances are **chronology and scope limits**, not no-write equivalence — present absence
  cannot say *when* a tree went, and a string search over selected files cannot say what an unread file
  holds. §6.1 now states the wider rule — **an absence observation is bounded to the time, the corpus
  and the predicate it was taken over, and proves nothing about any wider history, corpus or
  predicate** — with the no-write equivalence named as this harness's own special case of it. That
  wider rule does govern all five; the round-2 one governed three.
- **§9.2** dropped *"no `.probe-tmp-…` file exists anywhere under `launches/`"* as evidence of anything
  about temporaries: a temporary created and renamed away leaves that same absence by design. What is
  left is the narrower reading, plus the note that `rg --files` does not list symlinks.
- **§4.4** and **§4.5** now say that `decoy=unchanged` is a reading of final bytes and that what
  carries each row is the **quoted refusal line**, which is a positive observation. `confine.sh`'s and
  `adversary.sh`'s own headers say the same.
- **§1** narrowed two: the deleted 2c-4c tree *"does not exist **now**"* is a reading at one moment and
  not evidence about when it went; and the owner-home-path sweep *"finds nothing"* in **those** files
  for **that** string, which is not a proof that no retained artifact holds anything of the owner's.
- **§4.3** was already correct after round 1's finding 7 and was left as it stood, with N05/N06
  renamed to N07/N08.

**Nothing was swept by searching for the words of any finding**, which is how round 1 left §6.3
standing.

**10.5 What round 2 changed, and what the manifests say about it.** Three files: `src-tauri/src/probe.rs`
(the writer), `src/probe.ts` (three doc comments, no executable change) and `confine.sh` (its header).
One file is new: `adversary.sh`. **Measured, not asserted**: `shasum -a 256 -c
manifest-2c-5-5a-fix-post.sha256` now reports **75 of 78 verifying**, and the three that fail are
exactly `confine.sh`, `src/probe.ts` and `src-tauri/src/probe.rs`. **`launch.sh` and `inert.sh` still
verify against the round-1 manifest**, which is the reading that says the script that produced the
twelve plan launches is the same one round 1 froze. `manifest-2c-5-5a-round2.sha256`, 55 entries, is
this round's post-image and all 55 verify. As always, **all three are post-images**: none can establish
what was not altered, and the `git status` in §1 is the other half.

## 11. Disposition of the five round-3 review findings

`docs/reviews/phase-2c-5-5a-instrument-round3.md` returned **NOT READY on five findings**. **Four of
the five are this record — or a doc comment in the instrument — claiming a guarantee the code does not
give**, which `CLAUDE.md` names as this project's worst defect class and the one no test can fail. The
fifth is a count contradicting the section that measured it.

**Round 3 changed no executable line.** Every fix below rewrites a doc comment or a paragraph;
`src-tauri/src/probe.rs`'s and `src/probe.ts`'s compiled behaviour is byte-for-byte the behaviour the
complete proof set ran. **No launch was re-run and no new measurement is claimed anywhere in this section** —
the only commands run were the seven gates of §7 and the four bundle searches beside them, all of which
answered exactly what they answered at round 2.

**11.1 Medium — the instrument's doc comments claimed a confinement the code does not force.**

*What it claimed.* The module note, `confined_target`'s contract and `copy_then_rename`'s contract each
said that `create_new` closed the temporary-file race and that `rename` safely replaces the final
component, with **an ancestor-directory swap as the only unproven case**.

*What was actually true.* The exact-target-shape check and the pre-existing-temporary exclusion are
real, and C10 and C07 measure them. But the code does not bind the later operations to the objects it
checked. After `write_all`/`sync_all` the handle is dropped and `std::fs::rename(temporary, target)`
**resolves the temporary's pathname again**, so a racer who rebinds that name between the open and the
rename gets the *replacement entry* installed rather than the bytes this process wrote. The source has
the same shape: canonicalized and checked by `confined_source`, then **reopened by pathname** at
`std::fs::read`. C07 measures a symlink *already present* when `create_new` runs and neither later
re-resolution.

*What changed, and what did not.* **The classification, not the code.** The review offered two branches
and this fix takes the second: no `libc`/`openat` descriptor-relative primitives were added, because
this is a temporary instrument deleted at 2c-5-7 and unproven new cleverness on the one path where
being wrong is worst is exactly what would produce round 4's finding. Every doc comment in
`src-tauri/src/probe.rs` that touched confinement now states, **in the same sentence, what is forced and
what is not**: the module note, `TARGET_TAIL`, `TEMP_NAME_VARIABLE`, `resolve_existing_file`,
`confined_target`, `confined_source`, `temporary_beside`, `copy_then_rename` and `replace_the_target`.

*What is forced:* the exact target shape — a canonical target of exactly
`<launch>/xdg/espanso/match/conflict.yml` beneath the canonical launches root, **at the instant of the
check** — and the exclusion of a **pre-existing** entry at the temporary's pathname via `create_new`'s
`O_EXCL`, which C07 measures.

*What is **open and disclosed**, and was not closed by this fix:* source final-component rebinding
between `confined_source` and `std::fs::read`; temporary-name rebinding between `create_new` and
`std::fs::rename`; ancestor-directory rebinding **above the target** between canonicalization and the
rename; and — **added at round 4, which found that this list was written as exhaustive and was not** —
ancestor-directory rebinding **above the source** between `confined_source` and `std::fs::read`,
`…/fixtures` being the nearest such directory and a **sibling** of `launches` (§12.1, §12.3). **All four
are one shape — a name checked at one instant and spent at another — and `std` offers no pinned-directory
primitive that would close any of them.** The temporary, never-shipped, deleted-at-5-7 context is
**acceptance, not proof**, and every place that states it now says so.

**11.2 Medium — §8.1, §9.1 and §10.1 overstated the same thing three times.**

*What it claimed.* §8.1 told 5b there is "no second pathname resolution"; §9.1 called the
no-shell/`O_EXCL` part *closed by construction*; §10.1 called Arm A "fixed properly, not narrowed" with
Arm B the only open case.

*What was actually true.* Removing the shell removed a **second process** re-resolving the checked
names; it did not remove this process's own two re-resolutions. Arm B's disclosure was honest on its own
terms — §4.5, §8.1 and §10.1 all plainly say the ancestor swap is unconstructed, unproven and accepted
rather than proved — but it read as **the only** residual.

*What changed.* All three now carry the same forced/not-forced sentence, and Arm B's honest disclosure
is kept while ceasing to be the only one. §8.1's bullet tells 5b exactly what it inherits, item by item,
and says in as many words that **there are two second pathname resolutions and both are open**. §10.1's
Arm A is now *partially closed*, with the measured half and the open half in separate paragraphs and a
stated reason for reclassifying rather than writing new code. §4.4, §4.5, §5.2, §5.18, §7 and §9.2 were
swept for the same over-claim. The three that carry a **count** — §4.4, §4.5 and §7 — named three
residuals where they had named one, and **round 4 widened those to four**; §5.2, §5.18 and §9.2 name
the *re-resolutions* rather than a count, and round 4 added to each that a re-resolution walks every
directory above the name as well (§12.1, §12.3). **This is a
withdrawal of a claim, not the closing of a hole**: all four rebindings are open.

**11.3 Medium — §9.1's "Closed and measured" bucket held items nothing measures.**

*What it claimed.* One bucket headed *Closed and measured* containing, among genuinely measured items,
"A plan is required" — and §9.1's construction bucket implicitly covering the third writer's
confinement.

*What was actually true.* §4.3 says in as many words that **no launch exercises a writer's no-plan
refusal**, because this driver has no way to call a writer without a plan; and §4.4 and §6.6 both say
C05/C06/C07/C09/C10 point the **second** writer at a refused path and never the third. Both are source
properties. The bucket's label was true of some of its members.

*What changed.* **The buckets are gone.** §9.1 now labels **every item individually** — *measured by
which launch*, naming C05, C06, C07, C09 or C10, or *closed by source construction, unmeasured* — and
the plan gate and the third writer's shared confinement carry the second label explicitly. §8.1's
inherited bullet does the same per item, so 5b reads the labels rather than a heading. **Two of those
per-item labels were still true of only part of what they claimed**, which round 4 found: C09 credited
with the exact-shape target rule it never reaches, and C06 with the direct-child source rule no launch
exercises. Both are now **two lines each**, a measured half and an unmeasured one (§12.4). *A label
being individual does not make it true of its whole item* is the lesson round 4 added to this one.

**11.4 Low — §10.4 claimed §6.1's rule governed five instances it did not reach.**

*What it claimed.* §10.4 said §6.1 states the general rule all five swept absence instances are cases
of.

*What was actually true.* §6.1's round-2 rule was the **no-write equivalence** — a final state cannot
distinguish *no write* from *an identical or transient write* — which governs §9.2's temporary-file
absence and §§4.4–4.5's unchanged-decoy readings. It does not reach §1's two: present absence cannot
establish **when** the old tree disappeared, and a string search over selected files cannot establish
that no retained artifact holds private material. Those are **chronology and scope** limits.

*What changed.* §6.1 now states a genuine general negative-evidence rule — **an absence observation is
bounded to the time, the corpus and the predicate it was taken over, and proves nothing about any wider
history, corpus or predicate** — with **time**, **corpus and predicate**, and **the no-write
equivalence** as its three named consequences, the last of them called out as this harness's own special
case. §10.4 now says which instances the round-2 rule reached (three) and which the wider rule reaches
(all five). Nothing about what any launch established changed.

**11.5 Low — the tree inventory said 74 where two measured dispositions say 75.**

*What it claimed.* §1's inventory: `manifest-2c-5-5a-fix-post.sha256`, 78 entries, **74 still verify**.

*What was actually true.* §5.9 and §10.5 both record the measurement as **75 of 78**, and both name
exactly three failures — `confine.sh`, `src/probe.ts` and `src-tauri/src/probe.rs`, the three files
round 2 changed. **The arithmetic agrees with them**: 78 − 3 = 75. The inventory line was the outlier.

*What changed.* `74` became `75`. No re-verification was run; the corrected figure is the one §5.9 and
§10.5 measured, and this record now says it in all three places.

**11.6 What the shape sweep found, over and above the five findings**

The five above were **addressed** — and *addressed* is the word, not *closed*: §§11.1 and 11.2 took the
reclassification branch, which **withdrew a guarantee** rather than closing a hole, so the pathname
rebindings they name are **open and disclosed** and remain so after round 4, which found a fourth of
them (§12.1, §12.3). Each was then swept **for its shape rather than for its words**, which
is the discipline `2c-4a-2-notes.md` §7.6.2 and §10.4 both exist to enforce. Four extra instances were
found and addressed, and three checks came back clean. **This paragraph said "the five above were
closed" until round 4** (§12.6).

*Extra instances found and addressed:*

1. **A count contradicting two sections that derive it** (11.5's shape, in a different place). §1 said
   the tree holds **"sixty-five launches"**. §5.8 names `P01…P48`, `N01…N08` and `C01…C10`, and §5.10
   tallies every one of them by generation; both give **66**. §1 now says sixty-six with the arithmetic
   shown and a note that it read sixty-five until round 3.
2. **A list label true of only some of its members** (11.3's shape, outside §9.1). §5.10's digest table
   labelled the row `P37–P48, N07, N08, C05–C10` as **"the proof set"**, while §1 says in as many words
   that **C08 is in no set at all** and §6.5 counts **nineteen** launches. The row is now labelled
   *the proof generation — the nineteen-launch complete proof set plus C08, the discarded attempt*.
   **What this fix did not notice is that "the proof set" itself meant twelve in §4 and nineteen in §1**;
   round 4's prose finding 3 is that, and §12.5 is where the two terms were separated.
3. **A comment claiming a guarantee the code does not give, in `src/probe.ts`** (11.1's shape, on the
   frontend). `reportReach`'s contract said the scroller's `scrollTop` "is read and written back, so a
   reporter can never leave the pane moved". The mechanism is backwards: nothing in the reporter scrolls
   anything, which is what really leaves the pane where it was, while a `say` is **awaited between the
   read and the write-back**, so the write-back can overwrite a scroll something else made during that
   await by attempting to restore the earlier value, and would not run at all if the `say` rejected. The comment was rewritten to say what holds
   and to call the write-back belt and braces rather than a guarantee. **That rewrite carried a
   categorical claim of its own — "Nothing here scrolls anything" — which its own next two sentences
   retract, since `scroller.scrollTop = held` is a write and a write can scroll**; round 4's instrument
   finding 2 is that, and §12.2 is the correction. The claim that holds is about the **geometry reads**,
   never about the whole function.
4. **A construction claim presented without saying it is unmeasured** (11.3's shape, in a doc comment).
   `startProbe`'s contract said `replace_the_target` refuses without a plan "so neither writer replaces
   a file either", with nothing marking that as a source property. It now says it is a property of the
   Rust source and **not** a measurement, because this driver cannot call a writer without a plan.

*Checks that came back clean, recorded so the next round need not re-derive them:*

- **A consuming operation whose result is discarded.** The round-2 review's own sweep was verified
  rather than trusted and then extended. In `src-tauri/src/probe.rs`: `write_all` and `sync_all` are
  both assigned to `outcome` and checked; `std::fs::rename`'s `Result` is the function's tail
  expression; every `canonicalize`, `std::env::var` and `strip_prefix` is mapped and propagated with
  `?`; `writeln!` and `flush` in `render_probe` are propagated. **The only two discarded results are the
  two `let _ = std::fs::remove_file(temporary)` cleanups**, which are deliberate and disclosed in
  `copy_then_rename`'s own documentation and in §9.2. **Round 4 re-verified that and added the one thing
  it does not cover**: `drop(handle)` runs `std::fs::File`'s own `Drop`, which swallows the **close**
  error — not a `Result` this code discards, but an error nothing here observes — and the checked
  `sync_all` above it is what makes that acceptable (§12.7). In `src/probe.ts`: both writer `invoke`s are
  awaited and their answers read; `probe_plan`'s and `render_probe`'s are awaited. The one result the
  driver *does* drop is `dispatchEvent`'s boolean in `typeInto`, `pickLanguage` and `creatorPlan` — and
  that is **not** an instance, because every event constructed there is non-cancelable
  (`new Event(…, { bubbles: true })` leaves `cancelable` false), so the call cannot answer anything but
  `true`.
- **An absence claim not bounded to its time, corpus and predicate** (11.4's shape). Every absence
  sentence in this record was re-read against the extended §6.1 rule: §1's two, §4.3's, §4.4's and
  §4.5's `decoy=unchanged`, §5.4's two-halved backup search, §6.6's and §7's bundle searches (each with
  a control that makes it non-vacuous), §9.2's temporary sweep and §9.10's manifest reading. **All were
  already bounded**; none needed rewording, and each now falls under a rule that reaches it.
- **The gates.** All seven rows of §7 were re-run and every figure is unchanged — **1153 / 432 / 2124 /
  185**, `cargo fmt --check` and `cargo clippy --workspace --all-targets -- -D warnings` both clean —
  which is the expected result for a round that changed no executable line, and is recorded because a
  predicted-unchanged count is worth more than one nobody checked.

## 12. Disposition of the six round-4 review findings

`docs/reviews/phase-2c-5-5a-instrument-round4.md` returned **NOT READY on six findings** — two in the
instrument's comments and four in this record. **Four of the six are again a claim the code or the
evidence does not license**, which is the class §11 opened with; the other two are a term used with two
meanings and the word *closed* standing where *withdrawn* is the truth.

**Round 4 changed no executable line either.** Every fix below rewrites a doc comment or a paragraph:
no statement in either probe source was added, removed or altered, and **the built bundle is still
`dist/assets/index-I5AFZyLL.js`** — an unchanged content hash is the reading that says a comments-only
frontend edit emitted the same bytes. **No launch was re-run and no new window measurement is claimed
anywhere in this section.** The only new measurements are §7's seven gate rows, the four bundle
searches, and two `shasum` readings taken to settle a claim about a binary. **One of those readings
moved**: `target/debug/espansoconfig` was rebuilt by §7's own `cargo build` row and no longer carries
the proof generation's digest — a fact about the build tree, not about behaviour, and §12.7's item 4 is
where it belongs.

**12.1 Medium — the instrument's residual list was written as exhaustive and was not.**

*What it claimed.* `src-tauri/src/probe.rs`'s module note, and every site referring to it, said
**exactly three** residual rebindings survive: the source's final component, the temporary's name after
`create_new`, and *an ancestor directory of the launch tree*.

*What was actually true.* There is a **fourth**. After `confined_source` returns the canonical source
pathname, `std::fs::read` walks that pathname again — **every directory above it included** — so an
ancestor of the *source* can be rebound in between. The nearest such directory is
`HARNESS_ROOT/fixtures`, which is a **sibling** of `launches`; "an ancestor directory of the launch
tree" therefore never covered it. The temporary, never-shipped context mitigates severity and does not
make an exhaustive three-item claim true.

*What changed.* **The classification again, not the code.** The list is **four** items, written as the
two final components plus an ancestor of *either* approved pathname, `fixtures` named explicitly. Every
site in `probe.rs` that carried the count or the list was corrected — the module note (both the forward
reference and the list itself), `resolve_existing_file`'s back-reference (*items 1, 3 and 4*),
`confined_target`, `confined_source`, `copy_then_rename` and `replace_the_target` — and the count word
was checked at **every** occurrence in the file, including the ones that mean something else and were
left alone (`replace_the_target`'s *three refusals*, `TARGET_TAIL`'s *four of five components fixed*).

**The fourth rebinding is open and disclosed. It was not closed, and neither were the other three.**
Closing any of them still needs `openat`-style pinned directory handles that `std` does not offer, and
this fix deliberately did not write them with `libc` in an instrument that 2c-5-7 deletes.

**12.2 Low — `reportReach`'s comment contradicted itself.**

*What it claimed.* Round 3's rewrite opened with **"Nothing here scrolls anything."**

*What was actually true.* Its own next two sentences retract it: `scroller.scrollTop = held` is a
**write**, and a write can scroll the pane when the position changed during the awaited `say` between
the read and it. What does not scroll is the **geometry reads**.

*What changed.* The comment now says the **measurement** moves nothing — `getBoundingClientRect` and the
`scrollTop`/`scrollHeight`/`clientHeight` reads are reads — and that the write-back is a different thing
which **can overwrite a newer position by attempting to restore the earlier value**, and does not run at
all if the `say` rejects. It is **not** said to scroll the pane necessarily, and **not** said to restore
the earlier position successfully: `scrollTop` is clamped against the layout existing when the assignment
runs, so the effective position may be unchanged, may move, and may land at neither value — round 5's
instrument finding 1 and prose finding 1 are that over-claim, and §13.1 and §13.2 are the correction. **It is not a guarantee that a reporter cannot leave the pane moved**, and the
comment now says so in those words. §11.6's item 3 carries a correction block pointing here.

**12.3 Medium — the record's exhaustive residual lists had the same hole.**

*What it claimed.* §4.5, §8.1, §9.1, §10.1 and §11.1 each listed the residual rebindings as **three**,
with the ancestor case written as the launch tree's alone; the opening blockquote, §4.4 and §7 carried
the same count.

*What was actually true.* 12.1's fourth case is missing from every one of them.

*What changed.* Every list is **four** items and every count word beside one now reads *four*: the
blockquote, §4.4, §4.5's numbered list, §7's last paragraph, §8.1's inherited bullet, §9.1's *what is
NOT forced* list, §10.1's Arm A and Arm B, §10.2, §11.1's *open and disclosed* list and §11.2. Each
says in its own words that the fourth is **open and disclosed**, added by a round that **withdrew a
claim rather than closing a hole**. The record's other "three"s — three refusals in `launch.sh`, three
revisions in a conflict block, three adversarial launches, three manifests, three reasons for
acceptance, three consequences of §6.1's rule — were read one at a time and left as they were, **with
one exception that was wrong for its own reason**: §3's *three retained generations*, which §12.7's
item 2 corrects to four.

**12.4 Medium — a per-item label true of only part of its item, one round after the wider one closed.**

*What it claimed.* §9.1's per-item list credited **C06** with measuring that the source is a document
**directly inside** `…/fixtures`.

*What was actually true.* C06 points `ECFG_PROBE_R1` at a decoy **outside the harness root**, so the
refusal it quotes is `strip_prefix`'s *"is not beneath …/fixtures"*. **No launch anywhere in this tree
points a writer at a nested regular file beneath `fixtures`**, so the direct-child rule at
`src-tauri/src/probe.rs:352-358` is **source construction, unmeasured**. This is round 3's finding 3 —
a label true of only some of its members — recurring **narrower** inside the fix that closed the wider
one.

*What changed.* The label is **two lines**: *beneath `…/fixtures`* measured by C06, and *direct child*
closed by source construction and unmeasured. **Then every other per-item label in §9.1 was re-checked
against the launch it names, one at a time, rather than assumed right** — and a second instance came
out of it: the target item credited **C09** with the *exact-shape* rule, when C09's own quoted refusal
in §4.5 is *"is not beneath …/launches"*, the same `strip_prefix` half C05 measures. **C10 is the only
launch that reaches the shape check.** That item is now two lines as well. §4.4, §8.1, §10.1 and §11.3
carry the same split where they repeat the labels.

**12.5 Low — "the proof set" named two different sets.**

*What it claimed.* §1 and §5.10 called **nineteen** launches the proof set — P37–P48, N07–N08, C05–C07
and C09–C10 — while §4 said *"P37–P48 are the proof set"*, meaning **twelve**.

*What was actually true.* Both sets exist and both matter; only the name was shared. The
sixty-six-launch total round 3 corrected is unaffected.

*What changed.* Two terms, defined in the blockquote: the **twelve plan-proof launches** (P37–P48, one
per case of the case table) and the **nineteen-launch complete proof set** (those twelve plus two
no-plan controls, two static confinement controls and three adversarial ones — 12 + 2 + 2 + 3 = 19).
Occurrences were re-read against the section that defines it in §1, §4, §4.1, §5.8, §5.10, §5.12, §6.2,
§6.3, §6.5, §6.6, §7, §9.8, §11 and §11.6.

**This section claimed that sweep was exhaustive — "used everywhere" — and it was not.** Round 5 found
**two** references still carrying the old generic wording, one at §7's bundle-search paragraph and one
in §10's P02 provenance paragraph; §13.3 is that correction. The numbers beside them made the intended
set recoverable in both cases, so neither was false — but *this sentence* was, and an exhaustiveness
claim that the sweep does not license is the same defect class as the one §12.5 exists to close. The
membership and the arithmetic were independently re-derived at round 5 and are correct. **Two of them were not merely
ambiguous but false under one reading** — §4.1 said *every launch of the proof set has
`failed-lines=0`*, which is untrue of the five confinement launches where a `--- failed` **is** the
pass; and §6.6 said the third-writer path was *"not in the executable the proof set ran"*, which is
false of today's proof set and true only of the bundle that existed before round 1's fix. Both now say
which set they mean.

**12.6 Low — §11.6 called withdrawn guarantees closed.**

*What it claimed.* *"The five above were closed."*

*What was actually true.* §§11.1 and 11.2 took the reclassification branch: they **withdrew** a
guarantee and left the pathname holes **open**. Calling that closed is the same softening the finding
it answered was about.

*What changed.* §11.6 now says the five were **addressed**, names §§11.1–11.2 as withdrawals, and says
the confinement holes remain **open and disclosed** — more of them after 12.1, not fewer. Its list
heading says *found and addressed* rather than *found and closed*, and the blockquote's two "how it was
closed" summaries for rounds 1 and 2 now read *how it was addressed*. **Every remaining occurrence of
*closed* in §§9–12 was then read one at a time against what it verdicts**, and none of them stands over
a withdrawn guarantee: the genuine closures keep the word (§9.3 by running it, §9.4, §9.5's code half,
§9.7's rewritten claim, §9.8 by measuring, §11.5's arithmetic), the *closed by source construction,
unmeasured* label keeps it with its own qualifier attached, and §9.1's and §10.1's verdicts say
*partially closed* where that is what happened.

**12.7 What the shape sweep found, over and above the six findings**

Each finding was then swept **for its shape rather than for its words**. Five extra instances were
found and addressed, and the mandated checks were verified rather than trusted.

*Extra instances found and addressed:*

1. **A label true of only some of its members** (12.4's shape, in §6.5). It said this `probe.rs`
   *"drove nineteen launches of the proof generation to `--- end`"*. **N07 and N08 wrote no transcript
   at all** — a zero-byte `probe.log` is exactly what §4.3 measures there — so they reached no `--- end`.
   §6.5 now says **seventeen of the nineteen**, and names the two that did not and why.
2. **A count with two meanings** (12.5's shape, in §3). It said *"four different binaries ran across the
   three retained generations"*, where §1 names **four** generations and §5.10's table has **five**
   digest rows — the round-0 generation itself ran two. §3 now says five binaries across four
   generations, with the reason.
3. **A count with two meanings inside one section** (§7). *"The build answered 185 on all three
   readings"* stood two paragraphs below *"every figure is unchanged across all four readings"*. Round 4
   set both to **five**, because round 4's own reading was one more. **Both went stale again when
   rounds 5 and 6 ran, and §14.7 is that correction** — this item records what round 4 did, not what
   §7 says today.
4. **A claim whose evidence expired** (§1's preamble, §5.10 and §6.4). All three said the proof
   generation's binary is *byte-identical to `target/debug/espansoconfig` as it stands now*. It is not,
   and cannot be relied on to stay so: `cargo build -p espansoconfig --features custom-protocol` is one
   of §7's seven gate rows and **each of the first four fix rounds re-ran it**, which is what broke the
   equality. **Rounds 5 and 6 did not run that row** (§13.6, §14.6), so the path has not been rewritten
   since round 4 — the claim is about an equality that expired, not about a rebuild every round
   performs. **Measured at round 4**: `target/debug/espansoconfig`
   is `04988c09…`, while `launches/P37/…/MacOS/espansoConfig` and `launches/C10/…/MacOS/espansoConfig`
   both still answer `0a2d3506…`. **The retained bundle copies are what pin which bytes ran; the working
   build tree never did.** All three sentences now say that, with the equality bound to the moment it
   was read.
5. **Categorical claims in the two probe sources that their own code does not license** (12.1's and
   12.2's shape, swept over both files). Four, each narrowed in place: `waitFor`'s *"this is where every
   assertion in this instrument lives"* — **five throws sit outside it**, `parsePlan`'s three,
   `runCase`'s default and `creatorPlan`'s missing-placement check, and the comment now names them;
   `enabledNamed`'s *"the one enabled control"* — `find` answers the **first** and nothing forces a
   scope to hold one, which is what the scoping rule exists for; `confined_target`'s *"the only file any
   writer can name"* — a categorical sentence its own next paragraph retracts, now written as the only
   **shape** a target can have **at the instant of the check**; and the module note's *"the one
   arrangement that keeps `cargo test -p espansoconfig` passing"* — inherited from
   `2c-4a-3c-1-instrument.md` §5.3 and never established to be the only one. `TEMP_NAME_VARIABLE`'s
   *"no script outside this process can predict it"* was narrowed to *no way to name it in advance short
   of guessing the stamp*, in `probe.rs` and in §5.18 alike.

*Checks verified rather than trusted:*

- **A consuming operation whose result is discarded.** Re-read line by line in both files. In
  `src-tauri/src/probe.rs` the **only** discarded `Result`s are still the two
  `let _ = std::fs::remove_file(temporary)` cleanups, disclosed in `copy_then_rename`'s own
  documentation and in §9.2; `write_all` and `sync_all` are assigned to `outcome` and checked,
  `std::fs::rename`'s `Result` is the tail expression, and every `canonicalize`, `std::env::var` and
  `strip_prefix` is mapped and propagated. **One thing that sweep does not cover is now written down**:
  `drop(handle)` runs `std::fs::File`'s own `Drop`, which **swallows the close error** — not a `Result`
  this code discards, but an error nothing here observes — and the checked `sync_all` immediately above
  it is what makes that acceptable. In `src/probe.ts` the `dispatchEvent` boolean is a **genuine
  non-instance**, confirmed by reading all three constructions rather than by trusting the earlier
  sweep: `typeInto`, `pickLanguage` and `creatorPlan` each build `new Event(…, { bubbles: true })` with
  no `cancelable`, which defaults to `false`, so `dispatchEvent` cannot answer `false`. The one further
  discard is `startProbe`'s `void` on its async body; its failure mode is the **already-disclosed**
  truncated transcript, and its contract now says so.
- **A categorical statement retracted by its own neighbouring sentences.** Both probe sources were read
  for the shape, not for `reportReach`'s words; the two instances found are 12.2 and item 5 above.
- **The gates.** All seven rows of §7 re-run: **1153 / 432 / 2124 / 185**, `cargo fmt --check` clean,
  `cargo clippy --workspace --all-targets -- -D warnings` clean, `cargo build -p espansoconfig
  --features custom-protocol` finished. The four bundle searches re-run on
  `dist/assets/index-I5AFZyLL.js` — **whose name is unchanged, which is itself the reading that says a
  comments-only frontend edit changed no emitted byte** — and unchanged: server-only sentinels absent,
  client-only constructs at 2, `probe_third_writer` at 1, `probe_second_writer` at 1.

---

## 13. Disposition of the three round-5 review findings

Round 5 is `docs/reviews/phase-2c-5-5a-instrument-round5.md`. It returned **NOT READY on three, and all
three are Low** — the first round of this step whose findings are all Low. It also closed, by
**independent enumeration from the code rather than against the list**, the question round 4 opened:
there are **exactly four** residual rebinding classes and **no fifth**, because a target final-component
replacement does not follow a newly planted symlink and every directory walked by the temporary is
already the target-path ancestor case. §9.1's per-item labels were re-checked item by item and **all**
now match their evidence. The `drop(handle)` close-error disclosure was judged correct and not
overstated, read as an acceptance rationale rather than a guarantee.

**No code behaviour changed in this round either. Three findings were addressed through comments and
prose in two files** — `src/probe.ts` and this record. **More than three wording sites moved**: the
`reportReach` contract comment, §§11.6 and 12.2, the §7 and §10 terminology references, §12.5's own
correction, and the whole of this section.

**13.1 Low — `src/probe.ts`, the write-back was said to scroll.** Round 4 replaced *"Nothing here
scrolls anything"* with a claim that the write-back **scrolls the pane, to a stale position** — trading
one categorical statement for another in the opposite direction. `scrollTop` is **clamped against the
layout existing when the assignment runs**, so assigning the held value may leave the effective position
unchanged, may move it, and may land at neither the held value nor the current one. The contract now
says the write-back **can overwrite a newer position by attempting to restore the earlier value**, and
guarantees **neither** preservation **nor** restoration. The geometry-reads claim is untouched: it was
the part that always held.

**13.2 Low — the record carried the same over-claim.** §11.6's item 3 said the write-back *"would undo"*
an intervening scroll and §12.2 said it *"restores a stale position"*. Both now say it *can attempt* to
restore the earlier value, and §12.2 states the clamping and the three possible outcomes explicitly.

**13.3 Low — two references escaped §12.5's terminology sweep.** §7's bundle-search paragraph said
*"its own nineteen-launch proof set"* and §10's P02 paragraph said *"all twelve proof launches"*. Both
now use the defined terms. **Neither was false** — the number beside each made the intended set
recoverable — but **§12.5's own claim that the terms were "used everywhere" was**, and §12.5 now carries
that correction rather than repeating the claim.

**13.4 What round 5 says the round-4 fixes created, and where it went.** Two things, and both are
above: the `reportReach` correction created a narrower categorical guarantee (13.1, 13.2), and the
terminology fix created an exhaustiveness claim it did not license (13.3). **This is the fifth
consecutive round in which the fix round created the next round's finding**, and it is why no round of
this step has been allowed to close without one — but the trend is the reading that matters: 8 findings,
then 4, 5, 6, and now 3, with the severity ceiling falling from High to Medium to **Low**.

**13.5 What is still open, unchanged by this round.** The **four** residual rebindings of the module
note in `src-tauri/src/probe.rs` are **open and disclosed**, not closed: source final component,
temporary name after `create_new`, an ancestor of the target's pathname, and an ancestor of the
source's pathname. Closing any needs `openat`-style pinned directory handles that `std` does not offer.
They are **accepted, not proven** — operator-controlled launch root, never-shipped binary, deleted at
2c-5-7 — and **acceptance is not proof of impossibility**. 2c-5-5b inherits exactly that, and §8.1 says
so in those terms.

**13.6 The gates after this round.** Comments and prose only, in `src/probe.ts` and this record; no
`.rs` file changed, so the Rust gates cannot have moved and were re-run anyway. With the harness in the
tree: `cargo test --workspace` **1153**, `npm run check` **432 files / 0 errors / 0 warnings**,
`npm test` **2124**, `npm run build` **185 modules**; `cargo clippy --workspace --all-targets -- -D
warnings` and `cargo fmt --check` clean. **No launch was re-run and no new measurement is claimed in
this section.**

## 14. Disposition of the three round-6 review findings

Round 6 is `docs/reviews/phase-2c-5-5a-instrument-round6.md`. It returned **NOT READY on three, and all
three are Low and all three are prose** — **`### Instrument defects` is the word "None."**, the first
round of this step to say so. It confirmed all three of round 5's findings **CLOSED**, and it confirmed
the two substantive §13 claims it was asked to test: §13.5 still leaves all four pathname rebindings
open, accepted-not-proven, with acceptance explicitly not proof of impossibility; and §13.4's trend
sentence does not overstate, because it gives the actual 8 → 4 → 5 → 6 → 3 sequence rather than
claiming a monotone fall, while the severity ceiling it does claim to fall is supported.

**Nothing in `src/probe.ts` or `src-tauri/src/probe.rs` changed in this round. All three fixes are in
this record.**

**14.1 Low — the review-file-to-round mapping was off by one.** §13's heading, its opening sentence,
§13.4's title and three references inside §12 all called
`docs/reviews/phase-2c-5-5a-instrument-round5.md` **round 6**. The mapping §9–§12 establish is
initial review → round 1 and `-roundN.md` → round N, so that file is **round 5** and the confirmation
that found this is round 6. §13.4 was additionally **self-contradictory**: it cited the round-5 review
while assigning its findings to the round-5 *fixes*, when round 5 reviewed the **round-4** fixes. All
six references now say round 5, and §13.4 now reads *what round 5 says the round-4 fixes created*. The
orchestrator found this shape before commissioning round 6 and **put it to the review as a question
rather than fixing it**, because a unilateral correction would have been an unreviewed change; round 6
ruled it a defect and dictated the fix.

**14.2 Low — the preamble had gone stale against §13, and its exhaustiveness claim was the casualty.**
The preamble said the record was revised **four** times by four fix rounds and §9's opening said **§12**
was the latest, both written before §13 existed and neither updated when it did. That is not merely a
stale count: the preamble also claimed *every sentence below that a fix made false has been rewritten
in place*, and **the stale count was itself a sentence a fix had made false**, so the claim falsified
itself. The ledger names every round and its section — **seven as of §15** — and §9's opening names the
latest. **The round-6 replacement for the exhaustiveness claim was itself still one, and §15.1 is that
finding**: *"each fix round rewrote the sentences its own fixes made false"* is categorical, and the
*"a sweep, not a guarantee"* clause after it did not narrow it. The preamble now says each round
rewrote what **it identified**, that a round has missed one every time, and that **no round has yet
identified every sentence its fixes falsified** — see §15.1 for why the weaker verb is the whole point.
**This paragraph is named as the evidence in the preamble itself**, because a disclaimer with no
instance behind it reads as modesty rather than as a limit.

**14.3 Low — "Three wordings changed, in two files" was an unlicensed exact count.** Three *findings*
were addressed, but the sites that moved were the `reportReach` contract comment, §§11.6 and 12.2, the
§7 and §10 terminology references, §12.5's own correction and the whole of §13 — more than three. §13
now counts **findings** rather than wordings and enumerates the sites.

**14.4 What round 6 says the round-5 fixes created, and where it went.** Three things, all three in
this record and **none in either probe source**: the off-by-one round identity (14.1), the stale
four-round and latest-§12 metadata with the self-falsifying exhaustiveness claim it dragged down
(14.2), and the unlicensed exact count (14.3). **The fix round then swept for the *shape* of each rather
than its cited lines and found two more instances of 14.2's, both in §7; §14.7 records them.** Round 6
cited three; **five were fixed**, and the two extras are named rather than folded silently into the
three. **This is the sixth consecutive round in which the fix
round created the next round's finding**, and it is why this round does not close either. Two readings
matter and they point the same way. The counts are 8, 4, 5, 6, 3, 3 — **not** monotone, and this
section does not claim they are. The **kind** is what moved: rounds 1 and 2 changed the instrument's
own code, rounds 3 through 5 changed what the record and the comments *claimed* about that code, and
round 6 found **no instrument defect at all** and three places where this record had gone stale
**against itself** rather than against the instrument. **That is a narrower failure surface, not an
empty one**, and a seventh round is owed on **all five changes this round made** — the three round 6
cited and the two §14.7 extras — not on the cited three alone.

**14.5 What is still open, unchanged by this round.** Unchanged in the strict sense: **no fix in this
round touched the confinement disclosure at all.** The **four** residual rebindings of the module note
in `src-tauri/src/probe.rs` remain **open and disclosed**, not closed — source final component,
temporary name after `create_new`, an ancestor of the target's pathname, and an ancestor of the
source's pathname. They are **accepted, not proven**, and **acceptance is not proof of impossibility**.
2c-5-5b inherits exactly that, and §8.1 and §13.5 both say so in those terms.

**14.6 The gates after this round.** **Markdown only** — this record and the new review file; **no
`.ts`, `.rs` or `.svelte` file changed**, so no gate *can* have moved. They were re-derived anyway,
with the harness in the tree, and this is a re-derivation on the tree as it stands rather than a figure
carried forward: `cargo test --workspace` **1153**, `npm run check` **432 files / 0 errors / 0
warnings**, `npm test` **2124 in 56 files**, `npm run build` **185 modules**; `cargo clippy --workspace
--all-targets -- -D warnings` and `cargo fmt --check` clean. The `cargo build -p espansoconfig
--features custom-protocol` row was **not** re-run this round, and §7 says so rather than implying the
whole table moved with each round. The bundle oracle was read
in **both** directions, because a bare `svelte/internal/server` search is a vacuous negative: the
server-only sentinels `$$payload|head_payload|push_element` are **absent**, and the client-only
`window.__svelte|svelte-trusted-html` are **present → 2**, which is what proves the search can match at
all. **No launch was re-run and no new window measurement is claimed in this section.**

**14.7 Two extras this fix round swept up, which round 6 did not cite.** Round 6's finding 2 named the
preamble and §9's opening. Sweeping for its **shape** — *a count of rounds or readings written before a
later round existed* — rather than for its two cited line ranges found **two more**, both in §7 and both
stale in the same direction:

1. **§7 said all seven rows were re-run after each of "the four fix rounds" and were unchanged "across
   all five readings".** Six rounds had run when this was written, and rounds 5 and 6 had each
   re-derived a **subset** of the table rather than all seven rows. (**Round 7 then made it seven
   rounds and eight readings**, and §7 was updated again — this item records the round-6 correction,
   not what §7 says today.) The paragraph now names the subset per round and narrows what it
   claims across all seven readings to the thing that is actually true of every one of them: **no
   reading has ever moved a figure in this table.** The neighbouring sentence *"rounds 3 and 4 changed
   no executable line at all"* was stale the same way and now covers rounds 3–5 plus round 6's
   markdown-only change.
2. **§7 said the build answered 185 on "all five readings".** Rounds 5 and 6 each ran the build, making
   it **seven** at the time of this correction; **round 7 made it eight**. This is the third time this
   one sentence had carried a stale count — it said "all three" before §12.7 corrected it to "all five"
   — which is why the correction names the shape rather than only the number. **It went stale a fourth
   time one round later**, which is §15.4's reading in miniature: the number is not the defect, the
   append-without-revisit is.

**Neither was false in the way §14.1 was**, and that distinction is the point: each described a real set
of readings accurately at the moment it was written, and went stale when a later round appended to the
record without revisiting it. **That is the same mechanism as §14.2, not a separate defect**, and it is
the reason the preamble's replacement claim is *a sweep, not a guarantee*. A seventh round is owed on
these two as much as on the three round 6 cited, because **this paragraph is itself new prose written by
a fix round.**

## 15. Disposition of the three round-7 review findings

Round 7 is `docs/reviews/phase-2c-5-5a-instrument-round7.md`. It returned **NOT READY on three, all Low,
all prose, and `### Instrument defects` is "None." for the second consecutive round.** It confirmed
round 6's findings 1 and 3 **CLOSED** and finding 2 **PARTIALLY CLOSED**, and it confirmed **both**
§14.7 extras **CLOSED**. It re-checked the four-residual-rebinding disclosure in §8.1, §13.5, §14.5 and
the `probe.rs` module note and found it intact: open, disclosed, **accepted not proven**, acceptance
explicitly not proof of impossibility.

**Nothing in `src/probe.ts` or `src-tauri/src/probe.rs` changed in this round either.** Two consecutive
rounds have now found **no instrument defect**, and every fix of the last two rounds has been in this
record.

**15.1 Low — the preamble's replacement clause was still a guarantee.** §14.2 replaced *"every sentence
below that a fix made false has been rewritten in place"* with *"each fix round rewrote the sentences
its own fixes made false, and the round after it swept for the ones that were missed — that is a sweep,
not a guarantee."* Round 7's judgement is exact and is the finding this step keeps re-learning: **the
first clause is still categorical, and the disclaimer after it does not narrow the claim before it.**
Worse, the paragraph **disproved itself in its own next sentence** — adding §13 falsified the four-round
count, and that fix round did **not** rewrite it. The clause now says each round rewrote what **it
identified**, that a round has missed one **every time**, and that **no round of this step has yet
identified every sentence its fixes falsified**. The weaker verb is load-bearing, not modest.

**15.2 Low — "all three are staleness" flattened three distinct shapes, and "exactly these three fixes"
contradicted this record's own count.** The preamble said all three round-6 findings were this record
gone stale against its newest section. Only §14.2 was; §14.1 was an off-by-one identity with a false fix
lineage, and §14.3 was an unlicensed exact count. The preamble now names the three shapes separately and
says §14.7's two extras are instances of **§14.2's shape alone**. Separately, §14.4 closed with *"a
seventh round is owed on exactly these three fixes"* while §14.4 itself said five sites were fixed and
§14.7 said the seventh round was owed on the extras too — **a contradiction inside one section**. §14.4
now says all five.

**15.3 Low — two surviving "every fix round re-runs" claims, in regions no fix round had touched.** §1's
preamble at the `0a2d3506…`/`04988c09…` inequality and §12.7's item 4 both justified the expired equality
by saying **every** fix round re-runs §7's `cargo build -p espansoconfig --features custom-protocol` row.
§13.6 enumerates round 5's subset without it and §14.6 says outright it was not run at round 6. Both now
bind the re-running to **the first four fix rounds**, state that rounds 5 and 6 did not run that row, and
say the claim is about **an equality that expired**, not a rebuild each round performs. §12.7's item 3
carried the same staleness — *"Both are now five"* — and now records that as **what round 4 set**, with a
pointer to §14.7 for what §7 says today.

**15.4 What round 7 says the round-6 fixes created, and the one reading that is now hard to avoid.** All
four things it names are in prose this fix round wrote or left standing, and **none is in either probe
source**. **This is the seventh consecutive round in which the fix round created the next round's
finding.** The counts are 8, 4, 5, 6, 3, 3, 3 and the severity ceiling has been **Low for three rounds
running**, with **`Instrument defects: None.` for two**. What has not happened in seven rounds is a
round returning **READY**. The honest reading is that the instrument itself has been still since round 2
and **the remaining defect surface is this record's prose about its own review history** — each round
appends a section, the appending falsifies a count or a characterization somewhere above it, and the
next round finds that. **§15.5 is where that is put to the owner rather than answered here.**

**15.5 The convergence question, stated and not decided.** Seven rounds have cost seven Codex
round-trips. Rounds 6 and 7 found **zero** instrument defects and six prose defects between them, **five
of the six being this record's bookkeeping about how many rounds it has had**. The rule that produced
this is `CLAUDE.md`'s and it is a good rule: *a fix is a change, and the round that reviews it is not
optional*. **It is not suspended here, and this section does not close 5a.** What it records is that the
loop's remaining yield is meta-prose in a document describing an instrument that **step 2c-5-7 deletes**,
and that continuing is now an owner's call about cost rather than a question of whether the instrument is
sound. **An eighth round is owed on §15 by the standing rule.** The alternative the owner may prefer —
accepting 5a with §15.4's reading recorded as the closing state — is **not** taken unilaterally, and
nothing in this section should be read as having taken it.

**15.6 What is still open, unchanged by this round.** No fix in this round touched the confinement
disclosure. The **four** residual rebindings remain **open and disclosed**, not closed — source final
component, temporary name after `create_new`, an ancestor of the target's pathname, an ancestor of the
source's pathname — **accepted, not proven**, and **acceptance is not proof of impossibility**. Round 7
re-verified this in §8.1, §13.5, §14.5 and the module note. 2c-5-5b inherits exactly that.

**15.7 The gates after this round.** **Markdown only** — this record and the new review file; **no
`.ts`, `.rs` or `.svelte` file changed**, so no gate *can* have moved, and these are re-derivations on
the tree as it stands rather than figures carried forward: `cargo test --workspace` **1153**, `npm run
check` **432 files / 0 errors / 0 warnings**, `npm test` **2124 in 56 files**, `npm run build` **185
modules**; `cargo clippy --workspace --all-targets -- -D warnings` and `cargo fmt --check` clean. The
`cargo build -p espansoconfig --features custom-protocol` row was **not** re-run this round either, which
is why §1 and §12.7 no longer claim every round runs it. The bundle oracle was read in **both**
directions: server-only `$$payload|head_payload|push_element` **absent**, client-only
`window.__svelte|svelte-trusted-html` **present → 2**. **No launch was re-run and no new window
measurement is claimed in this section.**

**15.8 Three extras this fix round swept up, which round 7 did not cite.** Sweeping for the **shape** of
each finding rather than its cited line ranges — as §14.7 did, and as `CLAUDE.md` requires — found three
more, and **the fact that §14.7 exists and this section exists too is itself the evidence for §15.4**:

1. **A third "every fix round re-runs it" claim, in §6.4** (the digest table's paragraph). Round 7 cited
   §1's preamble and §12.7's item 4. §6.4 carried the identical sentence and was **not** cited. It now
   binds the re-running to the first four fix rounds and names §13.6, §14.6 and §15.7 for the three that
   did not run that row. **Three sites, one shape, and the review found two of them** — which is exactly
   why this project sweeps for the shape.
2. **§14.2's own account of its fix had gone stale against §15.1.** It said *"the exhaustiveness claim
   is gone — replaced by the narrower truth that each fix round rewrites what its own fixes falsified"*,
   describing as a fix the very sentence round 7 then found still categorical. It now states that the
   replacement was itself an exhaustiveness claim and points at §15.1.
3. **§14.7's two items were written in a present tense that expired one round later** — *"Six rounds
   have now run"*, *"so it is seven"*. Both now say what was true when the round-6 correction was made
   and name round 7 for what changed, so the section records **a correction** rather than claiming to
   describe §7 today.

**Extras 2 and 3 are the append-without-revisit mechanism operating on §14 itself**, one round after §14
was written to document that mechanism. That is not irony to be enjoyed; it is the measurement §15.4
reports and §15.5 puts to the owner. **An eighth round is owed on all six changes this round made** —
round 7's three and these three — and this paragraph is new prose written by a fix round like every one
before it.
