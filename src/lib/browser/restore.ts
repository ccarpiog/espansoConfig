/**
 * Restoring one file from one backup entry: the catalogue, the exact candidate, the
 * confirmation that binds them to a destination, and the two private memberships that
 * make one answered question authorize at most one write.
 *
 * **No component and no screen.** This is the project's established
 * value-before-choice cut (`CLAUDE.md` section 6): the model exists and is driven
 * by a test before anything draws it, so every rule below is a rule a test can
 * reach rather than a rule written into markup that one renderer carries alone
 * (2c-3c-3's Medium). `docs/reviews/phase-2c-5-design.md` Q4 is this module's
 * specification and Q5 is the screen 2c-5-4 draws over it.
 *
 * ## The one instruction this module exists to obey
 *
 * The consult's Q8, verbatim, because it is the whole design:
 *
 * > The only restore submission is the exact UTF-8 text whose candidate hash,
 * > opaque backup-entry identity, target `DocumentId`, target base revision, and
 * > preview generation are bound into one unspent confirmation; send that text
 * > unchanged through `BrowserState.saveRawDocument`, and treat every mismatch as
 * > "write nothing."
 *
 * So the candidate is read **once**, retained byte-exact, and never re-fetched:
 * {@link RestorePreview} holds the string that arrived and
 * {@link RestorePreview.revision} is the wire's hash of exactly those bytes.
 * {@link PendingRestore} binds all five values and {@link confirmRestore} rechecks
 * all five **plus** the open-surface predicate — but **a confirmation is not the
 * authorization to write**, because it is an ordinary value a caller can hold while
 * the world moves under it. What authorizes a write is a **permit**: a module-private,
 * plain, deeply frozen record of the five bound values *and the exact complete
 * submission*, built the moment the question is asked and reachable from nowhere
 * outside this file.
 * {@link sendRestore} is the only function here that hands anything to a sender; it
 * takes the **live** session and the **live** context, rechecks every bound value
 * against them, and **spends the permit with a checked deletion before the sender is
 * called**. A confirmation carried past a change to the destination, the base
 * revision, the entry, the candidate, the preview generation, the revision this window
 * projects, or the surfaces it has open sends nothing at all — and the permit is
 * consumed by that mismatch rather than left for a retry, because **the confirmation
 * and its permit authorize one send attempt**. That is a claim about the permit and
 * nothing else: the acknowledgement a preview carries is *not* spent with it. It stays
 * bound to the same candidate through {@link restoreConfirmationWithdrawn}, so once a
 * transient obstruction such as an open write surface is gone, a fresh confirmation can
 * mint a permit carrying that same acknowledgement. What forbids consent reaching other
 * bytes is {@link boundAcknowledgement} plus the retargeting transitions that clear it,
 * never a fresh-consent requirement at the send.
 *
 * **One record, two memberships, and it is never rebuilt.** {@link prepareRestore}
 * builds the permit when it asks the question and files it in
 * {@link PENDING_AUTHORIZATIONS} under **the session object it returns**;
 * {@link confirmRestore} takes it out with a **checked** `delete` whose success *is*
 * the authorization — one operation, so no getter and no proxy trap runs between
 * deciding and spending — and files that **same frozen record** in {@link PERMITS}
 * under the {@link StartedRestore} it returns, deriving nothing; and
 * {@link sendRestore} takes it out of {@link PERMITS} with a `delete` checked in
 * exactly the same way, before it calls the sender. **Every deletion is checked for
 * one reason**: each is preceded by checks that read properties off values a caller
 * supplied, any one of which can reach a getter or a proxy trap and re-enter here
 * synchronously, so a deletion whose result is discarded lets the outer call go on to
 * spend what the inner one already spent. That was the 2c-5-4a review's High.
 *
 * **The key is the session and not the question, and that is the 2c-5-4b
 * confirmation review's second High.** It used to be the {@link PendingRestore}
 * hanging off the session, which meant that naming the authorization at all required
 * reading `session.pending` — so {@link revokeConfirmation}'s own **first operation**
 * was a caller-controlled property read, and a getter installed there could answer the
 * question from inside the very transition that exists to take it back: the
 * authorization moved to {@link PERMITS} and the outer deletion then found nothing to
 * revoke. Keyed by the session, a revocation is `WeakMap.delete(session)` — a bare
 * reference operation that reads no property and runs no user code — so every
 * withdrawal can revoke **before** it touches the session, the context or any
 * callback.
 *
 * **One base revision, read once, on both fields — the confirmation review's first
 * High.** {@link prepareRestore} used to take `RestorePermit.baseRevision` from
 * `session.baseRevision` and `RestorePermit.submission.baseRevision` from
 * `submissionOf(preview.draft)`: two separate caller-controlled reads that nothing
 * required to agree, with {@link permitHolds} rechecking only the first and
 * {@link sendRestore} sending only the second. A locked write could therefore succeed
 * on a base revision the confirmation never bound. There is now **one local**, used
 * for both fields; registration is **refused outright** when the draft's own base
 * disagrees with the session's, because a snapshot describing two transactions is not
 * a snapshot; and {@link sendRestore} hands the sender `permit.baseRevision` — the
 * very field {@link permitHolds} rechecks — rather than the submission's copy of it.
 *
 * **Deriving the submission after the spend was the 2c-5-4b review's High**, and it
 * is why the record is built one function earlier than it used to be. `confirmRestore`
 * used to read `submissionOf(preview.draft)`, the session's target, its base revision
 * and the preview's entry and hash **after** its checked deletion had already spent
 * the question. A getter installed on the retained draft could therefore answer one
 * candidate while the question was being validated and another once it had been
 * answered: the permit recorded hash A beside submission B, {@link permitHolds}
 * re-read the same getter and saw B on both sides of its byte comparison, and B
 * reached the wire. The base revision had it worse — `permitHolds` compares
 * `permit.baseRevision` with the session's and never compares the submission's base
 * with either, so a drifting `draft.baseRevision` was not compared with anything at
 * all. **Nothing after the checked deletion may read a session, preview, draft,
 * pending or context property**, and nothing does: what follows the spend is one
 * `WeakMap.set` of a record that was frozen before the question was ever answered.
 *
 * So one question yields at most one permit and one permit yields at most one send —
 * one answered question authorizes at most one write. What that does **not** say is
 * that a session can be asked only once: {@link prepareRestore} mints a fresh question
 * every time it is called on a session with none pending, and each is its own
 * authorization, because asking again *is* asking again. The construct — runtime
 * membership keyed on the value the answer arrived on, so a spend is bound to its
 * origin — is `rememberTheConflict`'s in `./workspace.svelte.ts`, one operation along.
 *
 * ## Withdrawal revokes, and that is not presentation
 *
 * **The 2c-5-4b review's second High, and its confirmation round's.** Every
 * transition consult Q5 names as a withdrawal — a cancellation, a catalogue refresh,
 * a batch or entry being chosen, a candidate arriving or being refused, this window
 * re-reading the destination, an answer landing, a consumed confirmation being taken
 * back, findings being acknowledged, **and a confirmed reload of the disk version** —
 * **deletes the authorization from {@link PENDING_AUTHORIZATIONS} as its first
 * statement**, before it reads anything off the session or the context and before it
 * calls any callback a caller supplied. Writing `pending: null` into a *returned*
 * session used to be all any of them did, so a caller holding the pre-transition
 * session could still confirm it: `BrowserState.restoreDocument` deliberately takes
 * its session from `started` rather than from live pane state, so that confirmation
 * could have written candidate A while the pane showed B or showed no question at
 * all. Revocation is what makes "withdrawn" a statement about authorization rather
 * than about what is drawn.
 *
 * **First is a claim the key had to earn.** The fix round put the revocations first
 * in program order and left them reading `session.pending` to name what to delete,
 * which is a caller-controlled property read *inside* the revocation — so there was
 * still an opening, in the one helper whose whole job was to close it, and
 * {@link reloadTheDiskVersion} was missed entirely: it cleared `pending` through
 * `measuredAgainst`, five caller-controlled operations and one arbitrary callback
 * later. Keying by the session removed the read; auditing every transition that
 * writes `pending: null` added the reload.
 *
 * **A transition that keeps the question moves it**, through
 * {@link carryTheQuestion}: a listing landing, an outcome being put away and the two
 * reload steps change nothing a confirmation binds, so the authorization follows the
 * session they return and is **deleted from the one they were given**, which is why
 * one question can never be answered from two session objects at once.
 *
 * **A transition that cannot decide until it has read the session *suspends* it**, and
 * that is the second confirmation round's High. Two of them cannot revoke first:
 * {@link targetRevisionObserved}, which `RestorePane.svelte` runs from an `$effect` on
 * every change to the session, would revoke a question in the tick it was asked; and
 * {@link candidateRead} would destroy a live question because of a response that turns
 * out to be about another entry. Taking the entry *out* of the map and putting it back
 * closed the spend and opened a second hole in the same motion — **removing a token to
 * protect it creates a false "nothing here" state for every other producer that tests
 * for presence**, and {@link prepareRestore} reads absence as permission to ask again,
 * so a getter reached during the inspection could register a second live authorization
 * under a successor session while the first was still to be put back. The entry
 * therefore never leaves: it is replaced by a {@link SuspendedQuestion}, a private cell
 * {@link confirmRestore} refuses, {@link takeTheQuestion} refuses and
 * {@link prepareRestore}'s bare `has` counts as the existing question it is. The permit
 * comes back only if that very cell is still there, from a `finally`, so a throwing
 * getter cannot strand one — and a re-entrant withdrawal that deleted it has decided,
 * so it is never resurrected.
 *
 * **What no type forces**, in the same sentence as what one does: nothing makes a new
 * transition call {@link revokeConfirmation} or {@link carryTheQuestion}, and
 * TypeScript cannot see that a function returning a fresh session owes one of the
 * two. What *is* forced is that no path outside {@link prepareRestore} can put an
 * entry in, because {@link PENDING_AUTHORIZATIONS} is module-private; and what a test
 * holds instead of a type is the table in `restore.test.ts` that drives **every**
 * exported transition and asserts that the session it answers authorizes a
 * confirmation exactly when it presents one. Forgetting a carry is the **safe**
 * direction — the question dies and stops being drawn — and forgetting a revocation
 * is the unsafe one, which is why the presentation follows the authorization on every
 * arm rather than the other way round.
 *
 * ## What no type here forces, in the same sentence as what one does
 *
 * `matchDeletion.ts` has the identical limitation and states it, and this is that
 * statement for this module.
 *
 * **What is forced** is that a write this module issues carries an **unspent permit
 * whose bound values still describe the session and the window at the moment of the
 * send**, that the permit came from a question that had not been answered before and
 * had not been withdrawn, and that every value on it was copied out of the world
 * **before** the question was asked rather than after it was answered.
 * {@link prepareRestore} is the only producer of a permit and the only registrar of a
 * question; {@link confirmRestore} moves that same frozen record from
 * {@link PENDING_AUTHORIZATIONS} to {@link PERMITS} and computes nothing; `PENDING`
 * and `STARTED` are `unique symbol`s this module never exports, so no literal
 * outside it can have either type; and neither membership is a property of anything —
 * both are weak-collection entries, so reflection, spread and `structuredClone` all
 * find nothing to copy, **a spread or a clone of an asked session is not a key of the
 * first map**, and a clone of a {@link StartedRestore} is not a key of the second.
 * {@link sendRestore} reads the four arguments it sends off the permit rather than
 * off a caller.
 *
 * **What is not forced** is that the session and the context handed to
 * {@link sendRestore} are the live ones. Both are ordinary values, so a caller that
 * hands back the session the confirmation produced beside a context it did not
 * re-read gets agreement it did not earn — the same limit `observed` has one
 * argument along, and the reason both are required rather than defaulted. Nor is
 * anything forced about a caller that never calls {@link sendRestore} at all:
 * `RestoreSession.submitted` carries the candidate and `BrowserState.saveRawDocument`
 * is a public method. Nor is a *session* limited to one question: what is spent is one
 * membership, so any caller that reaches {@link prepareRestore} again with
 * none pending — having cancelled, having had one withdrawn, or simply having kept the
 * session from before the first call — gets a second question, and it is a second
 * authorization. That is asking again rather than answering twice, and it is the state
 * a screen puts a person in when the question is on screen once more. So the real hole
 * is one layer out: a component may import
 * `saveRawDocument` from `../ipc/commands`, or call `BrowserState.saveRawDocument`
 * with a text that never passed through here, and neither structural TypeScript nor
 * this module can see that — the hole every writing command has had since 2b-2a.
 * The core does not enforce restore intent either: there is no restore-specific
 * finding and consult Q3 rules that there must not be one, so a save issued around
 * this module is an ordinary whole-document replacement and is accepted as one.
 *
 * ## What a send in flight freezes, and what it does not
 *
 * `browser.restore.refused.inFlight` says *nothing can be changed here until the file
 * answers*, so every catalogue, selection, candidate and base-revision transition
 * below answers its own argument unchanged while {@link RestoreSession.phase} is
 * `saving` — and after a committed restore, which spends the session for good. A
 * catalogue answer that lands during a send is therefore **dropped**: the person
 * asks for the listing again once the file has answered, and the alternative was a
 * sentence claiming an immutability the model did not give.
 *
 * What is submitted is frozen too. {@link RestoreSession.inFlight} holds the exact
 * submission and the preview it was taken from, and {@link applyRestore} classifies
 * the answer against **that** rather than against whatever the session is showing
 * when the answer lands — because a replaced preview would describe an answer for
 * candidate A against candidate B, and a *removed* one would strand a seal the file
 * has already committed.
 *
 * ## Why a confirmation asks the window for the target's revision
 *
 * `matchDeletion.ts`'s recorded lesson, one operation along: **a confirmation that
 * compares two values minted together observes nothing.** Every value on a
 * {@link RestoreSession} was put there by this module, so a session retained across
 * a re-read of the destination keeps them all stale **and agreeing**.
 * {@link confirmRestore}'s `observed` argument is the only one that comes from
 * outside the session, so it is the only one that can notice that the window has
 * moved; {@link revisionInProjection} is what a caller reads it with, and nothing
 * makes a caller read it from there rather than handing back `session.baseRevision`.
 *
 * ## What a conflict does, and what it does not
 *
 * Restore takes the existing protocol unchanged: a conflict writes nothing, the
 * retained candidate is untouched by it, and the disk observation is installed only
 * through `BrowserState.adoptDiskVersion`, whose answer is
 * `installed | alreadyThere | refused` and whose only value a caller must not act on
 * is `refused`. **There is no *retry restore anyway***: after an adoption the base
 * revision moves to the conflict's `diskRevision`, the confirmation and any
 * acknowledgement are withdrawn, and the person confirms again against what the
 * window now holds. That is {@link ConflictReloadOutcome} `retargetsCandidate`,
 * which 2c-5-3 added to `./saveOutcome.ts` because both existing arms would have
 * been false sentences here.
 *
 * ## What restore may never claim
 *
 * Consult Q6, and it binds this file's comments and its dictionary keys alike. A
 * batch name is a sortable folder label derived from the process clock and is
 * **not** a time; a recognised batch is not an authentic one; nothing here says a
 * backup is older or newer than another state, that anything is recoverable, that
 * this application wrote or preserved these bytes, or that a restore is an *undo*.
 * The i18n suites check key parity and placeholder agreement and never meaning
 * (`CLAUDE.md` section 6), so nothing executable holds those sentences to it.
 *
 * ## The external session — Phase 2d-6-5
 *
 * The shape `./matchEditor.ts` took at 2d-6-2 and the operation sessions at
 * 2d-6-4, for a restore. {@link RestoreSession.externalConflict} is the conflict
 * a watcher observation raised over the destination, a field beside `outcome`
 * and never an arm of it (the 2d-6 record's §3 entry 6);
 * {@link applyRestoreObservation} is the session's receiver as a value, one
 * named action per verdict arm and a `never` terminus (entry 11);
 * {@link conflictOf} answers the conflict shown whichever origin it has, and
 * {@link restoreRefusal} — asked by {@link prepareRestore}, by
 * {@link confirmRestore} and, through {@link permitHolds}, by the final permit
 * {@link sendRestore} spends — refuses under both, with a code of its own for
 * the external origin and one for a held reading (entry 8: preparation,
 * confirmation and the final permit). A conflict raised under an unknown write
 * outcome ({@link RestoreSession.uncertaintyUnresolved}) withholds the reload
 * until {@link acknowledgeRestoreSnapshot} is told the hold ended (entries 11,
 * 15); {@link dismissRestoreOutcome} erases none of the three (entry 9).
 *
 * **A replacing verdict is a withdrawal that keeps the candidate** (entry 12,
 * and entry 23's "retarget"): `raised`, `raisedWithoutReload` and `supersedes`
 * go through {@link withdrawn} with the candidate `'kept'` — the question's
 * authorization is revoked as the first thing that happens once the verdict is
 * known, the confirmation and any consent go, the preview generation moves —
 * and the reload step is reset. What the reload then does is what it always
 * did here: install the disk observation through `BrowserState.adoptDiskVersion`,
 * keep the candidate, and move the base revision to the conflict's
 * `diskRevision` so the person confirms again against what the window now
 * holds. The candidate is never touched by any of it. **The reapply stays
 * `unavailable`** (entry 22): {@link reapplyToDiskVersion} says so as a value,
 * through `enterReapply`, for a conflict of either origin.
 *
 * **The receiver honours the memberships above.** It cannot know whether it
 * withdraws until it has read the verdict's kind and the observation's file, so
 * it *suspends* the question across those reads exactly as
 * {@link targetRevisionObserved} does, withdraws through {@link withdrawn} when
 * the verdict replaces, and carries the question through {@link carryTheQuestion}
 * when it only records or lifts a wait — a wait changes nothing a confirmation
 * binds, and the doors are what refuse under it.
 *
 * **Every door and every settling transition can read the installed session**
 * through a {@link ReadTheInstalledSession} (2d-6-4's review, its three
 * blockers): {@link prepareRestore} asks nothing and {@link confirmRestore} and
 * {@link sendRestore} spend nothing against a session that is no longer the one
 * installed; {@link applyRestore}, {@link restoreConfirmationWithdrawn} and
 * {@link restoreCouldNotBeSent} replay what the receiver appended during their
 * own replay. The reader is required since Phase 2d-6-6a — `RestorePane.svelte`
 * passes one at every call and hands it to `BrowserState.restoreDocument`, which
 * passes it on — and its doc says what no type can force about it.
 *
 * **`RestorePane.svelte` reports this receiver since Phase 2d-6-8a**, and
 * `DetailPane.svelte` registers it through `./surfaceReceivers.ts` over the
 * destination. Since Phase 2d-6-8b the pane draws the result: an external
 * conflict in a panel of its own outside the save-outcome branch, with its
 * origin, its lines, its one revision and the comparison, and the notices beside
 * the refusal line.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { CommandResult, RawSaveInvalidation } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type {
  BackupBatchId,
  BackupBatchListing,
  BackupEntry,
  BackupEntryId,
  BackupEntryListing,
  BackupTextResponse,
  ContentRevision,
  DocumentId,
  DocumentView,
  FileKind,
  PresentationNote
} from '../ipc/types';
import {
  deepFreeze,
  retargetedDraft,
  savedDraft,
  startDraft,
  submissionOf,
  textDraftRules,
  type Draft,
  type DraftSubmission
} from './draft';
import {
  atTheReloadWarning,
  conflictArm,
  consentForRefusal,
  offeredReloadStep,
  offeredRefusalChoices,
  refusedArm,
  reloadAsked,
  reloadConfirmed,
  reloadWasRefused,
  sendFailureLines,
  sendFailureOf,
  confirmationOf,
  settledAnswer,
  submissionIsStale,
  NOT_RELOADING,
  RELOAD_REFUSED,
  type AdoptTheDiskVersion,
  type EditorPhase,
  type ReloadStep,
  type SendFailure,
  type SendFailureLine
} from './editorSave';
import { openWholeDocumentSave, type SealedWholeDocumentSave } from './invalidation';
import { destinationEligibility } from './matchCreation';
import type { AcknowledgeTheUncertainty } from './matchEditor';
import type { ConflictSource, ExternalConflictObservation } from './conflictSource';
import {
  externalConflictNoticeKey,
  noticesBesideRefusal,
  type ExternalConflictNotice,
  type ObservationDelivery
} from './observationDelivery';
import type { RawSaveChoice } from './rawSave';
import {
  enterReapply,
  type ReapplyOutcome,
  type SharedReapplyObstacle,
  type StandingOriginGuard
} from './reapply';
import {
  conflictChoicesFor,
  conflictDiskText,
  describeExternalConflict,
  describeWholeDocumentSave,
  externalConflictMessageKey,
  invalidationFailureMessage,
  reloadUnavailableKey,
  supersedeConflict,
  type ConflictCapabilities,
  type ConflictChoice,
  type ConflictDiskText,
  type ConflictMessage,
  type ConflictModel,
  type ConflictOperation,
  type ExternalConflictModel,
  type SaveOutcomeMessage,
  type SaveOutcomeModel
} from './saveOutcome';
import type { RawSaveAnswer } from './workspace.svelte';

/**
 * One kind of surface this window can have open that writes a file.
 *
 * **Nine kinds, and restore is one of them**, which is consult Q4 read exactly:
 * a restore is a write surface for its target like any other, so a coordinator's
 * value has to be able to say so. The eight that *compete* with restore are
 * {@link CompetingWriteSurfaceKind}. The ninth, `rawSnippetEditor`, is Phase
 * 3-8-2's.
 *
 * **The recovery form is the eighth, since Phase 2d-6-6b** — the 2d-6 record's
 * §5.1 and §3 entry 3. It chooses its own destination and calls
 * `BrowserState.createMatch`, and may stay open beside the editor or the
 * new-snippet form it was opened from, so an editor over one file protects no
 * recovery destination in another. `recoveryTargetOf` in `./recovery.ts` answers
 * the file it would write, and `DetailPane.svelte`'s `satisfies
 * Record<OpenWriteSurfaceKind, …>` assembly is where a tenth member would be a
 * compile error. **What the union forces is that every member is assembled
 * there; it cannot force that the list of surfaces that write is complete** —
 * the seven-member version of this sentence was the claim §5.1 overturned.
 */
export type OpenWriteSurfaceKind =
  /** A snippet of the file is open in the small editor. */
  | 'matchEditor'
  /** A form for adding a snippet **to this file** is open. */
  | 'matchCreator'
  /** A panel for deleting a snippet of the file is open. */
  | 'matchDeleter'
  /** A panel for moving a snippet of the file is open. */
  | 'matchMover'
  /** A panel for duplicating a snippet of the file is open. */
  | 'matchDuplicator'
  /** The file's whole text is open in the raw editor. */
  | 'rawEditor'
  /**
   * One snippet's own text is open in the local raw editor (Phase 3-8-2): a
   * commit gives the snippet a new identity and makes every identity in the file
   * stale, so it competes with a restore like the match editor does.
   */
  | 'rawSnippetEditor'
  /** A restore over the file is open. */
  | 'restore'
  /**
   * A recovery form writing a new snippet **into this file** is open, beside the
   * editor or the new-snippet form it was opened from.
   */
  | 'recovery';

/**
 * The two kinds that choose their own destination, and so may name no file yet.
 *
 * **Written out, not derived**: what the two share — a destination chosen inside
 * the component — is not a property of the union a type could compute.
 */
export type DestinationChoosingKind = Extract<OpenWriteSurfaceKind, 'matchCreator' | 'recovery'>;

/**
 * The eight surface kinds a restore refuses to run beside.
 *
 * **Derived by exclusion rather than written out**, so a new member of
 * {@link OpenWriteSurfaceKind} joins this type automatically and becomes a compile
 * error in {@link openWriteSurfaceKey} rather than a silently unrefused surface.
 */
export type CompetingWriteSurfaceKind = Exclude<OpenWriteSurfaceKind, 'restore'>;

/**
 * The file one open write surface would write, when it names one.
 *
 * **The identity this window holds, and nothing finer**, which is the argument
 * `documentHasUnsavedDraft` in `./matchDuplication.ts` makes for a draft: a form
 * minted over an *earlier* parse of the file is stranded by a whole-document
 * replacement exactly as a current one is, because the write gives every identity
 * in the file a new revision. Comparing anything finer would let the very surface
 * this rule protects slip through.
 */
export interface WriteSurfaceDocumentTarget {
  /** Which arm this is. */
  readonly kind: 'document';
  /** The file it would write, by the identity this window holds. */
  readonly document: DocumentId;
}

/**
 * Which file one open write surface is about, or that it has not named one.
 *
 * **A discriminated union rather than an optional `document`**, which is
 * `docs/decisions/2d-5-split-notes.md` section 5.1 read exactly: an optional field
 * would make a destination-less form compete with no restore *by accident* — the
 * old comparison `surface.document === document` is false for `undefined` — rather
 * than by a rule a reader can find. What the union forces is narrowing before any
 * file can be read off a surface; what it does **not** force is that a consumer
 * treats the `unknown` arm conservatively once it has narrowed, and the two
 * predicates below answer that arm differently on purpose.
 */
export type WriteSurfaceTarget =
  | {
      /**
       * The surface is open and names no file yet.
       *
       * **Only the new-snippet form and the recovery form reach this state**
       * ({@link DestinationChoosingKind}). Each chooses its own destination, and
       * until it reports that choice upward this window holds a surface it cannot
       * attribute to any file.
       */
      readonly kind: 'unknown';
    }
  | WriteSurfaceDocumentTarget;

