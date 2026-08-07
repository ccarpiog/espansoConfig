<script lang="ts">
  import { triggerLabel } from '../browser/labels';
  import {
    acknowledgeCreationFindings,
    acknowledgementOf,
    applyCreate,
    askToReloadDiskVersion,
    baseRevisionOf,
    beginCreate,
    chooseDestination,
    choosePlacement,
    confirmDiskReload,
    createCouldNotBeSent,
    editCreationField,
    focusCreationField,
    keepDrafting,
    matchCreationView,
    placementOptionsOf,
    redoCreation,
    reloadTheDiskVersion,
    startMatchCreation,
    type PlacementOption,
    undoCreation
  } from '../browser/matchCreation';
  import type { AdoptTheDiskVersion } from '../browser/editorSave';
  import type { CreationBuffers } from '../browser/matchCreation';
  import type { ConflictChoice } from '../browser/saveOutcome';
  import type { RawSaveChoice } from '../browser/rawSave';
  import type { Clock } from '../browser/typing';
  import type { MatchSaveAnswer } from '../browser/workspace.svelte';
  import { copyReferenceText } from './clipboard';
  import SourceText from './SourceText.svelte';
  import {
    t,
    tConflictChoice,
    tCreationRefusal,
    tDestinationRefusal,
    tDetailField,
    tDraftCopy,
    tDraftError,
    tDraftFieldStatus,
    tEditError,
    tFindingCode,
    tIpcFailure,
    tPresentationNote,
    tRawSaveChoice,
    tSaveError,
    tSaveOutcomeMessage,
    tSaveVerdict,
    tTriggerKind
  } from '../i18n';
  import type {
    Acknowledgement,
    ContentRevision,
    DocumentId,
    DocumentSummary,
    DocumentView,
    MatchId,
    NewMatch,
    NewMatchPosition
  } from '../ipc/types';

  /*
   * The new-snippet form: a destination, a position, two required values.
   *
   * **This file is presentation.** Every decision about which files may be
   * written into, where a snippet may go, when the form may be submitted, what a
   * commit spends and what a save says is in `../browser/matchCreation.ts`, which
   * has a test suite. This is a walk over `matchCreationView`'s answer, exactly as
   * `MatchEditor.svelte` is a walk over `matchEditorView`'s — and the smallness is
   * the reason ten review findings were reachable in step 1 with no screen at all.
   *
   * The bolded paragraphs below are the things in this markup that are
   * load-bearing rather than style. Deliberately not counted, for
   * `MatchEditor.svelte`'s reason: a number here goes stale the next time one is
   * added.
   *
   * **Every file this window lists is offered, and the ones that cannot be
   * written into say why.** The design consult's Q5 in its literal reading: a
   * destination list silently shorter than the sidebar reads as an incomplete list
   * rather than as an explanation. An ineligible file's control is disabled and
   * its typed reason is rendered beside it through `tDestinationRefusal` — never
   * by building a key. The model still offers such a file as *chosen* when the
   * held selection is in it, and the refusal is then also what the create control
   * says.
   *
   * **The position is one control with three arms, and the `after` arm stores an
   * identity.** `placementOptionsOf` answers Front, one option per anchor this
   * window can still name, then End, in the file's own order, and says which one
   * is currently held. An anchor is *named* from the projection the snippet list
   * draws its rows from — `triggerLabel` and `labelText` — because the model
   * carries identities and not a second copy of the display text.
   *
   * **The two boxes normalise a carriage return differently, so they carry two
   * different sentences.** Measured in this application's own WKWebView
   * (`docs/decisions/2c-2-2-window-reading.md` section 6): a `<textarea>`
   * collapses `\r` and `\r\n` to `\n`, and an `<input type="text">` **deletes**
   * the character outright. One shared sentence saying a pasted carriage return
   * becomes a line break was therefore true of the body and false of the trigger.
   * Each control now has its own disclosure directly beside it — chosen by which
   * control it sits next to, never by a condition in this markup — and neither
   * claims what the other measured. Unlike the small editor, which refuses a
   * *projected* value holding a carriage return because rewriting it would change
   * bytes nobody touched, both values here are **new**: there is no text of the
   * user's that a normalisation could reformat, so the boxes accept it and say so.
   * That is progress on the hole `2c-2-2-window-reading.md` section 6 left open —
   * the person is now told accurately what each box does — and not its closure:
   * the character is still altered as it is pasted, and nothing on screen reacts
   * at the moment it happens.
   *
   * **The destination list is bounded and the action row is sticky, and both
   * are layout rather than policy.** `docs/decisions/2c-3a-2-window-reading.md`
   * section 7.2 measured a form 805 px tall inside a 645 px pane, with *Add this
   * snippet* below the fold the moment it opened and getting worse with every
   * file in the workspace, because the destination list drew one full control
   * per file with no bound. The list now has a maximum height and scrolls inside
   * itself, so its height stops depending on the file count, and the action row
   * is `position: sticky; bottom: 0`, so the primary control stays on screen even
   * when something else makes the form taller. **No file is hidden and no
   * refusal is truncated** — that would reintroduce exactly the finding the
   * consult's Q5 exists to prevent — and there is no condition anywhere in this
   * markup about which destinations are worth drawing.
   *
   * **A save that produced no outcome shows *why*, not only *whether*.**
   * `view.failureLines` is the chain, and `create_match` is the only command that
   * can answer `documentHasNoMatchList` — a sentence that had never been drawable
   * until this screen existed.
   *
   * **A committed create offers a re-seed and no *Dismiss*.** The model stops
   * accepting changes once a create has committed, because every destination and
   * every anchor it holds was derived from a projection the commit replaced, and
   * nothing in it clears that. A *Dismiss* would draw a control that puts the
   * obligation out of sight without discharging it — the defect the 2c-2-2 review
   * found in the small editor.
   *
   * **The form cannot be left while a save is in flight**, for 2c-1b's reason: the
   * request is authorized and cannot be cancelled, so unmounting would leave it
   * free to commit with its outcome drawn nowhere.
   *
   * **The conflict panel shows two sides and identifies nothing across them.** The
   * retained draft is `view.retainedDraft` — the model's walk over the conflict's
   * own buffers — and the disk side is `conflict.diskText`, the whole file as the
   * command layer read it, through `SourceText`. The chosen destination and
   * position are **not** in that list, because `Draft<CreationBuffers>` does not
   * carry them (consult Q4); they stay in the form above, which is where they have
   * always been. The confirmed reload closes this form, because a file on disk
   * holds no half-written snippet to load in its place.
   */

  const {
    documents,
    projections,
    held,
    create,
    adoptDiskVersion,
    close,
    clock = () => Date.now()
  }: {
    /**
     * Every file the window lists, in window order.
     *
     * **A function rather than an array**, and that is not a style choice: the
     * list is read at every re-seed, and a committed create is exactly the moment
     * the window has just re-read a file. A captured array would seed the next
     * form from the projections the commit replaced.
     */
    documents: () => readonly DocumentSummary[];
    /** Every projection this window holds, read the same way and for the same reason. */
    projections: () => readonly DocumentView[];
    /** The snippet the window has selected, or `null`. Read at every re-seed. */
    held: () => MatchId | null;
    /**
     * Sends one create.
     *
     * **`BrowserState.createMatch` and nothing else.** That method performs the
     * adoption a committed create owes — the created snippet's identity, and the
     * selection that follows it — before the answer is handed back; `createMatch`
     * in `../ipc/commands` is the same call without it. Nothing in TypeScript
     * stops a component reaching for the second, which is why it is written here.
     *
     * @param document - The file to write into.
     * @param newMatch - What the new snippet says.
     * @param position - Where it goes in that file's list.
     * @param baseRevision - The revision the form was drafted against.
     * @param acknowledgement - The suspicions already shown to a person.
     * @returns The outcome and the adoption's fate, or a typed failure.
     */
    create: (
      document: DocumentId,
      newMatch: NewMatch,
      position: NewMatchPosition,
      baseRevision: ContentRevision,
      acknowledgement: Acknowledgement
    ) => Promise<MatchSaveAnswer>;
    /** Leaves the form. */
    /**
     * Installs the disk observation a conflict carried into the window.
     *
     * `BrowserState.adoptDiskVersion`, the sole frontend transition that moves
     * this window to the disk side of a conflict. It is called by
     * `reloadTheDiskVersion` and by nothing here, so the projection cannot be
     * replaced without this form closing in the same call — and a `refused` from
     * it is honoured by closing nothing, while an `alreadyThere` is a success the
     * transition finishes on.
     */
    adoptDiskVersion: AdoptTheDiskVersion<CreationBuffers>;
    close: () => void;
    /**
     * Where the typing group's boundary readings come from.
     *
     * **The model has no default and this does**, which is the difference between
     * a rule and a wiring: `startMatchCreation` refuses to name `Date.now`,
     * because a boundary decided by real time is a boundary no test can drive.
     */
    clock?: Clock;
  } = $props();

  // `$state.raw`, not `$state`: a form is an immutable value replaced whole on
  // every transition, and its draft holds deep-frozen snapshots a reactive proxy
  // has no business walking.
  //
  // The three readers above are called once here and again at every re-seed. The
  // warning is suppressed for `MatchEditor.svelte`'s reason: capturing is the
  // point, and a form that re-derived itself from its props would be discarded —
  // draft and all — every time the workspace re-read anything.
  // svelte-ignore state_referenced_locally
  let session = $state.raw(startMatchCreation(documents(), projections(), held(), clock));
  const view = $derived(matchCreationView(session));

  /**
   * Every position the form can offer, named from the current projections.
   *
   * `projections()` is read here rather than captured, so an anchor whose file has
   * been re-read stops being offered. The model answers `anchorUnavailable` for one
   * that was already installed, which is the same fact from the other side.
   */
  const placements = $derived(placementOptionsOf(session, projections()));

  /** Whether leaving the form is waiting on a confirmation. */
  let leaving = $state(false);

  /** What became of the last *Copy my text*, so the person is told either way. */
  let copied = $state<'none' | 'copied' | 'failed'>('none');

  /**
   * Chooses the file the snippet goes in.
   *
   * @param document - The file chosen.
   */
  function onDestination(document: DocumentId): void {
    session = chooseDestination(session, document);
  } // End of function onDestination()

  /**
   * Chooses where in the destination's list the snippet goes.
   *
   * The option is looked up by the key its own control carries, so the placement
   * installed is the one the model built rather than one this file assembled.
   *
   * @param key - The chosen option's key.
   */
  function onPlacement(key: string): void {
    const option = placements.find((one: PlacementOption) => one.key === key);
    if (option === undefined) {
      return;
    }
    session = choosePlacement(session, option.placement);
  } // End of function onPlacement()

  /**
   * Records whatever one control now holds.
   *
   * @param field - Which field.
   * @param text - The control's whole value.
   */
  function onTyped(field: 'trigger' | 'replace', text: string): void {
    session = editCreationField(session, field, text);
  } // End of function onTyped()

  /**
   * Records that one field has the focus, which ends any run in another.
   *
   * @param field - The field that now has it.
   */
  function onFocus(field: 'trigger' | 'replace'): void {
    session = focusCreationField(session, field);
  } // End of function onFocus()

  /** Records that no field has the focus, which ends the open typing run. */
  function onBlur(): void {
    session = focusCreationField(session, null);
  } // End of function onBlur()

  /** Goes back one step. */
  function onUndo(): void {
    session = undoCreation(session);
  } // End of function onUndo()

  /** Goes forward one step. */
  function onRedo(): void {
    session = redoCreation(session);
  } // End of function onRedo()

  /** Puts the outcome panel away and gives the controls back. */
  function onDismiss(): void {
    session = keepDrafting(session);
  } // End of function onDismiss()

  /**
   * Seeds a fresh form from the files as this window now holds them.
   *
   * **The only way out of a committed create, and the model makes it the only
   * way**: every destination and every anchor the spent form holds was derived
   * from a projection that commit replaced, and no transition in
   * `matchCreation.ts` clears the flag. It discards nothing a person can lose —
   * the snippet that was drafted is in the file.
   */
  function addAnother(): void {
    session = startMatchCreation(documents(), projections(), held(), clock);
  } // End of function addAnother()

  /**
   * Sends the form, optionally accepting the findings on screen first.
   *
   * The acknowledgement is never assembled here: `acknowledgeCreationFindings`
   * records consent through the one function that can, and `beginCreate` reads it
   * back through `submissionOf`, so what goes to the boundary is consent bound to
   * the exact candidate being sent or nothing at all.
   *
   * @param acknowledge - Whether this is the *Save anyway* control.
   */
  async function runCreate(acknowledge: boolean): Promise<void> {
    const consented = acknowledge ? acknowledgeCreationFindings(session) : session;
    const started = beginCreate(consented);
    if (started === null) {
      return;
    }
    session = started.session;
    // A leaving confirmation raised before the save started is about a question
    // this save has just answered differently, and leaving is refused for as long
    // as one is in flight anyway.
    leaving = false;
    // The copy disclosure belongs to the outcome that was on screen. Only
    // *Keep editing* can reach a new create today, and that clears it too;
    // clearing it here as well makes that an invariant rather than an argument
    // about reachability.
    copied = 'none';
    const answer = await create(
      started.document,
      started.newMatch,
      started.position,
      // **The form's own base, never the window's current projection.** A form
      // opened at one revision over a window that has since re-read the file
      // conflicts rather than committing into a parse nobody saw.
      baseRevisionOf(started.session),
      acknowledgementOf(started.submission)
    );
    // Three arms, and each says something different about the file. `notAttempted`
    // is this window refusing before a command ran — nothing was sent, so nothing
    // was written and there is no reason to show. `failed` is a command that ran
    // and rejected, and it always carries why.
    if (answer.kind === 'answered') {
      session = applyCreate(session, answer.result, answer.adoption);
      return;
    }
    session =
      answer.kind === 'notAttempted'
        ? createCouldNotBeSent(session, false, null)
        : createCouldNotBeSent(session, answer.mayHaveWritten, answer.failure);
  } // End of function runCreate()

  /**
   * Does what one refusal choice says.
   *
   * @param choice - The choice the person picked.
   */
  function refusalAction(choice: RawSaveChoice): void {
    if (choice === 'saveAnyway') {
      void runCreate(true);
      return;
    }
    session = keepDrafting(session);
  } // End of function refusalAction()

  /**
   * Puts a labelled reference copy of the retained draft on the clipboard.
   *
   * **What is copied is what the panel drew**: `view.retainedDraft` is the one
   * list, `tDraftCopy` is the one renderer of it, and neither is assembled here.
   * The destination and the position are not in it, because the retained draft
   * does not carry them and a copy that named them would be describing something
   * else. It is a reference and **never YAML** (consult Q4).
   *
   * **A refusal is disclosed rather than swallowed, and the sentence does not
   * promise a hand copy** — the 2c-4a-3a review's finding 1. `SourceText` writes
   * the *name* of any character no font draws in place of the character, so
   * selecting the panel by hand does not always give back what was typed; the
   * disclosure says exactly that, and says that loading the disk version discards
   * the draft either way.
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
   * **All four arms are reachable as of 2c-4a-3a.** `matchCreation.ts`'s
   * `CONFLICT_CAPABILITIES` records that this draft **is** authored text a
   * clipboard can preserve — the consult's Q3/Q4 rule — and both its booleans are
   * now `true`, so `conflictChoicesFor` names *Copy my text* and the two reload
   * labels and this panel draws them. The reload adopts the disk projection and
   * **closes** the form, because there is no disk-side `CreationBuffers` to
   * reload; it was built and wired at 2c-4a-2 and is driven by
   * `matchCreation.test.ts`.
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
        session = keepDrafting(session);
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
   * Leaves the form, asking first when there is an unsaved draft to lose.
   *
   * **Refused outright while a save is in flight**, which is 2c-1b's fourth
   * finding: the request has already been authorized and cannot be cancelled, so
   * unmounting would leave it free to commit with its outcome drawn nowhere.
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

  /** Leaves the form, discarding the draft. Refused while a save is in flight. */
  function discardAndClose(): void {
    if (view.saving) {
      return;
    }
    close();
  } // End of function discardAndClose()
