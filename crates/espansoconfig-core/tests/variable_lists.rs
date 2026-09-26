//! Phase 4-5 acceptance: variable lists and labelled choices
//! (`docs/decisions/4-split-notes.md` §2, step 4-5).
//!
//! What this file pins, over `depends_on`, `random.choices`, `script.args`,
//! `choice` string `values` and `{label, id}` records:
//!
//! - first, middle and last additions and removals, with the comments an item
//!   owns travelling with it;
//! - empty lists: `[]` takes strings between its brackets and never a record,
//!   and removing the last item is refused rather than leaving `[]` or a null;
//! - changed survivors: an insertion, a removal and a rewrite of a surviving
//!   item of one list in one batch;
//! - several insertions at one boundary, as strings and as records;
//! - string and record shapes stay distinct, in both directions and for edits;
//! - an existing flow list stays flow, or is refused by type (Phase 3 ruling 5);
//! - a flow list holding a comment keeps its `CommentInFlowCollection` refusal
//!   (C2, retained and pinned here);
//! - unknown entries inside a record survive every edit of it;
//! - every refusal carries positions and codes, never a name, key or value.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).

use espansoconfig_core::draft::{
    check_batch_independence, check_closed_surface, plan_match_edits, ChoiceRecord,
    ChoiceRecordDraft, ChoiceRecordField, ChoiceRecords, DraftError, DraftTarget, EntryDraft,
    ListPlacement, MatchDraft, NewListItems, NewParam, ScalarItems, VariableDraft, VariableList,
    VariableListIntent, VarsIntent,
};
use espansoconfig_core::model::{DocumentContext, MatchView, ValueKind, ValueView, VariableKind};
use espansoconfig_core::patch::{
    apply_edits, insertion_landings, item_positions, DocumentEdit, DocumentPath, EntryValue,
    InsertItem, ItemPlacement, ItemValue, RemoveItem, ScalarEdit, ScalarItemInsert,
};
use espansoconfig_core::syntax::HazardKind;
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::DocumentId;

/// Two matches. The first holds one variable per list shape; the second holds a
/// flow list with a comment between its brackets.
///
/// | Variable | Kind | Lists |
/// |---|---|---|
/// | 0 `pick` | choice | block `depends_on` (first item owns a comment), block string `values` |
/// | 1 `roll` | random | flow `depends_on: [run]`, flow `choices` |
/// | 2 `run` | script | block `args` after `trim: true` |
/// | 3 `mood` | choice | block records, the first holding an unknown `emoji` entry |
/// | 4 `hollow` | choice | `depends_on: []`, `values: []` |
/// | 5 `flowrec` | choice | flow records |
/// | 6 `deep` | choice | a record holding a nested list |
const LISTS: &str = "\
# Variable lists (Phase 4-5). Neutral content only.
matches:
  - trigger: ':lists'
    replace: 'x'
    vars:
      - name: pick
        type: choice
        depends_on:
          # Owned by the first dependency.
          - roll
          - run
          - mood
        params:
          values:
            - alpha
            - beta
            - gamma
      - name: roll
        type: random
        depends_on: [run]
        params:
          choices: [one, two, three]
      - name: run
        type: script
        params:
          trim: true
          args:
            - /bin/echo
            - hello
      - name: mood
        type: choice
        params:
          values:
            - label: Happy
              id: happy
              emoji: smile
            - label: Calm
              id: calm
            - label: Tired
              id: tired
      - name: hollow
        type: choice
        depends_on: []
        params:
          values: []
      - name: flowrec
        type: choice
        params:
          values: [{label: A, id: a}, {label: B, id: b}]
      - name: deep
        type: choice
        params:
          values:
            - label: Nested
              id: nested
              extra:
                - one
            - label: Flat
              id: flat
  - trigger: ':commented'
    replace: 'y'
    vars:
      - name: c
        type: random
        params:
          choices: [x, # a comment inside the brackets
            y]
";

/// A text no refusal may echo.
const PRIVATE: &str = "zq-private";

/// Match `index` of `source`, projected as the workspace projects it.
fn the_match(source: &str, index: usize) -> MatchView {
    let context = DocumentContext::detached(DocumentId(0), "lists.yml");
    project_source(&context, source)
        .view
        .matches
        .into_iter()
        .nth(index)
        .expect("the fixture holds the match")
}

/// A draft holding one drafted variable.
fn drafting(variable: VariableDraft) -> MatchDraft {
    MatchDraft::new().with_variable(variable)
}

