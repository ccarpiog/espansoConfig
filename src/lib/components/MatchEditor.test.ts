/** @vitest-environment jsdom */

/**
 * The small editor, mounted and driven through real DOM events.
 *
 * The second file in this repository to opt into jsdom, and it opts in the same
 * way the first does: by the docblock above and by nothing else. The suite's
 * default environment is still `node`, and the six components that predate
 * `RawEditor.svelte` are deliberately not back-filled
 * (`docs/decisions/2c-split-notes.md` section 7).
 *
 * **What this file is for, given that `matchEditor.test.ts` already exists.**
 * That suite drives the state machine; it cannot see whether a control is drawn,
 * whether a refused field draws a box at all, or what the component hands to the
 * boundary. Three of this sub-phase's claims are only about that:
 *
 * 1. **a field the projection refused draws no editable control**, and the value
 *    it shows goes through `SourceText` — which is the one surface in this
 *    application that *names* a carriage return instead of drawing it as a line
 *    break a text control would have normalised;
 * 2. **an initially absent field left blank sends `'Unchanged'`** — the rule the
 *    whole draft-versus-projection arrangement exists for, and the one a screen
 *    can break by seeding a buffer from something other than the projection;
 * 3. **the acknowledgement round trip** — assembled entirely inside a component,
 *    where a model test cannot reach it.
 *
 * **This does not replace the window reading.** What it proves is that a handler
 * fires and that the right value reaches the boundary. jsdom has no layout, no
 * WebKit, and — the point the consult's Q7 turns on — **not necessarily WebKit's
 * value normalisation**. The escaped carriage return is settled here only as far
 * as *no control is bound to it*; that it stays that way in the shipped webview
 * is a window reading's to establish.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detailFieldKey } from '../browser/detail';
import { makeDocument, makeMatch, makeSummary } from '../browser/fixtures';
import type { InvalidationStatus } from '../browser/invalidation';
import {
  fieldLabelName,
  reprojectionRefusalKey,
  type EditableField,
  type Reprojection
} from '../browser/matchEditor';
import { conflictChoiceKey, type ConflictChoice } from '../browser/saveOutcome';
import { sourceSegments, type InvisibleSegment } from '../browser/sourceText';
import type { MatchSaveAnswer } from '../browser/workspace.svelte';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import { tDraftError, tInvisible, tIpcFailure } from '../i18n';
import { LOCALES } from '../i18n/locale';
import { locale } from '../stores/locale.svelte';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DraftError,
  Finding,
  MatchDraft,
  MatchId,
  MatchView,
  SaveResult
} from '../ipc/types';
import MatchEditor from './MatchEditor.svelte';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after a commit. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The file the snippet lives in. */
const FILE = makeSummary({ id: 1, relativePath: 'match/base.yml' });

/** The identity a committed save answers with. */
const MOVED: MatchId = { document: 1, revision: AFTER, node: 1 };

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/** The adoption a committed save could not perform. */
const NOT_ADOPTED: InvalidationStatus = {
  kind: 'failed',
  failure: { kind: 'command', error: { code: 'unknownDocument', document: 1 } }
};

/** A save that ran to the end and wrote the file. */
const COMMITTED: SaveResult = {
  outcome: 'saved',
  revision: AFTER,
  committed: true,
  notes: [],
  backup_taken: false,
  moved: MOVED
};

/** A suspicion the gate reported about the candidate. */
const SUSPICION: Finding = {
  code: { ReferenceHasNoDeclaration: { name: 'greeting' } },
  span: null,
  node: null,
  path: null
};

/** A refusal a person may accept. */
const REFUSED: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [SUSPICION]
};

/** A save the file had moved on under. */
const CONFLICTED: SaveResult = {
  outcome: 'conflict',
  expected: BASE,
  found: AFTER,
  disk_revision: AFTER,
  disk: makeDocument({ id: FILE.id, relativePath: FILE.relative_path, revision: AFTER })
};

/** Why a draft could not be planned at all: no save was attempted. */
const UNMODELLED: DraftError = {
  FieldHasAnUnmodelledShape: { field: 'label', found: 'Sequence' }
};

/** The rejection that carries it. */
const DRAFT_REFUSED: IpcFailure = {
  kind: 'command',
  error: { code: 'draftRefused', error: UNMODELLED }
};

/** A save that failed at or after its rename, so the file may already hold it. */
const WRITE_MAY_HAVE_HAPPENED: IpcFailure = {
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
};

/**
 * The draft a session that was never edited would send: nothing, twenty-two times.
 *
 * **An exhaustive literal**, so a field added to `MatchDraft` in a later phase
 * fails to compile here rather than dropping out of the comparisons below. Cases
 * that expect one edit spread this and override the field they typed into, which
 * is what makes *and nothing else changed* a checked claim rather than a sampled
 * one.
 */
