<script lang="ts">
  import { describeFindings, hasFindings } from '../browser/findings';
  import { badgesOf, labelText, matchKey, triggerLabel } from '../browser/labels';
  import type { BrowserState } from '../browser/workspace.svelte';
  import { t, tDiagnostic, tHazard, tMatchBadge, tOccurrenceCount, tTriggerKind } from '../i18n';

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
   */

  const { browser }: { browser: BrowserState } = $props();

  // In the script rather than an `{@const}` in the markup, because Svelte 5
  // allows `{@const}` only as the immediate child of a block and this one is
  // needed *before* the `{#if}` that would have to contain it. `$derived` also
  // means the call is memoized rather than repeated by each reader below.
  const findings = $derived(describeFindings(browser.scopedDocument));

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
        <li>
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
