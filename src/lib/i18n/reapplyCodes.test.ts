/**
 * Runtime checks on the correspondence-evidence accessors — Phase 2c-4b-1.
 *
 * The compile-time half is in `codes.ts`: every key builder returns a
 * `TranslationKey` whose type is a template literal over the enum's own name
 * union, so a variant with no dictionary entry fails `svelte-check` there. The
 * Rust half is `src-tauri/src/dictionary_contract.rs`, which compares both
 * dictionaries against the `ReapplyResolution`, `ReapplyPlacement` and
 * `ReapplyRefusal` declarations, in both directions.
 *
 * What is left for this file is the one thing neither can see: that calling the
 * accessor actually produces a sentence. A describer that reached for the wrong
 * key, or that fed the wrong shape to `wireVariantName`, renders `undefined` and
 * every check above still passes.
 *
 * **Nothing renders these yet, and that is the point of writing them now.**
 * 2c-4b-1 adds evidence and no control; 2c-4b-3 is what draws it. A code with no
 * string is worse than a code with no caller, and a string nothing has ever
 * rendered is exactly the one that turns out to be `undefined`.
 *
 * It also asserts the register these sentences have to keep: every one of them
 * is a claim about **evidence**, and none may promise that a save would now
 * succeed, that a draft still applies, that the file cannot change again, or
 * that a snippet is gone.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { describe, expect, it } from 'vitest';
import {
  describeReapplyPlacement,
  describeReapplyRefusal,
  describeReapplyResolution,
  reapplyPlacementKey,
  reapplyRefusalKey,
  reapplyResolutionKey
} from './codes';
import { translate, type TranslationKey } from './dictionaries';
import type { ExpectNever, Missing } from './exhaustive';
import { LOCALES } from './locale';
import en from './en.json';
import { makeMatch } from '../browser/fixtures';
import type {
  ReapplyPlacement,
  ReapplyPlacementName,
  ReapplyRefusal,
  ReapplyResolution,
  ReapplyResolutionName
} from '../ipc/types';

/**
 * Every `ReapplyResolution` variant name, in declaration order.
 *
 * Written by hand — a list read out of `en.json` would agree with `en.json` by
 * construction — and pinned to the union below, so a variant added in Rust and
 * mirrored in `types.ts` is a compile error here rather than a silent gap.
 */
const RESOLUTION_NAMES = [
  'Unsupported',
  'Targetless',
  'Identified',
  'Refused'
] as const satisfies readonly ReapplyResolutionName[];

/**
 * Every `ReapplyPlacement` variant name, in declaration order.
 *
 * The second slot of one `ReapplyEvidence`, added at this step's review round
 * when a move's `after` anchor stopped being answered by the subject's enum.
 */
const PLACEMENT_NAMES = [
  'NotAnchored',
  'Identified',
  'Refused'
] as const satisfies readonly ReapplyPlacementName[];

/** Every `ReapplyRefusal` member, in declaration order. */
const REFUSALS = [
  'NoAnchorInBase',
  'WrongDocument',
  'DiskDoesNotParse',
  'SequenceMissing',
  'AmbiguousExact',
  'NoExactCorrespondence',
  'TargetMissingOrTriggerChanged',
  'AmbiguousTrigger',
  'NoTriggerToMatch'
] as const satisfies readonly ReapplyRefusal[];

// `never` exactly when the tables above name every member of their union, and
// the member's own name when they do not. See `./exhaustive`.
export type _ResolutionNamesAreComplete = ExpectNever<
  Missing<ReapplyResolutionName, typeof RESOLUTION_NAMES>
>;
export type _PlacementNamesAreComplete = ExpectNever<
  Missing<ReapplyPlacementName, typeof PLACEMENT_NAMES>
>;
export type _RefusalsAreComplete = ExpectNever<Missing<ReapplyRefusal, typeof REFUSALS>>;

