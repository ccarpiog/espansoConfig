<script lang="ts">
  import type { BrowserState } from '../browser/workspace.svelte';
  import { t, tSelectionNotice } from '../i18n';

  /*
   * The third pane of plan section 8.1, deliberately a stub in this sub-phase.
   *
   * It shows that a snippet is selected, the file it lives in, and a sentence
   * saying that the snippet view itself is the next step. Rendering plan
   * section 3.3's 22 fields is 1c-2's work and **none of it is started here**.
   *
   * It used to render the trigger and the label through `triggerLabel` and
   * `labelText`, and the 1c-1 review was right that this was 1c-2's work begun
   * badly: those two helpers are the *list's*, and they deliberately collapse
   * `trigger`, `triggers` and `regex` to one display value. A match holding both
   * a `trigger` and a `regex` therefore appeared here showing one of them, which
   * is the opposite of what a detail pane is for, and 1c-2 would have had to
   * delete the block before writing the real one. Two rows of a 22-field view
   * are not a preview of it.
   *
   * The notice at the top is R27 made visible: when a held identity is refused
   * and re-resolution answers `differentMatch` or `gone`, the user is told that
   * the selection was cleared rather than being moved silently to whatever now
   * occupies that position. It is rendered through `tSelectionNotice`, an
   * accessor — a component never turns a code into a key itself.
   */

  const { browser }: { browser: BrowserState } = $props();
</script>

<section class="detail" aria-label={t('browser.detail.label')}>
  {#if browser.notice !== null}
    <div class="notice" role="status">
      <p>{tSelectionNotice(browser.notice)}</p>
      <button type="button" onclick={() => browser.dismissNotice()}>
        {t('browser.notice.dismiss')}
      </button>
    </div>
  {/if}

  {#if browser.selectedMatch === null}
    <p class="empty">{t('browser.detail.empty')}</p>
  {:else}
    {#if browser.selectedDocument !== null}
      <dl>
        <dt>{t('browser.detail.file')}</dt>
        <dd class="source">{browser.selectedDocument.relative_path}</dd>
      </dl>
    {/if}
    <p class="placeholder">{t('browser.detail.placeholder')}</p>
  {/if}
</section>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow: auto;
    padding: 1rem;
  }

  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-raised);
  }

  .notice p {
    margin: 0;
    flex: 1 1 16rem;
  }

  button {
    font: inherit;
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
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

  /* Text taken from the file is shown as written (D2u), so it is set in the
     monospaced face that says "this is what the document holds". */
  .source {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .empty,
  .placeholder {
    margin: 0;
    color: var(--muted);
  }
</style>
