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
                    items: group.item_list(),
                    mappings: group.mappings(),
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
    touched.extend(sequences.iter().map(|claim| claim.sequence_id));
    let mut changed = rewritten.clone();
    changed.extend(sequences.iter().map(|claim| claim.sequence_id));
    // The Phase 4-3 review fix's line of `apply_edits`, mirrored since Phase
    // 4-6, whose batches are the first here to change a nested mapping beside
    // an insertion into its parent.
    changed.extend(expectations.iter().map(|claim| claim.mapping_id));
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

// ---------------------------------------------------------------------------
// Phase 4-1: an inserted item's plain-source exemption is exactly as wide as
// its requested entries
// ---------------------------------------------------------------------------

/// A new snippet whose `word` is requested as plain source text `true`, beside
/// the logical-string entries `extra` names.
fn plain_word_item(placement: ItemPlacement, extra: Vec<(String, EntryValue)>) -> DocumentEdit {
    let mut fields = vec![("trigger".to_owned(), EntryValue::Scalar(":x".to_owned()))];
    fields.extend(extra);
    fields.push((
        "word".to_owned(),
        EntryValue::PlainSource("true".to_owned()),
    ));
    InsertItem::typed(DocumentPath::root(0).with_key("matches"), placement, fields).into()
} // End of function plain_word_item()

/// Runs `edits` through the mirror with every planned replacement text that
/// holds `from` rewritten to hold `to` instead, and says whether one did.
fn rewritten_through(
    edits: &[DocumentEdit],
    from: &str,
    to: &str,
) -> (bool, Result<String, EditError>) {
    let mut rewrote = false;
    let result = candidate_through(
        SOURCE,
        edits,
        |replacements| {
            for replacement in replacements.iter_mut() {
                if replacement.text.contains(from) {
                    replacement.text = replacement.text.replacen(from, to, 1);
                    rewrote = true;
                }
            }
        },
        |_| {},
    );
    (rewrote, result)
} // End of function rewritten_through()

/// Whether `result` is the ambiguity property's refusal.
fn refused_as_ambiguous(result: &Result<String, EditError>) -> bool {
    matches!(
        result,
        Err(EditError::Verification(
            VerificationFailure::AmbiguousPlainScalarIntroduced { .. }
        ))
    )
}

/// The honest run: an inserted item whose requested `word` is the ambiguous
/// plain scalar `true` verifies, is `apply_edits`' own candidate, and holds the
/// option exactly as typed — the exemption reaches the requested value node.
#[test]
fn an_inserted_items_requested_plain_source_is_exempted() {
    let edits = [plain_word_item(
        ItemPlacement::End,
        vec![("replace".to_owned(), EntryValue::Scalar("yes".to_owned()))],
    )];
    let honest =
        candidate_through(SOURCE, &edits, |_| {}, |_| {}).expect("the honest run verifies");
    let applied = apply_edits(SOURCE, &edits).expect("apply_edits accepts it");
    assert_eq!(honest, applied.text);
    assert!(
        honest.contains("    replace: 'yes'\n    word: true\n"),
        "{honest}"
    );
} // End of function an_inserted_items_requested_plain_source_is_exempted()

/// **The decisive negative test** (`docs/decisions/4-split-notes.md` §3 ruling
/// 3): the requested option is correct, and a neighbouring ordinary string value
/// of the same item is corrupted into an ambiguous plain scalar. The candidate is
/// refused — the exemption covers the requested value node and not its item.
#[test]
fn a_corrupted_neighbour_of_an_exempted_option_is_still_refused() {
    let edits = [plain_word_item(
        ItemPlacement::End,
        vec![("replace".to_owned(), EntryValue::Scalar("yes".to_owned()))],
    )];
    let (rewrote, result) = rewritten_through(&edits, "replace: 'yes'", "replace: yes");
    assert!(rewrote, "the planned text quotes the neighbour");
    assert!(refused_as_ambiguous(&result), "{result:?}");
} // End of function a_corrupted_neighbour_of_an_exempted_option_is_still_refused()

