//! Phase 0a parser evaluation spike.
//!
//! Compares `saphyr-parser` 0.0.11, `yaml-rust2` 0.11.0 and `marked-yaml` 0.8.0
//! **empirically against the corpus**, on the four criteria named in
//! `IMPLEMENTATION_PLAN.md` section 12, Phase 0:
//!
//! 1. exact end offsets,
//! 2. block scalar header / indent / chomping recovery,
//! 3. comment positions,
//! 4. blank-line attribution.
//!
//! Run it and read the evidence:
//!
//! ```sh
//! cargo test -p espansoconfig-core --test parser_evaluation -- --nocapture
//! ```
//!
//! The write-up is `docs/parser-evaluation.md`. These tests also *assert* every
//! finding, so a crate upgrade that changes one fails the build instead of
//! silently invalidating the design that rests on it.

mod common;

use marked_yaml::types::Node as MarkedNode;
use saphyr_parser::{Event as SaphyrEvent, Parser as SaphyrParser, ScalarStyle, Span};

// ===========================================================================
// Criterion 0 (discovered, and not in the plan's list) — the offset UNIT
// ===========================================================================

/// A document whose second line sits behind a 3-byte character.
///
/// `⌘` is 3 bytes and 1 character, so `b` is at byte 7 and character 5.
const UNIT_PROBE: &str = "a: ⌘\nb: end\n";

#[test]
fn all_three_crates_report_character_offsets_not_byte_offsets() {
    // This is the finding that governs the whole integration. saphyr-parser's
    // `Marker::index` field is documented "The index (in chars)" while its
    // getter says "Return the index (in bytes)". The two contradict each other,
    // so it has to be settled by measurement, and measurement says characters.
    assert_eq!(UNIT_PROBE.find("b: end"), Some(7), "byte offset of `b`");
    assert_eq!(
        UNIT_PROBE.chars().take_while(|c| *c != 'b').count(),
        5,
        "character offset of `b`"
    );

    let saphyr_index = saphyr_scalars(UNIT_PROBE)
        .iter()
        .find(|scalar| scalar.value == "b")
        .expect("`b` key scalar")
        .span
        .start;

    let yaml_rust2_index = yaml_rust2_scalars(UNIT_PROBE)
        .iter()
        .find(|(value, _, _, _)| value == "b")
        .expect("`b` key scalar")
        .1;

    let marked_index = marked_yaml::parse_yaml(0, UNIT_PROBE)
        .expect("valid document")
        .as_mapping()
        .expect("mapping")
        .iter()
        .find(|(key, _)| key.as_str() == "b")
        .expect("`b` key")
        .0
        .span()
        .start()
        .expect("start marker")
        .character();

    println!("\n--- offset units (byte answer would be 7, char answer 5) ---");
    println!("saphyr-parser  Marker::index()      = {saphyr_index}");
    println!("yaml-rust2     Marker::index()      = {yaml_rust2_index}");
    println!("marked-yaml    Marker::character()  = {marked_index}");

    assert_eq!(saphyr_index, 5, "saphyr-parser reports CHARACTER offsets");
    assert_eq!(yaml_rust2_index, 5, "yaml-rust2 reports CHARACTER offsets");
    assert_eq!(marked_index, 5, "marked-yaml reports CHARACTER offsets");
} // End of function all_three_crates_report_character_offsets_not_byte_offsets()

#[test]
fn saphyr_offsets_count_unicode_scalar_values_not_bytes_utf16_units_or_graphemes() {
    // "Characters" is not a definition. `unicode-offsets.yml` is built so that
    // the four candidate schemes disagree about every element after the first:
    //
    //   é   U+00E9            2 bytes · 1 scalar  · 1 UTF-16 unit · 1 grapheme
    //   é   U+0065 U+0301     3 bytes · 2 scalars · 2 UTF-16 units · 1 grapheme
    //   😀  U+1F600           4 bytes · 1 scalar  · 2 UTF-16 units · 1 grapheme
    //
    // so the reported start of `tail` is a different number under each. The
    // whole `CharToByte` adapter is built on the answer.
    let file = corpus_file("unicode-offsets.yml");
    let source = file.source_without_bom();

    // The fixture must not have been normalised on disk or in transit.
    assert!(
        source.contains('\u{00e9}'),
        "the precomposed é must survive"
    );
    assert!(
        source.contains("e\u{0301}"),
        "the decomposed é must still be TWO code points"
    );
    assert!(
        source.contains('\u{1f600}'),
        "the astral emoji must survive"
    );
    assert!(
        source
            .as_bytes()
            .windows(3)
            .any(|window| window == [0x65, 0xcc, 0x81]),
        "the decomposed é must be the bytes 65 cc 81 on disk"
    );

    let scalars = saphyr_scalars(source);
    println!("\n--- offset counting scheme over unicode-offsets.yml ---");
    println!(
        "{:<12} {:>8} {:>8} {:>8} {:>8} {:>8}",
        "token", "reported", "bytes", "scalars", "utf16", "graphemes"
    );

    // Every token whose start the four schemes disagree about.
    let tokens = ["\u{00e9}", "e\u{0301}", "\u{1f600}", "tail", "after", "end"];
    let mut disagreements = 0usize;
    for token in tokens {
        let byte_start = source.find(token).expect("token present in the fixture");
        let byte_end = byte_start + token.len();
        let scalar = scalars
            .iter()
            .find(|scalar| scalar.value == token)
            .unwrap_or_else(|| panic!("saphyr must report a scalar for {token:?}"));

        let predicted: Vec<usize> = CountingScheme::ALL
            .iter()
            .map(|scheme| scheme.position(source, byte_start))
            .collect();
        println!(
            "{:<12} {:>8} {:>8} {:>8} {:>8} {:>8}",
            format!("{token:?}"),
            scalar.span.start,
            predicted[0],
            predicted[1],
            predicted[2],
            predicted[3]
        );

        // THE ANSWER: Unicode scalar values, i.e. exactly Rust's `char`.
        assert_eq!(
            scalar.span.start,
            CountingScheme::UnicodeScalars.position(source, byte_start),
            "start of {token:?} must be a Unicode-scalar-value count"
        );
        assert_eq!(
            scalar.span.end,
            CountingScheme::UnicodeScalars.position(source, byte_end),
            "end of {token:?} must be a Unicode-scalar-value count"
        );

        // And the other three must be *wrong* wherever they differ, so this
        // test cannot pass by coincidence on an all-ASCII prefix.
        for scheme in CountingScheme::ALL {
            if scheme == CountingScheme::UnicodeScalars {
                continue;
            }
            let other = scheme.position(source, byte_start);
            if other != CountingScheme::UnicodeScalars.position(source, byte_start) {
                disagreements += 1;
                assert_ne!(
                    scalar.span.start, other,
                    "{scheme:?} must NOT match the reported start of {token:?}"
                );
            }
        }
    }

    println!("scheme disagreements exercised: {disagreements}");
    assert!(
        disagreements >= 9,
        "the fixture must make all three rival schemes measurably wrong"
    );
} // End of function saphyr_offsets_count_unicode_scalar_values_not_bytes_utf16_units_or_graphemes()

#[test]
fn using_reported_indices_as_byte_offsets_corrupts_the_non_ascii_fixture() {
    // The concrete damage, on a real corpus file rather than a toy. Without a
    // character-to-byte conversion, span surgery on `non-ascii.yml` either
    // panics or silently cuts a multi-byte character in half.
    let file = corpus_file("non-ascii.yml");
    let source = file.source_without_bom();
    let scalars = saphyr_scalars(source);

    let mut naive_wrong = 0;
    let mut converted_ok = 0;
    let table = CharToByte::new(source);
    let mut first_example = None;

    for scalar in &scalars {
        let naive = source.get(scalar.span.start..scalar.span.end);
        let converted = source.get(table.byte(scalar.span.start)..table.byte(scalar.span.end));

        let naive_is_right = naive.is_some_and(|text| Some(text) == converted);
        if !naive_is_right {
            naive_wrong += 1;
            if first_example.is_none() {
                first_example = Some((
                    scalar.value.clone(),
                    naive.map(str::to_owned),
                    converted.map(str::to_owned),
                ));
            }
        }
        if converted.is_some() {
            converted_ok += 1;
        }
    }

    println!("\n--- byte-vs-character slicing over non-ascii.yml ---");
    println!("scalars:                       {}", scalars.len());
    println!("wrong when treated as bytes:   {naive_wrong}");
    println!("correct after char->byte:      {converted_ok}");
    if let Some((value, naive, converted)) = &first_example {
        println!("first divergence: value={value:?}");
        println!("  raw index slice:  {naive:?}");
        println!("  converted slice:  {converted:?}");
    }

    assert!(
        naive_wrong > 0,
        "the fixture must actually exercise the hazard"
    );
    assert_eq!(
        converted_ok,
        scalars.len(),
        "after conversion every span must slice cleanly"
    );
} // End of function using_reported_indices_as_byte_offsets_corrupts_the_non_ascii_fixture()

// ===========================================================================
// Criterion 1 — exact end offsets
// ===========================================================================

/// One scalar of every style, laid out so each value's exact source text is
/// known and can be asserted against the reported span.
const STYLE_PROBE: &str = concat!(
    "plain: hello world\n",
    "single: 'it''s'\n",
    "double: \"a\\tb\"\n",
    "literal: |\n",
    "  one\n",
    "  two\n",
    "strip: |-\n",
    "  no newline\n",
    "keep: |+\n",
    "  kept\n",
    "\n",
    "folded: >-\n",
    "  fold me\n",
);

#[test]
fn saphyr_reports_both_span_endpoints_for_every_scalar_style() {
    let scalars = saphyr_scalars(STYLE_PROBE);
    println!("\n--- saphyr-parser scalar spans over STYLE_PROBE ---");
    for scalar in &scalars {
        println!(
            "{:>13?} {:>3}..{:<3} source={:<24?} value={:?}",
            scalar.style,
            scalar.span.start,
            scalar.span.end,
            &STYLE_PROBE[scalar.span.start..scalar.span.end],
            scalar.value,
        );
    }

    // Every span is non-degenerate AND reproduces the exact source token. Note
    // that STYLE_PROBE puts every key in column 0, which is precisely why the
    // block-scalar overshoot documented below is invisible here: there is no
    // following indentation for the span to run into. See
    // `saphyr_block_scalar_end_offsets_overshoot_into_trailing_trivia`.
    let expected: &[(&str, ScalarStyle, &str)] = &[
        ("plain", ScalarStyle::Plain, "hello world"),
        ("single", ScalarStyle::SingleQuoted, "'it''s'"),
        ("double", ScalarStyle::DoubleQuoted, "\"a\\tb\""),
        ("literal", ScalarStyle::Literal, "one\n  two\n"),
        ("strip", ScalarStyle::Literal, "no newline\n"),
        ("keep", ScalarStyle::Literal, "kept\n\n"),
        ("folded", ScalarStyle::Folded, "fold me\n"),
    ];
    for (key, style, source_text) in expected {
        let scalar = find_after_key(&scalars, key);
        assert!(
            scalar.span.end > scalar.span.start,
            "degenerate span for {key}"
        );
        assert_eq!(scalar.style, *style, "reported style for {key}");
        assert_eq!(
            &STYLE_PROBE[scalar.span.start..scalar.span.end],
            *source_text,
            "span text for {key}"
        );
    }
} // End of function saphyr_reports_both_span_endpoints_for_every_scalar_style()

