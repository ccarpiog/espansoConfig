//! Phase 2b-2b-1 acceptance: a draft of one match, and the batch it derives.
//!
//! The headline property is the first test in the file, and it is the one that
//! catches the failure this whole sub-phase exists to prevent: **a batch that
//! rewrites a scalar whose logical value nobody changed.** A match written in
//! four different scalar styles is drafted with every field set to its own
//! currently-projected value, and the derived batch must be *empty* — then the
//! empty batch is run through the patch engine and the document must come back
//! byte-identical with no presentation note.
//!
//! The same property then runs over **both corpora**, match by match: the
//! committed synthetic files always, and the owner's real configuration when it
//! is present. A property checked only against the shapes its author thought of
//! is a property about its author.
//!
//! Everything else is one named refusal per test. A refusal that no test can
//! reach is a sentence rather than a rule, so each of the six batch hazards is
//! driven through the guard that states it, and every hazard the planner can
//! produce on its own is driven through the planner too.
//!
//! # Privacy
//!
//! Every **fixture** in this file is hand-authored, inline and neutral
//! (`CLAUDE.md` section 1). The two corpus sweeps read files rather than
//! fixtures, and the real one reads the owner's configuration — so they report
//! **counts, file names and refusal codes only**. No value, no key text and no
//! document byte reaches a `println!`, an assertion message or a test name, and
//! the real sweep skips cleanly when the gitignored corpus is absent.

mod common;

use std::collections::BTreeMap;

use espansoconfig_core::draft::{
    check_batch_independence, check_closed_surface, plan_match_edits, DraftError, DraftField,
    DraftTarget, ItemDraft, MatchDraft, MatchField, SequenceField,
};
use espansoconfig_core::model::{DocumentContext, MatchView, ScalarView, ValueKind};
use espansoconfig_core::patch::{
    apply_edits, DocumentEdit, DocumentPath, FieldInsert, FieldRemoval, ItemMove, ScalarEdit,
};
use espansoconfig_core::syntax::HazardKind;
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::{DocumentId, ScalarStyle};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/// One match holding **every** field of the closed surface, deliberately
/// written in four different scalar styles.
///
/// It is not a match espanso would accept — it carries all three trigger forms
/// and all five content forms at once — and that is the point: the projection
/// reports the shape as a diagnostic rather than a hazard, so the planner sees a
/// mapping with every schema-known scalar key present exactly once.
const NONCANONICAL: &str = r#"matches:
  - trigger: hello
    triggers:
      - ':one'
      - ":two\ttab"
    regex: (?P<n>\d+)
    replace: |
      first line
      second line
    markdown: '**bold**'
    html: "<b>bold</b>"
    image_path: $CONFIG/pictures/one.png
    form: >-
      folded form
      body
    label: 'a quoted label'
    comment: "a comment with a \"quote\""
    search_terms:
      - plain term
      - 'quoted term'
    word: true
    left_word: false
    right_word: 'yes'
    propagate_case: "on"
    uppercase_style: capitalize
    force_mode: clipboard
    force_clipboard: "off"
    paragraph: 'no'
    anchor: top
"#;

/// A small, schema-clean match: one trigger form, one content form, a label.
const SIMPLE: &str = "matches:\n  - trigger: hello\n    replace: world\n    label: a label\n";

/// One match, projected the way the workspace would project its file.
fn one_match(source: &str) -> MatchView {
    let context = DocumentContext::detached(DocumentId(0), "draft.yml");
    project_source(&context, source)
        .view
        .matches
        .first()
        .cloned()
        .expect("the fixture holds one match")
}

/// A draft that sets **every** field the match holds to its own projected
/// logical value, and every element of both sequences to its own.
///
/// Built from the view rather than written out, so the test states the property
/// — *the value that is already there* — instead of a transcription of it that
/// could drift from the fixture.
fn every_projected_value(view: &MatchView) -> MatchDraft {
    let mut draft = MatchDraft::new();
    for field in MatchField::ALL {
        if let Some(text) = projected_text(view, field) {
            *draft.field_mut(field) = DraftField::Set(text);
        }
    } // End of the loop over the schema-known scalar fields
    for (index, item) in view.trigger.triggers.iter().enumerate() {
        let text = item.as_scalar().expect("a scalar trigger").text.clone();
        draft.triggers.push(ItemDraft {
            index,
            value: DraftField::Set(text),
        });
    } // End of the loop over the projected triggers
    for (index, item) in view.search_terms.iter().enumerate() {
        let text = item.as_scalar().expect("a scalar search term").text.clone();
        draft.search_terms.push(ItemDraft {
            index,
            value: DraftField::Set(text),
        });
    } // End of the loop over the projected search terms
    draft
} // End of function every_projected_value()

/// The projected scalar of one field, or `None` when the match has none.
///
/// The planner's own lookup is private, so this is a **second, independent**
/// spelling of it. That is deliberate: a planner that read the wrong field would
/// otherwise agree with a test that read the same wrong field.
fn scalar_of(view: &MatchView, field: MatchField) -> Option<&ScalarView> {
    match field {
        MatchField::Trigger => view.trigger.trigger.as_ref(),
        MatchField::Regex => view.trigger.regex.as_ref(),
        MatchField::Replace => view.content.replace.as_ref(),
        MatchField::Markdown => view.content.markdown.as_ref(),
        MatchField::Html => view.content.html.as_ref(),
        MatchField::ImagePath => view.content.image_path.as_ref(),
        MatchField::Form => view.content.form.as_ref(),
        MatchField::Label => view.label.as_ref(),
        MatchField::Comment => view.comment.as_ref(),
        MatchField::Word => view.options.word.as_ref(),
        MatchField::LeftWord => view.options.left_word.as_ref(),
        MatchField::RightWord => view.options.right_word.as_ref(),
        MatchField::PropagateCase => view.options.propagate_case.as_ref(),
        MatchField::UppercaseStyle => view.options.uppercase_style.as_ref(),
        MatchField::ForceMode => view.options.force_mode.as_ref(),
        MatchField::ForceClipboard => view.options.force_clipboard.as_ref(),
        MatchField::Paragraph => view.options.paragraph.as_ref(),
        MatchField::Anchor => view.options.anchor.as_ref(),
    }
} // End of function scalar_of()

/// The projected logical value of one field, or `None` when the match has none.
fn projected_text(view: &MatchView, field: MatchField) -> Option<String> {
    scalar_of(view, field).map(|scalar| scalar.text.clone())
}

/// The path of the fixture's first match.
fn match_path(view: &MatchView) -> DocumentPath {
    view.path.clone().expect("a match reached through matches")
}