/// The same text `true` in a **key**, in a **sibling inserted item** and in a
/// **scalar-list element** receives no exemption: each is requested as a logical
/// string, corrupted from its quoted spelling into the plain `true`, and refused
/// by the ambiguity property itself — before any later check could name it —
/// while the item's own requested `word: true` stays exempt.
#[test]
fn equal_text_outside_the_requested_entry_receives_no_exemption() {
    let sequence = || DocumentPath::root(0).with_key("matches");
    let cases: [(&str, Vec<DocumentEdit>, &str, &str); 3] = [
        (
            "a key",
            vec![plain_word_item(
                ItemPlacement::End,
                vec![("true".to_owned(), EntryValue::Scalar("k".to_owned()))],
            )],
            "    'true': k\n",
            "    true: k\n",
        ),
        (
            "a sibling item",
            vec![
                plain_word_item(ItemPlacement::Front, Vec::new()),
                InsertItem::typed(
                    sequence(),
                    ItemPlacement::End,
                    vec![
                        ("trigger".to_owned(), EntryValue::Scalar(":y".to_owned())),
                        ("replace".to_owned(), EntryValue::Scalar("true".to_owned())),
                    ],
                )
                .into(),
            ],
            "replace: 'true'",
            "replace: true",
        ),
        (
            "a scalar-list element",
            vec![plain_word_item(
                ItemPlacement::End,
                vec![(
                    "search_terms".to_owned(),
                    EntryValue::ScalarList(vec!["true".to_owned()]),
                )],
            )],
            "- 'true'",
            "- true",
        ),
    ];
    for (what, edits, from, to) in cases {
        let honest = candidate_through(SOURCE, &edits, |_| {}, |_| {});
        let applied = apply_edits(SOURCE, &edits).map(|patched| patched.text);
        assert_eq!(honest, applied, "{what}: the honest run is apply_edits'");
        assert!(
            honest.is_ok(),
            "{what}: the honest run verifies: {honest:?}"
        );
        let (rewrote, result) = rewritten_through(&edits, from, to);
        assert!(rewrote, "{what}: the planned text holds {from:?}");
        assert!(refused_as_ambiguous(&result), "{what}: {result:?}");
    } // End of the loop over the places the same text must not be exempted
} // End of function equal_text_outside_the_requested_entry_receives_no_exemption()

/// Several inserted items and a removal in one batch shift every candidate
/// index: each item's requested plain-source values are still found at their
/// own positions (the honest run verifies), and a corrupted neighbour inside the
/// **second** inserted item — the one whose candidate index the removal and the
/// first insertion both moved — is still refused.
#[test]
fn several_inserted_items_and_shifted_indices_keep_the_exemption_exact() {
    let sequence = || DocumentPath::root(0).with_key("matches");
    let second = InsertItem::typed(
        sequence(),
        ItemPlacement::End,
        vec![
            ("trigger".to_owned(), EntryValue::Scalar(":z".to_owned())),
            ("replace".to_owned(), EntryValue::Scalar("no".to_owned())),
            (
                "paragraph".to_owned(),
                EntryValue::PlainSource("false".to_owned()),
            ),
            (
                "force_clipboard".to_owned(),
                EntryValue::PlainSource("on".to_owned()),
            ),
        ],
    );
    let edits = [
        plain_word_item(ItemPlacement::Front, Vec::new()),
        RemoveItem::new(item(1)).into(),
        second.into(),
    ];
    let honest = candidate_through(SOURCE, &edits, |_| {}, |_| {});
    let applied = apply_edits(SOURCE, &edits).map(|patched| patched.text);
    assert_eq!(honest, applied, "the honest run is apply_edits'");
    let honest = honest.expect("the honest run verifies");
    assert!(honest.contains("    word: true\n"), "{honest}");
    assert!(
        honest.contains("    replace: 'no'\n    paragraph: false\n    force_clipboard: on\n"),
        "{honest}"
    );

    let (rewrote, result) = rewritten_through(&edits, "replace: 'no'", "replace: no");
    assert!(rewrote, "the planned text quotes the neighbour");
    assert!(refused_as_ambiguous(&result), "{result:?}");
} // End of function several_inserted_items_and_shifted_indices_keep_the_exemption_exact()

// ---------------------------------------------------------------------------
// Phase 4-4: a new variable's nested mapping and a new `vars:` subtree are
// verified by their own expectations, not by trusting the renderer
// ---------------------------------------------------------------------------

/// A neutral file with one block `vars` and one match without `vars`.
const VARS_SOURCE: &str = concat!(
    "matches:\n",
    "  - trigger: ':v'\n",
    "    replace: x\n",
    "    vars:\n",
    "      - name: a\n",
    "        type: echo\n",
    "        params:\n",
    "          echo: b\n",
    "  - trigger: ':w'\n",
    "    replace: y\n",
);

/// A new `shell` variable whose `params` holds the logical string `true` under
/// `cmd` and the requested plain source `true` under `trim`.
fn new_shell_variable() -> Vec<(String, ItemValue)> {
    vec![
        (
            "name".to_owned(),
            ItemValue::Entry(EntryValue::Scalar("s".to_owned())),
        ),
        (
            "type".to_owned(),
            ItemValue::Entry(EntryValue::Scalar("shell".to_owned())),
        ),
        (
            "params".to_owned(),
            ItemValue::flat(vec![
                ("cmd".to_owned(), EntryValue::Scalar("true".to_owned())),
                (
                    "trim".to_owned(),
                    EntryValue::PlainSource("true".to_owned()),
                ),
            ]),
        ),
    ]
} // End of function new_shell_variable()