#[test]
fn saphyr_flow_scalar_spans_cover_the_exact_source_token() {
    // The decisive capability: a span that reproduces the source token exactly,
    // quotes and escapes included, is what makes an in-place value replacement
    // possible without touching a neighbouring byte.
    let scalars = saphyr_scalars(STYLE_PROBE);
    let slice = |scalar: &ProbeScalar| &STYLE_PROBE[scalar.span.start..scalar.span.end];

    let plain = find_after_key(&scalars, "plain");
    assert_eq!(slice(&plain), "hello world");

    let single = find_after_key(&scalars, "single");
    assert_eq!(
        slice(&single),
        "'it''s'",
        "the span includes both quotes and the doubled apostrophe"
    );
    assert_eq!(single.value, "it's");

    let double = find_after_key(&scalars, "double");
    assert_eq!(
        slice(&double),
        "\"a\\tb\"",
        "the span includes the quotes and the raw, undecoded escape"
    );
    assert_eq!(double.value, "a\tb");
} // End of function saphyr_flow_scalar_spans_cover_the_exact_source_token()

#[test]
fn saphyr_flow_scalar_end_offsets_are_exact_across_the_whole_valid_corpus() {
    // Toy documents prove an API exists; the corpus proves it holds. This test
    // covers FLOW scalars only — plain, single-quoted, double-quoted — because
    // those are the ones whose span really is the exact source token. Block
    // scalars are counted separately and asserted in their own test, since
    // their end offsets are NOT exact. An earlier revision of this file folded
    // both groups into one number and gave block scalars the assertion
    // `_ => true`, which is why the overshoot went unnoticed.
    let mut flow_checked = 0usize;
    let mut block_seen = 0usize;
    let mut multiline_plain_skipped = 0usize;
    let mut mismatches: Vec<String> = Vec::new();

    for file in common::synthetic_valid() {
        let source = file.source_without_bom();
        let Some(scalars) = saphyr_scalars_or_none(source) else {
            continue;
        };
        let table = CharToByte::new(source);

        for scalar in &scalars {
            let start = table.byte(scalar.span.start);
            let end = table.byte(scalar.span.end);
            let Some(text) = source.get(start..end) else {
                mismatches.push(format!("{}: span not on char boundary", file.name));
                continue;
            };
            if matches!(scalar.style, ScalarStyle::Literal | ScalarStyle::Folded) {
                block_seen += 1;
                continue;
            }
            // Multi-line plain scalars fold, so their source text legitimately
            // differs from their value; only single-line tokens are asserted.
            if text.contains('\n') && scalar.style == ScalarStyle::Plain {
                multiline_plain_skipped += 1;
                continue;
            }
            let multiline_quoted = text.contains('\n');

            flow_checked += 1;
            let ok = match scalar.style {
                ScalarStyle::Plain => text == scalar.value,
                ScalarStyle::SingleQuoted => {
                    // A multi-line quoted scalar folds, so only the delimiters
                    // are asserted there; the exact-token property is the same
                    // claim either way.
                    text.starts_with('\'')
                        && text.ends_with('\'')
                        && text.len() >= 2
                        && (multiline_quoted
                            || text[1..text.len() - 1].replace("''", "'") == scalar.value)
                }
                ScalarStyle::DoubleQuoted => {
                    text.starts_with('"') && text.ends_with('"') && text.len() >= 2
                }
                ScalarStyle::Literal | ScalarStyle::Folded => unreachable!("filtered above"),
            };
            if !ok {
                mismatches.push(format!(
                    "{}: style {:?} span text {:?} vs value {:?}",
                    file.name, scalar.style, text, scalar.value
                ));
            }
        }
    }

    println!("\n--- corpus-wide FLOW-scalar end-offset check ---");
    println!("flow scalars asserted exact:   {flow_checked}");
    println!("multi-line plain scalars skipped (they fold): {multiline_plain_skipped}");
    println!("block scalars deferred to their own test:     {block_seen}");
    println!("mismatches:                    {}", mismatches.len());
    for line in mismatches.iter().take(10) {
        println!("  {line}");
    }

    assert!(
        flow_checked > 500,
        "the corpus should exercise many flow scalars"
    );
    assert!(
        block_seen > 20,
        "the corpus must exercise block scalars too"
    );
    assert!(
        mismatches.is_empty(),
        "saphyr end offsets must be exact for every flow scalar in the corpus"
    );
} // End of function saphyr_flow_scalar_end_offsets_are_exact_across_the_whole_valid_corpus()

#[test]
fn yaml_rust2_exposes_a_start_marker_only() {
    // yaml-rust2 0.11's public parse result is
    // `Result<(Event, Marker), ScanError>`: one marker, no end. This is a
    // type-level fact and the single reason the crate cannot be the substrate.
    let scalars = yaml_rust2_scalars(STYLE_PROBE);
    println!("\n--- yaml-rust2 scalar markers over STYLE_PROBE ---");
    for (value, index, line, col) in &scalars {
        println!("{value:>14?} index={index:<3} line={line:<2} col={col}");
    }

    assert!(!scalars.is_empty());
    let (_, plain_start, _, _) = scalars
        .iter()
        .find(|(value, _, _, _)| value == "hello world")
        .expect("plain scalar");
    assert_eq!(*plain_start, STYLE_PROBE.find("hello world").unwrap());
    // The marker says where the scalar starts and nothing about where it stops.
    // The only way to obtain an end is to scan forward ourselves, i.e. to write
    // the YAML lexer we were trying to avoid writing.
} // End of function yaml_rust2_exposes_a_start_marker_only()

#[test]
fn marked_yaml_scalar_nodes_carry_no_end_marker() {
    // marked-yaml builds on yaml-rust2 and inherits the same limit: its loader
    // constructs scalar spans with `Span::new_start(mark)`. Collections get an
    // end marker; scalars, the thing we most need to edit, do not.
    let node = marked_yaml::parse_yaml(0, STYLE_PROBE).expect("valid document");
    let mapping = node.as_mapping().expect("top-level mapping");

    println!("\n--- marked-yaml spans over STYLE_PROBE ---");
    let mut with_end = 0;
    let mut total = 0;
    for (key, value) in mapping.iter() {
        println!(
            "key {:>9?} start={:?} end={:?}",
            key.as_str(),
            key.span().start().map(marked_yaml::Marker::character),
            key.span().end().map(marked_yaml::Marker::character),
        );
        total += 1;
        with_end += usize::from(key.span().end().is_some());
        if let MarkedNode::Scalar(scalar) = value {
            total += 1;
            with_end += usize::from(scalar.span().end().is_some());
        }
    }

    assert!(total > 0);
    assert_eq!(
        with_end, 0,
        "marked-yaml reports no end marker for any scalar node"
    );

    let root_end = node.span().end();
    println!("root collection end marker: {root_end:?}");
    assert!(
        root_end.is_some(),
        "collections DO get an end marker; only scalars do not"
    );
} // End of function marked_yaml_scalar_nodes_carry_no_end_marker()

#[test]
fn collection_extents_are_usable_in_saphyr_and_broken_in_marked_yaml() {
    // "Move a whole match" needs the byte extent of one sequence item.
    let source = concat!(
        "matches:\n",
        "  - trigger: :a\n",
        "    replace: alpha\n",
        "\n",
        "  - trigger: :b\n",
    );

    // saphyr: MappingStart/MappingEnd bracket the item. The START is exact.
    // The END overshoots: it lands on the next token, past the blank line.
    let mut starts = Vec::new();
    let mut ends = Vec::new();
    let mut depth = 0usize;
    for item in SaphyrParser::new_from_str(source) {
        let (event, span) = item.expect("parses");
        match event {
            SaphyrEvent::MappingStart(..) => {
                depth += 1;
                if depth == 2 {
                    starts.push(span.start.index());
                }
            }
            SaphyrEvent::MappingEnd => {
                if depth == 2 {
                    ends.push(span.end.index());
                }
                depth -= 1;
            }
            _ => {}
        }
    }

    println!("\n--- collection extents ---");
    for (start, end) in starts.iter().zip(&ends) {
        println!("saphyr item {start}..{end} -> {:?}", &source[*start..*end]);
    }
    assert_eq!(starts[0], source.find("trigger: :a").unwrap());
    let first_item = &source[starts[0]..ends[0]];
    assert!(
        first_item.ends_with("\n\n  ") || first_item.ends_with('\n'),
        "the reported end overshoots into trailing trivia: {first_item:?}"
    );

    // marked-yaml: the item start is off by the length of the first key, so it
    // cannot be used to locate the item at all.
    let node = marked_yaml::parse_yaml(0, source).expect("valid");
    let seq = node
        .as_mapping()
        .unwrap()
        .get("matches")
        .unwrap()
        .as_sequence()
        .unwrap();
    let item_start = seq
        .iter()
        .next()
        .unwrap()
        .span()
        .start()
        .unwrap()
        .character();
    println!(
        "marked-yaml item start = {item_start} (correct answer is {})",
        starts[0]
    );
    assert_ne!(
        item_start, starts[0],
        "marked-yaml's collection start is displaced by the first key"
    );
} // End of function collection_extents_are_usable_in_saphyr_and_broken_in_marked_yaml()

// ===========================================================================
// Criterion 2 — block scalar header, indent and chomping
// ===========================================================================

