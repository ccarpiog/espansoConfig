/**
 * The eleven command wrappers, against a stubbed `invoke`.
 *
 * What is under test here is the *boundary*, not the Rust behind it: which
 * command name each wrapper calls, which arguments it sends, and — the part
 * that matters most — that a rejection comes back as a typed failure the caller
 * cannot ignore. The Rust half is tested in `src-tauri/src/commands.rs`, where
 * a real `Workspace` reads a real synthetic tree.
 *
 * **On the missing per-callback JSDoc**: as in `errors.test.ts`, the `it`
 * description is the description, and a JSDoc sentence above it would be a
 * second one free to disagree. `docs/decisions/1b-2a-notes.md` §14 records that
 * as a decision. Callbacks over ten lines still close with a comment.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RawSaveInvalidation } from './commands';
import type { MatchDraft, NewMatch } from './types';

/** Every call the stubbed `invoke` received, in order. */
const calls: Array<{ command: string; args: unknown }> = [];

/** What the next `invoke` should do. */
let outcome: { resolve: unknown } | { reject: unknown } = { resolve: undefined };

/**
 * A committed replacement, as Rust would have written it.
 *
 * The one stub answer that has to be shape-correct: every other wrapper hands
 * its value straight back, so `undefined` is a fine stand-in for them, and
 * {@link saveRawDocument} is the only one that **reads** what came back — it has
 * to, because the reload it owes is a function of `outcome` and `committed`.
 */
const COMMITTED = {
  outcome: 'saved',
  revision: 'f'.repeat(64),
  committed: true,
  notes: [],
  backup_taken: true,
  moved: null
} as const;

vi.mock('@tauri-apps/api/core', () => ({
  /**
   * The stub every wrapper in `commands.ts` goes through.
   *
   * @param command - The command name the wrapper chose.
   * @param args - The arguments it built.
   * @returns Whatever {@link outcome} says.
   */
  invoke: (command: string, args: unknown): Promise<unknown> => {
    calls.push({ command, args });
    if ('reject' in outcome) {
      return Promise.reject(outcome.reject);
    }
    return Promise.resolve(outcome.resolve);
  }
}));

const commands = await import('./commands');
const {
  COMMAND_NAMES,
  createMatch,
  deleteMatch,
  documentText,
  duplicateMatch,
  getDocument,
  getMatch,
  listDocuments,
  moveMatch,
  openWorkspace,
  reloadDocument,
  saveMatch,
  saveRawDocument
} = commands;

/** Every function this module exports, sorted. */
const EXPORTED_FUNCTIONS = Object.entries(commands)
  .filter(([, value]) => typeof value === 'function')
  .map(([name]) => name)
  .sort();

/** A match identity, exactly as it would have arrived from Rust. */
const IDENTITY = { document: 3, revision: 'a'.repeat(64), node: 11 };

/**
 * The content of a snippet to create — hand-authored and neutral.
 *
 * Both fields are required, so this is written out whole rather than spread from
 * a partial: a trigger with no body is not a snippet this application creates.
 */
const NEW_MATCH: NewMatch = { trigger: ':new', replace: 'a new snippet' };

/**
 * A draft that changes nothing, written out in full.
 *
 * Every property of a `MatchDraft` is required on purpose — an omitted field is
 * a compile error rather than a default nobody wrote — so a draft that touches
 * one field is this value with one property replaced. Hand-authored and neutral:
 * nothing here is real configuration (CLAUDE.md section 1).
 */
