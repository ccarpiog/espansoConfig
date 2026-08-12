# Phase 2c-4c step 4a — the window-reading instrument, rebuilt from the records

Step 2c-4c-5 is the bilingual window reading the phase owes for six surfaces, and 2c-4c-4b adds the
recovery cases it needs. **This step is neither**, and nothing here judges a screen. It rebuilds
**both halves** of the harness `2c-4b-3d-3` deleted and shows, with six launches and one per write
surface, that **the retained executable those launches ran** reaches every write surface — exactly as
3d-2a proved its rebuild before the 3d-2b reading, 3b proved the instrument before 3c-2's reading, and
2c-4a-3c-1 provoked a true `SaveResult::Conflict` before its own reading.

**"The rebuilt whole runs" is one claim too many, and §6.4 is why.** No retained artifact binds any
executable here to a source snapshot or to a build command, so *this source tree runs* is not
available: what the bundles pin is **which bytes ran**, and the strongest true conjunction is that
P07–P12 ran an executable whose digest matches the one now standing at `target/debug/espansoconfig`.
Source inspection separately establishes that the plans are coherent. **Those two readings may not be
conjoined into source provenance**, and the first version of this record conjoined them in **three
passages** — this opening, §4's sentence naming the proof set, and §6.4's statement of the whole
claim. All three are narrowed in place, and each says what it used to say.

**This is a bigger rebuild than 3d-2a's, and the difference is the part no record has ever
described.** 3d-2a still had `src/probe.ts` and `src-tauri/src/probe.rs` in the working tree and had
only the scratch half to rebuild. Both were gone here. `src-tauri/src/probe.rs` has therefore been
**authored from the code** for the first time in this project's history: no record carries its
source, and `2c-4a-3c-1-instrument.md` §1 and §5.3 — four function names and one arrangement — are
the whole of what survives about it. §2 keeps *recovered*, *re-authored from a description* and
*authored from the code* apart, because they are three different provenances and none of them is
recovery.

**Nothing here was recovered.** The sweep §1 describes found no copy of the deleted tree and no copy
of either probe source, so every fixture is **re-authored from the descriptions** in
`2c-4b-3b-instrument.md` §4, `2c-4b-3c-1-notes.md` §2 and `2c-4b-3c-2-window-reading.md` §1.3, every
expected-bytes document is authored from those records' *Expected afterwards* columns, and both
probe sources are authored from the production source they drive.

**Byte-identity with the originals is contradicted for two files and unknown for the rest, and those
are different statements.** 3b §5 records R0 as `507e98f5…` and `elsewhere-r1.yml` as `31be59eb…`;
this tree's are `9246ae21…` and `04e4bef8…` (§4.2), so for those two byte-identity is positively
contradicted. For every other rebuilt file there is **no surviving original, no old digest and no
before-manifest**, so byte-identity is neither claimed nor contradicted; it is not established either
way.

---

## 1. Where the tree is, and what happened to the old one

**The new scratch tree is `/private/tmp/espansoconfig-harness-2c-4c/`**, outside the repository.
**Steps 4b, 5 and 6 all need that path.**

```
/private/tmp/espansoconfig-harness-2c-4c/
  launch.sh                        one launch: the case table, the seed, a fresh bundle, the wait, the byte checks
  fixtures/                        21 files — 1 R0, 11 R1 documents, 9 authored expected-bytes documents
  launches/P01…P12/                per launch: xdg/, xdg-before/, home/, espansoConfig.app,
                                   probe.log, probe.err, bytes.txt, tree.diff
  manifest-2c-4c-4a-post.sha256    48 entries — a post-image, in 3c-1 §5.7's sense
```

It is **493 MB** after twelve launches, because `launch.sh` assembles a fresh `.app` bundle per
launch and every launch keeps its own. That is the growth rate 2c-4b-3d-3 §4.2 predicted and not a
measurement of what a rebuild costs.

**The old tree was already gone before this step began, and this step did not delete it.**
`/private/tmp/espansoconfig-harness-2c-4b-3d/` does not exist; a sweep of `/private/tmp` with
`rg --files --hidden --no-ignore` finds exactly one `launch.sh`, this step's own, and no
`manifest-3d-2a-post.sha256`, `manifest-3d-2b-post.sha256` or `manifest-3d-2b-fix-post.sha256`. That
is a statement about `/private/tmp` and about nothing else on the machine. **No manifest is under
version control**, so this step had no before-image to check anything against — the same hole 3d-2a
had, one rebuild deeper.

**The owner's real configuration was never opened.** Every launch points `XDG_CONFIG_HOME` at the
synthetic two-file tree `launch.sh` writes and `HOME` at an empty directory, so neither candidate
`resolve_config_dir()` (`crates/espansoconfig-core/src/discovery.rs`) probes can reach it. Every
fixture is neutral and hand-authored: `:alpha`, `:beta`, `:gamma`, `:probe` and nothing else.

