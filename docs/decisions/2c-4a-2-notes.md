# Phase 2c-4a-2 — decision record

**The frontend conflict protocol: a conflict now installs nothing, every surface can adopt the
disk version behind a confirmation, and one authority decides what each may *offer*.** The six
writing wrappers no longer adopt the disk projection in their conflict arm;
`BrowserState.adoptDiskVersion` is the sole frontend transition that does, and it authorizes
and installs in one call so no adoption value exists to be retained or replayed. All six
surfaces have the `idle → confirming → confirmed` machine and the close-or-reseed integration;
the five match surfaces do not **offer** it yet, so no control is drawn. The second disk-text
read is gone with the two defects it carried. **No new panel, no new control, no new i18n
key — and one key removed**, because the state it described became unreachable.

The authority for this step is `docs/reviews/phase-2c-4a-design.md` — the design consult for
this sub-phase. This step discharges its **Q2** (the pre-emptive install is a 2c-4a defect),
its **Q3** transitions, its **Q9 item 1** (two authorities for conflict choices) and the
frontend half of its **Q6**. Where this record and that document disagree, the consult is
right and this is a bug.

`docs/decisions/2c-4a-1-notes.md` §4 listed four holes; this step closes its 1 and 3.
**§7 is the review, and it took three rounds**: one High, two Mediums and one Low; then two
findings the *fix* round introduced; then one the round after that did. All accepted and
closed, each later section saying where an earlier one was wrong.

---

## 1. What this step built

| File | What changed |
|---|---|
| `src/lib/browser/saveOutcome.ts` | `ConflictModel.choices` **removed**, with the module-level `CONFLICT_CHOICES` it was filled from; `ConflictDraftKind`, `ConflictReloadStep`, `ConflictCapabilities` and `conflictChoicesFor()` added; `ConflictModel.source` carries the wire value whole; `DiskAdoption` (a fourth brand), `authorizeDiskAdoption()` and `DiskAdoptionOutcome` added, the first two internal to the spend boundary |
| `src/lib/browser/editorSave.ts` | the shared reload machine: `ReloadStep`, `NOT_RELOADING`, `AdoptTheDiskVersion<T>`, `reloadAsked`, `reloadConfirmed`, `spendTheConfirmedReload`, `offeredReloadStep` |
| `src/lib/browser/workspace.svelte.ts` | the six conflict arms install nothing and only **register** the conflict (`rememberTheConflict`, a `WeakMap` of wire value → document and projection generation); `conflictText`, `forgetConflictText`, `forgetTextOf`, `captureTheDiskText` and `rawTextOf` **removed**; `BrowserState.adoptDiskVersion<T>(conflict, confirmation): DiskAdoptionOutcome` added, with a per-state `WeakSet` of spent confirmations |
| `src/lib/browser/rawEditor.ts` | `loadDiskVersion(session, adopt)` — text and revision taken from the conflict, adoption performed inside; `ReloadStep` re-exported from `./editorSave`; one exported `CONFLICT_CAPABILITIES`; `RawEditorView` gains `diskText`, `diskRefusal`, `canReload` |
| `src/lib/browser/matchEditor.ts`, `matchCreation.ts`, `matchDeletion.ts`, `matchMove.ts`, `matchDuplication.ts` | `CONFLICT_CHOICES` replaced by an exported `CONFLICT_CAPABILITIES`; **`reload` and `closed` on the session**, `askToReloadDiskVersion`, `confirmDiskReload`, `reloadTheDiskVersion(session, adopt)`, `awaitingReloadConfirmation`/`closed` on the view, a `closed` gate, and `NOT_RELOADING` written back by every `apply*` and dismissal |
| `src/lib/browser/matchMove.ts`, `matchDuplication.ts` | `result.outcome === 'conflict'` removed from `invalidated` |
| `src/lib/components/RawEditor.svelte` | `diskText` prop **removed**, `adoptDiskVersion` prop added; the disk side drawn from `conflict.diskText`; the unavailable arm removed |
| `src/lib/components/{MatchCreator,MatchDeleter,MatchMover,MatchDuplicator,MatchEditor}.svelte` | `adoptDiskVersion` prop added and the `reloadDiskVersion`/`confirmReload` arms **wired** — `close()` only when the window reports the disk observation satisfied, which is any answer that is not `refused`; `conflictAction`'s doc corrected |
| `src/lib/components/DetailPane.svelte` | `diskTextForEditor` replaced by an `adoptDiskVersion` forwarder, passed to all six write surfaces |
| `src/lib/i18n/{en,es}.json` | `browser.rawEditor.diskVersionUnavailable` removed from both, at parity |

Tests added or changed:

