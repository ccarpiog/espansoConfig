//! Phase 4-4 acceptance: local variable insertion, deletion and movement
//! (`docs/decisions/4-split-notes.md` §2, step 4-4).
//!
//! What this file pins:
//!
//! - all nine kinds have bounded constructors ([`NewVariable`]) and each is
//!   written as its own closed shape, reparses and projects back as that kind;
//! - a new variable plus a content edit applies in **one** batch, both into an
//!   existing `vars` and as a whole new `vars:` subtree;
//! - item-owned comments travel with a removed or moved variable, file-owned
//!   comments stay, and an insertion at the front leaves the first variable's
//!   own leading comment with it;
//! - removing the final variable is refused ([`DraftError::VarsWouldBeEmpty`])
//!   and the whole `vars` goes only through the explicit container removal,
//!   never leaving a null;
//! - a reorder succeeds alone and is refused beside **every** other edit
//!   category with [`EditError::MoveMustBeTheOnlyEditInItsBatch`];
//! - every result reparses and every byte outside the intended span is
//!   unchanged, on hard shapes: block scalars, comments, CRLF, no final newline;
//! - every refusal carries positions and codes, never a name, key or value.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).
//! No protected corpus fixture is read or written.

use espansoconfig_core::draft::{
    check_closed_surface, check_variable_move, plan_match_edits, plan_variable_move, DraftError,
    DraftTarget, ListPlacement, MatchDraft, MatchField, NewParam, NewVariable, NewVariableParams,
    VariableDraft, VariableField, VariableSetting, VarsIntent,
};
use espansoconfig_core::model::DocumentContext;
use espansoconfig_core::model::{MatchView, SequencePresence, VariableKind};
use espansoconfig_core::patch::{
    apply_edits, DocumentEdit, DocumentPath, DuplicateItem, EditError, EntryValue, FieldInsert,
    FieldInsertGroup, FieldRemoval, InsertItem, ItemMove, ItemPlacement, ItemTextReplacement,
    ItemValue, KeySubstitution, RemoveItem, ScalarEdit, ScalarItemInsert, ShapeSwitch,
};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::DocumentId;

/// Four matches: one with a block `vars` whose three variables carry an owned
/// leading comment, a file-owned comment and an inline comment; one with no
/// `vars`; one with a flow `vars`; one with `vars: []`.
const VARS: &str = "\
# Local variables (Phase 4-4). Neutral content only.
matches:
  - trigger: ':one'
    replace: 'a {{first}} b {{second}}'
    vars:
      # Owned by first.
      - name: first
        type: echo
        params:
          echo: alpha

      # A file comment, kept by the blank lines around it.

      # Owned by second.
      - name: second
        type: shell
        params:
          cmd: 'printf x'
          trim: true
      - name: third
        type: echo
        params:
          echo: gamma  # inline on third
  - trigger: ':two'
    search_terms:
      - s
    replace: plain
  - trigger: ':three'
    replace: 'c {{flow}}'
    vars: [{name: flow, type: echo, params: {echo: f}}]
  - trigger: ':four'
    replace: d
    vars: []
";

/// A text no refusal may echo. Every refused name, key and value holds it.
const PRIVATE: &str = "zq-private";

/// Every match of `source`, projected as the workspace projects it.
fn matches_of(source: &str) -> Vec<MatchView> {
    let context = DocumentContext::detached(DocumentId(0), "vars.yml");
    project_source(&context, source).view.matches
}

/// Match `index` of `source`.
fn the_match(source: &str, index: usize) -> MatchView {
    matches_of(source)
        .into_iter()
        .nth(index)
        .expect("the fixture holds the match")
}

/// The path of match `index`.
fn match_path(index: usize) -> DocumentPath {
    DocumentPath::root(0).with_key("matches").with_index(index)
}

/// A draft holding the one `vars` intent `intent`.
fn intending(intent: VarsIntent) -> MatchDraft {
    MatchDraft::new().with_vars_intent(intent)
}

/// A draft inserting `variable` at `at`.
fn inserting(at: ListPlacement, variable: NewVariable) -> MatchDraft {
    intending(VarsIntent::insert(at, variable))
}

/// Plans `draft` against match `index` of `source` and applies it; returns the
/// batch and the patched text.
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

/// Asserts `patched` is `source` with `inserted` written at the one offset
/// where `source` holds `before` followed by `after`.
fn assert_inserted_between(source: &str, patched: &str, before: &str, inserted: &str) {
    let point = source.find(before).expect("the anchor text exists") + before.len();
    let expected = format!("{}{}{}", &source[..point], inserted, &source[point..]);
    assert_eq!(patched, expected);
} // End of function assert_inserted_between()

/// Asserts that neither the JSON, the developer rendering nor the debug
/// rendering of `error` holds [`PRIVATE`].
fn assert_no_text(error: &DraftError) {
    let json = serde_json::to_string(error).expect("a refusal serializes");
    assert!(!json.contains(PRIVATE), "the wire form echoes text: {json}");
    assert!(!error.to_string().contains(PRIVATE));
    assert!(!format!("{error:?}").contains(PRIVATE));
} // End of function assert_no_text()

/// The strings of `items`.
fn strings(items: &[&str]) -> Vec<String> {
    items.iter().map(|item| (*item).to_owned()).collect()
}

// ---------------------------------------------------------------------------
// Construction: all nine kinds
// ---------------------------------------------------------------------------

#[test]
fn all_nine_kinds_have_bounded_constructors_and_project_back_as_themselves() {
    let kinds: [(NewVariable, VariableKind, &[&str]); 9] = [
        (NewVariable::date("n"), VariableKind::Date, &[]),
        (
            NewVariable::choice("n", strings(&["a", "b"])),
            VariableKind::Choice,
            &["values"],
        ),
        (
            NewVariable::random("n", strings(&["x"])),
            VariableKind::Random,
            &["choices"],
        ),
        (NewVariable::clipboard("n"), VariableKind::Clipboard, &[]),
        (NewVariable::echo("n", "e"), VariableKind::Echo, &["echo"]),
        (
            NewVariable::shell("n", "printf y"),
            VariableKind::Shell,
            &["cmd"],
        ),
        (
            NewVariable::script("n", strings(&["/bin/echo", "z"])),
            VariableKind::Script,
            &["args"],
        ),
        (
            NewVariable::form("n", "Name: [[who]]"),
            VariableKind::Form,
            &["layout"],
        ),
        (
            NewVariable::match_reference("n", ":two"),
            VariableKind::Match,
            &["trigger"],
        ),
    ];
    for (variable, kind, keys) in kinds {
        assert_eq!(variable.params.kind(), kind);
        let (edits, patched) = planned(VARS, 0, &inserting(ListPlacement::End {}, variable));
        assert!(
            matches!(edits.as_slice(), [DocumentEdit::InsertItem(_)]),
            "{kind:?}: one item insertion"
        );
        let after = the_match(&patched, 0);
        assert!(after.safely_editable, "{kind:?}: the match stays editable");
        let new = after.vars.get(3).expect("a fourth variable");
        assert_eq!(new.kind, kind);
        assert_eq!(new.name.as_ref().map(|name| name.text.as_str()), Some("n"));
        let written: Vec<&str> = new
            .params
            .iter()
            .filter_map(|field| field.key.as_ref().map(|key| key.text.as_str()))
            .collect();
        assert_eq!(written, keys, "{kind:?}: the kind's own parameters");
        if keys.is_empty() {
            assert_eq!(
                new.params_presence,
                espansoconfig_core::model::MappingPresence::Absent {},
                "{kind:?}: no parameter, no `params:` container"
            );
        }
        // Everything before the insertion point is unchanged.
        let point = VARS.find("  - trigger: ':two'").expect("the next match");
        assert_eq!(&patched[..point], &VARS[..point]);
        assert_eq!(
            &patched[patched.len() - (VARS.len() - point)..],
            &VARS[point..]
        );
    } // End of the loop over the nine kinds
} // End of function all_nine_kinds_have_bounded_constructors_and_project_back_as_themselves()

