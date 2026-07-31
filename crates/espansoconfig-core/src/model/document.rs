//! One file, projected.
//!
//! [`DocumentView`] is what `get_document` returns and what the three-pane
//! browser renders. It is a **projection**: it borrows nothing and owns no
//! authority, it holds spans and node identifiers pointing back into the source
//! the caller keeps, and rebuilding it from the same bytes always gives the
//! same answer.
//!
//! # A document that does not parse still has a view
//!
//! [`DocumentView::project`] is total. A file the substrate rejects, a file
//! whose root is a sequence, a file that is not espanso-shaped at all: each
//! yields a view carrying diagnostics and no matches, and the caller still has
//! the raw text to show. Nothing here returns an error and nothing here
//! panics — a browser that hides the one file the user needs to fix is worse
//! than one that shows it as text.

use serde::Serialize;

use crate::discovery::FileKind;
use crate::model::project::{child_path, Projector};
use crate::model::{
    mapping_entries, ConfigProfileView, Diagnostic, DiagnosticCode, IdentityError, MappingCoverage,
    MatchId, MatchView, ScalarView, UnknownEntry, ValueView, VariableView,
};
use crate::patch::DocumentPath;
use crate::syntax::{
    ByteSpan, HazardKind, NodeId, NodeKind, SyntaxError, SyntaxIndex, TriviaIndex,
};
use crate::wire::WirePath;
use crate::{ContentRevision, DocumentId, LineEnding};
use std::path::PathBuf;

/// The three top-level keys of a match file (plan section 3.2).
const MATCH_FILE_KEYS: [&str; 3] = ["matches", "global_vars", "imports"];

/// What a document's **content** looks like, independently of where the file
/// sits on disk.
///
/// Derived from the root mapping's keys rather than from the directory, so the
/// projection is testable on a corpus that has no directory — and so a
/// `config/*.yml` that actually holds `matches` is reported rather than
/// mis-rendered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum DocumentShape {
    /// The root mapping holds at least one of `matches`, `global_vars` and
    /// `imports`.
    MatchFile,
    /// The root is a mapping holding none of the three, which is what a config
    /// profile looks like.
    ConfigProfile,
    /// There is no root mapping: an empty file, a comments-only file, or a
    /// document whose root is a sequence or a scalar.
    Other,
}

/// Everything about a document that comes from outside its own bytes.
///
/// Passed in rather than discovered, so that [`DocumentView::project`] is a
/// pure function of its arguments and the corpus tests can drive it without a
/// filesystem.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentContext {
    /// Session-local identity.
    pub id: DocumentId,
    /// Absolute path on disk.
    pub path: PathBuf,
    /// Path relative to the configuration root, for display.
    pub relative_path: PathBuf,
    /// What espanso treats the file as.
    pub kind: FileKind,
    /// Whether espanso's default include glob skips the file (a leading `_`).
    pub disabled: bool,
}

impl DocumentContext {
    /// A context for a file that is not on disk, used by tests and by callers
    /// projecting a buffer.
    pub fn detached(id: DocumentId, name: &str) -> DocumentContext {
        DocumentContext {
            id,
            path: PathBuf::from(name),
            relative_path: PathBuf::from(name),
            kind: FileKind::MatchFile,
            disabled: name
                .rsplit(['/', '\\'])
                .next()
                .is_some_and(|base| base.starts_with('_')),
        }
    }

    /// The file's base name, or an empty string.
    pub fn file_name(&self) -> &str {
        self.path
            .file_name()
            .and_then(std::ffi::OsStr::to_str)
            .unwrap_or_default()
    }
}

