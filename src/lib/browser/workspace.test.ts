/**
 * The bootstrap: what the screen is in, and how it got there.
 *
 * Four states, each of which a user really reaches — reading, failed, read and
 * empty, ready — and one wiring claim: a failed `get_match` goes through
 * `identityRecovery`, and a re-resolution that finds a *different* snippet
 * clears the selection rather than moving it.
 *
 * Every command is scripted here rather than mocked at the module level: the
 * state takes its commands as a parameter precisely so that a test can make
 * `get_match` refuse and watch what happens next.
 */

import { describe, expect, it, vi } from 'vitest';
import type { IpcFailure } from '../ipc/errors';
import { classifyFailure } from '../ipc/errors';
import type { CommandResult, RawSaveOutcome, ReloadAfterRawSave } from '../ipc/commands';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  Finding,
  MatchDraft,
  MatchView,
  NewMatch,
  NewMatchPosition,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import { diagnostic, makeDocument, makeMatch, makeSummary, matchListPath } from './fixtures';
import {
  applyMove,
  baseRevisionOf,
  beginMove,
  canChoose,
  choosePlacement,
  dismissMoveOutcome,
  matchMoveView,
  startMatchMove
} from './matchMove';
import {
  openWholeDocumentSave,
  type InvalidationStatus,
  type WholeDocumentOutcome
} from './invalidation';
import { createBrowserState, type BrowserCommands, type RawSaveAnswer } from './workspace.svelte';

/**
 * Opens what the state's raw save answered.
 *
 * The state **seals** its answer as of Phase 2c-1b, so a test that wants the
 * outcome has to discharge the invalidation to get at it — which is the whole
 * point of the seal. The callback is a no-op here on purpose: the invalidation
 * these cases are about is the state's *own*, which the command already ran before
 * this value existed, and every assertion below is about what that invalidation
 * did to the state.
 *
 * @param answer - What `saveRawDocument` answered.
 * @returns How the save ended, or `null` when the command failed.
 */
function outcomeOf(answer: RawSaveAnswer): WholeDocumentOutcome | null {
  if (answer.kind !== 'sealed') {
    return null;
  }
  const opening = openWholeDocumentSave(answer.sealed, () => undefined);
  return opening.kind === 'opened' ? opening.outcome : null;
} // End of function outcomeOf()

/**
 * What the state's own invalidation made of one raw save.
 *
 * Carried on the seal since the 2c-1b review's third finding, so that a committed
 * save this window could not re-project reaches a screen as *out of step* rather
 * than as a clean success with a line in the developer console.
 *
 * @param answer - What `saveRawDocument` answered.
 * @returns The status, or `null` when the command failed.
 */
function issuerInvalidationOf(answer: RawSaveAnswer): InvalidationStatus | null {
  if (answer.kind !== 'sealed') {
    return null;
  }
  const opening = openWholeDocumentSave(answer.sealed, () => undefined);
  return opening.kind === 'opened' ? opening.issuerInvalidation : null;
} // End of function issuerInvalidationOf()

/** A workspace summary of a two-file configuration. */
const SUMMARY: WorkspaceSummary = {
  root: '/tmp/espanso',
  documents: 3,
  match_files: 2,
  config_profiles: 1,
  packages: 0,
  disabled: 0
};

/** The three documents the happy path lists. */
const DOCUMENTS: readonly DocumentSummary[] = [
  makeSummary({ id: 1, relativePath: 'config/default.yml', kind: 'ConfigProfile' }),
  makeSummary({ id: 2, relativePath: 'match/base.yml' }),
  makeSummary({ id: 3, relativePath: 'match/other.yml' })
];

/** The projection of `match/base.yml`. */
function baseDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    matches: [
      makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 11, document: 2, trigger: ':date', label: 'Today' })
    ]
  });
} // End of function baseDocument()

/** The projection of `match/other.yml`. */
function otherDocument(): DocumentView {
  return makeDocument({
    id: 3,
    relativePath: 'match/other.yml',
    matches: [makeMatch({ node: 20, document: 3, trigger: ':sql', label: 'Query' })]
  });
} // End of function otherDocument()

/**
 * The projection of `config/default.yml`.
 *
 * A profile is projected as of the 1c-2b-1 review: it holds no matches and it
 * does hold diagnostics, and skipping it made a profile with broken YAML silent
 * in every pane of the application.
 */
function profileDocument(): DocumentView {
  return makeDocument({
    id: 1,
    relativePath: 'config/default.yml',
    kind: 'ConfigProfile',
    diagnostics: [diagnostic({ RootIsNotAMapping: { found: 'Sequence' } })]
  });
} // End of function profileDocument()

/**
 * The projection of a `config/*.yml` whose **content** looks like a match file.
 *
 * Not a contrivance: the core projects a profile carrying match-file keys as
 * `DocumentShape::MatchFile` **on purpose**
 * (`crates/espansoconfig-core/src/model/document.rs`), so `matches` really can
 * be non-empty on a document whose `kind` is `ConfigProfile`. Its `kind` is what
 * espanso goes by — a fact about **where the file lives** — and espanso does not
 * load matches out of `config/`.
 *
 * @returns A profile with two matches in it.
 */
function matchShapedProfile(): DocumentView {
  return makeDocument({
    id: 1,
    relativePath: 'config/default.yml',
    kind: 'ConfigProfile',
    matches: [
      makeMatch({ node: 90, document: 1, trigger: ':inprofile', label: 'In a profile' }),
      makeMatch({ node: 91, document: 1, trigger: ':also', label: 'Also in a profile' })
    ]
  });
} // End of function matchShapedProfile()

/** What {@link scriptedCommands} may be told to do differently. */
interface Script {
  /** What `open_workspace` answers. */
  readonly open?: CommandResult<WorkspaceSummary>;
  /** What `list_documents` answers. */
  readonly list?: CommandResult<readonly DocumentSummary[]>;
  /** What `get_document` answers, keyed by identity. */
  readonly documents?: ReadonlyMap<number, CommandResult<DocumentView>>;
  /** What `get_match` answers. */
  readonly match?: CommandResult<MatchView>;
  /** What `reload_document` answers. */
  readonly reload?: CommandResult<DocumentView>;
  /** What `document_text` answers, keyed by identity. */
  readonly texts?: ReadonlyMap<number, CommandResult<string>>;
  /**
   * What `move_match` answers, in order.
   *
   * A list rather than a single answer, because the interesting case is two
   * calls: a refusal that carries its findings, and then the same move with the
   * acknowledgement built from them.
   */
  readonly moves?: readonly CommandResult<SaveResult>[];
  /**
   * What `save_match` answers, in order.
   *
   * A list for the same reason `moves` is: the interesting case is a refusal that
   * carries its findings, and then the same draft with the acknowledgement built
   * from them.
   */
  readonly saves?: readonly CommandResult<SaveResult>[];
  /**
   * What `create_match` answers, in order.
   *
   * A list for the same reason `moves` is: the interesting case is a refusal that
   * carries its findings, and then the same new snippet with the acknowledgement
   * built from them.
   */
  readonly creates?: readonly CommandResult<SaveResult>[];
  /**
   * What `delete_match` answers, in order.
   *
   * A list for the same reason `moves` is.
   */
  readonly deletes?: readonly CommandResult<SaveResult>[];
  /**
   * What `duplicate_match` answers, in order.
   *
   * A list for the same reason `moves` is — and here the two-call case is the
   * **ordinary** path rather than the interesting one: a duplicate's first
   * attempt is refused with the trigger suspicion by design, and the second
   * carries the acknowledgement built from it.
   */
  readonly duplicates?: readonly CommandResult<SaveResult>[];
  /**
   * What `save_raw_document` answers, in order.
   *
   * A list for the same reason `moves` is: the interesting case is a refusal
   * followed by the same text with the acknowledgement built from its findings.
   * The reload half of the answer is **not** scripted here — the stub below runs
   * the wrapper's own rule over these, so a test that scripts a commit really
   * drives the invalidation the state performs.
   */
  readonly raws?: readonly CommandResult<SaveResult>[];
}

/**
 * A command surface that answers from a script.
 *
 * @param script - What each command should answer.
 * @returns The commands, with `vi.fn` wrappers so calls can be counted.
 */
function scriptedCommands(script: Script = {}): BrowserCommands {
  // How many moves and how many raw saves have been answered. Those are the two
  // commands a test drives more than once with different answers, so their
  // scripts are consumed in order.
  let moves = 0;
  let saves = 0;
  let creates = 0;
  let deletes = 0;
  let duplicates = 0;
  let raws = 0;
  const documents =
    script.documents ??
    new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
  // Each answer is annotated rather than inferred: a bare `{ ok: true, … }`
  // literal widens `ok` to `boolean`, which does not satisfy the discriminated
  // union `CommandResult` is.
  const opened: CommandResult<WorkspaceSummary> = script.open ?? { ok: true, value: SUMMARY };
  const listed: CommandResult<readonly DocumentSummary[]> = script.list ?? {
    ok: true,
    value: DOCUMENTS
  };
  const matched: CommandResult<MatchView> = script.match ?? { ok: true, value: makeMatch() };
  const reloaded: CommandResult<DocumentView> = script.reload ?? {
    ok: true,
    value: baseDocument()
  };
  return {
    openWorkspace: vi.fn(async () => opened),
    listDocuments: vi.fn(async () => listed),
    getDocument: vi.fn(async (id: number) => {
      const answer: CommandResult<DocumentView> = documents.get(id) ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'unknownDocument', document: id } }
      };
      return answer;
    }),
    getMatch: vi.fn(async () => matched),
    reloadDocument: vi.fn(async () => reloaded),
    documentText: vi.fn(async (id: number) => {
      const answer: CommandResult<string> = script.texts?.get(id) ?? {
        ok: true,
        value: `# text of document ${id}\n`
      };
      return answer;
    }),
    moveMatch: vi.fn(async () => {
      const answer: CommandResult<SaveResult> = script.moves?.[moves++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    saveMatch: vi.fn(async () => {
      const answer: CommandResult<SaveResult> = script.saves?.[saves++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    createMatch: vi.fn(async () => {
      const answer: CommandResult<SaveResult> = script.creates?.[creates++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    deleteMatch: vi.fn(async () => {
      const answer: CommandResult<SaveResult> = script.deletes?.[deletes++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    duplicateMatch: vi.fn(async () => {
      const answer: CommandResult<SaveResult> = script.duplicates?.[duplicates++] ?? {
        ok: false,
        failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
      };
      return answer;
    }),
    saveRawDocument: vi.fn(
      async (
        document: DocumentId,
        _baseRevision: ContentRevision,
        _text: string,
        _acknowledgement: Acknowledgement,
        reload: ReloadAfterRawSave
      ): Promise<RawSaveOutcome> => {
        // The wrapper's own rule, repeated here rather than approximated: the
        // reload runs on a commit and on nothing else, it is awaited, and a
        // reload that throws leaves the committed result intact. A stub that
        // simply returned the scripted answer would let a state test claim an
        // invalidation the real boundary never triggers.
        const answer: CommandResult<SaveResult> = script.raws?.[raws++] ?? {
          ok: false,
          failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
        };
        if (!answer.ok) {
          return answer;
        }
        if (!(answer.value.outcome === 'saved' && answer.value.committed)) {
          return { ok: true, value: answer.value, reload: { kind: 'notOwed' } };
        }
        try {
          await reload({ document, revision: answer.value.revision });
        } catch (raw: unknown) {
          return {
            ok: true,
            value: answer.value,
            reload: { kind: 'failed', failure: classifyFailure(raw) }
          };
        }
        return { ok: true, value: answer.value, reload: { kind: 'done' } };
      }
    ) // End of the scripted save_raw_document
  };
} // End of function scriptedCommands()

/**
 * A promise whose settlement the test controls.
 *
 * The only way to make two requests overlap without a timer: the first command
 * is handed this promise and does not settle until the test says so, which is
 * exactly the window a second click lands in.
 *
 * @returns The promise and the function that resolves it.
 */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let settle: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolveWith) => {
    settle = resolveWith;
  });
  return {
    promise,
    resolve: (value: T) => settle?.(value)
  };
} // End of function deferred()

describe('the load', () => {
  it('starts in the reading state before anything is asked', () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    expect(state.status).toBe('loading');
    expect(state.documents).toEqual([]);
  });

  it('ends ready, with every file projected — profiles included', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    expect(state.status).toBe('ready');
    expect(state.summary?.root).toBe('/tmp/espanso');
    expect(state.documents).toHaveLength(3);
    // All three, the profile among them. It was skipped until the 1c-2b-1
    // review on the grounds that it holds no matches — true, and the wrong
    // test: it holds diagnostics, and nothing else in the application would
    // ever ask for them.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(state.sidebar.total).toBe(3);
    expect(state.sidebar.pending).toBe(0);
    expect(state.scopedMatches).toHaveLength(3);
  });

  it('projects a profile without letting it into a count or the snippet list', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);

    // Read, and still showing "not read yet" rather than a count of 0: a `0`
    // would say the file was read and holds no snippets, which invites the
    // reader to expect that it could hold some.
    expect(state.sidebar.profiles[0]?.matches).toBeNull();
    expect(state.sidebar.total).toBe(3);
    expect(state.sidebar.pending).toBe(0);
    // …and it contributes nothing to the "All" list either.
    expect(state.scopedMatches).toHaveLength(3);
    state.show({ kind: 'document', id: 1 });
    expect(state.scopedMatches).toEqual([]);
  });

  it('keeps a match-shaped profile’s matches out of the list the total counts', async () => {
    /*
     * The second review pass's finding, and it is the profile fix regressing
     * itself: before profiles were projected there was no such view to leak.
     * `holdsMatches` guards the sidebar's counts, so a list built without the
     * same guard shows rows the total does not count — and the disagreement is
     * the assertion, not either number alone.
     */
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: matchShapedProfile() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: true, value: otherDocument() }]
        ])
      }),
      () => undefined
    );
    await state.open(null);

    // The "All" scope: three real snippets, and the total says three.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11, 20]);
    expect(state.sidebar.total).toBe(state.scopedMatches.length);

    // The profile's own scope: still nothing, although `view.matches` has two.
    state.show({ kind: 'document', id: 1 });
    expect(state.scopedMatches).toEqual([]);
    expect(state.sidebar.profiles[0]?.matches).toBeNull();
    // …and its diagnostics stay reachable, which is why it is projected at all.
    expect(state.scopedDocument?.id).toBe(1);
  });

  it('makes a profile’s diagnostics reachable, which they were not before', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 1 });

    // The review's Medium 2, in one assertion: `scopedDocument` used to be
    // `null` here, so a profile with broken YAML said nothing anywhere.
    expect(state.scopedDocument?.id).toBe(1);
    expect(state.scopedDocument?.diagnostics).toHaveLength(1);
  });

  it('reports a failed open and shows it, rather than an empty window', async () => {
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'configDirNotFound', candidates: ['/tmp/one', '/tmp/two'] }
    };
    const reported: IpcFailure[] = [];
    const state = createBrowserState(scriptedCommands({ open: { ok: false, failure } }), (f) =>
      reported.push(f)
    );
    await state.open(null);

    expect(state.status).toBe('failed');
    expect(state.failure).toEqual(failure);
    expect(reported).toEqual([failure]);
  });

  it('fails when the file list fails, without pretending the workspace is empty', async () => {
    const failure: IpcFailure = { kind: 'command', error: { code: 'noWorkspaceOpen' } };
    const state = createBrowserState(
      scriptedCommands({ list: { ok: false, failure } }),
      () => undefined
    );
    await state.open(null);
    expect(state.status).toBe('failed');
    expect(state.documents).toEqual([]);
  });

  it('keeps going when one file cannot be read', async () => {
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/other.yml', kind: 'PermissionDenied' }
    };
    const reported: IpcFailure[] = [];
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: profileDocument() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: false, failure }]
        ])
      }),
      (f) => reported.push(f)
    );
    await state.open(null);

    // One unreadable file must not blank a window that can show the rest.
    expect(state.status).toBe('ready');
    expect(state.scopedMatches).toHaveLength(2);
    // Not *pending*: a refused read is not a count on its way. It is on the
    // row, as `unreadable`.
    expect(state.sidebar.pending).toBe(0);
    expect(reported).toEqual([failure]);
    // …and it must not do it silently. The console is for the developer; the
    // user is looking at a total that omits a whole file, and `loadFailures` is
    // what the sidebar renders to say so.
    expect(state.loadFailures).toEqual([{ document: 3, failure }]);
  });

  it('exposes one projection per file that read, and none for one that did not', async () => {
    // **The accessor 2c-3a-2 added, and the shape a caller has to know about.**
    // `startMatchCreation` takes the summaries *and* the projections precisely
    // because they are two different lists: a file whose read refused is on the
    // first and not on the second, and a destination list built from this alone
    // would silently omit a file the sidebar is still naming — which is what the
    // design consult's Q5 rejects.
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/other.yml', kind: 'PermissionDenied' }
    };
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: profileDocument() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: false, failure }]
        ])
      }),
      () => undefined
    );
    await state.open(null);

    expect(state.documents.map((one) => one.id)).toEqual([1, 2, 3]);
    expect(state.views.map((one) => one.id)).toEqual([1, 2]);
    expect(state.views.find((one) => one.id === 2)?.revision).toBe('rev-a');
  });

  it('says which file could not be read, so its own row can say so too', async () => {
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/other.yml', kind: 'PermissionDenied' }
    };
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: profileDocument() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: false, failure }]
        ])
      }),
      () => undefined
    );
    await state.open(null);

    // The identity is carried rather than recovered from the failure's `path`:
    // a `WirePath` renders un-encodable bytes as U+FFFD, so two different files
    // can produce one display path, and several codes carry no path at all.
    expect(state.loadFailures.map((entry) => entry.document)).toEqual([3]);
    const refused = state.sidebar.files.find((row) => row.document.id === 3);
    const untouched = state.sidebar.files.find((row) => row.document.id === 2);
    expect(refused?.unreadable).toBe(true);
    expect(refused?.matches).toBeNull();
    expect(untouched?.unreadable).toBe(false);
    // A profile nobody projected is the other side of the conflation: no count
    // either, and it is *not* a file this app failed to read.
    expect(state.sidebar.profiles[0]?.unreadable).toBe(false);
    expect(state.sidebar.pending).toBe(0);
  });

  it('starts each open with no failures held over from the last one', async () => {
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/other.yml', kind: 'PermissionDenied' }
    };
    // One state, two opens, and the second reads every file: a failure list
    // that is appended to rather than replaced reports a file that is fine.
    let round = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      getDocument: vi.fn(async (id: number) => {
        if (id === 3 && round === 0) {
          const refused: CommandResult<DocumentView> = { ok: false, failure };
          return refused;
        }
        const answer: CommandResult<DocumentView> = {
          ok: true,
          value: id === 2 ? baseDocument() : otherDocument()
        };
        return answer;
      })
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    expect(state.loadFailures).toEqual([{ document: 3, failure }]);
    expect(state.sidebar.files.some((row) => row.unreadable)).toBe(true);

    round = 1;
    await state.open(null);
    expect(state.loadFailures).toEqual([]);
    expect(state.sidebar.pending).toBe(0);
    // The mark has to clear with the list. A row still saying "could not be
    // read" for a file that has just been read is the same lie as the total.
    expect(state.sidebar.files.some((row) => row.unreadable)).toBe(false);
  });

  it('is ready and empty for a configuration with no files at all', async () => {
    const state = createBrowserState(
      scriptedCommands({ list: { ok: true, value: [] } }),
      () => undefined
    );
    await state.open(null);
    expect(state.status).toBe('ready');
    expect(state.documents).toEqual([]);
    expect(state.sidebar.total).toBe(0);
  });
}); // End of the "load" suite

