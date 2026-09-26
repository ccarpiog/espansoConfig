//! Phase 4-3 acceptance: presence and location metadata below the match mapping.
//!
//! An empty projected vector is no authority to insert a container or an entry:
//! `vars: []`, an absent `vars` and a `vars` holding a scalar all project as no
//! variables. The presences added in Phase 4-3 are what tell those states apart,
//! and this file drives **all four states** — absent, empty, supported and
//! unsupported shape — for every container the step names: `vars`, `params`,
//! `depends_on`, shorthand `form_fields`, verbose `params.fields`, a kind's list
//! parameter, and a form field's option mapping and its `values` list.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).

use espansoconfig_core::model::{
    DocumentContext, FormFieldShape, MappingPresence, MatchView, SequencePresence, ValueKind,
    VariableView,
};
use espansoconfig_core::patch::DocumentPath;
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::DocumentId;

/// Four matches and eight variables holding every state of every container.
const SHAPES: &str = "\
# Nested presence states (Phase 4-3). Neutral content only.
matches:
  - trigger: ':absent'
    replace: nothing nested
  - trigger: ':empty'
    replace: empty containers
    vars: []
    form_fields: {}
  - trigger: ':supported'
    form: 'P [[p]] Q [[q]] R [[r]]'
    form_fields:
      p:
        type: list
        values: []
      q: {type: choice, values: [one, two]}
      r: plain text
    vars:
      - name: bare
        type: echo
      - name: hollow
        type: choice
        depends_on: []
        params: {}
      - name: draw
        type: random
        depends_on:
          - bare
        params:
          choices: [x, y]
      - name: run
        type: script
        depends_on: not a list
        params: not a mapping
      - name: ask
        type: form
        params:
          layout: 'A [[a]] B [[b]] C [[c]]'
          fields:
            a:
              type: choice
              values:
                - first
                - second
            b:
              multiline: true
            c: just text
      - name: brace
        type: form
        params: {layout: 'L'}
      - name: block
        type: choice
        params:
          values: |
            first
            second
      - name: stamp
        type: date
        params:
          format: '%H'
  - trigger: ':unsupported'
    replace: odd containers
    vars: not a list
    form_fields:
      - not a mapping
";

/// Every match of [`SHAPES`], projected as the workspace projects it.
fn matches() -> Vec<MatchView> {
    let context = DocumentContext::detached(DocumentId(0), "presence.yml");
    project_source(&context, SHAPES).view.matches
}

/// The path of the match at `index`.
fn match_path(index: usize) -> DocumentPath {
    DocumentPath::root(0).with_key("matches").with_index(index)
}

/// The path of variable `variable` of the match at `index`.
fn variable_path(index: usize, variable: usize) -> DocumentPath {
    match_path(index).with_key("vars").with_index(variable)
}

/// The variable at `variable` of the third match.
fn variable(views: &[MatchView], variable: usize) -> &VariableView {
    &views[2].vars[variable]
}

/// The path a presence's location carries, or `None` when it is absent.
fn path_of_sequence(presence: &SequencePresence) -> Option<DocumentPath> {
    presence
        .location()
        .and_then(|location| location.path.clone())
}

/// The path a mapping presence's location carries, or `None` when it is absent.
fn path_of_mapping(presence: &MappingPresence) -> Option<DocumentPath> {
    presence
        .location()
        .and_then(|location| location.path.clone())
}

#[test]
fn vars_has_four_states_that_an_empty_vector_cannot_tell_apart() {
    let views = matches();
    assert!(views[0].vars.is_empty() && views[1].vars.is_empty() && views[3].vars.is_empty());
    assert_eq!(views[0].vars_presence, SequencePresence::Absent {});
    assert!(matches!(
        views[1].vars_presence,
        SequencePresence::Empty { .. }
    ));
    assert!(matches!(
        views[2].vars_presence,
        SequencePresence::Items {
            flow: false,
            count: 8,
            ..
        }
    ));
    assert!(matches!(
        views[3].vars_presence,
        SequencePresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        }
    ));
    for (index, view) in views.iter().enumerate().skip(1) {
        assert_eq!(
            path_of_sequence(&view.vars_presence),
            Some(match_path(index).with_key("vars")),
            "the location names the `vars` value of match {index}"
        );
    }
} // End of function vars_has_four_states_that_an_empty_vector_cannot_tell_apart()

