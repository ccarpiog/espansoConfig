//! Phase 4-6 acceptance: the form-definition structural core
//! (`docs/decisions/4-split-notes.md` §2, step 4-6).
//!
//! What this file pins, over the shorthand `form_fields` and the verbose
//! `params.fields`:
//!
//! - one intention writes the shorthand or the verbose shape, according to where
//!   it is carried, and never converts one into the other;
//! - a layout edit plus a field addition is one batch, in both shapes;
//! - deleting a definition touches only its owned span — its key, its options
//!   and the comments it owns — and nothing else;
//! - a scalar-list `values` and a multi-line-string `values` (both in
//!   `form-layout-and-choice.yml:43-54`) keep their representation;
//! - unsupported subtrees refuse structured rewriting, by name;
//! - a complete new verbose form — layout and definitions — is one description;
//! - every refusal carries positions and codes, never a name, key or value.
//!
//! # Privacy
//!
//! Every inline fixture is hand-authored and neutral, and the corpus fixture
//! read here is a committed synthetic one (`CLAUDE.md` section 1).

use espansoconfig_core::draft::{
    check_batch_independence, check_closed_surface, plan_match_edits, DraftError, DraftTarget,
    EntryDraft, FormFieldDraft, FormFieldIntent, FormOptions, FormOwner, FormValues,
    FormValuesIntent, ListPlacement, MatchDraft, MatchField, NewFormField, NewParam, NewVariable,
    ScalarItems, VariableDraft, VariableSetting, VarsIntent,
};
use espansoconfig_core::model::{
    DocumentContext, MappingPresence, MatchView, SequencePresence, ValueKind, ValueView,
};
use espansoconfig_core::patch::{
    apply_edits, DocumentEdit, DocumentPath, EntryValue, FieldInsertGroup, FieldRemoval,
    ItemPlacement, ItemValue, RemoveItem, ScalarEdit, ScalarItemInsert,
};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::DocumentId;

/// Five matches, each holding one form shape.
///
/// | Match | Shape |
/// |---|---|
/// | 0 `:short` | shorthand, three definitions: `alpha` (owns a comment; a block `values` list), `beta`, `gamma` (a text `values`) |
/// | 1 `:bare` | shorthand without `form_fields` |
/// | 2 `:verbose` | verbose `f` with two definitions; verbose `g` without `fields`; an `echo` |
/// | 3 `:odd` | shorthand `form_fields` written between braces |
/// | 4 `:scalar` | shorthand `form_fields` holding a scalar |
/// | 5 `:deep` | a definition holding a nested mapping, a flat one, one written between braces, one flow `values` |
const FORMS: &str = "\
# Form definitions (Phase 4-6). Neutral content only.
matches:
  - trigger: ':short'
    form: |
      A: [[alpha]]
      B: [[beta]]
    form_fields:
      # Owned by alpha.
      alpha:
        type: choice
        values:
          - one
          - two
      beta:
        multiline: true
      gamma:
        type: list
        values: |
          red
          green
        trim_string_values: true
  - trigger: ':bare'
    form: 'Name: [[name]]'
  - trigger: ':verbose'
    replace: '{{f.alpha}}'
    vars:
      - name: f
        type: form
        params:
          layout: 'A: [[alpha]]'
          fields:
            alpha:
              type: choice
              values:
                - one
                - two
            beta:
              default: x
      - name: g
        type: form
        params:
          layout: 'N: [[name]]'
      - name: e
        type: echo
        params:
          echo: hi
  - trigger: ':odd'
    form: 'x'
    form_fields: {a: {type: text}}
  - trigger: ':scalar'
    form: 'x'
    form_fields: nothing
  - trigger: ':deep'
    form: 'x'
    form_fields:
      nest:
        type: choice
        extra:
          inner: one
      flat:
        type: text
      braced: {type: text}
      flowing:
        values: [a, b]
";

/// The committed synthetic corpus fixture the acceptance names.
const CORPUS: &str = include_str!("corpus/synthetic/form-layout-and-choice.yml");

/// A text no refusal may echo.
const PRIVATE: &str = "zq-private";

/// Match `index` of `source`, projected as the workspace projects it.
fn the_match(source: &str, index: usize) -> MatchView {
    let context = DocumentContext::detached(DocumentId(0), "forms.yml");
    project_source(&context, source)
        .view
        .matches
        .into_iter()
        .nth(index)
        .expect("the fixture holds the match")
}

/// Plans `draft` against match `index` of `source` and applies it.
fn planned(source: &str, index: usize, draft: &MatchDraft) -> (Vec<DocumentEdit>, String) {
    let view = the_match(source, index);
    let edits = plan_match_edits(&view, draft).expect("the draft plans");
    let patched = apply_edits(source, &edits).expect("the batch applies");
    (edits, patched.text().to_owned())
} // End of function planned()

/// Plans `draft` against match `index` of `source` and returns the refusal.
fn refused(source: &str, index: usize, draft: &MatchDraft) -> DraftError {
    plan_match_edits(&the_match(source, index), draft).expect_err("the draft is refused")
}

/// `source` with its one occurrence of `from` replaced by `to`.
fn replaced(source: &str, from: &str, to: &str) -> String {
    assert_eq!(source.matches(from).count(), 1, "{from:?} occurs once");
    source.replacen(from, to, 1)
}

/// A draft of the shorthand form holding `intents`.
fn shorthand(intents: Vec<FormFieldIntent>) -> MatchDraft {
    let mut draft = MatchDraft::new();
    draft.form_intents = intents;
    draft
}

/// A draft of the verbose form of variable `variable` holding `intents`.
fn verbose(variable: usize, intents: Vec<FormFieldIntent>) -> MatchDraft {
    let mut drafted = VariableDraft::new(variable);
    drafted.field_intents = intents;
    MatchDraft::new().with_variable(drafted)
}

/// The definition every shape test writes: a `choice` with a list of values, one
/// of them `true` (a logical string, so quoted), and a plain-source `multiline`.
fn delta() -> NewFormField {
    NewFormField::new(
        "delta",
        FormOptions::default()
            .with_type("choice")
            .with_values(FormValues::List(vec!["x".to_owned(), "true".to_owned()]))
            .with_multiline("false"),
    )
}

/// `delta()` as written at `column`.
fn delta_text(column: usize) -> String {
    let pad = " ".repeat(column);
    format!(
        "{pad}delta:\n{pad}  type: choice\n{pad}  multiline: false\n{pad}  values:\n{pad}    - x\n{pad}    - 'true'\n"
    )
}

/// The decoded definition names of the shorthand form of match `index`.
fn shorthand_names(source: &str, index: usize) -> Vec<String> {
    names(&the_match(source, index).form_fields)
}

/// The decoded definition names of the verbose form of variable `variable` of
/// match `index`.
fn verbose_names(source: &str, index: usize, variable: usize) -> Vec<String> {
    let view = the_match(source, index);
    let fields = view.vars[variable]
        .params
        .iter()
        .find(|field| field.key.as_ref().is_some_and(|key| key.text == "fields"))
        .and_then(|field| field.value.as_mapping())
        .unwrap_or_default();
    names(fields)
}

/// The decoded keys of a projected mapping.
fn names(fields: &[espansoconfig_core::model::FieldView]) -> Vec<String> {
    fields
        .iter()
        .map(|field| {
            field
                .key
                .as_ref()
                .map_or(String::new(), |key| key.text.clone())
        })
        .collect()
} // End of function names()

