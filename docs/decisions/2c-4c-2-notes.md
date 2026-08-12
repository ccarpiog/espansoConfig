# Phase 2c-4c-2 — decision record

**Recovery as browser values, and it draws nothing.** One new module,
`src/lib/browser/recovery.ts`, holds the shared recovery outcome/choice model for all six write
surfaces, the six field transfer decisions, destination selection, the fixed end placement, the rule
that says what became of the conflict recovery was opened from, and the composition of the existing
`BrowserState.createMatch`. **No `.svelte` file was touched**, no `ConflictChoice` member was added,
no dictionary key was added, no command was added, and no Rust file was touched.

The authority for this step is `docs/reviews/phase-2c-4c-design.md` — the design consult — under its
**Q1** (the product is *create a new snippet from supported fields*, its trigger an editable literal),
**Q2** (fixed `End`, the destination preferred only when the disk projection says it is eligible,
never a synthesized `matches` list), **Q3** and **Q4** (the surface matrix), **Q5** (everything else
is browser composition) and the **step cut**'s item 2. Where this record and that document disagree,
the consult is right and this is a bug.

---

## 1. What this step built

| File | What changed |
|---|---|
| `src/lib/browser/recovery.ts` | **New.** The whole of recovery as a value: `RecoveryDraftKind` and `RecoveryRoute` (the six-surface matrix), `RecoveryChoice` and `recoveryAvailability` (the one producer of a choice list and of the destination list), `RecoveryDestination` / `recoveryDestinationsOf` / `preferredRecoveryDestination`, `FieldTransfer` / `TransferRefusal` / `transferOfField` / `transferOfMatchDraft` / `transferOfCreationDraft` / `newMatchOfRecovery` / `fieldsNotCarried`, `RECOVERY_POSITION`, `RecoverySession` with `startMatchFieldRecovery` and `startCreationFieldRecovery`, the ordinary form transitions (`chooseRecoveryDestination`, `editRecoveryField`, `focusRecoveryField`, `undoRecoveryEdit`, `redoRecoveryEdit`, `keepRecovering`, `acknowledgeRecoveryFindings`), the create protocol (`recoveryRefusal`, `canCreateRecovery`, `beginRecoveryCreate`, `applyRecoveryCreate`, `recoveryCreateCouldNotBeSent`, `sendRecoveryCreate`), the two unoffered ways out of a conflict of its own (`reapplyRecoveryToDiskVersion` with `RecoveryReapplyObstacle`, and `askToReloadRecoveryDiskVersion` → `confirmRecoveryDiskReload` → `reloadRecoveryDiskVersion`), `SourceConflictState` / `sourceConflictState`, `RECOVERY_CONFLICT_CAPABILITIES` and `recoveryView` |
| `src/lib/browser/recovery.test.ts` | **New.** 68 cases in eight groups: the surface matrix over **every** `manualResolution` obstacle the five match surfaces produce, the six transfer decisions, destination selection, the placement, the create protocol, the two ways out of its own conflict, the refusals, and what recovery never does — including a dependency scan of the module's own source |
| `src/lib/browser/workspace.test.ts` | Eight cases in a new `recovering a draft no reapply could resolve` suite, driving the composition against a **real** `BrowserState` and a scripted command surface — the write, the selection race, the two reconciling answers with their control case, and the two offers that are withheld |

Nothing else. `src/lib/i18n/{en,es}.json` is unchanged, `src/lib/i18n/codes.ts` is unchanged, no
component is changed, and the twelve registered commands are the twelve that were there.

---

## 2. The decisions

### 2.1 D1 — four recovery draft kinds, refining the conflict machinery's two

`RecoveryDraftKind` is `matchFields | creationFields | operationChoice | wholeDocumentText`, and
`recoveryRouteOf` maps them onto the consult's three routes: `createsSnippet` for the first two,
`reloadThenFreshOperation` for the third, `keepEditingWholeDocument` for the fourth.

**Why a fourth value rather than a derivation from `ConflictCapabilities`.** *Authored text* is not
one thing when the question is *can a new snippet be made out of this?* — three surfaces declare
`draftKind: 'authoredText'` and one of them drafts a whole document. The two candidate derivations
were `reapplySupport === 'unavailable'` and `reloadOutcome === 'reseedsDraft'`, and each is true of
the raw editor **today** for a reason that is not the one being asked about; encoding either would be
this module inferring *what a draft is* from *what a reload does*. `conflictDraftKindOf` is the
mapping back down, written out rather than inferred, so a fifth recovery kind must decide which of
the two it is; and `the matrix agrees with what each of the six surfaces declares` drives it against
all six `CONFLICT_CAPABILITIES` records rather than against a second opinion held here.

### 2.2 D2 — the entry condition is `manualResolution` and nothing else

`recoveryAvailability` refuses every other arm of `ReapplyOutcome`, `null` included, with
`notFromManualResolution`. That arm is the only one whose own doc comment promises **nothing was
adopted** — the projection was not replaced, the selection was not repaired, the conflict's one
authorization was not spent — and recovery is built on that promise rather than on reasoning about a
window that may already have moved.

**The consequence, stated rather than left to be found:** recovery is reachable only *after* a
reapply attempt that resolved nothing. A person who has a conflict on screen and has not asked for a
reapply gets no recovery offer. Widening the entry to another arm is a decision for a later step, not
an oversight here.

### 2.3 D3 — the six transfer decisions read the baseline and the buffer, through `fieldIntent`

The final state of a field is what a save of the retained draft would leave in the file, and
`fieldIntent` is the only function in this application that reads both sides. `transferOfField` calls
it rather than re-spelling it:

- `Remove` → the key is not carried (`removedByTheDraft`);
- `Set(text)` → carried, **including `Set("")`**;
- `Unchanged` and the file held the key → carried with the file's value;
- `Unchanged` and the file held no key → not carried (`notInTheFile`).

