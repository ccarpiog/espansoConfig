<script lang="ts">
  import { attemptOfReapply, reapplyReveal, reapplyToShow, type ReapplyAttempt } from '../browser/reapply';
  import type { CreationField } from '../browser/matchCreation';
  import {
    acknowledgeRecoveryFindings,
    askToReloadRecoveryDiskVersion,
    chooseRecoveryDestination,
    confirmRecoveryDiskReload,
    editRecoveryField,
    focusRecoveryField,
    keepRecovering,
    reapplyRecoveryToDiskVersion,
    recoveryIsAnswerable,
    recoveryView,
    redoRecoveryEdit,
    reloadRecoveryDiskVersion,
    sendRecoveryCreate,
    transferStatusOf,
    undoRecoveryEdit,
    RECOVERY_CONFLICT_CAPABILITIES,
    type CreateARecoveredSnippet,
    type RecoveryAvailability,
    type RecoveryChoice,
    type RecoveryReapplyObstacle,
    type RecoverySession,
    type RecoveryStart,
    type RecoveryUnavailable
  } from '../browser/recovery';
  import type { AdoptTheDiskVersion } from '../browser/editorSave';
  import type { CreationBuffers } from '../browser/matchCreation';
  import { outcomeReveal, reapplyIsOffered, type ConflictChoice } from '../browser/saveOutcome';
  import type { RawSaveChoice } from '../browser/rawSave';
  import { revealOutcome, revealReapplyReport } from './reveal';
  import SourceText from './SourceText.svelte';
  import {
    t,
    tConflictChoice,
    tDetailField,
    tDraftError,
    tEditError,
    tFindingCode,
    tIpcFailure,
    tPresentationNote,
    tRawSaveChoice,
    tReapplyOutcome,
    tReapplyReadiness,
    tRecoveryChoice,
    tRecoveryReapplyObstacle,
    tRecoveryRefusal,
    tRecoveryUnavailable,
    tReloadUnavailable,
    tSaveError,
    tSaveOutcomeMessage,
    tSaveVerdict,
    tSourceConflictState,
    tTransferRefusal,
    tTransferStatus
  } from '../i18n';
  import type { DocumentId } from '../ipc/types';

  /*
   * The way out of a conflict nothing could resolve automatically: a new snippet
   * made from the fields this application can write.
   *
   * **This file is presentation, and it is one file for two surfaces.** Every
   * decision about what may be carried, where the snippet may go, when the form
   * may be sent, what it says and what a commit answers is in
   * `../browser/recovery.ts`, which has a test suite. This is a walk over
   * `recoveryView`'s answer, exactly as `MatchCreator.svelte` is a walk over
   * `matchCreationView`'s — and it is shared by the match editor and the creator
   * rather than copied into each because a rule written into one renderer is
   * carried by that renderer's mounted suite alone, and the second renderer can
   * omit it while walking the model faithfully (2c-3c-3).
   *
   * The bolded paragraphs below are the things in this markup that are
   * load-bearing rather than style. Deliberately not counted, for
   * `MatchEditor.svelte`'s reason: a number here goes stale the next time one is
   * added.
   *
   * **The product is named once and it is never called a duplicate.** What this
   * writes is a *new snippet from supported fields*: six projected values, spelled
   * into the file by Rust's own encoder. Comments, unknown keys, key order, scalar
   * spelling, tags, anchors, the sixteen other scalar fields and the four
   * collections are not carried, and the disclosure above the table says so. The
   * split ruled that calling a projection-based copy a *duplicate* breaks the
   * preservation promise in the one place nobody checks, and *Keep my draft* is
   * the reapply control's name and not this one's.
   *
   * **The transfer table says four things and not two.** `transferStatusOf` is
   * what decides which, in the model: a key carried with an empty value is written
   * as `label:` with nothing after it and an omitted key is not written at all —
   * step 1's `None`-is-not-`Some("")` contract, which a table saying only
   * *carried* would hide — and a mandatory field the transfer could not carry says
   * so, because its box below is deliberately blank rather than invented.
   *
   * **A carried value goes through `SourceText` and never into a box.** The four
   * optional fields have no control at all: they are what the file holds, and this
   * application's one rendering surface for a value it did not invent is the one
   * that *names* a character no font draws.
   *
   * **Only files this application may write into are listed.** That is the
   * opposite of the creator's list, and deliberately: `recoveryDestinationsOf`
   * carries nothing else, because recovery is an escape from a dead end rather
   * than a file browser. The sentence under the list says so, so a list shorter
   * than the sidebar is explained rather than merely short.
   *
   * **There is no placement control, and its absence is a sentence.** The position
   * is a fixed end, and that is **policy** rather than a consequence of anything
   * having gone missing: `manualResolution` is also reached by a field collision or
   * by a destination this application may not write into, and the source snippet
   * can still be perfectly identifiable in both. What recovery does not have is a
   * position it could *justify* — this application will not guess an anchor for a
   * new snippet out of a change it could not carry out — so `After` is refused
   * outright, and a person who wants another position performs a later
   * same-sequence move as its own operation.
   *
   * **An open form outlives the conflict it was opened from.** The panel is drawn
   * beside the outcome panel rather than inside its conflict arm, so dismissing
   * that conflict does not take a half-filled recovery form — and the two values a
   * person typed — with it. What became of that conflict is one sentence at the
   * top of the form, `tSourceConflictState`, and it names **an act**: an adoption
   * spent or a re-read ordered, never that the window moved, which this
   * application does not learn.
   *
   * **A committed create is never afterwards drawn as an error.** A failed
   * adoption is a line beside the saved arm through `view.messages`, exactly as it
   * is on the other six write surfaces.
   */

  const {
    availability,
    open,
    create,
    adoptDiskVersion
  }: {
    /**
     * Whether recovery has anything to offer on the calling surface.
     *
     * `recoveryAvailability`'s answer, computed by the host because only the host
     * knows its own draft kind, its own reapply attempt and its own conflict. It
     * is read on every render, so a destination list that has stopped being
     * writable stops being offered.
     */
    availability: RecoveryAvailability;
    /**
     * Opens a form, by whichever of the two entries the calling surface has.
     *
     * `startMatchFieldRecovery` on the match editor and
     * `startCreationFieldRecovery` on the creator; nothing here can tell them
     * apart, and nothing here needs to. It is called once per press, and its
     * `unavailable` arm is drawn rather than swallowed — the availability above is
     * derived a moment earlier and the two can disagree.
     */
    open: () => RecoveryStart;
    /**
     * Sends one recovery create.
     *
     * **`BrowserState.createMatch` and nothing else.** That method performs the
     * adoption a committed create owes — the created snippet's identity, and the
     * selection that follows it — before the answer is handed back; `createMatch`
     * in `../ipc/commands` is the same call without it. Nothing in TypeScript
     * stops a component reaching for the second, which is why it is written here.
     */
    create: CreateARecoveredSnippet;
    /**
     * Installs the disk observation a conflict of **this form's own** carried.
     *
     * `BrowserState.adoptDiskVersion`. It is never handed the conflict recovery
     * was opened from: that one is the host surface's, and this panel carries it
     * as an opaque value it passes to nothing.
     */
    adoptDiskVersion: AdoptTheDiskVersion<CreationBuffers>;
  } = $props();

  // `$state.raw`, not `$state`: a form is an immutable value replaced whole on
  // every transition, and its draft holds deep-frozen snapshots a reactive proxy
  // has no business walking.
  let session = $state.raw<RecoverySession | null>(null);

  /** Why the last press opened nothing, or `null`. */
  let refusedToOpen = $state.raw<RecoveryUnavailable | null>(null);

  /** Everything the form says about itself, or `null` when none is open. */
  const view = $derived(session === null ? null : recoveryView(session));

  /** Whether there is an offer to make or a reason worth showing. */
  const answerable = $derived(recoveryIsAnswerable(availability));

  /**
   * The transfer table, one row per field, with the phrase each row shows.
   *
   * Derived here rather than decided in markup: `transferStatusOf` is the model's
   * rule about which of the four things a row says, and a renderer that asked
   * `text === ''` itself would be the second copy of it.
   */
  const rows = $derived(
    (view?.fields ?? []).map((field) => ({ field, status: transferStatusOf(field) }))
  );

  /**
   * The last reapply attempt this panel made, or `null`.
   *
   * **Held with the session it produced**, which is what stops a report outliving
   * what it describes: `reapplyToShow` answers `null` the moment `session` is
   * replaced by anything else, and every transition in the model returns a new
   * value.
   */
  let reapplyAttempt = $state.raw<ReapplyAttempt<
    RecoverySession,
    RecoveryReapplyObstacle
  > | null>(null);

  /** What the last attempt left this panel to say, or `null`. */
  const reapplyReport = $derived(
    session === null ? null : reapplyToShow(reapplyAttempt, session)
  );

  /** Whether leaving the form is waiting on a confirmation. */
  let leaving = $state(false);

  /** The outcome panel's own element, so a reveal has something to point at. */
  let outcomePanel = $state<HTMLElement | null>(null);
  /** The conflict arm's row of controls, which is the second step's target. */
  let outcomeChoices = $state<HTMLElement | null>(null);
  /** The reapply report's own block, so an answer to a press can be seen. */
  let reapplyPanel = $state<HTMLElement | null>(null);

  /*
   * **The two reveals every write surface has, on the panel that is furthest down
   * the page of any of them.** This form is drawn *below* an already long conflict
   * panel, so an outcome of its own appears further from the visible band than any
   * other surface's. The decisions are `../browser/saveOutcome`'s and
   * `../browser/reapply`'s; the three `bind:this` targets are this file's.
   *
   * Neither can be checked by any test in this repository: jsdom lays nothing out
   * and does not implement `scrollIntoView`. 2c-4c-5 is the reading.
   */
  const reveal = $derived(
    outcomeReveal(view?.outcome?.kind ?? null, view?.awaitingReloadConfirmation ?? false)
  );
  $effect(() => {
    revealOutcome(reveal, outcomePanel, outcomeChoices);
  });
  $effect(() => {
    revealReapplyReport(reapplyReveal(reapplyReport?.kind ?? null), reapplyPanel);
  });

  /**
   * Does what one offered recovery choice says.
   *
   * A `switch` with no `default` over a union with one member, for
   * {@link conflictAction}'s reason: a second member of `RecoveryChoice` is a
   * compile error here rather than a control that silently opens the form.
   *
   * @param choice - The choice the person picked.
   */
  function recoveryAction(choice: RecoveryChoice): void {
    switch (choice) {
      case 'createFromSupportedFields':
        openRecovery();
        return;
    }
  } // End of function recoveryAction()

  /** Opens a form, or records why none was opened. */
  function openRecovery(): void {
    const start = open();
    if (start.kind === 'ready') {
      session = start.session;
      refusedToOpen = null;
      return;
    }
    refusedToOpen = start.reason;
  } // End of function openRecovery()

  /**
   * Chooses the file the new snippet goes in.
   *
   * @param document - The file chosen.
   */
  function onDestination(document: DocumentId): void {
    if (session !== null) {
      session = chooseRecoveryDestination(session, document);
    }
  } // End of function onDestination()

  /**
   * Records whatever one of the two boxes now holds.
   *
   * @param field - Which box.
   * @param text - The control's whole value.
   */
  function onTyped(field: CreationField, text: string): void {
    if (session !== null) {
      session = editRecoveryField(session, field, text);
    }
  } // End of function onTyped()

  /**
   * Records which box has the focus, ending the typing run when it moves.
   *
   * @param field - The field that now has it, or `null` for a blur.
   */
  function onFocus(field: CreationField | null): void {
    if (session !== null) {
      session = focusRecoveryField(session, field);
    }
  } // End of function onFocus()

  /** Goes back one step. */
  function onUndo(): void {
    if (session !== null) {
      session = undoRecoveryEdit(session);
    }
  } // End of function onUndo()

  /** Goes forward one step. */
  function onRedo(): void {
    if (session !== null) {
      session = redoRecoveryEdit(session);
    }
  } // End of function onRedo()

  /** Puts the outcome panel away and gives the controls back. */
  function onDismiss(): void {
    if (session !== null) {
      session = keepRecovering(session);
    }
  } // End of function onDismiss()

  /**
   * Sends the form, optionally accepting the findings on screen first.
   *
   * The acknowledgement is never assembled here: `acknowledgeRecoveryFindings`
   * records consent through the one function that can, and `beginRecoveryCreate`
   * reads it back through `submissionOf`, so what goes to the boundary is consent
   * bound to the exact candidate being sent or nothing at all.
   *
   * **The composition is `sendRecoveryCreate`'s and not this file's**: the base
   * revision, the `NewMatch`, the fixed end placement and the folding of all three
   * answers back into the form are one function in the model, so this handler is
   * one call and two assignments.
   *
   * **The second of those two happens before any await, and it is the whole
   * guarantee this handler carries** — the 2c-4c-3a review's first High.
   * `sendRecoveryCreate` hands the waiting form to `install` on the same tick as
   * the press and before the request is authorized, so `view.saving` is true for
   * the whole flight: the create control refuses with `saveInFlight`, *Stop
   * creating this snippet* is disabled, both boxes are read-only and the
   * destinations are inert. Without it every one of those stayed live until the
   * answer arrived, so a second create could be sent against the same base and a
   * late answer could replace a committed state with a conflict — reporting an
   * error after a committed write.
   *
   * The requirement is the model's, not this file's memory: the third argument has
   * no default, so a surface cannot compose a recovery create without being handed
   * the waiting form. What no type forces is that the callback below assigns it,
   * which is why `RecoveryPanel.test.ts` holds a create in flight and presses
   * everything.
   *
   * @param acknowledge - Whether this is the *Save anyway* control.
   */
  async function runCreate(acknowledge: boolean): Promise<void> {
    const held = session;
    if (held === null) {
      return;
    }
    const consented = acknowledge ? acknowledgeRecoveryFindings(held) : held;
    // A leaving confirmation raised before the send is about a question this send
    // has just answered differently, and leaving is refused while one is in flight.
    leaving = false;
    session = await sendRecoveryCreate(consented, create, (waiting) => {
      session = waiting;
    });
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
    if (session !== null) {
      session = keepRecovering(session);
    }
  } // End of function refusalAction()

  /**
   * Tries this form again, against the version on disk of its **own** conflict.
   *
   * **Two model calls and two assignments, and no rule of its own**, exactly as
   * the five match surfaces' reapply handlers are: `reapplyRecoveryToDiskVersion`
   * decides the whole rebase before it asks the window to move, and
   * `attemptOfReapply` is what decides which arms replace the session.
   */
  function keepMyDraft(): void {
    if (session === null) {
      return;
    }
    const attempt = attemptOfReapply(
      session,
      reapplyRecoveryToDiskVersion(session, adoptDiskVersion)
    );
    reapplyAttempt = attempt;
    session = attempt.session;
  } // End of function keepMyDraft()

  /**
   * Does what one conflict choice says.
   *
   * **Four of the five arms are reachable, and the fifth is withheld by the model
   * rather than by this markup.** `RECOVERY_CONFLICT_CAPABILITIES.offersCopyDraft`
   * is `false` because `RecoveryView` produces no retained-draft list to copy —
   * the two values are in this form's own boxes, on screen — so
   * `conflictChoicesFor` never names `copyDraft` and the arm below is written
   * only because the `switch` is exhaustive and has no `default`.
   *
   * **What the exhaustive switch forces, and what it does not.** A *new member* of
   * `ConflictChoice` fails to compile here. A *newly offered* member does not —
   * offering is the model's, and a choice becomes a control the moment
   * `conflictChoicesFor` names it. No type in this file could have forced that an
   * arm does anything, which is why the mounted suite presses every control this
   * panel draws.
   *
   * @param choice - The choice the person picked.
   */
  function conflictAction(choice: ConflictChoice): void {
    const held = session;
    if (held === null) {
      return;
    }
    switch (choice) {
      case 'keepEditing':
        session = keepRecovering(held);
        return;
      case 'keepMyDraft':
        keepMyDraft();
        return;
      case 'reloadDiskVersion':
        session = askToReloadRecoveryDiskVersion(held);
        return;
      case 'confirmReload':
        // **Two calls, one click**, exactly as the other six surfaces' reloads
        // are: the two steps a person sees are the warning and this press. The
        // window is what decides whether the adoption happened, and the form ends
        // only if it did — so a refusal leaves this panel open rather than closing
        // it over a window that never moved.
        session = reloadRecoveryDiskVersion(confirmRecoveryDiskReload(held), adoptDiskVersion);
        return;
      case 'copyDraft':
        // Never offered here; see this function's own note.
        return;
    }
  } // End of function conflictAction()

  /**
   * Leaves the form, asking first when there is something typed to lose.
   *
   * **Refused outright while a send is in flight**, for 2c-1b's reason: the
   * request has already been authorized and cannot be cancelled, so removing the
   * form would leave it free to commit with its outcome drawn nowhere.
   */
  function requestClose(): void {
    if (view === null || view.saving) {
      return;
    }
    if (view.dirty) {
      leaving = true;
      return;
    }
    abandon();
  } // End of function requestClose()

  /**
   * Leaves the form, discarding what was typed. Refused while a send is in flight.
   *
   * **It answers the source conflict with nothing**, which is the point: the host
   * surface still shows it, its draft is still retained, and nothing here was
   * written. That is the ending `recovery.test.ts` calls abandonment.
   */
  function abandon(): void {
    if (view !== null && view.saving) {
      return;
    }
    session = null;
    refusedToOpen = null;
    reapplyAttempt = null;
    leaving = false;
  } // End of function abandon()
