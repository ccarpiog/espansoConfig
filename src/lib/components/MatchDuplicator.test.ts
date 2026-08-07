/** @vitest-environment jsdom */

/**
 * The duplicate panel, mounted and driven through real DOM events.
 *
 * The seventh file in this repository to opt into jsdom, and it opts in the same
 * way the first six do: by the docblock above and by nothing else. The suite's
 * default environment is still `node`, and the six components that predate
 * `RawEditor.svelte` are deliberately not back-filled
 * (`docs/decisions/2c-split-notes.md` section 7).
 *
 * **What this file is for, given that `matchDuplication.test.ts` already
 * exists.** That suite drives the value over plain fixtures; it cannot see any
 * of the five claims this sub-phase's screen makes and only a screen can break:
 *
 * 1. **the acknowledge-and-retry round trip is this operation's ordinary path**,
 *    driven end to end through the controls a person actually clicks — the
 *    refusal comes back, *Save anyway* records consent and sends again, and the
 *    finding crosses back **intact**, its `ContentRevision` operand included, so
 *    consent collected for one copy cannot be spent on another;
 * 2. **the panel renders the model's `notDuplicableToShow` and decides nothing
 *    about it** — the precedence between the frozen reason and a live
 *    `outOfDate` is `matchDuplicationView`'s, and these two cases are its
 *    rendered halves rather than the rule itself. They are also this renderer's
 *    standing regression cover for step 3's Medium finding: the condition they
 *    drove used to live in the markup, and a mounted suite is exactly what can
 *    see a rule that lives there. What moved to the model is the decision, so a
 *    second renderer inherits it rather than having to repeat it; what stays
 *    here is the check that *this* renderer draws it;
 * 3. **the identity handed to `beginDuplicate` is read from the live
 *    projections**, so a panel retained across a re-read of the file sends
 *    nothing;
 * 4. **`unsavedDraftInDocument` has a producer at all**, which every model test
 *    supplied as a literal boolean (`docs/decisions/2c-3c-2-notes.md` section 4,
 *    hole 3);
 * 5. **a `MatchId` reaching `draft.ts` is a plain object.** `structuredClone`
 *    throws on a `$state` proxy and `BrowserState.views` is deeply proxied, so
 *    the last suite duplicates over a **real** `BrowserState` — a model test
 *    cannot catch a repeat of that, because model tests pass plain fixtures.
 *
 * The last suite is also where `BrowserState.rereadDocument` — the producer
 * behind `DuplicationRecovery.reloadFile`, the consult's Q8 — is driven end to
 * end for this panel: a hand-rolled stub is not reactive, and the whole question
 * is what the panel says *after* the state has replaced its own projection.
 *
 * **This does not replace the window reading.** What it proves is that a handler
 * fires and that the right value reaches the boundary. jsdom has no layout, so
 * the sticky action row is not measured here and is owed a reading, in both
 * languages.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import type { DiskAdoptionOutcome } from '../browser/saveOutcome';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDocument, makeMatch, makeSummary, matchListPath } from '../browser/fixtures';
import type { InvalidationStatus } from '../browser/invalidation';
import {
  createBrowserState,
  type BrowserCommands,
  type BrowserState,
  type MatchSaveAnswer
} from '../browser/workspace.svelte';
import { DICTIONARIES, type TranslationKey } from '../i18n/dictionaries';
import type { CommandResult } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import { locale } from '../stores/locale.svelte';
import type {
  Acknowledgement,
  ContentRevision,
  DocumentId,
  DocumentSummary,
  DocumentView,
  Finding,
  MatchId,
  MatchView,
  SaveResult,
  WorkspaceSummary
} from '../ipc/types';
import MatchDuplicator from './MatchDuplicator.svelte';

/** The revision every projection below is minted from. */
const BASE: ContentRevision = 'a'.repeat(64);

/** The revision the file holds after it has been read again, or written. */
const AFTER: ContentRevision = 'b'.repeat(64);

