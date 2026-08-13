# Phase 2c-4c step 4b — the recovery cases

Step 2c-4c-5 is the bilingual window reading the phase owes for six surfaces. **This step is not
it**, and nothing here judges a screen. It extends the uncommitted harness 4a rebuilt so that step 5
can *observe* the recovery surfaces, and it closes four of the five holes `2c-4b-3d-3-notes.md` §4.1
left.

**4b adds reporting and activation, not reach — and that distinction is 4a's review's, not this
step's.** The four surfaces that cannot create have mounted `RecoveryWithoutCreation.svelte`
unconditionally since 2c-4c-3b, and the two that can have mounted `RecoveryPanel.svelte` since
2c-4c-3a, so P09–P12 of 4a already **drew** a recovery sentence. What was absent was that any of it
entered a transcript, that any launch pressed the offer, and that any plan drove an **opened**
recovery form. All three are now present and all three are demonstrated by a launch.

**No production source file changed.** `git status --short --untracked-files=all` at the close of
this step lists the same four harness paths 4a left plus this record, and `git diff` over the two
hook files is still exactly the four lines `2c-4c-4a-instrument-rebuild.md` §2.1 quotes — 5
insertions, 1 deletion, verified by `git diff --stat`. That is a statement about the **resulting tree
shape**, not about every write made during construction: the tracked production diff at the close of
this step is exactly those four lines, and the untracked paths are `src/probe.ts`,
`src-tauri/src/probe.rs`, `/private/tmp/espansoconfig-harness-2c-4c/` and this file.

**Fourteen launches, P13–P26.** Every one reached `--- end` exactly once, printed no `--- failed`,
left a zero-byte `probe.err`, and answered `bytes=MATCH`. **Two** of them compared the file against an
expected-bytes document this step adds to the tree, and both are **retained matching comparisons**.
Whether an earlier attempt at either existed is **not recorded by any artifact** — the manifest is a
post-image (§7.2), so nothing retained would show a discarded attempt if there had been one. This step adds **three** such documents; the third was not launched (§6.3).

---

## 1. Where the tree is, and what this step added to it

The tree is `/private/tmp/espansoconfig-harness-2c-4c/`, unchanged. **Steps 5 and 6 still need that
path.**

```
/private/tmp/espansoconfig-harness-2c-4c/
  launch.sh                        the case table (now 31 rows), the seed, a fresh bundle, the checks
  fixtures/                        24 files — 4a's 21 plus 4b's 3 expected-bytes documents
  launches/P01…P26/                4a's twelve, then this step's fourteen
  manifest-2c-4c-4a-post.sha256    4a's post-image, untouched — see §7.2 for what it now says
  manifest-2c-4c-4b-post.sha256    this step's, 55 entries, all verify
```

It is **1.0 GB** after twenty-six launches, because `launch.sh` assembles a fresh `.app` bundle per
launch and every launch keeps its own. That is the same growth rate 4a §1 recorded and not a
measurement of what this step cost.

**The owner's real configuration was never opened.** Every launch points `XDG_CONFIG_HOME` at the
synthetic two-file tree `launch.sh` writes and `HOME` at an empty directory. Verified rather than
asserted (§8).

## 2. What 4b's scope was, and where each item is

`PROGRESS.md`'s "What the 4a review changed about step 4b's scope" names three things plus the
fixtures a recovery create needs; `2c-4b-3d-3-notes.md` §4.1 names five holes.

