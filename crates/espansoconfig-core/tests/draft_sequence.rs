//! Phase 3-2 acceptance: sequence projection and block scalar-list edits.
//!
//! Three capabilities, all core-only:
//!
//! - **presence** — `triggers`, `search_terms` and a document's `imports` project
//!   as absent, present-empty, present with items, or an unsupported shape, with
//!   Rust-derived locations ([`SequencePresence`]);
//! - **list intents** — scalar items added to and removed from an existing block
//!   list, and a whole list field added or removed, through
//!   [`plan_match_edits_with`] and a [`MatchStructure`];
//! - **the trigger switch** — `trigger`↔`triggers` with a block list, in place.
//!
//! # Independent checks
//!
//! Every success is checked **independently of the engine's own verifier**
//! ([`assert_outside_spans`]): the bytes outside the replacements the engine
//! reports are walked here and compared with the source, and most successes
//! also assert the exact expected text.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).

use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::draft::{
    check_batch_independence, check_closed_surface, plan_match_edits_with, DraftError, DraftTarget,
    MatchDraft, MatchField, MatchStructure, ScalarItems, SequenceField, SequenceIntent,
    TriggerForm, TriggerSwitch,
};
use espansoconfig_core::model::{
    DocumentContext, DocumentView, MatchView, SequencePresence, ValueKind,
};
use espansoconfig_core::patch::{
    apply_edits, item_positions, DocumentEdit, DocumentPath, EditError, EntryValue,
    FieldInsertGroup, FieldRemoval, InsertItem, ItemPlacement, PatchedDocument, RemoveItem,
    ScalarItemInsert, ShapeSwitch,
};
use espansoconfig_core::persist::{save_document, Acknowledgement, SaveContent, SaveRequest};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::{ContentRevision, DocumentId};

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

/// Every list shape the editor meets, hand-authored and neutral.
///
/// Inline rather than in `tests/corpus/synthetic/`, as 3-1's fixtures are. The
/// committed corpus is swept by tests that pin a row or a census per fixture;
/// placed there, this text failed nineteen of them for want of new pins, and its
/// shapes are the subject of this file alone (`docs/decisions/3-2-notes.md` §4).
const LISTS: &str = "\
# Scalar lists in every shape the list editor meets (Phase 3-2).
# Neutral, hand-authored content only.
matches:
  # A block list whose first item owns a comment above it and one inline.
  - triggers:
      # the short alias
      - \":lst1\"  # inline on the first alias
      - \":lst2\"
      - \":lst3\"
    replace: a list of three
    search_terms:
      - first term

      # a comment the file owns, between two terms

      - second term

  - trigger: \":single\"  # inline on the single trigger
    replace: one trigger

  - triggers: []
    replace: an empty list
    search_terms: [alpha, beta]

  - trigger: \":scalar-terms\"
    replace: terms written as a scalar
    search_terms: not a list
";

/// The whole document, projected the way the workspace projects it.
fn document(source: &str) -> DocumentView {
    let context = DocumentContext::detached(DocumentId(0), "lists.yml");
    project_source(&context, source).view
}

/// The match at `index` of `source`.
fn match_at(source: &str, index: usize) -> MatchView {
    document(source)
        .matches
        .into_iter()
        .nth(index)
        .expect("the fixture holds that match")
}

/// The path of the match at `index`.
fn mapping(index: usize) -> DocumentPath {
    DocumentPath::root(0).with_key("matches").with_index(index)
}

/// The bytes a span of `source` covers.
fn slice(source: &str, span: espansoconfig_core::syntax::ByteSpan) -> &str {
    &source[span.start..span.end]
}

/// Plans `structure` (and `draft`) for the match at `index`, applies the batch
/// and checks the bytes outside its spans independently.
fn plan_and_apply(
    source: &str,
    index: usize,
    draft: &MatchDraft,
    structure: &MatchStructure,
) -> (Vec<DocumentEdit>, PatchedDocument) {
    let view = match_at(source, index);
    let edits = plan_match_edits_with(&view, draft, structure).expect("the intents plan");
    let patched = apply_edits(source, &edits).expect("and the batch applies");
    assert_outside_spans(source, &patched);
    (edits, patched)
} // End of function plan_and_apply()

/// Checks, **independently of the engine's verifier**, that every byte outside
/// the replacements the engine reports is the source's own, walked in ascending
/// order, and that the candidate still parses as a document of the same number
/// of matches.
fn assert_outside_spans(source: &str, patched: &PatchedDocument) {
    let candidate = patched.text();
    let mut replacements = patched.replacements().to_vec();
    replacements.sort_by_key(|replacement| (replacement.span.start, replacement.span.end));
    let (mut old, mut new) = (0usize, 0usize);
    for replacement in &replacements {
        let kept = &source[old..replacement.span.start];
        assert_eq!(
            &candidate[new..new + kept.len()],
            kept,
            "bytes before a span"
        );
        new += kept.len() + replacement.text.len();
        old = replacement.span.end;
    } // End of the loop over the reported replacements
    assert_eq!(
        &candidate[new..],
        &source[old..],
        "bytes after the last span"
    );
    assert_eq!(
        document(candidate).matches.len(),
        document(source).matches.len(),
        "no match appears or disappears"
    );
} // End of function assert_outside_spans()

/// A structure holding the given list intents and nothing else.
fn intents(sequences: Vec<SequenceIntent>) -> MatchStructure {
    MatchStructure {
        sequences,
        ..MatchStructure::default()
    }
}