**The tracked files that differ from `HEAD` are the two the harness hooks, and `HEAD` is still
`cc2db8f`** — and that is a reading of the tree **at the close of this step's work**, never a
comparison with a before-image, and never a claim about the tree at any later moment.
`git status --short --untracked-files=all`, read at that moment, listed four paths plus this record:
`src/main.ts` and `src-tauri/src/main.rs` modified, `src/probe.ts` and `src-tauri/src/probe.rs`
untracked, and this file untracked under `docs/`. `git diff` over the two hook files was exactly the
four lines §2.1 quotes and nothing else — 5 insertions and 1 deletion, the same figure 3d-3 §1.1
records for the reverse operation. **That reading is taken before this step's checkpoint commit, and
the commit changes it**: the checkpoint stages `PROGRESS.md` and this record by path and leaves the
four harness paths in the working tree for 4b and 5 to use and 6 to delete.

**What no artifact here can establish is what this step did *not* alter along the way.**
`manifest-2c-4c-4a-post.sha256` is a **post-image by construction** and cannot say what any file held
before. *No git command that changes anything was run* and *no editor was run over any file outside
the four harness paths and this record* are **accounts of what was done**, not readings of an
artifact; what the tree gives is the four-path `git status` above and the diff, at the moment stated.

## 2. What was rebuilt, file by file, and from what

