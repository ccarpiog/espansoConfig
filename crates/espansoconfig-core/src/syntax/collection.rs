//! Where a collection really ends — the answer to `PROGRESS.md` risk R3.
//!
//! # What was measured, before anything was decided
//!
//! The substrate reports a `SequenceEnd` / `MappingEnd` event for every
//! collection. Over both corpora — 246 synthetic collections and 240 real ones
//! — that marker behaves in exactly two ways:
//!
//! | Collection | Marker | Measurement |
//! |---|---|---|
//! | flow | the closing `]` / `}`, one byte wide | exact: 11 of 11 agree with the published extent |
//! | block | a **zero-width position** past the last child | overshoots in 223 of 235 synthetic and 228 of 240 real collections, and **never undershoots** (0 of 475) |
//!
//! A block collection's marker is therefore the same class of hazard as a block
//! scalar's end (R3) and a quoted scalar's end (R20): it runs into trailing
//! trivia. It is *worse* than a block scalar's, because a block scalar can be
//! reconstructed from its header, its indentation column and its chomping
//! indicator, and a block collection has no such header. Measured landings, over
//! the 451 overshooting collections: 111 end at end of file, 42 land exactly on
//! the following node's first byte, and 298 land in the middle of trivia. It is
//! not "the next token's start", so it cannot be trimmed by finding that token.
//!
//! # The rule adopted
//!
//! **The published span still ends at the collection's last child**, and that is
//! now a deliberate choice with a reason rather than a workaround: extending it
//! would make a collection out-end its own deepest child, and
//! `ownership.rs`'s `ending_before` picks the node with the greatest end, so a
//! longer mapping span silently steals its own key's trailing `:` and inline
//! comment. Measured on `empty: # why`, whose comment `PROGRESS.md` D2d pins to
//! the **key**.
//!
//! **What an edit needs is a second, larger number**, and this module derives
//! it: `owned_end` scans the overshoot **forwards** from the published end and
//! returns one past the last byte the collection's own subtree can claim.
//! Scanning forwards is safe where scanning backwards is not — the region lies
//! past every child leaf, so it is entirely gap, and nothing in it can be
//! scalar content.
//!
//! Four byte classes, and each is a rule rather than a convenience:
//!
//! | Class | Verdict | Why |
//! |---|---|---|
//! | spaces and tabs | skipped | layout |
//! | line breaks | skipped | layout |
//! | `:` `-` `?` `,` | **kept** | the punctuation of the collection's own last entry — the `:` of an `empty:` final value, the `-` of a bare final item. The substrate reports both entries' scalars as zero width *before* their punctuation, so the published span stops one byte short of them |
//! | a comment **on the same line** as the last kept byte | **kept** | plan section 6.2 rule 3: an inline comment belongs to its entry, so it travels with the collection |
//! | a comment on a **later** line | skipped | rule 1, 2 or 4 gives it to the file or to whatever follows, so it must stay put |
//! | anything else | **refusal** — `owned_end` returns `None` | never a silently published known-bad extent |
//!
//! The refusal publishes **no owned end at all** — [`CollectionExtent::owned_end`]
//! returns `None` — and is **counted**, exactly like the quoted-scalar trim
//! (`SyntaxIndex::unlexable_quoted_scalars`, the Phase 0c-2b review's finding 5):
//! `SyntaxIndex::unaccountable_collection_extents` records the event, and it is
//! pinned at zero across both corpora. Rejecting the whole index was considered
//! and refused for the R14 reason — making a real file unopenable for a case no
//! accepted document reaches is the worse outcome.
//!
//! An earlier draft fell back to the span's own end and recorded the failure only
//! in the derivation, which the Phase 0c-3a review's finding 4 named: that number
//! under-claims exactly the bytes a removal envelope needs, and nothing in the
//! type stopped a consumer reading it.
//!
//! # The corpus did not contain the shape that matters
//!
//! All 451 overshoot regions in the two corpora hold nothing but whitespace,
//! line breaks and comments — **not one** holds the `:` or `-` the third row of
//! the table above exists for. That is a fact about the corpus and not about
//! YAML: a hand-written `a:\n  b: 1\n  c:\nnext: 2\n` puts a `:` in the region,
//! because `c`'s empty value is a zero-width scalar the substrate reports
//! *before* the colon. `PROGRESS.md` R20 says what to do about that, so
//! `empty-entries-and-extents.yml` was added to the corpus rather than a unit
//! test being called sufficient.

use crate::syntax::ByteSpan;

/// How a collection's [`CollectionExtent::owned_end`] was derived.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ExtentDerivation {
    /// A flow collection: the substrate's closing bracket, which is exact.
    ClosingBracket,
    /// A block collection whose marker did not run past its last child.
    NoOvershoot,
    /// A block collection whose overshoot was scanned and every byte named.
    TrimmedOvershoot,
    /// The derivation failed and **no** owned end was published.
    ///
    /// [`CollectionExtent::owned_end`] is `None` here, so a consumer has to
    /// confront the failure rather than reading a number that is known to be
    /// too small. Counted by `SyntaxIndex::unaccountable_collection_extents`,
    /// and pinned at zero across both corpora.
    Unaccountable,
}

