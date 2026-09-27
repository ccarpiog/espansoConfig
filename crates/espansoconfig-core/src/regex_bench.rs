//! The regex bench: one pattern tried against one sample (Phase 4-21).
//!
//! # What it is, and what it is not
//!
//! A **first-match search** with this crate's own `regex` dependency
//! (`docs/decisions/4-split-notes.md` ruling 28): the pattern is compiled as
//! written, with no anchor added, and the sample is searched once, leftmost
//! first, exactly as [`regex::Regex::captures`] searches. The answer says
//! whether the pattern compiled, whether it found a match, the whole match, and
//! every **named** group in pattern order, a group that did not take part in
//! the match included.
//!
//! It establishes nothing about espanso. The answer names the engine it ran
//! ([`ENGINE`], `regex` 1.13.1, pinned against `Cargo.lock` by a test) and
//! espanso 2.3.0 uses `regex` 1.5.5; whether espanso accepts a pattern, or
//! triggers on a text, is not something this search observes.
//!
//! # Stateless and pure
//!
//! A function of the request alone: no document, no identity, no lock, no file
//! I/O, no clock and no environment read. **The pattern and the sample are
//! never logged, printed or written anywhere**: this module names no logging or
//! printing facility (a source scan in `src-tauri/src/wire_contract.rs` pins
//! that for this file and for the command's body), and [`RegexBenchRequest`]'s
//! `Debug` prints lengths rather than text. A compile error's message is
//! **not** returned either, because `regex` formats a syntax error by quoting
//! the pattern back with a caret under the fault; the refusal carries a closed
//! [`RegexCompileFailure`] code instead.
//!
//! # Limits, and what "at the boundary" means
//!
//! Every limit is **inclusive**: a request exactly at a limit gets an answer,
//! and one unit past it is refused ([`RegexBenchLimits::DEFAULT`]).
//!
//! | Limit | Unit | Default | Past it |
//! |---|---|---|---|
//! | pattern | UTF-8 bytes of the pattern | 8 KiB | [`RegexRefusal::PatternTooLarge`] |
//! | sample | UTF-8 bytes of the sample | 64 KiB | [`RegexRefusal::SampleTooLarge`] |
//! | named groups | groups with a name | 128 | [`RegexRefusal::CaptureLimit`] |
//! | compiled size | `regex`'s own `size_limit` | 1 MiB | [`RegexRefusal::CompileRejected`] with [`RegexCompileFailure::CompiledTooBig`] |
//! | DFA cache | `regex`'s own `dfa_size_limit` | 1 MiB | never refused: the engine falls back to a slower one |
//! | response | bytes of the answer serialized as JSON by `serde_json` | 128 KiB | [`RegexRefusal::OutputLimit`] |
//!
//! The checks run in that order, and the first one failed is the answer's only
//! refusal: a pattern and a sample both over their limits answer
//! `PatternTooLarge`. The compiled-size limit is `regex`'s, measured by `regex`
//! in its own unit; this module passes the number through and has no view of
//! the measurement. The DFA cache limit bounds memory during the search and has
//! no refusal of its own.
//!
//! The response limit is measured on the whole [`RegexBenchAnswer`] as
//! `serde_json` writes it — the serializer Tauri answers a command with — by a
//! writer that counts bytes and stops at the first byte past the limit, so an
//! oversized answer is never fully written. A refused answer carries no text,
//! so it is always far below the limit.
//!
//! # Offsets are UTF-16 code units, and the text is cut here
//!
//! Every span's text is cut **in Rust**, on the byte offsets `regex` reports,
//! which always fall on character boundaries (`CLAUDE.md` section 6: a byte
//! span must never be sliced in JavaScript). Its position is given in
//! **UTF-16 code units** — `utf16_start` and `utf16_end` — which is the unit a
//! JavaScript string index counts, so `sample.slice(utf16_start, utf16_end)` on
//! the string the caller sent equals `text`. No byte offset crosses the wire.
//!
//! # Named groups only
//!
//! espanso turns a regex trigger's **named** captures into variables, so those
//! are what the bench reports. An unnamed group is still part of the pattern
//! and still takes part in the match; it is simply not listed.
//!
//! The named groups are the ones the pattern **declares**, read from
//! `regex-syntax`'s AST before compilation, and the group limit counts those.
//! `regex` removes a subexpression repeated `{0}` while compiling, groups
//! included, so its compiled names can be fewer; a declared group the compiled
//! regex lacks comes back unmatched, exactly as a group that did not take part.
//! The parse runs before the compile, so the group limit is checked before any
//! program is built, and a pattern the parser refuses (a duplicate group name,
//! say) answers [`RegexCompileFailure::Syntax`].

use std::collections::HashMap;
use std::fmt;
use std::io;

