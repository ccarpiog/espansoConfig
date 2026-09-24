/** @vitest-environment jsdom */

/**
 * The mounted snippet text editor — Phase 3-8-2.
 *
 * `RawSnippetEditor.svelte` draws `../browser/rawSnippet.ts`, whose own suite
 * drives the values without a screen. This suite mounts the component over
 * scripted ports and checks what a model test cannot: that each value reaches the
 * screen as the control or sentence it stands for — the load and its refusals,
 * the draft and its save, the whole-document fallback, the trailing-blank-line
 * explanation, a stale identity, the uncertain write and its reconciliation, and
 * **CF-55's disabled *Undo* and *Redo* under a held save** (ruling 13), with a
 * click on each changing nothing.
 *
 * **Mounted evidence, never a window reading** (ruling 30): jsdom has no layout
 * and no WebKit. The window half is 3-8-3's.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalConflictObservation } from '../browser/conflictSource';
import { makeDocument, makeSummary, scriptedAcknowledgement } from '../browser/fixtures';
import { arbitratedDelivery, retainedDelivery, type ObservationDelivery } from '../browser/observationDelivery';
import { rawSaveChoiceKey } from '../browser/rawSave';
import type { RoundTripText } from '../browser/rawSnippet';
import { conflictChoiceKey, type ConflictModel, type DiskAdoptionOutcome } from '../browser/saveOutcome';
import type { SurfaceBinding } from '../browser/surfaceReceivers';
import type { MatchSaveAnswer, ObservationReceiver } from '../browser/workspace.svelte';
import { DICTIONARIES, translate, type TranslationKey } from '../i18n/dictionaries';
import { LOCALES, type Locale } from '../i18n/locale';
import type { CommandResult } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  EditError,
  Finding,
  MatchId,
  OwnedItemText,
  SaveResult
} from '../ipc/types';
import { locale } from '../stores/locale.svelte';
import RawSnippetEditor from './RawSnippetEditor.svelte';

/**
 * Records every call that reaches `@tauri-apps/api/core`'s `invoke`. Every mount
 * here is handed scripted ports, so no case should reach the boundary; the
 * file-level `afterEach` fails the case that did. It proves nothing about other
 * files or paths.
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

/** The revision the snippet's text was read at. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The file the snippet lives in. */
const FILE = makeSummary({ id: 4, relativePath: 'match/base.yml' });

/** The snippet, by the identity the pane captured. */
const MATCH: MatchId = { document: FILE.id, revision: BASE, node: 9 };

/** The snippet's identity in the revision a commit produced. */
const MOVED: MatchId = { document: FILE.id, revision: AFTER, node: 11 };

/** The snippet's owned text, with a non-ASCII character before its value. */
const OWNED = '  - trigger: ":hé"\n    replace: "hi"\n';

/** One edit of it. */
const EDITED = '  - trigger: ":hé"\n    replace: "hello"\n';

/** A second edit, so the history holds an undo and a redo step. */
const THIRD = '  - trigger: ":hé"\n    replace: "third"\n';

/** An edit that ends with a blank line, which the core refuses (3-7 §5 item 2). */
const TRAILING_BLANK = '  - trigger: ":hé"\n    replace: "hello"\n\n';

/**
 * What `match_item_text` answers for one text.
 *
 * @param text - The range's text.
 * @param first - The line the range starts on.
 * @returns The answer.
 */
function owned(text: string = OWNED, first = 7): CommandResult<OwnedItemText> {
  return { ok: true, value: { text, first_line: first, line_count: 2 } };
} // End of function owned()

/**
 * A read refused by the core.
 *
 * @param error - The core's refusal.
 * @returns The answer.
 */
function readRefused(error: EditError): CommandResult<OwnedItemText> {
  return { ok: false, failure: { kind: 'command', error: { code: 'itemTextRefused', error } } };
} // End of function readRefused()

/**
 * A save the engine refused, which wrote nothing.
 *
 * @param error - The core's refusal.
 * @returns The answer.
 */
function engineRefused(error: EditError): MatchSaveAnswer {
  const failure: IpcFailure = {
    kind: 'command',
    error: { code: 'saveFailed', error: { Patch: error }, may_have_written: false }
  };
  return { kind: 'failed', mayHaveWritten: false, failure };
} // End of function engineRefused()

/** A save that may have written. */
const MAY_HAVE_WRITTEN: MatchSaveAnswer = {
  kind: 'failed',
  mayHaveWritten: true,
  failure: {
    kind: 'command',
    error: {
      code: 'saveFailed',
      error: { Target: { TargetMissing: { path: '/nowhere/match/base.yml' } } },
      may_have_written: true
    }
  }
};