| Where | What it pins |
|---|---|
| `workspace.test.ts` — `it.each` over all six writers (**new**) | a conflict installs no projection, moves no selection, raises no notice, re-projects nothing and — with the raw viewer **open** — re-reads no text, for all six writing wrappers |
| `workspace.test.ts` — the adoption boundary (**new**, 7 cases) | a confirmed adoption installs and repairs; a foreign confirmation, a **second spend**, a conflict **this window never produced**, an unprojected document, an adoption **retained across a later conflict** and — the confirmation pass's High — a confirmation spent **after another projection landed** are all refused; a fresh token after an install answers `alreadyThere` |
| `workspace.test.ts` — six existing conflict cases | rewritten to the inverted claim, each naming what it asserted before |
| `workspace.test.ts` — no second read (**new**, replacing the by-document capture case) | `document_text` is not called again on a conflict |
| `saveOutcome.test.ts` — the one-authority suite (**new**, 7 cases) | *Keep editing* first under every combination; the copy before the destructive choice; the two reload labels never together; **a copy refused for an `operationChoice` draft whatever the caller sets**; the six surfaces' declarations; and what is drawn today |
| `saveOutcome.test.ts` — the adoption suite (**new**, 2 cases) | the authorization carries one conflict's projection, revision and byte-exact text, and refuses another conflict's confirmation |
| `rawEditor.test.ts` — four cases (**new**) plus four rewritten | the adoption happens **exactly once**, in the call that reseeds; never for an unconfirmed reload, a refused carriage return or a foreign token; **nothing is reseeded when the window refuses**; **the draft is reseeded on `alreadyThere`**; and the disk side is on the view |
| the five match model suites — one new suite each (**new**, 6 cases apiece) | two deliberate steps before anything is spent; adopt-once-and-close; **close nothing when the window refuses**; **close all the same on `alreadyThere`**; the reload is not offered; and a dismissal forgets the confirmation |
| `RawEditor.test.ts` (mounted) — one case (**new**), one replaced | from the screen: the panel is drawn and the window has not moved; the warning is read and it still has not; the confirm click adopts once **and** fills the box |

**1326 → 1380 frontend tests over 46 files. No Rust was touched**: 1048, unchanged.
`npm run build` reports **171** modules, unchanged — this step adds fields, transitions and a
prop; it adds no source module.

---

## 2. The decisions

### 2.1 D1 — the conflict arms do nothing at all, and `adoptDiskVersion` is the only door