/**
 * One write surface this window has open, and which file it is about.
 *
 * **One discriminated union, never two registries**, which is the design consult's
 * Q1 (`docs/reviews/phase-2d-5-design.md:49-63`). The new-snippet form and, since
 * Phase 2d-6-6b, the recovery form are the only kinds whose target may be
 * `unknown`; every other kind carries a file, so a consumer that has narrowed to
 * one of them has a `DocumentId` without asking.
 *
 * **What the shape forces, and what it does not, in one sentence each.** It forces
 * that a {@link DestinationChoosingKind} is the only kind that can be open without
 * naming a file, so inventing a document for a destination-less form is not
 * representable. It does
 * not force any consumer to *classify* a new component as a write surface at all —
 * that is 2d-5-2's exhaustive assembly and its mounted tests — and it does not make
 * the list of surfaces complete: an empty array still claims there are none, which
 * is `competingSurfaceFor`'s own stated limitation below.
 */
export type OpenWriteSurface =
  | {
      /** The new-snippet form or the recovery form, which may not have chosen its destination yet. */
      readonly kind: DestinationChoosingKind;
      /** The file it would write, or that it has not named one. */
      readonly target: WriteSurfaceTarget;
    }
  | {
      /** What kind of surface it is. */
      readonly kind: Exclude<OpenWriteSurfaceKind, DestinationChoosingKind>;
      /** The file it would write, by the identity this window holds. */
      readonly target: WriteSurfaceDocumentTarget;
    };

/**
 * The first competing write surface open over one file, or `null`.
 *
 * **`restore` entries are skipped, and the type says so**: the caller of this
 * predicate *is* the restore surface, and a restore that refused itself could never
 * be started at all. What that leaves open, stated rather than glossed: nothing in
 * an {@link OpenWriteSurface} distinguishes one restore from another, so if a
 * window ever drew two restore surfaces over one file this predicate would not see
 * the other one. 2c-5-4 draws restore as a mode of the third pane, of which there
 * is one.
 *
 * **A creator that has not named a file competes with nothing**, and that is
 * 2c-5's shipped behaviour preserved rather than a new rule: a form naming no file
 * competes with no restore, and refusing every restore because some form is open
 * somewhere would refuse restores of files nobody was writing to. The `switch` with
 * its `never` terminus is how that answer is given deliberately — the comparison
 * this function used to make, `surface.document === document`, would have given the
 * same answer by accident the moment `document` became optional, and the opposite
 * answer the moment somebody made it required again.
 *
 * **The `never` terminus turns a future arm of {@link WriteSurfaceTarget} into a
 * compile error here, and nowhere else.** It cannot stop a consumer written without
 * a switch from collapsing the two arms, and only this function's own tests
 * establish that `unknown` competes with nothing while a named file competes with
 * itself alone.
 *
 * **Nothing here can check that the caller passed every surface it holds open.**
 * The argument being required is what stops silence compiling into "there are
 * none", which is `documentHasUnsavedDraft`'s own limitation one operation along.
 *
 * @param document - The file a restore would replace.
 * @param surfaces - Every write surface this window has open, in any order.
 * @returns The kind of the first competing surface over that file, or `null`.
 */
export function competingSurfaceFor(
  document: DocumentId,
  surfaces: readonly OpenWriteSurface[]
): CompetingWriteSurfaceKind | null {
  for (const surface of surfaces) {
    const kind = surface.kind;
    if (kind === 'restore') {
      continue;
    }
    const target = surface.target;
    switch (target.kind) {
      case 'unknown':
        // A form that names no file competes with no restore. Deliberate, and the
        // whole reason this is a switch.
        break;
      case 'document':
        if (target.document === document) {
          return kind;
        }
        break;
      default: {
        const unreachable: never = target;
        return unreachable;
      }
    } // End of the switch over the target's discriminant
  } // End of the loop over every open write surface
  return null;
} // End of function competingSurfaceFor()

/**
 * Whether one file is a **creator-eligible match document**, as the value
 * {@link targetingSurfaceFor} takes.
 *
 * **A named value rather than a boolean**, because the caller of that predicate has
 * to have decided this question before it asks, and
 * `targetingSurfaceFor(id, surfaces, true)` at a call site says nothing about which
 * question the `true` answers. {@link creatorEligibilityOf} is what produces it
 * honestly; **nothing in TypeScript forces a caller to use that function** rather
 * than pass a literal, and a wrong literal fails in the unsafe direction for
 * `notCreatorEligible` — an unknown creator that really could be about the file
 * would then be missed.
 */
export type CreatorEligibility = 'creatorEligible' | 'notCreatorEligible';

/**
 * Whether the new-snippet form would offer one file as a destination.
 *
 * **This is the definition `docs/decisions/2d-5-split-notes.md` section 6 item 3
 * leaves to this step**, and it is deliberately not a new rule: a creator-eligible
 * match document is exactly a file the new-snippet form would offer as a *choosable*
 * destination — `destinationEligibility` in `./matchCreation.ts` answering
 * `eligible`, which today means a file espanso loads snippets from, that this
 * application may write, that this window has read, whose text parsed, and that has
 * a top-level snippet list. Restating those five conditions here would create a
 * second rule that can drift from the form's own; delegating means the two cannot
 * disagree.
 *
 * **What it does not guarantee, in the same breath.** It is a fact about *this
 * window's current projection* of the file and never about the file on disk, so a
 * document can stop being eligible — or become eligible — between an observation
 * being admitted and this answer being asked for; it says nothing about whether a
 * new-snippet form is open at all, and nothing about which destination such a form
 * would actually choose. It is the *set an unknown target may be about*, never a
 * claim that it is about any particular member of it.
 *
 * @param summary - Anything carrying the file's kind and its read-only flag: a
 *   `DocumentSummary`, or a `DocumentView`, which carries both fields itself.
 * @param view - The file's projection, exactly as this window holds it, or `null`
 *   when it holds none.
 * @returns Whether the new-snippet form would offer this file as a destination.
 */
export function creatorEligibilityOf(
  summary: { readonly kind: FileKind; readonly read_only: boolean },
  view: DocumentView | null
): CreatorEligibility {
  return destinationEligibility(summary, view).kind === 'eligible'
    ? 'creatorEligible'
    : 'notCreatorEligible';
} // End of function creatorEligibilityOf()

/**
 * One open write surface that may be about one file, or `null`.
 *
 * **The watcher half of consult Q1's two predicates, and it answers the `unknown`
 * arm the other way round on purpose.** {@link competingSurfaceFor} treats a
 * creator that has named no file as competing with **no** document; this treats it
 * as targeting **every** creator-eligible match document — and, since Phase
 * 2d-6-6b, a recovery form that names no file the same way, since the arm is
 * switched on and not the kind — because the question is
 * different: a restore asks *may I replace this file's text*, where over-refusing
 * costs one closed form, and reconciliation asks *may I silently reload this file
 * under an open surface*, where under-refusing is the loss of somebody's work.
 *
 * **Restore surfaces are counted here and skipped there**, for the same reason: a
 * restore over the file is a surface a reload would pull the ground out from under,
 * and the caller of this predicate is the coordinator rather than the restore
 * itself.
 *
 * **What the `never` terminus forces, and what it does not.** A future arm of
 * {@link WriteSurfaceTarget} is a compile error in this function and in
 * {@link competingSurfaceFor}, and in no other consumer; it cannot force a third
 * predicate written later to switch at all. Only this function's own tests
 * establish that an unknown target answers for every creator-eligible document and
 * for none that is not.
 *
 * **It says nothing about whether the surface has been edited** (R36): `isDirty` is
 * derived inside each surface's own session and no coordinator can observe it, so
 * an answer here means *a surface capable of writing this file is open*, never
 * *there are unsaved edits*.
 *
 * **A surface that names this file is preferred to a creator that names none, and
 * what that ordering guarantees is narrow.** It guarantees only that the *kind*
 * answered is the most specific one available: a surface whose target is exactly
 * this document, if the list holds any, and otherwise the first destination-less
 * creator the list holds **while `eligibility` is `creatorEligible`** — an unknown
 * creator is not a fallback at all when it is not, and the answer is then `null`
 * however many such creators the list holds. It does **not** make the answer
 * canonical — this is still one answer out of possibly several exact matches, and
 * **array order still decides among those**, so two match editors over one file
 * answer whichever the caller listed first. It does not rank the **nine** members
 * of {@link OpenWriteSurfaceKind} against each other in any way — all nine,
 * `restore` included, since this predicate counts the kind
 * {@link CompetingWriteSurfaceKind} excludes. And it changes **no yes/no answer at
 * all**: an exact match and an eligible unknown creator each make the answer
 * non-null on their own, so the set of `(document, surfaces, eligibility)` triples
 * this function answers `null` for is exactly what it was when the first match in
 * array order won.
 *
 * @param document - The file an observation is about.
 * @param surfaces - Every write surface this window has open, in any order.
 * @param eligibility - Whether that file is a creator-eligible match document.
 * @returns The kind of a surface that may be about it, preferring one that names
 *   it, or `null`.
 */
export function targetingSurfaceFor(
  document: DocumentId,
  surfaces: readonly OpenWriteSurface[],
  eligibility: CreatorEligibility
): OpenWriteSurfaceKind | null {
  // The first destination-less creator the list holds **while `eligibility` is
  // `creatorEligible`**, kept as the answer to give when nothing in the list names
  // this file. When `eligibility` is anything else nothing is ever kept here, so a
  // file no open surface names is answered `null` however many such creators the
  // list holds.
  //
  // Two reads, two rules. The read inside the loop is the first-wins guard: it
  // keeps a later destination-less creator from displacing an earlier one. The read
  // at the return is the preference, and only that one waits for the whole list —
  // an exact match returns from inside the loop and never reaches it.
  let unnamedCreator: OpenWriteSurfaceKind | null = null;
  for (const surface of surfaces) {
    const target = surface.target;
    switch (target.kind) {
      case 'unknown':
        if (eligibility === 'creatorEligible' && unnamedCreator === null) {
          unnamedCreator = surface.kind;
        }
        break;
      case 'document':
        if (target.document === document) {
          return surface.kind;
        }
        break;
      default: {
        const unreachable: never = target;
        return unreachable;
      }
    } // End of the switch over the target's discriminant
  } // End of the loop over every open write surface
  return unnamedCreator;
} // End of function targetingSurfaceFor()

/**
 * Why this application will not prepare or confirm a restore right now.
 *
 * **A code, never a sentence** (`CLAUDE.md` section 2). {@link restoreRefusalKey}
 * maps it to a dictionary key; a component never builds the key.
 *
 * **Drawn since 2c-5-4**: `tRestoreRefusal` in `../i18n` is the reactive accessor,
 * and `RestorePane.svelte` renders the view's refusal through it. The accessor
 * arrived with that panel rather than with this type (2c-5-3), because
 * `../i18n/index.ts` is reachable from the application entry and importing this
 * module there before a panel drew it would have put an undrawn model into the
 * production bundle.
 */
export type RestoreRefusal =
  | {
      /** Another surface that writes this file is open, and it must be closed. */
      readonly kind: 'writeSurfaceOpen';
      /** Which kind of surface, so the sentence can be true of it. */
      readonly surface: CompetingWriteSurfaceKind;
    }
  | {
      /** The projection says this application must refuse to write the file. */
      readonly kind: 'readOnly';
    }
  | {
      /** No backup text has been read into this session, so there is nothing to send. */
      readonly kind: 'noCandidate';
    }
  | {
      /**
       * This window no longer holds the reading of the destination this session was
       * measured against — it has re-read the file, or holds no projection of it.
       *
       * **One code for both**, because the sentence a person needs is the same: what
       * was prepared no longer describes what the window holds, and it has to be
       * prepared again. Splitting them would need a second sentence saying the same
       * thing about a distinction nobody can act on differently.
       */
      readonly kind: 'targetMoved';
    }
  | {
      /** A replacement is in flight. */
      readonly kind: 'inFlight';
    }
  | {
      /**
       * A watcher observation raised a conflict over the destination and it has
       * not been resolved — Phase 2d-6-5, the 2d-6 record's §3 entry 8.
       *
       * **A code of its own rather than `conflictShowing`**, because that code's
       * sentence says the file changed *while this replacement was being
       * written* and this attempt wrote nothing — false of an observation no
       * save answered (entry 41's class). It renders the external origin's own
       * first line, through `externalConflictMessageKey`.
       */
      readonly kind: 'externalConflict';
    }
  | {
      /** A conflict a refused replacement raised is on screen and has not been resolved. */
      readonly kind: 'conflictShowing';
    }
  | {
      /**
       * The window holds a reading of the destination it has not decided about —
       * Phase 2d-6-5, entry 11's `retained` row as a restriction on sending.
       *
       * Renders the retained notice's sentence, through
       * `externalConflictNoticeKey`, and claims nothing beyond it: not that the
       * reading will be decided, nor what it will be decided as.
       */
      readonly kind: 'observationRetained';
    }
  | {
      /** A replacement has already committed through this session. */
      readonly kind: 'alreadyRestored';
    };

/**
 * The dictionary key holding one competing surface's sentence.
 *
 * A `switch` over literal keys rather than a template, the idiom of every other
 * describer in this directory: a renamed key is a compile error here, and a new
 * member of {@link CompetingWriteSurfaceKind} with no sentence is one too.
 *
 * **Every one of the eight sentences claims an open surface and nothing more.**
 * The seventh, `recoveryOpen`, is Phase 2d-6-6b's, for the recovery form; the
 * eighth, `rawSnippetEditorOpen`, is Phase 3-8-2's. None
 * of them says *unsaved changes*: `isDirty` is derived inside each surface's own
 * session, so no coordinator can observe it (R36), and this application has shipped
 * a sentence claiming otherwise twice already
 * (`browser.matchDuplication.refused.unsavedDraftInDocument`'s correction, and
 * `browser.matchMove.refused.unsavedDraft`, which still has the defect). Refusing
 * over a pristine surface costs one closed panel; the other error strands a
 * person's work.
 *
 * **What no test in this repository holds**: that the sentences *say* that. The
 * i18n suites check key parity and placeholder agreement and never meaning, so
 * this rule lives in prose and in review, exactly as `CLAUDE.md` section 6 records.
 *
 * @param surface - The kind of surface that is open.
 * @returns The key holding that surface's sentence.
 */
export function openWriteSurfaceKey(surface: CompetingWriteSurfaceKind): TranslationKey {
  switch (surface) {
    case 'matchEditor':
      return 'browser.restore.refused.matchEditorOpen';
    case 'matchCreator':
      return 'browser.restore.refused.matchCreatorOpen';
    case 'matchDeleter':
      return 'browser.restore.refused.matchDeleterOpen';
    case 'matchMover':
      return 'browser.restore.refused.matchMoverOpen';
    case 'matchDuplicator':
      return 'browser.restore.refused.matchDuplicatorOpen';
    case 'rawEditor':
      return 'browser.restore.refused.rawEditorOpen';
    case 'rawSnippetEditor':
      return 'browser.restore.refused.rawSnippetEditorOpen';
    case 'recovery':
      return 'browser.restore.refused.recoveryOpen';
  }
} // End of function openWriteSurfaceKey()

/**
 * The dictionary key holding one refusal's sentence.
 *
 * The `writeSurfaceOpen` arm delegates to {@link openWriteSurfaceKey} rather than
 * carrying a sentence of its own, so *which* surface is open is said once; the
 * two external arms delegate to the shared external-conflict key functions for
 * the same reason (Phase 2d-6-5, no key added), so the sentence a restore shows
 * for a held reading is the sentence every surface shows for one.
 *
 * @param refusal - Why the restore may not go ahead.
 * @returns The key holding that reason's sentence.
 */
export function restoreRefusalKey(refusal: RestoreRefusal): TranslationKey {
  switch (refusal.kind) {
    case 'writeSurfaceOpen':
      return openWriteSurfaceKey(refusal.surface);
    case 'readOnly':
      return 'browser.restore.refused.readOnly';
    case 'noCandidate':
      return 'browser.restore.refused.noCandidate';
    case 'targetMoved':
      return 'browser.restore.refused.targetMoved';
    case 'inFlight':
      return 'browser.restore.refused.inFlight';
    case 'externalConflict':
      return externalConflictMessageKey({ kind: 'fileChangedWhileOpen' });
    case 'conflictShowing':
      return 'browser.restore.refused.conflictShowing';
    case 'observationRetained':
      return externalConflictNoticeKey({ kind: 'observationRetained' });
    case 'alreadyRestored':
      return 'browser.restore.refused.alreadyRestored';
  }
} // End of function restoreRefusalKey()

/**
 * Which sentence stands where the reload control has gone — Phase 2d-6-8b, the
 * decision 2d-6-5 §4 item 12 handed on.
 *
 * `candidateKept` is the shared operation sentence, which ends *what you asked
 * for here is still set up*; `noCandidate` is this pane's own, for a conflict
 * whose candidate was dropped while it stood (`chooseBatch` and `chooseEntry`
 * stay open under a conflict), where that clause would describe a selection the
 * session no longer holds. Chosen by {@link restoreView} from the live preview.
 */
export type RestoreReloadUnavailable = 'candidateKept' | 'noCandidate';

/**
 * The dictionary key holding one reload-unavailable sentence — Phase 2d-6-8b.
 *
 * The `candidateKept` arm delegates to `reloadUnavailableKey` in `./saveOutcome`
 * over this surface's own draft kind, so the sentence every operation surface
 * shows is said in one place; the `noCandidate` arm is this pane's key.
 *
 * @param line - What {@link RestoreView.reloadUnavailableLine} answered.
 * @returns The key holding that sentence.
 */
export function restoreReloadUnavailableKey(line: RestoreReloadUnavailable): TranslationKey {
  switch (line) {
    case 'candidateKept':
      return reloadUnavailableKey(CONFLICT_CAPABILITIES.draftKind);
    case 'noCandidate':
      return 'browser.restore.reloadUnavailableNoCandidate';
  }
} // End of function restoreReloadUnavailableKey()

/**
 * What one catalogue read has answered so far.
 *
 * Four states rather than a nullable listing beside a nullable failure, so *not
 * asked yet* and *asked and refused* are different values. A listing carries its
 * own completeness — `BackupBatchListing.complete` and `BackupEntryListing.complete`
 * are what distinguish a short list from a whole one — so nothing here restates it.
 *
 * @typeParam T - The listing this catalogue holds.
 */
export type CatalogueState<T> =
  | {
      /** Nothing has been asked for. */
      readonly kind: 'idle';
    }
  | {
      /** A read is in flight. */
      readonly kind: 'loading';
    }
  | {
      /** A read answered. */
      readonly kind: 'loaded';
      /** What it answered, exactly as it arrived. */
      readonly listing: T;
    }
  | {
      /** A read was refused. */
      readonly kind: 'failed';
      /** Why, as the boundary classified it. */
      readonly failure: IpcFailure;
    };

/** The state every catalogue starts in, shared rather than rebuilt per session. */
const NOTHING_ASKED: CatalogueState<never> = Object.freeze({ kind: 'idle' as const });

/**
 * One backup entry's exact text, retained for as long as it is the candidate.
 *
 * **The bytes that were read, and the bytes that would be sent, are one value.**
 * Consult Q1: the candidate shown is the candidate sent, every finding is computed
 * from that submitted candidate, and the entry is never read again at send time —
 * a second read could answer different bytes and would make the preview a claim
 * about something else.
 *
 * The text lives in {@link RestorePreview.draft}'s value rather than in a field of
 * its own, so there is no second copy to drift from it; {@link candidateText} is
 * the named way to read it.
 */
export interface RestorePreview {
  /**
   * The entry, as the read that produced this candidate observed it.
   *
   * Carried whole for the screen: its `display_path`, its `length` — decimal
   * digits, to be compared with `BigInt` and never `Number` — and its `target`
   * namespace are what a person reads to tell one entry from another.
   */
  readonly entry: BackupEntry;
  /**
   * The revision of exactly the retained bytes.
   *
   * **The wire's hash of the candidate, and never a base revision for the live
   * file**, which has a revision of its own. It is evidence that a preview and a
   * later submission are the same bytes, and it is bound into
   * {@link PendingRestore}.
   */
  readonly revision: ContentRevision;
  /**
   * The base revision, the candidate and the consent, as one value.
   *
   * **Never edited**, so `isDirty` is always false and the history stays empty:
   * a restore has exactly one candidate. It is a `Draft` because the
   * acknowledgement round trip is defined over one — `acknowledgeRefusal` in
   * `./draft.ts` is the only producer of consent in this application, and a second
   * restore-shaped consent path would be a second place for that rule to be
   * relaxed (D7). This is `matchDeletion.ts`'s `Draft<MatchId>` argument over a
   * different value.
   *
   * **The value is a plain `string` and deliberately not `RoundTripText`.** That
   * brand belongs to the raw editor, which refuses a carriage return because a
   * `<textarea>` normalizes every line break to LF and cannot give one back. A
   * restore candidate never enters an input control — consult Q5 draws it through
   * `SourceText` — so a CRLF backup entry is restorable byte for byte, and
   * borrowing the brand would refuse exactly the files this application exists to
   * handle carefully.
   */
  readonly draft: Draft<string>;
}

/**
 * The exact bytes one preview would send.
 *
 * A named read rather than a walk into the draft at each call site, so the one
 * value that reaches the wire has one name.
 *
 * @param preview - The retained candidate.
 * @returns The entry's text, byte for byte as it was read.
 */
export function candidateText(preview: RestorePreview): string {
  return preview.draft.value;
} // End of function candidateText()

/**
 * The brand that makes a pending restore unforgeable. Declared, never exported.
 *
 * The construct `draft.ts`, `matchDeletion.ts`, `saveOutcome.ts` and
 * `invalidation.ts` all use: a property on a symbol this module does not export, so
 * no type outside it can name the key and no literal outside it can have it.
 */
declare const PENDING: unique symbol;

/**
 * A restore the window presents as awaiting confirmation.
 *
 * Presentation, never the private authorization's own state: a retained
 * session can still carry this value after that authorization has been spent
 * or revoked, and nothing is sent on its word alone.
 *
 * **The five values consult Q5 binds**, and {@link confirmRestore} rechecks every
 * one of them against the session *and* asks the window for the sixth thing — the
 * revision the live projection gives the destination — before it will produce
 * anything to send.
 *
 * **This value is presentation, and it is no longer the key.** It was the key of
 * {@link PENDING_AUTHORIZATIONS} until the 2c-5-4b confirmation round, which is what
 * forced {@link revokeConfirmation} to open with `session.pending` — a
 * caller-controlled property read inside the one helper whose whole purpose is to run
 * before caller-controlled reads. The authorization is keyed by the session itself
 * now; what remains here is what a screen needs to draw the question, and the fields
 * are a **copy** taken off the frozen {@link RestorePermit} rather than the values
 * anything checks: this object is a plain literal whose properties `defineProperty`
 * can replace with getters, while the record is deeply frozen and unreachable.
 *
 * **It is still branded**, so no literal outside this module can have the type and
 * `pending !== null` cannot be claimed by a value nobody asked for. What the brand
 * cannot do is make presentation and authorization agree — that is
 * {@link revokeConfirmation} and {@link carryTheQuestion} being called by every
 * transition, and a table in `restore.test.ts` rather than a type.
 */
export interface PendingRestore {
  /** The brand. Never present at runtime, never nameable outside this module. */
  readonly [PENDING]: typeof PENDING;
  /** The file that would be replaced, by the identity this window holds. */
  readonly document: DocumentId;
  /** The revision that file is expected to hold. */
  readonly baseRevision: ContentRevision;
  /** The backup entry the candidate was read from, by its opaque identity. */
  readonly entry: BackupEntryId;
  /** The hash of exactly the candidate bytes. */
  readonly candidateRevision: ContentRevision;
  /** The preview generation it was issued at. */
  readonly generation: number;
}

/**
 * What every unanswered question authorizes, **keyed by the session it was asked on**.
 *
 * **The membership *is* the authorization, and it is the fix for 2c-5-3's H1 in the
 * narrower form its confirmation round found.** Every field a confirmation compares is
 * a value — numbers and strings, one of them inside a nested identity — so they compare
 * equal however many copies of the session exist. Consuming the request by writing
 * `pending: null` into the session {@link confirmRestore} *returns* therefore spends
 * nothing at runtime: a caller that discards the returned session, or that kept a
 * `structuredClone` of the one it passed in, still holds a value that satisfies every
 * field check and could mint a second permit over the same answered question.
 *
 * So membership in this map is what {@link confirmRestore} actually spends, and it
 * spends it by a **checked deletion**: `WeakMap.delete` answers whether the question
 * was still a member *and* removes it in one operation that runs no user code, so the
 * test and the spend cannot come apart. Testing with `has` and deleting several lines
 * later is not the same guarantee and was this defect's second form — every property
 * read between the two can reach a getter or a proxy trap, and a caller that re-enters
 * there gets one question answered twice. {@link prepareRestore} is the map's only
 * producer; the deletion is placed **after every confirmation check and before the
 * permit is filed in {@link PERMITS}**, so a refused confirmation leaves the question
 * askable and no path, ordinary or re-entrant, reaches {@link PERMITS} twice for one
 * question. A clone is not a key, because `structuredClone` copies fields and a
 * `WeakMap` entry is not a field.
 *
 * **The key is the exact session {@link prepareRestore} returned, and that is the
 * 2c-5-4b confirmation review's second High.** It was the {@link PendingRestore}
 * hanging off that session until then, and naming the key therefore meant reading
 * `session.pending` — so the revocation could not precede caller code, because its own
 * first operation *was* caller code. A session is a key nothing has to read a property
 * to name: `PENDING_AUTHORIZATIONS.delete(session)` is a bare reference operation, and
 * that is what lets every withdrawal revoke first. What it costs is that a transition
 * returning a fresh session which keeps the question must move the entry —
 * {@link carryTheQuestion} — and that a spread or a `structuredClone` of an asked
 * session authorizes nothing at all, which is stricter than what it replaced.
 *
 * **It holds a value rather than being a bare set, and that is the 2c-5-4b review's
 * first High.** The {@link RestorePermit} filed here is built by
 * {@link prepareRestore} out of the world as it stood when the person was asked, is
 * deeply frozen, and is the *same object* {@link confirmRestore} hands to
 * {@link PERMITS} — so nothing on the far side of the spend has to be re-derived from
 * a session, a preview or a draft a caller controls. A `WeakSet` could not carry it,
 * and carrying it is the whole point.
 *
 * **An entry has a third state, and that is the second confirmation round's High.**
 * {@link SuspendedQuestion} stands in for the permit while a transition that may or may
 * not withdraw reads the caller's session, so the question is never *absent* while it is
 * still undecided. Absence is not neutral here: {@link prepareRestore} tests presence,
 * and a question that briefly looks unasked is a licence to ask a second one.
 *
 * The construct is {@link PERMITS}'s one step earlier, and `rememberTheConflict`'s in
 * `./workspace.svelte.ts`: runtime membership keyed on the object the answer arrived
 * on, reachable from nowhere else.
 */