| # | Scope item | Where it is | Demonstrated by |
|---|---|---|---|
| 1 | Targeted reporting of `[data-recovery-without-creation]` on the four non-creating surfaces | `reportRecoveryWithoutCreation()` in `src/probe.ts`, called from `deleterPlan`, `moverPlan`, `duplicatorPlan`, `rawPlan` and the three operation reload plans | P13 (deleter), P14 (mover), P15 (duplicator), P16 (raw), and again in P20/P21/P22 |
| 2 | Targeted reporting **and activation** of the editor's and the creator's recovery offer | `reportRecoveryOffer()` and `openRecoveryForm()`; the offer is pressed through `pressNamed`, so a missing control is `--- failed` | P17 (creator), P18 and P19 (editor) |
| 3 | A `.recovery`-scoped driver for the opened form, through its own create / refusal / conflict / reload outcomes | `driveRecoveryForm()` with its three endings, `reportRecoveryForm()`, `reportRecoveryOutcome()` | P17 `create`, P18 `refusedThenSaveAnyway`, P19 `conflictThenReload` |
| 4 | Expected-byte fixtures a recovery create needs | `creator-recovery-create-expected.yml`, `editor-recovery-refused-expected.yml`, `editor-recovery-create-expected.yml` | P17, P18; the third is built and unlaunched (§6.3) |
| 5a | Hole 1 — `browser.notice.gone`'s second producer | **Not closed.** §5 states why, from the code, and what would close it | — |
| 5b–5e | Holes 2–5 — the confirmed-reload transition on the creator, the deleter, the mover and the duplicator | `creatorReloadPlan`, `deleterReloadPlan`, `moverReloadPlan`, `duplicatorReloadPlan` and four case rows | P23, P20, P21, P22 — each **launched**, which is more than a hole costs |

## 3. What was built, file by file

### 3.1 `src-tauri/src/probe.rs` — a fourth command

`probe_third_writer`, over a new `ECFG_PROBE_R2`. `probe_second_writer` and the new command now share
one private `replace_the_target(ordinal, variable)`; the child command is unchanged apart from the
environment variable's name (`$SOURCE` where it was `$R1`).

**Why a third document rather than a second run of the second writer.** A recovery form drafts
against the **disk** revision the host surface's conflict carried — `RecoveryDestination.revision` is
that revision for the conflict's own file (`src/lib/browser/recovery.ts:390`) — which is R1. A
`ContentRevision` is a function of the bytes, so re-installing R1 leaves the revision equal and the
recovery create **commits** instead of conflicting. Only a third document moves the file again.

`register_with_probe` now registers four probe commands beside the shipped thirteen. The arrangement
4a §5.2 insists on is untouched: `crate::register` first, the shipped list repeated rather than
reached into, `main.rs`'s own `generate_handler!` left exactly as it is for
`wire_contract::registered_commands()` to parse.

### 3.2 `src/probe.ts` — four reporters, one driver, six plans

981 lines at 4a, 1598 now. New:

- **`reportRecoveryWithoutCreation(what, selector)`** — prints three readings and conjoins none:
  how many `[data-recovery-without-creation]` elements the surface holds, how many the **whole
  document** holds, and — separately — which of the five `browser.recovery.unavailable.*` sentences is
  drawn as a whole paragraph, resolved through `translate()` in the launch's own language. The
  element's **attribute value** is the reason the component itself derived. `elements=0` beside a
  named `sentencesByDictionary` is the signature of a host that re-inlined the paragraph; this
  function does not say so, and nothing in the harness does.
- **`reportRecoveryOffer(what)`** — the `section.recovery` rectangle, whether the offer control is
  present by its exact translated label, the roll of controls inside the section, which unavailable
  sentence it draws, and the section's whole text.
- **`openRecoveryForm()`** — `pressNamed('browser.recovery.open', RECOVERY_SURFACE)`. That is where
  the assertion lives: `pressNamed` throws when the control does not arrive and `startProbe` turns
  that into `--- failed`.
- **`reportRecoveryForm(what)`** — the destination list with each row's `aria-pressed`, the six
  transfer-table rows, both box values, whether the trigger box is read-only, and the create
  control's disabled state. Every lookup scoped.
- **`reportRecoveryOutcome(what)`** — the form's own outcome panel, **waited for**, scoped.
- **`driveRecoveryForm(what, ending)`** — the three endings §4 tabulates.
- **`runThirdWriter()`**, **`editorRecoveryPlan`**, **`creatorRecoveryPlan`**,
  **`reloadAfterConflict`**, **`creatorReloadPlan`**, **`deleterReloadPlan`**, **`moverReloadPlan`**,
  **`duplicatorReloadPlan`**.

