//! Phase 3-1 acceptance: compositional mapping edits and scalar form
//! substitution.
//!
//! Two capabilities, both core-only:
//!
//! - **grouped insertion** — several absent fields drafted at once are written
//!   by one batch as one ordered [`FieldInsertGroup`] after an anchor the batch
//!   leaves alone;
//! - **substitution** — a closed [`FieldSubstitution`] renames `trigger`↔`regex`
//!   or one content key to another in place, including on the first entry of a
//!   compact `- trigger: …` item, whose `-` must not move.
//!
//! # Independent checks
//!
//! Every success is checked **independently of the engine's own verifier**
//! ([`assert_independently`]): the bytes outside the replacements the engine
//! reports are compared with the source by this file's own walk, every comment
//! is compared text for text, and the candidate is re-projected so that every
//! field the batch did not name is compared — value *and* source spelling — with
//! the original projection, match by match.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).

use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::draft::{
    check_batch_independence, check_closed_surface, plan_match_edits,
    plan_match_edits_with_substitutions, ContentForm, ContentSwitch, DraftError, FieldSubstitution,
    MatchDraft, MatchField, TriggerForm,
};
use espansoconfig_core::model::{DocumentContext, MatchView, ScalarView};
use espansoconfig_core::patch::{
    apply_edits, DocumentEdit, DocumentPath, EditError, FieldInsert, FieldInsertGroup,
    FieldRemoval, KeySubstitution, PatchedDocument,
};
use espansoconfig_core::persist::{save_document, Acknowledgement, SaveContent, SaveRequest};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::{ContentRevision, DocumentId};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/// A match with a comment above it, an inline comment on its compact first
/// line and a comment between two entries, followed by a second match, so every
/// success has trivia and a neighbour to lose.
const COMMENTED: &str = "\
# file header comment
matches:
  # the greeting
  - trigger: ':hi'  # inline on the trigger
    # between trigger and replace
    replace: hello there
    label: greeting
  - trigger: ':bye'
    replace: goodbye
";

/// The content key **first**, on the compact line, and the trigger after it:
/// the other source order `replace`→`markdown` must work in.
const CONTENT_FIRST: &str = "\
matches:
  - replace: 'hello there'  # inline on the content
    trigger: ':hi'
    word: 'true'
  - trigger: ':bye'
    replace: goodbye
";

/// A quoted key and a block-scalar value, so a substitution has a key style
/// and a value presentation to keep.
const QUOTED_KEY: &str = "\
matches:
  - trigger: ':hi'
    'replace': |
      first line
      second line
    label: greeting
";

/// The first match of `source`, projected the way the workspace projects it.
fn first_match(source: &str) -> MatchView {
    all_matches(source)
        .into_iter()
        .next()
        .expect("the fixture holds a match")
}

/// Every match of `source`, projected the way the workspace projects it.
fn all_matches(source: &str) -> Vec<MatchView> {
    let context = DocumentContext::detached(DocumentId(0), "compose.yml");
    project_source(&context, source).view.matches
}

/// The path of the first match's mapping.
fn first_mapping() -> DocumentPath {
    DocumentPath::root(0).with_key("matches").with_index(0)
}

/// The comment text of every line that holds one, in order: everything from
/// the first `#` to the end of the line. No fixture here holds a `#` inside a
/// value, so this is exact for them.
fn comments(text: &str) -> Vec<String> {
    text.lines()
        .filter_map(|line| line.find('#').map(|at| line[at..].to_owned()))
        .collect()
}

/// The projected scalar of one schema-known field.
fn scalar(view: &MatchView, field: MatchField) -> Option<&ScalarView> {
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
} // End of function scalar()

/// A field's decoded value and its source spelling, or `None` when absent.
fn spelled(source: &str, view: &MatchView, field: MatchField) -> Option<(String, String)> {
    scalar(view, field).map(|held| {
        (
            held.text.clone(),
            source[held.span.start..held.span.end].to_owned(),
        )
    })
}

/// What one success must look like, stated by the test rather than by the
/// engine.
struct Expectation<'a> {
    /// Fields of the first match whose value or presence the batch changes,
    /// with the decoded value each must hold afterwards (`None`: absent).
    changed: &'a [(MatchField, Option<&'a str>)],
    /// Fields whose value must be the **same bytes** as another field's value
    /// in the source: `(after, before)` — a substitution that keeps the value.
    carried: &'a [(MatchField, MatchField)],
}