/** The file the snippets live in. */
const FILE: DocumentSummary = makeSummary({ id: 2, relativePath: 'match/base.yml' });

/** The adoption a save that wrote nothing owes: none. */
const NOT_OWED: InvalidationStatus = { kind: 'notOwed' };

/** The adoption a committed save performed. */
const ADOPTED: InvalidationStatus = { kind: 'done' };

/**
 * The adoption a committed duplicate could **not** perform.
 *
 * The file was written and this window could not read it back, which is
 * `PROGRESS.md` D2's shape: the failure travels *beside* the committed outcome
 * and never in place of it.
 */
const NOT_ADOPTED: InvalidationStatus = {
  kind: 'failed',
  failure: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
};

/**
 * One snippet of the file's own `matches:` list.
 *
 * The `path` is what makes it an *item of a sequence*, which is what a duplicate
 * copies: a fixture without one is `noSequencePosition` and cannot be copied at
 * all.
 *
 * @param node - The arena node, which is also the identity's node.
 * @param index - Its position in the list, which is what its path ends in.
 * @param trigger - Its trigger, so the snippets are distinguishable on screen.
 * @param revision - The parse it belongs to.
 * @returns The projection.
 */
function item(
  node: number,
  index: number,
  trigger: string,
  revision: ContentRevision = BASE
): MatchView {
  return makeMatch({ node, document: 2, revision, trigger, path: matchListPath(index) });
} // End of function item()

/**
 * A snippet file with two snippets in one list.
 *
 * Two is enough here, unlike a move's three: a duplicate has no destination to
 * choose, so nothing in this panel depends on telling a middle position from an
 * end one.
 *
 * @param overrides - Whatever a case needs beyond the two snippets.
 * @returns The projection.
 */
function file(overrides: Parameters<typeof makeDocument>[0] = {}): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: BASE,
    matches: [item(10, 0, ':sig'), item(11, 1, ':date')],
    ...overrides
  });
} // End of function file()

/**
 * The same file as this window holds it after reading it again.
 *
 * **The arena nodes are kept and only the revision moves.** A fixture that
 * renumbered them would let a case pass by finding nothing, which is a weaker
 * claim than the one these cases make: an identity from an earlier parse is
 * refused even when the node it names is still occupied.
 *
 * @returns The projection the re-read installs.
 */
function reread(): DocumentView {
  return makeDocument({
    id: 2,
    relativePath: 'match/base.yml',
    revision: AFTER,
    matches: [item(10, 0, ':sig', AFTER), item(11, 1, ':date', AFTER)]
  });
} // End of function reread()

/**
 * The suspicion the transaction raises on a duplicate's first attempt.
 *
 * **Content-addressed**: the `revision` operand binds the consent to one exact
 * candidate, so a finding handed back unchanged acknowledges that copy and no
 * other. The cases below compare the acknowledgement against this whole object
 * for that reason, rather than against its code.
 */
const TRIGGER_KEPT: Finding = {
  code: { DuplicateKeepsTriggerDefinition: { revision: AFTER } },
  span: null,
  node: null,
  path: null
};

/** The refusal a duplicate's first attempt ordinarily comes back as. */
const REFUSED: SaveResult = {
  outcome: 'refused',
  verdict: 'RefusedForUnacknowledgedSuspicions',
  findings: [TRIGGER_KEPT]
};

/** A duplicate that ran to the end and wrote the file. */
const COMMITTED: SaveResult = {
  outcome: 'saved',
  revision: AFTER,
  committed: true,
  notes: [],
  backup_taken: false,
  moved: { document: 2, revision: AFTER, node: 12 }
};

/**
 * The same committed duplicate, with no identity to point at afterwards.
 *
 * **`moved: null` is legal on a commit**, and it says only that the clone could
 * not be identified in the read that followed the write — never which of its
 * causes occurred, and never that a second writer exists.
 */
