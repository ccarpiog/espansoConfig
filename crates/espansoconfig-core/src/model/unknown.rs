//! What the projection did not model, and the accounting that proves it did
//! not lose anything.
//!
//! Plan section 6.2: *"Unknown/unsupported entries are NEVER silently
//! discarded."* That sentence is easy to agree with and hard to check, because
//! the failure it forbids is invisible by definition — a dropped key leaves no
//! trace in the thing that dropped it.
//!
//! So the projection does not merely *promise* to record what it did not model:
//! for every mapping it walks it emits a [`MappingCoverage`], naming the key
//! node of every entry it modelled and the key node of every entry it did not.
//! [`MappingCoverage::accounts_for`] then checks that union against the
//! mapping's own children, in the library rather than only in a test — R24's
//! standing rule, which the corpus sweep re-derives independently on top.

use serde::Serialize;

use crate::model::{mapping_entries, ValueKind};
use crate::patch::DocumentPath;
use crate::syntax::{ByteSpan, NodeId, SyntaxIndex};

/// Why an entry was not modelled.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum UnknownReason {
    /// The projection has no field for this key. The common case, and the one
    /// a new espanso release produces: it is not an error, and the entry must
    /// survive every future edit untouched.
    NotModelled,
    /// The key is modelled but its value has a shape the schema does not use —
    /// a `trigger` holding a sequence, a `vars` holding a scalar.
    UnexpectedShape {
        /// What the value actually is.
        found: ValueKind,
    },
    /// The key is modelled and an earlier entry of the same mapping already
    /// claimed it. The mapping carries `HazardKind::DuplicateMappingKey` and is
    /// refused for editing, but the bytes are still shown.
    RepeatedKey,
    /// The key is not a scalar — an alias, or a collection used as a key — so
    /// no [`DocumentPath`] segment can name it.
    NonScalarKey,
}

/// One mapping entry the projection did not model.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UnknownEntry {
    /// The key's decoded text, or `None` for a non-scalar key.
    pub key: Option<String>,
    /// The key node. Always present — this is the identity the coverage
    /// accounting balances on.
    pub key_node: NodeId,
    /// The key's byte span.
    pub key_span: ByteSpan,
    /// The value's byte span, **whole and undescended**.
    ///
    /// The projection does not descend into an unmodelled value: a mapping
    /// under an unrecognised key keeps its own keys, and they are accounted for
    /// by lying inside *this* span rather than by being named individually (see
    /// [`crate::model::DocumentView::unaccounted_keys`]). Recording the whole
    /// value is what makes "nothing was discarded" checkable without modelling
    /// a schema nobody has written yet.
    pub value_span: ByteSpan,
    /// What the value is, unprojected.
    pub value_kind: ValueKind,
    /// The path that names this entry, or `None` when **no path can**.
    ///
    /// A named limit rather than an omission, and it has exactly two causes:
    ///
    /// - [`UnknownReason::NonScalarKey`] — a [`crate::patch::PathSegment`] is a
    ///   key *string* or an index, and a collection or an alias used as a key is
    ///   neither, so no segment can spell it;
    /// - [`UnknownReason::RepeatedKey`] — a path names the **first** entry with
    ///   that key (`crate::patch::path::resolve`'s rule), so the path that looks
    ///   like this entry's would resolve to the other one. Handing it out would
    ///   be worse than handing out nothing: it would address the wrong bytes.
    ///
    /// Both remain addressable *structurally* through [`UnknownEntry::key_node`]
    /// and the two spans, which is what an editor would actually mutate.
    pub path: Option<DocumentPath>,
    /// Why it was not modelled.
    pub reason: UnknownReason,
}

/// The modelled/unmodelled split of one mapping the projection walked.
///
/// Both vectors hold **key** node identifiers, because a key node is what a
/// mapping entry uniquely has: two entries can share a key *text* and even a
/// value span shape, but never a key node.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MappingCoverage {
    /// The mapping node.
    pub mapping: NodeId,
    /// The path naming the mapping, when it has one.
    pub path: Option<DocumentPath>,
    /// Key nodes of entries the projection modelled by name.
    pub modelled: Vec<NodeId>,
    /// Key nodes of entries recorded as [`UnknownEntry`]s.
    pub unknown: Vec<NodeId>,
}