#[test]
fn a_new_variable_is_written_as_its_exact_block_shape() {
    let variable = NewVariable::new(
        "s",
        NewVariableParams::Shell {
            cmd: "printf y".to_owned(),
            shell: Some("bash".to_owned()),
            trim: Some("true".to_owned()),
            debug: Some("false".to_owned()),
        },
    )
    .with_depends_on(strings(&["first", "second"]))
    .with_inject_vars("false")
    .with_extra_param(NewParam::scalar("note", "yes"))
    .with_extra_param(NewParam::list("extra", Vec::new()));
    let (_, patched) = planned(VARS, 0, &inserting(ListPlacement::End {}, variable));
    assert_inserted_between(
        VARS,
        &patched,
        "          echo: gamma  # inline on third\n",
        "      - name: s
        type: shell
        depends_on:
          - first
          - second
        inject_vars: false
        params:
          cmd: printf y
          shell: bash
          trim: true
          debug: false
          note: 'yes'
          extra: []
",
    );
} // End of function a_new_variable_is_written_as_its_exact_block_shape()

#[test]
fn typed_settings_are_plain_source_and_everything_else_is_a_logical_string() {
    let variable = NewVariable::new(
        "d",
        NewVariableParams::Date {
            format: Some("%Y".to_owned()),
            offset: Some("-86400".to_owned()),
            tz: Some("true".to_owned()),
            locale: None,
        },
    );
    let (_, patched) = planned(VARS, 0, &inserting(ListPlacement::End {}, variable));
    assert!(patched.contains("          offset: -86400\n"), "{patched}");
    // `tz` is a logical string: `true` is quoted rather than typed.
    assert!(patched.contains("          tz: 'true'\n"), "{patched}");
    let after = the_match(&patched, 0);
    let format = after.vars[3].params[0].value.as_scalar().expect("a scalar");
    assert_eq!(format.text, "%Y", "the codec quoted what needed quoting");

    for (variable, setting) in [
        (
            NewVariable::echo("e", "x").with_inject_vars("a #b"),
            VariableSetting::InjectVars,
        ),
        (
            NewVariable::new(
                "d",
                NewVariableParams::Date {
                    format: None,
                    offset: Some(String::new()),
                    tz: None,
                    locale: None,
                },
            ),
            VariableSetting::Offset,
        ),
        (
            NewVariable::new(
                "s",
                NewVariableParams::Script {
                    args: Vec::new(),
                    trim: Some("'true'".to_owned()),
                },
            ),
            VariableSetting::Trim,
        ),
        (
            NewVariable::new(
                "s",
                NewVariableParams::Shell {
                    cmd: "c".to_owned(),
                    shell: None,
                    trim: None,
                    debug: Some(format!("{PRIVATE}\nx")),
                },
            ),
            VariableSetting::Debug,
        ),
    ] {
        let error = refused(VARS, 0, &inserting(ListPlacement::End {}, variable));
        assert_eq!(
            error,
            DraftError::NewVariableSettingNotPlainSource {
                target: DraftTarget::NewVariable { insertion: 0 },
                setting,
            }
        );
        assert_no_text(&error);
    } // End of the loop over the refused settings
} // End of function typed_settings_are_plain_source_and_everything_else_is_a_logical_string()

#[test]
fn a_multi_line_value_becomes_a_block_scalar_that_reads_back() {
    let layout = "Name: [[who]]\nAge: [[age]]\n";
    let (_, patched) = planned(
        VARS,
        0,
        &inserting(ListPlacement::End {}, NewVariable::form("f", layout)),
    );
    let after = the_match(&patched, 0);
    let written = after.vars[3].params[0].value.as_scalar().expect("a scalar");
    assert_eq!(written.text, layout);
    assert!(
        patched.contains("          layout: |\n            Name: [[who]]\n"),
        "{patched}"
    );
} // End of function a_multi_line_value_becomes_a_block_scalar_that_reads_back()

// ---------------------------------------------------------------------------
// Insertion into an existing `vars`, and the whole subtree
// ---------------------------------------------------------------------------

#[test]
fn an_insertion_at_the_front_leaves_the_first_variables_comment_with_it() {
    let (_, patched) = planned(
        VARS,
        0,
        &inserting(ListPlacement::Front {}, NewVariable::clipboard("c")),
    );
    assert_inserted_between(
        VARS,
        &patched,
        "    vars:\n",
        "      - name: c\n        type: clipboard\n",
    );
    let after = the_match(&patched, 0);
    let names: Vec<&str> = after
        .vars
        .iter()
        .map(|variable| variable.name.as_ref().expect("named").text.as_str())
        .collect();
    assert_eq!(names, ["c", "first", "second", "third"]);
} // End of function an_insertion_at_the_front_leaves_the_first_variables_comment_with_it()

#[test]
fn an_insertion_after_a_middle_variable_lands_before_the_next_ones_comment() {
    let (_, patched) = planned(
        VARS,
        0,
        &inserting(
            ListPlacement::After { index: 0 },
            NewVariable::echo("m", "mid"),
        ),
    );
    assert_inserted_between(
        VARS,
        &patched,
        "          echo: alpha\n",
        "      - name: m\n        type: echo\n        params:\n          echo: mid\n",
    );
} // End of function an_insertion_after_a_middle_variable_lands_before_the_next_ones_comment()

