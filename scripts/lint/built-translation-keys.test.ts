/**
 * The built-key check, and the proof that it can disagree.
 *
 * Same shape as `hardcoded-strings.test.ts`, and for the same reason: a lint
 * that only ever passes proves nothing. So this file runs the scanner over
 * every real component and demands silence, and runs it over the exact line the
 * 1c-1 review found — `t(selectionNoticeKey(browser.notice))` — and demands
 * that it is caught.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findBuiltTranslationKeys, formatBuiltKeyFindings } from './built-translation-keys';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SOURCE_ROOT = join(REPO_ROOT, 'src');

/**
 * Lists every `.svelte` file under `src/`.
 *
 * @returns Absolute paths, sorted, so a failure names the same file every run.
 */
function svelteFiles(): string[] {
  return readdirSync(SOURCE_ROOT, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.svelte'))
    .map((entry) => join(SOURCE_ROOT, entry))
    .sort();
} // End of function svelteFiles()

describe('the components in src/', () => {
  it('are actually being scanned', () => {
    expect(svelteFiles().length).toBeGreaterThanOrEqual(3);
  });

  it.each(svelteFiles())('%s hands t() a written key, never a built one', (file) => {
    const findings = findBuiltTranslationKeys(readFileSync(file, 'utf8'), relative(REPO_ROOT, file));
    expect(formatBuiltKeyFindings(findings)).toBe('');
  });
}); // End of the "components in src/" suite

describe('the scanner disagrees when it should', () => {
  it('catches the code-to-key call the 1c-1 review found', () => {
    const source = '<p>{t(selectionNoticeKey(browser.notice))}</p>';
    const findings = findBuiltTranslationKeys(source, 'fixture.svelte');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(1);
  });

  it('catches a key held in a variable', () => {
    expect(findBuiltTranslationKeys('{t(key)}', 'fixture.svelte')).toHaveLength(1);
  });

  it('catches a key assembled in a template literal', () => {
    expect(findBuiltTranslationKeys('{t(`code.${name}`)}', 'fixture.svelte')).toHaveLength(1);
  });

  it('reports the line the call is on', () => {
    const source = "<p>{t('a.b')}</p>\n<p>{t(built)}</p>";
    expect(findBuiltTranslationKeys(source, 'fixture.svelte')[0]?.line).toBe(2);
  });
}); // End of the "scanner disagrees" suite

describe('the scanner stays quiet where it should', () => {
  it('accepts a written key, with or without parameters', () => {
    const source = "{t('app.name')}{t(\"browser.list.summary\", { shown: 1, total: 2 })}";
    expect(findBuiltTranslationKeys(source, 'fixture.svelte')).toEqual([]);
  });

  it('accepts a key written across several lines', () => {
    expect(findBuiltTranslationKeys("{t(\n  'app.name'\n)}", 'fixture.svelte')).toEqual([]);
  });

  it('accepts an accessor called with a code, which is the whole point', () => {
    const source = '{tSelectionNotice(browser.notice)}{tMatchBadge(badge)}{tSnippetCount(n)}';
    expect(findBuiltTranslationKeys(source, 'fixture.svelte')).toEqual([]);
  });

  it('is not confused by another call ending in the letter t', () => {
    expect(findBuiltTranslationKeys('{format(value)}{object.t(x)}', 'fixture.svelte')).toEqual([]);
  });
}); // End of the "scanner stays quiet" suite
