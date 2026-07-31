//! One espanso match, projected for the snippet list and the editor.
//!
//! Every field of plan section 3.3 is modelled, and every one of them that is a
//! scalar is a [`ScalarView`] — source text, never an inferred type (D2u). That
//! includes `word`, `left_word`, `right_word`, `propagate_case`,
//! `force_clipboard` and `paragraph`, which the espanso schema calls booleans:
//! a file may spell one of them `on`, and calling that `true` would be a claim
//! `PROGRESS.md` R16's open half says this project has not earned.
//!
//! # Identity
//!
//! [`MatchId`] is a [`crate::DocumentId`], the [`ContentRevision`] of the bytes
//! that were parsed, and a [`NodeId`] — never a position in the `matches`
//! sequence (plan section 6.2). The sequence position lives in
//! [`MatchView::path`], because the edit engine addresses by path.
//!
//! The revision is there because the node identifier alone is **not** stable
//! across a reparse: it is the parser arena index, so exchanging two equally
//! shaped matches and reparsing hands the second one the first one's former
//! node. Scoping the identity to the parse it was minted from turns that from a
//! silent mis-resolution into [`IdentityError::StaleRevision`] — a stale
//! identity is refused rather than guessed at. Phase 1a deliberately does not
//! attempt a content-derived stable identity; see
//! `docs/decisions/1a-notes.md` section 5.

use std::fmt;

use serde::{Deserialize, Serialize};

use crate::model::project::{child_index, child_path, Projector};
use crate::model::{
    DiagnosticCode, FieldView, MappingScan, ScalarView, UnknownEntry, ValueView, VariableKind,
    VariableView,
};
use crate::patch::DocumentPath;
use crate::syntax::{ByteSpan, HazardKind, NodeId};
use crate::{ContentRevision, DocumentId};

/// Every key [`MatchView`] models. A key outside this list becomes an
/// [`UnknownEntry`]; a repeat of one inside it becomes an [`UnknownEntry`] too,
/// with a different reason.
const MODELLED_KEYS: [&str; 22] = [
    "trigger",
    "triggers",
    "regex",
    "replace",
    "form",
    "markdown",
    "html",
    "image_path",
    "label",
    "comment",
    "search_terms",
    "word",
    "left_word",
    "right_word",
    "propagate_case",
    "uppercase_style",
    "force_mode",
    "force_clipboard",
    "paragraph",
    "form_fields",
    "vars",
    "anchor",
];

/// Session-local identity of one match, scoped to the parse it came from.
///
/// **Not an array index** (plan section 6.2): indexes shift the moment two
/// matches are reordered, and an identity that shifts is not an identity.
///
/// **Nor is a bare node identifier enough.** `NodeId` is the parser arena
/// index, so two equally shaped matches that swap places come back with their
/// nodes swapped too. That is why [`MatchId::revision`] is part of the
/// identity: it names the exact bytes the node was minted from, so an identity
/// held across an edit or an external change is *detectably* stale
/// ([`IdentityError::StaleRevision`]) instead of quietly selecting whatever now
/// occupies that arena slot.
///
/// The consequence is deliberate: after any reparse the UI must re-fetch. That
/// is the honest contract for a read model whose substrate renumbers on every
/// parse, and it is cheaper than a content-derived identity Phase 1 has no use
/// for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct MatchId {
    /// The document the match lives in.
    pub document: DocumentId,
    /// The revision of the bytes this identity was minted from.
    pub revision: ContentRevision,
    /// The mapping node the match is, in that parse's arena.
    pub node: NodeId,
}

/// Why a [`MatchId`] did not resolve to a match.
///
/// Three refusals rather than one `None`, because "you are holding an identity
/// from an older parse" and "this document has no such match" call for
/// different behaviour in the UI: the first is a re-fetch, the second is a
/// stale selection to clear.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum IdentityError {
    /// The identity names a different document from the one it was offered to.
    WrongDocument {
        /// The document that was asked.
        expected: DocumentId,
        /// The document the identity names.
        found: DocumentId,
    },
    /// The identity was minted from another parse of this document. Its node
    /// identifier means nothing here, and is deliberately not resolved.
    StaleRevision {
        /// The revision the projection holds.
        expected: ContentRevision,
        /// The revision the identity was minted from.
        found: ContentRevision,
    },
    /// Document and revision agree, but no match of this projection is that
    /// node — a node that is not a `matches` entry, or one that no longer is.
    NoSuchMatch {
        /// The node the identity names.
        node: NodeId,
    },
}