const PENDING_AUTHORIZATIONS = new WeakMap<RestoreSession, RestorePermit | SuspendedQuestion>();

/**
 * A question held out of a caller's reach while the call that holds it inspects its
 * session.
 *
 * **It exists because absence is not neutral**, which is the 2c-5-4b second confirmation
 * review's only High. Two transitions have to read caller-controlled properties of a
 * session that may still be authorized when they are done — {@link targetRevisionObserved},
 * which `RestorePane.svelte` runs from an `$effect` on every change to the session, and
 * {@link candidateRead}, whose response may turn out to be about another entry entirely.
 * Neither may revoke unconditionally, and the round that made them **take** the entry out
 * and put it back closed the spend while opening a different hole with the same
 * operation: {@link prepareRestore} treats absence from the map as permission to register
 * another question, so a getter reached during the inspection could build a successor
 * session and file a second live authorization under it while the first was still going
 * to be restored. Both could then confirm, and both permits could send.
 *
 * So the entry never leaves; it is replaced by one of these. A caller cannot name this
 * type, cannot reach an instance and cannot forge one: {@link confirmRestore} refuses it,
 * {@link takeTheQuestion} refuses it, and {@link prepareRestore}'s bare `has` sees the
 * existing question it is. The permit comes back only if this very cell is still present.
 */
interface SuspendedQuestion {
  /** The authorization this cell stands in for, to be put back or dropped. */
  readonly permit: RestorePermit;
}

/**
 * Every suspension cell this module has minted.
 *
 * A `WeakSet` rather than a field test or an `instanceof`, for {@link PENDING_AUTHORIZATIONS}'s
 * own reason: telling a suspension from a permit is then a bare reference operation that
 * reads no property, runs no user code and cannot be answered by anything a caller
 * assembled. Nothing outside this module can obtain a member to put in it.
 */
const SUSPENSIONS = new WeakSet<object>();

/**
 * Whether one entry of {@link PENDING_AUTHORIZATIONS} is a suspension and not a permit.
 *
 * @param held - Whatever the map answered.
 * @returns `true` when the question is suspended, so nothing may be spent or carried.
 */
function isSuspended(held: RestorePermit | SuspendedQuestion): held is SuspendedQuestion {
  return SUSPENSIONS.has(held);
} // End of function isSuspended()

/**
 * Suspends whatever question one session carries, for the length of one call.
 *
 * **The replacement is atomic in the sense that matters**: a `get`, a `has` on a private
 * `WeakSet`, an object literal, an `add` and a `set` are all operations that run no user
 * code, so there is no instant at which the session looks unasked. What a re-entrant
 * caller sees throughout is a question it may not spend, may not carry and may not
 * duplicate — rather than the nothing a take-and-put-back showed it.
 *
 * **An already suspended question is not suspended again.** The outer call stays the one
 * owner of the cell; a second marker would leave two calls each believing they hold the
 * permit, which is the shape this mechanism exists to refuse. A nested transition that
 * withdraws still deletes the cell, and that decision stands.
 *
 * @param session - The session to hold the question of.
 * @returns The cell this call now owns, or `undefined` when there was no question to
 *   suspend or another call already holds it.
 */
function suspendTheQuestion(session: RestoreSession): SuspendedQuestion | undefined {
  const held = PENDING_AUTHORIZATIONS.get(session);
  if (held === undefined || isSuspended(held)) {
    return undefined;
  }
  const suspension: SuspendedQuestion = { permit: held };
  SUSPENSIONS.add(suspension);
  PENDING_AUTHORIZATIONS.set(session, suspension);
  return suspension;
} // End of function suspendTheQuestion()

/**
 * Ends a suspension {@link suspendTheQuestion} started, putting its permit back.
 *
 * **Only if this call's own cell is still there.** Anything that ran while the question
 * was suspended and left something else under the session — a revocation, most of all —
 * has already decided what that session authorizes, and putting a permit back over it
 * would be this module answering a question that was taken back. A deleted cell stays
 * deleted, and this is where "do not resurrect" is written.
 *
 * **Called from a `finally`**, so a getter that throws in the middle of an inspection
 * cannot strand a session suspended, where it could be neither confirmed nor asked
 * again. A throw is not a decision, so the state it leaves is the one it found.
 *
 * @param session - The session the question was suspended on.
 * @param suspension - What {@link suspendTheQuestion} answered.
 */
function restoreTheQuestion(
  session: RestoreSession,
  suspension: SuspendedQuestion | undefined
): void {
  if (suspension !== undefined && PENDING_AUTHORIZATIONS.get(session) === suspension) {
    PENDING_AUTHORIZATIONS.set(session, suspension.permit);
  }
} // End of function restoreTheQuestion()

/**
 * What an inspection answers when it decided to change nothing.
 *
 * **The presentation still follows the authorization**, which is this module's rule and
 * is the one thing a suspension could otherwise cost. Ordinarily the argument comes back
 * by reference, question and all — that identity is what makes `RestorePane.svelte`'s
 * `$effect` over {@link targetRevisionObserved} converge, and it is the whole point of
 * the Low this closes: a response about another entry withdraws nothing. But a getter
 * this inspection ran may itself have **withdrawn** the question, and that decision
 * stands; answering the argument unchanged there would leave a screen drawing a
 * confirmation whose control does nothing.
 *
 * The map is consulted rather than `session.pending`, because the map is the authority
 * and asking it reads no property.
 *
 * **`undefined` does not excuse this call from asking**, and that is the third
 * confirmation review's Low. It means only that this call does not *own* a cell —
 * either there was no question, or an outer inspection owns it — and neither of those
 * says anything is still authorized. A nested inspection whose own getter reached
 * {@link revokeConfirmation} deletes the outer call's cell, and returning the argument
 * by reference then leaves a retained session presenting a question the map no longer
 * holds. So that branch tests bare **presence**: something is there — this call's
 * caller's suspension, most of all — and the argument is its owner's state to answer
 * with; nothing is there, and the copy presenting none is what may be handed back.
 *
 * **Presence is not identity here, deliberately.** A suspension owned by an outer call
 * is the one thing that may be present and not this call's, and it is exactly the thing
 * that must count: the outer call's own `finally` and its own `unchangedByInspection`
 * decide what happens to it, and a nested call correcting that would be answering a
 * question it does not hold.
 *
 * @param session - The session being inspected.
 * @param suspension - What {@link suspendTheQuestion} answered.
 * @returns The same session, or a copy presenting nothing when the question went.
 */
function unchangedByInspection(
  session: RestoreSession,
  suspension: SuspendedQuestion | undefined
): RestoreSession {
  if (suspension === undefined) {
    // **Bare presence, not identity**, and the difference is a nested inspection. This
    // call holds nothing either because there was no question or because an outer
    // inspection owns the cell; in the second case a getter *this* call ran may have
    // withdrawn that outer cell, and the map is then empty while the argument still
    // presents a question. Answering it by reference there hands back a confirmation
    // control that can do nothing — the third confirmation review's Low.
    return PENDING_AUTHORIZATIONS.has(session) ? session : withNothingPending(session);
  }
  return PENDING_AUTHORIZATIONS.get(session) === suspension
    ? session
    : withNothingPending(session);
} // End of function unchangedByInspection()

/**
 * Revokes whatever authorization one session still carries.
 *
 * **The one place a withdrawal becomes a revocation**, so consult Q5's rule — that
 * navigation, a selection change, a catalogue refresh, a candidate change and a
 * cancellation all withdraw the confirmation — is a statement about authorization
 * rather than about what a screen draws. Before 2c-5-4b every withdrawing transition
 * only wrote `pending: null` into the session it *returned*, and a caller holding the
 * one it passed in could still confirm.
 *
 * **It reads no property of its argument, and that is the whole point of the key.**
 * The fix round's version opened with `session.pending` to name what to delete, which
 * is a caller-controlled read: a getter installed there could call
 * {@link confirmRestore} on the retained session, move the authorization into
 * {@link PERMITS}, and leave this deletion with nothing to revoke and a live permit it
 * cannot reach. `WeakMap.delete` on the session runs no user code, so there is no
 * instant between deciding to revoke and having revoked.
 *
 * **The deletion's result is deliberately not read, and that is not this phase's
 * recurring defect.** A discarded consuming operation is a defect when its success is
 * what authorizes something; nothing is minted from a revocation, so there is nothing
 * a re-entrant caller could spend twice, and a second revocation of the same question
 * is the same state as the first.
 *
 * **It revokes a {@link SuspendedQuestion} as readily as a permit, and that is the
 * direction the two mechanisms must resolve in.** A withdrawal reached from inside an
 * inspection is a decision about this session; {@link restoreTheQuestion} then finds its
 * cell gone and puts nothing back, so the question stays revoked. The opposite rule —
 * an inspection restoring over a withdrawal — would be this module answering a question
 * somebody took away.
 *
 * @param session - The session whose question is being taken back.
 */
function revokeConfirmation(session: RestoreSession): void {
  PENDING_AUTHORIZATIONS.delete(session);
} // End of function revokeConfirmation()

/**
 * Moves one session's authorization to the session that replaces it.
 *
 * **For the transitions that change nothing a confirmation binds**: a listing landing,
 * an outcome being put away, a send that reached no command, and the two steps of a
 * reload's warning. Each of those returns a *new* session while keeping the question,
 * so with the authorization keyed by the session it would otherwise be stranded on the
 * object the caller has just replaced — a question drawn on screen that confirms
 * nothing. That is the safe direction and it is still a defect.
 *
 * **It moves rather than copies.** A checked deletion from the old key is the
 * membership test, so one question can never be answerable from two session objects at
 * once, and a caller retaining the pre-transition session cannot confirm it.
 *
 * **Every operation here is a bare `WeakMap` call on an object key**, so no user code
 * runs between the read and the deletion that authorizes the move. The one
 * caller-controlled thing on this path is building `to`, and that happens at the call
 * site **before** this function is entered — deliberately, because a getter that
 * re-entered and confirmed during the spread leaves nothing under `from` and therefore
 * carries nothing, while reading `from` first and setting `to` afterwards would install
 * a second live authorization for a question that had just been spent.
 *
 * @param from - The session the question was asked on.
 * @param to - The session that replaces it, already built.
 * @returns `to`, unchanged.
 */
function carryTheQuestion(from: RestoreSession, to: RestoreSession): RestoreSession {
  const held = takeTheQuestion(from);
  if (held !== undefined) {
    PENDING_AUTHORIZATIONS.set(to, held);
    return to;
  }
  // Nothing to carry: either no question was pending, or something answered it while
  // `to` was being built. Presenting one either way would draw a control that does
  // nothing, so the presentation follows the authorization here as it does everywhere
  // else in this module.
  return withNothingPending(to);
} // End of function carryTheQuestion()

/**
 * Takes one session's authorization out of the map, to be dropped or put back.
 *
 * **A checked deletion, so it is a claim rather than a copy.** Success means this call
 * — and no re-entrant one — now holds the only reference to that authorization, so
 * while the caller does whatever reading it has to do there is nothing for anybody
 * else to spend. Three bare `WeakMap` and `WeakSet` operations on an object key, with
 * no user code between them.
 *
 * **A suspended question is not takeable**, and that is not a technicality: another
 * call holds that permit and will put it back under the session it is on, so moving it
 * to a second session here would end with one question live in two places — the exact
 * shape {@link SuspendedQuestion} exists to refuse. {@link carryTheQuestion} therefore
 * carries nothing when it is re-entered from inside an inspection, which is the
 * conservative direction: the successor presents no question, and the one that was
 * asked stays where the person is looking at it.
 *
 * @param session - The session to take the question off.
 * @returns The authorization this call now holds, or `undefined` when there was none or
 *   it is suspended.
 */
function takeTheQuestion(session: RestoreSession): RestorePermit | undefined {
  const held = PENDING_AUTHORIZATIONS.get(session);
  if (held === undefined || isSuspended(held)) {
    return undefined;
  }
  return PENDING_AUTHORIZATIONS.delete(session) ? held : undefined;
} // End of function takeTheQuestion()

/**
 * The session with no question **presented**, for the arms that revoked one anyway.
 *
 * **The presentation following the authorization.** Answering the argument unchanged
 * where the map holds no question for it would leave `pending` describing a question
 * that authorizes nothing — the one direction in which the two halves may not
 * disagree, because a screen would go on drawing a confirmation whose control does
 * nothing.
 *
 * The reference is answered unchanged when there was nothing to clear, which the
 * frozen-transition cases assert by identity.
 *
 * **The precondition is that no authorization is reachable under the key this session
 * will be presented as** — never the narrower "call it only after
 * {@link revokeConfirmation}", which an earlier version of this comment claimed and
 * which {@link carryTheQuestion} does not satisfy. It reads `session.pending`, and that
 * read is safe because a getter reached by it has nothing to spend. Three call families
 * establish that, by three different routes, and they are deliberately not numbered
 * here — a count is the kind of claim that rots as callers are added:
 *
 * - the **revoke-first** transitions, including their frozen branches, have already
 *   removed the entry through {@link revokeConfirmation};
 * - {@link unchangedByInspection} has established that the map holds nothing this call
 *   may present — either its own suspension is gone, which means something revoked, or,
 *   with no cell of its own, the map is empty under this session;
 * - {@link carryTheQuestion} passes a **fresh successor** after {@link takeTheQuestion}
 *   found nothing transferable, so no revocation has occurred and none is needed: the
 *   key it hands over is new and no authorization was ever filed under it.
 *
 * @param session - A session with no authorization reachable under its key.
 * @returns The same session when it presented none, or a copy presenting none.
 */
function withNothingPending(session: RestoreSession): RestoreSession {
  return session.pending === null ? session : { ...session, pending: null };
} // End of function withNothingPending()

/**
 * What one send is carrying, frozen at the moment it was confirmed.
 *
 * **The answer is classified against this and never against what the session is
 * showing when it lands** (2c-5-3's review, M1). The preview is the one the
 * confirmation was given over: a preview that had been *replaced* would describe an
 * answer for candidate A against candidate B, and a preview that had been *removed*
 * would strand a seal the file has already committed. Nothing here can be changed
 * while it exists, because every transition that could change it answers its
 * argument unchanged while {@link RestoreSession.phase} is `saving`.
 */
export interface SubmittedRestore {
  /** Exactly what was sent: the candidate, its base revision and its consent. */
  readonly submission: DraftSubmission<string>;
  /** The retained candidate the submission was taken from. */
  readonly preview: RestorePreview;
}

/**
 * One restore, as a value.
 *
 * **A value with pure transitions, never a store**: a component holds one in a
 * `$state.raw` and reassigns it, and every function below returns a new session
 * without touching its argument.
 *
 * **While `phase` is `saving`, and after a committed restore, the catalogue, the
 * selection, the candidate and the base revision are frozen**: every transition
 * that would change one of them answers its own argument unchanged. That is what
 * makes `browser.restore.refused.inFlight` — *nothing can be changed here until the
 * file answers* — a property of this model rather than a promise on a screen.
 */
export interface RestoreSession {
  /** The file this restore would replace. */
  readonly target: DocumentId;
  /**
   * The revision that file is expected to hold.
   *
   * **Captured when this session opened and moved only at a boundary** — a
   * committed save, or a confirmed adoption of a conflict's disk observation. It
   * is never re-read just before sending: consult Q1 item 3, and it is the only
   * thing standing between a restore and silently overwriting whatever changed the
   * file since. It is **not** the candidate's revision and not anything derived
   * from a batch name.
   */
  readonly baseRevision: ContentRevision;
  /** Whether the projection says this application must refuse to write the file. */
  readonly readOnly: boolean;
  /** What the batch catalogue has answered. */
  readonly batches: CatalogueState<BackupBatchListing>;
  /** The batch whose entries are being listed, or `null`. */
  readonly batch: BackupBatchId | null;
  /** What the entry catalogue has answered for that batch. */
  readonly entries: CatalogueState<BackupEntryListing>;
  /** The entry whose text was asked for, or `null`. */
  readonly entry: BackupEntryId | null;
  /** The retained candidate, or `null` when none has been read. */
  readonly preview: RestorePreview | null;
  /**
   * Which preview this is, counting from zero.
   *
   * **Bumped by every change to anything a confirmation binds**, through the one
   * private helper every such transition goes through. It is what stops a
   * confirmation being spent against a *re-selection*: choosing the same entry again
   * after a catalogue refresh produces the same document, base revision, entry
   * identity and candidate hash, and this is the only one of the five that moves.
   * It is **not** what makes a confirmation one-shot — that is
   * {@link confirmRestore}'s checked deletion from {@link PENDING_AUTHORIZATIONS},
   * and no value on a session can do it.
   */
  readonly previewGeneration: number;
  /**
   * The question this session **presents** as pending, or `null`. Only membership of
   * the session in {@link PENDING_AUTHORIZATIONS} says whether it still authorizes
   * anything.
   *
   * **Setting this to `null` is presentation, not a spend and not a revocation.** What
   * records that the question has been answered, or taken back, is
   * {@link PENDING_AUTHORIZATIONS}, because every field on the value compares equal
   * across copies of it — and because every transition here returns a *new* session
   * and cannot reach into the one the caller retained, a session held across a
   * successful confirmation, or across any withdrawal, still presents the very
   * question whose entry has gone.
   *
   * **The two agree on every session this module answers**, and that is an obligation
   * on each transition rather than a property of this field: a transition either
   * revokes and writes `null` here, or carries the entry to the session it returns.
   * Nothing in TypeScript forces it and `restore.test.ts` drives every transition to
   * check it.
   */
  readonly pending: PendingRestore | null;
  /** Whether a replacement is in flight. */
  readonly phase: EditorPhase;
  /** What the last attempt sent, or `null`. Kept so a refusal can be consented to. */
  readonly submitted: DraftSubmission<string> | null;
  /**
   * What the attempt now in flight is carrying, or `null`.
   *
   * Set by {@link confirmRestore} and cleared by {@link applyRestore}, which reads
   * the answer against it rather than against the session's own preview.
   */
  readonly inFlight: SubmittedRestore | null;
  /** How the last attempt ended, as the thing a screen draws, or `null`. */
  readonly outcome: SaveOutcomeModel<string> | null;
  /**
   * Lines to show **beside** the outcome rather than in place of it.
   *
   * Today exactly one can appear: a committed replacement this window could not
   * bring back into step. The bytes are on disk and stay there (`PROGRESS.md` D2).
   */
  readonly extraMessages: readonly SaveOutcomeMessage[];
  /** How the last attempt failed to produce an outcome at all, or `null`. */
  readonly sendFailure: SendFailure | null;
  /**
   * How far a confirmed reload of the disk version has got.
   *
   * **Reset to `idle` by every new outcome, by every dismissal and by every
   * replacing verdict** ({@link applyRestoreObservation}, the 2d-6 record's §3
   * entry 12), which is what stops a confirmation collected for one conflict
   * being spendable while a later one is on screen.
   */
  readonly reload: ReloadStep;
  /**
   * Whether a replacement has committed through this session.
   *
   * Set by a committed save and cleared by **nothing**. Every identity this window
   * holds for that file is stale afterwards, so the session stops offering to
   * restore and only a fresh one can. **`committed: false` does not set it**: a
   * candidate byte-identical to what the file already held is a documented success
   * in which nothing was written, so nothing became stale and nothing was carried
   * out.
   */
  readonly restored: boolean;
  /**
   * The conflict a watcher observation raised over the destination, or `null` —
   * Phase 2d-6-5, the 2d-6 record's §3 entry 6.
   *
   * **A field of its own beside {@link RestoreSession.outcome}, never an arm of
   * it**, for `MatchEditorSession.externalConflict`'s reason: an outcome is how
   * *a replacement* ended, and a conflict the watcher raised is not that.
   * {@link conflictOf} is the one accessor that reads both and answers the
   * conflict this session is showing, whichever origin it has. **Only one
   * conflict is active at a time, and the transitions are what keep it so**
   * (entry 7): {@link applyRestoreObservation} retires a save conflict's outcome
   * when it sets this, and {@link applyRestore} retires this when a replacement
   * ends as a conflict or a success. The type admits both populated, and a
   * session built by hand with both gets {@link conflictOf}'s stated precedence,
   * not a guarantee.
   *
   * **Its `draft` is the retained candidate's draft as it stood when the
   * conflict was raised, and a draft of the empty string at the session's base
   * revision when no candidate was retained** — a placeholder the model's type
   * requires and never a candidate — **and over that placeholder its `messages`
   * are the file's own line alone**, never the two that say a candidate is kept
   * and that a reload keeps it (`overNoCandidate`; this phase's review, its
   * fourth finding). What a screen draws the candidate from is
   * {@link RestoreView.preview}; this surface offers no copy
   * (`offersCopyDraft: false`), the reload re-points the *session's* candidate
   * and never reads this draft, `supersedeConflict` carries it as history
   * exactly as the save arm's is carried, and {@link RestoreView.conflictOperation}
   * names no operation over it. Nothing in TypeScript stops a renderer
   * reading it as the candidate, and this sentence is what says it must not.
   *
   * While it is non-null nothing can be prepared, confirmed or sent
   * ({@link restoreRefusal}'s `externalConflict` arm) and any pending question
   * has been withdrawn (entry 12); {@link dismissRestoreOutcome} does not clear
   * it (entry 9). The way out is the reload, which keeps the candidate and moves
   * the base revision to the observation's disk revision.
   */
  readonly externalConflict: ExternalConflictModel<string> | null;
  /**
   * Whether {@link RestoreSession.externalConflict} was raised while a write of
   * this window's own had an unknown outcome, and this session has not been told
   * the hold ended — Phase 2d-6-5, entry 11's `raisedWithoutReload` row.
   *
   * While `true` the reload is withheld, for the match editor's reason: a
   * confirmed re-targeting onto bytes a write of this window may or may not have
   * produced would settle, silently, a question only the person can. It ends
   * when {@link acknowledgeRestoreSnapshot} is told the window ended the hold, or
   * when a later verdict replaces the conflict under no uncertainty. **It records
   * what this session was told and nothing more**: a hold the window ends by a
   * later definite write delivers nothing to a session, and this flag cannot see
   * it. This module never sets it without a conflict, so the doors are blocked
   * by the conflict it qualifies.
   */
  readonly uncertaintyUnresolved: boolean;
  /**
   * The observations this session was told the window is holding and has not
   * decided about, keyed by the file each is about — Phase 2d-6-5, entry 11's
   * `retained` row, in the shape the other seven sessions share.
   *
   * **A restriction on preparing, confirming and sending, and nothing else**:
   * while the destination has an entry, {@link restoreRefusal} answers
   * `observationRetained`, so {@link prepareRestore} answers the same session,
   * {@link confirmRestore} answers `null` and {@link sendRestore} consumes its
   * permit unspent (entry 8); the catalogue, the selection and the candidate
   * stay free to change, because a wait is a restriction on sending and freezing
   * them for a decision the window has not made would claim more than the fact
   * supports. No disk comparison and no origin is recorded. An entry is lifted
   * by the delivery that decides **that** observation, whatever the verdict —
   * `writtenHere` included — compared by identity, and replaced by a later
   * `retained` about the same file. **A pending question survives a wait**: it
   * changes nothing the confirmation binds, so the receiver carries it and the
   * doors are what refuse until the wait lifts.
   *
   * **What the map forces and what it does not, in the same sentence.** It
   * forces that a wait is always keyed by the file it is about and that only the
   * destination's wait blocks; through this module's own transitions it holds
   * at most that one entry, because a `retained` about another file records
   * nothing here — the map is the shape the sessions share since 2d-6-3's
   * review, so the field reads alike on every surface, not a claim that a
   * restore can change its destination. It cannot force that the deciding
   * delivery arrives — a session whose receiver was unregistered before the
   * window decided is never told and stays blocked until closed — nor that a
   * wait it was *not* told of, because no receiver was registered when the
   * window held the reading, is recorded at all; both are facts about
   * registration (wired since Phase 2d-6-8a, `DetailPane.svelte`), not about this
   * session. What it cannot see is a reading the barrier
   * coalesced away without announcing it.
   */
  readonly awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>;
  /**
   * Every delivery that arrived while this session's own replacement was in
   * flight, in the order it arrived, kept until that replacement's answer has
   * been applied — Phase 2d-6-5, the 2d-6 record's §3 entry 5.
   *
   * `MatchEditorSession.heldDeliveries`'s rule, unchanged: the window publishes a
   * write's settlement from inside the writing wrapper, before the `await` that
   * started it resumes, so {@link applyRestoreObservation} appends here while the
   * phase is `saving` and {@link applyRestore}, {@link restoreCouldNotBeSent} and
   * {@link restoreConfirmationWithdrawn} replay the whole list through it, first
   * to last, after their own answer — and, given a {@link ReadTheInstalledSession},
   * whatever the receiver appended to the installed session while they were
   * doing so. **A held envelope also blocks the final permit**: a session in
   * `saving` with anything here has been told of a decision about its
   * destination it has not applied, and {@link permitHolds} refuses to send past
   * it. **What the list forces** is that no envelope delivered during the
   * replacement is dropped and that first-to-last is the order; **what it does
   * not force** is that arrival order was decision order — the window's own
   * contract — nor that the required reader is honest: `BrowserState.restoreDocument`
   * settles the confirmation's own session and passes the reader its caller handed
   * it, and nothing in TypeScript stops a caller handing a capture and a reader that
   * answers the capture.
   */
  readonly heldDeliveries: readonly ObservationDelivery[];
}

