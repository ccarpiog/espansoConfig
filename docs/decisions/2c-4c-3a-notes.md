# Phase 2c-4c-3a — the recovery panel, its words, and the two surfaces that create

**Step 2c-4c-3 was split in two by the orchestrator.** This is **3a**: the recovery panel
itself, its i18n in both languages through typed accessors, and the two surfaces that can
create — `MatchEditor.svelte` and `MatchCreator.svelte`. **3b** draws `MatchDeleter.svelte`,
`MatchMover.svelte`, `MatchDuplicator.svelte` and `RawEditor.svelte`; all four are
**byte-identical** after this step, and their mounted proofs — that they offer neither copy
nor save-as-new, and that raw offers no save-as-new — are 3b's, not this record's.

The phase's cut is `PROGRESS.md` § "Phase 2c-4c — consult disposition"; the consult is
`docs/reviews/phase-2c-4c-design.md`; step 2's record, which this step draws, is
`docs/decisions/2c-4c-2-notes.md`.

---

## 1. What this step built

**One renderer, one presentation section in the model, seven accessors, and two hosts.**

- `src/lib/components/RecoveryPanel.svelte` — the whole recovery UI, shared by the match
  editor and the creator. A walk over `recoveryView()`'s answer, with the offer, the
  transfer table, the destination list, the fixed-end sentence, the two boxes, the action
  row, the send-failure block, the reapply report and the three outcome arms.
- `src/lib/browser/recovery.ts` gained a **presentation section**: six key functions,
  `TransferStatus` with `transferStatusOf` and `transferStatusKey`, and
  `recoveryIsAnswerable`. Two booleans of `RECOVERY_CONFLICT_CAPABILITIES` moved from `false`
  to `true`. **No transition changed its behaviour**, and one changed its *signature* in the
  round-1 fix: `sendRecoveryCreate` now takes an `InstallTheWaitingForm` third argument and
  calls it before it authorizes anything. §6.1 is that fix and why it is in the model.
- `src/lib/i18n/{en,es}.json` gained the `browser.recovery.*` namespace — 58 keys per
  language — and `src/lib/i18n/index.ts` gained seven reactive accessors over the six code
  unions, two of which **compose** a nested code's sentence rather than inventing a fifth
  string set.
- `MatchEditor.svelte` gained four props (`documents`, `projections`, `create`,
  `adoptRecoveryDiskVersion`) and draws the panel; `MatchCreator.svelte` gained no prop and
  draws it from what it already had; `DetailPane.svelte` supplies the editor's four.
- Mounted evidence: a new `RecoveryPanel.test.ts` (**19** cases, two of them added by the
  round-1 fix), three cases on `MatchEditor.test.ts`, and **five** on `MatchCreator.test.ts` —
  **two** of which are the evidence **step 1's live behaviour change never got**. Both counts
  in this line were wrong when the record was written and are the review's fourth finding;
  they were re-derived by counting the `it(` the diff adds, not by trusting either number
  §5 gave.
- Model evidence: two cases on `recovery.test.ts`, added by the round-1 fix, pinning that a
  form is offered in flight **before** anything is authorized and not at all for a form that
  will not be sent.

---

## 2. The decisions

### 2.1 D1 — the key functions are in `recovery.ts`, not in `src/lib/i18n/codes.ts`

The brief asked for "typed accessors in `src/lib/i18n/codes.ts`". **That would have broken
`cargo test`**, and the reason is written on `codes.ts` itself: it is the bridge from a
**Rust** code to a sentence, its keys are `code.<enum>.<variant>`, and
`src-tauri/src/dictionary_contract.rs` reads the core's enum declarations, applies the same
formula and compares the result against the `code.` keys of both dictionaries **in both
directions**. A `code.recoveryRefusal.*` key naming no Rust variant is a Rust test failure.

So this step followed the convention every frontend-only code union in this repository
already follows — `creationRefusalKey` in `matchCreation.ts`, `moveRefusalKey` in
`matchMove.ts`, `sharedReapplyObstacleKey` in `reapply.ts` — and put the key functions in the
module that owns the codes, with the reactive `t*` wrapper in `index.ts`. `recovery.ts`'s own
header had predicted this: *"2c-4c-3 adds the accessors together with the panel that renders
them."*

