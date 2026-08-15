# Phase 2c-5 step 5a — the window-reading instrument, rebuilt from the records

> **This record was revised twice, by two review fix rounds.**
> `docs/reviews/phase-2c-5-5a-instrument.md` returned **NOT READY on eight findings**; §9 names each
> one and how it was closed. `docs/reviews/phase-2c-5-5a-instrument-round2.md` then returned **NOT
> READY on four more**; **§10** names each of those and how it was closed. Both rounds changed
> `src-tauri/src/probe.rs`, so every launch taken before them ran a **different binary** and none can
> stand as evidence for the tree that ships. **§4's proof set is now P37–P48**, with N07/N08 as the
> no-plan controls, C05/C06 as the static confinement controls and **C07, C09 and C10 as the
> adversarial ones round 2 asked for**. Every sentence below that a fix made false has been rewritten
> in place; nothing that was an honest limitation has been deleted; §9.9 lists the one defect round 1
> found in its own work and deliberately did not close, and **§10.1 states plainly what round 2's fix
> does *not* close** — an ancestor-directory symlink swap, which is residual and unproven.

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
digest equals the one now standing at `target/debug/espansoconfig`. Source inspection separately
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
  manifest-2c-5-5a-fix-post.sha256   78 entries — the round-1 image; 74 still verify (§5.9)
  manifest-2c-5-5a-round2.sha256     55 entries — the round-2 image; all 55 verify (§5.9)