const UNCHANGED_DRAFT: MatchDraft = {
  trigger: 'Unchanged',
  regex: 'Unchanged',
  replace: 'Unchanged',
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

beforeEach(() => {
  calls.length = 0;
  outcome = { resolve: undefined };
});

describe('the command wrappers', () => {
  it('call the twelve wire names, in order, and export no thirteenth wrapper', async () => {
    // Two claims, because the first alone is what the review of Phase 1b-2a
    // objected to: calling the known wrappers says nothing about whether another
    // exists. The second reads the module's exports rather than the names this
    // file already knows, so a wrapper added for a mutating command fails here
    // even though nothing calls it.
    await openWorkspace(null);
    await listDocuments();
    await getDocument(1);
    await getMatch(IDENTITY);
    await documentText(1);
    await reloadDocument(1);
    await moveMatch(IDENTITY, null, 'a'.repeat(64), { accepted: [] });
    await saveMatch(IDENTITY, UNCHANGED_DRAFT, 'a'.repeat(64), { accepted: [] });
    await createMatch(1, NEW_MATCH, { End: {} }, 'a'.repeat(64), { accepted: [] });
    await deleteMatch(IDENTITY, 'a'.repeat(64), { accepted: [] });
    outcome = { resolve: COMMITTED };
    await saveRawDocument(1, 'a'.repeat(64), 'matches: []\n', { accepted: [] }, () => {});
    outcome = { resolve: undefined };
    await duplicateMatch(IDENTITY, 'a'.repeat(64), { accepted: [] });
    expect(calls.map((call) => call.command)).toEqual([...COMMAND_NAMES]);
    expect(EXPORTED_FUNCTIONS).toEqual([
      'createMatch',
      'deleteMatch',
      'documentText',
      'duplicateMatch',
      'getDocument',
      'getMatch',
      'listDocuments',
      'moveMatch',
      'openWorkspace',
      'reloadDocument',
      'saveMatch',
      'saveRawDocument'
    ]);
  }); // End of the "call the twelve wire names" case

  it('exports no wrapper for the Phase 2 command that does not exist', () => {
    // `validateMatch` has no phase yet. `wire_contract.rs` asserts its absence
    // from the registered Rust surface; this asserts it on the side that would
    // have to call it.
    //
    // `moveMatch` left this list at Phase 2b-2a, `saveMatch` at 2b-2b-3,
    // `createMatch` and `deleteMatch` at 2b-2c-2, `saveRawDocument` at
    // 2b-2c-3b, and `duplicateMatch` at 2c-3c-2, which is the only way a name
    // may leave it: the command exists and is registered.
    const forbidden = ['validateMatch'];
    for (const name of forbidden) {
      expect(EXPORTED_FUNCTIONS).not.toContain(name);
      expect([...COMMAND_NAMES] as string[]).not.toContain(
        name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
      );
    }
  }); // End of the "exports no wrapper for the Phase 2 command" case

  it('sends a save as an identity, a whole draft, a base revision and an acknowledgement', async () => {
    // The second command that writes, and the three things about its arguments
    // that are decisions rather than plumbing: the draft travels **whole** rather
    // than as a list of changes, the base revision travels beside it because
    // everything below the match mapping is addressed by index, and the
    // acknowledgement is a list of findings. A `force` flag would undo the whole
    // design, and its absence is asserted rather than assumed.
    const draft: MatchDraft = { ...UNCHANGED_DRAFT, replace: { Set: 'a new value' } };
    await saveMatch(IDENTITY, draft, 'b'.repeat(64), { accepted: [] });
    expect(calls[0]?.command).toBe('save_match');
    expect(calls[0]?.args).toEqual({
      id: IDENTITY,
      draft,
      baseRevision: 'b'.repeat(64),
      acknowledgement: { accepted: [] }
    });
    // The quotes are load-bearing, and the move's own assertion cannot be
    // copied here: a draft names espanso's `force_mode` and `force_clipboard`
    // keys, so a bare substring search for "force" finds two legitimate keys
    // and would fail whatever the arguments were. What must be absent is a
    // property *called* `force`.
    expect(JSON.stringify(calls[0]?.args)).not.toContain('"force"');
    // A field nobody touched must reach Rust as the tri-state's own tag, never
    // as a `null` and never as a missing key: the first is a deserialization
    // error there and the second a default, and only one of the three spellings
    // is the one this side means.
    const sent = JSON.parse(JSON.stringify(calls[0]?.args)) as { draft: Record<string, unknown> };
    expect(sent.draft.trigger).toBe('Unchanged');
    expect(sent.draft.replace).toEqual({ Set: 'a new value' });
  }); // End of the "save arguments" case

  it('sends a move as identities, a base revision and an acknowledgement', async () => {
    // The one command that writes, and the three things about its arguments that
    // are decisions rather than plumbing: the destination is an **identity**
    // rather than a position, the base revision travels beside it, and the
    // acknowledgement is a list of findings. A `force` flag would undo the whole
    // design, and its absence is asserted rather than assumed.
    const anchor = { document: 3, revision: 'a'.repeat(64), node: 17 };
    await moveMatch(IDENTITY, anchor, 'a'.repeat(64), { accepted: [] });
    expect(calls[0]?.command).toBe('move_match');
    expect(calls[0]?.args).toEqual({
      id: IDENTITY,
      after: anchor,
      baseRevision: 'a'.repeat(64),
      acknowledgement: { accepted: [] }
    });
    expect(JSON.stringify(calls[0]?.args)).not.toContain('force');
  }); // End of the "move arguments" case

  it('sends a creation as a document, a closed snippet, a position and a base revision', async () => {
    // The third command that writes, and the three decisions in its arguments.
    // The file is named by the identity this window holds, never by a path. The
    // snippet is closed at two required values, so a caller cannot smuggle a key
    // espanso's schema does not fix. The position is an **object** for every one
    // of its three arms, including the two that carry nothing, because one wire
    // shape per enum is what lets Rust and this side agree without a special case.
    const anchor = { document: 3, revision: 'a'.repeat(64), node: 17 };
    await createMatch(3, NEW_MATCH, { After: { anchor } }, 'c'.repeat(64), { accepted: [] });
    expect(calls[0]?.command).toBe('create_match');
    expect(calls[0]?.args).toEqual({
      document: 3,
      newMatch: NEW_MATCH,
      position: { After: { anchor } },
      baseRevision: 'c'.repeat(64),
      acknowledgement: { accepted: [] }
    });
    expect(JSON.stringify(calls[0]?.args)).not.toContain('force');
    // The two operand-less positions travel as objects rather than as bare
    // strings, which is the half a Rust unit variant would have broken silently.
    await createMatch(3, NEW_MATCH, { Front: {} }, 'c'.repeat(64), { accepted: [] });
    await createMatch(3, NEW_MATCH, { End: {} }, 'c'.repeat(64), { accepted: [] });
    const sent = calls.map((call) => (call.args as { position: unknown }).position);
    expect(sent[1]).toEqual({ Front: {} });
    expect(sent[2]).toEqual({ End: {} });
  }); // End of the "creation arguments" case

  it('sends a raw save as a document, a base revision, the whole text and an acknowledgement', async () => {
    // The fifth command that writes, and the only one whose argument is a file's
    // own text. Three claims: the file is named by identity and never by a path,
    // the text crosses **unchanged**, and there is no flag anywhere — which
    // matters more here than anywhere else, because this is the one save that may
    // write text the YAML reader rejects and the acknowledgement is the only
    // thing standing where a `force` would otherwise be.
    //
    // The sample carries a leading BOM, a CRLF pair, a decomposed `e`-acute, an
    // astral character and no final newline: the wrapper must not touch any of
    // them, and `toEqual` on the argument object compares the string identity of
    // the code points.
    const text = '\u{feff}matches:\r\n  - trigger: ":caf\u{65}\u{301}"\n    replace: \u{1f600}';
    outcome = { resolve: COMMITTED };
    await saveRawDocument(7, 'e'.repeat(64), text, { accepted: [] }, () => {});
    expect(calls[0]?.command).toBe('save_raw_document');
    expect(calls[0]?.args).toEqual({
      document: 7,
      baseRevision: 'e'.repeat(64),
      text,
      acknowledgement: { accepted: [] }
    });
    expect(JSON.stringify(calls[0]?.args)).not.toContain('force');
    const sent = (calls[0]?.args as { text: string }).text;
    expect(sent.startsWith('\u{feff}')).toBe(true);
    expect(sent).toContain('\r\n');
    expect(sent).toContain('\u{65}\u{301}');
    expect(sent.endsWith('\u{1f600}')).toBe(true);
  }); // End of the "raw save arguments" case

  it('sends a deletion as an identity, a base revision and an acknowledgement', async () => {
    // The fourth command that writes, and the only one with nothing to say about
    // where anything goes: a deletion has no destination and no content. What it
    // must not gain is a path, a position, or a flag.
    await deleteMatch(IDENTITY, 'd'.repeat(64), { accepted: [] });
    expect(calls[0]?.command).toBe('delete_match');
    expect(calls[0]?.args).toEqual({
      id: IDENTITY,
      baseRevision: 'd'.repeat(64),
      acknowledgement: { accepted: [] }
    });
    expect(JSON.stringify(calls[0]?.args)).not.toContain('force');
  }); // End of the "deletion arguments" case

  it('sends a duplicate as an identity, a base revision and an acknowledgement', async () => {
    // The sixth command that writes, and the second with nothing to say about
    // where anything goes: the clone lands immediately after its source, by
    // design, so there is no destination argument to send. What it must not
    // gain is a position, a placement, or a flag — and the acknowledgement is
    // the load-bearing argument here, because the ordinary path is
    // refuse-then-acknowledge.
    await duplicateMatch(IDENTITY, 'e'.repeat(64), { accepted: [] });
    expect(calls[0]?.command).toBe('duplicate_match');
    expect(calls[0]?.args).toEqual({
      id: IDENTITY,
      baseRevision: 'e'.repeat(64),
      acknowledgement: { accepted: [] }
    });
    expect(JSON.stringify(calls[0]?.args)).not.toContain('force');
  }); // End of the "duplicate arguments" case

  it('send the arguments the Rust signatures declare', async () => {
    await openWorkspace('/Users/somebody/.config/espanso');
    await getDocument(4);
    await getMatch(IDENTITY);
    await documentText(4);
    expect(calls[0]?.args).toEqual({ root: '/Users/somebody/.config/espanso' });
    expect(calls[1]?.args).toEqual({ id: 4 });
    expect(calls[2]?.args).toEqual({ id: IDENTITY });
    expect(calls[3]?.args).toEqual({ id: 4 });
  });

  it('hand a document text back as the string Rust sent, unchanged', async () => {
    // The wrapper must not touch the text. The sample carries, in order: a
    // CRLF pair, a leading UTF-8 BOM, a precomposed and a decomposed `e`-acute
    // written as escapes so no editor can normalise this file, an astral
    // character, a NUL, the two Unicode line separators, two real trailing
    // spaces and no final newline — the set the byte-exact corpus fixtures pin
    // plus the three no fixture holds, and the same set `dispatch_check.rs`
    // drives through the real dispatcher. `toBe` compares the string identity
    // of the code points, so a normalising wrapper fails here.
    //
    // This says nothing about the platform webview: `invoke` is mocked here and
    // Tauri's mock runtime swaps WKWebView out on the Rust side, so U+2028
    // surviving this case is a fact about the wrapper, not about postMessage.
    const bytes =
      '\u{feff}a: 1\r\nb: \u{e9} e\u{301} \u{1f600}\nc: "nul\u{0} ls\u{2028} ps\u{2029}"\nd: |\n  kept  ';
    outcome = { resolve: bytes };
    const result = await documentText(7);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('unreachable');
    }
    expect(result.value).toBe(bytes);
    // Stated separately from the equality above, because a comparison that
    // normalised both sides would pass it: these are the individual characters.
    expect(result.value.startsWith('\u{feff}')).toBe(true);
    expect(result.value).toContain('\r\n');
    expect(result.value).toContain('\u{65}\u{301}');
    expect(result.value).toContain('\u{0}');
    expect(result.value).toContain('\u{2028}');
    expect(result.value).toContain('\u{2029}');
    expect(result.value.endsWith('  ')).toBe(true);
  }); // End of the "document text back unchanged" case

  it('send an explicit null rather than an absent root', async () => {
    // `Option<PathBuf>` reads `null` as `None`; omitting the key would leave
    // Tauri to decide, and `exactOptionalPropertyTypes` exists precisely so
    // that "absent" and "null" are not quietly the same thing.
    await openWorkspace(null);
    expect(calls[0]?.args).toEqual({ root: null });
  });

  it('return the value on the ok arm', async () => {
    outcome = { resolve: { root: '/x', documents: 2 } };
    const result = await openWorkspace(null);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('unreachable');
    }
    expect(result.value.root).toBe('/x');
  });

  it('return a stale identity as a typed command failure, not as a throw', async () => {
    // The R27 path across the boundary. A wrapper that let the rejection
    // escape, or that collapsed it into a bare `null`, would fail here.
    outcome = {
      reject: {
        code: 'identityStaleRevision',
        expected: 'b'.repeat(64),
        found: 'a'.repeat(64)
      }
    };
    const result = await getMatch(IDENTITY);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('unreachable');
    }
    expect(result.failure.kind).toBe('command');
    if (result.failure.kind !== 'command') {
      throw new Error('unreachable');
    }
    expect(result.failure.error.code).toBe('identityStaleRevision');
  }); // End of the "return a stale identity as a typed command failure" case

  it('classify a rejection that is not one of ours without inventing a code', async () => {
    outcome = { reject: 'Command get_match not allowed by ACL' };
    const result = await getMatch(IDENTITY);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('unreachable');
    }
    expect(result.failure.kind).toBe('unexpected');
  });
});

