/**
 * The import and guard inventory check — the 2d-6 record's §3 entry 37, Phase
 * 2d-6-11a.
 *
 * Two inventories over the real tree, each asserted in three directions so it
 * cannot rot into a suppression list (the shape of `ipc-detail.test.ts`):
 *
 * 1. **No surface component imports a command directly.** Every `.svelte` file
 *    and every non-test `.ts` file under `src/lib/components/`, plus
 *    `src/App.svelte`, is scanned by `scanBoundaryImports`; only the composition
 *    root may appear in {@link COMPOSITION_ROOTS}, and it must really import the
 *    boundary, or its entry is stale.
 * 2. **Every mounted suite declares its guard.** Every test file under `src/` and
 *    `scripts/` whose docblock opts into a DOM environment must appear in
 *    {@link MOUNTED_SUITES}, and its text must carry the guard it is listed with.
 *
 * Then the checker is pinned to **fail**: a synthetic unguarded suite, a
 * synthetic direct command import from a component, and their near variants must
 * each be reported. A check that only ever passes proves nothing.
 *
 * **A static import check is not proof against dynamic execution.** This file
 * reads import statements and test-file text. A command reached transitively, a
 * specifier computed at run time, or a boundary function handed in through a
 * prop is invisible to it, and the "accepted blind spots" block pins two of those
 * so the limit is visible rather than assumed away. The invoke spies the guarded
 * suites carry are what would notice such a call — in the cases those suites run,
 * and no others.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  declaredEnvironment,
  formatCompositionFindings,
  guardEvidence,
  scanBoundaryImports,
  type SuiteGuard
} from './composition-guards';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The components allowed to import the real boundary, each with its reason.
 *
 * One entry, and the record's ruling is that there is one: the shell builds the
 * `BrowserState` every other component is handed.
 */
const COMPOSITION_ROOTS: ReadonlyMap<string, string> = new Map([
  [
    'src/lib/components/AppShell.svelte',
    'the composition root: builds the BrowserState over REAL_COMMANDS, REAL_BACKUP_COMMANDS and REAL_RECONCILIATION_EVENTS'
  ]
]);

/**
 * Every test file that opts into a DOM environment, with the guard it declares
 * and why that guard is the applicable one (Q8: "the applicable invoke guard").
 */
const MOUNTED_SUITES: ReadonlyMap<string, { readonly guard: SuiteGuard; readonly reason: string }> =
  new Map([
    [
      'src/lib/components/AppShell.test.ts',
      {
        guard: 'invokeExactList',
        reason: 'mounts the production composition, so each case declares its exact command list (entry 36)'
      }
    ],
    [
      'src/lib/components/DetailPane.test.ts',
      { guard: 'invokeZero', reason: 'injected surfaces over a real BrowserState; drains counted separately' }
    ],
    [
      'src/lib/components/RestorePane.test.ts',
      { guard: 'invokeZero', reason: 'injected surfaces over a real BrowserState' }
    ],
    [
      'src/lib/components/ReconciliationStatus.test.ts',
      { guard: 'invokeZero', reason: 'injected surfaces over a real BrowserState' }
    ],
    [
      'src/lib/browser/reconciliationStatus.svelte.test.ts',
      { guard: 'invokeZero', reason: 'a real BrowserState over injected commands' }
    ],
    ['src/lib/components/MatchEditor.test.ts', { guard: 'invokeZero', reason: 'injected props only' }],
    [
      'src/lib/components/MatchEditorScalar.test.ts',
      { guard: 'invokeZero', reason: 'injected props only' }
    ],
    [
      'src/lib/components/MatchEditorTriggers.test.ts',
      { guard: 'invokeZero', reason: 'injected props only' }
    ],
    [
      'src/lib/components/MatchEditorVariables.test.ts',
      { guard: 'invokeZero', reason: 'injected props only' }
    ],
    ['src/lib/components/MatchCreator.test.ts', { guard: 'invokeZero', reason: 'injected props only' }],
    [
      'src/lib/components/MatchDeleter.test.ts',
      { guard: 'invokeZero', reason: 'injected props, and one real BrowserState over injected commands' }
    ],
    [
      'src/lib/components/MatchMover.test.ts',
      { guard: 'invokeZero', reason: 'injected props, and real BrowserStates over injected commands' }
    ],
    [
      'src/lib/components/MatchDuplicator.test.ts',
      { guard: 'invokeZero', reason: 'injected props, and one real BrowserState over injected commands' }
    ],
    [
      'src/lib/components/FileScope.test.ts',
      { guard: 'invokeZero', reason: 'injected props, and real BrowserStates over injected commands' }
    ],
    [
      'src/lib/components/BulkInspector.test.ts',
      { guard: 'invokeZero', reason: 'injected props, and real BrowserStates over injected commands' }
    ],
    [
      'src/lib/components/FilePreferences.test.ts',
      { guard: 'invokeZero', reason: 'injected props, and real BrowserStates over injected commands' }
    ],
    ['src/lib/components/RawEditor.test.ts', { guard: 'invokeZero', reason: 'injected props only' }],
    ['src/lib/components/RawSnippetEditor.test.ts', { guard: 'invokeZero', reason: 'injected props only' }],
    ['src/lib/components/RecoveryPanel.test.ts', { guard: 'invokeZero', reason: 'injected props only' }],
    [
      'src/lib/components/reveal.test.ts',
      { guard: 'mountsNothing', reason: 'a DOM-helper suite: it mounts no component and imports no boundary' }
    ]
  ]);