`editorPlan` and `creatorPlan` each gained one line — a `reportRecoveryOffer` call **before** *Keep my
draft* — and the four non-creating plans each gained one `reportRecoveryWithoutCreation` call. Nothing
else in 4a's driver changed.

**`RECOVERY_SURFACE = 'section.recovery'`, and the scope is load-bearing.** `RecoveryPanel.svelte` is
drawn *inside* `section.matchEditor` (`MatchEditor.svelte:895`) and `section.creator`
(`MatchCreator.svelte:779`), and it draws a `.panel[role="status"]` and a `.panel.reapply` of its own.
So `outcomePanelOf('section.matchEditor')` would answer the **recovery** panel's block for a question
about the host's the moment a recovery create has an outcome — `querySelector` takes the first in
document order and the recovery section stands above the host's own outcome panel — and
`reportFinal`'s unscoped `[role="status"]` sweep would print both under one name.

**Which second reload control depends on the surface's draft kind**, which is why
`reloadAfterConflict` takes a `closing` flag: `conflictChoiceKey` gives an `authoredText` surface
`browser.saveOutcome.choice.confirmReload` and an `operationChoice` surface
`browser.saveOutcome.choice.confirmReloadClosing` (`src/lib/browser/saveOutcome.ts:1552`). A plan that
pressed the wrong one would time out and print `--- failed`. P20/P21/P22 pressed *Close this and load
it* / *Cerrar esto y cargarla*; P23 pressed *Descartar mi texto y cargarla*.

### 3.3 `launch.sh` — eight new rows and an `R2` column

The case table is 23 rows plus 8. `R2` is empty on every row but `editor-recovery-conflict`, and
`R2PATH` is empty when no row names one, so `ECFG_PROBE_R2` is always passed and is the empty string
except on that one case. `bytes.txt`'s `expect=` line now carries `r2=` as well; nothing else about the
script's checks changed, and **it still conjoins none of them** (3b §8.9).

### 3.4 The three new fixtures, and how they were derived

Each is the case's R1 document with one item appended, and the appended item was derived from the
code the way `creator-front-expected.yml` was. Which keys are written is `newMatchOfRecovery`'s
answer (`src/lib/browser/recovery.ts:769`): the two mandatory fields come from the buffers and an
optional one appears only when the transfer carried it, which for both cases is none — the P17 and
P18 transfer tables printed *not carried over, so this key is not written at all* for all four.
`render_item` (`crates/espansoconfig-core/src/patch/edit.rs:5704`) writes `marker` spaces then `- `
for the first field and two spaces for the rest, and `choose_scalar`
(`crates/espansoconfig-core/src/emit/choose.rs:80`) refuses a plain scalar starting with `:`
(`LEADING_INDICATORS`), so a trigger falls through to single quotes and a body stays plain.
`RECOVERY_POSITION` is a frozen `{ End: {} }` (`src/lib/browser/recovery.ts:803`) and there is no
chooser anywhere, so the item goes last.

| Fixture | R1 | Appended |
|---|---|---|
| `creator-recovery-create-expected.yml` | `target-deleted-r1.yml` | `  - trigger: ':probe'` / `    replace: probe creation` |
| `editor-recovery-refused-expected.yml` | `target-changed-r1.yml` | `  - trigger: ':beta'` / `    replace: probe edit` |
| `editor-recovery-create-expected.yml` | `target-changed-r1.yml` | `  - trigger: ':probe'` / `    replace: probe edit` |

**The first two are retained matching comparisons** (P17, P18) — that is the evidence, and it is a
statement about the launches `launches/` holds, not about how many attempts preceded them. The
derivation above is why they were written that way. The third is compared against nothing by any
retained launch (§6.3).

## 4. The three recovery endings, and why each fixture shape produces it

`recoveryAvailability` refuses unless the surface's last reapply answered `manualResolution`
(`src/lib/browser/recovery.ts:526`), so every recovery plan has to *earn* the offer:

- **the editor** drafts over `:beta` against `target-changed-r1.yml`, which rewrites that snippet's
  body, so `planMatchReapply` finds a field collision and refuses the whole rebase;