**`None` is not `Some("")`, and both halves are driven.** An absent field left blank is a key the new
snippet is not born holding; a present field cleared to empty is `label: ''` written into the file.
That is step 1's contract on this side, and `newMatchOfRecovery` expresses it by *spreading a
property in only when there is a value for it* — `exactOptionalPropertyTypes` makes `label: undefined`
a different thing from an absent `label`, and `'left_word' in newMatch` is what the test asserts.

**An ineligible field is refused before its intent is asked**, and not because the intent would be
wrong — `fieldIntent` answers `Unchanged` for one — but because the *reason* is what a screen shows,
and *the file did not hold this key* is false of a `notDecodable` field that holds one. All five
refusals end in `fieldNotEditable`, and none of them is a value a creation could be born holding: a
trigger that is not one literal has no literal to carry, an unmodelled key is not one piece of text,
an undecodable scalar's `text` is the **source slice** rather than the logical value, a field
carrying a carriage return is one no control in this window could read back, and a zero-width span is
nothing at all.

**The carriage return is refused twice**, at the transfer and again on the derived candidate in
`beginRecoveryCreate`. The second is not redundant: `MatchBuffers` and `CreationBuffers` carry no
brand, so a caller that is not a control can put one in a draft.

### 2.4 D4 — the two mandatory values are editable and are never invented

`trigger` and `replace` are seeded from the transfer and are **blank** when it carried nothing; the
four optional fields are carried or omitted and have no control. That asymmetry is the consult's Q1
read literally: the trigger stays an explicit editable literal, is never auto-suffixed, normalized or
guessed, and a value this application could not transfer is asked for rather than made up.
`recoveryRefusal` answers `triggerEmpty` / `replaceEmpty` until the person supplies one.

### 2.5 D5 — only a destination that may be written is representable

`RecoveryDestination` carries no eligibility, so an ineligible file cannot be in the list at all.
That is deliberately **not** the creator's rule — `matchCreation.ts` lists every file and attaches a
typed refusal, because a form silently shorter than the sidebar reads as an incomplete list — and the
difference is the consult's Q2: recovery is an escape from a dead end, and what it offers is *every
other eligible destination*. A screen that wants to explain a missing file has `destinationsOf` and
`destinationRefusalKey` for exactly that.

**The conflict's own document is judged by the disk projection.** The window still holds the parse
the save was refused against; asking *that* whether the file still has a snippet list would be
answering from bytes this application already knows are gone. So `recoveryDestinationsOf` substitutes
`ConflictModel.disk` for that one file — for its eligibility **and** for the revision the draft is
based on — and everything else is judged by the projection the window holds. Both directions are
driven: a disk projection that lost its `matches:` list removes the file from the offer, and a
window-side projection that did not parse does **not** remove it when the disk one does.

**A missing `matches:` sequence is not permission to create one.** When no file is eligible,
`recoveryAvailability` answers `noEligibleDestination`, no session exists, and nothing is written —
the draft and the conflict stay exactly where they are.

**Consent does not cross a destination.** `chooseRecoveryDestination` re-points the draft's base
revision through `retargetedDraft`, which withdraws the consent in the same call, and withdraws the
submission and the outcome beside it. That is `matchCreation.ts`'s first-review-round finding reused
rather than rediscovered: consent is content-addressed to the buffers alone, so findings accepted for
a create in file A could otherwise be spent on a create in file B without a keystroke in between.

### 2.6 D6 — the placement is a constant

`RECOVERY_POSITION = { End: {} }`, and no function in the module takes a position or answers another
one. Recovery has no trustworthy anchor **by definition** — the anchor is what went missing — so
`After` is refused outright, a numeric position would be an ordinal where the wire wants an identity,
and reusing the old `MatchId` would name a snippet of a parse that is gone. `Front` is honest and is
still not offered: a recovery escape is not an ordering editor, and a later reorder is a separate
same-sequence move, which D2r and R25 already require.

### 2.7 D7 — what became of the source conflict has three answers, not two

> **Corrected at the review round, and this is the correction.** The first version of this decision
> was `sourceConflictRetained(session) = !session.committed`, and this section said the conflict
> "survives until a create commits". **That is a claim about the *window*, and the callback this
> module composes can falsify it without committing anything** — the review's High. It is fixed in
> the code, not in the wording: `sourceConflictRetained` is gone and `sourceConflictState` answers
> `retained | windowMoved | spent`.

`BrowserState.createMatch` reconciles the window on two answers that carry no known commit: a failure
whose `mayHaveWritten` is `true`, and a `saved` arm whose revision is not the one the window was
projecting — **which is the ordinary case for a recovery create**, because it is based on the
conflict's disk revision while the window still holds the older one. Both **order a re-read** of the
file, so afterwards the conflict's own observation may not be what is on screen and its one-shot
authorization is keyed to a projection generation that may have moved. What came of that re-read is
what neither the answer nor this module reports. `adoptDiskVersion` then refuses it — unless the window happens to hold exactly the revision
the conflict carried, which it answers `alreadyThere`, which is why `windowMoved` claims **uncertainty
and never a refusal**.

The state is derived from what the answer already carries, so no protocol changed and
`MatchSaveAnswer` still satisfies `CreateARecoveredSnippet` structurally: `adoption.kind !== 'notOwed'`
on the answered arm, `mayHaveWritten` on the failed one. **What no type forces** is that the callback
really is that wrapper, so the derivation encodes what the production wrapper does with those answers
and `workspace.test.ts` drives the real one to check it, both ways: an uncertain send leaves the
authorization **refused**, and a rejection that wrote nothing leaves it **installable**.

