# Phase 2d-6-5 — raw and restore external sessions

**Status: implemented, reviewed once (`ship-with-fixes`, 2 blockers and 2 should-fix, all four
held), fixed, gates green — closed.** §7 records the fix round. Risk class:
**medium** — four new fields and two new transitions on each of the last two immutable session
values, the raw editor's reapply re-entered through 2d-6-2's generalized entry and a reapply value
added for restore (both `unavailable`), two new refusal codes on restore reusing two shared
sentences, the raw reseed and restore's retargeting reload widened to the external origin, and the
three 2d-6-4 patterns — the optional `ReadTheInstalledSession` reader on every door, every
settling transition and (since the fix round, §7 finding 3) both reloads, the settlement replay in
rounds, and on the reapplies nothing to recheck, because neither surface adopts through one.
**No `.svelte` file, no Rust, no new
module, no new dictionary key, no `BrowserState` member, no change to `reapply.ts`'s primitives.**
`git status` shows changes under `src/lib/browser/`, `src/lib/i18n/` (one test file) and this file,
beside the four instrument paths already dirty and `PROGRESS.json`, already modified when the phase
began.

This is the last of the four model-only session steps ([`2d-6-split-notes.md`](2d-6-split-notes.md)
§2, the *2d-6-5* entry). It is bound by §3 entries **6, 7, 8, 9, 11, 12, 22 and 23** of that record,
by 1b's seventh verdict arm, by the three patterns 2d-6-4's fix round handed on (`PROGRESS.md`,
*Next action*), and by the orchestrator's standing rulings: the `ReconciliationWorkspace` interface
is not widened, the acknowledgement operand stays `ConflictSource`, the `projectionReplaced` refusal
stands. **The raw `\r` refusal stands at the external origin** (`CLAUDE.md` §6, *Text on the wire
and on screen*): a reseed from a disk version holding a carriage return is refused, never
normalized.

---

## 1. What changed, per deliverable

Line numbers are of the final tree. `W` is `src/lib/browser/rawEditor.ts`, `S` is
`src/lib/browser/restore.ts`.

### 1.1 Conflict storage and the widened accessors (entry 6)

Both sessions gained the four fields the other six carry, seeded inert by `startRawEditor`
(`W:595`) and `startRestore` (`S:1726`):

- **`RawEditorSession.externalConflict: ExternalConflictModel<RoundTripText> | null`** (`W:287`),
  **`uncertaintyUnresolved`** (`W:303`), **`awaitingReconciliation: ReadonlyMap<DocumentId,
  ExternalConflictObservation>`** (`W:331`), **`heldDeliveries: readonly ObservationDelivery[]`**
  (`W:351`).
- **`RestoreSession.externalConflict: ExternalConflictModel<string> | null`** (`S:1544`),
  **`uncertaintyUnresolved`** (`S:1560`), **`awaitingReconciliation`** (`S:1594`),
  **`heldDeliveries`** (`S:1617`).
- **`conflictOf`** widened from `SaveConflictModel<T> | null` to **`ConflictModel<T> | null`** on
  both (`W:677`, `S:2220`): the external conflict first, then the outcome's conflict arm, with the
  precedence stated as a definite answer for a hand-built session and a decision about nothing for
  one the module built. `isEditable` (`W:694`) refuses under either origin through it — the raw box
  is read-only under an external conflict, which is what keeps *Copy draft* exact — and needed no
  second rule. `RawEditor.svelte` and `RestorePane.svelte` read the save arm's `expected`/`found`
  off `outcome`, not off these accessors, so no component changed and `svelte-check` is unchanged
  (447 files).
- **Every rebuild carries the four fields forward**: every transition of both modules spreads the
  session it was handed, and `loadDiskVersion` (`W:1364`) and `reloadTheDiskVersion` (`S:3751`)
  clear `externalConflict` and `uncertaintyUnresolved` on a satisfied adoption while leaving the
  waits, which are about other observations (pinned on both).
- Each view gained **`externalMessages`** (`W:1703`, `S:4237`) and **`externalNotices`** (`W:1710`,
  `S:4244`), and each view's `conflictChoices` is now produced from a private
  **`effectiveCapabilitiesOf`** (`W:1796`, `S:4312`) — the reload withheld under the uncertainty;
  the reapply is never offered by either declaration, so a held reading withholds nothing —
  through `conflictChoicesFor`, which stays the only producer. Under an external block a refusal
  panel keeps only `keepEditing`. `RawEditorView.canReload` (`W:1777`) is `false` under the
  uncertainty as well as under the carriage-return refusal. No component reads any of the new
  fields; 2d-6-8 does.
- **Restore's external model over no candidate.** `ExternalConflictModel<string>` requires a
  `Draft<string>`, and a restore told of a change before any entry was read has none. The model is
  built over the retained candidate's draft when one is retained and over **a draft of the empty
  string at the session's base revision when none is** — a placeholder the type requires and never
  a candidate, stated on `RestoreSession.externalConflict` (`S:1544`) and on the producer
  (`replacedBy`, `S:4038`): `RestoreView.preview` is the only thing a screen draws the candidate
  from, the surface offers no copy, the reload re-points the *session's* candidate and never reads
  the model's draft, and `supersedeConflict` carries it as history exactly as the save arm's is
  carried. What no type forces is a renderer reading it as the candidate; the sentence is what says
  it must not. §2 item 4 says why this shape and not a widened type. **Since the fix round (§7
  finding 4) the model over the placeholder carries the file's own line alone**: the private
  `overNoCandidate` (`S:4094`) keeps `fileChangedWhileOpen` and drops `operationKeptInMemory` and
  `reloadRetargetsCandidate`, which describe a candidate and a confirmation the session never had,
  and `RestoreView.conflictOperation` (`S:4293`) is `null` for an external conflict over no
  candidate — `replaceFileFromBackup`'s sentence names *the backup entry selected here*.

### 1.2 "Cannot submit" at every door (entry 8)

