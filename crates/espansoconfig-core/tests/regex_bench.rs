//! Phase 4-21 — the regex bench core (`crates/espansoconfig-core/src/regex_bench.rs`).
//!
//! Step 4-21's acceptance (`docs/decisions/4-split-notes.md` §2): compile / no
//! match / match; optional captures; Unicode; zero-width matches; each limit at
//! and past its boundary; result text cut in Rust; pattern and sample never
//! logged (the source scan is `src-tauri/src/wire_contract.rs`'s; the
//! behavioural half — nothing in an answer or a `Debug` echoes them — is here);
//! and the engine the answer names agrees with `Cargo.lock`.

use std::path::Path;

use espansoconfig_core::regex_bench::{
    test_regex, test_regex_with_limits, RegexBenchAnswer, RegexBenchLimits, RegexBenchRequest,
    RegexCompileFailure, RegexFound, RegexGroup, RegexOutcome, RegexRefusal, RegexSpan, ENGINE,
};

/// A request with id 1.
fn request(pattern: &str, sample: &str) -> RegexBenchRequest {
    RegexBenchRequest {
        request_id: 1,
        pattern: pattern.to_owned(),
        sample: sample.to_owned(),
    }
}

/// The answer's refusal, or a panic naming what came back instead.
fn refusal_of(answer: &RegexBenchAnswer) -> RegexRefusal {
    match &answer.outcome {
        RegexOutcome::Refused { refusal } => *refusal,
        other => panic!("expected a refusal, got {other:?}"),
    }
}

/// The answer's tested outcome, or a panic naming the refusal.
fn tested(answer: &RegexBenchAnswer) -> (&[String], Option<&RegexFound>) {
    match &answer.outcome {
        RegexOutcome::Tested { group_names, found } => (group_names, found.as_ref()),
        RegexOutcome::Refused { refusal } => panic!("expected a search, got {refusal:?}"),
    }
}

/// The first match, or a panic.
fn found(answer: &RegexBenchAnswer) -> &RegexFound {
    tested(answer).1.expect("a match was found")
}

/// A span with its text and UTF-16 positions.
fn span(text: &str, utf16_start: usize, utf16_end: usize) -> RegexSpan {
    RegexSpan {
        text: text.to_owned(),
        utf16_start,
        utf16_end,
    }
}

/// `sample`'s UTF-16 code units between the two positions, decoded — what a
/// JavaScript `sample.slice(start, end)` answers.
fn utf16_slice(sample: &str, start: usize, end: usize) -> String {
    let units: Vec<u16> = sample.encode_utf16().collect();
    String::from_utf16(&units[start..end]).expect("a slice on code-point boundaries")
}

/// Every span of a found match agrees with the JavaScript slice of the sample
/// at its UTF-16 positions.
fn assert_spans_agree_with_utf16(sample: &str, found: &RegexFound) {
    let spans = std::iter::once(&found.whole).chain(
        found
            .groups
            .iter()
            .filter_map(|group| group.capture.as_ref()),
    );
    for one in spans {
        assert_eq!(
            utf16_slice(sample, one.utf16_start, one.utf16_end),
            one.text,
            "{one:?}"
        );
    } // End of the loop over the spans
}

/// The answer's size as `serde_json` writes it, which is what Tauri sends.
fn wire_bytes(answer: &RegexBenchAnswer) -> usize {
    serde_json::to_vec(answer)
        .expect("an answer serializes")
        .len()
}

/// Limits with no response cap, to measure an answer before capping it.
fn uncapped() -> RegexBenchLimits {
    RegexBenchLimits {
        response_bytes: usize::MAX,
        ..RegexBenchLimits::DEFAULT
    }
}

