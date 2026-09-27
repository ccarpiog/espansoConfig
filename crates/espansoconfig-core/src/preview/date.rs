//! The date preview (Phase 4-18): one `type: date` variable's text for the
//! instant and zone the request supplies.
//!
//! # What it reads, and how
//!
//! Espanso's date extension takes four parameters (plan section 3.4):
//! `format` (chrono strftime), `offset` (seconds), `tz` (an IANA name) and
//! `locale`. This module reads them as follows, and says what it does **not**
//! establish about espanso (R16 stays open):
//!
//! | Parameter | Read here as |
//! |---|---|
//! | `format` absent | RFC 2822, `to_rfc2822()` — what the validator's transcribed source says (`validate::required_param`'s notes) |
//! | `format` | a decoded, non-ambiguous scalar validated by walking chrono's `StrftimeItems` lazily — **nothing collected**, one work unit charged per item, stopping at the work budget ([`PreviewUnresolved::WorkLimit`]); any `Item::Error` is [`PreviewUnresolved::DateFormatMalformed`], never a panic |
//! | `offset` | only a **plain** scalar spelled `0` or `-?[1-9][0-9]*` — a decimal integer YAML 1.1 and 1.2 core read identically; anything else (quoted, leading zero, sign `+`, float, hex, text) is [`PreviewUnresolved::DateOffsetMalformed`] |
//! | `tz` | a decoded, non-ambiguous scalar naming a zone `chrono-tz` knows (IANA tzdb 2025b), matched exactly; otherwise [`PreviewUnresolved::ZoneUnsupported`] |
//! | `locale` | consulted only when the format needs one (below) |
//!
//! # The instant and the zone come in the request
//!
//! **Nothing here reads a clock or the local zone.** The instant is
//! [`SampleInstant::unix_seconds`]; the zone standing in for the system zone is
//! [`SampleInstant::zone`]. The core's `chrono` is built with default features
//! off (no `clock`), and a source scan in `tests/date_preview.rs` fails on a
//! `now()`, a `Local` or a `SystemTime` anywhere in the preview modules and
//! the date tests. A `tz` parameter replaces the request's zone, as espanso's
//! own `tz` replaces the system zone.
//!
//! A request zone is formatted the way chrono formats its `Local` zone — a
//! **fixed** offset at that instant, so `%Z` prints `+02:00` — while a `tz`
//! parameter's zone is formatted by `chrono-tz`, whose `%Z` prints the
//! abbreviation (`CEST`). Which of the two espanso prints is not established
//! here.
//!
//! # Locale
//!
//! Without `locale`, espanso formats in the system locale, which the request
//! does not carry; this preview never simulates one (the consult's Q6). So a
//! format whose output depends on a locale — `%a %A %b %B %h %v` (day and month
//! names), `%.3f %.6f %.9f` (a fraction written after the locale's decimal
//! point), `%c %x %X %r` (locale date and time layouts), `%p %P` (AM/PM
//! markers) — answers [`PreviewUnresolved::LocaleUnsupported`], with two
//! exceptions measured against the locale data chrono's localized formatter
//! reads (`pure-rust-locales` 0.8.1): day and month names are formatted under
//! an explicit `locale` in [`ENGLISH_NAMES`], and dotted fractions under one in
//! [`POINT_DECIMALS`] — the English regions whose data writes the names this
//! crate writes, or a `.` decimal point. `%.f` and `%3f %6f %9f` are not
//! locale-dependent here: every sample instant is a whole second, so `%.f`
//! writes nothing, and the undotted forms write digits only. A format with none
//! of these is locale-independent and is formatted whatever `locale` says.
//!
//! # Bounds
//!
//! The instant plus the offset must lie at least two days inside chrono's
//! representable range, so no zone's offset can carry the local time out of it
//! ([`PreviewUnresolved::DateOutOfRange`]); an offset that does not fit a
//! chrono duration is out of range too. RFC 2822 needs a four-digit year. The
//! formatted text is written through a writer that stops at the output budget,
//! so a format that repeats `%+` cannot build more than the budget; a cut text
//! reports [`PreviewLimit::OutputBytes`]. The format itself is never collected
//! into a list: it is validated by one lazy walk that charges each item to the
//! work budget and gives up the moment the budget is spent, and formatting
//! walks the same lazy iterator again, straight into the bounded writer.

use std::fmt;

use chrono::format::{Item, StrftimeItems};
use chrono::offset::{FixedOffset, TimeZone, Utc};
use chrono::{DateTime, Datelike, TimeDelta};
use chrono_tz::Tz;

