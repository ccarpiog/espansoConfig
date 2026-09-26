//! Phase 4-3 acceptance: bounded insertion and removal of an **author-named**
//! `params` entry, the one lift of decision D1 (ruling 7 of
//! `docs/decisions/4-split-notes.md` §3).
//!
//! What this file pins:
//!
//! - a new scalar or scalar-list entry lands as one run after the last entry the
//!   draft leaves in place, and **every byte outside that run is unchanged**;
//! - Unicode and punctuation keys round-trip through the codec's key context;
//! - a duplicate is refused against the mapping's **decoded** keys — so an
//!   equivalently quoted spelling refuses — and against a pending insertion;
//! - `<<`, an empty key, CR/LF and other control characters refuse;
//! - an absent, flow or non-mapping `params` refuses, and so does a draft that
//!   would leave `params:` with no entry (ruling 8);
//! - every refusal carries positions and codes, **never the key text**;
//! - the audit's closed surface admits exactly one new shape, and an insertion
//!   one segment deeper than it is refused.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).

use espansoconfig_core::draft::DraftTarget;
use espansoconfig_core::draft::{
    check_batch_independence, check_closed_surface, plan_match_edits, DraftError, EntryDraft,
    MatchDraft, MatchField, NestedKeys, NewParam, VariableDraft,
};
use espansoconfig_core::model::{DocumentContext, MatchView, ValueKind};
use espansoconfig_core::patch::{
    apply_edits, DocumentEdit, DocumentPath, EditError, EntryValue, FieldInsert, FieldInsertGroup,
    FieldRemoval,
};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::DocumentId;

/// One match whose variables hold every `params` shape the planner decides on.
///
/// Variable 0's keys are written three ways — single-quoted, double-quoted and
/// plain — so a duplicate can only be recognised by decoded text.
const PARAMS: &str = "\
# Author-named params (Phase 4-3). Neutral content only.
matches:
  - trigger: ':p'
    replace: 'value {{v}}'
    vars:
      - name: v
        type: shell
        params:
          'alpha': one  # inline on alpha
          \"beta\": two
          gamma: three
          delta:
            - x
            - y
      - name: w
        type: echo
        params:
          echo: only
      - name: z
        type: echo
      - name: f
        type: echo
        params: {echo: flow}
      - name: s
        type: echo
        params: scalar
      - name: e
        type: echo
        params: {}
      - name: m
        type: choice
        params:
          label: kept
          values:
            - {label: A, id: a}
";

/// A key text no refusal may echo. Every refused key in this file contains it.
const PRIVATE: &str = "zq-private";

/// The only match of `source`, projected as the workspace projects it.
fn the_match(source: &str) -> MatchView {
    let context = DocumentContext::detached(DocumentId(0), "params.yml");
    project_source(&context, source)
        .view
        .matches
        .into_iter()
        .next()
        .expect("the fixture holds one match")
}

/// The path of variable `index` of the only match.
fn variable_path(index: usize) -> DocumentPath {
    DocumentPath::root(0)
        .with_key("matches")
        .with_index(0)
        .with_key("vars")
        .with_index(index)
}

/// The path of the only match's own mapping.
fn match_path() -> DocumentPath {
    DocumentPath::root(0).with_key("matches").with_index(0)
}

/// A draft adding `params` to variable `index`.
fn inserting(index: usize, params: Vec<NewParam>) -> MatchDraft {
    let mut variable = VariableDraft::new(index);
    variable.insert_params = params;
    MatchDraft::new().with_variable(variable)
}

/// Asserts that neither the JSON nor the developer rendering of `error` holds
/// [`PRIVATE`].
fn assert_no_key_text(error: &DraftError) {
    let json = serde_json::to_string(error).expect("a refusal serializes");
    assert!(
        !json.contains(PRIVATE),
        "the wire form echoes the key: {json}"
    );
    assert!(
        !error.to_string().contains(PRIVATE),
        "the developer rendering echoes the key"
    );
    assert!(
        !format!("{error:?}").contains(PRIVATE),
        "the debug rendering echoes the key"
    );
} // End of function assert_no_key_text()

