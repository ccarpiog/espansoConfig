# Phase 2c-4a-3b — decision record

**The conflict panel is now drawn on all six write surfaces.** 2c-4a-3a gave the two
authored-text match surfaces their panel and left the mover, the deleter and the duplicator
declaring `offersReload: false`; this step flips that boolean on all three and draws their
panels — the disk side through `SourceText`, an **operation summary** where the other three
show a retained draft, all three revisions, the two-step reload, and the `reloadUnavailable`
disclosure those three surfaces had carried since 3a with nothing rendering it.
`offersCopyDraft: false` is untouched on all three, permanently, by the consult's Q4.

The authority for this step is `docs/reviews/phase-2c-4a-design.md`. It discharges its **Q3**
for the remaining four surfaces, its **Q5** for the three operation-choice panels, and it does
**not** touch its Q4 — that question is settled for these three by what their drafted value
*is*. Where this record and the consult disagree, the consult is right and this is a bug.

**The step went beyond its brief, deliberately, and found a defect by doing so.** Verifying the
sentence `ConflictCapabilities.reloadOutcome` produces on these three panels showed that it —
and the shared *your text is still here* line beside it — described text nobody typed. Closing
that meant a new model type, a new accessor, a required parameter on `conflictChoiceKey`, and
edits to three surfaces that were not in the brief. **Codex round 1 ruled the widening
justified** and verified that the raw editor, the match editor and the creator come out
**byte-identical in rendered wording**, their new branches selecting their previous keys.

**Two review rounds. Round 1: NOT READY — two Medium (both blocking) and one Low. Round 2, the
confirmation pass over the fix round: READY, no findings.** Both Mediums were this project's
named worst defect class — a sentence claiming something the code does not do — and §7 is the
disposition of each.

**No Rust, and no window reading.** The reading is step 3c and step 3's exit; it is owed for
**six** surfaces, and this step's fix round gave it more to check than it had.

---

## 1. What this step built

*Everything below describes the code **after** the fix round of §7. What each finding changed
is §7; what the code now does is §1 and §2.*

| File | What changed |
|---|---|
| `src/lib/browser/saveOutcome.ts` | **`ConflictOperation`** (six arms) and `conflictOperationKey()`; **`SaveOutcomeMessage` gains `operationKeptInMemory` and `reloadAbandonsOperation`**; **`reloadWarningFor()`** — the one place the close/abandon guarantee is decided — and `describeConflict` branching on `draftKind`; `conflictChoiceKey` takes a **required** `ConflictDraftKind` |
| `src/lib/browser/matchMove.ts` | `offersReload: true`; **`MoveReloadWarning`**, `reloadWarningOf()` and `moveReloadWarningKey()`; `operationOf()` and `markedAmongTheDestinations()`; **`notMovableToShow()`**; the view gains `reloadWarning`, `reloadUnavailable` (now read), `diskText` (now read) and `conflictOperation`, and loses `notMovable` and `awaitingReloadConfirmation` |
| `src/lib/browser/matchDeletion.ts`, `matchDuplication.ts` | `offersReload: true`; `conflictOperation` fixed at `'deleteSnippet'` / `'duplicateSnippet'`; `awaitingReloadConfirmation` kept as the boolean it is on those two surfaces, because they have one destination shape and nothing for an arm to select |
| `src/lib/browser/matchEditor.ts`, `matchCreation.ts`, `rawEditor.ts` | no capability change; call sites updated for the required `ConflictDraftKind`, and the renamed per-surface confirmation keys |
| `src/lib/components/MatchDeleter.svelte`, `MatchMover.svelte`, `MatchDuplicator.svelte` | the conflict panel: `retainedOperation` heading, `tConflictOperation(view.conflictOperation)`, the `operationIdentityIsOld` disclosure, the disk text through `SourceText documentStart`, all three revisions, `reloadDiskVersion` → `confirmReload`, and the refused-reload disclosure. `MatchMover.svelte` additionally renders `tMoveReloadWarning(view.reloadWarning)` and its `notMovable` markup rule is reduced to a null check |
| `src/lib/components/MatchEditor.svelte`, `MatchCreator.svelte`, `RawEditor.svelte` | the required `draftKind` on every `tConflictChoice` call, and the renamed confirmation keys. **Rendered wording unchanged**, confirmed by round 1 |
| `src/lib/i18n/index.ts` | `tConflictOperation()`, `tMoveReloadWarning()`, and `tConflictChoice()` re-typed to take the draft kind |
| `src/lib/i18n/{en,es}.json` | net **+15** keys per language: seventeen added, two renamed away, one rewritten (§2.7) |