/// Checks one success **independently of the engine's verifier**.
///
/// 1. every byte outside the replacements the engine reports is the source's
///    own, walked here in ascending order;
/// 2. every comment of the source is in the candidate, in order and text for
///    text;
/// 3. the candidate re-projects with the same number of matches, every match
///    after the first is identical field by field, value and spelling;
/// 4. every field of the first match the expectation does not name keeps its
///    value and its spelling; every named one holds its expected value; every
///    carried one holds the source's exact bytes of the field it came from;
/// 5. `triggers`, `search_terms`, `vars`, `form_fields` and the unknown entries
///    of the first match are untouched in number.
fn assert_independently(source: &str, patched: &PatchedDocument, expected: &Expectation<'_>) {
    let candidate = patched.text();

    // 1. Bytes outside the replacements.
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

    // 2. Comments.
    assert_eq!(
        comments(candidate),
        comments(source),
        "every comment survives"
    );

    // 3. Every other match.
    let before = all_matches(source);
    let after = all_matches(candidate);
    assert_eq!(after.len(), before.len(), "no match appears or disappears");
    for (was, is) in before.iter().zip(&after).skip(1) {
        for field in MatchField::ALL {
            assert_eq!(
                spelled(candidate, is, field),
                spelled(source, was, field),
                "a neighbouring match's {} changed",
                field.key()
            );
        }
    } // End of the loop over the matches the batch did not name

    // 4. The first match, field by field.
    let (was, is) = (&before[0], &after[0]);
    for field in MatchField::ALL {
        if let Some((_, value)) = expected.changed.iter().find(|(named, _)| *named == field) {
            assert_eq!(
                scalar(is, field).map(|held| held.text.as_str()),
                *value,
                "{} does not hold the intended value",
                field.key()
            );
            if let Some((_, from)) = expected.carried.iter().find(|(to, _)| *to == field) {
                assert_eq!(
                    spelled(candidate, is, field).map(|(_, bytes)| bytes),
                    spelled(source, was, *from).map(|(_, bytes)| bytes),
                    "{} does not carry {}'s bytes",
                    field.key(),
                    from.key()
                );
            }
            continue;
        }
        assert_eq!(
            spelled(candidate, is, field),
            spelled(source, was, field),
            "an untouched {} changed",
            field.key()
        );
    } // End of the loop over the first match's fields

    // 5. The parts of the match no scalar field describes.
    assert_eq!(is.trigger.triggers.len(), was.trigger.triggers.len());
    assert_eq!(is.search_terms.len(), was.search_terms.len());
    assert_eq!(is.vars.len(), was.vars.len());
    assert_eq!(is.form_fields.len(), was.form_fields.len());
    assert_eq!(is.unknown_entries.len(), was.unknown_entries.len());
    assert!(is.safely_editable, "the result is still editable");
} // End of function assert_independently()

/// The trigger substitution in one direction.
fn trigger_to_regex() -> FieldSubstitution {
    FieldSubstitution::Trigger {
        from: TriggerForm::Trigger,
        to: TriggerForm::Regex,
    }
}

/// The content substitution `replace`→`markdown`.
fn replace_to_markdown() -> FieldSubstitution {
    FieldSubstitution::Content {
        from: ContentForm::Replace,
        to: ContentForm::Markdown,
    }
}

// ---------------------------------------------------------------------------
// Grouped insertion
// ---------------------------------------------------------------------------

/// **The failing-first test of Phase 3-1.** One batch from the draft planner
/// adds two absent options to one match, and the result holds both, in the
/// planner's order, directly after the anchor, with every other byte intact.
///
/// On the tree before Phase 3-1 this failed at the `expect` below with
/// `SharedInsertionAnchor { first: 0, second: 1 }`.
#[test]
fn one_save_adds_two_absent_options() {
    let view = first_match(COMMENTED);
    let draft = MatchDraft::new()
        .with(MatchField::Word, "true")
        .with(MatchField::PropagateCase, "true");
    let edits = plan_match_edits(&view, &draft).expect("two absent options plan as one batch");
    let patched = apply_edits(COMMENTED, &edits).expect("and the batch applies");

    let expected = COMMENTED.replace(
        "    label: greeting\n",
        "    label: greeting\n    word: 'true'\n    propagate_case: 'true'\n",
    );
    assert_eq!(patched.text(), expected);
    assert_independently(
        COMMENTED,
        &patched,
        &Expectation {
            changed: &[
                (MatchField::Word, Some("true")),
                (MatchField::PropagateCase, Some("true")),
            ],
            carried: &[],
        },
    );
} // End of function one_save_adds_two_absent_options()

/// The planner writes several absent fields as **one** ordered group, in
/// `MatchField::ALL` order, anchored on the last entry.
#[test]
fn several_absent_fields_are_one_group_in_schema_order() {
    let view = first_match(COMMENTED);
    let draft = MatchDraft::new()
        .with(MatchField::Comment, "a note")
        .with(MatchField::Word, "true")
        .with(MatchField::ForceMode, "clipboard");
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    let [DocumentEdit::InsertFields(group)] = edits.as_slice() else {
        panic!("three absent fields are one group: {edits:?}");
    };
    assert_eq!(group.sibling(), Some("label"));
    let keys: Vec<&str> = group
        .entries()
        .iter()
        .map(|(key, _)| key.as_str())
        .collect();
    assert_eq!(keys, ["comment", "word", "force_mode"]);

    let patched = apply_edits(COMMENTED, &edits).expect("the group applies");
    assert!(patched.text().contains(
        "    label: greeting\n    comment: a note\n    word: 'true'\n    force_mode: clipboard\n  - trigger: ':bye'"
    ));
    assert_independently(
        COMMENTED,
        &patched,
        &Expectation {
            changed: &[
                (MatchField::Comment, Some("a note")),
                (MatchField::Word, Some("true")),
                (MatchField::ForceMode, Some("clipboard")),
            ],
            carried: &[],
        },
    );
} // End of function several_absent_fields_are_one_group_in_schema_order()

