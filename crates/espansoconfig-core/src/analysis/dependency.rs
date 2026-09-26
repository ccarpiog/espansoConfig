//! Reference and dependency analysis over one projection (Phase 4-7).
//!
//! # What it answers
//!
//! For the document's `global_vars` and for each match's local `vars`, a
//! [`ScopeAnalysis`]: every declaration in authored order, the dependency
//! graph between them, the cycles in it, the explicit `depends_on` names that
//! resolve to nothing visible, per-declaration usage counts, form sub-reference
//! advisories, order advisories, and the reasons the answer is incomplete.
//!
//! # The graph, and the two kinds of edge
//!
//! Vertices are declarations identified by their **position** in their own
//! sequence. An edge runs from a consumer to a dependency, and is one of two
//! kinds, kept distinguishable ([`EdgeKind`]):
//!
//! - **explicit** — a `depends_on` entry naming the dependency;
//! - **inferred** — a `{{reference}}` inside the consumer's parameter
//!   **values** (never keys), and only when injection is **certainly** enabled,
//!   which is [`crate::validate`]'s own rule (`injection_is_certainly_enabled`,
//!   reused rather than re-spelled). The recursion is the validator's too:
//!   scalars scanned, sequences and mappings descended into by value, aliases and
//!   elided values not read.
//!
//! Globals and regex captures take part in **name resolution** but acquire no
//! position in a match's local graph (the consult's Q3). A name held by two
//! declarations of one sequence resolves to neither: no edge is invented, and
//! the ambiguity is an [`IncompleteReason`].
//!
//! # Conservative, and never a closed-scope claim it cannot back
//!
//! A `depends_on` name is reported as missing only when the scope is **closed**
//! by exactly the openers rule 5 uses (imports, an unreadable `global_vars` or
//! `vars`, a `regex` whose captures could not be read) — the shared
//! [`scope_openers`]. Under an open scope the analysis records why and makes no
//! missing-name claim at all. This is an analysis rule, not an espanso
//! resolver: file order is not claimed to be espanso's execution order, and a
//! declaration with no visible reference is not claimed to have no effect
//! (espanso evaluates every local variable; `crate::validate::required_param`'s
//! documentation).
//!
//! # Shorthand `form:` is not rendered content
//!
//! The shorthand layout stays out of `rendered_content`, as the validator
//! requires: espanso's loader rewrites it. Its `{{…}}` occurrences are returned
//! as **unverified layout references**, counted separately in [`Usage`], and
//! never enter the graph or any finding.

use std::collections::{HashMap, HashSet};

use serde::Serialize;

use super::placeholder::PlaceholderLayout;
use super::reference::{scan_references, ReferenceToken};
use crate::model::{
    DocumentView, FieldView, MatchView, ScalarView, SequencePresence, ValueView, VariableKind,
    VariableView,
};
use crate::patch::DocumentPath;
use crate::syntax::{ByteSpan, NodeId};
use crate::validate::{
    injection_is_certainly_enabled, params_are_readable, regex_capture_names, rendered_content,
};

/// The name espanso's loader gives the variable it synthesises from a
/// shorthand `form:` (`crate::validate`'s `rendered_content` documentation).
pub const SYNTHESIZED_FORM_NAME: &str = "form1";

/// Which form a sub-reference or a layout reason is about.
///
/// Struct variants, so it crosses the wire as a uniform one-key object
/// (Phase 4-8 puts it there inside an analysis summary).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum FormSource {
    /// The `type: form` variable at this position of the scope.
    Variable {
        /// Its position in the scope's sequence.
        index: usize,
    },
    /// The match's shorthand `form:` layout, as the synthesised form.
    Shorthand {},
}

