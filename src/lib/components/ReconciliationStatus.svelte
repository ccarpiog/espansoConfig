<script lang="ts">
  import {
    decideFileReconciliation,
    decideWorkspaceReconciliation,
    fileFactsOf,
    fileStatesDrawnAt,
    filesToDecide,
    reloadRefusalOf,
    workspaceFactsOf,
    type FileStatePlacement,
    type ReconciliationControl,
    type ReconciliationRefusal
  } from '../browser/reconciliationStatus';
  import type { BrowserState } from '../browser/workspace.svelte';
  import {
    t,
    tReconciliationControl,
    tReconciliationRefusal,
    tReconciliationWorkspaceState,
    tUnreadableReason
  } from '../i18n';
  import FileReconciliationStatus from './FileReconciliationStatus.svelte';

  /*
   * The workspace banners and the workspace route — Phase 2d-6-9b-1.
   *
   * **Presentation only**, over `decideWorkspaceReconciliation` and
   * `decideFileReconciliation` in `../browser/reconciliationStatus.ts`.
   * `AppShell.svelte` mounts this wherever `workspaceBannersDrawnIn` says the
   * banners are drawn — beside the panes and in the empty state — so the removal
   * that empties the list cannot take a banner and its control with it (entry 31).
   *
   * **The banners** are the five workspace states of entry 27, with the two reload
   * controls of entry 29 beside them: each disabled, never hidden, with the
   * sentence its press would get, and each press one request whose refusal is drawn.
   * **No membership reload is offered without its banner** (`2d-6-9a-notes.md` §5
   * item 5, decided here): `requestMembershipReload` would permit one, but a reload
   * nobody asked for clears the selection with no observation to explain why, so no
   * component offers it outside the banner.
   *
   * **The route** is every file the window can name (`filesToDecide`, which since
   * this phase also lists held files no row or surface names) whose held
   * observation or uncertain write is placed on `workspaceRoute` — i.e. no surface
   * over it is open (entry 15: reachable per file, never dependent on a mounted
   * panel). Each is drawn by `FileReconciliationStatus.svelte`, named by its display
   * path.
   */

  const { browser }: { browser: BrowserState } = $props();

  /** The route's one placement. */
  const ROUTE: readonly FileStatePlacement[] = ['workspaceRoute'];

  const workspace = $derived(workspaceFactsOf(browser));
  const banners = $derived(decideWorkspaceReconciliation(workspace));
  const routed = $derived(
    filesToDecide(browser).filter(
      (document) =>
        fileStatesDrawnAt(decideFileReconciliation(workspace, fileFactsOf(browser, document)), ROUTE)
          .length > 0
    )
  );

  /** What the last workspace-control press answered, when it was refused. */
  let refused = $state<{
    readonly control: ReconciliationControl;
    readonly refusal: ReconciliationRefusal;
  } | null>(null);

  /**
   * Presses one workspace control: one request, and its refusal drawn.
   *
   * @param control - `membershipReload` or `lostHistoryRecovery`.
   */
  function press(control: ReconciliationControl): void {
    const outcome =
      control === 'lostHistoryRecovery'
        ? browser.requestLostHistoryRecovery()
        : browser.requestMembershipReload();
    const refusal = reloadRefusalOf(outcome);
    refused = refusal === null ? null : { control, refusal };
  } // End of function press()
</script>

{#if banners.states.length > 0 || banners.controls.length > 0 || routed.length > 0}
  <section class="reconciliation" aria-label={t('browser.reconciliation.label')}>
    {#each banners.states as banner, index (index)}
      <div class="banner" role="status">
        <p>{tReconciliationWorkspaceState(banner)}</p>
        {#if banner.kind === 'pathDrift' && banner.detail.kind === 'unreadable'}
          <p class="reason">{tUnreadableReason(banner.detail.reason)}</p>
        {/if}
      </div>
    {/each}
    {#each banners.controls as control (control.control)}
      <p class="control">
        <button type="button" disabled={!control.enabled} onclick={() => press(control.control)}>
          {tReconciliationControl(control.control)}
        </button>
      </p>
      {#if !control.enabled}
        <p class="refusal">{tReconciliationRefusal(control.reason)}</p>
      {/if}
      {#if refused !== null && refused.control === control.control}
        <p class="refusal pressed">{tReconciliationRefusal(refused.refusal)}</p>
      {/if}
    {/each}
    {#each routed as document (document)}
      <FileReconciliationStatus {browser} {document} placements={ROUTE} named />
    {/each}
  </section>
{/if}

<style>
  /* Above the panes, full width, and never a fixed height: a banner is a
     sentence, and the Spanish one is longer (plan section 9). Bounded, though,
     and scrolled on its own: the shell is `height: 100vh` and `.panes` has
     `min-height: 0`, so a route drawing a whole disk snapshot squeezed the
     sidebar and the pane to no height at all (Phase 2d-6-9c's window reading,
     703 px of a 728 px window). The bound keeps the panes reachable; it cannot
     make anything below the fold of this region seen without scrolling it. */
  .reconciliation {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    max-height: 45vh;
    overflow-y: auto;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface-raised);
  }

  .reconciliation p {
    margin: 0;
  }

  .banner {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .reason,
  .refusal {
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
</style>
