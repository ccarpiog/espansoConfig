<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    acknowledgeFindings,
    acknowledgeSnapshot,
    acknowledgementOf,
    applyObservation,
    applySave,
    askToReload,
    beginSave,
    confirmReload,
    CONFLICT_CAPABILITIES,
    editText,
    keepEditing,
    openRawSnippet,
    rawSnippetView,
    reconcileWithDisk,
    redoEdit,
    reloadTheDiskVersion,
    saveCouldNotBeSent,
    textToCopy,
    undoEdit,
    type RawSnippetFallback,
    type RawSnippetRefusal,
    type RawSnippetSession,
    type RawSnippetView,
    type RoundTripText
  } from '../browser/rawSnippet';
  import type { AdoptTheDiskVersion } from '../browser/editorSave';
  import type { RawSaveChoice } from '../browser/rawSave';
  import type { ObservationDelivery } from '../browser/observationDelivery';
  import type { BindObservationReceiver } from '../browser/surfaceReceivers';
  import type { MatchSaveAnswer } from '../browser/workspace.svelte';
  import { conflictOriginMessage, conflictRevisionsOf } from '../browser/conflictSource';
  import {
    isExternalConflict,
    outcomeReveal,
    type ConflictChoice,
    type ConflictModel
  } from '../browser/saveOutcome';
  import {
    decideSurfaceAcknowledgement,
    surfaceAcknowledgementOwed,
    type ReconciliationRefusal,
    type SurfaceAcknowledgementPort
  } from '../browser/reconciliationStatus';
  import {
    t,
    tConflictChoice,
    tConflictMessage,
    tConflictOriginMessage,
    tDraftError,
    tEditError,
    tFindingCode,
    tIpcFailure,
    tPresentationNote,
    tRawSaveChoice,
    tRawSnippetRefusal,
    tReloadUnavailable,
    tSaveError,
    tSaveOutcomeMessage,
    tSaveVerdict
  } from '../i18n';
  import type { CommandResult } from '../ipc/commands';
  import type {
    Acknowledgement,
    ContentRevision,
    DocumentId,
    DocumentSummary,
    MatchId,
    OwnedItemText
  } from '../ipc/types';
  import { copyReferenceText } from './clipboard';
  import { revealOutcome } from './reveal';
  import SnapshotAcknowledgement from './SnapshotAcknowledgement.svelte';
  import SourceText from './SourceText.svelte';

  /*
   * The local raw editor: one snippet's own lines, drafted and saved in place —
   * Phase 3-8-2, drawing `../browser/rawSnippet.ts` (Phase 3-8-1).
   *
   * **This file is presentation.** Whether the box is editable, whether *Undo*,
   * *Redo* and *Save* do anything, what a failed send says, when the whole-document
   * editor is offered, and what a reconciliation found are the model's values, read
   * off `rawSnippetView` and `reconcileWithDisk`. What is decided here is only
   * which of those values to draw where, and the four things below.
   *
   * **The text comes from the command, never from a slice.** On start this reads
   * `match_item_text` through the `read` prop, by the identity the pane captured,
   * and hands the answer whole to `openRawSnippet`. Nothing here holds a document's
   * text or a byte span.
   *
   * **The text area is controlled, not bound**, for `RawEditor.svelte`'s reason:
   * the model decides what the box holds, so an edit it refuses — during a save,
   * under a conflict, or one holding a carriage return (`CLAUDE.md` §6) — does not
   * land. *Undo* and *Redo* are disabled from `view.canUndo` / `view.canRedo`,
   * which are `canUndoEdit` / `canRedoEdit`: under a held save both are disabled
   * and neither handler changes anything (CF-55, ruling 13).
   *
   * **The reconciliation's fresh identity is the window's, asked for at the
   * press.** After a send that may have written, `BrowserState.saveMatchItemText`
   * re-reads the file; `identityInWindow` answers the snippet this window points at
   * in that file now, the component reads it again by that identity, and
   * `reconcileWithDisk` decides whether the text is one this session can place —
   * the opened text or the sent one, starting on the same line — or answers
   * `diverged`. What no type forces is that the identity names the same snippet;
   * the model's text and line checks are what refuse one that does not.
   *
   * **The whole-document fallback leaves through the pane.** `openWholeDocument`
   * closes this editor and shows the file's text, whose own *Edit* control opens
   * the whole-document editor; it is `null` while the window points at another
   * file, and a sentence says so instead of a control that would show the wrong
   * file. Leaving with unsaved text asks first, as *Stop editing* does.
   */

  const {
    match,
    file,
    read,
    save,
    identityInWindow,
    adoptDiskVersion,
    reportReceiver,
    acknowledgement,
    openWholeDocument,
    close
  }: {
    /** The snippet, by the identity the pane captured when the editor opened. */
    match: MatchId;
    /** The file it lives in, captured with it, so the header names the file written. */
    file: DocumentSummary;
    /**
     * Reads one snippet's owned text — `BrowserState.matchItemText`.
     *
     * @param id - The snippet, by identity.
     * @returns What `match_item_text` answered.
     */
    read: (id: MatchId) => Promise<CommandResult<OwnedItemText>>;
    /**
     * Sends one save — `BrowserState.saveMatchItemText`.
     *
     * @param id - The snippet, by the identity the draft was read with.
     * @param baseRevision - The revision the text was read at.
     * @param text - The exact text the range is to hold.
     * @param acknowledgement - The suspicions already shown to a person.
     * @returns How the save ended, or why it produced no outcome.
     */
    save: (
      id: MatchId,
      baseRevision: ContentRevision,
      text: string,
      acknowledgement: Acknowledgement
    ) => Promise<MatchSaveAnswer>;
    /**
     * The snippet this window points at in one file now, or `null` — the
     * reconciliation's fresh identity. Read at the press, never captured.
     *
     * @param document - The file this editor writes.
     * @returns The identity, or `null` when the window points at none there.
     */
    identityInWindow: (document: DocumentId) => MatchId | null;
    /** `BrowserState.adoptDiskVersion`, called only by `reloadTheDiskVersion`. */
    adoptDiskVersion: AdoptTheDiskVersion<RoundTripText>;
    /**
     * Reports this editor's observation receiver to the host. **Required**; what
     * it forces is only that a host supplies one — this component calls it once
     * while it starts and withdraws the binding when it is destroyed, which the
     * mounted suites establish.
     */
    reportReceiver: BindObservationReceiver;
    /** The window's side of the unknown-outcome acknowledgement, from the pane. */
    acknowledgement: SurfaceAcknowledgementPort;
    /**
     * Leaves this editor for the file's whole text, or `null` while this window
     * points at another file and the pane could not show this one's.
     */
    openWholeDocument: (() => void) | null;
    /** Leaves the editor. */
    close: () => void;
  } = $props();

  /** What the start-up read has come to: still reading, opened, or refused. */
  type Loading =
    | { readonly kind: 'reading' }
    | { readonly kind: 'opened' }
    | {
        readonly kind: 'refused';
        readonly refusal: RawSnippetRefusal;
        readonly fallback: RawSnippetFallback | null;
      };

  let loading = $state.raw<Loading>({ kind: 'reading' });

  // `$state.raw`: a session is an immutable value replaced whole on every
  // transition. `null` until the start-up read answers and after a refusal.
  let session = $state.raw<RawSnippetSession | null>(null);

  /**
   * Every delivery that arrived before the start-up read answered, in arrival
   * order — the 3-8-2 review's first finding. Plain, not reactive: it is read once,
   * by {@link start}, and never drawn.
   */
  let heldWhileReading: ObservationDelivery[] = [];

  /*
   * **The receiver, reported while this editor starts and withdrawn when it is
   * destroyed** — `RawEditor.svelte`'s pattern, so the pane's registration effect,
   * which runs after this, always finds a receiver. **A delivery that arrives
   * before the read answers is held, not dropped** (the 3-8-2 review's first
   * finding): the watcher may have raised a conflict over this file while the
   * text was being read, and `start` replays every held delivery through
   * `applyObservation` over the opened session before installing it, so no
   * session is ever drawn unrestricted over a change the window already decided
   * about. After a refused opening the held deliveries are dropped with nothing
   * to install them into.
   */
  // svelte-ignore state_referenced_locally
  const receiving = reportReceiver((delivery) => {
    if (session !== null) {
      session = applyObservation(session, delivery);
    } else if (loading.kind === 'reading') {
      heldWhileReading = [...heldWhileReading, delivery];
    }
  });
  onDestroy(() => {
    receiving.withdraw();
  });

  /**
   * Reads the snippet's text once and opens a session over it, or records why not.
   * Every delivery held during the read is replayed, first to last, over the
   * opened session before it is installed.
   */
  async function start(): Promise<void> {
    const answer = await read(match);
    const opening = openRawSnippet(match, answer);
    const held = heldWhileReading;
    heldWhileReading = [];
    if (opening.kind === 'opened') {
      let opened = opening.session;
      for (const delivery of held) {
        opened = applyObservation(opened, delivery);
      } // End of the loop over the deliveries held during the read
      session = opened;
      loading = { kind: 'opened' };
      return;
    }
    loading = { kind: 'refused', refusal: opening.refusal, fallback: opening.fallback };
  } // End of function start()

  void start();

  const view = $derived(session === null ? null : rawSnippetView(session));

  /** The conflict being shown, narrowed to the external arm, or `null`. */
  const external = $derived(
    view !== null && view.conflict !== null && isExternalConflict(view.conflict)
      ? view.conflict
      : null
  );

  /** The acknowledgement control for an external conflict, or `null`. */
  const acknowledgementControl = $derived(
    external === null
      ? null
      : decideSurfaceAcknowledgement(
          surfaceAcknowledgementOwed(view?.externalNotices ?? []),
          acknowledgement.refusalFor(external.source)
        )
  );

  /** One *Copy draft* and what became of it, against the conflict it was made under. */
  interface CopyDisclosure {
    /** The conflict on screen when the copy was asked for. */
    readonly conflict: ConflictModel<RoundTripText>;
    /** The exact text handed to the clipboard. */
    readonly text: string;
    /** Whether the clipboard took it. */
    readonly result: 'copied' | 'failed';
  }

  let copied = $state.raw<CopyDisclosure | null>(null);

  /** What the copy disclosure may say about the conflict on screen now. */
  const copyShown = $derived(
    copied !== null &&
      view !== null &&
      session !== null &&
      copied.conflict === view.conflict &&
      copied.text === textToCopy(session)
      ? copied.result
      : 'none'
  );

  /** Where leaving is waiting on a confirmation to go: nowhere, closed, or to the whole file. */
  let leaving = $state<'no' | 'close' | 'wholeDocument'>('no');

  /** What the last *Read the snippet from the file again* found, drawn until the next send. */
  type ReadAgain =
    | { readonly kind: 'none' }
    | { readonly kind: 'reading' }
    | { readonly kind: 'written' }
    | { readonly kind: 'notWritten' }
    | { readonly kind: 'diverged' }
    | { readonly kind: 'noIdentity' }
    | { readonly kind: 'refused'; readonly refusal: RawSnippetRefusal };

  let readAgain = $state.raw<ReadAgain>({ kind: 'none' });

  /** The outcome panel, for a reveal to point at. */
  let outcomePanel = $state<HTMLElement | null>(null);
  /** The conflict's row of controls, the second step's target. */
  let outcomeChoices = $state<HTMLElement | null>(null);
  /** The external conflict panel, the reveal's target when it shows. */
  let externalPanel = $state<HTMLElement | null>(null);

  const reveal = $derived(
    outcomeReveal(
      external !== null ? 'conflict' : (view?.outcome?.kind ?? null),
      view?.awaitingReloadConfirmation ?? false
    )
  );
  const externalShown = $derived(external !== null);
  $effect(() => {
    revealOutcome(reveal, externalShown ? externalPanel : outcomePanel, outcomeChoices);
  });

  /**
   * Presses the unknown-outcome acknowledgement through the session's own
   * transition, which asks the window at most once.
   *
   * @returns The refusal the window answered, or `null` when it ended the hold.
   */
  function acknowledgeTheSnapshot(): ReconciliationRefusal | null {
    const held = session;
    if (held === null) {
      return null;
    }
    const answer: { refusal: ReconciliationRefusal | null } = { refusal: null };
    session = acknowledgeSnapshot(held, (source) => {
      answer.refusal = acknowledgement.acknowledge(source);
      return answer.refusal === null ? 'acknowledged' : 'refused';
    });
    return answer.refusal;
  } // End of function acknowledgeTheSnapshot()

  /**
   * Sends the draft, optionally accepting the findings on screen first. Consent is
   * recorded by `acknowledgeFindings` and read back by `beginSave`, never
   * assembled here.
   *
   * @param acknowledge - Whether this is the *Save anyway* control.
   */
  async function runSave(acknowledge: boolean): Promise<void> {
    const held = session;
    if (held === null) {
      return;
    }
    const consented = acknowledge ? acknowledgeFindings(held) : held;
    const started = beginSave(consented, () =>
      session === held || session === null ? consented : session
    );
    if (started === null) {
      return;
    }
    session = started.session;
    copied = null;
    leaving = 'no';
    readAgain = { kind: 'none' };
    const answer = await save(
      started.match,
      started.submission.baseRevision,
      started.submission.candidate,
      acknowledgementOf(started.submission)
    );
    const installed = (): RawSnippetSession => session ?? started.session;
    // Three arms, as in `MatchEditor.svelte`: a refusal before any command ran
    // wrote nothing and has no reason; a command that rejected always carries one.
    if (answer.kind === 'answered') {
      session = applySave(installed(), answer.result, answer.adoption, installed);
      return;
    }
    session =
      answer.kind === 'notAttempted'
        ? saveCouldNotBeSent(installed(), false, null, installed)
        : saveCouldNotBeSent(installed(), answer.mayHaveWritten, answer.failure, installed);
  } // End of function runSave()

  /**
   * Reads the snippet again by the identity the window holds now, and hands the
   * answer to `reconcileWithDisk` — the one way out of a send that may have
   * written. The session reconciled is the one installed when the read answers,
   * so an edit made meanwhile is the text kept.
   */
  async function readTheSnippetAgain(): Promise<void> {
    const held = session;
    if (held === null || !held.needsReconciliation) {
      return;
    }
    const identity = identityInWindow(held.match.document);
    if (identity === null) {
      readAgain = { kind: 'noIdentity' };
      return;
    }
    readAgain = { kind: 'reading' };
    const answer = await read(identity);
    const now = session;
    if (now === null) {
      return;
    }
    const result = reconcileWithDisk(now, identity, answer);
    switch (result.kind) {
      case 'reconciled':
        session = result.session;
        readAgain = { kind: result.written ? 'written' : 'notWritten' };
        return;
      case 'diverged':
        readAgain = { kind: 'diverged' };
        return;
      case 'notReconciled':
        readAgain = result.refusal === null ? { kind: 'none' } : { kind: 'refused', refusal: result.refusal };
        return;
    }
  } // End of function readTheSnippetAgain()

  /**
   * Adopts the disk version into the window and ends this editor, which is what
   * a `closesSurface` reload does; a refused adoption closes nothing.
   */
  function loadTheDiskVersion(): void {
    const held = session;
    if (held === null) {
      return;
    }
    const confirmed = confirmReload(held);
    session = reloadTheDiskVersion(confirmed, adoptDiskVersion, () =>
      session === held || session === null ? confirmed : session
    );
    copied = null;
    if (session.closed) {
      close();
    }
  } // End of function loadTheDiskVersion()

  /**
   * Puts the retained draft on the clipboard, recording the result against the
   * conflict that was on screen when the copy was asked for.
   */
  async function copyTheDraft(): Promise<void> {
    const conflict = view === null ? null : view.conflict;
    const value = session === null ? null : textToCopy(session);
    if (conflict === null || value === null) {
      return;
    }
    const result = (await copyReferenceText(value)) ? 'copied' : 'failed';
    copied = { conflict, text: value, result };
  } // End of function copyTheDraft()

  /**
   * Records what the text area now holds.
   *
   * @param value - The text area's whole value.
   */
  function onTyped(value: string): void {
    if (session !== null) {
      session = editText(session, value);
    }
  } // End of function onTyped()

  /** Goes back one step; `undoEdit` refuses whatever `view.canUndo` disables. */
  function onUndo(): void {
    if (session !== null) {
      session = undoEdit(session);
    }
  } // End of function onUndo()

  /** Goes forward one step; `redoEdit` refuses whatever `view.canRedo` disables. */
  function onRedo(): void {
    if (session !== null) {
      session = redoEdit(session);
    }
  } // End of function onRedo()

  /** Puts the outcome away. */
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
        copied = null;
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
      case 'keepMyDraft':
      case 'confirmReloadKeeping':
        // Never offered here: `CONFLICT_CAPABILITIES` declares the reapply
        // `unavailable` and the reload `closesSurface`, and `conflictChoicesFor`
        // names neither choice for such a surface. The arms keep the `switch`
        // exhaustive.
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
    onDismiss();
  } // End of function refusalAction()

  /**
   * Leaves the editor for one destination, asking first when there is unsaved
   * text to lose. Refused while a save is in flight, as the controls are disabled.
   *
   * @param to - Where to go: closed, or to the file's whole text.
   */
  function requestLeave(to: 'close' | 'wholeDocument'): void {
    if (view !== null && view.saving) {
      return;
    }
    if (view !== null && view.dirty) {
      leaving = to;
      return;
    }
    leave(to);
  } // End of function requestLeave()

  /**
   * Leaves without asking. Refused while a save is in flight.
   *
   * @param to - Where to go.
   */
  function leave(to: 'close' | 'wholeDocument'): void {
    if (view !== null && view.saving) {
      return;
    }
    if (to === 'wholeDocument' && openWholeDocument !== null) {
      openWholeDocument();
      return;
    }
    close();
  } // End of function leave()