- **the creator** anchors its placement on `:beta` against `target-deleted-r1.yml`, which removes that
  snippet, so the anchor is gone.

Both were confirmed in the transcripts: P17 and P18 print
`recoveryEntry arm=browser.reapply.manualResolution`.

| Ending | What it does | Why |
|---|---|---|
| `create` | types `:probe` into the trigger box, then *Create this snippet* | The consult makes the trigger an **editable literal** and nothing auto-suffixes it, so a form seeded from a match editor's draft carries the source snippet's own trigger |
| `refusedThenSaveAnyway` | leaves the carried trigger, meets `newMatchRepeatsLiteralTrigger`, presses *Save anyway* | The ordinary acknowledgeable-finding path, answered by the same control every other surface answers one with |
| `conflictThenReload` | runs the third writer, creates, meets the form's **own** conflict, presses *Load the version on disk* then *Discard my text and load it* | Two controls, not one pressed twice |

## 5. Hole 1 is **not** closed, and this is the reason rather than an omission

`browser.notice.gone` has two producers (`src/lib/browser/notices.ts:42`): `reresolve` finding no
entry at the held index — a statement about the **length** of the list — and `repairSelection`'s
`clearSelection` arm (`src/lib/browser/selection.ts:292`). **Every launch of this step that drew that
sentence drew it from the first producer**, and the second is, as far as this instrument can reach,
not reachable at all.

The chain, read in the code rather than inferred from a failure:

1. `repairSelection` has exactly one production caller: `select()` in
   `src/lib/browser/workspace.svelte.ts:2015`, reached only when `commands.getMatch(next.id)` fails.
2. `next.id` is minted from the projection **this window already holds** for that document
   (`workspace.svelte.ts:1975`–`1983`).
3. The `clearSelection` action is answered for exactly three codes — `identityNoSuchMatch`,
   `identityWrongDocument` and `unknownDocument` (`src/lib/ipc/errors.ts:745`–`748`).
4. `IdentityNoSuchMatch` is produced only when document **and revision** agree and no match of that
   projection is that node (`src-tauri/src/error.rs:143`,
   `crates/espansoconfig-core/src/model/document.rs:301`). A `ContentRevision` is a function of the
   bytes, so an identity minted from a projection at revision *R* names a node that any parse of *R*
   resolves. A revision that differs answers `IdentityStaleRevision`, which routes to `reresolve` —
   the first producer.
5. `IdentityWrongDocument` needs a match identity naming a different document from the one it was
   offered to, and `UnknownDocument` a document identity the boundary does not know. `select()`
   builds both from one projection this window holds, and the window's document list and the
   boundary's come from the same `open_workspace`.

**So a plan that drives the DOM cannot reach it.** What would: a probe-side command that hands
`select()` a `MatchId` this window did not mint, which is instrumenting the model rather than driving
a window and is a different kind of instrument from this one. That is stated as the cost, not
proposed. **This is an argument from reading the code, not a measurement**: no launch attempted it,
and no launch could have distinguished "unreachable" from "not attempted".

## 6. The fourteen launches

Every one satisfies, **by a reader and never by the harness**, the four-part conjunction 3b §8.9
defines. The viewport is `1180x728`, `dpr=2`, `hasFocus=false`, `visibility=hidden` on all fourteen,
and `lang=` equals `picked=` on all fourteen — the picker was used in every launch, which matters
because the WebKit data store follows the bundle identifier every probe bundle shares.