/**
 * Lists files under one repository directory, recursively.
 *
 * @param root - A repository-relative directory.
 * @param keep - Which repository-relative paths to keep.
 * @returns Repository-relative paths with `/` separators, sorted.
 */
function filesUnder(root: string, keep: (file: string) => boolean): string[] {
  return readdirSync(join(REPO_ROOT, root), { recursive: true, encoding: 'utf8' })
    .map((entry) => relative(REPO_ROOT, join(REPO_ROOT, root, entry)).split('\\').join('/'))
    .filter(keep)
    .sort();
} // End of function filesUnder()

/**
 * The files whose imports are checked: every component, every non-test helper
 * beside them, and the application's top component.
 *
 * @returns Repository-relative paths, sorted.
 */
function surfaceFiles(): string[] {
  const components = filesUnder(
    'src/lib/components',
    (file) => file.endsWith('.svelte') || (file.endsWith('.ts') && !file.endsWith('.test.ts'))
  );
  return [...components, 'src/App.svelte'].sort();
} // End of function surfaceFiles()

/**
 * Every test file under the two roots `vite.config.ts` includes whose docblock
 * names an environment other than `node`.
 *
 * @returns Repository-relative paths, sorted.
 */
function discoveredMountedSuites(): string[] {
  const tests = [
    ...filesUnder('src', (file) => file.endsWith('.test.ts')),
    ...filesUnder('scripts', (file) => file.endsWith('.test.ts'))
  ];
  return tests
    .filter((file) => {
      const environment = declaredEnvironment(readFileSync(join(REPO_ROOT, file), 'utf8'));
      return environment !== null && environment !== 'node';
    })
    .sort();
} // End of function discoveredMountedSuites()

/**
 * Scans one real file for direct command imports.
 *
 * @param file - A repository-relative path.
 * @returns The formatted findings, empty when there are none.
 */
function importsOf(file: string): string {
  return formatCompositionFindings(scanBoundaryImports(readFileSync(join(REPO_ROOT, file), 'utf8'), file));
} // End of function importsOf()

/**
 * Checks one real mounted suite against its inventory entry.
 *
 * @param file - A repository-relative path.
 * @returns The formatted findings, empty when the guard is present.
 */
function guardOf(file: string): string {
  const source = readFileSync(join(REPO_ROOT, file), 'utf8');
  return formatCompositionFindings(guardEvidence(source, file, MOUNTED_SUITES.get(file)?.guard));
} // End of function guardOf()

/**
 * The DOM opt-in docblock, assembled so this file does not carry the tag itself:
 * Vitest reads `@vitest-environment` from anywhere in a test file's comments and
 * literals, and a literal here switched this whole suite into jsdom.
 */
const JSDOM_DOCBLOCK = `/** @vitest-${'environment'} jsdom */`;

/** An invoke-zero guard written the way the guarded suites write it. */
const GUARDED_SUITE = [
  JSDOM_DOCBLOCK,
  "import { afterEach, vi } from 'vitest';",
  'const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));',
  "vi.mock('@tauri-apps/api/core', () => ({",
  '  invoke: (...args: readonly unknown[]): Promise<never> => {',
  '    invoked(...args);',
  "    return Promise.reject(new Error('no command'));",
  '  }',
  '}));',
  'afterEach(() => {',
  '  expect(invoked).not.toHaveBeenCalled();',
  '});'
].join('\n');