describe('the list the middle pane shows', () => {
  it('is every match of every file until a file is chosen', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11, 20]);
  });

  it('narrows to one file when the sidebar selects one', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 3 });
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([20]);
  });

  it('applies the search on top of the file filter, not instead of it', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.search('sig');
    expect(state.visibleMatches.map((match) => match.id.node)).toEqual([10]);
    state.show({ kind: 'document', id: 3 });
    expect(state.visibleMatches).toEqual([]);
  });
}); // End of the "list" suite

describe('the file the middle pane is showing', () => {
  /*
   * `scopedDocument` is what the middle pane draws a file's diagnostics and
   * hazards from. It has to answer for a file with **no matches**, because a
   * file that does not parse is exactly that and is the one that most needs a
   * sentence.
   */
  it('is nothing while the list is showing every file', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    expect(state.scopedDocument).toBeNull();
  });

  it('is the projection of the file the sidebar selected', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 3 });
    expect(state.scopedDocument?.id).toBe(3);
  });

  it('is the projection even when that file holds no matches at all', async () => {
    // The four invalid fixtures' shape: a view with `parsed: false`, an empty
    // `matches` and a diagnostic. Nothing in it can be selected, so the detail
    // pane is unreachable and this is the only surface left.
    const broken = makeDocument({ id: 3, relativePath: 'match/other.yml', parsed: false });
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: profileDocument() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: true, value: broken }]
        ])
      }),
      () => undefined
    );
    await state.open(null);
    state.show({ kind: 'document', id: 3 });
    expect(state.scopedMatches).toEqual([]);
    expect(state.scopedDocument?.parsed).toBe(false);
  });

  it('is nothing for a file whose read was refused', async () => {
    // The only remaining reason a listed file has no projection. There is no
    // view to answer with and the pane must not be handed a half-built one;
    // what the reader gets instead is the sidebar's "Could not be read".
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/other.yml', kind: 'PermissionDenied' }
    };
    const state = createBrowserState(
      scriptedCommands({
        documents: new Map<number, CommandResult<DocumentView>>([
          [1, { ok: true, value: profileDocument() }],
          [2, { ok: true, value: baseDocument() }],
          [3, { ok: false, failure }]
        ])
      }),
      () => undefined
    );
    await state.open(null);
    state.show({ kind: 'document', id: 3 });
    expect(state.scopedDocument).toBeNull();
  });
}); // End of the "file the middle pane is showing" suite

describe('selecting a snippet', () => {
  it('holds the identity and checks it across the boundary', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    const target = state.scopedMatches[1];
    expect(target).toBeDefined();
    await state.select(target!);

    expect(state.selected?.id.node).toBe(11);
    expect(state.selected?.position).toBe(1);
    expect(state.selectedMatch?.id.node).toBe(11);
    expect(state.selectedDocument?.relative_path).toBe('match/base.yml');
    expect(commands.getMatch).toHaveBeenCalledTimes(1);
    expect(state.notice).toBeNull();
  });

  it('resolves the position within the file, not within the list on screen', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    // The third row of the "All" list is the *first* match of `other.yml`.
    const target = state.scopedMatches[2];
    await state.select(target!);
    expect(state.selected?.document).toBe(3);
    expect(state.selected?.position).toBe(0);
  });

  it('installs the re-read document, not only the identity it found there', async () => {
    // The fixture is a *different revision*: same two snippets, new nodes, and
    // one more of them. A recovery that stores the fresh identity over the
    // cached projection leaves `selectedMatch` resolving node 10 in a document
    // that no longer has one, the list showing the old rows, and the count
    // stale — all three of which are asserted below rather than assumed from
    // the identity.
    const reparsed = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
        makeMatch({ node: 32, document: 2, revision: 'rev-b', trigger: ':new', label: 'Added' })
      ]
    });
    const state = createBrowserState(
      scriptedCommands({
        match: {
          ok: false,
          failure: {
            kind: 'command',
            error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
          }
        },
        reload: { ok: true, value: reparsed }
      }),
      () => undefined
    );
    await state.open(null);
    await state.select(state.scopedMatches[0]!);

    expect(state.notice).toBe('kept');
    expect(state.selected?.id.node).toBe(30);
    expect(state.selected?.id.revision).toBe('rev-b');
    // Live, and of the bytes now on disk — the claim section 12 of the notes
    // makes to 1c-2.
    expect(state.selectedMatch?.id.node).toBe(30);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31, 32, 20]);
    expect(state.sidebar.total).toBe(4);
  });

  it('drops a deleted snippet from the list, not only from the selection', async () => {
    const afterDeletion = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' })]
    });
    const state = createBrowserState(
      scriptedCommands({
        match: {
          ok: false,
          failure: {
            kind: 'command',
            error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
          }
        },
        reload: { ok: true, value: afterDeletion }
      }),
      () => undefined
    );
    await state.open(null);
    await state.select(state.scopedMatches[0]!);

    expect(state.notice).toBe('differentMatch');
    expect(state.selected).toBeNull();
    // The row for `:sig` must be gone from the list as well: it is not on disk.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 20]);
    expect(state.sidebar.total).toBe(2);
  });

  it('clears the selection when that position now holds a different snippet', async () => {
    // The counterexample R27 was corrected by: the first match was deleted, so
    // the held position resolves — to the wrong snippet.
    const afterDeletion = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' })]
    });
    const state = createBrowserState(
      scriptedCommands({
        match: {
          ok: false,
          failure: {
            kind: 'command',
            error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
          }
        },
        reload: { ok: true, value: afterDeletion }
      }),
      () => undefined
    );
    await state.open(null);
    // `:sig` was selected at position 0; `:sig` is what the deletion removed,
    // so position 0 still resolves — to `:date`.
    await state.select(state.scopedMatches[0]!);

    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  });

  it('clears the selection when the snippet is simply not there any more', async () => {
    const state = createBrowserState(
      scriptedCommands({
        match: { ok: false, failure: { kind: 'command', error: { code: 'identityNoSuchMatch', node: 10 } } }
      }),
      () => undefined
    );
    await state.open(null);
    await state.select(state.scopedMatches[0]!);

    expect(state.selected).toBeNull();
    expect(state.notice).toBe('gone');
  });

  it('says so, and drops the selection, when the file cannot be read again', async () => {
    const state = createBrowserState(
      scriptedCommands({
        match: {
          ok: false,
          failure: {
            kind: 'command',
            error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
          }
        },
        reload: {
          ok: false,
          failure: { kind: 'command', error: { code: 'io', path: '/tmp/x', kind: 'NotFound' } }
        }
      }),
      () => undefined
    );
    await state.open(null);
    await state.select(state.scopedMatches[0]!);

    expect(state.selected).toBeNull();
    expect(state.notice).toBe('unresolved');
  });

  it('is dropped by a reload, so no notice outlives the window it belongs to', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    await state.select(state.scopedMatches[0]!);
    await state.open(null);
    expect(state.selected).toBeNull();
    expect(state.notice).toBeNull();
  });

  it('can be dismissed and cleared independently', async () => {
    // Both directions, on a case where the two really are independent: the
    // selection *survives* a `kept`, so dismissing the notice must leave it
    // standing, and clearing the selection must take the notice with it.
    const state = createBrowserState(
      scriptedCommands({
        match: {
          ok: false,
          failure: {
            kind: 'command',
            error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
          }
        },
        reload: { ok: true, value: baseDocument() }
      }),
      () => undefined
    );
    await state.open(null);
    await state.select(state.scopedMatches[0]!);
    expect(state.notice).toBe('kept');
    expect(state.selected).not.toBeNull();

    state.dismissNotice();
    expect(state.notice).toBeNull();
    expect(state.selected?.id.node).toBe(10);

    state.clearSelection();
    expect(state.selected).toBeNull();
    expect(state.notice).toBeNull();
  });
}); // End of the "selecting" suite

describe('two requests that overlap', () => {
  it('lets the newer selection win, however late the older one answers', async () => {
    // The user clicks A, then B before A's `get_match` has answered. A's answer
    // arrives last and is a *stale identity*, so the recovery path runs — and
    // it would re-resolve A, select it and raise A's notice, over a B the user
    // chose afterwards. The state B left is what has to survive.
    const first = deferred<CommandResult<MatchView>>();
    const answers: Promise<CommandResult<MatchView>>[] = [
      first.promise,
      Promise.resolve<CommandResult<MatchView>>({ ok: true, value: makeMatch({ node: 11 }) })
    ];
    let call = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      getMatch: vi.fn(() => answers[call++] ?? answers[1]!)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const pending = state.select(state.scopedMatches[0]!);
    await state.select(state.scopedMatches[1]!);
    expect(state.selected?.id.node).toBe(11);

    first.resolve({
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
      }
    });
    await pending;

    expect(state.selected?.id.node).toBe(11);
    expect(state.notice).toBeNull();
    // And it is dropped *before* the recovery, not after it: re-reading a file
    // to re-resolve a selection the user has already replaced is a command
    // nobody asked for, and the answer would have to be discarded anyway.
    expect(commands.reloadDocument).not.toHaveBeenCalled();
  });

  it('lets the newer selection win even when the older one is already recovering', async () => {
    // The second window, and it is a different one: A's `get_match` has already
    // refused, so A is inside `repairSelection` waiting for a *reload* when the
    // user clicks B. The recovery finishes afterwards and would otherwise
    // install its document, select A and raise A's notice.
    const reload = deferred<CommandResult<DocumentView>>();
    const stale: CommandResult<MatchView> = {
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
      }
    };
    const answers: CommandResult<MatchView>[] = [stale, { ok: true, value: makeMatch({ node: 11 }) }];
    let call = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      getMatch: vi.fn(async () => answers[call++] ?? answers[1]!),
      reloadDocument: vi.fn(() => reload.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const pending = state.select(state.scopedMatches[0]!);
    // Drain every pending microtask, so that A is *inside* the recovery and has
    // already passed the check that follows `get_match`. Clicking before this
    // point would be caught by that earlier check and would say nothing about
    // this one.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(commands.reloadDocument).toHaveBeenCalledTimes(1);

    await state.select(state.scopedMatches[1]!);
    expect(state.selected?.id.node).toBe(11);

    reload.resolve({ ok: true, value: baseDocument() });
    await pending;

    expect(state.selected?.id.node).toBe(11);
    expect(state.notice).toBeNull();
  });

  it('lets the newer open win, however late the older one answers', async () => {
    const first = deferred<CommandResult<WorkspaceSummary>>();
    const second: CommandResult<WorkspaceSummary> = {
      ok: true,
      value: { ...SUMMARY, root: '/tmp/other' }
    };
    let call = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      openWorkspace: vi.fn(() => (call++ === 0 ? first.promise : Promise.resolve(second)))
    };
    const state = createBrowserState(commands, () => undefined);

    const pending = state.open(null);
    await state.open('/tmp/other');
    expect(state.status).toBe('ready');
    expect(state.summary?.root).toBe('/tmp/other');

    first.resolve({ ok: true, value: SUMMARY });
    await pending;

    // The first open's answer describes a directory the user has replaced.
    expect(state.status).toBe('ready');
    expect(state.summary?.root).toBe('/tmp/other');
  });
}); // End of the "overlapping requests" suite

describe('opening a second workspace', () => {
  it('forgets the file filter and the query the first one was left in', async () => {
    // Workspace B may not have a document 3 at all, or may have given that
    // identity to another file. Either way the filter and the query are
    // statements about A, and carrying them over shows an empty pane for a
    // configuration that is not empty.
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 3 });
    state.search('sql');
    expect(state.visibleMatches).toHaveLength(1);

    await state.open(null);

    expect(state.selection.kind).toBe('all');
    expect(state.query).toBe('');
    expect(state.visibleMatches).toHaveLength(3);
  });

  it('shows nothing of the first workspace while the second is being read', async () => {
    // `documents` and `summary` are what the empty and ready screens are drawn
    // from. Leaving them in place means the previous configuration's file list
    // is on screen under the new configuration's loading state.
    const first = deferred<CommandResult<WorkspaceSummary>>();
    let call = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      openWorkspace: vi.fn(() =>
        call++ === 0
          ? Promise.resolve<CommandResult<WorkspaceSummary>>({ ok: true, value: SUMMARY })
          : first.promise
      )
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    expect(state.documents).toHaveLength(3);

    const pending = state.open('/tmp/other');
    expect(state.status).toBe('loading');
    expect(state.documents).toEqual([]);
    expect(state.summary).toBeNull();
    expect(state.scopedMatches).toEqual([]);

    first.resolve({ ok: true, value: SUMMARY });
    await pending;
    expect(state.status).toBe('ready');
  });
}); // End of the "opening a second workspace" suite

