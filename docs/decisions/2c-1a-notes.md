# Phase 2c-1a — decision record

**The draft spine, with no editor, no screen, no Svelte component, no Rust and no Tauri command.**

Phase 2c is the first user interface in this project that can destroy data. Its split
(`docs/decisions/2c-split-notes.md`) cuts it by failure mode, and 2c-1a is the sub-phase that
fails as a **state-shape mistake**: the state everything later stands on, proven before anything
stands on it. It is the same shape as 1b-1 (the i18n layer with no command) and 2b-2c-3a (the core
mode with no caller).

Three things it owed, from `PROGRESS.md` § "Next action": the draft state shape, the typed
whole-document invalidation effect, and the save-outcome presentation model for all three arms.
All three are here.

**This document was written twice.** The aggregate code review
(`docs/reviews/phase-2c-1a-draft-spine.md`) returned **`READINESS: NOT READY`** on three High
findings, and **two of its eight findings were this record claiming a guarantee the code did not
give**. What follows describes the code after the fix round; §7 records what was wrong, including
the two sentences that were false when they were written.

---

## 1. What this phase built

- **`src/lib/browser/draft.ts`** — a generic, editor-agnostic `Draft<T>` with snapshot semantics, a
  bounded undo/redo history with per-step generations, derived dirtiness, and consent that only a
  refusal of this draft's own submission can produce. The raw editor (2c-1b) drafts a `string`;
  2c-2 drafts a `MatchDraft`; nothing in the module knows what text is.
- **`src/lib/browser/invalidation.ts`** — `SealedWholeDocumentSave`, a save outcome the object does
  not carry, and `openWholeDocumentSave`, the one-shot opener that takes the invalidation as a
  required argument, calls it, and survives its throwing.
- **`src/lib/browser/saveOutcome.ts`** — `describeWholeDocumentSave` and `describeEditSave`,
  covering `Saved` (including `committed: false` and the `notes` disclosures), `Refused` (the
  findings, the acknowledgeable subset and the exact-multiset re-submission) and `Conflict` (a
  state that carries the retained draft, with reload behind a confirmation token).
- **Two functions moved out of `describeRawSave` into `rawSave.ts`'s own exports** —
  `refusalAcknowledgement` and `refusalChoices` — so that `saveOutcome.ts` and `draft.ts` **use**
  the existing model rather than restating its rules. `describeRawSave`'s behaviour is unchanged
  and its eighteen tests are untouched.
- **Twelve dictionary keys in both languages**, reached through `tSaveOutcomeMessage` and
  `tConflictChoice` in `src/lib/i18n/index.ts`.
- **77 new frontend tests** — 39 in `draft.test.ts`, 16 in `invalidation.test.ts`, 22 in
  `saveOutcome.test.ts` — plus six the `ipc-detail` guard sweep adds by itself because three new
  `.ts` files exist under `src/`. 738 → **821**.

No `.svelte` file was touched, nothing under `crates/` or `src-tauri/` was touched, and no command
was registered. **2c-1a draws nothing.**

---

## 2. The decisions, each with its reason

### 2.1 D1 — the draft is a value with pure transitions, not a store

Every function in `draft.ts` returns a new draft and none mutates its argument, so a component
holds one in a `$state` and reassigns it. The alternative — a rune-based store, like
`workspace.svelte.ts` — would have put the whole state machine inside a file no automated test in
this repository can render (`docs/decisions/1c-1-notes.md` hole 1). The one thing 2c-1a exists to
get right would then have been the one thing no test could reach.

### 2.2 D2 — dirty is derived, and there is no field to forget to clear

`isDirty` compares the current value against the base value. A stored flag can be set by one path
and not cleared by another, and the case that exposes it is ordinary: type something and type it
back. A `dirty` field would fail the second case in `draft.test.ts`.

### 2.3 D3 — a draft carries *rules*, not just an equality: `{ same, snapshot }`

Fixed at `startDraft`, so a caller cannot ask *is this dirty?* with one rule and *did this edit
change anything?* with another. `textDraftRules` is identity plus no copying, because a `string`
cannot be changed in place. `structuredDraftRules<T>()` is deep equality plus `structuredClone`
followed by an **unconditional** deep freeze.