impl fmt::Display for IdentityError {
    /// A developer rendering, for logs and test output. Never shown to a user.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            IdentityError::WrongDocument { expected, found } => write!(
                formatter,
                "identity names document {} not {}",
                found.get(),
                expected.get()
            ),
            IdentityError::StaleRevision { .. } => formatter.write_str("identity is stale"),
            IdentityError::NoSuchMatch { node } => {
                write!(formatter, "no match at node {}", node.get())
            }
        }
    } // End of function fmt() for IdentityError
}

impl std::error::Error for IdentityError {}

/// Which of the three trigger forms a match uses.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize)]
pub enum TriggerKind {
    /// `trigger:` — one literal abbreviation.
    Single,
    /// `triggers:` — several aliases for one expansion.
    Multiple,
    /// `regex:` — a Rust `regex` pattern with named groups.
    Regex,
    /// More than one of the three is present. Espanso expects exactly one.
    Several,
    /// None of the three is present.
    #[default]
    Absent,
}

/// A match's trigger side.
///
/// All three fields are carried rather than collapsed into one enum payload,
/// because a file holding two of them is a file the projection must not choose
/// between: [`TriggerSpec::kind`] reports the conflict and both values stay
/// visible.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct TriggerSpec {
    /// `trigger`, as source text.
    pub trigger: Option<ScalarView>,
    /// `triggers`, one item per source entry, in source order.
    ///
    /// Every item is a [`ValueView::Scalar`] or a [`ValueView::Elided`]: an
    /// entry espanso's schema says is a string but the file writes as a
    /// collection is elided **in place**, never dropped, so an item's position
    /// in this vector is always its position in the file.
    pub triggers: Vec<ValueView>,
    /// `regex`, as source text.
    pub regex: Option<ScalarView>,
    /// Whether the three fields form a shape espanso accepts.
    pub kind: TriggerKind,
}

impl TriggerSpec {
    /// The trigger text the snippet list shows first.
    ///
    /// The `trigger`, else the first *scalar* of `triggers`, else the `regex`.
    /// `None` when the match has no trigger side at all — which is a
    /// diagnostic, not a reason to hide the row.
    pub fn primary(&self) -> Option<&ScalarView> {
        self.trigger
            .as_ref()
            .or_else(|| self.triggers.iter().find_map(ValueView::as_scalar))
            .or(self.regex.as_ref())
    }

    /// Recomputes [`TriggerSpec::kind`] from which fields are present.
    fn classify(&mut self, present: usize) {
        self.kind = match (present, self.trigger.is_some(), self.regex.is_some()) {
            (0, _, _) => TriggerKind::Absent,
            (1, true, _) => TriggerKind::Single,
            (1, _, true) => TriggerKind::Regex,
            (1, _, _) => TriggerKind::Multiple,
            _ => TriggerKind::Several,
        };
    }
}

/// Which of the five content forms a match uses.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize)]
pub enum ContentKind {
    /// `replace:` — plain text with `{{vars}}` and `$|$`.
    Replace,
    /// `markdown:` — rendered to rich text.
    Markdown,
    /// `html:` — rendered to rich text.
    Html,
    /// `image_path:` — an image, `$CONFIG/…` supported.
    ImagePath,
    /// `form:` — the shorthand form with `[[field]]` placeholders.
    Form,
    /// More than one is present. Espanso expects exactly one.
    Several,
    /// None is present.
    #[default]
    Absent,
}

