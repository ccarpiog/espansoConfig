<script lang="ts">
  import { bulkSelectingAvailability, isInBulkSelection } from '../browser/bulkEdit';
  import { describeFindings, hasFindings } from '../browser/findings';
  import { badgesOf, labelText, matchKey, triggerLabel } from '../browser/labels';
  import type { BrowserState } from '../browser/workspace.svelte';
  import { t, tDiagnostic, tHazard, tMatchBadge, tOccurrenceCount, tTriggerKind } from '../i18n';
  import FileScope from './FileScope.svelte';

  /*
   * The second pane of plan section 8.1: a search box, whatever this app has to
   * say about the file being shown, and one row per match.
   *
   * Three rules are visible in the markup below.
   *
   * D2u — every string printed from the file is source text. `triggerLabel`
   * hands back either text out of the document or a `TriggerKind`, and the code
   * is rendered through `tTriggerKind` rather than turned into a sentence here.
   *
   * A badge is rendered from `MatchView.badges` and from nothing else. The
   * frontend never looks at `content.html` and decides a row is HTML; the core
   * derives every badge from a key's presence or a `type` field's text, which
   * is the half of D2u that survives into the list.
   *
   * **A file's diagnostics belong to this pane, not to the detail pane**, and
   * the reason is the file that most needs them: one that does not parse
   * crosses the boundary with `parsed: false` and **no matches at all**, so
   * nothing in it can ever be selected and the third pane is unreachable for
   * it. Selecting the file in the sidebar is reachable, so this is where the
   * sentences go. What appears is decided in `../browser/findings.ts`; this
   * file walks the answer.
   *
   * **One sentence per finding, not per record.** Twenty keys that could not be
   * accounted for raise twenty diagnostics carrying one identical sentence, and
   * the span that tells them apart is not on screen. `describeFindings` counts
   * them instead of discarding them, and the count is rendered through
   * `plural.ts` so that "in 1 place" can never appear where "in 20 places" is
   * meant. The threshold that decides whether the count is said at all is
   * `line.repeated`, and it is decided there rather than here.
   *
   * **The file-scope inspector sits here for the same reason** (Phase 3-9-1):
   * a file's imports and its "not loaded automatically" explanation are about
   * the file, and a `_` file holding only `imports` has no snippet to select.
   * It is drawn only when one file is in scope; the "All" scope is no file.
   *
   * **Selecting several** (Phase 3-11-2). A *Select several* toggle puts the
   * list into a mode in which a row press adds that snippet to the bulk
   * selection or takes it out, instead of selecting it alone. The rows stay the
   * same `<button>`s, now carrying `aria-pressed`, so the whole interaction is
   * the keyboard's too: Tab reaches each row and Space or Return toggles it. No
   * checkbox is drawn, which keeps one control per row. Whether the toggle may
   * be turned on is `bulkSelectingAvailability` in `../browser/bulkEdit.ts` over
   * the window's live write surfaces; while it is refused the control is
   * disabled and the reason is said beside it. The selection itself lives on
   * `BrowserState` (`bulkSelection`), because the detail pane's bulk inspector
   * draws it too. Outside the mode nothing here changed.
   */

  const { browser }: { browser: BrowserState } = $props();

  // In the script rather than an `{@const}` in the markup, because Svelte 5
  // allows `{@const}` only as the immediate child of a block and this one is
  // needed *before* the `{#if}` that would have to contain it. `$derived` also
  // means the call is memoized rather than repeated by each reader below.
  const findings = $derived(describeFindings(browser.scopedDocument));

  const bulkAvailability = $derived(bulkSelectingAvailability(browser.openWriteSurfaces()));

  /**
   * Sends the search box's current text to the state.
   *
   * @param event - The `input` event from the underlying `<input>`.
   */
  function onInput(event: Event): void {
    browser.search((event.currentTarget as HTMLInputElement).value);
  } // End of function onInput()
</script>

