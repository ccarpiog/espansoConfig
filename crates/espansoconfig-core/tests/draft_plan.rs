//! Phase 2b-2b-1 and 2b-2b-2 acceptance: a draft of one match, and the batch it
//! derives.
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
//! # The open half
//!
//! Phase 2b-2b-2's section states the same property over `vars` and
//! `form_fields`, and adds the refusals that come with an open key. Four of
//! those refusals are **unreachable from any document that reaches the
//! planner** — the hazard gate refuses the match first, or the projection never
//! produces the state — and each says so in its own doc comment rather than
//! implying coverage it does not have.
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
    DraftTarget, EntryDraft, FormFieldDraft, ItemDraft, MatchDraft, MatchField, NestedKeys,
    SequenceField, VariableDraft, VariableField,
};
use espansoconfig_core::model::{
    DocumentContext, FieldView, MatchView, ScalarView, ValueKind, ValueView,
};
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
        check_batch_independence(
            &mapping,
            &keys(&["trigger", "replace", "label"]),
            &[],
            &edits
        ),
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
        check_batch_independence(&mapping, &keys(&["trigger", "replace"]), &[], &edits),
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
        check_batch_independence(&mapping, &keys(&["trigger", "replace"]), &[], &edits),
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
        check_batch_independence(&mapping, &keys(&["trigger", "vars"]), &[], &edits),
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
        check_batch_independence(&mapping, &keys(&["trigger", "label"]), &[], &edits),
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
        check_batch_independence(
            &mapping,
            &keys(&["trigger", "replace", "replace"]),
            &[],
            &edits
        ),
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

/// `vars` and `form_fields` are inside the surface since Phase 2b-2b-2, and
/// their **containers** are not.
///
/// The three refusals below are the boundary of the widening: a whole `vars`
/// sequence, a whole `form_fields` mapping and a whole `form_fields` entry are
/// collection nodes, and nothing here replaces one or deletes one.
#[test]
fn the_closed_surface_guard_refuses_an_edit_that_names_a_whole_open_container() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    for path in [
        // The `form_fields` entry itself, whose value is the option mapping.
        mapping.clone().with_key("form_fields").with_key("choice"),
        // A whole variable of `vars`.
        mapping.clone().with_key("vars").with_index(0),
        // A variable's whole `params` mapping.
        mapping
            .clone()
            .with_key("vars")
            .with_index(0)
            .with_key("params"),
    ] {
        let edits = vec![DocumentEdit::Scalar(ScalarEdit::new(path.clone(), "x"))];
        assert_eq!(
            check_closed_surface(&mapping, &edits),
            Err(DraftError::OutsideTheClosedSurface { edit: 0 }),
            "a scalar edit naming a container must be refused"
        );
        let removal = vec![DocumentEdit::RemoveField(FieldRemoval::new(path))];
        assert_eq!(
            check_closed_surface(&mapping, &removal),
            Err(DraftError::OutsideTheClosedSurface { edit: 0 }),
            "and so must a removal of one"
        );
    } // End of the loop over the open containers
    let removal = vec![DocumentEdit::RemoveField(FieldRemoval::new(
        mapping.clone().with_key("vars"),
    ))];
    assert_eq!(
        check_closed_surface(&mapping, &removal),
        Err(DraftError::OutsideTheClosedSurface { edit: 0 })
    );
} // End of function the_closed_surface_guard_refuses_an_edit_that_names_a_whole_open_container()

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
// Phase 2b-2b-2 — `vars` and `form_fields`, the open key surface
// ---------------------------------------------------------------------------

/// The counts an identity draft of the open half carried.
///
/// A sweep that drafted nothing would agree with an engine that derived
/// nothing, so every number the property rests on is returned and asserted
/// (`PROGRESS.md` R24).
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
struct OpenCounts {
    /// Variables of `vars` addressed.
    variables: usize,
    /// Entries of all their `params` mappings.
    params: usize,
    /// Entries of `form_fields` addressed.
    form_fields: usize,
    /// Options of all those entries.
    options: usize,
    /// Intents drafted over the open half.
    intents: usize,
}

impl OpenCounts {
    /// Folds another match's counts into these.
    fn absorb(&mut self, other: OpenCounts) {
        self.variables += other.variables;
        self.params += other.params;
        self.form_fields += other.form_fields;
        self.options += other.options;
        self.intents += other.intents;
    } // End of function absorb()
}

/// Every entry of one open mapping, drafted to the value the file already
/// holds.
///
/// An entry whose value is neither a scalar nor a sequence is **addressed and
/// left alone**: the draft still names it, so its key is still resolved, but no
/// intent is carried — this surface has no spelling for a nested mapping.
fn open_entries(fields: &[FieldView], counts: &mut OpenCounts) -> Vec<EntryDraft> {
    let mut drafts = Vec::new();
    for (index, field) in fields.iter().enumerate() {
        let mut entry = EntryDraft::new(index);
        match &field.value {
            ValueView::Scalar(scalar) => {
                entry.value = DraftField::Set(scalar.text.clone());
                counts.intents += 1;
            }
            ValueView::Sequence(items) => {
                for (position, item) in items.iter().enumerate() {
                    let Some(scalar) = item.as_scalar() else {
                        continue;
                    };
                    entry.items.push(ItemDraft {
                        index: position,
                        value: DraftField::Set(scalar.text.clone()),
                    });
                    counts.intents += 1;
                } // End of the loop over this entry's projected elements
            }
            ValueView::Mapping(_) | ValueView::Alias(_) | ValueView::Elided { .. } => {}
        } // End of the match over the entry's projected value
        drafts.push(entry);
    } // End of the loop over the mapping's entries
    drafts
} // End of function open_entries()

/// Drafts every in-scope `vars` and `form_fields` value to the value the file
/// already holds, appending to `draft`.
///
/// Built from the view rather than written out, so a test states the property —
/// *the value that is already there* — instead of a transcription of it.
fn draft_the_open_half(view: &MatchView, draft: &mut MatchDraft) -> OpenCounts {
    let mut counts = OpenCounts::default();
    for (index, variable) in view.vars.iter().enumerate() {
        let mut drafted = VariableDraft::new(index);
        for field in VariableField::ALL {
            let existing = match field {
                VariableField::Name => variable.name.as_ref(),
                VariableField::Type => variable.declared_type.as_ref(),
                VariableField::InjectVars => variable.inject_vars.as_ref(),
            };
            if let Some(scalar) = existing {
                *drafted.field_mut(field) = DraftField::Set(scalar.text.clone());
                counts.intents += 1;
            }
        } // End of the loop over the variable's schema-known scalars
        drafted.params = open_entries(&variable.params, &mut counts);
        counts.params += variable.params.len();
        counts.variables += 1;
        draft.vars.push(drafted);
    } // End of the loop over the projected variables
    for (index, field) in view.form_fields.iter().enumerate() {
        let options = field.value.as_mapping().unwrap_or_default();
        let mut drafted = FormFieldDraft::new(index);
        drafted.options = open_entries(options, &mut counts);
        counts.options += options.len();
        counts.form_fields += 1;
        draft.form_fields.push(drafted);
    } // End of the loop over the projected form fields
    counts
} // End of function draft_the_open_half()

