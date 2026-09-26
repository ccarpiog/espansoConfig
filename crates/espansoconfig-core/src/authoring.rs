//! Revision-bound authoring snapshots and candidate analysis (Phase 4-8).
//!
//! # What this module is for
//!
//! The variable and form editors that later steps build (4-9 onwards) need two
//! things from Rust that no earlier command hands out:
//!
//! - an **authoring snapshot** of one match: the exact source text of its
//!   whole `vars` container and of its whole `form_fields` container, cut in
//!   Rust, each with a content fingerprint, plus a summary of the match's
//!   placeholder, reference and dependency analysis
//!   ([`crate::analysis`]). Ruling 22 of `docs/decisions/4-split-notes.md`
//!   keys variable reapply on the **whole container**: the snapshot is the
//!   baseline a draft is compared against when the file moves on;
//! - a **candidate analysis**: what one drafted operation would produce — the
//!   candidate revision, the save gate's findings and verdict over it (the
//!   same findings pass [`crate::persist::save_document`] runs, through
//!   [`crate::persist::preflight_candidate`]), and the analysis summary of the
//!   match in that candidate.
//!
//! # Bound to one revision, and never trusted back
//!
//! A snapshot is cut for one [`MatchId`], which carries the revision it was
//! minted from; the caller resolves that identity against the parse it holds,
//! so a stale identity is refused before anything is cut (`PROGRESS.md` D2v).
//! **Nothing in this module accepts a snapshot, a span or a fingerprint back.**
//! Every value here is `Serialize`-only: a later save names its target by
//! identity and base revision and the engine re-derives every byte range from
//! the parse (`PROGRESS.md` R28). The one inbound type,
//! [`CandidateOperation`], carries a draft or a variable position, never a
//! byte offset.
//!
//! # Rust-cut and span-free
//!
//! The analysis types carry byte spans into the document or into a layout's
//! decoded text. A JavaScript string is indexed in UTF-16 code units, so none
//! of those spans may cross (`CLAUDE.md` section 6). The summaries below keep
//! positions (indices in a sequence) and **cut** every piece of text a caller
//! needs here, in Rust.
//!
//! # What this module does not decide
//!
//! It performs no I/O, takes no lock and writes nothing: a candidate analysis
//! is a prediction about one text the caller already holds, and the save that
//! follows re-reads the file under its own lock. It says nothing about how
//! espanso evaluates anything (R16, R30).

use serde::{Deserialize, Serialize};

use crate::analysis::{
    analyze_match, DependencyCycle, EdgeKind, FormLayoutAnalysis, FormSource, IncompleteReason,
    Injection, LayoutSegment, MalformedPlaceholder, MatchAnalysis, OrderAdvisory, Usage,
};
use crate::draft::{plan_match_edits, plan_variable_move, DraftError, ListPlacement, MatchDraft};
use crate::model::{
    DocumentContext, DocumentView, FieldLocation, MatchId, MatchView, VariableKind,
};
use crate::patch::DocumentEdit;
use crate::persist::{
    preflight_candidate, Acknowledgement, CandidatePreflight, SaveError, SaveVerdict,
};
use crate::validate::Finding;
use crate::workspace::project_source;
use crate::{ContentRevision, SourceDocument};

/// One match's authoring baseline, cut from one revision.
///
/// See the module documentation. Every text in it is a slice of the file (or
/// of a decoded layout) taken in Rust.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AuthoringSnapshot {
    /// The match, in the revision this snapshot was cut from. Its `revision`
    /// is the one every baseline below describes.
    pub id: MatchId,
    /// The whole local `vars` container.
    pub vars: ContainerBaseline,
    /// The whole shorthand `form_fields` container.
    pub form_fields: ContainerBaseline,
    /// The match's analysis, summarised for the wire.
    pub analysis: AnalysisSummary,
}

/// What one whole container of a match held — the correspondence unit of
/// ruling 22.
///
/// Struct variants, so the enum crosses as a uniform one-key object.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ContainerBaseline {
    /// The match holds no such key.
    Absent {},
    /// The key is written, and its value's bytes are these.
    Present {
        /// The value's exact source text: from its first byte to its last,
        /// as the projection's value span names them — for a block sequence
        /// the hull of its items, for a flow collection its brackets. Line
        /// endings, comments inside the hull and every spelling survive; the
        /// key itself and trailing comments after the hull are not part of it.
        text: String,
        /// The hash of `text`, in the same encoding as a content revision.
        fingerprint: ContentRevision,
    },
    /// The key is written, and its value's bytes could not be cut from the
    /// source the projection was made from. A projection invariant was broken;
    /// the variant exists so that a broken invariant is **reported** rather
    /// than turned into an empty baseline that would compare equal to the
    /// wrong thing. A caller treats it as a container that corresponds to
    /// nothing.
    Uncut {},
}

