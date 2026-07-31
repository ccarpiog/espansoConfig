/**
 * The hardcoded-string check, and the proof that it can disagree.
 *
 * A lint that only ever passes proves nothing (the project's standing rule: an
 * oracle must be able to disagree). So this file does two things: it runs the
 * scanner over every real component and demands silence, and it runs the same
 * scanner over hand-written components that *do* contain literals and demands
 * that each one is caught. The second half is what makes the first half mean
 * anything.
 *
 * The scanner's blind spots are enumerated in `hardcoded-strings.ts`, and three
 * of them are pinned below as explicitly-accepted misses rather than left
 * implicit.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatFindings, scanSvelteMarkup } from './hardcoded-strings';

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
    // Without this the suite below passes vacuously the day someone moves the
    // components, which is exactly the failure mode this project keeps hitting.
    expect(svelteFiles().length).toBeGreaterThanOrEqual(3);
  });

  it.each(svelteFiles())('%s has no literal user-facing text in its markup', (file) => {
    const findings = scanSvelteMarkup(readFileSync(file, 'utf8'), relative(REPO_ROOT, file));
    expect(formatFindings(findings)).toBe('');
  });
}); // End of the "components in src/" suite

describe('the scanner disagrees when it should', () => {
  it('catches a literal in a text node', () => {
    const findings = scanSvelteMarkup('<h1>Nothing is open yet</h1>', 'fixture.svelte');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('text');
    expect(findings[0]?.snippet).toBe('Nothing is open yet');
  });

  it('catches a literal inside an {#if} body', () => {
    const source = '{#if open}\n  <p>Saved</p>\n{/if}';
    const findings = scanSvelteMarkup(source, 'fixture.svelte');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(2);
  });

  it('catches a literal in a user-visible attribute', () => {
    const findings = scanSvelteMarkup('<input placeholder="Search matches" />', 'fixture.svelte');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('attribute');
  });

  it('reports the line the literal is on', () => {
    const source = '<div>\n  <span>Hola</span>\n</div>';
    expect(scanSvelteMarkup(source, 'fixture.svelte')[0]?.line).toBe(2);
  });
}); // End of the "scanner disagrees" suite

describe('the scanner stays quiet where it should', () => {
  it('accepts text that came from an expression', () => {
    expect(scanSvelteMarkup("<h1>{t('app.name')}</h1>", 'fixture.svelte')).toEqual([]);
  });

  it('accepts an attribute bound to an expression', () => {
    const source = '<input placeholder={t(\'search.placeholder\')} />';
    expect(scanSvelteMarkup(source, 'fixture.svelte')).toEqual([]);
  });

  it('ignores identifier-shaped attributes such as value and class', () => {
    const source = '<option value="system" class="picker-option">{t(\'language.label\')}</option>';
    expect(scanSvelteMarkup(source, 'fixture.svelte')).toEqual([]);
  });

  it('ignores everything inside <script> and <style>', () => {
    const source =
      '<script lang="ts">\n  const label = "Save";\n</script>\n' +
      '<style>\n  .x::after { content: "Save"; }\n</style>';
    expect(scanSvelteMarkup(source, 'fixture.svelte')).toEqual([]);
  });

  it('ignores markup comments and bare punctuation', () => {
    expect(scanSvelteMarkup('<!-- a note for developers -->', 'fixture.svelte')).toEqual([]);
    expect(scanSvelteMarkup('<span>&mdash; &#8212; 42 / 7</span>', 'fixture.svelte')).toEqual([]);
  });
}); // End of the "scanner stays quiet" suite

describe('accepted blind spots, pinned so they are visible', () => {
  it('cannot see a literal declared in <script> and rendered as a variable', () => {
    const source = '<script lang="ts">\n  const label = "Save";\n</script>\n<button>{label}</button>';
    expect(scanSvelteMarkup(source, 'fixture.svelte')).toEqual([]);
  });

  it('cannot see a literal written directly as an expression', () => {
    expect(scanSvelteMarkup("<button>{'Save'}</button>", 'fixture.svelte')).toEqual([]);
  });

  it('cannot see a literal passed to a child component as a prop', () => {
    expect(scanSvelteMarkup('<Toolbar heading="Matches" />', 'fixture.svelte')).toEqual([]);
  });
}); // End of the "accepted blind spots" suite
