//! Phase 3-4 acceptance: bounded creation for the wider editor.
//!
//! A [`NewMatch`] now carries a typed trigger alternative, a typed content
//! alternative, `label`, `comment`, the nine options and the `search_terms`
//! list, and [`InsertItem::typed`] writes it as **one** new item. These tests
//! drive that pair through [`apply_edits`] — the engine every save runs — and
//! check each success three ways, two of them independent of the engine's own
//! verifier:
//!
//! - the bytes outside the insertion are walked here and compared with the
//!   source ([`assert_only_the_item_was_added`]);
//! - the candidate is loaded by **yaml-rust2**, a second YAML parser this crate
//!   does not use in production, and the new item's keys, values and list order
//!   are read from it;
//! - the candidate is projected the way the workspace projects it, and the new
//!   match's trigger and content kinds are read from the projection.
//!
//! The run through `run_one_save` — the command path — is `src-tauri`'s
//! (`commands.rs`, the `create_match_*` tests).
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).
//! None is a corpus file: the committed corpus is swept one row per fixture, so
//! the fixtures here stay inline, as 3-1 … 3-3's do.

use espansoconfig_core::draft::{NewContent, NewMatch, NewTrigger, TriggerList};
use espansoconfig_core::model::{
    ContentKind, DocumentContext, DocumentView, MatchView, SequencePresence, TriggerKind, ValueView,
};
use espansoconfig_core::patch::{
    apply_edits, DocumentEdit, DocumentPath, EditError, InsertItem, ItemPlacement, PatchedDocument,
};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::DocumentId;
use yaml_rust2::{Yaml, YamlLoader};

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

/// A small neutral match file with two snippets, a comment and LF endings.
const BASE: &str = "\
# Neutral synthetic snippets (Phase 3-4).
matches:
  - trigger: \":one\"
    replace: first
  # a comment above the second item
  - trigger: \":two\"
    replace: second
";

/// The same file with CRLF line endings throughout.
fn crlf(text: &str) -> String {
    text.replace('\n', "\r\n")
}

/// The same file without its final newline.
fn no_final_newline(text: &str) -> String {
    text.strip_suffix('\n')
        .expect("the base ends in LF")
        .to_owned()
}

/// The `matches` sequence of the only document.
fn sequence() -> DocumentPath {
    DocumentPath::root(0).with_key("matches")
}

/// The document, projected the way the workspace projects it.
fn document(source: &str) -> DocumentView {
    let context = DocumentContext::detached(DocumentId(0), "creation.yml");
    project_source(&context, source).view
}

/// Creates `new_match` at `placement` and returns the verified candidate.
fn create(
    source: &str,
    placement: ItemPlacement,
    new_match: &NewMatch,
) -> Result<PatchedDocument, EditError> {
    let edit = InsertItem::typed(sequence(), placement, new_match.entries());
    apply_edits(source, &[DocumentEdit::InsertItem(edit)])
}

/// Checks, independently of the engine, that the candidate is the source with
/// exactly one zero-width insertion and nothing else changed, and that the
/// projection holds exactly one more match.
fn assert_only_the_item_was_added(source: &str, patched: &PatchedDocument) {
    let replacements = patched.replacements();
    assert_eq!(replacements.len(), 1, "one insertion, one replacement");
    let replacement = &replacements[0];
    assert_eq!(
        replacement.span.start, replacement.span.end,
        "a creation replaces no existing byte"
    );
    let at = replacement.span.start;
    let candidate = patched.text();
    assert_eq!(
        &candidate[..at],
        &source[..at],
        "every byte before the item"
    );
    assert_eq!(
        &candidate[at + replacement.text.len()..],
        &source[at..],
        "every byte after the item"
    );
    assert_eq!(
        document(candidate).matches.len(),
        document(source).matches.len() + 1,
        "exactly one match appears"
    );
} // End of function assert_only_the_item_was_added()

/// The candidate's `matches` item at `index`, as yaml-rust2 reads it.
fn yaml_item(candidate: &str, index: usize) -> Yaml {
    let documents = YamlLoader::load_from_str(candidate).expect("yaml-rust2 loads the candidate");
    documents[0]["matches"][index].clone()
}