// ---------------------------------------------------------------------------
// The headline property
// ---------------------------------------------------------------------------

/// The test the sub-phase exists for.
///
/// The likeliest silent failure of a draft engine is emitting a `ScalarEdit` for
/// every value the draft carries, because the source spelling or the codec's
/// preferred spelling differs from what would be re-emitted. Nothing downstream
/// catches it: the candidate parses, every value still decodes to what it
/// decoded to, and the save succeeds — having rewritten quoting the user chose.
#[test]
fn every_field_set_to_its_own_projected_value_derives_an_empty_batch_and_moves_no_byte() {
    let view = one_match(NONCANONICAL);

    // The fixture must actually be non-canonical, or the property is vacuous.
    let styles: Vec<ScalarStyle> = MatchField::ALL
        .into_iter()
        .filter_map(|field| scalar_of(&view, field).map(|scalar| scalar.style))
        .collect();
    for expected in [
        ScalarStyle::Plain,
        ScalarStyle::SingleQuoted,
        ScalarStyle::DoubleQuoted,
        ScalarStyle::Literal,
        ScalarStyle::Folded,
    ] {
        assert!(
            styles.contains(&expected),
            "the fixture must hold a {expected:?} scalar, or this property proves nothing"
        );
    }
    assert_eq!(
        styles.len(),
        18,
        "every schema-known scalar field is present"
    );
    assert_eq!(view.trigger.triggers.len(), 2);
    assert_eq!(view.search_terms.len(), 2);

    // No two fields may decode to the same string, or a planner that read one
    // field's value while writing another's path would still derive no edit.
    let mut values: Vec<String> = MatchField::ALL
        .into_iter()
        .filter_map(|field| projected_text(&view, field))
        .collect();
    values.sort();
    let distinct = values.len();
    values.dedup();
    assert_eq!(
        values.len(),
        distinct,
        "every field of the fixture must decode to its own value"
    );

    let draft = every_projected_value(&view);
    let edits = plan_match_edits(&view, &draft).expect("a fully populated identical draft plans");
    assert!(
        edits.is_empty(),
        "a draft holding the values the file already holds derives no edit, got {}",
        edits.len()
    );

    let patched = apply_edits(NONCANONICAL, &edits).expect("an empty batch applies");
    assert_eq!(
        patched.text(),
        NONCANONICAL,
        "the document must come back byte-identical"
    );
    assert!(
        patched.notes().is_empty(),
        "an empty batch produces no presentation note"
    );
} // End of function every_field_set_to_its_own_projected_value_derives_an_empty_batch_and_moves_no_byte()

/// The companion: one genuinely different value, one edit, at the right path.
#[test]
fn one_genuinely_different_logical_value_derives_exactly_one_scalar_edit() {
    let view = one_match(NONCANONICAL);
    let draft = every_projected_value(&view).with(MatchField::Label, "a different label");
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");

    assert_eq!(edits.len(), 1, "exactly one field differs");
    let DocumentEdit::Scalar(edit) = &edits[0] else {
        panic!("a value that exists is rewritten, never inserted");
    };
    assert_eq!(edit.path(), &match_path(&view).with_key("label"));
    assert_eq!(edit.value(), "a different label");
} // End of function one_genuinely_different_logical_value_derives_exactly_one_scalar_edit()

/// The batch lands, and nothing else in the document does.
#[test]
fn a_planned_batch_lands_the_drafted_values_and_leaves_every_other_field_alone() {
    let view = one_match(NONCANONICAL);
    let draft = MatchDraft::new()
        .with(MatchField::Label, "a different label")
        .with_item(SequenceField::SearchTerms, 1, "another term");
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    assert_eq!(edits.len(), 2);

    let patched = apply_edits(NONCANONICAL, &edits).expect("the batch applies");
    assert_eq!(patched.replacements().len(), 2, "two spans, and no more");

    let after = one_match(patched.text());
    assert_eq!(
        after.label.as_ref().expect("a label").text,
        "a different label"
    );
    assert_eq!(
        after.search_terms[1].as_scalar().expect("a scalar").text,
        "another term"
    );
    for field in MatchField::ALL {
        if field == MatchField::Label {
            continue;
        }
        assert_eq!(
            projected_text(&after, field),
            projected_text(&view, field),
            "{field:?} was not drafted and must decode to exactly what it did"
        );
    } // End of the loop that re-checks every undrafted field
    assert_eq!(
        after.search_terms[0].as_scalar().expect("a scalar").text,
        view.search_terms[0].as_scalar().expect("a scalar").text
    );
} // End of function a_planned_batch_lands_the_drafted_values_and_leaves_every_other_field_alone()

// ---------------------------------------------------------------------------
// The three decisions this sub-phase had to make
// ---------------------------------------------------------------------------

/// A `Set` of the value that is already there derives no edit.
#[test]
fn setting_a_field_to_the_value_it_already_holds_derives_no_edit() {
    let view = one_match(SIMPLE);
    let draft = MatchDraft::new().with(MatchField::Label, "a label");
    assert_eq!(plan_match_edits(&view, &draft), Ok(Vec::new()));
}

/// A `Set` of an absent field derives exactly one insertion, anchored on an
/// original sibling.
#[test]
fn setting_an_absent_field_derives_exactly_one_insertion() {
    let view = one_match(SIMPLE);
    let draft = MatchDraft::new().with(MatchField::Word, "true");
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");

    assert_eq!(edits.len(), 1);
    let DocumentEdit::InsertField(insert) = &edits[0] else {
        panic!("an absent field is inserted, never rewritten");
    };
    assert_eq!(insert.mapping(), &match_path(&view));
    assert_eq!(insert.key(), "word");
    assert_eq!(insert.value(), "true");
    assert_eq!(
        insert.sibling(),
        Some("label"),
        "the anchor is the mapping's last visible entry"
    );
    apply_edits(SIMPLE, &edits).expect("and the insertion applies");
} // End of function setting_an_absent_field_derives_exactly_one_insertion()

/// A match whose only entry is one this surface cannot name gives an insertion
/// no anchor to be written after.
#[test]
fn an_insertion_with_no_original_sibling_to_anchor_on_is_refused() {
    let source = "matches:\n  - vars:\n      - name: one\n        type: date\n";
    let view = one_match(source);
    assert!(
        MatchField::ALL
            .into_iter()
            .all(|field| scalar_of(&view, field).is_none()),
        "the fixture must hold no schema-known scalar field"
    );
    let draft = MatchDraft::new().with(MatchField::Label, "a label");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::NoInsertionAnchor {
            field: MatchField::Label,
        })
    );
} // End of function an_insertion_with_no_original_sibling_to_anchor_on_is_refused()