describe('the raw viewer', () => {
  /*
   * What this suite establishes is the **state machine**, not the screen. It can
   * say which file the viewer would show, which of the four arms its text is in
   * and how many times `document_text` was called; it cannot say that anything
   * was drawn, because nothing in this repository renders a Svelte component in
   * an automated test (`docs/decisions/1c-1-notes.md` hole 1). The evidence that
   * the pane renders is the window reading in
   * `docs/decisions/1c-2b-2b-2-notes.md`, taken by hand.
   */

  it('offers no file to show until something names one', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);

    // The "All" scope names no file and nothing is selected, so there is
    // nothing for the toggle to be about.
    expect(state.fileTextTarget).toBeNull();
    expect(state.fileTextShown).toBe(false);
    expect(state.fileText).toBeNull();
  });

  it('takes the sidebar’s file, including one that holds no snippets', async () => {
    // The reachability property the placement decision rests on: a file with no
    // matches can never be selected into this pane through a snippet, so if the
    // viewer's target came from the selection such a file would have no way of
    // ever being shown. It comes from the sidebar instead.
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 1 });

    expect(state.scopedMatches).toEqual([]);
    expect(state.fileTextTarget?.relative_path).toBe('config/default.yml');
  });

  it('falls back to the selected snippet’s file in the “All” scope', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    await state.select(otherDocument().matches[0]!);

    expect(state.selection.kind).toBe('all');
    expect(state.fileTextTarget?.id).toBe(3);
  });

  it('reads the file’s text when it is shown, and answers the text arm', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    expect(commands.documentText).toHaveBeenCalledWith(2);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 2\n' });
  });

  it('calls nothing while it is closed', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    // The viewer is a mode the reader turns on. A workspace load that read
    // every file's text as well as every projection would double the cost of
    // opening a configuration for a pane nobody has asked for.
    expect(commands.documentText).not.toHaveBeenCalled();
    expect(state.fileText).toBeNull();
  });

  it('holds a file it cannot decode in the refused arm, never in the empty one', async () => {
    // 1c-2b-2a hole 8, as state. `notUtf8` is the refusal this arm exists for:
    // the file cannot be represented as a string at all, and the reader must
    // not be shown an empty box that says the file holds nothing. That the two
    // arms *draw* differently is the window reading's claim, not this one's.
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'notUtf8', path: '/tmp/espanso/match/base.yml', offset: 41 }
    };
    const state = createBrowserState(
      scriptedCommands({ texts: new Map([[2, { ok: false, failure }]]) }),
      () => undefined
    );
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    expect(state.fileText).toEqual({ kind: 'refused', failure });
  });

  it('tells a file of no characters apart from one it could not read', async () => {
    // **Both inputs are supplied**, which is the review's fifth finding: a body
    // that offered only the empty file would still pass if an unreadable one
    // were classified as empty too, and telling the two apart is the entire
    // reason `RawDocumentText` has four arms rather than a string.
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'notUtf8', path: '/tmp/espanso/match/other.yml', offset: 41 }
    };
    const state = createBrowserState(
      scriptedCommands({
        texts: new Map<number, CommandResult<string>>([
          [2, { ok: true, value: '' }],
          [3, { ok: false, failure }]
        ])
      }),
      () => undefined
    );
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    expect(state.fileText).toEqual({ kind: 'empty' });

    state.show({ kind: 'document', id: 3 });
    await Promise.resolve();
    await Promise.resolve();
    expect(state.fileText).toEqual({ kind: 'refused', failure });
  }); // End of the "empty apart from unreadable" case

  it('reports a refusal to the developer as well as holding it on the state', async () => {
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/base.yml', kind: 'PermissionDenied' }
    };
    const report = vi.fn();
    const state = createBrowserState(
      scriptedCommands({ texts: new Map([[2, { ok: false, failure }]]) }),
      report
    );
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    expect(report).toHaveBeenCalledWith(failure);
    // Both channels, so the name is true of both halves: the console for the
    // developer, and the state the pane reads for the user.
    expect(state.fileText).toEqual({ kind: 'refused', failure });
  });

  it('reads the new file when a sidebar click moves the target', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    state.show({ kind: 'document', id: 3 });
    // The click starts the read, and what the pane holds until it settles is
    // `loading` rather than the previous file's text. **What makes that true is
    // `readFileText` nulling the answer synchronously**, not the identity guard
    // in the getter: experiment C removes that guard and nothing here fails.
    expect(state.fileText).toEqual({ kind: 'loading' });
    await Promise.resolve();
    await Promise.resolve();

    expect(state.fileTextTarget?.id).toBe(3);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 3\n' });
  });

  it('does not re-read one file because the reader clicked another snippet in it', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    await state.select(baseDocument().matches[0]!);
    await state.select(baseDocument().matches[1]!);

    expect(commands.documentText).toHaveBeenCalledTimes(1);
  });

  it('re-reads on every re-opening, because the file may have changed', async () => {
    // There is no watcher, so the only moment this application can honestly
    // take a snapshot of a file is the moment the reader asks to see it. What
    // makes that happen is `showFileText(false)` clearing the *identity* of the
    // file whose text is held: `readFileText` then sees a target it is not
    // already showing. Experiment F puts that identity back and this fails.
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    await state.showFileText(false);
    await state.showFileText(true);

    expect(commands.documentText).toHaveBeenCalledTimes(2);
  });

  it('drops the text it was showing when it is closed', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    await state.showFileText(false);

    expect(state.fileTextShown).toBe(false);
    expect(state.fileText).toBeNull();
  });

  it('discards an answer whose file the reader has already moved off', async () => {
    // The same race the two generation counters exist for, on a third channel.
    // Without it, a slow read of file 2 lands after a click on file 3 and the
    // pane shows one file's bytes under the other file's name.
    const slow = deferred<CommandResult<string>>();
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      documentText: vi.fn((id: number) =>
        id === 2 ? slow.promise : Promise.resolve<CommandResult<string>>({ ok: true, value: 'b' })
      )
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    const pending = state.showFileText(true);

    state.show({ kind: 'document', id: 3 });
    await Promise.resolve();
    await Promise.resolve();
    expect(state.fileText).toEqual({ kind: 'text', text: 'b' });

    slow.resolve({ ok: true, value: 'a' });
    await pending;

    // File 2's answer arrived last and is discarded whole.
    expect(state.fileText).toEqual({ kind: 'text', text: 'b' });
  });

  it('re-reads a file whose target was cleared, rather than redrawing the old snapshot', async () => {
    // **The review's sixth finding, second half.** In the "All" scope the
    // selected snippet's file *is* the viewer's target, so dropping the
    // selection drops the target — and the held snapshot with it. Without that,
    // selecting a snippet in the same file again matches the identity
    // `readFileText` still holds, returns early, and redraws bytes read before
    // the clear, which contradicts this module's own policy that a file is
    // re-read whenever the viewer is pointed at it afresh.
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    state.clearSelection();
    expect(state.fileTextTarget).toBeNull();
    expect(state.fileText).toBeNull();

    await state.select(baseDocument().matches[0]!);
    await Promise.resolve();
    await Promise.resolve();

    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 2\n' });
  }); // End of the "re-reads a cleared target's file" case

  it('drops an answer in flight when the target is cleared, so no later selection reuses it', async () => {
    // **The same finding's first half**, and the harder one: the read was
    // already on its way when the target went. If it lands and installs itself
    // as the snapshot, the next selection of that file is served bytes the
    // reader never asked for again — with nothing on screen saying when they
    // were read.
    const slow = deferred<CommandResult<string>>();
    let calls = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      documentText: vi.fn(() => {
        calls += 1;
        return calls === 1
          ? slow.promise
          : Promise.resolve<CommandResult<string>>({ ok: true, value: 'read again' });
      })
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    await state.select(baseDocument().matches[0]!);
    const pending = state.showFileText(true);

    state.clearSelection();
    slow.resolve({ ok: true, value: 'read before the clear' });
    await pending;
    expect(state.fileTextTarget).toBeNull();

    await state.select(baseDocument().matches[0]!);
    await Promise.resolve();
    await Promise.resolve();

    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: 'read again' });
  }); // End of the "answer in flight when the target is cleared" case

  it('closes with the workspace, because every identity is about to be reused', async () => {
    const state = createBrowserState(scriptedCommands(), () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    await state.open(null);

    expect(state.fileTextShown).toBe(false);
    expect(state.fileText).toBeNull();
  });
}); // End of the "raw viewer" suite

/**
 * The moved-document projection: the same two snippets, in the other order,
 * under a new revision.
 *
 * A **new revision** and **new node identifiers**, because that is what a commit
 * really produces: `MatchId` carries the revision it was minted from, so every
 * identity held before the save stops resolving.
 */
function movedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-b',
    matches: [
      makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
      makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' })
    ]
  });
} // End of function movedDocument()

/**
 * A third projection of the same file, later than {@link movedDocument}.
 *
 * **A third revision and a third set of nodes**, so that a case about two reads
 * that overlap can say *which* of them the state ended up holding. Two projections
 * cannot: an assertion against `rev-b` passes whether the answer that installed it
 * was the wanted one or the stale one.
 *
 * @returns The projection.
 */
function laterDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-c',
    matches: [
      makeMatch({ node: 40, document: 2, revision: 'rev-c', trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 41, document: 2, revision: 'rev-c', trigger: ':date', label: 'Today' })
    ]
  });
} // End of function laterDocument()

/** A finding a refusal could carry and a caller could hand back. */
function suspicion(): Finding {
  return {
    code: { ReferenceHasNoDeclaration: { name: 'who' } },
    span: { start: 10, end: 20 },
    node: 11,
    path: null
  };
}

/** An acknowledgement of nothing, which is what a first attempt sends. */
const NOTHING_ACKNOWLEDGED: Acknowledgement = { accepted: [] };

/**
 * The revision every fixture in this file is projected at when the workspace opens.
 *
 * What a form, a move or a deletion session opened straight after the load would
 * carry as its base, and therefore what its caller hands the wrapper. It is named
 * rather than spelled at each call site because the interesting cases are the ones
 * that pass something **else** — a submission drafted before the window moved on.
 */
const OPEN_REVISION: ContentRevision = 'rev-a';

/**
 * The disk side's whole file text, on every conflict fixture in this file.
 *
 * A conflict payload carries the file as the disk holds it, and no wrapper here
 * reads it — 2c-4a-1 puts the value on the wire and adds no screen for it. It is
 * one constant so that a later step wiring it through has one fixture to change.
 */
const DISK_TEXT = 'matches:\n  - trigger: x\n    replace: theirs\n';

/**
 * A save that ran to the end and wrote nothing.
 *
 * A documented success, and the arm the argument cases below use precisely
 * because it moves nothing: the revision is the one this state was already
 * projecting, so no re-read happens and the assertion is about what was **sent**.
 */
const CREATED_NOTHING: SaveResult = {
  outcome: 'saved',
  revision: 'rev-a',
  committed: false,
  notes: [],
  backup_taken: false,
  moved: null
};

/**
 * A command failure at or after the rename.
 *
 * `may_have_written: true` is the wire saying this application cannot tell
 * whether the file was written, which is the one bit a screen cannot do without.
 */
const WRITE_MAY_HAVE_HAPPENED: CommandResult<SaveResult> = {
  ok: false,
  failure: {
    kind: 'command',
    error: {
      code: 'saveFailed',
      error: {
        Write: {
          Io: {
            step: 'SyncDirectory',
            path: '/tmp/espanso/match/base.yml',
            kind: 'Interrupted',
            raw_os_error: 4
          }
        }
      },
      may_have_written: true
    }
  }
};

describe('reading one file again', () => {
  /*
   * `BrowserState.rereadDocument`, added at Phase 2c-3b step 2 because
   * `MoveRecovery.reloadFile` in `./matchMove.ts` — the design consult's Q8
   * answer — was a code with no producer behind it: `commands.reloadDocument`
   * was reachable only from inside `select()`'s own repair.
   */

  it('replaces the projection, drops the text it was showing, and answers nothing', async () => {
    const commands = scriptedCommands({ reload: { ok: true, value: movedDocument() } });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    expect(state.fileText).not.toBeNull();
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);

    const failure = await state.rereadDocument(2);

    expect(failure).toBeNull();
    expect(commands.reloadDocument).toHaveBeenCalledWith(2);
    // The whole projection moved, not merely one identity: the list, the counts
    // and every `MatchId` minted from the old parse are read off `views`.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
    expect(state.scopedDocument?.revision).toBe('rev-b');
    // And the viewer's snapshot was of bytes this state has just stopped
    // vouching for, so it was dropped and read again rather than redrawn.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
  }); // End of the "replaces the projection" case

  it('puts the selection back positionally and then checks it (R27)', async () => {
    // `movedDocument` writes `:date` first and `:sig` second, so the snippet at
    // the held position is a different one — which is a selection dropped with a
    // notice, never a silent re-point.
    const commands = scriptedCommands({ reload: { ok: true, value: movedDocument() } });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    expect(state.selected?.id.node).toBe(10);

    await state.rereadDocument(2);

    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "selection repaired" case

  it('reports a read it could not make, answers it, and keeps what it holds', async () => {
    // **The stale projection stays.** Nothing here knows the file is gone, only
    // that this attempt did not reach it, and dropping a file's whole projection
    // is a bigger claim than a failed read supports. The failure is answered as
    // well as reported, so the caller can say why rather than leaving a control
    // that appeared to do nothing.
    const refusal: IpcFailure = {
      kind: 'command',
      error: { code: 'unknownDocument', document: 2 }
    };
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ reload: { ok: false, failure: refusal } });
    const state = createBrowserState(commands, (failure) => reported.push(failure));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    expect(await state.rereadDocument(2)).toEqual(refusal);

    expect(reported).toEqual([refusal]);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    // A read that failed is not a workspace that failed.
    expect(state.status).toBe('ready');
    expect(state.failure).toBeNull();
  }); // End of the "failed re-read" case

  it('lets the newer re-read win, however late the older one answers', async () => {
    // **The second review's High finding.** This call awaited with no generation
    // captured at all, so of two overlapping re-reads of one file the *older*
    // answer installed last and won — the state ending up projecting bytes it had
    // already replaced with fresher ones, with every identity minted from them.
    const first = deferred<CommandResult<DocumentView>>();
    let call = 0;
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      reloadDocument: vi.fn(() =>
        call++ === 0
          ? first.promise
          : Promise.resolve<CommandResult<DocumentView>>({ ok: true, value: laterDocument() })
      )
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const pending = state.rereadDocument(2);
    await state.rereadDocument(2);
    expect(state.scopedDocument?.revision).toBe('rev-c');

    first.resolve({ ok: true, value: movedDocument() });
    expect(await pending).toBeNull();

    // The older answer is discarded whole rather than installed: `rev-b` describes
    // a parse the second read has already superseded, and answering `null` says
    // only that this read did not fail.
    expect(state.scopedDocument?.revision).toBe('rev-c');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40, 41]);
  }); // End of the "overlapping re-reads" case

  it('discards a re-read whose workspace has been replaced under it', async () => {
    // **The half neither per-document counter can see, and they miss it for
    // opposite reasons.** `open()` *clears* `projectionGenerations`, so a file whose
    // projection had never been replaced compares equal across two workspaces;
    // `rereadGenerations` is monotonic and `open()` leaves it alone, so it counts
    // straight through the replacement without ever encoding which workspace a read
    // belonged to. Meanwhile the identities themselves are reallocated by the load,
    // so an answer from the closed workspace installed into the open one describes a
    // file this state is not showing. `openGeneration` is the only capture that
    // catches it.
    const reload = deferred<CommandResult<DocumentView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      reloadDocument: vi.fn(() => reload.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const pending = state.rereadDocument(2);
    await state.open('/tmp/other');

    reload.resolve({ ok: true, value: movedDocument() });
    expect(await pending).toBeNull();

    expect(state.views.find((view) => view.id === 2)?.revision).toBe('rev-a');
    expect(state.status).toBe('ready');
  }); // End of the "replaced workspace" case
}); // End of the "reading one file again" suite

