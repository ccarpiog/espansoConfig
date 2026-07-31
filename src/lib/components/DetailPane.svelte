<script lang="ts">
  import {
    describeMatch,
    hasOptions,
    indentClass,
    type LineBlock,
    type ScalarDisplay,
    type ScalarRow,
    type ValueLine
  } from '../browser/detail';
  import type { UnknownEntry } from '../ipc/types';
  import type { BrowserState } from '../browser/workspace.svelte';
  import {
    t,
    tContentKind,
    tDetailField,
    tScalarStyle,
    tSelectionNotice,
    tTriggerKind,
    tUnknownCount,
    tUnknownReason,
    tValueKind,
    tVariableKind
  } from '../i18n';

  /*
   * The third pane of plan section 8.1: the selected snippet, field by field.
   *
   * **This file is presentation.** Everything that decides what appears —
   * which rows exist, how a projected value flattens into lines, which option
   * belongs to which group, what order a variable's parameters come in — is in
   * `../browser/detail.ts`, which has a test suite. Nothing in this repository
   * renders a Svelte component in an automated test, so logic put here is logic
   * nothing can check.
   *
   * Three rules are visible in the markup below.
   *
   * **D2u — every value printed is source text.** `ScalarView.text` and nothing
   * else. There is no checkbox anywhere in this pane and no badge derived from a
   * value: `word: on` renders as the two characters `on`. What is shown beside a
   * value is its *spelling* (`tScalarStyle`, only when the text differs from the
   * bytes) and the core's own 1.1-ambiguity flag, which is a claim about risk.
   *
   * **The three trigger fields and the five content fields are never
   * collapsed.** A match holding both a `trigger` and a `regex` is a real shape
   * — the core reports it as `Several` — and both rows are drawn. The snippet
   * list collapses them on purpose; a detail pane that did the same would hide
   * the thing it exists to show, and the 1c-1 review removed a first attempt at
   * this pane for exactly that.
   *
   * **An absent key draws nothing; a present, empty one draws a marker.** The
   * model answers `null` for a field the file does not have, so a row for it
   * never reaches this file.
   *
   * **An entry this app does not model shows its key, the *shape* of its value
   * and why it was not modelled — never the value itself.** `UnknownEntry`
   * carries `value_span` and `value_kind` and **no value text at all**, so the
   * text is not available here; slicing the file by that span is a Rust job,
   * because a JavaScript string index is a UTF-16 offset and a `ByteSpan` is
   * not. The strings therefore say the entry was *recorded and left untouched*
   * — a claim about what the app does to the file — and `unknownValue` says in
   * so many words that the value is not on screen. See
   * `docs/decisions/1c-2a-notes.md` section 12, hole 13.
   */

  const { browser }: { browser: BrowserState } = $props();
</script>

