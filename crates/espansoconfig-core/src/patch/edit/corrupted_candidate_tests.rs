//! A deliberately corrupted candidate fails the oracle — Phase 3-15-1.
//!
//! [`apply_edits`] never hands out a candidate it built wrongly, so the only
//! way to show that [`verify`] would refuse one is to build it wrongly on
//! purpose. [`candidate_through`] plans a batch exactly as [`apply_edits`]
//! does, lets a test rewrite the planned replacements and then corrupt the
//! spliced candidate, and hands **that** candidate to the same [`verify`] call.
//! Every batch below is one of the edit kinds Phase 3 added: a grouped
//! insertion and a key substitution (3-1), block scalar-list insertion and
//! removal and a shape switch (3-2), and flow scalar-list insertion and removal
//! (3-3). The local raw-item edit (3-7) has its own verifier and its own twin of
//! this module, `raw_item::corrupted_candidate_tests`.
//!
//! Every test pairs the corrupted run with an honest one, whose candidate must
//! equal [`apply_edits`]'s own: that is what stops this mirror from drifting
//! away from the function it stands in for without a test noticing.

use super::*;

/// A neutral match file holding every shape the Phase 3 kinds edit: a flow
/// list, a block list, a single trigger, a content key, and a comment on each
/// side of the match list.
const SOURCE: &str = concat!(
    "# A file comment.\n",
    "matches:\n",
    "  - trigger: ':a'\n",
    "    replace: one\n",
    "    search_terms: [alpha, beta]\n",
    "  - triggers:\n",
    "      - ':b'\n",
    "      - ':c'\n",
    "    markdown: two\n",
    "# A closing comment.\n",
);

/// The path of snippet `index`.
fn item(index: usize) -> DocumentPath {
    DocumentPath::root(0).with_key("matches").with_index(index)
}

/// Plans `edits` over `source` exactly as [`apply_edits`] does, lets `rewrite`
/// change the planned replacements, splices, lets `corrupt` change the
/// candidate, and runs [`verify`] on what is left.
///
/// Only the kinds a batch of several edits may hold are mirrored; a move, a
/// duplicate and a raw item text have batch rules and verifiers of their own
/// and are refused here with a panic, because a test that reached one would be
/// testing something this helper does not model.
fn candidate_through(
    source: &str,
    edits: &[DocumentEdit],
    rewrite: impl FnOnce(&mut [Replacement]),
    corrupt: impl FnOnce(&mut String),
) -> Result<String, EditError> {
    let index = SyntaxIndex::parse(source).map_err(EditError::SourceDoesNotParse)?;
    let trivia = TriviaIndex::scan(source, &index);
    let mut replacements = Vec::new();
    let mut permitted = Vec::new();
    let mut expectations = Vec::new();
    let mut sequences = Vec::new();
    let mut guards = Vec::new();
    let mut rewritten = Vec::new();
    for (position, edit) in edits.iter().enumerate() {
        let planned = match edit {
            DocumentEdit::Scalar(scalar) => plan_one(source, &index, &trivia, position, scalar)?,
            DocumentEdit::InsertField(insert) => {
                plan_insertion(source, &index, &trivia, position, insert)?
            }
            DocumentEdit::InsertFields(group) => {
                let request = InsertionRequest {
                    mapping: group.mapping(),
                    sibling: group.sibling(),
                    entries: group.entries(),
                };
                plan_insertion_group(source, &index, &trivia, position, request)?
            }
            DocumentEdit::SubstituteKey(substitution) => {
                plan_substitution(source, &index, &trivia, position, substitution)?
            }
            DocumentEdit::RemoveField(removal) => {
                plan_removal(source, &index, &trivia, position, removal)?
            }
            DocumentEdit::InsertItem(insert) => {
                plan_item_insertion(source, &index, &trivia, position, insert)?
            }
            DocumentEdit::RemoveItem(removal) => match flow::flow_list_of_item(&index, removal) {
                Some(sequence) => flow::plan_flow_removal(
                    source, &index, &trivia, position, removal, sequence, edits,
                )?,
                None => plan_item_removal(source, &index, &trivia, position, removal)?,
            },
            DocumentEdit::InsertScalarItems(insert) => {
                plan_scalar_item_insertion(source, &index, &trivia, position, insert)?
            }
            DocumentEdit::SwitchShape(switch) => {
                plan_shape_switch(source, &index, &trivia, position, switch)?
            }
            other => panic!("not mirrored here: {other:?}"),
        };
        assert!(planned.moved.is_none() && planned.duplicated.is_none());
        replacements.extend(planned.replacements);
        permitted.extend(planned.permitted);
        expectations.extend(planned.expectation);
        sequences.extend(planned.items);
        guards.extend(planned.guards);
        rewritten.extend(planned.rewritten);
    } // End of the loop that plans every requested edit

    replacements.sort_by_key(|replacement| (replacement.span.start, replacement.span.end));
    for guard in &guards {
        guard.check(source, &index, &trivia)?;
    }
    let mut touched = rewritten.clone();
    touched.extend(expectations.iter().map(|claim| claim.mapping_id));
    let mut changed = rewritten.clone();
    changed.extend(sequences.iter().map(|claim| claim.sequence_id));
    let mut expectations = fold_expectations(&index, expectations, &changed)?;
    let mut sequences = fold_item_expectations(&index, sequences, &touched)?;
    for expectation in &mut expectations {
        expectation.mapping = candidate_path(&index, edits, &expectation.mapping);
    }
    for expectation in &mut sequences {
        expectation.sequence = candidate_path(&index, edits, &expectation.sequence);
    }

    rewrite(&mut replacements);
    let mut candidate = splice(source, &replacements);
    corrupt(&mut candidate);
    verify(
        source,
        &candidate,
        &replacements,
        &permitted,
        Expected {
            index: &index,
            trivia: &trivia,
            edits,
            fields: &expectations,
            items: &sequences,
            moves: &[],
            duplicates: &[],
        },
    )?;
    Ok(candidate)
} // End of function candidate_through()

