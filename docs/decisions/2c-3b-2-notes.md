# Phase 2c-3b step 2 — decision record

**Move on a screen.** Step 1 built move as a value and touched no `.svelte` file
(`docs/decisions/2c-3b-1-notes.md`); this draws it, closes the plumbing items `PROGRESS.md` listed
under *What step 2 owes*, takes the R36 decision that step 1 left open, and supplies two of the
three kinds of evidence `docs/decisions/2c-split-notes.md` §7 requires. **The window reading is not
in this record and is still owed** — see §4 hole 1.

The authority for what is drawn is `docs/reviews/phase-2c-3b-design.md`, the design consult for the
whole of 2c-3b. Seven of its nine answers — Q1, Q4, Q5, Q6, Q7, Q8 and Q9 — are statements about
*this* screen. Where this record and that document disagree, the consult is right and this is a bug.

---

## 1. What this step built

| File | What changed |
|---|---|
| `src/lib/components/MatchMover.svelte` | **new** — the destination panel: Top / After… / End, one explicit move action, the boundary sentence, the recovery, and all three outcome arms |
| `src/lib/components/MatchMover.test.ts` | **new**, jsdom — twelve mounted cases plus one over a **real** `BrowserState` |
| `src/lib/components/DetailPane.svelte` | a fifth mode of the third pane, its opener, `unsavedDraftFor`, and `movingMatch` in `busy` |
| `src/lib/browser/workspace.svelte.ts` | `rereadDocument` — the producer behind `MoveRecovery.reloadFile`, with its three generation captures; `moveMatch` now takes `MatchId`s |
| `src/lib/browser/workspace.test.ts` | five model cases for `rereadDocument`, two of them races; every `moveMatch` call site moved to identities |
| `src/lib/browser/matchMove.ts` | `moveRecoveryFailed` — what a failed recovery re-read does to the session (section 5, F5) |
| `src/lib/browser/matchMove.test.ts` | one model case for it |
| `src/lib/i18n/{en,es}.json` | one new sentence per language — `browser.matchMove.reloadFailed` — and **four reworded** ones (section 5) |

**No Rust was written**, as `PROGRESS.md`'s "Next action" expected: `cargo test --workspace` is
unchanged at 1008. Thirty-three of the other thirty-seven `browser.matchMove.*` sentences were
written in step 1 and are reused unchanged; the four the aggregate review found overclaiming are
section 5's. Nothing in the component builds a key.

---

## 2. The decisions

### 2.1 D1 — the panel is a fifth mode of the third pane, and it captures what it is about

`MatchMover` is drawn where `MatchEditor`, `MatchDeleter`, `MatchCreator` and `RawEditor` are drawn,
in the same `{#if}` chain, and its opener is withdrawn while any of the five is showing. Its
`projection` and `match` are captured **in one assignment** at the call site, which is 2c-2-2's High
finding: `startMatchMove` checks the two against each other, and it additionally derives the whole
destination list from the projection, so a pair taken from two reads would offer anchors from one
parse for a snippet addressed in another.

The mutual exclusion is not only tidiness here. It is where the R36 refusal of §2.4 is actually
enforced.

### 2.2 D2 — the component holds no rule, and the two rules it *can* break are named in it

Every decision — what may be moved, where to, when a send may start, what a refusal means, what a
commit spends, what the wire takes — is in `src/lib/browser/matchMove.ts`. The component walks
`matchMoveView`, `movePlacementOptionsOf` and `canChoose`. Two things are nonetheless only
enforceable in a component, and both are written where they can be broken:

- **`view.notMovable` is never drawn beside a `cannotMove` of `outOfDate`.** The frozen eligibility
  reason and the live submission refusal answer at two different times: `eligibility` is computed
  once at `startMatchMove` and no transition recomputes it, so after a reprojection *this snippet
  cannot be moved* is a definite claim read off a parse the window has replaced. `refusalGiven` puts
  `outOfDate` above `notMovable` for exactly that reason, and a panel drawing both would put the
  suppressed certainty straight back through the other field. **Nothing in TypeScript can enforce
  this**; the condition is one line of markup and the pair of mounted cases in §3 is what fails if it
  is removed — one asserting the reason *is* drawn while the session is live, so the other is not
  vacuous.
