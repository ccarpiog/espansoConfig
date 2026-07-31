/**
 * A scanner for the one developer string the interface must never render.
 *
 * `classifyFailure()` in `src/lib/ipc/errors.ts` builds an unexpected failure
 * around a **developer** string: Tauri's own English sentence, a thrown
 * `Error`'s message, or `JSON.stringify` of a value nobody designed. Its
 * documentation has said "must not be rendered" since Phase 1b-2a, and until
 * this file existed nothing enforced it — which is CLAUDE.md section 2's rule
 * sitting in a comment instead of in a check.
 *
 * The hardcoded-string scanner cannot help here (`PROGRESS.md` R31): it reads
 * `.svelte` **markup** only, so it sees neither `<script>` bodies, nor `{expr}`
 * provenance, nor anything in a `.ts` file. A message assembled in a store out
 * of a failure's developer string is exactly the shape it is blind to.
 *
 * ## What this file is, after Phase 1b-2b's review, and what it is not
 *
 * **It is no longer what keeps the string off a screen.** The review's fourth
 * finding was that a name scanner *cannot* enforce "never rendered": a component
 * writing `JSON.stringify(classifyFailure(x))` names no guarded identifier and
 * renders it anyway. That is closed in the type instead — the string is not a
 * property of `IpcFailure` any more, it lives behind a non-enumerable symbol,
 * and `errors.test.ts` pins that `JSON.stringify`, `Object.keys`,
 * `Object.values` and a spread all come back without it.
 *
 * What is left for this scanner is narrower and still worth having: the
 * **accessor** {@link GUARDED_IDENTIFIER} is the one supported way to read the
 * string, so demanding that no module outside the two that declare and test it
 * even names the accessor keeps the developer channel where
 * `reportIpcFailure()` put it. That is a claim about imports, which a scanner
 * can decide, rather than a claim about rendering, which it cannot.
 *
 * ## What it cannot see, stated as holes rather than as caveats
 *
 * 1. **Anything reached without the accessor.** There is nothing left to reach —
 *    the symbol is module-private — but a future refactor that put the string
 *    back on the object would restore the whole class. `errors.test.ts` is what
 *    fails then, not this file.
 * 2. **A rename.** If a later phase renames the accessor, this scanner keeps
 *    checking the old name and passes silently. The allow-list's honesty
 *    assertion is the guard: it fails when a listed file stops containing the
 *    identifier, which is what a rename would cause. **This is not
 *    hypothetical** — it is what happened to the old `detail` property, and the
 *    honesty assertion is what would have caught it.
 * 3. **Anything outside `src/`.** A Rust panic message or a menu label built in
 *    `src-tauri/` is a different problem with a different check.
 * 4. **The allow-listed files themselves.** `errors.ts` declares the accessor
 *    and `errors.test.ts` tests it; neither is examined further here. The
 *    runtime half of the guard — that `describeIpcFailure` does not put the
 *    string into its output — lives in `src/lib/i18n/codes.test.ts`.
 */

/** Where the guarded identifier was found. */
export interface DetailFinding {
  /** The file the scanner was given, for the failure message. */
  file: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
  /** The whole line, trimmed, so the failure shows what was written. */
  snippet: string;
}

/**
 * The accessor name this check exists to keep out of the interface.
 *
 * It was `detail`, the property. Phase 1b-2b's review moved the value off the
 * object entirely, so guarding that name would be guarding a name nothing has —
 * which is hole 7 of `docs/decisions/1b-2b-notes.md` happening rather than being
 * predicted, and is why the allow-list's honesty assertion exists.
 */
export const GUARDED_IDENTIFIER = 'developerDetail';

/**
 * Regions blanked before scanning, because they are not code that runs.
 *
 * Comments are masked so that a module explaining *why* it does not read the
 * developer string is not reported for saying so — this file's own documentation
 * is the first example. `<style>` is masked because a CSS class or custom
 * property may legitimately carry the same name.
 */
const MASKED_REGIONS: readonly RegExp[] = [
  /\/\*[\s\S]*?\*\//g,
  /\/\/[^\n]*/g,
  /<!--[\s\S]*?-->/g,
  /<style\b[\s\S]*?<\/style\s*>/gi
];

/** The identifier, bounded so `developerDetails` does not match. */
const IDENTIFIER_PATTERN = /(?<![A-Za-z0-9_$])developerDetail(?![A-Za-z0-9_$])/g;

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
 * Finds every use of the guarded identifier in one source file.
 *
 * String literals are **not** masked. A literal name handed to a dynamic import
 * or a bracket access is the same read written differently, and this scanner
 * would rather report a false positive that a reviewer can dismiss than miss
 * that.
 *
 * @param source - The full contents of a `.ts` or `.svelte` file.
 * @param file - A label used in findings, normally the file's path.
 * @returns Every occurrence, in source order.
 */
export function scanForGuardedProperty(source: string, file: string): DetailFinding[] {
  const scanned = maskRegions(source, MASKED_REGIONS);
  const lines = scanned.split('\n');
  const originalLines = source.split('\n');
  const findings: DetailFinding[] = [];
  lines.forEach((line, index) => {
    IDENTIFIER_PATTERN.lastIndex = 0;
    let match = IDENTIFIER_PATTERN.exec(line);
    while (match !== null) {
      findings.push({
        file,
        line: index + 1,
        column: match.index + 1,
        snippet: (originalLines[index] ?? line).trim()
      });
      match = IDENTIFIER_PATTERN.exec(line);
    } // End of the loop over one line's occurrences
  });
  return findings;
} // End of function scanForGuardedProperty()

/**
 * Renders findings as a human-readable failure message.
 *
 * @param findings - The findings to describe.
 * @returns One line per finding.
 */
export function formatDetailFindings(findings: readonly DetailFinding[]): string {
  return findings
    .map((f) => `${f.file}:${f.line}:${f.column} names "${GUARDED_IDENTIFIER}" — ${f.snippet}`)
    .join('\n');
} // End of function formatDetailFindings()