describe('the reload a committed raw save owes', () => {
  /** Every invalidation the wrapper handed to the reload, in order. */
  let invalidations: RawSaveInvalidation[] = [];

  beforeEach(() => {
    invalidations = [];
  });

  /**
   * A reload that records what it was told, for a test to assert on.
   *
   * @param invalidation - What the wrapper decided became stale.
   */
  function record(invalidation: RawSaveInvalidation): void {
    invalidations.push(invalidation);
  }

  it('runs it once, with the file and the revision it now holds, on a commit', async () => {
    // The obligation Phase 2b-2c-3a left open (hole 7.2): after `committed: true`
    // **every** identity for that file is stale and `moved` is `null`, so there
    // is nothing in the answer to follow. The wrapper calls the reload itself,
    // which is what makes forgetting impossible rather than merely documented.
    outcome = { resolve: COMMITTED };
    const answer = await saveRawDocument(4, 'a'.repeat(64), 'matches: []\n', { accepted: [] }, record);
    expect(answer.ok).toBe(true);
    expect(invalidations).toEqual([{ document: 4, revision: 'f'.repeat(64) }]);
    // The new base revision, not the one that was sent: a reload against the old
    // one would ask for the bytes this save replaced.
    expect(invalidations[0]?.revision).not.toBe('a'.repeat(64));
    // And the reload's own outcome is on the answer, said rather than implied.
    expect(answer.ok ? answer.reload : null).toEqual({ kind: 'done' });
  }); // End of the "runs it once on a commit" case

  it('does not run it when the text was identical, because nothing became stale', async () => {
    // `committed: false` is a documented success: a candidate byte-identical to
    // what the file already held is not written. No new revision exists, so no
    // identity was invalidated — and calling the reload anyway would make a
    // window discard a projection that is still correct.
    outcome = {
      resolve: {
        outcome: 'saved',
        revision: 'a'.repeat(64),
        committed: false,
        notes: [],
        backup_taken: false,
        moved: null
      }
    };
    const answer = await saveRawDocument(4, 'a'.repeat(64), 'matches: []\n', { accepted: [] }, record);
    expect(invalidations).toEqual([]);
    // "Did not run" has its own arm, so it cannot be mistaken for "ran and
    // worked" by a caller deciding whether the window is in step with the file.
    expect(answer.ok ? answer.reload : null).toEqual({ kind: 'notOwed' });
  }); // End of the "does not run it when the text was identical" case

  it('does not run it on a conflict or a refusal, where nothing was written', async () => {
    // Neither wrote anything, so neither invalidated an identity this call made
    // stale. A conflict still leaves the caller holding a projection of bytes
    // that are no longer on disk — but that is a file *something else* changed,
    // and the fresh projection is carried in the answer's own `disk` field for
    // the caller to adopt, which is a different act from reloading after a write.
    outcome = {
      resolve: {
        outcome: 'conflict',
        expected: 'a'.repeat(64),
        found: 'b'.repeat(64),
        disk_revision: 'b'.repeat(64),
        disk: { id: 4, revision: 'b'.repeat(64) }
      }
    };
    await saveRawDocument(4, 'a'.repeat(64), 'matches: []\n', { accepted: [] }, record);
    outcome = {
      resolve: {
        outcome: 'refused',
        verdict: 'RefusedForUnacknowledgedSuspicions',
        findings: []
      }
    };
    await saveRawDocument(4, 'a'.repeat(64), 'matches: []\n', { accepted: [] }, record);
    expect(invalidations).toEqual([]);
  }); // End of the "does not run it on a conflict or a refusal" case

  it('does not run it when the call itself failed', async () => {
    outcome = { reject: { code: 'noWorkspaceOpen' } };
    const answer = await saveRawDocument(4, 'a'.repeat(64), 'x\n', { accepted: [] }, record);
    expect(answer.ok).toBe(false);
    expect(invalidations).toEqual([]);
  });

  it('still hands back the committed save when the reload throws', async () => {
    // **The 2b-2c-3b review's High finding.** The reload runs *after* the bytes
    // are on disk, so its failure says nothing about whether the save happened.
    // The first version of this wrapper awaited it inside a promise typed
    // `CommandResult<SaveResult>`, so a throwing reload threw out of the wrapper:
    // the committed `Saved` was hidden behind an exception and a caller was
    // invited to retry a write that had already happened, which is exactly what
    // `PROGRESS.md` D2 forbids.
    //
    // Both halves are pinned here, because either alone is a different defect:
    // the committed result must come back, **and** the reload's failure must be
    // visible rather than swallowed.
    outcome = { resolve: COMMITTED };
    const answer = await saveRawDocument(4, 'a'.repeat(64), 'matches: []\n', { accepted: [] }, () => {
      throw new Error('the window could not be brought back into step');
    });
    expect(answer.ok).toBe(true);
    if (!answer.ok) {
      throw new Error('unreachable');
    }
    expect(answer.value).toEqual(COMMITTED);
    expect(answer.reload.kind).toBe('failed');
    if (answer.reload.kind !== 'failed') {
      throw new Error('unreachable');
    }
    // Classified through the same channel every other failure of this boundary
    // goes through, so it can be reported without a second error path.
    expect(answer.reload.failure.kind).toBe('unexpected');
  }); // End of the "reload throws" case

  it('still hands back the committed save when the reload rejects', async () => {
    // The asynchronous half of the case above, and the one a `try`/`catch`
    // around a bare call would miss: a rejected promise from an `async` reload
    // is caught only because the call is awaited inside the `try`.
    outcome = { resolve: COMMITTED };
    const answer = await saveRawDocument(
      4,
      'a'.repeat(64),
      'matches: []\n',
      { accepted: [] },
      async () => {
        await Promise.resolve();
        return Promise.reject({ code: 'io', path: '/tmp/espanso/match/base.yml', kind: 'NotFound' });
      }
    );
    expect(answer.ok).toBe(true);
    if (!answer.ok) {
      throw new Error('unreachable');
    }
    expect(answer.value).toEqual(COMMITTED);
    expect(answer.reload.kind).toBe('failed');
    if (answer.reload.kind !== 'failed') {
      throw new Error('unreachable');
    }
    // A rejection that *is* one of ours keeps its code, so a caller can say
    // which read failed rather than only that one did.
    expect(answer.reload.failure.kind).toBe('command');
    if (answer.reload.failure.kind !== 'command') {
      throw new Error('unreachable');
    }
    expect(answer.reload.failure.error.code).toBe('io');
  }); // End of the "reload rejects" case

  it('waits for it, so nothing after the await runs against the stale projections', async () => {
    // The ordering half of the mechanism, and the half a "fire it and move on"
    // implementation would fail: a reload that is asynchronous must have finished
    // before this promise resolves, or the caller's next line reads the very
    // projections the commit invalidated.
    const order: string[] = [];
    outcome = { resolve: COMMITTED };
    await saveRawDocument(4, 'a'.repeat(64), 'matches: []\n', { accepted: [] }, async () => {
      await Promise.resolve();
      order.push('reloaded');
    });
    order.push('resolved');
    expect(order).toEqual(['reloaded', 'resolved']);
  }); // End of the "waits for it" case
}); // End of the "reload a committed raw save owes" suite