#[test]
fn a_new_variable_plus_a_content_edit_applies_in_one_batch() {
    // Into an existing `vars`, beside a rewritten content value, a new label and
    // an edited existing variable, whose path the insertion above it shifts.
    let draft = inserting(ListPlacement::Front {}, NewVariable::echo("nv", "new"))
        .with(MatchField::Replace, "a {{nv}} {{first}}")
        .with(MatchField::Label, "L")
        .with_variable(VariableDraft::new(2).with(VariableField::Name, "renamed"));
    let (edits, patched) = planned(VARS, 0, &draft);
    assert_eq!(edits.len(), 4, "{edits:?}");
    let after = the_match(&patched, 0);
    assert_eq!(
        after
            .content
            .replace
            .as_ref()
            .map(|value| value.text.as_str()),
        Some("a {{nv}} {{first}}")
    );
    assert_eq!(
        after.label.as_ref().map(|value| value.text.as_str()),
        Some("L")
    );
    let names: Vec<&str> = after
        .vars
        .iter()
        .map(|variable| variable.name.as_ref().expect("named").text.as_str())
        .collect();
    assert_eq!(names, ["nv", "first", "second", "renamed"]);

    // As a whole new `vars:` subtree, beside a content edit and a new field:
    // one group, the subtree written last.
    let draft = inserting(ListPlacement::End {}, NewVariable::echo("nv", "new"))
        .with(MatchField::Replace, "p {{nv}}")
        .with(MatchField::Label, "L");
    let (edits, patched) = planned(VARS, 1, &draft);
    assert_eq!(edits.len(), 2, "{edits:?}");
    assert_inserted_between(
        &VARS.replace("    replace: plain\n", "    replace: 'p {{nv}}'\n"),
        &patched,
        "    replace: 'p {{nv}}'\n",
        "    label: L\n    vars:\n      - name: nv\n        type: echo\n        params:\n          echo: new\n",
    );
} // End of function a_new_variable_plus_a_content_edit_applies_in_one_batch()

#[test]
fn a_whole_vars_subtree_is_inserted_when_the_match_has_none() {
    let (edits, patched) = planned(
        VARS,
        1,
        &inserting(
            ListPlacement::End {},
            NewVariable::random("r", strings(&["x", "w"])),
        ),
    );
    assert!(
        matches!(edits.as_slice(), [DocumentEdit::InsertFields(group)]
            if group.entries().is_empty() && group.item_list().is_some()),
        "{edits:?}"
    );
    assert_inserted_between(
        VARS,
        &patched,
        "    replace: plain\n",
        "    vars:\n      - name: r\n        type: random\n        params:\n          choices:\n            - x\n            - w\n",
    );
    let after = the_match(&patched, 1);
    assert!(matches!(
        after.vars_presence,
        SequencePresence::Items {
            flow: false,
            count: 1,
            ..
        }
    ));
    assert_eq!(after.vars[0].kind, VariableKind::Random);

    // `Front` names the same place; `After` names an item there is not.
    let (_, front) = planned(
        VARS,
        1,
        &inserting(
            ListPlacement::Front {},
            NewVariable::random("r", strings(&["x", "w"])),
        ),
    );
    assert_eq!(front, patched);
    assert_eq!(
        refused(
            VARS,
            1,
            &inserting(
                ListPlacement::After { index: 0 },
                NewVariable::clipboard("c")
            )
        ),
        DraftError::TargetDoesNotExist {
            target: DraftTarget::Variable { index: 0 },
            length: 0,
        }
    );
} // End of function a_whole_vars_subtree_is_inserted_when_the_match_has_none()

#[test]
fn a_flow_or_empty_vars_is_refused_rather_than_converted() {
    for index in [2, 3] {
        for draft in [
            inserting(ListPlacement::End {}, NewVariable::clipboard("c")),
            intending(VarsIntent::RemoveVariable { index: 0 }),
        ] {
            let error = refused(VARS, index, &draft);
            assert!(
                matches!(
                    error,
                    DraftError::VarsIsAFlowList {} | DraftError::TargetDoesNotExist { .. }
                ),
                "match {index}: {error:?}"
            );
        }
        assert_eq!(
            refused(
                VARS,
                index,
                &inserting(ListPlacement::End {}, NewVariable::clipboard("c"))
            ),
            DraftError::VarsIsAFlowList {}
        );
    } // End of the loop over the flow `vars`
      // The explicit container removal works on either style.
    let (_, patched) = planned(VARS, 3, &intending(VarsIntent::RemoveVars {}));
    assert!(
        patched.contains("  - trigger: ':four'\n    replace: d\n") && !patched.contains("vars: []"),
        "{patched}"
    );
} // End of function a_flow_or_empty_vars_is_refused_rather_than_converted()

#[test]
fn a_vars_that_is_not_a_list_is_refused_by_name() {
    let source = "matches:\n  - trigger: ':s'\n    replace: x\n    vars: scalar\n";
    for draft in [
        inserting(ListPlacement::End {}, NewVariable::clipboard("c")),
        intending(VarsIntent::RemoveVars {}),
    ] {
        let error = refused(source, 0, &draft);
        assert!(
            matches!(
                error,
                DraftError::VarsHasAnUnsupportedShape { .. } | DraftError::MatchNotEditable { .. }
            ),
            "{error:?}"
        );
    }
} // End of function a_vars_that_is_not_a_list_is_refused_by_name()

// ---------------------------------------------------------------------------
// Removal
// ---------------------------------------------------------------------------

#[test]
fn a_removed_variable_takes_its_own_comments_and_leaves_the_files() {
    let (edits, patched) = planned(VARS, 0, &intending(VarsIntent::RemoveVariable { index: 1 }));
    assert!(matches!(edits.as_slice(), [DocumentEdit::RemoveItem(_)]));
    let expected = VARS.replace(
        "      # Owned by second.
      - name: second
        type: shell
        params:
          cmd: 'printf x'
          trim: true
",
        "",
    );
    assert_eq!(patched, expected);
    assert!(patched.contains("# A file comment, kept by the blank lines around it."));

    // The last variable takes its inline comment with it.
    let (_, patched) = planned(VARS, 0, &intending(VarsIntent::RemoveVariable { index: 2 }));
    assert!(!patched.contains("inline on third"), "{patched}");
    assert!(patched.contains("  - trigger: ':two'\n"));
} // End of function a_removed_variable_takes_its_own_comments_and_leaves_the_files()

#[test]
fn removing_every_variable_is_refused_and_removing_vars_is_explicit() {
    let all = MatchDraft::new()
        .with_vars_intent(VarsIntent::RemoveVariable { index: 0 })
        .with_vars_intent(VarsIntent::RemoveVariable { index: 1 })
        .with_vars_intent(VarsIntent::RemoveVariable { index: 2 });
    assert_eq!(refused(VARS, 0, &all), DraftError::VarsWouldBeEmpty {});
    // A new variable in the same draft does not rescue it.
    let rescued = all.with_vars_intent(VarsIntent::InsertVariable {
        at: ListPlacement::End {},
        variable: Box::new(NewVariable::clipboard("c")),
    });
    assert_eq!(refused(VARS, 0, &rescued), DraftError::VarsWouldBeEmpty {});

    // The explicit container removal takes the key, every variable and the
    // comments they own; the next match is untouched, and nothing is null.
    let (edits, patched) = planned(VARS, 0, &intending(VarsIntent::RemoveVars {}));
    assert!(matches!(edits.as_slice(), [DocumentEdit::RemoveField(_)]));
    // The comment the blank lines give to the file stays, with those lines;
    // every other byte of the entry goes.
    let start = VARS.find("    vars:\n").expect("vars");
    let kept_from = VARS
        .find("\n      # A file comment")
        .expect("the file comment");
    let kept_to = VARS
        .find("      # Owned by second.")
        .expect("second's comment");
    let end = VARS.find("  - trigger: ':two'").expect("next");
    let expected = format!(
        "{}{}{}",
        &VARS[..start],
        &VARS[kept_from..kept_to],
        &VARS[end..]
    );
    assert_eq!(patched, expected);
    let after = the_match(&patched, 0);
    assert_eq!(after.vars_presence, SequencePresence::Absent {});

    // On a match with no `vars` it derives nothing.
    let view = the_match(VARS, 1);
    assert_eq!(
        plan_match_edits(&view, &intending(VarsIntent::RemoveVars {})),
        Ok(Vec::new())
    );
} // End of function removing_every_variable_is_refused_and_removing_vars_is_explicit()