/// Why some part of an analysis is not definitive.
///
/// Positions, never file text: a reason names a declaration by its index in
/// its own sequence. Every variant is a struct variant, so the enum crosses the
/// wire as a uniform one-key object (Phase 4-8).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
pub enum IncompleteReason {
    /// The document has `imports`, which may bring more global names in.
    ImportsOpenScope {},
    /// `global_vars` was not projected, so its names were never read.
    GlobalVarsUnreadable {},
    /// The match's `vars` was not projected, so its names were never read.
    LocalVarsUnreadable {},
    /// The match's `regex` did not compile here, so its captures are unknown.
    RegexCapturesUnknown {},
    /// Several declarations of this sequence share one name; a reference to
    /// it resolves to none of them.
    DuplicateDeclaration {
        /// The positions sharing the name, ascending.
        declarations: Vec<usize>,
    },
    /// A declaration has no `name`, or one this crate could not decode.
    NameUnreadable {
        /// Its position.
        declaration: usize,
    },
    /// A declaration of this match's `vars` writes a `name` this crate could
    /// not read (an alias, a collection, an undecodable scalar), so the set of
    /// local names is open.
    LocalNameUnreadable {
        /// Its position in `vars`.
        declaration: usize,
    },
    /// A declaration of `global_vars` writes a `name` this crate could not
    /// read, so the set of global names is open.
    GlobalNameUnreadable {
        /// Its position in `global_vars`.
        declaration: usize,
    },
    /// A declaration's `depends_on` is not a sequence of scalars.
    DependsOnUnreadable {
        /// Its position.
        declaration: usize,
    },
    /// A declaration's parameters hold an alias, a merge key or an elided
    /// value, so some parameter references were not read.
    ParamsUnreadable {
        /// Its position.
        declaration: usize,
    },
    /// A declaration writes `inject_vars` in a spelling that is neither a
    /// recognised true nor a recognised false, so its parameter references
    /// neither count nor certainly do not.
    InjectionUncertain {
        /// Its position.
        declaration: usize,
    },
    /// A form sub-reference names a form whose layout is not a readable
    /// scalar.
    LayoutUnavailable {
        /// The form.
        form: FormSource,
    },
    /// A form sub-reference names a form whose layout holds syntax outside the
    /// supported placeholder subset, so "not found" cannot be said.
    LayoutUnsupported {
        /// The form.
        form: FormSource,
    },
}

/// Whether a declaration's parameters take `{{references}}`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum Injection {
    /// Absent `inject_vars`, or a recognised true spelling.
    Enabled,
    /// A recognised false spelling (`false`, `no`, `off`, any case).
    Disabled,
    /// Any other spelling.
    Uncertain,
}

/// How often a declaration is referenced, by where the reference is.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize)]
pub struct Usage {
    /// References in `replace`, `markdown` or `html`.
    pub body: usize,
    /// References in parameter values whose injection is enabled.
    pub parameters: usize,
    /// `depends_on` entries naming it.
    pub depends_on: usize,
    /// `{{…}}` occurrences in a shorthand `form:` layout — unverified.
    pub unverified_layout: usize,
}

impl Usage {
    /// Whether any visible reference was found.
    ///
    /// `false` means **"no visible reference found"** — never "has no
    /// effect" (ruling 13).
    pub fn has_visible_reference(&self) -> bool {
        self.body + self.parameters + self.depends_on + self.unverified_layout > 0
    }
}

/// A form layout, parsed into the supported subset, with the definitions it
/// does not mention.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FormLayoutAnalysis {
    /// The layout text that was parsed — the scalar's decoded text. Every span
    /// in [`FormLayoutAnalysis::layout`] indexes into it, so a caller that must
    /// hand a segment's text across the wire cuts it here, in Rust (Phase 4-8).
    pub text: String,
    /// The parsed layout.
    pub layout: PlaceholderLayout,
    /// Every field definition key with no supported placeholder of its name,
    /// in definition order. Advisory only: a definition is never deleted.
    pub definitions_without_occurrence: Vec<String>,
}

/// One declaration of a sequence.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Declaration {
    /// Its position in its sequence.
    pub index: usize,
    /// Its `name` text, when it has one.
    pub name: Option<String>,
    /// Its type.
    pub kind: VariableKind,
    /// Whether its parameters take references.
    pub injection: Injection,
    /// How often it is referenced.
    pub usage: Usage,
    /// Its layout, when it is a `type: form` whose `params.layout` is a scalar.
    pub layout: Option<FormLayoutAnalysis>,
}

/// Which way an edge was learnt.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum EdgeKind {
    /// A `depends_on` entry.
    Explicit,
    /// A reference inside a parameter value, injection enabled.
    Inferred,
}

/// A consumer depending on a declaration of the same sequence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct DependencyEdge {
    /// The consumer's position.
    pub consumer: usize,
    /// The dependency's position.
    pub dependency: usize,
    /// How it was learnt.
    pub kind: EdgeKind,
    /// The scalar the edge was read from, in the document.
    pub span: ByteSpan,
}

