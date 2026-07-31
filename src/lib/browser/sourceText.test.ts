/**
 * What survives the browser half of byte fidelity, asserted rather than argued.
 *
 * The Rust half is measured in `crates/espansoconfig-core` and in
 * `src-tauri/src/dispatch_check.rs`, and its table is
 * `docs/decisions/1c-2b-2a-notes.md` section 4. **This file is the rendering
 * column of that table**, up to the one boundary it cannot cross: it establishes
 * what the *model* a component walks contains, and says nothing about what
 * WebKit paints. Nothing in this repository renders a Svelte component in an
 * automated test (`docs/decisions/1c-1-notes.md` hole 1), so the last hop is a
 * window reading and is recorded in `docs/decisions/1c-2b-2b-1-notes.md`.
 *
 * Every Unicode assertion is written with `\u{…}` escapes, for the reason
 * section 4 gives: a literal `é` in this file could be normalised by an editor,
 * and the test would then agree with a normalising boundary instead of catching
 * one.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tInvisible } from '../i18n';
import { DICTIONARIES } from '../i18n/dictionaries';
import { EVERY_TEXT_HAZARD } from './fixtures';
import {
  codePointLabel,
  EVERY_INVISIBLE_NAME,
  invisibleKey,
  sourceCharacters,
  sourceSegments,
  type InvisibleName,
  type SourceSegment
} from './sourceText';

/**
 * The text of every segment that draws itself, joined.
 *
 * @param segments - The segments to read.
 * @returns Only what reaches the screen as the document's own characters.
 */
function drawnText(segments: readonly SourceSegment[]): string {
  return segments
    .filter((segment) => segment.kind === 'text')
    .map((segment) => segment.text)
    .join('');
} // End of function drawnText()

/**
 * The names of every invisible segment, in order.
 *
 * @param segments - The segments to read.
 * @returns One name per named character.
 */
function invisibleNames(segments: readonly SourceSegment[]): readonly InvisibleName[] {
  return segments.filter((segment) => segment.kind === 'invisible').map((segment) => segment.name);
} // End of function invisibleNames()

/**
 * How many line breaks the segments would draw.
 *
 * @param segments - The segments to read.
 * @returns The number of break segments.
 */
function breakCount(segments: readonly SourceSegment[]): number {
  return segments.filter((segment) => segment.kind === 'break').length;
} // End of function breakCount()

/**
 * One representative of every character the classifier names, with its name.
 *
 * **The table the module's rule 3 is checked against**, widened at the
 * 1c-2b-2b-1 review: the headline claim was "every character with no glyph is
 * named" while `a\u{200b}b` rendered exactly like `ab`. The classifier now
 * enumerates, this table is the enumeration seen from outside, and
 * `covers every name the union has` below stops it going stale.
 *
 * `bom` is deliberately absent: it is the one name that needs
 * `atDocumentStart`, and *the byte order mark, which only a whole document can
 * have* is its suite.
 */
const NAMED_CHARACTERS: readonly (readonly [string, InvisibleName])[] = [
  ['\u{0}', 'nul'],
  ['\r', 'carriageReturn'],
  ['\u{2028}', 'lineSeparator'],
  ['\u{2029}', 'paragraphSeparator'],
  ['\u{ad}', 'softHyphen'],
  ['\u{180e}', 'zeroWidth'],
  ['\u{200b}', 'zeroWidth'],
  ['\u{2060}', 'zeroWidth'],
  ['\u{2061}', 'zeroWidth'],
  ['\u{2064}', 'zeroWidth'],
  ['\u{feff}', 'zeroWidth'],
  ['\u{61c}', 'bidi'],
  ['\u{200e}', 'bidi'],
  ['\u{200f}', 'bidi'],
  ['\u{202a}', 'bidi'],
  ['\u{202c}', 'bidi'],
  ['\u{202e}', 'bidi'],
  ['\u{2066}', 'bidi'],
  ['\u{2069}', 'bidi'],
  ['\u{7}', 'other'],
  ['\u{1b}', 'other'],
  ['\u{7f}', 'other'],
  ['\u{9f}', 'other']
];

