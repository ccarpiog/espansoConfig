# Phase 2d-6-4 — operation-session external conflicts

**Status: implemented, reviewed (§7), the review's three blockers and one should-fix re-derived
and fixed, gates green.** Risk class:
**medium** — four new fields and two new transitions on each of three immutable session values,
three reapplies re-entered through 2d-6-2's generalized entry with the `exact` tier read for the
subject (and, for the mover, the anchor) off one validated table, two new refusal codes on each of
the two surfaces that have codes and four new obstacle arms on all three, every one reusing a
sentence that already exists, and — from the review's fix round — an optional
`ReadTheInstalledSession` reader on every spending door, every settling transition and every
reapply of the three. **No `.svelte` file, no Rust, no new module, no new dictionary key, no
`BrowserState` member, no change to `reapply.ts`'s primitives.** `git status` shows changes
under `src/lib/browser/`, `src/lib/i18n/` and this file, beside the four instrument paths already
dirty and `PROGRESS.json`, already modified when the phase began.

This is the third of the four model-only session steps ([`2d-6-split-notes.md`](2d-6-split-notes.md)
§2, the *2d-6-4* entry) and the second to consume what 2d-6-2 placed in `src/lib/browser/reapply.ts`
and what 2d-6-3 added beside it. It is bound by §3 entries **6, 7, 8, 9, 11, 12, 19, 20 and 22** of
that record, by 1b's seventh verdict arm, by the two patterns 2d-6-3's fix round handed on
(`PROGRESS.md`, *Next action*), and by the orchestrator's standing ruling that the
`ReconciliationWorkspace` interface is not widened before 2d-6-6. **D2r and R25 are unchanged**:
`ItemMove` is same-sequence only, and a move is the only edit in its batch.

---

## 1. What changed, per deliverable

Line numbers are of the final tree. `D` is `src/lib/browser/matchDeletion.ts`, `U` is
`src/lib/browser/matchDuplication.ts`, `M` is `src/lib/browser/matchMove.ts`, `I` is
`src/lib/i18n/index.ts`.

### 1.1 Conflict storage and the widened accessors (entry 6)

All three sessions gained the four fields 2d-6-2 put on the editor, seeded inert by
`startMatchDeletion`, `startMatchDuplication` and `startMatchMove`:

- **`MatchDeletionSession.externalConflict: ExternalConflictModel<MatchId> | null`** (`D:486`),
  **`uncertaintyUnresolved`** (`D:502`), **`awaitingReconciliation: ReadonlyMap<DocumentId,
  ExternalConflictObservation>`** (`D:529`), **`heldDeliveries: readonly ObservationDelivery[]`**
  (`D:550`).
- **`MatchDuplicationSession.externalConflict`** (`U:564`), **`uncertaintyUnresolved`** (`U:580`),
  **`awaitingReconciliation`** (`U:606`), **`heldDeliveries`** (`U:627`).
- **`MatchMoveSession.externalConflict: ExternalConflictModel<MovePlacement> | null`** (`M:822`),
  **`uncertaintyUnresolved`** (`M:838`), **`awaitingReconciliation`** (`M:865`), **`heldDeliveries`**
  (`M:886`).
- **`conflictOf`** widened from `SaveConflictModel<T> | null` to **`ConflictModel<T> | null`** on all
  three (`D:680`, `U:805`, `M:1091`): the external conflict first, then the outcome's conflict arm,
  with the precedence stated as a definite answer for a hand-built session and a decision about
  nothing for one the module built. `canRequestDelete` (`D:698`) and `canChoose` (`M:1117`) refuse
  under either origin through it and needed no second rule. The three components that read the save
  arm's `expected`/`found` do so off `outcome`, not off these accessors, so no component changed and
  `svelte-check` is unchanged.
- Each view gained **`externalMessages`** (`D:1903`, `U:2283`, `M:3288`) and **`externalNotices`**
  (`D:1910`, `U:2290`, `M:3295`), and each view's `conflictChoices` is now produced from a private
  **`effectiveCapabilitiesOf`** (`D:1830`, `U:2177`, `M:2953`) — the reload withheld under the
  uncertainty, the reapply under the uncertainty or a held reading — through `conflictChoicesFor`,
  which stays the only producer. Under an external block a refusal panel keeps only `keepEditing`.
  No component reads any of the new fields; 2d-6-7 and 2d-6-9 do.

### 1.2 "Cannot submit" at every door (entry 8)

- **The deleter has no refusal code beside the control, and gained none.** Its doors are
  `canRequestDelete` (`D:698`), which `requestDelete` (`D:727`) asks, and `confirmDelete` (`D:860`),
  which asks it too; both now refuse under an external conflict (through `conflictOf`) and under a
  held reading of the session's own file (the private `awaitedFor`, `D:630`). A call past a disabled
  control answers the same session or `null`; why the control is off is said by the view's
  `externalMessages` and `externalNotices`, exactly as the editor's bare `beginSave` is explained by
  its view. **`confirmDelete` reads the pending identity, the session's own, the draft's candidate
  and `projected`, then the installed session through `current`, once, and only then asks the
  block** (R37; §7 finding 1): a receiver run from a getter behind `projected` is seen by the block
  rather than overwritten by the spend, and nothing caller-controlled runs between the block and
  `submissionOf`. Every existing case passes unchanged, because a refusal on any path is `null`
  whichever order it is found in. `requestDelete` takes no reader, and its doc says why: its one
  operand is the module-built session, and recording a question spends nothing external.