<section class="list" aria-label={t('browser.list.label')}>
  <div class="search">
    <label for="snippet-search">{t('browser.list.searchLabel')}</label>
    <input id="snippet-search" type="search" value={browser.query} oninput={onInput} />
  </div>

  <p class="summary">
    {t('browser.list.summary', {
      shown: browser.visibleMatches.length,
      total: browser.scopedMatches.length
    })}
  </p>

  <div class="bulk">
    {#if browser.bulkSelecting}
      <p class="choices">
        <!-- Withdrawn while a bulk apply is out: `BrowserState.setBulkSelecting`
             refuses then too, so the inspector and `busy` hold until it settles. -->
        <button
          type="button"
          aria-pressed="true"
          disabled={browser.bulkApplyPending}
          onclick={() => browser.setBulkSelecting(false)}
        >
          {t('browser.list.bulk.stop')}
        </button>
        <button
          type="button"
          disabled={browser.bulkApplyPending || browser.bulkSelection.length === 0}
          onclick={() => browser.replaceBulkSelection([])}
        >
          {t('browser.list.bulk.clear')}
        </button>
      </p>
      <p class="hint">{t('browser.list.bulk.hint')}</p>
      <p class="hint" role="status">
        {t('browser.list.bulk.count', { count: browser.bulkSelection.length })}
      </p>
    {:else}
      <p class="choices">
        <button
          type="button"
          aria-pressed="false"
          disabled={bulkAvailability !== 'available'}
          onclick={() => browser.setBulkSelecting(true)}
        >
          {t('browser.list.bulk.start')}
        </button>
      </p>
      {#if bulkAvailability === 'surfaceOpen'}
        <p class="hint">{t('browser.list.bulk.unavailable')}</p>
      {/if}
    {/if}
  </div>

  {#if hasFindings(findings)}
    <div class="notes" role="status" aria-label={t('browser.list.notes.label')}>
      {#if findings.diagnostics.length > 0}
        <p>{t('browser.list.notes.diagnostics')}</p>
        <ul>
          {#each findings.diagnostics as line (line.id)}
            <li>
              {tDiagnostic(line.code)}
              {#if line.repeated}
                <span class="occurrences">{tOccurrenceCount(line.occurrences)}</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if findings.hazards.length > 0}
        <p>{t('browser.list.notes.hazards')}</p>
        <ul>
          {#each findings.hazards as hazard (hazard)}
            <li>{tHazard(hazard)}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  {#if browser.scopedDocument !== null}
    <FileScope document={browser.scopedDocument} />
  {/if}

  {#if browser.visibleMatches.length === 0}
    <p class="empty">
      {#if browser.scopedMatches.length === 0}
        {t('browser.list.noSnippets')}
      {:else}
        {t('browser.list.noResults')}
      {/if}
    </p>
  {:else}
    <ul class="rows">
      {#each browser.visibleMatches as match (matchKey(match.id))}
        {@const trigger = triggerLabel(match)}
        {@const label = labelText(match)}
        {@const picked = isInBulkSelection(browser.bulkSelection, match.id)}
        <li>
          {#if browser.bulkSelecting}
            <!-- Selecting several: the row toggles its snippet in the bulk
                 selection. `aria-pressed` is the state a keyboard or a screen
                 reader is told; the mark is the same fact drawn. -->
            <button
              type="button"
              class="row"
              aria-pressed={picked ? 'true' : 'false'}
              disabled={browser.bulkApplyPending}
              onclick={() => browser.toggleBulkSelection(match.id)}
            >
              <span class="mark" aria-hidden="true">{picked ? '☑' : '☐'}</span>
              <span class="trigger">
                {#if trigger.kind === 'text'}
                  {trigger.text}
                {:else}
                  {tTriggerKind(trigger.code)}
                {/if}
              </span>
              {#if label !== null}
                <span class="label">{label}</span>
              {/if}
              {#if picked}
                <span class="badge">{t('browser.list.bulk.selectedMark')}</span>
              {/if}
            </button>
          {:else}
          <button
            type="button"
            class="row"
            aria-current={browser.selected?.id.node === match.id.node &&
            browser.selected?.document === match.id.document
              ? 'true'
              : undefined}
            onclick={() => void browser.select(match)}
          >
            <span class="trigger">
              {#if trigger.kind === 'text'}
                {trigger.text}
              {:else}
                {tTriggerKind(trigger.code)}
              {/if}
            </span>
            {#if label !== null}
              <span class="label">{label}</span>
            {/if}
            {#if badgesOf(match).length > 0}
              <span class="badges" aria-label={t('browser.list.badges')}>
                {#each badgesOf(match) as badge (badge)}
                  <span class="badge"><span aria-hidden="true">⌗</span>{tMatchBadge(badge)}</span>
                {/each}
              </span>
            {/if}
          </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow: auto;
    padding: 0.5rem;
    border-right: 1px solid var(--border);
  }

  .search {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  /* Content-sized, never fixed: a Spanish label is longer than its English
     twin and must not be clipped (plan section 9). */
  input {
    font: inherit;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
  }

  label {
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .bulk .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    margin: 0;
  }

  .bulk button {
    font: inherit;
    font-size: 0.8125rem;
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
  }

  .bulk button[aria-pressed='true'] {
    background: var(--surface-raised);
  }

  .hint {
    margin: 0.25rem 0 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .mark {
    color: var(--muted);
  }

  .row[aria-pressed='true'] {
    background: var(--surface-raised);
  }

  .summary,
  .empty {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  /* What this app noticed about the file, not about any one snippet: sentences
     that wrap, never a row that lines up with the triggers below. The same
     shape as the sidebar's partial-total block, because it is the same kind of
     statement — this app telling the reader something about a file rather than
     showing them the file. */
  .notes {
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .notes p {
    margin: 0.375rem 0 0;
  }

  .notes p:first-child {
    margin-top: 0;
  }

  .notes ul {
    margin: 0.25rem 0 0;
    padding-inline-start: 1rem;
  }

  /* How many distinct places raised one sentence. Set apart from the sentence
     because it is this app counting, not this app reporting. */
  .occurrences {
    white-space: nowrap;
    opacity: 0.85;
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem 0.5rem;
    width: 100%;
    padding: 0.375rem 0.5rem;
    border: 0;
    border-radius: 6px;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: default;
  }

  .row:hover {
    background: var(--surface-raised);
  }

  .row[aria-current='true'] {
    background: var(--surface-raised);
  }

  .trigger {
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }

  .label {
    color: var(--muted);
    overflow-wrap: anywhere;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .badge {
    padding: 0 0.25rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 0.6875rem;
    color: var(--muted);
  }
</style>
