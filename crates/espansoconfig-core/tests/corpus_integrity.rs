//! Guards on the corpus itself.
//!
//! Twelve fixtures exist precisely because they violate what an editor considers
//! tidy: CRLF line endings, a leading UTF-8 BOM, a missing final newline, an
//! unnormalised (NFD) `é`, deliberate runs of blank lines around block scalars,
//! spaces after a block indicator, more-indented folded lines, a *mixture* of
//! CRLF and LF endings in one file, a document with no line break at all, and
//! comment lines whose **column** — zero under an indented folded block, flush
//! against the key below them — is the whole test. Editors, formatters, Unicode
//! normalisation and git's own end-of-line conversion all offer to "fix" them,
//! and every one of those fixes silently deletes the test.
//!
//! These assertions are on raw bytes, not parsed content, so they fail loudly
//! the moment a fixture is normalised.

mod common;

use espansoconfig_core::LineEnding;
use std::path::PathBuf;

/// Reads a synthetic fixture as raw bytes.
fn fixture_bytes(name: &str) -> Vec<u8> {
    let path: PathBuf = common::corpus_root().join("synthetic").join(name);
    std::fs::read(&path).unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()))
}

#[test]
fn crlf_fixture_still_has_crlf_bytes_in_the_working_tree() {
    let bytes = fixture_bytes("crlf-line-endings.yml");

    let crlf = bytes.windows(2).filter(|pair| pair == b"\r\n").count();
    let lf = bytes.iter().filter(|byte| **byte == b'\n').count();

    println!("crlf-line-endings.yml: {crlf} CRLF pairs, {lf} LF bytes");
    assert!(crlf > 5, "the fixture must contain CRLF line endings");
    assert_eq!(
        crlf, lf,
        "every LF must be preceded by a CR; a bare LF means the file was normalised"
    );

    let text = String::from_utf8(bytes).expect("valid UTF-8");
    assert_eq!(
        LineEnding::detect(&text),
        LineEnding::Crlf,
        "the crate's own detector must agree"
    );
}

#[test]
fn bom_fixture_still_starts_with_ef_bb_bf() {
    let bytes = fixture_bytes("bom-utf8.yml");
    println!("bom-utf8.yml first three bytes: {:02x?}", &bytes[..3]);
    assert_eq!(
        &bytes[..3],
        &[0xEF, 0xBB, 0xBF],
        "the UTF-8 BOM must still be present"
    );

    let text = String::from_utf8(bytes).expect("valid UTF-8");
    assert!(text.starts_with(espansoconfig_core::UTF8_BOM));
    // The BOM must be the ONLY unusual thing about it: no CR bytes, so a
    // failure here isolates cleanly to one cause.
    assert!(!text.contains('\r'), "the BOM fixture must stay LF-only");
}

#[test]
fn no_trailing_newline_fixture_still_ends_without_one() {
    let bytes = fixture_bytes("no-trailing-newline.yml");
    let last = *bytes.last().expect("non-empty file");
    println!(
        "no-trailing-newline.yml last byte: 0x{last:02x} ({:?})",
        last as char
    );
    assert_ne!(last, b'\n', "an editor added a final newline");
    assert_eq!(
        last, b'\'',
        "the file must still end with the closing quote"
    );
}

#[test]
fn unicode_offsets_fixture_still_has_an_unnormalised_decomposed_e_acute() {
    // The whole point of this fixture is that it is NOT in NFC. An editor, a
    // filesystem or a copy step that normalises it turns the decomposed `é`
    // into a precomposed one, which silently makes
    // `saphyr_offsets_count_unicode_scalar_values_not_bytes_utf16_units_or_graphemes`
    // unable to tell Unicode scalar values from grapheme clusters.
    let bytes = fixture_bytes("unicode-offsets.yml");

    let precomposed = bytes
        .windows(2)
        .filter(|pair| *pair == [0xC3, 0xA9])
        .count();
    let decomposed = bytes
        .windows(3)
        .filter(|triple| *triple == [0x65, 0xCC, 0x81])
        .count();
    let astral = bytes
        .windows(4)
        .filter(|quad| *quad == [0xF0, 0x9F, 0x98, 0x80])
        .count();

    println!(
        "unicode-offsets.yml: {precomposed} precomposed é, {decomposed} decomposed é, {astral} astral emoji"
    );
    assert_eq!(precomposed, 1, "the precomposed é (c3 a9) must be present");
    assert_eq!(
        decomposed, 1,
        "the decomposed é (65 cc 81) must still be TWO code points"
    );
    assert_eq!(
        astral, 1,
        "the astral-plane emoji (f0 9f 98 80) must survive"
    );
}