/// A draft of variable `index` holding the given list intents.
fn listing(index: usize, intents: Vec<VariableListIntent>) -> MatchDraft {
    let mut variable = VariableDraft::new(index);
    variable.lists = intents;
    drafting(variable)
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

/// New strings.
fn strings(items: &[&str]) -> NewListItems {
    NewListItems::Strings(
        ScalarItems::from_vec(items.iter().map(|item| (*item).to_owned()).collect())
            .expect("non-empty"),
    )
}

/// New records, as `(label, id)` pairs.
fn records(pairs: &[(&str, &str)]) -> NewListItems {
    NewListItems::Records(
        ChoiceRecords::from_vec(
            pairs
                .iter()
                .map(|(label, id)| ChoiceRecord::new(*label, *id))
                .collect(),
        )
        .expect("non-empty"),
    )
}

/// The decoded strings of variable `variable`'s `list` in match 0 of `source`.
fn texts(source: &str, variable: usize, list: VariableList) -> Vec<String> {
    let view = the_match(source, 0);
    let variable = &view.vars[variable];
    let items: &[ValueView] = match list {
        VariableList::DependsOn => &variable.depends_on,
        _ => variable
            .params
            .iter()
            .find(|field| field.key.as_ref().is_some_and(|key| key.text == list.key()))
            .and_then(|field| field.value.as_sequence())
            .expect("the list is there"),
    };
    items
        .iter()
        .map(|item| match item {
            ValueView::Scalar(scalar) => scalar.text.clone(),
            ValueView::Mapping(fields) => fields
                .iter()
                .map(|field| {
                    format!(
                        "{}={}",
                        field.key.as_ref().map_or("?", |key| key.text.as_str()),
                        field
                            .value
                            .as_scalar()
                            .map_or("…", |value| value.text.as_str())
                    )
                })
                .collect::<Vec<_>>()
                .join(","),
            other => format!("{other:?}"),
        })
        .collect()
} // End of function texts()

/// Asserts that neither the JSON, the developer rendering nor the debug
/// rendering of `error` holds [`PRIVATE`].
fn assert_no_text(error: &DraftError) {
    let json = serde_json::to_string(error).expect("a refusal serializes");
    assert!(!json.contains(PRIVATE), "the wire form echoes text: {json}");
    assert!(!error.to_string().contains(PRIVATE));
    assert!(!format!("{error:?}").contains(PRIVATE));
} // End of function assert_no_text()

/// The path of variable `index` of match 0.
fn variable_path(index: usize) -> DocumentPath {
    DocumentPath::root(0)
        .with_key("matches")
        .with_index(0)
        .with_key("vars")
        .with_index(index)
}

// ---------------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------------

#[test]
fn every_kind_list_is_its_kinds_list_parameter() {
    for list in VariableList::ALL {
        match list.kind() {
            None => assert_eq!(list, VariableList::DependsOn),
            Some(kind) => {
                assert_eq!(kind.list_param_key(), Some(list.key()), "{list:?}");
                assert_eq!(VariableList::from_param_key(list.key()), Some(list));
            }
        }
        let json = serde_json::to_string(&list).expect("serializes");
        assert_eq!(
            json,
            format!("\"{}\"", list.key()),
            "the wire spells the key"
        );
    } // End of the loop over the four lists
    assert_eq!(VariableList::from_param_key("depends_on"), None);
    assert!(VariableList::Values.takes_records());
    assert!(!VariableList::Choices.takes_records());
    for field in ChoiceRecordField::ALL {
        let json = serde_json::to_string(&field).expect("serializes");
        assert_eq!(json, format!("\"{}\"", field.key()));
    }
} // End of function every_kind_list_is_its_kinds_list_parameter()

// ---------------------------------------------------------------------------
// First, middle and last additions and removals
// ---------------------------------------------------------------------------

#[test]
fn first_middle_and_last_additions_land_where_asked_in_every_block_list() {
    // `depends_on`: the front lands above the first item's owned comment.
    let cases: [(usize, VariableList, ListPlacement, &str, &str); 9] = [
        (
            0,
            VariableList::DependsOn,
            ListPlacement::Front {},
            "        depends_on:\n          # Owned",
            "        depends_on:\n          - new\n          # Owned",
        ),
        (
            0,
            VariableList::DependsOn,
            ListPlacement::After { index: 1 },
            "          - run\n          - mood\n",
            "          - run\n          - new\n          - mood\n",
        ),
        (
            0,
            VariableList::DependsOn,
            ListPlacement::End {},
            "          - mood\n",
            "          - mood\n          - new\n",
        ),
        (
            0,
            VariableList::Values,
            ListPlacement::Front {},
            "            - alpha\n",
            "            - new\n            - alpha\n",
        ),
        (
            0,
            VariableList::Values,
            ListPlacement::After { index: 0 },
            "            - alpha\n            - beta\n",
            "            - alpha\n            - new\n            - beta\n",
        ),
        (
            0,
            VariableList::Values,
            ListPlacement::End {},
            "            - gamma\n",
            "            - gamma\n            - new\n",
        ),
        (
            2,
            VariableList::Args,
            ListPlacement::Front {},
            "            - /bin/echo\n",
            "            - new\n            - /bin/echo\n",
        ),
        (
            2,
            VariableList::Args,
            ListPlacement::After { index: 0 },
            "            - /bin/echo\n            - hello\n",
            "            - /bin/echo\n            - new\n            - hello\n",
        ),
        (
            2,
            VariableList::Args,
            ListPlacement::End {},
            "            - hello\n",
            "            - hello\n            - new\n",
        ),
    ];
    for (variable, list, at, from, to) in cases {
        let draft = listing(
            variable,
            vec![VariableListIntent::insert(list, at, strings(&["new"]))],
        );
        let (edits, patched) = planned(LISTS, 0, &draft);
        assert!(
            matches!(edits.as_slice(), [DocumentEdit::InsertScalarItems(_)]),
            "{list:?} {at:?}: one scalar-item insertion"
        );
        assert_eq!(patched, replaced(LISTS, from, to), "{list:?} {at:?}");
        assert!(the_match(&patched, 0).safely_editable);
    } // End of the loop over the placements
} // End of function first_middle_and_last_additions_land_where_asked_in_every_block_list()

#[test]
fn first_middle_and_last_removals_take_the_items_own_comments() {
    let cases: [(usize, VariableList, usize, &str, &str); 6] = [
        (
            0,
            VariableList::DependsOn,
            0,
            "          # Owned by the first dependency.\n          - roll\n",
            "",
        ),
        (
            0,
            VariableList::DependsOn,
            1,
            "          - run\n          - mood\n",
            "          - mood\n",
        ),
        (
            0,
            VariableList::DependsOn,
            2,
            "          - run\n          - mood\n",
            "          - run\n",
        ),
        (0, VariableList::Values, 0, "            - alpha\n", ""),
        (
            3,
            VariableList::Values,
            1,
            "            - label: Calm\n              id: calm\n",
            "",
        ),
        (
            3,
            VariableList::Values,
            2,
            "            - label: Tired\n              id: tired\n",
            "",
        ),
    ];
    for (variable, list, index, from, to) in cases {
        let draft = listing(variable, vec![VariableListIntent::remove(list, index)]);
        let (edits, patched) = planned(LISTS, 0, &draft);
        assert!(
            matches!(edits.as_slice(), [DocumentEdit::RemoveItem(_)]),
            "{list:?} {index}: one item removal"
        );
        assert_eq!(patched, replaced(LISTS, from, to), "{list:?} {index}");
    } // End of the loop over the removals

    // The first record holds an unknown entry and is still flat: removing it
    // removes the record whole — the entry was projected, so it was shown.
    let draft = listing(3, vec![VariableListIntent::remove(VariableList::Values, 0)]);
    let (_, patched) = planned(LISTS, 0, &draft);
    assert_eq!(
        patched,
        replaced(
            LISTS,
            "            - label: Happy\n              id: happy\n              emoji: smile\n",
            ""
        )
    );

    // A record holding a collection is not removed: that structure was never a
    // record's label or id.
    let error = refused(
        LISTS,
        0,
        &listing(6, vec![VariableListIntent::remove(VariableList::Values, 0)]),
    );
    assert_eq!(
        error,
        DraftError::NestedRemovalWouldDiscardUnshownStructure {
            target: DraftTarget::VariableListItem {
                variable: 6,
                list: VariableList::Values,
                item: 0
            },
            found: ValueKind::Mapping
        }
    );
} // End of function first_middle_and_last_removals_take_the_items_own_comments()

// ---------------------------------------------------------------------------
// Several insertions at one boundary
// ---------------------------------------------------------------------------

#[test]
fn several_insertions_at_one_boundary_are_one_edit_in_the_order_asked() {
    let draft = listing(
        0,
        vec![VariableListIntent::insert(
            VariableList::DependsOn,
            ListPlacement::After { index: 0 },
            strings(&["b1", "true", "b3"]),
        )],
    );
    let (edits, patched) = planned(LISTS, 0, &draft);
    assert_eq!(edits.len(), 1);
    assert_eq!(
        patched,
        replaced(
            LISTS,
            "          - roll\n          - run\n",
            "          - roll\n          - b1\n          - 'true'\n          - b3\n          - run\n"
        ),
        "a logical string that reads as a YAML 1.1 boolean is quoted"
    );

    let draft = listing(
        3,
        vec![VariableListIntent::insert(
            VariableList::Values,
            ListPlacement::After { index: 0 },
            records(&[("Sleepy", "sleepy"), ("Yes", "yes")]),
        )],
    );
    let (edits, patched) = planned(LISTS, 0, &draft);
    assert!(
        matches!(edits.as_slice(), [DocumentEdit::InsertItem(insert)] if insert.item_count() == 2),
        "two records are one insertion: {edits:?}"
    );
    assert_eq!(
        patched,
        replaced(
            LISTS,
            "              emoji: smile\n",
            "              emoji: smile\n            - label: Sleepy\n              id: sleepy\n            - label: 'Yes'\n              id: 'yes'\n"
        )
    );
    assert_eq!(
        texts(&patched, 3, VariableList::Values),
        [
            "label=Happy,id=happy,emoji=smile",
            "label=Sleepy,id=sleepy",
            "label=Yes,id=yes",
            "label=Calm,id=calm",
            "label=Tired,id=tired"
        ]
    );

    // Two intents at one landing state no order and are refused, however the
    // landing is spelled.
    let draft = listing(
        0,
        vec![
            VariableListIntent::insert(
                VariableList::Values,
                ListPlacement::After { index: 2 },
                strings(&["a"]),
            ),
            VariableListIntent::insert(
                VariableList::Values,
                ListPlacement::End {},
                strings(&["b"]),
            ),
        ],
    );
    assert_eq!(
        refused(LISTS, 0, &draft),
        DraftError::VariableListIntentsConflict {
            variable: 0,
            list: VariableList::Values
        }
    );
} // End of function several_insertions_at_one_boundary_are_one_edit_in_the_order_asked()

// ---------------------------------------------------------------------------
// Empty lists
// ---------------------------------------------------------------------------

#[test]
fn an_empty_list_takes_strings_between_its_brackets_and_is_never_emptied() {
    let draft = listing(
        4,
        vec![
            VariableListIntent::insert(
                VariableList::DependsOn,
                ListPlacement::End {},
                strings(&["pick"]),
            ),
            VariableListIntent::insert(
                VariableList::Values,
                ListPlacement::Front {},
                strings(&["p", "q"]),
            ),
        ],
    );
    let (_, patched) = planned(LISTS, 0, &draft);
    let expected = replaced(
        &replaced(
            LISTS,
            "        depends_on: []\n",
            "        depends_on: ['pick']\n",
        ),
        "          values: []\n",
        "          values: ['p', 'q']\n",
    );
    assert_eq!(patched, expected);
    assert_eq!(texts(&patched, 4, VariableList::Values), ["p", "q"]);

    // A record cannot go between brackets.
    let error = refused(
        LISTS,
        0,
        &listing(
            4,
            vec![VariableListIntent::insert(
                VariableList::Values,
                ListPlacement::End {},
                records(&[("A", "a")]),
            )],
        ),
    );
    assert_eq!(
        error,
        DraftError::VariableListIsAFlowList {
            variable: 4,
            list: VariableList::Values
        }
    );

    // `[]` has no item to remove or to be placed after.
    let error = refused(
        LISTS,
        0,
        &listing(
            4,
            vec![VariableListIntent::remove(VariableList::DependsOn, 0)],
        ),
    );
    assert_eq!(
        error,
        DraftError::TargetDoesNotExist {
            target: DraftTarget::VariableListItem {
                variable: 4,
                list: VariableList::DependsOn,
                item: 0
            },
            length: 0
        }
    );

    // Removing the last item is explicit: refused, and a new item in the same
    // draft does not rescue it.
    for intents in [
        vec![VariableListIntent::remove(VariableList::DependsOn, 0)],
        vec![
            VariableListIntent::remove(VariableList::DependsOn, 0),
            VariableListIntent::insert(
                VariableList::DependsOn,
                ListPlacement::End {},
                strings(&["mood"]),
            ),
        ],
    ] {
        assert_eq!(
            refused(LISTS, 0, &listing(1, intents)),
            DraftError::VariableListWouldBeEmpty {
                variable: 1,
                list: VariableList::DependsOn
            }
        );
    } // End of the loop over the two emptying drafts
    let every = (0..3)
        .map(|index| VariableListIntent::remove(VariableList::Values, index))
        .collect();
    assert_eq!(
        refused(LISTS, 0, &listing(3, every)),
        DraftError::VariableListWouldBeEmpty {
            variable: 3,
            list: VariableList::Values
        }
    );
} // End of function an_empty_list_takes_strings_between_its_brackets_and_is_never_emptied()

// ---------------------------------------------------------------------------
// Changed survivors
// ---------------------------------------------------------------------------

#[test]
fn an_insertion_a_removal_and_a_changed_survivor_share_one_batch() {
    // `depends_on`: the first goes, the last is rewritten, a new one follows it.
    let variable = VariableDraft::new(0)
        .with_depends_on_item(2, "feeling")
        .with_list_intent(VariableListIntent::remove(VariableList::DependsOn, 0))
        .with_list_intent(VariableListIntent::insert(
            VariableList::DependsOn,
            ListPlacement::End {},
            strings(&["extra"]),
        ));
    let (edits, patched) = planned(LISTS, 0, &drafting(variable));
    assert_eq!(edits.len(), 3);
    assert_eq!(
        patched,
        replaced(
            LISTS,
            "          # Owned by the first dependency.\n          - roll\n          - run\n          - mood\n",
            "          - run\n          - feeling\n          - extra\n"
        )
    );

    // A string `values`: the survivor is rewritten through its `params` entry.
    let variable = VariableDraft::new(0)
        .with_param(EntryDraft::new(0).with_item(2, "delta"))
        .with_list_intent(VariableListIntent::remove(VariableList::Values, 1))
        .with_list_intent(VariableListIntent::insert(
            VariableList::Values,
            ListPlacement::Front {},
            strings(&["zero"]),
        ));
    let (_, patched) = planned(LISTS, 0, &drafting(variable));
    assert_eq!(
        texts(&patched, 0, VariableList::Values),
        ["zero", "alpha", "delta"]
    );

    // Records: one removed, a survivor relabelled, one added at the end — and
    // the unknown entry of the first record untouched.
    let variable = VariableDraft::new(3)
        .with_record(ChoiceRecordDraft::new(2).with(ChoiceRecordField::Label, "Sleepy"))
        .with_list_intent(VariableListIntent::remove(VariableList::Values, 1))
        .with_list_intent(VariableListIntent::insert(
            VariableList::Values,
            ListPlacement::End {},
            records(&[("Glad", "glad")]),
        ));
    let (_, patched) = planned(LISTS, 0, &drafting(variable));
    assert_eq!(
        patched,
        replaced(
            LISTS,
            "            - label: Calm\n              id: calm\n            - label: Tired\n              id: tired\n",
            "            - label: Sleepy\n              id: tired\n            - label: Glad\n              id: glad\n"
        )
    );

    // `args` of a script: rewritten and added in one batch; flow `choices`:
    // rewritten and removed in one batch.
    let variable = VariableDraft::new(2)
        .with_param(EntryDraft::new(1).with_item(1, "world"))
        .with_list_intent(VariableListIntent::insert(
            VariableList::Args,
            ListPlacement::After { index: 0 },
            strings(&["-n"]),
        ));
    let (_, patched) = planned(LISTS, 0, &drafting(variable));
    assert_eq!(
        texts(&patched, 2, VariableList::Args),
        ["/bin/echo", "-n", "world"]
    );
    let variable = VariableDraft::new(1)
        .with_param(EntryDraft::new(0).with_item(2, "tres"))
        .with_list_intent(VariableListIntent::remove(VariableList::Choices, 0));
    let (_, patched) = planned(LISTS, 0, &drafting(variable));
    assert_eq!(
        patched,
        replaced(
            LISTS,
            "choices: [one, two, three]",
            "choices: [two, 'tres']"
        )
    );
} // End of function an_insertion_a_removal_and_a_changed_survivor_share_one_batch()

// ---------------------------------------------------------------------------
// Flow lists stay flow, or are refused by type
// ---------------------------------------------------------------------------

#[test]
fn a_flow_list_stays_flow_or_is_refused_by_type() {
    let cases: [(VariableListIntent, &str, &str); 4] = [
        (
            VariableListIntent::insert(
                VariableList::Choices,
                ListPlacement::Front {},
                strings(&["zero"]),
            ),
            "choices: [one, two, three]",
            "choices: ['zero', one, two, three]",
        ),
        (
            VariableListIntent::insert(
                VariableList::Choices,
                ListPlacement::End {},
                strings(&["four", "five"]),
            ),
            "choices: [one, two, three]",
            "choices: [one, two, three, 'four', 'five']",
        ),
        (
            VariableListIntent::remove(VariableList::Choices, 1),
            "choices: [one, two, three]",
            "choices: [one, three]",
        ),
        (
            VariableListIntent::insert(
                VariableList::DependsOn,
                ListPlacement::Front {},
                strings(&["pick"]),
            ),
            "depends_on: [run]",
            "depends_on: ['pick', run]",
        ),
    ];
    for (intent, from, to) in cases {
        let (_, patched) = planned(LISTS, 0, &listing(1, vec![intent.clone()]));
        assert_eq!(patched, replaced(LISTS, from, to), "{intent:?}");
    } // End of the loop over the flow edits

    // Records never go into or out of brackets; a string never joins a list of
    // records.
    let flow = DraftError::VariableListIsAFlowList {
        variable: 5,
        list: VariableList::Values,
    };
    assert_eq!(
        refused(
            LISTS,
            0,
            &listing(
                5,
                vec![VariableListIntent::insert(
                    VariableList::Values,
                    ListPlacement::End {},
                    records(&[("C", "c")])
                )]
            )
        ),
        flow
    );
    assert_eq!(
        refused(
            LISTS,
            0,
            &listing(5, vec![VariableListIntent::remove(VariableList::Values, 0)])
        ),
        flow
    );
    assert_eq!(
        refused(
            LISTS,
            0,
            &listing(
                5,
                vec![VariableListIntent::insert(
                    VariableList::Values,
                    ListPlacement::End {},
                    strings(&["c"])
                )]
            )
        ),
        DraftError::VariableListItemShapeMismatch {
            variable: 5,
            list: VariableList::Values
        }
    );

    // An existing record between brackets is still rewritten in place, and the
    // list stays a flow list.
    let draft = drafting(
        VariableDraft::new(5)
            .with_record(ChoiceRecordDraft::new(1).with(ChoiceRecordField::Id, "bee")),
    );
    let (_, patched) = planned(LISTS, 0, &draft);
    assert_eq!(
        patched,
        replaced(LISTS, "{label: B, id: b}]", "{label: B, id: 'bee'}]")
    );

    // A `params` written between braces holds its list inside a flow
    // collection, and is refused by that name.
    let braces = "matches:\n  - trigger: ':b'\n    replace: z\n    vars:\n      - name: r\n        type: random\n        params: {choices: [a, b]}\n";
    assert_eq!(
        refused(
            braces,
            0,
            &listing(
                0,
                vec![VariableListIntent::insert(
                    VariableList::Choices,
                    ListPlacement::End {},
                    strings(&["c"])
                )]
            )
        ),
        DraftError::ParamsIsAFlowMapping { variable: 0 }
    );
} // End of function a_flow_list_stays_flow_or_is_refused_by_type()

/// **C2, pinned for variable lists.** A flow list holding a comment keeps the
/// `CommentInFlowCollection` refusal: the match is not editable, whatever is
/// asked of the list — an insertion, a removal or a rewrite of an item.
#[test]
fn a_flow_list_holding_a_comment_keeps_its_comment_in_flow_collection_refusal() {
    let expected = DraftError::MatchNotEditable {
        hazard: Some(HazardKind::CommentInFlowCollection),
    };
    let drafts = [
        listing(
            0,
            vec![VariableListIntent::insert(
                VariableList::Choices,
                ListPlacement::End {},
                strings(&["z"]),
            )],
        ),
        listing(
            0,
            vec![VariableListIntent::remove(VariableList::Choices, 0)],
        ),
        drafting(VariableDraft::new(0).with_param(EntryDraft::new(0).with_item(0, "w"))),
    ];
    for draft in drafts {
        assert_eq!(refused(LISTS, 1, &draft), expected, "{draft:?}");
    }
    // The refusal is the projection's match-wide gate, decided before any
    // intent is read (`docs/decisions/3-3-notes.md` §7); the C2 decision —
    // whether a comment the flow engine could place should unblock the match —
    // stays deferred (`docs/decisions/4-split-notes.md` §7).
    let view = the_match(LISTS, 1);
    assert!(!view.safely_editable);
    assert_eq!(
        view.blocking_hazard,
        Some(HazardKind::CommentInFlowCollection)
    );
} // End of function a_flow_list_holding_a_comment_keeps_its_comment_in_flow_collection_refusal()

// ---------------------------------------------------------------------------
// String and record shapes stay distinct
// ---------------------------------------------------------------------------

#[test]
fn string_and_record_shapes_stay_distinct() {
    let mismatch = |variable: usize, list: VariableList| {
        DraftError::VariableListItemShapeMismatch { variable, list }
    };
    // Records into a list of strings, and into a list that takes no records.
    let cases: [(usize, VariableListIntent, DraftError); 5] = [
        (
            0,
            VariableListIntent::insert(
                VariableList::Values,
                ListPlacement::End {},
                records(&[("A", "a")]),
            ),
            mismatch(0, VariableList::Values),
        ),
        (
            0,
            VariableListIntent::insert(
                VariableList::DependsOn,
                ListPlacement::End {},
                records(&[("A", "a")]),
            ),
            mismatch(0, VariableList::DependsOn),
        ),
        (
            2,
            VariableListIntent::insert(
                VariableList::Args,
                ListPlacement::End {},
                records(&[("A", "a")]),
            ),
            mismatch(2, VariableList::Args),
        ),
        // Strings into a list of records.
        (
            3,
            VariableListIntent::insert(
                VariableList::Values,
                ListPlacement::End {},
                strings(&["a"]),
            ),
            mismatch(3, VariableList::Values),
        ),
        // Either shape into a list that mixes them.
        (
            6,
            VariableListIntent::insert(
                VariableList::Values,
                ListPlacement::End {},
                strings(&["a"]),
            ),
            DraftError::VariableListItemShapeMismatch {
                variable: 6,
                list: VariableList::Values,
            },
        ),
    ];
    for (variable, intent, expected) in cases {
        assert_eq!(
            refused(LISTS, 0, &listing(variable, vec![intent])),
            expected
        );
    }
    // A list holding a record with a collection inside is still records.
    let draft = listing(
        6,
        vec![VariableListIntent::insert(
            VariableList::Values,
            ListPlacement::End {},
            records(&[("New", "new")]),
        )],
    );
    let (_, patched) = planned(LISTS, 0, &draft);
    assert!(patched
        .contains("              id: flat\n            - label: New\n              id: new\n"));

    // Edits keep the distinction: a record rewrite of a string, a string
    // rewrite of a record.
    assert_eq!(
        refused(
            LISTS,
            0,
            &drafting(
                VariableDraft::new(0)
                    .with_record(ChoiceRecordDraft::new(1).with(ChoiceRecordField::Label, "B"))
            )
        ),
        DraftError::NotAChoiceRecord {
            target: DraftTarget::VariableListItem {
                variable: 0,
                list: VariableList::Values,
                item: 1
            },
            found: ValueKind::Scalar
        }
    );
    assert!(matches!(
        refused(
            LISTS,
            0,
            &drafting(VariableDraft::new(3).with_param(EntryDraft::new(0).with_item(0, "x")))
        ),
        DraftError::NotAScalar { .. }
    ));
    // A record rewrite names `values` of a `choice` only.
    assert_eq!(
        refused(
            LISTS,
            0,
            &drafting(
                VariableDraft::new(1)
                    .with_record(ChoiceRecordDraft::new(0).with(ChoiceRecordField::Id, "x"))
            )
        ),
        DraftError::VariableListIsNotOfItsKind {
            variable: 1,
            list: VariableList::Values
        }
    );
} // End of function string_and_record_shapes_stay_distinct()

// ---------------------------------------------------------------------------
// Unknown entries inside a record survive
// ---------------------------------------------------------------------------

#[test]
fn unknown_entries_inside_a_record_survive_its_edits() {
    let draft = drafting(
        VariableDraft::new(3).with_record(
            ChoiceRecordDraft::new(0)
                .with(ChoiceRecordField::Label, "Very happy")
                .with(ChoiceRecordField::Id, "glad"),
        ),
    );
    let (edits, patched) = planned(LISTS, 0, &draft);
    assert_eq!(edits.len(), 2, "one edit per changed entry");
    assert_eq!(
        patched,
        replaced(
            LISTS,
            "            - label: Happy\n              id: happy\n              emoji: smile\n",
            "            - label: Very happy\n              id: glad\n              emoji: smile\n"
        )
    );
    assert_eq!(
        texts(&patched, 3, VariableList::Values)[0],
        "label=Very happy,id=glad,emoji=smile"
    );

    // A `Some` equal to what is there derives nothing; the record keeps its
    // bytes, whatever the spelling.
    let draft = drafting(
        VariableDraft::new(3)
            .with_record(ChoiceRecordDraft::new(0).with(ChoiceRecordField::Label, "Happy")),
    );
    assert_eq!(
        plan_match_edits(&the_match(LISTS, 0), &draft),
        Ok(Vec::new())
    );

    // The record's unknown entry is not addressable by a record draft, and a
    // record missing `id` gains none.
    let partial = "matches:\n  - trigger: ':p'\n    replace: z\n    vars:\n      - name: c\n        type: choice\n        params:\n          values:\n            - label: Only\n              note: kept\n";
    assert_eq!(
        refused(
            partial,
            0,
            &drafting(
                VariableDraft::new(0)
                    .with_record(ChoiceRecordDraft::new(0).with(ChoiceRecordField::Id, "x"))
            )
        ),
        DraftError::ChoiceRecordFieldHasNoScalar {
            target: DraftTarget::ChoiceRecordField {
                variable: 0,
                record: 0,
                field: ChoiceRecordField::Id
            }
        }
    );
    let (_, patched) = planned(
        partial,
        0,
        &drafting(
            VariableDraft::new(0)
                .with_record(ChoiceRecordDraft::new(0).with(ChoiceRecordField::Label, "One")),
        ),
    );
    assert_eq!(patched, replaced(partial, "label: Only", "label: One"));
} // End of function unknown_entries_inside_a_record_survive_its_edits()

// ---------------------------------------------------------------------------
// Refusals by name
// ---------------------------------------------------------------------------

#[test]
fn a_list_that_is_not_there_or_not_a_list_is_refused_by_name() {
    let insert = |list: VariableList| {
        VariableListIntent::insert(list, ListPlacement::End {}, strings(&[PRIVATE]))
    };
    // A kind list on another kind.
    let error = refused(LISTS, 0, &listing(1, vec![insert(VariableList::Values)]));
    assert_eq!(
        error,
        DraftError::VariableListIsNotOfItsKind {
            variable: 1,
            list: VariableList::Values
        }
    );
    assert_no_text(&error);
    // No `depends_on` on the script.
    let error = refused(LISTS, 0, &listing(2, vec![insert(VariableList::DependsOn)]));
    assert_eq!(
        error,
        DraftError::VariableListAbsent {
            variable: 2,
            list: VariableList::DependsOn
        }
    );
    assert_no_text(&error);
    // A key holding a scalar.
    let scalar = "matches:\n  - trigger: ':s'\n    replace: z\n    vars:\n      - name: r\n        type: random\n        depends_on: none\n        params:\n          choices: several\n";
    for list in [VariableList::DependsOn, VariableList::Choices] {
        assert_eq!(
            refused(scalar, 0, &listing(0, vec![insert(list)])),
            DraftError::VariableListHasAnUnsupportedShape {
                variable: 0,
                list,
                found: ValueKind::Scalar
            }
        );
    }
    // A placement or an item the list does not have.
    assert_eq!(
        refused(
            LISTS,
            0,
            &listing(
                0,
                vec![VariableListIntent::insert(
                    VariableList::Values,
                    ListPlacement::After { index: 3 },
                    strings(&["x"])
                )]
            )
        ),
        DraftError::TargetDoesNotExist {
            target: DraftTarget::VariableListItem {
                variable: 0,
                list: VariableList::Values,
                item: 3
            },
            length: 3
        }
    );
    // A `depends_on` item is rewritten, never removed, through an item draft.
    let mut variable = VariableDraft::new(0);
    variable
        .depends_on
        .push(espansoconfig_core::draft::ItemDraft {
            index: 0,
            value: espansoconfig_core::draft::DraftField::Remove,
        });
    assert_eq!(
        refused(LISTS, 0, &drafting(variable)),
        DraftError::NestedItemRemoval {
            target: DraftTarget::VariableListItem {
                variable: 0,
                list: VariableList::DependsOn,
                item: 0
            }
        }
    );
    // A variable that is not there.
    assert!(matches!(
        refused(LISTS, 0, &listing(9, vec![insert(VariableList::DependsOn)])),
        DraftError::TargetDoesNotExist {
            target: DraftTarget::Variable { index: 9 },
            ..
        }
    ));
} // End of function a_list_that_is_not_there_or_not_a_list_is_refused_by_name()

#[test]
fn intents_that_contradict_each_other_are_refused_before_any_diffing() {
    let conflict = |variable: usize, list: VariableList| DraftError::VariableListIntentsConflict {
        variable,
        list,
    };
    // Removed twice.
    assert_eq!(
        refused(
            LISTS,
            0,
            &listing(
                0,
                vec![
                    VariableListIntent::remove(VariableList::DependsOn, 1),
                    VariableListIntent::remove(VariableList::DependsOn, 1)
                ]
            )
        ),
        conflict(0, VariableList::DependsOn)
    );
    // Removed and rewritten, even to the value already there.
    let rewritten = [
        VariableDraft::new(0).with_depends_on_item(1, "run"),
        VariableDraft::new(0).with_param(EntryDraft::new(0).with_item(1, "beta")),
        VariableDraft::new(3)
            .with_record(ChoiceRecordDraft::new(1).with(ChoiceRecordField::Id, "calm")),
    ];
    for (variable, list) in rewritten.into_iter().zip([
        VariableList::DependsOn,
        VariableList::Values,
        VariableList::Values,
    ]) {
        let index = variable.index;
        let variable = variable.with_list_intent(VariableListIntent::remove(list, 1));
        assert_eq!(
            refused(LISTS, 0, &drafting(variable)),
            conflict(index, list)
        );
    } // End of the loop over the removed-and-rewritten drafts
      // An insertion landing where a removal starts.
    assert_eq!(
        refused(
            LISTS,
            0,
            &listing(
                0,
                vec![
                    VariableListIntent::insert(
                        VariableList::DependsOn,
                        ListPlacement::After { index: 0 },
                        strings(&["x"])
                    ),
                    VariableListIntent::remove(VariableList::DependsOn, 1)
                ]
            )
        ),
        conflict(0, VariableList::DependsOn)
    );
    // A list intent beside a `Remove` of the kind list's own `params` entry.
    let variable = VariableDraft::new(0)
        .with_param(EntryDraft::new(0).removed())
        .with_list_intent(VariableListIntent::remove(VariableList::Values, 0));
    assert_eq!(
        refused(LISTS, 0, &drafting(variable)),
        conflict(0, VariableList::Values)
    );
    // One `depends_on` item or one record drafted twice.
    let variable = VariableDraft::new(0)
        .with_depends_on_item(0, "a")
        .with_depends_on_item(0, "b");
    assert!(matches!(
        refused(LISTS, 0, &drafting(variable)),
        DraftError::TargetDraftedTwice {
            target: DraftTarget::VariableListItem {
                list: VariableList::DependsOn,
                item: 0,
                ..
            },
            first: 0,
            second: 1
        }
    ));
    let variable = VariableDraft::new(3)
        .with_record(ChoiceRecordDraft::new(2).with(ChoiceRecordField::Label, "a"))
        .with_record(ChoiceRecordDraft::new(2).with(ChoiceRecordField::Id, "b"));
    assert!(matches!(
        refused(LISTS, 0, &drafting(variable)),
        DraftError::TargetDraftedTwice {
            target: DraftTarget::VariableListItem {
                list: VariableList::Values,
                item: 2,
                ..
            },
            ..
        }
    ));
    // A list intent on a variable the same draft removes.
    let draft = listing(
        0,
        vec![VariableListIntent::remove(VariableList::DependsOn, 0)],
    )
    .with_vars_intent(VarsIntent::RemoveVariable { index: 0 });
    assert!(matches!(
        refused(LISTS, 0, &draft),
        DraftError::VarsIntentsConflict { .. }
    ));
} // End of function intents_that_contradict_each_other_are_refused_before_any_diffing()

/// A new `params` entry beside an insertion at the end of a kind list that is
/// `params`' last entry: the list's end and the entry's end are one offset, so
/// the new entry is anchored before the list rather than refused as an overlap.
#[test]
fn a_new_param_beside_a_list_insertion_is_anchored_before_the_list() {
    let variable = VariableDraft::new(2)
        .with_new_param(NewParam::scalar("note", "nb"))
        .with_list_intent(VariableListIntent::insert(
            VariableList::Args,
            ListPlacement::End {},
            strings(&["tail"]),
        ));
    let (_, patched) = planned(LISTS, 0, &drafting(variable));
    let expected = replaced(
        &replaced(
            LISTS,
            "          trim: true\n",
            "          trim: true\n          note: nb\n",
        ),
        "            - hello\n",
        "            - hello\n            - tail\n",
    );
    assert_eq!(patched, expected);
} // End of function a_new_param_beside_a_list_insertion_is_anchored_before_the_list()

// ---------------------------------------------------------------------------
// Hard shapes
// ---------------------------------------------------------------------------

#[test]
fn crlf_and_a_missing_final_newline_are_kept() {
    let source = "matches:\r\n  - trigger: ':c'\r\n    replace: z\r\n    vars:\r\n      - name: c\r\n        type: choice\r\n        params:\r\n          values:\r\n            - label: A\r\n              id: a";
    let draft = listing(
        0,
        vec![VariableListIntent::insert(
            VariableList::Values,
            ListPlacement::End {},
            records(&[("B", "b"), ("C", "c")]),
        )],
    );
    let (_, patched) = planned(source, 0, &draft);
    assert_eq!(
        patched,
        format!("{source}\r\n            - label: B\r\n              id: b\r\n            - label: C\r\n              id: c")
    );
    let draft = listing(0, vec![VariableListIntent::remove(VariableList::Values, 0)]);
    let (_, back) = planned(&patched, 0, &draft);
    assert_eq!(
        back,
        patched.replacen("            - label: A\r\n              id: a\r\n", "", 1)
    );
} // End of function crlf_and_a_missing_final_newline_are_kept()

// ---------------------------------------------------------------------------
// The closed surface and the engine
// ---------------------------------------------------------------------------

#[test]
fn the_closed_surface_admits_the_four_lists_and_nothing_near_them() {
    let here = DocumentPath::root(0).with_key("matches").with_index(0);
    let variable = variable_path(0);
    let values = variable.clone().with_key("params").with_key("values");
    let record = |label: &str, id: &str| {
        vec![
            (
                "label".to_owned(),
                ItemValue::Entry(EntryValue::Scalar(label.to_owned())),
            ),
            (
                "id".to_owned(),
                ItemValue::Entry(EntryValue::Scalar(id.to_owned())),
            ),
        ]
    };
    let one = |value: &str| vec![value.to_owned()];
    let inside: Vec<DocumentEdit> = vec![
        ScalarItemInsert::new(
            variable.clone().with_key("depends_on"),
            ItemPlacement::End,
            one("x"),
        )
        .expect("one")
        .into(),
        ScalarItemInsert::new(
            variable.clone().with_key("params").with_key("choices"),
            ItemPlacement::End,
            one("x"),
        )
        .expect("one")
        .into(),
        RemoveItem::new(
            variable
                .clone()
                .with_key("params")
                .with_key("args")
                .with_index(0),
        )
        .into(),
        InsertItem::several(
            values.clone(),
            ItemPlacement::Front,
            vec![record("A", "a"), record("B", "b")],
        )
        .expect("two")
        .into(),
        ScalarEdit::new(variable.clone().with_key("depends_on").with_index(0), "x").into(),
        ScalarEdit::new(values.clone().with_index(0).with_key("label"), "x").into(),
        ScalarEdit::new(values.clone().with_index(0).with_key("id"), "x").into(),
    ];
    for edit in inside {
        assert_eq!(
            check_closed_surface(&here, std::slice::from_ref(&edit)),
            Ok(()),
            "{edit:?} is inside the surface"
        );
    }
    let mut with_extra = record("A", "a");
    with_extra.push((
        "extra".to_owned(),
        ItemValue::Entry(EntryValue::Scalar("e".to_owned())),
    ));
    let mut reversed = record("A", "a");
    reversed.reverse();
    let outside: Vec<DocumentEdit> = vec![
        // Records anywhere but `values`, or not exactly `{label, id}`.
        InsertItem::several(
            variable.clone().with_key("params").with_key("choices"),
            ItemPlacement::End,
            vec![record("A", "a")],
        )
        .expect("one")
        .into(),
        InsertItem::several(
            variable.clone().with_key("depends_on"),
            ItemPlacement::End,
            vec![record("A", "a")],
        )
        .expect("one")
        .into(),
        InsertItem::several(values.clone(), ItemPlacement::End, vec![with_extra])
            .expect("one")
            .into(),
        InsertItem::several(
            values.clone(),
            ItemPlacement::End,
            vec![record("A", "a"), reversed],
        )
        .expect("two")
        .into(),
        // A list of another key, or one level too deep.
        ScalarItemInsert::new(
            variable.clone().with_key("params").with_key("layout"),
            ItemPlacement::End,
            one("x"),
        )
        .expect("one")
        .into(),
        ScalarEdit::new(values.clone().with_index(0).with_key("emoji"), "x").into(),
        ScalarEdit::new(
            variable
                .clone()
                .with_key("params")
                .with_key("choices")
                .with_index(0)
                .with_key("label"),
            "x",
        )
        .into(),
        RemoveItem::new(values.clone().with_index(0).with_key("extra").with_index(0)).into(),
    ];
    for edit in outside {
        assert_eq!(
            check_closed_surface(&here, std::slice::from_ref(&edit)),
            Err(DraftError::OutsideTheClosedSurface { edit: 0 }),
            "{edit:?} must be outside the surface"
        );
    }

    // The guard-level twin of a list insertion landing on a removal names the
    // two positions, since a variable's list has no match-level field.
    let edits: Vec<DocumentEdit> = vec![
        ScalarItemInsert::new(
            variable.clone().with_key("depends_on"),
            ItemPlacement::Front,
            one("x"),
        )
        .expect("one")
        .into(),
        RemoveItem::new(variable.clone().with_key("depends_on").with_index(0)).into(),
    ];
    assert_eq!(
        check_batch_independence(&here, &["trigger".to_owned()], &[], &edits),
        Err(DraftError::InsertionLandsOnARemoval {
            insertion: 0,
            removal: 1
        })
    );
    // A record removal holding an edit of that record.
    let edits: Vec<DocumentEdit> = vec![
        RemoveItem::new(values.clone().with_index(1)).into(),
        ScalarEdit::new(values.clone().with_index(1).with_key("label"), "x").into(),
    ];
    assert_eq!(
        check_batch_independence(&here, &["trigger".to_owned()], &[], &edits),
        Err(DraftError::RemovalContainsAnEdit {
            removal: 0,
            edit: 1
        })
    );
} // End of function the_closed_surface_admits_the_four_lists_and_nothing_near_them()

#[test]
fn several_items_of_one_insertion_take_one_position_each() {
    let values = variable_path(3).with_key("params").with_key("values");
    let record = |label: &str| {
        vec![
            (
                "label".to_owned(),
                ItemValue::Entry(EntryValue::Scalar(label.to_owned())),
            ),
            (
                "id".to_owned(),
                ItemValue::Entry(EntryValue::Scalar(label.to_lowercase())),
            ),
        ]
    };
    assert!(InsertItem::several(values.clone(), ItemPlacement::End, Vec::new()).is_none());
    let edits: Vec<DocumentEdit> = vec![
        RemoveItem::new(values.clone().with_index(0)).into(),
        InsertItem::several(
            values.clone(),
            ItemPlacement::After(1),
            vec![record("X"), record("Y")],
        )
        .expect("two")
        .into(),
    ];
    // Original [Happy, Calm, Tired]: Happy goes, X and Y land after Calm.
    assert_eq!(
        item_positions(&edits, &values, 3),
        Some(vec![None, Some(0), Some(3)])
    );
    assert_eq!(insertion_landings(&edits, &values, 4), vec![(1, 1), (1, 2)]);
    let patched = apply_edits(LISTS, &edits).expect("applies");
    assert_eq!(
        texts(patched.text(), 3, VariableList::Values),
        [
            "label=Calm,id=calm",
            "label=X,id=x",
            "label=Y,id=y",
            "label=Tired,id=tired"
        ]
    );
} // End of function several_items_of_one_insertion_take_one_position_each()

// ---------------------------------------------------------------------------
// The wire
// ---------------------------------------------------------------------------

#[test]
fn variable_list_drafts_cross_the_wire_as_closed_shapes() {
    let json = r#"{
        "vars": [{
            "index": 3,
            "depends_on": [{"index": 0, "value": {"Set": "a"}}],
            "records": [{"index": 1, "label": "L"}],
            "lists": [
                {"InsertItems": {"list": "values", "at": {"After": {"index": 0}},
                    "items": {"Records": [{"label": "A", "id": "a"}]}}},
                {"InsertItems": {"list": "depends_on", "at": {"End": {}},
                    "items": {"Strings": ["x", "y"]}}},
                {"RemoveItem": {"list": "values", "index": 2}}
            ]
        }]
    }"#;
    let draft: MatchDraft = serde_json::from_str(json).expect("the draft reads");
    let variable = &draft.vars[0];
    assert_eq!(variable.records[0].label.as_deref(), Some("L"));
    assert_eq!(variable.records[0].id, None);
    assert_eq!(variable.lists.len(), 3);
    assert!(matches!(
        &variable.lists[1],
        VariableListIntent::InsertItems { list: VariableList::DependsOn, items: NewListItems::Strings(items), .. }
            if items.len() == 2
    ));
    for refused in [
        // No items at all, of either shape.
        r#"{"vars": [{"index": 0, "lists": [{"InsertItems": {"list": "values", "at": {"End": {}}, "items": {"Strings": []}}}]}]}"#,
        r#"{"vars": [{"index": 0, "lists": [{"InsertItems": {"list": "values", "at": {"End": {}}, "items": {"Records": []}}}]}]}"#,
        // A list the schema does not fix.
        r#"{"vars": [{"index": 0, "lists": [{"RemoveItem": {"list": "layout", "index": 0}}]}]}"#,
        // A record with another entry, or without its id.
        r#"{"vars": [{"index": 0, "lists": [{"InsertItems": {"list": "values", "at": {"End": {}}, "items": {"Records": [{"label": "A", "id": "a", "emoji": "e"}]}}}]}]}"#,
        r#"{"vars": [{"index": 0, "lists": [{"InsertItems": {"list": "values", "at": {"End": {}}, "items": {"Records": [{"label": "A"}]}}}]}]}"#,
        // A record draft naming another entry; a mixed-shape insertion.
        r#"{"vars": [{"index": 0, "records": [{"index": 0, "emoji": "x"}]}]}"#,
        r#"{"vars": [{"index": 0, "lists": [{"InsertItems": {"list": "values", "at": {"End": {}}, "items": {"Strings": [{"label": "A", "id": "a"}]}}}]}]}"#,
    ] {
        assert!(
            serde_json::from_str::<MatchDraft>(refused).is_err(),
            "{refused} must be refused while the arguments are read"
        );
    } // End of the loop over the refused wire shapes
    let target = DraftTarget::ChoiceRecordField {
        variable: 0,
        record: 1,
        field: ChoiceRecordField::Label,
    };
    assert_eq!(
        serde_json::to_string(&target).expect("serializes"),
        r#"{"ChoiceRecordField":{"variable":0,"record":1,"field":"label"}}"#
    );
    assert_eq!(VariableKind::Choice.list_param_key(), Some("values"));
} // End of function variable_list_drafts_cross_the_wire_as_closed_shapes()

