//! Cross-layer preservation evidence through the command path — Phase 3-15-1.
//!
//! Every Phase 3 writer is driven here through `WorkspaceSession`, the layer
//! each Tauri command is a one-line wrapper over, on real temporary files. Two
//! families of tests live in this module:
//!
//! - **Conservation** (the 3-15 acceptance clause *"unknown bytes and coverage
//!   are conserved outside explicit raw edits, checked through the command
//!   path"*). After each committed save, the disk bytes must equal, exactly,
//!   the original with only the intended span replaced. The test states that
//!   span as literal text. The **refreshed** projection, the one the session
//!   answers after `run_one_save`, is then compared with the one before on
//!   three things:
//!   - every unknown entry, by owner, path, key spelling and value bytes;
//!   - the per-mapping coverage records outside the edited items;
//!   - the whole-document accounting, re-derived from a fresh parse of the
//!     disk bytes.
//! - **Refusals** the command layer had no test of its own for: an emptied
//!   block or flow list, a content switch from a key the match does not hold,
//!   a wide creation into a flow match list, and the sidecar writer's refusals.
//!
//! The mapping from each clause to these tests and to the older ones that
//! already discharge it is `docs/decisions/3-15-1-notes.md`. Every fixture is
//! synthetic and neutral (`CLAUDE.md` section 1).

use std::fs;
use std::path::Path;

use espansoconfig_core::draft::{
    BulkOption, BulkOptionChange, BulkValue, ContentForm, ContentSwitch, MatchDraft, MatchField,
    NewContent, NewMatch, NewTrigger, ScalarItems, SequenceField, SequenceIntent, TriggerForm,
    TriggerFormChange, TriggerList, TriggerSwitch,
};
use espansoconfig_core::model::{DiagnosticCode, DocumentView, MatchId, UnknownEntry};
use espansoconfig_core::patch::{DocumentPath, EditError, ItemPlacement};
use espansoconfig_core::persist::{Acknowledgement, SaveError, BACKUP_DIRECTORY_NAME};
use espansoconfig_core::{DocumentId, SyntaxIndex};
use tempfile::TempDir;

use super::{NewMatchPosition, WorkspaceSession};
use crate::bulk::{BulkFileRequest, BulkOptionsRequest};
use crate::error::CommandError;
use crate::save::SaveResult;
use crate::sidecar::{SidecarChange, SidecarSession, SidecarUpdateOutcome, SidecarUpdateRequest};

/// A match file dense with entries the projection does not model.
///
/// Unknown entries at the top level before and after `matches`, inside a
/// global variable, and inside every snippet — a plain scalar, a block scalar,
/// a nested mapping and a block list — beside a block `triggers` list, a flow
/// `search_terms` list and comments the file and the items own. Hand-authored
/// and neutral: no test in this repository may read the owner's real
/// configuration (`CLAUDE.md` section 1).
const DENSE_UNKNOWNS: &str = concat!(
    "# A synthetic file for the Phase 3-15-1 preservation sweep.\n",
    "future_setting: 7 # an unknown top-level entry\n",
    "global_vars:\n",
    "  - name: greeting\n",
    "    type: echo\n",
    "    params:\n",
    "      echo: hello\n",
    "    later_var_key: kept\n",
    "matches:\n",
    "  # The first snippet's own comment.\n",
    "  - trigger: ':first'\n",
    "    replace: one\n",
    "    unknown_scalar: plain\n",
    "  - triggers:\n",
    "      - ':second'\n",
    "      - ':segundo'\n",
    "    replace: two\n",
    "    unknown_block: |\n",
    "      line one\n",
    "      line two\n",
    "  - trigger: ':third'\n",
    "    replace: three\n",
    "    search_terms: [alpha, beta]\n",
    "    unknown_map:\n",
    "      inner: value\n",
    "      other: [1, 2]\n",
    "  - trigger: ':fourth'\n",
    "    markdown: four\n",
    "    later_list:\n",
    "      - a\n",
    "      - b\n",
    "trailing_unknown:\n",
    "  nested:\n",
    "    deep: kept\n",
);

/// An open session over a one-file tree, with what it read before any save.
struct Opened {
    /// The temporary tree; dropped last.
    dir: TempDir,
    /// The unwatched session with the tree open.
    session: WorkspaceSession,
    /// The identity of `match/base.yml`.
    id: DocumentId,
    /// The projection before the save.
    before: DocumentView,
    /// The disk bytes before the save.
    text: String,
}

