/**
 * The developer-string accessor guard, and the proof that it can disagree.
 *
 * An unexpected `IpcFailure` carries a developer string that has been documented
 * as "never to be rendered" since Phase 1b-2a, and a documented property with no
 * test is the failure mode this project keeps rediscovering. This file makes it
 * a check: the scanner runs over every `.ts` and `.svelte` file under `src/` and
 * demands that only the two files which declare and test the accessor so much as
 * name it.
 *
 * **What this file no longer claims.** Phase 1b-2b's review showed that a name
 * scanner cannot enforce "never rendered" —
 * `JSON.stringify(classifyFailure(x))` names nothing and rendered it anyway.
 * That is closed in `src/lib/ipc/errors.ts` instead, by taking the string off
 * the value; `errors.test.ts` is the check that fails if it goes back on. What
 * is checked here is narrower and still true: no module outside the two below
 * names the one accessor that can read it.
 *
 * A lint that only ever passes proves nothing, so the second half runs the same
 * scanner over sources that *do* name it and demands that each one is caught.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatDetailFindings, scanForGuardedProperty } from './ipc-detail';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SOURCE_ROOT = join(REPO_ROOT, 'src');

/**
 * The only files under `src/` allowed to name the guarded accessor.
 *
 * Every entry carries a reason, and the list is asserted in three directions
 * below so it cannot rot into a suppression list — the same shape as the
 * untranslated-value exception list in `src/lib/i18n/dictionaries.test.ts`.
 */
const ALLOWED: ReadonlyMap<string, string> = new Map([
  ['src/lib/ipc/errors.ts', 'declares the accessor and is the only place that builds the value'],
  ['src/lib/ipc/errors.test.ts', 'tests that the value is reachable only through it']
]);

/**
 * Lists every `.ts` and `.svelte` file under `src/`.
 *
 * @returns Repository-relative paths, sorted, so a failure names the same file
 *   every run.
 */
