//! YAML 1.1 implicit type resolution, with the YAML 1.2 core schema beside it.
//!
//! **Phase 0c-3b-2b, and the answer to `PROGRESS.md`'s R16.** The round-trip
//! oracle reparses with `saphyr-parser`, which targets YAML **1.2**; espanso
//! consumes the same file with a YAML **1.1**-ish stack. Agreement with the
//! substrate therefore proves that our two implementations agree, and nothing
//! about what the file means where it is actually read.
//!
//! # Why a table and not a second parser crate
//!
//! The alternative considered and rejected was adopting a second YAML crate as a
//! dev-dependency (`docs/reviews/phase-0c-3b-2b-r16-consultation.md`). A
//! syntax-level reparse is largely theatre here — the bytes outside an edit are
//! already proven identical and every scalar the emitter *writes* is
//! conservatively quoted — while the danger class that actually survives is
//! **implicit type resolution**, which no maintained crate implements for 1.1:
//! libyaml's event parser exposes no application-level resolver, `yaml-rust` 0.4
//! is unmaintained and its resolver is not reliably full 1.1, `yaml-rust2` and
//! `saphyr` target 1.2, and `serde_yaml` is `0.9.34+deprecated`. A wrong second
//! oracle is worse than an honest single one, so this module states the rules
//! directly and owns them.
//!
//! # What "ambiguous" means here
//!
//! [`plain_scalar_is_ambiguous`] is true when a **plain** scalar's text either
//! resolves to something other than a string under YAML 1.1, or resolves
//! differently under 1.1 and 1.2 core. Both halves matter:
//!
//! - the first is the corruption class this crate exists to prevent — a bare
//!   `no` that espanso reads as `false`, a `012` it reads as decimal 10;
//! - the second is the class our own verification cannot see, because the
//!   substrate that reparses every candidate resolves under 1.2.
//!
//! Nothing here is applied to a quoted or block scalar: quoting is exactly the
//! act that suppresses implicit resolution, so a quoted `'no'` is a string in
//! every version of YAML and a `|` block always is one.
//!
//! # The rules, and the two places they deliberately follow implementations
//!
//! The 1.1 productions are transcribed from the YAML 1.1 type repository
//! (`tag:yaml.org,2002:{null,bool,int,float,timestamp,merge,value}`) and the 1.2
//! ones from the 1.2 specification's core schema. **Four** deviations, every one
//! of them towards what a real implementation does rather than what the printed
//! regex says, and every one of them in the direction that reports *more*
//! danger rather than less:
//!
//! - the 1.1 float production `[-+]?([0-9][0-9_]*)?\.[0-9_]*(...)` literally
//!   matches a lone `.`, which no implementation resolves as a float. At least
//!   one digit is required here, as in libyaml and PyYAML;
//! - the timestamp production's time-zone part is accepted with optional
//!   white space before **both** `Z` and a numeric offset, as PyYAML accepts it,
//!   rather than before `Z` alone;
//! - the timestamp production's **date-only** form is printed
//!   `[0-9]{4}-[0-9]{2}-[0-9]{2}`, and PyYAML transcribes it exactly, so
//!   `2001-1-1` is a string there. Ruby's Psych — also a YAML 1.1
//!   implementation — matches `\d{4}-\d{1,2}-\d{1,2}`, and reads it as a date.
//!   One or two digits are accepted here, because a resolver that narrowed the
//!   shape would *under*-report the danger and that is the one direction this
//!   table must never err in. Added by Phase 0c-3b-2b's review;
//! - the 1.2 **core** integer production is printed
//!   `[-+]?[0-9]+ | 0o[0-7]+ | 0x[0-9a-fA-F]+`: no sign on the radix forms and
//!   no underscores anywhere. `go-yaml` v3, a widely used 1.2 consumer, resolves
//!   integers with Go's `ParseInt(_, 0, 64)`, which accepts a sign before a
//!   radix prefix and underscores between digits. Both are accepted here. This
//!   can only ever *add* an ambiguity report — a text YAML 1.1 already resolves
//!   to a non-string is reported by the first half of
//!   [`plain_scalar_is_ambiguous`] whatever the 1.2 side says — so a text this
//!   deviation newly calls an integer is one 1.1 calls a string, and reporting
//!   it means quoting it. Added by Phase 0c-3b-2b's review.
//!
//! All four deviations are recorded in `docs/decisions/0c-3b-2b-notes.md`,
//! together with the residual risk that this table is hand-maintained.
//!
//! # Shape, never arithmetic
//!
//! A text that **matches a production** is classified by that production even
//! when its value does not fit in an `i128`: a 39-digit sexagesimal is an
//! integer to YAML 1.1 whether or not our arithmetic can hold it, and returning
//! `None` on overflow would silently call it a string. Every integer resolver
//! here therefore renders an out-of-range value as `radix#digits` rather than
//! failing. Phase 0c-3b-2b's review found the sexagesimal one still failing.

use std::fmt;