- **R37 — one projection read.** `current` is a single `$derived.by` that calls `projections()`
  **once** and derives the view, the destination options and the array `beginMove`'s identity is
  looked up in from that one value. `matchMove.ts`'s header states that its agreement is one rule
  over *consistent* inputs and that no signature can force consistency; this is the caller that
  closes the remaining half. **Nothing checks that it stays closed**: three separate `$derived`s
  would type-check identically and could fall between two parses.

### 2.3 D3 — the affordance, and what it deliberately does not have

Consult Q1 as written: a destination list of **Top**, one option per other snippet in the file's own
order, then **End**, with one explicit *Move this snippet* action. Row controls and drag-and-drop are
deferred. The moving snippet is not among its own anchors, and the list is
`movePlacementOptionsOf`'s — the **complete, unfiltered** sequence (Q6), so the search box cannot
decide where a snippet lands. Where two options are one request — for the last snippet, *End* and
*after the one above it* — **both** carry *Where it is now*, because that aliasing is what the model
computes on the lowered target and hiding it would make one of the two look like a move.

**No confirmation dialog** (Q7). Choosing a destination and pressing the action is already two
deliberate steps; only a validation refusal introduces the acknowledge-and-retry round, and that
round is one click here rather than the deletion panel's two, because `confirmDelete` consumes a
pending confirmation and a move has none to re-raise.

**The boundary sentence stays beside the list in every scope** (Q4), and it is drawn from
`projection.relative_path` rather than from the `file` summary prop: it is a claim about where the
destinations below it came from, so it names the parse they were actually built from and is drawn
whether or not this window lists a summary for the file. Foreign snippets get no disabled rows —
consult correction 8: the creation form's *show every ineligible destination* rule is about files
that could receive a snippet, and a snippet in another file is outside a move's destination domain
rather than a failed candidate.

**A spent session is a dead end with a way out, and the panel says which one** (`PROGRESS.md` item
9). There is no repair for an `outOfDate`, an `alreadyMoved` or a `mayHaveWritten` session, and
after §2.7's fix that is **three** histories rather than two: every identity it holds was minted
from a parse that is gone, **or** from a send whose effect this application cannot establish,
**or** — the `moveRecoveryFailed` case — from a parse that is **still installed** but whose
identity the command has already contradicted, with no better one obtainable. The third is the one
this paragraph claimed did not exist until the confirmation pass found it: there the parse is not
gone, and writing that it is would be this record claiming a fact the code does not produce.
The sentence `view.cannotMove` renders is what tells the person to close the panel
and pick the snippet in the list again, and the header's *Leave it where it is* is that exit. A
*Move it anyway* would be a control that cannot work.

### 2.4 D4 — R36 / hole 18: the conservative refusal, and not a coordinator

**The decision `PROGRESS.md` item 6 left open is taken in favour of the refusal.** A snippet this
window is holding a draft for is **not offered a move** until that draft is saved or discarded.

The argument is asymmetric and that is the whole of it. The refusal's cost is bounded: a person who
wants to move a snippet they are editing closes or saves the editor first, and **no edit is ever
stranded**. The alternative — inferring, across a reparse, which snippet an open draft is about — has
no correct implementation available. `identityInProjection` resolves by **arena node alone** and
answers *that projection's* identity, so feeding its answer into `moveEligibility` would refuse the
move for whichever snippet now occupies that node, which can be an unrelated one; its own doc comment
forbids the use, and a previous round shipped exactly that defect. A coordinator that owns the
editor-to-snippet relation and re-points it in the same synchronous block that installs a projection
is the other shape, and it is a piece of architecture rather than a wiring — it is **not** built here.

It is implemented twice, at two levels, and the two are not the same claim:

- **In `DetailPane.svelte`'s `busy`**, which is where it actually binds today: the move panel cannot
  be opened while the small editor is open, so a snippet with a draft — stale identity or live — is
  not offered a move at all. This is the conservative refusal reached one step earlier than the
  model's own arm, and it needs no identity comparison to be right.