/// One match whose **open** half is fully populated, in four scalar styles.
///
/// Two variables — one with all three schema-known scalars and two scalar
/// `params`, one whose only parameter is a sequence of scalars — and two
/// `form_fields` entries, one holding a scalar option, a sequence option and a
/// quoted default, the other a single plain option.
const OPEN_KEYS: &str = r#"matches:
  - trigger: :report
    form: |
      Team: [[team]]
      Note: [[note]]
    form_fields:
      team:
        type: choice
        default: 'core team'
        values:
          - core
          - "platform\ttab"
      note:
        multiline: true
    vars:
      - name: stamp
        type: date
        inject_vars: 'false'
        params:
          format: '%Y-%m-%d'
          offset: 0
      - name: pick
        type: choice
        params:
          values:
            - alpha
            - "beta\ttab"
"#;

/// A `form_fields` entry whose value is a scalar rather than an option mapping,
/// beside one that is a mapping.
const FORM_FIELD_WITHOUT_OPTIONS: &str = r#"matches:
  - trigger: :a
    form: 'x [[p]]'
    form_fields:
      p:
        multiline: true
      q: not a mapping
"#;

/// A variable holding a `params` entry whose value is a mapping — the shape a
/// `type: form` variable's `fields` takes — beside a scalar one.
const NESTED_PARAM_MAPPING: &str = r#"matches:
  - trigger: :a
    replace: b
    vars:
      - name: v
        type: form
        params:
          layout: 'L'
          fields:
            one:
              multiline: true
"#;

/// A variable with no `name` and no `inject_vars`.
const VARIABLE_MISSING_FIELDS: &str = r#"matches:
  - trigger: :a
    replace: b
    vars:
      - type: date
        params:
          format: '%Y'
"#;

/// The path of one variable of the fixture's first match.
fn variable_path(view: &MatchView, index: usize) -> DocumentPath {
    view.vars[index].path.clone().expect("a projected variable")
}

/// **The headline property, over the open half.**
///
/// Every variable's schema-known scalars, every `params` entry, every element of
/// a `params` sequence, every `form_fields` option and every element of one are
/// drafted with the value the file already holds. The derived batch must be
/// **empty**, and the empty batch must leave the document byte-identical.
#[test]
fn every_open_key_set_to_its_own_projected_value_derives_an_empty_batch_and_moves_no_byte() {
    let view = one_match(OPEN_KEYS);

    // The fixture must actually hold an open half, or the property is vacuous.
    assert_eq!(view.vars.len(), 2, "two variables");
    assert_eq!(view.form_fields.len(), 2, "two form fields");
    let styles: Vec<ScalarStyle> = view.vars[0]
        .params
        .iter()
        .filter_map(|entry| entry.value.as_scalar().map(|scalar| scalar.style))
        .collect();
    assert!(
        styles.contains(&ScalarStyle::Plain) && styles.contains(&ScalarStyle::SingleQuoted),
        "the parameters must be written in more than one style"
    );

    let mut draft = MatchDraft::new();
    let counts = draft_the_open_half(&view, &mut draft);
    assert_eq!(
        counts,
        OpenCounts {
            variables: 2,
            params: 3,
            form_fields: 2,
            options: 4,
            intents: 14,
        },
        "the draft must actually carry the open half"
    );

    let edits = plan_match_edits(&view, &draft).expect("an identical open draft plans");
    assert!(
        edits.is_empty(),
        "a draft holding the values the file already holds derives no edit, got {}",
        edits.len()
    );

    let patched = apply_edits(OPEN_KEYS, &edits).expect("an empty batch applies");
    assert_eq!(patched.text(), OPEN_KEYS, "byte-identical");
    assert!(patched.notes().is_empty());
} // End of function every_open_key_set_to_its_own_projected_value_derives_an_empty_batch_and_moves_no_byte()

/// One genuinely different value at every depth of the open half, and one edit
/// each, at the right path.
#[test]
fn one_changed_value_at_each_open_depth_derives_exactly_one_scalar_edit() {
    let view = one_match(OPEN_KEYS);
    let mapping = match_path(&view);
    let cases: [(MatchDraft, DocumentPath, &str); 4] = [
        (
            MatchDraft::new()
                .with_variable(VariableDraft::new(0).with(VariableField::Name, "when")),
            variable_path(&view, 0).with_key("name"),
            "when",
        ),
        (
            MatchDraft::new()
                .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(1).set("30"))),
            variable_path(&view, 0)
                .with_key("params")
                .with_key("offset"),
            "30",
        ),
        (
            MatchDraft::new().with_variable(
                VariableDraft::new(1).with_param(EntryDraft::new(0).with_item(0, "gamma")),
            ),
            variable_path(&view, 1)
                .with_key("params")
                .with_key("values")
                .with_index(0),
            "gamma",
        ),
        (
            MatchDraft::new()
                .with_form_field(FormFieldDraft::new(0).with_option(EntryDraft::new(1).set("all"))),
            mapping
                .clone()
                .with_key("form_fields")
                .with_key("team")
                .with_key("default"),
            "all",
        ),
    ];
    for (draft, path, value) in cases {
        let edits = plan_match_edits(&view, &draft).expect("the draft plans");
        assert_eq!(edits.len(), 1, "exactly one value differs");
        let DocumentEdit::Scalar(edit) = &edits[0] else {
            panic!("a value that exists is rewritten, never inserted");
        };
        assert_eq!(edit.path(), &path);
        assert_eq!(edit.value(), value);
    } // End of the loop over the four depths
} // End of function one_changed_value_at_each_open_depth_derives_exactly_one_scalar_edit()

/// The batch lands, and nothing else in the document does.
#[test]
fn a_planned_open_batch_lands_its_values_and_leaves_every_other_byte_alone() {
    let view = one_match(OPEN_KEYS);
    let draft = MatchDraft::new()
        .with_variable(
            VariableDraft::new(0)
                .with(VariableField::InjectVars, "true")
                .with_param(EntryDraft::new(0).set("%d/%m/%Y")),
        )
        .with_form_field(
            FormFieldDraft::new(0).with_option(EntryDraft::new(2).with_item(1, "platform")),
        );
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    assert_eq!(edits.len(), 3);

    let patched = apply_edits(OPEN_KEYS, &edits).expect("the batch applies");
    assert_eq!(patched.replacements().len(), 3, "three spans, and no more");

    let after = one_match(patched.text());
    assert_eq!(
        after.vars[0]
            .inject_vars
            .as_ref()
            .expect("inject_vars")
            .text,
        "true"
    );
    assert_eq!(
        after.vars[0].params[0]
            .value
            .as_scalar()
            .expect("a scalar")
            .text,
        "%d/%m/%Y"
    );
    // Everything the draft did not name still decodes to exactly what it did.
    let mut untouched = MatchDraft::new();
    let counts = draft_the_open_half(&after, &mut untouched);
    assert_eq!(counts.intents, 14, "the same open half is still there");
    assert_eq!(
        after.vars[1].params[0].value.as_sequence().expect("values")[1]
            .as_scalar()
            .expect("a scalar")
            .text,
        "beta\ttab",
        "an untouched escaped scalar still decodes to itself"
    );
} // End of function a_planned_open_batch_lands_its_values_and_leaves_every_other_byte_alone()

