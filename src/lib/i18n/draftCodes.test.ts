/**
 * Runtime checks on the draft surface's accessor — Phase 2b-2b-3.
 *
 * The compile-time half is in `codes.ts`: `draftErrorKey` returns a
 * `TranslationKey` whose type is a template literal over `DraftErrorName`, so a
 * variant with no dictionary entry fails `svelte-check` there. The Rust half is
 * `src-tauri/src/dictionary_contract.rs`, which compares both dictionaries
 * against the `DraftError` declaration in both directions.
 *
 * What is left for this file is the one thing neither can see: that calling
 * `describeDraftError` actually produces a sentence. A describer that reached
 * for the wrong key, or that fed the wrong shape to `wireVariantName`, renders
 * `undefined` and every check above still passes.
 *
 * It also asserts the rule the whole enum is shaped by: **a refusal carries
 * indices, never the owner's text** (CLAUDE.md section 1). Every sample below is
 * hand-authored and neutral, and the words a real configuration would put in
 * these operands are asserted absent from the output.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { describe, expect, it } from 'vitest';
import { describeDraftError, draftErrorKey } from './codes';
import { translate, type TranslationKey } from './dictionaries';
import type { ExpectNever, Missing } from './exhaustive';
import { LOCALES } from './locale';
import en from './en.json';
import type { DraftError, DraftErrorName, DraftTarget } from '../ipc/types';

/** A drafted address, for a sample whose refusal is about one. */
const TARGET: DraftTarget = { Param: { variable: 0, entry: 1 } };

/**
 * Every `DraftError` variant name, in declaration order.
 *
 * Written by hand — a list read out of `en.json` would agree with `en.json` by
 * construction — and pinned to the union below, so a variant added in Rust,
 * mirrored in `types.ts` and forgotten here fails `npm run check` in this file.
 */
const DRAFT_ERROR_NAMES = [
  'MatchHasNoPath',
  'MatchNotEditable',
  'AmbiguousKey',
  'NotDecodable',
  'NotAScalar',
  'FieldHasAnUnmodelledShape',
  'RemovalWouldDiscardUnshownStructure',
  'TargetOwnsNoBytes',
  'SequenceItemDoesNotExist',
  'SequenceItemRemoval',
  'SequenceItemDraftedTwice',
  'NoInsertionAnchor',
  'InsertionAnchorRemoved',
  'InsertionAnchorIsInserted',
  'InsertionAnchorNotInOriginal',
  'SharedInsertionAnchor',
  'RemovalContainsAnEdit',
  'ScalarEditedTwice',
  'OutsideTheClosedSurface',
  'MoveIsNotADraftEdit',
  'TargetDoesNotExist',
  'VariableHasNoPath',
  'AmbiguousVariableKey',
  'VariableFieldHasNoScalar',
  'EntryDraftsAScalarAndASequence',
  'TargetIsNotNameable',
  'TargetKeyIsAmbiguous',
  'NestedValueIsACollection',
  'NestedRemovalWouldDiscardUnshownStructure',
  'NestedItemRemoval',
  'TargetDraftedTwice',
  'AmbiguousNestedKey'
] as const satisfies readonly DraftErrorName[];

/**
 * One value of every `DraftError` variant, as it crosses the wire.
 *
 * Every one is a one-key object, including the refusal that carries no operands:
 * Rust declares it `MatchHasNoPath {}`, an empty struct variant, so `serde` never
 * writes a bare string for this enum. `every_draft_error_variant_crosses_as_an_object`
 * in `src-tauri/src/wire_contract.rs` is what keeps that true, and the empty
 * payload is spelled out below rather than elided so a describer that mishandled
 * it would be caught here.
 */
