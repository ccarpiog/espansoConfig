//! Phase 3-10's bounded core planning: the bulk option batch and the preflight.
//!
//! `plan_bulk_option_edits` turns up to seven option intents over several
//! snippets of one file into one batch, and `preflight_edits` judges a batch
//! against text already held, with the save transaction's own gates and without
//! touching a disk. Every fixture here is synthetic and neutral (`CLAUDE.md`
//! section 1).

use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::draft::{
    check_bulk_changes, check_bulk_documents, is_plain_source, plan_bulk_option_edits, BulkOption,
    BulkOptionChange, BulkPlanError, BulkValue, MatchField,
};
use espansoconfig_core::model::{DocumentContext, IdentityError, MatchId};
use espansoconfig_core::patch::{
    apply_edits, DocumentEdit, DocumentPath, EditError, ScalarEdit, VerificationFailure,
};
use espansoconfig_core::persist::{preflight_edits, Acknowledgement, SaveError, SaveVerdict};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::{ContentRevision, DocumentId, SourceDocument};

/// Three snippets: two with no options at all, one already holding `word: true`.
const THREE: &str = "matches:\n  - trigger: ':one'\n    replace: first\n  \
                     - trigger: ':two'\n    replace: second\n  \
                     - trigger: ':three'\n    replace: third\n    word: true\n";

/// One file, projected the way the workspace would project it.
fn projected(source: &str) -> (DocumentContext, SourceDocument) {
    let context = DocumentContext::detached(DocumentId(0), "match/bulk.yml");
    let document = project_source(&context, source);
    (context, document)
} // End of function projected()

/// Every snippet identity of a projected file, in file order.
fn ids(document: &SourceDocument) -> Vec<MatchId> {
    document.view.matches.iter().map(|found| found.id).collect()
}

/// The two options the plan's own example leads with, as a request states them.
fn word_and_clipboard() -> Vec<BulkOptionChange> {
    vec![
        BulkOptionChange {
            option: BulkOption::Word,
            value: BulkValue::Set("true".to_owned()),
        },
        BulkOptionChange {
            option: BulkOption::ForceMode,
            value: BulkValue::Set("clipboard".to_owned()),
        },
    ]
} // End of function word_and_clipboard()

#[test]
fn every_bulk_option_serializes_as_its_espanso_key() {
    for option in BulkOption::ALL {
        let written = serde_json::to_value(option).expect("an option serializes");
        assert_eq!(written, serde_json::json!(option.key()));
        assert_eq!(
            MatchField::from_key(option.key()),
            Some(option.field()),
            "{} is a match field of the same spelling",
            option.key()
        );
    } // End of the loop over the seven options
    let keys: Vec<&str> = BulkOption::ALL.iter().map(|option| option.key()).collect();
    assert_eq!(
        keys,
        [
            "word",
            "left_word",
            "right_word",
            "propagate_case",
            "uppercase_style",
            "force_mode",
            "force_clipboard"
        ],
        "ruling 20's seven options, and nothing else"
    );
} // End of function every_bulk_option_serializes_as_its_espanso_key()

#[test]
fn only_the_seven_options_and_no_force_flag_deserialize() {
    for refused in ["paragraph", "anchor", "replace", "trigger", "label", "Word"] {
        assert!(
            serde_json::from_value::<BulkOption>(serde_json::json!(refused)).is_err(),
            "{refused} is not a bulk option"
        );
    } // End of the loop over names outside the surface
    let with_force = serde_json::json!({
        "option": "word",
        "value": { "Set": "true" },
        "force": true,
    });
    assert!(
        serde_json::from_value::<BulkOptionChange>(with_force).is_err(),
        "an unknown property, a force flag included, is refused rather than ignored"
    );
    let unchanged = serde_json::json!({ "option": "word", "value": "Unchanged" });
    assert!(
        serde_json::from_value::<BulkOptionChange>(unchanged).is_err(),
        "an untouched control emits nothing, so there is no Unchanged value"
    );
    let remove = serde_json::json!({ "option": "force_clipboard", "value": "Remove" });
    assert_eq!(
        serde_json::from_value::<BulkOptionChange>(remove).expect("a removal reads"),
        BulkOptionChange {
            option: BulkOption::ForceClipboard,
            value: BulkValue::Remove,
        }
    );
} // End of function only_the_seven_options_and_no_force_flag_deserialize()

