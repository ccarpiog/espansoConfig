/**
 * Phase 4-14-1 — **no command in the tree runs a process or reads the
 * clipboard for a variable.**
 *
 * Step 4-14's acceptance (`docs/decisions/4-split-notes.md` §2): "no execution
 * and no clipboard-read path is introduced (a test asserts that no command in
 * the tree reads the clipboard or spawns a process for a variable)". A `shell`,
 * `script` or `clipboard` variable is **text this application writes**; espanso
 * may run the command or read the clipboard when the snippet expands, and this
 * application never does.
 *
 * ## What it scans
 *
 * - every Rust source under `src-tauri/src/` and `crates/espansoconfig-core/src/`
 *   — the command layer and the core it wraps — for a process spawn (`std` or
 *   `tokio` `process::Command`, `Command::new`, `libc`'s `fork`/`exec*`/
 *   `posix_spawn`/`system`/`popen`) and for a clipboard or shell crate;
 * - every TypeScript and Svelte source under `src/` (tests excluded), the IPC
 *   layer `src/lib/ipc/` among them, for a clipboard **read**
 *   (`navigator.clipboard.read`/`readText`, a paste command) and for a Tauri
 *   shell or clipboard plugin or Node's `child_process`. Writing to the
 *   clipboard is allowed: `src/lib/components/clipboard.ts` copies a text with
 *   `navigator.clipboard.writeText`, and nothing here matches it;
 * - the two Cargo manifests and `package.json` for a shell, process or
 *   clipboard dependency, and `src-tauri/capabilities/` for a shell or
 *   clipboard permission.
 *
 * ## The one exception, pinned
 *
 * `make_fifo` in `crates/espansoconfig-core/src/persist/write.rs` shells out to
 * `mkfifo(1)` to build a test fixture. It sits inside that file's
 * `#[cfg(test)] mod tests`, is compiled into no binary, and serves no variable;
 * the allow-list below names it — the exact call, inside the module's braces
 * found by bounded brace matching — and the test fails if it moves out of the
 * test module or if a second occurrence appears.
 *
 * ## What it cannot see, stated as holes
 *
 * A text scan, not a call graph: a spawn reached through a crate this tree does
 * not name (the dependency checks narrow that), or spelled through a macro or
 * an alias, is not seen. It proves the absence of the named spellings, which is
 * what every current path would have to use.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** One forbidden spelling and why. */
interface Forbidden {
  /** What it looks for. */
  readonly pattern: RegExp;
  /** What it would mean. */
  readonly meaning: string;
}

/** A spelling found in a file. */
interface Hit {
  /** The file, relative to the repository root. */
  readonly file: string;
  /** 1-based line number. */
  readonly line: number;
  /** What the spelling would mean. */
  readonly meaning: string;
}