use regex::RegexBuilder;
use regex_syntax::ast;
use serde::Serialize;

/// The engine the bench runs, as the answer names it.
///
/// The version is written here by hand, because `regex` does not expose its
/// own; `crates/espansoconfig-core/tests/regex_bench.rs` reads `Cargo.lock` and
/// fails when the locked version is not this one, so a dependency update
/// cannot leave the answer naming the wrong engine.
pub const ENGINE: RegexEngine = RegexEngine {
    name: "regex",
    version: "1.13.1",
};

/// The engine that ran a search.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct RegexEngine {
    /// The crate's name, `regex`.
    pub name: &'static str,
    /// The crate's version, as `Cargo.lock` pins it.
    pub version: &'static str,
}

/// The bench's limits. Every one is inclusive: a request at the limit gets an
/// answer and one unit past it is refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RegexBenchLimits {
    /// The largest pattern accepted, in UTF-8 bytes.
    pub pattern_bytes: usize,
    /// The largest sample accepted, in UTF-8 bytes.
    pub sample_bytes: usize,
    /// The most named groups a pattern may declare.
    pub named_groups: usize,
    /// `regex`'s compiled-size limit (`RegexBuilder::size_limit`), in its own
    /// measure of bytes.
    pub compiled_bytes: usize,
    /// `regex`'s lazy-DFA cache limit (`RegexBuilder::dfa_size_limit`), in
    /// bytes. Bounds memory; never a refusal.
    pub dfa_cache_bytes: usize,
    /// The largest answer accepted, in bytes of its `serde_json` serialization.
    pub response_bytes: usize,
}

impl RegexBenchLimits {
    /// The limits step 4-21 names: 8 KiB pattern, 64 KiB sample, 128 named
    /// groups, 1 MiB compiled size, 1 MiB DFA cache, 128 KiB response.
    pub const DEFAULT: RegexBenchLimits = RegexBenchLimits {
        pattern_bytes: 8 * 1024,
        sample_bytes: 64 * 1024,
        named_groups: 128,
        compiled_bytes: 1024 * 1024,
        dfa_cache_bytes: 1024 * 1024,
        response_bytes: 128 * 1024,
    };
}

/// One request: a pattern, a sample, and the caller's own number for it.
///
/// `Debug` is written by hand and prints the two texts' **lengths**, never the
/// texts, so a stray `{:?}` cannot put a person's pattern or sample into a log.
#[derive(Clone, PartialEq, Eq)]
pub struct RegexBenchRequest {
    /// The caller's number for this request, echoed in the answer so a caller
    /// with several requests in flight can ignore a stale one. Opaque here.
    pub request_id: u64,
    /// The pattern, as written.
    pub pattern: String,
    /// The text to search.
    pub sample: String,
}

impl fmt::Debug for RegexBenchRequest {
    /// Prints the request id and the byte lengths of the pattern and sample.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("RegexBenchRequest")
            .field("request_id", &self.request_id)
            .field("pattern_bytes", &self.pattern.len())
            .field("sample_bytes", &self.sample.len())
            .finish()
    }
}

/// Why a request was not searched, or its answer not returned.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum RegexRefusal {
    /// The pattern is longer than [`RegexBenchLimits::pattern_bytes`].
    PatternTooLarge,
    /// The sample is longer than [`RegexBenchLimits::sample_bytes`].
    SampleTooLarge,
    /// The pattern declares more named groups than
    /// [`RegexBenchLimits::named_groups`].
    CaptureLimit,
    /// `regex` did not compile the pattern.
    CompileRejected {
        /// Which kind of failure, as a code. `regex`'s own message is not
        /// carried, because it quotes the pattern.
        reason: RegexCompileFailure,
    },
    /// The answer would be longer than [`RegexBenchLimits::response_bytes`].
    OutputLimit,
}

/// Why `regex` did not compile a pattern.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum RegexCompileFailure {
    /// The pattern is not valid `regex` syntax — an unclosed group, an unknown
    /// escape, a repetition or nesting past `regex`'s own limits, a duplicate
    /// group name, and so on.
    Syntax,
    /// The compiled program would be larger than
    /// [`RegexBenchLimits::compiled_bytes`].
    CompiledTooBig,
    /// A failure kind this version of `regex` adds beyond the two above
    /// (`regex::Error` is non-exhaustive).
    Other,
}

/// One piece of the sample a match or a group covered, cut in Rust.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RegexSpan {
    /// The text, exactly as the sample holds it. Empty for a zero-width match.
    pub text: String,
    /// Where it starts, in UTF-16 code units from the sample's start.
    pub utf16_start: usize,
    /// Where it ends, in UTF-16 code units from the sample's start. Equal to
    /// `utf16_start` for a zero-width match.
    pub utf16_end: usize,
}