/// The two Phase 4-4 batches: a new variable in an existing `vars`, and a new
/// `vars:` subtree as a group's trailing item list.
fn phase_four_four_batches() -> Vec<(&'static str, Vec<DocumentEdit>)> {
    let into_vars = InsertItem::nested(
        item(0).with_key("vars"),
        ItemPlacement::End,
        new_shell_variable(),
    );
    let subtree = FieldInsertGroup::with_item_list(
        item(1),
        Some("replace".to_owned()),
        Vec::new(),
        "vars",
        vec![new_shell_variable()],
    )
    .expect("one item");
    vec![
        ("a new variable", vec![into_vars.into()]),
        ("a new vars subtree", vec![subtree.into()]),
    ]
} // End of function phase_four_four_batches()

/// Runs `edits` over [`VARS_SOURCE`] with every planned replacement text holding
/// `from` rewritten once to hold `to`, and says whether one did.
fn rewritten_over_vars(
    edits: &[DocumentEdit],
    from: &str,
    to: &str,
) -> (bool, Result<String, EditError>) {
    let mut rewrote = false;
    let result = candidate_through(
        VARS_SOURCE,
        edits,
        |replacements| {
            for replacement in replacements.iter_mut() {
                if replacement.text.contains(from) {
                    replacement.text = replacement.text.replacen(from, to, 1);
                    rewrote = true;
                }
            }
        },
        |_| {},
    );
    (rewrote, result)
} // End of function rewritten_over_vars()

/// The honest runs verify, are `apply_edits`' own candidates, and write the
/// requested plain source verbatim beside the quoted logical string.
#[test]
fn a_new_variables_honest_candidate_verifies() {
    for (what, edits) in phase_four_four_batches() {
        let honest = candidate_through(VARS_SOURCE, &edits, |_| {}, |_| {});
        let applied = apply_edits(VARS_SOURCE, &edits).map(|patched| patched.text);
        assert_eq!(honest, applied, "{what}: the honest run is apply_edits'");
        let honest = honest.expect("the honest run verifies");
        assert!(
            honest.contains("        params:\n          cmd: 'true'\n          trim: true\n"),
            "{what}: {honest}"
        );
    } // End of the loop over the Phase 4-4 batches
} // End of function a_new_variables_honest_candidate_verifies()

/// Each corruption changes only bytes inside the planned replacement, so the
/// byte oracle cannot see it; the nested expectation must.
#[test]
fn a_corrupted_nested_value_or_shape_is_refused_by_its_own_verifier() {
    let cases: [(&str, &str, &str); 5] = [
        // A neighbouring string turned into an ambiguous plain scalar: only the
        // requested `trim` node is exempt.
        ("ambiguous neighbour", "cmd: 'true'", "cmd: true"),
        // A nested value that says something else.
        ("wrong nested value", "cmd: 'true'", "cmd: 'false'"),
        // A nested entry dedented out of `params`, into the variable itself.
        (
            "dedented entry",
            "          trim: true\n",
            "        trim: true\n",
        ),
        // The nested mapping rewritten in flow style.
        (
            "flow mapping",
            "params:\n          cmd: 'true'\n          trim: true\n",
            "params: {cmd: 'true', trim: true}\n",
        ),
        // The plain-source setting quoted into a string.
        ("quoted setting", "trim: true", "trim: 'true'"),
    ];
    for (batch, edits) in phase_four_four_batches() {
        for (what, from, to) in cases {
            let (rewrote, result) = rewritten_over_vars(&edits, from, to);
            assert!(rewrote, "{batch}, {what}: the planned text holds {from:?}");
            assert!(
                matches!(result, Err(EditError::Verification(_))),
                "{batch}, {what}: refused by verification, got {result:?}"
            );
        } // End of the loop over the corruptions
    } // End of the loop over the Phase 4-4 batches
} // End of function a_corrupted_nested_value_or_shape_is_refused_by_its_own_verifier()

/// A new `vars:` subtree whose sequence is corrupted — emptied into `[]` with
/// its item moved under another key, or an item saying something else — is
/// refused by the item-list verifier.
#[test]
fn a_corrupted_new_vars_sequence_is_refused() {
    let edits = &phase_four_four_batches()[1].1;
    let (rewrote, result) = rewritten_over_vars(edits, "    vars:\n", "    vars: []\n    other:\n");
    assert!(rewrote);
    assert!(
        matches!(result, Err(EditError::Verification(_))),
        "{result:?}"
    );
    let (rewrote, result) = rewritten_over_vars(edits, "name: s", "name: t");
    assert!(rewrote);
    assert!(
        matches!(result, Err(EditError::Verification(_))),
        "{result:?}"
    );
} // End of function a_corrupted_new_vars_sequence_is_refused()