/// **A limit, pinned rather than assumed.** An empty but present sequence is
/// invisible as an insertion anchor.
///
/// `triggers: []` is an original, decoded, addressable sibling, and a new key
/// could be written after it. The planner cannot see it: a sequence's only
/// offset in `MatchView` is its first element's, and an empty sequence has none,
/// so the match reads as having no visible entry at all.
///
/// The fix is not in this module. An empty `Vec<ValueView>` cannot distinguish
/// *absent* from *present but empty* — the same ambiguity `search_terms` has —
/// and resolving it means giving `MatchView` the sequence entry's own span,
/// which is a change to the read model. This test states what today does, so
/// the day it changes is a day a test moves.
#[test]
fn an_empty_sequence_is_invisible_as_an_insertion_anchor() {
    let view = one_match("matches:\n  - triggers: []\n");
    assert!(
        view.safely_editable && view.blocking_hazard.is_none(),
        "the gate admits the match, so the refusal below is the planner's"
    );
    assert!(
        view.trigger.triggers.is_empty(),
        "an empty sequence projects as no elements, which is the ambiguity itself"
    );
    let draft = MatchDraft::new().with(MatchField::Label, "a label");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::NoInsertionAnchor {
            field: MatchField::Label,
        }),
        "an insertion that ought to work is refused, and this is why"
    );
} // End of function an_empty_sequence_is_invisible_as_an_insertion_anchor()

/// A `Remove` of a field that is already absent derives no edit: the desired
/// state is the actual state.
#[test]
fn removing_a_field_that_is_already_absent_derives_no_edit() {
    let view = one_match(SIMPLE);
    let draft = MatchDraft::new().without(MatchField::Comment);
    assert_eq!(plan_match_edits(&view, &draft), Ok(Vec::new()));
}

/// A `Remove` of a field that is there derives exactly one removal.
#[test]
fn removing_a_present_field_derives_exactly_one_removal() {
    let view = one_match(SIMPLE);
    let draft = MatchDraft::new().without(MatchField::Label);
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");

    assert_eq!(edits.len(), 1);
    let DocumentEdit::RemoveField(removal) = &edits[0] else {
        panic!("a present field is removed");
    };
    assert_eq!(removal.field(), &match_path(&view).with_key("label"));
    apply_edits(SIMPLE, &edits).expect("and the removal applies");
} // End of function removing_a_present_field_derives_exactly_one_removal()

/// An existing element of a string sequence is a scalar node, so editing it is
/// a scalar-node replacement rather than a sequence mutation.
#[test]
fn editing_an_existing_sequence_element_derives_one_scalar_edit() {
    let view = one_match(NONCANONICAL);
    let draft = MatchDraft::new().with_item(SequenceField::Triggers, 0, ":changed");
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");

    assert_eq!(edits.len(), 1);
    let DocumentEdit::Scalar(edit) = &edits[0] else {
        panic!("an element is rewritten in place");
    };
    assert_eq!(
        edit.path(),
        &match_path(&view).with_key("triggers").with_index(0)
    );
} // End of function editing_an_existing_sequence_element_derives_one_scalar_edit()

// ---------------------------------------------------------------------------
// Out of scope, each by name
// ---------------------------------------------------------------------------

/// Adding an element is a cardinality change, and there is no primitive for it.
#[test]
fn adding_an_element_to_a_sequence_is_refused_as_a_cardinality_change() {
    let view = one_match(NONCANONICAL);
    let draft = MatchDraft::new().with_item(SequenceField::Triggers, 2, ":three");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::SequenceItemDoesNotExist {
            field: SequenceField::Triggers,
            index: 2,
            length: 2,
        })
    );
} // End of function adding_an_element_to_a_sequence_is_refused_as_a_cardinality_change()

/// Deleting an element is a cardinality change too.
#[test]
fn deleting_an_element_of_a_sequence_is_refused_as_a_cardinality_change() {
    let view = one_match(NONCANONICAL);
    let mut draft = MatchDraft::new();
    draft.search_terms.push(ItemDraft {
        index: 0,
        value: DraftField::Remove,
    });
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::SequenceItemRemoval {
            field: SequenceField::SearchTerms,
            index: 0,
        })
    );
} // End of function deleting_an_element_of_a_sequence_is_refused_as_a_cardinality_change()

/// A sequence the file writes as a collection of collections has an element the
/// draft cannot address as a scalar.
#[test]
fn a_sequence_element_that_is_not_a_scalar_is_refused() {
    let source = "matches:\n  - triggers:\n      - one\n      - [a, b]\n    replace: text\n";
    let view = one_match(source);
    let draft = MatchDraft::new().with_item(SequenceField::Triggers, 1, "two");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::NotAScalar {
            target: DraftTarget::Item {
                field: SequenceField::Triggers,
                index: 1,
            },
        })
    );
} // End of function a_sequence_element_that_is_not_a_scalar_is_refused()

/// The fixture the two collection refusals are stated on: one `replace:` key
/// holding a nested mapping.
const COLLECTION_VALUED_KEY: &str =
    "matches:\n  - trigger: hello\n    replace:\n      nested: value\n";

/// **The reachability question, answered.** A match whose known key holds a
/// collection is *not* stopped by the hazard gate, so both refusals below are
/// decisions this planner takes rather than shapes it never meets.
///
/// If this ever stops holding, the two refusals become unreachable and the
/// review's finding 2 becomes documentation; while it holds, they are policy.
#[test]
fn a_known_key_holding_a_collection_reaches_the_planner_at_all() {
    let view = one_match(COLLECTION_VALUED_KEY);
    assert!(
        view.safely_editable,
        "the gate admits this match, so the planner is what decides"
    );
    assert!(view.blocking_hazard.is_none(), "and it names no hazard");
    assert!(view.path.is_some(), "and the match is addressable");
    assert!(
        view.content.replace.is_none(),
        "the projection models no scalar for a key holding a mapping"
    );
    assert!(
        view.unknown_entries
            .iter()
            .any(|entry| entry.key.as_deref() == Some("replace")
                && entry.value_kind == ValueKind::Mapping),
        "and records it as an entry it did not model"
    );
} // End of function a_known_key_holding_a_collection_reaches_the_planner_at_all()

