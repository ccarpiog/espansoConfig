/**
 * Which file the raw viewer shows, and which of four things its text is in.
 *
 * **What this file can establish and what it cannot.** It is a test over two
 * pure functions, so it can say what `rawTarget` picks and what
 * `documentTextState` answers. It says **nothing** about what appears on a
 * screen: nothing in this repository renders a Svelte component in an automated
 * test (`docs/decisions/1c-1-notes.md` hole 1), so the evidence that the pane
 * draws these arms is the window reading in
 * `docs/decisions/1c-2b-2b-2-notes.md`. The scan at the foot of this file is a
 * substring search over markup and claims no more than one.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CommandResult } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type { DocumentSummary } from '../ipc/types';
import { DICTIONARIES } from '../i18n/dictionaries';
import { makeSummary } from './fixtures';
import { documentTextState, rawTarget } from './rawDocument';
import type { SelectedMatch } from './selection';
import { ALL_DOCUMENTS } from './sidebar';

/** Three files, one of which is a profile that holds no snippets. */
const DOCUMENTS: readonly DocumentSummary[] = [
  makeSummary({ id: 1, relativePath: 'config/default.yml', kind: 'ConfigProfile' }),
  makeSummary({ id: 2, relativePath: 'match/base.yml' }),
  makeSummary({ id: 3, relativePath: 'match/other.yml' })
];

/**
 * A held selection naming one document.
 *
 * @param document - The document the snippet lives in.
 * @returns A selection of its first match.
 */
function selectionIn(document: number): SelectedMatch {
  return {
    id: { document, node: 10, revision: 'r1' },
    document,
    position: 0,
    fingerprint: 'trigger: ":x"'
  };
} // End of function selectionIn()

describe('which file the raw viewer is about', () => {
  it('has none when nothing names one', () => {
    expect(rawTarget(ALL_DOCUMENTS, DOCUMENTS, null)).toBeNull();
  });

  it('takes the file the sidebar names', () => {
    const target = rawTarget({ kind: 'document', id: 3 }, DOCUMENTS, null);
    expect(target?.relative_path).toBe('match/other.yml');
  });

  it('takes the sidebar’s file when nothing at all is selected', () => {
    // **The name says what the body supplies**, and the body supplies a `null`
    // selection: `rawTarget` sees summaries, never a match list, so a file with
    // no snippets is not a case it can be given. What this establishes is the
    // half that matters for reachability — the target does not depend on
    // anything being selected. A file that does not **parse** crosses the
    // boundary with no matches at all, so nothing in it can ever be selected,
    // and a viewer whose target came from the selection could never show one.
    const target = rawTarget({ kind: 'document', id: 1 }, DOCUMENTS, null);
    expect(target?.relative_path).toBe('config/default.yml');
  });

  it('prefers the sidebar’s file to the selected snippet’s', () => {
    // A selection made in the "All" scope survives a later sidebar click, so
    // the two really can disagree. The sidebar wins because clicking a file is
    // the reader pointing at a file, which is what the viewer is about.
    const target = rawTarget({ kind: 'document', id: 2 }, DOCUMENTS, selectionIn(3));
    expect(target?.id).toBe(2);
  });

  it('falls back to the selected snippet’s file in the “All” scope', () => {
    const target = rawTarget(ALL_DOCUMENTS, DOCUMENTS, selectionIn(3));
    expect(target?.id).toBe(3);
  });

  it('has none when the file a selection names is no longer listed', () => {
    // Not hypothetical: `open()` replaces `documents` whole, and an identity
    // from the previous workspace names nothing in the new one.
    expect(rawTarget(ALL_DOCUMENTS, DOCUMENTS, selectionIn(99))).toBeNull();
    expect(rawTarget({ kind: 'document', id: 99 }, DOCUMENTS, null)).toBeNull();
  });
}); // End of the "which file" suite