/// A `Remove` of a scalar entry of an open mapping derives exactly one removal,
/// at the nested path.
#[test]
fn removing_a_scalar_entry_of_an_open_mapping_derives_one_removal() {
    let view = one_match(OPEN_KEYS);
    let draft = MatchDraft::new()
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(1).removed()))
        .with_form_field(FormFieldDraft::new(0).with_option(EntryDraft::new(1).removed()));
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    assert_eq!(edits.len(), 2);
    let paths: Vec<&DocumentPath> = edits
        .iter()
        .map(|edit| match edit {
            DocumentEdit::RemoveField(removal) => removal.field(),
            other => panic!("a removal was expected, got {other:?}"),
        })
        .collect();
    assert!(paths.contains(
        &&variable_path(&view, 0)
            .with_key("params")
            .with_key("offset")
    ));
    assert!(paths.contains(
        &&match_path(&view)
            .with_key("form_fields")
            .with_key("team")
            .with_key("default")
    ));
} // End of function removing_a_scalar_entry_of_an_open_mapping_derives_one_removal()

/// A `Remove` of one of a variable's three schema-known scalars derives one
/// removal.
#[test]
fn removing_a_variables_schema_known_scalar_derives_one_removal() {
    let view = one_match(OPEN_KEYS);
    let draft =
        MatchDraft::new().with_variable(VariableDraft::new(0).without(VariableField::InjectVars));
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    assert_eq!(edits.len(), 1);
    let DocumentEdit::RemoveField(removal) = &edits[0] else {
        panic!("a removal was expected");
    };
    assert_eq!(
        removal.field(),
        &variable_path(&view, 0).with_key("inject_vars")
    );
} // End of function removing_a_variables_schema_known_scalar_derives_one_removal()

// ---------------------------------------------------------------------------
// D1 — nothing is inserted below the match mapping
// ---------------------------------------------------------------------------

/// **The decision, stated as five refusals.** Every address below the match
/// mapping that the projection cannot resolve is refused by name, with an index
/// and a length and no key text.
#[test]
fn an_address_below_the_match_mapping_that_does_not_exist_is_refused_never_inserted() {
    let view = one_match(OPEN_KEYS);
    let cases: [(MatchDraft, DraftError); 5] = [
        (
            MatchDraft::new().with_variable(VariableDraft::new(7).with(VariableField::Name, "x")),
            DraftError::TargetDoesNotExist {
                target: DraftTarget::Variable { index: 7 },
                length: 2,
            },
        ),
        (
            MatchDraft::new()
                .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(9).set("x"))),
            DraftError::TargetDoesNotExist {
                target: DraftTarget::Param {
                    variable: 0,
                    entry: 9,
                },
                length: 2,
            },
        ),
        (
            MatchDraft::new()
                .with_form_field(FormFieldDraft::new(4).with_option(EntryDraft::new(0).set("x"))),
            DraftError::TargetDoesNotExist {
                target: DraftTarget::FormField { index: 4 },
                length: 2,
            },
        ),
        (
            MatchDraft::new()
                .with_form_field(FormFieldDraft::new(1).with_option(EntryDraft::new(3).set("x"))),
            DraftError::TargetDoesNotExist {
                target: DraftTarget::FormFieldOption {
                    field: 1,
                    option: 3,
                },
                length: 1,
            },
        ),
        (
            MatchDraft::new().with_variable(
                VariableDraft::new(1).with_param(EntryDraft::new(0).with_item(5, "x")),
            ),
            DraftError::TargetDoesNotExist {
                target: DraftTarget::ParamItem {
                    variable: 1,
                    entry: 0,
                    item: 5,
                },
                length: 2,
            },
        ),
    ];
    for (draft, expected) in cases {
        assert_eq!(plan_match_edits(&view, &draft), Err(expected));
    } // End of the loop over the five addresses
} // End of function an_address_below_the_match_mapping_that_does_not_exist_is_refused_never_inserted()

/// A value that is not the shape the draft addressed has **no** entries of that
/// shape, so the address is refused as one that does not exist.
#[test]
fn a_value_of_the_wrong_shape_holds_nothing_the_draft_can_name() {
    let view = one_match(FORM_FIELD_WITHOUT_OPTIONS);
    assert!(
        view.form_fields[1].value.as_mapping().is_none(),
        "the fixture's second form field is not an option mapping"
    );
    assert_eq!(
        plan_match_edits(
            &view,
            &MatchDraft::new()
                .with_form_field(FormFieldDraft::new(1).with_option(EntryDraft::new(0).set("x"))),
        ),
        Err(DraftError::TargetDoesNotExist {
            target: DraftTarget::FormFieldOption {
                field: 1,
                option: 0,
            },
            length: 0,
        })
    );

    // The same, for elements drafted against a value that is not a sequence.
    let scalar_option = one_match(OPEN_KEYS);
    assert_eq!(
        plan_match_edits(
            &scalar_option,
            &MatchDraft::new().with_variable(
                VariableDraft::new(0).with_param(EntryDraft::new(0).with_item(0, "x"))
            ),
        ),
        Err(DraftError::TargetDoesNotExist {
            target: DraftTarget::ParamItem {
                variable: 0,
                entry: 0,
                item: 0,
            },
            length: 0,
        })
    );
} // End of function a_value_of_the_wrong_shape_holds_nothing_the_draft_can_name()

/// A variable's schema-known scalar that the projection does not hold is
/// refused rather than inserted — D1 at the one place a caller would expect an
/// insertion, because the key *is* one espanso's schema fixes.
#[test]
fn a_variables_absent_schema_known_scalar_is_refused_rather_than_inserted() {
    let view = one_match(VARIABLE_MISSING_FIELDS);
    assert!(
        view.vars[0].name.is_none(),
        "the fixture's variable has no name"
    );
    for field in [VariableField::Name, VariableField::InjectVars] {
        let draft = MatchDraft::new().with_variable(VariableDraft::new(0).with(field, "x"));
        assert_eq!(
            plan_match_edits(&view, &draft),
            Err(DraftError::VariableFieldHasNoScalar { variable: 0, field })
        );
        let removed = MatchDraft::new().with_variable(VariableDraft::new(0).without(field));
        assert_eq!(
            plan_match_edits(&view, &removed),
            Err(DraftError::VariableFieldHasNoScalar { variable: 0, field }),
            "a removal of what is not there is refused too, because the projection \
             cannot tell an absent key from one holding an unmodelled shape"
        );
    } // End of the loop over the two absent fields
} // End of function a_variables_absent_schema_known_scalar_is_refused_rather_than_inserted()