describe('the round trip, which is this module’s oracle', () => {
  it.each([
    ['every hazard at once', EVERY_TEXT_HAZARD],
    ['nothing at all', ''],
    ['one ordinary line', 'trigger: :hello'],
    ['CRLF only', 'a\r\nb\r\n'],
    ['a lone carriage return', 'a\rb'],
    ['a trailing break', 'a\n'],
    ['leading and trailing spaces', '   a   '],
    ['an astral pair', '\u{1f600}\u{1f600}'],
    ['a BOM', '\u{feff}matches:\n']
  ])('rebuilds %s character for character', (_name, text) => {
    expect(sourceCharacters(sourceSegments(text))).toBe(text);
    expect(sourceCharacters(sourceSegments(text, true))).toBe(text);
  });

  it('rebuilds a document that is only invisible characters', () => {
    const text = '\u{0}\u{2028}\u{2029}\u{7}\u{feff}';
    expect(sourceCharacters(sourceSegments(text, true))).toBe(text);
  });

  it('rebuilds every character the classifier names, one run at a time', () => {
    // The oracle over the set the 1c-2b-2b-1 review made this module claim. A
    // classifier that gained a branch and lost the character on it passes every
    // naming assertion below and fails here.
    for (const [character] of NAMED_CHARACTERS) {
      const text = `a${character}b`;
      expect(sourceCharacters(sourceSegments(text)), character).toBe(text);
    } // End of the loop over the named characters
  });

  it('rebuilds them all in one run, in one order', () => {
    const text = NAMED_CHARACTERS.map(([character]) => character).join('x');
    expect(sourceCharacters(sourceSegments(text, true))).toBe(text);
  });
}); // End of the round-trip suite

describe('line breaks are counted here, not by the layout engine', () => {
  it('draws one break for a CRLF, not two', () => {
    const segments = sourceSegments('a\r\nb\r\nc');
    expect(breakCount(segments)).toBe(2);
    expect(invisibleNames(segments)).toEqual([]);
    expect(drawnText(segments)).toBe('abc');
  });

  it('records which characters the file used, so a viewer can say so later', () => {
    const segments = sourceSegments('a\r\nb\nc');
    const endings = segments.filter((segment) => segment.kind === 'break').map((s) => s.ending);
    expect(endings).toEqual(['crlf', 'lf']);
  });

  it('keeps an empty line as one break on each side of it', () => {
    // Two breaks with nothing between them is what an empty line *is*. A
    // scanner that swallowed the empty run would draw one line where the file
    // has two.
    const segments = sourceSegments('a\n\nb');
    expect(breakCount(segments)).toBe(2);
    expect(drawnText(segments)).toBe('ab');
  });

  it('does not call a lone carriage return a line break', () => {
    // A break is a claim about the document's shape; naming the character is a
    // claim about one byte. The substrate's own answer was measured at the
    // 1c-2b-2b-1 review and is now known: `SyntaxIndex::parse` treats a lone CR
    // as a line break, and a document holding one can parse and reach this pane
    // (`docs/decisions/1c-2b-2b-1-notes.md` section 5.2). The viewer still names
    // it and draws no break, deliberately: a marker shows the reader the exact
    // byte the file holds, while a `<br>` would hide the one character that
    // makes the line unusual.
    const segments = sourceSegments('a\rb');
    expect(breakCount(segments)).toBe(0);
    expect(invisibleNames(segments)).toEqual(['carriageReturn']);
  });
}); // End of the line-break suite

describe('a character with no glyph is named rather than drawn as nothing', () => {
  it.each([
    ['\u{0}', 'nul'],
    ['\u{2028}', 'lineSeparator'],
    ['\u{2029}', 'paragraphSeparator'],
    ['\u{7}', 'other'],
    ['\u{1b}', 'other'],
    ['\u{7f}', 'other'],
    ['\u{9f}', 'other'],
    ['\u{feff}', 'zeroWidth']
  ])('names %j', (character, name) => {
    const segments = sourceSegments(`a${character}b`);
    expect(invisibleNames(segments)).toEqual([name]);
    expect(drawnText(segments)).toBe('ab');
  });

  it('carries the character itself, so nothing is lost by naming it', () => {
    const segments = sourceSegments('a\u{2028}b');
    const invisible = segments.find((segment) => segment.kind === 'invisible');
    expect(invisible?.character).toBe('\u{2028}');
  });

  it('leaves a tab alone, because a tab has a width', () => {
    const segments = sourceSegments('a\tb');
    expect(invisibleNames(segments)).toEqual([]);
    expect(drawnText(segments)).toBe('a\tb');
  });
}); // End of the invisible-character suite