#[test]
fn saphyr_block_scalar_span_excludes_the_header_but_pins_the_indent() {
    let scalars = saphyr_scalars(STYLE_PROBE);
    let literal = find_after_key(&scalars, "literal");

    let span_text = &STYLE_PROBE[literal.span.start..literal.span.end];
    println!("\n--- saphyr literal block span ---");
    println!(
        "span   {}..{} = {span_text:?}",
        literal.span.start, literal.span.end
    );
    println!("col    {}", literal.start_col);
    println!("value  {:?}", literal.value);

    // The span starts at the first CONTENT character, so the `|` header line is
    // outside it and the first line's indent is outside it too.
    assert!(
        !span_text.starts_with('|'),
        "the header is NOT part of the span"
    );
    assert_eq!(span_text, "one\n  two\n");

    // The content indentation is nevertheless pinned exactly, because the start
    // marker carries a column. That is what lets us reconstruct the true content
    // region as `span.start - col`.
    assert_eq!(literal.start_col, 2, "content indent, in columns");
    let content_region_start = literal.span.start - literal.start_col;
    assert_eq!(
        &STYLE_PROBE[content_region_start..literal.span.end],
        "  one\n  two\n",
        "subtracting the column recovers the full content region"
    );
} // End of function saphyr_block_scalar_span_excludes_the_header_but_pins_the_indent()

#[test]
fn no_parser_exposes_chomping_and_style_alone_cannot_recover_it() {
    // `|`, `|-` and `|+` all report ScalarStyle::Literal. saphyr-parser has an
    // internal `Chomping` enum but its `scanner` module is private
    // (`mod scanner;` in lib.rs), so it is unreachable from outside the crate.
    let scalars = saphyr_scalars(STYLE_PROBE);
    let literal = find_after_key(&scalars, "literal");
    let strip = find_after_key(&scalars, "strip");
    let keep = find_after_key(&scalars, "keep");
    let folded = find_after_key(&scalars, "folded");

    println!("\n--- block styles, values and header text ---");
    for (label, scalar) in [
        ("|", &literal),
        ("|-", &strip),
        ("|+", &keep),
        (">-", &folded),
    ] {
        println!(
            "{label:>3} reported_style={:?} value={:?} header_from_source={:?}",
            scalar.style,
            scalar.value,
            header_before(STYLE_PROBE, scalar)
        );
    }

    assert_eq!(literal.style, ScalarStyle::Literal);
    assert_eq!(strip.style, ScalarStyle::Literal);
    assert_eq!(keep.style, ScalarStyle::Literal);
    assert_eq!(folded.style, ScalarStyle::Folded);

    // The decoded value distinguishes the three only indirectly, and not
    // reliably: `|-` over content ending in "\n" and `|` over the same content
    // are not separable this way.
    assert_eq!(literal.value, "one\ntwo\n");
    assert_eq!(strip.value, "no newline");
    assert_eq!(keep.value, "kept\n\n");

    // The header text IS recoverable, by scanning backwards from the span start
    // to the preceding line break. This is a bounded, one-line lex, not a YAML
    // parser, and it is the division of labour the plan anticipated.
    assert_eq!(header_before(STYLE_PROBE, &literal), "|");
    assert_eq!(header_before(STYLE_PROBE, &strip), "|-");
    assert_eq!(header_before(STYLE_PROBE, &keep), "|+");
    assert_eq!(header_before(STYLE_PROBE, &folded), ">-");
} // End of function no_parser_exposes_chomping_and_style_alone_cannot_recover_it()

#[test]
fn explicit_indentation_indicators_are_recoverable_only_from_the_header_text() {
    // `|2` is the case where content indentation cannot be inferred from the
    // content, because the first content line is deliberately indented further.
    let source = concat!(
        "matches:\n",
        "  - replace: |2\n",
        "        indented first line\n",
        "      back to base\n",
    );
    let scalars = saphyr_scalars(source);
    let block = scalars
        .iter()
        .find(|scalar| scalar.style == ScalarStyle::Literal)
        .expect("literal block");

    println!("\n--- explicit indent indicator ---");
    println!("header     {:?}", header_before(source, block));
    println!("start col  {}", block.start_col);
    println!("value      {:?}", block.value);

    assert_eq!(header_before(source, block), "|2");
    assert_eq!(block.value, "  indented first line\nback to base\n");
    // Nothing in any parser API reports "the indicator was 2". The header text
    // is the only source of that fact.

    // And the indicator itself is OUTSIDE the span, while the two extra columns
    // of first-line indentation — which are scalar content — are INSIDE it.
    let table = CharToByte::new(source);
    let span_text = &source[table.byte(block.span.start)..table.byte(block.span.end)];
    assert!(
        !span_text.contains("|2"),
        "the explicit indentation indicator is not part of the span"
    );
    assert!(
        span_text.starts_with("  indented first line"),
        "the over-indent of the first content line IS part of the span: {span_text:?}"
    );
    assert_eq!(
        block.start_col, 6,
        "the span starts at the DECLARED indent column, not at the first non-space character"
    );
} // End of function explicit_indentation_indicators_are_recoverable_only_from_the_header_text()

#[test]
fn saphyr_block_scalar_end_offsets_overshoot_into_trailing_trivia() {
    // THE CORRECTION. The evaluation used to claim "end offsets exact, every
    // style". That is true for plain, single-quoted and double-quoted scalars.
    // It is FALSE for `Literal` and `Folded`: their reported end is the position
    // of the next non-whitespace character, exactly like a collection end. It
    // therefore swallows every trailing blank line and the indentation of
    // whatever comes next.
    //
    // The old probe never saw it because STYLE_PROBE puts every key in column 0,
    // where the overshoot happens to be zero characters wide.
    let file = corpus_file("block-scalars.yml");
    let source = file.source_without_bom();
    let blocks = block_scalars(source);
    assert_eq!(blocks.len(), 11, "the fixture must cover the whole matrix");

    println!("\n--- block-scalar span vs true content end ---");
    println!(
        "{:<8} {:>7} {:>9} {:>9} {:<24} {:?}",
        "header", "indent", "span_end", "true_end", "overshoot", "value tail"
    );

    let mut overshooting = 0usize;
    for block in &blocks {
        let overshoot = &source[block.content_end..block.span_end];
        println!(
            "{:<8} {:>7} {:>9} {:>9} {:<24?} {:?}",
            block.header.text,
            block.indent,
            block.span_end,
            block.content_end,
            overshoot,
            block.value.chars().rev().take(6).collect::<String>()
        );

        // 1. The header is never inside the span.
        let span_text = &source[block.span_start..block.span_end];
        assert!(
            !span_text.starts_with(['|', '>']),
            "header {:?} leaked into the span",
            block.header.text
        );
        // 2. The overshoot is whitespace only: a block scalar span never
        //    swallows a comment, because scanning stops at the first
        //    non-whitespace character.
        assert!(
            overshoot.chars().all(char::is_whitespace),
            "overshoot {overshoot:?} after header {:?} must be whitespace",
            block.header.text
        );
        if !overshoot.is_empty() {
            overshooting += 1;
        }
        // 3. The reconstructed content region decodes to the parser's own
        //    value. This is what makes the true end *provably* the true end.
        let reconstructed =
            reconstruct_block_value(source, block).expect("corpus folding stays simple");
        assert_eq!(
            reconstructed, block.value,
            "reconstruction of header {:?} at {}..{}",
            block.header.text, block.span_start, block.content_end
        );
    }

    println!(
        "block scalars whose reported end overshoots: {overshooting}/{}",
        blocks.len()
    );
    assert!(
        overshooting >= 11,
        "the overshoot is the rule, not an edge case"
    );
} // End of function saphyr_block_scalar_end_offsets_overshoot_into_trailing_trivia()

#[test]
fn block_scalar_terminal_newlines_are_decided_by_chomping_not_by_the_span() {
    // The span contains ALL the trailing line breaks regardless of chomping.
    // How many of them belong to the value — and therefore where the next key
    // or comment begins — is knowable only from the header. Each row below is
    // the exact source text of the span, the exact value, and the exact trivia
    // the gap scanner must recover.
    let file = corpus_file("block-scalars.yml");
    let source = file.source_without_bom();
    let blocks = block_scalars(source);

    let by_trigger = |header: &str, nth: usize| -> BlockScalar {
        blocks
            .iter()
            .filter(|block| block.header.text == header)
            .nth(nth)
            .unwrap_or_else(|| panic!("no block with header {header:?} at index {nth}"))
            .clone()
    };

    println!("\n--- chomping decides the terminal newlines ---");
    let cases: &[(&str, usize, Chomping, &str, &str, &str)] = &[
        // header, nth, chomping, span text, value, trivia after the content
        (
            "|",
            0,
            Chomping::Clip,
            "clip line one\n      clip line two\n\n\n    ",
            "clip line one\nclip line two\n",
            "\n\n    ",
        ),
        (
            "|-",
            0,
            Chomping::Strip,
            "stripped\n    ",
            "stripped",
            "\n    ",
        ),
        (
            "|+",
            0,
            Chomping::Keep,
            "kept\n\n\n    ",
            "kept\n\n\n",
            "    ",
        ),
        (
            ">",
            0,
            Chomping::Clip,
            "folded clip\n    ",
            "folded clip\n",
            "    ",
        ),
        (
            ">-",
            0,
            Chomping::Strip,
            "folded strip\n    ",
            "folded strip",
            "\n    ",
        ),
        (
            ">+",
            0,
            Chomping::Keep,
            "folded keep\n\n    ",
            "folded keep\n\n",
            "    ",
        ),
        (
            "|2-",
            0,
            Chomping::Strip,
            "  four-space first line\n      two-space second line\n    ",
            "  four-space first line\ntwo-space second line",
            "\n    ",
        ),
        (
            "|2+",
            0,
            Chomping::Keep,
            "  four-space first line\n\n    ",
            "  four-space first line\n\n",
            "    ",
        ),
    ];

    for (header, nth, chomping, span_text, value, trivia) in cases {
        let block = by_trigger(header, *nth);
        println!(
            "{:<4} chomping={:?} span={:?} value={:?} trivia={:?}",
            header, block.header.chomping, span_text, value, trivia
        );
        assert_eq!(block.header.chomping, *chomping, "chomping of {header}");
        assert_eq!(
            &source[block.span_start..block.span_end],
            *span_text,
            "reported span text of {header}"
        );
        assert_eq!(block.value, *value, "decoded value of {header}");
        assert_eq!(
            &source[block.content_end..block.span_end],
            *trivia,
            "trivia the gap scanner must recover after {header}"
        );
    }

    // The explicit indentation indicator is parsed out of the header, and the
    // parser never reports it.
    assert_eq!(by_trigger("|2-", 0).header.explicit_indent, Some(2));
    assert_eq!(by_trigger("|2+", 0).header.explicit_indent, Some(2));
    assert_eq!(by_trigger("|", 0).header.explicit_indent, None);
} // End of function block_scalar_terminal_newlines_are_decided_by_chomping_not_by_the_span()