The consult's Q2 ruling, implemented as the *absence* of code: all six `else if (outcome ===
'conflict')` blocks are gone rather than reduced. What replaces them is one method whose
argument cannot be forged.

```ts
adoptDiskVersion<T>(
  conflict: ConflictModel<T>,
  confirmation: ReloadConfirmation
): DiskAdoptionOutcome
```

**Authorization and spending are one call, and that is the 2c-4a-2 review's second finding.**
The first version of this step exported a branded `DiskAdoption`: `authorizeDiskAdoption` bound
it to its conflict, a surface then held it, and `adoptDiskVersion` installed whatever it was
handed. Binding one end and not the other is not a guard — a retained value could be replayed,
handed to a second `BrowserState`, or spent while a later conflict was on screen, and the
record's "only door" language claimed more than the code gave. **There is no such value to
retain now.** A surface passes the conflict and the confirmation; the method authorizes,
checks and installs without anything crossing a module boundary. `DiskAdoption` still exists
and is still branded, but it is produced and consumed inside those few lines.

**Three answers, never a throw**, and the middle one is the confirmation pass's correction:
`installed`, `alreadyThere` and `refused` ({@link DiskAdoptionOutcome}). A boolean could not
carry `alreadyThere`, and reporting it as failure left a surface unable to finish and a confirm
control that could never succeed.

**`refused` for five reasons, in order:**

1. the confirmation was not issued for **this** conflict (`authorizeDiskAdoption`'s `WeakMap`);
2. it has already been spent through this state — a per-state `WeakSet`, because one click is
   one install and a replay would repair the selection again on one person's single answer;
3. **this state did not produce that conflict**, or the payload names a different file than the
   one it was produced for. `rememberTheConflict` writes the entry when the conflict arrives,
   keyed by the wire value itself, so a conflict from a second `BrowserState` — whose
   session-local `DocumentId` may collide with one of this state's — installs nothing;
4. this state holds no projection of that document;
5. **that projection has been replaced since the conflict arrived** (§7.5.1's High): the disk
   snapshot the conflict carries may be *older* than what the window now holds, revisions are
   content hashes and carry no order, and installing the older one would move the window
   backwards while reporting success.

**`alreadyThere` when the held projection is already at the conflict's disk revision** — checked
before 5, so a replacement that reached exactly the requested revision is satisfaction rather
than an over-refusal. Nothing is installed, the confirmation is spent, and the surface finishes:
the window holds the bytes that were asked for.

**The synchronous half runs before anything can await**, which is
`forgetTheReplacedDocument`'s rule: an asynchronous invalidation has a window in which a getter
can still read what it is replacing. The viewer's re-read is fired, not returned, because the
answer this method owes — *did the window move* — is settled before it starts.

**Why the generation and not `conflict.expected`.** The confirmation pass named the missing
check as "the held projection is still `conflict.expected`", and the defect it names is exactly
right: a `rereadDocument` landing while a person reads the warning leaves the window on a newer
parse, and the confirm then installs the conflict's older snapshot over it and reports success.
Comparing against `expected` would catch that — and would refuse legitimate reloads besides,
because `expected` is the *session's* frozen base and the window may have reprojected before
the save was even sent (the raw editor's base comes from `fileTextRevision`, which does not
move with `views`). The generation asks the narrower question that is actually load-bearing:
*has anything replaced this file's parse since this conflict was reported?* Both checks were
mutated and both fire: disabling the generation makes the new ordering case fail, disabling the
origin makes the never-produced case fail.

**What this does not force**, in the same sentence as what it does: nothing makes a surface
honour the answer, and this method cannot know which conflict a surface is *currently*
resolving — what closes that is each session resetting its reload step to `idle` whenever a new
outcome arrives or the panel is dismissed (§2.4). The **cross-`BrowserState`** hole the first
review left open is closed rather than acknowledged: a conflict this state never registered has
no origin entry and installs nothing, whatever its session-local document number happens to be.

**The Rust-side refresh stays.** `conflict_after_the_lock` still refreshes the workspace and
returns `disk`, `disk_revision` and `disk_text`; the consult required that for the
two-observation truth and for the command layer's own cache coherence. So between a conflict
and a person's choice, this window and the Rust cache **disagree on purpose**, and a stale
write is refused rather than committed — by the locked check for a raw save, and by `view_at`
for the five match commands, which is the distinction §2.5 corrects.

### 2.2 D2 — the raw reload is one operation, and the model performs the adoption

`loadDiskVersion` used to take `(session, revision, text)` and assume the workspace had
already crossed to the disk side before the answer arrived. That assumption cannot survive
D1, so the transition now takes the adoption callback and calls it itself:

```ts
export function loadDiskVersion(
  session: RawEditorSession,
  adopt: AdoptTheDiskVersion<RoundTripText>
): RawEditorSession
```

Four consequences, each deliberate:

- **the text and the revision are the conflict's own** — `conflict.diskText` and
  `conflict.diskRevision`, paired by the command layer — so the reseeded draft's base
  revision describes the bytes the draft holds. A caller can no longer supply either;
- **`adopt` is called last**, after the carriage-return check and the pure draft reload have
  both succeeded. A refused reload moves neither the window nor the draft;
- **its answer is honoured, and it has three values.** `adopt` returns a
  `DiskAdoptionOutcome`. `refused` — a spent confirmation, a conflict this window did not
  produce, a projection replaced since it arrived — returns the session untouched; reseeding on
  one would hand the person a clean draft over a window that never moved, with the conflict
  panel gone and nothing to say what happened. `alreadyThere` **finishes the transition**: the
  window already holds the bytes the draft would be seeded from;
- **the caller cannot do one half.** `RawEditor.svelte` never calls `adoptDiskVersion`
  itself; it passes it in.

**What no type forces**: that `adopt`'s body does anything — `() => 'installed'` type-checks,
which is `2c-1a-notes.md` §4.3's standing limit on every callback of this shape. What it does
force is that the reseeded draft cannot be obtained without this function having called it
**and having been told the window holds the disk version**.

The five match surfaces have the same shape with a different ending: `reloadTheDiskVersion`
closes the session instead of reseeding it, because there is no truthful disk-side
`MatchBuffers`, `CreationBuffers`, `MovePlacement` or `MatchId` to seed and inventing one
would be the cross-revision identification 2c-4b owns (§2.4).

### 2.3 D3 — one authority, and the Q4 rule enforced against the value rather than the caller

`ConflictModel.choices` is **removed**. It was a field `describeConflict` filled with a global
three and that every match model ignored while exporting its own `['keepEditing']` — the
consult's Q9 item 1, and the reason "a newly offered button can compile and do nothing".

The replacement is one function and six declarations:

```ts
export function conflictChoicesFor(
  capabilities: ConflictCapabilities,
  step: ConflictReloadStep
): readonly ConflictChoice[]
```

`ConflictCapabilities` has three fields and they are not the same kind of fact:

- **`draftKind`** is permanent. It is the consult's Q3/Q4 deciding rule as a value — *does the
  draft contain user-authored text a clipboard can preserve truthfully?* — and it can only
  change if the drafted type changes. `authoredText` for the raw editor, the match editor and
  the creator; `operationChoice` for the mover (`MovePlacement` is a positional choice) and
  the deleter and duplicator (`MatchId` is an opaque revision-scoped protocol carrier);
- **`offersCopyDraft`** and **`offersReload`** say what the panel that draws the surface
  **acts on today**. They are hand-set, and §2.4 is why.

**`conflictChoicesFor` honours `offersCopyDraft` only for an `authoredText` draft.** That is
the Q4 rule written against the *value* rather than trusted of the caller — the shape
2c-3c-3's Medium prescribed for `notDuplicableToShow` — so a mover that set the boolean still
gets no copy control. It is checked (`refuses a copy of a draft a clipboard cannot preserve,
whatever the caller says`).

`confirmReload` and `reloadDiskVersion` are never offered together: the function takes the
step and answers one of the two.

**What no type forces**, in the same sentence as what one does: it forces that no
`ConflictChoice[]` is built anywhere else in this repository, that a copy cannot be offered
for a draft that is not authored text, and that the two reload labels are exclusive. It
cannot force that the component drawing the list acts on what it names — nothing in
TypeScript can, and that is exactly the hazard the two booleans exist for.

### 2.4 D4 — every surface has the transition; only the raw editor offers it

Consult Q3 gives **all six** surfaces a confirmed reload. The first version of this step gave
it to one and left the other five with a boolean and a promise, and the 2c-4a-2 review's High
finding is that this cut the tension in the wrong place: **withholding the offering was right
and withholding the transition was not**, because an unoffered transition can be built and
driven without drawing anything, and because the split assigns "per-surface close/reseed
behavior" and "the props from `DetailPane`" to *this* step. Corrected.

**What every match surface now has.** The three-step machine of `./editorSave.ts` —
`askToReloadDiskVersion`, `confirmDiskReload`, `reloadTheDiskVersion(session, adopt)` — with
`ReloadStep` on the session, `awaitingReloadConfirmation` and `closed` on the view, and a
`closed` session refusing at each surface's own single gate. `DetailPane` passes
`adoptDiskVersion` to all six components, and each component's `conflictAction` arms call the
transitions: `reloadDiskVersion` asks, `confirmReload` confirms-and-spends and calls `close()`
**only when the window reports the disk observation satisfied** — which is `installed` *or*
`alreadyThere`, the two successful arms of `DiskAdoptionOutcome`, and never `refused`.
`spendTheConfirmedReload` is what collapses the two, deliberately: a window that already holds
the requested revision has satisfied the request, and treating that as a failure is the stuck
confirmation `alreadyThere` was added to prevent.

**What is still withheld, and this is the half of the original judgement that stands.** Every
match surface declares `offersReload: false`, so `conflictChoicesFor` names neither
`reloadDiskVersion` nor `confirmReload` and no control is drawn. Their `conflictAction` arms
are therefore implemented and unreachable — which is the opposite of a dead control, and the
distinction is the point: a dead control is one a person can press that does nothing.
2c-4a-3 flips one boolean per surface and the controls appear over machinery that already
exists and is already driven by tests.

**A confirmation never survives its conflict.** `NOT_RELOADING` is written back by every
`apply*` and every dismissal on all six surfaces, so reaching the confirmed step and then
taking a second answer — or pressing *Keep editing* — leaves nothing spendable. That is the
model-side half of the spend guard; `adoptDiskVersion`'s `WeakSet` is the window-side half,
and neither depends on the other.

*Copy draft* stays unoffered for the match editor and the creator for the same reason it stays
unbuilt: a labelled reference copy needs field labels, which are i18n keys drawn as a new
disclosure, and this step adds no key.

**What this leaves unforced.** Nothing relates a surface's `CONFLICT_CAPABILITIES` to the
component that draws it: the booleans are prose-and-test, not a type. And the test that names
the five surfaces' offerings is **not** a wiring guard — it imports no component and can only
say that five booleans are `false`; once 2c-4a-3 edits its expectation it relates to nothing
at all. It says so in its own comment now rather than claiming otherwise (review Low 3). The
wiring evidence is each surface's model suite driving `reloadTheDiskVersion`, and, from
2c-4a-3, each component's mounted suite pressing the control.

### 2.5 D5 — invalidation follows adoption, so a dismissed conflict hands the session back

`applyMove` and `applyDuplication` both had `|| result.outcome === 'conflict'` in their
`invalidated` expression, and both modules documented the asymmetry as deliberate. It was
deliberate, and it was a **consequence of the eager install**: the wrapper replaced this
window's projection while reporting `adoption: notOwed`, so the arm was the only evidence
there was.

With D1 the premise is false. A conflict writes nothing and now replaces nothing, so the
identities a session holds are still the ones the window is projecting. Both terms are
removed, and the behavioural consequence is stated rather than left to be discovered: a
conflicted move or duplicate is refused **while the panel is showing**
(`MoveSubmissionRefusal` `conflict`), and dismissing it gives the session back.

**That is not a way to write past a conflict.** The session resends its **frozen** base
revision, and the command **refuses** it. What it is refused *with* is not the conflict the
panel showed, and the first version of this record said it was — the 2c-4a-2 review's third
finding, and this project's named worst defect class. The correction, in the terms the code
gives: `conflict_after_the_lock` refreshes the Rust workspace cache to `disk_revision` while
producing the conflict, so the next match command's leading `view_at` compares the frozen base
against **that** and answers `identityStaleRevision` before the locked save check is reached
(`src-tauri/src/commands.rs`). Only `save_raw_document`, which has no `view_at`, reaches the
locked check and conflicts a second time.

**What that does and does not change.** Write safety is identical either way: no stale
candidate is retried and no bytes are overwritten. What differs is the sentence a person sees,
which is why the distinction is worth the paragraph — and why a match-level surface needs the
in-panel reload of D7 rather than a second attempt.

The affected doc paragraphs — two module headers, two field docs, two `apply*` JSDocs and
`dismissMoveOutcome`'s — were rewritten to say the opposite of what they said, each naming the
date and the reason, rather than deleted. The two test comments that carried the same claim
now say what their case actually sends, which is no second command at all.

### 2.6 D6 — `diskText` names one thing on that screen, and the prop is the one that went

`RawEditor.svelte` had a `diskText` prop of type `RawDocumentText | null`, derived from
`browser.rawTextOf(id)`; `ConflictModel.diskText` is a `string`. The consult's own note is
that TypeScript rejects accidental interchange because the two sit at different typed
boundaries — and that two different things under one name on one screen is how a wrong value
gets drawn, because a person reading the component has no type checker.

**The prop was removed rather than renamed**, because after step 1 it is not merely a
duplicate name — it is a *worse value for the same job*. What it carried came from a second
`document_text` call which could answer a later text than the conflict was about, or an
**earlier** one when the viewer happened to hold the same file (`2c-4a-1-notes.md` §4.1). The
payload's `diskText` arrives paired with `diskRevision` by content-hash equality in one Rust
function. So the conflict panel now reads `view.diskText`, there is exactly one `diskText` on
that screen, and it is the revision-bound one.

**Three things went with it**, each because its only reason for existing was that second
read: `conflictText` and `forgetConflictText` in `workspace.svelte.ts`, `captureTheDiskText`,
and `forgetTextOf` — which after the conflict cache was gone was `forgetFileText()` with an
ignored parameter, so its ten call sites now call `forgetFileText()` directly.

**And `rawTextOf` went too**, which is the one removal this step made that the task did not
name. Its documented purpose was the 2c-1b review's fifth finding — *an editor open on file A
must be able to show and load the version on disk for A even when the window has moved to
file B* — and that requirement is now met **more strongly** by the payload, which no click
anywhere in the window can move. Its remaining source was the viewer's own snapshot, which
`fileText` already exposes, and its only production caller was the prop that went. Three of
its tests pinned the staleness of the cache it read and could not survive the removal; they
were replaced by the no-second-read case and by the six-writer suite, which pin what
supersedes them.

### 2.7 D7 — an i18n key was removed, and 2c-4a-1's D1 is the reason

`browser.rawEditor.diskVersionUnavailable` said *the version on disk cannot be read here, so
it cannot be loaded in place of your text*. With `ConflictModel.diskText` a required `String`,
that state is unreachable: 2c-4a-1's D1 established that a `SaveResult::Conflict` cannot exist
unless the read that produced the text succeeded, and that an `Option` there "would have added
an arm no code can reach, and the arm would have had to be given a sentence in two
dictionaries — a user-facing claim about a state this application cannot produce". The
sentence outlived the arm by one step; it is gone from both dictionaries, at parity.

An empty file keeps its own arm — `conflict.diskText === ''` draws
`browser.detail.fileTextEmpty` — because zero characters is a fact about the file rather than
a failure to obtain it, and reloading it is a legitimate thing to ask for. The mounted case
that asserted the removed sentence was rewritten to drive that arm instead, through a
confirmed reload.

The carriage-return refusal is untouched and is a different sentence
(`browser.rawEditor.lineEndingsNotPreserved`): it is now decided in `rawEditorView` as
`diskRefusal`/`canReload` rather than in markup, because a rule written into one renderer is
carried by that renderer's mounted suite alone.

---

## 3. What this step deliberately did not do

- No `saveAnyway`, no retry of the stale candidate, no automatic reload, no clearing of dirty
  state on conflict, no cross-revision identification of "the same match", no YAML emitted
  from a projection, no diff. Forbidden for the whole of 2c-4a (consult Q1 and its verdict).
- **No control named or coded "keep my draft"**, in either language. `CLAUDE.md` §6 makes that
  absolute before 2c-4b, and `saveOutcome.test.ts` and `rawEditor.test.ts` both check the
  rendered labels rather than only the code names.
- **No new panel, no new control, no new i18n key.** The five match components' reload arms
  are *implemented and called*, and nothing draws a control that reaches them because no model
  offers the choice (§2.4). Their `copyDraft` arms are the one thing still unimplemented, and
  stay so until step 3 has the labels to copy with.
- No change to `crates/espansoconfig-core` and no change to `src-tauri/`. `cargo test
  --workspace` is 1048, unchanged, and no Rust file was opened for editing.
- No new module: `npm run build` still reports **171**, which is the shape this change should
  have.

---

## 4. Holes this step leaves open, each with its reason

1. **Five surfaces have the reload transition and do not offer it**, and three have no copy at
   all (§2.4). One boolean per surface, plus the copy renderer, is 2c-4a-3's.
2. **Nothing draws `diskText` for the five match panels.** The conflict payload carries it for
   all six commands, and only `RawEditor.svelte` shows it. Step 3.
3. **`browser.matchMove.refused.unsavedDraft`'s known defect is untouched**, as it has been
   since 2c-3c: its sentence claims unsaved edits where its predicate measures an open editor.
   Out of this step's scope, unchanged, and still true.
4. **Nothing relates a `CONFLICT_CAPABILITIES` declaration to the component that draws it**
   (§2.4), and the test that walks the six capability objects imports no component and can
   establish nothing about wiring. Both are said in the test's own comment.
5. **A refused reload leaves the panel on its confirm step**, and no sentence says why. It is
   the honest refusal — the window has moved somewhere this application cannot order against
   the disk snapshot — and the way forward that exists today is *Keep editing* and a fresh
   attempt. A disclosure for it is a screen, so it is 2c-4a-3's, listed here rather than
   invented without a key.
6. **A closed match session is refused at one gate per surface, not at every entry point.**
   `isEditable`, `canRequestDelete`, `canChoose`/`canMove`, `canDuplicate`/`beginDuplicate` and
   `beginMove` all consult `closed`; no *refusal code* was added for it, because a code is a
   sentence on a screen and a closed panel is not on one — so a surface that drew a reason for
   a closed session would have none to draw.
7. **No window reading was taken**, and none is owed here: it belongs to step 3's exit
   (consult Q8), together with the six direct-filesystem conflict launches of Q7.

---

## 5. The mounted-component evidence

Every sub-phase of 2c owes model tests, a mounted-component test and a window reading. This
step adds no panel, and it still owes the second because it **changed behaviour reachable from
a mounted component**: `RawEditor.svelte` lost a prop, gained one, and its confirmed reload now
performs the workspace adoption. `RawEditor.test.ts` — one of the seven jsdom-opted suites —
carries it: `mountEditor` records every adoption the component asks for, and the new case
walks the panel from the conflict to the confirm click, asserting that the count is zero at
the panel, zero at the warning, and one afterwards, with the box filled in the same click.

**The five match components' new arms are deliberately *not* covered by their mounted
suites**, and the reason is the same as the reason they are safe: no control that reaches them
is drawn, so there is nothing for a mounted test to press. Their five suites were extended only
with the new `adoptDiskVersion` prop, whose recorded value stays untouched — which is itself
the assertion that nothing on those screens can spend a confirmation today. The transitions
behind the arms are driven by the five new model suites.

What step 3 owes instead is a mounted case per newly drawn control — five of them, pressing
*Reload disk version* and then *Confirm reload* and asserting the panel closed — and the
window reading.

---

## 6. The gates

| Command | Result |
|---|---|
| `npm run check` | exit 0 — 411 files, **0 errors, 0 warnings** |
| `npm test` | exit 0 — 46 files, **1380 passed** (baseline 1326; 1342 after round 1, 1372 after round 2) |
| `npm run build` | exit 0 — **171 modules**, unchanged |
| `cargo test --workspace` | exit 0 — **1048 passed**, unchanged; no Rust was touched |

`cargo clippy` and `cargo fmt --check` were **not run and are not owed**: no file under
`src-tauri/` or `crates/` was modified.

Acceptance greps:

```sh
rg -n 'installView|forgetTextOf|repairAfter' src/lib/browser/workspace.svelte.ts
# `forgetTextOf` does not exist; `installView`/`repairAfter` appear only in
# `adoptDiskVersion`, `applyRepair`, `rereadDocument` and the four commit adoptions —
# none of them a conflict arm.

