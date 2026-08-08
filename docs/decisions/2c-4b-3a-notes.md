# Phase 2c-4b-3a — decision record

**The offered choice: `keepMyDraft` drawn on five surfaces, refused on the sixth.**
`ConflictChoice` gained a member, `ConflictCapabilities` gained the `offersReapply` boolean 2c-4b-2
deliberately did not build, and `conflictChoicesFor` — still the only producer of a choice list —
gates the new member on **both**. The five match surfaces flipped the boolean over the transitions
2c-4b-2 had already built and driven; the raw editor declares it `false` beside its permanent
`reapplySupport: 'unavailable'`, and `conflictChoicesFor` would refuse it either way. **No
transition was invented, no Rust file was touched, and no new source module exists.**

The authority for this step is `docs/reviews/phase-2c-4b-design.md` — the design consult — under
**Q6** (naming, ordering, confirmation and the sentence beside the control) and the "### 2c-4b-3"
subsection of **Q8**, minus the window matrix, which is 2c-4b-3b's and 2c-4b-3c's. Where this record
and that document disagree, the consult is right and this is a bug.

**No window reading was taken and none is claimed.** A mounted test proves a handler fires; it does
not prove a window draws. Six components changed, so six readings are owed, and they are 2c-4b-3c's.

---

## 1. What this step built

| File | What it is |
|---|---|
| `src/lib/browser/saveOutcome.ts` | `ConflictChoice.keepMyDraft`; `ConflictCapabilities.offersReapply`; the two-gate branch in `conflictChoicesFor`; `reapplyIsOffered`; `reapplyReadinessKey`; `conflictChoiceKey`'s third draft-kind branch |
| `src/lib/browser/reapply.ts` | `ReapplyOutcomeCode`, `reapplyOutcomeKey`, `sharedReapplyObstacleKey`, `ReapplyAttempt<S, O>`, `attemptOfReapply`, `reapplyToShow` — the presentation half, no transition changed |
| `src/lib/browser/matchEditor.ts` | `offersReapply: true`; `editorReapplyObstacleKey`; `EditorReapplyAttempt`; `MatchEditorView.reapplyOffered` |
| `src/lib/browser/matchCreation.ts` | `offersReapply: true`; `creationReapplyObstacleKey`; `CreationReapplyAttempt`; `MatchCreationView.reapplyOffered` |
| `src/lib/browser/matchDeletion.ts` | `offersReapply: true`; `deletionReapplyObstacleKey`; `DeletionReapplyAttempt`; `MatchDeletionView.reapplyOffered` |
| `src/lib/browser/matchDuplication.ts` | `offersReapply: true`; `duplicationReapplyObstacleKey`; `DuplicationReapplyAttempt`; `MatchDuplicationView.reapplyOffered` |
| `src/lib/browser/matchMove.ts` | `offersReapply: true`; `moveReapplyObstacleKey`; `MoveReapplyAttempt`; `MatchMoveView.reapplyOffered` |
| `src/lib/browser/rawEditor.ts` | `offersReapply: false`, and the doc block saying why a `true` here would still draw nothing |
| `src/lib/browser/workspace.svelte.ts` | **prose only** — §4 below: the *"Five things are checked here, in order"* passage |
| `src/lib/browser/editorSave.ts` | **prose only** — a narrower instance of the same claim (§4.1) |
| five `.svelte` files | the `keepMyDraft` arm, the `keepMyDraft()` handler, the attempt state, the readiness line and the report block |
| `src/lib/components/RawEditor.svelte` | one `switch` arm that returns, and the corrected paragraph about the phrase |
| `src/lib/i18n/en.json`, `es.json` | **24 keys each**, 745 → **769**, at parity |
| `src/lib/i18n/index.ts` | `describeReapplyOutcome`/`tReapplyOutcome`, `describeReapplyReadiness`/`tReapplyReadiness`, and one composing describer + accessor per surface |
| six `.test.ts` files + `reapplyCodes.test.ts` | 36 further cases, 1587 → **1623** |