The snapshot half is the review's High 3 and it is not decoration. A draft that stored the caller's
object would hold the base, the current value, the history entry and the consent candidate as **one
object**: mutate a nested field and dirtiness stays false, consent stays valid, and the editor sends
candidate B carrying candidate A's acknowledgement, with no edit recorded. `readonly` in TypeScript
is shallow and has no runtime existence; `Object.freeze` does, and in strict mode — every module
here is one — a mutation of a held value throws rather than passing.

The freeze is not conditional on a build flag. A check that runs in development and not in the build
the user has is a check that fires where nobody is looking, and its cost here is a walk over a value
that was just copied anyway.

### 2.4 D4 — the base is a revision **and** a value, and a save rebases on the candidate

`savedDraft(draft, submission, revision)` takes the submission that was sent. A person can type
while a save is in flight, and setting the base to whatever the editor holds *now* would report a
dirty draft as clean — and lose it at the next reload. So the current value is never replaced by a
save, and a draft that moved on stays dirty against its new base.

Nothing about this is conditional on `committed`. A `committed: false` is a documented success — the
candidate was byte-identical to what the file already held — and it moves the base for the same
reason a write does.

### 2.5 D5 — the history boundary cuts at the submitted step, and keeps what came after it

Undo may not walk backwards across a write as though nothing had been written, so every step older
than the submitted one goes. Steps made **after** it are kept — the review's Medium 5: the first
version cleared the whole history and left a person who typed during a save unable to undo back to
what had just been written.

The boundary is found by generation, not by position: `[...past, current, ...future]` is the branch
in chronological order, every step carries a unique never-reused generation, and a submission
records the one it was taken from. Two cases the rule states out loud rather than assuming away:

- **the submitted step is ahead of the current position**, because the person undid past it while
  the save was in flight — nothing is discarded. They walked back past the saved state deliberately,
  and taking their history as well would punish them for it;
- **the submitted step is not on the branch at all**, because an edit from an undone state cleared
  the future it was in — nothing is discarded either, and there is no boundary left to draw.

### 2.6 D6 — consent is derived from a refusal of this draft's own submission, never handed in

There is no `acknowledgeDraft(draft, someAcknowledgement)`. `acknowledgeRefusal(draft, submission,
refusal)` is the only way consent enters a draft, `DraftConsent` is branded on a symbol the module
does not export so no literal outside it has the type, and three run-time checks each answer with
the draft unchanged: the submission must carry this draft's base revision; the value on screen must
still be the candidate that was sent; and the refusal must be one an acknowledgement can move.

That is the review's Medium 4. The acknowledgement itself is taken from the refusal
(`refusalAcknowledgement`), cloned and frozen, so what goes back to the gate is what came from it —
the gate matches an **exact multiset**, and a copy assembled from the parts acknowledges nothing.

Beside it, the rules that were already right: every transition that changes the value — `editDraft`,
`undoDraft`, `redoDraft`, `reloadedDraft`, and `savedDraft` which spends it — clears the consent;
and `boundAcknowledgement` re-checks the stored candidate against the current value before handing
anything back, which is unreachable through this module's API and checked anyway because being wrong
costs a save that writes unparseable text on consent collected for different text.

**What is not forced, in the same breath:** a caller can read `submission.acknowledgement` and pass
it to `saveRawDocument` beside a different string. TypeScript has no linear types and no signature
can require two arguments to have come from one call. What is closed is that this module will not
*produce* that pairing and will not *record* it as consent — which is exactly the claim the first
version of this record got wrong (§7.4).

### 2.7 D7 — the invalidation is a seal whose payload the object does not carry

The first version kept the payload on the sealed object under a module-private symbol, and the
review demonstrated that this is private only at the TypeScript-name level: `Reflect.ownKeys`,
`Object.getOwnPropertySymbols` and `Object.getOwnPropertyDescriptors` all recover a symbol-keyed
property, and object spread copies it.

The payload now lives in a module-private `WeakMap` keyed by the sealed object, which is an empty
frozen husk. Reflection finds nothing, spread copies nothing, `structuredClone` clones nothing, and
a clone is not a key of the map either. The entry is **deleted as the seal is opened**, so the seal
is one-shot: a second open — including a later one with a no-op callback — is refused rather than
served.

A caller that does not discharge the invalidation therefore has no save result at all: it cannot
tell whether the file was written, cannot draw an outcome and cannot rebase a draft. That is what
"fails to type-check" can be made to mean in a language with no linear types, and the three
alternatives are each weaker: a **branded token beside a readable result** is never forced to meet
it; a **discriminated result whose committed arm carries a token** gives the caller everything on
narrowing; a **must-use wrapper** has no TypeScript equivalent, and no lint here could see a value
dropped inside a component.