/// Opens a tree whose `match/base.yml` holds `source`.
fn opened_on(source: &str) -> Opened {
    let dir = TempDir::new().expect("temp dir");
    fs::create_dir_all(dir.path().join("match")).expect("the match directory");
    fs::write(dir.path().join("match").join("base.yml"), source).expect("the fixture");
    let session = WorkspaceSession::unwatched();
    session.open(Some(dir.path())).expect("the tree opens");
    let id = session
        .documents()
        .expect("the workspace is open")
        .iter()
        .find(|summary| summary.relative_path == Path::new("match/base.yml"))
        .expect("the file is listed")
        .id;
    let before = session.document(id).expect("the file reads");
    assert!(before.parsed, "the fixture parses");
    Opened {
        dir,
        session,
        id,
        before,
        text: source.to_owned(),
    }
} // End of function opened_on()

/// The bytes of `match/base.yml` on disk.
fn disk(dir: &TempDir) -> String {
    fs::read_to_string(dir.path().join("match").join("base.yml")).expect("the file reads back")
}

/// The path of snippet `index` of the first document.
fn item(index: usize) -> DocumentPath {
    DocumentPath::root(0).with_key("matches").with_index(index)
}

/// Whether `path` is `prefix` or lies under it.
fn under(path: &DocumentPath, prefix: &DocumentPath) -> bool {
    path.document_index() == prefix.document_index()
        && path.segments().starts_with(prefix.segments())
}

/// One unknown entry, as it must survive any save that is not an explicit raw
/// edit of its owner.
///
/// The fields are:
///
/// - **the owner**: which construct's projection recorded the entry;
/// - **the entry's own path**, when it has one;
/// - **the key's source bytes**, which is its spelling, not its decoded text;
/// - **the value's source bytes**;
/// - the value kind and the reason.
///
/// Node identities and spans are left out on purpose. They are positions in
/// one parse, and an edit elsewhere in the file legitimately moves them.
type EntrySignature = (String, Option<String>, String, String, String);

/// Builds one [`EntrySignature`], slicing the key's spelling out of `text`,
/// which is the text `entry` was projected from.
fn entry_signature(owner: &str, entry: &UnknownEntry, text: &str) -> EntrySignature {
    let key = text
        .get(entry.key_span.start..entry.key_span.end)
        .expect("the key span slices the projected text")
        .to_owned();
    (
        owner.to_owned(),
        entry.path.as_ref().map(ToString::to_string),
        key,
        entry.value_text.clone(),
        format!("{:?} {:?}", entry.value_kind, entry.reason),
    )
} // End of function entry_signature()

/// Every unknown entry of `view` (projected from `text`), each with its owner,
/// as a sorted multiset. The entries owned by `raw_item` or by its variables
/// are left out, when a raw item is given.
///
/// The owners are the document's top level, each global variable, each
/// snippet and each of a snippet's variables.
fn unknown_multiset(
    view: &DocumentView,
    text: &str,
    raw_item: Option<&DocumentPath>,
) -> Vec<EntrySignature> {
    let mut out: Vec<_> = view
        .unknown_entries
        .iter()
        .map(|entry| entry_signature("document", entry, text))
        .collect();
    for (position, variable) in view.global_vars.iter().enumerate() {
        let owner = format!("global_vars[{position}]");
        out.extend(
            variable
                .unknown_entries
                .iter()
                .map(|entry| entry_signature(&owner, entry, text)),
        );
    }
    for snippet in &view.matches {
        let path = snippet.path.as_ref();
        if path.is_some_and(|path| raw_item.is_some_and(|raw| under(path, raw))) {
            continue;
        }
        let owner = path.map_or_else(|| "an unaddressable snippet".to_owned(), |p| p.to_string());
        out.extend(
            snippet
                .unknown_entries
                .iter()
                .map(|entry| entry_signature(&owner, entry, text)),
        );
        for (position, variable) in snippet.vars.iter().enumerate() {
            let owner = format!("{owner} vars[{position}]");
            out.extend(
                variable
                    .unknown_entries
                    .iter()
                    .map(|entry| entry_signature(&owner, entry, text)),
            );
        }
    } // End of the loop over the document's snippets
    out.sort();
    out
} // End of function unknown_multiset()