**What that gives and what it does not, in one sentence.** Each key function returns
`TranslationKey`, which is derived from `en.json`, so a code with no dictionary entry is a
compile error **in `recovery.ts`** — and nothing anywhere checks that the sentence a key
holds is the right one, which is why §4.3 states that hole rather than implying it away.

### 2.2 D2 — one shared panel, not two copies

`RecoveryPanel.svelte` is used by both hosts. The form is large — a transfer table, a
destination list, two boxes, an acknowledgement, a reapply report and three outcome arms —
and duplicating it into two renderers is 2c-3c-3's named failure mode: **a rule written into
one renderer is carried by that renderer's mounted suite alone, and the second renderer can
omit it while walking the model faithfully.**

The two hosts differ in exactly two values and the panel takes both as props: an
`availability` they each compute with their own draft kind, and an `open` thunk that calls
`startMatchFieldRecovery` or `startCreationFieldRecovery`. **Nothing in the panel can tell
them apart, and nothing in it needs to.**

### 2.3 D3 — two capability booleans moved and one did not

`RECOVERY_CONFLICT_CAPABILITIES.offersReload` and `.offersReapply` are now `true`. Both were
built at step 2 with the control withheld — the 2c-4a-2 trade — so this step flipped a
boolean per control and drew it, **inventing no machinery**: `reloadRecoveryDiskVersion` and
`reapplyRecoveryToDiskVersion` are unchanged, and `recovery.test.ts` already drove both.

**`offersReapply` is not optional.** Without it, a recovery form that met a conflict of its
own would hold the base revision the transaction had just refused and every later send would
meet the same refusal — a dead end inside the escape from a dead end, which is the failure
mode the whole phase exists to remove.

**`offersCopyDraft` stays `false`, and it is a property of the view rather than an opinion.**
*Copy my text* copies the **retained draft list**, which `RecoveryView` does not produce and
this step did not add: the two values a recovery form holds are in its own two boxes, on
screen and selectable, for as long as the form is open. Offering the control would have
needed a list to copy before it needed a button.

### 2.4 D4 — which refusals get a sentence is a model rule, `recoveryIsAnswerable`

Two of the five `RecoveryUnavailable` reasons mean *recovery has not been reached* rather
than *recovery cannot help here*: `notFromManualResolution` is the ordinary state of a
conflict nobody has pressed *Keep my draft* on — and of every surface with no conflict at all
— and `noConflict` is the same fact from the other side. Drawing either as a permanent
sentence would explain an unoffered control on a screen that is not about it.

That rule is `recoveryIsAnswerable` in `recovery.ts` and not a condition in markup, for D2's
reason: two components ask it today and four more ask it at 3b.

**It says nothing about an open form**, deliberately. A form that has been opened is drawn
unconditionally; see D6.

### 2.5 D5 — the transfer table says four things, and the fourth is `transferStatusOf`'s

`FieldTransfer` has two arms and the table has four rows' worth of phrasing, because both
refinements are things a person must be able to tell apart:

- **`carried` against `carriedEmptyValue`** — step 1's `None`-is-not-`Some("")` contract on a
  screen. A key carried with an empty value is written as `label:` with nothing after it; an
  omitted key is not written at all, and a table saying only *carried over* hides the
  difference;
- **`omitted` against `needsAValue`** — which of the two a person can act on. The four
  optional fields have no control at all; the trigger and the body have a box each, and a
  transfer that could carry neither leaves that box **blank on purpose** rather than
  inventing content.

`transferStatusOf(field)` is in the model, so the `text === ''` comparison is not written in
markup. **It describes the transfer and never the control**, and that is stated on the
function: a trigger that *was* carried and has since been cleared by hand still says
`carried` there, because what a box holds now is `recoveryRefusal`'s question and its answer
is drawn beside the create control.

### 2.6 D6 — the panel is drawn beside the outcome panel, not inside its conflict arm