describe('the enumerated set, which is exactly what rule 3 claims', () => {
  /*
   * The 1c-2b-2b-1 review's third finding: the module said "a character with no
   * glyph is named" and the classifier covered the controls, the two Unicode
   * separators and U+FEFF, so a zero-width space drew as nothing — the very
   * thing the claim denied. The classifier was widened and the claim narrowed to
   * what it now covers, and these are the assertions on the widening.
   */

  it.each(NAMED_CHARACTERS)('names %j as its family', (character, name) => {
    const segments = sourceSegments(`a${character}b`);
    expect(invisibleNames(segments)).toEqual([name]);
    expect(drawnText(segments)).toBe('ab');
  });

  it('covers every name the union has, so the table cannot go stale', () => {
    // `EVERY_INVISIBLE_NAME` is checked against the union at compile time, so a
    // name added to the classifier and forgotten here fails this (D2w).
    const covered = new Set<InvisibleName>(NAMED_CHARACTERS.map(([, name]) => name));
    covered.add('bom');
    for (const name of EVERY_INVISIBLE_NAME) {
      expect(covered.has(name), name).toBe(true);
    } // End of the loop over the invisible names
  });

  it.each([
    ['\u{200c}', 'a zero-width non-joiner, which decides whether neighbours join'],
    ['\u{200d}', 'a zero-width joiner, which holds an emoji sequence together'],
    ['\u{fe0f}', 'a variation selector, which chooses how the character before it draws'],
    ['\u{e0100}', 'a supplementary variation selector, same case'],
    ['\u{301}', 'a combining acute, which is drawn on the character before it'],
    ['\u{a0}', 'a no-break space, which has a width'],
    ['\u{2800}', 'a braille blank, which is a glyph with no dots']
  ])('leaves %j alone: %s', (character) => {
    // Named characters are replaced on screen by prose, so naming one that
    // *modifies its neighbour* splits a glyph the file really draws — which
    // shows the reader a file they do not have exactly as drawing nothing does.
    // The last two are not that case: they are simply outside the enumeration,
    // and are hole 7 rather than a decision.
    const segments = sourceSegments(`a${character}b`);
    expect(invisibleNames(segments)).toEqual([]);
    expect(drawnText(segments)).toBe(`a${character}b`);
  });

  it('starts a fresh text run after a named character, combining mark and all', () => {
    // The consequence worth writing down: a combining mark immediately after a
    // named character lands at the head of a new text node, so it is drawn
    // without the character it belongs to — and, in the DOM, next to a marker.
    // Nothing is lost (the round trip holds) and the order is source order; what
    // it costs is recorded as a hole in `docs/decisions/1c-2b-2b-1-notes.md`.
    const text = 'a\u{200b}\u{301}b';
    const segments = sourceSegments(text);
    expect(segments).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'invisible', name: 'zeroWidth', character: '\u{200b}' },
      { kind: 'text', text: '\u{301}b' }
    ]);
    expect(sourceCharacters(segments)).toBe(text);
  });

  it('keeps every named character in source order when they run together', () => {
    const segments = sourceSegments('\u{200b}\u{202e}\u{ad}\u{2069}');
    expect(invisibleNames(segments)).toEqual(['zeroWidth', 'bidi', 'softHyphen', 'bidi']);
    expect(drawnText(segments)).toBe('');
  });
}); // End of the enumerated-set suite

describe('the byte order mark, which only a whole document can have', () => {
  it('is named as one when the text starts a document', () => {
    expect(invisibleNames(sourceSegments('\u{feff}matches:\n', true))).toEqual(['bom']);
  });

  it('is not named as one in a slice out of the middle of a file', () => {
    // The detail pane hands this function a match's bytes and an unmodelled
    // entry's value, neither of which can know where byte 0 of the file is. A
    // U+FEFF there is a zero-width no-break space, and calling it a byte order
    // mark would be a claim the caller cannot support.
    expect(invisibleNames(sourceSegments('\u{feff}matches:\n'))).toEqual(['zeroWidth']);
  });

  it('is not named as one away from the first character even in a document', () => {
    expect(invisibleNames(sourceSegments('a\u{feff}b', true))).toEqual(['zeroWidth']);
  });
}); // End of the byte-order-mark suite