// ---------------------------------------------------------------------------
// The shape refusals of the open half
// ---------------------------------------------------------------------------

/// A `Set` over an entry whose value is a collection is not expressible, for
/// [`DraftError::FieldHasAnUnmodelledShape`]'s reason one level down.
#[test]
fn setting_an_open_entry_whose_value_is_a_collection_is_refused() {
    let view = one_match(NESTED_PARAM_MAPPING);
    assert!(
        view.vars[0].params[1].value.as_mapping().is_some(),
        "the fixture's second parameter holds a mapping"
    );
    let draft = MatchDraft::new()
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(1).set("x")));
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::NestedValueIsACollection {
            target: DraftTarget::Param {
                variable: 0,
                entry: 1,
            },
            found: ValueKind::Mapping,
        })
    );
} // End of function setting_an_open_entry_whose_value_is_a_collection_is_refused()

/// A `Remove` over such an entry **is** expressible and is refused anyway,
/// under the name that says why: those bytes were never displayed.
#[test]
fn removing_an_open_entry_whose_value_was_never_displayed_is_refused_as_a_decision() {
    let view = one_match(NESTED_PARAM_MAPPING);
    let draft = MatchDraft::new()
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(1).removed()));
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::NestedRemovalWouldDiscardUnshownStructure {
            target: DraftTarget::Param {
                variable: 0,
                entry: 1,
            },
            found: ValueKind::Mapping,
        })
    );

    // The same for a sequence, which a user *has* seen — the refusal is about
    // the whole entry going away, not about the element values.
    let sequence = one_match(OPEN_KEYS);
    let draft = MatchDraft::new()
        .with_variable(VariableDraft::new(1).with_param(EntryDraft::new(0).removed()));
    assert_eq!(
        plan_match_edits(&sequence, &draft),
        Err(DraftError::NestedRemovalWouldDiscardUnshownStructure {
            target: DraftTarget::Param {
                variable: 1,
                entry: 0,
            },
            found: ValueKind::Sequence,
        })
    );
} // End of function removing_an_open_entry_whose_value_was_never_displayed_is_refused_as_a_decision()

/// Deleting an element of a nested sequence is a cardinality change.
#[test]
fn deleting_an_element_of_a_nested_sequence_is_refused() {
    let view = one_match(OPEN_KEYS);
    let mut entry = EntryDraft::new(0);
    entry.items.push(ItemDraft {
        index: 1,
        value: DraftField::Remove,
    });
    let draft = MatchDraft::new().with_variable(VariableDraft::new(1).with_param(entry));
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::NestedItemRemoval {
            target: DraftTarget::ParamItem {
                variable: 1,
                entry: 0,
                item: 1,
            },
        })
    );
} // End of function deleting_an_element_of_a_nested_sequence_is_refused()

/// An element of a nested sequence that the file writes as a collection is not
/// a scalar node, so replacing it is a structural change.
#[test]
fn a_nested_sequence_element_that_is_not_a_scalar_is_refused() {
    let source = "matches:\n  - trigger: :a\n    replace: b\n    vars:\n      - name: pick\n        \
                  type: choice\n        params:\n          values:\n            - plain\n            \
                  - label: Shown\n              id: shown\n";
    let view = one_match(source);
    let draft = MatchDraft::new()
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(0).with_item(1, "x")));
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::NotAScalar {
            target: DraftTarget::ParamItem {
                variable: 0,
                entry: 0,
                item: 1,
            },
        })
    );
} // End of function a_nested_sequence_element_that_is_not_a_scalar_is_refused()

/// A nested scalar whose projected text is a raw source slice cannot be
/// compared as a logical value, exactly as a match-level one cannot.
///
/// **Unreachable from any document in either corpus** — the corpus tests pin the
/// count of non-decodable scalars at zero — so the state is reached the only way
/// a test honestly can, by setting the flag the projection sets.
#[test]
fn a_nested_scalar_that_did_not_decode_is_refused_rather_than_compared() {
    let mut view = one_match(OPEN_KEYS);
    let ValueView::Scalar(scalar) = &mut view.vars[0].params[0].value else {
        panic!("the first parameter is a scalar");
    };
    scalar.decoded = false;
    let draft = MatchDraft::new()
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(0).set("x")));
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::NotDecodable {
            target: DraftTarget::Param {
                variable: 0,
                entry: 0,
            },
        })
    );
} // End of function a_nested_scalar_that_did_not_decode_is_refused_rather_than_compared()

/// A nested entry written `key:` has a zero-width value, so there are no bytes
/// to replace.
#[test]
fn a_nested_entry_that_owns_no_bytes_is_refused() {
    let source = "matches:\n  - trigger: :a\n    replace: b\n    vars:\n      - name: v\n        \
         type: date\n        params:\n          format:\n";
    let view = one_match(source);
    let draft = MatchDraft::new()
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(0).set("%Y")));
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::TargetOwnsNoBytes {
            target: DraftTarget::Param {
                variable: 0,
                entry: 0,
            },
        })
    );
} // End of function a_nested_entry_that_owns_no_bytes_is_refused()

// ---------------------------------------------------------------------------
// D5 — nameability and ambiguity
// ---------------------------------------------------------------------------

/// A key no path segment can spell is refused rather than approximated.
///
/// **Unreachable from any document that reaches the planner**: a mapping with a
/// complex key raises `HazardKind::ExplicitKeyMapping`, so the gate refuses the
/// whole match first. The fixture below is therefore projected and then admitted
/// by hand, which is the only honest way to reach the branch — and the branch is
/// real, because it is what stops a path being invented for an entry no segment
/// names.
#[test]
fn an_open_entry_whose_key_is_not_a_scalar_is_refused() {
    let source = "matches:\n  - trigger: :a\n    replace: b\n    vars:\n      - name: v\n        \
                  type: date\n        params:\n          ? [x, y]\n          : '1'\n          \
                  plain: '2'\n";
    let mut view = one_match(source);
    assert_eq!(
        view.blocking_hazard,
        Some(HazardKind::ExplicitKeyMapping),
        "the gate refuses this match first, which is why the state is forced below"
    );
    assert!(
        view.vars[0].params[0].key.is_none(),
        "the projection records the entry and names no key for it"
    );
    view.blocking_hazard = None;
    view.safely_editable = true;

    let draft = MatchDraft::new()
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(0).set("x")));
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::TargetIsNotNameable {
            target: DraftTarget::Param {
                variable: 0,
                entry: 0,
            },
        })
    );
} // End of function an_open_entry_whose_key_is_not_a_scalar_is_refused()

