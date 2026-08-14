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
 * the world moves under it. What authorizes a write is a **permit**: a module-private
 * record of the five bound values *and the exact candidate*, held in a `WeakMap`
 * keyed by the confirmed object and reachable from nowhere else.
 * {@link sendRestore} is the only function here that hands anything to a sender; it
 * takes the **live** session and the **live** context, rechecks every bound value
 * against them, and **spends the permit synchronously before the sender is called**.
 * A confirmation carried past a change to the destination, the base revision, the
 * entry, the candidate, the preview generation, the revision this window projects, or
 * the surfaces it has open sends nothing at all.
 *
 * The spend happens **twice, at two runtime memberships**, because a value-typed
 * record cannot spend itself: {@link confirmRestore} takes the question out of
 * {@link PENDING_CONFIRMATIONS} with a **checked** `delete` whose success *is* the
 * authorization — one operation, so no getter and no proxy trap runs between deciding
 * and spending — before it mints a permit, and {@link sendRestore} removes the permit
 * from `PERMITS` before it calls the sender. So one question yields at most one permit
 * and one permit yields at most one send — one answered question authorizes at most
 * one write. What that does **not** say is that a session
 * can be asked only once: {@link prepareRestore} mints a fresh question every time it
 * is called on a session with none pending, and each is its own authorization,
 * because asking again *is* asking again. The construct — runtime membership keyed on
 * the value the answer arrived on, so a spend is bound to its origin — is
 * `rememberTheConflict`'s in `./workspace.svelte.ts`, one operation along.
 *
 * ## What no type here forces, in the same sentence as what one does
 *
 * `matchDeletion.ts` has the identical limitation and states it, and this is that
 * statement for this module.
 *
 * **What is forced** is that a write this module issues carries an **unspent permit
 * whose bound values still describe the session and the window at the moment of the
 * send**, and that the permit came from a question that had not been answered before.
 * {@link confirmRestore} is the only producer of a permit; it needs a
 * {@link PendingRestore} that its own checked deletion finds still in
 * {@link PENDING_CONFIRMATIONS}, whose only producer and only registrar is
 * {@link prepareRestore}; `PENDING`
 * and `STARTED` are `unique symbol`s this module never exports, so no literal
 * outside it can have either type; and neither membership is a property of anything —
 * both are weak-collection entries, so reflection, spread and `structuredClone` all
 * find nothing to copy, a clone of a {@link PendingRestore} is not a member of the
 * set, and a clone of a {@link StartedRestore} is not a key of the map.
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
 * {@link PendingRestore}, so any caller that reaches {@link prepareRestore} again with
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
  PresentationNote
} from '../ipc/types';
import {
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
  spendTheConfirmedReload,
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
import type { RawSaveChoice } from './rawSave';
import {
  conflictChoicesFor,
  conflictDiskText,
  describeWholeDocumentSave,
  invalidationFailureMessage,
  type ConflictCapabilities,
  type ConflictChoice,
  type ConflictDiskText,
  type ConflictModel,
  type ConflictOperation,
  type SaveOutcomeMessage,
  type SaveOutcomeModel
} from './saveOutcome';
import type { RawSaveAnswer } from './workspace.svelte';

/**
 * One kind of surface this window can have open that writes a file.
 *
 * **Seven kinds, and restore is one of them**, which is consult Q4 read exactly:
 * a restore is a write surface for its target like any other, so a coordinator's
 * value has to be able to say so. The six that *compete* with restore are
 * {@link CompetingWriteSurfaceKind}, and the phrase in the consult — "all six
 * competing surface kinds" — is those six.
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
  /** A restore over the file is open. */
  | 'restore';

/**
 * The six surface kinds a restore refuses to run beside.
 *
 * **Derived by exclusion rather than written out**, so a seventh member of
 * {@link OpenWriteSurfaceKind} joins this type automatically and becomes a compile
 * error in {@link openWriteSurfaceKey} rather than a silently unrefused surface.
 */
export type CompetingWriteSurfaceKind = Exclude<OpenWriteSurfaceKind, 'restore'>;

/**
 * One write surface this window has open, and which file it is about.
 *
 * **Only the file is carried, and that is the point** — the same argument
 * `documentHasUnsavedDraft` in `./matchDuplication.ts` makes for a draft: a form
 * minted over an *earlier* parse of the file is stranded by a whole-document
 * replacement exactly as a current one is, because the write gives every identity
 * in the file a new revision. Comparing anything finer would let the very surface
 * this rule protects slip through.
 *
 * **A creator with no chosen destination produces no value of this type**, which is
 * consult Q4's "creator with a chosen target": a form that names no file competes
 * with no restore, and a coordinator that invented a document for it would refuse
 * restores of files nobody was writing to.
 */
export interface OpenWriteSurface {
  /** What kind of surface it is. */
  readonly kind: OpenWriteSurfaceKind;
  /** The file it would write, by the identity this window holds. */
  readonly document: DocumentId;
}

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
    if (surface.kind !== 'restore' && surface.document === document) {
      return surface.kind;
    }
  } // End of the loop over every open write surface
  return null;
} // End of function competingSurfaceFor()