/**
 * A save that ran to the end.
 *
 * @param moved - The snippet's identity in the new revision, or `null`.
 * @returns The answer.
 */
function saved(moved: MatchId | null = MOVED): MatchSaveAnswer {
  return {
    kind: 'answered',
    result: { outcome: 'saved', revision: AFTER, committed: true, notes: [], backup_taken: false, moved },
    adoption: { kind: 'done' }
  };
} // End of function saved()

/** A finding the gate lets an acknowledgement move. */
const SUSPICION: Finding = {
  code: { ReferenceHasNoDeclaration: { name: 'greeting' } },
  span: null,
  node: null,
  path: null
};

/** A refusal for findings. */
const REFUSED: MatchSaveAnswer = {
  kind: 'answered',
  result: { outcome: 'refused', verdict: 'RefusedForUnacknowledgedSuspicions', findings: [SUSPICION] },
  adoption: { kind: 'notOwed' }
};

/** The whole file on disk after another writer. */
const DISK = 'matches:\n  - trigger: x\n    replace: theirs\n';

/** A save the file had moved on under. */
const CONFLICTED: MatchSaveAnswer = {
  kind: 'answered',
  result: {
    outcome: 'conflict',
    reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
    expected: BASE,
    found: AFTER,
    disk_revision: AFTER,
    disk_text: DISK,
    disk: makeDocument({ id: FILE.id, relativePath: FILE.relative_path, revision: AFTER })
  } satisfies SaveResult,
  adoption: { kind: 'notOwed' }
};

/** One call the component made to the save port. */
interface RecordedSave {
  /** The identity it sent. */
  readonly id: MatchId;
  /** The revision it claimed. */
  readonly baseRevision: ContentRevision;
  /** The exact text. */
  readonly text: string;
  /** The consent it carried. */
  readonly acknowledgement: Acknowledgement;
}

/** What a mount scripts. */
interface Script {
  /** What each successive read answers; past the end the start-up answer repeats. */
  readonly reads?: readonly CommandResult<OwnedItemText>[];
  /** What each successive save answers; `'pending'` never settles. */
  readonly saves?: readonly (MatchSaveAnswer | 'pending')[];
  /** Whether the pane can show this file's whole text. */
  readonly wholeDocument?: boolean;
  /** The identity the window points at in the file, for the reconciliation. */
  readonly inWindow?: MatchId | null;
  /** What the window answers an adoption. */
  readonly adoption?: DiskAdoptionOutcome;
}

/** A mounted editor and what a case needs to drive it. */
interface Mounted {
  /** Where it was mounted. */
  readonly target: HTMLElement;
  /** Every read, by identity. */
  readonly reads: MatchId[];
  /** Every save. */
  readonly saves: RecordedSave[];
  /** How many times it asked to close. */
  readonly closed: () => number;
  /** How many times it asked for the whole file. */
  readonly wholeDocumentAsked: () => number;
  /** Every disk version it asked the window to install. */
  readonly adoptions: ConflictModel<RoundTripText>[];
  /** Hands the reported receiver one envelope and flushes. */
  readonly deliver: (delivery: ObservationDelivery) => void;
  /** Whether the reported binding was withdrawn. */
  readonly withdrawn: () => boolean;
  /** Tears it down. */
  readonly stop: () => void;
}

/**
 * Mounts the editor over scripted ports and waits for its start-up read.
 *
 * @param script - What the ports answer.
 * @returns The mounted editor.
 */
