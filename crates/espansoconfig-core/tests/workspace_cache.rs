//! Phase 1a acceptance: the workspace and its per-revision document cache.
//!
//! `PROGRESS.md` R19's remaining half is the reason this layer exists: the safe
//! entry point re-scans on every call by design, and *"20 ms per
//! keystroke-triggered rescan is not viable for an editor."* The fix chosen
//! here is to parse **once per [`ContentRevision`]**, and the tests below check
//! that claim the only way it can be checked — by counting the parses, through
//! `Workspace::parse_count`.
//!
//! Everything here runs against a synthetic espanso tree in a temp directory.
//! It never touches the owner's real configuration, so it passes identically on
//! a machine with no espanso installed (`CLAUDE.md` section 1).

use std::fs;
use std::path::{Path, PathBuf};

use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::model::{
    DiagnosticCode, DocumentContext, DocumentShape, IdentityError, MatchId,
};
use espansoconfig_core::workspace::{project_source, Workspace, WorkspaceError};
use espansoconfig_core::{DocumentId, ParseOutcome};
use tempfile::TempDir;

/// A match file with two snippets, a variable and an unrecognised key.
const BASE_YML: &str = concat!(
    "# A synthetic match file.\n",
    "matches:\n",
    "  - trigger: ':one'\n",
    "    replace: first\n",
    "    word: true\n",
    "  - trigger: ':two'\n",
    "    replace: second\n",
    "    invented_by_a_later_espanso: yes\n",
    "    vars:\n",
    "      - name: now\n",
    "        type: date\n",
    "        params:\n",
    "          format: '%Y-%m-%d'\n",
);

/// Builds a synthetic espanso tree in a temp directory.
fn synthetic_tree() -> TempDir {
    let dir = TempDir::new().expect("temp dir");
    let root = dir.path();
    fs::create_dir_all(root.join("config")).unwrap();
    fs::create_dir_all(root.join("match").join("packages").join("demo")).unwrap();

    fs::write(
        root.join("config").join("default.yml"),
        "backend: auto\ntoggle_key: ALT\n",
    )
    .unwrap();
    fs::write(root.join("match").join("base.yml"), BASE_YML).unwrap();
    fs::write(
        root.join("match").join("_scoped.yml"),
        "matches:\n  - trigger: ':scoped'\n    replace: only on request\n",
    )
    .unwrap();
    fs::write(
        root.join("match")
            .join("packages")
            .join("demo")
            .join("package.yml"),
        "matches:\n  - trigger: ':pkg'\n    replace: from the hub\n",
    )
    .unwrap();
    // A file the substrate rejects, so the browser has something to be honest
    // about.
    fs::write(
        root.join("match").join("broken.yml"),
        "matches:\n  - trigger: ':unclosed\n",
    )
    .unwrap();
    dir
} // End of function synthetic_tree()

/// The identity of the document at `<root>/<relative>`.
fn id_of(workspace: &Workspace, root: &Path, relative: &str) -> DocumentId {
    let mut path = root.to_path_buf();
    for part in relative.split('/') {
        path.push(part);
    }
    workspace
        .document_id(&path)
        .unwrap_or_else(|| panic!("no document at {relative}"))
}

#[test]
fn opening_a_workspace_enumerates_everything_and_parses_nothing() {
    let dir = synthetic_tree();
    let workspace = Workspace::open(dir.path()).expect("the tree opens");

    let summary = workspace.summary();
    assert_eq!(summary.documents, 5);
    assert_eq!(summary.match_files, 3);
    assert_eq!(summary.config_profiles, 1);
    assert_eq!(summary.packages, 1);
    assert_eq!(summary.disabled, 1);

    // The sidebar can render before a single file is opened, which is the whole
    // point of splitting `list_documents` from `get_document`.
    assert_eq!(
        workspace.parse_count(),
        0,
        "opening a workspace must not parse anything"
    );
    let listed = workspace.list_documents();
    assert_eq!(listed.len(), 5);
    assert!(
        listed.iter().all(|summary| !summary.loaded),
        "nothing is loaded yet"
    );
    assert_eq!(workspace.parse_count(), 0, "listing must not parse either");

    // Classification comes straight from `discovery`, which already knows the
    // espanso layout rules.
    let package = listed
        .iter()
        .find(|summary| summary.kind == FileKind::Package)
        .expect("the tree holds a package");
    assert!(package.read_only, "a Hub package is read-only");
    let scoped = listed
        .iter()
        .find(|summary| summary.disabled)
        .expect("the tree holds an underscore-prefixed file");
    assert!(
        scoped.relative_path.to_string_lossy().contains("_scoped"),
        "the disabled file is the underscore-prefixed one"
    );
} // End of function opening_a_workspace_enumerates_everything_and_parses_nothing()

