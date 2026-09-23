<script lang="ts">
  import {
    acknowledgementMintRefusalOf,
    acknowledgementRefusalOf,
    decideFileReconciliation,
    fileControlsDrawnAt,
    fileFactsOf,
    fileStatesDrawnAt,
    retryRefusalOf,
    rereadRefusalOf,
    routeControlNoteOf,
    routePathOf,
    standingSnapshotOf,
    workspaceFactsOf,
    type ReconciliationControl,
    type ReconciliationRefusal
  } from '../browser/reconciliationStatus';
  import type { FileStatePlacement } from '../browser/reconciliationStatus';
  import type { ConflictSource } from '../browser/conflictSource';
  import type { BrowserState } from '../browser/workspace.svelte';
  import type { IpcFailure } from '../ipc/errors';
  import type { DocumentId } from '../ipc/types';
  import {
    t,
    tIpcFailure,
    tReconciliationControl,
    tReconciliationFileState,
    tReconciliationRefusal,
    tReconciliationRouteNote,
    tUnreadableReason
  } from '../i18n';
  import SourceText from './SourceText.svelte';

  /*
   * What the window says about one file, at the placements one host stands for —
   * Phase 2d-6-9b-1.
   *
   * **Presentation only.** Which states exist, where each is drawn, which control is
   * offered and why one is disabled are `decideFileReconciliation`'s,
   * `fileStatesDrawnAt`'s and `fileControlsDrawnAt`'s in
   * `../browser/reconciliationStatus.ts`; this file walks their answers. Two hosts
   * mount it: `DetailPane.svelte` for the file its header speaks about (`header`,
   * `selectionNotice`, `surface`), and `ReconciliationStatus.svelte` for each file on
   * the workspace route (`workspaceRoute`, with the file's display path).
   *
   * **A press calls one `BrowserState` request and draws what it answered.** The
   * request rechecks every guard (entries 29 and 32), so an enabled control is a
   * prediction and a refused press draws its refusal through
   * `tReconciliationRefusal` — the same sentence a disabled control shows. A reread
   * that failed is not a refusal and draws `tIpcFailure`. Nothing here presses
   * anything on its own: closing a surface re-derives the decision and triggers
   * nothing (entry 16).
   *
   * **The acknowledgement mints from the origin drawn beside it.** `source` below is
   * read in the same render as the disk text it draws, and the press hands that
   * object to `uncertaintyAcknowledgementFor`; a newer origin re-renders both
   * together, because `standingConflictFor` subscribes to the hold tables. What this
   * cannot force is that a person read the text before pressing.
   */

  const {
    browser,
    document,
    placements,
    named = false
  }: {
    browser: BrowserState;
    document: DocumentId;
    placements: readonly FileStatePlacement[];
    named?: boolean;
  } = $props();

  const decision = $derived(decideFileReconciliation(workspaceFactsOf(browser), fileFactsOf(browser, document)));
  const states = $derived(fileStatesDrawnAt(decision, placements));
  const controls = $derived(fileControlsDrawnAt(decision, placements));
  const source = $derived(browser.standingConflictFor(document));

  /** What the last press of a control here answered, when it was not accepted. */
  let pressed = $state<{
    readonly control: ReconciliationControl;
    readonly refusal: ReconciliationRefusal | null;
    readonly failure: IpcFailure | null;
  } | null>(null);

  /**
   * Records what one press answered, so the next render draws it.
   *
   * @param control - The control pressed.
   * @param refusal - The refusal it answered, or `null`.
   * @param failure - A failed read's classified failure, or `null`.
   */
  function answered(
    control: ReconciliationControl,
    refusal: ReconciliationRefusal | null,
    failure: IpcFailure | null = null
  ): void {
    pressed = refusal === null && failure === null ? null : { control, refusal, failure };
  } // End of function answered()

  /**
   * Presses one control: one request, and its answer drawn.
   *
   * @param control - The control.
   * @param shown - The origin drawn beside the acknowledgement, or `null`.
   */
  async function press(control: ReconciliationControl, shown: ConflictSource | null): Promise<void> {
    pressed = null;
    switch (control) {
      case 'staleFileReread': {
        const outcome = await browser.requestFileReread(document);
        answered(control, rereadRefusalOf(outcome), outcome.kind === 'failed' ? outcome.failure : null);
        return;
      }
      case 'retryRetainedObservation':
        answered(control, retryRefusalOf(browser.retryRetainedObservation(document)));
        return;
      case 'acknowledgeUncertainty': {
        const token = shown === null ? null : browser.uncertaintyAcknowledgementFor(shown);
        if (token === null) {
          answered(control, acknowledgementMintRefusalOf(browser.uncertaintyAcknowledgementEligibility(document)));
          return;
        }
        answered(control, acknowledgementRefusalOf(browser.acknowledgeWriteUncertainty(token)));
        return;
      }
      case 'membershipReload':
      case 'lostHistoryRecovery':
        // Workspace controls: `ReconciliationStatus.svelte` draws them, never this file.
        return;
      default: {
        const unreachable: never = control;
        return unreachable;
      }
    }
  } // End of function press()
