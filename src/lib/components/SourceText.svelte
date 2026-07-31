<script lang="ts">
  import { sourceSegments } from '../browser/sourceText';
  import { t, tInvisible } from '../i18n';

  /*
   * A run of the file's own bytes, drawn as the file writes them.
   *
   * **The one rendering surface for file text**, shared by the detail pane's
   * source-text section and its unmodelled values today, and by the raw YAML
   * viewer of Phase 1c-2b-2b-2 tomorrow. Every decision it implements is in
   * `../browser/sourceText.ts`, which has a test suite; this file is the walk
   * over the segments that module produces, and the stylesheet those segments
   * need.
   *
   * Three things in the markup below are load-bearing and are not style.
   *
   * **The markup is one line, with no whitespace between the container tag and
   * the block that fills it.** `white-space: pre` preserves everything inside
   * the container, so a newline and an indent written *here* for legibility
   * would be a newline and an indent the file does not have. `sourceText.test.ts`
   * asserts the exact opening sequence for that reason.
   *
   * **A line break is a `<br>`, never a newline in a text node.** The number of
   * breaks is decided in `sourceSegments`, so a CRLF draws one break rather than
   * one plus whatever the engine does with a stray carriage return.
   *
   * **`white-space: pre` rather than `pre-wrap`.** A soft wrap is
   * indistinguishable from a line break the file does not contain, which is
   * exactly the kind of thing this pane exists not to do; the container scrolls
   * sideways instead. That costs a long line a scroll gesture, and it is the
   * cost this project's whole premise implies.
   */

  const { text, documentStart = false }: { text: string; documentStart?: boolean } = $props();

  const segments = $derived(sourceSegments(text, documentStart));
</script>

<div class="sourceText">{#each segments as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'break'}<br />{:else}<span class="invisible" title={t('browser.source.invisibleDetail')}>{tInvisible(segment)}</span>{/if}{/each}</div>

<style>
  /* The face that means "this is what the document holds" (`src/app.css`), and
     the two rules that keep it honest: nothing wraps, so every visual line is a
     line the file has, and the box scrolls sideways when a line is longer than
     the pane. `max-width` is what makes the scroll happen here rather than
     stretching the pane it sits in. */
  .sourceText {
    font-family: var(--font-mono);
    white-space: pre;
    overflow-x: auto;
    max-width: 100%;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
  }

  /* A character the file holds and no font draws. Bordered like the other
     things this app says *about* a value rather than the value itself, and in
     the body face so it cannot be mistaken for the document's own text. */
  .invisible {
    font-family: var(--font-ui);
    font-size: 0.6875rem;
    padding: 0 0.25rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    color: var(--muted);
    /* The container preserves whitespace; this marker is prose and must not. */
    white-space: normal;
  }
</style>
