//! Phase 4-18 acceptance: the date preview (`docs/decisions/4-split-notes.md`
//! §2, step 4-18, under ruling 27).
//!
//! What this file pins:
//!
//! - fixed instants around day boundaries (a year end, a leap day, fixed
//!   offsets on both sides of UTC) and around both DST changes of a named IANA
//!   zone, in the request's zone and in an explicit `tz`;
//! - the RFC 2822 default for an absent `format`;
//! - malformed formats and offsets are codes, never a panic;
//! - overflow — an offset beyond chrono's durations, an instant beyond its
//!   range, RFC 2822's four-digit year — is a code, at the boundary;
//! - `LocaleUnsupported` for locale-dependent formats, and the one English-names
//!   exception;
//! - the output budget bounds a date's text;
//! - **no test reads the clock**: every instant is a literal, and a source scan
//!   fails on a clock or local-zone read in the preview modules or in these
//!   tests, and on `chrono` named anywhere in the core outside the date module.
//!
//! Expected texts are written by hand from the instants (each instant's UTC
//! reading is in the comment beside it), not computed with chrono.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).

use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::model::DocumentContext;
use espansoconfig_core::preview::{
    preview_match, preview_match_with_limits, MatchPreview, PreviewLimit, PreviewLimits,
    PreviewSamples, PreviewSegment, PreviewSource, PreviewUnresolved, SampleInstant, SampleZone,
    MAX_PREVIEW_OUTPUT_BYTES,
};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::DocumentId;

/// 2024-03-31T00:00:00Z — the day Europe/Madrid springs forward at 01:00Z.
const SPRING_DAY: i64 = 1_711_843_200;
/// 2024-10-27T00:00:00Z — the day Europe/Madrid falls back at 01:00Z.
const AUTUMN_DAY: i64 = 1_729_987_200;
/// 2024-12-31T23:30:00Z — half an hour before a year boundary.
const YEAR_END: i64 = 1_735_687_800;
/// 2024-02-28T23:00:00Z — an hour before a leap day.
const LEAP_EVE: i64 = 1_709_161_200;
/// 9999-12-31T23:59:59Z — RFC 2822's last second.
const LAST_FOUR_DIGIT_SECOND: i64 = 253_402_300_799;

/// One match whose `replace` is `{{d}}` and whose only variable is the date
/// `d` with `params` written as `params` (indented under `params:`).
fn date_match(params: &str) -> String {
    let mut source = String::from(
        "matches:\n  - trigger: ':d'\n    replace: '{{d}}'\n    vars:\n      - name: d\n        type: date\n",
    );
    if !params.is_empty() {
        source.push_str("        params:\n");
        for line in params.lines() {
            source.push_str("          ");
            source.push_str(line);
            source.push('\n');
        }
    }
    source
} // End of function date_match()

/// Samples carrying only an instant.
fn at(unix_seconds: i64, zone: SampleZone) -> PreviewSamples {
    PreviewSamples {
        instant: Some(SampleInstant { unix_seconds, zone }),
        ..PreviewSamples::default()
    }
}

/// A named request zone.
fn named(name: &str) -> SampleZone {
    SampleZone::Named {
        name: name.to_owned(),
    }
}

/// A fixed request zone.
fn fixed(offset_seconds: i32) -> SampleZone {
    SampleZone::Fixed { offset_seconds }
}

/// The preview of the first match of `source`.
fn preview_of(source: &str, samples: &PreviewSamples) -> MatchPreview {
    preview_with(source, samples, PreviewLimits::DEFAULT)
}

/// [`preview_of`] under explicit limits.
fn preview_with(source: &str, samples: &PreviewSamples, limits: PreviewLimits) -> MatchPreview {
    let context = DocumentContext {
        id: DocumentId(1),
        path: std::path::PathBuf::from("/nowhere/base.yml"),
        relative_path: std::path::PathBuf::from("base.yml"),
        kind: FileKind::MatchFile,
        disabled: false,
    };
    let document = project_source(&context, source);
    preview_match_with_limits(&document.view, &document.view.matches[0], samples, limits)
} // End of function preview_with()

