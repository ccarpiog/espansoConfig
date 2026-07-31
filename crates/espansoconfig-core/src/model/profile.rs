//! A `config/*.yml` profile, projected shallowly.
//!
//! Plan section 3.6 lists four filters, five scoping keys and *"~35 behaviour
//! options"* — a set that grows with every espanso release and that plan
//! section 12 does not put a UI on until Phase 5. Modelling each option by name
//! now would buy nothing Phase 1 uses and would guarantee that the next espanso
//! release adds an option this crate drops.
//!
//! So a profile is projected as its entries, in source order, with
//! [`crate::model::FieldView`] carrying every key and value. Nothing is
//! interpreted, so nothing is lost, and the well-known keys are reachable
//! through the accessors below rather than through a field per option.

use serde::Serialize;

use crate::model::project::Projector;
use crate::model::{FieldView, ScalarView, ValueView};
use crate::patch::DocumentPath;
use crate::syntax::NodeId;

/// The four filter keys of plan section 3.6, all regex-matched by espanso.
pub const FILTER_KEYS: [&str; 4] = ["filter_title", "filter_exec", "filter_class", "filter_os"];

/// The five scoping keys of plan section 3.6.
pub const SCOPING_KEYS: [&str; 5] = [
    "includes",
    "extra_includes",
    "excludes",
    "extra_excludes",
    "use_standard_includes",
];

/// One `config/*.yml` profile.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct ConfigProfileView {
    /// The root mapping node, or `None` when the document has no root.
    pub node: Option<NodeId>,
    /// Every entry of the profile, in source order.
    pub entries: Vec<FieldView>,
}

impl ConfigProfileView {
    /// Projects the profile whose root mapping is `node`.
    pub(crate) fn project(projector: &mut Projector<'_>, node: NodeId) -> ConfigProfileView {
        let entries = match projector.value(node) {
            ValueView::Mapping(fields) => fields,
            _ => Vec::new(),
        };
        ConfigProfileView {
            node: Some(node),
            entries,
        }
    }

    /// The value of `key`, or `None` when the profile does not hold it.
    ///
    /// The **first** occurrence wins, matching how
    /// `crate::patch::path::resolve` reads a mapping. A profile with a
    /// duplicated key already carries `HazardKind::DuplicateMappingKey`.
    pub fn get(&self, key: &str) -> Option<&ValueView> {
        self.entries
            .iter()
            .find(|entry| entry.key.as_ref().is_some_and(|scalar| scalar.text == key))
            .map(|entry| &entry.value)
    }

    /// The value of `key` when it is a scalar.
    pub fn scalar(&self, key: &str) -> Option<&ScalarView> {
        self.get(key).and_then(ValueView::as_scalar)
    }

    /// The filter keys this profile sets, in the order of [`FILTER_KEYS`].
    ///
    /// Only one profile is active at a time and ties break alphabetically by
    /// file name (plan section 3.6), so which filters a profile sets is the
    /// first thing its row in the sidebar has to say.
    pub fn filters(&self) -> Vec<(&'static str, &ScalarView)> {
        FILTER_KEYS
            .iter()
            .filter_map(|&key| self.scalar(key).map(|value| (key, value)))
            .collect()
    }

    /// The scoping keys this profile sets, in the order of [`SCOPING_KEYS`].
    pub fn scoping(&self) -> Vec<(&'static str, &ValueView)> {
        SCOPING_KEYS
            .iter()
            .filter_map(|&key| self.get(key).map(|value| (key, value)))
            .collect()
    }

    /// The path naming one of this profile's entries, under `base`.
    pub fn path_of(base: &DocumentPath, key: &str) -> DocumentPath {
        base.clone().with_key(key)
    }

    /// Appends every scalar this profile holds, in source order, to `out`.
    pub fn collect_scalars<'a>(&'a self, out: &mut Vec<&'a ScalarView>) {
        for entry in &self.entries {
            if let Some(key) = &entry.key {
                out.push(key);
            }
            entry.value.collect_scalars(out);
        }
    }
} // End of impl ConfigProfileView