/// A group at the very end of a file with no final newline keeps the file not
/// ending in one, and writes each entry on its own line.
#[test]
fn a_group_at_the_end_of_a_file_without_a_final_newline() {
    let source = "matches:\n  - trigger: ':hi'\n    replace: hello";
    let view = first_match(source);
    let draft = MatchDraft::new()
        .with(MatchField::Label, "greeting")
        .with(MatchField::Word, "true");
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    let patched = apply_edits(source, &edits).expect("the group applies");
    assert_eq!(
        patched.text(),
        "matches:\n  - trigger: ':hi'\n    replace: hello\n    label: greeting\n    word: 'true'"
    );
    assert_independently(
        source,
        &patched,
        &Expectation {
            changed: &[
                (MatchField::Label, Some("greeting")),
                (MatchField::Word, Some("true")),
            ],
            carried: &[],
        },
    );
} // End of function a_group_at_the_end_of_a_file_without_a_final_newline()

/// A group follows a CRLF anchor's own line ending, entry by entry.
#[test]
fn a_group_writes_the_anchors_line_ending() {
    let source = "matches:\r\n  - trigger: ':hi'\r\n    replace: hello\r\n";
    let view = first_match(source);
    let draft = MatchDraft::new()
        .with(MatchField::Label, "greeting")
        .with(MatchField::Word, "true");
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    let patched = apply_edits(source, &edits).expect("the group applies");
    assert_eq!(
        patched.text(),
        "matches:\r\n  - trigger: ':hi'\r\n    replace: hello\r\n    label: greeting\r\n    word: 'true'\r\n"
    );
} // End of function a_group_writes_the_anchors_line_ending()

/// A hand-built group applies through the engine directly, in the order it
/// states — not in any order the engine could choose.
#[test]
fn the_engine_writes_a_group_in_its_own_order() {
    let group = FieldInsertGroup::after(
        first_mapping(),
        "replace",
        vec![
            ("word".to_owned(), "true".to_owned()),
            ("comment".to_owned(), "a note".to_owned()),
        ],
    )
    .expect("a non-empty group");
    let patched = apply_edits(COMMENTED, &[group.into()]).expect("the group applies");
    assert!(patched.text().contains(
        "    replace: hello there\n    word: 'true'\n    comment: a note\n    label: greeting\n"
    ));
    assert_independently(
        COMMENTED,
        &patched,
        &Expectation {
            changed: &[
                (MatchField::Word, Some("true")),
                (MatchField::Comment, Some("a note")),
            ],
            carried: &[],
        },
    );
} // End of function the_engine_writes_a_group_in_its_own_order()

/// An empty group has no spelling.
#[test]
fn an_empty_group_cannot_be_built() {
    assert!(FieldInsertGroup::new(first_mapping(), Vec::new()).is_none());
    assert!(FieldInsertGroup::after(first_mapping(), "label", Vec::new()).is_none());
}

// ---------------------------------------------------------------------------
// Substitution
// ---------------------------------------------------------------------------

/// `trigger`→`regex` on a **compact first line**: the key token changes, and
/// the dash, the value's quotes and the inline comment stay byte for byte.
#[test]
fn trigger_becomes_regex_on_a_compact_first_line() {
    let view = first_match(COMMENTED);
    let edits =
        plan_match_edits_with_substitutions(&view, &MatchDraft::new(), &[trigger_to_regex()])
            .expect("the substitution plans");
    let [DocumentEdit::SubstituteKey(substitution)] = edits.as_slice() else {
        panic!("one substitution is one edit: {edits:?}");
    };
    assert_eq!(substitution.key(), "regex");
    assert_eq!(substitution.value(), None, "no new value was drafted");

    let patched = apply_edits(COMMENTED, &edits).expect("the substitution applies");
    assert_eq!(
        patched.text(),
        COMMENTED.replacen("  - trigger: ':hi'", "  - regex: ':hi'", 1)
    );
    assert_eq!(
        patched.replacements().len(),
        1,
        "the key token and nothing else"
    );
    assert_independently(
        COMMENTED,
        &patched,
        &Expectation {
            changed: &[
                (MatchField::Trigger, None),
                (MatchField::Regex, Some(":hi")),
            ],
            carried: &[(MatchField::Regex, MatchField::Trigger)],
        },
    );
} // End of function trigger_becomes_regex_on_a_compact_first_line()

/// The same substitution with a new value drafted on the destination key: the
/// value is rewritten in the old value's style, and the dash still stays.
#[test]
fn trigger_becomes_regex_with_a_new_value() {
    let view = first_match(COMMENTED);
    let draft = MatchDraft::new().with(MatchField::Regex, ":h(i|ey)");
    let edits = plan_match_edits_with_substitutions(&view, &draft, &[trigger_to_regex()])
        .expect("the substitution plans");
    let patched = apply_edits(COMMENTED, &edits).expect("the substitution applies");
    assert_eq!(
        patched.text(),
        COMMENTED.replacen("  - trigger: ':hi'", "  - regex: ':h(i|ey)'", 1)
    );
    assert_independently(
        COMMENTED,
        &patched,
        &Expectation {
            changed: &[
                (MatchField::Trigger, None),
                (MatchField::Regex, Some(":h(i|ey)")),
            ],
            carried: &[],
        },
    );
} // End of function trigger_becomes_regex_with_a_new_value()

/// A drafted destination value equal to the value already there is not a new
/// value: the bytes are kept.
#[test]
fn a_destination_value_equal_to_the_old_one_keeps_the_bytes() {
    let view = first_match(COMMENTED);
    let draft = MatchDraft::new().with(MatchField::Regex, ":hi");
    let edits = plan_match_edits_with_substitutions(&view, &draft, &[trigger_to_regex()])
        .expect("the substitution plans");
    let [DocumentEdit::SubstituteKey(substitution)] = edits.as_slice() else {
        panic!("one substitution is one edit: {edits:?}");
    };
    assert_eq!(substitution.value(), None);
} // End of function a_destination_value_equal_to_the_old_one_keeps_the_bytes()