/// The tag an untagged plain scalar resolves to.
///
/// The eight the two schemas between them can produce. [`YamlTag::Merge`] and
/// [`YamlTag::Value`] exist only in 1.1, and [`YamlTag::Timestamp`] only in 1.1
/// as an implicit resolution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum YamlTag {
    /// `tag:yaml.org,2002:str` — the scalar is a string, which is what the
    /// typed projection assumes everywhere.
    Str,
    /// `tag:yaml.org,2002:null`.
    Null,
    /// `tag:yaml.org,2002:bool`.
    Bool,
    /// `tag:yaml.org,2002:int`.
    Int,
    /// `tag:yaml.org,2002:float`.
    Float,
    /// `tag:yaml.org,2002:timestamp` — YAML 1.1 only.
    Timestamp,
    /// `tag:yaml.org,2002:merge` — the `<<` key, YAML 1.1 only.
    Merge,
    /// `tag:yaml.org,2002:value` — the `=` key, YAML 1.1 only.
    Value,
}

impl YamlTag {
    /// The tag's short name, for test output and diagnostics.
    pub fn name(self) -> &'static str {
        match self {
            YamlTag::Str => "str",
            YamlTag::Null => "null",
            YamlTag::Bool => "bool",
            YamlTag::Int => "int",
            YamlTag::Float => "float",
            YamlTag::Timestamp => "timestamp",
            YamlTag::Merge => "merge",
            YamlTag::Value => "value",
        }
    } // End of function name()
}

impl fmt::Display for YamlTag {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.name())
    }
}

/// One resolver's answer about one plain scalar.
///
/// The canonical rendering is carried as well as the tag because the two schemas
/// can agree on the tag and still disagree on the **value**: `012` is
/// `int` in both, decimal 10 under 1.1's octal rule and decimal 12 under 1.2
/// core. A comparison of tags alone would call that a match.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlainResolution {
    /// The tag the resolver assigns.
    pub tag: YamlTag,
    /// A normalised rendering of the resolved value.
    ///
    /// `true`/`false` for booleans, `null` for nulls, the decimal expansion for
    /// integers, `{}`-formatted for floats, and the scalar's own text for
    /// strings, timestamps, `<<` and `=`. An integer too large for `i128` is
    /// rendered as `radix#digits` so two radices can still be told apart.
    pub canonical: String,
}

impl PlainResolution {
    /// Builds a resolution from a tag and an already-normalised rendering.
    fn of(tag: YamlTag, canonical: &str) -> PlainResolution {
        PlainResolution {
            tag,
            canonical: canonical.to_owned(),
        }
    }
}

/// Resolves a **plain** scalar's text under YAML 1.1's implicit type rules.
///
/// The resolution order is the type repository's: null, bool, merge, value, int,
/// float, timestamp, and str for everything else. The order matters only where
/// two productions could both match, which by construction they do not.
pub fn resolve_plain_yaml_1_1(text: &str) -> PlainResolution {
    if matches!(text, "" | "~" | "null" | "Null" | "NULL") {
        return PlainResolution::of(YamlTag::Null, "null");
    }
    if let Some(value) = yaml_1_1_bool(text) {
        return PlainResolution::of(YamlTag::Bool, if value { "true" } else { "false" });
    }
    if text == "<<" {
        return PlainResolution::of(YamlTag::Merge, "<<");
    }
    if text == "=" {
        return PlainResolution::of(YamlTag::Value, "=");
    }
    if let Some(canonical) = yaml_1_1_int(text) {
        return PlainResolution {
            tag: YamlTag::Int,
            canonical,
        };
    }
    if let Some(canonical) = yaml_1_1_float(text) {
        return PlainResolution {
            tag: YamlTag::Float,
            canonical,
        };
    }
    if yaml_1_1_timestamp(text) {
        return PlainResolution::of(YamlTag::Timestamp, text);
    }
    PlainResolution::of(YamlTag::Str, text)
} // End of function resolve_plain_yaml_1_1()

/// Resolves a **plain** scalar's text under the YAML 1.2 **core** schema.
///
/// This is what `saphyr-parser` would resolve the same bytes to if it resolved
/// at all, and therefore what our own verification implicitly believes. The
/// difference between this and [`resolve_plain_yaml_1_1`] is the whole of R16.
pub fn resolve_plain_yaml_1_2_core(text: &str) -> PlainResolution {
    if matches!(text, "" | "~" | "null" | "Null" | "NULL") {
        return PlainResolution::of(YamlTag::Null, "null");
    }
    if matches!(text, "true" | "True" | "TRUE") {
        return PlainResolution::of(YamlTag::Bool, "true");
    }
    if matches!(text, "false" | "False" | "FALSE") {
        return PlainResolution::of(YamlTag::Bool, "false");
    }
    if let Some(canonical) = yaml_1_2_int(text) {
        return PlainResolution {
            tag: YamlTag::Int,
            canonical,
        };
    }
    if let Some(canonical) = yaml_1_2_float(text) {
        return PlainResolution {
            tag: YamlTag::Float,
            canonical,
        };
    }
    PlainResolution::of(YamlTag::Str, text)
} // End of function resolve_plain_yaml_1_2_core()