describe('what has happened to the file’s text', () => {
  it('is loading before the command has answered', () => {
    expect(documentTextState(null)).toEqual({ kind: 'loading' });
  });

  it('carries the text through untouched', () => {
    // Untouched is the whole contract: no trim, no normalise, no re-encode.
    // The hazards below are the ones `document_text` is measured to preserve
    // (`docs/decisions/1c-2b-2a-notes.md` section 4).
    const text = '\u{feff}a\u{0}b\r\ncaf\u{65}\u{301} \u{1f600}\n  keeps  ';
    const answer: CommandResult<string> = { ok: true, value: text };
    expect(documentTextState(answer)).toEqual({ kind: 'text', text });
  });

  it('tells a file of no characters apart from one it could not read', () => {
    // The distinction this type exists for. Both answers below would draw as an
    // empty box if the state were a bare string, and they are different facts:
    // one is a file of zero bytes, the other a file this app cannot represent.
    const empty: CommandResult<string> = { ok: true, value: '' };
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'notUtf8', path: '/tmp/espanso/match/base.yml', offset: 41 }
    };
    const refused: CommandResult<string> = { ok: false, failure };

    expect(documentTextState(empty)).toEqual({ kind: 'empty' });
    expect(documentTextState(refused)).toEqual({ kind: 'refused', failure });
  });

  it('carries each of the four refusals whole rather than reducing them', () => {
    // `notUtf8` is the refusal the arm exists for and it is not the only one
    // that reaches it. Keeping the classified failure is what lets the screen
    // render the typed reason — including the byte offset — through
    // `tIpcFailure` instead of one sentence standing for four different facts.
    // **All four are supplied**, because a body that tried one could not have
    // failed if the other three were flattened.
    const failures: readonly IpcFailure[] = [
      { kind: 'command', error: { code: 'notUtf8', path: '/x/y.yml', offset: 49 } },
      { kind: 'command', error: { code: 'io', path: '/x/y.yml', kind: 'PermissionDenied' } },
      { kind: 'command', error: { code: 'unknownDocument', document: 7 } },
      { kind: 'command', error: { code: 'noWorkspaceOpen' } }
    ];
    for (const failure of failures) {
      expect(documentTextState({ ok: false, failure })).toEqual({ kind: 'refused', failure });
    } // End of the loop over the four refusals that reach this arm
  }); // End of the "four refusals" case

  it('treats a whitespace-only file as text, not as an empty one', () => {
    // A file of one newline is not a file of no characters, and the viewer must
    // not say it is: `empty` is reserved for a string of length zero.
    expect(documentTextState({ ok: true, value: '\n' })).toEqual({ kind: 'text', text: '\n' });
  });
}); // End of the "what has happened" suite

describe('the sentences the raw viewer needs', () => {
  /*
   * A dictionary check, which is what it says it is: it establishes that the
   * strings exist in both languages and that the refusal does not read as a
   * report of emptiness. It cannot establish that either sentence is true of
   * what is drawn under it — that is the window reading's job.
   */

  it('has every one of them in both languages', () => {
    const keys = [
      'browser.detail.section.fileText',
      'browser.detail.fileTextShow',
      'browser.detail.fileTextHide',
      'browser.detail.fileTextScope',
      'browser.detail.fileTextAsWritten',
      'browser.detail.fileTextLoading',
      'browser.detail.fileTextEmpty',
      'browser.detail.fileTextUnavailable'
    ] as const;
    for (const locale of ['en', 'es'] as const) {
      for (const key of keys) {
        expect(DICTIONARIES[locale][key], `${locale} ${key}`).not.toBe('');
      } // End of the loop over the raw viewer's keys
    } // End of the loop over the two locales
  });

  it('gives the refusal and the empty file different sentences in both languages', () => {
    // A string comparison, and the name says so: it establishes inequality and
    // nothing about meaning. The defect it is pointed at is a refusal that
    // reads as "there is nothing here", which would need the two to be one
    // sentence; whether the two sentences say the right things is §4 of
    // `docs/decisions/1c-2b-2b-2-notes.md` and the window reading.
    for (const locale of ['en', 'es'] as const) {
      expect(
        DICTIONARIES[locale]['browser.detail.fileTextUnavailable'],
        locale
      ).not.toBe(DICTIONARIES[locale]['browser.detail.fileTextEmpty']);
    } // End of the loop over the two locales
  });

  it('writes both toggle labels with no operand to interpolate', () => {
    // What the body checks is the absence of a placeholder, which is what the
    // name now says. The reason it matters: the label shown while the viewer is
    // open sits above **two** cases — a snippet is selected and hiding the text
    // reveals it, or nothing is and hiding it reveals "select a snippet" — so
    // neither label may be assembled out of a selection that might not exist.
    // That both labels name *the file's text* is §4's argument, not this
    // assertion's.
    for (const locale of ['en', 'es'] as const) {
      for (const key of ['browser.detail.fileTextShow', 'browser.detail.fileTextHide'] as const) {
        expect(DICTIONARIES[locale][key], `${locale} ${key}`).not.toContain('{');
      } // End of the loop over the two labels
    } // End of the loop over the two locales
  });

  /**
   * The withdrawn half of the as-written caption, in both languages.
   *
   * **The 1c-2b-2b-2 review's first finding.** The caption used to end "as the
   * file writes them", which is false of line endings: `./sourceText.ts` folds a
   * CRLF pair into one `break` segment carrying `ending: 'crlf'`, and
   * `SourceText.svelte` never reads that field — so a CRLF and an LF draw as the
   * same unlabelled `<br>` and nothing on the screen tells them apart. Naming
   * the transformations the renderer performs is what replaced it. Putting the
   * old phrase back fails this suite by name, which is the rule this project
   * uses for every sentence it has withdrawn: the assertion that a false claim
   * is gone belongs beside the change that made it false.
   */
  const WITHDRAWN: ReadonlyMap<'en' | 'es', string> = new Map([
    ['en', 'as the file writes them'],
    ['es', 'tal y como los escribe el archivo']
  ]);

  it('no longer claims the file’s own line endings reach the screen', () => {
    for (const [locale, withdrawn] of WITHDRAWN) {
      expect(DICTIONARIES[locale]['browser.detail.fileTextAsWritten'], locale).not.toContain(
        withdrawn
      );
    } // End of the loop over the two withdrawn phrases
  });
}); // End of the "sentences" suite