/**
 * One resolution per declared name, in the same order.
 *
 * The `Identified` arm carries a whole projected snippet, which is the only
 * operand any of these four has and therefore the only shape a fixture can get
 * wrong.
 */
const RESOLUTIONS: readonly ReapplyResolution[] = [
  { Unsupported: {} },
  { Targetless: {} },
  { Identified: { target: makeMatch({ trigger: ':one' }) } },
  { Refused: { reason: 'AmbiguousExact' } }
];

/** One placement resolution per declared name, in the same order. */
const PLACEMENTS: readonly ReapplyPlacement[] = [
  { NotAnchored: {} },
  { Identified: { target: makeMatch({ trigger: ':two' }) } },
  { Refused: { reason: 'NoExactCorrespondence' } }
];

/**
 * The variant name of a resolution as it crosses the wire.
 *
 * Repeated here rather than imported so that the sample table is checked against
 * something other than the function it feeds. Every arm is a one-key object, so
 * the tag is that one key.
 *
 * @param resolution - A resolution.
 * @returns Its variant name.
 */
function nameOf(resolution: ReapplyResolution | ReapplyPlacement): string {
  return Object.keys(resolution)[0]!;
} // End of function nameOf()

describe('the correspondence-evidence samples', () => {
  it('hold one value per declared name, in the same order', () => {
    expect(RESOLUTIONS.map(nameOf)).toEqual([...RESOLUTION_NAMES]);
    expect(PLACEMENTS.map(nameOf)).toEqual([...PLACEMENT_NAMES]);
  });

  it('hold the four arms, the three placements and the nine refusals this phase measured', () => {
    expect(RESOLUTION_NAMES.length).toBe(4);
    expect(PLACEMENT_NAMES.length).toBe(3);
    expect(REFUSALS.length).toBe(9);
  });
}); // End of the "correspondence-evidence samples" suite