// ---------------------------------------------------------------------------
// Phase 4-4 review fix: a removed ambiguous scalar must not pay for a corrupted
// insertion of one
// ---------------------------------------------------------------------------

/// Two variables, the first holding the pre-existing plain `trim: true` inside
/// a `params` whose other entry is `a: one`.
const BALANCED_SOURCE: &str = concat!(
    "matches:\n",
    "  - trigger: ':v'\n",
    "    replace: x\n",
    "    vars:\n",
    "      - name: s\n",
    "        type: shell\n",
    "        params:\n",
    "          trim: true\n",
    "          a: one\n",
    "      - name: e\n",
    "        type: echo\n",
    "        params:\n",
    "          echo: b\n",
);

/// Runs `edits` over [`BALANCED_SOURCE`] with the planned text holding `from`
/// rewritten once to `to`; answers whether one did, and the result.
fn rewritten_over_balanced(
    edits: &[DocumentEdit],
    from: &str,
    to: &str,
) -> (bool, Result<String, EditError>) {
    let mut rewrote = false;
    let result = candidate_through(
        BALANCED_SOURCE,
        edits,
        |replacements| {
            for replacement in replacements.iter_mut() {
                if replacement.text.contains(from) {
                    replacement.text = replacement.text.replacen(from, to, 1);
                    rewrote = true;
                }
            }
        },
        |_| {},
    );
    (rewrote, result)
} // End of function rewritten_over_balanced()

/// The review's scenario: the variable holding `trim: true` is removed and a new
/// `echo` variable whose logical string is `true` is appended in the same batch.
/// Rendered plain, the new `true` is balanced in the whole-document budget by the
/// removed one, so only a check of the **inserted** text can refuse it.
#[test]
fn a_removed_ambiguous_scalar_does_not_pay_for_a_corrupted_new_variable() {
    let vars = item(0).with_key("vars");
    let edits: Vec<DocumentEdit> = vec![
        RemoveItem::new(vars.clone().with_index(0)).into(),
        InsertItem::nested(
            vars,
            ItemPlacement::End,
            vec![
                (
                    "name".to_owned(),
                    ItemValue::Entry(EntryValue::Scalar("n".to_owned())),
                ),
                (
                    "type".to_owned(),
                    ItemValue::Entry(EntryValue::Scalar("echo".to_owned())),
                ),
                (
                    "params".to_owned(),
                    ItemValue::flat(vec![(
                        "echo".to_owned(),
                        EntryValue::Scalar("true".to_owned()),
                    )]),
                ),
            ],
        )
        .into(),
    ];
    let honest = candidate_through(BALANCED_SOURCE, &edits, |_| {}, |_| {});
    assert_eq!(
        honest,
        apply_edits(BALANCED_SOURCE, &edits).map(|patched| patched.text),
        "the honest run is apply_edits'"
    );
    assert!(honest.is_ok(), "{honest:?}");
    let (rewrote, result) = rewritten_over_balanced(&edits, "echo: 'true'", "echo: true");
    assert!(rewrote, "the planned text quotes the new value");
    assert!(refused_as_ambiguous(&result), "{result:?}");
} // End of function a_removed_ambiguous_scalar_does_not_pay_for_a_corrupted_new_variable()

/// The same blind spot on Phase 4-3's path: a new author-named `params` entry
/// whose logical string is `true`, beside the removal of the existing plain
/// `trim: true` of the same mapping.
#[test]
fn a_removed_ambiguous_scalar_does_not_pay_for_a_corrupted_new_param() {
    let params = item(0).with_key("vars").with_index(0).with_key("params");
    let edits: Vec<DocumentEdit> = vec![
        FieldRemoval::new(params.clone().with_key("trim")).into(),
        FieldInsertGroup::typed(
            params,
            Some("a".to_owned()),
            vec![("flag".to_owned(), EntryValue::Scalar("true".to_owned()))],
        )
        .expect("one entry")
        .into(),
    ];
    let honest = candidate_through(BALANCED_SOURCE, &edits, |_| {}, |_| {});
    assert_eq!(
        honest,
        apply_edits(BALANCED_SOURCE, &edits).map(|patched| patched.text),
        "the honest run is apply_edits'"
    );
    assert!(honest.is_ok(), "{honest:?}");
    let (rewrote, result) = rewritten_over_balanced(&edits, "flag: 'true'", "flag: true");
    assert!(rewrote, "the planned text quotes the new value");
    assert!(refused_as_ambiguous(&result), "{result:?}");
} // End of function a_removed_ambiguous_scalar_does_not_pay_for_a_corrupted_new_param()