/// Every Phase 3 batch the tests below corrupt, with a label.
fn phase_three_batches() -> Vec<(&'static str, Vec<DocumentEdit>)> {
    let group = FieldInsertGroup::new(
        item(0),
        vec![
            ("label".to_owned(), "L".to_owned()),
            ("word".to_owned(), "x".to_owned()),
        ],
    )
    .expect("two entries");
    let substitution = KeySubstitution::new(item(1).with_key("markdown"), "html");
    let block_insert = ScalarItemInsert::new(
        item(1).with_key("triggers"),
        ItemPlacement::End,
        vec![":d".to_owned()],
    )
    .expect("one value");
    let block_remove = RemoveItem::new(item(1).with_key("triggers").with_index(0));
    let flow_insert = ScalarItemInsert::new(
        item(0).with_key("search_terms"),
        ItemPlacement::Front,
        vec!["gamma".to_owned()],
    )
    .expect("one value");
    let flow_remove = RemoveItem::new(item(0).with_key("search_terms").with_index(1));
    let switch = ShapeSwitch::new(
        item(0).with_key("trigger"),
        "triggers",
        EntryValue::ScalarList(vec![":a".to_owned(), ":z".to_owned()]),
    );
    vec![
        ("grouped insertion", vec![group.clone().into()]),
        ("key substitution", vec![substitution.clone().into()]),
        ("block list insertion", vec![block_insert.into()]),
        ("block list removal", vec![block_remove.into()]),
        ("flow list insertion", vec![flow_insert.into()]),
        ("flow list removal", vec![flow_remove.into()]),
        ("shape switch", vec![switch.into()]),
        ("a composed batch", vec![group.into(), substitution.into()]),
    ]
} // End of function phase_three_batches()

/// Whether `result` is the byte oracle's refusal: a changed byte outside every
/// replacement, or a length that no longer adds up.
fn refused_by_the_byte_oracle(result: &Result<String, EditError>) -> bool {
    matches!(
        result,
        Err(EditError::Verification(
            VerificationFailure::BytesOutsideTheSpanChanged { .. }
                | VerificationFailure::LengthMismatch { .. }
        ))
    )
}

