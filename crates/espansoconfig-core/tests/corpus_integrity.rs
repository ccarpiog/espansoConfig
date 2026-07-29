//! Guards on the corpus itself.
//!
//! Five fixtures exist precisely because they violate what an editor considers
//! tidy: CRLF line endings, a leading UTF-8 BOM, a missing final newline, an
//! unnormalised (NFD) `é`, and deliberate runs of blank lines around block
//! scalars. Editors, formatters, Unicode normalisation and git's own
//! end-of-line conversion all offer to "fix" them, and every one of those fixes
//! silently deletes the test.
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