describe('moving a snippet', () => {
  it('re-reads the file, re-points the selection and forgets the text it was showing', async () => {
    const moved = movedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: true,
        moved: moved.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, moves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(state.fileText).not.toBeNull();

    // The commit is what the boundary answers, and the re-read is what it
    // answers with afterwards.
    documents.set(2, { ok: true, value: moved });
    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('saved');
    // The projection the list draws from is the one that was written.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
    // The selection followed the snippet by the identity the command answered
    // with, rather than staying at the position it used to occupy.
    expect(state.selected?.id.node).toBe(31);
    expect(state.selectedMatch?.label?.text).toBe('Signature');
    expect(state.notice).toBeNull();
    // And the raw viewer's snapshot was of bytes that have just been replaced,
    // so it was dropped and read again rather than redrawn.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 2\n' });
  }); // End of the "committed move" case

  it('shows the findings of a refusal and writes nothing', async () => {
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: { outcome: 'refused', verdict: 'RefusedForUnacknowledgedSuspicions', findings: [suspicion()] }
    };
    const commands = scriptedCommands({ moves: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toEqual({
      kind: 'answered',
      result: refused.ok ? refused.value : null,
      // Nothing was written, so no adoption was owed.
      adoption: { kind: 'notOwed' }
    });
    // Nothing was written, so nothing here moved: same projection, same
    // selection, and no second read of the document.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(state.selected?.id.node).toBe(10);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "refused move" case

  it('sends back exactly the findings a refusal carried, and no flag', async () => {
    const shown = suspicion();
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: { outcome: 'refused', verdict: 'RefusedForUnacknowledgedSuspicions', findings: [shown] }
    };
    const moved = movedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: moved.matches[1]!.id
      }
    };
    const commands = scriptedCommands({ moves: [refused, saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const first = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    const firstResult = first.kind === 'answered' ? first.result : null;
    expect(firstResult?.outcome).toBe('refused');
    const findings = firstResult?.outcome === 'refused' ? firstResult.findings : [];
    await state.moveMatch(baseDocument().matches[0]!.id, null, OPEN_REVISION, {
      accepted: findings
    });

    // The second call carried the findings back by content, unchanged. There is
    // no boolean anywhere in either call.
    const calls = vi.mocked(commands.moveMatch).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![3]).toEqual({ accepted: [] });
    expect(calls[1]![3]).toEqual({ accepted: [shown] });
    expect(JSON.stringify(calls[1])).not.toContain('force');
  }); // End of the "acknowledgement round trip" case

  it('takes the conflict projection as the one the next save is checked against', async () => {
    const disk = movedDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        expected: 'rev-a',
        found: 'rev-b',
        disk_revision: 'rev-b',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ moves: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('conflict');
    // The disk side replaced the parse the caller was editing against, without a
    // second command: the conflict already carried it.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    // The selection was made against bytes that are gone, and the snippet at its
    // position is a different one, so it is dropped with a notice rather than
    // silently re-pointed (R27).
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "conflict" case

  it('spends a move session it answered a conflict to, through the real answer', async () => {
    // **The confirmation pass's second finding, asserted from the production
    // wrapper rather than from a hand-built pair.** A conflict installs its disk
    // projection here — every identity a session holds came from the one it
    // replaced — and reports `adoption: notOwed`, because nothing was written and
    // nothing was re-read. `applyMove` therefore derives the invalidation from the
    // arm. The case this replaces handed `applyMove` a *refused* result beside an
    // adoption, which this method cannot answer at all.
    const before = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      matches: [
        makeMatch({ node: 10, document: 2, trigger: ':sig', path: matchListPath(0) }),
        makeMatch({ node: 11, document: 2, trigger: ':date', path: matchListPath(1) })
      ]
    });
    const disk = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-c',
      matches: [
        makeMatch({
          node: 10,
          document: 2,
          revision: 'rev-c',
          trigger: ':sig',
          path: matchListPath(0)
        }),
        makeMatch({
          node: 11,
          document: 2,
          revision: 'rev-c',
          trigger: ':date',
          path: matchListPath(1)
        })
      ]
    });
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, moves: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    // The session a screen would be holding: `:date` on its way to the top.
    const opened = choosePlacement(startMatchMove(before, before.matches[1]!, null), {
      kind: 'top'
    });
    const started = beginMove(opened, before.matches[1]!.id);
    expect(started).not.toBeNull();

    const answer = await state.moveMatch(
      before.matches[1]!.id,
      null,
      baseRevisionOf(opened),
      NOTHING_ACKNOWLEDGED
    );
    if (answer.kind !== 'answered') {
      throw new Error('the wrapper answered no outcome at all');
    }
    // The pair production really produces, asserted rather than assumed.
    expect(answer.result.outcome).toBe('conflict');
    expect(answer.adoption).toEqual({ kind: 'notOwed' });

    const done = applyMove(started!.session, answer.result, answer.adoption);
    expect(done.invalidated).toBe(true);
    // And it survives the dismissal, which is the state the finding was filed
    // about: choosing came back and `spent` stayed false for a session whose
    // identities this method had just replaced.
    const dismissed = dismissMoveOutcome(done);
    expect(canChoose(dismissed)).toBe(false);
    expect(matchMoveView(dismissed, [disk]).spent).toBe(true);
    expect(beginMove(dismissed, disk.matches[1]!.id)).toBeNull();
  }); // End of the "conflict spends the session" case

  it('reports a failed save and changes nothing on the screen', async () => {
    // **The fixture fails at the rename**, which is the step that means the
    // rename did *not* happen: `may_have_written` is `false`, so nothing this
    // window shows of the file has been invalidated. The case where it did is the
    // test below, and the two exist as a pair.
    const failure: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: { Write: { Io: { step: 'Rename', path: '/tmp/espanso/match/base.yml', kind: 'PermissionDenied', raw_os_error: 13 } } },
        may_have_written: false
      }
    };
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ moves: [{ ok: false, failure }] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // **The 2c-2 review's first finding, applied to a move at 2c-3b-1.** The
    // classification survives the wrapper, so a screen can tell this from
    // `noWorkspaceOpen` — and the reason travels beside the bit rather than only
    // to the developer channel.
    expect(outcome).toEqual({ kind: 'failed', mayHaveWritten: false, failure });
    expect(reported).toEqual([failure]);
    // A save that failed is not a workspace that failed: the window still shows
    // the configuration it was showing.
    expect(state.status).toBe('ready');
    expect(state.failure).toBeNull();
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    // Nothing was written, so nothing was re-read: three reads for the load and
    // one text read for the viewer, and no more of either.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(commands.documentText).toHaveBeenCalledTimes(1);
  }); // End of the "failed save" case

  it('re-reads the file when the failure says the rename may have completed', async () => {
    // **The other side of `may_have_written`, and the finding the review of Phase
    // 2b-2a filed as High.** The rename succeeded and the directory sync failed,
    // so the file may already hold the moved snippet: the command layer drops its
    // own cached parse in exactly this case, and a window that assumed nothing had
    // happened would go on drawing the pre-save order and the pre-save text.
    const failure: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: { Write: { Io: { step: 'SyncDirectory', path: '/tmp/espanso/match/base.yml', kind: 'Interrupted', raw_os_error: 4 } } },
        may_have_written: true
      }
    };
    const moved = movedDocument();
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ documents, moves: [{ ok: false, failure }] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    // What is on disk after the rename that did complete.
    documents.set(2, { ok: true, value: moved });
    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // It is still a failure and is still reported as one — and it carries the one
    // bit a screen cannot do without.
    expect(outcome).toEqual({ kind: 'failed', mayHaveWritten: true, failure });
    expect(reported).toEqual([failure]);
    expect(state.status).toBe('ready');
    // And the screen now describes the file as it may now be, rather than as it
    // was: the projection was re-read and the raw snapshot was dropped and taken
    // again.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(commands.documentText).toHaveBeenCalledTimes(2);
    // The selection was made against bytes that may be gone, and no identity was
    // answered for it, so it is repaired the ordinary way rather than kept.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "failed save that may have written" case

  it('leaves the screen alone when a save commits nothing', async () => {
    // **`committed: false` is a success, not a failure.** Moving one of two
    // byte-identical snippets produces a byte-identical candidate, and a candidate
    // equal to what the file already holds is not written — every rename installs
    // a new inode and drops eight classes of metadata for nothing. Both gates
    // still ran, no identity went stale, and the revision is the one this state
    // was already projecting, so there is nothing here to re-read.
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-a',
        committed: false,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const commands = scriptedCommands({ moves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    const outcome = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // A success, answered as one — and no adoption was owed, because nothing this
    // state describes went out of date.
    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('saved');
    // The selection is where it was, with no notice: nothing was invalidated, so
    // presenting a repair would be this application inventing an event.
    expect(state.selected?.id.node).toBe(10);
    expect(state.notice).toBeNull();
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    // And neither the projection nor the text was fetched again.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(commands.documentText).toHaveBeenCalledTimes(1);
  }); // End of the "committed: false" case

  it('refuses a snippet whose document this state does not hold', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    // Document 9 was never listed, so there is no base revision to send. The
    // command is not called at all, which is the assertion: inventing a base
    // revision would turn a move into a move of whatever now sits at the
    // position.
    const stranger = makeMatch({ node: 99, document: 9, trigger: ':nowhere' });
    // Its own arm, not a `failed` with `mayHaveWritten: false`: no command ran, so
    // there is no rejection to hand on and the type says so by carrying neither
    // field.
    expect(await state.moveMatch(stranger.id, null, OPEN_REVISION, NOTHING_ACKNOWLEDGED)).toEqual({
      kind: 'notAttempted'
    });
    expect(commands.moveMatch).not.toHaveBeenCalled();
  }); // End of the "unknown document" case

  it('sends the identities, the base revision and the acknowledgement, and no flag', async () => {
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: true,
        moved: null
      }
    };
    const commands = scriptedCommands({ moves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const base = baseDocument();
    await state.moveMatch(base.matches[0]!.id, base.matches[1]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.moveMatch).mock.calls[0]!;
    expect(call[0]).toEqual(base.matches[0]!.id);
    expect(call[1]).toEqual(base.matches[1]!.id);
    expect(call[2]).toBe('rev-a');
    expect(call[3]).toEqual(NOTHING_ACKNOWLEDGED);
    expect(JSON.stringify(call.slice(0, 4))).not.toContain('force');
  }); // End of the "arguments" case

  it('sends the caller’s own base revision, never the one it is projecting', async () => {
    // **The confirmation pass's second finding.** `createMatch` and `deleteMatch`
    // stopped substituting `view.revision` in the first review round; this method
    // did not, and the record justified the deferral by naming a component caller
    // that does not exist — `DetailPane.svelte` calls only `browser.saveMatch`, and
    // `BrowserState.moveMatch` has no production caller at all. The defect it was
    // left holding is the same one: a move decided against R0 and submitted after
    // the window reprojected to R1 was sent *as though decided at R1*, so the core
    // found no conflict to report and answered an identity failure instead.
    // A refusal, because it is the one answer that changes nothing on this state:
    // what the assertion is about is the argument, not the aftermath.
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [suspicion()]
      }
    };
    const commands = scriptedCommands({ moves: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const base = baseDocument();
    await state.moveMatch(base.matches[0]!.id, null, 'rev-older', NOTHING_ACKNOWLEDGED);

    // The state really is projecting something else, so this is not the same value
    // arriving by another route.
    expect(state.scopedDocument?.revision).toBe('rev-a');
    expect(vi.mocked(commands.moveMatch).mock.calls[0]![2]).toBe('rev-older');
  }); // End of the "stale move" case

  it('drops what it can no longer vouch for when the adoption itself fails, and says so', async () => {
    // **The second of the three latent shapes 2c-3b inherited, and the first case
    // that could observe it.** The move committed and the re-read failed, so every
    // projection and every identity this state holds for that file was minted from
    // bytes that are gone. Until 2c-3b-1 `adoptTheDocumentOnDisk`'s answer was
    // discarded here and the stale projection stayed installed under a committed
    // move — the window drawing the pre-move order over a file that had been
    // rewritten. They are dropped now, and the failure comes back **beside** the
    // committed outcome rather than in place of it.
    const moved = movedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: moved.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, moves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, {
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    const answer = await state.moveMatch(
      baseDocument().matches[0]!.id,
      null,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // The move is still a move.
    expect(answer.kind).toBe('answered');
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    // And the failure travels with it rather than to the console alone.
    expect(answer.kind === 'answered' ? answer.adoption.kind : null).toBe('failed');
    // Nothing stale is left on screen: no projection of that file, no selection
    // into it, and no held text.
    expect(state.scopedMatches).toEqual([]);
    expect(state.selected).toBeNull();
    expect(state.scopedDocument).toBeNull();
  }); // End of the "failed adoption" case

  it('drops the captured disk text of the file it moved a snippet in', async () => {
    // **The third of the three latent shapes.** `conflictText` is keyed by document
    // and `forgetFileText` is keyed by the viewer's target, so forgetting the
    // viewer's snapshot left the capture behind — and `rawTextOf` prefers it. The
    // identical omission the 2c-2 confirmation pass found in `saveMatch`, which had
    // no case here because nothing could reach this path.
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk: replacedDocument()
      }
    };
    const moved = movedDocument();
    const committed: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: moved.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [conflict], moves: [committed] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    // The viewer is closed, so the capture is the only text this window holds and
    // the assertion below cannot be satisfied by the viewer's snapshot instead.
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(state.rawTextOf(2)).toEqual({ kind: 'text', text: '# text of document 2\n' });

    // The raw conflict installed the disk projection, so the move is decided
    // against the identities that projection carries.
    documents.set(2, { ok: true, value: moved });
    await state.moveMatch(
      replacedDocument().matches[0]!.id,
      null,
      'rev-c',
      NOTHING_ACKNOWLEDGED
    );

    expect(state.rawTextOf(2)).toBeNull();
  }); // End of the "captured text dropped by a move" case

  it('keeps a mid-flight selection the reorder did not move, and drops one it did', async () => {
    // **The answer to the consult's Q5, measured rather than reasoned about.**
    // `repairAfter` re-resolves **positionally and then checks**, so what a person
    // who selected some other snippet mid-flight gets after a committed move
    // depends entirely on whether the reorder shifted the position they were on:
    // the same fingerprint at the held position is kept, and a different snippet
    // there drops the selection. Both are exercised here, against one file, so
    // the two answers are one comparison.
    //
    // **Both notices are the asked-for-move arms since 2c-3b's fix**: the window
    // reading (`docs/decisions/2c-3b-2-window-reading.md` section 7.1) measured
    // `kept` and `differentMatch` here telling the person their file changed on
    // disk directly above a panel reporting the very write they asked for, so
    // `moveMatch`'s adoption now attributes the reorder to their own move. The
    // *repair* is unchanged — same selection kept, same selection dropped.
    const before = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      matches: [
        makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 11, document: 2, trigger: ':date', label: 'Today' }),
        makeMatch({ node: 12, document: 2, trigger: ':sql', label: 'Query' })
      ]
    });
    // `:sig` moved below `:date`. Position 2 is untouched; position 1 is not.
    const after = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
        makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 32, document: 2, revision: 'rev-b', trigger: ':sql', label: 'Query' })
      ]
    });
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: after.matches[1]!.id
      }
    };

    /**
     * Moves `:sig` below `:date` while the person is looking at another snippet.
     *
     * @param position - Which snippet of the pre-move file they had selected.
     * @returns The state, after the move has been answered and adopted.
     */
    async function moveWhileLookingAt(position: number): Promise<ReturnType<typeof createBrowserState>> {
      const documents = new Map<number, CommandResult<DocumentView>>([
        [1, { ok: true, value: profileDocument() }],
        [2, { ok: true, value: before }],
        [3, { ok: true, value: otherDocument() }]
      ]);
      const commands = scriptedCommands({ documents, moves: [saved] });
      const state = createBrowserState(commands, () => undefined);
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      await state.select(before.matches[position]!);
      documents.set(2, { ok: true, value: after });
      await state.moveMatch(before.matches[0]!.id, before.matches[1]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
      return state;
    } // End of function moveWhileLookingAt()

    // `:sql` is at position 2 before and after, so it is found and re-pointed under
    // its new identity. The notice names the person's own move, never the disk.
    const untouched = await moveWhileLookingAt(2);
    expect(untouched.selected?.id.node).toBe(32);
    expect(untouched.notice).toBe('keptAfterMove');

    // `:date` was at position 1 and `:sig` is there now, so the selection is
    // dropped (R27 stands). **The snippet is still in the file**, one row above —
    // which is why the notice says so and tells the person to pick it again,
    // rather than reporting an external change that never happened. This closes
    // the hole `docs/decisions/2c-3b-1-notes.md` section 5.2 recorded.
    const shifted = await moveWhileLookingAt(1);
    expect(shifted.selected).toBeNull();
    expect(shifted.notice).toBe('displacedByMove');
    expect(shifted.scopedMatches.map((match) => match.trigger.trigger?.text)).toContain(':date');
  }); // End of the "mid-flight selection" case

  it('keeps the external notice when the re-read is not the parse the move produced', async () => {
    // **The attribution is a claim, and the adoption only makes it against the
    // revision the transaction ended on.** The move committed at `rev-b`, and the
    // re-read finds `rev-elsewhere`: somebody rewrote the file again between the
    // answer and the read, so the reorder on screen is *not* only the move the
    // person asked for. "The move you asked for reordered this file" would be
    // false there — the same defect class as `differentMatch` after an asked-for
    // move, with the two writers swapped — so the repair falls back to the
    // external sentences, which the 2c-3b-2 reading's L4b/L5 launches proved
    // accurate for a genuinely external change.
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: { document: 2, revision: 'rev-b', node: 31 }
      }
    };
    const raced = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-elsewhere',
      matches: [
        makeMatch({
          node: 40,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':stranger',
          label: 'Somebody else’s'
        }),
        makeMatch({
          node: 41,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':also',
          label: 'Also theirs'
        })
      ]
    });
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, moves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // Parked on `:date`, a snippet the person's own reorder would have shifted —
    // the exact position that answers `displacedByMove` when the re-read *is*
    // the move's parse (the case above).
    await state.select(baseDocument().matches[1]!);

    documents.set(2, { ok: true, value: raced });
    await state.moveMatch(
      baseDocument().matches[0]!.id,
      baseDocument().matches[1]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // Ordinary repair with the external attribution: the selection is dropped and
    // the notice says the file changed on disk, because it did — over and above
    // the committed move.
    expect(state.scopedDocument?.revision).toBe('rev-elsewhere');
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "re-read from another parse" case
}); // End of the "moving a snippet" suite

/**
 * The projection after a committed duplicate of `:sig` in {@link baseDocument}.
 *
 * A **new revision and new node identifiers**, because that is what a commit
 * really produces — and one more snippet than before, because that is what a
 * duplicate produces: the clone sits immediately after its source, and every
 * snippet below the source is one position further down.
 *
 * @returns The projection.
 */
function duplicatedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-b',
    matches: [
      makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 32, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' })
    ]
  });
} // End of function duplicatedDocument()

