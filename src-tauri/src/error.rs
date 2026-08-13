//! The error representation that crosses the IPC boundary.
//!
//! Plan section 9: *Rust returns error codes and structured data, never
//! user-facing prose.* [`CommandError`] is that rule as a type. Every variant
//! is a stable machine `code` plus operands that are paths, numbers and other
//! codes; the sentence a user reads is built in the frontend from the code and
//! those operands, in whichever of the two languages is showing.
//!
//! # Three decisions worth stating, because each of them could have gone the
//! other way
//!
//! 1. **This type is defined here and not in the core.** The core's
//!    `WorkspaceError`, `DiscoveryError` and `IdentityError` already serialize
//!    as codes and operands, and this layer could have forwarded them
//!    unchanged. It does not, for two reasons: the shell has failure modes the
//!    core has no vocabulary for ([`CommandError::NoWorkspaceOpen`] is a fact
//!    about the session, not about any file), and the core's nesting —
//!    `{ code: "identity", identity: { "StaleRevision": … } }` — makes the one
//!    code the frontend most needs to branch on two levels deep and spelled in
//!    a different convention from its neighbours. Flattening the nine reachable
//!    conditions into nine top-level codes is what makes the frontend's
//!    `switch` on `error.code` exhaustive.
//! 2. **There is no `Display` impl.** Not a narrow one, not a developer-only
//!    one. The core has them and documents them as log renderings; here, where
//!    the value is one `?` away from being serialized to a webview, the safest
//!    rendering is none at all. `Debug` covers logging.
//! 3. **`Serialize` is hand-written, and it writes [`CommandError::code`].**
//!    A `#[serde(tag = "code", rename = …)]` derive would produce the same JSON
//!    and would spell every code **twice** — once in the attribute and once in
//!    any accessor Rust code branches on. Writing the impl by hand costs forty
//!    lines and leaves exactly one spelling of each code in the crate, which is
//!    the spelling `src/lib/ipc/errors.ts` is checked against.
//!
//! 4. **Every path operand is an [`espansoconfig_core::wire::WirePath`], not a
//!    `PathBuf`.** `serde`'s own `PathBuf` serializer *fails* on a path that is
//!    not valid UTF-8, which would turn a typed refusal into the serializer's
//!    English prose at the one moment there is no second error to fall back on.
//!    A `WirePath` renders lossily and therefore always succeeds, so the claim
//!    in `crate::commands` that every failure crossing this boundary is a
//!    `CommandError` is true of every value the types admit, not only of the
//!    ones this filesystem happens to allow.
//!
//! There is deliberately **no `COMMAND_ERROR_CODES` constant here.** The
//! frontend needs a runtime list because `isCommandError` has to recognise
//! untyped JSON; Rust does not, and a second list nothing reads would be one
//! more thing to keep in step. The Rust-side enumeration lives in
//! [`every_command_error`], is compiled only for tests, and is what
//! `wire_contract.rs` compares against the TypeScript list.

use std::io;

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

use espansoconfig_core::discovery::DiscoveryError;
use espansoconfig_core::draft::DraftError;
use espansoconfig_core::model::IdentityError;
use espansoconfig_core::persist::{BackupReadError, SaveError};
use espansoconfig_core::wire::WirePath;
use espansoconfig_core::workspace::WorkspaceError;

