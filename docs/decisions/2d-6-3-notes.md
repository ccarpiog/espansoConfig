# Phase 2d-6-3 — creation and recovery external sessions

**Status: implemented, reviewed (§6), the review's two blockers re-derived and fixed, gates
green.** Risk class:
**medium** — four new fields and two new transitions on each of two immutable session values, both
reapplies re-entered through 2d-6-2's generalized entry, one primitive added to `reapply.ts`, two
refusal codes and five obstacle arms per surface that reuse existing sentences, and one value per
surface for the eighth kind's assembly. **No `.svelte` file, no Rust, no new module, no new
dictionary key, no `BrowserState` member.** `git status` shows changes under `src/lib/browser/`,
`src/lib/i18n/` and this file, beside the four instrument paths already dirty and `PROGRESS.json`,
already modified when the phase began.

This is the second of the four model-only session steps and the first to consume what 2d-6-2 placed
in `src/lib/browser/reapply.ts` for it ([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, the
*2d-6-3* entry). It is bound by §3 entries **6, 7, 8, 9, 11, 12, 19, 20, 21, 22 and 25** of that
record, by §5.1 (recovery is the eighth live write surface), by 1b's seventh verdict arm, and by the
orchestrator's standing ruling that the `ReconciliationWorkspace` interface is not widened before
2d-6-6. The consult behind them is [`docs/reviews/phase-2d-6-design.md`](../reviews/phase-2d-6-design.md),
Q1, Q2, Q3 and Q5.

**One correction to the brief, stated first.** The hand-off names `src/lib/browser/restore.ts` as
the home of `RecoveryOrigin` and the recovery session; both live in **`src/lib/browser/recovery.ts`**
(`RecoveryOrigin` at `recovery.ts:899`, as the consult's own evidence line cites). `restore.ts` holds
the write-surface kinds and targets and received one doc correction here (§1.6); the restore session
itself is 2d-6-5's and was not touched.

---

## 1. What changed, per deliverable

Line numbers are of the final tree. `C` is `src/lib/browser/matchCreation.ts`, `V` is
`src/lib/browser/recovery.ts`, `R` is `src/lib/browser/reapply.ts`, `I` is `src/lib/i18n/index.ts`.

### 1.1 Conflict storage and the widened accessors (entry 6)

Both sessions gained the four fields 2d-6-2 put on the editor, seeded inert by `startMatchCreation`
and `openedRecovery`:

- **`MatchCreationSession.externalConflict: ExternalConflictModel<CreationBuffers> | null`**
  (`C:684`), **`uncertaintyUnresolved`** (`C:699`), **`awaitingReconciliation`** (`C:716`),
  **`heldDeliveries: readonly ObservationDelivery[]`** (`C:732`).
- **`RecoverySession.externalConflict`** (`V:1070`), **`uncertaintyUnresolved`** (`V:1082`),
  **`awaitingReconciliation`** (`V:1095`), **`heldDeliveries`** (`V:1109`).
- **`conflictOf(session): ConflictModel<CreationBuffers> | null`** (`C:884`) and
  **`recoveryConflictOf(session): ConflictModel<CreationBuffers> | null`** (`V:1365`), widened from
  the save arm: the external conflict first, then the outcome's conflict arm, with the precedence
  stated as a definite answer for a hand-built session and a decision about nothing for one the module
  built. `isEditable` / `isRecoveryEditable` refuse under either origin through them and needed no
  second rule. The two components that read the save arm's `expected`/`found` do so off `outcome`,
  not off these accessors, so no component changed and `svelte-check` is unchanged.
- Each view gained **`externalMessages`** (`C:2546`, `V:2984`), **`externalNotices`** (`C:2553`,
  `V:2990`), **`destinationRequired`** (`C:2564`, `V:2998`) and **`canChooseDestination`** (`C:2574`,
  `V:3004`). No component reads any of them; 2d-6-6 and 2d-6-9 do.

### 1.2 "Cannot submit" at every door (entry 8)

- **`CreationRefusal`** (`C:1242`) and **`RecoveryRefusal`** (`V:1656`) each gained
  **`externalConflict`** and **`observationRetained`**. `creationRefusal` (`C:1330`) and
  `recoveryRefusal` (`V:1715`) answer them in `conflictOf`'s precedence — external, then save, then
  the held reading — and `beginCreate` / `beginRecoveryCreate` ask those functions first, so a call
  made past a disabled control answers **`null`** (pinned in both model suites, with a refused outcome
  and consent recorded — the *Save anyway* path — as well as a clean draft).
- **`noDestination` moved ahead of both conflicts** in both refusal orders, because for a
  destination-less form told of a change the destination *is* the resolution (§2 item 1); a save
  conflict on a form with no destination is a state neither module produces, so the move changes no
  answer a save can reach. The existing *refuses while a save is in flight, and while a conflict is
  showing* cases still pass unchanged.
- **Two codes, no new sentence.** `externalConflict` renders the external origin's own first line
  (`browser.externalConflict.fileChangedWhileOpen`, through `externalConflictMessageKey`) and
  `observationRetained` the retained notice's (`externalConflictNoticeKey`), in `creationRefusalKey`
  (`C:2853`) and `recoveryRefusalKey` (`V:3418`). A code of its own rather than `conflict` because
  that code's sentence says the file changed *while this snippet was being written* — false of an
  observation no save answered (entry 41's class).
- The views withhold a refusal panel's `saveAnyway` under either external block, keeping
  `keepEditing`, exactly as the editor's view does.
- **Both reapplies are submission boundaries too** and refuse a held reading before any evidence is
  read (`observationRetained`, `C:2334`, `V:2724`), with the control withheld by the same fact
  through each module's private `effectiveCapabilitiesOf` (`C:2465`, `V:2891`).

### 1.3 The receivers as values: `applyObservation` and `applyRecoveryObservation`, seven arms (entries 4, 5, 11)

**`applyObservation(session, delivery): MatchCreationSession`** (`C:1825`) and
**`applyRecoveryObservation(session, delivery): RecoverySession`** (`V:2442`) switch over
`delivery.verdict.kind` with a `never` terminus — the editor's table, unchanged: `raised` /
`raisedWithoutReload` / `supersedes` through the private `replacedBy` (`C:1879`, `V:2493`), which
retires a save conflict's outcome and submission (entry 7) and resets `reload` (entry 12);
`coalesced` and `notLater` change nothing but a wait; `retained` records the observation; `writtenHere`
lifts the wait recorded for **that** observation, by identity, and nothing else. While `phase ===
'saving'` every envelope is appended to `heldDeliveries`, and `applyCreate` (`C:1488`),
`createCouldNotBeSent` (`C:1580`), `applyRecoveryCreate` (`V:1859`) and
`recoveryCreateCouldNotBeSent` (`V:1991`) replay the whole list first to last through the private
`consumingHeldDeliveries` (`C:1554`, `V:1943`) after their own answer. `applyCreate` and
`applyRecoveryCreate` keep entry 7 from the other side: a `saved` or `conflict` answer retires the
external conflict, a `refused` answer leaves it.

**What is these two surfaces' own is the file they are about, because it can be unknown.** Every
other session is opened *over* a file; these choose one. So both receivers decide whether a delivery
is *about* the form — every delivery while no destination is chosen, and those about the chosen file
once one is — and to decide it they read **one** property of the observation, `document`, once
(the editor reads none; stated on both functions). A delivery about another file can only end a wait
recorded for that very observation, under that file's key; a `retained` about another file records
nothing; and a `retained` never ends a wait — a re-held reading is still held. **The waits are a map
keyed by file** (`ReadonlyMap<DocumentId, ExternalConflictObservation>`) since the review (§6,
finding 2): only the chosen file's entry blocks the send, and a change of destination neither drops
nor restores an entry. §2 item 2 says why the destination-less form takes every file's delivery.

**`acknowledgeSnapshot(session, acknowledge)`** (`C:1927`) and
**`acknowledgeRecoverySnapshot(session, acknowledge)`** (`V:2538`) take the editor's exported
`AcknowledgeTheUncertainty` and behave as its `acknowledgeSnapshot` does: asked at most once and only
when there is something to end, a `refused` leaves the form unchanged, an `acknowledged` puts the reload
back at idle. The recovery form hands the window the **destination** conflict's source, never the
origin's (pinned).

### 1.4 The unknown-target behaviour: a refusal, not a choice (entry 21)

A destination-less creator (or recovery form) told of a change:

- **keeps its fields and its wildcard protection** — `chosen` stays `null`, the draft's base stays
  `''`, the two typed values are untouched, and **`creationTargetOf(session)`** (`C:2939`) /
  **`recoveryTargetOf(session)`** (`V:3159`) go on answering `{ kind: 'unknown' }`; nothing in either
  module writes `chosen` but the destination transition;
- **shows the affected file's state** — the external conflict is recorded over its own draft, and the
  view's `conflict`, `externalMessages` and `destinationRequired` say so;
- **requires an explicit destination** — `creationRefusal` answers `noDestination`; the reload and
  the reapply are withheld through `effectiveCapabilitiesOf` (choices `['keepEditing', 'copyDraft']`
  for the creator, `['keepEditing']` for the recovery form, which offers no copy), the three reload
  transitions refuse through the private `reloadableConflictOf` (`C:1669`, `V:2277`), and both
  reapplies refuse with a new obstacle arm **`destinationRequired`** before any evidence is read and
  before the door (rendered through the `noDestination` refusal's own sentence, no key added);
- **never adopts the observed file or retargets its draft silently** — the one transition open to it
  is **`chooseDestination`** (`C:1033`) / **`chooseRecoveryDestination`** (`V:1488`), gated on the new
  **`canChooseDestination`** (`C:949`) / **`canChooseRecoveryDestination`** (`V:1426`), which is
  `isEditable` widened by exactly this state (the private `requiresExplicitDestination`, `C:927`,
  `V:1405`). Naming the **affected** file keeps the conflict, rebuilt over the draft re-pointed at
  **the revision this window holds** for it — never the observed disk revision — so the form is then
  an ordinary destination conflict with the reload and the reapply offered; naming **another** file
  drops the conflict and the uncertainty, and leaves every wait exactly where it is (§6, finding 2).
  `keepDrafting` / `keepRecovering` erase none of it (entry 9).

### 1.5 Destination and anchor evidence through `reapply.ts` (entries 19, 20, 22)

- **`anchorResolution(resolution): AnchorCorrespondence`** (`R:956`) — the one primitive widened,
  `subjectResolution`'s twin: a table row's `exact` tier is a `ReapplyResolution` (four wire arms),
  not the `ReapplyPlacement` (three) a refused save's anchor is, and reading it through
  `subjectResolution` would have answered `noSubject` — *this change brings its own snippet* — for a
  position. Both empty wire arms answer `notAnchored`. `anchorCorrespondence` (`R:919`) is unchanged
  in behaviour. Pinned in `reapply.test.ts:757`, including a single read of the row's resolution.
- **`reapplyToDiskVersion(session, adopt, standing = null)`** (`C:2334`) enters through
  `enterReapply` with the private `unaskedGuard` (`C:2260`) when no guard is handed in, exactly as the
  editor does (§3 item 2). The private **`rebuiltPlacement`** (`C:2172`) now takes the four-armed
  `ReapplyEvidenceAccess`: `superseded` refuses whatever the placement; a `front` or `end` placement
  **asks the evidence nothing** — as the existing *ignores the evidence anchor entirely for a semantic
  placement* case already established for a refused save's anchor — so a refused table refuses nothing
  it asked for; an `after` goes through the private **`anchorOfEvidence`** (`C:2222`): save evidence
  through `anchorCorrespondence`, an external table through `correspondenceRowFor(table,
  placement.anchor)` by the anchor's **full** base identity and the found row's `exact` tier through
  `anchorResolution` (entry 20 — "an anchored creation … by the anchor's `exact` from the same
  table"), a refused table or row through the new **`externalEvidence`** obstacle arm with
  `tExternalEvidenceRefusal`'s sentence (entry 22). The identified anchor must still be one of the
  rebuilt destination's own (`anchorNotInDestination`, as before). **Creation stays targetless with no
  invented `MatchId`**: for the external origin no subject is looked up at all; for the save origin
  `subjectIsTargetless` is asked as before.
- **`reapplyRecoveryToDiskVersion(session, adopt, standing = null)`** (`V:2724`) enters the same
  way. A recovery create goes at the end and names no anchor, so **the external table is never
  consulted** and the recovery form has no `externalEvidence` arm: `superseded` refuses (about the
  conflict, not its table), `saveEvidence` is asked whether it is targetless as before, and the two
  remaining arms are not read. Pinned over three tables — none, one about other revisions, one naming
  a subject in every row — all rebuilt alike.
- Both reapplies refuse **before any evidence is read**, in this order: `writeOutcomeUnknown`,
  `observationRetained`, `destinationRequired`; then `supersededEvidence` / `evidenceNotATarget`;
  then `notTheDestination` (still unreachable through either module's transitions — its doc says why,
  including the destination door); then the placement, the ordinary refusal, the adoption. Every
  rebuilt session carries `awaitingReconciliation` forward and resets `externalConflict` and
  `uncertaintyUnresolved` — `rebuiltOver`'s rule, with the same honesty note: the carried value is
  `null` on every path either module takes, because the refusal comes first.
- **`CreationReapplyObstacle`** (`C:1948`) gained `destinationRequired`, `externalEvidence`,
  `supersededEvidence`, `writeOutcomeUnknown`, `observationRetained`; **`RecoveryReapplyObstacle`**
  (`V:2559`) gained the same minus `externalEvidence`. `creationReapplyObstacleKey` (`C:2086`) and
  `recoveryReapplyObstacleKey` (`V:3457`) map them to existing keys, now with a `never` terminus;
  `describeCreationReapplyObstacle` (`I:1661`) and `describeRecoveryReapplyObstacle` (`I:1894`) grew
  the arms and a `never` terminus each. Zero dictionary keys added.

### 1.6 `RecoveryOrigin.conflict` kept distinct, and the values a recovery form reports upward (entry 25, §5.1, entry 3)

- **`RecoveryOrigin.conflict`** (`V:899`) is written once, by `openedRecovery`, and read by nothing
  that adopts; a watcher observation of the destination — the origin's own file included, when the
  form writes back into it — lands in `RecoverySession.externalConflict` and never on `origin`. The
  reload and the reapply spend the destination conflict's own authorization; the acknowledgement hands
  the window the destination conflict's source. Pinned in the model (`recovery.test.ts:1966`, the
  *origin stays* suite) and through the real window (`workspace.test.ts:10429`: a cross-file recovery
  over `match/other.yml` beside a host editor over `match/base.yml` — a reading of the other file
  reaches the form and not the host, a reading of the base file reaches the host and not the form, the
  form's `origin.conflict` is `toBe` the object it was after both while the window's standing origin
  for the base file is no longer it, and the form's reload installs the other file's snapshot and
  leaves the base projection where it was; and a same-file host and form receive **one** envelope
  object).
- **The values the eighth kind is assembled from**: `recoveryTargetOf(session): WriteSurfaceTarget`
  (`V:3159`) — `unknown` while no file is chosen, the chosen file otherwise, never the origin's file by
  virtue of being the origin's — and `applyRecoveryObservation` as the receiver as a value. Adding
  `recovery` to `OpenWriteSurfaceKind`, widening `OpenWriteSurface`'s `unknown`-permitted kinds or
  registering an unknown recovery nowhere, reporting both values through `MatchEditor` and
  `MatchCreator`, and the `DetailPane` assembly are all **2d-6-6's**; `restore.ts`'s
  `OpenWriteSurfaceKind` doc now says the seven members are not a complete list and names the eighth
  (§1.7). `creationTargetOf` was added for symmetry and for the ruling-21 pin; `DetailPane` still
  builds the creator's target from the `DocumentId | null` `MatchCreator` reports.

### 1.7 Sentences corrected (entry 41), in the files this diff touches and three it touches for that alone

| File | Sentence falsified | Correction |
|---|---|---|
| `reapply.ts`, module header and `beginReapply` | "the raw editor, the four operation surfaces and the recovery form still enter here … (2d-6-3, 2d-6-4, 2d-6-5)" | the creator and the recovery form enter through `enterReapply`; the raw editor, deleter, mover and duplicator still enter here (2d-6-4, 2d-6-5); `anchorResolution` named |
| `matchCreation.ts`, `recovery.ts`, `notTheDestination` | "Unreachable while a conflict is showing, because `isEditable` is `false` then and `chooseDestination` refuses" | the destination door a destination-less form keeps open is named, with why the arm stays unreachable |
| `recovery.ts`, module header | the two adoptions resolve "the conflict a recovery create of its own ran into" | or, since 2d-6-3, one a watcher observation of the destination raised |
| `recovery.ts`, `RecoverySession.closed` | "Nine carry a guard written for that" | eleven; the two new transitions named |
| `conflictSource.ts`, `ObservationVerdict` header | "the other surfaces' are 2d-6-3, 2d-6-4 and 2d-6-5's" | the creator's and recovery form's named; the remaining five surfaces are 2d-6-4 and 2d-6-5's |
| `observationDelivery.ts`, module header and `ExternalConflictNotice` | "the other surfaces' transitions are 2d-6-3 …"; "The match editor's view answers both … and no component reads that field" | the two new receivers and the two new view fields named; still no component |
| `saveOutcome.ts`, `ExternalConflictModel` header | "the other surfaces' transitions are 2d-6-3, -4 and -5's" | the two new producers' callers named |
| `restore.ts`, `OpenWriteSurfaceKind` | "Seven kinds" read as a complete list | seven members, not a complete list; recovery is the eighth (§5.1, entry 3), added by 2d-6-6 |

**Left alone, deliberately**: `saveOutcome.ts` / `index.ts`'s "Nine codes" (1a §5 item 2); "Today
every registered transition is a no-op" in `observationTransitions.ts` and `writeSurfaceRegistry.ts`
(still true); `workspace.svelte.ts`'s `ObservationReceiver` doc, which names the editor's receiver
without claiming it is the only one.

## 2. Rulings taken here, and what each does not force

1. **Entry 21's "requires an explicit destination" is read as the resolution, so the destination
   transition is the one door open under an external conflict — and only for a form that names no
   file.** The alternative — `isEditable` false everywhere, so a destination-less form under a
   conflict could only be closed or reloaded — would have contradicted the ruling's own words, and
   ruling 9 forbids a dismissal that erases the block. What the door forces: the conflict survives
   when the person names the affected file and goes when they name another; the draft's base becomes
   the window's revision of the named file and never the observed one. What it does not force: that
   a renderer enables the destination control from `canChooseDestination` rather than `editable` —
   `MatchCreator.svelte` gates it on `editable` today and would leave such a form with no way forward;
   2d-6-6 must read the new field, and the view doc says so.
2. **A destination-less form takes every file's delivery.** `targetingSurfaceFor` in `restore.ts`
   attributes an unknown target to every creator-eligible file — its wildcard protection — so the
   model accepts what that attribution implies: a change to any of them is affected-file state it must
   show. Over which files 2d-6-6 registers such a form is that step's; the model handles more than it
   may be given. The recovery form is treated the same way for the same reason, although whether an
   unknown recovery is registered at all is also 2d-6-6's.
3. **The standing-origin guard is optional on both reapplies, for 2d-6-2's reason** (item 4 of its
   §4): `MatchCreator.svelte` and `RecoveryPanel.svelte` call with two arguments and this step touches
   no component; a required parameter would not compile, and a `() => null` default would turn the
   components' save-origin reapply into `supersededEvidence` today. An omitted guard costs the typed
   supersession sentence and some work, never a wrong installation — `adoptDiskVersion`'s fourth check
   still refuses at the door, pinned in both suites. 2d-6-6, which hands the live closure down, may make
   the parameter required.
4. **The reload is withheld for a destination-less form; for a form that names a file it is not
   withheld by a held reading.** The first because entry 21 says the form "never adopts the observed
   file" and a confirmed reload is an adoption of a file the person never named; the second for the
   editor's reason — the reload closes the form and sends nothing, and whether the window should
   refuse an adoption while another surface's write is in flight is `adoptDiskVersion`'s question
   (§3 item 12).
5. **A `front` or `end` creation asks the external table nothing, and a recovery create never
   does.** Entry 22's "refusals resolve to manual resolution with the typed sentence" is about evidence
   a surface needs; the consult's own conversion table says "non-anchored placement: the appropriate
   non-anchored value" and "creation: targetless subject; no invented subject `MatchId`". Refusing a
   non-anchored creation for a table it never consults would be a refusal about nothing, and the
   existing save-origin case already holds a refused anchor irrelevant to a semantic placement.
   Supersession is different — it is about the conflict's disk side, not its table — and refuses
   whatever the placement.
6. **`noDestination` before either conflict**, in both refusal orders (§1.2). The order is the order a
   person would fix things in, and for the unknown-target form the destination is what resolves the
   conflict.
7. **Two refusal codes reuse two existing sentences rather than reword `cannotCreate.conflict`.**
   Rewording would have lost the save origin's specificity for a sentence that has to cover both;
   the external origin's first line and the retained notice say exactly what blocks the button. No
   Spanish was written.
8. **One slot for the affected file.** A destination-less form told of two affected files shows the
   later one; the earlier file's change is protected by the command's own revision check when the
   person names it, never by the model. Stated on both `externalConflict` fields and pinned (*shows the
   later of two affected files, and still chooses neither*). A per-file map was considered and
   rejected: the wiring that decides which files an unknown form is registered over does not exist,
   and the cost of the slot is a lost notice, never a wrong byte.

## 3. Inherited items, taken or left

- **Item 12 (`adoptDiskVersion` has no write-in-flight guard) — answered as the editor answered it.**
  Both reapplies refuse under a held reading before any evidence is read, so no rebuilt session can
  drop the block and no adoption is obtained behind another surface's write; the reload for a form
  that names a file is not withheld for a held reading, for the editor's stated reason (§2 item 4);
  the destination-less form's reload is withheld for entry 21's reason, not for this one. The door's
  own guard stays a `BrowserState` question for the step that next changes `adoptDiskVersion`.
- **Item 4 (the optional guard) — taken as optional**, passed explicitly by every new caller in the
  suites (`() => state.standingConflictFor(document)` through the real window; `() =>
  conflict.source` and `() => null` in the model suites), and the omitted-guard cost pinned on both
  surfaces (§2 item 3).
- **Item 3 (the `superseded` origin a `supersedes` verdict names is not compared with the shown
  conflict's) — left as it is**, on both new receivers, for 2d-6-2's reason: the envelope is the
  window's one decision about the file, and a session that re-checked it would be arbitrating (entry
  11). Stated on both `applyObservation` docs.

## 4. Where it is thin, and open items left deliberately

1. **The destination control's gate is a renderer's rule this step could not change.**
   `MatchCreator.svelte` disables the destination `<select>` on `!view.editable`, so a
   destination-less form under an external conflict has no way forward on today's screen. The model
   carries `canChooseDestination` and `destinationRequired` for exactly this, and nothing draws either
   until 2d-6-6. Not a defect of this phase — no component may change here — and the first thing
   2d-6-6's creator wiring must read.
2. **Over which files an unknown form is registered is undecided** (§2 item 2). If 2d-6-6 registers a
   destination-less creator over every creator-eligible file, the one-slot limit of §2 item 8 is what a
   person sees when two of them change; if it registers it nowhere, the affected-file state is never
   shown and the command's revision check is the only protection. Either is honest; the record's entry
   3 ("the targeting predicate returns all surfaces over a file for delivery") points at the first.
3. **`OpenWriteSurface` cannot yet name a recovery, and cannot carry an `unknown` recovery.**
   `recoveryTargetOf` answers `unknown` for a form whose preferred destination was ineligible; the
   type admits `unknown` for `matchCreator` alone. 2d-6-6 widens the union, or maps an unknown
   recovery to no registration; the value's doc names both.
4. **2d-6-2's open items 1, 2, 5, 6 and 7 apply to both new sessions unchanged**: a hold the window
   ends without a delivery is unseen; a reading the barrier coalesced away is never announced; no
   `removed`-status transition (the record's §6 item 12 — not in this entry either, left for the
   orchestrator to place); a save conflict under the hold offers the reload; `heldDeliveries` vouches
   for arrival order, not decision order.
5. **The uncertainty's three exits are pinned as far as a model can see them**: the acknowledgement
   through `acknowledgeSnapshot` / `acknowledgeRecoverySnapshot` (through the window's two members in
   `workspace.test.ts`), and a later verdict under no uncertainty replacing the conflict. A later
   definite write of this window's own and `open()` end the hold at the window and deliver nothing
   to a session (2d-6-2 §4 item 1); neither is pinned here because neither reaches a session.
6. **No new Spanish**, because no key was added; the eight new codes and arms render existing
   sentences whose Spanish is 1a's and 2d-6-2's implementer drafts, still awaiting ruling 40's
   bilingual review (2d-6-11's).
7. **`ExternalConflictAction` still has one arm**; no i18n key was added anywhere in this phase.
8. **No mounted evidence** (components: none). The receivers are registered by no component, the
   ordering of a delivery against a form's own `await createMatch(...)` is 2d-6-6's mounted test, and
   the four new view fields per surface are read by nothing that draws.
9. **`creationTargetOf` is a second home for a mapping `DetailPane` also makes** (`creatorDestination
   === null ? unknown : document`). Until 2d-6-6 has `MatchCreator` report the value, the two agree
   by construction and nothing checks it.
10. **The recovery form's export partition grew by four**, classified in `recovery.test.ts`: two
    closed-form probes (`applyRecoveryObservation`, `acknowledgeRecoverySnapshot`) and two queries
    (`canChooseRecoveryDestination`, `recoveryTargetOf`). The probe cannot force a classification to be
    correct, as its own doc says.

## 5. Verification

Run from the repository root on the final tree, each gate on its own, each exit read directly:

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **447 files, 0 errors, 0 warnings** (unchanged — no new file) |
| `npm test` | 0 | **2618 → 2669 passed, 64 → 64 files** (+51; 2665 before the review's four cases) |
| `npx vitest run src/lib/browser/matchCreation.test.ts` | 0 | **69 → 96** (+27: the suite *the external session — Phase 2d-6-3*, `matchCreation.test.ts:1285` — 4 over a chosen destination, 4 destination-less, 4 held observation, 4 collisions, 2 uncertainty, 9 reapply; one of those from §6) |
| `npx vitest run src/lib/browser/recovery.test.ts` | 0 | **74 → 90** (+16: the suite at `recovery.test.ts:1966` — 3 origin, 2 destination-less, 7 held observation, send and collisions, 1 uncertainty, 3 reapply; two of those from §6; the export partition and closed-form probes grew by two entries each without adding a case) |
| `npx vitest run src/lib/browser/workspace.test.ts` | 0 | **296 → 303** (+7, the nested suite *the creator's and the recovery form's external sessions — Phase 2d-6-3*, `workspace.test.ts:10429`; one of those from §6) |
| `npx vitest run src/lib/browser/reapply.test.ts` | 0 | **37 → 38** (+1, `reapply.test.ts:757`) |
| `npx vitest run src/lib/i18n/reapplyCodes.test.ts` | 0 | **20 → 20**; `CREATION_OBSTACLES` grew by five arms without adding a case |
| `scripts/lint/ipc-detail.test.ts` | — | 141 → 141: no new file under `src/` |
| `npm run build` | 0 | **192 modules transformed**; no new module |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | server-only markers absent |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | prints `2` — client-only present |
| Cargo | not run | no path under `src-tauri/` or `crates/` changed beyond the instrument |

Per-file *before* figures are the JSON reporter's on the pre-change tree, run alone before the first
edit; 27 + 16 + 7 + 1 = 51 = 2669 − 2618 (47 at the first landing, 51 after §6's four cases). The
build and the bundle oracle were re-run on the final tree with the same figures.

**The acceptance clauses, pinned.** *An unknown destination*: `matchCreation.test.ts` *shows the
affected file's state, keeps its fields and its unknown target, and withholds both ways to the disk*,
*resolves through an explicit destination*, *carries the uncertainty into the affected file*, *shows the
later of two affected files*; `recovery.test.ts` *shows the affected file's state* and *drops the
conflict for a destination the observation was not about*; `workspace.test.ts` *lets a destination-less
creator be told of any file, choose neither, and require the person's explicit choice*. *Cross-file
recovery*: `recovery.test.ts` *raises the destination's conflict over a cross-file recovery and leaves
the origin untouched* and `workspace.test.ts` *delivers a cross-file recovery its destination's conflict
and leaves its origin the object it was*. *Targetless creation*: *asks the table nothing for a front or
end placement* and, for the recovery form, *re-points the form at the observed version with nothing
looked up, whichever table the reading carried*. *Anchor refusal*: *refuses the anchor: a refused tier,
an empty tier, a missing row, several rows, and a stranger*, *refuses a table about other revisions*,
*rebuilds an after from the row the anchor's full identity finds*. *Uncertainty*: the two *uncertainty*
suites and the two real-window acknowledgement cases. *A destination-less creator refuses to choose
one*: `chosen` asserted `null` and the target `unknown` after every arm, in both suites and through the
window. *`RecoveryOrigin.conflict` surviving a destination conflict unspent*: `toBe` the original
object after `raised`, `supersedes`, a reload through the real door, a reapply and an acknowledgement.
*A direct submission call under an external conflict answering `null`*: both model suites, refusal
path included. *`writtenHere` lifting only by identity*; *held deliveries replayed in arrival order*
(`['retained', 'raised', 'coalesced']`); *`awaitingReconciliation` carried through every rebuild*: the
rebuilt sessions of both reapplies asserted, and the map carried whole so a wait about another file
survives the rebuild. **The command spy**: every `workspace.test.ts` case
asserts `invoked` at zero and the file's `afterEach` re-asserts it, with every write lease released;
the recovery cases additionally assert `createMatch` was never called.

**Each new behaviour was confirmed to fail against a mutated rule**, the module restored
byte-identical afterwards (`diff` empty): dropping the `observationRetained` refusal from
`creationRefusal` failed three cases across two files; gating `chooseDestination` on `isEditable`
alone failed the four destination-less cases; making every delivery "about" the creator failed *takes
nothing from a delivery about another file*; writing the destination's conflict into
`RecoverySession.origin` in `replacedBy` failed nine cases across two files; dropping the held-reading
refusal from `reapplyRecoveryToDiskVersion` failed *refuses superseded evidence, a held reading, a form
naming no file, and the window's refusal*. The four new fields, the new transitions, the widened
accessors, `anchorResolution` and the new arms did not exist before, so every case naming one failed
to compile against the pre-change tree.

Only `git status`, `git diff` and `git diff --stat` were run. The four instrument paths are untouched
(`git diff --stat -- src-tauri/src/main.rs src/main.ts` reads `5 insertions(+), 1 deletion(-)`); no file
under `src/lib/components/`, `src-tauri/` or `crates/` changed; `PROGRESS.md` and `PROGRESS.json` were
not edited.

## 6. The review's two findings, re-derived and fixed

**Codex adversarial review, ship-with-fixes: 2 BLOCKERS, 0 SHOULD-FIX**
([`docs/reviews/phase-2d-6-3.md`](../reviews/phase-2d-6-3.md)). Each was re-derived against the pre-fix
tree by writing the failing case first and reading its failure; both held. The reviewer records that
it checked and did **not** uphold spending `RecoveryOrigin`, `writtenHere` lifting another
observation's wait, or an anchor fallback; those paths were left alone. No re-review follows this fix
(`CLAUDE.md` §7).

1. **[BLOCKER] `sendRecoveryCreate` — the send settled the form captured before its `await`, so every
   delivery a receiver applied to the installed form during the flight was discarded. Held.** The
   composition took `started.session` on both sides of the await; a component's receiver (2d-6-6's)
   would apply `applyRecoveryObservation` to the form `install` handed it, holding each envelope in
   `heldDeliveries`, and the settled form — built from the captured one — carried none of them.
   **Cases:** *settles a recovery send against the form its receiver updated during the flight*
   (`workspace.test.ts`, the new suite — a deferred `createMatch`, the barrier's `retained` and the
   settlement's `raised` delivered to a registered receiver through the real window, the create refused
   after both) and *settles a send against the form the caller holds, so deliveries applied during the
   flight survive* (`recovery.test.ts`, the *held observation, send and collisions* suite — the same
   interleaving at the model level, plus the `notAttempted`, `failed` and thrown answers, and the
   documented cost of passing no reader). **Pre-fix failure, verbatim, through the window:**
   `AssertionError: expected undefined to be { kind: 'externalChange', …(1) } // Object.is equality`
   (the settled form's `externalConflict` was `null`). **Fix:** a fourth, optional parameter
   **`current: ReadTheInstalledForm | null = null`** on `sendRecoveryCreate` (`V`, beside
   `InstallTheWaitingForm`); when supplied it is read **once, after the await**, and every answer —
   `answered`, `notAttempted`, `failed` — is settled against the form it answers, whose held deliveries
   `applyRecoveryCreate` / `recoveryCreateCouldNotBeSent` already replay in arrival order. **A `create`
   that throws is settled too**: as `recoveryCreateCouldNotBeSent(current, true, classifyFailure(raw))`
   — an unknown outcome, which is what the window's own barrier records for a wrapper that threw —
   handed to `install` a second time, since the function cannot return it, and then re-thrown so the
   caller still learns; `InstallTheWaitingForm`'s doc names that one second call. **What that does not
   force, stated on the type:** a caller may pass no reader — the parameter is optional so
   `RecoveryPanel.svelte`, which this phase may not touch and which registers no receiver today, keeps
   compiling — and such a caller loses every delivery held during the flight, which the model case
   pins as the documented cost; 2d-6-6, which registers the receiver, must pass `() => session` beside
   its installer and may make the parameter required. **The creator's send has no such shape:**
   `matchCreation.ts` holds no send composition, and `MatchCreator.svelte`'s `runCreate` settles the
   component's live `session` after its own `await` (`applyCreate(session, …)`), which a receiver would
   have updated — so nothing was changed there. What that component does not do is settle a thrown
   `create` at all (the form stays `saving`); a component fact for 2d-6-6, noted and not fixed here.
2. **[BLOCKER] `chooseDestination` / `chooseRecoveryDestination` — changing destinations permanently
   erased an unresolved wait. Held, in the reviewer's exact interleaving.** With A chosen and
   `retained(A)` recorded, choosing B dropped the wait as "about a file this form no longer writes
   into", and choosing A again restored nothing, so `beginCreate` and `beginRecoveryCreate` proceeded
   past a block the window still held. **Cases:** *keeps a wait across a change of destination, so
   returning to the file restores its block* in `matchCreation.test.ts` and `recovery.test.ts`
   (A → `retained(A)` → B → A → the door answers `null`, then `writtenHere(A)` lifts it). **Pre-fix
   failure, verbatim, both files:** `AssertionError: expected null to be 'observationRetained' //
   Object.is equality`. **Fix:** `awaitingReconciliation` on both sessions became
   **`ReadonlyMap<DocumentId, ExternalConflictObservation>`** — the waits keyed by the file each is
   about — with three private helpers per module (`awaitedFor`, `withWait`, `withoutWait`): a
   `retained` about the form sets the file's entry, any decision about the observation stored under
   its file deletes it, only the chosen file's entry (or, for a form naming no file, any entry)
   refuses the send, withholds the reapply and shows the notice, and **a change of destination neither
   drops nor restores an entry** — the form keeps what it knows, and returning to A finds A's wait
   still there. Both reload-closes clear the map; both reapplies carry it whole. The single-slot
   semantics of the first landing — and the sentence that called dropping the wait right — are gone
   from both modules' docs. **What the map forces and what it cannot, stated on both fields:** every
   wait the form was told of is kept until the delivery that decides it arrives, and only the chosen
   file's blocks; it cannot force that the deciding delivery arrives — a form whose receiver was
   unregistered from A while it was over B is never told A's decision and stays blocked over A until
   closed — nor that a wait the form was *not* told of, because it was not registered over A when the
   window held the reading, is recorded at all. Both are facts about where a form's receiver is
   registered, which is 2d-6-6's; `BrowserState.automaticReloadGuardFor(document)` answers the window's
   own state for a caller that wants to reconcile the two, and the model deliberately does not read it
   — the reviewer's alternative, restoring the destination's state from the window synchronously, is
   not something a value in `src/lib/browser/` can force. This replaces the earlier §4 item 2's
   reading of the cost: a stale block fails safe; a missing block does not.

Both fixes were confirmed against the four new cases (2665 → 2669) with the module suites and the
window suite green, the instrument untouched and no component changed.