#[test]
fn the_default_limits_are_the_ones_the_step_names() {
    let limits = RegexBenchLimits::DEFAULT;
    assert_eq!(limits.pattern_bytes, 8192);
    assert_eq!(limits.sample_bytes, 65_536);
    assert_eq!(limits.named_groups, 128);
    assert_eq!(limits.compiled_bytes, 1_048_576);
    assert_eq!(limits.dfa_cache_bytes, 1_048_576);
    assert_eq!(limits.response_bytes, 131_072);
    // The builder is handed both `regex` limits. A text check, because neither
    // is observable from outside: the compiled-size limit is measured by
    // `regex` in its own unit, and the DFA cache limit never refuses.
    let module =
        std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("src/regex_bench.rs"))
            .expect("the module reads");
    assert!(module.contains(".size_limit(limits.compiled_bytes)"));
    assert!(module.contains(".dfa_size_limit(limits.dfa_cache_bytes)"));
}

#[test]
fn the_engine_named_is_the_one_the_lockfile_pins() {
    let lock =
        std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../Cargo.lock"))
            .expect("Cargo.lock reads");
    let versions: Vec<&str> = lock
        .split("[[package]]")
        .filter(|block| block.lines().any(|line| line.trim() == "name = \"regex\""))
        .filter_map(|block| {
            block
                .lines()
                .find_map(|line| line.trim().strip_prefix("version = \""))
                .and_then(|rest| rest.strip_suffix('"'))
        })
        .collect();
    assert_eq!(versions, vec![ENGINE.version], "the locked regex versions");
    assert_eq!(ENGINE.name, "regex");
    let answer = test_regex(&request("a", "a"));
    assert_eq!(answer.engine, ENGINE);
    let json = serde_json::to_value(&answer).expect("serializes");
    assert_eq!(
        json["engine"],
        serde_json::json!({ "name": "regex", "version": "1.13.1" })
    );
}

#[test]
fn a_pattern_compiles_and_matches_or_does_not() {
    // Match: first match only, no anchor added — the search finds `b2` inside.
    let answer = test_regex(&RegexBenchRequest {
        request_id: 42,
        pattern: "[a-z][0-9]".to_owned(),
        sample: "--a1 b2".to_owned(),
    });
    assert_eq!(answer.request_id, 42, "the request id is echoed");
    assert_eq!(
        answer.outcome,
        RegexOutcome::Tested {
            group_names: vec![],
            found: Some(RegexFound {
                whole: span("a1", 2, 4),
                groups: vec![],
            }),
        }
    );
    // No match: compiled, searched, nothing found — the names are still listed.
    let answer = test_regex(&request("(?P<digits>[0-9]+)", "no digits here"));
    assert_eq!(
        answer.outcome,
        RegexOutcome::Tested {
            group_names: vec!["digits".to_owned()],
            found: None,
        }
    );
    // Compile failure: a code, not regex's message.
    let answer = test_regex(&request("(unclosed", "x"));
    assert_eq!(
        refusal_of(&answer),
        RegexRefusal::CompileRejected {
            reason: RegexCompileFailure::Syntax
        }
    );
    // A duplicate group name is a syntax failure too.
    let answer = test_regex(&request("(?P<a>x)(?P<a>y)", "xy"));
    assert_eq!(
        refusal_of(&answer),
        RegexRefusal::CompileRejected {
            reason: RegexCompileFailure::Syntax
        }
    );
    // The JSON shape a caller reads.
    let json = serde_json::to_value(test_regex(&request("(?P<n>b)", "ab"))).expect("serializes");
    assert_eq!(
        json["outcome"],
        serde_json::json!({ "Tested": {
            "group_names": ["n"],
            "found": {
                "whole": { "text": "b", "utf16_start": 1, "utf16_end": 2 },
                "groups": [{ "name": "n", "capture": { "text": "b", "utf16_start": 1, "utf16_end": 2 } }],
            },
        } })
    );
    let json = serde_json::to_value(test_regex(&request("(", ""))).expect("serializes");
    assert_eq!(
        json["outcome"],
        serde_json::json!({ "Refused": { "refusal": { "CompileRejected": { "reason": "Syntax" } } } })
    );
    let json =
        serde_json::to_value(test_regex(&request(&"a".repeat(8193), ""))).expect("serializes");
    assert_eq!(
        json["outcome"],
        serde_json::json!({ "Refused": { "refusal": "PatternTooLarge" } })
    );
}