/**
 * Why this application will not prepare or confirm a restore right now.
 *
 * **A code, never a sentence** (`CLAUDE.md` section 2). {@link restoreRefusalKey}
 * maps it to a dictionary key; a component never builds the key.
 *
 * **There is no reactive `t*` accessor for these yet, and that is 2c-5-3's
 * boundary.** Nothing draws them, so 2c-5-4 adds the accessor in `../i18n` together
 * with the panel that renders it — `deletionReapplyObstacleKey`'s precedent at
 * 2c-4b-2, and the reason is mechanical as well as tidy: `../i18n/index.ts` is
 * reachable from the application entry, so importing this module there would put a
 * model nothing draws into the production bundle.
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
      /** A conflict is on screen and has not been resolved. */
      readonly kind: 'conflictShowing';
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
 * **Every one of the six sentences claims an open surface and nothing more.** None
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
  }
} // End of function openWriteSurfaceKey()

/**
 * The dictionary key holding one refusal's sentence.
 *
 * The `writeSurfaceOpen` arm delegates to {@link openWriteSurfaceKey} rather than
 * carrying a sentence of its own, so *which* surface is open is said once.
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
    case 'conflictShowing':
      return 'browser.restore.refused.conflictShowing';
    case 'alreadyRestored':
      return 'browser.restore.refused.alreadyRestored';
  }
} // End of function restoreRefusalKey()

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
 * A restore the person has been asked about and has not yet confirmed.
 *
 * **The five values consult Q5 binds**, and {@link confirmRestore} rechecks every
 * one of them against the session *and* asks the window for the sixth thing — the
 * revision the live projection gives the destination — before it will produce
 * anything to send.
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
 * Every question that has been asked and not yet answered, by the object itself.
 *
 * **The membership *is* the authorization, and it is the fix for 2c-5-3's H1 in the
 * narrower form its confirmation round found.** The five fields on a
 * {@link PendingRestore} are all values — two numbers and three strings, one of them
 * inside a nested identity — so they compare equal however many copies of the object
 * exist. Consuming the request by writing `pending: null` into the session
 * {@link confirmRestore} *returns* therefore spends nothing at runtime: a caller that
 * discards the returned session, or that kept a `structuredClone` of the one it
 * passed in, still holds a value that satisfies every field check and could mint a
 * second permit over the same answered question.
 *
 * So membership in this set is what {@link confirmRestore} actually spends, and it
 * spends it by a **checked deletion**: `WeakSet.delete` answers whether the question
 * was still a member *and* removes it in one operation that runs no user code, so the
 * test and the spend cannot come apart. Testing with `has` and deleting several lines
 * later is not the same guarantee and was this defect's second form — every property
 * read between the two can reach a getter or a proxy trap, and a caller that re-enters
 * there gets one question answered twice. {@link prepareRestore} is the set's only
 * producer; the deletion is placed **after every confirmation check and before the
 * permit is minted**, so a refused confirmation leaves the question askable and no
 * path, ordinary or re-entrant, reaches {@link PERMITS} twice for one question. A
 * clone is not a member, because `structuredClone` copies fields and a `WeakSet` is
 * not a field.
 *
 * The construct is {@link PERMITS}'s one step earlier, and `rememberTheConflict`'s in
 * `./workspace.svelte.ts`: runtime membership keyed on the object the answer arrived
 * on, reachable from nowhere else.
 */
