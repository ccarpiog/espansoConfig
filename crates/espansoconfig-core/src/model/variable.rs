//! Espanso variables — the nine types of plan section 3.4.
//!
//! A variable is a mapping with `name`, `type`, an optional `params`, and the
//! two fields every type accepts, `inject_vars` and `depends_on`. `params` is
//! where the nine types differ, so it is projected shallowly and completely
//! (see [`crate::model::ValueView`]): every parameter espanso adds in a future
//! release survives without this module knowing its name.
//!
//! [`VariableKind`] classifies the `type` field's **text**. That is a string
//! comparison against espanso's own vocabulary, not a YAML type inference, so
//! it does not touch D2u: the authoritative value stays in
//! [`VariableView::declared_type`] as source text, and an unrecognised spelling
//! becomes [`VariableKind::Unrecognised`] rather than being coerced.

use serde::{Deserialize, Serialize};

use crate::model::project::{child_path, Projector};
use crate::model::{
    DiagnosticCode, FieldView, FormFieldShape, MappingPresence, MappingScan, ScalarView,
    SequencePresence, UnknownEntry, ValueView,
};
use crate::patch::DocumentPath;
use crate::syntax::{ByteSpan, NodeId};

/// The keys [`VariableView`] models. Anything else becomes an
/// [`UnknownEntry`].
const MODELLED_KEYS: [&str; 5] = ["name", "type", "params", "inject_vars", "depends_on"];

/// The container keys of a variable whose presence the projection carries
/// (Phase 4-3): `params` and `depends_on`.
const VARIABLE_CONTAINERS: [&str; 2] = ["params", "depends_on"];

/// Records `key` as met and answers whether it had been met already.
///
/// The **first** occurrence of a container key governs its presence, its
/// projected entries and every nested presence read inside it, whether or not it
/// had a shape the projection models (the 4-3 review's second finding). A
/// modelled first occurrence is also claimed on the scan; one with an
/// unsupported shape is not, which is why this list exists beside the claim.
/// Keys outside `containers` are never recorded and always answer `false`.
pub(crate) fn first_container_seen_before(
    seen: &mut Vec<String>,
    containers: &[&str],
    key: &str,
) -> bool {
    if !containers.contains(&key) {
        return false;
    }
    if seen.iter().any(|held| held == key) {
        return true;
    }
    seen.push(key.to_owned());
    false
} // End of function first_container_seen_before()

/// Records a later occurrence of a container key whose first occurrence had an
/// unsupported shape: an unknown entry with [`crate::model::UnknownReason::RepeatedKey`]
/// and a [`DiagnosticCode::RepeatedKey`], exactly as a repeat of a modelled key
/// is recorded, so the later value is carried but never projected in its place.
pub(crate) fn skip_repeated_container(
    projector: &mut Projector<'_>,
    scan: &mut MappingScan,
    key_node: NodeId,
    key: &str,
    value_node: NodeId,
) {
    projector.diagnose_at(
        DiagnosticCode::RepeatedKey {
            key: key.to_owned(),
        },
        key_node,
    );
    scan.skip(
        projector.source,
        projector.index,
        key_node,
        Some(key),
        value_node,
        crate::model::UnknownReason::RepeatedKey,
    );
} // End of function skip_repeated_container()