/// Asserts that neither the JSON, the developer rendering nor the debug
/// rendering of `error` holds [`PRIVATE`].
fn assert_no_text(error: &DraftError) {
    let json = serde_json::to_string(error).expect("a refusal serializes");
    assert!(!json.contains(PRIVATE), "the wire form echoes text: {json}");
    assert!(!error.to_string().contains(PRIVATE));
    assert!(!format!("{error:?}").contains(PRIVATE));
} // End of function assert_no_text()

// ---------------------------------------------------------------------------
// One intention, two shapes
// ---------------------------------------------------------------------------

#[test]
fn one_intention_writes_its_own_shape_and_never_converts() {
    let intent = FormFieldIntent::insert(delta());

    // Carried by the match: the shorthand `form_fields` gains the definition,
    // after the last one, and `vars` is untouched.
    let (edits, short) = planned(FORMS, 0, &shorthand(vec![intent.clone()]));
    assert_eq!(edits.len(), 1);
    assert_eq!(
        short,
        replaced(
            FORMS,
            "        trim_string_values: true\n  - trigger: ':bare'",
            &format!(
                "        trim_string_values: true\n{}  - trigger: ':bare'",
                delta_text(6)
            ),
        )
    );
    assert_eq!(
        shorthand_names(&short, 0),
        vec!["alpha", "beta", "gamma", "delta"]
    );
    assert!(the_match(&short, 0).vars.is_empty());

    // Carried by a form variable: its `params.fields` gains the same definition,
    // one level deeper, and no `form_fields` appears on the match.
    let (edits, long) = planned(FORMS, 2, &verbose(0, vec![intent]));
    assert_eq!(edits.len(), 1);
    assert_eq!(
        long,
        replaced(
            FORMS,
            "              default: x\n",
            &format!("              default: x\n{}", delta_text(12)),
        )
    );
    assert_eq!(verbose_names(&long, 2, 0), vec!["alpha", "beta", "delta"]);
    assert!(!the_match(&long, 2).form_fields_presence.is_present());
    let shape = &the_match(&long, 2).vars[0].field_shapes[2];
    assert!(matches!(
        shape.values,
        SequencePresence::Items {
            flow: false,
            count: 2,
            ..
        }
    ));
} // End of function one_intention_writes_its_own_shape_and_never_converts()

#[test]
fn a_form_without_definitions_gains_the_whole_entry_in_its_own_shape() {
    // Shorthand: one new `form_fields:` after the match's last entry.
    let (edits, short) = planned(FORMS, 1, &shorthand(vec![FormFieldIntent::insert(delta())]));
    assert_eq!(edits.len(), 1);
    assert_eq!(
        short,
        replaced(
            FORMS,
            "    form: 'Name: [[name]]'\n",
            &format!(
                "    form: 'Name: [[name]]'\n    form_fields:\n{}",
                delta_text(6)
            ),
        )
    );
    assert!(matches!(
        the_match(&short, 1).form_fields_presence,
        MappingPresence::Entries {
            flow: false,
            count: 1,
            ..
        }
    ));

    // Verbose: one new `fields:` in `params`, after `layout`; a definition with
    // no option is `{}`, and a key YAML 1.1 reads as a boolean is quoted.
    let bare = NewFormField::new("y", FormOptions::default());
    let (_, long) = planned(
        FORMS,
        2,
        &verbose(
            1,
            vec![
                FormFieldIntent::insert(delta()),
                FormFieldIntent::insert(bare),
            ],
        ),
    );
    assert_eq!(
        long,
        replaced(
            FORMS,
            "          layout: 'N: [[name]]'\n",
            &format!(
                "          layout: 'N: [[name]]'\n          fields:\n{}            'y': {{}}\n",
                delta_text(12)
            ),
        )
    );
    assert_eq!(verbose_names(&long, 2, 1), vec!["delta", "y"]);

    // An index off the wire as large as an index can be names nothing, and is
    // refused rather than overflowing.
    assert_eq!(
        refused(
            FORMS,
            0,
            &shorthand(vec![FormFieldIntent::insert_after(usize::MAX, delta())])
        ),
        DraftError::TargetDoesNotExist {
            target: DraftTarget::FormField { index: usize::MAX },
            length: 3
        }
    );
    // With nothing to anchor on after the one there is, `After` names nothing.
    assert_eq!(
        refused(
            FORMS,
            1,
            &shorthand(vec![FormFieldIntent::insert_after(0, delta())])
        ),
        DraftError::TargetDoesNotExist {
            target: DraftTarget::FormField { index: 0 },
            length: 0
        }
    );
} // End of function a_form_without_definitions_gains_the_whole_entry_in_its_own_shape()

#[test]
fn a_complete_new_verbose_form_is_one_description() {
    let variable = NewVariable::form_with_fields(
        "h",
        "X: [[x]]",
        vec![
            delta(),
            NewFormField::new("x", FormOptions::default().with_default("none")),
        ],
    );
    let body = format!(
        "      - name: h\n        type: form\n        params:\n          layout: 'X: [[x]]'\n          fields:\n{}            x:\n              default: none\n",
        delta_text(12)
    );
    // Into an existing `vars`.
    let draft = MatchDraft::new()
        .with_vars_intent(VarsIntent::insert(ListPlacement::End {}, variable.clone()));
    let (edits, into) = planned(FORMS, 2, &draft);
    assert_eq!(edits.len(), 1);
    assert_eq!(
        into,
        replaced(
            FORMS,
            "          echo: hi\n",
            &format!("          echo: hi\n{body}")
        )
    );
    let view = the_match(&into, 2);
    let born = &view.vars[3];
    assert!(matches!(
        born.fields_presence,
        Some(MappingPresence::Entries {
            flow: false,
            count: 2,
            ..
        })
    ));
    assert_eq!(born.field_shapes.len(), 2);

    // As the whole `vars:` of a match without one, beside a layout edit.
    let draft = MatchDraft::new()
        .with(MatchField::Form, "Name: [[name]]!")
        .with_vars_intent(VarsIntent::insert(ListPlacement::End {}, variable));
    let (edits, subtree) = planned(FORMS, 1, &draft);
    assert_eq!(edits.len(), 2);
    assert_eq!(
        subtree,
        replaced(
            FORMS,
            "    form: 'Name: [[name]]'\n",
            &format!("    form: 'Name: [[name]]!'\n    vars:\n{body}")
        )
    );
} // End of function a_complete_new_verbose_form_is_one_description()

// ---------------------------------------------------------------------------
// Layout plus definition, deletion, representation
// ---------------------------------------------------------------------------

#[test]
fn a_layout_edit_plus_a_field_addition_is_one_batch() {
    let layout = "A: [[alpha]]\nB: [[beta]]\nD: [[delta]]\n";
    let draft = shorthand(vec![FormFieldIntent::insert(delta())]).with(MatchField::Form, layout);
    let (edits, short) = planned(FORMS, 0, &draft);
    assert_eq!(edits.len(), 2);
    let expected = replaced(
        &replaced(
            FORMS,
            "      B: [[beta]]\n    form_fields:",
            "      B: [[beta]]\n      D: [[delta]]\n    form_fields:",
        ),
        "        trim_string_values: true\n  - trigger: ':bare'",
        &format!(
            "        trim_string_values: true\n{}  - trigger: ':bare'",
            delta_text(6)
        ),
    );
    assert_eq!(short, expected);
    // A layout edit alone creates or deletes no definition.
    let (_, alone) = planned(FORMS, 0, &MatchDraft::new().with(MatchField::Form, layout));
    assert_eq!(shorthand_names(&alone, 0), vec!["alpha", "beta", "gamma"]);

    // Verbose: the `layout` parameter and the definition, one batch.
    let mut drafted = VariableDraft::new(0)
        .with_param(EntryDraft::new(0).set("A: [[alpha]] D: [[delta]]"))
        .with_form_intent(FormFieldIntent::insert(delta()));
    drafted.index = 0;
    let (edits, long) = planned(FORMS, 2, &MatchDraft::new().with_variable(drafted));
    assert_eq!(edits.len(), 2);
    let expected = replaced(
        &replaced(
            FORMS,
            "          layout: 'A: [[alpha]]'\n",
            "          layout: 'A: [[alpha]] D: [[delta]]'\n",
        ),
        "              default: x\n",
        &format!("              default: x\n{}", delta_text(12)),
    );
    assert_eq!(long, expected);
} // End of function a_layout_edit_plus_a_field_addition_is_one_batch()

