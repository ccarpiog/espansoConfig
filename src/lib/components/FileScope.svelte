<script lang="ts">
  import { describeFileScope } from '../browser/fileScope';
  import type { DocumentView } from '../ipc/types';
  import { t, tAutoLoadNote, tImportsState, tScalarStyle, tUnsupportedImport } from '../i18n';
  import SourceText from './SourceText.svelte';

  /*
   * The file-scope inspector — Phase 3-9-1 (`docs/decisions/3-split-notes.md` §2
   * step 3-9, ruling 14). Drawn by `SnippetList.svelte` for the file the list is
   * scoped to, beside what `findings.ts` says about the same file, because that
   * pane is reachable for every file — including one with no snippets, which is
   * exactly what a `_` file holding only `imports` can be.
   *
   * **Display only.** No control here edits, renames or resolves anything; every
   * value is `describeFileScope`'s in `../browser/fileScope.ts`, and this file
   * walks it. An entry is drawn through `SourceText` as the file writes it, never
   * as a path this app looked up (ruling 14, D2u). An entry the core elided is a
   * row at its own position carrying its reason, so the list's numbering is the
   * file's. The `_` sentence depends on the file's kind (`autoLoadOf`): a
   * configuration profile's makes no loading claim.
   */

  const { document }: { document: DocumentView } = $props();

  const scope = $derived(describeFileScope(document));
</script>

<section class="scope" aria-label={t('browser.fileScope.label')}>
  {#if scope.autoLoad.kind !== 'default'}
    <p class="autoLoad">{tAutoLoadNote(scope.autoLoad.kind, 'explanation')}</p>
  {/if}

  <h2>{t('browser.fileScope.imports.heading')}</h2>
  <p class="state">{tImportsState(scope.imports)}</p>
  {#if scope.imports.kind === 'listed'}
    <ol class="imports">
      {#each scope.imports.rows as row (row.position)}
        <li>
          <span class="position">{row.position}</span>
          <div class="entry">
            {#if row.kind === 'asWritten'}
              {#if row.display.empty}
                <span class="marker">{t('browser.detail.emptyText')}</span>
              {:else}
                <SourceText text={row.display.scalar.text} />
              {/if}
              {#if row.display.style !== null}
                <span class="marker">{tScalarStyle(row.display.style)}</span>
              {/if}
              {#if row.display.ambiguous}
                <span class="marker" title={t('browser.detail.ambiguousDetail')}>
                  {t('browser.detail.ambiguous')}
                </span>
              {/if}
            {:else}
              <span class="unsupported">{tUnsupportedImport(row.found)}</span>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  /* The same shape as the snippet list's notes block: this app telling the
     reader something about the file, in sentences that wrap. */
  .scope {
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  h2 {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .autoLoad {
    margin: 0 0 0.5rem;
  }

  .state {
    margin: 0.25rem 0 0;
    color: var(--muted);
  }

  /* The position is drawn by this component, not by the list marker: the 3-9-2
     window reading saw WebKit draw no `<ol>` marker beside a row whose first
     child is `SourceText`'s scrolling block, so rows 1, 3 and 5 of a mixed list
     lost their numbers (`docs/decisions/3-9-2-notes.md` §5 item 1). Every row,
     unsupported or not, carries its 1-based position in the file as a digit. */
  .imports {
    margin: 0.375rem 0 0;
    padding: 0;
    list-style: none;
  }

  .imports li {
    display: grid;
    grid-template-columns: 1.25rem minmax(0, 1fr);
    align-items: baseline;
    margin-top: 0.25rem;
  }

  .position {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    text-align: end;
    padding-inline-end: 0.375rem;
  }

  /* `minmax(0, 1fr)` above and `min-width: 0` here keep `SourceText`'s own
     horizontal scrolling working inside the grid cell. */
  .entry {
    min-width: 0;
  }

  .marker {
    font-size: 0.6875rem;
    color: var(--muted);
  }

  .unsupported {
    padding: 0 0.25rem;
    border: 1px solid var(--border);
    border-radius: 4px;
  }
</style>