/// The coverage records of `view` outside `excluded`, each as its path and its
/// modelled and unknown key counts, as a sorted multiset.
fn coverage_signature(
    view: &DocumentView,
    excluded: &[DocumentPath],
) -> Vec<(Option<String>, usize, usize)> {
    let mut out: Vec<_> = view
        .coverage
        .iter()
        .filter(|record| {
            record
                .path
                .as_ref()
                .is_none_or(|path| !excluded.iter().any(|prefix| under(path, prefix)))
        })
        .map(|record| {
            (
                record.path.as_ref().map(ToString::to_string),
                record.modelled.len(),
                record.unknown.len(),
            )
        })
        .collect();
    out.sort();
    out
} // End of function coverage_signature()

/// Asserts that `view` accounts for every key of `text`. This is re-derived
/// from a fresh parse of those bytes, not read off the view's own diagnostics.
fn assert_accounting_complete(view: &DocumentView, text: &str, what: &str) {
    let index = SyntaxIndex::parse(text).expect("the disk bytes parse");
    assert!(
        view.coverage_is_complete(&index),
        "{what}: every coverage record accounts for its mapping"
    );
    assert!(
        view.unaccounted_keys(&index).is_empty(),
        "{what}: every key is modelled, unknown or inside an undescended span"
    );
    assert!(
        !view.diagnostics.iter().any(|diagnostic| matches!(
            diagnostic.code,
            DiagnosticCode::CoverageIsIncomplete | DiagnosticCode::KeyNotAccountedFor
        )),
        "{what}: the projection reports no accounting failure"
    );
} // End of function assert_accounting_complete()

/// `source` with each `(from, to)` pair applied, where every `from` must occur
/// in `source` exactly once.
///
/// This builds a save's **expected disk bytes independently of the engine**.
/// The test states, as literal text, the one span the save may change and what
/// it must become. Every other byte, inside the edited snippet or not, must
/// come back as the original's. A `to` that begins with its `from` states a
/// pure insertion after it.
fn replaced(source: &str, pairs: &[(&str, &str)]) -> String {
    let mut out = source.to_owned();
    for (from, to) in pairs {
        assert_eq!(
            source.matches(from).count(),
            1,
            "{from:?} names exactly one span of the original"
        );
        out = out.replacen(from, to, 1);
    }
    out
} // End of function replaced()

/// What one conservation check compares against.
struct Edited<'a> {
    /// A label for assertion messages.
    what: &'a str,
    /// The exact disk bytes the save must leave, built by [`replaced`].
    expected: String,
    /// The snippets whose own coverage counts may differ afterwards.
    items: &'a [DocumentPath],
    /// The snippet an explicit raw edit rewrote. Its own unknown entries may
    /// change at the author's word. `None` for a structured save.
    raw_item: Option<DocumentPath>,
}

/// The conservation check that every successful Phase 3 save in this module
/// runs. It asserts four things:
///
/// 1. The disk bytes are **exactly** the expected ones, meaning the original
///    with only the intended span replaced. The session's text is the disk's.
/// 2. The refreshed projection's unknown entries equal the original's as a
///    multiset of (owner, path, key spelling, value bytes, kind, reason).
///    For a structured save that is every one of them. For an explicit raw
///    edit it is every one outside the edited snippet.
/// 3. The coverage records outside the edited snippets keep their paths and
///    their modelled and unknown counts.
/// 4. The refreshed projection accounts for every key of the disk bytes.
fn assert_conserved(opened: &Opened, edited: &Edited<'_>) {
    let what = edited.what;
    let after_text = disk(&opened.dir);
    assert_eq!(
        after_text, edited.expected,
        "{what}: the disk holds exactly the original with the intended span replaced"
    );
    assert_eq!(
        opened.session.text(opened.id).expect("the session reads"),
        after_text,
        "{what}: the session's text is the disk's"
    );

    let refreshed = opened
        .session
        .document(opened.id)
        .expect("the refreshed projection reads");
    assert_ne!(
        refreshed.revision, opened.before.revision,
        "{what}: committed"
    );
    assert!(refreshed.parsed, "{what}: the saved file parses");
    let raw = edited.raw_item.as_ref();
    assert_eq!(
        unknown_multiset(&refreshed, &after_text, raw),
        unknown_multiset(&opened.before, &opened.text, raw),
        "{what}: every unknown entry keeps its owner, its spelling and its bytes"
    );
    assert_eq!(
        coverage_signature(&refreshed, edited.items),
        coverage_signature(&opened.before, edited.items),
        "{what}: coverage outside the edited snippets is unchanged"
    );
    assert_accounting_complete(&refreshed, &after_text, what);
} // End of function assert_conserved()

/// Asserts that `result` is a committed save.
fn assert_committed(result: SaveResult, what: &str) {
    match result {
        SaveResult::Saved { committed, .. } => assert!(committed, "{what}: bytes changed"),
        other => panic!("{what}: expected a committed save, got {other:?}"),
    }
}