</script>

{#if states.length > 0 || controls.length > 0}
  <div class="fileStatus" role="status">
    {#if named}
      {@const path = routePathOf(browser, document)}
      <p class="path">
        {#if path === null}
          {t('browser.reconciliation.route.unlistedFile')}
        {:else}
          <span class="source">{path}</span>
        {/if}
      </p>
    {/if}
    {#each states as drawn (drawn.state.kind)}
      <p class="state">{tReconciliationFileState(drawn.state, drawn.placement)}</p>
      {#if drawn.state.kind === 'unavailable'}
        <p class="reason">{tUnreadableReason(drawn.state.reason)}</p>
      {/if}
    {/each}
    {#each controls as control (control.control)}
      {@const shown = control.control === 'acknowledgeUncertainty' ? source : null}
      {#if shown !== null}
        {@const snapshot = standingSnapshotOf(shown)}
        <p class="snapshotLabel">{t('browser.reconciliation.route.snapshot')}</p>
        {#if snapshot.kind === 'text'}
          <SourceText text={snapshot.text} documentStart />
        {:else}
          <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
        {/if}
      {/if}
      <p class="control">
        <button
          type="button"
          disabled={!control.enabled}
          onclick={() => void press(control.control, shown)}
        >
          {tReconciliationControl(control.control)}
        </button>
      </p>
      {#if !control.enabled}
        {@const note = routeControlNoteOf(control)}
        <p class="refusal">{tReconciliationRefusal(control.reason)}</p>
        {#if note !== null}
          <p class="refusal">{tReconciliationRouteNote(note)}</p>
        {/if}
      {/if}
      {#if pressed !== null && pressed.control === control.control}
        {#if pressed.refusal !== null}
          <p class="refusal pressed">{tReconciliationRefusal(pressed.refusal)}</p>
        {/if}
        {#if pressed.failure !== null}
          <p class="refusal pressed">{tIpcFailure(pressed.failure)}</p>
        {/if}
      {/if}
    {/each}
  </div>
{/if}

<style>
  /* No fixed width: the block is sized by whichever pane holds it, and Spanish
     sentences run longer (plan section 9). */
  .fileStatus {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0.5rem 0;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .fileStatus p {
    margin: 0;
  }

  .source {
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }

  .reason,
  .refusal,
  .snapshotLabel,
  .marker {
    color: var(--muted);
    font-size: 0.8125rem;
  }

  button {
    font: inherit;
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
  }

  /* A disabled control is drawn muted, as the editing surfaces draw theirs, so
     the refusal sentence below it is not the only sign it cannot be pressed. */
  button:disabled {
    color: var(--muted);
  }
</style>