// ---------------------------------------------------------------------------
// Phase 4-5: a variable's nested lists — several new records at one boundary,
// strings in a nested block list and in a nested flow list, and a record's
// rewritten label — are verified by expectations, not by trusting the renderer
// ---------------------------------------------------------------------------

/// A neutral file with a `choice` variable holding a block `depends_on` and a
/// block list of records, and a `random` one holding flow lists.
const LIST_SOURCE: &str = concat!(
    "matches:\n",
    "  - trigger: ':l'\n",
    "    replace: x\n",
    "    vars:\n",
    "      - name: c\n",
    "        type: choice\n",
    "        depends_on:\n",
    "          - a\n",
    "        params:\n",
    "          values:\n",
    "            - label: One\n",
    "              id: one\n",
    "      - name: r\n",
    "        type: random\n",
    "        depends_on: [c]\n",
    "        params:\n",
    "          choices: [p, q]\n",
);

/// The path of variable `index` of the one match of [`LIST_SOURCE`].
fn list_variable(index: usize) -> DocumentPath {
    item(0).with_key("vars").with_index(index)
}

/// One new `{label, id}` record.
fn new_record(label: &str, id: &str) -> Vec<(String, ItemValue)> {
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
} // End of function new_record()

/// The Phase 4-5 batches, labelled.
fn phase_four_five_batches() -> Vec<(&'static str, Vec<DocumentEdit>)> {
    let values = list_variable(0).with_key("params").with_key("values");
    let records = InsertItem::several(
        values.clone(),
        ItemPlacement::End,
        vec![new_record("Two", "true"), new_record("Three", "three")],
    )
    .expect("two records");
    let depends_on = ScalarItemInsert::new(
        list_variable(0).with_key("depends_on"),
        ItemPlacement::End,
        vec!["b".to_owned(), "true".to_owned()],
    )
    .expect("two values");
    let flow = ScalarItemInsert::new(
        list_variable(1).with_key("params").with_key("choices"),
        ItemPlacement::End,
        vec!["yes".to_owned()],
    )
    .expect("one value");
    let label = ScalarEdit::new(values.with_index(0).with_key("label"), "Uno");
    vec![
        ("several records", vec![records.into()]),
        ("nested block strings", vec![depends_on.into()]),
        ("nested flow strings", vec![flow.into()]),
        ("a record's label", vec![label.into()]),
    ]
} // End of function phase_four_five_batches()

/// Runs `edits` over [`LIST_SOURCE`] with the planned text holding `from`
/// rewritten once to `to`; answers whether one did, and the result.
fn rewritten_over_lists(
    edits: &[DocumentEdit],
    from: &str,
    to: &str,
) -> (bool, Result<String, EditError>) {
    let mut rewrote = false;
    let result = candidate_through(
        LIST_SOURCE,
        edits,
        |replacements| {
            for replacement in replacements.iter_mut() {
                if replacement.text.contains(from) {
                    replacement.text = replacement.text.replacen(from, to, 1);
                    rewrote = true;
                }
            }
        },
        |_| {},
    );
    (rewrote, result)
} // End of function rewritten_over_lists()

/// The honest runs verify and are `apply_edits`' own candidates.
#[test]
fn a_nested_lists_honest_candidate_verifies() {
    for (what, edits) in phase_four_five_batches() {
        let honest = candidate_through(LIST_SOURCE, &edits, |_| {}, |_| {});
        let applied = apply_edits(LIST_SOURCE, &edits).map(|patched| patched.text);
        assert_eq!(honest, applied, "{what}: the honest run is apply_edits'");
        let honest = honest.unwrap_or_else(|error| panic!("{what}: verifies: {error:?}"));
        assert_ne!(honest, LIST_SOURCE, "{what}: the batch changes something");
    } // End of the loop over the Phase 4-5 batches
    let records = &phase_four_five_batches()[0].1;
    let text = apply_edits(LIST_SOURCE, records).expect("applies").text;
    assert!(
        text.contains(concat!(
            "            - label: One\n",
            "              id: one\n",
            "            - label: Two\n",
            "              id: 'true'\n",
            "            - label: Three\n",
            "              id: three\n",
        )),
        "{text}"
    );
} // End of function a_nested_lists_honest_candidate_verifies()