/// What the date `d` of [`date_match`]`(params)` answers: its text, or why
/// not.
fn date_of(params: &str, samples: &PreviewSamples) -> Result<String, PreviewUnresolved> {
    let preview = preview_of(&date_match(params), samples);
    assert_eq!(preview.bodies.len(), 1, "{preview:?}");
    match preview.bodies[0].segments.as_slice() {
        [PreviewSegment::Sample { text, source }] => {
            assert_eq!(source, &PreviewSource::Local { index: 0 });
            Ok(text.clone())
        }
        [PreviewSegment::Unresolved {
            text,
            source,
            reason,
        }] => {
            assert_eq!(text, "{{d}}");
            assert_eq!(source, &Some(PreviewSource::Local { index: 0 }));
            Err(*reason)
        }
        other => panic!("{params}: unexpected segments {other:?}"),
    }
} // End of function date_of()

const ISO_MINUTES: &str = "format: '%Y-%m-%d %H:%M:%S %:z'";

#[test]
fn spring_forward_in_a_named_zone() {
    let zone = || named("Europe/Madrid");
    // 00:59:59Z is still CET (+01:00); one second later is CEST (+02:00): the
    // wall clock jumps from 01:59:59 to 03:00:00.
    assert_eq!(
        date_of(ISO_MINUTES, &at(SPRING_DAY + 3_599, zone())),
        Ok("2024-03-31 01:59:59 +01:00".to_owned())
    );
    assert_eq!(
        date_of(ISO_MINUTES, &at(SPRING_DAY + 3_600, zone())),
        Ok("2024-03-31 03:00:00 +02:00".to_owned())
    );
    // The same instants in an explicit `tz` read the same, whatever the
    // request's zone says.
    let explicit = "format: '%Y-%m-%d %H:%M:%S %:z'\ntz: Europe/Madrid";
    assert_eq!(
        date_of(explicit, &at(SPRING_DAY + 3_600, fixed(-36_000))),
        Ok("2024-03-31 03:00:00 +02:00".to_owned())
    );
} // End of function spring_forward_in_a_named_zone()

#[test]
fn fall_back_in_a_named_zone_repeats_the_wall_clock() {
    let explicit = "format: '%Y-%m-%d %H:%M:%S %:z'\ntz: Europe/Madrid";
    // 00:30Z is 02:30 CEST; 01:30Z is 02:30 CET — the same wall time twice,
    // told apart by the offset.
    assert_eq!(
        date_of(explicit, &at(AUTUMN_DAY + 1_800, fixed(0))),
        Ok("2024-10-27 02:30:00 +02:00".to_owned())
    );
    assert_eq!(
        date_of(explicit, &at(AUTUMN_DAY + 5_400, fixed(0))),
        Ok("2024-10-27 02:30:00 +01:00".to_owned())
    );
    assert_eq!(
        date_of(ISO_MINUTES, &at(AUTUMN_DAY + 3_599, named("Europe/Madrid"))),
        Ok("2024-10-27 02:59:59 +02:00".to_owned())
    );
    assert_eq!(
        date_of(ISO_MINUTES, &at(AUTUMN_DAY + 3_600, named("Europe/Madrid"))),
        Ok("2024-10-27 02:00:00 +01:00".to_owned())
    );
} // End of function fall_back_in_a_named_zone_repeats_the_wall_clock()

#[test]
fn a_request_zone_prints_an_offset_and_a_tz_prints_an_abbreviation() {
    // The request's zone stands in for the system zone and is written as a
    // fixed offset; a `tz` parameter's zone is written by chrono-tz.
    assert_eq!(
        date_of("format: '%Z'", &at(SPRING_DAY, named("Europe/Madrid"))),
        Ok("+01:00".to_owned())
    );
    assert_eq!(
        date_of("format: '%Z'\ntz: Europe/Madrid", &at(SPRING_DAY, fixed(0))),
        Ok("CET".to_owned())
    );
    assert_eq!(
        date_of(
            "format: '%Z'\ntz: Europe/Madrid",
            &at(SPRING_DAY + 3_600, fixed(0))
        ),
        Ok("CEST".to_owned())
    );
} // End of function a_request_zone_prints_an_offset_and_a_tz_prints_an_abbreviation()

