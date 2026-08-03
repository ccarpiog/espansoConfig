# Phase 2c-2 step 1 — decision record

**The small editor's model layer and its command wiring. No component, no `.svelte` file, no
screen, no window reading.** A later step of 2c-2 draws what this decides.

The authority for the six decisions below is `docs/reviews/phase-2c-2-design.md` — the design
consult for this exact sub-phase — whose six numbered recommendations are what this step
implements. Where this record and that document disagree, the consult is right and this is a bug.

---

## 1. What this step built

| File | What it is |
|---|---|
| `src/lib/browser/matchEditor.ts` | the whole small editor as a value: eligibility, the field draft, coalescing, the submission and the outcome |
| `src/lib/browser/editorSave.ts` | the five save decisions **extracted** from `rawEditor.ts`, because they are not about a text area |
| `src/lib/browser/draft.ts` | `amendDraft`, the transition coalescing is made of, and the one retained slot that makes it free |
| `src/lib/browser/workspace.svelte.ts` | `saveMatch` wired into `BrowserCommands`, `REAL_COMMANDS` and `BrowserState`, with identity adoption inside the wrapper |
| `src/lib/i18n/{en,es}.json`, `index.ts` | five reason codes, five sentences each language, one reactive accessor |
| `crates/espansoconfig-core/tests/model_projection.rs` | one test: an escaped `\r` really does decode into a projected logical value |

Tests: `matchEditor.test.ts`, plus `amendDraft`'s cases in `draft.test.ts` and `saveMatch`'s in
`workspace.test.ts`. **No new user-facing string was needed by either review round**: the
out-of-step line is the existing `browser.saveOutcome.windowOutOfStep`.

Two review rounds are folded in below rather than appended: `docs/reviews/phase-2c-2-model-code.md`
(five findings) and `docs/reviews/phase-2c-2-model-code-confirmation.md` (two more, **both
introduced by the first round's fixes** — the pattern 2c-1b's second pass set). Each is named at
the decision it changed.

---

## 2. The decisions

### 2.1 D1 — the projection and the draft are two values, and that is the whole phase

2c-2's stated failure mode is **a draft-versus-projection mistake**, so the two are not one
object and cannot be confused by accident:

- `MatchBaseline` — what the file held, whether it held the key at all, and whether the field may
  be edited. Not drafted, not in the undo history, frozen, moved only at a save boundary;
- `MatchBuffers` — what the controls hold and whether a removal has been asked for. This is what
  `Draft<T>` snapshots and walks backwards through.

`fieldIntent(baseline, buffer)` is the only function that reads both. The consult's Q3 is exactly
this: `DraftField` is the authoritative intent, and *absent*, *present* and *removed* are **not**
three equivalent value states.

The rule that pays for the arrangement is that an initially absent field left blank is
`'Unchanged'`. The buffer alone cannot tell that case from a present field cleared to empty, and
getting it wrong writes `label: ''` into a file that never had a label.

Two rules go slightly beyond the consult's list, and both narrow rather than widen:

- an **ineligible** field always answers `'Unchanged'`, whatever its buffer holds. Defence in
  depth: a buffer that diverged by a route this module did not sanction still contributes no edit;
- a removal of a key the file does not have is `'Unchanged'`, not `'Remove'`. Rust already treats
  `(DraftField::Remove, None)` as a no-op (`plan_field` in `crates/espansoconfig-core/src/draft/plan.rs`),
  so the two agree; what this adds is that the draft does not claim an edit it does not have —
  which is the same principle as the consult's sixth rule.

### 2.2 D2 — eligibility is a typed verdict with five reasons, computed before anything is bound

The consult's change 1. Four of the five are refusals Rust would otherwise answer *after* the
person had typed; the fifth is this application's own.

| Reason | Detected from | What it forecloses |
|---|---|---|
| `notDecodable` | `ScalarView.decoded === false` | `plan_scalar`'s `NotDecodable` |
| `carriageReturn` | `ScalarView.text` contains `\r` | the consult's Q2, below |
| `ownsNoBytes` | `span.start === span.end` | `plan_scalar`'s `TargetOwnsNoBytes` |
| `unmodelledShape` | `unknown_entries` carries the key | `plan_field`'s `FieldHasAnUnmodelledShape` |
| `triggerNotSingle` | `TriggerKind !== 'Single'` | the consult's Q5 |

**The zero-width-span question the brief asked about is settled and needed no guess.** The
projection carries `ScalarView.span` on the wire, and Rust's own test is
`scalar.span.start == scalar.span.end` — the frontend makes the same comparison against the same
numbers, so this is not an approximation of Rust's rule, it *is* Rust's rule.