`forget` is **synchronous**, deliberately: the invalidation this application already performs is
synchronous and total before its first `await`, because an asynchronous one has a window in which a
getter can still read the projections the commit destroyed (`docs/decisions/2b-2c-3b-notes.md` §3).

### 2.8 D8 — an invalidation that throws never unwrites the file

`PROGRESS.md` D2: *a committed write is never afterwards reported as an error.* The first version
let a throwing `forget` propagate out of the opener, so the caller saw an exception where a
committed `saved` should have been — the same defect 2b-2c-3b's own fix round found in
`saveRawDocument`, made again one layer up.

The opener catches it, classifies it through `classifyFailure` — the channel every other failure of
this boundary uses — and returns it on the opening's `invalidation` field **beside** the committed
outcome. The status type is `RawSaveReload`, reused rather than restated: "did not run", "ran and
worked" and "ran and failed" are the three states the command boundary already distinguishes.

### 2.9 D9 — the invalidation fires on a committed `saved` and on nothing else

The rule lives in one function, `invalidationOf`, so the opener and any reader asking the same
question cannot answer it differently. The three cases where it must **not** run are as much of the
contract as the one where it must, and each is a different reason:

- `committed: false` wrote nothing; the candidate was byte-identical to what the file already held,
  and invalidating anyway would make a window discard projections that are still correct;
- a `conflict` wrote nothing, and what the caller holds is a projection of bytes **some other
  writer** replaced — carried in the outcome's own `disk` field, and adopting that is a different
  act from forgetting a file this application has just rewritten;
- a `refused` wrote nothing at all.

### 2.10 D10 — the save-outcome model returns codes, never sentences

The idiom of `findings.ts`, `notices.ts`, `detail.ts` and `rawSave.ts`, and it is CLAUDE.md §2's
rule as a shape: the prose lives in `src/lib/i18n/{en,es}.json` where both languages are checked
against each other, and a component renders one by calling `tSaveOutcomeMessage` or
`tConflictChoice`, never by building a key. Nine message codes and four choice codes; not one of the
nine carries an operand, and a test asserts that no sentence names a placeholder.

### 2.11 D11 — two describers, and no `scope` parameter for a caller to get wrong

`describeRawSave`'s first line is *this replaces the entire document*. That is what
`save_raw_document` is (design consult Q8) and it is **false of a field edit**. The first version
took the scope as a string argument, and the review was right that this makes the disclosure a
caller assertion in both directions: `describeSaveOutcome(rawRefusal, 'edit')` suppresses it and
`describeSaveOutcome(editResult, 'wholeDocument')` invents it.

`describeWholeDocumentSave` takes a `WholeDocumentOutcome`, which only `sealWholeDocumentSave`
produces; `describeEditSave` takes the wire `SaveResult`. Neither can be told which it is.

### 2.12 D12 — a whole-document saved arm's `moved` is `null` by type, not by passing through

`WholeDocumentSaved.moved` is the literal `null`, and the seal **rebuilds** the saved arm rather
than spreading it. The protocol says a replacement answers `null` permanently and by construction;
carrying the wire's field through left the other case representable. It is not dropped for
tidiness — after a whole-document commit *every* identity in the file is stale, so an identity here
would be one the caller must not use even if the wire somehow produced it.

### 2.13 D13 — the conflict arm carries the draft, and reload is a confirmed transition

`ConflictModel<T>` has a required `draft: Draft<T>` field. **That is what "nothing was discarded"
means here**: a model that had thrown the draft away cannot be built, because there is nothing else
to put in the field. `copyOfDraft` is the *Copy draft* affordance's one named way out.

Reloading is `confirmReloadDiskVersion(conflict)` — which issues a branded token for **that**
conflict — followed by `reloadDiskVersion(conflict, confirmation, revision, value)`, which checks
the token was issued for that conflict and answers `null` when it was not. A boolean saying a
confirmation is needed is not a confirmation; this is the review's Medium 7, and it is also the
shape 2c-4a inherits, because conflict capture needs the draft, the disk projection and both
revisions in one value.

### 2.14 D14 — no conflict affordance is called "keep my draft", and none may become one