#[test]
fn day_boundaries_follow_the_zone() {
    let format = "format: '%Y-%m-%d %H:%M %a'\nlocale: en-US";
    // 2024-12-31T23:30Z, read in five zones: the year changes east of UTC.
    for (zone, expected) in [
        (fixed(0), "2024-12-31 23:30 Tue"),
        (fixed(3_600), "2025-01-01 00:30 Wed"),
        (fixed(-3_600), "2024-12-31 22:30 Tue"),
        (fixed(19_800), "2025-01-01 05:00 Wed"),
        (named("America/New_York"), "2024-12-31 18:30 Tue"),
        (named("Pacific/Kiritimati"), "2025-01-01 13:30 Wed"),
    ] {
        assert_eq!(
            date_of(format, &at(YEAR_END, zone.clone())),
            Ok(expected.to_owned()),
            "{zone:?}"
        );
    } // End of the loop over the zones
      // The widest fixed offsets a zone may carry, and one past each.
    assert_eq!(
        date_of("format: '%H:%M:%S'", &at(YEAR_END, fixed(86_399))),
        Ok("23:29:59".to_owned())
    );
    for outside in [86_400, -86_400, i32::MAX, i32::MIN] {
        assert_eq!(
            date_of("format: '%H'", &at(YEAR_END, fixed(outside))),
            Err(PreviewUnresolved::ZoneUnsupported),
            "{outside}"
        );
    } // End of the loop over the out-of-range fixed offsets
} // End of function day_boundaries_follow_the_zone()

#[test]
fn an_offset_moves_the_instant_across_boundaries() {
    let format = "format: '%Y-%m-%d %H:%M'";
    // One hour after 2024-02-28T23:00Z is the leap day.
    assert_eq!(
        date_of(&format!("{format}\noffset: 3600"), &at(LEAP_EVE, fixed(0))),
        Ok("2024-02-29 00:00".to_owned())
    );
    // A day back from just after the year boundary.
    assert_eq!(
        date_of(
            &format!("{format}\noffset: -86400"),
            &at(YEAR_END + 1_800, fixed(0))
        ),
        Ok("2024-12-31 00:00".to_owned())
    );
    // An offset crossing a DST change lands on the other side of it, in the
    // other offset: 00:30Z + 1h = 01:30Z, 03:30 CEST.
    assert_eq!(
        date_of(
            "format: '%H:%M %:z'\noffset: 3600",
            &at(SPRING_DAY + 1_800, named("Europe/Madrid"))
        ),
        Ok("03:30 +02:00".to_owned())
    );
    assert_eq!(
        date_of(&format!("{format}\noffset: 0"), &at(LEAP_EVE, fixed(0))),
        Ok("2024-02-28 23:00".to_owned())
    );
} // End of function an_offset_moves_the_instant_across_boundaries()

#[test]
fn an_absent_format_is_rfc_2822() {
    assert_eq!(
        date_of("", &at(SPRING_DAY + 3_600, named("Europe/Madrid"))),
        Ok("Sun, 31 Mar 2024 03:00:00 +0200".to_owned())
    );
    assert_eq!(
        date_of("tz: America/New_York", &at(YEAR_END, fixed(0))),
        Ok("Tue, 31 Dec 2024 18:30:00 -0500".to_owned())
    );
    // RFC 2822 needs a four-digit year, in the zone it is written in.
    assert_eq!(
        date_of("", &at(LAST_FOUR_DIGIT_SECOND, fixed(0))),
        Ok("Fri, 31 Dec 9999 23:59:59 +0000".to_owned())
    );
    assert_eq!(
        date_of("", &at(LAST_FOUR_DIGIT_SECOND + 1, fixed(0))),
        Err(PreviewUnresolved::DateOutOfRange)
    );
    assert_eq!(
        date_of("", &at(LAST_FOUR_DIGIT_SECOND, fixed(1))),
        Err(PreviewUnresolved::DateOutOfRange)
    );
    // A strftime year has no such limit.
    assert_eq!(
        date_of("format: '%Y'", &at(LAST_FOUR_DIGIT_SECOND + 1, fixed(0))),
        Ok("+10000".to_owned())
    );
} // End of function an_absent_format_is_rfc_2822()

#[test]
fn malformed_formats_are_a_code_never_a_panic() {
    let samples = at(SPRING_DAY, fixed(0));
    for format in [
        "'%Q'",
        "'%Y-%'",
        "'%'",
        "'%.2f'",
        "'%#Y'",
        "'%:'",
        "'%-'",
        "'ok %Y %E'",
        // chrono takes no padding modifier on a name.
        "'%-b'",
    ] {
        assert_eq!(
            date_of(&format!("format: {format}"), &samples),
            Err(PreviewUnresolved::DateFormatMalformed),
            "{format}"
        );
    } // End of the loop over the malformed formats
      // Well-formed neighbours of the same specifiers.
    for (format, expected) in [
        ("'%%Q'", "%Q"),
        ("'100%%'", "100%"),
        ("'%3f|%s'", "000|1711843200"),
        ("'%-d/%-m'", "31/3"),
        ("''", ""),
    ] {
        let preview = preview_of(&date_match(&format!("format: {format}")), &samples);
        let text: String = preview.bodies[0]
            .segments
            .iter()
            .map(|segment| match segment {
                PreviewSegment::Sample { text, .. } => text.clone(),
                other => panic!("{format}: {other:?}"),
            })
            .collect();
        assert_eq!(text, expected, "{format}");
    } // End of the loop over the well-formed formats
      // A format that is not one scalar is unreadable, and an ambiguous plain
      // scalar is not read as a format.
    assert_eq!(
        date_of("format: [a]", &samples),
        Err(PreviewUnresolved::ValueUnreadable)
    );
    assert_eq!(
        date_of("format: yes", &samples),
        Err(PreviewUnresolved::AmbiguousScalar)
    );
} // End of function malformed_formats_are_a_code_never_a_panic()

