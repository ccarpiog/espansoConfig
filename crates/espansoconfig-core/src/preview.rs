//! The pure, bounded illustrative preview (Phase 4-17).
//!
//! # What it is, and what it is not
//!
//! An **illustration for one example**, never an espanso engine
//! (`docs/decisions/4-split-notes.md` ruling 26; the consult's Q6). Given one
//! match of a projected document and the samples a person chose — which choice
//! entry, which random entry, what a form field holds, what a regex capture
//! matched — it answers what the match's content would read as **for that
//! example**, with every value it does not produce kept as a structured,
//! identifiable segment rather than a guessed string. Nothing here claims how
//! espanso evaluates a variable (R16, R30 stay open).
//!
//! The type table is the consult's (`docs/reviews/phase-4-design.md` Q6):
//!
//! | Kind | Preview |
//! |---|---|
//! | `echo` | its `echo` text, with references resolved when injection is certainly enabled |
//! | `choice` | the selected entry's returned id; a `{label, id}` record's value is enclosed in a [`PreviewSegment::Choice`] carrying its label |
//! | `random` | the selected entry — a sample the request chose, never a random draw |
//! | `form` | a `{{form.field}}` is the supplied sample for that field; a shorthand `form:` layout is filled from samples |
//! | `clipboard` | a placeholder; **the clipboard is never read** |
//! | `shell` | a placeholder carrying the authored command; **never executed** |
//! | `script` | a placeholder carrying the authored argument list; **never executed** |
//! | `match` | a placeholder carrying the nested trigger; no recursive rendering |
//! | `date` | not previewed yet ([`PreviewUnresolved::DateNotPreviewed`]); Phase 4-18 adds it |
//!
//! # Pure and deterministic
//!
//! No I/O, no clock, no process, no clipboard, no random-number generator and
//! no environment read: the answer is a function of the projection and the
//! request alone, so **identical requests give identical output**. A random
//! variable's "example" is the index the request names.
//!
//! # One reference grammar, one resolver
//!
//! References are found by [`crate::analysis::scan_references`] — the one
//! scanner over the validator's transcribed `REFERENCE_PATTERN`, shared rather
//! than copied — and names are resolved by the analysis's own resolver
//! (locals, then regex captures, then globals, then the synthesised shorthand
//! form), constructed by the same function the analysis uses. A token the
//! pattern declines (`{{ not-a-name }}`) stays literal text here exactly as it
//! is no reference there.
//!
//! # Bounded topological evaluation
//!
//! The variables a value needs are evaluated dependencies first. The
//! dependency graph is the one the kinds actually render: a reference inside an
//! `echo` text, a `choice` entry's id or a `random` entry, when injection is
//! certainly enabled. Every member of a cycle the analysis reports (explicit
//! `depends_on` or inferred) — and, defensively, anything the topological pass
//! cannot order — answers [`PreviewUnresolved::Cycle`]. Each variable's
//! **height** (the longest chain of variables below it, itself included) is
//! computed without recursion; one whose height exceeds
//! [`PreviewLimits::depth`] answers [`PreviewUnresolved::DepthLimit`], which is
//! also what bounds the evaluator's own recursion. Every value is memoised, so
//! a variable referenced many times is evaluated once.
//!
//! # Output and work are bounded
//!
//! Every body shares one output budget ([`PreviewLimits::output_bytes`] and
//! [`PreviewLimits::segments`]); a value built for a variable is capped at the
//! same budget; and the total size of every value built is capped by
//! [`PreviewLimits::work`]. Reaching any of them stops the output where it is,
//! cut on a character boundary, and names the limit in
//! [`MatchPreview::limit`].
//!
//! # Hostile text is data
//!
//! Every text segment carries the characters the file (or the request) holds,
//! **unchanged**: `<script>`, `<img onerror=…>` and any other markup come back
//! as data. Nothing here escapes, sanitises or interprets HTML or Markdown —
//! **escaping is the renderer's job** (Phase 4-19 draws these segments as
//! text), and a preview that pre-escaped would be escaped twice there.
//!
//! # D2u
//!
//! A value is read as the scalar's decoded text. A plain scalar YAML 1.1 may
//! read as something other than a string (`yes`, `0o17`, …) is not coerced
//! either way: it answers [`PreviewUnresolved::AmbiguousScalar`]. An
//! `inject_vars` spelling that is neither a recognised true nor a recognised
//! false answers [`PreviewUnresolved::InjectionUncertain`] when the value holds
//! a reference, rather than choosing one reading.

use std::collections::HashMap;
use std::rc::Rc;

use serde::{Deserialize, Serialize};

use crate::analysis::dependency::{
    analyze_global_scope, global_scope_names, match_scope_names, names_of, synthesizes_form, Names,
    Resolution,
};
use crate::analysis::{
    analyze_match, scan_references, FormLayoutAnalysis, Injection, LayoutSegment, ReferenceToken,
    ScopeAnalysis,
};
use crate::model::{
    ContentKind, DocumentView, MatchView, ScalarView, ValueView, VariableKind, VariableView,
};
use crate::validate::{params_are_readable, regex_capture_names, rendered_content};

/// The most bytes of text a whole preview answers: 64 KiB.
pub const MAX_PREVIEW_OUTPUT_BYTES: usize = 64 * 1024;
/// The most segments a whole preview answers.
pub const MAX_PREVIEW_SEGMENTS: usize = 4096;
/// The longest chain of variables a value may need, the variable itself
/// included.
pub const MAX_PREVIEW_DEPTH: usize = 16;
/// The most bytes (plus one per segment) every variable value built for one
/// preview may add up to: 1 MiB.
pub const MAX_PREVIEW_WORK: usize = 1024 * 1024;
/// The most `args` a script placeholder carries. A longer list is not built
/// ([`PreviewUnresolved::ValueUnreadable`]), whatever its elements' size.
pub const MAX_PREVIEW_ARGUMENTS: usize = 256;