/// The keys of a yaml-rust2 mapping, in source order.
fn yaml_keys(item: &Yaml) -> Vec<String> {
    item.as_hash()
        .expect("the item is a mapping")
        .keys()
        .map(|key| key.as_str().expect("a string key").to_owned())
        .collect()
}

/// The strings of a yaml-rust2 sequence, in order.
fn yaml_strings(value: &Yaml) -> Vec<String> {
    value
        .as_vec()
        .expect("a sequence")
        .iter()
        .map(|item| item.as_str().expect("a string item").to_owned())
        .collect()
}

/// The projected match at `index`.
fn match_at(candidate: &str, index: usize) -> MatchView {
    document(candidate)
        .matches
        .into_iter()
        .nth(index)
        .expect("the match exists")
}

/// The decoded texts of a projected list.
fn projected_texts(values: &[ValueView]) -> Vec<String> {
    values
        .iter()
        .map(|value| match value {
            ValueView::Scalar(scalar) => scalar.text.clone(),
            other => panic!("a list item is a scalar, found {other:?}"),
        })
        .collect()
}

/// A non-empty trigger list.
fn aliases(items: &[&str]) -> TriggerList {
    TriggerList::new(items.iter().map(|item| (*item).to_owned()).collect()).expect("non-empty")
}

/// The three trigger alternatives, each with the kind and key it projects as.
fn trigger_alternatives() -> Vec<(NewTrigger, TriggerKind, &'static str)> {
    vec![
        (
            NewTrigger::Single(":new".to_owned()),
            TriggerKind::Single,
            "trigger",
        ),
        (
            NewTrigger::Multiple(aliases(&[":zeta", ":alpha", ":mid"])),
            TriggerKind::Multiple,
            "triggers",
        ),
        (
            NewTrigger::Regex(":n(?P<n>\\d+)".to_owned()),
            TriggerKind::Regex,
            "regex",
        ),
    ]
} // End of function trigger_alternatives()

/// The five content alternatives, each with the kind and key it projects as.
fn content_alternatives() -> Vec<(NewContent, ContentKind, &'static str)> {
    vec![
        (
            NewContent::Replace("plain body".to_owned()),
            ContentKind::Replace,
            "replace",
        ),
        (
            NewContent::Markdown("**bold** body".to_owned()),
            ContentKind::Markdown,
            "markdown",
        ),
        (
            NewContent::Html("<b>body</b>".to_owned()),
            ContentKind::Html,
            "html",
        ),
        (
            NewContent::ImagePath("$CONFIG/images/a.png".to_owned()),
            ContentKind::ImagePath,
            "image_path",
        ),
        (
            NewContent::Form("Name: [[name]]".to_owned()),
            ContentKind::Form,
            "form",
        ),
    ]
} // End of function content_alternatives()

// ---------------------------------------------------------------------------
// Every supported form creates exactly one item
// ---------------------------------------------------------------------------

/// Every trigger alternative with every content alternative, in LF, CRLF and
/// no-final-newline spellings of the same file: exactly one item appears, at
/// the end, with the right keys and kinds, and nothing else changes.
#[test]
fn every_trigger_and_content_alternative_creates_exactly_one_item() {
    let sources = [BASE.to_owned(), crlf(BASE), no_final_newline(BASE)];
    let mut checked = 0usize;
    for source in &sources {
        for (trigger, trigger_kind, trigger_key) in trigger_alternatives() {
            for (content, content_kind, content_key) in content_alternatives() {
                let new_match = NewMatch::new(trigger.clone(), content.clone());
                let patched = create(source, ItemPlacement::End, &new_match)
                    .unwrap_or_else(|error| panic!("{trigger_key}/{content_key}: {error:?}"));
                assert_only_the_item_was_added(source, &patched);
                let candidate = patched.text();

                let item = yaml_item(candidate, 2);
                assert_eq!(yaml_keys(&item), vec![trigger_key, content_key]);
                let projected = match_at(candidate, 2);
                assert_eq!(projected.trigger.kind, trigger_kind);
                assert_eq!(projected.content.kind, content_kind);
                if trigger_kind == TriggerKind::Multiple {
                    assert_eq!(
                        yaml_strings(&item["triggers"]),
                        vec![":zeta", ":alpha", ":mid"],
                        "the aliases keep their order"
                    );
                    assert_eq!(
                        projected_texts(&projected.trigger.triggers),
                        vec![":zeta", ":alpha", ":mid"]
                    );
                }
                // The line-ending convention is copied, never chosen.
                if source.contains("\r\n") {
                    assert!(
                        !candidate.replace("\r\n", "").contains('\n'),
                        "a CRLF file gains no bare LF"
                    );
                }
                if !source.ends_with('\n') {
                    assert!(!candidate.ends_with('\n'), "no final newline is added");
                }
                checked += 1;
            } // End of the loop over the content alternatives
        } // End of the loop over the trigger alternatives
    } // End of the loop over the three spellings of the file
    assert_eq!(checked, 3 * 3 * 5);
} // End of function every_trigger_and_content_alternative_creates_exactly_one_item()