use super::{param, prefix, usable, PreviewLimit, PreviewUnresolved, SampleInstant, SampleZone};
use crate::analysis::{scan_references, Injection};
use crate::model::{ValueView, VariableView};
use crate::syntax::ScalarStyle;
use crate::validate::params_are_readable;

/// How much of chrono's range is kept clear at each end: two days, more than
/// any zone's offset, so converting to a zone can never leave the range.
const RANGE_MARGIN_SECONDS: i64 = 2 * 86_400;

/// The English regions whose locale data (`pure-rust-locales` 0.8.1, the data
/// chrono's localized formatter reads) writes day and month names exactly as
/// this crate's unlocalized chrono does. `en_ZW` is absent: its data holds
/// other names. Written `en_XX` or `en-XX`, region in capitals.
const ENGLISH_NAMES: &[&str] = &[
    "AG", "AU", "BW", "CA", "DK", "GB", "HK", "IE", "IL", "IN", "NG", "NZ", "PH", "SC", "SG", "US",
    "ZA", "ZM",
];

/// The English regions whose locale data (`pure-rust-locales` 0.8.1) writes
/// `.` as the decimal point and the names of [`ENGLISH_NAMES`]. `en_DK`,
/// `en_ZM` and `en_ZW` write `,`.
const POINT_DECIMALS: &[&str] = &[
    "AG", "AU", "BW", "CA", "GB", "HK", "IE", "IL", "IN", "NG", "NZ", "PH", "SC", "SG", "US", "ZA",
];

/// A date variable's previewed text.
pub(super) struct DateText {
    /// The text, at most the output budget.
    pub(super) text: String,
    /// The limit reached while writing it, when one was.
    pub(super) limit: Option<PreviewLimit>,
    /// The work units validating the format cost (one per item), for the
    /// caller to charge besides the text.
    pub(super) work: usize,
}

/// What the format asks for.
enum Format<'f> {
    /// No `format`: RFC 2822.
    Rfc2822,
    /// A strftime format, already validated; its items are walked lazily.
    Items(&'f str),
}

/// The zone the text is written in.
enum Zone {
    /// The request's zone by IANA name, written as a fixed offset (as chrono
    /// writes its `Local` zone).
    RequestNamed(Tz),
    /// The request's fixed offset.
    RequestFixed(FixedOffset),
    /// The `tz` parameter's zone, written by `chrono-tz`.
    Parameter(Tz),
}

/// Which locale-dependent specifiers a format holds.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
struct LocaleNeeds {
    /// Day or month names: `%a %A %b %B %h %v`.
    names: bool,
    /// A fraction after the decimal point: `%.3f %.6f %.9f`.
    decimals: bool,
    /// Locale layouts or AM/PM markers: `%c %x %X %r %p %P`.
    layouts: bool,
}

/// Previews one `type: date` variable at `instant`.
///
/// Checks run in a fixed order — what the file writes first (`params`,
/// `format`, locale, `offset`, `tz`), then what the request carries — so the
/// same variable and request always answer the same code. `injection` is the
/// variable's `inject_vars` state: a `format` holding a `{{reference}}` is not
/// substituted here, so it answers [`PreviewUnresolved::ValueUnreadable`]
/// unless injection is certainly disabled. `work_left` is the preview's
/// remaining work budget: validating the format costs one unit per item, and a
/// format needing more answers [`PreviewUnresolved::WorkLimit`] without being
/// walked further.
pub(super) fn preview_date(
    variable: &VariableView,
    instant: Option<&SampleInstant>,
    injection: Injection,
    max_bytes: usize,
    work_left: usize,
) -> Result<DateText, PreviewUnresolved> {
    if !params_are_readable(variable) {
        return Err(PreviewUnresolved::ValueUnreadable);
    }
    let mut work = 0;
    let format = match param(variable, "format") {
        None => Format::Rfc2822,
        Some(ValueView::Scalar(scalar)) => {
            let text = usable(scalar)?;
            if injection != Injection::Disabled && !scan_references(text).is_empty() {
                return Err(PreviewUnresolved::ValueUnreadable);
            }
            work = validated_items(text, work_left)?;
            let needs = locale_needs(text);
            let region = english_region(variable);
            let names_ok = region.is_some_and(|region| ENGLISH_NAMES.contains(&region));
            let decimals_ok = region.is_some_and(|region| POINT_DECIMALS.contains(&region));
            if needs.layouts || (needs.names && !names_ok) || (needs.decimals && !decimals_ok) {
                return Err(PreviewUnresolved::LocaleUnsupported);
            }
            Format::Items(text)
        }
        Some(_) => return Err(PreviewUnresolved::ValueUnreadable),
    };
    let offset = offset_of(variable)?;
    let parameter_zone = match param(variable, "tz") {
        None => None,
        Some(ValueView::Scalar(scalar)) => Some(
            usable(scalar)?
                .parse::<Tz>()
                .map_err(|_| PreviewUnresolved::ZoneUnsupported)?,
        ),
        Some(_) => return Err(PreviewUnresolved::ValueUnreadable),
    };
    let instant = instant.ok_or(PreviewUnresolved::DateInstantMissing)?;
    let zone = match parameter_zone {
        Some(zone) => Zone::Parameter(zone),
        None => request_zone(&instant.zone)?,
    };
    let at = shifted(instant.unix_seconds, offset)?;
    let mut text = match zone {
        Zone::RequestNamed(tz) => written(at.with_timezone(&tz).fixed_offset(), &format, max_bytes),
        Zone::RequestFixed(fixed) => written(at.with_timezone(&fixed), &format, max_bytes),
        Zone::Parameter(tz) => written(at.with_timezone(&tz), &format, max_bytes),
    }?;
    text.work = work;
    Ok(text)
} // End of function preview_date()