/// Which of espanso's nine variable types a `type` field names.
///
/// A classification of the field's text, never of a YAML scalar's type.
///
/// **It deserializes as well as serializes, since Phase 2b-2a**, and the reason
/// is one level up: it is an operand of
/// [`crate::validate::FindingCode::VariableMissingRequiredParam`], so an
/// acknowledgement travelling *back* from the interface carries one. Reading a
/// kind back in is a claim about a wire word, never about a YAML value — the
/// classification of a document's own text still happens exactly once, in
/// [`VariableKind::from_text`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum VariableKind {
    /// `date` — `format`, `offset`, `tz`, `locale`.
    Date,
    /// `choice` — `values`, as strings or `{label, id}` objects.
    Choice,
    /// `random` — `choices`.
    Random,
    /// `clipboard` — no parameters.
    Clipboard,
    /// `echo` — `echo`.
    Echo,
    /// `shell` — `cmd`, `shell`, `trim`, `debug`.
    Shell,
    /// `script` — `args`, `trim`.
    Script,
    /// `form` — `layout`, `fields`.
    Form,
    /// `match` — `params.trigger`, a nested match reference.
    Match,
    /// The `type` field is present but names none of the nine.
    Unrecognised,
    /// The variable has no `type` field at all.
    Absent,
}

impl VariableKind {
    /// Classifies a `type` field's text.
    pub fn from_text(text: &str) -> VariableKind {
        match text {
            "date" => VariableKind::Date,
            "choice" => VariableKind::Choice,
            "random" => VariableKind::Random,
            "clipboard" => VariableKind::Clipboard,
            "echo" => VariableKind::Echo,
            "shell" => VariableKind::Shell,
            "script" => VariableKind::Script,
            "form" => VariableKind::Form,
            "match" => VariableKind::Match,
            _ => VariableKind::Unrecognised,
        }
    } // End of function from_text()

    /// Returns `true` when this type runs a command on the user's machine.
    ///
    /// The two the snippet list badges, because they are the two a reader
    /// should look at twice before trusting a file someone sent them.
    pub fn runs_a_command(self) -> bool {
        matches!(self, VariableKind::Shell | VariableKind::Script)
    }

    /// The `params` key holding this kind's one schema-known **list**
    /// parameter, or `None` for a kind that has none (Phase 4-3).
    ///
    /// `choice` → `values`, `random` → `choices`, `script` → `args`. A verbose
    /// form's `fields` is a mapping and is described separately
    /// ([`VariableView::fields_presence`]).
    pub fn list_param_key(self) -> Option<&'static str> {
        match self {
            VariableKind::Choice => Some("values"),
            VariableKind::Random => Some("choices"),
            VariableKind::Script => Some("args"),
            _ => None,
        }
    } // End of function list_param_key()
}

/// One variable of a `vars` or `global_vars` sequence.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct VariableView {
    /// The mapping node this variable projects.
    pub node: NodeId,
    /// The path naming it, when the containing document has one.
    pub path: Option<DocumentPath>,
    /// Its byte span.
    pub span: ByteSpan,
    /// `name`, as source text.
    pub name: Option<ScalarView>,
    /// `type`, as source text. The authoritative value; [`VariableView::kind`]
    /// is a classification of it.
    pub declared_type: Option<ScalarView>,
    /// Which of the nine types [`VariableView::declared_type`] names.
    pub kind: VariableKind,
    /// `params`, projected shallowly and completely.
    pub params: Vec<FieldView>,
    /// Whether `params` is written at all, and in what shape (Phase 4-3).
    ///
    /// [`VariableView::params`] is empty for an absent key, for `params: {}` and
    /// for a `params` holding a scalar; this is what tells the three apart.
    pub params_presence: MappingPresence,
    /// `depends_on`, one item per source entry, in source order.
    ///
    /// Every item is a [`ValueView::Scalar`] or a [`ValueView::Elided`]: an
    /// entry the schema says is a string but the file writes as a collection is
    /// elided **in place**, never dropped, so positions never shift.
    pub depends_on: Vec<ValueView>,
    /// Whether `depends_on` is written at all, and in what shape (Phase 4-3;
    /// computed and discarded before it).
    pub depends_on_presence: SequencePresence,
    /// The presence of this kind's one schema-known list parameter
    /// ([`VariableKind::list_param_key`]: `params.values`, `params.choices` or
    /// `params.args`), or `None` for a kind that has none (Phase 4-3).
    ///
    /// [`SequencePresence::Absent`] when `params` is not a mapping or holds no
    /// such key. A `choice` list of `{label, id}` records is
    /// [`SequencePresence::Items`] too: this is the container, not its items.
    pub list_param_presence: Option<SequencePresence>,
    /// The presence of a verbose form's `params.fields`, or `None` for a
    /// variable whose kind is not `form` (Phase 4-3).
    pub fields_presence: Option<MappingPresence>,
    /// One shape per entry of a verbose form's `params.fields`, in source order
    /// and parallel to that mapping's entries (Phase 4-3). Empty when
    /// [`VariableView::fields_presence`] is not a mapping with entries.
    pub field_shapes: Vec<FormFieldShape>,
    /// `inject_vars`, as source text (D2u — never a `bool`).
    pub inject_vars: Option<ScalarView>,
    /// Entries this projection did not model, never discarded.
    pub unknown_entries: Vec<UnknownEntry>,
}