| Rebuilt file | Built from | Provenance |
|---|---|---|
| `src-tauri/src/probe.rs` | `2c-4a-3c-1-instrument.md` §1 (the four item names), §5.2 (the second writer's shell command, quoted), §5.3 (registration beside the shipped list); `3b` §6.8 (the same arrangement); and `src-tauri/src/main.rs` for the thirteen commands it must re-register | **authored from the code** — no record carries its source |
| `src/probe.ts` | 3b §2 (the plan-string shape), §6.2–§6.7 (the five rules), §8.9; 3c-1 §3 (`moverPlan`'s destination parameter); 3c-2 §1.2 (`reportViewport`, `reportReach`, `reportReadiness`, `BLOCK_TEXT_LIMIT` 4000, `repeatIfAsked`); 3d-2a §8.1 (`editorReloadPlan`, the `draft` parameter); and the six components' own markup for every selector and dictionary key | **authored from the code**, against the records' described behaviour |
| `launch.sh` — the recipe, the wait, the checks | 3b §2 (the `open` invocation verbatim), 3b §6.1 (the build order), 3b §8.9 (what it may and may not conjoin), 3d-2a §3 and §5 | re-authored from a description |
| `launch.sh` — the case table, 23 rows | 3b §4 (11 cases), 3c-1 §2 (8 cases), 3c-2 §1.3 (`mover-reordered-end`), 3d-2a §8 (3 cases) | re-authored from a description |
| `fixtures/base-r0.yml` | 3b §4: one comment line and a `matches:` sequence of `:alpha`, `:beta`, `:gamma`, each a double-quoted `trigger:` and a plain `replace:` | re-authored from a description |
| `fixtures/elsewhere-r1.yml`, `target-changed-r1.yml` | 3b §4 | re-authored from a description |
| `fixtures/target-labelled-r1.yml` | 3c-1 §2.1, which quotes the three lines whole — reproduced character for character | re-authored from a description |
| `fixtures/target-satisfied-r1.yml` | 3c-1 §2.2 | re-authored from a description |
| `fixtures/target-ambiguous-r1.yml` | 3c-1 §2.3, which quotes the two `":beta"` items whole — reproduced character for character | re-authored from a description |
| `fixtures/target-deleted-r1.yml` | 3c-1 §2.4 | re-authored from a description |
| `fixtures/reordered-r1.yml`, `anchor-changed-r1.yml` | 3c-1 §2.5 | re-authored from a description |
| `fixtures/reordered-beta-first-r1.yml` | 3c-2 §1.3 | re-authored from a description |
| the 9 `*-expected.yml` files | 3b §4 and 3c-1 §2.5's *Expected afterwards* columns, 3c-2 §1.3 for `mover-end-expected.yml`; `creator-front-expected.yml`'s emitted item from `choose_scalar` and `render_item` | authored from those columns, and from the code for the one emitted item |
| `fixtures/target-empty-replace-r1.yml`, `target-empty-quoted-r1.yml` | 3d-2a §8.2, which describes them and their three-byte difference but quotes neither whole | re-authored from a description |

**Every byte no record fixes is this step's own choice.** In particular the leading comment line's
wording is this step's: 3b §4 says "one comment line" and no record quotes it. The second file of the
synthetic tree is this step's too (§5.3).

### 2.1 The four hook lines, and what the tree establishes about them

`git diff` over the two hook files is exactly:

- `src-tauri/src/main.rs`: `mod probe;` (`:47`) and
  `probe::register_with_probe(tauri::Builder::default())` replacing `register(…)` (`:124`);
- `src/main.ts`: `import { startProbe } from './probe';` (`:20`) and `startProbe();` (`:37`).

Those are the same four lines and the same two line numbers `2c-4b-3d-3-notes.md` §1.1 records
having removed, and the same `5 insertions, 1 deletion` its §1.1 records. **That is a coincidence
worth stating rather than a check**: nothing here compared this tree with the pre-removal one, and
the agreement follows from `git checkout --` having restored `HEAD` exactly and this step having
re-applied the same edits to the same file.

### 2.2 Three things the records left open that had to be decided from the code

Each is a place where the records name a behaviour and not its mechanism, and each was settled by
reading production source rather than by guessing.

- **How the driver resolves a label.** The records say `pressNamed('browser.matchMove.position.top')`
  — a literal dictionary key — and 3c-2 §1.2(3) says a lookup is "by the text the running language
  gives the key". `src/probe.ts` therefore calls `translate(language, key, params)` from
  `src/lib/i18n/dictionaries.ts` and matches a button's whole collapsed text **exactly**. Exactness
  is load-bearing: `browser.matchDeletion.open` is *"Delete this snippet…"* and
  `browser.matchDeletion.request` is *"Delete this snippet"*, so a containment test would press
  whichever came first.
- **How the creator chooses a placement.** `MatchCreator.svelte:644` draws a `<select>` whose option
  values are model-minted keys, where `MatchMover.svelte:683` draws a `<ul class="destinations">` of
  buttons. The two surfaces therefore need two mechanisms, and no record says so. The driver matches
  the option by its **text** and assigns `select.value` from the option it found, so it never builds
  a key.
- **What `creator-front-expected.yml`'s new item looks like.** `render_item`
  (`crates/espansoconfig-core/src/patch/edit.rs:5704`) writes `marker` spaces then `- ` for the first
  field and two spaces for the rest, and `choose_scalar`
  (`crates/espansoconfig-core/src/emit/choose.rs:80`) refuses a plain scalar that starts with `:`
  (`LEADING_INDICATORS`) and falls through to single quotes. So the emitted item is
  `  - trigger: ':probe'` / `    replace: probe creation`. **P08 matched that file byte-for-byte**,
  which is the evidence; the derivation above is why it was written that way.

## 3. The launch recipe, as this tree runs it

```sh
# once, and IN THIS ORDER — 3b §6.1, because the bundle embeds `dist` at *cargo* build time
npm run build
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol

# per launch, into a launch name never used before
/private/tmp/espansoconfig-harness-2c-4c/launch.sh <case>[:<lang>[:twice]] <name>
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

The script **refuses a launch name it has already used** (verified: a second
`launch.sh editor-exact:en P01` printed *"launch name P01 has already been used; pick another"* and
exited 65), seeds `base-r0.yml` as `xdg/espanso/match/conflict.yml` beside a synthetic
`xdg/espanso/config/default.yml`, copies the tree to `xdg-before/` **before** launching, assembles
the `.app` by copying whatever `ECFG_BINARY` names — defaulting to `target/debug/espansoconfig` —
waits for `--- end` or 25 seconds, kills the process, then `cmp`s the target against the case's
expected file, searches for `.espansoconfig-backups`, and diffs the tree against the pristine copy.
**It conjoins none of that** — 3b §8.9 — and this rebuild did not give it the power to: it does not
look for `--- failed`, it does not compare the three revisions a conflict panel prints, and it will
write `reached-end=yes` beside a `bytes=DIFFER`.

**"Freshly built" is not a claim these artifacts carry.** Nothing in the script checks a timestamp,
re-runs the build or records a build transcript, and **no build transcript was retained**. The block
above is the recipe in the order 3b §6.1 requires. What the retained bundles *do* pin is **which
bytes ran**, and §5.10 is that measurement — including the fact that P01–P06 and P07–P12 ran two
**different** binaries.

## 4. The proof launches

**Twelve launches, in two sets of six.** P01–P06 are the first pass; P07–P12 are the same six cases
re-taken after `cargo fmt --check` reported one formatting diff in `src-tauri/src/probe.rs` and it
was fixed and the binary rebuilt (§5.10). **P07–P12 are the proof set** — they ran the retained
executable whose digest matches the one now standing at `target/debug/espansoconfig`, which is a
statement about bytes and **not** about source provenance (§6.4) — and P01–P06 are retained and
reported because they are what the pre-fix tree did.

Each launch satisfies, by hand, the same four-part conjunction 3b §8.9 defines: no `--- failed`
line; a conflict block with three revisions where `expected ≠ found` and `diskRevision == found`; the
expected control and action lines for that surface; and the intended byte predicate. **Nothing in the
harness conjoins those four; a reader did, on all twelve.**

| # | Case | Surface | Lang | `expect=` | `bytes=` | `backups=` | `probe.err` | `--- end` / `--- failed` |
|---|---|---|---|---|---|---|---|---|
| P07 | `editor-exact` | editor | en | `editor-exact-expected.yml` | **MATCH** | **PRESENT** | 0 bytes | present / absent |
| P08 | `creator-front` | creator | es | `creator-front-expected.yml` | **MATCH** | **PRESENT** | 0 bytes | present / absent |
| P09 | `deleter-exact` | deleter | en | `deleter-exact-expected.yml` | **MATCH** | **PRESENT** | 0 bytes | present / absent |
| P10 | `mover-exact` | mover | es | `mover-exact-expected.yml` | **MATCH** | **PRESENT** | 0 bytes | present / absent |
| P11 | `duplicator-exact` | duplicator | en | `duplicator-exact-expected.yml` | **MATCH** | **PRESENT** | 0 bytes | present / absent |
| P12 | `raw-negative` | raw | es | `elsewhere-r1.yml (R1)` | **MATCH** | **none** | 0 bytes | present / absent |

P01–P06 are **the same six case/language pairings** — there are two languages in this project, not
six — with the same `bytes=`, `backups=` and `probe.err` results and the same absence of `--- failed`.

**Six launches, all six write surfaces, one language per surface, three launches in each language,
five positives and one negative-capability case.** That is aggregate bilingual coverage and **not**
per-surface bilingual coverage: English was used only for the editor, the deleter and the duplicator,
Spanish only for the creator, the mover and the raw editor, and **no surface here was launched in
both**. Step 5 is the reading that owes both languages on every surface; this step does not give it.
Every launch picked its language **through the picker** and printed `documentElement.lang` — `en` in
P07, P09 and P11, `es` in P08, P10 and P12 — which is 3b §6.7's rule, and it matters because the
WebKit data store follows the bundle identifier that every probe bundle shares.

### 4.1 What each one showed, quoted from its retained transcript

The viewport is `1180 x 728`, `dpr=2`, `hasFocus=false`, `visibility=hidden`, on every one of the
twelve. Every conflict block shows `expected` `9246ae21…` against a `found` of `04e4bef8…` that
equals its `diskRevision`.

- **P07** — conflict panel `box=658,44,491x1032`; four choices in the order *Keep editing · Copy my
  text · Keep my draft · Load the version on disk*, `keepMyDraft=present keepMyRequest=absent`;
  `readiness ready=present box=667,921,472x119`; *Keep my draft* pressed, `reapplyArm=reapplied`;
  *Save this snippet* pressed again; a final block saying the file was written. The file ends
  byte-identical to `editor-exact-expected.yml`.
- **P08** — placement *Al principio de la lista* chosen inside the creator's own section; panel
  `box=658,44,491x925`; `keepMyDraft=present`; *Conservar mi borrador* pressed,
  `reapplyArm=reapplied`; *Añadir este fragmento* pressed again. The file ends byte-identical to
  `creator-front-expected.yml`, `:probe` first.
- **P09** — panel `box=658,44,491x758`; three choices, `keepMyRequest=present`;
  `readiness ready=absent readyOperation=present box=667,629,472x137`; *Keep what I asked for*
  pressed, `reapplyArm=reapplied`; then the deletion **request** control and the **confirmation**
  control each found and pressed — a missing one would have printed `--- failed`. The file ends
  byte-identical to `deleter-exact-expected.yml`.
- **P10** — destination *Al principio de la lista* chosen inside `.mover .destinations`; panel
  `box=658,44,491x775`; *Conservar lo que he pedido* pressed, `reapplyArm=reapplied`; *Mover este
  fragmento* pressed again. The file ends byte-identical to `mover-exact-expected.yml`, `:beta`
  first.
- **P11** — panel `box=658,44,491x758`; *Keep what I asked for* pressed, `reapplyArm=reapplied`;
  *Duplicate this snippet* pressed again, then the ordinary `DuplicateKeepsTriggerDefinition`
  acknowledgement **waited for** and pressed. The file ends byte-identical to
  `duplicator-exact-expected.yml`: two adjacent `:beta` items.
- **P12** — panel `box=658,179,491x510`; **three** choices and `keepMyDraft=absent
  keepMyRequest=absent`; `readiness ready=absent readyOperation=absent`. The file ends byte-identical
  to R1, `backups=none`, and `tree.diff` is exactly the second writer's own change to `:alpha` and
  nothing else.

**A control this list says was "pressed" is one the driver waited for and clicked, and the transcript
prints no line for it.** `pressNamed` throws when the control does not arrive, and `startProbe()`
catches that and prints `--- failed`; no launch printed one, and each positive launch's final block
says the file was written. That conjunction is a reader's, not the harness's.

**Two rectangles differ between the two sets, with identical panel text, and neither half is judged
here.** P10's mover panel is `491x775` where P04's was `491x758`, and P12's raw panel is
`658,179,491x510` where P06's was `658,196,491x493` — 17 pixels in both cases. The two raw
transcripts' panel text is **byte-identical** (1094 characters, compared programmatically), so this
is a layout difference and not a content one. Recorded as a measurement for step 5 to re-take, **not**
as a regression claim. It is the same 17-pixel figure 3d-2a §4.1 reported against 3c-2's ledger.

### 4.2 The revision digests are **not** the recorded ones, and that is evidence about the fixtures

3b §5 records R0 as `507e98f5…` and `elsewhere-r1.yml` as `31be59eb…`; 3c-1 §4 records both
unchanged. **This tree's R0 prints `9246ae21…` and its `elsewhere-r1.yml` prints `04e4bef8…`.** The
fixtures were re-authored from prose, so **byte-identity with the originals was never claimed and is
now positively contradicted for those two**. What follows practically: **steps 4b and 5 cannot use
digest equality with 3b's or 3c-2's ledger as a continuity check**, and any launch record they write
should print its own digests.

**One useful fact fell out of the manifest and is worth carrying**: a fixture's `ContentRevision` as
the window prints it is **equal to its SHA-256**. `shasum -a 256 fixtures/base-r0.yml` is
`9246ae21529f46fe006d89616ceee9c398af77e2edbafd950def72968edda479`, which is exactly what every
conflict block prints as `expected`; `elsewhere-r1.yml` is `04e4bef8…`, which is what they print as
`found` and `diskRevision`. That gives step 5 a way to check a transcript's revisions against a file
on disk without launching anything. **It is an observation of these two files on this build**, not a
documented property of the revision function.

## 5. Deviations from what the records describe

Each is a place this tree differs from the instrument the records describe. None is an improvement
offered silently. **5.10 is a measurement rather than a deviation** and sits here because it is what
replaces a claim §3 would otherwise make.

**5.1 A new scratch path, and not a session scratchpad.** The tree is
`/private/tmp/espansoconfig-harness-2c-4c/`, a stable path, rather than this session's own scratchpad
directory — 3d-2a §5.1's reasoning, unchanged: steps 4b, 5 and 6 are different sessions, and the
tree the original harness lost was a session scratchpad keyed to a session id that no longer existed.

**5.2 Both probe sources are authored, not rebuilt.** 3d-2a's deviation list had no equivalent row
because both files survived there. `src-tauri/src/probe.rs` follows the four item names
`2c-4a-3c-1-instrument.md` §1 gives, the shell command its §5.2 quotes, and the registration
arrangement its §5.3 insists on; everything else — the environment-variable names' handling, the
explicit stdout flush, the error strings — is this step's. `src/probe.ts` follows every behaviour the
records describe; its internal shape is this step's.

**5.3 The second file of the synthetic tree is this step's own.** The records say "a synthetic
two-file tree" and never what the second file holds. Here it is `xdg/espanso/config/default.yml`,
two lines, neutral, never opened by any plan.

**5.4 The backup search does not use `fd`.** `fd` is not installed on this machine, and the records
do not say which tool the old script used. This script does it in two halves: a direct `[ -d ]` test
on `<config root>/.espansoconfig-backups`, and a sweep with `rg --files --hidden --no-ignore`.
`backups=none` requires both to find nothing. The directory test is what catches an **empty** backup
directory at the root, which a file listing cannot see; **an empty one somewhere else would evade
both halves**, and no `backups=none` line in this record claims more than these two searches
performed.

**5.5 `bytes.txt` carries three lines the records do not cite.** The records cite `bytes=` at line 4
and `backups=` at line 5 and 3d-2a §5.5 adds `expect=` at line 6; those three keep their positions.
This step adds `tree-diff=`, `binary=` (the SHA-256 of the executable inside that launch's own
bundle) and `probe.err=` after them. The `binary=` line exists so §5.10's measurement is legible from
a launch's own artifacts rather than only from this record.

**5.6 The script kills the application after the wait.** `pkill -f "$APP/Contents/MacOS/espansoConfig"`,
then one second, **after** the wait and **before** the byte checks. 3d-2a §5.6's reason is unchanged.

**5.7 The bundle is hand-assembled**, with an `Info.plist` carrying `cc.carpio.espansoConfig` —
`src-tauri/tauri.conf.json`'s own identifier. 3d-2a §5.7's reason is unchanged.

**5.8 The launches are named `P01…P12`.** Not `L…` and not a continuation of 3d-2a's `P01…P75`: those
artifacts are gone and a shared numbering would read as a shared ledger.

**5.9 A post-image manifest was written.** `manifest-2c-4c-4a-post.sha256`, **48 entries** —
`launch.sh`, all 21 fixtures, both probe sources and every retained `probe.log` and `bytes.txt`;
`shasum -a 256 -c` succeeds for all 48. **It is a post-image only**, and it is evidence for steps 4b
and 5 rather than for this step: with no before-image it cannot establish what this step did not
alter. Steps 4b and 5 should **append rather than regenerate** — 3d-2a §8.5 is this project's record
of what regenerating one destroyed.

**5.10 Two binaries ran, and the artifacts pin which — never their provenance.** Every launch keeps
its whole bundle, so `Contents/MacOS/espansoConfig` is a retained artifact per launch, and
`bytes.txt` records its digest. Measured across all twelve: **P01–P06 ran
`112f78c828a6292910398cff7d8b6585f9b7cdd5398f8763ab1da89703de3fa2`** and **P07–P12 ran
`8f650ddaee7ea4d91c8f29e073b6754d94fa3fae694876e7dbe16db3ca49d538`**, and the second is
byte-identical to `target/debug/espansoconfig` as it stands now. **That the two digests differ is the
whole of what is established**: no retained artifact binds either executable to a source snapshot or
to a build command, so *the formatting fix was applied to `probe.rs` and the binary rebuilt* is an
account of what was done and not a reading of these bundles. `launch.sh` would have copied any binary
it was pointed at.

**5.11 `reportReach` is included and `reportReadiness` is called on every surface.** 3c-2 §1.2 added
both to the driver it inherited; this rebuild wrote them in from the start rather than leaving step 5
to add them, because step 5 is a reading and the reach measurement is one of the things it reads.
The scroller is found by **computed `overflow-y`** and never by "its content is taller than its box"
— 2c-4a-3c-2 §1.1(4)'s mistake — and the scroller's `scrollTop` is restored afterwards.

**5.12 `repeatIfAsked` exists and no launch of this tree used it.** The `:twice` third segment is
built and untested here, exactly as it was at 3d-2a (§6.4 item 4).

## 6. What this rebuild does **not** prove

3b §8, 3c-1 §7 and 3d-2a §6 are inherited whole, and this section adds what this step's own shape
costs.

**6.1 Inherited, unchanged, and every word of it still applies.** 3b §8.1 (**nothing here is a window
reading** — no launch of this step judged whether a person could read, reach or understand
anything); §8.2 (it cannot fail because a sentence is untrue; the transcript prints the strings the
panels drew and a false one prints exactly as well as a true one); §8.3 (`HTMLElement.click()` is not
a mouse click; no plan used the keyboard, tabbed, or produced an untrusted-event refusal); §8.7 (the
adoption arm is invisible: `installed` and `alreadyThere` both reach `reapplied`); §8.8 (it says
nothing about the real configuration); §8.9 (`--- end` proves the wrapper reached its last logging
statement and nothing else); §8.11 and 3c-1 §7.0 (**there is still no invoke spy and no command
counter**, so *a refusal issued no save command* is not established — what P12 shows is a final
filesystem state, and a write producing identical bytes or a transient one undone before the launch
ended would leave the same artifacts). 3c-1 §7.1 (a byte match is not a proof of mechanism), §7.2
(the correspondence tier is invisible), §7.3 (refusals are not attributed to the rules they were
designed around) and §7.4 all hold here without amendment.

3c-1 §7.5 holds with 3d-2a's amendment: the fixture shape is still the easy one — double-quoted
triggers, one leading comment, LF endings, no BOM, no block scalars, no item-owned comments, no
blank-line runs, no second sequence, no read-only file, no package — plus the two `replace:` shapes
§8.2 of that record added. **R38 is untouched: none of the fifteen corpus fixtures `CLAUDE.md` §4
lists has been through this harness**, and the consult ruled that step 5 closes only the shapes
directly relevant to recovery.

**6.2 Seventeen of the twenty-three cases were not launched at all.** Six ran, one per surface. Every
other case has a fixture pair and a case-table row and **nothing in this step shows that the pair
produces what the case name says**. The seventeen, named so that none hides in a summary:
`editor-collision`, `editor-fallback`, `editor-satisfied`, `editor-ambiguous`, `editor-missing`,
`editor-ineligible`, `editor-empty-satisfied`, `editor-reload-gone`, `creator-anchor`,
`creator-anchor-gone`, `deleter-changed`, `duplicator-changed`, `mover-changed`, `mover-reordered`,
`mover-reordered-end`, `mover-after` and `mover-after-changed`.

**Every surface was driven and most cases were not.** Of the six that ran, five are positives and one
is the raw editor's negative-capability case. **No *post-reapply refusal arm* on any surface was
launched here** — that is the narrow claim, and an earlier wording of it said *no refusal on any
surface*, which contradicts §4's own "one negative-capability case" and its P12 row. The raw editor's
negative case **was** launched; what no launch reached is a surface that offers reapply and then
refuses it. No case that 3c-1 or 3d-2a added was launched here. A case-table row is not evidence, and the fixtures
behind those seventeen rows were authored by the same reasoning as the six that ran — which is an
argument for expecting them to work and not an observation that they do.

**6.3 Four of the nine authored expected-bytes files were never compared against anything.** P07,
P08, P09, P10 and P11 matched `editor-exact-expected.yml`, `creator-front-expected.yml`,
`deleter-exact-expected.yml`, `mover-exact-expected.yml` and `duplicator-exact-expected.yml`. The
other four — `editor-fallback-expected.yml`, `mover-reordered-expected.yml`,
`mover-after-expected.yml` and `mover-end-expected.yml` — are **predictions**, authored from the
records' *Expected afterwards* columns and from the byte-preservation reasoning that a move relocates
owned runs without respelling them. **If one of them is wrong, the first launch to use it reports
`bytes=DIFFER`, and the fault will be this file's and not the application's.** Step 5 should read a
`DIFFER` on an un-launched positive as a suspect fixture first. The five that did match are the
reason to expect the other four to — including `creator-front-expected.yml`, the one fixture derived
from `choose_scalar` and `render_item` rather than from byte preservation, which matched
byte-for-byte.

**6.4 Continuity with any earlier ledger is not established and cannot be.** No before-image of any
deleted tree survives, so nothing compares this `launch.sh`, these fixtures or either probe source
with what 3d-2b ran, and §4.2 shows the digests differ for the two files this step has old digests
for. The claim this step can make is narrower and is the whole of it: **the retained executable P07–P12
ran — whose digest matches the one now at `target/debug/espansoconfig` — reaches all six write
surfaces, draws the conflict arms those surfaces drew for 3c-2 and 3d-2b, and produces the byte
predicates its case table names, on the six cases it ran.**

**That is deliberately not "a tree rebuilt from the records reaches all six write surfaces"**, which
is what this paragraph said until the review. No retained artifact binds any executable here to a
source snapshot or a build command — no build transcript was kept, and `launch.sh` copies whatever
`ECFG_BINARY` names without checking a timestamp — so a claim about *the tree* is a conjunction of two
readings that may not be conjoined: source inspection says the plans are coherent, and the bundles say
which bytes ran. **Source-to-binary provenance is unknown here**, and every sentence in this record
that appeared to give it has been narrowed to the executable.

**6.5 Neither probe source was verified against anything.** Both are untracked, so git holds no
baseline, and no manifest of any earlier tree survives. *This `probe.rs` behaves as 3c-2's did* is
**not** a statement any artifact here supports; what is supported is that this one compiles, passes
`cargo fmt --check` and `cargo clippy --workspace --all-targets -- -D warnings`, leaves
`cargo test --workspace` at 1112, and drove twelve launches to `--- end` with a zero-byte `probe.err`.

**6.6 The five holes 2c-4b left are still holes, and this step closed none of them.** They are
`2c-4b-3d-3-notes.md` §4.1's list, carried into `PROGRESS.md`'s "Next action": `browser.notice.gone`'s
second producer (`repairSelection`'s `clearSelection` arm,
`src/lib/browser/selection.ts:292`), and the confirmed-reload transition on the creator, the deleter,
the mover and the duplicator. This tree has a reload case on **one** surface — `editor-reload-gone`,
rebuilt from 3d-2a §8.3 — and it was **not launched here**. Adding the other four costs a plan
function each, not a launch. **Step 4b is the natural place**, since it is adding recovery cases
anyway; they remain obligations of no 2c-4b record.

**6.7 The instrument already *reaches* recovery markup and *reports* none of it, and those are two
different statements.** An earlier version of this section said *nothing about recovery is in this
instrument*, and that is **false** — it was corrected by this step's review, which traced the mounts
rather than reading the case table.

What the code gives, verified in the components and not inferred from the case names:

- `MatchDeleter.svelte:548`, `MatchMover.svelte:815`, `MatchDuplicator.svelte:708` and
  `RawEditor.svelte:541` mount `RecoveryWithoutCreation` **unconditionally**, handing it the live
  `view.conflict`; the renderer owns the `{#if}` itself (that is 2c-4c-3b's High). So **P09, P10, P11
  and P12 drew a recovery sentence**, because each of them had a conflict when it did.
- `MatchEditor.svelte:908` and `MatchCreator.svelte:791` mount `RecoveryPanel` from their reapply
  outcome and retained conflict, and `manualResolution` is the arm that opens it.

What is genuinely absent is **reporting and activation**, not reach: the driver reads only the
non-reapply status panel and then `[role="status"]` blocks (`src/probe.ts:367`, `:379`, `:486`,
`:506`), so `[data-recovery-without-creation]` never enters a transcript, no launch asserts or presses
the editor's and creator's recovery offer, and no plan drives an **opened** recovery form through its
own create / refusal / conflict / reload outcomes.

**So step 4b's scope is narrower and sharper than "add recovery to the instrument".** It is: targeted
reporting of `[data-recovery-without-creation]` on the four non-creating surfaces; targeted reporting
**and activation** of the editor's and creator's recovery offer; and a `.recovery`-scoped driver for
the opened form, which needs its own scope because that form has status panels of its own and an
unscoped `[role="status"]` sweep would conflate them. `RECOVERY_WITHOUT_CREATION_ATTRIBUTE` is what a
plan looks for, per `PROGRESS.md`'s "What 3b left" item 1 — the element, never a string.

**None of §4's six green rows is evidence about recovery markup**, which is what the false sentence
was written to prevent a reader concluding; that purpose was right and its wording was not.

**6.8 Nothing here is a reading, and no finding of any earlier reading was re-checked.** 3c-2's and
3d-2b's findings are untouched by this step.

## 7. The gates, **with the harness in the tree**

**These are with-harness figures and are not production numbers.** Step 6 re-derives the production
ones on a harness-free tree; carrying a with-harness figure forward as production is exactly the
defect `2c-4b-3d-3-notes.md` §3 found. Each row states its arithmetic against the harness-free
baseline the orchestrator measured on the clean tree at `cc2db8f`.

| Command | With the harness | Harness-free baseline | Why it moved |
|---|---|---|---|
| `npm test` | **1768** passed, 51 files | 1767 | `src/probe.ts` is one more case of `scripts/lint/ipc-detail.test.ts`'s per-file `it.each` sweep |
| `npm run check` | **424** files, 0 errors, 0 warnings | 423 | one more file for `svelte-check` to walk |
| `npm run build` | **181** modules | 180 | one new source module, and `src/probe.ts` has no `<style>` block |
| `cargo test --workspace` | **1112** passed, 0 failed | 1112 | unmoved: `src-tauri/src/probe.rs` declares no test |
| `cargo fmt --check` | clean | — | after one fix (§5.10) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | — | |
| `cargo tree -p espansoconfig-core \| rg tauri` | finds nothing | — | the architecture rule, unchanged |

**The module count was checked both ways, which `CLAUDE.md` §6 requires and the number alone no
longer decides.** 181 is 180 + 1 for one new `.ts` source module with no styles, and
`dist/assets/index-DWWEpLvf.js` was searched for `svelte/internal/server`, `svelte/server`,
`internal/server` and `async_hooks` — **none present**.

**An unmoved count is evidence of an unmoved count and of nothing broader**, and **no gate transcript
was retained**: these rows are this record's account of what the commands printed, re-checkable only
by running them again.

**One production behaviour did change, and the true statement is narrower than "none did".** With
`ECFG_PROBE_PLAN` absent, no plan drives the DOM and no second writer runs — `startProbe()` returns
as soon as `probe_plan` answers `null`. But the instrumented build is not the shipped one:
`register_with_probe` makes `probe_plan`, `render_probe` and `probe_second_writer` **three extra
callable IPC commands** on every launch, and `src/main.ts` calls `startProbe()` unconditionally, so
**every startup pays one extra IPC round trip**. Both are gone when step 6 removes the harness;
neither is gone before then.

## 8. What steps 4b, 5 and 6 need from this record

- **The tree is `/private/tmp/espansoconfig-harness-2c-4c/`.** 4b extends its case table and
  fixtures; 5 launches from it; 6 deletes it.
- **The four harness paths stay in the working tree**: `src/main.ts` and `src-tauri/src/main.rs`
  modified by two hook lines each, `src/probe.ts` and `src-tauri/src/probe.rs` untracked. Step 6
  removes them; `2c-4b-3d-3-notes.md` §1.1 is the method, including why `git checkout --` needed two
  observations rather than its name.
- **Never `git commit -a` or `git commit -am` while probe files are in the tree.** Stage by path.
- **Rebuild in the order §3 gives after every driver edit**, and before the first launch depending on
  it. `npm run build` alone changes nothing.
- **Append to `manifest-2c-4c-4a-post.sha256` rather than regenerating it**, or record the digests it
  held first (3d-2a §8.5).
- **Digest equality with 3b's or 3c-2's ledger is not available** (§4.2); a fixture's revision equals
  its SHA-256 on this build, which is a cheaper check and a narrower claim.
- **The gate figures above are with-harness figures.** Step 6's targets are the harness-free
  1767 / 423 / 180 / 1112, and it must **re-derive** them rather than copy any number from here.