#[test]
fn form_fields_has_four_states_and_one_shape_per_definition() {
    let views = matches();
    assert_eq!(views[0].form_fields_presence, MappingPresence::Absent {});
    assert!(matches!(
        views[1].form_fields_presence,
        MappingPresence::Empty { .. }
    ));
    assert!(matches!(
        views[2].form_fields_presence,
        MappingPresence::Entries {
            flow: false,
            count: 3,
            ..
        }
    ));
    assert!(matches!(
        views[3].form_fields_presence,
        MappingPresence::UnsupportedShape {
            found: ValueKind::Sequence,
            ..
        }
    ));
    assert!(views[1].form_field_shapes.is_empty());
    assert!(views[3].form_field_shapes.is_empty());

    let shapes = &views[2].form_field_shapes;
    assert_eq!(
        shapes.len(),
        views[2].form_fields.len(),
        "parallel to the entries"
    );
    let fields = match_path(2).with_key("form_fields");
    assert!(matches!(
        shapes[0],
        FormFieldShape {
            options: MappingPresence::Entries {
                flow: false,
                count: 2,
                ..
            },
            values: SequencePresence::Empty { .. },
        }
    ));
    assert_eq!(
        path_of_sequence(&shapes[0].values),
        Some(fields.clone().with_key("p").with_key("values"))
    );
    assert!(matches!(
        shapes[1],
        FormFieldShape {
            options: MappingPresence::Entries {
                flow: true,
                count: 2,
                ..
            },
            values: SequencePresence::Items {
                flow: true,
                count: 2,
                ..
            },
        }
    ));
    assert!(matches!(
        shapes[2],
        FormFieldShape {
            options: MappingPresence::UnsupportedShape {
                found: ValueKind::Scalar,
                ..
            },
            values: SequencePresence::Absent {},
        }
    ));
    assert_eq!(
        path_of_mapping(&shapes[2].options),
        Some(fields.with_key("r"))
    );
} // End of function form_fields_has_four_states_and_one_shape_per_definition()

#[test]
fn params_and_depends_on_have_four_states_each() {
    let views = matches();
    let (bare, hollow, draw, run) = (
        variable(&views, 0),
        variable(&views, 1),
        variable(&views, 2),
        variable(&views, 3),
    );
    assert!(bare.params.is_empty() && hollow.params.is_empty() && run.params.is_empty());
    assert_eq!(bare.params_presence, MappingPresence::Absent {});
    assert!(matches!(
        hollow.params_presence,
        MappingPresence::Empty { .. }
    ));
    assert!(matches!(
        draw.params_presence,
        MappingPresence::Entries {
            flow: false,
            count: 1,
            ..
        }
    ));
    assert!(matches!(
        run.params_presence,
        MappingPresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        }
    ));
    assert!(matches!(
        variable(&views, 5).params_presence,
        MappingPresence::Entries { flow: true, .. }
    ));
    assert_eq!(
        path_of_mapping(&run.params_presence),
        Some(variable_path(2, 3).with_key("params"))
    );

    assert!(
        bare.depends_on.is_empty() && hollow.depends_on.is_empty() && run.depends_on.is_empty()
    );
    assert_eq!(bare.depends_on_presence, SequencePresence::Absent {});
    assert!(matches!(
        hollow.depends_on_presence,
        SequencePresence::Empty { .. }
    ));
    assert!(matches!(
        draw.depends_on_presence,
        SequencePresence::Items {
            flow: false,
            count: 1,
            ..
        }
    ));
    assert!(matches!(
        run.depends_on_presence,
        SequencePresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        }
    ));
    assert_eq!(
        path_of_sequence(&draw.depends_on_presence),
        Some(variable_path(2, 2).with_key("depends_on"))
    );
} // End of function params_and_depends_on_have_four_states_each()

#[test]
fn a_kinds_list_parameter_has_four_states_and_other_kinds_have_none() {
    let views = matches();
    // `choice` over `params: {}`, `random` with a flow list, `script` over a
    // scalar `params`, `choice` whose `values` is a block string.
    assert_eq!(
        variable(&views, 1).list_param_presence,
        Some(SequencePresence::Absent {})
    );
    assert!(matches!(
        variable(&views, 2).list_param_presence,
        Some(SequencePresence::Items {
            flow: true,
            count: 2,
            ..
        })
    ));
    assert_eq!(
        path_of_sequence(
            variable(&views, 2)
                .list_param_presence
                .as_ref()
                .expect("random")
        ),
        Some(variable_path(2, 2).with_key("params").with_key("choices"))
    );
    assert_eq!(
        variable(&views, 3).list_param_presence,
        Some(SequencePresence::Absent {})
    );
    assert!(matches!(
        variable(&views, 6).list_param_presence,
        Some(SequencePresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        })
    ));
    // `echo`, `form` and `date` hold no list parameter at all.
    for index in [0, 4, 5, 7] {
        assert_eq!(
            variable(&views, index).list_param_presence,
            None,
            "variable {index}"
        );
    }

    // An empty list parameter, for the fourth state.
    let context = DocumentContext::detached(DocumentId(0), "empty-list.yml");
    let view = project_source(
        &context,
        "matches:\n  - trigger: a\n    replace: b\n    vars:\n      - name: r\n        type: random\n        params:\n          choices: []\n",
    )
    .view;
    assert!(matches!(
        view.matches[0].vars[0].list_param_presence,
        Some(SequencePresence::Empty { .. })
    ));
} // End of function a_kinds_list_parameter_has_four_states_and_other_kinds_have_none()