impl VariableView {
    /// Projects one item of a `vars` / `global_vars` sequence.
    ///
    /// An item that is not a mapping still yields a view — an empty one at that
    /// item's span, with [`DiagnosticCode::VariableIsNotAMapping`] recorded —
    /// so the list the UI renders always has one row per source entry.
    pub(crate) fn project(
        projector: &mut Projector<'_>,
        node: NodeId,
        path: Option<DocumentPath>,
    ) -> VariableView {
        let span = projector
            .index
            .node(node)
            .map(|n| n.span)
            .unwrap_or_default();
        if !projector.is_mapping(node) {
            let found = projector.kind_of(node);
            projector.diagnose_at(DiagnosticCode::VariableIsNotAMapping { found }, node);
            // Recorded by span and not descended into, so anything nested under
            // a malformed variable entry still lies inside a span the projection
            // named (see `DocumentView::unaccounted_keys`).
            projector.record_undescended(node);
            return VariableView::empty(node, path, span);
        }

        let mut scan = MappingScan::new(node, path.clone());
        let mut view = VariableView::empty(node, path.clone(), span);
        // The `params` mapping the walk modelled, when it modelled one: the
        // nested presences below are read inside it, and only after the walk,
        // because `type` may come after `params` in the file.
        let mut params_node: Option<NodeId> = None;
        // Every container key met so far, modelled or not (Phase 4-3 review).
        let mut containers_seen: Vec<String> = Vec::new();
        for (key_node, key, value_node) in projector.entries(node, &mut scan) {
            if scan.is_claimed(&key) {
                projector.skip_entry(&mut scan, key_node, &key, value_node, &MODELLED_KEYS);
                continue;
            }
            if first_container_seen_before(&mut containers_seen, &VARIABLE_CONTAINERS, &key) {
                skip_repeated_container(projector, &mut scan, key_node, &key, value_node);
                continue;
            }
            match key.as_str() {
                "name" => {
                    projector.scalar_field(&mut scan, key_node, &key, value_node, &mut view.name)
                }
                "type" => {
                    projector.scalar_field(
                        &mut scan,
                        key_node,
                        &key,
                        value_node,
                        &mut view.declared_type,
                    );
                    view.kind = match &view.declared_type {
                        Some(declared) => VariableKind::from_text(&declared.text),
                        None => VariableKind::Absent,
                    };
                }
                "params" => {
                    let params_path = child_path(&path, &key);
                    view.params_presence =
                        projector.mapping_presence(key_node, value_node, params_path);
                    if projector.is_mapping(value_node) {
                        if let ValueView::Mapping(fields) = projector.value(value_node) {
                            view.params = fields;
                        }
                        scan.model(key_node, &key);
                        params_node = Some(value_node);
                    } else {
                        projector.skip_shape(&mut scan, key_node, &key, value_node);
                    }
                }
                "depends_on" => projector.scalar_sequence_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    child_path(&path, &key),
                    &mut view.depends_on,
                    &mut view.depends_on_presence,
                ),
                "inject_vars" => projector.scalar_field(
                    &mut scan,
                    key_node,
                    &key,
                    value_node,
                    &mut view.inject_vars,
                ),
                _ => projector.skip_entry(&mut scan, key_node, &key, value_node, &MODELLED_KEYS),
            } // End of the match over the variable's modelled keys
        } // End of the loop over the variable mapping's entries

