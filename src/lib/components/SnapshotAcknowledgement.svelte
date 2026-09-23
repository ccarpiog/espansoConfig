<script lang="ts">
  import type { ExternalChangeConflictSource } from '../browser/conflictSource';
  import {
    surfaceControlNoteOf,
    type ControlDecision,
    type ReconciliationRefusal
  } from '../browser/reconciliationStatus';
  import { tReconciliationControl, tReconciliationRefusal, tReconciliationSurfaceNote } from '../i18n';

  /*
   * The acknowledgement one write panel offers for the conflict it shows — Phase
   * 2d-6-9b-2, the 2d-6 record's §3 entries 14 and 15.
   *
   * **Presentation only.** Whether it is drawn, and whether it is enabled, are
   * `decideSurfaceAcknowledgement`'s in `../browser/reconciliationStatus.ts`; the
   * note beside a disabled control is `surfaceControlNoteOf`'s. Each of the eight
   * renderers mounts this inside its conflict comparison, directly under the disk
   * text that conflict carries, so the snapshot the label calls *this snapshot* is
   * the one drawn above it. The press is the renderer's: it runs the session's own
   * `acknowledge…Snapshot` transition, whose closure mints from the session's
   * conflict `source` — the object `shown` names here — and answers the refusal, or
   * `null` when the window ended the hold.
   *
   * **It draws neither the unknown-outcome sentence nor the held one.** The pane's
   * `FileReconciliationStatus.svelte` block draws both once, above the panel
   * (`2d-6-9b-1-notes.md` §6 item 2). What this cannot force is that a person read
   * the disk text before pressing.
   */

  const {
    shown,
    decision,
    acknowledge
  }: {
    shown: ExternalChangeConflictSource;
    decision: ControlDecision;
    acknowledge: () => ReconciliationRefusal | null;
  } = $props();

  /**
   * What the last press answered when it was refused, and for which origin: a
   * refusal about one snapshot is not drawn beside the next one.
   */
  let pressed = $state.raw<{
    readonly source: ExternalChangeConflictSource;
    readonly refusal: ReconciliationRefusal;
  } | null>(null);

  const note = $derived(surfaceControlNoteOf(decision));

  /** Presses the acknowledgement once and keeps a refusal it answered. */
  function press(): void {
    const source = shown;
    const refusal = acknowledge();
    pressed = refusal === null ? null : { source, refusal };
  } // End of function press()
</script>

<div class="acknowledgement">
  <p class="control">
    <button type="button" disabled={!decision.enabled} onclick={() => press()}>
      {tReconciliationControl(decision.control)}
    </button>
  </p>
  {#if !decision.enabled}
    <p class="refusal">{tReconciliationRefusal(decision.reason)}</p>
    {#if note !== null}
      <p class="refusal">{tReconciliationSurfaceNote(note)}</p>
    {/if}
  {/if}
  <!-- A refused press re-derives the decision, usually to the same refusal; the
       sentence is then already drawn above and is not drawn twice. -->
  {#if pressed !== null && pressed.source === shown && (decision.enabled || decision.reason !== pressed.refusal)}
    <p class="refusal pressed">{tReconciliationRefusal(pressed.refusal)}</p>
  {/if}
</div>

<style>
  .acknowledgement {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0.5rem 0;
  }

  .acknowledgement p {
    margin: 0;
  }

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