/// The bounds one preview runs under.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PreviewLimits {
    /// The most bytes of text the whole answer holds, and any one value.
    pub output_bytes: usize,
    /// The most segments the whole answer holds, and any one value.
    pub segments: usize,
    /// The longest chain of variables a value may need.
    pub depth: usize,
    /// The most bytes, plus one per segment, every value built may add up to.
    pub work: usize,
}

impl PreviewLimits {
    /// The limits the command uses.
    pub const DEFAULT: PreviewLimits = PreviewLimits {
        output_bytes: MAX_PREVIEW_OUTPUT_BYTES,
        segments: MAX_PREVIEW_SEGMENTS,
        depth: MAX_PREVIEW_DEPTH,
        work: MAX_PREVIEW_WORK,
    };
}

/// Where a previewed value comes from. An address by position (a variable) or
/// by the file's own name (a capture), never a byte offset.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum PreviewSource {
    /// The match's own `vars`, at this position.
    Local {
        /// Its position in `vars`.
        index: usize,
    },
    /// The document's `global_vars`, at this position.
    Global {
        /// Its position in `global_vars`.
        index: usize,
    },
    /// The form a shorthand `form:` layout synthesises.
    ShorthandForm {},
    /// A named capture group of the match's `regex`.
    Capture {
        /// The group's name, as the pattern writes it.
        name: String,
    },
}

/// Which entry a `choice` or `random` variable yields for this example.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SelectionSample {
    /// The variable.
    pub variable: PreviewSource,
    /// The entry's position in its `values` or `choices` list.
    pub index: usize,
}

/// What one form field holds for this example.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FormValueSample {
    /// The form: a `type: form` variable, or [`PreviewSource::ShorthandForm`].
    pub form: PreviewSource,
    /// The field's name.
    pub field: String,
    /// The sample value, used as given.
    pub value: String,
}

/// What one regex capture matched for this example.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CaptureSample {
    /// The capture group's name.
    pub name: String,
    /// The sample value, used as given.
    pub value: String,
}

/// Every sample one preview request carries. When two samples address the same
/// thing, the first one is used; a sample addressing nothing is ignored.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PreviewSamples {
    /// Which entry each `choice` and `random` variable yields.
    pub selections: Vec<SelectionSample>,
    /// What form fields hold.
    pub form_values: Vec<FormValueSample>,
    /// What regex captures matched.
    pub captures: Vec<CaptureSample>,
}

/// A value this preview shows as a placeholder, because producing it would
/// mean reading the clipboard, running something or rendering another match.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum PreviewPlaceholder {
    /// The clipboard's contents at expansion time. Never read.
    Clipboard {},
    /// A shell command's output. Never executed.
    Shell {
        /// The authored `cmd` text, when it is one decoded scalar.
        command: Option<String>,
    },
    /// A script's output. Never executed.
    Script {
        /// The authored `args`, when they are a list of decoded scalars; a list
        /// over [`MAX_PREVIEW_ARGUMENTS`] or over the output budget is never built.
        args: Option<Vec<String>>,
    },
    /// Another match's expansion. Not rendered.
    Match {
        /// The authored `trigger` parameter, when it is one decoded scalar.
        trigger: Option<String>,
    },
}

/// Why a reference or a value is not previewed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum PreviewUnresolved {
    /// No declaration visible to this application carries the name.
    UnknownName,
    /// Several declarations share the name, so it resolves to none of them.
    AmbiguousName,
    /// The variable is part of a dependency cycle as this application reads
    /// the graph.
    Cycle,
    /// The value needs a longer chain of variables than the preview follows.
    DepthLimit,
    /// The preview's total work budget was spent before this value.
    WorkLimit,
    /// The value needs a sample the request does not carry.
    MissingSample,
    /// The selected entry does not exist in the list.
    SampleOutOfRange,
    /// A form is referenced without a field; a form is not one text.
    FormIsNotAScalar,
    /// The field is not found in the form's supported layout syntax, and no
    /// sample was given for it.
    FieldNotInLayout,
    /// A `.field` sub-reference on something that is not a form.
    SubnameUnsupported,
    /// The value holds a reference and its `inject_vars` spelling is neither
    /// a recognised true nor a recognised false.
    InjectionUncertain,
    /// The text the preview needs is absent, not a scalar, not decodable, or
    /// written in a shape this preview does not read.
    ValueUnreadable,
    /// The text is a plain scalar YAML 1.1 may read as something other than a
    /// string; the preview does not pick a reading.
    AmbiguousScalar,
    /// A date variable. Date preview is a later step's.
    DateNotPreviewed,
    /// The variable's `type` is absent or names no kind this preview knows.
    KindNotPreviewed,
    /// A `{{…}}` inside a shorthand `form:` layout, which espanso's loader
    /// rewrites; what it becomes is not established.
    UnverifiedLayoutReference,
    /// A `[[` region outside the supported placeholder subset.
    UnsupportedLayoutSyntax,
}

/// One piece of a previewed text, in order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum PreviewSegment {
    /// Text the content field writes, as written.
    Literal {
        /// The text, unchanged — markup included.
        text: String,
    },
    /// Text a variable, a form sample or a capture sample produced for this
    /// example.
    Sample {
        /// The text, unchanged — markup included.
        text: String,
        /// Where it came from.
        source: PreviewSource,
    },
    /// The value a selected `{label, id}` choice record returned, enclosed
    /// with the label the record displays: every segment its id produced —
    /// literal pieces and whatever its references substituted — is inside.
    Choice {
        /// The choice variable.
        source: PreviewSource,
        /// The record's displayed label.
        label: String,
        /// What its id produced.
        segments: Vec<PreviewSegment>,
    },
    /// A value shown as a placeholder.
    Placeholder {
        /// The variable.
        source: PreviewSource,
        /// What it stands for.
        placeholder: PreviewPlaceholder,
    },
    /// A reference or a value that is not previewed.
    Unresolved {
        /// The text as written where it stands — a `{{reference}}` token, a
        /// `[[field]]` placeholder, or a whole content field.
        text: String,
        /// What it resolved to, when it resolved to anything.
        source: Option<PreviewSource>,
        /// Why it is not previewed.
        reason: PreviewUnresolved,
    },
}