/// Two entries of one open mapping decoding to the same key text leave no path
/// that names one of them.
///
/// **Unreachable from a document that reaches the planner** for the same reason:
/// a repeated key raises `HazardKind::DuplicateMappingKey` anywhere in the
/// match's subtree. The refusal is defence in depth, and it carries indices.
///
/// The duplicate is at a **different index from the one the draft names**, which
/// is the case a check that only looked at the keys the batch mentions would
/// pass.
#[test]
fn two_entries_of_one_open_mapping_sharing_a_key_are_refused() {
    let source = "matches:\n  - trigger: :a\n    replace: b\n    vars:\n      - name: v\n        \
                  type: date\n        params:\n          format: '1'\n          offset: '2'\n          \
                  format: '3'\n";
    let mut view = one_match(source);
    assert_eq!(view.blocking_hazard, Some(HazardKind::DuplicateMappingKey));
    view.blocking_hazard = None;
    view.safely_editable = true;
    assert_eq!(
        view.vars[0].params.len(),
        3,
        "all three entries are projected"
    );

    let draft = MatchDraft::new()
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(2).set("4")));
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::TargetKeyIsAmbiguous {
            target: DraftTarget::Param {
                variable: 0,
                entry: 2,
            },
            other: 0,
        }),
        "the draft named the third entry and the resolver would have taken the first"
    );
} // End of function two_entries_of_one_open_mapping_sharing_a_key_are_refused()

/// A variable the projection cannot address is refused rather than addressed
/// through a path this planner composed for it.
///
/// **Unreachable from any document**: a variable reached through a match reached
/// through `matches` always has a path, so the state is forced.
#[test]
fn a_variable_with_no_path_is_refused() {
    let mut view = one_match(OPEN_KEYS);
    view.vars[0].path = None;
    let draft =
        MatchDraft::new().with_variable(VariableDraft::new(0).with(VariableField::Name, "x"));
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::VariableHasNoPath { index: 0 })
    );
} // End of function a_variable_with_no_path_is_refused()

// ---------------------------------------------------------------------------
// D3 and D7 — two answers to one question, refused at intent level
// ---------------------------------------------------------------------------

/// One entry drafted as a scalar *and* as a sequence asks two questions of one
/// node.
#[test]
fn one_entry_drafted_as_a_scalar_and_as_a_sequence_is_refused() {
    let view = one_match(OPEN_KEYS);
    let draft = MatchDraft::new().with_variable(
        VariableDraft::new(1).with_param(EntryDraft::new(0).set("x").with_item(0, "y")),
    );
    assert_eq!(
        plan_match_edits(&view, &draft),
        Err(DraftError::EntryDraftsAScalarAndASequence {
            target: DraftTarget::Param {
                variable: 1,
                entry: 0,
            },
        })
    );
} // End of function one_entry_drafted_as_a_scalar_and_as_a_sequence_is_refused()

/// **Every list of the open half refuses two intents at one index**, and it does
/// so before any diffing — an intent asking for the value already there derives
/// nothing, so a batch-level check would see one intent and call the draft
/// coherent.
#[test]
fn two_intents_naming_one_open_index_are_refused_before_any_diffing() {
    let view = one_match(OPEN_KEYS);
    let cases: [(MatchDraft, DraftTarget); 5] = [
        (
            MatchDraft::new()
                .with_variable(VariableDraft::new(0))
                .with_variable(VariableDraft::new(0).with(VariableField::Name, "x")),
            DraftTarget::Variable { index: 0 },
        ),
        (
            MatchDraft::new().with_variable(
                VariableDraft::new(0)
                    .with_param(EntryDraft::new(0).set("%Y-%m-%d"))
                    .with_param(EntryDraft::new(0).set("x")),
            ),
            DraftTarget::Param {
                variable: 0,
                entry: 0,
            },
        ),
        (
            MatchDraft::new()
                .with_form_field(FormFieldDraft::new(1))
                .with_form_field(FormFieldDraft::new(1)),
            DraftTarget::FormField { index: 1 },
        ),
        (
            MatchDraft::new().with_form_field(
                FormFieldDraft::new(0)
                    .with_option(EntryDraft::new(0).set("choice"))
                    .with_option(EntryDraft::new(0).set("text")),
            ),
            DraftTarget::FormFieldOption {
                field: 0,
                option: 0,
            },
        ),
        (
            MatchDraft::new().with_variable(
                VariableDraft::new(1)
                    .with_param(EntryDraft::new(0).with_item(0, "alpha").with_item(0, "x")),
            ),
            DraftTarget::ParamItem {
                variable: 1,
                entry: 0,
                item: 0,
            },
        ),
    ];
    for (draft, target) in cases {
        assert_eq!(
            plan_match_edits(&view, &draft),
            Err(DraftError::TargetDraftedTwice {
                target,
                first: 0,
                second: 1,
            }),
            "two intents about {target:?} must be refused"
        );
    } // End of the loop over the five lists
} // End of function two_intents_naming_one_open_index_are_refused_before_any_diffing()

/// The case the intent-level check exists for: the first intent is a logical
/// no-op, so it derives nothing and would be invisible to every batch guard.
#[test]
fn a_no_op_open_intent_followed_by_a_real_one_is_refused_not_silently_resolved() {
    let view = one_match(OPEN_KEYS);
    let no_op = MatchDraft::new()
        .with_variable(VariableDraft::new(0).with_param(EntryDraft::new(0).set("%Y-%m-%d")));
    assert_eq!(
        plan_match_edits(&view, &no_op),
        Ok(Vec::new()),
        "alone, the no-op intent derives nothing — which is what made it invisible"
    );

    let both = MatchDraft::new().with_variable(
        VariableDraft::new(0)
            .with_param(EntryDraft::new(0).set("%Y-%m-%d"))
            .with_param(EntryDraft::new(0).set("%d/%m/%Y")),
    );
    assert_eq!(
        plan_match_edits(&view, &both),
        Err(DraftError::TargetDraftedTwice {
            target: DraftTarget::Param {
                variable: 0,
                entry: 0,
            },
            first: 0,
            second: 1,
        })
    );
} // End of function a_no_op_open_intent_followed_by_a_real_one_is_refused_not_silently_resolved()

// ---------------------------------------------------------------------------
// The guards, widened
// ---------------------------------------------------------------------------

