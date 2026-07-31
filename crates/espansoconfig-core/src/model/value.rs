//! The shallow, lossless projection used wherever espanso's schema is open.
//!
//! A variable's `params`, a form's `fields` and a config profile's body are all
//! mappings whose keys espanso itself does not fix: `params` differs per
//! variable type, `fields` is keyed by the form author's field names, and a
//! profile carries roughly thirty-five behaviour options that grow with each
//! espanso release. Modelling each one by name would guarantee that the day
//! espanso adds an option, this crate silently drops it.
//!
//! So those regions are projected **shallowly and completely**: every key and
//! every value is carried, with scalars as [`crate::model::ScalarView`]s and
//! structure as nesting. Nothing is interpreted, so nothing can be lost.

use serde::Serialize;

use crate::model::ScalarView;
use crate::syntax::{ByteSpan, NodeId, NodeKind, SyntaxIndex};

/// The deepest nesting [`ValueView::project`] descends before it stops.
///
/// A guard against unbounded recursion on hostile input, not a schema limit:
/// the deepest construct espanso defines is roughly `matches[i].vars[j].params
/// .fields.<name>.values[k]`, seven levels down. A document nested past this is
/// truncated with a [`crate::model::DiagnosticCode::ValueTooDeep`] rather than
/// overflowing the stack, because "never panic on any input" outranks
/// completeness on a document no espanso installation can load.
pub const MAX_VALUE_DEPTH: usize = 64;

/// What kind of node a value is, without projecting it.
///
/// Used to report a field whose shape is not the one the schema expects — a
/// `trigger` holding a sequence, say — without having to embed the whole value
/// in the diagnostic.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum ValueKind {
    /// A scalar of any of the five styles.
    Scalar,
    /// A block or flow sequence.
    Sequence,
    /// A block or flow mapping.
    Mapping,
    /// An alias reference (`*name`). Its value lives elsewhere in the document.
    Alias,
    /// A whole document, or a node kind the projection has no name for.
    Other,
}

impl ValueKind {
    /// Classifies a node kind.
    pub fn of(kind: NodeKind) -> ValueKind {
        match kind {
            NodeKind::Scalar => ValueKind::Scalar,
            NodeKind::Sequence => ValueKind::Sequence,
            NodeKind::Mapping => ValueKind::Mapping,
            NodeKind::Alias => ValueKind::Alias,
            NodeKind::Document => ValueKind::Other,
        }
    }

    /// Classifies the node `id` names, or [`ValueKind::Other`] when it is
    /// unknown to `index`.
    pub fn of_node(index: &SyntaxIndex, id: NodeId) -> ValueKind {
        index
            .node(id)
            .map_or(ValueKind::Other, |node| ValueKind::of(node.kind))
    }
}

/// An alias reference, projected without following it.
///
/// The projection deliberately does **not** resolve an alias to its anchor's
/// value: doing so would show the user text that is not written where they are
/// looking. `HazardKind::AliasReference` already refuses every edit near one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AliasView {
    /// The alias node's byte span.
    pub span: ByteSpan,
    /// The source node.
    pub node: NodeId,
}

/// One entry of a shallowly projected mapping.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FieldView {
    /// The key, when it is a scalar.
    ///
    /// `None` for a non-scalar key — an alias, or a collection used as a key.
    /// Such a key cannot be named by a [`crate::patch::DocumentPath`] segment
    /// and is therefore unaddressable, but it is still *recorded*: the entry
    /// exists in this list either way.
    pub key: Option<ScalarView>,
    /// The key node, scalar or not. Always present, and the identity the
    /// coverage accounting uses.
    pub key_node: NodeId,
    /// The value.
    pub value: ValueView,
}

/// A value of the source, projected without interpretation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ValueView {
    /// A scalar, as source text (D2u).
    Scalar(ScalarView),
    /// A sequence, in source order.
    Sequence(Vec<ValueView>),
    /// A mapping, in source order. Key order is preserved because espanso
    /// config is read by humans and reordering it is a change.
    Mapping(Vec<FieldView>),
    /// An alias reference, unfollowed.
    Alias(AliasView),
    /// The node exists but the projection stopped here.
    ///
    /// Two reasons, both recorded as a diagnostic by the caller: the value
    /// nests deeper than [`MAX_VALUE_DEPTH`], or its node is not in the index.
    Elided {
        /// What the elided node is.
        kind: ValueKind,
        /// Its byte span.
        span: ByteSpan,
        /// Its source node.
        node: NodeId,
    },
}

