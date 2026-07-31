/**
 * A scanner for user-facing text written directly into Svelte markup.
 *
 * CLAUDE.md section 2 forbids a hardcoded user-facing string. This is the
 * mechanical half of that rule: it reads a `.svelte` file, throws away the
 * `<script>` and `<style>` blocks and the comments, and reports any run of
 * markup text — or any value of a user-visible attribute — that contains
 * letters and did not arrive through a `{...}` expression.
 *
 * ## What it can see
 *
 * - A literal in a text node: `<h1>Nothing is open yet</h1>`.
 * - A literal in a user-visible attribute: `<input placeholder="Search" />`,
 *   and likewise `title`, `alt`, `label` and the `aria-*` attributes that are
 *   read aloud.
 * - Literals inside `{#if}` / `{#each}` bodies, because those are ordinary
 *   markup once the block tags themselves are skipped as expressions.
 *
 * ## What it cannot see, stated as holes rather than as caveats
 *
 * 1. **Anything in `<script>`.** The whole block is masked before scanning, so
 *    `const label = 'Save';` followed by `{label}` in the markup is invisible
 *    to it. This is the largest hole and it is not closable by this technique.
 * 2. **Whether `{expr}` came from `t()`.** Any expression at all satisfies the
 *    scanner. `{'Save'}` passes. It checks the *shape* of the markup, never the
 *    provenance of a value.
 * 3. **Strings in `.ts` and `.svelte.ts` files**, including error messages
 *    thrown from stores and anything a future IPC layer renders.
 * 4. **Text reaching the screen through a component prop**, `{@html}`, a
 *    `content:` rule in CSS, or a native menu built in Rust.
 * 5. **Attributes outside the list below.** The list is a judgement about which
 *    attributes users read, not a complete enumeration of the platform's.
 *
 * So a clean run means "no literal is sitting in markup", which is a real and
 * checkable property, and it does **not** mean "no hardcoded string exists".
 * The rest of the rule is carried by review.
 */

/** Where a suspected hardcoded string was found. */
export interface Finding {
  /** The file the scanner was given, for the failure message. */
  file: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
  /** Whether the text sat in a text node or in an attribute value. */
  kind: 'text' | 'attribute';
  /** The offending text, trimmed, for the failure message. */
  snippet: string;
}

/**
 * Attributes whose literal value is read by a user.
 *
 * Deliberately short: every entry is an attribute a screen reader speaks or a
 * tooltip shows. Adding `value` or `placeholder`-alikes without thinking would
 * make the scanner noisy on `<option value="system">`, which is an identifier
 * and not prose.
 */
const VISIBLE_TEXT_ATTRIBUTES: ReadonlySet<string> = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'label',
  'placeholder',
  'title'
]);

/** Regions masked out before scanning, because they are not markup. */
const MASKED_REGIONS: readonly RegExp[] = [
  /<script\b[\s\S]*?<\/script\s*>/gi,
  /<style\b[\s\S]*?<\/style\s*>/gi,
  /<!--[\s\S]*?-->/g
];

/** An HTML character entity, which is punctuation dressed as letters. */
const ENTITY_PATTERN = /&(?:#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi;

/**
 * Replaces whole regions with spaces, preserving every newline.
 *
 * Masking rather than deleting keeps every remaining character at its original
 * offset, so reported line and column numbers point into the real file.
 *
 * @param source - The original file text.
 * @param patterns - Regions to blank out.
 * @returns Text of the same length with the matched regions blanked.
 */
function maskRegions(source: string, patterns: readonly RegExp[]): string {
  let masked = source;
  for (const pattern of patterns) {
    masked = masked.replace(pattern, (match) => match.replace(/[^\n]/g, ' '));
  }
  return masked;
} // End of function maskRegions()

/**
 * Decides whether a run of text is prose rather than punctuation or an entity.
 *
 * @param text - A candidate run of markup text.
 * @returns `true` when at least one letter survives entity removal.
 */
function containsWords(text: string): boolean {
  return /\p{L}/u.test(text.replace(ENTITY_PATTERN, ' '));
} // End of function containsWords()

/**
 * Skips a quoted JavaScript string starting at `start`.
 *
 * @param text - The text being scanned.
 * @param start - Index of the opening quote.
 * @returns The index just past the closing quote, or the end of the text.
 */
function skipStringLiteral(text: string, start: number): number {
  const quote = text.charAt(start);
  let index = start + 1;
  while (index < text.length) {
    const character = text.charAt(index);
    if (character === '\\') {
      index += 2;
      continue;
    }
    if (character === quote) {
      return index + 1;
    }
    index += 1;
  }
  return index;
} // End of function skipStringLiteral()

/**
 * Skips a `{...}` expression, including nested braces and quoted strings.
 *
 * Svelte's block tags (`{#if}`, `{/each}`, `{:else}`) are expressions as far as
 * this scanner cares, so they fall out of the same rule.
 *
 * @param text - The text being scanned.
 * @param start - Index of the opening brace.
 * @returns The index just past the matching closing brace.
 */
function skipExpression(text: string, start: number): number {
  let index = start + 1;
  let depth = 1;
  while (index < text.length && depth > 0) {
    const character = text.charAt(index);
    if (character === '"' || character === "'" || character === '`') {
      index = skipStringLiteral(text, index);
      continue;
    }
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
    }
    index += 1;
  }
  return index;
} // End of function skipExpression()