/// A set of declarations that depend on each other, directly or through one
/// another.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DependencyCycle {
    /// The positions, ascending. One member means a self-dependency.
    pub members: Vec<usize>,
    /// Whether an explicit edge lies inside the cycle.
    pub explicit: bool,
    /// Whether an inferred edge lies inside the cycle.
    pub inferred: bool,
}

/// A `depends_on` entry naming nothing visible, under a closed scope.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MissingDependency {
    /// The consumer's position.
    pub consumer: usize,
    /// The entry's position inside `depends_on`.
    pub entry: usize,
    /// The name, as the file writes it.
    pub name: String,
    /// The entry's scalar in the document.
    pub span: ByteSpan,
    /// The entry's node.
    pub node: NodeId,
}

/// A consumer authored before a dependency of the same sequence.
///
/// Advisory: authored order is never re-sorted, and file order is not claimed
/// to be espanso's execution order (ruling 11).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub struct OrderAdvisory {
    /// The consumer's position.
    pub consumer: usize,
    /// The later dependency's position.
    pub dependency: usize,
}

/// A `{{form.field}}` whose field is not found in the supported layout
/// syntax — never "espanso will reject this field" (the consult's Q8).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FormSubReferenceAdvisory {
    /// The scalar holding the reference, in the document.
    pub scalar: ByteSpan,
    /// The reference token, as offsets into that scalar's text.
    pub token: ByteSpan,
    /// The form the name resolved to.
    pub form: FormSource,
    /// The field name after the dot.
    pub field: String,
}

/// The analysis of one variable sequence.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ScopeAnalysis {
    /// Every declaration, in authored order.
    pub declarations: Vec<Declaration>,
    /// Every edge between two declarations of this sequence, in the order
    /// read.
    pub edges: Vec<DependencyEdge>,
    /// Every cycle, ordered by first member.
    pub cycles: Vec<DependencyCycle>,
    /// Explicit dependencies naming nothing visible. Always empty when
    /// [`ScopeAnalysis::scope_closed`] is false.
    pub missing_dependencies: Vec<MissingDependency>,
    /// Consumers authored before a dependency.
    pub order_advisories: Vec<OrderAdvisory>,
    /// Form sub-references whose field is not found.
    pub form_advisories: Vec<FormSubReferenceAdvisory>,
    /// Why parts of the answer are uncertain; empty only for a complete one.
    pub incomplete: Vec<IncompleteReason>,
    /// Whether the set of visible names is closed.
    pub scope_closed: bool,
}

/// The analysis of one match.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatchAnalysis {
    /// The match's path, when it has one.
    pub path: Option<DocumentPath>,
    /// Its local `vars`, with body and parameter references resolved.
    pub scope: ScopeAnalysis,
    /// The `regex` trigger's named captures; empty when there is no regex or
    /// they could not be read (the latter is an [`IncompleteReason`]).
    pub captures: Vec<String>,
    /// Its shorthand `form:` layout, when it has one.
    pub shorthand_form: Option<FormLayoutAnalysis>,
    /// The `{{…}}` occurrences in that layout, as offsets into its text.
    pub unverified_layout_references: Vec<ReferenceToken>,
}

/// The analysis of a whole document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentAnalysis {
    /// `global_vars`, with usage counted across the whole document.
    pub globals: ScopeAnalysis,
    /// Each match, in document order.
    pub matches: Vec<MatchAnalysis>,
}

/// Analyses every scope of `view`.
pub fn analyze_document(view: &DocumentView) -> DocumentAnalysis {
    let global_names = names_of(&view.global_vars);
    let mut global_usage = vec![Usage::default(); view.global_vars.len()];
    let mut globals = {
        let names = Names {
            locals: &global_names,
            captures: HashSet::new(),
            globals: None,
            synthesized_form: false,
        };
        let openers = scope_openers(view, None, true);
        let mut builder = ScopeBuilder::new(&view.global_vars, &names, openers, None);
        builder.variables_pass(&mut global_usage);
        builder.finish()
    };
    let matches = view
        .matches
        .iter()
        .map(|entry| analyze_match_into(view, entry, &global_names, &mut global_usage))
        .collect();
    // Accumulated, never assigned: the globals pass already counted the
    // references globals make to each other (the 4-7 review's third finding).
    for (declaration, usage) in globals.declarations.iter_mut().zip(global_usage) {
        declaration.usage.body += usage.body;
        declaration.usage.parameters += usage.parameters;
        declaration.usage.depends_on += usage.depends_on;
        declaration.usage.unverified_layout += usage.unverified_layout;
    }
    DocumentAnalysis { globals, matches }
} // End of function analyze_document()