describe('nothing is normalised', () => {
  it('keeps a decomposed é decomposed and a precomposed é precomposed', () => {
    const text = 'caf\u{65}\u{301} caf\u{e9}';
    const drawn = drawnText(sourceSegments(text));
    expect([...drawn].map((character) => character.codePointAt(0))).toEqual([
      0x63, 0x61, 0x66, 0x65, 0x301, 0x20, 0x63, 0x61, 0x66, 0xe9
    ]);
  });

  it('keeps an astral character whole', () => {
    const segments = sourceSegments('a\u{1f600}b');
    expect(segments).toEqual([{ kind: 'text', text: 'a\u{1f600}b' }]);
  });

  it('splits nothing through the middle of a surrogate pair', () => {
    // The scanner walks code points. Were it walking UTF-16 units, the NUL
    // below would be reached with `index` pointing inside the pair and the two
    // halves would land in different segments — which the round trip would
    // survive and this assertion would not.
    const segments = sourceSegments('\u{1f600}\u{0}\u{1f600}');
    expect(drawnText(segments)).toBe('\u{1f600}\u{1f600}');
    expect(segments.filter((segment) => segment.kind === 'text').map((s) => s.text)).toEqual([
      '\u{1f600}',
      '\u{1f600}'
    ]);
  });

  it('keeps interior indentation and real trailing spaces', () => {
    const segments = sourceSegments('replace: |\n  line one  \n  line two');
    expect(drawnText(segments)).toBe('replace: |  line one    line two');
    const runs = segments.filter((segment) => segment.kind === 'text').map((s) => s.text);
    expect(runs).toEqual(['replace: |', '  line one  ', '  line two']);
  });
}); // End of the "nothing is normalised" suite

describe('every hazard at once', () => {
  const segments = sourceSegments(EVERY_TEXT_HAZARD);

  it('names each invisible character exactly once, in source order', () => {
    expect(invisibleNames(segments)).toEqual([
      'lineSeparator',
      'paragraphSeparator',
      'nul',
      'other',
      'carriageReturn',
      'zeroWidth'
    ]);
  });

  it('draws one break per line ending, whichever ending the line used', () => {
    // Nine endings in the fixture: one CRLF and eight LF. The CR that is not
    // part of one is a named character above and not a break here.
    expect(breakCount(segments)).toBe(9);
  });

  it('keeps the two trailing spaces of the first line', () => {
    const runs = segments.filter((segment) => segment.kind === 'text').map((s) => s.text);
    expect(runs[0]).toBe('  line one  ');
  });

  it('ends without a break, because the fixture ends without a newline', () => {
    expect(segments[segments.length - 1]).toEqual({ kind: 'text', text: '  tab\there' });
  });
}); // End of the "every hazard at once" suite

describe('the code point label', () => {
  it.each([
    ['\u{0}', 'U+0000'],
    ['\u{7}', 'U+0007'],
    ['\u{2028}', 'U+2028'],
    ['\u{feff}', 'U+FEFF'],
    ['\u{1f600}', 'U+1F600']
  ])('renders %j as %s', (character, label) => {
    expect(codePointLabel(character)).toBe(label);
  });
}); // End of the code-point-label suite