/// What the substrate said about a collection's end, and what we made of it.
///
/// Recorded on every mapping and sequence node so that risk R3 is **measurable
/// from the index** rather than re-derived by whoever needs it, in the same way
/// `ScalarNode::reported_span` records a scalar's untrimmed end.
///
/// # The owned end is fallible, and deliberately so
///
/// [`CollectionExtent::owned_end`] returns `Option<usize>` and is `None` for
/// exactly [`ExtentDerivation::Unaccountable`]. An earlier draft published the
/// node's own `span.end` in that case and recorded the failure only in
/// `derivation`, which the Phase 0c-3a review's finding 4 named: the value was
/// known to under-claim precisely the bytes a structural edit needs, and nothing
/// in the type stopped a consumer reading it without looking at `derivation`.
/// The same discipline `SyntaxIndex::quoted_span` already applies (the 0c-2b
/// review's finding 5) — a fallback that under-claims must not look like an
/// answer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CollectionExtent {
    /// The substrate's own `SequenceEnd` / `MappingEnd` marker span.
    ///
    /// One byte wide for a flow collection — its closing bracket — and **zero
    /// width** for a block one, where it is a position rather than a token.
    pub reported_end: ByteSpan,
    /// One past the last byte the collection's own subtree can claim, or `None`
    /// when the derivation failed. Read through
    /// [`CollectionExtent::owned_end`].
    owned_end: Option<usize>,
    /// How [`CollectionExtent::owned_end`] was arrived at.
    pub derivation: ExtentDerivation,
}

impl CollectionExtent {
    /// Records one collection's extent.
    ///
    /// `owned_end` is `None` exactly when `derivation` is
    /// [`ExtentDerivation::Unaccountable`], and the constructor is the only way
    /// to build one, so the two cannot disagree.
    pub(crate) fn new(
        reported_end: ByteSpan,
        owned_end: Option<usize>,
        derivation: ExtentDerivation,
    ) -> CollectionExtent {
        debug_assert_eq!(
            owned_end.is_none(),
            derivation == ExtentDerivation::Unaccountable,
            "an unaccountable extent has no owned end, and vice versa"
        );
        CollectionExtent {
            reported_end,
            owned_end,
            derivation,
        }
    } // End of function new()

    /// One past the last byte the collection's own subtree can claim.
    ///
    /// Always at or after the node's `span.end` and never after
    /// [`CollectionExtent::reported_end`]. This is the number a structural edit
    /// needs; the node's span is the number the ownership rules need.
    ///
    /// **`None` means refuse.** It says the overshoot region held a byte the
    /// scan could not name, so there is no defensible answer — substituting the
    /// span's own end silently under-claims bytes the collection owns, which is
    /// a deletion when a removal envelope is built from it. Every occurrence is
    /// counted by `SyntaxIndex::unaccountable_collection_extents`, which is
    /// pinned at zero across both corpora.
    pub fn owned_end(&self) -> Option<usize> {
        self.owned_end
    }

    /// Returns `true` when the substrate's marker ran past the published span.
    pub fn overshoots(&self, span: ByteSpan) -> bool {
        self.reported_end.end > span.end
    }

    /// Returns `true` when the derivation failed and no owned end was published.
    pub fn is_unaccountable(&self) -> bool {
        self.derivation == ExtentDerivation::Unaccountable
    }
} // End of impl CollectionExtent

/// One past the last byte a block collection's own subtree can claim.
///
/// `span_end` is the collection's published end and `reported_end` the
/// substrate's marker. The scan runs forwards over `[span_end, reported_end)`,
/// which is provably gap — it lies past every child leaf — and classifies every
/// byte under the table in the module documentation.
///
/// Returns `None` when a byte cannot be classified, which the caller records as
/// [`ExtentDerivation::Unaccountable`] rather than publishing a guess.
pub(crate) fn owned_end(source: &str, span_end: usize, reported_end: usize) -> Option<usize> {
    if reported_end <= span_end {
        return Some(span_end);
    }
    // Both endpoints must be real character boundaries, or nothing below is
    // meaningful. `get` answers that without panicking.
    source.get(span_end..reported_end)?;

    let mut owned = span_end;
    let mut cursor = span_end;
    while cursor < reported_end {
        let character = source[cursor..].chars().next()?;
        match character {
            ' ' | '\t' => cursor += 1,
            '\n' => cursor += 1,
            '\r' => {
                cursor += if source[cursor..].starts_with("\r\n") {
                    2
                } else {
                    1
                }
            }
            // The punctuation of the collection's own last entry. The substrate
            // reports an empty value and an empty item as zero-width scalars
            // positioned *before* the `:` or after the `-` that introduces them,
            // so the published span stops short of these bytes and only this
            // scan can recover them.
            ':' | '-' | '?' | ',' => {
                cursor += 1;
                owned = cursor;
            }
            // A `#` only opens a comment at a line start or after white space,
            // which is the same test `trivia.rs` applies. An inline one — on the
            // line the last kept byte sits on — is rule 3 trivia and belongs to
            // the entry; one on a later line belongs to the file or to whatever
            // follows it, and must not travel.
            '#' if at_line_start(source, cursor) || preceded_by_space(source, cursor) => {
                let end = line_content_end(source, cursor).min(reported_end);
                if same_line(source, last_owned_character(source, owned), cursor) {
                    owned = end;
                }
                cursor = end;
            }
            _ => return None,
        }
    } // End of the scan over the collection's overshoot region
    Some(owned)
} // End of function owned_end()