#[test]
fn a_blank_line_inside_a_block_scalar_stays_inside_the_span() {
    // The hazard the review named: a blank line can be scalar CONTENT. If the
    // trivia scanner ever recovers one of these as a document blank line, the
    // value has been corrupted. Both fixtures that contain one are checked.
    println!("\n--- blank lines that are block-scalar content ---");
    let mut checked = 0usize;

    for name in ["block-scalars.yml", "blank-lines.yml"] {
        let file = corpus_file(name);
        let source = file.source_without_bom();
        for block in block_scalars(source) {
            if !block.value.contains("\n\n") {
                continue;
            }
            // Find the interior blank line: the first empty line that is
            // followed by more content within the value.
            let content = &source[block.span_start..block.content_end];
            let Some(interior) = content.find("\n\n") else {
                continue;
            };
            let trailing_only = content[interior..]
                .trim_matches(['\n', '\r', ' '])
                .is_empty();
            if trailing_only {
                continue;
            }
            let offset = block.span_start + interior + 1;
            println!(
                "{name}: interior blank line at byte {offset}, inside span {}..{}",
                block.span_start, block.content_end
            );
            assert!(
                (block.span_start..block.content_end).contains(&offset),
                "an interior blank line must be inside the scalar's content region"
            );
            assert!(
                source[offset..offset + 1].starts_with('\n'),
                "the offset must really point at an empty line"
            );
            checked += 1;
        }
    }

    println!("interior blank lines pinned: {checked}");
    assert!(
        checked >= 2,
        "both fixtures must contribute a content blank line"
    );
} // End of function a_blank_line_inside_a_block_scalar_stays_inside_the_span()

#[test]
fn a_blank_line_inside_a_multiline_quoted_scalar_stays_inside_the_span() {
    // The same hazard in the other direction: a single- or double-quoted scalar
    // may span source lines and contain a blank one. Because the reported span
    // covers the complete quoted token, that blank line is inside a leaf span
    // and can never be mistaken for document trivia by a gap scanner.
    let file = corpus_file("scalar-styles.yml");
    let source = file.source_without_bom();
    let scalars = saphyr_scalars(source);
    let table = CharToByte::new(source);
    let frontier = frontier_spans(source, Frontier::TrimmedLeaves).expect("parses");
    let gaps = uncovered_gaps(source, &frontier);

    println!("\n--- blank lines inside multi-line quoted scalars ---");
    let mut checked = 0usize;
    for scalar in &scalars {
        if !matches!(
            scalar.style,
            ScalarStyle::SingleQuoted | ScalarStyle::DoubleQuoted
        ) {
            continue;
        }
        let start = table.byte(scalar.span.start);
        let end = table.byte(scalar.span.end);
        let text = &source[start..end];
        let Some(blank) = text.find("\n\n") else {
            continue;
        };
        let offset = start + blank + 1;
        println!(
            "{:?} scalar {start}..{end}, interior blank line at byte {offset}",
            scalar.style
        );

        assert!(
            text.starts_with(['\'', '"']) && text.ends_with(['\'', '"']),
            "the span must cover the complete quoted token: {text:?}"
        );
        assert!(
            (start..end).contains(&offset),
            "the blank line must be inside the scalar's span"
        );
        assert!(
            !gaps.iter().any(|(from, to)| (*from..*to).contains(&offset)),
            "the blank line must NOT appear in any gap the trivia scanner owns"
        );
        checked += 1;
    }

    println!("multi-line quoted scalars with an interior blank line: {checked}");
    assert_eq!(
        checked, 2,
        "the fixture must carry one single-quoted and one double-quoted case"
    );
} // End of function a_blank_line_inside_a_multiline_quoted_scalar_stays_inside_the_span()

#[test]
fn every_block_scalar_in_the_corpus_reconstructs_from_span_indent_and_header() {
    // The corpus-wide version of the block-scalar claim, and the honest
    // replacement for the `_ => true` that used to count block scalars towards
    // the headline "scalars checked" figure without asserting anything.
    let mut checked = 0usize;
    let mut overshooting = 0usize;
    let mut folded_skipped = 0usize;
    let mut failures: Vec<String> = Vec::new();

    println!("\n--- block scalars reconstructed across the valid corpus ---");
    for file in common::synthetic_valid() {
        let source = file.source_without_bom();
        let blocks = block_scalars(source);
        if blocks.is_empty() {
            continue;
        }
        for block in &blocks {
            let span_text = &source[block.span_start..block.span_end];
            if span_text.starts_with(['|', '>']) {
                failures.push(format!("{}: header inside the span", file.name));
            }
            let overshoot = &source[block.content_end..block.span_end];
            if !overshoot.chars().all(char::is_whitespace) {
                failures.push(format!(
                    "{}: overshoot {overshoot:?} is not trivia",
                    file.name
                ));
            }
            if !overshoot.is_empty() {
                overshooting += 1;
            }
            match reconstruct_block_value(source, block) {
                Some(reconstructed) if reconstructed == block.value => checked += 1,
                Some(reconstructed) => failures.push(format!(
                    "{}: header {:?} reconstructed {reconstructed:?} but parser said {:?}",
                    file.name, block.header.text, block.value
                )),
                None => folded_skipped += 1,
            }
        }
        println!("{:<40} {} block scalars", file.name, blocks.len());
    }

    println!("block scalars reconstructed byte-exactly: {checked}");
    println!("of those, spans that overshoot:           {overshooting}");
    println!("folded scalars with more-indented lines:  {folded_skipped}");
    for failure in failures.iter().take(10) {
        println!("  {failure}");
    }

    assert!(checked >= 30, "the corpus must exercise many block scalars");
    assert_eq!(
        folded_skipped, 0,
        "no corpus folded scalar needs the escape hatch"
    );
    assert!(
        failures.is_empty(),
        "every block scalar must reconstruct from (span, col, header)"
    );
} // End of function every_block_scalar_in_the_corpus_reconstructs_from_span_indent_and_header()

// ===========================================================================
// Criterion 3 — comment positions
// ===========================================================================

#[test]
fn no_parser_reports_comments_at_all() {
    let file = corpus_file("comments-everywhere.yml");
    let source = file.source_without_bom();

    let comment_lines = source
        .lines()
        .filter(|line| line.trim_start().starts_with('#'))
        .count();
    assert!(comment_lines >= 10, "the fixture must be comment-heavy");

    let mut saphyr_events = 0usize;
    let mut saphyr_mentions = 0usize;
    for item in SaphyrParser::new_from_str(source) {
        let (event, _) = item.expect("comments-everywhere.yml parses");
        saphyr_events += 1;
        if format!("{event:?}").contains("Comment") {
            saphyr_mentions += 1;
        }
    }

    let yaml_rust2_mentions = yaml_rust2_scalars(source)
        .iter()
        .filter(|(value, _, _, _)| value.contains("Comment"))
        .count();

    let marked = marked_yaml::parse_yaml(0, source).expect("valid document");
    let marked_mentions = format!("{marked:?}").matches("Comment").count();

    println!("\n--- comment exposure ---");
    println!("comment lines in the fixture: {comment_lines}");
    println!("saphyr-parser events:         {saphyr_events} (comment-bearing: {saphyr_mentions})");
    println!("yaml-rust2:                   comment-bearing: {yaml_rust2_mentions}");
    println!("marked-yaml node tree:        comment-bearing: {marked_mentions}");

    assert_eq!(saphyr_mentions, 0, "saphyr-parser discards comments");
    assert_eq!(yaml_rust2_mentions, 0, "yaml-rust2 discards comments");
    assert_eq!(marked_mentions, 0, "marked-yaml discards comments");
} // End of function no_parser_reports_comments_at_all()

// ===========================================================================
// Criterion 4 — blank-line attribution, and what the gaps actually contain
// ===========================================================================

#[test]
fn saphyr_spans_do_not_nest_so_no_frontier_choice_can_lose_a_comment_inside_one() {
    // The review's first objection: parser spans normally nest, so a comment can
    // lie inside a mapping's span while being between two child spans, and
    // "the complement of all reported spans" would lose it.
    //
    // Measured answer for saphyr-parser 0.0.11: **its spans do not nest.**
    // Collection events are positional markers, not extents:
    //   - block MappingStart/End and SequenceStart/End are ZERO width;
    //   - flow ones cover exactly one bracket character;
    //   - DocumentStart/End are zero width, or exactly the 3 bytes of `---`/`...`;
    //   - StreamStart/End are always zero width.
    // So no non-leaf span contains a leaf span, anywhere in the corpus.
    println!("\n--- do non-leaf spans enclose leaf spans? ---");
    let mut enclosing = 0usize;
    let mut widest_collection = 0usize;
    let mut widest_document = 0usize;
    let mut files = 0usize;

    for file in common::synthetic_valid() {
        let source = file.source_without_bom();
        let table = CharToByte::new(source);
        let mut leaves: Vec<(usize, usize)> = Vec::new();
        let mut others: Vec<(usize, usize)> = Vec::new();
        let mut parsed = true;

        for item in SaphyrParser::new_from_str(source) {
            let Ok((event, span)) = item else {
                parsed = false;
                break;
            };
            let range = (table.byte(span.start.index()), table.byte(span.end.index()));
            let width = range.1 - range.0;
            match event {
                SaphyrEvent::Scalar(..) | SaphyrEvent::Alias(..) => leaves.push(range),
                SaphyrEvent::MappingStart(..)
                | SaphyrEvent::MappingEnd
                | SaphyrEvent::SequenceStart(..)
                | SaphyrEvent::SequenceEnd => {
                    widest_collection = widest_collection.max(width);
                    others.push(range);
                }
                SaphyrEvent::DocumentStart(..) | SaphyrEvent::DocumentEnd => {
                    widest_document = widest_document.max(width);
                    others.push(range);
                }
                _ => others.push(range),
            }
        }
        if !parsed {
            continue;
        }
        files += 1;

        for (outer_start, outer_end) in &others {
            if outer_end == outer_start {
                continue;
            }
            for (leaf_start, leaf_end) in &leaves {
                if leaf_end > leaf_start && outer_start <= leaf_start && leaf_end <= outer_end {
                    enclosing += 1;
                    println!(
                        "  {} {outer_start}..{outer_end} encloses leaf {leaf_start}..{leaf_end}",
                        file.name
                    );
                }
            }
        }
    }

    println!("fixtures measured:                       {files}");
    println!("non-leaf spans enclosing a leaf span:    {enclosing}");
    println!("widest collection marker (a flow bracket): {widest_collection}");
    println!("widest document marker (`---` / `...`):    {widest_document}");

    assert!(files >= 17);
    assert_eq!(
        enclosing, 0,
        "saphyr collection events are positional markers, not enclosing extents"
    );
    assert_eq!(
        widest_collection, 1,
        "the widest collection marker is one flow bracket character"
    );
    assert_eq!(
        widest_document, 3,
        "the widest document marker is `---` or `...`"
    );
} // End of function saphyr_spans_do_not_nest_so_no_frontier_choice_can_lose_a_comment_inside_one()