#[test]
fn a_second_view_of_one_revision_is_served_without_reparsing() {
    let dir = synthetic_tree();
    let mut workspace = Workspace::open(dir.path()).expect("the tree opens");
    let id = id_of(&workspace, dir.path(), "match/base.yml");

    let first = workspace.document_view(id).expect("the document loads");
    assert_eq!(first.matches.len(), 2);
    let revision = first.revision;
    assert_eq!(workspace.parse_count(), 1, "the first call parses once");

    // Ten more calls, three of them through the other two accessors, because a
    // cache that only `document_view` consults would leave the raw pane paying
    // the cost this test exists to remove.
    for _ in 0..8 {
        let again = workspace.document_view(id).expect("the document is cached");
        assert_eq!(again.revision, revision);
    }
    assert!(!workspace.document_text(id).unwrap().is_empty());
    assert!(workspace.get_document(id).unwrap().parse.is_parsed());
    assert_eq!(
        workspace.parse_count(),
        1,
        "a second view of the same revision must not reparse"
    );

    // …and the summary now says the document is loaded, which is what lets a UI
    // tell a cold pane from a warm one.
    let listed = workspace.list_documents();
    assert_eq!(
        listed.iter().filter(|summary| summary.loaded).count(),
        1,
        "exactly the document that was fetched is loaded"
    );
} // End of function a_second_view_of_one_revision_is_served_without_reparsing()

#[test]
fn refreshing_an_unchanged_file_rehashes_it_and_keeps_the_parse() {
    let dir = synthetic_tree();
    let mut workspace = Workspace::open(dir.path()).expect("the tree opens");
    let id = id_of(&workspace, dir.path(), "match/base.yml");

    let before = workspace
        .get_document(id)
        .expect("the document loads")
        .revision;
    assert_eq!(workspace.parse_count(), 1);

    // The watcher case (plan section 6.5: notifications are hints, not truth).
    // Rewrite the file with identical bytes — mtime changes, content does not —
    // and the cache must survive it.
    fs::write(dir.path().join("match").join("base.yml"), BASE_YML).unwrap();
    let refreshed = workspace.refresh(id).expect("the document refreshes");
    assert_eq!(refreshed.revision, before, "the bytes did not change");
    assert_eq!(
        workspace.parse_count(),
        1,
        "an unchanged revision must not be reparsed"
    );

    // A real change must be picked up, and must be a different revision.
    fs::write(
        dir.path().join("match").join("base.yml"),
        format!("{BASE_YML}  - trigger: ':three'\n    replace: third\n"),
    )
    .unwrap();
    let changed = workspace.refresh(id).expect("the document refreshes");
    assert_ne!(changed.revision, before, "the bytes changed");
    assert_eq!(changed.view.matches.len(), 3);
    assert_eq!(
        workspace.parse_count(),
        2,
        "a changed revision must be reparsed exactly once"
    );
} // End of function refreshing_an_unchanged_file_rehashes_it_and_keeps_the_parse()

#[test]
fn evicting_a_document_drops_its_parse_and_keeps_its_place() {
    let dir = synthetic_tree();
    let mut workspace = Workspace::open(dir.path()).expect("the tree opens");
    let id = id_of(&workspace, dir.path(), "match/base.yml");

    workspace.get_document(id).unwrap();
    assert_eq!(workspace.parse_count(), 1);
    workspace.evict(id).expect("the document is evicted");
    assert_eq!(workspace.list_documents().len(), 5, "the row survives");
    workspace.get_document(id).unwrap();
    assert_eq!(workspace.parse_count(), 2, "an evicted document reparses");
} // End of function evicting_a_document_drops_its_parse_and_keeps_its_place()