/// Returns `true` when writing `text` as a **plain** scalar would be ambiguous.
///
/// Two independent reasons, either of which is enough:
///
/// - YAML 1.1 resolves it to something other than a string, so espanso reads a
///   value the typed projection calls a string;
/// - YAML 1.1 and YAML 1.2 core resolve it differently — in tag or in value — so
///   the substrate that reparses every candidate cannot see the disagreement.
///
/// This is the predicate [`crate::emit::is_conservatively_safe_plain_scalar`]
/// consults, and the one `crate::patch::edit`'s verification asserts no edit
/// introduces. Cheap on the overwhelmingly common case: a scalar whose first
/// character cannot open any production returns after two comparisons.
pub fn plain_scalar_is_ambiguous(text: &str) -> bool {
    let one_one = resolve_plain_yaml_1_1(text);
    if one_one.tag != YamlTag::Str {
        return true;
    }
    resolve_plain_yaml_1_2_core(text) != one_one
} // End of function plain_scalar_is_ambiguous()

// ---------------------------------------------------------------------------
// YAML 1.1
// ---------------------------------------------------------------------------

/// The twenty-two spellings YAML 1.1 resolves to a boolean.
///
/// Spelled out rather than case-folded: 1.1's production lists exactly these, so
/// `yEs` is a string and calling it a boolean would overstate the danger. The
/// emitter's own predicate is deliberately broader; this one has to be exact,
/// because it is also used to say what a document *already* means.
fn yaml_1_1_bool(text: &str) -> Option<bool> {
    match text {
        "y" | "Y" | "yes" | "Yes" | "YES" | "true" | "True" | "TRUE" | "on" | "On" | "ON" => {
            Some(true)
        }
        "n" | "N" | "no" | "No" | "NO" | "false" | "False" | "FALSE" | "off" | "Off" | "OFF" => {
            Some(false)
        }
        _ => None,
    }
} // End of function yaml_1_1_bool()

/// Matches YAML 1.1's five integer productions, returning the decimal value.
///
/// ```text
/// [-+]?0b[0-1_]+                  base 2
/// [-+]?0[0-7_]+                   base 8
/// [-+]?(0|[1-9][0-9_]*)           base 10
/// [-+]?0x[0-9a-fA-F_]+            base 16
/// [-+]?[1-9][0-9_]*(:[0-5]?[0-9])+  base 60
/// ```
///
/// The `0`-prefixed octal form is the one that costs the user data silently:
/// `012` is ten, not twelve, and only under 1.1.
fn yaml_1_1_int(text: &str) -> Option<String> {
    let (negative, body) = split_sign(text);
    if let Some(digits) = body.strip_prefix("0b") {
        return radix_value(digits, 2, negative, |byte| matches!(byte, b'0' | b'1'));
    }
    if let Some(digits) = body.strip_prefix("0x") {
        return radix_value(digits, 16, negative, |byte| byte.is_ascii_hexdigit());
    }
    if body == "0" {
        return Some("0".to_owned());
    }
    if let Some(digits) = body.strip_prefix('0') {
        // Base 8. A `0` followed by anything outside `[0-7_]` — `08`, `0o17` —
        // matches no 1.1 production at all and is therefore a string.
        return radix_value(digits, 8, negative, |byte| {
            byte.is_ascii_digit() && byte < b'8'
        });
    }
    if let Some(value) = yaml_1_1_sexagesimal(body, negative) {
        return Some(value);
    }
    if !body.starts_with(|character: char| ('1'..='9').contains(&character)) {
        return None;
    }
    radix_value(body, 10, negative, |byte| byte.is_ascii_digit())
} // End of function yaml_1_1_int()

/// Matches YAML 1.1's base-60 integer, returning the decimal value.
///
/// `[-+]?[1-9][0-9_]*(:[0-5]?[0-9])+` — the shape a duration such as `12:30`
/// has, which 1.1 reads as 750 and 1.2 reads as the string it looks like.
///
/// **The shape decides, not the arithmetic.** A head of forty digits still
/// matches the production, so an `i128` that cannot hold the result must not turn
/// the answer into "string": it renders `60#digits` instead, exactly as
/// [`radix_value`] does for the other four bases. Phase 0c-3b-2b's review found
/// this resolver returning `None` on overflow, which classified a perfectly
/// ordinary 1.1 integer as a string and would have let the emitter write it
/// plain.
fn yaml_1_1_sexagesimal(body: &str, negative: bool) -> Option<String> {
    let mut parts = body.split(':');
    let head = parts.next()?;
    if !head.starts_with(|character: char| ('1'..='9').contains(&character)) {
        return None;
    }
    if !head
        .bytes()
        .all(|byte| byte.is_ascii_digit() || byte == b'_')
    {
        return None;
    }
    let mut groups: Vec<&str> = Vec::new();
    for part in parts {
        if !sexagesimal_group(part) {
            return None;
        }
        groups.push(part);
    } // End of the loop that checks every `:`-separated base-60 group
    if groups.is_empty() {
        return None;
    }

    // The shape matched, so the answer is an integer whatever happens next.
    let mut value: Option<i128> = head.replace('_', "").parse().ok();
    for part in &groups {
        value = value
            .and_then(|running| running.checked_mul(60))
            .and_then(|running| part.parse::<i128>().ok().map(|digits| running + digits));
    } // End of the loop that accumulates the base-60 groups
    let sign = if negative { "-" } else { "" };
    Some(match value {
        Some(value) if negative => (-value).to_string(),
        Some(value) => value.to_string(),
        None => format!("{sign}60#{}", body.replace('_', "")),
    })
} // End of function yaml_1_1_sexagesimal()