Tests added or changed:

| Where | What it pins |
|---|---|
| `saveOutcome.test.ts` | the six `ConflictOperation` sentences in both languages; the three `reloadWarningFor` combinations and that the two authored-text sentences differ from the operation one; `conflictChoiceKey`'s two `confirmReload` labels; the six surfaces' declarations |
| `matchMove.test.ts` | `operationOf`'s four outcomes including **both** `after` arms driven by an option list that does and does not carry the anchor; `reloadWarningOf` over all three placement kinds; `notMovableToShow`'s two sides |
| `matchDeletion.test.ts`, `matchDuplication.test.ts` | the fixed operation summary, the three offered choices, the confirmation step and the refused-spend arm now that they are reachable |
| `MatchDeleter.test.ts`, `MatchDuplicator.test.ts` (mounted) | both sides on screen with all three revisions, the operation summary, no copy control at either step, the two-step reload, `adoptDiskVersion` called once and only after the confirm, `installed`/`alreadyThere` as success and `refused` as the only stop, the refused disclosure |
| `MatchMover.test.ts` (mounted) | the same, plus the two `reloadWarning` arms at the confirmation step, and **a reprojection under an open conflict driven over a real `BrowserState`** (§5) |
| the editor's, creator's and raw editor's suites | updated for the required draft kind and the renamed keys; no assertion weakened |

**1404 → 1426 frontend tests over 46 files.** `npm run build` reports **172** modules,
unchanged, with **no new source module** and no `svelte/internal/server` in the bundle. No Rust
was touched.

---

## 2. The decisions

### 2.1 D1 — the retained side of an operation-choice panel is a code, not a sentence

The consult's Q5 asks for a "retained operation summary" beside the disk text on the three
surfaces that hold no authored draft. `ConflictOperation` in `saveOutcome.ts` is that summary as
a **value** with six arms, and `conflictOperationKey` is a `switch` over literal keys, so a
renamed key is a compile error there and a new arm with no sentence is one too. The components
call `tConflictOperation` and decide nothing.

**The reason is 2c-3c-3's Medium, and it is narrower than "markup cannot be tested"**: a *model*
test drives values and never markup, so a description assembled in a `.svelte` file is carried
by that renderer's mounted suite alone — and here there are three renderers, which is exactly
the shape in which one of them quietly gets it wrong.

**The summary says what was asked for and never what became of it.** *Nothing was written* is
already on the panel as `SaveOutcomeMessage.nothingWasWritten`; repeating it in the summary
would be two sentences that have to be kept in step, which is the failure §2.5 records.

**It names no snippet.** A `MatchId` is revision-scoped, so the summary describes the *shape* of
the operation and the panel's own header — drawn from the projection this session opened over —
is what names the snippet. `browser.saveOutcome.operationIdentityIsOld` says so on all three
panels: this panel names the snippet as this window read it before the file changed, and this
application does not look for a corresponding snippet in the disk version. That is 2c-4b's work
and it is refused here by construction, not by omission.

### 2.2 D2 — the widening, and the argument that justified it

The brief was two lines of capability and three panels. What made it bigger is that
`reloadOutcome`'s sentence and the shared retained-draft line were **written for surfaces where
somebody typed something**:

- `browser.saveOutcome.reloadClosesSurface` ended *"Copy it first if you want to keep it"* —
  sound advice on the two surfaces that offer a copy, and an instruction with **no control
  behind it** on the three that never can, because consult Q4 refuses a copy for a
  `MovePlacement` or a `MatchId` as a property of the drafted value.
- `browser.saveOutcome.draftKeptInMemory` said *"Your text is still here, exactly as you wrote
  it"* — describing something the person never produced.