impl PreviewSegment {
    /// The bytes of text this segment carries, for the output budget.
    fn bytes(&self) -> usize {
        match self {
            PreviewSegment::Literal { text } => text.len(),
            PreviewSegment::Sample { text, source } => text.len() + source_bytes(source),
            // Every enclosed segment is charged one besides its own bytes,
            // so an empty one is never free.
            PreviewSegment::Choice {
                source,
                label,
                segments,
            } => {
                source_bytes(source)
                    + label.len()
                    + segments
                        .iter()
                        .map(|inner| 1 + inner.bytes())
                        .sum::<usize>()
            }
            PreviewSegment::Placeholder {
                source,
                placeholder,
            } => source_bytes(source) + placeholder_bytes(placeholder),
            PreviewSegment::Unresolved { text, source, .. } => {
                text.len() + source.as_ref().map_or(0, source_bytes)
            }
        }
    } // End of function bytes()
} // End of impl PreviewSegment

/// A limit a preview reached.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum PreviewLimit {
    /// [`PreviewLimits::output_bytes`]: the output stops there.
    OutputBytes,
    /// [`PreviewLimits::segments`]: the output stops there.
    Segments,
    /// [`PreviewLimits::work`]: later values are [`PreviewUnresolved::WorkLimit`].
    Work,
}

/// One content field, previewed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PreviewBody {
    /// Which field: `Replace`, `Markdown`, `Html`, or `Form` for a shorthand
    /// layout.
    pub field: ContentKind,
    /// Its segments, in text order.
    pub segments: Vec<PreviewSegment>,
}

/// A match previewed for one example.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MatchPreview {
    /// Each rendered content field (`replace`, `markdown`, `html`, in that
    /// order), or the shorthand `form:` layout when it is the content. Empty
    /// for a match with none (an `image_path`, say).
    pub bodies: Vec<PreviewBody>,
    /// The first limit reached, when one was.
    pub limit: Option<PreviewLimit>,
}

/// Previews `entry`, a match of `view`, for the example `samples` describe,
/// under [`PreviewLimits::DEFAULT`].
pub fn preview_match(
    view: &DocumentView,
    entry: &MatchView,
    samples: &PreviewSamples,
) -> MatchPreview {
    preview_match_with_limits(view, entry, samples, PreviewLimits::DEFAULT)
}

/// [`preview_match`] under explicit limits.
pub fn preview_match_with_limits(
    view: &DocumentView,
    entry: &MatchView,
    samples: &PreviewSamples,
    limits: PreviewLimits,
) -> MatchPreview {
    let local_names = names_of(&entry.vars);
    let global_names = names_of(&view.global_vars);
    let captures = regex_capture_names(entry).ok();
    let local_analysis = analyze_match(view, entry);
    let global_analysis = analyze_global_scope(view);
    let mut evaluator = Evaluator {
        view,
        entry,
        match_names: match_scope_names(entry, &local_names, captures.as_deref(), &global_names),
        global_names: global_scope_names(&global_names),
        local: &local_analysis.scope,
        globals: &global_analysis,
        shorthand: local_analysis.shorthand_form.as_ref(),
        samples: SampleIndex::of(samples),
        limits,
        order: Vec::new(),
        memo: HashMap::new(),
        work: 0,
        work_limited: false,
    };
    evaluator.order = evaluator.topological_order();
    let mut bodies = Vec::new();
    let mut budget = (limits.output_bytes, limits.segments);
    let mut limit = None;
    for (key, scalar) in rendered_content(entry) {
        let field = match key {
            "replace" => ContentKind::Replace,
            "markdown" => ContentKind::Markdown,
            _ => ContentKind::Html,
        };
        let mut buffer = Buffer::new(budget.0, budget.1);
        buffer.limit = limit;
        evaluator.body(scalar, &mut buffer);
        budget = (budget.0 - buffer.bytes, budget.1 - buffer.segments.len());
        limit = limit.or(buffer.limit);
        bodies.push(PreviewBody {
            field,
            segments: buffer.segments,
        });
    } // End of the loop over the rendered content fields
    if synthesizes_form(entry) {
        if let Some(layout) = &entry.content.form {
            let mut buffer = Buffer::new(budget.0, budget.1);
            buffer.limit = limit;
            evaluator.shorthand_body(layout, &mut buffer);
            limit = limit.or(buffer.limit);
            bodies.push(PreviewBody {
                field: ContentKind::Form,
                segments: buffer.segments,
            });
        }
    }
    if evaluator.work_limited {
        limit = limit.or(Some(PreviewLimit::Work));
    }
    MatchPreview { bodies, limit }
} // End of function preview_match_with_limits()

/// The bytes of a source's own text.
fn source_bytes(source: &PreviewSource) -> usize {
    match source {
        PreviewSource::Capture { name } => name.len(),
        _ => 0,
    }
}

/// The bytes of a placeholder's authored text.
fn placeholder_bytes(placeholder: &PreviewPlaceholder) -> usize {
    match placeholder {
        PreviewPlaceholder::Clipboard {} => 0,
        PreviewPlaceholder::Shell { command } => command.as_ref().map_or(0, String::len),
        // Each argument is charged one besides its bytes, so an empty
        // argument is never free (the 4-17 review's blocker).
        PreviewPlaceholder::Script { args } => args
            .as_ref()
            .map_or(0, |args| args.iter().map(|arg| 1 + arg.len()).sum()),
        PreviewPlaceholder::Match { trigger } => trigger.as_ref().map_or(0, String::len),
    }
}

/// The longest prefix of `text` of at most `max` bytes that ends on a
/// character boundary.
fn prefix(text: &str, max: usize) -> &str {
    let mut end = max.min(text.len());
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}

