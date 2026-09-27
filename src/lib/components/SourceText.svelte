<script lang="ts">
  import { sourceSegments, startsFileLine } from '../browser/sourceText';
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
   *
   * **`wrap` is the one exception, and it keeps the premise by marking lines.**
   * The owner ruled at 4-13 (B5) that the disk-version box wraps long lines. A
   * wrapping box draws the **same segments and the same `<br>` per break** as
   * the box that does not wrap, so its DOM text and a copy of it are the
   * same. Before each segment that starts a file line (`startsFileLine`) it
   * adds an **empty** `lineStart` element whose `›` is CSS generated content:
   * drawn, never part of the text, never copied. A visual row with no `›` is a
   * soft wrap and never a line the file has; a sentence under the box says so.
   * Only the disk-version boxes pass `wrap`; nothing in TypeScript forces a
   * caller to choose, and every other box keeps `pre` and the scroll.
   */

  const {
    text,
    documentStart = false,
    wrap = false
  }: { text: string; documentStart?: boolean; wrap?: boolean } = $props();

  const segments = $derived(sourceSegments(text, documentStart));
</script>

<div class="sourceText" class:wrap>{#each segments as segment, index (index)}{#if wrap && startsFileLine(segments, index)}<span class="lineStart" aria-hidden="true"></span>{/if}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'break'}<br />{:else}<span class="invisible" title={t('browser.source.invisibleDetail')}>{tInvisible(segment)}</span>{/if}{/each}</div>
{#if wrap}
  <p class="wrapLegend">{t('browser.source.wrapLegend')}</p>
{/if}

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

  /* The wrapping variant (B5). `break-spaces` keeps every space the file has,
     wraps where it must, and lets a trailing space take room rather than hang;
     `overflow-wrap: anywhere` breaks a word with no space in it rather than
     cutting it at the edge. Every file line starts with a `.lineStart` marker;
     a continuation row has none, which is what keeps a soft wrap from passing
     for a line the file has. */
  .sourceText.wrap {
    white-space: break-spaces;
    overflow-wrap: anywhere;
    overflow-x: visible;
  }

  /* An empty element: its `›` is generated content, so it is drawn but is not
     text, and a selection or a copy of the box never carries it. */
  .lineStart {
    display: inline-block;
    width: 1.25rem;
    user-select: none;
    -webkit-user-select: none;
  }

  .lineStart::before {
    content: '›';
    font-family: var(--font-ui);
    color: var(--muted);
  }

  .wrapLegend {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: var(--muted);
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
    /* The container preserves whitespace; this marker is prose and must not, so
       its own spaces collapse. It must not wrap either: a break between the
       marker's words would start the rest of the file line on a new visual line,
       which is the false line break the container's rule exists to forbid. The
       boundaries around the marker take the container's `pre`, which offers no
       wrap opportunity, so with `nowrap` here nothing in a file line can wrap —
       in the default container. In the wrapping one (`wrap`) a row may break
       beside the marker, and the missing `›` on the next row says so. */
    white-space: nowrap;
  }
</style>
