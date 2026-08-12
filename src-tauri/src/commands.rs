//! The IPC surface — thin wrappers over [`espansoconfig_core::workspace`].
//!
//! Plan section 6.4's **read-only** set — `open_workspace`, `list_documents`,
//! `get_document`, `get_match`, `document_text` and `reload_document` — and six
//! that write: `move_match` (2b-2a), `save_match` (2b-2b-3), `create_match` and
//! `delete_match` (2b-2c-2), `save_raw_document` (2b-2c-3b), and
//! `duplicate_match` (2c-3c-2). Each is one line over a [`WorkspaceSession`]
//! method, and each of the six read-only ones is one call into
//! `crate::workspace`, which Phase 1a built to be wrapped this way.
//!
//! `document_text` is the newest, added at Phase 1c-2b-2a, and it is the only
//! one that puts a file's **own text** on the wire rather than a projection of
//! it. Its contract is **exact preservation of valid UTF-8, and a typed refusal
//! otherwise** — the wire type is a JSON string, so a file that is not valid
//! UTF-8 is refused with `notUtf8` rather than carried. What survives the
//! crossing, and what cannot cross at all, is written down on
//! [`WorkspaceSession::text`] and measured in `crate::dispatch_check`.
//!
//! # Six of the twelve commands write, and they write the same way
//!
//! Phase 2b-2a added `move_match`, 2b-2b-3 `save_match`, 2b-2c-2 `create_match`
//! and `delete_match`, 2b-2c-3b `save_raw_document`, and 2c-3c-2
//! `duplicate_match`. All six go through
//! [`espansoconfig_core::persist::save_document`] and through nothing else:
//! `replace_file_atomically` and `replace_locked_file` take finished bytes,
//! validate nothing, and the second one deadlocks if the lock is taken twice, so
//! **no command in this crate calls either**. They also share [`run_one_save`],
//! which is this layer's one cache-coherency policy rather than six agreeing
//! copies of it.
//!
//! Five of them differ only in **who derives the edits**. `move_match`,
//! `create_match`, `delete_match` and `duplicate_match` each build their own
//! single primitive — an [`ItemMove`], an [`InsertItem`], a [`RemoveItem`], a
//! [`DuplicateItem`] — because each is one operation with nothing to diff.
//! `save_match` hands a [`MatchDraft`] to [`plan_match_edits`], which derives
//! the **smallest** batch that realises it — or refuses by name, in which case
//! nothing is attempted and the caller gets [`CommandError::DraftRefused`].
//! None of them ever combines two kinds of edit in one batch (`PROGRESS.md`
//! R25, and `DuplicateMustBeTheOnlyEditInItsBatch` for a duplicate).
//!
//! **`save_raw_document` derives no edits at all**, and that is the one real
//! difference on this surface. Phase 2b-2c-3a gave the single writing entry point
//! a second content mode — `SaveRequest::content` is a
//! [`espansoconfig_core::persist::SaveContent`], whose second arm is a whole
//! replacement text — and 2b-2c-3b is the caller of it. A replacement carries
//! **none** of the patch engine's locality guarantee: its promise is the exact
//! submitted UTF-8 bytes and nothing more, and no string built on it may present
//! it as an edit (design consult Q8). It is also the one save that may write text
//! the YAML parser rejects, which the owner ruled on and the acknowledgement
//! protocol — not a `force` flag — is what makes safe.
//!
//! # Every writing command now says what it would have to find again
//!
//! Phase 2c-4b-1 gives each of them a [`ReapplyRequest`], built **before** the
//! save transaction from the snapshot [`document_at`] validated the request
//! against, and carried through [`run_one_save`] to
//! [`conflict_after_the_lock`], which turns it into the conflict payload's
//! `reapply` operand against the fresh read.
//!
//! **A request has two operands, because an operation can name two identities.**
//! Its `subject` is the item the operation is about and its `placement` is the
//! item it is placed after, and each is answered separately: a drafted match save
//! is the only subject that may fall back to a unique unchanged trigger; a move,
//! a deletion and a duplication take exact item correspondence; a creation brings
//! its own snippet and is `Targetless`; and a raw replacement is `Unsupported`,
//! permanently. Every `after` anchor — a move's and a creation's alike — is a
//! **placement** at exact item correspondence, and every other operation's
//! placement is `NotAnchored`. Answering a move's subject alone would say the
//! moved snippet is still there while saying nothing about whether the
//! destination it was sent to still exists.
//!
//! **It adds no behaviour.** Nothing on any path reads the answer, no command
//! refuses because of it and no byte written to disk depends on it. It is
//! evidence a later sub-phase acts on, and the reason it is built here rather
//! than later is written on [`run_one_save`].
//!
//! # Three constraints this module inherits and does not drop
//!
//! - **One writer, one entry point.** Every byte this application puts on a
//!   user's disk goes through the save transaction, with a
//!   [`espansoconfig_core::persist::BackupSession`] this layer owns and never
//!   omits.
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

use serde::{Deserialize, Serialize};
use tauri::State;

use espansoconfig_core::draft::{plan_match_edits, MatchDraft, NewMatch};
use espansoconfig_core::model::{DocumentView, MatchId, MatchView};
use espansoconfig_core::patch::{
    DocumentEdit, DocumentPath, DuplicateItem, InsertItem, ItemMove, ItemPlacement, RemoveItem,
};
use espansoconfig_core::persist::{
    save_document, Acknowledgement, BackupSession, SaveContent, SaveError, SaveRequest,
    SavedDocument,
};
use espansoconfig_core::reconcile::{
    reconcile, PlacementMode, ReapplyConfidence, ReapplyMode, ReapplyRequest,
};
use espansoconfig_core::workspace::{DocumentSummary, Workspace, WorkspaceSummary};
use espansoconfig_core::{ContentRevision, DocumentId, SourceDocument};

use crate::error::CommandError;
use crate::save::SaveResult;

/// The one key a match list lives under, in the document's root mapping.
///
/// Written once, here, because two spellings of it would be two answers to
/// *"which list does a new snippet join?"*. The path resolver compares **decoded**
/// keys, so a document that writes `"matches":` in quotes is found by this too.
const MATCH_LIST_KEY: &str = "matches";

/// The stream document espanso loads.
///
/// A YAML file may hold several documents; espanso reads the first, and the read
/// model projects only that one (`DocumentView::stream_documents` reports the
/// rest). Every path this module builds therefore starts at document 0.
const LOADED_STREAM_DOCUMENT: usize = 0;

/// Where a newly created snippet goes in its file's list.
///
/// **Three-valued, because the list has three interesting places** and a
/// two-valued `Option` would have to make one of them unreachable. It is the wire
/// counterpart of [`ItemPlacement`], and the difference between the two is the
/// difference this whole boundary is built on: a placement names a **position**
/// in the sequence, and this names an **identity**. A caller sends the snippet it
/// can see, and Rust turns it into an index against the parse it holds.
///
/// Every variant is a struct variant, including the two with no operands, so the
/// enum crosses `serde`'s externally tagged representation as a **uniform object**
/// — `{"Front":{}}`, never the bare string `"Front"` a unit variant would produce.
/// That is the same rule `DraftError` follows and for the same reason
/// (`docs/decisions/2b-2b-3-notes.md` D5): one shape per wire enum is what lets a
/// frontend type-guard it without a special case per variant.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NewMatchPosition {
    /// Above the file's first snippet.
    Front {},
    /// Directly after the snippet this identity names.
    After {
        /// The snippet the new one is written after.
        anchor: MatchId,
    },
    /// After the file's last snippet.
    End {},
}

/// One open configuration directory, and the session state that belongs to it.
///
/// The two travel together because they have the same lifetime and the same
/// scope: a [`BackupSession`] is *"which files this editing session has already
/// copied, and which batch folder its copies go in"*, and both questions are
/// about the directory that is open. Opening another one replaces both.
#[derive(Debug)]
struct Open {
    /// The configuration directory, its file list and its parse cache.
    workspace: Workspace,
    /// Where this session's pre-save copies go — plan section 6.6 step 13.
    ///
    /// **Owned here because the core cannot own it.**
    /// [`espansoconfig_core::persist::SaveRequest::backups`] is an `Option` and
    /// `None` means *no backup at all*; the core deliberately holds no session
    /// state of its own, so a save with no safety net is what happens if this
    /// layer forgets. It does not forget: every save goes through
    /// [`WorkspaceSession::move_match`] or [`WorkspaceSession::save_match`], each
    /// of which passes `Some(&self.backups)`, and there is no code path in this
    /// crate that passes `None`.
    backups: BackupSession,
}

/// The one piece of state this application manages.
///
/// Holds at most one [`Open`] workspace. `None` before the first successful
/// `open_workspace`, and every other command answers
/// [`CommandError::NoWorkspaceOpen`] until then — rather than opening one
/// implicitly, which would make "which directory am I looking at?" a question
/// with an answer nobody asked for.
#[derive(Debug, Default)]
pub struct WorkspaceSession {
    open: Mutex<Option<Open>>,
}

impl WorkspaceSession {
    /// An empty session, with no workspace open.
    pub fn new() -> WorkspaceSession {
        WorkspaceSession {
            open: Mutex::new(None),
        }
    }

    /// Locates a configuration directory and opens it.
    ///
    /// Parses nothing: [`Workspace::discover`] enumerates and stops.
    ///
    /// # The backup session is created here, and cannot fail
    ///
    /// [`BackupSession::rooted_at`] is **infallible by construction**: it
    /// canonicalises the configuration root where that succeeds, keeps it as
    /// spelled where it does not, and **creates no directory at all** — a session
    /// that never saves anything leaves no trace on disk. So there is no
    /// "the backup session could not be created" branch to decide a policy for,
    /// and this layer never has an occasion to pass
    /// [`espansoconfig_core::persist::SaveRequest::backups`] a `None`.
    ///
    /// **That is a property of today's constructor, not a law**, and the decision
    /// if it ever changes is written down rather than left to whoever meets it:
    /// a save whose safety net cannot be put in place must **refuse**, exactly as
    /// [`espansoconfig_core::persist::SaveError::Backup`] refuses one whose copy
    /// cannot be written. Silently saving with `backups: None` would make an
    /// unread field the only thing between a user and a destructive operation
    /// performed without the copy that exists to survive it.
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
        let backups = BackupSession::rooted_at(workspace.root());
        let mut guard = self.lock();
        *guard = Some(Open { workspace, backups });
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

    /// The whole text of one document, unchanged, for a file that is valid
    /// UTF-8.
    ///
    /// Available **including for a document that failed to parse** — that is the
    /// one file whose bytes a reader most needs, and refusing it would make the
    /// application useless at the moment it matters.
    ///
    /// The text is cloned out of the cache for the same reason a
    /// [`DocumentView`] is: it has to be serialized after the lock is released.
    ///
    /// # The contract: exact preservation of valid UTF-8, typed refusal
    /// otherwise
    ///
    /// **This is not a byte-fidelity API for arbitrary disk bytes**, and the
    /// wire type is why: the value is a JSON string, and a `String` cannot hold
    /// a byte sequence that is not valid UTF-8. A file containing, say, a lone
    /// `0x80` never reaches this command — `read_utf8` in
    /// `espansoconfig_core::workspace` refuses it with
    /// `WorkspaceError::NotUtf8 { path, offset }`, which crosses as
    /// [`CommandError::NotUtf8`] carrying the offset of the first invalid
    /// sequence. Nothing decodes lossily and no U+FFFD is substituted, so the
    /// caller is told the file cannot be represented rather than shown a
    /// mangled version of it — but the caller also cannot display that file at
    /// all. Changing that is a **wire-format** change, not a change here;
    /// `docs/decisions/1c-2b-2a-notes.md` section 3.1 records the cost Phases
    /// 2–5 inherit.
    ///
    /// For a file that *is* valid UTF-8, nothing on this path re-encodes it: no
    /// line ending is converted, no leading BOM is stripped, no final newline is
    /// added, and no Unicode normalisation runs. `serde_json` escapes what JSON
    /// requires — `"`, `\`, and the C0 controls, `\r`, `\n` and NUL among them —
    /// and a JSON parser reverses every one of those escapes exactly, so the
    /// response body Tauri builds decodes back to the file. The claim is
    /// measured rather than argued: `dispatch_check.rs` drives this command
    /// through the real IPC dispatcher over the byte-exact corpus fixtures and
    /// compares the response against `std::fs::read` of the same file.
    ///
    /// **The measurement stops at that response body.** `mock_builder()` swaps
    /// the platform webview out, so no test in this repository says anything
    /// about what WKWebView or `postMessage` then does with the string. That is
    /// a named hole (`docs/decisions/1c-2b-2a-notes.md` section 4.3), not an
    /// implication.
    ///
    /// One thing genuinely changes coordinate system, and it is not the text: a
    /// **byte** offset into this string is not a JavaScript **string index**,
    /// because a JavaScript string is indexed in UTF-16 code units. Every span
    /// on this wire is a byte span, so a caller must never cut one out of this
    /// text; that is why an unmodelled entry's value is sliced in Rust
    /// (`espansoconfig_core::model::UnknownEntry::value_text`).
    pub fn text(&self, id: DocumentId) -> Result<String, CommandError> {
        self.with_workspace(|workspace| Ok(workspace.document_text(id)?.to_owned()))
    }

    /// Re-reads one document from disk, reparsing only if its bytes changed.
    pub fn reload(&self, id: DocumentId) -> Result<DocumentView, CommandError> {
        self.with_workspace(|workspace| Ok(workspace.refresh(id)?.view.clone()))
    }

    /// Moves one match within its own sequence and saves the file.
    ///
    /// **The only method in this crate that can write a user's file**, and it
    /// writes it exactly one way: through
    /// [`espansoconfig_core::persist::save_document`], with exactly one
    /// [`DocumentEdit::MoveItem`] and nothing beside it. `PROGRESS.md` R25 —
    /// a move may not be combined with any other edit in one batch, because the
    /// move's verification is not compositional.
    ///
    /// # What it refuses before it attempts anything
    ///
    /// - a `base_revision` that is not the revision this session's projection
    ///   holds — [`CommandError::IdentityStaleRevision`], because a path resolved
    ///   against one parse and applied to another names a **position**, and a
    ///   position is not an identity
    ///   (`a_document_path_is_positional_so_a_deletion_repoints_it`);
    /// - an `after` naming another **document** —
    ///   [`CommandError::IdentityWrongDocument`] (`PROGRESS.md` D2r);
    /// - an `after` that cannot be shown to sit in the **same sequence** as the
    ///   moved item — [`CommandError::MoveNotWithinOneSequence`].
    ///
    /// # What it answers with
    ///
    /// [`SaveResult`], in the `Ok` channel, for the three outcomes that are a
    /// save rather than a failure: it committed, the file had moved on, or the
    /// semantic gate refused. Everything else is a [`CommandError`], the
    /// transaction's own typed failures inside
    /// [`CommandError::SaveFailed`].
    ///
    /// **The answer carries the moved match's identity in the new revision**,
    /// because a commit invalidates every [`MatchId`] the caller holds: an
    /// identity records the revision it was minted from, so the one that named
    /// this match a moment ago now resolves to `identityStaleRevision`.
    pub fn move_match(
        &self,
        id: MatchId,
        after: Option<MatchId>,
        base_revision: ContentRevision,
        acknowledgement: &Acknowledgement,
    ) -> Result<SaveResult, CommandError> {
        self.with_open(|workspace, backups| {
            move_one_match(
                workspace,
                backups,
                id,
                after,
                base_revision,
                acknowledgement,
            )
        })
    } // End of function move_match()

    /// Writes one match's drafted values into its file.
    ///
    /// The second method in this crate that can write a user's file, and it
    /// writes it the same one way: through
    /// [`espansoconfig_core::persist::save_document`], with a batch
    /// [`plan_match_edits`] derived and nothing added to it here.
    ///
    /// # What it refuses before it attempts anything
    ///
    /// - a `base_revision` that is not the revision this session's projection
    ///   holds — [`CommandError::IdentityStaleRevision`]. **Positional addressing
    ///   makes this check load-bearing in a way key-addressing was not**: below
    ///   the match mapping a draft names a variable, a `params` entry or a
    ///   sequence element by *index*, and a stale index does not name a missing
    ///   entry — it names a **different** one, and succeeds
    ///   (`docs/decisions/2b-2b-2-notes.md` section 11);
    /// - the identity refusals, unchanged from [`WorkspaceSession::match_view`];
    /// - anything [`plan_match_edits`] will not derive a batch for —
    ///   [`CommandError::DraftRefused`], carrying the core's refusal whole.
    ///
    /// # What it does not refuse
    ///
    /// **A draft that changes nothing.** It plans to an empty batch, and the empty
    /// batch is still handed to the transaction rather than answered from the
    /// cached view — see [`save_one_match`], which is where the reason is written
    /// down.
    ///
    /// **A match that is not an item of a block sequence.** That is
    /// [`WorkspaceSession::move_match`]'s refusal and not this one: a move changes
    /// a sequence position and a scalar save does not, so a match addressed some
    /// other way is still perfectly editable and
    /// [`CommandError::MoveNotWithinOneSequence`] never appears on this path.
    ///
    /// # What it answers with
    ///
    /// [`SaveResult`], in the `Ok` channel, exactly as
    /// [`WorkspaceSession::move_match`] does — and with the same three outcomes
    /// meaning the same three things.
    pub fn save_match(
        &self,
        id: MatchId,
        draft: &MatchDraft,
        base_revision: ContentRevision,
        acknowledgement: &Acknowledgement,
    ) -> Result<SaveResult, CommandError> {
        self.with_open(|workspace, backups| {
            save_one_match(
                workspace,
                backups,
                id,
                draft,
                base_revision,
                acknowledgement,
            )
        })
    } // End of function save_match()

    /// Writes one new match into a document's top-level `matches` list.
    ///
    /// The third method in this crate that can write a user's file, and it writes
    /// it the same one way: through
    /// [`espansoconfig_core::persist::save_document`], with exactly one
    /// [`DocumentEdit::InsertItem`].
    ///
    /// # It targets one list, named by the schema
    ///
    /// The document's **top-level `matches` value**, and nothing else. Not a wire
    /// path — `crate::wire_contract` records that two distinct filenames can
    /// render to one string, so a command that accepts a wire path back as a
    /// target is a bug — and not an arbitrary sequence, because a new snippet
    /// belongs in the list espanso reads.
    ///
    /// # What it refuses before it attempts anything
    ///
    /// - a `base_revision` that is not the revision this session's projection
    ///   holds — [`CommandError::IdentityStaleRevision`]. Load-bearing for the
    ///   same reason as a move's: `position` names an **anchor by identity**, and
    ///   resolving one against another parse would anchor the new snippet to
    ///   whatever now occupies that node;
    /// - an anchor naming another **document** —
    ///   [`CommandError::IdentityWrongDocument`];
    /// - an anchor this projection cannot address as an item of the same list —
    ///   [`CommandError::MoveNotWithinOneSequence`];
    /// - a document with **no `matches:` key at all** —
    ///   [`CommandError::DocumentHasNoMatchList`]. A *bare* `matches:` is not this
    ///   refusal: the primitive promotes an implicit null into its first item, so
    ///   the first snippet of a file that already names the key can be created.
    ///
    /// # What it answers with
    ///
    /// [`SaveResult`], in the `Ok` channel, exactly as the two commands before it
    /// — and [`SaveResult::Saved::moved`] is the **created** match's identity in
    /// the new revision, which is the one thing a caller cannot derive for itself:
    /// the snippet did not exist when the call was made.
    pub fn create_match(
        &self,
        document: DocumentId,
        new_match: &NewMatch,
        position: &NewMatchPosition,
        base_revision: ContentRevision,
        acknowledgement: &Acknowledgement,
    ) -> Result<SaveResult, CommandError> {
        self.with_open(|workspace, backups| {
            create_one_match(
                workspace,
                backups,
                document,
                new_match,
                position,
                base_revision,
                acknowledgement,
            )
        })
    } // End of function create_match()

    /// Deletes one match from its file.
    ///
    /// The fourth method in this crate that can write a user's file, and it writes
    /// it the same one way: through
    /// [`espansoconfig_core::persist::save_document`], with exactly one
    /// [`DocumentEdit::RemoveItem`].
    ///
    /// # What travels with the snippet
    ///
    /// The primitive's answer, not this layer's: the item's own leading comment
    /// block and its inline comment go with it, and a comment the blank-line rule
    /// gives to the **file** stays exactly where it is. Deleting the only item of
    /// a list is refused by the engine
    /// (`EditError::RemovalWouldEmptyTheSequence`), because writing `matches: []`
    /// would synthesize a collection and leaving `matches:` bare would turn a list
    /// into YAML null; it arrives here inside [`CommandError::SaveFailed`].
    ///
    /// # Its answer names nothing
    ///
    /// [`SaveResult::Saved::moved`] is **`None`**, and this is the first command
    /// for which that is the routine correct answer rather than a defensive one:
    /// the match it deleted has no identity in the new revision, by construction.
    /// It is deliberately **not** a neighbour's identity — `moved` means *the new
    /// identity of the match acted upon*, and overloading it with which snippet a
    /// window should select next would re-introduce positional identity through a
    /// field whose whole purpose is to replace it. A caller re-reads the document
    /// and chooses.
    pub fn delete_match(
        &self,
        id: MatchId,
        base_revision: ContentRevision,
        acknowledgement: &Acknowledgement,
    ) -> Result<SaveResult, CommandError> {
        self.with_open(|workspace, backups| {
            delete_one_match(workspace, backups, id, base_revision, acknowledgement)
        })
    } // End of function delete_match()

    /// Replaces one document's whole text with the text supplied.
    ///
    /// The fifth method in this crate that can write a user's file, and it writes
    /// it the same one way: through
    /// [`espansoconfig_core::persist::save_document`]. It is the first that hands
    /// it **no** [`DocumentEdit`] at all — the request is the bytes — and so the
    /// first whose promise is not the patch engine's.
    ///
    /// # What it promises, which is narrower than every other save
    ///
    /// The exact submitted UTF-8 bytes are committed: no parser formatting, no
    /// newline normalization, no BOM added or removed, no final newline supplied,
    /// no re-indentation. That is *all*. **It is not a locality-preserving edit
    /// and no string built on it may say it is** — calling the whole file "the
    /// edited span" would make the guarantee every other command keeps vacuous
    /// (design consult Q8). A caller presents it as *replacing the entire
    /// document*.
    ///
    /// # A text the YAML parser rejects is written, once the user says so
    ///
    /// The owner's ruling, recorded in `docs/reviews/phase-2b-2c-3-design.md`:
    /// refusing would mean this application cannot repair a file that is already
    /// broken, which is the most valuable thing a raw editor does. So the parse
    /// is **attempted and reported, never enforced**. A candidate the parser
    /// rejects comes back as [`SaveResult::Refused`] carrying
    /// [`espansoconfig_core::validate::FindingCode::DocumentDoesNotParse`], and
    /// the same call with that exact finding acknowledged commits it.
    ///
    /// That finding is **content-addressed to the candidate** by its `revision`
    /// operand, so consent collected for one broken text cannot be spent on
    /// another. There is still no `force` flag and no bypass.
    ///
    /// # What it refuses before it attempts anything
    ///
    /// [`CommandError::NoWorkspaceOpen`], and the workspace's own refusal for a
    /// document this session does not know. **Not a stale `base_revision`** —
    /// see [`save_one_raw_document`], which is where that decision is written
    /// down: a replacement addresses nothing positionally, so the check that
    /// means something is the transaction's, taken under the write lock, and it
    /// answers [`SaveResult::Conflict`] with the disk's own projection.
    ///
    /// # Its answer names nothing
    ///
    /// [`SaveResult::Saved::moved`] is **`None`**, permanently and by
    /// construction. After `committed: true` **every** [`MatchId`] in the file is
    /// stale and there is no single match to answer with, so a caller reloads the
    /// document rather than following one identity across the save.
    pub fn save_raw_document(
        &self,
        document: DocumentId,
        base_revision: ContentRevision,
        text: &str,
        acknowledgement: &Acknowledgement,
    ) -> Result<SaveResult, CommandError> {
        self.with_open(|workspace, backups| {
            save_one_raw_document(
                workspace,
                backups,
                document,
                base_revision,
                text,
                acknowledgement,
            )
        })
    } // End of function save_raw_document()

