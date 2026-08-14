<script lang="ts">
  import {
    acknowledgeFindings,
    acknowledgementOf,
    askToReload,
    CONFLICT_CAPABILITIES,
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
    applySave,
    type RoundTripText
  } from '../browser/rawEditor';
  import type { RawSaveAnswer } from '../browser/workspace.svelte';
  import type { AdoptTheDiskVersion } from '../browser/editorSave';
  import type { RawSaveChoice } from '../browser/rawSave';
  import { outcomeReveal, type ConflictChoice } from '../browser/saveOutcome';
  import {
    t,
    tConflictChoice,
    tFindingCode,
    tPresentationNote,
    tRawEditorDiskRefusal,
    tRawEditorRefusal,
    tRawSaveChoice,
    tReloadUnavailable,
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
  import { copyReferenceText } from './clipboard';
  import RecoveryWithoutCreation from './RecoveryWithoutCreation.svelte';
  import { revealOutcome } from './reveal';
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
   * **No control here is called "keep my draft", and on this surface that is
   * permanent.** Since 2c-4b-3 the phrase names a real operation and five panels
   * draw it, and this one never will: `rawEditor.ts`'s `CONFLICT_CAPABILITIES`
   * declares `reapplySupport: 'unavailable'` — the consult's Q4 ruling that a
   * whole-document candidate has no target, no field intent and no operation to
   * re-resolve — so `conflictChoicesFor` names no reapply here whatever this
   * surface's `offersReapply` said. What is offered is *Keep editing*, *Copy my
   * text* and *Load the version on disk*, and 2c-4c owns the recovery this editor
   * is left with.
   *
   * **And what 2c-4c-3b made of that is one sentence and no new control.** The
   * consult's Q4 puts this editor **in** the recovery contract and **out** of
   * save-as-new: a whole document holds no match-shaped value to send to
   * `create_match`, there is no document-creation command, and V1 forbids both an
   * automatic merge and a stale overwrite. So `RecoveryPanel.svelte` is not mounted
   * here — every control in it is about a new snippet — and what is mounted instead
   * is `RecoveryWithoutCreation.svelte`, whose one sentence names the four things
   * this editor really does offer. **This surface is the reason that gate asks about the
   * conflict before it asks about the reapply**: `reapplySupport` is `unavailable`,
   * so a `manualResolution` is unreachable here and an entry condition written on one
   * would have silenced this sentence permanently.
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
   * **There is no `diskText` prop, and there was one until 2c-4a-2.** It carried
   * `browser.rawTextOf(id)` — a `RawDocumentText | null` from a *separate* read —
   * while `ConflictModel.diskText` is a `string` on the conflict payload. Two
   * different things under one name on one screen is how a wrong value gets drawn,
   * and a person reading this file has no type checker. The prop is gone; the disk
   * side is `view.diskText`, which is the conflict's own text paired with
   * `conflict.diskRevision` by the command layer.
   *
   * **`adoptDiskVersion` is what makes the reload one operation.** A conflict no
   * longer installs anything into the window (consult Q2), so confirming the reload
   * has to install the disk projection *and* reseed the draft; `loadDiskVersion`
   * does both, calling this prop itself, and nothing here can do one without the
   * other.
   */

  const {
    file,
    baseRevision,
    text,
    adoptDiskVersion,
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
     * Installs the disk observation a conflict carried into the window.
     *
     * `BrowserState.adoptDiskVersion`, which is the sole frontend transition that
     * moves this window to the disk side of a conflict. It is called by
     * `loadDiskVersion` and by nothing here, so the projection cannot be replaced
     * without the draft being reseeded in the same call — and a `refused` from it is
     * a refusal `loadDiskVersion` honours by reseeding nothing, while an
     * `alreadyThere` is a success it finishes on.
     */
    adoptDiskVersion: AdoptTheDiskVersion<RoundTripText>;
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

  /** The outcome panel's own element, so a reveal has something to point at. */
  let outcomePanel = $state<HTMLElement | null>(null);
  /** The conflict arm's row of controls, which is the second step's target. */
  let outcomeChoices = $state<HTMLElement | null>(null);

  /*
   * **The outcome panel’s appearance asks for a scroll into view** — 2c-4a-3c's
   * findings 10.3 and 10.4. The window reading measured every one of the six write
   * surfaces putting its controls below a 728 px fold with `section.detail`'s
   * `scrollTop` at `0` and nothing moving it; on the match editor the whole panel
   * was below it, so the sentence *Nothing was written* was invisible in English
   * and entirely absent from the screen in Spanish.
   *
   * The decision is `./reveal.ts`'s and the two `bind:this` targets are this
   * file's. A `$derived` cue rather than the outcome object itself, so the effect
   * re-runs when the *state* changes and not on every keystroke that leaves the
   * same panel up.
   */
  const reveal = $derived(
    outcomeReveal(view?.outcome?.kind ?? null, view?.awaitingReloadConfirmation ?? false)
  );
  $effect(() => {
    revealOutcome(reveal, outcomePanel, outcomeChoices);
  });

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
   * Adopts the version on disk and starts again from it.
   *
   * The confirmation is issued and spent in one handler because the *two steps
   * the person sees* are the warning and this click, not two clicks after the
   * warning. What the token still buys is that `reloadDiskVersion` refuses one
   * issued for a different conflict, which is checked in `rawEditor.test.ts`.
   *
   * **The workspace adoption is not performed here.** `loadDiskVersion` calls
   * `adoptDiskVersion` itself, after every check has passed, so a refused reload
   * cannot move the window and this handler cannot move it without reseeding.
   */
  function loadTheDiskVersion(): void {
    if (session === null) {
      return;
    }
    session = loadDiskVersion(confirmReload(session), adoptDiskVersion);
    copied = 'none';
  } // End of function loadTheDiskVersion()

  /**
   * Puts the draft on the clipboard, by whichever route this webview allows.
   *
   * **The routine moved to `./clipboard.ts` at 2c-4a-3a and this component no
   * longer carries its own copy of it.** It was duplicated the moment two more
   * surfaces needed the same *copy your text before discarding it* step, and a
   * second copy of a routine whose failure mode is silence is a second place for
   * it to be relaxed. What it does is unchanged: the asynchronous API first,
   * because it works everywhere else and needs no selection, then a selection
   * carrier, with every step of putting the screen back separately non-throwing.
   *
   * **The carriage-return refusal `copyReferenceText` adds cannot fire here**, and
   * saying so is the point: this editor refuses to open a text containing one at
   * all (`startRawEditor`), so the draft handed over never holds a `\r`. The rule
   * exists for the match editor, whose buffers can.
   *
   * **A refusal by both routes is still disclosed** — replacing an honest failure
   * with a silent one would be worse than the failure, and the read-only box above
   * holds the same bytes for a manual selection either way, which for *this*
   * surface is true because the box is a `<textarea>` holding the draft itself.
   */
  async function copyTheDraft(): Promise<void> {
    const value = session === null ? null : textToCopy(session);
    if (value === null) {
      return;
    }
    copied = (await copyReferenceText(value)) ? 'copied' : 'failed';
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
      case 'keepMyDraft':
        // Never offered here, and not because a boolean is `false`: this
        // surface's `reapplySupport` is permanently `unavailable`, and
        // `conflictChoicesFor` requires it to be `supported` before it will name
        // this choice. `rawEditor.reapplyToDiskVersion` takes no adoption
        // function at all, so there is nothing this arm could call. It exists so
        // the `switch` stays exhaustive and a sixth member of `ConflictChoice`
        // is a compile error here.
        return;
      case 'reloadDiskVersion':
        session = askToReload(session);
        return;
      case 'confirmReload':
        loadTheDiskVersion();
        return;
      case 'confirmReloadKeeping':
        // Never offered here: this surface's declared `reloadOutcome` is not
        // `retargetsCandidate`, and `conflictChoicesFor` names this second step
        // only for one that is. The arm exists so the `switch` stays exhaustive —
        // and it is a compile error until it is written, which is what made this
        // sixth member of `ConflictChoice` cheap to add (2c-5-4b).
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
          {tRawSaveChoice('keepEditing', CONFLICT_CAPABILITIES.draftKind)}
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

  <!-- What recovery is on a surface that cannot create: one sentence, in the place
       the two surfaces that *can* create draw their form, so all six say it in the
       same position. There is no control here — and no save-as-new anywhere on this
       screen — and its absence is the sentence. What the sentence *does* name —
       keep editing, copy, compare, reload — is above and below it.

       **Mounted unconditionally**: whether there is anything to say is the shared
       renderer's decision, taken from the conflict below, and not a condition this
       markup repeats. Four surfaces that each decided it for themselves is the
       finding this component closed. -->
  <RecoveryWithoutCreation kind="wholeDocumentText" conflict={view.conflict} />

  {#if view.outcome !== null}
    {@const outcome = view.outcome}
    <div class="panel" role="status" bind:this={outcomePanel}>
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
              {tRawSaveChoice(choice, CONFLICT_CAPABILITIES.draftKind)}
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
        <!-- Which arm is drawn is `conflictDiskText`'s decision and not this
             markup's since 2c-4a-3a: *an empty file is a fact about the file rather
             than a failure to obtain its text* — 2c-4a-1's D1 — was written into
             this renderer and then into two more, which is a semantic decision no
             suite carried. -->
        {#if view.diskText !== null && view.diskText.kind === 'text'}
          <SourceText text={view.diskText.text} documentStart />
        {:else}
          <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
        {/if}

        <!-- **The reload's own sentence, and not the opening refusal's** — 2c-4a-3c's
             finding 10.5. Both come from one `rawEditorRefusal` call over two
             different texts, and until this step both drew the same string, which
             ends *"it will not open this file for editing"*: the reason for a
             disabled **reload** confirmation, written about a **different** control,
             beside an editor that is already open over the person's own draft.
             `view.diskRefusal` was always a separate field from the opening refusal,
             so the second sentence cost a second accessor and nothing else. -->
        {#if view.diskRefusal !== null}
          <p class="marker warn">{tRawEditorDiskRefusal(view.diskRefusal)}</p>
        {/if}

        <!-- A control that has just gone, with the reason in its place: the reload
             is not offered again once the window has refused a spend, because the
             refusal came back with no word about its cause. That withholds a
             control; it claims nothing about how a later ask would be answered. -->
        {#if view.reloadUnavailable}
          <p class="kind">{tReloadUnavailable(CONFLICT_CAPABILITIES.draftKind)}</p>
        {/if}

        {#if copied === 'copied'}
          <p class="kind">{t('browser.rawEditor.draftCopied')}</p>
        {:else if copied === 'failed'}
          <p class="kind">{t('browser.rawEditor.draftCopyFailed')}</p>
        {/if}

        <p class="choices" bind:this={outcomeChoices}>
          {#each view.conflictChoices as choice (choice)}
            <button
              type="button"
              disabled={choice === 'confirmReload' && !view.canReload}
              onclick={() => conflictAction(choice)}
            >
              {tConflictChoice(choice, CONFLICT_CAPABILITIES.draftKind)}
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
