/**
 * Restoring one file from one backup entry, driven without a screen.
 *
 * The groups follow the evidence consult Q7 item 3 says this step owes:
 *
 * 1. **the catalogue** — loading, choosing, and the two ways a listing can be
 *    about something this session did not ask for;
 * 2. **the candidate** — retained byte-exact, refused when it is not the one this
 *    session asked for, and never re-read;
 * 3. **the six competing surfaces** — starting and confirming are refused for each,
 *    and the sentence is true of an *open* surface rather than of a dirty one;
 * 4. **the binding** — every one of the five values a confirmation carries, moved
 *    one at a time, and each one refusing the confirmation;
 * 5. **the permit** — the same five moved *after* the confirmation, plus the
 *    candidate's own bytes and the two window observations, each of them refusing
 *    the send; and the one-shot spend at **both** memberships — the question a
 *    confirmation spends and the permit a send spends — including against a caller
 *    that re-enters through a getter, before the spend and after it;
 * 6. **no save without a confirmation** — a spy sender that must not be called on
 *    any path that lacks a valid unspent confirmation;
 * 7. **the freeze** — every transition answering its own argument while a send is in
 *    flight and once one has committed, and an answer classified against what was
 *    submitted rather than against what the session is showing;
 * 8. **the answer** — a commit, a `committed: false`, a refusal and its
 *    acknowledgement, the coordinator's whole-document invalidation, a committed
 *    invalidation failure, and an uncertain send;
 * 9. **the conflict** — the three adoption answers, a second conflict, and what a
 *    reload does to the retained candidate;
 * 10. **the sentences** — the keys these codes name, and the claims consult Q6
 *    forbids, including the ones a refusal's own predicate cannot support.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary helpers
 * here do.
 */

import { describe, expect, it, vi } from 'vitest';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import type { RawSaveInvalidation, RawSaveReload } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type {
  BackupBatchListing,
  BackupEntry,
  BackupEntryListing,
  BackupTextResponse,
  ContentRevision,
  DocumentId,
  DocumentView,
  Finding,
  PresentationNote,
  RefusedResult,
  SaveResult
} from '../ipc/types';
import { NOT_RELOADING, type AdoptTheDiskVersion, type ReloadStep } from './editorSave';
import { makeDocument, makeSummary } from './fixtures';
import { sealWholeDocumentSave, type SealedWholeDocumentSave } from './invalidation';
import {
  externalConflictSource,
  standingConflictOf,
  type ConflictSource,
  type ExternalChangeConflictSource,
  type ExternalConflictObservation,
  type ObservationVerdict
} from './conflictSource';
import { submissionOf } from './draft';
import {
  arbitratedDelivery,
  retainedDelivery,
  writtenHereDelivery,
  type ObservationDelivery
} from './observationDelivery';
import {
  acknowledgeRestoreFindings,
  acknowledgeRestoreSnapshot,
  applyRestore,
  applyRestoreObservation,
  askToReloadDiskVersion,
  baseRevisionOf,
  batchesLoaded,
  candidateRead,
  candidateRefused,
  candidateText,
  cancelRestore,
  canPrepareRestore,
  chooseBatch,
  chooseEntry,
  competingSurfaceFor,
  confirmDiskReload,
  confirmRestore,
  conflictOf,
  dismissRestoreOutcome,
  entriesLoaded,
  creatorEligibilityOf,
  loadingBatches,
  loadingEntries,
  openWriteSurfaceKey,
  prepareRestore,
  reapplyToDiskVersion,
  reloadTheDiskVersion,
  restoreConfirmationWithdrawn,
  restoreCouldNotBeSent,
  restoreRefusal,
  restoreRefusalKey,
  restoreView,
  revisionInProjection,
  sendRestore,
  startRestore,
  targetingSurfaceFor,
  targetRevisionObserved,
  type CompetingWriteSurfaceKind,
  type OpenWriteSurface,
  type OpenWriteSurfaceKind,
  type RestoreContext,
  type RestorePreview,
  type RestoreSend,
  type RestoreSession,
  type SendRestore,
  type StartedRestore,
  type WriteSurfaceTarget
} from './restore';
import {
  isExternalConflict,
  isSaveConflict,
  type ConflictChoice,
  type ConflictModel,
  type DiskAdoptionOutcome,
  type ExternalConflictModel,
  type SaveOutcomeModel
} from './saveOutcome';

/** The file every case here restores into. */
const TARGET = 7;

/** The revision the destination held when the session opened. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the destination holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** A third revision, for a destination some other writer moved. */
const ELSEWHERE: ContentRevision = 'c'.repeat(64);

/** A fourth, for a destination two other writers moved. */
const AGAIN: ContentRevision = 'd'.repeat(64);

/** The hash of the candidate bytes, which is never a base revision. */
const CANDIDATE_REVISION: ContentRevision = 'e'.repeat(64);

/** A second candidate's hash. */
const OTHER_CANDIDATE_REVISION: ContentRevision = 'f'.repeat(64);

/**
 * The candidate's exact bytes.
 *
 * **A CRLF document with a byte-order mark and a trailing space**, deliberately:
 * the raw editor refuses a carriage return because a `<textarea>` normalizes one
 * away, and a restore candidate never enters an input control — so what this suite
 * has to hold is that none of those bytes is touched anywhere on the path from the
 * wire to the sender.
 */
const CANDIDATE = '﻿matches:\r\n  - trigger: ":a"\r\n    replace: "b"   \r\n';

/** A second entry's bytes, for the cases about two candidates. */
const OTHER_CANDIDATE = 'matches:\n  - trigger: ":z"\n    replace: "y"\n';

/** The batch every case lists entries of. */
const BATCH = { name: '2026-01-01T00-00-00Z-000' };

/** A second recognised batch. */
const OTHER_BATCH = { name: '2026-01-02T00-00-00Z-000' };

/** A classified failure, for the arms that carry one. */
const FAILURE: IpcFailure = {
  kind: 'command',
  error: { code: 'backupReadFailed', error: { StaleBatch: { batch: BATCH } } }
};

/**
 * One entry of {@link BATCH}, as a listing found it.
 *
 * @param relativePath - The entry's path inside the batch.
 * @param batch - The batch it belongs to.
 * @returns The entry.
 */
function entryOf(relativePath = 'match/base.yml', batch = BATCH): BackupEntry {
  return {
    id: { batch, relative_path: relativePath },
    display_path: relativePath,
    length: '42',
    target: { InConfigRoot: { relative_path: relativePath } }
  };
} // End of function entryOf()

/** The batch listing every case starts from. */
const BATCHES: BackupBatchListing = {
  root: 'Present',
  batches: [
    { id: BATCH, display_name: BATCH.name },
    { id: OTHER_BATCH, display_name: OTHER_BATCH.name }
  ],
  skipped: [],
  unrecognised: 0,
  unreadable: 0,
  complete: true
};

/**
 * One batch's entry listing.
 *
 * @param batch - Which batch the listing is about.
 * @returns The listing.
 */
function entriesIn(batch = BATCH): BackupEntryListing {
  return {
    batch,
    entries: [entryOf('match/base.yml', batch), entryOf('match/other.yml', batch)],
    skipped: [],
    unrecognised: 0,
    unreadable: 0,
    unaddressable: 0,
    complete: true
  };
} // End of function entriesIn()

/**
 * What `read_backup_text` answers for one entry.
 *
 * @param over - Whatever the case needs to differ.
 * @returns The response, as it crosses the boundary.
 */
function textResponse(over: Partial<BackupTextResponse> = {}): BackupTextResponse {
  return {
    entry: entryOf(),
    document: TARGET,
    text: CANDIDATE,
    revision: CANDIDATE_REVISION,
    ...over
  };
} // End of function textResponse()

/**
 * The destination's projection.
 *
 * @param over - Whatever the case needs beyond the defaults.
 * @returns The projection.
 */
function target(over: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return makeDocument({ id: TARGET, relativePath: 'match/base.yml', revision: BASE, ...over });
} // End of function target()

/**
 * What the window observes, as one value.
 *
 * @param observed - The revision the live projection gives the destination.
 * @param surfaces - Every write surface the window has open.
 * @returns The context every gate takes.
 */
function at(
  observed: ContentRevision | null,
  surfaces: readonly OpenWriteSurface[] = []
): RestoreContext {
  return { observed, surfaces };
} // End of function at()

/**
 * The context of a window that still holds what the session is measured against.
 *
 * **Named for what it asserts.** The model's own note says a caller which hands
 * back `session.baseRevision` rather than reading the live projection gets
 * agreement it did not earn; this helper is that agreement, written once so the
 * cases that are about *disagreement* can be seen to pass a revision explicitly.
 *
 * @param session - The session to agree with.
 * @param surfaces - Every write surface the window has open.
 * @returns The context.
 */
function windowAgrees(
  session: RestoreSession,
  surfaces: readonly OpenWriteSurface[] = []
): RestoreContext {
  return at(session.baseRevision, surfaces);
} // End of function windowAgrees()

/**
 * A session with the catalogue walked and one candidate retained.
 *
 * The ordinary starting point: every case that is not about the catalogue itself
 * begins here, with a preview whose bytes are {@link CANDIDATE}.
 *
 * @returns The session.
 */
function withCandidate(): RestoreSession {
  const opened = batchesLoaded(loadingBatches(startRestore(target())), {
    ok: true,
    value: BATCHES
  });
  const listed = entriesLoaded(loadingEntries(chooseBatch(opened, BATCH)), {
    ok: true,
    value: entriesIn()
  });
  return candidateRead(chooseEntry(listed, entryOf().id), textResponse());
} // End of function withCandidate()

/**
 * A session with the question pending and nothing else open.
 *
 * @returns The session.
 */
function pending(): RestoreSession {
  return prepareRestore(withCandidate(), at(BASE));
} // End of function pending()

/**
 * Moves one field of a session **in place**, leaving the object itself alone.
 *
 * **The threat model, as a helper.** `readonly` freezes nothing at run time and a
 * session is an ordinary object literal, so a caller — or a component's own reactive
 * machinery — can redefine any property of the very session a question was asked on.
 *
 * **Replacing the object instead would prove nothing**, and that is what these cases
 * used to do. Since the 2c-5-4b confirmation round the authorization is keyed by the
 * session, so a spread is refused for being a copy: a case built that way passes with
 * every one of the five field rechecks deleted. Moving the field on the asked session
 * is what makes the recheck the only thing that can refuse it.
 *
 * @typeParam K - The field being moved.
 * @param session - The session to move it on.
 * @param key - Which field moves.
 * @param value - What it answers from now on.
 * @returns The same session, by reference.
 */