/// A match's content side.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct ContentSpec {
    /// `replace`, as source text.
    pub replace: Option<ScalarView>,
    /// `markdown`, as source text.
    pub markdown: Option<ScalarView>,
    /// `html`, as source text.
    pub html: Option<ScalarView>,
    /// `image_path`, as source text.
    pub image_path: Option<ScalarView>,
    /// `form`, as source text.
    pub form: Option<ScalarView>,
    /// Whether the five fields form a shape espanso accepts.
    pub kind: ContentKind,
}

impl ContentSpec {
    /// The content the editor shows first, and the search indexes.
    pub fn primary(&self) -> Option<&ScalarView> {
        self.replace
            .as_ref()
            .or(self.markdown.as_ref())
            .or(self.html.as_ref())
            .or(self.form.as_ref())
            .or(self.image_path.as_ref())
    }

    /// Recomputes [`ContentSpec::kind`] from which fields are present.
    fn classify(&mut self, present: usize) {
        self.kind = match present {
            0 => ContentKind::Absent,
            1 => {
                if self.replace.is_some() {
                    ContentKind::Replace
                } else if self.markdown.is_some() {
                    ContentKind::Markdown
                } else if self.html.is_some() {
                    ContentKind::Html
                } else if self.image_path.is_some() {
                    ContentKind::ImagePath
                } else {
                    ContentKind::Form
                }
            }
            _ => ContentKind::Several,
        };
    } // End of function classify()
}

/// The match options of plan section 3.3, every one as source text.
///
/// There is no `bool` here on purpose. See the module documentation.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct MatchOptions {
    /// `word` — require a word boundary on both sides.
    pub word: Option<ScalarView>,
    /// `left_word` — require one on the left.
    pub left_word: Option<ScalarView>,
    /// `right_word` — require one on the right.
    pub right_word: Option<ScalarView>,
    /// `propagate_case` — mirror the trigger's capitalisation.
    pub propagate_case: Option<ScalarView>,
    /// `uppercase_style` — `capitalize`, `capitalize_words` or `uppercase`.
    pub uppercase_style: Option<ScalarView>,
    /// `force_mode` — `clipboard` or `keys`.
    pub force_mode: Option<ScalarView>,
    /// `force_clipboard` — the legacy spelling of `force_mode: clipboard`.
    pub force_clipboard: Option<ScalarView>,
    /// `paragraph` — markdown only.
    pub paragraph: Option<ScalarView>,
    /// `anchor` — plan section 3.3's "other" field.
    pub anchor: Option<ScalarView>,
}

impl MatchOptions {
    /// Appends every scalar these options hold, in declaration order, to `out`.
    pub fn collect_scalars<'a>(&'a self, out: &mut Vec<&'a ScalarView>) {
        out.extend(self.word.iter());
        out.extend(self.left_word.iter());
        out.extend(self.right_word.iter());
        out.extend(self.propagate_case.iter());
        out.extend(self.uppercase_style.iter());
        out.extend(self.force_mode.iter());
        out.extend(self.force_clipboard.iter());
        out.extend(self.paragraph.iter());
        out.extend(self.anchor.iter());
    } // End of function collect_scalars()
}

/// A marker the snippet list shows next to a match (plan section 8.1).
///
/// **Every badge is derived from a key's presence or from a `type` field's
/// text, never from a scalar's value.** A badge reading "word boundary ON"
/// would have to decide that `word: on` is true, which is precisely the claim
/// D2u forbids — so no such badge exists. `⌗shell` is safe because it comes
/// from `type: shell`, a string comparison against espanso's vocabulary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize)]
pub enum MatchBadge {
    /// The match triggers on a regular expression.
    Regex,
    /// The match has several triggers.
    MultipleTriggers,
    /// The match uses a form — the shorthand `form` field or a `type: form`
    /// variable.
    Form,
    /// The content is `html`.
    Html,
    /// The content is `markdown`.
    Markdown,
    /// The content is an image.
    Image,
    /// The match declares variables.
    Variables,
    /// A variable of the match runs a shell command.
    Shell,
    /// A variable of the match runs a script.
    Script,
    /// The hazard gate refuses to edit this match visually.
    NotEditable,
}