#[test]
fn several_snippets_and_absent_options_become_one_batch() {
    let (_, document) = projected(THREE);
    let selection = ids(&document);
    let edits = plan_bulk_option_edits(
        &document.source,
        &document.view,
        &selection,
        &word_and_clipboard(),
    )
    .expect("the batch plans");
    let patched = apply_edits(&document.source, &edits).expect("the one batch applies");
    assert_eq!(
        patched.text(),
        "matches:\n  - trigger: ':one'\n    replace: first\n    word: true\n    force_mode: clipboard\n  \
         - trigger: ':two'\n    replace: second\n    word: true\n    force_mode: clipboard\n  \
         - trigger: ':three'\n    replace: third\n    word: true\n    force_mode: clipboard\n",
        "both absent options land in every snippet as plain source text, exactly as \
         entered, and the plain `true` already written is left alone"
    );
} // End of function several_snippets_and_absent_options_become_one_batch()

#[test]
fn a_selection_already_holding_every_value_plans_an_empty_batch() {
    let (_, document) = projected(THREE);
    let third = [ids(&document)[2]];
    let changes = [BulkOptionChange {
        option: BulkOption::Word,
        value: BulkValue::Set("true".to_owned()),
    }];
    let edits = plan_bulk_option_edits(&document.source, &document.view, &third, &changes)
        .expect("it plans");
    assert!(edits.is_empty(), "an unchanged file derives no edit");
    let remove = [BulkOptionChange {
        option: BulkOption::LeftWord,
        value: BulkValue::Remove,
    }];
    let edits = plan_bulk_option_edits(&document.source, &document.view, &ids(&document), &remove)
        .expect("plans");
    assert!(
        edits.is_empty(),
        "removing an absent option derives no edit"
    );
} // End of function a_selection_already_holding_every_value_plans_an_empty_batch()

#[test]
fn a_removal_takes_the_option_away() {
    let (_, document) = projected(THREE);
    let third = [ids(&document)[2]];
    let remove = [BulkOptionChange {
        option: BulkOption::Word,
        value: BulkValue::Remove,
    }];
    let edits = plan_bulk_option_edits(&document.source, &document.view, &third, &remove)
        .expect("it plans");
    let patched = apply_edits(&document.source, &edits).expect("it applies");
    assert!(!patched.text().contains("word"), "{}", patched.text());
} // End of function a_removal_takes_the_option_away()

#[test]
fn malformed_requests_and_selections_are_refused_by_name() {
    let (_, document) = projected(THREE);
    let selection = ids(&document);
    assert_eq!(
        plan_bulk_option_edits(&document.source, &document.view, &selection, &[]),
        Err(BulkPlanError::NoOptionChanges {})
    );
    let twice = [
        BulkOptionChange {
            option: BulkOption::Word,
            value: BulkValue::Set("true".to_owned()),
        },
        BulkOptionChange {
            option: BulkOption::Word,
            value: BulkValue::Remove,
        },
    ];
    assert_eq!(
        check_bulk_changes(&twice),
        Err(BulkPlanError::OptionRepeated {
            option: BulkOption::Word
        })
    );
    assert_eq!(
        plan_bulk_option_edits(&document.source, &document.view, &[], &word_and_clipboard()),
        Err(BulkPlanError::NoMatches {})
    );
    let repeated = [selection[0], selection[1], selection[0]];
    assert_eq!(
        plan_bulk_option_edits(
            &document.source,
            &document.view,
            &repeated,
            &word_and_clipboard()
        ),
        Err(BulkPlanError::MatchRepeated { index: 2 })
    );
    let elsewhere = MatchId {
        document: DocumentId(9),
        ..selection[1]
    };
    assert!(matches!(
        plan_bulk_option_edits(
            &document.source,
            &document.view,
            &[selection[0], elsewhere],
            &word_and_clipboard()
        ),
        Err(BulkPlanError::Identity {
            index: 1,
            error: IdentityError::WrongDocument { .. }
        })
    ));
    assert_eq!(
        check_bulk_documents(&[], &[]),
        Err(BulkPlanError::NoFiles {})
    );
    assert_eq!(
        check_bulk_documents(&[DocumentId(1), DocumentId(2)], &[DocumentId(1)]),
        Err(BulkPlanError::DocumentRepeated {
            document: DocumentId(1)
        })
    );
    assert_eq!(
        check_bulk_documents(&[DocumentId(1)], &[DocumentId(2)]),
        Ok(())
    );
} // End of function malformed_requests_and_selections_are_refused_by_name()