/// Plans `draft`, applies it, and asserts it is **one** zero-width insertion
/// whose surroundings are byte-identical. Returns the patched text.
fn applied_as_one_insertion(draft: &MatchDraft) -> String {
    let view = the_match(PARAMS);
    let edits = plan_match_edits(&view, draft).expect("the draft plans");
    assert_eq!(edits.len(), 1, "one insertion group");
    let patched = apply_edits(PARAMS, &edits).expect("the batch applies");
    assert_eq!(patched.replacements().len(), 1);
    let replacement = &patched.replacements()[0];
    assert_eq!(replacement.span.start, replacement.span.end, "zero width");
    let point = replacement.span.start;
    let expected = format!(
        "{}{}{}",
        &PARAMS[..point],
        replacement.text,
        &PARAMS[point..]
    );
    assert_eq!(
        patched.text(),
        expected,
        "every byte outside the run is unchanged"
    );
    patched.text().to_owned()
} // End of function applied_as_one_insertion()

#[test]
fn a_new_scalar_and_new_lists_are_written_after_the_last_entry() {
    let draft = inserting(
        0,
        vec![
            NewParam::scalar("epsilon", "five"),
            NewParam::list("zeta", vec!["p".to_owned(), "q r".to_owned()]),
            NewParam::list("eta", Vec::new()),
        ],
    );
    let patched = applied_as_one_insertion(&draft);
    let expected = PARAMS.replace(
        "            - y\n",
        "            - y\n          epsilon: five\n          zeta:\n            - p\n            - q r\n          eta: []\n",
    );
    assert_eq!(patched, expected);

    let after = the_match(&patched);
    let keys: Vec<&str> = after.vars[0]
        .params
        .iter()
        .map(|field| field.key.as_ref().expect("a scalar key").text.as_str())
        .collect();
    assert_eq!(
        keys,
        ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta"]
    );
    assert!(after.safely_editable);
} // End of function a_new_scalar_and_new_lists_are_written_after_the_last_entry()

#[test]
fn a_new_value_is_a_logical_string_never_plain_source() {
    // An author-named parameter's type is not inferred (ruling 7): `true` is
    // written as the string it is, quoted by the codec.
    let patched = applied_as_one_insertion(&inserting(0, vec![NewParam::scalar("flag", "true")]));
    assert!(patched.contains("          flag: 'true'\n"), "{patched}");
} // End of function a_new_value_is_a_logical_string_never_plain_source()

#[test]
fn unicode_and_punctuation_keys_round_trip() {
    let keys = [
        "café",
        "cafe\u{301}",
        "ключ",
        "鍵",
        "😀 grin",
        "a: b",
        "a:b",
        "#x",
        "x #y",
        "- x",
        "[x]",
        "{y}",
        "a, b",
        "yes",
        "no",
        "null",
        "~",
        "123",
        "0x1F",
        "1.5e3",
        "'q'",
        "\"dq\"",
        "back\\slash",
        "key with spaces",
        " lead",
        "trail ",
        "?",
        "? q",
        "&a",
        "*b",
        "!t",
        "%p",
        "@at",
        "`tick",
        "|",
        ">",
        "---",
        "...",
        "<",
        "<<<",
        "=",
    ];
    for key in keys {
        let patched = applied_as_one_insertion(&inserting(0, vec![NewParam::scalar(key, "v")]));
        let after = the_match(&patched);
        let last = after.vars[0].params.last().expect("a new entry");
        let written = last.key.as_ref().expect("a scalar key");
        assert!(written.decoded, "{key:?} decodes");
        assert_eq!(written.text, key, "{key:?} round-trips");
        assert_eq!(last.value.as_scalar().expect("a scalar").text, "v");
        assert_eq!(after.vars[0].params.len(), 5, "{key:?} adds one entry");
        assert!(after.safely_editable, "{key:?} leaves the match editable");
    } // End of the loop over the keys
} // End of function unicode_and_punctuation_keys_round_trip()