#[test]
fn malformed_offsets_are_a_code() {
    let samples = at(SPRING_DAY, fixed(0));
    for offset in [
        "'3600'", "\"3600\"", "+3600", "03600", "00", "-0", "1.5", "1e3", "0x10", "1_000",
        "one hour", "''", "", "[1]", "{s: 1}", "1:00",
    ] {
        assert_eq!(
            date_of(&format!("format: '%H'\noffset: {offset}"), &samples),
            Err(PreviewUnresolved::DateOffsetMalformed),
            "{offset:?}"
        );
    } // End of the loop over the malformed offsets
} // End of function malformed_offsets_are_a_code()

#[test]
fn overflow_is_a_code_at_the_boundary() {
    let samples = at(SPRING_DAY, fixed(0));
    // An offset beyond i64, and one inside i64 but beyond chrono's durations.
    for offset in [
        "99999999999999999999",
        "9223372036854775807",
        "-9223372036854775808",
    ] {
        assert_eq!(
            date_of(&format!("format: '%Y'\noffset: {offset}"), &samples),
            Err(PreviewUnresolved::DateOutOfRange),
            "{offset}"
        );
    } // End of the loop over the overflowing offsets
      // The instant plus the offset must lie two days inside chrono's range.
      // The bounds are chrono's constants, not a clock reading.
    let margin = 2 * 86_400;
    let latest = chrono::DateTime::<chrono::Utc>::MAX_UTC.timestamp() - margin;
    let earliest = chrono::DateTime::<chrono::Utc>::MIN_UTC.timestamp() + margin;
    let format = "format: '%Y'";
    assert!(date_of(format, &at(latest, fixed(86_399))).is_ok());
    assert!(date_of(format, &at(earliest, fixed(-86_399))).is_ok());
    for (instant, offset) in [
        (latest + 1, ""),
        (earliest - 1, ""),
        (latest, "\noffset: 1"),
        (earliest, "\noffset: -1"),
        (i64::MAX, ""),
        (i64::MIN, ""),
    ] {
        assert_eq!(
            date_of(&format!("{format}{offset}"), &at(instant, fixed(0))),
            Err(PreviewUnresolved::DateOutOfRange),
            "{instant}{offset}"
        );
    } // End of the loop over the out-of-range instants
      // Inside the range, an offset can bring an instant back in.
    assert!(date_of(&format!("{format}\noffset: -1"), &at(latest + 1, fixed(0))).is_ok());
} // End of function overflow_is_a_code_at_the_boundary()

#[test]
fn unknown_zones_are_a_code() {
    let samples = at(SPRING_DAY, fixed(0));
    for tz in [
        "Mars/Olympus",
        "europe/madrid",
        "'Europe/Madrid '",
        "''",
        "CEST",
    ] {
        assert_eq!(
            date_of(&format!("format: '%H'\ntz: {tz}"), &samples),
            Err(PreviewUnresolved::ZoneUnsupported),
            "{tz}"
        );
    } // End of the loop over the unknown zones
    assert_eq!(
        date_of("format: '%H'\ntz: [UTC]", &samples),
        Err(PreviewUnresolved::ValueUnreadable)
    );
    assert_eq!(
        date_of("format: '%H'", &at(SPRING_DAY, named("Nowhere/Special"))),
        Err(PreviewUnresolved::ZoneUnsupported)
    );
    // A `tz` replaces the request's zone, so a bad request zone is not read.
    assert_eq!(
        date_of("format: '%H'\ntz: UTC", &at(SPRING_DAY, named("Nowhere"))),
        Ok("00".to_owned())
    );
    // Links in the database resolve as the database writes them.
    assert_eq!(
        date_of("format: '%H'\ntz: US/Eastern", &samples),
        Ok("20".to_owned())
    );
} // End of function unknown_zones_are_a_code()