describe('no surface component imports a command directly', () => {
  it('scans the components that exist', () => {
    // Without this the cases below pass vacuously the day the components move.
    expect(surfaceFiles().filter((file) => file.endsWith('.svelte')).length).toBeGreaterThanOrEqual(19);
  });

  it.each(surfaceFiles().filter((file) => !COMPOSITION_ROOTS.has(file)))(
    '%s imports no boundary module and no real-boundary binding',
    (file) => {
      expect(importsOf(file)).toBe('');
    }
  );
}); // End of the "no surface component imports a command directly" suite

describe('the composition-root allowance stays honest', () => {
  it('lists only files that exist', () => {
    expect([...COMPOSITION_ROOTS.keys()].filter((file) => !existsSync(join(REPO_ROOT, file)))).toEqual([]);
  });

  it('lists only files that really import the boundary', () => {
    // A root that stopped composing would keep an allowance nothing uses.
    expect([...COMPOSITION_ROOTS.keys()].filter((file) => importsOf(file) === '')).toEqual([]);
  });

  it('gives every entry a reason', () => {
    expect([...COMPOSITION_ROOTS.values()].filter((reason) => reason.trim() === '')).toEqual([]);
  });
}); // End of the "composition-root allowance" suite

describe('every mounted suite declares its guard', () => {
  it('discovers the suites that exist', () => {
    expect(discoveredMountedSuites().length).toBeGreaterThanOrEqual(13);
  });

  it.each(discoveredMountedSuites())('%s is inventoried and carries its guard', (file) => {
    expect(guardOf(file)).toBe('');
  });

  it('inventories only suites that are discovered', () => {
    // A stale entry: the file moved, was deleted or lost its docblock.
    const discovered = new Set(discoveredMountedSuites());
    expect([...MOUNTED_SUITES.keys()].filter((file) => !discovered.has(file))).toEqual([]);
  }); // End of the "only suites that are discovered" case

  it('gives every entry a reason', () => {
    expect([...MOUNTED_SUITES.values()].filter((entry) => entry.reason.trim() === '')).toEqual([]);
  });
}); // End of the "every mounted suite declares its guard" suite