/// Returns `true` when `part` matches `[0-5]?[0-9]` — one base-60 group.
fn sexagesimal_group(part: &str) -> bool {
    let bytes = part.as_bytes();
    match bytes.len() {
        1 => bytes[0].is_ascii_digit(),
        2 => (b'0'..=b'5').contains(&bytes[0]) && bytes[1].is_ascii_digit(),
        _ => false,
    }
}

/// Matches YAML 1.1's four float productions, returning a normalised value.
///
/// ```text
/// [-+]?([0-9][0-9_]*\.[0-9_]*|\.[0-9_]+)([eE][-+][0-9]+)?   base 10
/// [-+]?[0-9][0-9_]*(:[0-5]?[0-9])+\.[0-9_]*                 base 60
/// [-+]?\.(inf|Inf|INF)                                      infinity
/// \.(nan|NaN|NAN)                                           not a number
/// ```
///
/// Two things a 1.2 reader finds surprising: the exponent's sign is
/// **mandatory**, so `1.0e3` is a string under 1.1; and the base-10 form is
/// written here requiring at least one digit, which is what libyaml and PyYAML
/// do and what the printed production does not say (see the module docs).
fn yaml_1_1_float(text: &str) -> Option<String> {
    if matches!(text, ".nan" | ".NaN" | ".NAN") {
        return Some("NaN".to_owned());
    }
    let (negative, body) = split_sign(text);
    if matches!(body, ".inf" | ".Inf" | ".INF") {
        return Some(if negative { "-inf" } else { "inf" }.to_owned());
    }
    if let Some(value) = yaml_1_1_sexagesimal_float(body, negative) {
        return Some(value);
    }
    let (mantissa, exponent) = match body.find(['e', 'E']) {
        Some(at) => (&body[..at], Some(&body[at + 1..])),
        None => (body, None),
    };
    if !decimal_mantissa(mantissa) {
        return None;
    }
    if let Some(exponent) = exponent {
        // `[eE][-+][0-9]+`: the sign is not optional in the 1.1 production.
        let signed = exponent.strip_prefix(['-', '+'])?;
        if signed.is_empty() || !signed.bytes().all(|byte| byte.is_ascii_digit()) {
            return None;
        }
    }
    render_float(&body.replace('_', ""), negative)
} // End of function yaml_1_1_float()

/// Returns `true` when `mantissa` matches `[0-9][0-9_]*\.[0-9_]*|\.[0-9_]+`.
fn decimal_mantissa(mantissa: &str) -> bool {
    let Some(point) = mantissa.find('.') else {
        return false;
    };
    let (whole, fraction) = (&mantissa[..point], &mantissa[point + 1..]);
    if !whole
        .bytes()
        .all(|byte| byte.is_ascii_digit() || byte == b'_')
    {
        return false;
    }
    if !fraction
        .bytes()
        .all(|byte| byte.is_ascii_digit() || byte == b'_')
    {
        return false;
    }
    if whole.starts_with('_') {
        return false;
    }
    // At least one real digit somewhere, which is the libyaml/PyYAML reading of
    // a production that would otherwise match a lone `.`.
    whole
        .bytes()
        .chain(fraction.bytes())
        .any(|byte| byte.is_ascii_digit())
} // End of function decimal_mantissa()

/// Matches YAML 1.1's base-60 float, `[-+]?[0-9][0-9_]*(:[0-5]?[0-9])+\.[0-9_]*`.
fn yaml_1_1_sexagesimal_float(body: &str, negative: bool) -> Option<String> {
    let point = body.find('.')?;
    let (groups, fraction) = (&body[..point], &body[point + 1..]);
    if !fraction
        .bytes()
        .all(|byte| byte.is_ascii_digit() || byte == b'_')
    {
        return None;
    }
    let mut parts = groups.split(':');
    let head = parts.next()?;
    if head.is_empty() || !head.bytes().next()?.is_ascii_digit() {
        return None;
    }
    if !head
        .bytes()
        .all(|byte| byte.is_ascii_digit() || byte == b'_')
    {
        return None;
    }
    let mut value: f64 = head.replace('_', "").parse().ok()?;
    let mut seen = 0usize;
    for part in parts {
        if !sexagesimal_group(part) {
            return None;
        }
        let digits: f64 = part.parse().ok()?;
        value = value * 60.0 + digits;
        seen += 1;
    } // End of the loop over the `:`-separated base-60 groups of a float
    if seen == 0 {
        return None;
    }
    let scaled: f64 = format!("0.{}", fraction.replace('_', ""))
        .parse()
        .unwrap_or(0.0);
    let total = value + scaled;
    Some(if negative {
        (-total).to_string()
    } else {
        total.to_string()
    })
} // End of function yaml_1_1_sexagesimal_float()

