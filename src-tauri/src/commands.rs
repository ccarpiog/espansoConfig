//! The IPC surface — thin wrappers over [`espansoconfig_core::workspace`].
//!
//! Plan section 6.4's **read-only** set, and nothing else: `open_workspace`,
//! `list_documents`, `get_document`, `get_match` and `reload_document`. Each is
//! one line over a [`WorkspaceSession`] method, and each of those is one call
//! into `crate::workspace`, which Phase 1a built to be wrapped this way.
//!
//! # Three constraints this module inherits and does not drop
//!
//! - **No mutating command exists.** Saving is Phase 2 and the save transaction
//!   it needs is not written. `save_match`, `create_match`, `delete_match`,
//!   `move_match`, `save_raw_document` and `validate_match` are deliberately
//!   absent; a command that writes a file must not appear here before that
//!   transaction does.
//! - **`Workspace` takes `&mut self`** where it fills its cache, so the state
//!   registered with Tauri holds it behind a [`Mutex`].
//! - **Rust returns codes, never prose** (plan section 9). Every failure
//!   crossing this boundary is a [`CommandError`]; see `crate::error`. That
//!   claim covers the *serialization* of a response as well as its construction:
//!   every path on the wire is an [`espansoconfig_core::wire::WirePath`], whose
//!   rendering cannot fail, because a response that fails to serialize reaches
//!   the webview as `serde`'s own English prose and there is no second error to
//!   send instead.
//!
//! # Why every command is synchronous
//!
//! Tauri runs a command written without `async` on the main thread, and an
//! `async` one on its own runtime. An `async` command here would have to hold
//! the session's [`std::sync::MutexGuard`] across an `.await`, which is exactly
//! the shape a `std::sync` guard must not take — and swapping in an async-aware
//! mutex would buy a problem this phase does not have. The cost is that a
//! command blocks the main thread for as long as it runs, which for a read-only
//! browser is one parse of one file, and only on the first look at it. When
//! Phase 2 edits on a debounce, that trade is worth re-examining rather than
//! inheriting.
//!
//! # Why a poisoned lock is absorbed rather than reported
//!
//! [`PoisonError::into_inner`], as `crate::workspace` does for its own identity
//! table. A poisoned mutex means some command panicked while holding it; what
//! sits behind it is a **cache over the disk**, every mutation of it is a single
//! infallible assignment, and the recovery for anything genuinely wrong is
//! `reload_document`, which re-reads the file. Refusing every later command
//! because an earlier one panicked would turn one failed read into a dead
//! window. There is deliberately no `statePoisoned` code.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::State;

use espansoconfig_core::model::{DocumentView, MatchId, MatchView};
use espansoconfig_core::workspace::{DocumentSummary, Workspace, WorkspaceSummary};
use espansoconfig_core::DocumentId;

use crate::error::CommandError;

/// The one piece of state this application manages.
///
/// Holds at most one open [`Workspace`]. `None` before the first successful
/// `open_workspace`, and every other command answers
/// [`CommandError::NoWorkspaceOpen`] until then — rather than opening one
/// implicitly, which would make "which directory am I looking at?" a question
/// with an answer nobody asked for.
#[derive(Debug, Default)]
pub struct WorkspaceSession {
    workspace: Mutex<Option<Workspace>>,
}

impl WorkspaceSession {
    /// An empty session, with no workspace open.
    pub fn new() -> WorkspaceSession {
        WorkspaceSession {
            workspace: Mutex::new(None),
        }
    }

    /// Locates a configuration directory and opens it.
    ///
    /// Parses nothing: [`Workspace::discover`] enumerates and stops.
    ///
    /// # Errors
    ///
    /// [`CommandError::NotADirectory`] for an explicit path that is not one,
    /// [`CommandError::ConfigDirNotFound`] when no candidate existed, and
    /// [`CommandError::Io`] when a directory could not be read. **A failure
    /// leaves the previously open workspace in place**, so a mistyped path does
    /// not empty the window.
    pub fn open(&self, root: Option<&Path>) -> Result<WorkspaceSummary, CommandError> {
        let workspace = Workspace::discover(root)?;
        let summary = workspace.summary();
        let mut guard = self.lock();
        *guard = Some(workspace);
        Ok(summary)
    } // End of function open()

