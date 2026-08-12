/**
 * Recovery from a conflict nothing could resolve automatically — Phase 2c-4c-2.
 *
 * **No component and no screen.** This is the whole of recovery as a value,
 * exactly as `./reapply.ts` is for the reapply path and `./matchCreation.ts` is for
 * the new-snippet form, and for the same standing reason: only the seven files
 * that opt into jsdom render a Svelte component in an automated test, so a
 * decision written in markup is a decision one renderer's suite carries alone
 * (`CLAUDE.md` section 6). 2c-4c-3 draws what this module decides, and until then
 * **nothing here is offered**: no `ConflictChoice` member names it, no dictionary
 * key exists for its codes, and no control is drawn. That is the trade 2c-4a-2
 * proved and 2c-4b-2 repeated — build the transition, then flip capability and
 * draw it without inventing machinery.
 *
 * ## What recovery is, stated as the narrowest thing it does
 *
 * The design consult's verdict (`docs/reviews/phase-2c-4c-design.md`): from an
 * **intact** conflict, prepare **one ordinary `create_match`** against a
 * person-chosen eligible destination, at that destination's **end**, carrying the
 * schema-supported fields the retained draft would have written — while the
 * original conflict and its draft are left alone until that creation **commits**.
 * What *left alone* can and cannot mean about the window is
 * {@link sourceConflictState}, and it has three answers rather than two.
 *
 * Its name, fixed by the consult and by `PROGRESS.md`, is **_create a new snippet
 * from supported fields_**, and what that name promises is the whole of what it
 * does:
 *
 * - what is **carried** is six projected values — `trigger`, `replace`, `label`,
 *   `word`, `left_word`, `right_word` — each as logical text, spelled into the
 *   file by Rust's own encoder;
 * - what is **not carried** is everything else the source held: comments, unknown
 *   keys, key order, scalar spelling and quoting, tags, anchors, the sixteen other
 *   scalar fields and the four collections. The projection is read-only and cannot
 *   support a stronger promise (`CLAUDE.md` section 3);
 * - what it **writes** is a new snippet at the end of a chosen destination.
 *   Whatever the file now holds is left exactly as it is, and nothing here rebases
 *   the pending change onto it — that is `./reapply.ts`'s transition, and this is
 *   a different offer with a different name.
 *
 * ## The four things this module owns
 *
 * 1. **The gate.** {@link recoveryAvailability} is the only producer of a
 *    {@link RecoveryChoice} list and of the destination list, so capability is
 *    expressed once — `conflictChoicesFor`'s own argument, whose split is why a
 *    newly offered control could once compile and do nothing.
 * 2. **The six transfer decisions.** {@link transferOfMatchDraft} turns a match
 *    editor's baseline and buffers into what a new snippet would be born holding,
 *    honouring step 1's contract that **`None` is not `Some("")`**.
 * 3. **Destination selection.** {@link recoveryDestinationsOf} offers only files
 *    this application may write a snippet into, with the conflict's own document
 *    judged by the **disk** projection the conflict carries rather than by the
 *    stale one the window still holds.
 * 4. **The creation.** {@link beginRecoveryCreate} and
 *    {@link sendRecoveryCreate} compose `BrowserState.createMatch` — there is no
 *    new command, no second writer, and no other position than the end.
 *
 * ## What opening recovery does not do, and what forces it
 *
 * The entry condition is `ReapplyOutcome`'s `manualResolution` arm, whose promise
 * is that **nothing was adopted**: the projection was not replaced, the selection
 * was not repaired and the conflict's one authorization was not spent
 * (`./reapply.ts`). Opening a form keeps that promise structurally rather than by
 * discipline: {@link startMatchFieldRecovery} and
 * {@link startCreationFieldRecovery} take no `AdoptTheDiskVersion` and no
 * `ReloadConfirmation`, so there is nothing they could spend, and nothing here
 * holds or returns a host session — the surface's own value is reached only as
 * `ReapplyOutcome`'s type parameter, whose two session-carrying arms are refused on
 * their `kind` before anything is read out of them.
 *
 * **Two later transitions do take an adoption, and it is never the source
 * conflict's — but spending one is itself something the window may have moved
 * for.**
 * {@link reapplyRecoveryToDiskVersion} and {@link reloadRecoveryDiskVersion}
 * resolve the conflict a **recovery create of its own** ran into — a different
 * conflict, which the window registered when that create came back — reached
 * through {@link recoveryConflictOf}; `RecoveryOrigin.conflict` is carried as an
 * opaque value and is passed to nothing. *Not spending it* and *not invalidating
 * the window it was registered against* are two different statements, and only the
 * first is true of those transitions: a satisfied adoption is one the window may
 * have installed a projection for — `alreadyThere` is satisfied and installs
 * nothing — so both record {@link RecoverySession.windowWasReconciled} and
 * {@link sourceConflictState} stops answering `retained`.
 *
 * What no type here can force is that a caller keeps drawing the conflict it opened
 * recovery from, nor that the window is still where that conflict left it:
 * {@link sourceConflictState} is what such a caller asks, and it has an answer for
 * the case where the window may have moved under it.
 *
 * ## What no type here can force
 *
 * That a caller installs the session a transition answers, that a component draws
 * the transfer table beside the two boxes, or that the `create` callback handed to
 * {@link sendRecoveryCreate} is `BrowserState.createMatch` — the same hole every
 * writing path in this application has had since 2b-2a, since nothing stops a
 * component importing `createMatch` from `../ipc/commands` directly. What is
 * closed is that **this module never calls a command itself**: the only way a
 * recovery writes anything is a callback its caller supplied.
 */