/// `replace`→`markdown` with the content key **after** the trigger.
#[test]
fn replace_becomes_markdown_after_the_trigger() {
    let view = first_match(COMMENTED);
    let edits =
        plan_match_edits_with_substitutions(&view, &MatchDraft::new(), &[replace_to_markdown()])
            .expect("the substitution plans");
    let patched = apply_edits(COMMENTED, &edits).expect("the substitution applies");
    assert_eq!(
        patched.text(),
        COMMENTED.replacen("    replace: hello there", "    markdown: hello there", 1)
    );
    assert_independently(
        COMMENTED,
        &patched,
        &Expectation {
            changed: &[
                (MatchField::Replace, None),
                (MatchField::Markdown, Some("hello there")),
            ],
            carried: &[(MatchField::Markdown, MatchField::Replace)],
        },
    );
} // End of function replace_becomes_markdown_after_the_trigger()

/// `replace`→`markdown` with the content key **first**, on the compact line.
#[test]
fn replace_becomes_markdown_before_the_trigger() {
    let view = first_match(CONTENT_FIRST);
    let edits =
        plan_match_edits_with_substitutions(&view, &MatchDraft::new(), &[replace_to_markdown()])
            .expect("the substitution plans");
    let patched = apply_edits(CONTENT_FIRST, &edits).expect("the substitution applies");
    assert_eq!(
        patched.text(),
        CONTENT_FIRST.replacen(
            "  - replace: 'hello there'",
            "  - markdown: 'hello there'",
            1
        )
    );
    assert_independently(
        CONTENT_FIRST,
        &patched,
        &Expectation {
            changed: &[
                (MatchField::Replace, None),
                (MatchField::Markdown, Some("hello there")),
            ],
            carried: &[(MatchField::Markdown, MatchField::Replace)],
        },
    );
} // End of function replace_becomes_markdown_before_the_trigger()

/// A quoted key stays quoted, and a block-scalar value keeps its bytes.
#[test]
fn a_quoted_key_keeps_its_style_and_a_block_value_its_bytes() {
    let view = first_match(QUOTED_KEY);
    let edits =
        plan_match_edits_with_substitutions(&view, &MatchDraft::new(), &[replace_to_markdown()])
            .expect("the substitution plans");
    let patched = apply_edits(QUOTED_KEY, &edits).expect("the substitution applies");
    assert_eq!(
        patched.text(),
        QUOTED_KEY.replacen("    'replace': |", "    'markdown': |", 1)
    );
    assert_independently(
        QUOTED_KEY,
        &patched,
        &Expectation {
            changed: &[
                (MatchField::Replace, None),
                (MatchField::Markdown, Some("first line\nsecond line\n")),
            ],
            carried: &[(MatchField::Markdown, MatchField::Replace)],
        },
    );
} // End of function a_quoted_key_keeps_its_style_and_a_block_value_its_bytes()

/// Everything at once: both substitutions and two absent options, one batch.
#[test]
fn a_switch_and_two_new_options_are_one_batch() {
    let view = first_match(COMMENTED);
    let draft = MatchDraft::new()
        .with(MatchField::Word, "true")
        .with(MatchField::PropagateCase, "true");
    let edits = plan_match_edits_with_substitutions(
        &view,
        &draft,
        &[trigger_to_regex(), replace_to_markdown()],
    )
    .expect("the draft plans");
    let patched = apply_edits(COMMENTED, &edits).expect("the batch applies");
    let expected = COMMENTED
        .replacen("  - trigger: ':hi'", "  - regex: ':hi'", 1)
        .replacen("    replace: hello there", "    markdown: hello there", 1)
        .replacen(
            "    label: greeting\n",
            "    label: greeting\n    word: 'true'\n    propagate_case: 'true'\n",
            1,
        );
    assert_eq!(patched.text(), expected);
    assert_independently(
        COMMENTED,
        &patched,
        &Expectation {
            changed: &[
                (MatchField::Trigger, None),
                (MatchField::Regex, Some(":hi")),
                (MatchField::Replace, None),
                (MatchField::Markdown, Some("hello there")),
                (MatchField::Word, Some("true")),
                (MatchField::PropagateCase, Some("true")),
            ],
            carried: &[
                (MatchField::Regex, MatchField::Trigger),
                (MatchField::Markdown, MatchField::Replace),
            ],
        },
    );
} // End of function a_switch_and_two_new_options_are_one_batch()

/// When the last entry is renamed, an insertion is anchored on the last entry
/// the batch leaves alone rather than on the renamed one.
#[test]
fn an_insertion_is_never_anchored_on_a_renamed_entry() {
    let source = "matches:\n  - trigger: ':hi'\n    replace: hello\n";
    let view = first_match(source);
    let draft = MatchDraft::new().with(MatchField::Label, "greeting");
    let edits = plan_match_edits_with_substitutions(&view, &draft, &[replace_to_markdown()])
        .expect("the draft plans");
    let insert = edits
        .iter()
        .find_map(|edit| match edit {
            DocumentEdit::InsertField(insert) => Some(insert),
            _ => None,
        })
        .expect("one insertion");
    assert_eq!(insert.sibling(), Some("trigger"));
    let patched = apply_edits(source, &edits).expect("the batch applies");
    assert_eq!(
        patched.text(),
        "matches:\n  - trigger: ':hi'\n    label: greeting\n    markdown: hello\n"
    );
} // End of function an_insertion_is_never_anchored_on_a_renamed_entry()