async function mountEditor(script: Script = {}): Promise<Mounted> {
  const reads: MatchId[] = [];
  const saves: RecordedSave[] = [];
  const adoptions: ConflictModel<RoundTripText>[] = [];
  const readQueue = [...(script.reads ?? [owned()])];
  const saveQueue = [...(script.saves ?? [])];
  let closes = 0;
  let wholeDocument = 0;
  let withdrawn = false;
  let receiver: ObservationReceiver | null = null;
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(RawSnippetEditor, {
    target,
    props: {
      match: MATCH,
      file: FILE,
      read: (id: MatchId): Promise<CommandResult<OwnedItemText>> => {
        reads.push(id);
        const next = readQueue.length > 1 ? readQueue.shift() : readQueue[0];
        return Promise.resolve(next ?? owned());
      },
      save: (
        id: MatchId,
        baseRevision: ContentRevision,
        text: string,
        acknowledgement: Acknowledgement
      ): Promise<MatchSaveAnswer> => {
        saves.push({ id, baseRevision, text, acknowledgement });
        const next = saveQueue.shift();
        if (next === 'pending') {
          // Never resolves: the case is about the screen while a save is held.
          return new Promise<MatchSaveAnswer>(() => undefined);
        }
        return Promise.resolve(next ?? { kind: 'notAttempted' });
      },
      identityInWindow: (_document: DocumentId): MatchId | null =>
        script.inWindow === undefined ? MOVED : script.inWindow,
      adoptDiskVersion: (conflict: ConflictModel<RoundTripText>): DiskAdoptionOutcome => {
        adoptions.push(conflict);
        return script.adoption ?? 'installed';
      },
      reportReceiver: (reported: ObservationReceiver): SurfaceBinding => {
        receiver = reported;
        return {
          reportTarget: () => undefined,
          withdraw: () => {
            withdrawn = true;
          }
        };
      },
      acknowledgement: scriptedAcknowledgement().port,
      openWholeDocument:
        script.wholeDocument === false
          ? null
          : (): void => {
              wholeDocument += 1;
            },
      close: (): void => {
        closes += 1;
      }
    }
  });
  await settle();
  return {
    target,
    reads,
    saves,
    closed: () => closes,
    wholeDocumentAsked: () => wholeDocument,
    adoptions,
    deliver: (delivery) => {
      receiver?.(delivery);
      flushSync();
    },
    withdrawn: () => withdrawn,
    stop: () => {
      void unmount(component);
      target.remove();
    }
  };
} // End of function mountEditor()

/** Waits for the component's asynchronous handlers, by a macrotask. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
} // End of function settle()

/**
 * The button labelled with one key in the current language, or `null`.
 *
 * @param target - Where the editor was mounted.
 * @param key - The key holding the label.
 * @param lang - The language the editor draws in.
 * @returns The button, or `null`.
 */
function button(target: HTMLElement, key: TranslationKey, lang: Locale = 'en'): HTMLButtonElement | null {
  const label = DICTIONARIES[lang][key];
  return [...target.querySelectorAll('button')].find((one) => one.textContent?.trim() === label) ?? null;
} // End of function button()

/**
 * The same button, insisted upon.
 *
 * @param target - Where the editor was mounted.
 * @param key - The key holding the label.
 * @param lang - The language the editor draws in.
 * @returns The button.
 */
function control(target: HTMLElement, key: TranslationKey, lang: Locale = 'en'): HTMLButtonElement {
  const found = button(target, key, lang);
  if (found === null) {
    throw new Error(`this case needs the control labelled ${DICTIONARIES[lang][key]}`);
  }
  return found;
} // End of function control()

/**
 * The editor's text area, or `null` when none is drawn.
 *
 * @param target - Where the editor was mounted.
 * @returns The text area, or `null`.
 */
function box(target: HTMLElement): HTMLTextAreaElement | null {
  return target.querySelector('textarea');
} // End of function box()

/**
 * Types into the text area the way a keystroke does.
 *
 * @param target - Where the editor was mounted.
 * @param text - The box's whole new value.
 */
function type(target: HTMLElement, text: string): void {
  const found = box(target);
  if (found === null) {
    throw new Error('this case needs an open editor');
  }
  found.value = text;
  found.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
} // End of function type()

/**
 * Whether the editor shows one sentence.
 *
 * @param target - Where the editor was mounted.
 * @param key - The key holding the sentence.
 * @param lang - The language the editor draws in.
 * @returns `true` when the rendered text contains it.
 */
function says(target: HTMLElement, key: TranslationKey, lang: Locale = 'en'): boolean {
  return (target.textContent ?? '').includes(DICTIONARIES[lang][key]);
} // End of function says()

/**
 * Saves the draft through the save control and waits for the answer.
 *
 * @param target - Where the editor was mounted.
 */
async function pressSave(target: HTMLElement): Promise<void> {
  control(target, 'browser.rawSnippet.save').click();
  await settle();
} // End of function pressSave()

beforeEach(() => {
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
});