/// A `Set` over such a key is not expressible: no primitive turns a collection
/// node into a scalar one, and remove-then-insert is not a spelling of it
/// because the insertion is planned against the original index.
#[test]
fn setting_a_field_whose_existing_value_is_a_collection_is_refused_as_unmodelled() {
    let view = one_match(COLLECTION_VALUED_KEY);
    let set = MatchDraft::new().with(MatchField::Replace, "text");
    assert_eq!(
        plan_match_edits(&view, &set),
        Err(DraftError::FieldHasAnUnmodelledShape {
            field: MatchField::Replace,
            found: ValueKind::Mapping,
        })
    );
} // End of function setting_a_field_whose_existing_value_is_a_collection_is_refused_as_unmodelled()

/// A `Remove` over such a key **is** expressible — a field removal deletes the
/// whole subtree — and is refused anyway, under a name that says why: those
/// bytes were never displayed to the user.
#[test]
fn removing_a_field_whose_value_was_never_displayed_is_refused_as_a_decision() {
    let view = one_match(COLLECTION_VALUED_KEY);
    let removed = MatchDraft::new().without(MatchField::Replace);
    assert_eq!(
        plan_match_edits(&view, &removed),
        Err(DraftError::RemovalWouldDiscardUnshownStructure {
            field: MatchField::Replace,
            found: ValueKind::Mapping,
        }),
        "the refusal is named for the reason, not for the shape that finds it"
    );
} // End of function removing_a_field_whose_value_was_never_displayed_is_refused_as_a_decision()

/// A scalar whose projected text is a raw source slice cannot be compared as a
/// logical value.
///
/// The projection produces this only for a double-quoted body the substrate
/// accepted and this crate's decoder did not, and the corpus tests pin that
/// count at zero — so the state is reached here the only way a test honestly
/// can, by setting the flag the projection sets.
#[test]
fn a_field_whose_existing_scalar_did_not_decode_is_refused_rather_than_compared() {
    let mut view = one_match(SIMPLE);
    view.label.as_mut().expect("a label").decoded = false;
    let draft = MatchDraft::new().with(MatchField::Label, "a label");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::NotDecodable {
            target: DraftTarget::Field(MatchField::Label),
        })
    );
} // End of function a_field_whose_existing_scalar_did_not_decode_is_refused_rather_than_compared()

/// An entry written `label:` has a zero-width value, so there are no bytes to
/// replace.
#[test]
fn a_field_that_owns_no_bytes_is_refused() {
    let source = "matches:\n  - trigger: hello\n    replace: world\n    label:\n";
    let view = one_match(source);
    assert_eq!(
        view.label.as_ref().expect("an empty label").text,
        "",
        "present but empty, which is not the same as absent"
    );
    let draft = MatchDraft::new().with(MatchField::Label, "a label");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::TargetOwnsNoBytes {
            target: DraftTarget::Field(MatchField::Label),
        })
    );
} // End of function a_field_that_owns_no_bytes_is_refused()

// ---------------------------------------------------------------------------
// The match itself
// ---------------------------------------------------------------------------

/// A match the hazard gate refuses is refused here, by the hazard's name.
#[test]
fn a_match_with_a_blocking_hazard_is_refused() {
    let source = "matches:\n  - trigger: hello\n    replace: &shared world\n";
    let view = one_match(source);
    let draft = MatchDraft::new().with(MatchField::Label, "a label");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::MatchNotEditable {
            hazard: Some(HazardKind::AnchorDefinition),
        })
    );
} // End of function a_match_with_a_blocking_hazard_is_refused()

/// A match that is not safely editable is refused even when the projection
/// named no hazard.
#[test]
fn a_match_that_is_not_safely_editable_is_refused() {
    let mut view = one_match(SIMPLE);
    view.safely_editable = false;
    let draft = MatchDraft::new().with(MatchField::Label, "another label");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::MatchNotEditable { hazard: None })
    );
} // End of function a_match_that_is_not_safely_editable_is_refused()

/// A match with no path addresses nothing.
#[test]
fn a_match_with_no_path_is_refused() {
    let mut view = one_match(SIMPLE);
    view.path = None;
    let draft = MatchDraft::new().with(MatchField::Label, "another label");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::MatchHasNoPath)
    );
}

/// A draft that changes nothing is still refused for a match that cannot be
/// edited: the preconditions are about the match, not about the batch.
#[test]
fn an_empty_draft_is_still_refused_for_a_match_that_cannot_be_edited() {
    let mut view = one_match(SIMPLE);
    view.safely_editable = false;
    assert_eq!(
        plan_match_edits(&view, &MatchDraft::new()),
        Err(DraftError::MatchNotEditable { hazard: None })
    );
}

// ---------------------------------------------------------------------------
// The six batch hazards
// ---------------------------------------------------------------------------

/// Hazard 1, through the planner: the anchor is the mapping's last visible
/// entry, and this draft takes it away.
#[test]
fn inserting_after_a_key_the_same_batch_removes_is_refused() {
    let view = one_match(SIMPLE);
    let draft = MatchDraft::new()
        .without(MatchField::Label)
        .with(MatchField::Word, "true");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::InsertionAnchorRemoved { edit: 1 })
    );
} // End of function inserting_after_a_key_the_same_batch_removes_is_refused()

/// Hazard 1, through the guard, on a batch the planner did not build.
#[test]
fn the_guard_refuses_an_insertion_anchored_on_a_key_the_batch_removes() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let edits = vec![
        DocumentEdit::RemoveField(FieldRemoval::new(mapping.clone().with_key("label"))),
        DocumentEdit::InsertField(FieldInsert::after(mapping.clone(), "label", "word", "true")),
    ];
    assert_eq!(
        check_batch_independence(&mapping, &keys(&["trigger", "replace", "label"]), &edits),
        Err(DraftError::InsertionAnchorRemoved { edit: 1 })
    );
} // End of function the_guard_refuses_an_insertion_anchored_on_a_key_the_batch_removes()

/// Hazard 2: an anchor the same batch inserts is not in the original index.
#[test]
fn anchoring_after_a_key_the_same_batch_inserts_is_refused() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let edits = vec![
        DocumentEdit::InsertField(FieldInsert::after(
            mapping.clone(),
            "replace",
            "word",
            "true",
        )),
        DocumentEdit::InsertField(FieldInsert::after(
            mapping.clone(),
            "word",
            "left_word",
            "true",
        )),
    ];
    assert_eq!(
        check_batch_independence(&mapping, &keys(&["trigger", "replace"]), &edits),
        Err(DraftError::InsertionAnchorIsInserted { edit: 1 })
    );
} // End of function anchoring_after_a_key_the_same_batch_inserts_is_refused()