describe('the dictionary behind the names', () => {
  it('has a string for every name, in both languages, carrying the code point', () => {
    // `EVERY_INVISIBLE_NAME` is hand-written and checked against the union at
    // compile time, so this sweep cannot go vacuous by iterating whatever the
    // implementation happened to produce (D2w).
    for (const name of EVERY_INVISIBLE_NAME) {
      for (const locale of ['en', 'es'] as const) {
        const value = DICTIONARIES[locale][invisibleKey(name)];
        expect(value, `${locale}:${name}`).toContain('{code}');
      }
    } // End of the loop over the invisible names and the two locales
  });

  it('names each one differently, so two hazards do not read alike', () => {
    const english = EVERY_INVISIBLE_NAME.map((name) => DICTIONARIES.en[invisibleKey(name)]);
    expect(new Set(english).size).toBe(EVERY_INVISIBLE_NAME.length);
  });

  it('leaves no placeholder unsubstituted when the accessor renders one', () => {
    // The accessor's own contract, and the only assertion here that reaches it.
    // Which language it answers in depends on the store, so the assertion is on
    // the two things that are true in both: the code point is substituted, and
    // no `{…}` survives. `menu.test.ts` makes the same check for the same
    // reason — a visible `{code}` is a bug report on a screen.
    for (const character of ['\u{2028}', '\u{0}', '\u{7}']) {
      const rendered = tInvisible({ kind: 'invisible', name: 'other', character });
      expect(rendered, character).toContain(codePointLabel(character));
      expect(rendered, character).not.toMatch(/\{[A-Za-z]/);
    } // End of the loop over the sample characters
  });
}); // End of the dictionary suite

describe('the source of the component that renders these segments', () => {
  /*
   * A **text scan over source**, and it says only that — the same instrument,
   * and the same limits, as the scan at the end of `detail.test.ts`. It cannot
   * see what is painted; it can see that a rule this module's decisions depend
   * on is still written down. The evidence that the component renders is the
   * window reading in `docs/decisions/1c-2b-2b-1-notes.md`.
   */
  const source = readFileSync(
    fileURLToPath(new URL('../components/SourceText.svelte', import.meta.url)),
    'utf8'
  );

  it('names each invisible character through the accessor', () => {
    expect(source).toContain('tInvisible(');
  });

  it('draws a line break as an element rather than as a newline in a text node', () => {
    expect(source).toContain('<br />');
  });

  it('does not wrap, so a soft wrap cannot pass for a line the file does not have', () => {
    expect(source).toContain('white-space: pre;');
    expect(source).not.toContain('white-space: pre-wrap;');
    expect(source).toContain('overflow-x: auto;');
  });

  it('opens the container with no whitespace of its own before the file’s text', () => {
    // `white-space: pre` preserves everything inside the container, so a newline
    // written here for legibility would be a newline the file does not have.
    // This is the assertion that fires if anyone reformats the markup.
    expect(source).toContain('<div class="sourceText">{#each');
    expect(source).toContain('{/each}</div>');
  });

  it('never puts file text through {@html}', () => {
    expect(source).not.toContain('@html');
  });
}); // End of the component-source suite

describe('a whole document, which is what only the raw viewer hands this module', () => {
  /*
   * **The committed byte-exact fixtures, run through the primitive.** Every
   * other suite in this file uses a hand-written string; these are the files
   * `CLAUDE.md` section 4 forbids anyone to reformat, and they carry the four
   * hazards a *slice* structurally cannot: a real byte order mark at byte 0, no
   * final newline, a document whose only line break is missing, and mixed line
   * endings in one file.
   *
   * **The synthetic corpus only.** `tests/corpus/real/` is the owner's own
   * configuration, is gitignored, and no test in this repository may read it
   * (D1). The directory named below is the committed, hand-authored one.
   *
   * What this establishes is what the **model** holds for a real file on disk.
   * It still says nothing about WebKit; that is the window reading's half, and
   * `docs/decisions/1c-2b-2b-2-notes.md` section 6 is where it is recorded.
   */
  const CORPUS = fileURLToPath(
    new URL('../../../crates/espansoconfig-core/tests/corpus/synthetic/', import.meta.url)
  );

  /**
   * One committed fixture's text, decoded as the command decodes it.
   *
   * @param name - The fixture's file name.
   * @returns Its text, with nothing normalised and no BOM stripped.
   */
  function fixture(name: string): string {
    return readFileSync(`${CORPUS}${name}`, 'utf8');
  } // End of function fixture()

  const NAMES = readdirSync(CORPUS).filter((name) => name.endsWith('.yml'));

  it('has fixtures to read at all, so the sweep below cannot be vacuous', () => {
    // The failure this guards against is a wrong path silently producing an
    // empty list and a green sweep. The corpus has 32 committed fixtures; the
    // bound is loose on purpose, because the count is not this file's business.
    expect(NAMES.length).toBeGreaterThan(20);
  });

  it.each(NAMES)('rebuilds %s character for character', (name) => {
    const text = fixture(name);
    expect(sourceCharacters(sourceSegments(text, true))).toBe(text);
  });

  it('names the byte order mark of the fixture that has one', () => {
    // `bom-utf8.yml` exists to keep the `ef bb bf` at byte 0 alive through
    // every editor that has ever opened this repository. Read as UTF-8 it is a
    // leading U+FEFF, and `documentStart` is the only thing that can tell it
    // apart from a zero-width no-break space anywhere else.
    const text = fixture('bom-utf8.yml');
    expect(text.startsWith('\u{feff}')).toBe(true);
    expect(invisibleNames(sourceSegments(text, true))[0]).toBe('bom');
    expect(invisibleNames(sourceSegments(text))[0]).toBe('zeroWidth');
  });

  it('draws no break after the last line of a file that ends without one', () => {
    // A match slice can never exhibit this: it ends at the match's last value,
    // so it carries no final newline either way. A whole document can.
    const text = fixture('no-trailing-newline.yml');
    expect(text.endsWith('\n')).toBe(false);
    const segments = sourceSegments(text, true);
    expect(segments[segments.length - 1]?.kind).toBe('text');
    expect(breakCount(segments)).toBe([...text].filter((c) => c === '\n').length);
  });

  it('draws no break at all for the file that has no line break at all', () => {
    const text = fixture('single-line-no-line-ending.yml');
    expect(breakCount(sourceSegments(text, true))).toBe(0);
  });

  it('draws one break per line ending in the file that mixes them', () => {
    // `file-comments-and-mixed-endings.yml` holds exactly two CRLF lines among
    // bare-LF ones. Both are one break, which is the point; **which** ending
    // each was is carried on the segment and nothing renders it (hole 3).
    const text = fixture('file-comments-and-mixed-endings.yml');
    const segments = sourceSegments(text, true);
    const crlf = segments.filter((s) => s.kind === 'break' && s.ending === 'crlf');
    const lf = segments.filter((s) => s.kind === 'break' && s.ending === 'lf');
    expect(crlf).toHaveLength(2);
    expect(lf.length).toBeGreaterThan(0);
    // And no carriage return survives into anything drawn.
    expect(drawnText(segments)).not.toContain('\r');
  });

  it('draws one break per CRLF in the file written entirely with them', () => {
    const text = fixture('crlf-line-endings.yml');
    const segments = sourceSegments(text, true);
    expect(breakCount(segments)).toBe(text.split('\r\n').length - 1);
    expect(invisibleNames(segments)).toEqual([]);
  });
}); // End of the whole-document suite

describe('what a whole document costs this primitive', () => {
  /*
   * **Hole 9 of `docs/decisions/1c-2b-2b-1-notes.md`, measured rather than
   * assumed.** One segment per line and one `<br>` per break is obviously fine
   * for a five-line match slice and was an open question for a whole file. What
   * is asserted here is the **cost model** — how many segments a document of a
   * given shape produces — because that is what decides how many DOM nodes the
   * component creates. The wall-clock figures are in
   * `docs/decisions/1c-2b-2b-2-notes.md` section 7; a timing assertion in a test
   * suite is a flake, not a measurement.
   */

  it('produces two segments per line of an ordinary document, and no more', () => {
    // The shape a real espanso configuration has: ordinary characters, one LF
    // per line. Each line is one text segment and one break, except the last,
    // which has no break after it. Anything worse than linear would show here.
    const lines = 2000;
    const text = `${Array.from({ length: lines }, (_, i) => `  - trigger: ':t${i}'`).join('\n')}\n`;
    const segments = sourceSegments(text, true);
    expect(breakCount(segments)).toBe(lines);
    expect(segments).toHaveLength(lines * 2);
    expect(sourceCharacters(segments)).toBe(text);
  });

  it('adds two segments for each named character, and only for those', () => {
    // The other half of the cost model, and the one that could in principle be
    // pathological: a named character splits the run it is in, so it costs its
    // own segment plus the split. A document of nothing but named characters is
    // the worst case and it is still linear.
    const plain = sourceSegments('a'.repeat(1000));
    expect(plain).toHaveLength(1);
    const named = sourceSegments('a\u{200b}'.repeat(1000));
    expect(named).toHaveLength(2000);
    expect(sourceCharacters(named)).toBe('a\u{200b}'.repeat(1000));
  });

  it('holds a document far larger than any espanso configuration', () => {
    // For scale: the largest committed fixture is 2 464 bytes, and the largest
    // file in the owner's own configuration is 631 lines and 17 840 bytes
    // (`docs/decisions/1c-2b-2b-2-notes.md` section 8 — a count, never
    // content). The document below is 968 000 bytes, so it is more than fifty
    // times the largest thing this application has ever been pointed at.
    const text = `${'x'.repeat(120)}\n`.repeat(8000);
    const segments = sourceSegments(text, true);
    expect(segments).toHaveLength(16000);
    expect(sourceCharacters(segments)).toBe(text);
  });
}); // End of the cost suite
