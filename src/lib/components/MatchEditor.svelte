<script lang="ts">
  import {
    acknowledgeFindings,
    acknowledgementOf,
    applySave,
    askToReloadDiskVersion,
    baseRevisionOf,
    beginSave,
    confirmDiskReload,
    editField,
    focusField,
    keepEditing,
    matchEditorView,
    redoEdit,
    reloadTheDiskVersion,
    removeField,
    restoreField,
    saveCouldNotBeSent,
    startMatchEditor,
    type Clock,
    type EditableField,
    type Reprojection,
    undoEdit
  } from '../browser/matchEditor';
  import type { AdoptTheDiskVersion } from '../browser/editorSave';
  import type { MatchBuffers } from '../browser/matchEditor';
  import type { ConflictChoice } from '../browser/saveOutcome';
  import type { RawSaveChoice } from '../browser/rawSave';
  import type { MatchSaveAnswer } from '../browser/workspace.svelte';
  import { copyReferenceText } from './clipboard';
  import {
    t,
    tConflictChoice,
    tDetailField,
    tDraftCopy,
    tDraftError,
    tDraftFieldStatus,
    tEditError,
    tFieldRefusal,
    tFindingCode,
    tHazard,
    tIpcFailure,
    tOptionGroup,
    tPresentationNote,
    tRawSaveChoice,
    tReprojectionRefusal,
    tSaveError,
    tSaveOutcomeMessage,
    tSaveVerdict,
    tValueKind
  } from '../i18n';
  import type {
    Acknowledgement,
    ContentRevision,
    DocumentSummary,
    MatchDraft,
    MatchId,
    MatchView
  } from '../ipc/types';
  import SourceText from './SourceText.svelte';

  /*
   * The small editor: one snippet's six editable fields, drafted and saved.
   *
   * **This file is presentation.** Every decision about what may be edited, what
   * a draft means, when a save may start, what it says and what a commit moves is
   * in `../browser/matchEditor.ts`, which has a test suite. This is a walk over
   * `matchEditorView`'s answer, and the deliberate smallness of it is the reason
   * the seven findings of the 2c-2 review were reachable without a screen at all.
   *
   * The bolded paragraphs below are the things in this markup that are
   * load-bearing rather than style. **Deliberately not counted**: this comment
   * said *seven* over nine of them, which is the same documentation-versus-code
   * mismatch this sub-phase spent its length hunting, in miniature — and a number
   * here goes stale the next time one is added.
   *
   * **Every control is controlled, not bound.** `value={field.text}` with an
   * `oninput` that hands the whole value to the model means the model is the only
   * thing that decides what a box holds — so undo, redo and a rebase after a save
   * all take effect, and an edit the model refuses (during a save, during a
   * conflict, on a field the projection ruled out) does not.
   *
   * **A field the projection refused draws no control at all, and shows its value
   * wherever there is one.** The consult's Q5 asked for read-only rather than
   * disabled: the value stays selectable and the reason is beside it. Such a value
   * goes through `SourceText`, the only rendering surface in this application that
   * *names* a character no font draws. That matters most for a value holding a
   * real carriage return, which a `<textarea>` would draw as an ordinary line
   * break — measured, not assumed: in this application's WKWebView a `<textarea>`
   * turns `"x\ry\r\nz"` into `"x\ny\nz"` and an `<input>` **deletes** the
   * character outright, `"p\rq"` becoming `"pq"`
   * (`docs/decisions/2c-2-2-window-reading.md` §6). So a box would misdraw the
   * file even while refusing to write to it; through `SourceText` the carriage
   * return is a visible marker instead.
   *
   * **What it shows is `field.shown`, which is a list, and each entry may name the
   * key it came from.** The window reading's first finding was that this drew
   * `field.text` — one scalar — so a snippet firing from a `triggers:` list drew a
   * name and a reason and nothing between them, and its triggers appeared nowhere
   * in the window, because this editor replaces the whole detail pane. Its second
   * was that a `Several` then drew two identical unlabelled boxes, one from
   * `trigger:` and one from `regex:`, with the pane that distinguishes them
   * off-screen. The order the entries come in, and why `tTriggerKind` is not the
   * accessor for the label, are both `shownValuesOf`'s to state. `ownsNoBytes`
   * still shows nothing, and that is right: its span is zero-width, so the file
   * holds no value there to show.
   *
   * **The three word-boundary fields are three text boxes and none of them is a
   * checkbox.** D2u: this application shows a scalar's source text as written and
   * never an inferred type, and a checkbox over `word` would have to decide that
   * `on`, `yes` and `true` mean the same thing. The heading above them is
   * `tOptionGroup('matching')`, which is the detail pane's own name for the group;
   * `field.field === 'word'` is where the group starts because `EDITABLE_FIELDS`
   * puts the three boundary keys last, in that order.
   *
   * **An absent key says so, in the box that would create it.** The phase's named
   * failure is a draft-versus-projection mistake, and the one rule that pays for
   * the whole arrangement — an initially absent field left blank writes nothing —
   * is invisible unless the screen says which keys the file does not have. It is a
   * sentence under the box rather than a placeholder inside it, because a
   * placeholder is indistinguishable from a value at a glance.
   *
   * **A save that produced no outcome shows *why*, not only *whether*.**
   * `view.failureLines` is the chain — the rejection, then a refused draft's
   * `DraftError`, or a failed save's `SaveError` and the `EditError` under its
   * `Patch` arm. Those sentences existed from Phase 2b-1 and had never been drawn:
   * `save_match`'s commonest rejection is `draftRefused`, which is a validation
   * answer naming a field rather than an infrastructure failure, and it belongs
   * beside the field the person was editing.
   *
   * **A committed save whose adoption failed is drawn as a success with a second
   * line.** `view.messages` is the outcome's own lines followed by anything to be
   * said beside them, and *the window is out of step* is one of those. The file
   * was written (`PROGRESS.md` D2); telling the person the save failed would
   * invite a retry of a write that already happened.
   *
   * **A committed save offers a re-seed and no *Dismiss*.** The model stops
   * accepting changes until a fresh projection has been seeded, and no transition
   * in it clears that — so a *Dismiss* here would draw a control that puts the
   * obligation out of sight without discharging it, which is exactly the defect
   * the 2c-2-2 review found. When this window cannot answer the re-seed the
   * control is disabled with the reason beside it, never absent.
   *
   * **The editor cannot be left while a save is in flight**, for 2c-1b's reason:
   * the request is authorized and cannot be cancelled, so unmounting would leave
   * it free to commit with its outcome drawn nowhere.
   *
   * **The conflict panel shows two sides and identifies nothing across them.** The
   * retained draft comes from `view.retainedDraft` — the model's walk over the
   * *conflict's own* buffers — and the disk side is `conflict.diskText`, the whole
   * file as the command layer read it, through `SourceText`. There is no attempt
   * anywhere here to find "the same snippet" in the disk version, and there must
   * not be: `MatchId` carries a revision and a parse-local node number, so
   * matching by index, trigger or projected field would silently pick the wrong
   * snippet after an external insertion or reorder. That is 2c-4b's confidence
   * work (consult Q5). The confirmed reload therefore closes this editor rather
   * than reseeding it, and the sentence at the confirmation step says so.
   */

  const {
    match,
    file,
    save,
    reproject,
    adoptDiskVersion,
    close,
    clock = () => Date.now()
  }: {
    /** The snippet being edited, exactly as this window projects it. */
    match: MatchView;
    /** The file it lives in, for the person to see which one it is. */
    file: DocumentSummary | null;
    /**
     * Sends one save.
     *
     * **`BrowserState.saveMatch` and nothing else.** That method performs the
     * identity adoption a committed field save owes, before the answer is handed
     * back; `saveMatch` in `../ipc/commands` is the same call without it, and a
     * component that reached for it would succeed once and then hold a stale
     * identity for every later edit, save and selection lookup. Nothing in
     * TypeScript stops that, which is why it is written here.
     *
     * **The base revision is the session's own and is handed over explicitly**,
     * which is the last half of the 2c-3a-1 review's second finding. The wrapper
     * used to read its own projection's revision at the moment of the call, so an
     * editor opened at one revision over a window that had since re-read the file
     * was submitted as though it had been drafted at the newer one — and the core
     * found no conflict to report. `baseRevisionOf` is the read; nothing between
     * here and `save_match` substitutes another, and no signature can require this
     * argument to be the session's rather than the window's.
     *
     * @param id - The snippet to save, by the identity drafted against.
     * @param draft - What the snippet should say, as a whole.
     * @param baseRevision - The revision the draft was seeded from.
     * @param acknowledgement - The suspicions already shown to a person.
     * @returns The outcome and the adoption's fate, or a typed failure.
     */
    save: (
      id: MatchId,
      draft: MatchDraft,
      baseRevision: ContentRevision,
      acknowledgement: Acknowledgement
    ) => Promise<MatchSaveAnswer>;
    /**
     * The freshly projected snippet of one identity, or why there is none.
     *
     * What `MatchEditorView.needsReprojection` asks for. A commit rebases the
     * baselines on what was *written*, which is right about presence and values
     * and says nothing about the new scalars' spelling, spans or decodability —
     * so eligibility is the one thing only a re-projection can refresh. It takes
     * the identity rather than answering "the selected snippet", because a person
     * who clicked elsewhere while the save was in flight must not have this
     * editor re-seeded from a different snippet.
     *
     * **It answers a reason, never a bare `null`.** A refusal becomes a sentence
     * on screen, and the one sentence this replaced named a single cause — *the
     * window is no longer showing the file* — which is false when the person
     * selected another snippet **in that same file**, and false again when a
     * commit's adoption failed.
     *
     * @param id - The identity to look for, as the session now holds it.
     * @returns The projection, or the reason this window has none for it.
     */
    reproject: (id: MatchId) => Reprojection;
    /** Leaves the editor. */
    /**
     * Installs the disk observation a conflict carried into the window.
     *
     * `BrowserState.adoptDiskVersion`, the sole frontend transition that moves
     * this window to the disk side of a conflict. It is called by
     * `reloadTheDiskVersion` and by nothing here, so the projection cannot be
     * replaced without this editor closing in the same call — and a `refused` from
     * it is honoured by closing nothing, while an `alreadyThere` is a success the
     * transition finishes on.
     */
    adoptDiskVersion: AdoptTheDiskVersion<MatchBuffers>;
    close: () => void;
    /**
     * Where the typing group's boundary readings come from.
     *
     * **The model has no default and this does**, which is the difference between
     * a rule and a wiring. `startMatchEditor` refuses to name `Date.now` because a
     * boundary decided by real time is a boundary no test can drive; this is the
     * one place in the running application that supplies it, and a test that wants
     * to drive the boundary passes its own.
     */
    clock?: Clock;
  } = $props();

  // `$state.raw`, not `$state`: a session is an immutable value replaced whole on
  // every transition, and its draft holds deep-frozen snapshots a reactive proxy
  // has no business walking.
  //
  // **Capturing the initial projection is the whole point**, which is why the
  // warning is suppressed rather than designed around. A session that re-derived
  // itself from its prop would be discarded every time the workspace re-read the
  // file — which it does after every committed save and after every conflict —
  // taking the draft with it. The projection is read once, here; `reproject` is
  // the only way a later one enters, and only when the model asks for it.
  // svelte-ignore state_referenced_locally
  let session = $state.raw(startMatchEditor(match, clock));
  const view = $derived(matchEditorView(session));

  /** Whether leaving the editor is waiting on a confirmation. */
  let leaving = $state(false);

  /** What became of the last *Copy my text*, so the person is told either way. */
  let copied = $state<'none' | 'copied' | 'failed'>('none');

  /**
   * The projection this editor would re-seed from, or `null`.
   *
   * Asked for **before** the control is drawn rather than only when it is clicked,
   * so a re-seed this window cannot perform is a disabled control with a sentence
   * beside it rather than a button that does nothing. `reproject` is a lookup and
   * is asked only while one is owed.
   */
  const reprojected = $derived(view.needsReprojection ? reproject(session.match) : null);

  /**
   * Records whatever one field's control now holds.
   *
   * @param field - Which field.
   * @param text - The control's whole value.
   */
  function onTyped(field: EditableField, text: string): void {
    session = editField(session, field, text);
  } // End of function onTyped()

  /**
   * Records that one field has the focus, which ends any group in another.
   *
   * @param field - The field that now has it.
   */
  function onFocus(field: EditableField): void {
    session = focusField(session, field);
  } // End of function onFocus()

  /** Records that no field has the focus, which ends the open typing group. */
  function onBlur(): void {
    session = focusField(session, null);
  } // End of function onBlur()

  /**
   * Asks for one field's key to be taken out of the file.
   *
   * @param field - Which field.
   */
  function onRemove(field: EditableField): void {
    session = removeField(session, field);
  } // End of function onRemove()

  /**
   * Takes back a removal, leaving the field holding what it held.
   *
   * @param field - Which field.
   */
  function onRestore(field: EditableField): void {
    session = restoreField(session, field);
  } // End of function onRestore()

  /** Goes back one step. */
  function onUndo(): void {
    session = undoEdit(session);
  } // End of function onUndo()

  /** Goes forward one step. */
  function onRedo(): void {
    session = redoEdit(session);
  } // End of function onRedo()

  /** Puts the outcome panel away and gives the controls back. */
  function onDismiss(): void {
    session = keepEditing(session);
  } // End of function onDismiss()

  /**
   * Seeds this editor again from a freshly projected snippet.
   *
   * **The only way out of `needsReprojection`, and the model makes it the only
   * way**: a committed save stops the session accepting changes and no transition
   * in `matchEditor.ts` clears the flag, so there is no *Dismiss* that resumes
   * editing on eligibility computed from bytes that have been replaced. It
   * discards nothing a person can lose — a commit leaves the draft clean by
   * definition, because the base moved to exactly what was written.
   */
  function reloadTheSnippet(): void {
    if (reprojected !== null && reprojected.kind === 'projected') {
      session = startMatchEditor(reprojected.match, clock);
    }
  } // End of function reloadTheSnippet()

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
    const consented = acknowledge ? acknowledgeFindings(session) : session;
    const started = beginSave(consented);
    if (started === null) {
      return;
    }
    session = started.session;
    // A leaving confirmation raised before the save started is about a question
    // this save has just answered differently, and leaving is refused for as long
    // as one is in flight anyway.
    leaving = false;
    // The copy disclosure belongs to the outcome that was on screen. Only
    // *Keep editing* can reach a new save today, and that clears it too; clearing
    // it here as well makes that an invariant rather than an argument about
    // reachability.
    copied = 'none';
    const answer = await save(
      started.session.match,
      started.draft,
      // **The session's own base, never the window's current projection.** The
      // three values that travel together — the identity, the draft and the
      // revision they were drafted against — all come from the same session here,
      // so a window that re-read the file while this editor was open produces a
      // conflict rather than a silent commit into a parse nobody saw.
      baseRevisionOf(started.session),
      acknowledgementOf(started.submission)
    );
    // Three arms, and each says something different about the file. `notAttempted`
    // is this window refusing before a command ran — nothing was sent, so nothing
    // was written and there is no reason to show. `failed` is a command that ran
    // and rejected, and it always carries why.
    if (answer.kind === 'answered') {
      session = applySave(session, answer.result, answer.adoption);
      return;
    }
    session =
      answer.kind === 'notAttempted'
        ? saveCouldNotBeSent(session, false, null)
        : saveCouldNotBeSent(session, answer.mayHaveWritten, answer.failure);
  } // End of function runSave()

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
    session = keepEditing(session);
  } // End of function refusalAction()

  /**
   * Puts a labelled reference copy of the retained draft on the clipboard.
   *
   * **What is copied is what the panel drew**: `view.retainedDraft` is the one
   * list, `tDraftCopy` is the one renderer of it, and neither is assembled here.
   * It is a reference — labels, exact text, and what a save would do with each key
   * — and it is **never YAML**, which would drop comments, key order and scalar
   * spelling while looking like something that could be pasted back into a
   * configuration file (consult Q4).
   *
   * **A refusal is disclosed rather than swallowed**, and one is reachable: a
   * value holding a real carriage return cannot go through the selection carrier
   * without being changed, so `copyReferenceText` refuses that route.
   *
   * **What the refusal sentence may not say is that the panel can be copied by
   * hand instead**, which is the 2c-4a-3a review's finding 1: `SourceText`
   * replaces every character no font draws — a carriage return, a NUL, a
   * zero-width space, a BOM — with its *localized name*, so what a person selects
   * off the panel is prose where those characters were. The sentence says the copy
   * failed, says that the display names such characters rather than printing them,
   * and warns that loading the disk version discards the draft either way. It does
   * not promise a recovery this application cannot give.
   */
  async function copyTheDraft(): Promise<void> {
    if (view.conflict === null) {
      return;
    }
    copied = (await copyReferenceText(tDraftCopy(view.retainedDraft))) ? 'copied' : 'failed';
  } // End of function copyTheDraft()

  /**
   * Does what one conflict choice says.
   *
   * **All four arms are reachable as of 2c-4a-3a.** `matchEditor.ts`'s
   * `CONFLICT_CAPABILITIES` records that this surface's draft **is** authored text
   * a clipboard can preserve, and both its booleans are now `true`, so
   * `conflictChoicesFor` names *Copy my text* and the two reload labels and this
   * panel draws them. The transitions behind them were built and wired at 2c-4a-2
   * and are driven by `matchEditor.test.ts`; what this step added is the controls
   * and the copy.
   *
   * **What the exhaustive switch forces, and what it does not.** A *new member* of
   * `ConflictChoice` fails to compile here, because every existing member is named
   * and there is no `default`. A *newly offered* member does not — offering is the
   * model's, and a choice becomes a control the moment `conflictChoicesFor` names
   * it. No type in this file could have forced that an arm does anything, which is
   * why the mounted suite presses every control this panel draws.
   *
   * @param choice - The choice the person picked.
   */
  function conflictAction(choice: ConflictChoice): void {
    switch (choice) {
      case 'keepEditing':
        session = keepEditing(session);
        copied = 'none';
        return;
      case 'reloadDiskVersion':
        session = askToReloadDiskVersion(session);
        return;
      case 'confirmReload': {
        // **Two calls, one click**, exactly as the raw editor's reload is: the
        // two steps a person sees are the warning and this press. The window
        // is what decides whether the adoption happened, and the session ends
        // only if it did — so a refusal leaves this panel open rather than
        // closing over a window that never moved.
        const reloaded = reloadTheDiskVersion(confirmDiskReload(session), adoptDiskVersion);
        session = reloaded;
        if (reloaded.closed) {
          close();
        }
        return;
      }
      case 'copyDraft':
        void copyTheDraft();
        return;
    }
  } // End of function conflictAction()

  /**
   * Leaves the editor, asking first when there is an unsaved draft to lose.
   *
   * **Refused outright while a save is in flight**, which is 2c-1b's fourth
   * finding: the request has already been authorized and cannot be cancelled, so
   * unmounting would leave it free to commit with its outcome drawn nowhere. The
   * control is disabled for the same reason rather than only guarded here — a
   * disabled control says *not now*, where a silent no-op says nothing.
   */
  function requestClose(): void {
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
    if (view.saving) {
      return;
    }
    close();
  } // End of function discardAndClose()