/// The exact bytes of a creation that uses every field, in a CRLF file and in
/// a file with no final newline.
#[test]
fn a_full_creation_is_written_exactly_in_crlf_and_without_a_final_newline() {
    let mut whole = NewMatch::new(
        NewTrigger::Multiple(aliases(&[":b", ":a"])),
        NewContent::Replace("line one\nline two".to_owned()),
    );
    whole.label = Some("A label".to_owned());
    whole.comment = Some("# not a comment".to_owned());
    whole.search_terms = Some(vec!["second".to_owned(), "first".to_owned()]);
    whole.word = Some("on".to_owned());
    whole.left_word = Some("false".to_owned());
    whole.right_word = Some(String::new());
    whole.propagate_case = Some("yes".to_owned());
    whole.uppercase_style = Some("capitalize_words".to_owned());
    whole.force_mode = Some("clipboard".to_owned());
    whole.force_clipboard = Some("true".to_owned());
    whole.paragraph = Some("~".to_owned());
    whole.anchor = Some("*alias".to_owned());

    let lf_item = "  - triggers:
      - ':b'
      - ':a'
    replace: |-
      line one
      line two
    label: A label
    comment: '# not a comment'
    search_terms:
      - second
      - first
    word: 'on'
    left_word: 'false'
    right_word: ''
    propagate_case: 'yes'
    uppercase_style: capitalize_words
    force_mode: clipboard
    force_clipboard: 'true'
    paragraph: '~'
    anchor: '*alias'
";

    let source = crlf(BASE);
    let patched = create(&source, ItemPlacement::End, &whole).expect("CRLF creation");
    assert_only_the_item_was_added(&source, &patched);
    assert_eq!(patched.text(), format!("{source}{}", crlf(lf_item)));

    let source = no_final_newline(BASE);
    let patched = create(&source, ItemPlacement::End, &whole).expect("no-final-newline creation");
    assert_only_the_item_was_added(&source, &patched);
    assert_eq!(
        patched.text(),
        format!("{source}\n{}", lf_item.strip_suffix('\n').expect("LF"))
    );

    // The independent reading: every ambiguous option reads back as a string,
    // never a boolean or a null, and both lists keep their order.
    let item = yaml_item(patched.text(), 2);
    for (key, text) in [
        ("word", "on"),
        ("left_word", "false"),
        ("right_word", ""),
        ("propagate_case", "yes"),
        ("force_clipboard", "true"),
        ("paragraph", "~"),
        ("anchor", "*alias"),
        ("comment", "# not a comment"),
        ("replace", "line one\nline two"),
    ] {
        assert_eq!(item[key].as_str(), Some(text), "{key} reads back as text");
    } // End of the loop over the values that must read back as text
    assert_eq!(yaml_strings(&item["triggers"]), vec![":b", ":a"]);
    assert_eq!(yaml_strings(&item["search_terms"]), vec!["second", "first"]);
} // End of function a_full_creation_is_written_exactly_in_crlf_and_without_a_final_newline()

// ---------------------------------------------------------------------------
// None differs from Some("") for every optional field
// ---------------------------------------------------------------------------

/// A setter for one optional scalar field.
type Setter = fn(&mut NewMatch, Option<String>);