- **In `unsavedDraftFor`**, the producer §2.5 describes, so that the model's arm becomes live the
  first moment the exclusion above stops holding.

### 2.5 D5 — `unsavedDraftFor` has a producer, and it over-refuses on purpose

`DetailPane.unsavedDraftFor()` answers `editingMatch?.match.id ?? null` — the identity of the snippet
the small editor is open over, as that editor's own captured projection gave it. Three things about
it, stated rather than implied:

1. **It over-refuses.** The pane cannot see inside `MatchEditor.svelte`, so an open editor with
   nothing typed in it is reported as a held draft. Over-refusing costs a person one closed editor;
   under-refusing strands edits. This application errs in the first direction.
2. **The identity is the editor's, not one resolved through the live projection.** That is D4 again:
   there is no lookup that can follow a draft across a reparse, and the one that looks like it can
   answers a different snippet's identity. A stale draft identity therefore fails
   `moveEligibility`'s three-field comparison — and is caught by the mutual exclusion instead.
3. **Today it always answers `null` while a move panel is open**, because of that same exclusion. The
   wiring is real and the arm is currently unreachable from the running screen; `MatchMover.test.ts`
   drives the non-null case directly, and §4 hole 3 records the gap.

### 2.6 D6 — `BrowserState.moveMatch` now takes identities (the `PROGRESS.md` item 8 friction)

**Chosen: change the wrapper's first two parameters** to `MatchId` and `MatchId | null`, rather than
resolving identities back into `MatchView`s in the component.

Only `.id` was ever read from either argument, so the projections were friction rather than
information — and the friction was not free. `beginMove` produces a `StartedMove` whose `match` and
`after` are `MatchId`s, so a component satisfying the old signature would have had to look each one
up in a projection again, and a lookup that answers `undefined` is a way for a decided move to be
dropped **between the model and the wire**, after every check has passed. Changing the signature also
makes all five writing wrappers take identities, which removes the one exception a reader had to
remember. The cost was fifteen mechanical call sites in `workspace.test.ts`.

### 2.7 D7 — `rereadDocument`, the producer behind the recovery (the `PROGRESS.md` item 4)

`MoveRecovery.reloadFile` — consult Q8's *Read this file again*, offered for the four codes that say
this window and the file disagree about an address — was a code with nothing behind it:
`commands.reloadDocument` was reachable only from inside `select()`'s own repair.
`BrowserState.rereadDocument(document)` is what is behind it now. It calls `reloadDocument`, drops
**both** text caches for that file, installs the projection through the same `installView` every
adoption uses, and repairs the selection the ordinary way — positionally and then checked, so a
different snippet at the held position drops it with a notice (R27) rather than being silently
adopted.

Three decisions inside it, the third of them corrected by the aggregate review:

- **A read that fails leaves the stale projection in place**, and answers the failure rather than
  swallowing it. Nothing here knows the file is gone, only that this attempt did not reach it, and
  dropping a file's whole projection is a bigger claim than a failed read supports. The panel draws
  `browser.matchMove.reloadFailed` and the typed reason, so a control that appeared to do nothing
  says why instead. That sentence is the one new dictionary key this step adds. **What that failure
  means for the caller's own session is the caller's**, and section 5's F5 is where it is decided.
- **An answer that is no longer wanted installs nothing** (F1). Three generations are captured before
  the await, and the shapes are the ones this module already uses rather than a new one:
  `openGeneration` as `open()` takes it, a **per-document re-read** counter as `readFileText` takes
  `fileTextGeneration` — *requests*, so that of two overlapping reads the newer wins whichever order
  the answers arrive in — and that document's **projection** generation as `select()` takes it, so a
  projection installed meanwhile by an adoption or a repair is not overwritten by a read that started
  before it. The re-read counters are deliberately **not** cleared by `open()`: clearing would let the
  first re-read of a new workspace match a capture from the closed one, and `openGeneration` is what
  covers that case anyway. `null` therefore means *the read did not fail*, never *this call installed
  something*.