#[test]
fn a_duplicate_of_an_existing_key_refuses_however_either_is_quoted() {
    let view = the_match(PARAMS);
    for (entry, key) in [(0, "alpha"), (1, "beta"), (2, "gamma"), (3, "delta")] {
        let draft = inserting(0, vec![NewParam::scalar(key, "again")]);
        assert_eq!(
            plan_match_edits(&view, &draft),
            Err(DraftError::NewKeyDuplicatesAnEntry {
                target: DraftTarget::NewParam {
                    variable: 0,
                    insertion: 0,
                },
                entry,
            }),
            "{key:?} is already entry {entry}"
        );
    } // End of the loop over the existing keys

    // An entry the same draft removes still counts.
    let mut draft = inserting(0, vec![NewParam::scalar("gamma", "again")]);
    draft.vars[0].params.push(EntryDraft::new(2).removed());
    assert!(matches!(
        plan_match_edits(&view, &draft),
        Err(DraftError::NewKeyDuplicatesAnEntry { entry: 2, .. })
    ));
} // End of function a_duplicate_of_an_existing_key_refuses_however_either_is_quoted()

#[test]
fn a_duplicate_of_a_pending_insertion_refuses() {
    let view = the_match(PARAMS);
    let draft = inserting(
        0,
        vec![
            NewParam::scalar("zq-private-one", "a"),
            NewParam::scalar("other", "b"),
            NewParam::list("zq-private-one", Vec::new()),
        ],
    );
    let refused = plan_match_edits(&view, &draft).expect_err("refused");
    assert_eq!(
        refused,
        DraftError::NewKeyDuplicatesAnInsertion {
            target: DraftTarget::NewParam {
                variable: 0,
                insertion: 2,
            },
            first: 0,
        }
    );
    assert_no_key_text(&refused);
} // End of function a_duplicate_of_a_pending_insertion_refuses()

#[test]
fn a_key_whose_text_breaks_ruling_seven_refuses_by_position_and_code() {
    let view = the_match(PARAMS);
    let target = DraftTarget::NewParam {
        variable: 0,
        insertion: 1,
    };
    let cases = [
        (String::new(), DraftError::NewKeyIsEmpty { target }),
        (
            format!("{PRIVATE}\nx"),
            DraftError::NewKeyHasALineBreak { target },
        ),
        (
            format!("{PRIVATE}\rx"),
            DraftError::NewKeyHasALineBreak { target },
        ),
        (
            format!("{PRIVATE}\r\nx"),
            DraftError::NewKeyHasALineBreak { target },
        ),
        (
            format!("{PRIVATE}\u{2028}"),
            DraftError::NewKeyHasALineBreak { target },
        ),
        (
            format!("{PRIVATE}\tx"),
            DraftError::NewKeyHasAControlCharacter { target },
        ),
        (
            format!("{PRIVATE}\u{7}"),
            DraftError::NewKeyHasAControlCharacter { target },
        ),
        ("<<".to_owned(), DraftError::NewKeyIsAMergeKey { target }),
    ];
    for (key, expected) in cases {
        let draft = inserting(
            0,
            vec![NewParam::scalar("fine", "a"), NewParam::scalar(key, "b")],
        );
        let refused = plan_match_edits(&view, &draft).expect_err("refused");
        assert_eq!(refused, expected);
        assert_no_key_text(&refused);
    } // End of the loop over the faulty keys
} // End of function a_key_whose_text_breaks_ruling_seven_refuses_by_position_and_code()