/// Matches YAML 1.1's timestamp production.
///
/// ```text
/// [0-9]{4}-[0-9]{1,2}-[0-9]{1,2}
/// [0-9]{4}-[0-9]{1,2}-[0-9]{1,2}([Tt]|[ \t]+)[0-9]{1,2}:[0-9]{2}:[0-9]{2}
///   (\.[0-9]*)? ([ \t]*(Z|[-+][0-9]{1,2}(:[0-9]{2})?))?
/// ```
///
/// The second form is why this exists as a scanner rather than as a length
/// check: it admits **single-digit** months, days and hours and a run of spaces
/// where a `T` would be, so `2001-1-1 10:00:00` is a timestamp to a 1.1 resolver
/// and looks like ordinary prose to everything else.
///
/// The **date-only** form takes one or two digits for month and day here, which
/// is the third deviation the module docs record: the printed production and
/// PyYAML take exactly two, Ruby's Psych takes one or two, and the direction
/// that reports more danger is the only honest one for this table.
fn yaml_1_1_timestamp(text: &str) -> bool {
    let mut scan = Scan::new(text);
    if scan.digits(4, 4).is_none() || !scan.take(b'-') {
        return false;
    }
    if scan.digits(1, 2).is_none() || !scan.take(b'-') || scan.digits(1, 2).is_none() {
        return false;
    }
    if scan.done() {
        return true;
    }
    if !scan.take_any(b"Tt") && scan.blanks() == 0 {
        return false;
    }
    if scan.digits(1, 2).is_none() {
        return false;
    }
    for _ in 0..2 {
        if !scan.take(b':') || scan.digits(2, 2).is_none() {
            return false;
        }
    } // End of the loop over the minute and second fields
    if scan.take(b'.') {
        scan.digits(0, usize::MAX);
    }
    if scan.done() {
        return true;
    }
    // `[ \t]*(Z|[-+][0-9][0-9]?(:[0-9][0-9])?)`: the blanks belong to the
    // time-zone group, so a text that ends in blanks with no zone after them is
    // not a timestamp — which is PyYAML's reading and the printed production's.
    scan.blanks();
    if scan.take(b'Z') {
        return scan.done();
    }
    if !scan.take_any(b"-+") || scan.digits(1, 2).is_none() {
        return false;
    }
    if scan.take(b':') && scan.digits(2, 2).is_none() {
        return false;
    }
    scan.done()
} // End of function yaml_1_1_timestamp()

// ---------------------------------------------------------------------------
// YAML 1.2 core
// ---------------------------------------------------------------------------

/// Matches the 1.2 core schema's integer forms, returning the decimal value.
///
/// ```text
/// [-+]?[0-9][0-9_]*   [-+]?0o[0-7_]+   [-+]?0x[0-9a-fA-F_]+
/// ```
///
/// No base 2 and no base 60, which are two of the places 1.1 and 1.2 disagree.
///
/// The sign before a radix prefix and the underscores are the module docs'
/// **fourth deviation**: the printed core-schema production is
/// `[-+]?[0-9]+ | 0o[0-7]+ | 0x[0-9a-fA-F]+`, and `go-yaml` v3 accepts both
/// through Go's `ParseInt(_, 0, 64)`. Accepting them can only add an ambiguity
/// report, never remove one — see the module docs.
///
/// The leading zero is **not** special: `[0-9]+` matches `012`, and the core
/// schema reads it as decimal twelve, which is what `saphyr` and `serde_yaml`
/// both do. YAML 1.1 reads the same three bytes as octal ten. That disagreement
/// is the whole reason [`PlainResolution`] carries a canonical value as well as
/// a tag.
fn yaml_1_2_int(text: &str) -> Option<String> {
    let (negative, body) = split_sign(text);
    if let Some(digits) = body.strip_prefix("0o") {
        return radix_value(digits, 8, negative, |byte| {
            byte.is_ascii_digit() && byte < b'8'
        });
    }
    if let Some(digits) = body.strip_prefix("0x") {
        return radix_value(digits, 16, negative, |byte| byte.is_ascii_hexdigit());
    }
    // A leading `_` is not a digit in any implementation of the production, and
    // `radix_value` alone would strip it and accept the rest.
    if !body.starts_with(|character: char| character.is_ascii_digit()) {
        return None;
    }
    radix_value(body, 10, negative, |byte| byte.is_ascii_digit())
} // End of function yaml_1_2_int()