// ---------------------------------------------------------------------------
// Refusals, by name
// ---------------------------------------------------------------------------

/// **Stale anchor**, at the planner: the substitution names a key the match no
/// longer holds.
#[test]
fn a_substitution_of_an_absent_key_is_refused_as_stale() {
    let view = first_match("matches:\n  - regex: 'h(i)'\n    replace: hello\n");
    assert_eq!(
        plan_match_edits_with_substitutions(&view, &MatchDraft::new(), &[trigger_to_regex()]),
        Err(DraftError::SubstitutionSourceAbsent {
            field: MatchField::Trigger,
        })
    );
} // End of function a_substitution_of_an_absent_key_is_refused_as_stale()

/// **Stale anchor**, at the guard: a group anchored on a key the original
/// mapping does not have.
#[test]
fn a_group_anchored_on_a_key_not_in_the_original_is_refused() {
    let group = FieldInsertGroup::after(
        first_mapping(),
        "label",
        vec![
            ("word".to_owned(), "true".to_owned()),
            ("comment".to_owned(), "a note".to_owned()),
        ],
    )
    .expect("a non-empty group");
    assert_eq!(
        check_batch_independence(
            &first_mapping(),
            &["trigger".to_owned(), "replace".to_owned()],
            &[],
            &[group.into()],
        ),
        Err(DraftError::InsertionAnchorNotInOriginal { edit: 0 })
    );
} // End of function a_group_anchored_on_a_key_not_in_the_original_is_refused()

/// **Stale anchor**, at the engine: a batch planned against one text and
/// applied to a newer one whose anchor is gone.
#[test]
fn the_engine_refuses_a_group_whose_anchor_is_gone() {
    let planned = plan_match_edits(
        &first_match(COMMENTED),
        &MatchDraft::new()
            .with(MatchField::Word, "true")
            .with(MatchField::Comment, "a note"),
    )
    .expect("the draft plans");
    let newer = COMMENTED.replacen("    label: greeting\n", "", 1);
    assert!(matches!(
        apply_edits(&newer, &planned),
        Err(EditError::NoSuchSibling { edit: 0, .. })
    ));
} // End of function the_engine_refuses_a_group_whose_anchor_is_gone()

/// **Removed anchor**, at the guard: a group anchored on a key the same batch
/// removes, and one anchored on a key the same batch renames.
#[test]
fn a_group_anchored_on_a_removed_or_renamed_key_is_refused() {
    let mapping = first_mapping();
    let group = || {
        DocumentEdit::from(
            FieldInsertGroup::after(
                mapping.clone(),
                "replace",
                vec![
                    ("word".to_owned(), "true".to_owned()),
                    ("comment".to_owned(), "a note".to_owned()),
                ],
            )
            .expect("a non-empty group"),
        )
    };
    let original = [
        "trigger".to_owned(),
        "replace".to_owned(),
        "label".to_owned(),
    ];
    let removed = [
        DocumentEdit::from(FieldRemoval::new(mapping.clone().with_key("replace"))),
        group(),
    ];
    assert_eq!(
        check_batch_independence(&mapping, &original, &[], &removed),
        Err(DraftError::InsertionAnchorRemoved { edit: 1 })
    );
    let renamed = [
        DocumentEdit::from(KeySubstitution::new(
            mapping.clone().with_key("replace"),
            "markdown",
        )),
        group(),
    ];
    assert_eq!(
        check_batch_independence(&mapping, &original, &[], &renamed),
        Err(DraftError::InsertionAnchorRemoved { edit: 1 })
    );
} // End of function a_group_anchored_on_a_removed_or_renamed_key_is_refused()

/// Two insertion **edits** sharing an anchor are still refused; one group is
/// not.
#[test]
fn two_insertion_edits_after_one_anchor_are_still_refused() {
    let mapping = first_mapping();
    let original = ["trigger".to_owned(), "replace".to_owned()];
    let group = FieldInsertGroup::after(
        mapping.clone(),
        "replace",
        vec![("word".to_owned(), "true".to_owned())],
    )
    .expect("a non-empty group");
    let separate = [
        DocumentEdit::from(FieldInsert::after(mapping.clone(), "replace", "label", "x")),
        group.clone().into(),
    ];
    assert_eq!(
        check_batch_independence(&mapping, &original, &[], &separate),
        Err(DraftError::SharedInsertionAnchor {
            first: 0,
            second: 1
        })
    );
    assert_eq!(
        check_batch_independence(&mapping, &original, &[], &[group.into()]),
        Ok(())
    );
} // End of function two_insertion_edits_after_one_anchor_are_still_refused()

/// **Duplicate key**, at the planner: substituting to a key the match holds.
#[test]
fn a_substitution_to_a_key_the_match_holds_is_refused() {
    let view = first_match("matches:\n  - trigger: ':hi'\n    replace: a\n    markdown: b\n");
    assert_eq!(
        plan_match_edits_with_substitutions(&view, &MatchDraft::new(), &[replace_to_markdown()]),
        Err(DraftError::SubstitutionTargetPresent {
            field: MatchField::Markdown,
        })
    );
} // End of function a_substitution_to_a_key_the_match_holds_is_refused()