/// Each corruption changes only bytes inside the planned replacement, so the
/// byte oracle cannot see it; the item expectations, the scalar expectation or
/// the inserted-text ambiguity property must.
#[test]
fn a_corrupted_nested_list_item_is_refused_by_verification() {
    let cases: [(usize, &str, &str, &str); 12] = [
        // Several records.
        (
            0,
            "record as a flow mapping",
            "            - label: Three\n              id: three\n",
            "            - {label: Three, id: three}\n",
        ),
        (0, "ambiguous id", "id: 'true'", "id: true"),
        (0, "wrong label", "label: Three", "label: Tres"),
        (
            0,
            "second record dropped",
            "            - label: Three\n              id: three\n",
            "",
        ),
        (
            0,
            "record gains an entry",
            "              id: three\n",
            "              id: three\n              more: m\n",
        ),
        (
            0,
            "records swapped",
            "label: Two\n              id: 'true'\n            - label: Three\n              id: three",
            "label: Three\n              id: three\n            - label: Two\n              id: 'true'",
        ),
        (
            0,
            "record as a string",
            "            - label: Three\n              id: three\n",
            "            - Three\n",
        ),
        // Strings in a nested block list.
        (1, "ambiguous string", "- 'true'", "- true"),
        (1, "wrong string", "- b\n", "- d\n"),
        // A string in a nested flow list.
        (2, "ambiguous flow string", "'yes'", "yes"),
        // A record's rewritten label.
        (3, "wrong label value", "Uno", "Una"),
        (3, "ambiguous label value", "Uno", "yes"),
    ];
    let batches = phase_four_five_batches();
    for (batch, what, from, to) in cases {
        let (label, edits) = &batches[batch];
        let (rewrote, result) = rewritten_over_lists(edits, from, to);
        assert!(rewrote, "{label}, {what}: the planned text holds {from:?}");
        assert!(
            matches!(result, Err(EditError::Verification(_))),
            "{label}, {what}: refused by verification, got {result:?}"
        );
    } // End of the loop over the corruptions
} // End of function a_corrupted_nested_list_item_is_refused_by_verification()

/// **Regression (Phase 4-5): a new item's own mapping must be block style.**
/// Ruling 8 writes a new non-empty collection in block style, and
/// `verify_item_value` already held a nested mapping to it, but the item
/// mapping itself was checked for its keys and values only: a candidate whose
/// new item was rewritten as a flow mapping, saying the same thing, verified.
/// Pre-existing API only — one new snippet in `matches` — so the test runs
/// unchanged against the tree before the fix.
#[test]
fn a_new_item_rewritten_as_a_flow_mapping_is_refused() {
    let edits: Vec<DocumentEdit> = vec![InsertItem::at(
        DocumentPath::root(0).with_key("matches"),
        ItemPlacement::End,
        vec![
            ("trigger".to_owned(), ":n".to_owned()),
            ("replace".to_owned(), "new".to_owned()),
        ],
    )
    .into()];
    let honest = candidate_through(SOURCE, &edits, |_| {}, |_| {});
    assert!(honest.is_ok(), "the honest run verifies: {honest:?}");
    let mut rewrote = false;
    let result = candidate_through(
        SOURCE,
        &edits,
        |replacements| {
            for replacement in replacements.iter_mut() {
                let from = "  - trigger: ':n'\n    replace: new\n";
                if replacement.text.contains(from) {
                    replacement.text =
                        replacement
                            .text
                            .replacen(from, "  - {trigger: ':n', replace: new}\n", 1);
                    rewrote = true;
                }
            }
        },
        |_| {},
    );
    assert!(rewrote, "the planned text holds the new item");
    assert!(
        matches!(result, Err(EditError::Verification(_))),
        "a flow-style new item is refused by verification, got {result:?}"
    );
} // End of function a_new_item_rewritten_as_a_flow_mapping_is_refused()

// ---------------------------------------------------------------------------
// Phase 4-6: mapping-valued group entries and nested definitions
// ---------------------------------------------------------------------------

/// A shorthand form with one definition, a shorthand form with none, and a match
/// with a `vars` to receive a new verbose form.
const FORM_SOURCE: &str = concat!(
    "matches:\n",
    "  - trigger: ':f'\n",
    "    form: 'x'\n",
    "    form_fields:\n",
    "      a:\n",
    "        type: text\n",
    "  - trigger: ':g'\n",
    "    form: 'y'\n",
    "  - trigger: ':v'\n",
    "    replace: z\n",
    "    vars:\n",
    "      - name: e\n",
    "        type: echo\n",
    "        params:\n",
    "          echo: b\n",
);

/// One new definition's options: the logical string `true` under `type`, the
/// requested plain source `true` under `multiline`, and a one-item list.
fn new_definition() -> Vec<(String, ItemValue)> {
    vec![
        (
            "type".to_owned(),
            ItemValue::Entry(EntryValue::Scalar("true".to_owned())),
        ),
        (
            "multiline".to_owned(),
            ItemValue::Entry(EntryValue::PlainSource("true".to_owned())),
        ),
        (
            "values".to_owned(),
            ItemValue::Entry(EntryValue::ScalarList(vec!["x".to_owned()])),
        ),
    ]
} // End of function new_definition()