/// One named group of a found match.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RegexGroup {
    /// The group's name, as the pattern writes it.
    pub name: String,
    /// What it captured, or `None` when it did not take part in the match (an
    /// optional group, or one in an alternative not taken).
    pub capture: Option<RegexSpan>,
}

/// The first match in the sample.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RegexFound {
    /// The whole match.
    pub whole: RegexSpan,
    /// Every named group, in the order the pattern opens them.
    pub groups: Vec<RegexGroup>,
}

/// What the bench did with a request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum RegexOutcome {
    /// The pattern compiled and the sample was searched.
    Tested {
        /// Every named group's name, in the order the pattern opens them —
        /// present whether or not anything matched.
        group_names: Vec<String>,
        /// The first match, or `None` when the pattern matches nowhere.
        found: Option<RegexFound>,
    },
    /// The request was refused; nothing about the pattern's behaviour is
    /// claimed.
    Refused {
        /// Why.
        refusal: RegexRefusal,
    },
}

/// The bench's answer to one request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RegexBenchAnswer {
    /// The request's own number, echoed.
    pub request_id: u64,
    /// The engine that ran — or would have run — the search.
    pub engine: RegexEngine,
    /// What happened.
    pub outcome: RegexOutcome,
}

/// Tries one pattern against one sample under [`RegexBenchLimits::DEFAULT`].
///
/// See the module documentation for the search, the limits and the offsets.
pub fn test_regex(request: &RegexBenchRequest) -> RegexBenchAnswer {
    test_regex_with_limits(request, &RegexBenchLimits::DEFAULT)
}

/// [`test_regex`] under explicit limits, for tests that need a boundary
/// smaller or larger than the default.
pub fn test_regex_with_limits(
    request: &RegexBenchRequest,
    limits: &RegexBenchLimits,
) -> RegexBenchAnswer {
    let outcome = match search(request, limits) {
        Ok(outcome) => outcome,
        Err(refusal) => RegexOutcome::Refused { refusal },
    };
    let answer = RegexBenchAnswer {
        request_id: request.request_id,
        engine: ENGINE,
        outcome,
    };
    if matches!(answer.outcome, RegexOutcome::Tested { .. })
        && !serializes_within(&answer, limits.response_bytes)
    {
        return refused(request.request_id, RegexRefusal::OutputLimit);
    }
    answer
} // End of function test_regex_with_limits()

/// A refused answer.
fn refused(request_id: u64, refusal: RegexRefusal) -> RegexBenchAnswer {
    RegexBenchAnswer {
        request_id,
        engine: ENGINE,
        outcome: RegexOutcome::Refused { refusal },
    }
}

/// The checks and the search, in the module's order; the first failed check
/// is the refusal.
fn search(
    request: &RegexBenchRequest,
    limits: &RegexBenchLimits,
) -> Result<RegexOutcome, RegexRefusal> {
    if request.pattern.len() > limits.pattern_bytes {
        return Err(RegexRefusal::PatternTooLarge);
    }
    if request.sample.len() > limits.sample_bytes {
        return Err(RegexRefusal::SampleTooLarge);
    }
    // The declared named groups come from the parser's AST, before `regex`
    // compiles and simplifies the pattern: compilation drops a subexpression
    // repeated `{0}` and its groups with it, so the compiled names are not
    // every declared one. Reading them first also puts the group limit before
    // the compile. The parser's own error, like `regex`'s, quotes the pattern
    // and is dropped for a code.
    let declared = declared_names(&request.pattern).ok_or(RegexRefusal::CompileRejected {
        reason: RegexCompileFailure::Syntax,
    })?;
    if declared.len() > limits.named_groups {
        return Err(RegexRefusal::CaptureLimit);
    }
    let compiled = RegexBuilder::new(&request.pattern)
        .size_limit(limits.compiled_bytes)
        .dfa_size_limit(limits.dfa_cache_bytes)
        .build()
        .map_err(|failure| RegexRefusal::CompileRejected {
            reason: compile_failure(&failure),
        })?;
    // Where each compiled name sits: index `i` of `capture_names` is group
    // `i`. A declared name absent here was compiled away and never matches.
    let compiled_index: HashMap<&str, usize> = compiled
        .capture_names()
        .enumerate()
        .filter_map(|(index, name)| name.map(|name| (name, index)))
        .collect();
    let named: Vec<(Option<usize>, String)> = declared
        .into_iter()
        .map(|name| (compiled_index.get(name.as_str()).copied(), name))
        .collect();
    let group_names: Vec<String> = named.iter().map(|(_, name)| name.clone()).collect();
    let Some(captures) = compiled.captures(&request.sample) else {
        return Ok(RegexOutcome::Tested {
            group_names,
            found: None,
        });
    };
    // The text an answer carries can only grow when serialized, so a running
    // total past the response limit already decides `OutputLimit`; stopping
    // there keeps the texts built for an oversized answer bounded too.
    let mut text_bytes = 0usize;
    let whole_match = captures.get(0).expect("group 0 is always the match");
    text_bytes += whole_match.len();
    if text_bytes > limits.response_bytes {
        return Err(RegexRefusal::OutputLimit);
    }
    let whole = span_of(&request.sample, whole_match.start(), whole_match.end());
    let mut groups = Vec::with_capacity(named.len());
    for (index, name) in named {
        let capture = match index.and_then(|index| captures.get(index)) {
            Some(found) => {
                text_bytes += found.len();
                if text_bytes > limits.response_bytes {
                    return Err(RegexRefusal::OutputLimit);
                }
                Some(span_of(&request.sample, found.start(), found.end()))
            }
            None => None,
        };
        groups.push(RegexGroup { name, capture });
    } // End of the loop over the named groups
    Ok(RegexOutcome::Tested {
        group_names,
        found: Some(RegexFound { whole, groups }),
    })
} // End of function search()