#[test]
fn an_index_the_list_does_not_have_is_refused() {
    assert_eq!(
        refused(VARS, 0, &intending(VarsIntent::RemoveVariable { index: 3 })),
        DraftError::TargetDoesNotExist {
            target: DraftTarget::Variable { index: 3 },
            length: 3,
        }
    );
    assert_eq!(
        refused(
            VARS,
            0,
            &inserting(
                ListPlacement::After { index: 7 },
                NewVariable::clipboard("c")
            )
        ),
        DraftError::TargetDoesNotExist {
            target: DraftTarget::Variable { index: 7 },
            length: 3,
        }
    );
    assert_eq!(
        refused(VARS, 1, &intending(VarsIntent::RemoveVariable { index: 0 })),
        DraftError::TargetDoesNotExist {
            target: DraftTarget::Variable { index: 0 },
            length: 0,
        }
    );
} // End of function an_index_the_list_does_not_have_is_refused()

#[test]
fn an_insertion_and_a_removal_compose_in_one_batch() {
    let draft = MatchDraft::new()
        .with_vars_intent(VarsIntent::RemoveVariable { index: 0 })
        .with_vars_intent(VarsIntent::InsertVariable {
            at: ListPlacement::End {},
            variable: Box::new(NewVariable::echo("nv", "new")),
        });
    let (_, patched) = planned(VARS, 0, &draft);
    let names: Vec<String> = the_match(&patched, 0)
        .vars
        .iter()
        .map(|variable| variable.name.as_ref().expect("named").text.clone())
        .collect();
    assert_eq!(names, ["second", "third", "nv"]);
    assert!(!patched.contains("# Owned by first."));
    assert!(patched.contains("# Owned by second."));
} // End of function an_insertion_and_a_removal_compose_in_one_batch()

// ---------------------------------------------------------------------------
// Coherence and admissibility
// ---------------------------------------------------------------------------

#[test]
fn contradictory_vars_intents_are_refused_at_intent_level() {
    let conflict = |intent| DraftError::VarsIntentsConflict { intent };
    let cases: Vec<(MatchDraft, DraftError)> = vec![
        (
            MatchDraft::new()
                .with_vars_intent(VarsIntent::RemoveVars {})
                .with_vars_intent(VarsIntent::RemoveVariable { index: 0 }),
            conflict(0),
        ),
        (
            intending(VarsIntent::RemoveVars {})
                .with_variable(VariableDraft::new(0).with(VariableField::Name, "x")),
            conflict(0),
        ),
        (
            MatchDraft::new()
                .with_vars_intent(VarsIntent::RemoveVariable { index: 1 })
                .with_vars_intent(VarsIntent::RemoveVariable { index: 1 }),
            conflict(1),
        ),
        (
            intending(VarsIntent::RemoveVariable { index: 1 })
                .with_variable(VariableDraft::new(1).with(VariableField::Name, "x")),
            conflict(0),
        ),
        (
            MatchDraft::new()
                .with_vars_intent(VarsIntent::InsertVariable {
                    at: ListPlacement::End {},
                    variable: Box::new(NewVariable::clipboard("a")),
                })
                .with_vars_intent(VarsIntent::InsertVariable {
                    at: ListPlacement::After { index: 2 },
                    variable: Box::new(NewVariable::clipboard("b")),
                }),
            conflict(1),
        ),
        (
            MatchDraft::new()
                .with_vars_intent(VarsIntent::InsertVariable {
                    at: ListPlacement::After { index: 0 },
                    variable: Box::new(NewVariable::clipboard("a")),
                })
                .with_vars_intent(VarsIntent::RemoveVariable { index: 1 }),
            conflict(0),
        ),
    ];
    for (draft, expected) in cases {
        assert_eq!(refused(VARS, 0, &draft), expected, "{draft:?}");
    }
    // A match with no `vars` takes one new variable per draft.
    let two = MatchDraft::new()
        .with_vars_intent(VarsIntent::InsertVariable {
            at: ListPlacement::Front {},
            variable: Box::new(NewVariable::clipboard("a")),
        })
        .with_vars_intent(VarsIntent::InsertVariable {
            at: ListPlacement::End {},
            variable: Box::new(NewVariable::clipboard("b")),
        });
    assert_eq!(refused(VARS, 1, &two), conflict(1));
} // End of function contradictory_vars_intents_are_refused_at_intent_level()

#[test]
fn a_new_variables_name_is_checked_and_never_echoed() {
    let target = DraftTarget::NewVariable { insertion: 0 };
    let cases: Vec<(NewVariable, DraftError)> = vec![
        (
            NewVariable::clipboard(""),
            DraftError::NewVariableNameIsEmpty { target },
        ),
        (
            NewVariable::clipboard(format!("{PRIVATE}\nx")),
            DraftError::NewVariableNameIsNotOneLine { target },
        ),
        (
            NewVariable::clipboard(format!("{PRIVATE}\tx")),
            DraftError::NewVariableNameIsNotOneLine { target },
        ),
        (
            NewVariable::clipboard("second"),
            DraftError::NewVariableNameDuplicatesAVariable {
                target,
                variable: 1,
            },
        ),
    ];
    for (variable, expected) in cases {
        let error = refused(VARS, 0, &inserting(ListPlacement::End {}, variable));
        assert_eq!(error, expected);
        assert_no_text(&error);
    }
    // A removed or renamed variable's name still counts.
    let draft = intending(VarsIntent::RemoveVariable { index: 0 }).with_vars_intent(
        VarsIntent::InsertVariable {
            at: ListPlacement::End {},
            variable: Box::new(NewVariable::clipboard("first")),
        },
    );
    assert_eq!(
        refused(VARS, 0, &draft),
        DraftError::NewVariableNameDuplicatesAVariable {
            target: DraftTarget::NewVariable { insertion: 1 },
            variable: 0,
        }
    );
    // Two new variables with one name, however far apart they land.
    let name = format!("{PRIVATE}-n");
    let draft = inserting(
        ListPlacement::Front {},
        NewVariable::clipboard(name.clone()),
    )
    .with_vars_intent(VarsIntent::InsertVariable {
        at: ListPlacement::End {},
        variable: Box::new(NewVariable::clipboard(name)),
    });
    let error = refused(VARS, 0, &draft);
    assert_eq!(
        error,
        DraftError::NewVariableNameDuplicatesAnInsertion {
            target: DraftTarget::NewVariable { insertion: 1 },
            first: 0,
        }
    );
    assert_no_text(&error);
    // `NewVariableNameCannotBeCompared` needs an existing name the projection
    // could not decode; no text the parser accepts was found to produce one, so
    // that refusal is not driven by any test (an open item of 4-4's notes).
} // End of function a_new_variables_name_is_checked_and_never_echoed()

