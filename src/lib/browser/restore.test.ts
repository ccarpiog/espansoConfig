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
  DocumentView,
  Finding,
  PresentationNote,
  RefusedResult,
  SaveResult
} from '../ipc/types';
import type { AdoptTheDiskVersion } from './editorSave';
import { makeDocument } from './fixtures';
import { sealWholeDocumentSave, type SealedWholeDocumentSave } from './invalidation';
import {
  acknowledgeRestoreFindings,
  applyRestore,
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
  loadingBatches,
  loadingEntries,
  openWriteSurfaceKey,
  prepareRestore,
  reloadTheDiskVersion,
  restoreCouldNotBeSent,
  restoreRefusal,
  restoreRefusalKey,
  restoreView,
  revisionInProjection,
  sendRestore,
  startRestore,
  targetRevisionObserved,
  type CompetingWriteSurfaceKind,
  type OpenWriteSurface,
  type OpenWriteSurfaceKind,
  type RestoreContext,
  type RestorePreview,
  type RestoreSend,
  type RestoreSession,
  type SendRestore,
  type StartedRestore
} from './restore';
import type { ConflictModel, DiskAdoptionOutcome, SaveOutcomeModel } from './saveOutcome';

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
 * What a coordinator does about every write surface over a replaced file.
 *
 * **A recorder rather than a stub**, because consult Q4's post-commit obligation is
 * that a committed replacement really closes the surfaces this window has open. The
 * list it holds is the window's; `close` is what {@link applyRestore} is handed.
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
     * Closes every surface over the replaced file, and records the invalidation.
     *
     * @param invalidation - The file that was replaced and what it holds now.
     */
    close(invalidation: RawSaveInvalidation): void {
      closed.push(invalidation);
      const kept = open.filter((surface) => surface.document !== invalidation.document);
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
      const surfaces: readonly OpenWriteSurface[] = [{ kind, document: TARGET }];
      expect(competingSurfaceFor(TARGET, surfaces), kind).toBe(kind === 'restore' ? null : kind);
    } // End of the loop over every surface kind
  }); // End of the "names every one" case

  it('ignores a surface over another file', () => {
    expect(competingSurfaceFor(TARGET, [{ kind: 'matchEditor', document: 99 }])).toBeNull();
  });

  it('refuses to prepare, and to confirm, for each of the six', () => {
    for (const kind of COMPETING) {
      const surfaces: readonly OpenWriteSurface[] = [{ kind, document: TARGET }];
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
    // Q8 names. The pending value is branded, so this is the only way to build the
    // state at all: take a real one and put it on a session about another file.
    const other = { ...startRestore(target({ id: 99 })), pending: pending().pending };
    expect(confirmRestore(other, at(BASE, []))).toBeNull();
  }); // End of the "another destination" case

  it('is refused when the base revision moved under it', () => {
    const moved = targetRevisionObserved(pending(), ELSEWHERE);
    expect(moved.pending).toBeNull();
    expect(moved.baseRevision).toBe(ELSEWHERE);
    // And a confirmation put back by hand is still refused, because it names the
    // revision it was issued at.
    const carried = { ...moved, pending: pending().pending };
    expect(confirmRestore(carried, at(ELSEWHERE, []))).toBeNull();
  }); // End of the "base revision moved" case

  it('is refused when the entry it names is not the retained one', () => {
    const other = candidateRead(
      chooseEntry(pending(), entryOf('match/other.yml').id),
      textResponse({ entry: entryOf('match/other.yml'), text: OTHER_CANDIDATE })
    );
    expect(other.pending).toBeNull();
    const carried = { ...other, pending: pending().pending };
    expect(confirmRestore(carried, at(BASE, []))).toBeNull();
  }); // End of the "another entry" case

  it('is refused when the candidate hash moved under it', () => {
    const restarted = pending();
    const rehashed: RestoreSession = {
      ...restarted,
      preview: { ...restarted.preview!, revision: OTHER_CANDIDATE_REVISION }
    };
    expect(confirmRestore(rehashed, at(BASE, []))).toBeNull();
  }); // End of the "candidate hash" case

  it('is refused when the preview generation moved under it', () => {
    // The one value that separates *this* preview from a later one whose other four
    // are reproducible: choosing the same entry of the same batch again produces the
    // same document, base revision, entry identity and candidate hash.
    const again = candidateRead(pending(), textResponse());
    expect(again.previewGeneration).toBeGreaterThan(pending().previewGeneration);
    const carried = { ...again, pending: pending().pending };
    expect(confirmRestore(carried, at(BASE, []))).toBeNull();
  }); // End of the "preview generation" case

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
        live: () => ({ context: at(BASE, [{ kind, document: TARGET }] as readonly OpenWriteSurface[]) })
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
      expect(sent).toEqual({ kind: 'notAttempted' });
      expect(send).not.toHaveBeenCalled();
    }
  );

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

  it('refuses a structurally cloned question, which is a copy of one nobody asked', () => {
    // The clone satisfies all five field checks by construction — two numbers and
    // three strings, one of them nested — so membership is the only thing that can
    // tell it from the question this module asked. `structuredClone` copies fields,
    // and a `WeakSet` is not a field.
    const session = pending();
    const cloned: RestoreSession = { ...session, pending: structuredClone(session.pending!) };
    expect(confirmRestore(cloned, at(BASE, []))).toBeNull();
    // The refusal spent nothing: the question the clone was made from is still
    // answerable, which is what makes this a case about the clone alone.
    expect(confirmRestore(session, at(BASE, []))).not.toBeNull();
  }); // End of the "cloned question" case

  it('does not spend the question when it refuses, so a repaired session confirms it', () => {
    // **The deletion is after every check for this reason.** A confirmation refused
    // because the window moved, or because the session no longer matches what was
    // asked, must leave the person able to answer the same question once the reason
    // is gone — not silently unable to. Both refusal shapes are here: the one
    // `restoreRefusal` owns, and one of the five the pending request carries.
    const session = pending();
    const moved: RestoreSession = {
      ...session,
      previewGeneration: session.previewGeneration + 1
    };
    expect(confirmRestore(session, at(ELSEWHERE, []))).toBeNull();
    expect(confirmRestore(moved, at(BASE, []))).toBeNull();
    expect(confirmRestore(session, at(BASE, []))).not.toBeNull();
  }); // End of the "refusal spends nothing" case

  it('spends the question before the permit exists, so a confirm inside the confirm finds nothing', () => {
    // The deletion precedes `PERMITS.set` for the reason the send's precedes its
    // sender: between them the submission is derived from the retained draft, and a
    // getter reached there re-enters. That is **one** of the openings, not the only
    // one — every property read in `confirmRestore` can reach a getter or a proxy
    // trap, and the case below drives one that fires *before* the spend. This case
    // pins the ordering alone: with the spend after the permit instead, this
    // re-entrant call would mint a second permit for one question.
    const base = pending();
    const draft = base.preview!.draft;
    const reentrant: (StartedRestore | null)[] = [];
    let entered = false;
    const session: RestoreSession = {
      ...base,
      preview: {
        ...base.preview!,
        draft: {
          ...draft,
          get value(): string {
            if (!entered) {
              entered = true;
              reentrant.push(confirmRestore(session, at(BASE, [])));
            }
            return draft.value;
          }
        }
      }
    };
    expect(confirmRestore(session, at(BASE, []))).not.toBeNull();
    expect(reentrant).toEqual([null]);
  }); // End of the "spent before the permit exists" case

  it('spends the question in one operation, so a getter that re-enters before it mints nothing', async () => {
    // **The counterexample the confirmation review's third pass named.** Asking
    // `PENDING_CONFIRMATIONS.has` and deleting several lines later is two operations,
    // and the property reads between them are caller-controlled: `readonly` on
    // `PendingRestore` freezes nothing at runtime, and `prepareRestore` hands the
    // exact registered object back on the session. So a getter installed on it fires
    // inside the outer call *before* the spend, re-enters, answers the question,
    // mints a permit — and the outer call then ignored its own failed deletion and
    // minted a second. Two live permits, each passing `sendRestore`'s recheck, is the
    // sender running twice for one answered question. The checked deletion closes it:
    // `WeakSet.delete` decides and spends in one step that runs no user code.
    const send = sender();
    const session = pending();
    const question = session.pending!;
    const bound = question.document;
    const reentrant: (StartedRestore | null)[] = [];
    let entered = false;
    Object.defineProperty(question, 'document', {
      configurable: true,
      get(): typeof bound {
        if (!entered) {
          entered = true;
          reentrant.push(confirmRestore(session, at(BASE, [])));
        }
        return bound;
      }
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
        surfaces: [{ kind, document: TARGET }] as readonly OpenWriteSurface[]
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
    const surfaces = coordinator([{ kind: 'matchEditor', document: TARGET }]);
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
    const surfaces = coordinator([{ kind: 'rawEditor', document: TARGET }]);
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
      { kind: 'matchEditor', document: TARGET },
      { kind: 'matchCreator', document: TARGET },
      { kind: 'rawEditor', document: 99 }
    ]);
    const answered = applyRestore(started.session, sent.answer.sealed, surfaces.close);
    expect(surfaces.closed).toEqual([{ document: TARGET, revision: AFTER }]);
    expect(surfaces.open).toEqual([{ kind: 'rawEditor', document: 99 }]);
    expect(answered.restored).toBe(true);
    expect(answered.extraMessages).toEqual([]);
  }); // End of the "closes every surface" case

  it.each([
    ['a conflict', conflictResult()],
    ['a refusal', refusal()],
    ['a success that wrote nothing', saved(false)]
  ])('closes no surface for %s, because nothing went stale', (_name, result) => {
    const started = confirmRestore(pending(), at(BASE, []))!;
    const surfaces = coordinator([{ kind: 'matchEditor', document: TARGET }]);
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

  it('offers no copy and no reapply, and no reload control yet', async () => {
    // The candidate is not authored text, so `conflictChoicesFor` refuses a copy as
    // a property of the drafted value; the reapply could never be honest over a
    // whole document; and the reload control is 2c-5-4's, over the transition this
    // suite drives below.
    const view = restoreView(await conflicted(), at(BASE));
    expect(view.conflictChoices).toEqual(['keepEditing']);
    expect(view.awaitingReloadConfirmation).toBe(false);
    expect(view.reloadUnavailable).toBe(false);
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
    expect(second!.expected).toBe(ELSEWHERE);
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
      { kind: 'conflictShowing' } as const,
      { kind: 'alreadyRestored' } as const
    ];
  } // End of function everyRefusal()

  it('maps every code to a key of its own', () => {
    const keys = everyRefusal().map(restoreRefusalKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key.startsWith('browser.restore.refused.'), key).toBe(true);
    }
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
