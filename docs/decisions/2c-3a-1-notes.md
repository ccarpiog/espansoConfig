# Phase 2c-3a step 1 — decision record

**New and delete as values, plus their command wiring. No component, no `.svelte` file, no screen,
no window reading.** Step 2 of 2c-3a draws what this decides.

The authority for the decisions below is `docs/reviews/phase-2c-3a-design.md` — the design consult
for this exact sub-phase, seven answered questions. Where this record and that document disagree,
the consult is right and this is a bug.

---

## 1. What this step built

| File | What it is |
|---|---|
| `src/lib/browser/matchCreation.ts` | the whole new-snippet form as a value: destinations, position, the two required fields, submittability and the save |
| `src/lib/browser/matchDeletion.ts` | deletion as a two-phase value: eligibility, a confirmation bound to one identity, and the save |
| `src/lib/browser/typing.ts` | the coalescing boundary **extracted** from `matchEditor.ts`, because two editors now share it |
| `src/lib/browser/notices.ts` | a fifth `SelectionNotice` arm, `deleted` |
| `src/lib/browser/workspace.svelte.ts` | `createMatch` and `deleteMatch` wired into `BrowserCommands`, `REAL_COMMANDS` and `BrowserState`, each with its own adoption performed inside the wrapper |
| `src/lib/browser/matchEditor.ts` | `recordChange` now calls the shared policy; `Clock`, `TYPING_GROUP_IDLE_MS` and `TypingGroup` are re-exported so nothing downstream moved |
| `src/lib/browser/fixtures.ts` | `topLevelKeys`, with a derived default, because destination eligibility asks the same question of the same field the core does |
| `src/lib/i18n/{en,es}.json`, `index.ts` | eighteen new sentences per language and three reactive accessors |

Tests: `matchCreation.test.ts` (42), `matchDeletion.test.ts` (22) and twenty-three more in
`workspace.test.ts`. `notices.test.ts`'s `NOTICES` list gained the fifth arm — it is
**hand-maintained**, so `selectionNoticeKey`'s exhaustive `switch` catches a missing key and nothing
catches a notice that file forgets to walk; adding the arm without adding it there would have left
the new sentence unchecked in both languages. `npm test` goes from **1020 tests over 38 files** to
**1116 over 40** — the ninety-six is larger than the eighty-seven written here because several
existing suites walk every arm of `SelectionNotice` and every key of the dictionaries, so the fifth
notice and the eighteen keys add cases of their own. **Thirteen of the ninety-six are the first
review round's** (§5): five in `matchCreation.test.ts`, two in `matchDeletion.test.ts` and six in
`workspace.test.ts`. **Four more are the confirmation round's** (§7), all in `workspace.test.ts`.

**No Rust was written**, as `PROGRESS.md`'s "Next action" expected.

---

## 2. The decisions

### 2.1 D1 — creation is its own module, and the reason is what creation is *not* (consult Q3)

`matchCreation.ts` is parallel to `matchEditor.ts`, not a mode inside it. Three things the small
editor is built around do not exist here:

- **no projection**, so there is no `MatchBaseline`. Folding creation in would mean manufacturing an
  empty baseline — a projection of a snippet that does not exist, in the one field whose entire
  purpose is to record what a file held;
- **no absent key**, so the `Unchanged`-versus-`Set("")` distinction has no meaning. Both values are
  required, because `NewMatch` says so on the wire and because a trigger with no body is not a usable
  espanso snippet;
- **no reprojection debt of the same kind.** A committed create does invalidate the form, but because
  the *destinations* it holds are stale, not because a scalar's spelling may have changed.

What creation does share is the **save protocol**, and it shares it by calling `editorSave.ts` and
`saveOutcome.ts`: `submissionIsStale`, `refusedArm`/`conflictArm`, `consentForRefusal`,
`offeredRefusalChoices`, `sendFailureOf`, `sendFailureLines`, `describeEditSave` and
`invalidationFailureMessage`. **Nothing was copied from `rawEditor.ts` or `matchEditor.ts`, and
`editorSave.ts` needed no new member** — every save decision the two new modules needed was already
there, which is the extraction of 2c-2-1 paying for itself.

### 2.2 D2 — the coalescing boundary was extracted rather than copied a second time

`typing.ts` now owns `Clock`, `TYPING_GROUP_IDLE_MS`, `TypingRun<F>` and `recordTyping`. The rule
D7 states is that a *policy* copied is a policy that drifts, and "a run of typing in one field within
seven hundred milliseconds is one undo step" is exactly a policy. `matchEditor.recordChange` is now
four lines over it and keeps only what is about its own session (the focus follows the field, a
change clears the send failure); its own coalescing tests are untouched and pass, all sixty-nine of
that file's cases with them.

What did **not** move is which actions *close* a run — a blur, a change of field, a removal, a save,
an undo, a dismissal. Those are transitions of an editor, and each editor still decides its own, and
**`draft.ts` still refuses to decide any of it**.

**`draft.ts` is not unchanged, and this sentence said it was until the confirmation round** (§7,
finding 3). The first review round added two transitions to it — `withdrawnConsent` and
`retargetedDraft` — and the original wording concealed a change to the spine the raw editor and the
small editor also draft over. What is true is narrower and is worth stating in the two halves it has:
closing a typing run remains outside that module, and two explicit consent/retargeting transitions
were added to it because dropping a consent or re-pointing a base revision is a transition **on a
draft**, and the alternative was a caller reaching into a draft's fields from outside.

The names `Clock` and `TYPING_GROUP_IDLE_MS` are re-exported from `matchEditor.ts` because
`MatchEditor.svelte` imports `Clock` from there, and this step may not touch a `.svelte` file.

### 2.3 D3 — every open file is a destination, and the ineligible ones say why (consult Q5)