impl ContainerBaseline {
    /// The baseline of the entry `location` names in `source`, or
    /// [`ContainerBaseline::Absent`] when there is no entry.
    fn cut(source: &str, location: Option<&FieldLocation>) -> ContainerBaseline {
        let Some(location) = location else {
            return ContainerBaseline::Absent {};
        };
        let span = location.value_span;
        match source.get(span.start..span.end) {
            Some(text) => ContainerBaseline::Present {
                text: text.to_owned(),
                fingerprint: ContentRevision::of_bytes(text.as_bytes()),
            },
            None => ContainerBaseline::Uncut {},
        }
    } // End of function cut()
} // End of impl ContainerBaseline

/// A match's placeholder, reference and dependency analysis, without a byte
/// span anywhere in it.
///
/// Mirrors [`MatchAnalysis`] and its [`crate::analysis::ScopeAnalysis`]
/// field by field, except that a span is either dropped (the position beside
/// it says the same thing) or replaced by the text it covers, cut here.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AnalysisSummary {
    /// Every local declaration, in authored order.
    pub declarations: Vec<DeclarationSummary>,
    /// Every edge between two local declarations, in the order read.
    pub edges: Vec<EdgeSummary>,
    /// Every cycle, ordered by first member.
    pub cycles: Vec<DependencyCycle>,
    /// Explicit `depends_on` entries naming nothing visible — always empty when
    /// `scope_closed` is false.
    pub missing_dependencies: Vec<MissingDependencySummary>,
    /// Consumers authored before a dependency (ruling 11): advisory only.
    pub order_advisories: Vec<OrderAdvisory>,
    /// `{{form.field}}` sub-references whose field is not found in the
    /// supported layout syntax.
    pub form_advisories: Vec<FormAdvisorySummary>,
    /// Why parts of the answer are uncertain; empty only for a complete one.
    pub incomplete: Vec<IncompleteReason>,
    /// Whether the set of visible names is closed.
    pub scope_closed: bool,
    /// The `regex` trigger's named captures, in pattern order.
    pub captures: Vec<String>,
    /// The shorthand `form:` layout, when the match has one.
    pub shorthand_form: Option<LayoutSummary>,
    /// The `{{…}}` occurrences in that layout — **unverified**: the loader
    /// rewrites a shorthand layout, so they are never claimed to resolve.
    pub unverified_layout_references: Vec<ReferenceSummary>,
}

/// One local declaration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DeclarationSummary {
    /// Its position in `vars`.
    pub index: usize,
    /// Its `name` text, when it has one this crate could read.
    pub name: Option<String>,
    /// Its type.
    pub kind: VariableKind,
    /// Whether its parameters take references.
    pub injection: Injection,
    /// How often it is referenced, by where.
    pub usage: Usage,
    /// Its layout, when it is a `type: form` whose `params.layout` is a scalar.
    pub layout: Option<LayoutSummary>,
}

/// A consumer depending on a declaration of the same sequence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct EdgeSummary {
    /// The consumer's position.
    pub consumer: usize,
    /// The dependency's position.
    pub dependency: usize,
    /// How the edge was learnt.
    pub kind: EdgeKind,
}

/// A `depends_on` entry naming nothing visible, under a closed scope. By
/// position only: the name is what the projection already shows at that
/// position.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct MissingDependencySummary {
    /// The consumer's position in `vars`.
    pub consumer: usize,
    /// The entry's position inside its `depends_on`.
    pub entry: usize,
}

/// A `{{form.field}}` whose field is not found in the supported layout syntax
/// — never "espanso will reject this field".
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FormAdvisorySummary {
    /// The form the name resolved to.
    pub form: FormSource,
    /// The field name after the dot, as the reference writes it.
    pub field: String,
}

/// A form layout, parsed into the named supported placeholder subset and cut
/// into its pieces.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LayoutSummary {
    /// The layout's pieces in text order. Concatenating each piece's text —
    /// `[[name]]` for a placeholder — reproduces the decoded layout exactly.
    pub pieces: Vec<LayoutPiece>,
    /// Whether no malformed region exists.
    pub fully_supported: bool,
    /// Every definition key with no supported placeholder of its name, in
    /// definition order. Advisory: a definition is never deleted.
    pub definitions_without_occurrence: Vec<String>,
}