/// Analyses one match of `view`. Usage of globals is not accumulated.
pub fn analyze_match(view: &DocumentView, entry: &MatchView) -> MatchAnalysis {
    let global_names = names_of(&view.global_vars);
    let mut discarded = vec![Usage::default(); view.global_vars.len()];
    analyze_match_into(view, entry, &global_names, &mut discarded)
}

/// [`analyze_match`], adding every reference to a global into `global_usage`.
fn analyze_match_into(
    view: &DocumentView,
    entry: &MatchView,
    global_names: &HashMap<&str, Vec<usize>>,
    global_usage: &mut [Usage],
) -> MatchAnalysis {
    let captures = regex_capture_names(entry).ok();
    let local_names = names_of(&entry.vars);
    let body = rendered_content(entry);
    let synthesized_form = entry.content.form.is_some() && body.is_empty();
    let names = Names {
        locals: &local_names,
        captures: captures
            .iter()
            .flatten()
            .map(String::as_str)
            .collect::<HashSet<&str>>(),
        globals: Some(global_names),
        synthesized_form,
    };
    let openers = scope_openers(view, Some(entry), captures.is_some());
    let shorthand_form = entry
        .content
        .form
        .as_ref()
        .map(|layout| form_layout(layout, entry.form_fields.iter()));
    let mut builder = ScopeBuilder::new(&entry.vars, &names, openers, shorthand_form.as_ref());
    builder.variables_pass(global_usage);
    for (_, scalar) in body {
        for token in scan_references(&scalar.text) {
            builder.reference(&token, scalar, Site::Body, global_usage);
        }
    } // End of the loop over the rendered content fields
    let mut unverified_layout_references = Vec::new();
    if let Some(layout) = &entry.content.form {
        for token in scan_references(&layout.text) {
            builder.reference(&token, layout, Site::UnverifiedLayout, global_usage);
            unverified_layout_references.push(token);
        }
    } // End of the shorthand layout's unverified references
    MatchAnalysis {
        path: entry.path.clone(),
        scope: builder.finish(),
        captures: captures.unwrap_or_default(),
        shorthand_form,
        unverified_layout_references,
    }
} // End of function analyze_match_into()

/// Why the set of names visible to `entry` (or, with `None`, to
/// `global_vars`) is open, in a fixed order.
///
/// **Shared with the validator's rule 5**, which declares a scope closed
/// exactly when this answers nothing and the captures are known — so the
/// analysis cannot come to call a scope closed that rule 5 calls open.
pub(crate) fn scope_openers(
    view: &DocumentView,
    entry: Option<&MatchView>,
    captures_known: bool,
) -> Vec<IncompleteReason> {
    let mut reasons = Vec::new();
    if !view.imports.is_empty() || unknown_key(&view.unknown_entries, "imports") {
        reasons.push(IncompleteReason::ImportsOpenScope {});
    }
    if unknown_key(&view.unknown_entries, "global_vars") {
        reasons.push(IncompleteReason::GlobalVarsUnreadable {});
    }
    // A declaration whose `name` was written but not read may carry any name,
    // so it opens its scope exactly as an unreadable container does (the 4-7
    // review's second finding).
    for declaration in unreadable_names(&view.global_vars) {
        reasons.push(IncompleteReason::GlobalNameUnreadable { declaration });
    }
    if let Some(entry) = entry {
        if unknown_key(&entry.unknown_entries, "vars") {
            reasons.push(IncompleteReason::LocalVarsUnreadable {});
        }
        for declaration in unreadable_names(&entry.vars) {
            reasons.push(IncompleteReason::LocalNameUnreadable { declaration });
        }
    }
    if !captures_known {
        reasons.push(IncompleteReason::RegexCapturesUnknown {});
    }
    reasons
} // End of function scope_openers()

/// The positions of every declaration whose `name` is written but was not
/// read: recorded as an unknown entry (an alias, a collection), or a scalar
/// this crate could not decode. A declaration with no `name` key at all
/// declares nothing and is not one of them.
fn unreadable_names(variables: &[VariableView]) -> Vec<usize> {
    variables
        .iter()
        .enumerate()
        .filter(|(_, variable)| {
            unknown_key(&variable.unknown_entries, "name")
                || variable.name.as_ref().is_some_and(|name| !name.decoded)
        })
        .map(|(index, _)| index)
        .collect()
}