---

## 2. The decisions

### 2.1 D1 — the boolean and the member land together, and the gate is two conditions

`conflictChoicesFor` names `keepMyDraft` only when `capabilities.offersReapply` **and**
`capabilities.reapplySupport === 'supported'`. The first is what the surface draws today; the second
is a permanent fact about whether an honest reapply could ever be had there. The split is the same
one `offersCopyDraft` has against `draftKind`, and for the same reason: the raw editor's refusal is a
property of a whole-document candidate and not of a caller's opinion, so a surface that sets the
boolean beside `unavailable` still gets no control. `RawEditor.test.ts` and `saveOutcome.test.ts`
both drive that combination.

**What this forces and what it does not, in the same sentence.** It forces that a control cannot be
named without both declarations, and that no surface can append the choice locally, because
`conflictChoicesFor` is the only producer of a `ConflictChoice` list. It does **not** force that a
component acts on what it is named — nothing in TypeScript can — and what covers that is the five
mounted suites that press the control and observe the transition's effects.

### 2.2 D2 — the ordering is Q6's, and the reload's step is deliberately not consulted

`keepEditing`, `copyDraft`, `keepMyDraft`, then the reload pair. The reapply writes nothing, discards
nothing and asks no second question, so it belongs above the choice that abandons the draft and below
the copy that makes abandoning it survivable.

**It is not withheld when a reload spend has been refused.** `ConflictReloadStep` `'unavailable'`
records that a *reload* was refused; a reapply is a different question with a different
authorization, and a person who presses it in that state is answered by whatever that attempt
honestly ends as rather than by a control that vanished without a word. That is a deliberate
asymmetry with the reload's own rule and `saveOutcome.test.ts` drives all three steps.

