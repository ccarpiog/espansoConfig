//! Phase 3-3 acceptance: item insertion and removal inside flow scalar lists.
//!
//! `triggers: [":a", ":b"]`, `search_terms: [...]` and `imports: [...]` gain
//! and lose items between their brackets, **never converting presentation**:
//! a flow list stays a flow list, every retained token keeps its bytes, and a
//! comment or comma whose placement is not uniquely determined is refused by
//! name ([`EditError::FlowListTriviaAmbiguous`]).
//!
//! # Independent checks
//!
//! Every success is checked **independently of the engine's own verifier**
//! ([`assert_outside_spans`]): the bytes outside the replacements the engine
//! reports are walked here and compared with the source, the candidate is
//! reparsed and its list read back, and the list is asserted still bracketed.
//! Almost every success also asserts the exact expected text.
//!
//! # Privacy
//!
//! Every fixture is hand-authored and neutral (`CLAUDE.md` section 1): inline
//! documents, plus the committed synthetic `flow-collections.yml`, read and
//! never written.

use espansoconfig_core::draft::{
    plan_match_edits_with, DraftError, MatchDraft, MatchStructure, ScalarItems, SequenceField,
    SequenceIntent,
};
use espansoconfig_core::model::{DocumentContext, DocumentView, MatchView, SequencePresence};
use espansoconfig_core::patch::{
    apply_edits, item_positions, DocumentEdit, DocumentPath, EditError, ItemPlacement,
    PatchedDocument, RemoveItem, ScalarItemInsert,
};
use espansoconfig_core::persist::{save_document, Acknowledgement, SaveContent, SaveRequest};
use espansoconfig_core::syntax::{CollectionStyle, HazardKind, NodeKind, SyntaxIndex};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::{ContentRevision, DocumentId};

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

/// The committed synthetic flow fixture. Lines 16-22 hold the commented
/// multi-line flow list the step's acceptance names.
const FIXTURE: &str = include_str!("corpus/synthetic/flow-collections.yml");