/// Whether `entries` holds an unknown entry under `key`.
fn unknown_key(entries: &[crate::model::UnknownEntry], key: &str) -> bool {
    entries
        .iter()
        .any(|entry| entry.key.as_deref() == Some(key))
}

/// Every name of a sequence, with the positions carrying it.
fn names_of(variables: &[VariableView]) -> HashMap<&str, Vec<usize>> {
    let mut names: HashMap<&str, Vec<usize>> = HashMap::new();
    for (index, variable) in variables.iter().enumerate() {
        if let Some(name) = &variable.name {
            names.entry(name.text.as_str()).or_default().push(index);
        }
    }
    names
}

/// Whether a declaration's parameters take references — the validator's
/// predicate for the true side, and the three recognised false spellings for
/// the other.
fn injection_of(variable: &VariableView) -> Injection {
    // Written but not projected (an alias, a collection): the validator's
    // predicate reads that as absent and therefore enabled, which is a claim
    // about text this crate never read (the 4-7 review's first finding).
    if unknown_key(&variable.unknown_entries, "inject_vars") {
        return Injection::Uncertain;
    }
    if injection_is_certainly_enabled(variable) {
        return Injection::Enabled;
    }
    let text = variable
        .inject_vars
        .as_ref()
        .map(|written| written.text.trim())
        .unwrap_or_default();
    if ["false", "no", "off"]
        .iter()
        .any(|spelling| text.eq_ignore_ascii_case(spelling))
    {
        Injection::Disabled
    } else {
        Injection::Uncertain
    }
} // End of function injection_of()

/// A layout scalar parsed, with the definitions among `fields` it does not
/// mention.
fn form_layout<'a>(
    layout: &ScalarView,
    fields: impl Iterator<Item = &'a FieldView>,
) -> FormLayoutAnalysis {
    let text = layout.text.clone();
    let layout = PlaceholderLayout::parse(&text);
    let definitions_without_occurrence = fields
        .filter_map(|field| field.key.as_ref())
        .map(|key| key.text.clone())
        .filter(|key| !layout.contains(key))
        .collect();
    FormLayoutAnalysis {
        text,
        layout,
        definitions_without_occurrence,
    }
} // End of function form_layout()

/// A `type: form` variable's layout, when `params.layout` is a scalar.
fn variable_form_layout(variable: &VariableView) -> Option<FormLayoutAnalysis> {
    if variable.kind != VariableKind::Form {
        return None;
    }
    let param = |key: &str| {
        variable
            .params
            .iter()
            .find(|field| field.key.as_ref().is_some_and(|k| k.text == key))
    };
    let ValueView::Scalar(layout) = &param("layout")?.value else {
        return None;
    };
    let fields: &[FieldView] = match param("fields").map(|field| &field.value) {
        Some(ValueView::Mapping(fields)) => fields,
        _ => &[],
    };
    Some(form_layout(layout, fields.iter()))
} // End of function variable_form_layout()

/// The names a reference may resolve to, from one sequence's point of view.
struct Names<'a> {
    /// The sequence's own names.
    locals: &'a HashMap<&'a str, Vec<usize>>,
    /// The match's regex captures.
    captures: HashSet<&'a str>,
    /// The document's global names, for a match scope.
    globals: Option<&'a HashMap<&'a str, Vec<usize>>>,
    /// Whether a shorthand `form:` synthesises [`SYNTHESIZED_FORM_NAME`].
    synthesized_form: bool,
}

/// What a name resolved to.
enum Resolution {
    /// Exactly one declaration of this sequence.
    Local(usize),
    /// Several declarations of this sequence.
    Ambiguous,
    /// A regex capture.
    Capture,
    /// A global — its position when exactly one global carries the name.
    Global(Option<usize>),
    /// The synthesised shorthand form.
    SynthesizedForm,
    /// Nothing visible.
    Unresolved,
}

impl Names<'_> {
    /// Resolves `name`: locals first, then captures, then globals, then the
    /// synthesised form.
    fn resolve(&self, name: &str) -> Resolution {
        if let Some(positions) = self.locals.get(name) {
            return match positions.as_slice() {
                [only] => Resolution::Local(*only),
                _ => Resolution::Ambiguous,
            };
        }
        if self.captures.contains(name) {
            return Resolution::Capture;
        }
        if let Some(positions) = self.globals.and_then(|globals| globals.get(name)) {
            return Resolution::Global(match positions.as_slice() {
                [only] => Some(*only),
                _ => None,
            });
        }
        if self.synthesized_form && name == SYNTHESIZED_FORM_NAME {
            return Resolution::SynthesizedForm;
        }
        Resolution::Unresolved
    } // End of function resolve()
}