- **The raw editor's doors are `canSave` (`W:800`) and `beginSave` (`W:910`)**, the ones the
  consult's Q2 names for it. `canSave` refuses under a conflict of either origin (through
  `conflictOf`) and under a held reading of the editor's own file (the private `awaitedFor`,
  `W:627`); `beginSave` asks it and answers `null` to a call made past the withdrawn control, the
  refusal path included (a *Save anyway* pressed after consent reaches it and sends nothing).
  **`beginSave` takes the submission first, checks the carriage return on the submission's own
  candidate, asks `canSave` and builds the waiting session, and only then reads the installed
  session, once** (§7 finding 1; the first landing read the installed session between the
  carriage-return check and the rest). A held
  reading is a restriction on sending alone: the box stays editable, for the creator's reason —
  freezing the text for a decision the window has not made would claim more than the fact
  supports. No refusal code was added: the raw editor has none beside its control today, and why
  the control is off is said by the view's `externalMessages` and `externalNotices`, exactly as the
  match editor's bare `beginSave` is explained by its view.
- **Restore's doors are the preparation, the confirmation and the final permit**, all asking one
  rule. **`RestoreRefusal`** (`S:734`) gained **`externalConflict`** (`S:776`) and
  **`observationRetained`** (`S:791`); `restoreRefusal` (`S:2262`) answers them where the save
  conflict sits — after `alreadyRestored`, `readOnly` and `inFlight`, in `conflictOf`'s precedence
  (external, then save), then the held reading, then `noCandidate`, `targetMoved` and
  `writeSurfaceOpen` — so `canPrepareRestore`, `prepareRestore` (`S:2399`, answers the same
  session, or the installed one when the session handed in is no longer it — §7 finding 2) and
  `confirmRestore` (`S:2804`, answers `null`, the question unspent) refuse under both;
  and **`permitHolds`** (`S:2998`), the final permit `sendRestore` (`S:3115`) spends, refuses the
  same two restrictions **and a non-empty `heldDeliveries`**: a session in `saving` with an
  envelope held has been told of a decision about its destination it has not applied, and a send
  past it would be a send past that decision. A refused permit is consumed unspent (`withdrawn`),
  and `restoreConfirmationWithdrawn` (`S:3459`) then replays the very envelope that refused it.