/// Every shape of the open surface passes the guard, so it refuses by shape
/// rather than by refusing everything.
#[test]
fn the_closed_surface_guard_admits_every_shape_of_the_open_surface() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let vars = mapping.clone().with_key("vars").with_index(0);
    let params = vars.clone().with_key("params");
    let form_field = mapping.clone().with_key("form_fields").with_key("team");

    let mut edits: Vec<DocumentEdit> = Vec::new();
    for field in VariableField::ALL {
        edits.push(DocumentEdit::Scalar(ScalarEdit::new(
            vars.clone().with_key(field.key()),
            "x",
        )));
        edits.push(DocumentEdit::RemoveField(FieldRemoval::new(
            vars.clone().with_key(field.key()),
        )));
    } // End of the loop over the variable's schema-known scalars
    edits.push(DocumentEdit::Scalar(ScalarEdit::new(
        params.clone().with_key("format"),
        "x",
    )));
    edits.push(DocumentEdit::Scalar(ScalarEdit::new(
        params.clone().with_key("values").with_index(0),
        "x",
    )));
    edits.push(DocumentEdit::RemoveField(FieldRemoval::new(
        params.clone().with_key("format"),
    )));
    edits.push(DocumentEdit::Scalar(ScalarEdit::new(
        form_field.clone().with_key("type"),
        "x",
    )));
    edits.push(DocumentEdit::Scalar(ScalarEdit::new(
        form_field.clone().with_key("values").with_index(1),
        "x",
    )));
    edits.push(DocumentEdit::RemoveField(FieldRemoval::new(
        form_field.clone().with_key("type"),
    )));
    assert_eq!(check_closed_surface(&mapping, &edits), Ok(()));
} // End of function the_closed_surface_guard_admits_every_shape_of_the_open_surface()

/// **Nothing deeper passes.** One segment past the deepest legal path of each
/// shape is refused, which is what stops the widening from becoming "anything
/// under `vars`".
#[test]
fn a_path_one_segment_deeper_than_the_surface_is_refused() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let vars = mapping.clone().with_key("vars").with_index(0);
    let form_field = mapping.clone().with_key("form_fields").with_key("team");
    let deeper = [
        // one past `<match>.vars[i].name`
        vars.clone().with_key("name").with_key("deeper"),
        // one past `<match>.vars[i].params.<key>`
        vars.clone()
            .with_key("params")
            .with_key("fields")
            .with_key("one"),
        // one past `<match>.vars[i].params.<key>[j]`
        vars.clone()
            .with_key("params")
            .with_key("values")
            .with_index(0)
            .with_key("id"),
        // one past `<match>.form_fields.<key>.<key>`
        form_field.clone().with_key("values").with_key("deeper"),
        // one past `<match>.form_fields.<key>.<key>[j]`
        form_field
            .clone()
            .with_key("values")
            .with_index(0)
            .with_key("id"),
        // one past `<match>.<triggers>[i]`
        mapping
            .clone()
            .with_key("triggers")
            .with_index(0)
            .with_key("deeper"),
    ];
    for path in deeper {
        let edits = vec![DocumentEdit::Scalar(ScalarEdit::new(path.clone(), "x"))];
        assert_eq!(
            check_closed_surface(&mapping, &edits),
            Err(DraftError::OutsideTheClosedSurface { edit: 0 }),
            "a scalar edit at {path} is one segment too deep"
        );
        let removal = vec![DocumentEdit::RemoveField(FieldRemoval::new(path.clone()))];
        assert_eq!(
            check_closed_surface(&mapping, &removal),
            Err(DraftError::OutsideTheClosedSurface { edit: 0 }),
            "and so is a removal at {path}"
        );
    } // End of the loop over the six over-deep paths
} // End of function a_path_one_segment_deeper_than_the_surface_is_refused()

/// D1 as a shape: an insertion below the match mapping is refused by the guard,
/// whatever key it names.
#[test]
fn the_closed_surface_guard_refuses_an_insertion_below_the_match_mapping() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let params = mapping
        .clone()
        .with_key("vars")
        .with_index(0)
        .with_key("params");
    for target in [
        params,
        mapping.clone().with_key("form_fields").with_key("team"),
    ] {
        let edits = vec![DocumentEdit::InsertField(FieldInsert::new(
            target, "locale", "es-ES",
        ))];
        assert_eq!(
            check_closed_surface(&mapping, &edits),
            Err(DraftError::OutsideTheClosedSurface { edit: 0 })
        );
    } // End of the loop over the two open mappings
} // End of function the_closed_surface_guard_refuses_an_insertion_below_the_match_mapping()

/// The containment check is depth-agnostic, and this is what that means: a
/// removal in an outer mapping that contains an edit in a nested one is caught.
///
/// It is prefix containment standing in for byte containment, which is sound
/// only because a `DocumentPath` addresses concrete syntax nodes of one parse
/// and follows no alias — the invariant `check_no_removal_contains_another_edit`
/// now states in its own documentation.
#[test]
fn a_removal_in_an_outer_mapping_containing_a_nested_edit_is_caught() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let params = mapping
        .clone()
        .with_key("vars")
        .with_index(0)
        .with_key("params");
    let edits = vec![
        DocumentEdit::RemoveField(FieldRemoval::new(params.clone().with_key("values"))),
        DocumentEdit::Scalar(ScalarEdit::new(
            params.with_key("values").with_index(1),
            "x",
        )),
    ];
    assert_eq!(
        check_batch_independence(&mapping, &keys(&["trigger", "vars"]), &[], &edits),
        Err(DraftError::RemovalContainsAnEdit {
            removal: 0,
            edit: 1
        })
    );
} // End of function a_removal_in_an_outer_mapping_containing_a_nested_edit_is_caught()

/// **The guard judges a nested mapping against its whole key list, not against
/// the keys the batch happens to name.**
///
/// An unedited duplicate still makes an edited path ambiguous: `params` written
/// `a`, `b`, `a` and a batch naming only `b` is fine, and the same batch naming
/// `a` is not — because `crate::patch::path::resolve` takes the **first** `a`
/// and the caller believes it addressed the other one.
#[test]
fn the_guard_refuses_a_nested_key_the_mapping_writes_twice() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let params = mapping
        .clone()
        .with_key("vars")
        .with_index(0)
        .with_key("params");
    let nested = [NestedKeys::new(
        params.clone(),
        keys(&["format", "offset", "format"]),
    )];

    let edits = vec![DocumentEdit::Scalar(ScalarEdit::new(
        params.clone().with_key("format"),
        "x",
    ))];
    assert_eq!(
        check_batch_independence(&mapping, &keys(&["trigger", "vars"]), &nested, &edits),
        Err(DraftError::AmbiguousNestedKey { edit: 0 })
    );

    // A key the same mapping writes once is judged and admitted, so the guard
    // refuses by fact rather than by the presence of any duplicate.
    let unique = vec![DocumentEdit::Scalar(ScalarEdit::new(
        params.with_key("offset"),
        "x",
    ))];
    assert_eq!(
        check_batch_independence(&mapping, &keys(&["trigger", "vars"]), &nested, &unique),
        Ok(())
    );
} // End of function the_guard_refuses_a_nested_key_the_mapping_writes_twice()