Neither is fixable by a second sentence in markup; both are one sentence shown to six surfaces
that are not alike. So `describeConflict` branches on `ConflictCapabilities.draftKind` —
`draftKeptInMemory` or `operationKeptInMemory`, `reloadClosesSurface` or
`reloadAbandonsOperation` — and `conflictChoiceKey` takes a **required** `ConflictDraftKind`,
because *"Discard my text and load it"* would otherwise have been the confirm label on three
panels holding no text. Required rather than defaulted, by the same argument that made
`reloadOutcome` required one field along: a default lets one surface inherit another's sentence
silently.

That reached `MatchEditor.svelte`, `MatchCreator.svelte`, `RawEditor.svelte`, `rawEditor.ts` and
about fifty test call sites. **The widening was put to the reviewer as a question and ruled
justified**: round 1 recorded that it "prevents operation-choice surfaces from claiming that
typed text exists or can be copied", and **verified that the three pre-existing panels remain
byte-identical in rendered wording** — the new branches select their previous message and label
keys. That verification is the whole safety argument for a change that touched three shipped
components, and it is the reviewer's, not the implementer's.

**What no type forces**, in the same sentence as what one does: nothing checks that a component
passes *its own* surface's `draftKind` to `conflictChoiceKey` — it is an ordinary
`ConflictDraftKind` and a caller can hand over the wrong one. What is closed is that a caller
cannot omit the question.

### 2.3 D3 — one field with an arm, never a boolean plus an arm

Round 1's **Medium 1**: `browser.matchMove.reloadClosesMover` told the person the chosen
destination could not be kept *because it names snippets of the version this window read*. True
of `MovePlacement`'s `after` arm; **`top` and `end` name no snippet at all** — they name a
position, which survives a reparse perfectly well as a *position* and is dropped for a different
reason.

The fix deletes that key and replaces `MatchMoveView.awaitingReloadConfirmation` — the boolean
the other five surfaces carry — with `reloadWarning: MoveReloadWarning | null`, chosen in
`matchMove.ts` by `reloadWarningOf` from the **retained** placement's own arm and rendered
through the new `tMoveReloadWarning`. Only the `anchoredDestination` sentence may say the
destination names another snippet.

**One field rather than a boolean plus an arm.** Non-`null` *is* "the warning is showing and the
destructive choice is one click away", so the condition and the arm it selects are decided
together and there is nothing for two fields to disagree about. Two fields that have to agree is
how a capability came to be expressed twice at 2c-4a-2, and that split is why a newly offered
button could compile and do nothing.

**The arm is read off the conflict's retained placement, never off the session's live draft.**
The two are equal today because `canChoose` refuses while a conflict is on screen; writing it
from the draft would describe something else the first time that stops being true, and nothing
in the type would notice.

**What no type forces**: the deleter and the duplicator keep a plain `awaitingReloadConfirmation`
boolean, because their operation has one shape and there is no arm to select — so the two
patterns coexist by design, and **nothing prevents a future renderer from re-deriving the mover's
arm from `conflict.draft.value` instead of walking `reloadWarning`**. What is enforced is that
the model has exactly one answer and that `moveReloadWarningKey` is exhaustive over it, so a
third arm cannot be added without a sentence.

### 2.4 D4 — the `after` summary asks about the screen, not about two revisions

Round 1's **Medium 2**: `browser.saveOutcome.operation.moveAfterSnippet` promised its anchor was
*"still marked as chosen among the destinations above"*, and `movePlacementOptionsOf` **drops an
anchor whose parse this window has since replaced**. A re-read arriving while the conflict is
displayed — from the sidebar, or from another surface's committed save — therefore left a
sentence pointing at a mark that had gone. The review named the cause exactly: **the mounted
test drove only a static projection**, so nothing could have seen it.

`ConflictOperation` gains `moveAfterSnippetNoLongerShown`, and `operationOf` now takes the live
projections and asks `movePlacementOptionsOf`'s **own answer** whether a drawn destination
carries the retained placement *and* is marked (`markedAmongTheDestinations`). Both halves are
asked of the option list rather than re-derived, because the sentence claims that a particular
row of that list carries the mark, and anything short of reading the rows is a second opinion
about what the screen shows. The component derives the view and the rendered options from **one**
read of the same projection array.

**This is not cross-revision identification.** The other arm says the destination is no longer
offered and names nothing: it does not say which snippet of the disk version the anchor was, and
does not look for it. Finding "the same snippet" across two revisions is 2c-4b's confidence work
and is forbidden here.