describe('the correspondence-evidence accessors', () => {
  it('name a real dictionary entry for every variant', () => {
    const keys: TranslationKey[] = [
      ...RESOLUTION_NAMES.map(reapplyResolutionKey),
      ...PLACEMENT_NAMES.map(reapplyPlacementKey),
      ...REFUSALS.map(reapplyRefusalKey)
    ];
    for (const key of keys) {
      expect(Object.prototype.hasOwnProperty.call(en, key), key).toBe(true);
      for (const locale of LOCALES) {
        expect(translate(locale, key).trim(), `${locale}:${key}`).not.toBe('');
      }
    } // End of the loop over every declared variant's key
  }); // End of the "real dictionary entry" case

  it.each(LOCALES)('render a sentence in %s, never a gap', (locale) => {
    for (const resolution of RESOLUTIONS) {
      const label = `${locale}:${nameOf(resolution)}`;
      const rendered = describeReapplyResolution(locale, resolution);
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toContain('undefined');
      // `translate` leaves an unsubstituted `{placeholder}` visible on purpose,
      // so its absence is what says every operand the message names was given.
      expect(rendered, label).not.toContain('{');
      // The `Identified` arm's operand is a whole projection, and no message
      // names it. This is what says so rather than assuming it.
      expect(rendered, label).not.toContain('[object Object]');
    } // End of the loop over every sampled resolution
    for (const placement of PLACEMENTS) {
      const label = `${locale}:placement:${nameOf(placement)}`;
      const rendered = describeReapplyPlacement(locale, placement);
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toContain('undefined');
      expect(rendered, label).not.toContain('{');
      expect(rendered, label).not.toContain('[object Object]');
    } // End of the loop over every sampled placement
    for (const reason of REFUSALS) {
      const label = `${locale}:${reason}`;
      const rendered = describeReapplyRefusal(locale, reason);
      expect(rendered.trim(), label).not.toBe('');
      expect(rendered, label).not.toContain('undefined');
      expect(rendered, label).not.toContain('{');
    } // End of the loop over every refusal
  }); // End of the "render a sentence" case

  it.each(LOCALES)('never render a Rust variant name where a sentence belongs in %s', (locale) => {
    for (const resolution of RESOLUTIONS) {
      expect(
        describeReapplyResolution(locale, resolution),
        `${locale}:${nameOf(resolution)}`
      ).not.toMatch(/\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/);
    }
    for (const placement of PLACEMENTS) {
      expect(
        describeReapplyPlacement(locale, placement),
        `${locale}:placement:${nameOf(placement)}`
      ).not.toMatch(/\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/);
    }
    for (const reason of REFUSALS) {
      expect(describeReapplyRefusal(locale, reason), `${locale}:${reason}`).not.toMatch(
        /\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/
      );
    }
  }); // End of the "never a variant name" case

  it.each(LOCALES)('tell the four arms apart in %s', (locale) => {
    // `Targetless` and `Unsupported` are two different facts — a creation that
    // brings its own snippet, and a whole-document write that can never have a
    // correspondence — and a screen that rendered one sentence for both would be
    // saying something untrue about one of them.
    const rendered = RESOLUTIONS.map((resolution) => describeReapplyResolution(locale, resolution));
    expect(new Set(rendered).size, locale).toBe(RESOLUTIONS.length);
  }); // End of the "tell the arms apart" case

  it.each(LOCALES)('tell the three placements apart in %s', (locale) => {
    const rendered = PLACEMENTS.map((placement) => describeReapplyPlacement(locale, placement));
    expect(new Set(rendered).size, locale).toBe(PLACEMENTS.length);
  }); // End of the "tell the placements apart" case

  it.each(LOCALES)('never answer a placement with a subject sentence in %s', (locale) => {
    // The two slots answer two questions, and the empty arms are the pair most
    // likely to be given one sentence: `Targetless` says *this change brings its
    // own snippet* and `NotAnchored` says *this change is not placed after a
    // named one*. Neither is the other.
    const subjects = new Set(
      RESOLUTIONS.map((resolution) => describeReapplyResolution(locale, resolution))
    );
    for (const placement of PLACEMENTS) {
      expect(
        subjects.has(describeReapplyPlacement(locale, placement)),
        `${locale}:placement:${nameOf(placement)}`
      ).toBe(false);
    } // End of the loop over every sampled placement
  }); // End of the "placement is not a subject" case

  it.each(LOCALES)('promise nothing about the next save in %s', (locale) => {
    // The register `docs/reviews/phase-2b-1-strings.md` set, applied to evidence.
    // An identification is not a guarantee: the save that follows it can still be
    // refused, can still conflict, and the file can change again in between.
    const everything = [
      ...RESOLUTIONS.map((resolution) => describeReapplyResolution(locale, resolution)),
      ...PLACEMENTS.map((placement) => describeReapplyPlacement(locale, placement)),
      ...REFUSALS.map((reason) => describeReapplyRefusal(locale, reason))
    ].join('\n');
    for (const claim of [
      'will be saved',
      'will succeed',
      'guarantee',
      'safe',
      'recover',
      'se guardará',
      'tendrá éxito',
      'garantiz',
      'seguro',
      'a salvo',
      'recuperab'
    ]) {
      expect(everything.toLowerCase(), `${locale}:${claim}`).not.toContain(claim.toLowerCase());
    } // End of the loop over the claims none of these sentences may make
  }); // End of the "promise nothing" case

  it('says in the identified sentence what identification cannot establish', () => {
    // Q9 item 1 of the design consult, as an assertion: the likeliest false
    // sentence in this whole phase is one that reads "the same snippet". The
    // English sentence must carry its own limit, because no other test in this
    // repository can check what a sentence claims.
    const english = describeReapplyResolution('en', { Unsupported: {} });
    const identified = describeReapplyResolution('en', RESOLUTIONS[2]!);
    expect(identified).not.toBe(english);
    expect(identified.toLowerCase()).toContain('not proof');
  }); // End of the "identification cannot establish" case
}); // End of the "correspondence-evidence accessors" suite