`destinationsOf(documents, views)` answers one `CreationDestination` per **listed** file, in window
order, each carrying its identity, its relative path, its revision, its anchors and a typed
eligibility. **The list is the summaries and not the projections** — corrected in the first review
round; see §5 finding 6 — because a file whose `get_document` refused has no projection and was
therefore absent from a list the sidebar was still naming it in, which is the silent filtering Q5
rejects arrived at from the other side. Five refusals, checked in that order:

| Reason | Read from | Why it is honest |
|---|---|---|
| `notASnippetFile` | `holdsMatches(summary)` — `kind`, not `shape` | espanso loads no snippets out of `config/`, so one written there would never fire |
| `readOnly` | `DocumentSummary.read_only` | the window's own "the editor must refuse to write this file" |
| `couldNotBeRead` | no projection is held for the file | this window read nothing, so it knows nothing else; `BrowserState.loadFailures` is where the reason itself is |
| `notParsed` | `DocumentView.parsed` | nothing is known about the shape of a file the substrate rejected |
| `noMatchList` | `top_level_keys` contains `matches` | **the same comparison `match_list_of` makes**, against the same wire field |

The first two are decidable from a summary, which is why they are asked first: a package nobody could
read is `readOnly`, a reason a person can act on, rather than the more general `couldNotBeRead`. An
unprojected destination carries the **empty revision** and no anchors, and that cannot reach the wire
because `canCreate` refuses a chosen destination that is not `eligible`.

**The core stays authoritative**, and `code.commandError.documentHasNoMatchList` must still be
handled when it comes back: this is an affordance derived from the current projection, never
authorization. Drift can only produce a surfaced refusal.

The literal `'matches'` is duplicated from `MATCH_LIST_KEY` in `src-tauri/src/commands.rs`, and the
module says so: nothing on this wire carries the name, so the alternative to repeating it is not
sharing it but *not making the check at all*, which is the silent filtering Q5 rejects.

### 2.4 D4 — the position offers three arms, and the anchor cannot outlive its file (consult Q4)

All three of `NewMatchPosition` are offered. The default is `After` **only** when the held selection
belongs to the chosen destination *and* to the revision this form holds for it; otherwise `End`. The
revision half is not decoration — an identity from an older parse of the right file is precisely the
value that resolves to a *different* snippet, which `create_match` refuses rather than resolves.

Two mechanisms, not one comment:

- `chooseDestination` **recomputes** the placement from scratch, so an incompatible anchor cannot
  survive a change of file;
- `choosePlacement` **refuses** an `after` whose anchor is not one of the chosen destination's own,
  compared on all three fields, so one cannot be installed either.

A session literal built by hand can still hold one, and `creationRefusal` answers
`anchorUnavailable` for it rather than sending it.

**Both transitions also withdraw the last attempt**, which the first review round's first finding
added and which is not decoration: the destination and the position are part of what would be sent,
consent is content-addressed to the *buffers* alone, and the buffers do not move when either does.
`chooseDestination` additionally re-points the draft's base revision at the newly chosen file's,
through `retargetedDraft` in `draft.ts`. A placement equal to the one already held is not a change,
so a control that re-emits its own value does not clear a refusal panel nobody dismissed.

### 2.5 D5 — the carriage-return gate, and the one place it improves on the small editor

Measured in this application's own WKWebView (`2c-2-2-window-reading.md` §6): a `<textarea>`
collapses `\r` and `\r\n` to `\n`, and an `<input>` **deletes** the character. So no control this
form will have can produce one, and the gate exists for **the caller TypeScript cannot stop**:
`NewMatch` carries no brand, unlike `RoundTripText`, so a well-typed caller can put a `\r` in one.

It is enforced twice — `editCreationField` refuses one on the way in, and `beginCreate` refuses to
send one on the way out, reading the **derived candidate**. Unlike `matchEditor.beginSave`, which
answers a bare `null` and whose own header says it *cannot explain itself*, this refusal has a code:
`creationRefusal` answers `carriageReturn`, so a screen can say why the button does nothing.

### 2.6 D6 — deletion is two phases in the tested value (consult Q2)

`requestDelete` / `cancelDelete` / `confirmDelete`. The reason a confirmation is needed at all is
that the protocol's acknowledgement round trip engages **only for a finding-bearing candidate**, so a
clean deletion of an ordinary snippet collects consent nowhere; without this, one click writes the
user's file with no in-app undo, and restore-from-backup is 2c-5 and does not exist.

- `confirmDelete` is the only thing **in that module** that produces a `StartedDeletion`, which is
  the value carrying what the command takes. A caller holding no pending request gets `null`.
  `StartedDeletion` is a structural interface with no brand, so a caller can still write one by
  hand; what is closed is that no transition there yields one without a confirmation.
- The pending consent is issued by `requestDelete` alone, brand-checked the way `draft.ts` brands
  `DraftConsent` (a `unique symbol` this module never exports), and carries the `MatchId` it was
  given for. `confirmDelete(session, projected)` compares **four values on all three fields** — the
  pending consent, the session's own identity, the draft's candidate and the identity the current
  projection gives the snippet. The fourth is the only one that comes from outside the session, and
  therefore the only one that can notice a reprojection: this record's first version claimed the
  first three sufficed, and they do not, because they are minted together and go stale together
  (§5 finding 5).
- The confirmation is **consumed** by `confirmDelete`. Consent is for one attempt: a refusal that
  comes back with findings is acknowledged and then confirmed again, which is the shape every other
  acknowledgement round trip in this application has.

**What no type forces**, in the same sentence as what one does: nothing stops a component importing
`deleteMatch` from `../ipc/commands` and calling it with no confirmation at all — the hole
`saveMatch`, `moveMatch` and `saveRawDocument` have had since 2b-2a — and `projected` is an ordinary
`MatchId`, so a caller that hands `session.match` straight back gets the old behaviour and no
warning. What is closed is that *this module* produces nothing to send without a confirmation bound
to the snippet being deleted, and that a caller reading the live projection, which is the only source
of that argument a screen has, cannot spend one across a reparse.