```

It is **2.7 GB** after sixty-five launches — roughly 40 MB each, because every script assembles a
fresh `.app` bundle per launch and every launch keeps its own. That is the growth rate 4a §1 recorded
and not a measurement of what a rebuild costs.

**Four generations of launches are retained, and only one of them is the proof set.** P01–P12 and
N01–N02 ran the **round-0** image and are superseded; P13–P24, N03–N04 and C01–C02 are an
**intermediate** generation, taken after the first round-1 fixes and before two further corrections
round 1's own self-review found (§9.9's first paragraph), and nothing in this record cites them;
P25–P36, N05–N06 and C03–C04 are the **round-1** generation, which the round-1 record cited as its
proof set and which round 2 superseded by changing `probe.rs` again; **P37–P48, N07–N08, C05–C07 and
C09–C10 are the proof set**, and every one of them ran the binary whose digest is
`0a2d3506630256f6a3193de3352b32b23244e4e8ff7c07b9642a85c393954d92`. Keeping the superseded ones is
deliberate: deleting a generation would leave this record asserting a history the tree no longer shows.

**C08 is retained and is not in the proof set**, for the same reason P01 is: it is a **discarded
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
the two hook files was **5 insertions and 1 deletion** and nothing else — **neither fix round changed
either hook file**, which is what that unmoved diff establishes and the whole of it. **That reading is taken before
this step's checkpoint commit, and the commit changes it**: the checkpoint stages `PROGRESS.md` and
this record **by path** and leaves the four harness paths in the working tree for 5b and 6 to use and 7
to delete.

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
ran**, and §5.10 is that measurement — including the fact that four **different** binaries ran across
the three retained generations.

## 4. The proof launches

**Twelve plan launches, P37–P48; two no-plan launches, N07–N08; two static confinement launches,
C05–C06; three adversarial confinement launches, C07, C09 and C10.**
**P37–P48 are the proof set** — twelve launches, **one per case of the whole case table**, which is
this step's own acceptance criterion: every state the case table claims to reach has a launch that
reached it, and there is no row in `launch.sh` that no launch of this generation ran.

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
`startProbe()` **attempts** to print `--- failed`; every launch of the proof set has
`failed-lines=0` beside `end-lines=1`, and each positive launch's final block says the file was
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
**Round 2 then found that round 1's fix was itself raceable**, and §4.5 and §10.1 are that half. As
the writers now stand, `replace_the_target` requires a plan, canonicalizes the target and requires it
to be **exactly** `…/launches/<launch>/xdg/espanso/match/conflict.yml`, and canonicalizes the source
and requires it to be a document **directly inside** `…/fixtures` — all three before anything is read
or created, and **with no shell involved at any point**.

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
confinement, which shares the same `replace_the_target` but was not separately pointed outside. And
they are **static**: a path spelled outside the tree before the launch begins, never a path swapped
while the launch runs. §4.5 is the adversarial half, and §10.1 states the one case neither half
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
  shows the planted link still a link, still pointing at the decoy. The temporary's name is normally
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

**What this section does not establish, stated as plainly as it can be.** Confinement is **not proven
against an adversary who replaces an *ancestor directory* of the launch tree with a symlink** between
the canonicalization and the create-or-rename that follows it. **That case is not constructed here and
it is not closed.** Defeating it needs `openat`-style pinned directory handles, which `std` does not
offer; provoking it needs a second process racing a live launch, which this harness has no way to
spawn. It is *accepted*, and the reasons it is acceptable are the ones that make it a residual risk
rather than an argument: the launch root is created by `launch.sh` beneath an operator-controlled
`/private/tmp` path, the instrumented binary is never shipped and never signed, and **step 2c-5-7
deletes both the binary and the tree**. None of those three is a proof of impossibility, and this
record does not offer them as one. §10.1 is the finding this paragraph answers.

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
because a shell is a second pathname resolution the checks cannot cover (§10.1). What survives of that
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
describes**, which is why the proof set starts at P37 rather than at P01.

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
| `0a2d3506630256f6a3193de3352b32b23244e4e8ff7c07b9642a85c393954d92` | **P37–P48, N07, N08, C05–C10** | **the proof set** |

The last is byte-identical to `target/debug/espansoconfig` as it stands now. **That the five digests
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
larger than its proof set would break it. Their fixtures and plans are 5b's to add if 5b needs them —
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
writer creates is named from the process id and a nanosecond stamp, which is exactly what a script
outside the process cannot predict — so the adversarial control that must plant a symlink *at that
path* had nothing to aim at. This variable fixes the name. It is **not** a widening: `probe.rs`
requires the value to begin with the target's own file name followed by `.probe-tmp-` and to contain
no `/`, so the temporary stays in the target's canonical directory either way, and the refusal for a
bad value is a refusal like any other. Only `adversary.sh` sets it; `launch.sh`, `inert.sh` and
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
ended would leave the same artifacts). **That limitation is the widest one in this record and it binds
every absence sentence anywhere in it**: no artifact this harness produces — a final tree, a zero-byte
log, a `bytes=MATCH`, a `tree-diff=0`, an unchanged decoy — can distinguish *no write* from *an
identical or transient write*, and no sentence here may be read as making that distinction. 3c-1 §7.1
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
wrong arm would print as the arm it reads like. What the eleven `reapplyArm=` lines of the proof set
establish (the raw case draws no reapply block at all) is that
the sentence drawn matched the dictionary entry named — not that the model took that branch.

**6.3 Every one of the six authored expected-bytes files was compared, and each matched.** Unlike 4a
§6.3 and 3d-2a §6.3, this tree ships **no un-launched prediction fixture**: `editor-exact-expected.yml`,
`creator-front-expected.yml`, `deleter-exact-expected.yml`, `mover-exact-expected.yml`,
`duplicator-exact-expected.yml` and `third-r2.yml` were each `cmp`-ed by a launch of the proof set and
each answered `MATCH`.
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
— whose digest matches the one now at `target/debug/espansoconfig` — reaches all six write surfaces,
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
`cargo test --workspace` at 1153, and drove nineteen launches of the proof generation to `--- end` with
a zero-byte `probe.err` — twelve plans, two no-plan controls, two static confinement controls and
three adversarial ones. **Neither probe source has a test of its own**, on either side of the wire:
`src-tauri/src/probe.rs` declares no `#[test]` and `src/probe.ts` has no spec file, so every rule in
either — the confinement, the strict plan parser, the exclusive writer — is checked only by a launch or
by reading. **Two review rounds have now found defects in the confinement that no launch would have
shown**, which is what that costs (§9.9, §10.1), and 5b's own §8.2 item 7 is the standing note that a
rule added to either file should come with a test.

**6.6 `probe_third_writer` is exercised now, and this replaces what this section said before.** The
earlier text said it was built and unexercised and asked 5b to treat it as untested code. **Finding 3
showed that was worse than it read**: `runThirdWriter()` was reachable from nothing but an
`export const thirdWriter = runThirdWriter`, written to defeat tree-shaking, and it **did not defeat
it** — `rg -c 'probe_third_writer' dist/assets/index-*.js` matched nothing in the retained bundle while
`probe_second_writer` matched once. The frontend third-writer path **was not in the executable the
proof set ran**, so 5b would have inherited a path that could not be called at all.

