//! Phase 3-6-1: list intents and trigger-form changes as fields of the draft.
//!
//! Since 3-6-1 [`MatchDraft`] carries `sequences` (the 3-2 list intents) and
//! `trigger_form` (a `trigger`↔`regex` rename or a 3-2 [`TriggerSwitch`]), so the
//! match editor's list and trigger-form controls reach the planner through
//! `save_match` with no new command. This file pins three things:
//!
//! - **one intent, two spellings, one batch** — a draft field plans exactly what
//!   the same intent passed as a [`MatchStructure`] plans;
//! - **the wire form is closed** — espanso keys, a non-empty item list, a
//!   placement that is an index and never an offset, and nothing else;
//! - **style is kept** — a flow list stays a flow list and a block list a block
//!   list when items are added and removed through the draft.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).

use espansoconfig_core::draft::DraftField;
use espansoconfig_core::draft::{
    plan_match_edits, plan_match_edits_with, DraftError, ItemDraft, MatchDraft, MatchField,
    MatchStructure, ScalarItems, SequenceField, SequenceIntent, TriggerForm, TriggerFormChange,
    TriggerSwitch,
};
use espansoconfig_core::model::{DocumentContext, MatchView};
use espansoconfig_core::patch::{apply_edits, ItemPlacement};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::DocumentId;

/// A block list, a flow list and a single trigger, with comments to keep.
const LISTS: &str = "\
# Lists for the draft's own fields (Phase 3-6-1). Neutral content only.
matches:
  - triggers:
      # the first alias
      - ':one'  # inline on it
      - ':two'
      - ':three'
    replace: three aliases
    search_terms: [alpha, beta]
  - trigger: ':single'  # inline on the trigger
    replace: one trigger
    search_terms:
      - first term
      - second term
";

/// The match at `index` of `source`, projected as the workspace projects it.
fn match_at(source: &str, index: usize) -> MatchView {
    let context = DocumentContext::detached(DocumentId(0), "wire.yml");
    project_source(&context, source)
        .view
        .matches
        .into_iter()
        .nth(index)
        .expect("the fixture holds that match")
}

/// `ScalarItems` from string literals.
fn items(values: &[&str]) -> ScalarItems {
    ScalarItems::from_vec(values.iter().map(|value| (*value).to_owned()).collect())
        .expect("at least one item")
}

/// Plans `draft` for the match at `index` and applies it.
fn applied(source: &str, index: usize, draft: &MatchDraft) -> String {
    let edits = plan_match_edits(&match_at(source, index), draft).expect("the draft plans");
    apply_edits(source, &edits)
        .expect("the batch applies")
        .text()
        .to_owned()
}

/// **One intent, two spellings, one batch**: list intents drafted on the draft
/// itself plan exactly the batch the same intents plan as a structure argument.
#[test]
fn drafted_list_intents_plan_as_the_structure_argument_does() {
    let view = match_at(LISTS, 0);
    let intents = vec![
        SequenceIntent::InsertItems {
            field: SequenceField::Triggers,
            at: ItemPlacement::After(0),
            items: items(&[":new"]),
        },
        SequenceIntent::RemoveItem {
            field: SequenceField::Triggers,
            index: 2,
        },
        SequenceIntent::InsertItems {
            field: SequenceField::SearchTerms,
            at: ItemPlacement::End,
            items: items(&["gamma"]),
        },
    ];
    let mut drafted = MatchDraft::new();
    for intent in &intents {
        drafted = drafted.with_sequence(intent.clone());
    }
    let argued = plan_match_edits_with(
        &view,
        &MatchDraft::new(),
        &MatchStructure {
            sequences: intents,
            ..MatchStructure::default()
        },
    )
    .expect("the argued intents plan");
    assert_eq!(
        plan_match_edits(&view, &drafted).expect("the drafted intents plan"),
        argued
    );
} // End of function drafted_list_intents_plan_as_the_structure_argument_does()