/// Matches the 1.2 core schema's float forms, returning a normalised value.
///
/// ```text
/// [-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?
/// [-+]?\.(inf|Inf|INF)      \.(nan|NaN|NAN)
/// ```
///
/// The exponent's sign is optional here and mandatory in 1.1.
fn yaml_1_2_float(text: &str) -> Option<String> {
    if matches!(text, ".nan" | ".NaN" | ".NAN") {
        return Some("NaN".to_owned());
    }
    let (negative, body) = split_sign(text);
    if matches!(body, ".inf" | ".Inf" | ".INF") {
        return Some(if negative { "-inf" } else { "inf" }.to_owned());
    }
    let (mantissa, exponent) = match body.find(['e', 'E']) {
        Some(at) => (&body[..at], Some(&body[at + 1..])),
        None => (body, None),
    };
    if !core_mantissa(mantissa) {
        return None;
    }
    if let Some(exponent) = exponent {
        let signed = exponent.strip_prefix(['-', '+']).unwrap_or(exponent);
        if signed.is_empty() || !signed.bytes().all(|byte| byte.is_ascii_digit()) {
            return None;
        }
    }
    render_float(body, negative)
} // End of function yaml_1_2_float()

/// Returns `true` when `mantissa` matches `\.[0-9]+|[0-9]+(\.[0-9]*)?`.
fn core_mantissa(mantissa: &str) -> bool {
    match mantissa.find('.') {
        None => !mantissa.is_empty() && mantissa.bytes().all(|byte| byte.is_ascii_digit()),
        Some(point) => {
            let (whole, fraction) = (&mantissa[..point], &mantissa[point + 1..]);
            let whole_ok = whole.bytes().all(|byte| byte.is_ascii_digit());
            let fraction_ok = fraction.bytes().all(|byte| byte.is_ascii_digit());
            whole_ok && fraction_ok && !(whole.is_empty() && fraction.is_empty())
        }
    }
} // End of function core_mantissa()

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/// Splits a leading `-` or `+` off, reporting whether the value is negative.
fn split_sign(text: &str) -> (bool, &str) {
    match text.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, text.strip_prefix('+').unwrap_or(text)),
    }
}

/// Renders `digits` in `radix` as a decimal string, or `None` when it is not a
/// run of permitted digits and `_` separators.
///
/// A value too large for `i128` is rendered `radix#digits` rather than dropped,
/// so two spellings of the same enormous number in different bases still compare
/// unequal. A run of `_` with no digit at all is rejected: the production admits
/// it and no implementation resolves it as a number.
fn radix_value(
    digits: &str,
    radix: u32,
    negative: bool,
    permitted: impl Fn(u8) -> bool,
) -> Option<String> {
    if digits.is_empty() || !digits.bytes().all(|byte| byte == b'_' || permitted(byte)) {
        return None;
    }
    let cleaned: String = digits
        .chars()
        .filter(|character| *character != '_')
        .collect();
    if cleaned.is_empty() {
        return None;
    }
    match i128::from_str_radix(&cleaned, radix) {
        Ok(value) => Some(if negative {
            (-value).to_string()
        } else {
            value.to_string()
        }),
        Err(_) => {
            let sign = if negative { "-" } else { "" };
            let trimmed = cleaned.trim_start_matches('0');
            Some(format!("{sign}{radix}#{trimmed}"))
        }
    }
} // End of function radix_value()

/// Renders a base-10 float's text as a normalised decimal string.
///
/// Both resolvers route their base-10 form through this, so a text both of them
/// accept always produces the same canonical rendering and the comparison in
/// [`plain_scalar_is_ambiguous`] turns on the tag rather than on formatting.
///
/// **Shape, never arithmetic**, for the same reason [`yaml_1_1_sexagesimal`]
/// gives: the caller has already established that the text matches a float
/// production, so a text `f64` cannot parse is still a float and is rendered
/// `f#text` rather than turned back into a string. Both callers pass the text
/// their own production accepted, and for a text both accept those are the same
/// bytes, so the fallback cannot invent a disagreement either.
fn render_float(body: &str, negative: bool) -> Option<String> {
    let sign = if negative { "-" } else { "" };
    let Ok(value) = body.parse::<f64>() else {
        return Some(format!("{sign}f#{body}"));
    };
    Some(if negative {
        (-value).to_string()
    } else {
        value.to_string()
    })
} // End of function render_float()

/// A byte cursor over a scalar's text, used by the timestamp scanner.
///
/// Hand-written because the crate has no regex dependency and will not gain one
/// (`PROGRESS.md`, D1).
struct Scan<'text> {
    /// The text being scanned.
    bytes: &'text [u8],
    /// How far into it the scan has reached.
    at: usize,
}

