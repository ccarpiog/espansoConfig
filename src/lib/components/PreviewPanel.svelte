<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    createPreviewCoordinator,
    PREVIEW_IDLE,
    type PreviewCommands,
    type PreviewState,
    type PreviewTarget,
    type SampleClock
  } from '../browser/preview';
  import {
    anchoredForRequest,
    drawnAnswerOf,
    drawnShownOf,
    editAnchoredSlot,
    EMPTY_ANCHORED_INPUTS,
    instantLabelOf,
    piecesOf,
    previewBehindDraft,
    slotViewsOf,
    type AnchoredInputs,
    type PreviewPiece,
    type SlotView
  } from '../browser/previewView';
  import { sourceSegments } from '../browser/sourceText';
  import {
    t,
    tContentKind,
    tInvisible,
    tIpcFailure,
    tPreviewLimit,
    tPreviewNotice,
    tPreviewPlaceholderChip,
    tPreviewPlaceholderName,
    tPreviewUnresolved
  } from '../i18n';

  /*
   * The illustrative preview of an open draft — Phase 4-19-2, drawing Phase
   * 4-19-1's model (`../browser/preview.ts`) through `../browser/previewView.ts`.
   *
   * **This file is presentation.** Which answer is drawn, which controls a
   * shown answer offers and what each holds, how a control's text becomes a
   * sample, the output's pieces and the instant's spelling are all
   * `previewView.ts`'s; supersession is the coordinator's.
   *
   * **Nothing here writes.** The only commands this panel can reach are the two
   * readers of `PreviewCommands`, handed to the coordinator; `target` is read,
   * never written, and a draft target crosses the wire as a frozen copy. The
   * panel is shown on request: nothing is sent until *Preview this draft* is
   * pressed, and after that a sample edit or *Refresh* sends the next request.
   * What TypeScript does not force is that a host hands a `target` that reads
   * rather than mutates; `MatchEditor.svelte` hands `draftPreviewTargetOf`.
   *
   * **Output text is drawn as text, never as markup.** Every piece goes through
   * `sourceSegments` into text nodes (a line break a `<br>`, an invisible
   * character — a lone carriage return among them — a named marker), exactly as
   * `SourceText.svelte` draws file text; this file holds no raw-HTML tag, and
   * `PreviewPanel.test.ts` reads it to say so. No output text is ever put into
   * a `<textarea>` or an `<input>` (`CLAUDE.md` §6). The output
   * container is one line of markup because `white-space: pre` keeps every
   * character inside it, so an indent written here would be output the draft
   * does not produce.
   *
   * **An unresolved value stays identifiable**: it is drawn as written inside a
   * `<mark>` whose tooltip is its reason's sentence, and every reason is listed
   * under the output through `tPreviewUnresolved`.
   *
   * **No execution and no clipboard-read control** (ruling 26): a `shell`,
   * `script`, `clipboard` or `match` value is a labelled placeholder, and this
   * panel has no control that runs, tests or reads anything.
   */

  const {
    target,
    commands,
    clock
  }: {
    /**
     * What to preview now, read at each request and to tell whether the drawn
     * answer is behind the draft. Must read and never write.
     */
    target: () => PreviewTarget;
    /**
     * The two preview readers — `BrowserState.previewCommands`, through the
     * editor; a test injects fakes. The type holds no writer.
     */
    commands: PreviewCommands;
    /** Where the sample instant and zone come from. */
    clock: SampleClock;
  } = $props();

  let previewState = $state.raw<PreviewState>(PREVIEW_IDLE);
  /**
   * The sample inputs and the drafted variables their positional samples were
   * entered against (`AnchoredInputs` in `../browser/previewView.ts`).
   */
  let samples = $state.raw<AnchoredInputs>(EMPTY_ANCHORED_INPUTS);
  /** The key of the entry box whose last text was refused, or `null`. */
  let refusedSlot = $state<string | null>(null);

  // svelte-ignore state_referenced_locally
  const coordinator = createPreviewCoordinator(commands, clock, (next) => {
    previewState = next;
  });
  onDestroy(() => {
    coordinator.clear();
  });

  const answer = $derived(drawnAnswerOf(previewState));
  const shown = $derived(drawnShownOf(previewState));
  const slots = $derived(slotViewsOf(previewState, samples.inputs));
  const behind = $derived(previewState.kind === 'idle' ? false : previewBehindDraft(previewState, target()));
  const instant = $derived(
    answer === null || answer.request.samples.instant === null ? null : instantLabelOf(answer.request.samples.instant)
  );

  /**
   * Sends one request for the target as it is now, with the current samples —
   * every positional sample entered against other drafted variables dropped
   * first, so the boxes show what is sent (review 4-19-2).
   */
  function refresh(): void {
    const next = target();
    samples = anchoredForRequest(samples, next);
    void coordinator.request(next, samples.inputs);
  } // End of function refresh()

  /**
   * Hands one control's text to the model and, when the panel is open, sends
   * the next request. A refused text is put back to the one the box held, so
   * a box never shows a value other than the one sent (review 4-19-2).
   *
   * @param view - The control.
   * @param box - The box itself.
   */
  function onSlotInput(view: SlotView, box: HTMLInputElement): void {
    if (shown === null) {
      return;
    }
    const edit = editAnchoredSlot(samples, shown.request.target, view.slot, box.value);
    if (edit.kind === 'refused') {
      refusedSlot = view.key;
      box.value = edit.text;
      return;
    }
    refusedSlot = null;
    samples = edit.anchored;
    if (previewState.kind !== 'idle') {
      refresh();
    }
  } // End of function onSlotInput()

  /**
   * The label of one control.
   *
   * @param view - The control.
   * @returns The translated label.
   */
  function slotLabel(view: SlotView): string {
    switch (view.kind) {
      case 'selection':
        return view.slot.name === null
          ? t('browser.preview.slot.selectionUnnamed')
          : t('browser.preview.slot.selection', { name: view.slot.name });
      case 'formField':
        if ('ShorthandForm' in view.slot.form) {
          return t('browser.preview.slot.shorthandField', { field: view.slot.field });
        }
        return view.slot.name === null
          ? t('browser.preview.slot.formFieldUnnamed', { field: view.slot.field })
          : t('browser.preview.slot.formField', { field: view.slot.field, name: view.slot.name });
      case 'capture':
        return t('browser.preview.slot.capture', { name: view.slot.name });
    }
  } // End of function slotLabel()
