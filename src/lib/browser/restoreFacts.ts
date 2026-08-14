/**
 * The facts a restore screen may state about a candidate, measured here.
 *
 * **Everything in this module is a measurement of a value the screen already
 * holds**, and that is the whole of what it claims. Consult Q5
 * (`docs/reviews/phase-2c-5-design.md`) asks the screen for "candidate
 * byte/character facts that are actually measured"; consult Q6 forbids it any
 * statement about history, authenticity, recoverability or validity. So this
 * module counts bytes and characters of a string that is already in memory, and
 * compares one number the catalogue reported against one number counted here. It
 * reads no file, asks no command, and says nothing about what any folder holds
 * now.
 *
 * **It is not part of `./restore.ts`.** That module is the restore *transaction* —
 * the catalogue, the candidate, the confirmation and the permit — and it was
 * finished and reviewed at 2c-5-3 and 2c-5-4a. What is here is presentation
 * arithmetic that `RestorePane.svelte` would otherwise carry in markup, which is
 * the failure mode 2c-3c-3 named: a rule written into one renderer is carried by
 * that renderer's mounted suite alone, and a second renderer can omit it while
 * walking the model faithfully.
 *
 * ## Why the byte count is counted rather than taken from the listing
 *
 * {@link BackupEntry.length} is the length `stat` reported **when the entry was
 * listed**, as decimal digits, and `../ipc/types.ts` says in the same sentence
 * that it is a fact about that moment rather than a promise about the next read.
 * The candidate a restore would send is the string that came back from
 * `read_backup_text`, so the honest size of *that* is the size of *that* — which
 * is why {@link candidateMeasurements} encodes it and counts the result rather
 * than parsing a number somebody else observed.
 *
 * The two are then compared, and the comparison is disclosed rather than
 * resolved: {@link CandidateMeasurements.listedLength} is `null` when the
 * catalogue's digits are not a number this application can read, and
 * {@link CandidateMeasurements.agreesWithListing} is `null` with it. Where both
 * numbers exist and differ, what a screen may say is that two observations taken
 * at two moments disagree — never that the entry changed, never that anything is
 * wrong with it, and never that one of them describes the folder now.
 *
 * `BigInt` and never `Number`, for the reason `BackupEntry.length` is a string at
 * all: a filesystem length can exceed JavaScript's safe-integer range, a batch is
 * untrusted input, and `Number('9007199254740993')` is silently `9007199254740992`.
 */

/**
 * What one retained candidate measures, counted from the candidate itself.
 *
 * Every field is either a count taken here or `null`. Nothing on it is read back
 * from the catalogue except {@link CandidateMeasurements.listedLength}, which is
 * carried so a screen can name the number it is comparing against.
 */
export interface CandidateMeasurements {
  /**
   * How many bytes the candidate is when encoded as UTF-8.
   *
   * The size of exactly what would be written: `TextEncoder` is the only thing
   * in this application that turns a JavaScript string into the bytes the wire
   * carried, and a `String.length` would count UTF-16 code units instead — which
   * is a different number for every non-ASCII character and for every astral
   * one.
   */
  readonly bytes: number;
  /**
   * How many Unicode code points the candidate holds.
   *
   * Counted by iterating the string, because `String.length` counts UTF-16 code
   * units and would report an emoji as two. It is **not** a count of what a
   * person perceives as characters: a decomposed `é` is two code points and one
   * grapheme, and `unicode-offsets.yml` in the corpus holds both spellings on
   * purpose. The sentence beside it therefore says *characters as Unicode counts
   * them* and claims nothing about glyphs.
   */
  readonly codePoints: number;
  /**
   * The length the catalogue recorded when this entry was listed, or `null`.
   *
   * `null` when the digits the wire carried are not a non-negative integer this
   * application can read — a possibility rather than a fault, because a batch is
   * untrusted input and nothing validates that field beyond its type.
   */
  readonly listedLength: bigint | null;
  /**
   * Whether the two observations are the same number, or `null` when one is not
   * readable.
   *
   * **A comparison of two observations, never a verdict about the entry.** Both
   * numbers were true of the moment they were taken; this says only whether they
   * are equal.
   */
  readonly agreesWithListing: boolean | null;
}

/**
 * Reads the length a listing recorded, or `null`.
 *
 * Deliberately strict: only digits, and only a non-negative value. `BigInt` will
 * happily accept `' 12 '`, `'0x0c'` and `''` (which is `0n`), and every one of
 * those would put a number on screen that the catalogue did not report.
 *
 * @param digits - `BackupEntry.length`, exactly as the wire carried it.
 * @returns The value, or `null` when those characters are not a plain decimal
 *   count.
 */
function listedLengthOf(digits: string): bigint | null {
  if (!/^[0-9]+$/.test(digits)) {
    return null;
  }
  return BigInt(digits);
} // End of function listedLengthOf()

/** The one encoder, built once rather than per call. */
const UTF8 = new TextEncoder();

/**
 * Counts what a screen may say about one candidate.
 *
 * @param text - The candidate's exact bytes as they arrived, unmodified.
 * @param listed - `BackupEntry.length` for the entry the candidate was read
 *   from: the length recorded when it was listed, as decimal digits.
 * @returns The measurements, all of them taken here.
 */
export function candidateMeasurements(text: string, listed: string): CandidateMeasurements {
  const bytes = UTF8.encode(text).length;
  const listedLength = listedLengthOf(listed);
  // **The iterator rather than `[...text].length`**: a string's own iterator
  // yields whole code points, which is the count this needs, and stepping it
  // counts them without building an array as long as the file.
  const walk = text[Symbol.iterator]();
  let codePoints = 0;
  while (walk.next().done !== true) {
    codePoints += 1;
  } // End of the loop over the candidate's code points
  return {
    bytes,
    codePoints,
    listedLength,
    agreesWithListing: listedLength === null ? null : listedLength === BigInt(bytes)
  };
} // End of function candidateMeasurements()

/**
 * One occurrence of each reason, in the order the first of each arrived.
 *
 * `BackupBatchListing.skipped` and `BackupEntryListing.skipped` carry **one code
 * per skipped entry**, so a folder holding forty foreign names produces forty
 * identical codes. A screen that walked the list as it arrived would print the
 * same sentence forty times; a screen that printed a count would be this
 * application deciding that forty entries were skipped *for that reason*, which
 * the list does support — but the count is the number of skipped entries and not
 * the number of *kinds*, and the two read alike beside a sentence.
 *
 * So this collapses to the distinct reasons and nothing else. **What is
 * deliberately lost is how many entries each reason covers**; the listings carry
 * `unrecognised` and `unreadable` for that, and those are the numbers a screen
 * shows when it wants one.
 *
 * @typeParam T - The reason code.
 * @param reasons - The codes a listing carried, in its own order.
 * @returns Each distinct code once, first-seen order preserved.
 */
export function distinctReasons<T>(reasons: readonly T[]): readonly T[] {
  return [...new Set(reasons)];
} // End of function distinctReasons()