/// An anchor the original mapping simply does not have.
#[test]
fn anchoring_after_a_key_the_mapping_does_not_have_is_refused() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let edits = vec![DocumentEdit::InsertField(FieldInsert::after(
        mapping.clone(),
        "comment",
        "word",
        "true",
    ))];
    assert_eq!(
        check_batch_independence(&mapping, &keys(&["trigger", "replace"]), &edits),
        Err(DraftError::InsertionAnchorNotInOriginal { edit: 0 })
    );
} // End of function anchoring_after_a_key_the_mapping_does_not_have_is_refused()

/// Hazard 3: a removal and an edit inside its value rewrite overlapping bytes.
#[test]
fn removing_a_field_while_editing_a_scalar_inside_its_value_is_refused() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let edits = vec![
        DocumentEdit::RemoveField(FieldRemoval::new(mapping.clone().with_key("vars"))),
        DocumentEdit::Scalar(ScalarEdit::new(
            mapping
                .clone()
                .with_key("vars")
                .with_index(0)
                .with_key("name"),
            "renamed",
        )),
    ];
    assert_eq!(
        check_batch_independence(&mapping, &keys(&["trigger", "vars"]), &edits),
        Err(DraftError::RemovalContainsAnEdit {
            removal: 0,
            edit: 1
        })
    );
} // End of function removing_a_field_while_editing_a_scalar_inside_its_value_is_refused()

/// Hazard 4, at intent level: two drafted elements naming one index.
///
/// The planner refuses this **before diffing**, so the refusal names the two
/// intents rather than two edits.
#[test]
fn two_intents_naming_one_sequence_index_are_refused_before_any_diffing() {
    let view = one_match(NONCANONICAL);
    let draft = MatchDraft::new()
        .with_item(SequenceField::Triggers, 0, ":first")
        .with_item(SequenceField::Triggers, 0, ":second");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::SequenceItemDraftedTwice {
            field: SequenceField::Triggers,
            index: 0,
            first: 0,
            second: 1,
        })
    );
} // End of function two_intents_naming_one_sequence_index_are_refused_before_any_diffing()

/// **The intent the batch guards could never see.**
///
/// The first intent sets element 0 to the value it already holds, which derives
/// **no edit** — correctly, because the desired state is the actual state. The
/// second sets it to something else. A batch-level audit therefore receives one
/// edit and cannot tell this draft apart from one that only ever said one thing,
/// so it would apply the second value and make draft order mean *last effective
/// value wins*. It does not: the duplicate index is refused at intent level,
/// with the erased no-op still visible.
#[test]
fn a_no_op_intent_followed_by_a_real_one_at_one_index_is_refused_not_silently_resolved() {
    let view = one_match(NONCANONICAL);
    let unchanged_value = view.trigger.triggers[0]
        .as_scalar()
        .expect("a scalar trigger")
        .text
        .clone();

    // The first intent must genuinely derive nothing, or this test is a
    // restatement of its twin above.
    let alone = MatchDraft::new().with_item(SequenceField::Triggers, 0, unchanged_value.clone());
    assert_eq!(
        plan_match_edits(&view, &alone),
        Ok(Vec::new()),
        "the first intent alone is a no-op, which is what makes it invisible later"
    );

    let draft = MatchDraft::new()
        .with_item(SequenceField::Triggers, 0, unchanged_value)
        .with_item(SequenceField::Triggers, 0, ":changed");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::SequenceItemDraftedTwice {
            field: SequenceField::Triggers,
            index: 0,
            first: 0,
            second: 1,
        }),
        "an erased no-op is still an intent, and two intents about one element are two answers"
    );
} // End of function a_no_op_intent_followed_by_a_real_one_at_one_index_is_refused_not_silently_resolved()

/// An `Unchanged` element is not an intent, so repeating one asks for nothing
/// twice and is not a duplicate.
#[test]
fn an_unchanged_element_repeated_at_one_index_is_not_a_duplicate_intent() {
    let view = one_match(NONCANONICAL);
    let mut draft = MatchDraft::new();
    for _ in 0..2 {
        draft.triggers.push(ItemDraft {
            index: 0,
            value: DraftField::Unchanged,
        });
    }
    assert_eq!(plan_match_edits(&view, &draft), Ok(Vec::new()));
} // End of function an_unchanged_element_repeated_at_one_index_is_not_a_duplicate_intent()

/// The same class, closed the other way: a [`MatchField`] cannot be drafted
/// twice at all.
///
/// [`MatchDraft`] has one struct field per key, so two intents about one field
/// cannot be constructed in Rust — and on the wire `serde` refuses a JSON object
/// that writes one of them more than once, rather than keeping the last. That is
/// the same failure this sub-phase's pre-scan exists to prevent, closed by the
/// type instead of by a check.
#[test]
fn a_field_written_twice_in_the_json_is_a_deserialization_error_and_never_last_wins() {
    let read = serde_json::from_str::<MatchDraft>(
        r#"{"label": {"Set": "first"}, "label": {"Set": "second"}}"#,
    );
    assert!(
        read.is_err(),
        "a repeated field must fail closed, never collapse into the last value"
    );
} // End of function a_field_written_twice_in_the_json_is_a_deserialization_error_and_never_last_wins()

/// Hazard 4, through the guard, on a batch the planner cannot build.
///
/// `ScalarEditedTwice` is now a statement about a **batch** only: the planner
/// refuses two intents about one element earlier and by name. The guard still
/// has to hold, because a later phase may hand it a batch it did not derive.
#[test]
fn the_guard_refuses_two_scalar_edits_naming_one_node() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let edits = vec![
        DocumentEdit::Scalar(ScalarEdit::new(mapping.clone().with_key("label"), "first")),
        DocumentEdit::Scalar(ScalarEdit::new(mapping.clone().with_key("label"), "second")),
    ];
    assert_eq!(
        check_batch_independence(&mapping, &keys(&["trigger", "label"]), &edits),
        Err(DraftError::ScalarEditedTwice {
            first: 0,
            second: 1
        })
    );
} // End of function the_guard_refuses_two_scalar_edits_naming_one_node()

/// Hazard 5, through the planner: a mapping that writes one key twice.
#[test]
fn a_repeated_key_is_refused_as_an_ambiguous_key() {
    let source = "matches:\n  - trigger: hello\n    replace: one\n    replace: two\n";
    let view = one_match(source);
    let draft = MatchDraft::new().with(MatchField::Replace, "three");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::AmbiguousKey {
            field: Some(MatchField::Replace),
        })
    );
} // End of function a_repeated_key_is_refused_as_an_ambiguous_key()