| # | Case | Surface | Lang | `bytes=` | `backups=` | What it added |
|---|---|---|---|---|---|---|
| P13 | `deleter-exact` | deleter | en | MATCH | PRESENT | first `[data-recovery-without-creation]` reading, `reason=operationDraft` |
| P14 | `mover-exact` | mover | es | MATCH | PRESENT | the same, `reason=operationDraft`, Spanish |
| P15 | `duplicator-exact` | duplicator | en | MATCH | PRESENT | the same, `reason=operationDraft` |
| P16 | `raw-negative` | raw | es | MATCH | none | the same, `reason=wholeDocumentDraft`, Spanish |
| P17 | `creator-recovery-create` | creator | en | MATCH | PRESENT | offer asserted **and pressed**; form driven to a committed create |
| P18 | `editor-recovery-refused` | editor | es | MATCH | PRESENT | offer pressed; create **refused** with a finding, then *Save anyway* |
| P19 | `editor-recovery-conflict` | editor | en | MATCH | none | the form's **own** conflict, then a confirmed reload; nothing written |
| P20 | `deleter-reload-gone` | deleter | en | MATCH | none | hole 3 — confirmed reload on the deleter |
| P21 | `mover-reload-gone` | mover | es | MATCH | none | hole 4 |
| P22 | `duplicator-reload-gone` | duplicator | en | MATCH | none | hole 5 |
| P23 | `creator-reload` | creator | es | MATCH | none | hole 2 |
| P24 | `editor-reload-gone` | editor | es | MATCH | none | 4a's one reload case, launched for the first time |
| P25 | `editor-exact` | editor | en | MATCH | PRESENT | 4a's positive editor case under 4b's driver |
| P26 | `creator-front` | creator | es | MATCH | PRESENT | 4a's positive creator case under 4b's driver |

### 6.1 What the four non-creating surfaces printed

Each of the four produced a marked element with the reason **that component derived**, and each
printed `elements=1 documentWide=1`:

- **deleter** (P13, P20) `reason=operationDraft box=658,-14,491x51`;
- **mover** (P14, P21) `reason=operationDraft box=658,-15,491x51`, Spanish sentence;
- **duplicator** (P15, P22) `reason=operationDraft box=658,-14,491x51`;
- **raw** (P16) `reason=wholeDocumentDraft box=658,121,491x51`, Spanish sentence.

`sentencesByDictionary` named the same reason on all four, so the marked element and the dictionary
agree. **What that establishes is that one marked element carrying that reason was in the surface's
subtree at the moment of the reading, and that a paragraph with that reason's exact sentence was
too.** It does not establish that a person could see either — three of the four rectangles have a
negative `y` — and it is not a claim that the sentence is true (3b §8.2 is inherited whole).

### 6.2 What P17, P18 and P19 printed

**P17** — the creator's conflict shows `expected 9246ae21…` against `found cf285e09…` equal to
`diskRevision`; the reapply arm is `manualResolution` with the missing-anchor obstacle; the recovery
section then draws exactly one control, *Create a new snippet from supported fields*, which the plan
pressed. The form's destination list holds **one** row, `match/conflict.yml`, `aria-pressed=true`.
`config/default.yml` is absent from it, and P23 is the useful contrast: the **creator's** own
destination list in that launch drew both files, because `matchCreation.ts` lists every file with a
typed refusal while `recoveryDestinationsOf` carries only eligible ones. That the reason is the
missing `matches:` list is read from the code (`src/lib/browser/recovery.ts:423`) and from the
synthetic profile's two lines; no transcript names it. The
transfer table's six rows read *Trigger carried over :probe*, *Replacement text carried over probe
creation*, and *not carried over, so this key is not written at all* for the four optional fields. The
file ends byte-identical to `creator-recovery-create-expected.yml`.

**P18** — the same in Spanish through the editor, with the transfer table carrying `:beta` from the
projection and `probe edit` from the buffer. The create is refused: *El fragmento nuevo repite un
texto de disparador que ya escribe otro fragmento de esta lista* — `newMatchRepeatsLiteralTrigger` —
with *Guardar de todos modos* and *Seguir editando* offered. *Guardar de todos modos* was pressed and
the file ends byte-identical to `editor-recovery-refused-expected.yml`.

**P19** — the third writer runs after the form is open, and the recovery create comes back a conflict
whose three revisions are `f53dfa44…` against `6278f5c1…` equal to its `diskRevision`. The panel
offers *Keep editing · Keep my draft · Load the version on disk*; after the first press the roll is
*Keep editing · Keep my draft · **Discard my text and load it***, which is the two-control shape.
After the confirmed reload the section holds no status block at all. The file ends byte-identical to
R2 and `backups=none` — the final filesystem state of a launch that wrote nothing, bounded by §10.3:
a write producing identical bytes, or a transient one undone before the launch ended, would leave the
same artifacts.