/**
 * What this surface offers about a conflict.
 *
 * **`operationChoice`, and that is a statement about what the candidate is.**
 * Nobody typed it: it is the exact text **read from** a backup entry and retained
 * here, so *your text is still here* would describe something the person never
 * produced and a clipboard has nothing to rescue. Nothing here claims anything about
 * what that entry holds **now** — the catalogue is untrusted and mutable, the entry
 * is deliberately read once and never revalidated at send time, and this model
 * cannot know that it still exists. `conflictChoicesFor` refuses *Copy draft* for
 * this draft kind as a property of the value rather than as an opinion of this
 * declaration, which is why {@link ConflictCapabilities} `offersCopyDraft` is `false`
 * here and would change nothing if it were not.
 *
 * **`retargetsCandidate` is restore's own reload outcome**, added to
 * `./saveOutcome.ts` at 2c-5-3 because both existing arms would have been false:
 * the raw editor's replaces a draft that does not exist here, and the five match
 * surfaces' closes a panel that has a candidate it can keep. What a confirmed
 * reload does here is install the disk observation, keep the candidate, move the
 * base revision to the conflict's `diskRevision`, and withdraw the confirmation —
 * {@link reloadTheDiskVersion} is the transition and its own note is the record.
 *
 * **`offersReload` is `true` as of 2c-5-4b, and flipping one boolean is all it
 * took** — the trade 2c-4a-2 made and 2c-4a-3a collected on, collected again here.
 * The transition, its warning step, its refused step and its retargeting of the
 * candidate were all built at 2c-5-3 and driven by this module's suite while no
 * control existed; the step that drew the panel invented no machinery, and
 * `conflictChoicesFor` now names `reloadDiskVersion` before the warning and
 * `confirmReload` after it. What no boolean here can force is that
 * `RestorePane.svelte` acts on either label; its mounted suite presses both.
 *
 * **`reapplySupport` is `unavailable` permanently**, for the raw editor's reason
 * (consult Q4 of 2c-4b): the candidate is a whole document, so there is no target,
 * no field intent and no operation to re-resolve against a newly parsed file, and
 * "reapply" could only mean overwriting the newly read disk text with a stale
 * string or inventing a text merge. Since Phase 2d-6-5 {@link reapplyToDiskVersion}
 * says so as a value, for a conflict of either origin.
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'operationChoice',
  reloadOutcome: 'retargetsCandidate',
  offersCopyDraft: false,
  offersReload: true,
  offersReapply: false,
  reapplySupport: 'unavailable'
};

/**
 * The two things this session has to ask the **window** about.
 *
 * **They travel together because they are asked together.** Every gate below —
 * whether a restore may be prepared, what the screen draws about it, and whether a
 * confirmation may produce a submission — asks both, and a signature that let a
 * caller supply one without the other would let a control be drawn against a rule
 * it did not ask about. Both are required and neither is defaulted: a default would
 * be this module inventing an answer for a caller that did not look.
 */
export interface RestoreContext {
  /**
   * The revision the projection this window holds **now** gives the destination.
   *
   * From {@link revisionInProjection}, and `null` when this window holds no
   * projection of the file. It is the only value in this whole model that comes
   * from outside the session, so it is the only one that can notice that the window
   * has moved.
   */
  readonly observed: ContentRevision | null;
  /** Every write surface this window has open, in any order. */
  readonly surfaces: readonly OpenWriteSurface[];
}

/**
 * The revision the projections handed in give one file **now**.
 *
 * **This exists to be {@link confirmRestore}'s second argument**, and it is the one
 * place in this application that reads it. The module header says that a caller
 * which hands back `session.baseRevision` defeats the whole confirmation and that
 * no type can say where an argument came from; this function is what a caller uses
 * *instead*, so "read it from the live projection" is a call somebody can search
 * for rather than an instruction in a comment. It is `identityInProjection` in
 * `./matchDeletion.ts` over a document rather than a snippet.
 *
 * @param views - Every projection this window holds **now**, in any order.
 * @param document - The file to ask about.
 * @returns The revision that projection is of, or `null` when this window holds no
 *   projection of the file.
 */
export function revisionInProjection(
  views: readonly DocumentView[],
  document: DocumentId
): ContentRevision | null {
  return views.find((view) => view.id === document)?.revision ?? null;
} // End of function revisionInProjection()

/**
 * Opens a restore over one file.
 *
 * The base revision is the **projection's**, captured here and moved only at a
 * boundary. The read-only verdict is captured with it, for the same reason every
 * eligibility in this directory is: it is an affordance derived from current state
 * and never authorization — if this projection and the file disagree, the
 * transaction refuses and that refusal is what reaches the screen.
 *
 * @param document - The file's projection, exactly as this window holds it.
 * @returns A session with no catalogue read, no candidate and nothing said.
 */
export function startRestore(document: DocumentView): RestoreSession {
  return {
    target: document.id,
    baseRevision: document.revision,
    readOnly: document.read_only,
    batches: NOTHING_ASKED,
    batch: null,
    entries: NOTHING_ASKED,
    entry: null,
    preview: null,
    previewGeneration: 0,
    pending: null,
    phase: 'editing',
    submitted: null,
    inFlight: null,
    outcome: null,
    extraMessages: [],
    sendFailure: null,
    reload: NOT_RELOADING,
    restored: false,
    externalConflict: null,
    uncertaintyUnresolved: false,
    awaitingReconciliation: new Map(),
    heldDeliveries: []
  };
} // End of function startRestore()

/**
 * The wait that restricts this session **now**, or `null` — the destination's
 * entry of {@link RestoreSession.awaitingReconciliation}.
 *
 * @param session - The session to ask about.
 * @returns The observation the session is waiting on, or `null`.
 */
function awaitedFor(session: RestoreSession): ExternalConflictObservation | null {
  return session.awaitingReconciliation.get(session.target) ?? null;
} // End of function awaitedFor()

/**
 * The waits with one file's entry replaced.
 *
 * @param waits - The waits held.
 * @param document - The file the observation is about.
 * @param observation - The observation now held for it.
 * @returns A new map; the argument is untouched.
 */
function withWait(
  waits: ReadonlyMap<DocumentId, ExternalConflictObservation>,
  document: DocumentId,
  observation: ExternalConflictObservation
): ReadonlyMap<DocumentId, ExternalConflictObservation> {
  const next = new Map(waits);
  next.set(document, observation);
  return next;
} // End of function withWait()

/**
 * The waits with one file's entry removed.
 *
 * @param waits - The waits held.
 * @param document - The file whose wait ended.
 * @returns A new map; the argument is untouched.
 */
function withoutWait(
  waits: ReadonlyMap<DocumentId, ExternalConflictObservation>,
  document: DocumentId
): ReadonlyMap<DocumentId, ExternalConflictObservation> {
  const next = new Map(waits);
  next.delete(document);
  return next;
} // End of function withoutWait()

/**
 * Whether the catalogue, the selection, the candidate and the base revision are
 * frozen — so a transition over any of them must answer its argument unchanged.
 *
 * **Two states freeze them, and the shipped sentences are why.**
 * `browser.restore.refused.inFlight` says *nothing can be changed here until the
 * file answers*, and `browser.restore.refused.alreadyRestored` says nothing more can
 * be replaced from this panel; both were sentences the model did not keep until
 * 2c-5-3's review found it (M1). A send in flight is the sharper of the two: a
 * selection that moved under it would leave {@link applyRestore} classifying an
 * answer for one candidate against another, and this is the guard that makes the
 * frozen {@link RestoreSession.inFlight} record agree with what the session shows
 * rather than merely survive it.
 *
 * **It is not what authorizes anything.** {@link sendRestore} rechecks every bound
 * value at the moment of the send whatever this answers, because a caller can hand
 * this module any session it likes.
 *
 * @param session - The session to ask about.
 * @returns `true` when every such transition must be a no-op.
 */
function frozen(session: RestoreSession): boolean {
  return session.phase === 'saving' || session.restored;
} // End of function frozen()

/**
 * The session with everything a confirmation binds withdrawn.
 *
 * **The one place withdrawal happens**, so consult Q4's rule — *changing the batch,
 * entry, target, candidate or observed target revision withdraws confirmation and
 * acknowledgement* — is one rule rather than one per transition. It **revokes** the
 * pending question's authorization, drops the question from the session, withdraws
 * whatever consent the draft had collected, and bumps
 * {@link RestoreSession.previewGeneration} so a confirmation whose other four values
 * happen to be reproducible is still refused.
 *
 * **{@link revokeConfirmation} is its first statement, and the second argument is a
 * word rather than a preview for that reason.** Every caller used to pass either
 * `session.preview` or `null`, and evaluating `session.preview` at the call site is a
 * caller-controlled property read *before* the revocation — a getter reached there
 * could confirm the very question this transition exists to take back. Which of the
 * two a caller wants is now said in a literal, and the read that follows from it
 * happens on the far side of the revocation. Since the confirmation round the
 * revocation reads no property either, so "first" is true of the whole operation and
 * not only of its position.
 *
 * **What each caller still owes**, because this function cannot see it: the arms that
 * answer their own argument unchanged — the {@link frozen} guards — must not reach
 * here at all, and they do not.
 *
 * The consent goes through `retargetedDraft` at the draft's existing base revision,
 * which is `withdrawnConsent` — findings accepted for one transaction say nothing
 * about the next.
 *
 * @param session - The session to withdraw from.
 * @param candidate - `'kept'` to carry this session's own preview through, which is
 *   right when nothing about the candidate changed, and `'dropped'` to leave none.
 * @returns The session with nothing pending, nothing authorized and no consent.
 */
function withdrawn(session: RestoreSession, candidate: 'kept' | 'dropped'): RestoreSession {
  revokeConfirmation(session);
  const preview = candidate === 'kept' ? session.preview : null;
  const carried =
    preview === null
      ? null
      : { ...preview, draft: retargetedDraft(preview.draft, preview.draft.baseRevision) };
  return {
    ...session,
    preview: carried,
    previewGeneration: session.previewGeneration + 1,
    pending: null
  };
} // End of function withdrawn()

/**
 * The session withdrawn and measured against one revision.
 *
 * **The one place the base revision moves for a reason that is not a save**, so the
 * two callers — a reprojection this window observed, and a conflict's disk
 * observation this window adopted — cannot do it differently. The candidate is
 * carried untouched: it is a backup entry's bytes and has nothing to do with what
 * the destination holds; what moves is the revision it would be written against.
 *
 * @param session - The session to re-point.
 * @param revision - The revision it is now measured against.
 * @returns The session at that revision, with nothing pending and no consent.
 */
function measuredAgainst(session: RestoreSession, revision: ContentRevision): RestoreSession {
  const cleared = withdrawn(session, 'kept');
  const preview = cleared.preview;
  return {
    ...cleared,
    baseRevision: revision,
    preview:
      preview === null
        ? null
        : { ...preview, draft: retargetedDraft(preview.draft, revision) }
  };
} // End of function measuredAgainst()

/**
 * Records that a read of the batch catalogue has started.
 *
 * **A catalogue refresh withdraws the confirmation** (consult Q5): the person is
 * about to be shown a different list, and consent given while another one was on
 * screen is consent to a question that is being asked again.
 *
 * @param session - The session.
 * @returns The session with the batch catalogue loading and nothing pending, or the
 *   same session while it is {@link frozen}.
 */
export function loadingBatches(session: RestoreSession): RestoreSession {
  // **Before {@link frozen}, not after it.** That guard reads `session.phase`, which
  // is a caller-controlled property read — so with the revocation left to
  // {@link withdrawn} a getter there answered the question from inside this
  // transition. Seven transitions had that shape and each of them opens this way now.
  revokeConfirmation(session);
  return frozen(session)
    ? withNothingPending(session)
    : { ...withdrawn(session, 'kept'), batches: { kind: 'loading' } };
} // End of function loadingBatches()

/**
 * Takes the batch catalogue's answer.
 *
 * The listing is stored exactly as it arrived, completeness counts included:
 * *"there are no backups"* is a sentence `BackupBatchListing.complete` licenses and
 * an empty `batches` does not, and deciding that here would put the rule in two
 * places.
 *
 * **An answer that lands while the session is {@link frozen} is dropped**, and the
 * catalogue keeps whatever state it was in. That is the cost of the immutability
 * `browser.restore.refused.inFlight` promises: the person asks for the listing again
 * once the file has answered.
 *
 * **A listing changes nothing a confirmation binds**, so a question pending over one
 * is carried rather than revoked — through {@link carryTheQuestion}, because the
 * authorization is keyed by the session and this one is new.
 *
 * @param session - The session waiting for an answer.
 * @param answer - What `listBackupBatches` in `../ipc/commands` answered.
 * @returns The session showing the listing or the refusal, or the same session while
 *   it is frozen.
 */
export function batchesLoaded(
  session: RestoreSession,
  answer: CommandResult<BackupBatchListing>
): RestoreSession {
  if (frozen(session)) {
    return session;
  }
  return carryTheQuestion(session, {
    ...session,
    batches: answer.ok
      ? { kind: 'loaded', listing: answer.value }
      : { kind: 'failed', failure: answer.failure }
  });
} // End of function batchesLoaded()

/**
 * Chooses which batch's entries to list.
 *
 * Everything downstream of the batch goes: the entry catalogue, the chosen entry
 * and the retained candidate are all statements about the batch being replaced.
 *
 * @param session - The session.
 * @param batch - The opaque identity a listing produced. Handed back unchanged; it
 *   is not authority, and the command re-resolves it.
 * @returns The session over that batch, with nothing pending, or the same session
 *   while it is {@link frozen}.
 */
export function chooseBatch(session: RestoreSession, batch: BackupBatchId): RestoreSession {
  // Before {@link frozen} reads the phase, for `loadingBatches`'s reason.
  revokeConfirmation(session);
  if (frozen(session)) {
    return withNothingPending(session);
  }
  return {
    ...withdrawn(session, 'dropped'),
    batch,
    entries: NOTHING_ASKED,
    entry: null
  };
} // End of function chooseBatch()

/**
 * Records that a read of one batch's entries has started.
 *
 * @param session - The session.
 * @returns The session with the entry catalogue loading and nothing pending, or the
 *   same session while it is {@link frozen}.
 */
export function loadingEntries(session: RestoreSession): RestoreSession {
  // Before {@link frozen} reads the phase, for `loadingBatches`'s reason.
  revokeConfirmation(session);
  return frozen(session)
    ? withNothingPending(session)
    : { ...withdrawn(session, 'kept'), entries: { kind: 'loading' } };
} // End of function loadingEntries()

/**
 * Takes one batch's entry listing.
 *
 * **An answer about another batch is ignored**, because a listing is only about the
 * batch it was asked for and installing one under a different batch's name would
 * offer entries that do not belong to it. A caller whose selection moved while the
 * read was in flight therefore gets its session back unchanged.
 *
 * **An answer that lands while the session is {@link frozen} is dropped too**, for
 * `batchesLoaded`'s reason — and a question pending over it is carried for
 * `batchesLoaded`'s reason as well.
 *
 * @param session - The session waiting for an answer.
 * @param answer - What `listBackupEntries` in `../ipc/commands` answered.
 * @returns The session showing the listing or the refusal, or the same session when
 *   the answer is about another batch or it is frozen.
 */
export function entriesLoaded(
  session: RestoreSession,
  answer: CommandResult<BackupEntryListing>
): RestoreSession {
  if (frozen(session)) {
    return session;
  }
  if (answer.ok && answer.value.batch.name !== session.batch?.name) {
    return session;
  }
  return carryTheQuestion(session, {
    ...session,
    entries: answer.ok
      ? { kind: 'loaded', listing: answer.value }
      : { kind: 'failed', failure: answer.failure }
  });
} // End of function entriesLoaded()

/**
 * Chooses which entry's text to read.
 *
 * The retained candidate goes with it: what is on screen must never be one entry's
 * bytes under another entry's name, which is the first half of the drift consult Q8
 * names as this phase's sharpest failure.
 *
 * @param session - The session.
 * @param entry - The opaque identity a listing produced.
 * @returns The session over that entry, with no candidate and nothing pending, or
 *   the same session while it is {@link frozen}.
 */
export function chooseEntry(session: RestoreSession, entry: BackupEntryId): RestoreSession {
  // Before {@link frozen} reads the phase, for `loadingBatches`'s reason.
  revokeConfirmation(session);
  return frozen(session)
    ? withNothingPending(session)
    : { ...withdrawn(session, 'dropped'), entry };
} // End of function chooseEntry()

/**
 * Retains one entry's exact text as this session's candidate.
 *
 * **Three things are checked, and each of them is a way the shown candidate and the
 * sent candidate could come apart.** The response must be about this session's
 * destination, about the entry this session asked for, and about the batch that
 * entry belongs to; anything else is a read this session did not ask for and is
 * refused rather than installed. `read_backup_text` already verifies that the entry
 * maps to the document it was given, so this is the frontend half of the same
 * question and not a second opinion about the filesystem.
 *
 * The text is stored **exactly as it arrived** — no trimming, no normalisation, no
 * line-ending conversion — and the revision beside it is the wire's hash of those
 * bytes, never the destination's.
 *
 * **A fourth thing is checked**, and it is the one 2c-5-3's review added (M1): a
 * candidate that arrived while the session is {@link frozen} is dropped. A preview
 * replaced under a send in flight would leave {@link applyRestore} describing an
 * answer for one candidate against another.
 *
 * **A response this function ignores withdraws nothing**, and *"the same session"* means
 * the same authorization too. The question is {@link suspendTheQuestion | suspended}
 * across the validation rather than revoked before it, so a stale read for another entry
 * — landing after the person has loaded this one and been asked about it — cannot make a
 * live question disappear on the way to being rejected as irrelevant. Only the arm that
 * actually replaces the candidate withdraws, and it withdraws because the candidate
 * moved. That is the second confirmation review's Low.
 *
 * @param session - The session.
 * @param response - What `readBackupText` in `../ipc/commands` answered.
 * @returns The session holding the candidate, or the same session when the response
 *   is not about what this session asked for or it is frozen.
 */
export function candidateRead(
  session: RestoreSession,
  response: BackupTextResponse
): RestoreSession {
  // **Suspended before every one of the reads below**, and there are seven of them here
  // — the entry, the phase, the destination, the response's own entry and batch. Each is
  // a caller-controlled property read, and with the revocation left to {@link withdrawn}
  // any of them could have answered the question from inside this transition. Revoking
  // outright closed that and cost the second confirmation review's Low: a read for entry
  // B landing after the person has loaded entry A and asked its question destroyed A's
  // question over a response this function then rejects as irrelevant. A suspension is
  // both — nothing spendable while the response is validated, and the question intact
  // when it turns out not to be about this session.
  const suspension = suspendTheQuestion(session);
  try {
    const asked = session.entry;
    if (frozen(session) || asked === null || response.document !== session.target) {
      return unchangedByInspection(session, suspension);
    }
    if (
      response.entry.id.relative_path !== asked.relative_path ||
      response.entry.id.batch.name !== asked.batch.name ||
      session.batch === null ||
      asked.batch.name !== session.batch.name
    ) {
      return unchangedByInspection(session, suspension);
    }
    // Withdrawn **before** the new preview is built, so the revocation precedes every
    // remaining caller-controlled read: `cleared.baseRevision` is a plain copy the
    // spread inside `withdrawn` already took, and reaching for `session.baseRevision`
    // here would be one more read on the wrong side of it. This is also the one arm
    // that ends the suspension permanently — the deletion inside it removes the cell,
    // and `restoreTheQuestion` will find it gone and put nothing back.
    const cleared = withdrawn(session, 'dropped');
    const preview: RestorePreview = {
      entry: response.entry,
      revision: response.revision,
      draft: startDraft(cleared.baseRevision, response.text, textDraftRules)
    };
    return { ...cleared, preview };
  } finally {
    restoreTheQuestion(session, suspension);
  }
} // End of function candidateRead()

/**
 * Records that reading one entry's text was refused.
 *
 * The candidate goes: a refused read leaves this session with nothing it can claim
 * to have shown anybody.
 *
 * @param session - The session.
 * @param failure - Why, as the boundary classified it.
 * @returns The session showing the refusal, with no candidate and nothing pending,
 *   or the same session while it is {@link frozen}.
 */
export function candidateRefused(
  session: RestoreSession,
  failure: IpcFailure
): RestoreSession {
  // Before {@link frozen} reads the phase, for `loadingBatches`'s reason.
  revokeConfirmation(session);
  return frozen(session)
    ? withNothingPending(session)
    : { ...withdrawn(session, 'dropped'), entries: { kind: 'failed', failure } };
} // End of function candidateRefused()

/**
 * Moves the destination's revision to what the window now projects.
 *
 * **The transition consult Q4 means by "changing the observed target revision"**,
 * and it is a withdrawal rather than a rebase of anything: the candidate is
 * untouched — it is the text read from a backup entry and has nothing to do with
 * what the destination holds — while the revision it would be written against
 * becomes the one the window now has. The confirmation and any acknowledgement go,
 * because both were given about a transaction that would now be a different one.
 *
 * A caller that passes the revision the session already holds gets its session back
 * unchanged, so an idle reprojection check costs nothing and cannot invalidate a
 * confirmation for no reason. A session that is {@link frozen} gets it back too:
 * moving the base revision under a send in flight would leave the answer measured
 * against a revision nobody sent it at.
 *
 * @param session - The session.
 * @param observed - What {@link revisionInProjection} answered for the destination,
 *   or `null` when this window holds no projection of it. Required and nullable
 *   rather than defaulted: a default would be this function inventing agreement for
 *   a caller that did not look.
 * @returns The session at that revision, or unchanged when nothing moved.
 */
export function targetRevisionObserved(
  session: RestoreSession,
  observed: ContentRevision | null
): RestoreSession {
  // **Suspended before anything is read, and put back only if nothing moved.** The
  // three reads below — the phase, the committed flag and the base revision — are all
  // caller-controlled, so simply revoking after them leaves the opening every other
  // withdrawal here just closed. Revoking *unconditionally* is not available either,
  // and this is the one transition where that matters: `RestorePane.svelte` runs it
  // from an `$effect` on every change to the session, so a question would be revoked
  // in the same tick it was asked.
  //
  // **Taking the entry out was not the answer**, and that is the second confirmation
  // review's High. It did stop a re-entrant call spending the question — nothing was
  // there — but `prepareRestore` reads absence as permission to ask again, so a getter
  // on `phase` could register a second live authorization under a successor session and
  // both would confirm once this call put the first one back. The cell that replaces the
  // permit is a question to everything that tests for one and a permit to nothing, and
  // the put-back is identity-checked against it, so a re-entrant withdrawal wins.
  const suspension = suspendTheQuestion(session);
  try {
    // The idle arm answers its own argument by reference, which is what makes that
    // effect converge — unless a getter it just ran withdrew the question, in which
    // case what comes back presents none either.
    return frozen(session) || observed === null || observed === session.baseRevision
      ? unchangedByInspection(session, suspension)
      : measuredAgainst(session, observed);
  } finally {
    restoreTheQuestion(session, suspension);
  }
} // End of function targetRevisionObserved()

/**
 * The conflict the session is showing, of either origin, or `null`.
 *
 * **Widened to the union at Phase 2d-6-5**, from the save arm alone. The external
 * conflict is answered first, then the outcome's conflict arm — a definite answer
 * for a session built by hand with both populated, and a decision about nothing
 * for one this module built, because {@link applyRestoreObservation} and
 * {@link applyRestore} keep the two exclusive (the 2d-6 record's §3 entry 7).
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: RestoreSession): ConflictModel<string> | null {
  return session.externalConflict ?? conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Why this session may not be asked to restore right now, or `null`.
 *
 * **The order is a claim about which fact is the most fundamental**, and it decides
 * which sentence a person sees when two are true at once: what has already happened
 * to the file, then whether this application may write it at all, then what is
 * happening to it — a replacement in flight, a conflict of either origin, a
 * reading the window holds undecided — then whether there is anything to send,
 * then whether this window still holds the reading the candidate is measured
 * against, and last the rule that is about the person's other open panels rather
 * than about the file.
 *
 * **The two external arms sit where the save conflict sits** (Phase 2d-6-5, the
 * 2d-6 record's §3 entry 8): the external conflict first, in {@link conflictOf}'s
 * precedence, then the save conflict, then the held reading — each a claim about
 * what stands over the file, before the claims about this session's own
 * emptiness and the window's reading. An unresolved write uncertainty blocks
 * through the conflict it qualifies, which this module never sets it without.
 *
 * **It is exactly the set {@link confirmRestore} rechecks**, over exactly the same
 * two window observations, so a control this answers `null` for and a confirmation
 * that then refuses cannot disagree about anything but the five values a pending
 * confirmation carries — which are the session's own and are compared there; and
 * {@link permitHolds} asks the same restrictions of the final permit.
 *
 * It is an **affordance derived from current state, never authorization**: the
 * transaction's own locked read is what actually stands between a restore and a
 * file that has moved, and every arm here is rechecked at the moment a submission
 * would be produced. What it forces is refusal for the session it is given; **it
 * cannot force that session to be current** (R37) — one synchronous decision over
 * one snapshot is the whole of the guarantee, and the doors' reader is what lets
 * a caller ask about the installed one.
 *
 * @param session - The session.
 * @param context - What this window observes about the destination and about its
 *   own open surfaces.
 * @returns The reason, or `null` when a restore may be prepared.
 */