/// The eleven optional scalar fields.
fn optional_scalars() -> Vec<(&'static str, Setter)> {
    vec![
        ("label", |m, v| m.label = v),
        ("comment", |m, v| m.comment = v),
        ("word", |m, v| m.word = v),
        ("left_word", |m, v| m.left_word = v),
        ("right_word", |m, v| m.right_word = v),
        ("propagate_case", |m, v| m.propagate_case = v),
        ("uppercase_style", |m, v| m.uppercase_style = v),
        ("force_mode", |m, v| m.force_mode = v),
        ("force_clipboard", |m, v| m.force_clipboard = v),
        ("paragraph", |m, v| m.paragraph = v),
        ("anchor", |m, v| m.anchor = v),
    ]
} // End of function optional_scalars()

/// For each optional field, `None` writes no key and `Some("")` writes the key
/// holding an empty string — read back by yaml-rust2, not by the engine.
#[test]
fn none_and_empty_differ_in_the_file_for_every_optional_field() {
    let bare = NewMatch::new(
        NewTrigger::Single(":new".to_owned()),
        NewContent::Replace("body".to_owned()),
    );
    let absent = create(BASE, ItemPlacement::End, &bare).expect("absent");
    assert_eq!(
        yaml_keys(&yaml_item(absent.text(), 2)),
        vec!["trigger", "replace"]
    );

    for (key, set) in optional_scalars() {
        let mut empty = bare.clone();
        set(&mut empty, Some(String::new()));
        let patched = create(BASE, ItemPlacement::End, &empty).expect("empty");
        assert_only_the_item_was_added(BASE, &patched);
        let item = yaml_item(patched.text(), 2);
        assert_eq!(yaml_keys(&item), vec!["trigger", "replace", key]);
        assert_eq!(
            item[key].as_str(),
            Some(""),
            "{key}: an empty string, never a null"
        );
    } // End of the loop over the eleven optional scalar fields

    let mut empty_terms = bare.clone();
    empty_terms.search_terms = Some(Vec::new());
    let patched = create(BASE, ItemPlacement::End, &empty_terms).expect("empty list");
    assert!(patched.text().ends_with("    search_terms: []\n"));
    let projected = match_at(patched.text(), 2);
    assert!(matches!(
        projected.search_terms_presence,
        SequencePresence::Empty { .. }
    ));
    let absent_terms = match_at(absent.text(), 2);
    assert_eq!(
        absent_terms.search_terms_presence,
        SequencePresence::Absent {}
    );
} // End of function none_and_empty_differ_in_the_file_for_every_optional_field()

// ---------------------------------------------------------------------------
// Placement, list order and the document's own indentation
// ---------------------------------------------------------------------------

/// A list-bearing item lands at the front, after the first item and at the
/// end, and each time exactly one item is added with its lists in order.
#[test]
fn every_placement_keeps_the_lists_in_order() {
    let mut new_match = NewMatch::new(
        NewTrigger::Multiple(aliases(&[":3", ":1", ":2"])),
        NewContent::Markdown("m".to_owned()),
    );
    new_match.search_terms = Some(vec!["c".to_owned(), "a".to_owned(), "b".to_owned()]);
    for (placement, landed) in [
        (ItemPlacement::Front, 0usize),
        (ItemPlacement::After(0), 1),
        (ItemPlacement::End, 2),
    ] {
        let patched = create(BASE, placement, &new_match).expect("placed");
        assert_only_the_item_was_added(BASE, &patched);
        let item = yaml_item(patched.text(), landed);
        assert_eq!(yaml_strings(&item["triggers"]), vec![":3", ":1", ":2"]);
        assert_eq!(yaml_strings(&item["search_terms"]), vec!["c", "a", "b"]);
        let projected = match_at(patched.text(), landed);
        assert_eq!(
            projected_texts(&projected.search_terms),
            vec!["c", "a", "b"]
        );
    } // End of the loop over the three placements
      // The front insertion leaves the second item's leading comment with it.
    let front = create(BASE, ItemPlacement::Front, &new_match).expect("front");
    assert!(front
        .text()
        .contains("  # a comment above the second item\n  - trigger: \":two\""));
} // End of function every_placement_keeps_the_lists_in_order()