The consult puts recovery in the manual-resolution area, and the obvious place is inside the
conflict arm of the host's outcome panel. **It is not there, and the reason is a defect that
arrangement has**: pressing *Keep editing* on the host conflict replaces the host session,
the arm unmounts, and a half-filled recovery form — with the two values a person typed —
would go with it silently.

So the panel is a sibling block, exactly as the reapply report is, and an **open form outlives
the conflict it was opened from**. When there is no form open, what the panel draws is
`recoveryIsAnswerable`'s decision, so dismissing the conflict leaves the panel silent rather
than explaining itself.

### 2.7 D7 — the match editor takes two adoption props, and it is one method twice

`AdoptTheDiskVersion<T>` is contravariant in the drafted value. The editor's own conflicts
retain `MatchBuffers`; a recovery form's retain the two authored strings. One prop could not
be typed for both, so `MatchEditor.svelte` takes `adoptDiskVersion` **and**
`adoptRecoveryDiskVersion`, and `DetailPane.svelte` passes its one generic
`adoptDiskVersion` to both. The creator needs only one, because both of its conflicts retain
`CreationBuffers`.

### 2.8 D8 — `browser.recovery.revisionExpected` joined the seven-key family

`dictionaries.test.ts` asserts that the keys ending `.revisionExpected` are **exactly** a
named list, so that a new conflict panel's line cannot join the dictionary without joining the
check — and that none of them uses a verb of writing, because the same panel says a few lines
above that nothing was written. The recovery panel's own create is a save like any other, so
it draws the same three revision lines and the list grew from six to seven. That is the check
working as its own comment predicted, not a check being widened to let something through.

### 2.9 D9 — the words

- The product is named **once**, in `browser.recovery.open`: *Create a new snippet from
  supported fields*. `RecoveryPanel.test.ts` asserts the drawn label contains neither
  *duplicate*, nor *copy*, nor *keep my draft* — against the label the control really draws
  rather than against the key it came from.
- **The repeated-trigger sentence is 2c-4c-1's own**, `code.findingCode.newMatchRepeatsLiteralTrigger`,
  unchanged: it claims that the new snippet repeats trigger text another snippet already
  writes and that this application cannot determine how espanso will handle overlapping
  definitions. No string added by this step makes any espanso-semantic claim (D2u).
- **Every sentence about `sourceConflictState` names the act, never the outcome.**
  `windowMoved` says this window has been asked to read the file again, or that a permission
  to move it to the version on disk has been used, **and that this panel cannot tell what came
  of that**. No string says the window moved, the list re-ordered or the projection changed.
- **And none of the three speaks for the host's draft**, which the first draft of `retained`
  did and which is the review's second finding. All three predicates are facts about *this
  panel*; the change recovery was opened from lives on a surface this module cannot observe,
  and an open form outlives the conflict it was opened from — so a person can dismiss the host
  conflict with *Keep editing*, type into that draft, and nothing here changes. §6.2 is the
  rewording of all three, in both languages.
- **`browser.saveOutcome.reloadClosesSurface` was not touched**, in either language. It is on
  the standing debt ledger deliberately, and changing it would oblige a re-taken 2c-4a-3c
  window reading.

### 2.10 D10 — a review pass over this step's own prose changed ten strings

The first draft of the dictionary said things the code does not give, which is this project's
worst defect class. All ten were fixed before the gates were re-run, and each is worth
recording because each is the same mistake in a different sentence:

| Key | What it claimed | What it says now |
|---|---|---|
| `closed`, `cannotCreate.formClosed` | *"the version on disk was loaded"* | the window was **asked** to move and did not refuse — a satisfied adoption answers `alreadyThere` and installs nothing |
| `reloadEndsRecovery` | *"the change you were making is left exactly as it is"* | nothing about the source conflict at all; that sentence is `tSourceConflictState`'s, three lines above |
| `what` | the same claim about the source conflict | *creating it discards nothing you have here* |
| `position` | *"the place the change you were making referred to is what went missing"* | the policy without the causal claim — a `manualResolution` can also be a field collision or a wrong destination |
| `committed` | *"the files this panel was offering have been written to"* | the file it went into, singular |
| `sourceConflict.retained` | *"nothing has been written"* | *nothing has been written **from here*** |
| `sourceConflict.spent` | *"nothing else was written"* | *this panel has written nothing else* |
| `discardWarning` | *"the change you were making stays exactly as it is"* | nothing is written and nothing else here is discarded |
| `cannotCreate.alreadyCreated` | invited starting again in a form that has none | nothing more can be created from here |