/// One piece of a layout. Struct variants, so it crosses as a uniform object.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum LayoutPiece {
    /// Text that is not a placeholder and does not open one.
    Text {
        /// The text.
        text: String,
    },
    /// A supported `[[identifier]]` placeholder.
    Placeholder {
        /// The identifier between the brackets.
        name: String,
    },
    /// A region that opens with `[[` and is not a supported placeholder.
    Malformed {
        /// The region's text.
        text: String,
        /// Why it is not a supported placeholder.
        reason: MalformedPlaceholder,
    },
    /// A segment whose bytes could not be cut from the layout text — a parser
    /// invariant broken, never a property of any text. Reported rather than
    /// dropped, so a summary never reproduces less than the layout silently.
    Uncut {},
}

/// One `{{reference}}` of a shorthand layout.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ReferenceSummary {
    /// The referenced name.
    pub name: String,
    /// The `.subname` after it, when present.
    pub subname: Option<String>,
}

/// One operation a candidate analysis is asked about.
///
/// **Inbound**, and the only inbound type of this module: it carries a whole
/// [`MatchDraft`] (whose addresses are indices into the projection, never
/// offsets) or a variable position and a [`ListPlacement`]. No arm carries a
/// byte span, so nothing here can be trusted as one (R28). Struct variants and
/// `deny_unknown_fields`, as every inbound wire enum here is.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum CandidateOperation {
    /// A drafted save of the match, exactly as `save_match` takes it.
    Draft {
        /// What the match should say. Boxed because it is by far the larger
        /// variant; `serde` reads it exactly as an unboxed draft.
        draft: Box<MatchDraft>,
    },
    /// A same-sequence reorder of one local variable (R25, D2r), exactly as
    /// `move_variable` takes it.
    VariableMove {
        /// The variable's position in `vars`.
        variable: usize,
        /// Where it goes, in the original list.
        to: ListPlacement,
    },
}

impl CandidateOperation {
    /// The batch this operation derives against `found`, by the same planner
    /// the writing command uses — [`plan_match_edits`] or
    /// [`plan_variable_move`] — so an analysis and a save cannot plan one
    /// operation differently.
    ///
    /// # Errors
    ///
    /// The planner's own [`DraftError`].
    pub fn plan(&self, found: &MatchView) -> Result<Vec<DocumentEdit>, DraftError> {
        match self {
            CandidateOperation::Draft { draft } => plan_match_edits(found, draft),
            CandidateOperation::VariableMove { variable, to } => {
                plan_variable_move(found, *variable, *to)
            }
        }
    } // End of function plan()
} // End of impl CandidateOperation

/// What one drafted operation would produce, judged and analysed.
///
/// **What consent is bound to, exactly.** An [`Acknowledgement`] is a multiset
/// of findings matched by equality — code with its operands, span, node and
/// path — and nothing else. Five codes carry the candidate's own revision as
/// an operand (`DocumentDoesNotParse`, `DuplicateKeepsTriggerDefinition`,
/// `NewMatchRepeatsLiteralTrigger`, `VariableDependencyCycle`,
/// `DependencyHasNoDeclaration`), so consent for one of those cannot be spent
/// on a different candidate. **Every other finding is not bound to a
/// candidate** — `ReferenceHasNoDeclaration` among them — and consent for it is
/// accepted by any later candidate that produces an equal finding, a different
/// draft included (`consent_for_an_unbound_finding_transfers_between_candidates`
/// in `src-tauri/src/commands/authoring_check.rs` pins that). A caller must
/// therefore discard collected consent whenever the draft changes; nothing in
/// Rust or TypeScript forces it to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MatchCandidate {
    /// The revision the candidate would have. Only the five revision-bound
    /// finding codes (see the type's documentation) carry it; the others are
    /// not tied to this candidate.
    pub candidate: ContentRevision,
    /// Whether the candidate differs from the text it was derived from — the
    /// condition under which a save would commit.
    pub changes: bool,
    /// Every finding the save gate produces for the candidate, in report
    /// order — the same pass a save runs.
    pub findings: Vec<Finding>,
    /// The blocking policy's answer to those findings and the acknowledgement
    /// supplied.
    pub verdict: SaveVerdict,
    /// The match's analysis in the candidate, or `None` when the candidate's
    /// projection holds no match at the match's path (a candidate that does not
    /// parse, for instance).
    pub analysis: Option<AnalysisSummary>,
}

/// Cuts one match's authoring snapshot out of the snapshot it was projected
/// from.
///
/// `found` must be a match of `document.view` — the caller has resolved its
/// identity there, which is where a stale identity is refused.
pub fn authoring_snapshot(document: &SourceDocument, found: &MatchView) -> AuthoringSnapshot {
    AuthoringSnapshot {
        id: found.id,
        vars: ContainerBaseline::cut(&document.source, found.vars_presence.location()),
        form_fields: ContainerBaseline::cut(
            &document.source,
            found.form_fields_presence.location(),
        ),
        analysis: summarize(&document.view, found),
    }
} // End of function authoring_snapshot()

