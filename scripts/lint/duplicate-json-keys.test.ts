/**
 * The duplicate-key check, and the proof that it can disagree.
 *
 * The same shape as `hardcoded-strings.test.ts`: run the scanner over the real
 * dictionaries and demand silence, then run it over hand-written documents that
 * *do* contain duplicates and demand that each one is caught. Without the second
 * half the first half is a lint that cannot fail.
 *
 * The reason this scanner exists at all is that the defect it looks for is
 * invisible to a parsed value — `JSON.parse` keeps the last occurrence and
 * reports nothing — so these fixtures are strings, never imports.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findDuplicateJsonKeys, formatDuplicateKeys } from './duplicate-json-keys';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Every JSON file whose keys the compiler and the runtime checks depend on. */
const DICTIONARY_FILES: readonly string[] = [
  join(REPO_ROOT, 'src/lib/i18n/en.json'),
  join(REPO_ROOT, 'src/lib/i18n/es.json')
];

describe('the dictionaries', () => {
  it('are actually being scanned', () => {
    // The vacuity guard: a suite that scanned nothing would pass, and this
    // project has been caught by that before.
    expect(DICTIONARY_FILES.length).toBe(2);
    for (const file of DICTIONARY_FILES) {
      expect(readFileSync(file, 'utf8').length).toBeGreaterThan(0);
    }
  });

  it.each(DICTIONARY_FILES)('%s declares every key exactly once', (file) => {
    const duplicates = findDuplicateJsonKeys(readFileSync(file, 'utf8'), relative(REPO_ROOT, file));
    expect(formatDuplicateKeys(duplicates)).toBe('');
  });
}); // End of the "dictionaries" suite

describe('the scanner disagrees when it should', () => {
  it('catches a key repeated at the top level, which JSON.parse does not', () => {
    const source = '{\n  "app.name": "Nombre accidental",\n  "other": 1,\n  "app.name": "espansoConfig"\n}';

    // The premise, asserted rather than assumed: the parser is no help here.
    expect(JSON.parse(source)).toEqual({ 'app.name': 'espansoConfig', other: 1 });

    const duplicates = findDuplicateJsonKeys(source, 'fixture.json');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.key).toBe('app.name');
    expect(duplicates[0]?.firstLine).toBe(2);
    expect(duplicates[0]?.duplicateLine).toBe(4);
  });

  it('catches a key repeated inside a nested object', () => {
    const source = '{\n  "outer": {\n    "inner": 1,\n    "inner": 2\n  }\n}';
    const duplicates = findDuplicateJsonKeys(source, 'fixture.json');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.key).toBe('inner');
    expect(duplicates[0]?.duplicateLine).toBe(4);
  });

  it('catches every repeat, not just the first', () => {
    const source = '{"a": 1, "a": 2, "a": 3}';
    expect(findDuplicateJsonKeys(source, 'fixture.json')).toHaveLength(2);
  });

  it('names the file it was given, so a failure points somewhere', () => {
    const duplicates = findDuplicateJsonKeys('{"a": 1, "a": 2}', 'src/lib/i18n/es.json');
    expect(formatDuplicateKeys(duplicates)).toContain('src/lib/i18n/es.json');
  });
}); // End of the "scanner disagrees" suite

describe('the scanner stays quiet where it should', () => {
  it('accepts the same name used as a key in two different objects', () => {
    const source = '{"first": {"label": 1}, "second": {"label": 2}}';
    expect(findDuplicateJsonKeys(source, 'fixture.json')).toEqual([]);
  });

  it('does not mistake a value for a key', () => {
    const source = '{"a": "b", "c": "b"}';
    expect(findDuplicateJsonKeys(source, 'fixture.json')).toEqual([]);
  });

  it('does not mistake repeated array strings for keys', () => {
    const source = '{"tags": ["x", "x", "x"]}';
    expect(findDuplicateJsonKeys(source, 'fixture.json')).toEqual([]);
  });

  it('is not confused by braces, commas or colons inside a string', () => {
    const source = '{"a": "{\\"a\\": 1, \\"a\\": 2}", "b": 2}';
    expect(findDuplicateJsonKeys(source, 'fixture.json')).toEqual([]);
  });

  it('is not confused by an object inside an array', () => {
    const source = '{"items": [{"k": 1}, {"k": 2}], "k": 3}';
    expect(findDuplicateJsonKeys(source, 'fixture.json')).toEqual([]);
  });
}); // End of the "scanner stays quiet" suite