</script>

<section class="recovery" aria-label={t('browser.recovery.label')}>
  {#if view !== null}
    {@const form = view}
    <div class="head">
      <h3>{t('browser.recovery.label')}</h3>
      {#if form.dirty}
        <span class="marker warn">{t('browser.recovery.unsaved')}</span>
      {/if}
      <button type="button" disabled={form.saving} onclick={() => requestClose()}>
        {t('browser.recovery.close')}
      </button>
    </div>

    <!-- What became of the conflict this was opened from. One sentence, from the
         model, naming an act and never an outcome: an adoption spent or a re-read
         ordered, never that the window moved. -->
    <p class="kind">{tSourceConflictState(form.sourceConflict)}</p>

    {#if form.closed}
      <p class="kind">{t('browser.recovery.closed')}</p>
    {/if}

    {#if form.saving}
      <p class="kind">{t('browser.recovery.savingCannotBeStopped')}</p>
    {/if}

    {#if leaving}
      <div class="panel">
        <p>{t('browser.recovery.discardWarning')}</p>
        <p class="choices">
          <button type="button" disabled={form.saving} onclick={() => abandon()}>
            {t('browser.recovery.discard')}
          </button>
          <button type="button" onclick={() => (leaving = false)}>
            {tRawSaveChoice('keepEditing', RECOVERY_CONFLICT_CAPABILITIES.draftKind)}
          </button>
        </p>
      </div>
    {/if}

    <p class="kind">{t('browser.recovery.what')}</p>

    <h4>{t('browser.recovery.transferHeading')}</h4>
    <ul class="transfer">
      {#each rows as row (row.field.field)}
        <li>
          <span class="marker">{tDetailField(row.field.label)}</span>
          <span class="marker">{tTransferStatus(row.status)}</span>
          {#if row.field.transfer.kind === 'carried'}
            <!-- Through `SourceText` rather than into a box: four of the six have
                 no control at all, and a projected value may hold a character no
                 font draws, which this is the one surface that names. -->
            <SourceText text={row.field.transfer.text} />
          {:else}
            <span class="kind">{tTransferRefusal(row.field.transfer.reason)}</span>
          {/if}
        </li>
      {/each}
    </ul>

    <div class="field">
      <p class="name">{t('browser.recovery.destination')}</p>
      <!-- Only eligible files, which is `recoveryDestinationsOf`'s decision and
           not this markup's: the list carries nothing else. The sentence below is
           what keeps a list shorter than the sidebar an explanation rather than an
           omission. -->
      <ul class="destinations">
        {#each form.destinations as destination (destination.document)}
          <li>
            <button
              type="button"
              class="choice"
              aria-pressed={form.chosen !== null && form.chosen.document === destination.document}
              disabled={!form.editable}
              onclick={() => onDestination(destination.document)}
            >
              {destination.path}
            </button>
          </li>
        {/each}
      </ul>
      <p class="kind">{t('browser.recovery.destinationScope')}</p>
    </div>

    <!-- No placement control, and its absence is a sentence: the position is a
         fixed end and `RECOVERY_POSITION` is the only value anywhere. -->
    <p class="kind">{t('browser.recovery.position')}</p>

    <div class="field">
      <label>
        <span class="name">{tDetailField('trigger')}</span>
        <input
          class="text"
          type="text"
          spellcheck="false"
          readonly={!form.editable}
          value={form.trigger}
          oninput={(event) => onTyped('trigger', event.currentTarget.value)}
          onfocus={() => onFocus('trigger')}
          onblur={() => onFocus(null)}
        />
      </label>
      <!-- The `<input>`'s measured normalisation, disclosed beside the `<input>`. -->
      <p class="kind">{t('browser.recovery.lineEndings.trigger')}</p>
    </div>

    <div class="field">
      <label>
        <span class="name">{tDetailField('replace')}</span>
        <textarea
          class="text body"
          spellcheck="false"
          readonly={!form.editable}
          value={form.replace}
          oninput={(event) => onTyped('replace', event.currentTarget.value)}
          onfocus={() => onFocus('replace')}
          onblur={() => onFocus(null)}
        ></textarea>
      </label>
      <!-- The `<textarea>`'s, which is a different fact and so a different sentence. -->
      <p class="kind">{t('browser.recovery.lineEndings.replace')}</p>
    </div>

    <div class="actions">
      <p class="choices">
        <button type="button" disabled={!form.canUndo} onclick={() => onUndo()}>
          {t('browser.recovery.undo')}
        </button>
        <button type="button" disabled={!form.canRedo} onclick={() => onRedo()}>
          {t('browser.recovery.redo')}
        </button>
        <button type="button" disabled={!form.canCreate} onclick={() => void runCreate(false)}>
          {t('browser.recovery.create')}
        </button>
        {#if form.saving}
          <span class="marker">{t('browser.recovery.saving')}</span>
        {/if}
      </p>
      <!-- Every refusal has a code, so a disabled control says why. -->
      {#if form.refusal !== null}
        <p class="kind">{tRecoveryRefusal(form.refusal)}</p>
      {/if}
    </div>

    {#if form.sendFailure !== null}
      {@const failure = form.sendFailure}
      <div class="panel">
        <p>
          {failure.kind === 'mayHaveWritten'
            ? t('browser.recovery.mayHaveWritten')
            : t('browser.recovery.sendFailed')}
        </p>
        {#if form.failureLines.length > 0}
          <p class="kind">{t('browser.recovery.failureReason')}</p>
          {#each form.failureLines as line, index (index)}
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

    <!-- What the last *Keep my draft* left to say. Outside the outcome panel on
         purpose: a reapply that succeeded hands back a session with no outcome at
         all, so a report drawn inside that block would disappear at the moment it
         had something to report. -->
    {#if reapplyReport !== null}
      {@const report = reapplyReport}
      <div class="panel reapply" role="status" bind:this={reapplyPanel}>
        <p>{tReapplyOutcome(report.kind)}</p>
        {#if report.kind === 'manualResolution'}
          <p class="kind">{tRecoveryReapplyObstacle(report.obstacle)}</p>
        {/if}
      </div>
    {/if}

    {#if form.outcome !== null}
      {@const outcome = form.outcome}
      <div class="panel" role="status" bind:this={outcomePanel}>
        {#each form.messages as message, index (index)}
          <p>{tSaveOutcomeMessage(message)}</p>
        {/each}

        {#if outcome.kind === 'saved'}
          {#if form.notes.length > 0}
            <p class="kind">{t('browser.recovery.notes')}</p>
            <ul>
              {#each form.notes as note, index (index)}
                <li>{tPresentationNote(note)}</li>
              {/each}
            </ul>
          {/if}
          {#if form.committed}
            <p class="kind">{t('browser.recovery.committed')}</p>
            <!-- `created` is `null` on a legal committed create: the command
                 answers no identity when the file changed again between the write
                 and the read that followed it. -->
            {#if form.created === null}
              <p class="kind">{t('browser.recovery.createdNotIdentified')}</p>
            {/if}
          {:else}
            <p class="choices">
              <button type="button" onclick={() => onDismiss()}>
                {t('browser.notice.dismiss')}
              </button>
            </p>
          {/if}
        {:else if outcome.kind === 'refused'}
          <p class="kind">{tSaveVerdict(outcome.verdict)}</p>
          {#if outcome.findings.length > 0}
            <p class="kind">{t('browser.recovery.findings')}</p>
            <ul>
              {#each outcome.findings as finding, index (index)}
                <li>{tFindingCode(finding.code)}</li>
              {/each}
            </ul>
          {/if}
          {#if form.findingsAreStale}
            <p class="kind">{t('browser.recovery.findingsAreStale')}</p>
          {/if}
          <p class="choices">
            {#each form.refusalChoices as choice (choice)}
              <button type="button" onclick={() => refusalAction(choice)}>
                {tRawSaveChoice(choice, RECOVERY_CONFLICT_CAPABILITIES.draftKind)}
              </button>
            {/each}
          </p>
        {:else}
          {@const conflict = outcome}
          <p class="kind">
            {t('browser.recovery.revisionExpected', { revision: conflict.expected })}
          </p>
          <p class="kind">{t('browser.recovery.revisionFound', { revision: conflict.found })}</p>
          <p class="kind">
            {t('browser.recovery.revisionDisk', { revision: conflict.diskRevision })}
          </p>

          <h4>{t('browser.saveOutcome.diskVersion')}</h4>
          <!-- The whole file as the command layer read it, paired with
               `diskRevision`, and never a projection of "the same snippet". Which
               arm is drawn is `conflictDiskText`'s decision and not this markup's. -->
          {#if form.diskText !== null && form.diskText.kind === 'text'}
            <SourceText text={form.diskText.text} documentStart />
          {:else}
            <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
          {/if}

          <!-- The second step's warning. The shared line above is the whole
               close/abandon guarantee and this one never restates it; it says only
               what this panel alone can say. -->
          {#if form.awaitingReloadConfirmation}
            <p class="kind">{t('browser.recovery.reloadEndsRecovery')}</p>
          {/if}

          <!-- A control that has just gone, with the reason in its place. -->
          {#if form.reloadUnavailable}
            <p class="kind">{tReloadUnavailable(RECOVERY_CONFLICT_CAPABILITIES.draftKind)}</p>
          {/if}

          <!-- The line beside *Keep my draft*, drawn when the model names that
               choice and never from this panel's own declaration, so the sentence
               and the control cannot disagree. -->
          {#if reapplyIsOffered(form.conflictChoices)}
            <p class="kind">{tReapplyReadiness(RECOVERY_CONFLICT_CAPABILITIES.draftKind)}</p>
          {/if}

          <p class="choices" bind:this={outcomeChoices}>
            {#each form.conflictChoices as choice (choice)}
              <button type="button" onclick={() => conflictAction(choice)}>
                {tConflictChoice(choice, RECOVERY_CONFLICT_CAPABILITIES.draftKind)}
              </button>
            {/each}
          </p>
        {/if}
      </div>
    {/if}
  {:else if refusedToOpen !== null}
    <!-- The press answered `unavailable`. The availability below was derived a
         moment earlier and the two can disagree, so what is drawn is what the
         attempt itself said. -->
    <p class="kind">{tRecoveryUnavailable(refusedToOpen)}</p>
  {:else if availability.kind === 'offered'}
    <p class="choices">
      {#each availability.choices as choice (choice)}
        <button type="button" onclick={() => recoveryAction(choice)}>
          {tRecoveryChoice(choice)}
        </button>
      {/each}
    </p>
  {:else if answerable}
    <!-- `recoveryIsAnswerable` is the model's rule about which refusals are worth a
         sentence: two of the five mean recovery has not been *reached* rather than
         that it cannot help, and drawing those would explain an unoffered control
         on a screen that is not about it. -->
    <p class="kind">{tRecoveryUnavailable(availability.reason)}</p>
  {/if}
</section>

<style>
  .recovery {
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

  h3,
  h4 {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    font-weight: 600;
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

  /* One row per field the new snippet is made from, name and phrase above the
     value. A column, so the value below keeps the full width `SourceText` needs to
     scroll sideways in. */
  .transfer {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .transfer li {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  /* One row per file this panel may write into. Bounded and scrolling inside
     itself for `MatchCreator.svelte`'s reason: an unbounded list makes the form's
     height depend on the number of files, which pushes the primary control below
     the fold on a workspace with many of them. Nothing is hidden. */
  .destinations {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 9rem;
    overflow-y: auto;
  }

  .choice {
    font-family: var(--font-mono);
    text-align: start;
  }

  .choice[aria-pressed='true'] {
    background: var(--surface-raised);
  }

  /* A value the file will hold, in the face that means "this is what the document
     holds" (`src/app.css`). */
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

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
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