/// Segments collected under an output budget.
struct Buffer {
    /// What was collected.
    segments: Vec<PreviewSegment>,
    /// The bytes collected.
    bytes: usize,
    /// The byte budget.
    max_bytes: usize,
    /// The segment budget.
    max_segments: usize,
    /// The limit reached, after which nothing more is collected.
    limit: Option<PreviewLimit>,
}

impl Buffer {
    /// An empty buffer with these budgets.
    fn new(max_bytes: usize, max_segments: usize) -> Buffer {
        Buffer {
            segments: Vec::new(),
            bytes: 0,
            max_bytes,
            max_segments,
            limit: None,
        }
    }

    /// Whether a limit was reached.
    fn is_full(&self) -> bool {
        self.limit.is_some()
    }

    /// Adds one segment, or as much of its text as the byte budget allows.
    /// An empty literal or sample text adds nothing.
    fn push(&mut self, segment: PreviewSegment) {
        if let Some(cost) = self.admits(&segment) {
            self.bytes += cost;
            self.segments.push(segment);
        }
    }

    /// Adds a copy of one segment, **cloning it only once it is known to
    /// fit**, or as much of its text as the byte budget allows.
    fn push_copy(&mut self, segment: &PreviewSegment) {
        if let Some(cost) = self.admits(segment) {
            self.bytes += cost;
            self.segments.push(segment.clone());
        }
    }

    /// The cost of `segment` when it fits whole. When it does not, records the
    /// limit and keeps the part that fits — a text-bearing segment's text cut
    /// on a character boundary, built from a prefix and never from a clone of
    /// the whole; any other segment is kept whole or not at all.
    fn admits(&mut self, segment: &PreviewSegment) -> Option<usize> {
        if self.is_full() {
            return None;
        }
        if let PreviewSegment::Literal { text } | PreviewSegment::Sample { text, .. } = segment {
            if text.is_empty() {
                return None;
            }
        }
        if self.segments.len() >= self.max_segments {
            self.limit = Some(PreviewLimit::Segments);
            return None;
        }
        let cost = segment.bytes();
        let room = self.max_bytes - self.bytes;
        if cost <= room {
            return Some(cost);
        }
        self.limit = Some(PreviewLimit::OutputBytes);
        let cut = match segment {
            PreviewSegment::Literal { text } => PreviewSegment::Literal {
                text: prefix(text, room).to_owned(),
            },
            PreviewSegment::Sample { text, source } => {
                let fixed = cost - text.len();
                if fixed >= room {
                    return None;
                }
                PreviewSegment::Sample {
                    text: prefix(text, room - fixed).to_owned(),
                    source: source.clone(),
                }
            }
            _ => return None,
        };
        if let PreviewSegment::Literal { text } | PreviewSegment::Sample { text, .. } = &cut {
            if text.is_empty() {
                return None;
            }
        }
        self.bytes += cut.bytes();
        self.segments.push(cut);
        None
    } // End of function admits()

    /// Adds a memoised value, and the limit it reached if it reached one.
    fn extend(&mut self, value: &Value) {
        for segment in &value.segments {
            if self.is_full() {
                break;
            }
            self.push_copy(segment);
        }
        if self.limit.is_none() {
            self.limit = value.limit;
        }
    } // End of function extend()
} // End of impl Buffer

/// One variable's previewed value.
struct Value {
    /// Its segments.
    segments: Vec<PreviewSegment>,
    /// The limit reached while building it.
    limit: Option<PreviewLimit>,
}

/// A variable, by scope and position.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum Node {
    /// `vars[i]` of the match.
    Local(usize),
    /// `global_vars[i]`.
    Global(usize),
}

impl Node {
    /// The wire address of this variable.
    fn source(self) -> PreviewSource {
        match self {
            Node::Local(index) => PreviewSource::Local { index },
            Node::Global(index) => PreviewSource::Global { index },
        }
    }
}

/// Which resolver a text is read with.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Scope {
    /// The match's: its body and its local variables' parameters.
    Match,
    /// `global_vars`' own.
    Globals,
}

/// How a variable fared in the topological pass.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Standing {
    /// A cycle member, or unorderable.
    Cycle,
    /// Orderable, with the longest chain of variables below it, itself
    /// included.
    Height(usize),
}

/// Where a literal piece of text came from.
#[derive(Clone, Copy)]
enum Origin<'s> {
    /// A content field: pieces are [`PreviewSegment::Literal`].
    Body,
    /// A variable's parameter: pieces are [`PreviewSegment::Sample`].
    Variable {
        /// The variable.
        source: &'s PreviewSource,
    },
}

impl Origin<'_> {
    /// A segment holding `text` from this origin.
    fn piece(self, text: &str) -> PreviewSegment {
        match self {
            Origin::Body => PreviewSegment::Literal {
                text: text.to_owned(),
            },
            Origin::Variable { source } => PreviewSegment::Sample {
                text: text.to_owned(),
                source: source.clone(),
            },
        }
    } // End of function piece()
} // End of impl Origin

/// The request's samples, first one wins.
struct SampleIndex<'a> {
    /// Selected entry per variable.
    selections: HashMap<&'a PreviewSource, usize>,
    /// Field values per form.
    form_values: HashMap<&'a PreviewSource, HashMap<&'a str, &'a str>>,
    /// Capture values by name.
    captures: HashMap<&'a str, &'a str>,
}

impl<'a> SampleIndex<'a> {
    /// Indexes `samples`, keeping the first sample for each address.
    fn of(samples: &'a PreviewSamples) -> SampleIndex<'a> {
        let mut index = SampleIndex {
            selections: HashMap::new(),
            form_values: HashMap::new(),
            captures: HashMap::new(),
        };
        for sample in &samples.selections {
            index
                .selections
                .entry(&sample.variable)
                .or_insert(sample.index);
        }
        for sample in &samples.form_values {
            index
                .form_values
                .entry(&sample.form)
                .or_default()
                .entry(sample.field.as_str())
                .or_insert(sample.value.as_str());
        }
        for sample in &samples.captures {
            index
                .captures
                .entry(sample.name.as_str())
                .or_insert(sample.value.as_str());
        }
        index
    } // End of function of()

    /// The sample value for one field of one form.
    fn form_value(&self, form: &PreviewSource, field: &str) -> Option<&'a str> {
        self.form_values
            .get(form)
            .and_then(|fields| fields.get(field))
            .copied()
    }
} // End of impl SampleIndex