#[test]
fn deleting_a_definition_touches_only_its_owned_span() {
    // The first definition goes with the comment it owns.
    let (edits, first) = planned(
        FORMS,
        0,
        &shorthand(vec![FormFieldIntent::RemoveField { index: 0 }]),
    );
    assert_eq!(edits.len(), 1);
    assert_eq!(
        first,
        replaced(
            FORMS,
            "      # Owned by alpha.\n      alpha:\n        type: choice\n        values:\n          - one\n          - two\n",
            ""
        )
    );
    // A middle one takes its own lines and nothing else.
    let (_, middle) = planned(
        FORMS,
        0,
        &shorthand(vec![FormFieldIntent::RemoveField { index: 1 }]),
    );
    assert_eq!(
        middle,
        replaced(FORMS, "      beta:\n        multiline: true\n", "")
    );
    // The last one, whose `values` is a literal block.
    let (_, last) = planned(
        FORMS,
        0,
        &shorthand(vec![FormFieldIntent::RemoveField { index: 2 }]),
    );
    assert_eq!(
        last,
        replaced(
            FORMS,
            "      gamma:\n        type: list\n        values: |\n          red\n          green\n        trim_string_values: true\n",
            ""
        )
    );
    // Verbose, the same way.
    let (_, long) = planned(
        FORMS,
        2,
        &verbose(0, vec![FormFieldIntent::RemoveField { index: 1 }]),
    );
    assert_eq!(
        long,
        replaced(FORMS, "            beta:\n              default: x\n", "")
    );
    // A removal and an insertion at the end, one batch. (An insertion right
    // where the removal begins is refused at intent level, as
    // `intents_that_contradict_each_other_are_refused_before_any_diffing` pins.)
    let (edits, both) = planned(
        FORMS,
        0,
        &shorthand(vec![
            FormFieldIntent::RemoveField { index: 1 },
            FormFieldIntent::insert(delta()),
        ]),
    );
    assert_eq!(edits.len(), 2);
    assert_eq!(
        both,
        replaced(
            &replaced(FORMS, "      beta:\n        multiline: true\n", ""),
            "        trim_string_values: true\n  - trigger: ':bare'",
            &format!(
                "        trim_string_values: true\n{}  - trigger: ':bare'",
                delta_text(6)
            ),
        )
    );
} // End of function deleting_a_definition_touches_only_its_owned_span()

#[test]
fn removing_the_last_definition_is_refused_and_removing_all_is_explicit() {
    let every = shorthand(vec![
        FormFieldIntent::RemoveField { index: 0 },
        FormFieldIntent::RemoveField { index: 1 },
        FormFieldIntent::RemoveField { index: 2 },
    ]);
    assert_eq!(
        refused(FORMS, 0, &every),
        DraftError::FormFieldsWouldBeEmpty {
            form: FormOwner::Shorthand {}
        }
    );
    // `RemoveFields` is the explicit container removal, in both shapes.
    let (_, short) = planned(FORMS, 0, &shorthand(vec![FormFieldIntent::RemoveFields {}]));
    let start = FORMS
        .find("    form_fields:\n      # Owned")
        .expect("the entry");
    let end = FORMS.find("  - trigger: ':bare'").expect("the next match");
    assert_eq!(short, format!("{}{}", &FORMS[..start], &FORMS[end..]));
    assert!(!the_match(&short, 0).form_fields_presence.is_present());
    let (_, long) = planned(
        FORMS,
        2,
        &verbose(0, vec![FormFieldIntent::RemoveFields {}]),
    );
    let start = FORMS.find("          fields:\n").expect("the entry");
    let end = FORMS.find("      - name: g").expect("the next variable");
    assert_eq!(long, format!("{}{}", &FORMS[..start], &FORMS[end..]));
    // Nothing to remove derives nothing; a removal of the last option or the
    // last `values` item is refused, never a null.
    let (edits, _) = planned(FORMS, 1, &shorthand(vec![FormFieldIntent::RemoveFields {}]));
    assert!(edits.is_empty());
    let every_option = MatchDraft::new()
        .with_form_field(FormFieldDraft::new(1).with_option(EntryDraft::new(0).removed()));
    assert_eq!(
        refused(FORMS, 0, &every_option),
        DraftError::FormFieldWouldHaveNoOptions {
            target: DraftTarget::FormField { index: 1 }
        }
    );
    let every_value = MatchDraft::new().with_form_field(
        FormFieldDraft::new(0)
            .with_values_intent(FormValuesIntent::RemoveItem { index: 0 })
            .with_values_intent(FormValuesIntent::RemoveItem { index: 1 }),
    );
    assert_eq!(
        refused(FORMS, 0, &every_value),
        DraftError::FormValuesWouldBeEmpty {
            target: DraftTarget::FormFieldOption {
                field: 0,
                option: 1
            }
        }
    );
} // End of function removing_the_last_definition_is_refused_and_removing_all_is_explicit()

/// `form-layout-and-choice.yml:43-54`: `prioridad`'s `values` is a scalar list and
/// `equipo`'s a multi-line string. Every edit keeps each as it is.
#[test]
fn a_scalar_list_and_a_multiline_string_keep_their_representation() {
    let definition = |field: usize| FormFieldDraft::new(field);
    let draft = |fields: Vec<FormFieldDraft>| {
        let mut drafted = VariableDraft::new(0);
        drafted.fields = fields;
        MatchDraft::new().with_variable(drafted)
    };
    // The list takes an item at the end and loses its first, and stays a block
    // list; an existing item is rewritten in place.
    let (edits, list) = planned(
        CORPUS,
        1,
        &draft(vec![definition(1)
            .with_values_intent(FormValuesIntent::InsertItems {
                at: ListPlacement::End {},
                items: ScalarItems::one("urgente"),
            })
            .with_values_intent(FormValuesIntent::RemoveItem { index: 0 })
            .with_option(EntryDraft::new(1).with_item(1, "normal"))]),
    );
    assert_eq!(edits.len(), 3);
    assert_eq!(
        list,
        replaced(
            CORPUS,
            "                - baja\n                - media\n                - alta\n",
            "                - normal\n                - alta\n                - urgente\n"
        )
    );
    let shapes = &the_match(&list, 1).vars[0].field_shapes;
    assert!(matches!(
        shapes[1].values,
        SequencePresence::Items {
            flow: false,
            count: 3,
            ..
        }
    ));
    // The text stays text: rewritten as one string it is still a literal block,
    // and a list intent against it is refused by name.
    let (_, text) = planned(
        CORPUS,
        1,
        &draft(vec![definition(2).with_option(
            EntryDraft::new(1).set("soporte\nventas\nlegal\n"),
        )]),
    );
    assert_eq!(
        text,
        replaced(
            CORPUS,
            "                ingeniería\n",
            "                legal\n"
        )
    );
    assert!(matches!(
        the_match(&text, 1).vars[0].field_shapes[2].values,
        SequencePresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        }
    ));
    assert_eq!(
        refused(
            CORPUS,
            1,
            &draft(vec![definition(2).with_values_intent(
                FormValuesIntent::InsertItems {
                    at: ListPlacement::End {},
                    items: ScalarItems::one("x"),
                }
            )])
        ),
        DraftError::FormValuesIsNotAList {
            target: DraftTarget::VariableFormFieldOption {
                variable: 0,
                field: 2,
                option: 1
            },
            found: ValueKind::Scalar
        }
    );
    // Its plain-source `trim_string_values` and the text are removable as
    // options, and the list removable as a flat list, each on its own.
    let (_, fewer) = planned(
        CORPUS,
        1,
        &draft(vec![definition(2).with_option(EntryDraft::new(2).removed())]),
    );
    assert_eq!(
        fewer,
        replaced(CORPUS, "              trim_string_values: true\n", "")
    );
    let (_, no_list) = planned(
        CORPUS,
        1,
        &draft(vec![definition(1).with_option(EntryDraft::new(1).removed())]),
    );
    assert_eq!(
        no_list,
        replaced(
            CORPUS,
            "              values:\n                - baja\n                - media\n                - alta\n",
            ""
        )
    );
    // The shorthand list of the same fixture, in place.
    let (_, short) = planned(
        CORPUS,
        0,
        &MatchDraft::new().with_form_field(definition(0).with_values_intent(
            FormValuesIntent::InsertItems {
                at: ListPlacement::After { index: 0 },
                items:
                    ScalarItems::from_vec(vec!["alpha2".to_owned(), "no".to_owned()]).expect("two"),
            },
        )),
    );
    assert_eq!(
        short,
        replaced(
            CORPUS,
            "          - alpha\n",
            "          - alpha\n          - alpha2\n          - 'no'\n"
        )
    );
} // End of function a_scalar_list_and_a_multiline_string_keep_their_representation()