/// Everything a command may fail with.
///
/// Serializes as `{ "code": …, … operands }`.
///
/// # Why it is not `Clone`, `PartialEq` or `Eq` since Phase 2b-2a
///
/// [`CommandError::SaveFailed`] carries a whole
/// [`espansoconfig_core::persist::SaveError`], which reaches down to an
/// [`io::Error`] — a type that is neither cloneable nor comparable, and for a
/// good reason: two I/O failures with the same kind are not the same event.
/// The derives were dropped rather than replaced by hand-written impls, because
/// a hand-written `PartialEq` here would have to invent an equality for
/// `io::Error` and every test that used it would then be asserting on that
/// invention. Tests match on the variant, or on
/// [`CommandError::code`], both of which say what they mean.
#[derive(Debug)]
pub enum CommandError {
    /// A command was called before any workspace was opened.
    ///
    /// The one variant with no counterpart in the core: it is a property of
    /// this layer's session, not of a file.
    NoWorkspaceOpen,
    /// No candidate configuration directory existed.
    ConfigDirNotFound {
        /// Candidate paths, in the order they were probed.
        candidates: Vec<WirePath>,
    },
    /// A path was supplied explicitly and is not a directory.
    NotADirectory {
        /// The path that is not a directory.
        path: WirePath,
    },
    /// The filesystem refused a read.
    Io {
        /// The path being read.
        path: WirePath,
        /// The [`std::io::ErrorKind`] variant name — a code, not a message.
        kind: String,
    },
    /// A file is not valid UTF-8, so it cannot be a YAML document this crate
    /// understands.
    NotUtf8 {
        /// The path that failed to decode.
        path: WirePath,
        /// Byte offset of the first invalid sequence.
        offset: usize,
    },
    /// No document of this session has that identity.
    UnknownDocument {
        /// The identity that was asked about.
        document: u64,
    },
    /// A match identity names a different document from the one it was offered
    /// to.
    IdentityWrongDocument {
        /// The document that was asked.
        expected: u64,
        /// The document the identity names.
        found: u64,
    },
    /// A match identity was minted from another parse of the same document.
    ///
    /// `PROGRESS.md` R27. Kept distinct from
    /// [`CommandError::IdentityNoSuchMatch`] because the two call for different
    /// behaviour: this one means *the document moved on — re-resolve, and be
    /// ready for the answer to be nothing*, that one means *this projection
    /// holds no such node at all*.
    ///
    /// **It does not mean the match still exists.** The bytes changed; the
    /// match may have been edited, moved or deleted by whatever changed them.
    /// A caller that treats this code as "the thing is still there, fetch it
    /// again" is making a claim nothing in this crate supports — see
    /// `identityRecovery` in `src/lib/ipc/errors.ts`, and
    /// `a_document_path_is_positional_so_a_deletion_repoints_it` in
    /// `crate::commands`, which is the counterexample in test form.
    IdentityStaleRevision {
        /// The revision the projection holds, as 64 hex characters.
        expected: String,
        /// The revision the identity was minted from.
        found: String,
    },
    /// Document and revision agree, but no match of this projection is that
    /// node.
    IdentityNoSuchMatch {
        /// The node the identity names.
        node: usize,
    },
    /// The application menu could not be rebuilt because the main thread would
    /// not accept the work.
    ///
    /// The only failure `crate::menu::set_menu_labels` can answer with: menu
    /// construction is AppKit work that has to be posted to the main thread, so
    /// what the command reports is whether the post was **accepted**. A refusal
    /// means the event loop is gone, which in practice means the application is
    /// shutting down. It carries no operand, because the only thing that failed
    /// is the delivery.
    MenuUnavailable,
    /// The label set the frontend sent is not the label set this build
    /// declares.
    ///
    /// **A version-skew refusal, and it exists because the alternative was
    /// untyped prose.** Phase 1b-2b took the labels as a typed `MenuLabels`
    /// argument, so a frontend one release behind was refused *inside Tauri's
    /// command macro*, which answers with an English sentence — ``invalid args
    /// `labels` for command `set_menu_labels`: missing field `quit` `` — and no
    /// `code` at all. That is prose crossing the boundary, which plan section 9
    /// forbids, and `classifyFailure` could only file it under `unexpected`.
    /// The command now takes an untyped envelope and does the deserialization
    /// itself, so the refusal is this code and these two operands.
    ///
    /// Both operands are **wire field names**, not prose: they are the same
    /// identifiers `MenuLabels`, `MENU_LABEL_FIELDS` and the `menu.` dictionary
    /// namespace are spelled with. Neither is interpolated into a message —
    /// `docs/decisions/1b-2b-notes.md` section 2 lists the operands that are
    /// deliberately not rendered, and these join it.
    ///
    /// Both lists are empty when every field is present and one of them is not
    /// a string. That is a real case and not a degenerate one: the code still
    /// says *these labels are not the label set this build expects*, which is
    /// the whole of what the caller can act on.
    InvalidMenuLabels {
        /// Fields this build declares that the label set did not carry.
        missing: Vec<String>,
        /// Fields the label set carried that this build does not declare.
        unexpected: Vec<String>,
    },
    /// The main thread accepted the menu rebuild and the rebuild failed there.
    ///
    /// Kept apart from [`CommandError::MenuUnavailable`] because the two say
    /// different things about the application: that one means the event loop is
    /// gone, this one means the event loop is alive and AppKit refused. Phase
    /// 1b-2b could not tell them apart at all — `set_menu_labels` returned as
    /// soon as the work was *posted*, so a failure inside the closure left
    /// Tauri's English default menu up and reported success. muda's macOS
    /// implementation does not return an error on these paths today, which is
    /// why this code exists to stop tomorrow's failure being silent rather than
    /// to describe one that happens.
    MenuBuildFailed,
    /// An address could not be shown to be an item of the sequence the operation
    /// works in.
    ///
    /// **A negative claim, and the wording is deliberate.** It does not say the
    /// address is in a *different* sequence; it says this application could
    /// not establish that it is in the *same* one. Three shapes reach it: an
    /// address that really does name another sequence, a match this
    /// projection carries **no address for at all**, and an address that does not
    /// end in a sequence position. All three are the same refusal to a caller —
    /// the operation cannot be planned — and separating them would mean three
    /// codes for one decision.
    ///
    /// **Three commands raise it, not one.** `move_match` refuses a destination
    /// with it, `create_match` refuses an anchor that is not an item of the list
    /// the new snippet would join, and `delete_match` refuses a match it cannot
    /// address as a sequence item — all three through `anchor_index` or
    /// `item_address` in `crate::commands`. The variant's name still says
    /// *move*, which is now narrower than what it means; renaming it is a wire
    /// change and is recorded as a follow-up in
    /// `docs/decisions/2b-2c-2-notes.md` rather than done in passing. The two
    /// **sentences** a user reads were corrected, because a person pressing
    /// delete was being told about moving.
    ///
    /// **`ItemMove` is same-sequence only** (`PROGRESS.md` D2r): the engine
    /// derives the moved bytes from the item's own envelope and writes them at a
    /// point in the *same* sequence. Moving between sequences — or between files
    /// — is a different operation, with its own questions about indentation,
    /// ownership and what travels with the item, and none of them is answered.
    /// The refusal happens **before** anything is attempted rather than deep
    /// inside the patch engine.
    ///
    /// It carries no operand. The addresses involved are
    /// [`espansoconfig_core::patch::DocumentPath`]s, which are positions rather
    /// than prose, and no message this application shows interpolates one.
    ///
    /// **Its cross-sequence half is unreachable through `move_match` as the
    /// projection stands today**, and that is recorded rather than papered over:
    /// every match an [`espansoconfig_core::model::DocumentView`] holds is an item
    /// of the one `matches` sequence at the root of stream document 0, so two
    /// matches of one file are always siblings. The cross-**document** case is
    /// reachable and is [`CommandError::IdentityWrongDocument`]. The check exists
    /// because it is what keeps the guarantee true the day the projection grows a
    /// second sequence, and a guarantee with no code is a comment.
    MoveNotWithinOneSequence,
    /// The snippet a duplicate was asked for could not be addressed as an item
    /// of a sequence, so there is nothing to copy from.
    ///
    /// **[`CommandError::MoveNotWithinOneSequence`]'s claim, under a
    /// duplicate-specific code** — the design consult for Phase 2c-3c (Q5) rules
    /// that a duplicate must not leak a code named *move* as its user-facing
    /// reason, and renaming the shared code is a wire change three shipped
    /// commands would inherit. `duplicate_one_match` in `crate::commands` maps
    /// the shared resolution's refusal to this one; the *sentence* it renders is
    /// the same negative claim, said about a copy: this application could not
    /// establish that the snippet is an item of a list, so it has no bytes to
    /// copy as one.
    ///
    /// **Unreachable through today's projection, exactly as the cross-sequence
    /// half of the move's code is**: every match a
    /// [`espansoconfig_core::model::DocumentView`] holds is an item of the one
    /// `matches` sequence, with a path that ends in its index. The code exists
    /// because the guarantee has to survive the day the projection grows a
    /// match it cannot address, and a guarantee with no code is a comment.
    ///
    /// It carries no operand, for the move code's reason: the address involved
    /// is a [`espansoconfig_core::patch::DocumentPath`], which is a position
    /// rather than prose, and no message interpolates one.
    DuplicateSourceNotASequenceItem,
    /// The document holds no top-level `matches:` key, so there is no list for a
    /// new snippet to join.
    ///
    /// **A planning-time refusal, in the `Err` channel** for
    /// [`CommandError::MoveNotWithinOneSequence`]'s reason: nothing was
    /// attempted, no transaction ran, no finding was produced, and no
    /// acknowledgement could ever change the answer. The caller has to change the
    /// request — pick another file, or write the key — rather than confirm it.
    ///
    /// # Why creation refuses instead of writing the key
    ///
    /// `espansoconfig_core::patch::InsertItem` may synthesize **exactly one flat
    /// block-mapping sequence item at a sequence-item boundary**, and that
    /// sentence is the whole licence it has. Adding a `matches:` entry to the
    /// root mapping is a different edit, and it would have to choose where in the
    /// file the new key goes, what indentation the sequence takes and which of
    /// the document's comments the key lands among — three layout decisions no
    /// primitive may make on the user's behalf.
    ///
    /// **A bare `matches:` with no value is not this refusal.** An implicit null
    /// is promoted into its first block-sequence item by the primitive itself, so
    /// creating the first snippet of a file that already names the key works; this
    /// code means the key is not there at all. A file that did not parse reaches
    /// it too, and honestly: nothing can be said about the keys of a document the
    /// substrate rejected.
    DocumentHasNoMatchList {
        /// The document that was asked, by its session-local identity.
        document: u64,
    },
    /// A draft could not be turned into an edit batch, so **no save was
    /// attempted at all**.
    ///
    /// # Why a refusal in the `Err` channel, when a save's refusal is not
    ///
    /// The two look alike and are not, and Phase 2b-2b-3's design consult
    /// (`docs/reviews/phase-2b-2b-3-design.md`, Q1) settled it before the command
    /// existed. A [`espansoconfig_core::draft::DraftError`] is a **planning-time**
    /// failure: no batch was derived, no transaction ran, no lock was taken, no
    /// finding was produced — and **no acknowledgement can ever change the
    /// answer**. `SaveResult::Refused` is the opposite of all five: the
    /// transaction evaluated a real candidate, the semantic gate declined it, and
    /// the findings it carries are exactly what a caller hands back to make the
    /// same save proceed.
    ///
    /// Filing them under one type would invite a frontend to put an *acknowledge
    /// and retry* control in front of a refusal that retrying cannot move. The
    /// analogue already on this enum is [`CommandError::MoveNotWithinOneSequence`],
    /// which is the same shape for the same reason: the requested operation cannot
    /// be represented, so the caller has to change the request rather than confirm
    /// it.
    ///
    /// # The argument against, stated rather than won
    ///
    /// The consult named it and it is a real cost: a draft refusal is an
    /// **expected domain outcome**, not an infrastructure failure, and returning
    /// it through `Err` invites generic command-error handling to present it as an
    /// exceptional failure — a toast in the corner — where the honest presentation
    /// is inline feedback on the field the user was editing. The answer is that
    /// the frontend must recognise this code as an **actionable validation
    /// category** and route it to the form, not that the planning/transaction
    /// distinction should be weakened to make a careless renderer look right.
    ///
    /// # It carries indices, never the owner's text
    ///
    /// Twelve of the [`espansoconfig_core::draft::DraftError`] variants address
    /// something below the match mapping, and every one of them does it with an
    /// **index**. That is not a style choice: this value crosses the process
    /// boundary and the configuration is private (`CLAUDE.md` section 1). A
    /// frontend that wants to name the failing field resolves the index against
    /// the projection it already holds, and no dictionary string in either
    /// language interpolates a key, a trigger or a value.
    ///
    /// The refusal travels **whole**, exactly as [`CommandError::SaveFailed`]'s
    /// does, rather than being flattened into thirty-two codes here: the enum has
    /// its own `draftError` dictionary namespace, and a second copy of its
    /// taxonomy on this side is a second thing to keep in step.
    DraftRefused {
        /// Why the draft could not be planned, exactly as the core reports it.
        error: DraftError,
    },
    /// A save was attempted and did not commit, for a reason the transaction
    /// itself reports.
    ///
    /// **The typed failure travels whole.** Flattening
    /// [`espansoconfig_core::persist::SaveError`]'s nine variants into nine codes
    /// here would duplicate a vocabulary that already has its own dictionary
    /// namespace and its own accessor (`describeSaveError` in
    /// `src/lib/i18n/codes.ts`), and it would lose the nesting Phase 2b-1 kept on
    /// purpose: `WriteError::may_have_written` is computed from a `WriteStep`
    /// that a flattened copy would drop, and it is the one question whose answer
    /// changes what a caller does next.
    ///
    /// **Two of the transaction's outcomes are deliberately not here.** A stale
    /// base revision is `SaveResult::Conflict` and a refusal by the semantic gate
    /// is `SaveResult::Refused` — both are expected, actionable answers rather
    /// than errors, and both live in the `Ok` channel. See `crate::save`.
    ///
    /// # It writes a second operand it does not store
    ///
    /// `may_have_written` is
    /// [`espansoconfig_core::persist::SaveError::may_have_written`] **evaluated at
    /// serialization time**, not a field. The review of Phase 2b-2a found the two
    /// sides of the boundary disagreeing about exactly this question: this crate
    /// evicts its cached parse when the predicate is true, and the frontend went
    /// on showing the pre-save order and the pre-save bytes because it had no way
    /// to ask. It could have derived the answer from the nested `WriteStep`, and
    /// that is precisely what must not happen — a second list of steps in
    /// TypeScript is a list that drifts from the `match` in `write.rs` the first
    /// time a step is added. Carrying the predicate's own answer makes the two
    /// sides agree **by construction**, and there is no field to set wrongly
    /// because there is no field.
    ///
    /// **It is not a claim about what the file holds now.** It says this call's
    /// rename had already committed when the failure happened — another process
    /// can have written the file since. `WriteStep::after_rename` states the same
    /// limit at the bottom of the same computation.
    SaveFailed {
        /// Why the save did not commit, exactly as the core reports it.
        error: SaveError,
    },
    /// A backup batch name is not one the batch grammar admits.
    ///
    /// **A refusal of the request, before any directory is opened**, and it is
    /// deliberately not [`espansoconfig_core::persist::BackupReadError::StaleBatch`]:
    /// the stale-batch arm means that a name admitted by the grammar does not
    /// name a recognised batch now — it does not imply that the identity
    /// resolved previously — and this one means the caller sent a string that
    /// could never have named one. Collapsing them would tell a person the
    /// backup folder had been tidied away when in fact nothing was ever asked
    /// about the disk.
    ///
    /// It is what a **forged** identity meets: an identity minted by
    /// `list_backup_batches` is a name [`espansoconfig_core::persist::BackupBatchId`]
    /// produced, so it parses by construction.
    ///
    /// The operand is the caller's own string, echoed back for a console. No
    /// dictionary sentence interpolates it — it is a name this build does not
    /// recognise, so it names nothing a person chose.
    UnrecognisedBackupBatch {
        /// The batch name that was sent.
        batch: String,
    },
    /// A backup entry's relative path is not one this catalogue can address
    /// inside a batch.
    ///
    /// The **forged-path** refusal, and it is
    /// [`espansoconfig_core::persist::BackupEntryId::in_batch`]'s answer rather
    /// than a second opinion about paths: an empty path, an absolute one, one
    /// holding `.` or `..`, one with a repeated or trailing separator, and the
    /// batch's own ownership marker are all this. **Nothing is normalised** —
    /// `match/./base.yml` is refused rather than read as `match/base.yml` — so
    /// an admitted identity carries only plain relative components and joining
    /// it introduces no lexical `.` or `..` escape. Filesystem containment is a
    /// separate matter, and it retains the target-specific guarantees the core's
    /// `ResolvedDirectory` documents.
    ///
    /// It is raised before any directory is opened, so it says nothing at all
    /// about what is on the disk.
    UnaddressableBackupEntry {
        /// The batch the entry was offered under.
        batch: String,
        /// The relative path that was sent.
        relative_path: String,
    },
    /// A backup entry does not map to the document it was asked for.
    ///
    /// **The binding check, and the whole reason `read_backup_text` takes a
    /// document beside an entry.** The entry the batch holds for that document
    /// is derived from the document's own
    /// [`espansoconfig_core::model::DocumentContext`] — the session's
    /// authoritative absolute path — and the identity the caller sent has to be
    /// that entry. A display path is never the authority for this: two distinct
    /// filenames can render to one wire string (`crate::wire_contract`).
    ///
    /// It covers three shapes with one code, because all three are the same
    /// refusal to a caller — nothing is read: the batch holds nothing at the
    /// name that document maps to, it holds something there that is not this
    /// entry, and the document is the configuration root itself, which
    /// [`espansoconfig_core::persist::BackupCatalog::entry_for_target`] refuses
    /// rather than mapping onto its `_outside_` sentinel.
    ///
    /// **It is not a claim that the entry is a copy of some other file.** A
    /// backup entry's name says where a copy would have been written, never
    /// where any bytes came from.
    BackupEntryIsNotThisDocument {
        /// The document that was asked, by its session-local identity.
        document: u64,
    },
    /// A backup-catalogue request could not return its requested result, for a
    /// reason reported by the catalogue.
    ///
    /// **Not always a failed read.**
    /// [`espansoconfig_core::persist::BackupReadError::NotUtf8`] is the arm where
    /// the entry opened and every byte arrived, and only turning those bytes into
    /// a `String` did not succeed, so neither this code's sentence nor any string
    /// built on it may say the folder could not be read.
    ///
    /// **The typed failure travels whole**, exactly as
    /// [`CommandError::SaveFailed`]'s and [`CommandError::DraftRefused`]'s do:
    /// [`espansoconfig_core::persist::BackupReadError`] has its own
    /// `backupReadError` dictionary namespace and its own accessor, and a second
    /// copy of its taxonomy here would be a second thing to keep in step.
    ///
    /// **A missing backup root is not in here**, and that is the point: a
    /// configuration this application has never saved from legitimately has no
    /// backup root, and it arrives as
    /// [`espansoconfig_core::persist::BackupRootState::Missing`] on a
    /// *successful* listing rather than as a failure.
    BackupReadFailed {
        /// Why the request did not produce its result, exactly as the core
        /// reports it.
        error: BackupReadError,
    },
} // End of enum CommandError