{#snippet scalarText(display: ScalarDisplay)}
  <span class="value">
    {#if display.empty}
      <span class="marker">{t('browser.detail.emptyText')}</span>
    {:else}
      <pre class="source">{display.scalar.text}</pre>
    {/if}
    {#if display.style !== null}
      <span class="marker">{tScalarStyle(display.style)}</span>
    {/if}
    {#if display.ambiguous}
      <span class="marker warn" title={t('browser.detail.ambiguousDetail')}>
        {t('browser.detail.ambiguous')}
      </span>
    {/if}
  </span>
{/snippet}

{#snippet rows(list: readonly ScalarRow[])}
  <dl>
    {#each list as row (row.field)}
      <dt>{tDetailField(row.field)}</dt>
      <dd>{@render scalarText(row)}</dd>
    {/each}
  </dl>
{/snippet}

{#snippet lines(list: readonly ValueLine[])}
  <ul class="lines">
    {#each list as line}
      <li class="line {indentClass(line.depth)}">
        {#if line.label.kind === 'key'}
          <span class="key">{line.label.key.text}</span>
        {:else if line.label.kind === 'unnamed'}
          <span class="marker">{t('browser.detail.unnamedKey')}</span>
        {:else if line.label.kind === 'item'}
          <span class="bullet" aria-hidden="true">•</span>
        {/if}
        {#if line.kind === 'scalar'}
          {@render scalarText(line)}
        {:else if line.kind === 'alias'}
          <span class="marker">{t('browser.detail.alias')}</span>
        {:else if line.kind === 'elided'}
          <span class="marker">
            {t('browser.detail.elided', { kind: tValueKind(line.valueKind) })}
          </span>
        {:else if line.empty}
          <span class="marker">
            {#if line.shape === 'Sequence'}
              {t('browser.detail.emptySequence')}
            {:else}
              {t('browser.detail.emptyMapping')}
            {/if}
          </span>
        {:else}
          <span class="marker">{tValueKind(line.shape)}</span>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet block(one: LineBlock)}
  <p class="blockLabel">{tDetailField(one.field)}</p>
  {@render lines(one.lines)}
{/snippet}

{#snippet unknownEntries(entries: readonly UnknownEntry[])}
  <p class="count">{tUnknownCount(entries.length)}</p>
  <dl>
    {#each entries as entry (entry.key_node)}
      <dt>
        {#if entry.key === null}
          <span class="marker">{t('browser.detail.unnamedKey')}</span>
        {:else}
          <span class="key">{entry.key}</span>
        {/if}
      </dt>
      <dd class="unknown">
        <span class="marker"
          >{t('browser.detail.unknownValue', { kind: tValueKind(entry.value_kind) })}</span
        >
        <span>{tUnknownReason(entry.reason)}</span>
      </dd>
    {/each}
  </dl>
{/snippet}

<section class="detail" aria-label={t('browser.detail.label')}>
  {#if browser.notice !== null}
    <div class="notice" role="status">
      <p>{tSelectionNotice(browser.notice)}</p>
      <button type="button" onclick={() => browser.dismissNotice()}>
        {t('browser.notice.dismiss')}
      </button>
    </div>
  {/if}

  {#if browser.selectedMatch !== null}
    {@const detail = describeMatch(browser.selectedMatch)}

    {#if browser.selectedDocument !== null}
      <dl>
        <dt>{t('browser.detail.file')}</dt>
        <dd class="source">{browser.selectedDocument.relative_path}</dd>
      </dl>
    {/if}

    <section>
      <h2>{t('browser.detail.section.trigger')}</h2>
      <p class="kind">{t('browser.detail.triggerKind', { kind: tTriggerKind(detail.trigger.kind) })}</p>
      {@render rows(detail.trigger.rows)}
      {#if detail.trigger.triggers !== null}
        {@render block(detail.trigger.triggers)}
      {/if}
    </section>

    <section>
      <h2>{t('browser.detail.section.content')}</h2>
      <p class="kind">{t('browser.detail.contentKind', { kind: tContentKind(detail.content.kind) })}</p>
      {@render rows(detail.content.rows)}
    </section>

    {#if detail.discovery.length > 0 || detail.searchTerms !== null}
      <section>
        <h2>{t('browser.detail.section.discovery')}</h2>
        {@render rows(detail.discovery)}
        {#if detail.searchTerms !== null}
          {@render block(detail.searchTerms)}
        {/if}
      </section>
    {/if}

    {#if hasOptions(detail.options)}
      <section>
        <h2>{t('browser.detail.section.options')}</h2>
        {#if detail.options.matching.length > 0}
          <h3>{t('browser.detail.options.matching')}</h3>
          {@render rows(detail.options.matching)}
        {/if}
        {#if detail.options.casing.length > 0}
          <h3>{t('browser.detail.options.case')}</h3>
          {@render rows(detail.options.casing)}
        {/if}
        {#if detail.options.injection.length > 0}
          <h3>{t('browser.detail.options.injection')}</h3>
          {@render rows(detail.options.injection)}
        {/if}
        {#if detail.options.other.length > 0}
          <h3>{t('browser.detail.options.other')}</h3>
          {@render rows(detail.options.other)}
        {/if}
      </section>
    {/if}

    {#if detail.variables.length > 0}
      <section>
        <h2>{t('browser.detail.section.variables')}</h2>
        {#each detail.variables as variable (variable.node)}
          <article class="card">
            <h3>
              {#if variable.name === null}
                <span class="marker">{t('browser.detail.unnamedVariable')}</span>
              {:else}
                {@render scalarText(variable.name)}
              {/if}
            </h3>
            <p class="kind">
              {t('browser.detail.variableKind', { kind: tVariableKind(variable.kind) })}
            </p>
            {@render rows(variable.rows)}
            {#if variable.params !== null}
              {@render block(variable.params)}
            {/if}
            {#if variable.dependsOn !== null}
              {@render block(variable.dependsOn)}
            {/if}
            {#if variable.unknown.length > 0}
              {@render unknownEntries(variable.unknown)}
            {/if}
          </article>
        {/each}
      </section>
    {/if}

    {#if detail.formFields.length > 0}
      <section>
        <h2>{t('browser.detail.section.formFields')}</h2>
        {@render lines(detail.formFields)}
      </section>
    {/if}

    {#if detail.unknown.length > 0}
      <section>
        <h2>{t('browser.detail.section.unknown')}</h2>
        {@render unknownEntries(detail.unknown)}
      </section>
    {/if}
  {:else}
    <p class="empty">{t('browser.detail.empty')}</p>
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

  section section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  h2 {
    margin: 0.5rem 0 0;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  h3 {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    font-weight: 600;
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
     monospaced face that says "this is what the document holds" — and in a
     `pre`, because a block scalar's newlines are part of what it holds. */
  .source {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  pre.source {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .value {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
  }

  .key {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow-wrap: anywhere;
  }

  /* The boundary of a sequence item, drawn rather than said. `flattenValue`
     produces a flat list of lines, so without a marker two items whose first
     scalar holds a newline read as three unmarked lines and the reader cannot
     tell two from three. The glyph is in the markup rather than in a `content:`
     rule so that it is part of the DOM's text and the R32 window reading can
     see it; it is `aria-hidden` because the `li` already says "item". */
  .bullet {
    color: var(--muted);
  }

  /* What is said about an entry this app does not model: the shape of a value
     that is *not* on screen, and why the entry was not modelled. */
  .unknown {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
  }

  /* Anything this app says *about* a value, rather than the value: the empty
     marker, the spelling, the ambiguity flag, a shape the projection stopped
     at. Never the same face as the file's own text. */
  .marker {
    font-size: 0.6875rem;
    color: var(--muted);
  }

  .warn {
    padding: 0 0.25rem;
    border: 1px solid var(--border);
    border-radius: 4px;
  }

  .kind,
  .count,
  .blockLabel {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .card {
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .lines {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
  }

  /* Indentation by class rather than by an inline `style`: the production CSP
     is `style-src 'self'` with no `unsafe-inline`, so a style attribute would
     be refused and the nesting would silently disappear. */
  .depth-0 {
    padding-inline-start: 0;
  }

  .depth-1 {
    padding-inline-start: 1rem;
  }

  .depth-2 {
    padding-inline-start: 2rem;
  }

  .depth-3 {
    padding-inline-start: 3rem;
  }

  .depth-4 {
    padding-inline-start: 4rem;
  }

  .depth-5 {
    padding-inline-start: 5rem;
  }

  .empty {
    margin: 0;
    color: var(--muted);
  }
</style>