/// Walks `format`'s strftime items lazily — **nothing is collected** — and
/// answers how many there are. An `Item::Error` is
/// [`PreviewUnresolved::DateFormatMalformed`]; more than `work_left` items is
/// [`PreviewUnresolved::WorkLimit`], answered the moment the count passes it
/// (the review of 4-18: collecting first let a repeated `%c` allocate thirteen
/// items per two bytes outside every budget).
fn validated_items(format: &str, work_left: usize) -> Result<usize, PreviewUnresolved> {
    let mut count = 0usize;
    for item in StrftimeItems::new(format) {
        if item == Item::Error {
            return Err(PreviewUnresolved::DateFormatMalformed);
        }
        count += 1;
        if count > work_left {
            return Err(PreviewUnresolved::WorkLimit);
        }
    } // End of the walk over the format's items
    Ok(count)
} // End of function validated_items()

/// The `offset` parameter, in seconds; `0` when absent.
///
/// Only a plain scalar spelled `0` or `-?[1-9][0-9]*` is read: those are the
/// spellings YAML 1.1 and YAML 1.2 core both read as the same decimal integer
/// (a leading zero is octal in 1.1, a `+` sign or `_` is not read alike by
/// every loader, and a quoted value is a string). Reading that integer is the
/// consult's "supported textual offset", not a general YAML resolver.
fn offset_of(variable: &VariableView) -> Result<TimeDelta, PreviewUnresolved> {
    let text = match param(variable, "offset") {
        None => return Ok(TimeDelta::zero()),
        Some(ValueView::Scalar(scalar)) if scalar.decoded && scalar.style == ScalarStyle::Plain => {
            scalar.text.as_str()
        }
        Some(_) => return Err(PreviewUnresolved::DateOffsetMalformed),
    };
    let digits = text.strip_prefix('-').unwrap_or(text);
    let well_formed = text == "0"
        || (!digits.is_empty()
            && digits.bytes().all(|byte| byte.is_ascii_digit())
            && !digits.starts_with('0'));
    if !well_formed {
        return Err(PreviewUnresolved::DateOffsetMalformed);
    }
    let seconds: i64 = text
        .parse()
        .map_err(|_| PreviewUnresolved::DateOutOfRange)?;
    TimeDelta::try_seconds(seconds).ok_or(PreviewUnresolved::DateOutOfRange)
} // End of function offset_of()

/// The request's zone, checked.
fn request_zone(zone: &SampleZone) -> Result<Zone, PreviewUnresolved> {
    match zone {
        SampleZone::Named { name } => name
            .parse::<Tz>()
            .map(Zone::RequestNamed)
            .map_err(|_| PreviewUnresolved::ZoneUnsupported),
        SampleZone::Fixed { offset_seconds } => FixedOffset::east_opt(*offset_seconds)
            .map(Zone::RequestFixed)
            .ok_or(PreviewUnresolved::ZoneUnsupported),
    }
} // End of function request_zone()

/// `unix_seconds` plus `offset`, kept [`RANGE_MARGIN_SECONDS`] inside chrono's
/// range.
fn shifted(unix_seconds: i64, offset: TimeDelta) -> Result<DateTime<Utc>, PreviewUnresolved> {
    let at = DateTime::<Utc>::from_timestamp(unix_seconds, 0)
        .and_then(|start| start.checked_add_signed(offset))
        .ok_or(PreviewUnresolved::DateOutOfRange)?;
    let seconds = at.timestamp();
    let earliest = DateTime::<Utc>::MIN_UTC.timestamp() + RANGE_MARGIN_SECONDS;
    let latest = DateTime::<Utc>::MAX_UTC.timestamp() - RANGE_MARGIN_SECONDS;
    if seconds < earliest || seconds > latest {
        return Err(PreviewUnresolved::DateOutOfRange);
    }
    Ok(at)
} // End of function shifted()