    /// Inserts a byte-exact copy of one match immediately after it, and saves
    /// the file.
    ///
    /// The sixth method in this crate that can write a user's file, and it
    /// writes it the same one way: through
    /// [`espansoconfig_core::persist::save_document`], with exactly one
    /// [`DocumentEdit::DuplicateItem`] — the batch restriction is the engine's
    /// own (`DuplicateMustBeTheOnlyEditInItsBatch`), so a clone-and-edit cannot
    /// be expressed here at all.
    ///
    /// # What travels, and where the clone lands
    ///
    /// The primitive's answer, not this layer's: the item's owned physical-line
    /// runs, byte for byte — leading comment block, dash, every key, block
    /// scalars, inline comments, trailing spaces and each line's own terminator —
    /// landing **immediately after the source, in the same sequence, with no
    /// placement choice** (Phase 2c-3c design consult, Q4). The trigger is
    /// copied unchanged, which is why the first attempt is interrupted by the
    /// acknowledgeable [`espansoconfig_core::validate::FindingCode::DuplicateKeepsTriggerDefinition`]
    /// suspicion whenever the source has a modelled trigger form.
    ///
    /// # What it refuses before it attempts anything
    ///
    /// - a `base_revision` that is not the revision this session's projection
    ///   holds — [`CommandError::IdentityStaleRevision`], for the reason every
    ///   writing command shares: a path resolved against one parse and applied
    ///   to another names a **position**, and a position is not an identity;
    /// - the identity refusals, unchanged from [`WorkspaceSession::match_view`];
    /// - a match this projection cannot address as a sequence item —
    ///   [`CommandError::DuplicateSourceNotASequenceItem`], the duplicate's own
    ///   spelling of the negative claim rather than a leaked move code.
    ///
    /// # What it answers with
    ///
    /// [`SaveResult`], in the `Ok` channel, exactly as every writing command
    /// does — and [`SaveResult::Saved::moved`] is the **clone's** identity in
    /// the new revision, minted at the post-insertion path the primitive's own
    /// arithmetic derives. After a commit every identity the caller holds for
    /// the file is stale, the source's included, so the returned identity is
    /// the only safe continuation (consult Q8).
    ///
    /// **`moved: None` on a commit says only that the clone could not be
    /// identified in the read that followed the write** — [`after_a_save`] also
    /// answers `None` when that read itself fails, or when the fresh projection
    /// holds no match at the landed path, so no string built on this answer may
    /// name a second writer as *the* cause. The causes are not enumerated here
    /// because the set is not closed.
    pub fn duplicate_match(
        &self,
        id: MatchId,
        base_revision: ContentRevision,
        acknowledgement: &Acknowledgement,
    ) -> Result<SaveResult, CommandError> {
        self.with_open(|workspace, backups| {
            duplicate_one_match(workspace, backups, id, base_revision, acknowledgement)
        })
    } // End of function duplicate_match()

    /// Runs `action` against the open workspace, or refuses because there is
    /// none.
    fn with_workspace<T>(
        &self,
        action: impl FnOnce(&mut Workspace) -> Result<T, CommandError>,
    ) -> Result<T, CommandError> {
        let mut guard = self.lock();
        match guard.as_mut() {
            None => Err(CommandError::NoWorkspaceOpen),
            Some(open) => action(&mut open.workspace),
        }
    } // End of function with_workspace()

    /// Runs `action` against the open workspace **and its backup session**, or
    /// refuses because there is none.
    ///
    /// [`WorkspaceSession::with_workspace`]'s sibling for the four methods that
    /// write. It exists for the same reason that one does — the refusal for *no
    /// workspace is open* is written once — and it hands out the two borrows
    /// separately, which is what lets the planning free functions take a
    /// `&mut Workspace` and a `&BackupSession` at the same time.
    ///
    /// **A writing method uses this one and not [`WorkspaceSession::with_workspace`]**,
    /// because a save with no [`BackupSession`] is a save with no safety net:
    /// [`espansoconfig_core::persist::SaveRequest::backups`] is an `Option` whose
    /// `None` means *no backup at all*, and a method that could not reach the
    /// session's would have nothing to pass but that.
    fn with_open<T>(
        &self,
        action: impl FnOnce(&mut Workspace, &BackupSession) -> Result<T, CommandError>,
    ) -> Result<T, CommandError> {
        let mut guard = self.lock();
        match guard.as_mut() {
            None => Err(CommandError::NoWorkspaceOpen),
            Some(Open { workspace, backups }) => action(workspace, backups),
        }
    } // End of function with_open()

    /// Locks the session, absorbing poisoning. See the module documentation.
    fn lock(&self) -> MutexGuard<'_, Option<Open>> {
        self.open.lock().unwrap_or_else(PoisonError::into_inner)
    }
} // End of impl WorkspaceSession

/// The sequence a path's last segment indexes, and that index.
///
/// `None` when the path does not end in a sequence position, which is the only
/// shape [`ItemMove`] can move: an item of a block sequence. A `matches[2]`
/// answers `(matches, 2)`.
fn sequence_of(path: &DocumentPath) -> Option<(DocumentPath, usize)> {
    let (last, head) = path.segments().split_last()?;
    let index = last.as_index()?;
    Some((
        DocumentPath::new(path.document_index(), head.to_vec()),
        index,
    ))
} // End of function sequence_of()

/// The address of an already-resolved match, and the sequence it is an item of.
///
/// **It takes the [`MatchView`] rather than the [`MatchId`]**, because since
/// Phase 2c-4b-1 every command that addresses a match is already holding one: it
/// needs the projection to capture a reapply anchor from. Resolving the identity
/// a second time here would be two lookups that agree today and are two places
/// for them to stop agreeing.
///
/// # Errors
///
/// [`CommandError::MoveNotWithinOneSequence`] for a match this projection cannot
/// address as a sequence item. It is a **negative** claim and is worded as one:
/// the refusal is *this could not be shown to be an item of a sequence*, which
/// covers a match with no path at all as honestly as it covers one whose path
/// ends in a key. The identity refusals themselves belong to
/// [`DocumentView::match_by_id`], which the caller has already taken.
fn item_address(found: &MatchView) -> Result<(DocumentPath, usize), CommandError> {
    let path = found
        .path
        .as_ref()
        .ok_or(CommandError::MoveNotWithinOneSequence)?;
    sequence_of(path).ok_or(CommandError::MoveNotWithinOneSequence)
} // End of function item_address()

/// The item the anchor `anchor` names and the index it holds in `sequence`,
/// resolved against `view`.
///
/// **The one place an identity becomes an index.** Every writing command that
/// takes an anchor — a move's `after`, a creation's
/// [`NewMatchPosition::After`] — asks this, so an anchor cannot get one set of
/// refusals on one path and another set on the next, and it cannot be resolved
/// against two different parses.
///
/// **It answers the projected item beside the index** because since Phase
/// 2c-4b-1 an anchor is also a *correspondence operand*: the placement anchor of
/// a move or a creation has to be captured as a [`PlacementMode`], and capturing
/// it needs the [`MatchView`] this call already resolved. Resolving the same
/// identity a second time for that would be two lookups that agree today and are
/// two places for them to stop agreeing — the reason [`item_address`] takes a
/// projected match rather than an identity.
///
/// # Errors
///
/// [`CommandError::IdentityWrongDocument`] for an anchor in another file, and
/// [`CommandError::MoveNotWithinOneSequence`] for an anchor this projection
/// cannot address as an item of `sequence`.
///
/// **The cross-document refusal is [`DocumentView::match_by_id`]'s**, not a check
/// written here, and it is the same answer every other command's identity check
/// gives rather than a second one that agrees today: that method compares the
/// identity's document against the view's own before anything else, and
/// `From<IdentityError>` turns
/// that into exactly this code with exactly these operands. `PROGRESS.md` D2r — a
/// move never crosses a file, and a snippet is created in one document for the
/// same reason — is kept by that comparison, refused before anything is
/// attempted, because there is no edit that could express the crossing.
fn anchor_item<'a>(
    view: &'a DocumentView,
    sequence: &DocumentPath,
    anchor: MatchId,
) -> Result<(&'a MatchView, usize), CommandError> {
    let found = view.match_by_id(anchor)?;
    let (anchor_sequence, at) = item_address(found)?;
    if &anchor_sequence != sequence {
        return Err(CommandError::MoveNotWithinOneSequence);
    }
    Ok((found, at))
} // End of function anchor_item()

/// The **snapshot** of `document`, refused unless it is the revision the caller
/// drafted, moved, anchored or addressed against.
///
/// **The check every writing command takes first, written once.** A
/// [`DocumentPath`] ending in an index is a *position*, and every one of the five
/// identity-aware commands turns an identity into one: a stale identity does not
/// name a missing entry, it names a **different** one, and it succeeds. The
/// refusal therefore happens before a batch is derived rather than being left to
/// the transaction's own optimistic-concurrency check, which compares bytes and
/// would let a well-formed edit of the wrong node through.
///
/// # Why the whole snapshot rather than its projection
///
/// Because Phase 2c-4b-1's reapply anchor is made of **bytes**, not of a
/// projection: the item's ownership envelope and its trigger forms' exact source
/// spelling both need the file's text and its parse. Handing the caller a
/// `&DocumentView` and letting it fetch the text separately would put a second
/// read between the two, which is precisely the pairing failure the conflict
/// payload exists to avoid. `&snapshot.view` is what the addressing code uses,
/// and it is the same value the projection-only accessor would have returned.
///
/// The reborrow is sound because [`Workspace::get_document`] already hands out a
/// `&SourceDocument` from a `&mut self`: the caller's mutable borrow of the
/// workspace lasts exactly as long as it keeps using the snapshot.
///
/// # Errors
///
/// [`CommandError::IdentityStaleRevision`], carrying the revision this session
/// holds and the one the caller sent, plus the read model's own failure for a
/// document that cannot be read at all.
fn document_at(
    workspace: &mut Workspace,
    document: DocumentId,
    base_revision: ContentRevision,
) -> Result<&SourceDocument, CommandError> {
    let snapshot = workspace.get_document(document)?;
    if snapshot.view.revision != base_revision {
        return Err(CommandError::IdentityStaleRevision {
            expected: snapshot.view.revision.to_hex(),
            found: base_revision.to_hex(),
        });
    }
    Ok(snapshot)
} // End of function document_at()

/// One save's own inputs, beside the session it runs against.
///
/// A struct rather than six more parameters, and not only to keep the argument
/// count down: every field here is **named at the call site**, which is what
/// stops two `Option`s or two revisions of the same shape being passed in the
/// wrong order. The shape deliberately mirrors
/// [`espansoconfig_core::persist::SaveRequest`], which is what
/// [`run_one_save`] turns most of it into.
struct OneSave<'a> {
    /// The file to write.
    document: DocumentId,
    /// The optimistic-concurrency token the caller drafted, moved, anchored or
    /// addressed against.
    base_revision: ContentRevision,
    /// The whole of what the file should hold afterwards, in whichever of
    /// [`SaveContent`]'s two modes the caller derived.
    content: SaveContent<'a>,
    /// The suspicions the caller has already shown someone, by content.
    acknowledgement: &'a Acknowledgement,
    /// Where the operation's match is **afterwards**, when it has one.
    at: Option<&'a DocumentPath>,
    /// **Both** of the identities this operation would have to find again if the
    /// save conflicts — its subject and its positional anchor.
    ///
    /// Built by the caller from the snapshot it validated its request against,
    /// **before** the transaction. See [`run_one_save`].
    reapply: ReapplyRequest,
} // End of struct OneSave

/// Hands one save's content to the transaction, and brings the session's cache
/// back in step with whatever happened.
///
/// **The tail every writing command shares, and the one place this layer's
/// cache-coherency policy lives.** A sixth command that writes must call this
/// rather than copy it: the four outcomes below are not four independent
/// decisions, they are one policy, and a copy of it drifts silently — the
/// deletion command had already lost the comment explaining why `backups` is
/// never `None` by the time this function was extracted.
///
/// `content` is the whole of what the file should hold afterwards, in whichever
/// of [`SaveContent`]'s two modes the caller derived. The parameter is the mode
/// rather than a batch of edits because Phase 2b-2c-3b's `save_raw_document`
/// has **no** batch to hand over and must still take this exact tail: it needs
/// the same eviction rule, the same conflict payload and the same refusal
/// channel as the four commands that do, and a second copy of them written for
/// the raw mode is precisely the drift this function exists to stop.
///
/// `at` is *where the operation's match is afterwards*, and each caller computes
/// it differently — [`after_a_save`] documents which is which, and why the
/// difference is the reason an address is passed in rather than derived here.
/// `None` says the operation has no single match to name, which is
/// [`delete_one_match`]'s routine answer and
/// [`save_one_raw_document`]'s only possible one.
///
/// `reapply` is **everything this operation would need to find again** if the
/// save conflicts — its subject and, when it has one, the item it is placed
/// after — and it is a value the caller has already built from the snapshot it
/// validated its request against. It is carried through this function rather
/// than derived inside it for one reason, and it is the reason the whole
/// operand exists: by the time a conflict is being described, the session's
/// cache has been refreshed, and an anchor made *here* would describe the bytes
/// that caused the conflict instead of the bytes the person was working on
/// (Phase 2c-4b design consult, Q9 item 2). Nothing reads it on any path but the
/// conflict one, and nothing it can say changes what is written to disk.
///
/// # The four outcomes
///
/// - **committed, or committed nothing** — [`after_a_save`], which re-reads and
///   mints the identity when there is one to mint;
/// - **the file moved on under the lock** — [`conflict_after_the_lock`], which
///   takes the second read the payload needs;
/// - **the semantic gate declined** — [`SaveResult::Refused`], carrying the
///   findings a caller hands back to make the same save proceed;
/// - **anything else** — [`CommandError::SaveFailed`], and if the failure
///   [`SaveError::may_have_written`] the cached parse is **evicted**: the rename
///   may have completed, so the parse may describe bytes that are gone. Dropping
///   it costs one reparse and stops the window showing a file that no longer
///   exists in that form.
///
/// # Errors
///
/// [`CommandError::SaveFailed`] for the transaction's own typed failures, and the
/// workspace's own for a document context that cannot be read.
fn run_one_save(
    workspace: &mut Workspace,
    backups: &BackupSession,
    save: OneSave<'_>,
) -> Result<SaveResult, CommandError> {
    let OneSave {
        document,
        base_revision,
        content,
        acknowledgement,
        at,
        reapply,
    } = save;
    // Cloned so that the immutable borrow of the workspace ends before the save;
    // the context is a handful of fields from the directory walk, not a parse.
    let context = workspace.document_context(document)?.clone();
    let request = SaveRequest {
        context: &context,
        base_revision,
        content,
        acknowledgement,
        // Never `None`. See `WorkspaceSession::open`.
        backups: Some(backups),
    };
    match save_document(request) {
        Ok(saved) => Ok(after_a_save(workspace, document, at, saved)),
        Err(SaveError::RevisionMismatch {
            expected, found, ..
        }) => conflict_after_the_lock(workspace, document, expected, found, &reapply),
        Err(SaveError::Refused(refusal)) => Ok(SaveResult::Refused {
            verdict: refusal.verdict,
            findings: refusal.findings,
        }),
        Err(error) => {
            if error.may_have_written() {
                let _ = workspace.evict(document);
            }
            Err(CommandError::SaveFailed { error })
        }
    } // End of the match over the transaction's four outcomes
} // End of function run_one_save()

/// Plans and runs one move against an open workspace.
///
/// A free function rather than a method so that the session's mutex guard is
/// destructured once, at the call site, and the workspace and the backup session
/// arrive here as two independent borrows.
fn move_one_match(
    workspace: &mut Workspace,
    backups: &BackupSession,
    id: MatchId,
    after: Option<MatchId>,
    base_revision: ContentRevision,
    acknowledgement: &Acknowledgement,
) -> Result<SaveResult, CommandError> {
    // A caller editing against a parse this session no longer holds is refused
    // here: its paths are positions in that parse, so planning against them would
    // move whatever now occupies the position rather than what was selected.
    let base = document_at(workspace, id.document, base_revision)?;
    let view = &base.view;
    let found = view.match_by_id(id)?;
    let (sequence, from) = item_address(found)?;
    let anchor = after
        .map(|anchor| anchor_item(view, &sequence, anchor))
        .transpose()?;
    let destination = anchor.map(|(_, at)| at);
    // **A move placed after another snippet names two identities, and both are
    // captured here**, from the snapshot just validated, and not later. See
    // `run_one_save`. The moved item is the subject and a move acts on its whole
    // ownership envelope, so nothing weaker than exact item correspondence will
    // do; the `after` item is a positional anchor, which takes exact item
    // correspondence for the same reason and has no weaker tier to offer. A move
    // to the top names no anchor, and says so rather than leaving the question
    // unanswered.
    let reapply = ReapplyRequest {
        subject: ReapplyMode::anchored(base, found, ReapplyConfidence::ExactItem),
        placement: match anchor {
            None => PlacementMode::NotAnchored,
            Some((item, _)) => PlacementMode::anchored(base, item),
        },
    };

    let edit = match destination {
        None => ItemMove::to_front(sequence.clone().with_index(from)),
        Some(at) => ItemMove::after(sequence.clone().with_index(from), at),
    };
    // Where the item will be afterwards, from the engine's own arithmetic rather
    // than from a second copy of it (`ItemMove::resulting_index`).
    let landed = sequence.with_index(edit.resulting_index(from));
    let edits = [DocumentEdit::MoveItem(edit)];
    run_one_save(
        workspace,
        backups,
        OneSave {
            document: id.document,
            base_revision,
            content: SaveContent::Edits(&edits),
            acknowledgement,
            at: Some(&landed),
            reapply,
        },
    )
} // End of function move_one_match()

/// Plans and runs one drafted match save against an open workspace.
///
/// A free function for [`move_one_match`]'s reason: the session's mutex guard is
/// destructured once, at the call site, so the workspace and the backup session
/// arrive here as two independent borrows.
///
/// # The order of the steps is the contract
///
/// 1. **resolve the projection, with no lock held.** Planning reads a parse; it
///    writes nothing and takes nothing;
/// 2. **refuse a `base_revision` that is not this projection's.** The draft's
///    addresses are positions in *that* parse, so a draft planned against one
///    projection and applied to another edits whatever now occupies the position;
/// 3. **derive the batch**, or refuse by name. [`plan_match_edits`] runs both
///    batch guards itself as steps 7 and 8 of its own documented contract —
///    `check_closed_surface` over the derived batch and `check_batch_independence`
///    with the match mapping's keys **and** every nested open mapping's whole key
///    list. They are deliberately **not** re-run here: the closed-surface half
///    would be an identical second call, and the independence half needs the
///    original key lists, which only the planner has. A copy of them assembled at
///    this layer would be a *weaker* second statement wearing the same name;
/// 4. **hand the batch to the transaction, even when it is empty.**
///
/// # Why an empty batch is still a save
///
/// Phase 2b-2b-3's design consult (`docs/reviews/phase-2b-2b-3-design.md`, Q3)
/// settled this, and the tempting answer is the wrong one. A draft that changes
/// nothing produces no edits, the candidate comes out byte-identical, and
/// [`save_document`] answers `committed: false` — **a success**, not a failure.
/// Short-circuiting to that success from the cached view would skip the
/// optimistic-concurrency check the transaction takes **under the per-path
/// lock**, and so would report success for a file that some other writer changed
/// after step 2. The single authoritative save-result path is worth one wasted
/// read.
///
/// There is no lock-ordering hazard in the sequence, and the consult says why:
/// planning holds no lock at all, [`save_document`] alone takes one, and a
/// concurrent modification between steps 2 and 4 becomes a
/// [`SaveResult::Conflict`] rather than a wrong write.
fn save_one_match(
    workspace: &mut Workspace,
    backups: &BackupSession,
    id: MatchId,
    draft: &MatchDraft,
    base_revision: ContentRevision,
    acknowledgement: &Acknowledgement,
) -> Result<SaveResult, CommandError> {
    // A caller that drafted against a parse this session no longer holds is
    // refused here. See `WorkspaceSession::save_match`: a stale index names a
    // different entry rather than a missing one, so this is refused rather than
    // attempted.
    let base = document_at(workspace, id.document, base_revision)?;
    let found = base.view.match_by_id(id)?;
    // The match's own address, captured before the save because the projection it
    // comes from is about to be replaced. A scalar save does not relocate the
    // match, so this is where it still is afterwards — which is why this path
    // does not use `item_address` and never refuses a match that is not a
    // sequence item.
    let at = found.path.clone();
    // **The one operation that may fall back to a unique unchanged trigger.** Its
    // worst case is a rewritten field rather than a deleted or copied snippet,
    // and the per-field collision checks that make that safe live one layer out.
    // A match this projection carries no sequence-item path for — which this
    // command, alone, does not refuse — captures no anchor and answers
    // `NoAnchorInBase`. A drafted save moves nothing, so it names no anchor.
    let reapply = ReapplyRequest {
        subject: ReapplyMode::anchored(base, found, ReapplyConfidence::ExactItemOrUniqueTrigger),
        placement: PlacementMode::NotAnchored,
    };
    let edits =
        plan_match_edits(found, draft).map_err(|error| CommandError::DraftRefused { error })?;
    run_one_save(
        workspace,
        backups,
        OneSave {
            document: id.document,
            base_revision,
            content: SaveContent::Edits(&edits),
            acknowledgement,
            at: at.as_ref(),
            reapply,
        },
    )
} // End of function save_one_match()

/// The document's top-level `matches` list, or the refusal that it has none.
///
/// **Reads the projection rather than the syntax tree**, because the projection
/// is what the caller was shown and what this session already holds:
/// [`DocumentView::top_level_keys`] is every key of the loaded stream document,
/// decoded, which is exactly the comparison
/// `espansoconfig_core::patch::resolve_full` makes when it walks the same path.
///
/// A document that did not parse has no top-level keys at all and is refused
/// here, honestly: nothing can be said about the keys of a document the substrate
/// rejected, and a save planned against one would be planned against nothing.
///
/// # Errors
///
/// [`CommandError::DocumentHasNoMatchList`] — see the variant for why creation
/// refuses instead of writing the key.
fn match_list_of(view: &DocumentView) -> Result<DocumentPath, CommandError> {
    let named = view
        .top_level_keys
        .iter()
        .any(|key| key.text == MATCH_LIST_KEY);
    if !named {
        return Err(CommandError::DocumentHasNoMatchList {
            document: view.id.get(),
        });
    }
    Ok(DocumentPath::root(LOADED_STREAM_DOCUMENT).with_key(MATCH_LIST_KEY))
} // End of function match_list_of()

/// Turns a wire position into the placement the patch engine takes, **and hands
/// back the anchor item it resolved**.
///
/// Two of the three values are the same word on both sides of the boundary; the
/// third carries an identity, and turning that into an index is
/// [`anchor_item`]'s job rather than a second resolution written here. So a
/// creation's anchor gets exactly the refusals a move's anchor gets, from the
/// same call against the same projection.
///
/// The second half of the answer is `Some` exactly for
/// [`NewMatchPosition::After`], and it is what the caller captures its
/// [`PlacementMode`] from: a creation's `after` is a positional anchor and owes
/// the same correspondence evidence a move's does.
///
/// # Errors
///
/// [`anchor_item`]'s, unchanged: [`CommandError::IdentityWrongDocument`] for an
/// anchor in another file — a snippet is created in one document, exactly as a
/// move stays in one (`PROGRESS.md` D2r) — and
/// [`CommandError::MoveNotWithinOneSequence`] for an anchor this projection
/// cannot address as an item of `sequence`.
fn placement_of<'a>(
    view: &'a DocumentView,
    sequence: &DocumentPath,
    position: &NewMatchPosition,
) -> Result<(ItemPlacement, Option<&'a MatchView>), CommandError> {
    match position {
        NewMatchPosition::Front {} => Ok((ItemPlacement::Front, None)),
        NewMatchPosition::End {} => Ok((ItemPlacement::End, None)),
        NewMatchPosition::After { anchor } => {
            let (item, at) = anchor_item(view, sequence, *anchor)?;
            Ok((ItemPlacement::After(at), Some(item)))
        }
    } // End of the match over the three wire positions
} // End of function placement_of()

/// Plans and runs one creation against an open workspace.
///
/// A free function for [`move_one_match`]'s reason, and its steps are the same
/// four in the same order: resolve the projection, refuse a `base_revision` that
/// is not this session's, derive **one** edit, and hand it to the transaction.
///
/// # The primitive is not pre-planned here
///
/// Everything [`InsertItem`] can refuse — a flow sequence, a bare key whose
/// trivia is ambiguous, a sequence whose items disagree about their column — is
/// refused **inside the transaction**, under the lock and against the bytes the
/// transaction read, and arrives as [`CommandError::SaveFailed`]. Asking the
/// planner a second time here would resolve the document twice and let this layer
/// and the transaction disagree about a file that changed in between. What this
/// layer refuses is only what it alone can see: the identities, and whether the
/// document names a match list at all.
fn create_one_match(
    workspace: &mut Workspace,
    backups: &BackupSession,
    document: DocumentId,
    new_match: &NewMatch,
    position: &NewMatchPosition,
    base_revision: ContentRevision,
    acknowledgement: &Acknowledgement,
) -> Result<SaveResult, CommandError> {
    // A caller that chose an anchor in a parse this session no longer holds is
    // refused here: an identity resolved against another parse names a position,
    // and a position is not an identity.
    let base = document_at(workspace, document, base_revision)?;
    let view = &base.view;
    let sequence = match_list_of(view)?;
    let (placement, anchor) = placement_of(view, &sequence, position)?;
    // **A creation brings its own snippet**, so its *subject* is `Targetless`
    // whatever its placement is: there is no existing item to find again. `front`
    // and `end` are semantic choices, lowered afresh against whatever list the
    // file holds later, and name no anchor either. `after` names one, and it is
    // a **placement** — the same operand a move's `after` is, at the same exact
    // item correspondence — rather than a subject standing in for one.
    let reapply = ReapplyRequest {
        subject: ReapplyMode::Targetless,
        placement: match anchor {
            None => PlacementMode::NotAnchored,
            Some(item) => PlacementMode::anchored(base, item),
        },
    };
    // Where the new item will be: the index it takes is the number of original
    // items above it, which is the engine's own arithmetic
    // (`ItemPlacement::items_above`) rather than a second copy of it. The count
    // handed to it is the projection's matches, and that count is the sequence's
    // own item count rather than an approximation of it — a `matches` entry the
    // schema does not recognise still produces one `MatchView`, recorded by span
    // and not descended into (`DiagnosticCode::MatchIsNotAMapping`), so positions
    // never shift. A bare `matches:` projects zero of them and the promoted item
    // lands at 0, which is the same answer.
    //
    // **`items_above` alone is enough here only because the batch below holds one
    // insertion and nothing else**, which the next two lines are the whole of the
    // evidence for. A batch that also removed an item would shift this arrival,
    // and the answer would then be `espansoconfig_core::patch::insertion_landings`
    // over the whole batch — which is what the save transaction's own creation
    // finding uses, because it is handed a batch it did not build.
    //
    // **No address rather than a wrong one** when the arithmetic names no index:
    // `at: None` is already how this layer says a save has no match afterwards,
    // so the save still runs and reports `moved: None`. Unreachable from here —
    // `placement_of` builds an `After` only from the index `anchor_item` reads out
    // of a match this very projection holds, so it is bounded by the file's own
    // item count — and it is written out because an unreachable arm that says
    // nothing costs one selection, while an unwrap would cost the window.
    let landed = placement
        .items_above(view.matches.len())
        .map(|index| sequence.clone().with_index(index));
    let edits = [DocumentEdit::InsertItem(InsertItem::at(
        sequence,
        placement,
        new_match.fields(),
    ))];
    run_one_save(
        workspace,
        backups,
        OneSave {
            document,
            base_revision,
            content: SaveContent::Edits(&edits),
            acknowledgement,
            at: landed.as_ref(),
            reapply,
        },
    )
} // End of function create_one_match()