`ConflictChoice` is `keepEditing | copyDraft | reloadDiskVersion | confirmReload`. In the plan,
*keep my draft* means **reapply the draft to the newly parsed disk document** — 2c-4b, the dangerous
algorithmic half of Phase 2c — and using the words early would teach the owner the wrong meaning and
let 2c-4b look already-done. A test asserts the prohibition against the rendered labels in both
languages, not only against the code names.

There is **no `saveAnyway` in the conflict arm and no acknowledgement to build one from**. Retrying
a whole-document candidate against a base revision the file has moved past is how the other writer's
work is destroyed; the save that refused is the check that prevented it. `confirmReload` is
deliberately not in `choices`: it is the second step, and *Copy draft* is offered before the
destructive choice.

### 2.15 D15 — the history is bounded at a hundred steps, and coalescing is not this module's job

What counts as one edit — a keystroke, a word, a pause — is a property of the editor: 2c-1b binds a
text area and 2c-2 binds twenty-two fields, and they will not agree. What *is* this module's to
decide is that the history cannot grow without limit, because a raw draft holds a file's entire text
and one entry per keystroke over a long session is unbounded retained memory.

`HISTORY_LIMIT = 100`. A hundred steps of a hundred-kilobyte configuration is ten megabytes at
worst — a bound, not a promise of thrift — and undo and redo move steps between the two stacks
rather than creating them, so the two together hold about that many and not more. **What the user
loses at the bound is the oldest undo step, and then the next oldest.** The recent history, which is
what undo is for, is never the part that is dropped, and `baseValue` is never dropped at all, so
"what this file held when I opened it" is still in the draft even when its history is not.

### 2.16 D16 — `refusalAcknowledgement` and `refusalChoices` moved rather than being copied

The two questions every refusal asks — *would handing the findings back work?* and *what may the
person do?* — were inline in `describeRawSave` and are not raw-specific: the gate's rule is the same
for a field save, a creation and a deletion. They are now two exported functions that
`describeRawSave` itself calls, so the three callers cannot drift. No behaviour changed; the
existing `rawSave.test.ts` still passes unmodified.

### 2.17 D17 — a committed save whose invalidation failed stays committed

`invalidationFailureMessage` produces a line **beside** a `saved` model and never in place of one,
for D8's reason: the bytes are on disk, and what failed is this window bringing itself back into
step.

---

## 3. Tests

**`src/lib/browser/draft.test.ts` (39)** — what a draft starts as; dirty derived (edit away and back
is clean, undo back to the base is clean, no `dirty` key exists, the draft's own rules answer both
questions, and `deepEquals` at depth); **snapshots** (a caller mutating the object it handed in
changes nothing, a mutation of a held value throws at any depth, the review's acknowledge-then-mutate
scenario driven exactly with a structured `T` so that both `isDirty` and the consent notice, and
`deepFreeze` reaching below the surface); undo/redo (a three-step round trip, redo cleared by
editing from an undone state, no-ops at either end, no history entry for an edit that changes
nothing, unique generations that undo restores rather than re-mints, no mutation of the argument,
and the bound dropping the oldest step first); the boundaries (rebasing on the candidate, undo
stopping at what was saved, **the in-flight edit and its undo retained**, nothing discarded when the
person undid past the submission, nothing discarded when a branch abandoned it, `committed: false`
drawing the same boundary, and the reload replacing everything); and consent — readable while the
candidate stands, derived from the refusal rather than handed in, refused for an unmovable verdict,
refused when the draft moved on, **refused when offered from another draft**, refused for another
base revision, gone after an edit, an undo, a redo, a save and a reload, gone by the last gate when
planted by hand, frozen against a pushed finding, and empty on a first attempt.

**`src/lib/browser/invalidation.test.ts` (16)** — the seal against **every escape the review
listed**: `Object.keys`, `getOwnPropertySymbols`, `Reflect.ownKeys`, `getOwnPropertyDescriptors`,
spread-then-reflect, `JSON.stringify`, `structuredClone`, and opening a clone; the seal is frozen;
it is **one-shot** and a second open neither serves the outcome nor calls the callback; the saved arm
answers `moved: null` even when the wire carried an identity; the invalidation runs for a committed
save with the document and its new revision and runs **before** the outcome is returned; **a
throwing `forget` never replaces the committed outcome**, is classified through `classifyFailure`
with its developer string hidden, and still consumes the seal; it does not run for
`committed: false`, for a conflict or for a refusal; `invalidationOf` answers the same question
outside the seal; and the residue is a test rather than a sentence — a no-op body is accepted.

