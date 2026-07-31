//! The shared state one projection pass carries.
//!
//! Every view in this module is built by walking the syntax index once, and
//! three things have to be accumulated across that whole walk rather than per
//! view: the diagnostics, the per-mapping coverage records, and the unknown
//! entries each mapping produced. [`Projector`] is that accumulator, plus the
//! handful of "read this node as the shape the schema says" helpers each view
//! would otherwise re-implement — and re-implement slightly differently, which
//! is how a field quietly stops being recorded.

use crate::model::{
    mapping_entries, Diagnostic, DiagnosticCode, MappingCoverage, MappingScan, ScalarView,
    UnknownEntry, UnknownReason, ValueKind, ValueView, MAX_VALUE_DEPTH,
};
use crate::patch::DocumentPath;
use crate::syntax::{ByteSpan, NodeId, NodeKind, SyntaxIndex, TriviaIndex};

/// The accumulator threaded through one document's projection.
pub(crate) struct Projector<'a> {
    /// The document's bytes, BOM included.
    pub(crate) source: &'a str,
    /// The parsed index every span and node identifier refers to.
    pub(crate) index: &'a SyntaxIndex,
    /// The classified gaps, for the hazard gate.
    pub(crate) trivia: &'a TriviaIndex,
    /// Everything the walk noticed, in the order it noticed it.
    pub(crate) diagnostics: Vec<Diagnostic>,
    /// One record per mapping the walk modelled.
    pub(crate) coverage: Vec<MappingCoverage>,
    /// Byte spans the walk recorded **without descending into them**.
    ///
    /// The right-hand side of the accounting property: a key the projection did
    /// not name must lie inside one of these. Every entry is put here by the one
    /// place that decided not to descend, so the list cannot drift from the
    /// decisions it summarises.
    pub(crate) undescended: Vec<ByteSpan>,
}