const COMMITTED_UNLOCATED: SaveResult = { ...COMMITTED, moved: null };

/**
 * A save that failed at or after the rename, so the file may already hold it.
 *
 * **`saveFailed` and nothing else**: `mayHaveWritten` in `../ipc/errors` answers
 * `true` for that one code, and a directory sync interrupted after the rename is
 * what the save transaction reports it for.
 */
const AFTER_THE_RENAME: IpcFailure = {
  kind: 'command',
  error: {
    code: 'saveFailed',
    error: {
      Write: {
        Io: { step: 'SyncDirectory', path: 'match/base.yml', kind: 'Interrupted', raw_os_error: 4 }
      }
    },
    may_have_written: true
  }
};

/** A rejection that says this window and the file disagree about an address. */
const STALE_IDENTITY: IpcFailure = {
  kind: 'command',
  error: { code: 'identityStaleRevision', expected: AFTER, found: BASE }
};

/** One call the panel made to the boundary. */
interface RecordedDuplicate {
  /** Which snippet it aimed at. */
  readonly id: MatchId;
  /** The revision it said the session was opened at. */
  readonly baseRevision: ContentRevision;
  /** The suspicions it said had already been shown to a person. */
  readonly acknowledgement: Acknowledgement;
}

/**
 * One scripted answer to one duplicate.
 *
 * Which arm of `MatchSaveAnswer` it produces is decided by which field it
 * carries: `result` is `answered`, `failure` is `failed`, and neither is
 * `notAttempted`.
 */
interface ScriptedAnswer {
  /** How the save ended, for the `answered` arm. */
  readonly result?: SaveResult;
  /** What became of the adoption; a commit adopts unless a case says otherwise. */
  readonly adoption?: InvalidationStatus;
  /** Whether the file may already hold the copy. */
  readonly mayHaveWritten?: boolean;
  /** Why the command rejected, for the `failed` arm. */
  readonly failure?: IpcFailure;
}

/** A mounted panel and everything a case needs to drive it. */
interface Mounted {
  /** The element the component was mounted into. */
  readonly target: HTMLElement;
  /** Every call the panel made, in order. */
  readonly calls: RecordedDuplicate[];
  /** How many times the panel asked to be closed. */
  readonly closed: () => number;
  /** How many times the panel asked for the file to be read again. */
  readonly reloads: () => number;
  /** Tears the component down. */
  readonly stop: () => void;
}

/** Everything {@link mountDuplicator} takes beyond the answers it scripts. */
interface Opened {
  /** The file's projection to open over. */
  readonly projection?: DocumentView;
  /** Which of its snippets the duplicate is about. */
  readonly at?: number;
  /** What the projections reader answers. Defaults to the opened projection. */
  readonly views?: readonly DocumentView[];
  /** What the document-wide unsaved-draft reader answers. */
  readonly draft?: boolean;
  /** What a re-read answers. */
  readonly reload?: IpcFailure | null;
}

/**
 * Mounts the panel over a scripted boundary.
 *
 * @param answers - What each successive duplicate answers, in order.
 * @param opened - What the panel is opened over.
 * @returns The mounted panel.
 */