/// One file, projected for the read-only browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DocumentView {
    /// Session-local identity.
    pub id: DocumentId,
    /// Absolute path on disk.
    ///
    /// A [`WirePath`]: it renders lossily on the wire so that no path can make
    /// this projection fail to serialize, and [`DocumentView::id`] — not this —
    /// is what a caller hands back. See `crate::wire`.
    pub path: WirePath,
    /// Path relative to the configuration root, for display.
    pub relative_path: WirePath,
    /// What espanso treats the file as.
    pub kind: FileKind,
    /// Whether espanso's default include glob skips the file.
    pub disabled: bool,
    /// Whether the editor must refuse to write the file (a Hub package).
    pub read_only: bool,
    /// Revision of the bytes this view projects.
    pub revision: ContentRevision,
    /// Length of those bytes, BOM included.
    pub byte_len: usize,
    /// Dominant line ending.
    pub line_ending: LineEnding,
    /// Whether the file starts with a UTF-8 BOM.
    pub bom: bool,
    /// Whether the substrate accepted the file. When `false` every projection
    /// field below is empty and only the diagnostics and the raw text exist.
    pub parsed: bool,
    /// How many YAML documents the stream holds. Espanso loads the first.
    pub stream_documents: usize,
    /// What the content looks like.
    pub shape: DocumentShape,
    /// Every top-level key of the projected document, in source order, as
    /// source text.
    pub top_level_keys: Vec<ScalarView>,
    /// `matches`.
    pub matches: Vec<MatchView>,
    /// `global_vars`.
    pub global_vars: Vec<VariableView>,
    /// `imports`, one item per source entry, in source order.
    ///
    /// Every item is a [`ValueView::Scalar`] or a [`ValueView::Elided`]: an
    /// entry the schema says is a path but the file writes as a collection is
    /// elided **in place**, never dropped, so positions never shift.
    pub imports: Vec<ValueView>,
    /// The profile projection, for a document whose shape is
    /// [`DocumentShape::ConfigProfile`].
    pub profile: Option<ConfigProfileView>,
    /// Top-level entries this projection did not model, never discarded.
    pub unknown_entries: Vec<UnknownEntry>,
    /// One record per mapping the projection modelled, proving it accounted for
    /// every entry.
    pub coverage: Vec<MappingCoverage>,
    /// Byte spans the projection **recorded without descending into them**.
    ///
    /// Unmodelled entries' keys and values, sequence items whose shape the
    /// schema does not allow, values past [`crate::model::MAX_VALUE_DEPTH`],
    /// and the documents of a multi-document stream espanso does not load.
    ///
    /// This is the right-hand side of the accounting property
    /// [`DocumentView::unaccounted_keys`] checks: *every key of the document is
    /// either named by the projection or lies inside one of these spans.*
    pub undescended: Vec<ByteSpan>,
    /// Everything the projection noticed, as codes and operands.
    pub diagnostics: Vec<Diagnostic>,
    /// The distinct hazard kinds present anywhere in the file, sorted.
    pub hazards: Vec<HazardKind>,
    /// Whether the visual editor may edit the document's root at all.
    pub safely_editable: bool,
}

impl DocumentView {
    /// Projects a parsed document.
    ///
    /// `source` must be the bytes `index` and `trivia` were built from, BOM
    /// included, and `revision` their hash. Total: there is no input for which
    /// this returns an error or panics.
    pub fn project(
        context: &DocumentContext,
        source: &str,
        revision: ContentRevision,
        index: &SyntaxIndex,
        trivia: &TriviaIndex,
    ) -> DocumentView {
        let mut view = DocumentView::shell(context, source, revision);
        view.parsed = true;
        view.stream_documents = index.documents().len();
        view.hazards = distinct_hazards(trivia);

        let mut projector = Projector::new(source, index, trivia);
        for hazard in trivia.hazards() {
            projector.diagnose(Diagnostic {
                code: DiagnosticCode::Hazard { kind: hazard.kind },
                span: Some(hazard.span),
                node: hazard.node,
                path: None,
            });
        } // End of the loop over the document's hazards

        // Espanso loads the first document of a stream and ignores the rest.
        // Naming each of the rest by span is what keeps "ignored" from becoming
        // "silently discarded" (plan section 6.2).
        for extra in 1..index.documents().len() {
            let node = index.documents()[extra];
            projector.diagnose_at(
                DiagnosticCode::AdditionalDocumentNotProjected {
                    document_index: extra,
                },
                node,
            );
            projector.record_undescended(node);
        } // End of the loop over the documents espanso does not load

        match root_of(index, 0) {
            None => {
                let code = if index.documents().is_empty() {
                    DiagnosticCode::NoDocument
                } else {
                    DiagnosticCode::EmptyDocument { document_index: 0 }
                };
                projector.diagnose(Diagnostic::document(code));
            }
            Some(root) => {
                view.safely_editable = projector.safely_editable(root);
                project_root(&mut projector, context, &mut view, root);
            }
        }

        view.diagnostics = projector.diagnostics;
        view.coverage = projector.coverage;
        view.undescended = projector.undescended;
        report_unaccounted_keys(&mut view, index);
        view
    } // End of function project()