**What no type forces**, in the same sentence as what one does: `matchMoveView` takes
`views: readonly DocumentView[]` and **nothing can check that the caller passes the live
projections, or that it passes the same list it hands `movePlacementOptionsOf`** — a caller that
passed a stale list here and a fresh one to the options would get a sentence about a screen it is
not drawing. What is closed is that the two decisions are made from one argument in one function,
and `MatchMover.svelte` takes both from a single `$derived.by` read of `projections()`. The
mounted reprojection case of §5 is what drives the real path.

### 2.5 D5 — the close/abandon guarantee is stated once

Round 1's **Low 3**: at the confirmation step, the shared reload warning and each surface's own
`reloadCloses*` line **repeated the same close/abandon guarantee in different wording**. They
were consistent and reachable at the time, so it was a Low — but that duplication is precisely
what let Medium 1's narrower sentence drift into being false, and the review said so.

`reloadWarningFor` in `saveOutcome.ts` is now the sole model decision for it, choosing one of
three sentences from `reloadOutcome` and `draftKind` and from nothing else.
`reloadClosesSurface` absorbed the missing *the operation is not carried out / the file is not
written* clause that the creator's own line had been carrying alone; the five per-surface lines
were stripped to **reason plus next step** and **renamed to match what they now say**:

| Key now | Was | Says |
|---|---|---|
| `browser.matchEditor.reloadIdentifiesNoSnippet` | `reloadClosesEditor` | this application will not guess which snippet corresponds; open it again afterwards |
| `browser.matchCreation.reloadSeedsNoForm` | `reloadClosesForm` | a file holds no half-written snippet, so there is nothing to fill a form from |
| `browser.matchDeletion.reloadIdentifiesNoSnippet` | *(new)* | the same identity sentence, for a deletion |
| `browser.matchDuplication.reloadIdentifiesNoSnippet` | *(new)* | the same, for a copy |
| `browser.matchMove.reloadDrops{Positional,Anchored}Destination` | `reloadClosesMover` | §2.3's two arms |

**That rewrote rendered wording on five surfaces, four of which were the subject of no
finding** — which is why round 2 exists and was scoped to exactly that question.

**What no type forces**: nothing in this repository pins prose. The i18n suites check parity and
placeholder agreement, **not meaning**, so a later edit can put the close/abandon clause back
into a surface line and every suite stays green. What is enforced is that a surface cannot pick
its own shared arm — the three sentences are chosen from the declared capabilities alone.

### 2.6 D6 — `notMovableToShow`, and the rule that belongs in the model

`PROGRESS.md`'s own step-3b brief flagged one thing to check rather than assume:
`MatchMover.svelte:511` still held the shape the duplicator moved away from at 2c-3c-3's
Medium — `{#if view.notMovable !== null && view.cannotMove !== 'outOfDate'}`, a precedence
decision written into markup. It was shipped at 2c-3b and window-read there, so it was not a
regression; but this step was in that file anyway.

`MatchMoveView.notMovable` is now `notMovableToShow`, computed in `matchMove.ts` and returning
the frozen `eligibility` reason **only when `cannotMove === 'notMovable'`** — written against
that value rather than against `outOfDate`, so a refusal added above it in `refusalGiven`'s order
suppresses the frozen detail **by construction** rather than by a later edit here. The
component's markup is a null check. The **unsuppressed** verdict stays on
`MatchMoveSession.eligibility`, exactly as `matchDuplication.ts` leaves it — a caller that wants
the raw frozen answer still has one.

The two sibling panels now resolve the same rule in the same place. The standing debt ledger
loses this item; `browser.matchMove.refused.unsavedDraft`'s known defect is **untouched** and
remains on it.

### 2.7 D7 — the keys

Net **+15** per language, 711 → **726**, at parity. Seventeen added: two `SaveOutcomeMessage`
arms (`operationKeptInMemory`, `reloadAbandonsOperation`), the closing confirm label
(`choice.confirmReloadClosing`), the panel heading (`retainedOperation`), the identity disclosure
(`operationIdentityIsOld`), the six `operation.*` summaries, and the five per-surface
confirmation lines of §2.5. Two removed by rename (`reloadClosesEditor`, `reloadClosesForm`), one
rewritten in place (`reloadClosesSurface`). `reloadClosesMover` was written by this step's first
cut and **deleted by its fix round**, so it appears in no commit.