#[test]
fn new_options_are_written_after_the_last_option_that_stays() {
    let options = FormOptions::default()
        .with_default("true")
        .with_trim_string_values("true")
        .with_extra(NewParam::list("hint", vec!["a".to_owned()]));
    let (edits, patched) = planned(
        FORMS,
        0,
        &MatchDraft::new().with_form_field(FormFieldDraft::new(1).with_new_options(options)),
    );
    assert_eq!(edits.len(), 1);
    assert_eq!(
        patched,
        replaced(
            FORMS,
            "        multiline: true\n",
            "        multiline: true\n        default: 'true'\n        trim_string_values: true\n        hint:\n          - a\n"
        )
    );
    // Beside an item appended to `values`, the new option lands before the list,
    // not at the list's end.
    let (_, beside) = planned(
        FORMS,
        0,
        &MatchDraft::new().with_form_field(
            FormFieldDraft::new(0)
                .with_new_options(FormOptions::default().with_default("one"))
                .with_values_intent(FormValuesIntent::InsertItems {
                    at: ListPlacement::End {},
                    items: ScalarItems::one("three"),
                }),
        ),
    );
    assert_eq!(
        beside,
        replaced(
            FORMS,
            "        type: choice\n        values:\n          - one\n          - two\n      beta:",
            "        type: choice\n        default: one\n        values:\n          - one\n          - two\n          - three\n      beta:"
        )
    );
    // A key the definition already holds is refused, however it is asked for.
    assert_eq!(
        refused(
            FORMS,
            0,
            &MatchDraft::new().with_form_field(
                FormFieldDraft::new(1)
                    .with_new_options(FormOptions::default().with_multiline("false"))
            )
        ),
        DraftError::NewKeyDuplicatesAnEntry {
            target: DraftTarget::FormField { index: 1 },
            entry: 0
        }
    );
    // Verbose, the same way.
    let mut drafted = VariableDraft::new(0);
    drafted.fields = vec![FormFieldDraft::new(1).with_new_options(
        FormOptions::default()
            .with_trim_string_values("true")
            .with_extra(NewParam::list("hint", vec!["a".to_owned()])),
    )];
    let (_, long) = planned(FORMS, 2, &MatchDraft::new().with_variable(drafted));
    assert_eq!(
        long,
        replaced(
            FORMS,
            "              default: x
",
            "              default: x
              trim_string_values: true
              hint:
                - a
"
        )
    );
} // End of function new_options_are_written_after_the_last_option_that_stays()

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

#[test]
fn unsupported_subtrees_refuse_structured_rewriting() {
    let insert = |intents| shorthand(intents);
    // Definitions written between braces take nothing in and give nothing up.
    for draft in [
        insert(vec![FormFieldIntent::insert(delta())]),
        insert(vec![FormFieldIntent::RemoveField { index: 0 }]),
    ] {
        assert_eq!(
            refused(FORMS, 3, &draft),
            DraftError::FormFieldsIsAFlowMapping {
                form: FormOwner::Shorthand {}
            }
        );
    }
    // … but can be removed whole, explicitly.
    let (_, gone) = planned(FORMS, 3, &insert(vec![FormFieldIntent::RemoveFields {}]));
    assert_eq!(
        gone,
        replaced(FORMS, "    form_fields: {a: {type: text}}\n", "")
    );
    // A scalar where the definitions should be refuses everything.
    for draft in [
        insert(vec![FormFieldIntent::insert(delta())]),
        insert(vec![FormFieldIntent::RemoveFields {}]),
    ] {
        assert_eq!(
            refused(FORMS, 4, &draft),
            DraftError::FormFieldsHasAnUnsupportedShape {
                form: FormOwner::Shorthand {},
                found: ValueKind::Scalar
            }
        );
    }
    // A definition holding a mapping is not removed, nor that mapping.
    assert_eq!(
        refused(
            FORMS,
            5,
            &insert(vec![FormFieldIntent::RemoveField { index: 0 }])
        ),
        DraftError::NestedRemovalWouldDiscardUnshownStructure {
            target: DraftTarget::FormField { index: 0 },
            found: ValueKind::Mapping
        }
    );
    assert_eq!(
        refused(
            FORMS,
            5,
            &MatchDraft::new()
                .with_form_field(FormFieldDraft::new(0).with_option(EntryDraft::new(1).removed()))
        ),
        DraftError::NestedRemovalWouldDiscardUnshownStructure {
            target: DraftTarget::FormFieldOption {
                field: 0,
                option: 1
            },
            found: ValueKind::Mapping
        }
    );
    // A flat definition and one between braces are removable.
    let (_, flat) = planned(
        FORMS,
        5,
        &insert(vec![FormFieldIntent::RemoveField { index: 1 }]),
    );
    assert_eq!(
        flat,
        replaced(FORMS, "      flat:\n        type: text\n", "")
    );
    let (_, braced) = planned(
        FORMS,
        5,
        &insert(vec![FormFieldIntent::RemoveField { index: 2 }]),
    );
    assert_eq!(braced, replaced(FORMS, "      braced: {type: text}\n", ""));
    // Options between braces take no new option.
    assert_eq!(
        refused(
            FORMS,
            5,
            &MatchDraft::new().with_form_field(
                FormFieldDraft::new(2).with_new_options(FormOptions::default().with_default("d"))
            )
        ),
        DraftError::FormFieldOptionsAreNotABlockMapping {
            target: DraftTarget::FormField { index: 2 },
            found: ValueKind::Mapping
        }
    );
    // A flow `values` of strings stays flow.
    let (_, flowing) = planned(
        FORMS,
        5,
        &MatchDraft::new().with_form_field(
            FormFieldDraft::new(3)
                .with_values_intent(FormValuesIntent::InsertItems {
                    at: ListPlacement::End {},
                    items: ScalarItems::one("c"),
                })
                .with_values_intent(FormValuesIntent::RemoveItem { index: 0 }),
        ),
    );
    assert_eq!(
        flowing,
        // The flow engine quotes a new string, as it does in every flow list.
        replaced(FORMS, "values: [a, b]\n", "values: [b, 'c']\n")
    );
    // `values` intents need a `values`.
    assert_eq!(
        refused(
            FORMS,
            0,
            &MatchDraft::new().with_form_field(
                FormFieldDraft::new(1)
                    .with_values_intent(FormValuesIntent::RemoveItem { index: 0 })
            )
        ),
        DraftError::FormValuesAbsent {
            target: DraftTarget::FormField { index: 1 }
        }
    );
    // A verbose form's intents need a form variable.
    assert_eq!(
        refused(
            FORMS,
            2,
            &verbose(2, vec![FormFieldIntent::insert(delta())])
        ),
        DraftError::VariableIsNotAForm { variable: 2 }
    );
} // End of function unsupported_subtrees_refuse_structured_rewriting()