/// The honest run of the mirror is `apply_edits` itself, for every batch.
#[test]
fn the_mirror_builds_the_candidate_apply_edits_builds() {
    for (what, edits) in phase_three_batches() {
        let honest = candidate_through(SOURCE, &edits, |_| {}, |_| {})
            .unwrap_or_else(|error| panic!("{what}: the honest run verifies: {error:?}"));
        let applied = apply_edits(SOURCE, &edits)
            .unwrap_or_else(|error| panic!("{what}: apply_edits accepts it: {error:?}"));
        assert_eq!(honest, applied.text, "{what}");
        assert_ne!(honest, SOURCE, "{what}: the batch changes something");
    } // End of the loop over the Phase 3 batches
} // End of function the_mirror_builds_the_candidate_apply_edits_builds()

/// A candidate corrupted outside every planned span — one byte of the file
/// comment above, one byte of the closing comment below, a byte appended, a
/// byte dropped — is refused by the oracle for every Phase 3 batch.
#[test]
fn a_candidate_corrupted_outside_the_planned_spans_fails_the_oracle() {
    type Corruption = fn(&mut String);
    let corruptions: [(&str, Corruption); 4] = [
        ("a byte of the file comment", |candidate| {
            candidate.replace_range(2..3, "a");
        }),
        ("a byte of the closing comment", |candidate| {
            let at = candidate.len() - 2;
            candidate.replace_range(at..at + 1, ",");
        }),
        ("an appended byte", |candidate| candidate.push('\n')),
        ("a dropped byte", |candidate| {
            candidate.remove(0);
        }),
    ];
    for (what, edits) in phase_three_batches() {
        for (how, corruption) in corruptions {
            let result = candidate_through(SOURCE, &edits, |_| {}, corruption);
            assert!(
                refused_by_the_byte_oracle(&result),
                "{what}, {how}: expected the byte oracle's refusal, got {result:?}"
            );
        } // End of the loop over the corruptions
    } // End of the loop over the Phase 3 batches
} // End of function a_candidate_corrupted_outside_the_planned_spans_fails_the_oracle()

/// A corruption the byte oracle cannot see — the planned replacement's own
/// text rewritten, so the splice and the replacement list agree — is refused
/// by the expectation the planner recorded: the grouped insertion's field
/// claim (`FieldNotInserted`), and the flow insertion's item claim
/// (`ItemNotInserted`).
#[test]
fn a_candidate_that_says_the_wrong_thing_inside_its_span_fails_the_oracle() {
    type Refusal = fn(&VerificationFailure) -> bool;
    let cases: [(&str, DocumentEdit, &str, &str, Refusal); 2] = [
        (
            "grouped insertion",
            FieldInsertGroup::new(item(0), vec![("label".to_owned(), "L".to_owned())])
                .expect("one entry")
                .into(),
            "label: L",
            "label: M",
            |failure| {
                matches!(
                    failure,
                    VerificationFailure::FieldNotInserted { edit: 0, .. }
                )
            },
        ),
        (
            "flow list insertion",
            ScalarItemInsert::new(
                item(0).with_key("search_terms"),
                ItemPlacement::Front,
                vec!["gamma".to_owned()],
            )
            .expect("one value")
            .into(),
            "gamma",
            "gammb",
            |failure| {
                matches!(
                    failure,
                    VerificationFailure::ItemNotInserted { edit: 0, .. }
                )
            },
        ),
    ];
    for (what, edit, from, to, expected) in cases {
        let edits = [edit];
        let honest = candidate_through(SOURCE, &edits, |_| {}, |_| {});
        assert!(
            honest.is_ok(),
            "{what}: the honest run verifies: {honest:?}"
        );
        let mut rewrote = false;
        let result = candidate_through(
            SOURCE,
            &edits,
            |replacements| {
                for replacement in replacements.iter_mut() {
                    if replacement.text.contains(from) {
                        replacement.text = replacement.text.replace(from, to);
                        rewrote = true;
                    }
                }
            },
            |_| {},
        );
        assert!(rewrote, "{what}: the planned text holds {from:?}");
        assert!(
            matches!(&result, Err(EditError::Verification(failure)) if expected(failure)),
            "{what}: the planner's own expectation refuses the candidate, got {result:?}"
        );
    } // End of the loop over the inside-the-span cases
} // End of function a_candidate_that_says_the_wrong_thing_inside_its_span_fails_the_oracle()