/// The three Phase 4-6 batches: a definition into an existing `form_fields`, a
/// whole new `form_fields:` as a mapping-valued entry of a match-level group,
/// and a new verbose form variable whose `params` holds `fields`.
fn phase_four_six_batches() -> Vec<(&'static str, Vec<DocumentEdit>)> {
    let into = FieldInsertGroup::of_mappings(
        item(0).with_key("form_fields"),
        Some("a".to_owned()),
        vec![("d".to_owned(), new_definition())],
    )
    .expect("one definition");
    let whole = FieldInsertGroup::of_mappings(
        item(1),
        Some("form".to_owned()),
        vec![(
            "form_fields".to_owned(),
            vec![("d".to_owned(), ItemValue::Mapping(new_definition()))],
        )],
    )
    .expect("one entry");
    let variable = InsertItem::nested(
        item(2).with_key("vars"),
        ItemPlacement::End,
        vec![
            (
                "name".to_owned(),
                ItemValue::Entry(EntryValue::Scalar("f".to_owned())),
            ),
            (
                "type".to_owned(),
                ItemValue::Entry(EntryValue::Scalar("form".to_owned())),
            ),
            (
                "params".to_owned(),
                ItemValue::Mapping(vec![
                    (
                        "layout".to_owned(),
                        ItemValue::Entry(EntryValue::Scalar("[[d]]".to_owned())),
                    ),
                    (
                        "fields".to_owned(),
                        ItemValue::Mapping(vec![(
                            "d".to_owned(),
                            ItemValue::Mapping(new_definition()),
                        )]),
                    ),
                ]),
            ),
        ],
    );
    vec![
        ("a definition into form_fields", vec![into.into()]),
        ("a whole new form_fields", vec![whole.into()]),
        ("a new verbose form", vec![variable.into()]),
    ]
} // End of function phase_four_six_batches()

/// Runs `edits` over [`FORM_SOURCE`] with the planned text holding `from`
/// rewritten once to `to`; answers whether one did, and the result.
fn rewritten_over_forms(
    edits: &[DocumentEdit],
    from: &str,
    to: &str,
) -> (bool, Result<String, EditError>) {
    let mut rewrote = false;
    let result = candidate_through(
        FORM_SOURCE,
        edits,
        |replacements| {
            for replacement in replacements.iter_mut() {
                if replacement.text.contains(from) {
                    replacement.text = replacement.text.replacen(from, to, 1);
                    rewrote = true;
                }
            }
        },
        |_| {},
    );
    (rewrote, result)
} // End of function rewritten_over_forms()

/// The honest runs verify, are `apply_edits`' own candidates, and write the
/// requested plain source verbatim beside the quoted logical string, at every
/// depth.
#[test]
fn a_new_definitions_honest_candidate_verifies() {
    for (what, edits) in phase_four_six_batches() {
        let honest = candidate_through(FORM_SOURCE, &edits, |_| {}, |_| {});
        let applied = apply_edits(FORM_SOURCE, &edits).map(|patched| patched.text);
        assert_eq!(honest, applied, "{what}: the honest run is apply_edits'");
        let honest = honest.expect("the honest run verifies");
        assert!(
            honest.contains("  type: 'true'\n") && honest.contains("  multiline: true\n"),
            "{what}: {honest}"
        );
    } // End of the loop over the Phase 4-6 batches
} // End of function a_new_definitions_honest_candidate_verifies()

/// Each corruption changes only bytes inside the planned replacement, so the
/// byte oracle cannot see it; the nested expectation of a mapping-valued group
/// entry, or of a definition nested three mappings deep in a new item, must.
#[test]
fn a_corrupted_definition_is_refused_by_its_own_verifier() {
    let cases: [(&str, &str, &str); 7] = [
        // A string turned into an ambiguous plain scalar: only the requested
        // `multiline` node is exempt.
        ("ambiguous neighbour", "type: 'true'", "type: true"),
        // A nested value that says something else.
        ("wrong nested value", "type: 'true'", "type: 'false'"),
        // The plain-source setting quoted into a string.
        ("quoted setting", "multiline: true", "multiline: 'true'"),
        // An option dedented out of the definition, into its parent.
        (
            "dedented option",
            "  multiline: true\n",
            "multiline: true\n",
        ),
        // A list item that says something else.
        ("wrong list item", "- x\n", "- y\n"),
        // The definition written between braces, saying the same thing.
        (
            "flow definition",
            "d:\n",
            "d: {type: 'true', multiline: true, values: [x]}\nzz:\n",
        ),
        // An extra option inside the definition.
        (
            "extra option",
            "  multiline: true\n",
            "  multiline: true\n  more: m\n",
        ),
    ];
    for (batch, edits) in phase_four_six_batches() {
        for (what, from, to) in cases {
            let (rewrote, result) = rewritten_over_forms(&edits, from, to);
            assert!(rewrote, "{batch}, {what}: the planned text holds {from:?}");
            assert!(
                matches!(result, Err(EditError::Verification(_))),
                "{batch}, {what}: refused by verification, got {result:?}"
            );
        } // End of the loop over the corruptions
    } // End of the loop over the Phase 4-6 batches
} // End of function a_corrupted_definition_is_refused_by_its_own_verifier()

