/**
 * What the snippet list says about the file it is showing.
 *
 * Four claims, each of which a plausible implementation gets wrong:
 *
 * 1. **A file that does not parse still says why.** It arrives with `parsed:
 *    false`, no matches and a `ParseFailed` diagnostic; an implementation that
 *    only looked at `matches` would draw an empty pane for it.
 * 2. **A hazard is named once, not twice.** Every hazard arrives *both* in
 *    `DocumentView.hazards` and as its own `Hazard` diagnostic, so an
 *    implementation that renders both lists prints each hazard two ways.
 * 3. **A repetition is counted, never discarded.** Two diagnostics that differ
 *    only in their span render as the same sentence, and the span is not on
 *    screen — so they share one line and that line says "in 2 places". The
 *    first version of this module kept one and dropped the other, which turned
 *    twenty affected keys into a sentence about one; that is the 1c-2b-1
 *    review's Medium 1 and the suite below is written to be able to catch it.
 * 4. **Nothing the wire named is dropped.** A hazard the diagnostics name and
 *    the summary somehow does not is still shown.
 *
 * The expectation in `describe('what a document owes a line')` is derived from
 * the *input document* — a conservation count that no grouping policy can
 * satisfy while losing a finding — never read off what `describeFindings` chose
 * to emit. D2w, the vacuous-audit corollary: a check that walks the records the
 * code produced cannot see a record the code declined to produce.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  describeFindings,
  diagnosticIdentity,
  hasFindings,
  hazardOf,
  occurrenceIdentity
} from './findings';
import { diagnostic, makeDocument, makeMatch } from './fixtures';
import type { DiagnosticCode, HazardKind } from '../ipc/types';

/**
 * The document a file that does not parse crosses the boundary as.
 *
 * The shape of all four fixtures in
 * `crates/espansoconfig-core/tests/corpus/synthetic/invalid/`: a view, not a
 * refusal, with the diagnostic and nothing else.
 *
 * @returns A projection of an unparsable file.
 */
function unparsable() {
  return makeDocument({
    parsed: false,
    diagnostics: [diagnostic({ ParseFailed: { line: 6, column: 2, byte_index: 148 } })]
  });
} // End of function unparsable()

describe('a file that does not parse', () => {
  const findings = describeFindings(unparsable());

  it('has something to say even though it has no matches', () => {
    expect(hasFindings(findings)).toBe(true);
    expect(findings.diagnostics).toHaveLength(1);
  });

  it('carries the parse failure with its operands intact', () => {
    // The line and the column are what the sentence interpolates. A model that
    // kept only the variant name would render "line {line}" verbatim.
    expect(findings.diagnostics[0]?.code).toEqual({
      ParseFailed: { line: 6, column: 2, byte_index: 148 }
    });
  });

  it('reports that the substrate refused it, which no sentence of ours says', () => {
    expect(findings.parsed).toBe(false);
  });
}); // End of the "file that does not parse" suite

describe('a file with nothing to say', () => {
  it('says nothing, for a document with no diagnostics and no hazards', () => {
    const findings = describeFindings(makeDocument({ matches: [makeMatch()] }));
    expect(hasFindings(findings)).toBe(false);
    expect(findings.hazards).toEqual([]);
    expect(findings.diagnostics).toEqual([]);
  });

  it('says nothing when no single file is being shown', () => {
    // The "All" scope has no document, and a model that threw or invented an
    // empty document here would take the whole pane down.
    const findings = describeFindings(null);
    expect(hasFindings(findings)).toBe(false);
    expect(findings.parsed).toBe(true);
  });
}); // End of the "file with nothing to say" suite

describe('hazards', () => {
  const document = makeDocument({
    hazards: ['AliasReference', 'MergeKey'],
    diagnostics: [
      diagnostic({ Hazard: { kind: 'AliasReference' } }, 4, 10),
      diagnostic({ Hazard: { kind: 'MergeKey' } }, 5, 30),
      diagnostic({ Hazard: { kind: 'MergeKey' } }, 6, 60),
      diagnostic('VariableHasNoName', 7, 80)
    ]
  });
  const findings = describeFindings(document);

  it('names each distinct kind once, in the order the core sorted them', () => {
    expect(findings.hazards).toEqual<readonly HazardKind[]>(['AliasReference', 'MergeKey']);
  });

  it('does not also render them as diagnostics', () => {
    // The failure this prevents: three extra sentences saying "This file
    // contains a merge key, which the visual editor cannot change…" beside a
    // list that already says "a merge key".
    expect(findings.diagnostics.map((line) => line.code)).toEqual<readonly DiagnosticCode[]>([
      'VariableHasNoName'
    ]);
  });

  it('keeps a hazard the diagnostics name and the summary does not', () => {
    // A wire disagreement, impossible in today's Rust and therefore exactly the
    // case an implementation would silently swallow. Nothing named is dropped.
    const disagreeing = describeFindings(
      makeDocument({
        hazards: [],
        diagnostics: [diagnostic({ Hazard: { kind: 'ExplicitTag' } }, 3, 5)]
      })
    );
    expect(disagreeing.hazards).toEqual<readonly HazardKind[]>(['ExplicitTag']);
    expect(disagreeing.diagnostics).toEqual([]);
  });

  it('names a kind once even when the summary itself repeats it', () => {
    // Rust promises `DocumentView.hazards` is distinct — `distinct_hazards()`
    // sorts and dedups — so this is defensive. It is not idle: the list is
    // rendered with `(hazard)` as the `{#each}` key, and Svelte throws at run
    // time on a duplicate key, in a component no test in this repository
    // renders. The old implementation spread the summary straight through.
    const repeatedSummary = describeFindings(
      makeDocument({
        hazards: ['MergeKey', 'MergeKey', 'ExplicitTag'],
        diagnostics: [diagnostic({ Hazard: { kind: 'MergeKey' } }, 3, 5)]
      })
    );
    expect(repeatedSummary.hazards).toEqual<readonly HazardKind[]>(['MergeKey', 'ExplicitTag']);
  });

  it('reads a hazard out of a code and answers null for every other code', () => {
    expect(hazardOf({ Hazard: { kind: 'MergeKey' } })).toBe('MergeKey');
    expect(hazardOf('NoDocument')).toBeNull();
    expect(hazardOf({ RepeatedKey: { key: 'trigger' } })).toBeNull();
  });
}); // End of the "hazards" suite