/// The evaluation of one preview.
struct Evaluator<'a> {
    /// The document.
    view: &'a DocumentView,
    /// The match.
    entry: &'a MatchView,
    /// The match's resolver.
    match_names: Names<'a>,
    /// `global_vars`' resolver.
    global_names: Names<'a>,
    /// The analysis of the match's `vars`.
    local: &'a ScopeAnalysis,
    /// The analysis of `global_vars`.
    globals: &'a ScopeAnalysis,
    /// The match's shorthand layout, when it has one.
    shorthand: Option<&'a FormLayoutAnalysis>,
    /// The request's samples.
    samples: SampleIndex<'a>,
    /// The bounds.
    limits: PreviewLimits,
    /// Every variable's standing: globals first, then locals.
    order: Vec<Standing>,
    /// Every value built.
    memo: HashMap<Node, Result<Rc<Value>, PreviewUnresolved>>,
    /// The work spent so far.
    work: usize,
    /// Whether the work budget ran out.
    work_limited: bool,
}

impl<'a> Evaluator<'a> {
    /// The variable a node names.
    fn variable(&self, node: Node) -> &'a VariableView {
        match node {
            Node::Local(index) => &self.entry.vars[index],
            Node::Global(index) => &self.view.global_vars[index],
        }
    }

    /// The node's position in [`Evaluator::order`].
    fn slot(&self, node: Node) -> usize {
        match node {
            Node::Global(index) => index,
            Node::Local(index) => self.view.global_vars.len() + index,
        }
    }

    /// The scope a node's parameters are read in, and its injection state.
    fn scope_of(&self, node: Node) -> (Scope, Injection) {
        match node {
            Node::Local(index) => (Scope::Match, self.local.declarations[index].injection),
            Node::Global(index) => (Scope::Globals, self.globals.declarations[index].injection),
        }
    }

    /// The resolver for a scope.
    fn names(&self, scope: Scope) -> &Names<'a> {
        match scope {
            Scope::Match => &self.match_names,
            Scope::Globals => &self.global_names,
        }
    }

    /// The variable `name` resolves to from `scope`, when it resolves to
    /// exactly one variable.
    fn node_of(&self, scope: Scope, name: &str) -> Option<Node> {
        match (self.names(scope).resolve(name), scope) {
            (Resolution::Local(index), Scope::Match) => Some(Node::Local(index)),
            (Resolution::Local(index), Scope::Globals) => Some(Node::Global(index)),
            (Resolution::Global(Some(index)), _) => Some(Node::Global(index)),
            _ => None,
        }
    }

    /// Every text a variable's kind may render, which is exactly where its
    /// evaluation dependencies are read.
    fn rendered_texts(variable: &VariableView) -> Vec<&ScalarView> {
        let list = |key: &str| match param(variable, key) {
            Some(ValueView::Sequence(items)) => items.iter().collect::<Vec<_>>(),
            _ => Vec::new(),
        };
        match variable.kind {
            VariableKind::Echo => match param(variable, "echo") {
                Some(ValueView::Scalar(scalar)) => vec![scalar],
                _ => Vec::new(),
            },
            VariableKind::Choice => list("values")
                .into_iter()
                .filter_map(|item| choice_item(item).ok().map(|(id, _)| id))
                .collect(),
            VariableKind::Random => list("choices")
                .into_iter()
                .filter_map(|item| match item {
                    ValueView::Scalar(scalar) => Some(scalar),
                    _ => None,
                })
                .collect(),
            _ => Vec::new(),
        }
    } // End of function rendered_texts()

    /// Every variable's standing: cycle members as the analysis reports them,
    /// and every other variable's height, computed dependencies first without
    /// recursion (Kahn's algorithm). Anything left unordered is a cycle.
    fn topological_order(&self) -> Vec<Standing> {
        let globals = self.view.global_vars.len();
        let nodes: Vec<Node> = (0..globals)
            .map(Node::Global)
            .chain((0..self.entry.vars.len()).map(Node::Local))
            .collect();
        let mut cycle = vec![false; nodes.len()];
        for member in self.globals.cycles.iter().flat_map(|c| &c.members) {
            cycle[*member] = true;
        }
        for member in self.local.cycles.iter().flat_map(|c| &c.members) {
            cycle[globals + member] = true;
        }
        let mut dependencies: Vec<Vec<usize>> = vec![Vec::new(); nodes.len()];
        let mut dependents: Vec<Vec<usize>> = vec![Vec::new(); nodes.len()];
        let mut pending = vec![0usize; nodes.len()];
        for (slot, node) in nodes.iter().enumerate() {
            let (scope, injection) = self.scope_of(*node);
            if cycle[slot] || injection != Injection::Enabled {
                continue;
            }
            for scalar in Self::rendered_texts(self.variable(*node)) {
                for token in scan_references(&scalar.text) {
                    let Some(dependency) = self.node_of(scope, &token.name) else {
                        continue;
                    };
                    let target = self.slot(dependency);
                    if cycle[target] || dependencies[slot].contains(&target) {
                        continue;
                    }
                    dependencies[slot].push(target);
                    dependents[target].push(slot);
                    pending[slot] += 1;
                } // End of the loop over one text's references
            } // End of the loop over the variable's rendered texts
        } // End of the loop over the variables
        let mut standing: Vec<Option<Standing>> = cycle
            .iter()
            .map(|&member| member.then_some(Standing::Cycle))
            .collect();
        let mut ready: Vec<usize> = (0..nodes.len())
            .filter(|&slot| !cycle[slot] && pending[slot] == 0)
            .collect();
        while let Some(slot) = ready.pop() {
            let below = dependencies[slot]
                .iter()
                .map(|&dependency| match standing[dependency] {
                    Some(Standing::Height(height)) => height,
                    _ => 1,
                })
                .max()
                .unwrap_or(0);
            standing[slot] = Some(Standing::Height(below + 1));
            for &dependent in &dependents[slot] {
                pending[dependent] -= 1;
                if pending[dependent] == 0 {
                    ready.push(dependent);
                }
            }
        } // End of the topological walk
        standing
            .into_iter()
            .map(|standing| standing.unwrap_or(Standing::Cycle))
            .collect()
    } // End of function topological_order()

    /// One variable's value, memoised.
    fn value(&mut self, node: Node) -> Result<Rc<Value>, PreviewUnresolved> {
        if let Some(known) = self.memo.get(&node) {
            return known.clone();
        }
        let computed = self.compute(node);
        self.memo.insert(node, computed.clone());
        computed
    }

    /// One variable's value, built.
    fn compute(&mut self, node: Node) -> Result<Rc<Value>, PreviewUnresolved> {
        match self.order[self.slot(node)] {
            Standing::Cycle => return Err(PreviewUnresolved::Cycle),
            Standing::Height(height) if height > self.limits.depth => {
                return Err(PreviewUnresolved::DepthLimit)
            }
            Standing::Height(_) => {}
        }
        if self.work_limited {
            return Err(PreviewUnresolved::WorkLimit);
        }
        let variable = self.variable(node);
        let source = node.source();
        let (scope, injection) = self.scope_of(node);
        let mut buffer = Buffer::new(self.limits.output_bytes, self.limits.segments);
        match variable.kind {
            VariableKind::Echo => {
                let text = readable_scalar(variable, "echo")?;
                self.render(
                    text,
                    scope,
                    injection,
                    Origin::Variable { source: &source },
                    &mut buffer,
                )?;
            }
            VariableKind::Choice | VariableKind::Random => {
                let key = if variable.kind == VariableKind::Choice {
                    "values"
                } else {
                    "choices"
                };
                let index = *self
                    .samples
                    .selections
                    .get(&source)
                    .ok_or(PreviewUnresolved::MissingSample)?;
                let items = match readable_param(variable, key)? {
                    ValueView::Sequence(items) => items,
                    _ => return Err(PreviewUnresolved::ValueUnreadable),
                };
                let item = items
                    .get(index)
                    .ok_or(PreviewUnresolved::SampleOutOfRange)?;
                let (text, label) = if variable.kind == VariableKind::Choice {
                    choice_item(item)?
                } else {
                    match item {
                        ValueView::Scalar(scalar) => (scalar, None),
                        _ => return Err(PreviewUnresolved::ValueUnreadable),
                    }
                };
                let text = usable(text)?;
                self.render(
                    text,
                    scope,
                    injection,
                    Origin::Variable { source: &source },
                    &mut buffer,
                )?;
                // A record's whole value — substituted segments included —
                // is enclosed with its label (the 4-17 review's should-fix).
                if let Some(label) = label {
                    let segments = std::mem::take(&mut buffer.segments);
                    let enclosed = PreviewSegment::Choice {
                        source: source.clone(),
                        label: label.text.clone(),
                        segments,
                    };
                    let limit = buffer.limit;
                    buffer = Buffer::new(self.limits.output_bytes, self.limits.segments);
                    buffer.push(enclosed);
                    buffer.limit = buffer.limit.or(limit);
                }
            } // End of the choice and random arm
            VariableKind::Clipboard => buffer.push(PreviewSegment::Placeholder {
                source,
                placeholder: PreviewPlaceholder::Clipboard {},
            }),
            VariableKind::Shell => buffer.push(PreviewSegment::Placeholder {
                source,
                placeholder: PreviewPlaceholder::Shell {
                    command: decoded_scalar(variable, "cmd", self.limits)?,
                },
            }),
            VariableKind::Script => buffer.push(PreviewSegment::Placeholder {
                source,
                placeholder: PreviewPlaceholder::Script {
                    args: decoded_list(variable, "args", self.limits)?,
                },
            }),
            VariableKind::Match => buffer.push(PreviewSegment::Placeholder {
                source,
                placeholder: PreviewPlaceholder::Match {
                    trigger: decoded_scalar(variable, "trigger", self.limits)?,
                },
            }),
            VariableKind::Form => return Err(PreviewUnresolved::FormIsNotAScalar),
            VariableKind::Date => return Err(PreviewUnresolved::DateNotPreviewed),
            VariableKind::Unrecognised | VariableKind::Absent => {
                return Err(PreviewUnresolved::KindNotPreviewed)
            }
        }
        let cost = buffer.bytes + buffer.segments.len();
        if self.work + cost > self.limits.work {
            self.work_limited = true;
            return Err(PreviewUnresolved::WorkLimit);
        }
        self.work += cost;
        Ok(Rc::new(Value {
            segments: buffer.segments,
            limit: buffer.limit,
        }))
    } // End of function compute()

    /// Renders one text: literal pieces from `origin`, references resolved
    /// from `scope`. A text with no reference is the same whatever `injection`
    /// says; one with references is rendered only when injection is certainly
    /// enabled, kept literal when it is certainly disabled, and refused when it
    /// is uncertain.
    fn render(
        &mut self,
        text: &str,
        scope: Scope,
        injection: Injection,
        origin: Origin<'_>,
        buffer: &mut Buffer,
    ) -> Result<(), PreviewUnresolved> {
        let tokens = scan_references(text);
        if tokens.is_empty() || injection == Injection::Disabled {
            buffer.push(origin.piece(text));
            return Ok(());
        }
        if injection == Injection::Uncertain {
            return Err(PreviewUnresolved::InjectionUncertain);
        }
        self.render_tokens(text, &tokens, scope, origin, buffer);
        Ok(())
    } // End of function render()

    /// Literal pieces between `tokens`, and each token resolved.
    fn render_tokens(
        &mut self,
        text: &str,
        tokens: &[ReferenceToken],
        scope: Scope,
        origin: Origin<'_>,
        buffer: &mut Buffer,
    ) {
        let mut at = 0;
        for token in tokens {
            if buffer.is_full() {
                return;
            }
            buffer.push(origin.piece(&text[at..token.span.start]));
            self.reference(
                &text[token.span.start..token.span.end],
                token,
                scope,
                buffer,
            );
            at = token.span.end;
        } // End of the loop over the tokens
        buffer.push(origin.piece(&text[at..]));
    } // End of function render_tokens()

    /// One content field.
    fn body(&mut self, scalar: &ScalarView, buffer: &mut Buffer) {
        match usable(scalar) {
            Ok(text) => {
                let tokens = scan_references(text);
                self.render_tokens(text, &tokens, Scope::Match, Origin::Body, buffer);
            }
            Err(reason) => buffer.push(PreviewSegment::Unresolved {
                text: scalar.text.clone(),
                source: None,
                reason,
            }),
        }
    } // End of function body()

    /// A shorthand `form:` layout, filled from samples. Its `{{…}}` are
    /// unverified and its unsupported `[[` regions are reported.
    fn shorthand_body(&mut self, scalar: &ScalarView, buffer: &mut Buffer) {
        let (text, layout) = match (usable(scalar), self.shorthand) {
            (Ok(_), Some(layout)) => (layout.text.as_str(), &layout.layout),
            (Err(reason), _) => {
                return buffer.push(PreviewSegment::Unresolved {
                    text: scalar.text.clone(),
                    source: None,
                    reason,
                })
            }
            (Ok(_), None) => {
                return buffer.push(PreviewSegment::Unresolved {
                    text: scalar.text.clone(),
                    source: None,
                    reason: PreviewUnresolved::ValueUnreadable,
                })
            }
        };
        let form = PreviewSource::ShorthandForm {};
        for segment in &layout.segments {
            if buffer.is_full() {
                return;
            }
            let span = segment.span();
            let piece = &text[span.start..span.end];
            match segment {
                LayoutSegment::Text { .. } => {
                    let mut at = 0;
                    for token in scan_references(piece) {
                        buffer.push(PreviewSegment::Literal {
                            text: piece[at..token.span.start].to_owned(),
                        });
                        buffer.push(PreviewSegment::Unresolved {
                            text: piece[token.span.start..token.span.end].to_owned(),
                            source: None,
                            reason: PreviewUnresolved::UnverifiedLayoutReference,
                        });
                        at = token.span.end;
                    } // End of the loop over the text piece's references
                    buffer.push(PreviewSegment::Literal {
                        text: piece[at..].to_owned(),
                    });
                }
                LayoutSegment::Placeholder { name, .. } => {
                    buffer.push(match self.samples.form_value(&form, name) {
                        Some(value) => PreviewSegment::Sample {
                            text: value.to_owned(),
                            source: form.clone(),
                        },
                        None => PreviewSegment::Unresolved {
                            text: piece.to_owned(),
                            source: Some(form.clone()),
                            reason: PreviewUnresolved::MissingSample,
                        },
                    });
                }
                LayoutSegment::Malformed { .. } => buffer.push(PreviewSegment::Unresolved {
                    text: piece.to_owned(),
                    source: None,
                    reason: PreviewUnresolved::UnsupportedLayoutSyntax,
                }),
            }
        } // End of the loop over the layout's segments
    } // End of function shorthand_body()

    /// One `{{reference}}`, whose text as written is `written`.
    fn reference(
        &mut self,
        written: &str,
        token: &ReferenceToken,
        scope: Scope,
        buffer: &mut Buffer,
    ) {
        let unresolved = |source: Option<PreviewSource>, reason| PreviewSegment::Unresolved {
            text: written.to_owned(),
            source,
            reason,
        };
        let resolution = self.names(scope).resolve(&token.name);
        let node = match (resolution, scope) {
            (Resolution::Local(index), Scope::Match) => Node::Local(index),
            (Resolution::Local(index), Scope::Globals) | (Resolution::Global(Some(index)), _) => {
                Node::Global(index)
            }
            (Resolution::Ambiguous, _) | (Resolution::Global(None), _) => {
                return buffer.push(unresolved(None, PreviewUnresolved::AmbiguousName))
            }
            (Resolution::Unresolved, _) => {
                return buffer.push(unresolved(None, PreviewUnresolved::UnknownName))
            }
            (Resolution::Capture, _) => {
                let source = PreviewSource::Capture {
                    name: token.name.clone(),
                };
                if token.subname.is_some() {
                    return buffer.push(unresolved(
                        Some(source),
                        PreviewUnresolved::SubnameUnsupported,
                    ));
                }
                return buffer.push(match self.samples.captures.get(token.name.as_str()) {
                    Some(value) => PreviewSegment::Sample {
                        text: (*value).to_owned(),
                        source,
                    },
                    None => unresolved(Some(source), PreviewUnresolved::MissingSample),
                });
            } // End of the capture arm
            (Resolution::SynthesizedForm, _) => {
                let layout = self.shorthand;
                return self.form_reference(
                    PreviewSource::ShorthandForm {},
                    layout,
                    written,
                    token,
                    buffer,
                );
            }
        };
        let source = node.source();
        if self.variable(node).kind == VariableKind::Form {
            let layout = match node {
                Node::Local(index) => self.local.declarations[index].layout.as_ref(),
                Node::Global(index) => self.globals.declarations[index].layout.as_ref(),
            };
            return self.form_reference(source, layout, written, token, buffer);
        }
        if token.subname.is_some() {
            return buffer.push(unresolved(
                Some(source),
                PreviewUnresolved::SubnameUnsupported,
            ));
        }
        match self.value(node) {
            Ok(value) => buffer.extend(&value),
            Err(reason) => buffer.push(unresolved(Some(source), reason)),
        }
    } // End of function reference()

    /// A `{{form}}` or `{{form.field}}` reference. A sample always wins; with
    /// none, a field the supported layout does not hold is told apart from a
    /// field that merely has no sample.
    fn form_reference(
        &self,
        source: PreviewSource,
        layout: Option<&FormLayoutAnalysis>,
        written: &str,
        token: &ReferenceToken,
        buffer: &mut Buffer,
    ) {
        let segment = match &token.subname {
            None => PreviewSegment::Unresolved {
                text: written.to_owned(),
                source: Some(source),
                reason: PreviewUnresolved::FormIsNotAScalar,
            },
            Some(field) => match self.samples.form_value(&source, field) {
                Some(value) => PreviewSegment::Sample {
                    text: value.to_owned(),
                    source,
                },
                None => {
                    let absent = layout.is_some_and(|layout| {
                        layout.layout.is_fully_supported() && !layout.layout.contains(field)
                    });
                    PreviewSegment::Unresolved {
                        text: written.to_owned(),
                        source: Some(source),
                        reason: if absent {
                            PreviewUnresolved::FieldNotInLayout
                        } else {
                            PreviewUnresolved::MissingSample
                        },
                    }
                }
            },
        };
        buffer.push(segment);
    } // End of function form_reference()
} // End of impl Evaluator