describe('the checker fails when it should', () => {
  it('reports an unguarded synthetic mounted suite that is not inventoried', () => {
    const unguarded = [
      JSDOM_DOCBLOCK,
      "import { mount } from 'svelte';",
      "import Sidebar from './Sidebar.svelte';",
      "it('mounts', () => { mount(Sidebar, { target: document.body }); });"
    ].join('\n');
    expect(declaredEnvironment(unguarded)).toBe('jsdom');
    const findings = guardEvidence(unguarded, 'src/lib/components/Synthetic.test.ts', undefined);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('declares no guard');
  }); // End of the "unguarded synthetic mounted suite" case

  it('finds the environment tag where Vitest would, not only in a leading docblock', () => {
    const tag = `-${'environment'} jsdom`;
    expect(declaredEnvironment(`// @vitest${tag}\nimport { mount } from 'svelte';\n`)).toBe('jsdom');
    expect(declaredEnvironment(`/** @jest${tag} */\n`)).toBe('jsdom');
    expect(declaredEnvironment(`import { mount } from 'svelte';\n/** @vitest${tag} */\n`)).toBe('jsdom');
    expect(declaredEnvironment("import { mount } from 'svelte';\n")).toBeNull();
  }); // End of the "finds the environment tag where Vitest would" case

  it('reports a synthetic suite that claims an invoke guard and mocks nothing', () => {
    const unguarded = JSDOM_DOCBLOCK + "\nimport { mount } from 'svelte';\n";
    const findings = guardEvidence(unguarded, 'fixture.test.ts', 'invokeZero');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('does not mock');
  });

  it('reports a synthetic suite whose spy no afterEach reads', () => {
    const withoutAssertion = GUARDED_SUITE.replace(/afterEach\([\s\S]*$/, '');
    expect(guardEvidence(withoutAssertion, 'fixture.test.ts', 'invokeZero')).toHaveLength(1);
  });

  it('reports a synthetic invoke-zero suite that asserts no zero', () => {
    const relaxed = GUARDED_SUITE.replace('.not.toHaveBeenCalled()', '.toHaveBeenCalledTimes(3)');
    expect(guardEvidence(relaxed, 'fixture.test.ts', 'invokeZero')).toHaveLength(1);
  });

  it('reports a synthetic mocking guard hidden in a comment', () => {
    const commented = GUARDED_SUITE.replace("vi.mock('@tauri-apps", "// vi.mock('@tauri-apps");
    expect(guardEvidence(commented, 'fixture.test.ts', 'invokeZero')).toHaveLength(1);
  });

  it('reports a synthetic "mounts nothing" suite that mounts a component', () => {
    const mounting = JSDOM_DOCBLOCK + "\nimport { mount } from 'svelte';\nimport X from './X.svelte';\n";
    expect(guardEvidence(mounting, 'fixture.test.ts', 'mountsNothing')).toHaveLength(2);
  });

  it('reports a synthetic direct command import from a surface component', () => {
    const source = [
      '<script lang="ts">',
      "  import { saveMatch } from '../ipc/commands';",
      '</script>',
      '<button onclick={() => saveMatch()}>x</button>'
    ].join('\n');
    const findings = scanBoundaryImports(source, 'src/lib/components/Synthetic.svelte');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(2);
  }); // End of the "synthetic direct command import" case

  it.each([
    ["import { invoke } from '@tauri-apps/api/core';", 'the Tauri package'],
    ["import * as commands from '../ipc/commands';", 'a namespace import'],
    ["import { listDocuments } from '../ipc';", 'the barrel'],
    ["import { setMenuLabels } from '$lib/ipc/menu';", 'the $lib alias'],
    ["import { REAL_RECONCILIATION_EVENTS } from '../ipc/events';", 'the events wrapper'],
    ["import { REAL_COMMANDS } from '../browser/workspace.svelte';", 'a real-boundary binding'],
    ["import { createBrowserState, type BrowserState } from '../browser/workspace.svelte';", 'the factory'],
    ["const commands = await import('../ipc/commands');", 'a literal dynamic import'],
    ["export { saveMatch } from '../ipc/commands';", 'a re-export'],
    ["import '../ipc/commands';", 'a side-effect import']
  ])('reports %s (%s)', (statement) => {
    const source = `<script lang="ts">\n  ${statement}\n</script>\n`;
    expect(scanBoundaryImports(source, 'src/lib/components/Synthetic.svelte')).toHaveLength(1);
  });
}); // End of the "checker fails when it should" suite

describe('the checker stays quiet where it should', () => {
  it('accepts the invoke-zero guard the guarded suites write', () => {
    expect(guardEvidence(GUARDED_SUITE, 'fixture.test.ts', 'invokeZero')).toEqual([]);
  });

  it.each([
    ["import type { CommandResult } from '../ipc/commands';", 'a type-only import'],
    ["import { type BrowserState } from '../browser/workspace.svelte';", 'an inline type specifier'],
    ["import { classifyFailure } from '../ipc/errors';", 'the errors module, which holds no invoke'],
    ["import { ALL_DOCUMENTS } from '../browser/sidebar';", 'an ordinary browser module']
  ])('accepts %s (%s)', (statement) => {
    const source = `<script lang="ts">\n  ${statement}\n</script>\n`;
    expect(scanBoundaryImports(source, 'src/lib/components/Synthetic.svelte')).toEqual([]);
  });

  it('ignores an import written in a comment or in markup', () => {
    const source = [
      '<script lang="ts">',
      "  // import { saveMatch } from '../ipc/commands';",
      '</script>',
      "<p>import {'{'} saveMatch {'}'} from '../ipc/commands'</p>"
    ].join('\n');
    expect(scanBoundaryImports(source, 'src/lib/components/Synthetic.svelte')).toEqual([]);
  }); // End of the "comment or markup" case
}); // End of the "checker stays quiet" suite

describe('accepted blind spots, pinned so they are visible', () => {
  it('cannot see a command reached through a browser module (a transitive import)', () => {
    // `workspace.svelte.ts` imports the wrappers at value level; a component that
    // called one of its exports other than the three listed bindings would reach
    // `invoke` with no finding here. The invoke spies are what would notice.
    const source = "<script lang=\"ts\">\n  import { someWrapper } from '../browser/workspace.svelte';\n</script>\n";
    expect(scanBoundaryImports(source, 'src/lib/components/Synthetic.svelte')).toEqual([]);
  }); // End of the "transitive import" case

  it('cannot see a specifier computed at run time', () => {
    const source = "const name = '../ipc/' + 'commands';\nconst commands = await import(name);";
    expect(scanBoundaryImports(source, 'src/lib/components/synthetic.ts')).toEqual([]);
  });
}); // End of the "accepted blind spots" suite