impl<'text> Scan<'text> {
    /// Starts a scan at the beginning of `text`.
    fn new(text: &'text str) -> Scan<'text> {
        Scan {
            bytes: text.as_bytes(),
            at: 0,
        }
    }

    /// Returns `true` when the whole text has been consumed.
    fn done(&self) -> bool {
        self.at == self.bytes.len()
    }

    /// Consumes `byte` when it is next, reporting whether it was.
    fn take(&mut self, byte: u8) -> bool {
        if self.bytes.get(self.at) == Some(&byte) {
            self.at += 1;
            return true;
        }
        false
    }

    /// Consumes the next byte when it is one of `set`, reporting whether it was.
    fn take_any(&mut self, set: &[u8]) -> bool {
        match self.bytes.get(self.at) {
            Some(byte) if set.contains(byte) => {
                self.at += 1;
                true
            }
            _ => false,
        }
    }

    /// Consumes spaces and tabs, returning how many.
    fn blanks(&mut self) -> usize {
        let start = self.at;
        while matches!(self.bytes.get(self.at), Some(b' ') | Some(b'\t')) {
            self.at += 1;
        }
        self.at - start
    }

    /// Consumes between `least` and `most` ASCII digits.
    ///
    /// Returns how many were consumed, or `None` when fewer than `least` are
    /// available — in which case nothing is consumed, so a failed attempt never
    /// leaves the cursor half way through a field.
    fn digits(&mut self, least: usize, most: usize) -> Option<usize> {
        let start = self.at;
        while self.at - start < most
            && self
                .bytes
                .get(self.at)
                .is_some_and(|byte| byte.is_ascii_digit())
        {
            self.at += 1;
        }
        let taken = self.at - start;
        if taken < least {
            self.at = start;
            return None;
        }
        Some(taken)
    } // End of function digits()
} // End of impl Scan

#[cfg(test)]
mod tests {
    use super::*;

    /// Asserts a text's 1.1 tag and its 1.2 core tag in one line.
    fn tags(text: &str) -> (YamlTag, YamlTag) {
        (
            resolve_plain_yaml_1_1(text).tag,
            resolve_plain_yaml_1_2_core(text).tag,
        )
    }

    #[test]
    fn every_yaml_one_one_boolean_spelling_resolves_and_only_those() {
        for text in [
            "y", "Y", "yes", "Yes", "YES", "n", "N", "no", "No", "NO", "true", "True", "TRUE",
            "false", "False", "FALSE", "on", "On", "ON", "off", "Off", "OFF",
        ] {
            assert_eq!(
                resolve_plain_yaml_1_1(text).tag,
                YamlTag::Bool,
                "{text} is a YAML 1.1 boolean"
            );
        }
        // Case mixtures the production does not list are strings, and saying so
        // is what keeps this a resolver rather than a second copy of the
        // emitter's deliberately over-broad predicate.
        for text in ["yEs", "oN", "TrUe", "nO"] {
            assert_eq!(resolve_plain_yaml_1_1(text).tag, YamlTag::Str, "{text}");
        }
    } // End of function every_yaml_one_one_boolean_spelling_resolves_and_only_those()

    #[test]
    fn the_two_schemas_disagree_exactly_where_the_table_says() {
        // Booleans 1.2 does not have.
        assert_eq!(tags("on"), (YamlTag::Bool, YamlTag::Str));
        assert_eq!(tags("y"), (YamlTag::Bool, YamlTag::Str));
        // Same tag, different value: 1.1 reads a leading zero as octal.
        assert_eq!(tags("012"), (YamlTag::Int, YamlTag::Int));
        assert_eq!(resolve_plain_yaml_1_1("012").canonical, "10");
        assert_eq!(resolve_plain_yaml_1_2_core("012").canonical, "12");
        // Radix prefixes each schema has and the other does not.
        assert_eq!(tags("0b101"), (YamlTag::Int, YamlTag::Str));
        assert_eq!(tags("0o17"), (YamlTag::Str, YamlTag::Int));
        assert_eq!(tags("0x1f"), (YamlTag::Int, YamlTag::Int));
        // **Phase 0c-3b-2b's review, finding 2.** A sign before a radix prefix
        // and an underscore between digits are accepted on the 1.2 side, as
        // go-yaml accepts them. `+0o17` is a string to 1.1 and an integer to
        // 1.2, so it is newly *reported* rather than newly excused.
        assert_eq!(tags("+0o17"), (YamlTag::Str, YamlTag::Int));
        assert_eq!(resolve_plain_yaml_1_2_core("+0o17").canonical, "15");
        assert_eq!(tags("-0x1f"), (YamlTag::Int, YamlTag::Int));
        assert!(plain_scalar_is_ambiguous("+0o17"));
        // …and a leading underscore is a digit in no implementation of either
        // production, so it stays a string in both.
        assert_eq!(tags("_1"), (YamlTag::Str, YamlTag::Str));
        // Sexagesimals, underscores, timestamps and the value key.
        assert_eq!(tags("12:30"), (YamlTag::Int, YamlTag::Str));
        assert_eq!(resolve_plain_yaml_1_1("12:30").canonical, "750");
        assert_eq!(tags("1_000"), (YamlTag::Int, YamlTag::Int));
        assert_eq!(tags("2001-12-14"), (YamlTag::Timestamp, YamlTag::Str));
        assert_eq!(tags("="), (YamlTag::Value, YamlTag::Str));
        assert_eq!(tags("<<"), (YamlTag::Merge, YamlTag::Str));
        // The exponent sign is mandatory in 1.1 and optional in 1.2.
        assert_eq!(tags("1.0e3"), (YamlTag::Str, YamlTag::Float));
        assert_eq!(tags("1.0e+3"), (YamlTag::Float, YamlTag::Float));
        // 1.1's mantissa needs a decimal point as well as a signed exponent, so
        // this one disagrees for two reasons at once.
        assert_eq!(tags("1e3"), (YamlTag::Str, YamlTag::Float));
    } // End of function the_two_schemas_disagree_exactly_where_the_table_says()

