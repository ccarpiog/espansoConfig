<script lang="ts">
  import { badgesOf, labelText, matchKey, triggerLabel } from '../browser/labels';
  import type { BrowserState } from '../browser/workspace.svelte';
  import { t, tMatchBadge, tTriggerKind } from '../i18n';

  /*
   * The second pane of plan section 8.1: a search box and one row per match,
   * each showing its trigger, its label and its badges.
   *
   * Two rules are visible in the markup below.
   *
   * D2u — every string printed from the file is source text. `triggerLabel`
   * hands back either text out of the document or a `TriggerKind`, and the code
   * is rendered through `tTriggerKind` rather than turned into a sentence here.
   *
   * A badge is rendered from `MatchView.badges` and from nothing else. The
   * frontend never looks at `content.html` and decides a row is HTML; the core
   * derives every badge from a key's presence or a `type` field's text, which
   * is the half of D2u that survives into the list.
   */

  const { browser }: { browser: BrowserState } = $props();

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
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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