/// Saves `draft` over snippet `index` through `save_match`.
fn save_draft(opened: &Opened, index: usize, draft: &MatchDraft) -> SaveResult {
    opened
        .session
        .save_match(
            opened.before.matches[index].id,
            draft,
            opened.before.revision,
            &Acknowledgement::none(),
        )
        .expect("the draft plans and the save runs")
}

/// Asserts that a refused writing command left the file and the backup root
/// exactly as they were.
fn assert_nothing_written(opened: &Opened, what: &str) {
    assert_eq!(disk(&opened.dir), opened.text, "{what}: no byte changed");
    assert!(
        !opened.dir.path().join(BACKUP_DIRECTORY_NAME).exists(),
        "{what}: no transaction ran, so no file was copied"
    );
}

// ---------------------------------------------------------------------------
// Conservation through the command path
// ---------------------------------------------------------------------------

/// Phase 3-1: `save_match` inserts two absent fields as one group.
#[test]
fn a_grouped_insertion_conserves_unknown_bytes_and_coverage_through_save_match() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let draft = MatchDraft::new()
        .with(MatchField::Label, "a label")
        .with(MatchField::Word, "true");
    assert_committed(save_draft(&opened, 0, &draft), "grouped insertion");
    let expected = replaced(
        DENSE_UNKNOWNS,
        &[(
            "    unknown_scalar: plain\n",
            "    unknown_scalar: plain\n    label: a label\n    word: 'true'\n",
        )],
    );
    assert_conserved(
        &opened,
        &Edited {
            what: "grouped insertion",
            expected,
            items: &[item(0)],
            raw_item: None,
        },
    );
} // End of function a_grouped_insertion_conserves_unknown_bytes_and_coverage_through_save_match()

/// Phases 3-1 and 3-5-1: `save_match` substitutes a content key in place.
#[test]
fn a_content_switch_conserves_unknown_bytes_and_coverage_through_save_match() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let switch = ContentSwitch::new(ContentForm::Markdown, ContentForm::Html).expect("two forms");
    let draft = MatchDraft::new().with_content_switch(switch);
    assert_committed(save_draft(&opened, 3, &draft), "content switch");
    assert_conserved(
        &opened,
        &Edited {
            what: "content switch",
            expected: replaced(
                DENSE_UNKNOWNS,
                &[("    markdown: four\n", "    html: four\n")],
            ),
            items: &[item(3)],
            raw_item: None,
        },
    );
} // End of function a_content_switch_conserves_unknown_bytes_and_coverage_through_save_match()

/// Phase 3-2: an insertion and a removal together, inside a block `triggers` list.
#[test]
fn a_block_list_edit_conserves_unknown_bytes_and_coverage_through_save_match() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let draft = MatchDraft::new()
        .with_sequence(SequenceIntent::InsertItems {
            field: SequenceField::Triggers,
            at: ItemPlacement::End,
            items: ScalarItems::one(":zweite"),
        })
        .with_sequence(SequenceIntent::RemoveItem {
            field: SequenceField::Triggers,
            index: 0,
        });
    assert_committed(save_draft(&opened, 1, &draft), "block list edit");
    let expected = replaced(
        DENSE_UNKNOWNS,
        &[(
            "      - ':second'\n      - ':segundo'\n",
            "      - ':segundo'\n      - ':zweite'\n",
        )],
    );
    assert_conserved(
        &opened,
        &Edited {
            what: "block list edit",
            expected,
            items: &[item(1)],
            raw_item: None,
        },
    );
} // End of function a_block_list_edit_conserves_unknown_bytes_and_coverage_through_save_match()

/// Phase 3-3: an insertion and a removal in one flow `search_terms` list,
/// which stays a flow list.
#[test]
fn a_flow_list_edit_conserves_unknown_bytes_and_coverage_through_save_match() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let draft = MatchDraft::new()
        .with_sequence(SequenceIntent::InsertItems {
            field: SequenceField::SearchTerms,
            at: ItemPlacement::Front,
            items: ScalarItems::one("gamma"),
        })
        .with_sequence(SequenceIntent::RemoveItem {
            field: SequenceField::SearchTerms,
            index: 1,
        });
    assert_committed(save_draft(&opened, 2, &draft), "flow list edit");
    assert_conserved(
        &opened,
        &Edited {
            what: "flow list edit",
            expected: replaced(DENSE_UNKNOWNS, &[("[alpha, beta]", "['gamma', alpha]")]),
            items: &[item(2)],
            raw_item: None,
        },
    );
} // End of function a_flow_list_edit_conserves_unknown_bytes_and_coverage_through_save_match()