const UNTOUCHED: MatchDraft = {
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

/** One call the component made to the boundary. */
interface RecordedSave {
  /** Which snippet it aimed at. */
  readonly id: MatchId;
  /** The whole twenty-two-field draft it sent. */
  readonly draft: MatchDraft;
  /**
   * The revision it said the draft was taken from.
   *
   * Recorded since 2c-3a-2, when `BrowserState.saveMatch` stopped substituting
   * its own projection's revision for the caller's: the editor now hands one over
   * and this is what a case can assert it hands over.
   */
  readonly baseRevision: ContentRevision;
  /** The suspicions it said had already been shown to a person. */
  readonly acknowledgement: Acknowledgement;
}

/**
 * One scripted answer to one save.
 *
 * **Which arm of `MatchSaveAnswer` it produces is decided by which field it
 * carries**, and after the 2c-2-2 review's third finding that is a distinction
 * the type enforces rather than a convention this file follows: `result` is
 * `answered`, `failure` is `failed` — a command that ran and rejected, so a
 * reason is required — and neither is `notAttempted`, this window refusing before
 * a command ran, which carries nothing because there is nothing to carry.
 */
interface ScriptedAnswer {
  /** How the save ended, for the `answered` arm. */
  readonly result?: SaveResult;
  /** What became of the adoption; a commit adopts unless a case says otherwise. */
  readonly adoption?: InvalidationStatus;
  /** Whether the file may already hold the draft. Only read beside `failure`. */
  readonly mayHaveWritten?: boolean;
  /** Why the command rejected, for the `failed` arm. */
  readonly failure?: IpcFailure;
  /** Whether to leave the save unanswered, so a case can look at mid-flight. */
  readonly pending?: boolean;
}

/** A mounted editor and everything a case needs to drive it. */
interface Mounted {
  /** The element the component was mounted into. */
  readonly target: HTMLElement;
  /** Every call the component made, in order. */
  readonly calls: RecordedSave[];
  /** How many times the editor asked to be closed. */
  readonly closed: () => number;
  /** Moves the injected clock forward, in milliseconds. */
  readonly advance: (by: number) => void;
  /** Tears the component down. */
  readonly stop: () => void;
}

/**
 * A projection of one snippet with a trigger and a body and nothing else.
 *
 * @param overrides - Whatever the case needs beyond the two.
 * @returns The projection.
 */
function projection(overrides: Parameters<typeof makeMatch>[0] = {}): MatchView {
  return makeMatch({ revision: BASE, trigger: ':a', replace: 'b', ...overrides });
} // End of function projection()

/**
 * Mounts the editor over a scripted boundary.
 *
 * @param answers - What each successive save answers, in order. A save with no
 *   answer left behaves as a command that failed with nothing written.
 * @param match - The snippet to seed from.
 * @param fresh - What `reproject` answers for the session's identity. Defaults to
 *   the refusal a window that has moved elsewhere gives.
 * @returns The mounted editor.
 */
function mountEditor(
  answers: readonly ScriptedAnswer[] = [],
  match: MatchView = projection(),
  fresh: Reprojection = { kind: 'unavailable', reason: 'otherFile' }
): Mounted {
  const remaining = [...answers];
  const calls: RecordedSave[] = [];
  let closes = 0;
  let now = 0;
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(MatchEditor, {
    target,
    props: {
      match,
      file: FILE,
      clock: (): number => now,
      save: (
        id: MatchId,
        draft: MatchDraft,
        baseRevision: ContentRevision,
        acknowledgement: Acknowledgement
      ): Promise<MatchSaveAnswer> => {
        calls.push({ id, draft, baseRevision, acknowledgement });
        const next = remaining.shift();
        if (next?.pending === true) {
          // Never resolves: the case is about what the screen does while a save
          // is in flight, which is a state no resolved promise can be observed in.
          return new Promise<MatchSaveAnswer>(() => undefined);
        }
        if (next?.failure !== undefined) {
          return Promise.resolve({
            kind: 'failed',
            mayHaveWritten: next.mayHaveWritten ?? false,
            failure: next.failure
          });
        }
        if (next === undefined || next.result === undefined) {
          return Promise.resolve({ kind: 'notAttempted' });
        }
        return Promise.resolve({
          kind: 'answered',
          result: next.result,
          adoption:
            next.adoption ??
            (next.result.outcome === 'saved' && next.result.committed ? ADOPTED : NOT_OWED)
        });
      },
      reproject: (): Reprojection => fresh,
      close: (): void => {
        closes += 1;
      }
    }
  });
  return {
    target,
    calls,
    closed: () => closes,
    advance: (by: number) => {
      now += by;
    },
    stop: () => {
      void unmount(component);
      target.remove();
    }
  };
} // End of function mountEditor()

/**
 * The block of markup one field owns.
 *
 * **Every per-field query below is scoped through this**, and the reason is a
 * defect this file caught in its own first draft: the editor draws a *Take this
 * key out* control for every key the file has, so a document-wide search for that
 * label finds the trigger's and silently drives the wrong field.
 *
 * @param target - Where the component was mounted.
 * @param field - Which field.
 * @returns That field's block.
 */
function blockOf(target: HTMLElement, field: EditableField): HTMLElement {
  const label = DICTIONARIES.en[detailFieldKey(fieldLabelName(field))];
  for (const element of target.querySelectorAll('.field')) {
    if (
      element instanceof HTMLElement &&
      element.querySelector('.name')?.textContent?.trim() === label
    ) {
      return element;
    }
  } // End of the loop over the editor's field blocks
  throw new Error(`this editor draws no block for ${field}`);
} // End of function blockOf()

/**
 * The control one field is edited through, or `null` when it draws none.
 *
 * **A refused field draws none**, which is what several cases below check: the
 * distinction between an empty box and no box is the whole of the consult's Q5,
 * and only one of the two can be typed into.
 *
 * @param target - Where the component was mounted.
 * @param field - Which field.
 * @returns The control, or `null`.
 */
function boxFor(
  target: HTMLElement,
  field: EditableField
): HTMLInputElement | HTMLTextAreaElement | null {
  const box = blockOf(target, field).querySelector('input, textarea');
  return box instanceof HTMLInputElement || box instanceof HTMLTextAreaElement ? box : null;
} // End of function boxFor()

/**
 * The same control, insisted upon.
 *
 * @param target - Where the component was mounted.
 * @param field - Which field.
 * @returns The control.
 */
function box(target: HTMLElement, field: EditableField): HTMLInputElement | HTMLTextAreaElement {
  const found = boxFor(target, field);
  if (found === null) {
    throw new Error(`this case is about a field that is drawn as a control: ${field}`);
  }
  return found;
} // End of function box()

/**
 * Types into one field the way a person does.
 *
 * The controls are controlled rather than bound, so the value is set and a real
 * `input` event is dispatched — which is the path a keystroke takes.
 *
 * @param target - Where the component was mounted.
 * @param field - Which field.
 * @param text - The whole new value of the control.
 */
function type(target: HTMLElement, field: EditableField, text: string): void {
  const control = box(target, field);
  control.value = text;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
} // End of function type()

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

beforeEach(() => {
  // The dictionary this file matches against is the English one, so the interface
  // is pinned to it rather than left to whatever `navigator.languages` says.
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
});

describe('the mounted small editor', () => {
  it('draws the six fields it edits, the file they are in, and no checkbox anywhere', () => {
    const editor = mountEditor();
    expect(box(editor.target, 'trigger').value).toBe(':a');
    expect(box(editor.target, 'replace').value).toBe('b');
    expect(box(editor.target, 'label').value).toBe('');
    // **D2u on a screen.** The three word-boundary keys are three independent
    // pieces of source text, and a checkbox over one of them would have to decide
    // that `on`, `yes` and `true` are the same value.
    for (const field of ['word', 'left_word', 'right_word'] as const) {
      expect(box(editor.target, field)).toBeInstanceOf(HTMLInputElement);
    } // End of the loop over the three word-boundary fields
    expect(editor.target.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(editor.target.textContent).toContain(FILE.relative_path);
    editor.stop();
  }); // End of the "draws the fields" case

  it('gates the save control on the draft being dirty', () => {
    const editor = mountEditor([{ result: COMMITTED }]);
    expect(control(editor.target, 'browser.matchEditor.save').disabled).toBe(true);
    expect(says(editor.target, 'browser.matchEditor.unsaved')).toBe(false);

    type(editor.target, 'replace', 'c');

    expect(control(editor.target, 'browser.matchEditor.save').disabled).toBe(false);
    expect(says(editor.target, 'browser.matchEditor.unsaved')).toBe(true);

    // And typing the projection's own value back is clean again, because dirty is
    // derived from the base rather than from a flag a handler sets.
    type(editor.target, 'replace', 'b');
    expect(control(editor.target, 'browser.matchEditor.save').disabled).toBe(true);
    editor.stop();
  }); // End of the "gated on dirty" case

  it('sends what was typed and says nothing at all about the other twenty-one fields', async () => {
    const editor = mountEditor([{ result: COMMITTED }]);
    type(editor.target, 'replace', 'c');

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(editor.calls).toHaveLength(1);
    const sent = editor.calls[0]!;
    expect(sent.id).toEqual({ document: 1, revision: BASE, node: 1 });
    expect(sent.acknowledgement).toEqual({ accepted: [] });
    // **The whole draft, not a sample of it**, which is the 2c-2-2 review's fourth
    // finding: five spot checks left `label`, the three word-boundary keys and
    // twelve others free to carry an edit nobody asked for while this case went on
    // claiming complete preservation. `UNTOUCHED` is an exhaustive literal, so a
    // twenty-third field is a compile error here rather than a silent omission.
    expect(sent.draft).toEqual({ ...UNTOUCHED, replace: { Set: 'c' } });
    editor.stop();
  }); // End of the "sends what was typed" case

  it('leaves an initially absent field alone when it is left blank, and sets it when it is not', async () => {
    // **The rule the whole draft-versus-projection arrangement exists for.** The
    // buffer of an absent field and of a present field cleared to empty are the
    // same empty string; only the baseline tells them apart, and getting it wrong
    // writes `label: ''` into a file that never had a label.
    // Two editors rather than two saves in one, because a committed save now owes
    // a re-projection and stops accepting changes until it has one.
    const blank = mountEditor([{ result: COMMITTED }]);
    expect(says(blank.target, 'browser.matchEditor.fieldAbsent')).toBe(true);

    // Focused, blurred, and left exactly as it was found.
    box(blank.target, 'label').focus();
    box(blank.target, 'label').blur();
    flushSync();
    type(blank.target, 'replace', 'c');
    control(blank.target, 'browser.matchEditor.save').click();
    await settle();

    expect(blank.calls[0]?.draft).toEqual({ ...UNTOUCHED, replace: { Set: 'c' } });
    blank.stop();

    // And the same box, typed into, is an insertion.
    const typed = mountEditor([{ result: COMMITTED }]);
    type(typed.target, 'label', 'renamed');
    control(typed.target, 'browser.matchEditor.save').click();
    await settle();

    expect(typed.calls[0]?.draft).toEqual({ ...UNTOUCHED, label: { Set: 'renamed' } });
    typed.stop();
  }); // End of the "absent and blank" case

  it('shows a field the projection refused rather than a box, and names its carriage return', async () => {
    // **The consult's Q2 and Q5 on one screen.** A value holding a real carriage
    // return is read-only, and it is drawn through `SourceText` rather than into a
    // disabled control: a text control's API value normalises every carriage
    // return to a line feed, so the box would misdraw the file even while refusing
    // to write to it.
    const editor = mountEditor([{ result: COMMITTED }], projection({ replace: 'a\rb' }));

    expect(boxFor(editor.target, 'replace')).toBeNull();
    expect(says(editor.target, 'browser.matchEditor.readOnly.carriageReturn')).toBe(true);
    const invisible = sourceSegments('a\rb', false).filter(
      (segment): segment is InvisibleSegment => segment.kind === 'invisible'
    );
    expect(invisible).toHaveLength(1);
    expect(editor.target.textContent).toContain(tInvisible(invisible[0]!));
    // The value is still on screen, which is what "read-only, not hidden" means.
    expect(editor.target.textContent).toContain('a');
    editor.stop();
  }); // End of the "refused field" case

  it('still saves the fields it can when another one holds a carriage return', async () => {
    const editor = mountEditor([{ result: COMMITTED }], projection({ replace: 'a\rb' }));
    type(editor.target, 'label', 'renamed');

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    // The refused field's intent is `'Unchanged'`, so nothing of it is written and
    // the save is not refused because of it.
    expect(editor.calls[0]?.draft).toEqual({ ...UNTOUCHED, label: { Set: 'renamed' } });
    editor.stop();
  }); // End of the "carriage return elsewhere" case

  it('refuses the trigger of a snippet that does not fire from one literal trigger', () => {
    const editor = mountEditor([], projection({ triggerKind: 'Regex', regex: 'a.*b' }));
    expect(boxFor(editor.target, 'trigger')).toBeNull();
    expect(says(editor.target, 'browser.matchEditor.readOnly.triggerNotSingle')).toBe(true);
    // Read-only is not blank: the pattern it does fire from is on screen.
    expect(blockOf(editor.target, 'trigger').textContent).toContain('a.*b');
    // And nothing else on the snippet is refused because of it.
    expect(boxFor(editor.target, 'replace')).not.toBeNull();
    editor.stop();
  }); // End of the "trigger refused" case

  it('draws every trigger of a `triggers:` list, not the one scalar it does not have', () => {
    // **The 2c-2-2 window reading's one finding** (§5.1, measured as `open
    // triggersOnScreen: no`). A `triggers:` list has no scalar behind `trigger:`,
    // so the field drew its name and its reason with nothing between them — and
    // this editor replaces the whole detail pane, so the triggers were visible
    // nowhere in the window at all.
    const editor = mountEditor(
      [],
      projection({ trigger: null, triggers: [':r1', ':r2'], triggerKind: 'Multiple' })
    );
    const block = blockOf(editor.target, 'trigger');

    expect(boxFor(editor.target, 'trigger')).toBeNull();
    expect(says(editor.target, 'browser.matchEditor.readOnly.triggerNotSingle')).toBe(true);
    // **All of them, in the order the list carries them.** Drawing only the first
    // would be the same defect one level down. This is a claim about items within
    // one `triggers:` list, which the wire delivers in source order; the ordering
    // of the three *forms* against each other is `shownValuesOf`'s and is pinned
    // in the model suite.
    expect(block.textContent).toContain(':r1');
    expect(block.textContent).toContain(':r2');
    expect(block.textContent?.indexOf(':r1')).toBeLessThan(block.textContent?.indexOf(':r2') ?? -1);
    // Through `SourceText`, so the values are drawn rather than typed into.
    expect(block.querySelectorAll('.sourceText')).toHaveLength(2);
    expect(block.querySelectorAll('input, textarea')).toHaveLength(0);
    // And the marker that says these bytes are the file's own is drawn once.
    expect(says(editor.target, 'browser.detail.valueAsWritten')).toBe(true);
    editor.stop();
  }); // End of the "triggers list" case

  it('captions a shape name as a shape name, never as the file’s own bytes', () => {
    // **The confirmation pass's first finding.** One `valueAsWritten` caption sat
    // above the whole list, so a `triggers:` item this projection cannot draw as
    // text — presented as the localized words "a list" — was captioned *shown here
    // as the file writes it*, which the file does not contain.
    const match = projection({ trigger: null, triggers: [':r1'], triggerKind: 'Multiple' });
    const withCollection: MatchView = {
      ...match,
      trigger: { ...match.trigger, triggers: [...match.trigger.triggers, { Sequence: [] }] }
    };
    const editor = mountEditor([], withCollection);
    const boxes = [...blockOf(editor.target, 'trigger').querySelectorAll('.shownValue')];

    expect(boxes).toHaveLength(2);
    // The scalar keeps the bytes caption; the shape gets the caption that is true
    // of it, and never the other way round.
    expect(boxes[0]?.textContent).toContain(DICTIONARIES.en['browser.detail.valueAsWritten']);
    expect(boxes[0]?.textContent).not.toContain(DICTIONARIES.en['browser.matchEditor.shapeOnly']);
    expect(boxes[1]?.textContent).toContain(DICTIONARIES.en['browser.matchEditor.shapeOnly']);
    expect(boxes[1]?.textContent).not.toContain(
      DICTIONARIES.en['browser.detail.valueAsWritten']
    );
    editor.stop();
  }); // End of the "shape caption" case

  it('says why it cannot re-read a snippet, and does not blame the wrong thing', async () => {
    // **The confirmation pass's third finding.** One sentence named one cause —
    // the window has moved to another file — and the same disabled control is
    // reached by selecting another snippet *in that file*, and by a commit whose
    // adoption dropped the projection.
    for (const reason of ['notProjected', 'otherFile', 'otherSnippet'] as const) {
      const editor = mountEditor([{ result: COMMITTED }], projection(), {
        kind: 'unavailable',
        reason
      });
      type(editor.target, 'replace', 'c');
      control(editor.target, 'browser.matchEditor.save').click();
      await settle();

      expect(says(editor.target, reprojectionRefusalKey(reason))).toBe(true);
      // And only its own sentence: the other two are not on screen beside it.
      for (const other of ['notProjected', 'otherFile', 'otherSnippet'] as const) {
        expect(says(editor.target, reprojectionRefusalKey(other))).toBe(other === reason);
      } // End of the loop that checks the other two reasons are absent
      expect(control(editor.target, 'browser.matchEditor.reload').disabled).toBe(true);
      // The disclosed way out exists: leaving is still offered.
      expect(control(editor.target, 'browser.matchEditor.close').disabled).toBe(false);
      editor.stop();
    } // End of the loop over the three reprojection refusals
  }); // End of the "reprojection reason" case

  it('stops saying a key will be taken out once it has been', async () => {
    // The marker promises a future write. After a committed removal the buffer
    // still carries `removed` while the file no longer has the key, so a
    // flag-gated marker went on promising a write that had already happened.
    const editor = mountEditor([{ result: COMMITTED }], projection({ label: 'Signature' }));
    control(blockOf(editor.target, 'label'), 'browser.matchEditor.remove').click();
    flushSync();
    expect(says(blockOf(editor.target, 'label'), 'browser.matchEditor.fieldRemoved')).toBe(true);

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(editor.calls[0]?.draft.label).toBe('Remove');
    expect(says(blockOf(editor.target, 'label'), 'browser.matchEditor.fieldRemoved')).toBe(false);
    editor.stop();
  }); // End of the "removal already written" case

  it('tells a `Several` snippet’s two trigger boxes apart on screen', () => {
    // **The re-reading's §15.2.** A snippet with both a `trigger:` and a `regex:`
    // drew two identical unlabelled boxes, and the detail pane that distinguishes
    // them is replaced by this editor while it is open. Each value now carries the
    // name of the key it came from, rendered with the detail pane's own accessor.
    const editor = mountEditor(
      [],
      projection({ trigger: ':sev', regex: 'sev[0-9]+', triggerKind: 'Several' })
    );
    const block = blockOf(editor.target, 'trigger');
    const boxes = [...block.querySelectorAll('.shownValue')];

    expect(boxes).toHaveLength(2);
    // Each box names its own form, and the two names differ — which is the whole
    // claim: a person can tell the literal trigger from the pattern.
    const named = boxes.map((one) => one.querySelector('.marker')?.textContent?.trim());
    expect(named).toEqual([
      DICTIONARIES.en['browser.detail.field.trigger'],
      DICTIONARIES.en['browser.detail.field.regex']
    ]);
    expect(boxes[0]?.textContent).toContain(':sev');
    expect(boxes[1]?.textContent).toContain('sev[0-9]+');
    editor.stop();
  }); // End of the "several distinguishable" case


  it('drafts a removal of a key the file has, and takes it back', async () => {
    const editor = mountEditor([{ result: COMMITTED }], projection({ label: 'Signature' }));
    const label = blockOf(editor.target, 'label');
    // A key the file does not have has nothing to remove, so it is offered nothing.
    expect(button(blockOf(editor.target, 'word'), 'browser.matchEditor.remove')).toBeNull();

    control(label, 'browser.matchEditor.remove').click();
    flushSync();
    expect(says(blockOf(editor.target, 'label'), 'browser.matchEditor.fieldRemoved')).toBe(true);

    control(blockOf(editor.target, 'label'), 'browser.matchEditor.restore').click();
    flushSync();
    expect(says(blockOf(editor.target, 'label'), 'browser.matchEditor.fieldRemoved')).toBe(false);
    // A removal taken back is a draft that is clean again, not one that has lost
    // the value.
    expect(box(editor.target, 'label').value).toBe('Signature');
    expect(control(editor.target, 'browser.matchEditor.save').disabled).toBe(true);

    control(blockOf(editor.target, 'label'), 'browser.matchEditor.remove').click();
    flushSync();
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    // And nothing else was asked for, which is what scoping the control proves.
    expect(editor.calls[0]?.draft).toEqual({ ...UNTOUCHED, label: 'Remove' });
    editor.stop();
  }); // End of the "removal" case

  it('says the file was written, and rebases so there is nothing left to send', async () => {
    const editor = mountEditor([{ result: COMMITTED }]);
    type(editor.target, 'replace', 'c');

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(control(editor.target, 'browser.matchEditor.save').disabled).toBe(true);
    // A commit is also the one thing that makes this window's eligibility stale,
    // and the editor says so rather than pretending it re-derived it.
    expect(says(editor.target, 'browser.matchEditor.needsReprojection')).toBe(true);
    editor.stop();
  }); // End of the "committed" case

  it('seeds itself again from the freshly projected snippet when asked to', async () => {
    const editor = mountEditor([{ result: COMMITTED }], projection(), {
      kind: 'projected',
      match: makeMatch({ revision: AFTER, trigger: ':a', replace: 'c', label: 'Signature' })
    });
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    control(editor.target, 'browser.matchEditor.reload').click();
    flushSync();

    expect(box(editor.target, 'label').value).toBe('Signature');
    expect(says(editor.target, 'browser.matchEditor.needsReprojection')).toBe(false);
    editor.stop();
  }); // End of the "re-projection" case

  it('says the window is out of step beside a committed save, never instead of it', async () => {
    // A commit this window could not read back is a **successful save and a
    // window out of step**. Telling the person the save failed would invite a
    // retry of a write that already happened (`PROGRESS.md` D2).
    const editor = mountEditor([{ result: COMMITTED, adoption: NOT_ADOPTED }]);
    type(editor.target, 'replace', 'c');

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(says(editor.target, 'browser.saveOutcome.windowOutOfStep')).toBe(true);
    expect(says(editor.target, 'browser.matchEditor.sendFailed')).toBe(false);
    // And the session stops offering to save, because there is no projection left
    // for an identity to resolve against.
    expect(says(editor.target, 'browser.matchEditor.identityStale')).toBe(true);
    expect(control(editor.target, 'browser.matchEditor.save').disabled).toBe(true);
    editor.stop();
  }); // End of the "out of step" case

  it('runs the acknowledgement round trip with consent bound to the candidate on screen', async () => {
    // **The highest-risk protocol in this application, and it lives entirely
    // inside a component.** The gate matches an exact multiset of the candidate's
    // own suspicions, and every part of that pairing is assembled here.
    const editor = mountEditor([{ result: REFUSED }, { result: COMMITTED }]);
    type(editor.target, 'replace', 'c');

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);

    control(editor.target, 'browser.rawSave.choice.saveAnyway').click();
    await settle();

    expect(editor.calls).toHaveLength(2);
    expect(editor.calls[1]?.draft).toEqual({ ...UNTOUCHED, replace: { Set: 'c' } });
    expect(editor.calls[1]?.acknowledgement).toEqual({ accepted: [SUSPICION] });
    expect(says(editor.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    editor.stop();
  }); // End of the "acknowledgement round trip" case

  it('withdraws the offer, and the consent, when a field changes after a refusal', async () => {
    const editor = mountEditor([{ result: REFUSED }, { result: COMMITTED }]);
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();
    expect(button(editor.target, 'browser.rawSave.choice.saveAnyway')).not.toBeNull();

    type(editor.target, 'replace', 'd');

    expect(button(editor.target, 'browser.rawSave.choice.saveAnyway')).toBeNull();
    expect(says(editor.target, 'browser.matchEditor.findingsAreStale')).toBe(true);

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(editor.calls).toHaveLength(2);
    expect(editor.calls[1]?.draft).toEqual({ ...UNTOUCHED, replace: { Set: 'd' } });
    expect(editor.calls[1]?.acknowledgement).toEqual({ accepted: [] });
    editor.stop();
  }); // End of the "consent withdrawn" case

  it('draws why a draft was refused, and not only that the save did not happen', async () => {
    // **The strings this sub-phase finally draws.** `save_match`'s commonest
    // rejection is `draftRefused`, and its `DraftError` says which field cannot be
    // written and why; until now all thirty-two of those sentences reached a
    // developer console and no screen at all.
    const editor = mountEditor([{ failure: DRAFT_REFUSED }]);
    type(editor.target, 'replace', 'c');

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.matchEditor.sendFailed')).toBe(true);
    expect(says(editor.target, 'browser.matchEditor.failureReason')).toBe(true);
    // Both links of the chain, rendered through the accessors rather than looked
    // up by a key this file assembled — which is the rule a component follows and
    // the reason a renamed key cannot make this case silently stop checking.
    expect(editor.target.textContent).toContain(tIpcFailure(DRAFT_REFUSED));
    expect(editor.target.textContent).toContain(tDraftError(UNMODELLED));
    // It is not an outcome, so nothing claims the file was written or refused.
    expect(says(editor.target, 'browser.saveOutcome.fileWritten')).toBe(false);
    // And the draft is untouched, so the person can change what they asked for.
    expect(box(editor.target, 'replace').value).toBe('c');
    expect(control(editor.target, 'browser.matchEditor.save').disabled).toBe(false);
    editor.stop();
  }); // End of the "refused draft" case

  it('never says nothing was written when the write may have completed', async () => {
    const editor = mountEditor([{ mayHaveWritten: true, failure: WRITE_MAY_HAVE_HAPPENED }]);
    type(editor.target, 'replace', 'c');

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.matchEditor.mayHaveWritten')).toBe(true);
    expect(says(editor.target, 'browser.matchEditor.sendFailed')).toBe(false);
    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    expect(box(editor.target, 'replace').value).toBe('c');
    editor.stop();
  }); // End of the "may have written" case

  it('says nothing was sent, and shows no reason, when this window refused before the command', async () => {
    // **The `notAttempted` arm.** This window holds no projection of the file, so
    // no command ran: there is nothing to have written and no rejection to
    // explain. The arm carries neither field, so the screen cannot invent either.
    const editor = mountEditor([{}]);
    type(editor.target, 'replace', 'c');

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.matchEditor.sendFailed')).toBe(true);
    expect(says(editor.target, 'browser.matchEditor.mayHaveWritten')).toBe(false);
    expect(says(editor.target, 'browser.matchEditor.failureReason')).toBe(false);
    expect(box(editor.target, 'replace').value).toBe('c');
    editor.stop();
  }); // End of the "nothing attempted" case

  it('shows a conflict as terminal, keeps the draft, and offers no way to overwrite', async () => {
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, 'replace', 'c');

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(says(editor.target, 'browser.saveOutcome.draftKeptInMemory')).toBe(true);
    expect(box(editor.target, 'replace').value).toBe('c');
    expect(box(editor.target, 'replace').readOnly).toBe(true);
    // No retry of a candidate the file has moved past, and no second save.
    expect(button(editor.target, 'browser.rawSave.choice.saveAnyway')).toBeNull();
    expect(control(editor.target, 'browser.matchEditor.save').disabled).toBe(true);
    // One choice, and the two that are missing are missing on purpose: *Copy
    // draft* copies a text and this draft is six fields, and *Load the version on
    // disk* is Phase 2c-4a.
    expect(button(editor.target, conflictChoiceKey('keepEditing'))).not.toBeNull();
    expect(button(editor.target, conflictChoiceKey('copyDraft'))).toBeNull();
    expect(button(editor.target, conflictChoiceKey('reloadDiskVersion'))).toBeNull();

    control(editor.target, conflictChoiceKey('keepEditing')).click();
    flushSync();
    expect(box(editor.target, 'replace').readOnly).toBe(false);
    editor.stop();
  }); // End of the "conflict" case

  it('offers no control called “keep my draft”, in either language', async () => {
    // That phrase means *reapply the draft to the newly parsed document*, which is
    // Phase 2c-4b; using the words for this weaker behaviour would make that phase
    // look already done.
    const forbidden = ['keep my draft', 'mantener mi borrador'];
    const choices: readonly ConflictChoice[] = [
      'keepEditing',
      'copyDraft',
      'reloadDiskVersion',
      'confirmReload'
    ];
    for (const one of LOCALES) {
      for (const choice of choices) {
        expect(DICTIONARIES[one][conflictChoiceKey(choice)].toLowerCase()).not.toContain(
          forbidden[0]
        );
        expect(DICTIONARIES[one][conflictChoiceKey(choice)].toLowerCase()).not.toContain(
          forbidden[1]
        );
      } // End of the loop over the four conflict choices
    } // End of the loop over the two locales

    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();
    const drawn = (editor.target.textContent ?? '').toLowerCase();
    expect(drawn).not.toContain(forbidden[0]);
    expect(drawn).not.toContain(forbidden[1]);
    editor.stop();
  }); // End of the "keep my draft" case

  it('will not let the editor be closed while a save is in flight', async () => {
    const editor = mountEditor([{ pending: true }]);
    type(editor.target, 'replace', 'c');

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.matchEditor.saving')).toBe(true);
    expect(says(editor.target, 'browser.matchEditor.savingCannotBeStopped')).toBe(true);
    const close = control(editor.target, 'browser.matchEditor.close');
    expect(close.disabled).toBe(true);
    close.click();
    flushSync();
    expect(editor.closed()).toBe(0);
    expect(says(editor.target, 'browser.matchEditor.discardWarning')).toBe(false);
    editor.stop();
  }); // End of the "cannot close while saving" case

  it('asks before leaving with an unsaved draft, and leaves at once without one', () => {
    const clean = mountEditor();
    control(clean.target, 'browser.matchEditor.close').click();
    flushSync();
    expect(clean.closed()).toBe(1);
    clean.stop();

    const dirty = mountEditor();
    type(dirty.target, 'replace', 'c');
    control(dirty.target, 'browser.matchEditor.close').click();
    flushSync();

    expect(dirty.closed()).toBe(0);
    expect(says(dirty.target, 'browser.matchEditor.discardWarning')).toBe(true);
    control(dirty.target, 'browser.matchEditor.discard').click();
    flushSync();
    expect(dirty.closed()).toBe(1);
    dirty.stop();
  }); // End of the "leaving" case

  it('takes a burst of typing in one field back as one step', () => {
    // The coalescing of the consult's Q4, driven through the injected clock: the
    // live value moves on every keystroke and only the history snapshot is
    // grouped, so what an undo gives back is where the burst started.
    const editor = mountEditor();
    type(editor.target, 'replace', 'bc');
    editor.advance(100);
    type(editor.target, 'replace', 'bcd');

    control(editor.target, 'browser.matchEditor.undo').click();
    flushSync();

    expect(box(editor.target, 'replace').value).toBe('b');
    expect(control(editor.target, 'browser.matchEditor.redo').disabled).toBe(false);
    editor.stop();
  }); // End of the "coalescing" case
}); // End of the "mounted small editor" suite