#[test]
fn named_groups_are_listed_in_pattern_order_and_unmatched_ones_are_none() {
    // `year` and `month` take part; `day` is optional and absent; `alt` is in
    // the alternative not taken. The unnamed group is not listed.
    let pattern = r"(?P<year>\d{4})-(?P<month>\d\d)(?:-(?P<day>\d\d))?(?:(x)|(?P<alt>y))?";
    let answer = test_regex(&request(pattern, "on 2026-09 then"));
    let (names, found) = tested(&answer);
    assert_eq!(names, ["year", "month", "day", "alt"]);
    let found = found.expect("found");
    assert_eq!(found.whole, span("2026-09", 3, 10));
    assert_eq!(
        found.groups,
        vec![
            RegexGroup {
                name: "year".to_owned(),
                capture: Some(span("2026", 3, 7)),
            },
            RegexGroup {
                name: "month".to_owned(),
                capture: Some(span("09", 8, 10)),
            },
            RegexGroup {
                name: "day".to_owned(),
                capture: None,
            },
            RegexGroup {
                name: "alt".to_owned(),
                capture: None,
            },
        ]
    );
    // A group that took part and captured nothing is a zero-width capture,
    // never `None`.
    let answer = test_regex(&request("a(?P<empty>b*)c", "ac"));
    assert_eq!(found_groups(&answer), vec![Some(span("", 1, 1))]);
    // The `(?<name>…)` spelling is read as a name as well.
    let answer = test_regex(&request("(?<angle>z)", "z"));
    assert_eq!(tested(&answer).0, ["angle"]);
    // An unmatched group crosses as `null`.
    let json = serde_json::to_value(test_regex(&request("a(?P<o>b)?", "a"))).expect("serializes");
    assert_eq!(
        json["outcome"]["Tested"]["found"]["groups"],
        serde_json::json!([{ "name": "o", "capture": null }])
    );
}

/// The captures of a found match, in order.
fn found_groups(answer: &RegexBenchAnswer) -> Vec<Option<RegexSpan>> {
    found(answer)
        .groups
        .iter()
        .map(|group| group.capture.clone())
        .collect()
}

#[test]
fn unicode_text_is_cut_in_rust_and_positioned_in_utf16_units() {
    // Precomposed é (2 bytes, 1 unit), decomposed e + U+0301 (3 bytes, 2
    // units), astral 😀 (4 bytes, 2 units), CJK 日 (3 bytes, 1 unit).
    let sample = "é e\u{301} 😀 日本 (x)";
    let answer = test_regex(&request(
        r"(?P<emoji>\p{Extended_Pictographic}) (?P<cjk>\p{Han}+)",
        sample,
    ));
    let first = found(&answer);
    assert_eq!(first.whole, span("😀 日本", 5, 10));
    assert_eq!(
        found_groups(&answer),
        vec![Some(span("😀", 5, 7)), Some(span("日本", 8, 10))]
    );
    assert_spans_agree_with_utf16(sample, first);
    // Byte offsets would have been 8 and 19; nothing byte-shaped crosses.
    let json = serde_json::to_string(&answer).expect("serializes");
    assert!(!json.contains("byte"), "{json}");
    // `\w` and `.` are Unicode-aware: one `.` is one scalar value, so the
    // decomposed pair is two of them.
    let answer = test_regex(&request(r"e.\s", sample));
    assert_eq!(found(&answer).whole, span("e\u{301} ", 2, 5));
    assert_spans_agree_with_utf16(sample, found(&answer));
    let answer = test_regex(&request(r"^\w", sample));
    assert_eq!(found(&answer).whole, span("é", 0, 1));
    // A group name may itself be Unicode.
    let answer = test_regex(&request("(?P<año>\\d+)", "año 2026"));
    assert_eq!(tested(&answer).0, ["año"]);
    assert_eq!(found_groups(&answer), vec![Some(span("2026", 4, 8))]);
}