    /// Projects a document the substrate rejected.
    ///
    /// The view carries the diagnostic and nothing else; the caller still holds
    /// the bytes, so the raw YAML pane works exactly as it does for a healthy
    /// file. That is the whole point of the fallible parse outcome.
    pub fn failed(
        context: &DocumentContext,
        source: &str,
        revision: ContentRevision,
        error: &SyntaxError,
    ) -> DocumentView {
        let mut view = DocumentView::shell(context, source, revision);
        let code = match error {
            SyntaxError::Parse(failure) => DiagnosticCode::ParseFailed {
                line: failure.line,
                column: failure.column,
                byte_index: failure.byte_index,
            },
            SyntaxError::Offset(_) | SyntaxError::Invariant(_) => DiagnosticCode::IndexRejected,
        };
        view.diagnostics.push(Diagnostic::document(code));
        view
    } // End of function failed()

    /// The document-relative path of the projected document's root.
    pub fn root_path(&self) -> DocumentPath {
        DocumentPath::root(0)
    }

    /// Finds a match by identity, refusing an identity from another parse.
    ///
    /// The three refusals are the whole point of the identity carrying a
    /// revision. `NodeId` is the parser's arena index, so an identity minted
    /// before a reparse would otherwise select whatever now occupies that slot
    /// — for two equally shaped matches that swapped places, *the other match*.
    /// Comparing the revision first makes that impossible: a stale identity
    /// comes back as [`IdentityError::StaleRevision`] and is never resolved.
    ///
    /// Linear, because a document holds tens of matches rather than thousands
    /// and an index would be one more thing to keep in step with a reparse.
    ///
    /// # Errors
    ///
    /// [`IdentityError::WrongDocument`] when the identity is another document's,
    /// [`IdentityError::StaleRevision`] when it belongs to another parse of this
    /// one, and [`IdentityError::NoSuchMatch`] when neither holds and no match
    /// is that node.
    pub fn match_by_id(&self, id: MatchId) -> Result<&MatchView, IdentityError> {
        if id.document != self.id {
            return Err(IdentityError::WrongDocument {
                expected: self.id,
                found: id.document,
            });
        }
        if id.revision != self.revision {
            return Err(IdentityError::StaleRevision {
                expected: self.revision,
                found: id.revision,
            });
        }
        self.matches
            .iter()
            .find(|view| view.id == id)
            .ok_or(IdentityError::NoSuchMatch { node: id.node })
    } // End of function match_by_id()