</script>

<section class="creator" aria-label={t('browser.matchCreation.label')}>
  <div class="head">
    <h2>{t('browser.matchCreation.label')}</h2>
    {#if view.dirty}
      <span class="marker warn">{t('browser.matchCreation.unsaved')}</span>
    {/if}
    <button type="button" disabled={view.saving} onclick={() => requestClose()}>
      {t('browser.matchCreation.close')}
    </button>
  </div>

  {#if view.saving}
    <p class="kind">{t('browser.matchCreation.savingCannotBeStopped')}</p>
  {/if}

  {#if leaving}
    <div class="panel">
      <p>{t('browser.matchCreation.discardWarning')}</p>
      <p class="choices">
        <button type="button" disabled={view.saving} onclick={() => discardAndClose()}>
          {t('browser.matchCreation.discard')}
        </button>
        <button type="button" onclick={() => (leaving = false)}>
          {tRawSaveChoice('keepEditing')}
        </button>
      </p>
    </div>
  {/if}

  <div class="field">
    <p class="name">{t('browser.matchCreation.destination')}</p>
    <ul class="destinations">
      {#each view.destinations as destination (destination.document)}
        <li>
          <button
            type="button"
            class="choice"
            aria-pressed={view.chosen !== null && view.chosen.document === destination.document}
            disabled={!view.editable || destination.eligibility.kind !== 'eligible'}
            onclick={() => onDestination(destination.document)}
          >
            {destination.path}
          </button>
          <!-- Offered and refused, never omitted: the consult's Q5. -->
          {#if destination.eligibility.kind === 'ineligible'}
            <p class="kind">{tDestinationRefusal(destination.eligibility.reason)}</p>
          {/if}
        </li>
      {/each}
    </ul>
  </div>

  <div class="field">
    <label>
      <span class="name">{t('browser.matchCreation.position')}</span>
      <!-- One control with three arms. The `after` options carry an identity the
           model minted; this file never builds one from a row's index. -->
      <select
        disabled={!view.editable}
        onchange={(event) => onPlacement(event.currentTarget.value)}
      >
        {#each placements as option (option.key)}
          <option value={option.key} selected={option.chosen}>
            {#if option.placement.kind === 'front'}
              {t('browser.matchCreation.position.front')}
            {:else if option.placement.kind === 'end'}
              {t('browser.matchCreation.position.end')}
            {:else if option.anchor !== null}
              {@const named = triggerLabel(option.anchor)}
              {t('browser.matchCreation.position.after', {
                trigger: named.kind === 'text' ? named.text : tTriggerKind(named.code)
              })}
            {/if}
          </option>
        {/each}
      </select>
    </label>
  </div>

  <div class="field">
    <label>
      <span class="name">{tDetailField('trigger')}</span>
      <input
        class="text"
        type="text"
        spellcheck="false"
        readonly={!view.editable}
        value={view.trigger}
        oninput={(event) => onTyped('trigger', event.currentTarget.value)}
        onfocus={() => onFocus('trigger')}
        onblur={() => onBlur()}
      />
    </label>
    <!-- The `<input>`'s measured normalisation, disclosed beside the `<input>`. -->
    <p class="kind">{t('browser.matchCreation.lineEndings.trigger')}</p>
  </div>

  <div class="field">
    <label>
      <span class="name">{tDetailField('replace')}</span>
      <textarea
        class="text body"
        spellcheck="false"
        readonly={!view.editable}
        value={view.replace}
        oninput={(event) => onTyped('replace', event.currentTarget.value)}
        onfocus={() => onFocus('replace')}
        onblur={() => onBlur()}
      ></textarea>
    </label>
    <!-- The `<textarea>`'s, which is a different fact and so a different sentence. -->
    <p class="kind">{t('browser.matchCreation.lineEndings.replace')}</p>
  </div>

  <!-- The create control and the sentence that says why it is disabled are one
       block, because they are one statement: a control pinned to the bottom of
       the pane with its reason left above the fold would be a control that has
       stopped saying why. -->
  <div class="actions">
    <p class="choices">
      <button type="button" disabled={!view.canUndo} onclick={() => onUndo()}>
        {t('browser.matchCreation.undo')}
      </button>
      <button type="button" disabled={!view.canRedo} onclick={() => onRedo()}>
        {t('browser.matchCreation.redo')}
      </button>
      <button type="button" disabled={!view.canCreate} onclick={() => void runCreate(false)}>
        {t('browser.matchCreation.create')}
      </button>
      {#if view.saving}
        <span class="marker">{t('browser.matchCreation.saving')}</span>
      {/if}
    </p>

    <!-- **Every refusal has a code here**, unlike the small editor's, whose
         `beginSave` can only answer `null`. So a disabled control says why. -->
    {#if view.refusal !== null}
      <p class="kind">{tCreationRefusal(view.refusal)}</p>
    {/if}
  </div>

  {#if view.sendFailure !== null}
    {@const failure = view.sendFailure}
    <div class="panel">
      <p>
        {failure.kind === 'mayHaveWritten'
          ? t('browser.matchCreation.mayHaveWritten')
          : t('browser.matchCreation.sendFailed')}
      </p>
      {#if view.failureLines.length > 0}
        <p class="kind">{t('browser.matchCreation.failureReason')}</p>
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
          <p class="kind">{t('browser.matchCreation.notes')}</p>
          <ul>
            {#each view.notes as note, index (index)}
              <li>{tPresentationNote(note)}</li>
            {/each}
          </ul>
        {/if}
        {#if view.committed}
          <p class="kind">{t('browser.matchCreation.committed')}</p>
          <!-- `created` is `null` on a legal committed create: the command
               answers no identity when the file changed again between the write
               and the read that followed it, and a screen that could not draw
               that case would be claiming something the wire does not promise. -->
          {#if view.created === null}
            <p class="kind">{t('browser.matchCreation.createdNotIdentified')}</p>
          {/if}
        {/if}
        <p class="choices">
          {#if view.committed}
            <button type="button" onclick={() => addAnother()}>
              {t('browser.matchCreation.addAnother')}
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
          <p class="kind">{t('browser.matchCreation.findings')}</p>
          <ul>
            {#each outcome.findings as finding, index (index)}
              <li>{tFindingCode(finding.code)}</li>
            {/each}
          </ul>
        {/if}
        {#if view.findingsAreStale}
          <p class="kind">{t('browser.matchCreation.findingsAreStale')}</p>
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
          {t('browser.matchCreation.revisionExpected', { revision: conflict.expected })}
        </p>
        <p class="kind">{t('browser.matchCreation.revisionFound', { revision: conflict.found })}</p>
        <p class="kind">
          {t('browser.matchCreation.revisionDisk', { revision: conflict.diskRevision })}
        </p>

        <h3>{t('browser.saveOutcome.retainedDraft')}</h3>
        <!-- The conflict's own retained buffers, walked by the model, and the same
             list the copy is built from. Through `SourceText` rather than into
             boxes: the two controls above normalise a carriage return in opposite
             ways, and this is a rendering of what is held rather than a place to
             type. -->
        {#each view.retainedDraft as field (field.label)}
          <div class="shownValue">
            <span class="marker">{tDetailField(field.label)}</span>
            <span class="marker">{tDraftFieldStatus(field.status)}</span>
            <SourceText text={field.text} />
          </div>
        {/each}

        <h3>{t('browser.saveOutcome.diskVersion')}</h3>
        <!-- The whole file as the command layer read it, paired with
             `diskRevision`, and never a projection of "the same snippet" — which
             does not exist for a snippet that was never written. Which arm is drawn
             is `conflictDiskText`'s decision and not this markup's (2c-4a-3a
             review, finding 5). -->
        {#if view.diskText !== null && view.diskText.kind === 'text'}
          <SourceText text={view.diskText.text} documentStart />
        {:else}
          <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
        {/if}

        <!-- The second step's warning. The shared line above says what a reload
             does to any panel that closes; this one says what only this surface
             can say — that a file on disk holds no half-written snippet. -->
        {#if view.awaitingReloadConfirmation}
          <p class="kind">{t('browser.matchCreation.reloadClosesForm')}</p>
        {/if}

        <!-- A control that has just gone, with the reason in its place. -->
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
  .creator {
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

  h2 {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  /* The conflict panel's two headings: what was drafted, and what is on disk. */
  h3 {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  /* One field of the retained draft, with its name and its status above it. A
     column, so the value below keeps the full width `SourceText` needs to scroll
     sideways in. */
  .shownValue {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
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

  /* One row per file the window lists, ineligible ones included. A column,
     because the reason a file cannot be written into is a sentence that wraps
     and not a label beside the name.

     **Bounded, and it scrolls inside itself.** `2c-3a-2-window-reading.md`
     section 7.2 measured what an unbounded list does: one full control per
     listed file made the form 805 px tall inside a 645 px pane at eight files,
     which put the create control below the fold on open — and the height grew
     with the file count, so the more files a person has the worse it is. A
     maximum height turns that into a constant: the list is the same height at
     eight files and at thirty, and what changes is how far it scrolls. Nothing
     is omitted and no sentence is clipped — every control and every refusal is
     still in the list, reachable by scrolling it, which is what the design
     consult's Q5 asks for. */
  .destinations {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 12rem;
    overflow-y: auto;
  }

  .choice {
    font-family: var(--font-mono);
    text-align: start;
  }

  .choice[aria-pressed='true'] {
    background: var(--surface-raised);
  }

  select {
    font: inherit;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
  }

  /* A value the file will hold, in the face that means "this is what the
     document holds" (`src/app.css`). */
  .text {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    color: inherit;
  }

  /* `white-space: pre` for `SourceText`'s reason: a soft wrap is
     indistinguishable from a line break the value does not contain. */
  .body {
    white-space: pre;
    overflow: auto;
    min-height: 6rem;
    resize: vertical;
  }

  .text[readonly] {
    color: var(--muted);
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

  /* The form's own action row, with the sentence that says why the create
     control is disabled.

     **Sticky at the bottom of the pane**, which is the second half of the
     section 7.2 fix and the half that does not depend on an estimate. Bounding
     the destination list is what makes the form fit today; this is what keeps
     the create control on screen when it does not — a longer translation, a
     `<textarea>` a person has dragged taller, an outcome panel below. `.creator`
     is a flex item that shrinks to the pane's height with its content
     overflowing, so its content box bottom *is* the bottom of what the pane
     shows, and `bottom: 0` clamps this row to exactly there.

     The background is opaque for the only reason a sticky row ever needs one:
     while it is pinned, the form scrolls underneath it. */
  .actions {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.25rem 0;
    background: var(--surface);
  }

  /* Anything this app says about a save rather than about the snippet. */
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