    /// Every file of the open workspace, parsed or not.
    pub fn documents(&self) -> Result<Vec<DocumentSummary>, CommandError> {
        self.with_workspace(|workspace| Ok(workspace.list_documents()))
    }

    /// The projection of one document, parsing it on first use.
    ///
    /// The view is cloned out of the cache because it has to be serialized
    /// after the lock is released; the cache keeps its own copy, so the next
    /// call still costs no parse.
    pub fn document(&self, id: DocumentId) -> Result<DocumentView, CommandError> {
        self.with_workspace(|workspace| Ok(workspace.document_view(id)?.clone()))
    }

    /// One match of one document, resolved against the current parse.
    ///
    /// # Errors
    ///
    /// The three identity codes, and they are not interchangeable:
    /// [`CommandError::IdentityStaleRevision`] means the document's bytes
    /// changed under the identity, so it must be resolved again — and the
    /// answer may be that the match is gone, or that the position it named now
    /// holds a different match; [`CommandError::IdentityNoSuchMatch`] means this
    /// projection holds no such node at all, so there is nothing to resolve.
    /// Collapsing them into one "not found" is what `PROGRESS.md` R27 forbids,
    /// and reading the first as "it is still there" is what the review of Phase
    /// 1b-2a found this layer's documentation doing.
    pub fn match_view(&self, id: MatchId) -> Result<MatchView, CommandError> {
        self.with_workspace(|workspace| Ok(workspace.get_match(id)?.clone()))
    }

    /// Re-reads one document from disk, reparsing only if its bytes changed.
    pub fn reload(&self, id: DocumentId) -> Result<DocumentView, CommandError> {
        self.with_workspace(|workspace| Ok(workspace.refresh(id)?.view.clone()))
    }

    /// Runs `action` against the open workspace, or refuses because there is
    /// none.
    fn with_workspace<T>(
        &self,
        action: impl FnOnce(&mut Workspace) -> Result<T, CommandError>,
    ) -> Result<T, CommandError> {
        let mut guard = self.lock();
        match guard.as_mut() {
            None => Err(CommandError::NoWorkspaceOpen),
            Some(workspace) => action(workspace),
        }
    } // End of function with_workspace()

    /// Locks the session, absorbing poisoning. See the module documentation.
    fn lock(&self) -> MutexGuard<'_, Option<Workspace>> {
        self.workspace
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }
} // End of impl WorkspaceSession

/// Opens an espanso configuration directory (plan section 6.4).
///
/// `root` is a directory the user chose, or `null` to probe the standard
/// locations in order.
#[tauri::command]
pub fn open_workspace(
    session: State<'_, WorkspaceSession>,
    root: Option<PathBuf>,
) -> Result<WorkspaceSummary, CommandError> {
    session.open(root.as_deref())
}

/// Lists every file of the open workspace (plan section 6.4).
#[tauri::command]
pub fn list_documents(
    session: State<'_, WorkspaceSession>,
) -> Result<Vec<DocumentSummary>, CommandError> {
    session.documents()
}

/// Returns the projection of one document (plan section 6.4).
#[tauri::command]
pub fn get_document(
    session: State<'_, WorkspaceSession>,
    id: DocumentId,
) -> Result<DocumentView, CommandError> {
    session.document(id)
}

/// Returns one match of one document (plan section 6.4).
#[tauri::command]
pub fn get_match(
    session: State<'_, WorkspaceSession>,
    id: MatchId,
) -> Result<MatchView, CommandError> {
    session.match_view(id)
}

