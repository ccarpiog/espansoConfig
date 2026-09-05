# Phase 2d-5-2c step 1 — the window-reading instrument, rebuilt from the records

Step 2d-5-2c-2 is the narrow window regression reading of Phase 2d-5-2's changes. **This step is not
that reading, and nothing here judges a screen.** It rebuilds the instrument that reading needs — both
halves of it, plus the scratch tree, the fixtures and the four scripts — and shows, with launches, that
the retained executable those launches ran reaches every one of this application's six write surfaces
and produces the byte predicate its case table names. That is exactly what 2c-5-5a did before 2c-5-6,
and what 2c-5-5b did after the tree was lost a second time.

**Nothing here was recovered, and nothing was inherited.** Unlike 2c-5-5b, which found the four harness
paths still in the repository working tree and rebuilt only the tree around them, this step found
**none** of them: `src/probe.ts` and `src-tauri/src/probe.rs` were both absent, `src/main.ts` and
`src-tauri/src/main.rs` carried no hook line, and `git status --short --untracked-files=all` was empty.
Both probe sources are therefore **authored from the application's current code**, and every script and
fixture is **re-authored from the descriptions** in `2c-5-5a-instrument-rebuild.md` and
`2c-5-5b-instrument-cases.md`.

**"The rebuilt whole runs" is one claim too many, and §6.3 is why.** No retained artifact binds any
executable here to a source snapshot or to a build command: `launch.sh` copies whatever `ECFG_BINARY`
names without checking a timestamp, and no build transcript was retained as an artifact of the tree.
What the retained bundles pin is **which bytes ran** — every launch of the proof generation records
`binary=40d1e67b…` from its own bundle copy, and that value equalled `target/debug/espansoconfig`'s
when it was read at the close of this step. Source inspection separately establishes that the plans are
coherent. **Those two readings may not be conjoined into source provenance.**

---

## 1. Where the tree is, and the reading of the filesystem this step began with

**The new scratch tree is `/private/tmp/espansoconfig-harness-2d-5/`**, outside the repository. It is a
**new** path, not `…-2c-5` and not `…-2c-4c`: 2c-5-5a §1 records the reason, which is that a shared path
reads as a shared ledger and a later step must be able to tell this tree's artifacts from a lost tree's.

```
/private/tmp/espansoconfig-harness-2d-5/
  launch.sh                        one plan-driven launch: the case table, the seed, a fresh bundle,
                                   the wait, the kill, the byte checks
  inert.sh                         one launch with no plan at all — the no-plan control of §4.2
  confine.sh                       one launch whose external writer is pointed OUTSIDE the tree — §4.3
  adversary.sh                     one launch that plants a symlink where the writer is about to act — §4.4
  fixtures/                        9 files — 1 R0, 2 R1 documents, 1 R2 document, 5 authored
                                   expected-bytes documents
  launches/Q01…Q13, Q21…Q28,       per launch: xdg/, xdg-before/, home/, espansoConfig.app,
           N01…N02, C01…C05/       probe.log, probe.err, bytes.txt, tree.diff
  launches/C04-plant/              NOT a launch — adversary.sh's sibling plant, one symlink (§4.4)
  manifest-2d-5-2c-1-post.sha256   71 entries, all 71 verify — a post-image, and only that
```

The tree is **1.2 GB**, which is a reading of its size at one moment over the 28 retained launches:
every script assembles a fresh `.app` bundle per launch and every launch keeps its own, about 40 MB
each. That is the growth rate 2c-5-5a §1 recorded and not a measurement of what a rebuild costs.