`unmodelledShape` was not in the brief and is a fifth reason rather than four. A key the file
**has** but whose value is not a scalar reads as absent through the projection's field accessors,
so treating it as absent would derive an insertion of a key the mapping already holds. The
projection does carry the fact — `MatchView.unknown_entries` has the decoded key — so refusing
before the person types is possible and is the same argument Q5 makes for the trigger. A repeated
key lands there too and is refused for the same reason.

Each verdict carries a **code**, never a sentence. `fieldRefusalKey` maps it to a dictionary key
and `tFieldRefusal` in `src/lib/i18n/index.ts` renders it, following `rawEditorRefusalKey` /
`tRawEditorRefusal` exactly. The key builder is in `matchEditor.ts` rather than in `codes.ts`
because `codes.ts` bridges **Rust** codes and this is a frontend-owned one — the ownership
argument `detail.ts` already records for `detailFieldKey`.

`triggerNotSingle` deliberately carries no operand. A screen that wants to name the shape the
snippet *does* have calls the existing `tTriggerKind`.

### 2.3 D3 — the carriage return is refused twice, and the raw editor's refusal does not generalise

The consult's Q2 chose policy (i): a value containing `\r` is visibly read-only. It is enforced at
**three** points: `fieldEligibility` (a statement about the projection), `editField` (a statement
about that function, which a caller that is not a control could otherwise pass), and `beginSave`
(the last line before the wire).

The third was missing in the first version and is the review's third finding. `MatchBuffers` is a
structural record with **no brand** — unlike the raw editor's `RoundTripText` — so
`editDraft(session.draft, { …, replace: { text: 'a\rb', removed: false } })` type-checks today,
and without the save-time gate that value reached `save_match` as `{ Set: 'a\rb' }` and would have
been written into the user's file. The raw editor re-checks at the same point because a brand is a
cast at bottom; **this path has no brand at all, so it needs the gate more rather than less.**

The gate asks the **derived draft**, not the buffers, and the distinction is load-bearing: a field
refused for `carriageReturn` has that character in its baseline and therefore in its buffer,
legitimately, and its intent is `'Unchanged'`. Checking the buffers would refuse every save on
such a snippet; checking what would be written refuses exactly the values that would be written.

**What the gate cannot do is explain itself.** It answers `null`, which a screen reads as *there
is nothing to save*, and no signature here can carry a reason to a control that was never drawn
for a field this session refused. A caller that reaches it has driven the state machine through a
door the other two checks close. `FieldBuffer.text`'s own doc comment says the same thing in the
same sentence that states the invariant.

**Line breaks are not the hazard here.** A projected scalar's `text` is the decoder's output, and
the decoder normalises every source line break to `\n`; Rust re-emits using the document's own
line ending. So a text control's LF normalisation is a no-op on these values, and the only
carriage return that can reach one is an explicit escape. 2c-1b's blanket refusal of a CRLF *file*
does not transfer, and this is the reason.

That the escape is reachable at all is now measured rather than assumed —
`an_escaped_carriage_return_decodes_into_a_projected_logical_value` in
`crates/espansoconfig-core/tests/model_projection.rs` parses an inline `replace: "a\rb"` and
asserts `ScalarView.text == "a\rb"` with `decoded == true`, and asserts the *source* holds no
carriage return, so nothing in it is measuring a line ending. **No corpus fixture was added**: a
new synthetic file ripples through the corpus-wide sweeps and `SYNTHETIC_PROJECTIONS`'s pinned
counts, and an inline string exercises the same code path.

### 2.4 D4 — history is coalesced per field, which reverses 2c-1b for fields only

`docs/decisions/2c-1b-notes.md` §2.4 decided **not** to coalesce, on the ground that what one edit
means in a free-form text area is a guess. The consult's Q4 reverses that here, and the reversal is
scoped: **the raw editor is unchanged and still takes one keystroke as one step.**

The raw editor's argument does not carry over because a field has a boundary a text area does not
— it can be left. A group ends on a blur, on a change of focused field, on any structural action
(removal, restoration, save, undo, redo, dismissal), and on an idle boundary.

The **live draft still updates on every keystroke**; only the history snapshot is coalesced. That
is the consult's own framing and it is what makes this safe: nothing about what is on screen or
what would be saved depends on the grouping.