rg -n 'conflictText|captureTheDiskText|forgetConflictText' src/lib/browser/workspace.svelte.ts
# nothing.
```

---

## 7. The review rounds

Three rounds. §7.5 is the second — which found that **the fix round introduced two new findings
of its own**, one of them the very defect class the round was convened to catch. §7.6 is the
third, which confirmed the code sound and found that **§7.5.2's own disposition overstated its
completeness**. Every finding is accepted and closed. Earlier dispositions are left as they were
written, with each later section recording where they were wrong.

### Round 1

`docs/reviews/phase-2c-4a-2-code.md` — Codex, READINESS: **NOT READY**, one High, two Mediums
and one Low. **All four are accepted and closed; none is disputed.** Two needed behaviour
changes, one needed a protocol change, and one was prose and test comments. No existing test or
assertion was weakened or removed, no i18n key was added, and no control was drawn.

The review's eight *Other scrutinised points* returned no finding and are recorded here
unchanged: the six emptied conflict arms, the two-counter selection invariant across
`adoptDiskVersion`, the trailing `document_text`'s contract, the `forgetTextOf` → `forgetFileText`
reduction, the `rawTextOf` removal, the deleted dictionary key, the single choice authority,
and the absence of `saveAnyway`, retry, rebase, YAML emission, diffing and *Keep my draft*.

#### 7.1 High — five surfaces had no confirmed reload path. Accepted, fixed.

**The review's cut was the right one and mine was not.** I withheld the *transition* along with
the *offering*; it holds that an unoffered transition can be built and tested without drawing
its choice, and that the split assigns per-surface close/reseed behaviour and the `DetailPane`
props to this step. Both are correct, and the consequence it names is the sharp one: a real
match conflict had only *Keep editing*, and dismissing it does not even reproduce the conflict
(§2.5), so there was no in-panel route to the disk version at all.

**The fix is §2.4**: `ReloadStep` and the three transitions on all five surfaces, `closed` on
each session and view, a `closed` gate per surface, the five components' arms wired to them,
and `adoptDiskVersion` passed to all six from `DetailPane`. `offersReload` stays `false`, which
is the half of my judgement the review preserved: nothing is drawn, so nothing is dead.
Twenty-five new model cases drive the machinery.

**The test at `saveOutcome.test.ts` is not a wiring guard, and now says so.** The review is
right that asserting the five omissions positively relates to no component arm and stops
relating to anything once step 3 edits the expectation. Its name and comment were rewritten to
state exactly what it establishes — that five booleans are `false` and what the mapping does
with them — and to name where the wiring evidence actually is.

#### 7.2 Medium — the adoption brand was bound at authorization, not at spending. Accepted;
**closed only at round 2** (§7.5.1)

The review explicitly confirms the `ReloadConfirmation` check is real and is **not** the old
`confirmDelete` defect. The gap was the other end, and the fix removes the gap rather than
guarding it: `DiskAdoption` no longer crosses a module boundary at all (§2.1). `BrowserState`
takes the conflict and the confirmation and does both halves in one synchronous call, refusing
a foreign confirmation, a spent one and an unprojected document. Five new cases cover replay, a
fresh token after an install, cross-boundary identity, and an adoption **retained across a
later conflict**.

*This round also refused a projection already at the disk revision, and §7.5.1 corrects that to
`alreadyThere` — the sentence above no longer lists it, because it is not a refusal.*

The one thing this round could not distinguish — a second `BrowserState`'s conflict over the
same session-local document number — was recorded as a hole rather than claimed closed, and the
confirmation pass was right that this meant the finding was not closed. §7.5.1 closes it.

#### 7.3 Medium — the record claimed the wrong second-attempt outcome. Accepted, corrected.

**This project's named worst defect class, and the review found an instance of it in prose I
wrote in the same step that lists that class.** A dismissed *raw* conflict resends its frozen
base to the locked check and conflicts again; a dismissed *match* conflict does not reach that
check at all, because `conflict_after_the_lock` refreshed the Rust workspace cache and
`view_at` answers `identityStaleRevision` first. Write safety is identical; the sentence is
not. Corrected in §2.5, in `matchMove.ts` (module header, `dismissMoveOutcome`), in
`matchDuplication.ts` (module header), and in the two test comments — which, as the review
notes, could be false while their tests passed, because neither sends a second command. They
now say that.

#### 7.4 Low — three test comments claimed checks their tests could not perform. Accepted, fixed.

- **`EVERY_CONFLICT_CHOICE` was not exhaustive.** `readonly ConflictChoice[]` accepts a
  four-element array whatever the union holds. It is now built from a
  `satisfies Record<ConflictChoice, true>` object, so a fifth member is a compile error in that
  file and the two cases walking it may say *every*.
- **The per-writer suite's "re-reads nothing".** The viewer is now opened before the write, and
  the claim is stated exactly: the `document_text` count catches the pair the six arms really
  used — `forgetFileText()` then `readFileText()` — **measured** by reinstating exactly that in
  `moveMatch` and watching the case fail. It cannot catch a *bare* `readFileText()`, and that
  is not a hole: `readFileText` returns early when the viewer already holds the target, so such
  a call reads nothing. The comment says both halves.
- **The capability test.** Renamed and rewritten to claim only what it checks (see §7.1).

### 7.5 Round 2 — the confirmation pass

Codex again, READINESS: **NOT READY**. It confirms three of the four closures — the missing
transition, the second-attempt prose and the three test comments — and **does not close the
adoption Medium**, because the fix bound authorization and left the *spend* unbound in two
further ways. Both new findings are accepted; neither is disputed.

#### 7.5.1 New High — a confirmed reload could install a stale snapshot over a newer projection

**Real, reachable, and the worst kind of defect this phase can have: silently moving a person's
window backwards while reporting success.** A conflict is retained for a window at revision A
carrying disk snapshot C. The person presses *Reload disk version* and reads the warning.
Before they confirm, a `rereadDocument` — or any other projection replacement — installs D. A
workspace reprojection is neither an `apply*` outcome nor a dismissal, so the session survives
at `confirming` with a perfectly valid token, and the confirm then installed C over D, repaired
the selection against C and answered success.

**Closed by binding the spend to the conflict's origin** (§2.1): `rememberTheConflict` records,
at the moment a conflict arrives, which document it is about and that document's projection
generation. `adoptDiskVersion` refuses a conflict with no entry and a generation that has
moved. The mutation was run — disabling the check makes the new ordering case fail — and the
new case drives the review's own ordering rather than the round-2 case's, which spent its token
first and could not have caught this.

The review's other half is closed with it: **"already at that revision" is satisfaction, not
refusal.** Returning `false` there left a surface unable to close or reseed and a confirm
control that could never succeed. A boolean cannot carry three outcomes, so
`AdoptTheDiskVersion` now answers `DiskAdoptionOutcome` — `installed`, `alreadyThere`,
`refused` — and every surface treats the first two alike, with a case each proving it.

And the **cross-`BrowserState`** residue the round-2 notes merely acknowledged is closed by the
same mechanism rather than argued away: a conflict this state never registered installs
nothing, whatever session-local document number it names.

#### 7.5.2 New Medium — the round left records saying the arms it had just wired do nothing

**This project's named worst defect class, written by the round convened to catch it.** Five
model capability docs and five component `conflictAction` docs still said the reload arm
"returns without doing anything" and that step 3 must wire it — contradicting the code in those
very arms and contradicting §2.4 and §7.1 of this record. The failure mode is a person: the
step-3 implementer follows the comment nearest the API and rebuilds or postpones machinery that
already exists.

**Addressed by a sweep rather than by patching the ten cited lines.** Every one of those blocks
now says the same thing the code does: *the transition is built and wired; only the offering is
withheld, and 2c-4a-3 flips one boolean.* The sweep also caught instances the review did not
cite — `saveOutcome.ts`'s `ConflictCapabilities` doc and both its booleans, `rawEditor.ts`'s own
capability doc, the five model suites' opening comments and their "not offered" cases, the six
`adoptDiskVersion` prop docs and five model JSDocs describing a boolean answer and calling
*bytes already held* a refusal.

> **Correction (§7.6).** The paragraph above originally ended by claiming that `rg` for
> "returns without doing anything", "would do nothing" and "a `false` from" found no remaining
> instance in this protocol. **That claim was false when it was written**, and the round-3 pass
> found four survivors — including §2.1, this record's own primary design section. The sweep
> those three patterns describe was run over the *code* and not over the prose, and the sentence
> asserted a completeness it had not measured. §7.6 is what closing this actually took, and the
> paragraph is left as written rather than silently repaired.

### 7.6 Round 3 — the code confirmed, the sweep not

Codex, READINESS: **NOT READY**, one Medium and nothing else. The round-3 code is confirmed
sound in terms worth recording, because they are the strongest evidence this change has: the
wire object `ConflictModel.source` carries survives the six components' `$state.raw` without
being cloned or proxied, so the `WeakMap` key holds; the projection generation is judged the
**right** narrower guard over `conflict.expected`, which is a session's frozen base; checking
`alreadyThere` before the generation means a replacement that reached the requested revision is
satisfaction rather than an over-refusal; a refused changed-generation confirmation still has a
way out through the always-present *Keep editing*; both guards were verified to fail their tests
if removed; all six callers treat `installed` and `alreadyThere` alike and stop only on
`refused`; and every earlier closure is undisturbed.

#### 7.6.1 Medium — four sites still described the old boolean contract. Accepted, fixed.

The four: **this record's §2.1** — the primary design section, which still typed
`adoptDiskVersion` as returning `boolean`, said its refusals answer `false`, and called a
projection already at the disk revision a no-op refusal; `saveOutcome.ts`'s `DiskAdoption`
JSDoc, listing "bytes already held" among the window-side refusals; `rawEditor.ts`'s
`loadDiskVersion` JSDoc, saying `() => true` type-checks when the callback now answers a
`DiskAdoptionOutcome`; and `rawEditor.test.ts`'s refusal case, calling the answer `false` and
listing bytes already held as a refusal two lines below a corrected case that says the opposite.

**Two things went wrong, and the second is the worse one.** The first is mechanical: one of the
round-3 edit scripts asserted its way through several replacements and threw on a later one, so
the whole script's writes — including §2.1's — were discarded, and the retry only re-applied the
edit that had failed. The second is that §7.5.2 then **claimed the sweep was complete**, which
made the permanent record internally contradictory rather than merely stale, and stopped the
next reader looking. A disposition that overstates its own completeness is worse than the
staleness it describes.

**What closing it took.** The four sites rewritten; §7.2's own list of refusals corrected, since
it also named "a projection already at that revision" as one; §7.5.2 given a correction block
that states plainly that its closing sentence was false when written and why. The sweep was then
re-run over **prose as well as code** — `rg` for `boolean`, `` `false` ``, `` `true` ``,
"already held", "already holds", "already there" and "no-op refusal" across all thirty-two files
this phase touched plus this record — and every hit was read against the live type. What
survives is a legitimate use in each case: unrelated predicates, the two capability booleans,
and the *history* of why a boolean could not carry three answers. **This paragraph claims the
sweep just described and nothing further.**

#### 7.6.2 Correction — that sweep was itself incomplete, and the round-4 review found it

**Written after the fact, and left rather than repaired silently, for §7.5.2's reason.** The
patterns listed above did not include prose using **"installed" as the name of success**, and
two statements survived because of it: the file table's row for the five components, and §2.4's
closing sentence, both saying `close()` fires "only when the window says it installed". In a
three-valued API `installed` names exactly one of *two* successful answers —
`spendTheConfirmedReload` returns success for `alreadyThere` too, and all five match sessions
close on either — so both statements preserved the same stale binary description the round was
convened to remove. Both now say the window reports the disk observation **satisfied**, which is
any answer that is not `refused`.

So §7.6.1's last sentence was accurate about the sweep it described and wrong to imply that
sweep was sufficient. Three consecutive rounds have now closed a finding and left a narrower
instance of it standing, each time because the search was written from the *previous* wording
rather than from the *contract*. The durable lesson is the one this record can pass on: sweep
for what the type now says, not for the words the old type used.