#[test]
fn the_two_frontier_definitions_differ_only_in_fragmentation_on_comments_everywhere() {
    // The concrete demonstration the review asked for, with the honest result:
    // on `comments-everywhere.yml` the naive "complement of all reported spans"
    // definition does NOT drop a comment, because saphyr's collection markers
    // are zero-width. The two definitions cover exactly the same bytes; the
    // all-spans version merely chops the gaps into more pieces at each marker.
    let file = corpus_file("comments-everywhere.yml");
    let source = file.source_without_bom();

    let all = frontier_spans(source, Frontier::Everything).expect("parses");
    let leaf = frontier_spans(source, Frontier::Leaves).expect("parses");
    let all_gaps = uncovered_gaps(source, &all);
    let leaf_gaps = uncovered_gaps(source, &leaf);

    let all_covered = covered_bytes(source, &all);
    let leaf_covered = covered_bytes(source, &leaf);
    let extra: Vec<usize> = (0..source.len())
        .filter(|byte| all_covered[*byte] && !leaf_covered[*byte])
        .collect();

    let (all_comments, all_blanks) = trivia_in_gaps(source, &all_gaps);
    let (leaf_comments, leaf_blanks) = trivia_in_gaps(source, &leaf_gaps);

    println!("\n--- frontier definitions on comments-everywhere.yml ---");
    println!(
        "all spans : {:>3} spans, {:>2} gap segments, {all_comments} comments, {all_blanks} blanks",
        all.len(),
        all_gaps.len()
    );
    println!(
        "leaf spans: {:>3} spans, {:>2} gap segments, {leaf_comments} comments, {leaf_blanks} blanks",
        leaf.len(),
        leaf_gaps.len()
    );
    println!(
        "bytes covered by all-spans but not leaf-spans: {}",
        extra.len()
    );

    assert!(
        extra.is_empty(),
        "on this fixture the two frontiers cover exactly the same bytes"
    );
    assert_eq!(
        all_comments, leaf_comments,
        "NO comment is dropped by the naive complement-of-all-spans definition"
    );

    // But the definitions are still not interchangeable. The all-spans frontier
    // splits gaps at every zero-width collection marker, and those splits land
    // in the MIDDLE of a line — so a per-gap line scan over-counts blank lines.
    // That fragmentation, not a lost comment, is the measurable difference.
    assert_eq!(
        (all_gaps.len(), leaf_gaps.len()),
        (18, 15),
        "the all-spans frontier fragments the gaps at every zero-width marker"
    );
    assert_eq!(
        (all_blanks, leaf_blanks),
        (16, 13),
        "fragmentation makes a per-gap line scan over-count blank lines"
    );
    let fragmented = all_gaps
        .iter()
        .filter(|(start, _)| !source[..*start].ends_with('\n') && *start > 0)
        .count();
    println!("gap segments starting mid-line under the all-spans frontier: {fragmented}");
    assert!(
        fragmented > 0,
        "at least one split must land inside a line, which is what causes the over-count"
    );

    // Corpus-wide, the only bytes the all-spans frontier claims and the
    // leaf-spans frontier does not are flow brackets and document markers —
    // never a comment character and never a line break.
    let mut extra_characters: Vec<char> = Vec::new();
    for file in common::synthetic_valid() {
        let source = file.source_without_bom();
        let (Some(all), Some(leaf)) = (
            frontier_spans(source, Frontier::Everything),
            frontier_spans(source, Frontier::Leaves),
        ) else {
            continue;
        };
        let all_covered = covered_bytes(source, &all);
        let leaf_covered = covered_bytes(source, &leaf);
        for (byte, character) in source.char_indices() {
            if all_covered[byte] && !leaf_covered[byte] {
                extra_characters.push(character);
            }
        }
    }
    extra_characters.sort_unstable();
    extra_characters.dedup();
    println!("corpus-wide, all-spans claims these extra characters: {extra_characters:?}");
    assert_eq!(
        extra_characters,
        vec!['-', '.', '[', ']', '{', '}'],
        "only flow brackets and document markers"
    );
} // End of function the_two_frontier_definitions_differ_only_in_fragmentation_on_comments_everywhere()

#[test]
fn the_frontier_must_be_leaf_spans_with_block_scalar_ends_trimmed() {
    // The real frontier hazard is not nesting: it is the block-scalar overshoot.
    // A `|` (clip) block followed by blank lines reports a span that swallows
    // them, even though clip chomping means they are document trivia. The
    // untrimmed leaf frontier therefore LOSES them; the trimmed one does not.
    let file = corpus_file("block-scalars.yml");
    let source = file.source_without_bom();

    let raw = frontier_spans(source, Frontier::Leaves).expect("parses");
    let trimmed = frontier_spans(source, Frontier::TrimmedLeaves).expect("parses");
    let raw_gaps = uncovered_gaps(source, &raw);
    let trimmed_gaps = uncovered_gaps(source, &trimmed);
    let (raw_comments, raw_blanks) = trivia_in_gaps(source, &raw_gaps);
    let (trimmed_comments, trimmed_blanks) = trivia_in_gaps(source, &trimmed_gaps);

    println!("\n--- untrimmed vs trimmed leaf frontier on block-scalars.yml ---");
    println!("untrimmed leaf spans: {raw_comments} comments, {raw_blanks} blank lines");
    println!("trimmed   leaf spans: {trimmed_comments} comments, {trimmed_blanks} blank lines");

    assert!(
        trimmed_blanks > raw_blanks,
        "trimming the block-scalar overshoot must recover blank lines the raw frontier loses"
    );
    assert_eq!(
        trimmed_comments, raw_comments,
        "no comment is ever inside a block-scalar span, so comment recovery is unaffected"
    );

    // The specific bytes: the two blank lines after the `|` (clip) block are
    // trivia by YAML's own rules, yet they sit inside the reported span.
    let clip = block_scalars(source)
        .into_iter()
        .find(|block| block.header.text == "|" && block.value.starts_with("clip line one"))
        .expect("the clip block");
    let lost = &source[clip.content_end..clip.span_end];
    println!("bytes the untrimmed frontier loses after the clip block: {lost:?}");
    assert_eq!(lost, "\n\n    ");
    assert!(
        (clip.content_end..clip.span_end).contains(&(clip.content_end + 1)),
        "the blank lines really are inside the reported span"
    );
} // End of function the_frontier_must_be_leaf_spans_with_block_scalar_ends_trimmed()

#[test]
fn every_comment_and_blank_line_falls_inside_a_gap_between_trimmed_leaf_spans() {
    // The constructive result, restated against the frontier definition the
    // three tests above establish: leaf spans (`Scalar` and `Alias`), with every
    // block-scalar end trimmed to its true content end.
    println!("\n--- gap analysis across the valid corpus (trimmed leaf frontier) ---");
    println!(
        "{:<38} {:>6} {:>6} {:>9} {:>8}",
        "fixture", "spans", "gaps", "comments", "blanks"
    );

    let mut total_comments = 0usize;
    let mut total_blanks = 0usize;
    let mut total_untrimmed_blanks = 0usize;

    for file in common::synthetic_valid() {
        let source = file.source_without_bom();
        let Some(spans) = frontier_spans(source, Frontier::TrimmedLeaves) else {
            println!("{:<38} (parser rejected)", file.name);
            continue;
        };
        let gaps = uncovered_gaps(source, &spans);
        let (comments, blanks) = trivia_in_gaps(source, &gaps);
        total_comments += comments;
        total_blanks += blanks;

        let raw = frontier_spans(source, Frontier::Leaves).expect("already parsed");
        let (_, raw_blanks) = trivia_in_gaps(source, &uncovered_gaps(source, &raw));
        total_untrimmed_blanks += raw_blanks;

        println!(
            "{:<38} {:>6} {:>6} {:>9} {:>8}",
            file.name,
            spans.len(),
            gaps.len(),
            comments,
            blanks
        );
    }

    println!("\ntotal comments recoverable from gaps: {total_comments}");
    println!("total blank lines recoverable:        {total_blanks}");
    println!("same, without trimming block spans:   {total_untrimmed_blanks}");
    assert!(
        total_comments > 30,
        "comments must be recoverable from gaps"
    );
    assert!(
        total_blanks > 20,
        "blank lines must be recoverable from gaps"
    );
    assert!(
        total_blanks > total_untrimmed_blanks,
        "trimming must strictly improve blank-line recovery"
    );
} // End of function every_comment_and_blank_line_falls_inside_a_gap_between_trimmed_leaf_spans()

#[test]
fn blank_line_runs_survive_in_the_gaps_although_no_parser_reports_them() {
    let file = corpus_file("blank-lines.yml");
    let source = file.source_without_bom();
    let scalars = saphyr_scalars(source);
    let table = CharToByte::new(source);
    let spans: Vec<(usize, usize)> = scalars
        .iter()
        .map(|scalar| (table.byte(scalar.span.start), table.byte(scalar.span.end)))
        .collect();
    let gaps = uncovered_gaps(source, &spans);

    let mut longest_run = 0usize;
    for (start, end) in &gaps {
        let mut run = 0usize;
        for line in source[*start..*end].lines() {
            if line.trim().is_empty() {
                run += 1;
                longest_run = longest_run.max(run);
            } else {
                run = 0;
            }
        }
    }

    println!("\n--- blank-line attribution over blank-lines.yml ---");
    println!("gaps between spans:      {}", gaps.len());
    println!("longest blank-line run:  {longest_run}");
    assert!(
        longest_run >= 3,
        "the deliberate run of 3 blank lines must be visible in the gaps"
    );
    // No parser event says "there were three blank lines here". The information
    // exists only as bytes nobody consumed.
} // End of function blank_line_runs_survive_in_the_gaps_although_no_parser_reports_them()

// ===========================================================================
// Corpus-wide coverage and error reporting
// ===========================================================================

