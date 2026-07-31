/**
 * How a run of a file's own bytes becomes something a screen can show, decided
 * here rather than in markup or in a stylesheet.
 *
 * `SourceText.svelte` is the one component that renders the result, and both the
 * detail pane (Phase 1c-2b-2b-1) and the raw YAML viewer (1c-2b-2b-2) go through
 * it. The decisions live here because nothing in this repository renders a Svelte
 * component in an automated test (`docs/decisions/1c-1-notes.md` hole 1): a rule
 * written in markup is a rule no test can reach, and this module's whole subject
 * is bytes surviving a boundary.
 *
 * ## What "faithful" means here, precisely
 *
 * The Rust side of fidelity is settled and measured — `document_text` and
 * `UnknownEntry.value_text` preserve valid UTF-8 exactly, and
 * `docs/decisions/1c-2b-2a-notes.md` section 4 is the table. **How a byte
 * survives HTML rendering is a different question**, and these are the answers:
 *
 * 1. **Nothing is normalised, decoded or re-encoded.** A text segment's `text` is
 *    a substring of the input, handed to a text node. A decomposed `é`
 *    (U+0065 U+0301) stays two code points and an astral `😀` stays one; the
 *    scanner walks **code points**, so a surrogate pair is never split.
 * 2. **Line breaks are counted here, not by the layout engine.** A CRLF, an LF
 *    and nothing else become a {@link BreakSegment}, which the component draws as
 *    one `<br>`. So a CRLF file shows **one** break per line rather than one plus
 *    whatever WebKit does with a stray carriage return, and the count is a
 *    property `sourceText.test.ts` can assert.
 * 3. **An enumerated set of characters that draw nothing is named rather than
 *    drawn as nothing.** {@link invisibleName} is the enumeration and is the
 *    only authority on it: the C0 and C1 controls (tab excepted), U+2028 and
 *    U+2029, a lone carriage return, a byte order mark, the soft hyphen, the
 *    zero-width characters and the bidirectional controls. Each becomes an
 *    {@link InvisibleSegment} carrying a **code** the component renders through
 *    `tInvisible`, because rendering them into a text node would show the reader
 *    a file they do not have — a document with a NUL in it would look identical
 *    to one without.
 *
 *    **It is not "every character with no glyph", and that is deliberate.** A
 *    joiner (U+200C, U+200D), a variation selector (U+FE00–U+FE0F) and a
 *    combining mark all change how the character *beside* them draws, so naming
 *    one detaches it from what it modifies and breaks a glyph the file really
 *    does draw as one. They are left alone, and so is everything else outside
 *    the enumeration — a Hangul filler, a braille blank, the many widths of
 *    space. Those are holes, recorded in `docs/decisions/1c-2b-2b-1-notes.md`,
 *    not claims.
 * 4. **Nothing is lost by the decomposition.** {@link sourceCharacters} rebuilds
 *    the input from the segments, character for character, and that round trip is
 *    the oracle: a scanner that dropped or rewrote anything fails it.
 * 5. **No `{@html}`, ever.** File text reaches the DOM as text-node content, so
 *    a `<script>` in a snippet is five words, not a script.
 *
 * ## The one transformation this module *does* make, stated as one
 *
 * An invisible character is replaced on screen by its name. The bytes are
 * unchanged in the model — the segment carries the character — but what the
 * reader sees, and what they would copy, is prose. That is the deliberate cost of
 * rule 3, and it is why `browser.source.invisibleDetail` exists to say so on
 * screen. Phase 1 is read-only, so nothing is written back from what is copied.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { ExpectNever, Missing } from '../i18n/exhaustive';

/**
 * The name of every character this module refuses to draw as nothing.
 *
 * A **code**, exactly like `DetailFieldName` in `./detail.ts` is: the component
 * renders it by calling `tInvisible` in `../i18n`, never by building a key. The
 * union is the frontend's own — no Rust enum has this shape — so it lives here
 * rather than in `../i18n/codes.ts`, which exists to bridge *Rust* codes to
 * sentences.
 *
 * Three of the names stand for a **family** rather than for one character, which
 * is why every string carries the code point: `zeroWidth` (U+180E, U+200B,
 * U+2060–U+2064, and a U+FEFF that is not at the start of a document, where it
 * is a zero-width no-break space rather than a byte order mark), `bidi` (U+061C,
 * U+200E, U+200F, U+202A–U+202E, U+2066–U+2069) and `other`, the catch-all for
 * every C0 or C1 control except tab and the line breaks. A family name plus the
 * exact code point is a fact; inventing one name per character would not make
 * the marker more useful and would make the dictionary a list to keep in step.
 */
export type InvisibleName =
  | 'bom'
  | 'nul'
  | 'carriageReturn'
  | 'lineSeparator'
  | 'paragraphSeparator'
  | 'softHyphen'
  | 'zeroWidth'
  | 'bidi'
  | 'other';