#[test]
fn extra_parameters_are_bounded_and_keep_ruling_seven() {
    let param = |key: &str| NewParam::scalar(key, format!("{PRIVATE}-value"));
    let at = |param| DraftTarget::NewVariableParam {
        insertion: 0,
        param,
    };
    let cases: Vec<(NewVariable, DraftError)> = vec![
        (
            NewVariable::echo("e", "x").with_extra_param(param("")),
            DraftError::NewKeyIsEmpty { target: at(0) },
        ),
        (
            NewVariable::echo("e", "x").with_extra_param(param(&format!("{PRIVATE}\r"))),
            DraftError::NewKeyHasALineBreak { target: at(0) },
        ),
        (
            NewVariable::echo("e", "x").with_extra_param(param("<<")),
            DraftError::NewKeyIsAMergeKey { target: at(0) },
        ),
        (
            NewVariable::echo("e", "x").with_extra_param(param("trim")),
            DraftError::NewKeyIsATypedSetting { target: at(0) },
        ),
        (
            NewVariable::echo("e", "x").with_extra_param(param("echo")),
            DraftError::NewKeyIsAKindParameter { target: at(0) },
        ),
        (
            NewVariable::form("f", "x").with_extra_param(param("fields")),
            DraftError::NewKeyIsAKindParameter { target: at(0) },
        ),
        (
            NewVariable::echo("e", "x")
                .with_extra_param(param(PRIVATE))
                .with_extra_param(param(PRIVATE)),
            DraftError::NewKeyDuplicatesAnInsertion {
                target: at(1),
                first: 0,
            },
        ),
    ];
    for (variable, expected) in cases {
        let error = refused(VARS, 0, &inserting(ListPlacement::End {}, variable));
        assert_eq!(error, expected);
        assert_no_text(&error);
    }
    let mut many = NewVariable::clipboard("c");
    for count in 0..=NewVariable::MAX_EXTRA_PARAMS {
        many = many.with_extra_param(NewParam::scalar(format!("k{count}"), "v"));
    }
    assert_eq!(
        refused(VARS, 0, &inserting(ListPlacement::End {}, many)),
        DraftError::NewVariableHasTooManyParams {
            target: DraftTarget::NewVariable { insertion: 0 },
            limit: NewVariable::MAX_EXTRA_PARAMS,
        }
    );
    // At the bound, a clipboard variable gets a `params:` holding the extras.
    let mut bounded = NewVariable::clipboard("c");
    for count in 0..NewVariable::MAX_EXTRA_PARAMS {
        bounded = bounded.with_extra_param(NewParam::scalar(format!("k{count}"), "v"));
    }
    let (_, patched) = planned(VARS, 0, &inserting(ListPlacement::End {}, bounded));
    assert_eq!(
        the_match(&patched, 0).vars[3].params.len(),
        NewVariable::MAX_EXTRA_PARAMS
    );
} // End of function extra_parameters_are_bounded_and_keep_ruling_seven()

// ---------------------------------------------------------------------------
// The closed surface
// ---------------------------------------------------------------------------

/// The fields of a minimal new variable, as the planner writes them.
fn variable_fields(kind: &str) -> Vec<(String, ItemValue)> {
    vec![
        (
            "name".to_owned(),
            ItemValue::Entry(EntryValue::Scalar("n".to_owned())),
        ),
        (
            "type".to_owned(),
            ItemValue::Entry(EntryValue::Scalar(kind.to_owned())),
        ),
    ]
} // End of function variable_fields()

#[test]
fn the_closed_surface_admits_a_new_variable_and_nothing_near_it() {
    let here = match_path(0);
    let vars = here.clone().with_key("vars");
    let insert = |fields| -> DocumentEdit {
        InsertItem::nested(vars.clone(), ItemPlacement::End, fields).into()
    };
    let mut with_params = variable_fields("shell");
    with_params.push((
        "params".to_owned(),
        ItemValue::flat(vec![
            ("cmd".to_owned(), EntryValue::Scalar("c".to_owned())),
            (
                "trim".to_owned(),
                EntryValue::PlainSource("true".to_owned()),
            ),
        ]),
    ));
    let inside: Vec<DocumentEdit> = vec![
        insert(variable_fields("echo")),
        insert(with_params.clone()),
        RemoveItem::new(vars.clone().with_index(1)).into(),
        FieldRemoval::new(vars.clone()).into(),
        FieldInsertGroup::with_item_list(
            here.clone(),
            Some("replace".to_owned()),
            Vec::new(),
            "vars",
            vec![variable_fields("date")],
        )
        .expect("one item")
        .into(),
    ];
    for edit in inside {
        assert_eq!(
            check_closed_surface(&here, std::slice::from_ref(&edit)),
            Ok(()),
            "{edit:?} is inside the surface"
        );
    }

    let mut unordered = variable_fields("echo");
    unordered.reverse();
    let mut plain_elsewhere = variable_fields("echo");
    plain_elsewhere.push((
        "params".to_owned(),
        ItemValue::flat(vec![(
            "echo".to_owned(),
            EntryValue::PlainSource("x".to_owned()),
        )]),
    ));
    let mut typed_as_string = variable_fields("shell");
    typed_as_string.push((
        "params".to_owned(),
        ItemValue::flat(vec![(
            "trim".to_owned(),
            EntryValue::Scalar("true".to_owned()),
        )]),
    ));
    let mut empty_params = variable_fields("echo");
    empty_params.push(("params".to_owned(), ItemValue::Mapping(Vec::new())));
    let mut unknown_key = variable_fields("echo");
    unknown_key.push((
        "other".to_owned(),
        ItemValue::Entry(EntryValue::Scalar("x".to_owned())),
    ));
    let mut merge_key = variable_fields("echo");
    merge_key.push((
        "params".to_owned(),
        ItemValue::flat(vec![("<<".to_owned(), EntryValue::Scalar("x".to_owned()))]),
    ));
    let outside: Vec<DocumentEdit> = vec![
        insert(variable_fields("nonsense")),
        insert(vec![(
            "name".to_owned(),
            ItemValue::Entry(EntryValue::Scalar("n".to_owned())),
        )]),
        insert(unordered),
        insert(plain_elsewhere),
        insert(typed_as_string),
        insert(empty_params),
        insert(unknown_key),
        insert(merge_key),
        // The right shape in the wrong sequence.
        InsertItem::nested(
            DocumentPath::root(0).with_key("matches"),
            ItemPlacement::End,
            variable_fields("echo"),
        )
        .into(),
        InsertItem::nested(
            vars.clone().with_index(0).with_key("depends_on"),
            ItemPlacement::End,
            variable_fields("echo"),
        )
        .into(),
        // One segment deeper than a variable, in a list that is not one of the
        // four Phase 4-5 admits (`depends_on[0]` is inside since then).
        RemoveItem::new(
            vars.clone()
                .with_index(0)
                .with_key("params")
                .with_key("layout")
                .with_index(0),
        )
        .into(),
        // An item list under another key, or on another mapping.
        FieldInsertGroup::with_item_list(
            here.clone(),
            None,
            Vec::new(),
            "form_fields",
            vec![variable_fields("echo")],
        )
        .expect("one item")
        .into(),
        FieldInsertGroup::with_item_list(
            vars.clone().with_index(0),
            None,
            Vec::new(),
            "vars",
            vec![variable_fields("echo")],
        )
        .expect("one item")
        .into(),
        DuplicateItem::new(vars.clone().with_index(0)).into(),
        ItemMove::after(vars.clone().with_index(0), 1).into(),
    ];
    for edit in outside {
        let result = check_closed_surface(&here, std::slice::from_ref(&edit));
        assert!(
            matches!(
                result,
                Err(DraftError::OutsideTheClosedSurface { edit: 0 })
                    | Err(DraftError::MoveIsNotADraftEdit { edit: 0 })
            ),
            "{edit:?} must be outside the surface: {result:?}"
        );
    } // End of the loop over the edits near the surface
} // End of function the_closed_surface_admits_a_new_variable_and_nothing_near_it()