/// Plans and runs one deletion against an open workspace.
///
/// A free function for [`move_one_match`]'s reason. It addresses the item through
/// [`item_address`] — the move's own four gates, so a deletion and a relocation
/// cannot disagree about which snippets are addressable — and issues exactly one
/// [`RemoveItem`], which is that move's lift half in the core's own shared code.
///
/// # The address is resolved against the revision the caller sent, and that is the
/// point
///
/// A [`DocumentPath`] ending in an index is a **position**. The revision check
/// above is therefore not an optimisation of the transaction's own: it is what
/// stops a stale identity being turned into an index that still resolves — to a
/// different snippet. `delete_match_never_deletes_the_item_at_a_stale_ids_old_path`
/// is that claim as a test.
///
/// # Nothing is named afterwards
///
/// `at` is `None`, so [`after_a_save`] mints no identity. See
/// [`WorkspaceSession::delete_match`] for why a neighbour's is not offered
/// instead.
fn delete_one_match(
    workspace: &mut Workspace,
    backups: &BackupSession,
    id: MatchId,
    base_revision: ContentRevision,
    acknowledgement: &Acknowledgement,
) -> Result<SaveResult, CommandError> {
    // A stale identity is refused before it can be turned into an index that
    // still resolves — to a different snippet. See this function's own note above.
    let base = document_at(workspace, id.document, base_revision)?;
    let found = base.view.match_by_id(id)?;
    let (sequence, at) = item_address(found)?;
    // A deletion removes the item's whole ownership envelope, so a unique
    // trigger is not enough to identify what it would remove: exact item
    // correspondence, or nothing. It puts nothing anywhere, so it names no
    // anchor.
    let reapply = ReapplyRequest {
        subject: ReapplyMode::anchored(base, found, ReapplyConfidence::ExactItem),
        placement: PlacementMode::NotAnchored,
    };
    let edits = [DocumentEdit::RemoveItem(RemoveItem::new(
        sequence.with_index(at),
    ))];
    run_one_save(
        workspace,
        backups,
        OneSave {
            document: id.document,
            base_revision,
            content: SaveContent::Edits(&edits),
            acknowledgement,
            at: None,
            reapply,
        },
    )
} // End of function delete_one_match()

/// Plans and runs one duplication against an open workspace.
///
/// A free function for [`move_one_match`]'s reason, and it follows
/// [`delete_one_match`]'s identity discipline exactly: resolve the projection
/// through [`document_at`] first, address the held identity as a sequence item,
/// construct exactly one [`DuplicateItem`], and hand it to the shared tail.
///
/// # The landed address is the clone's, and the arithmetic is the primitive's
///
/// `at` is [`DuplicateItem::resulting_path`] — the source's path with its final
/// index one higher — so [`after_a_save`] mints [`SaveResult::Saved::moved`] as
/// the **clone's** identity in the fresh revision (consult Q8: the returned
/// identity is the only safe continuation, because a committed insertion makes
/// every identity in the file stale). Reading the arithmetic off the request
/// itself is what keeps this layer and the engine from holding two copies of
/// where the clone went; the `None` arm of that `Option` is a path that does
/// not end in an index, which [`item_address`] has already excluded, so the
/// `ok_or` below is defensive rather than reachable.
///
/// # The refusal is the duplicate's own code
///
/// [`item_address`] answers [`CommandError::MoveNotWithinOneSequence`], whose
/// name says *move*; the consult's Q5 forbids leaking it as a duplicate's
/// user-facing reason, so it is mapped to
/// [`CommandError::DuplicateSourceNotASequenceItem`] here — the same negative
/// claim, spelled for this operation. Every other refusal passes through
/// unchanged, because the identity codes mean the same thing for every command.
fn duplicate_one_match(
    workspace: &mut Workspace,
    backups: &BackupSession,
    id: MatchId,
    base_revision: ContentRevision,
    acknowledgement: &Acknowledgement,
) -> Result<SaveResult, CommandError> {
    // A stale identity is refused before it can be turned into an index that
    // still resolves — to a different snippet, whose bytes would then be copied.
    let base = document_at(workspace, id.document, base_revision)?;
    let found = base.view.match_by_id(id)?;
    let (sequence, from) = item_address(found).map_err(|error| match error {
        CommandError::MoveNotWithinOneSequence => CommandError::DuplicateSourceNotASequenceItem,
        other => other,
    })?;
    // A duplicate copies the item's owned bytes verbatim, so identifying it by
    // anything weaker than those bytes would be copying a snippet nobody
    // reviewed. The clone lands immediately after its source and there is no
    // placement to choose (2c-3c-1), so it names no anchor.
    let reapply = ReapplyRequest {
        subject: ReapplyMode::anchored(base, found, ReapplyConfidence::ExactItem),
        placement: PlacementMode::NotAnchored,
    };
    let edit = DuplicateItem::new(sequence.with_index(from));
    // Where the clone will be afterwards, from the engine's own arithmetic
    // rather than from a second copy of it (`DuplicateItem::resulting_path`).
    let landed = edit
        .resulting_path()
        .ok_or(CommandError::DuplicateSourceNotASequenceItem)?;
    let edits = [DocumentEdit::DuplicateItem(edit)];
    run_one_save(
        workspace,
        backups,
        OneSave {
            document: id.document,
            base_revision,
            content: SaveContent::Edits(&edits),
            acknowledgement,
            at: Some(&landed),
            reapply,
        },
    )
} // End of function duplicate_one_match()

/// Hands one whole replacement text to the save transaction.
///
/// A free function for [`move_one_match`]'s reason, and the shortest of the
/// five: there is nothing to plan. A replacement text **is** the request, so
/// this resolves no identity, derives no batch and computes no landing address —
/// it names the document, the revision the editor loaded and the bytes, and
/// takes the shared tail.
///
/// # It deliberately does **not** take [`document_at`]
///
/// Every other writing command refuses a stale `base_revision` before the
/// transaction, and the reason is written on [`document_at`]: each of them turns an
/// identity into a **position** in a particular parse, and a stale identity does
/// not name a missing entry — it names a different one, and succeeds. A
/// replacement turns nothing into a position. Its request is self-contained,
/// which leaves exactly one check worth taking and one place worth taking it:
/// the transaction's own, against the bytes **under the write lock**.
///
/// That is not a weaker answer, it is the only one that can be right. The design
/// consult's Q7 names the highest risk of this whole mode as *silently
/// overwriting changes made after the raw editor loaded the file*, and in that
/// scenario some other program wrote the file while this session was idle: the
/// session's cached projection still holds the revision the editor loaded, so a
/// pre-check against it would **pass**. Only the locked read can see it, and it
/// reports [`SaveResult::Conflict`], which carries the projection of what the
/// disk holds now — everything a raw editor needs to tell the user what
/// happened, and strictly more than the two hex strings a pre-check could offer.
///
/// # Its answer names nothing
///
/// `at` is `None`, so [`after_a_save`] mints no identity. Not a defensive
/// `None` and not a missing feature: a committed replacement invalidates **every**
/// [`MatchId`] in the file at once and has no distinguished match to answer with,
/// which is design-consult Q3's ruling and is permanent by construction.
fn save_one_raw_document(
    workspace: &mut Workspace,
    backups: &BackupSession,
    document: DocumentId,
    base_revision: ContentRevision,
    text: &str,
    acknowledgement: &Acknowledgement,
) -> Result<SaveResult, CommandError> {
    run_one_save(
        workspace,
        backups,
        OneSave {
            document,
            base_revision,
            content: SaveContent::ReplaceText(text),
            acknowledgement,
            at: None,
            // **Permanently, and not for want of an implementation.** A
            // replacement has no target, no field intent and no operation to
            // re-resolve, so the only things a reapply could mean are
            // overwriting the newly read disk text with a stale string or
            // inventing a text merge, and both are forbidden (design consult Q4
            // and Q5). It names no anchor either — a whole document is not
            // placed after anything — and that is `NotAnchored` rather than a
            // second copy of the sentence above.
            reapply: ReapplyRequest {
                subject: ReapplyMode::Unsupported,
                placement: PlacementMode::NotAnchored,
            },
        },
    )
} // End of function save_one_raw_document()

/// Describes the disk side of a conflict, with a read taken **after** the lock
/// was released.
///
/// [`save_document`] reports a stale base as `SaveError::RevisionMismatch` and
/// hands back **no bytes**, so the disk side has to be *described* by a second
/// observation — and that observation is a different one. `found` is the revision
/// the locked read saw, the bytes that refused the save;
/// [`SaveResult::Conflict::disk_revision`] is the revision of the fresh read this
/// function takes. They are usually equal and they need not be: when they differ,
/// the file changed **again** in between, and neither this application nor any
/// string it shows may present the two as descriptions of the same bytes.
///
/// **The one place in production the payload is built**, so the rule cannot be
/// half-kept by a later command: `disk`, `disk_revision`, `disk_text` and — since
/// Phase 2c-4b-1 — `reapply` all come out of a single refresh here, and `found`
/// is passed in from the error rather than re-derived. `reapply` is the one
/// operand whose *question* is older than this call: the anchors inside the
/// [`ReapplyRequest`] — the subject's and the placement's alike — were captured
/// from the snapshot the command validated its request against, and only the
/// **answers** are taken from the fresh read. Both answers come out of that one
/// read, in one [`reconcile`] call, so a move's subject and its destination can
/// never describe two observations. The refresh also leaves the session's cache describing the bytes
/// the next save will be checked against, which is why the read serves both
/// purposes. `crate::save::every_save_result` builds a **test-only** instance —
/// the wire-contract fixture — and it is named here so that "one site" is not read
/// as a claim about every occurrence of the variant in the crate.
///
/// # The text is paired with its revision by content-hash equality
///
/// Phase 2c-4a-1 adds [`SaveResult::Conflict::disk_text`], the whole file text a
/// conflict screen has to show, and the pairing it needs is that the text really
/// is the text of the read `disk_revision` names. [`Workspace::refresh`] answers
/// **one** `SourceDocument` carrying `.source`, `.revision` and `.view`, and all
/// three operands below are taken out of that one value. The alternative — a
/// second `document_text` call from the frontend, placed beside `disk_revision` on
/// screen — would prove nothing: a concurrent refresh between the two calls would
/// make a later text masquerade as the conflict snapshot, and the only argument
/// for it would be call ordering (design consult Q9 item 2).
///
/// **That snapshot is not always built by the read this call performs**, and the
/// honest statement of the guarantee is the stronger one. `refresh` hashes the
/// bytes it just read and, when that hash equals the revision the cached snapshot
/// already carries, keeps the cached snapshot and discards the string it read. So
/// `fresh.source` below may be an earlier read's text — of bytes a **content
/// hash** has this moment proved equal to what the disk holds. That equality is
/// what makes the text and the revision describe the same file; a
/// [`ContentRevision`] collision is what it does not exclude.
///
/// What none of that gives is a type that forbids a second construction site from
/// pairing them wrongly; `SaveResult::Conflict` is an ordinary struct variant and
/// Rust cannot tie one field to another. What holds the rule is that there is
/// exactly one production site, this one, and that the tests below rehash the text
/// they got back rather than restating the expression that produced it.
///
/// `disk_text` is a `String` rather than an `Option<String>` for the reason its own
/// documentation gives: [`Workspace::refresh`] reads through `read_utf8`, so a file
/// that is not valid UTF-8 fails the `?` below and no `Conflict` is built at all.
///
/// # Errors
///
/// The refresh's own failure, unchanged: a file that cannot be re-read has no
/// disk side to describe, and inventing one would be worse than refusing.
fn conflict_after_the_lock(
    workspace: &mut Workspace,
    document: DocumentId,
    expected: ContentRevision,
    found: ContentRevision,
    reapply: &ReapplyRequest,
) -> Result<SaveResult, CommandError> {
    let fresh = workspace.refresh(document)?;
    let disk_text = fresh.source.clone();
    // The fourth operand out of the same snapshot, and the reason it is computed
    // here rather than anywhere else: `reapply` carries anchors made *before*
    // the transaction, and this is the one moment the fresh snapshot exists as a
    // value. A later `get_document` would answer a read this payload never
    // described.
    let reapply = reconcile(reapply, fresh);
    let disk = Box::new(fresh.view.clone());
    Ok(SaveResult::Conflict {
        expected,
        found,
        disk_revision: disk.revision,
        disk_text,
        reapply,
        disk,
    })
} // End of function conflict_after_the_lock()

/// Brings the session's cache back in step with the file, and names the match
/// the operation acted on in the revision that now exists.
///
/// **Cache coherence is this layer's job**, and the core says so: `save_document`
/// hands back *facts* and deliberately does not reach into
/// [`Workspace`]. Without this, a `get_document`, `get_match` or `document_text`
/// after a successful save would be served the parse of the bytes the save
/// replaced.
///
/// The re-read is [`Workspace::refresh`], which reparses only when the bytes
/// changed. A read that fails leaves the entry **evicted** rather than stale: a
/// missing parse costs the next caller a read, and a stale one is this
/// application showing a file it no longer has.
///
/// # `at` is where the match is *afterwards*, and the two callers compute it
/// differently
///
/// That difference is the whole reason this function takes an address rather than
/// deriving one, and Phase 2b-2b-3's design consult
/// (`docs/reviews/phase-2b-2b-3-design.md`, Q2) settled which is which.
/// [`move_one_match`] passes its sequence path plus the landing index, because a
/// move **changes** the item's position and the identity has to be re-minted
/// wherever it landed. [`save_one_match`] passes the match's **own projected
/// path** unchanged, because a scalar save does not relocate anything — so it
/// must not be made to go through the sequence-item address, and a match this
/// projection cannot address as a sequence item is still perfectly editable.
///
/// `None` says *this operation has no single match to name*, and the only caller
/// that can produce it is a save of a match the projection carries no path for —
/// which [`plan_match_edits`] refuses first, so it is a defensive branch rather
/// than a reachable one. A whole-document write would be the honest producer of
/// it, and there is no such command yet.
///
/// # A committed save that cannot be re-resolved is still a success
///
/// [`SaveResult::Saved::moved`] is minted only when the commit happened **and**
/// the fresh read agrees with the revision the transaction established. When it
/// does not, some other writer reached the file in between and the address is no
/// longer known to hold what was written there. That is answered as `None` and
/// **never** as an `Err`: the bytes are already on the disk, and reporting a
/// failure for a save that succeeded invites a caller to retry a write that has
/// already happened.
///
/// A skipped commit is `None` for a different and equally deliberate reason: no
/// new revision exists, so there is no new identity to mint — and the caller's
/// own identity, minted from the revision the file still holds, is still valid.
fn after_a_save(
    workspace: &mut Workspace,
    document: DocumentId,
    at: Option<&DocumentPath>,
    saved: SavedDocument,
) -> SaveResult {
    // A flag rather than a clone of the fresh view: the borrow only has to end
    // before `evict`, and the answer taken out of it is one `MatchId`, while a
    // `DocumentView` owns every trigger and every `replace` body of the file.
    let mut lost = false;
    let moved = match workspace.refresh(document) {
        Ok(fresh) => at
            .filter(|_| saved.committed && fresh.view.revision == saved.revision)
            .and_then(|address| {
                fresh
                    .view
                    .matches
                    .iter()
                    .find(|candidate| candidate.path.as_ref() == Some(address))
                    .map(|candidate| candidate.id)
            }),
        Err(_) => {
            lost = true;
            None
        }
    }; // End of the match over the re-read that follows every save
    if lost {
        let _ = workspace.evict(document);
    }
    SaveResult::Saved {
        revision: saved.revision,
        committed: saved.committed,
        notes: saved.notes,
        backup_taken: saved.backup.is_some(),
        moved,
    }
} // End of function after_a_save()

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

/// Returns the whole text of one document (plan section 6.4).
///
/// Reads nothing from disk that [`get_document`] would not: the text comes from
/// the same cache entry, so asking for a projection and then for its bytes costs
/// one read and one parse between them.
#[tauri::command]
pub fn document_text(
    session: State<'_, WorkspaceSession>,
    id: DocumentId,
) -> Result<String, CommandError> {
    session.text(id)
}

/// Re-reads one document from disk (plan section 6.4).
#[tauri::command]
pub fn reload_document(
    session: State<'_, WorkspaceSession>,
    id: DocumentId,
) -> Result<DocumentView, CommandError> {
    session.reload(id)
}

/// Moves one match within its own sequence and saves the file (plan section
/// 6.4).
///
/// **The first command in this application that can write a user's file.**
///
/// # Its arguments, and why each is the shape it is
///
/// - `id` — the match to move, by identity. Not a path: a
///   [`espansoconfig_core::patch::DocumentPath`] is a **position**, and deleting
///   an earlier match re-points one at a different snippet.
/// - `after` — the match the moved one is written **after**, by identity, or
///   `null` for the front of the sequence. An identity rather than an index, for
///   the same reason, and rather than a path because a path on this wire is
///   display text: `crate::wire_contract` records that two distinct filenames can
///   render to one string, so **a command that accepts a wire path back as a
///   target is a bug**. Everything here is named by `DocumentId` and `NodeId`.
/// - `base_revision` — the optimistic-concurrency token. It is checked twice, and
///   neither check makes the other redundant: here against the parse this session
///   holds, and inside the transaction against the **bytes under the write lock**.
/// - `acknowledgement` — the suspicions the caller has already shown someone, by
///   content. There is deliberately **no `force` flag**: the findings travel out
///   of a refusal and the acknowledged subset travels back in, matched as an
///   exact multiset, and a boolean would let a caller wave past findings nobody
///   looked at.
///
/// # Errors
///
/// [`CommandError::NoWorkspaceOpen`], the identity codes, and
/// [`CommandError::MoveNotWithinOneSequence`] before anything is attempted;
/// [`CommandError::SaveFailed`] for the transaction's own typed failures. A
/// conflict and a refusal are **not** errors — see [`SaveResult`].
#[tauri::command]
pub fn move_match(
    session: State<'_, WorkspaceSession>,
    id: MatchId,
    after: Option<MatchId>,
    base_revision: ContentRevision,
    acknowledgement: Acknowledgement,
) -> Result<SaveResult, CommandError> {
    session.move_match(id, after, base_revision, &acknowledgement)
} // End of function move_match()

/// Writes one match's drafted values into its file (plan section 6.4).
///
/// **The eighth command, and the second that can write a user's file.**
///
/// # Its arguments, and why each is the shape it is
///
/// - `id` — the match to save, by identity, for the reason [`move_match`] gives:
///   a [`espansoconfig_core::patch::DocumentPath`] is a **position**, and deleting
///   an earlier match re-points one at a different snippet.
/// - `draft` — what the user wants this match to say, as a whole. Not a list of
///   changes: a [`MatchDraft`] is one intention, [`plan_match_edits`] derives the
///   **smallest** batch that realises it, and a field the draft leaves
///   [`espansoconfig_core::draft::DraftField::Unchanged`] contributes no edit and
///   so cannot rewrite bytes nobody touched. Everything below the match mapping
///   is addressed by **index** — a variable, a `params` entry, a `form_fields`
///   entry, one of its options — and never by a key the caller composed.
/// - `base_revision` — the optimistic-concurrency token, checked twice for
///   [`move_match`]'s reason and load-bearing here in a further one: a draft's
///   indices are positions in the projection it was built against, so a stale
///   token would let an index name a **different** entry rather than a missing
///   one. See [`WorkspaceSession::save_match`].
/// - `acknowledgement` — the suspicions the caller has already shown someone, by
///   content, exactly as for a move. There is deliberately **no `force` flag**.
///
/// # This command inserts nothing below the match mapping
///
/// A drafted variable, `params` entry, `form_fields` entry, option or sequence
/// element the projection cannot resolve is **refused by name**, never created
/// (`docs/decisions/2b-2b-2-notes.md` decision D1). Writing an author-chosen key
/// would be the first key string this engine emits that no schema fixes, and it
/// needs its own anchor machinery and its own review. Inserting a *schema-known
/// scalar key into the match's own mapping* is the one insertion that does
/// happen, and the closed-surface guard is what keeps that the only one.
///
/// # Errors
///
/// [`CommandError::NoWorkspaceOpen`] and the identity codes before anything is
/// attempted; [`CommandError::DraftRefused`] when the draft cannot be turned into
/// a batch, in which case **no transaction ran at all**; and
/// [`CommandError::SaveFailed`] for the transaction's own typed failures. A
/// conflict and a refusal are **not** errors — see [`SaveResult`]. Neither is a
/// save that changed nothing: that is a `Saved` with `committed: false`.
#[tauri::command]
pub fn save_match(
    session: State<'_, WorkspaceSession>,
    id: MatchId,
    draft: MatchDraft,
    base_revision: ContentRevision,
    acknowledgement: Acknowledgement,
) -> Result<SaveResult, CommandError> {
    session.save_match(id, &draft, base_revision, &acknowledgement)
} // End of function save_match()

/// Writes one new match into a document's `matches` list (plan section 6.4).
///
/// **The ninth command, and the third that can write a user's file.**
///
/// # Its arguments, and why each is the shape it is
///
/// - `document` — **the app's opaque identity**, not a wire path. A
///   [`espansoconfig_core::wire::WirePath`] renders lossily, so two distinct
///   filenames can arrive as one string; a command that accepted one back as a
///   target could write to the wrong file. This is the one mutating command whose
///   target is a document rather than a match, because the match it acts on does
///   not exist yet.
/// - `new_match` — a closed [`NewMatch`]: **two required and four optional
///   schema-known scalar fields**, `trigger` and `replace` mandatory and `label`,
///   `word`, `left_word` and `right_word` written only when they are present. An
///   absent optional field is a key the new snippet is not born holding, which is
///   a different request from one written with an empty value. Not a
///   [`MatchDraft`]: a draft can express twenty-two fields and four collections,
///   and creation synthesizes exactly one flat mapping of scalars, so taking one
///   would advertise a structure this command cannot spell. Not a list of
///   key/value pairs either — `docs/decisions/2b-2b-2-notes.md` decision D1
///   forbids this engine emitting a key no schema fixes.
/// - `position` — [`NewMatchPosition`], three-valued, naming its anchor by
///   **identity**. An index would be a position in a parse the caller may no
///   longer hold, which is the mistake `move_match` avoids the same way.
/// - `base_revision` — the optimistic-concurrency token, checked twice for
///   [`move_match`]'s reason and load-bearing here in the same one as a move's:
///   the anchor is resolved against this session's projection.
/// - `acknowledgement` — the suspicions the caller has already shown someone, by
///   content. There is deliberately **no `force` flag**.
///
/// # Errors
///
/// [`CommandError::NoWorkspaceOpen`], the identity codes,
/// [`CommandError::MoveNotWithinOneSequence`] for an anchor that is not an item
/// of this list, and [`CommandError::DocumentHasNoMatchList`] for a file that
/// does not name `matches` at all — all before anything is attempted;
/// [`CommandError::SaveFailed`] for the transaction's own typed failures, which
/// is where every refusal the insertion primitive makes arrives. A conflict and a
/// refusal are **not** errors — see [`SaveResult`].
#[tauri::command]
pub fn create_match(
    session: State<'_, WorkspaceSession>,
    document: DocumentId,
    new_match: NewMatch,
    position: NewMatchPosition,
    base_revision: ContentRevision,
    acknowledgement: Acknowledgement,
) -> Result<SaveResult, CommandError> {
    session.create_match(
        document,
        &new_match,
        &position,
        base_revision,
        &acknowledgement,
    )
} // End of function create_match()

/// Deletes one match from its file (plan section 6.4).
///
/// **The tenth command, and the fourth that can write a user's file.**
///
/// # Its arguments
///
/// `id`, `base_revision` and `acknowledgement`, and nothing else: a deletion has
/// no destination and no content. The identity is the match to delete, for
/// [`move_match`]'s reason — a
/// [`espansoconfig_core::patch::DocumentPath`] is a **position**, and deleting an
/// earlier match re-points one at a different snippet, which is precisely the
/// mistake this command could make most expensively.
///
/// # It answers with no identity, and that is the correct answer
///
/// [`SaveResult::Saved::moved`] is `None` after a successful deletion. The match
/// that was deleted has no identity in the new revision, and a neighbour's is not
/// offered in its place: `moved` means *the new identity of the match acted
/// upon*, and filling it with whatever a window might select next would make a
/// field that exists to replace positional identity carry one. The caller
/// re-reads the document.
///
/// # Errors
///
/// [`CommandError::NoWorkspaceOpen`] and the identity codes before anything is
/// attempted; [`CommandError::SaveFailed`] for the transaction's own typed
/// failures — including **deleting the only snippet of a file**, which the engine
/// refuses by name rather than turning the list into `[]` or into YAML null. A
/// conflict and a refusal are **not** errors.
#[tauri::command]
pub fn delete_match(
    session: State<'_, WorkspaceSession>,
    id: MatchId,
    base_revision: ContentRevision,
    acknowledgement: Acknowledgement,
) -> Result<SaveResult, CommandError> {
    session.delete_match(id, base_revision, &acknowledgement)
} // End of function delete_match()