/// A list's items are indented by the document's own dominant step, not a
/// default: a file that indents by four gets four.
#[test]
fn list_items_follow_the_documents_own_step() {
    let new_match = NewMatch::new(
        NewTrigger::Multiple(aliases(&[":x", ":y"])),
        NewContent::Replace("b".to_owned()),
    );

    // `matches:` indents its items by four, so the new list's items sit four
    // columns past the new item's keys.
    let stepped = "matches:\n    - trigger: \":a\"\n      replace: a\n";
    let patched = create(stepped, ItemPlacement::End, &new_match).expect("four-column file");
    assert_only_the_item_was_added(stepped, &patched);
    assert_eq!(
        patched.text(),
        format!("{stepped}    - triggers:\n          - ':x'\n          - ':y'\n      replace: b\n")
    );

    // `matches:` shows a step of two once and the two `search_terms` lists show
    // four twice, so four is the document's dominant step and the new list's
    // items take it, although the item itself follows `matches:`'s column.
    let lists =
        "matches:\n  - trigger: \":a\"\n    replace: a\n    search_terms:\n        - one\n  \
                 - trigger: \":b\"\n    replace: b\n    search_terms:\n        - two\n";
    let patched = create(lists, ItemPlacement::End, &new_match).expect("four-step lists");
    assert_only_the_item_was_added(lists, &patched);
    assert_eq!(
        patched.text(),
        format!("{lists}  - triggers:\n        - ':x'\n        - ':y'\n    replace: b\n")
    );
    let item = yaml_item(patched.text(), 2);
    assert_eq!(yaml_strings(&item["triggers"]), vec![":x", ":y"]);
} // End of function list_items_follow_the_documents_own_step()

/// A bare `matches:` (an implicit null) is promoted into a sequence whose first
/// item holds both lists, and the bytes around it survive.
#[test]
fn a_list_bearing_item_promotes_a_bare_match_list() {
    let source = "# neutral\nmatches:\n";
    let mut new_match = NewMatch::new(
        NewTrigger::Multiple(aliases(&[":p", ":q"])),
        NewContent::Replace("r".to_owned()),
    );
    new_match.search_terms = Some(vec!["t".to_owned()]);
    let patched = create(source, ItemPlacement::End, &new_match).expect("promoted");
    assert!(patched.text().starts_with(source));
    let item = yaml_item(patched.text(), 0);
    assert_eq!(yaml_strings(&item["triggers"]), vec![":p", ":q"]);
    assert_eq!(yaml_strings(&item["search_terms"]), vec!["t"]);
    assert_eq!(
        match_at(patched.text(), 0).trigger.kind,
        TriggerKind::Multiple
    );
} // End of function a_list_bearing_item_promotes_a_bare_match_list()

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

/// A flow match list is refused, whatever the new item holds, and a refusal
/// produces no candidate at all.
#[test]
fn a_flow_match_list_is_refused() {
    let new_match = NewMatch::new(
        NewTrigger::Multiple(aliases(&[":a"])),
        NewContent::Replace("b".to_owned()),
    );
    for source in ["matches: []\n", "matches: [{trigger: x, replace: y}]\n"] {
        let refused = create(source, ItemPlacement::End, &new_match);
        assert!(
            matches!(
                refused,
                Err(EditError::FlowSequenceInsertionUnsupported { .. })
            ),
            "{source:?}: {refused:?}"
        );
    } // End of the loop over the flow match lists
} // End of function a_flow_match_list_is_refused()

/// The typed insertion keeps `InsertItem`'s own request checks: two fields with
/// one key are refused, even when one of them is a list. `NewMatch` cannot
/// produce this batch; a hand-built one is how the engine's own guard is shown.
#[test]
fn a_repeated_key_is_refused_even_beside_a_list() {
    use espansoconfig_core::patch::EntryValue;
    let edit = InsertItem::typed(
        sequence(),
        ItemPlacement::End,
        vec![
            (
                "triggers".to_owned(),
                EntryValue::ScalarList(vec![":a".to_owned()]),
            ),
            ("triggers".to_owned(), EntryValue::Scalar(":b".to_owned())),
        ],
    );
    let refused = apply_edits(BASE, &[DocumentEdit::InsertItem(edit)]);
    assert!(
        matches!(
            refused,
            Err(EditError::DuplicateInsertedField { field: 1, .. })
        ),
        "{refused:?}"
    );
} // End of function a_repeated_key_is_refused_even_beside_a_list()