describe('duplicating a snippet', () => {
  it('re-reads the file, follows the selection to the clone and forgets the text', async () => {
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: true,
        moved: grown.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, duplicates: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // The person is parked on the source, which is what lets the selection
    // follow `moved` to the clone (consult Q8): the source is still the
    // selection that initiated the operation.
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(state.fileText).not.toBeNull();

    documents.set(2, { ok: true, value: grown });
    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('saved');
    // The projection the list draws from is the one that was written: one more
    // snippet, the clone directly below its source.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31, 32]);
    // The selection followed the clone by the identity the command answered
    // with, and no notice was raised for it — the person asked for the copy.
    expect(state.selected?.id.node).toBe(31);
    expect(state.notice).toBeNull();
    // And the raw viewer's snapshot was of bytes that have just been replaced,
    // so it was dropped and read again rather than redrawn.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 2\n' });
  }); // End of the "committed duplicate" case

  it('shows the findings of a refusal and writes nothing', async () => {
    // **The ordinary first answer of this command**: a byte-exact copy keeps
    // its source's trigger definition, and the transaction says so before
    // anything is written.
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [suspicion()]
      }
    };
    const commands = scriptedCommands({ duplicates: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toEqual({
      kind: 'answered',
      result: refused.ok ? refused.value : null,
      adoption: { kind: 'notOwed' }
    });
    // Nothing was written, so nothing here moved: same projection, same
    // selection, and no second read of the document.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(state.selected?.id.node).toBe(10);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "refused duplicate" case

  it('sends back exactly the findings a refusal carried, and no flag', async () => {
    const shown = suspicion();
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [shown]
      }
    };
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[1]!.id
      }
    };
    const commands = scriptedCommands({ duplicates: [refused, saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const first = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    const firstResult = first.kind === 'answered' ? first.result : null;
    expect(firstResult?.outcome).toBe('refused');
    const findings = firstResult?.outcome === 'refused' ? firstResult.findings : [];
    await state.duplicateMatch(baseDocument().matches[0]!.id, OPEN_REVISION, {
      accepted: findings
    });

    // The second call carried the findings back by content, unchanged. There is
    // no boolean anywhere in either call.
    const calls = vi.mocked(commands.duplicateMatch).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![2]).toEqual({ accepted: [] });
    expect(calls[1]![2]).toEqual({ accepted: [shown] });
    expect(JSON.stringify(calls[1])).not.toContain('force');
  }); // End of the "acknowledgement round trip" case

  it('takes the conflict projection as the one the next save is checked against', async () => {
    const disk = duplicatedDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        expected: 'rev-a',
        found: 'rev-b',
        disk_revision: 'rev-b',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ duplicates: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // The adoption stays `notOwed` — nothing was written and nothing was
    // re-read — which is exactly why `applyDuplication` derives the session's
    // invalidation from the arm rather than from this field.
    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('conflict');
    // The disk side replaced the parse the caller was deciding against,
    // without a second command: the conflict already carried it.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31, 32]);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    // The selection was made against bytes that are gone; the repair keeps the
    // external sentences, because the file really did move under the person.
    expect(state.selected?.id.node).toBe(30);
    expect(state.notice).toBe('kept');
  }); // End of the "conflict" case

  it('reports a failed save and changes nothing on the screen', async () => {
    // The fixture fails **at the rename**, which means the rename did not
    // happen: `may_have_written` is `false`, so nothing this window shows of
    // the file has been invalidated.
    const failure: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: {
          Write: {
            Io: {
              step: 'Rename',
              path: '/tmp/espanso/match/base.yml',
              kind: 'PermissionDenied',
              raw_os_error: 13
            }
          }
        },
        may_have_written: false
      }
    };
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ duplicates: [{ ok: false, failure }] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toEqual({ kind: 'failed', mayHaveWritten: false, failure });
    expect(reported).toEqual([failure]);
    expect(state.status).toBe('ready');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    // Nothing was written, so nothing was re-read.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "failed save" case

  it('re-reads cautiously when the rename may have completed, asserting nothing', async () => {
    // **The consult's Q8: a `may_have_written` failure attempts the cautious
    // re-read without asserting that the duplicate exists.** The adoption is
    // given no target and no `moved`, so nothing is selected on the clone's
    // account and the repair keeps the **external** sentences — an uncertain
    // write cannot claim the copy, and the sentence that claims less wins.
    const grown = duplicatedDocument();
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ documents, duplicates: [WRITE_MAY_HAVE_HAPPENED] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // Parked on `:date`, below the source: if the write did land, this
    // position now holds the clone.
    await state.select(baseDocument().matches[1]!);

    documents.set(2, { ok: true, value: grown });
    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toEqual({
      kind: 'failed',
      mayHaveWritten: true,
      failure: WRITE_MAY_HAVE_HAPPENED.ok ? null : WRITE_MAY_HAVE_HAPPENED.failure
    });
    // The screen now describes the file as it may now be.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31, 32]);
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    // The selection's position now holds the clone, and the notice is the
    // external one — never `displacedByDuplicate`, which would assert the copy
    // this application cannot account for.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "may have written" case

  it('leaves the screen alone when a save commits nothing', async () => {
    // `committed: false` is a documented success and is practically
    // unreachable for an insertion; the arm is exercised because the wrapper
    // carries it rather than hoping about it.
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-a',
        committed: false,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const commands = scriptedCommands({ duplicates: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(state.selected?.id.node).toBe(10);
    expect(state.notice).toBeNull();
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "committed: false" case

  it('refuses a snippet whose document this state does not hold', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const stranger = makeMatch({ node: 99, document: 9, trigger: ':nowhere' });
    expect(
      await state.duplicateMatch(stranger.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED)
    ).toEqual({ kind: 'notAttempted' });
    expect(commands.duplicateMatch).not.toHaveBeenCalled();
  }); // End of the "unknown document" case

  it('sends the identity, the base revision and the acknowledgement, and no flag', async () => {
    const commands = scriptedCommands({ duplicates: [{ ok: true, value: CREATED_NOTHING }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const base = baseDocument();
    await state.duplicateMatch(base.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.duplicateMatch).mock.calls[0]!;
    expect(call[0]).toEqual(base.matches[0]!.id);
    expect(call[1]).toBe('rev-a');
    expect(call[2]).toEqual(NOTHING_ACKNOWLEDGED);
    expect(JSON.stringify(call.slice(0, 3))).not.toContain('force');
  }); // End of the "arguments" case

  it('sends the caller’s own base revision, never the one it is projecting', async () => {
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [suspicion()]
      }
    };
    const commands = scriptedCommands({ duplicates: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    await state.duplicateMatch(baseDocument().matches[0]!.id, 'rev-older', NOTHING_ACKNOWLEDGED);

    // The state really is projecting something else, so this is not the same
    // value arriving by another route.
    expect(state.scopedDocument?.revision).toBe('rev-a');
    expect(vi.mocked(commands.duplicateMatch).mock.calls[0]![1]).toBe('rev-older');
  }); // End of the "stale duplicate" case

  it('drops what it can no longer vouch for when the adoption itself fails, and says so', async () => {
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, duplicates: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, {
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    const answer = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // The duplicate is still a duplicate: the outcome stays `Saved`, and the
    // failure travels beside it rather than in place of it (`PROGRESS.md` D2).
    expect(answer.kind).toBe('answered');
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    expect(answer.kind === 'answered' ? answer.adoption.kind : null).toBe('failed');
    // Nothing stale is left on screen: no projection of that file, no
    // selection into it — dropped through `forgetTheReplacedDocument`.
    expect(state.scopedMatches).toEqual([]);
    expect(state.selected).toBeNull();
    expect(state.scopedDocument).toBeNull();
  }); // End of the "failed adoption" case

  it('keeps a mid-flight selection the insertion did not shift, and drops one it did', async () => {
    // `repairAfter` re-resolves positionally and then checks, so what a person
    // who selected some other snippet mid-flight gets after a committed
    // duplicate depends on whether the insertion shifted the position they
    // were on: positions above the clone keep the same snippet, and every
    // position below the source now holds its former neighbour. Both notices
    // are the duplicate's own arms — the external sentences would tell the
    // person their file changed on disk directly above a panel reporting the
    // very copy they asked for, the defect class 2c-3b's window reading
    // measured for a move.
    const before = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      matches: [
        makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 11, document: 2, trigger: ':date', label: 'Today' }),
        makeMatch({ node: 12, document: 2, trigger: ':sql', label: 'Query' })
      ]
    });

    /**
     * Duplicates one snippet while the person is looking at another.
     *
     * @param source - Which snippet of the pre-save file is copied.
     * @param cloneIndex - Where the clone lands in the fresh projection.
     * @param after - The projection the commit produced.
     * @param position - Which snippet of the pre-save file they had selected.
     * @returns The state, after the duplicate has been answered and adopted.
     */
    async function duplicateWhileLookingAt(
      source: number,
      cloneIndex: number,
      after: DocumentView,
      position: number
    ): Promise<ReturnType<typeof createBrowserState>> {
      const saved: CommandResult<SaveResult> = {
        ok: true,
        value: {
          outcome: 'saved',
          revision: 'rev-b',
          committed: true,
          notes: [],
          backup_taken: false,
          moved: after.matches[cloneIndex]!.id
        }
      };
      const documents = new Map<number, CommandResult<DocumentView>>([
        [1, { ok: true, value: profileDocument() }],
        [2, { ok: true, value: before }],
        [3, { ok: true, value: otherDocument() }]
      ]);
      const commands = scriptedCommands({ documents, duplicates: [saved] });
      const state = createBrowserState(commands, () => undefined);
      await state.open(null);
      state.show({ kind: 'document', id: 2 });
      await state.select(before.matches[position]!);
      documents.set(2, { ok: true, value: after });
      await state.duplicateMatch(
        before.matches[source]!.id,
        OPEN_REVISION,
        NOTHING_ACKNOWLEDGED
      );
      return state;
    } // End of function duplicateWhileLookingAt()

    // `:sql` (last) duplicated while `:sig` at position 0 is selected: nothing
    // above the clone moved, so the selection is kept under its new identity
    // and the notice names the person's own copy.
    const grownAtEnd = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
        makeMatch({ node: 32, document: 2, revision: 'rev-b', trigger: ':sql', label: 'Query' }),
        makeMatch({ node: 33, document: 2, revision: 'rev-b', trigger: ':sql', label: 'Query' })
      ]
    });
    const untouched = await duplicateWhileLookingAt(2, 3, grownAtEnd, 0);
    expect(untouched.selected?.id.node).toBe(30);
    expect(untouched.notice).toBe('keptAfterDuplicate');

    // `:sig` (first) duplicated while `:date` at position 1 is selected: the
    // insertion shifted every later position down one, so position 1 now holds
    // the clone and the selection is dropped (R27 stands) — with the notice
    // naming the person's own copy, and the snippet still in the file one row
    // below.
    const grownAtFront = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 31, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
        makeMatch({ node: 32, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
        makeMatch({ node: 33, document: 2, revision: 'rev-b', trigger: ':sql', label: 'Query' })
      ]
    });
    const shifted = await duplicateWhileLookingAt(0, 1, grownAtFront, 1);
    expect(shifted.selected).toBeNull();
    expect(shifted.notice).toBe('displacedByDuplicate');
    expect(shifted.scopedMatches.map((match) => match.trigger.trigger?.text)).toContain(':date');
  }); // End of the "mid-flight selection" case

  it('keeps the external notice when the re-read is not the parse the duplicate produced', async () => {
    // The attribution is a claim, and the adoption only makes it against the
    // revision the transaction ended on: a re-read that finds any other
    // revision found a file that changed *again* after the commit, so "the
    // copy you asked for grew this file" would be false there and the repair
    // falls back to the external sentences.
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: { document: 2, revision: 'rev-b', node: 31 }
      }
    };
    const raced = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-elsewhere',
      matches: [
        makeMatch({
          node: 40,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':stranger',
          label: 'Somebody else’s'
        }),
        makeMatch({
          node: 41,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':also',
          label: 'Also theirs'
        })
      ]
    });
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, duplicates: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // Parked on `:date`, the position a real duplicate of `:sig` would shift —
    // the exact spot that answers `displacedByDuplicate` when the re-read *is*
    // the duplicate's parse.
    await state.select(baseDocument().matches[1]!);

    documents.set(2, { ok: true, value: raced });
    await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    expect(state.scopedDocument?.revision).toBe('rev-elsewhere');
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "re-read from another parse" case

  it('does not drag the selection away from a snippet clicked in another file mid-flight', async () => {
    // **The two-document selection race.** The person picks a snippet of file
    // 3 while a duplicate in file 2 is being written; the commit's adoption
    // must not reclaim the selection for the clone, because the source is no
    // longer the selection that initiated the operation.
    const grown = duplicatedDocument();
    const saved: SaveResult = {
      outcome: 'saved',
      revision: 'rev-b',
      committed: true,
      notes: [],
      backup_taken: false,
      moved: grown.matches[1]!.id
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const gate = deferred<CommandResult<SaveResult>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents }),
      duplicateMatch: vi.fn(async () => gate.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    // The duplicate is decided while the source is selected…
    await state.select(baseDocument().matches[0]!);
    const pending = state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    // …and the person picks a snippet of another file while it is in flight.
    await state.select(otherDocument().matches[0]!);
    documents.set(2, { ok: true, value: grown });
    gate.resolve({ ok: true, value: saved });
    await pending;

    // The selection stays where the person put it, in file 3, and no repair
    // touched it: file 2's repair is about file 2's selection, and there is
    // none.
    expect(state.selected?.document).toBe(3);
    expect(state.selected?.id.node).toBe(20);
  }); // End of the "selection moved to another file mid-flight" case

  it('drops a selection lookup in flight when a duplicate adopts', async () => {
    // The per-document projection counter, driven through a duplicate: a
    // `select()` awaiting `get_match` lands after the commit's adoption has
    // followed the clone, and its stale answer must be dropped whole rather
    // than repaired — repairing it would drag the person off the clone with a
    // notice about a file that moved under them, when what happened is the
    // copy they asked for.
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents, duplicates: [saved] }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    // Selected, and still being checked across the boundary when the
    // duplicate lands.
    const selecting = state.select(baseDocument().matches[0]!);
    documents.set(2, { ok: true, value: grown });
    await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    expect(state.selected?.id.node).toBe(31);

    lookup.resolve({
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
      }
    });
    await selecting;

    // The stale answer describes a parse this window has replaced, so it is
    // dropped whole: the person keeps the clone.
    expect(state.selected?.id.node).toBe(31);
    expect(state.notice).toBeNull();
    expect(commands.reloadDocument).not.toHaveBeenCalled();
  }); // End of the "lookup in flight during a duplicate" case

  it('does not reclaim a selection made on the source while the duplicate was in flight', async () => {
    // **Review round 1's High finding, first history.** The duplicate starts
    // while another snippet is selected; the person selects the source before
    // the answer lands. The current selection now *equals* the source, so a
    // wrapper that compared the current selection would follow `moved` to the
    // clone — but that selection is a new intent, expressed mid-flight, and
    // the clone must not hijack it. The initiating selection was not the
    // source, so the ordinary repair runs: same fingerprint at position 0,
    // kept under its new identity, with the person's own copy named.
    const grown = duplicatedDocument();
    const saved: SaveResult = {
      outcome: 'saved',
      revision: 'rev-b',
      committed: true,
      notes: [],
      backup_taken: false,
      moved: grown.matches[1]!.id
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const gate = deferred<CommandResult<SaveResult>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents }),
      duplicateMatch: vi.fn(async () => gate.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // The initiating selection is `:date`, not the source.
    await state.select(baseDocument().matches[1]!);
    const pending = state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    // The person selects the source while the duplicate is in flight.
    await state.select(baseDocument().matches[0]!);
    expect(state.selected?.id.node).toBe(10);
    documents.set(2, { ok: true, value: grown });
    gate.resolve({ ok: true, value: saved });
    await pending;

    // Not the clone: the mid-flight selection of the source is a new intent,
    // repaired in place rather than redirected.
    expect(state.selected?.id.node).toBe(30);
    expect(state.selected?.id.node).not.toBe(31);
    expect(state.notice).toBe('keptAfterDuplicate');
  }); // End of the "selected the source mid-flight" case

  it('does not reclaim the source after the person left it and returned mid-flight', async () => {
    // **Review round 1's High finding, second history.** The duplicate starts
    // on the source; the person moves to another snippet and comes back to the
    // source before the answer lands. The current selection equals the source
    // again — and it is a *different* selection, expressed after two clicks
    // this window must not undo. The captured object and the intent counter
    // are what tell it apart from an unchanged initiating selection.
    const grown = duplicatedDocument();
    const saved: SaveResult = {
      outcome: 'saved',
      revision: 'rev-b',
      committed: true,
      notes: [],
      backup_taken: false,
      moved: grown.matches[1]!.id
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const gate = deferred<CommandResult<SaveResult>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents }),
      duplicateMatch: vi.fn(async () => gate.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // The initiating selection is the source…
    await state.select(baseDocument().matches[0]!);
    const pending = state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    // …and the person leaves it and returns while the duplicate is in flight.
    await state.select(baseDocument().matches[1]!);
    await state.select(baseDocument().matches[0]!);
    expect(state.selected?.id.node).toBe(10);
    documents.set(2, { ok: true, value: grown });
    gate.resolve({ ok: true, value: saved });
    await pending;

    // Not the clone: leaving and returning is two intents, not none.
    expect(state.selected?.id.node).toBe(30);
    expect(state.selected?.id.node).not.toBe(31);
    expect(state.notice).toBe('keptAfterDuplicate');
  }); // End of the "left the source and returned" case

  it('does not reclaim the source when the person leaves and returns during the adoption re-read', async () => {
    // **The confirmation pass's High finding, its exact history.** The command
    // has already answered; what is deferred is the **adoption's own
    // `getDocument`**. The first fix validated the capture between the two
    // awaits and reduced it to a target identity, so a leave-and-return landing
    // in this window was still reclaimed — the helper compared only the
    // current selection's identity against the source. The capture now travels
    // whole and is re-validated after this very await, in the same synchronous
    // block that writes the selection.
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const scripted = scriptedCommands({ documents, duplicates: [saved] });
    // The adoption's re-read is the deferred call, and the test proves it
    // drove that await rather than assuming it: the wrapper resolves
    // `adoptionStarted` at the moment the deferred read is requested, and the
    // mid-flight clicks happen strictly after that.
    let deferAdoption = false;
    let adoptionRequested: (() => void) | null = null;
    const adoptionStarted = new Promise<void>((resolve) => {
      adoptionRequested = resolve;
    });
    const adoptionGate = deferred<CommandResult<DocumentView>>();
    const commands: BrowserCommands = {
      ...scripted,
      getDocument: vi.fn(async (id: number) => {
        if (deferAdoption && id === 2) {
          deferAdoption = false;
          adoptionRequested?.();
          return adoptionGate.promise;
        }
        return scripted.getDocument(id);
      })
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // The initiating selection is the source, and it is still held when the
    // command answers — the pre-command capture alone would follow the clone.
    await state.select(baseDocument().matches[0]!);
    deferAdoption = true;
    const pending = state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    await adoptionStarted;
    // The person leaves the source and returns to it **while the adoption's
    // re-read is in flight** — two intents this window must not undo.
    await state.select(baseDocument().matches[1]!);
    await state.select(baseDocument().matches[0]!);
    expect(state.selected?.id.node).toBe(10);
    adoptionGate.resolve({ ok: true, value: grown });
    const outcome = await pending;

    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    // Not the clone: the selection is repaired in place under its new identity.
    expect(state.selected?.id.node).toBe(30);
    expect(state.selected?.id.node).not.toBe(31);
    expect(state.notice).toBe('keptAfterDuplicate');
  }); // End of the "left and returned during the adoption re-read" case

  it('does not follow the clone when a failed selection expressed an intent mid-adoption', async () => {
    // **The generation half of the capture, isolated.** A `select()` on a row
    // this state cannot resolve bumps the global `selectGeneration` at entry
    // and then returns without replacing the held object — so the reference
    // half of the guard still matches and only the generation can refuse. The
    // person expressed an intent; the clone must not be selected on the back
    // of it, however the attempt ended.
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const scripted = scriptedCommands({ documents, duplicates: [saved] });
    let deferAdoption = false;
    let adoptionRequested: (() => void) | null = null;
    const adoptionStarted = new Promise<void>((resolve) => {
      adoptionRequested = resolve;
    });
    const adoptionGate = deferred<CommandResult<DocumentView>>();
    const commands: BrowserCommands = {
      ...scripted,
      getDocument: vi.fn(async (id: number) => {
        if (deferAdoption && id === 2) {
          deferAdoption = false;
          adoptionRequested?.();
          return adoptionGate.promise;
        }
        return scripted.getDocument(id);
      })
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    const heldThroughout = state.selected;
    deferAdoption = true;
    const pending = state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );
    await adoptionStarted;
    // A click this state cannot resolve: the intent counter moves, the held
    // object does not — the premise is asserted, not assumed.
    await state.select(makeMatch({ node: 99, document: 9, trigger: ':nowhere' }));
    expect(state.selected).toBe(heldThroughout);
    adoptionGate.resolve({ ok: true, value: grown });
    await pending;

    // Not the clone: the expressed intent refuses the follow, and the ordinary
    // repair re-points the still-held source under its new identity.
    expect(state.selected?.id.node).toBe(30);
    expect(state.selected?.id.node).not.toBe(31);
    expect(state.notice).toBe('keptAfterDuplicate');
  }); // End of the "failed selection intent mid-adoption" case

  it('stays a success and asserts no second writer when the clone is not identified', async () => {
    // **Review round 1's Medium, driven at the wrapper.** A committed answer
    // with `moved: null` means only that the clone could not be identified in
    // the read that followed the write — here the wrapper's own re-read then
    // succeeds at the transaction's **own** revision, so no second writer
    // exists at all, and nothing on this state may attribute the missing
    // identity to one. With no identity to follow, the repair runs with the
    // no-vouch fallback: the external `kept`, which claims less than
    // `keptAfterDuplicate` — the attribution's voucher is `moved`'s revision,
    // and a `null` vouches for nothing.
    const grown = duplicatedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, duplicates: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, { ok: true, value: grown });
    const outcome = await state.duplicateMatch(
      baseDocument().matches[0]!.id,
      OPEN_REVISION,
      NOTHING_ACKNOWLEDGED
    );

    // A success with a completed adoption — never a failure, and never a claim
    // about a second change.
    expect(outcome).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    expect(outcome.kind === 'answered' ? outcome.result.outcome : null).toBe('saved');
    // The selection is repaired in place under its new identity; nothing
    // follows a clone nobody identified.
    expect(state.selected?.id.node).toBe(30);
    expect(state.notice).toBe('kept');
  }); // End of the "clone not identified" case
}); // End of the "duplicating a snippet" suite

