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

import { rawSaveChoiceKey } from '../browser/rawSave';
import { recoveryChoiceKey, sourceConflictStateKey } from '../browser/recovery';
import {
  reloadUnavailableKey,
  type ConflictModel,
  type DiskAdoptionOutcome
} from '../browser/saveOutcome';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detailFieldKey } from '../browser/detail';
import { makeDocument, makeMatch, makeSummary } from '../browser/fixtures';
import type { InvalidationStatus } from '../browser/invalidation';
import type { CreationBuffers } from '../browser/matchCreation';
import {
  fieldLabelName,
  reprojectionRefusalKey,
  type EditableField,
  type MatchBuffers,
  type Reprojection
} from '../browser/matchEditor';
import { conflictChoiceKey, type ConflictChoice } from '../browser/saveOutcome';
import { sourceSegments, type InvisibleSegment } from '../browser/sourceText';
import type { MatchSaveAnswer } from '../browser/workspace.svelte';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import {
  describeEditorReapplyObstacle,
  t,
  tDraftCopy,
  tDraftError,
  tInvisible,
  tIpcFailure
} from '../i18n';
import { LOCALES } from '../i18n/locale';
import { locale } from '../stores/locale.svelte';
import type { IpcFailure } from '../ipc/errors';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  DraftError,
  Finding,
  MatchDraft,
  MatchId,
  MatchView,
  NewMatch,
  NewMatchPosition,
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

/**
 * The whole file text the conflict's fresh read carried.
 *
 * Distinguishable from anything the draft holds, so a case can tell the disk side
 * of the panel from the draft side by looking at the rendered text.
 */
const DISK_TEXT = 'matches:\n  - trigger: x\n    replace: theirs\n';

/** A word that appears in {@link DISK_TEXT} and nowhere else on the screen. */
const DISK_TEXT_MARKER = 'theirs';