#[test]
fn intents_that_contradict_each_other_are_refused_before_any_diffing() {
    let conflict = |intent: usize| DraftError::FormIntentsConflict {
        form: FormOwner::Shorthand {},
        intent,
    };
    let cases: Vec<(MatchDraft, DraftError)> = vec![
        (
            shorthand(vec![
                FormFieldIntent::RemoveFields {},
                FormFieldIntent::insert(delta()),
            ]),
            conflict(0),
        ),
        (
            shorthand(vec![FormFieldIntent::RemoveFields {}])
                .with_form_field(FormFieldDraft::new(0).with_option(EntryDraft::new(0).set("x"))),
            conflict(0),
        ),
        (
            shorthand(vec![
                FormFieldIntent::RemoveField { index: 1 },
                FormFieldIntent::RemoveField { index: 1 },
            ]),
            conflict(1),
        ),
        (
            shorthand(vec![FormFieldIntent::RemoveField { index: 1 }])
                .with_form_field(FormFieldDraft::new(1).with_option(EntryDraft::new(0).set("x"))),
            conflict(0),
        ),
        (
            shorthand(vec![
                FormFieldIntent::RemoveField { index: 1 },
                FormFieldIntent::insert_after(1, delta()),
            ]),
            conflict(1),
        ),
        (
            shorthand(vec![
                FormFieldIntent::RemoveField { index: 1 },
                FormFieldIntent::insert_after(0, delta()),
            ]),
            conflict(1),
        ),
        (
            shorthand(vec![FormFieldIntent::insert_after(0, delta())]).with_form_field(
                FormFieldDraft::new(0).with_new_options(FormOptions::default().with_default("d")),
            ),
            conflict(0),
        ),
    ];
    for (draft, expected) in cases {
        assert_eq!(refused(FORMS, 0, &draft), expected, "{draft:?}");
    }
    let values = DraftTarget::FormFieldOption {
        field: 0,
        option: 1,
    };
    let at = |at: ListPlacement| FormValuesIntent::InsertItems {
        at,
        items: ScalarItems::one("x"),
    };
    for definition in [
        FormFieldDraft::new(0)
            .with_values_intent(FormValuesIntent::RemoveItem { index: 0 })
            .with_values_intent(FormValuesIntent::RemoveItem { index: 0 }),
        FormFieldDraft::new(0)
            .with_values_intent(FormValuesIntent::RemoveItem { index: 0 })
            .with_option(EntryDraft::new(1).with_item(0, "y")),
        FormFieldDraft::new(0)
            .with_values_intent(at(ListPlacement::End {}))
            .with_values_intent(at(ListPlacement::After { index: 1 })),
        FormFieldDraft::new(0)
            .with_values_intent(at(ListPlacement::Front {}))
            .with_values_intent(FormValuesIntent::RemoveItem { index: 0 }),
        FormFieldDraft::new(0)
            .with_values_intent(at(ListPlacement::End {}))
            .with_option(EntryDraft::new(1).removed()),
    ] {
        assert_eq!(
            refused(FORMS, 0, &MatchDraft::new().with_form_field(definition)),
            DraftError::FormValuesIntentsConflict { target: values }
        );
    } // End of the loop over the contradictory `values` drafts
} // End of function intents_that_contradict_each_other_are_refused_before_any_diffing()

/// No refusal of this step carries a definition's name, an option's key or any
/// value: every operand is a position, a form, a setting or a kind.
#[test]
fn new_definitions_are_refused_by_position_never_by_text() {
    let named = |name: &str| NewFormField::new(name, FormOptions::default());
    let new = |form: FormOwner, field: usize| DraftTarget::NewFormField { form, field };
    let short = FormOwner::Shorthand {};
    let cases: Vec<(usize, MatchDraft, DraftError)> = vec![
        (
            0,
            shorthand(vec![FormFieldIntent::insert(named("alpha"))]),
            DraftError::NewKeyDuplicatesAnEntry {
                target: new(short, 0),
                entry: 0,
            },
        ),
        (
            0,
            shorthand(vec![
                FormFieldIntent::insert(named(PRIVATE)),
                FormFieldIntent::insert(named(PRIVATE)),
            ]),
            DraftError::NewKeyDuplicatesAnInsertion {
                target: new(short, 1),
                first: 0,
            },
        ),
        (
            0,
            shorthand(vec![FormFieldIntent::insert(named(""))]),
            DraftError::NewKeyIsEmpty {
                target: new(short, 0),
            },
        ),
        (
            0,
            shorthand(vec![FormFieldIntent::insert(named("<<"))]),
            DraftError::NewKeyIsAMergeKey {
                target: new(short, 0),
            },
        ),
        (
            0,
            shorthand(vec![FormFieldIntent::insert(NewFormField::new(
                "n",
                FormOptions::default().with_multiline(format!("{PRIVATE}: yes")),
            ))]),
            DraftError::NewFormOptionNotPlainSource {
                target: new(short, 0),
                setting: VariableSetting::Multiline,
            },
        ),
        (
            0,
            shorthand(vec![FormFieldIntent::insert(NewFormField::new(
                "n",
                FormOptions::default().with_extra(NewParam::scalar("type", PRIVATE)),
            ))]),
            DraftError::NewKeyIsAFormOption {
                target: DraftTarget::NewFormFieldOption {
                    form: short,
                    field: 0,
                    option: 0,
                },
            },
        ),
        (
            0,
            MatchDraft::new().with_form_field(FormFieldDraft::new(1).with_new_options(
                FormOptions::default().with_extra(NewParam::scalar("trim", PRIVATE)),
            )),
            DraftError::NewKeyIsATypedSetting {
                target: DraftTarget::NewFormOption {
                    form: short,
                    field: 1,
                    option: 0,
                },
            },
        ),
        (
            2,
            verbose(
                0,
                vec![FormFieldIntent::insert(NewFormField::new(
                    PRIVATE,
                    FormOptions {
                        extra: (0..=FormOptions::MAX_EXTRA_OPTIONS)
                            .map(|at| NewParam::scalar(format!("k{at}"), PRIVATE))
                            .collect(),
                        ..FormOptions::default()
                    },
                ))],
            ),
            DraftError::NewFormFieldHasTooManyOptions {
                target: new(FormOwner::Variable { variable: 0 }, 0),
                limit: FormOptions::MAX_EXTRA_OPTIONS,
            },
        ),
        (
            2,
            MatchDraft::new().with_vars_intent(VarsIntent::insert(
                ListPlacement::End {},
                NewVariable::form_with_fields("h", PRIVATE, vec![named(PRIVATE), named(PRIVATE)]),
            )),
            DraftError::NewKeyDuplicatesAnInsertion {
                target: new(FormOwner::NewVariable { insertion: 0 }, 1),
                first: 0,
            },
        ),
    ];
    for (index, draft, expected) in cases {
        let error = refused(FORMS, index, &draft);
        assert_eq!(error, expected);
        assert_no_text(&error);
    } // End of the loop over the refused descriptions
} // End of function new_definitions_are_refused_by_position_never_by_text()