</script>

{#snippet run(text: string)}{#each sourceSegments(text) as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'break'}<br />{:else}<span class="invisible" title={t('browser.source.invisibleDetail')}>{tInvisible(segment)}</span>{/if}{/each}{/snippet}

{#snippet pieces(list: readonly PreviewPiece[])}{#each list as piece, index (index)}{#if piece.kind === 'literal'}<span class="literal">{@render run(piece.text)}</span>{:else if piece.kind === 'sample'}<span class="sample">{@render run(piece.text)}</span>{:else if piece.kind === 'choice'}<span class="choice"><span class="choiceLabel">{t('browser.preview.choiceLabel')} {@render run(piece.label)}</span>{@render pieces(piece.pieces)}</span>{:else if piece.kind === 'placeholder'}<span class="placeholder" data-placeholder={piece.name} title={tPreviewPlaceholderName(piece.name)}>{tPreviewPlaceholderChip(piece.name)}</span>{:else}<mark class="unresolved" data-unresolved={piece.reason} title={tPreviewUnresolved(piece.reason)}>{@render run(piece.text)}</mark>{/if}{/each}{/snippet}

<section class="matchPreview" aria-label={t('browser.preview.heading')}>
  <h3>{t('browser.preview.heading')}</h3>
  <p class="note">{t('browser.preview.illustration')}</p>
  <p class="choices">
    <button type="button" data-preview-action="request" onclick={() => refresh()}>
      {previewState.kind === 'idle' ? t('browser.preview.show') : t('browser.preview.refresh')}
    </button>
    {#if previewState.kind !== 'idle'}
      <button type="button" data-preview-action="close" onclick={() => coordinator.clear()}>
        {t('browser.preview.hide')}
      </button>
    {/if}
  </p>

  {#if previewState.kind !== 'idle'}
    {#if previewState.kind === 'pending'}
      <p class="note" aria-live="polite" data-preview-notice="pending">{tPreviewNotice('pending')}</p>
    {/if}
    {#if behind}
      <p class="note" data-preview-notice="behindDraft">{tPreviewNotice('behindDraft')}</p>
    {/if}

    {#if answer !== null && answer.kind === 'failed'}
      <p class="failure" role="alert">{t('browser.preview.failed', { reason: tIpcFailure(answer.failure) })}</p>
    {:else if answer !== null && answer.kind === 'noMatchInCandidate'}
      <p class="note" data-preview-notice="noMatchInCandidate">{tPreviewNotice('noMatchInCandidate')}</p>
    {:else if shown !== null}
      <fieldset class="samples">
        <legend>{t('browser.preview.samples.heading')}</legend>
        {#each slots as view (view.key)}
          <label>
            <span>{slotLabel(view)}</span>
            <input
              type="text"
              inputmode={view.kind === 'selection' ? 'numeric' : undefined}
              data-slot={view.key}
              value={view.text}
              oninput={(event) => onSlotInput(view, event.currentTarget)}
            />
          </label>
          {#if refusedSlot === view.key}
            <p class="failure">{t('browser.preview.slot.entryRefused')}</p>
          {/if}
        {:else}
          <p class="note">{tPreviewNotice('noSamples')}</p>
        {/each}
      </fieldset>

      <div class="result">
        <div class="output">
          <h4>{t('browser.preview.output.heading')}</h4>
          {#each shown.preview.bodies as body, index (index)}
            <div class="body">
              <span class="bodyKind">{tContentKind(body.field)}</span>
              <div class="text" data-preview-output>{@render pieces(piecesOf(body.segments))}</div>
            </div>
          {:else}
            <p class="note">{tPreviewNotice('noContent')}</p>
          {/each}
        </div>
        <aside class="instant" data-preview-instant>
          <h4>{t('browser.preview.instant.heading')}</h4>
          {#if instant === null}
            <p class="note">{tPreviewNotice('instantMissing')}</p>
          {:else}
            <p>
              {instant.utc === null
                ? t('browser.preview.instant.seconds', { seconds: instant.unixSeconds })
                : t('browser.preview.instant.utc', { instant: instant.utc })}
            </p>
            <p>
              {instant.zone.kind === 'named'
                ? t('browser.preview.zone.named', { name: instant.zone.name })
                : t('browser.preview.zone.fixed', { offset: instant.zone.offset })}
            </p>
            <p class="note">{t('browser.preview.instant.note')}</p>
          {/if}
        </aside>
      </div>

      {#if shown.limitations.unresolvedCount > 0 || shown.limitations.placeholders.length > 0 || shown.limitations.limit !== null}
        <div class="limitations">
          <h4>{t('browser.preview.limitations.heading')}</h4>
          <ul>
            {#if shown.limitations.unresolvedCount > 0}
              <li data-preview-count>{t('browser.preview.unresolvedCount', { count: shown.limitations.unresolvedCount })}</li>
            {/if}
            {#each shown.limitations.unresolved as reason (reason)}
              <li data-limitation="unresolved" data-code={reason}>{tPreviewUnresolved(reason)}</li>
            {/each}
            {#each shown.limitations.placeholders as name (name)}
              <li data-limitation="placeholder" data-code={name}>{tPreviewPlaceholderName(name)}</li>
            {/each}
            {#if shown.limitations.limit !== null}
              <li data-limitation="limit" data-code={shown.limitations.limit}>{tPreviewLimit(shown.limitations.limit)}</li>
            {/if}
          </ul>
        </div>
      {/if}
    {/if}
  {/if}
</section>

<style>
  .matchPreview {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin: 0.5rem 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    font-size: 0.8125rem;
  }

  .matchPreview p,
  .matchPreview h3,
  .matchPreview h4 {
    margin: 0;
  }

  .note {
    color: var(--muted);
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .samples {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  /* The result and the instant it was shown at, side by side (step 4-19: "the
     sample instant and zone drawn beside the result"). */
  .result {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
    align-items: flex-start;
  }

  .output {
    flex: 1 1 16rem;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .instant {
    flex: 0 1 12rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding-left: 0.625rem;
    border-left: 1px solid var(--border);
  }

  .bodyKind {
    color: var(--muted);
  }

  /* The illustrative output, drawn as `SourceText` draws file text: nothing
     wraps, so every visual line is a line the output has. */
  .text {
    font-family: var(--font-mono);
    white-space: pre;
    overflow-x: auto;
    max-width: 100%;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
  }

  .sample {
    text-decoration: underline dotted;
  }

  .choiceLabel,
  .placeholder,
  .invisible {
    font-family: var(--font-ui);
    font-size: 0.6875rem;
    padding: 0 0.25rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--muted);
    white-space: nowrap;
  }

  /* An unresolved value, as written: marked so it cannot pass for output. */
  .unresolved {
    background: transparent;
    color: inherit;
    border: 1px dashed var(--muted);
    border-radius: 3px;
  }

  .failure {
    font-weight: 600;
  }

  .limitations ul {
    margin: 0;
    padding-left: 1.25rem;
  }
</style>