/** A save the file had moved on under. */
const CONFLICTED: SaveResult = {
  outcome: 'conflict',
  reapply: { subject: { Unsupported: {} }, placement: { NotAnchored: {} } },
  expected: BASE,
  found: AFTER,
  disk_revision: AFTER,
  disk_text: DISK_TEXT,
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

/** One call the recovery panel made to the boundary. */
interface RecordedCreate {
  /** Which file it aimed at. */
  readonly document: DocumentId;
  /** What the new snippet says. */
  readonly newMatch: NewMatch;
  /** Where in the list it goes, which is always the end. */
  readonly position: NewMatchPosition;
  /** The revision it said the form was drafted against. */
  readonly baseRevision: ContentRevision;
  /** The suspicions it said had already been shown to a person. */
  readonly acknowledgement: Acknowledgement;
}

/** A mounted editor and everything a case needs to drive it. */
interface Mounted {
  /** The element the component was mounted into. */
  readonly target: HTMLElement;
  /** Every call the component made, in order. */
  readonly calls: RecordedSave[];
  /** Every recovery create the panel below the editor made, in order. */
  readonly creates: RecordedCreate[];
  /**
   * Every conflict a **recovery** create ran into that this window was asked to
   * adopt.
   *
   * Kept apart from {@link Mounted.adoptions} because the two are different
   * conflicts over different drafted values: that one is the editor's own, and
   * this one belongs to a create the recovery panel sent. A case that finds an
   * entry in the wrong list has found the panel spending the wrong authorization.
   */
  readonly recoveryAdoptions: ConflictModel<CreationBuffers>[];
  /**
   * Every conflict the component asked the window to adopt, in order.
   *
   * **Empty is the assertion in most cases.** A conflict installs nothing until a
   * reload has been asked for *and* confirmed, so a case that reaches this panel
   * and finds an entry here has found the pre-emptive install the consult's Q2
   * ruled out.
   */
  readonly adoptions: ConflictModel<MatchBuffers>[];
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
 * The file the snippet lives in, as a projection.
 *
 * The recovery panel's destination list is derived from the window's projections
 * and from the **disk** projection the conflict carries, so a case about recovery
 * needs both. This is the first, at the revision the editor was seeded from.
 *
 * @returns The projection.
 */
function writableFile(): DocumentView {
  return makeDocument({ id: FILE.id, relativePath: FILE.relative_path, revision: BASE });
} // End of function writableFile()

/**
 * A second snippet file, so a change of recovery destination is observable.
 *
 * @returns The projection.
 */
function secondFile(): DocumentView {
  return makeDocument({ id: 2, relativePath: 'match/other.yml', revision: BASE });
} // End of function secondFile()

/**
 * The summary the window would list one projection under.
 *
 * Derived from the projection rather than written twice, so a fixture cannot
 * disagree with itself about a file's kind or its read-only flag.
 *
 * @param view - The projection to describe.
 * @returns The summary.
 */
function summaryOf(view: DocumentView): DocumentSummary {
  return makeSummary({
    id: view.id,
    relativePath: view.relative_path,
    kind: view.kind,
    readOnly: view.read_only
  });
} // End of function summaryOf()

/**
 * One scripted answer turned into the arm the boundary would return.
 *
 * Shared by the recovery creates below, which have no `pending` case: the three
 * arms are decided by which field the script carries, exactly as the editor's own
 * saves decide them.
 *
 * @param next - The scripted answer, or `undefined` when the script ran out.
 * @returns The answer to resolve with.
 */
function answerOf(next: ScriptedAnswer | undefined): MatchSaveAnswer {
  if (next?.failure !== undefined) {
    return {
      kind: 'failed',
      mayHaveWritten: next.mayHaveWritten ?? false,
      failure: next.failure
    };
  }
  if (next === undefined || next.result === undefined) {
    return { kind: 'notAttempted' };
  }
  return {
    kind: 'answered',
    result: next.result,
    adoption:
      next.adoption ??
      (next.result.outcome === 'saved' && next.result.committed ? ADOPTED : NOT_OWED)
  };
} // End of function answerOf()

/**
 * Mounts the editor over a scripted boundary.
 *
 * @param answers - What each successive save answers, in order. A save with no
 *   answer left behaves as a command that failed with nothing written.
 * @param match - The snippet to seed from.
 * @param fresh - What `reproject` answers for the session's identity. Defaults to
 *   the refusal a window that has moved elsewhere gives.
 * @param adoption - What the window answers when the editor asks it to adopt the
 *   disk observation. All three values are real production answers.
 * @param creates - What each successive **recovery** create answers, in order.
 * @param views - The projections this window holds, which is where the recovery
 *   panel's destinations come from.
 * @returns The mounted editor.
 */
function mountEditor(
  answers: readonly ScriptedAnswer[] = [],
  match: MatchView = projection(),
  fresh: Reprojection = { kind: 'unavailable', reason: 'otherFile' },
  adoption: DiskAdoptionOutcome = 'installed',
  creates: readonly ScriptedAnswer[] = [],
  views: readonly DocumentView[] = [writableFile(), secondFile()]
): Mounted {
  const remaining = [...answers];
  const remainingCreates = [...creates];
  const calls: RecordedSave[] = [];
  const created: RecordedCreate[] = [];
  const adoptions: ConflictModel<MatchBuffers>[] = [];
  const recoveryAdoptions: ConflictModel<CreationBuffers>[] = [];
  let closes = 0;
  let now = 0;
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(MatchEditor, {
    target,
    props: {
      match,
      file: FILE,
      documents: (): readonly DocumentSummary[] => views.map((view) => summaryOf(view)),
      projections: (): readonly DocumentView[] => views,
      create: (
        into: DocumentId,
        newMatch: NewMatch,
        position: NewMatchPosition,
        baseRevision: ContentRevision,
        acknowledgement: Acknowledgement
      ): Promise<MatchSaveAnswer> => {
        created.push({ document: into, newMatch, position, baseRevision, acknowledgement });
        return Promise.resolve(answerOf(remainingCreates.shift()));
      },
      adoptRecoveryDiskVersion: (
        conflict: ConflictModel<CreationBuffers>
      ): DiskAdoptionOutcome => {
        recoveryAdoptions.push(conflict);
        return adoption;
      },
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
      // **The window's own adoption**, recorded rather than assumed. Since
      // 2c-4a-3a this surface offers the reload, so a case can press the two
      // controls and watch exactly when — and whether — the window is asked to
      // move.
      adoptDiskVersion: (conflict: ConflictModel<MatchBuffers>): DiskAdoptionOutcome => {
        adoptions.push(conflict);
        return adoption;
      },
      close: (): void => {
        closes += 1;
      }
    }
  });
  return {
    target,
    calls,
    creates: created,
    adoptions,
    recoveryAdoptions,
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

/** What one scripted `execCommand('copy')` saw. */
interface CopiedSelections {
  /** The **selected** text of each copy, in order. */
  readonly selections: string[];
}

/**
 * Replaces `document.execCommand` with one that records what was *selected*.
 *
 * **It reads the carrier's selection and never its whole value**, which is the
 * 2c-4a-3a review's finding 4: a mock that reads `.value` passes even when the
 * component forgets to select anything, and a real `execCommand('copy')` over an
 * empty selection copies nothing. Setting a text area's `value` leaves its
 * selection collapsed at the end, so a carrier that is not selected records `''`
 * here and every expectation below fails.
 *
 * The caller restores the original descriptor; this only installs.
 *
 * @returns The recorder the case reads.
 */
function recordTheSelectionCopied(): CopiedSelections {
  const selections: string[] = [];
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: (command: string): boolean => {
      const selected = document.activeElement;
      if (selected instanceof HTMLTextAreaElement) {
        selections.push(
          selected.value.slice(selected.selectionStart ?? 0, selected.selectionEnd ?? 0)
        );
      }
      return command === 'copy';
    }
  });
  return { selections };
} // End of function recordTheSelectionCopied()

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
    // Three choices as of 2c-4a-3a, and the destructive one is not among them
    // yet: *Confirm reload* is the second step's label and is never offered beside
    // the first's.
    expect(button(editor.target, conflictChoiceKey('keepEditing', 'authoredText'))).not.toBeNull();
    expect(button(editor.target, conflictChoiceKey('copyDraft', 'authoredText'))).not.toBeNull();
    expect(button(editor.target, conflictChoiceKey('reloadDiskVersion', 'authoredText'))).not.toBeNull();
    expect(button(editor.target, conflictChoiceKey('confirmReload', 'authoredText'))).toBeNull();

    control(editor.target, conflictChoiceKey('keepEditing', 'authoredText')).click();
    flushSync();
    expect(box(editor.target, 'replace').readOnly).toBe(false);
    editor.stop();
  }); // End of the "conflict" case

  it('shows both sides of a conflict, and identifies no snippet across them', async () => {
    // **The comparison the consult's Q5 ruled, on a screen.** The retained draft
    // is drawn field by field — through `SourceText`, so a value a control would
    // normalise is named rather than misdrawn — and the disk side is the whole
    // file text as the command layer read it. Nothing here claims a snippet in the
    // disk version corresponds to the one being edited: that is 2c-4b.
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.saveOutcome.retainedDraft')).toBe(true);
    expect(says(editor.target, 'browser.saveOutcome.diskVersion')).toBe(true);
    // Six fields of the draft plus the disk text, all through the one rendering
    // surface for file text.
    expect(editor.target.querySelectorAll('.panel .sourceText')).toHaveLength(7);
    expect(editor.target.textContent).toContain(DISK_TEXT_MARKER);
    // Both revisions, always, and the third beside them — each with its own digest
    // substituted, which is what makes them two statements rather than one.
    expect(editor.target.textContent).toContain(
      t('browser.matchEditor.revisionExpected', { revision: BASE })
    );
    expect(editor.target.textContent).toContain(
      t('browser.matchEditor.revisionFound', { revision: AFTER })
    );
    expect(editor.target.textContent).toContain(
      t('browser.matchEditor.revisionDisk', { revision: AFTER })
    );
    // What a save would do with each field, and never a presence flag: the edited
    // one would be written, and the untouched ones would not.
    expect(says(editor.target, 'browser.saveOutcome.field.setting')).toBe(true);
    expect(says(editor.target, 'browser.saveOutcome.field.unchanged')).toBe(true);
    editor.stop();
  }); // End of the "both sides" case

  it('adopts the disk version and closes only when the reload is confirmed', async () => {
    // **The consult's Q2 seen from this screen.** The panel is drawn and the
    // window has not moved; the warning is read and it still has not; the confirm
    // click adopts once and ends the session, because there is no disk-side
    // `MatchBuffers` to seed and inventing one would be 2c-4b's identity work.
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(editor.adoptions).toEqual([]);
    expect(says(editor.target, 'browser.matchEditor.reloadIdentifiesNoSnippet')).toBe(false);

    control(editor.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
    flushSync();

    // The second step: the warning that says what happens *here*, the copy still
    // offered beside it, and the first step's label gone.
    expect(says(editor.target, 'browser.matchEditor.reloadIdentifiesNoSnippet')).toBe(true);
    expect(button(editor.target, conflictChoiceKey('copyDraft', 'authoredText'))).not.toBeNull();
    expect(button(editor.target, conflictChoiceKey('reloadDiskVersion', 'authoredText'))).toBeNull();
    expect(editor.adoptions).toEqual([]);
    expect(editor.closed()).toBe(0);

    control(editor.target, conflictChoiceKey('confirmReload', 'authoredText')).click();
    flushSync();

    expect(editor.adoptions).toHaveLength(1);
    expect(editor.adoptions[0]?.diskRevision).toBe(AFTER);
    expect(editor.closed()).toBe(1);
    editor.stop();
  }); // End of the "confirmed reload" case

  it('closes on `alreadyThere`, and closes nothing on `refused`', async () => {
    // **`alreadyThere` is a success**: the window already holds the bytes that
    // were asked for, and treating it as a failure is the stuck confirmation it
    // was added to prevent. `refused` is the only answer that means the window did
    // not move, and it leaves the panel where it was.
    for (const [answer, closes] of [
      ['alreadyThere', 1],
      ['installed', 1],
      ['refused', 0]
    ] as const) {
      const editor = mountEditor([{ result: CONFLICTED }], projection(), undefined, answer);
      type(editor.target, 'replace', 'c');
      control(editor.target, 'browser.matchEditor.save').click();
      await settle();
      control(editor.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
      flushSync();
      control(editor.target, conflictChoiceKey('confirmReload', 'authoredText')).click();
      flushSync();

      expect(editor.adoptions, answer).toHaveLength(1);
      expect(editor.closed(), answer).toBe(closes);
      // A refused adoption leaves the conflict on screen rather than reporting a
      // reload that did not happen.
      expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten'), answer).toBe(
        closes === 0
      );
      editor.stop();
    } // End of the loop over the three adoption answers
  }); // End of the "three adoption answers" case

  it('stops offering the reload once the window has refused it, and says why', async () => {
    // **The 2c-4a-3a review's finding 3, from the screen.** A refusal comes back
    // without a word about which of `adoptDiskVersion`'s ordered guards produced
    // it, so the control goes and the sentence takes its place. That is a decision
    // about what to draw, **not** a claim that a later ask would be refused too: a
    // refusal spends nothing. *Keep editing* and the copy stay, and pressing what
    // is left asks the window nothing further.
    const editor = mountEditor([{ result: CONFLICTED }], projection(), undefined, 'refused');
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();
    control(editor.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
    flushSync();
    control(editor.target, conflictChoiceKey('confirmReload', 'authoredText')).click();
    flushSync();

    // The authored-text half of 3c-4's split: this surface's sentence is the
    // one that was always here, and the operation wording is not drawn.
    expect(says(editor.target, reloadUnavailableKey('authoredText'))).toBe(true);
    expect(says(editor.target, reloadUnavailableKey('operationChoice'))).toBe(false);
    expect(button(editor.target, conflictChoiceKey('confirmReload', 'authoredText'))).toBeNull();
    expect(button(editor.target, conflictChoiceKey('reloadDiskVersion', 'authoredText'))).toBeNull();
    expect(button(editor.target, conflictChoiceKey('copyDraft', 'authoredText'))).not.toBeNull();
    expect(button(editor.target, conflictChoiceKey('keepEditing', 'authoredText'))).not.toBeNull();
    // The warning is gone with the control it belonged to.
    expect(says(editor.target, 'browser.matchEditor.reloadIdentifiesNoSnippet')).toBe(false);
    expect(editor.adoptions).toHaveLength(1);
    expect(editor.closed()).toBe(0);

    // And *Keep editing* is a real way out: the panel goes and the draft is back.
    control(editor.target, conflictChoiceKey('keepEditing', 'authoredText')).click();
    flushSync();
    expect(box(editor.target, 'replace').readOnly).toBe(false);
    expect(box(editor.target, 'replace').value).toBe('c');
    editor.stop();
  }); // End of the "refused reload stops being offered" case

  it('warns that the reload closes this editor, never that it replaces the text', async () => {
    // **The 2c-4a-3a review's finding 2.** *Loading the version on disk replaces
    // your text with it* is the raw editor's behaviour; this surface installs the
    // disk projection and closes, loading nothing in the draft's place — and the
    // shared sentence contradicted the confirmation sentence beside it.
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(says(editor.target, 'browser.saveOutcome.reloadClosesSurface')).toBe(true);
    expect(says(editor.target, 'browser.saveOutcome.reloadDiscardsDraft')).toBe(false);
    editor.stop();
  }); // End of the "surface-aware warning" case

  it('copies a labelled reference of the draft, and never YAML', async () => {
    // **The selection fallback, exactly as the webview takes it**: jsdom has no
    // clipboard, so `navigator.clipboard.writeText` rejects and the carrier route
    // runs. What it carries is `tDraftCopy` of the same list the panel drew —
    // labels, statuses and the exact strings — and it is not YAML.
    const original = Object.getOwnPropertyDescriptor(document, 'execCommand');
    const copied = recordTheSelectionCopied();
    try {
      const editor = mountEditor([{ result: CONFLICTED }], projection({ label: 'Signature' }));
      type(editor.target, 'replace', 'c');
      control(editor.target, 'browser.matchEditor.save').click();
      await settle();

      control(editor.target, conflictChoiceKey('copyDraft', 'authoredText')).click();
      await settle();

      expect(says(editor.target, 'browser.saveOutcome.draftCopied')).toBe(true);
      expect(says(editor.target, 'browser.saveOutcome.draftCopyFailed')).toBe(false);
      // **Exactly what the model would render, and only what was selected.** The
      // expectation is built here from the six fields this projection and this
      // edit produce, so it pins the order, the labels, the statuses and every
      // string byte for byte — and because the mock records the *selection* rather
      // than the carrier's whole value, a carrier that was never selected copies
      // an empty string and fails this (2c-4a-3a review, finding 4).
      expect(copied.selections).toEqual([
        tDraftCopy([
          { label: 'trigger', text: ':a', status: 'unchanged' },
          { label: 'replace', text: 'c', status: 'setting' },
          { label: 'label', text: 'Signature', status: 'unchanged' },
          { label: 'word', text: '', status: 'unchanged' },
          { label: 'leftWord', text: '', status: 'unchanged' },
          { label: 'rightWord', text: '', status: 'unchanged' }
        ])
      ]);
      const text = copied.selections[0] ?? '';
      // Not YAML, and nothing that could be pasted back as one: no `matches:`
      // list, and no `key: value` line assembled out of a projection.
      expect(text).toContain(DICTIONARIES.en['browser.saveOutcome.copyHeading']);
      expect(text).not.toContain('matches:');
      expect(text).not.toContain('replace: c');
      // And the carrier is gone again.
      expect(document.querySelectorAll('textarea')).toHaveLength(1);
      editor.stop();
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(document, 'execCommand');
      } else {
        Object.defineProperty(document, 'execCommand', original);
      }
    }
  }); // End of the "reference copy" case

  it('refuses the selection copy of a draft holding a carriage return, and says so', async () => {
    // **A text area normalises a carriage return**, so the carrier would put
    // different characters on the clipboard and report success. A projected value
    // the editor shows read-only may hold one, so this is reachable: the copy is
    // refused and the refusal is disclosed. What stays on screen is a *readable
    // representation* — the carriage return is named, not drawn — so it is
    // explicitly not the original value, and no route recovers that value here.
    const original = Object.getOwnPropertyDescriptor(document, 'execCommand');
    let attempts = 0;
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: (): boolean => {
        attempts += 1;
        return true;
      }
    });
    try {
      const editor = mountEditor([{ result: CONFLICTED }], projection({ replace: 'a\rb' }));
      type(editor.target, 'label', 'renamed');
      control(editor.target, 'browser.matchEditor.save').click();
      await settle();

      control(editor.target, conflictChoiceKey('copyDraft', 'authoredText')).click();
      await settle();

      expect(attempts).toBe(0);
      expect(says(editor.target, 'browser.saveOutcome.draftCopyFailed')).toBe(true);
      expect(says(editor.target, 'browser.saveOutcome.draftCopied')).toBe(false);
      // The panel names the carriage return rather than drawing it as a line
      // break. That naming is what this asserts — it is the representation, not
      // the value, and selecting it by hand would not reproduce the draft.
      const invisible = sourceSegments('a\rb', false).filter(
        (segment): segment is InvisibleSegment => segment.kind === 'invisible'
      );
      expect(editor.target.textContent).toContain(tInvisible(invisible[0]!));
      editor.stop();
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(document, 'execCommand');
      } else {
        Object.defineProperty(document, 'execCommand', original);
      }
    }
  }); // End of the "carriage return refuses the copy" case

  it('calls only the reapply control “keep my draft”, in either language', async () => {
    // **The inverse of the case this replaces, and the inversion is the phase.**
    // Until 2c-4b-3 the phrase named nothing this application could do, so no
    // control was allowed to wear it; the operation exists now, and exactly one
    // control may. Every *other* label must still not, for the reason that has not
    // changed: the words mean *reapply the draft to the newly parsed document*.
    const forbidden = ['keep my draft', 'mantener mi borrador'];
    const others: readonly ConflictChoice[] = [
      'keepEditing',
      'copyDraft',
      'reloadDiskVersion',
      'confirmReload'
    ];
    for (const one of LOCALES) {
      for (const choice of others) {
        // Both draft kinds, because `confirmReload` has one label per kind since
        // 2c-4a-3b and the forbidden phrase could hide in either of them.
        for (const draftKind of ['authoredText', 'operationChoice'] as const) {
          const label = DICTIONARIES[one][conflictChoiceKey(choice, draftKind)].toLowerCase();
          expect(label).not.toContain(forbidden[0]);
          expect(label).not.toContain(forbidden[1]);
        } // End of the loop over the two draft kinds
      } // End of the loop over the four other conflict choices
    } // End of the loop over the two locales

    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();
    // On the screen the phrase appears, once, on a control this panel really does
    // wire — which is the whole difference between this case and the one it
    // replaces.
    expect(button(editor.target, conflictChoiceKey('keepMyDraft', 'authoredText'))).not.toBeNull();
    const drawn = (editor.target.textContent ?? '').toLowerCase();
    expect(drawn).toContain(forbidden[0]);
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

  it('keeps the authored-text way out saying “Keep editing”', async () => {
    // **The other side of 2c-4a-3c's finding 10.2.** `conflictChoiceKey` branches
    // `keepEditing` on the draft kind now, and this surface drafts authored text:
    // the person really is editing, so its label must **not** have moved with the
    // three operation-choice panels'.
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();

    expect(button(editor.target, 'browser.rawSave.choice.keepEditing')).not.toBeNull();
    expect(button(editor.target, 'browser.saveOutcome.choice.keepOperation')).toBeNull();
    editor.stop();
  }); // End of the "authored-text way out" case
}); // End of the "mounted small editor" suite