describe('the source of the pane that renders these arms', () => {
  /*
   * A **text scan**, and it claims exactly what a text scan can: that these
   * strings are written in this file. An arm left in a comment satisfies every
   * assertion here while the pane draws nothing — R24's corollary, which this
   * project has now paid for seven times. The evidence that the arms render is
   * the window reading.
   */
  const source = readFileSync(
    fileURLToPath(new URL('../components/DetailPane.svelte', import.meta.url)),
    'utf8'
  );

  it('passes documentStart to the shared primitive, and writes no second renderer', () => {
    // `documentStart` is the **only** way a `bom` segment is produced
    // (`./sourceText.ts`), and this is the only surface entitled to pass it: a
    // slice out of the middle of a file cannot know where byte 0 is. Dropping
    // the flag turns a real byte order mark into "zero-width character U+FEFF",
    // which is what a U+FEFF elsewhere in a file is and not what this one is.
    expect(source).toContain('<SourceText text={view.text} documentStart />');
    // And no second renderer: the file's text reaches the DOM through the one
    // component, never through a `<pre>` written here.
    expect(source).not.toContain('<pre class="fileText"');
  });

  it('writes the as-written caption inside the text arm’s branch and nowhere else', () => {
    // The 1c-2b-2b-1 review's first finding, applied to the second surface that
    // could have it. `RawDocumentText` has four arms and only one of them has
    // any bytes; a claim written above the `{#if}` would caption a refusal.
    const arm = source.indexOf("{#if view.kind === 'text'}");
    const claim = source.indexOf('browser.detail.fileTextAsWritten');
    const next = source.indexOf("{:else if view.kind === 'empty'}");
    expect(arm, 'the text arm of the fileText snippet').toBeGreaterThan(-1);
    expect(claim, 'the as-written claim').toBeGreaterThan(arm);
    expect(claim, 'the as-written claim').toBeLessThan(next);
    expect(source.split('browser.detail.fileTextAsWritten').length - 1).toBe(1);
  }); // End of the "as-written claim" case

  it('writes the refusal, the empty file and the typed reason as three separate strings', () => {
    // Both arms, and the typed reason under the refusal. A pane that dropped
    // `tIpcFailure` here would tell the reader the file cannot be shown and
    // never which byte stopped it.
    expect(source).toContain('browser.detail.fileTextUnavailable');
    expect(source).toContain('browser.detail.fileTextEmpty');
    expect(source).toContain('tIpcFailure(view.failure)');
  });

  it('keys the toggle’s markup on the target rather than on the selection', () => {
    // The reachability property in the markup: `fileTextTarget` is non-null for
    // a file the sidebar names whether or not it holds a snippet, and
    // `selectedMatch` is not. **The condition and the block it guards are
    // asserted together**, because `fileTextTarget` appears twice in this file
    // and a presence check passes while the *toggle* is keyed on the selection
    // — which is experiment M, and it fired nothing until this assertion was
    // written this way.
    //
    // The second conjunct arrived with Phase 2c-1b and is a different claim: the
    // toggle is **withdrawn while the raw editor is open**, because it would
    // otherwise close the viewer out from under an editor holding unsaved text.
    // It is asserted here rather than in a test of its own so that the two facts
    // about this one condition stay in one place.
    expect(source).toContain(
      '{#if browser.fileTextTarget !== null && editing === null}\n    <p class="toggle">'
    );
    expect(source).toContain('browser.showFileText(!browser.fileTextShown)');
  }); // End of the "toggle keyed on the target" case
}); // End of the "source of the pane" suite