- **A successful re-read is not reported as a success — and it does not always spend the session.**
  The panel notices through the live projections that what it holds is from a parse that is gone, and
  says `outOfDate`. **That happens only when the projection installed is a different one** (F6): a
  re-read of a file whose bytes have not changed answers the same revision, the three-field identity
  comparison still succeeds, and the session goes on being usable — which is right, because nothing
  about the file changed. The first version of this record claimed the panel becomes `outOfDate` after
  **every** successful re-read, and `MatchMover.svelte`'s own comment said the same. That is this
  project's named worst defect class — prose claiming a guarantee the code does not give — so the
  words were fixed and the code was not.

### 2.8 D8 — the destination list is bounded and the action row is sticky

`docs/decisions/2c-3a-2-window-reading.md` §7.2 measured what an unbounded one-row-per-something list
does to this pane: the creation form opened 805 px tall inside a 645 px pane with *Add this snippet*
below the fold, and it got worse with every file in the workspace. **A move's destination panel is
the same shape and is routinely longer** — one row per snippet in one file's list rather than one per
file. So it gets the same two-part fix, before the reading rather than after it:
`max-height: 12rem; overflow-y: auto` on `.destinations`, which makes the list's height a constant
instead of a function of the snippet count, and `position: sticky; bottom: 0` on `.actions`, which
keeps the primary control and the sentence that says why it is disabled on screen when something else
makes the panel taller. **Nothing is omitted and no label is clipped.**

**This is the bound, not the measurement.** 12rem is an estimate, jsdom has no layout, and whether a
Spanish label wraps at the target window size is the window reading's job (§4 hole 1).

---

## 3. Verification

| Command | Result |
|---|---|
| `npm run check` | exit 0 — 407 files, **0 errors, 0 warnings** |
| `npm test` | exit 0 — **1242 tests over 44 files**, from 1219 over 43 |
| `npm run build` | exit 0 — **168 modules**, from 166 |
| `cargo test --workspace` | exit 0 — **1008 passed, 0 failed**, unchanged |

The counts above are the ones after section 5's fixes. Before them the suite was 1237; the five
added tests are one model case for `moveRecoveryFailed`, two race cases for `rereadDocument` and two
mounted cases for the two outcome states the review found untested. **The module count did not move**,
because none of the fixes adds a source module.

**The module guard is rebaselined to 168, and the rebaseline was measured rather than assumed.** A
pristine `git archive HEAD` copy built with the same `node_modules` transforms **166**, so the delta
is **+2**, which is exactly the number of new *source* modules the production bundle gained:
`MatchMover.svelte` and — this is the half worth naming — `src/lib/browser/matchMove.ts`, which until
now reached production only through `src/lib/i18n/index.ts`'s **type** imports and was therefore
erased. The bundle contains no `svelte/internal/server`, so this is new modules and not the
`resolve.conditions` regression, and `vite.config.ts` is untouched.

**The twenty-three new tests were counted per file rather than estimated**, by running the suite in a
pristine `git archive HEAD` copy and diffing: thirteen in `MatchMover.test.ts`, five in
`workspace.test.ts`, one in `matchMove.test.ts`, and **four that no one wrote** — the markup scanners
in `scripts/lint/` derive their cases per `.svelte` file, so one new component adds one to
`built-translation-keys`, one to `hardcoded-strings` and two to `ipc-detail`. The one new dictionary
key adds **no** test of its own, and neither do the four reworded ones:
`dictionaries.test.ts` walks the two files inside a fixed number of cases.

The thirteen mounted cases, and what each is *for*:

| Case | The claim only a screen can break |
|---|---|
| offers the file's order, excludes the snippet itself, sends nothing until asked | Q1 and Q6, and that the anchor which travels is the model's identity rather than a row index |
| lowers End to the last other snippet, and shows the aliasing | `end` is this application's lowering, and two options can be *where it is now* at once |
| refuses a snippet this window is holding unsaved edits for | `unsavedDraftFor` reaching the model through a prop at all (§2.5) |
| draws the frozen reason while the session is live | the non-vacuity half of the case below |
| never draws the frozen reason beside a live `outOfDate` | **the one rule `matchMove.ts` states and cannot enforce** (§2.2) |
| carries the acknowledged findings into the second attempt | consent bound to the exact candidate, in one step rather than two (Q7) |
| spends itself on a commit and offers no further destination | the commit spends the session, and `landed: null` has its own sentence |
| **a commit whose adoption failed** | the pair the review found untested and contradictory: `moved` beside `windowOutOfStep` (F2) |
| **a commit the command could not name the snippet in** | `landed: null` on a screen, with the sentence that keeps the uncertainty (F3) |
| says nothing was written when the window refused before any command ran | `notAttempted` is the one arm that may say that |
| spends the session on a `mayHaveWritten` send, and offers no re-read | the weakest claim wins, and no recovery follows from the model rather than from markup |
| says why a re-read failed, and stops offering to send after it | a control that appeared to do nothing says why instead — and a recovery that could not reach the file spends the session (F5) |
| **over a real `BrowserState`**: the recovery reads the file again, and then nothing sends | `structuredClone` over a `$state`-proxied identity, `rereadDocument` end to end, and the live-identity check over a projection the state replaced on its own |

The last one is mounted over a real state for `MatchDeleter.test.ts`'s reason: a hand-rolled stub is
not reactive, and the whole question is what the panel says *after* the state has replaced its own
projection. It is also the only case that can catch a dropped `plainIdentity` — model tests pass
plain fixtures, so the whole of `matchMove.test.ts` would be green over a call that throws the moment
a real window makes it.

---

## 4. Holes this step leaves open