/// Hazard 5, through the guard: an anchor whose key the mapping writes twice.
#[test]
fn an_anchor_whose_key_is_ambiguous_is_refused() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let edits = vec![DocumentEdit::InsertField(FieldInsert::after(
        mapping.clone(),
        "replace",
        "word",
        "true",
    ))];
    assert_eq!(
        check_batch_independence(&mapping, &keys(&["trigger", "replace", "replace"]), &edits),
        Err(DraftError::AmbiguousKey {
            field: Some(MatchField::Replace),
        })
    );
} // End of function an_anchor_whose_key_is_ambiguous_is_refused()

/// Hazard 6, through the planner: two absent fields would be written after one
/// entry, and nothing says which goes first.
#[test]
fn two_insertions_sharing_one_anchor_are_refused() {
    let view = one_match(SIMPLE);
    let draft = MatchDraft::new()
        .with(MatchField::Word, "true")
        .with(MatchField::Comment, "a comment");
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::SharedInsertionAnchor {
            first: 0,
            second: 1
        })
    );
} // End of function two_insertions_sharing_one_anchor_are_refused()

/// And the engine underneath refuses the same batch, which is why the draft
/// refuses it rather than choosing an order.
#[test]
fn the_patch_engine_also_refuses_two_insertions_at_one_point() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let edits = vec![
        DocumentEdit::InsertField(FieldInsert::after(mapping.clone(), "label", "word", "true")),
        DocumentEdit::InsertField(FieldInsert::after(
            mapping.clone(),
            "label",
            "comment",
            "a comment",
        )),
    ];
    assert!(
        apply_edits(SIMPLE, &edits).is_err(),
        "two zero-width replacements at one offset have no defined order"
    );
} // End of function the_patch_engine_also_refuses_two_insertions_at_one_point()

// ---------------------------------------------------------------------------
// The closed-surface guard
// ---------------------------------------------------------------------------

/// The invariant, named: no cardinality change, no synthesized collection.
#[test]
fn a_drafted_batch_never_changes_sequence_cardinality_and_never_synthesizes_a_collection() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);

    // A new sequence item, expressed as an insertion into the sequence itself.
    let into_a_sequence = vec![DocumentEdit::InsertField(FieldInsert::new(
        mapping.clone().with_key("triggers"),
        "0",
        ":new",
    ))];
    assert_eq!(
        check_closed_surface(&mapping, &into_a_sequence),
        Err(DraftError::OutsideTheClosedSurface { edit: 0 })
    );

    // A new mapping entry under a key no schema fixes.
    let into_a_mapping = vec![DocumentEdit::InsertField(FieldInsert::new(
        mapping.clone().with_key("form_fields"),
        "name",
        "value",
    ))];
    assert_eq!(
        check_closed_surface(&mapping, &into_a_mapping),
        Err(DraftError::OutsideTheClosedSurface { edit: 0 })
    );

    // An insertion under a key of the match's own mapping that is not a
    // schema-known scalar field: `triggers` names a sequence.
    let a_collection_key = vec![DocumentEdit::InsertField(FieldInsert::new(
        mapping.clone(),
        "triggers",
        "value",
    ))];
    assert_eq!(
        check_closed_surface(&mapping, &a_collection_key),
        Err(DraftError::OutsideTheClosedSurface { edit: 0 })
    );
} // End of function a_drafted_batch_never_changes_sequence_cardinality_and_never_synthesizes_a_collection()

/// `vars` and `form_fields` are 2b-2b-2's problem, and the guard says so.
#[test]
fn the_closed_surface_guard_refuses_an_edit_that_touches_vars_or_form_fields() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    for path in [
        mapping
            .clone()
            .with_key("vars")
            .with_index(0)
            .with_key("name"),
        mapping.clone().with_key("form_fields").with_key("choice"),
    ] {
        let edits = vec![DocumentEdit::Scalar(ScalarEdit::new(path, "x"))];
        assert_eq!(
            check_closed_surface(&mapping, &edits),
            Err(DraftError::OutsideTheClosedSurface { edit: 0 })
        );
    } // End of the loop over the two open-schema regions
    let removal = vec![DocumentEdit::RemoveField(FieldRemoval::new(
        mapping.clone().with_key("vars"),
    ))];
    assert_eq!(
        check_closed_surface(&mapping, &removal),
        Err(DraftError::OutsideTheClosedSurface { edit: 0 })
    );
} // End of function the_closed_surface_guard_refuses_an_edit_that_touches_vars_or_form_fields()

/// A batch reaching into another match is outside this match's surface.
#[test]
fn the_closed_surface_guard_refuses_an_edit_in_another_match() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let elsewhere = DocumentPath::root(0)
        .with_key("matches")
        .with_index(1)
        .with_key("label");
    let edits = vec![DocumentEdit::Scalar(ScalarEdit::new(elsewhere, "x"))];
    assert_eq!(
        check_closed_surface(&mapping, &edits),
        Err(DraftError::OutsideTheClosedSurface { edit: 0 })
    );
} // End of function the_closed_surface_guard_refuses_an_edit_in_another_match()

/// A drafted batch never moves anything (`PROGRESS.md` R25).
#[test]
fn a_move_is_never_part_of_a_drafted_batch() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let edits = vec![DocumentEdit::MoveItem(ItemMove::to_front(mapping.clone()))];
    assert_eq!(
        check_closed_surface(&mapping, &edits),
        Err(DraftError::MoveIsNotADraftEdit { edit: 0 })
    );
}

/// Every key of the surface passes the guard, so it refuses by shape rather
/// than by refusing everything.
#[test]
fn the_closed_surface_guard_admits_every_field_of_the_surface() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let mut edits: Vec<DocumentEdit> = Vec::new();
    for field in MatchField::ALL {
        edits.push(DocumentEdit::Scalar(ScalarEdit::new(
            mapping.clone().with_key(field.key()),
            "x",
        )));
    }
    for sequence in SequenceField::ALL {
        edits.push(DocumentEdit::Scalar(ScalarEdit::new(
            mapping.clone().with_key(sequence.key()).with_index(0),
            "x",
        )));
    }
    assert_eq!(check_closed_surface(&mapping, &edits), Ok(()));
} // End of function the_closed_surface_guard_admits_every_field_of_the_surface()

// ---------------------------------------------------------------------------
// The wire shape
// ---------------------------------------------------------------------------

