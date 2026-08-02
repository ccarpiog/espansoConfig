<script lang="ts">
  import {
    acknowledgeFindings,
    acknowledgementOf,
    askToReload,
    beginSave,
    confirmReload,
    editText,
    keepEditing,
    loadDiskVersion,
    rawEditorRefusal,
    rawEditorView,
    redoEdit,
    saveCouldNotBeSent,
    startRawEditor,
    textToCopy,
    undoEdit,
    applySave
  } from '../browser/rawEditor';
  import type { RawDocumentText } from '../browser/rawDocument';
  import type { RawSaveAnswer } from '../browser/workspace.svelte';
  import type { RawSaveChoice } from '../browser/rawSave';
  import type { ConflictChoice } from '../browser/saveOutcome';
  import {
    t,
    tConflictChoice,
    tFindingCode,
    tPresentationNote,
    tRawEditorRefusal,
    tRawSaveChoice,
    tRawSaveMessage,
    tSaveOutcomeMessage,
    tSaveVerdict
  } from '../i18n';
  import type {
    Acknowledgement,
    ContentRevision,
    DocumentId,
    DocumentSummary
  } from '../ipc/types';
  import SourceText from './SourceText.svelte';

  /*
   * The raw editor: one file's whole text, drafted and saved.
   *
   * **This file is presentation.** Every decision about what the editor may do,
   * what it says and when — dirtiness, undo, the acknowledgement round trip, the
   * three outcome arms, the terminal conflict state and its confirmed reload — is
   * in `../browser/rawEditor.ts`, which has a test suite. Nothing put here can be
   * checked by anything except a person looking at a window, which is why so
   * little is here.
   *
   * Eight things in the markup below are load-bearing and are not style.
   *
   * **The text area is controlled, not bound.** `value={view.text}` with an
   * `oninput` that hands the whole value to the model means the model is the only
   * thing that decides what the box holds — so undo, redo and a reload of the
   * disk version all take effect, and an edit the model refuses (during a save,
   * or during a conflict) does not.
   *
   * **The save control is gated on `view.canSave`**, which is `dirty` and nothing
   * else standing in the way. A clean draft has nothing to send: the save would be
   * legal — `committed: false` is a documented success — and it would still take
   * the write lock, reparse the file and open a backup batch for nothing.
   *
   * **The *Save anyway* control is withdrawn the moment the text changes.** The
   * findings a refusal carries are about **one exact candidate**, and the gate
   * matches them as an exact multiset against the suspicions of the text that is
   * actually sent. `view.refusalChoices` is what withdraws it, and
   * `browser.rawEditor.findingsAreStale` is what says why rather than leaving a
   * control to vanish silently.
   *
   * **The conflict panel offers *Copy draft* before the destructive choice, and
   * the destructive choice is two clicks.** Both are the split's requirements
   * (`docs/decisions/2c-split-notes.md` section 6) and both are the model's
   * ordering, not this file's: `view.conflictChoices` answers one list before the
   * warning and another after it.
   *
   * **No control here is called "keep my draft", in any language.** That phrase
   * means *reapply the draft to the newly parsed document*, which is Phase 2c-4b;
   * using the words for this weaker behaviour would make 2c-4b look already done.
   * What is offered is *Keep editing*, *Copy my text* and *Load the version on
   * disk*, which are the four `ConflictChoice` labels and no others.
   *
   * **A save that failed is never drawn as "nothing was written" unless it was.**
   * A failure at or after the rename may have left the candidate on disk, and the
   * boundary says so; `view.sendFailure` has two arms and the indeterminate one
   * gets its own sentence. Collapsing them would be `PROGRESS.md` D2 broken from
   * the other side — this application telling a person their file is untouched
   * when it may not be.
   *
   * **The editor cannot be left while a save is in flight.** The request is
   * already authorized and cannot be cancelled, so unmounting would leave it free
   * to commit with its outcome drawn nowhere. The close control is disabled and
   * `requestClose` refuses as well — a disabled control says *not now* where a
   * silent no-op says nothing — and a discard confirmation raised before a save
   * started is withdrawn when one does, because that dialog says the changes have
   * not been written.
   *
   * **`diskText` is the disk version of the *edited* file**, which is not the same
   * question as "what is the viewer showing". `DetailPane` answers it with
   * `browser.rawTextOf(id)`, so an editor open on one file keeps its *Reload disk
   * version* affordance when the rest of the window moves to another.
   */

  const {
    file,
    baseRevision,
    text,
    diskText,
    save,
    close
  }: {
    /** The file being edited. Its path is what tells the person which one it is. */
    file: DocumentSummary;
    /** The revision its text was read at, and the base every save sends. */
    baseRevision: ContentRevision;
    /** Its whole text, as `document_text` answered it. */
    text: string;
    /**
     * What the *workspace* now holds for this file's text, or `null`.
     *
     * **This is the disk version, and it is not the draft.** On a conflict the
     * workspace refreshes its own projection and re-reads the file, so this
     * becomes the bytes some other writer left — which is exactly what the
     * conflict state has to show and to offer to load. It is passed *in* rather
     * than read from the draft precisely so that the two cannot be confused: the
     * draft lives in the session and nothing here writes to it from this prop.
     */
    diskText: RawDocumentText | null;
    /**
     * Sends one save.
     *
     * Answers a **sealed** outcome, so this component cannot learn anything about
     * the save without discharging the invalidation — which `applySave` does — or
     * a typed failure that says whether the file may already have been written.
     *
     * @param document - The file to replace.
     * @param baseRevision - The revision the text was drafted from.
     * @param text - The whole new text.
     * @param acknowledgement - The suspicions already shown to a person.
     * @returns The sealed outcome, or the failure.
     */
    save: (
      document: DocumentId,
      baseRevision: ContentRevision,
      text: string,
      acknowledgement: Acknowledgement
    ) => Promise<RawSaveAnswer>;
    /** Leaves the editor. */
    close: () => void;
  } = $props();

  // `$state.raw`, not `$state`: a session is an immutable value replaced whole on
  // every transition, and its draft holds deep-frozen snapshots that a reactive
  // proxy has no business walking.
  //
  // **Capturing the initial values is the whole point**, which is why the warning
  // is suppressed rather than designed around. A draft that re-derived itself from
  // its props would be discarded every time the workspace re-read the file — which
  // it does after every committed save and after every conflict. The three props
  // are read once, here, and the session owns the text from then on.
  // svelte-ignore state_referenced_locally
  let session = $state.raw(startRawEditor(file.id, baseRevision, text));
  const view = $derived(session === null ? null : rawEditorView(session));

  /**
   * Why this text will not be edited at all, or `null`.
   *
   * `session === null` **is** the refusal — `startRawEditor` answers that and
   * nothing else for a text it cannot hold unchanged — and this is the reason to
   * put on screen beside it. `DetailPane` withdraws the *Edit* control for the same
   * texts, so in the running application this branch is a second gate rather than
   * the first; it is here because a component that could be mounted into a dead end
   * should say so rather than draw an empty box.
   */
  // svelte-ignore state_referenced_locally
  const refusal = rawEditorRefusal(text);

  /** What became of the last *Copy my text*, so the person is told either way. */
  let copied = $state<'none' | 'copied' | 'failed'>('none');
  /** Whether leaving the editor is waiting on a confirmation. */
  let leaving = $state(false);

  /**
   * Sends the draft, optionally accepting the findings on screen first.
   *
   * The acknowledgement is never assembled here: `acknowledgeFindings` records
   * consent through the one function that can, and `beginSave` reads it back
   * through `submissionOf`, so what goes to the boundary is consent bound to the
   * exact candidate being sent or nothing at all.
   *
   * @param acknowledge - Whether this is the *Save anyway* control.
   */
  async function runSave(acknowledge: boolean): Promise<void> {
    if (session === null) {
      return;
    }
    const consented = acknowledge ? acknowledgeFindings(session) : session;
    const started = beginSave(consented);
    if (started === null) {
      return;
    }
    session = started.session;
    copied = 'none';
    // A leaving confirmation raised before the save started is about a question
    // this save has just answered differently, and leaving is refused for as long
    // as one is in flight anyway.
    leaving = false;
    const answer = await save(
      file.id,
      started.submission.baseRevision,
      started.submission.candidate,
      acknowledgementOf(started.submission)
    );
    session =
      answer.kind === 'sealed'
        ? applySave(session, answer.sealed)
        : saveCouldNotBeSent(session, answer.mayHaveWritten);
  } // End of function runSave()

  /**
   * The disk version's text, or `null` when it cannot be had.
   *
   * A file of zero characters is a text of zero characters, not an absence: the
   * `empty` arm is a fact about the file and reloading it is a legitimate thing to
   * ask for.
   *
   * @returns The text, or `null` when the workspace has none to give.
   */
  function diskVersionText(): string | null {
    if (diskText === null) {
      return null;
    }
    if (diskText.kind === 'text') {
      return diskText.text;
    }
    return diskText.kind === 'empty' ? '' : null;
  } // End of function diskVersionText()

  /**
   * Why the version on disk cannot be loaded into this editor, or `null`.
   *
   * The same refusal that keeps the editor from opening a file with carriage
   * returns, applied to the one other way a text can enter a session. It is drawn
   * beside the disk version rather than hidden, because the disk version is still
   * *shown* — `SourceText` names a carriage return rather than dropping it — and a
   * control that simply did nothing would read as a bug.
   */
  const diskRefusal = $derived.by(() => {
    const disk = diskVersionText();
    return disk === null ? null : rawEditorRefusal(disk);
  });

  /**
   * Discards the draft and starts again from the version on disk.
   *
   * The confirmation is issued and spent in one handler because the *two steps
   * the person sees* are the warning and this click, not two clicks after the
   * warning. What the token still buys is that `reloadDiskVersion` refuses one
   * issued for a different conflict, which is checked in `rawEditor.test.ts`.
   */
  function loadTheDiskVersion(): void {
    const conflict = view?.conflict ?? null;
    const disk = diskVersionText();
    if (session === null || conflict === null || disk === null) {
      return;
    }
    session = loadDiskVersion(confirmReload(session), conflict.diskRevision, disk);
    copied = 'none';
  } // End of function loadTheDiskVersion()

  /**
   * What was focused and selected before the carrier took both.
   *
   * Two kinds, because the platform has two: a form control carries its own
   * selection offsets, and everything else carries document ranges. Restoring only
   * the focused element — which the first version did — puts the caret back at the
   * start of whatever the person had highlighted.
   */
  interface SelectionSnapshot {
    /** The element that had focus, or `null`. */
    readonly element: HTMLElement | null;
    /** The focused form control's selection offsets, when it had them. */
    readonly offsets: { readonly start: number; readonly end: number } | null;
    /** The document's own selection ranges, cloned so nothing aliases them. */
    readonly ranges: readonly Range[];
  }

  /**
   * Runs one step of putting the screen back, and swallows its failure.
   *
   * Named rather than inlined so that "this must not throw" is a property a reader
   * can see at every call site instead of a `try` block they have to read past.
   *
   * @param step - The restoration step to attempt.
   */
  function quietly(step: () => void): void {
    try {
      step();
    } catch {
      // Cleanup that fails is not worth an error the person cannot act on: what
      // matters is that the answer still reaches the screen.
    }
  } // End of function quietly()

  /**
   * Records what has focus and what is selected, before either is taken away.
   *
   * @returns The snapshot, empty rather than throwing when the platform refuses any
   *   part of the question — `selectionStart` throws on some input types.
   */
  function captureSelection(): SelectionSnapshot {
    const active = document.activeElement;
    const element = active instanceof HTMLElement ? active : null;
    let offsets: { readonly start: number; readonly end: number } | null = null;
    quietly(() => {
      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        const start = element.selectionStart;
        const end = element.selectionEnd;
        if (start !== null && end !== null) {
          offsets = { start, end };
        }
      }
    });
    const ranges: Range[] = [];
    quietly(() => {
      const selection = document.getSelection();
      for (let index = 0; index < (selection?.rangeCount ?? 0); index += 1) {
        const range = selection?.getRangeAt(index);
        if (range !== undefined) {
          ranges.push(range.cloneRange());
        }
      } // End of the loop over the document's selection ranges
    });
    return { element, offsets, ranges };
  } // End of function captureSelection()

  /**
   * Puts focus and the selection back where {@link captureSelection} found them.
   *
   * Three independent steps, each swallowed on its own: a focus that will not
   * return must not stop the offsets being restored, and neither must stop the
   * caller answering.
   *
   * @param snapshot - What was there before.
   */
  function restoreSelection(snapshot: SelectionSnapshot): void {
    const element = snapshot.element;
    if (element !== null) {
      quietly(() => element.focus({ preventScroll: true }));
    }
    const offsets = snapshot.offsets;
    if (
      offsets !== null &&
      (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)
    ) {
      quietly(() => element.setSelectionRange(offsets.start, offsets.end));
      return;
    }
    if (snapshot.ranges.length === 0) {
      return;
    }
    quietly(() => {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      for (const range of snapshot.ranges) {
        selection?.addRange(range);
      } // End of the loop over the ranges that were there before
    });
  } // End of function restoreSelection()

  /**
   * Copies one text by selecting it in a carrier text area.
   *
   * **A second route, because the first one was seen to fail and it is not known
   * why.** The 2c-1b window reading saw `navigator.clipboard.writeText` rejected
   * with `NotAllowedError` — but the re-take established that the machine's screen
   * was locked and `document.hasFocus()` was false throughout, and both clipboard
   * routes are gated on a focused document, so **whether the shipped WKWebView
   * refuses `navigator.clipboard` is unsettled** (notes sections 9.11.4 and 8.12);
   * settling it needs a human at an unlocked machine. What stands on its own is
   * that the conflict's *copy your text before discarding it* step should not rest
   * on a single route: `document.execCommand('copy')` over a real selection needs
   * neither a permission prompt nor a new dependency — deliberately not
   * `@tauri-apps/plugin-clipboard-manager`, which would be a dependency plus Rust.
   *
   * The carrier is offscreen rather than `hidden` or `display: none`: an element
   * that is not rendered cannot hold a selection, which is the usual way this
   * fallback is written and does nothing.
   *
   * **It always answers a boolean, and every step of putting the screen back is
   * separately non-throwing.** That is the second review pass's finding: the first
   * version restored focus in an unguarded `finally`, so a throw there escaped the
   * whole function, the caller's assignment never ran, and the person got **no**
   * disclosure at all — neither success nor failure — on the one control that
   * exists to keep a draft from being lost. Silence is the worst answer this path
   * can give, so nothing in the cleanup is allowed to produce it.
   *
   * @param value - The text to put on the clipboard.
   * @returns `true` when the copy command reported success, `false` for every other
   *   ending including a failure of the cleanup itself.
   */
  function copyBySelecting(value: string): boolean {
    const before = captureSelection();
    const carrier = document.createElement('textarea');
    let copied = false;
    try {
      // A text area normalizes carriage returns in its value — which is the whole
      // reason this editor refuses to hold a text that has any — so nothing that
      // reaches here can be changed by passing through one.
      carrier.value = value;
      carrier.setAttribute('aria-hidden', 'true');
      carrier.style.position = 'fixed';
      carrier.style.top = '-1000px';
      carrier.style.opacity = '0';
      document.body.append(carrier);
      carrier.focus({ preventScroll: true });
      carrier.select();
      carrier.setSelectionRange(0, carrier.value.length);
      copied = typeof document.execCommand === 'function' && document.execCommand('copy');
    } catch {
      copied = false;
    }
    // Outside the `try`, and each half guarded on its own, so a carrier that will
    // not detach cannot stop focus being restored and neither can stop the answer.
    quietly(() => carrier.remove());
    restoreSelection(before);
    return copied;
  } // End of function copyBySelecting()

  /**
   * Puts the draft on the clipboard, by whichever route this webview allows.
   *
   * The asynchronous API first, because it is the one that works everywhere else
   * and needs no selection; the selection fallback when it rejects or is absent.
   * **A refusal by both is still disclosed** — replacing an honest failure with a
   * silent one would be worse than the failure, and the read-only box above holds
   * the same bytes for a manual selection either way.
   */
  async function copyTheDraft(): Promise<void> {
    const value = session === null ? null : textToCopy(session);
    if (value === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      copied = 'copied';
      return;
    } catch {
      // Refused, or absent outside a secure context. Fall through.
    }
    copied = copyBySelecting(value) ? 'copied' : 'failed';
  } // End of function copyTheDraft()

  /**
   * Records what the text area now holds.
   *
   * A named handler rather than an expression in the markup, so the guard on a
   * refused text lives beside the other seven and TypeScript can see it.
   *
   * @param value - The text area's whole value.
   */
  function onTyped(value: string): void {
    if (session !== null) {
      session = editText(session, value);
    }
  } // End of function onTyped()

  /** Goes back one step. */
  function onUndo(): void {
    if (session !== null) {
      session = undoEdit(session);
    }
  } // End of function onUndo()

  /** Goes forward one step. */
  function onRedo(): void {
    if (session !== null) {
      session = redoEdit(session);
    }
  } // End of function onRedo()

  /** Puts the outcome panel away and gives the box back. */
  function onDismiss(): void {
    if (session !== null) {
      session = keepEditing(session);
    }
  } // End of function onDismiss()

  /**
   * Does what one conflict choice says.
   *
   * @param choice - The choice the person picked.
   */
  function conflictAction(choice: ConflictChoice): void {
    if (session === null) {
      return;
    }
    switch (choice) {
      case 'keepEditing':
        session = keepEditing(session);
        copied = 'none';
        return;
      case 'copyDraft':
        void copyTheDraft();
        return;
      case 'reloadDiskVersion':
        session = askToReload(session);
        return;
      case 'confirmReload':
        loadTheDiskVersion();
        return;
    }
  } // End of function conflictAction()

  /**
   * Does what one refusal choice says.
   *
   * @param choice - The choice the person picked.
   */
  function refusalAction(choice: RawSaveChoice): void {
    if (choice === 'saveAnyway') {
      void runSave(true);
      return;
    }
    if (session !== null) {
      session = keepEditing(session);
    }
  } // End of function refusalAction()

  /**
   * Leaves the editor, asking first when there is unsaved text to lose.
   *
   * **Refused outright while a save is in flight.** The request has already been
   * authorized and cannot be cancelled; unmounting the editor would leave it free
   * to commit with its outcome drawn nowhere, under a dialog that had just said
   * the changes were not written. That is the 2c-1b review's fourth finding, and
   * the control is disabled for the same reason rather than only guarded here — a
   * disabled control says *not now*, where a silent no-op says nothing.
   */
  function requestClose(): void {
    if (view === null) {
      // Nothing was ever drafted, so there is nothing to lose and nothing to ask.
      close();
      return;
    }
    if (view.saving) {
      return;
    }
    if (view.dirty) {
      leaving = true;
      return;
    }
    close();
  } // End of function requestClose()

  /** Leaves the editor, discarding the draft. Refused while a save is in flight. */
  function discardAndClose(): void {
    if (view !== null && view.saving) {
      return;
    }
    close();
  } // End of function discardAndClose()
