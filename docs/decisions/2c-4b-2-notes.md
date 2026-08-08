# Phase 2c-4b-2 — decision record

**Reapply as browser-model transitions, one per surface, with no control anywhere.**
`src/lib/browser/reapply.ts` is new and holds the gate, the two evidence readers and the one
adoption door; each of the six write surfaces gained a `reapplyToDiskVersion`, and the raw editor's
is **permanently `unavailable` by declaration**. `ConflictCapabilities` gained one permanent field,
`reapplySupport`, whose only reader is the shared gate. **No `.svelte` file was touched, no command
was added, `ConflictChoice` gained no member, and `conflictChoicesFor` is byte-for-byte as it was.**

The authority for this step is `docs/reviews/phase-2c-4b-design.md` — the design consult. It
discharges the "### 2c-4b-2" subsection of that document's **Q8**, under the rulings of **Q1** (what
a reapply is), **Q3** (where the per-surface half lives), **Q4** (what each surface applies) and
**Q5** (what must not be built), and it takes **Q9**'s three predictions as constraints. Where this
record and that document disagree, the consult is right and this is a bug.

---

## 1. What this step built

| File | What it is |
|---|---|
| `src/lib/browser/reapply.ts` | **new.** `SubjectCorrespondence`, `AnchorCorrespondence`, `SharedReapplyObstacle`, `ReapplyOutcome<S, O>`, `ReapplyStart<T>`, `beginReapply`, `subjectCorrespondence`, `subjectIsTargetless`, `anchorCorrespondence`, `adoptForReapply` |
| `src/lib/browser/saveOutcome.ts` | `ConflictReapplySupport`, `ConflictCapabilities.reapplySupport`, `reapplyAuthorizationFor` and its `WeakMap`, and a rewritten `ReloadConfirmation` doc comment |
| `src/lib/browser/matchEditor.ts` | `FieldReapplyVerdict`, `sameEligibility`, `sameBaselineState`, `fieldReapply` (Q4's six-row table), `MatchReapplyPlan`, `planMatchReapply`, `EditorReapplyObstacle`, `MatchEditorReapply`, `reapplied`, `reapplyToDiskVersion`; `reapplySupport: 'supported'` |
| `src/lib/browser/matchCreation.ts` | `CreationReapplyObstacle`, `MatchCreationReapply`, `destinationOfProjection`, `rebuiltPlacement`, `reapplyToDiskVersion`; `reapplySupport: 'supported'` |
| `src/lib/browser/matchDeletion.ts` | `DeletionReapplyObstacle`, `MatchDeletionReapply`, `reapplyToDiskVersion`; `reapplySupport: 'supported'` |
| `src/lib/browser/matchDuplication.ts` | `DuplicationReapplyObstacle`, `MatchDuplicationReapply`, `reapplyToDiskVersion`; `reapplySupport: 'supported'` |
| `src/lib/browser/matchMove.ts` | `MoveReapplyObstacle`, `MatchMoveReapply`, `reapplyToDiskVersion`, `rebuiltPlacement`; `reapplySupport: 'supported'` |
| `src/lib/browser/rawEditor.ts` | `RawEditorReapplyObstacle`, `RawEditorReapply`, `reapplyToDiskVersion` — which takes **no adoption function**; `reapplySupport: 'unavailable'` |
| `src/lib/browser/fixtures.ts` | `ConflictOverrides` and `makeConflict`, which copies `disk_revision` **from the supplied projection's `revision` field** — that one equality, and nothing about `disk_text` (§7.2) |
| `src/lib/browser/reapply.test.ts` | **new.** 12 cases: the gate, both evidence readers, and the one-token adoption |
| seven sibling `.test.ts` files | 74 further cases; `workspace.test.ts`'s six drive the real `BrowserState` end to end |
| `scripts/lint/ipc-detail.test.ts` | **untouched, and 2 cases longer**: it enumerates the sources under `src/`, so each new file brings its own case. 12 + 74 + 2 is the 88 the suite grew by, and only 86 of them were written |

**No dictionary key was added, in either language.** Every obstacle this step introduces is a code
with no sentence and no accessor, which is 2c-4b-3's work: nothing draws them, and adding the prose a
sub-phase early is how a phase starts looking done.

---

## 2. The decisions

### 2.1 D1 — the shared gate reads a **permanent** capability, and there is no `offersReapply` yet

`ConflictCapabilities.reapplySupport` is `'supported' | 'unavailable'`, in the same record as
`draftKind` and `reloadOutcome` and for the same reason: it is a fact about what the surface *is*,
not about what it draws. `beginReapply` is its only reader, and it checks support **before** the
conflict — so the raw editor answers `unavailable` whether or not one is showing. *This cannot be
done here* is permanent and *there is nothing to do* is a state, and answering the second for raw
would invite a caller to read the first as temporary.

**The boolean the consult's Q8 calls `offersReapply: false` was deliberately not added.** `saveOutcome.ts`'s
own history says a field nobody reads is not a default but a second answer, and in this step there is
no `ConflictChoice` member a reapply control could be named by — so a *this surface draws it today*
boolean would have nothing to produce and nothing to read it. What Q8 actually asks for is that
nothing is offered, and nothing is: `ConflictChoice` is unchanged, `conflictChoicesFor` is unchanged,
and no component was touched. 2c-4b-3 adds the choice member, the boolean and the branch together.

**What this forces and what it does not.** It forces that a surface cannot get a reapply by wiring
the shared helper without declaring one, because the declaration is a required field. It does **not**
force that a surface's declaration matches what its own transition does — `rawEditor.reapplyToDiskVersion`
could have been written to ignore the gate, and what stops that is that it has no `adopt` parameter
at all (2.6).

### 2.2 D2 — decide first, adopt second, on every surface

Every transition computes its whole rebase from the conflict's own disk snapshot **before** it asks
the window to install anything. A refusal therefore leaves the window exactly where it was: no
projection replaced, no selection repaired, no authorization spent. The alternative — adopt, then
discover a field collided — would re-order the snippet list under a person who is about to be told
that nothing could be done, which is the 2c-4a-2 defect one phase along.

**Measured, not argued.** Mutation F below inserted the adoption into the deleter's refusal arm and
flipped exactly two assertions: `matchDeletion.test.ts`'s *adopts nothing* and `workspace.test.ts`'s
*sends no command and installs nothing on a manual-resolution refusal*, which reads the real
window's revision afterwards.

**Nothing on this path awaits.** `AdoptTheDiskVersion` is synchronous, so consult Q9's third failure
mode — *a reprojection makes a correct model act on a stale selection after an `await`* — has no
interval to occur in. That is a property of today's signature and **not** a guarantee this code
enforces; an asynchronous adoption added later would need the guard `replaceSelection`'s callers
already carry, and nothing in TypeScript would demand it.

### 2.3 D3 — one conflict, one authorization, through the existing door

`adoptForReapply` spends `BrowserState.adoptDiskVersion` — the existing door, with its five existing
checks, **in that method's own order and not as a list applied alike**. Four of them precede every
successful answer: the confirmation was issued for this conflict, it is unspent, this window produced
the conflict and about this file, and the document is projected. The fifth does not. A window already
holding the requested revision is answered `alreadyThere`, and its token spent, *before* the
projection generation is inspected at all, so that last check guards only the branch that would
install the conflict's snapshot over a projection replaced since it arrived. The method answers its
own three-armed `DiskAdoptionOutcome` unchanged; `alreadyThere` is a success and only `refused` stops
a caller.

**The token is memoized on the conflict's origin** (`reapplyAuthorizationFor`), keyed by
`ConflictModel.source` — the wire value the payload carried whole, and the same key
`rememberTheConflict` uses in `workspace.svelte.ts`. A reapply asks no second question — consult Q6 —
so there is no `confirming` step to hold a token on the way the reload has one; minting a fresh token
per attempt would hand every attempt a value the window's spent-confirmation guard had never seen,
which is precisely the guard a conflict's reapply must not walk past. The memo makes *one conflict,
one spend* true rather than intended **at that guard**, and it is not a parallel door: the token is
`confirmReloadDiskVersion`'s own and the spend is `BrowserState`'s own `WeakSet`.

> **Correction (§7.1).** This section originally said the memo was keyed on the `ConflictModel`
> object, and that the origin-and-generation check covered the gap. It did not, and the code has
> changed: the key is now `ConflictModel.source`. The paragraph below is the corrected statement.

**What it forces and what it does not, in the same sentence.** What `reapplyAuthorizationFor` and
`adoptForReapply` force between them is that every `ConflictModel` over one wire conflict is handed
the **same** token, and that the callback is called once with it — and nothing at all about what the
callback then does, because `AdoptTheDiskVersion` is an ordinary function type and an arbitrary one
can ignore both the token and the spend. **At most one adoption can succeed per wire conflict** is an
implementation fact about the one callback the five match transitions pass,
`BrowserState.adoptDiskVersion`: with that method every model over the conflict is handed the one
token, a success spends it in that method's own `WeakSet`, and a later attempt is refused — as spent
when it presents the model the token was minted for, and by `authorizeDiskAdoption` when it presents
any other model of that same conflict, because the token is bound to the model it was minted for. Nor
does either function force that a caller takes its token from here: `confirmReloadDiskVersion` is
exported, and a caller minting its own for an already-adopted conflict is answered `alreadyThere` — a
success that installs nothing but is reported as one, because `adoptDiskVersion` settles that
question *before* it reaches the
projection-generation check. What holds today is an implementation fact and not a type: every reapply
transition that adopts anything — the five match surfaces — takes its token from
`reapplyAuthorizationFor`, through `adoptForReapply`, and the raw editor's takes no adoption function
at all.

**`ReloadConfirmation` now has two producers and its name records only the first.** Its doc comment
says so explicitly rather than leaving the reader to discover it: a reapply does not discard the
draft and asks no second question, and what the two transitions share is the binding, not the
meaning. The type was **not** renamed, because six `.svelte` files name it and this step may not
touch one; the debt is written down rather than hidden.

### 2.4 D4 — the match editor's field table, and why any collision blocks all of it

`fieldReapply` is Q4's six-row table, one row per branch, over `fieldIntent`'s output and the two
baselines. `sameBaselineState` compares **presence, logical scalar text and eligibility** — the three
things Q4 names — and never the buffers: whether the *draft* still matches says nothing about what
the file now holds, and presence-and-value alone would call a field that has become undecodable,
zero-width or unmodelled "the same state" and then write into it.

**Both `satisfied` rows require the new field to be editable, and that is not decoration.** A key the
file *has* but whose value the projection did not model reads as `present: false` — `projectedScalar`
answers `null` for it — so *absent* on its own would call a `label:` that has become a mapping
"already removed", write nothing, and leave the key in the file. Mutation A removed exactly that
conjunct and flipped exactly the case that pins it.

**`satisfied` and `unchanged` are two arms although both write nothing.** The first is a drafted
change the disk has already made; the second is no drafted change. Consult Q9 names *"all changes
reapplied" when some were merely already satisfied* as this phase's likeliest false sentence, and
keeping them apart is what lets 2c-4b-3 say which happened.

**Any collision blocks the whole reapply**, and the plan still names every collided field so a panel
can say which. Saving the safe fields only would strand the rest while looking successful; per-field
manual resolution is 2c-4c's.

**The rebuilt buffers derive exactly the intents the plan decided**, and a test asserts that round
trip over the *new* baseline rather than trusting the construction. The history is one step: base =
what the file now holds, value = what the person still wants. Replaying the old history over a
different baseline would itself be a merge algorithm (Q4).

### 2.5 D5 — the four operation surfaces, and what each of them re-asks

- **Deletion.** Strict exact correspondence only. The rebuilt session has **nothing pending**, so the
  person confirms again and `confirmDelete` compares against the identity the *live* projection
  gives — comparing two values minted together proves nothing. Eligibility is recomputed over the new
  parse, including the refusal to empty the sequence.
- **Duplication.** Strict exact correspondence only, and the old
  `DuplicateKeepsTriggerDefinition` acknowledgement cannot cross: `startMatchDuplication` builds a
  draft with no consent, so the newly derived candidate is refused and acknowledged again. The
  open-editor question is **re-asked as an argument**, because it is about this window now.
- **Move.** The subject is resolved strictly, its `SequenceAddress` must equal the original one
  (same *sequence*, not same file — D2r), the destination is rebuilt from the new sequence, and the
  old numeric index is read by nothing. `top` and `end` are semantic and are lowered afresh; the
  evidence's anchor is consulted **only** for an `after`, because an `end` was lowered to *after the
  last other snippet* before it was sent and its wire anchor is a snippet the person never named.
  *Already there* is `moveSubmissionRefusal`'s own verdict, asked of the rebuilt session, so it means
  the same thing here as beside the control. R25 is visible in the test: `beginMove` on the rebuilt
  session produces one move and nothing else.
- **Creation.** Targetless: `subjectIsTargetless` is the one place `Targetless` is told apart from
  `Unsupported`. The buffers are retained; the destination is rebuilt from `ConflictModel.disk`; the
  draft's base is re-pointed with `retargetedDraft`, which withdraws the consent in the same call;
  `front` and `end` keep their meaning and an `after` survives only on exact anchor correspondence;
  and `creationRefusal` is asked again in full. There is **no** duplicate-trigger precheck (Q4).

**An identified anchor is checked against the rebuilt session's own anchors** on both surfaces that
have one, rather than left to `choosePlacement`. That function answers *the session unchanged* for an
anchor it will not install, and that answer is indistinguishable from *the destination did not move* —
acting on it would silently reapply the snippet's current position as though it were the person's
choice.

### 2.6 D6 — raw's refusal is a declaration, and it has no door to walk through

`rawEditor.reapplyToDiskVersion(session)` takes **one parameter**. There is no `adopt` argument, so
no disk snapshot can be installed through this surface's reapply path at all — which is a stronger
statement than *the function returns `unavailable`*, and a test asserts the arity for exactly that
reason. It still routes through `beginReapply`, so the answer comes from the surface's own permanent
declaration rather than from which arms the wire happened to carry: a test drives a payload whose
subject is `Identified` and the answer is still `unavailable`.

### 2.7 D7 — each surface owns its obstacle union; only two arms are shared

`SharedReapplyObstacle` has exactly the two arms that are about the **evidence** —
`correspondence` and `evidenceNotATarget`. Everything else is about the surface's own value and lives
beside it: the editor's `fieldCollisions` and `targetNotEditable`, the mover's `anchorCorrespondence`,
`evidenceNotAnAnchor`, `notTheSameSequence`, `anchorNotInSequence` and `moveRefused`, the creator's
five, and the two operation surfaces' `notDeletable` / `notDuplicable`. Putting them in the shared
module would have meant importing `EditableField`, `MoveRefusal`, `DestinationRefusal` and
`CreationRefusal` into it, and every one of those imports is a cycle.

**The subject's refusal and the anchor's are two arms and not one**, on both surfaces that have both:
the wire answers them with two enums and `tReapplyResolution` and `tReapplyPlacement` have two sets of
sentences, because *the snippet you moved* and *the snippet you moved it after* are different things
to have lost.

---

## 3. What this step deliberately did **not** do

- **No control, no choice, no sentence.** `ConflictChoice` is unchanged, `conflictChoicesFor` is
  unchanged, no `.svelte` file was touched, and `keepMyDraft` is not a word anywhere in `src/`
  except the pre-existing guard in `saveOutcome.test.ts` that asserts no choice is named that.
- **No dictionary key, in either language.** i18n stays at 745 keys per language.
- **No Rust change of any kind.** No command was added, `save_document` is still the only entry point
  that writes, there is still no `force` flag, and `cargo test --workspace` is unchanged at 1086.
- **No merge, no retry loop, no partial save.** A reapply is one new attempt; the rebuilt session
  meets the ordinary gates, and another external change produces another ordinary conflict — which a
  test drives.
- **No new writing path.** Nothing in this step calls a command. The transitions hand back a session,
  and sending it is the surface's existing submit path.

---

## 4. What this step does not cover, stated as holes

### 4.1 Nothing checks that a surface acts on the answer

Every transition returns an ordinary value. Nothing in TypeScript makes a caller stop on
`adoptionRefused`, install the session it was handed, or refrain from building a `reapplied` outcome
of its own. What is closed is narrower and is what the tests pin: no path here writes, calls a
command, or adopts anything before the whole rebase has been decided. **The six components are
2c-4b-3's, and until they exist no mounted or window evidence is owed — or available.**

### 4.2 The obstacle codes have no sentences, so nothing can be false about them yet

Sixteen obstacle arms were added across six unions and **not one** has a dictionary key, an accessor or a rendered sentence.
That is deliberate (Q8 puts the prose in step 3), and it means this step cannot have committed the
defect class Q9 item 1 predicts — but it also means step 3 inherits the whole of it: the i18n suites
check parity and placeholders, never meaning, and no test in this repository can fail because a
sentence became untrue.

### 4.3 The `evidenceNotATarget` and `evidenceNotAnAnchor` arms are unreachable from the running
application

`save_match`, `delete_match`, `duplicate_match` and `move_match` all send an anchored subject, and
`create_match` always sends `Targetless`; a move or a creation with an `after` always sends an
anchored placement. So the arms that answer *the evidence is the wrong shape* cannot be produced by
today's command layer. They are kept because a `ReapplyEvidence` is a boundary value and nothing in
TypeScript proves which command produced one, and because treating the disagreement as a refusal
writes nothing. **The tests reach them by constructing the payload**, which is evidence about the
transition and not about the wire.

### 4.4 `notTheSameSequence` cannot be produced by a real file either

Today's projection gives a snippet file exactly one match list, so no file can put a snippet in a
second sequence. The test reaches the arm by giving a fixture's `MatchView.path` a different head —
the same technique `2c-4b-1-notes.md` §4.2 records for the Rust side, with the same limit: it does
not establish that a real projection with two match lists would produce those paths. Encoding the
coincidence instead — treating same-file as same-sequence — is what would make the model silently
wrong the first time a projection exposes a second list.

### 4.5 The window-side cases run against one `BrowserState`, through one surface

`workspace.test.ts`'s six reapply cases drive the deleter end to end: a real `createBrowserState`, a
real conflict registered by `rememberTheConflict`, and `state.adoptDiskVersion` as the adoption. They
cover `installed`, `alreadyThere`, a changed projection generation, a second spend from one session,
a second spend from a **second description of one wire conflict** (§7.1) and *no command called*.
They do **not** enumerate the surfaces — all six cases drive the deleter — so another surface wired to
a weaker door would be caught only by writing a case for that surface, exactly as
`2c-4b-1-notes.md` §7.4 records for the Rust command mapping.

**And the shared module's own suite never drives the real door.** `reapply.test.ts`'s adoption cases
pass `tokenCheckingAdoption`, a miniature that performs `BrowserState.adoptDiskVersion`'s first two
arms and no more; what they establish is which key the memo uses and which token comes back, never
that the real door then behaves as the contracts beside it say. Every claim about *one successful
adoption per wire conflict* rests on the six `workspace.test.ts` cases above and on nothing in
`reapply.test.ts` — round 2's first finding, and the reason both contracts now name the callback
those cases pass rather than the helper that passes it (§8.1).

### 4.6 A reapply moves the window, and the selection follows the ordinary rules

`adoptDiskVersion` calls `installView` and `repairAfter`, so a reapply repairs the selection
positionally and then checks it (R27) — which can drop the selection with a notice while the surface
goes on holding a rebuilt session for a snippet the middle pane no longer marks. That is existing,
correct behaviour and it is **not** something this step changed; it is written down because a panel
drawn in 2c-4b-3 will be on screen when it happens, and nothing here has read that on a screen.

### 4.7 The editor's `targetNotEditable` is this step's own addition, not the consult's

Q4's table is about fields. Handing back a session whose `canSave` is permanently `false` — because
`matchEditability` refuses the newly projected snippet outright — would be an offer this editor could
not keep, so the transition refuses instead. It is a conservative extension: it writes nothing and
adopts nothing, and it is stated here rather than presented as something the consult required.

---

## 5. Evidence

| Command | Result |
|---|---|
| `npm test` | **1587** passed, 49 files (was 1499, 48; 1585 before the review round of §7) |
| `npm run check` | **418** files, 0 errors, 0 warnings (was 416; the two new files are `reapply.ts` and `reapply.test.ts`) |
| `npm run build` | **175** modules (was 174) — exactly one new source module, `src/lib/browser/reapply.ts`, and `svelte/internal/server` is absent from the bundle |
| `cargo test --workspace` | 1086 passed, 0 failed — **unchanged**; no Rust file was touched |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `git status --short` | **no `.svelte` file** among the changes |

i18n is **745** keys per language, unchanged.

### 5.1 Falsifiability, measured by mutation

**Eight** mutations were applied to the production code, one at a time, and each was reverted after
its run. Six are single-line; B re-orders two statements, and G changes the memo's key at both its
read and its write, and the `WeakMap`'s own type parameter with them. G and H are the review round
of §7's, added to the six this step's first pass ran — the count below is the whole table and not the
first six of it. Every one flipped the assertions named and no others.

| Mutation | What broke |
|---|---|
| A — `fieldReapply`: drop `&& editable` from the satisfied-`Remove` row | `matchEditor.test.ts` *row 5 — a key the disk now writes as something unmodelled is not "already removed"* |
| B — `beginReapply`: check the conflict before the support declaration | `reapply.test.ts` *unavailable … conflict or not*; `rawEditor.test.ts` *unavailable with no conflict at all* |
| C — `matchMove.reapplyToDiskVersion`: drop the `sameSequence` conjunct | `matchMove.test.ts` *refuses a snippet the new parse addresses in another sequence* |
| D — `reapplyAuthorizationFor`: mint a fresh token instead of reading the memo | `reapply.test.ts` *spends one token per conflict*; `workspace.test.ts` *refuses a second reapply of one conflict* |
| E — `matchCreation.reapplyToDiskVersion`: keep `session.draft` instead of `retargetedDraft(…)` | `matchCreation.test.ts` *re-points the base at the new revision* and *withdraws consent collected before the conflict* |
| F — `matchDeletion.reapplyToDiskVersion`: adopt inside the correspondence-refusal arm | `matchDeletion.test.ts` *refuses a correspondence … and adopts nothing*; `workspace.test.ts` *sends no command and installs nothing on a manual-resolution refusal* |
| G — `reapplyAuthorizationFor`: key the memo on the `ConflictModel` again instead of on `.source` (§7.1) | `reapply.test.ts` *hands two descriptions of one wire conflict the same token*; `workspace.test.ts` *refuses the second of two descriptions of one wire conflict* |
| H — `confirmDelete`: compare `session.match` with itself instead of with `projected` (§7.3) | `matchDeletion.test.ts` *re-opens the deletion over the identified snippet* — the new negative half — and the two older deletion cases that already caught it |

**What the eight do not establish**: that every *other* assertion in the 86 cases this step wrote
could fail.
They were chosen for the properties most likely to be silently wrong — the presence-vs-editability
distinction, the permanence of raw's refusal, the same-sequence invariant, the one-spend binding, the
consent withdrawal, the decide-then-adopt ordering, the key the one-spend binding is keyed on and the
provenance of the identity a renewed deletion confirmation is checked against — and the rest of the
suite is ordinary coverage.

---

## 6. What 2c-4b-3 inherits

1. **Every sentence is still unwritten**, and Q9 item 1 is entirely ahead: the readiness line, the
   collision line naming fields, the *already satisfied* line that must not say *reapplied*, and the
   refusal sentences for twenty-odd codes in two languages. No test in this repository can fail
   because one of them is untrue.
2. **`offersReapply` and the `ConflictChoice` member land together**, with `conflictChoicesFor` as
   the only producer — the split that made a button compile and do nothing is what forbids adding
   either alone.
3. **Six components change, so six window readings are owed**, and the Q7 matrix is the plan. The
   deleter's renewed confirmation and the mover's *already satisfied* completion are the two arms a
   mounted suite must drive that no model test can reach.
4. **The two risks 2c-4b-1 handed on are unchanged**: `ReapplyEvidence` ties two fields nothing can
   bind together, and the command-level tests observe answers rather than requests
   (`2c-4b-1-notes.md` §7.4).

---

## 7. Review round 1 — `docs/reviews/phase-2c-4b-2-code.md`

**Verdict NOT READY, four findings — one defect and three false claims — and all four are closed,
each where the thing that was wrong lived.** Only finding 1 changed production behaviour:
`REAPPLY_AUTHORIZATIONS` in `saveOutcome.ts` is read and written on `conflict.source` instead of on
the model, its `WeakMap` type parameter changed with them, and two cases were added to hold it there.
The other three changed no behaviour at all, because none of them was a behaviour: finding 2 narrowed
a **fixture's JSDoc** to the equality `makeConflict` actually constructs, finding 3 added the
**negative half of a test** that had been comparing two identities minted together, and finding 4
narrowed two **contract comments** — `reapply.ts`'s module header and `adoptForReapply`'s own — from
a containment TypeScript does not force to the implementation fact that does hold, the second of
which then overshot in the other direction (§8.1). Findings 1 and 4
were two views of one thing: the one-spend binding was keyed on the wrong value, and the module
contract described a containment it did not have. Findings 2, 3 and 4 were this project's named worst
defect class — a sentence claiming a guarantee the code beside it does not give — and finding 1's
first correction was a fourth instance of it (§7.5).

### 7.1 Medium — the reapply authorization was keyed to a derived model

`REAPPLY_AUTHORIZATIONS` in `saveOutcome.ts` was a `WeakMap` keyed by `ConflictModel`, while the
conflict identity `BrowserState` registers is `ConflictModel.source`. `describeEditSave` builds a
fresh model per call, so **describing one `ConflictResult` twice produced two models and two unspent
tokens**. The second token passed `authorizeDiskAdoption`, and `adoptDiskVersion` then answered
`alreadyThere` — its satisfied-request arm is checked *before* the projection-generation arm — so one
wire conflict obtained **two successful adoptions** and could hand back two rebuilt destructive
sessions. §2.3's claim that the origin-and-generation check covered this was false, and the
correction block there says so.

**The fix is the narrow one the review named**: the memo is keyed on `conflict.source`. A second
model of one wire conflict is now handed the first model's token, which `authorizeDiskAdoption`
refuses because the token is bound to the model it was minted for; a second attempt from the *same*
model is refused as spent, exactly as before. Nothing else changed — not the door, not its five
checks, not `DiskAdoptionOutcome`.

Two cases were added, and both fail under mutation G. `reapply.test.ts` *hands two descriptions of
one wire conflict the same token* drives it through a fake adoption that performs the door's first
two checks only; `workspace.test.ts` *refuses the second of two descriptions of one wire conflict*
drives it through a real `createBrowserState`, by calling `applyDeletion` twice over one `SaveResult`
— which is why `deletionUntilItConflicts` now exists beside `conflictedDeletion` in that suite.

### 7.2 Medium — the conflict fixture claimed a pairing it cannot bind

`makeConflict`'s JSDoc said reading `disk_revision` off the disk projection meant "no case can pair a
revision with a projection of other bytes". It does not: `revision` is an ordinary string on a
caller-supplied `DocumentView`, `diskText` is independently settable and defaults to a fixed comment
line unrelated to the projection, and nothing hashes anything. **Both sentences are now narrowed to
the one property forced** — `disk_revision` equals the supplied projection's `revision` — and each
says in the same breath what is *not* forced: that neither field is proved to be the hash or the
parse of `disk_text`, and that the identified subject and placement are not proved to belong to that
projection either. `ConflictOverrides.diskText` gained a doc block saying its default is not a
serialisation of `disk`. The record's own §1 row is corrected to match.

### 7.3 Low — the renewed-confirmation assertion compared identities minted together

`matchDeletion.test.ts`'s reapply case asserted that the renewed confirmation "really does resolve
against the new parse", but `answer.session.match` and `live(disk)` were both `disk.matches[0]!.id`.
Replacing `confirmDelete`'s live-projection argument with the session's own identity left it green.

**The positive assertion is kept, with its comment corrected to say what it does and does not
prove**, and a second, negative half is added: a third writer reparses the file into `LATER`, the
identity the window then gives that snippet differs from the rebuilt session's own, and the
confirmation must refuse. Mutation H — `confirmDelete` comparing `session.match` with itself instead
of with `projected` — was applied and this case failed at that exact line, then the mutation was
reverted.

### 7.4 Low — the shared-module contract claimed an unbypassable route

`reapply.ts`'s header said a surface "cannot reach the adoption without going through
`adoptForReapply`". `reapplyAuthorizationFor`, `confirmReloadDiskVersion` and
`BrowserState.adoptDiskVersion` are all exported, so the two halves compose directly and TypeScript
does not object. **The sentence now claims the implementation fact instead** — every reapply
transition in this repository that adopts anything takes that route, which is the five match
surfaces, the raw editor's having no adoption function at all, and each surface's own suite is what
keeps it that way — and it states in the same place what is closed regardless of route, by a run-time
check rather than by a type: no adoption can be had for a conflict the window never registered.
`adoptForReapply`'s own JSDoc was narrowed the same way.

### 7.5 What the sweep found

Written from what the code now says rather than from the findings' wording.

- **Every identity-keyed map was re-read.** `conflictOrigins` (wire value), `spentConfirmations` (the
  token itself) and `SEALS` (a value minted once) are keyed on the right subject.
  `CONFIRMATIONS` maps a token to the **model** it was minted for, and that is deliberate and now
  load-bearing: it is the check that refuses a second model of one wire conflict. Every surface's
  `conflictOf` reads a model stored on the session rather than deriving one per call, so the
  two-model case arises only where an `apply*` runs twice over one `SaveResult` — which is the case
  §7.1 closes.
- **No other production caller re-describes one result.** The five `describeEditSave` call sites are
  one per `apply*`, each called once on the ordinary path.
- **`reapply.test.ts`'s two adoption comments said "the conflict state"** where the key is now the
  wire value; both were corrected, along with the suite's own header, and the second case renamed to
  *mints a different token for a different wire conflict*.
- **`saveOutcome.ts`'s first correction of finding 1 was itself false and was rewritten.** It said
  the projection-generation check answers a caller that mints its own token. It does not — the
  `alreadyThere` arm is reached first — so the sentence now says what actually happens and names the
  implementation fact that holds instead.
- **No Rust change was forced by any finding**, and none was made.

### 7.6 Evidence for this round

| Command | Result |
|---|---|
| `npm test` | **1587** passed, 49 files (1585 before) |
| `npm run check` | **418** files, 0 errors, 0 warnings |
| `npm run build` | **175** modules — unchanged, no new source module; `svelte/internal/server` absent |
| `cargo test --workspace` | **1086** passed, 0 failed — unchanged; no Rust file touched |
| `git status --short` | no `.svelte` file among the changes |

---

## 8. Review round 2 — `docs/reviews/phase-2c-4b-2-code-round2.md`

**Verdict NOT READY, three findings, and every one of them is a sentence rather than a behaviour.**
Two were introduced by round 1's own fix and one survived its sweep, which is this repository's
recorded recurrence: each round's fix produces the next round's finding (`CLAUDE.md` section 6). The
round found **no algorithmic defect**, and nothing executable was changed to close it — every edit
below is a JSDoc block, a test comment or this record, and `git diff` over the `.ts` files in this
round touches no statement.

### 8.1 Medium — `adoptForReapply` claimed a one-spend guarantee its callback boundary does not give

Round 1's fix rewrote `adoptForReapply`'s JSDoc to say the helper forces one wire conflict to yield
at most one successful adoption. It does not. The helper hands the memoized token to an ordinary
`AdoptTheDiskVersion` and returns whatever that callback answers; called twice with one conflict and
`() => 'installed'`, it answers `installed` twice. §2.3's corrected paragraph carried the same claim.

**Both sentences now split the fact from the type**, and the split is the same one 2c-1a's review
demanded: what the helper forces is that every `ConflictModel` over one wire conflict is handed the
*same* token and that the callback is called once with it, and — in the same sentence — that an
arbitrary callback can ignore both the token and the spend. *At most one successful adoption per
wire conflict* is stated as an implementation fact about the one callback the five match transitions
pass, `BrowserState.adoptDiskVersion`, whose model-bound authorization and spent-confirmation guard
are what actually refuse the second attempt. §4.5's new paragraph names the evidence for that fact
and the evidence that does **not** cover it.

### 8.2 Low — the door description still put `alreadyThere` behind the generation check

A survivor of round 1's finding 1: that fix corrected `saveOutcome.ts`'s paragraph about a
self-minted token and stopped there, leaving `reapply.ts`'s module header, `adoptForReapply`'s own
JSDoc and §2.3 above describing `BrowserState.adoptDiskVersion` as a set of five checks applied
alike. It is not a set. Four of them — authorization, spend, origin, projection held — precede every
successful answer; `alreadyThere` is then decided **and its token spent** at
`workspace.svelte.ts:1793-1800`, before the projection generation is inspected at all, so the
generation comparison guards only the branch that installs. All three places now say that ordering,
and the search that found them was written from what the method does rather than from either
finding's wording.

This never was a production defect: equal content revisions mean the window already holds the
requested bytes, and the `alreadyThere` arm spends the token. It was two contracts claiming a guard
their successful arm does not execute.

### 8.3 Low — the fix-round record miscounted its own mutations and misplaced three closures

§5.1 said "six one-line mutations" over a table that had grown to A–H, and its own following
sentence already called them eight. §7's opening said all four round-1 findings were "closed in
production code"; only finding 1 was. **Both are corrected**: the count is eight, with the two that
are not single-line named, and the round-1 summary now says where each closure actually landed — one
line of `saveOutcome.ts` for finding 1, a fixture's JSDoc for 2, a test's negative half for 3, and
two contract comments for 4. A record that overstates its own rigour is the same defect as one that
overstates the code's.

### 8.4 What this round's sweep found

Three things fixed here — each a narrower instance of a finding this round or the last one named —
and one older instance left standing on purpose.

- **`workspace.test.ts`'s "one conflict, one token" case still said the memo was keyed "on the
  conflict state".** §7.5 records that sweep correcting exactly this wording in `reapply.test.ts`
  and its header; the fourth instance, in a different file, survived it. The comment now names
  `ConflictModel.source` and says it is not the model.
- **`reapplyAuthorizationFor`'s JSDoc carried finding 1's overclaim too**, in the same words and one
  module away, and the review named only `reapply.ts` and this record. It is corrected identically.
- **§1's test rows were wrong about their own arithmetic.** "Six sibling `.test.ts` files, 76 further
  cases" is **seven** files and **74** cases. 12 + 74 is 86, and the suite grew by **88** because
  `scripts/lint/ipc-detail.test.ts` — which nothing in this step touched — enumerates the sources
  under `src/` and so gained one case for each of the two new files. §1 now carries that row and
  §5.1 says 86 cases were written where it said 88 new cases. Measured by running the suite from a
  pristine `git archive HEAD` copy and differencing the per-file counts, not by counting `it(` lines,
  which under-counts wherever an `it.each` expands.

**The oldest instance is at `workspace.svelte.ts:615` and was left as it is.** `BrowserState`'s own
interface doc says *"Five things are checked here, in order"* and then lists all five, with the
`alreadyThere` paragraph three paragraphs below and saying nothing about where in that order it
returns — so a reader draws the same false conclusion finding 2 named, from the file that decides it.
It shipped at 2c-4a-2, it is committed, and this step has not otherwise touched
`workspace.svelte.ts`; correcting it here would put a file this step does not change into this step's
diff, which the evidence rows above assert about. It is written down instead, exactly as
`CLAUDE.md` section 6 writes down `browser.matchMove.refused.unsavedDraft`.

### 8.5 Evidence for this round

Every count is unchanged, which is what a round that edits only prose must produce.

| Command | Result |
|---|---|
| `npm test` | **1587** passed, 49 files — unchanged |
| `npm run check` | **418** files, 0 errors, 0 warnings — unchanged |
| `npm run build` | **175** modules — unchanged; `svelte/internal/server` absent from the bundle |
| `cargo test --workspace` | **1086** passed, 0 failed — unchanged; no Rust file touched, in this round or any other of this step |
| `git status --short` | no `.svelte` file among the changes |

---

## 9. Review round 3 — the confirmation pass

Round 3 was commissioned as a **narrow confirmation** of round 2's three closures, not as a fresh
review of the step: the round-2 fix had touched only JSDoc, one test comment and this record, and the
question was whether the prose had converged. Verdict: **NOT READY**, one Low, and it is a
**survivor** — the fourth appearance of the same claim across three rounds.

### 9.1 Low — the module header still omitted authorization and spend

§8.2 above named three places that described `BrowserState.adoptDiskVersion` as a set of five checks
applied alike, and said all three now state the real ordering. **That claim was false of one of
them.** `reapply.ts`'s "three things this module owns" list still read *"whose existing origin and
projected-document checks precede every successful answer"* — omitting the two checks that come
first, authorization and spend, and saying nothing about `alreadyThere` being decided and spent
before the projection generation is inspected.

The fix is that sentence and nothing else: it now names all four checks that precede every successful
answer, states that the `alreadyThere` arm spends its token before the generation is inspected, and
draws the *therefore* to the generation check guarding only the installing branch — the same wording
§8.2 uses. **§8.2's own "all three places" sentence is left as written and corrected here**, in the
project's convention of leaving a superseded record where it was and putting the correction beside
it.

This was never a production defect at any of its four appearances. It was a contract describing a
method's guards in the wrong shape, and the reason it survived three rounds is the reason this
repository writes down: each sweep was written from the previous finding's wording rather than from
what the method does.

### 9.2 What round 3 did not cover

By construction. It did not re-review the step's algorithm, the per-surface transitions, the field
table, or anything rounds 1 and 2 ruled on — only the round-2 fixes, whether they introduced
anything, and whether F2 had a remaining instance. It also confirmed as acceptable the one instance
deliberately left standing: `src/lib/browser/workspace.svelte.ts:615`'s *"Five things are checked
here, in order"*, shipped and committed at 2c-4a-2 and therefore outside this step's diff, recorded
in §8.4 rather than fixed. **It is debt this step names and does not pay**, and step 2c-4b-3 — which
does touch that area — is where it should close.

### 9.3 Evidence for this round

| Command | Result |
|---|---|
| `npm test` | **1587** passed, 49 files — unchanged |
| `npm run check` | **418** files, 0 errors, 0 warnings — unchanged |
| `npm run build` | **175** modules — unchanged; `svelte/internal/server` absent from the bundle |
| `cargo test --workspace` | **1086** passed, 0 failed — unchanged; no Rust file touched |
| `git status --short` | no `.svelte` file among the changes |

Codex did not write a round-3 review file, so there is no `docs/reviews/phase-2c-4b-2-code-round3.md`
and this section is the round's only record. The finding is reproduced above in full.