#[test]
fn an_insertion_landing_on_a_removal_is_caught_by_the_guard() {
    let here = match_path(0);
    let vars = here.clone().with_key("vars");
    let edits: Vec<DocumentEdit> = vec![
        InsertItem::nested(
            vars.clone(),
            ItemPlacement::After(0),
            variable_fields("echo"),
        )
        .into(),
        RemoveItem::new(vars.clone().with_index(1)).into(),
    ];
    assert_eq!(
        espansoconfig_core::draft::check_batch_independence(&here, &[], &[], &edits),
        Err(DraftError::InsertionLandsOnARemoval {
            insertion: 0,
            removal: 1,
        })
    );
    // A whole-`vars` removal containing an insertion into it.
    let edits: Vec<DocumentEdit> = vec![
        FieldRemoval::new(vars.clone()).into(),
        InsertItem::nested(vars, ItemPlacement::End, variable_fields("echo")).into(),
    ];
    assert_eq!(
        espansoconfig_core::draft::check_batch_independence(&here, &[], &[], &edits),
        Err(DraftError::RemovalContainsAnEdit {
            removal: 0,
            edit: 1,
        })
    );
} // End of function an_insertion_landing_on_a_removal_is_caught_by_the_guard()

// ---------------------------------------------------------------------------
// Reorder (R25)
// ---------------------------------------------------------------------------

#[test]
fn a_reorder_succeeds_alone_and_carries_the_variables_own_comments() {
    let view = the_match(VARS, 0);
    let edits = plan_variable_move(&view, 1, ListPlacement::End {}).expect("the move plans");
    assert!(matches!(edits.as_slice(), [DocumentEdit::MoveItem(_)]));
    let patched = apply_edits(VARS, &edits).expect("the move applies alone");
    let moved = "      # Owned by second.
      - name: second
        type: shell
        params:
          cmd: 'printf x'
          trim: true
";
    let without = VARS.replace(moved, "");
    assert_inserted_between(
        &without,
        patched.text(),
        "          echo: gamma  # inline on third\n",
        moved,
    );
    let names: Vec<String> = the_match(patched.text(), 0)
        .vars
        .iter()
        .map(|variable| variable.name.as_ref().expect("named").text.clone())
        .collect();
    assert_eq!(names, ["first", "third", "second"]);
    assert!(patched
        .text()
        .contains("# A file comment, kept by the blank lines around it."));

    // To the front: above the first variable's own comment.
    let edits = plan_variable_move(&view, 2, ListPlacement::Front {}).expect("plans");
    let patched = apply_edits(VARS, &edits).expect("applies");
    assert!(
        patched
            .text()
            .contains("    vars:\n      - name: third\n        type: echo\n        params:\n          echo: gamma  # inline on third\n      # Owned by first.\n"),
        "{}",
        patched.text()
    );
} // End of function a_reorder_succeeds_alone_and_carries_the_variables_own_comments()

#[test]
fn a_reorder_the_list_cannot_honour_is_refused_by_name() {
    let view = the_match(VARS, 0);
    assert_eq!(
        plan_variable_move(&view, 0, ListPlacement::Front {}),
        Err(DraftError::VariableMoveChangesNothing { variable: 0 })
    );
    assert_eq!(
        plan_variable_move(&view, 2, ListPlacement::End {}),
        Err(DraftError::VariableMoveChangesNothing { variable: 2 })
    );
    assert_eq!(
        plan_variable_move(&view, 1, ListPlacement::After { index: 1 }),
        Err(DraftError::VariableMoveChangesNothing { variable: 1 })
    );
    assert_eq!(
        plan_variable_move(&view, 3, ListPlacement::Front {}),
        Err(DraftError::TargetDoesNotExist {
            target: DraftTarget::Variable { index: 3 },
            length: 3,
        })
    );
    assert_eq!(
        plan_variable_move(&view, 0, ListPlacement::After { index: 9 }),
        Err(DraftError::TargetDoesNotExist {
            target: DraftTarget::Variable { index: 9 },
            length: 3,
        })
    );
    assert_eq!(
        plan_variable_move(&the_match(VARS, 1), 0, ListPlacement::End {}),
        Err(DraftError::TargetDoesNotExist {
            target: DraftTarget::Variable { index: 0 },
            length: 0,
        })
    );
    for index in [2, 3] {
        assert_eq!(
            plan_variable_move(&the_match(VARS, index), 0, ListPlacement::End {}),
            Err(DraftError::VarsIsAFlowList {})
        );
    }
    // The guard reads a batch it did not build.
    let here = match_path(0);
    let movement: DocumentEdit =
        ItemMove::after(here.clone().with_key("vars").with_index(0), 1).into();
    assert_eq!(
        check_variable_move(&here, std::slice::from_ref(&movement)),
        Ok(())
    );
    let into_matches: DocumentEdit = ItemMove::after(match_path(0), 1).into();
    assert_eq!(
        check_variable_move(&here, &[into_matches]),
        Err(DraftError::OutsideTheClosedSurface { edit: 0 })
    );
    assert_eq!(
        check_variable_move(&here, &[movement.clone(), movement]),
        Err(DraftError::OutsideTheClosedSurface { edit: 1 })
    );
} // End of function a_reorder_the_list_cannot_honour_is_refused_by_name()