**`TYPING_GROUP_IDLE_MS = 700` is a judgement, not a measurement.** Nothing has been profiled and
no session has been timed. Seven hundred milliseconds is long enough that ordinary typing in one
field stays one undo step and short enough that stopping to think starts a new one. The cost of
being wrong is undo granularity, recoverable by pressing undo again — unlike the cost of not
coalescing, which is history entries the person cannot get back, since a moderately long `replace`
would exhaust all hundred entries of `HISTORY_LIMIT` and drop every earlier edit.

The clock is a **parameter with no default**. `startMatchEditor(match, clock)` requires one, so
`Date.now` is never named inside the model and no test has to sleep. A default would be a thing to
forget.

The mechanism is `amendDraft` in `draft.ts`, added here: it replaces the current value without
pushing a history step. It belongs in the spine because the alternative is an editor composing
`undoDraft` with `editDraft` to get the same effect by a route nobody reading it would recognise.
The spine still does not decide *when* two changes are one edit — that policy is `recordChange`'s,
in `matchEditor.ts`.

**A burst that ends where it began leaves no step**, which is the review's fifth finding. Type
three characters and erase them again inside the window and the amendment restored the value the
group started from while its history entry survived — an undo the person could press that changed
nothing on screen and only spent a step. `amendDraft` now drops the entry when the replacement
equals the step immediately before it, restoring that step's own value and generation exactly as
an undo would; two adjacent identical branch entries are not a decision anyone could want, so this
is the same transition declining to manufacture history rather than a second policy. It collapses
against **only** the immediately preceding step — an amendment back to a value further up the
branch is an ordinary amendment. `recordChange` closes the group in that case, because a group
whose step no longer exists has nothing left to amend.

**And it costs nothing at the history bound either**, which is the confirmation pass's second
finding and a defect the collapse itself introduced. With the past full, the push that *opens* a
group evicts the oldest entry; a collapse that only sliced therefore left the value where it
started and the history one state shorter — silently, since nothing on screen changed, and once
per net-zero burst. The evicted value is recoverable from nothing else the draft holds, so making
the collapse history-neutral genuinely requires **one retained slot**: `Draft.evicted` holds what
the most recent push cost, `amendDraft`'s collapse puts it back, and `undoDraft`, `savedDraft` and
`reloadedDraft` release it because each takes the branch somewhere a collapse could not follow. A
non-collapsing amendment keeps it, because a group is one push followed by any number of
amendments and the collapse may be the tenth.

That slot is the honest price, and it is stated rather than hidden: one extra `DraftStep` retained
per draft, read by exactly one function, and part of no history — undo and redo never walk into
it.

### 2.5 D5 — a committed save moves three things, and the third is the phase's own failure

`applySave` takes a bare `SaveResult`; the outcome is **not** sealed, and that is not an omission.
The seal of `invalidation.ts` exists because a whole-document replacement makes every identity in
the file stale with no single identity to answer with. A field save has one.

On a `saved` arm:

1. **the identity is adopted** — `result.moved` becomes the session's `MatchId`, so a second save
   is checked against the revision the file now holds. A commit that answered no identity sets
   `identityStale` and the session stops offering to save, because every later call would be
   refused with an identity code and offering it would be a promise this editor cannot keep;
2. **the baselines move to what was written** — a field that was `Set` is now present and holds
   that value; a field that was `Remove`d is now absent. **Without this the phase's named failure
   is live**: insert a label, save, then clear it, and the absent-and-blank rule would answer
   `'Unchanged'` and the label would stay in the file for ever. There is a test for exactly that
   sequence;
3. **the draft's base moves to the candidate that was sent**, through `savedDraft`.

Nothing is conditional on `committed`, because `committed: false` is a documented success.

**What the rebase does not refresh is eligibility.** The new scalars' style, span and `decoded`
flag are facts about bytes only Rust has seen, so the honest refresh is a re-projection.
`MatchEditorView.needsReprojection` is `true` after a commit and says so; the caller re-seeds from
the freshly projected match, which `BrowserState.saveMatch` has already fetched.

`applySave` takes the adoption's fate as a **required** third argument, for the reason the seal
takes an `issuerInvalidation`: the caller always knows it, and a default would be this function
inventing a `notOwed` for a caller that did not look. A `failed` adoption adds the existing
`windowOutOfStep` line beside the saved arm — no new string was needed — and makes the session
`identityStale`.

### 2.6 D6 — the conflict is terminal here, with one way out

