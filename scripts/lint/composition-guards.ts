/**
 * The scoped architectural check of the 2d-6 record's §3 entry 37 — Phase 2d-6-11a.
 *
 * Two questions, both answered from source text alone:
 *
 * 1. **Does a surface component import a command directly?** A component under
 *    `src/lib/components/` may reach the Tauri boundary only through the
 *    `BrowserState` it is handed. The composition root, `AppShell.svelte`, is
 *    the one component that assembles the real boundary, and the test file
 *    allows it by name with a reason. {@link scanBoundaryImports} reports every
 *    static or literal dynamic import, and every `export … from`, that names a
 *    boundary module ({@link BOUNDARY_MODULES}, anything under `@tauri-apps/`)
 *    with a value binding, or that names one of the real-boundary bindings of
 *    `workspace.svelte.ts` ({@link BOUNDARY_BINDINGS}). A type-only import is
 *    not reported: it is erased before anything runs.
 * 2. **Does every mounted suite declare its guard?** A suite opts into a DOM by
 *    a `@vitest-environment` docblock ({@link declaredEnvironment}); the test
 *    file keeps an inventory of every such suite and the guard it declares, and
 *    {@link guardEvidence} checks that the suite's text carries that guard.
 *
 * ## What this check is not
 *
 * **A static import check is not proof against dynamic execution.** It reads
 * import statements; it does not run anything. It cannot see:
 *
 * - a command reached **transitively** — a component importing a browser module
 *   that itself imports a command wrapper at value level is not reported, because
 *   only the component's own imports are read (`workspace.svelte.ts` holds such a
 *   binding today, and the invoke spies of the mounted suites are what would
 *   notice a call through it, in the cases those suites run);
 * - a specifier **computed** at run time (`import(name)`), a global such as
 *   `window.__TAURI_INTERNALS__`, or a function handed in through a prop;
 * - anything the test file's allow-list or inventory is told to accept.
 *
 * The guard half is weaker still: it checks that a suite's text **carries** a
 * mock of `@tauri-apps/api/core` and an `afterEach` that reads its spy, not that
 * the assertion in that `afterEach` is the right one, nor that every case in the
 * suite runs under it. Reading that is a reviewer's job.
 */

import { dirname, posix } from 'node:path';

/** One reason a file failed the check. */
export interface CompositionFinding {
  /** The file the checker was given, for the failure message. */
  readonly file: string;
  /** 1-based line of the offending statement, or 1 for a whole-file finding. */
  readonly line: number;
  /** What is wrong, in one sentence. */
  readonly message: string;
}

/**
 * The modules that are the Tauri boundary, as repository paths without an
 * extension. A value import from any of them, or from anything under
 * `@tauri-apps/`, is a direct command import.
 *
 * `src/lib/ipc/index` and the bare directory are the barrel, which re-exports
 * the command wrappers. `errors` and `types` are not listed: neither imports
 * `invoke` or `listen` (their own import lines say so), and the shell's failure
 * reporter lives in `errors`.
 */
export const BOUNDARY_MODULES: readonly string[] = [
  'src/lib/ipc/commands',
  'src/lib/ipc/events',
  'src/lib/ipc/menu',
  'src/lib/ipc/index',
  'src/lib/ipc'
];

/**
 * Value bindings that carry the real boundary although their module is not in
 * {@link BOUNDARY_MODULES}: `workspace.svelte.ts` assembles `REAL_COMMANDS` and
 * `REAL_BACKUP_COMMANDS`, and `createBrowserState` defaults to them when an
 * argument is omitted, so calling it is an act of composition.
 */
export const BOUNDARY_BINDINGS: ReadonlyMap<string, readonly string[]> = new Map([
  ['src/lib/browser/workspace.svelte', ['REAL_COMMANDS', 'REAL_BACKUP_COMMANDS', 'createBrowserState']]
]);