**`src/lib/browser/saveOutcome.test.ts` (22)** — the `saved` arm (written plus the backup
disclosure, `committed: false` as a success with its own sentence, every presentation note carried,
and both describers agreeing); the `refused` arm (nothing written, every finding handed back, the
exact-multiset acknowledgement, the refusal carried whole for `acknowledgeRefusal`, the offer
withheld from a verdict no acknowledgement can move, the parse rejection delegated to `rawSave.ts`,
and nothing said about replacing the whole document for an edit save); the `conflict` arm (its four
sentences, **the draft carried and copyable**, the copy offered before the destructive choice, no
`saveAnyway`, no `acknowledgement` property, **reload only through a confirmation issued for that
conflict** and refused when the token came from another, enough revision information to tell the two
versions apart, the second observation kept separate, and no control called "keep my draft" in
either language); the committed save whose invalidation failed; and the sentences behind the codes,
checked the way `rawSave.test.ts` checks its own.

---

## 4. Holes this phase leaves open

Rewritten against the finished code after the fix round.

### 4.1 Consent can still be *moved* by hand outside this module

`acknowledgeRefusal` will not bind draft A's refusal to draft B, and `DraftConsent` cannot be built
outside `draft.ts`. What no TypeScript can prevent is a caller reading `submission.acknowledgement`
off one submission and passing it to `commands.saveRawDocument` beside a different string: there are
no linear types, and no signature can require two arguments to have come from one call.

The wire refuses such a pairing — consent for text A sent with text B is a second refusal, not a
write — so the residue is a confusing refusal rather than a bad write. **That is the honest
statement, and it is the one this record got wrong the first time** (§7.4).

### 4.2 The seal binds only code that takes a sealed value, and the document is still asserted

`commands.saveRawDocument` and `BrowserState.saveRawDocument` still answer unsealed values, and
nothing forces a future caller to route through `sealWholeDocumentSave`. The seal is unignorable
**once a value is sealed**; it is not unignorable that a value gets sealed.

`sealWholeDocumentSave(documentB, resultOfA)` is likewise a call this module cannot detect. What the
shape buys is that the pairing happens **once**, in the adapter that issued the save and therefore
knows both, instead of being re-asserted at every describer as a `scope` string was.

`BrowserState.saveRawDocument` performs the invalidation itself (2b-2c-3b §3), so the running
application's path is covered by a different mechanism. **2c-1b is where the seal is proved or found
wanting**, and if its component ends up not taking a sealed value, this construct will have bought
nothing and that should be said rather than the shape kept for its own sake.

### 4.3 `() => {}` still satisfies `ForgetReplacedDocument`

Unchanged in kind from `2b-2c-3b-notes.md` §7.2 and narrowed in degree twice over: a caller must
**call** the routine to learn anything at all, and it may only do so once. No TypeScript signature
can require a body to act.

### 4.4 A structured draft is protected by `Object.freeze`, which has two edges

The freeze throws on a write in strict mode, and every module in this project is strict. Two things
it does not cover: a value that is not plain data (a `Map`, a `Date`, a class instance) is copied by
`structuredClone` but its internals are not reached by a freeze that walks `Object.values`, and
`deepEquals` would compare two such values as empty objects. Nothing in a draft is such a value
today — `MatchDraft` is tri-state tags, strings and arrays — and a phase that drafts one owes new
rules rather than an assumption that these ones cover it.

The second edge is cost: `structuredDraftRules` clones and walks on **every** recorded value. That
is fine for a `MatchDraft` and would not be for a large tree; no measurement has been taken, because
nothing draws one yet.

### 4.5 The history bound is a guess, not a measurement

A hundred steps was chosen for the arithmetic in D15 and not from a profile of a real editing
session, because no editor exists to profile. If 2c-1b pushes one step per keystroke, a hundred
steps is a few seconds of typing and the bound will be reached constantly; if it coalesces, it may
be a whole session. **2c-1b owes the coalescing decision**, and the bound may need revisiting once
there is a real number to look at.

### 4.6 A save whose in-flight candidate was abandoned leaves an explainable-but-odd state

