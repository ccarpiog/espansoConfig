/**
 * The six command wrappers, against a stubbed `invoke`.
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
  openWorkspace,
  reloadDocument
} = commands;

/** Every function this module exports, sorted. */
const EXPORTED_FUNCTIONS = Object.entries(commands)
  .filter(([, value]) => typeof value === 'function')
  .map(([name]) => name)
  .sort();

/** A match identity, exactly as it would have arrived from Rust. */
const IDENTITY = { document: 3, revision: 'a'.repeat(64), node: 11 };

beforeEach(() => {
  calls.length = 0;
  outcome = { resolve: undefined };
});

describe('the command wrappers', () => {
  it('call the six wire names, in order, and export no seventh wrapper', async () => {
    // Two claims, because the first alone is what the review of Phase 1b-2a
    // objected to: calling six known wrappers says nothing about whether a
    // seventh exists. The second reads the module's exports rather than the six
    // names this file already knows, so a wrapper added for a mutating command
    // fails here even though nothing calls it.
    await openWorkspace(null);
    await listDocuments();
    await getDocument(1);
    await getMatch(IDENTITY);
    await documentText(1);
    await reloadDocument(1);
    expect(calls.map((call) => call.command)).toEqual([...COMMAND_NAMES]);
    expect(EXPORTED_FUNCTIONS).toEqual([
      'documentText',
      'getDocument',
      'getMatch',
      'listDocuments',
      'openWorkspace',
      'reloadDocument'
    ]);
  }); // End of the "call the six wire names" case

  it('exports no wrapper for any of the six Phase 2 mutating commands', () => {
    // `save_match` and its five siblings need the save transaction, which does
    // not exist. `wire_contract.rs` asserts their absence from the registered
    // Rust surface; this asserts it on the side that would have to call them.
    const forbidden = [
      'saveMatch',
      'createMatch',
      'deleteMatch',
      'moveMatch',
      'saveRawDocument',
      'validateMatch'
    ];
    for (const name of forbidden) {
      expect(EXPORTED_FUNCTIONS).not.toContain(name);
      expect([...COMMAND_NAMES] as string[]).not.toContain(
        name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
      );
    }
  }); // End of the "exports no wrapper for any of the six" case

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