1. **No window reading.** The third of `2c-split-notes.md` §7's three kinds of evidence is **not** in
   this record and is owed before 2c-3b can be called complete. A green suite is not a screen
   (`1c-1-notes.md` hole 1, and 2c-1b's own conclusion): jsdom has no layout and no WebKit, and a
   mounted test proves a handler fires, not that a window draws. In particular **§2.8's bound is an
   estimate and not a measurement**, and the panel is the same shape as the one that produced the
   2c-3a-2 layout defect. The technique is `1c-1-notes.md` §10; the WKWebView constraint — **one plan
   per launch, into a fresh bundle path** — is `1c-2b-2b-2-notes.md` §6.1; and the language must be
   set **through the picker**, because the webview's `localStorage` follows the bundle identifier
   (`2c-2-2-window-reading.md` §1.2). The reading should also look at the creation form's width in
   Spanish while it is there, which `PROGRESS.md` has owed since `fragmento` replaced `atajo`.
2. **`invalidatedByCommit` is still unsettled** (`2c-3b-1-notes.md` §5, `PROGRESS.md` item 10). A
   selection at a position a committed reorder touched is dropped with the `differentMatch` notice,
   which tells the person their file changed on disk after a move they asked for. Nothing in this
   step changed that, and the reading is where it is meant to be judged, over a file of at least
   three snippets with the selection moved mid-flight inside and outside the shifted range.
3. **The `unsavedDraft` arm is unreachable from the running screen** (§2.5, point 3), because the
   pane's five write surfaces are mutually exclusive. The rule is exercised by the mounted test and by
   the model suite, and by nothing a person can do today.
4. **`unsavedDraftFor` cannot distinguish a dirty editor from a clean one** (§2.5, point 1). Closing
   that needs the small editor to report its own `isDirty` upward, which changes `MatchEditor.svelte`
   and therefore obliges a re-taken 2c-2-2 window reading. It is deferred rather than forgotten.
5. **R37 depends on a caller, and nothing enforces it** (§2.2). One caller exists. Three separate
   `$derived`s over `projections()` would type-check identically and would reintroduce exactly the
   inconsistency `matchMove.ts`'s header describes.
6. **`beginMove`'s identity depends on a caller passing a live reader**, and nothing enforces that
   either — the `projections` prop could answer a captured array or `() => []` and the component
   would type-check. This is `matchDeletion.ts`'s standing hole, inherited unchanged.
7. **`identityInProjection` and `plainIdentity` still live in `matchDeletion.ts`**, which is a module
   about deletion, and three modules now import them. `2c-3b-1-notes.md` recorded the right home as a
   module about identities; this step did not move them, because moving them touches every importer
   for no behavioural gain and this step already changed a wrapper signature.
8. **A re-read that fails is drawn only inside the send-failure panel.** `reloadFailure` is cleared
   when a destination is chosen or an outcome dismissed, so the sentence cannot outlive the send it
   was about — but it also means a person who dismisses the panel loses the reason. That is judged
   right rather than merely convenient: the reason is about an attempt, not about the file. **Since
   §5's F5 the session itself is spent by that failure**, so what survives the dismissal is the
   `outOfDate` refusal beside the control, which is the sentence that says what to do next.
9. **The panel offers no repair for a spent session**, by decision (§2.3). Whether the sentences
   really read as *close this and pick the snippet again* rather than as a dead end is a claim about
   a screen, and hole 1 is where it gets tested. §5's four reworded sentences make that reading
   sharper rather than softer: three of them are longer than what they replace, and hole 1's
   measurement of this pane is where a longer Spanish sentence shows up.
10. **Nothing in the suite fails if a sentence starts overclaiming again.** The four fixes of §5 are
   changes to *copy*, and the mounted cases assert which key is drawn, never what it says — a
   substring assertion over a sentence is brittle enough to become its own defect the first time the
   wording is improved. What guards this class is a reading of the words beside the state that
   produces them, which is what the aggregate review did and what hole 1 will do again.

---

## 5. What the aggregate code review changed

`docs/reviews/phase-2c-3b-2-code.md` returned **NOT READY** with six findings. All six are closed;
three of them are this project's recurring defect class — a sentence, or a note, claiming more than
the code establishes — and the rule applied throughout is the one `refusalGiven` already states:
**where two things could be said, the one that claims less wins.**

| # | What was wrong | What was done |
|---|---|---|
| F1 | `rereadDocument` awaited with no generation captured, so an older read could install over newer state | three captures before the await — §2.7's second bullet — and two race cases in `workspace.test.ts` |
| F2 | a committed move whose adoption failed drew *the file has been read again* beside *this window could not read it back* | `browser.matchMove.moved` no longer mentions a re-read at all; a mounted case drives the pair |
| F3 | `movedNotIdentified` said *It is in the file* about a snippet an intervening change may have removed | it now says the window cannot tell where it is or whether it is still there; a mounted case drives `landed: null` |
| F4 | `sendFailed` said *The snippet is where it was*, which a failed send does not establish about a file another program may have changed | it says only that **this move** wrote nothing |
| F5 | a failed recovery re-read kept a session live against a projection the command had already contradicted | `moveRecoveryFailed` in `matchMove.ts` spends the session; **the workspace's invalidation was not touched** |
| F6 | this record and the component both claimed every successful re-read makes the panel `outOfDate` | both qualified: only a re-read that installs a **different** identity does |

Three things about how they were fixed, because each is a decision rather than a transcription:

- **F5 is a change to the session, not to the workspace.** The review's suggested fix was to give
  recovery re-reads invalidating semantics — dropping the projection and the selection through the
  invalidation helpers. That was declined. This state's selection machinery is **two** counters, a
  per-document `projectionGenerations` map and a global `selectGeneration`, and driving them from a
  new call site is precisely how 2c-3a-1 shipped a data defect that 1112 green tests did not see. The
  smaller fix answers the finding as stated — the session stops being sendable, keeps no destinations
  worth pressing, and cannot resend the disputed identity — while the projection stays where §2.7's
  first bullet puts it, because a failed read still does not establish anything about the file.
- **F5's terminal state is justified by the disagreement and the stale identity, never by
  duplication.** A session resends its **frozen** base revision, so a first write that did land makes
  that base stale and a retry conflicts rather than writing twice. That is the same sentence
  `MatchMoveSession.mayHaveWritten` carries, and both dictionaries said otherwise once.
- **F5 forced a fifth change to the copy**, and it is the one worth naming.
  `browser.matchMove.cannotMove.outOfDate` said *This window has read this file again since this
  panel was opened* — true of its three original producers and **false** of the fourth, where the
  window tried to read the file again and could not. One arm renders one sentence, so the sentence
  has to be true of every way of reaching the arm: it now says the destinations come from a reading
  this window can no longer stand behind, and says nothing about how that came about. Replacing an
  overclaim with a differently-shaped overclaim would have been the same finding again.