#[test]
fn block_scalars_fixture_keeps_its_deliberate_blank_runs() {
    // The blank lines after the `|` and `|+` blocks are the difference between
    // clip and keep chomping, and the blank line inside the `:interior-blank`
    // block is scalar content. A whitespace-trimming editor deletes all three
    // tests at once.
    let bytes = fixture_bytes("block-scalars.yml");
    let text = String::from_utf8(bytes).expect("valid UTF-8");

    assert!(
        text.contains("clip line two\n\n\n    label:"),
        "the two blank lines after the clip block must survive"
    );
    assert!(
        text.contains("kept\n\n\n    label:"),
        "the two blank lines after the keep block must survive"
    );
    assert!(
        text.contains("before the blank\n\n      after the blank"),
        "the blank line INSIDE the literal block must survive"
    );
    assert!(
        text.contains("replace: |2-\n"),
        "the explicit indentation indicator with strip chomping must survive"
    );
    assert!(
        text.contains("replace: |2+\n"),
        "the explicit indentation indicator with keep chomping must survive"
    );
}

#[test]
fn the_terminal_spaces_fixture_still_ends_in_two_spaces_with_no_final_newline() {
    // The whole point of this fixture is its last two bytes. There is no next
    // token after the block scalar, so those spaces are scalar CONTENT; an
    // editor that trims trailing whitespace, or adds a final newline, deletes
    // the test without leaving a trace.
    let bytes = fixture_bytes("block-scalar-terminal-spaces.yml");
    let tail: Vec<u8> = bytes.iter().rev().take(3).rev().copied().collect();
    println!("block-scalar-terminal-spaces.yml last three bytes: {tail:02x?}");
    assert_eq!(
        &tail[1..],
        b"  ",
        "the two terminal spaces must still be there"
    );
    assert_ne!(
        *bytes.last().expect("non-empty file"),
        b'\n',
        "an editor added a final newline"
    );
    assert_ne!(tail[0], b' ', "there must be content before the spaces");
} // End of function the_terminal_spaces_fixture_still_ends_in_two_spaces_with_no_final_newline()

#[test]
fn the_header_tails_fixture_keeps_the_spaces_after_its_block_indicator() {
    // Added by the Phase 0c-2b review's fix round, which found that a block-to-
    // flow style change silently deleted the bytes between a block scalar's
    // header indicator and its line break. This fixture is the only one that
    // pairs a block scalar with a header-line comment and with trailing spaces
    // after its indicator, so those three spaces on the `|-` line ARE the test:
    // a "trim trailing whitespace" on save removes the regression test for a
    // byte-fidelity bug without leaving a trace.
    let bytes = fixture_bytes("block-scalar-header-tails.yml");
    let text = String::from_utf8(bytes).expect("the fixture is valid UTF-8");
    assert!(
        text.contains("replace: |-   \n"),
        "the three spaces after the `|-` indicator must still be there"
    );
    assert!(
        text.contains("replace: | # why this block exists\n"),
        "the comment on the `|` header line must still be there"
    );
    assert!(
        text.contains("replace: >2 # a folded header"),
        "the folded header's indicators and comment must still be there"
    );
} // End of function the_header_tails_fixture_keeps_the_spaces_after_its_block_indicator()

#[test]
fn the_leading_blank_line_fixture_keeps_its_empty_lines_directly_under_the_headers() {
    // Every blank line under a `|` or `>` header here is scalar content, and
    // every one of them must stay COMPLETELY empty: a blank line indented past
    // the block's own indentation is a parse error, not a formatting detail.
    let bytes = fixture_bytes("block-scalar-leading-blank-lines.yml");
    let text = String::from_utf8(bytes).expect("valid UTF-8");

    let openings = text.matches(": |\n\n").count()
        + text.matches(": |-\n\n").count()
        + text.matches(": |+\n\n").count()
        + text.matches(": >\n\n").count();
    println!("block-scalar-leading-blank-lines.yml: {openings} headers followed by a blank line");
    assert_eq!(
        openings, 5,
        "every block in the fixture must still open with an empty line"
    );
    assert!(
        !text.contains("\n \n") && !text.contains("\n\t\n"),
        "the blank lines must stay completely empty"
    );
} // End of function the_leading_blank_line_fixture_keeps_its_empty_lines_directly_under_the_headers()