/// **Duplicate key**, at the guard and at the engine, on a hand-built batch.
#[test]
fn a_substitution_to_a_present_key_is_refused_by_the_guard_and_the_engine() {
    let mapping = first_mapping();
    let source = "matches:\n  - trigger: ':hi'\n    replace: a\n    markdown: b\n";
    let edit = DocumentEdit::from(KeySubstitution::new(
        mapping.clone().with_key("replace"),
        "markdown",
    ));
    assert_eq!(
        check_batch_independence(
            &mapping,
            &[
                "trigger".to_owned(),
                "replace".to_owned(),
                "markdown".to_owned()
            ],
            &[],
            std::slice::from_ref(&edit),
        ),
        Err(DraftError::SubstitutionTargetPresent {
            field: MatchField::Markdown,
        })
    );
    assert!(matches!(
        apply_edits(source, &[edit]),
        Err(EditError::KeyAlreadyPresent { edit: 0, .. })
    ));
} // End of function a_substitution_to_a_present_key_is_refused_by_the_guard_and_the_engine()

/// **Duplicate key**, at the engine: a group holding a key the mapping has, or
/// holding one key twice.
#[test]
fn a_group_with_a_duplicate_key_is_refused() {
    let present = FieldInsertGroup::after(
        first_mapping(),
        "label",
        vec![
            ("word".to_owned(), "true".to_owned()),
            ("replace".to_owned(), "again".to_owned()),
        ],
    )
    .expect("a non-empty group");
    assert!(matches!(
        apply_edits(COMMENTED, &[present.into()]),
        Err(EditError::KeyAlreadyPresent { edit: 0, .. })
    ));
    let twice = FieldInsertGroup::after(
        first_mapping(),
        "label",
        vec![
            ("word".to_owned(), "true".to_owned()),
            ("word".to_owned(), "false".to_owned()),
        ],
    )
    .expect("a non-empty group");
    assert!(matches!(
        apply_edits(COMMENTED, &[twice.into()]),
        Err(EditError::KeyAlreadyPresent { edit: 0, .. })
    ));
} // End of function a_group_with_a_duplicate_key_is_refused()

/// A substitution and another intent about one of its keys are refused at
/// intent level.
#[test]
fn a_substitution_that_conflicts_with_another_intent_is_refused() {
    let view = first_match(COMMENTED);
    let conflict = |draft: MatchDraft, substitutions: &[FieldSubstitution]| {
        plan_match_edits_with_substitutions(&view, &draft, substitutions)
    };
    assert_eq!(
        conflict(
            MatchDraft::new().with(MatchField::Trigger, ":new"),
            &[trigger_to_regex()]
        ),
        Err(DraftError::SubstitutionConflictsWithField {
            field: MatchField::Trigger,
        })
    );
    assert_eq!(
        conflict(
            MatchDraft::new().without(MatchField::Regex),
            &[trigger_to_regex()]
        ),
        Err(DraftError::SubstitutionConflictsWithField {
            field: MatchField::Regex,
        })
    );
    let other = FieldSubstitution::Content {
        from: ContentForm::Replace,
        to: ContentForm::Html,
    };
    assert_eq!(
        conflict(MatchDraft::new(), &[replace_to_markdown(), other]),
        Err(DraftError::SubstitutionConflictsWithField {
            field: MatchField::Replace,
        })
    );
} // End of function a_substitution_that_conflicts_with_another_intent_is_refused()

/// A substitution across families, or to the same key, is outside the closed
/// surface.
#[test]
fn a_substitution_across_families_is_outside_the_surface() {
    assert_eq!(
        FieldSubstitution::between(MatchField::Trigger, MatchField::Replace),
        None
    );
    assert_eq!(
        FieldSubstitution::between(MatchField::Replace, MatchField::Replace),
        None
    );
    assert_eq!(
        FieldSubstitution::between(MatchField::Regex, MatchField::Trigger),
        Some(FieldSubstitution::Trigger {
            from: TriggerForm::Regex,
            to: TriggerForm::Trigger,
        })
    );
    let mapping = first_mapping();
    let across = DocumentEdit::from(KeySubstitution::new(
        mapping.clone().with_key("trigger"),
        "replace",
    ));
    assert_eq!(
        check_closed_surface(&mapping, &[across]),
        Err(DraftError::OutsideTheClosedSurface { edit: 0 })
    );
} // End of function a_substitution_across_families_is_outside_the_surface()

/// A substitution naming a sequence element names no mapping entry.
#[test]
fn the_engine_refuses_a_substitution_of_a_sequence_element() {
    let source = "matches:\n  - triggers:\n      - ':a'\n    replace: x\n";
    let edit = KeySubstitution::new(first_mapping().with_key("triggers").with_index(0), "regex");
    assert!(matches!(
        apply_edits(source, &[edit.into()]),
        Err(EditError::NotAMapping { edit: 0, .. })
    ));
} // End of function the_engine_refuses_a_substitution_of_a_sequence_element()