#[test]
fn a_new_key_naming_a_typed_setting_refuses_rather_than_quoting_its_value() {
    // Ruling 4: `trim: true` requested as a logical string would be written
    // `trim: 'true'`, A1 one level down. Refused until a later step gives these
    // settings their plain-source policy.
    let view = the_match(PARAMS);
    for key in ["offset", "trim", "debug", "multiline", "trim_string_values"] {
        let draft = inserting(0, vec![NewParam::scalar(key, "true")]);
        assert_eq!(
            plan_match_edits(&view, &draft),
            Err(DraftError::NewKeyIsATypedSetting {
                target: DraftTarget::NewParam {
                    variable: 0,
                    insertion: 0,
                },
            }),
            "{key:?}"
        );
        assert_eq!(
            check_closed_surface(
                &match_path(),
                &[group(variable_path(0).with_key("params"), "delta", &[key])]
            ),
            Err(DraftError::OutsideTheClosedSurface { edit: 0 }),
            "{key:?} is outside the surface as a hand-built batch too"
        );
    } // End of the loop over the typed settings
      // A near spelling is an ordinary author key.
    assert!(plan_match_edits(&view, &inserting(0, vec![NewParam::scalar("trims", "x")])).is_ok());
} // End of function a_new_key_naming_a_typed_setting_refuses_rather_than_quoting_its_value()

#[test]
fn every_refusal_about_a_new_key_carries_no_key_text() {
    let view = the_match(PARAMS);
    let key = format!("{PRIVATE}-key");
    let drafts = [
        inserting(2, vec![NewParam::scalar(key.clone(), "a")]),
        inserting(3, vec![NewParam::scalar(key.clone(), "a")]),
        inserting(4, vec![NewParam::scalar(key.clone(), "a")]),
        inserting(5, vec![NewParam::scalar(key.clone(), "a")]),
        inserting(9, vec![NewParam::scalar(key.clone(), "a")]),
        inserting(
            0,
            vec![
                NewParam::scalar(key.clone(), "a"),
                NewParam::scalar(key.clone(), "b"),
            ],
        ),
    ];
    for draft in drafts {
        let refused = plan_match_edits(&view, &draft).expect_err("refused");
        assert_no_key_text(&refused);
    } // End of the loop over the refused drafts
} // End of function every_refusal_about_a_new_key_carries_no_key_text()

#[test]
fn a_params_that_is_absent_flow_or_not_a_mapping_refuses() {
    let view = the_match(PARAMS);
    let new = || vec![NewParam::scalar("k", "v")];
    assert_eq!(
        plan_match_edits(&view, &inserting(2, new())),
        Err(DraftError::ParamsAbsent { variable: 2 })
    );
    assert_eq!(
        plan_match_edits(&view, &inserting(3, new())),
        Err(DraftError::ParamsIsAFlowMapping { variable: 3 })
    );
    assert_eq!(
        plan_match_edits(&view, &inserting(4, new())),
        Err(DraftError::ParamsHasAnUnsupportedShape {
            variable: 4,
            found: ValueKind::Scalar,
        })
    );
    assert_eq!(
        plan_match_edits(&view, &inserting(5, new())),
        Err(DraftError::ParamsIsAFlowMapping { variable: 5 })
    );
} // End of function a_params_that_is_absent_flow_or_not_a_mapping_refuses()

#[test]
fn a_flat_scalar_list_entry_is_removed_and_a_list_of_records_is_not() {
    let view = the_match(PARAMS);
    let draft = MatchDraft::new()
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(3).removed()));
    let edits = plan_match_edits(&view, &draft).expect("a flat list is removable");
    assert_eq!(
        edits,
        vec![DocumentEdit::from(FieldRemoval::new(
            variable_path(0).with_key("params").with_key("delta")
        ))]
    );
    let patched = apply_edits(PARAMS, &edits).expect("the removal applies");
    assert_eq!(
        patched.text(),
        PARAMS.replace("          delta:\n            - x\n            - y\n", "")
    );

    let records = MatchDraft::new()
        .with_variable(VariableDraft::new(6).with_param(EntryDraft::new(1).removed()));
    assert_eq!(
        plan_match_edits(&view, &records),
        Err(DraftError::NestedRemovalWouldDiscardUnshownStructure {
            target: DraftTarget::Param {
                variable: 6,
                entry: 1,
            },
            found: ValueKind::Sequence,
        })
    );
} // End of function a_flat_scalar_list_entry_is_removed_and_a_list_of_records_is_not()