const PENDING_CONFIRMATIONS = new WeakSet<PendingRestore>();

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
   * {@link confirmRestore}'s checked deletion from {@link PENDING_CONFIRMATIONS}, and
   * no value on a session can do it.
   */
  readonly previewGeneration: number;
  /**
   * The question this session **presents** as pending, or `null`. Only membership in
   * {@link PENDING_CONFIRMATIONS} says whether it remains unanswered.
   *
   * **Setting this to `null` is presentation, not a spend.** What records that the
   * question has been answered is {@link PENDING_CONFIRMATIONS}, because every field
   * on the value compares equal across copies of it — and because
   * {@link confirmRestore} returns a *new* session and cannot reach into the one the
   * caller retained, a session held across a successful confirmation still carries
   * the very object whose membership has gone.
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
   * Reset to `idle` by every new outcome and by every dismissal, which is what
   * stops a confirmation collected for one conflict being spendable while a later
   * one is on screen.
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
 * **`offersReload` is `false` and the transition exists anyway**, which is the
 * trade 2c-4a-2 made and 2c-4a-3a collected on: the machinery is built and driven
 * by this module's suite now, and 2c-5-4 flips one boolean when it draws the panel
 * rather than inventing a transition on top of drawing it.
 *
 * **`reapplySupport` is `unavailable` permanently**, for the raw editor's reason
 * (consult Q4 of 2c-4b): the candidate is a whole document, so there is no target,
 * no field intent and no operation to re-resolve against a newly parsed file, and
 * "reapply" could only mean overwriting the newly read disk text with a stale
 * string or inventing a text merge.
 */
export const CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'operationChoice',
  reloadOutcome: 'retargetsCandidate',
  offersCopyDraft: false,
  offersReload: false,
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
    restored: false
  };
} // End of function startRestore()

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
 * acknowledgement* — is one rule rather than one per transition. It drops the
 * pending confirmation, withdraws whatever consent the draft had collected, and
 * bumps {@link RestoreSession.previewGeneration} so a confirmation whose other four
 * values happen to be reproducible is still refused.
 *
 * The consent goes through `retargetedDraft` at the draft's existing base revision,
 * which is `withdrawnConsent` — findings accepted for one transaction say nothing
 * about the next.
 *
 * @param session - The session to withdraw from.
 * @param preview - The preview it should hold afterwards, which is its own when
 *   nothing about the candidate changed.
 * @returns The session with nothing pending and no consent.
 */