impl CommandError {
    /// The stable machine code this error crosses the boundary as.
    ///
    /// The **only** spelling of each code in this crate: [`Serialize`] below
    /// writes this string rather than a literal of its own, so the wire form
    /// and anything Rust branches on cannot disagree. Adding a variant makes
    /// this `match` non-exhaustive, which is a compile error, which is the
    /// prompt to add the code to `src/lib/ipc/errors.ts` as well.
    pub fn code(&self) -> &'static str {
        match self {
            CommandError::NoWorkspaceOpen => "noWorkspaceOpen",
            CommandError::ConfigDirNotFound { .. } => "configDirNotFound",
            CommandError::NotADirectory { .. } => "notADirectory",
            CommandError::Io { .. } => "io",
            CommandError::NotUtf8 { .. } => "notUtf8",
            CommandError::UnknownDocument { .. } => "unknownDocument",
            CommandError::IdentityWrongDocument { .. } => "identityWrongDocument",
            CommandError::IdentityStaleRevision { .. } => "identityStaleRevision",
            CommandError::IdentityNoSuchMatch { .. } => "identityNoSuchMatch",
            CommandError::MenuUnavailable => "menuUnavailable",
            CommandError::InvalidMenuLabels { .. } => "invalidMenuLabels",
            CommandError::MenuBuildFailed => "menuBuildFailed",
            CommandError::MoveNotWithinOneSequence => "moveNotWithinOneSequence",
            CommandError::DuplicateSourceNotASequenceItem => "duplicateSourceNotASequenceItem",
            CommandError::DocumentHasNoMatchList { .. } => "documentHasNoMatchList",
            CommandError::DraftRefused { .. } => "draftRefused",
            CommandError::SaveFailed { .. } => "saveFailed",
            CommandError::UnrecognisedBackupBatch { .. } => "unrecognisedBackupBatch",
            CommandError::UnaddressableBackupEntry { .. } => "unaddressableBackupEntry",
            CommandError::BackupEntryIsNotThisDocument { .. } => "backupEntryIsNotThisDocument",
            CommandError::BackupReadFailed { .. } => "backupReadFailed",
        }
    } // End of function code()
} // End of impl CommandError