#[test]
fn removing_the_last_entry_of_params_refuses_rather_than_writing_a_null() {
    let view = the_match(PARAMS);
    let draft = MatchDraft::new()
        .with_variable(VariableDraft::new(1).with_param(EntryDraft::new(0).removed()));
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::ParamsWouldBeEmpty { variable: 1 })
    );
    // Replacing it in the same draft has no anchor that survives the batch.
    let mut replaced = draft.clone();
    replaced.vars[0]
        .insert_params
        .push(NewParam::scalar("echo2", "new"));
    assert_eq!(
        plan_match_edits(&view, &replaced),
        Err(DraftError::NoParamInsertionAnchor { variable: 1 })
    );
} // End of function removing_the_last_entry_of_params_refuses_rather_than_writing_a_null()

#[test]
fn an_insertion_beside_a_removal_is_written_after_an_entry_whose_successor_stays() {
    let mut draft = inserting(0, vec![NewParam::scalar("omega", "last")]);
    draft.vars[0].params.push(EntryDraft::new(3).removed());
    let view = the_match(PARAMS);
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    assert_eq!(edits.len(), 2);
    let patched = apply_edits(PARAMS, &edits).expect("the batch applies");
    let expected = PARAMS
        .replace("          delta:\n            - x\n            - y\n", "")
        .replace(
            "          \"beta\": two\n",
            "          \"beta\": two\n          omega: last\n",
        );
    assert_eq!(patched.text(), expected);
} // End of function an_insertion_beside_a_removal_is_written_after_an_entry_whose_successor_stays()

#[test]
fn a_new_param_and_edits_elsewhere_save_as_one_batch() {
    let view = the_match(PARAMS);
    let mut variable = VariableDraft::new(1).with_param(EntryDraft::new(0).set("changed"));
    variable
        .insert_params
        .push(NewParam::scalar("extra", "added"));
    let draft = MatchDraft::new()
        .with(MatchField::Replace, "new content {{v}}")
        .with_variable(variable)
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(3).with_item(1, "z")))
        .with_variable(
            inserting(0, vec![NewParam::scalar("more", "m")])
                .vars
                .remove(0),
        );
    // Variable 0 is drafted twice: refused at intent level, as before 4-3.
    assert!(matches!(
        plan_match_edits(&view, &draft),
        Err(DraftError::TargetDraftedTwice { .. })
    ));

    let mut zero = VariableDraft::new(0).with_param(EntryDraft::new(3).with_item(1, "z"));
    zero.insert_params.push(NewParam::scalar("more", "m"));
    let mut one = VariableDraft::new(1).with_param(EntryDraft::new(0).set("changed"));
    one.insert_params.push(NewParam::scalar("extra", "added"));
    let draft = MatchDraft::new()
        .with(MatchField::Replace, "new content {{v}}")
        .with_variable(zero)
        .with_variable(one);
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    assert_eq!(edits.len(), 5);
    let patched = apply_edits(PARAMS, &edits).expect("the batch applies");
    let expected = PARAMS
        .replace("'value {{v}}'", "'new content {{v}}'")
        .replace("            - y\n", "            - z\n          more: m\n")
        .replace(
            "          echo: only\n",
            "          echo: changed\n          extra: added\n",
        );
    assert_eq!(patched.text(), expected);
} // End of function a_new_param_and_edits_elsewhere_save_as_one_batch()

