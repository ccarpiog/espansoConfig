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
  MatchView,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import { diagnostic, makeDocument, makeMatch, makeSummary } from './fixtures';
import { createBrowserState, type BrowserCommands } from './workspace.svelte';

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
    const outcome = await state.moveMatch(baseDocument().matches[0]!, null, NOTHING_ACKNOWLEDGED);

    expect(outcome?.outcome).toBe('saved');
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

    const outcome = await state.moveMatch(baseDocument().matches[0]!, null, NOTHING_ACKNOWLEDGED);

    expect(outcome).toEqual(refused.ok ? refused.value : null);
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

    const first = await state.moveMatch(baseDocument().matches[0]!, null, NOTHING_ACKNOWLEDGED);
    expect(first?.outcome).toBe('refused');
    const findings = first?.outcome === 'refused' ? first.findings : [];
    await state.moveMatch(baseDocument().matches[0]!, null, { accepted: findings });

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
        disk
      }
    };
    const commands = scriptedCommands({ moves: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.moveMatch(baseDocument().matches[0]!, null, NOTHING_ACKNOWLEDGED);

    expect(outcome?.outcome).toBe('conflict');
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

    const outcome = await state.moveMatch(baseDocument().matches[0]!, null, NOTHING_ACKNOWLEDGED);

    expect(outcome).toBeNull();
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
    const outcome = await state.moveMatch(baseDocument().matches[0]!, null, NOTHING_ACKNOWLEDGED);

    // It is still a failure and is still reported as one.
    expect(outcome).toBeNull();
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

    const outcome = await state.moveMatch(baseDocument().matches[0]!, null, NOTHING_ACKNOWLEDGED);

    // A success, answered as one.
    expect(outcome?.outcome).toBe('saved');
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
    expect(await state.moveMatch(stranger, null, NOTHING_ACKNOWLEDGED)).toBeNull();
    expect(commands.moveMatch).not.toHaveBeenCalled();
  }); // End of the "unknown document" case

  it('sends the revision of the projection it is editing against', async () => {
    const moved = movedDocument();
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
    await state.moveMatch(base.matches[0]!, base.matches[1]!, NOTHING_ACKNOWLEDGED);

    const call = vi.mocked(commands.moveMatch).mock.calls[0]!;
    expect(call[0]).toEqual(base.matches[0]!.id);
    expect(call[1]).toEqual(base.matches[1]!.id);
    expect(call[2]).toBe('rev-a');
    void moved;
  }); // End of the "base revision" case
}); // End of the "moving a snippet" suite

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
    const outcome = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

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

    const outcome = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

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

    const outcome = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

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
        disk
      }
    };
    const commands = scriptedCommands({ raws: [conflict] });
    const state = createBrowserState(commands, () => undefined);
    await state.open(null);
    state.show({ kind: 'document', id: 2 });
    await state.select(baseDocument().matches[0]!);

    const outcome = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

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
    const outcome = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    expect(outcome).toBeNull();
    expect(reported).toEqual([failure]);
    expect(state.status).toBe('ready');
    expect(state.scopedMatches.map((match) => match.id.node)).toEqual([40]);
    expect(commands.getDocument).toHaveBeenCalledTimes(4);
    expect(state.selected).toBeNull();
  }); // End of the "failed save that may have written" case

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
    const outcome = await state.saveRawDocument(2, 'rev-a', 'matches: []\n', NOTHING_ACKNOWLEDGED);

    // The save committed and is answered as one.
    expect(outcome?.outcome).toBe('saved');
    expect(reported).toEqual([unreadable]);
    // And the stale projection is gone rather than redrawn.
    expect(state.scopedMatches).toEqual([]);
    expect(state.scopedDocument).toBeNull();
  }); // End of the "re-read failed" case

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
