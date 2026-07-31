<script lang="ts">
  import {
    describeMatch,
    hasDiscovery,
    indentClass,
    type LineBlock,
    type ScalarDisplay,
    type ScalarRow,
    type SourceSlice,
    type UnknownRow,
    type ValueLine
  } from '../browser/detail';
  import type { BrowserState } from '../browser/workspace.svelte';
  import SourceText from './SourceText.svelte';
  import {
    t,
    tContentKind,
    tDetailField,
    tHazard,
    tOptionGroup,
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
   * **An entry this app does not model shows its key, the *shape* of its value,
   * why it was not modelled — and, as of Phase 1c-2b-2b-1, the value's own
   * bytes.** Which of the three things goes in the `dt` — a name, the empty
   * marker, or "not a plain name" — is `describeUnknown`'s decision, not this
   * file's: an entry whose key is the empty string used to reach here as a bare
   * string and draw a blank `dt`. The value arrived on the wire at 1c-2b-2a,
   * sliced in Rust because a JavaScript string index is a UTF-16 offset and a
   * `ByteSpan` is not, and was deliberately left unread until the sentence
   * saying it was not on screen could change in the same commit. It has. The
   * four `code.unknownReason.*` sentences did **not** change and were checked
   * rather than assumed: they say the entry was recorded and is kept exactly as
   * the file writes it, which is a claim about what this app does to the file
   * and is untouched by drawing it. See `docs/decisions/1c-2a-notes.md` section
   * 12 hole 13, `docs/decisions/1c-2b-2a-notes.md` section 10, and
   * `docs/decisions/1c-2b-2b-1-notes.md`.
   *
   * **A sentence sits above the arm it is true of, never above all three.**
   * `SourceSlice` has three arms and `slice` below draws each one differently,
   * so a caption written *outside* the `{#if}` is a caption that has to be true
   * of an unreadable span as well as of a readable one. The 1c-2b-2b-1 review
   * found exactly that: `browser.detail.unknownValue` claimed the bytes were
   * "shown as the file writes it" while the `unavailable` arm underneath said
   * this app could not read them. So `unknownValue` now says only what shape the
   * value has, and the `valueAsWritten` claim — that the bytes below are the
   * file's own — sits inside the `text` arm and nowhere else. `detail.test.ts`
   * asserts that **position**, not merely that the string is used.
   *
   * **The match's own bytes are a section of their own, drawn through
   * `SourceText`.** Not a `<pre>` written here: how a byte survives *rendering*
   * — a line break counted once, a character with no glyph named rather than
   * drawn as nothing, no soft wrap that could pass for a line break — is decided
   * in `../browser/sourceText.ts`, which has a test suite, and is shared with
   * the raw YAML viewer of 1c-2b-2b-2. The scope sentence beside the heading
   * says which part of the file this is, because `source_text` stops at the
   * match's own node and a reader would otherwise take it for the snippet's
   * whole text. It describes **no syntax**: `MatchView::project` projects every
   * item of a `matches` sequence, so the item may be a flow mapping with no `-`
   * and no indentation in front of it, or an empty item whose span is
   * zero-width — measured, and recorded in
   * `docs/decisions/1c-2b-2b-1-notes.md` section 3.
   *
   * **The one judgement in this pane is a refusal, never a permission.**
   * `matchEditability` answers `unrestricted` for most matches and this file
   * draws **nothing** for that arm on purpose: Phase 1 is read-only, so "this
   * snippet can be edited safely" is a promise about an editor the reader
   * cannot reach. A refusal is different — the mutation entry point really does
   * refuse (`EditError::Refused`), and the snippet list already carries the
   * `Not editable` badge for the same fact. What this pane adds is the *reason*.
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

{#snippet slice(one: SourceSlice)}
  {#if one.kind === 'text'}
    <span class="marker">{t('browser.detail.valueAsWritten')}</span>
    <SourceText text={one.text} />
  {:else if one.kind === 'empty'}
    <span class="marker">{t('browser.detail.emptyText')}</span>
  {:else}
    <span class="marker warn">{t('browser.detail.valueUnavailable')}</span>
  {/if}
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
            {t('browser.detail.elided', { kind: tValueKind(line.elided.kind) })}
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

{#snippet unknownEntries(entries: readonly UnknownRow[])}
  <p class="count">{tUnknownCount(entries.length)}</p>
  <dl>
    {#each entries as entry (entry.node)}
      <dt>
        {#if entry.key.kind === 'named'}
          <span class="key">{entry.key.text}</span>
        {:else if entry.key.kind === 'empty'}
          <span class="marker">{t('browser.detail.emptyText')}</span>
        {:else}
          <span class="marker">{t('browser.detail.unnamedKey')}</span>
        {/if}
      </dt>
      <dd class="unknown">
        <p class="says">
          <span class="marker"
            >{t('browser.detail.unknownValue', { kind: tValueKind(entry.valueKind) })}</span
          >
          <span>{tUnknownReason(entry.reason)}</span>
        </p>
        {@render slice(entry.value)}
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

    {#if detail.editability.kind === 'blocked'}
      <p class="blocked">
        {t('browser.detail.notEditable', { kind: tHazard(detail.editability.hazard) })}
      </p>
    {:else if detail.editability.kind === 'blockedUnnamed'}
      <p class="blocked">{t('browser.detail.notEditableUnnamed')}</p>
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

    {#if hasDiscovery(detail)}
      <section>
        <h2>{t('browser.detail.section.discovery')}</h2>
        {@render rows(detail.discovery)}
        {#if detail.searchTerms !== null}
          {@render block(detail.searchTerms)}
        {/if}
      </section>
    {/if}

    {#if detail.options.length > 0}
      <section>
        <h2>{t('browser.detail.section.options')}</h2>
        {#each detail.options as group (group.name)}
          <h3>{tOptionGroup(group.name)}</h3>
          {@render rows(group.rows)}
        {/each}
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

    <section>
      <h2>{t('browser.detail.section.source')}</h2>
      <p class="kind">{t('browser.detail.sourceScope')}</p>
      {@render slice(detail.source)}
    </section>
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
     `pre`, because a block scalar's newlines are part of what it holds. The
     face itself is `--font-mono` in `src/app.css`, stated once because it
     carries that meaning wherever it appears. */
  .source {
    font-family: var(--font-mono);
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
    font-family: var(--font-mono);
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

  /* What is said about an entry this app does not model — the shape of its
     value and why it was not modelled — above the value's own bytes. A column,
     because the bytes are a block and belong on their own lines; `.says` is the
     sentence pair, which still reads as one line and wraps like one. */
  .unknown {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .says {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
    margin: 0;
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

  /* The pane's one judgement. Bordered like `.warn` because it is the same
     kind of statement — this app declining to touch something — and set in the
     body face rather than the marker face because it is a sentence the reader
     is meant to read, not a label beside a value. */
  .blocked {
    margin: 0;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    font-size: 0.8125rem;
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

  /* The `.depth-N` ladder this line's indentation comes from is in
     `src/app.css`, unscoped. A component's `<style>` is scoped by Svelte, so a
     rule written here would compile to `.depth-3.svelte-<hash>` and no second
     pane could ever reach it; indentation is not this pane's private idea.
     `MAX_INDENT_DEPTH` in `../browser/detail.ts` is the contract with that
     file, and `detail.test.ts` checks it there. */
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
  }

  .empty {
    margin: 0;
    color: var(--muted);
  }
</style>