#[test]
fn locale_dependent_formats_answer_locale_unsupported() {
    let samples = at(SPRING_DAY, fixed(0));
    for (params, expected) in [
        // Names without a locale: the system locale is not simulated.
        ("format: '%A'", Err(PreviewUnresolved::LocaleUnsupported)),
        ("format: '%b'", Err(PreviewUnresolved::LocaleUnsupported)),
        ("format: '%v'", Err(PreviewUnresolved::LocaleUnsupported)),
        (
            "format: '%A'\nlocale: es-ES",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        (
            "format: '%A'\nlocale: english",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        (
            "format: '%A'\nlocale: en-",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        // Locale layouts and AM/PM markers, even in English.
        (
            "format: '%c'\nlocale: en-US",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        (
            "format: '%x'\nlocale: en-US",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        (
            "format: '%X'\nlocale: en",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        (
            "format: '%r'\nlocale: en",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        (
            "format: '%I %p'\nlocale: en",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        (
            "format: '%P'\nlocale: en",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        // English day and month names.
        (
            "format: '%A %d %B, %a %b %h'\nlocale: en-US",
            Ok("Sunday 31 March, Sun Mar Mar"),
        ),
        ("format: '%v'\nlocale: en_GB", Ok("31-Mar-2024")),
        // A bare `en` has no locale data of its own (review of 4-18).
        (
            "format: '%A'\nlocale: en",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        // A locale-independent format ignores the locale.
        ("format: '%Y-%m-%d'\nlocale: es-ES", Ok("2024-03-31")),
        ("format: '%%A %%c'", Ok("%A %c")),
    ] {
        assert_eq!(
            date_of(params, &samples),
            expected.map(str::to_owned),
            "{params}"
        );
    } // End of the loop over the locale cases
} // End of function locale_dependent_formats_answer_locale_unsupported()

#[test]
fn a_date_needs_an_instant_from_the_request() {
    assert_eq!(
        date_of("format: '%Y'", &PreviewSamples::default()),
        Err(PreviewUnresolved::DateInstantMissing)
    );
    // What the file writes is judged first: a malformed format answers that,
    // with or without an instant.
    assert_eq!(
        date_of("format: '%Q'", &PreviewSamples::default()),
        Err(PreviewUnresolved::DateFormatMalformed)
    );
} // End of function a_date_needs_an_instant_from_the_request()

#[test]
fn identical_requests_give_identical_dates() {
    let source = "\
matches:
  - trigger: ':d'
    replace: 'On {{e}} and {{d}}'
    vars:
      - name: d
        type: date
        params:
          format: '%Y-%m-%d %H:%M %:z'
          offset: -60
      - name: e
        type: echo
        params:
          echo: 'day {{d}}'
";
    let samples = at(YEAR_END, named("Europe/Madrid"));
    let first = preview_of(source, &samples);
    assert_eq!(first, preview_of(source, &samples.clone()));
    assert_eq!(
        first.bodies[0].segments,
        vec![
            PreviewSegment::Literal {
                text: "On ".to_owned()
            },
            PreviewSegment::Sample {
                text: "day ".to_owned(),
                source: PreviewSource::Local { index: 1 }
            },
            PreviewSegment::Sample {
                text: "2025-01-01 00:29 +01:00".to_owned(),
                source: PreviewSource::Local { index: 0 }
            },
            PreviewSegment::Literal {
                text: " and ".to_owned()
            },
            PreviewSegment::Sample {
                text: "2025-01-01 00:29 +01:00".to_owned(),
                source: PreviewSource::Local { index: 0 }
            },
        ]
    );
    // Another instant is another answer, so the equality is not vacuous.
    assert_ne!(
        preview_of(source, &at(YEAR_END + 60, named("Europe/Madrid"))),
        first
    );
} // End of function identical_requests_give_identical_dates()

#[test]
fn a_referenced_format_is_not_substituted() {
    let source = |inject: &str| {
        format!(
            "matches:\n  - trigger: ':d'\n    replace: '{{{{d}}}}'\n    vars:\n      - name: x\n        type: echo\n        params:\n          echo: X\n      - name: d\n        type: date\n{inject}        params:\n          format: '{{{{x}}}} %Y'\n"
        )
    };
    let samples = at(SPRING_DAY, fixed(0));
    let segments = |text: &str| preview_of(text, &samples).bodies[0].segments.clone();
    assert!(matches!(
        segments(&source("")).as_slice(),
        [PreviewSegment::Unresolved {
            reason: PreviewUnresolved::ValueUnreadable,
            ..
        }]
    ));
    assert_eq!(
        segments(&source("        inject_vars: false\n")),
        vec![PreviewSegment::Sample {
            text: "{{x}} 2024".to_owned(),
            source: PreviewSource::Local { index: 1 }
        }]
    );
} // End of function a_referenced_format_is_not_substituted()

#[test]
fn a_date_text_is_bounded_by_the_output_budget() {
    let samples = at(SPRING_DAY, fixed(0));
    let limits = |output_bytes| PreviewLimits {
        output_bytes,
        ..PreviewLimits::DEFAULT
    };
    let source = date_match("format: '%Y-%m-%d'");
    let exact = preview_with(&source, &samples, limits(10));
    assert_eq!(exact.limit, None);
    assert_eq!(
        exact.bodies[0].segments,
        vec![PreviewSegment::Sample {
            text: "2024-03-31".to_owned(),
            source: PreviewSource::Local { index: 0 }
        }]
    );
    let cut = preview_with(&source, &samples, limits(9));
    assert_eq!(cut.limit, Some(PreviewLimit::OutputBytes));
    assert_eq!(
        cut.bodies[0].segments,
        vec![PreviewSegment::Sample {
            text: "2024-03-3".to_owned(),
            source: PreviewSource::Local { index: 0 }
        }]
    );
    // `%+` writes 25 bytes from two: 4 000 of them would write 100 000 bytes,
    // more than the whole budget. The writer stops at the budget.
    let long = date_match(&format!("format: '{}'", "%+".repeat(4_000)));
    let preview = preview_of(&long, &samples);
    assert_eq!(preview.limit, Some(PreviewLimit::OutputBytes));
    let written: usize = preview.bodies[0]
        .segments
        .iter()
        .map(|segment| match segment {
            PreviewSegment::Sample { text, .. } => text.len(),
            other => panic!("{other:?}"),
        })
        .sum();
    assert_eq!(written, MAX_PREVIEW_OUTPUT_BYTES);
} // End of function a_date_text_is_bounded_by_the_output_budget()

#[test]
fn the_instant_reads_and_writes_exactly_and_refuses_unknown_fields() {
    let good = serde_json::json!({
        "selections": [],
        "form_values": [],
        "captures": [],
        "instant": { "unix_seconds": 1_711_843_200_i64, "zone": { "Named": { "name": "Europe/Madrid" } } },
    });
    let read: PreviewSamples = serde_json::from_value(good.clone()).expect("reads");
    assert_eq!(serde_json::to_value(&read).expect("writes"), good);
    let fixed_zone = serde_json::json!({ "Fixed": { "offset_seconds": -3600 } });
    let zone: SampleZone = serde_json::from_value(fixed_zone.clone()).expect("reads");
    assert_eq!(zone, fixed(-3_600));
    assert_eq!(serde_json::to_value(&zone).expect("writes"), fixed_zone);
    // Unknown fields are refused at every level.
    let mut extra = good.clone();
    extra["instant"]["now"] = serde_json::json!(true);
    assert!(serde_json::from_value::<PreviewSamples>(extra).is_err());
    let mut extra = good.clone();
    extra["instant"]["zone"]["Named"]["local"] = serde_json::json!(true);
    assert!(serde_json::from_value::<PreviewSamples>(extra).is_err());
    let mut other = good.clone();
    other["instant"]["zone"] = serde_json::json!({ "System": {} });
    assert!(serde_json::from_value::<PreviewSamples>(other).is_err());
    // An absent instant reads as none and is written as null.
    let without = serde_json::json!({ "selections": [], "form_values": [], "captures": [] });
    let read: PreviewSamples = serde_json::from_value(without).expect("reads");
    assert_eq!(read.instant, None);
    assert_eq!(
        serde_json::to_value(&read).expect("writes")["instant"],
        serde_json::Value::Null
    );
} // End of function the_instant_reads_and_writes_exactly_and_refuses_unknown_fields()

// ---------------------------------------------------------------------------
// No clock, no local zone
// ---------------------------------------------------------------------------

/// The crate's own directory.
const CRATE: &str = env!("CARGO_MANIFEST_DIR");

/// The lines of `relative` (under the crate) that are not comments.
fn code_lines(relative: &str) -> Vec<(usize, String)> {
    let path = format!("{CRATE}/{relative}");
    let text = std::fs::read_to_string(&path).unwrap_or_else(|error| panic!("{path}: {error}"));
    text.lines()
        .enumerate()
        .filter(|(_, line)| !line.trim_start().starts_with("//"))
        .map(|(number, line)| (number + 1, line.to_owned()))
        .collect()
} // End of function code_lines()

/// Every `.rs` file under `relative`, relative to the crate.
fn rust_files(relative: &str) -> Vec<String> {
    let mut found = Vec::new();
    let mut pending = vec![format!("{CRATE}/{relative}")];
    while let Some(directory) = pending.pop() {
        for entry in std::fs::read_dir(&directory).expect("reads the directory") {
            let path = entry.expect("reads an entry").path();
            if path.is_dir() {
                pending.push(path.to_string_lossy().into_owned());
            } else if path.extension().is_some_and(|extension| extension == "rs") {
                let full = path.to_string_lossy().into_owned();
                found.push(full[CRATE.len() + 1..].to_owned());
            }
        } // End of the loop over one directory's entries
    } // End of the walk
    found.sort();
    found
} // End of function rust_files()

#[test]
fn no_preview_module_or_date_test_reads_a_clock_or_the_local_zone() {
    // Built from pieces so this file does not match its own scan.
    let forbidden: Vec<String> = [
        ["::", "now("],
        ["Local", "::"],
        ["offset::", "Local"],
        ["chrono::", "Local"],
        ["System", "Time"],
        ["Instant", "::"],
        ["today", "("],
        ["iana_time", "_zone"],
        ["var(", "\"TZ"],
    ]
    .iter()
    .map(|pieces| pieces.concat())
    .collect();
    let scanned = [
        "src/preview.rs",
        "src/preview/date.rs",
        "tests/preview.rs",
        "tests/date_preview.rs",
    ];
    let mut hits = Vec::new();
    for file in scanned {
        for (number, line) in code_lines(file) {
            for pattern in &forbidden {
                if line.contains(pattern.as_str()) {
                    hits.push(format!("{file}:{number}: {pattern}"));
                }
            }
        } // End of the loop over one file's lines
    } // End of the loop over the scanned files
    assert!(hits.is_empty(), "clock or local-zone reads: {hits:#?}");
    // The scan reads what it claims to: the date module does name chrono.
    assert!(code_lines("src/preview/date.rs")
        .iter()
        .any(|(_, line)| line.contains("use chrono::")));
} // End of function no_preview_module_or_date_test_reads_a_clock_or_the_local_zone()

#[test]
fn chrono_is_confined_to_the_date_module() {
    let names = [["chr", "ono"].concat(), ["chr", "ono_tz"].concat()];
    let mut outside = Vec::new();
    for file in rust_files("src") {
        if file == "src/preview/date.rs" {
            continue;
        }
        for (number, line) in code_lines(&file) {
            let mentions = names.iter().any(|name| {
                line.contains(&format!("{name}::")) || line.contains(&format!("use {name}"))
            });
            if mentions {
                outside.push(format!("{file}:{number}"));
            }
        } // End of the loop over one file's lines
    } // End of the loop over the crate's sources
    assert!(
        outside.is_empty(),
        "chrono outside the date module: {outside:?}"
    );
    assert!(rust_files("src").contains(&"src/preview/date.rs".to_owned()));
} // End of function chrono_is_confined_to_the_date_module()

/// `preview_match` is the function the command calls; one date through it,
/// so the default-limits entry point is exercised too.
#[test]
fn the_command_entry_point_previews_a_date() {
    let context = DocumentContext {
        id: DocumentId(2),
        path: std::path::PathBuf::from("/nowhere/base.yml"),
        relative_path: std::path::PathBuf::from("base.yml"),
        kind: FileKind::MatchFile,
        disabled: false,
    };
    let document = project_source(&context, &date_match("format: '%F'"));
    let preview = preview_match(
        &document.view,
        &document.view.matches[0],
        &at(LEAP_EVE, fixed(3_600)),
    );
    assert_eq!(
        preview.bodies[0].segments,
        vec![PreviewSegment::Sample {
            text: "2024-02-29".to_owned(),
            source: PreviewSource::Local { index: 0 }
        }]
    );
} // End of function the_command_entry_point_previews_a_date()

// ---------------------------------------------------------------------------
// Review fixes (docs/reviews/4-18.md)
// ---------------------------------------------------------------------------

/// [`date_of`] under explicit limits.
fn date_with(
    params: &str,
    samples: &PreviewSamples,
    limits: PreviewLimits,
) -> (Result<String, PreviewUnresolved>, Option<PreviewLimit>) {
    let preview = preview_with(&date_match(params), samples, limits);
    let answer = match preview.bodies[0].segments.as_slice() {
        [PreviewSegment::Sample { text, .. }] => Ok(text.clone()),
        [PreviewSegment::Unresolved { reason, .. }] => Err(*reason),
        other => panic!("{params}: unexpected segments {other:?}"),
    };
    (answer, preview.limit)
} // End of function date_with()

#[test]
fn a_huge_repeated_format_is_stopped_at_the_work_budget() {
    let samples = at(SPRING_DAY, fixed(0));
    // 100 000 `%c` are 200 000 bytes of format and 1 300 000 items, more than
    // the 1 MiB work budget: the walk stops there, before any locale check.
    let huge = format!("format: '{}'", "%c".repeat(100_000));
    assert_eq!(
        date_with(&huge, &samples, PreviewLimits::DEFAULT),
        (Err(PreviewUnresolved::WorkLimit), Some(PreviewLimit::Work))
    );
    // At the boundary: each `%c` is 13 items.
    let work = |work| PreviewLimits {
        work,
        ..PreviewLimits::DEFAULT
    };
    let repeated = |count: usize| format!("format: '{}'", "%c".repeat(count));
    assert_eq!(
        date_with(&repeated(10), &samples, work(130)).0,
        Err(PreviewUnresolved::LocaleUnsupported)
    );
    assert_eq!(
        date_with(&repeated(11), &samples, work(130)),
        (Err(PreviewUnresolved::WorkLimit), Some(PreviewLimit::Work))
    );
} // End of function a_huge_repeated_format_is_stopped_at_the_work_budget()

#[test]
fn validating_a_format_is_charged_besides_its_text() {
    let samples = at(SPRING_DAY, fixed(0));
    // Ten `%Y`: ten items, forty bytes of text and one segment — 51 units.
    let format = format!("format: '{}'", "%Y".repeat(10));
    let work = |work| PreviewLimits {
        work,
        ..PreviewLimits::DEFAULT
    };
    assert_eq!(
        date_with(&format, &samples, work(51)),
        (Ok("2024".repeat(10)), None)
    );
    assert_eq!(
        date_with(&format, &samples, work(50)),
        (Err(PreviewUnresolved::WorkLimit), Some(PreviewLimit::Work))
    );
} // End of function validating_a_format_is_charged_besides_its_text()

#[test]
fn dotted_fractions_depend_on_the_locale() {
    let samples = at(SPRING_DAY, fixed(0));
    for (params, expected) in [
        // The locale's decimal point is not simulated.
        (
            "format: '%S%.3f'\nlocale: es_ES",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        (
            "format: '%S%.6f'",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        (
            "format: '%S%.9f'\nlocale: es-ES",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        // English regions whose data writes a comma.
        (
            "format: '%S%.3f'\nlocale: en_DK",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        (
            "format: '%S%.3f'\nlocale: en_ZM",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        (
            "format: '%S%.3f'\nlocale: en",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        // English regions whose data writes a point.
        ("format: '%S%.3f'\nlocale: en_US", Ok("00.000")),
        ("format: '%S%.6f'\nlocale: en-GB", Ok("00.000000")),
        ("format: '%S%.9f'\nlocale: en_IN", Ok("00.000000000")),
        // No decimal point is written by these for a whole-second instant.
        ("format: '%S%.f'\nlocale: es_ES", Ok("00")),
        (
            "format: '%S %3f %6f %9f'\nlocale: es_ES",
            Ok("00 000 000000 000000000"),
        ),
        ("format: '%S%%.3f'\nlocale: es_ES", Ok("00%.3f")),
        // Names: `en_ZW`'s data holds other names; `en_DK`'s are English.
        (
            "format: '%A'\nlocale: en_ZW",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
        ("format: '%A'\nlocale: en_DK", Ok("Sunday")),
        (
            "format: '%A'\nlocale: en_us",
            Err(PreviewUnresolved::LocaleUnsupported),
        ),
    ] {
        assert_eq!(
            date_of(params, &samples),
            expected.map(str::to_owned),
            "{params}"
        );
    } // End of the loop over the fraction cases
} // End of function dotted_fractions_depend_on_the_locale()
