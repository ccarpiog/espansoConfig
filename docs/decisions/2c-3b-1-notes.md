# Phase 2c-3b step 1 — decision record

**Move as a value, plus the repair of the wrapper that sends it. No component, no `.svelte` file, no
screen, no window reading.** Step 2 of 2c-3b draws what this decides.

The authority for the decisions below is `docs/reviews/phase-2c-3b-design.md` — the design consult
for this exact sub-phase, nine answered questions and nine corrections. Where this record and that
document disagree, the consult is right and this is a bug.

---

## 1. What this step built

| File | What it is |
|---|---|
| `src/lib/browser/matchMove.ts` | **new** — the whole of move as a value: the sequence, the eligibility, the destination panel, the lowering, the submission and the save |
| `src/lib/browser/matchMove.test.ts` | **new** — 52 cases over it, node environment, no component |
| `src/lib/browser/workspace.svelte.ts` | `BrowserState.moveMatch` repaired: `MatchSaveAnswer`, the adoption's own fate, `forgetTextOf`, and a JSDoc that no longer describes the shape it used to have |
| `src/lib/browser/workspace.test.ts` | the eight existing `moveMatch` cases updated for the new shape, and four added |
| `src/lib/browser/matchDeletion.ts` | `plainIdentity` exported, so the rule is shared rather than copied |
| `src/lib/browser/fixtures.ts` | a `path` override on `makeMatch`, and `matchListPath` |
| `src/lib/i18n/{en,es}.json` | a `browser.matchMove.*` namespace: **37 keys per language**, at parity |
| `src/lib/i18n/index.ts` | three reactive accessors — `tMoveRefusal`, `tMoveSubmissionRefusal`, `tMoveRecovery` |

**No `.svelte` file was touched**, checked with `git status --short`. **No Rust was written**, and
`cargo test --workspace` is still 1008.

---

## 2. The decisions

### 2.1 D1 — the invariant is "same sequence", derived from the path (consult correction 4)

`ItemMove` is same-sequence only (`PROGRESS.md` D2r), and a *file* is not a sequence. Today's
projection gives a snippet file exactly one snippet list, so the two coincide — and encoding that
coincidence would make this model silently wrong the first time a projection exposes a second one.

So `sequenceOf(match)` reads `MatchView.path`, requires the last step to be an `{ Index: n }`, and
answers a `SequenceAddress` of *the file's identity*, the `document_index` and the steps before that
index. Two snippets are co-sequential when all three agree.

**The file identity is carried beside the steps and is not read off the path**, and that is not
redundancy: a `DocumentPath` addresses a node *within* one file and names no file, so `matches[0]` of
two files is one path and two sequences. `sameSequence` answers `false` for that pair, and a test
drives it.

**This is the first consumer of `MatchView.path` in the frontend**, checked rather than assumed —
`findings.ts` reads a *`Diagnostic`*'s path, and nothing read a match's.

### 2.2 D2 — placement is `top | after | end`, and `end` is the UI's lowering (consult Q1, correction 6)

The panel offers three arms. The wire has only `after: MatchId | null`, so `end` is lowered here to
*after the last snippet of the sequence that is not the one being moved*. `MoveTarget` is a second
type from `MovePlacement` precisely so that the lowering cannot be mistaken for the contract: one is
what a person chose, the other is what travels.

**A session opens showing where the snippet already is** — `top` for the first item, `after <the item
above>` for every other — so the move control is refused with `alreadyThere` until a destination is
chosen. That refusal is computed on the **lowered target**, never on the placement, because for a
snippet that is already last *end* and *after the item above it* are two placements and one request.
`MovePlacementOption.current` exposes that aliasing rather than hiding it: two options carry it at
once for the last snippet, and a test pins exactly that.

`alreadyThere` is an **affordance derived from current state, never authorization**: the core would
accept a no-op move and answer `committed: false`.

### 2.3 D3 — the anchor list is the complete sequence, minus the snippet itself (consult Q6)

`MatchMoveSession.anchors` is every co-sequential snippet but the moving one — the self-anchor
exclusion, and the whole of it. It is derived from the **document projection**, never from a filtered
list: a search box filters what the middle pane lists and says nothing about document order, so a
destination list built from one would let a query decide where a snippet lands.

`movePlacementOptionsOf(session, views)` resolves each anchor against the live projections by
document **and revision**, so a file re-read since the session opened offers no `after` options at
all — the honest answer rather than a hidden one, and the same rule `placementOptionsOf` follows in
`matchCreation.ts`.

**Since §7 the submission refusal is given the same list**, and that is the fix rather than a
flourish: the options were derived from the live projections and the refusal from the session's
frozen snapshot, so a panel with no destinations left still reported that the move could be sent.

### 2.4 D4 — an explicit boundary, not a list of disabled foreign rows (consult Q4, correction 8)

Only co-sequential snippets are offered. The pane says so in one sentence,
`browser.matchMove.withinThisFile`, which takes a `{file}` placeholder that
`MatchMoveView.document` identifies. `matchCreation.ts`'s rule that **every** file is offered and the
ineligible ones say why is about *files that could receive a snippet*; correction 8 rules that it
does not generalise, so a snippet in another file is outside a move's destination domain rather than
a failed candidate needing a row.

### 2.5 D5 — a typed eligibility verdict, in `deletionEligibility`'s shape

`moveEligibility(document, match, unsavedDraftFor)` answers `movable` or `refused` with one of five
codes, checked in this order:

| Reason | What it means |
|---|---|
| `notInDocument` | the snippet and the file handed in are not a pair this projection describes — the same three-part check `deletionEligibility` makes, because a snippet and its file are one fact |
| `readOnly` | the projection says this application must refuse to write the file |
| `noSequencePosition` | `path` is `null`, or does not end in an index: no address a move can work from |
| `onlySnippetInSequence` | the sequence holds only this one, so there is nowhere to move it |
| `unsavedDraft` | this window is holding unsaved edits to it (D6) |

The order is a claim about which fact is most fundamental, not about which is most likely. Every arm
is an affordance derived from current state and never authorization: drift produces a surfaced
refusal, never an invalid write.

**`onlySnippetInSequence` is not "the only snippet in the file"**, and a test drives the difference:
a file holding two snippets in two different sequences refuses the move, where a rule written about
the file would have called it movable and offered a destination in another list.

### 2.6 D6 — the dirty-draft rule lives here, as an input (consult Q9, correction 2)

The fact is an **argument** — `unsavedDraftFor: MatchId | null` — so the rule is in this testable
module and step 2's component only supplies the fact. Required and nullable rather than defaulted,
for `applyDeletion`'s reason: a default would be this function inventing "there are none" for a
caller that did not look.

**The copy is truthful.** `browser.matchMove.refused.unsavedDraft` says a committed move gives the
snippet a new place and would leave those edits with nothing to be saved to, and ends *"This is how
this app works, not something the file refuses."* It is **not** R25, and it does not claim the core
forbids two sequential transactions — it does not.