impl Serialize for CommandError {
    /// Serializes as `{ "code": …, … operands }` — codes and data, no prose.
    ///
    /// Every arm writes [`CommandError::code`] rather than its own literal, so
    /// there is one spelling of each code in the crate. Every other field is a
    /// path, a number or another code; no arm renders a sentence, and there is
    /// no `Display` impl for one to be taken from.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut out = serializer.serialize_struct("CommandError", 1 + self.operand_count())?;
        out.serialize_field("code", self.code())?;
        match self {
            CommandError::NoWorkspaceOpen => {}
            CommandError::ConfigDirNotFound { candidates } => {
                out.serialize_field("candidates", candidates)?;
            }
            CommandError::NotADirectory { path } => {
                out.serialize_field("path", path)?;
            }
            CommandError::Io { path, kind } => {
                out.serialize_field("path", path)?;
                out.serialize_field("kind", kind)?;
            }
            CommandError::NotUtf8 { path, offset } => {
                out.serialize_field("path", path)?;
                out.serialize_field("offset", offset)?;
            }
            CommandError::UnknownDocument { document } => {
                out.serialize_field("document", document)?;
            }
            CommandError::IdentityWrongDocument { expected, found } => {
                out.serialize_field("expected", expected)?;
                out.serialize_field("found", found)?;
            }
            CommandError::IdentityStaleRevision { expected, found } => {
                out.serialize_field("expected", expected)?;
                out.serialize_field("found", found)?;
            }
            CommandError::IdentityNoSuchMatch { node } => {
                out.serialize_field("node", node)?;
            }
            CommandError::MenuUnavailable => {}
            CommandError::InvalidMenuLabels {
                missing,
                unexpected,
            } => {
                out.serialize_field("missing", missing)?;
                out.serialize_field("unexpected", unexpected)?;
            }
            CommandError::MenuBuildFailed => {}
            CommandError::MoveNotWithinOneSequence => {}
            CommandError::DuplicateSourceNotASequenceItem => {}
            CommandError::DocumentHasNoMatchList { document } => {
                out.serialize_field("document", document)?;
            }
            CommandError::DraftRefused { error } => {
                out.serialize_field("error", error)?;
            }
            CommandError::SaveFailed { error } => {
                out.serialize_field("error", error)?;
                // Computed here rather than carried, so that the answer on the
                // wire is the core's own predicate and not a copy of it. See the
                // variant's documentation.
                out.serialize_field("may_have_written", &error.may_have_written())?;
            }
            CommandError::UnrecognisedBackupBatch { batch } => {
                out.serialize_field("batch", batch)?;
            }
            CommandError::UnaddressableBackupEntry {
                batch,
                relative_path,
            } => {
                out.serialize_field("batch", batch)?;
                out.serialize_field("relative_path", relative_path)?;
            }
            CommandError::BackupEntryIsNotThisDocument { document } => {
                out.serialize_field("document", document)?;
            }
            CommandError::BackupReadFailed { error } => {
                out.serialize_field("error", error)?;
            }
        } // End of the match over the variants' operands
        out.end()
    } // End of function serialize() for CommandError
}