#[test]
fn a_hazardous_snippet_is_a_draft_refusal_naming_its_position() {
    let source = "matches:\n  - trigger: ':one'\n    replace: first\n  \
                  - trigger: ':two'\n    replace: &shared second\n";
    let (_, document) = projected(source);
    let refused = plan_bulk_option_edits(
        &document.source,
        &document.view,
        &ids(&document),
        &word_and_clipboard(),
    );
    assert!(
        matches!(refused, Err(BulkPlanError::Draft { index: 1, .. })),
        "{refused:?}"
    );
} // End of function a_hazardous_snippet_is_a_draft_refusal_naming_its_position()

#[test]
fn the_preflight_judges_the_candidate_without_touching_a_disk() {
    let (context, document) = projected(THREE);
    let edits = plan_bulk_option_edits(
        &document.source,
        &document.view,
        &ids(&document),
        &word_and_clipboard(),
    )
    .expect("it plans");
    let expected = apply_edits(&document.source, &edits).expect("it applies");
    // The detached context names a path that does not exist, so a preflight
    // that reached for the disk would fail rather than answer.
    let preflight = preflight_edits(&context, &document.source, &edits, &Acknowledgement::none())
        .expect("the preflight answers");
    assert_eq!(
        preflight.candidate,
        ContentRevision::of_bytes(expected.text().as_bytes())
    );
    assert!(preflight.changes);
    assert!(preflight.findings.is_empty());
    assert_eq!(preflight.verdict, SaveVerdict::Proceed);

    let unchanged = preflight_edits(&context, &document.source, &[], &Acknowledgement::none())
        .expect("an empty batch answers");
    assert!(!unchanged.changes);
    assert_eq!(unchanged.candidate, document.revision);
} // End of function the_preflight_judges_the_candidate_without_touching_a_disk()