### 2.7 D7 — a deletion holds a `Draft<MatchId>`, and nothing is drafted

The acknowledgement round trip is defined over a draft: `acknowledgeRefusal` checks the submission's
base revision against the draft's, checks that the draft still holds the candidate that was sent, and
derives the acknowledgement from the refusal itself. A deletion has exactly one candidate — *this
snippet, at this revision* — so that is what the draft holds. It never changes; the history stays
empty and `isDirty` is always `false`.

So the draft here is the **carrier** for the base revision, the candidate and the consent, which is
the triple the protocol is defined over. That is what keeps `acknowledgeRefusal` the only producer of
consent in this application; a deletion-shaped acknowledgement path would have been a second place
for that rule to be relaxed.

### 2.8 D8 — the last snippet is refused by the value *and* by the core (consult Q6)

`deletionEligibility(document, match)` refuses `lastSnippet` when the projection shows exactly one
snippet, so nobody is walked through a confirmation for an operation already known to fail. It is
written down as an **affordance derived from current state, not as authorization**: the core refuses
the same thing with `saveFailed` carrying the engine's own reason, and if the two ever disagree the
command's refusal is what the person sees. `BrowserState.deleteMatch` does **not** repeat the check,
deliberately — a wrapper that refused would be a second authority.

Two more refusals, and one that was deliberately **not** added:

- `readOnly`, from the projection's own field;
- `notInDocument` — the snippet and the file are checked against each other, which is 2c-2-2's High
  finding one level up: they are one fact, and a caller passing a second value straight from the live
  selection type-checks perfectly and can be wrong;
- **no `notEditable`.** `matchEditor.ts` consults `matchEditability` as defence in depth because a
  hazard is a statement about rewriting a value *in place*. `delete_one_match` in
  `src-tauri/src/commands.rs` takes no such gate — it resolves the item and hands a `RemoveItem` to
  the save transaction — so refusing here would be this form inventing a refusal the core does not
  make, and blocking a legal deletion. Recorded as hole 6 rather than guessed at.

### 2.9 D9 — what a commit leaves behind, in both modules

A committed create makes every `MatchId` in that file stale, **including every anchor the form holds
and the revision beside them**; a committed deletion does the same, this session's own identity
included. So each spends its value: `MatchCreationSession.committed` and
`MatchDeletionSession.deleted` are set by a commit and cleared by **nothing** — not by dismissing the
outcome panel, which is where `matchEditor.ts`'s `needsReprojection` was found to be wrong at 2c-2-2.
Only `startMatchCreation` / `startMatchDeletion` over freshly projected documents produce a value
that can act again.

`MatchCreationSession.created` holds `SavedResult.moved`. **`null` is legal on a committed create** —
the wire says the command answers no identity when the file changed again between the write and the
read that followed it — so a screen offering *open the new snippet* has to be able to draw that case.

### 2.10 D10 — the two wrappers, and the selection rules that are theirs alone

Both answer `MatchSaveAnswer`, never `SaveResult | null`, and both perform their adoption **before
the answer is handed back**. Both take the `mayHaveWritten` path exactly as `saveMatch` does —
`forgetTextOf`, re-read, `readFileText` — and both drop everything they hold for the file
(`forgetTheReplacedDocument`) when a committed save's own re-read fails, carrying
`adoption: { kind: 'failed' }` **beside** the committed outcome.

**Create.** The selection moves to the created snippet, under two conditions that are the wrapper's
own decision:

1. the held selection must be **exactly what it was when the call started** — the same protection
   `saveMatch`'s fourth review finding produced, restated for an operation that has no held target.
   A person who clicked another snippet while the create was in flight is not dragged away from it.
   The comparison is object identity, because `selected` is replaced whole by every path that changes
   it, and it answers `true` for the ordinary case where nothing was selected at all;
2. the sidebar must be showing a scope that **contains** the new snippet — "All", or that same file.
   Selecting a snippet the middle pane is not listing would leave the window pointing at a row nobody
   can see.

Otherwise the selection is repaired the ordinary way (positionally and then checked, R27).

**Delete (consult Q1).** `moved` is `null` permanently, so there is nothing to adopt. After the
re-read:

- when the held selection **was** the deleted snippet, the snippet now at its former **ordinal**
  position is selected, falling back to the new last snippet when the deleted one was last and to no
  selection when the file holds none, with the new `deleted` notice;
- when it was a **different** snippet of that file, `repairAfter` runs and this path does not touch
  it.

**Why the first is not the positional reasoning `moved: null` forbids**, stated in the code as well
as here: nothing preserves or re-resolves the stale identity. The projection is replaced whole, the
window looks at the fresh one, and the snippet it selects is adopted under its **own new identity**,
minted by the read that has just happened. What separates it from R27's `differentMatch` — where a
different snippet at the held position drops the selection — is that R27 is about a file that moved
**under** somebody, and this is the change they asked for. The consult's own counter-argument (that
selecting a neighbour may read as continuity with something that no longer exists) is why the notice
is shown at all.

`SelectionNotice` gains a fifth arm rather than reusing `differentMatch`, `selectionNoticeKey`'s
`switch` gains its case, and both dictionaries gain `browser.notice.deleted`.

### 2.11 D11 — the consult's Q7 test, and what makes it worth writing

> A test that commits a deletion whose `moved` is `null`, changes **every** surviving `MatchId` in
> the returned projection, and asserts that no pre-commit identity remains anywhere in the view or
> the selection.

`keeps no pre-commit identity anywhere after a commit that answered none` in `workspace.test.ts`.
The fixture pair (`crowdedDocument` → `thinnedDocument`) changes the revision **and** every node
number, so a fixture whose surviving identities happened to stay equal cannot make a stale-reference
bug pass. The assertion compares all three fields as one string, because a comparison that dropped
the revision would call two identities equal across the very reparse the revision exists to separate.