export function restoreRefusal(
  session: RestoreSession,
  context: RestoreContext
): RestoreRefusal | null {
  if (session.restored) {
    return { kind: 'alreadyRestored' };
  }
  if (session.readOnly) {
    return { kind: 'readOnly' };
  }
  if (session.phase === 'saving') {
    return { kind: 'inFlight' };
  }
  if (session.externalConflict !== null) {
    return { kind: 'externalConflict' };
  }
  if (conflictArm(session.outcome) !== null) {
    return { kind: 'conflictShowing' };
  }
  if (awaitedFor(session) !== null) {
    return { kind: 'observationRetained' };
  }
  if (session.preview === null) {
    return { kind: 'noCandidate' };
  }
  if (context.observed === null || context.observed !== session.baseRevision) {
    return { kind: 'targetMoved' };
  }
  const surface = competingSurfaceFor(session.target, context.surfaces);
  return surface === null ? null : { kind: 'writeSurfaceOpen', surface };
} // End of function restoreRefusal()

/**
 * Whether a restore may be prepared as things stand.
 *
 * @param session - The session.
 * @param context - What this window observes about the destination and about its
 *   own open surfaces.
 * @returns `true` when {@link prepareRestore} would do anything.
 */
export function canPrepareRestore(
  session: RestoreSession,
  context: RestoreContext
): boolean {
  return restoreRefusal(session, context) === null;
} // End of function canPrepareRestore()

/**
 * Asks the person to confirm replacing the destination's whole text.
 *
 * The first of the two phases, and the **only** producer of a
 * {@link PendingRestore} — through its private half, {@link questionFor}, which
 * makes every read, builds the record and registers nothing. It records the five values
 * consult Q5 binds, so the answer cannot be spent on a different entry, a
 * different destination, a different candidate, a different base revision, or a
 * later preview that happens to reproduce the other four.
 *
 * It is also the only place a question is registered in
 * {@link PENDING_AUTHORIZATIONS}, which is what {@link confirmRestore} spends. Asking
 * again while one is pending does nothing; asking after the pending one was cancelled
 * or withdrawn mints a **new** question, and that is a second authorization by
 * construction rather than a hole.
 *
 * **The permit is built here, not at the confirmation**, which is the 2c-5-4b review's
 * first High. Everything a write needs — the destination, the base revision, the
 * entry's identity as copied primitive fields, the candidate hash, the preview
 * generation and the **exact complete submission** — is read out of the world at this
 * one moment, copied into a plain object, deeply frozen, and filed away where no
 * caller can reach it. {@link confirmRestore} then hands that same record to
 * {@link PERMITS} and derives nothing, so no property read on the far side of its
 * checked spend can substitute anything. The bound values a person was asked about are
 * therefore the bound values that reach the wire, by construction rather than by the
 * two happening to agree.
 *
 * **One base revision, read once, on both fields.** That is the 2c-5-4b confirmation
 * review's first High: `RestorePermit.baseRevision` used to come from
 * `session.baseRevision` and `RestorePermit.submission.baseRevision` from
 * `submissionOf(preview.draft)`, two separate caller-controlled reads that nothing
 * required to agree — and {@link permitHolds} rechecks only the first while
 * {@link sendRestore} used to send only the second, so a locked write could succeed on
 * a base revision the confirmation never bound. There is one local now, and it is what
 * both fields hold; and where the draft's own base **disagrees** with it the question
 * is not asked at all, because a snapshot describing two transactions is not a
 * snapshot of one. That disagreement is unreachable through this module's own
 * transitions — `startDraft`, `retargetedDraft` and `savedDraft` move the two
 * together — so the refusal is a guard against a caller assembling a session by hand,
 * and the cost of it firing is one control that does nothing rather than a write
 * against a revision nobody was asked about.
 *
 * **What no ordering can make atomic**, in the same sentence as what this does force:
 * these are several property reads on values a caller supplied, so a getter that
 * answers differently on successive reads can still make the snapshot internally
 * inconsistent in the one pairing nothing here can check — the candidate's hash and
 * the candidate's bytes are two different properties of the preview, and this side of
 * the wire cannot hash anything to compare them. Every other value is read exactly
 * once. What is forced is that whatever it froze is what a send carries, that
 * {@link PendingRestore}'s own fields are copied *from the frozen record* rather than
 * read a second time, and that {@link permitHolds} compares the frozen candidate's
 * bytes against the live preview's before anything is sent.
 *
 * The acknowledgement is cloned as well as frozen, for `acknowledgeRefusal`'s reason
 * one module along: consent reaching the wire must share no object with a value a
 * caller could still be holding.
 *
 * **It asks nothing against a session that is no longer the one installed, and
 * it never answers a session that is not** (Phase 2d-6-5, 2d-6-4's review, its
 * first finding, and this phase's review, its second): every read this door
 * makes — the preview, the block's reads of the session and the context, the
 * submission, the entry, the spread — is a caller-controlled read, and a receiver
 * run from a getter behind any of them replaces the installed session with one
 * carrying an external conflict or a wait — a session whose
 * {@link restoreRefusal} would say so. So every one of those reads happens
 * first, in {@link questionFor}; then the installed session is read through
 * `current`, once; and **every return path from there answers through it**:
 * when the installed session is not the one handed in, **it is answered,
 * unchanged**, whether the question was refused or would have been asked — a
 * refusal that answered its argument would have the caller's
 * `session = prepareRestore(session, …)` overwrite what the receiver installed
 * with a capture that has never heard of the conflict. Only a session still
 * installed is refused by returning itself or asked by registering the question
 * under the session this returns. A receiver replaces a session and never
 * mutates one, so a session still installed carries what it carried when the
 * block was asked. What that cannot force is a caller that redefines a property
 * of the session it handed in between the two — that caller's own session is
 * what it defeats — nor that the reader a caller passes is honest ({@link
 * ReadTheInstalledSession}).
 *
 * @param session - The session.
 * @param context - What this window observes about the destination and about its
 *   own open surfaces.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session with the question pending, or the same session when it may
 *   not be asked or one is already authorized, or the installed session when the
 *   one handed in is no longer it.
 */
export function prepareRestore(
  session: RestoreSession,
  context: RestoreContext,
  current: ReadTheInstalledSession
): RestoreSession {
  // **Asked of the map rather than of `session.pending`**, because the map is the
  // authority: a session presenting a question that no longer authorizes anything is
  // a session that may be asked again, and this is a bare reference operation that
  // reads no property at all — so nothing caller-controlled has run when this
  // answers, and the session handed in is still the one installed.
  //
  // **A suspension counts, and that is the second confirmation review's High closed at
  // its far end.** This test is what a re-entrant caller reaches from inside
  // {@link targetRevisionObserved} or {@link candidateRead}, and while those held the
  // permit *out* of the map it answered `false` — so this function built a successor
  // session and filed a second live authorization under it, and both could confirm once
  // the first was put back. A {@link SuspendedQuestion} is present, so `has` is `true`
  // and no second question is minted; no code changed here, which is the point of
  // suspending rather than removing.
  if (PENDING_AUTHORIZATIONS.has(session)) {
    return session;
  }
  // **Every caller-controlled read of this door, taken here.**
  const question = questionFor(session, context);
  // **The installed session, read once, after the last of those reads, and
  // before any answer.** A receiver run from a getter behind any read above has
  // replaced it; what is installed is answered, refusal or not, so the caller
  // keeps what its receiver installed.
  const installed = current();
  if (installed !== session) {
    return installed;
  }
  if (question === null) {
    return session;
  }
  // Registered here and nowhere else, and under the session this returns — so the
  // exact object a caller installs, never a copy of it and never the one it handed
  // in, is what a confirmation spends. The spread inside `questionFor` is the last
  // caller-controlled operation on this path, deliberately: a getter reached by it
  // can confirm the *previous* question, which is a state this call has already
  // refused to be in.
  PENDING_AUTHORIZATIONS.set(question.asked, question.authorized);
  return question.asked;
} // End of function prepareRestore()

/**
 * The question {@link prepareRestore} would ask, built and not yet registered,
 * or `null` when the session may not be asked.
 *
 * **Every caller-controlled read of the door lives here**, so that the door's
 * one read of the installed session can come after all of them and before any
 * of its answers (this phase's review, its second finding). It registers
 * nothing: the record it builds authorizes nothing until the door files it, and
 * a caller of this function holds a value that no confirmation can find.
 *
 * @param session - The session.
 * @param context - What this window observes about the destination and about
 *   its own open surfaces.
 * @returns The session that would present the question and the permit that
 *   would authorize it, or `null`.
 */
function questionFor(
  session: RestoreSession,
  context: RestoreContext
): { readonly asked: RestoreSession; readonly authorized: RestorePermit } | null {
  const preview = session.preview;
  if (preview === null || !canPrepareRestore(session, context)) {
    return null;
  }
  // **One read, and both representations of the base revision come from it.** The two
  // used to be read separately and only one of them was ever rechecked.
  const baseRevision = session.baseRevision;
  const submission = submissionOf(preview.draft);
  if (submission.baseRevision !== baseRevision) {
    return null;
  }
  // Read once each, into locals, so the record cannot describe two entries.
  const entryId = preview.entry.id;
  const entry: BackupEntryId = {
    // Copied primitive fields rather than the caller's identity object, so a getter
    // or a proxy trap on it cannot answer one path while the question is validated
    // and another once it has been answered.
    batch: { name: entryId.batch.name },
    relative_path: entryId.relative_path
  };
  const authorized = deepFreeze<RestorePermit>({
    document: session.target,
    baseRevision,
    entry,
    candidateRevision: preview.revision,
    generation: session.previewGeneration,
    submission: {
      baseRevision,
      candidate: submission.candidate,
      acknowledgement: deepFreeze(structuredClone(submission.acknowledgement)),
      generation: submission.generation
    }
  });
  // The cast is the brand: `PendingRestore` declares a property on a symbol this
  // module does not export, so no literal outside it can have the type and this is
  // the only place one is built. Its five fields are taken **off the frozen record**
  // rather than read from the session a second time, so the question a screen carries
  // and the permit it authorizes cannot describe two different transactions.
  const pending = {
    document: authorized.document,
    baseRevision: authorized.baseRevision,
    entry: authorized.entry,
    candidateRevision: authorized.candidateRevision,
    generation: authorized.generation
  } as unknown as PendingRestore;
  return { asked: { ...session, pending, sendFailure: null }, authorized };
} // End of function questionFor()

/**
 * Takes the question back, and takes its authorization with it.
 *
 * **It revokes the entry in {@link PENDING_AUTHORIZATIONS} before it builds anything**,
 * which is the 2c-5-4b review's second High. Until then it only wrote `pending: null`
 * into the session it *returned*, so a caller holding the session it was given could
 * still confirm — and `BrowserState.restoreDocument` takes its session from `started`
 * rather than from live pane state, so that confirmation could have written the
 * cancelled candidate while the pane showed another one or showed no question at all.
 * A cancelled question is now dead: putting it back on a session by hand produces a
 * value {@link confirmRestore} finds nothing filed under.
 *
 * **Asking again is still asking again.** {@link prepareRestore} over the returned
 * session mints a fresh question with a fresh permit, which is a second authorization
 * by construction and is exactly the state a screen puts a person in when the question
 * comes back.
 *
 * @param session - The session.
 * @returns The session with nothing pending, or the same session when nothing was.
 */
export function cancelRestore(session: RestoreSession): RestoreSession {
  // **Revoked before anything is read**, so a getter reached by the read below, or by
  // the spread after it, cannot confirm the question this call exists to take back.
  // The fix round put this line first and still named its key through
  // `session.pending`, which left the opening inside the revocation itself.
  revokeConfirmation(session);
  if (session.pending === null) {
    return session;
  }
  return { ...session, pending: null };
} // End of function cancelRestore()

/**
 * The brand that makes a confirmed restore unforgeable. Declared, never exported.
 *
 * {@link sendRestore} takes one of these and nothing else, so a caller cannot
 * assemble one and hand it to a sender: the only route to one is
 * {@link confirmRestore}, which cannot be reached without a {@link PendingRestore},
 * which cannot be reached without {@link prepareRestore}.
 */
declare const STARTED: unique symbol;

/**
 * A restore a confirmation authorized: the session that is waiting for it.
 *
 * **There is nothing on this value to send with**, which is 2c-5-3's review, H1. It
 * used to carry the document and the submission, so it was a complete, reusable
 * instruction that could be handed to {@link sendRestore} twice, or held while the
 * entry, the target, the base revision, the preview generation or the window's open
 * surfaces moved and then handed over — writing the old candidate under an
 * authorization nothing rechecked. What it carries now is the session to install,
 * and what authorizes the write is the {@link RestorePermit} this object is the key
 * to: private to this module, spent once, and revalidated against the live session
 * and context at the moment of the send.
 */
export interface StartedRestore {
  /** The brand. Never present at runtime, never nameable outside this module. */
  readonly [STARTED]: typeof STARTED;
  /**
   * The session, now in flight, with the submission recorded on it.
   *
   * The value a caller installs before awaiting the send, and the one it hands back
   * to {@link sendRestore} as the live session.
   */
  readonly session: RestoreSession;
}

/**
 * What one question authorizes, held where no caller can reach it.
 *
 * The five values consult Q5 binds **and the exact complete submission**, so the send
 * does not have to trust anything a caller carried: it compares the permit against the
 * live session, and what it hands the sender is the permit's own submission.
 *
 * **Built by {@link prepareRestore}, deeply frozen, and never rebuilt.** One object
 * has two lives: it is filed in {@link PENDING_AUTHORIZATIONS} while the question is
 * unanswered and moved to {@link PERMITS} when it is confirmed. Nothing derives a
 * second one, because deriving after the spend was the 2c-5-4b review's first High —
 * a value read on the far side of a checked deletion is a value the deletion did not
 * authorize.
 *
 * Every field is a copy: two numbers and four strings, the entry's identity rebuilt
 * from its own two strings rather than carried by reference, and the acknowledgement
 * a `structuredClone`. `deepFreeze` then makes the whole record immutable at runtime,
 * which `readonly` alone does not.
 */
interface RestorePermit {
  /** The file that may be replaced. */
  readonly document: DocumentId;
  /** The revision it was expected to hold. */
  readonly baseRevision: ContentRevision;
  /** The backup entry the candidate was read from, as copied primitive fields. */
  readonly entry: BackupEntryId;
  /** The hash of exactly the candidate bytes. */
  readonly candidateRevision: ContentRevision;
  /** The preview generation the confirmation was given at. */
  readonly generation: number;
  /**
   * Exactly what may be sent: the candidate, its base revision and its consent.
   *
   * The bytes reach the wire from **here**, never from the session the caller hands
   * back — the last step of consult Q8's binding.
   *
   * **Its `baseRevision` is {@link RestorePermit.baseRevision}, by construction**:
   * {@link prepareRestore} fills both from one local, and refuses to ask the question
   * at all when the draft's own base disagrees with the session's. The field is kept
   * because `DraftSubmission` is what `savedDraft` and `submissionIsStale` take, and
   * what {@link sendRestore} puts on the wire is the permit's own `baseRevision` — the
   * field {@link permitHolds} rechecks. Two representations that one function fills and
   * another checks were the 2c-5-4b confirmation review's first High.
   */
  readonly submission: DraftSubmission<string>;
}

/**
 * Reads the session a caller currently holds — the one its registered receiver
 * has been updating — for a door or a settling transition to check against.
 *
 * **`ReadTheInstalledSession` in `./matchDeletion.ts`, for this session**, and it
 * exists for the reason 2d-6-4's review gave (its first, second and third
 * findings, one class): a door's caller-controlled operand — the context's
 * revision and surfaces, the preview, the session's own fields, an observation
 * being replayed, the observation's projection the window copies inside
 * {@link reloadTheDiskVersion}'s adoption — is read through property access,
 * and a property read runs arbitrary code; a getter there can call
 * `BrowserState.observeExternalChange`, whose registered receiver replaces the
 * *installed* session with one carrying an external conflict or a wait. A
 * transition that then checked the block on the session it was handed would
 * check a session no longer installed, and spend. So every spending door, every
 * settling transition and the reload ask for the installed session through
 * this, once, after the last caller-controlled read and immediately before the
 * spend — the reload once more after its adoption — and refuse, or answer the
 * installed session, when what is installed is not what they were handed.
 *
 * **What it forces and what it does not, in the same sentence.** Through it, {@link
 * prepareRestore} registers no question over a displaced
 * session and answers the installed one from every refusal, {@link confirmRestore}
 * spends the question only while the session it
 * was handed is still the one installed, {@link sendRestore} consumes the permit
 * unspent when it is not, {@link reloadTheDiskVersion} re-points over the
 * installed session and answers it untouched when the adoption replaced the
 * conflict, and {@link applyRestore},
 * {@link restoreConfirmationWithdrawn} and {@link restoreCouldNotBeSent} settle
 * every delivery the receiver appended to the installed session during the
 * flight and during their own replay. **The parameter is required since Phase
 * 2d-6-6a**, so no call compiles without one: `RestorePane.svelte` passes a reader at
 * every one of these calls and hands one to `BrowserState.restoreDocument`, which
 * gained the parameter for it. What no type can force is that the closure reads the
 * installed session rather than a capture; `() => session` over the component's
 * `$state.raw` is the honest one, and a reader answering the session handed in
 * whatever is installed gets the displaced check and the lost delivery this closes.
 *
 * @returns The session the caller holds now.
 */
export type ReadTheInstalledSession = () => RestoreSession;

/**
 * Every permit a confirmation has released and no send has spent, keyed by the
 * confirmed object.
 *
 * A `WeakMap` rather than a property, for `invalidation.ts`'s reason one operation
 * along: a property is recoverable by reflection whatever its key is, and object
 * spread and `structuredClone` copy it, while a clone of a {@link StartedRestore} is
 * a different object and therefore not a key here. **A checked deletion is what makes
 * the permit one-shot** — the question that released it is spent one step earlier, in
 * {@link PENDING_AUTHORIZATIONS} — and {@link sendRestore} performs it **before** it
 * calls the sender: `WeakMap.delete` answers whether this key was still held *and*
 * removes it in one operation that runs no user code, so what authorizes the send is
 * the deletion's own result.
 *
 * **Deleting and discarding the result was not the same guarantee**, and that is the
 * 2c-5-4a review's High. {@link permitHolds} reads a dozen properties off values a
 * caller supplied; any one of them can be a getter or a proxy trap that re-enters
 * {@link sendRestore} with this same key, and an inner call that validated, deleted
 * and entered its sender left the outer call ignoring a deletion that had already
 * failed and calling the sender a second time. One permit, two whole-file
 * replacements.
 *
 * The construct is `rememberTheConflict`'s in `./workspace.svelte.ts`: a spend bound
 * to the value the answer arrived on.
 */
const PERMITS = new WeakMap<StartedRestore, RestorePermit>();

/**
 * Confirms the restore and produces what the command takes.
 *
 * **The only thing in this module that produces a {@link StartedRestore}**, and it
 * refuses every way of arriving here without an answered question: no pending
 * request, a request issued for another document, another base revision, another
 * entry, another candidate or an earlier preview, a candidate that has gone, a
 * destination the live projection no longer gives this revision, a competing write
 * surface open over the destination, a restore in flight, a conflict on screen, a
 * read-only file, or a restore that has already committed.
 *
 * **Six values are compared, not five.** The pending request's five were all minted
 * by this module and therefore agree with each other however stale they all are;
 * `RestoreContext.observed` is the only one that comes from outside the session, so
 * it is the only one that can notice that the window has re-read the destination.
 * That is `matchDeletion.ts`'s recorded lesson — *a confirmation that compares two
 * values minted together observes nothing* — and it is why the field is required and
 * nullable rather than defaulted. It is checked here **through
 * {@link restoreRefusal}'s `targetMoved` arm**, so the control and the confirmation
 * cannot disagree about it: one rule, one place.
 *
 * **What the type does not force**, in the same sentence: `observed` is an ordinary
 * `ContentRevision`, so a caller that hands back `session.baseRevision` rather than
 * reading the live projection gets agreement it did not earn and no warning; and
 * `surfaces` is an ordinary array, so a caller that passes an empty one claims there
 * are no competing surfaces. What is closed is that no transition here yields
 * something to send without a confirmation bound to this exact candidate and this
 * exact destination.
 *
 * The pending request is **spent, not merely cleared**. Writing `pending: null` into
 * the session this returns is presentation; what spends the question at runtime is
 * *successfully* deleting it from {@link PENDING_AUTHORIZATIONS}, and that is the
 * difference between
 * a caller who cannot confirm twice and one who only appears unable to. Consent is
 * for one attempt: a refusal that comes back with findings is acknowledged and then
 * prepared and confirmed again, which is the shape the acknowledgement round trip has
 * everywhere else in this application.
 *
 * **The spend is one operation, and that is the guarantee.** It is a *checked*
 * `PENDING_AUTHORIZATIONS.delete`, and its success is the authorization, so testing
 * the membership and consuming it cannot come apart. That is not a refinement: this
 * function reads properties off values a caller supplied, `readonly` freezes nothing
 * at runtime, and any one of those reads can reach a getter or a proxy trap and
 * re-enter here synchronously. Asking with `has` first and deleting afterwards left a
 * window in which the inner call answered the question and minted its permit while
 * the outer call's later deletion returned `false` into nothing and minted a second.
 * The deletion is still placed after **every** check, so a refused confirmation does
 * not burn the question — the person repairs whatever moved and confirms the same
 * one — while a second call with the same pending object, ordinary or re-entrant,
 * finds the map no longer holding it and answers `null`.
 *
 * **Nothing caller-controlled is read after the spend, and that is the 2c-5-4b
 * review's first High.** This function used to derive `submissionOf(preview.draft)`
 * and re-read the session's target, its base revision, the preview's entry and hash
 * and its generation *after* the checked deletion had already succeeded — so a getter
 * on the retained draft could answer candidate A while the question was validated and
 * candidate B once it had been answered, and B is what reached the wire while every
 * hash comparison downstream still compared A with A. The permit now comes whole from
 * {@link prepareRestore}: the session this returns is built **before** the spend, and
 * the only statement after it is one `WeakMap.set` of a record frozen when the person
 * was asked. Comparing the five bound values against that record rather than against
 * {@link RestoreSession.pending}'s own fields closes the same class one step earlier —
 * the question object is caller-reachable and its properties are redefinable, and the
 * frozen record is neither.
 *
 * **The question is named by the session and not by `session.pending`**, since the
 * 2c-5-4b confirmation round. That is what lets the lookup be the *first* operation
 * here — nothing is read off the caller before the module knows whether it is looking
 * at an authorized session at all — and it is the same change that lets every
 * withdrawal revoke before caller code. A consequence worth stating: a spread or a
 * `structuredClone` of an asked session confirms nothing, because a `WeakMap` entry is
 * not a field.
 *
 * **The permit is the whole authorization.** It records the five bound values and the
 * exact submission away from the returned object, so what comes back is a session to
 * install and a key — not an instruction anything can carry to a sender. One question
 * therefore mints at most one permit, whatever the caller does with the session this
 * returns; what stops that permit being spent twice, or being spent after anything it
 * binds has moved, is {@link sendRestore}.
 *
 * **It spends nothing against a session that is no longer the one installed**
 * (Phase 2d-6-5, 2d-6-4's review, its first finding). The block — an external
 * conflict, a held reading, the uncertainty the conflict carries, beside the
 * ordinary arms — is asked through {@link canPrepareRestore} before the frozen
 * record is compared, on the session handed in; then every read this function
 * makes happens, the spread that builds the waiting session last; then the
 * installed session is read through `current`, once, and only a session that is
 * still the one handed in reaches the checked deletion. A receiver run from a
 * getter behind any of those reads is therefore seen — it replaced the installed
 * session, and this refuses — rather than overwritten by the spend, and the
 * question it withdrew is not spent here either, because the deletion finds the
 * map no longer holding it. A receiver replaces a session and never mutates one,
 * so a session still installed carries what it carried when the block was
 * asked; what that cannot force is a caller that redefines a property of the
 * session it handed in between the two, nor that the reader a caller passes is honest
 * ({@link ReadTheInstalledSession}).
 *
 * @param session - The session holding the person's answer.
 * @param context - What this window observes about the destination and about its
 *   own open surfaces.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The waiting session, keyed to its permit, or `null`.
 */