/** Comments, blanked before scanning so a sentence about an import is not one. */
const COMMENT_PATTERNS: readonly RegExp[] = [/\/\*[\s\S]*?\*\//g, /\/\/[^\n]*/g, /<!--[\s\S]*?-->/g];

/**
 * Replaces every match of every pattern with spaces, keeping newlines, so a
 * reported line number points into the real file.
 *
 * @param source - The original text.
 * @param patterns - The regions to blank.
 * @returns Text of the same length.
 */
function blank(source: string, patterns: readonly RegExp[]): string {
  let masked = source;
  for (const pattern of patterns) {
    masked = masked.replace(pattern, (match) => match.replace(/[^\n]/g, ' '));
  }
  return masked;
} // End of function blank()

/**
 * Keeps only the `<script>` bodies of a component, blanking markup and style,
 * so an import-shaped sentence in markup is not read as an import.
 *
 * @param source - A `.svelte` file.
 * @returns Text of the same length with everything outside `<script>` blanked.
 */
function scriptsOnly(source: string): string {
  const kept = source.replace(/[^\n]/g, ' ').split('');
  const pattern = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let match = pattern.exec(source);
  while (match !== null) {
    const body = match[1] ?? '';
    const start = match.index + match[0].indexOf(body);
    for (let offset = 0; offset < body.length; offset += 1) {
      kept[start + offset] = body[offset] ?? ' ';
    }
    match = pattern.exec(source);
  } // End of the loop over the script blocks
  return kept.join('');
} // End of function scriptsOnly()

/**
 * The 1-based line of an offset.
 *
 * @param text - The text.
 * @param offset - A character offset into it.
 * @returns Its line number.
 */
function lineOf(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length;
} // End of function lineOf()

/**
 * Resolves an import specifier to a repository path without an extension, or
 * leaves a bare package specifier as it is.
 *
 * @param specifier - What the statement names.
 * @param file - The importing file, repository-relative with `/` separators.
 * @returns The resolved path.
 */
export function resolveSpecifier(specifier: string, file: string): string {
  let resolved: string;
  if (specifier.startsWith('.')) {
    resolved = posix.normalize(posix.join(dirname(file).split('\\').join('/'), specifier));
  } else if (specifier.startsWith('$lib/') || specifier === '$lib') {
    resolved = `src/lib${specifier.slice('$lib'.length)}`;
  } else {
    return specifier;
  }
  return resolved.replace(/\/$/, '').replace(/\.(ts|js|svelte\.ts|svelte\.js)$/, '');
} // End of function resolveSpecifier()

/**
 * Whether a resolved module is the boundary itself.
 *
 * @param resolved - A path from {@link resolveSpecifier}.
 * @returns True for a {@link BOUNDARY_MODULES} entry or a `@tauri-apps/` package.
 */
function isBoundaryModule(resolved: string): boolean {
  return resolved.startsWith('@tauri-apps/') || BOUNDARY_MODULES.includes(resolved);
} // End of function isBoundaryModule()

/**
 * The value bindings of an import or export clause, with type-only ones removed.
 *
 * @param clause - The text between `import`/`export` and `from`.
 * @returns `null` for a namespace or default import (which reaches every export),
 *   otherwise the imported names; empty when the clause is type-only.
 */
function valueBindings(clause: string): readonly string[] | null {
  const trimmed = clause.trim();
  if (/^type\b/.test(trimmed)) {
    return [];
  }
  const braced = /\{([\s\S]*)\}/.exec(trimmed);
  const outside = braced === null ? trimmed : trimmed.replace(braced[0], '');
  if (/[A-Za-z_$*]/.test(outside.replace(/,/g, ''))) {
    // A default binding or `* as name` — it reaches the whole module.
    return null;
  }
  if (braced === null) {
    return [];
  }
  return (braced[1] ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '' && !/^type\b/.test(part))
    .map((part) => part.split(/\s+as\s+/)[0]?.trim() ?? part);
} // End of function valueBindings()

/**
 * Reports every direct command import in one file.
 *
 * A `.svelte` file is read in its `<script>` blocks only; comments are blanked in
 * every file. String literals are **not** blanked, so a literal dynamic
 * `import('../ipc/commands')` is reported rather than missed.
 *
 * @param source - The file's text.
 * @param file - The file's repository-relative path, which relative specifiers
 *   resolve against and findings name.
 * @returns One finding per offending statement, in source order.
 */
export function scanBoundaryImports(source: string, file: string): CompositionFinding[] {
  const code = blank(file.endsWith('.svelte') ? scriptsOnly(source) : source, COMMENT_PATTERNS);
  const findings: CompositionFinding[] = [];
  const statement =
    /\b(import|export)\s+([^;'"]*?)\s*from\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match = statement.exec(code);
  while (match !== null) {
    const specifier = match[3] ?? match[4] ?? match[5] ?? '';
    const resolved = resolveSpecifier(specifier, file);
    const line = lineOf(code, match.index);
    // A side-effect import and a dynamic import reach the whole module.
    const bindings = match[3] === undefined ? null : valueBindings(match[2] ?? '');
    const guardedNames = BOUNDARY_BINDINGS.get(resolved);
    if (isBoundaryModule(resolved) && (bindings === null || bindings.length > 0)) {
      findings.push({ file, line, message: `imports the boundary module "${specifier}" at value level` });
    } else if (guardedNames !== undefined) {
      const named =
        bindings === null ? guardedNames : bindings.filter((name) => guardedNames.includes(name));
      if (named.length > 0) {
        findings.push({
          file,
          line,
          message: `imports the real boundary (${named.join(', ')}) from "${specifier}"`
        });
      }
    }
    match = statement.exec(code);
  } // End of the loop over the import and export statements
  return findings;
} // End of function scanBoundaryImports()

/**
 * The environment a test file's docblock opts into, if any.
 *
 * This uses the pattern Vitest 4 itself applies (`cli-api` chunk,
 * `/@(?:vitest|jest)-environment\s+([\w-]+)\b/`) over the whole file text, so a
 * line comment, a `@jest-` spelling or a tag after an import is found exactly
 * when Vitest would honour it. It is a copy of that pattern, not a call into
 * Vitest: a future Vitest that changes its pattern is not tracked here.
 *
 * @param source - A test file's text.
 * @returns The environment named, or `null` when there is no tag.
 */
export function declaredEnvironment(source: string): string | null {
  const tag = /@(?:vitest|jest)-environment\s+([\w-]+)\b/.exec(source);
  return tag?.[1] ?? null;
}

/**
 * The guards a mounted suite can declare in the inventory.
 *
 * - `invokeZero` — `@tauri-apps/api/core` is mocked by a recording spy and an
 *   `afterEach` holds that spy to no call.
 * - `invokeExactList` — the same mock, and an `afterEach` that compares the
 *   spy's calls to the case's declared list (`AppShell.test.ts`, entry 36).
 * - `mountsNothing` — the suite mounts no component and imports neither a
 *   component nor a boundary module, so it has no boundary to guard.
 */
export type SuiteGuard = 'invokeZero' | 'invokeExactList' | 'mountsNothing';

/**
 * The text of every `afterEach(…)` call, found by bracket balance.
 *
 * Brackets inside strings and comments are counted too; a suite that defeats
 * this by writing an unbalanced bracket in a string gets a finding, not a pass.
 *
 * @param code - A suite's text with comments blanked.
 * @returns The argument text of each call.
 */
function afterEachBodies(code: string): string[] {
  const bodies: string[] = [];
  const opener = /\bafterEach\s*\(/g;
  let match = opener.exec(code);
  while (match !== null) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < code.length && depth > 0) {
      const character = code[index];
      if (character === '(') {
        depth += 1;
      } else if (character === ')') {
        depth -= 1;
      }
      index += 1;
    } // End of the loop that finds the call's closing bracket
    bodies.push(code.slice(match.index + match[0].length, index - 1));
    match = opener.exec(code);
  } // End of the loop over the afterEach calls
  return bodies;
} // End of function afterEachBodies()

/**
 * Checks that a mounted suite's text carries the guard it declares.
 *
 * @param source - The suite's text.
 * @param file - Its repository-relative path.
 * @param guard - The guard the inventory declares for it, or `undefined` when
 *   the inventory does not list it — which is itself the finding.
 * @returns The findings; empty when the evidence is present.
 */
export function guardEvidence(
  source: string,
  file: string,
  guard: SuiteGuard | undefined
): CompositionFinding[] {
  if (guard === undefined) {
    return [{ file, line: 1, message: 'opts into a DOM environment and declares no guard' }];
  }
  const code = blank(source, COMMENT_PATTERNS);
  const findings: CompositionFinding[] = [];
  if (guard === 'mountsNothing') {
    const reaches = scanBoundaryImports(source, file);
    findings.push(...reaches);
    if (/\bimport\s[^;]*\bmount\b[^;]*from\s*['"]svelte['"]/.test(code)) {
      findings.push({ file, line: 1, message: 'declares it mounts nothing, but imports `mount`' });
    }
    if (/from\s*['"][^'"]+\.svelte['"]/.test(code)) {
      findings.push({ file, line: 1, message: 'declares it mounts nothing, but imports a component' });
    }
    return findings;
  }
  const spy = /vi\.mock\(\s*['"]@tauri-apps\/api\/core['"]\s*,\s*\(\)\s*=>\s*\(\{[\s\S]*?\binvoke\b[\s\S]*?\b(\w+)\s*\(/.exec(
    code
  );
  if (spy === null) {
    findings.push({
      file,
      line: 1,
      message: 'declares an invoke guard but does not mock `@tauri-apps/api/core` with a recording spy'
    });
    return findings;
  }
  const name = spy[1] ?? '';
  const reads = afterEachBodies(code).filter((body) => new RegExp(`\\b${name}\\b`).test(body));
  if (reads.length === 0) {
    findings.push({ file, line: 1, message: `no \`afterEach\` reads the invoke spy \`${name}\`` });
  } else if (guard === 'invokeExactList' && !reads.some((body) => /\.toEqual\(/.test(body))) {
    findings.push({ file, line: 1, message: 'declares an exact invoke list but compares no list' });
  } else if (
    guard === 'invokeZero' &&
    !reads.some((body) => /\.not\.toHaveBeenCalled\(\)|\.toBe\(0\)|toHaveBeenCalledTimes\(0\)/.test(body))
  ) {
    findings.push({ file, line: 1, message: 'declares an invoke-zero guard but asserts no zero' });
  }
  return findings;
} // End of function guardEvidence()

/**
 * Renders findings as a failure message.
 *
 * @param findings - The findings.
 * @returns One line per finding.
 */
export function formatCompositionFindings(findings: readonly CompositionFinding[]): string {
  return findings.map((f) => `${f.file}:${f.line} ${f.message}`).join('\n');
} // End of function formatCompositionFindings()