#[test]
fn a_new_param_after_an_edited_block_scalar_lands_after_it() {
    let source = "\
matches:
  - trigger: ':b'
    replace: '{{v}}'
    vars:
      - name: v
        type: shell
        params:
          cmd: |
            first line
            second line
";
    let view = the_match(source);
    let mut variable = VariableDraft::new(0).with_param(EntryDraft::new(0).set("other\ntext\n"));
    variable.insert_params.push(NewParam::scalar("shell", "sh"));
    let draft = MatchDraft::new().with_variable(variable);
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    let patched = apply_edits(source, &edits).expect("the batch applies");
    assert_eq!(
        patched.text(),
        source.replace(
            "            first line\n            second line\n",
            "            other\n            text\n          shell: sh\n"
        )
    );
} // End of function a_new_param_after_an_edited_block_scalar_lands_after_it()

#[test]
fn the_engine_refuses_an_equivalently_quoted_duplicate_on_its_own() {
    // A hand-built batch that bypasses the planner meets the same rule in the
    // engine, which compares decoded keys too.
    let group = FieldInsertGroup::typed(
        variable_path(0).with_key("params"),
        Some("delta".to_owned()),
        vec![("alpha".to_owned(), EntryValue::Scalar("again".to_owned()))],
    )
    .expect("one entry");
    assert!(matches!(
        apply_edits(PARAMS, &[group.into()]),
        Err(EditError::KeyAlreadyPresent { .. })
    ));
} // End of function the_engine_refuses_an_equivalently_quoted_duplicate_on_its_own()

#[test]
fn a_new_param_crosses_the_wire_as_a_closed_shape() {
    let draft: VariableDraft = serde_json::from_str(
        r#"{"index": 0, "insert_params": [
            {"key": "k", "value": {"Scalar": "v"}},
            {"key": "l", "value": {"List": ["a", "b"]}}
        ]}"#,
    )
    .expect("the wire form reads");
    assert_eq!(
        draft.insert_params,
        vec![
            NewParam::scalar("k", "v"),
            NewParam::list("l", vec!["a".to_owned(), "b".to_owned()])
        ]
    );
    let missing: VariableDraft =
        serde_json::from_str(r#"{"index": 0}"#).expect("insert_params defaults to empty");
    assert!(missing.insert_params.is_empty());
    for refused in [
        r#"{"index": 0, "insert_params": [{"key": "k", "value": {"Scalar": "v"}, "after": "x"}]}"#,
        r#"{"index": 0, "insert_params": [{"key": "k", "value": {"Mapping": {}}}]}"#,
        r#"{"index": 0, "insert_params": [{"key": "k", "value": {"List": [["nested"]]}}]}"#,
    ] {
        assert!(
            serde_json::from_str::<VariableDraft>(refused).is_err(),
            "{refused}"
        );
    }
} // End of function a_new_param_crosses_the_wire_as_a_closed_shape()

// ---------------------------------------------------------------------------
// The audit, over hand-built batches
// ---------------------------------------------------------------------------

/// A group of scalar entries into `mapping`, after `sibling`.
fn group(mapping: DocumentPath, sibling: &str, keys: &[&str]) -> DocumentEdit {
    FieldInsertGroup::typed(
        mapping,
        Some(sibling.to_owned()),
        keys.iter()
            .map(|key| ((*key).to_owned(), EntryValue::Scalar("v".to_owned())))
            .collect(),
    )
    .expect("a non-empty group")
    .into()
} // End of function group()