describe('the small editor’s refused arm names what this surface drafts', () => {
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
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
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
}); // End of the "small editor's refused arm" suite

describe('the small editor asks for its outcome to be brought into view', () => {
  /*
   * **2c-4a-3c's finding 10.3, on the surface where it was a Medium.** The window
   * reading measured this panel's top at y = 720 in English and y = 771 in Spanish
   * in a 728 px viewport, 1 044 px tall, with `section.detail`'s `scrollTop` at `0`
   * — eight pixels of a panel in one language and none of it in the other, with the
   * editor above unchanged in size and position across the save, so nothing visible
   * marked that anything had happened.
   *
   * The decision is `./reveal.ts`'s and has its own suite; what only a mounted case
   * can say is that this file **binds** the two elements and **runs** the effect.
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
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  /**
   * An editor showing a conflict, with the scroll record cleared of nothing.
   *
   * @returns The mounted editor.
   */
  async function conflicted(): Promise<ReturnType<typeof mountEditor>> {
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
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
    control(editor.target, conflictChoiceKey('reloadDiskVersion', 'authoredText')).click();
    flushSync();

    const choices = editor.target.querySelector('[role="status"] .choices');
    expect(choices).not.toBeNull();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(choices);
    expect(scrolled[0]?.block).toBe('end');
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
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
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

  it('asks for a refused reapply’s report, and again on a second press', async () => {
    // **2c-4b-3c-2 §11.1.** The report is drawn *above* the outcome panel, and
    // that reading measured it entirely above the scrollport in all 42 of its
    // refusal launches while the outcome panel below it kept pixel-identical
    // coordinates — so pressing the control and being refused changed nothing a
    // person could see. The **second** press is what settled the severity: the
    // identical sentence at the identical rectangle, with nothing to tell the two
    // presses apart. It is asserted here because the cue is a string and a second
    // refusal produces the same string, so an effect depending on the cue alone
    // would not re-run.
    //
    // **jsdom has no viewport and does not lay anything out**, so this case
    // cannot fail because the block ends up off screen. What it pins is that this
    // component binds the block and runs the effect. 3d-2's window reading is the
    // only thing that can say a person sees the sentence. **And the spy installed
    // above is a platform that always accepts**: a real one may have no
    // `scrollIntoView` or may refuse the call, and `scrollQuietly` is silent for
    // both — so the reveal is asked for here, never achieved.
    const editor = await conflicted();
    scrolled.length = 0;
    control(editor.target, conflictChoiceKey('keepMyDraft', 'authoredText')).click();
    flushSync();

    const report = editor.target.querySelector('[role="status"].reapply');
    expect(report).not.toBeNull();
    expect(says(editor.target, 'browser.reapply.manualResolution')).toBe(true);
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(report);
    expect(scrolled[0]?.block).toBe('nearest');

    scrolled.length = 0;
    control(editor.target, conflictChoiceKey('keepMyDraft', 'authoredText')).click();
    flushSync();
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]?.target).toBe(report);
    expect(scrolled[0]?.block).toBe('nearest');
    editor.stop();
  }); // End of the "asks for a refused reapply's report" case
}); // End of the "small editor asks for its outcome" suite