    /// Every key node the projection **named**, by any route.
    ///
    /// Two routes exist and both are here: a mapping the schema walk scanned
    /// leaves a [`MappingCoverage`] holding every one of its key nodes, and a
    /// mapping projected shallowly leaves a [`crate::model::FieldView`] per
    /// entry. A key reached by neither is not named, which is exactly the
    /// question [`DocumentView::unaccounted_keys`] asks.
    pub fn named_key_nodes(&self) -> Vec<NodeId> {
        let mut out = Vec::new();
        for record in &self.coverage {
            out.extend(record.modelled.iter().copied());
            out.extend(record.unknown.iter().copied());
        }
        for entry in &self.matches {
            for field in &entry.form_fields {
                out.push(field.key_node);
                field.value.collect_key_nodes(&mut out);
            }
            for variable in &entry.vars {
                collect_variable_key_nodes(variable, &mut out);
            }
        } // End of the loop over the document's matches
        for variable in &self.global_vars {
            collect_variable_key_nodes(variable, &mut out);
        }
        if let Some(profile) = &self.profile {
            for field in &profile.entries {
                out.push(field.key_node);
                field.value.collect_key_nodes(&mut out);
            }
        }
        out.sort_unstable();
        out.dedup();
        out
    } // End of function named_key_nodes()

    /// Every mapping key of `index` this projection neither named nor covered
    /// by an undescended span.
    ///
    /// The precise form of plan section 6.2's *"unknown entries are NEVER
    /// silently discarded"*: **every key of the document is either modelled, or
    /// recorded as unknown, or lies inside a span the projection recorded
    /// without descending into it.** The vaguer "every key is recorded by name"
    /// is not what this projection does — an unmodelled mapping is kept whole,
    /// by span — and stating the weaker claim precisely is what makes it
    /// checkable at all.
    ///
    /// An empty result is the invariant holding. A non-empty one is a bug in
    /// [`crate::model`], never a property of the file, and is reported as
    /// [`DiagnosticCode::KeyNotAccountedFor`].
    pub fn unaccounted_keys(&self, index: &SyntaxIndex) -> Vec<NodeId> {
        let named = self.named_key_nodes();
        let mut lost = Vec::new();
        for node in index.nodes() {
            if node.kind != NodeKind::Mapping {
                continue;
            }
            for (key_node, _) in mapping_entries(index, node.id) {
                if named.binary_search(&key_node).is_ok() {
                    continue;
                }
                let key_span = index.node(key_node).map(|key| key.span).unwrap_or_default();
                if self
                    .undescended
                    .iter()
                    .any(|span| span.contains(key_span) && !span.is_empty())
                {
                    continue;
                }
                lost.push(key_node);
            } // End of the loop over one mapping's entries
        } // End of the loop over the index's nodes
        lost.sort_unstable();
        lost.dedup();
        lost
    } // End of function unaccounted_keys()

    /// Every scalar the projection exposes, in declaration order.
    ///
    /// The traversal the D2u oracle walks: every one of these must equal
    /// `crate::emit::decode()` of its own span. It lives on the type, not in
    /// the test, so that a field added to the projection and forgotten by the
    /// traversal is one omission rather than a silently narrowed oracle
    /// (`PROGRESS.md` R24).
    pub fn scalars(&self) -> Vec<&ScalarView> {
        let mut out = Vec::new();
        out.extend(self.top_level_keys.iter());
        for view in &self.matches {
            view.collect_scalars(&mut out);
        }
        for variable in &self.global_vars {
            variable.collect_scalars(&mut out);
        }
        for import in &self.imports {
            import.collect_scalars(&mut out);
        }
        if let Some(profile) = &self.profile {
            profile.collect_scalars(&mut out);
        }
        out
    } // End of function scalars()

    /// Every unknown entry of the whole document, top level and nested.
    pub fn all_unknown_entries(&self) -> Vec<&UnknownEntry> {
        let mut out: Vec<&UnknownEntry> = self.unknown_entries.iter().collect();
        for view in &self.matches {
            out.extend(view.unknown_entries.iter());
            for variable in &view.vars {
                out.extend(variable.unknown_entries.iter());
            }
        }
        for variable in &self.global_vars {
            out.extend(variable.unknown_entries.iter());
        }
        out
    } // End of function all_unknown_entries()