import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ConflictResult,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  MatchId,
  NewMatch,
  NewMatchPosition,
  PresentationNote,
  SaveResult
} from '../ipc/types';
import type { DetailFieldName } from './detail';
import {
  canRedo,
  canUndo,
  isDirty,
  redoDraft,
  retargetedDraft,
  savedDraft,
  startDraft,
  structuredDraftRules,
  submissionOf,
  undoDraft,
  type Draft,
  type DraftSubmission,
  type DraftValueRules
} from './draft';
import {
  atTheReloadWarning,
  conflictArm,
  consentForRefusal,
  offeredRefusalChoices,
  offeredReloadStep,
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
import type { InvalidationStatus } from './invalidation';
import {
  destinationEligibility,
  type CreationBuffers,
  type CreationField
} from './matchCreation';
import {
  EDITABLE_FIELDS,
  fieldIntent,
  fieldLabelName,
  type EditableField,
  type FieldBaseline,
  type FieldBuffer,
  type FieldRefusal,
  type MatchBaseline,
  type MatchBuffers
} from './matchEditor';
import type { RawSaveChoice } from './rawSave';
import {
  adoptForReapply,
  beginReapply,
  subjectIsTargetless,
  type ReapplyOutcome,
  type SharedReapplyObstacle
} from './reapply';
import {
  conflictChoicesFor,
  conflictDiskText,
  copyOfDraft,
  describeEditSave,
  invalidationFailureMessage,
  type ConflictCapabilities,
  type ConflictChoice,
  type ConflictDiskText,
  type ConflictDraftKind,
  type ConflictModel,
  type SaveOutcomeMessage,
  type SaveOutcomeModel
} from './saveOutcome';
import { recordTyping, type Clock, type TypingRun } from './typing';

/**
 * What one surface's retained draft is, **as recovery sees it**.
 *
 * Four values where `ConflictDraftKind` has two, and the refinement is the whole
 * of the consult's Q4 surface matrix: *authored text* is not one thing when the
 * question is *can a new snippet be made out of it?* — the match editor drafts six
 * projected fields, the creator drafts two authored ones, and the raw editor
 * drafts a whole document that has no match shape at all.
 *
 * **It is a permanent fact about a surface**, exactly as {@link ConflictDraftKind}
 * is, and {@link conflictDraftKindOf} is the mapping back down, so the copy rule
 * and the *keep editing* wording stay `./draftKind.ts`'s and are not restated
 * here.
 */
export type RecoveryDraftKind =
  /** The match editor's six-field draft over a projected snippet. */
  | 'matchFields'
  /** The creator's two authored fields, which were never in a file. */
  | 'creationFields'
  /** The mover's placement and the deleter's and duplicator's identity. */
  | 'operationChoice'
  /** The raw editor's whole-document text. */
  | 'wholeDocumentText';

/**
 * The {@link ConflictDraftKind} one recovery kind refines.
 *
 * Written out rather than inferred, so a fifth recovery kind has to decide which
 * of the two it is instead of inheriting an answer — and so a test can check the
 * refinement against each surface's own `CONFLICT_CAPABILITIES` rather than
 * against a second opinion held here.
 *
 * @param kind - What the surface's retained draft is, for recovery.
 * @returns The kind the rest of the conflict machinery already keys on.
 */
export function conflictDraftKindOf(kind: RecoveryDraftKind): ConflictDraftKind {
  switch (kind) {
    case 'matchFields':
    case 'creationFields':
    case 'wholeDocumentText':
      return 'authoredText';
    case 'operationChoice':
      return 'operationChoice';
  }
} // End of function conflictDraftKindOf()

/**
 * What recovery **is** on one surface, as the consult's Q4 matrix.
 *
 * Three routes over six surfaces, and only one of them writes anything. The other
 * two are not absences: they are the existing behaviour named, so that a screen
 * can say what to do next rather than leaving a person at a dead end — which is
 * the failure mode `2c-split-notes.md` assigned this whole phase.
 *
 * @param kind - What the surface's retained draft is, for recovery.
 * @returns The route that surface's recovery takes.
 */
export function recoveryRouteOf(kind: RecoveryDraftKind): RecoveryRoute {
  switch (kind) {
    case 'matchFields':
    case 'creationFields':
      return 'createsSnippet';
    case 'operationChoice':
      return 'reloadThenFreshOperation';
    case 'wholeDocumentText':
      return 'keepEditingWholeDocument';
  }
} // End of function recoveryRouteOf()

/** What recovery consists of on one surface. */
export type RecoveryRoute =
  /**
   * A new snippet from the supported fields. The match editor and the creator.
   */
  | 'createsSnippet'
  /**
   * A confirmed reload, then a fresh selection and a fresh operation.
   *
   * The deleter, the mover and the duplicator. Their drafts are a positional
   * choice and a revision-scoped identity, so there is nothing authored to make a
   * snippet out of — `./draftKind.ts` already refuses that false promise as a
   * property of the value.
   */
  | 'reloadThenFreshOperation'
  /**
   * Keep editing, copy, compare, or reload the disk version. The raw editor.
   *
   * There is no match-shaped value in a whole document to send to `create_match`,
   * and V1 forbids both a stale overwrite and an automatic merge.
   */
  | 'keepEditingWholeDocument';

/**
 * What recovery may offer, in the order to offer it.
 *
 * **One member today**, and it is a union rather than a boolean for the reason
 * `ConflictChoice` is: a control is drawn from a produced list, so a second offer
 * added later is a member here and an arm in one exhaustive `switch` per renderer
 * rather than a new `if` in six.
 *
 * It is deliberately **not** a member of `ConflictChoice`. That union's own list is
 * unchanged by this phase, and widening it would put a new control on six surfaces
 * at once.
 */
export type RecoveryChoice = 'createFromSupportedFields';

/** The one offered list, shared rather than rebuilt per call. */
const CREATE_FROM_SUPPORTED_FIELDS: readonly RecoveryChoice[] = Object.freeze([
  'createFromSupportedFields' as const
]);

/**
 * Why recovery offers nothing to press on one surface.
 *
 * **A code, never a sentence** (`CLAUDE.md` section 2). There is no key function
 * for these yet and that is this step's boundary: nothing draws them, so 2c-4c-3
 * adds the accessors together with the panel that renders them.
 *
 * The first three are permanent facts about a surface or about how it was reached;
 * the fourth is a fact about the configuration on disk and may stop being true
 * without anything here changing.
 */
export type RecoveryUnavailable =
  /**
   * The conflict was not left by a reapply that resolved nothing.
   *
   * The `manualResolution` arm is the entry condition, because it is the one arm
   * that promises nothing was adopted and no authorization was spent. Recovery
   * reached from anywhere else would have to reason about a window that may
   * already have moved.
   */
  | 'notFromManualResolution'
  /** There is no conflict, so there is no retained draft to recover. */
  | 'noConflict'
  /** The draft is an operation nobody typed: reload, then a fresh operation. */
  | 'operationDraft'
  /** The draft is a whole document: keep editing, copy, compare, or reload. */
  | 'wholeDocumentDraft'
  /**
   * There is no file this application may write a new snippet into.
   *
   * Every listed file is refused by `destinationEligibility` — it is not a snippet
   * file, it is read-only, this window holds no projection of it, the substrate
   * did not accept it, or it holds no `matches:` list. Nothing is written and the
   * draft is kept; a missing snippet list is **not** permission to create one.
   */
  | 'noEligibleDestination';

/**
 * One file recovery may write the new snippet into.
 *
 * **Only eligible files are representable**, which is the difference between this
 * list and the creator's own: `./matchCreation.ts` lists every file and attaches a
 * typed refusal to the ones it cannot write, because a form silently shorter than
 * the sidebar reads as an incomplete list. Recovery is an escape from a dead end
 * rather than a file browser, so the consult's Q2 says *offer every other eligible
 * destination*, and a destination this application will not write into cannot be
 * put in this list at all.
 *
 * A screen that wants to explain why some file is missing has the creator's
 * `destinationsOf` and `destinationRefusalKey` for exactly that.
 */
export interface RecoveryDestination {
  /** The file, by the identity this window holds. */
  readonly document: DocumentId;
  /** Its path relative to the configuration root, for a screen to name it by. */
  readonly path: string;
  /**
   * The revision of the projection this destination was derived from.
   *
   * **The draft's base revision when this destination is chosen**, and for the
   * conflict's own document it is the **disk** revision the conflict carried —
   * which is the newest observation this window has of that file even though the
   * window has not adopted it. Sending an older one would be sending a base the
   * transaction has already refused once.
   */
  readonly revision: ContentRevision;
}

/**
 * Every file recovery may write into, in the order the window lists them.
 *
 * **The conflict's own document is judged by the disk projection**, which is the
 * consult's Q2 read exactly: the window still holds the projection the conflict
 * refused, and asking *that* whether the file still has a snippet list would be
 * answering from bytes this application already knows are gone. Everything else is
 * judged by the projection the window holds, because that is the only observation
 * there is of it.
 *
 * **A file the window lists but holds no projection of is left out**, like every
 * other ineligible one: `destinationEligibility` answers `couldNotBeRead` for a
 * `null` projection, and this list carries only eligible destinations. What is
 * left out and why is the creator's list to explain, not this one's — see
 * {@link RecoveryDestination}.
 *
 * @param documents - Every file the window lists, in window order.
 * @param views - Every projection this window holds, in any order.
 * @param disk - The newly parsed projection the conflict carried.
 * @returns One destination per eligible file, in window order.
 */
export function recoveryDestinationsOf(
  documents: readonly DocumentSummary[],
  views: readonly DocumentView[],
  disk: DocumentView
): readonly RecoveryDestination[] {
  const offered: RecoveryDestination[] = [];
  for (const summary of documents) {
    // The conflict's document is the one file this window has two observations
    // of, and the disk one is the later.
    const view =
      summary.id === disk.id ? disk : (views.find((one) => one.id === summary.id) ?? null);
    if (view === null) {
      continue;
    }
    // The projection's own `kind` and `read_only` rather than the summary's, for
    // `destinationOfProjection`'s reason one module along: a rebuilt destination
    // must not mix an older read's facts into a newer one's.
    if (destinationEligibility(view, view).kind !== 'eligible') {
      continue;
    }
    offered.push({ document: view.id, path: view.relative_path, revision: view.revision });
  } // End of the loop over every file the window lists
  return offered;
} // End of function recoveryDestinationsOf()

/**
 * The destination recovery starts on, or `null` when the person must choose.
 *
 * The consult's Q2: the conflict's own document is preferred **only when the disk
 * projection still says it is eligible** — which is exactly *is it in the list
 * {@link recoveryDestinationsOf} produced?*, since that list holds nothing else.
 * Otherwise nothing is chosen and {@link recoveryRefusal} answers `noDestination`
 * rather than this module picking another file on the person's behalf.
 *
 * @param destinations - What {@link recoveryDestinationsOf} answered.
 * @param document - The file the conflict was about.
 * @returns That file when it may be written into, and `null` otherwise.
 */
export function preferredRecoveryDestination(
  destinations: readonly RecoveryDestination[],
  document: DocumentId
): DocumentId | null {
  return destinations.some((one) => one.document === document) ? document : null;
} // End of function preferredRecoveryDestination()

/**
 * Whether recovery offers anything on this surface, and what it would work from.
 *
 * **The only producer of a {@link RecoveryChoice} list and of the destination
 * list.** They are answered together because they are one decision: the offer is
 * withheld when there is nowhere to write, so a control that could only fail is
 * not drawn — `conflictChoicesFor`'s rule, applied to this phase's one new
 * control.
 *
 * The checks are in order of how permanent they are: what the surface's draft
 * **is**, then how the conflict was reached, then whether there is a conflict at
 * all, then what the configuration on disk offers. Only the last can change
 * without a code change.
 *
 * @typeParam S - The calling surface's session type.
 * @typeParam O - The calling surface's reapply obstacle type.
 * @typeParam T - The drafted value the conflict retained.
 * @param kind - What the surface's retained draft is, for recovery.
 * @param attempt - What the surface's last reapply became, or `null`.
 * @param conflict - The conflict it is showing, or `null`.
 * @param documents - Every file the window lists, in window order.
 * @param views - Every projection this window holds.
 * @returns The choices and the destinations, or the reason there are none.
 */
export function recoveryAvailability<S, O, T>(
  kind: RecoveryDraftKind,
  attempt: ReapplyOutcome<S, O> | null,
  conflict: ConflictModel<T> | null,
  documents: readonly DocumentSummary[],
  views: readonly DocumentView[]
): RecoveryAvailability {
  if (recoveryRouteOf(kind) !== 'createsSnippet') {
    return {
      kind: 'unavailable',
      reason: kind === 'operationChoice' ? 'operationDraft' : 'wholeDocumentDraft'
    };
  }
  if (attempt === null || attempt.kind !== 'manualResolution') {
    return { kind: 'unavailable', reason: 'notFromManualResolution' };
  }
  if (conflict === null) {
    return { kind: 'unavailable', reason: 'noConflict' };
  }
  const destinations = recoveryDestinationsOf(documents, views, conflict.disk);
  if (destinations.length === 0) {
    return { kind: 'unavailable', reason: 'noEligibleDestination' };
  }
  return { kind: 'offered', choices: CREATE_FROM_SUPPORTED_FIELDS, destinations };
} // End of function recoveryAvailability()

/** What {@link recoveryAvailability} answered. */
export type RecoveryAvailability =
  | {
      /** Recovery has something to offer here. */
      readonly kind: 'offered';
      /** What to offer, in the order to offer it. */
      readonly choices: readonly RecoveryChoice[];
      /** Every file it may write into, in window order. Never empty. */
      readonly destinations: readonly RecoveryDestination[];
    }
  | {
      /** It has nothing to offer, and the surface says why instead. */
      readonly kind: 'unavailable';
      /** Which of the five reasons, as a code. */
      readonly reason: RecoveryUnavailable;
    };

/**
 * Why one field of a retained draft is not carried into the new snippet.
 *
 * A discriminated union rather than a plain code union, because one of the four
 * carries the editor's own {@link FieldRefusal} — which already has sentences and
 * an accessor (`tFieldRefusal`), so the i18n layer composes the two rather than
 * this module inventing a fifth set of strings.
 */
export type TransferRefusal =
  | {
      /** The file did not hold this key, and the draft did not add one. */
      readonly kind: 'notInTheFile';
    }
  | {
      /** The draft asks for the key to be taken out, so the new snippet is born without it. */
      readonly kind: 'removedByTheDraft';
    }
  | {
      /**
       * The field is one this editor may not edit, so there is no value to carry.
       *
       * All five refusals end here, and none of them is a value a creation could
       * be born holding: a trigger that is not one literal has no literal to
       * carry, an unmodelled key is not one piece of text, an undecodable scalar's
       * text is the **source slice** rather than the logical value, a field
       * carrying a carriage return is one no control in this window could read
       * back, and a zero-width span is nothing at all.
       */
      readonly kind: 'fieldNotEditable';
      /** Which refusal, as the editor's own code. */
      readonly reason: FieldRefusal;
    }
  | {
      /**
       * The value the draft would write carries a carriage return.
       *
       * Distinct from the `fieldNotEditable` refusal of the same name: that one is
       * about what the **file** holds, and this is about what the **draft** would
       * write. `MatchBuffers` carries no brand, so a caller that is not a control
       * can put one there — the reason `beginSave` re-checks the derived draft one
       * module along, and the reason this is checked here as well as at
       * {@link beginRecoveryCreate}.
       */
      readonly kind: 'carriageReturn';
    };

/**
 * What one field of a retained draft becomes in the new snippet.
 *
 * **Two arms and not three**, deliberately: whether a missing mandatory value
 * stops the creation is a question about the *form*, not about the field, and
 * {@link recoveryRefusal} answers it from the buffers a person can still type
 * into. A `needsValue` arm here would answer it twice.
 */
export type FieldTransfer =
  | {
      /**
       * The new snippet is born holding this key with this text.
       *
       * **`carried('')` is a key with an empty value and is not the same request
       * as omitting the key**, which is step 1's contract restated on this side:
       * `NewMatch::fields()` writes `label: ''` for the first and no `label` line
       * at all for the second.
       */
      readonly kind: 'carried';
      /** The logical text, never YAML. How it is spelled is Rust's decision. */
      readonly text: string;
    }
  | {
      /** The new snippet is born without this key. */
      readonly kind: 'notCarried';
      /** Why, as a code. */
      readonly reason: TransferRefusal;
    };

/** What all six fields of a retained draft become. */
export type RecoveryTransfer = Readonly<Record<EditableField, FieldTransfer>>;

/**
 * What one field of a match editor's draft becomes in the new snippet.
 *
 * **The rule reads the baseline and the buffer through `fieldIntent`**, which is
 * the only function in this application that reads both, and it is called rather
 * than re-spelled: a buffer alone cannot tell an absent field left blank from a
 * present field cleared to blank, and the whole `None`-versus-`Some("")`
 * distinction turns on that. The final state of a field is what a save of that
 * draft would leave in the file:
 *
 * - `Remove` — the key would be taken out, so the new snippet is born without it;
 * - `Set(text)` — that text, including an empty one;
 * - `Unchanged` — what the file holds, when it holds the key at all.
 *
 * **An ineligible field is refused before its intent is asked**, and not because
 * the intent would be wrong — `fieldIntent` answers `Unchanged` for one — but
 * because the *reason* is what a screen shows, and "the file did not hold this
 * key" would be false of a `notDecodable` field that holds one.
 *
 * @param baseline - What the file held for this field.
 * @param buffer - What its control holds.
 * @returns What the new snippet is born holding for it.
 */
export function transferOfField(baseline: FieldBaseline, buffer: FieldBuffer): FieldTransfer {
  if (baseline.eligibility.kind !== 'editable') {
    return {
      kind: 'notCarried',
      reason: { kind: 'fieldNotEditable', reason: baseline.eligibility.reason }
    };
  }
  const intent = fieldIntent(baseline, buffer);
  if (intent === 'Remove') {
    return { kind: 'notCarried', reason: { kind: 'removedByTheDraft' } };
  }
  if (intent === 'Unchanged' && !baseline.present) {
    return { kind: 'notCarried', reason: { kind: 'notInTheFile' } };
  }
  const text = intent === 'Unchanged' ? baseline.value : intent.Set;
  return text.includes('\r')
    ? { kind: 'notCarried', reason: { kind: 'carriageReturn' } }
    : { kind: 'carried', text };
} // End of function transferOfField()

/**
 * What a match editor's retained draft becomes in the new snippet.
 *
 * All six fields, in {@link EDITABLE_FIELDS} order — which is also the order
 * `NewMatch::fields()` writes them in, and the two agree without either being
 * derived from the other: Rust writes its order out literally so that a reorder
 * here could not silently reorder written bytes (2c-4c-1's D3).
 *
 * **The sixteen other scalar fields and the four collections are not transferred
 * at all.** They are not in `NewMatch`, and this editor never drafted them: what
 * it sends for them is *leave this alone*, which is a statement about an existing
 * snippet and means nothing for one that does not exist yet.
 *
 * @param baseline - What the file held when the editing session was seeded.
 * @param buffers - The draft the conflict retained.
 * @returns One transfer per field.
 */
export function transferOfMatchDraft(
  baseline: MatchBaseline,
  buffers: MatchBuffers
): RecoveryTransfer {
  const transfer: Record<EditableField, FieldTransfer> = {} as Record<
    EditableField,
    FieldTransfer
  >;
  for (const field of EDITABLE_FIELDS) {
    transfer[field] = transferOfField(baseline[field], buffers[field]);
  }
  return transfer;
} // End of function transferOfMatchDraft()

/**
 * What a creator's retained draft becomes in the new snippet.
 *
 * **Two authored fields and four keys nobody authored.** The creation form writes
 * `trigger` and `replace` and omits the four optional schema-known fields, which
 * asks Rust to write no key for them — a different request from sending them
 * empty. So the four are `notInTheFile` here, in the literal sense: there was no
 * file and there was no key.
 *
 * There is no baseline to consult, so the only refusal a value can meet is the
 * carriage return, which no control in this window can produce and which a caller
 * that is not a control can.
 *
 * @param buffers - The draft the conflict retained.
 * @returns One transfer per field.
 */
export function transferOfCreationDraft(buffers: CreationBuffers): RecoveryTransfer {
  const authored: Readonly<Record<CreationField, string>> = buffers;
  const transfer: Record<EditableField, FieldTransfer> = {} as Record<
    EditableField,
    FieldTransfer
  >;
  for (const field of EDITABLE_FIELDS) {
    const typed = field === 'trigger' || field === 'replace' ? authored[field] : null;
    if (typed === null) {
      transfer[field] = { kind: 'notCarried', reason: { kind: 'notInTheFile' } };
    } else if (typed.includes('\r')) {
      transfer[field] = { kind: 'notCarried', reason: { kind: 'carriageReturn' } };
    } else {
      transfer[field] = { kind: 'carried', text: typed };
    }
  } // End of the loop over the six fields a new snippet may be born holding
  return transfer;
} // End of function transferOfCreationDraft()

/**
 * The text one transfer carries, or `null`.
 *
 * @param transfer - What one field became.
 * @returns The text, or `null` when the new snippet is born without the key.
 */
function carriedText(transfer: FieldTransfer): string | null {
  return transfer.kind === 'carried' ? transfer.text : null;
} // End of function carriedText()

/**
 * The new snippet a recovery would create.
 *
 * **The two mandatory fields come from the buffers and the four optional ones from
 * the transfer**, and the asymmetry is the consult's Q1: the trigger and the body
 * are editable — seeded from the transfer when it carried them, blank when it
 * could not, and never invented — while the four optional fields are carried or
 * omitted and there is no control for them.
 *
 * **An omitted optional field is a key the new snippet is not born holding**, and
 * an empty carried one is a key with an empty value. The object literal below is
 * what expresses that: a property is spread in only when there is a value for it,
 * because `exactOptionalPropertyTypes` makes `label: undefined` a different thing
 * from an absent `label` and `serde` reads an absent key as `None`.
 *
 * @param transfer - What the retained draft became.
 * @param buffers - What the two editable controls hold.
 * @returns The value `create_match` takes.
 */
export function newMatchOfRecovery(
  transfer: RecoveryTransfer,
  buffers: CreationBuffers
): NewMatch {
  const label = carriedText(transfer.label);
  const word = carriedText(transfer.word);
  const leftWord = carriedText(transfer.left_word);
  const rightWord = carriedText(transfer.right_word);
  return {
    trigger: buffers.trigger,
    replace: buffers.replace,
    ...(label === null ? {} : { label }),
    ...(word === null ? {} : { word }),
    ...(leftWord === null ? {} : { left_word: leftWord }),
    ...(rightWord === null ? {} : { right_word: rightWord })
  };
} // End of function newMatchOfRecovery()

/**
 * Where a recovered snippet goes, and there is no other value.
 *
 * **Fixed `End`, with no chooser**, which is the consult's Q2 and the one place in
 * this application where a placement is not a choice. Recovery has no trustworthy
 * anchor **by definition** — the anchor is what went missing — so `After` is
 * refused outright rather than guessed at, a numeric position would be an ordinal
 * where the wire wants an identity, and reusing the old `MatchId` would name a
 * snippet of a parse that is gone.
 *
 * `Front` is honest and is still not offered: a recovery escape is not an ordering
 * editor, and a person who wants another position performs a later same-sequence
 * move as its own operation, which D2r and R25 already require.
 *
 * **No function in this module takes a position or answers another one.**
 */
export const RECOVERY_POSITION: NewMatchPosition = Object.freeze({ End: {} });

/**
 * How this form compares and snapshots its drafted value.
 *
 * `structuredDraftRules` and nothing narrower, for `matchCreation.ts`'s reason:
 * {@link CreationBuffers} has fields, so the snapshot must be a deep copy and a
 * deep freeze, or the base, the current value, the history entry and the consent
 * candidate would all be one object and would all move together.
 */
const BUFFER_RULES: DraftValueRules<CreationBuffers> = structuredDraftRules<CreationBuffers>();

/**
 * The conflict this recovery came from, carried and never spent.
 *
 * **The wire value whole**, exactly as `ConflictModel.source` carries it, because
 * that is the identity `BrowserState` registered when the conflict arrived and the
 * only thing that ties an adoption to the state that produced it. Nothing here
 * adopts anything — this is carried so that a caller can check that the conflict
 * it is still drawing is the one recovery was opened from, and so that a test can
 * see that recovery neither replaced nor consumed it.
 */
export interface RecoveryOrigin {
  /** The file the conflict was about. */
  readonly document: DocumentId;
  /** The conflict exactly as it crossed the boundary. */
  readonly conflict: ConflictResult;
  /** The revision of the disk projection it carried. */
  readonly diskRevision: ContentRevision;
}

/**
 * One recovery form: a transfer table, two editable values and a destination.
 *
 * **A value with pure transitions, never a store**, which is 2c-1a's D1: a
 * component holds one in a `$state.raw` and reassigns it, and every function below
 * returns a new form without touching its argument.
 *
 * It deliberately holds **nothing of the host surface**. The conflict panel, its
 * session and its choices are the surface's own, and no transition here changes
 * one; what a recovery can change about the window it does through
 * `BrowserState.createMatch`, and {@link sourceConflictState} is where that is
 * accounted for.
 */
export interface RecoverySession {
  /** The conflict this was opened from, carried and never spent. */
  readonly origin: RecoveryOrigin;
  /** What the retained draft became, per field. Not drafted: nothing edits it. */
  readonly transfer: RecoveryTransfer;
  /** Every file this may write into, in window order. Never empty. */
  readonly destinations: readonly RecoveryDestination[];
  /** The file chosen, or `null` when the person must choose one. */
  readonly chosen: DocumentId | null;
  /** What the two editable controls hold. Drafted, with history and consent. */
  readonly draft: Draft<CreationBuffers>;
  /** Whether a create is in flight. */
  readonly phase: EditorPhase;
  /** Which of the two controls has the focus, as the screen last reported it. */
  readonly focus: CreationField | null;
  /** The run of typing later keystrokes may join, or `null`. */
  readonly group: TypingRun<CreationField> | null;
  /** What the last attempt sent, or `null`. Kept so a refusal can be consented to. */
  readonly submitted: DraftSubmission<CreationBuffers> | null;
  /** How the last attempt ended, as the thing a screen draws, or `null`. */
  readonly outcome: SaveOutcomeModel<CreationBuffers> | null;
  /**
   * Lines to show **beside** the outcome rather than in place of it.
   *
   * Today exactly one can appear: a committed create whose adoption failed. The
   * bytes are on disk and what failed is this window's attempt to bring itself
   * back into step, so it is never a replacement for the saved arm.
   */
  readonly extraMessages: readonly SaveOutcomeMessage[];
  /** How the last attempt failed to produce an outcome at all, or `null`. */
  readonly sendFailure: SendFailure | null;
  /**
   * How far a confirmed reload of this form's **own** conflict has got.
   *
   * Reset to `idle` by every new outcome and by every dismissal, so a
   * confirmation collected for one conflict cannot be spent while a later one is
   * on screen.
   */
  readonly reload: ReloadStep;
  /**
   * Whether a confirmed reload has ended this form.
   *
   * A reload here adopts the disk projection and **closes the recovery form**;
   * there is no disk-side recovered draft to seed one from. The source conflict is
   * behind it and is **not answered by this** — but the adoption that closed the
   * form is one the window may have installed a projection for, which
   * {@link RecoverySession.windowWasReconciled} is what records.
   *
   * **Terminal**: every export that takes a form and answers one answers the
   * **same** form when it is closed — four by a guard written for that
   * ({@link focusRecoveryField}, {@link keepRecovering},
   * {@link applyRecoveryCreate}, {@link recoveryCreateCouldNotBeSent}) and the
   * rest through the gates they already had. `recovery.test.ts` probes them
   * against this module's own export list, so a new one has to be classified
   * before that suite passes; what no test there can force is that a new export is
   * classified **correctly**.
   */
  readonly closed: boolean;
  /**
   * Whether a recovery create has committed through this form.
   *
   * Set by a committed save and cleared by nothing: every destination revision
   * this form holds was derived from a projection that commit replaced, so nothing
   * may be created from it again.
   */
  readonly committed: boolean;
  /**
   * Whether anything short of a committed create made the window move.
   *
   * **The 2c-4c-2 review's High, and the reason `!committed` was not the whole
   * story.** Four things set it, and none of them commits anything:
   *
   * - a create that failed with `mayHaveWritten` — the exact branch on which
   *   `BrowserState.createMatch` re-reads the file;
   * - a create answered with an `adoption` that is not `notOwed`, which includes
   *   the `saved` arm whose revision is not the one this window was projecting —
   *   the ordinary case for a recovery create, since it is based on the conflict's
   *   disk revision;
   * - a satisfied spend in {@link reloadRecoveryDiskVersion};
   * - a successful adoption in {@link reapplyRecoveryToDiskVersion}.
   *
   * The first two are read off the answer the callback returns; the last two are
   * this module's own adoptions, and they were the confirmation pass's finding —
   * both spent one while `sourceConflictState` went on answering `retained`.
   *
   * **What each of the four establishes is that the window *may* have moved, and
   * not that it did**, which is round 4's finding 1. The two create answers name
   * the branches on which the wrapper re-reads the file; the two adoptions are
   * recorded on a **satisfied** spend, and `satisfied` collapses `installed` — a
   * projection replaced and the generation advanced — with `alreadyThere`, which
   * installs nothing at all. This flag therefore means *an adoption was spent or a
   * re-read was ordered, and this module cannot tell whether the projection
   * changed*, which is exactly what `windowMoved` is written to claim.
   *
   * **It only ever moves from `false` to `true`.** Nothing this module can observe
   * would justify putting the window back.
   *
   * **What no type forces** is that the callback really is that wrapper —
   * {@link CreateARecoveredSnippet} and {@link AdoptTheDiskVersion} are ordinary
   * function types — so this records what the production wrapper and the window's
   * own door do, and `workspace.test.ts` drives the real ones to check it.
   */
  readonly windowWasReconciled: boolean;
  /**
   * The created snippet's identity in the new revision, or `null`.
   *
   * `SavedResult.moved` for the arm that answered it. **`null` is legal on a
   * committed create**: the command answers no identity when the file changed
   * again between the write and the read that followed it.
   */
  readonly created: MatchId | null;
  /** Where the typing run's boundary readings come from. */
  readonly clock: Clock;
}

/** What one attempt to open recovery answered. */
export type RecoveryStart =
  | {
      /** Recovery is open, and this is the form. */
      readonly kind: 'ready';
      /** The form, with nothing said and nothing sent. */
      readonly session: RecoverySession;
    }
  | {
      /** It is not, and the surface says why instead. */
      readonly kind: 'unavailable';
      /** Which of the five reasons, as a code. */
      readonly reason: RecoveryUnavailable;
    };

/**
 * Opens a recovery form over a transfer and an availability answer.
 *
 * The one place a {@link RecoverySession} is built, so the two public entries
 * cannot disagree about what an opened form holds.
 *
 * @param conflict - The conflict recovery was opened from.
 * @param transfer - What its retained draft became.
 * @param destinations - Every file this may write into.
 * @param clock - Where the typing run's boundary readings come from.
 * @returns The form.
 */
function openedRecovery<T>(
  conflict: ConflictModel<T>,
  transfer: RecoveryTransfer,
  destinations: readonly RecoveryDestination[],
  clock: Clock
): RecoverySession {
  const chosen = preferredRecoveryDestination(destinations, conflict.disk.id);
  const buffers: CreationBuffers = {
    // Seeded from the transfer, and blank when it carried nothing. Blank is what
    // the consult requires of a value this application could not transfer: the
    // person supplies one, and nothing here invents content.
    trigger: carriedText(transfer.trigger) ?? '',
    replace: carriedText(transfer.replace) ?? ''
  };
  return {
    origin: {
      document: conflict.disk.id,
      conflict: conflict.source,
      diskRevision: conflict.diskRevision
    },
    transfer,
    destinations,
    chosen,
    draft: startDraft(revisionOf(destinations, chosen), buffers, BUFFER_RULES),
    phase: 'editing',
    focus: null,
    group: null,
    submitted: null,
    outcome: null,
    extraMessages: [],
    sendFailure: null,
    reload: NOT_RELOADING,
    closed: false,
    committed: false,
    windowWasReconciled: false,
    created: null,
    clock
  };
} // End of function openedRecovery()

/**
 * The revision one chosen destination was projected at, or the empty revision.
 *
 * The empty string stands for *no file has been chosen*, and it cannot reach the
 * wire: {@link recoveryRefusal} answers `noDestination` for such a form, so
 * {@link beginRecoveryCreate} produces no submission from one.
 *
 * @param destinations - Every file this form offers.
 * @param document - The file chosen, or `null`.
 * @returns The revision, or `''`.
 */
function revisionOf(
  destinations: readonly RecoveryDestination[],
  document: DocumentId | null
): ContentRevision {
  if (document === null) {
    return '';
  }
  return destinations.find((one) => one.document === document)?.revision ?? '';
} // End of function revisionOf()

/**
 * Opens recovery from a **match editor's** conflict.
 *
 * The six transfer decisions are made here, from the baseline the editing session
 * was seeded with and the buffers the conflict retained — never from the live
 * session's buffers, because what is being recovered is the draft that was
 * refused.
 *
 * **Nothing is adopted, nothing is closed and nothing is spent.** The conflict is
 * read for its disk projection, its wire value and its retained draft, and that is
 * all; there is no adoption callback in this signature to spend one with.
 *
 * @typeParam S - The editor's session type, which this never touches.
 * @typeParam O - The editor's reapply obstacle type.
 * @param attempt - What the editor's last reapply became, or `null`.
 * @param conflict - The conflict it is showing, or `null`.
 * @param baseline - What the file held when the editing session was seeded.
 * @param documents - Every file the window lists, in window order.
 * @param views - Every projection this window holds.
 * @param clock - Where the typing run's boundary readings come from. **Required**:
 *   a default would be `Date.now`, which is the one thing a test cannot drive.
 * @returns The form, or the reason there is none.
 */
export function startMatchFieldRecovery<S, O>(
  attempt: ReapplyOutcome<S, O> | null,
  conflict: ConflictModel<MatchBuffers> | null,
  baseline: MatchBaseline,
  documents: readonly DocumentSummary[],
  views: readonly DocumentView[],
  clock: Clock
): RecoveryStart {
  const offer = recoveryAvailability('matchFields', attempt, conflict, documents, views);
  if (offer.kind !== 'offered' || conflict === null) {
    return { kind: 'unavailable', reason: offer.kind === 'offered' ? 'noConflict' : offer.reason };
  }
  const transfer = transferOfMatchDraft(baseline, copyOfDraft(conflict));
  return { kind: 'ready', session: openedRecovery(conflict, transfer, offer.destinations, clock) };
} // End of function startMatchFieldRecovery()

/**
 * Opens recovery from a **creator's** conflict.
 *
 * The creator's retained draft is already exactly two authored strings, so there
 * is no baseline to consult and no projection to read: what the person typed is
 * what the new snippet is born holding.
 *
 * @typeParam S - The creator's session type, which this never touches.
 * @typeParam O - The creator's reapply obstacle type.
 * @param attempt - What the creator's last reapply became, or `null`.
 * @param conflict - The conflict it is showing, or `null`.
 * @param documents - Every file the window lists, in window order.
 * @param views - Every projection this window holds.
 * @param clock - Where the typing run's boundary readings come from.
 * @returns The form, or the reason there is none.
 */
export function startCreationFieldRecovery<S, O>(
  attempt: ReapplyOutcome<S, O> | null,
  conflict: ConflictModel<CreationBuffers> | null,
  documents: readonly DocumentSummary[],
  views: readonly DocumentView[],
  clock: Clock
): RecoveryStart {
  const offer = recoveryAvailability('creationFields', attempt, conflict, documents, views);
  if (offer.kind !== 'offered' || conflict === null) {
    return { kind: 'unavailable', reason: offer.kind === 'offered' ? 'noConflict' : offer.reason };
  }
  const transfer = transferOfCreationDraft(copyOfDraft(conflict));
  return { kind: 'ready', session: openedRecovery(conflict, transfer, offer.destinations, clock) };
} // End of function startCreationFieldRecovery()

/**
 * What became of the conflict this recovery was opened from.
 *
 * **Three answers, because a boolean cannot carry the middle one** — the lesson
 * `DiskAdoptionOutcome` already taught this application, arriving here through the
 * 2c-4c-2 review's High. The first version of this rule was `!committed`, which
 * reads as *the window is exactly where the conflict left it*; that is a claim
 * about the **window**, and four things falsify it without committing anything:
 * two answers the create callback returns, and the two adoptions this module
 * spends on its own conflict. {@link RecoverySession.windowWasReconciled} lists
 * them, and the second pair is what the confirmation pass found — a fix that
 * closed the first pair and left the same false claim standing in the two paths it
 * had just introduced.
 *
 * @param session - The recovery form.
 * @returns Which of the three states the source conflict is in.
 */
export function sourceConflictState(session: RecoverySession): SourceConflictState {
  if (session.committed) {
    return 'spent';
  }
  return session.windowWasReconciled ? 'windowMoved' : 'retained';
} // End of function sourceConflictState()

/** What became of the conflict a recovery was opened from. */
export type SourceConflictState =
  /**
   * Nothing has moved: it and its draft are still the person's to resolve.
   *
   * The state after a refusal, after another conflict, after a send that was never
   * made, and while the form is being filled in.
   */
  | 'retained'
  /**
   * Nothing is known to have been written, **and this window may have moved**.
   *
   * Four things reach it, listed on {@link RecoverySession.windowWasReconciled}:
   * two answers `BrowserState.createMatch` reconciles without committing, and the
   * two adoptions this module spends on **its own** conflict — each of which is a
   * re-read ordered or an adoption spent, and none of which reports back what came
   * of it. So the source conflict's own observation may no longer be the one on
   * screen, and its one-shot authorization — keyed to the projection generation
   * recorded when it arrived — **may** no longer be spendable:
   * `BrowserState.adoptDiskVersion` refuses a generation that has moved, unless the
   * window happens now to hold exactly the revision that conflict carried, which it
   * answers `alreadyThere`. This state therefore claims uncertainty and never a
   * refusal.
   *
   * The recovered draft is untouched, and so is whatever the source surface still
   * shows; what this says is that *the window behind it is one this form can no
   * longer vouch for*.
   */
  | 'windowMoved'
  /**
   * A recovery create committed, so the conflict has been answered.
   *
   * A committed create whose **adoption** failed lands here too: the bytes are on
   * disk, and what failed is this window's attempt to read the file back.
   *
   * A `saved` arm that committed nothing does **not** land here. Such an arm is
   * legal on the wire and effectively unreachable for an insertion; it answers
   * `windowMoved` when the wrapper reconciled and `retained` otherwise, which is
   * the conservative direction — the alternative drops a conflict for a write that
   * did not happen.
   */
  | 'spent';

/**
 * The conflict this form's **own** create ran into, or `null`.
 *
 * Never the conflict recovery was opened from: that one is the host surface's and
 * lives in {@link RecoverySession.origin} as the wire value it arrived as.
 *
 * @param session - The form to ask about.
 * @returns The conflict model, or `null`.
 */
export function recoveryConflictOf(
  session: RecoverySession
): ConflictModel<CreationBuffers> | null {
  return conflictArm(session.outcome);
} // End of function recoveryConflictOf()

/**
 * Whether this form accepts changes at all right now.
 *
 * Three reasons it may not, each with its own refusal code: not while a create is
 * in flight, not while this form's own conflict is showing, and not after a commit
 * — because every destination revision it holds was derived from a projection that
 * commit replaced.
 *
 * @param session - The form to ask about.
 * @returns `true` when the controls may change anything.
 */
export function isRecoveryEditable(session: RecoverySession): boolean {
  return (
    !session.closed &&
    session.phase === 'editing' &&
    !session.committed &&
    recoveryConflictOf(session) === null
  );
} // End of function isRecoveryEditable()

/**
 * Everything the form must forget when the transaction it would send changes.
 *
 * `matchCreation.ts`'s rule, and it exists there because of a real defect: consent
 * is content-addressed to the **buffers** alone, so findings accepted for a create
 * in file A could be spent on a create in file B without a keystroke in between.
 * The destination is part of what would be sent, so a change of destination
 * withdraws the submission, the outcome describing it and the lines beside it.
 *
 * @param session - The form.
 * @param draft - The draft to install, with its consent already withdrawn and its
 *   base already re-pointed.
 * @returns The form with nothing said about an attempt that no longer describes
 *   what would be sent.
 */
function withdrawnSubmission(
  session: RecoverySession,
  draft: Draft<CreationBuffers>
): RecoverySession {
  return {
    ...session,
    draft,
    submitted: null,
    outcome: null,
    extraMessages: [],
    group: null,
    sendFailure: null
  };
} // End of function withdrawnSubmission()

/**
 * Chooses the file the new snippet will be created in.
 *
 * A document that is not one of this form's own destinations is **refused**, which
 * is the same shape `choosePlacement` has one module along: an ineligible file
 * cannot be installed by a caller any more than it can be offered by the list.
 *
 * The draft is re-pointed at the newly chosen file's revision through
 * `retargetedDraft`, which withdraws the consent in the same call. The typed
 * values are kept: they are what the person wrote, and they mean the same thing in
 * either file.
 *
 * @param session - The form.
 * @param document - The file to write into.
 * @returns The form with that destination, or the same form when it is not
 *   accepting changes, the destination did not move, or the file is not one of its
 *   own.
 */
export function chooseRecoveryDestination(
  session: RecoverySession,
  document: DocumentId
): RecoverySession {
  if (!isRecoveryEditable(session) || session.chosen === document) {
    return session;
  }
  if (!session.destinations.some((one) => one.document === document)) {
    return session;
  }
  return {
    ...withdrawnSubmission(
      session,
      retargetedDraft(session.draft, revisionOf(session.destinations, document))
    ),
    chosen: document
  };
} // End of function chooseRecoveryDestination()

/**
 * The buffers with one field replaced.
 *
 * A named helper rather than a computed-key spread at the call site: the spread
 * widens the result's type, and this keeps the record exact.
 *
 * @param buffers - What the controls hold.
 * @param field - Which field to replace.
 * @param text - What it should hold.
 * @returns The new buffers.
 */
function withField(
  buffers: CreationBuffers,
  field: CreationField,
  text: string
): CreationBuffers {
  const next: Record<CreationField, string> = { ...buffers };
  next[field] = text;
  return next;
} // End of function withField()

/**
 * Records whatever one of the two controls now holds.
 *
 * **A value carrying a carriage return is refused here as well as at submit**, the
 * same redundancy `editCreationField` documents: this is a statement about *this
 * function*, and the submit-time gate is a statement about what reaches the wire.
 * No control in this window can produce one — a `<textarea>`'s value has every
 * line break normalized and an `<input>` deletes the character outright — so what
 * this closes is a caller that is not a control.
 *
 * @param session - The form.
 * @param field - Which field.
 * @param text - The control's whole value.
 * @returns The form after the edit, or the same form when it is not accepting
 *   changes, the text carries a carriage return, or nothing changed.
 */
export function editRecoveryField(
  session: RecoverySession,
  field: CreationField,
  text: string
): RecoverySession {
  if (!isRecoveryEditable(session) || text.includes('\r')) {
    return session;
  }
  const recorded = recordTyping(
    session.draft,
    session.group,
    field,
    withField(session.draft.value, field, text),
    session.clock()
  );
  if (recorded === null) {
    return session;
  }
  return {
    ...session,
    draft: recorded.draft,
    focus: field,
    group: recorded.group,
    sendFailure: null
  };
} // End of function editRecoveryField()

/**
 * Records which control has the focus, ending the typing run when it moves.
 *
 * **A closed form answers itself**, which is the confirmation pass's second
 * finding: {@link reloadRecoveryDiskVersion} makes `closed` terminal, and a late
 * focus or blur event — the kind a browser delivers as controls are removed — was
 * still producing a new session from it. The guard is `closed` alone and
 * deliberately not {@link isRecoveryEditable}: a blur genuinely arrives while a
 * create is in flight or a conflict is on screen, and closing the typing run then
 * is right. What must not happen is a form the person has left behind answering
 * with anything but itself.
 *
 * @param session - The form.
 * @param field - The field that now has the focus, or `null` for a blur.
 * @returns The form with the focus recorded and the run closed when it moved, or
 *   the same form when it is closed or the focus did not move.
 */
export function focusRecoveryField(
  session: RecoverySession,
  field: CreationField | null
): RecoverySession {
  if (session.closed || session.focus === field) {
    return session;
  }
  return { ...session, focus: field, group: null };
} // End of function focusRecoveryField()

/**
 * Goes back one step.
 *
 * A structural action, so the typing run ends: a keystroke after an undo starts a
 * step of its own rather than amending the value the undo restored.
 *
 * @param session - The form to undo.
 * @returns The form one step back, or the same form when there is nothing to undo
 *   or it is not accepting changes.
 */
export function undoRecoveryEdit(session: RecoverySession): RecoverySession {
  if (!isRecoveryEditable(session)) {
    return session;
  }
  const draft = undoDraft(session.draft);
  return draft === session.draft ? session : { ...session, draft, group: null, sendFailure: null };
} // End of function undoRecoveryEdit()

/**
 * Goes forward one step, undoing an undo.
 *
 * @param session - The form to redo.
 * @returns The form one step forward, or the same form when there is nothing to
 *   redo or it is not accepting changes.
 */
export function redoRecoveryEdit(session: RecoverySession): RecoverySession {
  if (!isRecoveryEditable(session)) {
    return session;
  }
  const draft = redoDraft(session.draft);
  return draft === session.draft ? session : { ...session, draft, group: null, sendFailure: null };
} // End of function redoRecoveryEdit()

/**
 * Why this form cannot be submitted as it stands.
 *
 * **A code, never a sentence.** 2c-4c-3 adds the key function and the two
 * dictionaries; nothing draws these yet.
 */
export type RecoveryRefusal =
  /** A confirmed reload has ended this form; the person left it behind. */
  | 'formClosed'
  /** A recovery create has already committed through this form. */
  | 'alreadyCreated'
  /** A create is in flight. */
  | 'saveInFlight'
  /** This form's own conflict is on screen and has not been dismissed. */
  | 'conflict'
  /** No destination has been chosen, because none could be preferred. */
  | 'noDestination'
  /** The chosen file is not one of this form's own destinations. */
  | 'destinationUnavailable'
  /**
   * The trigger is empty, and it is required.
   *
   * The state a transfer that could carry no trigger leaves behind: the box is
   * blank, the reason is on the transfer table beside it, and the person supplies
   * a value rather than this application inventing one.
   */
  | 'triggerEmpty'
  /** The body is empty, and it is required. */
  | 'replaceEmpty'
  /** A value carries a carriage return, which no control here could read back. */
  | 'carriageReturn';

/**
 * Why the form cannot be submitted, or `null` when it can.
 *
 * The order of the checks is the order a person would fix them in: what the form
 * is doing, then where the snippet goes, then what it says.
 *
 * @param session - The form to ask about.
 * @returns The reason, or `null` when {@link beginRecoveryCreate} would produce a
 *   submission.
 */
export function recoveryRefusal(session: RecoverySession): RecoveryRefusal | null {
  if (session.closed) {
    return 'formClosed';
  }
  if (session.committed) {
    return 'alreadyCreated';
  }
  if (session.phase === 'saving') {
    return 'saveInFlight';
  }
  if (recoveryConflictOf(session) !== null) {
    return 'conflict';
  }
  const chosen = session.chosen;
  if (chosen === null) {
    return 'noDestination';
  }
  if (!session.destinations.some((one) => one.document === chosen)) {
    return 'destinationUnavailable';
  }
  const buffers = session.draft.value;
  if (buffers.trigger === '') {
    return 'triggerEmpty';
  }
  if (buffers.replace === '') {
    return 'replaceEmpty';
  }
  if (buffers.trigger.includes('\r') || buffers.replace.includes('\r')) {
    return 'carriageReturn';
  }
  return null;
} // End of function recoveryRefusal()

/**
 * Whether the form may be submitted.
 *
 * @param session - The form to ask about.
 * @returns `true` when {@link recoveryRefusal} answers `null`.
 */
export function canCreateRecovery(session: RecoverySession): boolean {
  return recoveryRefusal(session) === null;
} // End of function canCreateRecovery()

/** A recovery create about to be sent: the form that is waiting, and what to send. */
export interface StartedRecoveryCreate {
  /** The form, now in flight, with the submission recorded on it. */
  readonly session: RecoverySession;
  /**
   * What was drafted, for the acknowledgement round trip and the history
   * boundary.
   *
   * Its `acknowledgement` is whatever consent is bound to **this exact
   * candidate** and `EMPTY_ACKNOWLEDGEMENT` otherwise; `submissionOf` is the only
   * place the two are put together.
   */
  readonly submission: DraftSubmission<CreationBuffers>;
  /** The file to write into. */
  readonly document: DocumentId;
  /** What the new snippet says: the two typed values and the carried keys. */
  readonly newMatch: NewMatch;
  /** Where it goes, and it is always {@link RECOVERY_POSITION}. */
  readonly position: NewMatchPosition;
}

/**
 * Starts a recovery create of the form as it stands.
 *
 * The wire values are built from **the submission's own candidate** rather than
 * from the session, so the three values that travel together — the candidate, the
 * consent bound to it, and the `NewMatch` derived from it — cannot describe two
 * different things.
 *
 * **The carriage-return gate is repeated on the derived candidate**, and it is not
 * redundant: {@link recoveryRefusal} reads the live buffers, and this reads what
 * would actually be written, including the four carried fields — which no control
 * touches and which come from a projection, so a value carrying one could only
 * arrive by a route {@link transferOfField} already refuses. It is checked because
 * `NewMatch` carries **no brand**, so a caller that builds one by hand type-checks.
 *
 * @param session - The form to submit.
 * @returns The waiting form and everything the command takes, or `null` when
 *   {@link recoveryRefusal} names a reason.
 */
export function beginRecoveryCreate(session: RecoverySession): StartedRecoveryCreate | null {
  if (!canCreateRecovery(session)) {
    return null;
  }
  const chosen = session.chosen;
  if (chosen === null) {
    return null;
  }
  const submission = submissionOf(session.draft);
  const newMatch = newMatchOfRecovery(session.transfer, submission.candidate);
  if (Object.values(newMatch).some((value) => typeof value === 'string' && value.includes('\r'))) {
    return null;
  }
  return {
    session: {
      ...session,
      phase: 'saving',
      submitted: submission,
      group: null,
      sendFailure: null
    },
    submission,
    document: chosen,
    newMatch,
    position: RECOVERY_POSITION
  };
} // End of function beginRecoveryCreate()

/**
 * Takes a recovery create's answer.
 *
 * **A committed create is what answers the source conflict**, and nothing else
 * does: `committed` is set here, {@link sourceConflictState} answers `spent` from
 * then on, and no transition clears it.
 *
 * **The `adoption` argument is also read for a second question**, which is the
 * 2c-4c-2 review's High: anything but `notOwed` means the wrapper ordered a
 * re-read of the file, so a result that committed nothing can still have moved the
 * window out from under the conflict recovery was opened from — and whether it did
 * is what neither that answer nor this module reports. That is recorded on {@link RecoverySession.windowWasReconciled} and is why
 * {@link sourceConflictState} has three answers rather than two.
 *
 * **A failed adoption is a line beside the outcome, never in place of it.** The
 * wrapper answers `adoption: { kind: 'failed' }` when the file was written and
 * this window could not read it back; telling the person the create failed would
 * invite a retry of a write that already happened, and a committed write is never
 * afterwards reported as an error.
 *
 * @param session - The form waiting for an answer.
 * @param result - How the save ended, exactly as the transaction reported it.
 * @param adoption - What became of the adoption, from `BrowserState.createMatch`.
 *   Required and not defaulted: a default would be this function inventing a
 *   `notOwed` for a caller that simply did not look.
 * @returns The form showing what the create ended as.
 */
export function applyRecoveryCreate(
  session: RecoverySession,
  result: SaveResult,
  adoption: InvalidationStatus
): RecoverySession {
  const submission = session.submitted;
  // **Closed first, and not for the reason the submission check happens to give.**
  // A closed form always has a `null` submission, so this arm was answering
  // identity by coincidence; a form the person has left behind must answer itself
  // because it is terminal (round 4's finding 2, taken one door wider than it was
  // written).
  if (session.closed || submission === null) {
    return session;
  }
  const outcome = describeEditSave(result, session.draft, RECOVERY_CONFLICT_CAPABILITIES);
  const failed = invalidationFailureMessage(adoption);
  const extraMessages = failed === null ? [] : [failed];
  // **The window's own reconciliation, read off the answer rather than assumed.**
  // `adoption` is `notOwed` exactly when `BrowserState.createMatch` decided the
  // result left this window in step, and anything else means it ordered a re-read
  // and a repair of the selection — after which this form cannot go on calling the
  // window `retained`, whatever that re-read found.
  const windowWasReconciled = session.windowWasReconciled || adoption.kind !== 'notOwed';
  if (result.outcome !== 'saved') {
    return {
      ...session,
      phase: 'editing',
      group: null,
      outcome,
      extraMessages,
      reload: NOT_RELOADING,
      sendFailure: null,
      windowWasReconciled
    };
  }
  return {
    ...session,
    // A commit replaced the bytes every destination revision here was derived
    // from, so the form stops accepting changes and the source conflict is
    // answered. A `committed: false` answers nothing — and whether the window
    // moved under it is the separate question above.
    committed: result.committed,
    windowWasReconciled,
    created: result.moved,
    draft: savedDraft(session.draft, submission, result.revision),
    phase: 'editing',
    group: null,
    outcome,
    extraMessages,
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function applyRecoveryCreate()

/**
 * Records that the recovery create produced no outcome.
 *
 * **Not an outcome, and not always "nothing was written".** The command failed
 * before any of the three arms existed. Whether the file changed is a **second**
 * question, and the only honest answers are *no* and *this application cannot
 * tell*. The draft is untouched either way, so nothing the person typed is lost.
 *
 * **`mayHaveWritten` is also what says the window may have moved.** It is the
 * exact condition on which `BrowserState.createMatch` orders a re-read of the
 * file, so a form that takes one records
 * {@link RecoverySession.windowWasReconciled} and
 * {@link sourceConflictState} stops answering `retained`. A failure that wrote
 * nothing orders no re-read and leaves the source conflict where it was.
 *
 * **A retry after an uncertain send is write-safe, and the reason is staleness
 * rather than anything about duplicate execution**: this form resends the frozen
 * base revision of the destination it chose, so a first write that really did
 * happen makes that base stale and the retry **conflicts** rather than creating a
 * second snippet. What that does not establish is what the file holds — a retry
 * that conflicts is this window learning the file moved, not proof of which write
 * moved it.
 *
 * **A closed form answers itself**, which is round 4's finding 2: this door was
 * missing from the hand-written enumeration that was supposed to cover them all.
 * It is unreachable through {@link sendRecoveryCreate}, which never gets past
 * {@link beginRecoveryCreate} for a closed form — and *unreachable through the one
 * composition* is not the same as *guarded*, which is why the enumeration is now
 * checked against this module's own export list rather than written out by hand.
 *
 * @param session - The form waiting for an answer.
 * @param mayHaveWritten - Whether the file may already hold the new snippet.
 * @param reason - Why the command rejected, or `null` when nothing was sent.
 * @returns The form, back to drafting, with the right notice raised, or the same
 *   form when it is closed.
 */
export function recoveryCreateCouldNotBeSent(
  session: RecoverySession,
  mayHaveWritten: boolean,
  reason: IpcFailure | null
): RecoverySession {
  if (session.closed) {
    return session;
  }
  return {
    ...session,
    phase: 'editing',
    group: null,
    sendFailure: sendFailureOf(mayHaveWritten, reason),
    windowWasReconciled: session.windowWasReconciled || mayHaveWritten
  };
} // End of function recoveryCreateCouldNotBeSent()

/**
 * Records that the person accepted the findings of the refusal on screen.
 *
 * Delegates to `consentForRefusal`, which delegates to `acknowledgeRefusal` — the
 * **only** producer of consent in this application. The submission is taken from
 * the form rather than from an argument, so a caller cannot pair one candidate's
 * acknowledgement with another candidate.
 *
 * The refusal this most often answers is the one 2c-4c-1 added: a new snippet
 * whose trigger text exactly repeats one another snippet in the destination list
 * already writes. That finding claims **risk and nothing else** — this application
 * cannot determine how espanso handles overlapping definitions — and consenting to
 * it is what makes the same create proceed.
 *
 * **A closed form answers itself before the refusal is read at all**, which is
 * round 4's second finding: `RecoverySession` does not encode *closed implies no
 * outcome*, so a value that carries both is type-valid and would otherwise record
 * consent for a form the person has left behind.
 *
 * @param session - The form showing a refusal.
 * @returns The form carrying consent, or the same form.
 */
export function acknowledgeRecoveryFindings(session: RecoverySession): RecoverySession {
  if (session.closed) {
    return session;
  }
  const draft = consentForRefusal(session.draft, session.submitted, session.outcome);
  return draft === session.draft ? session : { ...session, draft };
} // End of function acknowledgeRecoveryFindings()

/**
 * Puts the outcome away and gives the controls back.
 *
 * The draft is untouched — this is a panel being dismissed, not a state being
 * resolved — and the submission goes with it, because there is nothing left on
 * screen to acknowledge.
 *
 * **It does not give the controls back after a commit**, deliberately:
 * {@link RecoverySession.committed} survives this, so a person cannot dismiss
 * their way into creating a second snippet from destinations that are stale.
 *
 * **It is not the way out of a conflict, and saying so was the 2c-4c-2 review's
 * third finding.** Dismissing the panel changes no revision: the form still holds
 * the base it was opened at, so sending again meets the same refused base and
 * conflicts again. What moves the form onto the newly parsed file is
 * {@link reapplyRecoveryToDiskVersion}, which keeps the typed values, or
 * {@link reloadRecoveryDiskVersion}, which abandons them — and neither is drawn
 * yet.
 *
 * **A closed form answers itself**, for {@link focusRecoveryField}'s reason: after
 * a confirmed reload there is nothing left to dismiss, and a terminal form that
 * handed back a fresh value would be a form still in play.
 *
 * @param session - The form showing an outcome.
 * @returns The form with nothing being said about the last attempt, or the same
 *   form when it is closed.
 */
export function keepRecovering(session: RecoverySession): RecoverySession {
  if (session.closed) {
    return session;
  }
  return {
    ...session,
    submitted: null,
    outcome: null,
    extraMessages: [],
    group: null,
    reload: NOT_RELOADING,
    sendFailure: null
  };
} // End of function keepRecovering()

/**
 * What sends one recovery create, as this module sees it.
 *
 * `BrowserState.createMatch`'s own signature, and the composition below is the
 * **only** way anything here reaches a file: there is no new command, no second
 * writer and no `force` flag, and every recovery create ends in the same
 * `run_one_save` the other five writers do.
 *
 * **What that forces and what it does not, in the same sentence.** It forces that
 * this module calls nothing itself — a caller supplies the function, and a form
 * that {@link beginRecoveryCreate} refuses never calls it at all. It cannot force
 * that the function passed is `BrowserState.createMatch`: nothing stops a
 * component importing `createMatch` from `../ipc/commands` and skipping the
 * wrapper, which is the hole every writing path has had since 2b-2a.
 */
export type CreateARecoveredSnippet = (
  document: DocumentId,
  newMatch: NewMatch,
  position: NewMatchPosition,
  baseRevision: ContentRevision,
  acknowledgement: Acknowledgement
) => Promise<RecoveryCreateAnswer>;

/**
 * What `BrowserState.createMatch` answers, as this module needs it.
 *
 * Declared structurally rather than imported as `MatchSaveAnswer`, so that this
 * module depends on the **shape** of that answer and not on the state module: a
 * recovery form is driven by a callback, and a test drives it with a function it
 * wrote itself. The three arms are that type's three arms, and
 * `workspace.svelte.ts`'s value satisfies this by structure — which a workspace
 * test checks by passing the real method.
 */
export type RecoveryCreateAnswer =
  | {
      /** The transaction answered. */
      readonly kind: 'answered';
      /** How the save ended. */
      readonly result: SaveResult;
      /** What became of the adoption a committed save owes. */
      readonly adoption: InvalidationStatus;
    }
  | {
      /** The state refused before any command ran, so nothing was written. */
      readonly kind: 'notAttempted';
    }
  | {
      /** A command ran, rejected, and produced no outcome. */
      readonly kind: 'failed';
      /** Whether the file may already hold the new snippet. */
      readonly mayHaveWritten: boolean;
      /** Why the command rejected. */
      readonly failure: IpcFailure;
    };

/**
 * Sends the recovery create and folds its answer back into the form.
 *
 * **The composition, in one place**, so that *every recovery write goes through
 * `BrowserState.createMatch`* is a property of one function rather than of six
 * call sites — and so that a test can prove the callback is **not** called for a
 * form that cannot be submitted.
 *
 * **Nothing in this module touches the selection, the projections or the conflict
 * the form was opened from — and the function it awaits does.** That distinction
 * is the 2c-4c-2 review's High: `BrowserState.createMatch` orders a re-read of the
 * file whenever the answer is not one it can leave the window alone for, which
 * includes two answers that commit nothing. What comes back therefore records
 * {@link RecoverySession.windowWasReconciled}, and
 * {@link sourceConflictState} stops calling the source conflict intact.
 *
 * The rule that a person who moved the selection while a create was in flight is
 * not dragged to the new snippet is that wrapper's own, held in the same
 * synchronous block as the write to `selected`; this module neither observes nor
 * changes it.
 *
 * @param session - The form to submit.
 * @param create - `BrowserState.createMatch`. Called at most once, and not at all
 *   when the form cannot be submitted.
 * @returns The form after the attempt, which is the same form when there was
 *   nothing to send.
 */
export async function sendRecoveryCreate(
  session: RecoverySession,
  create: CreateARecoveredSnippet
): Promise<RecoverySession> {
  const started = beginRecoveryCreate(session);
  if (started === null) {
    return session;
  }
  const answer = await create(
    started.document,
    started.newMatch,
    started.position,
    // The submission's own base revision, which is the chosen destination's, and
    // never a revision read at the moment of the call: reading one here would
    // rebase a form the window has moved on from and turn the conflict that should
    // stop it into a commit.
    started.submission.baseRevision,
    started.submission.acknowledgement
  );
  if (answer.kind === 'answered') {
    return applyRecoveryCreate(started.session, answer.result, answer.adoption);
  }
  return answer.kind === 'notAttempted'
    ? recoveryCreateCouldNotBeSent(started.session, false, null)
    : recoveryCreateCouldNotBeSent(started.session, answer.mayHaveWritten, answer.failure);
} // End of function sendRecoveryCreate()

/**
 * Asks to load the version on disk, which is the step **before** confirming.
 *
 * **A closed form answers itself first**, before the conflict or the reload step is
 * read: neither is cleared by the type, only by the transition that closes a form
 * today (round 4's second finding).
 *
 * @param session - The form showing a conflict of its own.
 * @returns The form at the warning, or the same form when it is closed, no
 *   conflict is showing, or one has already been asked about.
 */
export function askToReloadRecoveryDiskVersion(session: RecoverySession): RecoverySession {
  if (session.closed) {
    return session;
  }
  const next = reloadAsked(recoveryConflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function askToReloadRecoveryDiskVersion()

/**
 * Confirms abandoning this recovered snippet for the version on disk.
 *
 * Issues the token the adoption checks, for **this** conflict. Reachable only from
 * the warning step, so a confirmation cannot be produced by a screen that never
 * showed the warning.
 *
 * **A closed form answers itself first**, for
 * {@link askToReloadRecoveryDiskVersion}'s reason: issuing a confirmation for a
 * form the person has left behind would mint a token an adoption would honour.
 *
 * @param session - The form at the warning.
 * @returns The form holding the confirmation, or the same form.
 */
export function confirmRecoveryDiskReload(session: RecoverySession): RecoverySession {
  if (session.closed) {
    return session;
  }
  const next = reloadConfirmed(recoveryConflictOf(session), session.reload);
  return next === null ? session : { ...session, reload: next };
} // End of function confirmRecoveryDiskReload()

/**
 * Adopts the disk version into the window and ends this recovery form.
 *
 * **The match-level reload result, for a form whose draft nothing on disk
 * describes**: there is no disk-side recovered snippet to seed, so the window
 * crosses to the disk observation and this form **closes**.
 *
 * **A satisfied spend records that the window may have moved**, which is the confirmation
 * pass's first finding: this transition does not spend the source conflict's
 * authorization — it spends this form's own — but the adoption it does spend
 * **may install a projection and repair the selection**, which would advance the
 * very projection generation the source conflict's authorization is keyed to.
 * *Not spending `origin.conflict`* and *not invalidating the window it was
 * registered against* are two different statements, and only the first was ever
 * true here. So {@link RecoverySession.windowWasReconciled} is set and
 * {@link sourceConflictState} answers `windowMoved` from then on.
 *
 * **`alreadyThere` records it too, and that is why the sentence above says *may*.**
 * `spendTheConfirmedReload` collapses `installed` and `alreadyThere` into
 * `satisfied`, so this transition cannot tell a projection that was replaced from
 * one the window already held; and a window already holding this conflict's disk
 * revision reached those bytes by some route this form did not watch.
 * `windowMoved` claims uncertainty rather than a movement, so recording it
 * over-claims nothing, where staying `retained` would claim the window is exactly
 * where the source conflict left it.
 *
 * **Nothing is closed and nothing is recorded for an adoption the window
 * refused**, which would report a reload that did not happen.
 *
 * **Built and not offered.** `RECOVERY_CONFLICT_CAPABILITIES.offersReload` is
 * `false`, so `conflictChoicesFor` names no reload control and 2c-4c-3 flips the
 * boolean over machinery that already exists — the trade 2c-4a-2 proved. It exists
 * now because the alternative was a form whose conflict messages described a
 * reload the value could not perform (the 2c-4c-2 review's third finding).
 *
 * @param session - The form holding a confirmation.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once.
 * @returns The closed form, or the same form.
 */
export function reloadRecoveryDiskVersion(
  session: RecoverySession,
  adopt: AdoptTheDiskVersion<CreationBuffers>
): RecoverySession {
  // **Before the spend, and this is the guard that keeps a terminal form away from
  // the window** (round 4's second finding): a closed session that still carried a
  // conflict and a confirmed step is type-valid, and without this it would reach
  // an adoption.
  if (session.closed) {
    return session;
  }
  const spend = spendTheConfirmedReload(recoveryConflictOf(session), session.reload, adopt);
  if (spend === 'notAttempted') {
    return session;
  }
  if (spend === 'refused') {
    // The window said no and named no cause, so the control stops being offered
    // and the form says so — a decision about what to draw, never a claim that a
    // later ask would be refused too.
    return { ...session, reload: RELOAD_REFUSED };
  }
  return {
    ...session,
    group: null,
    submitted: null,
    outcome: null,
    extraMessages: [],
    reload: NOT_RELOADING,
    sendFailure: null,
    // The adoption that was just spent may have installed a projection here — a
    // `satisfied` spend does not say which — so the window the source conflict was
    // registered against is no longer one this form can vouch for.
    windowWasReconciled: true,
    closed: true
  };
} // End of function reloadRecoveryDiskVersion()

/**
 * Why a reapply of this recovery form could not be carried out.
 *
 * **A code, never a sentence.** There is no key function for these yet, and that is
 * this step's boundary: nothing draws them, so 2c-4c-3 adds the accessors together
 * with the panel that renders them.
 */
export type RecoveryReapplyObstacle =
  | SharedReapplyObstacle
  | {
      /**
       * The conflict is about a file this form is not writing into.
       *
       * **Unreachable while a conflict is showing**, because
       * {@link isRecoveryEditable} is `false` then and
       * {@link chooseRecoveryDestination} refuses — so the destination cannot move
       * between the send and the reapply. It is checked rather than assumed
       * because rebasing against the wrong file's projection would install another
       * file's revision under this form's destination.
       */
      readonly kind: 'notTheDestination';
    }
  | {
      /**
       * The rebuilt form cannot be submitted, for one of the ordinary reasons.
       *
       * {@link recoveryRefusal}'s own verdict over the newly parsed projection —
       * the destination is no longer a writable snippet file, a required value is
       * empty. One rule, asked again, rather than a second copy of it here.
       */
      readonly kind: 'recoveryRefused';
      /** Which of that rule's codes, for a later panel to render. */
      readonly reason: RecoveryRefusal;
    };

/** What a reapply of this recovery form became. */
export type RecoveryReapply = ReapplyOutcome<RecoverySession, RecoveryReapplyObstacle>;

/**
 * Re-points this form at the newly parsed disk version and revalidates it.
 *
 * **The way out of a conflict that keeps the typed values**, and the reason it
 * exists at this step rather than at the one that draws it: without it, dismissing
 * a conflict left the form holding the base revision the transaction had just
 * refused, so the next send met the same refusal — a loop the review named (its
 * third finding). This is the creator's own transition in the shape a recovery
 * form takes:
 *
 * - the chosen destination is rebuilt from `ConflictModel.disk`, the projection
 *   paired with the revision the conflict reported, and is **dropped** when that
 *   projection says the file may no longer be written into;
 * - the draft's base revision moves with it, through `retargetedDraft`, which
 *   withdraws the consent in the same call: findings accepted for one revision's
 *   candidate say nothing about another's;
 * - the typed values are kept, because they are what the person wrote and they
 *   mean the same thing against either parse;
 * - {@link recoveryRefusal} is asked again in full over the rebuilt form.
 *
 * **There is no `alreadySatisfied` arm, and there must not be one.** *Somebody else
 * already added this snippet* would mean comparing the drafted trigger against the
 * file's, which is the precheck the consult refuses: whether the destination
 * already writes that trigger text is decided by the candidate's own findings, at
 * the command.
 *
 * The order is decide-then-adopt, so **a refusal leaves the window exactly where it
 * was** — nothing is adopted and nothing is recorded. **A success may move it**,
 * and the session handed back says so: the adoption may install a projection and
 * repair the selection — `alreadyThere` is a success that installs nothing — which
 * would advance the projection generation the *source* conflict's authorization is
 * keyed to, so the rebuilt form carries
 * {@link RecoverySession.windowWasReconciled} and {@link sourceConflictState}
 * answers `windowMoved`. That is the confirmation pass's first finding, and
 * {@link reloadRecoveryDiskVersion} carries the same rule with the same reasoning
 * about `alreadyThere`.
 *
 * **Built and not offered**, like the reload above.
 *
 * @param session - The form showing a conflict of its own.
 * @param adopt - `BrowserState.adoptDiskVersion`. Called at most once, and never
 *   at all on a refusal.
 * @returns What became of the attempt.
 */
export function reapplyRecoveryToDiskVersion(
  session: RecoverySession,
  adopt: AdoptTheDiskVersion<CreationBuffers>
): RecoveryReapply {
  // **A closed form attempts nothing**, before its conflict is read and long before
  // an adoption could be reached. `notAttempted` is the arm for it: its sentence is
  // about the ordinary reason there is nothing to attempt, and a form the person
  // has left behind is a second reason with the same consequence — nothing was
  // asked of the window. Nothing draws this yet, so no sentence is on a screen.
  if (session.closed) {
    return { kind: 'notAttempted' };
  }
  const start = beginReapply(RECOVERY_CONFLICT_CAPABILITIES, recoveryConflictOf(session));
  if (start.kind !== 'ready') {
    return start;
  }
  if (!subjectIsTargetless(start.evidence)) {
    // A creation brings its own snippet, so its conflict answers `Targetless`.
    // Anything else is evidence this form cannot rebase onto, and refusing writes
    // nothing.
    return { kind: 'manualResolution', obstacle: { kind: 'evidenceNotATarget' } };
  }
  const disk = start.conflict.disk;
  if (session.chosen === null || session.chosen !== disk.id) {
    return { kind: 'manualResolution', obstacle: { kind: 'notTheDestination' } };
  }
  const rebuilt: RecoverySession = {
    ...session,
    destinations: rebuiltDestinations(session.destinations, disk),
    draft: retargetedDraft(session.draft, disk.revision),
    phase: 'editing',
    submitted: null,
    outcome: null,
    extraMessages: [],
    group: null,
    sendFailure: null,
    reload: NOT_RELOADING
  };
  const refusal = recoveryRefusal(rebuilt);
  if (refusal !== null) {
    return { kind: 'manualResolution', obstacle: { kind: 'recoveryRefused', reason: refusal } };
  }
  if (adoptForReapply(start.conflict, adopt) === 'refused') {
    return { kind: 'adoptionRefused' };
  }
  // **Recorded on the way out rather than in the rebuild**, because it is a fact
  // about the adoption that has just been spent and not about the rebase: a
  // refusal above returns without it, and a success cannot leave
  // `sourceConflictState` answering `retained`.
  return { kind: 'reapplied', session: { ...rebuilt, windowWasReconciled: true } };
} // End of function reapplyRecoveryToDiskVersion()

/**
 * The destination list with one file's entry taken from a newer projection.
 *
 * The entry is **replaced** when that projection says the file may still be
 * written into and **removed** when it does not — which is what makes
 * {@link recoveryRefusal} answer `destinationUnavailable` for a form whose chosen
 * file has lost its snippet list, rather than leaving a revision behind that the
 * command would refuse.
 *
 * @param destinations - What the form holds now.
 * @param view - The newly parsed projection of one of them.
 * @returns The list to hold, in the same order.
 */
function rebuiltDestinations(
  destinations: readonly RecoveryDestination[],
  view: DocumentView
): readonly RecoveryDestination[] {
  const eligible = destinationEligibility(view, view).kind === 'eligible';
  const rebuilt: RecoveryDestination[] = [];
  for (const held of destinations) {
    if (held.document !== view.id) {
      rebuilt.push(held);
    } else if (eligible) {
      rebuilt.push({ document: view.id, path: view.relative_path, revision: view.revision });
    }
  } // End of the loop over the destinations this form was opened with
  return rebuilt;
} // End of function rebuiltDestinations()

/**
 * What this form offers about a conflict of its **own**.
 *
 * **Every offer is withheld and every declaration is true of a transition that
 * exists.** The drafted value is two strings a person typed, so `draftKind` is
 * `authoredText`. A reload here adopts the disk projection and **ends this form** —
 * {@link reloadRecoveryDiskVersion} — so `reloadOutcome` is `closesSurface` and the
 * warning `describeConflict` appends to every conflict arm describes something this
 * value really does. `reapplySupport` is `supported` because
 * {@link reapplyRecoveryToDiskVersion} **is** that transition, built and driven by
 * this module's own suite.
 *
 * **The three booleans are `false` because nothing is drawn in this step**, which
 * is the 2c-4a-2 trade rather than a gap: the transitions exist and are tested, and
 * 2c-4c-3 flips a boolean per control without inventing machinery. What that leaves
 * on screen until then is *keep editing* alone.
 *
 * **This is the 2c-4c-2 review's findings 2 and 3, closed together.** The first
 * version declared `supported` while no reapply transition existed and reinterpreted
 * the variant's own contract to excuse it, and it recorded the reload warning as an
 * incoherence to be lived with — which also left a dismissed conflict holding the
 * base revision the transaction had just refused, so the next send met the same
 * refusal. Building both transitions closes all of that at once.
 */
export const RECOVERY_CONFLICT_CAPABILITIES: ConflictCapabilities = {
  draftKind: 'authoredText',
  reloadOutcome: 'closesSurface',
  offersCopyDraft: false,
  offersReload: false,
  offersReapply: false,
  reapplySupport: 'supported'
};

/** One row of the transfer table a screen draws. */
export interface RecoveryFieldModel {
  /** Which field, as its espanso key. */
  readonly field: EditableField;
  /** Its label, as the detail pane's own code, rendered through `tDetailField`. */
  readonly label: DetailFieldName;
  /** What the retained draft made of it. */
  readonly transfer: FieldTransfer;
  /**
   * Whether a control holds this value rather than the transfer.
   *
   * `true` for the two mandatory fields and `false` for the four optional ones:
   * the consult's Q1 makes the trigger an explicit editable literal, and the body
   * is editable for the same reason — a recovery that could not carry one has to
   * be completable by hand.
   */
  readonly editable: boolean;
}

/** Everything a screen needs about one recovery form, derived on every read. */
export interface RecoveryView {
  /** Every file the form may write into, in window order. */
  readonly destinations: readonly RecoveryDestination[];
  /** The file chosen, or `null`. */
  readonly chosen: RecoveryDestination | null;
  /** Where the snippet goes, and there is no other value and no chooser. */
  readonly position: NewMatchPosition;
  /** The transfer table, in {@link EDITABLE_FIELDS} order. */
  readonly fields: readonly RecoveryFieldModel[];
  /** What the trigger control shows. */
  readonly trigger: string;
  /** What the body control shows. */
  readonly replace: string;
  /** Whether either control has been changed since the form opened. Derived. */
  readonly dirty: boolean;
  /** Whether there is a step to go back to. Derived. */
  readonly canUndo: boolean;
  /** Whether there is an undone step to go forward to. Derived. */
  readonly canRedo: boolean;
  /** Whether a create is in flight. */
  readonly saving: boolean;
  /** Whether the controls accept changes. */
  readonly editable: boolean;
  /** Whether the create control does anything. */
  readonly canCreate: boolean;
  /** Why it does not, as a code, or `null`. */
  readonly refusal: RecoveryRefusal | null;
  /** How the last attempt failed to produce an outcome, or `null`. */
  readonly sendFailure: SendFailure | null;
  /** The reasons to show beside that failure, outermost first. */
  readonly failureLines: readonly SendFailureLine[];
  /** How the last attempt ended, or `null`. */
  readonly outcome: SaveOutcomeModel<CreationBuffers> | null;
  /** The outcome's lines followed by anything to be said beside them. */
  readonly messages: readonly SaveOutcomeMessage[];
  /** The presentation changes a saved arm disclosed, in report order. */
  readonly notes: readonly PresentationNote[];
  /**
   * What to offer about a refusal, withdrawn once its findings are stale.
   *
   * The existing `RawSaveChoice`, so that the acknowledgement round trip a
   * recovery goes through is the one every other surface goes through — including
   * the *save anyway* that answers 2c-4c-1's repeated-trigger finding.
   */
  readonly refusalChoices: readonly RawSaveChoice[];
  /** Whether the findings on screen are about a draft that has since changed. */
  readonly findingsAreStale: boolean;
  /** This form's **own** conflict, never the one it was opened from. */
  readonly conflict: ConflictModel<CreationBuffers> | null;
  /** What to offer about that conflict. */
  readonly conflictChoices: readonly ConflictChoice[];
  /** The disk side of that conflict, or `null` when none is showing. */
  readonly diskText: ConflictDiskText | null;
  /** Whether the warning is showing and the destructive choice is one click away. */
  readonly awaitingReloadConfirmation: boolean;
  /**
   * Whether a confirmed reload was spent and the window refused it.
   *
   * The disclosure a panel owes for a control that has just gone: the refusal came
   * back with no word about its cause, so the control is withheld rather than
   * claiming a later ask could only be refused too.
   */
  readonly reloadUnavailable: boolean;
  /** Whether a confirmed reload has ended this form. */
  readonly closed: boolean;
  /** Whether a create has committed and this form is spent. */
  readonly committed: boolean;
  /** The created snippet's identity, or `null`. See the session's own field. */
  readonly created: MatchId | null;
  /**
   * What became of the conflict this form was opened from.
   *
   * {@link sourceConflictState}, carried on the view so that a screen drawing both
   * reads one answer rather than deciding it in markup — and **three-valued**,
   * because a window that re-read the file under a non-committed answer is neither
   * *exactly where it was* nor *done with*.
   */
  readonly sourceConflict: SourceConflictState;
}

/**
 * Everything a screen needs about one recovery form.
 *
 * Derived on every call and stored nowhere, which is 2c-1a's D2 carried up: a
 * `dirty` this module cached would be a second answer to a question the draft
 * already answers, and the two would eventually disagree.
 *
 * @param session - The form to describe.
 * @returns The view.
 */
export function recoveryView(session: RecoverySession): RecoveryView {
  const outcome = session.outcome;
  const refused = refusedArm(outcome);
  const stale = submissionIsStale(session.draft, session.submitted);
  const conflict = recoveryConflictOf(session);
  const saved = outcome !== null && outcome.kind === 'saved' ? outcome : null;
  return {
    destinations: session.destinations,
    chosen: session.destinations.find((one) => one.document === session.chosen) ?? null,
    position: RECOVERY_POSITION,
    fields: EDITABLE_FIELDS.map((field) => ({
      field,
      label: fieldLabelName(field),
      transfer: session.transfer[field],
      editable: field === 'trigger' || field === 'replace'
    })),
    trigger: session.draft.value.trigger,
    replace: session.draft.value.replace,
    dirty: isDirty(session.draft),
    canUndo: canUndo(session.draft),
    canRedo: canRedo(session.draft),
    saving: session.phase === 'saving',
    editable: isRecoveryEditable(session),
    canCreate: canCreateRecovery(session),
    refusal: recoveryRefusal(session),
    sendFailure: session.sendFailure,
    failureLines: sendFailureLines(session.sendFailure?.reason ?? null),
    outcome,
    messages: outcome === null ? [] : [...outcome.messages, ...session.extraMessages],
    notes: saved === null ? [] : saved.notes,
    refusalChoices: offeredRefusalChoices(refused, stale),
    findingsAreStale: refused !== null && stale,
    conflict,
    // **`conflictChoicesFor` stays the only producer**, and it is asked about this
    // form's own reload step exactly as the other six surfaces ask about theirs.
    // What that list holds *today* is `keepEditing` alone, because all three offer
    // booleans are `false` — not because the step is a constant.
    conflictChoices:
      conflict === null
        ? []
        : conflictChoicesFor(RECOVERY_CONFLICT_CAPABILITIES, offeredReloadStep(session.reload)),
    diskText: conflictDiskText(conflict),
    awaitingReloadConfirmation: conflict !== null && atTheReloadWarning(session.reload),
    reloadUnavailable: conflict !== null && reloadWasRefused(session.reload),
    closed: session.closed,
    committed: session.committed,
    created: session.created,
    sourceConflict: sourceConflictState(session)
  };
} // End of function recoveryView()

/**
 * The base revision this form would create against.
 *
 * A named read rather than a property walk at the call site, the same read
 * `matchCreation.baseRevisionOf` is: it is the **chosen destination's** revision,
 * re-pointed by {@link chooseRecoveryDestination} every time the destination
 * moves, and — for the conflict's own document — the disk revision the conflict
 * carried rather than the one the window still holds.
 *
 * @param session - The form to ask about.
 * @returns The revision the draft is drafted from.
 */
export function recoveryBaseRevisionOf(session: RecoverySession): ContentRevision {
  return session.draft.baseRevision;
} // End of function recoveryBaseRevisionOf()

/**
 * The fields the transfer could not carry, in {@link EDITABLE_FIELDS} order.
 *
 * What a screen needs to say *these were not carried* in one sentence instead of
 * reading the table twice. It is a derivation of {@link RecoverySession.transfer}
 * and never a second record of it.
 *
 * @param transfer - What the retained draft became.
 * @returns The fields the new snippet is not born holding.
 */
export function fieldsNotCarried(transfer: RecoveryTransfer): readonly EditableField[] {
  return EDITABLE_FIELDS.filter((field) => transfer[field].kind !== 'carried');
} // End of function fieldsNotCarried()