Every one is reached through an accessor. `conflictOperationKey`, `moveReloadWarningKey` and
`conflictChoiceKey` are `switch`es over literal keys, so a missing sentence is a compile error in
the file that owns it — the rule `CLAUDE.md` §6 states, and the reason no component builds a key.

---

## 3. What this step deliberately did not do

- **No `saveAnyway`, no retry of the stale candidate, no automatic reload, no clearing of dirty
  state on conflict, no cross-revision identification, no YAML from a projection, no diff.**
  Forbidden for the whole of 2c-4a (consult Q1). Round 2 confirmed each still absent.
- **No copy on the three new panels, and never.** `offersCopyDraft: false` on all three, and
  `conflictChoicesFor` refuses `copyDraft` for an `operationChoice` draft even if the boolean
  were set — the refusal is a property of the value, not of a caller's opinion.
- **No control named or coded "keep my draft"**, in either language.
- **No change to what a confirmed reload does.** The transition is 2c-4a-2's, unchanged: it
  adopts the disk observation through the one door and closes only after a successful adoption,
  treating `installed` **and `alreadyThere`** as success and stopping only on `refused`. It
  neither retries the stale move nor carries its placement forward.
- **No Rust**, no change to `src-tauri/` or `crates/`, and no `cargo` gate is owed.
- **No window reading**, which is step 3c and step 3's exit.

---

## 4. Holes this step leaves open, each with its reason

1. **Nothing enforces that a caller of `matchMoveView` passes the live projections** (§2.4), and
   the sentence about a marked destination is only as true as that argument. The component that
   ships takes both from one read; a second renderer could not.
2. **Nothing enforces that a renderer walks `reloadWarning`** rather than re-deriving the arm
   from the retained placement (§2.3). The model has one answer; the obligation to read it is
   prose and a mounted suite.
3. **No executable test pins the meaning of any sentence this step wrote or renamed** (§2.5).
   Reverting a prose fix while keeping its key leaves every suite green — the limit
   `2c-4a-3a-notes.md` §7.8 recorded, and this step wrote five more sentences into that gap.
4. **The deleter and the duplicator keep `awaitingReloadConfirmation` as a boolean.** Correct
   today because their operation has one shape; if either ever gains a second destination shape
   it inherits Medium 1's exact hazard and must take §2.3's field.
5. **Nothing relates a `CONFLICT_CAPABILITIES` declaration to the component that draws it.**
   Unchanged from 2c-4a-2 §4 hole 4 and 3a §4 hole 3, and now closed *in practice* rather than in
   type: all six components' mounted suites press every control their model offers.
6. **`browser.matchMove.refused.unsavedDraft` is untouched**, as it has been since 2c-3c: its
   sentence claims unsaved edits where its predicate measures an open editor.
7. **No window reading of any of these panels**, and jsdom is not WebKit. Legibility of a
   two-column comparison, and whether the operation summary reads as a summary rather than as an
   instruction, are step 3c's to judge.

---

## 5. The mounted-component evidence, and the mutation checks

Every sub-phase of 2c owes model tests, a mounted-component test and a window reading. The first
two are here; the third is step 3c.

`MatchDeleter.test.ts`, `MatchMover.test.ts` and `MatchDuplicator.test.ts` — all three already
`@vitest-environment jsdom` — gained a recording `adoptDiskVersion` prop with an injectable
answer, so a case can watch *when* the window is asked to move and what it does with each of the
three answers. Between them they press every control the three panels draw, and each asserts that
**no copy control exists at either step**.

**The reprojection case is over a real `BrowserState`**, and that is not decoration: `state.views`
is `$state`, so the panel re-derives on its own and an array a test swapped by hand would not be
noticed at all. The case creates an anchored conflict, asserts the destination is marked and the
`moveAfterSnippet` summary is shown, calls `state.rereadDocument` — **nothing in the panel asked
it to, which is the point** — then asserts only `top` and `end` remain, that the two summary arms
have swapped, that the conflict is still displayed, and that no second command was sent. Round 2
confirmed it is falsifiable and exercises the claimed production path.