/// Flow lists in the shapes this step edits, hand-authored and neutral.
const LISTS: &str = "\
matches:
  - triggers: [\":a\", \":b\", \":c\"]
    replace: three on one line
    search_terms: [plain, 'single', \"double\"]

  - triggers: [ ':x' ,':y' ]
    replace: odd spacing

  - trigger: ':t'
    replace: trailing comma
    search_terms: [one, two,]

  - trigger: ':u'
    replace: unicode
    search_terms: [día, \"é😀\", 'ñandú']

  - triggers: []
    replace: empty
    search_terms: [ ]
";

/// The whole document, projected the way the workspace projects it.
fn document(source: &str) -> DocumentView {
    let context = DocumentContext::detached(DocumentId(0), "flow.yml");
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

/// The path of list `key` of the match at `index`.
fn list(index: usize, key: &str) -> DocumentPath {
    mapping(index).with_key(key)
}

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

/// Checks, **independently of the engine's verifier**, that every byte outside
/// the replacements the engine reports is the source's own, walked in ascending
/// order.
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
} // End of function assert_outside_spans()

/// The decoded items of the list at `path` in `text`, read off a fresh parse,
/// after checking the list is still bracket-delimited.
fn flow_items(text: &str, path: &DocumentPath) -> Vec<String> {
    let index = SyntaxIndex::parse(text).expect("the candidate parses");
    let id = espansoconfig_core::patch::resolve(&index, path).expect("the list resolves");
    let node = index.node(id).expect("a node");
    assert_eq!(node.kind, NodeKind::Sequence);
    assert_eq!(
        node.collection_style,
        Some(CollectionStyle::Flow),
        "the list is still a flow list"
    );
    node.children
        .iter()
        .map(|child| {
            index
                .node(*child)
                .and_then(|item| item.scalar.as_ref())
                .expect("a scalar item")
                .value
                .clone()
        })
        .collect()
} // End of function flow_items()

/// Applies `edits`, checks the outside bytes independently and returns the
/// candidate text.
fn apply(source: &str, edits: &[DocumentEdit]) -> String {
    let patched = apply_edits(source, edits).expect("the batch applies");
    assert_outside_spans(source, &patched);
    patched.text().to_owned()
}

/// One engine insertion of `values` at `placement` into `path`.
fn insert(path: DocumentPath, placement: ItemPlacement, values: &[&str]) -> DocumentEdit {
    ScalarItemInsert::new(
        path,
        placement,
        values.iter().map(|value| (*value).to_owned()).collect(),
    )
    .expect("at least one value")
    .into()
}

/// One engine removal of item `at` of `path`.
fn remove(path: &DocumentPath, at: usize) -> DocumentEdit {
    RemoveItem::new(path.clone().with_index(at)).into()
}

/// The decoded text of every scalar item of a projected list.
fn texts(values: &[espansoconfig_core::model::ValueView]) -> Vec<String> {
    values
        .iter()
        .filter_map(|value| value.as_scalar().map(|scalar| scalar.text.clone()))
        .collect()
}

/// `source` with `from` replaced by `to`, exactly once.
fn replaced(source: &str, from: &str, to: &str) -> String {
    assert_eq!(source.matches(from).count(), 1, "{from:?} occurs once");
    source.replacen(from, to, 1)
}

// ---------------------------------------------------------------------------
// Single-line lists: first, middle and last
// ---------------------------------------------------------------------------

/// **Acceptance: removal at the first, middle and last positions** of a
/// single-line list. A leading or middle item goes with the separator after it,
/// the last with the separator before it.
#[test]
fn single_line_removals_at_every_position() {
    let path = list(0, "triggers");
    for (at, expected) in [
        (0, "[\":b\", \":c\"]"),
        (1, "[\":a\", \":c\"]"),
        (2, "[\":a\", \":b\"]"),
    ] {
        let text = apply(LISTS, &[remove(&path, at)]);
        assert_eq!(
            text,
            replaced(LISTS, "[\":a\", \":b\", \":c\"]", expected),
            "removing item {at}"
        );
    } // End of the loop over the three positions
} // End of function single_line_removals_at_every_position()

/// **Acceptance: insertion at the first, middle and last positions** of a
/// single-line list, copying the list's own separator. A new item is always
/// quoted in flow context.
#[test]
fn single_line_insertions_at_every_position() {
    let path = list(0, "triggers");
    for (placement, expected) in [
        (ItemPlacement::Front, "[':n', \":a\", \":b\", \":c\"]"),
        (ItemPlacement::After(0), "[\":a\", ':n', \":b\", \":c\"]"),
        (ItemPlacement::After(1), "[\":a\", \":b\", ':n', \":c\"]"),
        (ItemPlacement::End, "[\":a\", \":b\", \":c\", ':n']"),
        (ItemPlacement::After(2), "[\":a\", \":b\", \":c\", ':n']"),
    ] {
        let text = apply(LISTS, &[insert(path.clone(), placement, &[":n"])]);
        assert_eq!(
            text,
            replaced(LISTS, "[\":a\", \":b\", \":c\"]", expected),
            "{placement:?}"
        );
    } // End of the loop over the placements
      // Several items at once, in order.
    let text = apply(
        LISTS,
        &[insert(path.clone(), ItemPlacement::After(0), &["p", "q"])],
    );
    assert_eq!(flow_items(&text, &path), [":a", "p", "q", ":b", ":c"]);
} // End of function single_line_insertions_at_every_position()

/// A list's own spacing is copied, never normalised: `[ ':x' ,':y' ]` keeps its
/// padding and its ` ,` separator.
#[test]
fn a_list_keeps_its_own_spacing() {
    let path = list(1, "triggers");
    let text = apply(LISTS, &[insert(path.clone(), ItemPlacement::End, &[":z"])]);
    assert_eq!(
        text,
        replaced(LISTS, "[ ':x' ,':y' ]", "[ ':x' ,':y' ,':z' ]")
    );
    let text = apply(
        LISTS,
        &[insert(path.clone(), ItemPlacement::Front, &[":w"])],
    );
    assert_eq!(
        text,
        replaced(LISTS, "[ ':x' ,':y' ]", "[ ':w' ,':x' ,':y' ]")
    );
    let text = apply(LISTS, &[remove(&path, 1)]);
    assert_eq!(text, replaced(LISTS, "[ ':x' ,':y' ]", "[ ':x' ]"));
    let text = apply(LISTS, &[remove(&path, 0)]);
    assert_eq!(text, replaced(LISTS, "[ ':x' ,':y' ]", "[ ':y' ]"));
} // End of function a_list_keeps_its_own_spacing()

// ---------------------------------------------------------------------------
// Trailing commas, Unicode and mixed quoting
// ---------------------------------------------------------------------------

/// **Acceptance: trailing commas where YAML accepts them.** A list that ends in
/// a comma keeps ending in one, whether an item is appended or the last removed.
#[test]
fn a_trailing_comma_is_kept() {
    let path = list(2, "search_terms");
    let text = apply(
        LISTS,
        &[insert(path.clone(), ItemPlacement::End, &["three"])],
    );
    assert_eq!(text, replaced(LISTS, "[one, two,]", "[one, two, 'three',]"));
    let text = apply(LISTS, &[remove(&path, 1)]);
    assert_eq!(text, replaced(LISTS, "[one, two,]", "[one,]"));
    let text = apply(LISTS, &[remove(&path, 0)]);
    assert_eq!(text, replaced(LISTS, "[one, two,]", "[two,]"));

    // One item per line, with a trailing comma: new lines carry one too.
    let lines = "l: [\n  a,\n  b,\n]\n";
    let root = DocumentPath::root(0).with_key("l");
    assert_eq!(
        apply(lines, &[insert(root.clone(), ItemPlacement::End, &["c"])]),
        "l: [\n  a,\n  b,\n  'c',\n]\n"
    );
    assert_eq!(apply(lines, &[remove(&root, 1)]), "l: [\n  a,\n]\n");
} // End of function a_trailing_comma_is_kept()

/// **Acceptance: Unicode.** Precomposed, astral and plain non-ASCII items are
/// retained byte for byte, and new non-ASCII items land at the right byte
/// offsets.
#[test]
fn unicode_items_are_retained_and_inserted_byte_exactly() {
    let path = list(3, "search_terms");
    let original = "[día, \"é😀\", 'ñandú']";
    for (at, expected) in [
        (0, "[\"é😀\", 'ñandú']"),
        (1, "[día, 'ñandú']"),
        (2, "[día, \"é😀\"]"),
    ] {
        let text = apply(LISTS, &[remove(&path, at)]);
        assert_eq!(text, replaced(LISTS, original, expected), "removing {at}");
    } // End of the loop over the three positions
    let text = apply(
        LISTS,
        &[insert(
            path.clone(),
            ItemPlacement::After(0),
            &["😀 añadido"],
        )],
    );
    assert_eq!(
        text,
        replaced(LISTS, original, "[día, '😀 añadido', \"é😀\", 'ñandú']")
    );
    assert_eq!(
        flow_items(&text, &path),
        ["día", "😀 añadido", "é😀", "ñandú"]
    );
} // End of function unicode_items_are_retained_and_inserted_byte_exactly()

/// **Acceptance: mixed quoting.** Plain, single- and double-quoted items keep
/// their own spelling wherever an item is removed or inserted beside them.
#[test]
fn mixed_quoting_survives_every_position() {
    let path = list(0, "search_terms");
    let original = "[plain, 'single', \"double\"]";
    for (at, expected) in [
        (0, "['single', \"double\"]"),
        (1, "[plain, \"double\"]"),
        (2, "[plain, 'single']"),
    ] {
        let text = apply(LISTS, &[remove(&path, at)]);
        assert_eq!(text, replaced(LISTS, original, expected), "removing {at}");
    } // End of the loop over the three positions
    let text = apply(
        LISTS,
        &[insert(path.clone(), ItemPlacement::After(1), &["x"])],
    );
    assert_eq!(
        text,
        replaced(LISTS, original, "[plain, 'single', 'x', \"double\"]")
    );
} // End of function mixed_quoting_survives_every_position()

/// A new item is spelled safely for flow context: `,`, `[`, `]`, `{`, `}` and
/// `#` cannot end it early, a quote inside it is escaped, and a YAML
/// 1.1-ambiguous word is never written plain.
#[test]
fn new_items_are_spelled_safely_for_flow_context() {
    let path = list(0, "triggers");
    let hostile = [
        "a,b",
        "[x]",
        "{y}",
        "a #z",
        "yes",
        "no",
        "012",
        "12:30",
        "it's",
        "\"q\"",
        "line\nbreak",
        "~",
        "",
    ];
    let text = apply(LISTS, &[insert(path.clone(), ItemPlacement::End, &hostile)]);
    let mut wanted = vec![":a", ":b", ":c"];
    wanted.extend(hostile);
    assert_eq!(flow_items(&text, &path), wanted);
    // Every new token is quoted, and the list stays one line.
    let line = text
        .lines()
        .find(|line| line.starts_with("  - triggers: ["))
        .expect("the list's line");
    assert!(line.ends_with(']'), "{line}");
    assert!(
        line.contains("'a,b', '[x]', '{y}', 'a #z', 'yes', 'no', '012', '12:30', 'it''s'"),
        "{line}"
    );
    assert!(line.contains("\"line\\nbreak\""), "{line}");
} // End of function new_items_are_spelled_safely_for_flow_context()

// ---------------------------------------------------------------------------
// Empty lists
// ---------------------------------------------------------------------------

/// **Acceptance: empty lists.** `[]` and `[ ]` take items between their
/// brackets, mirroring the padding; an empty list spanning lines is refused.
#[test]
fn an_empty_list_takes_items_between_its_brackets() {
    let text = apply(
        LISTS,
        &[insert(list(4, "triggers"), ItemPlacement::End, &[":e"])],
    );
    assert_eq!(
        text,
        replaced(LISTS, "  - triggers: []", "  - triggers: [':e']")
    );
    let text = apply(
        LISTS,
        &[insert(
            list(4, "search_terms"),
            ItemPlacement::Front,
            &["one", "two"],
        )],
    );
    assert_eq!(
        text,
        replaced(LISTS, "search_terms: [ ]", "search_terms: [ 'one', 'two' ]")
    );
    assert!(matches!(
        apply_edits(
            LISTS,
            &[insert(list(4, "triggers"), ItemPlacement::After(0), &["x"])]
        ),
        Err(EditError::NoSuchDestinationItem {
            edit: 0,
            items: 0,
            ..
        })
    ));
    for spanning in ["l: [\n  ]\n", "l: [ # why\n  ]\n"] {
        let refused = apply_edits(
            spanning,
            &[insert(
                DocumentPath::root(0).with_key("l"),
                ItemPlacement::End,
                &["x"],
            )],
        );
        assert!(
            matches!(
                refused,
                Err(EditError::FlowListLayoutUnsupported { edit: 0, .. })
            ),
            "{spanning:?}: {refused:?}"
        );
    } // End of the loop over the two spanning empty lists
} // End of function an_empty_list_takes_items_between_its_brackets()

/// Removing the last item stays refused, as 3-2 ruled: at the draft
/// (`SequenceWouldBeEmpty`) and at the engine (`RemovalWouldEmptyTheSequence`),
/// for one removal and for a batch that takes every item. Removing the field is
/// the explicit intent for "no list".
#[test]
fn removing_the_last_item_of_a_flow_list_is_refused() {
    let one = "matches:\n  - trigger: ':a'\n    replace: x\n    search_terms: [only]\n";
    let path = list(0, "search_terms");
    assert!(matches!(
        apply_edits(one, &[remove(&path, 0)]),
        Err(EditError::RemovalWouldEmptyTheSequence { edit: 0, .. })
    ));
    assert!(matches!(
        apply_edits(
            LISTS,
            &[
                remove(&list(1, "triggers"), 0),
                remove(&list(1, "triggers"), 1)
            ]
        ),
        Err(EditError::RemovalWouldEmptyTheSequence { .. })
    ));
    assert_eq!(
        plan_match_edits_with(
            &match_at(one, 0),
            &MatchDraft::new(),
            &intents(vec![SequenceIntent::RemoveItem {
                field: SequenceField::SearchTerms,
                index: 0,
            }])
        ),
        Err(DraftError::SequenceWouldBeEmpty {
            field: SequenceField::SearchTerms
        })
    );
} // End of function removing_the_last_item_of_a_flow_list_is_refused()

// ---------------------------------------------------------------------------
// The commented multi-line flow list of `flow-collections.yml`
// ---------------------------------------------------------------------------

/// The list at `flow-collections.yml:18-22`, as it stands in the fixture.
const COMMENTED: &str = "    triggers: [\n      \":one\",   # first alias\n      \":two\",\n      \":three\"\n      ]\n";

/// **Acceptance: the commented multi-line flow list.** Removal at every
/// position: the first item takes its own trailing comment, the last takes the
/// comma it leaves dangling, and every other byte of the fixture is its own.
#[test]
fn the_fixtures_commented_list_loses_an_item_at_every_position() {
    assert!(
        FIXTURE.contains(COMMENTED),
        "the fixture still holds the list"
    );
    let path = list(3, "triggers");
    for (at, expected) in [
        (
            0,
            "    triggers: [\n      \":two\",\n      \":three\"\n      ]\n",
        ),
        (
            1,
            "    triggers: [\n      \":one\",   # first alias\n      \":three\"\n      ]\n",
        ),
        (
            2,
            "    triggers: [\n      \":one\",   # first alias\n      \":two\"\n      ]\n",
        ),
    ] {
        let text = apply(FIXTURE, &[remove(&path, at)]);
        assert_eq!(
            text,
            replaced(FIXTURE, COMMENTED, expected),
            "removing {at}"
        );
    } // End of the loop over the three positions
      // Two at once: the last two go line by line, with one dangling comma.
    let text = apply(FIXTURE, &[remove(&path, 1), remove(&path, 2)]);
    assert_eq!(
        text,
        replaced(
            FIXTURE,
            COMMENTED,
            "    triggers: [\n      \":one\"   # first alias\n      ]\n"
        )
    );
} // End of function the_fixtures_commented_list_loses_an_item_at_every_position()

/// **Acceptance: the commented multi-line flow list.** Insertion at every
/// position, one item per line, indented and terminated as the anchor is; the
/// comment stays on its own item's line.
#[test]
fn the_fixtures_commented_list_gains_an_item_at_every_position() {
    let path = list(3, "triggers");
    for (placement, expected) in [
        (
            ItemPlacement::Front,
            "    triggers: [\n      ':new',\n      \":one\",   # first alias\n      \":two\",\n      \":three\"\n      ]\n",
        ),
        (
            ItemPlacement::After(0),
            "    triggers: [\n      \":one\",   # first alias\n      ':new',\n      \":two\",\n      \":three\"\n      ]\n",
        ),
        (
            ItemPlacement::After(1),
            "    triggers: [\n      \":one\",   # first alias\n      \":two\",\n      ':new',\n      \":three\"\n      ]\n",
        ),
        (
            ItemPlacement::End,
            "    triggers: [\n      \":one\",   # first alias\n      \":two\",\n      \":three\",\n      ':new'\n      ]\n",
        ),
    ] {
        let text = apply(FIXTURE, &[insert(path.clone(), placement, &[":new"])]);
        assert_eq!(text, replaced(FIXTURE, COMMENTED, expected), "{placement:?}");
    } // End of the loop over the placements
    let text = apply(
        FIXTURE,
        &[insert(
            path.clone(),
            ItemPlacement::End,
            &[":four", ":five"],
        )],
    );
    assert_eq!(
        flow_items(&text, &path),
        [":one", ":two", ":three", ":four", ":five"]
    );
    assert!(text.contains("      \":three\",\n      ':four',\n      ':five'\n      ]\n"));
} // End of function the_fixtures_commented_list_gains_an_item_at_every_position()

/// The fixture's other two flow lists — a single-line `triggers` and a
/// mixed-quoting `search_terms` — through the draft planner, and the commented
/// list's match refused at the draft layer by the match-wide gate.
#[test]
fn the_fixtures_other_lists_plan_through_the_draft() {
    let structure = intents(vec![
        SequenceIntent::RemoveItem {
            field: SequenceField::Triggers,
            index: 1,
        },
        SequenceIntent::InsertItems {
            field: SequenceField::Triggers,
            at: ItemPlacement::End,
            items: items(&[":howdy"]),
        },
    ]);
    let view = match_at(FIXTURE, 0);
    let edits = plan_match_edits_with(&view, &MatchDraft::new(), &structure).expect("plans");
    let text = apply(FIXTURE, &edits);
    assert_eq!(
        text,
        replaced(
            FIXTURE,
            "[\":hi\", \":hello\", \":hey\"]",
            "[\":hi\", \":hey\", ':howdy']"
        )
    );

    let structure = intents(vec![SequenceIntent::InsertItems {
        field: SequenceField::SearchTerms,
        at: ItemPlacement::Front,
        items: items(&["hello"]),
    }]);
    let edits = plan_match_edits_with(&match_at(FIXTURE, 2), &MatchDraft::new(), &structure)
        .expect("plans");
    let text = apply(FIXTURE, &edits);
    assert_eq!(
        text,
        replaced(
            FIXTURE,
            "[greeting, saludo, \"hola\"]",
            "['hello', greeting, saludo, \"hola\"]"
        )
    );

    // The commented list's match: the projection's gate is match-wide, so the
    // draft layer refuses the whole match rather than planning around the
    // comment (`docs/decisions/3-3-notes.md` §7).
    assert_eq!(
        plan_match_edits_with(
            &match_at(FIXTURE, 3),
            &MatchDraft::new(),
            &intents(vec![SequenceIntent::RemoveItem {
                field: SequenceField::Triggers,
                index: 0,
            }])
        ),
        Err(DraftError::MatchNotEditable {
            hazard: Some(HazardKind::CommentInFlowCollection)
        })
    );
} // End of function the_fixtures_other_lists_plan_through_the_draft()

// ---------------------------------------------------------------------------
// One item per line
// ---------------------------------------------------------------------------

/// One item per line with `]` on the last item's line: an appended item goes on
/// a new line before `]`, and removing the last item keeps `]` where it is.
#[test]
fn a_closing_bracket_on_the_last_items_line_stays_there() {
    let source = "l: [\n  a,\n  b]\n";
    let path = DocumentPath::root(0).with_key("l");
    assert_eq!(
        apply(
            source,
            &[insert(path.clone(), ItemPlacement::End, &["c", "d"])]
        ),
        "l: [\n  a,\n  b,\n  'c',\n  'd']\n"
    );
    assert_eq!(apply(source, &[remove(&path, 1)]), "l: [\n  a]\n");
    assert_eq!(apply(source, &[remove(&path, 0)]), "l: [\n  b]\n");
} // End of function a_closing_bracket_on_the_last_items_line_stays_there()

/// A CRLF list gets CRLF lines, copied from the anchor, and a blank line
/// between two items is left where it is.
#[test]
fn new_lines_copy_the_line_ending_and_blank_lines_stay() {
    let source = "l: [\r\n  a,\r\n\r\n  b\r\n]\r\n";
    let path = DocumentPath::root(0).with_key("l");
    assert_eq!(
        apply(
            source,
            &[insert(path.clone(), ItemPlacement::After(0), &["x"])]
        ),
        "l: [\r\n  a,\r\n  'x',\r\n\r\n  b\r\n]\r\n"
    );
    assert_eq!(
        apply(source, &[insert(path.clone(), ItemPlacement::End, &["y"])]),
        "l: [\r\n  a,\r\n\r\n  b,\r\n  'y'\r\n]\r\n"
    );
    assert_eq!(
        apply(source, &[remove(&path, 0)]),
        "l: [\r\n\r\n  b\r\n]\r\n"
    );
    assert_eq!(
        apply(source, &[remove(&path, 1)]),
        "l: [\r\n  a\r\n\r\n]\r\n"
    );
} // End of function new_lines_copy_the_line_ending_and_blank_lines_stay()

/// A list wrapped over lines without one item per line is edited inline:
/// removals join tokens, insertions copy the list's first one-line separator.
#[test]
fn a_wrapped_list_is_edited_inline() {
    let source = "l: [a, b,\n  c, d]\n";
    let path = DocumentPath::root(0).with_key("l");
    assert_eq!(apply(source, &[remove(&path, 1)]), "l: [a, c, d]\n");
    assert_eq!(apply(source, &[remove(&path, 3)]), "l: [a, b,\n  c]\n");
    assert_eq!(
        apply(
            source,
            &[insert(path.clone(), ItemPlacement::After(1), &["x"])]
        ),
        "l: [a, b, 'x',\n  c, d]\n"
    );
} // End of function a_wrapped_list_is_edited_inline()

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

/// Adjacent removals abut rather than overlap, at the start, in the middle and
/// at the end of a list, single-line and one item per line.
#[test]
fn adjacent_removals_abut() {
    let source = "l: [a, b, c, d, e]\n";
    let path = DocumentPath::root(0).with_key("l");
    for (removed, expected) in [
        (vec![0, 1], "l: [c, d, e]\n"),
        (vec![1, 2], "l: [a, d, e]\n"),
        (vec![3, 4], "l: [a, b, c]\n"),
        (vec![1, 3], "l: [a, c, e]\n"),
        (vec![0, 2, 4], "l: [b, d]\n"),
        (vec![2, 3, 4], "l: [a, b]\n"),
    ] {
        let edits: Vec<DocumentEdit> = removed.iter().map(|at| remove(&path, *at)).collect();
        assert_eq!(apply(source, &edits), expected, "{removed:?}");
    } // End of the loop over the removal sets
    let lines = "l: [\n  a,\n  b,  # of b\n  c,\n  d\n]\n";
    for (removed, expected) in [
        (vec![0, 1], "l: [\n  c,\n  d\n]\n"),
        (vec![1, 2], "l: [\n  a,\n  d\n]\n"),
        (vec![2, 3], "l: [\n  a,\n  b  # of b\n]\n"),
    ] {
        let edits: Vec<DocumentEdit> = removed.iter().map(|at| remove(&path, *at)).collect();
        assert_eq!(apply(lines, &edits), expected, "{removed:?}");
    } // End of the loop over the one-per-line removal sets
} // End of function adjacent_removals_abut()

/// A multi-item insertion, a removal and a rewritten survivor land in one
/// batch through the draft planner, and `item_positions` maps every original
/// item to where it went.
#[test]
fn an_insertion_a_removal_and_an_edited_survivor_share_a_batch() {
    let draft = MatchDraft::new().with_item(SequenceField::Triggers, 2, ":c2");
    let structure = intents(vec![
        SequenceIntent::RemoveItem {
            field: SequenceField::Triggers,
            index: 0,
        },
        SequenceIntent::InsertItems {
            field: SequenceField::Triggers,
            at: ItemPlacement::After(1),
            items: items(&[":p", ":q"]),
        },
        SequenceIntent::InsertItems {
            field: SequenceField::SearchTerms,
            at: ItemPlacement::End,
            items: items(&["more"]),
        },
    ]);
    let edits =
        plan_match_edits_with(&match_at(LISTS, 0), &draft, &structure).expect("the intents plan");
    let text = apply(LISTS, &edits);
    let expected = replaced(
        &replaced(
            LISTS,
            "[\":a\", \":b\", \":c\"]",
            "[\":b\", ':p', ':q', \":c2\"]",
        ),
        "[plain, 'single', \"double\"]",
        "[plain, 'single', \"double\", 'more']",
    );
    assert_eq!(text, expected);
    assert_eq!(
        item_positions(&edits, &list(0, "triggers"), 3),
        Some(vec![None, Some(0), Some(3)])
    );
    // The rest of the document is untouched, match for match.
    let before = document(LISTS);
    let after = document(&text);
    assert_eq!(before.matches.len(), after.matches.len());
    for untouched in 1..before.matches.len() {
        assert_eq!(
            texts(&before.matches[untouched].trigger.triggers),
            texts(&after.matches[untouched].trigger.triggers)
        );
        assert_eq!(
            texts(&before.matches[untouched].search_terms),
            texts(&after.matches[untouched].search_terms)
        );
    } // End of the loop over the matches the batch did not name
} // End of function an_insertion_a_removal_and_an_edited_survivor_share_a_batch()

/// The projection still reports the list as a flow list after an edit, and the
/// draft layer admits an empty `[]` for insertion.
#[test]
fn presence_stays_flow_and_an_empty_list_takes_a_draft_insertion() {
    let structure = intents(vec![SequenceIntent::InsertItems {
        field: SequenceField::Triggers,
        at: ItemPlacement::End,
        items: items(&[":e1", ":e2"]),
    }]);
    let edits = plan_match_edits_with(&match_at(LISTS, 4), &MatchDraft::new(), &structure)
        .expect("the intent plans");
    let text = apply(LISTS, &edits);
    assert!(text.contains("  - triggers: [':e1', ':e2']\n"));
    assert!(matches!(
        match_at(&text, 4).trigger.triggers_presence,
        SequencePresence::Items {
            flow: true,
            count: 2,
            ..
        }
    ));
} // End of function presence_stays_flow_and_an_empty_list_takes_a_draft_insertion()

/// `imports` is a flow list of scalars too, at the document's root: the engine
/// edits it in place (no draft intent names it — import editing is not Phase 3).
#[test]
fn a_flow_imports_list_is_edited_in_place() {
    let source = "imports: [\"_a.yml\", \"_b.yml\"]\nmatches:\n  - trigger: ':a'\n    replace: x\n";
    let path = DocumentPath::root(0).with_key("imports");
    assert_eq!(
        apply(source, &[insert(path.clone(), ItemPlacement::End, &["_c.yml"])]),
        "imports: [\"_a.yml\", \"_b.yml\", '_c.yml']\nmatches:\n  - trigger: ':a'\n    replace: x\n"
    );
    assert_eq!(
        apply(source, &[remove(&path, 0)]),
        "imports: [\"_b.yml\"]\nmatches:\n  - trigger: ':a'\n    replace: x\n"
    );
} // End of function a_flow_imports_list_is_edited_in_place()

// ---------------------------------------------------------------------------
// Refused by name
// ---------------------------------------------------------------------------

/// **Acceptance: ambiguous trivia is refused by name**, and the refusal points
/// at the comment or comma that caused it.
#[test]
fn ambiguous_trivia_is_refused_by_name() {
    let path = DocumentPath::root(0).with_key("l");
    let cases: [(&str, &str, DocumentEdit); 5] = [
        // A comment on a line of its own inside the brackets.
        (
            "l: [\n  a,\n  # about b\n  b\n]\n",
            "# about b",
            insert(path.clone(), ItemPlacement::End, &["x"]),
        ),
        // A comment between an item and its comma: the comma is off its line.
        ("l: [\n  a  # about a\n  , b\n]\n", ",", remove(&path, 0)),
        // A comment trailing a line two items share.
        (
            "l: [\n  a, b,  # which?\n  c\n]\n",
            "# which?",
            remove(&path, 2),
        ),
        // An insertion that would put a new item on a commented item's line.
        (
            "l: [a,  # of a\n  b, c]\n",
            "# of a",
            insert(path.clone(), ItemPlacement::After(0), &["x"]),
        ),
        // A removal that would take a survivor's comment with it.
        ("l: [\n  a,  # of a\n  b]\n", "# of a", remove(&path, 1)),
    ];
    for (source, culprit, edit) in cases {
        let error = apply_edits(source, &[edit]).expect_err("must refuse");
        let EditError::FlowListTriviaAmbiguous { edit: 0, at, .. } = error else {
            panic!("{source:?}: {error:?}");
        };
        assert!(
            source[at.start..at.end].starts_with(culprit),
            "{source:?}: the refusal points at {:?}",
            &source[at.start..at.end]
        );
    } // End of the loop over the ambiguous shapes
} // End of function ambiguous_trivia_is_refused_by_name()

/// A comment the rule *can* place stays put: on the opening bracket's line it
/// belongs to the list, after an item's comma to that item.
#[test]
fn a_placeable_comment_stays_with_its_owner() {
    let source = "l: [  # the list\n  a,  # of a\n  b\n]\n";
    let path = DocumentPath::root(0).with_key("l");
    assert_eq!(
        apply(
            source,
            &[insert(path.clone(), ItemPlacement::Front, &["x"])]
        ),
        "l: [  # the list\n  'x',\n  a,  # of a\n  b\n]\n"
    );
    assert_eq!(
        apply(source, &[remove(&path, 0)]),
        "l: [  # the list\n  b\n]\n"
    );
    assert_eq!(
        apply(source, &[remove(&path, 1)]),
        "l: [  # the list\n  a  # of a\n]\n"
    );
    // Inline, the comment of the first item on the bracket's line goes with it.
    assert_eq!(
        apply("l: [a,  # of a\n  b, c]\n", &[remove(&path, 0)]),
        "l: [b, c]\n"
    );
} // End of function a_placeable_comment_stays_with_its_owner()

/// Everything outside the new licence keeps its old refusal: a hazard other
/// than the list's own comments, an item that is a collection, a list inside
/// another flow collection, a mapping item, and an item written over two lines.
#[test]
fn shapes_outside_the_licence_keep_their_refusals() {
    let path = DocumentPath::root(0).with_key("l");
    assert!(matches!(
        apply_edits(
            "l: [&x a, b]\nm: *x\n",
            &[insert(path.clone(), ItemPlacement::End, &["c"])]
        ),
        Err(EditError::Refused {
            hazard: HazardKind::AnchorDefinition,
            ..
        })
    ));
    assert!(matches!(
        apply_edits(
            "l: [a, [b]]\n",
            &[insert(path.clone(), ItemPlacement::End, &["c"])]
        ),
        Err(EditError::FlowSequenceInsertionUnsupported { edit: 0, .. })
    ));
    assert!(matches!(
        apply_edits("l: [a, [b]]\n", &[remove(&path, 0)]),
        Err(EditError::FlowCollection { edit: 0, .. })
    ));
    assert!(matches!(
        apply_edits(
            "l: {k: [a, b]}\n",
            &[remove(
                &DocumentPath::root(0).with_key("l").with_key("k"),
                0
            )]
        ),
        Err(EditError::FlowCollection { edit: 0, .. })
    ));
    assert!(matches!(
        apply_edits(
            "l: [\"a\n  b\", c]\n",
            &[insert(path.clone(), ItemPlacement::End, &["d"])]
        ),
        Err(EditError::FlowListLayoutUnsupported { edit: 0, .. })
    ));
} // End of function shapes_outside_the_licence_keep_their_refusals()

// ---------------------------------------------------------------------------
// Through the save transaction
// ---------------------------------------------------------------------------

/// A flow-list batch commits through `save_document`, and the bytes on disk are
/// the candidate the engine verified.
#[test]
fn a_flow_list_batch_commits_through_the_save_transaction() {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("flow.yml");
    std::fs::write(&target, LISTS.as_bytes()).expect("the fixture is written");
    let edits = plan_match_edits_with(
        &match_at(LISTS, 3),
        &MatchDraft::new(),
        &intents(vec![
            SequenceIntent::RemoveItem {
                field: SequenceField::SearchTerms,
                index: 1,
            },
            SequenceIntent::InsertItems {
                field: SequenceField::SearchTerms,
                at: ItemPlacement::Front,
                items: items(&["ágil"]),
            },
        ]),
    )
    .expect("the intents plan");
    let context = DocumentContext {
        id: DocumentId(1),
        path: target.clone(),
        relative_path: std::path::PathBuf::from("flow.yml"),
        kind: espansoconfig_core::discovery::FileKind::MatchFile,
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
    assert_eq!(
        written,
        replaced(LISTS, "[día, \"é😀\", 'ñandú']", "['ágil', día, 'ñandú']")
    );
} // End of function a_flow_list_batch_commits_through_the_save_transaction()

// ---------------------------------------------------------------------------
// The review's findings (`docs/reviews/phase-3-3.md`)
// ---------------------------------------------------------------------------

/// Finding 1: a retained comment never comes to share its line with a new or
/// a moved item. A front insertion onto a commented first line, and a removal
/// that pulls a commented item up onto another item's line, are both refused by
/// name, pointing at the comment.
#[test]
fn a_join_never_makes_a_retained_comment_shared() {
    let path = DocumentPath::root(0).with_key("l");
    let cases: [(&str, DocumentEdit); 2] = [
        (
            "l: [a, # of a\n b, c]\n",
            insert(path.clone(), ItemPlacement::Front, &["x"]),
        ),
        ("l: [x, a,\n  b, # of b\n  c]\n", remove(&path, 1)),
    ];
    for (source, edit) in cases {
        let error = apply_edits(source, &[edit]).expect_err("must refuse");
        let EditError::FlowListTriviaAmbiguous { edit: 0, at, .. } = error else {
            panic!("{source:?}: {error:?}");
        };
        assert!(
            source[at.start..at.end].starts_with("# of"),
            "{source:?}: {:?}",
            &source[at.start..at.end]
        );
    } // End of the loop over the two joins
      // The same list still takes an insertion that shares no commented line.
    assert_eq!(
        apply(
            "l: [a, # of a\n b, c]\n",
            &[insert(path.clone(), ItemPlacement::End, &["x"])]
        ),
        "l: [a, # of a\n b, c, 'x']\n"
    );
} // End of function a_join_never_makes_a_retained_comment_shared()

/// Finding 2: trivia after `]` — spaces and a comment — is outside the list, so
/// an insertion and a removal land inside the brackets and leave it byte for
/// byte.
#[test]
fn trivia_after_the_closing_bracket_stays_outside_the_list() {
    let source = "l: [a, b]  # note\nm: [c, d]   \n";
    let path = DocumentPath::root(0).with_key("l");
    assert_eq!(
        apply(source, &[insert(path.clone(), ItemPlacement::End, &["x"])]),
        "l: [a, b, 'x']  # note\nm: [c, d]   \n"
    );
    assert_eq!(
        apply(source, &[remove(&path, 1)]),
        "l: [a]  # note\nm: [c, d]   \n"
    );
    assert_eq!(
        apply(source, &[remove(&path, 0)]),
        "l: [b]  # note\nm: [c, d]   \n"
    );
    let other = DocumentPath::root(0).with_key("m");
    assert_eq!(
        apply(source, &[insert(other, ItemPlacement::Front, &["y"])]),
        "l: [a, b]  # note\nm: ['y', c, d]   \n"
    );
} // End of function trivia_after_the_closing_bracket_stays_outside_the_list()