function withdrawn(
  session: RestoreSession,
  preview: RestorePreview | null
): RestoreSession {
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
  const cleared = withdrawn(session, session.preview);
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
  return frozen(session)
    ? session
    : { ...withdrawn(session, session.preview), batches: { kind: 'loading' } };
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
  return {
    ...session,
    batches: answer.ok
      ? { kind: 'loaded', listing: answer.value }
      : { kind: 'failed', failure: answer.failure }
  };
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
  if (frozen(session)) {
    return session;
  }
  return {
    ...withdrawn(session, null),
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
  return frozen(session)
    ? session
    : { ...withdrawn(session, session.preview), entries: { kind: 'loading' } };
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
 * `batchesLoaded`'s reason.
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
  return {
    ...session,
    entries: answer.ok
      ? { kind: 'loaded', listing: answer.value }
      : { kind: 'failed', failure: answer.failure }
  };
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
  return frozen(session) ? session : { ...withdrawn(session, null), entry };
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
 * @param session - The session.
 * @param response - What `readBackupText` in `../ipc/commands` answered.
 * @returns The session holding the candidate, or the same session when the response
 *   is not about what this session asked for or it is frozen.
 */
export function candidateRead(
  session: RestoreSession,
  response: BackupTextResponse
): RestoreSession {
  const asked = session.entry;
  if (frozen(session) || asked === null || response.document !== session.target) {
    return session;
  }
  if (
    response.entry.id.relative_path !== asked.relative_path ||
    response.entry.id.batch.name !== asked.batch.name ||
    session.batch === null ||
    asked.batch.name !== session.batch.name
  ) {
    return session;
  }
  const preview: RestorePreview = {
    entry: response.entry,
    revision: response.revision,
    draft: startDraft(session.baseRevision, response.text, textDraftRules)
  };
  return { ...withdrawn(session, null), preview };
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
  return frozen(session)
    ? session
    : { ...withdrawn(session, null), entries: { kind: 'failed', failure } };
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
  return frozen(session) || observed === null || observed === session.baseRevision
    ? session
    : measuredAgainst(session, observed);
} // End of function targetRevisionObserved()

/**
 * The conflict the session is showing, or `null`.
 *
 * @param session - The session to ask about.
 * @returns The conflict model, or `null` when the session is not in one.
 */
export function conflictOf(session: RestoreSession): ConflictModel<string> | null {
  return conflictArm(session.outcome);
} // End of function conflictOf()

/**
 * Why this session may not be asked to restore right now, or `null`.
 *
 * **The order is a claim about which fact is the most fundamental**, and it decides
 * which sentence a person sees when two are true at once: what has already happened
 * to the file, then whether this application may write it at all, then what is
 * happening to it, then whether there is anything to send, then whether this window
 * still holds the reading the candidate is measured against, and last the rule that
 * is about the person's other open panels rather than about the file.
 *
 * **It is exactly the set {@link confirmRestore} rechecks**, over exactly the same
 * two window observations, so a control this answers `null` for and a confirmation
 * that then refuses cannot disagree about anything but the five values a pending
 * confirmation carries — which are the session's own and are compared there.
 *
 * It is an **affordance derived from current state, never authorization**: the
 * transaction's own locked read is what actually stands between a restore and a
 * file that has moved, and every arm here is rechecked at the moment a submission
 * would be produced.
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
  if (conflictOf(session) !== null) {
    return { kind: 'conflictShowing' };
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
 * {@link PendingRestore}. It records the five values consult Q5 binds, so the
 * answer cannot be spent on a different entry, a different destination, a different
 * candidate, a different base revision, or a later preview that happens to
 * reproduce the other four.
 *
 * It is also the only place a question is registered in {@link PENDING_CONFIRMATIONS},
 * which is what {@link confirmRestore} spends. Asking again while one is pending does
 * nothing; asking after the pending one was cancelled or withdrawn mints a **new**
 * question, and that is a second authorization by construction rather than a hole.
 *
 * @param session - The session.
 * @param context - What this window observes about the destination and about its
 *   own open surfaces.
 * @returns The session with the question pending, or the same session when it may
 *   not be asked or one is already pending.
 */
export function prepareRestore(
  session: RestoreSession,
  context: RestoreContext
): RestoreSession {
  const preview = session.preview;
  if (preview === null || session.pending !== null || !canPrepareRestore(session, context)) {
    return session;
  }
  // The cast is the brand: `PendingRestore` declares a property on a symbol this
  // module does not export, so no literal outside it can have the type and this is
  // the only place one is built.
  const pending = {
    document: session.target,
    baseRevision: session.baseRevision,
    entry: preview.entry.id,
    candidateRevision: preview.revision,
    generation: session.previewGeneration
  } as unknown as PendingRestore;
  // Registered here and nowhere else, so this exact object — never a copy of it, and
  // never a second one for the same question — is what a confirmation spends.
  PENDING_CONFIRMATIONS.add(pending);
  return { ...session, pending, sendFailure: null };
} // End of function prepareRestore()

/**
 * Takes the question back.
 *
 * **It clears the question from the session and leaves its membership of
 * {@link PENDING_CONFIRMATIONS} alone**, so it withdraws the question rather than
 * answering it: a caller that kept the object could put it back, and the
 * confirmation would then be judged, as always, on the five values it carries, the
 * revision the live projection gives the destination, and the surfaces the window has
 * open. That is the same class as a caller that kept the session from before the
 * question was asked — and it is a caller re-asking, never a second answer to one
 * question, which is what {@link confirmRestore} spends.
 *
 * @param session - The session.
 * @returns The session with nothing pending, or the same session when nothing was.
 */
export function cancelRestore(session: RestoreSession): RestoreSession {
  return session.pending === null ? session : { ...session, pending: null };
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
 * What one confirmation authorizes, held where no caller can reach it.
 *
 * The five values consult Q5 binds **and the exact candidate**, so the send does not
 * have to trust anything a caller carried: it compares the permit against the live
 * session, and what it hands the sender is the permit's own submission.
 */
interface RestorePermit {
  /** The file that may be replaced. */
  readonly document: DocumentId;
  /** The revision it was expected to hold. */
  readonly baseRevision: ContentRevision;
  /** The backup entry the candidate was read from. */
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
   */
  readonly submission: DraftSubmission<string>;
}

/**
 * Every permit that has not been spent, keyed by the confirmed object.
 *
 * A `WeakMap` rather than a property, for `invalidation.ts`'s reason one operation
 * along: a property is recoverable by reflection whatever its key is, and object
 * spread and `structuredClone` copy it, while a clone of a {@link StartedRestore} is
 * a different object and therefore not a key here. Deleting the entry is what makes
 * the **permit** one-shot — the question that minted it is spent one step earlier, in
 * {@link PENDING_CONFIRMATIONS} — and {@link sendRestore} deletes it **before** it
 * calls the sender, so a re-entrant caller cannot spend it twice either.
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
 * *successfully* deleting it from {@link PENDING_CONFIRMATIONS}, and that is the
 * difference between
 * a caller who cannot confirm twice and one who only appears unable to. Consent is
 * for one attempt: a refusal that comes back with findings is acknowledged and then
 * prepared and confirmed again, which is the shape the acknowledgement round trip has
 * everywhere else in this application.
 *
 * **The spend is one operation, and that is the guarantee.** It is a *checked*
 * `PENDING_CONFIRMATIONS.delete`, and its success is the authorization, so testing
 * the membership and consuming it cannot come apart. That is not a refinement: this
 * function reads properties off values a caller supplied, `readonly` freezes nothing
 * at runtime, and any one of those reads can reach a getter or a proxy trap and
 * re-enter here synchronously. Asking with `has` first and deleting afterwards left a
 * window in which the inner call answered the question and minted its permit while
 * the outer call's later deletion returned `false` into nothing and minted a second.
 * The deletion is still placed after **every** check, so a refused confirmation does
 * not burn the question — the person repairs whatever moved and confirms the same
 * one — while a second call with the same pending object, ordinary or re-entrant,
 * finds the set no longer holding it and answers `null`.
 *
 * **The permit is minted here and is the whole authorization.** It records the five
 * bound values and the exact submission away from the returned object, so what comes
 * back is a session to install and a key — not an instruction anything can carry to
 * a sender. One question therefore mints at most one permit, whatever the caller does
 * with the session this returns; what stops that permit being spent twice, or being
 * spent after anything it binds has moved, is {@link sendRestore}.
 *
 * @param session - The session holding the person's answer.
 * @param context - What this window observes about the destination and about its
 *   own open surfaces.
 * @returns The waiting session, keyed to a fresh permit, or `null`.
 */
export function confirmRestore(
  session: RestoreSession,
  context: RestoreContext
): StartedRestore | null {
  const pending = session.pending;
  const preview = session.preview;
  if (pending === null || preview === null || !canPrepareRestore(session, context)) {
    return null;
  }
  if (pending.document !== session.target || pending.baseRevision !== session.baseRevision) {
    return null;
  }
  if (
    pending.entry.relative_path !== preview.entry.id.relative_path ||
    pending.entry.batch.name !== preview.entry.id.batch.name
  ) {
    return null;
  }
  if (
    pending.candidateRevision !== preview.revision ||
    pending.generation !== session.previewGeneration
  ) {
    return null;
  }
  // **The spend is the membership test.** Every check above compares numbers and
  // strings, so a clone of an answered question would pass them all; what tells this
  // question from a copy of it, and from itself already answered, is that
  // `PENDING_CONFIRMATIONS` still holds it — and `WeakSet.delete` answers that and
  // removes it in one operation that runs no user code. Asking with `has` first and
  // deleting afterwards was **not** the same thing: every property read between the
  // two can reach a getter or a proxy trap, so a caller could re-enter, answer the
  // question inside its own confirmation, and mint a second permit while the outer
  // call's later deletion returned `false` into nothing. It is placed after all the
  // checks so a refusal still leaves the question askable.
  if (!PENDING_CONFIRMATIONS.delete(pending)) {
    return null;
  }
  const submission = submissionOf(preview.draft);
  // The cast is the brand, as it is for `PendingRestore`: this is the only place a
  // `StartedRestore` is built, and `sendRestore` takes nothing else.
  const started = {
    session: {
      ...session,
      phase: 'saving',
      pending: null,
      submitted: submission,
      inFlight: { submission, preview },
      sendFailure: null
    }
  } as unknown as StartedRestore;
  PERMITS.set(started, {
    document: session.target,
    baseRevision: session.baseRevision,
    entry: preview.entry.id,
    candidateRevision: preview.revision,
    generation: session.previewGeneration,
    submission
  });
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
       * No unspent permit authorized this send, so the sender was never called.
       *
       * One arm for all of it, because a person is told the same thing by every
       * one: nothing was confirmed, the confirmation had already been spent, or
       * something it was bound to moved before it could be. What is on screen is
       * {@link restoreRefusal}'s answer over the session as it stands.
       */
      readonly kind: 'notAttempted';
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
 * here — a committed session, a read-only file, a conflict on screen, no candidate,
 * a destination the window no longer gives this revision, and a competing surface —
 * so the two cannot disagree about anything but the arm that is inverted by
 * construction.
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
 *    a change to any of them sends nothing;
 * 3. the permit is **deleted before `send` is called**, synchronously, so a
 *    re-entrant or concurrent caller finds nothing to spend even while the first
 *    send is still in flight.
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
 * it did not earn, which is `observed`'s limit one argument along. Nor that `send`
 * is `BrowserState.saveRawDocument`, or that it writes anything at all —
 * `async () => ({ kind: 'failed', mayHaveWritten: false })` type-checks, exactly as
 * `openWholeDocumentSave`'s `forget` may have an empty body. And nothing stops a
 * component calling `BrowserState.saveRawDocument` or `../ipc/commands`'s
 * `saveRawDocument` directly, with any text it likes; that is the hole every writing
 * command has had since 2b-2a and no type in this repository closes it.
 *
 * @param started - What {@link confirmRestore} produced, or `null`.
 * @param session - The session as it stands now, which is the one the confirmation
 *   answered with unless something moved it.
 * @param context - What this window observes about the destination and about its
 *   own open surfaces, read **now** rather than when the question was answered.
 * @param send - `BrowserState.saveRawDocument`. Called at most once, and never at
 *   all without an unspent permit that still holds.
 * @returns What became of the attempt.
 */
export async function sendRestore(
  started: StartedRestore | null,
  session: RestoreSession,
  context: RestoreContext,
  send: SendRestore
): Promise<RestoreSend> {
  if (started === null) {
    return { kind: 'notAttempted' };
  }
  const permit = PERMITS.get(started);
  if (permit === undefined || !permitHolds(permit, session, context)) {
    return { kind: 'notAttempted' };
  }
  // **Spent before the sender is called**, so nothing that runs during the send —
  // including the sender itself — can spend it again.
  PERMITS.delete(started);
  const answer = await send(
    permit.document,
    permit.submission.baseRevision,
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
 * @param session - The session waiting for an answer.
 * @param sealed - What `BrowserState.saveRawDocument` answered.
 * @param invalidate - What the coordinator does about every write surface over the
 *   replaced file. Required, with no default: a default would be this module
 *   deciding for a caller that has surfaces it never told anyone about.
 * @returns The session showing what the restore ended as.
 */
export function applyRestore(
  session: RestoreSession,
  sealed: SealedWholeDocumentSave,
  invalidate: InvalidateEverySurface
): RestoreSession {
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
    return { ...session, phase: 'editing', inFlight: null };
  }
  const outcome = opening.outcome;
  const failed =
    invalidationFailureMessage(opening.invalidation) ??
    invalidationFailureMessage(opening.issuerInvalidation);
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
    sendFailure: null
  };
  if (outcome.outcome !== 'saved') {
    return answered;
  }
  const revision = replaced.revision ?? outcome.revision;
  return {
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
  };
} // End of function applyRestore()

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
 * @param session - The session waiting for an answer.
 * @param mayHaveWritten - Whether the file may already hold the candidate.
 * @returns The session, back to its resting state, with the right notice raised.
 */
export function restoreCouldNotBeSent(
  session: RestoreSession,
  mayHaveWritten: boolean
): RestoreSession {
  return {
    ...session,
    phase: 'editing',
    // The send is over however it ended, so nothing is in flight any more. What was
    // submitted stays on the session: there may be findings to consent to, and this
    // arm has no answer that would spend them.
    inFlight: null,
    sendFailure: sendFailureOf(mayHaveWritten, null)
  };
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
 * @param session - The session showing a refusal.
 * @returns The session carrying consent, or the same session.
 */
export function acknowledgeRestoreFindings(session: RestoreSession): RestoreSession {
  const preview = session.preview;
  if (preview === null || session.phase === 'saving') {
    return session;
  }
  const draft = consentForRefusal(preview.draft, session.submitted, session.outcome);
  if (draft === preview.draft) {
    return session;
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
 * @param session - The session showing an outcome.
 * @returns The session with nothing being said about the last attempt, or the same
 *   session while a send is in flight.
 */
export function dismissRestoreOutcome(session: RestoreSession): RestoreSession {
  if (session.phase === 'saving') {
    return session;
  }
  return {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function dismissRestoreOutcome()

/**
 * Asks to load the version on disk, which is the step **before** confirming.
 *
 * @param session - The session showing a conflict.
 * @returns The session at the warning, or the same session when no conflict is
 *   showing or one has already been asked about.
 */
export function askToReloadDiskVersion(session: RestoreSession): RestoreSession {
  const next = reloadAsked(conflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
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
  const next = reloadConfirmed(conflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
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
 * **What no type here forces**: that `adopt`'s body does anything, and that the
 * window really holds the revision it reported.
 *
 * @param session - The session holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once.
 * @returns The session re-pointed at the disk revision, the session at the terminal
 *   refused step, or the same session.
 */
export function reloadTheDiskVersion(
  session: RestoreSession,
  adopt: AdoptTheDiskVersion<string>
): RestoreSession {
  const conflict = conflictOf(session);
  const spend = spendTheConfirmedReload(conflict, session.reload, adopt);
  if (spend === 'notAttempted' || conflict === null) {
    return session;
  }
  if (spend === 'refused') {
    // **A terminal step rather than the session unchanged**, which is the 2c-4a-3a
    // review's finding 3: the window said no without a word about which of
    // `adoptDiskVersion`'s ordered guards produced it, so the control stops being
    // offered and the panel says so. That is a decision about what to draw and
    // **not** a claim that a later ask would be refused too — a refusal spends
    // nothing.
    return { ...session, reload: RELOAD_REFUSED };
  }
  // **`measuredAgainst` rather than `targetRevisionObserved`**, and the difference
  // is load-bearing: that transition answers *unchanged* when the revision it is
  // given is the one the session already holds, which is right for an idle
  // reprojection check and wrong here. A conflict whose `diskRevision` happens to
  // equal this session's base — a file changed and changed back — must still leave
  // the panel with nothing pending and no consent, because a confirmation given
  // before the adoption was given about a different reading of the world.
  const moved = measuredAgainst(
    { ...session, submitted: null, outcome: null, extraMessages: [], sendFailure: null },
    conflict.diskRevision
  );
  return { ...moved, reload: NOT_RELOADING };
} // End of function reloadTheDiskVersion()

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
  /** Whether the person has been asked and has not answered. */
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
  /** The outcome's lines followed by anything to be said beside them. */
  readonly messages: readonly SaveOutcomeMessage[];
  /** The presentation changes a saved arm disclosed, in report order. */
  readonly notes: readonly PresentationNote[];
  /** What to offer about a refusal, withdrawn once its findings are stale. */
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
  /** The disk side of that conflict, or `null` when none is showing. */
  readonly diskText: ConflictDiskText | null;
  /**
   * What the retained candidate **asked for**, or `null` when no conflict is
   * showing.
   *
   * Constant while a conflict is showing, because a restore asks for one thing. It
   * is decided here rather than assembled in markup, because a description written
   * into one renderer is carried by that renderer's mounted suite alone.
   */
  readonly conflictOperation: ConflictOperation | null;
}

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
      : conflictChoicesFor(CONFLICT_CAPABILITIES, offeredReloadStep(session.reload));
  return {
    target: session.target,
    baseRevision: session.baseRevision,
    batches: session.batches,
    batch: session.batch,
    entries: session.entries,
    entry: session.entry,
    preview: session.preview,
    canPrepare: canPrepareRestore(session, context) && session.pending === null,
    refusal: restoreRefusal(session, context),
    confirming: session.pending !== null,
    restoring: session.phase === 'saving',
    restored: session.restored,
    sendFailure: session.sendFailure,
    failureLines: sendFailureLines(session.sendFailure?.reason ?? null),
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    notes: saved === null ? [] : saved.notes,
    refusalChoices: offeredRefusalChoices(refused, stale),
    findingsAreStale: refused !== null && stale,
    conflict,
    conflictChoices,
    awaitingReloadConfirmation: conflict !== null && atTheReloadWarning(session.reload),
    reloadUnavailable: conflict !== null && reloadWasRefused(session.reload),
    diskText: conflictDiskText(conflict),
    conflictOperation: conflict === null ? null : 'replaceFileFromBackup'
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