/**
 * Every {@link InvisibleName}, written out by hand.
 *
 * Hand-written rather than derived, per `../i18n/exhaustive.ts`: a list built
 * from the thing it checks agrees with it by construction. The alias below makes
 * a name added to the union and forgotten here an `npm run check` failure that
 * names the member.
 */
export const EVERY_INVISIBLE_NAME = [
  'bom',
  'nul',
  'carriageReturn',
  'lineSeparator',
  'paragraphSeparator',
  'softHyphen',
  'zeroWidth',
  'bidi',
  'other'
] as const satisfies readonly InvisibleName[];

/** Compile-time assertion that {@link EVERY_INVISIBLE_NAME} names them all. */
export type _InvisibleNamesAreComplete = ExpectNever<
  Missing<InvisibleName, typeof EVERY_INVISIBLE_NAME>
>;

/**
 * The dictionary key holding one invisible character's name.
 *
 * The template literal is what makes a name with no dictionary entry a **compile
 * error in this file** rather than an `undefined` on a screen: the returned type
 * is `browser.source.invisible.${InvisibleName}` and `TranslationKey` is derived
 * from `en.json`. The same device as `detailFieldKey` in `./detail.ts`.
 *
 * @param name - Which character to name.
 * @returns The key holding that character's name.
 */
export function invisibleKey(name: InvisibleName): TranslationKey {
  return `browser.source.invisible.${name}`;
} // End of function invisibleKey()

/**
 * How a line of the file ended.
 *
 * Lower-case and local on purpose: the wire's `LineEnding` is `Lf | Crlf` and
 * describes a **document**, while this describes one break. Nothing renders it
 * today — it is carried so that the raw viewer can show a file's mixed endings
 * without this module changing shape.
 */
export type LineBreakKind = 'lf' | 'crlf';

/** A run of the file's text that is drawn as itself. */
export interface TextSegment {
  /** Discriminant. */
  readonly kind: 'text';
  /** A substring of the input, untouched. */
  readonly text: string;
}

/** A line break, drawn as exactly one break however the file spells it. */
export interface BreakSegment {
  /** Discriminant. */
  readonly kind: 'break';
  /** Which characters the file used. */
  readonly ending: LineBreakKind;
}

/** A character with no glyph, named rather than drawn. */
export interface InvisibleSegment {
  /** Discriminant. */
  readonly kind: 'invisible';
  /** Which character it is, as a code the component translates. */
  readonly name: InvisibleName;
  /**
   * The character itself, kept so that nothing is lost.
   *
   * {@link sourceCharacters} needs it to rebuild the input, and `tInvisible`
   * needs it for the `{code}` operand every one of the six strings carries.
   */
  readonly character: string;
}

/** One piece of a file's text, ready to render. */
export type SourceSegment = TextSegment | BreakSegment | InvisibleSegment;

/**
 * `U+` followed by a character's code point, in the usual four-digit form.
 *
 * @param character - One character, which may be an astral one.
 * @returns Its code point, e.g. `U+2028` or `U+1F600`.
 */
export function codePointLabel(character: string): string {
  const point = character.codePointAt(0) ?? 0;
  return `U+${point.toString(16).toUpperCase().padStart(4, '0')}`;
} // End of function codePointLabel()

/**
 * The code points named `zeroWidth`, as inclusive ranges.
 *
 * Characters that occupy no width and modify nothing beside them: the Mongolian
 * vowel separator, the zero-width space, the word joiner and the four invisible
 * mathematical operators. U+FEFF belongs here too and is handled in
 * {@link invisibleName}, because at the start of a document it is a byte order
 * mark instead.
 */
const ZERO_WIDTH_RANGES: readonly (readonly [number, number])[] = [
  [0x180e, 0x180e],
  [0x200b, 0x200b],
  [0x2060, 0x2064]
];

/**
 * The code points named `bidi`, as inclusive ranges.
 *
 * The bidirectional controls: the Arabic letter mark, the two directional
 * marks, the four embedding and override controls with their terminator, and
 * the four isolates. None of them draws anything, and all of them can reorder
 * what a whole line looks like — which is the strongest reason in this module to
 * name a character rather than let it work invisibly.
 */
const BIDI_RANGES: readonly (readonly [number, number])[] = [
  [0x061c, 0x061c],
  [0x200e, 0x200f],
  [0x202a, 0x202e],
  [0x2066, 0x2069]
];

/**
 * Whether a code point falls inside one of a list of inclusive ranges.
 *
 * @param point - The code point to place.
 * @param ranges - The ranges to look in.
 * @returns Whether any range contains it.
 */
function within(point: number, ranges: readonly (readonly [number, number])[]): boolean {
  return ranges.some(([first, last]) => point >= first && point <= last);
} // End of function within()