function scannableFiles(): string[] {
  return readdirSync(SOURCE_ROOT, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.ts') || entry.endsWith('.svelte'))
    .map((entry) => relative(REPO_ROOT, join(SOURCE_ROOT, entry)))
    .sort();
} // End of function scannableFiles()

/**
 * Runs the scanner over one repository-relative file.
 *
 * @param file - A path relative to the repository root.
 * @returns The formatted findings, empty when there are none.
 */
function scan(file: string): string {
  const source = readFileSync(join(REPO_ROOT, file), 'utf8');
  return formatDetailFindings(scanForGuardedProperty(source, file));
} // End of function scan()

describe('the sources under src/', () => {
  it('are actually being scanned', () => {
    // Without this the suite below passes vacuously the day someone moves the
    // frontend, which is exactly the failure mode this project keeps hitting.
    expect(scannableFiles().length).toBeGreaterThanOrEqual(8);
  });

  it.each(scannableFiles().filter((file) => !ALLOWED.has(file)))(
    '%s does not name the developer-string accessor',
    (file) => {
      expect(scan(file)).toBe('');
    }
  );
}); // End of the "sources under src/" suite

describe('the allow-list stays honest', () => {
  it('lists only files that exist', () => {
    const missing = [...ALLOWED.keys()].filter((file) => !existsSync(join(REPO_ROOT, file)));
    expect(missing).toEqual([]);
  });

  it('lists only files that really do name the accessor', () => {
    // A stale entry is a bug: it means the accessor was renamed or removed and
    // the scanner is now guarding a name nothing uses, which would pass forever.
    // That is not hypothetical — it is what happened to the old `detail`
    // property when Phase 1b-2b's review moved the value off the object.
    const quiet = [...ALLOWED.keys()].filter((file) => scan(file) === '');
    expect(quiet).toEqual([]);
  }); // End of the "really do name the accessor" case

  it('lists no component, because no component may name it at all', () => {
    const components = [...ALLOWED.keys()].filter((file) => file.endsWith('.svelte'));
    expect(components).toEqual([]);
  });

  it('gives every entry a reason', () => {
    const unexplained = [...ALLOWED.entries()].filter(([, reason]) => reason.trim() === '');
    expect(unexplained).toEqual([]);
  });
}); // End of the "allow-list stays honest" suite

describe('the scanner disagrees when it should', () => {
  it('catches the accessor called in markup', () => {
    const findings = scanForGuardedProperty('<p>{developerDetail(failure)}</p>', 'fixture.svelte');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(1);
  });

  it('catches the accessor called in a script block', () => {
    const source =
      '<script lang="ts">\n  const message = developerDetail(failure);\n</script>\n<p>{message}</p>';
    const findings = scanForGuardedProperty(source, 'fixture.svelte');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(2);
  }); // End of the "called in a script block" case

  it('catches the accessor imported by name', () => {
    const findings = scanForGuardedProperty(
      "import { developerDetail } from './errors';",
      'fixture.ts'
    );
    expect(findings).toHaveLength(1);
  }); // End of the "imported by name" case

  it('catches a dynamic import written as a literal', () => {
    expect(
      scanForGuardedProperty("const read = module['developerDetail'];", 'fixture.ts')
    ).toHaveLength(1);
  });

  it('catches it in a store, which the markup scanner cannot see at all', () => {
    const source =
      'export function toMessage(f: IpcFailure): string {\n  return developerDetail(f) ?? "";\n}';
    const findings = scanForGuardedProperty(source, 'fixture.ts');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(2);
  }); // End of the "store" case
}); // End of the "scanner disagrees" suite

describe('the scanner stays quiet where it should', () => {
  it('ignores a comment explaining why the accessor is not called', () => {
    const source =
      '// developerDetail is developer-only.\n/* and developerDetail stays out of the UI */\nexport {};';
    expect(scanForGuardedProperty(source, 'fixture.ts')).toEqual([]);
  }); // End of the "comment" case

  it('ignores a CSS custom property of a similar name', () => {
    const source = '<style>\n  .developerDetail { color: red; }\n</style>\n<p>{message}</p>';
    expect(scanForGuardedProperty(source, 'fixture.svelte')).toEqual([]);
  });

  it('ignores identifiers that merely contain the word', () => {
    const source =
      'const developerDetails = 1;\nconst rowDeveloperDetail = 2;\nconst developerDetail_view = 3;';
    expect(scanForGuardedProperty(source, 'fixture.ts')).toEqual([]);
  });

  it('says nothing about the old property name, which no value carries now', () => {
    // The value moved off the object at the Phase 1b-2b review, so `detail` is
    // an ordinary word again — `CustomEvent.detail` is the obvious next user.
    // Guarding a dead name is the failure mode hole 7 predicted.
    expect(scanForGuardedProperty('const d = event.detail;', 'fixture.ts')).toEqual([]);
  }); // End of the "old property name" case
}); // End of the "scanner stays quiet" suite

describe('accepted blind spots, pinned so they are visible', () => {
  it('cannot see the accessor reached through a computed name', () => {
    const source = "const name = 'developer' + 'Detail';\nconst read = module[name];";
    expect(scanForGuardedProperty(source, 'fixture.ts')).toEqual([]);
  }); // End of the "computed name" case

  it('cannot see a re-export under another name', () => {
    const source = "export { developerDetail as peek } from './errors';";
    // The re-export itself is caught — this pins that the *alias* is not, so a
    // module importing `peek` is invisible to this scanner. `errors.ts` not
    // re-exporting through the barrel is what makes that a narrow risk.
    expect(scanForGuardedProperty('const m = peek(f);', 'fixture.ts')).toEqual([]);
    expect(scanForGuardedProperty(source, 'fixture.ts')).toHaveLength(1);
  }); // End of the "re-export under another name" case
}); // End of the "accepted blind spots" suite