#[test]
fn every_valid_synthetic_fixture_is_probed_by_all_three_parsers() {
    println!("\n--- corpus-wide parser results ---");
    println!(
        "{:<38} {:>8} {:>11} {:>12}",
        "fixture", "saphyr", "yaml-rust2", "marked-yaml"
    );

    let files = common::synthetic_valid();
    let (mut saphyr_ok, mut yaml_rust2_ok, mut marked_ok) = (0, 0, 0);
    let mut yaml_rust2_rejected = Vec::new();
    let mut marked_rejected = Vec::new();

    for file in &files {
        let source = file.source_without_bom();
        let saphyr = saphyr_scalars_or_none(source).is_some();
        let yaml_rust2 = yaml_rust2::YamlLoader::load_from_str(source);
        let marked = marked_yaml::parse_yaml(0, source);

        saphyr_ok += usize::from(saphyr);
        yaml_rust2_ok += usize::from(yaml_rust2.is_ok());
        marked_ok += usize::from(marked.is_ok());

        if let Err(error) = &yaml_rust2 {
            yaml_rust2_rejected.push(format!("{}: {error}", file.name));
        }
        if let Err(error) = &marked {
            marked_rejected.push(format!("{}: {error}", file.name));
        }

        println!(
            "{:<38} {:>8} {:>11} {:>12}",
            file.name,
            if saphyr { "ok" } else { "ERR" },
            if yaml_rust2.is_ok() { "ok" } else { "ERR" },
            if marked.is_ok() { "ok" } else { "ERR" }
        );
    }

    println!(
        "\ntotals over {} fixtures: saphyr={saphyr_ok} yaml-rust2={yaml_rust2_ok} marked-yaml={marked_ok}",
        files.len()
    );
    for line in &yaml_rust2_rejected {
        println!("yaml-rust2 rejected  {line}");
    }
    for line in &marked_rejected {
        println!("marked-yaml rejected {line}");
    }

    assert!(!files.is_empty(), "the synthetic corpus must not be empty");
    assert_eq!(
        saphyr_ok,
        files.len(),
        "saphyr-parser must handle the whole valid corpus"
    );
    // Two concrete capability gaps, pinned so an upgrade that closes them is
    // noticed: yaml-rust2's loader refuses duplicate keys outright, and
    // marked-yaml refuses anchors. The owner's config uses both patterns.
    assert!(
        yaml_rust2_rejected
            .iter()
            .any(|line| line.contains("duplicate-keys")),
        "yaml-rust2's YamlLoader rejects duplicate mapping keys"
    );
    assert!(
        marked_rejected
            .iter()
            .any(|line| line.contains("anchors-aliases")),
        "marked-yaml rejects anchor definitions"
    );
} // End of function every_valid_synthetic_fixture_is_probed_by_all_three_parsers()

#[test]
fn the_bom_is_not_stripped_by_any_parser_and_leaks_into_the_first_token() {
    // Discovered while probing: no parser strips the BOM, so with it left in
    // place the first scalar's value is "\u{feff}matches" rather than
    // "matches". Stripping it before parsing, and recording that it was there
    // so it can be written back, is therefore our job.
    println!("\n--- BOM handling ---");
    let leaked = saphyr_scalars("\u{feff}matches: []\n");
    let first = leaked.first().expect("at least one scalar");
    println!(
        "BOM immediately before a key -> first scalar {:?}",
        first.value
    );
    assert!(
        first.value.starts_with('\u{feff}'),
        "the BOM leaks into the first scalar's value"
    );
    let stripped = saphyr_scalars("matches: []\n");
    assert_eq!(stripped[0].value, "matches");

    // Worse: when the BOM precedes a comment, as it does in the corpus fixture,
    // the document is rejected outright rather than merely mis-decoded. The
    // BOM is not a comment introducer, so `\u{feff}#…` scans as a plain scalar
    // and the rest of the file no longer makes sense.
    let file = corpus_file("bom-utf8.yml");
    assert!(file.has_bom(), "the fixture must actually carry a BOM");
    assert!(
        saphyr_scalars_or_none(&file.source).is_none(),
        "a BOM before a comment breaks the parse entirely"
    );
    println!("BOM before a comment line -> parse REJECTED");

    // Stripping the BOM first makes the same file parse cleanly. This is not
    // optional cleanup; it is a correctness requirement.
    let fixture_first = saphyr_scalars(file.source_without_bom())[0].value.clone();
    println!("same file with the BOM stripped -> first scalar {fixture_first:?}");
    assert_eq!(fixture_first, "matches");
} // End of function the_bom_is_not_stripped_by_any_parser_and_leaks_into_the_first_token()

#[test]
fn crlf_documents_keep_consistent_offsets() {
    // CR counts as one character, so the character-to-byte table stays valid and
    // spans still slice correctly. Worth pinning: a parser that silently
    // normalised CRLF would make every offset after line 1 wrong.
    let file = corpus_file("crlf-line-endings.yml");
    let source = file.source_without_bom();
    assert!(source.contains("\r\n"), "the fixture must actually be CRLF");

    let scalars = saphyr_scalars(source);
    let table = CharToByte::new(source);
    let mut checked = 0usize;
    for scalar in &scalars {
        if scalar.style != ScalarStyle::Plain {
            continue;
        }
        let text = &source[table.byte(scalar.span.start)..table.byte(scalar.span.end)];
        if text.contains('\n') {
            continue;
        }
        assert_eq!(text, scalar.value, "CRLF offsets must stay exact");
        checked += 1;
    }
    println!("\n--- CRLF offsets ---");
    println!("plain scalars verified byte-exact: {checked}");
    assert!(checked > 3);
} // End of function crlf_documents_keep_consistent_offsets()

#[test]
fn invalid_fixtures_are_rejected_with_a_located_error() {
    println!("\n--- error reporting on invalid/ ---");
    let files = common::synthetic_invalid();
    assert!(!files.is_empty(), "invalid/ must not be empty");

    let mut rejected = 0usize;
    for file in &files {
        let source = file.source_without_bom();
        let mut error = None;
        for item in SaphyrParser::new_from_str(source) {
            if let Err(scan_error) = item {
                error = Some(scan_error);
                break;
            }
        }
        match &error {
            Some(scan_error) => {
                rejected += 1;
                println!(
                    "{:<38} rejected at char {} line {}",
                    file.name,
                    scan_error.marker().index(),
                    scan_error.marker().line()
                );
            }
            None => println!(
                "{:<38} accepted by the tokenizer (compose-level error only)",
                file.name
            ),
        }
    }
    assert!(
        rejected >= files.len() - 1,
        "most invalid fixtures should fail at the parse level, with a location"
    );
} // End of function invalid_fixtures_are_rejected_with_a_located_error()

// ===========================================================================
// Criterion 5 (from the review) — incomplete editor states
// ===========================================================================

/// What the parser did with a half-written document.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum IncompleteOutcome {
    /// Rejected, with a marker that can drive a UI.
    CleanErrorWithLocation,
    /// Accepted. The spans that came out may still be misleading.
    AcceptedWithSpans,
    /// Crashed. In a desktop editor this is a crash in the shipping app.
    Panicked,
}

/// Parses `source`, catching a panic, and classifies the outcome.
///
/// Returns the events (as `start..end kind` strings) and the error location, so
/// a caller can assert on the partial spans as well as the outcome.
fn parse_incomplete(source: &str) -> (IncompleteOutcome, Vec<(usize, usize)>, Option<String>) {
    let owned = source.to_owned();
    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let result = std::panic::catch_unwind(move || {
        let mut spans = Vec::new();
        let mut error = None;
        for item in SaphyrParser::new_from_str(&owned) {
            match item {
                Ok((_, span)) => spans.push((span.start.index(), span.end.index())),
                Err(scan_error) => {
                    error = Some(format!(
                        "char {} line {} col {}",
                        scan_error.marker().index(),
                        scan_error.marker().line(),
                        scan_error.marker().col()
                    ));
                    break;
                }
            }
        }
        (spans, error)
    });
    std::panic::set_hook(previous_hook);

    match result {
        Err(_) => (IncompleteOutcome::Panicked, Vec::new(), None),
        Ok((spans, Some(error))) => (
            IncompleteOutcome::CleanErrorWithLocation,
            spans,
            Some(error),
        ),
        Ok((spans, None)) => (IncompleteOutcome::AcceptedWithSpans, spans, None),
    }
} // End of function parse_incomplete()

#[test]
fn incomplete_editor_states_fail_cleanly_and_never_panic() {
    // A desktop editor sees YAML mid-keystroke on every character typed. The
    // question is not whether these parse — they must not — but whether the
    // failure is usable and, above all, whether it is a panic. A panic here
    // would be a crash in the shipping app.
    let cases: &[(&str, &str, IncompleteOutcome)] = &[
        (
            "unterminated double quote",
            "key: \"unfinished\n",
            IncompleteOutcome::CleanErrorWithLocation,
        ),
        (
            "unterminated single quote",
            "key: 'unfinished\n",
            IncompleteOutcome::CleanErrorWithLocation,
        ),
        (
            "half-written flow sequence",
            "items: [a, \n",
            IncompleteOutcome::CleanErrorWithLocation,
        ),
        (
            "half-written flow mapping",
            "items: {a: 1, \n",
            IncompleteOutcome::CleanErrorWithLocation,
        ),
        (
            "transient bad indent",
            "matches:\n  - trigger: :a\n   replace: b\n",
            IncompleteOutcome::CleanErrorWithLocation,
        ),
        (
            "tab indentation",
            "matches:\n\t- trigger: :a\n",
            IncompleteOutcome::CleanErrorWithLocation,
        ),
        (
            "empty flow entry",
            "flow: [a,, b]\n",
            IncompleteOutcome::CleanErrorWithLocation,
        ),
        (
            "half-written anchor",
            "a: &\n",
            IncompleteOutcome::CleanErrorWithLocation,
        ),
        (
            "half-written alias",
            "a: *\n",
            IncompleteOutcome::CleanErrorWithLocation,
        ),
        (
            "unclosed nested flow",
            "a: [b, {c: \n",
            IncompleteOutcome::CleanErrorWithLocation,
        ),
        (
            "block header with a junk indicator",
            "replace: |x\n",
            IncompleteOutcome::CleanErrorWithLocation,
        ),
        // The two that are ACCEPTED rather than rejected. Both are the hazard.
        (
            "truncated block scalar header",
            "replace: |\n",
            IncompleteOutcome::AcceptedWithSpans,
        ),
        (
            "truncated block header with indicators",
            "replace: |2-\n",
            IncompleteOutcome::AcceptedWithSpans,
        ),
        (
            "implicit null value",
            "key:\n  :\n",
            IncompleteOutcome::AcceptedWithSpans,
        ),
        (
            "a lone sequence dash",
            "-",
            IncompleteOutcome::AcceptedWithSpans,
        ),
    ];

    println!("\n--- incomplete editor states ---");
    let mut panics = 0usize;
    let mut clean_errors = 0usize;
    let mut accepted = 0usize;

    for (label, source, expected) in cases {
        let (outcome, spans, error) = parse_incomplete(source);
        println!(
            "{:<40} {:?}  {}",
            label,
            outcome,
            error
                .clone()
                .unwrap_or_else(|| format!("{} events", spans.len()))
        );
        match outcome {
            IncompleteOutcome::Panicked => panics += 1,
            IncompleteOutcome::CleanErrorWithLocation => clean_errors += 1,
            IncompleteOutcome::AcceptedWithSpans => accepted += 1,
        }
        assert_eq!(outcome, *expected, "outcome for {label}");
        if outcome == IncompleteOutcome::CleanErrorWithLocation {
            let location = error.expect("a clean error carries a marker");
            assert!(
                location.starts_with("char ") && location.contains(" line "),
                "the error location must be usable in a UI: {location}"
            );
        }
    }

    println!("panics: {panics}  clean errors: {clean_errors}  accepted: {accepted}");
    assert_eq!(panics, 0, "no incomplete editor state may panic the parser");
    assert_eq!(clean_errors, 11);
    assert_eq!(accepted, 4);
} // End of function incomplete_editor_states_fail_cleanly_and_never_panic()

