<script lang="ts">
  import { ALL_DOCUMENTS, sameSelection, type SidebarRow } from '../browser/sidebar';
  import type { BrowserState } from '../browser/workspace.svelte';
  import { t, tIpcFailure, tSnippetCount } from '../i18n';

  /*
   * The first pane of plan section 8.1: an "All" entry, then files, profiles
   * and packages. Section 8.4 is why the rows are files and why each shows its
   * path rather than an invented display name — "never hide the file boundary".
   *
   * Nothing here parses a path or a file name. `disabled` is espanso's own
   * "the default include glob skips this file", and `read_only` is what makes a
   * package a package; both arrive on `DocumentSummary`.
   *
   * **A total that omits a file says so.** A `get_document` that refused during
   * the load leaves the "All" number counting the files that read and no others,
   * and the block under it names each refusal in the user's language. Before the
   * 1c-1 review that number stood alone and the reason was in the developer
   * console: "All 2" for a configuration holding 102 snippets.
   *
   * **And the file itself says so too.** Three count states, not two: a number,
   * "not read yet" for a file nobody projected, and "could not be read" for one
   * whose read was attempted and refused. The 1c-1 window reading found the last
   * two drawn identically — the same `–`, the same tooltip — one row apart, and
   * named the conflation for this sub-phase. `SidebarRow.unreadable` is where
   * the two are told apart, and `LoadFailure` carries the identity that makes it
   * possible.
   *
   * Counts go through `tSnippetCount`, which picks the singular or the plural
   * key. `"{count} snippets"` on its own renders "1 snippets", and a file with
   * one snippet in it is the common case rather than the edge one.
   */

  const { browser }: { browser: BrowserState } = $props();
</script>

<nav class="sidebar" aria-label={t('browser.sidebar.label')}>
  <ul class="rows">
    <li>
      <button
        type="button"
        class="row"
        aria-current={browser.selection.kind === 'all' ? 'true' : undefined}
        onclick={() => browser.show(ALL_DOCUMENTS)}
      >
        <span class="name">{t('browser.sidebar.all')}</span>
        <span class="count" title={tSnippetCount(browser.sidebar.total)}>
          {browser.sidebar.total}
        </span>
      </button>
    </li>
  </ul>

  {#if browser.loadFailures.length > 0}
    <div class="partial" role="status">
      <p>{t('browser.sidebar.partialTotal')}</p>
      <ul>
        {#each browser.loadFailures as refusal (refusal.document)}
          <li>{tIpcFailure(refusal.failure)}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#snippet group(heading: string, rows: readonly SidebarRow[], locked: boolean)}
    {#if rows.length > 0}
      <h2 class="group">
        <span>{heading}</span>
        {#if locked}
          <span aria-hidden="true">🔒</span>
          <span class="lock">{t('browser.sidebar.readOnly')}</span>
        {/if}
      </h2>
      <ul class="rows">
        {#each rows as row (row.document.id)}
          <li>
            <button
              type="button"
              class="row"
              aria-current={sameSelection(browser.selection, {
                kind: 'document',
                id: row.document.id
              })
                ? 'true'
                : undefined}
              onclick={() => browser.show({ kind: 'document', id: row.document.id })}
            >
              <span class="name">{row.document.relative_path}</span>
              {#if row.document.disabled}
                <span class="mark">{t('browser.sidebar.notAutoLoaded')}</span>
              {/if}
              {#if row.unreadable}
                <!-- A word rather than a glyph with a tooltip: "could not read
                     this" is a different fact from "have not read this", and a
                     second dash distinguished by a `title` alone is invisible
                     to a reader who never hovers and to a screen reader that
                     skips an `aria-hidden` span. -->
                <span class="mark warn">{t('browser.sidebar.unreadable')}</span>
              {:else if row.matches === null}
                <span class="count" title={t('browser.sidebar.unread')} aria-hidden="true">–</span>
              {:else}
                <span class="count" title={tSnippetCount(row.matches)}>
                  {row.matches}
                </span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  {@render group(t('browser.sidebar.files'), browser.sidebar.files, false)}
  {@render group(t('browser.sidebar.profiles'), browser.sidebar.profiles, false)}
  {@render group(t('browser.sidebar.packages'), browser.sidebar.packages, true)}
</nav>

<style>
  /*
   * No fixed width anywhere: the pane is sized by the grid in `AppShell`, and
   * every row is sized by its own content, because Spanish labels run 20-25%
   * longer than English (plan section 9).
   */
  .sidebar {
    overflow: auto;
    padding: 0.5rem;
    border-right: 1px solid var(--border);
    background: var(--surface-raised);
  }

  /* A failure is a message, not a row: it is set in the body face, wraps, and
     never lines up with the counts above it. */
  .partial {
    margin: 0.5rem 0.25rem;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .partial p {
    margin: 0;
  }

  .partial ul {
    margin: 0.25rem 0 0;
    padding-inline-start: 1rem;
  }

  .group {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin: 1rem 0 0.25rem;
    padding: 0 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .lock {
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    width: 100%;
    padding: 0.25rem 0.5rem;
    border: 0;
    border-radius: 6px;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: default;
  }

  .row:hover {
    background: var(--surface);
  }

  .row[aria-current='true'] {
    background: var(--surface);
    font-weight: 600;
  }

  .name {
    flex: 1 1 auto;
    overflow-wrap: anywhere;
  }

  .count {
    flex: 0 0 auto;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .mark {
    flex: 0 0 auto;
    padding: 0 0.25rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 0.6875rem;
    color: var(--muted);
  }

  /* A refusal, not an attribute of the file: it reads in the body colour so it
     does not sit at the same weight as "Not loaded automatically", which is a
     fact about espanso's own include glob rather than about this app failing. */
  .warn {
    color: inherit;
  }
</style>