**Every revision in every transcript equals the SHA-256 of the fixture it names**, checked directly:
`base-r0.yml` is `9246ae21…`, `target-deleted-r1.yml` `cf285e09…`, `target-changed-r1.yml`
`f53dfa44…`, `target-labelled-r1.yml` `6278f5c1…`, `elsewhere-r1.yml` `04e4bef8…`. That is 4a §4.2's
observation holding on this build over three more files; it is still **an observation of these files
on this build** and not a documented property of the revision function.

### 6.3 Four un-launched prediction fixtures are still four, and there is now a fifth

4a §6.3 named `editor-fallback-expected.yml`, `mover-reordered-expected.yml`,
`mover-after-expected.yml` and `mover-end-expected.yml` as predictions no retained launch compares
against anything. **This step launched none of them, so all four stand exactly as 4a left them.**
`editor-recovery-create-expected.yml` joins them: its case has a plan arm and a case row and was not
launched, because P18 exercises the same plan through its refusal ending and P17 exercises a create.
Read a `bytes=DIFFER` on any of the five as a suspect fixture first.

### 6.4 The reload plans drew `browser.notice.gone` from the **length** arm

P20, P21, P22 and P24 each selected `:gamma` — position 2 — against a `target-deleted-r1.yml` holding
two items, so after the confirmed reload the held index is off the end of the list. All four printed
the *selection was cleared* notice, and **that is `reresolve`'s length arm — the producer 3d-2b
already read**; §5 is why the other producer is not here.

On all four the notice was the **only** `[role="status"]` block `.detail` held afterwards. That is a
reading of the status blocks and not of the surface elements: no line of any transcript says whether
`section.deleter` and its two siblings were still in the tree.

P23 (the creator) printed `notice=absent`, which is correct and not a gap: no snippet was selected, so
there was nothing to clear.

### 6.5 A rectangle worth carrying to step 5, judged by nobody here

`section.recovery` reports a **zero-height** bounding rectangle in every launch that measured it —
`491x0` when it is empty (P25, P26), `491x0` when it holds an offer (P17, P18), and `491x0` when it
holds a whole open form (P17, P18) — while its children are laid out and measured normally (the offer
control is `296x27` at the same `y`). Recorded as a measurement for step 5 to look at. **Nothing here
judges whether that is a layout defect**, and no reading of any kind was taken.

## 7. Deviations, and what the artifacts do and do not pin

**7.1 The launches are numbered `P13…P26`,** continuing 4a's sequence in 4a's own tree, because it is
the same ledger.

**7.2 4a's manifest was not regenerated, and it now reports three failures.**
`shasum -a 256 -c manifest-2c-4c-4a-post.sha256` verifies **45 of its 48 entries** and fails on
`launch.sh`, `src/probe.ts` and `src-tauri/src/probe.rs` — the three files this step changed, and
nothing else. Every fixture 4a wrote and every P01–P12 `probe.log` and `bytes.txt` still verifies.
This step's own post-image is `manifest-2c-4c-4b-post.sha256`, **55 entries**, all verifying:
`launch.sh`, all 24 fixtures, both probe sources and every P13–P26 `probe.log` and `bytes.txt`. It is
a **post-image only** and cannot say what any file held before.

**7.3 One binary ran all fourteen launches, and its provenance is unknown.** Every `bytes.txt` from
P13 to P26 records
`binary=fcc9c3ac8713906d9793552a714e744218f720ea9714b6a1e700e99e05effc2e`, and that digest is
byte-identical to `target/debug/espansoconfig` as it stands now. It **differs** from the
`8f650ddaee7e…` 4a's P07–P12 ran, which is consistent with the driver having been rebuilt and is not
evidence that it was: `launch.sh` copies whatever `ECFG_BINARY` names without checking a timestamp,
**no build transcript was retained**, and no retained artifact binds either executable to a source
snapshot or a build command. *This source tree runs* is therefore not available here either, for
4a §6.4's reason exactly. What the bundles pin is which bytes ran.