/**
 * Which name one character gets, or `null` when it is drawn as itself.
 *
 * **This function is the whole enumeration** the module header's rule 3 refers
 * to, and the header claims nothing wider than what is written here.
 *
 * A line feed never reaches here: {@link sourceSegments} takes the two line
 * breaks first, because a break is a shape rather than a missing glyph.
 *
 * Four kinds of character reach here and are deliberately **not** named:
 *
 * - **a tab**, which has a rendered width, so drawing it as itself shows
 *   something rather than nothing. That it is then indistinguishable from spaces
 *   is a hole, not a decision;
 * - **the two joiners**, U+200C and U+200D, which decide whether their
 *   neighbours join or stay apart. Naming a U+200D inside an emoji sequence
 *   would split one glyph the file really draws into three glyphs and two
 *   markers, which shows the reader a file they do not have just as surely as
 *   drawing nothing does;
 * - **the variation selectors**, U+FE00–U+FE0F and U+E0100–U+E01EF, and the tag
 *   characters U+E0000–U+E007F, for the same reason: each attaches to what
 *   precedes it and chooses how that character is drawn;
 * - **everything outside the ranges above** — a Hangul filler, a braille blank,
 *   the space characters of other widths. They are unnamed because nobody has
 *   decided about them, which is a hole rather than a claim.
 *
 * @param character - One character of the input.
 * @param atStart - Whether it is the first character of a whole document.
 * @returns The name to render, or `null` to keep the character.
 */
function invisibleName(character: string, atStart: boolean): InvisibleName | null {
  if (character === '\u{feff}') {
    return atStart ? 'bom' : 'zeroWidth';
  }
  if (character === '\u{0}') {
    return 'nul';
  }
  if (character === '\r') {
    return 'carriageReturn';
  }
  if (character === '\u{2028}') {
    return 'lineSeparator';
  }
  if (character === '\u{2029}') {
    return 'paragraphSeparator';
  }
  if (character === '\u{ad}') {
    return 'softHyphen';
  }
  const point = character.codePointAt(0) ?? 0;
  if (within(point, ZERO_WIDTH_RANGES)) {
    return 'zeroWidth';
  }
  if (within(point, BIDI_RANGES)) {
    return 'bidi';
  }
  const control = (point < 0x20 && character !== '\t') || (point >= 0x7f && point <= 0x9f);
  return control ? 'other' : null;
} // End of function invisibleName()

/**
 * Splits a run of a file's text into the pieces a screen can draw.
 *
 * The five rules in this module's header are all implemented here. Ordinary
 * characters accumulate into one {@link TextSegment} until something interrupts
 * them, so an ordinary document produces one segment per line and nothing else.
 *
 * @param text - The file's own text, exactly as it crossed the boundary.
 * @param atDocumentStart - `true` only when `text` starts at byte 0 of a whole
 *   document, which is the sole position where a U+FEFF is a byte order mark. A
 *   slice out of the middle of a file — a match's bytes, an unmodelled entry's
 *   value — must leave this `false` or the viewer claims something it cannot
 *   know.
 * @returns The segments, in order, covering every character of the input.
 */
export function sourceSegments(text: string, atDocumentStart = false): readonly SourceSegment[] {
  const segments: SourceSegment[] = [];
  let run = '';

  /**
   * Ends the run of ordinary text, if any, and appends one segment after it.
   *
   * @param segment - The segment that interrupted the run.
   */
  const push = (segment: SourceSegment): void => {
    if (run !== '') {
      segments.push({ kind: 'text', text: run });
      run = '';
    }
    segments.push(segment);
  }; // End of function push()

  let index = 0;
  while (index < text.length) {
    // Non-null: the loop condition is exactly the guarantee `codePointAt` needs.
    const character = String.fromCodePoint(text.codePointAt(index) as number);
    if (character === '\r' && text.charAt(index + 1) === '\n') {
      push({ kind: 'break', ending: 'crlf' });
      index += 2;
      continue;
    }
    if (character === '\n') {
      push({ kind: 'break', ending: 'lf' });
      index += 1;
      continue;
    }
    const name = invisibleName(character, index === 0 && atDocumentStart);
    if (name === null) {
      run += character;
    } else {
      push({ kind: 'invisible', name, character });
    }
    index += character.length;
  } // End of the loop over the input's code points

  if (run !== '') {
    segments.push({ kind: 'text', text: run });
  }
  return segments;
} // End of function sourceSegments()

/**
 * The characters one segment stands for.
 *
 * @param segment - A segment {@link sourceSegments} produced.
 * @returns Exactly the input characters it was built from.
 */
function segmentCharacters(segment: SourceSegment): string {
  if (segment.kind === 'text') {
    return segment.text;
  }
  if (segment.kind === 'break') {
    return segment.ending === 'crlf' ? '\r\n' : '\n';
  }
  return segment.character;
} // End of function segmentCharacters()

/**
 * Rebuilds the input from its segments, character for character.
 *
 * **The oracle of this module**, and the reason every segment carries the source
 * characters it stands for rather than only what is drawn. A scanner that
 * dropped a character, composed two into one or turned a CRLF into an LF passes
 * every other assertion in `sourceText.test.ts` and fails this one.
 *
 * @param segments - The segments to rebuild from.
 * @returns The text {@link sourceSegments} was given.
 */
export function sourceCharacters(segments: readonly SourceSegment[]): string {
  return segments.map(segmentCharacters).join('');
} // End of function sourceCharacters()