/// How a [`ValueView::project`] call ended, beyond the value itself.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ValueProjection {
    /// Nodes at which the depth limit stopped the descent.
    ///
    /// Empty for every document either corpus holds; a non-empty list is what
    /// the caller turns into [`crate::model::DiagnosticCode::ValueTooDeep`].
    pub too_deep: Vec<NodeId>,
    /// Scalars whose bytes could not be decoded.
    pub not_decodable: Vec<NodeId>,
}

impl ValueProjection {
    /// Folds another projection's findings into this one.
    fn absorb(&mut self, other: ValueProjection) {
        self.too_deep.extend(other.too_deep);
        self.not_decodable.extend(other.not_decodable);
    }
}

impl ValueView {
    /// Projects the node `id` names, shallowly and completely.
    ///
    /// Returns the value plus whatever the descent had to give up on. An
    /// identifier the index does not know yields [`ValueView::Elided`] rather
    /// than an error: a caller holding a stale identifier deserves an empty
    /// pane, not a panic.
    pub fn project(source: &str, index: &SyntaxIndex, id: NodeId) -> (ValueView, ValueProjection) {
        let mut findings = ValueProjection::default();
        let value = project_at(source, index, id, 0, &mut findings);
        (value, findings)
    }

    /// The byte span of the node this value projects.
    pub fn span(&self) -> ByteSpan {
        match self {
            ValueView::Scalar(scalar) => scalar.span,
            ValueView::Alias(alias) => alias.span,
            ValueView::Elided { span, .. } => *span,
            ValueView::Sequence(items) => hull(items.iter().map(ValueView::span)),
            ValueView::Mapping(fields) => hull(fields.iter().map(|field| field.value.span())),
        }
    }

    /// The scalar this value is, or `None` for every other shape.
    pub fn as_scalar(&self) -> Option<&ScalarView> {
        match self {
            ValueView::Scalar(scalar) => Some(scalar),
            _ => None,
        }
    }

    /// The sequence items this value holds, or `None` for every other shape.
    pub fn as_sequence(&self) -> Option<&[ValueView]> {
        match self {
            ValueView::Sequence(items) => Some(items),
            _ => None,
        }
    }

    /// The mapping entries this value holds, or `None` for every other shape.
    pub fn as_mapping(&self) -> Option<&[FieldView]> {
        match self {
            ValueView::Mapping(fields) => Some(fields),
            _ => None,
        }
    }

    /// Appends every scalar in this value, in source order, to `out`.
    ///
    /// The traversal the "no projected scalar is type-inferred" oracle walks;
    /// keeping it on the type rather than in the test is R24's rule applied —
    /// a test that had its own traversal could miss exactly the branch it was
    /// meant to check.
    pub fn collect_scalars<'a>(&'a self, out: &mut Vec<&'a ScalarView>) {
        match self {
            ValueView::Scalar(scalar) => out.push(scalar),
            ValueView::Sequence(items) => {
                for item in items {
                    item.collect_scalars(out);
                }
            }
            ValueView::Mapping(fields) => {
                for field in fields {
                    if let Some(key) = &field.key {
                        out.push(key);
                    }
                    field.value.collect_scalars(out);
                }
            } // End of the mapping arm
            ValueView::Alias(_) | ValueView::Elided { .. } => {}
        }
    } // End of function collect_scalars()

    /// Appends the **key node** of every mapping entry in this value, at every
    /// depth, to `out`.
    ///
    /// A shallow projection names every key it carries, so those keys are
    /// accounted for even though no [`crate::model::MappingCoverage`] record
    /// exists for a mapping reached this way. This traversal is what
    /// [`crate::model::DocumentView::named_key_nodes`] uses to say so.
    pub fn collect_key_nodes(&self, out: &mut Vec<NodeId>) {
        match self {
            ValueView::Sequence(items) => {
                for item in items {
                    item.collect_key_nodes(out);
                }
            }
            ValueView::Mapping(fields) => {
                for field in fields {
                    out.push(field.key_node);
                    field.value.collect_key_nodes(out);
                }
            } // End of the mapping arm
            ValueView::Scalar(_) | ValueView::Alias(_) | ValueView::Elided { .. } => {}
        }
    } // End of function collect_key_nodes()
} // End of impl ValueView