impl CommandError {
    /// How many operand fields this variant writes, beside its code.
    fn operand_count(&self) -> usize {
        match self {
            CommandError::NoWorkspaceOpen
            | CommandError::MenuUnavailable
            | CommandError::MenuBuildFailed
            | CommandError::MoveNotWithinOneSequence
            | CommandError::DuplicateSourceNotASequenceItem => 0,
            CommandError::ConfigDirNotFound { .. }
            | CommandError::NotADirectory { .. }
            | CommandError::UnknownDocument { .. }
            | CommandError::IdentityNoSuchMatch { .. }
            | CommandError::DocumentHasNoMatchList { .. }
            | CommandError::UnrecognisedBackupBatch { .. }
            | CommandError::BackupEntryIsNotThisDocument { .. }
            // One operand, and it is the core's whole refusal, exactly as
            // `DraftRefused`'s is: a `BackupReadError` has no second question to
            // answer the way `SaveFailed` does, and in particular no
            // `may_have_written` — nothing on this path writes.
            | CommandError::BackupReadFailed { .. }
            // One operand, and it is the core's whole refusal: a `DraftError`
            // has no second question to answer the way `SaveFailed` does.
            | CommandError::DraftRefused { .. } => 1,
            CommandError::Io { .. }
            | CommandError::NotUtf8 { .. }
            | CommandError::IdentityWrongDocument { .. }
            | CommandError::IdentityStaleRevision { .. }
            | CommandError::InvalidMenuLabels { .. }
            | CommandError::UnaddressableBackupEntry { .. }
            // One field, two operands: `may_have_written` is derived rather than
            // stored. See the variant's documentation.
            | CommandError::SaveFailed { .. } => 2,
        }
    } // End of function operand_count()
}

/// One instance of every [`CommandError`] variant.
///
/// Compiled only for tests, because nothing in production needs to enumerate
/// the codes — but `wire_contract.rs` does, to compare them against
/// `COMMAND_ERROR_CODES` in `src/lib/ipc/errors.ts`. It lives here rather than
/// inside a `mod tests` so both test modules can reach it, and so it sits
/// directly under the enum it enumerates.
///
/// **The list is mechanically exhaustive.** It used to be a hand-written list
/// whose only guard was the doc comment on [`CommandError::code`], so a variant
/// added to the enum *and* to `code()` but to neither this list nor the
/// TypeScript one passed every check — the review of Phase 1b-2a found that,
/// and `every_declared_variant_has_an_instance_in_the_enumeration` closes it by
/// reading this file's own `pub enum CommandError` block and asserting that
/// every variant declared there appears below. A variant that exists in the
/// enum and not here now fails `cargo test`, and because
/// `the_frontend_error_codes_are_exactly_the_rust_codes` compares this list
/// against `COMMAND_ERROR_CODES`, the same failure reaches the TypeScript side.
#[cfg(test)]
pub(crate) fn every_command_error() -> Vec<CommandError> {
    use espansoconfig_core::persist::{BackupBatchId, BackupEntryId};
    use espansoconfig_core::ContentRevision;
    vec![
        CommandError::NoWorkspaceOpen,
        CommandError::ConfigDirNotFound {
            candidates: vec![WirePath::new("/nowhere")],
        },
        CommandError::NotADirectory {
            path: WirePath::new("/nowhere/file.yml"),
        },
        CommandError::Io {
            path: WirePath::new("/nowhere/file.yml"),
            kind: "NotFound".to_owned(),
        },
        CommandError::NotUtf8 {
            path: WirePath::new("/nowhere/file.yml"),
            offset: 12,
        },
        CommandError::UnknownDocument { document: 7 },
        CommandError::IdentityWrongDocument {
            expected: 1,
            found: 2,
        },
        CommandError::IdentityStaleRevision {
            expected: ContentRevision::of_bytes(b"a").to_hex(),
            found: ContentRevision::of_bytes(b"b").to_hex(),
        },
        CommandError::IdentityNoSuchMatch { node: 3 },
        CommandError::MenuUnavailable,
        CommandError::InvalidMenuLabels {
            missing: vec!["quit".to_owned()],
            unexpected: vec!["renamed_last_week".to_owned()],
        },
        CommandError::MenuBuildFailed,
        CommandError::MoveNotWithinOneSequence,
        CommandError::DuplicateSourceNotASequenceItem,
        CommandError::DocumentHasNoMatchList { document: 4 },
        // The one variant that carries an index below the match mapping, chosen
        // over the eleven simpler ones so that the enumeration exercises the
        // privacy rule as well as the shape: `variable` is a position in the
        // projected `vars` list and there is nowhere for a key text to hide.
        CommandError::DraftRefused {
            error: DraftError::AmbiguousVariableKey { variable: 0 },
        },
        CommandError::SaveFailed {
            error: SaveError::DocumentIsReadOnly {
                path: std::path::PathBuf::from("/nowhere/match/packages/one/package.yml"),
            },
        },
        CommandError::UnrecognisedBackupBatch {
            batch: "not-a-batch-name".to_owned(),
        },
        CommandError::UnaddressableBackupEntry {
            batch: "2026-01-02T030405Z-0".to_owned(),
            relative_path: "../outside".to_owned(),
        },
        CommandError::BackupEntryIsNotThisDocument { document: 9 },
        // The variant that carries the whole read refusal, sampled with the arm
        // that carries an identity rather than a path: it is the one that proves
        // a `BackupEntryId` reaches the wire from inside an error as well as
        // from inside a listing.
        CommandError::BackupReadFailed {
            error: BackupReadError::StaleEntry {
                entry: BackupEntryId::in_batch(
                    BackupBatchId::parse("2026-01-02T030405Z-0")
                        .expect("a batch name this grammar admits"),
                    std::path::Path::new("match/base.yml"),
                )
                .expect("a relative path this catalogue can address"),
            },
        },
    ]
} // End of function every_command_error()