- **Two codes, no new sentence**, on restore: `externalConflict` renders the external origin's own
  first line (`browser.externalConflict.fileChangedWhileOpen`, through `externalConflictMessageKey`)
  and `observationRetained` the retained notice's (`externalConflictNoticeKey`), in
  `restoreRefusalKey` (`S:850`). A code of its own rather than `conflictShowing` because that
  code's sentence says the file changed *while this replacement was being written* and this attempt
  wrote nothing — false of an observation no save answered (entry 41's class). `RestorePane.svelte`
  renders whatever code `view.refusal` carries through `tRestoreRefusal`, so the new codes reach the
  screen with no component change. `src/lib/i18n/restoreCodes.test.ts` lists the two arms (14 keys,
  from 12).
- **An unresolved write uncertainty blocks through the conflict it qualifies**: no transition in
  either module sets `uncertaintyUnresolved` without an external conflict, and each field doc says
  so rather than adding a check for a state only a hand-built session reaches.

### 1.3 The receivers as values: two `apply*Observation`, seven arms (entries 4, 5, 11)

**`applyObservation(session, delivery): RawEditorSession`** (`W:1487`) and
**`applyRestoreObservation(session, delivery): RestoreSession`** (`S:3903`) switch over
`delivery.verdict.kind` with a `never` terminus — the editor's table, unchanged: `raised` /
`raisedWithoutReload` / `supersedes` through the private `replacedBy` (`W:1540`, `S:4038`), which
retires a save conflict's outcome and submission (entry 7) and resets `reload` (entry 12);
`coalesced` and `notLater` change nothing but a wait; `retained` records the observation;
`writtenHere` lifts the wait recorded for **that** observation, by identity, and nothing else. While
`phase === 'saving'` every envelope is appended to `heldDeliveries`, and `applySave` (`W:1008`),
`saveCouldNotBeSent` (`W:1172`), `applyRestore` (`S:3253`), `restoreConfirmationWithdrawn`
(`S:3459`) and `restoreCouldNotBeSent` (`S:3502`) replay the whole list first to last through the
private `consumingHeldDeliveries` (`W:1116`, `S:3394`) after their own answer — the seal-already-
opened arm included, because the save is over either way — and, given a reader, every delivery the
receiver appended to the installed session during that replay, round after round until a read finds
none (pattern (b), `extendsTheReplayed`, `W:1075`, `S:3349`). The two `apply*` keep entry 7 from the
other side: a `saved` or `conflict` answer retires the external conflict, a `refused` answer leaves
it.

**Which deliveries are about the session is decided by the observation's file, read once**, for the
three operation sessions' reason turned sharper on the raw editor: an editor over one file told of
another file's change must not raise a conflict whose reload would *reseed its box with that other
file's text*, and a restore's reload would re-point its candidate at a file the person never named.
A delivery about another file can only end a wait recorded for that very observation, by identity,
under that file's key; a `retained` about another file records nothing. The waits are the file-keyed
map the other sessions share, with three private helpers per module (`awaitedFor`, `withWait`,
`withoutWait` — `W:627-656`, `S:1760-1789`; §4 item 8 on the copies).

**Restore's receiver honours the module's two memberships.** It cannot know whether it withdraws
until it has read the verdict's kind and the observation's file, both caller-controlled, so it
**suspends** the question across those reads exactly as `targetRevisionObserved` and `candidateRead`
do; a replacing verdict about the destination then withdraws through `withdrawn(session, 'kept')` —
its revocation deletes the suspension cell, so the `finally` puts nothing back — and every other arm
that answers a new session ends this call's own suspension first and carries the question through
`carryTheQuestion` (the private `carriedPast`, `S:4002`, and `liftedPast`, `S:3971`: two bare
`WeakMap` sequences with no user code between them), while an arm that changes nothing answers
through `unchangedByInspection`. **A wait carries the question**: it changes nothing a confirmation
binds, and the doors are what refuse until it lifts (pinned: the question presented and refused
under the wait, confirmable once `writtenHere` lifts it, the retained session authorizing nothing).
The presents/authorizes table in `restore.test.ts` gained eight rows for the receiver's arms.

**`acknowledgeSnapshot`** (`W:1585`) and **`acknowledgeRestoreSnapshot`** (`S:4118`) take the
editor's exported `AcknowledgeTheUncertainty` and behave as its `acknowledgeSnapshot` does: asked at
most once and only when there is something to end, a `refused` leaves the session unchanged, an
`acknowledged` puts the reload back at idle; restore's carries a hand-built session's question.

### 1.4 The replacing verdict's reset, the withdrawal that keeps the candidate, and the dismissal (entries 9, 12, 23)

- **The raw editor's `replacedBy` writes `reload: NOT_RELOADING`** and builds the model over the
  draft as it stands (`describeExternalConflict`) or over the shown conflict's draft
  (`supersedeConflict`); the box is about to be frozen, so that draft is exactly what *Copy draft*
  puts on the clipboard. A displayed reapply result cannot exist on this surface.
- **Restore's `replacedBy` is a withdrawal that keeps the candidate**: `withdrawn(session,
  'kept')` first — the question's authorization revoked, the confirmation and any consent gone, the
  preview generation moved, the candidate untouched — then the model, the save conflict's
  retirement and `reload: NOT_RELOADING`. The base revision does **not** move on the verdict; it
  moves on the reload (entry 23's "retarget"): `reloadTheDiskVersion` — its two parameters
  unchanged, a third optional reader added by the fix round (§7 finding 3) — now
  takes a conflict of either origin through the private `reloadableConflictOf` (`S:3637`), keeps the
  candidate, moves the base to the observation's `diskRevision`, withdraws through
  `measuredAgainst`, and clears the external conflict and its uncertainty. Pinned: the candidate's
  bytes survive the verdict, the reload and a fresh confirmation, which sends them against the
  adopted revision.
- **Consent withdrawal.** Raw: a refusal consented to stays as history under the external conflict
  with its consent — nothing can spend it, the box being frozen and the save refused — and the
  reload reseeds a clean draft with none; `acknowledgeFindings` over the reseeded session records
  nothing and a save of it, once edited, carries `EMPTY_ACKNOWLEDGEMENT` (pinned). Restore: the
  verdict itself withdraws the consent through `retargetedDraft`, so
  `submissionOf(preview.draft).acknowledgement` is empty before and after the retarget (pinned).
- **`keepEditing`** (`W:1209`) and **`dismissRestoreOutcome`** (`S:3605`) are unchanged in code and
  changed in contract (entry 9): each doc names the three fields the spread carries over, and each
  suite pins that the conflict, the uncertainty and the wait all stand after the dismissal. On the
  raw editor the dismissal does **not** give the box back under an external conflict — an external
  conflict is not a panel a dismissal resolves — and the module's *Three policy decisions* header
  now says so.
- The private **`reloadableConflictOf`** (`W:1249`, `S:3637`) withholds the reload under the
  uncertainty for the three reload steps of each module.

### 1.5 The raw reseed and the carriage-return refusal (entry 23; `CLAUDE.md` §6)

`loadDiskVersion` (`W:1364`) is the same door for both origins: it reseeds from the conflict's own
`diskText` — a save refusal's or a watcher observation's alike — and asks `roundTripText` of it
**before** anything is spent, so a disk version carrying a `\r` is refused with the window never
asked and the draft untouched; `RawEditorView.diskRefusal` and `canReload` say so. Pinned as a model
case over two CRLF lines among LF ones (the committed fixture's shape), and through the real door in
`workspace.test.ts`, where the window stays at `rev-a` with the observation standing.

### 1.6 The declared unsupported reapply (entry 22)

**`reapplyToDiskVersion(session)`** on the raw editor (`W:1652`) now enters through `enterReapply`
in `./reapply.ts` — the entry over both origins — with a private never-asked guard (`NEVER_ASKED`,
`W:1621`: the entry answers `unavailable` from the permanent `reapplySupport` before the guard could
be reached; were it asked it would answer `null`, the conservative *superseded*). The signature is
unchanged (one parameter, pinned with `toHaveLength(1)`), and the answer is `unavailable` for a save
conflict, an external conflict carrying a correspondence table, a held reading and no conflict at
all. **Restore gained the same value** (`S:4183`, with `RestoreReapply` and
`RestoreReapplyObstacle`, `S:4144-4147`, and its own `NEVER_ASKED`, `S:4156`), so 2d-6-8's renderer
meets one shape on both whole-document surfaces. `beginReapply` has no production caller left; its
doc and the module header say so (§1.8).

### 1.7 The reader on every door and every settling transition (pattern (a), taken)

**`ReadTheInstalledSession = () => Session`**, one per module (`W:848`, `S:2670`), is 2d-6-4's
reader for these two sessions, optional everywhere, its doc saying what a missing one costs and that
**2d-6-8, which registers the receivers, must pass `() => session` at every call and may make the
parameter required**:

- **`beginSave(session, current = null)`** (`W:910`) takes the submission, checks the carriage
  return on the submission's own candidate, asks `canSave`, builds the waiting session, and only
  then reads the installed session, once; it spends only when `installed === session` and both
  checks passed, and nothing caller-controlled runs between the read and the answer (§7 finding 1
  — the first landing read the installed session after the carriage-return check and before the
  other reads, so a getter quiet on the first read and delivering on a later one, or on the
  spread, ran after the check; pinned with a getter that delivers on each read the door makes,
  counted, and one on an own property the spread reads).
- **`prepareRestore(session, context, current = null)`** (`S:2399`) makes every read in the
  private `questionFor` (`S:2460`, builds and registers nothing), then reads the installed session
  once, and **every return path from there answers through it**: the installed session, unchanged,
  when it is not the one handed in — refusal or not — so a caller that installs what this returns
  installs what its receiver installed rather than the capture it took before the read; nothing is
  registered. (§7 finding 2 — the first landing's refusals after the preview, the context and the
  submission reads returned the session handed in.) A receiver replaces a session and never
  mutates one, so a session still installed carries what it carried when the block was asked
  (stated, with what that cannot force: a caller redefining a property of its own session in
  between).
- **`loadDiskVersion(session, adopt, current = null)`** (`W:1364`) and
  **`reloadTheDiskVersion(session, adopt, current = null)`** (`S:3751`) read the installed session
  **twice**: once after their own reads and immediately before the adoption — a displaced session
  is not reloaded and the installed one is answered, the window never asked — and once more after
  it, because `adoptDiskVersion` copies the observation's projection and a getter there can tell
  the window of a later reading that the receiver installs while the door is still inside
  `adopt`. A settled session showing **another conflict** (by source identity) is answered
  untouched, whatever the adoption answered; the same conflict with more recorded — a wait — is
  what the reseed, the retarget and the refused step are built over, so the record survives (§7
  finding 3). This is pattern (c) after all — the "immediately before adoption" the first landing
  said had nothing to take, which was true of the reapplies and false of the reloads.
- **`confirmRestore(session, context, current = null)`** (`S:2804`) reads the installed session
  once, after the spread and immediately before the checked deletion; `installed !== session` is
  `null`, and the question the receiver withdrew is not spent either, because the deletion finds
  the map no longer holding it.
- **`sendRestore(started, session, context, send, current = null)`** (`S:3115`) reads the installed
  session once after `permitHolds`; a permit whose session is no longer the one installed is
  consumed unspent (`withdrawn`), and the sender is never reached.
- **`applySave` / `saveCouldNotBeSent`** (`W:1008`, `W:1172`) and **`applyRestore` /
  `restoreConfirmationWithdrawn` / `restoreCouldNotBeSent`** (`S:3253`, `S:3459`, `S:3502`) replay
  in rounds through `consumingHeldDeliveries` (§1.3). Without a reader each settles what it was
  handed, and the cases pin that as the cost.
- **Pattern (c) has nothing to take on the reapplies**: neither reapply adopts, and `enterReapply`
  answers `unavailable` before it reads any evidence. A counting `correspondences` getter in
  2d-6-4's shape would count nothing, because the entry never reaches the conflict; the
  `toHaveLength(1)` pin on both surfaces is what says no adoption function exists to spend. The
  first landing of this bullet read "nothing to take here", and the review's third finding is
  where that was wrong: the two **reloads** adopt, and the bullet above is pattern (c) taken on
  them.

### 1.8 Sentences corrected (entry 41), in the files this diff touches and four it touches for that alone

| File | Sentence falsified | Correction |
|---|---|---|
| `reapply.ts`, module header §1 | "the raw editor migrates in 2d-6-5"; `beginReapply` "the one place `reapplySupport` is read" | all eight surfaces enter `enterReapply` since 2d-6-5; `beginReapply` has no production caller left and is kept as the save-only predecessor, driven by `reapply.test.ts` alone |
| `reapply.ts`, `ReapplyStart.unavailable` | "The raw editor, and only it." | the raw editor and restore |
| `reapply.ts`, `beginReapply` | "The raw editor still enters here, and migrating it is 2d-6-5's" | no production transition enters here any more; the raw editor and restore enter `enterReapply` |
| `reapply.ts`, module header on `adoptForReapply` | "the raw editor's having no adoption function at all" | the raw editor's and restore's |
| `conflictSource.ts`, `ObservationVerdict` header | "the raw editor's and restore's are 2d-6-5's" | the two receivers named; all eight exist as values; registration is 2d-6-6's and 2d-6-8's |
| `observationDelivery.ts`, module header and `ExternalConflictNotice` | the same sentence; the view list stopped at 2d-6-4's three | the two receivers and the two views named; "no component registers any of those eight receivers yet" |
| `saveOutcome.ts`, `ExternalConflictModel` header | "the raw editor's and restore's transitions are 2d-6-5's" | the two producers' callers named, restore's placeholder draft included; the panels are 2d-6-6's, 2d-6-7's and 2d-6-8's |
| `saveOutcome.ts`, `ConflictReapplySupport.unavailable` and `ConflictCapabilities` header | "The raw editor, and only it."; "the raw editor will never offer the reapply" | the raw editor and restore; "every declaring surface now offers the reload; the four `operationChoice` surfaces will never offer the copy" |
| `saveOutcome.ts`, `reapplyAuthorizationFor` | "the raw editor's takes no adoption function at all" | the raw editor's and restore's |
| `rawEditor.ts`, `CONFLICT_CAPABILITIES` | "it is the only one that can never reapply" (false since 2c-5-3) | one of the two — restore is the other |
| `rawEditor.ts`, *Three policy decisions* §2 and `keepEditing` | "*Keep editing* dismisses it and gives the box back" | only for a save conflict; under an external conflict the box stays read-only until the reload or the close |
| `rawEditor.test.ts`, the identified-subject case | "`beginReapply` reads this surface's permanent declaration" | `enterReapply` since 2d-6-5 |

**Left alone, deliberately**: `saveOutcome.ts` / `index.ts`'s "Nine codes" (1a §5 item 2); "Today
every registered transition is a no-op" in `observationTransitions.ts` and `writeSurfaceRegistry.ts`
(still true); `workspace.svelte.ts`'s `ObservationReceiver` doc, which names the editor's receiver
without claiming it is the only one; `rawEditor.ts`'s header sentence "nothing in this repository
renders a Svelte component in an automated test" (false since 2c-4a, not this step's class, recorded
in §4).

## 2. Rulings taken here, and what each does not force

1. **The raw editor's doors are `canSave` and `beginSave`, with no code of their own.** Q2 names
   exactly those two for this surface, and the raw editor has no refusal code beside its control
   to grow; the match editor's precedent is that a bare `beginSave` is explained by the view's
   `externalMessages` / `externalNotices`. What this forces: `canSave` is `false` and `beginSave` is
   `null` under all three blocks. What it does not: that `RawEditor.svelte` draws the two view
   fields beside the disabled control — 2d-6-8's, stated on both fields.
2. **A held reading does not freeze the raw box, and does not freeze restore's catalogue or
   candidate.** A wait is a restriction on sending; freezing what a person may still look at and
   choose, for a window decision that has not been made, would claim more than the fact supports
   (the creator's reason). Pinned on both: an edit under the wait carries the wait, a batch chosen
   under it carries it too.
3. **The final permit refuses a non-empty `heldDeliveries`**, not only a wait or a conflict on the
   session's fields. Between `confirmRestore` and `sendRestore` the session is `saving`, so the
   receiver can only append; a permit that ignored the list would send past a decision the session
   had been told of. What it costs is one consumed permit for an envelope that would have changed
   nothing (`coalesced`, `notLater`), and the person confirms again; what it buys is that the send
   never outruns a `raised` or a `retained` the window delivered. Stated on `permitHolds` and on the
   field.
4. **Restore's external model over no candidate is built over a documented placeholder draft, not
   over a widened type.** The truthful type — a nullable candidate — would have widened
   `conflictOf`, `RestoreView.conflict` and the generic `RecoveryWithoutCreation` prop into a union
   of two instantiations from a step that may touch no component; refusing to record the conflict
   at all would have left the block unenforced. The placeholder is read by nothing that draws, and
   the field doc names it for what it is. **The model built over it says nothing about a
   candidate** (§7 finding 4): its lines are the file's own first line alone, and the view names
   no operation for it — the first landing let the ordinary declaration write *what you asked for
   here is still set up* and *the same text still selected here … your confirmation is withdrawn*
   over a session that had selected nothing and confirmed nothing. What that cannot force: a
   renderer reading `conflict.draft` as the candidate.
5. **Restore's receiver suspends the question across its reads and carries it on a wait.** The
   module's rule is that a withdrawing transition revokes before it reads anything; the receiver
   cannot know whether it withdraws until it has read two caller-controlled properties, and the
   suspension is the module's own answer to exactly that shape. A wait changes nothing a
   confirmation binds, so the question is carried rather than revoked, and the doors refuse until it
   lifts — the presents/authorizes biconditional therefore does not hold under a wait, exactly as it
   does not under `readOnly` or a competing surface, and the table's stated scope excludes it; its
   own case pins the carry. What this does not force: a delivery reached from inside an *outer*
   inspection (`targetRevisionObserved` or `candidateRead`) carries nothing, because the cell is not
   this call's — the successor presents no question, which is the safe direction (§5 item 3).
6. **`prepareRestore` answers the installed session when displaced, not the session handed in —
   on every return path**, and the two reloads do the same. A door that returns a session, refused
   by returning its argument, would have the caller's `session = prepareRestore(session, …)`
   overwrite the receiver's install with the capture; the first landing applied that to the asking
   path alone and the review's second finding is the refusals (§7). What it forces: a caller that
   installs the answer keeps what its receiver installed. What it does not: that the caller passes
   a reader at all.
7. **A spent (`restored`) restore session takes a delivery**, as the deleter's `deleted` session
   does: the conflict stands beside the committed outcome and the doors refuse for the commit
   before they refuse for the conflict. This surface has no "closed" state — the pane is closed by
   the person — so dropping deliveries on it would have hidden a wait or a conflict the person can
   still see. A first landing of this record had it take nothing; the held-delivery case over a
   commit is what showed the replay silently dropping.
8. **Restore gained a reapply value.** Entry 22 says raw and restore keep `unavailable`; the raw
   editor already said so as a value and restore only as a declaration. One shape on both
   whole-document surfaces is what 2d-6-8's renderer meets; the value spends nothing, takes no
   adoption function, and is pinned as such.
9. **Item 12 of 2d-6-2 (`adoptDiskVersion` has no write-in-flight guard) — answered as the other
   six answered it**: the send is refused under a held reading at every door of both surfaces, so
   nothing is sent behind another surface's write; the reload is not withheld for a held reading,
   because it sends nothing — the raw reseed leaves `canSave` blocked by the wait, and restore's
   retarget leaves `restoreRefusal` at `observationRetained` (both pinned). The door's own guard
   stays a `BrowserState` question for the step that next changes `adoptDiskVersion`.
10. **Item 3 of 2d-6-2 (the `superseded` origin a `supersedes` verdict names is not compared with
    the shown conflict's) — left as it is** on both receivers, for 2d-6-2's reason, stated on both.
11. **Item 4 of 2d-6-2 (the standing-origin guard optional) — moot on these two surfaces**: the
    guard `enterReapply` takes is never asked, and the private `NEVER_ASKED` says what it would
    answer if it were.

## 3. The acceptance clauses, pinned

*CR handling*: `rawEditor.test.ts` *refuses to reseed from a disk version holding a carriage return,
and never normalizes it*; `workspace.test.ts` *refuses to reseed the raw editor from a disk version
holding a carriage return, through the real door* (`workspace.test.ts:11522`). *Consent withdrawal*:
raw — *withdraws consent with the reseed: an acknowledgement for one draft cannot be spent on the
reseeded one*; restore — *withdraws consent on the verdict: an acknowledgement for one transaction
cannot be spent after a retarget*, plus *raises over the destination, keeps the candidate, withdraws
the question and its consent, and refuses all three doors*. *Candidate retention*: *re-points the
kept candidate at the observation's disk revision when the window installs it, and confirms again
from there*, and the same through the window (`workspace.test.ts:11645`). *All three adoption
outcomes*: *answers every adoption outcome for the external origin* on both surfaces, and through
the real door *answers all three adoption outcomes to the raw editor / to the restore through the
real door, the outlived origin refused without resetting the warning* (`workspace.test.ts:11548`,
`:11693` — B supersedes A at the window; the installed session's reload is `idle` by the transition;
a hand-kept A confirmation is refused at the door and its step is `refused`, not reset). *The
submission block at every door called directly*: raw `canSave`/`beginSave` in *raises over the file,
freezes the box, and refuses the save at both doors* and *answers null from beginSave called directly
under an external conflict, refusal path included*; restore's preparation, confirmation and final
permit in *raises over the destination …*, *refuses the final permit directly under an external
conflict, and sends nothing*, *records a wait as a restriction on the three doors …* and *holds every
delivery during its own replacement …* (the held envelope refusing the permit). *The seven-arm
receiver per surface*: the *seven arms* suites on both, with `coalesced` and `notLater` pinned by
object identity. *The `current` reader refusing when the installed session is not the one handed
in*: *refuses a save when the draft read displaced the installed session*; *asks and confirms
nothing when a context read displaced the installed session*; *consumes the permit unspent when a
permit read displaced the installed session, and sends nothing*. *The replay in rounds*: *settles
against the installed session and replays a delivery that arrived during its own replay* on both
(raw through `applySave` and `saveCouldNotBeSent`; restore through `applyRestore`,
`restoreCouldNotBeSent` and `restoreConfirmationWithdrawn`), each with the no-reader cost pinned.
*At least one real-door case per surface with the command spy at zero*: the nested suite *the raw
editor's and restore's external sessions — Phase 2d-6-5* (`workspace.test.ts:11422`, seven cases):
the raw editor raised, refused at both doors and reseeded through `adoptDiskVersion`; its own save
held through `heldRawSave` with the barrier's `retained` and the settlement's `raised` replayed by
`applySave` against the installed session; restore raised, withdrawn, refused at all three doors and
retargeted; restore told `retained` through the barrier with the final permit consumed unspent and
the settlement's verdict delivered. **The command spy**: every case asserts `invoked` at zero and the
file's `afterEach` re-asserts it; the raw cases additionally assert `saveRawDocument` was called
never, or exactly once for the one in-flight write the case scripts.

**Verification, each gate on its own, exit read directly — at the first landing.** `npm run check`
**447 files, 0 errors, 0 warnings** (unchanged); `npm test` **2807 passed, 64 files** (+53 from
2754: `rawEditor.test.ts` 46 → 63, `restore.test.ts` 221 → 250, `workspace.test.ts` 310 → 317,
`restoreCodes.test.ts` 18 → 18 with its list widened to 14 keys); `npm run build` **192 modules**
(unchanged), the server-only oracle absent (`rg -c '\$\$payload|head_payload|push_element'
dist/assets/index-*.js` prints nothing) and the client-only present (`rg -c
'window\.__svelte|svelte-trusted-html'` prints `2`). No Rust file changed; the instrument pair's
diff stays `5 insertions(+), 1 deletion(-)`; nothing under `src/lib/components/`. **After the fix
round** (§7): `npm run check` 447 files, 0 errors, 0 warnings; `npm test` **2817 passed, 64
files** (+10: `rawEditor.test.ts` 63 → 66, `restore.test.ts` 250 → 253, `workspace.test.ts`
317 → 321); `npm run build` 192 modules, both oracles as above; the instrument pair's diff
unchanged; nothing under `src/lib/components/`, `crates/` or `src-tauri/` beyond the instrument.

## 4. Open items deliberately left, none a defect of this phase

Inherited from 2d-6-4 §4, taken or left per item:

1. **No component draws the new fields or the new codes' context** (2d-6-4 item 1) — **left**, by
   scope: `RawEditor.svelte` draws a disabled control with no sentence under an external block and
   never draws `externalMessages`, `externalNotices` or the external conflict outside the
   save-outcome branch; `RestorePane.svelte` renders the two new codes' sentences through
   `tRestoreRefusal` and nothing else new. 2d-6-8's.
2. **No component registers either receiver**, and over which files each is registered is
   2d-6-8's (item 2) — **left**; both receivers fail safe on a delivery about another file.
3. **No `removed`-status transition** for either (item 3) — **left**, as for the other six.
4. **The reader is optional and no component passes one** (item 4) — **left, for the same
   reason**: `RawEditor.svelte`, `RestorePane.svelte` and `BrowserState.restoreDocument` call
   without one and register no receiver, so nothing is displaced today. `restoreDocument` in
   `workspace.svelte.ts` hands `sendRestore` the confirmation's own session and no reader, and
   returns `restoreConfirmationWithdrawn(session)` with no reader either — the two calls 2d-6-8
   must give a reader if the pane's session is to be reached from there, which may mean a
   parameter on `restoreDocument` (a `BrowserState` member, not the `ReconciliationWorkspace`
   interface). **The editor's, the creator's and the recovery form's reapplies** still enter
   `enterReapply` before their blocks and recheck nothing before adopting — still not this phase's
   files, still for 2d-6-6.
5. **2d-6-2's open items 1, 2, 5, 6 and 7** apply to both sessions unchanged (item 5): a hold the
   window ends without a delivery is unseen; a reading the barrier coalesced away is never
   announced; a save conflict under the hold offers the reload; `heldDeliveries` vouches for arrival
   order, not decision order.
6. **No new Spanish** (item 6): no key was added; restore's two codes render 1a's sentences, still
   awaiting ruling 40's bilingual review (2d-6-11's).
7. **`ExternalConflictAction` still has one arm** (item 7).
8. **`awaitedFor` / `withWait` / `withoutWait` are now seven private copies** (item 8, which named
   this step as the one that "may decide otherwise") — **left as copies, decided**: a shared module
   would move the Vite module count this step must hold at 192, and the shape is three lines each.
   A home for them is a `.ts` module some later step that already pays for one may host.
9. **New here — a delivery reached from inside an outer inspection carries no question** (§2 item
   5): `RestorePane.svelte` runs `targetRevisionObserved` from an `$effect`, and a receiver run from
   a getter inside it would meet a suspended cell it does not own; the successor presents no
   question and the outer call's own put-back leaves the question keyed under a session no longer
   installed, where nothing can confirm it. Safe, and stated on `applyRestoreObservation` and
   `carriedPast`; 2d-6-8, which wires the receiver beside that effect, decides whether a delivery
   can arrive there at all.
10. **New here — the raw editor's module header** still says "nothing in this repository renders a
    Svelte component in an automated test", false since 2c-4a and not this step's class (it is not
    about the external session); recorded for the citation-drift sweep rather than corrected in a
    diff that does not falsify it.
11. **Noticed in the fix round, not fixed there (`CLAUDE.md` §7) — the three operation doors have
    the shape the review's first finding names.** `confirmDelete`, `beginMove` and `beginDuplicate`
    (2d-6-4 §1.2) read `current()` after their `projected` comparison and *then* call
    `submissionOf(session.draft)` and spread the session, so a getter behind `draft.value` or an
    own property of the session that is quiet on the earlier reads and delivers on those runs
    after the installed-session check, exactly as `beginSave`'s did. 2d-6-4's review reproduced the
    class through `projected` alone and those doors were not this review's files. 2d-6-6, which
    makes the reader required, should move the submission and the spread ahead of the reader on
    all three, in `beginSave`'s shape (§7 finding 1).
12. **Noticed in the fix round, not fixed there — a candidate dropped under a standing conflict
    leaves the conflict's lines saying it is kept.** `chooseBatch` and `chooseEntry` are not frozen
    under a conflict of either origin, so a person can drop the candidate while the panel stands;
    the save arm's `operationKeptInMemory` and restore's `conflictOperation` then describe a
    candidate the session no longer retains, and an external model raised over a candidate keeps
    its two candidate lines. `overNoCandidate` (§7 finding 4) decides at the verdict, not at the
    drop. Pre-existing on the save arm, wider than the finding, and a choice for 2d-6-8 — freeze
    the selection under a conflict, or derive the lines at the view from the live preview.
13. **Noticed in the fix round, not fixed there — `reloadTheDiskVersion`'s displaced-before-adoption
    arm answers the installed session without touching its confirmation state**, where every other
    arm of that transition revokes. Through this module's own transitions no question can be
    pending on a session showing a conflict, so nothing reachable is left presenting a question it
    does not authorize; a hand-built session is the one shape, and the arm's doc says so.

## 5. Where it is thin

1. **Restore's external model over no candidate is a placeholder** (§1.1, §2 item 4). The model
   carries a draft of `''` that nothing draws; a renderer that read `conflict.draft` as the
   candidate would draw an empty candidate for a session that has none, and only the field doc and
   `RestoreView.preview`'s primacy stand against it. The case *raises over a session with no
   candidate, over a placeholder draft, and says the file first* pins the value and the block, and
   *claims no candidate for an external conflict raised over none* (§7 finding 4) pins the one line
   and the absent operation — not what a screen would do with either.
2. **The final permit's `heldDeliveries` refusal over-refuses** for an envelope that would change
   nothing (`coalesced`, `notLater`): the permit is consumed and the person confirms again. The
   alternative — reading the held envelopes' verdicts inside `permitHolds` — would add
   caller-controlled reads to a predicate whose whole point is that the checked deletion, not the
   predicate, is the authorization. Stated on `permitHolds`; not pinned as a cost because no
   ordinary path produces a held `coalesced` before the send.
3. **The receiver-inside-an-inspection edge** (§4 item 9) is stated and not pinned: producing it
   needs a getter on a session property inside `targetRevisionObserved` that publishes through a
   window, which is 2d-6-8's wiring to decide before there is a path to pin.
4. **No mounted evidence** (components: none). The receivers are registered by no component, the
   ordering of a delivery against `RestorePane.svelte`'s own `await restore(...)` and
   `RawEditor.svelte`'s `await save(...)` is 2d-6-8's mounted test, and the new view fields are read
   by nothing that draws.
5. **The settlement's replay rounds are bounded only by the caller**, as on the other six
   (2d-6-4 §6 item 5); stated on both `consumingHeldDeliveries`.
6. **The `about` decision reads `observation.document`**, one caller-controlled read taken once and
   first; a getter behind it can answer one file to this decision and another to a later reader —
   the same limit the operation sessions state, stated on both receivers.
7. **`prepareRestore`'s block is asked before its reads and the reader after them all** (§1.7),
   where `confirmDelete` asks the block after the reader. The identity check is what carries the
   difference — a receiver replaces and never mutates — and a caller that redefines a property of
   the session it handed in between the two is the one shape that slips through; that caller's own
   session is what it defeats. `beginSave` has the same shape since the fix round: `canSave` is
   asked before the reader and the identity check stands between them.

## 7. The review's findings, re-derived and fixed

**Codex adversarial review, ship-with-fixes: 2 BLOCKERS, 2 SHOULD-FIX**
([`docs/reviews/phase-2d-6-5.md`](../reviews/phase-2d-6-5.md)). Three of the four are the class
2d-6-4's review found on the operation sessions — the installed session asked too early, or a
return path that never asks it (`CLAUDE.md` §6: *a check and a spend separated by any property
read are not atomic*) — and the fourth is a false sentence on a model (`CLAUDE.md` §5's worst
class). Each was re-derived against the pre-fix tree by writing the pinning case first — through
the real door in `workspace.test.ts`, with the registered receiver reinstalling the session,
wherever the interleaving is a re-entrant delivery — and reading its failure; **all four held**,
on both surfaces where both were named. The reviewer records that it checked and did **not**
uphold nested delivery loss through `BrowserState` (which serializes delivery), a placeholder
submission or copy, and consent reuse across a normal reseed; those paths were left alone. No
re-review follows this fix (`CLAUDE.md` §7). What was noticed on the way and not fixed is §4 items
11–13; the one sentence outside the two named files that the fix falsified —
`describeExternalConflict`'s *every external conflict this repository builds carries … the three
lines* in `saveOutcome.ts` — is corrected in this diff under ruling 41.

1. **[BLOCKER] `beginSave` (`W:910`) — the installed session was read after the carriage-return
   check and before the other reads: `canSave`'s `isDirty` read `draft.value` again, `submissionOf`
   read it a third time, and the spread read every own property; a getter quiet on the first read
   and delivering on any later one, or on the spread, let the receiver install a conflict after
   the check, and the door spent. Held.** A second defect on the same line: the carriage-return
   check was made on one read of the value and the submission taken from another, so a getter
   answering a clean text first and a `\r`-bearing one next produced a submission carrying bytes
   the check never saw. **Cases:** *refuses a save when a later read of this door displaced the
   installed session* (`rawEditor.test.ts:1512` — the reads of the value are counted on a quiet
   getter, then a delivery on each of them in turn, then one from an own property the spread
   reads), *checks the carriage-return refusal on the exact bytes it would send*
   (`rawEditor.test.ts:1582`), and through the window *refuses a raw save whose later draft read
   let the window displace the installed session* (`workspace.test.ts:11789` — a real
   `observeExternalChange` from the second read, the raw editor's registered receiver installing
   the conflict, `saveRawDocument` never called). **Pre-fix failure, verbatim** — model and window
   alike: `AssertionError: expected { …(2) } to be null`; the bytes case:
   `AssertionError: expected false to be true // Object.is equality`. **Fix:** the submission is
   taken first; the carriage-return check is made on `submission.candidate`; `canSave` is asked
   and the waiting session built; and only then is the installed session read, once, with nothing
   caller-controlled between that read and the return. What it does not force: a caller passing a
   reader (still optional; 2d-6-6's), or a caller that redefines a property of the very session it
   handed in — that caller's own session is what it defeats, and `canSave` re-reading the value
   for dirtiness against a shifting getter can at worst send a clean candidate, which is a legal
   `committed: false`.
2. **[BLOCKER] `prepareRestore` (`S:2399`) — three refusals returned the session handed in after
   caller-controlled reads: `preview === null || !canPrepareRestore(…)` after the preview and the
   context, `submission.baseRevision !== baseRevision` after the submission. A `context.observed`
   getter that delivered a superseding observation through `BrowserState` and then answered a
   revision the session is not measured against refused `targetMoved` with the pre-read capture,
   and the caller's `session = prepareRestore(session, …)` erased what the receiver installed.
   Held.** **Cases:** *answers the installed session from every refusal of the preparation, never
   the session handed in* (`restore.test.ts:3742` — the context read refused `targetMoved`, the
   surfaces read refused `writeSurfaceOpen`, the submission read refused by a disagreeing base, the
   preview read answering `null`, and a refusal that displaced nothing still answering its
   argument) and through the window *answers the installed session from a refused preparation
   whose context read let the window displace it* (`workspace.test.ts:11825`). **Pre-fix failure,
   verbatim** — model: `AssertionError: expected { target: 7, …(21) } to be { target: 7, …(21) } //
   Object.is equality`; window: `AssertionError: expected { target: 2, …(21) } to be { target: 2,
   …(21) } // Object.is equality`. **Fix:** every read moved into the private `questionFor`
   (`S:2460`), which builds the record and registers nothing; the door reads the installed session
   once after it, answers the installed session whenever it is not the one handed in — refusal or
   not — and only then refuses by returning its argument or registers the question. The
   `PENDING_AUTHORIZATIONS.has` guard stays first and returns the argument: it is a bare `WeakMap`
   operation, so nothing caller-controlled has run when it answers. What it does not force: a
   caller passing a reader, or the caller-redefined-property shape §5 item 7 names.
3. **[SHOULD-FIX] `loadDiskVersion` (`W:1364`) and `reloadTheDiskVersion` (`S:3751`) — neither
   took a reader, and both built their answer over the session handed in after `adopt` had run
   the window's own reads. Reproduced through the real `adoptDiskVersion` on both surfaces:
   confirm A, let `A.disk.id` publish B while the door copies the projection; B supersedes A at
   the window, the receiver installs B with the reload reset, the door refuses A as outlived, and
   the reseed/retarget handed back A's conflict at the refused step with B gone. The other outcome
   of the same read — the getter starts another surface's write first, so B is `retained` and the
   adoption goes on to `installed` — handed back a reseed/retarget with no record of the wait.
   Held, both arms, both surfaces.** **Cases:** *reseeds over the installed session, and answers it
   untouched when the adoption itself replaced the conflict* (`rawEditor.test.ts:1603`), *retargets
   over the installed session, and answers it untouched when the adoption itself replaced the
   conflict* (`restore.test.ts:3818`) — each with a `retained` during a satisfied adoption carried,
   a `supersedes` during a refused adoption answered as the installed session, a displacement
   before the adoption answered with the window never asked, and the no-reader cost pinned — and
   through the window *keeps what the window delivered during the adoption itself, on both
   surfaces* (`workspace.test.ts:11862`, the `supersedes` arm) and *carries a wait the window
   recorded during a satisfied adoption into the reseed and the retarget* (`workspace.test.ts:11951`,
   the `installed` arm, through `heldRawSave`). **Pre-fix failure, verbatim** — the model cases,
   both files: `AssertionError: expected undefined to be { sequence: 8, document: 7, …(6) } //
   Object.is equality`; the window's `supersedes` arm: `AssertionError: expected { Object
   (document, draft, ...) } to be { Object (document, draft, ...) } // Object.is equality`; the
   window's `installed` arm: `AssertionError: expected undefined to be { sequence: 6, document: 2,
   …(6) } // Object.is equality`. **Fix:** a third optional parameter `current` on both reloads,
   read once after their own reads and immediately before the adoption — a displaced session is
   answered as the installed one, the window never asked — and once more after it: a settled
   session whose conflict is another (by source identity) is answered untouched whatever the
   adoption said, and the same conflict with more recorded is what the reseed, the retarget and the
   refused step are built over, restore's revoked as the argument was. That is 2d-6-4's pattern
   (c) on the reloads, which §1.7 first said had nothing to take. What it does not force: a
   caller passing a reader (the components and `restoreDocument` pass none; 2d-6-6's), and §4
   item 13.
4. **[SHOULD-FIX] `replacedBy` (`S:4038`) — the model over the placeholder draft was described
   through the ordinary declaration, so `startRestore` followed by a `raised` observation exposed
   `operationKeptInMemory` (*what you asked for here is still set up*) and
   `reloadRetargetsCandidate` (*the same text still selected here … your confirmation is
   withdrawn*) beside a `preview` and a `pending` of `null`, and `RestoreView.conflictOperation`
   named *the backup entry selected here*. Held.** **Case:** *claims no candidate for an external
   conflict raised over none* (`restore.test.ts:3900` — the model's lines, the view's
   `externalMessages` and `conflictOperation`, a supersession over the empty state, and the
   candidate-bearing state keeping its three lines and its operation). **Pre-fix failure,
   verbatim:** `AssertionError: expected [ 'fileChangedWhileOpen', …(2) ] to deeply equal [
   'fileChangedWhileOpen' ]`. **Fix:** the private `overNoCandidate` (`S:4094`) keeps the file's
   own line alone on a model built while no candidate is retained — the `describeExternalConflict`
   and the `supersedeConflict` paths alike — and `restoreView` answers `conflictOperation: null`
   for an external conflict over no candidate; the field doc on `RestoreSession.externalConflict`,
   the doc on `RestoreView.conflictOperation`, §1.1, §2 item 4 and §5 item 1 now say what the code
   does, and the one sentence in `saveOutcome.ts` that said every external conflict carries three
   lines is corrected. What it does not force: the lines of a model raised over a candidate that
   is dropped afterwards under the standing conflict (§4 item 12), or a renderer reading
   `conflict.draft` as the candidate.

Both gates were re-run on the final tree after the fix round, each alone, exit read directly:
`npm run check` 447 files, 0 errors, 0 warnings; `npm test` 2807 → 2817, 64 files
(`rawEditor.test.ts` 63 → 66, `restore.test.ts` 250 → 253, `workspace.test.ts` 317 → 321);
`npm run build` 192 modules, the server-only oracle absent and the client-only present (`2`);
`git diff --stat -- src-tauri/src/main.rs src/main.ts` still `5 insertions(+), 1 deletion(-)`; no
component, Rust file or dictionary changed. The pre-fix failures were read from a run of each
changed test file with the cases added and the source untouched, before the first source edit.