#[test]
fn zero_width_matches_are_representable() {
    // `a*` on a sample with no `a` matches the empty string at the start.
    let answer = test_regex(&request("a*", "bbb"));
    assert_eq!(found(&answer).whole, span("", 0, 0));
    // `\b` in the middle of the sample.
    let answer = test_regex(&request(r"\b", "  x"));
    assert_eq!(found(&answer).whole, span("", 2, 2));
    // `$` after an astral character: the end, in UTF-16 units.
    let answer = test_regex(&request("$", "😀"));
    assert_eq!(found(&answer).whole, span("", 2, 2));
    // An empty pattern and an empty sample.
    let answer = test_regex(&request("", ""));
    assert_eq!(found(&answer).whole, span("", 0, 0));
    let answer = test_regex(&request("^", ""));
    assert_eq!(found(&answer).whole, span("", 0, 0));
    // A zero-width lookaround-free group capture.
    let answer = test_regex(&request(r"(?P<at>)x", "yx"));
    assert_eq!(found(&answer).whole, span("x", 1, 2));
    assert_eq!(found_groups(&answer), vec![Some(span("", 1, 1))]);
    // A zero-width match is not "no match".
    let json = serde_json::to_value(test_regex(&request("a*", "bbb"))).expect("serializes");
    assert_eq!(
        json["outcome"]["Tested"]["found"]["whole"],
        serde_json::json!({ "text": "", "utf16_start": 0, "utf16_end": 0 })
    );
}

#[test]
fn the_pattern_limit_holds_at_the_boundary() {
    // `(?x)` ignores whitespace, so a pattern of any length compiles to little.
    let at = format!("(?x)a{}", " ".repeat(8192 - 5));
    assert_eq!(at.len(), 8192);
    assert_eq!(
        found(&test_regex(&request(&at, "a"))).whole,
        span("a", 0, 1)
    );
    let past = format!("{at} ");
    assert_eq!(
        refusal_of(&test_regex(&request(&past, "a"))),
        RegexRefusal::PatternTooLarge
    );
    // The unit is bytes, not characters: 4096 two-byte characters are at the
    // limit, and one more byte is past it.
    let wide = "é".repeat(4096);
    assert_eq!(wide.len(), 8192);
    assert!(matches!(
        test_regex(&request(&wide, "")).outcome,
        RegexOutcome::Tested { found: None, .. }
    ));
    assert_eq!(
        refusal_of(&test_regex(&request(&format!("{wide}a"), ""))),
        RegexRefusal::PatternTooLarge
    );
    // The pattern is checked first: a sample past its limit too still answers
    // `PatternTooLarge`.
    assert_eq!(
        refusal_of(&test_regex(&request(&past, &"s".repeat(65_537)))),
        RegexRefusal::PatternTooLarge
    );
}

#[test]
fn the_sample_limit_holds_at_the_boundary() {
    let at = format!("{}z", "s".repeat(65_535));
    assert_eq!(at.len(), 65_536);
    assert_eq!(
        found(&test_regex(&request("z", &at))).whole,
        span("z", 65_535, 65_536)
    );
    let past = format!("{at}s");
    assert_eq!(
        refusal_of(&test_regex(&request("z", &past))),
        RegexRefusal::SampleTooLarge
    );
    // Bytes, not characters: 21 845 three-byte characters and one byte are at
    // the limit; one more byte is past it.
    let wide = format!("{}z", "日".repeat(21_845));
    assert_eq!(wide.len(), 65_536);
    assert_eq!(
        found(&test_regex(&request("z", &wide))).whole,
        span("z", 21_845, 21_846)
    );
    assert_eq!(
        refusal_of(&test_regex(&request("z", &format!("{wide}s")))),
        RegexRefusal::SampleTooLarge
    );
    // The sample is checked before the pattern compiles.
    assert_eq!(
        refusal_of(&test_regex(&request("(", &past))),
        RegexRefusal::SampleTooLarge
    );
}

/// A pattern with `count` named groups, each matching `a`.
fn named_groups(count: usize) -> String {
    (0..count)
        .map(|index| format!("(?P<g{index}>a)?"))
        .collect()
}