Three of this step's assertions were checked by mutation rather than trusted: removing the deleted
branch of `adoptAfterTheDeletion` fails three cases, dropping the scope condition fails one, and
dropping the "the selection has not moved since" condition fails one.

---

## 3. Verification

| Command | Result |
|---|---|
| `npm run check` | exit 0 — 399 files, 0 errors, 0 warnings |
| `npm test` | exit 0 — **1116 tests over 40 files**, from 1020 over 38 |
| `npm run build` | exit 0 — **161 modules**, from 158 |

Re-run after the first review round (§5) and again after the confirmation round (§7), unchanged in
every respect but the test count: the first round added thirteen tests, the confirmation round four,
and **neither added a source module**, so the guard is still 161. The four are three new deferred
cases in `workspace.test.ts` and one that came from splitting `moveMatch`'s base-revision case into
an arguments case and a stale-submission case.

**The module guard moved by exactly three, which is the number of new source modules**: `typing.ts`,
`matchCreation.ts` and `matchDeletion.ts`. All three reach the bundle because `src/lib/i18n/index.ts`
imports the three key builders, and every component imports that. The count was checked for the
*shape* of the change rather than the number, which is the rule `CLAUDE.md` §6 states: the bundle
contains no `svelte/internal/server` and no `node:async_hooks`, so this is three new modules and not
the `resolve.conditions` regression. `vite.config.ts` is untouched.

`cargo test` was not run and nothing under `crates/` or `src-tauri/` was modified: this step wrote no
Rust.

---

## 4. Holes this step leaves open

1. **No screen.** Nothing here has been rendered. Per `1c-1-notes.md` hole 1 and 2c-1b's own
   conclusion, a green suite is not a screen: **step 2 still owes the mounted-component test and the
   window reading**, and both of `2c-split-notes.md` §7's other two kinds of evidence are unmet.
   Only the model tests exist.
2. ~~**A file the window could not project is not offered as a destination at all.**~~ **Closed in
   the first review round** (§5 finding 6). `destinationsOf` now takes the document summaries as well
   as the projections and answers one destination per **listed** file; a file with no projection is
   offered with the typed reason `couldNotBeRead`, whose sentence is in both dictionaries and is
   rendered through `tDestinationRefusal` like every other. What is left is not a hole in this module
   but a step-2 dependency: `BrowserState` exposes `documents` and `loadFailures` and **exposes no
   projection list**, so a component cannot call `startMatchCreation` without one being added
   (§6).
3. ~~**The model's base revision is not what the wrapper sends.**~~ **Closed for creation and
   deletion in the first review round** (§5 finding 2), and this hole's original text was *wrong*
   rather than merely incomplete: it argued that when the model's base and the wrapper's disagreed
   "the command's own conflict check is what decides", and nothing decided it — the original base
   never reached that check, because the wrapper replaced it with `view.revision` before sending.
   A form opened at R0 over a window that had since reprojected to R1 was therefore submitted *as
   though it had been drafted at R1*, and the core found no conflict to report. `BrowserState`
   `createMatch` and `deleteMatch` now take a `baseRevision` and forward it unchanged.

   **`moveMatch` was closed in the confirmation round** (§7, finding 2), and the paragraph that used
   to stand here was this file's third instance of its own worst defect class. It said the twin was
   deferred "because closing it changes a published signature whose only caller is a component this
   step may not touch", and named `DetailPane.svelte` line 435 as "the one caller of each". That
   component calls only `browser.saveMatch`; **`BrowserState.moveMatch` had no production caller at
   all**, so nothing about a `.svelte` file was standing in the way of fixing it and the recorded
   reason for not fixing it was false. It now takes a `baseRevision: ContentRevision` between `after`
   and `acknowledgement` and forwards it to `commands.moveMatch` unchanged.

   **`saveMatch`'s half is still open and is genuinely step 2's**, with the true reason: it really
   does have a component caller. `BrowserState.saveMatch` still reads `view.revision` at the moment
   of the call, and closing it means adding a `baseRevision: ContentRevision` parameter between
   `draft` and `acknowledgement`, forwarding it in place of `view.revision`, and editing
   `DetailPane.svelte` line 435 — which passes `(id, draft, acknowledgement)` through to
   `MatchEditor.svelte` and must instead pass the submission's own base,
   `matchEditor.baseRevisionOf(session)`. That function exists, is exported, and is **unused by the
   running path** for exactly this reason.
4. **A conflict is terminal in both new modules**, with *Keep editing* as the only way out. Same
   reason as 2c-2's D6: the alternatives are 2c-4a's, and a rough version here would make that phase
   look already done.
5. **Nothing forces a caller to re-seed** after a commit, or to read `adoption`. Both are values on
   the answer rather than console lines, which is what a type can do here and the whole of what it can
   do. A component that draws no way to re-seed leaves a person with a form that has stopped
   accepting changes — a dead end rather than a data risk.
6. **Deletion does not consult `matchEditability`** (D8). If it turns out that the save transaction
   refuses to delete out of a hazardous file, this form will walk a person through a confirmation for
   an operation that is refused; the refusal is surfaced, so the failure mode is a wasted click and
   not a bad write.
7. **A component can still bypass both wrappers.** `src/lib/ipc/commands.ts` exports `createMatch`
   and `deleteMatch`, and nothing in TypeScript, `svelte-check` or the three lint scanners stops a
   `.svelte` file importing them directly and skipping the adoption and the confirmation. **No
   component imports that module at all today** — the `.svelte` files reach `../ipc/types` and
   `../ipc/errors` and nothing else of that directory, which is stronger than the "for anything but a
   type" this hole claimed before the confirmation round checked it, and is still a fact about the
   code as written rather than a guarantee.