/// Replaces one document's whole text with the text supplied (plan section 6.4).
///
/// **The eleventh command, the fifth that can write a user's file, and the last
/// of Phase 2b-2c.** With it, every command Phase 2b was scoped to deliver
/// exists.
///
/// # Its arguments, and why each is the shape it is
///
/// - `document` — **the app's opaque identity**, not a wire path, for
///   [`create_match`]'s reason: a
///   [`espansoconfig_core::wire::WirePath`] renders lossily, so two distinct
///   filenames can arrive as one string and a command that accepted one back as a
///   target could write to the wrong file. It is a document rather than a match
///   because a whole text has no match in it to name.
/// - `base_revision` — the optimistic-concurrency token, and here it is the
///   **only** thing standing between a raw editor and the file some other program
///   changed while it was open. Unlike the four commands before it this one takes
///   no pre-check against the session's projection, because a replacement
///   addresses nothing positionally; the check that matters is the transaction's,
///   taken under the write lock. See [`save_one_raw_document`].
/// - `text` — the document's whole new text, committed byte for byte. Not a
///   patch and not a diff: this command is the one place in the application whose
///   promise is *these exact bytes*, and it keeps that promise by not touching
///   them.
/// - `acknowledgement` — the suspicions the caller has already shown someone, by
///   content, exactly as for the other four. There is deliberately **no `force`
///   flag**, and it is load-bearing here in a way it is nowhere else: a candidate
///   the YAML parser rejects is *written*, and this is the machinery that makes
///   that safe. The application does not refuse it and does not write it silently
///   either — it reports `DocumentDoesNotParse` and the user confirms by content.
///
/// # It replaces the whole document, and a caller must say so
///
/// The mode's promise is the exact submitted UTF-8 bytes and nothing more: no
/// parser formatting, no newline normalization, no BOM added or removed, no final
/// newline supplied, no re-indentation. **It carries none of the locality
/// guarantee the other four keep**, and no string built on this command may
/// present it as an edit (design consult Q8).
///
/// # Every identity in that file is stale afterwards
///
/// [`SaveResult::Saved::moved`] is `None`, permanently: a committed replacement
/// invalidates every [`MatchId`] in the document at once and has no single match
/// to answer with (design consult Q3). On `committed: false` nothing became
/// stale. The frontend wrapper in `src/lib/ipc/commands.ts` takes the reload as a
/// **mandatory argument** so that obligation cannot be dropped by a caller that
/// simply forgets it.
///
/// # Errors
///
/// [`CommandError::NoWorkspaceOpen`] and the workspace's own refusal for an
/// unknown document before anything is attempted;
/// [`CommandError::SaveFailed`] for the transaction's own typed failures. A
/// conflict and a refusal are **not** errors — see [`SaveResult`] — and neither
/// is a text identical to what the file already holds: that is a `Saved` with
/// `committed: false`.
#[tauri::command]
pub fn save_raw_document(
    session: State<'_, WorkspaceSession>,
    document: DocumentId,
    base_revision: ContentRevision,
    text: String,
    acknowledgement: Acknowledgement,
) -> Result<SaveResult, CommandError> {
    session.save_raw_document(document, base_revision, &text, &acknowledgement)
} // End of function save_raw_document()

