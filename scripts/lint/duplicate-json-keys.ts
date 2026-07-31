/**
 * A scanner for repeated keys inside one JSON object.
 *
 * `{"a": 1, "a": 2}` is legal JSON. Every parser in the toolchain accepts it
 * and keeps only the last occurrence, so a translator who edits the *first*
 * `"app.name"` in `es.json` watches their change vanish with no error from
 * anything: `JSON.parse` is silent, the TypeScript import exposes one property,
 * the key-set parity test compares two identical key lists, and the
 * untranslated-value heuristic reads the surviving value. The defect is
 * invisible to every check this repository had, because **all of them look at
 * the parsed object and the duplication only exists in the text**.
 *
 * Hence a scanner over raw file text rather than another assertion about a
 * parsed value. It is a small JSON reader that never builds a value: it walks
 * the document, keeps a frame per object, and records a key it has already seen
 * in the frame it is currently in.
 *
 * ## What it can see
 *
 * - A key repeated in the same object, at any nesting depth.
 * - The line of both the first and the repeat occurrence.
 *
 * ## What it deliberately does not do
 *
 * 1. **Validate JSON.** Malformed input is `JSON.parse`'s job and the import
 *    itself fails long before this runs, so this scanner is permissive about
 *    anything that is not a brace, a bracket, a quote, a colon or a comma.
 * 2. **Compare keys across sibling objects.** `{"a": {"x": 1}, "b": {"x": 2}}`
 *    is correct JSON with no duplication, and a scanner that flagged it would
 *    be unusable.
 * 3. **Normalise escapes.** A key written `"a"` and a key written `"a"`
 *    are the same key to a parser and different to this scanner. Both
 *    dictionaries use plain ASCII key names, and the alternative is to
 *    reimplement string unescaping to catch a case nobody has written by hand.
 *    Recorded as a hole in `1b-1-notes.md` section 9.
 */

/** One key that appeared more than once in a single JSON object. */
export interface DuplicateKey {
  /** The file the scanner was given, for the failure message. */
  file: string;
  /** The repeated key, exactly as it was written. */
  key: string;
  /** 1-based line of the first occurrence. */
  firstLine: number;
  /** 1-based line of the repeat. */
  duplicateLine: number;
}

/** One object or array the scanner is currently inside. */
interface Frame {
  /** Objects track their keys; arrays have none to track. */
  keys: Map<string, number> | null;
  /** Whether the next string literal in this frame is a key. */
  expectingKey: boolean;
}

/**
 * Reads a JSON string literal and reports where it ended.
 *
 * @param text - The document being scanned.
 * @param start - Index of the opening quote.
 * @returns The literal's raw contents and the index just past the closing quote.
 */
function readStringLiteral(text: string, start: number): { value: string; end: number } {
  let index = start + 1;
  let value = '';
  while (index < text.length) {
    const character = text.charAt(index);
    if (character === '\\') {
      value += text.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (character === '"') {
      return { value, end: index + 1 };
    }
    value += character;
    index += 1;
  } // End of the loop over one string literal's characters
  return { value, end: index };
} // End of function readStringLiteral()

/**
 * Counts lines up to an offset.
 *
 * @param text - The document being scanned.
 * @param offset - A character offset into it.
 * @returns The 1-based line number the offset sits on.
 */
function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text.charAt(index) === '\n') {
      line += 1;
    }
  }
  return line;
} // End of function lineAt()

/**
 * Finds every key repeated within a single object of a JSON document.
 *
 * @param source - The raw text of a JSON file, not a parsed value.
 * @param file - A label used in findings, normally the file's path.
 * @returns Every duplicate, in the order the repeats appear.
 */
export function findDuplicateJsonKeys(source: string, file: string): DuplicateKey[] {
  const duplicates: DuplicateKey[] = [];
  const stack: Frame[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source.charAt(index);
    const frame = stack[stack.length - 1];

    if (character === '{') {
      stack.push({ keys: new Map(), expectingKey: true });
    } else if (character === '[') {
      stack.push({ keys: null, expectingKey: false });
    } else if (character === '}' || character === ']') {
      stack.pop();
    } else if (character === ',') {
      if (frame !== undefined && frame.keys !== null) {
        frame.expectingKey = true;
      }
    } else if (character === ':') {
      if (frame !== undefined) {
        frame.expectingKey = false;
      }
    } else if (character === '"') {
      const { value, end } = readStringLiteral(source, index);
      if (frame !== undefined && frame.keys !== null && frame.expectingKey) {
        const firstOffset = frame.keys.get(value);
        if (firstOffset === undefined) {
          frame.keys.set(value, index);
        } else {
          duplicates.push({
            file,
            key: value,
            firstLine: lineAt(source, firstOffset),
            duplicateLine: lineAt(source, index)
          });
        }
      }
      index = end;
      continue;
    }

    index += 1;
  } // End of the loop over the document's characters

  return duplicates;
} // End of function findDuplicateJsonKeys()

/**
 * Renders duplicates as a human-readable failure message.
 *
 * @param duplicates - The duplicates to describe.
 * @returns One line per duplicate.
 */
export function formatDuplicateKeys(duplicates: readonly DuplicateKey[]): string {
  return duplicates
    .map(
      (d) =>
        `${d.file}:${d.duplicateLine} duplicate key ${JSON.stringify(d.key)}, ` +
        `first seen on line ${d.firstLine}`
    )
    .join('\n');
} // End of function formatDuplicateKeys()