/// The variant name of one [`CommandError`], from its derived `Debug`.
///
/// `Debug` on an enum writes the variant name first, so the leading identifier
/// is the name. Used to compare instances against the names declared in this
/// file's source, which is how the enumeration above is kept exhaustive without
/// a macro or a second hand-written list.
#[cfg(test)]
fn variant_name(error: &CommandError) -> String {
    format!("{error:?}")
        .chars()
        .take_while(char::is_ascii_alphanumeric)
        .collect()
}

/// Every variant name declared by `pub enum CommandError` in this file.
///
/// Reads the source rather than any list a maintainer keeps in step, because a
/// list kept in step is exactly what the review found could fall out of step.
///
/// The reader itself lives in `crate::rust_source`, where fifteen other enum
/// declarations are read the same way to check the Rust-code dictionaries. One
/// reader rather than two: a second copy could disagree with this one about what
/// a variant declaration looks like, and only one of the two would be wrong in a
/// way anybody noticed. Phase 1b-2b's review is why it parses rather than scans
/// lines — `#[cfg(…)] Variant,` and `A, B,` are both valid declarations a line
/// scanner missed.
#[cfg(test)]
fn declared_variants() -> std::collections::BTreeSet<String> {
    let source = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/error.rs"))
        .expect("error.rs can read itself");
    crate::rust_source::declared_variants(&source, "CommandError")
} // End of function declared_variants()

/// The [`std::io::ErrorKind`] variant name of an I/O error.
///
/// The `Debug` rendering of an `ErrorKind` is its variant name — `NotFound`,
/// `PermissionDenied` — which is a code. The error's `Display` string is the
/// operating system's own message, in the operating system's own language, and
/// is deliberately never sent.
///
/// **Delegates to the core rather than repeating it.** Phase 2b-1 put the same
/// rule on `WriteError::Io` and `BackupError::Io`, so the spelling moved to
/// [`espansoconfig_core::wire::io_kind_name`] and this is the one caller left on
/// this side of the boundary. Two copies could disagree about what a `kind`
/// operand means, and only one of them would be wrong in a way anybody noticed.
fn io_kind_name(error: &io::Error) -> String {
    espansoconfig_core::wire::io_kind_name(error)
}

impl From<IdentityError> for CommandError {
    /// Flattens the three identity refusals into three top-level codes.
    ///
    /// The `match` is exhaustive, so an identity refusal added to the core
    /// fails this crate's build rather than arriving as an unhandled shape.
    fn from(error: IdentityError) -> CommandError {
        match error {
            IdentityError::WrongDocument { expected, found } => {
                CommandError::IdentityWrongDocument {
                    expected: expected.get(),
                    found: found.get(),
                }
            }
            IdentityError::StaleRevision { expected, found } => {
                CommandError::IdentityStaleRevision {
                    expected: expected.to_hex(),
                    found: found.to_hex(),
                }
            }
            IdentityError::NoSuchMatch { node } => {
                CommandError::IdentityNoSuchMatch { node: node.get() }
            }
        }
    } // End of function from() for IdentityError
}

impl From<DiscoveryError> for CommandError {
    /// Exhaustive by construction, for the same reason as the impl above.
    fn from(error: DiscoveryError) -> CommandError {
        match error {
            DiscoveryError::ConfigDirNotFound { candidates } => CommandError::ConfigDirNotFound {
                candidates: candidates.into_iter().map(WirePath::from).collect(),
            },
            DiscoveryError::NotADirectory(path) => CommandError::NotADirectory {
                path: WirePath::from(path),
            },
            DiscoveryError::Io { path, source } => CommandError::Io {
                kind: io_kind_name(&source),
                path: WirePath::from(path),
            },
        }
    } // End of function from() for DiscoveryError
}

impl From<WorkspaceError> for CommandError {
    /// Exhaustive by construction, for the same reason as the impls above.
    fn from(error: WorkspaceError) -> CommandError {
        match error {
            WorkspaceError::Discovery(inner) => CommandError::from(inner),
            WorkspaceError::UnknownDocument { id } => {
                CommandError::UnknownDocument { document: id.get() }
            }
            WorkspaceError::Identity(inner) => CommandError::from(inner),
            WorkspaceError::Io { path, source } => CommandError::Io {
                kind: io_kind_name(&source),
                path: WirePath::from(path),
            },
            WorkspaceError::NotUtf8 { path, offset } => CommandError::NotUtf8 {
                path: WirePath::from(path),
                offset,
            },
        }
    } // End of function from() for WorkspaceError
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;
    use std::path::PathBuf;

    use espansoconfig_core::discovery::DiscoveryError;
    use espansoconfig_core::model::IdentityError;
    use espansoconfig_core::workspace::WorkspaceError;
    use espansoconfig_core::{ContentRevision, DocumentId};
    use serde_json::Value;

    use super::{declared_variants, every_command_error, variant_name, CommandError};

    /// The enumeration holds one instance of every variant the enum declares.
    ///
    /// The review of Phase 1b-2a found that nothing checked this: a variant
    /// added to [`CommandError`] and to `code()` — both of which the compiler
    /// does force — could be omitted from `every_command_error()` *and* from
    /// `COMMAND_ERROR_CODES`, and every contract test would still pass because
    /// both compared sets omitted it. The expectation here is derived from the
    /// **declaration**, not from what the enumeration produced, which is the
    /// vacuous-audit corollary (`PROGRESS.md`, D2w) applied to an enum.
    #[test]
    fn every_declared_variant_has_an_instance_in_the_enumeration() {
        let declared = declared_variants();
        // Non-vacuity: a scanner that found nothing would agree with an empty
        // enumeration and prove nothing at all.
        assert!(
            declared.len() > 1,
            "the source scan found {} variants, so it is not reading the enum",
            declared.len()
        );
        let enumerated: BTreeSet<String> = every_command_error().iter().map(variant_name).collect();
        assert_eq!(
            declared, enumerated,
            "every_command_error() and the CommandError declaration disagree"
        );
    } // End of function every_declared_variant_has_an_instance_in_the_enumeration()