// ---------------------------------------------------------------------------
// Hard shapes, the wire and the audit
// ---------------------------------------------------------------------------

#[test]
fn crlf_and_a_missing_final_newline_are_kept() {
    let source = "matches:\r\n  - trigger: ':c'\r\n    form: 'x'\r\n    form_fields:\r\n      a:\r\n        type: text";
    let (_, patched) = planned(
        source,
        0,
        &shorthand(vec![FormFieldIntent::insert(delta())]),
    );
    assert_eq!(
        patched,
        format!(
            "{source}\r\n{}",
            delta_text(6).trim_end_matches('\n').replace('\n', "\r\n")
        )
    );
    // Removing the definition that was there takes its own CRLF lines and
    // leaves the new last line unterminated, as it was written.
    let (_, back) = planned(
        &patched,
        0,
        &shorthand(vec![FormFieldIntent::RemoveField { index: 0 }]),
    );
    assert_eq!(
        back,
        patched.replacen("      a:\r\n        type: text\r\n", "", 1)
    );
    assert!(!back.ends_with('\n'));
} // End of function crlf_and_a_missing_final_newline_are_kept()

#[test]
fn form_drafts_cross_the_wire_as_closed_shapes() {
    let json = r#"{
        "form_intents": [
            {"InsertField": {"field": {"name": "n", "options": {"type": "list",
                "values": {"Text": "a\nb\n"}, "trim_string_values": "true",
                "extra": [{"key": "hint", "value": {"Scalar": "h"}}]}}}},
            {"InsertField": {"after": 0, "field": {"name": "m"}}},
            {"RemoveField": {"index": 1}},
            {"RemoveFields": {}}
        ],
        "form_fields": [{"index": 0,
            "insert_options": {"default": "d"},
            "values": [{"InsertItems": {"at": {"End": {}}, "items": ["x"]}},
                       {"RemoveItem": {"index": 0}}]}],
        "vars": [{"index": 0, "fields": [{"index": 1}],
                  "field_intents": [{"RemoveField": {"index": 0}}]}],
        "var_intents": [{"InsertVariable": {"at": {"End": {}}, "variable": {"name": "v",
            "params": {"Form": {"layout": "l", "fields": [{"name": "f"}]}}}}}]
    }"#;
    let draft: MatchDraft = serde_json::from_str(json).expect("the draft reads");
    assert_eq!(draft.form_intents.len(), 4);
    assert!(matches!(
        &draft.form_intents[0],
        FormFieldIntent::InsertField { after: None, field }
            if field.options.values == Some(FormValues::Text("a\nb\n".to_owned()))
    ));
    assert_eq!(draft.form_fields[0].values.len(), 2);
    assert_eq!(draft.vars[0].field_intents.len(), 1);
    let VarsIntent::InsertVariable { variable, .. } = &draft.var_intents[0] else {
        panic!("an insertion");
    };
    assert_eq!(variable.form_fields().len(), 1);
    for refused in [
        // An option the description does not name.
        r#"{"form_intents": [{"InsertField": {"field": {"name": "n", "options": {"width": "3"}}}}]}"#,
        // A mapping where an option value goes.
        r#"{"form_intents": [{"InsertField": {"field": {"name": "n", "options": {"default": {"a": "b"}}}}}]}"#,
        // A `values` of neither representation.
        r#"{"form_intents": [{"InsertField": {"field": {"name": "n", "options": {"values": {"Map": {}}}}}}]}"#,
        // No items.
        r#"{"form_fields": [{"index": 0, "values": [{"InsertItems": {"at": {"End": {}}, "items": []}}]}]}"#,
        // An unknown intent field.
        r#"{"form_intents": [{"RemoveField": {"index": 0, "name": "x"}}]}"#,
    ] {
        assert!(
            serde_json::from_str::<MatchDraft>(refused).is_err(),
            "{refused} must be refused while the arguments are read"
        );
    } // End of the loop over the refused wire shapes
    let target = DraftTarget::NewFormField {
        form: FormOwner::Variable { variable: 2 },
        field: 1,
    };
    assert_eq!(
        serde_json::to_string(&target).expect("serializes"),
        r#"{"NewFormField":{"form":{"Variable":{"variable":2}},"field":1}}"#
    );
    assert_eq!(
        serde_json::to_string(&VariableSetting::TrimStringValues).expect("serializes"),
        r#""trim_string_values""#
    );
} // End of function form_drafts_cross_the_wire_as_closed_shapes()