#[test]
fn a_truncated_block_scalar_header_produces_a_span_that_swallows_the_header() {
    // The one measured case where the "the header is never inside the span"
    // rule breaks: an EMPTY block scalar. The user has typed `replace: |` and
    // not yet typed the body. saphyr accepts it and reports a span covering the
    // header itself. Any Phase 0b code that assumes the span starts at content
    // will mis-locate the node while the user is still typing, so the header
    // lexer must be guarded against a span that already contains `|` or `>`.
    println!("\n--- truncated block-scalar headers ---");

    for (source, expected_span_text, expected_value) in [
        ("replace: |\n", "|\n", "\n"),
        ("replace: |2-\n", "|2-\n", ""),
        ("replace: >\n", ">\n", "\n"),
    ] {
        let scalars = saphyr_scalars(source);
        let block = scalars
            .iter()
            .find(|scalar| matches!(scalar.style, ScalarStyle::Literal | ScalarStyle::Folded))
            .unwrap_or_else(|| panic!("{source:?} must still yield a block scalar"));
        let text = &source[block.span.start..block.span.end];
        println!(
            "{source:?} -> span {}..{} = {text:?} value {:?}",
            block.span.start, block.span.end, block.value
        );
        assert_eq!(text, expected_span_text);
        assert_eq!(block.value, expected_value);
        assert!(
            text.starts_with(['|', '>']),
            "this is the case where the header IS inside the span"
        );
    }
} // End of function a_truncated_block_scalar_header_produces_a_span_that_swallows_the_header()

#[test]
fn implicit_and_empty_nodes_produce_zero_width_spans() {
    // The other accepted-but-surprising class. `empty:` and a bare `-` both get
    // a synthesised null scalar whose span has zero width, so there is no byte
    // range to own and no unique owner for the surrounding punctuation. Phase 0b
    // needs an explicit policy; this test pins the shape of the problem.
    println!("\n--- zero-width spans from implicit nodes ---");

    for (source, expected_zero_width) in [("empty:\n", 1usize), ("-", 1), ("key:\n  :\n", 2)] {
        let scalars = saphyr_scalars(source);
        let zero_width = scalars
            .iter()
            .filter(|scalar| scalar.span.start == scalar.span.end)
            .count();
        println!(
            "{source:?} -> {} scalars, {zero_width} of them zero width",
            scalars.len()
        );
        assert_eq!(
            zero_width, expected_zero_width,
            "zero-width scalar count for {source:?}"
        );
    }
} // End of function implicit_and_empty_nodes_produce_zero_width_spans()

#[test]
fn truncating_every_corpus_fixture_at_every_character_never_panics() {
    // The exhaustive version: every prefix of every valid fixture is a state
    // some user's editor really passes through. If any of them panics, the app
    // crashes while somebody is typing.
    let mut prefixes = 0usize;
    let mut accepted = 0usize;
    let mut rejected = 0usize;
    let mut panics = 0usize;

    for file in common::synthetic_valid() {
        let source = file.source_without_bom();
        let cuts: Vec<usize> = source
            .char_indices()
            .map(|(index, _)| index)
            .chain(std::iter::once(source.len()))
            .collect();
        for cut in cuts {
            prefixes += 1;
            match parse_incomplete(&source[..cut]).0 {
                IncompleteOutcome::Panicked => {
                    panics += 1;
                    println!("PANIC on {} truncated at byte {cut}", file.name);
                }
                IncompleteOutcome::CleanErrorWithLocation => rejected += 1,
                IncompleteOutcome::AcceptedWithSpans => accepted += 1,
            }
        }
    }

    println!("\n--- truncation sweep ---");
    println!("prefixes parsed: {prefixes}");
    println!("accepted:        {accepted}");
    println!("clean errors:    {rejected}");
    println!("panics:          {panics}");

    assert!(prefixes > 20_000, "the sweep must be exhaustive");
    assert_eq!(panics, 0, "saphyr-parser must never panic on a prefix");
} // End of function truncating_every_corpus_fixture_at_every_character_never_panics()

// ===========================================================================
// Probe helpers
// ===========================================================================

/// A scalar observed by saphyr-parser, with its decoded value and source span.
#[derive(Clone, Debug)]
struct ProbeScalar {
    value: String,
    style: ScalarStyle,
    span: CharRange,
    /// 0-indexed column of the span start, which is the content indentation for
    /// a block scalar.
    start_col: usize,
}

/// A half-open range in **character** units, as the parsers report them.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct CharRange {
    start: usize,
    end: usize,
}

impl From<Span> for CharRange {
    fn from(span: Span) -> CharRange {
        CharRange {
            start: span.start.index(),
            end: span.end.index(),
        }
    }
}

/// Character-index to byte-offset conversion table for one document.
///
/// Built once per document in O(n); lookups are O(1). This is the adapter every
/// parser result has to pass through before it can touch a byte span.
struct CharToByte {
    offsets: Vec<usize>,
}

impl CharToByte {
    /// Builds the table for `source`.
    fn new(source: &str) -> CharToByte {
        let mut offsets: Vec<usize> = source.char_indices().map(|(index, _)| index).collect();
        // One past the last character, so an exclusive end index converts too.
        offsets.push(source.len());
        CharToByte { offsets }
    }

    /// Converts a character index to a byte offset, saturating at the end.
    fn byte(&self, char_index: usize) -> usize {
        self.offsets
            .get(char_index)
            .copied()
            .unwrap_or_else(|| *self.offsets.last().unwrap_or(&0))
    }
}

/// Loads one corpus fixture by file-name suffix.
fn corpus_file(name: &str) -> common::CorpusFile {
    common::synthetic_valid()
        .into_iter()
        .find(|file| file.name.ends_with(name))
        .unwrap_or_else(|| panic!("{name} missing from the corpus"))
}

/// Collects every scalar saphyr-parser emits. Panics on a parse error.
fn saphyr_scalars(source: &str) -> Vec<ProbeScalar> {
    saphyr_scalars_or_none(source).expect("probe document must parse")
}

/// Collects every scalar saphyr-parser emits, or `None` if the document is
/// rejected.
fn saphyr_scalars_or_none(source: &str) -> Option<Vec<ProbeScalar>> {
    let mut out = Vec::new();
    for item in SaphyrParser::new_from_str(source) {
        let (event, span) = item.ok()?;
        if let SaphyrEvent::Scalar(value, style, _, _) = event {
            out.push(ProbeScalar {
                value: value.into_owned(),
                style,
                span: span.into(),
                start_col: span.start.col(),
            });
        }
    }
    Some(out)
}

/// Returns the scalar following the scalar whose value equals `key`.
///
/// In a block mapping the parser emits key then value, so this addresses "the
/// value of `literal:`" without building a tree.
fn find_after_key(scalars: &[ProbeScalar], key: &str) -> ProbeScalar {
    let index = scalars
        .iter()
        .position(|scalar| scalar.value == key)
        .unwrap_or_else(|| panic!("key {key} not found"));
    scalars[index + 1].clone()
}

// ---------------------------------------------------------------------------
// Block-scalar model: everything the parser does NOT report
// ---------------------------------------------------------------------------

/// The chomping indicator of a block-scalar header.
///
/// No parser exposes this, and it decides how many of the trailing line breaks
/// inside the reported span belong to the value.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Chomping {
    /// `-` — every trailing line break is removed from the value.
    Strip,
    /// no indicator — exactly one trailing line break is kept.
    Clip,
    /// `+` — every trailing line break is kept.
    Keep,
}

/// A block-scalar header, lexed from the line above the reported span.
#[derive(Clone, Debug, PartialEq, Eq)]
struct BlockHeader {
    /// The verbatim header text, e.g. `|`, `|-`, `>2+`.
    text: String,
    /// `|` for a literal block, `>` for a folded one.
    indicator: char,
    /// The explicit indentation indicator, when the header carries one.
    explicit_indent: Option<usize>,
    /// The chomping indicator.
    chomping: Chomping,
}

/// Splits a header string into indicator, explicit indent and chomping.
fn parse_block_header(text: &str) -> BlockHeader {
    let mut chars = text.chars();
    let indicator = chars.next().expect("a block header starts with `|` or `>`");
    let mut explicit_indent = None;
    let mut chomping = Chomping::Clip;
    for character in chars {
        match character {
            '-' => chomping = Chomping::Strip,
            '+' => chomping = Chomping::Keep,
            '1'..='9' => explicit_indent = Some(character as usize - '0' as usize),
            _ => {}
        }
    }
    BlockHeader {
        text: text.to_owned(),
        indicator,
        explicit_indent,
        chomping,
    }
} // End of function parse_block_header()

/// A block scalar with both the reported span and the true content end.
#[derive(Clone, Debug)]
struct BlockScalar {
    /// Byte offset of the first character of the first content line.
    span_start: usize,
    /// Byte offset the parser reported as the end. It **overshoots**.
    span_end: usize,
    /// Byte offset where the scalar's content genuinely stops, derived from the
    /// reported span plus the header's chomping indicator.
    content_end: usize,
    /// Content indentation, in columns, from `Marker::col()`.
    indent: usize,
    /// The header we lexed ourselves.
    header: BlockHeader,
    /// `Literal` or `Folded`.
    style: ScalarStyle,
    /// The value the parser decoded.
    value: String,
}