#[test]
fn the_named_group_limit_holds_at_the_boundary() {
    let at = named_groups(128);
    let answer = test_regex(&request(&at, "aa"));
    let (names, found) = tested(&answer);
    assert_eq!(names.len(), 128);
    assert_eq!(names[0], "g0");
    assert_eq!(names[127], "g127");
    let found = found.expect("found");
    assert_eq!(found.groups.len(), 128);
    assert_eq!(found.groups[1].capture, Some(span("a", 1, 2)));
    assert_eq!(found.groups[2].capture, None);
    assert_eq!(
        refusal_of(&test_regex(&request(&named_groups(129), "aa"))),
        RegexRefusal::CaptureLimit
    );
    // Unnamed groups do not count.
    let with_unnamed = format!("{at}{}", "(a)?".repeat(200));
    assert!(matches!(
        test_regex(&request(&with_unnamed, "a")).outcome,
        RegexOutcome::Tested { .. }
    ));
}

/// Whether `pattern` compiles under `compiled_bytes`, every other limit the
/// default.
fn compiles_under(pattern: &str, compiled_bytes: usize) -> bool {
    let limits = RegexBenchLimits {
        compiled_bytes,
        ..RegexBenchLimits::DEFAULT
    };
    match test_regex_with_limits(&request(pattern, ""), &limits).outcome {
        RegexOutcome::Tested { .. } => true,
        RegexOutcome::Refused {
            refusal:
                RegexRefusal::CompileRejected {
                    reason: RegexCompileFailure::CompiledTooBig,
                },
        } => false,
        other => panic!("{pattern}: {other:?}"),
    }
}

#[test]
fn the_compiled_size_limit_holds_at_the_boundary() {
    // The limit is `regex`'s, in `regex`'s own measure, so its exact boundary
    // for one pattern is found rather than predicted: the smallest limit the
    // pattern compiles under, which the pattern must then fail one byte below.
    let pattern = r"\w{8}";
    let (mut low, mut high) = (0usize, RegexBenchLimits::DEFAULT.compiled_bytes);
    assert!(compiles_under(pattern, high));
    assert!(!compiles_under(pattern, low));
    while high - low > 1 {
        let middle = low + (high - low) / 2;
        if compiles_under(pattern, middle) {
            high = middle;
        } else {
            low = middle;
        }
    } // End of the binary search over the limit
    assert!(compiles_under(pattern, high), "at its boundary it compiles");
    assert!(
        !compiles_under(pattern, high - 1),
        "one byte below it does not"
    );

    // Under the default 1 MiB: a Unicode `\w` repeated `n` times compiles and
    // `n + 1` times does not, and that `n + 1` compiles under twice the limit —
    // so the refusal is the limit's and not a syntax limit's.
    let default = RegexBenchLimits::DEFAULT.compiled_bytes;
    let repeated = |count: usize| format!(r"\w{{{count}}}");
    let (mut fits, mut too_big) = (1usize, 1000usize);
    assert!(compiles_under(&repeated(fits), default));
    assert!(!compiles_under(&repeated(too_big), default));
    while too_big - fits > 1 {
        let middle = fits + (too_big - fits) / 2;
        if compiles_under(&repeated(middle), default) {
            fits = middle;
        } else {
            too_big = middle;
        }
    } // End of the binary search over the repetition count
    let past = test_regex(&request(&repeated(too_big), ""));
    assert_eq!(
        refusal_of(&past),
        RegexRefusal::CompileRejected {
            reason: RegexCompileFailure::CompiledTooBig
        }
    );
    assert!(matches!(
        test_regex(&request(&repeated(fits), "")).outcome,
        RegexOutcome::Tested { .. }
    ));
    assert!(compiles_under(&repeated(too_big), 2 * default));
}

#[test]
fn the_dfa_cache_limit_bounds_memory_and_never_refuses() {
    // A pattern whose lazy DFA needs many states, over a long varied sample.
    // A tiny cache makes the engine fall back to a slower one; the answer is
    // the same as under the default, and it is never a refusal.
    let pattern = r"(?P<tail>[a-q][^u-z]{12}x)";
    let sample: String = (0..60_000u32)
        .map(|index| char::from(b'a' + (index * 7 % 26) as u8))
        .chain("bcdefghijklmnx".chars())
        .collect();
    let default = test_regex(&request(pattern, &sample));
    let tiny = test_regex_with_limits(
        &request(pattern, &sample),
        &RegexBenchLimits {
            dfa_cache_bytes: 1,
            ..RegexBenchLimits::DEFAULT
        },
    );
    assert!(matches!(
        default.outcome,
        RegexOutcome::Tested { found: Some(_), .. }
    ));
    assert_eq!(default, tiny);
}