> **Corrected again at the confirmation pass, and this is that correction.** The paragraph above was
> right about the callback and **wrong about everything else this module can do**: the two
> transitions §2.9 added to close the round's other findings each spend an adoption of their own, and
> a satisfied one may install a projection and repair the selection just as the wrapper's may. They
> preserved the old flag, so a reload that had just spent one still answered `retained` — the
> same defect class as the finding they were written beside, one round later, in the paths that fix
> introduced.

**Four producers, then**, all of them on `RecoverySession.windowWasReconciled`: the two create
answers above, a satisfied spend in `reloadRecoveryDiskVersion`, and a successful adoption in
`reapplyRecoveryToDiskVersion`. **What each establishes is that the window may have moved, never that
it did** — round 4's finding 1, which ruled the recording sound and the sentences around it false:
the two create answers name branches on which the wrapper *orders* a re-read, and `satisfied`
collapses `installed` with `alreadyThere`, which installs nothing. The flag is **monotonic** — nothing this module can observe would
justify putting the window back — and both adoption paths record it for `alreadyThere` as well as for
`installed`, because `spendTheConfirmedReload` and `adoptForReapply` collapse the two and
`windowMoved` claims uncertainty, so recording it over-claims nothing while staying `retained` would
claim the window is exactly where the source conflict left it. A **refused** adoption records
nothing: decide-then-adopt means nothing moved.

**A committed create answers the conflict** — `spent` — including when the adoption failed, because
the bytes are on disk; the outcome stays `saved` with `windowOutOfStep` beside it. A `saved` arm that
committed nothing is `windowMoved` when the wrapper reconciled and `retained` otherwise: retaining is
the conservative direction, since releasing would drop a conflict for a write that did not happen.

**What opening a form still forces structurally:** `startMatchFieldRecovery` and
`startCreationFieldRecovery` take no adoption and no confirmation, so nothing can be spent by opening
one; `RecoveryOrigin.conflict` carries the wire value whole and is passed to nothing.

### 2.8 D8 — the create is composed through a callback, and there is no second writer

`CreateARecoveredSnippet` is `BrowserState.createMatch`'s exact signature, and `sendRecoveryCreate`
is the one function that calls it. Every recovery write therefore goes `create_match` → `InsertItem`
→ `run_one_save` → `save_document`, with no new command, no `force` flag and no direct file
replacement.

**`RecoveryCreateAnswer` is declared structurally rather than imported from
`workspace.svelte.ts`**, so the model depends on the *shape* of that answer and not on the state
module — a test drives it with a function it wrote itself. That the real method satisfies it is
checked where it can be: `const create: CreateARecoveredSnippet = state.createMatch` in
`workspace.test.ts`, which both type-checks and is what the case then sends through.

**The base revision is the submission's own** and is never read at the moment of the call: reading
one there rebases a form the window has moved on from and turns the conflict that should stop it into
a commit. The workspace case asserts the command receives the conflict's **disk** revision while the
window is still projecting the older one.

### 2.9 D9 — recovery's own conflict has two ways out, and both are built and unoffered

> **Changed at the review round.** The first version declared `reapplySupport: 'supported'` with no
> reapply transition behind it and reinterpreted the variant's contract to excuse it (finding 2), and
> it recorded the reload warning `describeConflict` appends as an incoherence to live with
> (finding 3). Both are now closed the way this phase closes things: **the transitions exist, and the
> controls do not.**

A recovery create can itself be refused or conflict, so the form carries an ordinary
`SaveOutcomeModel<CreationBuffers>` built by `describeEditSave` from
`RECOVERY_CONFLICT_CAPABILITIES`, and it has both transitions that record now declares:

- **`reapplyRecoveryToDiskVersion`** — the creator's transition in this form's shape: the chosen
  destination is rebuilt from `ConflictModel.disk` (and **dropped** when that projection says the
  file may no longer be written into), the draft's base revision moves with it through
  `retargetedDraft`, which withdraws the consent in the same call, the typed values are kept, and
  `recoveryRefusal` is asked again in full. Decide-then-adopt, so a refusal leaves the window where
  it was. There is no `alreadySatisfied` arm and there must not be one — that would be the
  repeated-trigger precheck the consult refuses;
- **`askToReloadRecoveryDiskVersion` → `confirmRecoveryDiskReload` → `reloadRecoveryDiskVersion`** —
  the ordinary two-step confirmation, spent through `spendTheConfirmedReload`. It adopts the disk
  projection and **closes the form**, because there is no disk-side recovered draft to seed one from,
  which is what `reloadOutcome: 'closesSurface'` says and what the appended warning describes.

**Why this had to exist at this step rather than the one that draws it.** Without the rebase,
dismissing a conflict left the form holding the base revision the transaction had just refused, so
the next send met the same refusal — a loop dressed as a way out. `keepRecovering`'s own doc now says
what it does and does not do.

**Both adoptions are spent on this form's own conflict**, which the window registered when the
recovery create came back, and never on the conflict recovery was opened from: they reach it through
`recoveryConflictOf`, and `RecoveryOrigin.conflict` is passed to nothing. A test asserts that by
reference identity, both ways.

> **Corrected at the confirmation pass.** This section previously went on to say that the source
> conflict is therefore *unaffected*, which **conflates two different statements**: *not spending
> `origin.conflict`* is true, and *not invalidating the window it was registered against* is false.
> A satisfied adoption is one the window **may** have installed a projection for, which would advance
> the very projection generation that conflict's one-shot authorization is keyed to. Both transitions
> now record `windowWasReconciled`, so `sourceConflictState` answers `windowMoved` after either — see
> §2.7, which is where the rule lives, and §4.6 for why the sentence says *may*.

All three offer booleans stay `false`, so `conflictChoicesFor` names `keepEditing` alone and nothing
is drawn — the 2c-4a-2 trade, now with the machinery genuinely behind it.

### 2.10 D10 — the module is above the two surface models, so the production bundle does not hold it yet