describe('the mounted snippet text editor: load, draft and save', () => {
  it('reads the text by the captured identity and draws it whole, with the file and the line', async () => {
    const editor = await mountEditor();
    expect(editor.reads).toEqual([MATCH]);
    expect(box(editor.target)?.value).toBe(OWNED);
    expect(editor.target.textContent).toContain(FILE.relative_path);
    expect(editor.target.textContent).toContain(translate('en', 'browser.rawSnippet.startsAt', { line: 7 }));
    expect(says(editor.target, 'browser.rawSnippet.scope')).toBe(true);
    editor.stop();
    expect(editor.withdrawn()).toBe(true);
  }); // End of the "reads and draws" case

  it('says it is reading until the read answers', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const component = mount(RawSnippetEditor, {
      target,
      props: {
        match: MATCH,
        file: FILE,
        read: () => new Promise<CommandResult<OwnedItemText>>(() => undefined),
        save: () => Promise.resolve<MatchSaveAnswer>({ kind: 'notAttempted' }),
        identityInWindow: () => null,
        adoptDiskVersion: (): DiskAdoptionOutcome => 'refused',
        reportReceiver: (): SurfaceBinding => ({ reportTarget: () => undefined, withdraw: () => undefined }),
        acknowledgement: scriptedAcknowledgement().port,
        openWholeDocument: null,
        close: () => undefined
      }
    });
    flushSync();
    expect(says(target, 'browser.rawSnippet.loading')).toBe(true);
    expect(box(target)).toBeNull();
    void unmount(component);
    target.remove();
  }); // End of the "reading" case

  it('gates the save on a dirty draft, sends the identity, base, exact text and consent, and adopts the new identity', async () => {
    const editor = await mountEditor({ saves: [saved(), saved()] });
    expect(control(editor.target, 'browser.rawSnippet.save').disabled).toBe(true);
    type(editor.target, EDITED);
    expect(control(editor.target, 'browser.rawSnippet.save').disabled).toBe(false);
    expect(says(editor.target, 'browser.rawSnippet.unsaved')).toBe(true);
    await pressSave(editor.target);
    expect(editor.saves).toEqual([
      { id: MATCH, baseRevision: BASE, text: EDITED, acknowledgement: { accepted: [] } }
    ]);
    expect(says(editor.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(control(editor.target, 'browser.rawSnippet.save').disabled).toBe(true);
    // The old identity is retired: the next save sends the one the commit answered.
    type(editor.target, THIRD);
    await pressSave(editor.target);
    expect(editor.saves[1]?.id).toBe(MOVED);
    expect(editor.saves[1]?.baseRevision).toBe(AFTER);
    editor.stop();
  }); // End of the "save" case

  it('keeps the draft on a refusal for findings, and sends consent bound to it', async () => {
    const editor = await mountEditor({ saves: [REFUSED, saved()] });
    type(editor.target, EDITED);
    await pressSave(editor.target);
    expect(box(editor.target)?.value).toBe(EDITED);
    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    control(editor.target, rawSaveChoiceKey('saveAnyway', 'authoredText')).click();
    await settle();
    expect(editor.saves[1]?.text).toBe(EDITED);
    expect(editor.saves[1]?.acknowledgement.accepted).toHaveLength(1);
    editor.stop();
  }); // End of the "refusal for findings" case

  it('freezes the box over the draft on a save conflict and closes only after a confirmed reload', async () => {
    const editor = await mountEditor({ saves: [CONFLICTED] });
    type(editor.target, EDITED);
    await pressSave(editor.target);
    expect(box(editor.target)?.value).toBe(EDITED);
    expect(box(editor.target)?.readOnly).toBe(true);
    expect(button(editor.target, conflictChoiceKey('copyDraft', 'authoredText'))).not.toBeNull();
    expect(button(editor.target, conflictChoiceKey('keepMyDraft', 'authoredText'))).toBeNull();
    control(editor.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
    flushSync();
    expect(editor.closed()).toBe(0);
    control(editor.target, conflictChoiceKey('confirmReload', 'authoredText')).click();
    flushSync();
    expect(editor.adoptions).toHaveLength(1);
    expect(editor.closed()).toBe(1);
    editor.stop();
  }); // End of the "save conflict" case

  it('freezes the box under an external conflict the window raised', async () => {
    const editor = await mountEditor();
    type(editor.target, EDITED);
    const seen: ExternalConflictObservation = {
      sequence: 5,
      document: FILE.id,
      previousRevision: BASE,
      diskRevision: AFTER,
      diskText: DISK,
      disk: makeDocument({ id: FILE.id, relativePath: FILE.relative_path, revision: AFTER }),
      findings: [],
      correspondences: null
    };
    editor.deliver(arbitratedDelivery(null, seen, false));
    expect(box(editor.target)?.readOnly).toBe(true);
    expect(box(editor.target)?.value).toBe(EDITED);
    expect(control(editor.target, 'browser.rawSnippet.save').disabled).toBe(true);
    expect(says(editor.target, 'browser.rawSnippet.diskVersion')).toBe(true);
    editor.stop();
  }); // End of the "external conflict" case

  it('asks before leaving with unsaved text, and leaves at once without any', async () => {
    const editor = await mountEditor();
    control(editor.target, 'browser.rawSnippet.close').click();
    flushSync();
    expect(editor.closed()).toBe(1);
    type(editor.target, EDITED);
    control(editor.target, 'browser.rawSnippet.close').click();
    flushSync();
    expect(editor.closed()).toBe(1);
    expect(says(editor.target, 'browser.rawSnippet.discardWarning')).toBe(true);
    control(editor.target, 'browser.rawSnippet.discard').click();
    flushSync();
    expect(editor.closed()).toBe(2);
    editor.stop();
  }); // End of the "leaving" case
}); // End of the "load, draft and save" suite

describe('CF-55 on the snippet text editor: Undo and Redo under one held save (ruling 13)', () => {
  it('draws both disabled while the save is held, and a click on either changes nothing', async () => {
    const editor = await mountEditor({ saves: ['pending'] });
    type(editor.target, EDITED);
    type(editor.target, THIRD);
    control(editor.target, 'browser.rawSnippet.undo').click();
    flushSync();
    // The history holds an undo step and a redo step before the save starts.
    expect(box(editor.target)?.value).toBe(EDITED);
    expect(control(editor.target, 'browser.rawSnippet.undo').disabled).toBe(false);
    expect(control(editor.target, 'browser.rawSnippet.redo').disabled).toBe(false);

    await pressSave(editor.target);
    expect(says(editor.target, 'browser.rawSnippet.saving')).toBe(true);
    const undo = control(editor.target, 'browser.rawSnippet.undo');
    const redo = control(editor.target, 'browser.rawSnippet.redo');
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);
    // A synthetic click on each changes nothing. Whether jsdom delivers a click to
    // a disabled button is not what this shows; that the handlers' transitions
    // refuse under a held save (`undoEdit(held) === held`) is the model suite's.
    undo.dispatchEvent(new MouseEvent('click'));
    redo.dispatchEvent(new MouseEvent('click'));
    flushSync();
    expect(box(editor.target)?.value).toBe(EDITED);
    expect(box(editor.target)?.readOnly).toBe(true);
    // *Stop editing* is disabled for the same held save.
    expect(control(editor.target, 'browser.rawSnippet.close').disabled).toBe(true);
    expect(editor.saves).toHaveLength(1);
    editor.stop();
  }); // End of the "CF-55" case
}); // End of the "CF-55 on the snippet text editor" suite

describe('the snippet text editor’s refusals and the whole-document fallback', () => {
  it('opens no box for a range with holes, and offers the whole-document editor', async () => {
    const editor = await mountEditor({
      reads: [readRefused({ ItemRangeNotContiguous: { edit: 0, hole: { start: 3, end: 9 } } })]
    });
    expect(box(editor.target)).toBeNull();
    expect(says(editor.target, 'browser.rawSnippet.refused.rangeNotContiguous')).toBe(true);
    control(editor.target, 'browser.rawSnippet.openWholeDocument').click();
    flushSync();
    expect(editor.wholeDocumentAsked()).toBe(1);
    expect(editor.closed()).toBe(0);
    editor.stop();
  }); // End of the "range with holes" case

  it('says why the offer is missing when the pane cannot show this file', async () => {
    const editor = await mountEditor({
      reads: [readRefused({ ItemRangeNotContiguous: { edit: 0, hole: { start: 3, end: 9 } } })],
      wholeDocument: false
    });
    expect(button(editor.target, 'browser.rawSnippet.openWholeDocument')).toBeNull();
    expect(says(editor.target, 'browser.rawSnippet.wholeDocumentElsewhere')).toBe(true);
    editor.stop();
  }); // End of the "offer missing" case

  it('opens no box for a carriage return, whether Rust refused it or the text holds one, and offers no fallback', async () => {
    for (const read of [readRefused({ ItemTextHoldsCarriageReturn: { edit: 0 } }), owned('a: b\r\n')]) {
      const editor = await mountEditor({ reads: [read] });
      expect(box(editor.target)).toBeNull();
      expect(says(editor.target, 'browser.rawSnippet.refused.lineEndingsNotPreserved')).toBe(true);
      expect(button(editor.target, 'browser.rawSnippet.openWholeDocument')).toBeNull();
      editor.stop();
    } // End of the loop over the two carriage-return reads
  }); // End of the "carriage return at load" case

  it('offers the whole-document editor beside a save the engine refused as a range with holes, asking first', async () => {
    const editor = await mountEditor({
      saves: [engineRefused({ ItemRangeNotContiguous: { edit: 0, hole: { start: 3, end: 9 } } })]
    });
    type(editor.target, EDITED);
    await pressSave(editor.target);
    expect(says(editor.target, 'browser.rawSnippet.sendFailed')).toBe(true);
    expect(box(editor.target)?.value).toBe(EDITED);
    control(editor.target, 'browser.rawSnippet.openWholeDocument').click();
    flushSync();
    // The draft is unsaved, so leaving asks first.
    expect(editor.wholeDocumentAsked()).toBe(0);
    expect(says(editor.target, 'browser.rawSnippet.discardWarning')).toBe(true);
    control(editor.target, 'browser.rawSnippet.discard').click();
    flushSync();
    expect(editor.wholeDocumentAsked()).toBe(1);
    editor.stop();
  }); // End of the "engine refused the range" case

  it('explains a trailing blank line only when the refused text ends with one', async () => {
    const escapes: EditError = {
      Verification: { ItemTextEscapesTheItem: { edit: 0, at: { start: 30, end: 31 } } }
    };
    const blank = await mountEditor({ saves: [engineRefused(escapes)] });
    type(blank.target, TRAILING_BLANK);
    await pressSave(blank.target);
    expect(says(blank.target, 'browser.rawSnippet.trailingBlankLine')).toBe(true);
    // The draft is kept exactly: nothing trimmed the blank line.
    expect(box(blank.target)?.value).toBe(TRAILING_BLANK);
    // Editing retires the explanation with the failure it explained.
    type(blank.target, EDITED);
    expect(says(blank.target, 'browser.rawSnippet.trailingBlankLine')).toBe(false);
    blank.stop();

    const other = await mountEditor({ saves: [engineRefused(escapes)] });
    type(other.target, EDITED);
    await pressSave(other.target);
    expect(says(other.target, 'browser.rawSnippet.sendFailed')).toBe(true);
    expect(says(other.target, 'browser.rawSnippet.trailingBlankLine')).toBe(false);
    other.stop();
  }); // End of the "trailing blank line" case

  it('stops offering to save after a refusal for a stale identity, keeping the text', async () => {
    const stale: MatchSaveAnswer = {
      kind: 'failed',
      mayHaveWritten: false,
      failure: { kind: 'command', error: { code: 'identityStaleRevision', expected: BASE, found: AFTER } }
    };
    const editor = await mountEditor({ saves: [stale] });
    type(editor.target, EDITED);
    await pressSave(editor.target);
    expect(says(editor.target, 'browser.rawSnippet.identityStale')).toBe(true);
    expect(control(editor.target, 'browser.rawSnippet.save').disabled).toBe(true);
    expect(box(editor.target)?.value).toBe(EDITED);
    expect(box(editor.target)?.readOnly).toBe(true);
    editor.stop();
  }); // End of the "stale identity" case
}); // End of the "refusals and fallback" suite

describe('the snippet text editor after a save that may have written', () => {
  it('never says nothing was written, refuses every save, and reconciles against a fresh read', async () => {
    const editor = await mountEditor({ saves: [MAY_HAVE_WRITTEN], reads: [owned(), owned(EDITED)] });
    type(editor.target, EDITED);
    await pressSave(editor.target);
    expect(says(editor.target, 'browser.rawSnippet.mayHaveWritten')).toBe(true);
    expect(says(editor.target, 'browser.rawSnippet.sendFailed')).toBe(false);
    expect(says(editor.target, 'browser.rawSnippet.needsReconciliation')).toBe(true);
    expect(control(editor.target, 'browser.rawSnippet.save').disabled).toBe(true);
    // The box stays editable, and an edit still cannot be saved.
    type(editor.target, THIRD);
    expect(control(editor.target, 'browser.rawSnippet.save').disabled).toBe(true);
    type(editor.target, EDITED);

    control(editor.target, 'browser.rawSnippet.readAgain').click();
    await settle();
    // Read again by the identity the window holds now, which found the sent text.
    expect(editor.reads).toEqual([MATCH, MOVED]);
    expect(says(editor.target, 'browser.rawSnippet.reconciled.written')).toBe(true);
    expect(says(editor.target, 'browser.rawSnippet.needsReconciliation')).toBe(false);
    expect(says(editor.target, 'browser.rawSnippet.mayHaveWritten')).toBe(false);
    expect(control(editor.target, 'browser.rawSnippet.save').disabled).toBe(true);
    editor.stop();
  }); // End of the "reconciled, written" case

  it('keeps the draft saveable when the fresh read holds the text the editor opened with', async () => {
    const editor = await mountEditor({ saves: [MAY_HAVE_WRITTEN, saved()], reads: [owned(), owned(OWNED)] });
    type(editor.target, EDITED);
    await pressSave(editor.target);
    control(editor.target, 'browser.rawSnippet.readAgain').click();
    await settle();
    expect(says(editor.target, 'browser.rawSnippet.reconciled.notWritten')).toBe(true);
    expect(box(editor.target)?.value).toBe(EDITED);
    await pressSave(editor.target);
    expect(editor.saves[1]?.id).toBe(MOVED);
    editor.stop();
  }); // End of the "reconciled, not written" case

  it('says it cannot place a fresh read of another text, or of a range on another line, and keeps saving off', async () => {
    for (const fresh of [owned(THIRD), owned(EDITED, 8)]) {
      const editor = await mountEditor({ saves: [MAY_HAVE_WRITTEN], reads: [owned(), fresh] });
      type(editor.target, EDITED);
      await pressSave(editor.target);
      control(editor.target, 'browser.rawSnippet.readAgain').click();
      await settle();
      expect(says(editor.target, 'browser.rawSnippet.reconciled.diverged')).toBe(true);
      expect(says(editor.target, 'browser.rawSnippet.needsReconciliation')).toBe(true);
      expect(control(editor.target, 'browser.rawSnippet.save').disabled).toBe(true);
      expect(box(editor.target)?.value).toBe(EDITED);
      editor.stop();
    } // End of the loop over the two readings it cannot place
  }); // End of the "diverged" case

  it('says so when the window points at no snippet of this file, and reads nothing', async () => {
    const editor = await mountEditor({ saves: [MAY_HAVE_WRITTEN], inWindow: null });
    type(editor.target, EDITED);
    await pressSave(editor.target);
    control(editor.target, 'browser.rawSnippet.readAgain').click();
    await settle();
    expect(says(editor.target, 'browser.rawSnippet.reconciled.noIdentity')).toBe(true);
    expect(editor.reads).toEqual([MATCH]);
    editor.stop();
  }); // End of the "no identity" case
}); // End of the "may have written" suite

describe('the snippet text editor’s wording in both languages', () => {
  it.each(LOCALES)('draws the range refusal, the trailing-blank-line explanation and diverged in %s', async (lang) => {
    locale.setOverride(lang);
    const range = await mountEditor({
      reads: [readRefused({ ItemRangeNotContiguous: { edit: 0, hole: { start: 3, end: 9 } } })]
    });
    expect(says(range.target, 'browser.rawSnippet.refused.rangeNotContiguous', lang)).toBe(true);
    expect(button(range.target, 'browser.rawSnippet.openWholeDocument', lang)).not.toBeNull();
    range.stop();

    const blank = await mountEditor({
      saves: [
        engineRefused({ Verification: { ItemTextEscapesTheItem: { edit: 0, at: { start: 30, end: 31 } } } })
      ]
    });
    type(blank.target, TRAILING_BLANK);
    control(blank.target, 'browser.rawSnippet.save', lang).click();
    await settle();
    expect(says(blank.target, 'browser.rawSnippet.trailingBlankLine', lang)).toBe(true);
    blank.stop();

    const diverged = await mountEditor({ saves: [MAY_HAVE_WRITTEN], reads: [owned(), owned(THIRD)] });
    type(diverged.target, EDITED);
    control(diverged.target, 'browser.rawSnippet.save', lang).click();
    await settle();
    control(diverged.target, 'browser.rawSnippet.readAgain', lang).click();
    await settle();
    expect(says(diverged.target, 'browser.rawSnippet.reconciled.diverged', lang)).toBe(true);
    diverged.stop();
  }); // End of the "both languages" case
}); // End of the "wording in both languages" suite

/**
 * Mounts the editor with a start-up read the case answers by hand, so a delivery
 * can arrive while the read is in flight.
 *
 * @returns The target, the reported receiver, the read's resolver and a teardown.
 */
function mountReading(): {
  readonly target: HTMLElement;
  readonly deliver: (delivery: ObservationDelivery) => void;
  readonly answer: (result: CommandResult<OwnedItemText>) => Promise<void>;
  readonly stop: () => void;
} {
  let receiver: ObservationReceiver | null = null;
  let resolve: (result: CommandResult<OwnedItemText>) => void = () => undefined;
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(RawSnippetEditor, {
    target,
    props: {
      match: MATCH,
      file: FILE,
      read: () =>
        new Promise<CommandResult<OwnedItemText>>((settle_) => {
          resolve = settle_;
        }),
      save: () => Promise.resolve<MatchSaveAnswer>({ kind: 'notAttempted' }),
      identityInWindow: () => null,
      adoptDiskVersion: (): DiskAdoptionOutcome => 'refused',
      reportReceiver: (reported: ObservationReceiver): SurfaceBinding => {
        receiver = reported;
        return { reportTarget: () => undefined, withdraw: () => undefined };
      },
      acknowledgement: scriptedAcknowledgement().port,
      openWholeDocument: null,
      close: () => undefined
    }
  });
  flushSync();
  return {
    target,
    deliver: (delivery) => {
      receiver?.(delivery);
      flushSync();
    },
    answer: async (result) => {
      resolve(result);
      await settle();
    },
    stop: () => {
      void unmount(component);
      target.remove();
    }
  };
} // End of function mountReading()

/** An observation of the snippet's file by the watcher. */
const OBSERVED: ExternalConflictObservation = {
  sequence: 5,
  document: FILE.id,
  previousRevision: BASE,
  diskRevision: AFTER,
  diskText: DISK,
  disk: makeDocument({ id: FILE.id, relativePath: FILE.relative_path, revision: AFTER }),
  findings: [],
  correspondences: null
};

/**
 * Phrases that would tell a person the file was not written — the claim the
 * 3-8-2 review's second finding found false after an uncertain write.
 */
const UNWRITTEN_CLAIMS: Readonly<Record<Locale, readonly string[]>> = {
  en: ['not been written', 'not written', 'nothing was written'],
  es: ['no se han escrito', 'no se escribi', 'no se ha escrito']
};

describe('review fixes (3-8-2 review)', () => {
  it('replays a conflict raised during the start-up read over the opened session (finding 1)', async () => {
    const editor = mountReading();
    expect(says(editor.target, 'browser.rawSnippet.loading')).toBe(true);
    editor.deliver(arbitratedDelivery(null, OBSERVED, false));
    await editor.answer(owned());
    // The session opens already showing the conflict: the box is frozen, nothing
    // can be saved, and the disk side is on screen.
    expect(box(editor.target)?.value).toBe(OWNED);
    expect(box(editor.target)?.readOnly).toBe(true);
    expect(control(editor.target, 'browser.rawSnippet.save').disabled).toBe(true);
    expect(says(editor.target, 'browser.rawSnippet.diskVersion')).toBe(true);
    editor.stop();
  }); // End of the "conflict during the read" case

  it('replays a held observation from the start-up read as a restriction on saving (finding 1)', async () => {
    const editor = mountReading();
    editor.deliver(retainedDelivery(OBSERVED));
    await editor.answer(owned());
    type(editor.target, EDITED);
    expect(box(editor.target)?.readOnly).toBe(false);
    expect(control(editor.target, 'browser.rawSnippet.save').disabled).toBe(true);
    editor.stop();
  }); // End of the "held observation during the read" case

  it.each(LOCALES)('asks before leaving after a send that may have written, claiming nothing about the file (finding 2, %s)', async (lang) => {
    locale.setOverride(lang);
    const editor = await mountEditor({ saves: [MAY_HAVE_WRITTEN] });
    type(editor.target, EDITED);
    control(editor.target, 'browser.rawSnippet.save', lang).click();
    await settle();
    expect(says(editor.target, 'browser.rawSnippet.mayHaveWritten', lang)).toBe(true);
    control(editor.target, 'browser.rawSnippet.close', lang).click();
    flushSync();
    expect(says(editor.target, 'browser.rawSnippet.discardWarning', lang)).toBe(true);
    // The confirmation claims nothing about the file: it never says the changes
    // were not written, which the `mayHaveWritten` sentence above contradicts.
    const confirmation = DICTIONARIES[lang]['browser.rawSnippet.discardWarning'];
    for (const claim of UNWRITTEN_CLAIMS[lang]) {
      expect(confirmation.toLowerCase()).not.toContain(claim);
    } // End of the loop over the claims of an unwritten file
    expect(editor.closed()).toBe(0);
    control(editor.target, 'browser.rawSnippet.discard', lang).click();
    flushSync();
    expect(editor.closed()).toBe(1);
    editor.stop();
  }); // End of the "uncertain write, then leaving" case
}); // End of the "review fixes" suite