**Falsifiability was proved by mutation, not asserted:**

| Mutation | Effect |
|---|---|
| the `confirmReload` arm in all three panels replaced by a bare `confirmDiskReload` | **9 tests red** across the three mounted suites |
| `notMovableToShow`'s guard rewritten to `cannotMove === 'outOfDate'` | its model test red |
| `operationOf` made to return `'moveAfterSnippet'` unconditionally | the model test **and** the mounted reprojection test red |
| `reloadWarningOf` flipped to key off `'end'` | **5 tests red** across both suites |

All four were restored and the suite is green.

**What they prove and what they do not**: that a handler fires, that the right value reaches the
boundary, and that the right sentence is on the element. jsdom has no layout and no WebKit, so
*the panel is legible*, *the two sides read as two sides*, and *the disk text is readable beside
a long file* are all step 3c's to establish.

---

## 6. The gates

Every command was run **by the orchestrator**, each as its own invocation, after the fix round.

| Command | Result |
|---|---|
| `npm test` | exit 0 — 46 files, **1426 passed** (baseline 1404) |
| `npm run check` | exit 0 — 412 files, **0 errors, 0 warnings** |
| `npm run build` | exit 0 — **172 modules**, unchanged, **0 new source modules**; no `svelte/internal/server` in the bundle |
| `cargo test --workspace` | exit 0 — passed, and `git status` over `src-tauri/` and `crates/` is **empty** |
| i18n parity | **726 keys** per language (baseline 711), key sets equal, placeholders equal |

**The module count did not move, and that is the expected shape.** This step adds no source
module — every new type lives in a file that already existed. `CLAUDE.md` §6 gives the rule: the
guard is the *shape* of a change to that number, and the regression it exists to catch is a jump
to ~180 with Svelte's server build in the bundle.

Acceptance greps:

```sh
rg -n 'offersReload:|offersCopyDraft:' src/lib/browser/match{Move,Deletion,Duplication}.ts
# six hits: three `offersReload: true` and three `offersCopyDraft: false`. The
# second three are permanent, by consult Q4.

rg -n 'reloadClosesMover|reloadClosesEditor|reloadClosesForm' src/
# one hit — the explicitly historical "now gone" comment at saveOutcome.ts:619,
# not a lookup and not an asserted key. Checked, and round 2 checked it too.
```

---

## 7. The review

`docs/reviews/phase-2c-4a-3b-code.md` holds both rounds, appended in order and never rewritten.
Both Codex jobs were dispatched **read-only**, so neither could create the review file and the
orchestrator copied each reply into it verbatim; the file says so at the top of each round.

Round 1: **NOT READY** — two Medium (both blocking) and one Low. Round 2, the confirmation pass
over the fixes: **READY, no findings**.

### 7.1 Medium 1 — a sentence true of one placement arm, shown for all three

**Accepted.** `browser.matchMove.reloadClosesMover` said the chosen destination could not be kept
because it names snippets of the version this window read. True of `after`; false of `top` and
`end`, which name no snippet at all. Closed by §2.3: the key is **deleted**,
`awaitingReloadConfirmation` is replaced by `reloadWarning: MoveReloadWarning | null`, and only
the `anchoredDestination` arm may say the destination names another snippet. Round 2 confirmed
the derivation is from the retained conflict placement and not from the current draft, and that
`MatchMover` renders exactly that model arm.

### 7.2 Medium 2 — an anchor sentence that could point at nothing

**Accepted.** `browser.saveOutcome.operation.moveAfterSnippet` promised its anchor was still
marked among the destinations above, while `movePlacementOptionsOf` removes old-revision anchors
after a live reprojection with the conflict still displayed. Closed by §2.4: a sixth
`ConflictOperation` arm, and `operationOf` asking the option list's own answer. **The review named
the cause of the gap — the mounted test drove only a static projection — and the fix added the
coverage as well as the behaviour**, over a real `BrowserState`. Round 2 confirmed both, and that
the other arm no longer attributes every disappearance specifically to a re-read.

### 7.3 Low 3 — one guarantee stated twice