- **`MoveSubmissionRefusal`** (`M:1267`) and **`DuplicationSubmissionRefusal`** (`U:821`) each gained
  **`externalConflict`** (`M:1301`, `U:850`) and **`observationRetained`** (`M:1309`, `U:858`).
  `refusalGiven` (`M:1401`, `U:911`) — the one rule `moveSubmissionRefusal` / `beginMove` and
  `duplicationSubmissionRefusal` / `beginDuplicate` both ask — answers them where the save conflict
  sits: after `mayHaveWritten`, `alreadyMoved`/`alreadyDuplicated` and `saveInFlight`, in
  `conflictOf`'s precedence (external, then save), then the held reading, then `outOfDate`. The
  weakest-claim rule is kept: a session spent by a send it cannot account for says so before it says
  the file changed. `beginMove` (`M:1598`) and `beginDuplicate` (`U:1093`) read `projected`, then the
  installed session through `current`, once, then ask the rule — the order entry 8 and R37 require
  (§7 finding 1); their docs say so.
- **Two codes, no new sentence**, on both surfaces: `externalConflict` renders the external origin's
  own first line (`browser.externalConflict.fileChangedWhileOpen`, through
  `externalConflictMessageKey`) and `observationRetained` the retained notice's
  (`externalConflictNoticeKey`), in `moveSubmissionRefusalKey` (`M:3534`) and
  `duplicationSubmissionRefusalKey` (`U:2502`). A code of its own rather than `conflict` because that
  code's sentence says the file changed *while this move/duplicate was being sent* — false of an
  observation no save answered (entry 41's class). `MatchMover.svelte` and `MatchDuplicator.svelte`
  render whatever code `cannotMove` / `cannotDuplicate` carries through `tMoveSubmissionRefusal` /
  `tDuplicationSubmissionRefusal`, so the new codes reach the screen with no component change.
- **An unresolved write uncertainty blocks through the conflict it qualifies**: no transition in any
  of the three modules sets `uncertaintyUnresolved` without an external conflict, and each module's
  field doc says so rather than adding a fourth check for a state only a hand-built session reaches.
- **All three reapplies are submission boundaries too** and refuse a held reading and the uncertainty
  before `enterReapply` is entered — so before any evidence is read, pinned with a counting getter
  (§7 finding 4) — with the control withheld by the same facts through `effectiveCapabilitiesOf`,
  and ask both again, with the conflict's identity, of the installed session immediately before
  adopting (§7 finding 3).

### 1.3 The receivers as values: three `apply*Observation`, seven arms (entries 4, 5, 11)

**`applyDeletionObservation(session, delivery): MatchDeletionSession`** (`D:1333`),
**`applyDuplicationObservation(session, delivery): MatchDuplicationSession`** (`U:1602`) and
**`applyMoveObservation(session, delivery): MatchMoveSession`** (`M:2150`) switch over
`delivery.verdict.kind` with a `never` terminus — the editor's table, unchanged: `raised` /
`raisedWithoutReload` / `supersedes` through the private `replacedBy` (`D:1389`, `U:1656`, `M:2204`),
which retires a save conflict's outcome and submission (entry 7) and resets `reload` (entry 12);
`coalesced` and `notLater` change nothing but a wait; `retained` records the observation;
`writtenHere` lifts the wait recorded for **that** observation, by identity, and nothing else. While
`phase === 'saving'` every envelope is appended to `heldDeliveries`, and `applyDeletion` (`D:947`),
`deletionCouldNotBeSent` (`D:1091`), `applyDuplication` (`U:1186`), `duplicationCouldNotBeSent`
(`U:1349`), `applyMove` (`M:1715`) and `moveCouldNotBeSent` (`M:1886`) replay the whole list first to
last through the private `consumingHeldDeliveries` (`D:1046`, `U:1291`, `M:1822`) after their own
answer — and, since the review's fix round, every delivery the receiver appended to the installed
session during that replay, round after round until a read of the installed session finds none
(§7 finding 2; the private `extendsTheReplayed`, `D:1009`, `U:1264`, `M:1795`, is what tells an
appended-to list from one the transition cannot reason about). The three `apply*` keep entry 7 from
the other side: a `saved` or `conflict` answer retires the external conflict, a `refused` answer
leaves it.

**Which deliveries are about the session is decided by the observation's file, read once.** The
three sessions are opened *over* one file, like the editor, which reads none of the observation's
properties; they read `document` once, as the creator does, so a delivery about another file can
only end a wait recorded for that very observation (by identity, under that file's key) and raises
nothing — a reload of a stranger's conflict would adopt a file the person never named. A `retained`
about another file records nothing. The waits are the **file-keyed map** 2d-6-3's review gave the
creator (pattern (b) of the hand-off), with three private helpers per module (`awaitedFor`,
`withWait`, `withoutWait`); §2 item 2 says what the map claims on a session that cannot change its
file.

**`acknowledgeDeletionSnapshot`** (`D:1439`), **`acknowledgeDuplicationSnapshot`** (`U:1703`) and
**`acknowledgeMoveSnapshot`** (`M:2251`) take the editor's exported `AcknowledgeTheUncertainty` and
behave as its `acknowledgeSnapshot` does: asked at most once and only when there is something to
end, a `refused` leaves the session unchanged, an `acknowledged` puts the reload back at idle.

### 1.4 Pending-confirmation withdrawal, the reload reset and the dismissal (entries 9, 12)

- **The deleter's `replacedBy` writes `pending: null`** beside `reload: NOT_RELOADING`: a question
  asked about the snippet as this window projected it is not an answer about the file as another
  writer left it, so every replacing verdict — `raised`, `raisedWithoutReload`, `supersedes` — puts
  a `requestDelete`-ed session back to unrequested, and `confirmDelete` answers `null` to a pending
  question assembled by hand. `coalesced` and `notLater` answer the same session object, question
  included.
- **The mover and the duplicator hold no pending confirmation**, because neither asks one (consult
  Q7 for the move; the duplicate's ordinary path is refuse-then-acknowledge). What entry 12 resets
  on them is the reload step, and what it invalidates is a displayed reapply result — automatically,
  because `reapplyToShow` in `./reapply.ts` pairs a report to a session by identity and every
  replacing arm answers a new session (pinned with `attemptOfReapply` / `reapplyToShow` on all
  three). The chosen destination of a move is **retained** on the conflict, not reset: it is what the
  person asked for, and the reapply is what decides whether the disk still has a place for it.
- **`dismissDeletionOutcome`** (`D:1148`), **`dismissDuplicationOutcome`** (`U:1414`) and
  **`dismissMoveOutcome`** (`M:1963`) are unchanged in code and changed in contract (entry 9): each
  doc names the three fields the spread carries over, and each suite pins that the conflict, the
  uncertainty and the wait all stand after the dismissal.
- The private **`reloadableConflictOf`** (`D:1173`, `U:1441`, `M:1988`) withholds the reload under
  the uncertainty for the three reload steps; `reloadTheDiskVersion` (`D:1232`, `U:1500`, `M:2047`)
  clears the four fields when it closes the session.

### 1.5 The `exact` subject and anchor lookup through `reapply.ts` (entries 19, 20, 22)

- **Nothing in `reapply.ts` was widened.** `correspondenceRowFor(table, base)`,
  `subjectResolution` and 2d-6-3's `anchorResolution` were enough for all three surfaces; the
  module's header and `beginReapply`'s doc were corrected for the migration (§1.7).
- **`reapplyToDiskVersion(session, adopt, standing = null, current = null)`** (`D:1711`),
  **`reapplyToDiskVersion(session, unsavedDraftInDocument, adopt, standing = null, current = null)`**
  (`U:1977`) and **`reapplyToDiskVersion(session, unsavedDraftFor, adopt, standing = null, current =
  null)`** (`M:2667`) refuse `writeOutcomeUnknown` and `observationRetained` **before** entering
  `enterReapply` — so a blocked session reads no evidence (§7 finding 4) — and then enter with the
  private `unaskedGuard` (`D:1574`, `U:1843`, `M:2467`) when no guard is handed in, exactly as the
  editor and the creator do (§2 item 4). Each resolves its subject through a private
  **`subjectOfEvidence(evidence, base)`** (`D:1598`, `U:1868`, `M:2494`) — save evidence through
  `subjectCorrespondence` as before; an external table through `correspondenceRowFor(table,
  session.match)` by the subject's **full** base identity and the found row's **`exact`** tier
  through `subjectResolution`, read once, the flexible `editor` tier never looked at; a refused table
  or row through the new **`externalEvidence`** obstacle arm with `tExternalEvidenceRefusal`'s
  sentence; superseded evidence through **`supersededEvidence`** with `tSupersededEvidence`'s (entry
  22). Zero rows and two rows both refuse (`noRowForBase`, `severalRowsForBase`); a row about the same
  node of another revision, of another file, or at the subject's array position naming another node
  finds nothing (entry 20 — pinned on all three).
- **The mover additionally resolves the anchor of an `after` placement from the same table**, through
  the private **`anchorOfEvidence(evidence, anchor)`** (`M:2550`): save evidence through
  `anchorCorrespondence` as before; an external table through `correspondenceRowFor(table,
  placement.anchor)` by the anchor's full base identity and the row's `exact` tier through
  `anchorResolution` (entry 20 — "an anchored … move by the anchor's `exact` from the same table").
  The private `rebuiltPlacement` (`M:2769`) now takes the non-superseded evidence (the private type
  alias `UsableEvidence`, `M:2453`); a `top` or `end` asks the table nothing about an anchor, as it
  asks a refused save's anchor nothing; superseded evidence refuses before the subject is read,
  whatever the placement.
- **The same-sequence check is asked of both over the disk version** (D2r): the identified subject's
  `sequenceOf` must equal the session's (`notTheSameSequence`, as before, now reached from the external
  origin too), and the identified anchor must be one of the rebuilt session's own anchors on the disk
  revision (`anchorNotInSequence`, which also covers the self-anchor exclusion). Both are existing
  obstacles with existing sentences. **R25 stays visible in what a reapply hands back**: a session
  whose ordinary `beginMove` produces one move and nothing else, pinned against the live identity.
- **Immediately before the adoption, after every read of caller data, each reapply reads the
  installed session once through `current` and asks it three things** (§7 finding 3):
  `uncertaintyUnresolved` → `writeOutcomeUnknown`; a wait for its own file → `observationRetained`;
  `conflictOf(installed)?.source !== entry.conflict.source` → `supersededEvidence`. Nothing
  caller-controlled runs between that read and `adoptForReapply`. Every rebuilt session then carries
  the **installed** session's `awaitingReconciliation` forward — the deleter's and duplicator's by
  spreading it over `startMatchDeletion` / `startMatchDuplication`'s fresh session, the mover's over
  the chosen placement — and resets `externalConflict` and `uncertaintyUnresolved`, `rebuiltOver`'s
  rule with the same honesty note: the session's own file's entry is `null` on every path the module
  takes, because the recheck comes first, and the map is carried so a wait about another file
  survives the rebuild (pinned on all three, including through the recheck).
- **`DeletionReapplyObstacle`** (`D:1459`), **`DuplicationReapplyObstacle`** (`U:1724`) and
  **`MoveReapplyObstacle`** (`M:2276`) each gained `externalEvidence`, `supersededEvidence`,
  `writeOutcomeUnknown` and `observationRetained`; `deletionReapplyObstacleKey` (`D:1540`),
  `duplicationReapplyObstacleKey` (`U:1807`) and `moveReapplyObstacleKey` (`M:2416`) map them to
  existing keys, now each with a `never` terminus; `describeDeletionReapplyObstacle` (`I:1713`),
  `describeDuplicationReapplyObstacle` (`I:1759`) and `describeMoveReapplyObstacle` (`I:1809`) grew
  the arms and a `never` terminus each. The mover's `evidenceNotAnAnchor` doc now names the
  external-origin way of reaching it (an anchor row whose `exact` tier is empty). Zero dictionary
  keys added.

### 1.6 The reader on every door, every settling transition and every reapply (pattern (a) of the hand-off, taken)

**`ReadTheInstalledSession = () => Session`**, one per module (`D:784`, `U:1029`, `M:1523`), is
2d-6-3's `ReadTheInstalledForm` for the three operation sessions, and it is taken — not left, as
the first landing of this record argued. That argument (*none of the three modules composes a send,
so the reader has nothing to read for*) was false for the doors and the reapplies and incomplete for
the settling transitions, and the review's three blockers are the three places it was wrong (§7):
a door's `projected`, a reapply's table rows and disk projection, and a settlement's replayed
observations are all caller data read through property access, and a property read runs arbitrary
code — a getter there can tell the window of a reading, and the window's registered receiver
replaces the *installed* session behind the transition's back. So:

- `confirmDelete`, `beginDuplicate` and `beginMove` take `current`, read it **once after the last
  `projected` read**, and spend only when the installed session is still the one handed in
  (`installed !== session` → `null`) and passes the block;
- the three `reapplyToDiskVersion` take `current`, read it **once immediately before
  `adoptForReapply`**, and refuse `writeOutcomeUnknown` / `observationRetained` /
  `supersededEvidence` when the installed session now carries the block or another conflict; the
  rebuilt session carries the installed session's waits;
- `applyDeletion`, `applyDuplication`, `applyMove` and the three `*CouldNotBeSent` take `current`
  and, after their own replay, read it and replay whatever the receiver appended to the installed
  session — still `saving` — during that replay, in arrival order, round after round until a read
  finds nothing new. Decision order is kept: the deliveries held during the write first, those
  decided during the settlement after. With a reader, settling a session captured before the
  `await` is safe too, because the installed session's appended list is what is replayed.

**Optional, and the docs say what that costs.** The three components call every one of these with
no reader and register no receiver, so today nothing is displaced and nothing is lost; a caller that
registers a receiver and passes no reader gets exactly the displaced check and the lost delivery the
review reproduced. 2d-6-6 must pass `() => session` at every one of these calls and may make the
parameter required. Nothing in TypeScript forces a caller to pass one, or to pass an honest one.

### 1.7 Sentences corrected (entry 41), in the files this diff touches and four it touches for that alone

| File | Sentence falsified | Correction |
|---|---|---|
| `reapply.ts`, module header (§1 and §2) and `beginReapply` | "the raw editor, the deleter, the mover and the duplicator still enter here … (2d-6-4, 2d-6-5)"; `anchorResolution` "for the creator's `after` placement" | the deleter, mover and duplicator enter through `enterReapply` since 2d-6-4; the raw editor alone still enters `beginReapply` (2d-6-5); `anchorResolution` serves the mover's `after` too, from the same table as the subject's row |
| `conflictSource.ts`, `ObservationVerdict` header | "the deleter's, mover's, duplicator's, raw editor's and restore's are 2d-6-4 and 2d-6-5's" | the three receivers named; the raw editor's and restore's are 2d-6-5's |
| `observationDelivery.ts`, module header and `ExternalConflictNotice` | the same sentence; "no component reads any of those fields" listed two views | the three receivers and the three views named; still no component |
| `saveOutcome.ts`, `ExternalConflictModel` header | the same sentence | the three producers' callers named; the panel is 2d-6-6's and 2d-6-7's |
| `matchDeletion.ts`, `MatchDeletionSession.reload` (and `U`, `M`) | "Reset to `idle` by every new outcome and by every dismissal" | and by every replacing verdict |
| `matchDeletion.ts`, `canRequestDelete` | "Four reasons it may not" | five, the held reading named; both doors ask it |
| `matchMove.ts`, `canChoose` | "Five reasons they may not: … a conflict is on screen" | a conflict of either origin; a held observation deliberately not among them |
| `matchDeletion.ts`, `DeletionReapplyObstacle` (and `U`, `M`) | "There is no key function for these yet, and that is 2c-4b-2's boundary" | the key function and the accessor named |
| `reapplyCodes.test.ts`, `EDITOR_OBSTACLES` | "Every arm of the match editor's union, exhaustively" listed four of eight arms (false since 2d-6-2) | the four external-origin arms added; the three operation tables grew the same four |

**Left alone, deliberately**: `saveOutcome.ts` / `index.ts`'s "Nine codes" (1a §5 item 2); "Today
every registered transition is a no-op" in `observationTransitions.ts` and `writeSurfaceRegistry.ts`
(still true); `workspace.svelte.ts`'s `ObservationReceiver` doc, which names the editor's receiver
without claiming it is the only one; `reapplyCodes.test.ts`'s header "Nothing renders these yet",
which is about the 2c-4b-1 accessors and predates the panels.

## 2. Rulings taken here, and what each does not force

1. **The submission block on the deleter is `canRequestDelete`, asked by both doors, with no code of
   its own.** The deleter's `DeletionRefusal` is about the snippet, not the control, and inventing a
   control-side code union for one surface would have meant either a new sentence or a code
   rendering another surface's; the editor's `beginSave` sets the precedent that a bare refusal is
   explained by the view's `externalMessages` / `externalNotices`. What this forces: `requestDelete`
   answers the same session and `confirmDelete` answers `null` under all three blocks. What it does
   not: that a renderer draws the two view fields beside the disabled control — 2d-6-7's, stated on
   `MatchDeletionView.canDelete`.
2. **The file-keyed map on a session that cannot change its file** (pattern (b), taken). Through the
   three modules' own transitions the map holds at most one entry, the session's own file's, because
   a `retained` about another file records nothing; what the map forces is that a wait is always
   keyed by the file it is about and that only the session's file's wait blocks, and what it claims
   beyond that is nothing — each field doc says the shape is the sessions' shared one since 2d-6-3's
   review, so the field reads alike on every surface, and not that the session can retarget. The
   single slot the editor keeps would have been honest too; the shared shape was preferred so
   2d-6-6's wiring meets one field type across the eight surfaces.
3. **A delivery about another file is decided by the observation's `document`, read once.** The
   editor reads none, the creator reads one; these three read one, for the creator's reason turned
   around: a session over one file told of another file's change must not raise a conflict whose
   reload adopts a file the person never named. What this forces: a mis-registered or hand-built
   delivery about another file fails safe, ending only a wait recorded for that very observation.
   What it does not: over which files 2d-6-6 registers each receiver.
4. **The standing-origin guard is optional on all three reapplies, for 2d-6-2's reason** (item 4 of
   its §4): `MatchDeleter.svelte`, `MatchDuplicator.svelte` and `MatchMover.svelte` call with two or
   three arguments and this step touches no component; a required parameter would not compile, and a
   `() => null` default would turn the components' save-origin reapply into `supersededEvidence`
   today. An omitted guard costs the typed supersession sentence and some work, never a wrong
   installation — `adoptDiskVersion`'s fourth check still refuses at the door, pinned in all three
   suites. 2d-6-6, which hands the live closure down, may make the parameter required.