/**
 * A draft that changes one field and says *leave this alone* about every other.
 *
 * Written out rather than built, because `MatchDraft` has no optional property
 * and a helper that filled the gaps would be hiding exactly the thing the type is
 * arranged to expose.
 *
 * @returns The draft.
 */
function editedDraft(): MatchDraft {
  return {
    trigger: 'Unchanged',
    regex: 'Unchanged',
    replace: { Set: 'a new body' },
    markdown: 'Unchanged',
    html: 'Unchanged',
    image_path: 'Unchanged',
    form: 'Unchanged',
    label: 'Unchanged',
    comment: 'Unchanged',
    word: 'Unchanged',
    left_word: 'Unchanged',
    right_word: 'Unchanged',
    propagate_case: 'Unchanged',
    uppercase_style: 'Unchanged',
    force_mode: 'Unchanged',
    force_clipboard: 'Unchanged',
    paragraph: 'Unchanged',
    anchor: 'Unchanged',
    triggers: [],
    search_terms: [],
    vars: [],
    form_fields: []
  };
} // End of function editedDraft()

describe('saving one snippet’s fields', () => {
  it('adopts the identity the commit answered with, and re-reads the file', async () => {
    // **The consult's Q6, driven.** A caller cannot obtain this result without the
    // adoption, because the adoption happens inside the wrapper: the selection
    // follows `moved` rather than staying at the position it used to occupy, and
    // the raw viewer's snapshot of the replaced bytes is dropped and read again.
    const edited = movedDocument();
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: edited.matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, saves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);

    documents.set(2, { ok: true, value: edited });
    const answer = await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
    expect(state.selected?.id.node).toBe(31);
    expect(state.notice).toBeNull();
    expect(commands.documentText).toHaveBeenCalledTimes(2);
  }); // End of the "committed field save" case

  it('does not resolve the saved identity in a projection of another parse', async () => {
    // The same defect as the create's, in the adoption `saveMatch` and `moveMatch`
    // share: `moved` names a snippet in the revision the transaction ended on, and
    // the re-read is a separate command that can find a file somebody else has
    // rewritten. Comparing the node alone re-points the selection at whatever now
    // occupies that arena slot.
    const raced = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-elsewhere',
      matches: [
        makeMatch({
          node: 31,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':stranger',
          label: 'Somebody else’s'
        }),
        makeMatch({
          node: 32,
          document: 2,
          revision: 'rev-elsewhere',
          trigger: ':also',
          label: 'Also theirs'
        })
      ]
    });
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: { document: 2, revision: 'rev-b', node: 31 }
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, saves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, { ok: true, value: raced });
    await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );

    // Ordinary repair (R27) rather than adoption of an identity this projection is
    // not a parse of.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "moved from another parse" case

  it('sends the identity, the base revision, the draft and the acknowledgement', async () => {
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-a',
        committed: false,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const commands = scriptedCommands({ saves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const draft = editedDraft();
    await state.saveMatch(baseDocument().matches[0]!.id, draft, 'rev-a', NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.saveMatch).mock.calls[0]!;
    expect(call[0]).toEqual(baseDocument().matches[0]!.id);
    expect(call[1]).toBe(draft);
    expect(call[2]).toBe('rev-a');
    expect(call[3]).toEqual(NOTHING_ACKNOWLEDGED);
    // Nothing was written and the revision did not move, so nothing was re-read.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "arguments" case

  it('sends the draft’s own base revision, never the one it is projecting', async () => {
    // **The last of the four**, closed at 2c-3a-2 because it is the only one with a
    // component caller: `MatchEditor.svelte` now hands over
    // `matchEditor.baseRevisionOf(session)` and this method forwards it. Until
    // then an editor opened at R0 over a window that had since reprojected to R1
    // was submitted *as though drafted at R1*, so the core found no conflict to
    // report and could commit into a parse the person never saw.
    // A refusal, because it is the one answer that changes nothing on this state:
    // what the assertion is about is the argument, not the aftermath.
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [suspicion()]
      }
    };
    const commands = scriptedCommands({ saves: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-older',
      NOTHING_ACKNOWLEDGED
    );

    // The state really is projecting something else, so this is not the same value
    // arriving by another route.
    expect(state.scopedDocument?.revision).toBe('rev-a');
    expect(vi.mocked(commands.saveMatch).mock.calls[0]![2]).toBe('rev-older');
  }); // End of the "stale field save" case

  it('refuses to send anything for a document this state does not describe', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const stranger = makeMatch({ node: 99, document: 99 }).id;
    // **Its own arm, carrying nothing.** No command ran, so there is neither a
    // rejection to hand on nor a `mayHaveWritten` to weigh — and after the 2c-2-2
    // review the type says that rather than a comment claiming it beside an
    // `IpcFailure | null` that could have been `null` for any reason at all.
    expect(await state.saveMatch(stranger, editedDraft(), 'rev-a', NOTHING_ACKNOWLEDGED)).toEqual({
      kind: 'notAttempted'
    });
    expect(commands.saveMatch).not.toHaveBeenCalled();
  });

  it('shows the findings of a refusal and changes nothing here', async () => {
    const refused: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: [suspicion()]
      }
    };
    const commands = scriptedCommands({ saves: [refused] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const answer = await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('refused');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(state.selected?.id.node).toBe(10);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "refused field save" case

  it('adopts the disk projection a conflict handed back', async () => {
    const disk = movedDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        expected: 'rev-a',
        found: 'rev-b',
        disk_revision: 'rev-b',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ saves: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const answer = await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('conflict');
    // Nothing was written, and this state now describes the bytes the next save
    // will be checked against.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
    // R27: what is at the held position is a different snippet, so the selection
    // is dropped with a notice rather than silently re-pointed.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "conflicted field save" case

  it('re-reads the file when a failure may already have written it', async () => {
    const failed: CommandResult<SaveResult> = {
      ok: false,
      failure: {
        kind: 'command',
        error: {
          code: 'saveFailed',
          error: {
            Write: {
              Io: {
                step: 'SyncDirectory',
                path: '/tmp/espanso/match/base.yml',
                kind: 'Interrupted',
                raw_os_error: 4
              }
            }
          },
          may_have_written: true
        }
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, saves: [failed] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    documents.set(2, { ok: true, value: movedDocument() });
    // **The 2c-2 review's first finding.** The classification survives the wrapper:
    // a bare `null` here reads exactly like `noWorkspaceOpen`, and an editor that
    // could not tell them apart would say nothing was written about a file that may
    // already hold the edited snippet.
    expect(
      await state.saveMatch(
        baseDocument().matches[0]!.id,
        editedDraft(),
        'rev-a',
        NOTHING_ACKNOWLEDGED
      )
    ).toEqual({
      kind: 'failed',
      mayHaveWritten: true,
      // **2c-2-2's addition.** The reason travels beside the bit, because
      // `save_match`'s commonest rejection says which field cannot be written.
      failure: failed.ok ? null : failed.failure
    });

    // A failure at or after the rename means the file may already hold the edited
    // snippet, so nothing cached for it can be vouched for.
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([30, 31]);
  }); // End of the "may have written" case

  it('drops what it can no longer vouch for when the adoption itself fails, and says so', async () => {
    // **The 2c-2 review's second finding.** The save committed and the re-read
    // failed, so every projection and every identity this state holds for that file
    // was minted from bytes that are gone. Leaving them installed would have the
    // window drawing the pre-save snippet under a committed save; they are dropped,
    // and the failure comes back **beside** the committed outcome rather than in
    // place of it.
    const saved: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: movedDocument().matches[1]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, saves: [saved] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, {
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    const answer = await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );

    // The save is still a save.
    expect(answer.kind).toBe('answered');
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    // And the failure travels with it rather than to the console alone.
    expect(answer.kind === 'answered' ? answer.adoption.kind : null).toBe('failed');
    // Nothing stale is left on screen: no projection of that file, no selection
    // into it, and no held text.
    expect(state.scopedMatches).toEqual([]);
    expect(state.selected).toBeNull();
    expect(state.scopedDocument).toBeNull();
  }); // End of the "failed adoption" case

  it('does not drag the selection back when it moved while the save was in flight', async () => {
    // **The 2c-2 review's fourth finding.** Save snippet A, click snippet B before
    // the answer lands, and the adoption must not re-point the selection at A: that
    // is this window moving a selection nobody asked it to move.
    const edited = movedDocument();
    const answering = deferred<CommandResult<SaveResult>>();
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents }),
      saveMatch: vi.fn(() => answering.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const inFlight = state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );
    // The person clicks the other snippet of the same file while the save is out.
    await state.select(baseDocument().matches[1]!);
    expect(state.selected?.id.node).toBe(11);

    documents.set(2, { ok: true, value: edited });
    answering.resolve({
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: edited.matches[1]!.id
      }
    });
    await inFlight;

    // Node 31 is the saved snippet in the new revision. The selection was not on
    // it when the answer landed, so it is repaired the ordinary way — positionally
    // and then checked — and dropped with a notice rather than re-pointed at A.
    expect(state.selected?.id.node).not.toBe(31);
    expect(state.notice).toBe('differentMatch');
  }); // End of the "selection moved in flight" case

  it('leaves everything alone when the failure cannot have written', async () => {
    const failed: CommandResult<SaveResult> = {
      ok: false,
      failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
    };
    const commands = scriptedCommands({ saves: [failed] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    expect(
      await state.saveMatch(
        baseDocument().matches[0]!.id,
        editedDraft(),
        'rev-a',
        NOTHING_ACKNOWLEDGED
      )
    ).toEqual({ kind: 'failed', mayHaveWritten: false, failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } } });
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  });
}); // End of the "saving one snippet's fields" suite

/**
 * What `match/base.yml` projects to after its whole text was replaced.
 *
 * A **new revision**, a **new node** and a different snippet, because that is
 * what a whole-document replacement really produces: nothing minted from the
 * previous parse survives it, and there is no `moved` identity to follow.
 *
 * @returns The projection of the bytes a replacement wrote.
 */
function replacedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-c',
    matches: [
      makeMatch({ node: 40, document: 2, revision: 'rev-c', trigger: ':only', label: 'The only one' })
    ]
  });
} // End of function replacedDocument()

/**
 * A replacement that left the first snippet's own bytes exactly as they were.
 *
 * The other half of the re-resolution question: the file was rewritten, so every
 * identity in it is new, and the snippet the user had selected is nonetheless
 * still there and still spelled the same way.
 *
 * @returns The projection of the bytes such a replacement wrote.
 */
function replacedWithTheSameFirstSnippet(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-c',
    matches: [
      makeMatch({ node: 50, document: 2, revision: 'rev-c', trigger: ':sig', label: 'Signature' })
    ]
  });
} // End of function replacedWithTheSameFirstSnippet()

/**
 * A committed replacement, as the transaction would report it.
 *
 * `moved` is `null` and is not a defensive default: a whole-document replacement
 * has no single snippet it acted on, so there is no identity for it to carry.
 */
const RAW_COMMITTED_VALUE: SaveResult = {
  outcome: 'saved',
  revision: 'rev-c',
  committed: true,
  notes: [],
  backup_taken: true,
  moved: null
};

/** That replacement, as the boundary would answer it. */
const RAW_COMMITTED: CommandResult<SaveResult> = { ok: true, value: RAW_COMMITTED_VALUE };