export function confirmRestore(
  session: RestoreSession,
  context: RestoreContext,
  current: ReadTheInstalledSession
): StartedRestore | null {
  // Looked up **first**, and by the session itself: a bare reference operation that
  // reads no property, so every comparison below is against this module's own frozen
  // record rather than against anything a caller can redefine. It is not yet a spend:
  // a question withdrawn since it was asked, a session spread or cloned since, and a
  // session that was never asked are all absent here and answer `null` at once —
  // which is why `session.pending` is not consulted at all.
  //
  // **A suspended question is refused as firmly as an absent one.** Another call is
  // inside {@link targetRevisionObserved} or {@link candidateRead} holding that permit
  // and has not yet decided whether it survives; minting from it here would answer a
  // question twice over, once through this permit and once through the one that call is
  // about to put back. {@link isSuspended} is a `WeakSet` membership test, so this
  // refusal runs no user code either.
  const authorized = PENDING_AUTHORIZATIONS.get(session);
  if (authorized === undefined || isSuspended(authorized)) {
    return null;
  }
  const preview = session.preview;
  if (preview === null || !canPrepareRestore(session, context)) {
    return null;
  }
  if (authorized.document !== session.target || authorized.baseRevision !== session.baseRevision) {
    return null;
  }
  if (
    authorized.entry.relative_path !== preview.entry.id.relative_path ||
    authorized.entry.batch.name !== preview.entry.id.batch.name
  ) {
    return null;
  }
  if (
    authorized.candidateRevision !== preview.revision ||
    authorized.generation !== session.previewGeneration
  ) {
    return null;
  }
  // **Built before the spend, on purpose.** A spread reads every own enumerable
  // property of `session`, which is a caller-controlled read; doing it after the
  // checked deletion would put user code on the far side of the authorization, which
  // is precisely the shape the 2c-5-4b review found. The cast is the brand, as it is
  // for `PendingRestore`: this is the only place a `StartedRestore` is built, and
  // `sendRestore` takes nothing else.
  const started = {
    session: {
      ...session,
      phase: 'saving',
      pending: null,
      submitted: authorized.submission,
      inFlight: { submission: authorized.submission, preview },
      sendFailure: null
    }
  } as unknown as StartedRestore;
  // **The installed session, read once, after the last caller-controlled read
  // and immediately before the spend.** A receiver run from a getter above has
  // replaced it; a session that is no longer the one installed spends nothing.
  const installed = current();
  if (installed !== session) {
    return null;
  }
  // **The spend is the membership test.** Every check above compares numbers and
  // strings, so a clone of an answered question would pass them all; what tells this
  // session from a copy of it, and from itself already answered or withdrawn, is that
  // `PENDING_AUTHORIZATIONS` still holds it — and `WeakMap.delete` answers that and
  // removes it in one operation that runs no user code. Asking with `has` first and
  // deleting afterwards was **not** the same thing: every property read between the
  // two can reach a getter or a proxy trap, so a caller could re-enter, answer the
  // question inside its own confirmation, and mint a second permit while the outer
  // call's later deletion returned `false` into nothing. It is placed after all the
  // checks so a refusal still leaves the question askable.
  if (!PENDING_AUTHORIZATIONS.delete(session)) {
    return null;
  }
  // The only statement after the spend, and it reads nothing: the record was frozen
  // when the question was asked and is filed here exactly as it stands.
  PERMITS.set(started, authorized);
  return started;
} // End of function confirmRestore()

/**
 * What sends a confirmed restore, as this module sees it.
 *
 * `BrowserState.saveRawDocument`'s signature, taken as a callback for the reason
 * every other command in this directory is: a test that cannot run Tauri still has
 * to drive a refusal, a conflict, a commit and an uncertain send and watch what this
 * value does about each. That wrapper is the one production place that couples the
 * command result to cache invalidation, remembers a conflict **without installing
 * it**, and seals the whole-document answer.
 *
 * @param document - The file to replace.
 * @param baseRevision - The revision it is expected to hold.
 * @param text - The candidate's exact bytes.
 * @param acknowledgement - The suspicions already shown to a person, for these
 *   exact bytes.
 * @returns The sealed outcome, or a failure that says whether the file may already
 *   have been written.
 */
export type SendRestore = (
  document: DocumentId,
  baseRevision: ContentRevision,
  text: string,
  acknowledgement: DraftSubmission<string>['acknowledgement']
) => Promise<RawSaveAnswer>;

/** What one attempt to send a restore became. */
export type RestoreSend =
  | {
      /**
       * **This call held no permit at all**, so the sender was never called and this
       * call has nothing to say about the session.
       *
       * Three ways in, and they agree about the session for one reason: nothing was
       * confirmed; the permit had already been spent by an earlier call; or it was
       * spent by a **re-entrant** call that reached the checked deletion first. In
       * the last two, whichever call spent the permit is the one that answers for
       * the session, and a caller that installed this call's argument instead would
       * be installing a session that call did not produce.
       */
      readonly kind: 'notAttempted';
    }
  | {
      /**
       * A permit was there, no longer described the session and the window, and was
       * consumed. **This restore attempt sent nothing.**
       *
       * Distinct from `notAttempted` because the session has to move. The
       * confirmation put it in `saving`, every editing transition in this module is
       * a no-op while it is there (see {@link frozen}), and a screen given that
       * session back would go on saying a replacement is in flight when no command
       * ran. {@link restoreConfirmationWithdrawn} is the transition that takes it
       * back to a state a person can act on; what is then drawn is
       * {@link restoreRefusal}'s answer over the live session and the live window.
       *
       * **The permit is spent by the mismatch rather than left for a retry**, which
       * is a deliberate rule and not bookkeeping: a confirmation authorizes one send
       * attempt, so a world that moved under it is asked again rather than sent to
       * once it happens to move back. **This says nothing about the acknowledgement**
       * — {@link restoreConfirmationWithdrawn} keeps that, still bound to the same
       * candidate, so asking again does not mean collecting consent again.
       */
      readonly kind: 'withdrawn';
    }
  | {
      /** The sender was called exactly once, and this is what it answered. */
      readonly kind: 'answered';
      /** What `BrowserState.saveRawDocument` answered. */
      readonly answer: RawSaveAnswer;
    };

/**
 * Whether a permit still describes the session and the window.
 *
 * **Eight checks, and each of them is a way a correct consent could be spent on a
 * different write** (2c-5-3's review, H1). Seven are the values consult Q5 binds
 * plus the two window observations; the eighth is the candidate itself, compared as
 * bytes, because a preview whose text moved under a permit whose hash still matched
 * would be exactly the drift Q8 names.
 *
 * It is deliberately **not** {@link restoreRefusal} with an argument: that predicate
 * answers *may a restore be prepared*, and a send is the one moment when
 * `phase === 'saving'` is required rather than refused. Every other arm of it is
 * here — a committed session, a read-only file, a conflict on screen of either
 * origin, a reading the window holds undecided, no candidate, a destination the
 * window no longer gives this revision, and a competing surface — so the two
 * cannot disagree about anything but the arm that is inverted by construction.
 *
 * **The final permit is a submission boundary too** (Phase 2d-6-5, the 2d-6
 * record's §3 entry 8): an external conflict and a held reading refuse here
 * exactly as they refuse the preparation and the confirmation, and so does a
 * delivery the session holds unapplied — while a session is `saving` its
 * receiver appends every envelope to {@link RestoreSession.heldDeliveries}
 * rather than applying it, so a non-empty list is a decision about the
 * destination this session has been told of and has not looked at, and a send
 * past it would be a send past that decision. What that forces is refusal for
 * the session handed in; what it cannot force is that the session is the
 * installed one, which is {@link sendRestore}'s reader.
 *
 * **Every read below is caller-controlled and may run arbitrary code.** `session`
 * and `context` are ordinary values a caller assembled, `readonly` freezes nothing at
 * runtime, and a `$state` array is a proxy — so a getter or a trap reached here can
 * re-enter {@link sendRestore} synchronously, before this predicate has returned.
 * That is why its caller treats the deletion that follows as the authorization
 * rather than as tidying up, and why this function must never be read as running
 * atomically.
 *
 * @param permit - What the confirmation authorized.
 * @param session - The session as it stands **now**.
 * @param context - What this window observes **now**.
 * @returns `true` when the permit may be spent.
 */
function permitHolds(
  permit: RestorePermit,
  session: RestoreSession,
  context: RestoreContext
): boolean {
  const preview = session.preview;
  if (preview === null || session.phase !== 'saving' || session.restored) {
    return false;
  }
  if (session.readOnly || conflictOf(session) !== null) {
    return false;
  }
  if (awaitedFor(session) !== null || session.heldDeliveries.length > 0) {
    return false;
  }
  if (permit.document !== session.target || permit.baseRevision !== session.baseRevision) {
    return false;
  }
  if (
    permit.entry.relative_path !== preview.entry.id.relative_path ||
    permit.entry.batch.name !== preview.entry.id.batch.name
  ) {
    return false;
  }
  if (
    permit.candidateRevision !== preview.revision ||
    permit.submission.candidate !== candidateText(preview) ||
    permit.generation !== session.previewGeneration
  ) {
    return false;
  }
  if (context.observed === null || context.observed !== session.baseRevision) {
    return false;
  }
  return competingSurfaceFor(session.target, context.surfaces) === null;
} // End of function permitHolds()

/**
 * Spends the one restore a permit authorizes, or sends nothing.
 *
 * **The only function in this module that hands anything to a sender**, and the
 * direct discharge of consult Q8. Three things happen here in this order, and the
 * order is the whole point:
 *
 * 1. the permit is looked up by the confirmed object. There is no permit for a
 *    confirmation that was already spent, so the same {@link StartedRestore} can
 *    never issue two saves;
 * 2. it is checked against the **live** session and the **live** context — every
 *    value it binds, the candidate's own bytes, the revision this window projects
 *    for the destination, and the surfaces it has open. A confirmation carried past
 *    a change to any of them sends nothing, and the permit is consumed by the
 *    mismatch: the answer is `withdrawn`, which is a session the caller has to
 *    install rather than a session it may leave as it found it;
 * 3. the permit is **spent by a checked deletion before `send` is called**. The
 *    deletion's own result is the authorization, so a re-entrant or concurrent
 *    caller finds nothing to spend — and, just as importantly, a call that *loses*
 *    that race answers `notAttempted` instead of calling the sender anyway.
 *
 * **Step 3 is checked because step 2 is not atomic.** {@link permitHolds} reads a
 * dozen properties off `session` and `context`, both of which a caller assembled, and
 * any one of them can be a getter or a proxy trap whose body re-enters this function
 * with the same {@link StartedRestore}. The inner call can then validate, delete the
 * permit and enter its own sender before the outer {@link permitHolds} has returned;
 * with the deletion's result discarded, the outer call sent as well. One permit, two
 * whole-file replacements — the 2c-5-4a review's High, and the reason the prose here
 * used to promise atomicity the code did not give.
 *
 * What reaches the wire is the permit's own submission: the retained candidate's
 * exact bytes and the base revision the confirmation was given at. Neither can be
 * substituted by a caller of this function, and neither is re-derived here from
 * anything that could have moved.
 *
 * `null` is accepted rather than refused by the type on purpose: a caller writes
 * `sendRestore(started, session, context, send)` with whatever the confirmation
 * answered, and the arm that answers `notAttempted` **without calling `send`** is
 * what makes *no save is issued without a confirmation* a property a test can watch
 * fail rather than a claim about the shape of a signature.
 *
 * **What no type here forces**: that `session` and `context` are the live ones — a
 * caller that keeps the pair it confirmed with and never looks again gets agreement
 * it did not earn, which is `observed`'s limit one argument along. Nor that `session`
 * is the one this permit was minted with: `BrowserState.restoreDocument` takes it off
 * `started` for exactly that reason, and it is a coordinator that closes it rather
 * than a type here. Nor that a caller installs the transition a `withdrawn` answer
 * calls for — {@link restoreConfirmationWithdrawn} exists and is named in this type's
 * own documentation, and nothing makes anybody call it. Nor that `send`
 * is `BrowserState.saveRawDocument`, or that it writes anything at all —
 * `async () => ({ kind: 'failed', mayHaveWritten: false })` type-checks, exactly as
 * `openWholeDocumentSave`'s `forget` may have an empty body. And nothing stops a
 * component calling `BrowserState.saveRawDocument` or `../ipc/commands`'s
 * `saveRawDocument` directly, with any text it likes; that is the hole every writing
 * command has had since 2b-2a and no type in this repository closes it.
 *
 * **The installed session is read once, after {@link permitHolds} and before the
 * spend** (Phase 2d-6-5, 2d-6-4's review, its first finding): the predicate's
 * dozen reads are the caller-controlled reads of this door, and a receiver run
 * from a getter behind one of them replaces the installed session with one that
 * holds a delivery this session has not applied; a permit whose session is no
 * longer the one installed no longer describes the session, and is consumed
 * unspent exactly as one that failed the predicate is. What that cannot force is that
 * the required reader is honest ({@link ReadTheInstalledSession});
 * `BrowserState.restoreDocument` hands this the confirmation's own session and the
 * reader its caller passed, so a delivery held on the installed one during this call
 * is what {@link restoreConfirmationWithdrawn}'s reader replays.
 *
 * @param started - What {@link confirmRestore} produced, or `null`.
 * @param session - The session as it stands now, which is the one the confirmation
 *   answered with unless something moved it.
 * @param context - What this window observes about the destination and about its
 *   own open surfaces, read **now** rather than when the question was answered.
 * @param send - `BrowserState.saveRawDocument`. Called at most once, and never at
 *   all without an unspent permit that still holds.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns What became of the attempt: nothing held, a permit consumed by a
 *   mismatch, or the sender's own answer.
 */
export async function sendRestore(
  started: StartedRestore | null,
  session: RestoreSession,
  context: RestoreContext,
  send: SendRestore,
  current: ReadTheInstalledSession
): Promise<RestoreSend> {
  if (started === null) {
    return { kind: 'notAttempted' };
  }
  const permit = PERMITS.get(started);
  if (permit === undefined) {
    return { kind: 'notAttempted' };
  }
  const holds = permitHolds(permit, session, context);
  // **The installed session, read once, after the last caller-controlled read.**
  const installed = current();
  if (!holds || installed !== session) {
    // **Consumed rather than left for a retry**, and consumed by a *checked*
    // deletion for the same reason the authorizing one is: a call that finds the
    // permit already gone did not consume anything, so it has no claim on the
    // session and says `notAttempted` instead of describing a withdrawal it did not
    // perform.
    return PERMITS.delete(started) ? { kind: 'withdrawn' } : { kind: 'notAttempted' };
  }
  // **The deletion is the authorization**, not a tidy-up after one. `permitHolds`
  // above ran caller-supplied getters and proxy traps, so a re-entrant call may
  // already have spent this permit and entered its own sender; the only way to know
  // is to ask the operation that also consumes it. A discarded result here is one
  // permit issuing two whole-file replacements.
  if (!PERMITS.delete(started)) {
    return { kind: 'notAttempted' };
  }
  // **The base revision sent is the one `permitHolds` checked.** It used to be
  // `permit.submission.baseRevision`, a second field nothing compared with anything —
  // and while `prepareRestore` now fills both from one read, sending the checked field
  // is what makes "the revision the confirmation bound" and "the revision that reaches
  // the wire" the same expression rather than two that happen to agree.
  const answer = await send(
    permit.document,
    permit.baseRevision,
    permit.submission.candidate,
    permit.submission.acknowledgement
  );
  return { kind: 'answered', answer };
} // End of function sendRestore()

/**
 * What a committed whole-document replacement obliges the coordinator to do.
 *
 * **Consult Q4's post-commit rule, as an argument rather than as a hope**: *if a
 * commit nevertheless occurs, the synchronous whole-document invalidation
 * closes/marks terminal every surface for that document.* The pre-send open-surface
 * refusal is an affordance — a surface can open after the confirmation — so this is
 * the half that actually holds, and 2c-5-3 shipped without it (that review's M2):
 * `applyRestore` hid `openWholeDocumentSave` behind itself and took no callback, so
 * no coordinator could discharge the obligation through the sealed protocol at all.
 *
 * **Synchronous and total**, for `ForgetReplacedDocument`'s reason: an asynchronous
 * one leaves a window in which a getter still reads identities minted from bytes
 * that are gone. Re-reading the file is a separate, later step and is not this.
 *
 * **A throw never unwrites the file.** It is caught by `openWholeDocumentSave`,
 * classified, and comes back as a `windowOutOfStep` line **beside** the committed
 * outcome (`PROGRESS.md` D2).
 *
 * **What no type here forces**: that the body does anything. `() => {}` satisfies
 * it, exactly as it satisfies `ForgetReplacedDocument`; what the signature forces is
 * that a caller cannot take a restore's answer without supplying one.
 *
 * @param invalidation - The file that was replaced and the revision it holds now.
 */
export type InvalidateEverySurface = (invalidation: RawSaveInvalidation) => void;

/**
 * Takes a restore's answer, discharging the invalidation on the way.
 *
 * **The one place this session learns anything about a save.** The answer arrives
 * sealed and `openWholeDocumentSave` is the only way to open it: a session that did
 * not discharge the invalidation would have no outcome to draw at all, which is what
 * "fails to type-check" can be made to mean for an obligation no signature can
 * express.
 *
 * Six properties this function keeps:
 *
 * - **the answer is classified against what was submitted**, which is
 *   {@link RestoreSession.inFlight} — the submission and the preview frozen at the
 *   confirmation — and never against whatever the session is showing when it lands.
 *   Reading the current preview was 2c-5-3's review, M1: a replaced one would
 *   describe an answer for candidate A against candidate B;
 * - **absence of presentation state never strands a committed seal.** The seal is
 *   opened, and the coordinator's invalidation runs, before anything is described.
 *   A session with nothing in flight still records what the transaction answered; it
 *   simply has no candidate to draw an outcome over;
 * - **a committed replacement is still committed when the invalidation failed.**
 *   Both failures — this callback's, which is where the coordinator runs, and the
 *   issuer's, which ran earlier — become a line **beside** the outcome and never
 *   replace the arm (`PROGRESS.md` D2). At most one line is added, because both mean
 *   the same thing to a person: *the file was written and this window is out of
 *   step*;
 * - **`committed: false` is a success in which nothing was written.** The base moves
 *   to the revision the transaction ended on and the consent is spent, exactly as it
 *   does for a write, and {@link RestoreSession.restored} stays `false` because
 *   nothing became stale and nothing was carried out;
 * - **`moved` is `null` permanently** on a committed replacement, by
 *   `WholeDocumentSaved`'s own type. There is no identity to follow and this
 *   function does not look for one;
 * - **opening a seal twice is refused rather than served.** That arm invents and
 *   replaces no outcome; what it does is return the session to `editing` with
 *   nothing in flight, because the outcome was delivered once already and inventing
 *   a second one would be this session claiming a save that did not happen.
 *
 * **What it does about an external conflict, and about a delivery held during
 * the replacement** — Phase 2d-6-5, `applySave`'s rule in `./matchEditor.ts`. A
 * `saved` or a `conflict` answer retires {@link RestoreSession.externalConflict}
 * (the 2d-6 record's §3 entry 7: the replacement's own answer is the newer fact
 * about the file); a `refused` answer wrote nothing and leaves it standing.
 * Neither is reachable from {@link confirmRestore} while an external conflict
 * stands, so this keeps the invariant for a caller that drove the model
 * directly. Then, whatever the answer — a seal already opened included, because
 * the replacement is over either way — every delivery
 * {@link applyRestoreObservation} held while it was in flight is replayed on
 * top, in arrival order (entry 5), **and, through the reader, every delivery
 * the receiver appended to the installed session during this transition's own
 * reads and replay** (2d-6-4's review, its second finding). A reader answering a
 * capture rather than the installed session loses such a delivery when the caller
 * installs the result ({@link ReadTheInstalledSession}).
 *
 * @param session - The session waiting for an answer, as the caller holds it.
 * @param sealed - What `BrowserState.saveRawDocument` answered.
 * @param invalidate - What the coordinator does about every write surface over the
 *   replaced file. Required, with no default: a default would be this module
 *   deciding for a caller that has surfaces it never told anyone about.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session showing what the restore ended as.
 */
export function applyRestore(
  session: RestoreSession,
  sealed: SealedWholeDocumentSave,
  invalidate: InvalidateEverySurface,
  current: ReadTheInstalledSession
): RestoreSession {
  // **Revoked first, on every path, and before any property of the argument is
  // read.** On the ordinary path `confirmRestore` already spent the question, so this
  // finds nothing; what it closes is a session that reached an answer with a question
  // still pending — a caller that never installed the confirmation's own session —
  // leaving an authorization alive over a file this transaction has just answered for.
  revokeConfirmation(session);
  const submitted = session.inFlight;
  // A holder rather than a bare `let`, because TypeScript's flow analysis assumes a
  // callback did not run and would narrow a `let` back to `null` below.
  const replaced: { revision: ContentRevision | null } = { revision: null };
  const opening = openWholeDocumentSave(sealed, (invalidation) => {
    // **The revision is recorded first**, so a coordinator that throws still leaves
    // this session knowing what the file holds now.
    replaced.revision = invalidation.revision;
    invalidate(invalidation);
  });
  if (opening.kind === 'alreadyOpened') {
    return consumingHeldDeliveries({ ...session, phase: 'editing', inFlight: null }, current);
  }
  const outcome = opening.outcome;
  const failed =
    invalidationFailureMessage(opening.invalidation) ??
    invalidationFailureMessage(opening.issuerInvalidation);
  const refused = outcome.outcome === 'refused';
  const answered: RestoreSession = {
    ...session,
    phase: 'editing',
    // **Nothing stays pending across an answer**, on any arm. On the ordinary path
    // `confirmRestore` consumed the confirmation before the send, so this is
    // already `null`; setting it here is what makes that true of every path rather
    // than of the ordinary one.
    pending: null,
    inFlight: null,
    // Restored from the frozen record rather than left as it was found, so a
    // dismissal that raced the send cannot leave a refusal with nothing to consent
    // to.
    submitted: submitted?.submission ?? session.submitted,
    // The conflict and refusal arms are given the draft as it was when the save was
    // sent, which is the frozen one: a candidate cannot change under a send, and
    // this is what makes that true rather than assumed.
    outcome:
      submitted === null
        ? session.outcome
        : describeWholeDocumentSave(outcome, submitted.preview.draft, CONFLICT_CAPABILITIES),
    extraMessages: failed === null ? [] : [failed],
    reload: NOT_RELOADING,
    sendFailure: null,
    // The replacement ended on the file, so the disk side an earlier observation
    // showed is no longer the comparison to draw (entry 7); a refusal wrote
    // nothing and says nothing about the file.
    externalConflict: refused ? session.externalConflict : null,
    uncertaintyUnresolved: refused ? session.uncertaintyUnresolved : false
  };
  if (outcome.outcome !== 'saved') {
    return consumingHeldDeliveries(answered, current);
  }
  const revision = replaced.revision ?? outcome.revision;
  return consumingHeldDeliveries(
    {
      ...answered,
      baseRevision: revision,
      restored: outcome.committed,
      // The frozen preview, rebased. It is the session's own on every path a
      // transition can reach — nothing can replace a preview under a send — and
      // taking it from the frozen record is what makes the draft the save's consent
      // is spent on the draft the save was taken from.
      preview:
        submitted === null
          ? session.preview
          : {
              ...submitted.preview,
              draft: savedDraft(submitted.preview.draft, submitted.submission, revision)
            }
    },
    current
  );
} // End of function applyRestore()

/**
 * Whether one held list is the other with more appended: the same envelopes, by
 * identity, in the same positions.
 *
 * A receiver appends and never reorders, so the installed session's list is the
 * handed-in list with the deliveries that arrived since; a list that is not is
 * one this transition cannot reason about and leaves alone.
 *
 * @param arrived - The installed session's list.
 * @param replayed - The list already replayed.
 * @returns `true` when `arrived` begins with every entry of `replayed`.
 */
function extendsTheReplayed(
  arrived: readonly ObservationDelivery[],
  replayed: readonly ObservationDelivery[]
): boolean {
  return replayed.every((delivery, at) => arrived[at] === delivery);
} // End of function extendsTheReplayed()

/**
 * Replays every delivery a session held during its replacement, in the order it
 * arrived, once the replacement's own answer is on it — the 2d-6 record's §3
 * entry 5 — and then every delivery the receiver appended to the installed
 * session while that was happening (2d-6-4's review, its second finding).
 *
 * `consumingHeldDeliveries` in `./matchDeletion.ts`, for this session, rounds
 * included, with one thing that is this module's own: emptying the list is a fresh
 * session, so the question the settled session carries — there is one on no ordinary
 * path, because the confirmation spent it, and {@link carryTheQuestion} is what makes
 * the rule true of every path — is carried to it. Each envelope then goes through
 * {@link applyRestoreObservation} exactly as it would have on arrival, which carries
 * or withdraws the question itself, and each is applied to the session the one before
 * it left. **Replaying an envelope reads its observation, and a read runs caller
 * code**: a getter there can tell the window of a reading, and the window delivers it
 * at once to the installed session — which is still `saving`, so the receiver appends
 * it there, to a list this transition was handed a copy of. So after each round the
 * installed session is read through `current`, its queue inspected, and `current`
 * asked again — a session displaced by that inspection is inspected afresh (since
 * Phase 2d-6-8a's review) — and the envelopes it holds beyond the ones replayed are
 * replayed too, in the order they arrived, until an undisplaced read finds none. **What this forces** is that no envelope delivered during the
 * replacement, or during this settlement, is dropped when the reader answers the
 * installed session, and that first-to-last is the order; **what it cannot force** is
 * that the window delivered them in the order it decided them, that the reader is
 * honest, or that the installed session is the one handed in with more appended — a
 * list that is not an extension of the one replayed is left alone, since the
 * transition cannot say what it is. Nor can it force the rounds to end: a getter that
 * tells the window of a fresh reading on every read does not come to rest here,
 * exactly as it does not at the window's own drain (`registerObservationReceiver`'s
 * doc), and one that re-tells a reading already decided does, because the window
 * hands each decision out once.
 *
 * @param settled - The session with its replacement's answer applied and its
 *   phase back to `editing`.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session with every held delivery applied, or the same session
 *   when none was held.
 */
