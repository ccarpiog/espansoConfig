/**
 * The menu command wrapper, against a stubbed `invoke`.
 *
 * What is under test is the *boundary*: which command name is called, what
 * shape the argument takes, and that a rejection comes back classified rather
 * than thrown. The Rust half is `src-tauri/src/menu_contract.rs`, which reads
 * this file's `MENU_LABEL_FIELDS` and compares it with the fields of
 * `MenuLabels`, and `src-tauri/src/dispatch_check.rs`, which drives the command
 * through the real dispatcher.
 *
 * Per `docs/decisions/1b-2a-notes.md` section 14, an `it` callback whose sibling
 * argument is already its description carries no JSDoc of its own.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuLabels } from './menu';

/** Every call the stubbed `invoke` received, in order. */
const calls: Array<{ command: string; args: unknown }> = [];

/** What the next `invoke` should do. */
let outcome: { resolve: unknown } | { reject: unknown } = { resolve: undefined };

vi.mock('@tauri-apps/api/core', () => ({
  /**
   * The stub the wrapper goes through.
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

const menu = await import('./menu');
const { MENU_COMMAND_NAMES, MENU_LABEL_FIELDS, setMenuLabels } = menu;

/** Every function this module exports, sorted. */
const EXPORTED_FUNCTIONS = Object.entries(menu)
  .filter(([, value]) => typeof value === 'function')
  .map(([name]) => name)
  .sort();

/**
 * A complete label set, built from the field list rather than written out.
 *
 * The values are the field names: what is under test here is the shape of the
 * call, and the text is `src/lib/menu.test.ts`'s subject.
 */
const LABELS = Object.fromEntries(
  MENU_LABEL_FIELDS.map((field) => [field, field])
) as MenuLabels;

beforeEach(() => {
  calls.length = 0;
  outcome = { resolve: undefined };
});

describe('the label list', () => {
  it('holds the sixteen labels this phase built, with no repetition', () => {
    // The count is the non-vacuity guard, and the set comparison is what would
    // fire if a field were pasted twice — which would leave one item wearing
    // another's label and every other check still green.
    expect(MENU_LABEL_FIELDS).toHaveLength(16);
    expect(new Set(MENU_LABEL_FIELDS).size).toBe(16);
  }); // End of the "sixteen labels" case

  it('names one command, and it is the one the wrapper calls', async () => {
    expect(MENU_COMMAND_NAMES).toEqual(['set_menu_labels']);
    await setMenuLabels(LABELS);
    expect(calls.map((call) => call.command)).toEqual([...MENU_COMMAND_NAMES]);
  });

  it('exports exactly one call, so nothing else reaches Rust from here', () => {
    expect(EXPORTED_FUNCTIONS).toEqual(['setMenuLabels']);
  });
}); // End of the "label list" suite

describe('setMenuLabels()', () => {
  it('sends the whole label set under one argument', async () => {
    await setMenuLabels(LABELS);
    expect(calls[0]?.args).toEqual({ labels: LABELS });
  });

  it('answers ok with nothing, because the command returns nothing', async () => {
    const result = await setMenuLabels(LABELS);
    expect(result).toEqual({ ok: true });
  });

  it('classifies our own rejection rather than throwing it', async () => {
    outcome = { reject: { code: 'menuUnavailable' } };
    const result = await setMenuLabels(LABELS);
    expect(result).toEqual({
      ok: false,
      failure: { kind: 'command', error: { code: 'menuUnavailable' } }
    });
  }); // End of the "our own rejection" case

  it('keeps a version skew typed, with the field names on both sides', async () => {
    // **The frontend half of the review's third finding.** Before the fix this
    // rejection was Tauri's macro answering ``invalid args `labels` for command
    // `set_menu_labels`: missing field `quit` `` — an English sentence with no
    // `code`, which `classifyFailure` could only file under `unexpected` and
    // `main.ts` then dropped. It is now a command error, so a caller can branch
    // on it and the dictionary has a sentence for it.
    outcome = {
      reject: { code: 'invalidMenuLabels', missing: ['quit'], unexpected: [] }
    };
    const result = await setMenuLabels(LABELS);
    expect(result).toEqual({
      ok: false,
      failure: {
        kind: 'command',
        error: { code: 'invalidMenuLabels', missing: ['quit'], unexpected: [] }
      }
    });
  }); // End of the "version skew" case

  it('keeps a failed rebuild apart from a refused post', async () => {
    // `menuBuildFailed` exists because `ok: true` now means a menu was
    // installed. If the two ever collapsed into one code, "the work was
    // accepted" and "the menu is up" would be indistinguishable again.
    outcome = { reject: { code: 'menuBuildFailed' } };
    const built = await setMenuLabels(LABELS);
    outcome = { reject: { code: 'menuUnavailable' } };
    const posted = await setMenuLabels(LABELS);
    expect(built.ok === false && built.failure.kind === 'command' && built.failure.error.code).toBe(
      'menuBuildFailed'
    );
    expect(
      posted.ok === false && posted.failure.kind === 'command' && posted.failure.error.code
    ).toBe('menuUnavailable');
  }); // End of the "failed rebuild apart from a refused post" case

  it("classifies the dispatcher's own English refusal as unexpected", async () => {
    // What a capability denial or a navigated webview produces. It must not be
    // mistaken for one of our codes, and its text must not be rendered.
    outcome = { reject: 'set_menu_labels not allowed. Plugin not found' };
    const result = await setMenuLabels(LABELS);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure.kind).toBe('unexpected');
  }); // End of the "dispatcher's own refusal" case
}); // End of the "setMenuLabels()" suite