#[test]
fn the_closed_surface_admits_a_group_into_params_and_nothing_near_it() {
    let mapping = match_path();
    let params = variable_path(0).with_key("params");
    assert_eq!(
        check_closed_surface(&mapping, &[group(params.clone(), "delta", &["k"])]),
        Ok(())
    );
    let list = FieldInsertGroup::typed(
        params.clone(),
        None,
        vec![("k".to_owned(), EntryValue::ScalarList(vec!["a".to_owned()]))],
    )
    .expect("one entry");
    assert_eq!(check_closed_surface(&mapping, &[list.into()]), Ok(()));

    let refused: Vec<DocumentEdit> = vec![
        // Plain source is not offered for an author-named parameter.
        FieldInsertGroup::typed(
            params.clone(),
            None,
            vec![("k".to_owned(), EntryValue::PlainSource("true".to_owned()))],
        )
        .expect("one entry")
        .into(),
        // A single insertion is not the named shape.
        FieldInsert::new(params.clone(), "k", "v").into(),
        // Keys ruling 7 refuses.
        group(params.clone(), "delta", &["<<"]),
        group(params.clone(), "delta", &[""]),
        group(params.clone(), "delta", &["a\nb"]),
        group(params.clone(), "delta", &["a\tb"]),
        // One segment shallower: the variable's own mapping.
        group(variable_path(0), "params", &["k"]),
        // Another open mapping: one segment below a form field's options
        // (the options themselves take new options since Phase 4-6), and
        // `params.fields` holding scalar entries rather than definitions.
        group(
            mapping
                .clone()
                .with_key("form_fields")
                .with_key("f")
                .with_key("type"),
            "a",
            &["k"],
        ),
        group(params.clone().with_key("fields"), "a", &["k"]),
    ];
    for (position, edit) in refused.into_iter().enumerate() {
        assert_eq!(
            check_closed_surface(&mapping, &[edit]),
            Err(DraftError::OutsideTheClosedSurface { edit: 0 }),
            "case {position} is outside the surface"
        );
    } // End of the loop over the refused shapes
} // End of function the_closed_surface_admits_a_group_into_params_and_nothing_near_it()

#[test]
fn an_insertion_one_segment_deeper_than_params_is_refused() {
    let mapping = match_path();
    let deeper = variable_path(0).with_key("params").with_key("delta");
    assert_eq!(
        check_closed_surface(&mapping, &[group(deeper, "x", &["k"])]),
        Err(DraftError::OutsideTheClosedSurface { edit: 0 })
    );
    let deeper_list = FieldInsertGroup::typed(
        variable_path(0).with_key("params").with_key("gamma"),
        None,
        vec![("k".to_owned(), EntryValue::ScalarList(Vec::new()))],
    )
    .expect("one entry");
    assert_eq!(
        check_closed_surface(&mapping, &[deeper_list.into()]),
        Err(DraftError::OutsideTheClosedSurface { edit: 0 })
    );
    // A removal one segment deeper than a `params` entry is refused too.
    assert_eq!(
        check_closed_surface(
            &mapping,
            &[FieldRemoval::new(
                variable_path(0)
                    .with_key("params")
                    .with_key("delta")
                    .with_key("x")
            )
            .into()]
        ),
        Err(DraftError::OutsideTheClosedSurface { edit: 0 })
    );
} // End of function an_insertion_one_segment_deeper_than_params_is_refused()