#[test]
fn loading_every_document_parses_each_exactly_once() {
    let dir = synthetic_tree();
    let mut workspace = Workspace::open(dir.path()).expect("the tree opens");

    let failures = workspace.load_all();
    assert!(failures.is_empty(), "every file is readable");
    assert_eq!(
        workspace.parse_count(),
        5,
        "five documents, five parses, no more"
    );
    assert_eq!(workspace.loaded_documents().count(), 5);

    // A second sweep costs nothing, which is what makes an "All snippets"
    // surface viable.
    assert!(workspace.load_all().is_empty());
    assert_eq!(
        workspace.parse_count(),
        5,
        "a second sweep must not reparse"
    );

    // The unreadable file is the one that did not parse, and it is still listed
    // and still holds its bytes.
    let broken = id_of(&workspace, dir.path(), "match/broken.yml");
    let document = workspace.get_document(broken).unwrap();
    assert!(matches!(document.parse, ParseOutcome::Failed(_)));
    assert!(!document.source.is_empty(), "the raw text survives");
    assert!(!document.view.parsed);
    assert!(document.view.diagnostics.iter().any(|diagnostic| matches!(
        diagnostic.code,
        DiagnosticCode::ParseFailed { .. } | DiagnosticCode::IndexRejected
    )));
} // End of function loading_every_document_parses_each_exactly_once()

#[test]
fn a_config_profile_and_a_match_file_project_to_their_own_shapes() {
    let dir = synthetic_tree();
    let mut workspace = Workspace::open(dir.path()).expect("the tree opens");

    let profile = id_of(&workspace, dir.path(), "config/default.yml");
    let view = workspace.document_view(profile).unwrap();
    assert_eq!(view.kind, FileKind::ConfigProfile);
    assert_eq!(view.shape, DocumentShape::ConfigProfile);
    assert!(view.profile.is_some());
    // Location and shape agree here, unlike in the corpus fixture, so nothing is
    // reported.
    assert!(!view.diagnostics.iter().any(|diagnostic| matches!(
        diagnostic.code,
        DiagnosticCode::ShapeDisagreesWithLocation { .. }
    )));

    let base = id_of(&workspace, dir.path(), "match/base.yml");
    let view = workspace.document_view(base).unwrap();
    assert_eq!(view.kind, FileKind::MatchFile);
    assert_eq!(view.shape, DocumentShape::MatchFile);
    assert!(view.profile.is_none());
    assert_eq!(view.matches.len(), 2);

    // The unrecognised key of the second match is recorded, not dropped — and
    // its **value** stays source text, `yes` and not `true` (D2u).
    let second = &view.matches[1];
    let unknown = second
        .unknown_entries
        .iter()
        .find(|entry| entry.key.as_deref() == Some("invented_by_a_later_espanso"))
        .expect("the unrecognised key is recorded");
    assert!(unknown.path.is_some(), "and it can be addressed");
    let word = view.matches[0]
        .options
        .word
        .as_ref()
        .expect("the first match sets `word`");
    assert_eq!(word.text, "true");
} // End of function a_config_profile_and_a_match_file_project_to_their_own_shapes()

#[test]
fn an_unknown_identity_and_an_unreadable_file_are_typed_errors_not_panics() {
    let dir = synthetic_tree();
    let mut workspace = Workspace::open(dir.path()).expect("the tree opens");

    let error = workspace.get_document(DocumentId(9_999)).unwrap_err();
    assert!(matches!(error, WorkspaceError::UnknownDocument { .. }));

    // A file that is not UTF-8 cannot be a document this crate understands, and
    // is reported rather than lossily decoded: replacement characters in a save
    // path that promises byte preservation would be a corruption, not a
    // fallback.
    let path = dir.path().join("match").join("latin1.yml");
    fs::write(&path, [b'a', b':', b' ', 0xff, b'\n']).unwrap();
    let mut workspace = Workspace::open(dir.path()).expect("the tree reopens");
    let id = workspace.document_id(&path).expect("the file is listed");
    match workspace.get_document(id) {
        Err(WorkspaceError::NotUtf8 { offset, .. }) => assert_eq!(offset, 3),
        other => panic!("expected a NotUtf8 error, got {other:?}"),
    }

    // …and one unreadable file must not hide the rest of the configuration.
    let failures = workspace.load_all();
    assert_eq!(failures.len(), 1, "exactly the bad file failed");
    assert_eq!(workspace.loaded_documents().count(), 5);
} // End of function an_unknown_identity_and_an_unreadable_file_are_typed_errors_not_panics()