/// A sample of `length` `a`s answered by `(?P<a>a+)` — the text crosses
/// twice, once as the whole match and once as the group.
fn doubled(request_id: u64, length: usize) -> RegexBenchRequest {
    RegexBenchRequest {
        request_id,
        pattern: "(?P<a>a+)".to_owned(),
        sample: "a".repeat(length),
    }
}

#[test]
fn the_response_limit_holds_at_the_boundary() {
    let limit = RegexBenchLimits::DEFAULT.response_bytes;
    // Find a request whose uncapped answer is exactly the limit: two bytes per
    // sample byte, so the id's digit count fixes the parity.
    let mut at_limit = None;
    'search: for request_id in [1u64, 10] {
        for length in (60_000..=65_536).rev() {
            let one = doubled(request_id, length);
            if wire_bytes(&test_regex_with_limits(&one, &uncapped())) == limit {
                at_limit = Some(one);
                break 'search;
            }
        } // End of the loop over the sample lengths
    } // End of the loop over the two ids
    let at_limit = at_limit.expect("some request answers exactly the limit");
    let answer = test_regex(&at_limit);
    assert!(matches!(
        answer.outcome,
        RegexOutcome::Tested { found: Some(_), .. }
    ));
    assert_eq!(wire_bytes(&answer), limit, "at the limit it is answered");
    // One more digit in the id is one more byte, and the answer is refused.
    let past = RegexBenchRequest {
        request_id: at_limit.request_id * 10,
        ..at_limit.clone()
    };
    assert_eq!(
        wire_bytes(&test_regex_with_limits(&past, &uncapped())),
        limit + 1
    );
    let refused = test_regex(&past);
    assert_eq!(refusal_of(&refused), RegexRefusal::OutputLimit);
    assert_eq!(
        refused.request_id, past.request_id,
        "a refusal still echoes the id"
    );
    assert!(wire_bytes(&refused) < 200, "a refusal carries no text");

    // JSON escaping counts: a quote serializes as two bytes, so a sample that
    // fits as text can still be past the limit as JSON.
    let quotes = RegexBenchRequest {
        request_id: 1,
        pattern: "(?P<q>\"+)".to_owned(),
        sample: "\"".repeat(40_000),
    };
    assert!(wire_bytes(&test_regex_with_limits(&quotes, &uncapped())) > limit);
    assert_eq!(refusal_of(&test_regex(&quotes)), RegexRefusal::OutputLimit);

    // Many overlapping groups over one long match: refused, not built.
    let nested = RegexBenchRequest {
        request_id: 1,
        pattern: "(?P<n0>(?P<n1>(?P<n2>a+)))".to_owned(),
        sample: "a".repeat(65_536),
    };
    assert_eq!(refusal_of(&test_regex(&nested)), RegexRefusal::OutputLimit);
}

#[test]
fn neither_the_pattern_nor_the_sample_is_echoed_outside_the_found_text() {
    let pattern = "PATTERNMARKER(";
    let sample = "SAMPLEMARKER";
    // regex's own message would have quoted the pattern.
    let failure = regex::Regex::new(pattern).expect_err("does not compile");
    assert!(failure.to_string().contains("PATTERNMARKER"), "the premise");
    let answer = test_regex(&request(pattern, sample));
    let json = serde_json::to_string(&answer).expect("serializes");
    assert!(!json.contains("MARKER"), "{json}");
    // A request's `Debug` prints lengths only.
    let debug = format!("{:?}", request(pattern, sample));
    assert!(!debug.contains("MARKER"), "{debug}");
    assert!(debug.contains("pattern_bytes: 14"), "{debug}");
    // A search that finds nothing echoes neither.
    let answer = test_regex(&request("PATTERNMARKER", sample));
    let json = serde_json::to_string(&answer).expect("serializes");
    assert!(!json.contains("MARKER"), "{json}");
    // Every refusal but a compile failure, too.
    for refused in [
        test_regex(&request(
            &format!("PATTERNMARKER{}", " ".repeat(8192)),
            sample,
        )),
        test_regex(&request(
            "PATTERNMARKER",
            &format!("SAMPLEMARKER{}", " ".repeat(65_536)),
        )),
        test_regex(&request(&named_groups(129), sample)),
    ] {
        let json = serde_json::to_string(&refused).expect("serializes");
        assert!(!json.contains("MARKER"), "{json}");
    } // End of the loop over the refusals
}