/// Phases 3-2 and 3-6-1: a single `trigger` switched to a block `triggers` list.
#[test]
fn a_trigger_form_switch_conserves_unknown_bytes_and_coverage_through_save_match() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let items =
        ScalarItems::from_vec(vec![":first".to_owned(), ":primero".to_owned()]).expect("two items");
    let draft = MatchDraft::new().with_trigger_form(TriggerFormChange::Switch {
        switch: TriggerSwitch::ToList {
            from: TriggerForm::Trigger,
            items,
        },
    });
    assert_committed(save_draft(&opened, 0, &draft), "trigger form switch");
    let expected = replaced(
        DENSE_UNKNOWNS,
        &[(
            "  - trigger: ':first'\n",
            "  - triggers:\n      - ':first'\n      - ':primero'\n",
        )],
    );
    assert_conserved(
        &opened,
        &Edited {
            what: "trigger form switch",
            expected,
            items: &[item(0)],
            raw_item: None,
        },
    );
} // End of function a_trigger_form_switch_conserves_unknown_bytes_and_coverage_through_save_match()

/// Phase 3-4: a wide creation at the end of the match list, followed by a
/// top-level unknown entry. The new item must be one contiguous insertion
/// after the last snippet's final line.
#[test]
fn a_wide_creation_conserves_unknown_bytes_and_coverage_through_create_match() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let mut wide = NewMatch::new(
        NewTrigger::Multiple(
            TriggerList::new(vec![":fifth".to_owned(), ":quinto".to_owned()]).expect("non-empty"),
        ),
        NewContent::Replace("five".to_owned()),
    );
    wide.search_terms = Some(vec!["delta".to_owned()]);
    wide.word = Some("true".to_owned());
    let result = opened
        .session
        .create_match(
            opened.id,
            &wide,
            &NewMatchPosition::End {},
            opened.before.revision,
            &Acknowledgement::none(),
        )
        .expect("the creation is legal");
    assert_committed(result, "wide creation");
    let expected = replaced(
        DENSE_UNKNOWNS,
        &[(
            "      - b\n",
            concat!(
                "      - b\n",
                "  - triggers:\n",
                "      - ':fifth'\n",
                "      - ':quinto'\n",
                "    replace: five\n",
                "    search_terms:\n",
                "      - delta\n",
                "    word: 'true'\n",
            ),
        )],
    );
    assert_conserved(
        &opened,
        &Edited {
            what: "wide creation",
            expected,
            items: &[item(4)],
            raw_item: None,
        },
    );
    let refreshed = opened.session.document(opened.id).expect("it reads");
    assert_eq!(refreshed.matches.len(), 5, "exactly one snippet was added");
} // End of function a_wide_creation_conserves_unknown_bytes_and_coverage_through_create_match()

/// Phase 3-10: one bulk run sets two options on two snippets of one file.
#[test]
fn a_bulk_run_conserves_unknown_bytes_and_coverage_through_apply_bulk_options() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let selected: Vec<MatchId> = vec![opened.before.matches[0].id, opened.before.matches[2].id];
    let request = BulkOptionsRequest {
        changes: vec![
            BulkOptionChange {
                option: BulkOption::Word,
                value: BulkValue::Set("true".to_owned()),
            },
            BulkOptionChange {
                option: BulkOption::ForceMode,
                value: BulkValue::Set("clipboard".to_owned()),
            },
        ],
        files: vec![BulkFileRequest {
            document: opened.id,
            base_revision: opened.before.revision,
            matches: selected,
            consent: None,
        }],
        excluded: Vec::new(),
    };
    let result = opened
        .session
        .apply_bulk_options(&request)
        .expect("the request is well formed");
    let outcomes: Vec<&str> = result
        .files
        .iter()
        .map(|report| report.outcome.outcome())
        .collect();
    assert_eq!(outcomes, ["saved"], "{result:?}");
    let options = "    word: true\n    force_mode: clipboard\n";
    let expected = replaced(
        DENSE_UNKNOWNS,
        &[
            (
                "    unknown_scalar: plain\n",
                &format!("    unknown_scalar: plain\n{options}"),
            ),
            (
                "      other: [1, 2]\n",
                &format!("      other: [1, 2]\n{options}"),
            ),
        ],
    );
    assert_conserved(
        &opened,
        &Edited {
            what: "bulk run",
            expected,
            items: &[item(0), item(2)],
            raw_item: None,
        },
    );
} // End of function a_bulk_run_conserves_unknown_bytes_and_coverage_through_apply_bulk_options()