/// Re-reads one document from disk (plan section 6.4).
#[tauri::command]
pub fn reload_document(
    session: State<'_, WorkspaceSession>,
    id: DocumentId,
) -> Result<DocumentView, CommandError> {
    session.reload(id)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use espansoconfig_core::model::MatchId;
    use espansoconfig_core::{ContentRevision, DocumentId, NodeId, SyntaxIndex};
    use tempfile::TempDir;

    use super::WorkspaceSession;
    use crate::error::CommandError;

    /// A match file with two snippets and one unrecognised key.
    ///
    /// Hand-authored and neutral: no test in this repository may read the
    /// owner's real configuration (CLAUDE.md section 1).
    const BASE_YML: &str = concat!(
        "# A synthetic match file.\n",
        "matches:\n",
        "  - trigger: ':one'\n",
        "    replace: first\n",
        "  - trigger: ':two'\n",
        "    replace: second\n",
        "    invented_by_a_later_espanso: yes\n",
    );

    /// Builds a synthetic espanso tree in a temp directory.
    fn synthetic_tree() -> TempDir {
        let dir = TempDir::new().expect("temp dir");
        let root = dir.path();
        fs::create_dir_all(root.join("config")).unwrap();
        fs::create_dir_all(root.join("match")).unwrap();
        fs::write(
            root.join("config").join("default.yml"),
            "backend: auto\ntoggle_key: ALT\n",
        )
        .unwrap();
        fs::write(root.join("match").join("base.yml"), BASE_YML).unwrap();
        // A file the substrate rejects, so the boundary has something to be
        // honest about: it must cross as a view, never as an error.
        fs::write(
            root.join("match").join("broken.yml"),
            "matches:\n  - trigger: ':unclosed\n",
        )
        .unwrap();
        dir
    } // End of function synthetic_tree()

    /// A session with the synthetic tree open.
    fn open_session(dir: &TempDir) -> WorkspaceSession {
        let session = WorkspaceSession::new();
        session
            .open(Some(dir.path()))
            .expect("the synthetic tree is a directory");
        session
    }

    /// The identity of `<root>/<relative>` in an open session.
    fn id_of(session: &WorkspaceSession, relative: &str) -> DocumentId {
        let documents = session.documents().expect("the workspace is open");
        documents
            .iter()
            .find(|summary| summary.relative_path == Path::new(relative))
            .unwrap_or_else(|| panic!("no document at {relative}"))
            .id
    }

    /// A match's `trigger` text, or an empty string.
    fn trigger_text(view: &espansoconfig_core::model::MatchView) -> &str {
        view.trigger
            .primary()
            .map(|scalar| scalar.text.as_str())
            .unwrap_or_default()
    }

    /// The first node of a parsed source, for building an identity by hand.
    fn first_node_of(source: &str) -> NodeId {
        let index = SyntaxIndex::parse(source).expect("a trivial parse");
        index.nodes()[0].id
    }

    #[test]
    fn open_workspace_summarises_a_directory_without_parsing_it() {
        let dir = synthetic_tree();
        let session = WorkspaceSession::new();
        let summary = session.open(Some(dir.path())).expect("a directory");
        assert_eq!(summary.documents, 3);
        assert_eq!(summary.config_profiles, 1);
        assert_eq!(summary.match_files, 2);
        let documents = session.documents().expect("the workspace is open");
        assert!(
            documents.iter().all(|summary| !summary.loaded),
            "opening a workspace must parse nothing"
        );
    } // End of function open_workspace_summarises_a_directory_without_parsing_it()

    #[test]
    fn a_path_that_is_not_a_directory_is_a_typed_refusal() {
        let dir = synthetic_tree();
        let session = WorkspaceSession::new();
        let file = dir.path().join("match").join("base.yml");
        let error = session.open(Some(&file)).expect_err("a file is not a tree");
        assert_eq!(error.code(), "notADirectory");
    }

    #[test]
    fn every_command_refuses_before_a_workspace_is_open() {
        let session = WorkspaceSession::new();
        let id = DocumentId(0);
        assert_eq!(
            session.documents().expect_err("nothing is open"),
            CommandError::NoWorkspaceOpen
        );
        assert_eq!(
            session.document(id).expect_err("nothing is open"),
            CommandError::NoWorkspaceOpen
        );
        assert_eq!(
            session.reload(id).expect_err("nothing is open"),
            CommandError::NoWorkspaceOpen
        );
        let identity = MatchId {
            document: id,
            revision: ContentRevision::of_bytes(b""),
            node: first_node_of("a: b"),
        };
        assert_eq!(
            session.match_view(identity).expect_err("nothing is open"),
            CommandError::NoWorkspaceOpen
        );
    } // End of function every_command_refuses_before_a_workspace_is_open()

    #[test]
    fn get_document_projects_on_first_use_and_the_list_then_says_so() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let view = session.document(id).expect("the file reads");
        assert!(view.parsed);
        assert_eq!(view.matches.len(), 2);
        assert_eq!(view.revision.to_hex().len(), 64);
        let documents = session.documents().expect("the workspace is open");
        let row = documents
            .iter()
            .find(|summary| summary.id == id)
            .expect("the document is listed");
        assert!(row.loaded, "a projected document must be listed as loaded");
    } // End of function get_document_projects_on_first_use_and_the_list_then_says_so()

    #[test]
    fn a_document_that_does_not_parse_crosses_as_a_view_not_as_an_error() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/broken.yml");
        let view = session
            .document(id)
            .expect("the file reads even though it does not parse");
        assert!(!view.parsed);
        assert!(view.matches.is_empty());
        assert!(
            !view.diagnostics.is_empty(),
            "an unparsed document must say why"
        );
    } // End of function a_document_that_does_not_parse_crosses_as_a_view_not_as_an_error()

    #[test]
    fn an_unknown_document_identity_is_a_typed_code() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let error = session
            .document(DocumentId(u64::MAX))
            .expect_err("no such document");
        assert_eq!(error.code(), "unknownDocument");
    }

    #[test]
    fn get_match_resolves_an_identity_from_the_current_parse() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let view = session.document(id).expect("the file reads");
        let identity = view.matches[1].id;
        let found = session
            .match_view(identity)
            .expect("the identity is from this parse");
        assert_eq!(found.id, identity);
        assert_eq!(
            found
                .trigger
                .primary()
                .map(|scalar| scalar.text.as_str())
                .unwrap_or_default(),
            ":two"
        );
    } // End of function get_match_resolves_an_identity_from_the_current_parse()

    /// The R27 path, end to end across the boundary.
    ///
    /// A held identity crossing a reload must come back as a **stale revision**
    /// — a re-fetch instruction — and never as a lookup miss, and never as a
    /// resolved match. The file is rewritten so that the two matches swap
    /// places, which is the case where resolving a stale identity would return
    /// *the other match*: the assertion is therefore about which code arrives,
    /// not merely that something failed.
    #[test]
    fn an_identity_held_across_a_reload_crosses_as_a_stale_revision() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let held = session.document(id).expect("the file reads").matches[0].id;

        fs::write(
            dir.path().join("match").join("base.yml"),
            concat!(
                "# A synthetic match file.\n",
                "matches:\n",
                "  - trigger: ':two'\n",
                "    replace: second\n",
                "  - trigger: ':one'\n",
                "    replace: first\n",
            ),
        )
        .unwrap();
        let reloaded = session.reload(id).expect("the file still reads");
        assert_ne!(
            reloaded.revision, held.revision,
            "the reload must have produced a new revision, or this test proves nothing"
        );

        let error = session
            .match_view(held)
            .expect_err("an identity from the previous parse must not resolve");
        assert_eq!(
            error.code(),
            "identityStaleRevision",
            "a stale identity must be its own code, not a lookup miss: {error:?}"
        );
        let json = serde_json::to_value(&error).expect("the error serializes");
        assert_eq!(json["code"], "identityStaleRevision");
        assert_eq!(json["found"], held.revision.to_hex());
        assert_eq!(json["expected"], reloaded.revision.to_hex());
    } // End of function an_identity_held_across_a_reload_crosses_as_a_stale_revision()

    /// An identity whose revision is current but whose node is no match.
    ///
    /// Distinguishes the two identity refusals: this one must be
    /// `identityNoSuchMatch`, and the test above must be
    /// `identityStaleRevision`. One code for both would satisfy neither.
    #[test]
    fn a_current_revision_with_a_node_that_is_no_match_is_no_such_match() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let view = session.document(id).expect("the file reads");
        // The trigger's scalar node, which is emphatically not the match's own
        // mapping node.
        let not_a_match = view.matches[0]
            .trigger
            .trigger
            .as_ref()
            .expect("the first match has a trigger")
            .node;
        let identity = MatchId {
            document: id,
            revision: view.revision,
            node: not_a_match,
        };
        let error = session
            .match_view(identity)
            .expect_err("a scalar node is not a match");
        assert_eq!(error.code(), "identityNoSuchMatch");
    } // End of function a_current_revision_with_a_node_that_is_no_match_is_no_such_match()

    /// `get_match` routes by the identity's own document, so
    /// `identityWrongDocument` is unreachable through this command.
    ///
    /// This test was written expecting `identityWrongDocument` and was wrong:
    /// `Workspace::get_match` projects the document the *identity* names and
    /// then resolves against that projection, so the document can never
    /// disagree by the time `match_by_id` looks. What is reachable is the
    /// refusal on the next line of `match_by_id` — the revision — and that is
    /// what this pins. `IdentityError::WrongDocument` remains a real core
    /// refusal for a caller that holds a `DocumentView` directly, and
    /// `CommandError::IdentityWrongDocument` remains its mapping; it is
    /// unreachable through the five commands of Phase 1b-2a, and that is
    /// recorded as a hole rather than papered over by deleting the code.
    #[test]
    fn get_match_routes_by_the_identitys_own_document() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let base = id_of(&session, "match/base.yml");
        let profile = id_of(&session, "config/default.yml");
        let view = session.document(base).expect("the file reads");
        let borrowed = MatchId {
            document: profile,
            ..view.matches[0].id
        };
        let error = session
            .match_view(borrowed)
            .expect_err("the profile holds no match at that node");
        assert_eq!(
            error.code(),
            "identityStaleRevision",
            "the identity was resolved against the profile it names, whose bytes differ"
        );
    } // End of function get_match_routes_by_the_identitys_own_document()

    #[test]
    fn reload_document_reprojects_only_when_the_bytes_changed() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads").revision;
        let unchanged = session.reload(id).expect("the file still reads").revision;
        assert_eq!(before, unchanged, "an unchanged file keeps its revision");

        fs::write(
            dir.path().join("match").join("base.yml"),
            "matches:\n  - trigger: ':three'\n    replace: third\n",
        )
        .unwrap();
        let after = session.reload(id).expect("the file still reads");
        assert_ne!(before, after.revision);
        assert_eq!(after.matches.len(), 1);
    } // End of function reload_document_reprojects_only_when_the_bytes_changed()

    /// A read failure is a typed code, not a panic.
    #[test]
    fn a_file_that_disappeared_is_an_io_code() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        fs::remove_file(dir.path().join("match").join("base.yml")).unwrap();
        let error = session.document(id).expect_err("the file is gone");
        assert_eq!(error.code(), "io");
        let json = serde_json::to_value(&error).expect("the error serializes");
        assert_eq!(json["kind"], "NotFound");
    } // End of function a_file_that_disappeared_is_an_io_code()

    /// A `DocumentPath` is a position, so a deletion re-points it.
    ///
    /// The counterexample the review of Phase 1b-2a was built on. The frontend
    /// documented `identityStaleRevision` as "the identity is stale but the
    /// thing still exists — re-resolve it by its `DocumentPath` and keep the
    /// selection", and `types.ts` called `DocumentPath` "the identity designed
    /// to survive a reparse". Both were false: a sequence step is
    /// `PathSegment::Index(usize)`, a **position**, so deleting an earlier match
    /// leaves the path resolving perfectly well — to a different match.
    ///
    /// This test would fail if that claim were ever reinstated, because it
    /// asserts the opposite: the path is byte-for-byte the one that was held,
    /// and what sits at it is not what was selected.
    #[test]
    fn a_document_path_is_positional_so_a_deletion_repoints_it() {
        let dir = TempDir::new().expect("temp dir");
        fs::create_dir_all(dir.path().join("match")).unwrap();
        fs::write(
            dir.path().join("match").join("base.yml"),
            concat!(
                "matches:\n",
                "  - trigger: ':one'\n",
                "    replace: first\n",
                "  - trigger: ':two'\n",
                "    replace: second\n",
                "  - trigger: ':three'\n",
                "    replace: third\n",
            ),
        )
        .unwrap();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");

        let before = session.document(id).expect("the file reads");
        let held_path = before.matches[1].path.clone().expect("a match has a path");
        let held_trigger = trigger_text(&before.matches[1]);
        assert_eq!(held_trigger, ":two");

        // An external edit deletes the first match. Everything after it shifts.
        fs::write(
            dir.path().join("match").join("base.yml"),
            concat!(
                "matches:\n",
                "  - trigger: ':two'\n",
                "    replace: second\n",
                "  - trigger: ':three'\n",
                "    replace: third\n",
            ),
        )
        .unwrap();
        let after = session.reload(id).expect("the file still reads");

        let at_the_same_path = after
            .matches
            .iter()
            .find(|candidate| candidate.path.as_ref() == Some(&held_path))
            .expect("the held path still resolves, which is the whole problem");
        assert_ne!(
            trigger_text(at_the_same_path),
            held_trigger,
            "if these ever agree, this fixture stopped exercising the shift it exists for"
        );
        assert_eq!(trigger_text(at_the_same_path), ":three");
    } // End of function a_document_path_is_positional_so_a_deletion_repoints_it()

    /// A path no encoding can name is still a typed refusal, not a serializer
    /// failure.
    ///
    /// Driven through the real `open` path rather than over a struct literal:
    /// discovery refuses the directory, the refusal carries the path it was
    /// given, and that refusal has to reach the webview as `{ code, operands }`.
    ///
    /// **The file itself cannot be created on this machine.** APFS and HFS+
    /// reject a filename that is not valid UTF-8 with `EILSEQ`, which was
    /// confirmed by trying, so there is no way to put such a name inside a
    /// workspace and list it. What *is* reachable through a real command is the
    /// path the caller supplies, and that is what this drives. The `Ok` half —
    /// a `DocumentSummary` or a `DocumentView` carrying such a path — is pinned
    /// in `crate::workspace`'s own tests, where the projection can be given the
    /// context directly.
    #[test]
    #[cfg(unix)]
    fn a_non_utf8_root_is_a_typed_refusal_that_serializes() {
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;

        let mut root = std::path::PathBuf::from("/nonexistent");
        root.push(OsStr::from_bytes(b"espa\xffnso"));
        assert!(
            serde_json::to_value(&root).is_err(),
            "the premise: a bare PathBuf cannot carry these bytes across serde"
        );

        let session = WorkspaceSession::new();
        let error = session
            .open(Some(&root))
            .expect_err("a path that is not a directory is refused");
        assert_eq!(error.code(), "notADirectory");
        let json = serde_json::to_value(&error).expect("the refusal must reach the webview");
        assert_eq!(json["code"], "notADirectory");
        assert!(json["path"]
            .as_str()
            .expect("a path operand is a string")
            .contains('\u{fffd}'));
    } // End of function a_non_utf8_root_is_a_typed_refusal_that_serializes()

    /// The pure resolver refuses to invent a configuration directory.
    ///
    /// Kept from Phase 1b-1, with its claim corrected: that test's doc comment
    /// said *"a production build of this shell contains no reference to the core
    /// at all"*, which stopped being true the moment the commands above existed.
    /// What it still checks is worth keeping and is environment-independent —
    /// given two probe paths that do not exist, discovery fails rather than
    /// guessing.
    #[test]
    fn the_pure_resolver_refuses_two_nonexistent_probe_paths() {
        let resolved = espansoconfig_core::discovery::resolve_config_dir(
            None,
            Some(Path::new("/nonexistent-xdg-config-home")),
            Some(Path::new("/nonexistent-home")),
        );
        assert!(
            resolved.is_err(),
            "neither probe path exists, so resolution must fail rather than invent a directory"
        );
    }
}
