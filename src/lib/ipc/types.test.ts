/**
 * The projections a code-to-string dictionary is built on.
 *
 * Phase 1b-2b looks a diagnostic up by *name* and fills its sentence from the
 * operands. These three functions are what turn an externally tagged enum into
 * that pair, so a mistake here is a message that never appears or a
 * `{placeholder}` that never fills.
 */

import { describe, expect, it } from 'vitest';
import {
  diagnosticCodeName,
  diagnosticCodeOperands,
  unknownReasonName,
  wireVariantName,
  wireVariantOperands,
  type CorrespondenceTable,
  type DiagnosticCode,
  type ExternalObservation,
  type ObservedDocument,
  type UnreadableReason
} from './types';

describe('diagnosticCodeName()', () => {
  it('reads a variant with no operands as its own name', () => {
    expect(diagnosticCodeName('MatchHasNoTrigger')).toBe('MatchHasNoTrigger');
    expect(diagnosticCodeName('KeyNotAccountedFor')).toBe('KeyNotAccountedFor');
  });

  it('reads a variant with operands as its single key', () => {
    const code: DiagnosticCode = { MatchHasSeveralTriggerForms: { count: 2 } };
    expect(diagnosticCodeName(code)).toBe('MatchHasSeveralTriggerForms');
  });

  it('reads a variant whose operand is itself a code', () => {
    const code: DiagnosticCode = { Hazard: { kind: 'MergeKey' } };
    expect(diagnosticCodeName(code)).toBe('Hazard');
    expect(diagnosticCodeOperands(code)).toEqual({ kind: 'MergeKey' });
  });
});

describe('diagnosticCodeOperands()', () => {
  it('answers null for a variant that carries none', () => {
    expect(diagnosticCodeOperands('NoDocument')).toBeNull();
  });

  it('hands back structured data rather than a rendered sentence', () => {
    // The operands are what the dictionary interpolates. If Rust ever sent a
    // sentence instead, this would be a string rather than an object, which is
    // the shape plan section 9 forbids.
    const code: DiagnosticCode = {
      ParseFailed: { line: 4, column: 12, byte_index: 87 }
    };
    expect(diagnosticCodeOperands(code)).toEqual({ line: 4, column: 12, byte_index: 87 });
  });

  it('keeps a null operand, because null is an answer', () => {
    const code: DiagnosticCode = {
      ParseFailed: { line: 4, column: 12, byte_index: null }
    };
    expect(diagnosticCodeOperands(code)).toEqual({ line: 4, column: 12, byte_index: null });
  });
});

describe('unknownReasonName()', () => {
  it('names the three reasons that carry nothing', () => {
    expect(unknownReasonName('NotModelled')).toBe('NotModelled');
    expect(unknownReasonName('RepeatedKey')).toBe('RepeatedKey');
    expect(unknownReasonName('NonScalarKey')).toBe('NonScalarKey');
  });

  it('names the one that carries a value kind', () => {
    expect(unknownReasonName({ UnexpectedShape: { found: 'Sequence' } })).toBe('UnexpectedShape');
  });
});

// ---------------------------------------------------------------------------
// The external-change reconciliation wire — Phase 2d-4b
// ---------------------------------------------------------------------------
//
// The shape checks against Rust are `src-tauri/src/wire_contract.rs`'s: it reads
// `types.ts` and compares every property name and every variant name against the
// JSON `serde` really writes, in both directions. What is left for this file is
// what that check cannot see — that the generic projections read these values
// correctly, and that the one place the design refuses an accessor still leaves
// a consumer able to write an exhaustive walk.

/** Every `ObservedDocument` arm, in declaration order. */
const OBSERVED_DOCUMENTS = [
  { Addressable: { document: 2, relative_path: 'match/base.yml' } },
  { Named: { document: 9, relative_path: 'match/new.yml' } },
  { Unnamed: { relative_path: 'match/stranger.yml' } }
] as const satisfies readonly ObservedDocument[];

/** Every `UnreadableReason` arm, in declaration order. */
const UNREADABLE_REASONS = [
  { NotUtf8: { offset: 12 } },
  { PermissionDenied: {} },
  { InvalidData: {} },
  { TimedOut: {} },
  { Interrupted: {} },
  { Other: {} }
] as const satisfies readonly UnreadableReason[];

/**
 * What a consumer that needs the identity has to write.
 *
 * **The Q5 ruling as executable code.** There is no accessor over the three
 * arms, so this switch is the only way to the number — and its `never` terminus
 * is what makes a fourth arm added in Rust a compile error here.
 *
 * What it does **not** establish, and what nothing in TypeScript could: that
 * `Addressable` and `Named` are treated *differently* after narrowing. This
 * function deliberately answers them apart, but a consumer that returned the
 * same thing for both would compile, and only Phase 2d-5's model logic and its
 * tests establish that just `Addressable`'s identity reaches an open-workspace
 * command.
 *
 * @param document - An observed document as it crossed the boundary.
 * @returns What this application may do with the identity, per arm.
 */
function addressability(document: ObservedDocument): 'open' | 'minted' | 'none' {
  if ('Addressable' in document) {
    return 'open';
  }
  if ('Named' in document) {
    return 'minted';
  }
  if ('Unnamed' in document) {
    return 'none';
  }
  const unreachable: never = document;
  return unreachable;
} // End of function addressability()