impl MappingCoverage {
    /// Returns `true` when this record accounts for every entry of its mapping
    /// exactly once.
    ///
    /// Three conditions, all necessary:
    ///
    /// - every key node of the mapping appears in exactly one of the two lists;
    /// - neither list holds a key node the mapping does not have;
    /// - neither list holds a duplicate.
    ///
    /// A projection that dropped a key fails the first, one that invented an
    /// entry fails the second, and one that both modelled and recorded the same
    /// entry fails the third — which a plain count of `modelled + unknown`
    /// against the entry count would let through in pairs.
    pub fn accounts_for(&self, index: &SyntaxIndex) -> bool {
        let entries: Vec<NodeId> = mapping_entries(index, self.mapping)
            .into_iter()
            .map(|(key, _)| key)
            .collect();
        let mut claimed: Vec<NodeId> = self
            .modelled
            .iter()
            .chain(self.unknown.iter())
            .copied()
            .collect();
        claimed.sort_unstable();
        let before = claimed.len();
        claimed.dedup();
        if claimed.len() != before {
            return false;
        }
        let mut expected = entries;
        expected.sort_unstable();
        claimed == expected
    } // End of function accounts_for()
} // End of impl MappingCoverage

/// Builds the unknown/modelled split of one mapping as the projection walks it.
///
/// The partition is exact **by construction** rather than by later
/// reconciliation: `Projector::entries` hands each of a mapping's entries to
/// the caller exactly once, and each leaves through exactly one of
/// [`MappingScan::model`] or [`MappingScan::skip`]. That is what makes the
/// coverage record a fact about the walk rather than a summary written
/// afterwards from the same assumptions that could have lost the entry.
pub(crate) struct MappingScan {
    mapping: NodeId,
    path: Option<DocumentPath>,
    modelled: Vec<NodeId>,
    unknown: Vec<NodeId>,
    entries: Vec<UnknownEntry>,
    claimed: Vec<String>,
}

impl MappingScan {
    /// Starts a scan of the mapping `mapping` names.
    pub(crate) fn new(mapping: NodeId, path: Option<DocumentPath>) -> MappingScan {
        MappingScan {
            mapping,
            path,
            modelled: Vec::new(),
            unknown: Vec::new(),
            entries: Vec::new(),
            claimed: Vec::new(),
        }
    }

    /// Records that `key_node` was modelled under `key`.
    pub(crate) fn model(&mut self, key_node: NodeId, key: &str) {
        self.modelled.push(key_node);
        self.claimed.push(key.to_owned());
    }

    /// Returns `true` when a modelled field has already claimed `key`.
    pub(crate) fn is_claimed(&self, key: &str) -> bool {
        self.claimed.iter().any(|claimed| claimed == key)
    }

    /// How many entries have been modelled so far.
    ///
    /// Read either side of one entry, this says whether that entry was modelled
    /// or skipped — which is what decides whether it counts towards "exactly one
    /// trigger field". Asking the entry's own handler would mean every handler
    /// returning a flag nobody could forget to check; asking the scan cannot be
    /// forgotten, because the scan is the thing that recorded the answer.
    pub(crate) fn modelled_count(&self) -> usize {
        self.modelled.len()
    }

    /// Records that `key_node` was not modelled, and why.
    pub(crate) fn skip(
        &mut self,
        index: &SyntaxIndex,
        key_node: NodeId,
        key: Option<&str>,
        value_node: NodeId,
        reason: UnknownReason,
    ) {
        self.unknown.push(key_node);
        let key_span = index
            .node(key_node)
            .map(|node| node.span)
            .unwrap_or_default();
        let value_span = index
            .node(value_node)
            .map(|node| node.span)
            .unwrap_or_default();
        let path = match (key, &self.path, reason) {
            (Some(name), Some(base), UnknownReason::NotModelled)
            | (Some(name), Some(base), UnknownReason::UnexpectedShape { .. }) => {
                Some(base.clone().with_key(name))
            }
            _ => None,
        };
        self.entries.push(UnknownEntry {
            key: key.map(str::to_owned),
            key_node,
            key_span,
            value_span,
            value_kind: ValueKind::of_node(index, value_node),
            path,
            reason,
        });
    } // End of function skip()

    /// Ends the scan, yielding its coverage record and its unknown entries.
    pub(crate) fn finish(self) -> (MappingCoverage, Vec<UnknownEntry>) {
        (
            MappingCoverage {
                mapping: self.mapping,
                path: self.path,
                modelled: self.modelled,
                unknown: self.unknown,
            },
            self.entries,
        )
    }
} // End of impl MappingScan