        view.describe_nested(projector, params_node);

        if view.name.is_none() {
            projector.diagnose_at(DiagnosticCode::VariableHasNoName, node);
        }
        if view.declared_type.is_none() {
            projector.diagnose_at(DiagnosticCode::VariableHasNoType, node);
        }
        view.unknown_entries = projector.close(scan);
        view
    } // End of function project()

    /// Fills the kind-dependent presences read **inside** `params` (Phase 4-3).
    ///
    /// `params_node` is the `params` mapping the walk modelled, or `None` when
    /// there is none — then every applicable presence is
    /// [`SequencePresence::Absent`] / [`MappingPresence::Absent`], because the
    /// key cannot be written inside a mapping that is not there.
    fn describe_nested(&mut self, projector: &Projector<'_>, params_node: Option<NodeId>) {
        let params_path = child_path(&self.path, "params");
        if let Some(key) = self.kind.list_param_key() {
            self.list_param_presence = Some(match params_node {
                Some(params) => projector.nested_sequence_presence(params, key, &params_path),
                None => SequencePresence::Absent {},
            });
        }
        if self.kind == VariableKind::Form {
            let fields = params_node.and_then(|params| projector.first_entry(params, "fields"));
            let presence = match fields {
                Some((key_node, value_node)) => projector.mapping_presence(
                    key_node,
                    value_node,
                    child_path(&params_path, "fields"),
                ),
                None => MappingPresence::Absent {},
            };
            if let (Some((_, value_node)), MappingPresence::Entries { .. }) = (fields, &presence) {
                let fields_path = child_path(&params_path, "fields");
                self.field_shapes = projector.form_field_shapes(value_node, &fields_path);
            }
            self.fields_presence = Some(presence);
        }
    } // End of function describe_nested()

    /// A view holding nothing but the node it failed to project.
    fn empty(node: NodeId, path: Option<DocumentPath>, span: ByteSpan) -> VariableView {
        VariableView {
            node,
            path,
            span,
            name: None,
            declared_type: None,
            kind: VariableKind::Absent,
            params: Vec::new(),
            params_presence: MappingPresence::Absent {},
            depends_on: Vec::new(),
            depends_on_presence: SequencePresence::Absent {},
            list_param_presence: None,
            fields_presence: None,
            field_shapes: Vec::new(),
            inject_vars: None,
            unknown_entries: Vec::new(),
        }
    } // End of function empty()

    /// Appends every scalar this view holds, in source order, to `out`.
    pub fn collect_scalars<'a>(&'a self, out: &mut Vec<&'a ScalarView>) {
        out.extend(self.name.iter());
        out.extend(self.declared_type.iter());
        for field in &self.params {
            if let Some(key) = &field.key {
                out.push(key);
            }
            field.value.collect_scalars(out);
        }
        for item in &self.depends_on {
            item.collect_scalars(out);
        }
        out.extend(self.inject_vars.iter());
    } // End of function collect_scalars()
} // End of impl VariableView

/// Projects a whole `vars` / `global_vars` sequence.
pub(crate) fn project_sequence(
    projector: &mut Projector<'_>,
    node: NodeId,
    path: &Option<DocumentPath>,
) -> Vec<VariableView> {
    let Some(items) = projector.sequence_items(node) else {
        return Vec::new();
    };
    items
        .into_iter()
        .enumerate()
        .map(|(position, item)| {
            let item_path = path.as_ref().map(|base| base.clone().with_index(position));
            VariableView::project(projector, item, item_path)
        })
        .collect()
} // End of function project_sequence()