**Five files sit outside the tree and a later step must delete them too**:
`/private/tmp/espansoconfig-probe-decoy-C01.yml` through `…-C05.yml`, which `confine.sh` and
`adversary.sh` create *outside* `$HARNESS` because being outside it is the whole point of the check.
(C05's mode needs no outside decoy — its "wrong path" is deliberately *inside* the launch tree.) Each
also has a `.before` sibling, which is what makes the `decoy=` line a `cmp` rather than an assumption.
`rm -rf` on the harness path alone does not reach any of them.
`launches/C03/xdg/espanso/match/conflict.yml.probe-tmp-adversary-C03` and
`launches/C04-plant/xdg/espanso/match/conflict.yml` are the two symlink artifacts that go with the tree.

### 1.1 What the filesystem showed when this step began, bounded as a present-state reading

**No harness tree existed.** `ls -d /private/tmp/espansoconfig-harness-*` matched nothing.
**Neither probe source existed**: `ls -la src/probe.ts src-tauri/src/probe.rs` reported both missing.
**The working tree was clean**: `git status --short --untracked-files=all` printed nothing, at
`156214f`.

Each of those is a **reading of a present state and says nothing about when or why anything went**.
`/private/tmp` is a location the operating system clears and 2c-5-7 deliberately removed the 2c-5 tree,
but no artifact here records a cause and this record asserts none. This step did not delete anything.

**No manifest is under version control**, so this step had no before-image to check anything against —
the same hole 2c-5-5a had, one rebuild deeper. `manifest-2d-5-2c-1-post.sha256` is a **post-image by
construction** and cannot say what any file held before.

### 1.2 The four harness paths, and the diff over the two hook files

`git status --short --untracked-files=all`, read at the close of this step's work, lists exactly four
paths:

```
 M src-tauri/src/main.rs
 M src/main.ts
?? src-tauri/src/probe.rs
?? src/probe.ts
```

`git diff --stat` over the two hook files reads, verbatim:

```
 src-tauri/src/main.rs | 3 ++-
 src/main.ts           | 3 +++
 2 files changed, 5 insertions(+), 1 deletion(-)
```

**5 insertions and 1 deletion**, which is what 2c-5-5a §2.1 and 2c-5-5b §1 both record. **That is a
coincidence worth stating rather than a check**: nothing here compared this tree with any pre-removal
one, and the agreement follows from the records having described the same four lines and this step
having applied them to the same two files. The three insertions in `src/main.ts` are the import, the
call, and the blank line between the call and the line above it.

The four lines:

- `src-tauri/src/main.rs`: `mod probe;` (in the module list, between `menu_contract` and `prose_sweep`)
  and `probe::register_with_probe(tauri::Builder::default())` replacing `register(…)` in `main`;
- `src/main.ts`: `import { startProbe } from './probe';` and `startProbe();`.

**The four harness paths stay uncommitted in the working tree.** No git command that changes anything
was run.

## 2. What was rebuilt, file by file, and from what

| Rebuilt file | Built from | Provenance |
|---|---|---|
| `src-tauri/src/probe.rs` | 2c-5-5a §2 (the four item names and the registration arrangement), §4.4 and §4.5 (the confinement rules, item by item, including which are measured and which are source construction), §5.2 (no shell in the writer), §5.18 (`ECFG_PROBE_TEMP_NAME` and the constraint on its value), §8.1 (`HARNESS_ROOT` as a compile-time constant that must agree with `launch.sh`); and `src-tauri/src/main.rs` for the **seventeen** commands it must re-register | **authored from the code** — no record carries its source |
| `src/probe.ts` | 2c-5-5a §2.2 (label resolution, row matching, the creator's `<select>` against the mover's `<ul>`), §5.11 (a control must be enabled to be pressed), §5.13 (no third plan segment), §6.2 (the reapply arm read off a string), §8.1 (the shared machinery, by name); and the seven components' own markup for every selector and dictionary key | **authored from the code**, against the records' described behaviour |
| `launch.sh` | 2c-5-5a §3 (the recipe, the `open` invocation quoted verbatim, the three refusals and their exit codes 68/69/65, the wait, the kill), §5.4 (the two-halved backup search), §5.5 (the `bytes.txt` lines), §5.7 (the hand-assembled bundle, identifier `cc.carpio.espansoConfig`), §5.17 (the name guard); 2c-5-5b §2 | re-authored from a record |
| `launch.sh` — the case table, 8 rows | 2c-5-5a §4's twelve rows, **narrowed to eight** (§5.3 below) | re-authored from a record, narrowed here |
| `inert.sh` | 2c-5-5a §4.3 (no `ECFG_PROBE_*` variable at all, `alive-at-kill` via `pkill`'s status); 2c-5-5b §2 deviation 6 (the twelve-second wait) | re-authored from a record |
| `confine.sh` | 2c-5-5a §4.4 (the two static modes, the decoy outside `$HARNESS`, `--- failed` as the pass) | re-authored from a record |
| `adversary.sh` | 2c-5-5a §4.5 (the three modes; the sibling plant for `target-symlink`, because C08 there showed an own-tree symlink never reaches the writer; `ECFG_PROBE_TEMP_NAME` set by this script only) | re-authored from a record |
| `fixtures/base-r0.yml` | 2c-4b-3b §4 via 2c-5-5a §2: one comment line and a `matches:` sequence of `:alpha`, `:beta`, `:gamma`, each a double-quoted `trigger:` and a plain `replace:` | re-authored from a description |
| `fixtures/elsewhere-r1.yml` | the same: changes `:alpha`'s replacement, leaves `:beta`'s owned lines byte-identical, no reorder | re-authored from a description |
| `fixtures/target-changed-r1.yml` | the same: changes `:beta`'s replacement, leaves `:alpha` alone | re-authored from a description |
| `fixtures/third-r2.yml` | 2c-5-5a §5.15 (a third revision, different bytes from R1) | shape authored here — no record fixes its content |
| the 5 `*-expected.yml` files | 2c-4b-3b §4's *Expected afterwards* column over this tree's `elsewhere-r1.yml`; `creator-front-expected.yml`'s emitted item additionally from 2c-5-5a §2.2 (`  - trigger: ':probe'` / `    replace: probe creation`) | authored predictions, each **compared by a launch** (§4.1) |

**Every byte no record fixes is this step's own choice.** In particular the leading comment line's
wording is this step's — no record quotes it — as are the four replacement strings (`alpha zero`,
`beta zero`, `gamma zero` and their revisions), the second file of the synthetic tree
(`xdg/espanso/config/default.yml`, two lines, neutral, never opened by any plan), and the `Info.plist`
fields beyond the bundle identifier.

**Byte-identity with any earlier tree's files is neither claimed nor established, and for four files it
is positively contradicted.** 2c-5-5a §4.2 records R0 as `a9990be6…`, `elsewhere-r1.yml` as
`60a66198…`, `target-changed-r1.yml` as `9e937f20…` and `third-r2.yml` as `8b1a27af…`; 2c-5-5b §2
records `2543689c…`, `beba1b1f…`, `27aa3b9e…` and `358eb1d7…`. **This tree's are different again**
(§4.2). For every other rebuilt file there is no surviving original and no old digest, so byte-identity
is not established either way. **No later step may use digest equality with any earlier ledger as a
continuity check.**

### 2.1 Where the records under-specified, and what production source decided it

Each is a place the records name a behaviour and not its mechanism, or name nothing at all, and each was
settled by reading production source rather than by guessing. Four of these are 2c-5-5a §2.2's own four,
re-derived here against today's code; the rest are new to this rebuild.

- **The command list is seventeen, not sixteen.** 2c-5-5a §2 says "the sixteen commands"; that figure is
  from a phase before `commands::drain_external_changes` existed. `src-tauri/src/main.rs`'s
  `invoke_handler` was read rather than the record trusted: sixteen `commands::*` plus
  `menu::set_menu_labels` is **seventeen**, and `register_with_probe` names all seventeen plus the four
  probe commands.
- **`register_with_probe` calls `crate::register` and then replaces its handler.**
  `tauri::Builder::invoke_handler` is a plain setter — `self.invoke_handler = Box::new(handler); self`
  in `tauri-2.11.5/src/app.rs:1658` — so the second call supersedes the first rather than adding a
  second dispatcher. Written this way for a reason no record names: a `register_with_probe` that
  duplicated `register`'s body instead of calling it would leave `register` unused in a non-test build,
  which is a `dead_code` warning, which is a `cargo clippy -D warnings` failure.
- **How the driver resolves a label.** The records say `pressNamed('browser.matchMove.position.top')` — a
  literal dictionary key. `src/probe.ts` therefore calls `translate(language, key, params)` from
  `src/lib/i18n/dictionaries.ts` and matches a control's whole collapsed text **exactly**. Exactness is
  load-bearing: `browser.matchDeletion.open` is *"Delete this snippet…"* and
  `browser.matchDeletion.request` is *"Delete this snippet"*, so a containment test would press
  whichever came first.
- **How a *row* is matched, which is not how a control is.** `Sidebar.svelte:88` draws a file's path in a
  `span.name` beside a snippet count and `SnippetList.svelte:119` draws a trigger in a `span.trigger`
  beside a label and badges, so a row's whole text is never the name. `pressRow` matches the named part
  by its own class and clicks the button that contains it.
- **How the creator chooses a placement.** `MatchCreator.svelte:745` draws a `<select>` whose option
  values are model-minted keys, where `MatchMover.svelte:690` draws a `<ul class="destinations">` of
  buttons. The two surfaces need two mechanisms. `chooseOption` matches the option by its **text** and
  assigns `select.value` from the option it found, so the driver never builds a key.
- **What `creator-front-expected.yml`'s new item looks like.** 2c-5-5a §2.2 derives it from `render_item`
  (`crates/espansoconfig-core/src/patch/edit.rs`) and `choose_scalar`
  (`crates/espansoconfig-core/src/emit/choose.rs`): `  - trigger: ':probe'` / `    replace: probe
  creation`. **Q24 matched that file byte-for-byte**, which is the evidence.
- **The deleter does not open in its editing phase.** No record says this, and Q04–Q06 are what found it:
  opening the deleter from the detail pane draws the question and its two answers straight away, so
  *Delete this snippet* — the request control `MatchDeleter.svelte:494` draws under
  `{:else if view.canDelete}` — is **absent** on the first pass and present again after a reapply has
  rebuilt the session. `sendDeletion` in `src/probe.ts` therefore asks for the request control only when
  it is on screen and prints `--- deleter requestControl=absent phase=confirming` when it is not.
- **The raw editor's own control is drawn only once the file's text is showing.** Q10 is what found it:
  the detail pane opened with *Mostrar el texto de este archivo* and *Añadir un fragmento* and nothing
  else. `rawPlan` presses `browser.detail.fileTextShow` first.
- **`setTimeout` cannot carry a wait in this window.** §5.1 is the full account; it is the largest
  deviation in this rebuild and the one that cost the most launches.

## 3. The launch recipe, as this tree runs it

```sh
# once, and IN THIS ORDER — the bundle embeds `dist` at *cargo* build time
npm run build
touch src-tauri/build.rs
cargo build -p espansoconfig --features custom-protocol

# per launch, into a launch name never used before
/private/tmp/espansoconfig-harness-2d-5/launch.sh <case>[:<lang>] <name>
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

`ECFG_PROBE_R2` is always passed and is the **empty string** on every case except `editor-third`.

**The script refuses three things before it assembles anything, and each refusal was exercised on this
tree**:

- **a plan that is not `<case>[:en|es]`** — `launch.sh editor-exact:se QXX` printed *"the plan
  editor-exact:se is not `<case>[:en|es]`"* and exited **68**; a directory listing of `launches/`
  afterwards shows no `QXX`, which is a reading of that listing and not an account of what the script
  did or did not create along the way;
- **a launch name that is not `[A-Za-z0-9_-]+`** — `launch.sh editor-exact:en 'bad/name'` printed *"the
  launch name bad/name must be non-empty and only letters, digits, - and _"* and exited **69**. That
  guard is a **typo guard and not a boundary**: the argument comes from whoever runs the script, and the
  boundary that matters is the one §4.3 and §4.4 measure inside `probe.rs`;
- **a launch name it has already used** — a second `launch.sh editor-exact:en Q21` printed *"launch name
  Q21 has already been used; pick another"* and exited **65**.

It then seeds `base-r0.yml` as `xdg/espanso/match/conflict.yml` beside a synthetic
`xdg/espanso/config/default.yml`, copies the tree to `xdg-before/` **before** launching, assembles the
`.app` by copying whatever `ECFG_BINARY` names — defaulting to `target/debug/espansoconfig` — waits for
`--- end` or 25 seconds, kills the process, then `cmp`s the target against the case's expected file,
searches for `.espansoconfig-backups`, and diffs the tree against the pristine copy.

**It conjoins none of that**, and this rebuild did not give it the power to. It records `end-lines=` and
`failed-lines=` as **counts**, it does not compare the three revisions a conflict panel prints, and it
will write `reached-end=yes` beside a `bytes=DIFFER`. A reader supplies the conjunction, on every launch.

**"Freshly built" is not a claim these artifacts carry.** Nothing in the script checks a timestamp,
re-runs the build or records a build transcript, and no build transcript was retained as an artifact of
the tree. The block above is the recipe in the order this project's records require. What the retained
bundles *do* pin is **which bytes ran**, and §5.6 is that measurement.

## 4. The proof launches

**Twenty-eight launches are retained and they are three generations.** `Q01…Q13` are the **shakedown
generation** — the launches that found the three defects §2.1's last three bullets name — and they ran
three earlier binaries; nothing in this record's proof claims rests on them, and they are retained
because deleting them would leave this record asserting a history the tree no longer shows.
**`Q21…Q28`, `N01…N02` and `C01…C05` are the proof generation: fifteen launches**, being **eight
plan-proof launches**, two no-plan controls and five confinement controls (8 + 2 + 5 = 15). **Every one
of the fifteen ran the binary whose digest is
`40d1e67b64c764fcd5c35820467da3c3cb3c5887a1e620bc46cb3177454c8254`.**

**Q21–Q28 are one per case of the whole case table**, which is this step's own acceptance criterion,
taken from 2c-5-5a §4: every state the case table claims to reach has a launch that reached it, and
there is no row in `launch.sh` that no launch of this generation ran.

Each plan launch satisfies, by hand, the same four-part conjunction: no `--- failed` line; a conflict
block with three revisions where `expected ≠ found` and `disk == found`; the expected control and action
lines for that surface; and the intended byte predicate. **Nothing in the harness conjoins those four; a
reader did, on all eight.**

| # | Case | Surface | Lang | `expect=` | `bytes=` | `backups=` | `tree-diff` | `probe.err` | `--- end` / `--- failed` |
|---|---|---|---|---|---|---|---|---|---|
| Q21 | `editor-exact` | editor | en | `editor-exact-expected.yml` | **MATCH** | **PRESENT** | 10 | 0 bytes | 1 / 0 |
| Q22 | `editor-third` | editor | en | `third-r2.yml (R2)` | **MATCH** | **none** | 9 | 0 bytes | 1 / 0 |
| Q23 | `editor-collision` | editor | es | `target-changed-r1.yml (R1)` | **MATCH** | **none** | 5 | 0 bytes | 1 / 0 |
| Q24 | `creator-front` | creator | es | `creator-front-expected.yml` | **MATCH** | **PRESENT** | 9 | 0 bytes | 1 / 0 |
| Q25 | `deleter-exact` | deleter | en | `deleter-exact-expected.yml` | **MATCH** | **PRESENT** | 8 | 0 bytes | 1 / 0 |
| Q26 | `mover-exact` | mover | es | `mover-exact-expected.yml` | **MATCH** | **PRESENT** | 8 | 0 bytes | 1 / 0 |
| Q27 | `duplicator-exact` | duplicator | en | `duplicator-exact-expected.yml` | **MATCH** | **PRESENT** | 8 | 0 bytes | 1 / 0 |
| Q28 | `raw-negative` | raw | es | `elsewhere-r1.yml (R1)` | **MATCH** | **none** | 5 | 0 bytes | 1 / 0 |

**Eight launches, all six write surfaces, five positives, two post-conflict negatives and one
third-writer case.** Every launch picked its language **through the picker** and printed
`documentElement.lang`; `picked=` equals `lang=` on all eight. Every launch also prints `--- plan
case=… requested=…`, so a plan that named no language would be visible as `requested=absent` rather than
silently English; all eight read `requested=en` or `requested=es`.

**That is aggregate bilingual coverage and not per-surface bilingual coverage.** English was used for
the editor's two positive cases, the deleter and the duplicator; Spanish for the editor's collision
case, the creator, the mover and the raw editor; **no surface here was launched in both.** Step
2d-5-2c-2 is the reading that owes whatever bilingual coverage it claims; this step does not give it.

### 4.1 What each one showed, from its retained transcript

The viewport is `1180 x 728`, `dpr=2`, `hasFocus=false`, `visibility=hidden`, on every one of the eight —
checked as eight separate matches, not read off one. **`visibility=hidden` on every launch is the
measurement §5.1's deviation exists because of**, and it agrees with the `1180x728 dpr=2` every record
before 2c-5-5a reports rather than with 2c-5-5a's own `720x728 dpr=1`. Nothing here judges why; it is
recorded as a measurement, and no geometry in this record may be compared with any other record's.

Every conflict block shows `expected 85fa605b…` against a `found` that equals its disk revision —
`57fd4467…` on the six cases whose R1 is `elsewhere-r1.yml`, `722e02e2…` on the two whose R1 is
`target-changed-r1.yml`.

- **Q21** — conflict panel `box=658,44,491x1032`; four choices in the order *Keep editing · Copy my text ·
  Keep my draft · Load the version on disk*; `readiness ready=present readyOperation=absent`; *Keep my
  draft* pressed, `arm=browser.reapply.reapplied`; *Save this snippet* pressed again; the new outcome
  block says *"The file was written. What is on disk now is exactly the text that was sent."* The file
  ends byte-identical to `editor-exact-expected.yml`.
- **Q22 — the third-writer case, and the only launch of this step that moves the file twice.** Panel
  `box=658,44,491x1032`; the same four choices and the same `reapplied` arm; then `--- editor
  beforeSecondSave outcomePanel=absent`, `--- writer third wrote=yes`, the second save pressed, and a
  **new** outcome block whose three revisions are `57fd4467… / 84ff697c… / 84ff697c…` — the reapply's own
  base against R2. The file ends byte-identical to `third-r2.yml`, `backups=none`. **`bytes=MATCH` here
  discriminates the third writer having run**, because no application path produces R2 and a writer that
  had failed would have left R1.
- **Q23** — the manual-resolution shape, in Spanish, on the editor. Panel `box=658,44,491x1094`; *Keep my
  draft* pressed, `arm=browser.reapply.manualResolution`, whose obstacle names the field: *"The version
  on disk does not hold these fields the way the version your draft was built on did … Replacement
  text."* Nothing sent afterwards; the file ends byte-identical to `target-changed-r1.yml`,
  `backups=none`.
- **Q24** — destination `match/conflict.yml` and placement *Al principio de la lista* chosen inside the
  creator's own section; panel `box=658,44,491x908`; *Conservar mi borrador* pressed,
  `arm=…reapplied`; *Añadir este fragmento* pressed again. The file ends byte-identical to
  `creator-front-expected.yml`, `:probe` first.
- **Q25** — panel `box=658,44,491x741`; **three** choices; `readiness ready=absent
  readyOperation=present`; *Keep what I asked for* pressed, `arm=…reapplied`; then the deletion
  **request** control and the **confirmation** control each found and pressed — a missing one would have
  printed `--- failed`. The file ends byte-identical to `deleter-exact-expected.yml`.
- **Q26** — destination *Al principio de la lista* chosen inside `.mover .destinations`; panel
  `box=658,44,491x758`; *Conservar lo que he pedido* pressed, `arm=…reapplied`; the destination chosen
  again and *Mover este fragmento* pressed. The file ends byte-identical to `mover-exact-expected.yml`,
  `:beta` first.
- **Q27** — panel `box=658,44,491x741`; *Keep what I asked for* pressed, `arm=…reapplied`; *Duplicate
  this snippet* pressed again, then the ordinary `DuplicateKeepsTriggerDefinition` acknowledgement
  **waited for** and pressed — the transcript carries the refusal block, the *Save anyway* press and the
  committed block in that order. The file ends byte-identical to `duplicator-exact-expected.yml`: two
  adjacent `:beta` items.
- **Q28** — panel `box=658,196,491x493`; **three** choices — *Seguir editando · Copiar mi texto · Cargar
  la versión del disco* — `readiness ready=absent readyOperation=absent`, and
  `--- raw reapplyPanel=absent`. The file ends byte-identical to R1, `backups=none`.

**A control this list says was "pressed" is one the driver waited for, found enabled and clicked, and
this tree's transcript prints a `--- pressed` line for each one.** That is a deviation from the
instrument 2c-5-5a describes, which printed nothing for a press (§5.2). `pressNamed` throws when the
control does not arrive enabled, and `startProbe()` **attempts** to print `--- failed`; every one of the
eight plan-proof launches has `failed-lines=0` beside `end-lines=1`, which is **not** true of the five
confinement controls, where a `--- failed` is the pass. That conjunction is a reader's, not the
harness's — and `failed-lines=0` beside a reached `--- end` is the pair that carries it, because a
`--- failed` that could not be written would also have kept `--- end` from arriving.

### 4.2 The revision digests are this tree's own, and a fixture's revision equals its SHA-256

`shasum -a 256` over the four revision fixtures answers exactly the four values the transcripts print as
revisions:

```
85fa605b855c801770455dbe5d0a9603dbe0e50e57420d59e51c9fb32adf62ad  base-r0.yml
57fd4467373c509105f3d948f6910f430c550cd41e1043546597d0809b52796b  elsewhere-r1.yml
722e02e254a2be03c401b62cd4e1fabaaa99e32b3d500a648f8143be40d4f48c  target-changed-r1.yml
84ff697c5f97788499952802cabb3fd9bf2c1639838cefdc22488fd00d9ccad3  third-r2.yml
```

The fourth is `editor-third`'s and **Q22's second conflict** printed it as `found` and as the disk
revision, which is how that launch's transcript and its `bytes=MATCH` say the same thing twice.

That gives 2d-5-2c-2 a way to check a transcript's revisions against a file on disk without launching
anything. **It is an observation of these four files on this build**, and 2c-5-5a §4.2's and 2c-5-5b §2's
same observation holding once more, not a documented property of the revision function.

The five authored prediction fixtures answer:

```
49055aefcdbd4ab150877ee0cdeaa63a6957a9452ee2cf1f399823a27e1484f0  editor-exact-expected.yml
7b4f3bf79453720cf7ddf7b1c45168345caaf052688bbc66688e50d7241a4352  creator-front-expected.yml
8cc25948c8bc287554a9420fb673184d379621c26832956454bdd651efefa733  deleter-exact-expected.yml
7b8f6279f4741fc70a215a7ac84c9e76f6331dbf6a0c197948d3bd92d3507009  mover-exact-expected.yml
5a5a8eeb46bad58460e98098b97b77d81d4709ca6cd6532d9785ba0a4db4d1a0  duplicator-exact-expected.yml
```

**Every one of the five was compared by a launch of the proof generation and each answered `MATCH`**, so
this tree ships **no un-launched prediction fixture**. That is a statement about the launches
`launches/` holds, not about how many attempts preceded them: the manifest is a post-image, so nothing
retained would show a discarded attempt if there had been one — and this step *did* discard a whole
shakedown generation, which is retained precisely so the statement above is checkable.

### 4.3 Without `ECFG_PROBE_PLAN`: no plan-driven action observed, and the final tree unchanged

`inert.sh` assembles the **same** bundle and launches it with `XDG_CONFIG_HOME` and `HOME` set and
**no** `ECFG_PROBE_PLAN`, `ECFG_PROBE_TARGET`, `ECFG_PROBE_R1` or `ECFG_PROBE_R2`. N01 and N02 both
answered:

```
probe.log=0   probe.err=0   tree-diff=0   target-unchanged=yes   alive-at-kill=yes   binary=40d1e67b…
```

**A zero-byte transcript is also what a bundle that never started would leave**, which is why both
launches record the kill's status: `pkill` answers 0 only when it signalled a live process, so
`alive-at-kill=yes` is the evidence that the silence is a **running window's** silence.

**What these two launches establish is exactly this and no more**: with the variable absent, a live
window wrote **no transcript line**, and the synthetic tree was **byte-identical after twelve seconds** —
zero `tree-diff` lines and `target-unchanged=yes`. That is a reading of a final state.

**What they cannot establish**: that *no writer was spawned*. There is no invoke spy and no command
counter anywhere in this harness, so a write that produced identical bytes, or a transient one undone
before the launch ended, would leave these same artifacts. The honest sentence is *no plan-driven DOM
action was observed and the final synthetic tree is unchanged*.

**What is separately known from the code, and is not a reading of these launches**: `startProbe()`
returns as soon as `probe_plan` answers `null`, and `replace_the_target` refuses on the same question,
so a writer reached without a plan answers *"refused: the … writer will not run without
ECFG_PROBE_PLAN"*. **No launch here exercises that particular refusal**, because this driver has no way
to call a writer without a plan; it is stated as a property of the source, not as a measurement.

**And the hooks are not inert in any reading.** `register_with_probe` adds **four callable IPC commands**
to every instrumented launch and `src/main.ts` calls `startProbe()` unconditionally, so **every startup
pays one extra IPC round trip** — and, because of §5.1, every *wait* pays many more. Neither was
measured, and both are gone when the harness is removed.

### 4.4 The writer confinement, measured on two static launches

`confine.sh` measures the two *static* refusals rather than reading them off the code. It builds the
same bundle, creates a decoy file **outside** the harness root, and points one of the two paths at it:

| # | Mode | Decoy | Launch's own target | `--- failed` | Refusal quoted from the transcript |
|---|---|---|---|---|---|
| C01 | `target` | **unchanged** | still R0 | 1 | *refused: the second writer's target (ECFG_PROBE_TARGET) …decoy-C01.yml is not beneath …/launches* |
| C02 | `source` | **unchanged** | still R0 | 1 | *refused: the second writer's source (ECFG_PROBE_R1) …decoy-C02.yml is not beneath …/fixtures* |

Both had a zero-byte `probe.err` and `tree-diff=0 lines`. **`--- failed` is the pass here, and that
inverts every other table in this record**: the writer is supposed to refuse, the driver's `invoke` then
rejects, and the plan throws. Neither reached `--- end`, which is the *expected* shape for a control
whose pass is a throw.

**What carries each row is the quoted `refusal=` line, which is a positive observation.** The
`decoy=unchanged` beside it is a `cmp` against a pristine copy taken before the launch, and a reading of
final bytes cannot on its own distinguish "nothing was written" from "something identical was written"
or "something was written and undone" — this harness has no invoke spy and no command counter, so no
artifact it produces can make that distinction anywhere.

**And on two of the five rows the column is worse than weak — it is vacuous, which this record did not
say until the review of this step.** `decoy=unchanged` is only a claim about a refusal where the decoy
is the path the writer was pointed *at*. That is true of **C01** (`target`), **C03** (`temp`) and
**C04** (`target-symlink`), whose decoys are genuine write destinations. It is **not** true of:

- **C02** (`source`), where `confine.sh:89` makes the decoy the writer's **read** path. Nothing was ever
  going to write it, so `decoy=unchanged` on that row reports the outcome of a write nobody attempted.
- **C05** (`target-elsewhere`), where `adversary.sh:109-111` points the target at a path **inside** the
  launch tree and never references the decoy at all. The file the column reads is unrelated to the
  launch.

On both rows the refusal line is still the whole of the evidence, and it is enough — it is a positive
observation and it names the exact rule that fired. The correction is to the *column*, not to the
verdict: nothing in §4.4 or §4.5 depended on `decoy=unchanged` for C02 or C05.

**What these two do not establish.** They measure two refusals on one command; that is not a proof that
no path in this build can write outside the tree. They say nothing about the third writer's own
confinement, which shares the same `replace_the_target` but was not separately pointed outside. **C02
measures the *beneath-`fixtures`* half of the source rule and only that half**: its decoy is outside the
harness root, so the refusal it quotes is `strip_prefix`'s. **Nothing here ever points a writer at a
nested regular file beneath `fixtures`, so the *direct-child* rule in `confined_source` is closed by
source construction and unmeasured.** And they are **static**: a path spelled outside the tree before
the launch begins, never a path swapped while the launch runs.

### 4.5 The adversarial confinement controls, and the four cases that were not constructed

| # | Mode | What is planted | Decoy | Own target | `--- failed` | Refusal quoted from the transcript |
|---|---|---|---|---|---|---|
| C03 | `temp` | a **symlink at the exact temporary path**, pointing outside the harness | **unchanged** | still R0 | 1 | *refused: the second writer could not create the temporary …/launches/C03/xdg/espanso/match/conflict.yml.probe-tmp-adversary-C03 exclusively: File exists (os error 17)* |
| C04 | `target-symlink` | a **sibling** launch directory whose `conflict.yml` is a symlink outside the harness | **unchanged** | still R0 | 1 | *refused: the second writer's target (ECFG_PROBE_TARGET) …decoy-C04.yml is not beneath …/launches* |
| C05 | `target-elsewhere` | nothing — the target is a **real file inside the launch tree that is not the synthetic one** | **unchanged** | still R0 | 1 | *refused: the second writer's target (ECFG_PROBE_TARGET) …/launches/C05/xdg/espanso/config/default.yml is not a launch's own \<launch\>/xdg/espanso/match/conflict.yml beneath …/launches* |

All three had a zero-byte `probe.err`; `tree-diff` is 0 on C04 and C05 and **1** on C03, which is the
planted symlink itself appearing in the diff against the pristine copy. In all three `--- failed` is the
pass.

- **C03 is the direct measurement of the `O_EXCL` rule.** A writer that staged through `cp` would have
  opened the planted link and written R1's bytes into `…probe-decoy-C03.yml`.
  `OpenOptions::create_new` refuses a path that exists at all, symlink included, so the writer stopped
  with `os error 17`; the script's own `plant=` line afterwards reads *still a symlink ->
  …decoy-C03.yml*. **What C03 measures is a plant that was already there when `create_new` ran, and only
  that** — it says nothing about a name rebound after the open.
- **C04 had to be built as a sibling plant.** 2c-5-5a §4.5's C08 is the retained attempt that shows why:
  replacing the launch's *own* `conflict.yml` with a symlink never reaches the writer, because the plan
  times out on the sidebar row. That attempt was not re-taken here; the sibling design is inherited from
  that record rather than re-derived, and this tree therefore holds no launch demonstrating the
  own-tree failure.
- **C05 is what the exact-file constraint buys.** Under a rule that said only *beneath `launches/`* plus
  `is_file()`, that path would have passed both checks and the launch's own profile would have been
  replaced. **That is a reading of the weaker rule, not a measurement**: no launch of this tree ever
  pointed a writer at that path under it.

**What this section does not establish, stated as plainly as it can be — and it is four cases, not one.**
Confinement is **not proven** against any of these four rebindings, each of them a name checked at one
instant and spent at another:

1. **the fixture's final component**, rebound between `confined_source` and the `std::fs::read` that
   resolves that pathname again;
2. **the temporary's name**, rebound between the `create_new` that took it and the `std::fs::rename`
   that spends it — C03 measures a symlink *already present* when `create_new` runs and nothing after it;
3. **an *ancestor directory* of the target's pathname** — the launch tree — replaced with a symlink
   between the canonicalization and the create-or-rename that follows it;
4. **an *ancestor directory* of the fixture's pathname**, `…/fixtures` itself being the nearest, replaced
   the same way between `confined_source` and the `std::fs::read` that walks it again. `fixtures` is a
   **sibling** of `launches`, so item 3's wording never covers it.

**None of the four is constructed here and none is closed.** Defeating them needs `openat`-style pinned
directory handles, which `std` does not offer; provoking either ancestor case needs a second process
racing a live launch, which this harness has no way to spawn. They are *accepted*, and the reasons they
are acceptable are the ones that make this a residual risk rather than an argument: the launch root is
created by `launch.sh` beneath an operator-controlled `/private/tmp` path, the instrumented binary is
never shipped and never signed, and a later step deletes both the binary and the tree. **None of those
three reasons is a proof of impossibility, and this record does not offer them as one.** All four are
open and disclosed, and they are inherited from 2c-5-5a §4.5 rather than newly discovered.

## 5. Deviations from what the records describe

Each is a place this tree differs from the instrument the records describe. None is an improvement
offered silently. **5.6 is a measurement rather than a deviation** and sits here because it is what
replaces a claim §3 would otherwise make.

**5.1 The driver does not wait on a timer, and this is the largest deviation in the rebuild.** Every
record describes a driver that paces itself with `setTimeout`. That does not work here, and it was
**measured rather than reasoned**: `document.visibilityState` reads `hidden` in every transcript this
tree has produced, a WKWebView whose window is occluded stops running timers about six seconds after
launch, and a wait built on one therefore does not time out when it fails — **it hangs**, writing
neither `--- end` nor `--- failed`. Q04 is the standing demonstration: four transcript lines and then
silence, with `reached-end=no end-lines=0 failed-lines=0`, which is the one failure shape a transcript
cannot describe. `pause()` in `src/probe.ts` now spends a round trip through `probe_plan` — the cheapest
read-only command available — and re-reads the wall clock itself, so it stops on time in either regime.
Q05 is the same case one binary later, timing out properly with `--- failed`. **What this costs is
throughput**: a 60-millisecond pause is tens of IPC round trips, and a `PAUSE_TRIP_LIMIT` of 400 caps
what one pause may spend. **What it does not establish** is that the message pump is immune to the
throttle in general; what is established is that every launch of the proof generation completed, and
that a timeout that had hung now fires.

**5.2 The transcript prints a line for every press, and no record's does.** 2c-5-5a §4.1 states plainly
that a pressed control leaves no transcript line. This tree prints `--- pressed <scope> <key>`, and the
reason is §5.1's failure mode: without it, a hang is indistinguishable from a plan that never started.
It is strictly more information and it is recorded here because it is a departure.

**5.3 A failure prints what was on screen instead.** `reportWhatIsOnScreen()` walks the eight surface
sections after a `--- failed` and prints each one's control labels — disabled ones marked `[off]` — and
its collapsed text. No record describes it. It is what turned Q05's timeout into Q06's diagnosis in one
launch rather than several. It runs **only** in the failure arm.

**5.4 The case table is eight rows, not twelve.** 2c-5-5a §4 shipped twelve; this tree ships
`editor-exact`, `editor-third`, `editor-collision`, `creator-front`, `deleter-exact`, `mover-exact`,
`duplicator-exact` and `raw-negative`. **The four dropped are `deleter-changed`, `mover-changed`,
`duplicator-changed` and `creator-anchor`** — three of them the post-reapply refusal shape on those
surfaces, and the fourth the creator's anchored-placement case, which 2c-5-5a §4 runs as P45 under that
name. **This sentence called all four "changed variants" until the review of this step**, which is
wrong about the creator: `creator-anchor` is not a variant of `creator-front` and §9.1 has always named
it separately. **`editor-collision` is the one launch of the post-reapply shape that this tree keeps**,
so the shape is covered and its per-surface coverage is not. The acceptance criterion is unchanged and
is met: every case this tree ships has a launch of the proof generation.

**What adding a dropped row actually costs, corrected.** `deleterPlan`, `moverPlan` and
`duplicatorPlan` each already carry a `'changed'` variant in `src/probe.ts` (`:757`, `:786`, `:820`)
with no case-table row wired to it. **That is the plan function only, and it is not the whole of a
case.** A case name goes in **three** places — `launch.sh`'s table, `runCase`'s switch and a plan
function — and `runCase` (`src/probe.ts:889`) has **no arm for any of the three**; its `default:`
throws ``unknown case ${name}``, exactly as its own doc comment at `:877` says it will. So adding those
rows to `launch.sh` alone produces three `--- failed` transcripts, not three launches. **The real cost
is one `runCase` arm per case, which is an edit to `src/probe.ts`, which means the full rebuild order
of §3 again** — `npm run build`, `touch src-tauri/build.rs`, `cargo build -p espansoconfig --features
custom-protocol` — and a new binary digest. Of the three places, only the first two refuse an unknown
name. **Nothing here carries any restore case, any reload case or any recovery case**, and
2c-5-5b's restore work is not in this tree at all: `RestorePane` is never opened, no backup tree is
seeded, and `launch.sh` `cmp`s exactly one file.

**5.5 `bytes.txt` carries a key set derived rather than quoted.** The plan-launch block is ten lines
(`name`, `plan`, `case`, `bytes`, `backups`, `expect`, `tree-diff`, `binary`, `probe.err`,
`reached-end`); the confinement block is ten of its own (`name`, `plan`, `mode`, `decoy`, `target`,
`refusal`, `tree-diff`, `binary`, `probe.err`, `reached-end`) and `adversary.sh` adds `plant`, making
eleven; the no-plan block is eight. The counts on the `reached-end` line are **not a conjunction** —
nothing refuses to write `reached-end=yes` beside `failed-lines=1`.

**5.6 Four binaries ran across the three generations, and the artifacts pin which — never their
provenance.** Every launch keeps its whole bundle, so `Contents/MacOS/espansoConfig` is a retained
artifact per launch and `bytes.txt` records its digest:

| Digest | Launches | Generation |
|---|---|---|
| `0798bc6d1f939ad538eea6c7e04696f462d5f6d9ecab8d9ad0d5d62de7b3e06e` | Q01–Q04 | shakedown, the timer-based driver |
| `06311701f1d1cfcfc89b965ada2b537da1f1ecdc26bfd15088448a8479b54646` | Q05 | shakedown, after §5.1's fix |
| `a682ef13039483d036d41b22999376cd171140a46850587a75f7b0dc71603509` | Q06–Q12 | shakedown, after §5.3's diagnostic and the deleter fix |
| `40d1e67b64c764fcd5c35820467da3c3cb3c5887a1e620bc46cb3177454c8254` | **Q13, Q21–Q28, N01–N02, C01–C05** | **the proof generation** — the fifteen-launch proof set plus Q13, the shakedown launch of the raw fix |

The last was byte-identical to `target/debug/espansoconfig` when that equality was read at the close of
this step. **That the four digests differ is the whole of what is established**: no retained artifact
binds any executable to a source snapshot or to a build command, so *the fixes were applied and the
bundle rebuilt* is an account of what was done and not a reading of these bundles. `launch.sh` would
have copied any binary it was pointed at.

**5.7 A control must be *enabled* to be pressed.** `pressNamed`, `pressText` and `pressRow` all require
`!disabled`. A disabled control accepts `click()` and does nothing, so matching one would turn a real
defect into a launch that looks right and writes nothing; requiring enablement turns it into a timeout
and a `--- failed`. `hasControl` — the one lookup with no wait in it — requires it too, which is why the
deleter's branch reads the *offer* rather than the markup's presence.

**5.8 The plan string is checked twice, in two places, on purpose.** `launch.sh` refuses a malformed
plan before it assembles anything; `parsePlan` refuses it again inside the window. Neither is redundant:
the script's check saves a whole launch, and the driver's protects a launch started any other way.
**They are two implementations of one rule and nothing enforces that they agree** — `launch.sh` matches
`^[a-z]+-[a-z]+(:(en|es))?$` and `parsePlan` splits on `:` and counts segments, so a case name with a
digit in it would be refused by one and accepted by the other, and that would show up as a script error
rather than as a `--- failed`. No test covers either.

**5.9 The launches are named `Q01…Q13`, `N01…N02` and `C01…C05`.** Not a continuation of 2c-5-5a's or
2c-5-5b's numbering: those artifacts are gone and a shared numbering would read as a shared ledger. `Q`
marks a plan-driven launch, `N` a launch that carried no plan, `C` a confinement control — static
(C01–C02) or adversarial (C03–C05). The proof generation deliberately starts at **Q21**, leaving a gap
after the shakedown's Q13 so no reader has to work out where one generation ends.

**5.10 The backup search does not use `fd`.** `fd` is not installed on this machine, and the records do
not say which tool the original script used. This script does it in two halves: a direct `[ -d ]` test
on `<config root>/.espansoconfig-backups`, and a sweep with `rg --files --hidden --no-ignore`.
`backups=none` requires both to find nothing. The directory test is what catches an **empty** backup
directory at the root, which a file listing cannot see; **an empty one somewhere else would evade both
halves**, and no `backups=none` line in this record claims more than these two searches performed.

**5.11 The script kills the application after the wait.** `pkill -f "$APP/Contents/MacOS/espansoConfig"`,
then one second, **after** the wait and **before** the byte checks. Without it every launch leaves a live
process sharing the bundle identifier the next launch's WebKit data store also uses.

**5.12 The bundle is hand-assembled**, with an `Info.plist` carrying `cc.carpio.espansoConfig` —
`src-tauri/tauri.conf.json`'s own identifier.

**5.13 `ECFG_PROBE_TEMP_NAME` exists for one control and no record before 2c-5-5a §5.18 describes it.**
Only `adversary.sh` sets it; `launch.sh`, `inert.sh` and `confine.sh` do not, so every proof launch used
a generated name. It is **not** a widening: `temporary_beside` requires the value to begin with the
target's own file name followed by `.probe-tmp-` and to contain no `/`, so the temporary's **pathname**
stays inside the target's canonical directory either way — a property of the name at the moment it is
built, which is all a rule over a pathname can force, and not a claim about the directories that
pathname walks through when it is resolved again (§4.5's four residuals).

**5.14 `repeatIfAsked` and the `:twice` third segment do not exist here**, as they did not in 2c-5-5a.
`parsePlan` rejects any plan with more than two colon-separated segments and `launch.sh` refuses it
before assembling a bundle. A later step that wants one must widen both.

**5.15 Two exit codes are inherited from 2c-5-5b rather than from any measurement.** An unknown case name
exits 68 (2c-5-5a documents 68 only for a malformed plan) and a bad mode in `confine.sh` or
`adversary.sh` exits 64 (no record describes one). Neither was exercised on this tree.

## 6. What this rebuild does **not** prove

**6.1 Nothing here is a window reading.** No launch of this step judged whether a person could read,
reach or understand anything. `HTMLElement.click()` is not a mouse click; no plan used the keyboard,
tabbed, scrolled, or produced an untrusted-event refusal. **A green transcript is not a screen.**

**6.2 It cannot fail because a sentence is untrue.** The transcript prints the strings the panels drew,
and a false one prints exactly as well as a true one. `--- end` proves the wrapper reached its last
logging statement and nothing else.

**6.3 Source-to-binary provenance is unknown here.** No retained artifact binds any executable to a
source snapshot or a build command, so *this source tree runs* is not available. The claim this step can
make is narrower and is the whole of it: **the retained executable Q21–Q28 ran — `40d1e67b…`, still in
every retained bundle of the proof generation — reaches all six write surfaces, draws the conflict arms
those surfaces draw, and produces the byte predicates its case table names, on all eight of its cases.**
That is deliberately not *"a tree rebuilt from the records reaches all six write surfaces."*

**6.4 There is no invoke spy and no command counter.** No artifact this harness produces — a final tree,
a zero-byte log, a `bytes=MATCH`, a `tree-diff=0`, an unchanged decoy — can distinguish *no write* from
*an identical or transient write*. §4.3's and §4.4's absence readings are cases of this, and none of them
may be read as making that distinction.

**6.5 The general rule that binds every absence sentence here.** An absence observation is bounded to
**the time it was taken, the corpus it was taken over and the predicate it was taken with**. §1.1's
missing trees were missing *when the listing ran*; §7.1's privacy sweep found nothing *in the files it
read, for the string it looked for, at the moment it ran*; §5.10's `backups=none` is what two searches
performed.

**6.6 The reapply arm is read off a *string*, and that is weaker than reading a value.** `reportReapply`
compares the panel's text against the six `browser.reapply.*` sentences in the launch's own language. A
re-worded sentence prints as `unrecognised`; a sentence drawn on the wrong arm prints as the arm it
reads like. What the seven `arm=` lines establish is that the sentence drawn matched the dictionary
entry named — not that the model took that branch.

**6.7 Neither probe source was verified against anything, and neither has a test.** Both are untracked,
so git holds no baseline, and no manifest of any earlier tree survives. `src-tauri/src/probe.rs` declares
no `#[test]` and `src/probe.ts` has no spec file, so every rule in either — the confinement, the strict
plan parser, the exclusive writer — is carried by a launch or by reading. What *is* supported is that
this pair compiles, passes `cargo fmt --check` and `cargo clippy --workspace --all-targets -- -D
warnings`, leaves `cargo test --workspace` where it was, and drove **thirteen of the fifteen launches of
the proof set** to a terminal transcript line — the eight plan launches to `--- end`, the five
confinement controls to `--- failed`. **The other two are N01 and N02, which wrote no transcript at
all**, so the fifteen-launch set was never fifteen launches that reached `--- end`.

**6.8 Nothing about recovery, restore, reload or the file watcher is in this instrument.** There is no
`[data-recovery-without-creation]` reporting, no recovery offer is asserted or pressed, no plan presses
*Load the version on disk*, `RestorePane` is never opened, and **nothing here observes a watcher
delivering anything** — `2d-5-split-notes.md` §7 item 7's constraint on 2d-5-2c is untouched by this
step and is not discharged by it. The launches nonetheless *drew* a recovery sentence on four surfaces,
because `MatchDeleter`, `MatchMover`, `MatchDuplicator` and `RawEditor` mount `RecoveryWithoutCreation`
unconditionally; what is absent is that any of it entered a transcript.

**6.9 The geometry here is not comparable with any earlier record's.** §4.1's viewport is `1180x728
dpr=2`, which agrees with the records before 2c-5-5a and not with 2c-5-5a's own `720x728 dpr=1`. Panel
rectangles from this tree say nothing about the ones any other record holds, in either direction.

**6.10 Byte-exactness over the fifteen corpus fixtures is untouched.** None of `CLAUDE.md` §4's fixtures
has been through this harness; the synthetic documents here are the easy shape — double-quoted triggers,
plain non-empty `replace:` scalars, one leading comment, LF endings, no BOM, no block scalars, no
item-owned comments, no blank-line runs, no second sequence, no read-only file, no package.

**6.11 The bilingual coverage is aggregate.** §4 spells this out: four launches in English, four in
Spanish, and **no surface launched in both**.

## 7. Privacy

**The owner's real configuration was never opened.** Every launch points `XDG_CONFIG_HOME` at the
synthetic two-file tree the scripts write and `HOME` at an empty directory created for that launch, so
neither candidate `resolve_config_dir()` (`crates/espansoconfig-core/src/discovery.rs:218`) probes can
reach it — `explicit` is `null` from `AppShell.svelte`'s `browser.open(null)`, the XDG candidate is
`$LAUNCH/xdg/espanso`, and the HOME candidate is `$LAUNCH/home/Library/Application Support/espanso`,
which does not exist. Every fixture is neutral and hand-authored: `:alpha`, `:beta`, `:gamma`, `:probe`
and nothing else.

### 7.1 The sweep, and what it is a reading of

`rg --no-ignore --hidden -l '/Users/ccarpio'` over every `probe.log`, `probe.err`, `bytes.txt` and
`tree.diff` under `launches/` **found nothing**. A control search for `espansoconfig-harness-2d-5` over
one of those same files answers 1, which is what makes the negative non-vacuous.

**That is a reading of *those* files for *that* string, not a proof that no retained artifact anywhere
holds anything of the owner's.** In particular it is not a reading of the 28 retained `.app` bundles,
whose binaries this step did not search, and not a claim about any string other than the one searched
for. What is separately true by construction is that no plan opens anything outside its own launch
directory, and that the transcripts quote only synthetic fixture text — Q23's transcript, for instance,
prints the whole disk version of the synthetic document inside its conflict block, which is exactly why
the fixtures are hand-authored and neutral.

## 8. The gates, **with the harness in the tree**

**These are with-harness figures and are not production numbers.** A later step re-derives the
production ones on a harness-free tree; carrying a with-harness figure forward as production is exactly
the defect that left `1623` standing in `PROGRESS.md` for three step records. Each row states its
arithmetic against the harness-free baseline `PROGRESS.md`'s "Next action" carries at 2d-5-2b-E,
**`1320 / 438 / 2254 / 186`**.

**Every figure was predicted before the command was run and then checked both ways.** The prediction was
`1320 / 439 / 2255 / 187`, and **every one of the four landed there**. The `cargo test` figure is a sum
over the 26 `test result:` lines a serial workspace run prints, and `0 failed` is the only failure count
that appears anywhere in the transcript.

| Command | Predicted | Measured | Harness-free baseline | Why it moved |
|---|---|---|---|---|
| `cargo test --workspace -- --test-threads=1` | 1320 | **1320** passed, 0 failed, over 26 result lines | 1320 | unmoved: `src-tauri/src/probe.rs` declares no test |
| `npm run check` | 439 | **439** files, 0 errors, 0 warnings | 438 | one more file for `svelte-check` to walk |
| `npm test` | 2255 | **2255** passed, 59 files | 2254 | `src/probe.ts` is one more case of `scripts/lint/ipc-detail.test.ts`'s per-file `it.each` sweep |
| `npm run build` | 187 | **187** modules | 186 | one new `.ts` source module, and `src/probe.ts` has no `<style>` block |
| `cargo fmt --check` | — | clean | — | |
| `cargo clippy --workspace --all-targets -- -D warnings` | — | clean | — | |
| `cargo tree -p espansoconfig-core \| rg tauri` | — | no output | — | the architecture rule, unmoved |
| `cargo build -p espansoconfig --features custom-protocol` | — | finished, no errors | — | |

**The two host scars were obeyed.** `cargo test --workspace` was run with `-- --test-threads=1`, which
`PROGRESS.md` names as the authoritative form here because real filesystem watchers inside one binary
time out under parallelism; and no cargo exit status was read through a pipe — every cargo command
redirected to a file that was then read.

The bundle oracles over `dist/assets/index-CWa12Y4i.js`, **both lines read, because the second is what
makes the first non-vacuous**:

```
rg -c '\$\$payload|head_payload|push_element'   → no match (server-only sentinels ABSENT)
rg -c 'window\.__svelte|svelte-trusted-html'    → 2       (client-only constructs PRESENT)
```

And the check that the driver actually reached the bundle:

```
rg -o 'probe_second_writer' dist/assets/index-*.js | wc -l  → 1
rg -o 'probe_third_writer'  dist/assets/index-*.js | wc -l  → 1
```

**`-o … | wc -l` rather than `rg -c`, deliberately**: a minified bundle is one line, so `rg -c` answers 1
for any number of occurrences and cannot tell "present once" from "present at all". The occurrence count
is what says the third writer is not tree-shaken away — 2c-5-5a's finding 3 was exactly that, an unused
export written to defeat tree-shaking that did not defeat it. Here `runThirdWriter()` is reached from
the driver's own plan dispatch, `runCase('editor-third')` → `editorPlan(…, 'third')`, and **Q22 ran it**.

**An unmoved count is evidence of an unmoved count and of nothing broader**, and the gate transcripts
under `/tmp` are not retained artifacts of the tree: these rows are this record's account of what the
commands printed, re-checkable only by running them again.

**One production behaviour did change, and the true statement is narrower than "none did."** The
instrumented build is not the shipped one: `register_with_probe` makes `probe_plan`, `render_probe`,
`probe_second_writer` and `probe_third_writer` **four extra callable IPC commands** on every launch, and
`src/main.ts` calls `startProbe()` unconditionally. Neither is inert, neither was measured, and both go
when the harness is removed.

## 9. What 2d-5-2c-2 inherits, and what it must build

### 9.1 Inherited, working, and not to be rebuilt

- **The tree is `/private/tmp/espansoconfig-harness-2d-5/`.** `HARNESS_ROOT` in
  `src-tauri/src/probe.rs` is a compile-time constant that must agree with `launch.sh`'s `HARNESS`;
  moving the tree means editing both, and a mismatch makes every writer refuse.
- **The four harness paths stay in the working tree**: `src/main.ts` and `src-tauri/src/main.rs` modified
  by two hook lines each, `src/probe.ts` and `src-tauri/src/probe.rs` untracked. **Never `git commit -a`
  or `git commit -am`. Stage by path.**
- **Rebuild in §3's order after every driver edit**, and before the first launch depending on it.
  `npm run build` alone changes nothing — the bundle embeds `dist` at *cargo* build time. This step paid
  that price four times.
- **The driver's shared machinery**, all surface-agnostic and all taking a scope: `say`, `pause`,
  `settle`, `waitFor`, `waitForScope`, `pressNamed`, `pressText`, `pressRow`, `hasControl`, `typeInto`,
  `valueOf`, `chooseOption`, `outcomePanelOf`, `outcomeTextOf`, `waitForOutcomeChange`, `reapplyPanelOf`,
  `reportViewport`, `reportReach`, `reportConflict`, `reportReadiness`, `reportReapply`, `reportFinal`,
  `reportWhatIsOnScreen`, `pickLanguage`, `openFile`, `openSnippet`, `runSecondWriter`, `runThirdWriter`.
- **`waitForOutcomeChange` is the one to use after a *second* send**: `reportConflict` returns on the
  first panel holding a hexadecimal run, which can be a stale one. On this build the reapply clears the
  outcome panel first — Q22 printed `outcomePanel=absent` — but that is a measurement of this build, not
  a property to rely on, which is why the transcript prints it.
- **Three `'changed'` plan-function variants exist in the driver with no case-table row and no
  `runCase` arm** (§5.4). **This entry said adding `deleter-changed`, `mover-changed` and
  `duplicator-changed` to `launch.sh` "needs no driver edit and therefore no rebuild of the frontend",
  and that was false** — the review of this step found it. `runCase` (`src/probe.ts:889`) dispatches on
  the case name and its `default:` throws, so each of the three needs an arm there as well as a
  `launch.sh` row, and an edit to `src/probe.ts` means §3's whole rebuild order and a new binary
  digest. What the driver saves is the *plan function*, not the case. A `creator-anchor` case has
  neither a plan variant nor an arm and needs both.
- **Both external writers are confined, and four residual holes come with the inheritance** — §4.5 names
  all four and none is closed. **Do not read the three reasons they are acceptable as a proof.**
- **If a later step seeds any file a writer must replace, it must sit at that exact path.** The target
  rule is the file, not the directory. Widening `TARGET_TAIL` back to "anything beneath `launches/`"
  undoes what C05 measures.
- **The manifest may be appended to, never regenerated.** `manifest-2d-5-2c-1-post.sha256` is a
  post-image; regenerating it destroys the only thing it says.

### 9.2 What 2d-5-2c-2 must build for itself

1. **Whatever reaches 2d-5-2's own changes.** Nothing in this instrument observes the write-surface
   registry: no transcript line reports `openWriteSurfaces()`, the registry's generation, or the
   creator's reported destination. A regression reading of 2d-5-2 that wants those observed needs
   reporters for them, and `src/lib/browser/writeSurfaceRegistry.ts` is where they would read from.
   What this instrument *does* give that reading, without any further work, is that all six write
   surfaces open, draw, send and close on a real screen.
2. **Bilingual coverage per surface, if it claims any** (§6.11).
3. **Its own restraint about the watcher.** §6.8: nothing here observes real watcher delivery, and
   `2d-5-split-notes.md` §7 item 7 forbids claiming it.
4. **A test, if it adds any rule to either probe source.** §6.7 records that neither file has one.

## 10. Where it is thin

Every item carries one of the two marks `CLAUDE.md` §7.3 defines. **No item here commissions a review
round**; §7.1 is the only mechanism and it reads a diff.

1. **`recorded only` — the four confinement residuals of §4.5.** Inherited, disclosed, unconstructed and
   unclosed. They are not a correctness defect in a *shipped* source file: `src-tauri/src/probe.rs` is
   untracked instrument code that is deleted before this phase's work lands, and the accepted-risk
   argument is §4.5's. They are the likeliest place a later reader over-reads this record.
2. **`recorded only` — the two plan-grammar implementations of §5.8 can disagree.** `launch.sh`'s regular
   expression and `parsePlan`'s segment count are not the same rule. Nothing tests either. A case name
   with a digit or a second hyphen-free word would be refused by the script and accepted by the driver.
3. **`recorded only` — `pause()` spends IPC round trips and nothing bounds the total.**
   `PAUSE_TRIP_LIMIT` caps one pause at 400; a six-second `waitFor` is a hundred pauses. No launch of
   this step was slowed enough to fail, and that is a reading of eight launches rather than a bound.
4. **`recorded only` — the shakedown generation ran three superseded binaries** and its `bytes.txt`
   files are retained. A reader sweeping `launches/` for `bytes=MATCH` will find Q01–Q13 among the hits
   and must read §5.6's table before treating any of them as evidence. Q01's `bytes.txt` additionally
   carries the doubled `failed-lines=0\n0` line that §5.6's first binary's `launch.sh` produced, fixed
   before Q02.
5. **`recorded only` — no launch here observes the file watcher, the registry, or restore.** §6.8 and
   §9.2 item 1. If 2d-5-2c-2 needs any of those observed, the instrument does not yet observe them, and
   that is a scope statement rather than a defect.
6. **`recorded only` — C04's sibling-plant design is inherited, not re-derived.** 2c-5-5a's C08 is the
   launch that showed why an own-tree symlink never reaches the writer; this tree holds no equivalent,
   so the *reason* for the design is a record's and not this tree's measurement.
7. **`recorded only` — the privacy sweep did not read the retained bundles** (§7.1). It read the four
   text artifact kinds. The bundles are copies of a binary built from this repository and no plan wrote
   anything of the owner's into one, but that is an argument and not the sweep's result.
8. **`actionable` — the five decoy files and their `.before` siblings sit outside the harness tree.**
   `/private/tmp/espansoconfig-probe-decoy-C01.yml` … `…-C05.yml` and
   `…-C0N.yml.before`. `rm -rf` on the harness path alone does not reach them, and the step that removes
   the instrument must delete them separately. This names no correctness defect in a source file, so it
   is a cleanup a later step adopts, and it holds no step open.

---

## 11. The orchestrator's wider sweep, added at verification

**Added by the orchestrator while verifying this step, and it widens §7.1 rather than correcting it.**
§7.1's sweep is bounded to four artifact kinds under `launches/` and says so. The orchestrator ran the
same search over **the whole tree**, and it is not empty:

```
rg --no-ignore --hidden -l '/Users/ccarpio' /private/tmp/espansoconfig-harness-2d-5/
  → launch.sh, inert.sh, confine.sh, adversary.sh, manifest-2d-5-2c-1-post.sha256
```

**Every one of the five hits is the repository path, and none is the owner's espanso configuration.**
Enumerated with `rg -o` rather than asserted: the four scripts each carry it once, as the default of a
`${REPO:-…}` parameter expansion, and the manifest carries it twice, naming the two probe source files
that live in the repository. There is no third shape. So §7.1's negative and this positive are
consistent — the transcripts hold nothing of the owner's, and the scripts hold the path of the
repository they build from, which every commit in this project already names.

**Two bounds this inherits unchanged.** It is still a reading of one string, and it still does not read
the 28 retained `.app` bundles (§10 item 7 is unaffected). What it adds is that the *tree-wide* answer
for that string is enumerated rather than unknown.

**Separately measured, because it is the question §7.1's string cannot ask**: no artifact under
`launches/` names a real espanso configuration location —
`rg --no-ignore --hidden -l 'Library/Application Support/espanso|\.config/espanso'` over `launches/`
**finds nothing** — and `launch.sh:117` confines every launch with
`--env "XDG_CONFIG_HOME=$LAUNCH/xdg" --env "HOME=$LAUNCH/home"`, both per-launch paths, so neither
candidate `resolve_config_dir()` probes can reach the real one.

---

## 12. The review's four findings, and their disposition

`docs/reviews/phase-2d-5-2c-1.md` is the report. **Verdict `ship-with-fixes`: 0 blockers, 4
SHOULD-FIX.** The orchestrator **re-derived every one against the files before accepting it**, and all
four hold. Three are corrections to this record; one is a real defect in two harness scripts.

### 12.1 The false claim about what a dropped case costs — §5.4 and §9.1, both corrected above

§9.1 told 2d-5-2c-2 that adding `deleter-changed`, `mover-changed` and `duplicator-changed` to
`launch.sh` *"needs no driver edit and therefore no rebuild of the frontend"*. **It is false.**
`runCase` (`src/probe.ts:889`) has no arm for any of the three and its `default:` throws
``unknown case ${name}``. §5.4 contradicted itself inside one paragraph — *"without touching the
driver"* one clause before *"a case name goes in three places … `runCase`'s switch"*.

**The failure it would have caused is concrete**: 2d-5-2c-2 adds three rows, launches them, and gets
three `--- failed` transcripts after a `cargo` rebuild this record told it was unnecessary. Both
passages now state the real cost — one `runCase` arm per case, an edit to `src/probe.ts`, §3's whole
rebuild order and a new binary digest.

**This is the defect class `CLAUDE.md` names as this project's worst**: a record claiming a guarantee
the code does not give. It was found by reading the code against the record, which is the only thing
that finds it.

### 12.2 `creator-anchor` is not a "changed" variant — §5.4, corrected above

§5.4 called all four dropped rows *changed variants*. The creator's is `creator-anchor`, which
2c-5-5a §4 runs as P45 under that name and which §9.1 of this record has always named separately. Not
a behavioural claim, but it is the name a later step will search `launch.sh` and `src/probe.ts` for.

### 12.3 `decoy=unchanged` is vacuous on two rows — §4.4, corrected above

C02's decoy is the writer's **read** path (`confine.sh:89`) and C05's is never referenced at all
(`adversary.sh:109-111`), so on those two rows the column reports a write nobody attempted. The
refusal lines carry both rows regardless, and no verdict depended on the column.

### 12.4 The confinement wait loop could never break early — **fixed in both scripts, and the fix is measured**

`confine.sh:101` and `adversary.sh:124` waited on `--- end` alone. **A confinement control's pass is
`--- failed`, so `--- end` never arrives**, and the loop ran its full 25 iterations every time: it was
a fixed 25-second sleep wearing the shape of a wait, and it established nothing. C01–C05 each paid it.

**Both loops now break on either terminal line** (`grep -q -e '--- end' -e '--- failed'`), with a
comment saying why. `bash -n` parses both clean.

**Measured rather than asserted, on two fresh launches of the fixed scripts:**

| Launch | Script and mode | Wall clock | Outcome |
|---|---|---|---|
| **C06** | `confine.sh target` | **6.46 s** | `failed-lines=1`, `decoy=unchanged`, `target=still R0`, `tree-diff=0`, `probe.err=0` — the same refusal C01 quotes |
| **C07** | `adversary.sh target-elsewhere` | **4.41 s** | `failed-lines=1`, `target=still R0`, `tree-diff=0`, `probe.err=0` — the same refusal C05 quotes |

Both ran binary `40d1e67b64c764fcd5c35820467da3c3cb3c5887a1e620bc46cb3177454c8254`, the proof
generation's. **The outcome is unchanged and only the wall clock moved**, which is what a fix to a
wait ought to look like.

**What that leaves true of C01–C05**: they ran the *unfixed* loop, so their transcripts were collected
after a full 25 seconds rather than after the refusal. That does not weaken them — the refusal line
was already written when the loop began spinning, and `pkill` came after — but it does mean the five
retained controls and the two new ones ran scripts that differ by this hunk, and that is disclosed
rather than hidden. C06 and C07 are the re-takes on the fixed scripts.

### 12.5 What the review did not verify, carried forward rather than dropped

The report's own `NOT-VERIFIED` list, restated so no later reader mistakes silence for coverage: the
four gate figures were not re-run by the reviewer (a serial `cargo test --workspace` exceeds a
20-minute budget) and are the orchestrator's; the 28 retained `.app` binaries were not searched for
owner data (§10 item 7, §11); **no launch was re-taken, so §4.1's per-launch narrative — panel
geometry, choice ordering, `arm=` values, quoted sentences — is checked against `bytes.txt` only and
not against the `probe.log` transcripts**; the four §4.5 rebindings are unconstructed by design; and
whether `tauri::Builder::invoke_handler` is a plain setter (`probe.rs:156-157`) was not confirmed
against the tauri source. The third of those is the sharpest, and it is *recorded only*: it bounds
what §4.1 is evidence of, and it names no defect.

### 12.6 What §7.1 commissions for this fix round: **nothing**

`CLAUDE.md` §7.1 reads one input — this fix round's own diff. It touched
`docs/decisions/2d-5-2c-1-instrument-rebuild.md`, which is on §7's closed list, and `confine.sh` and
`adversary.sh`, which are **not files in this repository at all** — they live under `/private/tmp` and
appear in no `git diff`. **No source file changed, so no round is commissioned and §7.2 closes the
step.** Under the `/autoclaude-opus` workflow the same conclusion arrives by a second route: one
review per phase, and no re-review inside it.