#[test]
fn nested_insertions_are_checked_for_independence_against_their_own_key_list() {
    let mapping = match_path();
    let original = vec![
        "trigger".to_owned(),
        "replace".to_owned(),
        "vars".to_owned(),
    ];
    let params = variable_path(0).with_key("params");
    let keys: Vec<String> = ["alpha", "beta", "gamma", "delta"]
        .iter()
        .map(|key| (*key).to_owned())
        .collect();
    let nested = vec![NestedKeys::new(params.clone(), keys)];
    let check = |nested: &[NestedKeys], edits: &[DocumentEdit]| {
        check_batch_independence(&mapping, &original, nested, edits)
    };

    assert_eq!(
        check(&nested, &[group(params.clone(), "delta", &["k"])]),
        Ok(())
    );
    // No key list for the mapping: the anchor cannot be shown to be original.
    assert_eq!(
        check(&[], &[group(params.clone(), "delta", &["k"])]),
        Err(DraftError::InsertionAnchorNotInOriginal { edit: 0 })
    );
    // A key the mapping holds, and one two insertions both write.
    assert_eq!(
        check(&nested, &[group(params.clone(), "delta", &["beta"])]),
        Err(DraftError::InsertionKeyAlreadyPresent { edit: 0 })
    );
    assert_eq!(
        check(
            &nested,
            &[
                group(params.clone(), "alpha", &["k"]),
                group(params.clone(), "delta", &["k"])
            ]
        ),
        Err(DraftError::InsertionKeyAlreadyPresent { edit: 1 })
    );
    // An anchor the mapping does not hold, one the batch inserts, one it
    // removes, and one two insertion edits share.
    assert_eq!(
        check(&nested, &[group(params.clone(), "omega", &["k"])]),
        Err(DraftError::InsertionAnchorNotInOriginal { edit: 0 })
    );
    assert_eq!(
        check(
            &nested,
            &[
                group(params.clone(), "delta", &["k"]),
                group(params.clone(), "k", &["l"])
            ]
        ),
        Err(DraftError::InsertionAnchorIsInserted { edit: 1 })
    );
    assert_eq!(
        check(
            &nested,
            &[
                FieldRemoval::new(params.clone().with_key("delta")).into(),
                group(params.clone(), "delta", &["k"])
            ]
        ),
        Err(DraftError::InsertionAnchorRemoved { edit: 1 })
    );
    assert_eq!(
        check(
            &nested,
            &[
                group(params.clone(), "delta", &["k"]),
                group(params.clone(), "delta", &["l"])
            ]
        ),
        Err(DraftError::SharedInsertionAnchor {
            first: 0,
            second: 1
        })
    );
} // End of function nested_insertions_are_checked_for_independence_against_their_own_key_list()

/// The 4-3 review's first finding: a new `params` entry and a new field of the
/// match in one batch. Failed first on the unfixed tree with
/// `Verification(SiblingChanged { edit: 1, entry: 2 })` — the match-level
/// claim digested the `vars` sibling the nested insertion changes.
#[test]
fn a_new_param_and_a_new_match_field_save_as_one_batch() {
    let source = "\
matches:
  - trigger: ':c'
    replace: '{{v}}'
    vars:
      - name: v
        type: echo
        params:
          echo: x
";
    let view = the_match(source);
    let mut variable = VariableDraft::new(0);
    variable.insert_params.push(NewParam::scalar("extra", "z"));
    let draft = MatchDraft::new()
        .with(MatchField::Label, "L")
        .with_variable(variable.clone());
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    let patched = apply_edits(source, &edits).expect("the batch applies");
    let starts: Vec<usize> = patched
        .replacements()
        .iter()
        .map(|r| r.span.start)
        .collect();
    assert_eq!(starts.len(), 2);
    assert_ne!(starts[0], starts[1], "no two insertions share an offset");
    assert_eq!(
        patched.text(),
        source
            .replace(
                "    replace: '{{v}}'\n",
                "    replace: '{{v}}'\n    label: L\n"
            )
            .replace(
                "          echo: x\n",
                "          echo: x\n          extra: z\n"
            )
    );

    // A nested removal beside a match-level insertion composes the same way.
    let removal = MatchDraft::new()
        .with(MatchField::Label, "L")
        .with_variable(
            VariableDraft::new(0)
                .with_param(EntryDraft::new(0).removed())
                .with_new_param(NewParam::scalar("extra", "z")),
        );
    assert!(matches!(
        plan_match_edits(&view, &removal),
        Err(DraftError::NoParamInsertionAnchor { variable: 0 })
    ));
    let two = the_match(patched.text());
    let removal = MatchDraft::new()
        .with(MatchField::Comment, "C")
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(0).removed()));
    let edits = plan_match_edits(&two, &removal).expect("the draft plans");
    let again = apply_edits(patched.text(), &edits).expect("the batch applies");
    assert_eq!(
        again.text(),
        patched
            .text()
            .replace("    label: L\n", "    label: L\n    comment: C\n")
            .replace("          echo: x\n", "")
    );
} // End of function a_new_param_and_a_new_match_field_save_as_one_batch()