`savedDraft` discards nothing when the submitted step is no longer behind the current position, so a
person who undid past their own save keeps a full history against a base they never chose. Nothing
is lost and nothing is wrong; the state is harder to describe than it would be if the editor refused
edits while a save was in flight. Whether it does is 2c-1b's decision, and 2c-1b should make it
deliberately rather than inherit it.

### 4.7 A save that fails after its rename is not covered by the seal

A write that fails after the rename may have replaced the file, and there is no revision to hand back
for it. `mayHaveWritten` in `../ipc/errors` is that question and `BrowserState.saveRawDocument` is
where it is asked. The seal models `SaveResult` only, so this one path to a stale window is outside
it.

### 4.8 The destructive draft transition is still reachable directly

`reloadedDraft` is exported from `draft.ts` and discards a draft without asking anything. The
conflict state reaches it only through a confirmation token (D13), but a caller that imports
`draft.ts` and calls it itself is a caller that skipped the question. Nothing but review catches
that, and it is the same class of residue as §4.2: a gate is unignorable on the path through it, not
on every path.

### 4.9 Twelve new user-facing strings have never appeared on a screen

They join the standing debt: the six `browser.rawSave.*` keys,
`code.findingCode.documentDoesNotParse`, the thirty-two `code.draftError.*`,
`code.commandError.draftRefused`, the eight `code.editError.*` and the two
`code.presentationNote.*`. **2c-1b is the phase that owes the look at them**, and it is the first
phase that can take one.

### 4.10 Twelve more Spanish sentences checked only by heuristic

The dictionary parity tests check that no Spanish value is byte-identical to its English counterpart
and that the placeholder sets agree. Nothing establishes that any of the twelve is idiomatic.

### 4.11 Nothing here has been run in a window, and nothing renders a component

The split's §7 requires three kinds of evidence per sub-phase; 2c-1a produces only the first
(automated presentation and state tests). The mounted-component test is deliberately 2c-1b's, and a
recorded manual reading needs a screen, which this phase does not build. **A model that passes 77
tests and is never drawn is exactly the state 2b-2c-3b's hole 7.1 describes**, one phase further on.

---

## 5. The review's closing judgement, answered

The review's last paragraph said the shape *"is not yet adequate for `MatchDraft` or later conflict
rebase"* on three counts. Each is answered plainly rather than left implied.

**1. Structured draft snapshots are not protected from aliasing — now adequate.** `DraftValueRules`
makes the snapshot part of construction, every recorded value goes through it, and
`structuredDraftRules` clones and freezes. The review's own scenario is a test. The residue is §4.4:
the rules cover plain data, and a drafted value that is not plain data needs its own rules.

**2. Post-submission history is lost — now adequate.** The boundary is drawn at the submitted
generation and everything after it is kept, with the two odd cases (undone past, abandoned branch)
stated and tested. The residue is §4.6, which is a question about what the *editor* should allow,
not about what the spine can represent.

**3. Conflict state does not carry the retained draft or the projection a controlled reapplication
needs — adequate for 2c-4a, and not sufficient for 2c-4b.** `ConflictModel<T>` now carries the
draft, the disk `DocumentView`, all three revisions and the `changedAgain` distinction, which is
what 2c-4a's capture–compare–copy–reload needs.

**2c-4b will need more than this shape gives**, and it is worth being exact about what:

- the draft's **base projection** — 2c-4b has to identify *the intended match* in a newly parsed
  document, and comparing a draft against the disk version needs what the draft was made from as a
  projection, not only as a value and a revision;
- a **per-field provenance** for a `MatchDraft`, so a reapplication can tell a field the person
  changed from one they did not; `DraftField`'s tri-state gives that for a single save, and this
  spine does not accumulate it across a conflict;
- a **confidence measure and its threshold**, which is the algorithmic half the split reserves for
  2c-4b and which nothing here anticipates.

None of those is a defect in this phase — 2c-4b is the sub-phase that owes them — but "the conflict
state is now adequate" would be an overclaim without them written down.

---

## 6. Deviations from the brief, recorded rather than hidden

1. **`src/lib/browser/rawSave.ts` was modified**, which the original brief did not ask for. Two
   rules were extracted from inside `describeRawSave` into exported functions so that
   `saveOutcome.ts` and `draft.ts` could use them rather than restate them — the brief's own "USE
   it, not re-implement it". Behaviour is unchanged and `rawSave.test.ts` is untouched.