</script>

<section class="rawEditor" aria-label={t('browser.rawEditor.label')}>
  <div class="head">
    <dl>
      <dt>{t('browser.detail.file')}</dt>
      <dd class="source">{file.relative_path}</dd>
    </dl>
    {#if view !== null && view.dirty}
      <span class="marker warn">{t('browser.rawEditor.unsaved')}</span>
    {/if}
    <button
      type="button"
      disabled={view !== null && view.saving}
      onclick={() => requestClose()}
    >
      {t('browser.rawEditor.close')}
    </button>
  </div>

  {#if view === null}
    <!-- The refusal, and nothing else: no box, no save control, no draft. A text
         this editor cannot give back unchanged is not opened at all, which is the
         only way to keep the project's central promise on the one screen that can
         write. `rawEditor.ts`'s own note names the alternative that was refused. -->
    <p class="panel">
      {refusal === null
        ? t('browser.rawEditor.notProjected')
        : tRawEditorRefusal(refusal)}
    </p>
  {:else}
  {#if view.saving}
    <p class="kind">{t('browser.rawEditor.savingCannotBeStopped')}</p>
  {/if}

  {#if leaving}
    <div class="panel">
      <p>{t('browser.rawEditor.discardWarning')}</p>
      <p class="choices">
        <button type="button" disabled={view.saving} onclick={() => discardAndClose()}>
          {t('browser.rawEditor.discard')}
        </button>
        <button type="button" onclick={() => (leaving = false)}>
          {tRawSaveChoice('keepEditing')}
        </button>
      </p>
    </div>
  {/if}

  {#each view.rawSave.messages as message, index (index)}
    <p class="kind">{tRawSaveMessage(message)}</p>
  {/each}

  <textarea
    class="text"
    aria-label={t('browser.rawEditor.label')}
    spellcheck="false"
    readonly={!view.editable}
    value={view.text}
    oninput={(event) => onTyped(event.currentTarget.value)}
  ></textarea>

  <p class="choices">
    <button type="button" disabled={!view.canUndo} onclick={() => onUndo()}>
      {t('browser.rawEditor.undo')}
    </button>
    <button type="button" disabled={!view.canRedo} onclick={() => onRedo()}>
      {t('browser.rawEditor.redo')}
    </button>
    <button type="button" disabled={!view.canSave} onclick={() => void runSave(false)}>
      {t('browser.rawEditor.save')}
    </button>
    {#if view.saving}
      <span class="marker">{t('browser.rawEditor.saving')}</span>
    {/if}
  </p>

  {#if view.sendFailure !== null}
    <p class="panel">
      {view.sendFailure.kind === 'mayHaveWritten'
        ? t('browser.rawEditor.mayHaveWritten')
        : t('browser.rawEditor.sendFailed')}
    </p>
  {/if}

  {#if view.outcome !== null}
    {@const outcome = view.outcome}
    <div class="panel" role="status">
      {#each view.messages as message, index (index)}
        <p>{tSaveOutcomeMessage(message)}</p>
      {/each}

      {#if outcome.kind === 'saved'}
        {#if view.notes.length > 0}
          <p class="kind">{t('browser.rawEditor.notes')}</p>
          <ul>
            {#each view.notes as note, index (index)}
              <li>{tPresentationNote(note)}</li>
            {/each}
          </ul>
        {/if}
        <p class="choices">
          <button type="button" onclick={() => onDismiss()}>
            {t('browser.notice.dismiss')}
          </button>
        </p>
      {:else if outcome.kind === 'refused'}
        <p class="kind">{tSaveVerdict(outcome.verdict)}</p>
        {#if view.rawSave.otherFindings.length > 0}
          <p class="kind">{t('browser.rawEditor.findings')}</p>
          <ul>
            {#each view.rawSave.otherFindings as finding, index (index)}
              <li>{tFindingCode(finding.code)}</li>
            {/each}
          </ul>
        {/if}
        {#if view.findingsAreStale}
          <p class="kind">{t('browser.rawEditor.findingsAreStale')}</p>
        {/if}
        <p class="choices">
          {#each view.refusalChoices as choice (choice)}
            <button type="button" onclick={() => refusalAction(choice)}>
              {tRawSaveChoice(choice)}
            </button>
          {/each}
        </p>
      {:else}
        {@const conflict = outcome}
        <p class="kind">{t('browser.rawEditor.revisionExpected', { revision: conflict.expected })}</p>
        <p class="kind">{t('browser.rawEditor.revisionFound', { revision: conflict.found })}</p>
        <p class="kind">
          {t('browser.rawEditor.revisionDisk', { revision: conflict.diskRevision })}
        </p>

        <h3>{t('browser.rawEditor.diskVersion')}</h3>
        {#if diskText !== null && diskText.kind === 'text'}
          <SourceText text={diskText.text} documentStart />
        {:else if diskText !== null && diskText.kind === 'empty'}
          <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
        {:else}
          <p class="marker warn">{t('browser.rawEditor.diskVersionUnavailable')}</p>
        {/if}

        {#if diskRefusal !== null}
          <p class="marker warn">{tRawEditorRefusal(diskRefusal)}</p>
        {/if}

        {#if copied === 'copied'}
          <p class="kind">{t('browser.rawEditor.draftCopied')}</p>
        {:else if copied === 'failed'}
          <p class="kind">{t('browser.rawEditor.draftCopyFailed')}</p>
        {/if}

        <p class="choices">
          {#each view.conflictChoices as choice (choice)}
            <button
              type="button"
              disabled={choice === 'confirmReload' &&
                (diskVersionText() === null || diskRefusal !== null)}
              onclick={() => conflictAction(choice)}
            >
              {tConflictChoice(choice)}
            </button>
          {/each}
        </p>
      {/if}
    </div>
  {/if}
  {/if}
</section>

<style>
  .rawEditor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 0;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
    margin: 0;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  h3 {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  /* The file's own text, in the face that means "this is what the document
     holds" (`src/app.css`) — the same one `SourceText` uses, because this box
     and that box show the same kind of thing. `white-space: pre` rather than a
     wrap, for `SourceText`'s reason: a soft wrap is indistinguishable from a
     line break the file does not contain. */
  .text {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    white-space: pre;
    overflow: auto;
    min-height: 14rem;
    resize: vertical;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    color: inherit;
  }

  .text[readonly] {
    color: var(--muted);
  }

  .source {
    font-family: var(--font-mono);
  }

  button {
    font: inherit;
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
  }

  button:disabled {
    color: var(--muted);
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
    margin: 0;
  }

  /* Anything this app says about a save rather than about the file: the three
     outcome arms, the leaving warning, a send that never left. Bordered like the
     detail pane's `.refused` and `.blocked` because it is the same kind of
     statement. */
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin: 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    font-size: 0.8125rem;
  }

  .panel p {
    margin: 0;
  }

  ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .kind {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .marker {
    font-size: 0.6875rem;
    color: var(--muted);
  }

  .warn {
    padding: 0 0.25rem;
    border: 1px solid var(--border);
    border-radius: 4px;
  }
</style>
