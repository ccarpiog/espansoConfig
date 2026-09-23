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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sealWholeDocumentSave } from '../browser/invalidation';
import type { RawSaveAnswer } from '../browser/workspace.svelte';
import type { RawSaveReload } from '../ipc/commands';
import { rawSaveChoiceKey } from '../browser/rawSave';
import {
  recoveryChoiceKey,
  recoveryUnavailableKey,
  type RecoveryUnavailable
} from '../browser/recovery';
import { RECOVERY_WITHOUT_CREATION_ATTRIBUTE } from './RecoveryWithoutCreation.svelte';
import {
  conflictChoiceKey,
  conflictChoicesFor,
  reloadUnavailableKey,
  type ConflictModel,
  type DiskAdoptionOutcome
} from '../browser/saveOutcome';
import { CONFLICT_CAPABILITIES } from '../browser/rawEditor';
import type { RoundTripText } from '../browser/rawEditor';
import {
  makeDocument,
  makeSummary,
  scriptedAcknowledgement,
  type ScriptedAcknowledgement
} from '../browser/fixtures';
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
import type { SurfaceBinding } from '../browser/surfaceReceivers';
import type { ObservationReceiver } from '../browser/workspace.svelte';
import {
  externalConflictSource,
  standingConflictOf,
  type ExternalConflictObservation
} from '../browser/conflictSource';
import {
  arbitratedDelivery,
  retainedDelivery,
  type ObservationDelivery
} from '../browser/observationDelivery';
import { codePointLabel } from '../browser/sourceText';
import { LOCALES, type Locale } from '../i18n/locale';
import { reconciliationRefusalKey, type ReconciliationRefusal } from '../browser/reconciliationStatus';

/**
 * Records every call that reaches `@tauri-apps/api/core`'s `invoke` while this
 * file's cases run — Phase 2d-6-11a. Every mount here is handed scripted ports, so
 * no case should ever reach the boundary; the mock below rejects any call that
 * does, and the file-level `afterEach` fails the case that made it. It catches a
 * call reaching `invoke` in the cases this file runs and proves nothing about
 * other files, other paths or code loaded dynamically outside this module graph.
 */
const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: readonly unknown[]): Promise<never> => {
    invoked(...args);
    return Promise.reject(new Error('this suite invokes no command'));
  }
}));

afterEach(() => {
  // Read, then cleared, then asserted, so one offending case does not fail the next.
  const calls = invoked.mock.calls.length;
  invoked.mockClear();
  expect(calls).toBe(0);
});

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

/**
 * A save the file had moved on under.
 *
 * **The disk side is on the payload since 2c-4a-2**, so a case that is about a
 * particular disk text puts it here rather than in a prop: the editor is handed
 * no `diskText` any more, and the naming collision that removed it is
 * `RawEditor.svelte`'s own note.
 *
 * @param diskText - The whole file text the fresh read found.
 * @returns The conflict as it crosses the boundary.
 */
function conflictWith(diskText: string = DISK): SaveResult {
  return {
    outcome: 'conflict',
    reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
    expected: BASE,
    found: AFTER,
    disk_revision: AFTER,
    disk_text: diskText,
    disk: makeDocument({ id: FILE.id, relativePath: FILE.relative_path, revision: AFTER })
  };
} // End of function conflictWith()

/** A save the file had moved on under, over the ordinary disk text. */
const CONFLICTED: SaveResult = conflictWith();

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
  /**
   * Every disk observation the component asked the window to install.
   *
   * **Empty is the assertion in most cases.** A conflict installs nothing into
   * the window since 2c-4a-2, so this stays empty until a reload is confirmed —
   * and one entry is what a confirmed reload owes.
   */
  readonly adoptions: ConflictModel<RoundTripText>[];
  /**
   * Hands the receiver this editor reported one sealed envelope, as the
   * window's registration would, and flushes — Phase 2d-6-8b. The window's own
   * registration and arbitration are `DetailPane.test.ts`'s.
   */
  readonly deliver: (delivery: ObservationDelivery) => void;
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
 * A binding whose two methods do nothing — the `reportReceiver` answer for a
 * mount that drives no delivery (Phase 2d-6-8a made the prop required; the
 * deliveries themselves are driven through the real pane in
 * `DetailPane.test.ts`).
 *
 * @returns The inert binding.
 */
function inertBinding(): SurfaceBinding {
  return { reportTarget: () => undefined, withdraw: () => undefined };
} // End of function inertBinding()

/**
 * Mounts the editor over a scripted boundary.
 *
 * @param answers - What each successive save answers, in order. A save with no
 *   answer left behaves as a command that failed with nothing written.
 * @param loaded - The file's text as the editor is handed it. Only the carriage
 *   return cases give this, because only they are about the text this editor
 *   refuses to open at all.
 * @param adoption - What the window answers when the editor asks it to adopt the
 *   disk observation. All three values are real production answers.
 * @returns The mounted editor.
 */