/// An omitted field means "unchanged", which is the one collapse that is safe.
#[test]
fn an_omitted_draft_field_deserializes_as_unchanged() {
    let draft: MatchDraft =
        serde_json::from_str(r#"{"label": {"Set": "a label"}}"#).expect("a partial draft reads");
    assert_eq!(draft.label, DraftField::Set("a label".to_owned()));
    for field in MatchField::ALL {
        if field == MatchField::Label {
            continue;
        }
        assert!(draft.field(field).is_unchanged(), "{field:?}");
    }
    assert!(draft.triggers.is_empty());
} // End of function an_omitted_draft_field_deserializes_as_unchanged()

/// The catastrophic failure the tri-state exists to avoid: `null` must **not**
/// read as a removal.
#[test]
fn a_null_draft_field_is_a_deserialization_error_and_never_a_removal() {
    let read = serde_json::from_str::<MatchDraft>(r#"{"label": null}"#);
    assert!(
        read.is_err(),
        "a null must fail closed, never collapse into Remove"
    );
}

/// A key this type does not have is a request nobody can honour.
#[test]
fn a_misspelled_draft_field_is_a_deserialization_error() {
    let read = serde_json::from_str::<MatchDraft>(r#"{"lable": {"Set": "x"}}"#);
    assert!(read.is_err(), "an unknown field must not read as silence");
}

/// The wire shape is externally tagged with the Rust variant names verbatim.
#[test]
fn the_draft_wire_shape_is_externally_tagged_with_rust_variant_names() {
    let draft = MatchDraft::new()
        .with(MatchField::Label, "a label")
        .without(MatchField::Comment);
    let json = serde_json::to_value(&draft).expect("a draft serializes");
    assert_eq!(json["label"], serde_json::json!({ "Set": "a label" }));
    assert_eq!(json["comment"], serde_json::json!("Remove"));
    assert_eq!(json["trigger"], serde_json::json!("Unchanged"));
    assert_eq!(json["image_path"], serde_json::json!("Unchanged"));

    let round_tripped: MatchDraft = serde_json::from_value(json).expect("and reads back");
    assert_eq!(round_tripped, draft);
} // End of function the_draft_wire_shape_is_externally_tagged_with_rust_variant_names()

/// A refusal serializes the same way, so the sub-phase that puts it on the wire
/// inherits a shape rather than inventing one.
#[test]
fn a_refusal_serializes_externally_tagged_with_snake_case_fields() {
    let json = serde_json::to_value(DraftError::SequenceItemDoesNotExist {
        field: SequenceField::Triggers,
        index: 2,
        length: 2,
    })
    .expect("a refusal serializes");
    assert_eq!(
        json,
        serde_json::json!({
            "SequenceItemDoesNotExist": { "field": "triggers", "index": 2, "length": 2 }
        })
    );
} // End of function a_refusal_serializes_externally_tagged_with_snake_case_fields()

/// **Every field identifier spells its espanso key on the wire.**
///
/// `MatchField` and `SequenceField` owe no dictionary entry, and the reason
/// recorded in `src-tauri/src/dictionary_contract.rs` is that a screen puts the
/// espanso key itself beside a field. That reason is only true while the wire
/// agrees: before this test, `UppercaseStyle` serialized as `"UppercaseStyle"`,
/// and a translated refusal interpolating it would have shown a Rust identifier
/// in both languages.
///
/// The expectation is [`MatchField::key`] — the projection's own spelling, the
/// one a path segment and an insertion's key already use — so the two cannot
/// drift apart without this failing.
#[test]
fn every_match_field_serializes_as_its_espanso_key() {
    for field in MatchField::ALL {
        let json = serde_json::to_value(field).expect("a field identifier serializes");
        assert_eq!(
            json,
            serde_json::Value::String(field.key().to_owned()),
            "{field:?} must serialize as the key the projection reads"
        );
        let read: MatchField = serde_json::from_value(json).expect("and reads back");
        assert_eq!(read, field);
        assert_eq!(MatchField::from_key(field.key()), Some(field));
    } // End of the loop over every schema-known scalar field
} // End of function every_match_field_serializes_as_its_espanso_key()

/// The same, for the two string sequences.
#[test]
fn every_sequence_field_serializes_as_its_espanso_key() {
    for sequence in SequenceField::ALL {
        let json = serde_json::to_value(sequence).expect("a sequence identifier serializes");
        assert_eq!(
            json,
            serde_json::Value::String(sequence.key().to_owned()),
            "{sequence:?} must serialize as the key the projection reads"
        );
        let read: SequenceField = serde_json::from_value(json).expect("and reads back");
        assert_eq!(read, sequence);
        assert_eq!(SequenceField::from_key(sequence.key()), Some(sequence));
    } // End of the loop over both string sequences
} // End of function every_sequence_field_serializes_as_its_espanso_key()

/// A refusal's address spells its two operands literally, which is the whole of
/// `DraftTarget`'s exclusion from the dictionary.
#[test]
fn a_draft_target_spells_an_espanso_key_and_an_index() {
    assert_eq!(
        serde_json::to_value(DraftTarget::Field(MatchField::UppercaseStyle))
            .expect("an address serializes"),
        serde_json::json!({ "Field": "uppercase_style" })
    );
    assert_eq!(
        serde_json::to_value(DraftTarget::Item {
            field: SequenceField::SearchTerms,
            index: 3,
        })
        .expect("an address serializes"),
        serde_json::json!({ "Item": { "field": "search_terms", "index": 3 } })
    );
} // End of function a_draft_target_spells_an_espanso_key_and_an_index()

/// Owned key strings, for the guard tests.
fn keys(names: &[&str]) -> Vec<String> {
    names.iter().map(|name| (*name).to_owned()).collect()
}

// ---------------------------------------------------------------------------
// The headline property over a whole corpus — counts only
// ---------------------------------------------------------------------------

/// The environment variable that turns the real-corpus skip into a failure.
///
/// The skip has to stay: a fresh clone and CI both have to pass without the
/// gitignored corpus. What must not stay is a skip that is indistinguishable
/// from a pass. Spelled and consulted exactly as
/// `saving_the_real_configuration_is_refused_by_neither_gate` in
/// `tests/persist_save.rs` does.
const REQUIRE_REAL_CORPUS: &str = "ESPANSOCONFIG_REQUIRE_REAL_CORPUS";

/// The refusals an *identity* draft may legitimately meet.
///
/// A draft built out of the projection's own values asks for no insertion, no
/// removal, no new element and no element the projection elided, so every
/// refusal about those is unreachable by construction. What is left is the four
/// answers to *may I edit this match at all*, plus the one about a scalar whose
/// projected text is a raw source slice. Anything else is a surprise and fails.
const EXPECTED_REFUSALS: &[&str] = &[
    "MatchHasNoPath",
    "MatchNotEditable",
    "AmbiguousKey",
    "NotDecodable",
];

/// A draft setting every field the match holds to its own projected logical
/// value, and how many intents it carries.
///
/// The corpus twin of [`every_projected_value`], and it differs in one way: an
/// element the projection elided has **no** logical value to draft against, so
/// it is left [`DraftField::Unchanged`] rather than guessed at. The count comes
/// back because a sweep that drafted nothing would agree with an engine that
/// derived nothing.
fn every_projected_scalar_value(view: &MatchView) -> (MatchDraft, usize) {
    let mut draft = MatchDraft::new();
    let mut intents = 0usize;
    for field in MatchField::ALL {
        if let Some(text) = projected_text(view, field) {
            *draft.field_mut(field) = DraftField::Set(text);
            intents += 1;
        }
    } // End of the loop over the schema-known scalar fields
    for (sequence, items) in [
        (SequenceField::Triggers, &view.trigger.triggers),
        (SequenceField::SearchTerms, &view.search_terms),
    ] {
        for (index, item) in items.iter().enumerate() {
            let Some(scalar) = item.as_scalar() else {
                continue;
            };
            let drafted = ItemDraft {
                index,
                value: DraftField::Set(scalar.text.clone()),
            };
            match sequence {
                SequenceField::Triggers => draft.triggers.push(drafted),
                SequenceField::SearchTerms => draft.search_terms.push(drafted),
            }
            intents += 1;
        } // End of the loop over this sequence's projected elements
    } // End of the loop over both string sequences
    (draft, intents)
} // End of function every_projected_scalar_value()

/// The name of a refusal, with no operand of it.
///
/// [`DraftError`] is externally tagged, so the tag *is* the variant name. No
/// variant carries a byte of the document (`CLAUDE.md` section 1), and this
/// takes the tag alone even so.
fn refusal_name(error: &DraftError) -> String {
    match serde_json::to_value(error).expect("a refusal serializes") {
        serde_json::Value::String(name) => name,
        serde_json::Value::Object(map) => map
            .keys()
            .next()
            .cloned()
            .expect("an externally tagged refusal has one tag"),
        other => panic!("a refusal serialized as {other:?}, which is not a tagged enum"),
    }
} // End of function refusal_name()

/// One corpus sweep: every match drafted to its own projected values, and the
/// counts it produced.
///
/// Returns `(matches, planned, intents, refusals)` — `refusals` being variant
/// names with their counts, which is a code and a number and nothing else.
fn sweep(files: &[common::CorpusFile]) -> (usize, usize, usize, BTreeMap<String, usize>) {
    let mut matches = 0usize;
    let mut planned = 0usize;
    let mut intents = 0usize;
    let mut refusals: BTreeMap<String, usize> = BTreeMap::new();
    for (index, file) in files.iter().enumerate() {
        let context = DocumentContext::detached(DocumentId(index as u64), &file.name);
        for view in &project_source(&context, &file.source).view.matches {
            matches += 1;
            let (draft, drafted) = every_projected_scalar_value(view);
            match plan_match_edits(view, &draft) {
                Ok(edits) => {
                    planned += 1;
                    intents += drafted;
                    assert!(
                        edits.is_empty(),
                        "{}: a draft holding the values the file already holds derived {} edits",
                        file.name,
                        edits.len()
                    );
                }
                Err(error) => {
                    let name = refusal_name(&error);
                    assert!(
                        EXPECTED_REFUSALS.contains(&name.as_str()),
                        "{}: an identity draft was refused with {name}, which this sweep did \
                         not expect",
                        file.name
                    );
                    *refusals.entry(name).or_default() += 1;
                }
            } // End of the match over what the planner answered
        } // End of the loop over this file's matches
    } // End of the loop over the corpus
    (matches, planned, intents, refusals)
} // End of function sweep()

/// The headline property, over **every match of the committed corpus**.
///
/// The inline fixtures above state the property on shapes chosen to make it
/// sharp; this states it on every match of every synthetic file, including the
/// fifteen byte-exact ones. It always runs, which is what makes the real-corpus
/// twin below an addition rather than the only coverage.
///
/// Prints counts only.
#[test]
fn every_match_of_the_synthetic_corpus_drafts_to_an_empty_batch_or_a_named_refusal() {
    let files = common::synthetic_valid();
    assert!(!files.is_empty(), "the synthetic corpus is committed");
    let (matches, planned, intents, refusals) = sweep(&files);
    println!(
        "synthetic corpus: {} files, {matches} matches, {planned} planned to an empty batch, \
         {intents} intents drafted",
        files.len()
    );
    println!("  refusals: {refusals:?}");
    assert!(
        planned > 0 && intents > 0,
        "the sweep must have drafted something: {planned} planned, {intents} intents"
    );
} // End of function every_match_of_the_synthetic_corpus_drafts_to_an_empty_batch_or_a_named_refusal()

/// **The headline property, over the owner's real configuration.**
///
/// `PROGRESS.md`'s standard is that a property runs over *both* corpora, and
/// until now this one ran only over inline fixtures this phase wrote itself — a
/// property checked against the shapes its author thought of. Every match of
/// every real file is drafted with each in-scope field set to its own projected
/// logical value, and the derived batch must be **empty**: a single edit here
/// would be this application preparing to rewrite quoting its owner chose.
///
/// **It is a no-op without the corpus.** Set [`REQUIRE_REAL_CORPUS`] to turn
/// that silence into a failure.
///
/// Prints **counts and file names only** (`CLAUDE.md` section 1). No value, no
/// key text and no document byte reaches the output or an assertion message.
#[test]
fn every_match_of_the_real_configuration_drafts_to_an_empty_batch_or_a_named_refusal() {
    let files = common::real_corpus();
    let corpus_is_absent = files.is_empty();
    let switch_is_set = std::env::var_os(REQUIRE_REAL_CORPUS).is_some();
    assert!(
        !(corpus_is_absent && switch_is_set),
        "{REQUIRE_REAL_CORPUS} is set and the real corpus is absent: \
         run ./scripts/sync-real-corpus.sh to populate it locally"
    );
    if common::skip_without_real_corpus(
        "every_match_of_the_real_configuration_drafts_to_an_empty_batch_or_a_named_refusal",
        &files,
    ) {
        return;
    }

    let (matches, planned, intents, refusals) = sweep(&files);
    println!(
        "real corpus: {} files, {matches} matches, {planned} planned to an empty batch, \
         {intents} intents drafted",
        files.len()
    );
    println!("  refusals: {refusals:?}");
    assert!(
        planned > 0 && intents > 0,
        "the sweep must have drafted something: {planned} planned, {intents} intents"
    );
} // End of function every_match_of_the_real_configuration_drafts_to_an_empty_batch_or_a_named_refusal()