describe('the observed document', () => {
  it('names every arm through the generic projection', () => {
    expect(OBSERVED_DOCUMENTS.map((document) => wireVariantName(document))).toEqual([
      'Addressable',
      'Named',
      'Unnamed'
    ]);
  });

  it('separates the two arms that carry a number from the one that does not', () => {
    expect(OBSERVED_DOCUMENTS.map(addressability)).toEqual(['open', 'minted', 'none']);
  });

  it('carries a display path on every arm, so no consumer holds only a number', () => {
    for (const document of OBSERVED_DOCUMENTS) {
      const operands = wireVariantOperands(document);
      expect(operands).not.toBeNull();
      expect(typeof operands?.['relative_path']).toBe('string');
    }
  });

  it('does not give the unnamed arm an identity', () => {
    // The arm's whole content: nothing in this process has ever named the path,
    // so there is no number to carry and none is invented.
    expect(wireVariantOperands(OBSERVED_DOCUMENTS[2])).toEqual({
      relative_path: 'match/stranger.yml'
    });
  });
});

describe('the unreadable reason', () => {
  it('crosses every arm as a one-key object, empty payloads included', () => {
    for (const reason of UNREADABLE_REASONS) {
      expect(typeof reason).toBe('object');
      expect(Object.keys(reason)).toHaveLength(1);
      expect(wireVariantOperands(reason)).not.toBeNull();
    }
  }); // End of the "one-key object" case

  it('carries an offset on the arm where the bytes arrived, and no operand elsewhere', () => {
    expect(wireVariantOperands(UNREADABLE_REASONS[0])).toEqual({ offset: 12 });
    for (const reason of UNREADABLE_REASONS.slice(1)) {
      expect(wireVariantOperands(reason)).toEqual({});
    }
  }); // End of the "offset on one arm" case
});

describe('the observation and its content', () => {
  it('carries the sequence on every arm, because that is the arbitration rule', () => {
    const observations: readonly ExternalObservation[] = [
      {
        Changed: {
          sequence: 4,
          document: { Addressable: { document: 2, relative_path: 'match/base.yml' } },
          previous_revision: 'a'.repeat(64),
          disk_revision: 'b'.repeat(64),
          content: { Unreadable: { reason: { NotUtf8: { offset: 3 } } } }
        }
      },
      {
        Removed: {
          sequence: 5,
          document: { Named: { document: 9, relative_path: 'match/new.yml' } },
          previous_revision: null
        }
      },
      {
        Unreadable: {
          sequence: 6,
          document: { Unnamed: { relative_path: 'match/stranger.yml' } },
          reason: { PermissionDenied: {} }
        }
      }
    ];
    expect(
      observations.map((observation) => wireVariantOperands(observation)?.['sequence'])
    ).toEqual([4, 5, 6]);
  }); // End of the "sequence on every arm" case

  it('keeps both revisions of a change whose new bytes are not text', () => {
    // The routing decision the Rust side argues at length, seen from this side:
    // an unreadable *change* stays a `Changed`, so `previous_revision` and
    // `disk_revision` survive. Routing it to the observation's own `Unreadable`
    // arm — which carries neither — would destroy them.
    const changed = {
      Changed: {
        sequence: 4,
        document: { Addressable: { document: 2, relative_path: 'match/base.yml' } },
        previous_revision: 'a'.repeat(64),
        disk_revision: 'b'.repeat(64),
        content: { Unreadable: { reason: { NotUtf8: { offset: 3 } } } }
      }
    } as const satisfies ExternalObservation;
    const operands = wireVariantOperands(changed);
    expect(operands?.['previous_revision']).toBe('a'.repeat(64));
    expect(operands?.['disk_revision']).toBe('b'.repeat(64));
    expect(wireVariantName(changed.Changed.content)).toBe('Unreadable');
  }); // End of the "both revisions survive" case

  it('reads a previous revision the engine never had as null, never as absent', () => {
    // Nullable, never optional: `serde` writes the key for a `None`, so a
    // consumer reads `null` rather than having to tell an absent key from a
    // present one.
    const removed = {
      Removed: {
        sequence: 5,
        document: { Named: { document: 9, relative_path: 'match/new.yml' } },
        previous_revision: null
      }
    } as const satisfies ExternalObservation;
    expect('previous_revision' in removed.Removed).toBe(true);
    expect(removed.Removed.previous_revision).toBeNull();
  }); // End of the "null, never absent" case

  it('reads a change with no correspondence evidence as null beside its projection', () => {
    const table: CorrespondenceTable = {
      base_revision: 'a'.repeat(64),
      disk_revision: 'b'.repeat(64),
      entries: [
        {
          base: { document: 2, revision: 'a'.repeat(64), node: 11 },
          exact: { Refused: { reason: 'NoExactCorrespondence' } },
          editor: { Targetless: {} }
        }
      ]
    };
    expect(table.entries[0]?.exact).toEqual({ Refused: { reason: 'NoExactCorrespondence' } });
    // The table carries its own two revisions, so a consumer holding a different
    // base can refuse it. Nothing in TypeScript pairs a table with the
    // observation it was built for.
    expect(table.base_revision).not.toBe(table.disk_revision);
  }); // End of the "correspondence evidence" case
});