5. **The reader-parameter pattern (a) is taken, on every door, every settling transition and every
   reapply** (§1.6, §7). It was left at the first landing on the ground that no send composition
   exists here; the review showed the doors and the reapplies read caller data of their own, and
   the settlements' replays do too. The reader is read once, after the last caller-controlled read
   and immediately before the spend, on all three shapes.
6. **The two new refusal codes sit where the save conflict sits in the weakest-claim order** on the
   mover and the duplicator: the external conflict first (in `conflictOf`'s precedence), then the
   save conflict, then the held reading, all after `mayHaveWritten`, `alreadyMoved` /
   `alreadyDuplicated` and `saveInFlight` and before `outOfDate`. Each is a claim about what stands
   over the file rather than about the session, and the uncertain send's disclaimer still outranks
   them — pinned as *ranks the external conflict where the save conflict sits, and the uncertain
   send above it* on both surfaces.
7. **A held reading does not freeze the mover's destination controls.** `canChoose` refuses under a
   conflict of either origin and not under a wait, for the creator's reason: a wait is a restriction
   on sending, and freezing controls for a window decision that has not been made would claim more
   than the fact supports. A choice made while waiting carries the wait (pinned).
8. **The mover's chosen destination is retained on a replacing verdict, not reset.** Entry 12 names
   "pending operation … confirmations", and a move has none; the destination is the retained draft
   the conflict carries, exactly as it is under a save conflict, and the reapply is what decides
   whether the disk still has a place for it. Resetting it would have discarded the one thing the
   person chose.
9. **The mover's `UsableEvidence` alias and the superseded check before the subject.** The subject's
   and the anchor's lookups both read the same non-superseded evidence, so the supersession answer is
   taken once, before either is read, and the two private readers share one narrowing rather than
   each repeating the exclusion. The deleter and the duplicator, which read only the subject, keep
   the editor's shape and answer `superseded` inside `subjectOfEvidence`.
10. **Item 12 of 2d-6-2 (`adoptDiskVersion` has no write-in-flight guard) — answered as the editor
    and the creator answered it.** All three reapplies refuse under a held reading before any
    evidence is read, so no rebuilt session can drop the block and no adoption is obtained behind
    another surface's write; the reload is not withheld for a held reading, for the editor's stated
    reason — it closes the session and sends nothing. The door's own guard stays a `BrowserState`
    question for the step that next changes `adoptDiskVersion`.
11. **Item 3 of 2d-6-2 (the `superseded` origin a `supersedes` verdict names is not compared with
    the shown conflict's) — left as it is**, on all three receivers, for 2d-6-2's reason: the
    envelope is the window's one decision about the file, and a session that re-checked it would be
    arbitrating (entry 11). Stated on all three `apply*Observation` docs.

## 3. The acceptance clauses, pinned

*Stale full identities*: `matchDeletion.test.ts` / `matchDuplication.test.ts` / `matchMove.test.ts`
*refuses the subject: a refused tier, an empty tier, a stale full identity, …* — a row about the same
node of another revision, about the same node of another file, and at the subject's array position
naming another node each answer `externalEvidence noRowForBase`; the mover's *refuses the anchor …*
does the same for a missing anchor row. *Ambiguous correspondence*: *… and several rows* on all three
(`severalRowsForBase`), for the subject and, on the mover, for the anchor. *Same-sequence checks*:
`matchMove.test.ts` *keeps the same-sequence rule over the disk version for the subject and the anchor
(D2r), adopting nothing* — the subject's twin addressed in a second sequence of the same file refuses
`notTheSameSequence`, the anchor's twin there refuses `anchorNotInSequence`, and an `end` over that
parse is lowered within the subject's own two-snippet sequence; plus *refuses the anchor … a stranger,
and the moved snippet itself*. *Direct calls under an external conflict, a retained delivery and
unresolved uncertainty*: `confirmDelete` — *raises over the file, withdraws the pending question, and
refuses both doors*, *answers null from confirmDelete called directly under an external conflict,
refusal path included*, *records a wait as a restriction on asking and answering …*, *withholds the
reload and the reapply on raisedWithoutReload …*; `refusalGiven` on both modules through
`moveSubmissionRefusal` / `duplicationSubmissionRefusal` and `beginMove` / `beginDuplicate` —
*raises over the file, refuses the send with a code of its own …*, *answers null from beginMove /
beginDuplicate called directly under an external conflict, refusal path included*, *records a wait as
a restriction on sending …*, the two *raisedWithoutReload* cases. *The replay queue*: *holds every
delivery during its own deletion/duplicate/move and replays them in arrival order (entry 5)*
(`['retained', 'raised', 'coalesced']`, then the settlement's `raisedWithoutReload` through
`*CouldNotBeSent`), and through the real window *settles a deletion against the session its receiver
updated during the flight, replaying the held decisions in order*. *Withdrawal of a pending
confirmation by a replacing verdict and its preservation by `coalesced`*: `matchDeletion.test.ts`
*withdraws a pending question on every replacing verdict, and keeps it on coalesced and notLater*,
and through the window *raises over the deleter's file …, withdraws the question, …*. *Ruling 9*: *lets
the dismissal cancel the warning and the panel, and nothing external (entry 9)* on all three.
*Envelopes through the real door*: the nested suite *the deleter's, mover's and duplicator's external
sessions — Phase 2d-6-4* (`workspace.test.ts:10909`) — the deleter raised, withdrawn, refused and
resolved through `adoptDiskVersion`; the deleter settled against the installed session; the mover
reapplied over the observation's table by full identity for the subject and the anchor through the
live guard and the real door, moving the window once; the duplicator told `retained` through the
barrier, blocked, then the settlement's verdict, and a `writtenHere` lifting the wait. *The review's four findings*: each module's suite *the door(s), the settlement and the reapply
against the installed session (the review's three blockers)* — *refuses a confirmation / a duplicate
/ a move when the projection read displaced the installed session*, *settles against the installed
session and replays a delivery that arrived during its own replay*, *rechecks the installed session
immediately before adopting, and refuses a wait or a supersession that arrived during the evidence
reads* (the mover's at both rows), *reads no evidence for a session that is already blocked* — and
through the real window, *refuses a confirmation whose projection read let the window displace the
installed session*, *replays a delivery the window made during the settlement replay, against the
installed session*, and *refuses to adopt when a reading the window held arrived during the
reapply's evidence reads*. **The command spy**: every `workspace.test.ts` case asserts `invoked` at
zero and the file's `afterEach` re-asserts it, with every write lease released; the cases
additionally assert `deleteMatch`, `moveMatch` and `duplicateMatch` were never called.

## 4. Open items deliberately left, none a defect of this phase

1. **No component draws the new fields or the new codes' context.** `MatchDeleter.svelte` draws a
   disabled control with no sentence under an external block, because the deleter has no
   control-side code; `MatchMover.svelte` and `MatchDuplicator.svelte` render the two new codes'
   sentences through the existing accessor but draw neither `externalMessages` nor `externalNotices`
   nor the external conflict's own panel outside the save-outcome branch (entry 10). All of it is
   2d-6-7's, by scope.
2. **No component registers any of the three receivers**, and over which files each is registered is
   2d-6-6's; the model handles a delivery about another file by failing safe (§2 item 3) and cannot
   see a wait it was not told of (stated on all three `awaitingReconciliation` fields).
3. **No `removed`-status transition** for any of the three (the record's §6 item 12), as for the
   editor, the creator and the recovery form.
4. **The reader is optional and no component passes one** (§1.6). Until 2d-6-6 passes
   `() => session` at every door, settling transition and reapply of the three components, the
   three components' calls check the block on the session they hand in and replay only what it
   holds — honest today, because they register no receiver, and the first thing 2d-6-6's wiring
   must change. The editor's, the creator's and the recovery form's reapplies enter `enterReapply`
   before their two blocks and recheck nothing before adopting (the shape this fix round corrected
   on the three operation sessions); not this phase's files, recorded for the orchestrator to place.
5. **2d-6-2's open items 1, 2, 5, 6 and 7 apply to all three sessions unchanged**: a hold the
   window ends without a delivery is unseen; a reading the barrier coalesced away is never announced;
   a save conflict under the hold offers the reload; `heldDeliveries` vouches for arrival order, not
   decision order.
6. **No new Spanish**, because no key was added; the codes and arms render existing sentences whose
   Spanish is 1a's and 2d-6-2's implementer drafts, still awaiting ruling 40's bilingual review
   (2d-6-11's).
7. **`ExternalConflictAction` still has one arm**; no i18n key was added anywhere in this phase.
8. **The three modules' `awaitedFor` / `withWait` / `withoutWait` are the fourth and fifth copies** of
   helpers the creator and the recovery form already hold privately. A shared home was not made
   because the shape is three lines each and a module for it would move the Vite module count; 2d-6-5
   adds two more callers and may decide otherwise.

## 5. Verification

Run from the repository root on the final tree, each gate on its own, each exit read directly:

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **447 files, 0 errors, 0 warnings** (unchanged — no new file) |
| `npm test` | 0 | **2669 → 2754 passed, 64 → 64 files** (+85; 2739 at the first landing, +15 from §7's cases) |
| `npx vitest run src/lib/browser/matchDeletion.test.ts` | 0 | **39 → 64** (+25: the suite *the external session — Phase 2d-6-4*, `matchDeletion.test.ts:822` — 5 seven-arms, 2 held observation, 4 collisions, 2 uncertainty, 8 reapply, and 4 from §7 at `:1572`) |
| `npx vitest run src/lib/browser/matchDuplication.test.ts` | 0 | **51 → 76** (+25: the suite at `matchDuplication.test.ts:1220` — 5, 2, 4, 2, 8, and 4 from §7 at `:1923`; the submission-refusal sentence list grew by two entries without adding a case) |
| `npx vitest run src/lib/browser/matchMove.test.ts` | 0 | **78 → 106** (+28: the suite at `matchMove.test.ts:1808` — 5, 2, 4, 2, 11 reapply, the same-sequence case among them, and 4 from §7 at `:2710`; the refusal list grew by two entries without adding a case) |
| `npx vitest run src/lib/browser/workspace.test.ts` | 0 | **303 → 310** (+7, the nested suite at `workspace.test.ts:10910`; three of those from §7) |
| `npx vitest run src/lib/i18n/reapplyCodes.test.ts` | 0 | **20 → 20**; the three operation tables grew by four arms each and the editor's by the four it lacked, without adding a case |
| `scripts/lint/ipc-detail.test.ts` | — | **141 → 141**: no new file under `src/` |
| `npm run build` | 0 | **192 modules transformed**; no new module |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | server-only markers absent |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | prints `2` — client-only present |
| Cargo | not run | no path under `src-tauri/` or `crates/` changed beyond the instrument |

Per-file *before* figures are the JSON reporter's on the pre-change tree, run alone before the first
edit; 25 + 25 + 28 + 7 = 85 = 2754 − 2669 (70 at the first landing, 85 after §7's fifteen cases).
The build and the bundle oracle were re-run on the final tree with the same figures.

**Each new behaviour was confirmed to fail against a mutated rule**, the module restored
byte-identical afterwards (`diff` against a copy taken first, empty): dropping `pending: null` from
the deleter's `replacedBy` failed four cases across two files (three model, one through the window);
dropping the held-reading term from `canRequestDelete` failed two; reading the anchor row's `editor`
tier instead of `exact` in the mover's `anchorOfEvidence` failed seven across two files (the rows'
editor tiers are refusals for exactly this); comparing only the file instead of the sequence over the
disk version in the mover's reapply failed two, one of them 2c-4b-2's own; treating every file's
delivery as about the duplicator failed one. The four new fields, the new transitions, the widened
accessors and the new arms did not exist before, so every case naming one failed to compile against
the pre-change tree.

Only `git status`, `git diff` and `git diff --stat` were run. The four instrument paths are untouched
(`git diff --stat -- src-tauri/src/main.rs src/main.ts` reads `5 insertions(+), 1 deletion(-)`); no file
under `src/lib/components/`, `src-tauri/` or `crates/` changed; no key was added to
`src/lib/i18n/{en,es}.json`; `PROGRESS.md` and `PROGRESS.json` were not edited.

## 6. Where it is thin

1. **The deleter's external block reaches the screen as a disabled control with no sentence** until
   2d-6-7 draws `externalMessages` and `externalNotices` (§4 item 1). The model carries both; nothing
   forces a renderer to draw them, which is the class `CLAUDE.md` §6 names and the reason they are
   view fields rather than a rule in markup.
2. **The withdrawal of a pending question is pinned on the deleter only**, because only the deleter
   asks one; the preservation by `coalesced` is pinned by object identity (`toBe`), which is the
   strongest claim a model test can make and still says nothing about a hand-built session that
   carries both a question and a conflict.
3. **The same-sequence check over a disk version is exercised with a second `document_index`**
   (`matchListPath(0, 1)`), which is the one way today's fixtures can put a snippet of one file in
   another sequence; a projection that exposes a second list under another key would exercise the
   same comparison through `segments`, which `sameSequence` compares and this phase did not add a
   case for.
4. **No mounted evidence** (components: none). The receivers are registered by no component, the
   ordering of a delivery against a component's own `await deleteMatch(...)` is 2d-6-6's mounted
   test, and the new view fields are read by nothing that draws.
5. **The settlement's replay rounds are bounded only by the caller.** A getter that tells the window
   of a *fresh* reading on every read never lets a round find nothing new, exactly as such a
   receiver never lets the window's own drain come to rest (`registerObservationReceiver`'s doc);
   one that re-tells a reading already decided does, because the window hands each decision out
   once. Stated on all three `consumingHeldDeliveries`; no fixed round limit was added, because a
   limit would drop a real delivery to stop a hostile getter.
6. **The `about` decision reads `observation.document`**, which is one more caller-controlled read
   than the editor makes; it is taken once, first, beside the envelope's two fields, and a getter
   behind it can answer one file to this decision and another to a later reader — the same limit
   `correspondenceRowFor` states about a row's `base`, and stated on all three receivers.

## 7. The review's four findings, re-derived and fixed

**Codex adversarial review, ship-with-fixes: 3 BLOCKERS, 1 SHOULD-FIX**
([`docs/reviews/phase-2d-6-4.md`](../reviews/phase-2d-6-4.md)). All four are one class — a
caller-controlled getter delivering an observation between a check and a spend (`CLAUDE.md` §6: *a
check and a spend separated by any property read are not atomic*). Each was re-derived against the
pre-fix tree by writing the failing case first — through the real door, with a receiver that
reinstalls the session, wherever the interleaving is a re-entrant delivery — and reading its failure;
all four held, on all three sessions. The reviewer records that it checked and did **not** uphold
pre-await session capture in the current components, stale or ambiguous correspondence acceptance,
subject/anchor table switching, or a cross-sequence acceptance; those paths were left alone. No
re-review follows this fix (`CLAUDE.md` §7).

1. **[BLOCKER] `confirmDelete` (and `beginMove`, `beginDuplicate`) — the block was checked on the
   session handed in after `projected` had been read, and a getter behind `projected.document` that
   told the window of a reading had already let the receiver replace the installed session. Held,
   on all three doors.** **Cases:** *refuses a confirmation / a duplicate / a move when the projection
   read displaced the installed session* (each module suite), and through the window *refuses a
   confirmation whose projection read let the window displace the installed session*
   (`workspace.test.ts:11220` — a real `observeExternalChange` from the getter, the deleter's
   registered receiver installing the conflict). **Pre-fix failure, verbatim** (model and window
   alike): `AssertionError: expected { session: { …(17) }, …(2) } to be null` (the deleter;
   `…(20)` on the duplicator, `…(22) }, …(3)` on the mover). **Fix:** `ReadTheInstalledSession`
   (`D:784`, `U:1029`, `M:1523`) and an optional fourth/third parameter `current` on the three doors,
   read **once after the last `projected` read**; `installed !== session` refuses (`null`) before the
   block is asked. A reader answering a session that carries a block is refused by the block on
   the same line; a reader answering the session handed in spends as before. `requestDelete` takes
   no reader, and says why (§1.2).
2. **[BLOCKER] `consumingHeldDeliveries` on all six settling transitions — replaying `retained(A),
   raised(A)` read A's `document`, a getter there told the window of a strictly later B, the window
   delivered `supersedes(B)` at once to the installed session (still `saving`, so the receiver
   appended it), and the transition's returned session then overwrote that append. Held, on all
   three sessions and both settling shapes.** The sealed envelope carries a getter: the window
   freezes the envelope and not the observation inside it, and `observeExternalChange` takes the
   caller's object as it is — the path the reviewer used, and the one the cases use. **Cases:**
   *settles against the installed session and replays a delivery that arrived during its own replay*
   (each module suite — `apply*` and `*CouldNotBeSent`, and the documented cost with no reader) and
   through the window *replays a delivery the window made during the settlement replay, against the
   installed session* (`workspace.test.ts:11249`). **Pre-fix failure, verbatim, all files:**
   `AssertionError: expected { kind: 'externalChange', …(1) } to be { kind: 'externalChange', …(1) }
   // Object.is equality` (the settled session showed A's source; B's stood at the window). **Fix,
   decided deliberately:** the ingress-copy alternative (1c's `ownedScalarOf()` shape) is not
   available here, because the replay's producer of the external model reads the observation's
   fields itself and the model's origin is memoized on the observation object's identity — a copy
   would be a different observation, one the window never registered and `adoptDiskVersion` would
   refuse. So the settling transitions take `current` and `consumingHeldDeliveries` (`D:1046`,
   `U:1291`, `M:1822`) replays in rounds: its own list first, then whatever the installed session's
   list holds beyond it, in arrival order, until a read finds nothing new; `extendsTheReplayed`
   (`D:1009`, `U:1264`, `M:1795`) checks by identity that the installed list is the replayed one with
   more appended, and any other list is left alone. Decision order is kept (the write's deliveries,
   then the settlement's). Without a reader the transition settles what it was handed, as before,
   and the case pins that as the cost.
3. **[BLOCKER] the three `reapplyToDiskVersion` — with A standing, a getter behind a row's `exact`
   started another surface's write and told the window of B; the barrier held it and delivered
   `retained(B)` to the installed session; the reapply went on with the session it was handed and
   adopted, handing back a rebuilt session with no wait. Held, on all three, at the subject's row
   and (on the mover) the anchor's.** **Cases:** *rechecks the installed session immediately before
   adopting, and refuses a wait or a supersession that arrived during the evidence reads* (each
   module suite — `retained`, `supersedes` and `raisedWithoutReload` delivered from the row's
   getter; a delivery about another file adopts and carries the installed waits) and through the
   window *refuses to adopt when a reading the window held arrived during the reapply's evidence
   reads* (`workspace.test.ts:11321` — the anchor row's getter starts a held raw save and publishes
   B through `observeExternalChange`, answered `retained`). **Pre-fix failure, verbatim, all files:**
   `AssertionError: expected { kind: 'reapplied', …(1) } to deeply equal { kind: 'manualResolution',
   …(1) }`. **Fix:** a fourth/fifth optional parameter `current`, read **once after the last read of
   caller data and immediately before `adoptForReapply`**; the installed session's
   `uncertaintyUnresolved` refuses `writeOutcomeUnknown`, its own file's wait refuses
   `observationRetained`, and `conflictOf(installed)?.source !== entry.conflict.source` refuses
   `supersededEvidence` — the *asked once and last* shape of 2d-5-5b's and 2d-6-2's standing guard,
   for the session's own state. The rebuilt session carries the installed session's waits.
4. **[SHOULD-FIX] the record's §1.5 said the two blocks came before any evidence was read; each
   implementation entered `enterReapply` — which reads the observation's table — first. Held.**
   **Cases:** *reads no evidence for a session that is already blocked* (each module suite — an
   observation whose `correspondences` getter counts, asserted at zero for a held and for an
   uncertain session, and at one for an unblocked one). **Pre-fix failure, verbatim, all files:**
   `AssertionError: expected 2 to be +0 // Object.is equality`. **Fix:** the two checks moved ahead of
   `enterReapply` on all three surfaces, asked only when a conflict is shown so a session with no
   conflict still answers `notAttempted`; §1.2 and §1.5 of this record now say what the code does.

Both gates were re-run on the final tree after the fix round: `npm run check` 447 files, 0 errors,
0 warnings; `npm test` 2739 → 2754, 64 files; `npm run build` 192 modules; the two bundle oracles
as in §5; `git diff --stat -- src-tauri/src/main.rs src/main.ts` still `5 insertions(+), 1
deletion(-)`; no component, Rust file or dictionary changed. The pre-fix confirmation of the three
window cases was made by putting the first landing's copies of `matchDeletion.ts` and `matchMove.ts`
back for one run and restoring the fixed files, `diff` empty afterwards.
