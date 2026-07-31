/**
 * What the snippet-list search covers, and — the assertion that can fail —
 * what it does not.
 *
 * Plan section 8.1 names five things a search looks at: trigger, label,
 * content, comment and `search_terms`. Five positive assertions would pass
 * against `JSON.stringify(match).includes(query)`, which searches the word
 * boundary options, every variable parameter and every byte offset as well. So
 * the load-bearing test here is the negative one: a field that is *not* on the
 * list must not match, and `word` is the field chosen for it because D2u makes
 * it the most tempting thing in the object to start interpreting.
 *
 * The haystack itself is the core's `search_text`. This file pins the
 * predicate; `search_text_covers_the_five_fields_plan_section_eight_names` in
 * `crates/espansoconfig-core/tests/model_projection.rs` pins the haystack. What
 * neither pins is the join between them — see `docs/decisions/1c-1-notes.md`.
 */

import { describe, expect, it } from 'vitest';
import { makeMatch } from './fixtures';
import { filterMatches, matchesQuery, queryTerms, searchHaystack } from './search';

/**
 * A match with one distinctive string in each of the five searchable fields,
 * and one in a field search must not reach.
 *
 * @returns The match.
 */
function fiveFieldMatch(): ReturnType<typeof makeMatch> {
  return makeMatch({
    trigger: ':alpha',
    label: 'bravo',
    replace: 'charlie',
    comment: 'delta',
    searchTerms: ['echo', 'foxtrot'],
    options: { word: 'zulu' }
  });
} // End of function fiveFieldMatch()

describe('the five fields plan section 8.1 names', () => {
  it.each([
    ['trigger', 'alpha'],
    ['label', 'bravo'],
    ['content', 'charlie'],
    ['comment', 'delta'],
    ['search_terms', 'echo']
  ])('%s is searched', (_field, needle) => {
    expect(matchesQuery(fiveFieldMatch(), needle)).toBe(true);
  });

  it('searches every entry of search_terms, not only the first', () => {
    expect(matchesQuery(fiveFieldMatch(), 'foxtrot')).toBe(true);
  });

  it('searches a `triggers` list as well as a single `trigger`', () => {
    const match = makeMatch({ trigger: null, triggers: [':one', ':two'], triggerKind: 'Multiple' });
    expect(matchesQuery(match, 'two')).toBe(true);
  });

  it('searches a `regex` trigger', () => {
    const match = makeMatch({ trigger: null, regex: ':gr[ae]y', triggerKind: 'Regex' });
    expect(matchesQuery(match, 'gr[ae]y')).toBe(true);
  });

  it('searches a secondary content form, not only the one shown first', () => {
    // A match espanso would reject — two content fields — is still a match the
    // browser lists, and `html` is content in the file. The core indexed only
    // `ContentSpec::primary()` until the 1c-1 review, which made `needle`
    // unfindable; `search_text_covers_every_content_form_and_not_only_the_
    // primary_one` in Rust is the other half of this pair.
    const match = makeMatch({ replace: 'alpha', html: 'needle', contentKind: 'Several' });
    expect(matchesQuery(match, 'alpha')).toBe(true);
    expect(matchesQuery(match, 'needle')).toBe(true);
  });
}); // End of the "five fields" suite

describe('what search deliberately does not cover', () => {
  it('does not match a word-boundary option, however tempting the value', () => {
    // The oracle. It fails the moment the haystack becomes the whole object,
    // which is the widening that happens by accident rather than by decision.
    expect(matchesQuery(fiveFieldMatch(), 'zulu')).toBe(false);
  });

  it('does not match a document path, a span or a node identifier', () => {
    const match = makeMatch({ node: 4242 });
    expect(matchesQuery(match, '4242')).toBe(false);
  });

  it('reads the core-computed haystack and nothing else', () => {
    const match = makeMatch({ trigger: ':x', searchText: 'only this' });
    expect(searchHaystack(match)).toBe('only this');
    expect(matchesQuery(match, 'x')).toBe(false);
    expect(matchesQuery(match, 'only')).toBe(true);
  });
}); // End of the "does not cover" suite

describe('the matching rule', () => {
  it('is case-insensitive in both directions', () => {
    const match = makeMatch({ label: 'Señor' });
    expect(matchesQuery(match, 'SEÑOR')).toBe(true);
    expect(matchesQuery(makeMatch({ label: 'SEÑOR' }), 'señor')).toBe(true);
  });

  it('requires every term, so two words narrow rather than widen', () => {
    const match = fiveFieldMatch();
    expect(matchesQuery(match, 'alpha bravo')).toBe(true);
    expect(matchesQuery(match, 'alpha nothing')).toBe(false);
  });

  it('treats an empty or blank query as no filter at all', () => {
    expect(queryTerms('   ')).toEqual([]);
    expect(matchesQuery(makeMatch({ trigger: ':x' }), '')).toBe(true);
    expect(matchesQuery(makeMatch({ trigger: ':x' }), '  ')).toBe(true);
  });
}); // End of the "matching rule" suite

describe('filterMatches', () => {
  const alpha = makeMatch({ node: 1, trigger: ':alpha' });
  const bravo = makeMatch({ node: 2, trigger: ':bravo' });
  const alphabet = makeMatch({ node: 3, trigger: ':alphabet' });

  it('keeps source order rather than ranking', () => {
    const filtered = filterMatches([alphabet, alpha, bravo], 'alpha');
    expect(filtered.map((match) => match.id.node)).toEqual([3, 1]);
  });

  it('returns the input untouched for an empty query', () => {
    const input = [alpha, bravo];
    expect(filterMatches(input, '')).toBe(input);
  });

  it('can return nothing', () => {
    expect(filterMatches([alpha, bravo], 'nothing at all')).toEqual([]);
  });
}); // End of the "filterMatches" suite