/// Phase 3-7: the explicit raw edit. The snippet's own unknown entry changes at
/// the author's word. Every unknown entry and byte outside its range survives.
#[test]
fn an_explicit_raw_item_edit_conserves_everything_outside_its_range() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let original = concat!(
        "  - triggers:\n",
        "      - ':second'\n",
        "      - ':segundo'\n",
        "    replace: two\n",
        "    unknown_block: |\n",
        "      line one\n",
        "      line two\n",
    );
    let text = concat!(
        "  - triggers:\n",
        "      - ':second'\n",
        "      - ':segundo'\n",
        "    replace: two\n",
        "    unknown_block: |\n",
        "      line one, rewritten\n",
    );
    assert_eq!(
        opened
            .session
            .match_item_text(opened.before.matches[1].id)
            .expect("the range reads")
            .text,
        original,
        "the owned range is exactly the snippet's lines"
    );
    let result = opened
        .session
        .save_match_item_text(
            opened.before.matches[1].id,
            opened.before.revision,
            text,
            &Acknowledgement::none(),
        )
        .expect("the raw item save commits");
    assert_committed(result, "raw item edit");
    assert_conserved(
        &opened,
        &Edited {
            what: "raw item edit",
            expected: replaced(DENSE_UNKNOWNS, &[(original, text)]),
            items: &[item(1)],
            raw_item: Some(item(1)),
        },
    );
    // The edit really did change an unknown entry inside its own range, so the
    // exclusion above is not what made the comparison pass vacuously.
    let refreshed = opened.session.document(opened.id).expect("it reads");
    assert_ne!(
        unknown_multiset(&refreshed, &disk(&opened.dir), None),
        unknown_multiset(&opened.before, &opened.text, None),
        "the edited snippet's own unknown entry changed"
    );
} // End of function an_explicit_raw_item_edit_conserves_everything_outside_its_range()

/// The comparison's negative controls. Without these, the checks above could
/// pass by comparing two empty lists, or lists too coarse to see a change.
///
/// - A dropped unknown entry changes both the entry multiset and the coverage
///   signature.
/// - One altered byte inside an unknown value changes the entry multiset.
/// - **A key spelling change** changes it too. `"unknown_scalar"` decodes to
///   the same key as `unknown_scalar`, so the decoded keys are asserted equal
///   first: the spelling is what the multiset sees.
/// - **An ownership move** changes it too. The same entry moved, byte for
///   byte, from snippet 0 to snippet 3 has the same key and value, so those are
///   asserted equal first: the owner is what the multiset sees.
#[test]
fn the_conservation_comparison_sees_a_lost_moved_respelled_or_altered_unknown_entry() {
    let original = opened_on(DENSE_UNKNOWNS);
    let entries = |opened: &Opened| unknown_multiset(&opened.before, &opened.text, None);
    let decoded = |opened: &Opened| {
        let mut out: Vec<(Option<String>, String)> = opened
            .before
            .matches
            .iter()
            .flat_map(|snippet| snippet.unknown_entries.iter())
            .map(|entry| (entry.key.clone(), entry.value_text.clone()))
            .collect();
        out.sort();
        out
    };
    assert!(entries(&original).len() >= 7);

    let lost = opened_on(&DENSE_UNKNOWNS.replace("    later_list:\n      - a\n      - b\n", ""));
    assert_ne!(
        entries(&lost),
        entries(&original),
        "a dropped entry is seen"
    );
    assert_ne!(
        coverage_signature(&lost.before, &[item(0)]),
        coverage_signature(&original.before, &[item(0)]),
        "a dropped unknown key changes its mapping's coverage record"
    );

    let altered = opened_on(&DENSE_UNKNOWNS.replace("deep: kept", "deep: kepT"));
    assert_ne!(
        entries(&altered),
        entries(&original),
        "an altered byte is seen"
    );

    let respelled = opened_on(&DENSE_UNKNOWNS.replace(
        "    unknown_scalar: plain\n",
        "    \"unknown_scalar\": plain\n",
    ));
    assert_eq!(
        decoded(&respelled),
        decoded(&original),
        "the same decoded key"
    );
    assert_ne!(
        entries(&respelled),
        entries(&original),
        "a key spelling change is seen"
    );

    let moved = opened_on(
        &DENSE_UNKNOWNS
            .replace("    unknown_scalar: plain\n", "")
            .replace("      - b\n", "      - b\n    unknown_scalar: plain\n"),
    );
    assert_eq!(
        decoded(&moved),
        decoded(&original),
        "the same key and value"
    );
    assert_ne!(
        entries(&moved),
        entries(&original),
        "an entry that moved to another snippet is seen"
    );
} // End of function the_conservation_comparison_sees_a_lost_moved_respelled_or_altered_unknown_entry()