/// The value of `params.<key>`, when `params` is readable and holds the key.
fn param<'v>(variable: &'v VariableView, key: &str) -> Option<&'v ValueView> {
    variable
        .params
        .iter()
        .find(|field| field.key.as_ref().is_some_and(|k| k.text == key))
        .map(|field| &field.value)
}

/// [`param`], refusing unreadable parameters.
fn readable_param<'v>(
    variable: &'v VariableView,
    key: &str,
) -> Result<&'v ValueView, PreviewUnresolved> {
    if !params_are_readable(variable) {
        return Err(PreviewUnresolved::ValueUnreadable);
    }
    param(variable, key).ok_or(PreviewUnresolved::ValueUnreadable)
}

/// `params.<key>` as a usable text.
fn readable_scalar<'v>(
    variable: &'v VariableView,
    key: &str,
) -> Result<&'v str, PreviewUnresolved> {
    match readable_param(variable, key)? {
        ValueView::Scalar(scalar) => usable(scalar),
        _ => Err(PreviewUnresolved::ValueUnreadable),
    }
}

/// A scalar's text, when it is decoded and not YAML-1.1-ambiguous.
fn usable(scalar: &ScalarView) -> Result<&str, PreviewUnresolved> {
    if !scalar.decoded {
        return Err(PreviewUnresolved::ValueUnreadable);
    }
    if scalar.ambiguous_yaml_1_1 {
        return Err(PreviewUnresolved::AmbiguousScalar);
    }
    Ok(&scalar.text)
}