**7.4 `repeatIfAsked` is still built and unused,** and no launch of this step passed `:twice`.

**7.5 The `.recovery` scope is applied by this step's own reporters and not by 4a's.** `reportFinal`
and `outcomePanelOf` are unchanged, so a *host-surface* report taken after a recovery outcome exists
would still sweep the recovery panel's blocks into it. No plan here does that — the recovery plans
report the host's conflict before the form is opened and the form's outcome after — but nothing in the
harness enforces it, and a later plan that reported the host surface's final state after a recovery
create would print both under one name.

## 8. Privacy, verified rather than assumed

- **No launch artifact contains any path under the owner's home directory (`$HOME`).**
  `rg --no-ignore --hidden -l` over every `probe.log`, `probe.err`, `bytes.txt` and `tree.diff` in
  `launches/` finds nothing. This record is a public-repository artifact too, so it names `$HOME`
  rather than spelling the path it is asserting the absence of.
- **Every fixture is neutral**: `:alpha`, `:beta`, `:gamma`, `:probe`, and the one comment line, and
  nothing else. The three new fixtures are their R1 document plus one `:probe` or `:beta` item.
- **The real espanso configuration was never opened.** `~/.config/espanso` does not exist;
  `~/Library/Application Support/espanso` does, and a recursive `rg --files --hidden --no-ignore` over
  it finds no `.espansoconfig-backups`; `~/.espansoconfig-backups` does not exist. That is one
  recursive sweep of the espanso directory and two path tests, and not a sweep of the machine. Every launch pointed both candidates `resolve_config_dir()` probes
  (`crates/espansoconfig-core/src/discovery.rs`) at its own tree.
- **`git status --short --untracked-files=all` lists four paths** — `src-tauri/src/main.rs` and
  `src/main.ts` modified, `src/probe.ts` and `src-tauri/src/probe.rs` untracked — plus this record.
  **Nothing under `crates/espansoconfig-core/tests/corpus/real/` appears.**

## 9. The gates, **with the harness in the tree**

**These are with-harness figures and must never be carried forward as production numbers.** Step 6
re-derives `1767 / 423 / 180 / 1112` on a harness-free tree.

**No gate transcript was retained, so this table is the implementer's account and not an artifact.**
It records what the commands answered when they were run; it does **not** establish when they ran
relative to the last harness edit or to the fourteen launches, because nothing retained orders those
events. Anyone who needs the ordering must re-run the four commands on the tree in front of them —
which is cheap, and is what the orchestrator did independently at this step's close.

| Command | This step | 4a | Harness-free baseline |
|---|---|---|---|
| `cargo test --workspace` | **1112** passed, 0 failed | 1112 | 1112 |
| `npm test` | **1768** passed, 51 files | 1768 | 1767 |
| `npm run check` | **424** files, 0 errors, 0 warnings | 424 | 423 |
| `npm run build` | **181** modules | 181 | 180 |
| `cargo fmt --check` | clean | clean | — |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | clean | — |

**Every one is unchanged from 4a, and that is the expected result**: this step added no `src/lib/`
module, no `.svelte` file and no Rust test. `src/probe.ts` was already the `+1` on each frontend gate;
growing it from 981 to 1598 lines moves no count. `src-tauri/src/probe.rs` still declares no test, so
`cargo test` is unmoved.

**The module count was checked both ways, which `CLAUDE.md` §6 requires.** 181 is 180 + 1 for one
`.ts` source module with no styles, and `dist/assets/index-ByDKvekq.js` was searched for
`internal/server`, `svelte/server` and `async_hooks` — **0 occurrences** — while the same file holds
**495** occurrences of `svelte`, so the search is live. Do both, never the number alone.

**No gate transcript was retained**: these rows are this record's account of what the commands
printed, re-checkable only by running them again.

## 10. What this step does **not** prove

3b §8, 3c-1 §7, 3d-2a §6 and 4a §6 are inherited whole. What matters most, restated because a reader
of this file may not open those:

**10.1 Nothing here is a window reading.** No launch judged whether a person could read, reach or
understand anything. The `y = -14` and `y = -15` rectangles §6.1 records are measurements, and step 5
is what judges them.