/** What a Rust source may not spell. */
const RUST_FORBIDDEN: readonly Forbidden[] = [
  { pattern: /\bprocess::Command\b/, meaning: 'spawns a process (std or tokio)' },
  { pattern: /\bCommand::new\s*\(/, meaning: 'spawns a process' },
  { pattern: /\buse\s+std::process::\{?[^;]*\bCommand\b/, meaning: 'imports the process spawner' },
  { pattern: /\blibc::(fork|vfork|execv\w*|execl\w*|posix_spawn\w*|system|popen)\b/, meaning: 'spawns a process through libc' },
  { pattern: /\btauri_plugin_(shell|clipboard\w*|process)\b/, meaning: 'a Tauri shell, process or clipboard plugin' },
  { pattern: /\b(arboard|copypasta|clipboard_rs|cli_clipboard)::/, meaning: 'reads or writes the system clipboard' }
];

/** What a TypeScript or Svelte source may not spell. */
const FRONTEND_FORBIDDEN: readonly Forbidden[] = [
  { pattern: /\bclipboard\s*\.\s*read(Text)?\s*\(/, meaning: 'reads the clipboard' },
  { pattern: /execCommand\s*\(\s*['"]paste['"]/, meaning: 'reads the clipboard through a paste command' },
  { pattern: /['"]@tauri-apps\/plugin-(shell|clipboard[\w-]*|process)['"]/, meaning: 'a Tauri shell, process or clipboard plugin' },
  { pattern: /['"](node:)?child_process['"]/, meaning: 'spawns a process' },
  { pattern: /\bCommand\s*\.\s*(create|sidecar)\s*\(/, meaning: "the shell plugin's process spawner" }
];

/** What a manifest may not depend on. */
const MANIFEST_FORBIDDEN: readonly Forbidden[] = [
  { pattern: /tauri-plugin-(shell|clipboard[\w-]*|process)/, meaning: 'a Tauri shell, process or clipboard plugin' },
  { pattern: /@tauri-apps\/plugin-(shell|clipboard[\w-]*|process)/, meaning: 'a Tauri shell, process or clipboard plugin' },
  { pattern: /^\s*(arboard|copypasta|clipboard-rs|cli-clipboard|duct|subprocess)\s*=/m, meaning: 'a clipboard or process crate' }
];

/** What a capability file may not grant. */
const CAPABILITY_FORBIDDEN: readonly Forbidden[] = [
  { pattern: /"(shell|clipboard-manager|process):[^"]*"/, meaning: 'a shell, clipboard or process permission' }
];

/**
 * Every file under a directory whose name passes a filter, skipping build
 * output and dependencies.
 *
 * @param directory - The directory, relative to the repository root.
 * @param keep - Whether a file's path is wanted.
 * @returns The paths, relative to the repository root.
 */
function filesUnder(directory: string, keep: (path: string) => boolean): string[] {
  const found: string[] = [];
  /**
   * Walks one directory.
   *
   * @param absolute - Its absolute path.
   */
  const walk = (absolute: string): void => {
    for (const entry of readdirSync(absolute)) {
      if (entry === 'node_modules' || entry === 'target' || entry === 'gen' || entry.startsWith('.')) {
        continue;
      }
      const path = join(absolute, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (keep(path)) {
        found.push(relative(REPO_ROOT, path));
      }
    } // End of the loop over the directory's entries
  }; // End of function walk()
  walk(join(REPO_ROOT, directory));
  return found.sort();
} // End of function filesUnder()

/**
 * Every forbidden spelling in a set of files.
 *
 * @param files - Paths relative to the repository root.
 * @param forbidden - What may not be spelled.
 * @returns The hits, in file and line order.
 */
function scan(files: readonly string[], forbidden: readonly Forbidden[]): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    const lines = readFileSync(join(REPO_ROOT, file), 'utf8').split('\n');
    lines.forEach((text, index) => {
      // One hit per line: the first rule it trips.
      const rule = forbidden.find((one) => one.pattern.test(text));
      if (rule !== undefined) {
        hits.push({ file, line: index + 1, meaning: rule.meaning });
      }
    });
  } // End of the loop over the files
  return hits;
} // End of function scan()

/**
 * The 1-based line range a `#[cfg(test)] mod tests { … }` occupies, from its
 * opening brace to the brace that closes it, or `null` when there is none or it
 * never closes. Braces inside string literals, character literals and line
 * comments are not counted; the walk is bounded by the source's length.
 *
 * @param lines - The source, split into lines.
 * @returns The first and last line of the module, or `null`.
 */
function testModuleRange(lines: readonly string[]): { readonly first: number; readonly last: number } | null {
  const attribute = lines.findIndex((text, index) => text.trim() === '#[cfg(test)]' && /^mod tests\s*\{/.test(lines[index + 1] ?? ''));
  if (attribute < 0) {
    return null;
  }
  let depth = 0;
  let opened = false;
  for (let index = attribute + 1; index < lines.length; index += 1) {
    const text = lines[index] ?? '';
    let inString = false;
    for (let at = 0; at < text.length; at += 1) {
      const char = text[at];
      if (inString) {
        if (char === '\\') {
          at += 1;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '/' && text[at + 1] === '/') {
        break;
      }
      if (char === '"') {
        inString = true;
      } else if (char === "'" && (text[at + 2] === "'" || (text[at + 1] === '\\' && text[at + 3] === "'"))) {
        at += text[at + 1] === '\\' ? 3 : 2;
      } else if (char === '{') {
        depth += 1;
        opened = true;
      } else if (char === '}') {
        depth -= 1;
        if (opened && depth === 0) {
          return { first: attribute + 2, last: index + 1 };
        }
      }
    } // End of the walk over the line's characters
  } // End of the walk over the lines after the attribute
  return null;
} // End of function testModuleRange()

/**
 * Whether one line of a source is the pinned exception's call, judged over the
 * source's own lines (pure, so a regression can hand it a synthetic source):
 * exactly `std::process::Command::new("mkfifo")`, in `fn make_fifo`, strictly
 * inside the braces of the `#[cfg(test)] mod tests` module — the 4-14-1 review's
 * second finding: following the opening attribute is not being inside.
 *
 * @param lines - The source, split into lines.
 * @param line - The 1-based line of the hit.
 * @returns `true` when it is the allowed call where it is allowed.
 */
function isTheTestFifoIn(lines: readonly string[], line: number): boolean {
  const module = testModuleRange(lines);
  return (
    module !== null &&
    line > module.first &&
    line < module.last &&
    (lines[line - 1] ?? '').trim() === 'std::process::Command::new("mkfifo")' &&
    lines.slice(Math.max(0, line - 4), line).some((text) => /fn make_fifo\(/.test(text))
  );
} // End of function isTheTestFifoIn()

/**
 * Whether a hit is the one pinned exception: `make_fifo`'s `mkfifo(1)` call
 * inside `write.rs`'s `#[cfg(test)] mod tests`.
 *
 * @param hit - The hit.
 * @returns `true` when it is.
 */
function isTheTestFifo(hit: Hit): boolean {
  if (hit.file !== join('crates', 'espansoconfig-core', 'src', 'persist', 'write.rs')) {
    return false;
  }
  return isTheTestFifoIn(readFileSync(join(REPO_ROOT, hit.file), 'utf8').split('\n'), hit.line);
} // End of function isTheTestFifo()

/** The Rust sources of the command layer and the core. */
const RUST_SOURCES = [
  ...filesUnder('src-tauri/src', (path) => path.endsWith('.rs')),
  ...filesUnder('crates/espansoconfig-core/src', (path) => path.endsWith('.rs'))
];

/** The frontend sources, tests excluded. */
const FRONTEND_SOURCES = filesUnder(
  'src',
  (path) => /\.(ts|svelte|js)$/.test(path) && !/\.test\.ts$/.test(path) && !path.endsWith('fixtures.ts')
);

describe('no command in the tree runs a process or reads the clipboard for a variable', () => {
  it('scans a real tree: the command layer, the core and the IPC layer are all read', () => {
    expect(RUST_SOURCES.some((path) => path.startsWith(join('src-tauri', 'src', 'commands')))).toBe(true);
    expect(RUST_SOURCES.some((path) => path.startsWith(join('crates', 'espansoconfig-core', 'src', 'draft')))).toBe(true);
    expect(FRONTEND_SOURCES.some((path) => path.startsWith(join('src', 'lib', 'ipc')))).toBe(true);
    expect(RUST_SOURCES.length).toBeGreaterThan(50);
    expect(FRONTEND_SOURCES.length).toBeGreaterThan(50);
  });

  it('finds no process spawn and no clipboard crate in any Rust source but the pinned test fixture', () => {
    const hits = scan(RUST_SOURCES, RUST_FORBIDDEN);
    expect(hits.filter((hit) => !isTheTestFifo(hit))).toEqual([]);
    // The exception is still where the allow-list says, and alone: a scan that
    // stopped reading files would find nothing and pass vacuously.
    expect(hits.filter(isTheTestFifo)).toHaveLength(1);
  });

  it('finds no clipboard read, no shell or clipboard plugin and no process spawn in the frontend, the IPC layer included', () => {
    expect(scan(FRONTEND_SOURCES, FRONTEND_FORBIDDEN)).toEqual([]);
    // Writing the clipboard is allowed and is there: the scan reads that file.
    const copier = join('src', 'lib', 'components', 'clipboard.ts');
    expect(FRONTEND_SOURCES).toContain(copier);
    expect(readFileSync(join(REPO_ROOT, copier), 'utf8')).toContain('navigator.clipboard.writeText');
  });

  it('depends on no shell, process or clipboard plugin, and grants no such permission', () => {
    const manifests = ['src-tauri/Cargo.toml', 'crates/espansoconfig-core/Cargo.toml', 'Cargo.toml', 'package.json'];
    expect(scan(manifests, MANIFEST_FORBIDDEN)).toEqual([]);
    const capabilities = filesUnder('src-tauri/capabilities', (path) => path.endsWith('.json'));
    expect(capabilities.length).toBeGreaterThan(0);
    expect(scan(capabilities, CAPABILITY_FORBIDDEN)).toEqual([]);
  });

  it('would notice each spelling it forbids', () => {
    /**
     * Whether one sample line trips a rule set.
     *
     * @param line - The sample.
     * @param forbidden - The rules.
     * @returns `true` when a rule matches.
     */
    const trips = (line: string, forbidden: readonly Forbidden[]): boolean => forbidden.some((rule) => rule.pattern.test(line));
    for (const line of [
      'let out = std::process::Command::new(cmd).output();',
      'use std::process::{Command, Stdio};',
      'tokio::process::Command::new("sh")',
      'unsafe { libc::fork() };',
      'tauri_plugin_shell::init()',
      'let text = arboard::Clipboard::new()'
    ]) {
      expect(trips(line, RUST_FORBIDDEN)).toBe(true);
    } // End of the loop over the Rust samples
    for (const line of [
      'const text = await navigator.clipboard.readText();',
      'await navigator.clipboard.read();',
      "import { Command } from '@tauri-apps/plugin-shell';",
      "import { readText } from '@tauri-apps/plugin-clipboard-manager';",
      "document.execCommand('paste');",
      "import { spawn } from 'node:child_process';"
    ]) {
      expect(trips(line, FRONTEND_FORBIDDEN)).toBe(true);
    } // End of the loop over the frontend samples
    expect(trips('await navigator.clipboard.writeText(text);', FRONTEND_FORBIDDEN)).toBe(false);
    expect(trips('std::thread::spawn(move || work())', RUST_FORBIDDEN)).toBe(false);
    expect(trips('"tauri-plugin-shell" = "2"', MANIFEST_FORBIDDEN)).toBe(true);
    expect(trips('"permissions": ["clipboard-manager:allow-read-text"]', CAPABILITY_FORBIDDEN)).toBe(true);
  });

  it('allows the fifo call only inside the cfg(test) module’s braces (the 4-14-1 review, finding 2)', () => {
    const inside = [
      'pub fn real() {}',
      '',
      '#[cfg(test)]',
      'mod tests {',
      '    use super::*;',
      '',
      '    fn make_fifo(path: &Path) -> bool {',
      '        std::process::Command::new("mkfifo")',
      '            .arg(path)',
      '            .status()',
      '            .map(|status| status.success())',
      '            .unwrap_or(false)',
      '    }',
      '}'
    ];
    expect(isTheTestFifoIn(inside, 8)).toBe(true);
    // The same function moved after the module closes: shipped code, refused.
    const after = [...inside.slice(0, 6), '}', '', ...inside.slice(6, 13)];
    expect(after[after.length - 6]).toContain('Command::new("mkfifo")');
    expect(isTheTestFifoIn(after, after.length - 5)).toBe(false);
    // Another command inside the module is not the allowed call.
    const other = inside.map((text) => text.replace('"mkfifo"', '"sh"'));
    expect(isTheTestFifoIn(other, 8)).toBe(false);
    // A module that never closes proves nothing.
    expect(isTheTestFifoIn(inside.slice(0, 13), 8)).toBe(false);
  });
}); // End of the no-execution suite