/// `params.<key>` as authored display text, when it is one decoded scalar.
///
/// Measured before it is copied: a text longer than the whole output budget
/// is refused as [`PreviewUnresolved::ValueUnreadable`] rather than built.
fn decoded_scalar(
    variable: &VariableView,
    key: &str,
    limits: PreviewLimits,
) -> Result<Option<String>, PreviewUnresolved> {
    match param(variable, key) {
        Some(ValueView::Scalar(scalar)) if scalar.decoded => {
            if scalar.text.len() > limits.output_bytes {
                return Err(PreviewUnresolved::ValueUnreadable);
            }
            Ok(Some(scalar.text.clone()))
        }
        _ => Ok(None),
    }
} // End of function decoded_scalar()

/// `params.<key>` as authored display texts, when it is a list of decoded
/// scalars.
///
/// **Measured before anything is copied** (the 4-17 review's blocker): a list
/// of more than [`MAX_PREVIEW_ARGUMENTS`] items, or one whose charge — each
/// item's bytes plus one per item, as [`PreviewSegment::bytes`] charges it —
/// exceeds the whole output budget, is refused as
/// [`PreviewUnresolved::ValueUnreadable`] and never built.
fn decoded_list(
    variable: &VariableView,
    key: &str,
    limits: PreviewLimits,
) -> Result<Option<Vec<String>>, PreviewUnresolved> {
    let Some(ValueView::Sequence(items)) = param(variable, key) else {
        return Ok(None);
    };
    let mut scalars = Vec::with_capacity(items.len().min(MAX_PREVIEW_ARGUMENTS));
    let mut charge = 0usize;
    for item in items {
        let ValueView::Scalar(scalar) = item else {
            return Ok(None);
        };
        if !scalar.decoded {
            return Ok(None);
        }
        charge += 1 + scalar.text.len();
        if scalars.len() == MAX_PREVIEW_ARGUMENTS || charge > limits.output_bytes {
            return Err(PreviewUnresolved::ValueUnreadable);
        }
        scalars.push(scalar);
    } // End of the loop measuring the list
    Ok(Some(
        scalars
            .into_iter()
            .map(|scalar| scalar.text.clone())
            .collect(),
    ))
} // End of function decoded_list()

/// A `choice` entry's returned text and, for a `{label, id}` record, its
/// label. A scalar entry is its own id; a record needs a scalar `id`.
fn choice_item(item: &ValueView) -> Result<(&ScalarView, Option<&ScalarView>), PreviewUnresolved> {
    match item {
        ValueView::Scalar(scalar) => Ok((scalar, None)),
        ValueView::Mapping(fields) => {
            let field = |key: &str| {
                fields
                    .iter()
                    .find(|field| field.key.as_ref().is_some_and(|k| k.text == key))
                    .map(|field| &field.value)
            };
            let Some(ValueView::Scalar(id)) = field("id") else {
                return Err(PreviewUnresolved::ValueUnreadable);
            };
            let label = match field("label") {
                Some(ValueView::Scalar(label)) if label.decoded => Some(label),
                _ => None,
            };
            Ok((id, label))
        }
        _ => Err(PreviewUnresolved::ValueUnreadable),
    }
} // End of function choice_item()