**Accepted, and treated as the cause of Medium 1 rather than as cosmetic.** Closed by §2.5:
`reloadWarningFor` is the single source, the shared sentences absorbed the missing clause, and
the five surface lines were stripped and renamed. Round 2 confirmed the shared messages carry the
clauses removed from the surface lines, that the surface lines make no additional close, abandon
or write guarantee in either language, and that the renamed keys are **fully migrated in
executable source, tests and both dictionaries** — the one remaining old-key occurrence being the
explicitly historical "now gone" comment at `saveOutcome.ts:619`.

### 7.4 The fix round's own sweep, and the narrower instance it found

**A fix is a change, and the sweep after it is written from what the type now says, not from the
words the finding used.** Done that way here, it caught one: the new
`moveAfterSnippetNoLongerShown` sentence first blamed the disappearance on *"this window has read
this file again"*, which is only one of the ways `movePlacementOptionsOf` drops an anchor. It now
claims only that the window no longer holds that reading.

That is the same shape `2c-4a-2-notes.md` §7.6.2 named and `2c-4a-3a-notes.md` §7.8 hit again —
a fix closing a finding and leaving a **narrower instance of it standing**. The difference here is
that the sweep found it before the reviewer did, which is the first time in this phase that has
happened.

### 7.5 What round 1 confirmed positively

Recorded as given, because these are the categories a later round should not re-derive: the
reload transitions treat `installed` **and `alreadyThere`** as success and stop only on
`refused`; no forbidden conflict behaviour was added; the selection-generation writes remain
sound; and the new tests are not vacuous — their only weakness was the missing mover
placement/reprojection coverage, which §7.2's fix supplied.

Round 2 added: the forbidden behaviours remain absent after the fixes, `offersCopyDraft: false`
is intact on all three surfaces, `conflictChoicesFor` contains no `saveAnyway`, and the confirmed
mover reload adopts the disk observation and closes **only after a successful adoption**, neither
retrying the stale move nor carrying its placement forward.

### 7.6 What this round leaves for the next reviewer

Two things. **§2.4's liveness question** — a sentence whose truth depends on an argument no type
can check — and **§2.5's single source**, which is new shared machinery read by six surfaces and
pinned by no test that can fail on meaning.

---

## 8. What this hands step 3c

**All six write surfaces now draw a conflict panel, and the window reading is the only kind of
evidence 2c-4a-3 still owes.** It was already owed for six rather than five, because 3a's fix
round migrated `RawEditor.svelte` onto the shared clipboard module and **a window reading is
re-taken after any change to a component**. This step adds three panels that have never been
seen, and its fix round puts **new prose on five surfaces** — four of which no finding was about
— so the reading has more to check than it did when 3a handed it over.

The recipe is consult **Q7**'s and is unchanged: open the surface at revision R0, then —
**without invoking any app command that reloads the document** — use a **shell or editor process**
to append a valid YAML comment to that exact file, producing R1. The frontend and the Rust cache
stay at R0, `view_at` passes, and the core's locked read sees R1. This application's own raw-save
IPC does **not** work as the second writer: it refreshes the same Rust workspace cache, so
`view_at` answers `identityStaleRevision` before the transaction.

**One plan per launch, into a fresh bundle path**, and set the language **explicitly through the
picker** — the webview's `localStorage` follows the **bundle identifier**, not `HOME`, so an
override set by one launch is still in force in the next. `docs/decisions/1c-2b-2b-2-notes.md`
§6.1 is the technique.

Three things worth putting on the reading's list from this step specifically:

1. **The mover's two `reloadWarning` arms**, seen on screen — a `top`/`end` conflict and an
   `after` conflict are two different confirmation sentences and only a reading shows both in
   place.
2. **The operation summary read as a summary.** It is one sentence beside a whole file's text;
   whether it reads as a description of what was asked for, rather than as an instruction, is a
   presentation judgement no suite can make.
3. **The five renamed confirmation lines**, on all five match surfaces, checked against the
   shared warning above them for the duplication §2.5 removed — in **both** languages.

**One thing step 3c inherits and must not undo.** After a match conflict is dismissed, a second
submission is refused by `view_at` with `identityStaleRevision` — **not** by a second conflict —
because `conflict_after_the_lock` has already refreshed the Rust cache. Only a raw save reaches
the locked check twice. Write-safe either way, but they are different sentences.