#[test]
fn the_folded_fixture_keeps_its_more_indented_lines() {
    // The extra indentation is what stops YAML folding those lines. An editor
    // that re-indents them turns four distinct folding cases into one trivial
    // one.
    let bytes = fixture_bytes("folded-more-indented.yml");
    let text = String::from_utf8(bytes).expect("valid UTF-8");

    let deeper = text
        .lines()
        .filter(|line| line.starts_with("        ") && !line.trim_start().starts_with('#'))
        .count();
    println!("folded-more-indented.yml: {deeper} lines indented past the block indent");
    assert_eq!(
        deeper, 5,
        "the more-indented lines must survive, one per folding case"
    );
    assert!(
        text.contains("replace: >2\n"),
        "the explicit indentation indicator in front of a deeper line must survive"
    );
} // End of function the_folded_fixture_keeps_its_more_indented_lines()

#[test]
fn the_boundaries_fixture_keeps_its_column_zero_comments_and_its_leading_block() {
    // Added by the Phase 0c-3b-1 review's fix round for finding 2. Two things in
    // this file are indentation rather than text, and an editor that re-indents
    // comment lines — which several offer to do — destroys both:
    //
    // - four comment lines at **column zero** under a folded block whose body is
    //   indented six columns. Their column is the whole test: it is what proves
    //   they cannot become that block's content, so `RemovalWouldExtendABlockScalar`
    //   must not fire. Indent them and the fixture silently starts testing the
    //   refusal instead of the narrowing;
    // - a comment block indented to the **same** column as the `vars:` key
    //   directly under it, with no blank line between the two. That is what plan
    //   section 6.2's rule 1 reads to give those comments to the entry, so the
    //   removal envelope starts above the entry's own first line. A blank line
    //   inserted there hands them to the file instead and the construct is gone.
    let bytes = fixture_bytes("run-based-removal-boundaries.yml");
    let text = String::from_utf8(bytes).expect("valid UTF-8");

    // Only the comments *inside* the document body count: the file's own three
    // header lines are at column zero too, and they are ordinary file-header
    // trivia rather than the shape this fixture exists for.
    let body = text
        .split_once("matches:\n")
        .expect("the fixture still opens with its `matches` key")
        .1;
    let at_column_zero = body.lines().filter(|line| line.starts_with("# ")).count();
    println!("run-based-removal-boundaries.yml: {at_column_zero} interior column-zero comments");
    assert_eq!(
        at_column_zero, 4,
        "the four column-zero comment lines under the folded block must survive"
    );
    assert!(
        text.contains("    replace: >\n      the folded body"),
        "the folded header and its six-column body must keep their columns"
    );
    assert!(
        text.contains("    # give it to the entry and it is deleted with the entry.\n    vars:\n"),
        "the leading comment block must stay flush against `vars:` with no blank line"
    );
    assert!(
        text.ends_with("interior one'\n"),
        "the file must still end with a single line break"
    );
} // End of function the_boundaries_fixture_keeps_its_column_zero_comments_and_its_leading_block()

#[test]
fn the_mixed_ending_fixture_keeps_its_two_crlf_lines_and_its_missing_final_break() {
    // Added by the Phase 0c-3a review's fix round. Two of this file's lines end
    // with CRLF and the rest with a bare LF, so the document-wide "dominant"
    // ending is LF while the anchor an insertion must copy is CRLF — an
    // insertion that consults the document instead of the anchor writes the
    // wrong bytes, and only these two CR bytes can catch it. The file also ends
    // without a final break, which is what makes an end-of-file insertion learn
    // its ending from a sibling.
    let bytes = fixture_bytes("file-comments-and-mixed-endings.yml");
    let crlf = bytes.windows(2).filter(|pair| pair == b"\r\n").count();
    let lf = bytes.iter().filter(|byte| **byte == b'\n').count();
    let cr = bytes.iter().filter(|byte| **byte == b'\r').count();
    println!("file-comments-and-mixed-endings.yml: {crlf} CRLF, {lf} LF, {cr} CR");
    assert_eq!(crlf, 2, "exactly two lines must still end with CRLF");
    assert_eq!(cr, crlf, "a bare CR would be a line ending we cannot write");
    assert!(
        lf > crlf + 2,
        "bare LF endings must still outnumber the CRLF ones, or the document-wide \
         ending stops disagreeing with the anchor's"
    );
    assert_ne!(
        *bytes.last().expect("non-empty file"),
        b'\n',
        "an editor added a final newline"
    );

    // And the shape finding 1 was demonstrated on: a comment with a blank line
    // under it, sitting between two entries of a collection that can be removed.
    let text = String::from_utf8(bytes).expect("valid UTF-8");
    assert!(
        text.contains("must not take it away.\n\n      second:"),
        "the blank line under the interior comment is what makes the file own it"
    );
} // End of function the_mixed_ending_fixture_keeps_its_two_crlf_lines_and_its_missing_final_break()