/// A substitution of an entry whose value is a collection is not a
/// scalar-to-scalar substitution.
#[test]
fn the_engine_refuses_a_substitution_of_a_collection_value() {
    let source = "matches:\n  - trigger: ':a'\n    replace:\n      - one\n";
    let edit = KeySubstitution::new(first_mapping().with_key("replace"), "markdown");
    assert!(matches!(
        apply_edits(source, &[edit.into()]),
        Err(EditError::NotAScalar { edit: 0, .. })
    ));
} // End of function the_engine_refuses_a_substitution_of_a_collection_value()

// ---------------------------------------------------------------------------
// Through the save transaction (ruling 16)
// ---------------------------------------------------------------------------

/// A temp directory holding one match file with the given text.
fn on_disk(source: &str) -> (tempfile::TempDir, std::path::PathBuf) {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("base.yml");
    std::fs::write(&target, source.as_bytes()).expect("the fixture file is written");
    (directory, target)
}

/// One save of `edits` against `target`, based on `source`.
fn save(
    target: &std::path::Path,
    source: &str,
    edits: &[DocumentEdit],
) -> Result<espansoconfig_core::persist::SavedDocument, espansoconfig_core::persist::SaveError> {
    let context = DocumentContext {
        id: DocumentId(1),
        path: target.to_path_buf(),
        relative_path: std::path::PathBuf::from("base.yml"),
        kind: FileKind::MatchFile,
        disabled: false,
    };
    save_document(SaveRequest {
        context: &context,
        base_revision: ContentRevision::of_bytes(source.as_bytes()),
        content: SaveContent::Edits(edits),
        acknowledgement: &Acknowledgement::none(),
        backups: None,
    })
} // End of function save()

/// A switch plus two new options commits through `save_document`, and the
/// bytes on disk are the candidate the engine verified.
#[test]
fn a_composed_batch_commits_through_the_save_transaction() {
    let (_directory, target) = on_disk(COMMENTED);
    let edits = plan_match_edits_with_substitutions(
        &first_match(COMMENTED),
        &MatchDraft::new()
            .with(MatchField::Word, "true")
            .with(MatchField::PropagateCase, "true"),
        &[trigger_to_regex(), replace_to_markdown()],
    )
    .expect("the draft plans");
    let saved = save(&target, COMMENTED, &edits).expect("the save commits");
    assert!(saved.committed);
    let written = std::fs::read_to_string(&target).expect("the file is readable");
    assert_eq!(written, saved.text);
    assert_eq!(comments(&written), comments(COMMENTED));
} // End of function a_composed_batch_commits_through_the_save_transaction()

/// A refused substitution writes no byte.
#[test]
fn a_refused_substitution_writes_nothing() {
    let source = "matches:\n  - trigger: ':hi'\n    replace: a\n    markdown: b\n";
    let (_directory, target) = on_disk(source);
    let edit = DocumentEdit::from(KeySubstitution::new(
        first_mapping().with_key("replace"),
        "markdown",
    ));
    let error = save(&target, source, &[edit]).expect_err("the save is refused");
    assert!(error.is_refusal(), "{error}");
    assert!(!error.may_have_written(), "{error}");
    assert_eq!(
        std::fs::read_to_string(&target).expect("the file is readable"),
        source
    );
} // End of function a_refused_substitution_writes_nothing()

// ---------------------------------------------------------------------------
// Phase 3-5-1: the content switch as a field of the draft
// ---------------------------------------------------------------------------

/// `replace`→`markdown` as the draft's own `content_switch`.
fn drafted_switch() -> ContentSwitch {
    ContentSwitch::new(ContentForm::Replace, ContentForm::Markdown).expect("two different forms")
}

/// A draft carrying a content switch plans through `plan_match_edits` alone,
/// exactly as the 3-1 substitution argument does: the key renamed in place, the
/// value's bytes kept.
#[test]
fn a_drafted_content_switch_plans_through_plan_match_edits() {
    for source in [COMMENTED, CONTENT_FIRST, QUOTED_KEY] {
        let view = first_match(source);
        let drafted = plan_match_edits(
            &view,
            &MatchDraft::new().with_content_switch(drafted_switch()),
        )
        .expect("the drafted switch plans");
        let argued = plan_match_edits_with_substitutions(
            &view,
            &MatchDraft::new(),
            &[replace_to_markdown()],
        )
        .expect("the argued substitution plans");
        assert_eq!(drafted, argued, "one switch, two spellings, one batch");
        let patched = apply_edits(source, &drafted).expect("the switch applies");
        assert_eq!(comments(patched.text()), comments(source));
        let after = first_match(patched.text());
        assert!(scalar(&after, MatchField::Replace).is_none());
        assert_eq!(
            scalar(&after, MatchField::Markdown).map(|one| one.text.clone()),
            scalar(&view, MatchField::Replace).map(|one| one.text.clone())
        );
    } // End of the loop over the three source shapes
} // End of function a_drafted_content_switch_plans_through_plan_match_edits()

/// The destination's drafted value is the renamed entry's new value, and the
/// switch is one batch with the other drafted fields.
#[test]
fn a_drafted_switch_carries_the_destination_value_and_other_fields() {
    let view = first_match(COMMENTED);
    let draft = MatchDraft::new()
        .with(MatchField::Markdown, "hello **there**")
        .with(MatchField::Paragraph, "true")
        .with_content_switch(drafted_switch());
    let edits = plan_match_edits(&view, &draft).expect("the draft plans");
    let patched = apply_edits(COMMENTED, &edits).expect("the draft applies");
    assert!(
        patched.text().contains("    markdown: hello **there**\n"),
        "{}",
        patched.text()
    );
    let after = first_match(patched.text());
    assert!(scalar(&after, MatchField::Replace).is_none());
    assert_eq!(
        scalar(&after, MatchField::Paragraph).map(|one| one.text.as_str()),
        Some("true")
    );
    assert_eq!(comments(patched.text()), comments(COMMENTED));
} // End of function a_drafted_switch_carries_the_destination_value_and_other_fields()