/// One edit of every [`DocumentEdit`] category, each valid on [`VARS`] alone.
fn every_other_category() -> Vec<(&'static str, DocumentEdit)> {
    let here = match_path(0);
    let vars = here.clone().with_key("vars");
    vec![
        (
            "scalar edit",
            ScalarEdit::new(here.clone().with_key("replace"), "z").into(),
        ),
        (
            "field insertion",
            FieldInsert::after(here.clone(), "replace", "label", "L").into(),
        ),
        (
            "insertion group",
            FieldInsertGroup::new(here.clone(), vec![("label".to_owned(), "L".to_owned())])
                .expect("one entry")
                .into(),
        ),
        (
            "key substitution",
            KeySubstitution::new(match_path(1).with_key("replace"), "markdown").into(),
        ),
        (
            "field removal",
            FieldRemoval::new(vars.clone().with_index(0).with_key("params")).into(),
        ),
        (
            "item insertion",
            InsertItem::nested(
                vars.clone(),
                ItemPlacement::End,
                variable_fields("clipboard"),
            )
            .into(),
        ),
        (
            "item removal",
            RemoveItem::new(vars.clone().with_index(2)).into(),
        ),
        (
            "scalar item insertion",
            ScalarItemInsert::new(
                match_path(1).with_key("search_terms"),
                ItemPlacement::End,
                vec!["x".to_owned()],
            )
            .expect("one value")
            .into(),
        ),
        (
            "shape switch",
            ShapeSwitch::new(
                match_path(1).with_key("trigger"),
                "triggers",
                EntryValue::ScalarList(vec![":two".to_owned()]),
            )
            .into(),
        ),
        (
            "duplicate",
            DuplicateItem::new(vars.clone().with_index(0)).into(),
        ),
        (
            "raw item text",
            ItemTextReplacement::new(
                match_path(1),
                "  - trigger: ':two'\n    replace: z\n".to_owned(),
            )
            .into(),
        ),
        (
            "a second move",
            ItemMove::to_front(vars.with_index(2)).into(),
        ),
    ]
} // End of function every_other_category()

#[test]
fn a_reorder_beside_every_other_edit_category_is_refused() {
    let view = the_match(VARS, 0);
    let movement = plan_variable_move(&view, 0, ListPlacement::End {})
        .expect("the move plans")
        .remove(0);
    let categories = every_other_category();
    assert_eq!(
        categories.len(),
        12,
        "every other DocumentEdit category, and a second move"
    );
    for (what, other) in categories {
        let batch = [movement.clone(), other.clone()];
        let result = apply_edits(VARS, &batch);
        assert!(
            matches!(
                result,
                Err(EditError::MoveMustBeTheOnlyEditInItsBatch { edit: 0, edits: 2 })
            ),
            "{what}: {result:?}"
        );
        // After the other edit too, whichever batch rule it has of its own.
        let batch = [other, movement.clone()];
        let result = apply_edits(VARS, &batch);
        assert!(
            matches!(
                result,
                Err(EditError::MoveMustBeTheOnlyEditInItsBatch { .. }
                    | EditError::DuplicateMustBeTheOnlyEditInItsBatch { .. }
                    | EditError::ItemTextMustBeTheOnlyEditInItsBatch { .. })
            ),
            "{what}, second: {result:?}"
        );
    } // End of the loop over every other edit category
      // And beside a draft's own batch: a new variable plus a content edit.
    let draft = inserting(ListPlacement::Front {}, NewVariable::clipboard("c"))
        .with(MatchField::Replace, "z");
    let mut batch = plan_match_edits(&view, &draft).expect("the draft plans");
    batch.insert(0, movement);
    assert!(matches!(
        apply_edits(VARS, &batch),
        Err(EditError::MoveMustBeTheOnlyEditInItsBatch { edit: 0, edits: 3 })
    ));
} // End of function a_reorder_beside_every_other_edit_category_is_refused()

// ---------------------------------------------------------------------------
// Hard shapes: CRLF, no final newline, block scalars
// ---------------------------------------------------------------------------

#[test]
fn crlf_line_endings_are_copied_into_every_new_line() {
    let source = "matches:\r\n  - trigger: ':c'\r\n    replace: x\r\n    vars:\r\n      - name: a\r\n        type: echo\r\n        params:\r\n          echo: y\r\n  - trigger: ':d'\r\n    replace: z\r\n";
    let (_, patched) = planned(
        source,
        0,
        &inserting(
            ListPlacement::End {},
            NewVariable::choice("b", strings(&["p", "q"])),
        ),
    );
    assert_inserted_between(
        source,
        &patched,
        "          echo: y\r\n",
        "      - name: b\r\n        type: choice\r\n        params:\r\n          values:\r\n            - p\r\n            - q\r\n",
    );
    let (_, patched) = planned(
        source,
        1,
        &inserting(ListPlacement::End {}, NewVariable::echo("e", "w")),
    );
    assert_inserted_between(
        source,
        &patched,
        "    replace: z\r\n",
        "    vars:\r\n      - name: e\r\n        type: echo\r\n        params:\r\n          echo: w\r\n",
    );
    let (_, patched) = planned(source, 0, &intending(VarsIntent::RemoveVars {}));
    assert_eq!(
        patched,
        "matches:\r\n  - trigger: ':c'\r\n    replace: x\r\n  - trigger: ':d'\r\n    replace: z\r\n"
    );
} // End of function crlf_line_endings_are_copied_into_every_new_line()

#[test]
fn a_file_with_no_final_newline_keeps_not_having_one() {
    let source = "matches:\n  - trigger: ':n'\n    replace: x\n    vars:\n      - name: a\n        type: echo\n        params:\n          echo: y";
    let (_, patched) = planned(
        source,
        0,
        &inserting(ListPlacement::End {}, NewVariable::echo("b", "z")),
    );
    assert_eq!(
        patched,
        format!(
            "{source}\n      - name: b\n        type: echo\n        params:\n          echo: z"
        )
    );
    let source = "matches:\n  - trigger: ':n'\n    replace: x";
    let (_, patched) = planned(
        source,
        0,
        &inserting(ListPlacement::End {}, NewVariable::clipboard("c")),
    );
    assert_eq!(
        patched,
        format!("{source}\n    vars:\n      - name: c\n        type: clipboard")
    );
} // End of function a_file_with_no_final_newline_keeps_not_having_one()