`recovery.ts` imports `fieldIntent`, `EDITABLE_FIELDS` and `fieldLabelName` from `./matchEditor` and
`destinationEligibility` from `./matchCreation`; neither imports it. That is the
`matchDuplication.ts` → `matchMove.ts` precedent, and it keeps **one** module holding the six
transfer decisions and the destination rule instead of splitting a rule across two surface models —
the defect class this repository keeps re-finding.

**The consequence is that `npm run build` still transforms 175 modules**, because rollup transforms
what the entry reaches and no component reaches recovery yet. That is the same fact as *this step
draws nothing*: 2c-4c-3 imports it from the components that draw it — as `MatchEditor.svelte` and
`MatchCreator.svelte` already import `./reapply` and `./saveOutcome` directly — and **that** is what
takes the count to 176. The guard was checked in the direction it exists for: the bundle is byte
identical to the pre-step one (same content hash, same 400.85 kB) and contains no
`svelte/internal/server`.

### 2.11 D11 — the words, and the one claim about risk

> **Narrowed at the review round (finding 5).** The first version of this section made an absolute
> claim — that nothing in the module, the tests or the record used any of the three reserved names —
> **while using all three in the same sentence**, and the module header did too, in a paragraph that
> introduced recovery by saying what it is not. Negating a reserved label is still describing the
> product with it, and an absolute sweep claim that its own text breaks is this project's worst
> defect class in miniature.

The product has **one** name — **_create a new snippet from supported fields_** — and it is described
affirmatively, which is all it ever needed:

- **carried**: `trigger`, `replace`, `label`, `word`, `left_word`, `right_word`, each as logical text
  spelled into the file by Rust's own encoder;
- **not carried**: comments, unknown keys, key order, scalar spelling and quoting, tags, anchors, the
  sixteen other scalar fields and the four collections;
- **written**: a new snippet at the end of a chosen destination, leaving whatever the file now holds
  as it is.

The module header now says exactly that, and `RecoveryChoice`'s documentation no longer lists another
surface's control labels. What this record claims, and no more, is that **its own text and the
module's describe the product only that way**.

The only sentence this step writes about the repeated-trigger finding is in
`acknowledgeRecoveryFindings`'s doc comment, and it claims **risk and nothing else**: the new snippet
repeats trigger text another snippet in the destination list already writes, and this application
cannot determine how espanso handles overlapping definitions. Never *invalid*, never *collision*,
never which snippet wins, and never that a non-repeating trigger is safe.

---

## 3. What this step deliberately did **not** do

- **No control, no choice member, no key.** `ConflictChoice` is unchanged, `RecoveryChoice` is a
  union of this module's own with one member, and both dictionaries are byte-identical. There is no
  key function for `RecoveryUnavailable`, `TransferRefusal`, `RecoveryRefusal` or
  `RecoveryReapplyObstacle` — that is 2c-4c-3's, together with the panel that renders them, exactly
  as 2c-4b-2 left its obstacle unions.
- **No Rust, no command, no second writer, no `force` flag.**
- **No adoption of the *source* conflict, ever.** The two transitions that take an
  `AdoptTheDiskVersion` resolve the conflict a recovery create of its own ran into, reached through
  `recoveryConflictOf`; `RecoveryOrigin.conflict` is passed to nothing.
- **No repeated-trigger precheck.** Whether the destination already writes that trigger text is
  decided by the candidate's own findings, inside `save_document`, for the exact candidate — a check
  in the window would be bypassable and would interrupt on a guess.
- **No copy control for an `operationChoice` or a `MovePlacement`/`MatchId` draft**, and no producer
  of a recovery form for one: the two that exist take a match editor's `MatchBuffers` and a creator's
  `CreationBuffers`, so the type checker refuses the other three surfaces' drafts.

---

## 4. What this step does not cover, stated as holes

### 4.1 Nothing here has been drawn, and no mounted test or window reading covers it

Owed by the step's brief and correct — no component changed — but the consequence is worth naming:
every sentence this phase will show is still unwritten, and the behaviour change step 1 already put
on the **creator** surface (an exactly repeated literal trigger is now refused once and committed on
*Save anyway*) still has no mounted test and no window reading behind it. 2c-4c-3 and 2c-4c-5 are
where both are owed.

### 4.2 The transfer is a reconstruction, and no part of it preserves bytes

Six projected values cross into a new snippet. Comments, unknown keys, key order, scalar spelling and
quoting, tags, anchors and every other piece of source syntax do not, and neither do the sixteen
other scalar fields or the four collections — they are not in `NewMatch`, and *leave this alone* is a
statement about an existing snippet that means nothing for one that does not exist. How each carried
value is **spelled** in the file is `choose_scalar`'s decision in Rust, not this module's.

### 4.3 The destinations are frozen when the form opens

`RecoverySession.destinations` and the revisions in them are taken once. A window that reprojects a
file afterwards leaves the form holding a base revision the window has moved past — and what stops
that from writing anything surprising is the transaction's own revision check, which answers a
**conflict**. That is write-safe and it is not a claim that the form notices: nothing here observes a
reprojection, and the person learns of it from the conflict rather than from the destination list.
This is R37's shape on a new surface: a model rule agrees with itself only over consistent inputs,
and nothing forces a caller to supply them.

### 4.4 Eligibility is an affordance, never authorization

`destinationEligibility` reads the projection this window holds. If the projection and the file
disagree, `create_one_match` refuses — a missing match list is a **command** refusal — and that
refusal is what the person sees. The list is what this window can offer honestly, not permission.

### 4.5 What no type here forces

That a caller installs the session a transition answers; that a caller keeps drawing the source
conflict while `sourceConflictState` answers `retained`, or stops when it answers `windowMoved`; that
the function passed to `sendRecoveryCreate` is `BrowserState.createMatch` rather than the raw
`createMatch` from `../ipc/commands` — the hole every writing path has had since 2b-2a; and that a
component derives the view, the destination options and the submission from one read of the current
projections. What **is** closed is that this module calls no command itself — checked as a dependency
scan over its own source rather than as a mock nothing calls — and that a form `beginRecoveryCreate`
refuses never reaches the callback at all.