describe("replacing a file's whole text", () => {
  it('forgets everything cached for the file and reads it again', async () => {
    // **The invalidation the 2b-2c-3b review's Medium finding asked for**, and it
    // is performed by this module rather than by whatever a caller passes: the
    // state's own method takes four arguments and no callback, so there is
    // nothing a caller could have supplied or forgotten.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    // What is on disk once the replacement has been written.
    documents.set(2, { ok: true, value: replacedDocument() });
    const outcome = outcomeOf(
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)
    );

    expect(outcome?.outcome).toBe('saved');
    // The projection: the one that was written, not the one that was replaced.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40]);
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    // The identity: dropped rather than re-pointed. A replacement answers
    // `moved: null` permanently, so there is nothing to follow, and what sits at
    // the held position is a different snippet.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
    // The raw viewer's snapshot: of bytes that have just been replaced whole.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 2\n' });
  }); // End of the "forgets everything cached" case

  it('finds the selection again when the replacement did not change that snippet', async () => {
    // Positional and **then checked** (R27): the identity is new, the position is
    // where re-resolution looks, and the source slice is what decides that what it
    // found is what was selected.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, { ok: true, value: replacedWithTheSameFirstSnippet() });
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    // Held, under the identity the **fresh** parse minted, never the one the
    // selection was made with.
    expect(state.selected?.id.node).toBe(50);
    expect(state.selected?.id.revision).toBe('rev-c');
    expect(state.notice).toBe('kept');
  }); // End of the "selection survives" case

  it('changes nothing on the screen when the text was already what the file held', async () => {
    // `committed: false` is a documented success: no new revision exists, nothing
    // went stale, and invalidating anyway would make this window discard
    // projections that are still correct.
    const unchanged: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-a',
        committed: false,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const commands = scriptedCommands({ raws: [unchanged] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);

    const outcome = outcomeOf(
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)
    );

    expect(outcome?.outcome).toBe('saved');
    expect(state.selected?.id.node).toBe(10);
    expect(state.notice).toBeNull();
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([10, 11]);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(commands.documentText).toHaveBeenCalledTimes(1);
  }); // End of the "committed: false" case

  it('reports a reload that failed and still answers with the committed save', async () => {
    // **The 2b-2c-3b review's High finding, seen from the state.** The bytes are
    // on disk; a reload that failed afterwards cannot unwrite them, so it must not
    // turn a commit into a `null`. It is reported on the same channel every other
    // failure of this state uses, and the committed outcome still comes back.
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/base.yml', kind: 'NotFound' }
    };
    const reported: IpcFailure[] = [];
    const commands: BrowserCommands = {
      ...scriptedCommands(),
      saveRawDocument: vi.fn(
        async (): Promise<RawSaveOutcome> => ({
          ok: true,
          value: RAW_COMMITTED_VALUE,
          reload: { kind: 'failed', failure }
        })
      )
    };
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);

    const outcome = outcomeOf(
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)
    );

    expect(outcome?.outcome).toBe('saved');
    expect(outcome?.outcome === 'saved' ? outcome.committed : null).toBe(true);
    expect(reported).toEqual([failure]);
    // A failed reload is not a failed workspace either.
    expect(state.status).toBe('ready');
    expect(state.failure).toBeNull();
  }); // End of the "reload failed" case

  it('takes the conflict projection as the one the next save is checked against', async () => {
    const disk = replacedDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ raws: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = outcomeOf(
      await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED)
    );

    expect(outcome?.outcome).toBe('conflict');
    // Nothing was written by this call, and the answer already carried the parse
    // of what the file really holds, so no second read was needed.
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40]);
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "conflict" case

  it('re-reads the file when the failure says the rename may have completed', async () => {
    // A replacement that failed after its rename means the file may already hold a
    // **whole new text**, so nothing this window caches for it can be vouched for.
    const failure: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: { Write: { Io: { step: 'SyncDirectory', path: '/tmp/espanso/match/base.yml', kind: 'Interrupted', raw_os_error: 4 } } },
        may_have_written: true
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ documents, raws: [{ ok: false, failure }] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, { ok: true, value: replacedDocument() });
    const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    // **The 2c-1b review's second finding.** This is not "nothing was written": the
    // rename may have completed, so the file may already hold the candidate, and a
    // caller that collapsed this into a bare `null` had no way to say so. The
    // failure is typed and carries the one fact a screen needs.
    expect(answer).toEqual({ kind: 'failed', mayHaveWritten: true });
    expect(outcomeOf(answer)).toBeNull();
    expect(reported).toEqual([failure]);
    expect(state.status).toBe('ready');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40]);
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.selected).toBeNull();
  }); // End of the "failed save that may have written" case

  it('says a failure before the rename wrote nothing, because that one it can tell', async () => {
    // The other half of the same finding: the two arms have to be distinguishable,
    // or the typed failure buys nothing over the `null` it replaced.
    const failure: IpcFailure = {
      kind: 'command',
      error: {
        code: 'saveFailed',
        error: {
          Write: {
            Io: {
              step: 'CreateTempFile',
              path: '/tmp/espanso/match/base.yml',
              kind: 'PermissionDenied',
              raw_os_error: 13
            }
          }
        },
        may_have_written: false
      }
    };
    const commands = scriptedCommands({ raws: [{ ok: false, failure }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    expect(answer).toEqual({ kind: 'failed', mayHaveWritten: false });
    // Nothing was re-read either: there is nothing this window has to forget.
    expect(commands.getDocument).toHaveBeenCalledTimes(3);
  }); // End of the "failure before the rename" case

  it('leaves the file unprojected, and says so, when the re-read itself fails', async () => {
    // The honest answer available here: this state cannot describe a file it could
    // not read, and blanking the workspace over one file would be a bigger claim
    // than the failure supports. What it must not do is keep the projection it
    // just invalidated — those are the bytes the replacement destroyed.
    const unreadable: IpcFailure = {
      kind: 'command',
      error: { code: 'io', path: '/tmp/espanso/match/base.yml', kind: 'PermissionDenied' }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const reported: IpcFailure[] = [];
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, (next) => reported.push(next));
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    documents.set(2, { ok: false, failure: unreadable });
    const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    // **The 2c-1b review's third finding.** The save committed and is answered as
    // one — and the fact that this window could not read the file back travels
    // *with* that answer, so a screen can say the window is out of step. Before the
    // fix it reached the developer channel and stopped there, and the person saw a
    // clean "the file was written".
    expect(issuerInvalidationOf(answer)).toMatchObject({ kind: 'failed' });
    expect(outcomeOf(answer)).toBeNull(); // the seal is one-shot; opened just above
    expect(reported).toEqual([unreadable]);
    // And the stale projection is gone rather than redrawn.
    expect(state.scopedMatches).toEqual([]);
    expect(state.scopedDocument).toBeNull();
  }); // End of the "re-read failed" case

  it('says the invalidation succeeded when the file really was re-read', async () => {
    // The oracle for the case above: a status that were always `failed` would pass
    // it and mean nothing.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    documents.set(2, { ok: true, value: replacedDocument() });
    const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    expect(issuerInvalidationOf(answer)).toEqual({ kind: 'done' });
  }); // End of the "invalidation succeeded" case

  it('answers a sealed outcome, which carries nothing until it is opened and opens once', async () => {
    // **Phase 2c-1b's answer to hole 4.2 of `2c-1a-notes.md`**: the pairing of a
    // document with a result happens here, in the adapter that issued the save and
    // therefore knows both, instead of at every caller that wants to describe it.
    // What that buys is checked rather than asserted in prose: the value carries
    // nothing a caller can read, and it opens exactly once.
    const commands = scriptedCommands({ raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const answer = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(answer.kind).toBe('sealed');
    if (answer.kind !== 'sealed') {
      return;
    }
    const sealed = answer.sealed;
    expect(Reflect.ownKeys(sealed)).toEqual([]);
    expect(JSON.stringify(sealed)).toBe('{}');

    const invalidations: DocumentId[] = [];
    const opened = openWholeDocumentSave(sealed, (invalidation) => {
      invalidations.push(invalidation.document);
    });
    expect(opened.kind).toBe('opened');
    expect(opened.kind === 'opened' ? opened.outcome.outcome : null).toBe('saved');
    expect(opened.kind === 'opened' ? opened.document : null).toBe(2);
    expect(invalidations).toEqual([2]);
    // And what this state's own invalidation made of it travels with the outcome
    // rather than only reaching the console.
    expect(opened.kind === 'opened' ? opened.issuerInvalidation : null).toEqual({ kind: 'done' });

    // A second open is refused rather than served with a no-op callback.
    expect(openWholeDocumentSave(sealed, () => undefined).kind).toBe('alreadyOpened');
  }); // End of the "sealed outcome" case

  it('never pairs a held snapshot with a revision installed under it', async () => {
    // **The 2c-1b review's first finding, and the one that could lose a file.**
    // The viewer holds text T0 at revision `rev-a`. Stale-identity recovery
    // installs a fresh projection at `rev-b`, and `readFileText` used to skip the
    // re-read because the document identity had not changed — so *Edit* paired T0
    // with `rev-b`, the save's revision check passed, and the bytes some other
    // process had written were overwritten by an edit of text nobody had seen.
    //
    // Two things close it, and both are asserted: the revision is captured **with**
    // the read rather than read off the projection later, and installing a
    // projection drops a snapshot taken against the one it replaces.
    const reparsed = makeDocument({
      id: 2,
      relativePath: 'match/base.yml',
      revision: 'rev-b',
      matches: [
        makeMatch({ node: 30, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' })
      ]
    });
    const texts = new Map<number, CommandResult<string>>([
      [2, { ok: true, value: 'the text at rev-a\n' }]
    ]);
    const commands = scriptedCommands({
      texts,
      match: {
        ok: false,
        failure: {
          kind: 'command',
          error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
        }
      },
      reload: { ok: true, value: reparsed }
    });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    expect(state.fileText).toEqual({ kind: 'text', text: 'the text at rev-a\n' });
    expect(state.fileTextRevision).toBe('rev-a');
    expect(commands.documentText).toHaveBeenCalledTimes(1);

    // What the other process wrote, which the recovery is about to project.
    texts.set(2, { ok: true, value: 'the text at rev-b\n' });
    await state.select(state.scopedMatches[0]!);

    // The projection moved, so the snapshot moved with it rather than staying
    // behind to be paired with the new revision.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
    expect(state.fileText).toEqual({ kind: 'text', text: 'the text at rev-b\n' });
    expect(state.fileTextRevision).toBe('rev-b');
  }); // End of the "held snapshot and installed revision" case

  it('pairs the revision the projection held when the read started, not the one it holds now', async () => {
    // The capture half on its own. `document_text` answers no revision, so the two
    // come from separate reads; taking the projection's revision *after* the text
    // would make it the newer of the two, and a single external write between them
    // would then be committed over. Taken before, the pair's revision is the older
    // one and the save gate refuses it as a conflict.
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);

    expect(state.fileTextRevision).toBe(baseDocument().revision);
    // Closing the viewer drops the pair whole: a revision that outlived its text
    // is half of a claim.
    await state.showFileText(false);
    expect(state.fileText).toBeNull();
    expect(state.fileTextRevision).toBeNull();
  }); // End of the "captured revision" case

  it('keeps the disk text of a conflicted save by document, not by what the pane shows', async () => {
    // **The 2c-1b review's fifth finding.** The editor may be open on file 2 while
    // the rest of the window points at file 3, and the conflict state still has to
    // be able to show the version on disk and to offer to load it — one of the
    // eight requirements of `2c-split-notes.md` section 6. Keyed on the viewer's
    // target, that affordance vanished on a click somewhere else.
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk: replacedDocument()
      }
    };
    const commands = scriptedCommands({ raws: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    // The window is looking at document 3; the save is of document 2.
    state.show({ kind: 'document', id: 3 });
    await state.showFileText(true);

    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    expect(state.rawTextOf(2)).toEqual({ kind: 'text', text: '# text of document 2\n' });
    // And the viewer is untouched: it is still showing the file it was showing.
    expect(state.fileTextTarget?.id).toBe(3);
    expect(state.fileText).toEqual({ kind: 'text', text: '# text of document 3\n' });
  }); // End of the "disk text by document" case

  it('drops that captured text when a field save moves the same file on', async () => {
    // **The 2c-2 confirmation pass's first finding.** `conflictText` is keyed by
    // document and `forgetFileText` is keyed by the viewer's target, so forgetting
    // the viewer's snapshot left the capture behind — and `rawTextOf` prefers it. A
    // raw save conflicts and captures version A; a field save then commits version
    // B; and this window went on answering A, two writes old, with nothing on
    // screen to say so.
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk: replacedDocument()
      }
    };
    const committed: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-d',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, raws: [conflict], saves: [committed] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    // The viewer is closed, so the capture is the only text this window holds and
    // the assertion below cannot be satisfied by the viewer's snapshot instead.
    await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);
    expect(state.rawTextOf(2)).toEqual({ kind: 'text', text: '# text of document 2\n' });

    await state.saveMatch(
      baseDocument().matches[0]!.id,
      editedDraft(),
      'rev-a',
      NOTHING_ACKNOWLEDGED
    );

    expect(state.rawTextOf(2)).toBeNull();
    // Another file's capture would be untouched, because nothing about it changed —
    // there is none here, and that is what makes the drop above document-scoped
    // rather than a blanket clear.
    expect(state.rawTextOf(3)).toBeNull();
  }); // End of the "field save drops the captured text" case

  it('answers nothing for a document this window holds no text of', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    expect(state.rawTextOf(2)).toBeNull();
    state.show({ kind: 'document', id: 2 });
    await state.showFileText(true);
    expect(state.rawTextOf(2)).toEqual({ kind: 'text', text: '# text of document 2\n' });
    expect(state.rawTextOf(3)).toBeNull();
  }); // End of the "no text held" case

  it('sends the document, the base revision, the text and the acknowledgement, and no flag', async () => {
    const commands = scriptedCommands({ raws: [RAW_COMMITTED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    // The same byte-exact sample the boundary's own test uses: a BOM, a CRLF pair,
    // a decomposed `e`-acute, an astral character and no final newline.
    const text = '\u{feff}matches:\r\n  - trigger: ":caf\u{65}\u{301}"\n    replace: \u{1f600}';
    await state.saveRawDocument(2, 'rev-a', text, NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.saveRawDocument).mock.calls[0]!;
    expect(call[0]).toBe(2);
    expect(call[1]).toBe('rev-a');
    expect(call[2]).toBe(text);
    expect(call[3]).toEqual({ accepted: [] });
    // The fifth argument is this module's own invalidation, not a caller's: the
    // state's method has no such parameter for a caller to pass one through.
    expect(typeof call[4]).toBe('function');
    expect(JSON.stringify([call[0], call[1], call[2], call[3]])).not.toContain('force');
  }); // End of the "arguments" case
}); // End of the "replacing a file's whole text" suite

/** What a new snippet says, on the wire. */
const NEW_MATCH: NewMatch = { trigger: ':new', replace: 'a new body' };

/** The bottom of the destination file's list. */
const AT_END: NewMatchPosition = { End: {} };

/**
 * The projection of `match/base.yml` after a snippet has been added to it.
 *
 * **Every identity differs from `baseDocument`'s**, revision and node both,
 * because that is what a commit really does: a `MatchId` records the revision it
 * was minted from, and a fixture whose surviving identities happened to stay equal
 * would let a stale-reference bug pass unnoticed.
 *
 * @returns The projection.
 */
function grownDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-b',
    matches: [
      makeMatch({ node: 40, document: 2, revision: 'rev-b', trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 41, document: 2, revision: 'rev-b', trigger: ':date', label: 'Today' }),
      makeMatch({ node: 42, document: 2, revision: 'rev-b', trigger: ':new', label: 'New' })
    ]
  });
} // End of function grownDocument()

/**
 * A **third** parse of the same file, which reuses the node a create just minted.
 *
 * Not a contrivance: a `MatchId`'s node is an arena slot, and a parse of different
 * bytes allocates the same slots for whatever it finds. So a file another program
 * rewrote between the transaction's answer and this window's re-read really can
 * answer node 42 — for a snippet nobody in this window has ever seen.
 *
 * @returns The projection a re-read would install.
 */
function racedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-elsewhere',
    matches: [
      makeMatch({
        node: 42,
        document: 2,
        revision: 'rev-elsewhere',
        trigger: ':stranger',
        label: 'Somebody else’s'
      }),
      makeMatch({
        node: 43,
        document: 2,
        revision: 'rev-elsewhere',
        trigger: ':also',
        label: 'Also theirs'
      })
    ]
  });
} // End of function racedDocument()

/** The three-snippet projection the deletion cases start from. */
function crowdedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    matches: [
      makeMatch({ node: 10, document: 2, trigger: ':sig', label: 'Signature' }),
      makeMatch({ node: 11, document: 2, trigger: ':date', label: 'Today' }),
      makeMatch({ node: 12, document: 2, trigger: ':note', label: 'Note' })
    ]
  });
} // End of function crowdedDocument()

/**
 * The same file after the **first** of its three snippets has been deleted.
 *
 * The identity churn is the point, as it is for {@link grownDocument}: a new
 * revision and two node numbers that appear nowhere before the commit.
 *
 * @returns The projection.
 */
function thinnedDocument(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: 'rev-c',
    matches: [
      makeMatch({ node: 50, document: 2, revision: 'rev-c', trigger: ':date', label: 'Today' }),
      makeMatch({ node: 51, document: 2, revision: 'rev-c', trigger: ':note', label: 'Note' })
    ]
  });
} // End of function thinnedDocument()

/**
 * Every match identity a projection carries, as comparable strings.
 *
 * All three fields, because all three are the identity: a comparison that dropped
 * the revision would call two identities equal across the very reparse the
 * revision exists to separate.
 *
 * @param view - The projection to read.
 * @returns One string per snippet.
 */
function identitiesOf(view: DocumentView): readonly string[] {
  return view.matches.map((match) => `${match.id.document}/${match.id.revision}/${match.id.node}`);
} // End of function identitiesOf()