The conflict arm carries the retained draft, the session stops accepting changes, and the only
choice offered is *Keep editing*. The two that are missing are missing on purpose: *Copy draft*
copies a text and this draft is six fields, and *Load the version on disk* would have to re-seed
the baselines from a fresh projection, which is conflict capture and preservation — **Phase
2c-4a** — and a rough version of it here would make that phase look already done.

**No choice is called "keep my draft"**, in either language, and a test asserts the rendered
labels. That phrase means *reapply the draft to the newly parsed document*, which is 2c-4b.

### 2.7 D7 — five save decisions were extracted, not copied

The 2c-2 checkpoint names copying as the mistake to avoid. `editorSave.ts` now holds what
`rawEditor.ts` had and the small editor needed: `EditorPhase`, `SendFailure` and its constructor,
`submissionIsStale`, `refusedArm`/`conflictArm`, `consentForRefusal` (the acknowledgement round
trip) and `offeredRefusalChoices` (the withdrawal of *Save anyway* once findings go stale).
`rawEditor.ts` delegates to all of them and re-exports `SendFailure` and `RawEditorPhase`, so its
own 46 tests and `RawEditor.svelte` are untouched.

Each of the five is a rule about consent or about honesty, and a second copy of such a rule is a
second place for it to be relaxed by somebody who only reads one of them.

The acknowledgement round trip goes through `acknowledgeRefusal(draft, submission, refusal)` and
through nothing else. `matchEditor.acknowledgeFindings` takes the submission **from the session**
rather than from an argument, so a caller cannot pair one candidate's acknowledgement with another
candidate.

---

## 3. `saveMatch`, and the honest answer about the wrapper

The consult's change 2 asks for identity adoption to be unignorable, and offers two ways: a sealed
one-shot outcome, or a single enforced wrapper with no alternative call path. **The wrapper was
chosen**, because `BrowserState` already is one and because a field save has an identity to adopt
and does not need the ceremony a replacement with none requires.

`BrowserState.saveMatch(id, draft, acknowledgement)` follows the `moveMatch` arm:
`forgetFileText()` → `adoptTheDocumentOnDisk(document, id, moved)` → `readFileText()` on a commit
or a revision that moved, the `mayHaveWritten` arm on a failure, and `installView` +
`repairAfter` on a conflict. The adoption happens **before the result is handed back**, so no
caller of this method can obtain an outcome without it having been attempted.

It takes a `MatchId` rather than a `MatchView`, unlike `moveMatch`: an editor adopts the identity
a save answers with, and there is no projection to go with it until the file is read again. The
base revision is `view.revision`, the same source `moveMatch` uses — and in the good case it
equals `id.revision`, because a stale identity is refused by the command before a base revision
matters.

### It answers `MatchSaveAnswer`, not `SaveResult | null` — the review's first finding

The first version answered `SaveResult | null`, and that `null` threw away the one bit a screen
cannot do without. A command that fails at or after its rename carries `may_have_written: true`,
and a caller that cannot tell it from `noWorkspaceOpen` will tell the person nothing was written
about a file that may already hold the edited snippet — `PROGRESS.md` D2 broken from the side
`RawSaveAnswer` was written to protect. The `failed` arm now carries `mayHaveWritten`, and
`saveCouldNotBeSent` in `matchEditor.ts` has the bit it was designed around.

### An adoption that fails invalidates *and* is carried — the review's second finding

The first version's `adoptTheDocumentOnDisk` reported a failed re-read and returned, leaving the
pre-save projection and the pre-save identities installed while a committed `saved` went back to
the caller. That is the guarantee this document claimed and the code did not give.

Both halves are now closed. `adoptTheDocumentOnDisk` **returns** the failure; `saveMatch` drops
what the window holds for that file (`forgetTheReplacedDocument` — the projection, the held
selection, and **both** text caches) rather than leaving bytes on screen that are gone, and puts
`adoption: { kind: 'failed', failure }` on the answer **beside** the committed outcome. The 2c-1a
precedent is exactly this shape. `applySave` turns it into the existing `windowOutOfStep` sentence
as an extra line beside the saved arm — never in place of it — and marks the session
`identityStale`, because with no projection of the file there is nothing an identity could resolve
against.