</script>

<!-- The whole-document fallback: a control while the pane can show this file's
     text, and a sentence saying why not otherwise. -->
{#snippet wholeDocumentOffer()}
  {#if openWholeDocument !== null}
    <p class="choices">
      <button
        type="button"
        disabled={view !== null && view.saving}
        onclick={() => requestLeave('wholeDocument')}
      >
        {t('browser.rawSnippet.openWholeDocument')}
      </button>
    </p>
  {:else}
    <p class="kind">{t('browser.rawSnippet.wholeDocumentElsewhere')}</p>
  {/if}
{/snippet}

<!-- The operand a refusal to open carries, beside its sentence. -->
{#snippet refusalDetail(refusal: RawSnippetRefusal)}
  {#if refusal.kind === 'notEditable'}
    <p class="kind">{tEditError(refusal.error)}</p>
  {:else if refusal.kind === 'unreadable'}
    <p class="kind">{tIpcFailure(refusal.failure)}</p>
  {/if}
{/snippet}

<!-- What a conflict of either origin shows beside its own lines, once for both. -->
{#snippet comparison(shown: RawSnippetView)}
  <h3>{t('browser.rawSnippet.diskVersion')}</h3>
  {#if shown.diskText !== null && shown.diskText.kind === 'text'}
    <SourceText text={shown.diskText.text} documentStart />
  {:else}
    <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
  {/if}

  {#if external !== null && acknowledgementControl !== null}
    <SnapshotAcknowledgement
      shown={external.source}
      decision={acknowledgementControl}
      acknowledge={acknowledgeTheSnapshot}
    />
  {/if}

  {#if shown.reloadUnavailable}
    <p class="kind">{tReloadUnavailable(CONFLICT_CAPABILITIES.draftKind)}</p>
  {/if}

  {#if copyShown === 'copied'}
    <p class="kind">{t('browser.rawSnippet.draftCopied')}</p>
  {:else if copyShown === 'failed'}
    <p class="kind">{t('browser.rawSnippet.draftCopyFailed')}</p>
  {/if}

  <p class="choices" bind:this={outcomeChoices}>
    {#each shown.conflictChoices as choice (choice)}
      <button
        type="button"
        disabled={choice === 'confirmReload' && !shown.canReload}
        onclick={() => conflictAction(choice)}
      >
        {tConflictChoice(choice, CONFLICT_CAPABILITIES.draftKind)}
      </button>
    {/each}
  </p>
{/snippet}

<section class="rawSnippet" aria-label={t('browser.rawSnippet.label')}>
  <div class="head">
    <dl>
      <dt>{t('browser.detail.file')}</dt>
      <dd class="source">{file.relative_path}</dd>
    </dl>
    {#if view !== null && view.dirty}
      <span class="marker warn">{t('browser.rawSnippet.unsaved')}</span>
    {/if}
    <button
      type="button"
      disabled={view !== null && view.saving}
      onclick={() => requestLeave('close')}
    >
      {t('browser.rawSnippet.close')}
    </button>
  </div>

  {#if loading.kind === 'reading'}
    <p class="kind">{t('browser.rawSnippet.loading')}</p>
  {:else if loading.kind === 'refused'}
    {@const refused = loading}
    <!-- The refusal and nothing else: no box, no save control, no draft. -->
    <div class="panel">
      <p>{tRawSnippetRefusal(refused.refusal)}</p>
      {@render refusalDetail(refused.refusal)}
      {#if refused.fallback === 'wholeDocumentEditor'}
        {@render wholeDocumentOffer()}
      {/if}
    </div>
  {:else if view !== null}
    <p class="kind">{t('browser.rawSnippet.scope')}</p>
    <p class="kind">{t('browser.rawSnippet.startsAt', { line: view.lines.first })}</p>

    {#if view.identityStale}
      <p class="panel">{t('browser.rawSnippet.identityStale')}</p>
    {/if}

    {#if view.saving}
      <p class="kind">{t('browser.rawSnippet.savingCannotBeStopped')}</p>
    {/if}

    <!-- **The confirmation promises only to discard the box's text** (the 3-8-2
         review's second finding). After a send that may have written, the draft
         stays dirty while the file may already hold it, so a sentence saying the
         changes were not written could be false; this one says what leaving does
         and claims nothing about what is on disk. -->
    {#if leaving !== 'no'}
      {@const to = leaving}
      <div class="panel">
        <p>{t('browser.rawSnippet.discardWarning')}</p>
        <p class="choices">
          <button type="button" disabled={view.saving} onclick={() => leave(to)}>
            {t('browser.rawSnippet.discard')}
          </button>
          <button type="button" onclick={() => (leaving = 'no')}>
            {tRawSaveChoice('keepEditing', CONFLICT_CAPABILITIES.draftKind)}
          </button>
        </p>
      </div>
    {/if}

    <textarea
      class="text"
      aria-label={t('browser.rawSnippet.label')}
      spellcheck="false"
      readonly={!view.editable}
      value={view.text}
      oninput={(event) => onTyped(event.currentTarget.value)}
    ></textarea>

    <p class="choices">
      <button type="button" disabled={!view.canUndo} onclick={() => onUndo()}>
        {t('browser.rawSnippet.undo')}
      </button>
      <button type="button" disabled={!view.canRedo} onclick={() => onRedo()}>
        {t('browser.rawSnippet.redo')}
      </button>
      <button type="button" disabled={!view.canSave} onclick={() => void runSave(false)}>
        {t('browser.rawSnippet.save')}
      </button>
      {#if view.saving}
        <span class="marker">{t('browser.rawSnippet.saving')}</span>
      {/if}
    </p>

    {#if view.sendFailure !== null}
      {@const failure = view.sendFailure}
      <div class="panel">
        <p>
          {failure.kind === 'mayHaveWritten'
            ? t('browser.rawSnippet.mayHaveWritten')
            : t('browser.rawSnippet.sendFailed')}
        </p>
        {#if view.trailingBlankLineRefused}
          <p>{t('browser.rawSnippet.trailingBlankLine')}</p>
        {/if}
        {#if view.failureLines.length > 0}
          <p class="kind">{t('browser.rawSnippet.failureReason')}</p>
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
        {#if view.fallback === 'wholeDocumentEditor'}
          {@render wholeDocumentOffer()}
        {/if}
      </div>
    {/if}

    {#if view.needsReconciliation}
      <div class="panel">
        <p>{t('browser.rawSnippet.needsReconciliation')}</p>
        <p class="choices">
          <button
            type="button"
            disabled={view.saving || readAgain.kind === 'reading'}
            onclick={() => void readTheSnippetAgain()}
          >
            {t('browser.rawSnippet.readAgain')}
          </button>
          {#if readAgain.kind === 'reading'}
            <span class="marker">{t('browser.rawSnippet.reading')}</span>
          {/if}
        </p>
      </div>
    {/if}

    {#if readAgain.kind === 'written'}
      <p class="panel">{t('browser.rawSnippet.reconciled.written')}</p>
    {:else if readAgain.kind === 'notWritten'}
      <p class="panel">{t('browser.rawSnippet.reconciled.notWritten')}</p>
    {:else if readAgain.kind === 'diverged'}
      <p class="panel">{t('browser.rawSnippet.reconciled.diverged')}</p>
    {:else if readAgain.kind === 'noIdentity'}
      <p class="panel">{t('browser.rawSnippet.reconciled.noIdentity')}</p>
    {:else if readAgain.kind === 'refused'}
      {@const refused = readAgain}
      <div class="panel">
        <p>{tRawSnippetRefusal(refused.refusal)}</p>
        {@render refusalDetail(refused.refusal)}
      </div>
    {/if}

    {#if external !== null}
      {@const revisions = conflictRevisionsOf(external.source)}
      <div class="panel external" role="status" bind:this={externalPanel}>
        <p>{tConflictOriginMessage(conflictOriginMessage(external.source))}</p>
        {#each view.externalMessages as message, index (index)}
          <p>{tConflictMessage(message)}</p>
        {/each}
        {#if revisions.kind === 'externalChange'}
          <p class="kind">
            {t('browser.externalConflict.revisionObserved', { revision: revisions.observed })}
          </p>
        {/if}
        {@render comparison(view)}
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
          {#if outcome.findings.length > 0}
            <p class="kind">{t('browser.rawEditor.findings')}</p>
            <ul>
              {#each outcome.findings as finding, index (index)}
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
          <p>{tConflictOriginMessage(conflictOriginMessage(conflict.source))}</p>
          <p class="kind">{t('browser.rawEditor.revisionExpected', { revision: conflict.expected })}</p>
          <p class="kind">{t('browser.rawEditor.revisionFound', { revision: conflict.found })}</p>
          <p class="kind">
            {t('browser.rawEditor.revisionDisk', { revision: conflict.diskRevision })}
          </p>
          {@render comparison(view)}
        {/if}
      </div>
    {/if}
  {/if}
</section>

<style>
  .rawSnippet {
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

  /* The snippet's own text, in the face `SourceText` uses; `white-space: pre`
     because a soft wrap is indistinguishable from a line break the file does
     not contain. */
  .text {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    white-space: pre;
    overflow: auto;
    min-height: 8rem;
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