**10.2 It cannot fail because a sentence is untrue.** The transcript prints the strings the panels
drew, and a false one prints exactly as well as a true one. This applies with full force to the four
recovery sentences and to the transfer table: `transfer[0] "Trigger carried over :probe"` is evidence
that those words were on screen and evidence of nothing about whether the trigger was in fact carried.
What *is* independent evidence is the byte comparison, and it is the harness's only one.

**10.3 There is still no invoke spy and no command counter.** So *the refused create issued exactly
one command* and *the reload wrote nothing* are not established. What P19 shows is a final filesystem
state equal to R2 with no backup directory; a write producing identical bytes, or a transient one
undone before the launch ended, would leave the same artifacts.

**10.4 `HTMLElement.click()` is not a mouse click.** No plan used the keyboard, tabbed, or produced an
untrusted-event refusal. Focus order and keyboard operability of the recovery panel are untested by
every launch here.

**10.5 The `elements=1 documentWide=1` reading does not prove which component drew the paragraph.**
It proves that one element carrying that attribute was in the subtree. A host that re-inlined the
paragraph *and also* stamped the attribute would read identically. What the attribute closes is the
cheaper failure — a host that re-inlined the paragraph and did not stamp it — which is the failure
2c-4c-3b's High was about.

**10.6 The adoption arm is invisible.** `installed` and `alreadyThere` both reach the same drawn
state, so no launch here distinguishes them.

**10.7 The fixture shape is still the easy one.** Double-quoted triggers, one leading comment, LF
endings, no BOM, no block scalars, no item-owned comments, no blank-line runs, no second sequence, no
read-only file, no package. **R38 is untouched: none of the fifteen corpus fixtures `CLAUDE.md` §4
lists has been through this harness.**

**10.8 Language coverage is still aggregate.** Seven launches in English and seven in Spanish, and the
**editor and creator were each launched in both** — but the deleter and duplicator only in English and
the mover and raw editor only in Spanish. Step 5 still owes both languages on every surface.

**10.9 Seventeen of the thirty-one cases were not launched by this step**, and those same seventeen
have never been launched by any step of this phase — 4a's six are a subset of 4b's fourteen: `editor-collision`, `editor-fallback`, `editor-satisfied`,
`editor-ambiguous`, `editor-missing`, `editor-ineligible`, `editor-empty-satisfied`,
`editor-recovery-create`, `creator-anchor`, `creator-anchor-gone`, `deleter-changed`,
`duplicator-changed`, `mover-changed`, `mover-reordered`, `mover-reordered-end`, `mover-after` and
`mover-after-changed`. A case-table row is not evidence.

**10.10 No finding of any earlier reading was re-checked**, and nothing here is a reading of 3c-2's or
3d-2b's ledgers.

## 11. What step 5 needs from this record

- **The tree is `/private/tmp/espansoconfig-harness-2c-4c/`.** Step 5 launches from it; step 6 deletes
  it and re-derives the harness-free gate figures.
- **The four harness paths stay in the working tree.** Never `git commit -a` or `git commit -am`;
  stage by path.
- **Rebuild in 4a §3's order after every driver edit** — `npm run build`, `touch src-tauri/build.rs`,
  `cargo build -p espansoconfig --features custom-protocol` — and before the first launch depending on
  it. `npm run build` alone changes nothing.
- **The recovery cases are `editor-recovery-create`, `editor-recovery-refused`,
  `editor-recovery-conflict`, `creator-recovery-create`**, and the reload cases are `creator-reload`,
  `deleter-reload-gone`, `mover-reload-gone`, `duplicator-reload-gone` and 4a's `editor-reload-gone`.
- **A recovery reading owes both languages on all six surfaces** (§10.8), and it owes a judgement on
  §6.5's zero-height section and §6.1's negative `y` rectangles.
- **Hole 1 is open and §5 says why.** It is not step 5's to close with a launch.
- **Append to `manifest-2c-4c-4b-post.sha256` or write a `2c-4c-5` one**; do not regenerate 4a's,
  which is now a partial-verify artifact by design (§7.2).