const DRAFT_ERRORS: readonly DraftError[] = [
  { MatchHasNoPath: {} },
  { MatchNotEditable: { hazard: 'MergeKey' } },
  { AmbiguousKey: { field: 'trigger' } },
  { NotDecodable: { target: TARGET } },
  { NotAScalar: { target: TARGET } },
  { FieldHasAnUnmodelledShape: { field: 'replace', found: 'Sequence' } },
  { RemovalWouldDiscardUnshownStructure: { field: 'replace', found: 'Mapping' } },
  { TargetOwnsNoBytes: { target: TARGET } },
  { SequenceItemDoesNotExist: { field: 'triggers', index: 3, length: 2 } },
  { SequenceItemRemoval: { field: 'search_terms', index: 0 } },
  { SequenceItemDraftedTwice: { field: 'triggers', index: 0, first: 0, second: 1 } },
  { NoInsertionAnchor: { field: 'label' } },
  { InsertionAnchorRemoved: { edit: 0 } },
  { InsertionAnchorIsInserted: { edit: 1 } },
  { InsertionAnchorNotInOriginal: { edit: 2 } },
  { SharedInsertionAnchor: { first: 0, second: 1 } },
  { RemovalContainsAnEdit: { removal: 0, edit: 1 } },
  { ScalarEditedTwice: { first: 0, second: 1 } },
  { OutsideTheClosedSurface: { edit: 0 } },
  { MoveIsNotADraftEdit: { edit: 0 } },
  { TargetDoesNotExist: { target: TARGET, length: 1 } },
  { VariableHasNoPath: { index: 0 } },
  { AmbiguousVariableKey: { variable: 0 } },
  { VariableFieldHasNoScalar: { variable: 0, field: 'inject_vars' } },
  { EntryDraftsAScalarAndASequence: { target: TARGET } },
  { TargetIsNotNameable: { target: TARGET } },
  { TargetKeyIsAmbiguous: { target: TARGET, other: 2 } },
  { NestedValueIsACollection: { target: TARGET, found: 'Mapping' } },
  { NestedRemovalWouldDiscardUnshownStructure: { target: TARGET, found: 'Sequence' } },
  { NestedItemRemoval: { target: TARGET } },
  { TargetDraftedTwice: { target: TARGET, first: 0, second: 1 } },
  { AmbiguousNestedKey: { edit: 0 } }
];

// `never` exactly when the table above names every member of the union, and the
// member's own name when it does not. See `./exhaustive`.
export type _DraftErrorsAreComplete = ExpectNever<
  Missing<DraftErrorName, typeof DRAFT_ERROR_NAMES>
>;

/**
 * The variant name of a draft error as it crosses the wire.
 *
 * Repeated here rather than imported so that the sample table is checked against
 * something other than the function it feeds. Every member of the union is a
 * one-key object, so the tag is that one key — there is no bare-string spelling
 * to handle.
 *
 * @param error - A draft error.
 * @returns Its variant name.
 */
function nameOf(error: DraftError): string {
  return Object.keys(error)[0]!;
} // End of function nameOf()

describe('the draft refusal samples', () => {
  it('hold one value per declared name, in the same order', () => {
    expect(DRAFT_ERRORS.map(nameOf)).toEqual([...DRAFT_ERROR_NAMES]);
  });

  it('hold the thirty-two variants this phase measured', () => {
    expect(DRAFT_ERROR_NAMES.length).toBe(32);
  });
}); // End of the "draft refusal samples" suite

describe('the draft refusal accessor', () => {
  it('names a real dictionary entry for every variant', () => {
    for (const name of DRAFT_ERROR_NAMES) {
      const key: TranslationKey = draftErrorKey(name);
      expect(Object.prototype.hasOwnProperty.call(en, key), key).toBe(true);
      for (const locale of LOCALES) {
        expect(translate(locale, key).trim(), `${locale}:${key}`).not.toBe('');
      }
    } // End of the loop over every declared variant name
  }); // End of the "real dictionary entry" case

  it.each(LOCALES)('renders a sentence in %s, never a gap', (locale) => {
    for (const error of DRAFT_ERRORS) {
      const label = `${locale}:${nameOf(error)}`;
      const rendered = describeDraftError(locale, error);
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toContain('undefined');
      // `translate` leaves an unsubstituted `{placeholder}` visible on purpose,
      // so its absence is what says every operand the message names was given.
      expect(rendered, label).not.toContain('{');
      // A `DraftTarget` is an object, and `scalarOperands` drops it. This is
      // what says so rather than assuming it.
      expect(rendered, label).not.toContain('[object Object]');
    } // End of the loop over every sampled refusal
  }); // End of the "renders a sentence" case

  it.each(LOCALES)('never renders a Rust variant name where a sentence belongs in %s', (
    locale
  ) => {
    for (const error of DRAFT_ERRORS) {
      expect(describeDraftError(locale, error), `${locale}:${nameOf(error)}`).not.toMatch(
        /\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/
      );
    }
  }); // End of the "never a variant name" case

  it.each(LOCALES)('says nothing a refusal has no business saying in %s', (locale) => {
    // A draft refusal is a planning-time answer: no batch was derived and no
    // transaction ran. No sentence may suggest that acknowledging or retrying
    // could change it, and none may claim anything about espanso's own reading
    // of the file — the register `docs/reviews/phase-2b-1-strings.md` set.
    for (const error of DRAFT_ERRORS) {
      const rendered = describeDraftError(locale, error).toLowerCase();
      for (const claim of ['espanso ', 'recuperab', 'recover', 'safe', 'seguro', 'a salvo']) {
        expect(rendered, `${locale}:${nameOf(error)}:${claim}`).not.toContain(claim);
      }
    } // End of the loop over every sampled refusal
  }); // End of the "register" case
}); // End of the "draft refusal accessor" suite