/// Where a reference was read.
#[derive(Clone, Copy)]
enum Site {
    /// Rendered content.
    Body,
    /// A parameter value of this consumer.
    Parameter(usize),
    /// A shorthand `form:` layout.
    UnverifiedLayout,
}

/// Accumulates one [`ScopeAnalysis`].
struct ScopeBuilder<'a> {
    /// The sequence.
    variables: &'a [VariableView],
    /// Name resolution.
    names: &'a Names<'a>,
    /// The shorthand layout, for `form1.field`.
    shorthand: Option<&'a FormLayoutAnalysis>,
    /// The analysis so far.
    analysis: ScopeAnalysis,
}

impl<'a> ScopeBuilder<'a> {
    /// Starts an analysis whose scope is open for each of `openers`.
    fn new(
        variables: &'a [VariableView],
        names: &'a Names<'a>,
        openers: Vec<IncompleteReason>,
        shorthand: Option<&'a FormLayoutAnalysis>,
    ) -> ScopeBuilder<'a> {
        let scope_closed = openers.is_empty();
        let declarations = variables
            .iter()
            .enumerate()
            .map(|(index, variable)| Declaration {
                index,
                name: variable.name.as_ref().map(|name| name.text.clone()),
                kind: variable.kind,
                injection: injection_of(variable),
                usage: Usage::default(),
                layout: variable_form_layout(variable),
            })
            .collect();
        let mut builder = ScopeBuilder {
            variables,
            names,
            shorthand,
            analysis: ScopeAnalysis {
                declarations,
                incomplete: openers,
                scope_closed,
                ..ScopeAnalysis::default()
            },
        };
        builder.declaration_reasons();
        builder
    } // End of function new()

    /// Records unreadable and duplicated names, in authored order.
    fn declaration_reasons(&mut self) {
        for (index, variable) in self.variables.iter().enumerate() {
            match &variable.name {
                Some(name) if name.decoded => {
                    let positions = &self.names.locals[name.text.as_str()];
                    if positions.len() > 1 && positions[0] == index {
                        self.note(IncompleteReason::DuplicateDeclaration {
                            declarations: positions.clone(),
                        });
                    }
                }
                _ => self.note(IncompleteReason::NameUnreadable { declaration: index }),
            }
        } // End of the loop over the declarations
    } // End of function declaration_reasons()

    /// Records a reason once.
    fn note(&mut self, reason: IncompleteReason) {
        if !self.analysis.incomplete.contains(&reason) {
            self.analysis.incomplete.push(reason);
        }
    }

    /// Reads every declaration's `depends_on` and injected parameters.
    fn variables_pass(&mut self, global_usage: &mut [Usage]) {
        for (index, variable) in self.variables.iter().enumerate() {
            self.explicit_dependencies(index, variable, global_usage);
            match self.analysis.declarations[index].injection {
                Injection::Enabled => {
                    if !params_are_readable(variable) {
                        self.note(IncompleteReason::ParamsUnreadable { declaration: index });
                    }
                    for field in &variable.params {
                        self.parameter_value(index, &field.value, global_usage);
                    }
                }
                Injection::Uncertain => {
                    self.note(IncompleteReason::InjectionUncertain { declaration: index })
                }
                Injection::Disabled => {}
            }
        } // End of the loop over the declarations
    } // End of function variables_pass()

    /// One declaration's `depends_on` entries.
    fn explicit_dependencies(
        &mut self,
        consumer: usize,
        variable: &VariableView,
        global_usage: &mut [Usage],
    ) {
        if matches!(
            variable.depends_on_presence,
            SequencePresence::UnsupportedShape { .. }
        ) {
            self.note(IncompleteReason::DependsOnUnreadable {
                declaration: consumer,
            });
        }
        for (entry, value) in variable.depends_on.iter().enumerate() {
            let ValueView::Scalar(scalar) = value else {
                self.note(IncompleteReason::DependsOnUnreadable {
                    declaration: consumer,
                });
                continue;
            };
            match self.names.resolve(&scalar.text) {
                Resolution::Local(dependency) => {
                    self.analysis.declarations[dependency].usage.depends_on += 1;
                    self.analysis.edges.push(DependencyEdge {
                        consumer,
                        dependency,
                        kind: EdgeKind::Explicit,
                        span: scalar.span,
                    });
                }
                Resolution::Global(Some(global)) => {
                    if let Some(usage) = global_usage.get_mut(global) {
                        usage.depends_on += 1;
                    }
                }
                Resolution::Unresolved if self.analysis.scope_closed => {
                    self.analysis.missing_dependencies.push(MissingDependency {
                        consumer,
                        entry,
                        name: scalar.text.clone(),
                        span: scalar.span,
                        node: scalar.node,
                    });
                }
                _ => {}
            }
        } // End of the loop over the depends_on entries
    } // End of function explicit_dependencies()

    /// Walks one parameter value by value, never by key.
    fn parameter_value(&mut self, consumer: usize, value: &ValueView, global_usage: &mut [Usage]) {
        match value {
            ValueView::Scalar(scalar) => {
                for token in scan_references(&scalar.text) {
                    self.reference(&token, scalar, Site::Parameter(consumer), global_usage);
                }
            }
            ValueView::Sequence(items) => {
                for item in items {
                    self.parameter_value(consumer, item, global_usage);
                }
            }
            ValueView::Mapping(fields) => {
                for field in fields {
                    self.parameter_value(consumer, &field.value, global_usage);
                }
            }
            ValueView::Alias(_) | ValueView::Elided { .. } => {
                self.note(IncompleteReason::ParamsUnreadable {
                    declaration: consumer,
                });
            }
        }
    } // End of function parameter_value()

    /// One `{{reference}}` read at `site` inside `scalar`.
    fn reference(
        &mut self,
        token: &ReferenceToken,
        scalar: &ScalarView,
        site: Site,
        global_usage: &mut [Usage],
    ) {
        let resolution = self.names.resolve(&token.name);
        match (&resolution, site) {
            (Resolution::Local(dependency), _) => {
                let usage = &mut self.analysis.declarations[*dependency].usage;
                match site {
                    Site::Body => usage.body += 1,
                    Site::UnverifiedLayout => usage.unverified_layout += 1,
                    Site::Parameter(consumer) => {
                        usage.parameters += 1;
                        self.analysis.edges.push(DependencyEdge {
                            consumer,
                            dependency: *dependency,
                            kind: EdgeKind::Inferred,
                            span: scalar.span,
                        });
                    }
                }
            } // End of the local arm
            (Resolution::Global(Some(global)), _) => {
                if let Some(usage) = global_usage.get_mut(*global) {
                    match site {
                        Site::Body => usage.body += 1,
                        Site::UnverifiedLayout => usage.unverified_layout += 1,
                        Site::Parameter(_) => usage.parameters += 1,
                    }
                }
            }
            _ => {}
        }
        // A sub-reference is analysed only from a verified site: the shorthand
        // layout's own `{{…}}` are unverified, and they make no claim.
        if let (Some(field), Site::Body | Site::Parameter(_)) = (&token.subname, site) {
            self.sub_reference(&resolution, field, token, scalar);
        }
    } // End of function reference()

    /// A `{{form.field}}` checked against the form's supported layout.
    fn sub_reference(
        &mut self,
        resolution: &Resolution,
        field: &str,
        token: &ReferenceToken,
        scalar: &ScalarView,
    ) {
        let (form, layout) = match resolution {
            Resolution::Local(position)
                if self.analysis.declarations[*position].kind == VariableKind::Form =>
            {
                (
                    FormSource::Variable { index: *position },
                    self.analysis.declarations[*position].layout.as_ref(),
                )
            }
            Resolution::SynthesizedForm => (FormSource::Shorthand {}, self.shorthand),
            _ => return,
        };
        let Some(layout) = layout else {
            self.note(IncompleteReason::LayoutUnavailable { form });
            return;
        };
        if !layout.layout.is_fully_supported() {
            self.note(IncompleteReason::LayoutUnsupported { form });
            return;
        }
        if !layout.layout.contains(field) {
            self.analysis
                .form_advisories
                .push(FormSubReferenceAdvisory {
                    scalar: scalar.span,
                    token: token.span,
                    form,
                    field: field.to_owned(),
                });
        }
    } // End of function sub_reference()

    /// The cycles and order advisories, from the edges read.
    fn finish(mut self) -> ScopeAnalysis {
        let count = self.analysis.declarations.len();
        let mut adjacency: Vec<Vec<usize>> = vec![Vec::new(); count];
        for edge in &self.analysis.edges {
            if !adjacency[edge.consumer].contains(&edge.dependency) {
                adjacency[edge.consumer].push(edge.dependency);
            }
        }
        let mut cycles: Vec<DependencyCycle> = strongly_connected(&adjacency)
            .into_iter()
            .filter(|members| members.len() > 1 || adjacency[members[0]].contains(&members[0]))
            .map(|members| {
                let inside = |kind: EdgeKind| {
                    self.analysis.edges.iter().any(|edge| {
                        edge.kind == kind
                            && members.contains(&edge.consumer)
                            && members.contains(&edge.dependency)
                    })
                };
                let explicit = inside(EdgeKind::Explicit);
                let inferred = inside(EdgeKind::Inferred);
                DependencyCycle {
                    members,
                    explicit,
                    inferred,
                }
            })
            .collect();
        cycles.sort_by_key(|cycle| cycle.members[0]);
        self.analysis.cycles = cycles;
        let mut advisories: Vec<OrderAdvisory> = Vec::new();
        for edge in &self.analysis.edges {
            let advisory = OrderAdvisory {
                consumer: edge.consumer,
                dependency: edge.dependency,
            };
            if edge.consumer < edge.dependency && !advisories.contains(&advisory) {
                advisories.push(advisory);
            }
        }
        self.analysis.order_advisories = advisories;
        self.analysis
    } // End of function finish()
} // End of impl ScopeBuilder