/// A removed ambiguous plain scalar elsewhere in the batch does not pay for a
/// corrupted one inside a new definition (the Phase 4-4 review's property,
/// stated for the Phase 4-6 shapes).
#[test]
fn a_removed_ambiguous_scalar_does_not_pay_for_a_corrupted_definition() {
    let source = concat!(
        "matches:\n",
        "  - trigger: ':f'\n",
        "    form: 'x'\n",
        "    form_fields:\n",
        "      a:\n",
        "        type: text\n",
        "        multiline: true\n",
    );
    let edits: Vec<DocumentEdit> = vec![
        FieldRemoval::new(
            item(0)
                .with_key("form_fields")
                .with_key("a")
                .with_key("multiline"),
        )
        .into(),
        FieldInsertGroup::of_mappings(
            item(0).with_key("form_fields"),
            Some("a".to_owned()),
            vec![(
                "d".to_owned(),
                vec![(
                    "default".to_owned(),
                    ItemValue::Entry(EntryValue::Scalar("true".to_owned())),
                )],
            )],
        )
        .expect("one")
        .into(),
    ];
    let honest = candidate_through(source, &edits, |_| {}, |_| {});
    assert!(honest.is_ok(), "the honest run verifies: {honest:?}");
    let mut rewrote = false;
    let result = candidate_through(
        source,
        &edits,
        |replacements| {
            for replacement in replacements.iter_mut() {
                if replacement.text.contains("default: 'true'") {
                    replacement.text = replacement.text.replacen("'true'", "true", 1);
                    rewrote = true;
                }
            }
        },
        |_| {},
    );
    assert!(rewrote);
    assert!(
        matches!(result, Err(EditError::Verification(_))),
        "the corrupted definition is refused, got {result:?}"
    );
} // End of function a_removed_ambiguous_scalar_does_not_pay_for_a_corrupted_definition()

/// **Regression (Phase 4-6 review, second finding):** a mapping-valued group
/// entry reached rendering without the inserted-key rules, so a direct core
/// caller could write a definition holding a duplicate, an empty or a
/// line-breaking key. Every depth is checked now; an empty mapping stays legal.
#[test]
fn a_mapping_valued_group_entry_is_held_to_the_inserted_key_rules() {
    let scalar = |text: &str| ItemValue::Entry(EntryValue::Scalar(text.to_owned()));
    let group = |fields: Vec<(String, ItemValue)>| -> Vec<DocumentEdit> {
        vec![FieldInsertGroup::of_mappings(
            item(0).with_key("form_fields"),
            Some("a".to_owned()),
            vec![("d".to_owned(), fields)],
        )
        .expect("one")
        .into()]
    };
    let duplicate = vec![
        ("type".to_owned(), scalar("x")),
        ("type".to_owned(), scalar("y")),
    ];
    assert_eq!(
        apply_edits(FORM_SOURCE, &group(duplicate)).map(|patched| patched.text),
        Err(EditError::DuplicateInsertedField { edit: 0, field: 0 })
    );
    for key in ["", "a\nb", "a\rb"] {
        assert_eq!(
            apply_edits(FORM_SOURCE, &group(vec![(key.to_owned(), scalar("x"))]))
                .map(|patched| patched.text),
            Err(EditError::InvalidInsertedFieldKey { edit: 0, field: 0 }),
            "{key:?}"
        );
    }
    // One level deeper: a whole `form_fields:` whose definition repeats a key.
    let deep: Vec<DocumentEdit> = vec![FieldInsertGroup::of_mappings(
        item(1),
        Some("form".to_owned()),
        vec![(
            "form_fields".to_owned(),
            vec![(
                "d".to_owned(),
                ItemValue::Mapping(vec![
                    ("type".to_owned(), scalar("x")),
                    ("type".to_owned(), scalar("y")),
                ]),
            )],
        )],
    )
    .expect("one")
    .into()];
    assert_eq!(
        apply_edits(FORM_SOURCE, &deep).map(|patched| patched.text),
        Err(EditError::DuplicateInsertedField { edit: 0, field: 0 })
    );
    // An empty mapping is `{}` and legal.
    let empty = apply_edits(FORM_SOURCE, &group(Vec::new())).expect("an empty definition");
    assert!(empty.text().contains("      d: {}\n"), "{}", empty.text());
} // End of function a_mapping_valued_group_entry_is_held_to_the_inserted_key_rules()