describe('the small editor’s *Keep my draft*', () => {
  /** The reapply control's label on this surface, whose draft is authored text. */
  const KEEP_MY_DRAFT = conflictChoiceKey('keepMyDraft', 'authoredText');

  /**
   * A conflict whose evidence identified the snippet in the fresh read.
   *
   * @param replace - What the disk now holds in the body, so a case can choose
   *   between the field being untouched and the disk having moved it.
   * @returns The conflict as it crosses the boundary.
   */
  function identified(replace: string): SaveResult {
    const target = makeMatch({
      node: 1,
      document: FILE.id,
      revision: AFTER,
      trigger: ':a',
      replace
    });
    // Written out rather than spread over {@link CONFLICTED}: a spread into a
    // `SaveResult` annotation is checked against all three arms, and the two this
    // is not lack every field below.
    return {
      outcome: 'conflict',
      reapply: { subject: { Identified: { target } }, placement: { NotAnchored: {} } },
      expected: BASE,
      found: AFTER,
      disk_revision: AFTER,
      disk_text: DISK_TEXT,
      disk: makeDocument({
        id: FILE.id,
        relativePath: FILE.relative_path,
        revision: AFTER,
        matches: [target]
      })
    };
  } // End of function identified()

  /**
   * Types into the body and saves into a conflict.
   *
   * @param result - The conflict the scripted boundary answers with.
   * @param adoption - What the window answers when asked to adopt.
   * @returns The mounted editor, showing the conflict.
   */
  async function conflictedWith(
    result: SaveResult,
    adoption: DiskAdoptionOutcome = 'installed'
  ): Promise<Mounted> {
    const editor = mountEditor(
      [{ result }],
      projection(),
      { kind: 'unavailable', reason: 'otherFile' },
      adoption
    );
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();
    return editor;
  } // End of function conflictedWith()

  it('draws the control and the authored-text line beside it', async () => {
    const editor = await conflictedWith(CONFLICTED);
    expect(button(editor.target, KEEP_MY_DRAFT)).not.toBeNull();
    expect(says(editor.target, 'browser.reapply.ready')).toBe(true);
    // Never the operation-choice sentence: this surface holds text a person typed.
    expect(says(editor.target, 'browser.reapply.readyOperation')).toBe(false);
    editor.stop();
  });

  it('rebuilds the drafted field over the disk version and sends it afresh', async () => {
    // The disk has not touched the body, so the retained change applies and the
    // rebuilt session's ordinary *Save* sends it against the new base revision.
    const editor = await conflictedWith(identified('b'));
    control(editor.target, KEEP_MY_DRAFT).click();
    flushSync();

    expect(editor.adoptions).toHaveLength(1);
    expect(says(editor.target, 'browser.reapply.reapplied')).toBe(true);
    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(false);
    // The typed value survived, and the box holds it.
    expect(box(editor.target, 'replace').value).toBe('c');
    expect(editor.calls).toHaveLength(1);

    control(editor.target, 'browser.matchEditor.save').click();
    await settle();
    expect(editor.calls).toHaveLength(2);
    expect(editor.calls[1]?.baseRevision).toBe(AFTER);
    expect(editor.calls[1]?.id.revision).toBe(AFTER);
    editor.stop();
  }); // End of the "field rebuilt and sent afresh" case

  it('names the field the disk moved under the draft, and writes nothing', async () => {
    // **Any collision refuses the whole reapply**, and the panel still says which
    // field: saving the safe ones would strand the rest while looking successful,
    // and per-field resolution is 2c-4c's.
    const editor = await conflictedWith(identified('theirs'));
    control(editor.target, KEEP_MY_DRAFT).click();
    flushSync();

    expect(says(editor.target, 'browser.reapply.manualResolution')).toBe(true);
    expect(editor.target.textContent).toContain(
      describeEditorReapplyObstacle('en', { kind: 'fieldCollisions', fields: ['replace'] })
    );
    // Decide first, adopt second: nothing was installed and the conflict stands.
    expect(editor.adoptions).toEqual([]);
    expect(says(editor.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(editor.calls).toHaveLength(1);
    editor.stop();
  }); // End of the "field collision" case

  it('refuses and adopts nothing when the evidence names no snippet', async () => {
    const editor = await conflictedWith(CONFLICTED);
    control(editor.target, KEEP_MY_DRAFT).click();
    flushSync();

    expect(says(editor.target, 'browser.reapply.manualResolution')).toBe(true);
    expect(says(editor.target, 'browser.reapply.obstacle.evidenceNotATarget')).toBe(true);
    expect(editor.adoptions).toEqual([]);
    expect(box(editor.target, 'replace').value).toBe('c');
    editor.stop();
  });
}); // End of the "small editor’s reapply" suite

describe('the small editor’s recovery', () => {
  /** The label of the control that offers a reapply. */
  const KEEP_MY_DRAFT = conflictChoiceKey('keepMyDraft', 'authoredText');

  /** The label of the control that offers recovery. */
  const CREATE_FROM_FIELDS = recoveryChoiceKey('createFromSupportedFields');

  /** A recovery create that ran to the end and wrote the destination. */
  const CREATED: SaveResult = {
    outcome: 'saved',
    revision: AFTER,
    committed: true,
    notes: [],
    backup_taken: false,
    moved: { document: FILE.id, revision: AFTER, node: 44 }
  };

  /**
   * An editor showing a conflict a reapply could resolve nothing about.
   *
   * `CONFLICTED`'s evidence names no snippet, so *Keep my draft* refuses and
   * adopts nothing — which is exactly recovery's entry condition.
   *
   * @param creates - What each successive recovery create answers, in order.
   * @returns The mounted editor, at the manual-resolution report.
   */
  async function stuck(creates: readonly ScriptedAnswer[] = []): Promise<Mounted> {
    const editor = mountEditor(
      [{ result: CONFLICTED }],
      projection(),
      { kind: 'unavailable', reason: 'otherFile' },
      'installed',
      creates
    );
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();
    control(editor.target, KEEP_MY_DRAFT).click();
    flushSync();
    return editor;
  } // End of function stuck()

  it('offers nothing until a reapply has resolved nothing', async () => {
    const editor = mountEditor([{ result: CONFLICTED }]);
    type(editor.target, 'replace', 'c');
    control(editor.target, 'browser.matchEditor.save').click();
    await settle();
    // The conflict is on screen and the reapply has not been tried, so recovery is
    // not reached — and `recoveryIsAnswerable` is what keeps it silent rather than
    // explaining an unoffered control.
    expect(button(editor.target, CREATE_FROM_FIELDS)).toBeNull();
    editor.stop();
  });

  it('offers recovery once it has, and reaches a committed create', async () => {
    const editor = await stuck([{ result: CREATED }]);
    expect(says(editor.target, 'browser.reapply.manualResolution')).toBe(true);
    control(editor.target, CREATE_FROM_FIELDS).click();
    flushSync();

    // The transfer table is drawn beside the two boxes, and the destination the
    // conflict's own disk projection still allows is preferred.
    expect(says(editor.target, 'browser.recovery.transferHeading')).toBe(true);
    expect(says(editor.target, sourceConflictStateKey('retained'))).toBe(true);
    control(editor.target, 'browser.recovery.create').click();
    await settle();

    expect(editor.creates).toHaveLength(1);
    expect(editor.creates[0]!.document).toBe(FILE.id);
    expect(editor.creates[0]!.position).toEqual({ End: {} });
    // The **disk** revision the conflict carried, which is the newest observation
    // this window has of that file.
    expect(editor.creates[0]!.baseRevision).toBe(AFTER);
    // The editor's own draft — the trigger it holds and the body that was typed.
    expect(editor.creates[0]!.newMatch).toEqual({ trigger: ':a', replace: 'c' });
    // No second `save_match`, and the editor's own conflict was never adopted.
    expect(editor.calls).toHaveLength(1);
    expect(editor.adoptions).toEqual([]);
    expect(editor.recoveryAdoptions).toEqual([]);
    expect(says(editor.target, sourceConflictStateKey('spent'))).toBe(true);
    editor.stop();
  }); // End of the "reaches a committed create" case

  it('keeps the editor’s own conflict and draft through an abandoned recovery', async () => {
    const editor = await stuck();
    control(editor.target, CREATE_FROM_FIELDS).click();
    flushSync();
    control(editor.target, 'browser.recovery.close').click();
    flushSync();

    expect(editor.creates).toEqual([]);
    expect(editor.adoptions).toEqual([]);
    // The conflict above it is untouched: its own draft is still retained and its
    // own choices are still offered.
    expect(says(editor.target, 'browser.saveOutcome.draftKeptInMemory')).toBe(true);
    expect(button(editor.target, KEEP_MY_DRAFT)).not.toBeNull();
    expect(button(editor.target, CREATE_FROM_FIELDS)).not.toBeNull();
    editor.stop();
  });
}); // End of the "small editor’s recovery" suite