It is now reached from the driver's own plan dispatch — `runCase('editor-third')` → `editorPlan`
→ `runThirdWriter()` — and the unused export is gone. Two things check it, and both are needed:
`rg -c 'probe_third_writer' dist/assets/index-*.js` answers **1** on the built bundle, and **P37 ran
it** and printed `--- writer third wrote=yes` before a second conflict against R2 (§4.1). Round 2
re-ran that search on the bundle its own proof set launched and it still answers **1**, with
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

**All seven rows were re-run after each of the two fix rounds**, on the frozen image each proof set
launched, and **every figure is unchanged across all three readings**. That is itself the expected
result and not a surprise: neither round added a source module — `parsePlan`, `waitForOutcomeChange`,
`resolve_existing_file`, `confined_target`, `confined_source`, `temporary_beside` and
`copy_then_rename` all live in the two files that already existed — so the module count had no reason
to move. It is recorded because an unchanged count that was *predicted* to be unchanged is worth more
than one nobody checked.

**Round 2's own arithmetic is worth stating because it is the interesting case.** Round 2 *deleted*
code from `src-tauri/src/probe.rs` (`std::process::Command` and the shell body) and *added* code to it,
and touched only comments in `src/probe.ts` — comments the minifier strips. So the built bundle's
content hash is unchanged and the file is still `dist/assets/index-I5AFZyLL.js`, while the **Rust
binary's digest did change** (§5.10). Those two together are the reading: the frontend is byte-identical
across rounds 1 and 2, the backend is not, and that is exactly the shape of a fix confined to
`probe.rs`.

