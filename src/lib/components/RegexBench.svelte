<script lang="ts">
  import { regexBenchViewOf, type BenchGroupRow, type RegexBenchState } from '../browser/regexBench';
  import { t, tIpcFailure, tRegexCompileFailure, tRegexRefusal } from '../i18n';
  import SourceText from './SourceText.svelte';

  /*
   * The regex bench — Phase 4-22, drawing `../browser/regexBench.ts`.
   *
   * **This file is presentation.** What is drawn, whether a result is behind
   * the draft and which names are insertable are `regexBenchViewOf`'s; which
   * answer is current is the coordinator's, which the editor owns so the
   * *Regex capture* row of `VariableGroup.svelte` reads the same state.
   *
   * **The pattern is the editor's regex box**, never a box of its own: the
   * bench tests the drafted trigger exactly as it stands, so the captures it
   * shows and the row offers are that pattern's. Nothing is sent until *Test*
   * is pressed.
   *
   * **The sample box is a `<textarea>`**, which normalizes every line break to
   * LF before the value reaches this file (`CLAUDE.md` §6). The sample is
   * never written to a file, so no carriage-return refusal applies; the
   * sentence under the box says how line breaks are sent instead.
   *
   * **Result text is drawn as text** through `SourceText`, which names an
   * invisible character rather than drawing it. Every result carrying an
   * engine draws the compatibility sentence (ruling 28) with the version Rust
   * named.
   */

  const {
    pattern,
    benchState,
    run
  }: {
    /** The drafted regex trigger's text, or `null` when the drafted form is not `regex`. */
    pattern: string | null;
    /** The coordinator's state, as the editor mirrors it. */
    benchState: RegexBenchState;
    /**
     * Sends one request for the pattern as it stands and this sample.
     *
     * @param sample - The sample box's text.
     */
    run: (sample: string) => void;
  } = $props();

  /** The sample box's text. Component state: lost when the editor closes. */
  let sample = $state('');

  const view = $derived(regexBenchViewOf(benchState, pattern, sample));

  /**
   * The sentence beside one group's capture.
   *
   * @param row - The group.
   * @returns The sentence, or `null` when the capture itself is drawn.
   */
  function captureNote(row: BenchGroupRow): string | null {
    if (row.capture === null) {
      return t('browser.regexBench.groupUnmatched');
    }
    return row.capture.text === '' ? t('browser.regexBench.groupEmpty') : null;
  } // End of function captureNote()
</script>

{#snippet groupList(groups: readonly BenchGroupRow[])}
  <p class="name">{t('browser.regexBench.groups')}</p>
  {#if groups.length === 0}
    <p class="note" data-bench-notice="noGroups">{t('browser.regexBench.noGroups')}</p>
  {:else}
    <ul class="groups">
      {#each groups as row, index (index)}
        {@const note = captureNote(row)}
        <li data-bench-group={row.name}>
          <code class="groupName">{row.name}</code>
          {#if note !== null}
            <span class="note">{note}</span>
          {:else if row.capture !== null}
            <SourceText text={row.capture.text} />
          {/if}
          {#if row.reference !== null}
            <code class="reference">{row.reference}</code>
          {:else}
            <span class="note">{t('browser.regexBench.notAReference')}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<section class="regexBench" aria-label={t('browser.regexBench.heading')}>
  <h4>{t('browser.regexBench.heading')}</h4>
  <p class="note">{t('browser.regexBench.intro')}</p>
  <label>
    <span class="name">{t('browser.regexBench.sample')}</span>
    <textarea
      class="sample"
      spellcheck="false"
      data-bench-sample
      value={sample}
      oninput={(event) => (sample = event.currentTarget.value)}
    ></textarea>
  </label>
  <p class="note">{t('browser.regexBench.sampleLineBreaks')}</p>
  <p class="choices">
    <button type="button" data-bench-action="test" disabled={!view.testable} onclick={() => run(sample)}>
      {t('browser.regexBench.test')}
    </button>
  </p>

  {#if view.pending}
    <p class="note" aria-live="polite" data-bench-notice="pending">{t('browser.regexBench.pending')}</p>
  {/if}
  {#if view.result !== null}
    {@const result = view.result}
    {#if view.behind}
      <p class="note" data-bench-notice="behind">{t('browser.regexBench.behind')}</p>
    {/if}
    <div class="result" data-bench-result={result.kind}>
      {#if result.kind === 'failed'}
        <p class="failure" role="alert">
          {result.failure.kind === 'ipc'
            ? t('browser.regexBench.failed', { reason: tIpcFailure(result.failure.failure) })
            : t('browser.regexBench.wrongRequest')}
        </p>
      {:else}
        {#if result.kind === 'refused'}
          <p class="failure">{tRegexRefusal(result.refusal)}</p>
          {#if result.compileFailure !== null}
            <p class="note">{tRegexCompileFailure(result.compileFailure)}</p>
          {/if}
        {:else if result.kind === 'notFound'}
          <p data-bench-notice="notFound">{t('browser.regexBench.notFound')}</p>
          {@render groupList(result.groups)}
        {:else}
          <p class="name">{t('browser.regexBench.found')}</p>
          {#if result.whole.text === ''}
            <p class="note" data-bench-notice="emptyMatch">{t('browser.regexBench.emptyMatch')}</p>
          {:else}
            <div data-bench-whole><SourceText text={result.whole.text} /></div>
          {/if}
          {@render groupList(result.groups)}
        {/if}
        <p class="note" data-bench-compatibility>
          {t('browser.regexBench.compatibility', { version: result.engine.version })}
        </p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .regexBench {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin: 0.5rem 0 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    font-size: 0.8125rem;
  }

  .regexBench p,
  .regexBench h4 {
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

  label {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .sample {
    font-family: var(--font-mono);
    min-height: 3rem;
  }

  .result {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .groups {
    margin: 0;
    padding-left: 1.25rem;
  }

  .groups li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    align-items: baseline;
  }

  .groupName,
  .reference {
    font-family: var(--font-mono);
  }

  .failure {
    font-weight: 600;
  }
</style>