**"Both text caches" is the confirmation pass's first finding, and the first version of this
sentence was the claim it falsified.** There are two, keyed differently: the viewer's snapshot by
whatever the pane is pointed at, and `conflictText` by **document** — which is the whole reason
`conflictText` exists (2c-1b's fifth finding). `forgetFileText` reaches only the first, and
`rawTextOf` prefers the second, so a raw save that conflicted and captured version A followed by a
field save that committed version B left this window answering A, two writes old, with nothing on
screen to say so. `forgetTextOf(document)` now drops both and is what all three state-changing
paths of `saveMatch` call; `forgetTheReplacedDocument`, whose own comment claims to be *total for
one document*, drops the capture too, which makes that claim true as well.

The scope is deliberate and is what the test pins: another document's capture is untouched,
because nothing about it changed, and a `saved` that neither committed nor moved the revision
drops nothing, because nothing on disk moved.

**What no type forces**, in the same sentence as what one does: nothing can require a caller to
*read* `adoption`. What the type does is make the failure survive as a value on the answer instead
of as a line in a developer console, and make the two arms of the answer impossible to confuse
with each other. The decision about the stale projection is `saveMatch`'s and not
`adoptTheDocumentOnDisk`'s, because a caller that only *suspects* a write is right to keep what it
has; `moveMatch` still does, which is the behaviour it has had since 2b-2a.

### The selection is re-pointed only when it is still the snippet that was saved

The review's fourth finding. `adoptTheDocumentOnDisk` took `moved` and no notion of *which*
snippet the operation was about, so a person who saved snippet A and clicked snippet B while the
save was in flight was dragged back to A when the answer landed. It now takes the pre-save
`target` identity and compares all three fields of it against the held selection; any other
selection is repaired the ordinary way, positionally and then checked (R27). **`moveMatch`
inherits the same fix**, because the helper is shared and the defect was the helper's.

### The hole, stated in the same sentence as what the wrapper forces

**A component can bypass it.** `src/lib/ipc/commands.ts` exports `saveMatch`, and nothing in
TypeScript, in `svelte-check`, or in this repository's three lint scanners stops a `.svelte` file
importing it and calling it directly — in which case no adoption happens, the first save succeeds,
and every later edit, save or selection lookup in that file uses a stale identity. This is the
same hole `moveMatch` and `saveRawDocument` have had since Phase 2b-2a.

What the wrapper forces is that every caller **of it** adopts. What keeps the other door shut is
that no component imports `../ipc/commands` for anything but a type today — a fact about the code
as written, checked at this step, and not a guarantee. Saying otherwise would be this project's
own named defect: a decision record claiming a guarantee the code does not give.

---

## 4. Holes this step leaves open

1. **No screen.** Nothing here has been rendered, and per `docs/decisions/1c-1-notes.md` hole 1
   and 2c-1b's own conclusion, a green suite is not a screen. The component, the mounted test and
   the window reading are the next step's, and all three are owed.
2. **Eligibility is not re-derived after a commit** (D5). `needsReprojection` asks the caller to
   re-seed; nothing forces it to.
3. **A conflict is terminal** (D6). A person whose save conflicted can keep editing and will
   conflict again; the way out is 2c-4a.
4. **The 700 ms boundary is a judgement** (D4), and the first thing a window reading can falsify.
5. **`identityStale` blocks saving but does not offer a recovery.** The draft is kept and a caller
   can seed a new session from a fresh projection; nothing in the model does it for them.
6. **The Spanish sentences are checked by the parity tests and the untranslated-value heuristic
   only**, which is `2c-1b-notes.md` §8.8 unchanged.
7. **`matchEditability` is consulted as defence in depth**, and it is a projection-level answer:
   this module refuses to edit a snippet the core called unsafe, and does not re-derive why.
8. **Nothing forces a caller to read `adoption`** on a `MatchSaveAnswer`, or to act on
   `needsReprojection`. Both are values on the answer rather than console lines, which is what a
   type can do here and the whole of what it can do.
9. **`BrowserState.moveMatch` still answers `SaveResult | null`** and still leaves a stale
   projection installed when its own re-read fails; it also still calls `forgetFileText` rather
   than `forgetTextOf`, so a captured conflict text can outlive a committed move. The first
   round's first two findings and the confirmation pass's first are about `saveMatch` and were
   fixed there; all three shapes are latent in `moveMatch`, which no screen calls yet. Written
   down rather than fixed silently, because fixing the first changes a published signature that is
   not this sub-phase's — and fixing one of three while leaving two would be worse than saying so.
10. **`amendDraft` retains one extra `DraftStep` per draft** (`Draft.evicted`, D4). That is the
   price of a net-zero group being free at the history bound, and it is a real cost rather than a
   free win: for a raw draft of a large file it is one more retained copy of that file's text.
   `HISTORY_LIMIT` is unchanged, so the worst case moves from a hundred steps to a hundred and one.