8. **`BrowserState.moveMatch` still carries the three latent shapes** `PROGRESS.md` records: a
   `SaveResult | null` return where the other four writing methods answer `MatchSaveAnswer`, a stale
   projection left installed when its own re-read fails where `saveMatch` drops it, and
   `forgetFileText` where `forgetTextOf` belongs, so a conflict capture for that file is never
   dropped. **The fourth — a substituted base revision — was closed in the confirmation round** (§7,
   finding 2) and is no longer one of them.

   **The reason the other three are still open is that they are 2c-3b's scope, and it is not that a
   component blocks them.** That was checked rather than assumed: no `.svelte` file calls
   `browser.moveMatch`, so all three could be changed here without touching one. They are left
   because each is a decision about the answer a *move UI* consumes — what a caller is handed, and
   what the window shows when a committed move cannot be re-read — and 2c-3b is the sub-phase that
   puts a move on a screen and can decide them with that screen in front of it. Changing them now
   would settle 2c-3b's questions from a sub-phase that cannot see them.
9. **The Spanish sentences are checked by the parity tests and the untranslated-value heuristic
   only**, which is `2c-1b-notes.md` §8.8 unchanged. Eighteen new ones were written this step —
   seventeen, plus `browser.matchCreation.destination.couldNotBeRead` from the review round.
10. **`typing.ts` has no test file of its own.** Its every branch is driven through its two callers —
    `matchEditor.test.ts` for the collapse and the bound, `matchCreation.test.ts` for the join, the
    idle boundary, the blur and the change of field — and the extraction is byte-for-byte the code
    those tests already passed against. A direct suite would be duplication today and worth having the
    moment a third caller appears.
11. **The creation form's destination list is a snapshot.** It is derived once, at
    `startMatchCreation`, so a file the window projects or re-projects while the form is open is not
    reflected in it. The consequence is bounded by D9 — a commit spends the form — and by the
    command's own conflict check, which since §5 finding 2 really is reached with the form's own base
    revision: a long-lived form over a window that has moved on offers a revision that is no longer
    current, and is told so as a conflict rather than being silently rebased onto the newer parse.
12. **`fixtures.makeDocument` now derives `top_level_keys`.** The default is `['matches']` for a
    parsed non-profile and `[]` otherwise, which is a *plausible* transcription of what Rust projects
    rather than a measurement of it — the same standing caveat the file's own header makes about
    `search_text` and `source_text`.

---

## 5. The first review round

`docs/reviews/phase-2c-3a-1-code.md`, `READINESS: NOT READY`, six findings: three High, two Medium,
one Low. All six are closed below. **Two of them were this project's own named worst defect class —
a decision record or a doc comment asserting a guarantee the code does not enforce** — and both were
in *this file*, not only in the code: §4's hole 3 argued that a disagreement about the base revision
was decided by the command's conflict check, and §2.6's D6 said a re-projection could not carry a
stale confirmation. Neither was true, and no test could have failed for either.

### 5.1 Finding 1 [High] — creation consent survived changes to the transaction it authorized

**What it was.** Consent is content-addressed to the drafted *buffers*, and `chooseDestination` and
`choosePlacement` change neither. So a create refused in file A could have its findings accepted, be
redirected to file B or to `Front`, and `beginCreate` would send that same acknowledgement — a
transaction nobody was shown, authorised by findings about another one. `matchCreation.ts`'s comment
at the draft's seeding *claimed* the base revision moved with the destination; it did not.

**What closed it.** `withdrawnSubmission` in `matchCreation.ts`: both transitions drop the submitted
value, the outcome and the lines beside it, and both hand in a draft whose consent has been withdrawn
— `retargetedDraft(draft, revisionOf(...))` for a change of destination, which also re-points the
base revision, and `withdrawnConsent(draft)` for a change of position. Both are new transitions in
`draft.ts`, so nothing outside that module reaches into a draft's fields to do it. A placement equal
to the one held is not a change, so re-emitting a control's own value clears nothing. Three tests,
including the one the review named: acknowledge a refusal, retarget, and assert the acknowledgement
that would be sent is empty.

**`retargetedDraft` is deliberately not called a rebase.** That word means *reapply a draft to a
newly parsed document* and belongs to 2c-4b; this changes only the revision the value is drafted
from, and the value is untouched.

### 5.2 Finding 2 [High] — the wrapper silently rebased a stale form

**What it was.** `BrowserState.createMatch` and `deleteMatch` read `view.revision` at the moment of
the call and sent that, ignoring the base the form or the session was opened at. Open a form at R0,
let anything reproject the file to R1, submit: the core saw R1, found no conflict, and could commit
into a parse the person never saw — with the anchor resolved in it. For deletion it was worse in a
different way: a stale R0 identity travelled beside a fresh R1 base, so the answer was an identity
failure rather than the revision conflict that describes what happened.

**What closed it.** Both methods take a `baseRevision` and forward it unchanged; the `view` lookup
stays, because without a projection this state can neither adopt what a commit produces nor tell
whether its own projection went out of date. Two tests assert the wrapper sends what it was given
while projecting something else. **§4 hole 3's text is corrected above**, and the twin —
`saveMatch`, `moveMatch` and `matchEditor.baseRevisionOf` — is recorded in §6 as step 2's, because
closing it edits `DetailPane.svelte`.

### 5.3 Finding 3 [High] — an identity resolved across revisions by node alone

**What it was.** `positionOf` in `selection.ts` compares the arena node and nothing else, which is
right for its original caller and wrong for an adoption: `moved` is minted in the revision the
*transaction* ended on, and the projection an adoption looks in comes from a `get_document` issued
afterwards. A file another program rewrote in between produces a parse that can reuse the node — and
the window then selects an unrelated snippet as the one just created or just saved.

