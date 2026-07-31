/**
 * The snippet-list search predicate.
 *
 * Plan section 8.1: *search covers trigger, label, content, comment and
 * `search_terms`.* This module does **not** re-derive that list. The core
 * assembles it once, into `MatchView.search_text`, and says why in
 * `crates/espansoconfig-core/src/model/match_view.rs`:
 *
 * > Precomputed here rather than assembled per keystroke in the frontend, so
 * > that what the search covers is one fact stated once and testable.
 *
 * Re-deriving the haystack here would make that two facts, in two languages,
 * with nothing comparing them — so the predicate below reads `search_text` and
 * nothing else off the match. What the frontend owns is the *matching rule*:
 * case folding, whitespace handling, and the decision that several words all
 * have to appear.
 *
 * ## Why it is not `JSON.stringify(match).includes(query)`
 *
 * Because that would search fields the plan deliberately leaves out — the
 * word-boundary options, variable parameters, byte spans, node identifiers —
 * and it would do it invisibly, as a widening nobody chose. `search_text` is a
 * closed list; anything else on the view is not searchable, and
 * `search.test.ts` asserts the negative as well as the positive.
 *
 * ## D2u
 *
 * Everything compared here is source text. No value is resolved, no type is
 * inferred, and a match is never selected because of what a scalar would *mean*
 * under YAML 1.1.
 */

import type { MatchView } from '../ipc/types';

/**
 * Splits a query into the terms that must all be present.
 *
 * Case is folded with `toLocaleLowerCase`, not `toLowerCase`, because the
 * interface is bilingual and the two differ for real users: Turkish dotted and
 * dotless I are the standard example, and a Spanish user searching `NIÑO`
 * should find `niño` either way.
 *
 * @param query - Whatever the search box currently holds.
 * @returns The lowercased terms, with empty runs discarded.
 */
export function queryTerms(query: string): string[] {
  return query
    .toLocaleLowerCase()
    .split(/\s+/u)
    .filter((term) => term !== '');
} // End of function queryTerms()

/**
 * The text a search may look at, for one match.
 *
 * One line on purpose: it names the field rather than rebuilding it, so that
 * widening what search covers is a change in the core — where the plan's list
 * is pinned by `search_text_covers_the_five_fields_plan_section_eight_names` —
 * and never an accident here.
 *
 * @param match - A match as it crossed the boundary.
 * @returns The precomputed haystack, exactly as the core assembled it.
 */
export function searchHaystack(match: MatchView): string {
  return match.search_text;
} // End of function searchHaystack()

/**
 * Returns `true` when a match satisfies the query.
 *
 * An empty query matches everything, which is what makes the search box's
 * initial state show the whole list rather than none of it.
 *
 * @param match - A match as it crossed the boundary.
 * @param query - Whatever the search box currently holds.
 * @returns Whether every term of the query occurs in the match's search text.
 */
export function matchesQuery(match: MatchView, query: string): boolean {
  const terms = queryTerms(query);
  if (terms.length === 0) {
    return true;
  }
  const haystack = searchHaystack(match).toLocaleLowerCase();
  return terms.every((term) => haystack.includes(term));
} // End of function matchesQuery()

/**
 * Filters a list of matches by the query, preserving source order.
 *
 * Source order is the only order this phase shows: a match's position in its
 * file is information the user put there, and re-ranking by relevance would
 * quietly replace it with a number nobody can see.
 *
 * @param matches - The matches currently in scope, in source order.
 * @param query - Whatever the search box currently holds.
 * @returns Those that satisfy the query, in the same order.
 */
export function filterMatches(
  matches: readonly MatchView[],
  query: string
): readonly MatchView[] {
  const terms = queryTerms(query);
  if (terms.length === 0) {
    return matches;
  }
  return matches.filter((match) => matchesQuery(match, query));
} // End of function filterMatches()