/// Length, in bytes, of the genuine content prefix of a block scalar's span.
///
/// The reported span runs on past the content: first over every trailing blank
/// line, then over the indentation of whatever comes next. Trimming the
/// horizontal whitespace removes the second part unconditionally; how many of
/// the trailing line breaks survive is decided by the chomping indicator, which
/// only the header knows.
fn block_content_len(span_text: &str, chomping: Chomping) -> usize {
    let without_spaces = span_text.trim_end_matches([' ', '\t']);
    let without_breaks = without_spaces.trim_end_matches(['\n', '\r']);
    match chomping {
        Chomping::Keep => without_spaces.len(),
        Chomping::Strip => without_breaks.len(),
        Chomping::Clip => {
            let tail = &without_spaces[without_breaks.len()..];
            if tail.starts_with("\r\n") {
                without_breaks.len() + 2
            } else if tail.is_empty() {
                without_breaks.len()
            } else {
                without_breaks.len() + 1
            }
        }
    }
} // End of function block_content_len()

/// Collects every literal/folded scalar in `source` with its true content end.
///
/// Returns an empty vector when the document does not parse, so corpus-wide
/// callers can stay simple.
fn block_scalars(source: &str) -> Vec<BlockScalar> {
    let table = CharToByte::new(source);
    let mut out = Vec::new();
    for scalar in saphyr_scalars_or_none(source).unwrap_or_default() {
        if !matches!(scalar.style, ScalarStyle::Literal | ScalarStyle::Folded) {
            continue;
        }
        let header = parse_block_header(&header_before(source, &scalar));
        let span_start = table.byte(scalar.span.start);
        let span_end = table.byte(scalar.span.end);
        let content_end =
            span_start + block_content_len(&source[span_start..span_end], header.chomping);
        out.push(BlockScalar {
            span_start,
            span_end,
            content_end,
            indent: scalar.start_col,
            header,
            style: scalar.style,
            value: scalar.value.clone(),
        });
    }
    out
} // End of function block_scalars()

/// Re-derives a block scalar's value from the source region alone.
///
/// This is the proof that the reconstructed content region is the *right*
/// region: if `(span, col, header)` really pins the scalar, then decoding that
/// region by hand must reproduce the parser's own value byte for byte. Returns
/// `None` for a folded scalar containing more-indented lines, which YAML leaves
/// unfolded and which the corpus does not exercise.
fn reconstruct_block_value(source: &str, block: &BlockScalar) -> Option<String> {
    let content = &source[block.span_start..block.content_end];
    let indent = " ".repeat(block.indent);
    let mut lines: Vec<String> = Vec::new();
    for (index, raw) in content.split('\n').enumerate() {
        let raw = raw.strip_suffix('\r').unwrap_or(raw);
        if index == 0 {
            // The span already begins at the content indentation column, so the
            // first line carries no indent to remove.
            lines.push(raw.to_owned());
        } else {
            let stripped = raw
                .strip_prefix(indent.as_str())
                .unwrap_or_else(|| raw.trim_start_matches(' '));
            lines.push(stripped.to_owned());
        }
    }
    match block.style {
        ScalarStyle::Literal => Some(lines.join("\n")),
        ScalarStyle::Folded => fold_lines(&lines),
        _ => None,
    }
} // End of function reconstruct_block_value()

/// Applies YAML block folding to already de-indented content lines.
///
/// A single line break between two content lines folds to one space; a run of
/// `n` breaks yields `n - 1` line breaks. Trailing breaks are whatever chomping
/// already selected and survive verbatim.
fn fold_lines(lines: &[String]) -> Option<String> {
    if lines.iter().any(|line| line.starts_with([' ', '\t'])) {
        return None;
    }
    let mut out = String::new();
    let mut pending = 0usize;
    let mut started = false;
    for (index, line) in lines.iter().enumerate() {
        if index > 0 {
            pending += 1;
        }
        if line.is_empty() {
            continue;
        }
        if started {
            if pending == 1 {
                out.push(' ');
            } else {
                for _ in 0..pending - 1 {
                    out.push('\n');
                }
            }
        }
        out.push_str(line);
        started = true;
        pending = 0;
    }
    for _ in 0..pending {
        out.push('\n');
    }
    Some(out)
} // End of function fold_lines()

/// Recovers a block scalar's header text by scanning backwards from the span.
///
/// The span starts at the first content character, so the header is the tail of
/// the preceding line, from the `|` or `>` indicator to the line break. This is
/// the whole lexical burden the parser leaves us for block scalars: one line,
/// bounded, no ambiguity.
fn header_before(source: &str, scalar: &ProbeScalar) -> String {
    let content_start = scalar.span.start;
    let before: String = source.chars().take(content_start).collect();
    let header_line = before
        .trim_end_matches(['\n', '\r', ' '])
        .rsplit(['\n', '\r'])
        .next()
        .unwrap_or_default();
    let indicator = header_line
        .rfind(['|', '>'])
        .expect("a block scalar span must be preceded by an indicator");
    header_line[indicator..].trim_end().to_owned()
} // End of function header_before()

/// Returns the byte ranges of `source` that no span covers.
///
/// Spans are sorted and merged first, since a parser may report nested or
/// out-of-order ranges. The result is the trivia a lexical scanner would own.
fn uncovered_gaps(source: &str, spans: &[(usize, usize)]) -> Vec<(usize, usize)> {
    let mut sorted = spans.to_vec();
    sorted.sort_unstable();

    let mut gaps = Vec::new();
    let mut cursor = 0usize;
    for (start, end) in sorted {
        if start > cursor {
            gaps.push((cursor, start));
        }
        cursor = cursor.max(end);
    }
    if cursor < source.len() {
        gaps.push((cursor, source.len()));
    }
    gaps.retain(|(start, end)| source.get(*start..*end).is_some());
    gaps
} // End of function uncovered_gaps()

// ---------------------------------------------------------------------------
// The gap frontier
// ---------------------------------------------------------------------------

/// Which spans form the frontier whose complement the gap scanner owns.
///
/// The review that prompted this section pointed out that "the gap" is
/// meaningless until this is fixed, because a comment can sit inside one span
/// and between two others.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Frontier {
    /// Every event span the parser reports, collection markers included.
    Everything,
    /// Only leaf nodes: `Scalar` and `Alias` events.
    Leaves,
    /// Leaf spans with every block scalar's overshooting end trimmed back to
    /// its true content end. **This is the definition Phase 0b must use.**
    TrimmedLeaves,
}

/// Returns the byte spans that make up `frontier`, or `None` if `source` is
/// rejected by the parser.
fn frontier_spans(source: &str, frontier: Frontier) -> Option<Vec<(usize, usize)>> {
    let table = CharToByte::new(source);
    let mut spans = Vec::new();
    for item in SaphyrParser::new_from_str(source) {
        let (event, span) = item.ok()?;
        let is_leaf = matches!(event, SaphyrEvent::Scalar(..) | SaphyrEvent::Alias(..));
        if frontier != Frontier::Everything && !is_leaf {
            continue;
        }
        spans.push((table.byte(span.start.index()), table.byte(span.end.index())));
    }

    if frontier == Frontier::TrimmedLeaves {
        for block in block_scalars(source) {
            for span in &mut spans {
                if span.0 == block.span_start && span.1 == block.span_end {
                    span.1 = block.content_end;
                }
            }
        }
    }
    Some(spans)
} // End of function frontier_spans()

/// Counts the comment lines and blank lines recoverable from a frontier's gaps.
fn trivia_in_gaps(source: &str, gaps: &[(usize, usize)]) -> (usize, usize) {
    let mut comments = 0usize;
    let mut blanks = 0usize;
    for (start, end) in gaps {
        for line in source[*start..*end].lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                blanks += 1;
            } else if trimmed.starts_with('#') {
                comments += 1;
            }
        }
    }
    (comments, blanks)
} // End of function trivia_in_gaps()

/// Returns the set of byte offsets covered by `spans`.
fn covered_bytes(source: &str, spans: &[(usize, usize)]) -> Vec<bool> {
    let mut covered = vec![false; source.len()];
    for (start, end) in spans {
        let clamped = (*end).min(source.len());
        if *start < clamped {
            covered[*start..clamped].fill(true);
        }
    }
    covered
} // End of function covered_bytes()

// ---------------------------------------------------------------------------
// Offset counting schemes
// ---------------------------------------------------------------------------

/// The four candidate answers to "an offset of *what*?".
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum CountingScheme {
    /// UTF-8 bytes, the unit Rust slices with.
    Utf8Bytes,
    /// Unicode scalar values, the unit Rust's `char` counts.
    UnicodeScalars,
    /// UTF-16 code units, the unit JavaScript and Swift `NSString` count.
    Utf16Units,
    /// User-perceived characters, the unit a text cursor moves by.
    GraphemeClusters,
}

impl CountingScheme {
    /// Every scheme, for exhaustive comparison.
    const ALL: [CountingScheme; 4] = [
        CountingScheme::Utf8Bytes,
        CountingScheme::UnicodeScalars,
        CountingScheme::Utf16Units,
        CountingScheme::GraphemeClusters,
    ];

    /// The position this scheme assigns to `byte_offset` within `source`.
    fn position(self, source: &str, byte_offset: usize) -> usize {
        let prefix = &source[..byte_offset];
        match self {
            CountingScheme::Utf8Bytes => byte_offset,
            CountingScheme::UnicodeScalars => prefix.chars().count(),
            CountingScheme::Utf16Units => prefix.chars().map(char::len_utf16).sum(),
            // Deliberately a *fixture-scoped* approximation: the only
            // cluster-extending character in `unicode-offsets.yml` is a
            // combining acute accent, so treating the combining diacritical
            // block as non-starting is exact here and needs no extra crate.
            CountingScheme::GraphemeClusters => prefix
                .chars()
                .filter(|character| !('\u{0300}'..='\u{036f}').contains(character))
                .count(),
        }
    }
}

/// Collects `(value, index, line, col)` for every scalar yaml-rust2 emits.
///
/// The flat tuple is deliberate: it is the *entire* location information the
/// crate makes available, and the shape makes that obvious.
fn yaml_rust2_scalars(source: &str) -> Vec<(String, usize, usize, usize)> {
    use yaml_rust2::parser::{Event, MarkedEventReceiver, Parser};
    use yaml_rust2::scanner::Marker;

    #[derive(Default)]
    struct Sink {
        events: Vec<(String, usize, usize, usize)>,
    }

    impl MarkedEventReceiver for Sink {
        fn on_event(&mut self, event: Event, mark: Marker) {
            if let Event::Scalar(value, _, _, _) = event {
                self.events
                    .push((value, mark.index(), mark.line(), mark.col()));
            }
        }
    }

    let mut sink = Sink::default();
    let mut parser = Parser::new_from_str(source);
    if parser.load(&mut sink, true).is_err() {
        return Vec::new();
    }
    sink.events
} // End of function yaml_rust2_scalars()