impl<'a> Projector<'a> {
    /// Starts a projection over one parsed document.
    pub(crate) fn new(
        source: &'a str,
        index: &'a SyntaxIndex,
        trivia: &'a TriviaIndex,
    ) -> Projector<'a> {
        Projector {
            source,
            index,
            trivia,
            diagnostics: Vec::new(),
            coverage: Vec::new(),
            undescended: Vec::new(),
        }
    }

    /// Records a diagnostic.
    pub(crate) fn diagnose(&mut self, diagnostic: Diagnostic) {
        self.diagnostics.push(diagnostic);
    }

    /// Records that `node`'s bytes were kept but not descended into.
    ///
    /// A node with no span in the index contributes nothing, which is correct:
    /// it can contain no key either.
    pub(crate) fn record_undescended(&mut self, node: NodeId) {
        if let Some(span) = self.index.node(node).map(|n| n.span) {
            self.undescended.push(span);
        }
    }

    /// Records a diagnostic about the node `node`, located at its span.
    pub(crate) fn diagnose_at(&mut self, code: DiagnosticCode, node: NodeId) {
        let span = self.index.node(node).map(|n| n.span).unwrap_or_default();
        self.diagnostics.push(Diagnostic::at(code, node, span));
    }

    /// What kind of value the node `node` is.
    pub(crate) fn kind_of(&self, node: NodeId) -> ValueKind {
        ValueKind::of_node(self.index, node)
    }

    /// Projects `node` as a scalar, or `None` when it is not one.
    ///
    /// Records [`DiagnosticCode::ScalarNotDecodable`] when the bytes resisted
    /// decoding, which is how that fallback stays visible.
    pub(crate) fn scalar(&mut self, node: NodeId) -> Option<ScalarView> {
        let projected = self
            .index
            .node(node)
            .and_then(|n| ScalarView::project(self.source, n))?;
        if !projected.decoded {
            self.diagnose_at(DiagnosticCode::ScalarNotDecodable, node);
        }
        Some(projected)
    }

    /// Projects `node` shallowly and completely, recording what it gave up on.
    pub(crate) fn value(&mut self, node: NodeId) -> ValueView {
        let (value, findings) = ValueView::project(self.source, self.index, node);
        for too_deep in findings.too_deep {
            self.diagnose_at(
                DiagnosticCode::ValueTooDeep {
                    depth: MAX_VALUE_DEPTH,
                },
                too_deep,
            );
            // The descent stopped here, so whatever is below is recorded by span
            // rather than by name.
            self.record_undescended(too_deep);
        }
        for not_decodable in findings.not_decodable {
            self.diagnose_at(DiagnosticCode::ScalarNotDecodable, not_decodable);
        }
        value
    } // End of function value()

    /// The children of `node` when it is a sequence, otherwise `None`.
    pub(crate) fn sequence_items(&self, node: NodeId) -> Option<Vec<NodeId>> {
        let child = self.index.node(node)?;
        (child.kind == NodeKind::Sequence).then(|| child.children.clone())
    }

    /// Returns `true` when `node` is a mapping.
    pub(crate) fn is_mapping(&self, node: NodeId) -> bool {
        self.index
            .node(node)
            .is_some_and(|n| n.kind == NodeKind::Mapping)
    }

    /// Whether the visual editor may edit `node`, per the hazard gate.
    pub(crate) fn safely_editable(&self, node: NodeId) -> bool {
        self.trivia.is_safely_editable(self.index, node)
    }

    /// Projects every item of the sequence at `node` as a scalar.
    ///
    /// An item that is not a scalar is projected as its own
    /// [`ValueView::Elided`] **at its own position** and reported once, so a
    /// `search_terms` holding a nested mapping neither disappears nor pretends
    /// to be a string — and the items after it keep their indices. Losing
    /// positional correspondence in a read model is the kind of thing a later
    /// phase would build an edit on.
    pub(crate) fn scalar_sequence(&mut self, node: NodeId, key: &str) -> Vec<ValueView> {
        let Some(items) = self.sequence_items(node) else {
            return Vec::new();
        };
        let mut out = Vec::new();
        for item in items {
            match self.scalar(item) {
                Some(scalar) => out.push(ValueView::Scalar(scalar)),
                None => {
                    let found = self.kind_of(item);
                    self.diagnose_at(
                        DiagnosticCode::FieldHasUnexpectedShape {
                            key: key.to_owned(),
                            found,
                        },
                        item,
                    );
                    let span = self.index.node(item).map(|n| n.span).unwrap_or_default();
                    self.record_undescended(item);
                    out.push(ValueView::Elided {
                        kind: found,
                        span,
                        node: item,
                    });
                }
            }
        } // End of the loop over the sequence's items
        out
    } // End of function scalar_sequence()

    /// Files one mapping's coverage record and returns its unknown entries.
    ///
    /// The record is checked here, in the library, before it is stored:
    /// [`MappingCoverage::accounts_for`] is the production half of the
    /// no-key-dropped invariant (`PROGRESS.md` R24 — a safety property that
    /// lives only in the test suite is not a safety property).
    ///
    /// A record that does not balance is a bug in this module, and it is
    /// reported as [`DiagnosticCode::CoverageIsIncomplete`] rather than
    /// asserted: a `debug_assert!` here would be a panic on input, which this
    /// module's fifth rule forbids, and it would also **mask** the corpus
    /// sweep's own re-derivation by aborting before it could disagree. The
    /// sweep pins the code at zero over both corpora, so the layer is live
    /// rather than decorative.
    pub(crate) fn close(&mut self, scan: MappingScan) -> Vec<UnknownEntry> {
        let (coverage, unknown) = scan.finish();
        if !coverage.accounts_for(self.index) {
            self.diagnose_at(DiagnosticCode::CoverageIsIncomplete, coverage.mapping);
        }
        self.coverage.push(coverage);
        // An unmodelled entry is recorded by name and by span and is **not**
        // descended into (plan section 6.2 asks that it never be discarded, not
        // that it be interpreted). Both spans go on the undescended list so that
        // a key nested under one still lies inside something the projection
        // named — the precise form of the no-key-is-lost claim.
        for entry in &unknown {
            self.undescended.push(entry.key_span);
            self.undescended.push(entry.value_span);
        }
        unknown
    } // End of function close()

    /// Walks the entries of the mapping `mapping` names, in source order.
    ///
    /// Yields `(key_node, key_text, value_node)` for every entry whose key is a
    /// scalar. A non-scalar key is recorded on `scan` as
    /// [`UnknownReason::NonScalarKey`] and reported, and never reaches the
    /// caller: no [`DocumentPath`] segment can name it, so no modelled field
    /// could address it anyway.
    pub(crate) fn entries(
        &mut self,
        mapping: NodeId,
        scan: &mut MappingScan,
    ) -> Vec<(NodeId, String, NodeId)> {
        let mut out = Vec::new();
        for (key_node, value_node) in mapping_entries(self.index, mapping) {
            match self.scalar(key_node) {
                Some(key) => out.push((key_node, key.text, value_node)),
                None => {
                    scan.skip(
                        self.index,
                        key_node,
                        None,
                        value_node,
                        UnknownReason::NonScalarKey,
                    );
                    self.diagnose_at(DiagnosticCode::NonScalarKey, key_node);
                }
            }
        } // End of the loop over the mapping's entries
        out
    } // End of function entries()

    /// Records an entry the projection did not model, choosing the reason.
    ///
    /// `modelled_here` is the set of keys this mapping's projection knows, so a
    /// second occurrence of one of them is reported as a repeat rather than as
    /// an unrecognised key — the distinction the UI needs to explain why an
    /// entry the user *can* see is not the one being edited.
    pub(crate) fn skip_entry(
        &mut self,
        scan: &mut MappingScan,
        key_node: NodeId,
        key: &str,
        value_node: NodeId,
        modelled_here: &[&str],
    ) {
        let repeated = modelled_here.contains(&key) && scan.is_claimed(key);
        let reason = if repeated {
            self.diagnose_at(
                DiagnosticCode::RepeatedKey {
                    key: key.to_owned(),
                },
                key_node,
            );
            UnknownReason::RepeatedKey
        } else {
            UnknownReason::NotModelled
        };
        scan.skip(self.index, key_node, Some(key), value_node, reason);
    } // End of function skip_entry()

    /// Records an entry whose key is modelled but whose value has the wrong
    /// shape.
    pub(crate) fn skip_shape(
        &mut self,
        scan: &mut MappingScan,
        key_node: NodeId,
        key: &str,
        value_node: NodeId,
    ) {
        let found = self.kind_of(value_node);
        self.diagnose_at(
            DiagnosticCode::FieldHasUnexpectedShape {
                key: key.to_owned(),
                found,
            },
            value_node,
        );
        scan.skip(
            self.index,
            key_node,
            Some(key),
            value_node,
            UnknownReason::UnexpectedShape { found },
        );
    } // End of function skip_shape()

    /// Models one entry whose value must be a scalar, into `slot`.
    ///
    /// Returns without touching `slot` when the value is not a scalar, having
    /// recorded the entry as [`UnknownReason::UnexpectedShape`] — which is why
    /// every scalar field of a match goes through here instead of through a
    /// hand-written `if let`: the two branches that must never be forgotten are
    /// written once.
    pub(crate) fn scalar_field(
        &mut self,
        scan: &mut MappingScan,
        key_node: NodeId,
        key: &str,
        value_node: NodeId,
        slot: &mut Option<ScalarView>,
    ) {
        match self.scalar(value_node) {
            Some(scalar) => {
                *slot = Some(scalar);
                scan.model(key_node, key);
            }
            None => self.skip_shape(scan, key_node, key, value_node),
        }
    } // End of function scalar_field()

    /// Models one entry whose value must be a sequence of scalars, into `slot`.
    pub(crate) fn scalar_sequence_field(
        &mut self,
        scan: &mut MappingScan,
        key_node: NodeId,
        key: &str,
        value_node: NodeId,
        slot: &mut Vec<ValueView>,
    ) {
        if self.kind_of(value_node) == ValueKind::Sequence {
            *slot = self.scalar_sequence(value_node, key);
            scan.model(key_node, key);
        } else {
            self.skip_shape(scan, key_node, key, value_node);
        }
    } // End of function scalar_sequence_field()
} // End of impl Projector

/// Extends `base` with `key`, when the base path exists.
pub(crate) fn child_path(base: &Option<DocumentPath>, key: &str) -> Option<DocumentPath> {
    base.as_ref().map(|path| path.clone().with_key(key))
}

/// Extends `base` with `index`, when the base path exists.
pub(crate) fn child_index(base: &Option<DocumentPath>, index: usize) -> Option<DocumentPath> {
    base.as_ref().map(|path| path.clone().with_index(index))
}