describe('repetition', () => {
  it('gives two occurrences of one sentence one line and a count of two', () => {
    // Same code, same operands, different spans and different nodes. Neither
    // the span nor the node is on screen, so a second identical line would say
    // nothing — but a *count* is the finding, and dropping the second record is
    // what made twenty affected keys read as one.
    const findings = describeFindings(
      makeDocument({
        diagnostics: [
          diagnostic('KeyNotAccountedFor', 11, 100),
          diagnostic('KeyNotAccountedFor', 12, 200)
        ]
      })
    );
    expect(findings.diagnostics).toHaveLength(1);
    expect(findings.diagnostics[0]?.occurrences).toBe(2);
    expect(findings.diagnostics[0]?.repeated).toBe(true);
  });

  it('scales to the review’s own scenario without losing a key', () => {
    // Twenty keys that could not be accounted for. One sentence, and the
    // sentence has to carry the twenty; before the review's Medium 1 this
    // produced one line saying "one key of this file".
    const findings = describeFindings(
      makeDocument({
        diagnostics: Array.from({ length: 20 }, (_unused, index) =>
          diagnostic('KeyNotAccountedFor', index + 1, index * 10)
        )
      })
    );
    expect(findings.diagnostics).toHaveLength(1);
    expect(findings.diagnostics[0]?.occurrences).toBe(20);
  });

  it('says nothing about a count of one, and carries it anyway', () => {
    // The threshold is a decision, so it is here and not a `> 1` in markup.
    const findings = describeFindings(
      makeDocument({ diagnostics: [diagnostic('KeyNotAccountedFor', 11, 100)] })
    );
    expect(findings.diagnostics[0]?.occurrences).toBe(1);
    expect(findings.diagnostics[0]?.repeated).toBe(false);
  });

  it('counts one finding reported twice as one place', () => {
    // Equal in every field: code, span, node and path. The only case anything
    // is still collapsed, and one the wire is not supposed to produce.
    const findings = describeFindings(
      makeDocument({
        diagnostics: [diagnostic('NoDocument', 3, 7), diagnostic('NoDocument', 3, 7)]
      })
    );
    expect(findings.diagnostics[0]?.occurrences).toBe(1);
  });

  it('keeps two diagnostics whose operands differ', () => {
    // The other direction, and the one that matters more: an implementation
    // deduplicating on the *variant name* would show one of these two keys and
    // hide the other.
    const findings = describeFindings(
      makeDocument({
        diagnostics: [
          diagnostic({ RepeatedKey: { key: 'trigger' } }, 11, 100),
          diagnostic({ RepeatedKey: { key: 'replace' } }, 12, 200)
        ]
      })
    );
    expect(findings.diagnostics.map((line) => line.code)).toEqual<readonly DiagnosticCode[]>([
      { RepeatedKey: { key: 'trigger' } },
      { RepeatedKey: { key: 'replace' } }
    ]);
  });

  it('gives every line a distinct key for the list that renders it', () => {
    const findings = describeFindings(
      makeDocument({
        diagnostics: [
          diagnostic('NoDocument'),
          diagnostic({ RootIsNotAMapping: { found: 'Sequence' } })
        ]
      })
    );
    const ids = findings.diagnostics.map((line) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives two codes that read the same one identity, and two that do not, two', () => {
    expect(diagnosticIdentity('NoDocument')).toBe(diagnosticIdentity('NoDocument'));
    expect(diagnosticIdentity({ RepeatedKey: { key: 'a' } })).not.toBe(
      diagnosticIdentity({ RepeatedKey: { key: 'b' } })
    );
  });

  it('separates the sentence identity from the finding identity', () => {
    // The two must not be the same function. `diagnosticIdentity` groups lines;
    // `occurrenceIdentity` decides what is a distinct finding, and the review's
    // Medium 1 was the first one being used for both.
    const a = diagnostic('KeyNotAccountedFor', 11, 100);
    const b = diagnostic('KeyNotAccountedFor', 12, 200);
    expect(diagnosticIdentity(a.code)).toBe(diagnosticIdentity(b.code));
    expect(occurrenceIdentity(a)).not.toBe(occurrenceIdentity(b));
  });
}); // End of the "repetition" suite

describe('what a document owes a line', () => {
  /*
   * The expectations are derived from the **input**, and the first of them is a
   * *conservation* count rather than a list: no grouping policy can satisfy it
   * while losing a finding. That is the 1c-2b-1 review's second half of Medium
   * 1 — the earlier version of this suite compared against a hand-written list
   * of codes that deliberately omitted the second `MatchHasNoTrigger`, so it
   * agreed with a policy that dropped it and could never have disagreed.
   */
  const INPUT_DIAGNOSTICS = [
    diagnostic({ Hazard: { kind: 'AnchorDefinition' } }, 2, 4),
    diagnostic('MatchHasNoTrigger', 8, 40),
    diagnostic({ MatchHasSeveralContentForms: { count: 2 } }, 9, 60),
    diagnostic('MatchHasNoTrigger', 10, 80),
    diagnostic({ ValueTooDeep: { depth: 64 } }, 11, 100)
  ];
  const document = makeDocument({
    parsed: true,
    hazards: ['AnchorDefinition'],
    diagnostics: INPUT_DIAGNOSTICS
  });
  const findings = describeFindings(document);

  /**
   * How many distinct non-hazard findings the input holds, counted by hand.
   *
   * Read off `INPUT_DIAGNOSTICS` above: five records, one of them a `Hazard`,
   * leaving four — and no two of those four are equal in code, span and node
   * together, so all four are distinct findings. Deliberately **not** computed
   * with `occurrenceIdentity`, which is the code under test.
   */
  const DISTINCT_FINDINGS = 4;

  it('accounts for every distinct finding the document holds', () => {
    // The oracle that can disagree with the policy rather than merely with a
    // deviation from it: drop one occurrence anywhere and this sum falls short.
    const counted = findings.diagnostics.reduce((sum, line) => sum + line.occurrences, 0);
    expect(counted).toBe(DISTINCT_FINDINGS);
  });

  it('groups those findings into one line per sentence, in source order', () => {
    expect(findings.diagnostics.map((line) => line.code)).toEqual<readonly DiagnosticCode[]>([
      'MatchHasNoTrigger',
      { MatchHasSeveralContentForms: { count: 2 } },
      { ValueTooDeep: { depth: 64 } }
    ]);
  });

  it('says on the line that two of them were the same sentence', () => {
    const repeated = findings.diagnostics.filter((line) => line.repeated);
    expect(repeated.map((line) => line.code)).toEqual<readonly DiagnosticCode[]>([
      'MatchHasNoTrigger'
    ]);
    expect(repeated[0]?.occurrences).toBe(2);
  });

  it('renders the one hazard the document holds', () => {
    expect(findings.hazards).toEqual<readonly HazardKind[]>(['AnchorDefinition']);
  });
}); // End of the "what a document owes a line" suite

describe('the source of the pane that renders this model', () => {
  /*
   * A **text scan over source**, and the names below say only that. The 1c-2b-1
   * review was right that the earlier names — "so that code reaches the screen
   * as words" — claimed something no substring search can establish: an
   * accessor left in a comment or in dead script satisfies every assertion here
   * while the markup renders a raw Rust identifier. That is R24's corollary for
   * the sixth time in this project: read the test's name, then its body, and
   * ask whether the body could fail if the name's claim were false.
   *
   * Rendering a component in a test is the fix, and it is a deliberate decision
   * with its own costs that `PROGRESS.md` records as one — not something a
   * review fix round adopts as a side effect. Until it is taken, the evidence
   * that the pane renders is the window reading in
   * `docs/decisions/1c-2b-1-notes.md`, and these are a cheap tripwire for a
   * refactor that silently drops an accessor.
   */
  const source = readFileSync(
    fileURLToPath(new URL('../components/SnippetList.svelte', import.meta.url)),
    'utf8'
  );

  it.each(['tDiagnostic', 'tHazard', 'tOccurrenceCount'])(
    'contains a call to %s somewhere in its source',
    (accessor) => {
      expect(source).toContain(`${accessor}(`);
    }
  );

  it('contains no source reading the wire fields the model exists to fold', () => {
    // `describeFindings` is where the union and the deduplication live. A pane
    // that walked `browser.scopedDocument.diagnostics` directly would print
    // every hazard twice and every repeated diagnostic as many times as the
    // core recorded it, and no test here would see it.
    expect(source).toContain('describeFindings(browser.scopedDocument)');
    expect(source).not.toContain('scopedDocument.diagnostics');
    expect(source).not.toContain('scopedDocument.hazards');
  });
}); // End of the "source of the pane that renders this model" suite