### 4.6 `windowMoved` is derived from behaviour, not from a field anything sends

Nothing on `MatchSaveAnswer` says *I re-read the file*, and `DiskAdoptionOutcome` does not say *I
installed a projection*: what the model reads is `adoption.kind`, `mayHaveWritten`, and the
satisfied/refused answers of the two adoption doors. Each is that decision's own input in
`BrowserState.createMatch` or `BrowserState.adoptDiskVersion`, so **the derivation is true of those
two** and is checked against the real wrapper in `workspace.test.ts` — a caller that supplies a
different callback of the same shape can make it wrong without any type objecting. Widening either
answer to carry the fact explicitly would have changed a protocol this step is not allowed to touch.

**The adoption half is coarser than the create half, deliberately.** `alreadyThere` installs nothing,
and this module cannot tell it from `installed` because the shared spend helpers collapse them —
so both are recorded. `windowMoved` claims uncertainty, so that over-claims nothing; the alternative
is a `retained` that claims the window is exactly where the source conflict left it, which is what
the confirmation pass found.

It is also **one-directional**: nothing moves the state back to `retained`, because nothing this
module can observe would justify it. A window that reprojects again after a reconciliation is no more
intact than it was.

### 4.7 A closed form is terminal; a committed one is not, and that is a decision

Every export that takes a form and answers one answers **the same form** when it is closed, and the
suite drives them from a table checked against the module's own export list — which forces that every
runtime export name is classified and that none is classified twice, while forcing neither that a new
export is classified *correctly*, since one dropped into the non-probed group would satisfy the
partition and be probed by nothing, nor that the probe inputs are adversarial enough to expose a
missing guard, since a probe only ever sees the forms the suite hands it.