/**
 * Builds a finding with a line and column derived from a byte offset.
 *
 * @param file - The file being scanned.
 * @param text - The masked source, used to count newlines.
 * @param offset - Offset of the finding within `text`.
 * @param kind - Whether the finding is a text node or an attribute value.
 * @param snippet - The offending text.
 * @returns The finding.
 */
function makeFinding(
  file: string,
  text: string,
  offset: number,
  kind: Finding['kind'],
  snippet: string
): Finding {
  const before = text.slice(0, offset);
  const newlineIndex = before.lastIndexOf('\n');
  return {
    file,
    line: before.split('\n').length,
    column: offset - newlineIndex,
    kind,
    snippet
  };
} // End of function makeFinding()

/**
 * Scans one tag, reporting literal values of user-visible attributes.
 *
 * @param text - The masked source.
 * @param start - Index of the tag's `<`.
 * @param file - The file being scanned, for findings.
 * @param findings - Accumulator the tag's findings are appended to.
 * @returns The index just past the tag's `>`.
 */
function scanTag(text: string, start: number, file: string, findings: Finding[]): number {
  const length = text.length;
  let index = start + 1;
  while (index < length && !/[\s/>]/.test(text.charAt(index))) {
    index += 1;
  }

  while (index < length) {
    const character = text.charAt(index);
    if (character === '>') {
      return index + 1;
    }
    if (/\s/.test(character) || character === '/') {
      index += 1;
      continue;
    }
    if (character === '{') {
      // A spread (`{...props}`) or a shorthand attribute (`{disabled}`).
      index = skipExpression(text, index);
      continue;
    }

    const nameStart = index;
    while (index < length && !/[\s=/>]/.test(text.charAt(index))) {
      index += 1;
    }
    const name = text.slice(nameStart, index).toLowerCase();

    while (index < length && /\s/.test(text.charAt(index))) {
      index += 1;
    }
    if (text.charAt(index) !== '=') {
      continue;
    }
    index += 1;
    while (index < length && /\s/.test(text.charAt(index))) {
      index += 1;
    }

    const quote = text.charAt(index);
    if (quote === '"' || quote === "'") {
      const valueStart = index + 1;
      let end = valueStart;
      while (end < length && text.charAt(end) !== quote) {
        end += 1;
      }
      const value = text.slice(valueStart, end);
      if (VISIBLE_TEXT_ATTRIBUTES.has(name) && !value.includes('{') && containsWords(value)) {
        findings.push(makeFinding(file, text, valueStart, 'attribute', `${name}="${value}"`));
      }
      index = end + 1;
    } else if (quote === '{') {
      index = skipExpression(text, index);
    } else {
      while (index < length && !/[\s>]/.test(text.charAt(index))) {
        index += 1;
      }
    }
  } // End of the loop over one tag's attributes

  return index;
} // End of function scanTag()

/**
 * Finds literal user-facing text in the markup of one Svelte component.
 *
 * @param source - The full contents of a `.svelte` file.
 * @param file - A label used in findings, normally the file's path.
 * @returns Every suspected hardcoded string, in source order.
 */
export function scanSvelteMarkup(source: string, file: string): Finding[] {
  const markup = maskRegions(source, MASKED_REGIONS);
  const findings: Finding[] = [];
  let index = 0;
  let textStart = 0;
  let text = '';

  /** Reports the accumulated text run if it looks like prose, then clears it. */
  const flushText = (): void => {
    if (containsWords(text)) {
      findings.push(makeFinding(file, markup, textStart, 'text', text.trim()));
    }
    text = '';
  };

  while (index < markup.length) {
    const character = markup.charAt(index);
    if (character === '<') {
      flushText();
      index = scanTag(markup, index, file, findings);
      textStart = index;
    } else if (character === '{') {
      flushText();
      index = skipExpression(markup, index);
      textStart = index;
    } else {
      if (text === '') {
        textStart = index;
      }
      text += character;
      index += 1;
    }
  } // End of the loop over the component's markup
  flushText();

  return findings;
} // End of function scanSvelteMarkup()

/**
 * Renders findings as a human-readable failure message.
 *
 * @param findings - The findings to describe.
 * @returns One line per finding.
 */
export function formatFindings(findings: readonly Finding[]): string {
  return findings
    .map((f) => `${f.file}:${f.line}:${f.column} (${f.kind}) ${JSON.stringify(f.snippet)}`)
    .join('\n');
} // End of function formatFindings()