/// One espanso match.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MatchView {
    /// Session-local identity: document plus source node, never a position.
    pub id: MatchId,
    /// The mapping node the match is.
    pub source_node: NodeId,
    /// The path that addresses it, for the edit engine.
    ///
    /// `None` only when the containing document has no path — which cannot
    /// happen for a match reached through `matches`, and is carried as an
    /// `Option` so that no future caller has to invent one.
    pub path: Option<DocumentPath>,
    /// The match's byte span.
    pub span: ByteSpan,
    /// The trigger side.
    pub trigger: TriggerSpec,
    /// The content side.
    pub content: ContentSpec,
    /// `label`, as source text.
    pub label: Option<ScalarView>,
    /// `comment`, as source text.
    pub comment: Option<ScalarView>,
    /// `search_terms`, one item per source entry, in source order.
    ///
    /// Same rule as [`TriggerSpec::triggers`]: a non-scalar entry is elided in
    /// place rather than dropped, so positions never shift.
    pub search_terms: Vec<ValueView>,
    /// The word-boundary, case and injection options.
    pub options: MatchOptions,
    /// `vars`.
    pub vars: Vec<VariableView>,
    /// `form_fields`, projected shallowly and completely: its keys are the form
    /// author's field names, which no schema fixes.
    pub form_fields: Vec<FieldView>,
    /// The markers the snippet list shows, sorted and deduplicated.
    pub badges: Vec<MatchBadge>,
    /// The hazard that makes this match un-editable, or `None`.
    pub blocking_hazard: Option<HazardKind>,
    /// Whether the visual editor may edit this match.
    pub safely_editable: bool,
    /// Entries this projection did not model, never discarded.
    pub unknown_entries: Vec<UnknownEntry>,
    /// The text a search covers: trigger, label, content, comment and
    /// `search_terms` (plan section 8.1).
    ///
    /// Precomputed here rather than assembled per keystroke in the frontend, so
    /// that what the search covers is one fact stated once and testable.
    pub search_text: String,
}