#[test]
fn verbose_form_fields_have_their_presence_and_one_shape_per_definition() {
    let views = matches();
    let ask = variable(&views, 4);
    assert!(matches!(
        ask.fields_presence,
        Some(MappingPresence::Entries {
            flow: false,
            count: 3,
            ..
        })
    ));
    let fields = variable_path(2, 4).with_key("params").with_key("fields");
    assert_eq!(
        path_of_mapping(ask.fields_presence.as_ref().expect("a form")),
        Some(fields.clone())
    );
    assert_eq!(ask.field_shapes.len(), 3);
    assert!(matches!(
        ask.field_shapes[0],
        FormFieldShape {
            options: MappingPresence::Entries { .. },
            values: SequencePresence::Items {
                flow: false,
                count: 2,
                ..
            },
        }
    ));
    assert_eq!(
        path_of_sequence(&ask.field_shapes[0].values),
        Some(fields.with_key("a").with_key("values"))
    );
    assert_eq!(ask.field_shapes[1].values, SequencePresence::Absent {});
    assert!(matches!(
        ask.field_shapes[2].options,
        MappingPresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        }
    ));

    // A form whose `params` holds no `fields` has an absent one; a kind that is
    // not `form` has none to describe.
    assert_eq!(
        variable(&views, 5).fields_presence,
        Some(MappingPresence::Absent {})
    );
    assert!(variable(&views, 5).field_shapes.is_empty());
    assert_eq!(variable(&views, 1).fields_presence, None);
    assert_eq!(variable(&views, 7).fields_presence, None);

    // `fields: {}` and `fields` holding a scalar, for the two remaining states.
    let context = DocumentContext::detached(DocumentId(0), "fields.yml");
    let view = project_source(
        &context,
        "matches:\n  - trigger: a\n    replace: b\n    vars:\n      - name: f\n        type: form\n        params:\n          layout: x\n          fields: {}\n      - name: g\n        type: form\n        params:\n          layout: y\n          fields: none\n",
    )
    .view;
    let vars = &view.matches[0].vars;
    assert!(matches!(
        vars[0].fields_presence,
        Some(MappingPresence::Empty { .. })
    ));
    assert!(matches!(
        vars[1].fields_presence,
        Some(MappingPresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        })
    ));
} // End of function verbose_form_fields_have_their_presence_and_one_shape_per_definition()

#[test]
fn a_presence_describes_the_first_of_a_repeated_key() {
    // A repeated key is a hazard, so the match is not editable; the presence
    // still describes the occurrence the projection and the resolver address.
    let context = DocumentContext::detached(DocumentId(0), "repeat.yml");
    let view = project_source(
        &context,
        "matches:\n  - trigger: a\n    replace: b\n    vars:\n      - name: r\n        type: random\n        params:\n          choices: []\n          choices: [x]\n",
    )
    .view;
    assert!(matches!(
        view.matches[0].vars[0].list_param_presence,
        Some(SequencePresence::Empty { .. })
    ));
} // End of function a_presence_describes_the_first_of_a_repeated_key()

/// The 4-3 review's second finding: a container key whose **first** occurrence
/// has an unsupported shape. Failed first on the unfixed tree: the later
/// `params: {echo: x}` overwrote `params_presence` and the projected entries.
#[test]
fn the_first_occurrence_of_a_container_governs_even_when_unsupported() {
    let context = DocumentContext::detached(DocumentId(0), "first.yml");
    let view = project_source(
        &context,
        "matches:\n  - trigger: a\n    replace: b\n    vars: not a list\n    vars:\n      - name: late\n        type: echo\n    form_fields: nope\n    form_fields:\n      f:\n        type: text\n  - trigger: c\n    replace: d\n    vars:\n      - name: v\n        type: random\n        params: scalar\n        params: {choices: [x]}\n        depends_on: none\n        depends_on: [v]\n",
    )
    .view;
    let first = &view.matches[0];
    assert!(matches!(
        first.vars_presence,
        SequencePresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        }
    ));
    assert!(
        first.vars.is_empty(),
        "the later `vars` is not projected in its place"
    );
    assert!(matches!(
        first.form_fields_presence,
        MappingPresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        }
    ));
    assert!(first.form_fields.is_empty() && first.form_field_shapes.is_empty());

    let variable = &view.matches[1].vars[0];
    assert!(matches!(
        variable.params_presence,
        MappingPresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        }
    ));
    assert!(
        variable.params.is_empty(),
        "the later `params` is not projected in its place"
    );
    assert_eq!(
        variable.list_param_presence,
        Some(SequencePresence::Absent {})
    );
    assert!(matches!(
        variable.depends_on_presence,
        SequencePresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        }
    ));
    assert!(variable.depends_on.is_empty());
    // The later occurrences are carried as repeated keys, never dropped.
    use espansoconfig_core::model::UnknownReason;
    let repeated = |entries: &[espansoconfig_core::model::UnknownEntry], key: &str| {
        entries.iter().any(|entry| {
            entry.key.as_deref() == Some(key) && entry.reason == UnknownReason::RepeatedKey
        })
    };
    assert!(repeated(&first.unknown_entries, "vars"));
    assert!(repeated(&first.unknown_entries, "form_fields"));
    assert!(repeated(&variable.unknown_entries, "params"));
    assert!(repeated(&variable.unknown_entries, "depends_on"));
} // End of function the_first_occurrence_of_a_container_governs_even_when_unsupported()