/// The switch's source may carry no other intent, and a stale source is refused
/// by name — the 3-1 refusals, reached through the draft field.
#[test]
fn a_drafted_switch_is_refused_by_the_substitution_rules() {
    let view = first_match(COMMENTED);
    assert_eq!(
        plan_match_edits(
            &view,
            &MatchDraft::new()
                .with(MatchField::Replace, "other")
                .with_content_switch(drafted_switch())
        ),
        Err(DraftError::SubstitutionConflictsWithField {
            field: MatchField::Replace,
        })
    );
    let markdown_first = first_match("matches:\n  - trigger: ':x'\n    markdown: a\n");
    assert_eq!(
        plan_match_edits(
            &markdown_first,
            &MatchDraft::new().with_content_switch(drafted_switch())
        ),
        Err(DraftError::SubstitutionSourceAbsent {
            field: MatchField::Replace,
        })
    );
    assert_eq!(
        plan_match_edits_with_substitutions(
            &view,
            &MatchDraft::new().with_content_switch(drafted_switch()),
            &[replace_to_markdown()]
        ),
        Err(DraftError::SubstitutionConflictsWithField {
            field: MatchField::Replace,
        })
    );
} // End of function a_drafted_switch_is_refused_by_the_substitution_rules()

/// The wire form: espanso keys, two different forms, nothing else.
#[test]
fn the_content_switch_wire_form_is_closed() {
    let written = serde_json::to_value(MatchDraft::new().with_content_switch(drafted_switch()))
        .expect("serializes");
    assert_eq!(
        written["content_switch"],
        serde_json::json!({ "from": "replace", "to": "markdown" })
    );
    let read: MatchDraft =
        serde_json::from_str(r#"{"content_switch": {"from": "image_path", "to": "form"}}"#)
            .expect("a switch between two forms is read");
    assert_eq!(
        read.content_switch,
        ContentSwitch::new(ContentForm::ImagePath, ContentForm::Form)
    );
    let absent: MatchDraft = serde_json::from_str("{}").expect("an absent switch is read");
    assert_eq!(absent.content_switch, None);
    for refused in [
        r#"{"content_switch": {"from": "replace", "to": "replace"}}"#,
        r#"{"content_switch": {"from": "replace", "to": "regex"}}"#,
        r#"{"content_switch": {"from": "Replace", "to": "Markdown"}}"#,
        r#"{"content_switch": {"from": "replace", "to": "markdown", "keep": true}}"#,
    ] {
        assert!(
            serde_json::from_str::<MatchDraft>(refused).is_err(),
            "{refused} must be refused"
        );
    } // End of the loop over the refused wire forms
    assert_eq!(
        ContentSwitch::new(ContentForm::Html, ContentForm::Html),
        None
    );
} // End of function the_content_switch_wire_form_is_closed()

/// A drafted switch commits through `save_document`.
#[test]
fn a_drafted_switch_commits_through_the_save_transaction() {
    let (_directory, target) = on_disk(COMMENTED);
    let edits = plan_match_edits(
        &first_match(COMMENTED),
        &MatchDraft::new().with_content_switch(drafted_switch()),
    )
    .expect("the draft plans");
    let saved = save(&target, COMMENTED, &edits).expect("the save commits");
    assert!(saved.committed);
    let written = std::fs::read_to_string(&target).expect("the file is readable");
    assert_eq!(
        written,
        COMMENTED.replacen("    replace: hello there", "    markdown: hello there", 1)
    );
} // End of function a_drafted_switch_commits_through_the_save_transaction()

/// A content switch never travels with a removal of its companion `paragraph`
/// (ruling 8; Phase 3-5-1's review fix), whether the switch is the draft's own
/// field or a 3-1 substitution argument; a `Set` of it is an ordinary edit.
#[test]
fn a_content_switch_with_a_removed_paragraph_is_refused() {
    let source = "matches:\n  - trigger: ':hi'\n    replace: hello\n    paragraph: 'true'\n";
    let view = first_match(source);
    let refused = Err(DraftError::SubstitutionConflictsWithField {
        field: MatchField::Paragraph,
    });
    assert_eq!(
        plan_match_edits(
            &view,
            &MatchDraft::new()
                .without(MatchField::Paragraph)
                .with_content_switch(drafted_switch())
        ),
        refused
    );
    assert_eq!(
        plan_match_edits_with_substitutions(
            &view,
            &MatchDraft::new().without(MatchField::Paragraph),
            &[replace_to_markdown()]
        ),
        refused
    );
    let kept = plan_match_edits(
        &view,
        &MatchDraft::new()
            .with(MatchField::Paragraph, "false")
            .with_content_switch(drafted_switch()),
    )
    .expect("a switch beside a paragraph edit plans");
    let patched = apply_edits(source, &kept).expect("the batch applies");
    assert!(patched.text().contains("markdown: hello"));
    assert!(patched.text().contains("paragraph: 'false'"));
} // End of function a_content_switch_with_a_removed_paragraph_is_refused()