/// **Style is kept**: adding and removing through the draft leaves a flow list
/// in brackets and a block list in block style, with the comments where they
/// were and an edited survivor beside them.
#[test]
fn drafted_items_keep_the_list_style_and_the_intended_order() {
    let draft = MatchDraft::new()
        .with_sequence(SequenceIntent::InsertItems {
            field: SequenceField::SearchTerms,
            at: ItemPlacement::Front,
            items: items(&["zero"]),
        })
        .with_sequence(SequenceIntent::RemoveItem {
            field: SequenceField::Triggers,
            index: 1,
        })
        .with_sequence(SequenceIntent::InsertItems {
            field: SequenceField::Triggers,
            at: ItemPlacement::End,
            items: items(&[":four", ":five"]),
        })
        .with_item(SequenceField::Triggers, 0, ":first");
    let written = applied(LISTS, 0, &draft);
    assert!(
        written.contains("    search_terms: ['zero', alpha, beta]\n"),
        "a flow list stays a flow list:\n{written}"
    );
    assert!(
        written.contains(
            "      # the first alias\n      - ':first'  # inline on it\n      - ':three'\n      - ':four'\n      - ':five'\n"
        ),
        "a block list stays a block list, in the intended order:\n{written}"
    );

    let block = MatchDraft::new().with_sequence(SequenceIntent::InsertItems {
        field: SequenceField::SearchTerms,
        at: ItemPlacement::After(0),
        items: items(&["middle term"]),
    });
    let written = applied(LISTS, 1, &block);
    assert!(
        written.contains("      - first term\n      - middle term\n      - second term\n"),
        "{written}"
    );
} // End of function drafted_items_keep_the_list_style_and_the_intended_order()

/// A drafted rename plans as the 3-1 substitution, and a drafted switch as the
/// 3-2 structure switch.
#[test]
fn a_drafted_trigger_form_change_plans_as_the_argued_one() {
    let single = match_at(LISTS, 1);
    let rename = MatchDraft::new()
        .with(MatchField::Regex, "^single$")
        .with_trigger_form(TriggerFormChange::Rename {
            from: TriggerForm::Trigger,
        });
    let written = applied(LISTS, 1, &rename);
    assert!(
        written.contains("  - regex: '^single$'  # inline on the trigger\n"),
        "{written}"
    );

    let switch = TriggerSwitch::ToList {
        from: TriggerForm::Trigger,
        items: items(&[":single", ":alias"]),
    };
    let drafted = MatchDraft::new().with_trigger_form(TriggerFormChange::Switch {
        switch: switch.clone(),
    });
    let argued = plan_match_edits_with(
        &single,
        &MatchDraft::new(),
        &MatchStructure::new().with_switch(switch),
    )
    .expect("the argued switch plans");
    assert_eq!(
        plan_match_edits(&single, &drafted).expect("the drafted switch plans"),
        argued
    );
} // End of function a_drafted_trigger_form_change_plans_as_the_argued_one()

/// **Multiple→single never drops an alias silently**, through the draft: a
/// longer list is refused by name, with the count.
#[test]
fn a_drafted_switch_from_a_longer_list_is_refused_with_its_count() {
    let draft = MatchDraft::new().with_trigger_form(TriggerFormChange::Switch {
        switch: TriggerSwitch::FromList {
            to: TriggerForm::Trigger,
            value: ":one".to_owned(),
        },
    });
    assert_eq!(
        plan_match_edits(&match_at(LISTS, 0), &draft),
        Err(DraftError::SwitchWouldDiscardItems {
            field: SequenceField::Triggers,
            items: 3
        })
    );
} // End of function a_drafted_switch_from_a_longer_list_is_refused_with_its_count()

/// A draft switch beside a structure switch is two intents about `triggers`,
/// and a switch beside a drafted `triggers` item intent is one too.
#[test]
fn a_switch_is_the_only_intent_about_triggers() {
    let single = match_at(LISTS, 1);
    let switch = TriggerSwitch::ToList {
        from: TriggerForm::Trigger,
        items: items(&[":x"]),
    };
    let drafted = MatchDraft::new().with_trigger_form(TriggerFormChange::Switch {
        switch: switch.clone(),
    });
    assert_eq!(
        plan_match_edits_with(
            &single,
            &drafted,
            &MatchStructure::new().with_switch(switch)
        ),
        Err(DraftError::SequenceIntentsConflict {
            field: SequenceField::Triggers
        })
    );
    let beside = MatchDraft::new()
        .with_trigger_form(TriggerFormChange::Rename {
            from: TriggerForm::Trigger,
        })
        .with(MatchField::Trigger, ":changed");
    assert_eq!(
        plan_match_edits(&single, &beside),
        Err(DraftError::SubstitutionConflictsWithField {
            field: MatchField::Trigger
        })
    );
} // End of function a_switch_is_the_only_intent_about_triggers()