/// The exact-bytes check's negative control. A grouped insertion is saved for
/// real. Its disk bytes are then compared against the expected text with one
/// byte changed **inside the edited snippet** but outside the inserted span:
/// its `replace` value. The check the review replaced excluded the whole
/// snippet from the byte comparison and would have accepted that. The exact
/// comparison does not.
#[test]
fn the_exact_bytes_check_sees_a_change_inside_the_edited_snippet() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let draft = MatchDraft::new()
        .with(MatchField::Label, "a label")
        .with(MatchField::Word, "true");
    assert_committed(save_draft(&opened, 0, &draft), "grouped insertion");
    let honest = replaced(
        DENSE_UNKNOWNS,
        &[(
            "    unknown_scalar: plain\n",
            "    unknown_scalar: plain\n    label: a label\n    word: 'true'\n",
        )],
    );
    let written = disk(&opened.dir);
    assert_eq!(written, honest);
    let mutated_inside = honest.replacen("    replace: one\n", "    replace: onE\n", 1);
    assert_ne!(mutated_inside, honest, "the mutation took");
    assert_ne!(
        written, mutated_inside,
        "a byte changed inside the edited snippet is seen"
    );
    let respelled_inside = honest.replacen(
        "    unknown_scalar: plain\n",
        "    'unknown_scalar': plain\n",
        1,
    );
    assert_ne!(
        written, respelled_inside,
        "a key respelled inside the edited snippet is seen"
    );
} // End of function the_exact_bytes_check_sees_a_change_inside_the_edited_snippet()

// ---------------------------------------------------------------------------
// Refusals through the command path
// ---------------------------------------------------------------------------

/// Phase 3-2: removing every item of a block list is refused by name before a
/// transaction runs.
#[test]
fn emptying_a_block_list_is_refused_through_save_match_and_writes_nothing() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let draft = MatchDraft::new()
        .with_sequence(SequenceIntent::RemoveItem {
            field: SequenceField::Triggers,
            index: 0,
        })
        .with_sequence(SequenceIntent::RemoveItem {
            field: SequenceField::Triggers,
            index: 1,
        });
    let error = opened
        .session
        .save_match(
            opened.before.matches[1].id,
            &draft,
            opened.before.revision,
            &Acknowledgement::none(),
        )
        .expect_err("a list is never emptied into a stranded key");
    assert_eq!(error.code(), "draftRefused", "{error:?}");
    let json = serde_json::to_value(&error).expect("the refusal serializes");
    assert_eq!(json["error"]["SequenceWouldBeEmpty"]["field"], "triggers");
    assert_nothing_written(&opened, "emptied block list");
} // End of function emptying_a_block_list_is_refused_through_save_match_and_writes_nothing()

/// Phase 3-3: removing every item of a flow list is refused by name before a
/// transaction runs.
#[test]
fn emptying_a_flow_list_is_refused_through_save_match_and_writes_nothing() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let draft = MatchDraft::new()
        .with_sequence(SequenceIntent::RemoveItem {
            field: SequenceField::SearchTerms,
            index: 0,
        })
        .with_sequence(SequenceIntent::RemoveItem {
            field: SequenceField::SearchTerms,
            index: 1,
        });
    let error = opened
        .session
        .save_match(
            opened.before.matches[2].id,
            &draft,
            opened.before.revision,
            &Acknowledgement::none(),
        )
        .expect_err("a flow list is never emptied either");
    assert_eq!(error.code(), "draftRefused", "{error:?}");
    let json = serde_json::to_value(&error).expect("the refusal serializes");
    assert_eq!(
        json["error"]["SequenceWouldBeEmpty"]["field"],
        "search_terms"
    );
    assert_nothing_written(&opened, "emptied flow list");
} // End of function emptying_a_flow_list_is_refused_through_save_match_and_writes_nothing()