---

## 3. What this step deliberately did **not** do

- **No new Tauri command, no second writer, no force flag.** Recovery composes
  `BrowserState.createMatch` through the callback step 2 built, and every recovery write ends
  in the same `run_one_save` the other six writers do. No Rust file was touched.
- **No `After`, no numeric position, no reused `MatchId`, no synthesized `matches`
  sequence.** `RECOVERY_POSITION` is the only position value and the panel draws no placement
  control at all — its absence is a sentence.
- **No copy control on the recovery panel** (D3), and no retained-draft list added to
  `RecoveryView` to enable one.
- **No change to `recoveryView()`, `recoveryAvailability()` or any transition.** The model was
  drawn, not redesigned.
- **The other four surfaces are untouched.** `MatchDeleter.svelte`, `MatchMover.svelte`,
  `MatchDuplicator.svelte` and `RawEditor.svelte` are byte-identical.
- **No window reading.** That is 2c-4c-5, and 2c-4c-4 has to rebuild the instrument first.

---

## 4. What this step does not cover, stated as holes

### 4.1 No screen has been read

A green suite is not a screen. Nothing here has been drawn in a running window, in either
language: not the panel's height inside an already long conflict panel, not the two reveal
effects, not either box's behaviour under a pasted carriage return, not the destination
list's scrolling. **jsdom lays nothing out and does not implement `scrollIntoView`**, so
neither `revealOutcome` nor `revealReapplyReport` can fail here for any geometric reason.
2c-4c-5 is the reading, and R38's standing bound still applies to it.

### 4.2 The three operation surfaces and the raw editor have no proof yet

`recovery.test.ts` proves at the **value** level that an `operationChoice` and a
`wholeDocumentText` draft get no create offer. That none of those four components *draws*
one — and that raw offers no save-as-new — is a claim about four renderers, and it is 3b's
mounted evidence. This step did not weaken it and did not provide it.

### 4.3 No executable test pins what any sentence means

The i18n suites check key parity and placeholder agreement. The one narrowed exception is
`dictionaries.test.ts`'s check that no `.revisionExpected` line uses a verb of writing, which
the new key now joins. Everything else — that the repeated-trigger sentence claims risk only,
that `windowMoved` names an act and not an outcome, that the product is never called a
duplicate anywhere but in the one label a test reads — is carried by review. Reverting any of
D10's ten fixes while keeping its key leaves every suite green.

### 4.4 An open form can outlive the conflict it describes, and it says `retained` anyway

D6's arrangement is deliberate, and it has a consequence worth writing down: if a person
opens recovery and then presses *Keep editing* on the host conflict, the form stays and
`sourceConflictState` goes on answering `retained`. `recovery.ts` cannot observe the host at
all, by design, so this is a limit of the value and not a defect the panel could fix.

**What was a defect is what the sentence made of that limit**, and this section as first
written described the hole while the string went on claiming past it: `retained` said the
source change *"is still here, exactly as it was"* — an outcome claim about a draft the
person may have edited in the meantime. That is the review's second finding, and §6.2 is the
fix. The state still answers `retained` in that situation; what it now says is that nothing
here has touched that change and that **what it holds now is shown where it is being made,
not here**. The limit is unchanged; the sentence no longer speaks past it.

### 4.5 The transfer table describes the transfer and not the boxes

`transferStatusOf` answers `carried` for a field the person has since cleared by hand. The
create control's own refusal sentence is what says the box is empty, and the two are drawn a
few centimetres apart. Whether that reads as a contradiction is a question for the window
reading.

### 4.6 What no type forces