/// Start of the last character before `owned` — the collection's last owned
/// byte rather than the position just past it.
///
/// The distinction decides whether a comment is inline. A block-scalar value's
/// content span ends immediately **after** its final line break (`PROGRESS.md`,
/// D2c), so `owned` then sits at column 0 of the next line and every comment on
/// that line would look like an inline comment on the last entry. It is not: it
/// is a leading comment for whatever follows, and the ownership rules give it
/// away accordingly. Anchoring the same-line test on the last owned *character*
/// puts the line break itself between the two and answers correctly.
fn last_owned_character(source: &str, owned: usize) -> usize {
    source
        .get(..owned)
        .and_then(|before| before.char_indices().next_back())
        .map_or(owned, |(offset, _)| offset)
} // End of function last_owned_character()

/// Whether `position` begins a physical line.
fn at_line_start(source: &str, position: usize) -> bool {
    position == 0 || source[..position].ends_with(['\n', '\r'])
}

/// Whether the byte before `position` is a space or a tab.
fn preceded_by_space(source: &str, position: usize) -> bool {
    source[..position].ends_with([' ', '\t'])
}

/// Offset of the first line-break byte at or after `position`, or the source
/// end.
fn line_content_end(source: &str, position: usize) -> usize {
    source[position..]
        .find(['\n', '\r'])
        .map_or(source.len(), |offset| position + offset)
}

/// Whether two byte offsets sit on the same physical line.
fn same_line(source: &str, from: usize, to: usize) -> bool {
    let (from, to) = if from <= to { (from, to) } else { (to, from) };
    source
        .get(from..to)
        .is_some_and(|between| !between.contains(['\n', '\r']))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layout_is_skipped_and_entry_punctuation_is_kept() {
        // `a:\n  b: 1\n  c:\nnext: 2\n` — the inner mapping's span ends after
        // `c`, and the `:` that entry is written with lies in the overshoot.
        let source = "a:\n  b: 1\n  c:\nnext: 2\n";
        assert_eq!(owned_end(source, 13, 15), Some(14), "the `:` is kept");
        // Pure layout keeps nothing.
        assert_eq!(owned_end("a: 1\n\n\nb: 2\n", 4, 7), Some(4));
        // No overshoot at all.
        assert_eq!(owned_end("a: 1", 4, 4), Some(4));
        // An inverted pair is answered rather than panicked on.
        assert_eq!(owned_end("a: 1", 4, 2), Some(4));
    } // End of function layout_is_skipped_and_entry_punctuation_is_kept()

    #[test]
    fn an_inline_comment_is_kept_and_a_later_one_is_not() {
        let inline = "a:\n  b: 1 # why\nnext: 2\n";
        assert_eq!(owned_end(inline, 9, 16), Some(15), "` # why` travels");
        let later = "a:\n  b: 1\n  # later\nnext: 2\n";
        assert_eq!(owned_end(later, 9, 20), Some(9), "a later comment stays");
        // A comment on the line of a *kept* `:` is still inline.
        let after_colon = "a:\n  c: # why\nnext: 2\n";
        assert_eq!(owned_end(after_colon, 6, 14), Some(13));
    } // End of function an_inline_comment_is_kept_and_a_later_one_is_not()

    #[test]
    fn an_unnameable_byte_refuses_rather_than_guessing() {
        // A `.` cannot be layout, entry punctuation or a comment, so the
        // derivation fails and the caller counts it.
        assert_eq!(owned_end("a: 1\n...\n", 4, 8), None);
        // A `#` that opens no comment is not a comment either.
        assert_eq!(owned_end("a: 1\n-#x\n", 4, 8), None);
        // A span that does not land on a character boundary.
        assert_eq!(owned_end("a: 😀\n", 4, 6), None);
    } // End of function an_unnameable_byte_refuses_rather_than_guessing()

    #[test]
    fn a_crlf_break_counts_as_one_break() {
        assert_eq!(owned_end("a: 1\r\n\r\nb: 2\r\n", 4, 8), Some(4));
    }
}