    /// Returns `true` when every coverage record accounts for its mapping.
    ///
    /// The production statement of "no key is ever silently discarded". The
    /// corpus sweep re-derives the same union from the syntax index without
    /// calling this, so the two can disagree — which is what makes either of
    /// them worth running.
    pub fn coverage_is_complete(&self, index: &SyntaxIndex) -> bool {
        self.coverage
            .iter()
            .all(|record| record.accounts_for(index))
    }

    /// The empty view every projection starts from.
    fn shell(context: &DocumentContext, source: &str, revision: ContentRevision) -> DocumentView {
        DocumentView {
            id: context.id,
            path: WirePath::from(context.path.clone()),
            relative_path: WirePath::from(context.relative_path.clone()),
            kind: context.kind,
            disabled: context.disabled,
            read_only: context.kind.is_read_only(),
            revision,
            byte_len: source.len(),
            line_ending: LineEnding::detect(source),
            bom: source.starts_with(crate::UTF8_BOM),
            parsed: false,
            stream_documents: 0,
            shape: DocumentShape::Other,
            top_level_keys: Vec::new(),
            matches: Vec::new(),
            global_vars: Vec::new(),
            imports: Vec::new(),
            profile: None,
            unknown_entries: Vec::new(),
            coverage: Vec::new(),
            undescended: Vec::new(),
            diagnostics: Vec::new(),
            hazards: Vec::new(),
            safely_editable: false,
        }
    } // End of function shell()
} // End of impl DocumentView

/// Appends the key node of every shallowly projected entry of `variable`.
fn collect_variable_key_nodes(variable: &VariableView, out: &mut Vec<NodeId>) {
    for field in &variable.params {
        out.push(field.key_node);
        field.value.collect_key_nodes(out);
    }
}

/// Reports every key the projection neither named nor covered by a span.
///
/// `PROGRESS.md` R24 in the direction it is usually not: the corpus sweep
/// re-derives this same accounting from the syntax index, and a property the
/// sweep checks must also be a property the library states. It is a diagnostic
/// rather than an assertion for the reason `Projector::close` gives — a panic
/// on input is forbidden here, and an assertion would abort before the sweep's
/// independent derivation could disagree.
fn report_unaccounted_keys(view: &mut DocumentView, index: &SyntaxIndex) {
    for key_node in view.unaccounted_keys(index) {
        let span = index
            .node(key_node)
            .map(|node| node.span)
            .unwrap_or_default();
        view.diagnostics.push(Diagnostic::at(
            DiagnosticCode::KeyNotAccountedFor,
            key_node,
            span,
        ));
    } // End of the loop over the keys nothing accounted for
} // End of function report_unaccounted_keys()

/// Projects the root of document 0 into `view`.
fn project_root(
    projector: &mut Projector<'_>,
    context: &DocumentContext,
    view: &mut DocumentView,
    root: NodeId,
) {
    if !projector.is_mapping(root) {
        let found = projector.kind_of(root);
        projector.diagnose_at(DiagnosticCode::RootIsNotAMapping { found }, root);
        // A root that is a sequence can still hold mappings, and the projection
        // does not descend into it: record it whole.
        projector.record_undescended(root);
        return;
    }

    let path = Some(DocumentPath::root(0));
    let mut scan = crate::model::MappingScan::new(root, path.clone());
    let entries = projector.entries(root, &mut scan);
    view.top_level_keys = entries
        .iter()
        .filter_map(|(key_node, _, _)| projector.scalar(*key_node))
        .collect();
    view.shape = shape_of(&entries);

    if view.shape == DocumentShape::ConfigProfile {
        // A profile is projected shallowly and completely, so every entry is
        // modelled and none can be lost. The coverage record still exists, and
        // is what proves that claim rather than asserting it.
        for (key_node, key, _) in &entries {
            scan.model(*key_node, key);
        }
        view.profile = Some(ConfigProfileView::project(projector, root));
    } else {
        project_match_file(projector, view, &path, &mut scan, entries);
    }

    report_location_disagreement(projector, context, view, root);
    view.unknown_entries = projector.close(scan);
} // End of function project_root()