function mountEditor(
  answers: readonly ScriptedAnswer[],
  loaded: string = ORIGINAL,
  adoption: DiskAdoptionOutcome = 'installed'
): Mounted {
  const remaining = [...answers];
  const calls: RecordedSave[] = [];
  const adoptions: ConflictModel<RoundTripText>[] = [];
  let closes = 0;
  // The receiver the editor reports, kept so a case can deliver to it (Phase
  // 2d-6-8b); the window's own registration is `DetailPane.test.ts`'s.
  let receiver: ObservationReceiver | null = null;
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(RawEditor, {
    target,
    props: {
      acknowledgement: acknowledging.port,
      file: FILE,
      baseRevision: BASE,
      reportReceiver: (reported: ObservationReceiver): SurfaceBinding => {
        receiver = reported;
        return inertBinding();
      },
      text: loaded,
      adoptDiskVersion: (conflict: ConflictModel<RoundTripText>): DiskAdoptionOutcome => {
        adoptions.push(conflict);
        return adoption;
      },
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
    adoptions,
    deliver: (delivery: ObservationDelivery): void => {
      receiver?.(delivery);
      flushSync();
    },
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

/**
 * The reason the shared recovery renderer drew, or `null` when it drew nothing.
 *
 * **The proof that this surface mounts `RecoveryWithoutCreation.svelte`** rather
 * than repeating its paragraph. The attribute belongs to that component and its
 * value is the reason **it** derived, so a surface that stopped mounting it — or
 * that drew the same sentence itself — fails here even though the words on screen
 * would be identical. `says()` cannot tell those apart, and that a host can omit
 * the sentence while consuming the model faithfully is the failure mode
 * 2c-4c-3b's review found in four copied `{#if}` blocks.
 *
 * @param target - Where the component was mounted.
 * @returns The reason drawn, or `null` when nothing was.
 */
function recoveryNote(target: HTMLElement): string | null {
  const note = target.querySelector(`[${RECOVERY_WITHOUT_CREATION_ATTRIBUTE}]`);
  return note?.getAttribute(RECOVERY_WITHOUT_CREATION_ATTRIBUTE) ?? null;
} // End of function recoveryNote()

/**
 * The acknowledgement port every mount here is handed (Phase 2d-6-9b-2), fresh for
 * each case: it predicts an enabled control and accepts a press until a case
 * scripts otherwise, and records which source each press minted from.
 */
let acknowledging: ScriptedAcknowledgement = scriptedAcknowledgement();

beforeEach(() => {
  acknowledging = scriptedAcknowledgement();
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
    const editor = mountEditor([{ result: COMMITTED }], CRLF);

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
    const editor = mountEditor([{ result: COMMITTED }], CRLF.replaceAll('\r\n', '\n'));

    expect(maybeTextArea(editor.target)).not.toBeNull();
    expect(says(editor.target, 'browser.rawEditor.lineEndingsNotPreserved')).toBe(false);
    editor.stop();
  }); // End of the "carriage returns gone" case

  it('will not load a disk version whose line endings it cannot keep', async () => {
    // The one other way a text can enter a session. The disk version is still
    // *shown* — `SourceText` names a carriage return rather than dropping it — so a
    // control that silently did nothing would read as a bug; it is disabled, with a
    // sentence beside it.
    //
    // **That sentence is the reload's own since 2c-4a-3c's finding 10.5.** It used
    // to be `browser.rawEditor.lineEndingsNotPreserved`, which ends *"it will not
    // open this file for editing"* — the reason for a disabled **reload**
    // confirmation, carried by a sentence about a **different** control, on a panel
    // where the editor is open and the person's own draft is in the box. The window
    // reading printed the two beside each other (L29).
    const editor = mountEditor([{ result: conflictWith(CRLF) }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    control(editor.target, 'browser.saveOutcome.choice.reloadDiskVersion').click();
    flushSync();

    expect(says(editor.target, 'browser.rawEditor.diskLineEndingsNotPreserved')).toBe(true);
    // And the opening refusal is **not** what is drawn here. Both come from one
    // `rawEditorRefusal` call over two different texts, so a fix that pointed the
    // new accessor back at the old key would pass every other assertion in this file.
    expect(says(editor.target, 'browser.rawEditor.lineEndingsNotPreserved')).toBe(false);
    expect(control(editor.target, 'browser.saveOutcome.choice.confirmReload').disabled).toBe(true);
    // And the draft is untouched: nothing was loaded over it.
    expect(textArea(editor.target).value).toBe(`${ORIGINAL}# one more line\n`);
    // Nor was the window moved: a reload that refuses adopts nothing.
    expect(editor.adoptions).toEqual([]);
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

  it('draws an emptied file as empty, and still offers to load it', async () => {
    // **There is no "the disk version cannot be read" state, and 2c-4a-1's D1 is
    // why**: a conflict cannot exist unless the read that produced `disk_text`
    // succeeded, so the sentence that used to stand here described something this
    // application cannot produce, and it is gone from both dictionaries. A file of
    // zero characters is a text of zero characters — a fact about the file — and
    // loading it is a legitimate thing to ask for.
    const editor = mountEditor([{ result: conflictWith('') }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.detail.fileTextEmpty')).toBe(true);
    control(editor.target, 'browser.saveOutcome.choice.reloadDiskVersion').click();
    flushSync();

    expect(control(editor.target, 'browser.saveOutcome.choice.confirmReload').disabled).toBe(false);
    control(editor.target, 'browser.saveOutcome.choice.confirmReload').click();
    flushSync();

    expect(textArea(editor.target).value).toBe('');
    editor.stop();
  }); // End of the "empty disk version" case

  it('installs the disk projection only when the reload is confirmed', async () => {
    // **The consult's Q2 seen from the screen.** The conflict panel is drawn, the
    // warning is read, and the window has still not moved; the adoption happens in
    // the same click that reseeds the box, because `loadDiskVersion` performs it.
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(editor.adoptions).toEqual([]);
    control(editor.target, 'browser.saveOutcome.choice.reloadDiskVersion').click();
    flushSync();
    expect(editor.adoptions).toEqual([]);

    control(editor.target, 'browser.saveOutcome.choice.confirmReload').click();
    flushSync();

    expect(editor.adoptions).toHaveLength(1);
    expect(editor.adoptions[0]?.diskRevision).toBe(AFTER);
    expect(editor.adoptions[0]?.diskText).toBe(DISK);
    // And the box holds the disk version, from the same click.
    expect(textArea(editor.target).value).toBe(DISK);
    editor.stop();
  }); // End of the "adoption only on a confirmed reload" case

  it('stops offering the reload once the window has refused it, and says why', async () => {
    // **The 2c-4a-3a review's finding 3, from the screen.** A refusal comes back
    // without a word about which of `adoptDiskVersion`'s ordered guards produced
    // it, so the control goes and the sentence takes its place, with the draft
    // untouched behind it. That is a decision about what to draw, **not** a claim
    // that a later ask would be refused too: a refusal spends nothing.
    const editor = mountEditor([{ result: CONFLICTED }], ORIGINAL, 'refused');
    const candidate = `${ORIGINAL}# one more line\n`;
    type(editor.target, candidate);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    control(editor.target, 'browser.saveOutcome.choice.reloadDiskVersion').click();
    flushSync();
    control(editor.target, 'browser.saveOutcome.choice.confirmReload').click();
    flushSync();

    // The authored-text half of 3c-4's split: this surface's sentence is the
    // one that was always here, and the operation wording is not drawn.
    expect(says(editor.target, reloadUnavailableKey('authoredText'))).toBe(true);
    expect(says(editor.target, reloadUnavailableKey('operationChoice'))).toBe(false);
    expect(button(editor.target, 'browser.saveOutcome.choice.confirmReload')).toBeNull();
    expect(button(editor.target, 'browser.saveOutcome.choice.reloadDiskVersion')).toBeNull();
    expect(button(editor.target, 'browser.saveOutcome.choice.copyDraft')).not.toBeNull();
    // Nothing was reseeded and the window was asked exactly once.
    expect(textArea(editor.target).value).toBe(candidate);
    expect(editor.adoptions).toHaveLength(1);
    editor.stop();
  }); // End of the "refused reload stops being offered" case

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

  it('keeps the authored-text way out saying “Keep editing”', async () => {
    // **The other side of 2c-4a-3c's finding 10.2.** `conflictChoiceKey` branches
    // `keepEditing` on the draft kind now, and this editor drafts authored text —
    // it is the surface the label was borrowed *from* — so its own must not have
    // moved with the three operation-choice panels'.
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(button(editor.target, 'browser.rawSave.choice.keepEditing')).not.toBeNull();
    expect(button(editor.target, 'browser.saveOutcome.choice.keepOperation')).toBeNull();
    editor.stop();
  }); // End of the "authored-text way out" case
}); // End of the "mounted raw editor" suite

describe('the raw editor’s refused arm names what this surface drafts', () => {
  /*
   * **The 2c-4a-3c review's Medium, and the arm no window transcript had ever
   * drawn.** `rawSaveChoiceKey` returned `browser.rawSave.choice.keepEditing`
   * unconditionally, so a refusal carrying findings offered *Keep editing* on the
   * mover, the deleter and the duplicator, where nobody typed anything. 3c-3
   * deferred this on the grounds that no reading had seen it; the review's answer
   * is that absence from a transcript is a gap in evidence and not evidence that
   * a reachable label is correct.
   */

  it('labels the way out by the draft kind, and the same control still dismisses', async () => {
    const editor = mountEditor([{ result: REFUSED }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(button(editor.target, rawSaveChoiceKey('keepEditing', 'authoredText'))).not.toBeNull();
    expect(button(editor.target, rawSaveChoiceKey('keepEditing', 'operationChoice'))).toBeNull();

    // Nothing else moved: it is the same choice with the truthful label on it.
    control(editor.target, rawSaveChoiceKey('keepEditing', 'authoredText')).click();
    flushSync();
    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(editor.calls).toHaveLength(1);
    editor.stop();
  }); // End of the "refused arm names what this surface drafts" case
}); // End of the "raw editor's refused arm" suite

describe('the raw editor asks for its outcome to be brought into view', () => {
  /*
   * **2c-4a-3c's findings 10.3 and 10.4, from this component's own markup.** This
   * surface's panel opened highest of the three authored-text ones (y = 369) and
   * its controls were still below a 728 px fold at y = 916, with `section.detail`'s
   * `scrollTop` at `0` and nothing moving it.
   *
   * The decision is `./reveal.ts`'s and has its own suite; what only a mounted case
   * can say is that this file **binds** the two elements and **runs** the effect —
   * both of which can be deleted silently, and neither of which any model test can
   * see.
   */

  /** Every `scrollIntoView` the mounted component asked for, in order. */
  const scrolled: { readonly target: Element; readonly block: unknown }[] = [];

  beforeEach(() => {
    scrolled.length = 0;
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value(this: Element, options?: ScrollIntoViewOptions) {
        scrolled.push({ target: this, block: options?.block });
      }
    });
  });

  afterEach(() => {
    // jsdom leaves the property absent, so it is deleted rather than restored:
    // `reveal.test.ts` asserts that absence as the platform condition it guards.
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  /**
   * An editor showing a conflict over an edited draft.
   *
   * @returns The mounted editor.
   */
  async function conflicted(): Promise<ReturnType<typeof mountEditor>> {
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();
    return editor;
  } // End of function conflicted()

  it('asks for the panel’s first line when a conflict appears', async () => {
    const editor = await conflicted();
    const outcome = editor.target.querySelector('[role="status"]');
    expect(outcome).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(outcome);
    expect(scrolled[0]?.block).toBe('start');
    editor.stop();
  });

  it('asks for the controls at the reload’s second step', async () => {
    const editor = await conflicted();
    scrolled.length = 0;
    control(editor.target, 'browser.saveOutcome.choice.reloadDiskVersion').click();
    flushSync();

    const choices = editor.target.querySelector('[role="status"] .choices');
    expect(choices).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(choices);
    expect(scrolled[0]?.block).toBe('end');
    editor.stop();
  });

  it('asks for a committed save’s panel too', async () => {
    // **Not a conflict, and deliberately included.** `2c-3c-3-window-reading.md`
    // section 10.2 recorded the same class as a Low for the *committed* panel, and
    // `outcomeReveal` answers `panel` for every arm rather than for the conflict
    // alone — so the earlier Low is closed by the same change, and a later edit
    // that narrowed the reveal to conflicts would fail here.
    const editor = mountEditor([{ result: COMMITTED }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    const outcome = editor.target.querySelector('[role="status"]');
    expect(outcome).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(outcome);
    expect(scrolled[0]?.block).toBe('start');
    editor.stop();
  });

  it('asks for the replacing panel when one arm succeeds another', async () => {
    // **The 2c-4a-3c review's second finding, and only a mounted case can see it.**
    // `beginSave` retains the refusal while the retry is in flight, so `saved`
    // replaces `refused` over the **same** bound element. While all three arms
    // answered one `'panel'` cue the effect's dependency did not change, so it need
    // not run and nothing ever asked for the new panel's first line. The spy
    // is cleared before the second result, so what is asserted is a *new* reveal.
    const editor = mountEditor([{ result: REFUSED }, { result: COMMITTED }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();
    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    const refusedPanel = editor.target.querySelector('[role="status"]');

    scrolled.length = 0;
    control(editor.target, 'browser.rawSave.choice.saveAnyway').click();
    await settle();

    expect(says(editor.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    const savedPanel = editor.target.querySelector('[role="status"]');
    expect(savedPanel).toBe(refusedPanel);
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(savedPanel);
    expect(scrolled[0]?.block).toBe('start');
    editor.stop();
  }); // End of the "arm replacing an arm" case

  it('asks for the external panel when an observation raises a conflict (Phase 2d-6-8b)', () => {
    const editor = mountEditor([]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    scrolled.length = 0;
    editor.deliver(arbitratedDelivery(null, observed(5), false));

    const panel = editor.target.querySelector('.panel.external');
    expect(panel).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(panel);
    expect(scrolled[0]?.block).toBe('start');
    editor.stop();
  });

  it('reveals the external panel over a refusal kept as history, and its controls at the reload step (Phase 2d-6-8b)', async () => {
    const editor = mountEditor([{ result: REFUSED }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();
    scrolled.length = 0;

    editor.deliver(arbitratedDelivery(null, observed(5), false));

    const panel = editor.target.querySelector('.panel.external');
    expect(panel).not.toBeNull();
    expect(scrolled.map((one) => one.target)).toEqual([panel]);
    scrolled.length = 0;
    control(editor.target, 'browser.saveOutcome.choice.reloadDiskVersion').click();
    flushSync();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(panel?.querySelector('.choices'));
    expect(scrolled[0]?.block).toBe('end');
    editor.stop();
  });
}); // End of the "raw editor asks for its outcome" suite


describe('the raw editor never offers *Keep my draft*', () => {
  it('draws neither the control nor the line that would stand beside it', async () => {
    // **The consult's Q4 ruling, on the one screen it is about.** This candidate is
    // a whole document, so there is no target, no field intent and no operation to
    // re-resolve: `reapplySupport` is permanently `unavailable`, and
    // `conflictChoicesFor` requires it to be `supported` before it names the choice.
    // 2c-4c owns the recovery this editor is left with.
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();

    // The conflict really is on screen, so the absence below is about the choice
    // and not about the panel.
    expect(button(editor.target, 'browser.rawSave.choice.keepEditing')).not.toBeNull();
    for (const draftKind of ['authoredText', 'operationChoice'] as const) {
      expect(button(editor.target, conflictChoiceKey('keepMyDraft', draftKind))).toBeNull();
    } // End of the loop over the two labels the choice could wear
    expect(says(editor.target, 'browser.reapply.ready')).toBe(false);
    expect(says(editor.target, 'browser.reapply.readyOperation')).toBe(false);
    editor.stop();
  }); // End of the "no reapply control" case

  it('declares both halves of the refusal, so a boolean alone cannot undo it', () => {
    // The declaration this surface makes, read here rather than assumed from the
    // screen above: `offersReapply` says what the surface draws today and
    // `reapplySupport` says what it can ever do; the producer requires **both**,
    // and the second is why flipping the raw editor's boolean alone still offers
    // nothing.
    expect(CONFLICT_CAPABILITIES.reapplySupport).toBe('unavailable');
    expect(CONFLICT_CAPABILITIES.offersReapply).toBe(false);
    for (const step of ['idle', 'confirming', 'unavailable'] as const) {
      expect(
        conflictChoicesFor({ ...CONFLICT_CAPABILITIES, offersReapply: true }, step),
        step
      ).not.toContain('keepMyDraft');
    } // End of the loop over the three reload steps
  }); // End of the "declaration" case
}); // End of the "raw editor never offers a reapply" suite

describe('what the raw editor says about recovery', () => {
  /*
   * **2c-4c-3b's negative half on the fourth of its surfaces, and the one the
   * consult was asked to rule on explicitly.** This editor is **in** the recovery
   * contract and **out** of save-as-new: what it drafts is a whole document, so
   * there is no match-shaped value to send to `create_match` and no
   * document-creation command to send anything else to. What recovery is here is the
   * four things this screen already offers — keep editing, copy, compare, reload —
   * and the sentence names them.
   *
   * **This surface is why the gate asks about the conflict before the reapply.**
   * `reapplySupport` is `unavailable` here, so a `manualResolution` is unreachable
   * and an entry condition written on one would have silenced this sentence for
   * good; the case below that reaches it through an ordinary conflict is what would
   * fail if that ordering were ever reversed.
   *
   * **That same unavailability is why this editor has two non-committed endings and
   * the three match surfaces have three.** There is no *Keep my draft* here to
   * refuse anything, so a reapply that resolved nothing is not a state this screen
   * can be in; what is exercised below is the unconfirmed reload and the refused
   * one, and the record says exactly that rather than claiming a third.
   */

  /**
   * An editor showing a conflict over an edited draft.
   *
   * @param adoption - What the window answers when asked to adopt.
   * @returns The mounted editor.
   */
  async function conflictedEditor(
    adoption: DiskAdoptionOutcome = 'installed'
  ): Promise<Mounted> {
    const editor = mountEditor([{ result: CONFLICTED }], ORIGINAL, adoption);
    type(editor.target, `${ORIGINAL}# one more line\n`);
    control(editor.target, 'browser.rawEditor.save').click();
    await settle();
    return editor;
  } // End of function conflictedEditor()

  /** The reason a whole-document draft produces, so a rename is a compile error. */
  const REASON: RecoveryUnavailable = 'wholeDocumentDraft';

  it('says nothing at all until something has gone wrong', () => {
    const editor = mountEditor([]);
    // The shared renderer is mounted and drew nothing, which is its own decision
    // and not a condition this editor carries.
    expect(recoveryNote(editor.target)).toBeNull();
    expect(says(editor.target, recoveryUnavailableKey('wholeDocumentDraft'))).toBe(false);
    editor.stop();
  });

  it('offers no save-as-new, keeps the copy it already had, and says why', async () => {
    const editor = await conflictedEditor();

    // `recoveryNote` is what says the shared renderer drew it; `says` alone could
    // not tell that from a paragraph of this file's own.
    expect(recoveryNote(editor.target)).toBe(REASON);
    expect(says(editor.target, recoveryUnavailableKey('wholeDocumentDraft'))).toBe(true);
    expect(says(editor.target, recoveryUnavailableKey('operationDraft'))).toBe(false);
    // No save-as-new: neither the control 3a drew on the two creating surfaces nor
    // the form it opens is anywhere on this screen.
    expect(button(editor.target, recoveryChoiceKey('createFromSupportedFields'))).toBeNull();
    expect(says(editor.target, 'browser.recovery.label')).toBe(false);
    expect(says(editor.target, 'browser.recovery.transferHeading')).toBe(false);
    expect(says(editor.target, 'browser.recovery.destination')).toBe(false);
    // **The copy stays**, which is the half of the sentence that would otherwise be
    // a promise this screen does not keep: it drafts authored text, so
    // `conflictChoicesFor` names the copy and this editor draws it.
    expect(button(editor.target, conflictChoiceKey('copyDraft', 'authoredText'))).not.toBeNull();
    expect(editor.calls).toHaveLength(1);
    expect(editor.adoptions).toEqual([]);
    expect(editor.closed()).toBe(0);
    editor.stop();
  }); // End of the "no save-as-new" case

  it('keeps the conflict through both endings that wrote nothing', async () => {
    /*
     * **Both**, and not the three the match surfaces have: a reapply that resolved
     * nothing is unreachable here, so this case exercises the two reload endings and
     * claims no more.
     *
     * **Each asserts `closed()`.** The `close` callback is a spy rather than a
     * parent unmount, so an editor that had been told to close would go on rendering
     * and every sentence below would still be found — continued rendering is not
     * evidence that nothing closed, and the count is.
     */

    // A reload asked for and not confirmed: nothing spent, everything still drawn.
    const atTheWarning = await conflictedEditor();
    control(atTheWarning.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
    flushSync();
    expect(recoveryNote(atTheWarning.target)).toBe(REASON);
    expect(atTheWarning.adoptions).toEqual([]);
    expect(atTheWarning.calls).toHaveLength(1);
    expect(atTheWarning.closed()).toBe(0);
    atTheWarning.stop();

    // A reload the window refused: the conflict stayed, and the sentence with it.
    const refusedReload = await conflictedEditor('refused');
    control(refusedReload.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
    flushSync();
    control(refusedReload.target, conflictChoiceKey('confirmReload', 'authoredText')).click();
    flushSync();
    expect(refusedReload.adoptions).toHaveLength(1);
    expect(says(refusedReload.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(recoveryNote(refusedReload.target)).toBe(REASON);
    expect(refusedReload.calls).toHaveLength(1);
    expect(refusedReload.closed()).toBe(0);
    refusedReload.stop();
  }); // End of the "conflict survives both non-committed endings" case

  it('stops saying it when the person puts the conflict away', async () => {
    const editor = await conflictedEditor();
    control(editor.target, conflictChoiceKey('keepEditing', 'authoredText')).click();
    flushSync();

    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(recoveryNote(editor.target)).toBeNull();
    expect(says(editor.target, recoveryUnavailableKey('wholeDocumentDraft'))).toBe(false);
    expect(editor.adoptions).toEqual([]);
    expect(editor.calls).toHaveLength(1);
    // A dismissal is an ending that wrote nothing too, and it does not close either.
    expect(editor.closed()).toBe(0);
    editor.stop();
  }); // End of the "dismissal ends the sentence" case
}); // End of the "what the raw editor says about recovery" suite

/** The revision a watcher observation of the file read. */
const OBSERVED: ContentRevision = 'c'.repeat(64);

/** The revision a later observation read. */
const OBSERVED_LATER: ContentRevision = 'd'.repeat(64);

/** The whole text an observation read, with a word nothing else on screen holds. */
const OBSERVED_TEXT = 'matches:\n  - trigger: ":disk"\n    replace: observedondisk\n';

/** The word that tells the observed disk text apart on screen. */
const OBSERVED_MARKER = 'observedondisk';

/**
 * A disk text holding a lone carriage return and a CRLF — what this editor will
 * neither draw into its box nor reseed from (`CLAUDE.md` §6). The lone one is
 * the one a rendering can be held to: `SourceText` names it, and the DOM keeps a
 * CRLF indistinguishable from a line feed.
 */
const OBSERVED_CR_TEXT = 'matches:\r\n  - trigger: ":cr"\r    replace: crondisk\n';

/** The draft the cases below have typed before the file changes. */
const EDITED = `${ORIGINAL}# one more line\n`;

/**
 * One narrowed observation of the editor's file.
 *
 * A fresh object every call: the memo in `../browser/conflictSource.ts` and a
 * session's wait are both keyed on identity.
 *
 * @param sequence - The sequence it was admitted under.
 * @param revision - The revision it read.
 * @param diskText - The whole text it read.
 * @returns The observation.
 */
function observed(
  sequence: number,
  revision: ContentRevision = OBSERVED,
  diskText: string = OBSERVED_TEXT
): ExternalConflictObservation {
  return {
    sequence,
    document: FILE.id,
    previousRevision: BASE,
    diskRevision: revision,
    diskText,
    disk: makeDocument({ id: FILE.id, relativePath: FILE.relative_path, revision }),
    findings: [],
    correspondences: null
  };
} // End of function observed()

/**
 * The envelope a window seals for a first observation of the file.
 *
 * @param seen - The observation.
 * @param uncertain - Whether the last settled write may have written.
 * @returns The `raised` (or `raisedWithoutReload`) envelope.
 */
function raisedBy(seen: ExternalConflictObservation, uncertain = false): ObservationDelivery {
  return arbitratedDelivery(null, seen, uncertain);
} // End of function raisedBy()

/**
 * The envelope a window seals for a later observation over one that stands.
 *
 * @param prior - The observation whose origin stands.
 * @param seen - The later observation.
 * @returns The `supersedes` envelope.
 */
function supersededBy(
  prior: ExternalConflictObservation,
  seen: ExternalConflictObservation
): ObservationDelivery {
  return arbitratedDelivery(standingConflictOf(externalConflictSource(prior)), seen, false);
} // End of function supersededBy()

/**
 * The text of the external conflict's own panel, or `null` when none is drawn.
 *
 * @param target - Where the component was mounted.
 * @returns The panel's text.
 */
function externalText(target: HTMLElement): string | null {
  return target.querySelector('.panel.external')?.textContent ?? null;
} // End of function externalText()

/**
 * The external conflict's own panel, insisted upon.
 *
 * @param target - Where the component was mounted.
 * @returns The panel.
 */
function externalPanel(target: HTMLElement): HTMLElement {
  const found = target.querySelector<HTMLElement>('.panel.external');
  if (found === null) {
    throw new Error('this case needs the external conflict panel');
  }
  return found;
} // End of function externalPanel()

/**
 * The button labelled with one key's rendering in one language, or `null`.
 *
 * @param scope - Where to look.
 * @param lang - The language the case runs in.
 * @param key - The key holding the label.
 * @returns The button, or `null`.
 */
function buttonIn(scope: HTMLElement, lang: Locale, key: TranslationKey): HTMLButtonElement | null {
  const label = translate(lang, key);
  return (
    [...scope.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === label
    ) ?? null
  );
} // End of function buttonIn()

/**
 * The same button, insisted upon.
 *
 * @param scope - Where to look.
 * @param lang - The language the case runs in.
 * @param key - The key holding the label.
 * @returns The button.
 */
function controlIn(scope: HTMLElement, lang: Locale, key: TranslationKey): HTMLButtonElement {
  const found = buttonIn(scope, lang, key);
  if (found === null) {
    throw new Error(`this case needs the control labelled ${translate(lang, key)}`);
  }
  return found;
} // End of function controlIn()

/**
 * Presses a control the screen has disabled, as a person could not and a
 * script could — Phase 2d-6-8b's *direct submission refused*.
 *
 * `click()` on a disabled button dispatches nothing in jsdom, so a case that only
 * clicked would prove the attribute and never the handler. This lifts the
 * attribute for the one press, so the component's own handler runs and the model
 * door behind it is what refuses.
 *
 * @param control_ - The disabled button.
 */
function forcePress(control_: HTMLButtonElement): void {
  expect(control_.disabled).toBe(true);
  control_.disabled = false;
  control_.click();
} // End of function forcePress()

/**
 * An editor whose draft is edited, so a save would be offered.
 *
 * @param lang - The language the case runs in.
 * @param adoption - What the window answers when asked to adopt.
 * @returns The mounted editor.
 */
function editedEditor(lang: Locale, adoption: DiskAdoptionOutcome = 'installed'): Mounted {
  locale.setOverride(lang);
  const editor = mountEditor([{ result: COMMITTED }], ORIGINAL, adoption);
  type(editor.target, EDITED);
  expect(controlIn(editor.target, lang, 'browser.rawEditor.save').disabled).toBe(false);
  return editor;
} // End of function editedEditor()

/** The raw editor's conflict choices, labelled by its own draft kind. */
const CHOICE = {
  keepEditing: conflictChoiceKey('keepEditing', CONFLICT_CAPABILITIES.draftKind),
  copyDraft: conflictChoiceKey('copyDraft', CONFLICT_CAPABILITIES.draftKind),
  reloadDiskVersion: conflictChoiceKey('reloadDiskVersion', CONFLICT_CAPABILITIES.draftKind),
  confirmReload: conflictChoiceKey('confirmReload', CONFLICT_CAPABILITIES.draftKind),
  keepMyDraft: conflictChoiceKey('keepMyDraft', CONFLICT_CAPABILITIES.draftKind)
} as const;

describe('the raw editor under an external conflict, in English and Spanish — Phase 2d-6-8b', () => {
  // **2d-6-8's acceptance for this editor, read off the screen** (the 2d-6
  // record's §3 entries 23, 34 and 35). The receiver is the one the editor
  // reported, handed envelopes the real `arbitratedDelivery` / `retainedDelivery`
  // sealed; the window's own registration and arbitration are
  // `DetailPane.test.ts`'s. Every sentence is pinned to its dictionary value in
  // the case's locale: that protects which code is drawn where, never the
  // quality of a translation.

  it.each(LOCALES)('says a reading waits under Save, keeps the box editable, and a forced save sends nothing (%s)', async (lang) => {
    const editor = editedEditor(lang);
    editor.deliver(retainedDelivery(observed(5)));

    // A held reading is a restriction on sending alone (2d-6-5 §1.2): the box
    // stays editable and the save is off. The sentence that says why is the
    // pane's, drawn once above this panel since Phase 2d-6-9b-2, never this
    // panel's (`ReconciliationStatus.test.ts` reads it there).
    const save = controlIn(editor.target, lang, 'browser.rawEditor.save');
    expect(editor.target.textContent).not.toContain(
      translate(lang, 'browser.externalConflict.observationRetained')
    );
    expect(textArea(editor.target).readOnly).toBe(false);
    expect(externalText(editor.target)).toBeNull();
    forcePress(save);
    await settle();
    expect(editor.calls).toEqual([]);
    editor.stop();
  }); // End of the "held reading" case

  it.each(LOCALES)('draws the origin, its lines, its revision and the comparison, freezes the box, and a forced save sends nothing (%s)', async (lang) => {
    const editor = editedEditor(lang);
    editor.deliver(raisedBy(observed(5)));

    const shown = externalText(editor.target);
    expect(shown).not.toBeNull();
    // The origin and the observation's own lines — and none of a save's.
    expect(shown).toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
    expect(shown).toContain(translate(lang, 'browser.externalConflict.fileChangedWhileOpen'));
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.draftKeptInMemory'));
    expect(shown).toContain(translate(lang, 'browser.saveOutcome.reloadDiscardsDraft'));
    expect(shown).toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: OBSERVED })
    );
    const all = editor.target.textContent ?? '';
    expect(all).not.toContain(translate(lang, 'browser.conflictOrigin.refusedSave'));
    expect(all).not.toContain(translate(lang, 'browser.saveOutcome.changedElsewhere'));
    expect(all).not.toContain(translate(lang, 'browser.saveOutcome.nothingWasWritten'));
    expect(all).not.toContain(translate(lang, 'browser.rawEditor.revisionExpected', { revision: BASE }));
    // The comparison: the draft in the frozen box beside the whole disk text.
    expect(textArea(editor.target).value).toBe(EDITED);
    expect(textArea(editor.target).readOnly).toBe(true);
    expect(shown).toContain(translate(lang, 'browser.rawEditor.diskVersion'));
    expect(shown).toContain(OBSERVED_MARKER);
    // The three choices, and never *Keep my draft* (`reapplySupport: 'unavailable'`).
    const panel = externalPanel(editor.target);
    for (const key of [CHOICE.keepEditing, CHOICE.copyDraft, CHOICE.reloadDiskVersion]) {
      expect(buttonIn(panel, lang, key)).not.toBeNull();
    } // End of the loop over the three offered choices
    expect(buttonIn(panel, lang, CHOICE.keepMyDraft)).toBeNull();
    // Recovery is the shared sentence for a whole document.
    expect(recoveryNote(editor.target)).toBe('wholeDocumentDraft');
    // **Direct submission is refused**, past the disabled control too.
    forcePress(controlIn(editor.target, lang, 'browser.rawEditor.save'));
    await settle();
    expect(editor.calls).toEqual([]);
    expect(editor.adoptions).toEqual([]);
    editor.stop();
  }); // End of the "origin and comparison" case

  it.each(
    LOCALES.flatMap((lang) =>
      (['installed', 'alreadyThere', 'refused'] as const).map((adoption) => [lang, adoption] as const)
    )
  )('reseeds the box from the disk version in two steps, on what the window answers (%s, %s)', (lang, adoption) => {
    const editor = editedEditor(lang, adoption);
    const seen = observed(5);
    editor.deliver(raisedBy(seen));
    controlIn(externalPanel(editor.target), lang, CHOICE.reloadDiskVersion).click();
    flushSync();
    expect(editor.adoptions).toEqual([]);
    controlIn(externalPanel(editor.target), lang, CHOICE.confirmReload).click();
    flushSync();

    // One adoption, of this observation's conflict and no other.
    expect(editor.adoptions).toHaveLength(1);
    expect(editor.adoptions[0]?.source).toBe(externalConflictSource(seen));
    if (adoption === 'refused') {
      // Nothing is reseeded over a window that did not move, and the control that
      // has just gone is replaced by the reason.
      expect(textArea(editor.target).value).toBe(EDITED);
      expect(externalText(editor.target)).toContain(
        translate(lang, reloadUnavailableKey(CONFLICT_CAPABILITIES.draftKind))
      );
      expect(buttonIn(externalPanel(editor.target), lang, CHOICE.reloadDiskVersion)).toBeNull();
    } else {
      // **Reseeded, not closed and not retargeted**: the box holds the disk text,
      // takes edits again, and the panel is gone.
      expect(textArea(editor.target).value).toBe(OBSERVED_TEXT);
      expect(textArea(editor.target).readOnly).toBe(false);
      expect(externalText(editor.target)).toBeNull();
      expect(editor.target.textContent).not.toContain(translate(lang, 'browser.rawEditor.unsaved'));
      expect(controlIn(editor.target, lang, 'browser.rawEditor.save').disabled).toBe(true);
    }
    expect(editor.closed()).toBe(0);
    expect(editor.calls).toEqual([]);
    editor.stop();
  }); // End of the "two-step reseed" case

  it.each(LOCALES)('keeps the conflict through Keep editing, and resets the reload step (%s)', (lang) => {
    const editor = editedEditor(lang);
    editor.deliver(raisedBy(observed(5)));
    controlIn(externalPanel(editor.target), lang, CHOICE.reloadDiskVersion).click();
    flushSync();
    expect(buttonIn(externalPanel(editor.target), lang, CHOICE.confirmReload)).not.toBeNull();

    controlIn(externalPanel(editor.target), lang, CHOICE.keepEditing).click();
    flushSync();

    // The first step is back; the conflict stands (entry 9), so the box stays
    // frozen and nothing can be sent.
    expect(buttonIn(externalPanel(editor.target), lang, CHOICE.confirmReload)).toBeNull();
    expect(buttonIn(externalPanel(editor.target), lang, CHOICE.reloadDiskVersion)).not.toBeNull();
    expect(textArea(editor.target).readOnly).toBe(true);
    expect(controlIn(editor.target, lang, 'browser.rawEditor.save').disabled).toBe(true);
    expect(editor.adoptions).toEqual([]);
    editor.stop();
  }); // End of the "keep editing" case

  it.each(LOCALES)('copies the draft under the conflict, and a later reading withdraws the disclosure (%s)', async (lang) => {
    const original = Object.getOwnPropertyDescriptor(document, 'execCommand');
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: (command: string): boolean => command === 'copy'
    });
    try {
      const editor = editedEditor(lang);
      const first = observed(5);
      editor.deliver(raisedBy(first));
      controlIn(externalPanel(editor.target), lang, CHOICE.copyDraft).click();
      await settle();
      expect(externalText(editor.target)).toContain(translate(lang, 'browser.rawEditor.draftCopied'));

      editor.deliver(supersededBy(first, observed(6, OBSERVED_LATER)));

      // Entry 12: the disclosure was about the conflict that was on screen, and a
      // replaced conflict is a different snapshot nothing was copied of.
      expect(externalText(editor.target)).not.toContain(translate(lang, 'browser.rawEditor.draftCopied'));
      expect(textArea(editor.target).value).toBe(EDITED);
      editor.stop();
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(document, 'execCommand');
      } else {
        Object.defineProperty(document, 'execCommand', original);
      }
    }
  }); // End of the "copy disclosure withdrawn" case

  it.each(LOCALES)('withdraws the reload warning when a later reading supersedes the conflict (%s)', (lang) => {
    const editor = editedEditor(lang);
    const first = observed(5);
    editor.deliver(raisedBy(first));
    controlIn(externalPanel(editor.target), lang, CHOICE.reloadDiskVersion).click();
    flushSync();
    expect(buttonIn(externalPanel(editor.target), lang, CHOICE.confirmReload)).not.toBeNull();

    editor.deliver(supersededBy(first, observed(6, OBSERVED_LATER)));

    // Entry 12: the confirmation collected for the first conflict is not
    // spendable against this one, and its second step does not stay on screen.
    expect(buttonIn(externalPanel(editor.target), lang, CHOICE.confirmReload)).toBeNull();
    expect(buttonIn(externalPanel(editor.target), lang, CHOICE.reloadDiskVersion)).not.toBeNull();
    const shown = externalText(editor.target) ?? '';
    expect(shown).toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: OBSERVED_LATER })
    );
    expect(shown).not.toContain(
      translate(lang, 'browser.externalConflict.revisionObserved', { revision: OBSERVED })
    );
    // The draft is the superseded conflict's own, still in the frozen box.
    expect(textArea(editor.target).value).toBe(EDITED);
    expect(editor.adoptions).toEqual([]);
    editor.stop();
  }); // End of the "supersession" case

  it.each(LOCALES)('withholds the reload while an earlier write’s outcome is unknown (%s)', (lang) => {
    const editor = editedEditor(lang);
    editor.deliver(raisedBy(observed(5), true));

    // The sentence is the pane's since Phase 2d-6-9b-2; this panel draws the
    // acknowledgement instead (the suite at the end of this file).
    expect(editor.target.textContent).not.toContain(
      translate(lang, 'browser.externalConflict.writeOutcomeUnknown')
    );
    const panel = externalPanel(editor.target);
    expect(buttonIn(panel, lang, 'browser.externalConflict.action.acknowledgeSnapshot')).not.toBeNull();
    expect(buttonIn(panel, lang, CHOICE.keepEditing)).not.toBeNull();
    expect(buttonIn(panel, lang, CHOICE.copyDraft)).not.toBeNull();
    expect(buttonIn(panel, lang, CHOICE.reloadDiskVersion)).toBeNull();
    editor.stop();
  }); // End of the "unknown outcome" case

  it.each(LOCALES)('names the carriage returns of a disk version it will not reseed from, and a forced reload loads nothing (%s)', (lang) => {
    const editor = editedEditor(lang);
    editor.deliver(raisedBy(observed(5, OBSERVED, OBSERVED_CR_TEXT)));
    controlIn(externalPanel(editor.target), lang, CHOICE.reloadDiskVersion).click();
    flushSync();

    const shown = externalText(editor.target) ?? '';
    // **Disclosed, not normalized**: the disk text is drawn through `SourceText`,
    // which names the lone carriage return, and the reload's own refusal sentence
    // stands beside it.
    expect(shown).toContain(
      translate(lang, 'browser.source.invisible.carriageReturn', { code: codePointLabel('\r') })
    );
    expect(shown).toContain('crondisk');
    expect(shown).toContain(translate(lang, 'browser.rawEditor.diskLineEndingsNotPreserved'));
    expect(shown).not.toContain(translate(lang, 'browser.rawEditor.lineEndingsNotPreserved'));
    // Never into a box: the editor's own box is the only one, and it holds the
    // draft, which has no carriage return.
    expect(editor.target.querySelectorAll('textarea, input')).toHaveLength(1);
    expect(textArea(editor.target).value).toBe(EDITED);
    forcePress(controlIn(externalPanel(editor.target), lang, CHOICE.confirmReload));
    flushSync();
    expect(editor.adoptions).toEqual([]);
    expect(textArea(editor.target).value).toBe(EDITED);
    editor.stop();
  }); // End of the "carriage returns on disk" case

  it.each(LOCALES)('keeps its session across a change of language (%s)', (lang) => {
    const editor = editedEditor(lang);
    editor.deliver(raisedBy(observed(5)));
    controlIn(externalPanel(editor.target), lang, CHOICE.reloadDiskVersion).click();
    flushSync();

    const other: Locale = lang === 'en' ? 'es' : 'en';
    locale.setOverride(other);
    flushSync();

    // The same step of the same conflict, now in the other language.
    const shown = externalText(editor.target) ?? '';
    expect(shown).toContain(translate(other, 'browser.conflictOrigin.changedWhileOpen'));
    expect(buttonIn(externalPanel(editor.target), other, CHOICE.confirmReload)).not.toBeNull();
    expect(textArea(editor.target).value).toBe(EDITED);
    editor.stop();
  }); // End of the "language switch" case

  it.each(LOCALES)('names a save as the origin of a save conflict, beside its three revisions (%s)', async (lang) => {
    locale.setOverride(lang);
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, EDITED);
    controlIn(editor.target, lang, 'browser.rawEditor.save').click();
    await settle();

    const all = editor.target.textContent ?? '';
    expect(all).toContain(translate(lang, 'browser.conflictOrigin.refusedSave'));
    expect(all).toContain(translate(lang, 'browser.rawEditor.revisionExpected', { revision: BASE }));
    expect(all).not.toContain(translate(lang, 'browser.conflictOrigin.changedWhileOpen'));
    expect(externalText(editor.target)).toBeNull();
    editor.stop();
  }); // End of the "save origin" case

  it.each(LOCALES)('withdraws Save anyway under a refusal kept as history once the file changes (%s)', async (lang) => {
    locale.setOverride(lang);
    const editor = mountEditor([{ result: REFUSED }]);
    type(editor.target, EDITED);
    controlIn(editor.target, lang, 'browser.rawEditor.save').click();
    await settle();
    expect(buttonIn(editor.target, lang, 'browser.rawSave.choice.saveAnyway')).not.toBeNull();

    editor.deliver(raisedBy(observed(5)));

    // The refusal stays as history (entry 7) with only its dismissal: *Save
    // anyway* would reach a door that refuses it.
    expect(buttonIn(editor.target, lang, 'browser.rawSave.choice.saveAnyway')).toBeNull();
    expect(externalText(editor.target)).not.toBeNull();
    expect(editor.calls).toHaveLength(1);
    editor.stop();
  }); // End of the "refusal kept as history" case
}); // End of the "raw editor under an external conflict" suite

/**
 * The button labelled with one key's rendering in one language, or `null` —
 * Phase 2d-6-9b-2's acknowledgement cases.
 *
 * @param scope - Where to look.
 * @param lang - The language the case runs in.
 * @param key - The key holding the label.
 * @returns The button, or `null`.
 */
function labelledIn(scope: HTMLElement, lang: Locale, key: TranslationKey): HTMLButtonElement | null {
  const label = translate(lang, key);
  return [...scope.querySelectorAll('button')].find((each) => each.textContent?.trim() === label) ?? null;
} // End of function labelledIn()

/**
 * The external conflict's own panel, for the acknowledgement cases.
 *
 * @param target - Where the component was mounted.
 * @returns The panel.
 */
function externalConflictPanel(target: HTMLElement): HTMLElement {
  const found = target.querySelector<HTMLElement>('.panel.external');
  if (found === null) {
    throw new Error('this case needs the external conflict panel');
  }
  return found;
} // End of function externalConflictPanel()

/** The acknowledgement's label key, shared with the workspace route. */
const ACKNOWLEDGE_SNAPSHOT: TranslationKey = 'browser.externalConflict.action.acknowledgeSnapshot';

/** This panel's reload choice, whose presence says whether the reload is withheld. */
const RELOAD_CHOICE = conflictChoiceKey('reloadDiskVersion', 'authoredText');

describe('The raw editor acknowledges an unknown write outcome on its own panel, in English and Spanish — Phase 2d-6-9b-2', () => {
  // The pane draws the unknown-outcome sentence once, above this panel
  // (`FileReconciliationStatus.svelte`); this panel draws only the control, under
  // the disk snapshot it is about, and mints from its own conflict's source
  // through the port `DetailPane.svelte` hands it. The port is scripted here
  // (`scriptedAcknowledgement` in `../browser/fixtures.ts`); the window's own is
  // `ReconciliationStatus.test.ts`'s.

  /**
   * Mounts the panel and brings it to the point where a conflict can be shown.
   *
   * @param lang - The language the case runs in.
   * @returns The mounted panel.
   */
  async function opened(lang: Locale): Promise<Mounted> {
    locale.setOverride(lang);
    const mounted = editedEditor(lang);
    return mounted;
  } // End of function opened()

  /**
   * One observation of the panel's file.
   *
   * @returns A fresh observation, so its source is its own.
   */
  function seenChange(): ExternalConflictObservation {
    return observed(5);
  } // End of function seenChange()

  it.each(LOCALES)('offers it under the disk snapshot, mints from the conflict it shows, and offers the reload again (%s)', async (lang) => {
    const mounted = await opened(lang);
    const seen = seenChange();
    mounted.deliver(arbitratedDelivery(null, seen, true));

    const panel = externalConflictPanel(mounted.target);
    const acknowledge = labelledIn(panel, lang, ACKNOWLEDGE_SNAPSHOT);
    expect(acknowledge?.disabled).toBe(false);
    // Under the snapshot it is about: the disk text comes first in the panel.
    const text = panel.textContent ?? '';
    expect(text.indexOf('observedondisk')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('observedondisk')).toBeLessThan(text.indexOf(translate(lang, ACKNOWLEDGE_SNAPSHOT)));
    // The unknown-outcome sentence is the pane's and never this panel's.
    expect(mounted.target.textContent).not.toContain(
      translate(lang, 'browser.externalConflict.writeOutcomeUnknown')
    );
    expect(labelledIn(panel, lang, RELOAD_CHOICE)).toBeNull();

    acknowledge?.click();
    flushSync();
    // One press, minted from the very source this panel shows.
    expect(acknowledging.asked).toHaveLength(1);
    expect(acknowledging.asked[0]).toBe(externalConflictSource(seen));
    const after = externalConflictPanel(mounted.target);
    expect(labelledIn(after, lang, ACKNOWLEDGE_SNAPSHOT)).toBeNull();
    // The reload is offered again, from its idle step, and nothing was adopted.
    expect(labelledIn(after, lang, RELOAD_CHOICE)).not.toBeNull();
    expect(mounted.adoptions).toEqual([]);
    mounted.stop();
  }); // End of the "acknowledged" case

  it.each(LOCALES)('draws it disabled with its refusal and this panel’s exits, and keeps the reload withheld (%s)', async (lang) => {
    const cases: readonly (readonly [ReconciliationRefusal, TranslationKey | null])[] = [
      ['projectionReplaced', 'browser.reconciliation.surface.observationExit'],
      ['superseded', 'browser.reconciliation.surface.observationExit'],
      ['holdMoved', 'browser.reconciliation.surface.holdEnded'],
      ['writeInFlight', null]
    ];
    for (const [refusal, note] of cases) {
      acknowledging.refusal = refusal;
      const mounted = await opened(lang);
      mounted.deliver(arbitratedDelivery(null, seenChange(), true));

      const panel = externalConflictPanel(mounted.target);
      expect(labelledIn(panel, lang, ACKNOWLEDGE_SNAPSHOT)?.disabled).toBe(true);
      const text = panel.textContent ?? '';
      expect(text).toContain(translate(lang, reconciliationRefusalKey(refusal)));
      for (const exit of [
        'browser.reconciliation.surface.observationExit',
        'browser.reconciliation.surface.holdEnded'
      ] as const) {
        expect(text.includes(translate(lang, exit))).toBe(exit === note);
      }
      expect(labelledIn(panel, lang, RELOAD_CHOICE)).toBeNull();
      mounted.stop();
    } // End of the loop over the four refusals
  }); // End of the "disabled" case

  it.each(LOCALES)('draws a refused press’s reason once and changes nothing (%s)', async (lang) => {
    acknowledging.answer = 'holdMoved';
    const mounted = await opened(lang);
    mounted.deliver(arbitratedDelivery(null, seenChange(), true));

    labelledIn(externalConflictPanel(mounted.target), lang, ACKNOWLEDGE_SNAPSHOT)?.click();
    flushSync();
    expect(acknowledging.asked).toHaveLength(1);
    const panel = externalConflictPanel(mounted.target);
    const sentence = translate(lang, 'browser.reconciliation.refusal.holdMoved');
    expect((panel.textContent ?? '').split(sentence)).toHaveLength(2);
    // The window said no, so the session is as it was: still withholding.
    expect(labelledIn(panel, lang, ACKNOWLEDGE_SNAPSHOT)).not.toBeNull();
    expect(labelledIn(panel, lang, RELOAD_CHOICE)).toBeNull();
    mounted.stop();
  }); // End of the "refused press" case

  it.each(LOCALES)('offers nothing to acknowledge over a conflict raised under no uncertainty (%s)', async (lang) => {
    const mounted = await opened(lang);
    mounted.deliver(arbitratedDelivery(null, seenChange(), false));

    const panel = externalConflictPanel(mounted.target);
    expect(labelledIn(panel, lang, ACKNOWLEDGE_SNAPSHOT)).toBeNull();
    expect(labelledIn(panel, lang, RELOAD_CHOICE)).not.toBeNull();
    mounted.stop();
  }); // End of the "nothing owed" case
}); // End of the "own acknowledgement" suite