That either host passes `BrowserState.createMatch` rather than importing `createMatch` from
`../ipc/commands` — the hole every writing path has had since 2b-2a; that
`adoptRecoveryDiskVersion` is the window's own door; that a caller installs the session a
transition answers; and that a new member of `RecoveryChoice` gets a control that does
anything, though a new member is at least a compile error in the panel's `switch`. The
mounted suites drive the real handlers over recording doubles, which is evidence about this
panel and not a guarantee about a future caller.

**One of those was narrowed by the round-1 fix, and the residue is worth stating exactly.**
For the send path a caller can no longer be unaware that a form goes in flight before its
answer arrives: `InstallTheWaitingForm` has no default, and `sendRecoveryCreate` invokes it
with the waiting form before it authorizes anything. What is still not forced — and what no
type in TypeScript could force — is that the **body** of that callback installs the form
anywhere a screen reads: `() => {}` type-checks, and the two model test files pass exactly
that for the cases that are about something else. Only a surface's own mounted suite shows
that its controls really do go inert for the flight, which is why §5's list now has a line
for that and `RecoveryPanel.test.ts` holds a create open to produce it.

### 4.7 The module count moved by three, and the third is a stylesheet

**178, from 175.** The arithmetic, measured rather than assumed: `recovery.ts` became
reachable from the entry for the first time (+1, through `src/lib/i18n/index.ts`, which now
imports its key functions), `RecoveryPanel.svelte` is a new component (+1), and its `<style>`
block is a module of its own (+1) — established by deleting the block, rebuilding to **177**,
and restoring it. `svelte/internal/server` is **not** in the bundle, which is the regression
the guard exists to catch. **The ladder in `CLAUDE.md` §6 says "one new source module each
time"; that held because every previous rung was a `.ts` file.** A `.svelte` file costs two
when it has a stylesheet, and this is the first rung that is one.

---

## 5. Evidence

All four gates, run from the project root, each as its own command, **after the round-1 fixes
of §6** — which is the last fix, so these are the numbers that stand:

| Gate | Before (step 2) | After | Note |
|---|---|---|---|
| `cargo test --workspace` | 1112 passed, 0 failed | **1112 passed, 0 failed** | no Rust file was touched |
| `npm test` | 1711 passed, 50 files | **1744 passed, 51 files** | see the arithmetic below |
| `npm run check` | 420 files, 0 errors, 0 warnings | **422 files, 0 errors, 0 warnings** | `--fail-on-warnings` |
| `npm run build` | 175 modules | **178 modules** | §4.7 |

`cargo tree -p espansoconfig-core | rg tauri` finds nothing.

**The test count, accounted for.** 1711 → 1744 is +33. Four of those are not cases anybody
wrote: three scanners run a per-`.svelte`-file `it.each` (`hardcoded-strings`,
`built-translation-keys`, `ipc-detail`) and `ipc-detail` also runs per `.ts` file, so one new
component plus one new test file is +4. The remaining **29** are this step's: **19** in
`RecoveryPanel.test.ts`, 3 in `MatchEditor.test.ts`, 5 in `MatchCreator.test.ts`, and **2** in
`recovery.test.ts`. The last four of those twenty-nine — two mounted, two model — were added
by the round-1 fix; the figure before it was 1740, with 17 in `RecoveryPanel.test.ts` and
none in `recovery.test.ts`. **No new source module was added by the fix**, so the build gate
did not move.

**What the mounted cases hold**, which is the list step 3 owes:

- the editor and the creator each **invoke recovery creation and reach a commit**, with the
  fixed `End` placement, the chosen destination's own base revision, and the six-field or
  two-field payload on the wire;
- the transfer disclosure states **what was carried, what was omitted and what needs a
  value**, with `carriedEmptyValue` told apart from `omitted` by an assertion that is not
  satisfiable by the shorter phrase alone;
- the destination control **offers only eligible destinations**, drops the conflict's own file
  when the **disk** parse says it has no snippet list, and **never synthesizes one** — with the
  no-destination case drawn as a sentence rather than as a silently short list;
- the repeated-trigger finding is **presented as acknowledgeable risk**, the acknowledgement
  carries the complete finding — `revision` operand included — and a keystroke afterwards
  **withdraws the offer**, on both the recovery panel and the **ordinary** creator path;