/// A nested sequence element is judged against the key that introduces its
/// sequence, because that is the entry a path resolves through.
#[test]
fn a_nested_element_is_judged_against_the_key_of_its_own_sequence() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let params = mapping
        .clone()
        .with_key("vars")
        .with_index(0)
        .with_key("params");
    let nested = [NestedKeys::new(
        params.clone(),
        keys(&["values", "trim", "values"]),
    )];
    let edits = vec![DocumentEdit::Scalar(ScalarEdit::new(
        params.with_key("values").with_index(0),
        "x",
    ))];
    assert_eq!(
        check_batch_independence(&mapping, &keys(&["trigger", "vars"]), &nested, &edits),
        Err(DraftError::AmbiguousNestedKey { edit: 0 })
    );
} // End of function a_nested_element_is_judged_against_the_key_of_its_own_sequence()

/// A mapping the caller described nothing about is not judged: this module
/// reads paths, never documents.
#[test]
fn a_nested_mapping_with_no_key_list_is_not_judged() {
    let mapping = DocumentPath::root(0).with_key("matches").with_index(0);
    let edits = vec![DocumentEdit::Scalar(ScalarEdit::new(
        mapping
            .clone()
            .with_key("vars")
            .with_index(0)
            .with_key("params")
            .with_key("format"),
        "x",
    ))];
    assert_eq!(
        check_batch_independence(&mapping, &keys(&["trigger", "vars"]), &[], &edits),
        Ok(())
    );
} // End of function a_nested_mapping_with_no_key_list_is_not_judged()

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

/// The same, for a variable's three schema-known scalars.
#[test]
fn every_variable_field_serializes_as_its_espanso_key() {
    for field in VariableField::ALL {
        let json = serde_json::to_value(field).expect("a field identifier serializes");
        assert_eq!(
            json,
            serde_json::Value::String(field.key().to_owned()),
            "{field:?} must serialize as the key the projection reads"
        );
        let read: VariableField = serde_json::from_value(json).expect("and reads back");
        assert_eq!(read, field);
        assert_eq!(VariableField::from_key(field.key()), Some(field));
    } // End of the loop over the variable's three schema-known scalars
} // End of function every_variable_field_serializes_as_its_espanso_key()

/// **An open address is an index, and never a key.**
///
/// The privacy constraint stated as a wire shape: the owner's own key text never
/// leaves this crate inside a refusal (`CLAUDE.md` section 1), so every operand
/// naming something in `vars` or `form_fields` is a number.
#[test]
fn a_draft_target_names_an_open_entry_by_index_and_never_by_key() {
    let cases = [
        (
            DraftTarget::Variable { index: 2 },
            serde_json::json!({ "Variable": { "index": 2 } }),
        ),
        (
            DraftTarget::VariableScalar {
                variable: 1,
                field: VariableField::InjectVars,
            },
            serde_json::json!({ "VariableScalar": { "variable": 1, "field": "inject_vars" } }),
        ),
        (
            DraftTarget::Param {
                variable: 0,
                entry: 3,
            },
            serde_json::json!({ "Param": { "variable": 0, "entry": 3 } }),
        ),
        (
            DraftTarget::ParamItem {
                variable: 0,
                entry: 1,
                item: 4,
            },
            serde_json::json!({ "ParamItem": { "variable": 0, "entry": 1, "item": 4 } }),
        ),
        (
            DraftTarget::FormField { index: 5 },
            serde_json::json!({ "FormField": { "index": 5 } }),
        ),
        (
            DraftTarget::FormFieldOption {
                field: 1,
                option: 2,
            },
            serde_json::json!({ "FormFieldOption": { "field": 1, "option": 2 } }),
        ),
        (
            DraftTarget::FormFieldOptionItem {
                field: 1,
                option: 2,
                item: 3,
            },
            serde_json::json!({ "FormFieldOptionItem": { "field": 1, "option": 2, "item": 3 } }),
        ),
    ];
    for (target, expected) in cases {
        assert_eq!(
            serde_json::to_value(target).expect("an address serializes"),
            expected
        );
    } // End of the loop over every open address
} // End of function a_draft_target_names_an_open_entry_by_index_and_never_by_key()

/// **No refusal of the open half carries a byte of the document.**
///
/// The serialized form of every new variant is walked and every string in it
/// must be a schema key or a variant tag. A key the owner wrote would show up
/// here as a string that is neither.
#[test]
fn no_open_refusal_carries_a_key_the_owner_wrote() {
    let refusals = [
        DraftError::TargetDoesNotExist {
            target: DraftTarget::Param {
                variable: 0,
                entry: 1,
            },
            length: 2,
        },
        DraftError::VariableHasNoPath { index: 0 },
        DraftError::VariableFieldHasNoScalar {
            variable: 0,
            field: VariableField::Name,
        },
        DraftError::EntryDraftsAScalarAndASequence {
            target: DraftTarget::FormFieldOption {
                field: 0,
                option: 1,
            },
        },
        DraftError::TargetIsNotNameable {
            target: DraftTarget::Param {
                variable: 0,
                entry: 0,
            },
        },
        DraftError::TargetKeyIsAmbiguous {
            target: DraftTarget::Param {
                variable: 0,
                entry: 2,
            },
            other: 0,
        },
        DraftError::NestedValueIsACollection {
            target: DraftTarget::Param {
                variable: 0,
                entry: 1,
            },
            found: ValueKind::Mapping,
        },
        DraftError::NestedRemovalWouldDiscardUnshownStructure {
            target: DraftTarget::Param {
                variable: 0,
                entry: 1,
            },
            found: ValueKind::Sequence,
        },
        DraftError::NestedItemRemoval {
            target: DraftTarget::ParamItem {
                variable: 0,
                entry: 0,
                item: 1,
            },
        },
        DraftError::TargetDraftedTwice {
            target: DraftTarget::Variable { index: 0 },
            first: 0,
            second: 1,
        },
        DraftError::AmbiguousNestedKey { edit: 0 },
    ];
    let allowed: Vec<String> = VariableField::ALL
        .into_iter()
        .map(|field| field.key().to_owned())
        .chain(MatchField::ALL.into_iter().map(|f| f.key().to_owned()))
        .chain(SequenceField::ALL.into_iter().map(|f| f.key().to_owned()))
        .collect();
    for refusal in &refusals {
        let json = serde_json::to_value(refusal).expect("a refusal serializes");
        let mut strings = Vec::new();
        collect_strings(&json, &mut strings);
        for text in strings {
            assert!(
                allowed.contains(&text) || text.chars().all(|c| c.is_ascii_alphanumeric()),
                "{refusal:?} carries the free-form string {text:?}"
            );
        }
    } // End of the loop over every open refusal
} // End of function no_open_refusal_carries_a_key_the_owner_wrote()