/// The strongly connected components of a graph, each sorted ascending.
///
/// Tarjan's algorithm with an explicit work stack rather than recursion: a
/// document is allowed to be adversarial, and a sequence of thousands of
/// variables must not exhaust the thread's stack.
fn strongly_connected(adjacency: &[Vec<usize>]) -> Vec<Vec<usize>> {
    const UNVISITED: usize = usize::MAX;
    let count = adjacency.len();
    let mut order = vec![UNVISITED; count];
    let mut low = vec![0; count];
    let mut on_stack = vec![false; count];
    let mut stack: Vec<usize> = Vec::new();
    let mut next = 0;
    let mut components = Vec::new();
    for root in 0..count {
        if order[root] != UNVISITED {
            continue;
        }
        order[root] = next;
        low[root] = next;
        next += 1;
        stack.push(root);
        on_stack[root] = true;
        let mut work: Vec<(usize, usize)> = vec![(root, 0)];
        while let Some(top) = work.len().checked_sub(1) {
            let (vertex, child) = work[top];
            if let Some(&target) = adjacency[vertex].get(child) {
                work[top].1 += 1;
                if order[target] == UNVISITED {
                    order[target] = next;
                    low[target] = next;
                    next += 1;
                    stack.push(target);
                    on_stack[target] = true;
                    work.push((target, 0));
                } else if on_stack[target] {
                    low[vertex] = low[vertex].min(order[target]);
                }
                continue;
            }
            work.pop();
            if let Some(&(parent, _)) = work.last() {
                low[parent] = low[parent].min(low[vertex]);
            }
            if low[vertex] == order[vertex] {
                let mut component = Vec::new();
                while let Some(member) = stack.pop() {
                    on_stack[member] = false;
                    component.push(member);
                    if member == vertex {
                        break;
                    }
                }
                component.sort_unstable();
                components.push(component);
            }
        } // End of the depth-first walk from this root
    } // End of the loop over the roots
    components
} // End of function strongly_connected()

#[cfg(test)]
mod tests {
    use super::strongly_connected;

    /// Two cycles, a chain and a self-loop are told apart.
    #[test]
    fn components_are_found_without_recursion() {
        let adjacency = vec![vec![1], vec![0], vec![3], vec![], vec![4]];
        let mut components = strongly_connected(&adjacency);
        components.sort();
        assert_eq!(components, vec![vec![0, 1], vec![2], vec![3], vec![4]]);
    }

    /// A long chain closed into one ring is one component, and the walk does
    /// not recurse.
    #[test]
    fn a_long_ring_is_one_component() {
        let count = 50_000;
        let adjacency: Vec<Vec<usize>> = (0..count).map(|i| vec![(i + 1) % count]).collect();
        let components = strongly_connected(&adjacency);
        assert_eq!(components.len(), 1);
        assert_eq!(components[0].len(), count);
    }
}
