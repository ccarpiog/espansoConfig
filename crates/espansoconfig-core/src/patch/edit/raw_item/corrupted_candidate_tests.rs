//! A deliberately corrupted raw-item candidate fails the oracle — Phase 3-15-1.
//!
//! The local raw-item edit (Phase 3-7) is verified by [`verify_item_text`], not
//! by the batch verifier, so it gets its own twin of
//! `edit::corrupted_candidate_tests`. [`candidate_through`] plans one
//! replacement exactly as [`apply_item_text`] does, lets a test rewrite the
//! planned replacement and corrupt the spliced candidate, and hands what is
//! left to the same [`verify_item_text`] call. Inside the range the author may
//! write anything, so every corruption here is one **outside** it, or one that
//! makes the replacement reach outside it.

use super::*;

/// Three neutral snippets under a file comment; the middle one is replaced.
const SOURCE: &str = concat!(
    "# A file comment.\n",
    "matches:\n",
    "  - trigger: ':a'\n",
    "    replace: one\n",
    "  - trigger: ':b'\n",
    "    replace: two\n",
    "    later_key: kept\n",
    "  - trigger: ':c'\n",
    "    replace: three\n",
);

/// The replacement text for the middle snippet: its unknown entry changes, as
/// an author may make it.
const TEXT: &str = "  - trigger: ':b'\n    replace: rewritten\n    later_key: changed\n";

/// Plans the replacement of snippet 1 of `source` with `text` exactly as
/// [`apply_item_text`] does, lets `rewrite` change the planned replacement,
/// splices, lets `corrupt` change the candidate, and runs
/// [`verify_item_text`] on what is left.
fn candidate_through(
    source: &str,
    text: &str,
    rewrite: impl FnOnce(&mut Replacement),
    corrupt: impl FnOnce(&mut String),
) -> Result<String, EditError> {
    let index = SyntaxIndex::parse(source).map_err(EditError::SourceDoesNotParse)?;
    let trivia = TriviaIndex::scan(source, &index);
    let item = DocumentPath::root(0).with_key("matches").with_index(1);
    let range = owned_range(source, &index, &trivia, 0, &item)?;
    check_the_submitted_text(source, &index, &range, 0, text)?;
    StructuralGuard::Removal {
        runs: vec![range.span],
        entry: (range.item, range.item),
        kind: EnvelopeKind::CarriesTheItem,
    }
    .check(source, &index, &trivia)?;
    let mut replacement = Replacement {
        span: range.span,
        text: text.to_owned(),
    };
    rewrite(&mut replacement);
    let replacements = vec![replacement];
    let mut candidate = splice(source, &replacements);
    corrupt(&mut candidate);
    let expectation = ItemTextExpectation {
        edit: 0,
        range: &range,
        written: ByteSpan::new(range.span.start, range.span.start + text.len()),
    };
    verify_item_text(
        source,
        &index,
        &trivia,
        &candidate,
        &replacements,
        &expectation,
    )?;
    Ok(candidate)
} // End of function candidate_through()

/// The honest run is `apply_edits`'s own answer, so the mirror has not drifted.
#[test]
fn the_raw_item_mirror_builds_the_candidate_apply_edits_builds() {
    let honest = candidate_through(SOURCE, TEXT, |_| {}, |_| {}).expect("the honest run verifies");
    let item = DocumentPath::root(0).with_key("matches").with_index(1);
    let applied = super::super::apply_edits(SOURCE, &[ItemTextReplacement::new(item, TEXT).into()])
        .expect("apply_edits accepts it");
    assert_eq!(honest, applied.text);
    assert_ne!(honest, SOURCE);
} // End of function the_raw_item_mirror_builds_the_candidate_apply_edits_builds()

/// A candidate corrupted outside the owned range — a byte of the file comment,
/// a byte of the snippet above, a byte of the snippet below, a byte appended —
/// is refused by the byte oracle.
#[test]
fn a_raw_item_candidate_corrupted_outside_its_range_fails_the_oracle() {
    type Corruption = fn(&mut String);
    let corruptions: [(&str, Corruption); 4] = [
        ("a byte of the file comment", |candidate| {
            candidate.replace_range(2..3, "a");
        }),
        ("a byte of the snippet above", |candidate| {
            let at = candidate.find("one").expect("the snippet above");
            candidate.replace_range(at..at + 1, "O");
        }),
        ("a byte of the snippet below", |candidate| {
            let at = candidate.find("three").expect("the snippet below");
            candidate.replace_range(at..at + 1, "T");
        }),
        ("an appended byte", |candidate| candidate.push('\n')),
    ];
    for (how, corruption) in corruptions {
        let result = candidate_through(SOURCE, TEXT, |_| {}, corruption);
        assert!(
            matches!(
                result,
                Err(EditError::Verification(
                    VerificationFailure::BytesOutsideTheSpanChanged { .. }
                        | VerificationFailure::LengthMismatch { .. }
                ))
            ),
            "{how}: expected the byte oracle's refusal, got {result:?}"
        );
    } // End of the loop over the corruptions
} // End of function a_raw_item_candidate_corrupted_outside_its_range_fails_the_oracle()

/// A replacement stretched one line past the owned range — carrying the next
/// snippet's first line with it, byte for byte, so the byte oracle is satisfied
/// by construction — is refused as `SpanNotPermitted`, because it no longer
/// lies inside the one span the range permits.
#[test]
fn a_raw_item_replacement_stretched_past_its_range_fails_the_oracle() {
    let next_line = "  - trigger: ':c'\n";
    let result = candidate_through(
        SOURCE,
        TEXT,
        |replacement| {
            replacement.span = ByteSpan::new(
                replacement.span.start,
                replacement.span.end + next_line.len(),
            );
            replacement.text.push_str(next_line);
        },
        |_| {},
    );
    assert!(
        matches!(
            result,
            Err(EditError::Verification(
                VerificationFailure::SpanNotPermitted { .. }
            ))
        ),
        "a replacement outside the one permitted span is refused as such, got {result:?}"
    );
} // End of function a_raw_item_replacement_stretched_past_its_range_fails_the_oracle()