**The comparison is the whole identity, all three fields** — `sameIdentity`, the same comparison
every other identity check in the module makes. **This is a correction: the first version of this
step compared document and node only**, in a private `sameSnippet`, and claimed that an
older-revision `{document, node}` pair is "the same snippet". That claim is false. A `MatchId` is
**session-local**: after a reprojection, node 10 of document 2 can be an unrelated snippet, so the
looser rule could refuse a move for a snippet nobody is editing (the review's second finding).
`sameSnippet` is gone.

**What the rule therefore does not protect against, said plainly.** Once the draft's identity is
older than the projection the eligibility is computed over, the rule **stops matching and the move is
allowed**, and a commit strands those edits exactly as the dictionary sentence describes.

**Nothing closes that today, and `identityInProjection` is not what closes it.** This record said it
was, for one round, and the confirmation pass's third finding is that claim: that function resolves a
node against whatever projection the window now holds and answers *that* projection's identity, and
its own doc comment at `matchDeletion.ts` says in as many words that it must not be used to follow a
snippet across a reparse. Draft A held at R0/node 10 with an unrelated snippet B at R1/node 10 makes
it answer **B's** identity, and handing that to `moveEligibility` refuses **B** for `unsavedDraft` —
which is finding 2 of the first review round reached through the producer this record prescribed to
close it. Hole 18 of §6 is what is actually true and what would settle it. **Nothing in TypeScript
can say where an argument came from**, which is why the residual is written in `moveEligibility`'s
own doc comment as well as here.

### 2.7 D7 — R25 gets no message at all (consult Q9, correction 1)

**Nothing in this UI can express a combined batch**: a move is one command carrying one relocation,
and no control anywhere can add a second edit to it. A warning about a request nobody can make would
describe something that never happened. The module header says this in as many words, so a later
reader does not "fix" the omission.

### 2.8 D8 — a command failure is not an acknowledgeable refusal (consult Q8, correction 3)

`moveNotWithinOneSequence` arrives on `SendFailure`, is walked by `sendFailureLines` into a
`{ kind: 'failure' }` line, and is rendered by the existing `tIpcFailure` accessor over the existing
`code.commandError.moveNotWithinOneSequence` sentence. **No key is built and no string is added for
it.** It carries no findings, so putting it beside *Save anyway* would offer a button that can never
work.

`moveRecoveryChoices(failure)` is the recovery affordance, and it offers `reloadFile` for exactly
four codes: `moveNotWithinOneSequence`, `identityStaleRevision`, `identityNoSuchMatch` and
`identityWrongDocument`. All four say the address this window sent does not describe the file the
command read. **Correction 5 is why the second one is in the list**: a stale projection normally
produces `identityStaleRevision`, because `view_at` checks the base revision first, and
`moveNotWithinOneSequence` means an unsupported address or an invariant breach. Everything else is
offered nothing, because a re-read cannot help with a `saveFailed`, a `draftRefused` or a
`noWorkspaceOpen`.

### 2.9 D9 — the placement is what is drafted, and that is what binds consent

`Draft<MovePlacement>`, with the origin as its base value. Three things follow, and each is a rule
this model gets for free rather than has to remember:

- **consent is content-addressed to the destination.** A refusal acknowledged for *end* cannot be
  spent on *after :date*, because `acknowledgeRefusal` checks that the draft still holds the
  submitted candidate. `matchCreation.ts` had to call `withdrawnConsent` by hand for exactly this,
  because its placement lived *outside* its buffers (its first review round's first finding);
- **`amendDraft`, not `editDraft`.** A destination replaces the previous destination rather than
  joining a history: there is no undo stack over a radio group, and manufacturing one would be this
  model inventing a history nobody made;
- **the base revision is frozen at `startMatchMove`** and `baseRevisionOf` is the one named read of
  it.

`choosePlacement` additionally clears the outcome panel, the submission and the send failure, because
a refusal is about **one** destination and a panel describing one nobody has chosen any more is a
panel about nothing.

**The anchor installed is this session's own copy, never the caller's object.** The draft snapshots
through `structuredClone`, which throws on a reactive proxy, and a component may build a placement
around an identity read straight out of `BrowserState.views`. A test pins that the installed anchor
is `toEqual` but not `toBe` the caller's.

### 2.10 D10 — the live identity, and no separate confirmation (consult Q7)

`beginMove(session, projected)` takes the identity the **live projection** gives the snippet and
refuses unless it agrees with the session's own. It is the only argument that comes from outside the
session, so it is the only one that can notice a reprojection — `confirmDelete`'s fourth-value rule
applied to a move. `identityInProjection` in `matchDeletion.ts` is what a caller uses to produce it,
and the module header says in the same sentence that **nothing in TypeScript can say where an
argument came from**, so a caller handing back `session.match` defeats the check entirely.

**Since §7 that agreement is not a second check but the same one the view runs.** `refusalGiven` is
the single rule, and it takes the liveness as a parameter: `beginMove` derives it from `projected`,
and the view side derives it from the projections it is handed. The two used to be separate
computations, and only one of them looked. **That is one rule over consistent inputs and not
agreement by construction** — §7.3 said the second for one round, and §8.4 is the correction.

There is **no separate confirmation dialog**: choosing a destination and pressing move is already a
deliberate two-step interaction, and only a refused outcome introduces the acknowledge-and-retry
round.

### 2.11 D11 — `BrowserState.moveMatch` now mirrors `saveMatch` (consult Q3)

Four changes, and the first three are the latent shapes `PROGRESS.md` recorded:

1. **it answers `MatchSaveAnswer`.** `notAttempted` when this state holds no projection of the file,
   `failed` with `mayHaveWritten` and the reason when a command ran and rejected, `answered` with the
   result and the adoption otherwise. A bare `null` was indistinguishable from `noWorkspaceOpen`, and
   a screen that renders both as *nothing was written* states the opposite of what the disk may hold;
2. **it reads `adoptTheDocumentOnDisk`'s return value.** On a committed move whose re-read fails it
   calls `forgetTheReplacedDocument` and answers `adoption: { kind: 'failed', failure }` **beside**
   the committed outcome. Before this the answer was discarded and a stale projection stayed
   installed under a committed move;
3. **`forgetTextOf(match.id.document)` replaces `forgetFileText()` on every path that had it** — the
   `may_have_written` path, the committed path and the conflict path — so the per-document conflict
   capture is dropped too. The identical omission the 2c-2 confirmation pass found in `saveMatch`;
4. the JSDoc no longer describes the shape it used to have, and `adoptTheDocumentOnDisk`'s own
   comment — which said *"`saveMatch` drops it; `moveMatch` leaves it"* — was corrected in the same
   commit. It had become a false claim about the code the moment (2) landed.

**The caller's `baseRevision` is still forwarded unchanged**, and `view.revision` is still never
substituted. That half was closed at 2c-3a-1's confirmation round and is untouched here.

---

## 3. Verification

| Command | Result |
|---|---|
| `npm run check` | exit 0 — 405 files, **0 errors, 0 warnings** |
| `npm test` | exit 0 — **1216 tests over 43 files**, from 1160 over 42 |
| `npm run build` | exit 0 — **166 modules**, from 165 |
| `cargo test --workspace` | exit 0 — **1008**, unchanged |
| `git status --short` | no `.svelte` path, no `.rs` path |

**The counts above are the ones after §8's confirmation round.** They were 1209 tests before §7, with
44 in `matchMove.test.ts`; §7 added five cases and §8 added two more — one in each of the two suites,
after replacing one case with another that describes an answer production can give. Neither round
added a source module, so the module count has not moved since `matchMove.ts` itself. No Rust was
touched at any point, in any of the three rounds.

**The module guard moved by exactly one, which is the number of new source modules**: `matchMove.ts`.
It reaches the bundle because `src/lib/i18n/index.ts` imports its three key builders and every
component imports that. The count was checked for the *shape* of the change rather than the number,
which is the rule `CLAUDE.md` §6 states: `rg` over `dist/assets/*.js` finds no
`svelte/internal/server` and no `node:async_hooks`, so this is one new module and not the
`resolve.conditions` regression. `vite.config.ts` is untouched.

**Where the fifty-six come from, and it reconciles exactly.** `matchMove.test.ts` runs **50**.
`workspace.test.ts` goes from 111 to **115** — the failed adoption, the dropped conflict capture, the
mid-flight selection of §5, and §8's conflict-through-the-real-wrapper case. And
`scripts/lint/ipc-detail.test.ts` generates **one case per source file under `src/`**, `.test.ts`
files included, so the two new files add **two** of their own. 50 + 4 + 2 = 56, and 1160 + 56 = 1216.

---

## 4. Consult corrections, and what each one changed

Recorded so a fresh session can see which decisions are the consult's rather than the implementer's.

| # | The correction | What it changed here |
|---|---|---|
| 1 | R25 cannot be "surfaced": no action expresses the prohibited batch | **no R25 message exists**, and the module header says why so nobody adds one (D7) |
| 2 | a dirty draft plus a move is not R25 | `unsavedDraft` is named as this application's workflow policy, and the Spanish and English copy both say it is not the file refusing (D6) |
| 3 | D2r/R25 are not `SaveResult.refused`-shaped | `moveNotWithinOneSequence` is presented as a typed **command failure** on `SendFailure`, never as an acknowledgeable refusal (D8) |
| 4 | "same file" is not the invariant; "same sequence" is | `SequenceAddress`, `sequenceOf`, `sameSequence` and `membersOfSequence` exist at all, and `onlySnippetInSequence` is not `lastSnippet` (D1, D5) |
| 5 | a stale projection produces `identityStaleRevision`, not `moveNotWithinOneSequence` | `identityStaleRevision` is in the `reloadFile` list, and the doc says what the sequence code really means (D8) |
| 6 | no wire-level `End` does not stop the UI offering **End** | `MovePlacement.end` exists and `lowerPlacement` compiles it to an identity (D2) |
| 7 | a `saved` answer does not imply bytes were written | `committed: false` draws `nothingToWrite`, never claims a commit, and the wrapper's `outOfDate` test is unchanged (D2, D11). **It does not follow that it spends nothing** — §7's first finding; a `committed: false` whose revision the window was not already projecting owes the adoption that invalidates every identity here |
| 8 | creation's "show every ineligible destination" is not universal | only co-sequential anchors are offered, with one boundary sentence instead of foreign rows (D4) |
| 9 | calling this the same identity mistake as new/delete understates it | order semantics (`members` vs `anchors`), the self-anchor exclusion, the `end`/`after-last` aliasing exposed by `current`, and a mid-flight-selection case in `workspace.test.ts` (§5) |

---

## 5. Consult Q5 — the selection after a move, and what actually happens

**The consult asks for a generic `invalidatedByCommit` notice in place of the misleading
`differentMatch`. This step did not add it, and the reason is stated rather than implied.**

### 5.1 What a mid-flight selection change produces after a move — measured

Established by a test written for this record, not by reading the code:
`keeps a mid-flight selection the reorder did not move, and drops one it did` in
`src/lib/browser/workspace.test.ts`. Three snippets, `:sig` moved below `:date`, and the person is
looking at a different snippet when the answer lands:

- a selection at a position the reorder **did not touch** (`:sql`, position 2 before and after) is
  found by `reresolve`'s fingerprint comparison, re-pointed under its new identity, and the notice is
  **`kept`**;
- a selection at a position the reorder **did** touch (`:date`, position 1, now holding `:sig`) is
  **dropped**, with the notice **`differentMatch`** — while the snippet is still in the file, one row
  above.

So the misleading case the consult names is real, and it is *conditional*: `repairAfter` is positional
and then checked, so which answer a person gets depends entirely on whether the reorder shifted the
position they were on. `gone` is not reachable for a pure move, because a relocation does not change
the sequence's length.

### 5.2 Why the arm was not added — an open hole, with what would settle it

Three reasons, in the order they bind:

1. **There is no producer for it that does not change a shared path.** Every writing wrapper reaches
   `repairAfter`, and a move reaches it through `adoptTheDocumentOnDisk`, which `saveMatch` also
   calls. Producing the new notice for a move alone means either a second adoption function — a copy
   of the one that exists because `run_one_save` "was four copies once" — or a new parameter threaded
   through a function four writing wrappers call. Both change what those callers *run*, which the
   brief for this step rules out.
2. **The notice would be right on only one of the two paths.** A committed move is a change the
   person asked for, so `differentMatch` reads as "your file moved under you" and is misleading. A
   **conflicted** move wrote nothing and the file really did move under them, so `differentMatch` is
   accurate there — and `moveMatch`'s conflict path calls the same `repairAfter`. A one-line swap
   would make the conflict message false, which is this project's worst defect class in the code
   rather than in a record.
3. **What a person should be told is a screen decision**, and `2c-split-notes.md` §7 says a claim
   about a screen needs a window reading. Step 2 owes one.

**Adding the arm with no producer was considered and rejected**: `notices.test.ts`'s `NOTICES` list
is hand-maintained and walks every arm, so a dead arm would carry two dictionary sentences nothing
can ever draw — a decision record claiming a behaviour the code does not have, in the form of a
string.

**What would settle it**, for whoever picks it up: step 2's window reading, over a file of at least
three snippets, with the selection deliberately moved mid-flight to a snippet *inside* the shifted
range and to one *outside* it. If the `differentMatch` sentence reads as a false alarm in the first
case — and §5.1 says it will — the arm is worth adding, and the right shape is an explicit notice
argument on the adoption rather than a swap inside `repairAfter`.

---

## 6. Holes this step leaves open

1. **No screen.** Nothing here has been rendered. Two of `2c-split-notes.md` §7's three kinds of
   evidence are still owed: the **mounted-component test** and the **window reading**. Only the model
   tests exist. Per `1c-1-notes.md` hole 1 and 2c-1b's own conclusion, a green suite is not a screen.
2. **The `invalidatedByCommit` notice was not added.** §5 is the whole record: the reasoning, what
   was measured, and what would settle it.
3. **`BrowserState.moveMatch` still takes `MatchView`s where `matchMove.ts` produces `MatchId`s.**
   Only `.id` is read from either argument, so the projections are friction rather than information.
   Step 2 either resolves the identities against the live projection — which is the same read
   `beginMove` already requires — or changes the wrapper's first two parameters to identities. It was
   left because it is a decision about what a *move component* holds, and this step has none.
4. **`MoveRecovery.reloadFile` has no producer on `BrowserState`.** There is no public re-read of one
   document: `commands.reloadDocument` is reached only from inside `select()`'s repair. The view
   offers the recovery as a **code**; step 2 must add the call behind it, exactly as 2c-3a-1's hole 2
   recorded that `BrowserState` exposed no projection list until step 2 needed one.
5. **`unsavedDraftFor` has no producer either.** Every call in this step passes `null` or a fixture.
   Step 2's component supplies the fact — from whatever the detail pane knows about an open
   `matchEditor` session — and until it does, the rule is written and unexercised in the running
   application. **Since §7 the fact it supplies has to be a live identity**: the comparison is all
   three fields, so a component that hands over an identity minted before the projection it also
   hands over will not match, and the move it should have refused goes ahead. **What produces that
   live identity is hole 18 and is not decided here**; this record named `identityInProjection` for
   one round and §8.3 is why that was wrong.
6. **`MoveSubmissionRefusal.outOfDate` has three producers and one of them is unreachable.** Two are
   real — `MatchMoveSession.invalidated`, and live projections that no longer give the session's
   snippet its identity — and the third, a placement `lowerPlacement` cannot lower at all, is
   reachable only through a hand-assembled session, because `anchors` is a snapshot never replaced
   and `choosePlacement` validates against it. Both halves are stated in the code as well as here.
   **This replaces the `anchorUnavailable` arm**, which had no producer at all; §7's third finding is
   the whole record of why.
7. **A session's sequence and anchors are a snapshot**, taken at `startMatchMove`, and **nothing
   re-seeds them**. A file the window re-reads while the panel is open is not reflected in them; what
   bounds the consequence is the frozen base revision, which produces a *conflict* rather than a
   silent rebase, and — since §7 — the live projections `moveSubmissionRefusal` and `matchMoveView`
   take, which turn the whole session into a surfaced `outOfDate` refusal instead of a control that
   does nothing. **The panel still has no way back**: closing and re-opening it is the only repair,
   and offering one is step 2's, because what a person should be told is a screen decision. Same
   shape as `matchCreation.ts`'s hole 11.
8. **A conflict is terminal**, with *Keep editing* as the only way out. Same reason as 2c-2's D6 and
   2c-3a's D4: the alternatives are 2c-4a's, and a rough version here would make that phase look
   already done.
9. **Nothing forces a caller to re-seed after a commit, or to read `adoption`.** Both are values on
   the answer rather than console lines, which is what a type can do here and the whole of what it
   can do.
10. **A component can still bypass the wrapper.** `src/lib/ipc/commands.ts` exports `moveMatch`, and
    nothing stops a `.svelte` file importing it and skipping the adoption and the live-identity
    check. **No component imports that module at all today** — checked with `rg`, and the three
    mentions in `.svelte` files are comments — which is a fact about the code as written rather than
    a guarantee.
11. **`plainIdentity` and `identityInProjection` are imported from `matchDeletion.ts`.** Neither is
    about deletion: one is the `structuredClone`-on-a-proxy rule, the other is *the* way this
    application reads a live identity, and a second copy of either is a second place for it to be got
    wrong. The right home is a module about identities; that is deferred rather than done, on
    `typing.ts`'s precedent — it was extracted when the second caller appeared, and these two now
    have exactly two callers each.
12. **`sameIdentity` is a third private copy.** `matchCreation.ts` and `matchDeletion.ts` each have
    one already, and this module has its own. It is three lines with no state; the duplication is
    recorded rather than removed, because folding it in would mean choosing a home for it and that is
    the same decision as hole 11.
13. **`fixtures.makeMatch` defaults `path` to `null`, which is not what a real projection
    produces.** Every match of a parsed snippet file has one. The default is `null` so that the
    fixtures every existing suite was written against are byte-for-byte unchanged, and
    `matchListPath(index)` is the shape a snippet-list item really has — a *transcription* of what
    `project_document` builds, in the sense `fixtures.ts`'s own header means, not a measurement.
14. **A move's `notes` is always empty, and that was read off the core rather than assumed.** A batch
    containing an `ItemMove` may hold no other edit (`MoveMustBeTheOnlyEditInItsBatch`), and
    `plan_move` in `crates/espansoconfig-core/src/patch/edit.rs` sets `note: None`. The view carries
    the field anyway so that a note the core learns to emit is drawn rather than dropped.
    **What is open is the core's, not this module's**: a move leaves at its source the doubled blank
    line that a *removal* discloses, and says nothing about it. `docs/decisions/2b-2c-2-notes.md`
    §6.2 records that half as open, and this step does not change it.
15. **The Spanish sentences are checked by the parity tests and the untranslated-value heuristic
    only**, which is `2c-1b-notes.md` §8.8 unchanged. Thirty-seven new ones were written. `fragmento`
    is used throughout for a snippet, per the owner's ruling at `7c266c8`; **no screen has yet drawn
    the longer noun**, so the width caveat `PROGRESS.md` records still stands and step 2's window
    reading inherits it.
16. **`alreadyThere` is an affordance and not authorization.** The core would accept a no-op move and
    answer `committed: false`; refusing it here is this application declining to send a request that
    does nothing. If the two ever disagree, the command's answer is what reaches the screen.
17. **The `{file}` in `browser.matchMove.withinThisFile` is filled by the component.** The view
    carries the document's *identity*, not its path, because a model holding display text would be
    holding a second copy of what the sidebar already draws. Nothing here checks that a component
    supplies it, and an unfilled placeholder renders verbatim by design (`dictionaries.ts`).
18. **There is no way to relate an open draft to the snippet it edits across a reparse, and this step
    does not invent one.** Added by §8.3. The `unsavedDraft` rule compares whole identities, so it
    stops matching the moment the draft's identity is older than the projection the eligibility is
    computed over — hole 5, and §2.6 — and **no existing function produces the identity that would
    close it**. `identityInProjection` cannot: it resolves by arena node alone and answers whatever
    the current parse holds there, which for a re-read file can be a different snippet, so feeding
    its answer to `moveEligibility` refuses the *wrong* snippet. It is safe where it is used —
    `confirmDelete` and `sessionIsLive` **require equality including the revision**, so a node reused
    by another snippet fails the comparison instead of resolving to it — and unsafe as a producer,
    which is exactly what its own doc comment says.

    **What would settle it**, for whoever picks it up in step 2: a coordinator that owns the relation
    between an open editor session and the snippet it is editing, and re-points it as part of the
    same synchronous block that installs a new projection — the shape `repairAfter` already has for
    the *selection* — or, if that is too much for step 2, a rule that a snippet with a stale draft is
    not offered a move at all until the draft is saved or discarded. **Not** a lookup that infers
    cross-revision identity from an arena node, whatever it is named.

---

## 7. The aggregate review round

`docs/reviews/phase-2c-3b-1-code.md`, `READINESS: NOT READY`, four findings: two High, one Medium,
one Low. **All four are closed below, and two of them were this project's own named worst defect
class** — a decision record asserting a guarantee the code does not give. Both were in *this file*:
§2.6's D6 guaranteed that an older-revision `{document, node}` pair is "the same snippet", and §4's
row 7 guaranteed that "`committed: false` spends nothing". Neither was true, and **no test could have
failed for either** — the suite was 1209 green over both.

Nothing outside `src/lib/browser/matchMove{,.test}.ts` and the two dictionaries was touched: no
`.svelte` file, no Rust, no `vite.config.ts`, no corpus fixture. The dictionaries kept **36 keys per
language** in this round, because the one key it added replaced the one it removed; §8 took them
to 37.

### 7.1 Finding 1 [High] — `committed: false` with a moved revision invalidated everything and spent nothing

**What it was.** `applyMove` set `moved: result.committed` and nothing else, so a `saved`,
`committed: false` answer whose revision was not the one the window was projecting left the session
saying it was usable while every identity on it was stale. The wrapper's own condition is
`committed || revision !== view.revision`, so it had already re-read and re-projected the file — and
`beginMove` then answered `null` against a live identity, with the model insisting the control should
be enabled. The existing test hid it by pairing an `AFTER` revision with a `notOwed` adoption, which
is an answer `BrowserState.moveMatch` cannot produce.

**What closed it.** `MatchMoveSession.invalidated`, beside `moved` and not merged with it. **The two
are two facts**: `moved` means *the file was rewritten through this session*, `invalidated` means
*the projection these identities came from has been replaced*. `applyMove` ors `invalidated` from
`result.committed || adoption.kind !== 'notOwed'` — the adoption being **owed at all** is the
evidence, since the wrapper performs it exactly when it re-reads — **whatever arm carried it**.
`canChoose` and the submission refusal both consult it, so the session stops accepting destinations
and stops offering the move **without claiming the move committed**.

**That is not the same as "every arm invalidates", and this paragraph said so for one round.** The
adoption is the evidence only where the wrapper reports one, and it never reports one for a conflict —
which installs a projection all the same. §8.2 is the correction; the conflict arm now derives the
invalidation on this side.

Three tests: the one the review named (`committed: false`, revision `AFTER`, `adoption: done` →
`moved: false`, `invalidated: true`, `canMove: false`, `cannotMove: 'outOfDate'`, `beginMove` null);
the honest twin of the old one (`committed: false`, revision `BASE`, `notOwed` → the session is still
usable and `beginMove` still produces a move); and — since §8.2, replacing a *refused*-plus-adoption
pair the wrapper cannot answer — the conflict-plus-`notOwed` pair it really does answer. **Since §9.5
the refused-plus-adoption case is back beside that one**, labelled as what it is: a guard on the shape
of the rule, not a claim about anything production can answer.

**Both flags are or-ed into rather than assigned**, so "cleared by nothing" is now what the code does
rather than what the reachable transitions happen to allow. A test drives a second answer handed to a
committed session.

### 7.2 Finding 2 [High] — cross-revision identity inferred from arena node reuse

**What it was.** The private `sameSnippet` compared document and node only, and both its doc comment
and §2.6 of this file guaranteed that this means "the same snippet, whatever parse each came from".
A `MatchId` is **session-local**: after a reprojection, node 10 of document 2 can be an unrelated
snippet, so `moveEligibility` could refuse the *wrong* snippet for `unsavedDraft`. The test at the
time enshrined the claim.

**What closed it.** `sameSnippet` is deleted and the rule uses `sameIdentity` — all three fields,
like every other identity comparison in the module. **The residual is stated rather than papered
over**, in `moveEligibility`'s doc comment, in the module header and in §2.6 above: once the draft's
identity is older than the projection the eligibility is computed over, *the rule stops matching and
the move is allowed*, and a commit strands those edits. The producer is step 2's (hole 5), so the
shape chosen is the correct one rather than the convenient one. **This paragraph named
`identityInProjection` as what closes the residual, and that was wrong**: §8.3 is the correction and
hole 18 is what is actually true. The test now asserts that an identity from another parse leaves the
snippet **movable**, and says in a comment what that costs.

**`sameIdentity`'s other call sites were judged one by one, not replaced in bulk.** Anchors, members
and `choosePlacement` all compare values drawn from **one** projection, where comparing within a
revision is correct; those are unchanged.

### 7.3 Finding 3 [Medium] — `canMove: true` with the chosen anchor gone, and an arm with no producer

**Which branch was taken, and why.** The review offered two: derive submission availability from the
same live projections the options come from, or remove the unreachable arm and its two strings. **The
first was taken**, because the second leaves the contradiction it describes — after a reprojection a
`top` placement would still have reported `canMove: true` — and because the review's own preference
was conditional on there being no second source of truth about a session, which there is not: the
live projections are the only new input, and `movePlacementOptionsOf` already took them.

**What it was.** `movePlacementOptionsOf` consulted the live projections and `moveSubmissionRefusal`
consulted the session's frozen anchors, so a panel that had dropped every destination still reported
that the move could be sent, and pressing the control produced nothing at all. The comment claiming
that a reprojection produces `anchorUnavailable` was false, and §6's hole 6 admitted the arm had no
producer while two dictionary sentences shipped for it.

**What closed it.** `moveSubmissionRefusal`, `canMove` and `matchMoveView` all take
`views: readonly DocumentView[]` now. One private rule — `refusalGiven(session, live)` — computes the
refusal, and both sides call it: the view side derives `live` with `identityInProjection`, and
`beginMove` derives it from the `projected` argument it already had. **The two cannot disagree about
one parse**, which is the property that was missing; `matchMoveView` computes the refusal once and
reads `canMove` off it, so the view's two fields cannot contradict each other either.

**This paragraph read "cannot disagree by construction" for one round, and that is more than the code
gives**: the liveness reaches the two sides through two independent arguments, so
`matchMoveView(session, R0Views)` answering `canMove: true` beside
`beginMove(session, identityInProjection(R1Views, session.match))` answering `null` is well-typed and
nothing refuses it. §8.4 is the correction and states what step 2's component owes instead.

**Taking that branch showed that `anchorUnavailable` was not merely unreachable but wrongly shaped.**
A session's `match` and all of its `anchors` come from one projection and therefore share a document
and a revision, so they stop resolving **together**: "the anchor you chose is gone" and "the snippet
you are moving is gone" are one event seen through whichever destination happens to be selected.
Keeping the arm would have meant one message telling the person to *choose another destination* —
false advice, since after a reprojection every destination this session offers is stale. So the arm
is `outOfDate`, with one truthful sentence per language replacing `anchorUnavailable`'s, and it has
two real producers (`invalidated`, and live projections that do not resolve the session) plus the
hand-built `lowerPlacement` case, all three named in the code. Hole 6 above is rewritten to match.

The test observes the **contradictory enabled state** and not only the shrinking option list: with a
re-read projection, the options fall to `top` and `end`, `canMove` is `false`, `cannotMove` is
`outOfDate`, and `beginMove` is `null` — checked for an `after` placement and for both placements
that name no anchor.

### 7.4 Finding 4 [Low] — a preservation test that would pass with the implementation removed

**What it was.** The case asserted `[]` against a `saved()` carrying `notes: []`, so `notes: []`
hard-coded in `matchMoveView` would have passed it.

**What closed it.** `saved()` takes the notes (and the revision, which finding 1 needed), and the
case sends a real `ScalarRestyled` note and asserts the view returns it unchanged — `toEqual` and
`toBe`, the second because the field is passed through and not rebuilt. The empty answer is still
asserted beside it, so the "always empty for a move today" half is not lost.

### 7.5 What this round changed that the review did not ask for

Three things, each because a fix would otherwise have left a false statement standing:

1. **The `CONFLICT` fixture's `disk` is the re-read projection**, not the projection the session was
   opened over. It carried `disk_revision: AFTER` beside a `disk` at `BASE`, which is not an answer
   the command can give. The case about dismissing a conflict now hands that projection back, and it
   shows what production really does: a dismissed conflict does **not** restore the move, because
   `BrowserState.moveMatch` installed the disk projection and the session's identities came from the
   one it replaced. That is a behaviour change to `canMove` after `dismissMoveOutcome`, and it is the
   truthful one.
   What that round left out is that the refusal came from the live check **alone**: `invalidated` was
   still `false` after a conflict, so `canChoose` came back on dismissal. §8.2 closed it.
2. **`MatchMoveView.spent`** — `moved || invalidated` in this round, and `|| mayHaveWritten` since
   §8.1. A screen that keeps the panel open for one has to keep it open for the others, and after
   finding 1 those are not the same field.
3. **`moved` is or-ed rather than assigned**, as described in §7.1.

### 7.6 What this round does not close

1. **`canChoose` does not take the live projections.** A session the window has silently
   re-projected still accepts a destination; what refuses is the submission, which is the one place
   that asks. Choosing clears the outcome panel and nothing else, so the cost is a click that changes
   a radio group in a panel that cannot send.
2. **Nothing makes a caller pass the *current* projections**, or the same list to
   `movePlacementOptionsOf` and `matchMoveView`. A screen holding a stale copy of `BrowserState.views`
   gets the stale answer from both, consistently and wrongly. This is the same class as
   `beginMove`'s `projected`, and it is what a structural interface can do.
3. **There is still no way back from an `outOfDate` session.** It is a surfaced refusal, not a
   repair: closing the panel and picking the snippet again is what the sentence tells a person to do,
   and a re-seeding transition is step 2's to design because what a person should be told is a screen
   decision.
4. **Every claim in this section is about model tests.** No screen has rendered any of it, and the
   mounted-component test and the window reading are still step 2's, exactly as hole 1 says.

---

## 8. The confirmation pass

`docs/reviews/phase-2c-3b-1-confirmation.md`, `READINESS: NOT READY`. It confirms **F1–F4 of §7 all
CLOSED** — `sameIdentity` compares all three fields and the cross-revision input is movable; a
`committed: false` at a moved revision with `adoption: done` leaves `moved: false`, sets
`invalidated`, disables the control and reports `outOfDate`; `anchorUnavailable` is gone and both
sides reject an R0 session against R1 projections; and the notes case carries a real
`ScalarRestyled`. It also reports **four new High findings, every one of them introduced by §7's own
fix round**, which is this project's standing rule seen again: *a fix is a change, and the round that
reviews it is not optional.*

**Two of the four were false sentences in this file rather than defects in the code** — the class no
test can fail — and both were written *while closing* a finding of the same class. That is now three
review rounds in a row over this step in which the fix produced the next round's finding.

Nothing outside `src/lib/browser/matchMove{,.test}.ts`, `src/lib/browser/workspace.test.ts`, the two
dictionaries and this record was touched: no `.svelte` file, no Rust, no `vite.config.ts`, no corpus
fixture. `BrowserState` itself is unchanged, deliberately — §8.2 says why.

### 8.1 Finding 1 [High] — a send that may have written was not terminal, and the sentence contradicted itself

**What it was.** `moveCouldNotBeSent` recorded a `may_have_written` rejection on `sendFailure` and
nowhere else. Neither `canChoose` nor `refusalGiven` consulted it, so **both halves were wrong at
once**: with the wrapper's own re-read failing and the projection still at R0, the same move was
immediately offered for retry beside a message telling the person to look at the file first; and with
the re-read succeeding at R1, the live check produced `outOfDate`, whose sentence begins *"Nothing has
been written"* — about a save this application had just said it could not account for. The second half
is `PROGRESS.md` D2 from its mirror side: a write that may have committed reported afterwards as
though it had not.

**What closed it.** `MatchMoveSession.mayHaveWritten`, a third flag beside `moved` and `invalidated`,
or-ed into by `moveCouldNotBeSent` and cleared by nothing. `refusalGiven` returns the new
`MoveSubmissionRefusal.mayHaveWritten` for it, above the liveness check, so the reason shown is never
`outOfDate`; `canChoose` refuses; `beginMove` produces nothing; `MatchMoveView.spent` is true. One key
per language, `browser.matchMove.cannotMove.mayHaveWritten`.

**This round put that arm *second*, below `moved`, and gave it a sentence blaming a repeat — and both
halves were wrong.** §9.1 and §9.2 are the corrections: the arm is now **first**, because a session
can hold two of these flags at once and the reason shown must be the one that claims less; and the
sentence no longer says that moving again could repeat a change that has already happened, because it
could not — the session resends its frozen base revision, so a first write makes that base stale and
`alreadyThere` refuses the same destination after a re-open. What the terminal state really rests on
is uncertainty and a stale identity.

**A flag rather than a read of `sendFailure`, and that is the whole of why it is a flag**:
`dismissMoveOutcome` clears `sendFailure`, so a session read off that field would have been handed
back by putting the panel away — the same defect one dismissal later. A test drives exactly that.

**Both re-read outcomes are tested**, as the finding asks: the same spent session against `HELD` (the
projection the session was opened over, which is what a failed re-read leaves) and against
`[reread()]` (what a successful one installs), with `cannotMove` `mayHaveWritten` in both. `notSent`
is asserted beside it as the half that spends nothing, because a failure before the rename really did
write nothing.

### 8.2 Finding 2 [High] — a conflict replaced the session's identities and the session was not told

**What it was.** `BrowserState.moveMatch`'s conflict arm installs the projection the conflict carries
on `disk` — replacing this window's projection of the file, and with it every identity a session
holds — and answers `adoption: notOwed`, correctly, because it wrote nothing and re-read nothing. But
§7.1 made the adoption the *only* evidence, so `applyMove` left `invalidated: false`: after a
dismissal `canChoose` came back and `MatchMoveView.spent` was false for a session whose identities had
been replaced. The live projections stopped the submission, so nothing invalid could be sent — but
§7.1's sentence "it does so on every arm" was false, and §7.5's claim that a dismissed conflict does
not restore the move was true for the wrong reason.

**Which branch was taken.** The review offered two: report the conflict's projection installation as
an owed adoption, or derive the invalidation from the arm on the move side. **The second**, and the
reason is the brief's own: `saveMatch`, `createMatch`, `deleteMatch` and `saveRawDocument` answer the
same `adoption` field through the same helpers, so widening it for a conflict either changes what
those four report — outside this step — or makes one caller's `adoption` mean *"a projection was
replaced"* while the other four keep it meaning *"the file was re-read after a write"*. So
`applyMove` ors `result.outcome === 'conflict'` into `invalidated`, and **nothing in TypeScript checks
that the caller really installed that projection**: a caller that did not gets a session refusing more
than it has to, which is the direction this application errs in. That sentence is in `applyMove`'s
JSDoc as well as here.

**The tests were the other half of the finding.** The §7 case paired a *refused* result with an
adoption — a pair `BrowserState.moveMatch` cannot produce — while the pair it does produce, conflict
plus `notOwed`, was untested. That case is replaced by the real pair, and a second case in
`workspace.test.ts` asserts `invalidated`, `spent` and `canChoose` **from the wrapper's own answer**:
it opens a session, drives `state.moveMatch` to a scripted conflict, checks the answer really is
`answered` + `notOwed`, and feeds that value to `applyMove`. Nothing in it is hand-built except the
scripted command result.

### 8.3 Finding 3 [High] — the record prescribed a producer that recreates the defect F2 closed

**What it was.** §2.6, hole 5 and §7.2 all said `identityInProjection` is what closes the
`unsavedDraft` residual. It is not, and its own doc comment says so: it resolves by **arena node
alone** and answers whatever the current parse holds at that node. Draft A held at R0/node 10 with an
unrelated snippet B at R1/node 10 makes it answer B's R1 identity, and handing that to
`moveEligibility` refuses **B** for `unsavedDraft` — which *is* §7.2's finding, reached through the
producer §7.2 prescribed to close it.

**What closed it.** The claim is removed from all three places and from `moveEligibility`'s doc
comment, and replaced by what is true: the residual is open, `identityInProjection` must not be used
as its producer, and hole 18 names the two shapes that would settle it — a coordinator that owns the
relation between an open editor and the snippet it edits and re-points it when a projection is
installed, or a rule that a snippet with a stale draft is not offered a move until the draft is
resolved. **Neither is invented here**: step 2 has the component, this step has none.

**Where `identityInProjection` is still used, it is correct, and the difference is one word.**
`sessionIsLive` and `confirmDelete` require the answer to be *equal* to the identity they already
hold, revision included, so a node reused by another snippet fails the comparison instead of
resolving to it. It is safe as a **check** and unsafe as a **producer**.

### 8.4 Finding 4 [High] — "cannot disagree by construction" is not what the code gives

**What it was.** §7.3 and the module header guaranteed that `matchMoveView` and `beginMove` cannot
disagree. They share one rule — `refusalGiven` — but they take their liveness from **two independent
arguments**: `matchMoveView(session, R0Views)` answering `canMove: true` beside
`beginMove(session, identityInProjection(R1Views, session.match))` answering `null` type-checks and
nothing refuses it. What the shared rule really gives is agreement **when the two are handed
consistent inputs**.

**What closed it.** The claim is qualified everywhere it appears — §2.10, §7.3, the module header,
`refusalGiven` and `beginMove` — to *one rule over consistent inputs*, in each case in the same
sentence that says the inputs are not forced. And what would close the remaining half is written as a
requirement on the step that can meet it: **step 2's component must derive the view, the destination
options and the submission identity from one read of the current projections, in one synchronous
block.** That is a requirement on a caller, and no type in this module can state it — which is why it
is stated where a person will read it.

### 8.5 What this round leaves open

1. **Hole 18** — the missing draft-to-snippet relation, which is the honest replacement for a claim
   this record made twice.
2. **§7.6's four items all still stand**: `canChoose` still does not take the live projections,
   nothing makes a caller pass the current ones, there is still no way back from an `outOfDate`
   session, and **no screen has rendered any of this** — the mounted-component test and the window
   reading are step 2's, exactly as hole 1 says. The fourth item's *other* half — "every claim in this
   section is about model tests" — stopped being true in this round, and saying so was the third
   pass's sixth finding: the conflict invalidation of §8.2 is also asserted from the real
   `BrowserState.moveMatch` in `workspace.test.ts`, which is wrapper-level evidence. **Wrapper-level
   is still not a screen.**
3. **`mayHaveWritten` has no way back either**, and deliberately: the only honest repair is to look at
   the file, which is a thing a person does outside this window, and then re-open the panel over a
   fresh projection. **No `MoveRecovery` is offered beside it**, and this record claimed the opposite
   for one round (§9.3): `mayHaveWritten` in `ipc/errors.ts` answers `true` for `saveFailed` alone,
   and `moveRecoveryChoices` offers `reloadFile` for four *other* codes, so a real failure of this
   kind — a directory sync interrupted after the rename — produces `spent: true` and an empty
   `recovery`. That is not a gap: the wrapper has already attempted the re-read a recovery would
   offer, and what is left is closing the panel and re-opening it over a fresh projection.
   `MoveRecovery.reloadFile` itself is still a code with no producer on `BrowserState` (hole 4).

---

## 9. The third scoped pass

`docs/reviews/phase-2c-3b-1-third-pass.md`, `READINESS: NOT READY`. It re-checked §8's four fixes and
found **F2, F3 and F4 holding** — a conflict invalidates the session while a refusal and a
same-revision `notOwed` do not; the false `identityInProjection` claim is gone and hole 18 records
what is really missing; and every operative claim now says *one rule over consistent inputs*. **F1 it
found BROKEN**: `mayHaveWritten` is reachable, sticky and terminal, but §8.1 put its refusal *below*
`moved` and gave it a sentence blaming a repetition, so the one fix of the previous round is the one
this round had to redo.

Six findings, three High, one Medium, two Low. **Four of them were false sentences rather than
defects in behaviour** — three in this record and one in each dictionary — which is the class no test
can fail, found for the third round running. The pass's own analysis is a table of the reachable
`moved`/`invalidated`/`mayHaveWritten` combinations, and findings 1 and 2 rest on it: the `111` row
exists, and `001` and `111` must both be true of whatever the panel says.

Nothing outside `src/lib/browser/matchMove{,.test}.ts`, the two dictionaries and this record was
touched: no `.svelte` file, no Rust, no `vite.config.ts`, no corpus fixture. The dictionaries stayed
at **37 keys per language** — two sentences were rewritten and no key was added or removed.

### 9.1 Finding 1 [High] — the refusal shown contradicted the failure shown

**What it was.** `refusalGiven` asked `moved` before `mayHaveWritten`, so a session that had committed
a move and then met a send this application could not account for — the table's `111` row — answered
`alreadyMoved`. The panel then drew a definite *this snippet has been moved* beside a send failure
saying it may have moved or may not, and dismissing the panel took the uncertain half away while the
flag stayed set.

**What closed it.** The two checks are swapped, and — because this is the second round in a row to
move that arm — **the ordering is now written as a rule with its reason** rather than as an
arrangement of `if`s, in `refusalGiven`'s JSDoc, in the module header and on the two arms themselves:
*where two arms are true at once, the one that claims less wins*, because each arm renders one
sentence and a sentence is read as a claim about the person's file. `mayHaveWritten` — *this
application cannot tell what happened* — is the weakest of the seven, so it is asked first: above
`alreadyMoved`, and (as §8.1 already had it) above the liveness check, whose sentence says nothing was
written.

**The test drives both orderings and both pairs**: a committed session that then takes an uncertain
send, an uncertain session that then takes a committed answer, and a dismissed conflict — `outOfDate`
on its own — that then takes an uncertain send and stops saying so.

### 9.2 Finding 2 [High] — the on-screen reason for the terminal state was false

**What it was.** Both dictionaries and §8.1 said that moving again could repeat a change that has
already happened. **It could not.** A session sends the base revision frozen at `startMatchMove`, so a
first write makes that base stale and any send still carrying it is refused as a conflict rather than
applied a second time — and this session is spent in any case; and after re-opening the panel over the
new revision, the same destination is where the file already writes the snippet, which `alreadyThere`
refuses. The terminal state rests
on **uncertainty and a stale identity**, not on duplicate execution.

**What closed it.** `browser.matchMove.cannotMove.mayHaveWritten` says, in both languages, that a move
was sent and this application cannot tell whether the file was written, so **this panel can no longer
establish where the snippet is**: look at the file, then close this and pick the snippet in the list
to move it from wherever the file now writes it. `browser.matchMove.mayHaveWritten` — the send-failure
line beside it — lost "the snippet may already have moved, or may not", which is false in the `111`
row, for "whether that move happened cannot be told from here", which is true in both rows. §8.1's own
sentence is corrected in place, and both sentences are new copy rather than a reshuffle of the old.

### 9.3 Finding 3 [High] — §8.5 described a pair that cannot exist

**What it was.** §8.5 said `MoveRecovery.reloadFile` is offered beside `mayHaveWritten` when the
failure carries one of the four identity/sequence codes. **That pair is unreachable in production**,
and this was checked against the code rather than against the record: `mayHaveWritten` in
`src/lib/ipc/errors.ts` answers `true` for `saveFailed` and for no other code, while
`moveRecoveryChoices` returns `reloadFile` for `moveNotWithinOneSequence`, `identityStaleRevision`,
`identityNoSuchMatch` and `identityWrongDocument` — four *other* codes. A real failure of this kind
gives `spent: true` and `recovery: []`.

**What closed it.** §8.5 item 3 now says that, and says why it is not a gap: the wrapper has already
attempted the re-read a recovery would offer, and the repair is to close the panel and re-open it over
a fresh projection. `moveRecoveryChoices`'s JSDoc states the same derivation, **and says in the same
sentence what no type forces**: the flag and the reason are two arguments of `moveCouldNotBeSent`, so
a caller that does not take both from one failure can produce the pair by hand. A test asserts the
empty `recovery` beside the real `saveFailed` rejection.

### 9.4 Finding 4 [Medium] — the module header contradicted the implementation

**What it was.** The header still said `invalidated` comes "from the adoption `BrowserState.moveMatch`
reports". Since §8.2 a conflict sets it **solely** from `result.outcome === 'conflict'`, because the
wrapper installs the conflict's disk projection while reporting `adoption: notOwed`. `applyMove`'s own
JSDoc said so; the header and `MatchMoveSession.invalidated`'s field comment did not.

**What closed it.** Both now say `applyMove` derives it from a committed save, from an adoption owed
at all, **and** from the conflict arm. The field comment was not in the finding and was corrected with
it: it carried the same sentence.

### 9.5 Finding 5 [Low] — a structural guarantee had lost its test

**What it was.** §8.2 replaced a refused-plus-`ADOPTED` case with a conflict-plus-`notOwed` one. The
replacement is the pair production really answers, but the predecessor observed something else: that
an adoption owed **at all** invalidates whatever arm carried it. With only the conflict case, moving
`adoption.kind !== 'notOwed'` inside `applyMove`'s saved branch would keep every reachable adoption
test green.

**What closed it.** Both cases exist. The new one is labelled as a **structural guard over a pair
`BrowserState.moveMatch` cannot answer**, so nobody reads it as a claim about production, and it
drives `done` and `failed` — the two arms of "owed at all".

### 9.6 Finding 6 [Low] — "every claim is about model tests" stopped being true

**What it was.** §8.5 said §7.6's four items stood unchanged, and §7.6's fourth says every claim in it
is about model tests. §8.2 had added a case in `workspace.test.ts` that drives the real
`BrowserState.moveMatch` through `createBrowserState`.

**What closed it.** §8.5 item 2 says the conflict invalidation now has **wrapper-level** evidence and
that the no-screen limitation is untouched: the mounted-component test and the window reading are
step 2's, and wrapper-level is still not a screen.

### 9.7 What this round changed that the review did not ask for

1. **`MatchMoveSession.invalidated`'s field comment**, folded into §9.4 — it repeated the header's
   false sentence, and fixing one and not the other would have left the class of defect in place.
2. **The `saveFailed` rejection is a shared `UNCERTAIN` fixture** in the test file rather than an
   inline literal in one case, because two cases and four sends now need the exact failure production
   produces — and the empty `recovery` of §9.3 is only meaningful over that failure.
3. **§1's table said 50 cases**; the file has 52.

### 9.8 What this round leaves open

1. **Everything in §8.5 that this round did not correct** — hole 18, `canChoose` not taking the live
   projections, no caller forced to pass the current ones, no way back from an `outOfDate` session,
   and no screen anywhere.
2. **The `111` row is reachable only through a caller this module does not offer.** Nothing here
   produces a second answer for a spent session — `beginMove` returns `null` — so the row exists
   because `applyMove` and `moveCouldNotBeSent` or into their flags rather than assigning, and the
   tests reach it the same way a defensive caller would. The copy is truthful there all the same,
   which is the point of the finding.
3. **No test can fail for a false sentence.** Four of this round's six findings were prose, and the
   only thing standing between the next one and a person reading it is the next review round.
4. **Every claim in this section is about model tests**, exactly as §7.6 said of the last round.