#[test]
fn identities_are_stable_across_two_opens_of_an_unchanged_directory() {
    // What lets a UI remember which file was selected across a reload.
    let dir = synthetic_tree();
    let first = Workspace::open(dir.path()).expect("the tree opens");
    let second = Workspace::open(dir.path()).expect("the tree reopens");
    let ids = |workspace: &Workspace| {
        workspace
            .list_documents()
            .into_iter()
            .map(|summary| (summary.id, summary.relative_path))
            .collect::<Vec<_>>()
    };
    assert_eq!(ids(&first), ids(&second));
} // End of function identities_are_stable_across_two_opens_of_an_unchanged_directory()

#[test]
fn projecting_bytes_directly_agrees_with_projecting_them_from_disk() {
    // The seam the corpus tests use must not be a second implementation: given
    // the same bytes and the same context it has to produce the same snapshot
    // the disk path does.
    //
    // That seam is `project_source`, which builds a **standalone** snapshot.
    // The workspace deliberately has no method that installs caller-supplied
    // bytes into a cache slot: plan section 6.4 gives Rust the disk snapshot and
    // the frontend the unsaved draft, and the removed `load_from_source` broke
    // that by making `get_document` return a draft while the disk held
    // something else.
    let dir = synthetic_tree();
    let mut from_disk = Workspace::open(dir.path()).expect("the tree opens");
    let id = id_of(&from_disk, dir.path(), "match/base.yml");
    let disk = from_disk.get_document(id).unwrap().clone();

    let context = DocumentContext {
        id,
        path: disk.path.clone(),
        relative_path: PathBuf::from("match").join("base.yml"),
        kind: FileKind::MatchFile,
        disabled: false,
    };
    let memory = project_source(&context, BASE_YML);
    assert_eq!(memory.revision, disk.revision);
    assert_eq!(memory.view, disk.view);

    // …and the cache still holds what the disk holds, because nothing here
    // could have replaced it.
    assert_eq!(from_disk.document_text(id).unwrap(), BASE_YML);
} // End of function projecting_bytes_directly_agrees_with_projecting_them_from_disk()

#[test]
fn an_identity_survives_a_directory_that_gained_and_lost_a_file() {
    // The Phase 1a review's finding 1, second half. Identities used to be the
    // enumeration position of a sorted walk, so retaining one, adding an
    // alphabetically **earlier** file and reopening silently re-pointed it at a
    // different file — the existing two-open test used an unchanged directory
    // and could not see it.
    let dir = synthetic_tree();
    let root = dir.path();
    let before = Workspace::open(root).expect("the tree opens");
    let base = id_of(&before, root, "match/base.yml");
    let scoped = id_of(&before, root, "match/_scoped.yml");

    // `aaa.yml` sorts before both, and before the `config/` profile too.
    fs::write(
        root.join("match").join("aaa.yml"),
        "matches:\n  - trigger: ':aaa'\n    replace: earliest\n",
    )
    .unwrap();
    let mut after = Workspace::open(root).expect("the tree reopens");
    assert_eq!(after.list_documents().len(), 6);

    // The retained identity still names its own file — the assertion the old
    // test could not make.
    assert_eq!(
        after.document_id(&root.join("match").join("base.yml")),
        Some(base),
        "an identity must not follow a position"
    );
    assert!(after.document_text(base).unwrap().contains(":one"));
    assert_eq!(
        after.document_id(&root.join("match").join("_scoped.yml")),
        Some(scoped)
    );

    // …and the new file got an identity nobody held.
    let fresh = id_of(&after, root, "match/aaa.yml");
    assert_ne!(fresh, base);
    assert_ne!(fresh, scoped);

    // Removing a file makes its identity a typed error rather than an alias for
    // whatever moved into its place.
    fs::remove_file(root.join("match").join("base.yml")).unwrap();
    let mut reduced = Workspace::open(root).expect("the tree reopens again");
    assert!(matches!(
        reduced.get_document(base),
        Err(WorkspaceError::UnknownDocument { .. })
    ));
    assert_eq!(
        reduced.document_id(&root.join("match").join("base.yml")),
        None
    );
} // End of function an_identity_survives_a_directory_that_gained_and_lost_a_file()