/// Every named group `pattern` declares, in the order the pattern opens them,
/// read from `regex-syntax`'s AST — the parser `regex` itself runs first, with
/// the same default nesting limit — so a group inside a `{0}` repetition is
/// counted and listed although compilation removes it. `None` when the parser
/// refuses the pattern (a duplicate name among the reasons); its message is
/// not kept, because it quotes the pattern.
///
/// The AST visitor walks with a heap stack, not recursion, so a deeply nested
/// pattern cannot overflow this thread's stack here.
fn declared_names(pattern: &str) -> Option<Vec<String>> {
    let ast = ast::parse::Parser::new().parse(pattern).ok()?;
    let mut names = NamedGroups(Vec::new());
    // `NamedGroups` never fails, so the walk's only result is the list.
    let _ = ast::visit(&ast, &mut names);
    Some(names.0)
}

/// An AST visitor collecting capture-group names in pre-order, which is the
/// order the pattern opens them.
struct NamedGroups(Vec<String>);

impl ast::Visitor for &mut NamedGroups {
    type Output = ();
    type Err = std::convert::Infallible;

    /// Nothing to finish.
    fn finish(self) -> Result<(), Self::Err> {
        Ok(())
    }

    /// Records a named capture group as it is entered.
    fn visit_pre(&mut self, node: &ast::Ast) -> Result<(), Self::Err> {
        if let ast::Ast::Group(group) = node {
            if let ast::GroupKind::CaptureName { name, .. } = &group.kind {
                self.0.push(name.name.clone());
            }
        }
        Ok(())
    }
}

/// The code for a compile failure. `regex`'s message is deliberately dropped:
/// its syntax errors quote the pattern.
fn compile_failure(failure: &regex::Error) -> RegexCompileFailure {
    match failure {
        regex::Error::Syntax(_) => RegexCompileFailure::Syntax,
        regex::Error::CompiledTooBig(_) => RegexCompileFailure::CompiledTooBig,
        _ => RegexCompileFailure::Other,
    }
}

/// Cuts `sample[start..end]` and positions it in UTF-16 code units.
///
/// `start` and `end` are byte offsets `regex` reported for a match in
/// `sample`, so both are character boundaries and the slice cannot panic.
fn span_of(sample: &str, start: usize, end: usize) -> RegexSpan {
    let utf16_start = utf16_length(&sample[..start]);
    let text = &sample[start..end];
    RegexSpan {
        text: text.to_owned(),
        utf16_start,
        utf16_end: utf16_start + utf16_length(text),
    }
}

/// How many UTF-16 code units `text` is.
fn utf16_length(text: &str) -> usize {
    text.chars().map(char::len_utf16).sum()
}

/// A writer that counts bytes and fails at the first byte past `limit`.
struct Counter {
    /// Bytes accepted so far.
    written: usize,
    /// The most it accepts.
    limit: usize,
}

impl io::Write for Counter {
    /// Counts `buffer`, or fails when it would take the total past the limit.
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        match self.written.checked_add(buffer.len()) {
            Some(total) if total <= self.limit => {
                self.written = total;
                Ok(buffer.len())
            }
            _ => Err(io::Error::other("the answer is over the response limit")),
        }
    }

    /// Nothing is buffered.
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

/// Whether `answer` serializes, with `serde_json`, in at most `limit` bytes.
///
/// The types here cannot fail to serialize for any reason but the counting
/// writer's, so a failure is the limit; `serde_json` stops writing at the
/// first failed write, which is what bounds the work for an oversized answer.
fn serializes_within(answer: &RegexBenchAnswer, limit: usize) -> bool {
    let mut counter = Counter { written: 0, limit };
    serde_json::to_writer(&mut counter, answer).is_ok()
}