    /// A path no encoding can name still crosses as a typed error.
    ///
    /// The review's second High finding: `serde`'s own `PathBuf` serializer
    /// **fails** on a non-UTF-8 path, so before `WirePath` an `Io` or `NotUtf8`
    /// error carrying one would have reached the webview as the serializer's
    /// English prose instead of `{ code, operands }` — the one failure mode a
    /// typed error boundary cannot absorb, because the type that was supposed to
    /// carry the refusal is the type that failed. The premise is asserted first,
    /// so this cannot pass with the fix removed.
    #[test]
    #[cfg(unix)]
    fn a_non_utf8_path_crosses_as_a_code_and_operands() {
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;

        let mut path = PathBuf::from("/nowhere/match");
        path.push(OsStr::from_bytes(b"ba\xffse.yml"));
        assert!(
            serde_json::to_value(&path).is_err(),
            "the premise of this test is that a bare PathBuf cannot carry these bytes"
        );

        let error = CommandError::from(WorkspaceError::Io {
            path: path.clone(),
            source: std::io::Error::from(std::io::ErrorKind::PermissionDenied),
        });
        let json = serde_json::to_value(&error).expect("a command error must always serialize");
        assert_eq!(json["code"], "io");
        assert_eq!(json["kind"], "PermissionDenied");
        assert!(json["path"]
            .as_str()
            .expect("a path operand is a string")
            .contains('\u{fffd}'));

        let candidates = CommandError::from(DiscoveryError::ConfigDirNotFound {
            candidates: vec![path],
        });
        let json =
            serde_json::to_value(&candidates).expect("a list of paths must always serialize");
        assert_eq!(json["code"], "configDirNotFound");
        assert_eq!(json["candidates"].as_array().map(Vec::len), Some(1));
    } // End of function a_non_utf8_path_crosses_as_a_code_and_operands()

    /// The `code` field of a serialized error.
    fn code_of(error: &CommandError) -> String {
        let value = serde_json::to_value(error).expect("a command error must serialize");
        value
            .get("code")
            .and_then(Value::as_str)
            .expect("every serialized command error carries a code")
            .to_owned()
    }

    /// What is serialized as `code` is what [`CommandError::code`] returns.
    ///
    /// Trivially true of the impl as written, and kept anyway: it is what fires
    /// if someone reintroduces a literal into one arm of `serialize`, which is
    /// the exact mistake the hand-written impl exists to prevent.
    #[test]
    fn the_serialized_code_is_the_accessors_code() {
        for error in every_command_error() {
            assert_eq!(
                code_of(&error),
                error.code(),
                "the serialized code and CommandError::code() disagree for {error:?}"
            );
        }
    }

    /// No two variants share a code.
    ///
    /// A shared code would give two different conditions one dictionary entry
    /// and one message, which is the failure mode a `code` exists to prevent.
    #[test]
    fn no_two_variants_share_a_code() {
        let variants = every_command_error();
        let distinct: BTreeSet<&str> = variants.iter().map(CommandError::code).collect();
        assert_eq!(
            distinct.len(),
            variants.len(),
            "two CommandError variants serialize as the same code"
        );
    }

    /// A serialized error carries its code and its declared operands, and
    /// nothing else.
    ///
    /// The point is the *nothing else*: a field that crept in carrying a
    /// rendered message would pass a test that only checked the code.
    #[test]
    fn every_variant_serializes_as_a_code_plus_its_declared_operands() {
        let expected: Vec<(&str, Vec<&str>)> = vec![
            ("noWorkspaceOpen", vec![]),
            ("configDirNotFound", vec!["candidates"]),
            ("notADirectory", vec!["path"]),
            ("io", vec!["kind", "path"]),
            ("notUtf8", vec!["offset", "path"]),
            ("unknownDocument", vec!["document"]),
            ("identityWrongDocument", vec!["expected", "found"]),
            ("identityStaleRevision", vec!["expected", "found"]),
            ("identityNoSuchMatch", vec!["node"]),
            ("menuUnavailable", vec![]),
            ("invalidMenuLabels", vec!["missing", "unexpected"]),
            ("menuBuildFailed", vec![]),
            ("moveNotWithinOneSequence", vec![]),
            ("duplicateSourceNotASequenceItem", vec![]),
            ("documentHasNoMatchList", vec!["document"]),
            ("draftRefused", vec!["error"]),
            ("saveFailed", vec!["error", "may_have_written"]),
        ];
        for (error, (code, operands)) in every_command_error().iter().zip(expected) {
            let value = serde_json::to_value(error).expect("a command error must serialize");
            let object = value.as_object().expect("an error is a JSON object");
            let mut keys: Vec<&str> = object.keys().map(String::as_str).collect();
            keys.retain(|key| *key != "code");
            keys.sort_unstable();
            assert_eq!(error.code(), code, "the expectation table is out of order");
            assert_eq!(
                keys, operands,
                "{code} does not carry exactly its declared operands"
            );
        } // End of the loop over the variants and their expected operands
    } // End of function every_variant_serializes_as_a_code_plus_its_declared_operands()

    /// A failed save says on the wire whether its rename may have completed.
    ///
    /// **The finding the review of Phase 2b-2a filed as High, as a test.** This
    /// crate evicts its cached parse when
    /// [`espansoconfig_core::persist::SaveError::may_have_written`] is true, and
    /// before this operand the frontend had no way to reach the same decision — so
    /// the window went on showing the pre-save order and the pre-save bytes while
    /// the file on disk may already have held the moved snippet.
    ///
    /// The fixtures are the two sides of `WriteStep::after_rename`: a failure at
    /// the rename itself, which means the rename did **not** happen, and one at the
    /// directory sync, which is after it. A serializer that wrote a constant would
    /// fail one of the two, and the expectation is taken from the core's own
    /// predicate rather than written out, so this cannot drift from it either.
    #[test]
    fn a_save_failure_says_whether_its_rename_may_have_completed() {
        use espansoconfig_core::persist::{SaveError, WriteError, WriteStep};

        let cases = [
            (WriteStep::Rename, false),
            (WriteStep::SyncDirectory, true),
            (WriteStep::ReadBack, true),
        ];
        for (step, after_the_rename) in cases {
            let inner = SaveError::Write(WriteError::Io {
                step,
                path: PathBuf::from("/nowhere/match/base.yml"),
                source: std::io::Error::from(std::io::ErrorKind::PermissionDenied),
            });
            assert_eq!(
                inner.may_have_written(),
                after_the_rename,
                "the fixture's premise: {step} is {} the rename",
                if after_the_rename { "after" } else { "before" }
            );
            let error = CommandError::SaveFailed { error: inner };
            let json = serde_json::to_value(&error).expect("a command error must serialize");
            assert_eq!(json["code"], "saveFailed");
            assert_eq!(
                json["may_have_written"], after_the_rename,
                "the operand must be the core's own predicate: {json}"
            );
        } // End of the loop over the steps on either side of the rename

        // And a refusal that never reached the write at all is `false` without
        // any `WriteError` to compute it from.
        let read_only = CommandError::SaveFailed {
            error: espansoconfig_core::persist::SaveError::DocumentIsReadOnly {
                path: PathBuf::from("/nowhere/match/packages/one/package.yml"),
            },
        };
        let json = serde_json::to_value(&read_only).expect("a command error must serialize");
        assert_eq!(json["may_have_written"], false);
    } // End of function a_save_failure_says_whether_its_rename_may_have_completed()