#[test]
fn identical_requests_give_identical_answers() {
    let one = request(r"(?P<w>\w+)\s(?P<n>\d+)?", "héllo 42");
    assert_eq!(test_regex(&one), test_regex(&one.clone()));
    assert_eq!(
        serde_json::to_string(&test_regex(&one)).expect("serializes"),
        serde_json::to_string(&test_regex(&one)).expect("serializes")
    );
}

#[test]
fn a_group_repeated_zero_times_is_still_declared_and_comes_back_unmatched() {
    // `regex` removes a `{0}` subexpression while compiling, so its group is
    // not among the compiled names; the answer still lists it, in pattern
    // order, as a group that did not take part.
    let answer = test_regex(&request("(?P<hidden>a){0}(?P<live>b)", "ab"));
    let (names, found) = tested(&answer);
    assert_eq!(names, ["hidden", "live"]);
    assert_eq!(
        found.expect("found").groups,
        vec![
            RegexGroup {
                name: "hidden".to_owned(),
                capture: None,
            },
            RegexGroup {
                name: "live".to_owned(),
                capture: Some(span("b", 1, 2)),
            },
        ]
    );
    // Nested inside a `{0}`, and with no match at all.
    let answer = test_regex(&request("(?:(?P<outer>(?P<inner>x))){0}y", "z"));
    assert_eq!(tested(&answer).0, ["outer", "inner"]);
    assert_eq!(tested(&answer).1, None);
}

#[test]
fn the_named_group_limit_counts_declared_groups_not_compiled_ones() {
    // 128 live names plus one hidden under `{0}` is 129 declared: refused.
    let hidden = format!("{}(?P<hidden>a){{0}}", named_groups(128));
    assert_eq!(
        refusal_of(&test_regex(&request(&hidden, "a"))),
        RegexRefusal::CaptureLimit
    );
    // 129 declared, every one under `{0}`: refused too.
    let all_hidden: String = (0..129)
        .map(|index| format!("(?P<h{index}>a){{0}}"))
        .collect();
    assert_eq!(
        refusal_of(&test_regex(&request(&all_hidden, ""))),
        RegexRefusal::CaptureLimit
    );
    // 127 live and one hidden is 128 declared: answered, all 128 listed.
    let at = format!("{}(?P<hidden>a){{0}}", named_groups(127));
    let answer = test_regex(&request(&at, "a"));
    let (names, found) = tested(&answer);
    assert_eq!(names.len(), 128);
    assert_eq!(names[127], "hidden");
    assert_eq!(found.expect("found").groups[127].capture, None);
    // The group limit is checked before compiling: a pattern past it that
    // would also be too big to compile answers `CaptureLimit`.
    let big = format!("{}\\w{{2000}}", named_groups(129));
    assert_eq!(
        refusal_of(&test_regex(&request(&big, ""))),
        RegexRefusal::CaptureLimit
    );
}

#[test]
fn a_duplicate_name_is_refused_even_when_one_copy_is_hidden() {
    for pattern in [
        "(?P<a>x){0}(?P<a>y)",
        "(?P<a>x)(?P<a>y){0}",
        "(?P<a>x)|(?P<a>y)",
    ] {
        assert_eq!(
            refusal_of(&test_regex(&request(pattern, "xy"))),
            RegexRefusal::CompileRejected {
                reason: RegexCompileFailure::Syntax
            },
            "{pattern}"
        );
        let json = serde_json::to_string(&test_regex(&request(pattern, "xy"))).expect("serializes");
        assert!(!json.contains("(?P"), "{json}");
    } // End of the loop over the duplicate spellings
}