/// Every string a JSON value holds, keys and values alike.
fn collect_strings(value: &serde_json::Value, out: &mut Vec<String>) {
    match value {
        serde_json::Value::String(text) => out.push(text.clone()),
        serde_json::Value::Array(items) => {
            for item in items {
                collect_strings(item, out);
            }
        }
        serde_json::Value::Object(map) => {
            for (key, nested) in map {
                out.push(key.clone());
                collect_strings(nested, out);
            }
        } // End of the object arm
        _ => {}
    }
} // End of function collect_strings()

/// The three new draft types read a partial object and refuse an unknown key,
/// exactly as `MatchDraft` does — and `type` is spelled as espanso spells it.
#[test]
fn the_open_draft_types_read_a_partial_object_and_refuse_an_unknown_key() {
    let draft: MatchDraft = serde_json::from_str(
        r#"{"vars": [{"index": 0, "type": {"Set": "date"},
             "params": [{"index": 1, "items": [{"index": 0, "value": {"Set": "x"}}]}]}],
            "form_fields": [{"index": 2}]}"#,
    )
    .expect("a partial open draft reads");
    assert_eq!(
        draft.vars[0].declared_type,
        DraftField::Set("date".to_owned())
    );
    assert!(draft.vars[0].name.is_unchanged());
    assert_eq!(draft.vars[0].params[0].index, 1);
    assert!(draft.vars[0].params[0].value.is_unchanged());
    assert_eq!(draft.form_fields[0].index, 2);

    for malformed in [
        r#"{"vars": [{"index": 0, "declared_type": {"Set": "date"}}]}"#,
        r#"{"vars": [{"index": 0, "nope": {"Set": "x"}}]}"#,
        r#"{"vars": [{"index": 0, "params": [{"index": 0, "nope": 1}]}]}"#,
        r#"{"form_fields": [{"index": 0, "nope": []}]}"#,
        r#"{"vars": [{"index": 0, "name": null}]}"#,
    ] {
        assert!(
            serde_json::from_str::<MatchDraft>(malformed).is_err(),
            "{malformed} must fail closed"
        );
    } // End of the loop over the malformed drafts
} // End of function the_open_draft_types_read_a_partial_object_and_refuse_an_unknown_key()

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
fn every_projected_scalar_value(view: &MatchView) -> (MatchDraft, OpenCounts) {
    let mut draft = MatchDraft::new();
    let mut counts = OpenCounts::default();
    for field in MatchField::ALL {
        if let Some(text) = projected_text(view, field) {
            *draft.field_mut(field) = DraftField::Set(text);
            counts.intents += 1;
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
            counts.intents += 1;
        } // End of the loop over this sequence's projected elements
    } // End of the loop over both string sequences
    counts.absorb(draft_the_open_half(view, &mut draft));
    (draft, counts)
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

/// Everything one corpus sweep counted.
#[derive(Debug, Default)]
struct SweepCounts {
    /// Matches seen.
    matches: usize,
    /// Matches whose identity draft planned to an empty batch.
    planned: usize,
    /// Everything the open half contributed, plus the total intent count.
    open: OpenCounts,
    /// Refusal variant names with their counts — a code and a number, nothing
    /// else.
    refusals: BTreeMap<String, usize>,
}

/// One corpus sweep: every match drafted to its own projected values, and the
/// counts it produced.
fn sweep(files: &[common::CorpusFile]) -> SweepCounts {
    let mut counts = SweepCounts::default();
    for (index, file) in files.iter().enumerate() {
        let context = DocumentContext::detached(DocumentId(index as u64), &file.name);
        for view in &project_source(&context, &file.source).view.matches {
            counts.matches += 1;
            let (draft, drafted) = every_projected_scalar_value(view);
            match plan_match_edits(view, &draft) {
                Ok(edits) => {
                    counts.planned += 1;
                    counts.open.absorb(drafted);
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
                    *counts.refusals.entry(name).or_default() += 1;
                }
            } // End of the match over what the planner answered
        } // End of the loop over this file's matches
    } // End of the loop over the corpus
    counts
} // End of function sweep()

/// Prints one sweep's counts, and asserts it had something to look at.
///
/// Counts and one label only (`CLAUDE.md` section 1): no value, no key text and
/// no document byte reaches the output.
fn report(label: &str, files: usize, counts: &SweepCounts) {
    println!(
        "{label}: {files} files, {} matches, {} planned to an empty batch, {} intents drafted",
        counts.matches, counts.planned, counts.open.intents
    );
    println!(
        "  open half: {} variables, {} params entries, {} form fields, {} options",
        counts.open.variables, counts.open.params, counts.open.form_fields, counts.open.options
    );
    println!("  refusals: {:?}", counts.refusals);
    assert!(
        counts.planned > 0 && counts.open.intents > 0,
        "the sweep must have drafted something: {} planned, {} intents",
        counts.planned,
        counts.open.intents
    );
    assert!(
        counts.open.variables > 0 && counts.open.params > 0,
        "the sweep must have reached the open half: {} variables, {} params entries",
        counts.open.variables,
        counts.open.params
    );
} // End of function report()

/// The headline property, over **every match of the committed corpus**.
///
/// The inline fixtures above state the property on shapes chosen to make it
/// sharp; this states it on every match of every synthetic file, including the
/// fifteen byte-exact ones. It always runs, which is what makes the real-corpus
/// twin below an addition rather than the only coverage.
///
/// **Since Phase 2b-2b-2 it drafts the open half too** — every variable's
/// schema-known scalars, every `params` entry, every element of a `params`
/// sequence, every `form_fields` option and every element of one. It is the
/// **only** coverage `form_fields` has under a sweep: the owner's configuration
/// holds none at all, which the real twin's own counts record.
///
/// Prints counts only.
#[test]
fn every_match_of_the_synthetic_corpus_drafts_to_an_empty_batch_or_a_named_refusal() {
    let files = common::synthetic_valid();
    assert!(!files.is_empty(), "the synthetic corpus is committed");
    let counts = sweep(&files);
    report("synthetic corpus", files.len(), &counts);
    assert!(
        counts.open.form_fields > 0,
        "the synthetic corpus must reach `form_fields` too"
    );
} // End of function every_match_of_the_synthetic_corpus_drafts_to_an_empty_batch_or_a_named_refusal()

/// **The headline property, over the owner's real configuration.**
///
/// `PROGRESS.md`'s standard is that a property runs over *both* corpora. Every
/// match of every real file is drafted with each in-scope field set to its own
/// projected logical value — **including every in-scope `vars` and
/// `form_fields` value since Phase 2b-2b-2** — and the derived batch must be
/// **empty**: a single edit here would be this application preparing to rewrite
/// quoting its owner chose.
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

    let counts = sweep(&files);
    report("real corpus", files.len(), &counts);
} // End of function every_match_of_the_real_configuration_drafts_to_an_empty_batch_or_a_named_refusal()
