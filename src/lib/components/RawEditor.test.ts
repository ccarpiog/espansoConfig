/** @vitest-environment jsdom */

/**
 * **This project's first mounted-component test.**
 *
 * `vite.config.ts` has held the `jsdom` decision open since Phase 1b-1, in as
 * many words — *"Adding jsdom later is a deliberate decision, not a default"* —
 * and the Phase 2c split reserved it for this sub-phase
 * (`docs/decisions/2c-split-notes.md` section 7). The reason it is taken here and
 * not earlier is specific rather than general: **the acknowledgement round trip is
 * the highest-risk protocol in this application and it lives entirely inside a
 * component.** A model test cannot see whether the control that acknowledges is
 * drawn, whether it is withdrawn when the text changes, or what the component
 * actually hands to the boundary; a manual window reading can see all three once
 * and cannot regress-test any of them.
 *
 * The docblock above is the whole of the opt-in. The suite's default environment
 * is still `node`, no other file mounts anything, and the existing six components
 * are deliberately not back-filled.
 *
 * **This does not replace the window reading.** What it proves is that a handler
 * fires and that the right value reaches the boundary. It cannot prove that a
 * window draws: jsdom has no layout, no WebKit, and no opinion about whether a
 * pane is visible. `docs/decisions/1c-1-notes.md` section 10 is still the
 * technique for that, and this phase owes one.
 *
 * Svelte's own `mount`/`unmount`/`flushSync` are used rather than a testing
 * library: the component is driven through real DOM events, which is what the
 * claims above are about, and one more dependency would buy queries this file
 * does not need.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sealWholeDocumentSave } from '../browser/invalidation';
import type { RawSaveAnswer } from '../browser/workspace.svelte';
import type { RawSaveReload } from '../ipc/commands';
import { makeDocument, makeSummary } from '../browser/fixtures';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { locale } from '../stores/locale.svelte';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  Finding,
  SaveResult
} from '../ipc/types';
import RawEditor from './RawEditor.svelte';

/** The revision the text was read at. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The file being edited. */
const FILE = makeSummary({ id: 4, relativePath: 'match/base.yml' });

/** What the file held when the editor opened. */
const ORIGINAL = 'matches:\n  - trigger: ":a"\n    replace: "b"\n';

/** What is on disk once some other writer has been at it. */
const DISK = 'matches: []\n';

/** The same document with CRLF endings, which this editor refuses to open. */
const CRLF = 'matches:\r\n  - trigger: ":a"\r\n    replace: "b"\r\n';