function consumingHeldDeliveries(
  settled: RestoreSession,
  current: ReadTheInstalledSession
): RestoreSession {
  let queue = settled.heldDeliveries;
  let replayed: RestoreSession =
    queue.length === 0 ? settled : carryTheQuestion(settled, { ...settled, heldDeliveries: [] });
  let seen = 0;
  for (;;) {
    for (let at = seen; at < queue.length; at += 1) {
      replayed = applyRestoreObservation(replayed, queue[at]!);
    } // End of the loop over the deliveries not yet replayed
    seen = queue.length;
    // **The installed session captured, its queue inspected, and its identity
    // checked again after every read** (Phase 2d-6-8a's review, its should-fix).
    // Reading `heldDeliveries` and the envelopes in it runs caller code, and a
    // getter there can deliver into the installed session — which the receiver
    // answers by installing a new one — while the read answers the old list. A
    // session displaced during the inspection is inspected again from the top,
    // with nothing replayed twice because `seen` has not moved.
    const installed = current();
    const arrived = installed.heldDeliveries;
    const extended = arrived.length > seen && extendsTheReplayed(arrived, queue);
    if (current() !== installed) {
      continue;
    }
    if (!extended) {
      return replayed;
    }
    queue = arrived;
  } // End of the loop over the rounds of replay
} // End of function consumingHeldDeliveries()

/**
 * Records that a confirmation was consumed without anything reaching a command.
 *
 * **The session {@link confirmRestore} produced is not a state a person can act
 * on.** It carries `phase: 'saving'` and the frozen submission, and while it does
 * every catalogue, selection, candidate and base-revision transition in this module
 * answers its own argument unchanged ({@link frozen}). So a send that reached no
 * command has to move the session back, or a screen is left saying that a replacement
 * is in flight when none is running, with no ordinary transition that takes it
 * anywhere. That was the 2c-5-4a review's Medium, and the record before it claimed a
 * recovery — *the panel asks again* — that the model did not have.
 *
 * **Nothing about the candidate changes.** The retained bytes, whatever consent they
 * carry, the catalogue and the chosen entry are all kept, because no command ran and
 * nothing about the backup entry was learnt. What refuses the next attempt is
 * {@link restoreRefusal} over the live session and the live window, which is the
 * sentence a screen already draws; this transition is only what lets it be reached.
 *
 * **{@link RestoreSession.submitted} is left as the confirmation set it**, and that
 * is worth a sentence because the field's own name claims an attempt. What it holds
 * is the submission derived from the retained candidate at that candidate's base
 * revision — the same value a second confirmation over the same candidate produces —
 * so a refusal already on screen can still be consented to. Nothing here says a
 * command ran.
 *
 * **It is not {@link restoreCouldNotBeSent}.** That one is for a command that ran and
 * produced no outcome, and it raises a {@link SendFailure} because the file may
 * already hold the candidate. Here no command ran, there is nothing to be uncertain
 * about, and no failure is raised.
 *
 * The send is over, so a delivery held while the session was `saving` is applied
 * now (Phase 2d-6-5, the 2d-6 record's §3 entry 5) — the very delivery that may
 * have made {@link permitHolds} refuse — and through the reader every delivery
 * appended to the installed session during the replay is applied too, for
 * {@link applyRestore}'s reason.
 *
 * @param session - The session the consumed confirmation was minted with.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session back to its resting state, with the candidate retained.
 */
export function restoreConfirmationWithdrawn(
  session: RestoreSession,
  current: ReadTheInstalledSession
): RestoreSession {
  // Revoked before anything is built, so this transition's name is true of the
  // authorization and not only of what a screen draws.
  revokeConfirmation(session);
  // `pending` is already `null` on every session a confirmation minted; setting it
  // is what makes that true of every path rather than of the ordinary one, which is
  // `applyRestore`'s reason for the same line.
  return consumingHeldDeliveries(
    { ...session, phase: 'editing', inFlight: null, pending: null },
    current
  );
} // End of function restoreConfirmationWithdrawn()

/**
 * Records that the restore produced no outcome.
 *
 * **Not an outcome, and not always "nothing was written".** The command failed
 * before any of the three arms existed. Whether the file changed is a **second**
 * question, and the only honest answers are "no" and "this application cannot tell":
 * a failure at or after the rename may have left the candidate on disk.
 *
 * **The reason is `null` here, and that is a limit rather than a policy.**
 * `SendFailure` carries one, and the small editor draws it; a whole-document save
 * cannot, because `RawSaveAnswer`'s failed arm carries only `mayHaveWritten` and
 * 2c-1b's sealed boundary is not this sub-phase's to widen. The raw editor has the
 * identical limit and states it.
 *
 * The send is over, so a delivery held while it was out is applied now: the
 * settlement of an uncertain write arbitrates the held reading under that
 * uncertainty, and its `raisedWithoutReload` is what this applies (Phase 2d-6-5,
 * the 2d-6 record's §3 entry 5), and through the reader every delivery appended to
 * the installed session during the replay is applied too, for
 * {@link applyRestore}'s reason.
 *
 * @param session - The session waiting for an answer, as the caller holds it.
 * @param mayHaveWritten - Whether the file may already hold the candidate.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session, back to its resting state, with the right notice raised.
 */
export function restoreCouldNotBeSent(
  session: RestoreSession,
  mayHaveWritten: boolean,
  current: ReadTheInstalledSession
): RestoreSession {
  // Carried rather than revoked, and carried rather than left behind: nothing a
  // confirmation binds moved, and on the ordinary path there is nothing to carry
  // because the confirmation spent the question before the send. It is written for
  // the same reason the `pending: null` lines elsewhere are — so the rule is true of
  // every path rather than of the ordinary one.
  return consumingHeldDeliveries(
    carryTheQuestion(session, {
      ...session,
      phase: 'editing',
      // The send is over however it ended, so nothing is in flight any more. What
      // was submitted stays on the session: there may be findings to consent to,
      // and this arm has no answer that would spend them.
      inFlight: null,
      sendFailure: sendFailureOf(mayHaveWritten, null)
    }),
    current
  );
} // End of function restoreCouldNotBeSent()

/**
 * Records that the person accepted the findings of the refusal on screen.
 *
 * Delegates to `consentForRefusal`, which delegates to `acknowledgeRefusal` — the
 * **only** producer of consent in this application. The submission is taken from
 * the session rather than from an argument, so a caller cannot pair one candidate's
 * acknowledgement with another candidate.
 *
 * **It withdraws any pending confirmation**, which is consult Q5's *withdrawn on
 * refusal acknowledgement change*. On the ordinary path there is nothing pending —
 * {@link confirmRestore} consumed it before the refused attempt was sent — and the
 * person prepares and confirms again with the findings still on screen; this is what
 * makes that true of every path rather than of the ordinary one.
 *
 * The preview generation does **not** move: the candidate has not changed, and
 * bumping it would invalidate the consent this transition exists to record.
 *
 * **It does nothing while a send is in flight**, because it changes the candidate's
 * draft and `browser.restore.refused.inFlight` says nothing here changes until the
 * file answers. It is not gated on {@link RestoreSession.restored}: a committed
 * outcome is a `saved` arm, which carries no findings to consent to, so
 * `consentForRefusal` already answers the same draft.
 *
 * **The revocation is the first statement, and it is unconditional** — the 2c-5-4b
 * confirmation review's second High, in the form this function had it. The fix round
 * placed it after the state and consent calculation so that "a call which records
 * nothing takes nothing back", and every one of those reads is caller-controlled: a
 * getter on `preview`, on `submitted` or on `outcome` could answer the question from
 * inside the transition that exists to take it back. Taking it back a little too often
 * costs one question that has to be asked again; taking it back a little too late
 * costs a whole-file replacement nobody was asked about. The arms that record nothing
 * now say so by presenting no question either, so the two never disagree.
 *
 * @param session - The session showing a refusal.
 * @returns The session carrying consent, or the same session with nothing pending.
 */
export function acknowledgeRestoreFindings(session: RestoreSession): RestoreSession {
  revokeConfirmation(session);
  const preview = session.preview;
  if (preview === null || session.phase === 'saving') {
    return withNothingPending(session);
  }
  const draft = consentForRefusal(preview.draft, session.submitted, session.outcome);
  if (draft === preview.draft) {
    return withNothingPending(session);
  }
  return { ...session, preview: { ...preview, draft }, pending: null };
} // End of function acknowledgeRestoreFindings()

/**
 * Puts the outcome away.
 *
 * The candidate is untouched — this is a panel being dismissed, not a state being
 * resolved — and the submission goes with it, because there is nothing left on
 * screen to acknowledge. It does **not** give a committed session back:
 * {@link RestoreSession.restored} survives this, so nobody can dismiss their way
 * into replacing a file twice from one confirmation. A committed outcome is
 * therefore dismissible and this is **not** gated on `restored`.
 *
 * **It does nothing while a send is in flight**, for the sentence
 * `browser.restore.refused.inFlight` puts on screen. Nothing about the answer
 * depends on it either way — {@link applyRestore} reads the frozen
 * {@link RestoreSession.inFlight} record — but a panel that emptied under a person
 * mid-send is the change that sentence says cannot happen.
 *
 * **Nor does it erase an external block** — Phase 2d-6-5, the 2d-6 record's §3
 * entry 9. {@link RestoreSession.externalConflict},
 * {@link RestoreSession.uncertaintyUnresolved} and
 * {@link RestoreSession.awaitingReconciliation} all survive this spread: what
 * this dismisses under an external conflict is the save outcome's panel and the
 * reload warning, and the conflict and both restrictions stand until an explicit
 * resolution — the reload's confirmation, or closing. What the spread forces is
 * that the three fields are copied; what no type forces is that a later edit
 * keeps them out of the literal, and the suite's case is what would notice.
 *
 * @param session - The session showing an outcome.
 * @returns The session with nothing being said about the last attempt, or the same
 *   session while a send is in flight.
 */
export function dismissRestoreOutcome(session: RestoreSession): RestoreSession {
  if (session.phase === 'saving') {
    return session;
  }
  // **Carried, because putting a panel away binds nothing.** A refusal on screen can
  // be prepared over — nothing in `restoreRefusal` forbids it — so this really is
  // reachable with a question pending, and leaving the authorization on the session
  // the caller has just replaced would draw a question that confirms nothing.
  return carryTheQuestion(session, {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    reload: NOT_RELOADING,
    sendFailure: null
  });
} // End of function dismissRestoreOutcome()

/**
 * The conflict a reload may be asked about, or `null` when none may be — Phase
 * 2d-6-5, the reload gate of the 2d-6 record's §3 entry 11 as one rule for the
 * three reload steps below.
 *
 * Withheld under an unacknowledged write uncertainty, for the match editor's
 * reason: a confirmed re-targeting onto bytes a write of this window may or may
 * not have produced would settle silently what only the person can. The view
 * withholds the control through the same fact, and the three transitions refuse
 * it, so a call made past the withheld control changes nothing (entry 8).
 *
 * @param session - The session to ask about.
 * @returns The conflict, or `null` when there is none or its reload is withheld.
 */
function reloadableConflictOf(session: RestoreSession): ConflictModel<string> | null {
  return session.uncertaintyUnresolved ? null : conflictOf(session);
} // End of function reloadableConflictOf()

/**
 * Asks to load the version on disk, which is the step **before** confirming.
 *
 * @param session - The session showing a conflict.
 * @returns The session at the warning, or the same session when no conflict is
 *   showing, one has already been asked about, or the reload is withheld
 *   ({@link reloadableConflictOf}).
 */
export function askToReloadDiskVersion(session: RestoreSession): RestoreSession {
  const next = reloadAsked(reloadableConflictOf(session), session.reload);
  return next === null ? session : carryTheQuestion(session, { ...session, reload: next });
} // End of function askToReloadDiskVersion()

/**
 * Confirms moving this window to the version on disk.
 *
 * Issues the token the adoption checks, for **this** conflict. Reachable only from
 * the warning step, so a confirmation cannot be produced by a screen that never
 * showed the warning.
 *
 * @param session - The session at the warning.
 * @returns The session holding the confirmation, or the same session.
 */
export function confirmDiskReload(session: RestoreSession): RestoreSession {
  const next = reloadConfirmed(reloadableConflictOf(session), session.reload);
  return next === null ? session : carryTheQuestion(session, { ...session, reload: next });
} // End of function confirmDiskReload()

/**
 * Adopts the disk version into the window and re-points the candidate at it.
 *
 * **Restore's own reload, and it neither reseeds nor closes.** The candidate is the
 * text read from a backup entry: the conflict did not touch it, adopting the disk
 * observation gives this application no reason to discard it, and there is nothing
 * of the person's on this surface that a close would be protecting. What the
 * adoption really changes is the revision the candidate would be written against, so
 * the base moves to the conflict's `diskRevision`, the confirmation and any
 * acknowledgement are withdrawn, and the person reads the candidate against what the
 * window now holds and confirms again. **There is no *retry restore anyway*** —
 * consult Q4 — and this is why there is no need for one.
 *
 * **Nothing is re-pointed for an adoption the window refused.** A `refused` from
 * `adopt` — a confirmation issued for another conflict, one already spent, a
 * conflict this window did not produce, an unprojected document, or a projection
 * replaced since the conflict arrived when the window does not already hold the
 * requested revision — leaves the session exactly as it was but for the terminal
 * step, because re-pointing over a window that did not move would measure the
 * candidate against bytes nobody installed. Those are
 * `BrowserState.adoptDiskVersion`'s guards **in its order**, not a set applied
 * alike. **`alreadyThere` is not a refusal**: a window already holding the requested
 * revision is answered so, and its confirmation spent, *before* the projection
 * generation is compared at all, so the request is satisfied and the candidate is
 * re-pointed exactly as it is for an install.
 *
 * **It is a withdrawing transition, and the 2c-5-4b confirmation review found it
 * omitted from that list.** Its successful path clears `pending` through
 * {@link measuredAgainst} — but only after `conflictOf(session)`, `session.reload`,
 * the arbitrary `adopt` callback, a spread of the session and `conflict.diskRevision`,
 * every one of which can run caller code and answer the question from inside. The
 * revocation is now the **first statement**, before the conflict is even looked up,
 * and it is unconditional: the arms that answer their own argument revoke as well, and
 * present no question either.
 *
 * **Over-revoking costs nothing reachable here.** A question cannot be pending while a
 * conflict is on screen — `restoreRefusal` refuses `conflictShowing`, so
 * `prepareRestore` answers its argument unchanged — and this transition draws no
 * control except on a conflict. What the unconditional revocation buys is that the
 * claim is about the function rather than about which of its arms a screen can reach.
 *
 * **Since Phase 2d-6-5 the conflict may be a watcher observation's** (the 2d-6
 * record's §3 entry 23's "retarget"): the same adoption, the same candidate
 * kept, the same base moved to the observation's disk revision, and the
 * external conflict and the uncertainty it carried resolved by it — the waits
 * recorded for other observations stand, because an adoption decides nothing
 * about them. Under an unacknowledged write uncertainty the reload is withheld
 * through {@link reloadableConflictOf}, and this answers the session with
 * nothing pending.
 *
 * **What no type here forces**: that `adopt`'s body does anything, and that the
 * window really holds the revision it reported.
 *
 * **The installed session is read twice: once after this function's own reads and
 * immediately before the adoption, and once more after it** (this phase's review, its
 * third finding; 2d-6-4's pattern (c)). The adoption is the window's, and
 * `BrowserState.adoptDiskVersion` copies the observation's projection before it
 * decides — a read of caller data, and a getter there can tell the window of a later
 * reading, which the window decides and hands to the registered receiver while this
 * function is still inside `adopt`. So: a session displaced before the adoption is
 * not re-pointed and the installed session is answered, the window never asked and
 * that session's own confirmation state untouched — a caller that installs the answer
 * keeps what its receiver installed, and through this module's own transitions no
 * question can be pending on a session showing a conflict, so nothing reachable is
 * answered presenting a question it does not authorize. After the adoption the
 * installed session is read again; when it now shows **another conflict** (by source
 * identity) the person must decide about that one, whether the window installed this
 * snapshot or refused it as outlived, so the installed session is answered untouched
 * and nothing is re-pointed over it; when it shows the same conflict with more
 * recorded — a wait, most of all — the retarget and the refused step are built over
 * **it**, revoked as this function revokes its argument, so what the receiver
 * recorded during the adoption survives. What that cannot force is that the required
 * reader is honest ({@link ReadTheInstalledSession}): one answering a capture
 * re-points what it was handed, and a delivery the receiver made during the adoption
 * is lost when the caller installs the answer.
 *
 * @param session - The session holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once.
 * @param current - Reads the session the caller holds now —
 *   `() => session` over the caller's state. Required.
 * @returns The session re-pointed at the disk revision, the session at the terminal
 *   refused step, the same session with nothing pending, or the installed session
 *   when the one handed in is no longer it.
 */
export function reloadTheDiskVersion(
  session: RestoreSession,
  adopt: AdoptTheDiskVersion<string>,
  current: ReadTheInstalledSession
): RestoreSession {
  revokeConfirmation(session);
  // **Every read of this function's own, taken first** — the confirmation
  // snapshot through `confirmationOf`, once, so nothing reads the step again
  // after the look below (Phase 2d-6-8a, `2d-6-6b-notes.md` §7 item 1:
  // `spendTheConfirmedReload` used to read it after that look).
  const step = session.reload;
  const conflict = reloadableConflictOf(session);
  const confirmation = conflict === null ? null : confirmationOf(step);
  // **The installed session, read once, after those reads and immediately
  // before the adoption.** A session no longer installed is not re-pointed, and
  // what is installed is answered so the caller keeps it.
  const installed = current();
  if (installed !== session) {
    return installed;
  }
  if (conflict === null || confirmation === null) {
    // `withNothingPending` reads the session, so its answer goes through the
    // same last look as every other built answer here.
    return settledAnswer(session, withNothingPending(session), current);
  }
  const spend = adopt(conflict, confirmation) === 'refused' ? 'refused' : 'satisfied';
  // **Read once more, after the adoption**, which ran the window's own reads.
  const settled = current();
  if (settled !== session) {
    if (conflictOf(settled)?.source !== conflict.source) {
      // A replacing verdict landed during the adoption: the conflict the
      // receiver installed is the one to decide about now, and nothing is
      // re-pointed over it.
      return settledAnswer(settled, settled, current);
    }
    // The same conflict with more recorded; built over, and revoked as the
    // argument was, so the answer presents what it authorizes.
    revokeConfirmation(settled);
  }
  if (spend === 'refused') {
    // **A terminal step rather than the session unchanged**, which is the 2c-4a-3a
    // review's finding 3: the window said no without a word about which of
    // `adoptDiskVersion`'s ordered guards produced it, so the control stops being
    // offered and the panel says so. That is a decision about what to draw and
    // **not** a claim that a later ask would be refused too — a refusal spends
    // nothing.
    return settledAnswer(settled, { ...settled, reload: RELOAD_REFUSED, pending: null }, current);
  }
  // **`measuredAgainst` rather than `targetRevisionObserved`**, and the difference
  // is load-bearing: that transition answers *unchanged* when the revision it is
  // given is the one the session already holds, which is right for an idle
  // reprojection check and wrong here. A conflict whose `diskRevision` happens to
  // equal this session's base — a file changed and changed back — must still leave
  // the panel with nothing pending and no consent, because a confirmation given
  // before the adoption was given about a different reading of the world.
  const moved = measuredAgainst(
    {
      ...settled,
      submitted: null,
      outcome: null,
      extraMessages: [],
      sendFailure: null,
      // The conflict of either origin is resolved by the adoption, and with it
      // the uncertainty it was raised under; the waits are about other
      // observations, and those the receiver recorded during the adoption are
      // carried too.
      externalConflict: null,
      uncertaintyUnresolved: false
    },
    conflict.diskRevision
  );
  // **Built first, then the final installed-session read** (Phase 2d-6-8a, the
  // shape 2d-6-6b's review gave the editor's reload): the spread, the revocation
  // and `measuredAgainst` all read the settled session, and nothing
  // caller-controlled may run after the look `settledAnswer` takes.
  return settledAnswer(settled, { ...moved, reload: NOT_RELOADING }, current);
} // End of function reloadTheDiskVersion()

/**
 * Takes the window's decision about one watcher observation — Phase 2d-6-5, the
 * 2d-6 record's §3 entries 6, 7, 11 and 12.
 *
 * **The session's receiver, as a value**, in the shape `applyObservation` in
 * `./matchEditor.ts` established: a component registers a function through
 * `BrowserState.registerObservationReceiver` that calls this with the envelope and
 * installs what comes back (`RestorePane.svelte` since Phase 2d-6-8a), and the decision is here so a
 * suite can drive every arm without a window. It never re-arbitrates and reads
 * none of the window's tables.
 *
 * **Every verdict has a named action, switched with a `never` terminus** (entry
 * 11, plus the seventh arm Phase 2d-6-1b added):
 *
 * | Verdict | What this does, for a delivery about this session's destination |
 * |---|---|
 * | `raised` | builds the external model over the retained candidate, and withdraws the pending question — candidate kept, consent gone |
 * | `raisedWithoutReload` | the same, and records that the reload is withheld until the uncertainty is acknowledged |
 * | `supersedes` | `supersedeConflict` over the conflict shown — its draft kept, its disk side replaced — and withdraws the pending question |
 * | `coalesced` | keeps the model, its source identity, the reload step and the pending question |
 * | `notLater` | changes nothing |
 * | `retained` | records the held observation as a restriction on preparing, confirming and sending; no disk comparison, no origin, the question carried |
 * | `writtenHere` | lifts the restriction recorded for that observation, and changes nothing else |
 *
 * **Which deliveries are about this session is decided by the observation's
 * file**, read once, for the three operation sessions' reason: a restore is
 * opened over one destination, and a delivery about another file can only end a
 * wait recorded for that very observation, by identity, under that file's key —
 * it raises nothing here, because a reload of it would re-point the candidate at
 * a file the person never named. A `retained` about another file records
 * nothing. The envelope's two fields and the verdict's `kind` are read once
 * each, before anything is decided.
 *
 * **A replacing verdict is a withdrawal that keeps the candidate** (entries 7
 * and 12): it goes through {@link withdrawn} with the candidate `'kept'`, so the
 * question's authorization is revoked, the confirmation and any consent go, the
 * preview generation moves, and the candidate is untouched; the reload step is
 * reset, so a confirmation collected for the conflict that was on screen is not
 * spendable against the one that replaced it, and a save conflict's outcome is
 * retired so that only one conflict is active — a committed success or a
 * refusal in `outcome` stays as history. `supersedes` builds through
 * `supersedeConflict` when a conflict is shown and through
 * `describeExternalConflict` over the candidate's draft when none is; the
 * `superseded` origin the verdict names is not compared with the shown
 * conflict's — the envelope is the window's decision about the file, and a
 * session that re-checked it would be arbitrating.
 *
 * **The question is suspended across the reads, for {@link targetRevisionObserved}'s
 * reason**: this cannot know whether it withdraws until it has read the verdict's
 * kind and the observation's file, both caller-controlled, and a question absent
 * from the map during those reads is a licence for a re-entrant caller to ask a
 * second one. A replacing verdict about the destination then revokes through
 * {@link withdrawn}, whose deletion the `finally` finds and puts nothing back
 * over; every other arm that answers a new session ends this call's own
 * suspension first and carries the question through {@link carryTheQuestion} —
 * bare `WeakMap` operations, with no user code between the two — and an arm that
 * changes nothing answers through {@link unchangedByInspection}. A question an
 * *outer* inspection owns is not this call's to carry, so a delivery reached
 * from inside {@link targetRevisionObserved} or {@link candidateRead} answers a
 * session presenting none; that is the safe direction, and the phase record
 * says so.
 *
 * **During this session's own replacement the envelope is appended to the held
 * list, not applied** (entry 5): see {@link RestoreSession.heldDeliveries}. **A
 * spent session takes a delivery too**, as the deleter's does after a committed
 * deletion: the conflict stands beside the committed outcome, the reload is
 * offered — it installs the disk observation into the window, which is a fact
 * about the window and not about this candidate — and the doors refuse for the
 * commit before they refuse for the conflict. This surface has no "closed"
 * state; the pane is closed by the person.
 *
 * **What it forces and what it does not, in the same sentence.** It forces that
 * every arm of `ObservationVerdict` has an action here — an eighth arm is a
 * compile error at the terminus — and that no arm installs, adopts, spends or
 * calls a command, which its signature cannot prove and the command spy at zero
 * in `workspace.test.ts` does. It cannot force that a component registers it,
 * over which files, or installs what it answers; nor that the envelope was sealed
 * by the window rather than assembled by hand.
 *
 * @param session - The session.
 * @param delivery - What the window decided, sealed with the observation.
 * @returns The session after the decision, or the same session when the verdict
 *   changes nothing about it.
 */
export function applyRestoreObservation(
  session: RestoreSession,
  delivery: ObservationDelivery
): RestoreSession {
  const suspension = suspendTheQuestion(session);
  try {
    // **The caller-controlled reads, taken once and first.**
    const observation = delivery.observation;
    const kind = delivery.verdict.kind;
    const file = observation.document;
    if (session.phase === 'saving') {
      return carriedPast(session, suspension, {
        ...session,
        heldDeliveries: [...session.heldDeliveries, delivery]
      });
    }
    // The decision about an awaited observation ends the wait for it, whatever
    // the decision is and whichever file it is about; any other observation
    // leaves every wait standing.
    const waits = session.awaitingReconciliation;
    const stillWaiting = waits.get(file) === observation ? withoutWait(waits, file) : waits;
    const about = session.target === file;
    switch (kind) {
      case 'retained':
        // A `retained` ends no wait: a re-held reading is still held.
        return about
          ? carriedPast(session, suspension, {
              ...session,
              awaitingReconciliation: withWait(waits, file, observation)
            })
          : unchangedByInspection(session, suspension);
      case 'writtenHere':
      case 'coalesced':
      case 'notLater':
        return stillWaiting === waits
          ? unchangedByInspection(session, suspension)
          : carriedPast(session, suspension, { ...session, awaitingReconciliation: stillWaiting });
      case 'raised':
      case 'supersedes':
        return about
          ? replacedBy(session, observation, false, stillWaiting)
          : liftedPast(session, suspension, waits, stillWaiting);
      case 'raisedWithoutReload':
        return about
          ? replacedBy(session, observation, true, stillWaiting)
          : liftedPast(session, suspension, waits, stillWaiting);
      default: {
        const unreachable: never = kind;
        return unreachable;
      }
    }
  } finally {
    restoreTheQuestion(session, suspension);
  }
} // End of function applyRestoreObservation()