/// The smallest span covering every span in `spans`, or an empty span.
fn hull(spans: impl Iterator<Item = ByteSpan>) -> ByteSpan {
    let mut result: Option<ByteSpan> = None;
    for span in spans {
        result = Some(match result {
            None => span,
            Some(current) => ByteSpan {
                start: current.start.min(span.start),
                end: current.end.max(span.end),
            },
        });
    }
    result.unwrap_or_default()
} // End of function hull()

/// One level of [`ValueView::project`]'s descent.
fn project_at(
    source: &str,
    index: &SyntaxIndex,
    id: NodeId,
    depth: usize,
    findings: &mut ValueProjection,
) -> ValueView {
    let Some(node) = index.node(id) else {
        return ValueView::Elided {
            kind: ValueKind::Other,
            span: ByteSpan::default(),
            node: id,
        };
    };
    if depth >= MAX_VALUE_DEPTH {
        findings.too_deep.push(id);
        return ValueView::Elided {
            kind: ValueKind::of(node.kind),
            span: node.span,
            node: id,
        };
    }

    match node.kind {
        NodeKind::Scalar => match ScalarView::project(source, node) {
            Some(scalar) => {
                if !scalar.decoded {
                    findings.not_decodable.push(id);
                }
                ValueView::Scalar(scalar)
            }
            None => ValueView::Elided {
                kind: ValueKind::Scalar,
                span: node.span,
                node: id,
            },
        },
        NodeKind::Alias => ValueView::Alias(AliasView {
            span: node.span,
            node: id,
        }),
        NodeKind::Sequence => {
            let items = node
                .children
                .iter()
                .map(|&child| project_at(source, index, child, depth + 1, findings))
                .collect();
            ValueView::Sequence(items)
        }
        NodeKind::Mapping => {
            ValueView::Mapping(project_mapping(source, index, node.id, depth + 1, findings))
        }
        NodeKind::Document => ValueView::Elided {
            kind: ValueKind::Other,
            span: node.span,
            node: id,
        },
    }
} // End of function project_at()

/// Projects every entry of the mapping `id` names, in source order.
fn project_mapping(
    source: &str,
    index: &SyntaxIndex,
    id: NodeId,
    depth: usize,
    findings: &mut ValueProjection,
) -> Vec<FieldView> {
    let mut fields = Vec::new();
    for (key_node, value_node) in mapping_entries(index, id) {
        let key = index
            .node(key_node)
            .and_then(|node| ScalarView::project(source, node));
        if key.as_ref().is_some_and(|scalar| !scalar.decoded) {
            findings.not_decodable.push(key_node);
        }
        let mut nested = ValueProjection::default();
        let value = project_at(source, index, value_node, depth, &mut nested);
        findings.absorb(nested);
        fields.push(FieldView {
            key,
            key_node,
            value,
        });
    } // End of the loop over the mapping's entries
    fields
} // End of function project_mapping()

/// The key/value pairs of the mapping `id` names, in source order.
///
/// A mapping's children are the flat alternating key/value list the substrate
/// emits, exactly as `crate::patch::path` reads them. An odd trailing child
/// cannot come from a successful parse — an entry with no value gets a
/// zero-width scalar — and is dropped here rather than panicked on, which is
/// what keeps this total.
pub fn mapping_entries(index: &SyntaxIndex, id: NodeId) -> Vec<(NodeId, NodeId)> {
    let Some(node) = index.node(id) else {
        return Vec::new();
    };
    if node.kind != NodeKind::Mapping {
        return Vec::new();
    }
    node.children
        .chunks(2)
        .filter_map(|pair| match (pair.first(), pair.get(1)) {
            (Some(&key), Some(&value)) => Some((key, value)),
            _ => None,
        })
        .collect()
} // End of function mapping_entries()