**The module count was predicted before the build and checked both ways**, which `CLAUDE.md` §6
requires and the number alone no longer decides. 185 was written down as 184 + 1 and the build answered
185 on all three readings. The discriminating oracle over
`dist/assets/index-I5AFZyLL.js`, the bundle the proof set ran:

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
round-1 finding 3 has not regressed.

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
**not proven against an ancestor-directory symlink swap** (§4.5's last paragraph, §10.1).

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
- **Both external writers are confined, and 5b must know exactly how far that goes.** What **is**
  closed, and measured: the target must canonicalize to *exactly*
  `…/launches/<launch>/xdg/espanso/match/conflict.yml` (C10 is the launch that shows a wrong path
  *inside* the tree refused); the source must be a document directly inside `…/fixtures` (C06); a
  plan is required; **there is no shell anywhere in either writer**, so there is no second pathname
  resolution and no exit status that can mask a failed copy; and the temporary is created with
  `O_EXCL`, which C07 measures by planting a symlink at the exact temporary path and watching the
  writer refuse with `File exists` instead of writing through it.
  **What is NOT closed, and is not claimed to be: an ancestor-directory symlink swap.** If something
  replaces a directory *above* the launch tree with a symlink between the canonicalization and the
  create-or-rename, nothing here catches it. That case was not constructed and cannot be defended with
  `std` alone (it needs `openat`-style pinned directory handles). It is accepted because the launch
  root sits beneath an operator-controlled `/private/tmp` path, the instrumented binary is never
  shipped, and 2c-5-7 deletes it — **none of which is a proof, and 5b must not read it as one.**
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
defect round 1's own self-review found and did **not** close; and **§10 is round 2, which found that
§9.1's and §9.2's closures were both overstated.** Where the two disagree, §10 is the later reading.

**9.1 High — the writers were not confined (`replace_the_target`).** **Partially closed at round 1;
narrowed further at round 2; one arm remains open and is stated as open.**

- **Closed and measured.** A plan is required. The target must canonicalize to *exactly*
  `…/launches/<launch>/xdg/espanso/match/conflict.yml` — round 1 required only "beneath `…/launches`",
  and round 2 tightened it to the file (C10 is the launch that shows the difference). The source must
  canonicalize to a document directly inside `…/fixtures`. C05, C06, C09 and C10 (§4.4, §4.5) point the
  second writer at four refused paths and record the decoy unchanged, the launch's own target still at
  R0, and the refusal quoted from the transcript in each case.
- **Closed by construction at round 2.** There is **no shell** in either writer, so the canonical path
  the checks approved is no longer handed to a second process that resolves it again — which was round
  2's High, and which no static control could have caught. The temporary is created with `O_EXCL`, and
  C07 measures that by planting a symlink at the exact temporary path and watching the writer refuse.
- **Open, and not claimed closed.** **An ancestor-directory symlink swap.** Confinement is *not*
  proven against something that replaces a directory above the launch tree with a symlink between the
  canonicalization and the create-or-rename. It is not constructed by any control here and cannot be
  defended with `std` alone. §4.5's last paragraph is the full statement, including the three reasons
  it is *accepted* — none of which is a proof of impossibility.

**9.2 Medium — the writer was not atomic (`cp …; mv …`).** **Closed, but not by the fix this section
used to describe.** Round 1 changed the shell body to `cp … && mv …`; round 2 **deleted the shell
altogether**, which subsumes the finding by construction: there is no exit status left to mask, because
there is no second process. The writer now reads the source in Rust, opens the temporary with
`create_new` (`O_CREAT|O_EXCL`), writes, `sync_all`s, and `rename`s — and a `rename` replaces the final
component itself rather than writing through it. A failed run *attempts* to remove the temporary and
**discards whether that worked**, stated in `copy_then_rename`'s own documentation, because the first
failure is the one worth reporting.

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
because **P02 is not in the proof set**: `editor-exact` was re-run under the current script and the
current binary — as P26 at round 1, and again as **P38** at round 2 — and **all twelve proof launches
have a ten-line `bytes.txt` with the same ten keys in the same order** (§4). P02 is retained,
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
and what is deliberately left open.

**10.1 High — the TOCTOU in `replace_the_target`.** **Two arms, and they got different treatment.**

*Arm A — the temporary-file race. Fixed properly, not narrowed.* `temporary_beside` used to test the
path with `symlink_metadata` and then let `/bin/sh`'s `cp` open the same pathname; a symlink inserted
between those two operations was followed, so an outside file could be overwritten through a path that
had passed every check. **The shell is gone from both writers.** `copy_then_rename` reads the source
with `std::fs::read`, creates the temporary with `OpenOptions::new().write(true).create_new(true)` —
`O_CREAT|O_EXCL`, which fails on a path that exists *at all*, symlink included, and therefore defeats
the insertion race outright rather than shrinking its window — writes, `sync_all`s, and then
`std::fs::rename`s, which replaces the final component itself and never writes through it.
`temporary_beside` now *chooses a name and checks nothing*, which is the point: exclusion moved to the
one place it can be atomic. **This subsumes round-1 finding 2 by construction** — there is no exit
status left to mask, because there is no second process. **C07 is the measurement**: a symlink planted
at the exact temporary path, and the writer answering *"could not create the temporary … exclusively:
File exists (os error 17)"* with the decoy unchanged.

*Arm A also — the target is constrained to the exact synthetic file.* `confined_target` now requires
the canonical target to be `…/launches/<launch>/xdg/espanso/match/conflict.yml`, five components with
four of them fixed, rather than anything beneath `…/launches`; `confined_source` requires the source to
be a document *directly inside* `…/fixtures`. **C10 is the measurement**: a real file beneath the
launch directory, refused by name.

*Arm B — the ancestor-directory symlink swap. **Disclosed, not attempted, and not closed.*** If
something replaces a directory **above** the launch tree with a symlink between the canonicalization
and the create-or-rename, nothing in this instrument catches it. Defeating it needs `openat`-style
pinned directory handles, which `std` does not offer; provoking it needs a second process racing a live
launch, which this harness cannot spawn. **Confinement is therefore not proven against an adversarial
ancestor swap, and this record does not claim it is impossible, unreachable or closed.** It is
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
application still opens an ordinary file. The **ancestor swap is the part that could not be
constructed**, and it is said here rather than omitted.

**10.2 Medium — §9 over-claimed closure.** Corrected. §9.1 now reads *partially closed* with three
named parts — what is closed and measured, what is closed by construction, and what is open — and §9.2
says the shell removal subsumed it rather than that `cp … && mv …` fixed it. §8.1 tells 5b the same
thing in the same words: exactly what the confinement covers, and that **the ancestor swap is residual
and unproven**. Round 2's specific complaint was that §8 told 5b the truth about the third writer but
not about the confinement it inherits; that gap is what §8.1's rewritten bullet closes.

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

- **§6.1** now states the general rule the instances are cases of — there is no invoke spy and no
  command counter, so **no artifact this harness produces can distinguish "no write" from "an identical
  or transient write"**, and no sentence anywhere in the record may be read as making that distinction.
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