/// Projects the three match-file keys, recording everything else as unknown.
fn project_match_file(
    projector: &mut Projector<'_>,
    view: &mut DocumentView,
    path: &Option<DocumentPath>,
    scan: &mut crate::model::MappingScan,
    entries: Vec<(NodeId, String, NodeId)>,
) {
    let document = view.id;
    let revision = view.revision;
    for (key_node, key, value_node) in entries {
        if scan.is_claimed(&key) {
            projector.skip_entry(scan, key_node, &key, value_node, &MATCH_FILE_KEYS);
            continue;
        }
        match key.as_str() {
            "matches" => {
                if projector.sequence_items(value_node).is_some() {
                    let matches_path = child_path(path, &key);
                    view.matches = crate::model::match_view::project_sequence(
                        projector,
                        document,
                        revision,
                        value_node,
                        &matches_path,
                    );
                    scan.model(key_node, &key);
                } else {
                    projector.skip_shape(scan, key_node, &key, value_node);
                }
            }
            "global_vars" => {
                if projector.sequence_items(value_node).is_some() {
                    let vars_path = child_path(path, &key);
                    view.global_vars =
                        crate::model::variable::project_sequence(projector, value_node, &vars_path);
                    scan.model(key_node, &key);
                } else {
                    projector.skip_shape(scan, key_node, &key, value_node);
                }
            }
            "imports" => {
                projector.scalar_sequence_field(
                    scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.imports,
                );
            }
            _ => projector.skip_entry(scan, key_node, &key, value_node, &MATCH_FILE_KEYS),
        } // End of the match over the three match-file keys
    } // End of the loop over the root mapping's entries
} // End of function project_match_file()

/// Reports a file whose location and content disagree about what it is.
fn report_location_disagreement(
    projector: &mut Projector<'_>,
    context: &DocumentContext,
    view: &DocumentView,
    root: NodeId,
) {
    let disagrees = matches!(
        (context.kind, view.shape),
        (FileKind::ConfigProfile, DocumentShape::MatchFile)
            | (
                FileKind::MatchFile | FileKind::Package,
                DocumentShape::ConfigProfile
            )
    );
    if disagrees {
        projector.diagnose_at(
            DiagnosticCode::ShapeDisagreesWithLocation { shape: view.shape },
            root,
        );
    }
} // End of function report_location_disagreement()

/// Decides a document's shape from its root mapping's keys.
fn shape_of(entries: &[(NodeId, String, NodeId)]) -> DocumentShape {
    let is_match_file = entries
        .iter()
        .any(|(_, key, _)| MATCH_FILE_KEYS.contains(&key.as_str()));
    if is_match_file {
        DocumentShape::MatchFile
    } else {
        DocumentShape::ConfigProfile
    }
}

/// The root node of one document of the stream, when it has one.
fn root_of(index: &SyntaxIndex, document_index: usize) -> Option<NodeId> {
    let document = *index.documents().get(document_index)?;
    let node = index.node(document)?;
    if node.kind != NodeKind::Document {
        return None;
    }
    node.children.first().copied()
}

/// The distinct hazard kinds a document holds, sorted.
fn distinct_hazards(trivia: &TriviaIndex) -> Vec<HazardKind> {
    let mut kinds: Vec<HazardKind> = trivia.hazards().iter().map(|hazard| hazard.kind).collect();
    kinds.sort_unstable();
    kinds.dedup();
    kinds
}

/// Builds the context of a file discovered under `root`.
///
/// A thin bridge from [`crate::discovery`] into the projection, so the
/// workspace does not have to restate the classification rules.
pub fn context_of(id: DocumentId, file: &crate::discovery::DiscoveredFile) -> DocumentContext {
    DocumentContext {
        id,
        path: file.path.clone(),
        relative_path: file.relative_path.clone(),
        kind: file.kind,
        disabled: file.disabled,
    }
}