/// The wire form: externally tagged, espanso keys, a non-empty item list, a
/// placement object, and nothing else.
#[test]
fn the_list_and_trigger_form_wire_forms_are_closed() {
    let draft = MatchDraft::new()
        .with_sequence(SequenceIntent::InsertItems {
            field: SequenceField::SearchTerms,
            at: ItemPlacement::After(1),
            items: items(&["gamma"]),
        })
        .with_sequence(SequenceIntent::RemoveField {
            field: SequenceField::Triggers,
        })
        .with_trigger_form(TriggerFormChange::Rename {
            from: TriggerForm::Regex,
        });
    let written = serde_json::to_value(&draft).expect("serializes");
    assert_eq!(
        written["sequences"],
        serde_json::json!([
            { "InsertItems": { "field": "search_terms", "at": { "After": { "index": 1 } }, "items": ["gamma"] } },
            { "RemoveField": { "field": "triggers" } }
        ])
    );
    assert_eq!(
        written["trigger_form"],
        serde_json::json!({ "Rename": { "from": "regex" } })
    );
    let read: MatchDraft = serde_json::from_value(written).expect("reads back");
    assert_eq!(read, draft);

    let switch: MatchDraft = serde_json::from_str(
        r#"{"trigger_form": {"Switch": {"switch": {"ToList": {"from": "trigger", "items": [":a", ":b"]}}}},
            "sequences": [{"InsertItems": {"field": "triggers", "at": {"Front": {}}, "items": [":c"]}},
                          {"RemoveItem": {"field": "search_terms", "index": 0}},
                          {"InsertField": {"field": "search_terms", "items": []}}]}"#,
    )
    .expect("every variant is read");
    assert_eq!(switch.sequences.len(), 3);
    assert!(matches!(
        switch.trigger_form,
        Some(TriggerFormChange::Switch {
            switch: TriggerSwitch::ToList { .. }
        })
    ));
    let absent: MatchDraft = serde_json::from_str("{}").expect("absent fields are read");
    assert_eq!(absent.trigger_form, None);
    assert!(absent.sequences.is_empty());
    assert_eq!(absent.triggers, Vec::<ItemDraft>::new());
    assert_eq!(absent.trigger, DraftField::Unchanged);

    for refused in [
        // No new item at all: "add no items" has no spelling.
        r#"{"sequences": [{"InsertItems": {"field": "triggers", "at": {"End": {}}, "items": []}}]}"#,
        r#"{"trigger_form": {"Switch": {"switch": {"ToList": {"from": "trigger", "items": []}}}}}"#,
        // A list outside the two.
        r#"{"sequences": [{"RemoveField": {"field": "vars"}}]}"#,
        // A Rust identifier where the espanso key belongs.
        r#"{"trigger_form": {"Rename": {"from": "Trigger"}}}"#,
        // A placement that is not one of the three.
        r#"{"sequences": [{"InsertItems": {"field": "triggers", "at": {"Offset": {"index": 3}}, "items": [":x"]}}]}"#,
        // An unknown field inside a variant.
        r#"{"sequences": [{"RemoveItem": {"field": "triggers", "index": 0, "keep": true}}]}"#,
        r#"{"trigger_form": {"Rename": {"from": "trigger", "to": "regex"}}}"#,
    ] {
        assert!(
            serde_json::from_str::<MatchDraft>(refused).is_err(),
            "{refused} must be refused"
        );
    } // End of the loop over the refused wire forms
} // End of function the_list_and_trigger_form_wire_forms_are_closed()

/// **The intended order when a new item takes a removed item's place**: the
/// model places a run above the next kept item, which may mean `After` an item
/// the same batch removes — the insertion then lands on the kept item, never on
/// the removal, and the result is exactly the drafted order.
#[test]
fn an_item_placed_after_a_removed_item_lands_in_the_intended_order() {
    let draft = MatchDraft::new()
        .with_sequence(SequenceIntent::RemoveItem {
            field: SequenceField::Triggers,
            index: 1,
        })
        .with_sequence(SequenceIntent::InsertItems {
            field: SequenceField::Triggers,
            at: ItemPlacement::After(1),
            items: items(&[":new"]),
        });
    let written = applied(LISTS, 0, &draft);
    let after = match_at(&written, 0);
    let texts: Vec<String> = after
        .trigger
        .triggers
        .iter()
        .filter_map(|value| value.as_scalar().map(|scalar| scalar.text.clone()))
        .collect();
    assert_eq!(texts, vec![":one", ":new", ":three"], "{written}");
    assert!(written.contains("      # the first alias\n"), "{written}");
} // End of function an_item_placed_after_a_removed_item_lands_in_the_intended_order()