#[test]
fn the_closed_surface_admits_the_definition_shapes_and_nothing_near_them() {
    let here = DocumentPath::root(0).with_key("matches").with_index(0);
    let short = here.clone().with_key("form_fields");
    let long = here
        .clone()
        .with_key("vars")
        .with_index(0)
        .with_key("params")
        .with_key("fields");
    let entry = |value: EntryValue| ItemValue::Entry(value);
    let scalar = |text: &str| entry(EntryValue::Scalar(text.to_owned()));
    let plain = |text: &str| entry(EntryValue::PlainSource(text.to_owned()));
    let options = |pairs: Vec<(&str, ItemValue)>| -> Vec<(String, ItemValue)> {
        pairs
            .into_iter()
            .map(|(key, value)| (key.to_owned(), value))
            .collect()
    };
    let definition = options(vec![("type", scalar("list")), ("multiline", plain("true"))]);
    let definitions = |mapping: DocumentPath, fields: Vec<(String, ItemValue)>| {
        FieldInsertGroup::of_mappings(mapping, None, vec![("n".to_owned(), fields)]).expect("one")
    };
    let inside: Vec<DocumentEdit> = vec![
        definitions(short.clone(), definition.clone()).into(),
        definitions(long.clone(), definition.clone()).into(),
        definitions(short.clone(), Vec::new()).into(),
        // A whole `form_fields:` on the match, a whole `fields:` in `params`.
        FieldInsertGroup::of_mappings(
            here.clone(),
            None,
            vec![(
                "form_fields".to_owned(),
                vec![("n".to_owned(), ItemValue::Mapping(definition.clone()))],
            )],
        )
        .expect("one")
        .into(),
        FieldInsertGroup::of_mappings(
            here.clone()
                .with_key("vars")
                .with_index(0)
                .with_key("params"),
            None,
            vec![(
                "fields".to_owned(),
                vec![("n".to_owned(), ItemValue::Mapping(definition.clone()))],
            )],
        )
        .expect("one")
        .into(),
        // New options of one definition.
        FieldInsertGroup::typed(
            short.clone().with_key("a"),
            None,
            vec![(
                "trim_string_values".to_owned(),
                EntryValue::PlainSource("true".to_owned()),
            )],
        )
        .expect("one")
        .into(),
        // Removals, `values` items, verbose options.
        FieldRemoval::new(short.clone().with_key("a")).into(),
        FieldRemoval::new(long.clone().with_key("a")).into(),
        FieldRemoval::new(long.clone().with_key("a").with_key("values")).into(),
        ScalarEdit::new(long.clone().with_key("a").with_key("default"), "x").into(),
        ScalarEdit::new(
            long.clone().with_key("a").with_key("values").with_index(0),
            "x",
        )
        .into(),
        ScalarItemInsert::new(
            long.clone().with_key("a").with_key("values"),
            ItemPlacement::End,
            vec!["x".to_owned()],
        )
        .expect("one")
        .into(),
        RemoveItem::new(short.clone().with_key("a").with_key("values").with_index(0)).into(),
    ];
    for edit in inside {
        assert_eq!(
            check_closed_surface(&here, std::slice::from_ref(&edit)),
            Ok(()),
            "{edit:?} is inside the surface"
        );
    } // End of the loop over the admitted shapes
    let outside: Vec<DocumentEdit> = vec![
        // A plain-source option under another key; a typed setting as a string.
        definitions(short.clone(), options(vec![("default", plain("true"))])).into(),
        definitions(short.clone(), options(vec![("multiline", scalar("true"))])).into(),
        definitions(short.clone(), options(vec![("trim", scalar("x"))])).into(),
        // A definition holding a mapping, one segment deeper than a definition.
        definitions(
            short.clone(),
            options(vec![("extra", ItemValue::Mapping(Vec::new()))]),
        )
        .into(),
        // Definitions one level too deep or too shallow.
        definitions(short.clone().with_key("a"), definition.clone()).into(),
        definitions(
            here.clone()
                .with_key("vars")
                .with_index(0)
                .with_key("params"),
            definition.clone(),
        )
        .into(),
        // A whole `form_fields:` holding no definition, or under another key.
        FieldInsertGroup::of_mappings(
            here.clone(),
            None,
            vec![("form_fields".to_owned(), Vec::new())],
        )
        .expect("one")
        .into(),
        FieldInsertGroup::of_mappings(
            here.clone(),
            None,
            vec![(
                "vars".to_owned(),
                vec![("n".to_owned(), ItemValue::Mapping(definition.clone()))],
            )],
        )
        .expect("one")
        .into(),
        // Options with a mapping inside, or a merge key.
        FieldInsertGroup::typed(
            short.clone().with_key("a"),
            None,
            vec![("<<".to_owned(), EntryValue::Scalar("x".to_owned()))],
        )
        .expect("one")
        .into(),
        // Items of another option, and one past a verbose option.
        ScalarItemInsert::new(
            long.clone().with_key("a").with_key("default"),
            ItemPlacement::End,
            vec!["x".to_owned()],
        )
        .expect("one")
        .into(),
        ScalarEdit::new(
            long.clone().with_key("a").with_key("default").with_key("x"),
            "x",
        )
        .into(),
        FieldRemoval::new(long.clone().with_key("a").with_key("values").with_key("x")).into(),
    ];
    for edit in outside {
        assert_eq!(
            check_closed_surface(&here, std::slice::from_ref(&edit)),
            Err(DraftError::OutsideTheClosedSurface { edit: 0 }),
            "{edit:?} must be outside the surface"
        );
    } // End of the loop over the refused shapes

    // A new option of a definition the same batch removes.
    let edits: Vec<DocumentEdit> = vec![
        FieldRemoval::new(short.clone().with_key("a")).into(),
        FieldInsertGroup::typed(
            short.clone().with_key("a"),
            None,
            vec![("default".to_owned(), EntryValue::Scalar("x".to_owned()))],
        )
        .expect("one")
        .into(),
    ];
    assert_eq!(
        check_batch_independence(&here, &["trigger".to_owned()], &[], &edits),
        Err(DraftError::RemovalContainsAnEdit {
            removal: 0,
            edit: 1
        })
    );
} // End of function the_closed_surface_admits_the_definition_shapes_and_nothing_near_them()

#[test]
fn a_new_definitions_values_text_is_a_literal_block_that_reads_back() {
    let field = NewFormField::new(
        "team",
        FormOptions::default()
            .with_type("list")
            .with_values(FormValues::Text("one\ntwo\n".to_owned())),
    );
    let (_, patched) = planned(FORMS, 0, &shorthand(vec![FormFieldIntent::insert(field)]));
    assert_eq!(
        patched,
        replaced(
            FORMS,
            "        trim_string_values: true\n  - trigger: ':bare'",
            "        trim_string_values: true\n      team:\n        type: list\n        values: |\n          one\n          two\n  - trigger: ':bare'"
        )
    );
    let view = the_match(&patched, 0);
    let values = view.form_fields[3]
        .value
        .as_mapping()
        .and_then(|options| options.get(1))
        .map(|option| option.value.clone());
    assert!(matches!(values, Some(ValueView::Scalar(scalar)) if scalar.text == "one\ntwo\n"));
} // End of function a_new_definitions_values_text_is_a_literal_block_that_reads_back()

// ---------------------------------------------------------------------------
// Review fixes (docs/reviews/4-6.md)
// ---------------------------------------------------------------------------

/// **Regression (Phase 4-6 review, first finding):** rewriting an existing
/// `multiline` or `trim_string_values` wrote a quoted logical string
/// (`'false'`), changing the value's YAML type. Both are plain source (ruling
/// 4), on either form shape, and a text that is not plain source is refused by
/// name before any comparison.
#[test]
fn an_existing_typed_form_setting_is_rewritten_as_plain_source() {
    // Verbose: `equipo`'s `trim_string_values: true` in the corpus fixture.
    let mut drafted = VariableDraft::new(0);
    drafted.fields = vec![FormFieldDraft::new(2).with_option(EntryDraft::new(2).set("false"))];
    let (_, long) = planned(CORPUS, 1, &MatchDraft::new().with_variable(drafted));
    assert_eq!(
        long,
        replaced(
            CORPUS,
            "              trim_string_values: true\n",
            "              trim_string_values: false\n"
        )
    );
    // Verbose `multiline: false` rewritten.
    let mut drafted = VariableDraft::new(0);
    drafted.fields = vec![FormFieldDraft::new(0).with_option(EntryDraft::new(0).set("true"))];
    let (_, multiline) = planned(CORPUS, 1, &MatchDraft::new().with_variable(drafted));
    assert_eq!(
        multiline,
        replaced(
            CORPUS,
            "              multiline: false\n",
            "              multiline: true\n"
        )
    );
    // Shorthand, the same way; the same text already written derives nothing,
    // and a quoted spelling of it is rewritten plain.
    let draft = |text: &str| {
        MatchDraft::new()
            .with_form_field(FormFieldDraft::new(1).with_option(EntryDraft::new(0).set(text)))
    };
    let (_, short) = planned(FORMS, 0, &draft("false"));
    assert_eq!(
        short,
        replaced(
            FORMS,
            "        multiline: true\n",
            "        multiline: false\n"
        )
    );
    let (edits, _) = planned(FORMS, 0, &draft("true"));
    assert!(edits.is_empty());
    let quoted = replaced(
        FORMS,
        "        multiline: true\n",
        "        multiline: 'true'\n",
    );
    let (_, plain) = planned(&quoted, 0, &draft("true"));
    assert_eq!(plain, FORMS);
    // Text that is not one plain scalar is refused by name, never quoted.
    assert_eq!(
        refused(FORMS, 0, &draft(&format!("{PRIVATE}: x"))),
        DraftError::NewFormOptionNotPlainSource {
            target: DraftTarget::FormFieldOption {
                field: 1,
                option: 0
            },
            setting: VariableSetting::Multiline
        }
    );
    assert_no_text(&refused(FORMS, 0, &draft(&format!("{PRIVATE}: x"))));
} // End of function an_existing_typed_form_setting_is_rewritten_as_plain_source()