/// Inserts a byte-exact copy of one match immediately after it, and saves the
/// file (plan section 6.4).
///
/// **The twelfth command, and the sixth that can write a user's file.**
///
/// # Its arguments, and why each is the shape it is
///
/// - `id` — the snippet to duplicate, by identity, for [`move_match`]'s reason:
///   a [`espansoconfig_core::patch::DocumentPath`] is a **position**, and
///   deleting an earlier match re-points one at a different snippet — whose
///   bytes this command would then copy.
/// - `base_revision` — the optimistic-concurrency token, checked twice as every
///   writing command checks it: here against the parse this session holds, and
///   inside the transaction against the bytes under the write lock.
/// - `acknowledgement` — the suspicions the caller has already shown someone,
///   by content, and it is load-bearing on this command's ordinary path: a
///   duplicate keeps its source's trigger definition byte for byte, so the
///   first attempt is refused with
///   [`espansoconfig_core::validate::FindingCode::DuplicateKeepsTriggerDefinition`]
///   — which carries the candidate's own revision, so consent for one clone
///   cannot be spent on another — and the same call with that exact finding
///   acknowledged commits. There is deliberately **no `force` flag**.
///
/// There is no destination argument at all: the clone lands immediately after
/// its source, in the same sequence, by design (consult Q4).
///
/// # Errors
///
/// [`CommandError::NoWorkspaceOpen`], the identity codes, and
/// [`CommandError::DuplicateSourceNotASequenceItem`] before anything is
/// attempted; [`CommandError::SaveFailed`] for the transaction's own typed
/// failures. A conflict and a refusal are **not** errors — see [`SaveResult`].
#[tauri::command]
pub fn duplicate_match(
    session: State<'_, WorkspaceSession>,
    id: MatchId,
    base_revision: ContentRevision,
    acknowledgement: Acknowledgement,
) -> Result<SaveResult, CommandError> {
    session.duplicate_match(id, base_revision, &acknowledgement)
} // End of function duplicate_match()

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use espansoconfig_core::draft::{DraftField, ItemDraft, MatchDraft, NewMatch};
    use espansoconfig_core::model::{DocumentView, MatchId};
    use espansoconfig_core::patch::PresentationNote;
    use espansoconfig_core::persist::{Acknowledgement, SaveVerdict};
    use espansoconfig_core::reconcile::{
        ReapplyEvidence, ReapplyPlacement, ReapplyRefusal, ReapplyResolution,
    };
    use espansoconfig_core::validate::FindingCode;
    use espansoconfig_core::{ContentRevision, DocumentId, NodeId, SyntaxIndex};
    use tempfile::TempDir;

    use super::{NewMatchPosition, WorkspaceSession};
    use crate::save::SaveResult;

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

    /// A tree whose one match file holds `source`.
    fn tree_holding(source: &str) -> TempDir {
        let dir = TempDir::new().expect("temp dir");
        fs::create_dir_all(dir.path().join("match")).unwrap();
        fs::write(dir.path().join("match").join("base.yml"), source).unwrap();
        dir
    }

    /// The bytes of `<root>/match/base.yml`.
    fn base_bytes(dir: &TempDir) -> String {
        fs::read_to_string(dir.path().join("match").join("base.yml")).expect("the file reads back")
    }

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

    /// Everything a one-file editing test starts from.
    ///
    /// Four values that always travel together, and none of them borrows another:
    /// [`WorkspaceSession::document`] answers an **owned** [`DocumentView`], so a
    /// helper can hand back the projection alongside the session it came from.
    /// The temporary directory is here because it must outlive the session — a
    /// `TempDir` deletes its tree when it drops.
    struct Opened {
        /// The tree, kept alive for as long as the test needs the files.
        dir: TempDir,
        /// A session with that tree open.
        session: WorkspaceSession,
        /// The identity of `match/base.yml`.
        id: DocumentId,
        /// That document's projection, read once before anything is written.
        before: DocumentView,
    }

    /// A tree holding `source`, opened, with its one file already projected.
    ///
    /// The four lines every editing test below opened with. They are together
    /// here because they are one step — *"a file that says this, ready to be
    /// edited"* — and spelling it out thirteen times taught the shape of the
    /// fixture rather than the claim under test.
    fn opened_on(source: &str) -> Opened {
        let dir = tree_holding(source);
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        Opened {
            dir,
            session,
            id,
            before,
        }
    } // End of function opened_on()

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

    /// Every session method that needs a workspace refuses before one is open.
    ///
    /// "Every" is the claim, so the body holds every one of them: `documents`,
    /// `document`, `text`, `reload` and `match_view` — the five that route
    /// through [`WorkspaceSession::with_workspace`] — and the six that write,
    /// which take the guard themselves. `open` is excluded because it is the
    /// method that opens one, and `set_menu_labels` is not a workspace command at
    /// all.
    ///
    /// `text` was missing until the review of Phase 1c-2b-2a found the name
    /// outrunning the body. The defect it exists to catch is a method that
    /// opens a workspace implicitly, or answers an empty string for a document
    /// no workspace holds; on a screen an empty string is indistinguishable
    /// from an empty file.
    #[test]
    fn every_command_refuses_before_a_workspace_is_open() {
        let session = WorkspaceSession::new();
        let id = DocumentId(0);
        let identity = MatchId {
            document: id,
            revision: ContentRevision::of_bytes(b""),
            node: first_node_of("a: b"),
        };
        let refusals = [
            session.documents().err().map(|error| error.code()),
            session.document(id).err().map(|error| error.code()),
            session.text(id).err().map(|error| error.code()),
            session.reload(id).err().map(|error| error.code()),
            session.match_view(identity).err().map(|error| error.code()),
            session
                .move_match(
                    identity,
                    None,
                    ContentRevision::of_bytes(b""),
                    &Acknowledgement::none(),
                )
                .err()
                .map(|error| error.code()),
            session
                .create_match(
                    id,
                    &NewMatch {
                        trigger: ":one".to_owned(),
                        replace: "first".to_owned(),
                        label: None,
                        word: None,
                        left_word: None,
                        right_word: None,
                    },
                    &NewMatchPosition::End {},
                    ContentRevision::of_bytes(b""),
                    &Acknowledgement::none(),
                )
                .err()
                .map(|error| error.code()),
            session
                .delete_match(
                    identity,
                    ContentRevision::of_bytes(b""),
                    &Acknowledgement::none(),
                )
                .err()
                .map(|error| error.code()),
            session
                .save_match(
                    identity,
                    &MatchDraft::default(),
                    ContentRevision::of_bytes(b""),
                    &Acknowledgement::none(),
                )
                .err()
                .map(|error| error.code()),
            session
                .save_raw_document(
                    id,
                    ContentRevision::of_bytes(b""),
                    "matches: []\n",
                    &Acknowledgement::none(),
                )
                .err()
                .map(|error| error.code()),
            session
                .duplicate_match(
                    identity,
                    ContentRevision::of_bytes(b""),
                    &Acknowledgement::none(),
                )
                .err()
                .map(|error| error.code()),
        ];
        assert_eq!(
            refusals,
            [Some("noWorkspaceOpen"); 11],
            "every session method that needs a workspace must refuse before one is open"
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

    /// Every byte of a file survives the command and its serialization.
    ///
    /// The hand-written half of the fidelity evidence, and it is deliberately
    /// hostile: the source below carries a leading UTF-8 BOM, a CRLF line
    /// ending among bare LFs, a precomposed and a decomposed `é`, an astral
    /// character, a block scalar whose last line ends in two real spaces, and no
    /// final newline — the six properties the byte-exact corpus fixtures pin,
    /// gathered into one document so that a single normalisation anywhere on the
    /// path fails here.
    ///
    /// It carries **three more that no fixture holds**: a NUL, and the two
    /// Unicode line separators U+2028 and U+2029. All three are valid UTF-8 and
    /// valid content for a Rust `String` and a JavaScript string, and they are
    /// exactly where the two encoders on this path disagree — `serde_json`
    /// escapes NUL as a six-character escape and leaves U+2028/U+2029 as raw
    /// bytes, which is legal JSON and was for years illegal inside a JavaScript
    /// source string literal. That
    /// they are hand-written rather than pinned by a fixture is an R20 deviation
    /// and is recorded as such (`docs/decisions/1c-2b-2a-notes.md` section 9).
    ///
    /// The characters are written as `\u{…}` escapes on purpose. A literal `é`
    /// in this file could be normalised by an editor into agreeing with a
    /// normalising boundary; an escape cannot.
    ///
    /// The `serde_json` round trip is asserted separately from the command's
    /// own answer, because they can fail independently: the command could hand
    /// back the right `String` and the encoding could still lose a byte, which
    /// is exactly the failure a caller would see and a direct call would not.
    /// `dispatch_check.rs` closes the remaining gap by driving the real
    /// dispatcher over the corpus itself.
    #[test]
    fn document_text_hands_back_the_file_byte_for_byte() {
        const HOSTILE: &str = concat!(
            "\u{feff}",
            "matches:\r\n",
            "  - trigger: ':caf\u{e9}'\n",
            "    replace: 'cafe\u{301} \u{1f600}'\n",
            "  - trigger: ':controls'\n",
            "    replace: \"nul\u{0} ls\u{2028} ps\u{2029}\"\n",
            "  - trigger: ':block'\n",
            "    replace: |\n",
            "      two real spaces end this line  "
        );
        let dir = TempDir::new().expect("temp dir");
        fs::create_dir_all(dir.path().join("match")).unwrap();
        fs::write(dir.path().join("match").join("hostile.yml"), HOSTILE).unwrap();
        let session = open_session(&dir);
        let id = id_of(&session, "match/hostile.yml");

        let text = session.text(id).expect("the file reads");
        assert_eq!(
            text.as_bytes(),
            HOSTILE.as_bytes(),
            "the command must answer the file's bytes"
        );

        // Each property named, so that a failure says which one was lost rather
        // than only that something was.
        assert!(text.starts_with('\u{feff}'), "the BOM was stripped");
        assert_eq!(text.matches("\r\n").count(), 1, "the CRLF was converted");
        assert!(text.contains('\u{e9}'), "the precomposed e-acute was lost");
        assert!(
            text.contains("\u{65}\u{301}"),
            "the decomposed e-acute was composed"
        );
        assert!(text.contains('\u{1f600}'), "the astral character was lost");
        assert!(text.ends_with("  "), "the terminal spaces were trimmed");
        assert!(!text.ends_with('\n'), "a final newline was added");
        // The three no corpus fixture holds.
        assert!(
            text.contains('\u{0}'),
            "the NUL was dropped or terminated the string"
        );
        assert!(
            text.contains('\u{2028}'),
            "the line separator U+2028 was lost"
        );
        assert!(
            text.contains('\u{2029}'),
            "the paragraph separator U+2029 was lost"
        );

        // …and the encoding the wire actually uses, which is a second place the
        // same bytes could be lost.
        let encoded = serde_json::to_string(&text).expect("a string serializes");
        let decoded: String = serde_json::from_str(&encoded).expect("and deserializes");
        assert_eq!(decoded.as_bytes(), HOSTILE.as_bytes());
    } // End of function document_text_hands_back_the_file_byte_for_byte()

    /// The bytes come back even when the projection refused them.
    #[test]
    fn document_text_answers_a_document_that_did_not_parse() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/broken.yml");
        assert!(
            !session.document(id).expect("the file reads").parsed,
            "this fixture must not parse, or the test proves nothing"
        );
        assert_eq!(
            session.text(id).expect("the bytes read"),
            "matches:\n  - trigger: ':unclosed\n"
        );
    } // End of function document_text_answers_a_document_that_did_not_parse()

    /// An unmodelled entry's value crosses as the exact bytes of its span.
    ///
    /// The other half of Phase 1c-2b-2a's wire widening, checked at this layer
    /// too: the slice is taken in the core, and what this pins is that nothing
    /// between the core and the wire re-encodes it. The oracle is the span
    /// applied to the file's own bytes, which is a different expression from the
    /// one the projection evaluates.
    #[test]
    fn an_unmodelled_entrys_value_text_is_the_bytes_its_span_names() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let view = session.document(id).expect("the file reads");
        let entries: Vec<_> = view
            .matches
            .iter()
            .flat_map(|match_view| match_view.unknown_entries.iter())
            .collect();
        assert_eq!(
            entries.len(),
            1,
            "the synthetic tree has exactly one unrecognised key"
        );
        let entry = entries[0];
        let span = entry.value_span;
        assert_eq!(
            entry.value_text,
            BASE_YML[span.start..span.end],
            "the value text must be the slice its span names"
        );
        assert_eq!(entry.value_text, "yes");
        let json = serde_json::to_value(entry).expect("an entry serializes");
        assert_eq!(json["value_text"], "yes");
    } // End of function an_unmodelled_entrys_value_text_is_the_bytes_its_span_names()

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

    // -----------------------------------------------------------------------
    // Phase 2b-2a — the one command that writes
    // -----------------------------------------------------------------------

    /// A file whose second match holds an unresolved `{{reference}}`.
    ///
    /// Hand-authored and neutral. The reference is what makes the semantic gate
    /// report a `SuspiciousButPermitted` finding, which is the only way to reach
    /// the refusal-then-acknowledgement path from a command.
    const SUSPICIOUS_YML: &str = concat!(
        "matches:\n",
        "  - trigger: ':one'\n",
        "    replace: first\n",
        "  - trigger: ':two'\n",
        "    replace: 'hello {{who}}'\n",
    );

    /// A tree whose one match file is [`SUSPICIOUS_YML`].
    fn suspicious_tree() -> TempDir {
        tree_holding(SUSPICIOUS_YML)
    }

    /// The triggers of a document's matches, in projection order.
    fn triggers_of(view: &espansoconfig_core::model::DocumentView) -> Vec<String> {
        view.matches
            .iter()
            .map(|found| trigger_text(found).to_owned())
            .collect()
    }

    /// The `Saved` arm, or a panic naming what arrived instead.
    ///
    /// Answers the revision and the identity the command minted, and asserts on
    /// the way past what **every** committing save of these tests shares: it
    /// committed, it took a backup, and it changed no value's spelling. `what`
    /// names the operation, so a failure says which kind of save broke the shared
    /// claim rather than only that one did.
    ///
    /// A save that deliberately does **not** commit, or that owes a presentation
    /// note, states its own three answers at its call site: they are the claim
    /// under test there, not a shared background fact.
    fn expect_saved(
        result: SaveResult,
        what: &str,
    ) -> (espansoconfig_core::ContentRevision, Option<MatchId>) {
        match result {
            SaveResult::Saved {
                revision,
                committed,
                notes,
                backup_taken,
                moved,
            } => {
                assert!(committed, "a {what} always changes the file's bytes");
                assert!(
                    notes.is_empty(),
                    "a {what} needs no presentation change: {notes:?}"
                );
                assert!(backup_taken, "the session must have copied the file first");
                (revision, moved)
            }
            other => panic!("expected a saved result, got {other:?}"),
        }
    } // End of function expect_saved()

    /// A move puts the item where it was asked to, and the identity it answers
    /// with resolves.
    ///
    /// **The whole point of the returned identity.** A commit invalidates every
    /// `MatchId` the caller holds, so this asserts both halves: the one that was
    /// passed in is refused afterwards with `identityStaleRevision`, and the one
    /// that came back resolves through `get_match` to the snippet that moved.
    #[test]
    fn a_move_answers_with_an_identity_that_resolves_in_the_new_revision() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        assert_eq!(triggers_of(&before), [":one", ":two"]);
        let held = before.matches[1].id;

        let result = session
            .move_match(held, None, before.revision, &Acknowledgement::none())
            .expect("the move is legal");
        let (revision, moved) = expect_saved(result, "move");
        assert_ne!(revision, before.revision, "the file was rewritten");

        let moved = moved.expect("a committed move names the item it moved");
        let found = session
            .match_view(moved)
            .expect("the identity the command answered with must resolve");
        assert_eq!(trigger_text(&found), ":two");
        assert_eq!(
            found.id, moved,
            "the projection agrees the identity is its own"
        );

        let stale = session
            .match_view(held)
            .expect_err("the identity held before the save is minted from the old revision");
        assert_eq!(stale.code(), "identityStaleRevision");
    } // End of function a_move_answers_with_an_identity_that_resolves_in_the_new_revision()

    /// The bytes on disk really moved, and the session's cache says so without a
    /// reload.
    ///
    /// **Cache coherence, from both surfaces that could serve a stale parse.**
    /// `get_document` and `document_text` are asked *after* the move and *before*
    /// any `reload_document`; a command layer that left the cache alone would
    /// answer both with the file as it was, which on a screen is indistinguishable
    /// from a move that did not happen.
    #[test]
    fn a_committed_move_leaves_the_session_reading_the_new_bytes() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        let text_before = session.text(id).expect("the bytes read");
        let held = before.matches[1].id;

        session
            .move_match(held, None, before.revision, &Acknowledgement::none())
            .expect("the move is legal");

        let after = session.document(id).expect("the file still reads");
        assert_eq!(
            triggers_of(&after),
            [":two", ":one"],
            "the projection served from the cache must be the one that was written"
        );
        let text_after = session.text(id).expect("the bytes read");
        assert_ne!(text_after, text_before);
        assert_eq!(
            text_after,
            fs::read_to_string(dir.path().join("match").join("base.yml")).unwrap(),
            "what the session serves must be what is on disk"
        );
        assert_eq!(
            after.revision,
            espansoconfig_core::ContentRevision::of_bytes(text_after.as_bytes())
        );
    } // End of function a_committed_move_leaves_the_session_reading_the_new_bytes()

    /// A block-sequence document split into everything above its items and the
    /// items themselves.
    ///
    /// An item is its own `- ` line plus every line under it until the next item
    /// begins, which for a two-space block sequence of mappings is exactly the
    /// envelope a move relocates. Splitting a document this way and putting the
    /// pieces back in another order is *the move*, spelled without the engine that
    /// performs it — which is what lets a test state the expected bytes rather than
    /// restate whatever came out.
    ///
    /// It reads the source with `split_inclusive`, so every line keeps its own
    /// terminator and a document with no final newline reassembles unchanged.
    /// The answer is everything above the first item, then one string per item.
    fn split_into_items(source: &str) -> (String, Vec<String>) {
        let mut head = String::new();
        let mut items: Vec<String> = Vec::new();
        for line in source.split_inclusive('\n') {
            if line.starts_with("  - ") {
                items.push(line.to_owned());
            } else if let Some(current) = items.last_mut() {
                current.push_str(line);
            } else {
                head.push_str(line);
            }
        } // End of the loop over the document's lines
        (head, items)
    } // End of function split_into_items()

    /// Everything the move did not touch comes out byte-identical.
    ///
    /// CLAUDE.md section 3, checked at this layer rather than assumed from the
    /// core's own sweeps — and checked **as bytes**, which is the review of Phase
    /// 2b-2a's Low finding. The earlier version of this test counted triggers,
    /// counted the unmodelled key, looked at the first line and compared the file's
    /// length, all of which a command that rewrote `replace: first` to another
    /// value of the same length would have passed. The expectation is now derived
    /// from the pre-move text and the move itself: the two item envelopes, put back
    /// in the other order under the same head, and compared to the file on disk
    /// byte for byte.
    #[test]
    fn a_move_leaves_the_bytes_it_did_not_move_alone() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        let held = before.matches[1].id;

        // The move, performed on the text rather than on the file: the second
        // envelope first, then the first, under the head neither of them owns.
        let (head, items) = split_into_items(BASE_YML);
        assert_eq!(
            items.len(),
            2,
            "the fixture is two items or this proves little"
        );
        assert_eq!(
            format!("{head}{}{}", items[0], items[1]),
            BASE_YML,
            "the split must be lossless, or the expectation below is not the file"
        );
        let expected = format!("{head}{}{}", items[1], items[0]);
        assert_ne!(
            expected, BASE_YML,
            "the fixture must exercise a move that changes the bytes"
        );

        session
            .move_match(held, None, before.revision, &Acknowledgement::none())
            .expect("the move is legal");

        let on_disk = fs::read_to_string(dir.path().join("match").join("base.yml"))
            .expect("the file reads back");
        assert_eq!(
            on_disk, expected,
            "every byte outside the moved item must be exactly what it was"
        );
        // And what the session serves is those same bytes, so the assertion is
        // about the file rather than about one reader of it.
        assert_eq!(session.text(id).expect("the bytes read"), expected);
    } // End of function a_move_leaves_the_bytes_it_did_not_move_alone()

    /// A move after a named anchor lands after that anchor.
    ///
    /// The `to_front` case is covered above; this is the other constructor, and it
    /// is the one whose destination index has to be derived from an identity
    /// rather than sent as a number.
    #[test]
    fn a_move_after_an_anchor_lands_after_that_anchor() {
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
        let first = before.matches[0].id;
        let last = before.matches[2].id;

        let (_, moved) = expect_saved(
            session
                .move_match(first, Some(last), before.revision, &Acknowledgement::none())
                .expect("the move is legal"),
            "move",
        );

        let after = session.document(id).expect("the file still reads");
        assert_eq!(triggers_of(&after), [":two", ":three", ":one"]);
        let moved = moved.expect("a committed move names the item it moved");
        assert_eq!(
            trigger_text(&session.match_view(moved).expect("it resolves")),
            ":one",
            "the answered identity must be the moved snippet, not the one at its old position"
        );
    } // End of function a_move_after_an_anchor_lands_after_that_anchor()

    /// A destination in another file is refused before anything is attempted.
    ///
    /// `PROGRESS.md` D2r: `ItemMove` is same-sequence only, and a move never
    /// crosses a file. The refusal has to be **typed and early** — the assertion
    /// that the file is byte-identical afterwards is what says "not attempted"
    /// rather than "attempted and rolled back", which no filesystem could offer.
    #[test]
    fn a_destination_in_another_document_is_refused_and_writes_nothing() {
        let dir = TempDir::new().expect("temp dir");
        fs::create_dir_all(dir.path().join("match")).unwrap();
        fs::write(dir.path().join("match").join("base.yml"), BASE_YML).unwrap();
        fs::write(
            dir.path().join("match").join("other.yml"),
            "matches:\n  - trigger: ':elsewhere'\n    replace: elsewhere\n",
        )
        .unwrap();
        let session = open_session(&dir);
        let here = id_of(&session, "match/base.yml");
        let there = id_of(&session, "match/other.yml");
        let mine = session.document(here).expect("the file reads");
        let theirs = session.document(there).expect("the file reads");

        let error = session
            .move_match(
                mine.matches[0].id,
                Some(theirs.matches[0].id),
                mine.revision,
                &Acknowledgement::none(),
            )
            .expect_err("a move never crosses a file");
        assert_eq!(error.code(), "identityWrongDocument");

        assert_eq!(
            fs::read_to_string(dir.path().join("match").join("base.yml")).unwrap(),
            BASE_YML,
            "a refused move must not have written anything"
        );
        assert_eq!(
            session.document(here).expect("the file reads").revision,
            mine.revision,
            "and must not have disturbed the cache"
        );
    } // End of function a_destination_in_another_document_is_refused_and_writes_nothing()

    /// A base revision that is not this session's parse is refused before the
    /// lock is taken.
    ///
    /// The projection's own paths are **positions in that parse**, so planning a
    /// move against a base the session does not hold would move whatever now
    /// occupies the position. Distinguished from the conflict below, which is
    /// about the *disk* rather than about the cache.
    #[test]
    fn a_base_revision_that_is_not_the_sessions_parse_is_refused() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let view = session.document(id).expect("the file reads");
        let error = session
            .move_match(
                view.matches[1].id,
                None,
                espansoconfig_core::ContentRevision::of_bytes(b"not this file"),
                &Acknowledgement::none(),
            )
            .expect_err("a base the session does not hold is refused");
        assert_eq!(error.code(), "identityStaleRevision");
    } // End of function a_base_revision_that_is_not_the_sessions_parse_is_refused()

    /// A file replaced under the session's feet answers with the conflict arm.
    ///
    /// **What this pins, and what it deliberately cannot.** One external writer
    /// replaces the file, the save refuses, and the payload describes the disk:
    /// `expected` is the base the caller sent, `found` and `disk_revision` are both
    /// the replacement's, and the session is left reading the other writer's bytes
    /// rather than its own stale parse.
    ///
    /// It does **not** discriminate the honesty rule, and the review of Phase
    /// 2b-2a is why that is written here rather than claimed away: nothing writes
    /// between the refusal and the refresh in this fixture, so `found` and
    /// `disk_revision` are equal and an implementation that set one from the other
    /// would pass. The interleaving that tells them apart is not reachable through
    /// `move_match` — both observations happen inside one synchronous call — so it
    /// is pinned one level down, against the function that builds the payload, in
    /// `a_conflict_describes_the_refusing_read_and_the_fresh_read_separately`.
    #[test]
    fn a_file_replaced_under_the_session_answers_with_a_conflict() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        let held = before.matches[1].id;

        // Another writer — vim, espanso, a sync agent — replaces the file after
        // this session parsed it and before the save runs.
        const REPLACED: &str = concat!(
            "matches:\n",
            "  - trigger: ':one'\n",
            "    replace: rewritten by somebody else\n",
            "  - trigger: ':two'\n",
            "    replace: second\n",
        );
        fs::write(dir.path().join("match").join("base.yml"), REPLACED).unwrap();

        let result = session
            .move_match(held, None, before.revision, &Acknowledgement::none())
            .expect("a conflict is an outcome, not a failure");
        let replaced = espansoconfig_core::ContentRevision::of_bytes(REPLACED.as_bytes());
        match result {
            SaveResult::Conflict {
                expected,
                found,
                disk_revision,
                disk_text,
                reapply,
                disk,
            } => {
                assert_eq!(expected, before.revision, "the base the caller sent");
                assert_eq!(found, replaced, "the bytes that refused the save");
                assert_eq!(disk_revision, replaced, "the fresh read taken afterwards");
                assert_eq!(disk.revision, disk_revision);
                // Phase 2c-4b-1's operand, end to end. The held snippet lost a
                // key in the replacement, so its ownership envelope is not the
                // one the anchor recorded — and a move acts on that envelope, so
                // nothing weaker may identify it. The trigger is still unique and
                // unchanged, which is exactly what an editor's weaker tier would
                // have used and a move may not. The move was sent to the top, so
                // it named no anchor and its second operand says so.
                assert_eq!(
                    reapply,
                    espansoconfig_core::reconcile::ReapplyEvidence {
                        subject: espansoconfig_core::reconcile::ReapplyResolution::Refused {
                            reason:
                                espansoconfig_core::reconcile::ReapplyRefusal::NoExactCorrespondence
                        },
                        placement: espansoconfig_core::reconcile::ReapplyPlacement::NotAnchored {},
                    },
                    "a move may not identify a snippet whose bytes changed"
                );
                assert_eq!(
                    disk.matches.len(),
                    2,
                    "the disk side is a projection of the fresh read"
                );
                assert_eq!(
                    disk_text, REPLACED,
                    "the disk side's text is the whole file the fresh read saw"
                );
            }
            other => panic!("expected a conflict, got {other:?}"),
        }

        assert_eq!(
            fs::read_to_string(dir.path().join("match").join("base.yml")).unwrap(),
            REPLACED,
            "a conflict must leave the other writer's bytes alone"
        );
        assert_eq!(
            session.document(id).expect("the file reads").revision,
            replaced,
            "and must leave the session reading them"
        );
    } // End of function a_file_replaced_under_the_session_answers_with_a_conflict()

    /// A conflict's two revisions really are two observations, and the payload
    /// says which is which.
    ///
    /// **The honesty rule, discriminated.** The test above cannot do it: `found`
    /// comes from a read taken under the write lock and `disk_revision` from a read
    /// taken after it was released, both inside one synchronous `move_match`, so no
    /// caller of that command can put a writer between them. What *is* reachable is
    /// the function that builds the payload — and feeding it the `found` a real
    /// refusal produced, against a disk that has since moved on again, is exactly
    /// the interleaving, with nothing invented: the refusal below is a real one,
    /// driven through `move_match`, and its `found` is carried across untouched.
    ///
    /// Three assertions, each ruling out one wrong implementation: `found` and
    /// `disk_revision` **differ**, so a payload that set one from the other fails;
    /// `disk_revision` is `disk`'s own revision, so a payload that refreshed the
    /// projection separately from the revision beside it fails; and `disk` projects
    /// the **third** text, so a payload that described the bytes that refused the
    /// save fails.
    ///
    /// Phase 2c-4a-1 adds two more of the same kind for `disk_text`: it is the
    /// later text **byte for byte**, and its own `ContentRevision::of_bytes`
    /// equals `disk_revision`. The digest is recomputed from the string that
    /// crossed rather than compared against the expression that produced it, so a
    /// payload that carried the refusing bytes under the fresh revision fails.
    #[test]
    fn a_conflict_describes_the_refusing_read_and_the_fresh_read_separately() {
        const REFUSING: &str = concat!(
            "matches:\n",
            "  - trigger: ':one'\n",
            "    replace: rewritten by somebody else\n",
            "  - trigger: ':two'\n",
            "    replace: second\n",
        );
        // The third text: a different writer again, and a different **shape**, so
        // the projection can be told apart from the one that refused the save.
        const LATER: &str = concat!(
            "matches:\n",
            "  - trigger: ':only'\n",
            "    replace: written after the lock was released\n",
        );

        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        let held = before.matches[1].id;

        // A first external writer replaces the file, so the save is refused. The
        // `found` this produces is a real locked read's, not a fixture's.
        fs::write(dir.path().join("match").join("base.yml"), REFUSING).unwrap();
        let refusal = session
            .move_match(held, None, before.revision, &Acknowledgement::none())
            .expect("a conflict is an outcome, not a failure");
        let (expected, found) = match refusal {
            SaveResult::Conflict {
                expected, found, ..
            } => (expected, found),
            other => panic!("expected a conflict, got {other:?}"),
        };
        assert_eq!(
            found,
            espansoconfig_core::ContentRevision::of_bytes(REFUSING.as_bytes()),
            "the premise: `found` is the revision of the bytes that refused the save"
        );

        // A second external writer replaces it again, in the window this command
        // has between releasing the lock and taking its fresh read.
        fs::write(dir.path().join("match").join("base.yml"), LATER).unwrap();
        let later = espansoconfig_core::ContentRevision::of_bytes(LATER.as_bytes());
        assert_ne!(
            found, later,
            "the fixture must exercise a file that moved twice"
        );

        let payload = session
            .with_workspace(|workspace| {
                super::conflict_after_the_lock(
                    workspace,
                    id,
                    expected,
                    found,
                    // The request is a parameter here, so this call also pins
                    // that the payload's fourth operand really is the one the
                    // caller asked for rather than something derived on the
                    // spot. It is deliberately the **anchorless** request:
                    // whether an *anchored* answer comes out of the fresh read
                    // rather than out of the read that refused is a different
                    // claim, and `a_conflicts_anchored_answer_is_of_the_fresh_read`
                    // below is what discriminates it.
                    &anchorless_request(),
                )
            })
            .expect("the fresh read succeeds");
        match payload {
            SaveResult::Conflict {
                expected: base,
                found: refusing,
                disk_revision,
                disk_text,
                reapply,
                disk,
            } => {
                assert_eq!(
                    reapply,
                    espansoconfig_core::reconcile::ReapplyEvidence {
                        subject: espansoconfig_core::reconcile::ReapplyResolution::Unsupported {},
                        placement: espansoconfig_core::reconcile::ReapplyPlacement::NotAnchored {},
                    },
                    "the request the caller selected is what the payload answers with"
                );
                assert_eq!(base, before.revision, "the base the caller sent");
                assert_eq!(refusing, found, "the bytes that refused, carried unchanged");
                assert_ne!(
                    refusing, disk_revision,
                    "the two revisions describe two reads and must not be one value twice"
                );
                assert_eq!(disk_revision, later, "the fresh read is the later bytes");
                assert_eq!(
                    disk.revision, disk_revision,
                    "the top-level revision must be the revision of the projection beside it"
                );
                assert_eq!(
                    triggers_of(&disk),
                    [":only"],
                    "the projection must be of the fresh read, not of the bytes that refused"
                );
                assert_eq!(
                    disk_text, LATER,
                    "the text must be the fresh read's, not the bytes that refused the save"
                );
                assert_eq!(
                    ContentRevision::of_bytes(disk_text.as_bytes()),
                    disk_revision,
                    "disk_text must hash to disk_revision: the pairing is the whole claim"
                );
                assert_ne!(
                    ContentRevision::of_bytes(disk_text.as_bytes()),
                    refusing,
                    "and it must not be the text of the read that refused the save"
                );
            }
            other => panic!("expected a conflict, got {other:?}"),
        }
    } // End of function a_conflict_describes_the_refusing_read_and_the_fresh_read_separately()

    /// A request that asks about nothing, for the payload-shape tests.
    fn anchorless_request() -> espansoconfig_core::reconcile::ReapplyRequest {
        espansoconfig_core::reconcile::ReapplyRequest {
            subject: espansoconfig_core::reconcile::ReapplyMode::Unsupported,
            placement: espansoconfig_core::reconcile::PlacementMode::NotAnchored,
        }
    } // End of function anchorless_request()

    /// A conflict's **anchored** answers are of the fresh read, not of the read
    /// that refused the save.
    ///
    /// **The provenance claim, discriminated.** The test above passes an
    /// anchorless request, and that arm never looks at a snapshot at all — so an
    /// implementation that resolved the anchors against the bytes that refused
    /// the save, while continuing to take `disk`, `disk_text` and
    /// `disk_revision` from the later refresh, would leave it green. The
    /// end-to-end conflict cannot close the gap either: nothing writes between
    /// its refusal and its refresh, so R1 and R2 are the same bytes there.
    ///
    /// Here they are not. The anchors are captured from **R0**, the file is
    /// replaced by **R1** before the save so a real refusal happens, and replaced
    /// again by **R2** before the payload is built. The two later texts are chosen
    /// so that the same anchors resolve *differently* in each:
    ///
    /// - the subject's trigger is duplicated in R1 and unique in R2, so R1 answers
    ///   `AmbiguousTrigger` and R2 identifies;
    /// - the placement anchor's bytes are gone in R1 and restored verbatim in R2,
    ///   so R1 answers `NoExactCorrespondence` and R2 identifies.
    ///
    /// Both halves are then asserted to be R2's, and the identified subject's own
    /// revision is asserted to equal `disk_revision` — which is what says the
    /// answer describes the observation the rest of the payload describes.
    #[test]
    fn a_conflicts_anchored_answer_is_of_the_fresh_read() {
        // R1: the subject's trigger now appears twice, and the second snippet's
        // bytes are gone. Resolving R0's anchors here answers a refusal for both.
        const REFUSING: &str = concat!(
            "# A synthetic match file.\n",
            "matches:\n",
            "  - trigger: ':one'\n",
            "    replace: rewritten once by somebody else\n",
            "  - trigger: ':one'\n",
            "    replace: and again\n",
        );
        // R2: the subject's trigger is unique again — with different bytes, so
        // only the weaker tier can find it — and the second snippet is back,
        // byte for byte as R0 wrote it.
        const LATER: &str = concat!(
            "# A synthetic match file.\n",
            "matches:\n",
            "  - trigger: ':one'\n",
            "    replace: written after the lock was released\n",
            "  - trigger: ':two'\n",
            "    replace: second\n",
            "    invented_by_a_later_espanso: yes\n",
        );

        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        let held = before.matches[1].id;

        // The anchors, captured from R0 — the snapshot this session still holds —
        // and before anything else touches the file. The subject takes the
        // editor's policy so that a weaker tier is available to tell R1 and R2
        // apart; the placement takes the only policy a placement has.
        let request = session
            .with_workspace(|workspace| {
                let base = workspace.get_document(id)?;
                Ok(espansoconfig_core::reconcile::ReapplyRequest {
                    subject: espansoconfig_core::reconcile::ReapplyMode::anchored(
                        base,
                        &base.view.matches[0],
                        espansoconfig_core::reconcile::ReapplyConfidence::ExactItemOrUniqueTrigger,
                    ),
                    placement: espansoconfig_core::reconcile::PlacementMode::anchored(
                        base,
                        &base.view.matches[1],
                    ),
                })
            })
            .expect("the base snapshot is readable");

        // R1 replaces the file, so a real refusal happens and `found` is a real
        // locked read's revision.
        fs::write(dir.path().join("match").join("base.yml"), REFUSING).unwrap();
        let refusal = session
            .move_match(held, None, before.revision, &Acknowledgement::none())
            .expect("a conflict is an outcome, not a failure");
        let (expected, found) = match refusal {
            SaveResult::Conflict {
                expected, found, ..
            } => (expected, found),
            other => panic!("expected a conflict, got {other:?}"),
        };
        assert_eq!(
            found,
            ContentRevision::of_bytes(REFUSING.as_bytes()),
            "the premise: `found` is the revision of the bytes that refused the save"
        );

        // R2 replaces it again, in the window between the released lock and the
        // fresh read.
        fs::write(dir.path().join("match").join("base.yml"), LATER).unwrap();
        let later = ContentRevision::of_bytes(LATER.as_bytes());
        assert_ne!(found, later, "the fixture must move the file twice");

        let payload = session
            .with_workspace(|workspace| {
                super::conflict_after_the_lock(workspace, id, expected, found, &request)
            })
            .expect("the fresh read succeeds");
        let SaveResult::Conflict {
            disk_revision,
            reapply,
            ..
        } = payload
        else {
            panic!("expected a conflict");
        };
        assert_eq!(disk_revision, later, "the premise: the payload is of R2");

        let espansoconfig_core::reconcile::ReapplyResolution::Identified { target } =
            reapply.subject
        else {
            panic!(
                "the subject must resolve against R2, where its trigger is unique again: {:?}",
                reapply.subject
            );
        };
        assert_eq!(
            target.id.revision, disk_revision,
            "the identified snippet must be of the snapshot the payload describes"
        );
        assert!(
            target
                .source_text
                .contains("written after the lock was released"),
            "the identified snippet must be R2's, not the one that refused the save"
        );

        let espansoconfig_core::reconcile::ReapplyPlacement::Identified { target: anchor } =
            reapply.placement
        else {
            panic!(
                "the placement must resolve against R2, where the anchor's bytes are back: {:?}",
                reapply.placement
            );
        };
        assert_eq!(
            anchor.id.revision, disk_revision,
            "and so must the anchor, out of the same read"
        );
    } // End of function a_conflicts_anchored_answer_is_of_the_fresh_read()

    // -----------------------------------------------------------------------
    // Which correspondence question each writing command actually asks
    // -----------------------------------------------------------------------
    //
    // `crates/espansoconfig-core/tests/reconcile.rs` builds its `ReapplyRequest`
    // values in its own helpers, so it establishes what the algorithm answers and
    // **nothing about which request a command selects**. Mutating
    // `move_one_match` to send `PlacementMode::NotAnchored`, or
    // `delete_one_match` to send the editor's weaker confidence, leaves every one
    // of those cases green. The four tests below drive the six writing commands
    // through their public session methods and assert the answer each production
    // request produces, over a fixture built so that the two confidence policies
    // disagree.

    /// The base every command-level conflict case below is planned against.
    ///
    /// Three snippets with three distinct triggers, hand-authored and neutral
    /// (`CLAUDE.md` section 1).
    const POLICY_BASE: &str = concat!(
        "matches:\n",
        "  - trigger: ':one'\n",
        "    replace: first\n",
        "  - trigger: ':two'\n",
        "    replace: second\n",
        "  - trigger: ':three'\n",
        "    replace: third\n",
    );

    /// What another writer put on disk before any of those saves reached the
    /// transaction.
    ///
    /// **This fixture is what makes a confidence mutation fail.** Only the first
    /// snippet's `replace` value differs, so that snippet's owned-run envelope
    /// *and* its whole mapping slice are both different while its trigger is
    /// spelled exactly as it was and is still unique on both sides: exact
    /// correspondence refuses for it and the editor's trigger tier identifies it,
    /// and the two policies are therefore distinguishable by their answers. The
    /// other two snippets are byte-identical, so exact correspondence identifies
    /// them — which is what lets a positional anchor be pinned as *found* or as
    /// *specifically refused* rather than merely as "not `NotAnchored`".
    const POLICY_DISK: &str = concat!(
        "matches:\n",
        "  - trigger: ':one'\n",
        "    replace: rewritten by somebody else\n",
        "  - trigger: ':two'\n",
        "    replace: second\n",
        "  - trigger: ':three'\n",
        "    replace: third\n",
    );

    /// The evidence one conflicting save produces, over a session that projected
    /// [`POLICY_BASE`] and a file another writer has since replaced with
    /// [`POLICY_DISK`].
    ///
    /// **A fresh session per case, and that is not tidiness.** The refresh a
    /// conflict takes replaces this session's cached projection, so a second save
    /// through the same session would be planned against the disk rather than
    /// against the base — and every identity the first case held would be stale.
    fn conflicting(
        save: impl FnOnce(
            &WorkspaceSession,
            &DocumentView,
            DocumentId,
        ) -> Result<SaveResult, super::CommandError>,
    ) -> ReapplyEvidence {
        let opened = opened_on(POLICY_BASE);
        fs::write(
            opened.dir.path().join("match").join("base.yml"),
            POLICY_DISK,
        )
        .unwrap();
        let result = save(&opened.session, &opened.before, opened.id)
            .expect("a conflict is an outcome, not a failure");
        let SaveResult::Conflict { reapply, .. } = result else {
            panic!("expected a conflict, got {result:?}");
        };
        reapply
    } // End of function conflicting()

    /// The trigger of the snippet a **subject** resolution identified.
    fn subject_trigger(subject: &ReapplyResolution) -> String {
        let ReapplyResolution::Identified { target } = subject else {
            panic!("expected a subject identification, got {subject:?}");
        };
        trigger_text(target).to_owned()
    } // End of function subject_trigger()

    /// The trigger of the snippet a **placement** resolution identified.
    fn placement_trigger(placement: &ReapplyPlacement) -> String {
        let ReapplyPlacement::Identified { target } = placement else {
            panic!("expected a placement identification, got {placement:?}");
        };
        trigger_text(target).to_owned()
    } // End of function placement_trigger()

    /// The exact-correspondence refusal, spelled once.
    fn refused_exactly() -> ReapplyResolution {
        ReapplyResolution::Refused {
            reason: ReapplyRefusal::NoExactCorrespondence,
        }
    } // End of function refused_exactly()

    /// **A drafted save is the only writing command that may fall back to a
    /// unique unchanged trigger**, and a move, a deletion and a duplication may
    /// not — asserted through the public session methods, over one snippet for
    /// which the two policies give different answers.
    ///
    /// Mutating `save_one_match` to `ReapplyConfidence::ExactItem`, or any of
    /// the other three to `ReapplyConfidence::ExactItemOrUniqueTrigger`, flips
    /// exactly one assertion here — which is what the core's own acceptance cases
    /// cannot do, because they build the request themselves.
    ///
    /// **The last case is why the three refusals are not vacuous.** A move of a
    /// snippet whose bytes are *unchanged* identifies it, so a mutation that
    /// captured no anchor at all, or refused constantly, fails too.
    #[test]
    fn a_drafted_save_is_the_only_writing_command_that_may_fall_back_to_a_trigger() {
        let drafted = conflicting(|session, before, _| {
            session.save_match(
                before.matches[0].id,
                &draft_replace("mine"),
                before.revision,
                &Acknowledgement::none(),
            )
        });
        assert_eq!(
            subject_trigger(&drafted.subject),
            ":one",
            "a drafted save selects the editor's policy, whose trigger tier finds this snippet"
        );
        assert_eq!(
            drafted.placement,
            ReapplyPlacement::NotAnchored {},
            "a drafted save relocates nothing, so it names no positional anchor"
        );

        let moved = conflicting(|session, before, _| {
            session.move_match(
                before.matches[0].id,
                None,
                before.revision,
                &Acknowledgement::none(),
            )
        });
        assert_eq!(
            moved,
            ReapplyEvidence {
                subject: refused_exactly(),
                placement: ReapplyPlacement::NotAnchored {},
            },
            "a move acts on the whole envelope, and a move to the top names no anchor"
        );

        let deleted = conflicting(|session, before, _| {
            session.delete_match(
                before.matches[0].id,
                before.revision,
                &Acknowledgement::none(),
            )
        });
        assert_eq!(
            deleted,
            ReapplyEvidence {
                subject: refused_exactly(),
                placement: ReapplyPlacement::NotAnchored {},
            },
            "a deletion removes the whole envelope, and it puts nothing anywhere"
        );

        let duplicated = conflicting(|session, before, _| {
            session.duplicate_match(
                before.matches[0].id,
                before.revision,
                &Acknowledgement::none(),
            )
        });
        assert_eq!(
            duplicated,
            ReapplyEvidence {
                subject: refused_exactly(),
                placement: ReapplyPlacement::NotAnchored {},
            },
            "a duplicate copies the envelope byte for byte, and the clone has no placement choice"
        );

        let unchanged = conflicting(|session, before, _| {
            session.move_match(
                before.matches[1].id,
                None,
                before.revision,
                &Acknowledgement::none(),
            )
        });
        assert_eq!(
            subject_trigger(&unchanged.subject),
            ":two",
            "the exact tier really searches: a snippet whose bytes survived is identified"
        );
    } // End of function a_drafted_save_is_the_only_writing_command_that_may_fall_back_to_a_trigger()

    /// **A creation names no existing snippet and a raw save has no honest
    /// reapply at all**, and those are two different facts rather than one.
    ///
    /// Both are decided before the transaction and neither consults the disk, so
    /// a mutation that swapped them — or that sent an anchored mode for either —
    /// changes the answer here. Neither command names a positional anchor in
    /// these three cases, and each says so rather than leaving the second operand
    /// unanswered.
    #[test]
    fn a_creation_answers_targetless_and_a_raw_save_answers_unsupported() {
        for position in [NewMatchPosition::Front {}, NewMatchPosition::End {}] {
            let created = conflicting(|session, before, id| {
                session.create_match(
                    id,
                    &new_snippet(),
                    &position,
                    before.revision,
                    &Acknowledgement::none(),
                )
            });
            assert_eq!(
                created,
                ReapplyEvidence {
                    subject: ReapplyResolution::Targetless {},
                    placement: ReapplyPlacement::NotAnchored {},
                },
                "a creation brings its own snippet, and front and end name no anchor"
            );
        } // End of the loop over the two semantic creation positions

        let raw = conflicting(|session, before, id| {
            session.save_raw_document(
                id,
                before.revision,
                "matches:\n  - trigger: ':mine'\n    replace: mine\n",
                &Acknowledgement::none(),
            )
        });
        assert_eq!(
            raw,
            ReapplyEvidence {
                subject: ReapplyResolution::Unsupported {},
                placement: ReapplyPlacement::NotAnchored {},
            },
            "a whole-document replacement has no target and is placed after nothing"
        );
    } // End of function a_creation_answers_targetless_and_a_raw_save_answers_unsupported()

    /// **A move sent `after` a snippet asks about that snippet too**, and the
    /// answer is exact correspondence or a refusal — never a trigger fallback.
    ///
    /// Two cases, one per side of the fixture. The anchor whose bytes survived is
    /// identified, so a mutation sending `PlacementMode::NotAnchored` for every
    /// move fails; the anchor whose bytes changed but whose trigger did not is
    /// refused by name, so a mutation giving a placement the editor's weaker
    /// policy fails as well. The subject is asserted in both, because the two
    /// operands must not be able to answer each other's question.
    #[test]
    fn a_move_after_an_anchor_answers_that_anchors_correspondence() {
        let after_a_surviving_anchor = conflicting(|session, before, _| {
            session.move_match(
                before.matches[0].id,
                Some(before.matches[2].id),
                before.revision,
                &Acknowledgement::none(),
            )
        });
        assert_eq!(
            placement_trigger(&after_a_surviving_anchor.placement),
            ":three",
            "the anchor's bytes survived, so exact correspondence finds it"
        );
        assert_eq!(
            after_a_surviving_anchor.subject,
            refused_exactly(),
            "and the moved snippet's own bytes did not, so its half still refuses"
        );

        let after_a_rewritten_anchor = conflicting(|session, before, _| {
            session.move_match(
                before.matches[2].id,
                Some(before.matches[0].id),
                before.revision,
                &Acknowledgement::none(),
            )
        });
        assert_eq!(
            after_a_rewritten_anchor.placement,
            ReapplyPlacement::Refused {
                reason: ReapplyRefusal::NoExactCorrespondence
            },
            "the anchor keeps its unique trigger, and a placement may not use one"
        );
        assert_eq!(
            subject_trigger(&after_a_rewritten_anchor.subject),
            ":three",
            "while the moved snippet itself is identified, out of the same read"
        );
    } // End of function a_move_after_an_anchor_answers_that_anchors_correspondence()

    /// **A creation sent `after` a snippet asks about that snippet as a
    /// placement**, and its own subject stays `Targetless` either way.
    ///
    /// The pair that stops a creation's anchor drifting back into the subject
    /// slot, where `Identified` would have meant two different things depending
    /// on which command produced it.
    #[test]
    fn a_creation_after_an_anchor_answers_that_anchors_correspondence() {
        let after_a_surviving_anchor = conflicting(|session, before, id| {
            session.create_match(
                id,
                &new_snippet(),
                &NewMatchPosition::After {
                    anchor: before.matches[2].id,
                },
                before.revision,
                &Acknowledgement::none(),
            )
        });
        assert_eq!(
            placement_trigger(&after_a_surviving_anchor.placement),
            ":three",
            "the anchor's bytes survived, so exact correspondence finds it"
        );
        assert_eq!(
            after_a_surviving_anchor.subject,
            ReapplyResolution::Targetless {},
            "and a creation still names no existing snippet of its own"
        );

        let after_a_rewritten_anchor = conflicting(|session, before, id| {
            session.create_match(
                id,
                &new_snippet(),
                &NewMatchPosition::After {
                    anchor: before.matches[0].id,
                },
                before.revision,
                &Acknowledgement::none(),
            )
        });
        assert_eq!(
            after_a_rewritten_anchor,
            ReapplyEvidence {
                subject: ReapplyResolution::Targetless {},
                placement: ReapplyPlacement::Refused {
                    reason: ReapplyRefusal::NoExactCorrespondence
                },
            },
            "the anchor keeps its unique trigger, and a creation's placement may not use one"
        );
    } // End of function a_creation_after_an_anchor_answers_that_anchors_correspondence()

    /// A conflict's `disk_text` is the file **byte for byte**, distinguishing
    /// bytes included.
    ///
    /// The pairing test above uses ordinary LF text, so it could pass over a
    /// payload that rebuilt the text from the projection, re-encoded it, or
    /// normalised its line endings. This one cannot: the file it conflicts over
    /// carries a UTF-8 BOM, CRLF line endings **and** no final newline — the three
    /// properties the corpus fixtures exist to pin — and the assertion is on the
    /// bytes, with the digest recomputed from what came back.
    ///
    /// Hand-authored and neutral, written with `\u{feff}` and explicit `\r\n` so
    /// that an editor saving this source file cannot quietly agree with a
    /// normalising boundary (CLAUDE.md sections 1 and 4).
    #[test]
    fn a_conflicts_disk_text_survives_byte_for_byte() {
        const BOM: &str = "\u{feff}";
        let their_bytes = format!(
            "{BOM}# a comment\r\nmatches:\r\n  - trigger: ':theirs'\r\n    replace: theirs",
        );

        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(BASE_YML);

        // Another writer replaces the file with one that has all three
        // distinguishing properties, and this session is not told.
        fs::write(dir.path().join("match").join("base.yml"), &their_bytes).unwrap();

        let result = session
            .save_raw_document(
                id,
                before.revision,
                "matches:\n  - trigger: ':mine'\n    replace: mine\n",
                &Acknowledgement::none(),
            )
            .expect("a conflict is an outcome, not a failure");
        let SaveResult::Conflict {
            disk_revision,
            disk_text,
            ..
        } = result
        else {
            panic!("expected a conflict, got {result:?}");
        };
        assert!(
            disk_text.starts_with(BOM),
            "the BOM must survive: a stripped one is a different file"
        );
        assert_eq!(
            disk_text.matches("\r\n").count(),
            3,
            "every CRLF must survive: converting one rewrites a line nobody touched"
        );
        assert!(
            !disk_text.ends_with('\n'),
            "the absent final newline must stay absent"
        );
        assert_eq!(disk_text, their_bytes, "and the whole text, byte for byte");
        assert_eq!(
            ContentRevision::of_bytes(disk_text.as_bytes()),
            disk_revision,
            "the text that crossed must hash to the revision it crossed beside"
        );
        assert_eq!(
            base_bytes(&dir),
            their_bytes,
            "and a conflict must leave the other writer's bytes alone"
        );
    } // End of function a_conflicts_disk_text_survives_byte_for_byte()

    /// A suspicion refuses the move, and the acknowledgement it hands back lets
    /// the same move through.
    ///
    /// **The content-addressed acknowledgement, end to end through the command
    /// layer.** The findings travel out of the refusal, the caller sends exactly
    /// those back, and the second call proceeds. There is no flag anywhere on this
    /// path, and the acknowledgement crosses `serde` in both directions because
    /// that is the only shape a real caller can produce.
    #[test]
    fn a_suspicion_refuses_the_move_until_the_findings_come_back() {
        let dir = suspicious_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        let held = before.matches[1].id;

        let refused = session
            .move_match(held, None, before.revision, &Acknowledgement::none())
            .expect("a refusal is an outcome, not a failure");
        let findings = match refused {
            SaveResult::Refused { verdict, findings } => {
                assert_eq!(
                    verdict,
                    espansoconfig_core::persist::SaveVerdict::RefusedForUnacknowledgedSuspicions
                );
                assert!(!findings.is_empty(), "a refusal carries its evidence");
                findings
            }
            other => panic!("expected a refusal, got {other:?}"),
        };
        assert_eq!(
            fs::read_to_string(dir.path().join("match").join("base.yml")).unwrap(),
            SUSPICIOUS_YML,
            "a refused save writes nothing"
        );

        // The round trip a real caller makes: the findings were serialized to the
        // interface, and the acknowledgement arrives as JSON.
        let payload = serde_json::json!({ "accepted": findings });
        let acknowledgement: Acknowledgement =
            serde_json::from_value(payload).expect("an acknowledgement reads back");
        assert_eq!(acknowledgement.len(), findings.len());

        let (_, moved) = expect_saved(
            session
                .move_match(held, None, before.revision, &acknowledgement)
                .expect("the acknowledged move proceeds"),
            "move",
        );
        assert!(moved.is_some());
        let after = session.document(id).expect("the file still reads");
        assert_eq!(triggers_of(&after), [":two", ":one"]);
    } // End of function a_suspicion_refuses_the_move_until_the_findings_come_back()

    /// A move of a package file is refused, and it is the transaction that
    /// refuses it.
    ///
    /// The one condition this layer deliberately does **not** re-check: a Hub
    /// package is read-only, `save_document` refuses it before the lock is taken,
    /// and the refusal arrives here as the typed failure it is rather than as a
    /// second opinion this crate formed.
    #[test]
    fn a_package_file_is_refused_by_the_transaction() {
        let dir = TempDir::new().expect("temp dir");
        let package = dir.path().join("match").join("packages").join("demo");
        fs::create_dir_all(&package).unwrap();
        fs::write(package.join("package.yml"), BASE_YML).unwrap();
        let session = open_session(&dir);
        let id = id_of(&session, "match/packages/demo/package.yml");
        let view = session.document(id).expect("the file reads");

        let error = session
            .move_match(
                view.matches[1].id,
                None,
                view.revision,
                &Acknowledgement::none(),
            )
            .expect_err("a package file is not editable here");
        assert_eq!(error.code(), "saveFailed");
        let json = serde_json::to_value(&error).expect("the error serializes");
        assert!(
            json["error"]["DocumentIsReadOnly"].is_object(),
            "the transaction's own typed reason must travel whole: {json}"
        );
        assert_eq!(
            fs::read_to_string(package.join("package.yml")).unwrap(),
            BASE_YML
        );
    } // End of function a_package_file_is_refused_by_the_transaction()

    /// The session takes a backup before its first change to a file, and only
    /// then.
    ///
    /// **The `BackupSession` this layer owns, observed rather than argued.** The
    /// first move reports `backup_taken: true` and leaves a copy under
    /// `.espansoconfig-backups`; the second reports `false`, because the rule is
    /// *before the first modification of each file per session* and this session
    /// has already copied it. A `false` there is a success, not a failure — and a
    /// `true` on the second call would mean every save was copying the file it had
    /// just written.
    #[test]
    fn the_session_copies_a_file_before_its_first_change_and_not_again() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let backups = dir.path().join(".espansoconfig-backups");
        assert!(
            !backups.exists(),
            "an open workspace that has saved nothing leaves no trace on disk"
        );

        let first = session.document(id).expect("the file reads");
        let (revision, _) = expect_saved(
            session
                .move_match(
                    first.matches[1].id,
                    None,
                    first.revision,
                    &Acknowledgement::none(),
                )
                .expect("the move is legal"),
            "move",
        );
        assert!(backups.is_dir(), "the first change writes a copy");

        let second = session.document(id).expect("the file still reads");
        assert_eq!(second.revision, revision);
        match session
            .move_match(
                second.matches[1].id,
                None,
                second.revision,
                &Acknowledgement::none(),
            )
            .expect("the second move is legal")
        {
            SaveResult::Saved {
                committed,
                backup_taken,
                ..
            } => {
                assert!(committed);
                assert!(
                    !backup_taken,
                    "the session had already copied this file, which is the rule rather than a failure"
                );
            }
            other => panic!("expected a saved result, got {other:?}"),
        }
    } // End of function the_session_copies_a_file_before_its_first_change_and_not_again()

    /// A move that would change nothing is refused by the patch engine.
    ///
    /// Asking for a snippet to be written after itself has no destination index
    /// that differs from where it already is, and the engine says so rather than
    /// rewriting the file to itself. It arrives here as `saveFailed` carrying the
    /// engine's own code, which is what "the typed failure travels whole" means.
    #[test]
    fn a_move_that_changes_nothing_is_refused_by_the_engine() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let view = session.document(id).expect("the file reads");
        let held = view.matches[1].id;

        let error = session
            .move_match(held, Some(held), view.revision, &Acknowledgement::none())
            .expect_err("a move to where it already is has nothing to do");
        assert_eq!(error.code(), "saveFailed");
        let json = serde_json::to_value(&error).expect("the error serializes");
        assert!(
            json["error"]["Patch"]["MoveChangesNothing"].is_object(),
            "the engine's own reason must survive the crossing: {json}"
        );
        assert_eq!(
            fs::read_to_string(dir.path().join("match").join("base.yml")).unwrap(),
            BASE_YML
        );
    } // End of function a_move_that_changes_nothing_is_refused_by_the_engine()

    /// A draft that sets one scalar, with everything else left alone.
    ///
    /// Hand-authored and neutral, like every fixture in this module: a
    /// `MatchDraft` whose every other field is `Unchanged`, which is what makes
    /// the derived batch one edit rather than eighteen.
    fn draft_replace(value: &str) -> MatchDraft {
        MatchDraft {
            replace: DraftField::Set(value.to_owned()),
            ..MatchDraft::default()
        }
    }

    /// A saved draft commits, rewrites only the value it names, and answers with
    /// an identity that resolves in the revision that now exists.
    ///
    /// **Four claims, and the third is the one this whole application is for.**
    /// The save commits; the identity it answers with resolves through
    /// `get_match` while the one held before it does not; **every byte outside
    /// the edited value survives** — the file comment, the untouched trigger, the
    /// second snippet and its unmodelled key; and the identity is re-minted from
    /// the match's **own** path rather than from a sequence position, which is
    /// what lets a match that is not addressable as a sequence item be saved at
    /// all.
    #[test]
    fn a_scalar_save_commits_and_answers_with_an_identity_that_resolves() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        let held = before.matches[0].id;

        let result = session
            .save_match(
                held,
                &draft_replace("changed"),
                before.revision,
                &Acknowledgement::none(),
            )
            .expect("the draft plans and the save runs");
        let (revision, moved) = expect_saved(result, "scalar save");
        assert_ne!(revision, before.revision);

        let saved = moved.expect("a committed scalar save names the match it saved");
        let found = session
            .match_view(saved)
            .expect("the identity the command answered with must resolve");
        assert_eq!(trigger_text(&found), ":one");
        let stale = session
            .match_view(held)
            .expect_err("the identity held before the save is minted from the old revision");
        assert_eq!(stale.code(), "identityStaleRevision");

        assert_eq!(
            fs::read_to_string(dir.path().join("match").join("base.yml")).unwrap(),
            BASE_YML.replace("replace: first", "replace: changed"),
            "everything outside the edited value must come out byte-identical"
        );
    } // End of function a_scalar_save_commits_and_answers_with_an_identity_that_resolves()

    /// A draft that asks for the value already there is a **success** that writes
    /// nothing.
    ///
    /// **`committed: false` is not a failure**, and the design consult's ruling Q3
    /// is the other half of this test: the empty batch still goes to the
    /// transaction, so the under-lock revision check still runs. What is asserted
    /// here is everything that follows from it — the file is byte-identical, the
    /// revision is the one the caller already had, no backup was taken because
    /// nothing was replaced, and the caller's own identity is **still valid**,
    /// which is why answering no new one costs it nothing.
    #[test]
    fn a_draft_that_changes_nothing_is_a_success_that_writes_no_bytes() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        let held = before.matches[0].id;

        let result = session
            .save_match(
                held,
                &draft_replace("first"),
                before.revision,
                &Acknowledgement::none(),
            )
            .expect("a draft that changes nothing is not an error");
        match result {
            SaveResult::Saved {
                revision,
                committed,
                backup_taken,
                moved,
                ..
            } => {
                assert!(!committed, "there was nothing to write");
                assert!(!backup_taken, "nothing was replaced, so nothing was copied");
                assert_eq!(revision, before.revision);
                assert!(moved.is_none(), "no new revision exists to mint one in");
            }
            other => panic!("expected a saved result, got {other:?}"),
        }
        assert_eq!(
            fs::read_to_string(dir.path().join("match").join("base.yml")).unwrap(),
            BASE_YML
        );
        assert!(
            !dir.path().join(".espansoconfig-backups").exists(),
            "a save that wrote nothing leaves no trace on disk"
        );
        session
            .match_view(held)
            .expect("the caller's identity survives a save that did not commit");
    } // End of function a_draft_that_changes_nothing_is_a_success_that_writes_no_bytes()

    /// A draft the planner will not derive a batch for crosses as `draftRefused`,
    /// and no transaction runs.
    ///
    /// **The distinction ruling Q1 settled, as a test.** A `DraftError` is a
    /// planning-time refusal: it is an `Err` rather than a `SaveResult::Refused`,
    /// it carries no findings for anyone to acknowledge, and the file is
    /// untouched — no backup folder was even created, which is what says the
    /// transaction never started.
    ///
    /// The fixture is a cardinality change the four primitives cannot express:
    /// the match has no `search_terms` at all, so element 0 of it does not exist.
    /// The refusal names the sequence and the index and **nothing else**.
    #[test]
    fn a_draft_the_planner_refuses_crosses_as_draft_refused_and_writes_nothing() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        let draft = MatchDraft {
            search_terms: vec![ItemDraft {
                index: 0,
                value: DraftField::Set("late".to_owned()),
            }],
            ..MatchDraft::default()
        };

        let error = session
            .save_match(
                before.matches[0].id,
                &draft,
                before.revision,
                &Acknowledgement::none(),
            )
            .expect_err("a sequence this match does not have cannot be drafted into existence");
        assert_eq!(error.code(), "draftRefused");
        let json = serde_json::to_value(&error).expect("the refusal serializes");
        let refusal = &json["error"]["SequenceItemDoesNotExist"];
        assert_eq!(refusal["field"], "search_terms");
        assert_eq!(refusal["index"], 0);
        assert_eq!(refusal["length"], 0);

        assert_eq!(
            fs::read_to_string(dir.path().join("match").join("base.yml")).unwrap(),
            BASE_YML
        );
        assert!(
            !dir.path().join(".espansoconfig-backups").exists(),
            "no transaction ran, so no file was copied"
        );
    } // End of function a_draft_the_planner_refuses_crosses_as_draft_refused_and_writes_nothing()

    /// A `base_revision` that is not this session's parse is refused **before**
    /// anything is planned.
    ///
    /// **Positional addressing is what makes this load-bearing** here in a way it
    /// is not for a move. A draft names a variable, a `params` entry or a list
    /// element by *index*, and an index resolved against the wrong parse does not
    /// fail — it names a **different** entry and succeeds. So the refusal is not
    /// an optimisation of the transaction's own check: it is what stops a draft
    /// being planned against a projection it was never built from.
    ///
    /// The order matters as much as the refusal, and the second assertion is what
    /// says so: the draft below is one the planner would *also* refuse, and the
    /// code that comes back is the stale-revision one rather than
    /// `draftRefused` — so nothing was planned at all.
    #[test]
    fn a_stale_base_revision_is_refused_before_a_draft_is_planned() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let view = session.document(id).expect("the file reads");
        let held = view.matches[0].id;
        let stale = ContentRevision::of_bytes(b"a file this session never read");
        let draft = MatchDraft {
            search_terms: vec![ItemDraft {
                index: 0,
                value: DraftField::Set("late".to_owned()),
            }],
            ..MatchDraft::default()
        };

        let error = session
            .save_match(held, &draft, stale, &Acknowledgement::none())
            .expect_err("a draft planned against another parse must not be applied");
        assert_eq!(error.code(), "identityStaleRevision");
        let json = serde_json::to_value(&error).expect("the refusal serializes");
        assert_eq!(json["expected"], view.revision.to_hex());
        assert_eq!(json["found"], stale.to_hex());
        assert_eq!(
            fs::read_to_string(dir.path().join("match").join("base.yml")).unwrap(),
            BASE_YML
        );
    } // End of function a_stale_base_revision_is_refused_before_a_draft_is_planned()

    /// A saved draft reports the presentation change it had to make.
    ///
    /// **`SaveResult::Saved::notes` gets its first producer at this phase.** The
    /// field has been on the wire since 2b-1 with nothing to fill it: a move
    /// copies the item's own bytes verbatim and re-encodes no scalar, so every
    /// move answers with an empty list. A drafted save re-encodes what it
    /// rewrites, and here the new value carries a line break, which no plain
    /// scalar can hold — so the emitter has to spell it as a literal block and
    /// says so rather than changing the shape of the file in silence (plan
    /// section 6.2).
    ///
    /// The note is checked as a **fact about the crossing**: it survives
    /// serialization with its position in the batch and both styles, which is
    /// what a caller needs to say *which* value changed shape and how.
    #[test]
    fn a_saved_draft_reports_the_presentation_change_it_had_to_make() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");

        let result = session
            .save_match(
                before.matches[0].id,
                &draft_replace("one line\nand another\n"),
                before.revision,
                &Acknowledgement::none(),
            )
            .expect("the draft plans and the save runs");
        let SaveResult::Saved {
            committed, notes, ..
        } = &result
        else {
            panic!("expected a saved result, got {result:?}");
        };
        assert!(committed);
        assert_eq!(
            notes.len(),
            1,
            "one edit changed one value's spelling: {notes:?}"
        );
        let PresentationNote::ScalarRestyled { edit, from, to, .. } = &notes[0] else {
            panic!("a re-encoded scalar reports a restyling, got {notes:?}");
        };
        assert_eq!(*edit, 0, "the note names its edit's position");
        assert_ne!(
            from, to,
            "a note is only worth sending when the spelling really changed"
        );

        let json = serde_json::to_value(&result).expect("the result serializes");
        let crossed = json["notes"]
            .as_array()
            .expect("notes is a list on the wire");
        assert_eq!(crossed.len(), 1, "the note must reach the wire: {json}");
        let payload = &crossed[0]["ScalarRestyled"];
        assert!(
            payload.is_object(),
            "every note crosses as a one-key object (D5): {json}"
        );
        assert_eq!(payload["edit"], 0);
        assert_eq!(payload["from"], "Plain");
        assert_eq!(payload["to"], "Literal");
    } // End of function a_saved_draft_reports_the_presentation_change_it_had_to_make()

    /// A suspicion refuses the save until the findings come back, and the same
    /// draft then proceeds.
    ///
    /// **The acknowledgement protocol is the transaction's, not the command's**,
    /// and this is what says a drafted save inherits it whole rather than
    /// re-implementing half of it. There is no `force` flag in either call: the
    /// findings travel out of the refusal and exactly those findings travel back
    /// in, matched as a multiset.
    #[test]
    fn a_suspicion_refuses_a_drafted_save_until_the_findings_come_back() {
        let dir = suspicious_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let view = session.document(id).expect("the file reads");
        let held = view.matches[1].id;

        let refusal = session
            .save_match(
                held,
                &draft_replace("hello {{nobody}}"),
                view.revision,
                &Acknowledgement::none(),
            )
            .expect("a refusal is an outcome, not an error");
        let findings = match refusal {
            SaveResult::Refused { findings, .. } => findings,
            other => panic!("expected a refusal, got {other:?}"),
        };
        assert!(!findings.is_empty(), "a refusal carries its evidence");
        assert_eq!(
            fs::read_to_string(dir.path().join("match").join("base.yml")).unwrap(),
            SUSPICIOUS_YML,
            "a refused save writes nothing"
        );

        let acknowledged = session
            .save_match(
                held,
                &draft_replace("hello {{nobody}}"),
                view.revision,
                &Acknowledgement::of(&findings),
            )
            .expect("the acknowledged save proceeds");
        match acknowledged {
            SaveResult::Saved { committed, .. } => assert!(committed),
            other => panic!("expected a saved result, got {other:?}"),
        }
    } // End of function a_suspicion_refuses_a_drafted_save_until_the_findings_come_back()

    // -----------------------------------------------------------------------
    // Phase 2b-2c-2 — the two commands that change a list's length
    // -----------------------------------------------------------------------

    /// A two-snippet file, hand-authored and neutral, written by these tests.
    ///
    /// Separate from [`BASE_YML`] because the creation and deletion cases state
    /// their expected output **as a whole document literal**, and a fixture
    /// carrying an unmodelled key would put a line in every one of those
    /// literals that has nothing to do with what is under test.
    const TWO_SNIPPETS: &str = concat!(
        "matches:\n",
        "  - trigger: ':one'\n",
        "    replace: first\n",
        "  - trigger: ':two'\n",
        "    replace: second\n",
    );

    /// The snippet these tests create, hand-authored and neutral.
    fn new_snippet() -> NewMatch {
        NewMatch {
            trigger: ":new".to_owned(),
            replace: "a new snippet".to_owned(),
            label: None,
            word: None,
            left_word: None,
            right_word: None,
        }
    }

    /// A creation lands at the end, writes exactly the expected file, and names
    /// the snippet it created.
    ///
    /// **Four claims, and the fourth is the one no caller can make for itself.**
    /// The whole file is stated as a literal rather than as a proxy, so a save
    /// that rewrote a quote, an indent or a line ending anywhere fails; the two
    /// existing snippets come out byte-identical, which is `CLAUDE.md` section 3
    /// at this layer; the identity held before the save stops resolving; and the
    /// identity that comes back is the **created** snippet, which did not exist
    /// when the call was made.
    #[test]
    fn a_created_match_is_appended_and_answers_with_its_new_identity() {
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(TWO_SNIPPETS);
        let held = before.matches[0].id;

        let result = session
            .create_match(
                id,
                &new_snippet(),
                &NewMatchPosition::End {},
                before.revision,
                &Acknowledgement::none(),
            )
            .expect("the creation is legal");
        let (revision, moved) = expect_saved(result, "creation");
        assert_ne!(revision, before.revision);

        assert_eq!(
            base_bytes(&dir),
            concat!(
                "matches:\n",
                "  - trigger: ':one'\n",
                "    replace: first\n",
                "  - trigger: ':two'\n",
                "    replace: second\n",
                "  - trigger: ':new'\n",
                "    replace: a new snippet\n",
            ),
            "every byte of the two existing snippets must survive unchanged"
        );

        let created = moved.expect("a committed creation names the snippet it created");
        assert_eq!(
            trigger_text(&session.match_view(created).expect("it resolves")),
            ":new"
        );
        assert_eq!(
            session
                .match_view(held)
                .expect_err("the identity held before the save is stale")
                .code(),
            "identityStaleRevision"
        );
        assert_eq!(
            triggers_of(&session.document(id).expect("it reads")),
            [":one", ":two", ":new"]
        );
    } // End of function a_created_match_is_appended_and_answers_with_its_new_identity()

    /// A creation at the front lands above the first snippet **and above its own
    /// comment**.
    ///
    /// The front destination is the first item's whole ownership hull, so a
    /// comment describing that snippet stays with it rather than being adopted by
    /// the arrival. The fixture's comment is the assertion: a front insertion
    /// derived as "the line after `matches:`" would put the new snippet between
    /// `# about the first one` and the snippet it describes, and the literal below
    /// would fail.
    #[test]
    fn a_created_match_at_the_front_lands_above_the_first_snippet_and_its_comment() {
        let source = concat!(
            "matches:\n",
            "  # about the first one\n",
            "  - trigger: ':one'\n",
            "    replace: first\n",
        );
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(source);

        let (_, created) = expect_saved(
            session
                .create_match(
                    id,
                    &new_snippet(),
                    &NewMatchPosition::Front {},
                    before.revision,
                    &Acknowledgement::none(),
                )
                .expect("the creation is legal"),
            "creation",
        );
        assert_eq!(
            base_bytes(&dir),
            concat!(
                "matches:\n",
                "  - trigger: ':new'\n",
                "    replace: a new snippet\n",
                "  # about the first one\n",
                "  - trigger: ':one'\n",
                "    replace: first\n",
            ),
            "the comment belongs to the snippet below it and must not change hands"
        );
        assert_eq!(
            trigger_text(
                &session
                    .match_view(created.expect("a committed creation names one"))
                    .expect("it resolves")
            ),
            ":new",
            "the answered identity must be the created snippet, not the one it displaced"
        );
    } // End of function a_created_match_at_the_front_lands_above_the_first_snippet_and_its_comment()

    /// A creation after a named anchor lands after that anchor.
    ///
    /// The anchor is an **identity**, and this is the case where a position would
    /// have been the tempting encoding: the index Rust uses is derived here, from
    /// the projection the caller was shown.
    #[test]
    fn a_created_match_after_an_anchor_lands_after_it() {
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(TWO_SNIPPETS);
        let anchor = before.matches[0].id;

        let (_, created) = expect_saved(
            session
                .create_match(
                    id,
                    &new_snippet(),
                    &NewMatchPosition::After { anchor },
                    before.revision,
                    &Acknowledgement::none(),
                )
                .expect("the creation is legal"),
            "creation",
        );
        assert_eq!(
            base_bytes(&dir),
            concat!(
                "matches:\n",
                "  - trigger: ':one'\n",
                "    replace: first\n",
                "  - trigger: ':new'\n",
                "    replace: a new snippet\n",
                "  - trigger: ':two'\n",
                "    replace: second\n",
            )
        );
        assert_eq!(
            trigger_text(
                &session
                    .match_view(created.expect("a committed creation names one"))
                    .expect("it resolves")
            ),
            ":new"
        );
    } // End of function a_created_match_after_an_anchor_lands_after_it()

    /// A file whose `matches:` line has no value at all gets its first snippet.
    ///
    /// **The case that makes a fresh espanso file usable**, and the one that
    /// separates the two shapes a caller cannot tell apart from a screen: a bare
    /// key is an implicit null, which the insertion primitive promotes into its
    /// first block-sequence item, while a file with no key at all is refused by
    /// name below. The bytes around it — a second top-level key and the comment
    /// above them — are stated whole.
    #[test]
    fn a_created_match_promotes_a_bare_matches_key() {
        let source = concat!(
            "# A synthetic match file.\n",
            "matches:\n",
            "global_vars:\n",
            "  - name: greeting\n",
            "    type: echo\n",
            "    params:\n",
            "      echo: hello\n",
        );
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(source);
        assert!(
            before.matches.is_empty(),
            "the fixture must start with no snippet, or it proves nothing"
        );

        expect_saved(
            session
                .create_match(
                    id,
                    &new_snippet(),
                    &NewMatchPosition::End {},
                    before.revision,
                    &Acknowledgement::none(),
                )
                .expect("a bare key is promoted, not refused"),
            "creation",
        );
        assert_eq!(
            base_bytes(&dir),
            concat!(
                "# A synthetic match file.\n",
                "matches:\n",
                "  - trigger: ':new'\n",
                "    replace: a new snippet\n",
                "global_vars:\n",
                "  - name: greeting\n",
                "    type: echo\n",
                "    params:\n",
                "      echo: hello\n",
            ),
            "the promotion writes one item and touches nothing else"
        );
    } // End of function a_created_match_promotes_a_bare_matches_key()

    /// A file that names no `matches` key at all is refused **by name**, and
    /// nothing is attempted.
    ///
    /// The refusal is a planning-time one, so it is an `Err` rather than a
    /// `SaveResult`: no transaction ran, no lock was taken, no finding was
    /// produced, and no acknowledgement could ever change the answer. The absent
    /// backup folder is what says the transaction never started.
    #[test]
    fn a_document_with_no_matches_key_is_refused_by_name_and_writes_nothing() {
        const NO_LIST: &str =
            "global_vars:\n  - name: greeting\n    type: echo\n    params:\n      echo: hello\n";
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(NO_LIST);

        let error = session
            .create_match(
                id,
                &new_snippet(),
                &NewMatchPosition::End {},
                before.revision,
                &Acknowledgement::none(),
            )
            .expect_err("there is no list for the snippet to join");
        assert_eq!(error.code(), "documentHasNoMatchList");
        let json = serde_json::to_value(&error).expect("the refusal serializes");
        assert_eq!(json["document"], id.get());

        assert_eq!(base_bytes(&dir), NO_LIST);
        assert!(
            !dir.path().join(".espansoconfig-backups").exists(),
            "no transaction ran, so no file was copied"
        );
    } // End of function a_document_with_no_matches_key_is_refused_by_name_and_writes_nothing()

    /// An anchor in another file is refused before anything is attempted.
    ///
    /// A snippet is created in one document, exactly as a move stays in one
    /// (`PROGRESS.md` D2r). The assertion that both files are byte-identical
    /// afterwards is what says "not attempted" rather than "attempted and rolled
    /// back", which no filesystem could offer.
    #[test]
    fn an_anchor_in_another_document_is_refused_for_a_creation() {
        const ELSEWHERE: &str = "matches:\n  - trigger: ':elsewhere'\n    replace: elsewhere\n";
        let dir = tree_holding(TWO_SNIPPETS);
        fs::write(dir.path().join("match").join("other.yml"), ELSEWHERE).unwrap();
        let session = open_session(&dir);
        let here = id_of(&session, "match/base.yml");
        let there = id_of(&session, "match/other.yml");
        let mine = session.document(here).expect("the file reads");
        let theirs = session.document(there).expect("the file reads");

        let error = session
            .create_match(
                here,
                &new_snippet(),
                &NewMatchPosition::After {
                    anchor: theirs.matches[0].id,
                },
                mine.revision,
                &Acknowledgement::none(),
            )
            .expect_err("an anchor never crosses a file");
        assert_eq!(error.code(), "identityWrongDocument");
        assert_eq!(base_bytes(&dir), TWO_SNIPPETS);
        assert_eq!(
            fs::read_to_string(dir.path().join("match").join("other.yml")).unwrap(),
            ELSEWHERE
        );
    } // End of function an_anchor_in_another_document_is_refused_for_a_creation()

    /// A deletion removes one snippet, leaves every other byte alone, and names
    /// **nothing**.
    ///
    /// `moved: None` is the routine correct answer here rather than a defensive
    /// one: the snippet that was deleted has no identity in the new revision. It
    /// is deliberately not a neighbour's — see
    /// [`WorkspaceSession::delete_match`].
    #[test]
    fn a_deleted_match_leaves_every_other_byte_alone_and_names_nothing() {
        let source = concat!(
            "# A synthetic match file.\n",
            "matches:\n",
            "  - trigger: ':one'\n",
            "    replace: first\n",
            "  # about the second one\n",
            "  - trigger: ':two'\n",
            "    replace: second  # a note of its own\n",
            "  - trigger: ':three'\n",
            "    replace: third\n",
        );
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(source);
        let held = before.matches[1].id;

        let result = session
            .delete_match(held, before.revision, &Acknowledgement::none())
            .expect("the deletion is legal");
        let (_, moved) = expect_saved(result, "deletion");
        assert!(
            moved.is_none(),
            "a deleted snippet has no identity in the new revision"
        );

        assert_eq!(
            base_bytes(&dir),
            concat!(
                "# A synthetic match file.\n",
                "matches:\n",
                "  - trigger: ':one'\n",
                "    replace: first\n",
                "  - trigger: ':three'\n",
                "    replace: third\n",
            ),
            "the snippet's own leading comment and inline comment go with it, and \
             nothing else moves"
        );
        assert_eq!(
            triggers_of(&session.document(id).expect("it reads")),
            [":one", ":three"],
            "the cache must describe the bytes that were written"
        );
    } // End of function a_deleted_match_leaves_every_other_byte_alone_and_names_nothing()

    /// Deleting the only snippet of a file is refused by the engine.
    ///
    /// By design, and the refusal travels whole: emptying the list would mean
    /// writing `matches: []` — a collection this crate synthesizes for nobody — or
    /// leaving `matches:` bare, which is YAML null. Neither is "remove one
    /// existing item". The UI owes the user a sentence here, not a failed save.
    #[test]
    fn deleting_the_only_match_is_refused_by_the_engine() {
        const ONLY_ONE: &str = "matches:\n  - trigger: ':one'\n    replace: first\n";
        let Opened {
            dir,
            session,
            id: _id,
            before,
        } = opened_on(ONLY_ONE);

        let error = session
            .delete_match(
                before.matches[0].id,
                before.revision,
                &Acknowledgement::none(),
            )
            .expect_err("a list cannot be emptied by removing one item");
        assert_eq!(error.code(), "saveFailed");
        let json = serde_json::to_value(&error).expect("the error serializes");
        assert!(
            json["error"]["Patch"]["RemovalWouldEmptyTheSequence"].is_object(),
            "the engine's own reason must survive both tags: {json}"
        );
        assert_eq!(base_bytes(&dir), ONLY_ONE);
    } // End of function deleting_the_only_match_is_refused_by_the_engine()

    /// A document whose three snippets are separated by one blank line each.
    ///
    /// Synthetic and neutral (CLAUDE.md section 1). Shared by the two tests below
    /// so that the bytes they disagree about cannot be two different documents.
    const BLANK_SEPARATED: &str = concat!(
        "matches:\n",
        "  - trigger: ':one'\n",
        "    replace: first\n",
        "\n",
        "  - trigger: ':two'\n",
        "    replace: second\n",
        "\n",
        "  - trigger: ':three'\n",
        "    replace: third\n",
    );

    /// What `BLANK_SEPARATED` holds once its middle snippet is deleted.
    const BLANK_SEPARATED_AFTER: &str = concat!(
        "matches:\n",
        "  - trigger: ':one'\n",
        "    replace: first\n",
        "\n",
        "\n",
        "  - trigger: ':three'\n",
        "    replace: third\n",
    );

    /// A deletion between blank-separated snippets leaves **both** blank lines.
    ///
    /// `docs/decisions/2b-2c-1-notes.md` hole 5, seen from the command a person
    /// actually presses. A blank line beside a snippet is not the snippet's, and
    /// deciding which of the two runs to collapse is a layout decision no
    /// primitive may make — so the bytes below are the expected ones rather than a
    /// defect, and they are pinned here so that a UI cannot meet them by surprise.
    ///
    /// The **disclosure** those bytes owe is the test below this one.
    #[test]
    fn a_deletion_between_blank_separated_snippets_leaves_both_blank_lines() {
        let Opened {
            dir,
            session,
            id: _id,
            before,
        } = opened_on(BLANK_SEPARATED);

        session
            .delete_match(
                before.matches[1].id,
                before.revision,
                &Acknowledgement::none(),
            )
            .expect("the deletion is legal");
        assert_eq!(
            base_bytes(&dir),
            BLANK_SEPARATED_AFTER,
            "both blank lines survive, because neither belonged to the snippet"
        );
    } // End of function a_deletion_between_blank_separated_snippets_leaves_both_blank_lines()

    /// **The doubled separation is disclosed, not collapsed.**
    ///
    /// Q6 of `docs/reviews/phase-2b-2c-2-design.md`, delivered: *preserve both
    /// blank lines and emit a `PresentationNote` only when the deletion actually
    /// creates the doubled separation*. Plan section 6.2 forbids this application
    /// making an unrequested presentation change silently, and
    /// `SaveResult::Saved::notes` is the channel it must travel on — a backend
    /// test that only pinned the bytes could not make a UI *not surprised*.
    ///
    /// Both halves are asserted, because either alone would pass with the other
    /// broken:
    ///
    /// 1. the bytes are byte-exact and the doubled gap is still there — a note
    ///    emitted by an edit that quietly collapsed a blank line would be a note
    ///    about the wrong thing;
    /// 2. the note reaches `SaveResult::Saved` **and the wire**, as the one-key
    ///    object every wire enum variant crosses as (D5).
    ///
    /// The negative is asserted too: the same deletion in a file with no blank
    /// line beside it says nothing, so the note is a claim about this document
    /// rather than a label every deletion carries.
    #[test]
    fn deletion_that_creates_doubled_separation_returns_a_layout_presentation_note() {
        let Opened {
            dir,
            session,
            id: _id,
            before,
        } = opened_on(BLANK_SEPARATED);

        let result = session
            .delete_match(
                before.matches[1].id,
                before.revision,
                &Acknowledgement::none(),
            )
            .expect("the deletion is legal");
        let SaveResult::Saved {
            committed, notes, ..
        } = &result
        else {
            panic!("expected a saved result, got {result:?}");
        };
        assert!(committed);
        assert_eq!(
            base_bytes(&dir),
            BLANK_SEPARATED_AFTER,
            "the note reports the layout the file really holds"
        );
        assert_eq!(
            notes.as_slice(),
            [PresentationNote::DoubledSequenceSeparation { edit: 0 }],
            "the deletion owes exactly one disclosure: {notes:?}"
        );

        let json = serde_json::to_value(&result).expect("the result serializes");
        let crossed = json["notes"]
            .as_array()
            .expect("notes is a list on the wire");
        assert_eq!(crossed.len(), 1, "the note must reach the wire: {json}");
        let payload = &crossed[0]["DoubledSequenceSeparation"];
        assert!(
            payload.is_object(),
            "every note crosses as a one-key object (D5): {json}"
        );
        assert_eq!(payload["edit"], 0);

        // The negative. `TWO_SNIPPETS` has no blank line between its snippets, so
        // deleting one doubles nothing and there is nothing to disclose.
        let tight = tree_holding(TWO_SNIPPETS);
        let quiet = open_session(&tight);
        let other = id_of(&quiet, "match/base.yml");
        let read = quiet.document(other).expect("the file reads");
        let plain = quiet
            .delete_match(read.matches[0].id, read.revision, &Acknowledgement::none())
            .expect("the deletion is legal");
        let SaveResult::Saved { notes, .. } = &plain else {
            panic!("expected a saved result, got {plain:?}");
        };
        assert!(
            notes.is_empty(),
            "a deletion that doubles nothing says nothing: {notes:?}"
        );
    } // End of function deletion_that_creates_doubled_separation_returns_a_layout_presentation_note()

    /// **A stale identity never deletes whatever now occupies its old position.**
    ///
    /// The highest-risk mistake this phase could make, named by the design consult
    /// and written as the test it asked for. A [`DocumentPath`] ending in an index
    /// is a **position**: put a snippet at the front of a file and every snippet
    /// below it shifts down one, so the path that named B a moment ago now names
    /// A perfectly well. A `delete_match` that resolved a held identity's *path*
    /// against the new parse would delete A and report success.
    ///
    /// The premise is asserted before the claim, so this cannot pass vacuously:
    /// B's former path really does address A after the creation. Then the stale
    /// call must refuse, and **every byte** of the post-creation file must still
    /// be there.
    #[test]
    fn delete_match_never_deletes_the_item_at_a_stale_ids_old_path() {
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(TWO_SNIPPETS);
        assert_eq!(triggers_of(&before), [":one", ":two"]);
        // B, and the revision it was minted from. Both go stale below.
        let held = before.matches[1].id;
        let held_path = before.matches[1]
            .path
            .clone()
            .expect("a projected snippet has a path");
        let stale_revision = before.revision;

        // X is created at the front and committed, so everything shifts down one.
        expect_saved(
            session
                .create_match(
                    id,
                    &new_snippet(),
                    &NewMatchPosition::Front {},
                    stale_revision,
                    &Acknowledgement::none(),
                )
                .expect("the creation is legal"),
            "creation",
        );
        let after_create = base_bytes(&dir);
        let refreshed = session.document(id).expect("the file still reads");
        assert_eq!(triggers_of(&refreshed), [":new", ":one", ":two"]);

        // The premise, asserted rather than assumed: B's former path now names A.
        let at_the_old_path = refreshed
            .matches
            .iter()
            .find(|candidate| candidate.path.as_ref() == Some(&held_path))
            .expect("the held path still resolves, which is the whole problem");
        assert_eq!(
            trigger_text(at_the_old_path),
            ":one",
            "if this is not the other snippet, the fixture stopped exercising the shift"
        );

        // The claim: the stale identity refuses, and nothing is written.
        let error = session
            .delete_match(held, stale_revision, &Acknowledgement::none())
            .expect_err("an identity from the previous revision must not delete anything");
        assert_eq!(
            error.code(),
            "identityStaleRevision",
            "the refusal must be the re-resolve instruction, not a lookup miss: {error:?}"
        );
        assert_eq!(
            base_bytes(&dir),
            after_create,
            "every byte of the post-creation file must survive a refused deletion"
        );
        assert_eq!(
            triggers_of(&session.document(id).expect("it reads")),
            [":new", ":one", ":two"],
            "and the snippet at the stale path must still be there"
        );
    } // End of function delete_match_never_deletes_the_item_at_a_stale_ids_old_path()

    /// Ordinary creation, crossed end to end: all six fields go in, a repeated
    /// literal trigger refuses, the exact findings come back, and the committed
    /// bytes hold every optional key.
    ///
    /// **The evidence `create_match` itself owes.** `tests/persist_save.rs`
    /// establishes what the save transaction does with a hand-built
    /// `InsertItem`, but it builds that insertion from `NewMatch::fields()`
    /// itself, so it cannot see `create_one_match`'s lowering at all: a mutation
    /// that dropped the four optional fields on the way in, or that reached the
    /// transaction by some route the new risk producer does not run on, would
    /// leave every one of those tests green. This one starts at
    /// `WorkspaceSession::create_match` and ends at the bytes on disk.
    ///
    /// Four claims, in order:
    ///
    /// 1. the plain-creation path really does reach
    ///    `FindingCode::NewMatchRepeatsLiteralTrigger` — `:one` is already in the
    ///    file — and the refusal is the suspicion arm rather than a model error;
    /// 2. **a refused save writes nothing**, asserted as the whole file;
    /// 3. the exact findings, handed back unchanged, are what lets it proceed —
    ///    there is no force flag in either call;
    /// 4. the committed file holds all six keys in the documented order, and
    ///    every byte of the two snippets that were already there survives.
    #[test]
    fn an_ordinary_creation_carries_six_fields_and_reports_a_repeated_trigger() {
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(TWO_SNIPPETS);
        // The six-field shape a recovery will send, and the shape today's creator
        // form cannot: `:one` is the trigger the file's first snippet already
        // writes.
        let recovered = NewMatch {
            trigger: ":one".to_owned(),
            replace: "a recovered body".to_owned(),
            label: Some("a recovered label".to_owned()),
            word: Some("true".to_owned()),
            left_word: Some("false".to_owned()),
            right_word: Some("on".to_owned()),
        };

        let refusal = session
            .create_match(
                id,
                &recovered,
                &NewMatchPosition::End {},
                before.revision,
                &Acknowledgement::none(),
            )
            .expect("a refusal is an outcome, not an error");
        let findings = match refusal {
            SaveResult::Refused { verdict, findings } => {
                assert_eq!(
                    verdict,
                    SaveVerdict::RefusedForUnacknowledgedSuspicions,
                    "a repeated trigger is a suspicion, never an editor-model error"
                );
                findings
            }
            other => panic!("expected a refusal, got {other:?}"),
        };
        assert_eq!(
            findings.len(),
            1,
            "one finding, the creation's own: {findings:?}"
        );
        assert!(
            matches!(
                findings[0].code,
                FindingCode::NewMatchRepeatsLiteralTrigger { .. }
            ),
            "{:?}",
            findings[0].code
        );
        assert_eq!(
            base_bytes(&dir),
            TWO_SNIPPETS,
            "a refused creation writes nothing at all"
        );

        expect_saved(
            session
                .create_match(
                    id,
                    &recovered,
                    &NewMatchPosition::End {},
                    before.revision,
                    &Acknowledgement::of(&findings),
                )
                .expect("the acknowledged creation proceeds"),
            "creation",
        );
        assert_eq!(
            base_bytes(&dir),
            concat!(
                "matches:\n",
                "  - trigger: ':one'\n",
                "    replace: first\n",
                "  - trigger: ':two'\n",
                "    replace: second\n",
                "  - trigger: ':one'\n",
                "    replace: a recovered body\n",
                "    label: a recovered label\n",
                "    word: 'true'\n",
                "    left_word: 'false'\n",
                "    right_word: 'on'\n",
            ),
            "all six keys, in the documented order, and every byte of the two snippets \
             that were already there unchanged; each value's spelling is the encoder's \
             decision, which is why `true` is quoted and a sentence is not"
        );
    } // End of function an_ordinary_creation_carries_six_fields_and_reports_a_repeated_trigger()

    /// A creation refused by the semantic gate proceeds once its findings come
    /// back.
    ///
    /// The acknowledgement protocol is the transaction's, and a creation inherits
    /// it whole rather than re-implementing half of it. The new snippet's body
    /// holds an unresolved reference, which is what the gate reports; there is no
    /// `force` flag in either call.
    #[test]
    fn a_suspicion_refuses_a_creation_until_the_findings_come_back() {
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(TWO_SNIPPETS);
        let suspicious = NewMatch {
            trigger: ":greet".to_owned(),
            replace: "hello {{nobody}}".to_owned(),
            label: None,
            word: None,
            left_word: None,
            right_word: None,
        };

        let refusal = session
            .create_match(
                id,
                &suspicious,
                &NewMatchPosition::End {},
                before.revision,
                &Acknowledgement::none(),
            )
            .expect("a refusal is an outcome, not an error");
        let findings = match refusal {
            SaveResult::Refused { findings, .. } => findings,
            other => panic!("expected a refusal, got {other:?}"),
        };
        assert!(!findings.is_empty(), "a refusal carries its evidence");
        assert_eq!(
            base_bytes(&dir),
            TWO_SNIPPETS,
            "a refused save writes nothing"
        );

        expect_saved(
            session
                .create_match(
                    id,
                    &suspicious,
                    &NewMatchPosition::End {},
                    before.revision,
                    &Acknowledgement::of(&findings),
                )
                .expect("the acknowledged creation proceeds"),
            "creation",
        );
        assert_eq!(
            triggers_of(&session.document(id).expect("it reads")),
            [":one", ":two", ":greet"]
        );
    } // End of function a_suspicion_refuses_a_creation_until_the_findings_come_back()

    // -----------------------------------------------------------------------
    // duplicate_match — Phase 2c-3c-2
    // -----------------------------------------------------------------------

    /// A duplicate is refused until its trigger finding comes back, then copies
    /// the bytes and answers with the clone's identity.
    ///
    /// **The whole ordinary path of this command, which is refuse-then-commit by
    /// design**: a duplicate keeps its source's trigger definition, so the first
    /// attempt is interrupted by `DuplicateKeepsTriggerDefinition` — bound to the
    /// candidate by its own revision operand — and the same call with exactly
    /// those findings acknowledged commits. Then the three claims every writing
    /// command makes: the bytes on disk are the expected ones (the clone is a
    /// byte-exact copy and everything else is untouched), `moved` is the
    /// **clone's** identity and it resolves at the post-insertion path, and the
    /// identity held before the save is stale.
    #[test]
    fn a_duplicate_is_refused_until_the_findings_come_back_then_names_the_clone() {
        use espansoconfig_core::validate::FindingCode;

        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");
        let held = before.matches[0].id;

        let refused = session
            .duplicate_match(held, before.revision, &Acknowledgement::none())
            .expect("a refusal is an outcome, not a failure");
        let findings = match refused {
            SaveResult::Refused { verdict, findings } => {
                assert_eq!(
                    verdict,
                    espansoconfig_core::persist::SaveVerdict::RefusedForUnacknowledgedSuspicions
                );
                assert!(
                    findings.iter().any(|finding| matches!(
                        finding.code,
                        FindingCode::DuplicateKeepsTriggerDefinition { .. }
                    )),
                    "the refusal must carry the duplicate's own suspicion: {findings:?}"
                );
                findings
            }
            other => panic!("expected a refusal, got {other:?}"),
        };
        assert_eq!(base_bytes(&dir), BASE_YML, "a refused save writes nothing");

        // The round trip a real caller makes: the findings were serialized to
        // the interface, and the acknowledgement arrives back as JSON.
        let payload = serde_json::json!({ "accepted": findings });
        let acknowledgement: Acknowledgement =
            serde_json::from_value(payload).expect("an acknowledgement reads back");

        let (revision, moved) = expect_saved(
            session
                .duplicate_match(held, before.revision, &acknowledgement)
                .expect("the acknowledged duplicate proceeds"),
            "duplicate",
        );
        assert_ne!(revision, before.revision, "the file was rewritten");
        assert_eq!(
            base_bytes(&dir),
            concat!(
                "# A synthetic match file.\n",
                "matches:\n",
                "  - trigger: ':one'\n",
                "    replace: first\n",
                "  - trigger: ':one'\n",
                "    replace: first\n",
                "  - trigger: ':two'\n",
                "    replace: second\n",
                "    invented_by_a_later_espanso: yes\n",
            ),
            "the clone is a byte-exact copy immediately after its source"
        );

        // The clone's identity resolves, at the post-insertion path.
        let moved = moved.expect("a committed duplicate names the clone");
        let found = session
            .match_view(moved)
            .expect("the identity the command answered with must resolve");
        assert_eq!(trigger_text(&found), ":one");
        assert_eq!(
            found.path,
            Some(
                espansoconfig_core::patch::DocumentPath::root(0)
                    .with_key("matches")
                    .with_index(1)
            ),
            "moved must name the clone, one slot below its source"
        );

        // Every identity minted before the commit is stale, the source's included.
        let stale = session
            .match_view(held)
            .expect_err("the identity held before the save is minted from the old revision");
        assert_eq!(stale.code(), "identityStaleRevision");

        // Cache coherence: what the session serves is what is on disk.
        let after = session.document(id).expect("the file still reads");
        assert_eq!(triggers_of(&after), [":one", ":one", ":two"]);
        assert_eq!(session.text(id).expect("the bytes read"), base_bytes(&dir));
    } // End of function a_duplicate_is_refused_until_the_findings_come_back_then_names_the_clone()

    /// The acknowledgement is bound to the candidate, not to the request.
    ///
    /// The finding's `revision` operand is the candidate's own content hash
    /// (`docs/decisions/2c-3c-1-notes.md` section 6.1), so it must differ from
    /// the base the request was made against — an acknowledgement copied from a
    /// different candidate would not match. Asserted here at the command layer
    /// because this is the boundary a real caller round-trips it across; the
    /// same-length-rewrite transfer case is pinned in the core's own
    /// `persist_save.rs`.
    #[test]
    fn a_duplicates_finding_carries_the_candidates_own_revision() {
        use espansoconfig_core::validate::FindingCode;

        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let before = session.document(id).expect("the file reads");

        let refused = session
            .duplicate_match(
                before.matches[0].id,
                before.revision,
                &Acknowledgement::none(),
            )
            .expect("a refusal is an outcome, not a failure");
        let SaveResult::Refused { findings, .. } = refused else {
            panic!("expected a refusal");
        };
        let operand = findings
            .iter()
            .find_map(|finding| match &finding.code {
                FindingCode::DuplicateKeepsTriggerDefinition { revision } => Some(*revision),
                _ => None,
            })
            .expect("the duplicate's suspicion is among the findings");
        assert_ne!(
            operand, before.revision,
            "the operand is the candidate's hash, never the base the request named"
        );
    } // End of function a_duplicates_finding_carries_the_candidates_own_revision()

    /// A stale base revision is refused before a duplicate is planned.
    ///
    /// The same claim `delete_match_never_deletes_the_item_at_a_stale_ids_old_path`
    /// makes for a deletion: an identity resolved against another parse names a
    /// **position**, and the bytes at that position may belong to a different
    /// snippet — which this command would then copy.
    #[test]
    fn a_stale_base_revision_is_refused_before_a_duplicate_is_planned() {
        let dir = synthetic_tree();
        let session = open_session(&dir);
        let id = id_of(&session, "match/base.yml");
        let view = session.document(id).expect("the file reads");
        let error = session
            .duplicate_match(
                view.matches[0].id,
                espansoconfig_core::ContentRevision::of_bytes(b"not this file"),
                &Acknowledgement::none(),
            )
            .expect_err("a base the session does not hold is refused");
        assert_eq!(error.code(), "identityStaleRevision");
        assert_eq!(base_bytes(&dir), BASE_YML, "nothing was attempted");
    } // End of function a_stale_base_revision_is_refused_before_a_duplicate_is_planned()

    /// A committed save whose re-read fails still answers `Saved`, and names
    /// nothing — with no second writer anywhere.
    ///
    /// **Review round 1, finding 2's boundary case.** `moved: None` on a commit
    /// means only that the clone — or the moved or created snippet — could not
    /// be identified in the read that followed the write, and this is the
    /// history that tells that apart from *the file changed again*: the file
    /// becomes unreadable between the transaction's return and the re-read,
    /// and nothing else touched it. No command can produce the interleaving —
    /// both reads happen inside one synchronous call — so the shared tail is
    /// driven directly, which is what a free function is for. Any sentence
    /// built on `moved: None` that asserts a second writer is falsified by this
    /// test's premise.
    #[test]
    fn a_committed_save_whose_re_read_fails_names_nothing_and_stays_saved() {
        use espansoconfig_core::persist::SavedDocument;
        use espansoconfig_core::workspace::Workspace;

        let dir = tree_holding(BASE_YML);
        let mut workspace = Workspace::discover(Some(dir.path())).expect("a directory");
        let id = workspace
            .list_documents()
            .iter()
            .find(|summary| summary.relative_path == Path::new("match/base.yml"))
            .expect("the file is listed")
            .id;
        workspace.document_view(id).expect("the file reads");

        // The interleaving no command can produce: the commit happened, and
        // the file is gone by the time the re-read runs.
        fs::remove_file(dir.path().join("match").join("base.yml")).unwrap();
        let saved = SavedDocument {
            revision: ContentRevision::of_bytes(b"the bytes the rename installed"),
            text: String::new(),
            replacements: Vec::new(),
            notes: Vec::new(),
            findings: Vec::new(),
            committed: true,
            backup: None,
        };
        let landed = espansoconfig_core::patch::DocumentPath::root(0)
            .with_key("matches")
            .with_index(1);
        match super::after_a_save(&mut workspace, id, Some(&landed), saved) {
            SaveResult::Saved {
                committed, moved, ..
            } => {
                assert!(committed, "a failed re-read never takes the commit back");
                assert!(
                    moved.is_none(),
                    "a re-read that failed cannot mint an identity — and no second writer exists"
                );
            }
            other => panic!("a committed save is answered as Saved, got {other:?}"),
        } // End of the match over the tail's answer
    } // End of function a_committed_save_whose_re_read_fails_names_nothing_and_stays_saved()

    // -----------------------------------------------------------------------
    // save_raw_document — Phase 2b-2c-3b
    // -----------------------------------------------------------------------

    /// A file whose bytes an editor would want to be careful with.
    ///
    /// Hand-authored and neutral (CLAUDE.md section 1). It carries a leading
    /// UTF-8 BOM, one CRLF pair among bare LFs, a **decomposed** `e`-acute, an
    /// astral character and no final newline — five things an emitter,
    /// normaliser or "tidy on save" would each have an opinion about, and none of
    /// which a replacement may touch.
    const DELICATE_YML: &str =
        "\u{feff}matches:\r\n  - trigger: ':caf\u{65}\u{301}'\n    replace: \u{1f600}";

    /// A text the YAML substrate rejects, and every candidate below that shares
    /// its invalid prefix.
    ///
    /// The prefix is what makes the acknowledgement question sharp: the parser
    /// stops in the same place for every text below, so the position operands
    /// alone cannot tell them apart.
    const BROKEN_PREFIX: &str = "matches: broken: here";

    /// The identity and modification time of `<root>/match/base.yml`.
    ///
    /// **What a content revision cannot say.** A hash tells "the bytes are the
    /// same"; it cannot tell *not written* from *rewritten with the same bytes*,
    /// and every commit here installs a new inode by renaming a temporary file
    /// over the target. So a test that means "nothing was written" observes this.
    fn base_identity(dir: &TempDir) -> (u64, std::time::SystemTime) {
        use std::os::unix::fs::MetadataExt;

        let metadata = fs::metadata(dir.path().join("match").join("base.yml")).expect("it exists");
        (metadata.ino(), metadata.modified().expect("a mtime"))
    }

    /// The `Refused` arm's findings, or a panic naming what arrived instead.
    fn expect_refused(
        result: SaveResult,
        what: &str,
    ) -> Vec<espansoconfig_core::validate::Finding> {
        match result {
            SaveResult::Refused { findings, .. } => findings,
            other => panic!("expected {what} to be refused, got {other:?}"),
        }
    }

    /// Whether a finding is the parse rejection this mode can produce.
    fn is_parse_rejection(finding: &espansoconfig_core::validate::Finding) -> bool {
        matches!(
            finding.code,
            espansoconfig_core::validate::FindingCode::DocumentDoesNotParse { .. }
        )
    }

    /// A replacement commits the exact bytes submitted, and names nothing.
    ///
    /// **Four claims in one, because they are one behaviour.** The submitted text
    /// is what reaches the disk — byte for byte, with its BOM, its one CRLF, its
    /// decomposition, its astral character and its missing final newline intact;
    /// the answer carries no identity, because a replacement has no single match
    /// to name; it discloses no presentation change, because it re-encodes
    /// nothing; and the session serves the new bytes and the new projection
    /// afterwards without a reload.
    #[test]
    fn a_raw_replacement_commits_the_submitted_bytes_and_names_nothing() {
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(BASE_YML);

        let result = session
            .save_raw_document(id, before.revision, DELICATE_YML, &Acknowledgement::none())
            .expect("the replacement is legal");
        let (revision, moved) = match result {
            SaveResult::Saved {
                revision,
                committed,
                notes,
                backup_taken,
                moved,
            } => {
                assert!(committed, "the bytes differ, so the file is rewritten");
                assert!(
                    notes.is_empty(),
                    "a replacement re-encodes nothing and has nothing to disclose: {notes:?}"
                );
                assert!(backup_taken, "the session must have copied the file first");
                (revision, moved)
            }
            other => panic!("expected a saved result, got {other:?}"),
        };
        assert!(
            moved.is_none(),
            "a replacement invalidates every identity at once and names none: {moved:?}"
        );
        assert_ne!(revision, before.revision, "the file was rewritten");

        // The bytes on disk, not a projection of them.
        assert_eq!(
            base_bytes(&dir),
            DELICATE_YML,
            "the submitted text must be committed exactly as submitted"
        );
        assert_eq!(
            revision,
            ContentRevision::of_bytes(DELICATE_YML.as_bytes()),
            "the answered revision must be the revision of the bytes that were written"
        );

        // And the session is reading them, from both surfaces that could serve a
        // stale parse.
        assert_eq!(
            session.text(id).expect("the bytes read"),
            DELICATE_YML,
            "the cache must have been brought back in step"
        );
        let after = session.document(id).expect("the file still reads");
        assert_eq!(after.revision, revision);
        // Written as escapes, because the trigger the fixture holds is the
        // **decomposed** spelling and an editor that normalised this source file
        // would otherwise turn the assertion into a different claim.
        assert_eq!(triggers_of(&after), [":caf\u{65}\u{301}"]);
    } // End of function a_raw_replacement_commits_the_submitted_bytes_and_names_nothing()

    /// A text identical to what the file already holds is a success that writes
    /// nothing.
    ///
    /// **Observed as the file's identity, not as a hash.** A content revision
    /// cannot tell *not written* from *rewritten with the same bytes*, and every
    /// commit renames a fresh temporary file over the target — so the inode and
    /// the modification time are what say the file was left alone. The second
    /// half saves a text that really differs and asserts that the identity *does*
    /// change, so the check means something on this filesystem rather than being
    /// a comparison that could never fail.
    #[test]
    fn a_byte_identical_replacement_is_a_success_that_writes_nothing() {
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(BASE_YML);
        let identity_before = base_identity(&dir);

        let result = session
            .save_raw_document(id, before.revision, BASE_YML, &Acknowledgement::none())
            .expect("submitting what the file already holds is legal");
        match result {
            SaveResult::Saved {
                revision,
                committed,
                backup_taken,
                moved,
                ..
            } => {
                assert!(!committed, "identical bytes are not rewritten");
                assert!(!backup_taken, "nothing was replaced, so nothing was copied");
                assert!(moved.is_none());
                assert_eq!(
                    revision, before.revision,
                    "the file still holds those bytes"
                );
            }
            other => panic!("expected a saved result, got {other:?}"),
        }
        assert_eq!(
            base_identity(&dir),
            identity_before,
            "a commit that was skipped must leave the file's own identity alone"
        );

        // Non-vacuity: a replacement that really changes the file does install a
        // new inode, so the observation above can fail.
        session
            .save_raw_document(id, before.revision, DELICATE_YML, &Acknowledgement::none())
            .expect("the replacement is legal");
        assert_ne!(
            base_identity(&dir).0,
            identity_before.0,
            "a real commit must be distinguishable from a skipped one"
        );
    } // End of function a_byte_identical_replacement_is_a_success_that_writes_nothing()

    /// A raw save never overwrites bytes written after the editor loaded the
    /// file.
    ///
    /// **Design consult Q7's named test, and the highest risk this whole mode
    /// carries.** The scenario is the one a raw editor makes easy: a person opens
    /// a file's text, goes away, something else — espanso, vim, a sync agent —
    /// rewrites the file, and the person then presses save.
    ///
    /// Note what the session's own cache says at that moment: **nothing**. It
    /// still holds the projection the editor loaded, so a pre-check against it
    /// would *pass*. That is why `save_raw_document` deliberately does not take
    /// one, and why the check that protects the user is the transaction's, taken
    /// under the write lock. This test drives exactly that path.
    ///
    /// It asserts the outcome **and the disk**, because "reported a conflict" and
    /// "wrote nothing" are two statements: the other writer's bytes are still
    /// there, under the same inode, so no rename happened at all.
    #[test]
    fn a_stale_raw_save_never_overwrites_the_bytes_written_after_it_loaded() {
        const OTHER_WRITER: &str = concat!(
            "matches:\n",
            "  - trigger: ':one'\n",
            "    replace: rewritten by somebody else\n",
        );
        const CANDIDATE: &str = "matches:\n  - trigger: ':mine'\n    replace: my own text\n";

        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(BASE_YML);

        // Something else replaces the file while this session is idle. The
        // session is deliberately *not* told, which is the whole scenario.
        fs::write(dir.path().join("match").join("base.yml"), OTHER_WRITER).unwrap();
        let theirs = ContentRevision::of_bytes(OTHER_WRITER.as_bytes());
        assert_eq!(
            session.document(id).expect("the cache answers").revision,
            before.revision,
            "the premise: this session still believes the file holds what it loaded"
        );
        let identity_before = base_identity(&dir);

        let result = session
            .save_raw_document(id, before.revision, CANDIDATE, &Acknowledgement::none())
            .expect("a conflict is an outcome, not a failure");
        match result {
            SaveResult::Conflict {
                expected,
                found,
                disk_revision,
                disk_text,
                reapply,
                disk,
            } => {
                assert_eq!(expected, before.revision, "the base the editor loaded");
                assert_eq!(found, theirs, "the bytes that refused the save");
                assert_eq!(disk_revision, theirs, "the fresh read taken afterwards");
                // The raw editor's permanent answer. A whole-document
                // replacement has no target to find again and is placed after
                // nothing, so there is nothing for either correspondence to be
                // about — and this is a property of the operation rather than of
                // what the disk happens to hold.
                assert_eq!(
                    reapply,
                    espansoconfig_core::reconcile::ReapplyEvidence {
                        subject: espansoconfig_core::reconcile::ReapplyResolution::Unsupported {},
                        placement: espansoconfig_core::reconcile::ReapplyPlacement::NotAnchored {},
                    },
                    "a raw save answers unsupported, whatever the disk holds"
                );
                assert_eq!(
                    triggers_of(&disk),
                    [":one"],
                    "the payload projects the other writer's file, which is what a raw \
                     editor has to show"
                );
                assert_eq!(
                    disk_text, OTHER_WRITER,
                    "and carries the whole file, which a projection cannot stand in for"
                );
            }
            other => panic!("expected a conflict, got {other:?}"),
        }

        // The disk, which is the claim that matters: the other writer's bytes are
        // untouched, and under the same inode, so nothing was renamed over them.
        assert_eq!(
            base_bytes(&dir),
            OTHER_WRITER,
            "a stale raw save must not overwrite the bytes written after it loaded"
        );
        assert_eq!(
            base_identity(&dir),
            identity_before,
            "and must not have written the file at all"
        );
        assert_eq!(
            session.document(id).expect("the file reads").revision,
            theirs,
            "the session is left reading the bytes the next save will be checked against"
        );
    } // End of function a_stale_raw_save_never_overwrites_the_bytes_written_after_it_loaded()

    /// A candidate the YAML reader rejects is refused first and committed when
    /// that finding comes back.
    ///
    /// **The owner's ruling, end to end through the command layer.** The consult
    /// said not to write text the parser rejects; the owner reversed it, because
    /// refusing means this application cannot repair a file that is already
    /// broken. So the parse is a **fact the transaction reports**, not a gate:
    /// first attempt refused with `DocumentDoesNotParse` and nothing written,
    /// second attempt with that exact finding acknowledged **committed**.
    ///
    /// The last third is the reason the ruling exists: the file now on disk does
    /// not parse, and it is still repairable — a further replacement with valid
    /// text goes through, with no acknowledgement needed, because the *candidate*
    /// is what is parsed rather than the target.
    #[test]
    fn an_unparseable_candidate_is_refused_and_then_committed_when_acknowledged() {
        let broken = format!("{BROKEN_PREFIX}\nfirst\n");
        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(BASE_YML);
        let identity_before = base_identity(&dir);

        let findings = expect_refused(
            session
                .save_raw_document(id, before.revision, &broken, &Acknowledgement::none())
                .expect("a refusal is an outcome, not a failure"),
            "a text the reader cannot read",
        );
        assert_eq!(findings.len(), 1);
        assert!(
            is_parse_rejection(&findings[0]),
            "the refusal must be the parse rejection: {findings:?}"
        );
        assert_eq!(
            base_bytes(&dir),
            BASE_YML,
            "a refused replacement writes nothing"
        );
        assert_eq!(base_identity(&dir), identity_before);

        // The same call, with exactly what it was shown, writes it.
        let result = session
            .save_raw_document(
                id,
                before.revision,
                &broken,
                &Acknowledgement::of(&findings),
            )
            .expect("the acknowledged replacement proceeds");
        match result {
            SaveResult::Saved {
                committed, moved, ..
            } => {
                assert!(committed, "the acknowledged text is written");
                assert!(moved.is_none());
            }
            other => panic!("expected a saved result, got {other:?}"),
        }
        assert_eq!(base_bytes(&dir), broken, "the user's bytes reach the disk");

        // And a file this application cannot parse is still a file it can repair:
        // it crosses as a view rather than as an error, and the next replacement
        // needs no acknowledgement because the *candidate* is what is parsed.
        let unparseable = session.document(id).expect("a broken file is still a view");
        assert!(!unparseable.parsed);
        let repaired = session
            .save_raw_document(id, unparseable.revision, BASE_YML, &Acknowledgement::none())
            .expect("repairing a broken file is the point of this mode");
        match repaired {
            SaveResult::Saved {
                committed,
                backup_taken,
                ..
            } => {
                assert!(committed, "the repair is written");
                // Not `expect_saved`: this session has already copied this file,
                // and a second copy is deliberately not taken. The first snapshot
                // **is** the recoverable pre-commit image, and overwriting it
                // would be worse than keeping it.
                assert!(!backup_taken, "one session copies one file once");
            }
            other => panic!("expected a saved result, got {other:?}"),
        }
        assert_eq!(base_bytes(&dir), BASE_YML);
    } // End of function an_unparseable_candidate_is_refused_and_then_committed_when_acknowledged()

    /// Consent collected for one broken text does not commit another.
    ///
    /// **The defect Phase 2b-2c-3a's review found, seen from the command layer.**
    /// The two candidates share the invalid prefix and differ only after it, so
    /// the parser stops at the same line, the same column and the same byte with
    /// the same words — and the finding tells them apart only because it carries
    /// the **candidate's own content revision**.
    ///
    /// The premise is asserted first, so the test cannot pass vacuously on a pair
    /// that never collided: without it, a `line`/`column` that happened to differ
    /// would make the refusal below prove nothing.
    ///
    /// **The premise is asserted operand by operand**, which is the 2b-2c-3b
    /// review's fourth finding. Comparing the two whole codes for inequality is
    /// not the same claim: it would still hold if the line, the column, the byte
    /// offset or the parser's own message differed, and in that case the
    /// `revision` operand would *not* be what tells the findings apart — so the
    /// test would pass while measuring something other than what it is named
    /// after. Each `revision` is compared against the hash of its **own**
    /// candidate rather than only against the other, so "content-addressed to the
    /// candidate" is asserted rather than inferred from a difference.
    #[test]
    fn an_acknowledgement_minted_for_another_candidate_does_not_commit_this_one() {
        let first = format!("{BROKEN_PREFIX}\nfirst\n");
        let second = format!("{BROKEN_PREFIX}\nsecond and longer\n");
        assert_ne!(first, second, "the two candidates must really differ");

        let Opened {
            dir,
            session,
            id,
            before,
        } = opened_on(BASE_YML);

        let for_first = expect_refused(
            session
                .save_raw_document(id, before.revision, &first, &Acknowledgement::none())
                .expect("a refusal is an outcome"),
            "the first broken text",
        );
        let for_second = expect_refused(
            session
                .save_raw_document(id, before.revision, &second, &Acknowledgement::none())
                .expect("a refusal is an outcome"),
            "the second broken text",
        );
        // The premise: everything the parser said about the two is identical, and
        // the revision each names is the hash of the text it is about.
        let (one, two) = (&for_first[0], &for_second[0]);
        assert_eq!(one.span, two.span);
        assert_eq!(one.node, two.node);
        assert_eq!(one.path, two.path);
        let (
            espansoconfig_core::validate::FindingCode::DocumentDoesNotParse {
                revision: first_revision,
                line: first_line,
                column: first_column,
                byte_index: first_byte,
                detail: first_detail,
            },
            espansoconfig_core::validate::FindingCode::DocumentDoesNotParse {
                revision: second_revision,
                line: second_line,
                column: second_column,
                byte_index: second_byte,
                detail: second_detail,
            },
        ) = (&one.code, &two.code)
        else {
            panic!(
                "both refusals must be parse rejections, got {:?} and {:?}",
                one.code, two.code
            );
        };
        assert_eq!(first_line, second_line, "the parser stopped on one line");
        assert_eq!(
            first_column, second_column,
            "the parser stopped in one column"
        );
        assert_eq!(first_byte, second_byte, "the parser stopped at one byte");
        assert_eq!(
            first_detail, second_detail,
            "the parser said one thing about both"
        );
        // And the one operand that does differ, each checked against its own
        // candidate rather than only against the other.
        assert_eq!(
            *first_revision,
            ContentRevision::of_bytes(first.as_bytes()),
            "the finding must name the candidate it is about"
        );
        assert_eq!(
            *second_revision,
            ContentRevision::of_bytes(second.as_bytes()),
            "the finding must name the candidate it is about"
        );
        assert_ne!(
            first_revision, second_revision,
            "only the candidate's own revision can be telling these two apart"
        );
        let identity_before = base_identity(&dir);

        // The first text's consent, spent on the second text.
        let refused = expect_refused(
            session
                .save_raw_document(
                    id,
                    before.revision,
                    &second,
                    &Acknowledgement::of(&for_first),
                )
                .expect("a refusal is an outcome"),
            "the second text carrying the first text's acknowledgement",
        );
        assert!(is_parse_rejection(&refused[0]));
        assert_eq!(
            base_bytes(&dir),
            BASE_YML,
            "consent for one text must not write another"
        );
        assert_eq!(base_identity(&dir), identity_before);

        // And the right acknowledgement does commit, so the test cannot pass by
        // refusing everything.
        session
            .save_raw_document(
                id,
                before.revision,
                &second,
                &Acknowledgement::of(&for_second),
            )
            .expect("the second text's own acknowledgement proceeds");
        assert_eq!(base_bytes(&dir), second);
    } // End of function an_acknowledgement_minted_for_another_candidate_does_not_commit_this_one()

    /// An address that does not end in a sequence position is not a move's end.
    ///
    /// The pure half of `CommandError::MoveNotWithinOneSequence`, and the reason
    /// it is tested here rather than through the command: **every match a
    /// projection holds is an item of the one `matches` sequence at the root of
    /// stream document 0**, so two matches of one file are always siblings and the
    /// cross-sequence branch cannot be reached through `move_match` today. That is
    /// a fact about the projection, not a guarantee about the check, so the check
    /// is exercised where it can be — against the addresses themselves.
    #[test]
    fn only_an_address_ending_in_a_position_names_a_sequence_item() {
        use espansoconfig_core::patch::DocumentPath;

        let item = DocumentPath::root(0).with_key("matches").with_index(2);
        assert_eq!(
            super::sequence_of(&item),
            Some((DocumentPath::root(0).with_key("matches"), 2))
        );

        // A field of a match, not an item of a sequence.
        let field = DocumentPath::root(0)
            .with_key("matches")
            .with_index(2)
            .with_key("replace");
        assert_eq!(super::sequence_of(&field), None);
        // The root itself.
        assert_eq!(super::sequence_of(&DocumentPath::root(0)), None);
        // Two items of the same sequence share a container; two of different
        // sequences do not, which is the comparison the refusal is made of.
        let sibling = DocumentPath::root(0).with_key("matches").with_index(5);
        let stranger = DocumentPath::root(0).with_key("global_vars").with_index(0);
        assert_eq!(
            super::sequence_of(&item).map(|(sequence, _)| sequence),
            super::sequence_of(&sibling).map(|(sequence, _)| sequence)
        );
        assert_ne!(
            super::sequence_of(&item).map(|(sequence, _)| sequence),
            super::sequence_of(&stranger).map(|(sequence, _)| sequence)
        );
        // And a second stream document is a different sequence even under the
        // same key, which is what `document_index` is carried for.
        let elsewhere = DocumentPath::root(1).with_key("matches").with_index(0);
        assert_ne!(
            super::sequence_of(&item).map(|(sequence, _)| sequence),
            super::sequence_of(&elsewhere).map(|(sequence, _)| sequence)
        );
    } // End of function only_an_address_ending_in_a_position_names_a_sequence_item()

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