> **Corrected in the fix round (section 7.2).** This paragraph said *"is answered by the honest
> `adoptionRefused` sentence"*, which names one of six arms as though it were the outcome. A refused
> reload spend says nothing about what a reapply will answer: the attempt may refuse for
> correspondence before it asks the window at all, and the window's own guards may pass. The claim in
> the code (`conflictChoicesFor`'s JSDoc) said the same thing and is corrected with it.

### 2.3 D3 — the fold lives in `reapply.ts`, and staleness is impossible by construction

`attemptOfReapply(held, outcome)` decides which arms replace the session — `reapplied` and
`alreadySatisfied`, the two that have already adopted — and it lives in the shared module because
five panels ask the question and **a rule written into one renderer is carried by that renderer's
mounted suite alone** (2c-3c-3's Medium). `reapplyToShow(attempt, session)` answers the outcome only
while the attempt's own session is still the one on screen, by reference equality; every transition
in this repository returns a new session value, so the next thing the person does drops the report
and no component has to remember to clear it.

**What that forces and what it does not.** It forces that a report cannot outlive the session it
describes. It does not force that a panel installs the session it is handed, or that it asks
`reapplyToShow` rather than reading `ReapplyAttempt.session` directly — both are ordinary values, and
each component's mounted suite is what drives its own handler.

### 2.4 D4 — the report is component state and the sentences are the model's

A conflict's `SaveOutcomeModel` is gone the moment a reapply succeeds — the rebuilt session carries
`outcome: null` — so a report drawn inside the outcome panel would disappear at the moment it had
something to report. It is therefore drawn from a `$state.raw<…ReapplyAttempt | null>` in its own
block above the outcome panel, exactly as `MatchDeleter.svelte` already holds `confirmationRefused`.
**Nothing about *what* it says is decided there**: the arm's sentence comes from `tReapplyOutcome`
and the obstacle's from that surface's own composing accessor, and the component's walk is
`{#if report.kind === 'manualResolution'}` and nothing else.

### 2.5 D5 — one sentence per obstacle arm, composed in the i18n layer

Each surface has a `…ReapplyObstacleKey` beside its own union, delegating to
`sharedReapplyObstacleKey` for the two arms that are about the *evidence*, so
*espansoConfig could not establish correspondence* is one sentence across five surfaces rather than
five that have to be kept in step. Six arms carry a nested code — the wire's `ReapplyRefusal` on
`correspondence` and `anchorCorrespondence`, and a model code on `creationRefused`, `notDeletable`,
`notDuplicable` and `moveRefused` — and **the i18n layer composes the two into one string** rather
than leaving each renderer to draw the second line. A renderer that forgot it would leave a person
with a refusal and no reason, and no key-parity suite could see the difference;
`reapplyCodes.test.ts` now asserts the containment for every one of the six.

**The composing describers are in `index.ts` and not in `codes.ts`.** `codes.ts` describes *wire*
enums and imports nothing from `src/lib/browser/`; every browser-side accessor in this project —
`tDeletionRefusal`, `tConflictOperation`, `tReloadUnavailable` — is an `index.ts` function over a key
function that lives beside the union. These follow that, with a locale-parameterized `describe*`
beside each `t*` so a test can drive both languages without touching the locale store.

### 2.6 D6 — the label branches on the draft kind, and so does the readiness line

*Keep my draft* names text on the raw editor, the match editor and the creator; on the mover, the
deleter and the duplicator nobody typed anything, so the label is `keepMyRequest` and the readiness
sentence is `readyOperation`, which says **requested action**. That is the third branch through
`draftKindWording`, after `keepEditing` and `confirmReload`, and it is 2c-4a-3b's finding applied to
the sentence this step adds rather than rediscovered on a screen later.

`MatchDeletionView.reapplyOffered` and its four siblings are computed with `reapplyIsOffered` over
the **produced choice list**, never from the surface's own capability record: the sentence beside the
control and the control itself must come from one authority, and asking the declaration instead would
be expressing capability twice — the split that once let a button compile and do nothing.

### 2.7 D7 — a deletion re-asks its own confirmation, and nothing here re-raises it

Consult Q6: there is no second *are you sure?* merely because the reload has one. The deleter's
rebuilt session has nothing pending, so the request control returns and the person answers a question
about the snippet the **live projection** names — `MatchDeleter.svelte` reads that identity at the
click and from nowhere else. `keepMyDraft()` does not call `requestDelete`, deliberately: doing so
would be this renderer deciding something the model already decided.

---

## 3. What this step deliberately did **not** do

- **No window reading, no probe bundle, no launch.** 2c-4b-3b rebuilds the external-writer
  instrument and 2c-4b-3c runs Q7's eight-reading matrix. Every claim below is about tests.
- **No Rust change of any kind.** `cargo test --workspace` is unchanged at 1086, and no command, wire
  type or dictionary contract moved.
- **No new source module**, so `npm run build` stays at 175 and `svelte/internal/server` is absent
  from the bundle.
- **No transition changed.** Every `reapplyToDiskVersion` is byte-for-byte as 2c-4b-2 left it; what
  was added around them is a choice member, a boolean, key functions, accessors and markup.
- **No reapply on the raw editor**, and no route to one: its transition still takes no adoption
  function at all.

---

## 4. The inherited prose defect, closed — and the sweep

`src/lib/browser/workspace.svelte.ts:615` read *"Five things are checked here, in order"* over a flat
list of five, with the `alreadyThere` arm described three paragraphs below and saying nothing about
where in that order it returns — so a reader drew the false conclusion **from the file that decides
it**. The passage now states the real sequence as six steps, with `alreadyThere` as step 5 (decided,
and its token spent, before the generation is inspected) and the generation comparison as step 6,
guarding only the branch that installs. `2c-4b-2-notes.md` §8.4 and §9.2 named this as debt that step
2 would not pay; it is paid.

### 4.1 What the sweep found, written from what the code does

> **This sweep was incomplete, and section 7.3 is what completes it.** Every passage below was
> rewritten to qualify the generation check — and each rewritten passage then listed the *other*
> causes as a set of three, omitting a confirmation issued for another conflict and an unprojected
> document. The qualifier was added and the enumeration was left as it was found; the review's
> finding 3 is exactly that. The text below is kept as this step wrote it.

Searched for descriptions of `BrowserState.adoptDiskVersion`'s guards rather than for the words the
old finding used. Four further places listed *a projection replaced since the conflict arrived* as a
refusal cause with no qualifier — which is **only** true when the window does not already hold the
requested revision, because the satisfied arm returns first. All are corrected:

- `src/lib/browser/editorSave.ts`, `spendTheConfirmedReload`'s JSDoc, which also listed three of the
  five causes as though they were all of them;
- the identical *"A `refused` from `adopt` — …"* paragraph in all five match modules'
  `reloadTheDiskVersion`;
- `rawEditor.ts`'s `loadDiskVersion`;
- `reapply.ts`'s `ReapplyOutcome.adoptionRefused` arm;
- `saveOutcome.ts`'s `reloadUnavailableKey`, whose numbered list is explicitly exhaustive — item 5
  now carries the qualifier, and its "no control drawn while a conflict panel owns the interaction
  removes or replaces a projection" argument is **no longer true as written**, because *Keep my
  draft* adopts through the same door. That paragraph now says so, and says what actually holds
  instead: the two arms that adopt hand back a session whose outcome is `null`, so the panel that
  could offer a reload is gone in the same synchronous handler, and the arms that leave the panel
  standing adopt nothing. **That is an implementation fact about six transitions and six components,
  not something the types force.**

`docs/decisions/2c-4b-2-notes.md`'s mentions of the old wording are left exactly as written: they are
that step's record of finding it.

---

## 5. Evidence

| Command | Result |
|---|---|
| `npm test` | **1623** passed, 49 files (was 1587, 49) |
| `npm run check` | **418** files, 0 errors, 0 warnings — unchanged; no new source or test *file* was created |
| `npm run build` | **175** modules — unchanged, because no source module was added; `svelte/internal/server` absent from the bundle |
| `cargo test --workspace` | **1086** passed, 0 failed — unchanged; no Rust file touched |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| i18n | **769** keys per language, at parity (was 745) |

### 5.1 What the 36 new cases cover

- **`saveOutcome.test.ts` (8 cases)** — the ordering; both gates over all four combinations; the
  reapply offered at every reload step including `unavailable`; the raw editor refused **even with
  `offersReapply: true`**; the five match declarations; `reapplyIsOffered`; the two readiness keys and
  the two labels, each with a word check that the operation-choice versions claim no typed text.
- **`reapply.test.ts` (4 cases)** — which arms replace the session and which do not; the
  reference-equality staleness rule; a `Record` over `ReapplyOutcomeCode` giving every arm its own key
  and a sentence in both languages; both shared obstacles likewise.
- **`reapplyCodes.test.ts` (4 cases)** — every arm of all five obstacle unions renders a non-`undefined`
  sentence containing its own key's text, in both languages, with one key per arm; the six nested codes
  are rendered beside the obstacle; `{fields}` is filled from the detail pane's own labels; the
  readiness line and all six arms describe.
- **Five mounted suites (19 cases)** — the control and the right readiness sentence on each of the
  five; a press that adopts and rebuilds on each of the five; the deleter's renewed confirmation, and
  its refusal while the window still holds the old parse; the mover's `alreadySatisfied`; the editor's
  field collision naming the field; refusal arms adopting nothing on four surfaces; the duplicator's
  consent starting again; the creator's acknowledgement round trip starting again.
- **`RawEditor.test.ts` (2 cases)** — no control and no readiness line on a real conflict panel, over
  **both** possible labels, and the declaration checked directly so a later boolean flip cannot undo
  the ruling silently.
- The remaining eleven pre-existing assertions about choice lists were updated, and the two cases
  named *"none is called keep my draft"* were **inverted rather than deleted**: exactly one label may
  now wear the phrase and every other must still not.

---

## 6. What this step does not cover, stated as holes

### 6.1 Nothing here has been seen on a screen

Six components changed. A mounted test drives real DOM events in jsdom and proves a handler fires; it
proves nothing about layout, focus order, scroll reachability, the Spanish column, or whether the
readiness sentence is legible where it lands. Q7's matrix is 2c-4b-3c's and **this step's evidence
does not anticipate it**.

### 6.2 No test can fail because a sentence became untrue

Twenty-four new strings, in two languages, and the i18n suites check key parity and placeholder
agreement only. The readiness line is the one the consult spends most of Q6 on, and the only thing
holding it to Q6's requirements is that it was written against them and read: `reapplyReadinessKey`'s
JSDoc says what the sentence must and must not claim, and nothing executes that JSDoc. The word
checks in `saveOutcome.test.ts` fire on *specific* phrases — *your text*, *you typed*, *draft* on an
operation-choice label — and say nothing about whether the replacement reads well.

### 6.3 The component-held attempt is not reachable by a model test

`reapplyToShow`'s rule is driven in `reapply.test.ts` over a stand-in session type, and the
components' use of it is driven by five mounted suites. What no test reaches is a component that
stores the attempt but never installs `attempt.session`, or one that reads `attempt.outcome`
directly: both compile, and only the mounted suites' assertions about the panel's own state would
catch them — on the surfaces that have such an assertion.

### 6.4 The obstacle-line composition is joined with a space, in both languages

`obstacleWithRefusal` and its siblings concatenate two localized sentences with one space, and
`describeEditorReapplyObstacle` joins the collided field names with `', '`. Neither is
locale-sensitive. Both shipped languages are fine with it; a locale whose list separator differs would
need its own rule, and `index.ts` says so where it does it rather than leaving it to be discovered.

### 6.5 Two obstacle arms are still unreachable from the running application

`evidenceNotATarget` and `evidenceNotAnAnchor` cannot be produced by today's command layer
(`2c-4b-2-notes.md` §4.3), and `notTheSameSequence` cannot be produced by a real file
(§4.4). They now have sentences and the mounted suites reach the first by constructing the payload —
which is evidence about the panel, not about the wire.

### 6.6 The three risks 2c-4b-2 handed on are unchanged

`adoptForReapply` is still not a route a caller is forced through; `ReapplyEvidence` still ties two
fields nothing can bind together; and the command-level tests still observe answers rather than
requests. Nothing in this step narrows any of them.

---

## 7. The fix round — `docs/reviews/phase-2c-4b-3a-code.md`

The review's verdict was **NOT READY** over four findings, every one of them a sentence that claims
more than its predicate carries. All four are closed, and each was then swept for the narrower
instance this repository's fix rounds keep leaving standing.

**Nothing in this round changes behaviour.** Every edit is a dictionary string, a JSDoc, a code
comment or a markup comment; no transition, no predicate, no key and no type moved. **No test was
added and none was changed to assert something new**, and that is a statement about what a test in
this repository can do rather than an omission: a suite that could fail for any of these four
findings would have to assert what a sentence *means*, and §6.2 above is the standing record that
none does. The thirteen test files whose comments changed are corrected **because the comment
described the production rule wrongly**, not because the assertion beneath it moved.

**Two `.svelte` files changed and both changes are comments.** `MatchEditor.svelte` and
`RawEditor.svelte` carry one corrected markup comment each. No window reading is invalidated, because
this step never took one: the six readings are still 2c-4b-3c's, exactly as §6.1 says.

### 7.1 Finding 1 (High) — the readiness line promised a form that `alreadySatisfied` never returns

`browser.reapply.ready` said *"If it can, what you get back is a form to send"* and
`browser.reapply.readyOperation` said *"the action is set up again over that version for you to
send"*; `es.json` said the same in *"un formulario por enviar"* and *"para que la envíe"*. Safe
correspondence does not imply a pending save: `reapplyToDiskVersion` answers `alreadySatisfied` when
the newly parsed document already holds the requested result, and `MatchMover.test.ts` exercises that
arm. Both sentences now name the two successful shapes **as possibilities and not as an exhaustive
pair**, and close with *however it ends, you are told, and nothing is written until you send
something* — because `manualResolution` and `adoptionRefused` are endings a safe-looking press can
also reach, and an *either/or* would have replaced one false promise with a smaller one.

`reapplyReadinessKey`'s JSDoc in `saveOutcome.ts` and the matching comment in `saveOutcome.test.ts`
both enumerate what Q6 requires of these sentences; both now carry *a safe match promises no
particular ending* in that list, so the next reader checking the string against the contract is
checking against the corrected contract.

### 7.2 Finding 2 (Medium) — the result prose claimed the attempt moved the window, and that a refusal is permanent

Two separate over-claims in one finding.

**"espansoConfig moved this window to the version on disk"** was in both `reapplied` and
`alreadySatisfied`. A successful reapply may have received `DiskAdoptionOutcome` `alreadyThere`, in
which case this click installed nothing. Both sentences now open *This window now shows the version
on disk* — which is what the predicate proves — in English and in Spanish.

**"Asking again about this same conflict cannot change that answer"** was in `adoptionRefused`. It is
false in the one place it matters: a refusal returns *before* `spentConfirmations.add`, so the
memoized token is unspent; `attemptOfReapply` leaves the session as held, so the conflict panel and
its *Keep my draft* control are still there; and a second press over a window that has meanwhile
reprojected to the requested revision is answered `alreadyThere` at guard 5. The sentence now offers
the two ways forward without claiming either is the only one.

The narrower instances of the permanence claim are §7.5.

### 7.3 Finding 3 (Low) — the swept adoption contracts named a subset of the five refusal causes

**Verified against the code, not against §4.1.** `adoptDiskVersion` in `workspace.svelte.ts` is six
guards in this order, and the order is what the prose kept getting wrong:

1. `authorizeDiskAdoption` answers `null` — the confirmation was issued for another conflict →
   `refused`;
2. `spentConfirmations.has(confirmation)` → `refused`;
3. no origin recorded for `conflict.source`, **or** the recorded origin names a different document
   from `adoption.disk.id` → `refused`;
4. `viewOf(origin.document)` is `undefined` — the document is not projected here → `refused`;
5. `held.revision === adoption.diskRevision` → the confirmation **is spent** and the answer is
   `alreadyThere`;
6. `origin.generation !== projectionGenerationOf(origin.document)` → `refused`.

So five refusal returns, one satisfied return, and the generation guards **only** the branch that
installs. The single ordered sentence the review dictated now stands at all nine
passages: the five identical `reloadTheDiskVersion` blocks (`matchEditor.ts`, `matchCreation.ts`,
`matchDeletion.ts`, `matchDuplication.ts`, `matchMove.ts`), `rawEditor.ts`'s `loadDiskVersion`,
`reapply.ts`'s `adoptionRefused` arm, and — as narrower instances the review did not name —
`saveOutcome.ts`'s `DiskAdoption` doc block and `editorSave.ts`'s `ReloadStep.refused`. Each also
keeps the qualification that `alreadyThere` is decided, and its token spent, before the generation is
compared.

`editorSave.ts`'s `spendTheConfirmedReload` and `workspace.svelte.ts`'s own passage were already
exhaustive and are untouched; `reapply.ts`'s `adoptForReapply` names the first four guards explicitly
and then steps 5 and 6, which is the same sequence in longer form, and is untouched too.

**One header line was also wrong.** `ReloadStep.refused` opened *"The confirmation was spent and the
window refused to move"*; a refusal adds nothing to `spentConfirmations`, so it now says
*presented*. The six `reloadUnavailable` view fields keep the word *spent*, because there it names
`spendTheConfirmedReload`, the surface-side operation, and not the window's ledger.

**Eight test-side copies of the three-cause list** were corrected with them: the `adopting` helper's
JSDoc in `matchEditor.test.ts`, `matchCreation.test.ts`, `matchDeletion.test.ts`,
`matchDuplication.test.ts`, `matchMove.test.ts` and `rawEditor.test.ts`, plus `rawEditor.test.ts`'s
*"reseeds nothing when the window refuses the adoption"* comment and `saveOutcome.test.ts`'s
*"names no reload label once a spend has been refused"* comment.

### 7.4 Finding 4 (Low) — the raw editor's declaration comment described a one-gate producer

`RawEditor.test.ts`'s *"only the second is what the producer requires"* contradicted
`conflictChoicesFor`, which requires `offersReapply` **and** `reapplySupport === 'supported'`, and
contradicted the assertions three lines below it. It now says the producer requires both, and that
the second is why flipping this surface's boolean alone still offers nothing. No assertion changed.

### 7.5 The permanence sweep, written from the predicate rather than from the finding's words

*Asking again cannot change the answer* was not confined to `browser.reapply.adoptionRefused`. The
same claim justified the reload's terminal `refused` step in the **thirty-two** further places listed
below, all of them prose shipped at 2c-4a-3a/3b and none of them flagged by this review — three in
`saveOutcome.ts`, three in `editorSave.ts`, six plus six across the six surface modules, two in
markup and twelve in suites. Every one is corrected to say
what actually holds — the refusal comes back with no word about which guard produced it, so the panel
**withholds** the control, which is a decision about what to draw and not a claim about how a later
ask would be answered:

- `saveOutcome.ts` — `ConflictReloadStep`'s doc, and two clauses in `conflictChoicesFor`'s (the
  `unavailable`-step justification, and the *answered by the honest `adoptionRefused` sentence*
  clause this record's §2.2 also carried);
- `editorSave.ts` — `ReloadStep.refused`, `ReloadSpend`'s `'refused'` member, and
  `offeredReloadStep`;
- the `if (spend === 'refused')` comment in all five match modules and in `rawEditor.ts`;
- the `reloadUnavailable` view-field doc in all five match modules and in `rawEditor.ts`;
- the markup comment in `MatchEditor.svelte` and `RawEditor.svelte`;
- the *"stops offering the reload"* comment in all six model suites and in all six mounted suites
  (`MatchEditor.test.ts`, `RawEditor.test.ts`, `MatchCreator.test.ts`, `MatchDeleter.test.ts`,
  `MatchMover.test.ts`, `MatchDuplicator.test.ts`).

**Two neighbouring sentences were checked and deliberately left.** `// Asking again cannot spend
anything a second time.` in the six model suites is **true**: the step is no longer `confirmed`, so
`reloadTheDiskVersion` returns the same session and the callback is not called again — the assertion
under it is exactly that. And `MatchDeleter.test.ts`'s *"asking again would collect an answer that is
refused for the same reason"* is about `identityStaleRevision`, where the session's frozen identity
really does make the second answer the same one.

The `reapplied`/`moved-the-window` claim had two JSDoc instances beyond the dictionary, both in
`reapply.ts`: the `alreadySatisfied` arm's *"The disk snapshot was adopted"* and `attemptOfReapply`'s
*"both of which have already adopted the disk snapshot"*. Both now say the window **holds** the
snapshot, `installed` or `alreadyThere`, and say which of those installed nothing.

### 7.6 Where this round did not take the review's suggested wording, and why

Two deliberate departures, both to avoid trading one false sentence for another.

- **`adoptionRefused` does not say "Keep editing".** The review's suggested English quotes that
  label, but `reapplyOutcomeKey` is **not** branched on the draft kind: one string is drawn on all
  five match surfaces, and on the mover, the deleter and the duplicator the control is labelled
  *Leave this as it is* (`conflictChoiceKey('keepEditing', 'operationChoice')`). Naming a control
  that is not on screen is 2c-4a-3b's finding. The sentence says *you can carry on here* instead.
- **The readiness line does not say "either … or".** The review's suggestion reads as an exhaustive
  pair; `adoptionRefused` and `manualResolution` are reachable after a safe correspondence, so the
  sentence names the two successful shapes as possibilities and adds that whatever it ends as, the
  panel says so and nothing is written until something is sent. This satisfies the finding — no
  unconditional promise of a form — without a second one to find next round.

### 7.7 Evidence, re-taken after the fix round

| Command | Result |
|---|---|
| `npm test` | **1623** passed, 49 files — unchanged, and unchanged is the point |
| `npm run check` | **418** files, 0 errors, 0 warnings |
| `npm run build` | **175** modules; `svelte/internal/server` absent from `dist/assets/` |
| `cargo test --workspace` | **1086** passed, 0 failed — no Rust file was opened |
| i18n | **769** keys per language, at parity; **no key was added, removed or renamed** |

### 7.8 What this round does not close

`browser.reapply.ready` and the other twenty-three strings this step added are still prose that no
executable test can falsify,
which is §6.2 unchanged and now demonstrated: this whole round was four false sentences past 1623
green tests, `svelte-check` and a build. The only instruments that can reach them are a reader and
2c-4b-3c's window matrix, and **neither has been applied to the corrected strings** — the sentences
in this record are argued against the code, not read on a screen.

## 8. The confirmation pass — `docs/reviews/phase-2c-4b-3a-code-round2.md`

**Verdict: NOT READY on one new Low, with all four round-1 findings confirmed closed.** The pass was
scoped to the fix round and asked two questions — are the four closed, and did the fixes introduce
anything new. It confirmed §7.1–§7.4 against the code, sustained both wording departures recorded in
§7.6 and both retentions in §7.5, and found that §7.5's own 32-site rewrite had produced **the mirror
image of the finding it was closing**.

### 8.1 The finding — an unconditional claim of permanent refusal replaced by an unconditional claim of later success

`src/lib/browser/editorSave.ts`, `ReloadStep.refused`. The rewrite correctly stopped saying a refusal
is permanent, and then said that because a refusal spends nothing, *"a later press over a window that
had meanwhile reprojected to the requested revision would be answered `alreadyThere`"*.

**Reaching that revision is not sufficient.** `adoptDiskVersion` asks four guards before the revision
comparison — an authorization issued for another conflict, one already spent, a conflict this window
never registered or whose origin names a different document, and an unprojected document — and any of
them returns `refused` before guard 5 can answer `alreadyThere`. "A refusal spends nothing" rules out
only *this attempt newly causing* guard 2. It neither identifies the cause the refusal had — the
answer names none — nor promises the four earlier guards will pass on a later call.

The passage now says the answer names no cause, so the step cannot tell whether a later properly
authorized ask would succeed or be refused again, and declines the guess **in either direction**;
the spend clause survives, narrowed to exactly what it rules out.

### 8.2 The sweep, and the narrower instance it found

Searched for the *claim* rather than the finding's words: every non-test mention of `alreadyThere`
within reach of a later-attempt clause. Two more sites, both in `src/lib/browser/reapply.ts`'s
`adoptionRefused` arm, and **both fixed**:

- the guard walk said a window that reprojected to those exact bytes *is* answered `alreadyThere`,
  with no mention of the four guards ahead of it — now qualified by them;
- the permanence paragraph carried the same promise the finding names, in the same shape — now
  narrowed the same way, and it already ended by promising neither futility nor help.

`src/lib/browser/saveOutcome.ts`'s `DiskAdoption` list is **not** an instance and was left as it is:
it is an ordered numbered list whose item 5 is reached only after 1–4, and it says in its own words
that a satisfied request "never reaches this check".

### 8.3 What this round did not need

No behaviour moved and no test was added or changed; the three JSDoc passages are contracts, not
predicates. `npm test` **1623** passed / 49 files and `npm run check` **418** files, 0 errors,
0 warnings, both unchanged — which is §6.2 demonstrated a second time in one phase: a false sentence
and its correction are indistinguishable to every suite in this repository.