    /// A refused draft crosses as its own code, carrying the core's refusal
    /// whole and no text the owner wrote.
    ///
    /// Three claims, and the third is the one `CLAUDE.md` section 1 makes
    /// non-negotiable. The code is `draftRefused` rather than `saveFailed`,
    /// because nothing was saved and nothing was attempted. The operand is the
    /// core's own externally tagged refusal rather than a flattened copy of it,
    /// so the `draftError` dictionary namespace is what renders it. And every
    /// operand under that tag is a number: the fixtures below are the two shapes
    /// that could have carried a key — a nested mapping's repeated key, and a
    /// variable's — and both address it by index.
    #[test]
    fn a_refused_draft_crosses_as_a_code_carrying_indices_only() {
        use espansoconfig_core::draft::DraftError;

        let cases = [
            (
                DraftError::AmbiguousVariableKey { variable: 4 },
                "AmbiguousVariableKey",
                "variable",
            ),
            (
                DraftError::AmbiguousNestedKey { edit: 2 },
                "AmbiguousNestedKey",
                "edit",
            ),
        ];
        for (refusal, variant, operand) in cases {
            let rendered = refusal.to_string();
            let error = CommandError::DraftRefused { error: refusal };
            let json = serde_json::to_value(&error).expect("a command error must serialize");
            assert_eq!(json["code"], "draftRefused");
            assert!(
                json["error"][variant][operand].is_number(),
                "an address below the match mapping is an index: {json}"
            );
            let text = serde_json::to_string(&error).expect("a command error must serialize");
            assert!(
                !text.contains(&rendered),
                "the developer rendering must not reach the wire: {text}"
            );
        } // End of the loop over the two refusals that could have carried a key
    } // End of function a_refused_draft_crosses_as_a_code_carrying_indices_only()

    /// An `io::Error`'s message never reaches the wire; its kind does.
    ///
    /// The concrete form of "codes, never prose": the sentence below is what an
    /// operating system would supply, in a language nobody chose, and it must
    /// not appear in the JSON.
    #[test]
    fn an_io_errors_message_is_not_on_the_wire_but_its_kind_is() {
        let sentence = "the developer-facing sentence that must not be sent";
        let source = std::io::Error::new(std::io::ErrorKind::PermissionDenied, sentence);
        let error = CommandError::from(WorkspaceError::Io {
            path: PathBuf::from("/nowhere/file.yml"),
            source,
        });
        let json = serde_json::to_string(&error).expect("a command error must serialize");
        assert!(
            !json.contains(sentence),
            "the io::Error's Display string reached the wire: {json}"
        );
        assert!(
            json.contains("PermissionDenied"),
            "the io::ErrorKind name is the code and must be sent: {json}"
        );
    } // End of function an_io_errors_message_is_not_on_the_wire_but_its_kind_is()

    /// Every core error condition maps onto exactly one command code.
    ///
    /// The expectation is written from the **core's** enumeration of its own
    /// failure modes rather than from what the mapper produced, which is the
    /// difference between a check and a restatement (`PROGRESS.md`, the vacuous
    /// audit corollary). The mapping's completeness in the other direction is
    /// held by the compiler: each `From` impl matches exhaustively, so a
    /// variant added to the core fails this crate's build.
    #[test]
    fn every_core_error_condition_maps_to_one_command_code() {
        let discovery: Vec<(DiscoveryError, &str)> = vec![
            (
                DiscoveryError::ConfigDirNotFound {
                    candidates: vec![PathBuf::from("/nowhere")],
                },
                "configDirNotFound",
            ),
            (
                DiscoveryError::NotADirectory(PathBuf::from("/nowhere")),
                "notADirectory",
            ),
            (
                DiscoveryError::Io {
                    path: PathBuf::from("/nowhere"),
                    source: std::io::Error::from(std::io::ErrorKind::NotFound),
                },
                "io",
            ),
        ];
        for (error, code) in discovery {
            assert_eq!(CommandError::from(error).code(), code);
        }

        let identity: Vec<(IdentityError, &str)> = vec![
            (
                IdentityError::WrongDocument {
                    expected: DocumentId(1),
                    found: DocumentId(2),
                },
                "identityWrongDocument",
            ),
            (
                IdentityError::StaleRevision {
                    expected: ContentRevision::of_bytes(b"a"),
                    found: ContentRevision::of_bytes(b"b"),
                },
                "identityStaleRevision",
            ),
            (
                IdentityError::NoSuchMatch { node: node_zero() },
                "identityNoSuchMatch",
            ),
        ];
        for (error, code) in identity {
            assert_eq!(CommandError::from(error).code(), code);
        }

        let workspace: Vec<(WorkspaceError, &str)> = vec![
            (
                WorkspaceError::Discovery(DiscoveryError::NotADirectory(PathBuf::from("/nowhere"))),
                "notADirectory",
            ),
            (
                WorkspaceError::UnknownDocument { id: DocumentId(9) },
                "unknownDocument",
            ),
            (
                WorkspaceError::Identity(IdentityError::StaleRevision {
                    expected: ContentRevision::of_bytes(b"a"),
                    found: ContentRevision::of_bytes(b"b"),
                }),
                "identityStaleRevision",
            ),
            (
                WorkspaceError::Io {
                    path: PathBuf::from("/nowhere"),
                    source: std::io::Error::from(std::io::ErrorKind::NotFound),
                },
                "io",
            ),
            (
                WorkspaceError::NotUtf8 {
                    path: PathBuf::from("/nowhere"),
                    offset: 3,
                },
                "notUtf8",
            ),
        ];
        for (error, code) in workspace {
            assert_eq!(CommandError::from(error).code(), code);
        }
    } // End of function every_core_error_condition_maps_to_one_command_code()

    /// A `NodeId` for the identity fixture above.
    ///
    /// `NodeId` cannot be constructed outside the core, so one is taken from a
    /// projection of a one-line document rather than invented.
    fn node_zero() -> espansoconfig_core::NodeId {
        let index = espansoconfig_core::SyntaxIndex::parse("a: b").expect("a trivial parse");
        index.nodes()[0].id
    }
}
