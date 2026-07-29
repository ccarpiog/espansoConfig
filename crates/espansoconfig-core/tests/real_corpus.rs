//! Tests against the owner's live espanso configuration.
//!
//! The real corpus is **gitignored and optional**. It is populated locally by
//! `scripts/sync-real-corpus.sh` and is never committed, because this
//! repository is public and the live config contains personal templates.
//!
//! Every test here therefore **skips cleanly** when the corpus is absent: a
//! fresh clone and CI must both pass without it. A skip prints a notice
//! (visible with `--nocapture`) rather than failing.
//!
//! Nothing in this file may print file *contents*. Counts, paths and pass/fail
//! outcomes only.

mod common;

use espansoconfig_core::discovery::{enumerate, FileKind};
use espansoconfig_core::{ContentRevision, LineEnding};

#[test]
fn the_real_corpus_parses_with_the_chosen_substrate() {
    let files = common::real_corpus();
    if common::skip_without_real_corpus("the_real_corpus_parses_with_the_chosen_substrate", &files)
    {
        return;
    }

    let mut parsed = 0usize;
    let mut failures = Vec::new();
    for file in &files {
        let source = file.source_without_bom();
        let mut error = None;
        for item in saphyr_parser::Parser::new_from_str(source) {
            if let Err(scan_error) = item {
                error = Some(scan_error);
                break;
            }
        }
        match error {
            None => parsed += 1,
            // Only the file NAME and the error location are reported, never a
            // line of content.
            Some(scan_error) => failures.push(format!(
                "{} at line {}",
                file.name,
                scan_error.marker().line()
            )),
        }
    }

    println!("real corpus: {parsed}/{} files parsed", files.len());
    for failure in &failures {
        println!("  failed: {failure}");
    }
    assert!(
        failures.is_empty(),
        "every real config file must parse with saphyr-parser"
    );
} // End of function the_real_corpus_parses_with_the_chosen_substrate()

#[test]
fn real_corpus_scalar_spans_convert_to_valid_byte_ranges() {
    // The end-offset guarantee has to hold on the owner's actual files, not
    // only on fixtures we wrote to be agreeable.
    let files = common::real_corpus();
    if common::skip_without_real_corpus(
        "real_corpus_scalar_spans_convert_to_valid_byte_ranges",
        &files,
    ) {
        return;
    }

    let mut checked = 0usize;
    let mut bad = 0usize;
    let mut flow_exact = 0usize;
    let mut flow_wrong = 0usize;
    let mut block_seen = 0usize;
    let mut block_overshoot = 0usize;

    for file in &files {
        let source = file.source_without_bom();
        let char_to_byte: Vec<usize> = source
            .char_indices()
            .map(|(index, _)| index)
            .chain(std::iter::once(source.len()))
            .collect();

        for item in saphyr_parser::Parser::new_from_str(source) {
            let Ok((event, span)) = item else { break };
            let saphyr_parser::Event::Scalar(value, style, _, _) = event else {
                continue;
            };
            let start = char_to_byte
                .get(span.start.index())
                .copied()
                .unwrap_or(source.len());
            let end = char_to_byte
                .get(span.end.index())
                .copied()
                .unwrap_or(source.len());
            checked += 1;
            let Some(text) = source.get(start..end).filter(|_| end >= start) else {
                bad += 1;
                continue;
            };

            match style {
                // Block scalars report an end that overshoots into trailing
                // trivia; the synthetic corpus pins the exact rule, and here we
                // only measure how often the overshoot occurs on real files.
                saphyr_parser::ScalarStyle::Literal | saphyr_parser::ScalarStyle::Folded => {
                    block_seen += 1;
                    if text.trim_end_matches([' ', '\t']).len() != text.len() {
                        block_overshoot += 1;
                    }
                }
                // Flow scalars must reproduce their exact source token.
                saphyr_parser::ScalarStyle::Plain => {
                    if text.contains('\n') {
                        continue;
                    }
                    if text == value {
                        flow_exact += 1;
                    } else {
                        flow_wrong += 1;
                    }
                }
                saphyr_parser::ScalarStyle::SingleQuoted => {
                    if text.starts_with('\'') && text.ends_with('\'') && text.len() >= 2 {
                        flow_exact += 1;
                    } else {
                        flow_wrong += 1;
                    }
                }
                saphyr_parser::ScalarStyle::DoubleQuoted => {
                    if text.starts_with('"') && text.ends_with('"') && text.len() >= 2 {
                        flow_exact += 1;
                    } else {
                        flow_wrong += 1;
                    }
                }
            }
        }
    }

    println!("real corpus: {checked} scalar spans checked, {bad} invalid");
    println!("real corpus: {flow_exact} flow scalars exact, {flow_wrong} wrong");
    println!("real corpus: {block_seen} block scalars, {block_overshoot} with an overshooting end");
    assert_eq!(
        bad, 0,
        "every real-corpus span must convert to a valid range"
    );
    assert_eq!(
        flow_wrong, 0,
        "every real-corpus flow scalar span must be its exact source token"
    );
} // End of function real_corpus_scalar_spans_convert_to_valid_byte_ranges()

#[test]
fn discovery_classifies_the_real_corpus_tree() {
    // The sync script mirrors espanso's `config/` and `match/` layout, so the
    // real corpus doubles as an integration test for `discovery`.
    let root = common::corpus_root().join("real");
    if !root.is_dir() {
        println!("SKIP discovery_classifies_the_real_corpus_tree: no real corpus present");
        return;
    }
    let Ok(tree) = enumerate(&root) else {
        println!("SKIP discovery_classifies_the_real_corpus_tree: corpus root unreadable");
        return;
    };
    if tree.files.is_empty() {
        println!("SKIP discovery_classifies_the_real_corpus_tree: corpus is empty");
        return;
    }

    let matches = tree.of_kind(FileKind::MatchFile).count();
    let profiles = tree.of_kind(FileKind::ConfigProfile).count();
    let packages = tree.of_kind(FileKind::Package).count();
    let disabled = tree.files.iter().filter(|file| file.disabled).count();

    println!(
        "real corpus tree: {} files ({matches} match, {profiles} profile, {packages} package, {disabled} disabled)",
        tree.files.len()
    );
    assert_eq!(
        matches + profiles + packages,
        tree.files.len(),
        "every discovered file must be classified"
    );
    assert!(
        tree.of_kind(FileKind::Package)
            .all(|file| file.kind.is_read_only()),
        "package files must be read-only"
    );
} // End of function discovery_classifies_the_real_corpus_tree()

#[test]
fn real_corpus_line_endings_and_revisions_are_stable() {
    let files = common::real_corpus();
    if common::skip_without_real_corpus("real_corpus_line_endings_and_revisions_are_stable", &files)
    {
        return;
    }

    let mut crlf = 0usize;
    let mut bom = 0usize;
    let mut no_final_newline = 0usize;
    for file in &files {
        if LineEnding::detect(&file.source) == LineEnding::Crlf {
            crlf += 1;
        }
        if file.has_bom() {
            bom += 1;
        }
        if !file.source.ends_with('\n') {
            no_final_newline += 1;
        }
        // Hashing must be deterministic: the save transaction's conflict
        // detection depends on it.
        let first = ContentRevision::of_bytes(file.source.as_bytes());
        let second = ContentRevision::of_bytes(file.source.as_bytes());
        assert_eq!(first, second);
    }

    println!(
        "real corpus traits: {} files, {crlf} CRLF, {bom} with BOM, {no_final_newline} without a final newline",
        files.len()
    );
} // End of function real_corpus_line_endings_and_revisions_are_stable()