</script>

<section class="matchEditor" aria-label={t('browser.matchEditor.label')}>
  <div class="head">
    {#if file !== null}
      <dl>
        <dt>{t('browser.detail.file')}</dt>
        <dd class="source">{file.relative_path}</dd>
      </dl>
    {/if}
    {#if view.dirty}
      <span class="marker warn">{t('browser.matchEditor.unsaved')}</span>
    {/if}
    <button type="button" disabled={view.saving} onclick={() => requestClose()}>
      {t('browser.matchEditor.close')}
    </button>
  </div>

  {#if view.editability.kind === 'blocked'}
    <p class="blocked">
      {t('browser.detail.notEditable', { kind: tHazard(view.editability.hazard) })}
    </p>
  {:else if view.editability.kind === 'blockedUnnamed'}
    <p class="blocked">{t('browser.detail.notEditableUnnamed')}</p>
  {/if}

  {#if view.identityStale}
    <p class="panel">{t('browser.matchEditor.identityStale')}</p>
  {/if}

  {#if view.saving}
    <p class="kind">{t('browser.matchEditor.savingCannotBeStopped')}</p>
  {/if}

  {#if leaving}
    <div class="panel">
      <p>{t('browser.matchEditor.discardWarning')}</p>
      <p class="choices">
        <button type="button" disabled={view.saving} onclick={() => discardAndClose()}>
          {t('browser.matchEditor.discard')}
        </button>
        <button type="button" onclick={() => (leaving = false)}>
          {tRawSaveChoice('keepEditing')}
        </button>
      </p>
    </div>
  {/if}

  {#each view.fields as field (field.field)}
    {#if field.field === 'word'}
      <!-- The three word-boundary keys are last in `EDITABLE_FIELDS`, so this is
           where that group starts. Three text boxes and never a checkbox: D2u. -->
      <h3>{tOptionGroup('matching')}</h3>
    {/if}
    <div class="field">
      {#if field.refusal !== null}
        <!-- Shown and not edited. Through `SourceText` rather than a disabled
             control, because a text control's value normalises every carriage
             return to a line feed and this is exactly the value that may hold
             one — the box would misdraw the file even while refusing to write
             to it.

             **`field.shown`, never `field.text`.** One scalar is not what a
             refused field holds: a `triggers:` list has no scalar behind
             `trigger:` at all, so drawing `field.text` drew nothing and a person
             editing a multi-trigger snippet could see their triggers nowhere,
             because this editor replaces the whole detail pane while it is open.
             The model answers one entry per trigger. -->
        <p class="name">{tDetailField(field.label)}</p>
        {#each field.shown as one, index (index)}
          <div class="shownValue">
            <!-- Which key this value came from, when the field's own label does
                 not say. A `Several` draws a `trigger:` box and a `regex:` box
                 that are otherwise identical, and while this editor is open the
                 detail pane that labels them is not on screen to consult. The
                 name is the detail pane's own, through `tDetailField`; the model
                 says why `tTriggerKind` will not do. -->
            {#if one.source !== null}
              <span class="marker">{tDetailField(one.source)}</span>
            {/if}
            <!-- **A caption per arm, because the two arms show different things.**
                 One `valueAsWritten` above the whole list claimed every entry was
                 the file's own bytes, and a `notScalar` entry is a *localized shape
                 name* — so a nested list in `triggers:` was captioned "shown here
                 as the file writes it" over the words "a list", which the file does
                 not contain. Each entry now carries the caption that is true of it. -->
            {#if one.kind === 'text'}
              <span class="marker">{t('browser.detail.valueAsWritten')}</span>
              <SourceText text={one.text} />
            {:else}
              <span class="marker">{t('browser.matchEditor.shapeOnly')}</span>
              <span class="marker">{tValueKind(one.shape)}</span>
            {/if}
          </div>
        {/each}
        <p class="kind">{tFieldRefusal(field.refusal)}</p>
      {:else}
        <label>
          <span class="name">{tDetailField(field.label)}</span>
          {#if field.field === 'replace'}
            <textarea
              class="text body"
              spellcheck="false"
              readonly={!field.editable}
              value={field.text}
              oninput={(event) => onTyped(field.field, event.currentTarget.value)}
              onfocus={() => onFocus(field.field)}
              onblur={() => onBlur()}
            ></textarea>
          {:else}
            <input
              class="text"
              type="text"
              spellcheck="false"
              readonly={!field.editable}
              value={field.text}
              oninput={(event) => onTyped(field.field, event.currentTarget.value)}
              onfocus={() => onFocus(field.field)}
              onblur={() => onBlur()}
            />
          {/if}
        </label>
        {#if !field.present}
          <p class="kind">{t('browser.matchEditor.fieldAbsent')}</p>
        {/if}
        <!-- **Gated on the intent, not on the buffer's flag.** The sentence says
             the key *will be* taken out when you save, and after a committed
             removal the buffer still carries `removed` while the file no longer
             has the key — so a flag-gated marker promised a future write of
             something already written. `field.intent` is what a save would
             actually say about this field. -->
        {#if field.intent === 'Remove'}
          <p class="kind">{t('browser.matchEditor.fieldRemoved')}</p>
        {/if}
        {#if field.present}
          <p class="choices">
            {#if field.removed}
              <button
                type="button"
                disabled={!field.canRestore}
                onclick={() => onRestore(field.field)}
              >
                {t('browser.matchEditor.restore')}
              </button>
            {:else}
              <button
                type="button"
                disabled={!field.canRemove}
                onclick={() => onRemove(field.field)}
              >
                {t('browser.matchEditor.remove')}
              </button>
            {/if}
          </p>
        {/if}
      {/if}
    </div>
  {/each}

  <p class="choices">
    <button type="button" disabled={!view.canUndo} onclick={() => onUndo()}>
      {t('browser.matchEditor.undo')}
    </button>
    <button type="button" disabled={!view.canRedo} onclick={() => onRedo()}>
      {t('browser.matchEditor.redo')}
    </button>
    <button type="button" disabled={!view.canSave} onclick={() => void runSave(false)}>
      {t('browser.matchEditor.save')}
    </button>
    {#if view.saving}
      <span class="marker">{t('browser.matchEditor.saving')}</span>
    {/if}
  </p>

  {#if view.sendFailure !== null}
    {@const failure = view.sendFailure}
    <div class="panel">
      <p>
        {failure.kind === 'mayHaveWritten'
          ? t('browser.matchEditor.mayHaveWritten')
          : t('browser.matchEditor.sendFailed')}
      </p>
      {#if view.failureLines.length > 0}
        <p class="kind">{t('browser.matchEditor.failureReason')}</p>
        {#each view.failureLines as line, index (index)}
          <p>
            {#if line.kind === 'failure'}
              {tIpcFailure(line.failure)}
            {:else if line.kind === 'draft'}
              {tDraftError(line.error)}
            {:else if line.kind === 'save'}
              {tSaveError(line.error)}
            {:else}
              {tEditError(line.error)}
            {/if}
          </p>
        {/each}
      {/if}
    </div>
  {/if}

  {#if view.outcome !== null}
    {@const outcome = view.outcome}
    <div class="panel" role="status">
      {#each view.messages as message, index (index)}
        <p>{tSaveOutcomeMessage(message)}</p>
      {/each}

      {#if outcome.kind === 'saved'}
        {#if view.notes.length > 0}
          <p class="kind">{t('browser.matchEditor.notes')}</p>
          <ul>
            {#each view.notes as note, index (index)}
              <li>{tPresentationNote(note)}</li>
            {/each}
          </ul>
        {/if}
        {#if view.needsReprojection}
          <p class="kind">{t('browser.matchEditor.needsReprojection')}</p>
          {#if reprojected !== null && reprojected.kind === 'unavailable'}
            <p class="kind">{tReprojectionRefusal(reprojected.reason)}</p>
          {/if}
        {/if}
        <!-- **No *Dismiss* while a re-projection is owed.** Dismissing used to
             clear the outcome and give the controls back, which put the
             obligation out of sight and let editing continue on eligibility
             computed from bytes the commit replaced. The model now refuses to
             accept changes until a fresh projection is seeded, so the only
             honest offers here are the re-seed and leaving. -->
        <p class="choices">
          {#if view.needsReprojection}
            <button
              type="button"
              disabled={reprojected === null || reprojected.kind !== 'projected'}
              onclick={() => reloadTheSnippet()}
            >
              {t('browser.matchEditor.reload')}
            </button>
          {:else}
            <button type="button" onclick={() => onDismiss()}>
              {t('browser.notice.dismiss')}
            </button>
          {/if}
        </p>
      {:else if outcome.kind === 'refused'}
        <p class="kind">{tSaveVerdict(outcome.verdict)}</p>
        {#if outcome.findings.length > 0}
          <p class="kind">{t('browser.matchEditor.findings')}</p>
          <ul>
            {#each outcome.findings as finding, index (index)}
              <li>{tFindingCode(finding.code)}</li>
            {/each}
          </ul>
        {/if}
        {#if view.findingsAreStale}
          <p class="kind">{t('browser.matchEditor.findingsAreStale')}</p>
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
        <p class="kind">
          {t('browser.matchEditor.revisionExpected', { revision: conflict.expected })}
        </p>
        <p class="kind">{t('browser.matchEditor.revisionFound', { revision: conflict.found })}</p>
        <p class="kind">
          {t('browser.matchEditor.revisionDisk', { revision: conflict.diskRevision })}
        </p>

        <h3>{t('browser.saveOutcome.retainedDraft')}</h3>
        <!-- The conflict's **own** retained buffers, walked by the model, and the
             same list the copy is built from. Through `SourceText` rather than
             into boxes: nothing here is editable while the panel is up, and a
             projected value may hold a real carriage return that a text control
             would silently draw as an ordinary line break. -->
        {#each view.retainedDraft as field (field.label)}
          <div class="shownValue">
            <span class="marker">{tDetailField(field.label)}</span>
            <span class="marker">{tDraftFieldStatus(field.status)}</span>
            <SourceText text={field.text} />
          </div>
        {/each}

        <h3>{t('browser.saveOutcome.diskVersion')}</h3>
        <!-- The whole file as the command layer read it, paired with
             `diskRevision`. **Not** "the same snippet in the disk version": there
             is no trustworthy correspondence across revisions and inventing one is
             2c-4b (consult Q5). Which arm is drawn is `conflictDiskText`'s
             decision and not this markup's: *a file of zero characters is a fact
             about the file rather than a failure to obtain it* was written into
             three renderers until the 2c-4a-3a review's finding 5. -->
        {#if view.diskText !== null && view.diskText.kind === 'text'}
          <SourceText text={view.diskText.text} documentStart />
        {:else}
          <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
        {/if}

        <!-- The second step's warning. The shared line above says what a reload
             does to *any* panel that closes; this one says what only this surface
             can say — that no snippet in the new version will be guessed at. -->
        {#if view.awaitingReloadConfirmation}
          <p class="kind">{t('browser.matchEditor.reloadClosesEditor')}</p>
        {/if}

        <!-- A control that has just gone, with the reason in its place. The reload
             is not offered again once the window has refused a spend, because
             asking again could only be refused again. -->
        {#if view.reloadUnavailable}
          <p class="kind">{t('browser.saveOutcome.reloadUnavailable')}</p>
        {/if}

        <p class="kind">{t('browser.saveOutcome.copyIsReference')}</p>
        {#if copied === 'copied'}
          <p class="kind">{t('browser.saveOutcome.draftCopied')}</p>
        {:else if copied === 'failed'}
          <p class="kind">{t('browser.saveOutcome.draftCopyFailed')}</p>
        {/if}

        <p class="choices">
          {#each view.conflictChoices as choice (choice)}
            <button type="button" onclick={() => conflictAction(choice)}>
              {tConflictChoice(choice)}
            </button>
          {/each}
        </p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .matchEditor {
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

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  /* One piece of what a refused field holds, with the key it came from above it.
     A column, so the name sits on its own line and the value below keeps the full
     width `SourceText` needs to scroll sideways in. */
  .shownValue {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .name {
    color: var(--muted);
    font-size: 0.8125rem;
  }

  /* A field's value, in the face that means "this is what the document holds"
     (`src/app.css`) — the same one `SourceText` uses, because this box and that
     box show the same kind of thing. */
  .text {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    color: inherit;
  }

  /* The replacement body is the one field that is routinely several lines, so it
     is the one that gets a resizable box. `white-space: pre` for `SourceText`'s
     reason: a soft wrap is indistinguishable from a line break the value does
     not contain. */
  .body {
    white-space: pre;
    overflow: auto;
    min-height: 8rem;
    resize: vertical;
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

  /* Anything this app says about a save rather than about the snippet: the three
     outcome arms, the leaving warning, a send that never left. */
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

  /* The one judgement this editor draws about the snippet itself, bordered like
     the detail pane's own refusal because it is the same kind of statement. */
  .blocked {
    margin: 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
  }
</style>