#[test]
fn a_block_scalar_before_the_insertion_point_keeps_its_value() {
    // The last variable ends in a literal block with a kept trailing blank
    // line; a new variable after it must not change that value, and the next
    // match's bytes must not move into it.
    let source = "matches:\n  - trigger: ':b'\n    replace: x\n    vars:\n      - name: a\n        type: echo\n        params:\n          echo: |\n            one\n            two\n  - trigger: ':c'\n    replace: y\n";
    let (_, patched) = planned(
        source,
        0,
        &inserting(ListPlacement::End {}, NewVariable::echo("b", "z")),
    );
    assert_inserted_between(
        source,
        &patched,
        "            two\n",
        "      - name: b\n        type: echo\n        params:\n          echo: z\n",
    );
    let after = the_match(&patched, 0);
    assert_eq!(
        after.vars[0].params[0]
            .value
            .as_scalar()
            .map(|value| value.text.as_str()),
        Some("one\ntwo\n")
    );

    // A keep-chomped block owns the blank line after its content: the new
    // variable lands after that line, and the block's value keeps it.
    let kept = "matches:\n  - trigger: ':k'\n    replace: x\n    vars:\n      - name: a\n        type: echo\n        params:\n          echo: |+\n            one\n\n  - trigger: ':c'\n    replace: y\n";
    let (_, patched) = planned(
        kept,
        0,
        &inserting(ListPlacement::End {}, NewVariable::echo("b", "z")),
    );
    assert_inserted_between(
        kept,
        &patched,
        "            one\n\n",
        "      - name: b\n        type: echo\n        params:\n          echo: z\n",
    );
    let after = the_match(&patched, 0);
    assert_eq!(
        after.vars[0].params[0]
            .value
            .as_scalar()
            .map(|value| value.text.as_str()),
        Some("one\n\n")
    );
} // End of function a_block_scalar_before_the_insertion_point_keeps_its_value()

// ---------------------------------------------------------------------------
// The wire
// ---------------------------------------------------------------------------

#[test]
fn vars_intents_cross_the_wire_as_closed_shapes() {
    let json = r#"{
        "replace": {"Set": "x"},
        "var_intents": [
            {"InsertVariable": {"at": {"End": {}}, "variable": {
                "name": "n",
                "params": {"Shell": {"cmd": "c", "trim": "true"}},
                "depends_on": ["a"],
                "extra_params": [{"key": "k", "value": {"List": ["v"]}}]
            }}},
            {"RemoveVariable": {"index": 1}},
            {"RemoveVars": {}}
        ]
    }"#;
    let draft: MatchDraft = serde_json::from_str(json).expect("the draft reads");
    assert_eq!(draft.var_intents.len(), 3);
    assert!(matches!(
        &draft.var_intents[0],
        VarsIntent::InsertVariable { variable, .. }
            if variable.params.settings() == [(VariableSetting::Trim, "true")]
    ));
    for refused in [
        // An unknown field of a new variable.
        r#"{"var_intents": [{"InsertVariable": {"at": {"End": {}}, "variable": {"name": "n", "params": {"Clipboard": {}}, "yaml": "x: y"}}}]}"#,
        // An unknown field of a kind.
        r#"{"var_intents": [{"InsertVariable": {"at": {"End": {}}, "variable": {"name": "n", "params": {"Echo": {"echo": "e", "fields": {}}}}}}]}"#,
        // A missing required parameter.
        r#"{"var_intents": [{"InsertVariable": {"at": {"End": {}}, "variable": {"name": "n", "params": {"Shell": {}}}}}]}"#,
        // A kind that does not exist, and a move, which is no draft intent.
        r#"{"var_intents": [{"InsertVariable": {"at": {"End": {}}, "variable": {"name": "n", "params": {"Other": {}}}}}]}"#,
        r#"{"var_intents": [{"MoveVariable": {"index": 0}}]}"#,
        // A nested collection where a parameter value goes.
        r#"{"var_intents": [{"InsertVariable": {"at": {"End": {}}, "variable": {"name": "n", "params": {"Clipboard": {}}, "extra_params": [{"key": "k", "value": {"Scalar": {"a": "b"}}}]}}}]}"#,
    ] {
        assert!(
            serde_json::from_str::<MatchDraft>(refused).is_err(),
            "{refused} must be refused while the arguments are read"
        );
    }
    let setting = serde_json::to_string(&VariableSetting::InjectVars).expect("serializes");
    assert_eq!(setting, "\"inject_vars\"");
} // End of function vars_intents_cross_the_wire_as_closed_shapes()

// ---------------------------------------------------------------------------
// The committed synthetic chain, read only
// ---------------------------------------------------------------------------

/// `variable-chain.yml`: four variables with leading comments, blank lines
/// between them, a block-scalar `layout`, plain `offset: 0` and `trim: true`.
/// Read, never written.
fn chain() -> String {
    std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/corpus/synthetic/variable-chain.yml"
    ))
    .expect("the committed synthetic fixture")
}

/// The variable names of match `index` of `source`.
fn names_of(source: &str, index: usize) -> Vec<String> {
    the_match(source, index)
        .vars
        .iter()
        .map(|variable| variable.name.as_ref().expect("named").text.clone())
        .collect()
}

#[test]
fn the_chain_takes_an_insertion_a_removal_and_a_move_with_its_comments() {
    let source = chain();
    let before = names_of(&source, 0);
    assert_eq!(before, ["entrada", "titulo", "fecha", "rama", "estado"]);

    // A new variable after `fecha`: it lands after `fecha`'s own lines and
    // before the blank line and the comment that belong to `rama`.
    let (_, patched) = planned(
        &source,
        0,
        &inserting(
            ListPlacement::After { index: 2 },
            NewVariable::shell("nuevo", "printf z").with_depends_on(strings(&["fecha"])),
        ),
    );
    assert_inserted_between(
        &source,
        &patched,
        "          tz: Europe/Madrid\n",
        "      - name: nuevo\n        type: shell\n        depends_on:\n          - fecha\n        params:\n          cmd: printf z\n",
    );
    assert_eq!(
        names_of(&patched, 0),
        ["entrada", "titulo", "fecha", "nuevo", "rama", "estado"]
    );

    // Removing `fecha` takes its leading comment and leaves the blank lines the
    // file owns; `offset: 0` elsewhere is not its concern.
    let (_, patched) = planned(
        &source,
        0,
        &intending(VarsIntent::RemoveVariable { index: 2 }),
    );
    assert!(!patched.contains("# 2. A date derived"), "{patched}");
    assert!(patched.contains("# 3. A shell command"));
    assert_eq!(
        names_of(&patched, 0),
        ["entrada", "titulo", "rama", "estado"]
    );
    assert_eq!(
        &patched[..source.find("      # 2.").expect("comment")],
        &source[..source.find("      # 2.").expect("comment")]
    );

    // Moving `estado` to the front carries its comment above `entrada`'s,
    // whose block-scalar `layout` keeps its value.
    let view = the_match(&source, 0);
    let edits = plan_variable_move(&view, 4, ListPlacement::Front {}).expect("the move plans");
    let patched = apply_edits(&source, &edits).expect("the move applies");
    assert_eq!(
        names_of(patched.text(), 0),
        ["estado", "entrada", "titulo", "fecha", "rama"]
    );
    let text = patched.text();
    assert!(
        text.find("# 4. A script variable").expect("moved comment")
            < text
                .find("# 1. Collected from the user first.")
                .expect("kept comment"),
        "{text}"
    );
    let layout = the_match(text, 0).vars[1].params[0]
        .value
        .as_scalar()
        .map(|value| value.text.clone());
    let original = the_match(&source, 0).vars[0].params[0]
        .value
        .as_scalar()
        .map(|value| value.text.clone());
    assert_eq!(layout, original);
} // End of function the_chain_takes_an_insertion_a_removal_and_a_move_with_its_comments()