#[test]
fn get_match_resolves_a_live_identity_and_refuses_a_stale_one() {
    // Plan section 6.4 lists `get_match` beside `get_document`; Phase 1b wraps
    // this one to one rather than composing it out of two calls.
    let dir = synthetic_tree();
    let mut workspace = Workspace::open(dir.path()).expect("the tree opens");
    let id = id_of(&workspace, dir.path(), "match/base.yml");

    let live = workspace.document_view(id).unwrap().matches[1].id;
    let found = workspace.get_match(live).expect("a live identity resolves");
    assert_eq!(found.id, live);
    assert_eq!(
        found.trigger.primary().map(|scalar| scalar.text.as_str()),
        Some(":two")
    );

    // Change the file so the node identifiers are minted afresh, and require the
    // retained identity to be **refused** rather than resolved to whichever
    // match now sits at that arena index.
    fs::write(
        dir.path().join("match").join("base.yml"),
        "matches:\n  - trigger: ':two'\n    replace: second\n  - trigger: ':one'\n    replace: first\n",
    )
    .unwrap();
    workspace.refresh(id).expect("the document refreshes");
    match workspace.get_match(live) {
        Err(WorkspaceError::Identity(IdentityError::StaleRevision { .. })) => {}
        other => panic!("a stale identity must be refused, got {other:?}"),
    }

    // An identity naming a document this session does not hold is the other
    // typed refusal, and it is reported before anything is parsed.
    let mut elsewhere = live;
    elsewhere.document = DocumentId(9_999);
    assert!(matches!(
        workspace.get_match(elsewhere),
        Err(WorkspaceError::UnknownDocument { .. })
    ));
} // End of function get_match_resolves_a_live_identity_and_refuses_a_stale_one()

#[test]
fn every_workspace_error_reaches_json_as_a_code_and_operands() {
    // Plan section 6.4 puts a `Result<_, AppError>` on every command, so this
    // type has to cross the IPC boundary — and plan section 9 says it may carry
    // codes and structured data, never a rendered message.
    let dir = synthetic_tree();
    let mut workspace = Workspace::open(dir.path()).expect("the tree opens");

    let unknown = workspace.get_document(DocumentId(9_999)).unwrap_err();
    let json = serde_json::to_value(&unknown).expect("the error serializes");
    assert_eq!(json["code"], serde_json::json!("unknownDocument"));
    assert_eq!(json["id"], serde_json::json!(9_999));

    let path = dir.path().join("match").join("latin1.yml");
    fs::write(&path, [b'a', b':', b' ', 0xff, b'\n']).unwrap();
    let mut workspace = Workspace::open(dir.path()).expect("the tree reopens");
    let id = workspace.document_id(&path).expect("the file is listed");
    let not_utf8 = workspace.get_document(id).unwrap_err();
    let json = serde_json::to_value(&not_utf8).expect("the error serializes");
    assert_eq!(json["code"], serde_json::json!("notUtf8"));
    assert_eq!(json["offset"], serde_json::json!(3));

    // An identity that reached the boundary must be able to come back: a
    // `MatchId` is a command **argument** as well as a result, and its revision
    // is the opaque hex token the frontend echoes.
    let base = id_of(&workspace, dir.path(), "match/base.yml");
    let live = workspace.document_view(base).unwrap().matches[0].id;
    let wire = serde_json::to_value(live).expect("an identity serializes");
    assert!(wire["revision"].is_string());
    assert_eq!(wire["revision"].as_str().map(str::len), Some(64));
    let returned: MatchId = serde_json::from_value(wire).expect("and deserializes");
    assert_eq!(returned, live);
    assert!(workspace.get_match(returned).is_ok());
} // End of function every_workspace_error_reaches_json_as_a_code_and_operands()