    #[test]
    fn a_timestamp_may_have_single_digit_fields_and_a_space_separator() {
        assert!(yaml_1_1_timestamp("2001-12-14"));
        assert!(yaml_1_1_timestamp("2001-1-1 10:00:00"));
        assert!(yaml_1_1_timestamp("2001-1-1t10:00:00"));
        assert!(yaml_1_1_timestamp("2001-12-14 21:59:43.10 -5"));
        assert!(yaml_1_1_timestamp("2001-12-14t21:59:43.10-05:00"));
        assert!(yaml_1_1_timestamp("2001-12-14 21:59:43.10 Z"));
        // **Phase 0c-3b-2b's review, finding 2.** The date-only form takes one
        // or two digits for month and day, as Ruby's Psych does; the printed
        // production and PyYAML take exactly two, and narrowing the shape would
        // under-report the danger. This assertion is the inverse of the one it
        // replaced, and the module docs record why.
        assert!(yaml_1_1_timestamp("2001-1-1"));
        assert!(yaml_1_1_timestamp("2001-1-01"));
        assert_eq!(tags("2001-1-1"), (YamlTag::Timestamp, YamlTag::Str));
        // Still not a timestamp: three digits anywhere, a missing field, and
        // trailing bytes that no part of the production admits — the blanks
        // before a time zone belong to the zone group, so a text that ends in
        // them has no zone and does not match.
        assert!(!yaml_1_1_timestamp("2001-1-100"));
        assert!(!yaml_1_1_timestamp("2001-12"));
        assert!(!yaml_1_1_timestamp("2001-12-14 21:59"));
        assert!(!yaml_1_1_timestamp("2001-12-14 21:59:43 extra"));
        assert!(!yaml_1_1_timestamp("2001-12-14 21:59:43.10 "));
        // The production is **syntactic**: it does not check that a month is
        // between 1 and 12, and neither does the resolver that uses it. Saying
        // so here is deliberate — a resolver that silently narrowed the shape
        // would under-report the danger, which is the one direction this table
        // must never err in.
        assert!(yaml_1_1_timestamp("2001-13-99"));
    } // End of function a_timestamp_may_have_single_digit_fields_and_a_space_separator()

    #[test]
    fn ordinary_espanso_content_stays_a_string_in_both_schemas() {
        for text in [
            ":hello",
            "Hello, world",
            "clipboard",
            "form1",
            "a.b.c",
            "12:99",
            ".",
            "-",
            "0800-CALL",
        ] {
            assert!(
                !plain_scalar_is_ambiguous(text),
                "{text} must not be reported ambiguous"
            );
        }
    } // End of function ordinary_espanso_content_stays_a_string_in_both_schemas()

    #[test]
    fn ambiguity_covers_both_halves_of_its_definition() {
        // Non-string under 1.1.
        assert!(plain_scalar_is_ambiguous("no"));
        assert!(plain_scalar_is_ambiguous("~"));
        assert!(plain_scalar_is_ambiguous("012"));
        // A string under 1.1 that 1.2 core reads as a number.
        assert_eq!(resolve_plain_yaml_1_1("0o17").tag, YamlTag::Str);
        assert!(plain_scalar_is_ambiguous("0o17"));
    }

    #[test]
    fn a_value_too_large_for_our_integers_is_still_classified_by_its_shape() {
        // **Phase 0c-3b-2b's review, finding 2.** A 39-digit sexagesimal matches
        // the 1.1 base-60 production and overflows `i128`. Classifying it by the
        // arithmetic rather than by the shape called it a string, and a string is
        // exactly what the emitter is allowed to write plain.
        let huge = "999999999999999999999999999999999999999:00";
        assert_eq!(resolve_plain_yaml_1_1(huge).tag, YamlTag::Int);
        assert_eq!(
            resolve_plain_yaml_1_1(huge).canonical,
            "60#999999999999999999999999999999999999999:00"
        );
        assert!(plain_scalar_is_ambiguous(huge));
        // The other four bases already rendered an out-of-range value rather
        // than dropping it; asserted here so the four cannot drift apart.
        for text in [
            "0x11111111111111111111111111111111111111",
            "0b1111111111111111111111111111111111111111111111111111111111111111111111\
             1111111111111111111111111111111111111111111111111111111111111111111111111\
             111111111111111111",
            "0777777777777777777777777777777777777777777777777",
            "99999999999999999999999999999999999999999999",
        ] {
            assert_eq!(resolve_plain_yaml_1_1(text).tag, YamlTag::Int, "{text}");
            assert!(plain_scalar_is_ambiguous(text), "{text}");
        } // End of the loop over the out-of-range integers of the other bases
    } // End of function a_value_too_large_for_our_integers_is_still_classified_by_its_shape()
}
