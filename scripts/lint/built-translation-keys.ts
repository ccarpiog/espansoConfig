/**
 * A scanner for translation keys a component built instead of writing.
 *
 * CLAUDE.md section 2 and `PROGRESS.md` state the rule this mechanises:
 *
 * > A component renders a code by calling an accessor, never by building a key.
 *
 * The 1c-1 review found the rule broken for the first time — `DetailPane` wrote
 * `t(selectionNoticeKey(browser.notice))`, which turns a code into a key in
 * markup — and nothing mechanical could see it. `hardcoded-strings.ts` cannot:
 * an expression is exactly what it wants to find in that position. So this is
 * the complementary check, and the two together are the whole of the rule's
 * mechanical half: one says *no literal sentence in markup*, the other says
 * *nothing but a literal key in `t()`*.
 *
 * ## What it looks for
 *
 * A call to `t(` — the bare name, never a longer accessor such as
 * `tSelectionNotice(` — whose first argument does not start with a quote. That
 * catches `t(someKey)`, `t(keyOf(x))` and the template form `` t(`a.${b}`) ``,
 * and it accepts `t('a.b')` and `t("a.b", { … })`.
 *
 * ## What it cannot see, stated as holes
 *
 * 1. **A key built inside an accessor.** That is the point: `codes.ts` and
 *    `plural.ts` build keys from enum members and from a count, and their
 *    return types make a missing key a compile error. The rule is about where a
 *    component may get a string from, not about whether a key may ever be
 *    computed.
 * 2. **`translate(locale, key)` called directly**, or any other name. Only `t(`
 *    is scanned, because `t` is the only one a component is meant to call.
 * 3. **A literal that is the wrong key.** `t('browser.notice.gone')` where
 *    `kept` was meant type-checks, scans clean and is wrong. `notices.test.ts`
 *    pins the code-to-key map for that.
 */

/** Where a built key was found. */
export interface BuiltKeyFinding {
  /** The file the scanner was given, for the failure message. */
  file: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number of the `t(`. */
  column: number;
  /** The call as written, truncated, for the failure message. */
  snippet: string;
}

/**
 * A call to the bare `t` translator, with whatever begins its first argument.
 *
 * The lookbehind is what keeps `tSelectionNotice(`, `format(` and `obj.t(` out:
 * only a `t` that no identifier character and no dot precedes is the translator
 * a component calls.
 */
const CALL_PATTERN = /(?<![\p{L}\p{N}_$.])t\(\s*(.)/gu;

/** How much of an offending call the failure message shows. */
const SNIPPET_LENGTH = 48;

/**
 * Finds `t()` calls whose key is computed rather than written.
 *
 * @param source - The full contents of a `.svelte` or `.ts` file.
 * @param file - A label used in findings, normally the file's path.
 * @returns Every built key, in source order.
 */
export function findBuiltTranslationKeys(source: string, file: string): BuiltKeyFinding[] {
  const findings: BuiltKeyFinding[] = [];
  for (const match of source.matchAll(CALL_PATTERN)) {
    const first = match[1];
    if (first === "'" || first === '"') {
      continue;
    }
    const offset = match.index;
    const before = source.slice(0, offset);
    const newlineIndex = before.lastIndexOf('\n');
    findings.push({
      file,
      line: before.split('\n').length,
      column: offset - newlineIndex,
      snippet: source.slice(offset, offset + SNIPPET_LENGTH).split('\n')[0] ?? ''
    });
  } // End of the loop over one file's `t(` calls
  return findings;
} // End of function findBuiltTranslationKeys()

/**
 * Renders findings as a human-readable failure message.
 *
 * @param findings - The findings to describe.
 * @returns One line per finding.
 */
export function formatBuiltKeyFindings(findings: readonly BuiltKeyFinding[]): string {
  return findings
    .map((f) => `${f.file}:${f.line}:${f.column} ${JSON.stringify(f.snippet)}`)
    .join('\n');
} // End of function formatBuiltKeyFindings()