/**
 * The session with its waits replaced by a replacing verdict about another file,
 * question carried — the arm of {@link applyRestoreObservation} that lifts a
 * wait and raises nothing.
 *
 * @param session - The session being inspected.
 * @param suspension - What {@link suspendTheQuestion} answered for it.
 * @param waits - The waits it held.
 * @param stillWaiting - The waits after this delivery.
 * @returns The same session when no wait ended, or a successor carrying the
 *   question.
 */
function liftedPast(
  session: RestoreSession,
  suspension: SuspendedQuestion | undefined,
  waits: ReadonlyMap<DocumentId, ExternalConflictObservation>,
  stillWaiting: ReadonlyMap<DocumentId, ExternalConflictObservation>
): RestoreSession {
  return stillWaiting === waits
    ? unchangedByInspection(session, suspension)
    : carriedPast(session, suspension, { ...session, awaitingReconciliation: stillWaiting });
} // End of function liftedPast()

/**
 * Ends this call's own suspension and moves the question to the session that
 * replaces the inspected one.
 *
 * **Two bare `WeakMap` sequences with no user code between them**, and the order
 * is the point: {@link carryTheQuestion} refuses a suspended question, because
 * another call may own it, so the cell this call owns is put back first through
 * {@link restoreTheQuestion} — which puts nothing back over a cell a getter's
 * withdrawal deleted — and then taken across. `to` was built before this is
 * entered, so the one caller-controlled operation on the path happened while the
 * question was still suspended. A suspension this call does not own — an outer
 * inspection's, or none — is left exactly where it is, and the successor then
 * presents no question, which is the safe direction. The `finally` that follows
 * finds nothing of this call's under the old key and does nothing.
 *
 * @param from - The session the question was asked on.
 * @param suspension - What {@link suspendTheQuestion} answered for it.
 * @param to - The session that replaces it, already built.
 * @returns `to`, carrying the question when this call held it.
 */
function carriedPast(
  from: RestoreSession,
  suspension: SuspendedQuestion | undefined,
  to: RestoreSession
): RestoreSession {
  restoreTheQuestion(from, suspension);
  return carryTheQuestion(from, to);
} // End of function carriedPast()

/**
 * The session after a verdict that puts a new origin in front of it.
 *
 * The shared body of the three replacing arms of
 * {@link applyRestoreObservation}, which documents what happens here; this is
 * the one place the external model is built for this surface from a delivery,
 * and the one place a pending question is withdrawn by a fact about the file
 * rather than by the person (entry 12). {@link withdrawn} is its first act — its
 * revocation deletes the suspension cell the caller holds, so the caller's
 * `finally` puts nothing back — and the candidate is `'kept'`.
 *
 * The draft the model retains is the candidate's own when one is retained, and a
 * draft of the empty string at the session's base revision when none is —
 * {@link RestoreSession.externalConflict} says what that placeholder is and is
 * not. A shown conflict's draft is carried instead, as history, through
 * `supersedeConflict`. **Over no candidate the model's lines are the file's own
 * first line alone** (this phase's review, its fourth finding): the two lines
 * the surface's declaration writes say a candidate is kept and that a reload
 * keeps it and withdraws a confirmation, and a session that retains none has
 * nothing either sentence is about — see {@link overNoCandidate}.
 *
 * @param session - The session, not saving.
 * @param observation - The observation the verdict is about.
 * @param uncertaintyUnresolved - Whether the verdict was `raisedWithoutReload`.
 * @param awaitingReconciliation - The waits still held after this delivery.
 * @returns The session showing the new conflict, with nothing pending.
 */
function replacedBy(
  session: RestoreSession,
  observation: ExternalConflictObservation,
  uncertaintyUnresolved: boolean,
  awaitingReconciliation: ReadonlyMap<DocumentId, ExternalConflictObservation>
): RestoreSession {
  const cleared = withdrawn(session, 'kept');
  const shown = conflictOf(cleared);
  const preview = cleared.preview;
  const described =
    shown === null
      ? describeExternalConflict(
          observation,
          preview?.draft ?? startDraft(cleared.baseRevision, '', textDraftRules),
          CONFLICT_CAPABILITIES
        )
      : supersedeConflict(shown, observation, CONFLICT_CAPABILITIES);
  const externalConflict = preview === null ? overNoCandidate(described) : described;
  // A save conflict is retired with its submission (entry 7); a refusal or a
  // success stays, as history, with the submission a refusal's consent needed —
  // the consent itself went with the withdrawal above.
  const retiring = conflictArm(cleared.outcome) !== null;
  return {
    ...cleared,
    externalConflict,
    uncertaintyUnresolved,
    awaitingReconciliation,
    outcome: retiring ? null : cleared.outcome,
    submitted: retiring ? null : cleared.submitted,
    extraMessages: retiring ? [] : cleared.extraMessages,
    // Entry 12: the confirmation collected for the conflict that was on screen
    // is not spendable against this one, nor may its warning stay on screen
    // saying the wrong thing (the record's §5.7).
    reload: NOT_RELOADING
  };
} // End of function replacedBy()

/**
 * The external model with every line about a candidate left out, for a session
 * that retains none — this phase's review, its fourth finding.
 *
 * `describeExternalConflict` writes three lines from a surface's declaration:
 * the file's own, then *what you asked for here is still set up* and *loading the
 * version on disk … leaves this panel open with the same text still selected
 * here … your confirmation is withdrawn*. Over the placeholder draft the second
 * and third describe a candidate that was never chosen and a confirmation that
 * was never given, so only the first is kept — the tuple type admits one line,
 * and it is the one line that is true of the file. **What this forces** is that
 * a model built over no candidate carries no sentence about one; **what it does
 * not** is that a candidate chosen *afterwards*, under the standing conflict,
 * regains the two lines — the model is built when the verdict lands and a later
 * selection rebuilds nothing. The other direction, a candidate *dropped* under
 * the standing conflict, is the view's since Phase 2d-6-8b: {@link restoreView}
 * leaves both lines out of what it answers whenever no candidate is retained
 * (2d-6-5 §4 item 12).
 *
 * @param model - The model as the declaration described it.
 * @returns The same disk side and draft, with the file's line alone.
 */
function overNoCandidate(model: ExternalConflictModel<string>): ExternalConflictModel<string> {
  return { ...model, messages: [model.messages[0]] };
} // End of function overNoCandidate()

/**
 * Records that the person has reviewed the disk snapshot and the window has ended
 * the uncertainty hold — Phase 2d-6-5, the 2d-6 record's §3 entries 14 and 15.
 *
 * `acknowledgeSnapshot` in `./matchEditor.ts`, for this session, taking the same
 * two-valued callback: it rebuilds the conflict's availability and nothing else —
 * the reload is offered again from its idle step — installing nothing, minting no
 * consent and re-observing nothing. Asked at most once per call and only when
 * there is something to end; a `refused` leaves the session unchanged. A question
 * cannot be pending under an external conflict through this module's own
 * transitions, and one a session assembled by hand carries is moved to the
 * answer through {@link carryTheQuestion}, as the two reload steps move it: an
 * acknowledgement changes nothing a confirmation binds. What it cannot see is a
 * hold the window ended without a delivery, stated on
 * {@link RestoreSession.uncertaintyUnresolved}.
 *
 * @param session - The session showing a conflict raised under uncertainty.
 * @param acknowledge - The window's two acknowledgement members, composed.
 * @returns The session with its reload available again, or the same session.
 */
export function acknowledgeRestoreSnapshot(
  session: RestoreSession,
  acknowledge: AcknowledgeTheUncertainty
): RestoreSession {
  const conflict = session.externalConflict;
  if (conflict === null || !session.uncertaintyUnresolved) {
    return session;
  }
  if (acknowledge(conflict.source) !== 'acknowledged') {
    return session;
  }
  return carryTheQuestion(session, {
    ...session,
    uncertaintyUnresolved: false,
    reload: NOT_RELOADING
  });
} // End of function acknowledgeRestoreSnapshot()

/**
 * Why a reapply of this session's candidate could not be carried out.
 *
 * **The shared obstacles and nothing else**, and neither of them is reachable
 * from this surface: {@link reapplyToDiskVersion} answers `unavailable` before
 * it has looked at any evidence. The alias exists so that {@link RestoreReapply}'s
 * shape is the one the five match surfaces answer with.
 */
export type RestoreReapplyObstacle = SharedReapplyObstacle;

/** What a reapply of this session's candidate became. Always `unavailable`. */
export type RestoreReapply = ReapplyOutcome<RestoreSession, RestoreReapplyObstacle>;

/**
 * The guard {@link reapplyToDiskVersion} hands `enterReapply`, which never asks
 * it: the entry reads this surface's permanent `reapplySupport` before it looks
 * at the conflict, and `unavailable` returns before the guard could be reached.
 * Were it ever asked it would answer `null` — the conservative *superseded* —
 * rather than vouch for an origin it cannot see.
 */
const NEVER_ASKED: StandingOriginGuard = (): ConflictSource | null => null;

/**
 * Refuses to reapply this session's candidate, permanently and by construction —
 * Phase 2d-6-5, the 2d-6 record's §3 entry 22, as a value.
 *
 * `reapplyToDiskVersion` in `./rawEditor.ts`, for this surface, and for the same
 * reason (consult Q4 of 2c-4b): the candidate is a whole document, so there is
 * no target, no field intent and no operation to re-resolve against a newly
 * parsed file, and "reapply" could only mean overwriting the newly read disk
 * text with a stale string or inventing a text merge. **It takes no adoption
 * function and cannot spend one.** It enters through `enterReapply` in
 * `./reapply.ts`, which answers `unavailable` from this surface's own permanent
 * `ConflictCapabilities.reapplySupport` **before** it looks at the conflict, so a
 * conflict of either origin changes nothing here — the declared unsupported
 * reapply, never a supported one that always falls back. The honest way to the
 * disk version stays the reload, which keeps the candidate.
 *
 * **What no type forces**: that a caller does not simply build a `reapplied`
 * outcome of its own. What is closed is that nothing in this module produces
 * one, and that no adoption of a disk snapshot can be reached from this
 * surface's reapply path at all.
 *
 * @param session - The session, showing a conflict of either origin or not. Read
 *   only to ask which conflict it holds, which does not change the answer.
 * @returns The `unavailable` arm, always.
 */
export function reapplyToDiskVersion(session: RestoreSession): RestoreReapply {
  const start = enterReapply(CONFLICT_CAPABILITIES, conflictOf(session), NEVER_ASKED);
  // **`start` is `unavailable` here, every time**, for the raw editor's reason;
  // the narrowing exists because `ReapplyEntry` has three arms whatever this
  // surface declares.
  return start.kind === 'ready' ? { kind: 'unavailable' } : start;
} // End of function reapplyToDiskVersion()

/** Everything a screen needs about one restore, derived on every read. */
export interface RestoreView {
  /** The file this restore would replace. */
  readonly target: DocumentId;
  /** The revision it is expected to hold. */
  readonly baseRevision: ContentRevision;
  /** What the batch catalogue has answered. */
  readonly batches: CatalogueState<BackupBatchListing>;
  /** The batch whose entries are listed, or `null`. */
  readonly batch: BackupBatchId | null;
  /** What the entry catalogue has answered. */
  readonly entries: CatalogueState<BackupEntryListing>;
  /** The entry whose text was asked for, or `null`. */
  readonly entry: BackupEntryId | null;
  /** The retained candidate, or `null`. */
  readonly preview: RestorePreview | null;
  /** Whether the prepare control does anything. */
  readonly canPrepare: boolean;
  /** Why it does not, as a code, or `null`. */
  readonly refusal: RestoreRefusal | null;
  /**
   * Whether a prepared restore is presented for confirmation — presentation
   * (`pending !== null`), not the private authorization's state.
   */
  readonly confirming: boolean;
  /** Whether a replacement is in flight. */
  readonly restoring: boolean;
  /** Whether one has committed, so this session is spent. */
  readonly restored: boolean;
  /** How the last attempt failed to produce an outcome, or `null`. */
  readonly sendFailure: SendFailure | null;
  /** The reasons to show beside that failure, outermost first. */
  readonly failureLines: readonly SendFailureLine[];
  /** How the last attempt ended, or `null`. */
  readonly outcome: SaveOutcomeModel<string> | null;
  /**
   * The outcome's lines followed by anything to be said beside them.
   *
   * **Less `operationKeptInMemory` and `reloadRetargetsCandidate` once no
   * candidate is retained** — Phase 2d-6-8b, the decision 2d-6-5 §4 item 12
   * handed on. `chooseBatch` and `chooseEntry` stay open under a conflict, so a
   * person can drop the candidate while the panel stands, and the two lines the
   * model wrote when the conflict arrived would then say a candidate is kept and
   * that a reload keeps it. The lines follow the live preview on every read;
   * what this forces is that no view derived from a session without a preview
   * carries either line, and what it does not is anything about a sentence a
   * renderer draws from somewhere else.
   */
  readonly messages: readonly SaveOutcomeMessage[];
  /**
   * The external conflict's own lines, or none — Phase 2d-6-5.
   *
   * Beside {@link RestoreView.messages} and never merged into it, for
   * `MatchEditorView.externalMessages`'s reason: a panel drawing `view.conflict`
   * outside the save-outcome branch (the 2d-6 record's §3 entry 10) draws nothing
   * twice. Rendered through `tConflictMessage`; `RestorePane.svelte` draws it in
   * its external panel since Phase 2d-6-8b. **Less the two candidate lines once
   * no candidate is retained** (2d-6-8b, 2d-6-5 §4 item 12): see
   * {@link RestoreView.messages}.
   */
  readonly externalMessages: readonly ConflictMessage[];
  /**
   * The lines owed while an observation cannot be acted on — Phase 2d-6-5.
   *
   * `writeOutcomeUnknown` first, `observationRetained` second, from the session's
   * own fields. Since Phase 2d-6-9b-2 no renderer draws them as sentences: the pane's
   * `FileReconciliationStatus.svelte` block says both states once, above the panel,
   * and `RestorePane.svelte` reads this list only through `surfaceAcknowledgementOwed` in
   * `./reconciliationStatus.ts`, to decide whether to draw the acknowledgement.
   */
  readonly externalNotices: readonly ExternalConflictNotice[];
  /**
   * The notices less the one the refusal line on screen already says — Phase
   * 2d-6-8b, `MatchMoveView.noticesBesideRefusal`'s rule.
   *
   * `restoreRefusalKey` renders an `observationRetained` refusal through that
   * notice's own sentence, so a pane drawing the refusal and every notice would
   * print it twice, one line apart. `noticesBesideRefusal` in
   * `./observationDelivery` decides it; **what it cannot check** is that the
   * refusal key keeps rendering the notice's sentence, which
   * {@link restoreRefusalKey} does today by calling `externalConflictNoticeKey`.
   * **No renderer reads it since Phase 2d-6-9b-2**, when the panels stopped drawing
   * their notices; it is kept as a tested value and its removal is an open item of
   * that phase's record.
   */
  readonly noticesBesideRefusal: readonly ExternalConflictNotice[];
  /** The presentation changes a saved arm disclosed, in report order. */
  readonly notes: readonly PresentationNote[];
  /**
   * What to offer about a refusal, withdrawn once its findings are stale.
   *
   * Under an external block — a conflict the watcher raised or a held reading —
   * the dismissal alone (Phase 2d-6-5): *Save anyway* would reach
   * {@link prepareRestore}, which answers the same session to it, and a control
   * that does nothing when pressed is the defect `conflictChoicesFor` exists to
   * stop.
   */
  readonly refusalChoices: readonly RawSaveChoice[];
  /**
   * Whether the findings on screen are about a candidate that has since changed.
   *
   * **`false` on every path this module can reach today**, and the field is here
   * anyway rather than hard-coded: a retained candidate is never edited, so the
   * submission and the draft's value are the same bytes for as long as both exist,
   * and choosing a different entry drops the outcome with the preview. Asking
   * `submissionIsStale` rather than writing `false` is what keeps this answer the
   * draft's own — the same rule `offeredRefusalChoices` is given — so a later
   * transition that does move a candidate under a refusal cannot leave the *Save
   * anyway* offer standing beside findings about other bytes.
   */
  readonly findingsAreStale: boolean;
  /** The conflict being shown, or `null`. */
  readonly conflict: ConflictModel<string> | null;
  /** What to offer about the conflict. */
  readonly conflictChoices: readonly ConflictChoice[];
  /** Whether the warning is showing and the destructive choice is one click away. */
  readonly awaitingReloadConfirmation: boolean;
  /** Whether a confirmed reload was spent and the window refused it. */
  readonly reloadUnavailable: boolean;
  /**
   * Which sentence stands where the reload control has gone, or `null` when it
   * has not gone — Phase 2d-6-8b, 2d-6-5 §4 item 12.
   *
   * `candidateKept` while a candidate is retained and `noCandidate` once none
   * is: the shared operation sentence says *what you asked for here is still set
   * up*, which a candidate dropped under the standing conflict falsifies.
   * Rendered through `tRestoreReloadUnavailable`.
   */
  readonly reloadUnavailableLine: RestoreReloadUnavailable | null;
  /** The disk side of that conflict, or `null` when none is showing. */
  readonly diskText: ConflictDiskText | null;
  /**
   * What the retained candidate **asked for**, or `null` when no conflict is
   * showing — or when no candidate is retained, of either origin: the sentence
   * names *the backup entry selected here*, and a session told of a change
   * before any entry was read has selected none (Phase 2d-6-5's review, its
   * fourth finding), while one whose candidate was dropped under the standing
   * conflict no longer has one selected (Phase 2d-6-8b, 2d-6-5 §4 item 12). A
   * save conflict names it for as long as the candidate that was sent is
   * retained.
   *
   * Constant while a conflict is showing over a candidate, because a restore
   * asks for one thing. It is decided here rather than assembled in markup,
   * because a description written into one renderer is carried by that
   * renderer's mounted suite alone.
   */
  readonly conflictOperation: ConflictOperation | null;
}

/**
 * What this surface offers about the conflict it is showing **now**, derived from
 * the declaration and one fact about the session — Phase 2d-6-5, the 2d-6
 * record's §3 entry 11.
 *
 * The declaration {@link CONFLICT_CAPABILITIES} is permanent; this is the
 * "effective capabilities" the consult's Q3 names. The reload is withheld under
 * an unacknowledged write uncertainty, for the match editor's reason; the reapply
 * is never offered here, so a held reading withholds nothing this surface
 * declares. It feeds `conflictChoicesFor`, which stays the only producer of a
 * choice list; what this cannot force is that the transitions honour the same
 * fact, which is why each reload step asks {@link reloadableConflictOf}.
 *
 * @param session - The session to derive for.
 * @returns The capabilities to offer choices from.
 */
function effectiveCapabilitiesOf(session: RestoreSession): ConflictCapabilities {
  return session.uncertaintyUnresolved
    ? { ...CONFLICT_CAPABILITIES, offersReload: false }
    : CONFLICT_CAPABILITIES;
} // End of function effectiveCapabilitiesOf()

/**
 * The notices one session owes, in the order the stronger claim comes first.
 *
 * The uncertainty first, because it is the one state under which the conflict on
 * screen offers no way to the disk version, and the held observation second.
 * Each is answered from one session field and nothing is read twice.
 *
 * @param session - The session to describe.
 * @returns The codes, possibly none.
 */
function externalNoticesOf(session: RestoreSession): readonly ExternalConflictNotice[] {
  const notices: ExternalConflictNotice[] = [];
  if (session.externalConflict !== null && session.uncertaintyUnresolved) {
    notices.push({ kind: 'writeOutcomeUnknown' });
  }
  if (awaitedFor(session) !== null) {
    notices.push({ kind: 'observationRetained' });
  }
  return notices;
} // End of function externalNoticesOf()

/**
 * One conflict's lines, less the two that describe a retained candidate when
 * none is retained — Phase 2d-6-8b, the decision 2d-6-5 §4 item 12 handed on.
 *
 * `operationKeptInMemory` says *what you asked for here is still set up* and
 * `reloadRetargetsCandidate` says a reload leaves *the same text still selected
 * here*; a session whose candidate was dropped under the standing conflict has
 * neither. Every other line is kept in its order. **What it forces** is only
 * that: it filters by kind, so a third line about a candidate added to a
 * producer later is not caught here.
 *
 * @typeParam M - The line type of the list.
 * @param lines - The lines as the model wrote them.
 * @param retained - Whether the session retains a candidate now.
 * @returns The lines, the same list when a candidate is retained.
 */
function aboutTheCandidate<M extends { readonly kind: string }>(
  lines: readonly M[],
  retained: boolean
): readonly M[] {
  return retained
    ? lines
    : lines.filter(
        (line) => line.kind !== 'operationKeptInMemory' && line.kind !== 'reloadRetargetsCandidate'
      );
} // End of function aboutTheCandidate()

/**
 * Everything a screen needs about one restore.
 *
 * Derived on every call and stored nowhere, which is 2c-1a's D2 carried up.
 *
 * @param session - The session to describe.
 * @param context - What this window observes about the destination and about its
 *   own open surfaces. The refusal depends on both, so the view cannot be derived
 *   without them — which is what stops a screen drawing an enabled control beside a
 *   rule it did not ask about.
 * @returns The view.
 */
export function restoreView(
  session: RestoreSession,
  context: RestoreContext
): RestoreView {
  const outcome = session.outcome;
  const refused = refusedArm(outcome);
  const stale =
    session.preview === null
      ? false
      : submissionIsStale(session.preview.draft, session.submitted);
  const conflict = conflictOf(session);
  const saved = outcome !== null && outcome.kind === 'saved' ? outcome : null;
  const conflictChoices =
    conflict === null
      ? []
      : conflictChoicesFor(effectiveCapabilitiesOf(session), offeredReloadStep(session.reload));
  const externallyBlocked = session.externalConflict !== null || awaitedFor(session) !== null;
  const refusalChoices = offeredRefusalChoices(refused, stale);
  const refusal = restoreRefusal(session, context);
  const notices = externalNoticesOf(session);
  // **Whether a candidate is retained, read once and on every view** — the
  // decision 2d-6-5 §4 item 12 handed to Phase 2d-6-8b: the lines that say a
  // candidate is kept follow the live preview rather than the moment the
  // conflict arrived.
  const retained = session.preview !== null;
  const unavailable = conflict !== null && reloadWasRefused(session.reload);
  return {
    target: session.target,
    baseRevision: session.baseRevision,
    batches: session.batches,
    batch: session.batch,
    entries: session.entries,
    entry: session.entry,
    preview: session.preview,
    canPrepare: canPrepareRestore(session, context) && session.pending === null,
    refusal,
    confirming: session.pending !== null,
    restoring: session.phase === 'saving',
    restored: session.restored,
    sendFailure: session.sendFailure,
    failureLines: sendFailureLines(session.sendFailure?.reason ?? null),
    outcome,
    messages:
      outcome === null
        ? []
        : aboutTheCandidate([...outcome.messages, ...session.extraMessages], retained),
    externalMessages:
      session.externalConflict === null
        ? []
        : aboutTheCandidate(session.externalConflict.messages, retained),
    externalNotices: notices,
    noticesBesideRefusal: noticesBesideRefusal(
      notices,
      refusal?.kind === 'observationRetained' ? 'observationRetained' : null
    ),
    notes: saved === null ? [] : saved.notes,
    refusalChoices: externallyBlocked
      ? refusalChoices.filter((choice) => choice === 'keepEditing')
      : refusalChoices,
    findingsAreStale: refused !== null && stale,
    conflict,
    conflictChoices,
    awaitingReloadConfirmation: conflict !== null && atTheReloadWarning(session.reload),
    reloadUnavailable: unavailable,
    reloadUnavailableLine: unavailable ? (retained ? 'candidateKept' : 'noCandidate') : null,
    diskText: conflictDiskText(conflict),
    // A conflict of either origin over no retained candidate names no operation:
    // the sentence would describe an entry nobody selected, or one the person
    // has since dropped (2d-6-5 §4 item 12).
    conflictOperation: conflict === null || !retained ? null : 'replaceFileFromBackup'
  };
} // End of function restoreView()

/**
 * The base revision this session would restore against.
 *
 * A named read rather than a property walk at the call site, and the value nothing
 * downstream may substitute: `BrowserState.saveRawDocument` forwards what it is
 * given, so a caller that read the projection's current revision instead would turn
 * the conflict that should stop a stale restore into a commit over bytes nobody
 * looked at. {@link sendRestore} reads it off the permit the confirmation minted and
 * never from a caller.
 *
 * **What no type forces**, in the same sentence: that parameter is an ordinary
 * `ContentRevision`, so a caller reaching `BrowserState.saveRawDocument` by hand may
 * pass anything. What is closed is that this module never chooses another.
 *
 * @param session - The session to ask about.
 * @returns The revision the session is measured against.
 */
export function baseRevisionOf(session: RestoreSession): ContentRevision {
  return session.baseRevision;
} // End of function baseRevisionOf()