**What closed it.** `positionInSameParse` in `workspace.svelte.ts`: the same lookup with the document
and the revision compared first, used by `adoptTheCreatedSnippet` **and** by `adoptTheDocumentOnDisk`,
which serves `saveMatch` and `moveMatch`. A mismatch falls through to ordinary repair (R27). Two
tests, one per adoption, each with a fixture whose fresh parse reuses the node the save answered
with. `positionOf`'s own header now names the caller its assumption is false for.

### 5.4 Finding 4 [Medium] — save adoption did not cancel an in-flight selection lookup

**What it was.** `select()` verifies its identity across the boundary, and that answer can land after
a commit has replaced the projection it was taken from. Its repair then re-points the selection
positionally: after a deletion it replaced the mandated `deleted` notice with `differentMatch`, and
after a create it dragged the person off the snippet they had just made.

**What closed it.** One line in `installView`, and the place was chosen by reading every caller
rather than by convenience: the three adoptions and `adoptTheReplacedDocument` install what a commit
produced, the five conflict arms install what the command read under its own lock and repair the
selection immediately afterwards, and `applyRepair` — the one caller inside `select()` — runs after
that call's own generation check and before nothing, so the bump cancels only *other* lookups. None
of the adoptions awaits between the call and its selection assignment, so nothing can land in
between. `forgetTheReplacedDocument`'s bump became unconditional beside it. Two deferred-`getMatch`
tests, one for create and one for delete.

**The place was right and the width was wrong, and that is the confirmation round's High finding**
(§7, finding 1). The line bumped one **global** counter, so a projection replaced in file B cancelled
a selection lookup in file A that the replacement said nothing about — and A was then left holding a
`MatchId` that resolves to nothing, which is the failure this whole sub-phase is written against. The
enumeration above is what made it look safe: every caller listed really does want its *own*
document's lookups cancelled, and the list says nothing about the other documents each call is not
concerned with. Both bumps are now per document, with a separate selection-intent counter beside
them; §7 has the mechanism and the three tests.

### 5.5 Finding 5 [Medium] — a reload did not invalidate pending deletion consent

**What it was.** `confirmDelete` compared the pending identity with the session's own. Both are
minted by `startMatchDeletion`, so a session a caller keeps holding while the workspace re-reads the
file has two stale halves that go on agreeing — nothing in the comparison observed the world. The
test that claimed to cover it manufactured a changed `session.match`, which a reload does not
produce, so it passed for a different reason than it stated.

**What closed it — option (a), enforcement.** `confirmDelete(session, projected)` takes the identity
the current projection gives that snippet, or `null`, and requires it to agree with the pending
consent, the session's identity and the draft's candidate. The new test drives the **retained-session**
path: the session is untouched, a re-read fixture changes the file, and the confirmation is refused;
a second case covers a projection that no longer holds the snippet at all. What this cannot force is
written in the module header and in D6: a caller that hands `session.match` back defeats it, and no
type can say where an argument came from.

### 5.6 Finding 6 [Low] — not every open file was offered

**What it was.** `destinationsOf` mapped the projections, so a file whose `get_document` refused was
absent from the destination list while the sidebar went on naming it — the silent filtering the
consult's Q5 rejects, reached by leaving a file out rather than by hiding a row.

**What closed it.** `destinationsOf(documents, views)` maps the **summaries**, and a file with no
projection is offered with the fifth typed refusal, `couldNotBeRead`, whose sentence is in `en.json`
and `es.json` and reaches a screen through `tDestinationRefusal` like every other. The first two
checks were moved onto the summary so that a package or a profile nobody could read still gets the
reason a person can act on. §2.3 and §4 hole 2 are corrected above.

### 5.7 Three more claims corrected while checking the rest

Neither the review nor a test found these; they were found by re-reading every doc comment this round
touched and checking each sentence against the code.

- `matchDeletion.baseRevisionOf` said the wrapper "sends the revision of the projection it holds",
  which finding 2 made false. It now says what is enforced — nothing downstream substitutes another —
  and, in the same sentence, that no type stops a caller passing a different one.
- The seeding comment in `startMatchCreation` said the draft's base "is what a caller sends". No
  caller exists yet; what is true is that nothing between the form and `create_match` replaces it.
- `forgetTheReplacedDocument`'s new unconditional bump was described as closing a reachable failure.
  It is not reachable today, and the comment now says so and says why the line is kept anyway — the
  same shape as the `fileText` identity guard's own note. **The confirmation round rewrote that
  comment again** (§7, finding 1): the bump is still unconditional and is now scoped to the document
  being dropped, and what the comment can no longer claim is anything about lookups into other files.

---

## 6. What this round leaves for step 2

Three items, each named exactly, because each needs a `.svelte` file this step may not touch:

1. **The `saveMatch` base-revision twin** — the change and its one caller are spelled out in §4
   hole 3. **`moveMatch` was on this list and is not any more**: the confirmation round found that
   the component this item names calls only `browser.saveMatch`, so `moveMatch` never needed a
   `.svelte` edit and was fixed in place (§7, finding 2).
2. **A projection accessor on `BrowserState`.** `startMatchCreation(documents, views, held, clock)`
   needs the projections, and `BrowserState` exposes `documents`, `loadFailures`, `scopedDocument`
   and `scopedMatches` but no list of `DocumentView`. Step 2 adds one — a `views` getter is the
   obvious shape — or the form cannot be seeded from a component at all.
3. **Where `confirmDelete`'s `projected` argument comes from.** It must be read from the live
   projection at the moment of the click — `BrowserState.selectedMatch?.id`, or the same lookup in
   the file the session names — and not from the session. Passing `session.match` type-checks and
   silently restores the defect finding 5 closed.

---

## 7. The confirmation round