/// The flow and block list fixtures the review fix pins, byte for byte.
const FLOW_TERMS: &str =
    "matches:\n  - trigger: ':x'\n    replace: y\n    search_terms: [a, b, c]\n";

/// A block list of the same three items.
const BLOCK_TERMS: &str =
    "matches:\n  - trigger: ':x'\n    replace: y\n    search_terms:\n      - a\n      - b\n      - c\n";

/// A removal of `search_terms[index]`.
fn remove_term(index: usize) -> SequenceIntent {
    SequenceIntent::RemoveItem {
        field: SequenceField::SearchTerms,
        index,
    }
}

/// An insertion into `search_terms`.
fn insert_terms(at: ItemPlacement, values: &[&str]) -> SequenceIntent {
    SequenceIntent::InsertItems {
        field: SequenceField::SearchTerms,
        at,
        items: items(values),
    }
}

/// **Review fix, flow lists**: in a flow list a removal takes its separator, so
/// an insertion `After` the removed item overlaps it and the engine refuses the
/// batch. The model rewrites the removed item in place instead; every shape it
/// generates is pinned here byte for byte.
#[test]
fn flow_list_rewrites_in_a_removed_place_are_disjoint_and_byte_exact() {
    let overlapping = MatchDraft::new()
        .with_sequence(remove_term(1))
        .with_sequence(insert_terms(ItemPlacement::After(1), &["new"]));
    let edits = plan_match_edits(&match_at(FLOW_TERMS, 0), &overlapping).expect("it plans");
    assert!(
        apply_edits(FLOW_TERMS, &edits).is_err(),
        "the shape the model no longer generates overlaps"
    );
    let head = "matches:\n  - trigger: ':x'\n    replace: y\n";
    let cases: Vec<(MatchDraft, &str)> = vec![
        (
            MatchDraft::new().with_item(SequenceField::SearchTerms, 1, "new"),
            "    search_terms: [a, 'new', c]\n",
        ),
        (
            MatchDraft::new()
                .with_item(SequenceField::SearchTerms, 1, "new")
                .with_sequence(insert_terms(ItemPlacement::After(1), &["new2"])),
            "    search_terms: [a, 'new', 'new2', c]\n",
        ),
        (
            MatchDraft::new()
                .with_item(SequenceField::SearchTerms, 1, "new")
                .with_sequence(remove_term(2)),
            "    search_terms: [a, 'new']\n",
        ),
        (
            MatchDraft::new()
                .with_item(SequenceField::SearchTerms, 0, "new")
                .with_sequence(remove_term(1)),
            "    search_terms: ['new', c]\n",
        ),
    ];
    for (draft, tail) in cases {
        assert_eq!(applied(FLOW_TERMS, 0, &draft), format!("{head}{tail}"));
    } // End of the loop over the generated flow shapes
} // End of function flow_list_rewrites_in_a_removed_place_are_disjoint_and_byte_exact()

/// **Review fix, block lists**: the same drafted shapes keep the placement above
/// the next kept item, whose spans are disjoint in a block list (a removal takes
/// whole lines), byte for byte.
#[test]
fn block_list_insertions_beside_removals_are_byte_exact() {
    let head = "matches:\n  - trigger: ':x'\n    replace: y\n    search_terms:\n";
    let cases: Vec<(MatchDraft, &str)> = vec![
        (
            MatchDraft::new()
                .with_sequence(remove_term(1))
                .with_sequence(insert_terms(ItemPlacement::After(1), &["new"])),
            "      - a\n      - new\n      - c\n",
        ),
        (
            MatchDraft::new()
                .with_sequence(remove_term(0))
                .with_sequence(insert_terms(ItemPlacement::After(0), &["new"])),
            "      - new\n      - b\n      - c\n",
        ),
        (
            MatchDraft::new()
                .with_sequence(remove_term(2))
                .with_sequence(insert_terms(ItemPlacement::End, &["new"])),
            "      - a\n      - b\n      - new\n",
        ),
    ];
    for (draft, tail) in cases {
        assert_eq!(applied(BLOCK_TERMS, 0, &draft), format!("{head}{tail}"));
    } // End of the loop over the block shapes
} // End of function block_list_insertions_beside_removals_are_byte_exact()