impl MatchView {
    /// Projects one item of a `matches` sequence.
    ///
    /// An item that is not a mapping still yields a view, so the list the UI
    /// renders always has one row per source entry.
    pub(crate) fn project(
        projector: &mut Projector<'_>,
        document: DocumentId,
        revision: ContentRevision,
        node: NodeId,
        path: Option<DocumentPath>,
    ) -> MatchView {
        let span = projector
            .index
            .node(node)
            .map(|n| n.span)
            .unwrap_or_default();
        let mut view = MatchView::empty(document, revision, node, path.clone(), span);
        view.safely_editable = projector.safely_editable(node);
        view.blocking_hazard = projector
            .trivia
            .disqualifying_hazard(projector.index, node)
            .map(|hazard| hazard.kind);

        if !projector.is_mapping(node) {
            let found = projector.kind_of(node);
            projector.diagnose_at(DiagnosticCode::MatchIsNotAMapping { found }, node);
            // The item is recorded by span and not descended into, which is what
            // keeps a mapping hidden under a malformed `matches` entry inside the
            // accounting of `DocumentView::unaccounted_keys`.
            projector.record_undescended(node);
            view.badges = badges(&view);
            return view;
        }

        let mut scan = MappingScan::new(node, path.clone());
        let mut triggers_present = 0usize;
        let mut contents_present = 0usize;
        for (key_node, key, value_node) in projector.entries(node, &mut scan) {
            if scan.is_claimed(&key) {
                projector.skip_entry(&mut scan, key_node, &key, value_node, &MODELLED_KEYS);
                continue;
            }
            let before = scan.modelled_count();
            match key.as_str() {
                "trigger" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.trigger.trigger,
                ),
                "triggers" => projector.scalar_sequence_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.trigger.triggers,
                ),
                "regex" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.trigger.regex,
                ),
                "replace" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.content.replace,
                ),
                "markdown" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.content.markdown,
                ),
                "html" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.content.html,
                ),
                "image_path" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.content.image_path,
                ),
                "form" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.content.form,
                ),
                "label" => {
                    projector.scalar_field(&mut scan, key_node, &key, value_node, &mut view.label)
                }
                "comment" => {
                    projector.scalar_field(&mut scan, key_node, &key, value_node, &mut view.comment)
                }
                "search_terms" => projector.scalar_sequence_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.search_terms,
                ),
                "word" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.options.word,
                ),
                "left_word" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.options.left_word,
                ),
                "right_word" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.options.right_word,
                ),
                "propagate_case" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.options.propagate_case,
                ),
                "uppercase_style" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.options.uppercase_style,
                ),
                "force_mode" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.options.force_mode,
                ),
                "force_clipboard" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.options.force_clipboard,
                ),
                "paragraph" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.options.paragraph,
                ),
                "anchor" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.options.anchor,
                ),
                "vars" => {
                    if projector.sequence_items(value_node).is_some() {
                        let vars_path = child_path(&path, &key);
                        view.vars = crate::model::variable::project_sequence(
                            projector, value_node, &vars_path,
                        );
                        scan.model(key_node, &key);
                    } else {
                        projector.skip_shape(&mut scan, key_node, &key, value_node);
                    }
                }
                "form_fields" => {
                    if projector.is_mapping(value_node) {
                        if let ValueView::Mapping(fields) = projector.value(value_node) {
                            view.form_fields = fields;
                        }
                        scan.model(key_node, &key);
                    } else {
                        projector.skip_shape(&mut scan, key_node, &key, value_node);
                    }
                }
                _ => projector.skip_entry(&mut scan, key_node, &key, value_node, &MODELLED_KEYS),
            } // End of the match over the match mapping's modelled keys

            // A field only counts towards the "exactly one trigger / exactly one
            // content" rule when it was actually modelled: a `trigger` holding a
            // sequence is an unknown entry, and counting it would report a
            // conflict where there is only a malformed field.
            if scan.modelled_count() > before {
                if matches!(key.as_str(), "trigger" | "triggers" | "regex") {
                    triggers_present += 1;
                }
                if matches!(
                    key.as_str(),
                    "replace" | "markdown" | "html" | "image_path" | "form"
                ) {
                    contents_present += 1;
                }
            }
        } // End of the loop over the match mapping's entries

        view.trigger.classify(triggers_present);
        view.content.classify(contents_present);
        report_shape(projector, node, triggers_present, contents_present);
        view.unknown_entries = projector.close(scan);
        view.badges = badges(&view);
        view.search_text = view.build_search_text();
        view
    } // End of function project()

    /// A view holding nothing but the node it failed to project.
    fn empty(
        document: DocumentId,
        revision: ContentRevision,
        node: NodeId,
        path: Option<DocumentPath>,
        span: ByteSpan,
    ) -> MatchView {
        MatchView {
            id: MatchId {
                document,
                revision,
                node,
            },
            source_node: node,
            path,
            span,
            trigger: TriggerSpec::default(),
            content: ContentSpec::default(),
            label: None,
            comment: None,
            search_terms: Vec::new(),
            options: MatchOptions::default(),
            vars: Vec::new(),
            form_fields: Vec::new(),
            badges: Vec::new(),
            blocking_hazard: None,
            safely_editable: false,
            unknown_entries: Vec::new(),
            search_text: String::new(),
        }
    } // End of function empty()

    /// Builds [`MatchView::search_text`] from the five fields plan section 8.1
    /// says search covers.
    fn build_search_text(&self) -> String {
        let mut parts: Vec<&str> = Vec::new();
        if let Some(trigger) = &self.trigger.trigger {
            parts.push(&trigger.text);
        }
        parts.extend(
            self.trigger
                .triggers
                .iter()
                .filter_map(ValueView::as_scalar)
                .map(|scalar| scalar.text.as_str()),
        );
        if let Some(regex) = &self.trigger.regex {
            parts.push(&regex.text);
        }
        if let Some(label) = &self.label {
            parts.push(&label.text);
        }
        if let Some(content) = self.content.primary() {
            parts.push(&content.text);
        }
        if let Some(comment) = &self.comment {
            parts.push(&comment.text);
        }
        parts.extend(
            self.search_terms
                .iter()
                .filter_map(ValueView::as_scalar)
                .map(|scalar| scalar.text.as_str()),
        );
        parts.join("\n")
    } // End of function build_search_text()

    /// Appends every scalar this match holds, in declaration order, to `out`.
    ///
    /// The traversal the "no projected scalar is type-inferred" oracle walks.
    /// It lives here rather than in the test so that a field added to
    /// [`MatchView`] and forgotten here is a visible omission in one place,
    /// instead of an oracle that silently stops covering it.
    pub fn collect_scalars<'a>(&'a self, out: &mut Vec<&'a ScalarView>) {
        out.extend(self.trigger.trigger.iter());
        for item in &self.trigger.triggers {
            item.collect_scalars(out);
        }
        out.extend(self.trigger.regex.iter());
        out.extend(self.content.replace.iter());
        out.extend(self.content.markdown.iter());
        out.extend(self.content.html.iter());
        out.extend(self.content.image_path.iter());
        out.extend(self.content.form.iter());
        out.extend(self.label.iter());
        out.extend(self.comment.iter());
        for item in &self.search_terms {
            item.collect_scalars(out);
        }
        self.options.collect_scalars(out);
        for variable in &self.vars {
            variable.collect_scalars(out);
        }
        for field in &self.form_fields {
            if let Some(key) = &field.key {
                out.push(key);
            }
            field.value.collect_scalars(out);
        }
    } // End of function collect_scalars()
} // End of impl MatchView

