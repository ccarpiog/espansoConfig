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
  type DiagnosticCode
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