/** A parse rejection, content-addressed to the candidate it is about. */
const REJECTION: Finding = {
  code: {
    DocumentDoesNotParse: {
      revision: AFTER,
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

/** A refusal an acknowledgement can move. */
const REFUSED: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [REJECTION]
};

/** A save that ran to the end and wrote the file. */
const COMMITTED: SaveResult = {
  outcome: 'saved',
  revision: AFTER,
  committed: true,
  notes: [],
  backup_taken: false,
  moved: null
};

/** A save the file had moved on under. */
const CONFLICTED: SaveResult = {
  outcome: 'conflict',
  expected: BASE,
  found: AFTER,
  disk_revision: AFTER,
  disk_text: 'matches:\n  - trigger: x\n    replace: theirs\n',
  disk: makeDocument({ id: FILE.id, relativePath: FILE.relative_path, revision: AFTER })
};

/** One call the component made to the boundary. */
interface RecordedSave {
  /** Which file it aimed at. */
  readonly document: DocumentId;
  /** The revision it claimed to be based on. */
  readonly baseRevision: ContentRevision;
  /** The whole text it sent. */
  readonly text: string;
  /** The suspicions it said had already been shown to a person. */
  readonly acknowledgement: Acknowledgement;
}

/** A mounted editor and everything a case needs to drive it. */
interface Mounted {
  /** The element the component was mounted into. */
  readonly target: HTMLElement;
  /** Every call the component made, in order. */
  readonly calls: RecordedSave[];
  /** How many times the editor asked to be closed. */
  readonly closed: () => number;
  /** Tears the component down. */
  readonly stop: () => void;
}

/**
 * One scripted answer to one save.
 *
 * A save result plus what the *issuer's* own invalidation made of it, because
 * since the 2c-1b review the second is what a screen draws *the window is out of
 * step* from — the workspace's re-projection, not this component's callback.
 */
interface ScriptedAnswer {
  /** How the save ended, or `null` when the command itself failed. */
  readonly result: SaveResult | null;
  /** What the issuer's invalidation did; it succeeded unless a case says so. */
  readonly issuer?: RawSaveReload;
  /** Whether the file may already hold the text, for the failed arm. */
  readonly mayHaveWritten?: boolean;
  /** Whether to leave the save unanswered, so the case can look at mid-flight. */
  readonly pending?: boolean;
}

/**
 * Mounts the editor over a scripted boundary.
 *
 * @param answers - What each successive save answers, in order. A save with no
 *   answer left behaves as a command that failed with nothing written.
 * @param disk - What this window holds of this file's text, for the conflict arm.
 * @param loaded - The file's text as the editor is handed it. Only the carriage
 *   return cases give this, because only they are about the text this editor
 *   refuses to open at all.
 * @returns The mounted editor.
 */
function mountEditor(
  answers: readonly ScriptedAnswer[],
  disk: string | null = DISK,
  loaded: string = ORIGINAL
): Mounted {
  const remaining = [...answers];
  const calls: RecordedSave[] = [];
  let closes = 0;
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(RawEditor, {
    target,
    props: {
      file: FILE,
      baseRevision: BASE,
      text: loaded,
      diskText: disk === null ? null : { kind: 'text', text: disk },
      save: (
        document_: DocumentId,
        baseRevision: ContentRevision,
        text: string,
        acknowledgement: Acknowledgement
      ): Promise<RawSaveAnswer> => {
        calls.push({ document: document_, baseRevision, text, acknowledgement });
        const next = remaining.shift();
        if (next?.pending === true) {
          // Never resolves: the case is about what the screen does while a save is
          // in flight, which is a state no resolved promise can be observed in.
          return new Promise<RawSaveAnswer>(() => undefined);
        }
        if (next === undefined || next.result === null) {
          return Promise.resolve({
            kind: 'failed',
            mayHaveWritten: next?.mayHaveWritten ?? false
          });
        }
        return Promise.resolve({
          kind: 'sealed',
          sealed: sealWholeDocumentSave(document_, next.result, next.issuer ?? { kind: 'done' })
        });
      },
      close: (): void => {
        closes += 1;
      }
    }
  });
  return {
    target,
    calls,
    closed: () => closes,
    stop: () => {
      void unmount(component);
      target.remove();
    }
  };
} // End of function mountEditor()

/**
 * The editor's one text area.
 *
 * @param target - Where the component was mounted.
 * @returns The text area.
 */
function textArea(target: HTMLElement): HTMLTextAreaElement {
  const found = maybeTextArea(target);
  if (found === null) {
    throw new Error('this case is about an editor that opened');
  }
  return found;
} // End of function textArea()

/**
 * The editor's text area, or `null` when it drew none.
 *
 * **A text this editor refuses draws no box at all**, which is what the CRLF case
 * below checks. The distinction matters: an empty box and no box are two different
 * screens, and only one of them can be typed into.
 *
 * @param target - Where the component was mounted.
 * @returns The text area, or `null`.
 */
function maybeTextArea(target: HTMLElement): HTMLTextAreaElement | null {
  // The clipboard fallback appends a carrier text area to `document.body` and
  // removes it again, so this scopes to the mount point rather than the document.
  return target.querySelector('textarea');
} // End of function maybeTextArea()

/**
 * The button whose label is the English rendering of one key, or `null`.
 *
 * Matched against the dictionary rather than against a literal, so this file
 * holds no user-facing text of its own and a reworded label does not silently
 * stop the test from finding anything.
 *
 * @param target - Where the component was mounted.
 * @param key - The key holding the button's label.
 * @returns The button, or `null` when it is not drawn.
 */
function button(target: HTMLElement, key: TranslationKey): HTMLButtonElement | null {
  const label = DICTIONARIES.en[key];
  const found = [...target.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  return found ?? null;
} // End of function button()

/**
 * The same button, insisted upon.
 *
 * @param target - Where the component was mounted.
 * @param key - The key holding the button's label.
 * @returns The button.
 */
function control(target: HTMLElement, key: TranslationKey): HTMLButtonElement {
  const found = button(target, key);
  if (found === null) {
    throw new Error(`this case needs the control labelled ${DICTIONARIES.en[key]}`);
  }
  return found;
} // End of function control()

/**
 * Types into the text area the way a person does.
 *
 * The component is controlled rather than bound, so the value is set and a real
 * `input` event is dispatched — which is the path a keystroke takes.
 *
 * @param target - Where the component was mounted.
 * @param text - The whole new value of the box.
 */
function type(target: HTMLElement, text: string): void {
  const box = textArea(target);
  box.value = text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
} // End of function type()

/**
 * Waits for the component's asynchronous save handler to finish.
 *
 * A macrotask rather than a fixed number of microtask ticks: the handler awaits
 * a promise the scripted boundary resolves, and counting ticks is a way to write
 * a test that passes until somebody adds an `await`.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
} // End of function settle()

/**
 * Whether the editor is showing one sentence.
 *
 * @param target - Where the component was mounted.
 * @param key - The key holding the sentence.
 * @returns `true` when the rendered text contains it.
 */
function says(target: HTMLElement, key: TranslationKey): boolean {
  return (target.textContent ?? '').includes(DICTIONARIES.en[key]);
} // End of function says()

beforeEach(() => {
  // The dictionary this file matches against is the English one, so the
  // interface is pinned to it rather than left to whatever `navigator.languages`
  // says under the runner.
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
});

describe('the mounted raw editor', () => {
  it('draws the file, its text and the statement that a save replaces it whole', () => {
    const editor = mountEditor([]);
    expect(textArea(editor.target).value).toBe(ORIGINAL);
    expect(says(editor.target, 'browser.rawSave.replacesWholeDocument')).toBe(true);
    expect(editor.target.textContent).toContain(FILE.relative_path);
    editor.stop();
  }); // End of the "draws the file" case

  it('gates the save control on the draft being dirty', () => {
    const editor = mountEditor([{ result: COMMITTED }]);
    expect(control(editor.target, 'browser.rawEditor.save').disabled).toBe(true);
    expect(says(editor.target, 'browser.rawEditor.unsaved')).toBe(false);

    type(editor.target, `${ORIGINAL}# one more line\n`);

    expect(control(editor.target, 'browser.rawEditor.save').disabled).toBe(false);
    expect(says(editor.target, 'browser.rawEditor.unsaved')).toBe(true);

    // And typing it back is clean again, because dirty is derived from the base.
    type(editor.target, ORIGINAL);
    expect(control(editor.target, 'browser.rawEditor.save').disabled).toBe(true);
    editor.stop();
  }); // End of the "gated on dirty" case

  it('undoes what was typed, and the control is drawn only when there is something to undo', () => {
    const editor = mountEditor([]);
    expect(control(editor.target, 'browser.rawEditor.undo').disabled).toBe(true);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    expect(control(editor.target, 'browser.rawEditor.undo').disabled).toBe(false);

    control(editor.target, 'browser.rawEditor.undo').click();
    flushSync();

    expect(textArea(editor.target).value).toBe(ORIGINAL);
    expect(control(editor.target, 'browser.rawEditor.redo').disabled).toBe(false);
    editor.stop();
  }); // End of the "undo" case

  it('sends the draft, and says the file was written', async () => {
    const editor = mountEditor([{ result: COMMITTED }]);
    const candidate = `${ORIGINAL}# one more line\n`;
    type(editor.target, candidate);

    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(editor.calls).toHaveLength(1);
    expect(editor.calls[0]?.document).toBe(FILE.id);
    expect(editor.calls[0]?.baseRevision).toBe(BASE);
    expect(editor.calls[0]?.text).toBe(candidate);
    expect(editor.calls[0]?.acknowledgement).toEqual({ accepted: [] });
    expect(says(editor.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    // Rebased on what was written, so there is nothing left to send.
    expect(control(editor.target, 'browser.rawEditor.save').disabled).toBe(true);
    editor.stop();
  }); // End of the "sends the draft" case

  it('says the save could not be sent, and invents no outcome, when the command fails', async () => {
    const editor = mountEditor([]);
    type(editor.target, `${ORIGINAL}# one more line\n`);

    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.rawEditor.sendFailed')).toBe(true);
    expect(says(editor.target, 'browser.saveOutcome.fileWritten')).toBe(false);
    expect(control(editor.target, 'browser.rawEditor.save').disabled).toBe(false);
    editor.stop();
  }); // End of the "command failed" case

  it('never says nothing was written when the write may have completed', async () => {
    // **The 2c-1b review's second finding, on screen.** A failure at or after the
    // rename may have left the candidate on disk. Saying "nothing was written" for
    // one of those is `PROGRESS.md` D2 broken from the other side: this application
    // telling a person their file is untouched when it may not be.
    const editor = mountEditor([{ result: null, mayHaveWritten: true }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);

    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.rawEditor.mayHaveWritten')).toBe(true);
    expect(says(editor.target, 'browser.rawEditor.sendFailed')).toBe(false);
    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    // The draft is untouched either way, so nothing the person wrote is lost.
    expect(textArea(editor.target).value).toBe(`${ORIGINAL}# one more line\n`);
    expect(textArea(editor.target).readOnly).toBe(false);
    editor.stop();
  }); // End of the "may have written" case

  it('says the window is out of step beside a committed save, never instead of it', async () => {
    // **The 2c-1b review's third finding, on screen.** The workspace's own
    // re-projection failed after a committed write; before the fix that reached
    // the developer console and the person saw a clean "the file was written".
    const editor = mountEditor([
      {
        result: COMMITTED,
        issuer: {
          kind: 'failed',
          failure: {
            kind: 'command',
            error: { code: 'io', path: '/tmp/espanso/match/base.yml', kind: 'PermissionDenied' }
          }
        }
      }
    ]);
    type(editor.target, `${ORIGINAL}# one more line\n`);

    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(says(editor.target, 'browser.saveOutcome.windowOutOfStep')).toBe(true);
    // And it is not drawn as a failure: the bytes are on disk, so the draft is
    // rebased and there is nothing left to send.
    expect(control(editor.target, 'browser.rawEditor.save').disabled).toBe(true);
    expect(says(editor.target, 'browser.rawEditor.sendFailed')).toBe(false);
    editor.stop();
  }); // End of the "window out of step" case

  it('will not let the editor be closed while a save is in flight', async () => {
    // **The 2c-1b review's fourth finding.** The request is already authorized and
    // cannot be cancelled; unmounting the editor would leave it free to commit with
    // its outcome drawn nowhere — under a dialog that had just said the changes
    // were not written.
    const editor = mountEditor([{ result: null, pending: true }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);

    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.rawEditor.saving')).toBe(true);
    expect(says(editor.target, 'browser.rawEditor.savingCannotBeStopped')).toBe(true);
    const close = control(editor.target, 'browser.rawEditor.close');
    expect(close.disabled).toBe(true);
    close.click();
    flushSync();
    expect(editor.closed()).toBe(0);
    // And no discard dialog was raised behind it either, so there is no second
    // control that would have got past this one.
    expect(says(editor.target, 'browser.rawEditor.discardWarning')).toBe(false);
    expect(button(editor.target, 'browser.rawEditor.discard')).toBeNull();
    editor.stop();
  }); // End of the "cannot close while saving" case

  it('withdraws a discard confirmation that was raised before a save started', async () => {
    // The other half of the same finding: the dialog is the thing that says the
    // changes were not written, and a save started under it would make that false.
    const editor = mountEditor([{ result: null, pending: true }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.close').click();
    flushSync();
    expect(says(editor.target, 'browser.rawEditor.discardWarning')).toBe(true);

    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.rawEditor.discardWarning')).toBe(false);
    expect(editor.closed()).toBe(0);
    editor.stop();
  }); // End of the "discard confirmation withdrawn" case

  it('runs the acknowledgement round trip with consent bound to the candidate on screen', async () => {
    // **The reason this file exists.** The gate matches an exact multiset of the
    // candidate's own suspicions, and every part of that pairing is assembled
    // inside the component: the refusal arrives, a control appears, and what the
    // second call carries has to be the findings the first one produced.
    const editor = mountEditor([{ result: REFUSED }, { result: COMMITTED }]);
    const candidate = `${ORIGINAL}# one more line\n`;
    type(editor.target, candidate);

    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(says(editor.target, 'browser.rawSave.willNotLoad')).toBe(true);
    // The parser's position, substituted rather than left as a placeholder — the
    // sentence is translated and the operands come off the finding.
    expect(editor.target.textContent).toContain(
      translate('en', 'browser.rawSave.stoppedAt', { line: 3, column: 5 })
    );
    // And the parser's own diagnostic is **not** on screen: it comes from
    // `saphyr-parser`, cannot be localized, and `rawSave.ts` carries it for a
    // developer surface without ever rendering it.
    expect(editor.target.textContent).not.toContain('mapping values');

    control(editor.target, 'browser.rawSave.choice.saveAnyway').click();
    await settle();

    expect(editor.calls).toHaveLength(2);
    expect(editor.calls[1]?.text).toBe(candidate);
    expect(editor.calls[1]?.acknowledgement).toEqual({ accepted: [REJECTION] });
    expect(says(editor.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    editor.stop();
  }); // End of the "acknowledgement round trip" case

  it('withdraws the offer, and the consent, when the text changes after a refusal', async () => {
    const editor = mountEditor([{ result: REFUSED }, { result: REFUSED }, { result: COMMITTED }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);

    control(editor.target, 'browser.rawEditor.save').click();
    await settle();
    expect(button(editor.target, 'browser.rawSave.choice.saveAnyway')).not.toBeNull();

    // The person changes the text while the findings are on screen.
    const changed = `${ORIGINAL}# a different line\n`;
    type(editor.target, changed);

    expect(button(editor.target, 'browser.rawSave.choice.saveAnyway')).toBeNull();
    expect(says(editor.target, 'browser.rawEditor.findingsAreStale')).toBe(true);

    // And what goes out now is a first attempt, carrying nobody's consent.
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(editor.calls).toHaveLength(2);
    expect(editor.calls[1]?.text).toBe(changed);
    expect(editor.calls[1]?.acknowledgement).toEqual({ accepted: [] });
    editor.stop();
  }); // End of the "consent withdrawn" case

  it('shows a conflict as terminal, keeps the draft, and needs two clicks to discard it', async () => {
    const editor = mountEditor([{ result: CONFLICTED }]);
    const candidate = `${ORIGINAL}# one more line\n`;
    type(editor.target, candidate);

    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    // Nothing was written, and the draft is here.
    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(says(editor.target, 'browser.saveOutcome.draftKeptInMemory')).toBe(true);
    expect(says(editor.target, 'browser.saveOutcome.reloadDiscardsDraft')).toBe(true);
    expect(textArea(editor.target).value).toBe(candidate);
    expect(textArea(editor.target).readOnly).toBe(true);
    // No retry of the stale candidate, and no second save control.
    expect(button(editor.target, 'browser.rawSave.choice.saveAnyway')).toBeNull();
    expect(control(editor.target, 'browser.rawEditor.save').disabled).toBe(true);
    // The copy is offered, and the destructive choice is not yet reachable.
    expect(button(editor.target, 'browser.saveOutcome.choice.copyDraft')).not.toBeNull();
    expect(button(editor.target, 'browser.saveOutcome.choice.confirmReload')).toBeNull();

    control(editor.target, 'browser.saveOutcome.choice.reloadDiskVersion').click();
    flushSync();

    // Second step: the copy is still offered, and now so is the destructive one.
    expect(button(editor.target, 'browser.saveOutcome.choice.copyDraft')).not.toBeNull();
    control(editor.target, 'browser.saveOutcome.choice.confirmReload').click();
    flushSync();

    expect(textArea(editor.target).value).toBe(DISK);
    expect(textArea(editor.target).readOnly).toBe(false);
    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    editor.stop();
  }); // End of the "conflict" case

  it('does not open a CRLF document into an editable box', async () => {
    // **The window reading's first finding, as the test that would have caught it**
    // (notes section 9.10.1). A `<textarea>`'s API value normalizes every line
    // break to LF, so a CRLF document used to lose its carriage returns on the
    // first keystroke and the save wrote the normalized text. There is now no box
    // to type into, no save control, and a sentence saying why.
    const editor = mountEditor([{ result: COMMITTED }], DISK, CRLF);

    expect(maybeTextArea(editor.target)).toBeNull();
    expect(button(editor.target, 'browser.rawEditor.save')).toBeNull();
    expect(button(editor.target, 'browser.rawEditor.undo')).toBeNull();
    expect(says(editor.target, 'browser.rawEditor.lineEndingsNotPreserved')).toBe(true);
    // The way out is still there, and it does not ask about a draft that does not
    // exist.
    control(editor.target, 'browser.rawEditor.close').click();
    flushSync();
    expect(editor.closed()).toBe(1);
    expect(editor.calls).toEqual([]);
    editor.stop();
  }); // End of the "CRLF document" case

  it('opens the same document once its carriage returns are gone', async () => {
    // The oracle for the case above, and the proof that the refusal is about the
    // carriage returns and not about the fixture.
    const editor = mountEditor([{ result: COMMITTED }], DISK, CRLF.replaceAll('\r\n', '\n'));

    expect(maybeTextArea(editor.target)).not.toBeNull();
    expect(says(editor.target, 'browser.rawEditor.lineEndingsNotPreserved')).toBe(false);
    editor.stop();
  }); // End of the "carriage returns gone" case

  it('will not load a disk version whose line endings it cannot keep', async () => {
    // The one other way a text can enter a session. The disk version is still
    // *shown* — `SourceText` names a carriage return rather than dropping it — so a
    // control that silently did nothing would read as a bug; it is disabled, with
    // the same sentence beside it.
    const editor = mountEditor([{ result: CONFLICTED }], CRLF);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    control(editor.target, 'browser.saveOutcome.choice.reloadDiskVersion').click();
    flushSync();

    expect(says(editor.target, 'browser.rawEditor.lineEndingsNotPreserved')).toBe(true);
    expect(control(editor.target, 'browser.saveOutcome.choice.confirmReload').disabled).toBe(true);
    // And the draft is untouched: nothing was loaded over it.
    expect(textArea(editor.target).value).toBe(`${ORIGINAL}# one more line\n`);
    editor.stop();
  }); // End of the "disk version with carriage returns" case

  it('falls back to a selection copy when the clipboard API is refused', async () => {
    // **The window reading's second finding** (notes section 9.10.2):
    // `navigator.clipboard.writeText` is refused in this application's webview, so
    // the conflict's *copy your text before discarding it* step offered a control
    // that never worked. `document.execCommand('copy')` over a real selection is
    // the dependency-free route that does. jsdom has no clipboard either, so this
    // case is the fallback path exactly as the webview takes it.
    const original = Object.getOwnPropertyDescriptor(document, 'execCommand');
    const copied: string[] = [];
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: (command: string): boolean => {
        const selected = document.activeElement;
        if (selected instanceof HTMLTextAreaElement) {
          copied.push(selected.value);
        }
        return command === 'copy';
      }
    });
    try {
      const editor = mountEditor([{ result: CONFLICTED }]);
      const candidate = `${ORIGINAL}# one more line\n`;
      type(editor.target, candidate);
      control(editor.target, 'browser.rawEditor.save').click();
      await settle();

      control(editor.target, 'browser.saveOutcome.choice.copyDraft').click();
      await settle();

      expect(says(editor.target, 'browser.rawEditor.draftCopied')).toBe(true);
      expect(says(editor.target, 'browser.rawEditor.draftCopyFailed')).toBe(false);
      // And what it selected was the draft, byte for byte — the conflict is about
      // those bytes and the box is read-only, so they cannot have moved.
      expect(copied).toEqual([candidate]);
      // The carrier is gone again: the editor's own box is the only one left.
      expect(document.querySelectorAll('textarea')).toHaveLength(1);
      editor.stop();
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(document, 'execCommand');
      } else {
        Object.defineProperty(document, 'execCommand', original);
      }
    }
  }); // End of the "selection copy" case

  it('still discloses the copy when putting the screen back throws', async () => {
    // **The second review pass's Medium finding.** The first version restored focus
    // in an unguarded `finally`, so a throw there escaped `copyBySelecting`, the
    // caller's assignment never ran, and the person got **no** disclosure at all —
    // neither success nor failure — on the one control that exists to keep a draft
    // from being lost. Silence is the worst answer this path can give.
    const box = document.createElement('textarea');
    document.body.append(box);
    const originalFocus = HTMLElement.prototype.focus;
    const originalCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: (): boolean => true
    });
    try {
      const editor = mountEditor([{ result: CONFLICTED }]);
      type(editor.target, `${ORIGINAL}# one more line\n`);
      control(editor.target, 'browser.rawEditor.save').click();
      await settle();
      // Whatever had focus when the copy starts is what the cleanup tries to
      // restore, and here restoring it is exactly what throws.
      box.focus();
      HTMLElement.prototype.focus = function throwingFocus(this: HTMLElement): void {
        if (this === box) {
          throw new Error('this element will not take focus back');
        }
      };

      control(editor.target, 'browser.saveOutcome.choice.copyDraft').click();
      await settle();

      // The copy succeeded, so it says so — and it says *something* either way,
      // which is the property this case exists for.
      expect(says(editor.target, 'browser.rawEditor.draftCopied')).toBe(true);
      // And the carrier is gone even though the step after it threw.
      expect(document.body.querySelectorAll('textarea')).toHaveLength(2);
      editor.stop();
    } finally {
      HTMLElement.prototype.focus = originalFocus;
      box.remove();
      if (originalCommand === undefined) {
        Reflect.deleteProperty(document, 'execCommand');
      } else {
        Object.defineProperty(document, 'execCommand', originalCommand);
      }
    }
  }); // End of the "cleanup throws" case

  it('says so when the copy could not be made, rather than looking as though it was', async () => {
    // jsdom has no clipboard, which is the failure path rather than a limitation
    // of this case: a WKWebView outside a secure context refuses the same way.
    // What matters is that the person is told, and told that the text is still in
    // the box — the copy is what makes the destructive choice survivable, so a
    // silent failure here is the worst kind.
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    control(editor.target, 'browser.saveOutcome.choice.copyDraft').click();
    await settle();

    expect(says(editor.target, 'browser.rawEditor.draftCopyFailed')).toBe(true);
    expect(says(editor.target, 'browser.rawEditor.draftCopied')).toBe(false);
    editor.stop();
  }); // End of the "copy failed" case

  it('will not offer to load a disk version it has not got', async () => {
    const editor = mountEditor([{ result: CONFLICTED }], null);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    control(editor.target, 'browser.saveOutcome.choice.reloadDiskVersion').click();
    flushSync();

    expect(says(editor.target, 'browser.rawEditor.diskVersionUnavailable')).toBe(true);
    expect(control(editor.target, 'browser.saveOutcome.choice.confirmReload').disabled).toBe(true);
    editor.stop();
  }); // End of the "no disk version" case

  it('asks before leaving with unsaved text, and leaves at once without any', () => {
    const clean = mountEditor([]);
    control(clean.target, 'browser.rawEditor.close').click();
    flushSync();
    expect(clean.closed()).toBe(1);
    clean.stop();

    const dirty = mountEditor([]);
    type(dirty.target, `${ORIGINAL}# one more line\n`);
    control(dirty.target, 'browser.rawEditor.close').click();
    flushSync();

    expect(dirty.closed()).toBe(0);
    expect(says(dirty.target, 'browser.rawEditor.discardWarning')).toBe(true);
    control(dirty.target, 'browser.rawEditor.discard').click();
    flushSync();
    expect(dirty.closed()).toBe(1);
    dirty.stop();
  }); // End of the "leaving" case
}); // End of the "mounted raw editor" suite