2. **There is no `describeSaveOutcome(result, scope)`.** The brief described one function over
   `SaveResult`; the review's Medium 6 replaced it with two command-specific describers, which is
   what the fix round's disposition directed.
3. **`invalidationFailureMessage` exists**, which the brief did not enumerate. It is how the split's
   §6 requirement *still report a committed save as committed even if the reload that follows it
   fails* becomes something a test can check. It was `reloadFailureMessage` before the fix round and
   was renamed when the seal gained its own status type.

---

## 7. The fix round — the review's eight findings

`docs/reviews/phase-2c-1a-draft-spine.md` returned **`READINESS: NOT READY`**. This project holds a
phase open until its findings are closed, so no commit ever carries a demonstrated defect. What
follows is what was actually wrong. Nothing here is rewritten to look clean.

### 7.1 High — the seal was readable by reflection, and reusable

`PAYLOAD` was a module-private symbol **on the sealed object**, which makes it private to
TypeScript's name resolution and to nothing else: `Reflect.ownKeys` finds it, spread copies it, and
reflecting on the copy recovers the `SaveResult` with no opener and no invalidation. The seal could
also be opened repeatedly, so a caller could open it properly once and again later with a no-op.

Fixed as the review prescribed: a module-private `WeakMap`, the entry deleted on open, a second open
refused, and the public object frozen and empty. Six attempted escapes are now tests.

### 7.2 High — a throwing invalidation hid a committed save

The exact invariant `PROGRESS.md` D2 states, and the second time this project has broken it in
TypeScript. It is caught, classified and carried beside the committed outcome (D8).

### 7.3 High — structured values were stored by reference

The aliasing defect in full: base, current, history and consent candidate all one object. Fixed by
snapshot rules with an unconditional deep freeze (D3), with the review's scenario as a test.

### 7.4 Medium — `acknowledgeDraft` accepted any acknowledgement, and this record said otherwise

The function bound whatever it was handed, so taking `submissionOf(acknowledgedA).acknowledgement`
and calling `acknowledgeDraft(draftB, …)` produced exactly the pairing the design forbids. **The
record's sentence "this module never produces such a pairing" was false when it was written**, and
it was false in the strongest place: the section explaining why the design was safe.

The function is gone. `acknowledgeRefusal` derives consent from a refusal and the submission it
answered, with three run-time checks (D6). The claim now made is the narrower true one, in §4.1: it
will not produce the pairing and will not record it, and a caller assembling the two halves by hand
is refused by the wire rather than prevented by the type.

### 7.5 Medium — the save boundary destroyed history the person still needed

Fixed by generations (D5).

### 7.6 Medium — scope and document were caller assertions

Fixed by two describers, a `WholeDocumentOutcome` only the seal produces, and a saved arm whose
`moved` is `null` by type (D11, D12). The document a seal is made with is still asserted once, by
the adapter that issued the save, and that residue is §4.2.

### 7.7 Medium — `draftKept: true` was an adjective, and this record called it a guarantee

The literal type made a dishonest value harder to construct and not impossible: a caller could
discard the draft and still build a model claiming it was kept, and nothing required a confirmation
before a reload. **The record's claim that such a model was "not expressible" was an overclaim.**

Fixed by carrying the draft and by making reload a confirmed transition (D13). What is now true is
narrower and checkable: the field is required, so a model without a draft cannot be built, and the
reload path checks a token issued for that conflict — but `reloadedDraft` is still exported and a
caller that calls it directly has skipped the question, which is §4.8 rather than a closed hole.

### 7.8 Low — unbounded history

Fixed by `HISTORY_LIMIT`, with the choice and its cost written down (D15) and its arbitrariness
recorded as a hole (§4.5).

---

## 8. Verification

Every command run from the repository root, each as its own invocation. The table is the state
**after** the fix round; before it, the frontend suite stood at 797.

| Command | Result |
|---|---|
| `npm test` | **821 passed** across 33 files (baseline 738; +83) |
| `npm run check` | 384 files, **0 errors, 0 warnings** |
| `npm run build` | Built, 150 modules |
| `cargo test --workspace` | **1007 passed, 0 failed** — unchanged, and run to prove it |
| `git status --short` | Only `src/lib/` and `docs/decisions/`; nothing else |

No corpus fixture was modified, no file under `crates/` or `src-tauri/` was modified, no `.svelte`
file was modified, and the working tree is left uncommitted.