/// Reports a trigger or content side espanso would reject.
fn report_shape(
    projector: &mut Projector<'_>,
    node: NodeId,
    triggers_present: usize,
    contents_present: usize,
) {
    if triggers_present == 0 {
        projector.diagnose_at(DiagnosticCode::MatchHasNoTrigger, node);
    } else if triggers_present > 1 {
        projector.diagnose_at(
            DiagnosticCode::MatchHasSeveralTriggerForms {
                count: triggers_present,
            },
            node,
        );
    }
    if contents_present == 0 {
        projector.diagnose_at(DiagnosticCode::MatchHasNoContent, node);
    } else if contents_present > 1 {
        projector.diagnose_at(
            DiagnosticCode::MatchHasSeveralContentForms {
                count: contents_present,
            },
            node,
        );
    }
} // End of function report_shape()

/// The badges a projected match earns, sorted and deduplicated.
fn badges(view: &MatchView) -> Vec<MatchBadge> {
    let mut badges = Vec::new();
    if view.trigger.regex.is_some() {
        badges.push(MatchBadge::Regex);
    }
    if view.trigger.triggers.len() > 1 {
        badges.push(MatchBadge::MultipleTriggers);
    }
    if view.content.form.is_some() || !view.form_fields.is_empty() {
        badges.push(MatchBadge::Form);
    }
    if view.content.html.is_some() {
        badges.push(MatchBadge::Html);
    }
    if view.content.markdown.is_some() {
        badges.push(MatchBadge::Markdown);
    }
    if view.content.image_path.is_some() {
        badges.push(MatchBadge::Image);
    }
    if !view.vars.is_empty() {
        badges.push(MatchBadge::Variables);
    }
    for variable in &view.vars {
        match variable.kind {
            VariableKind::Shell => badges.push(MatchBadge::Shell),
            VariableKind::Script => badges.push(MatchBadge::Script),
            VariableKind::Form => badges.push(MatchBadge::Form),
            _ => {}
        }
    } // End of the loop over the match's variables
    if !view.safely_editable {
        badges.push(MatchBadge::NotEditable);
    }
    badges.sort_unstable();
    badges.dedup();
    badges
} // End of function badges()

/// Projects a whole `matches` sequence.
pub(crate) fn project_sequence(
    projector: &mut Projector<'_>,
    document: DocumentId,
    revision: ContentRevision,
    node: NodeId,
    path: &Option<DocumentPath>,
) -> Vec<MatchView> {
    let Some(items) = projector.sequence_items(node) else {
        return Vec::new();
    };
    items
        .into_iter()
        .enumerate()
        .map(|(position, item)| {
            MatchView::project(
                projector,
                document,
                revision,
                item,
                child_index(path, position),
            )
        })
        .collect()
} // End of function project_sequence()