/// Judges and analyses the batch `edits` over `source`, as a save of it would
/// meet it, and summarises `found`'s analysis in the candidate.
///
/// **No lock, no read, no write, no backup** — see
/// [`crate::persist::preflight_candidate`]. The candidate is projected with
/// [`project_source`], the same projection the workspace makes, and the match
/// is looked up at `found`'s own path: an operation this module plans never
/// relocates the match it edits.
///
/// # Errors
///
/// The preflight's own [`SaveError`]: a read-only document, a batch the engine
/// refuses, or a candidate whose reparse contradicts the patch.
pub fn analyze_candidate(
    context: &DocumentContext,
    source: &str,
    found: &MatchView,
    edits: &[DocumentEdit],
    acknowledgement: &Acknowledgement,
) -> Result<MatchCandidate, SaveError> {
    let CandidatePreflight { preflight, text } =
        preflight_candidate(context, source, edits, acknowledgement)?;
    let candidate = project_source(context, &text);
    let analysis = found.path.as_ref().and_then(|path| {
        candidate
            .view
            .matches
            .iter()
            .find(|entry| entry.path.as_ref() == Some(path))
            .map(|entry| summarize(&candidate.view, entry))
    });
    Ok(MatchCandidate {
        candidate: preflight.candidate,
        changes: preflight.changes,
        findings: preflight.findings,
        verdict: preflight.verdict,
        analysis,
    })
} // End of function analyze_candidate()

/// Summarises `entry`'s analysis in `view` for the wire.
pub fn summarize(view: &DocumentView, entry: &MatchView) -> AnalysisSummary {
    let MatchAnalysis {
        path: _,
        scope,
        captures,
        shorthand_form,
        unverified_layout_references,
    } = analyze_match(view, entry);
    let declarations = scope
        .declarations
        .into_iter()
        .map(|declaration| DeclarationSummary {
            index: declaration.index,
            name: declaration.name,
            kind: declaration.kind,
            injection: declaration.injection,
            usage: declaration.usage,
            layout: declaration.layout.as_ref().map(layout_summary),
        })
        .collect();
    AnalysisSummary {
        declarations,
        edges: scope
            .edges
            .iter()
            .map(|edge| EdgeSummary {
                consumer: edge.consumer,
                dependency: edge.dependency,
                kind: edge.kind,
            })
            .collect(),
        cycles: scope.cycles,
        missing_dependencies: scope
            .missing_dependencies
            .iter()
            .map(|missing| MissingDependencySummary {
                consumer: missing.consumer,
                entry: missing.entry,
            })
            .collect(),
        order_advisories: scope.order_advisories,
        form_advisories: scope
            .form_advisories
            .into_iter()
            .map(|advisory| FormAdvisorySummary {
                form: advisory.form,
                field: advisory.field,
            })
            .collect(),
        incomplete: scope.incomplete,
        scope_closed: scope.scope_closed,
        captures,
        shorthand_form: shorthand_form.as_ref().map(layout_summary),
        unverified_layout_references: unverified_layout_references
            .into_iter()
            .map(|token| ReferenceSummary {
                name: token.name,
                subname: token.subname,
            })
            .collect(),
    }
} // End of function summarize()

/// Cuts a parsed layout into its pieces, over the text it was parsed from.
///
/// A segment whose span does not lie on the text's character boundaries — a
/// parser defect, never a property of any text — is reported as
/// [`LayoutPiece::Uncut`] rather than dropped, and the summary then does not
/// claim the layout is fully supported.
fn layout_summary(analysis: &FormLayoutAnalysis) -> LayoutSummary {
    let text = analysis.text.as_str();
    let mut fully_supported = analysis.layout.is_fully_supported();
    let pieces = analysis
        .layout
        .segments
        .iter()
        .map(|segment| {
            let span = segment.span();
            let cut = text.get(span.start..span.end);
            match (segment, cut) {
                (LayoutSegment::Text { .. }, Some(cut)) => LayoutPiece::Text {
                    text: cut.to_owned(),
                },
                (LayoutSegment::Placeholder { name, .. }, Some(_)) => {
                    LayoutPiece::Placeholder { name: name.clone() }
                }
                (LayoutSegment::Malformed { reason, .. }, Some(cut)) => LayoutPiece::Malformed {
                    text: cut.to_owned(),
                    reason: *reason,
                },
                (_, None) => {
                    fully_supported = false;
                    LayoutPiece::Uncut {}
                }
            }
        })
        .collect();
    LayoutSummary {
        pieces,
        fully_supported,
        definitions_without_occurrence: analysis.definitions_without_occurrence.clone(),
    }
} // End of function layout_summary()