function mountDuplicator(
  answers: readonly ScriptedAnswer[] = [],
  opened: Opened = {}
): Mounted {
  const projection = opened.projection ?? file();
  const remaining = [...answers];
  const calls: RecordedDuplicate[] = [];
  let closes = 0;
  let reloads = 0;
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(MatchDuplicator, {
    target,
    props: {
      projection,
      match: projection.matches[opened.at ?? 0]!,
      file: FILE,
      projections: (): readonly DocumentView[] => opened.views ?? [projection],
      unsavedDraftInDocument: (): boolean => opened.draft ?? false,
      duplicate: (
        id: MatchId,
        baseRevision: ContentRevision,
        acknowledgement: Acknowledgement
      ): Promise<MatchSaveAnswer> => {
        calls.push({ id, baseRevision, acknowledgement });
        const next = remaining.shift();
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
      reload: (): Promise<IpcFailure | null> => {
        reloads += 1;
        return Promise.resolve(opened.reload ?? null);
      },
      // **The window's own adoption**, which no case here reaches: the five match
      // surfaces declare `offersReload: false`, so no control that could spend a
      // confirmation is drawn. `matchDuplication.test.ts` drives the transition directly.
      adoptDiskVersion: (): DiskAdoptionOutcome => 'installed',
      close: (): void => {
        closes += 1;
      }
    }
  });
  return {
    target,
    calls,
    closed: () => closes,
    reloads: () => reloads,
    stop: () => {
      void unmount(component);
      target.remove();
    }
  };
} // End of function mountDuplicator()

/**
 * The button whose label is the English rendering of one key, or `null`.
 *
 * Matched against the dictionary rather than against a literal, so this file
 * holds no user-facing text of its own.
 *
 * @param target - Where the component was mounted.
 * @param key - The key holding the button's label.
 * @returns The button, or `null`.
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
 * Whether the panel is showing one sentence.
 *
 * @param target - Where the component was mounted.
 * @param key - The key holding the sentence.
 * @returns `true` when the rendered text contains it.
 */
function says(target: HTMLElement, key: TranslationKey): boolean {
  return (target.textContent ?? '').includes(DICTIONARIES.en[key]);
} // End of function says()

/**
 * Waits for the panel's asynchronous handler to finish.
 *
 * A macrotask rather than a fixed number of microtask ticks.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
} // End of function settle()

beforeEach(() => {
  locale.setOverride('en');
});

afterEach(() => {
  locale.setOverride(null);
});

describe('the mounted duplicate panel', () => {
  it('says where the copy lands, offers no destination, and sends nothing until asked', async () => {
    // **The consult's Q4 on a screen.** There is no placement product: one static
    // sentence says the copy is written immediately after its source, and the
    // panel opens ready to send rather than asking a question first.
    const panel = mountDuplicator([{ result: COMMITTED }]);
    expect(says(panel.target, 'browser.matchDuplication.landsAfterSource')).toBe(true);
    expect(control(panel.target, 'browser.matchDuplication.duplicate').disabled).toBe(false);
    expect(panel.calls).toHaveLength(0);

    control(panel.target, 'browser.matchDuplication.duplicate').click();
    await settle();

    // **The identity is the one the live projection gives the snippet**, and the
    // base revision is the session's own frozen one.
    expect(panel.calls).toHaveLength(1);
    expect(panel.calls[0]?.id).toEqual({ document: 2, revision: BASE, node: 10 });
    expect(panel.calls[0]?.baseRevision).toBe(BASE);
    expect(panel.calls[0]?.acknowledgement).toEqual({ accepted: [] });
    panel.stop();
  }); // End of the "lands after the source" case

  it('carries the trigger finding back intact on the retry, operand and all', async () => {
    // **This operation's ordinary path, not its exceptional one.** A byte-exact
    // copy keeps its source's trigger definition, so the first attempt comes back
    // refused by design and the acknowledgement round trip is what commits it.
    const panel = mountDuplicator([{ result: REFUSED }, { result: COMMITTED }]);
    control(panel.target, 'browser.matchDuplication.duplicate').click();
    await settle();

    expect(says(panel.target, 'browser.saveOutcome.nothingWasWritten')).toBe(true);
    expect(says(panel.target, 'browser.matchDuplication.findings')).toBe(true);
    // The finding is rendered through the typed accessor, so its sentence is the
    // dictionary's rather than anything this panel assembled.
    expect(panel.target.textContent).toContain(
      DICTIONARIES.en['code.findingCode.duplicateKeepsTriggerDefinition']
    );

    // **One step, not two.** A deletion re-raises its confirmation because
    // `confirmDelete` consumed the pending one; a duplicate has no confirmation
    // to re-raise (the consult's Q6).
    control(panel.target, 'browser.rawSave.choice.saveAnyway').click();
    await settle();

    expect(panel.calls).toHaveLength(2);
    // **Content-addressed consent**: the whole finding goes back, its
    // `ContentRevision` operand included, so what was accepted was this candidate
    // and nothing else. A reconstructed code would compare equal on `code` alone.
    expect(panel.calls[1]?.acknowledgement).toEqual({ accepted: [TRIGGER_KEPT] });
    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    panel.stop();
  }); // End of the "acknowledgement round trip" case

  it('refuses while this window has an editor open over any snippet of the file', () => {
    // **The producer `unsavedDraftInDocument` never had** (step 2's hole 3). Every
    // model test passed the boolean as a literal; this is the arm reached through
    // a prop a component supplies, and it is document-wide rather than about the
    // copied snippet — a commit strands a draft held for any snippet of the file.
    // The prop says an editor is **open**, dirty or not (R36), and the sentence
    // drawn for it claims exactly that.
    const panel = mountDuplicator([], { draft: true });

    expect(says(panel.target, 'browser.matchDuplication.refused.unsavedDraftInDocument')).toBe(
      true
    );
    expect(says(panel.target, 'browser.matchDuplication.cannotDuplicate.notDuplicable')).toBe(
      true
    );
    expect(control(panel.target, 'browser.matchDuplication.duplicate').disabled).toBe(true);
    expect(panel.calls).toHaveLength(0);
    // Leaving is still offered: this is a refusal, not a trap.
    expect(control(panel.target, 'browser.matchDuplication.close').disabled).toBe(false);
    panel.stop();
  }); // End of the "unsaved draft in the document" case

  it('draws the frozen reason while the session is live', () => {
    // **The non-vacuity half of the case below.** A panel that never drew
    // `notDuplicable` at all would satisfy the suppression assertion trivially, so
    // the same fixture is asserted from both sides: here the session is live and
    // the reason is on screen, and there it is stale and the reason is gone.
    const locked = file({ readOnly: true });
    const panel = mountDuplicator([], { projection: locked, views: [locked] });

    expect(says(panel.target, 'browser.matchDuplication.refused.readOnly')).toBe(true);
    expect(says(panel.target, 'browser.matchDuplication.cannotDuplicate.notDuplicable')).toBe(
      true
    );
    expect(says(panel.target, 'browser.matchDuplication.cannotDuplicate.outOfDate')).toBe(false);
    panel.stop();
  }); // End of the "frozen reason while live" case

  it('draws the model answer and nothing beside it once the session is stale', () => {
    // **What this asserts is that the panel renders `notDuplicableToShow`**, not
    // that it decides anything: the precedence lives in `matchDuplicationView`
    // and `matchDuplication.test.ts` drives it there. Until step 3's review the
    // decision was here — the view handed out the frozen reason unconditionally
    // and a condition in the markup suppressed it — so this case is kept as the
    // rendered half of that rule: with the session stale the model answers
    // `null`, and what reaches the DOM is the weaker live sentence alone.
    const locked = file({ readOnly: true });
    const panel = mountDuplicator([], { projection: locked, views: [reread()] });

    expect(says(panel.target, 'browser.matchDuplication.cannotDuplicate.outOfDate')).toBe(true);
    expect(says(panel.target, 'browser.matchDuplication.refused.readOnly')).toBe(false);
    expect(says(panel.target, 'browser.matchDuplication.cannotDuplicate.notDuplicable')).toBe(
      false
    );
    expect(control(panel.target, 'browser.matchDuplication.duplicate').disabled).toBe(true);
    panel.stop();
  }); // End of the "suppressed frozen reason" case

  it('sends nothing when the window has replaced the projection under an open panel', async () => {
    // **The live-identity gate, reached through the control rather than through
    // `beginDuplicate` directly.** The session's own identity agrees with itself
    // however stale it is; the projections are the only argument that can notice
    // a re-read, and the panel takes the identity from them at the moment of the
    // click.
    const panel = mountDuplicator([{ result: COMMITTED }], { views: [reread()] });
    control(panel.target, 'browser.matchDuplication.duplicate').click();
    await settle();

    expect(panel.calls).toHaveLength(0);
    expect(says(panel.target, 'browser.matchDuplication.cannotDuplicate.outOfDate')).toBe(true);
    panel.stop();
  }); // End of the "projection replaced under the panel" case

  it('spends itself on a commit and offers a way out rather than another copy', async () => {
    const panel = mountDuplicator([{ result: COMMITTED }]);
    control(panel.target, 'browser.matchDuplication.duplicate').click();
    await settle();

    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(says(panel.target, 'browser.matchDuplication.duplicated')).toBe(true);
    // The command answered an identity, so the "cannot say where it is" sentence
    // is not drawn — the pair is what makes each of them mean something.
    expect(says(panel.target, 'browser.matchDuplication.duplicatedNotIdentified')).toBe(false);
    expect(control(panel.target, 'browser.matchDuplication.duplicate').disabled).toBe(true);
    expect(says(panel.target, 'browser.matchDuplication.cannotDuplicate.alreadyDuplicated')).toBe(
      true
    );
    // **A duplicate is not undo** (consult Q8): the only control offered after a
    // commit is a way out of the panel, never a way to take the copy back.
    expect(button(panel.target, 'browser.notice.dismiss')).toBeNull();

    control(panel.target, 'browser.matchDuplication.done').click();
    flushSync();
    expect(panel.closed()).toBe(1);
    panel.stop();
  }); // End of the "commit spends the session" case

  it('keeps the uncertainty when the command could not identify the copy', async () => {
    // **`moved: null` claims only what it claims** (review round 2's Medium): the
    // clone could not be identified in the read that followed the write, and the
    // causes are not exhaustible from here. The sentence must not assert a second
    // writer, and the copy is still reported as written.
    const panel = mountDuplicator([{ result: COMMITTED_UNLOCATED, adoption: ADOPTED }]);
    control(panel.target, 'browser.matchDuplication.duplicate').click();
    await settle();

    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(says(panel.target, 'browser.matchDuplication.duplicated')).toBe(true);
    expect(says(panel.target, 'browser.matchDuplication.duplicatedNotIdentified')).toBe(true);
    expect(control(panel.target, 'browser.matchDuplication.duplicate').disabled).toBe(true);
    panel.stop();
  }); // End of the "committed without an identity" case

  it('says the copy was written and the window is out of step, without contradicting itself', async () => {
    // The file really was written and this window really could not read it back,
    // so both sentences are true at once: the committed outcome, and the failure
    // *beside* it rather than in place of it (`PROGRESS.md` D2). Nothing here may
    // say the file was read again.
    const panel = mountDuplicator([{ result: COMMITTED, adoption: NOT_ADOPTED }]);
    control(panel.target, 'browser.matchDuplication.duplicate').click();
    await settle();

    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(true);
    expect(says(panel.target, 'browser.saveOutcome.windowOutOfStep')).toBe(true);
    expect(says(panel.target, 'browser.matchDuplication.duplicated')).toBe(true);
    // A committed duplicate is never afterwards reported as an error, so the way
    // out is still *Done* rather than a retry.
    expect(control(panel.target, 'browser.matchDuplication.duplicate').disabled).toBe(true);
    expect(control(panel.target, 'browser.matchDuplication.done').disabled).toBe(false);
    expect(panel.calls).toHaveLength(1);
    panel.stop();
  }); // End of the "failed adoption" case

  it('says nothing was written when the window refused before any command ran', async () => {
    const panel = mountDuplicator([]);
    control(panel.target, 'browser.matchDuplication.duplicate').click();
    await settle();

    expect(says(panel.target, 'browser.matchDuplication.sendFailed')).toBe(true);
    expect(says(panel.target, 'browser.matchDuplication.mayHaveWritten')).toBe(false);
    expect(says(panel.target, 'browser.saveOutcome.fileWritten')).toBe(false);
    // Nothing was sent, so nothing is spent: the panel goes on offering the copy.
    expect(control(panel.target, 'browser.matchDuplication.duplicate').disabled).toBe(false);
    panel.stop();
  }); // End of the "nothing attempted" case

  it('spends the session on a send that may already have written, and offers no re-read', async () => {
    // **The weakest claim wins.** After a `may_have_written` rejection this
    // application knows neither that the copy happened nor that it did not, so the
    // panel says exactly that — and it must not say `outOfDate`, whose sentence
    // claims *nothing has been written*, nor `alreadyDuplicated`, which is
    // definite.
    const panel = mountDuplicator([{ failure: AFTER_THE_RENAME, mayHaveWritten: true }]);
    control(panel.target, 'browser.matchDuplication.duplicate').click();
    await settle();

    expect(says(panel.target, 'browser.matchDuplication.mayHaveWritten')).toBe(true);
    expect(says(panel.target, 'browser.matchDuplication.cannotDuplicate.mayHaveWritten')).toBe(
      true
    );
    expect(says(panel.target, 'browser.matchDuplication.cannotDuplicate.outOfDate')).toBe(false);
    expect(
      says(panel.target, 'browser.matchDuplication.cannotDuplicate.alreadyDuplicated')
    ).toBe(false);
    // `mayHaveWritten` is `true` for one code and that code is not one a re-read
    // can help with, so no recovery is offered — which follows from the model
    // rather than being decided here.
    expect(button(panel.target, 'browser.matchDuplication.recovery.reloadFile')).toBeNull();
    expect(control(panel.target, 'browser.matchDuplication.duplicate').disabled).toBe(true);
    panel.stop();
  }); // End of the "may have written" case

  it('says why a re-read failed, and stops offering to send after it', async () => {
    const panel = mountDuplicator([{ failure: STALE_IDENTITY }], {
      reload: { kind: 'command', error: { code: 'unknownDocument', document: 2 } }
    });
    control(panel.target, 'browser.matchDuplication.duplicate').click();
    await settle();

    // The command said this window's address does not describe the file it read,
    // so the panel offers the one recovery — and until it is attempted the copy is
    // still sendable, because nothing was written.
    expect(control(panel.target, 'browser.matchDuplication.duplicate').disabled).toBe(false);

    control(panel.target, 'browser.matchDuplication.recovery.reloadFile').click();
    await settle();

    expect(panel.reloads()).toBe(1);
    expect(says(panel.target, 'browser.matchDuplication.reloadFailed')).toBe(true);
    // The recovery was offered because the window and the file disagree about an
    // address; a read that cannot reach the file leaves that standing with no way
    // to resolve it, so the session stops being sendable rather than going on
    // offering the same disputed identity.
    expect(says(panel.target, 'browser.matchDuplication.cannotDuplicate.outOfDate')).toBe(true);
    expect(control(panel.target, 'browser.matchDuplication.duplicate').disabled).toBe(true);

    control(panel.target, 'browser.matchDuplication.duplicate').click();
    await settle();
    expect(panel.calls).toHaveLength(1);
    panel.stop();
  }); // End of the "failed re-read" case
}); // End of the "mounted duplicate panel" suite

/** The workspace summary the state below is opened over; nothing reads it. */
const SUMMARY: WorkspaceSummary = {
  root: '/tmp/espanso',
  documents: 1,
  match_files: 1,
  config_profiles: 0,
  packages: 0,
  disabled: 0
};

describe('a duplicate panel over the real workspace state', () => {
  it('sends a plain identity, then reads the file again and sends nothing more', async () => {
    // **Three claims a stub cannot make.** `BrowserState.views` is `$state` and
    // therefore deeply proxied, so duplicating here is what proves the identities
    // reaching `draft.ts` are plain objects — `structuredClone` throws on a proxy,
    // and a model test cannot catch a repeat of that. The recovery really re-reads
    // through `BrowserState.rereadDocument`. And the panel's refusal afterwards is
    // the live-identity check working over a projection the state replaced on its
    // own, rather than over an array a test swapped.
    const refusal: CommandResult<never> = {
      ok: false,
      failure: { kind: 'command', error: { code: 'noWorkspaceOpen' } }
    };
    const commands: BrowserCommands = {
      openWorkspace: vi.fn(async (): Promise<CommandResult<WorkspaceSummary>> => {
        return { ok: true, value: SUMMARY };
      }),
      listDocuments: vi.fn(async (): Promise<CommandResult<readonly DocumentSummary[]>> => {
        return { ok: true, value: [FILE] };
      }),
      getDocument: vi.fn(async (): Promise<CommandResult<DocumentView>> => {
        return { ok: true, value: file() };
      }),
      getMatch: vi.fn(async (): Promise<CommandResult<MatchView>> => refusal),
      reloadDocument: vi.fn(async (): Promise<CommandResult<DocumentView>> => {
        return { ok: true, value: reread() };
      }),
      documentText: vi.fn(async (): Promise<CommandResult<string>> => refusal),
      moveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      saveMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      createMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      deleteMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => refusal),
      duplicateMatch: vi.fn(async (): Promise<CommandResult<SaveResult>> => {
        return { ok: false, failure: STALE_IDENTITY };
      }),
      saveRawDocument: vi.fn(async () => refusal)
    };
    const state: BrowserState = createBrowserState(commands, () => undefined);
    await state.open(null);

    const target = document.createElement('div');
    document.body.append(target);
    const component = mount(MatchDuplicator, {
      target,
      props: {
        projection: state.views[0]!,
        match: state.views[0]!.matches[0]!,
        file: FILE,
        projections: (): readonly DocumentView[] => state.views,
        unsavedDraftInDocument: (): boolean => false,
        duplicate: (
          id: MatchId,
          baseRevision: ContentRevision,
          acknowledgement: Acknowledgement
        ): Promise<MatchSaveAnswer> => state.duplicateMatch(id, baseRevision, acknowledgement),
        reload: (document: DocumentId): Promise<IpcFailure | null> =>
          state.rereadDocument(document),
        // **The window's own adoption**, which no case here reaches: the five match
        // surfaces declare `offersReload: false`, so no control that could spend a
        // confirmation is drawn. `matchDuplication.test.ts` drives the transition directly.
        adoptDiskVersion: (): DiskAdoptionOutcome => 'installed',
        close: (): void => undefined
      }
    });
    flushSync();

    // The `structuredClone` of an identity read straight out of a reactive
    // projection happens at `startMatchDuplication`; this is the line that proves
    // the value crossing the boundary came from it rather than from a literal.
    control(target, 'browser.matchDuplication.duplicate').click();
    await settle();

    expect(commands.duplicateMatch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(commands.duplicateMatch).mock.calls[0]![1]).toBe(BASE);
    expect(says(target, 'browser.matchDuplication.sendFailed')).toBe(true);

    control(target, 'browser.matchDuplication.recovery.reloadFile').click();
    await settle();

    // The state really replaced its own projection, and the panel noticed without
    // being told: everything it holds was minted from the parse that is gone.
    expect(commands.reloadDocument).toHaveBeenCalledTimes(1);
    expect(state.views[0]?.revision).toBe(AFTER);
    expect(says(target, 'browser.matchDuplication.cannotDuplicate.outOfDate')).toBe(true);
    expect(control(target, 'browser.matchDuplication.duplicate').disabled).toBe(true);

    control(target, 'browser.matchDuplication.duplicate').click();
    await settle();
    expect(commands.duplicateMatch).toHaveBeenCalledTimes(1);

    void unmount(component);
    target.remove();
  }); // End of the "duplicate over the real state" case
}); // End of the "duplicate panel over the real state" suite