/// No refusal of this step carries the text of a new item, an existing item or
/// a record: every operand is a position, a list name or a kind.
#[test]
fn refusals_carry_positions_and_codes_never_text() {
    let private = records(&[(PRIVATE, PRIVATE)]);
    let drafts = [
        listing(
            0,
            vec![VariableListIntent::insert(
                VariableList::Values,
                ListPlacement::End {},
                private.clone(),
            )],
        ),
        listing(
            5,
            vec![VariableListIntent::insert(
                VariableList::Values,
                ListPlacement::End {},
                private,
            )],
        ),
        drafting(
            VariableDraft::new(0)
                .with_record(ChoiceRecordDraft::new(0).with(ChoiceRecordField::Label, PRIVATE)),
        ),
        drafting(VariableDraft::new(0).with_depends_on_item(7, PRIVATE)),
        listing(
            1,
            vec![VariableListIntent::insert(
                VariableList::Args,
                ListPlacement::End {},
                strings(&[PRIVATE]),
            )],
        ),
    ];
    for draft in drafts {
        assert_no_text(&refused(LISTS, 0, &draft));
    }
} // End of function refusals_carry_positions_and_codes_never_text()

/// **Regression (Phase 4-5 review):** a list edit of one variable beside the
/// insertion or the removal of another variable is one valid batch. The
/// verifier's account of what a **kept** `vars` item may differ at held scalar
/// rewrites and changed mappings only, so a kept variable whose nested list the
/// batch changed failed its digest and the whole disjoint batch was refused.
#[test]
fn a_list_edit_beside_a_variable_insertion_or_removal_is_one_batch() {
    let list_edits: Vec<(&str, VariableDraft)> = vec![
        (
            "strings inserted",
            VariableDraft::new(0).with_list_intent(VariableListIntent::insert(
                VariableList::DependsOn,
                ListPlacement::End {},
                strings(&["extra"]),
            )),
        ),
        (
            "records inserted",
            VariableDraft::new(3).with_list_intent(VariableListIntent::insert(
                VariableList::Values,
                ListPlacement::Front {},
                records(&[("New", "new"), ("Next", "next")]),
            )),
        ),
        (
            "a flow string inserted",
            VariableDraft::new(1).with_list_intent(VariableListIntent::insert(
                VariableList::Choices,
                ListPlacement::End {},
                strings(&["four"]),
            )),
        ),
        (
            "a string removed",
            VariableDraft::new(0)
                .with_list_intent(VariableListIntent::remove(VariableList::Values, 1)),
        ),
        (
            "a record removed",
            VariableDraft::new(3)
                .with_list_intent(VariableListIntent::remove(VariableList::Values, 1)),
        ),
        (
            "a flow string removed",
            VariableDraft::new(1)
                .with_list_intent(VariableListIntent::remove(VariableList::Choices, 0)),
        ),
        (
            "a dependency rewritten",
            VariableDraft::new(0).with_depends_on_item(1, "walk"),
        ),
        (
            "a record rewritten",
            VariableDraft::new(3)
                .with_record(ChoiceRecordDraft::new(0).with(ChoiceRecordField::Label, "Glad")),
        ),
    ];
    let companions: Vec<(&str, VarsIntent)> = vec![
        (
            "a new variable",
            VarsIntent::insert(
                ListPlacement::After { index: 4 },
                espansoconfig_core::draft::NewVariable::echo("fresh", "e"),
            ),
        ),
        (
            "a removed variable",
            VarsIntent::RemoveVariable { index: 4 },
        ),
    ];
    for (what, variable) in &list_edits {
        let alone = planned(LISTS, 0, &drafting(variable.clone())).1;
        for (with, intent) in &companions {
            let draft = drafting(variable.clone()).with_vars_intent(intent.clone());
            let view = the_match(LISTS, 0);
            let edits = plan_match_edits(&view, &draft)
                .unwrap_or_else(|error| panic!("{what} with {with}: plans: {error:?}"));
            let patched = apply_edits(LISTS, &edits)
                .map(|patched| patched.text().to_owned())
                .unwrap_or_else(|error| panic!("{what} with {with}: applies: {error:?}"));
            // The list edit's bytes are exactly what it writes alone, and the
            // companion's are exactly what it writes alone.
            let companion = planned(
                LISTS,
                0,
                &MatchDraft::new().with_vars_intent(intent.clone()),
            )
            .1;
            let changed_alone = first_difference(LISTS, &alone);
            assert_eq!(
                &patched[..changed_alone],
                &alone[..changed_alone],
                "{what} with {with}"
            );
            assert!(
                patched.len() as i64
                    == alone.len() as i64 + companion.len() as i64 - LISTS.len() as i64,
                "{what} with {with}: both edits and nothing else"
            );
        } // End of the loop over the variable-level companions
    } // End of the loop over the list edits
} // End of function a_list_edit_beside_a_variable_insertion_or_removal_is_one_batch()

/// The first byte at which `left` and `right` differ.
fn first_difference(left: &str, right: &str) -> usize {
    left.bytes()
        .zip(right.bytes())
        .position(|(a, b)| a != b)
        .unwrap_or(left.len().min(right.len()))
} // End of function first_difference()