`docs/reviews/phase-2c-3a-1-confirmation.md`, `READINESS: NOT READY`, three findings: one High, one
Medium, one Low. It re-checked the six of §5 and confirmed five closed and one **partly** closed. All
three are closed below.

**The High was a regression this project's own fix round introduced, and recording it as a fresh
discovery would misstate how it got there.** §5's finding 4 was real and its fix was real; what the
fix did beside it was widen a narrow invalidation into a global one, and the widened half broke the
thing the sub-phase exists to prevent. The honest framing is that the first round traded one race for
another, and that the trade was invisible because every deferred test it wrote used the **same**
document for both operations — so a green suite said nothing about the ordering that was broken.

**Two of the three were this file asserting something the code contradicts**, which makes five
instances of this project's named worst defect class in this one sub-phase — three found by the first
review, two by the confirmation pass, and none by any test. That number is the finding: a decision
record is not checked by anything, and the only procedure that catches these is reading each sentence
against the code with the code open.

### 7.1 Finding 1 [High] — one generation counter for two different questions

**What it was.** `installView` and `forgetTheReplacedDocument` both incremented a single
`selectGeneration`, whatever document they were about. The reviewer's ordering: start a raw save of
file B, click a snippet of file A while B's save is pending, let B commit. B's invalidation bumps the
counter without touching the selection, so when A's deferred `get_match` comes back saying its R0
identity is stale, `select()` returns at its generation check without repairing it — and the state
keeps a `MatchId` that no longer resolves. A conflict or an adoption installing an unrelated document
does the same. The doc comment on `installView` enumerated its eleven call sites and argued each one
"wants" the bump; the enumeration was true of each caller's **own** document and silent about every
other, which is exactly the gap.

**What closed it — two counters, asking two questions.**

- **A projection generation per document**, `projectionGenerations` in `workspace.svelte.ts`, bumped
  by `invalidateProjectionOf` from `installView` (for `next.id`) and from `forgetTheReplacedDocument`
  (for the file it drops), and by nothing else. It answers *has the parse this identity was minted
  from been replaced?*
- **The selection-intent generation**, `selectGeneration`, kept global and now bumped by
  `replaceSelection` — through which **every** write to `selected` goes except `select()`'s own,
  which bumps at entry instead because a call may not cancel the lookup it is about to take. It
  answers *does anybody still hold the intent this lookup is serving?*

`select()` captures both and drops its answer when either has moved, through one
`selectionLookupIsStale` used at both of its checks. `open()` bumps the intent counter globally —
every projection is about to go — and clears the per-document map, because a document identity is
reallocated by the load that follows and a kept entry would be a count of replacements of a different
file.

**Neither counter implies the other, and that is why both are kept.** A create committing in file B
can move the selection to the snippet it just made while a lookup for file A is in flight: A's
projection is untouched, so only the intent counter sees it. A projection replaced under a lookup for
that same file is seen by both — the two coincide there, and that is written down rather than relied
on, because it is an invariant spread across five functions and not a property of either mechanism.

**Three tests, in `workspace.test.ts`'s new "what cancels a selection lookup, and what does not"
suite**, and each was mutation-checked rather than trusted:

| Test | Mutation that fails it |
|---|---|
| `repairs a stale identity in one file when another file is replaced whole` | make `invalidateProjectionOf` bump `selectGeneration` again — the exact pre-fix mechanism. It fails, and it is the **only** case in the file that does |
| `drops a stale identity lookup when the file it names is the one replaced` | make `selectionLookupIsStale` answer `false` — the cancellation removed. It fails, with five older cases |
| `drops a stale identity lookup when another file's create takes the selection` | drop the bump from `replaceSelection`. It fails alone |

**And one probe that deliberately does *not* fail, reported because it is the honest shape of the
mechanism**: dropping only the projection half of `selectionLookupIsStale` leaves all 109 cases green.
Same-document cancellation is over-determined — a projection replaced under a selection in that file
always ends in a selection assignment too — so the projection counter is what makes the cancellation
*structural* rather than what makes it happen.

**The third-pass review answered that probe, and the answer is stronger than "untested"** (§8): the
projection comparison is redundant in **every reachable ordering**, not only in the ones this suite
walks, so there is no missing test that could isolate it and none should be written pretending to. The
argument is in §8.2. What the cross-document test kills is the *scoping of the intent bump* — the
first mutation in the table above — which is a different thing from the projection comparison being
read. The comparison is kept as defensive redundancy, and this paragraph says so rather than
implying a coverage gap that does not exist.

### 7.2 Finding 2 [Medium] — a deferral justified by a caller that does not exist

**What it was.** §4 hole 3 said fixing `saveMatch` and `moveMatch` "changes a published signature
whose only caller is a component this step may not touch", and named `DetailPane.svelte` line 435 as
"the one caller of each". Line 435 passes `(id, draft, acknowledgement)` to `browser.saveMatch` and
nothing else; a search of the repository finds **no production caller of `BrowserState.moveMatch` at
all**, and `matchEditor.baseRevisionOf` is likewise unused. So `moveMatch` went on substituting
`view.revision` for a base revision nobody supplied, holding the defect §5's finding 2 closed for the
other two — a move decided against R0 and submitted after the window reprojected to R1 is sent as
though decided at R1, and comes back as an identity failure rather than as the revision conflict that
describes the event.

**What closed it.** `BrowserState.moveMatch` takes a `baseRevision: ContentRevision` between `after`
and `acknowledgement` and forwards it unchanged, exactly as `createMatch` and `deleteMatch` do. No
`.svelte` file was touched, because none had to be. Its ten test call sites carry the revision, and
its old base-revision case is now two: an arguments case, and
`sends the caller's own base revision, never the one it is projecting`, which submits `'rev-older'`
while the state projects `'rev-a'` — the twin of the create and delete cases §5 finding 2 added.

