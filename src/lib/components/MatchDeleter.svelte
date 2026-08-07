<script lang="ts">
  import { labelText, triggerLabel } from '../browser/labels';
  import {
    acknowledgeDeletionFindings,
    acknowledgementOf,
    applyDeletion,
    askToReloadDiskVersion,
    baseRevisionOf,
    cancelDelete,
    confirmDelete,
    CONFLICT_CAPABILITIES,
    confirmDiskReload,
    deletionCouldNotBeSent,
    dismissDeletionOutcome,
    identityInProjection,
    matchDeletionView,
    reloadTheDiskVersion,
    requestDelete,
    startMatchDeletion
  } from '../browser/matchDeletion';
  import type { AdoptTheDiskVersion } from '../browser/editorSave';
  import { outcomeReveal, type ConflictChoice } from '../browser/saveOutcome';
  import type { RawSaveChoice } from '../browser/rawSave';
  import type { MatchSaveAnswer } from '../browser/workspace.svelte';
  import { revealOutcome } from './reveal';
  import SourceText from './SourceText.svelte';
  import {
    t,
    tConflictChoice,
    tConflictOperation,
    tDeletionRefusal,
    tDetailField,
    tDraftError,
    tEditError,
    tFindingCode,
    tIpcFailure,
    tPresentationNote,
    tRawSaveChoice,
    tReloadUnavailable,
    tSaveError,
    tSaveOutcomeMessage,
    tSaveVerdict,
    tTriggerKind
  } from '../i18n';
  import type {
    Acknowledgement,
    ContentRevision,
    DocumentSummary,
    DocumentView,
    MatchId,
    MatchView
  } from '../ipc/types';

  /*
   * Deleting one snippet: the two-phase confirmation, on a screen.
   *
   * **This file is presentation.** What may be deleted, what a confirmation
   * means, what consumes one, when a deletion may start and what a commit spends
   * are all in `../browser/matchDeletion.ts`, which has a test suite. This walks
   * `matchDeletionView`'s answer.
   *
   * **The confirmation is the model's, and the reason it exists is not
   * tidiness.** The save protocol's acknowledgement round trip engages only for a
   * finding-bearing candidate, so a clean deletion of an ordinary snippet collects
   * consent nowhere: without the two phases below, one click writes the user's
   * file with no in-app undo, and restore-from-backup is Phase 2c-5 and does not
   * exist. A dialog written in this file would put that rule where nothing in this
   * repository can test it.
   *
   * **`confirmDelete`'s second argument is read from the live projections, here,
   * at the moment of the click.** `identityInProjection(projections(), ...)` and
   * never `session.match`: the session's own identity was minted at the same
   * instant as the pending consent, so the two agree however stale they both are,
   * and a confirmation retained across a re-read of the file would still pass. The
   * `projections` prop is a **function** for exactly this reason — a captured
   * array is a snapshot, and a snapshot is what the check exists to notice. What
   * no type here forces, in the same sentence: nothing stops a caller passing a
   * function that answers a stale array, or `() => []`, and nothing in
   * `matchDeletion.ts` can see where its argument came from.
   *
   * **The question is asked when this opens.** The detail pane's control is what
   * a person clicked; opening with nothing pending would make them click a second
   * identical control before being asked anything. `requestDelete` refuses when the
   * snippet is not deletable, so a refused snippet opens with its reason and no
   * question — which is the consult's Q6 read literally: disabled, with the
   * localized reason inline, and the core's own refusal still authoritative.
   *
   * **A refusal is acknowledged and then confirmed again.** *Save anyway*
   * re-raises the question rather than sending: `confirmDelete` consumes the
   * pending request, so consent is for one attempt, and the second attempt is a
   * second answer to a question the person can see.
   *
   * **What a committed deletion leaves is not this file's to decide.** The
   * selection is repaired by `BrowserState.deleteMatch` before the answer arrives
   * here — the snippet now at the deleted one's former position, or the new last
   * one, with the `deleted` notice the detail pane draws above this panel. Nothing
   * in this file holds a `MatchId` that outlives the commit except the session's
   * record of *what was deleted*, which is offered as nothing and cannot be acted
   * on: `deleted` is set and no transition in the model clears it.
   *
   * **The conflict panel shows two sides and identifies nothing across them.** The
   * retained side is `view.conflictOperation` — the model's summary of what this
   * session asked for — because a `MatchId` is a revision-scoped protocol carrier
   * and not authored text, which is why the consult's Q4 refuses a copy here as a
   * property of the drafted value and `conflictChoicesFor` refuses it whatever this
   * surface declares. The disk side is the whole file text the command layer read,
   * through `SourceText`. Which arm of the disk text is drawn is
   * `conflictDiskText`'s decision and not this markup's. The confirmed reload
   * installs the disk projection and **closes** this panel: nothing is loaded in
   * its place, because finding "the same" snippet in another revision is 2c-4b.
   */

  const {
    projection,
    match,
    file,
    projections,
    remove,
    adoptDiskVersion,
    close
  }: {
    /**
     * The file's projection, **captured with the snippet**.
     *
     * One assignment at the call site, which is 2c-2-2's High finding one level
     * up: a projection and a snippet taken from two reads type-check perfectly and
     * can describe two different parses.
     */
    projection: DocumentView;
    /** The snippet being deleted, as it was projected when this opened. */
    match: MatchView;
    /** The file it lives in, for the person to see which one it is. */
    file: DocumentSummary | null;
    /**
     * Every projection this window holds **now**.
     *
     * A function and not an array: see this file's note on the confirmation.
     */
    projections: () => readonly DocumentView[];
    /**
     * Sends one deletion.
     *
     * **`BrowserState.deleteMatch` and nothing else.** That method re-reads the
     * file and repairs the selection before the answer is handed back;
     * `deleteMatch` in `../ipc/commands` is the same call without it, and a
     * component that reached for it would leave every `MatchId` this window holds
     * for the file pointing at bytes that are gone. Nothing in TypeScript stops
     * that, which is why it is written here.
     *
     * @param id - The snippet to delete, by the identity confirmed.
     * @param baseRevision - The revision the session was opened at.
     * @param acknowledgement - The suspicions already shown to a person.
     * @returns The outcome and the adoption's fate, or a typed failure.
     */
    remove: (
      id: MatchId,
      baseRevision: ContentRevision,
      acknowledgement: Acknowledgement
    ) => Promise<MatchSaveAnswer>;
    /** Leaves the deletion panel. */
    /**
     * Installs the disk observation a conflict carried into the window.
     *
     * `BrowserState.adoptDiskVersion`, the sole frontend transition that moves
     * this window to the disk side of a conflict. It is called by
     * `reloadTheDiskVersion` and by nothing here, so the projection cannot be
     * replaced without this deleter closing in the same call — and a `refused` from
     * it is honoured by closing nothing, while an `alreadyThere` is a success the
     * transition finishes on.
     */
    adoptDiskVersion: AdoptTheDiskVersion<MatchId>;
    close: () => void;
  } = $props();

  // `$state.raw`: a session is an immutable value replaced whole on every
  // transition. Capturing the projection once is the point — a session that
  // re-derived itself from its props would be replaced every time the workspace
  // re-read the file, which is precisely the event the confirmation must notice
  // rather than absorb.
  // svelte-ignore state_referenced_locally
  let session = $state.raw(requestDelete(startMatchDeletion(projection, match)));
  const view = $derived(matchDeletionView(session));

  /**
   * Whether the last confirmation was refused by the model.
   *
   * Set when {@link confirmDelete} answers `null` — which, for a person who has
   * just clicked *Delete it*, means the identity the live projection gives this
   * snippet is not the one they were asked about. The alternative is a control
   * that silently does nothing.
   */
  let confirmationRefused = $state(false);

  /** The outcome panel's own element, so it can be brought into view. */
  let outcomePanel = $state<HTMLElement | null>(null);
  /** The conflict arm's row of controls, which is the second step's target. */
  let outcomeChoices = $state<HTMLElement | null>(null);

  /*
   * **The outcome panel is scrolled into view when it appears** — 2c-4a-3c's
   * findings 10.3 and 10.4. This panel opened highest of the six (y = 209) and its
   * controls were still below the fold at y = 863 in a 728 px viewport, with
   * `section.detail`'s `scrollTop` at `0` and nothing moving it. The decision is
   * `./reveal.ts`'s and the two `bind:this` targets are this file's.
   */
  const reveal = $derived(
    outcomeReveal(view.outcome?.kind ?? null, view.awaitingReloadConfirmation)
  );
  $effect(() => {
    revealOutcome(reveal, outcomePanel, outcomeChoices);
  });

  /** What the snippet fires from, for the person to recognise it by. */
  const named = $derived(triggerLabel(match));

  /** The snippet's own label, or `null`. */
  const label = $derived(labelText(match));

  /** Asks the person to confirm. */
  function onRequest(): void {
    confirmationRefused = false;
    session = requestDelete(session);
  } // End of function onRequest()

  /**
   * Takes the question back and leaves.
   *
   * Leaving as well as cancelling, because this panel replaces the snippet the
   * person was reading: a cancelled question that stayed on screen would leave
   * them looking at a deletion panel they had just declined.
   */
  function onCancel(): void {
    session = cancelDelete(session);
    confirmationRefused = false;
    close();
  } // End of function onCancel()

  /** Puts the outcome away. */
  function onDismiss(): void {
    session = dismissDeletionOutcome(session);
  } // End of function onDismiss()

  /**
   * Confirms, and sends what the confirmation produced.
   *
   * The identity handed to {@link confirmDelete} is read from the **live**
   * projections here and nowhere else; see this file's own note for what that
   * closes and what no type can.
   */
  async function runDelete(): Promise<void> {
    const started = confirmDelete(session, identityInProjection(projections(), session.match));
    if (started === null) {
      confirmationRefused = true;
      return;
    }
    confirmationRefused = false;
    session = started.session;
    const answer = await remove(
      started.match,
      // **The session's own base, never the window's current projection.** A
      // deletion resolves an identity to a *position*, so a session opened at one
      // revision and sent after the window has re-read the file must conflict
      // rather than remove whatever now sits there.
      baseRevisionOf(started.session),
      acknowledgementOf(started.submission)
    );
    // Three arms, and each says something different about the file. `notAttempted`
    // is this window refusing before a command ran; `failed` is a command that ran
    // and rejected, and it always carries why.
    if (answer.kind === 'answered') {
      session = applyDeletion(session, answer.result, answer.adoption);
      return;
    }
    session =
      answer.kind === 'notAttempted'
        ? deletionCouldNotBeSent(session, false, null)
        : deletionCouldNotBeSent(session, answer.mayHaveWritten, answer.failure);
  } // End of function runDelete()

  /**
   * Does what one refusal choice says.
   *
   * *Save anyway* records the consent and **asks again**: `confirmDelete` consumed
   * the pending request when the refused attempt was sent, and consent is for one
   * attempt. So the question comes back with the findings still on screen, and the
   * person answers it about the transaction they can read.
   *
   * @param choice - The choice the person picked.
   */
  function refusalAction(choice: RawSaveChoice): void {
    if (choice === 'saveAnyway') {
      confirmationRefused = false;
      session = requestDelete(acknowledgeDeletionFindings(session));
      return;
    }
    session = dismissDeletionOutcome(session);
  } // End of function refusalAction()

  /**
   * Does what one conflict choice says.
   *
   * **Three of the four arms are reachable as of 2c-4a-3b.**
   * `matchDeletion.ts`'s `CONFLICT_CAPABILITIES` declares this draft an
   * `operationChoice` — a `MatchId` is a revision-scoped protocol carrier, not user
   * content — so *Copy draft* can never be offered here, whatever a later change
   * sets; `offersReload` is now `true`, so `conflictChoicesFor` names the two
   * reload labels and this panel draws them. The reload adopts the disk projection
   * and **closes** the deleter; it was built and wired at 2c-4a-2 and is driven by
   * `matchDeletion.test.ts`.
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
        session = dismissDeletionOutcome(session);
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
        // Never offered here: this surface's `CONFLICT_CAPABILITIES` says what
        // its draft is, and `conflictChoicesFor` refuses a copy of anything but
        // authored text. The arm exists so the `switch` stays exhaustive.
        return;
    }
  } // End of function conflictAction()
</script>

<section class="deleter" aria-label={t('browser.matchDeletion.label')}>
  <div class="head">
    <h2>{t('browser.matchDeletion.label')}</h2>
    <button type="button" disabled={view.deleting} onclick={() => close()}>
      {t('browser.matchDeletion.close')}
    </button>
  </div>

  {#if file !== null}
    <dl>
      <dt>{t('browser.detail.file')}</dt>
      <dd class="source">{file.relative_path}</dd>
    </dl>
  {/if}

  <dl>
    <dt>{tDetailField('trigger')}</dt>
    <dd class="source">
      {#if named.kind === 'text'}
        {named.text}
      {:else}
        {tTriggerKind(named.code)}
      {/if}
    </dd>
    {#if label !== null}
      <dt>{tDetailField('label')}</dt>
      <dd>{label}</dd>
    {/if}
  </dl>

  <!-- The consult's Q6: refused in the value, said inline, and the core's own
       refusal still the one that decides. -->
  {#if view.refusal !== null}
    <p class="blocked">{tDeletionRefusal(view.refusal)}</p>
  {/if}

  {#if view.deleting}
    <p class="kind">{t('browser.matchDeletion.deletingCannotBeStopped')}</p>
    <p class="marker">{t('browser.matchDeletion.deleting')}</p>
  {/if}

  {#if confirmationRefused}
    <p class="kind">{t('browser.matchDeletion.confirmationRefused')}</p>
  {/if}

  {#if view.confirming}
    <div class="panel">
      <p>{t('browser.matchDeletion.question')}</p>
      <p class="choices">
        <button type="button" disabled={view.deleting} onclick={() => void runDelete()}>
          {t('browser.matchDeletion.confirm')}
        </button>
        <button type="button" disabled={view.deleting} onclick={() => onCancel()}>
          {t('browser.matchDeletion.cancel')}
        </button>
      </p>
    </div>
  {:else if view.canDelete}
    <p class="choices">
      <button type="button" onclick={() => onRequest()}>
        {t('browser.matchDeletion.request')}
      </button>
    </p>
  {/if}

  {#if view.sendFailure !== null}
    {@const failure = view.sendFailure}
    <div class="panel">
      <p>
        {failure.kind === 'mayHaveWritten'
          ? t('browser.matchDeletion.mayHaveWritten')
          : t('browser.matchDeletion.sendFailed')}
      </p>
      {#if view.failureLines.length > 0}
        <p class="kind">{t('browser.matchDeletion.failureReason')}</p>
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
    <div class="panel" role="status" bind:this={outcomePanel}>
      {#each view.messages as message, index (index)}
        <p>{tSaveOutcomeMessage(message)}</p>
      {/each}

      {#if outcome.kind === 'saved'}
        {#if view.notes.length > 0}
          <!-- **A deletion is the one command that produces
               `DoubledSequenceSeparation`**: the blank line a removed snippet
               leaves behind is a change to how the file is written, and plan
               section 6.2 is *never silently normalise*. -->
          <p class="kind">{t('browser.matchDeletion.notes')}</p>
          <ul>
            {#each view.notes as note, index (index)}
              <li>{tPresentationNote(note)}</li>
            {/each}
          </ul>
        {/if}
        {#if view.deleted}
          <p class="kind">{t('browser.matchDeletion.spent')}</p>
        {/if}
        <p class="choices">
          {#if view.deleted}
            <button type="button" onclick={() => close()}>
              {t('browser.matchDeletion.done')}
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
          <p class="kind">{t('browser.matchDeletion.findings')}</p>
          <ul>
            {#each outcome.findings as finding, index (index)}
              <li>{tFindingCode(finding.code)}</li>
            {/each}
          </ul>
        {/if}
        {#if view.findingsAreStale}
          <p class="kind">{t('browser.matchDeletion.findingsAreStale')}</p>
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
        <p class="kind">
          {t('browser.matchDeletion.revisionExpected', { revision: conflict.expected })}
        </p>
        <p class="kind">{t('browser.matchDeletion.revisionFound', { revision: conflict.found })}</p>
        <p class="kind">
          {t('browser.matchDeletion.revisionDisk', { revision: conflict.diskRevision })}
        </p>

        <h3>{t('browser.saveOutcome.retainedOperation')}</h3>
        <!-- What this session asked for, as the model summarises it. Nothing was
             typed here, so there is no draft to render and no copy to offer
             (consult Q4); the snippet it is about is named at the top of this
             panel, from the projection this session opened over. -->
        {#if view.conflictOperation !== null}
          <p>{tConflictOperation(view.conflictOperation)}</p>
        {/if}
        <p class="kind">{t('browser.saveOutcome.operationIdentityIsOld')}</p>

        <h3>{t('browser.saveOutcome.diskVersion')}</h3>
        <!-- The whole file as the command layer read it, paired with
             `diskRevision`, and never a projection of "the same snippet" — which
             this application will not identify across revisions (consult Q5).
             Which arm is drawn is `conflictDiskText`'s decision and not this
             markup's (2c-4a-3a review, finding 5). -->
        {#if view.diskText !== null && view.diskText.kind === 'text'}
          <SourceText text={view.diskText.text} documentStart />
        {:else}
          <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
        {/if}

        <!-- The second step's warning. The shared line above is the whole
             close/abandon guarantee and this one never restates it (2c-4a-3b
             review, finding 3); it says only what this surface alone can say —
             that no snippet in the new version will be guessed at, and what to do
             about that afterwards. -->
        {#if view.awaitingReloadConfirmation}
          <p class="kind">{t('browser.matchDeletion.reloadIdentifiesNoSnippet')}</p>
        {/if}

        <!-- A control that has just gone, with the reason in its place. -->
        {#if view.reloadUnavailable}
          <p class="kind">{tReloadUnavailable(CONFLICT_CAPABILITIES.draftKind)}</p>
        {/if}

        <p class="choices" bind:this={outcomeChoices}>
          {#each view.conflictChoices as choice (choice)}
            <button type="button" onclick={() => conflictAction(choice)}>
              {tConflictChoice(choice, CONFLICT_CAPABILITIES.draftKind)}
            </button>
          {/each}
        </p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .deleter {
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

  /* The conflict panel's two headings: what was asked for, and what is on disk. */
  h3 {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    font-weight: 600;
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

  /* Anything this app says about the deletion rather than about the snippet:
     the question, the outcome arms, a send that never left. */
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
    margin: 0;
    font-size: 0.6875rem;
    color: var(--muted);
  }

  /* This app declining to delete, bordered like the detail pane's own refusal
     because it is the same kind of statement. */
  .blocked {
    margin: 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
  }
</style>