/// Phase 3-1: a content switch from a key the snippet does not hold is refused
/// before a transaction runs.
#[test]
fn a_content_switch_from_an_absent_key_is_refused_through_save_match_and_writes_nothing() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let switch = ContentSwitch::new(ContentForm::Replace, ContentForm::Html).expect("two forms");
    let error = opened
        .session
        .save_match(
            opened.before.matches[3].id,
            &MatchDraft::new().with_content_switch(switch),
            opened.before.revision,
            &Acknowledgement::none(),
        )
        .expect_err("the fourth snippet holds `markdown`, not `replace`");
    assert_eq!(error.code(), "draftRefused", "{error:?}");
    assert_nothing_written(&opened, "switch from an absent key");
} // End of function a_content_switch_from_an_absent_key_is_refused_through_save_match_and_writes_nothing()

/// Phase 3-4: a wide creation into a flow match list is refused, and nothing
/// is written.
#[test]
fn a_wide_creation_into_a_flow_match_list_is_refused_and_writes_nothing() {
    let opened = opened_on("matches: [{trigger: ':a', replace: b}]\n");
    let mut wide = NewMatch::new(
        NewTrigger::Multiple(TriggerList::new(vec![":c".to_owned()]).expect("non-empty")),
        NewContent::Replace("d".to_owned()),
    );
    wide.search_terms = Some(vec!["e".to_owned()]);
    let result = opened.session.create_match(
        opened.id,
        &wide,
        &NewMatchPosition::End {},
        opened.before.revision,
        &Acknowledgement::none(),
    );
    match result {
        Err(CommandError::SaveFailed {
            error: SaveError::Patch(EditError::FlowSequenceInsertionUnsupported { .. }),
        }) => {}
        other => panic!("a flow match list is never rewritten into block style: {other:?}"),
    }
    assert_nothing_written(&opened, "creation into a flow list");
} // End of function a_wide_creation_into_a_flow_match_list_is_refused_and_writes_nothing()

// ---------------------------------------------------------------------------
// The application-metadata writer, composed as `update_sidecar` composes it
// ---------------------------------------------------------------------------

/// Phase 3-12: `update_sidecar` is `WorkspaceSession::sidecar_files` followed by
/// `SidecarSession::update`. Composed exactly so, a change is saved under the
/// storage root and no byte of the workspace changes; a session with no storage
/// root answers `NotWritable` and writes nothing; an unlisted document and a
/// closed workspace are refused before anything is read.
#[test]
fn the_sidecar_writer_saves_under_app_storage_and_refuses_through_the_command_composition() {
    let opened = opened_on(DENSE_UNKNOWNS);
    let storage = TempDir::new().expect("a storage root");
    let sidecar = SidecarSession::new();
    let request = SidecarUpdateRequest {
        document: opened.id,
        changes: vec![SidecarChange::SetDisplayName {
            name: "Everyday".to_owned(),
        }],
    };

    // No storage root: refused in the value channel, nothing written anywhere.
    let files = opened
        .session
        .sidecar_files()
        .expect("the workspace is open");
    let refused = sidecar
        .update(&files, &request, 1_767_225_600)
        .expect("a listed document");
    assert_eq!(refused.outcome, SidecarUpdateOutcome::NotWritable {});
    assert_eq!(
        fs::read_dir(storage.path())
            .expect("the root lists")
            .count(),
        0,
        "nothing was written under the storage root"
    );

    // An unlisted document is refused before anything is read.
    sidecar.install_storage_root(storage.path().to_path_buf());
    let unlisted = SidecarUpdateRequest {
        document: DocumentId(u64::MAX),
        ..request.clone()
    };
    match sidecar.update(&files, &unlisted, 1_767_225_600) {
        Err(CommandError::UnknownDocument { .. }) => {}
        other => panic!("expected unknownDocument, got {other:?}"),
    }
    assert_eq!(fs::read_dir(storage.path()).expect("lists").count(), 0);

    // The success: saved under the storage root, the workspace untouched.
    let saved = sidecar
        .update(&files, &request, 1_767_225_600)
        .expect("a listed document");
    assert_eq!(saved.outcome, SidecarUpdateOutcome::Saved {});
    assert!(storage.path().join("workspaces").is_dir());
    assert_eq!(disk(&opened.dir), opened.text, "no espanso byte changed");
    assert!(!opened.dir.path().join(BACKUP_DIRECTORY_NAME).exists());

    // A session with no workspace open refuses at the first call.
    let closed = WorkspaceSession::unwatched();
    match closed.sidecar_files() {
        Err(CommandError::NoWorkspaceOpen) => {}
        other => panic!("expected noWorkspaceOpen, got {other:?}"),
    }
} // End of function the_sidecar_writer_saves_under_app_storage_and_refuses_through_the_command_composition()