#[test]
fn the_single_line_fixture_still_holds_no_line_break_at_all() {
    // The only fixture in the corpus that gives an insertion no line ending to
    // copy. `LineEnding::detect` answers LF for it by defaulting rather than by
    // measuring, so an engine that trusted that answer would write a byte this
    // file never held. One added newline — from an editor, from git, from a
    // "tidy up on save" — deletes the whole test.
    let bytes = fixture_bytes("single-line-no-line-ending.yml");
    let breaks = bytes
        .iter()
        .filter(|byte| **byte == b'\n' || **byte == b'\r')
        .count();
    println!("single-line-no-line-ending.yml: {breaks} line-break bytes");
    assert_eq!(breaks, 0, "the fixture must hold no line break at all");
    assert_eq!(
        *bytes.last().expect("non-empty file"),
        b'\'',
        "the file must still end with the closing quote"
    );
} // End of function the_single_line_fixture_still_holds_no_line_break_at_all()

#[test]
fn the_synthetic_corpus_covers_every_category_the_plan_requires() {
    // Cheap insurance against a fixture being deleted or renamed without the
    // matching test being updated. The categories come from plan section 11.
    let names: Vec<String> = common::synthetic_valid()
        .iter()
        .map(|file| file.name.clone())
        .collect();

    let required = [
        "scalar-styles.yml",
        "comments-everywhere.yml",
        "blank-lines.yml",
        "anchors-aliases-tags-merge.yml",
        "duplicate-keys.yml",
        "flow-collections.yml",
        "multi-document.yml",
        "crlf-line-endings.yml",
        "bom-utf8.yml",
        "no-trailing-newline.yml",
        "non-ascii.yml",
        "plain-scalar-hazards.yml",
        "block-scalars.yml",
        "unicode-offsets.yml",
        "form-layout-and-choice.yml",
        "variable-chain.yml",
        "html-and-markdown.yml",
        "imports-and-global-vars.yml",
        "config-profile.yml",
        // Added when the Phase 0b-1 review was closed out: three block-scalar
        // shapes neither corpus contained.
        "block-scalar-leading-blank-lines.yml",
        "block-scalar-terminal-spaces.yml",
        "folded-more-indented.yml",
        // Added by Phase 0c-2b's fix round and by Phase 0c-3a: two shapes
        // neither corpus contained, each of which was hiding a real defect.
        "block-scalar-header-tails.yml",
        "empty-entries-and-extents.yml",
        // Added by the Phase 0c-3a review's fix round: a file-owned comment
        // inside a removable collection with mixed line endings, and a document
        // that supplies no line-ending evidence at all.
        "file-comments-and-mixed-endings.yml",
        "single-line-no-line-ending.yml",
        // Added by Phase 0c-3b-1: the two shapes that tell a run-based removal
        // envelope from a contiguous hull — a file-owned comment with blank lines
        // on both sides, and one whose lines would join a block scalar above if
        // they were kept where they are.
        "run-based-removal-envelope.yml",
        // Added by the Phase 0c-3b-1 **review's** fix round, for finding 2: a
        // folded block above a preserved comment at column zero, which R23's
        // column comparison must allow, and an entry-owned leading comment block
        // paired with an interior file comment, which makes a removal envelope
        // start above the entry's own first line.
        "run-based-removal-boundaries.yml",
    ];
    for fixture in required {
        assert!(
            names.iter().any(|name| name.ends_with(fixture)),
            "corpus fixture {fixture} is missing"
        );
    }

    assert!(
        !common::synthetic_invalid().is_empty(),
        "invalid/ must contain deliberately broken fixtures"
    );
} // End of function the_synthetic_corpus_covers_every_category_the_plan_requires()

#[test]
fn non_ascii_fixture_carries_the_characters_the_plan_names() {
    let file = common::synthetic_valid()
        .into_iter()
        .find(|file| file.name.ends_with("non-ascii.yml"))
        .expect("non-ascii.yml");

    for needle in ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡', '⌘', '⌥', '⇧'] {
        assert!(
            file.source.contains(needle),
            "non-ascii.yml must contain {needle}"
        );
    }
    // At least one character outside the Basic Multilingual Plane, where naive
    // UTF-16 offset arithmetic breaks.
    assert!(
        file.source.chars().any(|c| c as u32 > 0xFFFF),
        "non-ascii.yml must contain an astral-plane character"
    );
}
