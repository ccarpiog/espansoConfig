/**
 * The eight command wrappers, against a stubbed `invoke`.
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

import type { MatchDraft } from './types';

/** Every call the stubbed `invoke` received, in order. */
const calls: Array<{ command: string; args: unknown }> = [];

/** What the next `invoke` should do. */
let outcome: { resolve: unknown } | { reject: unknown } = { resolve: undefined };

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
  documentText,
  getDocument,
  getMatch,
  listDocuments,
  moveMatch,
  openWorkspace,
  reloadDocument,
  saveMatch
} = commands;

/** Every function this module exports, sorted. */
const EXPORTED_FUNCTIONS = Object.entries(commands)
  .filter(([, value]) => typeof value === 'function')
  .map(([name]) => name)
  .sort();

/** A match identity, exactly as it would have arrived from Rust. */
const IDENTITY = { document: 3, revision: 'a'.repeat(64), node: 11 };

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
  it('call the eight wire names, in order, and export no ninth wrapper', async () => {
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
    expect(calls.map((call) => call.command)).toEqual([...COMMAND_NAMES]);
    expect(EXPORTED_FUNCTIONS).toEqual([
      'documentText',
      'getDocument',
      'getMatch',
      'listDocuments',
      'moveMatch',
      'openWorkspace',
      'reloadDocument',
      'saveMatch'
    ]);
  }); // End of the "call the eight wire names" case

  it('exports no wrapper for any of the four Phase 2 commands that do not exist', () => {
    // Each of the four needs a core primitive that does not exist — inserting a
    // sequence item, removing one, replacing a whole document's text — and
    // `DocumentEdit` has none of them. `wire_contract.rs` asserts their absence
    // from the registered Rust surface; this asserts it on the side that would
    // have to call them.
    //
    // `moveMatch` left this list at Phase 2b-2a and `saveMatch` at 2b-2b-3, which
    // is the only way a name may leave it: the command exists and is registered.
    const forbidden = ['createMatch', 'deleteMatch', 'saveRawDocument', 'validateMatch'];
    for (const name of forbidden) {
      expect(EXPORTED_FUNCTIONS).not.toContain(name);
      expect([...COMMAND_NAMES] as string[]).not.toContain(
        name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
      );
    }
  }); // End of the "exports no wrapper for any of the four" case

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