- **the original conflict survives every non-committed ending**: a refusal, an acknowledgement
  refused again, a dismissal, an uncertain send (which says `windowMoved`, never `spent`), an
  abandonment, and a reload — which spends **its own** conflict's authorization and is asserted
  not to be the source's wire value;
- **a form goes inert on the press and not on the answer** (added by the round-1 fix): with a
  create held in flight, and with no `await` between the click and the assertions, the panel
  says it is saving, refuses with `saveInFlight`, disables the create and the way out, makes
  both boxes read-only and every destination inert — and *Stop creating this snippet* cannot
  abandon the form. A second create pressed from *Save anyway* sends nothing, and the commit
  that then arrives stands with no second answer that could replace it.

  **The refusal choice row is what a save in flight leaves live — the whole row, not one
  control** (round 2's Low, and the sentence it replaces claimed the opposite). Nothing in
  `RecoveryPanel.svelte`'s `{#each form.refusalChoices}` carries a `disabled`, so *Keep
  editing* stays clickable beside *Save anyway*; what makes that safe is the model refusing
  the second send, not the markup withholding the press. *Save anyway* is merely the one live
  choice that can **attempt** another send, which is why it is the one the mounted case
  presses. §6.1 records the same fact and this sentence used to contradict it.

**The evidence step 1's live behaviour change never got** is
`MatchCreator.test.ts` § "an ordinary creation that repeats a literal trigger": two cases over
the ordinary `create_match` path, with no recovery anywhere in them.

---

## 6. The review rounds

**Two.** The first is the round this project's own rule requires of a fix — *a fix is a
change, and the round that reviews it is not optional* — run over the step's own output, and
it found the ten prose defects D10 records. **The second was commissioned from Codex, and it
returned NOT READY**: two Highs, one Medium and one Low, transcribed in
`docs/reviews/phase-2c-4c-3a-code.md`, whose *Round 1 fixes* section records what changed and
where. The first draft of this section said no Codex round had been commissioned; that
sentence is now false and is replaced rather than left standing.

The four fixes, and where each lives.

### 6.1 The waiting form is installed on the press — finding 1, High, and it is in the model

`runCreate` awaited `sendRecoveryCreate` without ever installing a `saving` session, so
`view.saving` was `false` for the whole flight: every control stayed live, a second *Create*
could go out against the same base revision, *Stop creating this snippet* could abandon a form
with a write in flight, and a late answer could replace a committed state with a conflict —
**an error reported after a committed write**, which this project forbids absolutely. The
asymmetry was real and one-directional: `MatchEditor.svelte` and `MatchCreator.svelte` both
call `beginSave`/`beginCreate` themselves and assign `started.session` before their own await,
while `sendRecoveryCreate` called `beginRecoveryCreate` **inside** itself and handed the
saving session back only on resolution.

**The fix is a required argument and not a renderer's discipline.**
`sendRecoveryCreate(session, create, install)` takes an `InstallTheWaitingForm`, invokes it
with `started.session` **before** the request is authorized, and never invokes it for a form
`beginRecoveryCreate` refuses. The one-call composition is kept, which is what D2's shared
panel wanted and what §3's *no second writer* depends on; what changed is that the moment a
form goes in flight is now part of the composition's type rather than a thing a caller has to
know to reconstruct.

**What that forces, and what it does not, in the same sentence.** It forces that every caller
supplies one — a surface cannot compose a recovery create while unaware the moment exists —
and that this module calls it before anything is sent. It cannot force that the body of the
callback installs the form anywhere a screen reads: a function that does nothing type-checks.
That residue is why the evidence is in two places rather than one. `recovery.test.ts` pins the
**ordering and the gating** — `install` runs before `create`, the value it is handed has
`phase: 'saving'` and a view whose `saving` is `true`, `canCreate` is `false`, `refusal` is
`saveInFlight` and `editable` is `false`, and a form that will not be sent installs nothing —
and the closed-form probe now passes an installer that *throws*, so a terminal form reaching
that moment fails the suite. `RecoveryPanel.test.ts` holds a create in flight and presses the
controls, because only a mounted panel can show that this renderer assigns what it is handed.

Two things this fix deliberately did **not** do. It did not disable the refusal panel's own
choices while a save is in flight: that row carries no `disabled` on this surface **or on the
other five**, changing it here would make this panel differ from them for no reason the review
raised, and the model refuses the second send anyway — which is what the second mounted case
asserts, by pressing *Save anyway* while a create is outstanding. And it did not split
`sendRecoveryCreate` into a begin/complete pair for the component to drive: that would move
the base revision, the `NewMatch` and the fold-back of three answers into a renderer, which is
the duplication D2 exists to avoid, and it would close no hole the callback leaves open.

### 6.2 Three sentences that spoke for a draft they cannot see — finding 2, High

`browser.recovery.sourceConflict.retained` said the source change *"is still here, exactly as
it was"*. The `retained` predicate is `!committed && !windowWasReconciled`: it establishes
that **recovery** has written nothing and ordered no reconciliation, and it can observe
nothing about the host draft — which by D6 outlives the conflict it was opened from, so a
person can dismiss that conflict with *Keep editing*, edit the trigger or the body, and the
panel would go on saying it was exactly as it was. That is the *act, never outcome* rule and
the *a refusal's sentence must be true of its predicate, not of its name* rule failing in one
string.

All three siblings were swept, in **both** languages, not only the one the finding named:

| Key | What it claimed | What it says now |
|---|---|---|
| `sourceConflict.retained` | the source change *"is still here, exactly as it was"*, and that **this window** had not been asked to move or re-read | nothing has been written from here; **this panel** has asked the window for nothing; nothing here touches that change, and what it holds now is shown where it is being made |
| `sourceConflict.windowMoved` | the two acts and *"what you typed here is untouched"* | the same two acts, and that this panel can tell neither what came of them **nor what the change you were making holds now** |
| `sourceConflict.spent` | *"The change you were making was not carried out"* | **this panel** did not carry it out and has written nothing else, and what it holds now is shown where it is being made |

The second row is the sweep rather than the finding: the *act* half of `windowMoved` was
already scoped correctly, and what it lacked was the same limit about the host that the other
two now state. The unscoped *"this window has not been asked…"* in `retained` is the sharper
half of the first row — `windowWasReconciled` records only what **this panel** asked for, and
a host surface reloading its own disk version while a recovery form is open falsifies the
unscoped reading.

The type-level docs were corrected with the strings, because a record claiming a guarantee the
code does not give is this project's worst defect class: `SourceConflictState`'s `'retained'`
arm no longer says *"nothing has moved: it and its draft are still the person's to resolve"*,
and `sourceConflictStateKey`'s contract now carries the host limit beside the act rule it
already carried.

### 6.3 Fixed `End` is policy, not a consequence — finding 3, Medium

`RecoveryPanel.svelte`'s header said recovery has no trustworthy anchor *"by definition — the
anchor is the thing that went missing"*. `manualResolution` is also reached by a field
collision or by a destination this application may not write into, and the source snippet can
be perfectly identifiable in both. §2.10's `position` row had already corrected the *string*
for exactly this reason; the contract three files away still carried the claim. It now states
the policy — this application will not guess an anchor for a new snippet out of a change it
could not carry out — without the causal claim.

### 6.4 The evidence inventory counted wrong — finding 4, Low

§1 claimed six new `MatchCreator.test.ts` cases where the diff adds five, and three ordinary
repeated-trigger cases where it adds two, while §5 gave five and two. Both are corrected
against the diff — `git diff -U0 … | rg '^\+\s+it\('` — rather than by picking whichever
number appeared twice.

### 6.5 What that leaves owed

A once-per-phase adversarial review of 2c-4c-3 as a whole is better spent after 3b, when all
six surfaces are drawn and the mounted matrix the consult's step 3 asks for is complete;
splitting it in two would review half a matrix twice. **This record makes no claim that the
round-1 fixes have themselves been reviewed** — *a fix is a change*, and the round that
reviews these four is 3b's or a later one's. Nothing here has been seen in a running window
either; §4.1 stands unchanged, and 2c-4c-5 is the reading.