describe('creating a snippet', () => {
  it('sends the revision this state is projecting, and the request unchanged', async () => {
    const commands = scriptedCommands({ creates: [{ ok: true, value: CREATED_NOTHING }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.createMatch).mock.calls[0]!;
    expect(call[0]).toBe(2);
    expect(call[1]).toBe(NEW_MATCH);
    expect(call[2]).toBe(AT_END);
    expect(call[3]).toBe('rev-a');
    expect(call[4]).toEqual(NOTHING_ACKNOWLEDGED);
    expect(JSON.stringify(call.slice(0, 5))).not.toContain('force');
  }); // End of the "arguments" case

  it('sends the submission’s own base revision, never the one it is projecting', async () => {
    // **The first review round's second finding.** The wrapper used to read
    // `view.revision` at the moment of the call, which silently rebased a stale
    // form: open a form at R0, let anything reproject the file to R1, submit, and
    // the core sees no conflict — so a snippet is written into a parse the person
    // never saw, at an anchor resolved in it. Nothing else decides this: the
    // command's own conflict check can only compare what it is sent.
    const commands = scriptedCommands({ creates: [{ ok: true, value: CREATED_NOTHING }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    await state.createMatch(2, NEW_MATCH, AT_END, 'rev-older', NOTHING_ACKNOWLEDGED);

    // The state really is projecting something else, so this is not the same value
    // arriving by another route.
    expect(state.scopedDocument?.revision).toBe('rev-a');
    expect(vi.mocked(commands.createMatch).mock.calls[0]![3]).toBe('rev-older');
  }); // End of the "stale form" case

  it('refuses to send anything for a document this state does not describe', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    expect(await state.createMatch(99, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED)).toEqual({
      kind: 'notAttempted'
    });
    expect(commands.createMatch).not.toHaveBeenCalled();
  });

  it('adopts the created snippet, selects it, and re-reads the file', async () => {
    const grown = grownDocument();
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[2]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, creates: [created] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);
    await state.showFileText(true);

    documents.set(2, { ok: true, value: grown });
    const answer = await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40, 41, 42]);
    // The person has just made this snippet, so this is where the window points.
    expect(state.selected?.id.node).toBe(42);
    expect(state.notice).toBeNull();
    // The snapshot the raw viewer held is of bytes that no longer exist.
    expect(commands.documentText).toHaveBeenCalledTimes(2);
  }); // End of the "committed create" case

  it('does not resolve the created identity in a projection of another parse', async () => {
    // **The first review round's third finding.** `moved` is minted in the
    // revision the transaction ended on; the projection this window reads
    // afterwards is a separate command, and another program can rewrite the file
    // in between. Resolving by arena node alone then selects an unrelated snippet
    // and calls it the one the person has just made.
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: { document: 2, revision: 'rev-b', node: 42 }
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, creates: [created] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    // The re-read answers a parse that is not the one the save ended on, and it
    // reuses node 42 for a snippet nobody here created.
    documents.set(2, { ok: true, value: racedDocument() });
    await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    // Ordinary repair (R27), not adoption: what sits at the held position is a
    // different snippet, so the selection is dropped and said to be dropped.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "moved from another parse" case

  it('drops a selection lookup in flight when a create adopts', async () => {
    // **The first review round's fourth finding.** `select()` verifies its identity
    // across the boundary, and that answer can land *after* a commit has replaced
    // the projection it was taken from. Its repair then re-points the selection to
    // whatever the pre-save position now holds — dragging the person off the
    // snippet they have just made, with a notice about a file that moved under
    // them.
    const grown = grownDocument();
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[2]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents, creates: [created], reload: { ok: true, value: grown } }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    // Selected, and still being checked across the boundary when the create lands.
    const selecting = state.select(baseDocument().matches[0]!);
    documents.set(2, { ok: true, value: grown });
    await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
    expect(state.selected?.id.node).toBe(42);

    lookup.resolve({
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
      }
    });
    await selecting;

    // The stale answer describes a parse this window has replaced, so it is
    // dropped whole rather than repaired: the person keeps the snippet they made.
    expect(state.selected?.id.node).toBe(42);
    expect(state.notice).toBeNull();
    expect(commands.reloadDocument).not.toHaveBeenCalled();
  }); // End of the "lookup in flight during a create" case

  it('does not drag the selection away from a snippet clicked while it was in flight', async () => {
    const grown = grownDocument();
    const created: SaveResult = {
      outcome: 'saved',
      revision: 'rev-b',
      committed: true,
      notes: [],
      backup_taken: false,
      moved: grown.matches[2]!.id
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const gate = deferred<CommandResult<SaveResult>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents }),
      createMatch: vi.fn(async () => gate.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const pending = state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
    // The person picks something else while the create is being written.
    await state.select(otherDocument().matches[0]!);
    documents.set(2, { ok: true, value: grown });
    gate.resolve({ ok: true, value: created });
    await pending;

    // `saveMatch`'s rule, restated for an operation with no held target: the
    // selection moves only when nothing else has moved it since.
    expect(state.selected?.id.node).toBe(20);
    expect(state.selected?.document).toBe(3);
  }); // End of the "selection moved during the create" case

  it('does not select a snippet the middle pane is not showing', async () => {
    const grown = grownDocument();
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[2]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, creates: [created] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    // The sidebar is showing another file, so a snippet of `base.yml` is not in
    // the list at all and selecting one would point at a row nobody can see.
    state.show({ kind: 'document', id: 3 });
    await state.select(otherDocument().matches[0]!);

    documents.set(2, { ok: true, value: grown });
    await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(state.selected?.id.node).toBe(20);
    expect(state.notice).toBeNull();
  }); // End of the "out of scope" case

  it('re-reads the file when a failure may already have written it', async () => {
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, creates: [WRITE_MAY_HAVE_HAPPENED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    documents.set(2, { ok: true, value: grownDocument() });
    expect(await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED)).toEqual({
      kind: 'failed',
      mayHaveWritten: true,
      failure: WRITE_MAY_HAVE_HAPPENED.ok ? null : WRITE_MAY_HAVE_HAPPENED.failure
    });
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40, 41, 42]);
  }); // End of the "may have written" case

  it('drops what it can no longer vouch for when the adoption itself fails, and says so', async () => {
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: { document: 2, revision: 'rev-b', node: 42 }
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, creates: [created] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    documents.set(2, {
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    const answer = await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    // A committed write is never afterwards reported as an error (D2): the failure
    // travels beside the outcome, and the outcome is still `saved`.
    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'failed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    expect(state.scopedMatches).toEqual([]);
    expect(state.selected).toBeNull();
  }); // End of the "adoption failed" case

  it('adopts the disk projection a conflict handed back', async () => {
    const disk = grownDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        expected: 'rev-a',
        found: 'rev-b',
        disk_revision: 'rev-b',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ creates: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const answer = await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('conflict');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40, 41, 42]);
  }); // End of the "conflicted create" case
}); // End of the "creating a snippet" suite

describe('deleting a snippet', () => {
  it('sends the identity, the revision this state is projecting, and no flag', async () => {
    const commands = scriptedCommands({ deletes: [{ ok: true, value: CREATED_NOTHING }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const id = baseDocument().matches[0]!.id;
    await state.deleteMatch(id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.deleteMatch).mock.calls[0]!;
    expect(call[0]).toEqual(id);
    expect(call[1]).toBe('rev-a');
    expect(call[2]).toEqual(NOTHING_ACKNOWLEDGED);
    expect(JSON.stringify(call.slice(0, 3))).not.toContain('force');
  }); // End of the "arguments" case

  it('refuses to send anything for a document this state does not describe', async () => {
    const commands = scriptedCommands();
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const stranger = makeMatch({ node: 99, document: 99 }).id;
    expect(await state.deleteMatch(stranger, OPEN_REVISION, NOTHING_ACKNOWLEDGED)).toEqual({
      kind: 'notAttempted'
    });
    expect(commands.deleteMatch).not.toHaveBeenCalled();
  });

  it('sends the session’s own base revision, never the one it is projecting', async () => {
    // The same finding as the create's, and it bites harder here: a deletion
    // resolves an identity to a **position**, so a stale identity beside a fresh
    // base is answered as an identity failure rather than as the revision conflict
    // the person should be shown — and nothing in this window decided that.
    const commands = scriptedCommands({ deletes: [{ ok: true, value: CREATED_NOTHING }] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const id = baseDocument().matches[0]!.id;
    await state.deleteMatch(id, 'rev-older', NOTHING_ACKNOWLEDGED);

    // The state really is projecting something else, so this is not the same value
    // arriving by another route.
    expect(state.scopedDocument?.revision).toBe('rev-a');
    expect(vi.mocked(commands.deleteMatch).mock.calls[0]![1]).toBe('rev-older');
  }); // End of the "stale session" case

  it('keeps no pre-commit identity anywhere after a commit that answered none', async () => {
    // **The consult's Q7, and the reason the fixture churns every identity.** The
    // likeliest defect is reading `moved: null` as "leave the selection alone" and
    // then holding the deleted — or another pre-commit — `MatchId` over a
    // projection that has been replaced. A fixture whose surviving identities
    // happened to stay equal would let exactly that pass.
    const before = crowdedDocument();
    const after = thinnedDocument();
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [{ DoubledSequenceSeparation: { edit: 0 } }],
        backup_taken: true,
        // Null by construction, permanently: the snippet that was deleted has no
        // identity in the new revision.
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [deleted] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(before.matches[0]!);
    await state.showFileText(true);

    documents.set(2, { ok: true, value: after });
    const answer = await state.deleteMatch(before.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'done' } });
    const stale = new Set(identitiesOf(before));
    for (const identity of identitiesOf({ ...after, matches: state.scopedMatches })) {
      expect(stale.has(identity)).toBe(false);
    } // End of the loop over every identity the view now holds
    const held = state.selected;
    expect(held).not.toBeNull();
    expect(stale.has(`${held!.id.document}/${held!.id.revision}/${held!.id.node}`)).toBe(false);
    // The snippet now at the deleted one's former ordinal position, adopted under
    // its own new identity.
    expect(held!.id.node).toBe(50);
    expect(held!.position).toBe(0);
    expect(state.notice).toBe('deleted');
    expect(commands.documentText).toHaveBeenCalledTimes(2);
  }); // End of the consult's Q7 case

  it('drops a selection lookup in flight when a deletion adopts', async () => {
    // **The first review round's fourth finding, in the shape it was found in.**
    // Start selecting the snippet, delete it while its `get_match` is still in
    // flight, and let the adoption select the neighbour with the `deleted` notice
    // the consult's Q1 mandates. The stale answer then lands, repairs the
    // pre-commit identity against the file the deletion produced, and replaces
    // that notice with `differentMatch` — telling the person their file moved
    // under them when what happened is the deletion they asked for.
    const before = crowdedDocument();
    const after = thinnedDocument();
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({ documents, deletes: [deleted], reload: { ok: true, value: after } }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const selecting = state.select(before.matches[0]!);
    documents.set(2, { ok: true, value: after });
    await state.deleteMatch(before.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
    expect(state.notice).toBe('deleted');

    lookup.resolve({
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'identityStaleRevision', expected: 'rev-c', found: 'rev-a' }
      }
    });
    await selecting;

    expect(state.selected?.id.node).toBe(50);
    expect(state.notice).toBe('deleted');
    expect(commands.reloadDocument).not.toHaveBeenCalled();
  }); // End of the "lookup in flight during a deletion" case

  it('falls back to the new last snippet when the one deleted was last', async () => {
    const before = crowdedDocument();
    const after = thinnedDocument();
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [deleted] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(before.matches[2]!);

    documents.set(2, { ok: true, value: after });
    await state.deleteMatch(before.matches[2]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(state.selected?.id.node).toBe(51);
    expect(state.selected?.position).toBe(1);
    expect(state.notice).toBe('deleted');
  }); // End of the "deleted the last snippet" case

  it('selects nothing when the file no longer holds any snippet', async () => {
    // The wrapper does not repeat `matchDeletion.ts`'s last-snippet refusal — the
    // core is what decides, and this is what the window does if it ever commits.
    const before = baseDocument();
    const empty = makeDocument({ id: 2, relativePath: 'match/base.yml', revision: 'rev-c' });
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [deleted] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(before.matches[0]!);

    documents.set(2, { ok: true, value: empty });
    await state.deleteMatch(before.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(state.selected).toBeNull();
    expect(state.notice).toBe('deleted');
    expect(state.scopedMatches).toEqual([]);
  }); // End of the "file now holds none" case

  it('repairs another snippet’s selection the ordinary way, and does not hijack it', async () => {
    const before = crowdedDocument();
    const after = thinnedDocument();
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [deleted] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    // The person is looking at the *second* snippet and deletes the first.
    await state.select(before.matches[1]!);

    documents.set(2, { ok: true, value: after });
    await state.deleteMatch(before.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    // R27, unchanged: what is at the held position is a different snippet, so the
    // selection is dropped with its own notice rather than re-pointed — and the
    // deletion path did not take it over.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "another snippet was selected" case

  it('re-reads the file when a failure may already have written it', async () => {
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [WRITE_MAY_HAVE_HAPPENED] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    documents.set(2, { ok: true, value: thinnedDocument() });
    expect(
      await state.deleteMatch(baseDocument().matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED)
    ).toEqual({
      kind: 'failed',
      mayHaveWritten: true,
      failure: WRITE_MAY_HAVE_HAPPENED.ok ? null : WRITE_MAY_HAVE_HAPPENED.failure
    });
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([50, 51]);
  }); // End of the "may have written" case

  it('drops what it can no longer vouch for when the adoption itself fails, and says so', async () => {
    const before = crowdedDocument();
    const deleted: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-c',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: before }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const commands = scriptedCommands({ documents, deletes: [deleted] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(before.matches[0]!);

    documents.set(2, {
      ok: false,
      failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    const answer = await state.deleteMatch(before.matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'failed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('saved');
    expect(state.scopedMatches).toEqual([]);
    expect(state.selected).toBeNull();
  }); // End of the "adoption failed" case

  it('adopts the disk projection a conflict handed back', async () => {
    const disk = thinnedDocument();
    const conflict: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'conflict',
        expected: 'rev-a',
        found: 'rev-c',
        disk_revision: 'rev-c',
        disk_text: DISK_TEXT,
        disk
      }
    };
    const commands = scriptedCommands({ deletes: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });

    const answer = await state.deleteMatch(baseDocument().matches[0]!.id, OPEN_REVISION, NOTHING_ACKNOWLEDGED);

    expect(answer).toMatchObject({ kind: 'answered', adoption: { kind: 'notOwed' } });
    expect(answer.kind === 'answered' ? answer.result.outcome : null).toBe('conflict');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([50, 51]);
  }); // End of the "conflicted deletion" case
}); // End of the "deleting a snippet" suite

/**
 * A stale-identity answer, for the three cases below.
 *
 * The failure a `get_match` gives when the identity it was handed was minted in a
 * parse the file has moved on from — the one answer that sends `select()` into the
 * recovery path, which is where every cancellation below can be observed.
 */
const STALE_IDENTITY: CommandResult<MatchView> = {
  ok: false,
  failure: {
    kind: 'command',
    error: { code: 'identityStaleRevision', expected: 'rev-b', found: 'rev-a' }
  }
};

/**
 * A projection of `match/other.yml` holding a **different** snippet.
 *
 * What a re-resolution of that file finds when it runs: the held position is
 * occupied by something whose source text is not the selection's, which is R27's
 * `differentMatch` and clears the selection with a notice. Its whole purpose is to
 * make a repair that runs *visible*, so that a test asserting one did not run
 * cannot pass by finding the same snippet again.
 *
 * @returns The projection.
 */
function restockedOtherDocument(): DocumentView {
  return makeDocument({
    id: 3,
    relativePath: 'match/other.yml',
    revision: 'rev-b',
    matches: [makeMatch({ node: 21, document: 3, revision: 'rev-b', trigger: ':psql', label: 'Other' })]
  });
} // End of function restockedOtherDocument()

describe('what cancels a selection lookup, and what does not', () => {
  it('repairs a stale identity in one file when another file is replaced whole', async () => {
    // **The confirmation pass's High finding, and it was a regression the first fix
    // round introduced.** That round closed a narrower defect by bumping a single
    // global counter in `installView`, and made `forgetTheReplacedDocument`'s bump
    // unconditional beside it. The trade: a raw save of file B committing while a
    // click on a snippet of file A was still being checked across the boundary
    // cancelled A's lookup, so A's stale identity was never repaired and the state
    // went on holding a `MatchId` that resolves to nothing — this sub-phase's
    // declared worst failure. B's invalidation is a statement about B.
    const committed: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({
        documents,
        raws: [committed],
        reload: { ok: true, value: restockedOtherDocument() }
      }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    // A click on a snippet of file 3, still being checked across the boundary.
    const selecting = state.select(otherDocument().matches[0]!);
    // File 2's whole text is replaced and committed while it is in flight. Nothing
    // here is about file 3: the selection is not in it, and its projection is
    // untouched.
    await state.saveRawDocument(2, OPEN_REVISION, '# replaced\n', NOTHING_ACKNOWLEDGED);
    expect(state.selected?.id.node).toBe(20);

    lookup.resolve(STALE_IDENTITY);
    await selecting;

    // The repair ran, and it ran against file 3.
    expect(commands.reloadDocument).toHaveBeenCalledWith(3);
    // R27: the snippet at the held position is a different one, so the selection is
    // dropped with a notice rather than left naming a parse that is gone.
    expect(state.selected).toBeNull();
    expect(state.notice).toBe('differentMatch');
  }); // End of the "another file was replaced" case

  it('drops a stale identity lookup when the file it names is the one replaced', async () => {
    // The twin, and the cancellation the first fix round's fourth finding was about:
    // the same operation on the **same** file must still cancel. Nothing here is
    // over-cautious — every identity file 3 held was minted from bytes the
    // replacement wrote over.
    const committed: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({
        documents,
        raws: [committed],
        reload: { ok: true, value: restockedOtherDocument() }
      }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);

    const selecting = state.select(otherDocument().matches[0]!);
    await state.saveRawDocument(3, OPEN_REVISION, '# replaced\n', NOTHING_ACKNOWLEDGED);
    // The replacement dropped everything held for file 3 and looked for the
    // selection again — positionally and then checked — in the projection it read
    // back, which still holds that snippet.
    expect(state.notice).toBe('kept');
    expect(state.selected?.id.node).toBe(20);

    lookup.resolve(STALE_IDENTITY);
    await selecting;

    // Nothing moved: the answer describes a parse this state has replaced, so it
    // never reaches the recovery at all.
    expect(commands.reloadDocument).not.toHaveBeenCalled();
    expect(state.notice).toBe('kept');
    expect(state.selected?.id.node).toBe(20);
  }); // End of the "the same file was replaced" case

  it('drops a stale identity lookup when another file’s create takes the selection', async () => {
    // **The half a per-document counter cannot see**, and the reason the selection
    // generation survives the scoping above rather than being folded into it. A
    // create commits in file 2 and its adoption moves the selection to the snippet
    // it just made; file 3's projection is untouched, so file 3's counter says
    // nothing — and the pending lookup for file 3, repaired, would drag the person
    // straight back off the snippet they made.
    const grown = grownDocument();
    const created: CommandResult<SaveResult> = {
      ok: true,
      value: {
        outcome: 'saved',
        revision: 'rev-b',
        committed: true,
        notes: [],
        backup_taken: false,
        moved: grown.matches[2]!.id
      }
    };
    const documents = new Map<number, CommandResult<DocumentView>>([
      [1, { ok: true, value: profileDocument() }],
      [2, { ok: true, value: baseDocument() }],
      [3, { ok: true, value: otherDocument() }]
    ]);
    const lookup = deferred<CommandResult<MatchView>>();
    const commands: BrowserCommands = {
      ...scriptedCommands({
        documents,
        creates: [created],
        reload: { ok: true, value: restockedOtherDocument() }
      }),
      getMatch: vi.fn(() => lookup.promise)
    };
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    // The "All" scope, so the created snippet really is in the list the middle
    // pane is showing and the adoption's second condition is met.

    const selecting = state.select(otherDocument().matches[0]!);
    documents.set(2, { ok: true, value: grown });
    await state.createMatch(2, NEW_MATCH, AT_END, OPEN_REVISION, NOTHING_ACKNOWLEDGED);
    expect(state.selected?.id.node).toBe(42);

    lookup.resolve(STALE_IDENTITY);
    await selecting;

    expect(state.selected?.id.node).toBe(42);
    expect(state.notice).toBeNull();
    expect(commands.reloadDocument).not.toHaveBeenCalled();
  }); // End of the "another file's create took the selection" case
}); // End of the "what cancels a selection lookup" suite