/// Phase 4-10: the form editor's exact wire draft for *Add field* on a CRLF
/// file — the `CRLF_WIRE` literal of `src/lib/browser/formEditor.test.ts`,
/// which that test pins as what the model emits — changes the `form` layout and
/// adds the definition, and **every byte it did not ask to change** comes out
/// identical: the lines before the layout, the existing definition, the next
/// snippet and every one of their `\r\n` endings. The `\r` refusals of the
/// layout box are the frontend's (load, edit, send); this is the separate check
/// of the untouched bytes.
#[test]
fn the_form_editors_wire_draft_keeps_a_crlf_files_untouched_bytes() {
    let head = "# CRLF forms (Phase 4-10). Neutral content only.\r\nmatches:\r\n  - trigger: ':crlf'\r\n    form: |\r\n";
    let layout = "      Name: [[name]]\r\n";
    let definitions = "    form_fields:\r\n      name:\r\n        type: text\r\n";
    let tail = "  - trigger: ':after'\r\n    replace: 'kept'\r\n";
    let source = format!("{head}{layout}{definitions}{tail}");
    let view = the_match(&source, 0);
    assert_eq!(
        view.content.form.as_ref().map(|form| form.text.as_str()),
        Some("Name: [[name]]\n"),
        "the literal block decodes with a line feed, so the layout box may hold it"
    );
    let wire = r#"{"form":{"Set":"Name: [[name]][[when]]\n"},"form_intents":[{"InsertField":{"after":null,"field":{"name":"when","options":{"type":"text","default":null,"multiline":null,"values":null,"trim_string_values":null,"extra":[]}}}}],"form_fields":[]}"#;
    let draft: MatchDraft = serde_json::from_str(wire).expect("the editor's draft reads");
    let (_, patched) = planned(&source, 0, &draft);
    // Untouched: everything before the layout's value, the existing definition
    // and the next snippet, every line still ending `\r\n`.
    assert!(patched.starts_with(head), "{patched:?}");
    assert!(patched.ends_with(tail), "{patched:?}");
    assert!(patched.contains(definitions), "{patched:?}");
    // Exactly the two asked-for changes, and the new lines follow the file's
    // own `\r\n` convention.
    assert_eq!(
        patched,
        format!(
            "{head}      Name: [[name]][[when]]\r\n{definitions}      when:\r\n        type: text\r\n{tail}"
        )
    );
    assert_eq!(
        shorthand_names(&patched, 0),
        vec!["name".to_owned(), "when".to_owned()]
    );
    assert_eq!(
        the_match(&patched, 0)
            .content
            .form
            .as_ref()
            .map(|form| form.text.clone()),
        Some("Name: [[name]][[when]]\n".to_owned())
    );
    assert_eq!(
        the_match(&patched, 1).source_text,
        "trigger: ':after'\r\n    replace: 'kept'"
    );
} // End of function the_form_editors_wire_draft_keeps_a_crlf_files_untouched_bytes()

/// Phase 4-12: the wire shapes the mounted form builder sends
/// (`src/lib/components/MatchEditorForms.test.ts` pins them on the TypeScript
/// side; nothing ties the two files' literals together but this copy) plan and
/// apply here over one neutral fixture, each changing only what it names: a `values`
/// item rewritten, one removed and two appended; an option this editor does not
/// draft taken out beside a multi-line `values` rewritten as one text; every
/// definition taken out by `RemoveFields`; and a new verbose form inserted with
/// its `{{name.field}}` references. Neutral content only.
#[test]
fn the_form_builders_wire_drafts_apply_and_change_only_what_they_name() {
    let head = "matches:\n  - trigger: ':fb'\n    form: |\n      P: [[pick]] L: [[lines]]\n    form_fields:\n";
    let pick = "      pick:\n        type: choice\n        values:\n          - a\n          - b\n          - c\n        hint: kept as written\n";
    let lines =
        "      lines:\n        type: list\n        values: |\n          one\n          two\n";
    let tail = "  - trigger: ':plain'\n    replace: 'Hello '\n";
    let source = format!("{head}{pick}{lines}{tail}");
    let none = r#""insert_options":{"type":null,"default":null,"multiline":null,"values":null,"trim_string_values":null,"extra":[]}"#;

    // `values` item by item: the rewrite by position, the removal, the append.
    let items = format!(
        r#"{{"form_fields":[{{"index":0,"options":[{{"index":1,"value":"Unchanged","items":[{{"index":0,"value":{{"Set":"A"}}}}]}}],{none},"values":[{{"RemoveItem":{{"index":1}}}},{{"InsertItems":{{"at":{{"End":{{}}}},"items":["d","e"]}}}}]}}]}}"#
    );
    let draft: MatchDraft = serde_json::from_str(&items).expect("the builder's draft reads");
    let (_, patched) = planned(&source, 0, &draft);
    assert_eq!(
        patched,
        format!(
            "{head}      pick:\n        type: choice\n        values:\n          - A\n          - c\n          - d\n          - e\n        hint: kept as written\n{lines}{tail}"
        )
    );

    // An unknown option taken out, and a multi-line `values` kept as one text.
    let options = format!(
        r#"{{"form_fields":[{{"index":0,"options":[{{"index":2,"value":"Remove","items":[]}}],{none},"values":[]}},{{"index":1,"options":[{{"index":1,"value":{{"Set":"one\ntwo\nthree"}},"items":[]}}],{none},"values":[]}}]}}"#
    );
    let draft: MatchDraft = serde_json::from_str(&options).expect("the builder's draft reads");
    let (_, patched) = planned(&source, 0, &draft);
    assert!(patched.starts_with(head), "{patched:?}");
    assert!(patched.ends_with(tail), "{patched:?}");
    assert!(!patched.contains("hint"), "{patched:?}");
    assert!(
        patched.contains("        values:\n          - a\n          - b\n          - c\n"),
        "{patched:?}"
    );
    let view = the_match(&patched, 0);
    let lines_values = view.form_fields[1]
        .value
        .as_mapping()
        .and_then(|options| options.get(1))
        .and_then(|option| option.value.as_scalar())
        .map(|scalar| scalar.text.clone());
    assert_eq!(lines_values.as_deref(), Some("one\ntwo\nthree"));

    // Every definition taken out by one explicit intent; the layout stays.
    let all: MatchDraft =
        serde_json::from_str(r#"{"form_intents":[{"RemoveFields":{}}],"form_fields":[]}"#)
            .expect("the builder's draft reads");
    let (_, patched) = planned(&source, 0, &all);
    assert_eq!(
        patched,
        format!(
            "matches:\n  - trigger: ':fb'\n    form: |\n      P: [[pick]] L: [[lines]]\n{tail}"
        )
    );

    // The Form insertion: the references and the new verbose form, one batch.
    let insertion = r#"{"replace":{"Set":"Hello {{form.a}} {{form.b}}"},"var_intents":[{"InsertVariable":{"at":{"End":{}},"variable":{"name":"form","params":{"Form":{"layout":"A: [[a]] B: [[b]]","fields":[{"name":"b","options":{"type":"choice","default":null,"multiline":null,"values":{"List":["x","y"]},"trim_string_values":null,"extra":[]}}]}},"inject_vars":null,"depends_on":null,"extra_params":[]}}}]}"#;
    let draft: MatchDraft = serde_json::from_str(insertion).expect("the builder's draft reads");
    let (_, patched) = planned(&source, 1, &draft);
    assert!(
        patched.starts_with(&format!("{head}{pick}{lines}")),
        "{patched:?}"
    );
    let inserted = the_match(&patched, 1);
    assert_eq!(
        inserted
            .content
            .replace
            .as_ref()
            .map(|one| one.text.as_str()),
        Some("Hello {{form.a}} {{form.b}}")
    );
    assert_eq!(inserted.vars.len(), 1);
    assert_eq!(verbose_names(&patched, 1, 0), vec!["b".to_owned()]);
} // End of function the_form_builders_wire_drafts_apply_and_change_only_what_they_name()