/// `at` written as `format` asks, at most `max_bytes` long.
fn written<Z: TimeZone>(
    at: DateTime<Z>,
    format: &Format<'_>,
    max_bytes: usize,
) -> Result<DateText, PreviewUnresolved>
where
    Z::Offset: fmt::Display,
{
    match format {
        Format::Rfc2822 => {
            // `to_rfc2822` panics outside years 0..=9999; refuse first.
            if !(0..=9999).contains(&at.year()) {
                return Err(PreviewUnresolved::DateOutOfRange);
            }
            let text = at.to_rfc2822();
            let cut = text.len() > max_bytes;
            Ok(DateText {
                text: prefix(&text, max_bytes).to_owned(),
                limit: cut.then_some(PreviewLimit::OutputBytes),
                work: 0,
            })
        }
        Format::Items(format) => {
            let mut writer = BoundedWriter {
                text: String::new(),
                max_bytes,
                cut: false,
            };
            // `write_to` streams item by item into the writer, which stops
            // at the budget; `Display` would build the whole text first.
            match at
                .format_with_items(StrftimeItems::new(format))
                .write_to(&mut writer)
            {
                Ok(()) => {}
                Err(_) if writer.cut => {}
                Err(_) => return Err(PreviewUnresolved::DateFormatMalformed),
            }
            Ok(DateText {
                text: writer.text,
                limit: writer.cut.then_some(PreviewLimit::OutputBytes),
                work: 0,
            })
        }
    }
} // End of function written()

/// A `fmt::Write` that keeps at most `max_bytes`, cut on a character
/// boundary, and then refuses everything.
struct BoundedWriter {
    /// What was kept.
    text: String,
    /// The most bytes kept.
    max_bytes: usize,
    /// Whether anything was refused.
    cut: bool,
}

impl fmt::Write for BoundedWriter {
    /// Keeps `piece`, or as much of it as fits and then fails.
    fn write_str(&mut self, piece: &str) -> fmt::Result {
        let room = self.max_bytes - self.text.len();
        if piece.len() <= room {
            self.text.push_str(piece);
            return Ok(());
        }
        self.text.push_str(prefix(piece, room));
        self.cut = true;
        Err(fmt::Error)
    } // End of function write_str()
} // End of impl fmt::Write for BoundedWriter

/// Which locale-dependent specifiers `format` holds. `format` has already
/// parsed without an error, so every `%` begins a specifier chrono accepts:
/// one optional `-`, `_`, `0` or `#`, then the specifier character (`%%` is a
/// literal percent sign). A `.` specifier followed by `3f`, `6f` or `9f` is a
/// dotted fraction; `%.f` is not counted (a whole-second instant writes
/// nothing for it).
fn locale_needs(format: &str) -> LocaleNeeds {
    let bytes = format.as_bytes();
    let mut needs = LocaleNeeds::default();
    let mut at = 0;
    while at < bytes.len() {
        if bytes[at] != b'%' {
            at += 1;
            continue;
        }
        at += 1;
        if at < bytes.len() && matches!(bytes[at], b'-' | b'_' | b'0' | b'#') {
            at += 1;
        }
        match bytes.get(at) {
            Some(b'a' | b'A' | b'b' | b'B' | b'h' | b'v') => needs.names = true,
            Some(b'c' | b'x' | b'X' | b'r' | b'p' | b'P') => needs.layouts = true,
            Some(b'.') if matches!(bytes.get(at + 1), Some(b'3' | b'6' | b'9')) => {
                needs.decimals = true;
            }
            _ => {}
        }
        at += 1;
    } // End of the loop over the format's bytes
    needs
} // End of function locale_needs()

/// The region of the variable's `locale` when it is an English one written
/// `en_XX` or `en-XX` (a decoded, non-ambiguous scalar, the region two capital
/// letters). A bare `en` has no locale data of its own, so it is not English
/// here: what espanso does with it is not established.
fn english_region(variable: &VariableView) -> Option<&str> {
    let Some(ValueView::Scalar(scalar)) = param(variable, "locale") else {
        return None;
    };
    let text = usable(scalar).ok()?;
    let region = text
        .strip_prefix("en_")
        .or_else(|| text.strip_prefix("en-"))?;
    (region.len() == 2 && region.bytes().all(|byte| byte.is_ascii_uppercase())).then_some(region)
} // End of function english_region()