/// `ScalarItems` from string literals.
fn items(values: &[&str]) -> ScalarItems {
    ScalarItems::from_vec(values.iter().map(|value| (*value).to_owned()).collect())
        .expect("at least one item")
}

/// The decoded text of every scalar item of a projected list.
fn texts(values: &[espansoconfig_core::model::ValueView]) -> Vec<String> {
    values
        .iter()
        .filter_map(|value| value.as_scalar().map(|scalar| scalar.text.clone()))
        .collect()
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

/// **Acceptance: absent and present-empty lists project differently.** Both
/// hold no items, and only the presence tells them apart — with the entry's own
/// location, read off the syntax index.
#[test]
fn absent_and_present_empty_lists_project_differently() {
    let absent = match_at(LISTS, 1);
    let empty = match_at(LISTS, 2);
    assert!(absent.trigger.triggers.is_empty() && empty.trigger.triggers.is_empty());
    assert_eq!(
        absent.trigger.triggers_presence,
        SequencePresence::Absent {}
    );
    let SequencePresence::Empty { location } = &empty.trigger.triggers_presence else {
        panic!(
            "`triggers: []` is present and empty: {:?}",
            empty.trigger.triggers_presence
        );
    };
    assert_ne!(
        absent.trigger.triggers_presence,
        empty.trigger.triggers_presence
    );
    assert_eq!(slice(LISTS, location.key_span), "triggers");
    assert_eq!(slice(LISTS, location.value_span), "[]");
    assert_eq!(
        location.path,
        Some(mapping(2).with_key("triggers")),
        "the location carries the path that names the value"
    );
    assert_eq!(absent.search_terms_presence, SequencePresence::Absent {});
} // End of function absent_and_present_empty_lists_project_differently()

/// Every one of the four states, for both match lists: a block list with its
/// count, a flow list, `[]`, and a value that is not a list at all.
#[test]
fn every_presence_state_is_told_apart() {
    let block = match_at(LISTS, 0);
    assert!(matches!(
        block.trigger.triggers_presence,
        SequencePresence::Items {
            flow: false,
            count: 3,
            ..
        }
    ));
    assert!(matches!(
        block.search_terms_presence,
        SequencePresence::Items {
            flow: false,
            count: 2,
            ..
        }
    ));
    let flow = match_at(LISTS, 2);
    assert!(matches!(
        flow.search_terms_presence,
        SequencePresence::Items {
            flow: true,
            count: 2,
            ..
        }
    ));
    assert!(flow.search_terms_presence.is_flow() && flow.trigger.triggers_presence.is_flow());
    let scalar = match_at(LISTS, 3);
    let SequencePresence::UnsupportedShape { location, found } = &scalar.search_terms_presence
    else {
        panic!("a scalar `search_terms` is an unsupported shape");
    };
    assert_eq!(*found, ValueKind::Scalar);
    assert_eq!(slice(LISTS, location.value_span), "not a list");
    assert!(scalar.search_terms.is_empty());

    // An empty value is a null, not an empty list.
    let bare = match_at(
        "matches:\n  - trigger: ':a'\n    replace: x\n    triggers:\n",
        0,
    );
    assert!(matches!(
        bare.trigger.triggers_presence,
        SequencePresence::UnsupportedShape {
            found: ValueKind::Scalar,
            ..
        }
    ));
    // A repeated key is described by its first occurrence.
    let repeated = match_at(
        "matches:\n  - trigger: ':a'\n    replace: x\n    search_terms: []\n    search_terms:\n      - b\n",
        0,
    );
    assert!(matches!(
        repeated.search_terms_presence,
        SequencePresence::Empty { .. }
    ));
} // End of function every_presence_state_is_told_apart()

/// `imports` carries the same four states at document level (§4.3 of the
/// Phase 3 split notes), and a profile answers `Absent`.
#[test]
fn imports_presence_tells_absent_from_empty() {
    let none = document("matches:\n  - trigger: ':a'\n    replace: x\n");
    assert_eq!(none.imports_presence, SequencePresence::Absent {});
    let empty = document("imports: []\nmatches:\n  - trigger: ':a'\n    replace: x\n");
    assert!(matches!(
        empty.imports_presence,
        SequencePresence::Empty { .. }
    ));
    assert!(empty.imports.is_empty() && none.imports.is_empty());
    let listed = document("imports:\n  - one.yml\n  - two.yml\nmatches: []\n");
    let SequencePresence::Items {
        location,
        flow,
        count,
    } = &listed.imports_presence
    else {
        panic!("a block `imports` has items");
    };
    assert!(!flow);
    assert_eq!(*count, 2);
    assert_eq!(
        location.path,
        Some(DocumentPath::root(0).with_key("imports"))
    );
    let null = document("imports:\nmatches: []\n");
    assert!(matches!(
        null.imports_presence,
        SequencePresence::UnsupportedShape { .. }
    ));
} // End of function imports_presence_tells_absent_from_empty()

// ---------------------------------------------------------------------------
// Items: insertion and removal in one batch
// ---------------------------------------------------------------------------

/// **Acceptance: a multi-item insertion and a removal land in one batch beside
/// an edited survivor**, byte-exact outside the spans, with each original item's
/// result position read off the same arithmetic the verifier enforces.
///
/// The removed first item takes the comment above it and its inline comment
/// with it; the survivor is rewritten in place; two new items land after the
/// last one, in order.
#[test]
fn a_multi_item_insertion_and_a_removal_land_beside_an_edited_survivor() {
    let draft = MatchDraft::new().with_item(SequenceField::Triggers, 1, ":lst2b");
    let structure = intents(vec![
        SequenceIntent::RemoveItem {
            field: SequenceField::Triggers,
            index: 0,
        },
        SequenceIntent::InsertItems {
            field: SequenceField::Triggers,
            at: ItemPlacement::End,
            items: items(&[":lst4", ":lst5"]),
        },
    ]);
    let (edits, patched) = plan_and_apply(LISTS, 0, &draft, &structure);
    assert_eq!(
        edits.len(),
        3,
        "an edit, a removal and one insertion: {edits:?}"
    );

    let expected = LISTS.replace(
        "  - triggers:\n      # the short alias\n      - \":lst1\"  # inline on the first alias\n      - \":lst2\"\n      - \":lst3\"\n",
        "  - triggers:\n      - \":lst2b\"\n      - \":lst3\"\n      - ':lst4'\n      - ':lst5'\n",
    );
    assert_eq!(patched.text(), expected);

    // Every original position, mapped to where it landed.
    let list = mapping(0).with_key("triggers");
    assert_eq!(
        item_positions(&edits, &list, 3),
        Some(vec![None, Some(0), Some(1)])
    );
    let after = match_at(patched.text(), 0);
    assert_eq!(
        texts(&after.trigger.triggers),
        [":lst2b", ":lst3", ":lst4", ":lst5"]
    );
    assert!(!patched.text().contains("the short alias"));
    assert!(!patched.text().contains("inline on the first alias"));
} // End of function a_multi_item_insertion_and_a_removal_land_beside_an_edited_survivor()

/// Items inserted at the front land above the first item's own comment block,
/// so the comment stays with the item it describes.
#[test]
fn items_at_the_front_leave_the_first_items_comment_with_it() {
    let structure = intents(vec![SequenceIntent::InsertItems {
        field: SequenceField::Triggers,
        at: ItemPlacement::Front,
        items: items(&[":zero"]),
    }]);
    let (_, patched) = plan_and_apply(LISTS, 0, &MatchDraft::new(), &structure);
    assert!(patched.text().contains(
        "  - triggers:\n      - ':zero'\n      # the short alias\n      - \":lst1\"  # inline on the first alias\n"
    ));
} // End of function items_at_the_front_leave_the_first_items_comment_with_it()

/// Several items after a middle item, and a removal elsewhere, in one batch.
#[test]
fn items_after_a_middle_item_keep_their_order() {
    let structure = intents(vec![
        SequenceIntent::InsertItems {
            field: SequenceField::Triggers,
            at: ItemPlacement::After(0),
            items: items(&["a1", "a2", "a3"]),
        },
        SequenceIntent::RemoveItem {
            field: SequenceField::Triggers,
            index: 2,
        },
    ]);
    let (edits, patched) = plan_and_apply(LISTS, 0, &MatchDraft::new(), &structure);
    let after = match_at(patched.text(), 0);
    assert_eq!(
        texts(&after.trigger.triggers),
        [":lst1", "a1", "a2", "a3", ":lst2"]
    );
    assert_eq!(
        item_positions(&edits, &mapping(0).with_key("triggers"), 3),
        Some(vec![Some(0), Some(4), None])
    );
} // End of function items_after_a_middle_item_keep_their_order()

// ---------------------------------------------------------------------------
// The last item, and whole fields
// ---------------------------------------------------------------------------

/// A match whose `search_terms` holds one item.
const ONE_TERM: &str = "\
matches:
  - trigger: ':a'
    replace: x
    search_terms:
      - only term
    label: kept
";

/// **Acceptance: removing the last item is explicit.** Removing it as an item
/// is refused by name, at the draft and at the engine; removing the whole field
/// is its own intent and leaves no stranded null.
#[test]
fn removing_the_last_item_is_refused_and_removing_the_field_is_explicit() {
    let view = match_at(ONE_TERM, 0);
    let last = intents(vec![SequenceIntent::RemoveItem {
        field: SequenceField::SearchTerms,
        index: 0,
    }]);
    assert_eq!(
        plan_match_edits_with(&view, &MatchDraft::new(), &last),
        Err(DraftError::SequenceWouldBeEmpty {
            field: SequenceField::SearchTerms
        })
    );
    // The engine refuses the same shape by its own name, whoever builds it.
    let raw = RemoveItem::new(mapping(0).with_key("search_terms").with_index(0));
    assert!(matches!(
        apply_edits(ONE_TERM, &[raw.into()]),
        Err(EditError::RemovalWouldEmptyTheSequence { .. })
    ));

    let whole = intents(vec![SequenceIntent::RemoveField {
        field: SequenceField::SearchTerms,
    }]);
    let (edits, patched) = plan_and_apply(ONE_TERM, 0, &MatchDraft::new(), &whole);
    assert!(matches!(edits.as_slice(), [DocumentEdit::RemoveField(_)]));
    assert_eq!(
        patched.text(),
        "matches:\n  - trigger: ':a'\n    replace: x\n    label: kept\n"
    );
    let after = match_at(patched.text(), 0);
    assert_eq!(after.search_terms_presence, SequencePresence::Absent {});
    assert!(
        after.unknown_entries.is_empty(),
        "no bare `search_terms:` is left behind"
    );

    // Two removals that take every item between them are refused as well.
    let both = intents(vec![
        SequenceIntent::RemoveItem {
            field: SequenceField::SearchTerms,
            index: 0,
        },
        SequenceIntent::RemoveItem {
            field: SequenceField::SearchTerms,
            index: 1,
        },
    ]);
    assert_eq!(
        plan_match_edits_with(&match_at(LISTS, 0), &MatchDraft::new(), &both),
        Err(DraftError::SequenceWouldBeEmpty {
            field: SequenceField::SearchTerms
        })
    );
    // Removing an absent field derives nothing: the desired state is the
    // actual state.
    let absent = intents(vec![SequenceIntent::RemoveField {
        field: SequenceField::Triggers,
    }]);
    assert_eq!(
        plan_match_edits_with(&match_at(ONE_TERM, 0), &MatchDraft::new(), &absent),
        Ok(Vec::new())
    );
} // End of function removing_the_last_item_is_refused_and_removing_the_field_is_explicit()

/// A whole flow list may be removed: that touches no delimiter.
#[test]
fn a_whole_flow_list_is_removed_as_one_entry() {
    let whole = intents(vec![SequenceIntent::RemoveField {
        field: SequenceField::SearchTerms,
    }]);
    let (_, patched) = plan_and_apply(LISTS, 2, &MatchDraft::new(), &whole);
    assert!(patched.text().contains(
        "  - triggers: []\n    replace: an empty list\n\n  - trigger: \":scalar-terms\""
    ));
} // End of function a_whole_flow_list_is_removed_as_one_entry()

/// A new list field is written in block style, and an explicitly empty one as
/// `[]`, in one group with a scalar field, after the last entry the batch
/// leaves alone.
#[test]
fn a_new_list_field_is_block_style_and_an_empty_one_is_brackets() {
    let draft = MatchDraft::new().with(MatchField::Label, "a label");
    let structure = intents(vec![SequenceIntent::InsertField {
        field: SequenceField::SearchTerms,
        items: vec!["one".to_owned(), "two".to_owned()],
    }]);
    let (edits, patched) = plan_and_apply(LISTS, 1, &draft, &structure);
    let [DocumentEdit::InsertFields(group)] = edits.as_slice() else {
        panic!("one group: {edits:?}");
    };
    assert_eq!(group.sibling(), Some("replace"));
    assert!(patched.text().contains(
        "    replace: one trigger\n    label: a label\n    search_terms:\n      - one\n      - two\n\n  - triggers: []"
    ));
    let after = match_at(patched.text(), 1);
    assert_eq!(texts(&after.search_terms), ["one", "two"]);

    let empty = intents(vec![SequenceIntent::InsertField {
        field: SequenceField::SearchTerms,
        items: Vec::new(),
    }]);
    let (_, patched) = plan_and_apply(LISTS, 1, &MatchDraft::new(), &empty);
    assert!(patched
        .text()
        .contains("    replace: one trigger\n    search_terms: []\n"));
    assert!(matches!(
        match_at(patched.text(), 1).search_terms_presence,
        SequencePresence::Empty { .. }
    ));
} // End of function a_new_list_field_is_block_style_and_an_empty_one_is_brackets()

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/// **Acceptance: an item's own comments go with it, and a comment the file
/// owns stays.** The first term has no comment of its own; the comment between
/// the two terms is separated by blank lines on both sides and belongs to the
/// file, so removing either neighbour leaves it, byte for byte.
#[test]
fn item_owned_comments_travel_and_file_owned_comments_stay() {
    // The item's own comments go with it.
    let first = intents(vec![SequenceIntent::RemoveItem {
        field: SequenceField::Triggers,
        index: 0,
    }]);
    let (_, patched) = plan_and_apply(LISTS, 0, &MatchDraft::new(), &first);
    assert!(patched
        .text()
        .contains("  - triggers:\n      - \":lst2\"\n      - \":lst3\"\n"));

    // The file's comment stays when the term above it goes …
    let above = intents(vec![SequenceIntent::RemoveItem {
        field: SequenceField::SearchTerms,
        index: 0,
    }]);
    let (_, patched) = plan_and_apply(LISTS, 0, &MatchDraft::new(), &above);
    assert!(patched.text().contains(
        "    search_terms:\n\n      # a comment the file owns, between two terms\n\n      - second term\n"
    ));
    // … and when the term below it goes.
    let below = intents(vec![SequenceIntent::RemoveItem {
        field: SequenceField::SearchTerms,
        index: 1,
    }]);
    let (_, patched) = plan_and_apply(LISTS, 0, &MatchDraft::new(), &below);
    assert!(patched
        .text()
        .contains("      # a comment the file owns, between two terms\n"));
    assert!(!patched.text().contains("second term"));
} // End of function item_owned_comments_travel_and_file_owned_comments_stay()

// ---------------------------------------------------------------------------
// The trigger switch
// ---------------------------------------------------------------------------

/// `trigger` becomes a block `triggers` list on a compact first line: the `-`
/// stays, the inline comment stays on the key's line, and the items take the
/// document's own indentation step.
#[test]
fn trigger_becomes_a_block_list_on_a_compact_first_line() {
    let structure = MatchStructure::new().with_switch(TriggerSwitch::ToList {
        from: TriggerForm::Trigger,
        items: items(&[":single", ":solo"]),
    });
    let (edits, patched) = plan_and_apply(LISTS, 1, &MatchDraft::new(), &structure);
    assert!(matches!(edits.as_slice(), [DocumentEdit::SwitchShape(_)]));
    assert!(patched.text().contains(
        "  - triggers:  # inline on the single trigger\n      - ':single'\n      - ':solo'\n    replace: one trigger\n"
    ));
    let after = match_at(patched.text(), 1);
    assert_eq!(after.trigger.trigger, None);
    assert_eq!(texts(&after.trigger.triggers), [":single", ":solo"]);
} // End of function trigger_becomes_a_block_list_on_a_compact_first_line()

/// A one-item `triggers` list becomes `trigger`, and the item's own comments go
/// with the list; a longer list is refused rather than losing an alias.
#[test]
fn a_one_item_list_becomes_a_single_trigger_and_a_longer_one_is_refused() {
    let source = "\
matches:
  - triggers:
      # the only alias
      - ':one'  # inline on it
    replace: x
";
    let structure = MatchStructure::new().with_switch(TriggerSwitch::FromList {
        to: TriggerForm::Trigger,
        value: ":one".to_owned(),
    });
    let (_, patched) = plan_and_apply(source, 0, &MatchDraft::new(), &structure);
    assert_eq!(
        patched.text(),
        "matches:\n  - trigger: ':one'\n    replace: x\n"
    );

    assert_eq!(
        plan_match_edits_with(&match_at(LISTS, 0), &MatchDraft::new(), &structure),
        Err(DraftError::SwitchWouldDiscardItems {
            field: SequenceField::Triggers,
            items: 3
        })
    );
    // A switch to `triggers` when the match already has it is refused by name.
    let to_list = MatchStructure::new().with_switch(TriggerSwitch::ToList {
        from: TriggerForm::Trigger,
        items: items(&[":x"]),
    });
    let both = "matches:\n  - trigger: ':a'\n    triggers: []\n    replace: x\n";
    assert_eq!(
        plan_match_edits_with(&match_at(both, 0), &MatchDraft::new(), &to_list),
        Err(DraftError::SequenceFieldPresent {
            field: SequenceField::Triggers
        })
    );
    // A switch whose scalar key also carries a draft intent is a conflict.
    assert_eq!(
        plan_match_edits_with(
            &match_at(LISTS, 1),
            &MatchDraft::new().with(MatchField::Trigger, ":other"),
            &to_list
        ),
        Err(DraftError::SubstitutionConflictsWithField {
            field: MatchField::Trigger
        })
    );
} // End of function a_one_item_list_becomes_a_single_trigger_and_a_longer_one_is_refused()

/// The engine refuses a switch of a shape it does not reshape, by name.
#[test]
fn the_engine_refuses_a_switch_it_does_not_reshape() {
    // A flow list is 3-3's.
    let flow = "matches:\n  - triggers: [':a']\n    replace: x\n";
    let switch = ShapeSwitch::new(
        mapping(0).with_key("triggers"),
        "trigger",
        EntryValue::Scalar(":a".to_owned()),
    );
    assert!(matches!(
        apply_edits(flow, &[switch.into()]),
        Err(EditError::ShapeSwitchUnsupported { edit: 0, .. })
    ));
    // A block scalar value is not reshaped into a list.
    let block = "matches:\n  - replace: x\n    trigger: |\n      :a\n";
    let switch = ShapeSwitch::new(
        mapping(0).with_key("trigger"),
        "triggers",
        EntryValue::ScalarList(vec![":a".to_owned()]),
    );
    assert!(matches!(
        apply_edits(block, &[switch.into()]),
        Err(EditError::ShapeSwitchUnsupported { edit: 0, .. })
    ));
    // A multi-line new scalar is refused.
    let list = "matches:\n  - replace: x\n    triggers:\n      - ':a'\n";
    let switch = ShapeSwitch::new(
        mapping(0).with_key("triggers"),
        "trigger",
        EntryValue::Scalar("a\nb".to_owned()),
    );
    assert!(matches!(
        apply_edits(list, &[switch.into()]),
        Err(EditError::ShapeSwitchUnsupported { edit: 0, .. })
    ));
} // End of function the_engine_refuses_a_switch_it_does_not_reshape()

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

/// **Acceptance: a request outside `triggers`/`search_terms` is refused by the
/// closed-surface audit** — a `params` list item that is not a kind list, a
/// form field's list item and a `matches` item, whether inserted or removed,
/// and a list field or a switch under any other key. Since Phase 4-5 the items
/// of a variable's four lists (`depends_on`, `values`, `choices`, `args`) are
/// inside, and asserted below beside the two match-level lists.
#[test]
fn a_list_edit_outside_the_two_lists_is_refused_by_the_audit() {
    let here = mapping(0);
    let variable = here.clone().with_key("vars").with_index(0);
    let one = |value: &str| vec![value.to_owned()];
    // A whole variable's removal left this list at Phase 4-4: `vars` items are
    // removable since then, and `variable_intents.rs` pins that shape. Every
    // other edit here is still outside.
    let outside: Vec<DocumentEdit> = vec![
        RemoveItem::new(
            variable
                .clone()
                .with_key("params")
                .with_key("layout")
                .with_index(0),
        )
        .into(),
        // A definition's `values` items are inside since Phase 4-6; another
        // option's are not.
        RemoveItem::new(
            here.clone()
                .with_key("form_fields")
                .with_key("f")
                .with_key("default")
                .with_index(0),
        )
        .into(),
        RemoveItem::new(here.clone()).into(),
        ScalarItemInsert::new(here.clone().with_key("vars"), ItemPlacement::End, one("x"))
            .expect("one value")
            .into(),
        ScalarItemInsert::new(
            variable.clone().with_key("params").with_key("layout"),
            ItemPlacement::End,
            one("x"),
        )
        .expect("one value")
        .into(),
        ScalarItemInsert::new(
            here.clone()
                .with_key("form_fields")
                .with_key("f")
                .with_key("default"),
            ItemPlacement::End,
            one("x"),
        )
        .expect("one value")
        .into(),
        FieldInsertGroup::typed(
            here.clone(),
            Some("replace".to_owned()),
            vec![("vars".to_owned(), EntryValue::ScalarList(one("x")))],
        )
        .expect("one entry")
        .into(),
        FieldInsertGroup::typed(
            here.clone(),
            Some("replace".to_owned()),
            vec![("label".to_owned(), EntryValue::ScalarList(one("x")))],
        )
        .expect("one entry")
        .into(),
        ShapeSwitch::new(
            here.clone().with_key("replace"),
            "search_terms",
            EntryValue::ScalarList(one("x")),
        )
        .into(),
        ShapeSwitch::new(
            here.clone().with_key("search_terms"),
            "trigger",
            EntryValue::Scalar("x".to_owned()),
        )
        .into(),
        FieldRemoval::new(variable.clone().with_key("depends_on")).into(),
        InsertItem::new(
            here.clone().with_key("triggers"),
            vec![("a".to_owned(), "b".to_owned())],
        )
        .into(),
    ];
    for edit in outside {
        assert_eq!(
            check_closed_surface(&here, std::slice::from_ref(&edit)),
            Err(DraftError::OutsideTheClosedSurface { edit: 0 }),
            "{edit:?} must be outside the surface"
        );
    } // End of the loop over the edits outside the two lists

    // The same shapes on the two lists are inside it.
    let inside: Vec<DocumentEdit> = vec![
        RemoveItem::new(here.clone().with_key("triggers").with_index(1)).into(),
        ScalarItemInsert::new(
            here.clone().with_key("search_terms"),
            ItemPlacement::Front,
            one("x"),
        )
        .expect("one value")
        .into(),
        FieldRemoval::new(here.clone().with_key("search_terms")).into(),
        ShapeSwitch::new(
            here.clone().with_key("regex"),
            "triggers",
            EntryValue::ScalarList(one("x")),
        )
        .into(),
        // Phase 4-5: a variable's four lists.
        RemoveItem::new(variable.clone().with_key("depends_on").with_index(0)).into(),
        RemoveItem::new(
            variable
                .clone()
                .with_key("params")
                .with_key("values")
                .with_index(0),
        )
        .into(),
        ScalarItemInsert::new(
            variable.clone().with_key("depends_on"),
            ItemPlacement::End,
            one("x"),
        )
        .expect("one value")
        .into(),
        ScalarItemInsert::new(
            variable.clone().with_key("params").with_key("args"),
            ItemPlacement::End,
            one("x"),
        )
        .expect("one value")
        .into(),
    ];
    for edit in inside {
        assert_eq!(
            check_closed_surface(&here, std::slice::from_ref(&edit)),
            Ok(()),
            "{edit:?} is inside the surface"
        );
    } // End of the loop over the edits on the two lists
} // End of function a_list_edit_outside_the_two_lists_is_refused_by_the_audit()

/// Two intents about one list that say two things are refused before any
/// diffing, and the audit refuses the hand-built twin of the insertion-lands-on
/// -a-removal shape.
#[test]
fn conflicting_list_intents_are_refused_by_name() {
    let view = match_at(LISTS, 0);
    let conflict = DraftError::SequenceIntentsConflict {
        field: SequenceField::Triggers,
    };
    let cases = vec![
        // An insertion at the front lands where item 0's removal begins.
        (
            MatchDraft::new(),
            intents(vec![
                SequenceIntent::InsertItems {
                    field: SequenceField::Triggers,
                    at: ItemPlacement::Front,
                    items: items(&["x"]),
                },
                SequenceIntent::RemoveItem {
                    field: SequenceField::Triggers,
                    index: 0,
                },
            ]),
        ),
        // `After(2)` and `End` are the same place in a three-item list.
        (
            MatchDraft::new(),
            intents(vec![
                SequenceIntent::InsertItems {
                    field: SequenceField::Triggers,
                    at: ItemPlacement::After(2),
                    items: items(&["x"]),
                },
                SequenceIntent::InsertItems {
                    field: SequenceField::Triggers,
                    at: ItemPlacement::End,
                    items: items(&["y"]),
                },
            ]),
        ),
        // One item removed twice.
        (
            MatchDraft::new(),
            intents(vec![
                SequenceIntent::RemoveItem {
                    field: SequenceField::Triggers,
                    index: 1,
                },
                SequenceIntent::RemoveItem {
                    field: SequenceField::Triggers,
                    index: 1,
                },
            ]),
        ),
        // Removed and rewritten.
        (
            MatchDraft::new().with_item(SequenceField::Triggers, 1, "x"),
            intents(vec![SequenceIntent::RemoveItem {
                field: SequenceField::Triggers,
                index: 1,
            }]),
        ),
        // The whole field beside another intent about it.
        (
            MatchDraft::new(),
            intents(vec![
                SequenceIntent::RemoveField {
                    field: SequenceField::Triggers,
                },
                SequenceIntent::InsertItems {
                    field: SequenceField::Triggers,
                    at: ItemPlacement::End,
                    items: items(&["x"]),
                },
            ]),
        ),
        // A switch beside another intent about `triggers`.
        (
            MatchDraft::new().with_item(SequenceField::Triggers, 0, "x"),
            MatchStructure::new().with_switch(TriggerSwitch::FromList {
                to: TriggerForm::Trigger,
                value: "x".to_owned(),
            }),
        ),
    ];
    for (draft, structure) in cases {
        assert_eq!(
            plan_match_edits_with(&view, &draft, &structure),
            Err(conflict.clone()),
            "{structure:?}"
        );
    } // End of the loop over the conflicting intents

    let list = mapping(0).with_key("triggers");
    let batch: Vec<DocumentEdit> = vec![
        ScalarItemInsert::new(list.clone(), ItemPlacement::After(0), vec!["x".to_owned()])
            .expect("one value")
            .into(),
        RemoveItem::new(list.with_index(1)).into(),
    ];
    assert_eq!(
        check_batch_independence(&mapping(0), &["triggers".to_owned()], &[], &batch),
        Err(conflict)
    );
} // End of function conflicting_list_intents_are_refused_by_name()

/// Every presence refusal, by name: an absent list, a flow list a switch would
/// reshape (item intents on a flow list plan since Phase 3-3), a value that is
/// not a list, a present list asked for again, an index out of range and an item
/// that is not a scalar.
#[test]
fn a_list_intent_the_list_cannot_honour_is_refused_by_name() {
    let insert = |field| {
        intents(vec![SequenceIntent::InsertItems {
            field,
            at: ItemPlacement::End,
            items: items(&["x"]),
        }])
    };
    let none = MatchDraft::new();
    assert_eq!(
        plan_match_edits_with(&match_at(LISTS, 1), &none, &insert(SequenceField::Triggers)),
        Err(DraftError::SequenceFieldAbsent {
            field: SequenceField::Triggers
        })
    );
    for field in [SequenceField::Triggers, SequenceField::SearchTerms] {
        assert!(
            plan_match_edits_with(&match_at(LISTS, 2), &none, &insert(field)).is_ok(),
            "an item intent on a flow list plans since Phase 3-3"
        );
    } // End of the loop over the two flow lists
    assert_eq!(
        plan_match_edits_with(
            &match_at(LISTS, 2),
            &none,
            &MatchStructure::new().with_switch(TriggerSwitch::FromList {
                to: TriggerForm::Trigger,
                value: ":x".to_owned(),
            })
        ),
        Err(DraftError::SequenceIsAFlowList {
            field: SequenceField::Triggers
        })
    );
    assert_eq!(
        plan_match_edits_with(
            &match_at(LISTS, 3),
            &none,
            &insert(SequenceField::SearchTerms)
        ),
        Err(DraftError::SequenceHasAnUnsupportedShape {
            field: SequenceField::SearchTerms,
            found: ValueKind::Scalar
        })
    );
    assert_eq!(
        plan_match_edits_with(
            &match_at(LISTS, 2),
            &none,
            &intents(vec![SequenceIntent::InsertField {
                field: SequenceField::Triggers,
                items: vec!["x".to_owned()],
            }])
        ),
        Err(DraftError::SequenceFieldPresent {
            field: SequenceField::Triggers
        })
    );
    assert_eq!(
        plan_match_edits_with(
            &match_at(LISTS, 0),
            &none,
            &intents(vec![SequenceIntent::RemoveItem {
                field: SequenceField::Triggers,
                index: 7,
            }])
        ),
        Err(DraftError::SequenceItemDoesNotExist {
            field: SequenceField::Triggers,
            index: 7,
            length: 3
        })
    );
    let nested = "matches:\n  - trigger: ':a'\n    replace: x\n    search_terms:\n      - one\n      - [two]\n";
    assert_eq!(
        plan_match_edits_with(
            &match_at(nested, 0),
            &none,
            &intents(vec![SequenceIntent::RemoveItem {
                field: SequenceField::SearchTerms,
                index: 1,
            }])
        ),
        Err(DraftError::NotAScalar {
            target: DraftTarget::Item {
                field: SequenceField::SearchTerms,
                index: 1
            }
        })
    );
} // End of function a_list_intent_the_list_cannot_honour_is_refused_by_name()

// ---------------------------------------------------------------------------
// Engine edges
// ---------------------------------------------------------------------------

/// Items appended at the unterminated end of a file keep the file without a
/// final newline, and a CRLF file gets CRLF items.
#[test]
fn new_items_copy_the_line_ending_and_keep_a_missing_final_newline() {
    let unterminated =
        "matches:\n  - trigger: ':a'\n    replace: x\n    search_terms:\n      - one";
    let edit = ScalarItemInsert::new(
        mapping(0).with_key("search_terms"),
        ItemPlacement::End,
        vec!["two".to_owned(), "three".to_owned()],
    )
    .expect("two values");
    let patched = apply_edits(unterminated, &[edit.clone().into()]).expect("applies");
    assert_eq!(
        patched.text(),
        "matches:\n  - trigger: ':a'\n    replace: x\n    search_terms:\n      - one\n      - two\n      - three"
    );
    assert_outside_spans(unterminated, &patched);

    let crlf =
        "matches:\r\n  - trigger: ':a'\r\n    search_terms:\r\n      - one\r\n    replace: x\r\n";
    let patched = apply_edits(crlf, &[edit.into()]).expect("applies");
    assert_eq!(
        patched.text(),
        "matches:\r\n  - trigger: ':a'\r\n    search_terms:\r\n      - one\r\n      - two\r\n      - three\r\n    replace: x\r\n"
    );
} // End of function new_items_copy_the_line_ending_and_keep_a_missing_final_newline()

/// A flow list is never converted: since Phase 3-3 an item lands between its
/// brackets (`tests/flow_list.rs` holds the rest of that step's acceptance).
#[test]
fn the_engine_never_converts_a_flow_list() {
    let edit = ScalarItemInsert::new(
        mapping(2).with_key("search_terms"),
        ItemPlacement::End,
        vec!["gamma".to_owned()],
    )
    .expect("one value");
    let patched = apply_edits(LISTS, &[edit.into()]).expect("applies");
    assert_eq!(
        patched.text(),
        LISTS.replace(
            "search_terms: [alpha, beta]",
            "search_terms: [alpha, beta, 'gamma']"
        )
    );
    assert_outside_spans(LISTS, &patched);
} // End of function the_engine_never_converts_a_flow_list()

// ---------------------------------------------------------------------------
// Through the save transaction
// ---------------------------------------------------------------------------

/// A list batch commits through `save_document`, and the bytes on disk are the
/// candidate the engine verified.
#[test]
fn a_list_batch_commits_through_the_save_transaction() {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("lists.yml");
    std::fs::write(&target, LISTS.as_bytes()).expect("the fixture is written");
    let edits = plan_match_edits_with(
        &match_at(LISTS, 0),
        &MatchDraft::new(),
        &intents(vec![
            SequenceIntent::RemoveItem {
                field: SequenceField::Triggers,
                index: 2,
            },
            SequenceIntent::InsertItems {
                field: SequenceField::SearchTerms,
                at: ItemPlacement::End,
                items: items(&["third term"]),
            },
        ]),
    )
    .expect("the intents plan");
    let context = DocumentContext {
        id: DocumentId(1),
        path: target.clone(),
        relative_path: std::path::PathBuf::from("lists.yml"),
        kind: FileKind::MatchFile,
        disabled: false,
    };
    let saved = save_document(SaveRequest {
        context: &context,
        base_revision: ContentRevision::of_bytes(LISTS.as_bytes()),
        content: SaveContent::Edits(&edits),
        acknowledgement: &Acknowledgement::none(),
        backups: None,
    })
    .expect("the save commits");
    assert!(saved.committed);
    let written = std::fs::read_to_string(&target).expect("the file is readable");
    assert_eq!(written, saved.text);
    let after = match_at(&written, 0);
    assert_eq!(texts(&after.trigger.triggers), [":lst1", ":lst2"]);
    assert_eq!(
        texts(&after.search_terms),
        ["first term", "second term", "third term"]
    );
} // End of function a_list_batch_commits_through_the_save_transaction()

// ---------------------------------------------------------------------------
// A list edit beside a sibling-field insertion (the 3-2 review's finding)
// ---------------------------------------------------------------------------

/// The two edits of a mixed batch: `list_edit` on match 0's `triggers`, and an
/// absent `label` inserted after `replace` in the same mapping.
fn mixed_batch(list_edit: DocumentEdit, list_first: bool) -> Vec<DocumentEdit> {
    let label: DocumentEdit = FieldInsertGroup::after(
        mapping(0),
        "replace",
        vec![("label".to_owned(), "a new label".to_owned())],
    )
    .expect("one entry")
    .into();
    if list_first {
        vec![list_edit, label]
    } else {
        vec![label, list_edit]
    }
} // End of function mixed_batch()

/// Checks that the audit admits `edits`, applies them, checks the bytes outside
/// the reported spans independently, and compares the whole candidate.
fn apply_mixed(edits: &[DocumentEdit], expected: &str) -> PatchedDocument {
    let keys: Vec<String> = ["triggers", "replace", "search_terms"]
        .iter()
        .map(|key| (*key).to_owned())
        .collect();
    assert_eq!(check_closed_surface(&mapping(0), edits), Ok(()));
    assert_eq!(
        check_batch_independence(&mapping(0), &keys, &[], edits),
        Ok(())
    );
    let patched = apply_edits(LISTS, edits).expect("the disjoint batch applies");
    assert_outside_spans(LISTS, &patched);
    assert_eq!(patched.text(), expected);
    patched
} // End of function apply_mixed()

/// **Regression (3-2 review):** appending to a block `triggers` list while the
/// same batch inserts an absent `label` after `replace` is a disjoint batch, and
/// it verifies in **both** edit orders. The mapping's sibling check no longer
/// digests the list the item edit legitimately changes; that list's own item
/// expectation still checks every kept and new item.
#[test]
fn a_list_append_beside_a_new_sibling_field_verifies_in_both_orders() {
    let expected = LISTS.replace(
        "      - \":lst3\"\n    replace: a list of three\n",
        "      - \":lst3\"\n      - ':lst4'\n    replace: a list of three\n    label: a new label\n",
    );
    for list_first in [true, false] {
        let append: DocumentEdit = ScalarItemInsert::new(
            mapping(0).with_key("triggers"),
            ItemPlacement::End,
            vec![":lst4".to_owned()],
        )
        .expect("one value")
        .into();
        let patched = apply_mixed(&mixed_batch(append, list_first), &expected);
        let after = match_at(patched.text(), 0);
        assert_eq!(
            texts(&after.trigger.triggers),
            [":lst1", ":lst2", ":lst3", ":lst4"]
        );
    } // End of the loop over the two edit orders
} // End of function a_list_append_beside_a_new_sibling_field_verifies_in_both_orders()

/// The removal variant of the same regression: an item removed from `triggers`
/// beside a new `label`, in both edit orders.
#[test]
fn a_list_removal_beside_a_new_sibling_field_verifies_in_both_orders() {
    let expected = LISTS.replace("      - \":lst2\"\n", "").replace(
        "    replace: a list of three\n",
        "    replace: a list of three\n    label: a new label\n",
    );
    for list_first in [true, false] {
        let removal: DocumentEdit =
            RemoveItem::new(mapping(0).with_key("triggers").with_index(1)).into();
        let patched = apply_mixed(&mixed_batch(removal, list_first), &expected);
        let after = match_at(patched.text(), 0);
        assert_eq!(texts(&after.trigger.triggers), [":lst1", ":lst3"]);
    } // End of the loop over the two edit orders
} // End of function a_list_removal_beside_a_new_sibling_field_verifies_in_both_orders()