**`saveMatch` stays with step 2, with the reason that is true**: it really does have a component
caller, and closing it edits `DetailPane.svelte`. §4 hole 3 and §6 item 1 are corrected above.

**And `moveMatch`'s other three latent shapes are re-recorded with a reason that is true** (§4 hole
8). They are not blocked by a component — that was checked, and nothing calls `browser.moveMatch` —
they are 2c-3b's scope: each is a decision about what a move UI is handed and what the window shows
when a committed move cannot be read back, and 2c-3b is the sub-phase that will have that screen in
front of it.

### 7.3 Finding 3 [Low] — the record said `draft.ts` was unchanged after changing it

**What it was.** §2.2 ended "`draft.ts` is unchanged and still refuses to decide any of it", which
contradicts both the diff and this file's own §5.1: the first fix round added `withdrawnConsent` and
`retargetedDraft` to it. The functions are safe — the confirmation review says so, and says the raw
and small editors do not reach them — but the claim concealed a change to the spine all three editors
draft over, which is the regression surface the review was asked to inspect.

**What closed it.** §2.2 now says the two things separately: closing a typing run remains outside
`draft.ts`, and the fix round added two explicit consent/retargeting transitions to it, because
dropping a consent and re-pointing a base revision are transitions **on a draft** and the alternative
was a caller reaching into a draft's fields from outside.

### 7.4 One more claim corrected while re-reading the record against the code

Found the way §5.7's three were, by reading each sentence with the code open rather than the other
way round.

- §4 hole 7 said "Today no component imports that module for anything but a type", of
  `src/lib/ipc/commands.ts`. **No component imports it at all**: every `.svelte` file's imports out of
  `src/lib/ipc/` are from `types.ts` and `errors.ts`. The sentence was written to sound like a
  measurement and implied a coupling that is not there. Corrected above, and the point it was making
  survives unchanged — the door is open and nothing but the code as written keeps it shut.

Everything else in §2 was re-checked and stands: the two carriage-return gates
(`editCreationField` at the buffers, `beginCreate` at the derived candidate), `confirmDelete`'s four
identities compared on all three fields, `destinationsOf` mapping the **summaries** in window order,
the eighteen dictionary keys and their three typed accessors, the deletion draft that nothing edits,
and `BrowserState.deleteMatch` not repeating the last-snippet refusal.

---

## 8. The third pass

A third Codex review was commissioned after the confirmation round, scoped to **one thing only**:
the change that closed §7.1. The reason is the history rather than a suspicion — the first review's
finding was closed by a fix that became the second review's finding, and the second was closed by a
refactor of the same hot path, one that serves every operation in this application rather than only
this step's two. A third round of the same machinery is where a third regression would be.

It is `docs/reviews/phase-2c-3a-1-third-pass.md`, and it returned `READINESS: NOT READY` with **one
Low finding and nothing else**.

### 8.1 Finding 1 [Low] — the invariant comment claimed one exception when there are two

**What it was.** `replaceSelection`'s doc comment said "Every write to `selected` goes through here
except `select()`'s own". There are **two** direct assignments outside it: `select()`'s, and
`open()`'s. Both are safe — `open()` bumps the intent counter before clearing the map and the
selection — but the sentence stated an exhaustive invariant that was not exhaustive, in the one place
a maintainer would go looking for permission to add a third.

**Why it is the same defect class as §7.2 and §7.3.** A claim wider than the mechanism, in a comment,
about a guarantee nothing enforces: `selected` is a `$state` binding in module scope, so a third
direct assignment would type-check and would strand exactly the lookup the function exists to cancel.
Three of this step's ten findings across three rounds were this class, and no test failed for any of
them.

**What closed it.** The comment now enumerates **both** exceptions with the reason each is safe, and
says in the same sentence that the list is maintained by hand and that TypeScript enforces nothing
here.

### 8.2 What the pass confirmed, and the one thing it settled

Nothing else was found, and the pass's negative results are worth as much as its finding because they
were derived rather than assumed:

- **All eleven `installView` call sites have the correct document scope** — the two `applyRepair`
  arms, the five conflict arms, and the four adoptions. None replaces identities belonging to another
  document, so scoping the projection counter per document is not too narrow.
- **All four `forgetTheReplacedDocument` call sites likewise.** Dropping file B neither invalidates
  A's projection nor cancels A's lookup, unless that operation deliberately replaces the selection —
  in which case the intent counter is what sees it.
- **`open()`'s clear is safe**, traced as an interleaving rather than argued from the comment: a
  lookup captures intent `n` and projection `p`; `open()` moves the intent to `n + 1` and clears the
  map. Even if the next workspace reuses the same numeric document identity and its projection
  generation reads `p` again, the lookup still fails on the intent. **The intent counter is never
  reset**, and that is what makes the clear safe.
- **The `?? 0` default for an unseen document is safe.** Initial loading does not populate the map, so
  a selection can capture generation zero; that document's first `installView` sets it to one, and the
  comparison is unequal.

And the one thing it settled, which §7.1 had left open as an honest probe: **the projection half of
`selectionLookupIsStale` is redundant in every reachable ordering, not merely in the tested ones.** A
live lookup synchronously makes its document the held selection before it awaits; every same-document
`installView` caller then synchronously repairs or replaces that selection, and
`forgetTheReplacedDocument` drops it — each of which bumps the intent counter. If the selection had
already moved elsewhere, that movement bumped it too. So there is no ordering in which only the
projection comparison catches staleness, and **no honest test can isolate it**. It is kept as
defensive redundancy and is now described as that, rather than as a mechanism carrying a coverage gap.

That distinction matters for the next person who tries to simplify this: the per-document map is
load-bearing on the **scoping of the intent bump** — reverting `invalidateProjectionOf` to a global
bump fails the cross-document test, and only that test — and is *not* load-bearing on the comparison
it feeds. Deleting the comparison would break no test today. That is written here so that deleting it
is at least a decision.