**Nine doors carry an explicit guard**, and each was earned rather than added for symmetry:
`focusRecoveryField` (the confirmation pass's second finding), `keepRecovering` beside it,
`recoveryCreateCouldNotBeSent` and `applyRecoveryCreate` at round 4 — the first the door the
hand-written enumeration had missed, the second answering identity only by the coincidence that a
closed form carries no submission — and at round 5 the five that read outcome, reload or
acknowledgement state before anything else: `acknowledgeRecoveryFindings`,
`askToReloadRecoveryDiskVersion`, `confirmRecoveryDiskReload`, `reloadRecoveryDiskVersion` and
`reapplyRecoveryToDiskVersion`. The last two are the ones that mattered most: without a guard, a
closed form that still carried its conflict and a confirmed step **reached an adoption**.

**`RecoverySession` does not encode *closed implies cleared*, and that is what makes those guards
load-bearing rather than defensive.** The only producer of `closed` today clears the outcome, the
submission and the reload step in the same transition, so no production path reaches those five with
anything to read — but the interface is structural, a caller can build the pairing, and a second
producer of `closed` would not have to clear anything. The suite therefore probes four
**hostile** forms the type permits and nothing produces: a conflict at each of the three reload
steps, and a refusal with its submission.

A **committed** form is deliberately not terminal in the same way: its panel is still on screen with
the saved outcome, so a focus or blur on it is a real event, and it refuses only what would write or
edit. That is `matchCreation`'s shape and it is a decision here, not an oversight.

### 4.8 No executable test pins what any of this will say

Nothing here has a sentence yet, and when 2c-4c-3 writes them the standing limit applies: the i18n
suites check key parity and placeholder agreement, never meaning. Reverting a prose fix while keeping
its key leaves every suite green. That is why D11 is written out here in full.

### 4.9 The test count moved by more than the cases written, and the arithmetic is stated

`npm test` went from **1633 / 49 files** to **1711 / 50 files**. Sixty-eight of those are
`recovery.test.ts` and eight are `workspace.test.ts`; the remaining **two** are
`scripts/lint/ipc-detail.test.ts`, whose `it.each` runs one case per `.ts`/`.svelte` file under
`src/`, so adding two files adds two cases. A count that moves by more than the cases a step wrote is
worth explaining rather than accepting.

### 4.10 The reapply and the reload exist and have never been drawn

Both recovery-conflict transitions are driven only by this module's suite. No component calls them,
no dictionary key names them, and `RecoveryReapplyObstacle` has no key function — so nothing here is
evidence about a screen, and 2c-4c-3 owes the accessors, the controls and the mounted matrix,
2c-4c-5 the reading.

---

## 5. Evidence

Model and workspace tests, as the step's brief requires. No mounted test and no window reading (§4.1).

| Claim | Test |
|---|---|
| The four routes, and the refinement of the conflict machinery's two kinds | `recovery.test.ts::routes the four draft kinds…` |
| The matrix agrees with all six surfaces' own declarations | `recovery.test.ts::agrees with what each of the six surfaces declares…` |
| **Every** `manualResolution` obstacle of the editor (4) and the creator (7) reaches an offer | `recovery.test.ts::offers the new snippet for every obstacle…` |
| **Every** obstacle of the deleter (3), the mover (7) and the duplicator (3) reaches no offer | `recovery.test.ts::offers nothing for the three operation surfaces…` |
| The raw editor's two obstacles reach no offer, and it cannot produce the arm at all | `recovery.test.ts::offers nothing for the raw editor…` |
| Every other `ReapplyOutcome` arm, `null` included, is refused | `recovery.test.ts::refuses every arm of a reapply that is not the manual one` |
| A field the draft leaves alone carries the file's value | `recovery.test.ts::carries what the file holds…` |
| A field the draft would write carries the draft's value | `recovery.test.ts::carries what the draft would write…` |
| **`None` is not `Some("")`**, from both sides | `recovery.test.ts::omits a key the file never held…`, `::carries an empty value for a present key the draft cleared` |
| A removal is not carried | `recovery.test.ts::omits a key the draft asks to have taken out` |
| All five field refusals carry nothing, each with its own reason | `recovery.test.ts::carries nothing for any of the five fields…` |
| A drafted carriage return is refused at the transfer | `recovery.test.ts::refuses a drafted value carrying a carriage return…` |
| The creator's transfer is its two authored fields and nothing else | `recovery.test.ts::makes the creator’s two authored fields…` |
| An absent optional key is **absent** from the `NewMatch`, an empty one is present | `recovery.test.ts::writes only the keys the transfer carried…` |
| The two mandatory values come from the controls | `recovery.test.ts::takes the two mandatory values from the controls…` |
| Only eligible files are offered, in window order | `recovery.test.ts::offers every file that may be written…`, `::never offers a read-only file…` |
| The conflict's own file is judged by the **disk** projection, both ways | `recovery.test.ts::judges the conflict’s own file by the disk projection…` |
| The conflict's file is preferred only when it may still be written | `recovery.test.ts::prefers the conflict’s own file only when…` |
| **No eligible destination** → nothing written, no session | `recovery.test.ts::writes nothing and keeps the draft when no file may be written into` |
| A destination change re-points the base and withdraws consent | `recovery.test.ts::starts on the conflict’s file…`, `::withdraws consent and the panel when the destination moves` |
| The placement is `End`, everywhere, with no anchor in what is sent | `recovery.test.ts::is the end, and there is no other value and no chooser` |
| One create, with the drafted values and the disk revision | `recovery.test.ts::composes the one create the caller supplies…` |
| **Refusal → acknowledgement → retry**, with the exact finding sent back | `recovery.test.ts::refuses the findings once and commits on the second attempt` |
| *Save anyway* is withdrawn once the findings are stale | `recovery.test.ts::withdraws the offer to save anyway…` |
| **Another conflict** keeps both conflicts and writes nothing | `recovery.test.ts::keeps its own conflict, and the source conflict…` |
| **An uncertain send** says so, keeps the draft, and stops calling the source conflict intact | `recovery.test.ts::says a send may have written…`, `::raises the two failure arms from outside the composition too` |
| A failure that wrote nothing reconciles nothing | `recovery.test.ts::leaves the source conflict alone for a failure that wrote nothing` |
| A non-committed arm the wrapper reconciled answers `windowMoved`, both adoption endings | `recovery.test.ts::does not call the source conflict intact when a non-committed arm reconciled the window` |
| Nothing puts the window back: dismissing, typing, retargeting and a later refusal all keep it | `recovery.test.ts::keeps saying the window moved once it has…` |
| **A failed adoption after a known commit** is a save, never an error | `recovery.test.ts::reports a committed create whose adoption failed…` |
| A commit spends the form and nothing dismisses past it | `recovery.test.ts::spends the form on a commit…` |
| A saved arm that committed **and reconciled** nothing retains the conflict | `recovery.test.ts::retains the source conflict for a saved arm that committed nothing and moved nothing` |
| Each refusal code, and that a refused form sends nothing | `recovery.test.ts::names each reason…`, `::refuses while a create is in flight`, `::refuses a destination that is not one of its own` |
| A field the transfer could not carry opens blank and is required | `recovery.test.ts::opens a field the transfer could not carry blank…` |
| The carriage return is refused at the control **and** at the wire | `recovery.test.ts::refuses a carriage return at the control and again at the wire` |
| The view: six rows in order, two editable, the labels, the transfers | `recovery.test.ts::lays the six fields out in the editor’s order…` |
| The view carries the three-valued source-conflict answer | `recovery.test.ts::says the source conflict is still the person’s until a create commits` |
| A recovery conflict draws one control today, and the disk text beside it | `recovery.test.ts::offers only the way out for a conflict of its own…` |
| Opening adopts nothing and carries the wire conflict unchanged | `recovery.test.ts::adopts nothing, spends nothing and closes nothing when it opens` |
| **The rebase breaks the stale base**, goes out against the new revision, and records that the window may have moved | `recovery.test.ts::rebases the form onto the newly parsed file…` |
| The rebase withdraws consent | `recovery.test.ts::withdraws consent when it rebases…` |
| The rebase refuses wrong evidence, an ineligible file, and a refused adoption | `recovery.test.ts::refuses to rebase onto evidence a creation’s conflict never answers`, `::refuses to rebase onto a file that may no longer be written into`, `::leaves the form exactly as it was when the window refuses the adoption` |
| The two-step reload closes the form, spends **this form's** conflict, and records that the window may have moved | `recovery.test.ts::takes the disk version in two steps…` |
| Both adoption paths record it for `alreadyThere` as well as `installed` | `recovery.test.ts::records the window as moved for a spend that found it already there`, `::records the window as moved for a rebase whose adoption found it already there` |
| A refused reload closes nothing, records nothing, and says the control is gone | `recovery.test.ts::does not close over a window that refused to move…` |
| A refused rebase adopts nothing and records nothing | `recovery.test.ts::leaves the form exactly as it was when the window refuses the adoption` |
| **A closed form answers itself from every export that takes one**, probed from a table over the produced form **and four hostile ones the type permits** | `recovery.test.ts::answers itself for every transition once it is closed, hostile fixture included` |
| No probe reaches the window from a closed form, hostile fixtures included | the same case's per-fixture adoption recorder |
| **The partition is checked against the module's own exports**, so a new one must be classified | `recovery.test.ts::classifies every value this module exports…` |
| Neither reload step asks the window anything it should not | `recovery.test.ts::asks the window nothing without a conflict and without a confirmation` |
| An operation choice and a whole-document draft get **no create offer** | `recovery.test.ts::gives an operation choice and a whole-document draft no create offer` |
| The send it is handed is not called while a refusal stands — and **is** called when one goes | `recovery.test.ts::never calls the send it was handed…` |
| The module has **no route to the IPC command layer**, checked against a source that has one | `recovery.test.ts::reaches the IPC command layer from nowhere in its own source` |
| The composition really is `BrowserState.createMatch`, at the end, with the disk revision | `workspace.test.ts::writes through this state’s own create, at the end, with the disk revision` |
| **The selection race**: a snippet clicked mid-flight keeps the selection | `workspace.test.ts::does not drag the selection away from a snippet clicked while it was in flight` |
| **An uncertain send against the real wrapper**: the projection is replaced, the selection dropped, the authorization **refused**, and the state is `windowMoved` | `workspace.test.ts::stops calling the source conflict intact once an uncertain send reconciled the window` |
| **The control that makes it falsifiable**: a send that wrote nothing leaves the projection, the selection and an **installable** authorization | `workspace.test.ts::leaves the window and the authorization alone when the send wrote nothing` |
| **`saved, committed: false` against the real wrapper** reconciles and answers `windowMoved` | `workspace.test.ts::stops calling it intact when a saved arm that committed nothing reconciled the window` |
| An operation choice and the raw editor get no create offer, from a real state | `workspace.test.ts::gives an operation choice and the raw editor no create offer` |
| Nothing is sent through this state while a refusal stands, and one send lands when it goes | `workspace.test.ts::sends nothing through this state for a form that may not be submitted` |
| A missing `matches:` list offers the other file and creates nothing | `workspace.test.ts::offers the other file when the conflict’s own has lost its snippet list` |

**Fifteen rules were checked by breaking them**, so the suite is not a lint that cannot fail. Making
`recoveryDestinationsOf` read the window's projection for the conflict's own file fails **8** cases;
deleting the `notInTheFile` arm of `transferOfField` fails **4**; making `windowWasReconciled` never
move on a create answer fails **5**, three of them the real-`BrowserState` ones; dropping
`retargetedDraft` from the rebase fails **2**; dropping the reload's recording fails **2**; dropping
the rebase's recording fails **2**; and removing either closed-form guard —
`focusRecoveryField`'s or `keepRecovering`'s — fails the terminal-form case; adding a new export to
the module fails the partition case; and **each of the seven remaining closed-form guards was removed
on its own** — `recoveryCreateCouldNotBeSent`, `applyRecoveryCreate`, `acknowledgeRecoveryFindings`,
`askToReloadRecoveryDiskVersion`, `confirmRecoveryDiskReload`, `reloadRecoveryDiskVersion`,
`reapplyRecoveryToDiskVersion` — and each failed the terminal-form case alone, which is what the four
hostile fixtures were added for: with only the produced fixture, three of the seven passed without
their guard. Every one was reverted and the suites re-run. The command-layer scan is falsifiable by construction: the case feeds it a
source that imports the command layer and one that `invoke`s it, and expects both to be caught.

**Gates, on this tree:**

| Command | Result |
|---|---|
| `npm test` | **1711 passed, 50 files** (1633 / 49 before; §4.9 is the arithmetic) |
| `npm run check` | **420 files, 0 errors, 0 warnings** (418 before; two new files) |
| `npm run build` | **175 modules** — unchanged, and §2.10 is why: the bundle is byte-identical to the pre-step one and holds no `svelte/internal/server` |
| `cargo test --workspace` | **1112 passed, 0 failed** — unchanged; no Rust file was touched |

---

## 6. The review round

`docs/reviews/phase-2c-4c-2-code.md` returned **NOT READY** on one High, three Mediums and one Low.
All five are closed, and each is recorded where it belongs above rather than only here.

| # | Finding | Where it is now |
|---|---|---|
| 1 | **High — an uncertain create can replace the projection while recovery still claims the source conflict is intact** | §2.7 (the three-valued answer and its derivation), §4.6 (what the derivation rests on), §5's four new workspace rows |
| 2 | Medium — `reapplySupport: 'supported'` said this form had a transition it did not have | §2.9: it has one now — `reapplyRecoveryToDiskVersion` — built, driven and unoffered |
| 3 | Medium — a recovery conflict advertised a reload it could not perform, and its way out retried a stale base | §2.9: the reload transition exists and the rebase is what breaks the loop; `keepRecovering`'s doc says what dismissing does and does not do |
| 4 | Medium — both "no command" tests inspected mocks the exercised code could not call | §5: the availability cases now claim only *no create offer*; a mock the path really calls carries the negative, and a dependency scan of the module's own source carries the rest |
| 5 | Low — the artifacts described the product with the three reserved names, including an absolute claim its own text broke | §2.11, and the module header, which is affirmative now |

**What the round changed about the code rather than the words:** a session field and a three-valued
answer where a boolean was; two new transitions with their obstacle union; a `formClosed` refusal; and
`keepRecovering` resetting the reload step. **What it changed about the words** is §2.7's, §2.9's and
§2.11's correction blocks, which are kept in place rather than rewritten away.

**Two of the five were things this record had already named as tensions**, and the review ruled both
defects. That is worth keeping: naming a tension is not the same as being allowed to ship it, and the
cost of closing both was one transition each.

**The sweep after the fixes found one narrower instance**, which is this project's standing pattern:
the module header still claimed **no function here takes an `AdoptTheDiskVersion`** — true when it was
written for finding 1's neighbourhood, and falsified by finding 2's and 3's own fix two hours later.
It now states which conflict those two transitions adopt, and a test pins that by reference identity.

### 6.1 The confirmation pass, and the two findings the fix round produced

`## Confirmation pass — round 2` in the same review file confirmed **F2, F3, F4 and F5 closed** and
ruled the widening justified rather than an over-reach — and returned **NOT READY** on two findings
that did not exist before the fix round, which is the eighth consecutive round where a fix produced
the next finding.

| # | Finding | Where it is now |
|---|---|---|
| 1 | **High — F1 not closed: the two paths added for F2 and F3 spend an adoption and preserved a false `retained`.** The create-answer derivation was ruled sound; the sweep failed immediately outside the callback | Both transitions record `windowWasReconciled` on a satisfied spend (§2.7's second correction, §2.9's, §4.6); the reload test that **pinned the false answer** now pins the true one, and four cases cover the two paths' success, their `alreadyThere` collapse and their refusals |
| 2 | Low — a closed form still accepted a focus transition | `focusRecoveryField` and `keepRecovering` gained the `closed` guard, and §4.7 records the wider property that replaced the narrow fix — which round 4 then found still had a hole in it |

**What this round changed about the code:** two lines of recording, two guards, and nothing else.
`reapplyRecoveryToDiskVersion`'s rebuild, `reloadRecoveryDiskVersion`'s spend order, the obstacle
union, the capability record and every F2/F3 behaviour the pass confirmed are **untouched** — the
recording is added on the way out of each transition rather than inside the rebase, so a refusal
still returns before it.

**What the post-fix sweep looked for**, written against the new shape rather than the finding's
wording: every producer of a session that could follow an adoption or a re-read (four found, all
four now recording); every doc comment that enumerated the producers as two (three found: the
session field, the `windowMoved` arm and `sourceConflictState` itself); every claim that a
transition *leaves the window alone* (the module header, both transition docs and the record's
"unaffected" sentence); and every terminal-state door, which is how `keepRecovering` was added to a
finding that named only `focusRecoveryField`. What it decided **not** to widen: a **committed** form
stays non-terminal for focus, because its panel is still on screen (§4.7).
### 6.2 Round 4, and the two sentences the fix round's own fix made false

A scoped pass over the fix round returned **NOT READY** on two narrow findings, both confirming the
behaviour and rejecting what it was *said* to do. The review file's own section for this round is
being restored by another job; this record does not write it.

| # | Finding | Where it is now |
|---|---|---|
| 1 | Medium — recording on `alreadyThere` was ruled **sound**, and the contract beside it claimed a **definite** install or movement, which is exactly what that recording means the code does not know | Nine sentences across the module and four in this record now name the **action** — an adoption spent, a re-read ordered — instead of its outcome. §4.6 states the asymmetry; the field's own doc says the flag means *this module cannot tell whether the projection changed* |
| 2 | Low — the terminal-form enumeration missed `recoveryCreateCouldNotBeSent`, a door that really did mutate a closed form | The guard is added there and — for the same coincidence reason — on `applyRecoveryCreate`; the hand-written list is replaced by a table checked against the module's **own export list**, so a new export fails the suite until it is classified (§4.7, and what that still cannot force) |

**What this round changed about the code:** two guards and no behaviour anywhere else. Nothing in the
F1/F2/F3 transitions moved; the recording, its placement and the capability record are as round 3
left them.


**Round 4's own sweep, against the shape these two fixes leave:** every sentence in the module and
the record that named an *outcome* of an adoption or a re-read rather than the act — nine in the
module, four here, all now saying *may*; every unverifiable count, since the door the review called
the sixteenth is one of fifteen entries in the probe table depending on what is being counted, so
the counts are gone from both and the partition is the authority; and every other export that takes
a form, which is how `applyRecoveryCreate` joined the fix rather than being left answering identity
by coincidence. It found no further instance in the F2/F3 transitions, whose behaviour this round did
not touch.

> **Round 5 corrects one sentence of that sweep.** It reports the outcome-language pass as complete;
> it was not — six carriers in the module and one here still asserted the definite outcome, and
> §6.3 is where they are closed.

### 6.3 Round 5, and the sweep that was not wide enough

A second scoped pass closed round 4's finding 2 and **re-opened its finding 1**: the field contract
and all four producers were ruled correct, and six sentences in the module and one here still asserted
the definite outcome that contract disclaims. It also found the terminal-form property resting on one
friendly fixture.

| # | Finding | Where it is now |
|---|---|---|
| 1 | Medium — the outcome-language sweep was incomplete: the header, the `windowMoved` arm, `applyRecoveryCreate` twice, `recoveryCreateCouldNotBeSent`, `sendRecoveryCreate` and this record's §2.7 still said the projection **was** installed | All seven now name the observable act — an adoption spent, a re-read ordered — and say the projection **may** have changed. `installed` survives only where it is contrasted with `alreadyThere`, and every such place hedges in the same sentence |
| 2 | Low, with a code half — five transitions read outcome, reload or acknowledgement state before checking `closed`, and a type-valid closed form retaining those fields could be changed or **could reach an adoption** | All five guard first (§4.7 lists the nine). The invariant case now probes four hostile forms as well as the produced one, and each of the seven guards was removed on its own to prove the fixtures catch it — three of the seven passed against the produced fixture alone |

**Did the five guards change observable behaviour?** No production path reaches any of them with
anything to read, because the one producer of `closed` clears the outcome, the submission and the
reload step in the same transition — so they close a path reachable **by construction**, not by the
running application. That is the same class as `applyRecoveryCreate`'s guard at round 4, and the
reason it is not left to coincidence is that `RecoverySession` is structural and a second producer of
`closed` need clear nothing.

**Round 5's own sweep** looked for: every remaining sentence naming an outcome rather than an act
(seven, all changed; the surviving `installed` mentions were checked one by one against the contrast
rule); every export that reads state a guard should precede (five, all guarded); every place the
force and the limit of the partition were stated as two sentences (two — the test comment and §4.7 —
now one sentence each); and whether the hostile fixtures cover every field a guard could read (they
cover the conflict at all three reload steps and a refusal with its submission, which is every state
the five guarded doors consult). It found no further instance in the F2/F3 mechanics round 4 had
confirmed intact.