function moveOnTheSession<K extends keyof RestoreSession>(
  session: RestoreSession,
  key: K,
  value: RestoreSession[K]
): RestoreSession {
  Object.defineProperty(session, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
  return session;
} // End of function moveOnTheSession()

/**
 * One session with every own field replaced by a getter that answers the question.
 *
 * **The re-entrancy the confirmation review demonstrated, as one fixture.** Whichever
 * property a transition reads first, that read runs this getter, and this getter calls
 * {@link confirmRestore} on the very session being withdrawn from. A transition that
 * revoked *after* reading anything therefore mints a permit from inside the call that
 * exists to take the question back; one that revokes first cannot, because there is
 * nothing left under the session by the time any property is touched.
 *
 * It fires **once**, so the re-entrant confirmation's own reads do not recurse, and
 * the values it answers are captured before any getter exists — so every transition
 * behaves exactly as it would over a plain session.
 *
 * @param session - The session to trap. Modified in place.
 * @returns The same session, and the list the re-entrant confirmations land in.
 */
function trapped(session: RestoreSession): {
  readonly session: RestoreSession;
  readonly attempts: (StartedRestore | null)[];
} {
  const attempts: (StartedRestore | null)[] = [];
  const held: RestoreSession = { ...session };
  let entered = false;
  for (const key of Object.keys(held) as (keyof RestoreSession)[]) {
    Object.defineProperty(session, key, {
      get: () => {
        if (!entered) {
          entered = true;
          attempts.push(confirmRestore(session, at(BASE, [])));
        }
        return held[key];
      },
      configurable: true,
      enumerable: true
    });
  } // End of the loop over every own field of the session
  return { session, attempts };
} // End of function trapped()

/**
 * One retained candidate, built by walking a session to it.
 *
 * The only way to obtain a {@link RestorePreview} whose draft this suite did not
 * make by hand: `candidateRead` is its sole producer, so a case that needs a
 * *different* candidate to splice over a live one asks for it here.
 *
 * @param over - Whatever the case needs the read to answer.
 * @returns The preview that read produced.
 */
function previewOf(over: Partial<BackupTextResponse> = {}): RestorePreview {
  const listed = entriesLoaded(loadingEntries(chooseBatch(startRestore(target()), BATCH)), {
    ok: true,
    value: entriesIn()
  });
  const read = candidateRead(chooseEntry(listed, (over.entry ?? entryOf()).id), textResponse(over));
  if (read.preview === null) {
    throw new Error('this response was expected to be retained');
  }
  return read.preview;
} // End of function previewOf()

/** Every kind of surface that competes with a restore, in one list. */
const COMPETING: readonly CompetingWriteSurfaceKind[] = [
  'matchEditor',
  'matchCreator',
  'matchDeleter',
  'matchMover',
  'matchDuplicator',
  'rawEditor'
];

/**
 * Every surface kind, including restore's own.
 *
 * Written out with a `satisfies` for the reason every enumerated union in this
 * repository is: a union has no run-time extent, so a seventh member with no entry
 * here is a compile error in this file rather than a case nobody drives.
 */
const EVERY_SURFACE = Object.keys({
  matchEditor: true,
  matchCreator: true,
  matchDeleter: true,
  matchMover: true,
  matchDuplicator: true,
  rawEditor: true,
  restore: true
} satisfies Record<OpenWriteSurfaceKind, true>) as readonly OpenWriteSurfaceKind[];

/** A parse rejection, content-addressed to the candidate it is about. */
const REJECTION: Finding = {
  code: {
    DocumentDoesNotParse: {
      revision: CANDIDATE_REVISION,
      line: 3,
      column: 5,
      byte_index: 30,
      detail: 'mapping values are not allowed in this context'
    }
  },
  span: null,
  node: null,
  path: null
};

/**
 * A refusal carrying the findings given.
 *
 * @param findings - What the gate reported.
 * @param verdict - Which arm refused; the acknowledgeable one by default.
 * @returns The refusal as it crosses the boundary.
 */
function refusal(
  findings: readonly Finding[] = [REJECTION],
  verdict: RefusedResult['verdict'] = 'RefusedForUnacknowledgedSuspicions'
): SaveResult {
  return { outcome: 'refused', verdict, findings };
} // End of function refusal()

/**
 * A save that ran to the end.
 *
 * @param committed - Whether the file was really rewritten.
 * @param notes - The presentation changes it had to disclose.
 * @param revision - The revision the transaction ended on.
 * @returns The saved outcome as it crosses the boundary.
 */
function saved(
  committed = true,
  notes: readonly PresentationNote[] = [],
  revision: ContentRevision = AFTER
): SaveResult {
  return { outcome: 'saved', revision, committed, notes, backup_taken: true, moved: null };
} // End of function saved()

/** What some other writer left on disk, which a conflict carries. */
const DISK = 'matches:\n  - trigger: theirs\n    replace: theirs\n';

/**
 * A save the destination had moved on under.
 *
 * @param diskRevision - What the read after the refusal found.
 * @param expected - The revision the refused attempt was based on.
 * @returns The conflict as it crosses the boundary.
 */
function conflictResult(
  diskRevision: ContentRevision = ELSEWHERE,
  expected: ContentRevision = BASE
): SaveResult {
  return {
    outcome: 'conflict',
    reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
    expected,
    found: diskRevision,
    disk_revision: diskRevision,
    disk_text: DISK,
    disk: makeDocument({ id: TARGET, revision: diskRevision })
  };
} // End of function conflictResult()

/**
 * Seals one outcome the way `BrowserState.saveRawDocument` does.
 *
 * @param result - How the save ended.
 * @param issuer - What the issuer's own invalidation did.
 * @returns The sealed outcome.
 */
function sealed(
  result: SaveResult,
  issuer: RawSaveReload = { kind: 'done' }
): SealedWholeDocumentSave {
  return sealWholeDocumentSave(TARGET, result, issuer);
} // End of function sealed()

/**
 * A sender that records what it was handed and answers one sealed outcome.
 *
 * @param result - What the transaction answers.
 * @param issuer - What the issuer's own invalidation did.
 * @returns The spy, ready to be asserted against.
 */
function sender(result: SaveResult = saved(), issuer: RawSaveReload = { kind: 'done' }) {
  return vi.fn<SendRestore>(async () => ({ kind: 'sealed', sealed: sealed(result, issuer) }));
} // End of function sender()

/**
 * Whether the pane that discharges an invalidation would close one surface.
 *
 * **This models `invalidateEverySurface` in `src/lib/components/DetailPane.svelte`,
 * and the `matchCreator` arm is the whole reason it is a function.** That function's
 * comment at `:529-535` says it: the new-snippet form is closed **whatever file it
 * names**, including when it names none, because that pane cannot learn which
 * destination the form chose and a form left open over a replaced file holds a
 * position anchor that names nothing. The restore pane itself is **not** closed
 * (`:525-527`) — it is where the outcome of the write is drawn. Every other kind
 * closes on an exact match of the replaced file, which is the five identity
 * comparisons that function makes.
 *
 * **The recorder this replaces disagreed with production on the `unknown` arm**,
 * keeping a destination-less creator open on the ground that a form naming no file
 * is not over the replaced one. That ground is real and production overrules it
 * deliberately, in the conservative direction; a helper that asserted the opposite
 * was a trap set for 2d-5-2, the step that starts constructing such surfaces. The
 * decision taken here is that **the helper models production**, so a case written
 * against it is written against what a window does.
 *
 * **What nothing enforces, in the same sentence as what this does.** This is a
 * *model* of that function and no type, test or lint relates the two, so production
 * changing its rule leaves this silently stale. **Nor is production itself pinned**,
 * and the sentence this replaces said the opposite: it claimed the mounted
 * `DetailPane.test.ts` suite holds production to its own behaviour, and that suite
 * reaches `invalidateEverySurface` in no case at all — deleting `creating = false`
 * from it breaks nothing. So the rule is unpinned on **both** sides, and what this
 * helper buys is one honest model rather than half of an agreement. It also models
 * the rule and never the surrounding facts — production's `busy` makes a creator and
 * a restore mutually exclusive today, so the two arms this function is most careful
 * about cannot both arise in that window yet.
 *
 * @param surface - One surface this window has open.
 * @param replaced - The file whose whole text was just replaced.
 * @returns Whether that pane would close it.
 */
function closedByReplacementOf(surface: OpenWriteSurface, replaced: DocumentId): boolean {
  if (surface.kind === 'matchCreator') {
    return true;
  }
  if (surface.kind === 'restore') {
    return false;
  }
  return surface.target.document === replaced;
} // End of function closedByReplacementOf()

/**
 * What a coordinator does about every write surface over a replaced file.
 *
 * **A recorder rather than a stub**, because consult Q4's post-commit obligation is
 * that a committed replacement really closes the surfaces this window has open. The
 * list it holds is the window's; `close` is what {@link applyRestore} is handed, and
 * {@link closedByReplacementOf} is the production rule it applies.
 *
 * @param surfaces - The surfaces this window has open when the answer lands.
 * @returns The list, the callback, and what the callback was handed.
 */
function coordinator(surfaces: readonly OpenWriteSurface[] = []) {
  const open: OpenWriteSurface[] = [...surfaces];
  const closed: RawSaveInvalidation[] = [];
  return {
    open,
    closed,
    /**
     * Closes every surface the replacement takes with it, and records it.
     *
     * @param invalidation - The file that was replaced and what it holds now.
     */
    close(invalidation: RawSaveInvalidation): void {
      closed.push(invalidation);
      const kept = open.filter(
        (surface) => !closedByReplacementOf(surface, invalidation.document)
      );
      open.length = 0;
      open.push(...kept);
    } // End of function close()
  };
} // End of function coordinator()

/** A coordinator callback that does nothing, for the cases that are not about one. */
const NO_SURFACES: (invalidation: RawSaveInvalidation) => void = () => {};

/**
 * Confirms and sends the way a component does.
 *
 * The production sequence: confirm against the live projection, **install the
 * waiting session**, then send against that session and against what the window
 * observes now. `live` is what lets a case move one of those two between the
 * confirmation and the send, which is exactly the drift the permit exists to refuse.
 *
 * @param session - The session, with the question already pending.
 * @param context - What the window observes when the question is answered.
 * @param send - The sender to hand the confirmed restore to.
 * @param live - The session and context as they stand at the moment of the send,
 *   when a case needs them to differ from the confirmation's.
 * @returns What the confirmation produced and what became of the send.
 */
async function confirmAndSend(
  session: RestoreSession,
  context: RestoreContext,
  send: SendRestore,
  live: { session?: RestoreSession; context?: RestoreContext } = {}
): Promise<{ readonly started: StartedRestore | null; readonly sent: RestoreSend }> {
  const started = confirmRestore(session, context);
  const sent = await sendRestore(
    started,
    live.session ?? started?.session ?? session,
    live.context ?? context,
    send
  );
  return { started, sent };
} // End of function confirmAndSend()

/**
 * Runs one whole restore, from a prepared session to the answer applied.
 *
 * The component's own sequence: confirm against the live projection, send what the
 * confirmation authorized, apply what came back with the coordinator's invalidation.
 *
 * @param session - The session, with the question already pending.
 * @param result - What the transaction answers.
 * @param issuer - What the issuer's own invalidation did.
 * @returns The session after the answer, and the sender that was used.
 */
async function roundTrip(
  session: RestoreSession,
  result: SaveResult = saved(),
  issuer: RawSaveReload = { kind: 'done' }
): Promise<{ readonly session: RestoreSession; readonly send: ReturnType<typeof sender> }> {
  const send = sender(result, issuer);
  const { started, sent } = await confirmAndSend(session, at(session.baseRevision, []), send);
  if (started === null || sent.kind !== 'answered' || sent.answer.kind !== 'sealed') {
    throw new Error('this session was expected to confirm and send');
  }
  return { session: applyRestore(started.session, sent.answer.sealed, NO_SURFACES), send };
} // End of function roundTrip()

/**
 * A recorder for the workspace adoption a reload performs.
 *
 * A counter and not a spy, because what is pinned is a count: the adoption happens
 * exactly once on a reload that really happens, and never on one this module
 * refuses.
 *
 * @param answer - What the window answers.
 * @returns The callback to pass, and what it was handed.
 */
function adopting(answer: DiskAdoptionOutcome = 'installed'): {
  readonly adopt: AdoptTheDiskVersion<string>;
  readonly adoptions: ConflictModel<string>[];
} {
  const adoptions: ConflictModel<string>[] = [];
  return {
    adopt: (conflict) => {
      adoptions.push(conflict);
      return answer;
    },
    adoptions
  };
} // End of function adopting()

/**
 * The watcher's side, for the external session (Phase 2d-6-5): observations of
 * the destination and of another file, and the sealed envelopes the window would
 * deliver about them.
 *
 * Every envelope is sealed by the three constructors of `./observationDelivery.ts`,
 * so the verdict inside is about the observation inside by construction;
 * `workspace.test.ts` drives the same receiver through a real `BrowserState`.
 * A fresh observation every call, deliberately: the memo in `./conflictSource.ts`
 * and the session's wait are both keyed on object identity.
 */
const watched = {
  /**
   * One narrowed observation of the destination.
   *
   * @param overrides - Whatever the case needs beyond the defaults.
   * @returns The observation, as a window would have narrowed it.
   */
  observation(overrides: Partial<ExternalConflictObservation> = {}): ExternalConflictObservation {
    return {
      sequence: 5,
      document: TARGET,
      previousRevision: BASE,
      diskRevision: ELSEWHERE,
      diskText: DISK,
      disk: makeDocument({ id: TARGET, relativePath: 'match/base.yml', revision: ELSEWHERE }),
      findings: [],
      correspondences: null,
      ...overrides
    };
  }, // End of function observation()
  /**
   * An observation of another file, which a restore is never about.
   *
   * @returns The observation.
   */
  otherObservation(): ExternalConflictObservation {
    return watched.observation({
      document: TARGET + 1,
      previousRevision: null,
      diskRevision: AGAIN,
      disk: makeDocument({ id: TARGET + 1, relativePath: 'match/other.yml', revision: AGAIN })
    });
  }, // End of function otherObservation()
  /**
   * An arbitrated envelope, asserted to have reached the arm the case is about.
   *
   * @param standing - What stands for the file, or `null`.
   * @param seen - The observation.
   * @param uncertain - Whether the last settled write may have written.
   * @param arm - The verdict the case needs.
   * @returns The sealed envelope.
   */
  decided(
    standing: ConflictSource | null,
    seen: ExternalConflictObservation,
    uncertain: boolean,
    arm: ObservationVerdict['kind']
  ): ObservationDelivery {
    const delivery = arbitratedDelivery(
      standing === null ? null : standingConflictOf(standing),
      seen,
      uncertain
    );
    expect(delivery.verdict.kind).toBe(arm);
    return delivery;
  }, // End of function decided()
  /**
   * The `raised` envelope for one observation.
   *
   * @param seen - The observation.
   * @returns The envelope.
   */
  raised(seen: ExternalConflictObservation): ObservationDelivery {
    return watched.decided(null, seen, false, 'raised');
  } // End of function raised()
};

describe('the catalogue', () => {
  it('starts asked for nothing at all', () => {
    const session = startRestore(target());
    expect(session.batches).toEqual({ kind: 'idle' });
    expect(session.entries).toEqual({ kind: 'idle' });
    expect(session.batch).toBeNull();
    expect(session.entry).toBeNull();
    expect(session.preview).toBeNull();
    expect(session.baseRevision).toBe(BASE);
    expect(session.target).toBe(TARGET);
  }); // End of the "starts asked for nothing" case

  it('keeps a listing exactly as it arrived, counts included', () => {
    // *"There are no backups"* is a sentence `complete` licenses and an empty
    // `batches` does not, so nothing here derives one from the other.
    const short: BackupBatchListing = {
      ...BATCHES,
      batches: [],
      skipped: ['Unreadable'],
      unreadable: 1,
      complete: false
    };
    const session = batchesLoaded(loadingBatches(startRestore(target())), {
      ok: true,
      value: short
    });
    expect(session.batches).toEqual({ kind: 'loaded', listing: short });
  }); // End of the "keeps a listing exactly" case

  it('keeps a refused read apart from an empty one', () => {
    const session = batchesLoaded(loadingBatches(startRestore(target())), {
      ok: false,
      failure: FAILURE
    });
    expect(session.batches).toEqual({ kind: 'failed', failure: FAILURE });
  });

  it('ignores an entry listing about a batch this session did not choose', () => {
    // A listing is only about the batch it was asked for; installing one under
    // another batch's name would offer entries that do not belong to it.
    const chosen = chooseBatch(withCandidate(), BATCH);
    const stray = entriesLoaded(loadingEntries(chosen), {
      ok: true,
      value: entriesIn(OTHER_BATCH)
    });
    expect(stray.entries.kind).toBe('loading');
  }); // End of the "ignores a stray entry listing" case

  it('drops everything downstream of a batch that changed', () => {
    const moved = chooseBatch(pending(), OTHER_BATCH);
    expect(moved.entries).toEqual({ kind: 'idle' });
    expect(moved.entry).toBeNull();
    expect(moved.preview).toBeNull();
    expect(moved.pending).toBeNull();
  });
}); // End of the "catalogue" suite

describe('the candidate', () => {
  it('is retained byte for byte, carriage returns and byte-order mark included', () => {
    const session = withCandidate();
    expect(session.preview).not.toBeNull();
    expect(candidateText(session.preview!)).toBe(CANDIDATE);
    expect(session.preview!.revision).toBe(CANDIDATE_REVISION);
    // The revision beside the text is the *candidate's* hash and never the
    // destination's, which has one of its own.
    expect(session.preview!.revision).not.toBe(session.baseRevision);
    expect(session.preview!.draft.baseRevision).toBe(BASE);
  }); // End of the "retained byte for byte" case

  it('refuses a response about another document', () => {
    const listed = entriesLoaded(loadingEntries(chooseBatch(startRestore(target()), BATCH)), {
      ok: true,
      value: entriesIn()
    });
    const asked = chooseEntry(listed, entryOf().id);
    expect(candidateRead(asked, textResponse({ document: 99 })).preview).toBeNull();
  }); // End of the "another document" case

  it('refuses a response about another entry, and about another batch', () => {
    const listed = entriesLoaded(loadingEntries(chooseBatch(startRestore(target()), BATCH)), {
      ok: true,
      value: entriesIn()
    });
    const asked = chooseEntry(listed, entryOf().id);
    expect(
      candidateRead(asked, textResponse({ entry: entryOf('match/other.yml') })).preview
    ).toBeNull();
    expect(
      candidateRead(asked, textResponse({ entry: entryOf('match/base.yml', OTHER_BATCH) }))
        .preview
    ).toBeNull();
  }); // End of the "another entry" case

  it('goes when its read is refused, so nothing claims to have been shown', () => {
    const refused = candidateRefused(pending(), FAILURE);
    expect(refused.preview).toBeNull();
    expect(refused.pending).toBeNull();
    expect(refused.entries).toEqual({ kind: 'failed', failure: FAILURE });
  });

  it('is what the sender is handed, unchanged', async () => {
    const send = sender();
    await confirmAndSend(pending(), at(BASE, []), send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(TARGET, BASE, CANDIDATE, { accepted: [] });
  }); // End of the "handed unchanged" case
}); // End of the "candidate" suite

describe('the six write surfaces a restore refuses to run beside', () => {
  it('names every one of them, and never restore itself', () => {
    for (const kind of EVERY_SURFACE) {
      const surfaces: readonly OpenWriteSurface[] = [
        { kind, target: { kind: 'document', document: TARGET } }
      ];
      expect(competingSurfaceFor(TARGET, surfaces), kind).toBe(kind === 'restore' ? null : kind);
    } // End of the loop over every surface kind
  }); // End of the "names every one" case

  it('ignores a surface over another file', () => {
    expect(
      competingSurfaceFor(TARGET, [
        { kind: 'matchEditor', target: { kind: 'document', document: 99 } }
      ])
    ).toBeNull();
  });

  it('refuses to prepare, and to confirm, for each of the six', () => {
    for (const kind of COMPETING) {
      const surfaces: readonly OpenWriteSurface[] = [
        { kind, target: { kind: 'document', document: TARGET } }
      ];
      const session = withCandidate();
      expect(canPrepareRestore(session, at(BASE, surfaces)), kind).toBe(false);
      expect(restoreRefusal(session, at(BASE, surfaces)), kind).toEqual({
        kind: 'writeSurfaceOpen',
        surface: kind
      });
      expect(prepareRestore(session, at(BASE, surfaces)).pending, kind).toBeNull();
      // **And a surface that opened *after* the question was asked stops the
      // confirmation**, which is consult Q4's "the refusal is an affordance, not the
      // post-commit safety proof": the coordinator is rechecked immediately before a
      // submission is produced, not only when the question is put.
      expect(confirmRestore(pending(), at(BASE, surfaces)), kind).toBeNull();
    } // End of the loop over the six competing surface kinds
  }); // End of the "refuses to prepare and to confirm" case

  it('gives each of the six its own sentence, and none of the six claims unsaved edits', () => {
    // **The dirty-unknown wording predicate.** `competingSurfaceFor` answers *a
    // surface is open*, not *a surface is dirty*: `isDirty` is derived inside each
    // surface's own session, so no coordinator can observe it (R36). The sentences
    // are written to be true of a pristine surface, and this application has shipped
    // one claiming otherwise twice — so the check is that none of them uses the
    // words. It cannot check that they say the right thing instead; no suite in this
    // repository pins meaning.
    const keys = COMPETING.map(openWriteSurfaceKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const locale of LOCALES) {
      for (const key of keys) {
        const value = DICTIONARIES[locale][key].toLowerCase();
        expect(value, `${locale}:${key}`).not.toContain('unsaved changes');
        expect(value, `${locale}:${key}`).not.toContain('cambios sin guardar');
        expect(value, `${locale}:${key}`).not.toContain('sin guardar.');
      } // End of the loop over the six sentences
    } // End of the loop over the two locales
    // The check is only evidence if it can fire, and the sentence this application
    // shipped with the defect is what proves it can.
    expect(DICTIONARIES.en['browser.matchMove.refused.unsavedDraft'].toLowerCase()).toContain(
      'have not been saved'
    );
    expect(DICTIONARIES.es['browser.matchMove.refused.unsavedDraft'].toLowerCase()).toContain(
      'cambios sin guardar'
    );
  }); // End of the "own sentence" case

  it('says the two surfaces this app cannot read a dirty state from are only open', () => {
    // The match editor and the raw editor are the two whose sentence may add that
    // this application cannot tell whether the surface has been edited; the other
    // four hold no typed text at all. Both must claim an open surface and an
    // inability, never an edit.
    for (const locale of LOCALES) {
      for (const kind of ['matchEditor', 'rawEditor'] as const) {
        const value = DICTIONARIES[locale][openWriteSurfaceKey(kind)].toLowerCase();
        expect(value, `${locale}:${kind}`).toContain(locale === 'en' ? 'cannot tell' : 'no puede saber');
      } // End of the loop over the two editors
    } // End of the loop over the two locales
  }); // End of the "cannot read a dirty state" case
}); // End of the "six write surfaces" suite

/**
 * Every arm of a write surface's target, one key each.
 *
 * `EVERY_SURFACE`'s mechanism one union along: a union has no run-time extent, so a
 * third arm of `WriteSurfaceTarget` added later is a compile error **in this file**
 * rather than an arm neither predicate is ever driven over. It is the run-time half
 * of the `never` terminus both predicates carry — the terminus makes a new arm a
 * compile error in `restore.ts`, and this makes it one here, which is what stops a
 * new arm shipping with a switch that handles it and no case that drives it.
 */
const EVERY_TARGET = Object.keys({
  unknown: true,
  document: true
} satisfies Record<WriteSurfaceTarget['kind'], true>) as readonly WriteSurfaceTarget['kind'][];

/**
 * One target of the named arm, over the named file.
 *
 * @param kind - Which arm to build.
 * @param document - The file, ignored by the `unknown` arm which names none.
 * @returns The target.
 */
function targetOf(kind: WriteSurfaceTarget['kind'], document: DocumentId): WriteSurfaceTarget {
  return kind === 'unknown' ? { kind } : { kind, document };
} // End of function targetOf()

/** The new-snippet form, open and not yet naming a destination. */
const UNKNOWN_CREATOR: OpenWriteSurface = { kind: 'matchCreator', target: { kind: 'unknown' } };

describe('a creator that has not named a file', () => {
  it('competes with no restore at all, which is 2c-5 unchanged', () => {
    // The behaviour this phase's whole switch exists to preserve. A destination-less
    // form still produces no `OpenWriteSurface` value — 2d-5-2 is what starts
    // reporting one — but the type can now express it, and the `unknown` arm is what
    // keeps the answer the same on the day it does.
    expect(competingSurfaceFor(TARGET, [UNKNOWN_CREATOR])).toBeNull();
    expect(competingSurfaceFor(99, [UNKNOWN_CREATOR])).toBeNull();
  }); // End of the "competes with no restore" case

  it('lets a restore be prepared and confirmed, beside a named creator that does not', () => {
    const open = at(BASE, [UNKNOWN_CREATOR]);
    expect(canPrepareRestore(withCandidate(), open)).toBe(true);
    expect(restoreRefusal(withCandidate(), open)).toBeNull();
    expect(confirmRestore(pending(), open)).not.toBeNull();

    // And the same form, once it has reported the destination upward, refuses both.
    const named = at(BASE, [
      { kind: 'matchCreator', target: { kind: 'document', document: TARGET } }
    ]);
    expect(canPrepareRestore(withCandidate(), named)).toBe(false);
    expect(restoreRefusal(withCandidate(), named)).toEqual({
      kind: 'writeSurfaceOpen',
      surface: 'matchCreator'
    });
    expect(confirmRestore(pending(), named)).toBeNull();
  }); // End of the "lets a restore be prepared" case

  it('is answered by both predicates for every arm the union has', () => {
    // The exhaustive drive. `EVERY_TARGET` is what fails to compile when an arm is
    // added, and this is what fails to *pass* when an arm is added whose answers
    // nobody decided. It is driven through `matchCreator`, and only through it,
    // because that is the one kind whose target may be either arm: a `rawEditor`
    // with an `unknown` target is not representable, so a case asserting over one
    // would be asserting over a value the type forbids.
    for (const arm of EVERY_TARGET) {
      const surface: OpenWriteSurface = { kind: 'matchCreator', target: targetOf(arm, TARGET) };
      const named = arm === 'document';
      expect(competingSurfaceFor(TARGET, [surface]), arm).toBe(named ? 'matchCreator' : null);
      expect(targetingSurfaceFor(TARGET, [surface], 'creatorEligible'), arm).toBe('matchCreator');
      expect(targetingSurfaceFor(TARGET, [surface], 'notCreatorEligible'), arm).toBe(
        named ? 'matchCreator' : null
      );
    } // End of the loop over every target arm
  }); // End of the "answered by both predicates" case
}); // End of the "creator that has not named a file" suite

describe('the watcher-targeting predicate, which answers the unknown arm the other way', () => {
  it('treats an unknown target as every creator-eligible match document', () => {
    // Not "the destination it will choose", which nothing here knows: the set it may
    // be about. Two unrelated files both answer, because both are eligible.
    expect(targetingSurfaceFor(TARGET, [UNKNOWN_CREATOR], 'creatorEligible')).toBe('matchCreator');
    expect(targetingSurfaceFor(99, [UNKNOWN_CREATOR], 'creatorEligible')).toBe('matchCreator');
  }); // End of the "every creator-eligible document" case

  it('treats an unknown target as no document that is not creator-eligible', () => {
    expect(targetingSurfaceFor(TARGET, [UNKNOWN_CREATOR], 'notCreatorEligible')).toBeNull();
    expect(targetingSurfaceFor(99, [UNKNOWN_CREATOR], 'notCreatorEligible')).toBeNull();
  });

  it('counts a restore, which the competition predicate skips', () => {
    // The two predicates disagreeing on purpose, in one case. A restore over the
    // file is a surface a silent reload would pull the ground out from under; a
    // restore asking whether it may run is asking about *other* surfaces.
    const restoring: OpenWriteSurface = {
      kind: 'restore',
      target: { kind: 'document', document: TARGET }
    };
    expect(targetingSurfaceFor(TARGET, [restoring], 'notCreatorEligible')).toBe('restore');
    expect(competingSurfaceFor(TARGET, [restoring])).toBeNull();
  }); // End of the "counts a restore" case

  it('ignores a named surface over another file, whatever the eligibility says', () => {
    const elsewhere: readonly OpenWriteSurface[] = [
      { kind: 'matchEditor', target: { kind: 'document', document: 99 } }
    ];
    expect(targetingSurfaceFor(TARGET, elsewhere, 'creatorEligible')).toBeNull();
    expect(targetingSurfaceFor(TARGET, elsewhere, 'notCreatorEligible')).toBeNull();
  }); // End of the "ignores another file" case

  it('prefers a surface that names the file to an earlier creator that names none', () => {
    // **The pin for the ordering, and it fails on a return to first-match.** The
    // first list is the shadowing shape exactly: an eligible unknown creator sits
    // ahead of an exact match, and answering in array order would name the creator
    // when a specific surface is the better answer. The `kind` is what a 2d-5-4
    // sentence would put on screen, which is why the more specific one wins.
    const named: OpenWriteSurface = {
      kind: 'rawEditor',
      target: { kind: 'document', document: TARGET }
    };
    expect(targetingSurfaceFor(TARGET, [UNKNOWN_CREATOR, named], 'creatorEligible')).toBe(
      'rawEditor'
    );
    expect(targetingSurfaceFor(TARGET, [named, UNKNOWN_CREATOR], 'creatorEligible')).toBe(
      'rawEditor'
    );
    expect(targetingSurfaceFor(TARGET, [], 'creatorEligible')).toBeNull();
  }); // End of the "prefers a surface that names the file" case

  it('keeps array order among exact matches, and answers the same yes or no as before', () => {
    // **What the preference does not do**, driven rather than asserted in prose. It
    // does not make the answer canonical: two surfaces naming the file are still
    // separated by array order alone, and this function ranks no named kind above
    // another. And it moves no yes/no answer — the unknown creator still answers on
    // its own when nothing names the file, and still answers nothing for a file that
    // is not creator-eligible, whatever else the list holds.
    const editor: OpenWriteSurface = {
      kind: 'matchEditor',
      target: { kind: 'document', document: TARGET }
    };
    const raw: OpenWriteSurface = {
      kind: 'rawEditor',
      target: { kind: 'document', document: TARGET }
    };
    expect(targetingSurfaceFor(TARGET, [editor, raw], 'creatorEligible')).toBe('matchEditor');
    expect(targetingSurfaceFor(TARGET, [raw, editor], 'creatorEligible')).toBe('rawEditor');

    const elsewhere: OpenWriteSurface = {
      kind: 'matchEditor',
      target: { kind: 'document', document: 99 }
    };
    expect(targetingSurfaceFor(TARGET, [UNKNOWN_CREATOR, elsewhere], 'creatorEligible')).toBe(
      'matchCreator'
    );
    expect(
      targetingSurfaceFor(TARGET, [UNKNOWN_CREATOR, elsewhere], 'notCreatorEligible')
    ).toBeNull();
  }); // End of the "array order among exact matches" case
}); // End of the "watcher-targeting predicate" suite

describe('what a creator-eligible match document is', () => {
  it('is exactly what the new-snippet form would offer as a destination', () => {
    // Delegated rather than restated, so the two rules cannot drift. The five
    // conditions driven below are `destinationEligibility`'s, through this function.
    expect(creatorEligibilityOf(makeSummary(), makeDocument())).toBe('creatorEligible');
  });

  it('refuses a file espanso loads no snippets from', () => {
    const profile = { kind: 'ConfigProfile' } as const;
    expect(
      creatorEligibilityOf(
        makeSummary(profile),
        makeDocument({ ...profile, topLevelKeys: ['matches'] })
      )
    ).toBe('notCreatorEligible');
  }); // End of the "loads no snippets" case

  it('refuses a read-only file, an unread one, an unparsed one, and one with no snippet list', () => {
    expect(creatorEligibilityOf(makeSummary({ readOnly: true }), makeDocument())).toBe(
      'notCreatorEligible'
    );
    expect(creatorEligibilityOf(makeSummary(), null)).toBe('notCreatorEligible');
    expect(creatorEligibilityOf(makeSummary(), makeDocument({ parsed: false }))).toBe(
      'notCreatorEligible'
    );
    expect(creatorEligibilityOf(makeSummary(), makeDocument({ topLevelKeys: [] }))).toBe(
      'notCreatorEligible'
    );
  }); // End of the "refuses four ineligible files" case

  it('answers the value the watcher predicate takes, so nothing converts between them', () => {
    // The two halves fit without a boolean in between, which is the whole reason the
    // eligibility is a named value: what this function answers is what that
    // predicate's third argument is, and no call site has to decide how to spell it.
    const eligibility = creatorEligibilityOf(makeSummary(), makeDocument());
    expect(targetingSurfaceFor(TARGET, [UNKNOWN_CREATOR], eligibility)).toBe('matchCreator');
    expect(
      targetingSurfaceFor(TARGET, [UNKNOWN_CREATOR], creatorEligibilityOf(makeSummary(), null))
    ).toBeNull();
  }); // End of the "answers the value the predicate takes" case

  it('says nothing about whether a form is open, which is the predicate above', () => {
    // The two are independent facts and the coordinator needs both: eligibility is
    // about the file, the surface list is about the window. An eligible file with no
    // creator open is targeted by nothing.
    expect(creatorEligibilityOf(makeSummary(), makeDocument())).toBe('creatorEligible');
    expect(targetingSurfaceFor(TARGET, [], 'creatorEligible')).toBeNull();
  }); // End of the "says nothing about a form" case
}); // End of the "creator-eligible match document" suite

describe('the confirmation and the five values it binds', () => {
  it('is the only producer of an authorization to send', () => {
    // It is not itself the authorization: what a confirmation mints is a permit
    // `sendRestore` revalidates and spends, and the group below is what drives that.
    const session = withCandidate();
    // No pending request, so nothing is confirmed — whatever else is true.
    expect(confirmRestore(session, at(BASE, []))).toBeNull();
    expect(confirmRestore(prepareRestore(session, at(BASE)), at(BASE, []))).not.toBeNull();
  });

  it('is consumed, so consent is for one attempt', () => {
    const started = confirmRestore(pending(), at(BASE, []));
    expect(started).not.toBeNull();
    expect(started!.session.pending).toBeNull();
    expect(confirmRestore(started!.session, at(BASE, []))).toBeNull();
  });

  it('is refused when the live projection gives the destination another revision', () => {
    // **The `matchDeletion` lesson, one operation along.** Every other value the
    // confirmation carries was minted by this module and therefore agrees with the
    // session however stale both are; `observed` is the only one that comes from
    // outside it.
    expect(confirmRestore(pending(), at(ELSEWHERE, []))).toBeNull();
    expect(confirmRestore(pending(), at(null, []))).toBeNull();
    // **And it is refused through the same rule the control is withdrawn by**, so a
    // screen cannot offer an enabled control the confirmation would then refuse.
    // One code covers a window that re-read the file and one that holds no reading
    // of it at all, because the sentence a person needs is the same.
    expect(restoreRefusal(pending(), at(ELSEWHERE))).toEqual({ kind: 'targetMoved' });
    expect(restoreRefusal(pending(), at(null))).toEqual({ kind: 'targetMoved' });
    expect(canPrepareRestore(withCandidate(), at(ELSEWHERE))).toBe(false);
    expect(prepareRestore(withCandidate(), at(ELSEWHERE)).pending).toBeNull();
  }); // End of the "live projection" case

  it('reads that revision off the projections the window holds', () => {
    expect(revisionInProjection([target()], TARGET)).toBe(BASE);
    expect(revisionInProjection([target({ revision: ELSEWHERE })], TARGET)).toBe(ELSEWHERE);
    expect(revisionInProjection([], TARGET)).toBeNull();
    expect(revisionInProjection([target()], 99)).toBeNull();
  });

  it('is refused when the destination named on it is not this session’s', () => {
    // A confirmation carried to another document is one of the three drifts consult
    // Q8 names. It is moved **on the session the question was asked on**: a fresh
    // object would be refused for being a copy of an authorized session and would say
    // nothing at all about the recheck this case is named for.
    const moved = moveOnTheSession(pending(), 'target', 99);
    expect(confirmRestore(moved, at(BASE, []))).toBeNull();
  }); // End of the "another destination" case

  it('is refused when the base revision moved under it', () => {
    const moved = targetRevisionObserved(pending(), ELSEWHERE);
    expect(moved.pending).toBeNull();
    expect(moved.baseRevision).toBe(ELSEWHERE);
    // And moving it on the asked session is refused too, with the window moved along
    // with it so that only the permit's own base revision can be the reason.
    const carried = moveOnTheSession(pending(), 'baseRevision', ELSEWHERE);
    expect(confirmRestore(carried, at(ELSEWHERE, []))).toBeNull();
  }); // End of the "base revision moved" case

  it('is refused when the entry it names is not the retained one', () => {
    const other = candidateRead(
      chooseEntry(pending(), entryOf('match/other.yml').id),
      textResponse({ entry: entryOf('match/other.yml'), text: OTHER_CANDIDATE })
    );
    expect(other.pending).toBeNull();
    const carried = moveOnTheSession(pending(), 'preview', other.preview);
    expect(confirmRestore(carried, at(BASE, []))).toBeNull();
  }); // End of the "another entry" case

  it('is refused when the candidate hash moved under it', () => {
    const restarted = pending();
    const rehashed = moveOnTheSession(restarted, 'preview', {
      ...restarted.preview!,
      revision: OTHER_CANDIDATE_REVISION
    });
    expect(confirmRestore(rehashed, at(BASE, []))).toBeNull();
  }); // End of the "candidate hash" case

  it('is refused when the preview generation moved under it', () => {
    // The one value that separates *this* preview from a later one whose other four
    // are reproducible: choosing the same entry of the same batch again produces the
    // same document, base revision, entry identity and candidate hash.
    const again = candidateRead(pending(), textResponse());
    expect(again.previewGeneration).toBeGreaterThan(pending().previewGeneration);
    const carried = moveOnTheSession(pending(), 'previewGeneration', again.previewGeneration);
    expect(confirmRestore(carried, at(BASE, []))).toBeNull();
  }); // End of the "preview generation" case

  it('is refused when the draft and the session disagree about the base revision', () => {
    // **The 2c-5-4b confirmation review's first High, at the moment it mattered.**
    // `RestorePermit.baseRevision` came from `session.baseRevision` and
    // `RestorePermit.submission.baseRevision` from `submissionOf(preview.draft)` — two
    // separate caller-controlled reads that nothing required to agree, with
    // `permitHolds` rechecking only the first and `sendRestore` sending only the
    // second. So a locked write could succeed on a base revision the confirmation
    // never bound. The disagreement is made **during** `prepareRestore` rather than
    // after it, which is the only moment at which it was ever observable.
    const base = withCandidate();
    const drifted = moveOnTheSession(base, 'preview', {
      ...base.preview!,
      draft: { ...base.preview!.draft, baseRevision: ELSEWHERE }
    });

    const asked = prepareRestore(drifted, at(BASE));

    // No question at all: a snapshot describing two transactions is not a snapshot.
    expect(asked.pending).toBeNull();
    expect(asked).toBe(drifted);
    expect(confirmRestore(asked, at(BASE, []))).toBeNull();
    // And the control: the same walk with the two agreeing does ask.
    expect(prepareRestore(withCandidate(), at(BASE)).pending).not.toBeNull();
  }); // End of the "draft and session disagree" case

  it('is withdrawn by every change to what it binds', () => {
    for (const [name, next] of [
      ['a catalogue refresh', loadingBatches(pending())],
      ['a batch', chooseBatch(pending(), OTHER_BATCH)],
      ['an entry listing refresh', loadingEntries(pending())],
      ['an entry', chooseEntry(pending(), entryOf('match/other.yml').id)],
      ['a candidate', candidateRead(pending(), textResponse())],
      ['a refused candidate read', candidateRefused(pending(), FAILURE)],
      ['the observed target revision', targetRevisionObserved(pending(), ELSEWHERE)],
      ['a cancellation', cancelRestore(pending())]
    ] as const) {
      expect(next.pending, name).toBeNull();
    } // End of the loop over every withdrawal
  }); // End of the "withdrawn by every change" case

  it('is not offered while the file may not be written, or while one is in flight', () => {
    expect(canPrepareRestore(withCandidate(), at(BASE))).toBe(true);
    expect(restoreRefusal(startRestore(target()), at(BASE))).toEqual({ kind: 'noCandidate' });
    expect(restoreRefusal(startRestore(target({ readOnly: true })), at(BASE))).toEqual({
      kind: 'readOnly'
    });
    const inFlight = confirmRestore(pending(), at(BASE, []))!.session;
    expect(restoreRefusal(inFlight, at(BASE))).toEqual({ kind: 'inFlight' });
  }); // End of the "not offered" case
}); // End of the "confirmation and the five values it binds" suite

describe('the permit a confirmation mints', () => {
  /**
   * The conflict outcome a session shows, built without a round trip.
   *
   * @returns The outcome, for splicing onto a session that must not send.
   */
  function conflictOnScreen(): SaveOutcomeModel<string> {
    const started = confirmRestore(pending(), at(BASE, []))!;
    const answered = applyRestore(started.session, sealed(conflictResult()), NO_SURFACES);
    if (answered.outcome === null) {
      throw new Error('a conflict was expected on this session');
    }
    return answered.outcome;
  } // End of function conflictOnScreen()

  /**
   * Every way the world can stop matching a permit between confirming and sending.
   *
   * **Each row moves exactly one thing**, so deleting the recheck it is about is the
   * only edit that makes it pass. The candidate-bytes row is the sharpest: it leaves
   * the entry identity and the hash alone and changes only the text, which is the
   * one drift a hash comparison would not see.
   *
   * @returns One case per recheck the send makes.
   */
  function drifts(): readonly {
    readonly name: string;
    readonly live: (started: StartedRestore) => {
      readonly session?: RestoreSession;
      readonly context?: RestoreContext;
    };
  }[] {
    return [
      {
        name: 'the destination',
        live: (started) => ({ session: { ...started.session, target: 99 } })
      },
      {
        name: 'the base revision',
        live: (started) => ({
          // The window is moved with it, so the observed-revision recheck agrees and
          // only the permit's own base revision can refuse this.
          session: { ...started.session, baseRevision: ELSEWHERE },
          context: at(ELSEWHERE, [])
        })
      },
      {
        name: 'the entry the candidate was read from',
        live: (started) => ({
          session: {
            ...started.session,
            preview: { ...started.session.preview!, entry: entryOf('match/other.yml') }
          }
        })
      },
      {
        name: 'the candidate hash',
        live: (started) => ({
          session: {
            ...started.session,
            preview: { ...started.session.preview!, revision: OTHER_CANDIDATE_REVISION }
          }
        })
      },
      {
        name: 'the candidate bytes, with the hash and the entry left alone',
        live: (started) => ({
          session: {
            ...started.session,
            preview: { ...started.session.preview!, draft: previewOf({ text: OTHER_CANDIDATE }).draft }
          }
        })
      },
      {
        name: 'the preview generation',
        live: (started) => ({
          session: { ...started.session, previewGeneration: started.session.previewGeneration + 1 }
        })
      },
      {
        name: 'the candidate, which has gone entirely',
        live: (started) => ({ session: { ...started.session, preview: null } })
      },
      {
        name: 'the revision the window projects for the destination',
        live: () => ({ context: at(ELSEWHERE, []) })
      },
      {
        name: 'the projection, which the window no longer holds at all',
        live: () => ({ context: at(null, []) })
      },
      {
        name: 'the read-only verdict',
        live: (started) => ({ session: { ...started.session, readOnly: true } })
      },
      {
        name: 'the session, which has committed a replacement since',
        live: (started) => ({ session: { ...started.session, restored: true } })
      },
      {
        name: 'the phase, which is no longer in flight',
        live: (started) => ({ session: { ...started.session, phase: 'editing' } })
      },
      {
        name: 'the outcome, which is now a conflict',
        live: (started) => ({ session: { ...started.session, outcome: conflictOnScreen() } })
      },
      ...COMPETING.map((kind) => ({
        name: `the open surfaces, which now hold a ${kind} over the destination`,
        live: () => ({
          context: at(BASE, [
            { kind, target: { kind: 'document', document: TARGET } }
          ] as readonly OpenWriteSurface[])
        })
      }))
    ];
  } // End of function drifts()

  it.each(drifts().map((one) => [one.name, one] as const))(
    'sends nothing when %s moved before the send',
    async (_name, one) => {
      const send = sender();
      const started = confirmRestore(pending(), at(BASE, []));
      expect(started).not.toBeNull();
      const live = one.live(started!);
      const sent = await sendRestore(
        started,
        live.session ?? started!.session,
        live.context ?? at(BASE, []),
        send
      );
      // `withdrawn` rather than `notAttempted`: a permit was there, it no longer
      // described the world, and it has been consumed. The distinction is what tells
      // a caller that the session it was minted with has to be moved out of the
      // phase the confirmation put it in — nothing else can, because every editing
      // transition is a no-op while it is `saving`.
      expect(sent).toEqual({ kind: 'withdrawn' });
      expect(send).not.toHaveBeenCalled();
    }
  );

  it('is spent by a mismatch, so repairing what moved does not revive it', async () => {
    // **Consent is for one attempt**, and a mismatch is an answer rather than a
    // pause: the permit goes with it, so a caller that repairs whatever moved and
    // hands the same confirmation over again sends nothing and is told it held no
    // permit at all. What the person does instead is ask again, which is
    // `prepareRestore` and `confirmRestore` over the repaired session.
    const send = sender();
    const started = confirmRestore(pending(), at(BASE, []))!;
    const moved = await sendRestore(started, started.session, at(ELSEWHERE, []), send);
    expect(moved).toEqual({ kind: 'withdrawn' });

    const repaired = await sendRestore(started, started.session, at(BASE, []), send);

    expect(repaired).toEqual({ kind: 'notAttempted' });
    expect(send).not.toHaveBeenCalled();
  }); // End of the "spent by a mismatch" case

  it('takes a consumed confirmation out of the phase it put the session in', async () => {
    // **The 2c-5-4a review's Medium, as the transition that answers it.** The
    // session a confirmation mints is frozen: `frozen()` makes every catalogue,
    // selection, candidate and base-revision transition answer its argument
    // unchanged while the phase is `saving`. So a send that reached no command has
    // to be able to give that session back to the person, and this is what does it.
    const started = confirmRestore(pending(), at(BASE, []))!;
    expect(started.session.phase).toBe('saving');
    expect(started.session.inFlight).not.toBeNull();

    const withdrawn = restoreConfirmationWithdrawn(started.session);

    expect(withdrawn.phase).toBe('editing');
    expect(withdrawn.inFlight).toBeNull();
    expect(withdrawn.pending).toBeNull();
    // Nothing was written and nothing about the entry was learnt, so the candidate,
    // its consent and the catalogue are all still here.
    expect(candidateText(withdrawn.preview!)).toBe(CANDIDATE);
    expect(withdrawn.preview!.draft).toBe(started.session.preview!.draft);
    expect(withdrawn.batches).toEqual(started.session.batches);
    expect(withdrawn.entry).toEqual(started.session.entry);
    // No send failure: no command ran, so there is nothing to be uncertain about.
    expect(withdrawn.sendFailure).toBeNull();
    expect(withdrawn.restored).toBe(false);
    // And it is askable again — which the frozen session was not, by construction.
    expect(restoreRefusal(started.session, at(BASE, []))).toEqual({ kind: 'inFlight' });
    expect(restoreRefusal(withdrawn, at(BASE, []))).toBeNull();
    expect(prepareRestore(withdrawn, at(BASE, [])).pending).not.toBeNull();
  }); // End of the "consumed confirmation" case

  it('is spent by the send, so one permit writes at most once', async () => {
    // **The reuse H1 named.** The confirmed value is an ordinary object a caller can
    // hold; what stops it being handed over twice is that the permit it keys is gone
    // after the first send. This case pins that half only — the half that stops one
    // *question* minting a second permit is the group below.
    const send = sender();
    const started = confirmRestore(pending(), at(BASE, []))!;
    const first = await sendRestore(started, started.session, at(BASE, []), send);
    expect(first.kind).toBe('answered');
    const again = await sendRestore(started, started.session, at(BASE, []), send);
    expect(again).toEqual({ kind: 'notAttempted' });
    expect(send).toHaveBeenCalledTimes(1);
  }); // End of the "spent by the send" case

  it('is spent before the sender runs, so a send inside the send finds nothing', async () => {
    // The spend is synchronous and precedes the call, so a sender that re-enters —
    // a component reacting to its own in-flight state — cannot spend it either.
    const holder: { started: StartedRestore | null } = { started: null };
    const reentrant: RestoreSend[] = [];
    const send = vi.fn<SendRestore>(async () => {
      reentrant.push(
        await sendRestore(holder.started, holder.started!.session, at(BASE, []), send)
      );
      return { kind: 'sealed', sealed: sealed(saved()) };
    });
    holder.started = confirmRestore(pending(), at(BASE, []));
    expect(holder.started).not.toBeNull();
    await sendRestore(holder.started, holder.started!.session, at(BASE, []), send);
    expect(reentrant).toEqual([{ kind: 'notAttempted' }]);
    expect(send).toHaveBeenCalledTimes(1);
  }); // End of the "spent before the sender runs" case

  it('sends the bytes it retained, never the ones the live session is showing', async () => {
    // The permit carries the candidate, so what reaches the wire cannot be
    // substituted by the session a caller hands back — the last step of Q8's
    // binding. This session agrees with the permit about everything the send
    // rechecks; the assertion is that the four arguments come off the permit.
    const send = sender();
    const started = confirmRestore(pending(), at(BASE, []))!;
    await sendRestore(started, started.session, at(BASE, []), send);
    expect(send).toHaveBeenCalledWith(TARGET, BASE, CANDIDATE, { accepted: [] });
  }); // End of the "sends the bytes it retained" case

  it('is one per question, so confirming the same session again is refused', async () => {
    // **The counterexample, inverted.** This case used to assert *two* sends, and it
    // was H1 surviving its own fix round: `confirmRestore` consumed the pending
    // request only in the session it *returns*, so a caller that discarded that
    // session — or kept a second reference to the one it passed in — confirmed the
    // same answered question again, minted a second permit, and both held. Every
    // field a confirmation compares is a number or a string, so nothing among them
    // could ever have noticed. What is spent now is the question's own runtime
    // membership, which no value can carry. This case drives the **sequential**
    // route — one call, then another; the two re-entrant routes are the cases below,
    // and neither is reachable from here.
    const send = sender();
    const session = pending();
    const first = confirmRestore(session, at(BASE, []));
    const second = confirmRestore(session, at(BASE, []));
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    await sendRestore(first, first!.session, at(BASE, []), send);
    await sendRestore(second, session, at(BASE, []), send);
    expect(send).toHaveBeenCalledTimes(1);
  }); // End of the "one permit per question" case

  it('refuses any copy of the asked session, however faithful the copy is', () => {
    // A copy satisfies every field check by construction — numbers and strings, one
    // of them nested — so membership is the only thing that can tell the session this
    // module asked from a reproduction of it. A spread copies own properties and
    // `structuredClone` copies fields; a `WeakMap` entry is neither.
    const session = pending();
    expect(confirmRestore({ ...session }, at(BASE, []))).toBeNull();
    expect(
      confirmRestore({ ...session, pending: structuredClone(session.pending!) }, at(BASE, []))
    ).toBeNull();
    // The refusals spent nothing: the session the copies were made from still
    // answers, which is what makes this a case about the copies alone.
    expect(confirmRestore(session, at(BASE, []))).not.toBeNull();
  }); // End of the "copy of the asked session" case

  it('does not spend the question when it refuses, so a repaired session confirms it', () => {
    // **The deletion is after every check for this reason.** A confirmation refused
    // because the window moved, or because the session no longer matches what was
    // asked, must leave the person able to answer the same question once the reason
    // is gone — not silently unable to. Both refusal shapes are here: the one
    // `restoreRefusal` owns, and one of the five the permit carries.
    const window = pending();
    const bound = pending();
    const generation = bound.previewGeneration;
    expect(confirmRestore(window, at(ELSEWHERE, []))).toBeNull();
    expect(
      confirmRestore(moveOnTheSession(bound, 'previewGeneration', generation + 1), at(BASE, []))
    ).toBeNull();
    // Put each reason back, and each session answers the question it still holds.
    expect(confirmRestore(window, at(BASE, []))).not.toBeNull();
    expect(
      confirmRestore(moveOnTheSession(bound, 'previewGeneration', generation), at(BASE, []))
    ).not.toBeNull();
  }); // End of the "refusal spends nothing" case

  it('reads nothing off the retained draft once the question is spent', async () => {
    // **The 2c-5-4b review's H1, as the structural property that closes it.** The
    // submission used to be derived from `preview.draft` *after* the checked
    // deletion, which is a caller-controlled read on the far side of a spend: a
    // getter there could answer one value while the question was being validated and
    // another once it had been answered, and it could re-enter this module
    // synchronously between the two. The permit is now built by `prepareRestore` and
    // handed over whole, so none of these getters runs inside `confirmRestore` at
    // all — which is a stronger claim than "the ordering is right" and the only one
    // that cannot be re-broken by a read added below the deletion. Each getter also
    // re-enters, so a read that came back would be a second permit as well as a
    // count.
    const send = sender();
    const session = pending();
    const draft = session.preview!.draft;
    // The four values `submissionOf` reads, captured before any getter exists — and
    // the getters are installed on the **asked session's own draft**, in place, rather
    // than on a copy of it: since the confirmation round a copy is not a key, so a
    // case built by spreading would answer `null` for a reason that has nothing to do
    // with what it is named for.
    const held = {
      value: draft.value,
      baseRevision: draft.baseRevision,
      consent: draft.consent,
      generation: draft.generation
    };
    const reads = { value: 0, baseRevision: 0, consent: 0, generation: 0 };
    const reentrant: (StartedRestore | null)[] = [];
    let entered = false;
    for (const field of Object.keys(reads) as (keyof typeof reads)[]) {
      Object.defineProperty(draft, field, {
        get: () => {
          reads[field] += 1;
          if (!entered) {
            entered = true;
            reentrant.push(confirmRestore(session, at(BASE, [])));
          }
          return held[field];
        },
        configurable: true,
        enumerable: true
      });
    } // End of the loop over the four fields a submission is derived from

    const started = confirmRestore(session, at(BASE, []));

    expect(started).not.toBeNull();
    // Not one read, so not one opening. Every one of these was a read the old
    // `submissionOf(preview.draft)` made after the question had been spent.
    expect(reads).toEqual({ value: 0, baseRevision: 0, consent: 0, generation: 0 });
    expect(reentrant).toEqual([]);
    // And the permit is real: the bytes and the base revision the question was asked
    // about are what the sender is handed.
    await sendRestore(started, started!.session, at(BASE, []), send);
    expect(send).toHaveBeenCalledWith(TARGET, BASE, CANDIDATE, { accepted: [] });
    // The send does read the live candidate — that is `permitHolds`'s byte
    // comparison — and the re-entrant confirmation it triggers finds the question
    // already answered.
    expect(reentrant.every((one) => one === null)).toBe(true);
  }); // End of the "reads nothing after the spend" case

  it('sends the base revision bound when the question was asked, never one read later', async () => {
    // **The sharper half of that High.** `permitHolds` compares `permit.baseRevision`
    // with the session's and never compares `permit.submission.baseRevision` with
    // either — and `sendRestore` sends the submission's. So a draft whose
    // `baseRevision` answers one thing while the question is asked and another
    // afterwards used to put the second value on the wire with nothing downstream in
    // a position to notice. The permit freezes the whole submission when the question
    // is asked, so the second value reaches nothing.
    const send = sender();
    const base = withCandidate();
    const original = base.preview!.draft;
    let drifting = false;
    const session: RestoreSession = {
      ...base,
      preview: {
        ...base.preview!,
        draft: {
          ...original,
          get baseRevision(): ContentRevision {
            return drifting ? ELSEWHERE : original.baseRevision;
          }
        }
      }
    };
    const asked = prepareRestore(session, at(BASE));
    expect(asked.pending).not.toBeNull();
    // From here the draft answers a different base revision to every reader.
    drifting = true;

    const started = confirmRestore(asked, at(BASE, []));
    await sendRestore(started, started!.session, at(BASE, []), send);

    expect(send).toHaveBeenCalledWith(TARGET, BASE, CANDIDATE, { accepted: [] });
  }); // End of the "base revision bound when asked" case

  it('sends the bytes bound when the question was asked, never ones read later', async () => {
    // The candidate half of the same shape, and it ends in a refusal rather than in
    // different bytes: the permit carries what was shown, `permitHolds` compares
    // those bytes against what the live preview now answers, and they no longer
    // agree. Before the fix both sides of that comparison were the *drifted* value —
    // the permit's because it was derived after the spend — so it passed and the
    // drifted bytes were written.
    const send = sender();
    const base = withCandidate();
    const original = base.preview!.draft;
    let drifting = false;
    const session: RestoreSession = {
      ...base,
      preview: {
        ...base.preview!,
        draft: {
          ...original,
          get value(): string {
            return drifting ? OTHER_CANDIDATE : original.value;
          }
        }
      }
    };
    const asked = prepareRestore(session, at(BASE));
    drifting = true;

    const started = confirmRestore(asked, at(BASE, []));
    const sent = await sendRestore(started, started!.session, at(BASE, []), send);

    expect(sent).toEqual({ kind: 'withdrawn' });
    expect(send).not.toHaveBeenCalled();
  }); // End of the "bytes bound when asked" case

  it('spends the question in one operation, so a getter that re-enters before it mints nothing', async () => {
    // **The counterexample the confirmation review's third pass named.** Asking
    // `PENDING_AUTHORIZATIONS.has` and deleting several lines later is two
    // operations, and the property reads between them are caller-controlled:
    // `readonly` on a session freezes nothing at runtime, and every one of the five
    // recheck comparisons reads the live session. So a getter installed there fires
    // inside the outer call *before* the spend, re-enters, answers the question,
    // mints a permit — and the outer call then ignored its own failed deletion and
    // minted a second. Two live permits, each passing `sendRestore`'s recheck, is the
    // sender running twice for one answered question. The checked deletion closes it:
    // `WeakMap.delete` decides and spends in one step that runs no user code.
    //
    // **The hook is `previewGeneration` rather than the question's own `document`**,
    // which is where it was until 2c-5-4b: the recheck now compares the frozen
    // authorization's copies, so nothing reads a `PendingRestore`'s fields at all.
    // This is the last read `confirmRestore` makes before the spend. It is installed
    // **on the asked session**, because since the confirmation round a spread of one
    // is not a key and a case built that way would refuse for the wrong reason.
    const send = sender();
    const session = pending();
    const generation = session.previewGeneration;
    const reentrant: (StartedRestore | null)[] = [];
    let entered = false;
    Object.defineProperty(session, 'previewGeneration', {
      get: () => {
        if (!entered) {
          entered = true;
          reentrant.push(confirmRestore(session, at(BASE, [])));
        }
        return generation;
      },
      configurable: true,
      enumerable: true
    });
    const outer = confirmRestore(session, at(BASE, []));
    // The getter ran, so this really is the pre-spend opening and not a case that
    // never re-entered at all.
    expect(entered).toBe(true);
    expect(reentrant).toHaveLength(1);
    const minted = [outer, ...reentrant].filter((one) => one !== null);
    expect(minted).toHaveLength(1);
    for (const one of [outer, ...reentrant]) {
      await sendRestore(one, one?.session ?? session, at(BASE, []), send);
    }
    expect(send).toHaveBeenCalledTimes(1);
  }); // End of the "spent in one operation" case
}); // End of the "permit" suite

describe('a withdrawn question authorizes nothing, whoever still holds it', () => {
  /**
   * Every transition consult Q5 calls a withdrawal, with a session it can take back.
   *
   * **The point of the group** is the 2c-5-4b review's second High: until it, each of
   * these only wrote `pending: null` into the session it *returned*, so a caller
   * holding the one it was given could still confirm — and
   * `BrowserState.restoreDocument` deliberately takes its session from `started`
   * rather than from live pane state, so that confirmation could have written
   * candidate A while the pane showed B or showed no question at all.
   *
   * @returns One entry per withdrawing transition.
   */
  function withdrawals(): readonly {
    readonly name: string;
    readonly asked: () => Promise<RestoreSession>;
    readonly withdraw: (session: RestoreSession) => RestoreSession;
  }[] {
    /**
     * The ordinary starting point: a candidate retained and the question asked.
     *
     * @returns The session with a live question.
     */
    const asked = async (): Promise<RestoreSession> => pending();
    return [
      { name: 'a cancellation', asked, withdraw: (session) => cancelRestore(session) },
      { name: 'a batch catalogue refresh', asked, withdraw: (session) => loadingBatches(session) },
      { name: 'a batch being chosen', asked, withdraw: (session) => chooseBatch(session, OTHER_BATCH) },
      { name: 'an entry catalogue refresh', asked, withdraw: (session) => loadingEntries(session) },
      {
        name: 'an entry being chosen',
        asked,
        withdraw: (session) => chooseEntry(session, entryOf('match/other.yml').id)
      },
      {
        name: 'a candidate arriving',
        asked,
        withdraw: (session) => candidateRead(session, textResponse())
      },
      {
        name: 'a candidate read being refused',
        asked,
        withdraw: (session) => candidateRefused(session, FAILURE)
      },
      {
        name: 'this window re-reading the destination',
        asked,
        withdraw: (session) => targetRevisionObserved(session, ELSEWHERE)
      },
      {
        name: 'an answer landing',
        asked,
        withdraw: (session) => applyRestore(session, sealed(saved()), NO_SURFACES)
      },
      {
        name: 'a consumed confirmation being taken back',
        asked,
        withdraw: (session) => restoreConfirmationWithdrawn(session)
      },
      {
        name: 'the findings being acknowledged',
        asked: async (): Promise<RestoreSession> => {
          const { session } = await roundTrip(pending(), refusal());
          return prepareRestore(session, at(BASE));
        },
        withdraw: (session) => acknowledgeRestoreFindings(session)
      },
      {
        // **The transition the confirmation review found omitted.** It clears
        // `pending` through `measuredAgainst` on its successful path, five
        // caller-controlled operations and one arbitrary callback later, and its two
        // other arms did not clear it at all. It revokes first now, on every arm,
        // which is what this row drives: no conflict is showing, so the reload is not
        // attempted and the revocation is the only thing that happened.
        name: 'a reload of the disk version being spent',
        asked,
        withdraw: (session) => reloadTheDiskVersion(session, adopting().adopt)
      }
    ];
  } // End of function withdrawals()

  it.each(withdrawals().map((one) => [one.name, one] as const))(
    'cannot be minted from a session retained across %s',
    async (_name, one) => {
      const send = sender();
      const asked = await one.asked();
      expect(asked.pending).not.toBeNull();
      // The live pane moves on, and this case **throws the answer away** — which is
      // exactly what a retained pre-transition reference is.
      one.withdraw(asked);

      const started = confirmRestore(asked, at(BASE, []));

      expect(started).toBeNull();
      expect(await sendRestore(started, asked, at(BASE, []), send)).toEqual({
        kind: 'notAttempted'
      });
      expect(send).not.toHaveBeenCalled();
      // **The control**: asking again over the same retained session mints a fresh
      // question, and that one confirms. So what is refused above is the withdrawal
      // and not the shape of the case.
      const again = prepareRestore(cancelRestore(asked), at(BASE));
      expect(confirmRestore(again, at(BASE, []))).not.toBeNull();
    }
  );

  it.each(withdrawals().map((one) => [one.name, one] as const))(
    'cannot be minted from inside %s, by a getter the transition itself runs',
    async (_name, one) => {
      // **The 2c-5-4b confirmation review's second High, which the sequential cases
      // above could not see.** Deleting the authorization is only a revocation if it
      // happens before any caller code runs, and until this round it did not: the
      // helper's own first operation was `session.pending`, most callers read the
      // phase, the entry, the batch or the base revision first, the acknowledgement
      // did its whole state and consent calculation first, and the reload ran an
      // arbitrary callback first. A getter in any of those positions could answer the
      // question from inside the very call that exists to take it back — moving the
      // authorization into a permit the outer deletion can no longer reach.
      //
      // Every own field of the session is a getter here, so whichever one a
      // transition reads first is the opening, and the case cannot go stale by being
      // written against the wording of the last finding.
      const send = sender();
      const { session, attempts } = trapped(await one.asked());

      one.withdraw(session);

      // It really fired — otherwise this case proves nothing at all — and it minted
      // nothing, because the revocation had already happened.
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toBeNull();
      expect(await sendRestore(attempts[0]!, session, at(BASE, []), send)).toEqual({
        kind: 'notAttempted'
      });
      expect(send).not.toHaveBeenCalled();
    }
  );

  it('revokes before the adoption callback runs, so a reload cannot confirm from inside one', async () => {
    // **The callback half of the same High**, and the one no getter can stand in for:
    // `reloadTheDiskVersion` hands `adopt` to `spendTheConfirmedReload`, and `adopt`
    // is an arbitrary function a caller supplied. Until this round the question was
    // still authorized while it ran.
    //
    // The callback does what a component's own reactive machinery could: it takes the
    // conflict off the session — the only thing refusing a confirmation while one is
    // showing — and then answers the question. Against a build that revokes after the
    // callback, that confirmation succeeds and writes the file.
    const { session: refused } = await roundTrip(pending(), conflictResult());
    const outcome = refused.outcome;
    const session = moveOnTheSession(pending(), 'outcome', outcome);
    const confirmed = confirmDiskReload(askToReloadDiskVersion(session));
    // The question really did survive the two reload steps, so what refuses below is
    // the revocation rather than a question that was never carried this far.
    expect(confirmed.pending).not.toBeNull();
    const inside: (StartedRestore | null)[] = [];

    const reloaded = reloadTheDiskVersion(confirmed, () => {
      moveOnTheSession(confirmed, 'outcome', null);
      inside.push(confirmRestore(confirmed, at(BASE, [])));
      return 'installed';
    });

    expect(inside).toEqual([null]);
    expect(reloaded.pending).toBeNull();
    expect(confirmRestore(confirmed, at(BASE, []))).toBeNull();
  }); // End of the "revokes before the adoption callback" case

  it('is refused by the same rule whether the question was answered or withdrawn', async () => {
    // Two spends of one membership, and they are the same membership: a question
    // taken back and a question already confirmed both leave `confirmRestore` with
    // nothing filed under the object it was handed, and both answer `null` before any
    // permit exists.
    const send = sender();
    const answered = pending();
    expect(confirmRestore(answered, at(BASE, []))).not.toBeNull();
    expect(confirmRestore(answered, at(BASE, []))).toBeNull();

    const cancelled = pending();
    cancelRestore(cancelled);
    expect(confirmRestore(cancelled, at(BASE, []))).toBeNull();
    expect(await sendRestore(null, cancelled, at(BASE, []), send)).toEqual({
      kind: 'notAttempted'
    });
    expect(send).not.toHaveBeenCalled();
  }); // End of the "answered or withdrawn" case
}); // End of the "withdrawn question authorizes nothing" suite

describe('a question being inspected is held, never absent', () => {
  /**
   * Runs one body from inside the first read of one session property.
   *
   * **Narrower than {@link trapped}, and aimed at different producers.** Those cases
   * prove that a *spend* cannot happen from inside a withdrawal; these prove that
   * everything else a getter can reach — asking a second question, carrying the first
   * one away, taking it back, confirming it — meets a question that is still **there**
   * while a transition is part-way through deciding about it. The property trapped is
   * whichever one the transition under test reads first, so each case is written against
   * the code's shape rather than against a finding's wording.
   *
   * @param session - The session to trap. Modified in place.
   * @param key - The property whose first read runs the body.
   * @param body - What runs from inside that read. It fires once, so the re-entrant
   *   call's own reads do not recurse.
   * @returns Whether the trapped read has happened, as a call.
   */
  function whenFirstRead<K extends keyof RestoreSession>(
    session: RestoreSession,
    key: K,
    body: () => void
  ): () => boolean {
    const held = session[key];
    let fired = false;
    Object.defineProperty(session, key, {
      get: () => {
        if (!fired) {
          fired = true;
          body();
        }
        return held;
      },
      configurable: true,
      enumerable: true
    });
    return () => fired;
  } // End of function whenFirstRead()

  /**
   * How many whole-file replacements a set of retained sessions can still issue.
   *
   * Every one goes through {@link confirmAndSend}, which is the production path, so a
   * second live authorization shows up as **a sender that ran twice** rather than as a
   * permit somebody forgot to assert about.
   *
   * @param sessions - Every session a caller could still be holding.
   * @returns How many times the sender was called.
   */
  async function replacementsFrom(sessions: readonly RestoreSession[]): Promise<number> {
    const send = sender();
    for (const session of sessions) {
      await confirmAndSend(session, at(BASE, []), send);
    }
    return send.mock.calls.length;
  } // End of function replacementsFrom()

  it('cannot be asked a second time from inside targetRevisionObserved', async () => {
    // **The second confirmation review's High.** Taking the authorization out of the map
    // to protect it from being spent made `prepareRestore` see no question at all, and
    // absence is that function's licence to register another one: the getter below built
    // a successor session with a permit of its own while the first permit was still
    // going to be put back, and both could then confirm and both could send. One answer,
    // two whole-file replacements. A suspension is *present*, so the second question is
    // refused as the duplicate it is.
    const asked = pending();
    const successors: RestoreSession[] = [];
    const read = whenFirstRead(asked, 'phase', () => {
      successors.push(prepareRestore(asked, at(BASE)));
    });

    const idle = targetRevisionObserved(asked, BASE);

    expect(read()).toBe(true);
    expect(idle).toBe(asked);
    // Nothing was built: `prepareRestore` answers its own argument when a question
    // already exists, and a suspended question exists.
    expect(successors).toHaveLength(1);
    expect(successors[0]).toBe(asked);
    expect(await replacementsFrom([asked, ...successors])).toBe(1);
  }); // End of the "asked a second time from inside targetRevisionObserved" case

  it('cannot be carried away from inside targetRevisionObserved', async () => {
    // The other producer that tests for presence. `carryTheQuestion` moves an
    // authorization to the session that replaces it, and a suspended one is not takeable
    // — another call holds that permit and will put it back, so moving it would leave
    // one question live on two objects. The successor therefore presents nothing, which
    // is the conservative direction, and the question stays where the person is looking
    // at it.
    const asked = pending();
    const carried: RestoreSession[] = [];
    const read = whenFirstRead(asked, 'phase', () => {
      carried.push(batchesLoaded(asked, { ok: true, value: BATCHES }));
    });

    targetRevisionObserved(asked, BASE);

    expect(read()).toBe(true);
    expect(carried).toHaveLength(1);
    expect(carried[0]!.pending).toBeNull();
    expect(confirmRestore(carried[0]!, at(BASE, []))).toBeNull();
    expect(await replacementsFrom([asked, ...carried])).toBe(1);
  }); // End of the "carried away from inside targetRevisionObserved" case

  it('is not put back when a getter withdrew it, and what comes back says so', () => {
    // **"Do not resurrect", as a case.** The round that took the entry out of the map
    // left a re-entrant withdrawal with nothing to delete and then put the permit back
    // over it, so a cancellation issued from inside this transition was silently undone.
    // The put-back is identity-checked against the very cell this call left behind, so a
    // deleted cell stays deleted — and the session that comes back presents no question
    // either, because the presentation follows the authorization here as everywhere.
    const asked = pending();
    const read = whenFirstRead(asked, 'phase', () => {
      cancelRestore(asked);
    });

    const idle = targetRevisionObserved(asked, BASE);

    expect(read()).toBe(true);
    expect(confirmRestore(asked, at(BASE, []))).toBeNull();
    expect(idle.pending).toBeNull();
    expect(confirmRestore(idle, at(BASE, []))).toBeNull();
  }); // End of the "not put back when a getter withdrew it" case

  it.each([
    ['another document', textResponse({ document: 99 })],
    ['another entry', textResponse({ entry: entryOf('match/other.yml') })],
    ['another batch', textResponse({ entry: entryOf('match/base.yml', OTHER_BATCH) })]
  ] as const)('survives a candidate response about %s', async (_name, response) => {
    // **The second confirmation review's Low.** A read for entry B stays in flight, the
    // person loads entry A and is asked about it, and B's response lands: revoking
    // before the response had been validated made A's question disappear because of an
    // answer this transition then rejected as irrelevant. It is suspended across the
    // validation instead, so an ignored response withdraws nothing and the session comes
    // back by reference — which is what "the same session" in this transition's own
    // documentation says, for the authorization as well as for the fields.
    const send = sender();
    const asked = pending();

    const same = candidateRead(asked, response);

    expect(same).toBe(asked);
    expect(same.pending).not.toBeNull();
    await confirmAndSend(same, at(BASE, []), send);
    // And the question that survived is the one the person was asked, down to the bytes.
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(TARGET, BASE, CANDIDATE, { accepted: [] });
  }); // End of the "survives a candidate response about another thing" cases

  it('cannot be asked a second time from inside candidateRead', async () => {
    // The same producer against the second inspection: a stale response is validated
    // with the question suspended rather than removed, so a getter reached by any of
    // those reads cannot register a duplicate under a successor session.
    const asked = pending();
    const successors: RestoreSession[] = [];
    const read = whenFirstRead(asked, 'entry', () => {
      successors.push(prepareRestore(asked, at(BASE)));
    });

    const same = candidateRead(asked, textResponse({ entry: entryOf('match/other.yml') }));

    expect(read()).toBe(true);
    expect(same).toBe(asked);
    expect(successors).toHaveLength(1);
    expect(successors[0]).toBe(asked);
    expect(await replacementsFrom([asked, ...successors])).toBe(1);
  }); // End of the "asked a second time from inside candidateRead" case

  it('is not put back when a getter withdrew it during a candidate response', () => {
    const asked = pending();
    const read = whenFirstRead(asked, 'entry', () => {
      cancelRestore(asked);
    });

    const same = candidateRead(asked, textResponse({ entry: entryOf('match/other.yml') }));

    expect(read()).toBe(true);
    expect(confirmRestore(asked, at(BASE, []))).toBeNull();
    expect(same.pending).toBeNull();
    expect(confirmRestore(same, at(BASE, []))).toBeNull();
  }); // End of the "withdrew it during a candidate response" case

  it('cannot be confirmed while it is suspended, and is confirmable once it is not', async () => {
    // **What the suspension itself could expose, asked directly.** A cell that made a
    // question *confirmable* would be worse than the absence it replaced, so
    // `confirmRestore` refuses it — by a `WeakSet` membership test that reads no
    // property and runs no user code. The question is intact afterwards, which is what
    // separates a suspension from the withdrawal it must not become.
    const asked = pending();
    const inside: (StartedRestore | null)[] = [];
    const read = whenFirstRead(asked, 'entry', () => {
      inside.push(confirmRestore(asked, at(BASE, [])));
    });

    const same = candidateRead(asked, textResponse({ entry: entryOf('match/other.yml') }));

    expect(read()).toBe(true);
    expect(inside).toEqual([null]);
    expect(await replacementsFrom([same, asked])).toBe(1);
  }); // End of the "cannot be confirmed while it is suspended" case

  it('is presented by no inspection once a getter inside a nested one withdrew it', async () => {
    // **The third confirmation review's Low, and the one an owning inspection cannot
    // show.** `suspendTheQuestion` answers `undefined` to a *nested* inspection because
    // the outer call owns the cell — and `undefined` used to be enough on its own to
    // return the argument by reference, without asking the map anything. It is not
    // enough: a getter the nested call itself runs can withdraw the outer cell, and what
    // the nested call then handed back presented a question the map no longer held, so a
    // caller retaining it drew a confirmation control that could do nothing.
    //
    // The two traps build that sequence exactly. `candidateRead` reads `entry` first and
    // that read runs a nested `targetRevisionObserved`; the nested call reads `phase`
    // first and that read cancels. Neither inspection is meant to change anything else —
    // the response is about another entry and the observation is `null` — so every
    // session handed back below comes from an arm that decided nothing.
    const asked = pending();
    const retained: RestoreSession[] = [];
    const outerRead = whenFirstRead(asked, 'entry', () => {
      retained.push(targetRevisionObserved(asked, null));
    });
    const nestedRead = whenFirstRead(asked, 'phase', () => {
      cancelRestore(asked);
    });

    retained.push(candidateRead(asked, textResponse({ entry: entryOf('match/other.yml') })));

    // Both really fired, and in that order — otherwise this case is about an ordinary
    // inspection and proves nothing about a nested one.
    expect(outerRead()).toBe(true);
    expect(nestedRead()).toBe(true);
    expect(retained).toHaveLength(2);
    for (const one of retained) {
      // The biconditional, over everything a caller could still be holding: a session
      // presents a question exactly when it still authorizes one. The nested result is
      // what fails this against a build whose `undefined` branch skips the map.
      expect(confirmRestore(one, at(one.baseRevision, [])) !== null).toBe(one.pending !== null);
    }
    // And the withdrawal is what stands, on the asked session and on both answers.
    expect(confirmRestore(asked, at(BASE, []))).toBeNull();
    expect(await replacementsFrom([asked, ...retained])).toBe(0);
  }); // End of the "withdrew it from inside a nested inspection" case
}); // End of the "question being inspected is held" suite

describe('what a session presents and what it authorizes', () => {
  /**
   * Every exported transition, as one call on a session with a live question.
   *
   * **The obligation no type can express**, written as a table. With the
   * authorization keyed by the session, a transition that returns a fresh session
   * owes one of two things: it revokes and writes `pending: null`, or it carries the
   * entry across. Forgetting the first is a question that outlives its withdrawal —
   * the review's second High — and forgetting the second is a question drawn on
   * screen whose control does nothing. TypeScript sees neither obligation, so the
   * whole set is driven here rather than each arm being trusted where it was written.
   *
   * **The scope is stated rather than implied**: each row starts from a session with
   * a question pending and nothing else — no conflict, no send in flight, no
   * committed replacement — because those are the states in which the two halves can
   * disagree without a second reason for the confirmation to refuse.
   *
   * @returns One entry per transition, named for the function it calls.
   */
  function transitions(): readonly (readonly [
    string,
    (session: RestoreSession) => RestoreSession
  ])[] {
    return [
      ['startRestore', () => startRestore(target())],
      ['loadingBatches', (session) => loadingBatches(session)],
      ['batchesLoaded', (session) => batchesLoaded(session, { ok: true, value: BATCHES })],
      ['a refused batchesLoaded', (session) => batchesLoaded(session, { ok: false, failure: FAILURE })],
      ['chooseBatch', (session) => chooseBatch(session, OTHER_BATCH)],
      ['loadingEntries', (session) => loadingEntries(session)],
      ['entriesLoaded', (session) => entriesLoaded(session, { ok: true, value: entriesIn() })],
      ['chooseEntry', (session) => chooseEntry(session, entryOf('match/other.yml').id)],
      ['candidateRead', (session) => candidateRead(session, textResponse())],
      ['candidateRefused', (session) => candidateRefused(session, FAILURE)],
      ['targetRevisionObserved, moved', (session) => targetRevisionObserved(session, ELSEWHERE)],
      ['targetRevisionObserved, unmoved', (session) => targetRevisionObserved(session, BASE)],
      ['prepareRestore over a live question', (session) => prepareRestore(session, at(BASE))],
      ['cancelRestore', (session) => cancelRestore(session)],
      ['confirmRestore', (session) => confirmRestore(session, at(BASE, []))!.session],
      ['applyRestore', (session) => applyRestore(session, sealed(saved()), NO_SURFACES)],
      ['restoreConfirmationWithdrawn', (session) => restoreConfirmationWithdrawn(session)],
      ['restoreCouldNotBeSent', (session) => restoreCouldNotBeSent(session, false)],
      ['acknowledgeRestoreFindings', (session) => acknowledgeRestoreFindings(session)],
      ['dismissRestoreOutcome', (session) => dismissRestoreOutcome(session)],
      ['askToReloadDiskVersion', (session) => askToReloadDiskVersion(session)],
      ['confirmDiskReload', (session) => confirmDiskReload(session)],
      ['reloadTheDiskVersion', (session) => reloadTheDiskVersion(session, adopting().adopt)],
      // The receiver's arms (Phase 2d-6-5): the replacing ones withdraw, the
      // others carry. A `retained` about the destination carries too, and is
      // outside this table's scope because the block it records is a second
      // reason for the confirmation to refuse; its own case pins the carry.
      [
        'applyRestoreObservation, raised over the destination',
        (session) => applyRestoreObservation(session, watched.raised(watched.observation()))
      ],
      [
        'applyRestoreObservation, raisedWithoutReload over the destination',
        (session) =>
          applyRestoreObservation(session, watched.decided(null, watched.observation(), true, 'raisedWithoutReload'))
      ],
      [
        'applyRestoreObservation, supersedes over the destination',
        (session) =>
          applyRestoreObservation(
            session,
            watched.decided(
              externalConflictSource(watched.observation({ sequence: 1, diskRevision: AGAIN })),
              watched.observation(),
              false,
              'supersedes'
            )
          )
      ],
      [
        'applyRestoreObservation, coalesced',
        (session) =>
          applyRestoreObservation(
            session,
            watched.decided(externalConflictSource(watched.observation({ sequence: 1 })), watched.observation(), false, 'coalesced')
          )
      ],
      [
        'applyRestoreObservation, notLater',
        (session) =>
          applyRestoreObservation(
            session,
            watched.decided(externalConflictSource(watched.observation({ sequence: 9 })), watched.observation(), false, 'notLater')
          )
      ],
      [
        'applyRestoreObservation, raised over another file',
        (session) => applyRestoreObservation(session, watched.raised(watched.otherObservation()))
      ],
      [
        'applyRestoreObservation, retained about another file',
        (session) => applyRestoreObservation(session, retainedDelivery(watched.otherObservation()))
      ],
      [
        'applyRestoreObservation, writtenHere lifting a wait',
        (session) => {
          const seen = watched.observation();
          return applyRestoreObservation(
            applyRestoreObservation(session, retainedDelivery(seen)),
            writtenHereDelivery(seen)
          );
        }
      ]
    ];
  } // End of function transitions()

  it.each(transitions())('agree on the session %s answers', (_name, move) => {
    const next = move(pending());

    // The biconditional, in one line: a session presents a question exactly when it
    // still authorizes one. A carry that was forgotten fails the left half; a
    // revocation that was forgotten fails the right.
    expect(confirmRestore(next, at(next.baseRevision, [])) !== null).toBe(next.pending !== null);
  });
}); // End of the "presents and authorizes" suite

describe('no save is issued without a confirmation', () => {
  /**
   * Every session that must not reach a sender, with what makes it so.
   *
   * **The point of the group.** Each entry is confirmed and then sent through the
   * production path a component uses — {@link confirmAndSend} — so a check that
   * stopped being made would show up as a sender that was called, not as a `null`
   * somebody forgot to assert.
   *
   * @returns One case per path that lacks a valid unspent confirmation.
   */
  function forbidden(): readonly {
    readonly name: string;
    readonly session: RestoreSession;
    readonly observed: ContentRevision | null;
    readonly surfaces: readonly OpenWriteSurface[];
  }[] {
    const started = confirmRestore(pending(), at(BASE, []))!;
    const rehashed: RestoreSession = {
      ...pending(),
      preview: { ...pending().preview!, revision: OTHER_CANDIDATE_REVISION }
    };
    return [
      { name: 'nothing prepared', session: withCandidate(), observed: BASE, surfaces: [] },
      { name: 'no candidate at all', session: startRestore(target()), observed: BASE, surfaces: [] },
      { name: 'a cancelled question', session: cancelRestore(pending()), observed: BASE, surfaces: [] },
      { name: 'a spent confirmation', session: started.session, observed: BASE, surfaces: [] },
      { name: 'a read-only destination', session: { ...pending(), readOnly: true }, observed: BASE, surfaces: [] },
      { name: 'a restore in flight', session: { ...pending(), phase: 'saving' }, observed: BASE, surfaces: [] },
      { name: 'a committed restore', session: { ...pending(), restored: true }, observed: BASE, surfaces: [] },
      { name: 'a conflict on screen', session: pendingOverAConflict(), observed: BASE, surfaces: [] },
      { name: 'an unprojected destination', session: pending(), observed: null, surfaces: [] },
      { name: 'a destination that moved', session: pending(), observed: ELSEWHERE, surfaces: [] },
      { name: 'a moved candidate hash', session: rehashed, observed: BASE, surfaces: [] },
      {
        name: 'a moved preview generation',
        session: { ...candidateRead(pending(), textResponse()), pending: pending().pending },
        observed: BASE,
        surfaces: []
      },
      {
        name: 'a confirmation from another document',
        session: { ...startRestore(target({ id: 99 })), pending: pending().pending },
        observed: BASE,
        surfaces: []
      },
      ...COMPETING.map((kind) => ({
        name: `a ${kind} open over the destination`,
        session: pending(),
        observed: BASE as ContentRevision | null,
        surfaces: [{ kind, target: { kind: 'document', document: TARGET } }] as readonly OpenWriteSurface[]
      }))
    ];
  } // End of function forbidden()

  /**
   * A session with a conflict showing **and** a question pending.
   *
   * A state the transitions do not reach on their own — a conflict arrives after the
   * confirmation has been consumed — assembled here so the conflict arm of the
   * refusal is driven rather than assumed.
   *
   * @returns The session.
   */
  function pendingOverAConflict(): RestoreSession {
    const answered = applyRestore(
      confirmRestore(pending(), at(BASE, []))!.session,
      sealed(conflictResult()),
      NO_SURFACES
    );
    return { ...answered, pending: pending().pending };
  } // End of function pendingOverAConflict()

  it.each(forbidden().map((one) => [one.name, one] as const))(
    'issues nothing for %s',
    async (_name, one) => {
      const send = sender();
      const { sent } = await confirmAndSend(one.session, at(one.observed, one.surfaces), send);
      expect(sent).toEqual({ kind: 'notAttempted' });
      expect(send).not.toHaveBeenCalled();
    }
  );

  it('issues exactly one save for the one path that does confirm', async () => {
    const send = sender();
    const { sent } = await confirmAndSend(pending(), at(BASE, []), send);
    expect(sent.kind).toBe('answered');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('calls nothing at all for a null confirmation', async () => {
    const send = sender();
    expect(await sendRestore(null, pending(), at(BASE, []), send)).toEqual({
      kind: 'notAttempted'
    });
    expect(send).not.toHaveBeenCalled();
  });
}); // End of the "no save without a confirmation" suite

describe('nothing here changes until the file answers', () => {
  /**
   * Every transition over the catalogue, the selection, the candidate and the base
   * revision, as a call on one session.
   *
   * These are the nine `browser.restore.refused.inFlight` and
   * `browser.restore.refused.alreadyRestored` both have to be true of: a send in
   * flight cannot have its candidate replaced under it, and a session that has
   * already replaced the file has nothing left to select for.
   *
   * @returns One entry per transition, named for what it is.
   */
  function selections(): readonly (readonly [string, (session: RestoreSession) => RestoreSession])[] {
    return [
      ['a batch catalogue read starting', (session) => loadingBatches(session)],
      ['a batch listing landing', (session) => batchesLoaded(session, { ok: true, value: BATCHES })],
      ['a refused batch listing landing', (session) => batchesLoaded(session, { ok: false, failure: FAILURE })],
      ['a batch being chosen', (session) => chooseBatch(session, OTHER_BATCH)],
      ['an entry catalogue read starting', (session) => loadingEntries(session)],
      ['an entry listing landing', (session) => entriesLoaded(session, { ok: true, value: entriesIn() })],
      ['an entry being chosen', (session) => chooseEntry(session, entryOf('match/other.yml').id)],
      [
        'another candidate landing',
        (session) =>
          candidateRead(session, textResponse({ text: OTHER_CANDIDATE, revision: OTHER_CANDIDATE_REVISION }))
      ],
      ['a refused candidate read', (session) => candidateRefused(session, FAILURE)],
      ['a reprojection of the destination', (session) => targetRevisionObserved(session, ELSEWHERE)]
    ];
  } // End of function selections()

  /**
   * The transitions a send in flight freezes and a committed restore does not.
   *
   * A committed outcome has to stay dismissible, and its findings — there are none
   * on a `saved` arm — are why acknowledging is a no-op there for its own reason
   * rather than by a guard.
   *
   * @returns One entry per transition, named for what it is.
   */
  function panelActions(): readonly (readonly [string, (session: RestoreSession) => RestoreSession])[] {
    return [
      ['the question being asked', (session) => prepareRestore(session, at(BASE))],
      ['the question being taken back', (session) => cancelRestore(session)],
      ['the findings being acknowledged', (session) => acknowledgeRestoreFindings(session)],
      ['the outcome being put away', (session) => dismissRestoreOutcome(session)],
      ['a reload being asked about', (session) => askToReloadDiskVersion(session)],
      ['a reload being confirmed', (session) => confirmDiskReload(session)],
      ['a reload being spent', (session) => reloadTheDiskVersion(session, adopting().adopt)]
    ];
  } // End of function panelActions()

  /**
   * A session with a send in flight **and** a refusal still on screen.
   *
   * The state that makes the acknowledgement and the dismissal worth freezing: a
   * refused attempt is acknowledged, prepared and confirmed again, so the second
   * send is in flight with the first one's findings still drawn.
   *
   * @returns The session, in flight.
   */
  async function inFlightOverARefusal(): Promise<RestoreSession> {
    const { session } = await roundTrip(pending(), refusal());
    const started = confirmRestore(prepareRestore(session, at(BASE)), at(BASE, []));
    if (started === null) {
      throw new Error('this session was expected to confirm a second attempt');
    }
    return started.session;
  } // End of function inFlightOverARefusal()

  it.each([...selections(), ...panelActions()])(
    'answers the same session for %s while one is in flight',
    async (_name, mutate) => {
      const session = await inFlightOverARefusal();
      expect(session.phase).toBe('saving');
      expect(session.outcome?.kind).toBe('refused');
      // Reference equality, so a transition that rebuilt an equal session would
      // still fail: what the sentence promises is that nothing changed at all.
      expect(mutate(session)).toBe(session);
    }
  );

  it.each(selections())('answers the same session for %s once one has committed', async (_name, mutate) => {
    const { session } = await roundTrip(pending());
    expect(session.restored).toBe(true);
    expect(mutate(session)).toBe(session);
  });

  it('classifies the answer against what was submitted, not a preview swapped under it', () => {
    // No transition can reach this state — that is what the group above holds — so
    // the swap is done by hand, which is exactly what a caller could do. The
    // conflict must describe the bytes that were sent.
    const started = confirmRestore(pending(), at(BASE, []))!;
    const swapped: RestoreSession = {
      ...started.session,
      preview: previewOf({ text: OTHER_CANDIDATE, revision: OTHER_CANDIDATE_REVISION })
    };
    const conflict = conflictOf(applyRestore(swapped, sealed(conflictResult()), NO_SURFACES));
    expect(conflict).not.toBeNull();
    expect(conflict!.draft.value).toBe(CANDIDATE);
  }); // End of the "not a preview swapped under it" case

  it('discharges a committed seal even when the preview has gone', () => {
    const started = confirmRestore(pending(), at(BASE, []))!;
    const stripped: RestoreSession = { ...started.session, preview: null };
    const surfaces = coordinator([{ kind: 'matchEditor', target: { kind: 'document', document: TARGET } }]);
    const answered = applyRestore(stripped, sealed(saved()), surfaces.close);
    expect(surfaces.closed).toEqual([{ document: TARGET, revision: AFTER }]);
    expect(answered.restored).toBe(true);
    expect(answered.baseRevision).toBe(AFTER);
    expect(answered.outcome?.kind).toBe('saved');
  }); // End of the "preview has gone" case

  it('discharges a committed seal with no presentation state at all', () => {
    // **Absence of presentation state must never strand a committed write.** There
    // is nothing to describe an outcome over here, so none is invented — but the
    // seal is opened, the coordinator runs, and the file's new revision is recorded.
    const started = confirmRestore(pending(), at(BASE, []))!;
    const bare: RestoreSession = {
      ...started.session,
      preview: null,
      submitted: null,
      inFlight: null
    };
    const surfaces = coordinator([{ kind: 'rawEditor', target: { kind: 'document', document: TARGET } }]);
    const answered = applyRestore(bare, sealed(saved()), surfaces.close);
    expect(surfaces.closed).toEqual([{ document: TARGET, revision: AFTER }]);
    expect(surfaces.open).toEqual([]);
    expect(answered.restored).toBe(true);
    expect(answered.baseRevision).toBe(AFTER);
    expect(answered.phase).toBe('editing');
    expect(answered.outcome).toBeNull();
  }); // End of the "no presentation state" case
}); // End of the "nothing changes until the file answers" suite

describe('the answer', () => {
  it('reports a committed replacement and spends the session', async () => {
    const { session } = await roundTrip(pending());
    expect(session.outcome?.kind).toBe('saved');
    expect(session.outcome?.messages).toEqual([{ kind: 'fileWritten' }, { kind: 'backupTaken' }]);
    expect(session.restored).toBe(true);
    expect(session.baseRevision).toBe(AFTER);
    expect(baseRevisionOf(session)).toBe(AFTER);
    // The candidate is untouched: a commit rebases what it is measured against and
    // does not change what it is.
    expect(candidateText(session.preview!)).toBe(CANDIDATE);
    expect(restoreRefusal(session, windowAgrees(session))).toEqual({ kind: 'alreadyRestored' });
    expect(canPrepareRestore(session, windowAgrees(session))).toBe(false);
  }); // End of the "committed replacement" case

  it('treats committed: false as a success in which nothing was written', async () => {
    const { session } = await roundTrip(pending(), saved(false));
    expect(session.outcome?.kind).toBe('saved');
    expect(session.outcome?.messages).toContainEqual({ kind: 'nothingToWrite' });
    // **Nothing became stale and nothing was carried out**, so the session is not
    // spent: the base still moves, because the transaction answered a revision.
    expect(session.restored).toBe(false);
    expect(session.baseRevision).toBe(AFTER);
    expect(restoreRefusal(session, windowAgrees(session))).toBeNull();
  }); // End of the "committed: false" case

  it('never carries an identity across a committed replacement', async () => {
    // `moved` is `null` permanently by `WholeDocumentSaved`'s own type: every
    // identity in the file is stale at once and there is no single one to answer
    // with.
    const wire: SaveResult = {
      outcome: 'saved',
      revision: AFTER,
      committed: true,
      notes: [],
      backup_taken: true,
      moved: { document: TARGET, revision: AFTER, node: 3 }
    };
    const { session } = await roundTrip(pending(), wire);
    expect(session.outcome?.kind).toBe('saved');
    expect(session.outcome).toMatchObject({ moved: null });
  }); // End of the "no identity across a replacement" case

  it('says the window is out of step beside a committed write, never instead of it', async () => {
    const { session } = await roundTrip(pending(), saved(), {
      kind: 'failed',
      failure: FAILURE
    });
    expect(session.outcome?.kind).toBe('saved');
    expect(session.restored).toBe(true);
    // The committed arm's own lines first, and the invalidation's beside them.
    expect(session.outcome?.messages).toEqual([{ kind: 'fileWritten' }, { kind: 'backupTaken' }]);
    expect(session.extraMessages).toEqual([{ kind: 'windowOutOfStep' }]);
    expect(restoreView(session, windowAgrees(session)).messages).toEqual([
      { kind: 'fileWritten' },
      { kind: 'backupTaken' },
      { kind: 'windowOutOfStep' }
    ]);
  }); // End of the "window out of step" case

  it('closes every surface over the file a committed replacement destroyed', async () => {
    // **Consult Q4's post-commit half.** The pre-send refusal is an affordance — a
    // surface can open *after* the send was issued — so what actually protects it is
    // the synchronous whole-document invalidation this answer discharges. The
    // surface over another file stays open: the write did not touch it.
    const send = sender();
    const started = confirmRestore(pending(), at(BASE, []))!;
    const sent = await sendRestore(started, started.session, at(BASE, []), send);
    if (sent.kind !== 'answered' || sent.answer.kind !== 'sealed') {
      throw new Error('this send was expected to be sealed');
    }
    // Opened while the send was in flight, which no refusal could have caught.
    const surfaces = coordinator([
      { kind: 'matchEditor', target: { kind: 'document', document: TARGET } },
      { kind: 'matchCreator', target: { kind: 'document', document: TARGET } },
      { kind: 'rawEditor', target: { kind: 'document', document: 99 } }
    ]);
    const answered = applyRestore(started.session, sent.answer.sealed, surfaces.close);
    expect(surfaces.closed).toEqual([{ document: TARGET, revision: AFTER }]);
    expect(surfaces.open).toEqual([{ kind: 'rawEditor', target: { kind: 'document', document: 99 } }]);
    expect(answered.restored).toBe(true);
    expect(answered.extraMessages).toEqual([]);
  }); // End of the "closes every surface" case

  it('closes a new-snippet form that has named no file, because that pane does', () => {
    // **The case that drives the `unknown` arm through an invalidation**, which no
    // case did before: without it the recorder's rule for that arm is unobservable,
    // and 2d-5-2 is the step that starts constructing such a surface. The rule is
    // production's — `invalidateEverySurface` in `DetailPane.svelte` sets
    // `creating = false` unconditionally, and its comment at `:529-535` says why: it
    // cannot learn which destination the form chose, so it closes the form over every
    // file, which over-broadly includes the file it names nothing about.
    const started = confirmRestore(pending(), at(BASE, []))!;
    const surfaces = coordinator([
      { kind: 'matchCreator', target: { kind: 'unknown' } },
      { kind: 'matchCreator', target: { kind: 'document', document: 99 } },
      { kind: 'matchEditor', target: { kind: 'document', document: 99 } }
    ]);
    const answered = applyRestore(started.session, sealed(saved()), surfaces.close);
    // Both creators go, whatever file they name; the editor over another file stays,
    // because the write did not touch it.
    expect(surfaces.open).toEqual([
      { kind: 'matchEditor', target: { kind: 'document', document: 99 } }
    ]);
    expect(surfaces.closed).toEqual([{ document: TARGET, revision: AFTER }]);
    expect(answered.restored).toBe(true);
  }); // End of the "new-snippet form that named no file" case

  it('leaves the restore surface itself open, which is the other half of that rule', () => {
    // The pane deliberately does not close the restore (`DetailPane.svelte:525-527`):
    // it is where the outcome of this very write is drawn, and `RestoreSession`'s own
    // `restored` is what stops it offering to replace anything again.
    const started = confirmRestore(pending(), at(BASE, []))!;
    const restoring: OpenWriteSurface = {
      kind: 'restore',
      target: { kind: 'document', document: TARGET }
    };
    const surfaces = coordinator([
      restoring,
      { kind: 'rawEditor', target: { kind: 'document', document: TARGET } }
    ]);
    const answered = applyRestore(started.session, sealed(saved()), surfaces.close);
    expect(surfaces.open).toEqual([restoring]);
    expect(answered.restored).toBe(true);
  }); // End of the "restore surface itself" case

  it.each([
    ['a conflict', conflictResult()],
    ['a refusal', refusal()],
    ['a success that wrote nothing', saved(false)]
  ])('closes no surface for %s, because nothing went stale', (_name, result) => {
    const started = confirmRestore(pending(), at(BASE, []))!;
    const surfaces = coordinator([{ kind: 'matchEditor', target: { kind: 'document', document: TARGET } }]);
    applyRestore(started.session, sealed(result), surfaces.close);
    expect(surfaces.closed).toEqual([]);
    expect(surfaces.open).toHaveLength(1);
  });

  it('keeps a committed replacement primary when the coordinator throws', async () => {
    // A failure **after** the commit never unwrites the file, and never turns into a
    // failed save (`PROGRESS.md` D2). It is one line beside the committed arm.
    const started = confirmRestore(pending(), at(BASE, []))!;
    const answered = applyRestore(started.session, sealed(saved()), () => {
      throw new Error('a surface would not close');
    });
    expect(answered.outcome?.kind).toBe('saved');
    expect(answered.outcome?.messages).toEqual([{ kind: 'fileWritten' }, { kind: 'backupTaken' }]);
    expect(answered.restored).toBe(true);
    expect(answered.baseRevision).toBe(AFTER);
    expect(answered.extraMessages).toEqual([{ kind: 'windowOutOfStep' }]);
    expect(answered.phase).toBe('editing');
    expect(answered.inFlight).toBeNull();
  }); // End of the "coordinator throws" case

  it('adds one line for the two invalidations, because both mean the same thing', () => {
    // The seal's own callback and the issuer's are two acts at two moments; a person
    // reads one sentence for either.
    const started = confirmRestore(pending(), at(BASE, []))!;
    const answered = applyRestore(
      started.session,
      sealWholeDocumentSave(TARGET, saved(), { kind: 'failed', failure: FAILURE }),
      NO_SURFACES
    );
    expect(answered.extraMessages).toHaveLength(1);
  }); // End of the "one line for two invalidations" case

  it('invents no outcome for a seal already opened, and returns the session to editing', () => {
    // **Named for what it does.** The branch does not leave the session alone — it
    // moves the phase, which is the useful half — so what it claims is only that it
    // replaces no outcome and invents none, and that nothing is left in flight.
    const started = confirmRestore(pending(), at(BASE, []))!;
    const once = sealed(saved());
    const twice = coordinator();
    const first = applyRestore(started.session, once, twice.close);
    const second = applyRestore(first, once, twice.close);
    expect(second.outcome).toBe(first.outcome);
    expect(second.phase).toBe('editing');
    expect(second.inFlight).toBeNull();
    expect(second.baseRevision).toBe(first.baseRevision);
    expect(second.restored).toBe(first.restored);
    // And the invalidation is discharged once, not once per open.
    expect(twice.closed).toHaveLength(1);
  }); // End of the "already opened" case

  it('shows a refusal, records consent for it, and sends it with the same bytes', async () => {
    const { session } = await roundTrip(pending(), refusal());
    expect(session.outcome?.kind).toBe('refused');
    expect(session.restored).toBe(false);
    const view = restoreView(session, windowAgrees(session));
    expect(view.refusalChoices).toEqual(['saveAnyway', 'keepEditing']);
    expect(view.findingsAreStale).toBe(false);
    // The whole-document describer is what this reaches, so the *replaces the
    // entire document* disclosure comes with it rather than being restated, and the
    // parse rejection is read through the refused arm's own `rawSave` field.
    const refused = view.outcome?.kind === 'refused' ? view.outcome : null;
    expect(refused?.rawSave?.messages[0]).toEqual({ kind: 'replacesWholeDocument' });
    expect(refused?.rawSave?.unparseable?.finding).toBe(REJECTION);

    const consented = acknowledgeRestoreFindings(session);
    expect(consented.pending).toBeNull();
    // **A refusal moves nothing**, so the session is still measured against `BASE`
    // and a confirmation offered any other observed revision is refused — the
    // acknowledgement does not weaken that gate.
    const again = prepareRestore(consented, at(BASE));
    const wrongRevision = sender();
    await confirmAndSend(again, at(AFTER, []), wrongRevision);
    expect(wrongRevision).not.toHaveBeenCalled();
    // And the second attempt sends **the same bytes** with the consent bound to
    // them, which is what a `DocumentDoesNotParse` finding is addressed to.
    const send = sender();
    await confirmAndSend(again, at(BASE, []), send);
    expect(send).toHaveBeenCalledWith(TARGET, BASE, CANDIDATE, { accepted: [REJECTION] });
  }); // End of the "refusal and acknowledgement" case

  it('records no consent for a verdict no acknowledgement can move', async () => {
    const modelError: Finding = { code: 'MatchHasNoContentField', span: null, node: null, path: null };
    const { session } = await roundTrip(
      pending(),
      refusal([modelError], 'RefusedForEditorModelErrors')
    );
    const consented = acknowledgeRestoreFindings(session);
    expect(restoreView(consented, windowAgrees(consented)).refusalChoices).toEqual(['keepEditing']);
    const send = sender();
    await confirmAndSend(prepareRestore(consented, at(BASE)), at(BASE, []), send);
    expect(send).toHaveBeenCalledWith(TARGET, BASE, CANDIDATE, { accepted: [] });
  }); // End of the "no consent for a model error" case

  it('says an uncertain send may have written, and holds the candidate', async () => {
    const send = vi.fn<SendRestore>(async () => ({ kind: 'failed', mayHaveWritten: true }));
    const { started, sent } = await confirmAndSend(pending(), at(BASE, []), send);
    expect(sent.kind).toBe('answered');
    if (started === null || sent.kind !== 'answered' || sent.answer.kind !== 'failed') {
      throw new Error('this send was expected to fail');
    }
    const session = restoreCouldNotBeSent(started.session, sent.answer.mayHaveWritten);
    expect(session.sendFailure).toEqual({ kind: 'mayHaveWritten', reason: null });
    expect(session.phase).toBe('editing');
    expect(session.inFlight).toBeNull();
    expect(session.restored).toBe(false);
    expect(candidateText(session.preview!)).toBe(CANDIDATE);
    // The reason is `null` and that is a limit rather than a policy: the sealed
    // boundary's failed arm carries only `mayHaveWritten`.
    expect(restoreView(session, windowAgrees(session)).failureLines).toEqual([]);
  }); // End of the "uncertain send" case

  it('keeps a send that never left apart from one that may have written', () => {
    expect(restoreCouldNotBeSent(pending(), false).sendFailure).toEqual({
      kind: 'notSent',
      reason: null
    });
  });

  it('puts an outcome away without giving a committed session back', async () => {
    const { session } = await roundTrip(pending());
    const dismissed = dismissRestoreOutcome(session);
    expect(dismissed.outcome).toBeNull();
    expect(dismissed.submitted).toBeNull();
    expect(dismissed.restored).toBe(true);
    expect(canPrepareRestore(dismissed, windowAgrees(dismissed))).toBe(false);
  }); // End of the "put away" case
}); // End of the "answer" suite

describe('the conflict', () => {
  /**
   * A session showing a conflict.
   *
   * @param diskRevision - What the read after the refusal found.
   * @returns The session, with the conflict on it.
   */
  async function conflicted(diskRevision: ContentRevision = ELSEWHERE): Promise<RestoreSession> {
    const { session } = await roundTrip(pending(), conflictResult(diskRevision));
    return session;
  } // End of function conflicted()

  it('writes nothing, keeps the candidate, and describes what a reload would do', async () => {
    const session = await conflicted();
    expect(session.restored).toBe(false);
    expect(candidateText(session.preview!)).toBe(CANDIDATE);
    const conflict = conflictOf(session);
    expect(conflict).not.toBeNull();
    expect(conflict!.messages).toEqual([
      { kind: 'nothingWasWritten' },
      { kind: 'changedElsewhere' },
      { kind: 'operationKeptInMemory' },
      { kind: 'reloadRetargetsCandidate' }
    ]);
    // The disk side is the conflict's own, kept apart from the retained candidate.
    expect(conflict!.diskText).toBe(DISK);
    expect(conflict!.draft.value).toBe(CANDIDATE);
  }); // End of the "writes nothing" case

  it('describes the operation as a whole-file replacement and nothing narrower', async () => {
    const view = restoreView(await conflicted(), at(BASE));
    expect(view.conflictOperation).toBe('replaceFileFromBackup');
    expect(restoreView(withCandidate(), at(BASE)).conflictOperation).toBeNull();
  });

  it('offers no copy and no reapply, and offers the reload in two steps', async () => {
    // The candidate is not authored text, so `conflictChoicesFor` refuses a copy as
    // a property of the drafted value, and the reapply could never be honest over a
    // whole document. The reload is offered as of 2c-5-4b, which flipped
    // `offersReload` and drew the panel; the transition it names is the one this
    // suite already drives below.
    const session = await conflicted();
    const view = restoreView(session, at(BASE));
    expect(view.conflictChoices).toEqual(['keepEditing', 'reloadDiskVersion']);
    expect(view.awaitingReloadConfirmation).toBe(false);
    expect(view.reloadUnavailable).toBe(false);
    // The second step replaces the first rather than standing beside it, which is
    // `conflictChoicesFor`'s rule and not this surface's — and the choice it names
    // is `confirmReloadKeeping`, **not** `confirmReload`: this surface's reload
    // neither discards a draft nor closes the panel, so both of the older
    // confirmation labels would be false of what it does.
    const asked = restoreView(askToReloadDiskVersion(session), at(BASE));
    expect(asked.conflictChoices).toEqual(['keepEditing', 'confirmReloadKeeping']);
    expect(asked.awaitingReloadConfirmation).toBe(true);
  }); // End of the "no copy and no reapply" case

  it('reaches the confirmation only through the warning', async () => {
    const session = await conflicted();
    expect(confirmDiskReload(session).reload).toEqual({ kind: 'idle' });
    const asked = askToReloadDiskVersion(session);
    expect(asked.reload).toEqual({ kind: 'confirming' });
    expect(confirmDiskReload(asked).reload.kind).toBe('confirmed');
  }); // End of the "only through the warning" case

  it('re-points the candidate at the disk revision when the window installs it', async () => {
    const session = confirmDiskReload(askToReloadDiskVersion(await conflicted()));
    const { adopt, adoptions } = adopting('installed');
    const reloaded = reloadTheDiskVersion(session, adopt);
    expect(adoptions).toHaveLength(1);
    // The candidate stays; what moves is the revision it is measured against.
    expect(candidateText(reloaded.preview!)).toBe(CANDIDATE);
    expect(reloaded.baseRevision).toBe(ELSEWHERE);
    expect(reloaded.preview!.draft.baseRevision).toBe(ELSEWHERE);
    expect(reloaded.outcome).toBeNull();
    expect(reloaded.pending).toBeNull();
    expect(reloaded.reload).toEqual({ kind: 'idle' });
    // And a fresh confirmation is issued against the newly installed revision.
    const send = sender();
    await confirmAndSend(prepareRestore(reloaded, at(ELSEWHERE)), at(ELSEWHERE, []), send);
    expect(send).toHaveBeenCalledWith(TARGET, ELSEWHERE, CANDIDATE, { accepted: [] });
    // And the previous preview generation cannot be spent against the new base: the
    // adoption withdrew it.
    expect(reloaded.previewGeneration).toBeGreaterThan(session.previewGeneration);
  }); // End of the "re-points the candidate" case

  it('withdraws even when the disk revision is the one this session already held', async () => {
    // A file changed and changed back leaves `diskRevision` equal to this session's
    // base. `targetRevisionObserved` answers *unchanged* for that, which is right
    // for an idle reprojection check and wrong here: a confirmation given before the
    // adoption was given about a different reading of the world.
    const session = confirmDiskReload(askToReloadDiskVersion(await conflicted(BASE)));
    const carried: RestoreSession = { ...session, pending: pending().pending };
    const reloaded = reloadTheDiskVersion(carried, adopting('installed').adopt);
    expect(reloaded.baseRevision).toBe(BASE);
    expect(reloaded.pending).toBeNull();
    expect(reloaded.previewGeneration).toBeGreaterThan(carried.previewGeneration);
    expect(candidateText(reloaded.preview!)).toBe(CANDIDATE);
  }); // End of the "disk revision already held" case

  it('treats alreadyThere as a success, exactly as an install', async () => {
    const session = confirmDiskReload(askToReloadDiskVersion(await conflicted()));
    const reloaded = reloadTheDiskVersion(session, adopting('alreadyThere').adopt);
    expect(reloaded.baseRevision).toBe(ELSEWHERE);
    expect(reloaded.outcome).toBeNull();
  });

  it('moves nothing when the window refuses, and stops offering the control', async () => {
    const session = confirmDiskReload(askToReloadDiskVersion(await conflicted()));
    const reloaded = reloadTheDiskVersion(session, adopting('refused').adopt);
    expect(reloaded.baseRevision).toBe(BASE);
    expect(reloaded.outcome).toBe(session.outcome);
    expect(reloaded.reload).toEqual({ kind: 'refused' });
    const view = restoreView(reloaded, windowAgrees(reloaded));
    expect(view.reloadUnavailable).toBe(true);
    expect(view.awaitingReloadConfirmation).toBe(false);
  }); // End of the "window refuses" case

  it('asks the window nothing without a confirmation', async () => {
    const { adopt, adoptions } = adopting();
    expect(reloadTheDiskVersion(await conflicted(), adopt).reload).toEqual({ kind: 'idle' });
    expect(adoptions).toEqual([]);
  });

  it('takes a second conflict after the first was adopted', async () => {
    const first = confirmDiskReload(askToReloadDiskVersion(await conflicted(ELSEWHERE)));
    const reloaded = reloadTheDiskVersion(first, adopting('installed').adopt);
    const { session } = await roundTrip(
      prepareRestore(reloaded, at(ELSEWHERE)),
      conflictResult(AGAIN, ELSEWHERE)
    );
    const second = conflictOf(session);
    expect(second).not.toBeNull();
    // Read through the tested type guard since Phase 2d-6-5: `conflictOf` answers
    // either origin, and `expected` is the save arm's.
    expect(second !== null && isSaveConflict(second) ? second.expected : null).toBe(ELSEWHERE);
    expect(second!.diskRevision).toBe(AGAIN);
    // Nothing was written by either attempt, and the candidate is still the same
    // bytes it was read as.
    expect(session.restored).toBe(false);
    expect(candidateText(session.preview!)).toBe(CANDIDATE);
    // And the second conflict's own reload re-points onto the second disk revision.
    const adopted = reloadTheDiskVersion(
      confirmDiskReload(askToReloadDiskVersion(session)),
      adopting('installed').adopt
    );
    expect(adopted.baseRevision).toBe(AGAIN);
  }); // End of the "second conflict" case

  it('is a refusal to prepare while it is on screen', async () => {
    const session = await conflicted();
    expect(restoreRefusal(session, windowAgrees(session))).toEqual({ kind: 'conflictShowing' });
    expect(prepareRestore(session, at(BASE)).pending).toBeNull();
  });
}); // End of the "conflict" suite

describe('the view', () => {
  it('derives what a screen draws and stores nothing', () => {
    const session = withCandidate();
    const view = restoreView(session, windowAgrees(session));
    expect(view.target).toBe(TARGET);
    expect(view.baseRevision).toBe(BASE);
    expect(view.batch).toEqual(BATCH);
    expect(view.entry).toEqual(entryOf().id);
    expect(view.preview).toBe(session.preview);
    expect(view.canPrepare).toBe(true);
    expect(view.refusal).toBeNull();
    expect(view.confirming).toBe(false);
    expect(view.restoring).toBe(false);
    expect(view.restored).toBe(false);
    expect(view.outcome).toBeNull();
    expect(view.messages).toEqual([]);
    expect(view.notes).toEqual([]);
    expect(view.diskText).toBeNull();
    expect(session).toEqual(withCandidate());
  }); // End of the "derives what a screen draws" case

  it('withdraws the prepare control once a question is pending', () => {
    const view = restoreView(pending(), at(BASE));
    expect(view.confirming).toBe(true);
    expect(view.canPrepare).toBe(false);
  });

  it('reports the presentation changes a committed save disclosed', async () => {
    const note: PresentationNote = { DoubledSequenceSeparation: { edit: 0 } };
    const { session } = await roundTrip(pending(), saved(true, [note]));
    expect(restoreView(session, windowAgrees(session)).notes).toEqual([note]);
  });
}); // End of the "view" suite

describe('the sentences behind the codes', () => {
  /**
   * Every refusal code, one of each shape.
   *
   * @returns The codes, with one entry per competing surface kind.
   */
  function everyRefusal() {
    return [
      ...COMPETING.map((surface) => ({ kind: 'writeSurfaceOpen', surface }) as const),
      { kind: 'readOnly' } as const,
      { kind: 'noCandidate' } as const,
      { kind: 'targetMoved' } as const,
      { kind: 'inFlight' } as const,
      { kind: 'externalConflict' } as const,
      { kind: 'conflictShowing' } as const,
      { kind: 'observationRetained' } as const,
      { kind: 'alreadyRestored' } as const
    ];
  } // End of function everyRefusal()

  it('maps every code to a key of its own', () => {
    const keys = everyRefusal().map(restoreRefusalKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      // Restore's own sentences, plus the two shared external-conflict sentences
      // the two Phase 2d-6-5 codes render — no key of their own, deliberately.
      expect(
        key.startsWith('browser.restore.refused.') || key.startsWith('browser.externalConflict.'),
        key
      ).toBe(true);
    }
    expect(restoreRefusalKey({ kind: 'externalConflict' })).toBe('browser.externalConflict.fileChangedWhileOpen');
    expect(restoreRefusalKey({ kind: 'observationRetained' })).toBe('browser.externalConflict.observationRetained');
  });

  it.each(LOCALES)('all read as a sentence in %s, and are translated', (locale) => {
    const keys = everyRefusal().map(restoreRefusalKey);
    for (const key of keys) {
      const value = DICTIONARIES[locale][key];
      expect(value.trim().split(/\s+/u).length, `${locale}:${key}`).toBeGreaterThan(4);
      expect(value.trim().endsWith('.'), `${locale}:${key}`).toBe(true);
      expect(DICTIONARIES.es[key], key).not.toBe(DICTIONARIES.en[key]);
    } // End of the loop over every refusal sentence
  }); // End of the "read as a sentence" case

  it('names no placeholder, because none of these codes carries an operand', () => {
    for (const locale of LOCALES) {
      for (const key of everyRefusal().map(restoreRefusalKey)) {
        expect(DICTIONARIES[locale][key], `${locale}:${key}`).not.toMatch(/\{[A-Za-z]/u);
      }
    } // End of the loop over the two locales
  });

  it('makes none of the claims consult Q6 forbids', () => {
    // **What this checks and what it cannot.** It checks that a fixed list of words
    // does not appear in restore's own sentences or in the two shared ones this step
    // added: a batch name is not a time, a recognised batch is not an authentic one,
    // nothing here is an undo, and nothing promises recoverability. It cannot check
    // that the sentences say something true instead — no suite in this repository
    // pins meaning (`CLAUDE.md` section 6).
    const forbidden: Readonly<Record<(typeof LOCALES)[number], readonly string[]>> = {
      en: [
        'undo',
        'taken at',
        'version from',
        'authentic',
        'verified',
        'untampered',
        'recoverable',
        'safe backup',
        'older than',
        'newer than',
        'previous version',
        'original version'
      ],
      es: [
        'deshacer',
        'tomada el',
        'tomado el',
        'auténtic',
        'verificad',
        'recuperable',
        'copia segura',
        'más antigua que',
        'más reciente que',
        'versión anterior',
        'versión original'
      ]
    };
    const keys: readonly TranslationKey[] = [
      ...everyRefusal().map(restoreRefusalKey),
      'browser.saveOutcome.operation.replaceFileFromBackup',
      'browser.saveOutcome.reloadRetargetsCandidate'
    ];
    for (const locale of LOCALES) {
      for (const key of keys) {
        const value = DICTIONARIES[locale][key].toLowerCase();
        const claimed = forbidden[locale].filter((word) => value.includes(word));
        expect(claimed, `${locale}:${key}`).toEqual([]);
      } // End of the loop over every sentence this step owns
    } // End of the loop over the two locales
  }); // End of the "no forbidden claim" case

  it('claims nothing about what was sent where the predicate cannot know', () => {
    // **The review's M3.** `targetMoved` means only that the window's projection of
    // the destination is missing or is not the one this session was measured
    // against. That is reachable *after* a send — after an uncertain `mayHaveWritten`
    // answer, or after a `committed: false` success followed by another projection
    // change — so the sentence may say what cannot be prepared or confirmed now and
    // must say nothing about what did or did not reach the file.
    const claims: Readonly<Record<(typeof LOCALES)[number], readonly string[]>> = {
      en: ['was sent', 'sent nothing', 'wrote nothing', 'nothing was written', 'was not written'],
      es: ['no ha enviado', 'no se ha enviado', 'no envió', 'no escribió', 'no se escribió']
    };
    for (const locale of LOCALES) {
      const value = DICTIONARIES[locale]['browser.restore.refused.targetMoved'].toLowerCase();
      expect(claims[locale].filter((claim) => value.includes(claim)), locale).toEqual([]);
    } // End of the loop over the two locales
    // The search fires: the conflict refusal *does* carry the claim, and there its
    // predicate — the transaction refused at its own locked read — supports it.
    expect(DICTIONARIES.en['browser.restore.refused.conflictShowing'].toLowerCase()).toContain(
      'wrote nothing'
    );
    expect(DICTIONARIES.es['browser.restore.refused.conflictShowing'].toLowerCase()).toContain(
      'no escribió'
    );
  }); // End of the "claims nothing about what was sent" case

  it('keeps that word list capable of firing', () => {
    // A list that matches nothing passes the case above for a reason that has
    // nothing to do with the dictionary. These are sentences elsewhere in the
    // application that really do contain the words.
    expect(DICTIONARIES.en['browser.rawEditor.undo'].toLowerCase()).toContain('undo');
    expect(DICTIONARIES.es['browser.rawEditor.undo'].toLowerCase()).toContain('deshacer');
  }); // End of the "capable of firing" case
}); // End of the "sentences behind the codes" suite

describe('the external session — Phase 2d-6-5', () => {
  // **The receiver as a value, driven without a window.** `watched` seals every
  // envelope through the three constructors of `./observationDelivery.ts`;
  // `workspace.test.ts` drives this same transition through a real `BrowserState`.
  // Nothing here can show a component registers the receiver — 2d-6-8 wires it —
  // and nothing here calls a command: no `BrowserState` exists in this file.

  /**
   * The external conflict a session shows, or a failure naming the case.
   *
   * @param held - The session.
   * @returns Its external conflict.
   */
  function externalOf(held: RestoreSession): ExternalConflictModel<string> {
    const conflict = held.externalConflict;
    if (conflict === null) {
      throw new Error('this case needs an external conflict on the session');
    }
    return conflict;
  } // End of function externalOf()

  /**
   * A session whose replacement was refused for findings — the refusal path.
   *
   * @returns The session showing the refusal.
   */
  async function refusedOnce(): Promise<RestoreSession> {
    const { session } = await roundTrip(pending(), refusal());
    expect(session.outcome?.kind).toBe('refused');
    return session;
  } // End of function refusedOnce()

  /**
   * A session whose replacement met a save conflict — the save origin.
   *
   * @returns The session showing the save conflict.
   */
  async function saveConflicted(): Promise<RestoreSession> {
    const { session } = await roundTrip(pending(), conflictResult(ELSEWHERE));
    return session;
  } // End of function saveConflicted()

  /**
   * A holder standing in for the component's `$state`: what a registered
   * receiver would update, and what the reader answers.
   *
   * @param first - The session installed at the start.
   * @returns The holder, its reader, and a receiver that applies to it.
   */
  function installed(first: RestoreSession): {
    current: () => RestoreSession;
    receive: (delivery: ObservationDelivery) => void;
    set: (next: RestoreSession) => void;
  } {
    let session = first;
    return {
      current: () => session,
      receive: (delivery) => {
        session = applyRestoreObservation(session, delivery);
      },
      set: (next) => {
        session = next;
      }
    };
  } // End of function installed()

  describe('the seven arms over a session opened over one destination (entries 6, 8, 11, 12)', () => {
    it('raises over the destination, keeps the candidate, withdraws the question and its consent, and refuses all three doors', () => {
      const asked = pending();
      expect(asked.pending).not.toBeNull();
      const seen = watched.observation();
      const next = applyRestoreObservation(asked, watched.raised(seen));
      const conflict = externalOf(next);
      expect(conflict.source).toBe(externalConflictSource(seen));
      expect(conflict.diskText).toBe(DISK);
      expect(conflict.diskRevision).toBe(ELSEWHERE);
      expect(isExternalConflict(conflict)).toBe(true);
      expect(conflictOf(next)).toBe(conflict);
      // The retained candidate's draft, byte for byte, and the candidate itself
      // untouched (entry 23's "candidate" — retention across a replacing verdict).
      expect(conflict.draft.value).toBe(CANDIDATE);
      expect(candidateText(next.preview!)).toBe(CANDIDATE);
      expect(next.preview!.draft.baseRevision).toBe(BASE);
      expect(next.baseRevision).toBe(BASE);
      expect(next.entry).toEqual(asked.entry);
      expect(next.batch).toEqual(asked.batch);
      // `outcome` is untouched: no replacement ended (entry 6).
      expect(next.outcome).toBeNull();
      // Entry 12: the question is withdrawn — presented by nobody and authorized
      // for nobody, the caller's retained session included — its consent gone
      // and the preview generation moved.
      expect(next.pending).toBeNull();
      expect(confirmRestore(next, at(BASE))).toBeNull();
      expect(confirmRestore(asked, at(BASE))).toBeNull();
      expect(next.previewGeneration).toBeGreaterThan(asked.previewGeneration);
      expect(next.preview!.draft.consent).toBeNull();
      // Entry 8, all three doors: preparation, confirmation and the final permit.
      expect(restoreRefusal(next, at(BASE))).toEqual({ kind: 'externalConflict' });
      expect(prepareRestore(next, at(BASE))).toBe(next);
      const byHand: RestoreSession = { ...next, pending: asked.pending };
      expect(confirmRestore(byHand, at(BASE))).toBeNull();
      const view = restoreView(next, at(BASE));
      expect(view.canPrepare).toBe(false);
      expect(view.confirming).toBe(false);
      expect(view.refusal).toEqual({ kind: 'externalConflict' });
      expect(view.conflict).toBe(conflict);
      expect(view.externalMessages).toBe(conflict.messages);
      expect(view.externalMessages.map((line) => line.kind)).toEqual([
        'fileChangedWhileOpen',
        'operationKeptInMemory',
        'reloadRetargetsCandidate'
      ]);
      expect(view.messages).toEqual([]);
      expect(view.externalNotices).toEqual([]);
      expect(view.preview).toBe(next.preview);
      expect(view.conflictOperation).toBe('replaceFileFromBackup');
      expect(view.diskText).toEqual({ kind: 'text', text: DISK });
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'reloadDiskVersion']);
    }); // End of the "raised over the destination" case

    it('refuses the final permit directly under an external conflict, and sends nothing', async () => {
      // **Past a disabled button, at the last door.** A confirmation minted
      // before the conflict, handed to the send beside a session that now
      // carries one, is consumed unspent; the sender is never called.
      const started = confirmRestore(pending(), at(BASE));
      if (started === null) {
        throw new Error('a pending restore confirms');
      }
      const seen = watched.observation();
      const blocked: RestoreSession = {
        ...started.session,
        externalConflict: externalOf(applyRestoreObservation(withCandidate(), watched.raised(seen)))
      };
      const send = sender();
      expect(await sendRestore(started, blocked, at(BASE), send)).toEqual({ kind: 'withdrawn' });
      expect(send).not.toHaveBeenCalled();
      // Consumed: the same confirmation sends nothing afterwards either.
      expect(await sendRestore(started, started.session, at(BASE), send)).toEqual({ kind: 'notAttempted' });
      expect(send).not.toHaveBeenCalled();
    }); // End of the "final permit under an external conflict" case

    it('answers the same session from prepareRestore under an external conflict, refusal path included', async () => {
      // The refusal panel's *Save anyway* would consent and prepare; the consent
      // is recorded and the preparation refused, so nothing is sendable.
      const blocked = applyRestoreObservation(await refusedOnce(), watched.raised(watched.observation()));
      expect(blocked.outcome?.kind).toBe('refused');
      const view = restoreView(blocked, at(BASE));
      expect(view.refusalChoices).toEqual(['keepEditing']);
      expect(prepareRestore(acknowledgeRestoreFindings(blocked), at(BASE)).pending).toBeNull();
    });

    it('raises over a session with no candidate, over a placeholder draft, and says the file first', () => {
      // A destination told of a change before any entry was read: the block
      // applies and the reload is the way out; the draft the model must carry is
      // the documented placeholder and never a candidate.
      const empty = startRestore(target());
      const next = applyRestoreObservation(empty, watched.raised(watched.observation()));
      const conflict = externalOf(next);
      expect(conflict.draft.value).toBe('');
      expect(conflict.draft.baseRevision).toBe(BASE);
      expect(next.preview).toBeNull();
      expect(restoreRefusal(next, at(BASE))).toEqual({ kind: 'externalConflict' });
      expect(restoreView(next, at(BASE)).preview).toBeNull();
      // The reload retargets the session with nothing to keep, and a candidate
      // read afterwards is measured against the adopted revision.
      const reloaded = reloadTheDiskVersion(confirmDiskReload(askToReloadDiskVersion(next)), adopting().adopt);
      expect(reloaded.baseRevision).toBe(ELSEWHERE);
      expect(reloaded.externalConflict).toBeNull();
      expect(restoreRefusal(reloaded, at(ELSEWHERE))).toEqual({ kind: 'noCandidate' });
    }); // End of the "no candidate" case

    it('takes nothing from a delivery about another file, except the end of a wait recorded for it', () => {
      const over = pending();
      const elsewhere = watched.otherObservation();
      expect(applyRestoreObservation(over, watched.raised(elsewhere))).toBe(over);
      expect(applyRestoreObservation(over, retainedDelivery(elsewhere))).toBe(over);
      expect(applyRestoreObservation(over, watched.decided(null, elsewhere, true, 'raisedWithoutReload'))).toBe(over);
      // The question survived every one of them, authorization included.
      expect(confirmRestore(over, at(BASE))).not.toBeNull();
      const waiting: RestoreSession = {
        ...withCandidate(),
        awaitingReconciliation: new Map([[TARGET + 1, elsewhere]])
      };
      expect(applyRestoreObservation(waiting, writtenHereDelivery(elsewhere)).awaitingReconciliation.size).toBe(0);
      expect(applyRestoreObservation(waiting, watched.raised(elsewhere))).toEqual({
        ...waiting,
        awaitingReconciliation: new Map()
      });
      expect(restoreRefusal(waiting, at(BASE))).toBeNull();
    });

    it('takes a delivery on a spent session, where the conflict stands beside the success and nothing is sendable', async () => {
      // The deleter's rule for a session a commit spent: the conflict is
      // recorded, the committed outcome stays, and the doors refuse for the
      // commit before they refuse for the conflict.
      const { session } = await roundTrip(pending(), saved());
      expect(session.restored).toBe(true);
      const seen = watched.observation({ previousRevision: AFTER });
      const told = applyRestoreObservation(session, watched.raised(seen));
      expect(told.outcome?.kind).toBe('saved');
      expect(told.restored).toBe(true);
      expect(externalOf(told).source).toBe(externalConflictSource(seen));
      expect(restoreRefusal(told, at(AFTER))).toEqual({ kind: 'alreadyRestored' });
      expect(prepareRestore(told, at(AFTER))).toBe(told);
      const waiting = applyRestoreObservation(session, retainedDelivery(seen));
      expect(waiting.awaitingReconciliation.get(TARGET)).toBe(seen);
      expect(waiting.restored).toBe(true);
    });

    it('withdraws the question on every replacing verdict, and carries it on coalesced, notLater and a wait', () => {
      const seen = watched.observation();
      // A fresh question per verdict, because a withdrawal revokes the *argument*:
      // the caller's retained session authorizes nothing afterwards either.
      const raisedOver = pending();
      expect(applyRestoreObservation(raisedOver, watched.raised(seen)).pending).toBeNull();
      expect(confirmRestore(raisedOver, at(BASE))).toBeNull();
      const withheldOver = pending();
      expect(applyRestoreObservation(withheldOver, watched.decided(null, seen, true, 'raisedWithoutReload')).pending).toBeNull();
      expect(confirmRestore(withheldOver, at(BASE))).toBeNull();
      const standing = externalConflictSource(watched.observation({ sequence: 1, diskRevision: AGAIN }));
      const supersededOver = pending();
      expect(applyRestoreObservation(supersededOver, watched.decided(standing, seen, false, 'supersedes')).pending).toBeNull();
      expect(confirmRestore(supersededOver, at(BASE))).toBeNull();
      // A verdict that changes nothing about the file changes nothing about the
      // question either: the session is the object it was, authorization included.
      const asked = pending();
      const sameBytes = externalConflictSource(watched.observation({ sequence: 1 }));
      const coalesced = applyRestoreObservation(asked, watched.decided(sameBytes, seen, false, 'coalesced'));
      expect(coalesced).toBe(asked);
      const later = externalConflictSource(watched.observation({ sequence: 9 }));
      expect(applyRestoreObservation(asked, watched.decided(later, seen, false, 'notLater'))).toBe(asked);
      expect(restoreView(asked, at(BASE)).confirming).toBe(true);
      expect(confirmRestore(asked, at(BASE))).not.toBeNull();
      // A wait carries the question to the successor and blocks the doors until
      // it lifts; the same question then confirms.
      const waiting = applyRestoreObservation(pending(), retainedDelivery(seen));
      expect(waiting.pending).not.toBeNull();
      expect(restoreView(waiting, at(BASE)).confirming).toBe(true);
      expect(confirmRestore(waiting, at(BASE))).toBeNull();
      const lifted = applyRestoreObservation(waiting, writtenHereDelivery(seen));
      expect(lifted.pending).toBe(waiting.pending);
      expect(confirmRestore(lifted, at(BASE))).not.toBeNull();
      // And the one it was carried from authorizes nothing any more.
      expect(confirmRestore(waiting, at(BASE))).toBeNull();
    }); // End of the "question withdrawn or carried" case
  }); // End of the "seven arms" suite

  describe('the held observation, and writtenHere by identity (entries 8 and 11)', () => {
    it('records a wait as a restriction on the three doors, and lifts it only for that observation', async () => {
      const seen = watched.observation();
      const waiting = applyRestoreObservation(withCandidate(), retainedDelivery(seen));
      expect(waiting.awaitingReconciliation.get(TARGET)).toBe(seen);
      expect(waiting.awaitingReconciliation.size).toBe(1);
      expect(waiting.externalConflict).toBeNull();
      expect(conflictOf(waiting)).toBeNull();
      expect(restoreRefusal(waiting, at(BASE))).toEqual({ kind: 'observationRetained' });
      expect(prepareRestore(waiting, at(BASE))).toBe(waiting);
      const byHand: RestoreSession = { ...waiting, pending: pending().pending };
      expect(confirmRestore(byHand, at(BASE))).toBeNull();
      // The final permit, with a session that carries the wait beside a
      // confirmation minted before it.
      const started = confirmRestore(pending(), at(BASE));
      const send = sender();
      expect(await sendRestore(started, { ...started!.session, awaitingReconciliation: waiting.awaitingReconciliation }, at(BASE), send)).toEqual({ kind: 'withdrawn' });
      expect(send).not.toHaveBeenCalled();
      const view = restoreView(waiting, at(BASE));
      expect(view.canPrepare).toBe(false);
      expect(view.refusal).toEqual({ kind: 'observationRetained' });
      expect(view.conflict).toBeNull();
      expect(view.externalNotices).toEqual([{ kind: 'observationRetained' }]);
      // The catalogue and the candidate stay free to change, and carry the wait.
      expect(chooseBatch(waiting, OTHER_BATCH).awaitingReconciliation.get(TARGET)).toBe(seen);
      expect(targetRevisionObserved(waiting, AGAIN).awaitingReconciliation.get(TARGET)).toBe(seen);
      // Lifted by identity, and by nothing else.
      expect(applyRestoreObservation(waiting, writtenHereDelivery(watched.observation())).awaitingReconciliation.get(TARGET)).toBe(seen);
      const lifted = applyRestoreObservation(waiting, writtenHereDelivery(seen));
      expect(lifted).toEqual({ ...waiting, awaitingReconciliation: new Map() });
      expect(restoreRefusal(lifted, at(BASE))).toBeNull();
      expect(applyRestoreObservation(lifted, writtenHereDelivery(seen))).toBe(lifted);
      // Any decision about the awaited observation ends the wait; a later
      // `retained` replaces it; a re-held reading is still held.
      const standing = externalConflictSource(watched.observation({ sequence: 9 }));
      expect(applyRestoreObservation(waiting, watched.decided(standing, seen, false, 'notLater'))).toEqual({
        ...waiting,
        awaitingReconciliation: new Map()
      });
      expect(applyRestoreObservation(waiting, watched.raised(seen)).awaitingReconciliation.size).toBe(0);
      const newer = watched.observation({ sequence: 7 });
      expect(applyRestoreObservation(waiting, retainedDelivery(newer)).awaitingReconciliation.get(TARGET)).toBe(newer);
      expect(applyRestoreObservation(waiting, retainedDelivery(seen)).awaitingReconciliation.get(TARGET)).toBe(seen);
    }); // End of the "retained and writtenHere" case

    it('holds every delivery during its own replacement and replays them in arrival order (entry 5)', async () => {
      const started = confirmRestore(pending(), at(BASE));
      if (started === null) {
        throw new Error('a pending restore confirms');
      }
      const seen = watched.observation();
      const later = watched.observation({ sequence: 6 });
      const standing = externalConflictSource(seen);
      const held = applyRestoreObservation(
        applyRestoreObservation(applyRestoreObservation(started.session, retainedDelivery(seen)), watched.raised(seen)),
        watched.decided(standing, later, false, 'coalesced')
      );
      expect(held.externalConflict).toBeNull();
      expect(held.awaitingReconciliation.size).toBe(0);
      expect(held.heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained', 'raised', 'coalesced']);
      // A held envelope blocks the final permit: the send is consumed unspent.
      const send = sender();
      expect(await sendRestore(started, held, at(BASE), send)).toEqual({ kind: 'withdrawn' });
      expect(send).not.toHaveBeenCalled();
      // The withdrawal replays the held decisions: the conflict `raised` announced
      // stands, the wait `retained` recorded ended with it, and `coalesced` found
      // the conflict it was about.
      const withdrawn = restoreConfirmationWithdrawn(held);
      expect(withdrawn.phase).toBe('editing');
      expect(withdrawn.heldDeliveries).toEqual([]);
      expect(externalOf(withdrawn).source).toBe(standing);
      expect(restoreRefusal(withdrawn, at(BASE))).toEqual({ kind: 'externalConflict' });
      // The answer lands first and the replay has the last word, on a refusal, on
      // a commit — the session spent, the conflict beside the success — and on a
      // seal already opened.
      const refused = applyRestore(held, sealed(refusal()), NO_SURFACES);
      expect(refused.heldDeliveries).toEqual([]);
      expect(refused.outcome?.kind).toBe('refused');
      expect(externalOf(refused).source).toBe(standing);
      expect(restoreRefusal(refused, at(BASE))).toEqual({ kind: 'externalConflict' });
      const committed = applyRestore(held, sealed(saved()), NO_SURFACES);
      expect(committed.outcome?.kind).toBe('saved');
      expect(committed.restored).toBe(true);
      expect(externalOf(committed).source).toBe(standing);
      const twice = sealed(saved());
      applyRestore(held, twice, NO_SURFACES);
      const again = applyRestore(held, twice, NO_SURFACES);
      expect(again.phase).toBe('editing');
      expect(again.heldDeliveries).toEqual([]);
      expect(externalOf(again).source).toBe(standing);
      // A send that produced no outcome consumes the hold too.
      const heldUncertain = applyRestoreObservation(started.session, watched.decided(null, seen, true, 'raisedWithoutReload'));
      const failed = restoreCouldNotBeSent(heldUncertain, true);
      expect(failed.heldDeliveries).toEqual([]);
      expect(failed.sendFailure?.kind).toBe('mayHaveWritten');
      expect(failed.uncertaintyUnresolved).toBe(true);
      expect(externalOf(failed).source).toBe(externalConflictSource(seen));
    }); // End of the "held during the replacement" case
  }); // End of the "held observation" suite

  describe('collisions: only one conflict is active (entry 7), and the dismissal erases nothing (entry 9)', () => {
    it('retires a save conflict when an observation supersedes it, keeping the candidate and dropping the confirmation', async () => {
      const stuck = await saveConflicted();
      const saveModel = conflictOf(stuck);
      if (saveModel === null || !isSaveConflict(saveModel)) {
        throw new Error('this case starts from a save conflict');
      }
      const confirmed = confirmDiskReload(askToReloadDiskVersion(stuck));
      expect(confirmed.reload.kind).toBe('confirmed');
      const seen = watched.observation({ diskRevision: AGAIN });
      const next = applyRestoreObservation(confirmed, watched.decided(saveModel.source, seen, false, 'supersedes'));
      expect(next.outcome).toBeNull();
      expect(next.submitted).toBeNull();
      const conflict = externalOf(next);
      expect(conflict.draft).toBe(saveModel.draft);
      expect(conflict.diskRevision).toBe(AGAIN);
      expect(conflictOf(next)).toBe(conflict);
      expect(candidateText(next.preview!)).toBe(CANDIDATE);
      expect(next.baseRevision).toBe(BASE);
      // The reload is idle again and the confirmation is gone: nothing is
      // re-pointed and the window is not asked.
      expect(next.reload).toBe(NOT_RELOADING);
      expect(restoreView(next, at(BASE)).awaitingReloadConfirmation).toBe(false);
      const recorder = adopting();
      const unmoved = reloadTheDiskVersion(next, recorder.adopt);
      expect(unmoved.baseRevision).toBe(BASE);
      expect(recorder.adoptions).toEqual([]);
    }); // End of the "supersedes a save conflict" case

    it('keeps a committed success and a refusal as history, and lets a replacement that conflicts retire the external one', async () => {
      const blocked = applyRestoreObservation(await refusedOnce(), watched.raised(watched.observation()));
      expect(blocked.outcome?.kind).toBe('refused');
      expect(conflictOf(blocked)).toBe(blocked.externalConflict);
      // The reverse collision, kept for a direct call: a conflict answer retires
      // the external conflict, a refusal leaves it.
      const sending = confirmRestore(pending(), at(BASE));
      if (sending === null) {
        throw new Error('a pending restore confirms');
      }
      const carrying: RestoreSession = { ...sending.session, externalConflict: blocked.externalConflict };
      const conflicted = applyRestore(carrying, sealed(conflictResult()), NO_SURFACES);
      expect(conflicted.externalConflict).toBeNull();
      expect(conflictOf(conflicted)?.source.kind).toBe('save');
      const refusedAgain = applyRestore(carrying, sealed(refusal()), NO_SURFACES);
      expect(refusedAgain.externalConflict).toBe(blocked.externalConflict);
    }); // End of the "history and the reverse collision" case

    it('lets the dismissal cancel the warning and the panel, and nothing external (entry 9)', async () => {
      const seen = watched.observation();
      const blocked = askToReloadDiskVersion(applyRestoreObservation(await refusedOnce(), watched.raised(seen)));
      expect(restoreView(blocked, at(BASE)).awaitingReloadConfirmation).toBe(true);
      const kept = dismissRestoreOutcome(blocked);
      expect(kept.outcome).toBeNull();
      expect(kept.reload).toBe(NOT_RELOADING);
      expect(kept.externalConflict).toBe(blocked.externalConflict);
      expect(restoreRefusal(kept, at(BASE))).toEqual({ kind: 'externalConflict' });
      const withheld = applyRestoreObservation(withCandidate(), watched.decided(null, watched.observation(), true, 'raisedWithoutReload'));
      expect(dismissRestoreOutcome(withheld).uncertaintyUnresolved).toBe(true);
      const waiting = applyRestoreObservation(withCandidate(), retainedDelivery(seen));
      expect(dismissRestoreOutcome(waiting).awaitingReconciliation.get(TARGET)).toBe(seen);
      expect(restoreRefusal(dismissRestoreOutcome(waiting), at(BASE))).toEqual({ kind: 'observationRetained' });
    }); // End of the "dismissal erases nothing" case
  }); // End of the "collisions" suite

  describe('the uncertainty and its exits (entries 11, 14, 15; the record’s §5.5)', () => {
    it('withholds the reload on raisedWithoutReload until the snapshot is acknowledged', () => {
      const seen = watched.observation();
      const withheld = applyRestoreObservation(pending(), watched.decided(null, seen, true, 'raisedWithoutReload'));
      expect(withheld.uncertaintyUnresolved).toBe(true);
      expect(withheld.pending).toBeNull();
      const view = restoreView(withheld, at(BASE));
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing']);
      expect(view.externalNotices).toEqual([{ kind: 'writeOutcomeUnknown' }]);
      expect(askToReloadDiskVersion(withheld)).toBe(withheld);
      // A confirmation assembled by hand spends nothing and re-points nothing.
      const recorder = adopting();
      const byHand: RestoreSession = { ...withheld, reload: confirmDiskReload(askToReloadDiskVersion(withheld.externalConflict === null ? withheld : { ...withheld, uncertaintyUnresolved: false })).reload };
      expect(reloadTheDiskVersion(byHand, recorder.adopt).baseRevision).toBe(BASE);
      expect(recorder.adoptions).toEqual([]);
      // Exit three: the acknowledgement, refused and then accepted.
      const asked: ExternalChangeConflictSource[] = [];
      expect(
        acknowledgeRestoreSnapshot(withheld, (source) => {
          asked.push(source);
          return 'refused';
        })
      ).toBe(withheld);
      expect(asked).toEqual([externalOf(withheld).source]);
      const acknowledged = acknowledgeRestoreSnapshot(withheld, () => 'acknowledged');
      expect(acknowledged).toEqual({ ...withheld, uncertaintyUnresolved: false, reload: NOT_RELOADING });
      expect(restoreView(acknowledged, at(BASE)).conflictChoices).toContain('reloadDiskVersion');
      expect(restoreView(askToReloadDiskVersion(acknowledged), at(BASE)).awaitingReloadConfirmation).toBe(true);
      // Nothing to acknowledge asks nothing.
      let askedWithoutCause = 0;
      const plain = applyRestoreObservation(withCandidate(), watched.raised(seen));
      expect(
        acknowledgeRestoreSnapshot(plain, () => {
          askedWithoutCause += 1;
          return 'acknowledged';
        })
      ).toBe(plain);
      expect(askedWithoutCause).toBe(0);
    }); // End of the "raisedWithoutReload" case

    it('clears the uncertainty when a later verdict under none replaces the conflict', () => {
      const first = watched.observation();
      const withheld = applyRestoreObservation(withCandidate(), watched.decided(null, first, true, 'raisedWithoutReload'));
      const later = watched.observation({ sequence: 6, diskRevision: AGAIN });
      const replaced = applyRestoreObservation(withheld, watched.decided(externalConflictSource(first), later, false, 'supersedes'));
      expect(replaced.uncertaintyUnresolved).toBe(false);
      expect(externalOf(replaced).source).toBe(externalConflictSource(later));
      expect(restoreView(replaced, at(BASE)).conflictChoices).toContain('reloadDiskVersion');
    });
  }); // End of the "uncertainty" suite

  describe('the retargeting reload from an observation, consent, and the three adoption outcomes (entries 12, 23)', () => {
    it('re-points the kept candidate at the observation’s disk revision when the window installs it, and confirms again from there', async () => {
      const seen = watched.observation();
      const stuck = applyRestoreObservation(pending(), watched.raised(seen));
      const confirmed = confirmDiskReload(askToReloadDiskVersion(stuck));
      expect(restoreView(confirmed, at(BASE)).conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'confirmReloadKeeping']);
      const { adopt, adoptions } = adopting('installed');
      const reloaded = reloadTheDiskVersion(confirmed, adopt);
      expect(adoptions).toEqual([externalOf(stuck)]);
      // The candidate stays; what moves is the revision it is measured against.
      expect(candidateText(reloaded.preview!)).toBe(CANDIDATE);
      expect(reloaded.baseRevision).toBe(ELSEWHERE);
      expect(reloaded.preview!.draft.baseRevision).toBe(ELSEWHERE);
      expect(reloaded.externalConflict).toBeNull();
      expect(reloaded.uncertaintyUnresolved).toBe(false);
      expect(reloaded.outcome).toBeNull();
      expect(reloaded.pending).toBeNull();
      expect(reloaded.reload).toBe(NOT_RELOADING);
      expect(restoreRefusal(reloaded, at(ELSEWHERE))).toBeNull();
      // And a fresh confirmation sends the same bytes against the adopted revision.
      const send = sender();
      await confirmAndSend(prepareRestore(reloaded, at(ELSEWHERE)), at(ELSEWHERE, []), send);
      expect(send).toHaveBeenCalledWith(TARGET, ELSEWHERE, CANDIDATE, { accepted: [] });
      expect(reloaded.previewGeneration).toBeGreaterThan(confirmed.previewGeneration);
    }); // End of the "re-points the kept candidate" case

    it('withdraws consent on the verdict: an acknowledgement for one transaction cannot be spent after a retarget', async () => {
      const consented = acknowledgeRestoreFindings(await refusedOnce());
      expect(submissionOf(consented.preview!.draft).acknowledgement.accepted).toHaveLength(1);
      const seen = watched.observation();
      const blocked = applyRestoreObservation(consented, watched.raised(seen));
      // The refusal stays as history; the consent went with the withdrawal.
      expect(blocked.outcome?.kind).toBe('refused');
      expect(submissionOf(blocked.preview!.draft).acknowledgement.accepted).toEqual([]);
      expect(candidateText(blocked.preview!)).toBe(CANDIDATE);
      const reloaded = reloadTheDiskVersion(confirmDiskReload(askToReloadDiskVersion(blocked)), adopting().adopt);
      expect(submissionOf(reloaded.preview!.draft).acknowledgement.accepted).toEqual([]);
      const send = sender();
      await confirmAndSend(prepareRestore(reloaded, at(ELSEWHERE)), at(ELSEWHERE, []), send);
      expect(send).toHaveBeenCalledWith(TARGET, ELSEWHERE, CANDIDATE, { accepted: [] });
    }); // End of the "consent withdrawn" case

    it('answers every adoption outcome for the external origin', () => {
      const seen = watched.observation();
      const confirmed = confirmDiskReload(askToReloadDiskVersion(applyRestoreObservation(withCandidate(), watched.raised(seen))));
      // `installed` and `alreadyThere` both re-point.
      for (const answer of ['installed', 'alreadyThere'] as const) {
        const recorder = adopting(answer);
        const reloaded = reloadTheDiskVersion(confirmed, recorder.adopt);
        expect(recorder.adoptions).toHaveLength(1);
        expect(reloaded.baseRevision).toBe(ELSEWHERE);
        expect(candidateText(reloaded.preview!)).toBe(CANDIDATE);
        expect(reloaded.externalConflict).toBeNull();
        expect(reloaded.reload).toBe(NOT_RELOADING);
      } // End of the loop over the two satisfied answers
      // `refused` moves nothing and stops offering the control; the conflict
      // stands, and the dismissal resets the step for a fresh attempt.
      const recorder = adopting('refused');
      const refused = reloadTheDiskVersion(confirmed, recorder.adopt);
      expect(recorder.adoptions).toHaveLength(1);
      expect(refused.baseRevision).toBe(BASE);
      expect(refused.preview).toBe(confirmed.preview);
      expect(refused.reload).toEqual({ kind: 'refused' });
      expect(externalOf(refused).source).toBe(externalConflictSource(seen));
      const view = restoreView(refused, at(BASE));
      expect(view.reloadUnavailable).toBe(true);
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing']);
      expect(dismissRestoreOutcome(refused).reload).toBe(NOT_RELOADING);
      expect(externalOf(dismissRestoreOutcome(refused)).source).toBe(externalConflictSource(seen));
      // A wait about another observation survives the retarget: an adoption
      // decides nothing about it.
      const waitingToo = applyRestoreObservation(confirmed, retainedDelivery(watched.observation({ sequence: 8 })));
      const reloadedWaiting = reloadTheDiskVersion(waitingToo, adopting().adopt);
      expect(reloadedWaiting.baseRevision).toBe(ELSEWHERE);
      expect(reloadedWaiting.awaitingReconciliation.size).toBe(1);
      expect(restoreRefusal(reloadedWaiting, at(ELSEWHERE))).toEqual({ kind: 'observationRetained' });
    }); // End of the "three adoption outcomes" case

    it('reapplies nothing for a conflict of either origin, and takes no adoption function (entry 22)', async () => {
      const seen = watched.observation({
        correspondences: { base_revision: BASE, disk_revision: ELSEWHERE, entries: [] }
      });
      expect(reapplyToDiskVersion(applyRestoreObservation(withCandidate(), watched.raised(seen)))).toEqual({ kind: 'unavailable' });
      expect(reapplyToDiskVersion(await saveConflicted())).toEqual({ kind: 'unavailable' });
      expect(reapplyToDiskVersion(withCandidate())).toEqual({ kind: 'unavailable' });
      expect(reapplyToDiskVersion).toHaveLength(1);
    });
  }); // End of the "retargeting reload" suite

  describe('the doors and the settlement against the installed session (2d-6-4’s review, taken)', () => {
    it('asks and confirms nothing when a context read displaced the installed session', () => {
      // A getter behind the context's revision is caller code that runs between
      // the block and the spend; a window's receiver, run from it, replaces the
      // installed session with one carrying an external conflict. The
      // preparation answers the installed session and registers no question; the
      // confirmation answers null and spends nothing.
      const holder = installed(withCandidate());
      const handedIn = holder.current();
      const seen = watched.observation();
      const context: RestoreContext = {
        get observed(): ContentRevision {
          holder.receive(watched.raised(seen));
          return BASE;
        },
        surfaces: []
      };
      const answered = prepareRestore(handedIn, context, holder.current);
      expect(answered).toBe(holder.current());
      expect(answered.pending).toBeNull();
      expect(externalOf(answered).source).toBe(externalConflictSource(seen));
      expect(confirmRestore(handedIn, at(BASE))).toBeNull();
      // The same for the confirmation: the question is not spent on the session
      // handed in, and the receiver's replacing verdict withdrew it anyway.
      const asking = installed(pending());
      const asked = asking.current();
      const trapping: RestoreContext = {
        get observed(): ContentRevision {
          asking.receive(watched.raised(seen));
          return BASE;
        },
        surfaces: []
      };
      expect(confirmRestore(asked, trapping, asking.current)).toBeNull();
      expect(asking.current().pending).toBeNull();
      expect(externalOf(asking.current()).source).toBe(externalConflictSource(seen));
      // The same read that displaces nothing asks and spends as before.
      const quiet = installed(withCandidate());
      const prepared = prepareRestore(quiet.current(), at(BASE), quiet.current);
      expect(prepared.pending).not.toBeNull();
      quiet.set(prepared);
      expect(confirmRestore(quiet.current(), at(BASE), quiet.current)).not.toBeNull();
    }); // End of the "displaced during the context read" case

    it('answers the installed session from every refusal of the preparation, never the session handed in (the review’s second blocker)', () => {
      // **A refusal is a return path too.** The preparation refuses after it has
      // read the preview, the context and the submission; a receiver run from a
      // getter behind any of those has replaced the installed session, and a
      // refusal that answered its argument would have the caller's
      // `session = prepareRestore(session, …)` overwrite what the receiver
      // installed. Three refusals, one rule: the installed session is answered.
      const seen = watched.observation();
      // The context read, refused `targetMoved` by the very read that delivered.
      const moved = installed(withCandidate());
      const movedIn = moved.current();
      const movedContext: RestoreContext = {
        get observed(): ContentRevision {
          moved.receive(watched.raised(seen));
          return AFTER;
        },
        surfaces: []
      };
      const answeredMoved = prepareRestore(movedIn, movedContext, moved.current);
      expect(answeredMoved).toBe(moved.current());
      expect(externalOf(answeredMoved).source).toBe(externalConflictSource(seen));
      // The surfaces read, refused `writeSurfaceOpen` by the read that delivered.
      const competing = installed(withCandidate());
      const competingIn = competing.current();
      const competingContext: RestoreContext = {
        observed: BASE,
        get surfaces(): readonly OpenWriteSurface[] {
          competing.receive(watched.raised(seen));
          return [{ kind: 'rawEditor', target: { kind: 'document', document: TARGET } }];
        }
      };
      expect(prepareRestore(competingIn, competingContext, competing.current)).toBe(competing.current());
      // The submission read, refused because the draft's base disagrees with
      // the session's — a hand-built shape — by a value read that delivered.
      const disagreeing = installed(withCandidate());
      const disagreeingIn = disagreeing.current();
      const preview = disagreeingIn.preview!;
      const trapped: RestoreSession = {
        ...disagreeingIn,
        preview: {
          ...preview,
          draft: {
            ...preview.draft,
            baseRevision: AFTER,
            get value(): string {
              disagreeing.receive(watched.raised(seen));
              return CANDIDATE;
            }
          }
        }
      };
      disagreeing.set(trapped);
      expect(prepareRestore(trapped, at(BASE), disagreeing.current)).toBe(disagreeing.current());
      expect(externalOf(disagreeing.current()).source).toBe(externalConflictSource(seen));
      // The preview read itself, answering nothing after it delivered. Armed
      // once: the receiver's own withdrawal reads it again.
      const emptied = installed(withCandidate());
      const emptiedIn = emptied.current();
      let armed = true;
      const previewTrapped: RestoreSession = {
        ...emptiedIn,
        get preview(): RestorePreview | null {
          if (armed) {
            armed = false;
            emptied.receive(watched.raised(seen));
          }
          return null;
        }
      };
      emptied.set(previewTrapped);
      expect(prepareRestore(previewTrapped, at(BASE), emptied.current)).toBe(emptied.current());
      // A refusal that displaced nothing still answers its argument.
      const still = installed(withCandidate());
      expect(prepareRestore(still.current(), at(AFTER), still.current)).toBe(still.current());
    }); // End of the "installed session from every refusal" case

    it('retargets over the installed session, and answers it untouched when the adoption itself replaced the conflict (the review’s third finding)', () => {
      // **The adoption runs the window's own reads of the observation's
      // projection**, and a getter there can tell the window of a later reading;
      // the receiver installs what the window decides while the adoption is
      // still inside `adopt`. A retarget built over the session handed in would
      // hand the caller a session with no record of that decision.
      const seen = watched.observation();
      /**
       * A holder over a session confirmed to reload from `seen`.
       *
       * @returns The holder.
       */
      function confirmedToReload(): ReturnType<typeof installed> {
        return installed(confirmDiskReload(askToReloadDiskVersion(applyRestoreObservation(withCandidate(), watched.raised(seen)))));
      } // End of function confirmedToReload()
      // A wait recorded during a satisfied adoption is carried by the retarget.
      const waiting = confirmedToReload();
      const later = watched.observation({ sequence: 8 });
      const recorder = adopting('installed');
      const retargeted = reloadTheDiskVersion(
        waiting.current(),
        (conflict, confirmation) => {
          waiting.receive(retainedDelivery(later));
          return recorder.adopt(conflict, confirmation);
        },
        waiting.current
      );
      expect(recorder.adoptions).toHaveLength(1);
      expect(retargeted.baseRevision).toBe(ELSEWHERE);
      expect(candidateText(retargeted.preview!)).toBe(CANDIDATE);
      expect(retargeted.externalConflict).toBeNull();
      expect(retargeted.awaitingReconciliation.get(TARGET)).toBe(later);
      expect(restoreRefusal(retargeted, at(ELSEWHERE))).toEqual({ kind: 'observationRetained' });
      // A supersession delivered during the adoption, which the window then
      // refuses: the installed session — the newer conflict, its reload reset —
      // is answered untouched, and nothing is re-pointed over it.
      const superseded = confirmedToReload();
      const newer = watched.observation({ sequence: 6, diskRevision: AGAIN });
      const refusing = adopting('refused');
      const answered = reloadTheDiskVersion(
        superseded.current(),
        (conflict, confirmation) => {
          superseded.receive(watched.decided(externalConflictSource(seen), newer, false, 'supersedes'));
          return refusing.adopt(conflict, confirmation);
        },
        superseded.current
      );
      expect(refusing.adoptions).toHaveLength(1);
      expect(answered).toBe(superseded.current());
      expect(externalOf(answered).source).toBe(externalConflictSource(newer));
      expect(answered.reload).toBe(NOT_RELOADING);
      expect(answered.baseRevision).toBe(BASE);
      // Displaced before the window is asked: the installed session is answered
      // and the window never asked.
      const early = confirmedToReload();
      const before = early.current();
      // Armed once: the receiver's own spread reads the step again.
      let armed = true;
      const trapped: RestoreSession = {
        ...before,
        get reload(): ReloadStep {
          if (armed) {
            armed = false;
            early.receive(retainedDelivery(later));
          }
          return before.reload;
        }
      };
      early.set(trapped);
      const untouched = adopting('installed');
      expect(reloadTheDiskVersion(trapped, untouched.adopt, early.current)).toBe(early.current());
      expect(untouched.adoptions).toEqual([]);
      expect(early.current().awaitingReconciliation.get(TARGET)).toBe(later);
      // Without a reader the transition retargets what it was handed, and says so.
      const alone = confirmedToReload();
      const lost = reloadTheDiskVersion(alone.current(), (conflict, confirmation) => {
        alone.receive(retainedDelivery(later));
        return adopting('installed').adopt(conflict, confirmation);
      });
      expect(lost.awaitingReconciliation.size).toBe(0);
    }); // End of the "retarget over the installed session" case

    it('claims no candidate for an external conflict raised over none (the review’s fourth finding)', () => {
      // **The placeholder draft is not a candidate, and the lines must not say
      // it is.** A session told of a change before any entry was read has no
      // candidate to have kept and no confirmation to have withdrawn; the two
      // lines the ordinary capabilities write say both. Only the file's own
      // line is owed, and the view claims no operation either.
      const empty = startRestore(target());
      const seen = watched.observation();
      const raised = applyRestoreObservation(empty, watched.raised(seen));
      expect(raised.preview).toBeNull();
      expect(raised.pending).toBeNull();
      const conflict = externalOf(raised);
      expect(conflict.messages.map((line) => line.kind)).toEqual(['fileChangedWhileOpen']);
      const view = restoreView(raised, at(BASE));
      expect(view.externalMessages.map((line) => line.kind)).toEqual(['fileChangedWhileOpen']);
      expect(view.conflictOperation).toBeNull();
      expect(view.conflictChoices).toEqual<readonly ConflictChoice[]>(['keepEditing', 'reloadDiskVersion']);
      // A supersession over that conflict still has no candidate to claim.
      const newer = watched.observation({ sequence: 6, diskRevision: AGAIN });
      const superseded = applyRestoreObservation(raised, watched.decided(externalConflictSource(seen), newer, false, 'supersedes'));
      expect(externalOf(superseded).messages.map((line) => line.kind)).toEqual(['fileChangedWhileOpen']);
      expect(restoreView(superseded, at(BASE)).conflictOperation).toBeNull();
      // With a candidate retained the two lines are owed, and the operation named.
      const over = applyRestoreObservation(withCandidate(), watched.raised(watched.observation()));
      expect(externalOf(over).messages.map((line) => line.kind)).toEqual([
        'fileChangedWhileOpen',
        'operationKeptInMemory',
        'reloadRetargetsCandidate'
      ]);
      expect(restoreView(over, at(BASE)).conflictOperation).toBe('replaceFileFromBackup');
    }); // End of the "no candidate claimed" case

    it('consumes the permit unspent when a permit read displaced the installed session, and sends nothing', async () => {
      const started = confirmRestore(pending(), at(BASE));
      if (started === null) {
        throw new Error('a pending restore confirms');
      }
      const holder = installed(started.session);
      const seen = watched.observation();
      // Armed once: `permitHolds` reads the revision twice, and the window hands
      // each decision out once.
      let armed = true;
      const context: RestoreContext = {
        get observed(): ContentRevision {
          if (armed) {
            armed = false;
            holder.receive(retainedDelivery(seen));
          }
          return BASE;
        },
        surfaces: []
      };
      const send = sender();
      expect(await sendRestore(started, started.session, context, send, holder.current)).toEqual({ kind: 'withdrawn' });
      expect(send).not.toHaveBeenCalled();
      // The installed session holds the delivery, and the withdrawal replays it.
      expect(holder.current().heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained']);
      const withdrawn = restoreConfirmationWithdrawn(started.session, holder.current);
      expect(withdrawn.awaitingReconciliation.get(TARGET)).toBe(seen);
      expect(restoreRefusal(withdrawn, at(BASE))).toEqual({ kind: 'observationRetained' });
    }); // End of the "displaced during the permit read" case

    it('settles against the installed session and replays a delivery that arrived during its own replay', () => {
      // With `retained(A), raised(A)` held, a getter behind A's `document`
      // publishes B while A is being replayed; the window delivers B to the
      // installed session — still `saving`, so it is appended there — and a
      // settlement that returned only its own replay would let the caller
      // overwrite that append. The settled session must carry B.
      const started = confirmRestore(pending(), at(BASE));
      if (started === null) {
        throw new Error('a pending restore confirms');
      }
      const later = watched.observation({ sequence: 6, diskRevision: AGAIN });
      /**
       * A holder over the in-flight session with A held twice, A's `document`
       * armed to deliver B's supersession once.
       *
       * @returns The holder, the observation A, and whether the getter fired.
       */
      function armed(): {
        readonly holder: ReturnType<typeof installed>;
        readonly seen: ExternalConflictObservation;
        readonly fired: () => boolean;
      } {
        const holder = installed(started!.session);
        let live = false;
        let fired = false;
        const seen: ExternalConflictObservation = {
          ...watched.observation(),
          get document(): number {
            if (live) {
              live = false;
              fired = true;
              holder.receive(watched.decided(externalConflictSource(this), later, false, 'supersedes'));
            }
            return TARGET;
          }
        };
        holder.receive(retainedDelivery(seen));
        holder.receive(watched.raised(seen));
        expect(holder.current().heldDeliveries.map((one) => one.verdict.kind)).toEqual(['retained', 'raised']);
        live = true;
        return { holder, seen, fired: () => fired };
      } // End of function armed()
      const first = armed();
      const settled = applyRestore(first.holder.current(), sealed(refusal()), NO_SURFACES, first.holder.current);
      expect(first.fired()).toBe(true);
      expect(settled.outcome?.kind).toBe('refused');
      expect(settled.heldDeliveries).toEqual([]);
      expect(settled.awaitingReconciliation.size).toBe(0);
      expect(externalOf(settled).source).toBe(externalConflictSource(later));
      // The same through a send that produced no outcome, and through a
      // withdrawal.
      const second = armed();
      const failed = restoreCouldNotBeSent(second.holder.current(), false, second.holder.current);
      expect(failed.heldDeliveries).toEqual([]);
      expect(externalOf(failed).source).toBe(externalConflictSource(later));
      const third = armed();
      const withdrawn = restoreConfirmationWithdrawn(third.holder.current(), third.holder.current);
      expect(withdrawn.heldDeliveries).toEqual([]);
      expect(externalOf(withdrawn).source).toBe(externalConflictSource(later));
      // Without a reader the transition settles what it was handed, and says so.
      const alone = armed();
      expect(externalOf(applyRestore(alone.holder.current(), sealed(refusal()), NO_SURFACES)).source).toBe(
        externalConflictSource(alone.seen)
      );
    }); // End of the "delivery during the replay" case
  }); // End of the "against the installed session" suite
}); // End of the "external session" suite