#[test]
fn the_preflight_reports_a_suspicion_until_that_candidate_is_acknowledged() {
    let source = "matches:\n  - trigger: ':one'\n    replace: '{{nowhere}}'\n";
    let (context, document) = projected(source);
    let edits = plan_bulk_option_edits(
        &document.source,
        &document.view,
        &ids(&document),
        &word_and_clipboard(),
    )
    .expect("it plans");
    let first = preflight_edits(&context, &document.source, &edits, &Acknowledgement::none())
        .expect("it answers");
    assert_eq!(
        first.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    assert!(!first.findings.is_empty());
    let consent = Acknowledgement::of(&first.findings);
    let second = preflight_edits(&context, &document.source, &edits, &consent).expect("it answers");
    assert_eq!(second.verdict, SaveVerdict::Proceed);
    assert_eq!(second.candidate, first.candidate);
} // End of function the_preflight_reports_a_suspicion_until_that_candidate_is_acknowledged()

#[test]
fn the_preflight_refuses_a_package_file_before_patching() {
    let (mut context, document) = projected(THREE);
    context.kind = FileKind::Package;
    let refused = preflight_edits(&context, &document.source, &[], &Acknowledgement::none());
    assert!(matches!(refused, Err(SaveError::DocumentIsReadOnly { .. })));
} // End of function the_preflight_refuses_a_package_file_before_patching()

/// One `Set` change, as a request states it.
fn set(option: BulkOption, text: &str) -> BulkOptionChange {
    BulkOptionChange {
        option,
        value: BulkValue::Set(text.to_owned()),
    }
}

#[test]
fn inserting_absent_options_writes_plain_true_and_false() {
    // Phase 3-10's review blocker: a boolean option must be written as the
    // source text entered, `true`, never as the string `'true'`.
    let source = "matches:\n  - trigger: ':one'\n    replace: first\n";
    let (_, document) = projected(source);
    let changes = [
        set(BulkOption::Word, "true"),
        set(BulkOption::LeftWord, "false"),
        set(BulkOption::PropagateCase, "yes"),
    ];
    let edits = plan_bulk_option_edits(&document.source, &document.view, &ids(&document), &changes)
        .expect("it plans");
    let patched = apply_edits(&document.source, &edits).expect("plain source is written");
    assert_eq!(
        patched.text(),
        "matches:\n  - trigger: ':one'\n    replace: first\n    word: true\n    \
         left_word: false\n    propagate_case: yes\n"
    );
} // End of function inserting_absent_options_writes_plain_true_and_false()

#[test]
fn replacing_existing_options_writes_plain_true_and_false() {
    let source = "matches:\n  - trigger: ':one'\n    replace: first\n    word: false\n    \
                  left_word: 'false'\n    force_clipboard: \"off\"  # a note\n";
    let (_, document) = projected(source);
    let changes = [
        set(BulkOption::Word, "true"),
        set(BulkOption::LeftWord, "false"),
        set(BulkOption::ForceClipboard, "true"),
    ];
    let edits = plan_bulk_option_edits(&document.source, &document.view, &ids(&document), &changes)
        .expect("it plans");
    let patched = apply_edits(&document.source, &edits).expect("plain source is written");
    assert_eq!(
        patched.text(),
        "matches:\n  - trigger: ':one'\n    replace: first\n    word: true\n    \
         left_word: false\n    force_clipboard: true  # a note\n",
        "a different value, the same value spelled as a quoted string, and a value \
         with a trailing comment all become exactly the entered plain text"
    );
    let again = project_source(
        &DocumentContext::detached(DocumentId(0), "match/bulk.yml"),
        patched.text(),
    );
    let edits = plan_bulk_option_edits(&again.source, &again.view, &ids(&again), &changes)
        .expect("it plans");
    assert!(
        edits.is_empty(),
        "the exact plain spelling is already unchanged"
    );
} // End of function replacing_existing_options_writes_plain_true_and_false()

#[test]
fn a_text_that_is_not_one_plain_scalar_is_refused_rather_than_quoted() {
    for refused in [
        "",
        "'true'",
        "\"true\"",
        "yes # no",
        "a: b",
        "[x]",
        "{x: y}",
        "two\nlines",
        " padded",
        "padded ",
        "&anchor true",
        "*alias",
        "!!str true",
        "- item",
    ] {
        assert!(!is_plain_source(refused), "{refused:?} is not plain source");
        assert_eq!(
            check_bulk_changes(&[set(BulkOption::UppercaseStyle, refused)]),
            Err(BulkPlanError::OptionNotPlainSource {
                option: BulkOption::UppercaseStyle
            }),
            "{refused:?} is refused by name"
        );
    } // End of the loop over spellings a plain scalar cannot carry
    for accepted in [
        "true",
        "false",
        "yes",
        "clipboard",
        "capitalize_words",
        "a b",
        "0",
    ] {
        assert!(is_plain_source(accepted), "{accepted:?} is plain source");
    }
} // End of function a_text_that_is_not_one_plain_scalar_is_refused_rather_than_quoted()

#[test]
fn the_engine_refuses_plain_source_that_does_not_read_back() {
    // The planner's check is a statement about a probe; the engine re-checks
    // the property on the real candidate, so a caller that skipped the planner
    // still cannot get quoted or reinterpreted bytes written.
    let source = "matches:\n  - trigger: ':one'\n    replace: first\n    word: false\n";
    let path = DocumentPath::root(0)
        .with_key("matches")
        .with_index(0)
        .with_key("word");
    let refused = apply_edits(
        source,
        &[DocumentEdit::Scalar(ScalarEdit::plain_source(
            path, "yes # no",
        ))],
    );
    assert!(
        matches!(
            refused,
            Err(EditError::Verification(
                VerificationFailure::PlainSourceNotReadBack { .. }
            ))
        ),
        "{refused:?}"
    );
} // End of function the_engine_refuses_plain_source_that_does_not_read_back()
