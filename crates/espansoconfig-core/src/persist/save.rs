//! The save transaction — the thirteen steps of plan section 6.6.
//!
//! **Phase 2a-2b scope: steps 3, 4 and 12**, wrapped around the primitive 2a-1
//! built (steps 1, 2 and 6 to 11) and the report 2a-2a built (step 5). Nothing
//! here opens a file for writing, parses a scalar or knows an espanso rule: it
//! is the **order** those three things happen in, the **lock** they happen
//! under, and the **policy** that decides whether the rename happens at all.
//!
//! **Phase 2a-3b added step 13**, and its placement is the whole of what this
//! module contributes to it: the backup is taken **between the verdict and the
//! commit**. The lock is already held there, the candidate already exists, and
//! the target's current bytes are already in memory, so no extra read of the
//! target happens — and a save that is refused, or that turns out to change
//! nothing, copies nothing.
//!
//! ```text
//!  1. lock_path                       persist::write   (2a-1)
//!  2. read the target, hash it,       here + persist::write
//!     compare with base_revision
//!  3. apply the edits in memory       patch::apply_edits (0c)
//!  4. reparse the whole candidate     patch::apply_edits's own verify (0c)
//!  5. project it and validate it      model + validate    (1a, 2a-2a)
//!     -> the blocking policy          here
//! 13. back the target up, rotate      persist::backup  (2a-3b)
//!  6-11. temp file, metadata, fsync,  persist::write   (2a-1, 2a-3a)
//!     re-check, rename, dir sync,
//!     read back and hash
//! 12. hand the caller the facts       here
//! ```
//!
//! Step 13 is numbered last in the plan and executed here **before** the commit,
//! for the reason a backup exists at all: a copy taken after the rename is a copy
//! of the new bytes.
//!
//! # The lock is taken once and held across steps 2 to 11
//!
//! [`save_document`] calls [`crate::persist::lock_path`] once and
//! [`crate::persist::replace_locked_file`] at the commit.
//! [`crate::persist::replace_file_atomically`] takes the lock itself and would
//! **deadlock** here; it is never called from this module. Everything between
//! the revision check and the rename — the read, the patch, the reparse, the
//! projection, the validation and the policy — happens with that one lock held,
//! because a revision check and a rename that are not one operation are not a
//! conflict check at all.
//!
//! **The source text is read inside the lock.** Patching bytes the caller read
//! earlier would defeat the very thing the lock is for: the caller supplies a
//! [`ContentRevision`] it believes the file holds, and this module reads the
//! file itself, hashes it, and refuses on a mismatch before an edit is planned.
//! The primitive re-checks the same revision at commit time; that is
//! belt-and-braces, not a substitute, because the primitive is handed finished
//! bytes and the patch has to be built against the bytes that are really there.
//!
//! # What this module still does not promise
//!
//! Everything `crate::persist::write`'s module documentation says about the
//! residual race is inherited unchanged. The write is **atomic replacement with
//! optimistic conflict detection**, not a compare-and-swap: a non-cooperating
//! writer — vim, espanso, a sync agent — can still be overwritten in a window
//! one `rename()` wide. No sentence here, and no name in it, may say otherwise.
//!
//! # Diagnostics are risk, not prophecy
//!
//! Plan section 6.6: the app does not control the daemon, so it cannot prove
//! espanso will accept a file. Every variant name and doc comment below says
//! *this looks wrong* or *this editor refuses to write that*, never *espanso
//! will reject this*.
//!
//! # On the wire since Phase 2b-1, and no command yet
//!
//! [`SaveError`], [`SaveVerdict`], [`SaveRefusal`] and [`Acknowledgement`]
//! serialize, and every variant of the two enums — together with every variant of
//! everything they carry — has a `code.` entry in **both**
//! `src/lib/i18n/en.json` and `es.json`. That was the whole of Phase 2b-1, and it
//! was indivisible: `src-tauri/src/dictionary_contract.rs` fails the build for one
//! variant serialized without its string, so half the enum on the wire is worse
//! than none of it.
//!
//! **Phase 2b-2a gave it its first caller.** `move_match` in
//! `src-tauri/src/commands.rs` is the one `#[tauri::command]` that reaches this
//! function, with exactly one [`DocumentEdit::MoveItem`] and nothing beside it
//! (`PROGRESS.md` R25).
//!
//! # Two content modes, one transaction — Phase 2b-2c-3
//!
//! [`SaveRequest::content`] is a [`SaveContent`], and its two arms are the only
//! two ways this application produces candidate bytes:
//!
//! - [`SaveContent::Edits`] — a batch of [`DocumentEdit`]s the patch engine
//!   plans, splices and reparses. Every byte outside an edit's span is proved
//!   identical, which is the guarantee the whole project is built on;
//! - [`SaveContent::ReplaceText`] — a whole replacement text, used **as
//!   submitted**. It does not go through [`apply_edits`] and no full-span
//!   [`DocumentEdit`] is synthesized for it, because a whole-document text is not
//!   a span replacement and must not claim the patch engine's locality
//!   invariants. Its narrower promise is stated on [`SaveContent::ReplaceText`].
//!
//! **The branch is inside this function, and that is the whole reason it is one
//! function.** [`crate::persist::lock_path`] is not reentrant, so a second public
//! writing entry point beside [`save_document`] is a process that hangs silently
//! and forever the first time one calls the other. The two modes diverge for
//! exactly two statements — how the candidate is produced, and how its parse is
//! reported — and then share the revision check, the validation, the
//! acknowledgement, the backup and the atomic commit.
//!
//! **A replacement text that does not parse is written, not refused**
//! (`docs/reviews/phase-2b-2c-3-design.md`, the owner's section overriding the
//! consult's Q2). Refusing would mean this application cannot repair a file that
//! is already broken. The parse is still attempted, because its answer is what
//! the user is told and what a caller's cache must do next; a failure becomes
//! [`crate::validate::FindingCode::DocumentDoesNotParse`], which is
//! acknowledgeable exactly like any other suspicion. So the first attempt is
//! refused for want of an acknowledgement and the second, carrying that exact
//! finding, commits. *Refused, not forced* was never *refused, full stop*: it is
//! **never written without the user meaning it**.
//!
//! **That finding names the candidate it is about.** It carries the submitted
//! text's own [`ContentRevision`] beside the parser's position, because a position
//! and a message are a property of the invalid *prefix*: two byte-distinct texts
//! that differ only after the parser stopped produce otherwise-equal findings, and
//! an [`Acknowledgement`] is an exact multiset of findings and nothing else.
//! Without the hash, consent collected for one broken text would silently commit
//! another — which is *forced*, wearing the protocol's clothes.
//!
//! [`Acknowledgement`] **deserializes as of Phase 2b-2a**, because an
//! acknowledgement is content-addressed and has to travel *back in*. Phase 2b-1's
//! review removed the one obstruction that was a **type** rather than a decision
//! — [`crate::validate::FindingCode::VariableMissingRequiredParam`] carries an
//! owned [`String`] — and the rest of the payload graph now derives
//! [`serde::Deserialize`] too. The comparison [`verdict`] makes was **already an
//! exact multiset** before this phase ([`Acknowledgement::covers_all`], which
//! consumes each match), so `[A, A]` differs from `[A]`; what 2b-2a added is a
//! test that drives that distinction through a *deserialized* acknowledgement,
//! which is the shape a caller can now build.

use std::fmt;
use std::path::{Path, PathBuf};

use serde::de::Deserializer;
use serde::ser::{SerializeStructVariant, Serializer};
use serde::{Deserialize, Serialize};

use crate::model::{DocumentContext, DocumentView, MatchView, TriggerKind, ValueView};
use crate::patch::{
    apply_edits, insertion_landings, DocumentEdit, DocumentPath, DuplicateItem, EditError,
    PatchedDocument, PathSegment, PresentationNote, Replacement, VerificationFailure,
};
use crate::persist::backup::{BackupError, BackupRecord, BackupSession};
use crate::persist::write::{
    inspect_target, lock_path, replace_locked_file, InspectedTarget, WriteError,
};
use crate::syntax::{ByteSpan, SyntaxError, SyntaxIndex, TriviaIndex};
use crate::validate::{validate, Finding, FindingClass, FindingCode};
use crate::wire::WirePathRef;
use crate::ContentRevision;

// ---------------------------------------------------------------------------
// The blocking policy
// ---------------------------------------------------------------------------

/// The findings a caller has already been shown and has chosen to save past.
///
/// **An acknowledgement is by content, never by flag.** It holds the exact
/// [`Finding`]s the caller saw, and [`save_document`] refuses unless every
/// suspicion the candidate produces is one of them. A boolean
/// `ignore_warnings: true` would let a caller wave past findings it never
/// looked at, and plan section 6.6's whole reason for classifying diagnostics
/// is that somebody looks.
///
/// **Only [`FindingClass::SuspiciousButPermitted`] can be acknowledged.**
/// [`Acknowledgement::of`] drops everything else at construction, so the type
/// itself says that an [`FindingClass::EditorModelError`] has no override here
/// — see [`SaveVerdict`] for why.
///
/// It is a claim about **one candidate**. Two findings that differ only in
/// their [`crate::syntax::ByteSpan`] are different findings, so an
/// acknowledgement taken against a document that has since moved on the disk
/// no longer covers anything, and the save is refused again. That strictness is
/// the point: the second call re-reads, re-patches and re-validates, and what
/// the user agreed to has to still be what the transaction is about to write.
///
/// # It arrives from outside, since Phase 2b-2a
///
/// [`serde::Deserialize`] is **hand-written and routes through
/// [`Acknowledgement::of`]**, which is the only reason it is not a derive: a
/// derive would fill [`Acknowledgement::accepted`] with whatever arrived,
/// including an [`FindingClass::EditorModelError`], and the type's own
/// documentation two paragraphs up says it holds suspicions and nothing else.
/// The filter is not a security boundary — [`verdict`] refuses an error however
/// much is acknowledged — it is the invariant staying true of every value of the
/// type, so that [`Acknowledgement::len`] cannot come to mean two things.
///
/// **Deserializing one establishes nothing about it.** Anything can be written
/// into a JSON array; what makes an acknowledgement mean something is that
/// [`verdict`] matches it against findings recomputed from the candidate under
/// the lock. `docs/decisions/2b-1-notes.md` section 4 states the corollary: the
/// core cannot know that a human saw a finding, so enforcing presentation is the
/// user interface's obligation.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct Acknowledgement {
    /// The suspicions the caller accepted, in the order it supplied them.
    accepted: Vec<Finding>,
}

impl<'de> Deserialize<'de> for Acknowledgement {
    /// Reads `{ "accepted": [ … ] }` and re-applies [`Acknowledgement::of`]'s
    /// filter to what arrives.
    ///
    /// The wire shape is exactly what the `Serialize` derive writes, so the value
    /// round-trips; what does not round-trip is a hand-built payload holding a
    /// finding of a class this type does not carry, and that is deliberate. See
    /// the type's own documentation for why the filter is an invariant rather
    /// than a check.
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Acknowledgement, D::Error> {
        /// The wire shape, with no invariant of its own.
        #[derive(Deserialize)]
        struct Wire {
            /// Whatever the caller sent, unfiltered.
            accepted: Vec<Finding>,
        }
        let wire = Wire::deserialize(deserializer)?;
        Ok(Acknowledgement::of(&wire.accepted))
    } // End of function deserialize() for Acknowledgement
}

impl Acknowledgement {
    /// Acknowledges nothing. Any finding at all refuses the save.
    ///
    /// This is what a first save attempt passes, and what a caller that has no
    /// user in front of it must pass.
    pub fn none() -> Acknowledgement {
        Acknowledgement {
            accepted: Vec::new(),
        }
    }

    /// Acknowledges every [`FindingClass::SuspiciousButPermitted`] finding in
    /// `findings`, and nothing else.
    ///
    /// Findings of any other class are **discarded here rather than refused
    /// later**, so that [`Acknowledgement::len`] reports what was actually
    /// accepted and a caller cannot come to believe it has waved an error past.
    pub fn of(findings: &[Finding]) -> Acknowledgement {
        Acknowledgement {
            accepted: findings
                .iter()
                .filter(|finding| finding.class() == FindingClass::SuspiciousButPermitted)
                .cloned()
                .collect(),
        }
    }

    /// How many findings this acknowledgement actually covers.
    pub fn len(&self) -> usize {
        self.accepted.len()
    }

    /// Whether it covers nothing.
    pub fn is_empty(&self) -> bool {
        self.accepted.is_empty()
    }

    /// Whether `finding` is one of the findings this acknowledgement covers.
    ///
    /// Equality is [`Finding`]'s own — the code, its operands, the span, the
    /// node and the path — so this is a claim about one candidate's bytes.
    ///
    /// **This is membership, and membership loses multiplicity.**
    /// [`crate::validate::validate`] can report the *same* finding twice — an
    /// unresolved reference is reported once per occurrence while each finding
    /// records the whole scalar's span, node and path — and one acknowledged
    /// copy would answer `true` here for both of them. The gate therefore asks
    /// [`Acknowledgement::covers_all`] instead, which matches as a multiset. Use
    /// this one only to ask *"was this shown?"*, never *"may this candidate
    /// proceed?"*.
    pub fn covers(&self, finding: &Finding) -> bool {
        self.accepted.contains(finding)
    }

    /// Whether every [`FindingClass::SuspiciousButPermitted`] finding in
    /// `findings` is matched by a **distinct** acknowledged finding.
    ///
    /// The multiset reading of [`Acknowledgement::covers`], and the one the gate
    /// uses. Two equal suspicions need two acknowledged copies, because they are
    /// two things the user was shown: `validate` reports an unresolved reference
    /// once per occurrence, and a finding records the whole scalar's span rather
    /// than the occurrence's, so a scalar that gains a second `{{name}}` can
    /// produce a second finding equal to the first. Under membership, the
    /// acknowledgement of one occurrence would silently cover both, and the
    /// second one would never be shown.
    ///
    /// Findings of any other class are ignored here: they are not
    /// acknowledgeable at all, and [`verdict`] has already refused on one before
    /// this is asked.
    pub fn covers_all(&self, findings: &[Finding]) -> bool {
        let mut unmatched: Vec<&Finding> = self.accepted.iter().collect();
        for finding in findings
            .iter()
            .filter(|finding| finding.class() == FindingClass::SuspiciousButPermitted)
        {
            let Some(position) = unmatched.iter().position(|shown| *shown == finding) else {
                return false;
            };
            unmatched.swap_remove(position);
        } // End of the loop over the candidate's suspicions
        true
    } // End of function covers_all()
}

/// What the semantic gate's findings do to a save.
///
/// **This is the blocking policy, and it lives here rather than in
/// [`crate::validate`]**, which reports and never refuses (2a-2a notes
/// section 2). It gates on [`FindingClass`] and on nothing else, so a rule that
/// changes class changes what a save does without a line of this module moving.
///
/// The two classes are treated differently because they are separated by one
/// question (2a-2a notes section 3): *does the claim rest on a vocabulary
/// espanso can extend without telling us?*
///
/// - **No — [`FindingClass::EditorModelError`].** The claim is about a shape
///   espanso cannot grow out of. There is **no acknowledgement** for one of
///   these at this entry point: if this crate is wrong about such a rule the
///   answer is to fix the rule, not to give every user a button that routes
///   around it. A refusal is a refusal of *this* save, never of the file: any
///   later save that also removes the finding is accepted, so the visual editor
///   can still repair the document. What it cannot do is leave the finding
///   standing, which is exactly plan section 7's hazard 4.
/// - **Yes — [`FindingClass::SuspiciousButPermitted`].** The class exists
///   *because* this crate may be wrong. A gate that could not be passed on a
///   claim the crate itself calls unprovable would be the app asserting an
///   authority it does not have — the same mistake as "espanso will reject
///   this", one level up. So it is refused **until the caller acknowledges it
///   by content**, and the findings travel back on the success path too.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum SaveVerdict {
    /// Nothing in the candidate stands in the way of the commit.
    ///
    /// Reached either because the candidate produced no finding at all, or
    /// because every finding it produced was a suspicion the caller
    /// acknowledged.
    Proceed,
    /// The candidate holds at least one [`FindingClass::EditorModelError`].
    ///
    /// Not acknowledgeable here. The refusal carries every finding, so a caller
    /// can show which ones and where.
    RefusedForEditorModelErrors,
    /// The candidate holds suspicions the caller has not acknowledged.
    ///
    /// The caller's next move is to show them and, if the user says so, call
    /// again with [`Acknowledgement::of`] over the findings this refusal
    /// carried.
    RefusedForUnacknowledgedSuspicions,
}

impl SaveVerdict {
    /// Whether this verdict lets the commit happen.
    pub fn proceeds(self) -> bool {
        matches!(self, SaveVerdict::Proceed)
    }

    /// A stable identifier, for logs and test output. **Not a user-facing
    /// string** (plan section 9).
    pub fn name(self) -> &'static str {
        match self {
            SaveVerdict::Proceed => "Proceed",
            SaveVerdict::RefusedForEditorModelErrors => "RefusedForEditorModelErrors",
            SaveVerdict::RefusedForUnacknowledgedSuspicions => "RefusedForUnacknowledgedSuspicions",
        }
    }
}

impl fmt::Display for SaveVerdict {
    /// A developer rendering, for logs and test output. Never shown to a user.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.name())
    }
}

/// Applies the blocking policy to one candidate's findings.
///
/// **Pure**: no I/O, no lock, no filesystem, and no knowledge of which document
/// the findings are about. Public and separate from [`save_document`] so the
/// policy can be checked on every combination of its inputs without a temp
/// directory — the same reason [`crate::validate::validate`] is a pure function
/// of a projection.
///
/// An [`FindingClass::EditorModelError`] wins over an unacknowledged suspicion,
/// because it is the fact the caller most needs to hear first.
///
/// The suspicions are matched as a **multiset**
/// ([`Acknowledgement::covers_all`]), so *n* equal suspicions need *n*
/// acknowledged copies.
pub fn verdict(findings: &[Finding], acknowledgement: &Acknowledgement) -> SaveVerdict {
    if findings
        .iter()
        .any(|finding| finding.class() == FindingClass::EditorModelError)
    {
        return SaveVerdict::RefusedForEditorModelErrors;
    }
    if !acknowledgement.covers_all(findings) {
        return SaveVerdict::RefusedForUnacknowledgedSuspicions;
    }
    SaveVerdict::Proceed
} // End of function verdict()

// ---------------------------------------------------------------------------
// The request and its answer
// ---------------------------------------------------------------------------

/// How a save says what the file should hold afterwards.
///
/// **Two modes with two different promises**, and the difference is the reason
/// this is an enum rather than an optional field. Both travel through the one
/// [`save_document`] transaction, under the one lock, past the same revision
/// check, the same semantic gate, the same acknowledgement and the same backup.
///
/// It is a **core** type and is not on the wire: a command builds one from
/// whatever it deserialized, and nothing outside this crate serializes a request.
#[derive(Debug, Clone, Copy)]
pub enum SaveContent<'a> {
    /// A batch of edits, in the protocol [`crate::patch::apply_edits`] defines.
    ///
    /// An empty batch is legal and produces a candidate identical to the source.
    ///
    /// **This mode carries the patch engine's guarantee**: every byte outside a
    /// planned span comes out identical, and the engine reparses and verifies the
    /// whole candidate before this transaction ever sees it.
    Edits(&'a [DocumentEdit]),
    /// A whole replacement text, written **exactly as submitted**.
    ///
    /// # The promise, which is narrower on purpose
    ///
    /// The exact submitted UTF-8 bytes are committed: no parser formatting, no
    /// newline normalization, no BOM added or removed, no final newline
    /// supplied, no re-indentation — no application-authored transformation of
    /// any kind. That is *all* it promises.
    ///
    /// **It is not a locality-preserving edit and must never be described as
    /// one.** Calling the whole file "the edited span" would make the patch
    /// engine's guarantee vacuous. There are no untouched bytes to prove
    /// untouched, so the transaction's safety comes from somewhere else: the
    /// revision check under the lock, which is more load-bearing here than
    /// anywhere else in this crate, and the acknowledgement protocol.
    ///
    /// **It never becomes a [`DocumentEdit`].** Synthesizing a full-span edit
    /// would run these bytes through the engine's planner, its verification and
    /// its presentation notes, and would let a mode with no locality claim
    /// borrow the vocabulary of the mode that has one.
    ///
    /// A caller supplies the text including whatever BOM it is to have; nothing
    /// here adds or removes one.
    ///
    /// **This arm requires a [`SaveRequest::backups`] session**, and a `None`
    /// there is [`SaveError::ReplacementRequiresBackups`] before the lock is
    /// taken. Nothing of the previous file survives a commit here, so the copy of
    /// what it replaced is all a user is left with.
    ReplaceText(&'a str),
} // End of enum SaveContent

/// Everything one save needs to know.
///
/// A struct rather than five positional arguments, because four of them are
/// easy to transpose and one of them decides whether a user's file is written.
#[derive(Debug, Clone, Copy)]
pub struct SaveRequest<'a> {
    /// Which document, and everything about it that comes from outside its own
    /// bytes.
    ///
    /// [`DocumentContext::path`] is **the** path — there is no second path
    /// argument that could disagree with it. It may be relative, may contain
    /// `.` or `..` and may be a symlink; it is canonicalised by
    /// [`crate::persist::lock_path`] and the real file is the one written.
    ///
    /// The context also decides [`crate::model::DocumentView::read_only`], and
    /// a read-only document is refused before the lock is taken.
    pub context: &'a DocumentContext,
    /// The revision the caller believes the file holds.
    ///
    /// Hazard 1's defence. The transaction reads the file under the lock and
    /// refuses with [`SaveError::RevisionMismatch`] when it disagrees, before
    /// any edit is planned.
    pub base_revision: ContentRevision,
    /// What the file should hold afterwards, and by which of the two routes.
    ///
    /// See [`SaveContent`]: the arms carry different promises, and the one this
    /// field names decides which promise this save is entitled to make.
    pub content: SaveContent<'a>,
    /// The suspicions the caller has already shown someone.
    ///
    /// Pass [`Acknowledgement::none`] on a first attempt.
    pub acknowledgement: &'a Acknowledgement,
    /// The editing session's backups — step 13 — or `None` for a save that takes
    /// none.
    ///
    /// **An `Option` so that "no backup" is something a caller says rather than
    /// something it forgets.** The session owns the state *"which files have
    /// already been copied"*, because that is session state and this module holds
    /// none of its own; [`BackupSession`] records why it is neither a process
    /// global nor a second reader of [`crate::workspace::Workspace`].
    ///
    /// A backup that **cannot be written fails the save** before the commit, so
    /// this call does not rewrite the target: see [`SaveError::Backup`]. A backup
    /// that is merely unnecessary — the session already copied this file, or the
    /// candidate turned out byte-identical — is not a failure and writes nothing.
    ///
    /// **`None` is legal for [`SaveContent::Edits`] and refused for
    /// [`SaveContent::ReplaceText`]**, before the lock, as
    /// [`SaveError::ReplacementRequiresBackups`]. An edit's commit can destroy
    /// only the planned spans; a replacement's destroys the whole file, and the
    /// design consult's Q6 rules that such a commit must leave a recoverable
    /// pre-commit image behind.
    pub backups: Option<&'a BackupSession>,
}

/// What a save that got past both gates leaves the caller holding — step 12.
///
/// This is *facts*, not a cache write: the transaction does not own the
/// caller's in-memory snapshot and does not reach into
/// [`crate::workspace::Workspace`]. Everything needed to update one is here.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SavedDocument {
    /// The revision the file held **at the last moment this transaction looked
    /// at it**, which is the last thing it did before returning.
    ///
    /// On a commit this is the hash of the bytes the primitive **read back from
    /// disk** after the rename (step 11), so it is simultaneously the caller's
    /// new base revision and the hash its watcher must ignore (plan
    /// section 6.5 step 4). On a skipped commit it is the hash of a **second
    /// read of the target**, taken under the lock after both gates ran and
    /// compared against [`SaveRequest::base_revision`]; a disagreement is
    /// [`SaveError::RevisionMismatch`] rather than a success.
    ///
    /// **It is not a promise about the file now.** The lock excludes only this
    /// process's cooperating writers, so vim, espanso or a sync agent can
    /// replace the file between that last read and this value reaching the
    /// caller. Re-reading narrows the window; nothing at this layer closes it
    /// (2a-1 notes D4). A caller that needs certainty has to re-read, and a
    /// user-facing string must never say *your edit cannot be lost*.
    pub revision: ContentRevision,
    /// The verified candidate, BOM included — the text whose hash is
    /// [`SavedDocument::revision`].
    ///
    /// The same qualification as that field: it is what the file held when the
    /// transaction last looked, not what it holds now.
    pub text: String,
    /// Every byte-span replacement that produced it, in ascending span order,
    /// in **original-document** coordinates.
    ///
    /// **A [`SaveContent::ReplaceText`] save reports exactly one**, spanning the
    /// whole original document. That is the truthful byte-level statement about
    /// what happened — everything was replaced — and it is deliberately *not* a
    /// locality claim: it is the assertion that there is no locality to claim.
    /// The alternative, an empty list, would read as *nothing was replaced*,
    /// which is the one thing it must not say. No [`DocumentEdit`] was
    /// synthesized to produce it; this is a record of the outcome, not of a plan.
    pub replacements: Vec<Replacement>,
    /// Presentation changes the patch had to make, for the caller to surface
    /// (plan section 6.2: never silently normalise).
    ///
    /// Two kinds, and neither is a failure: a scalar whose spelling changed as
    /// well as its value, and a sequence-item removal that left the blank lines
    /// on both sides of the item next to each other. Never a move's — see
    /// [`PresentationNote::DoubledSequenceSeparation`].
    ///
    /// **Always empty for a [`SaveContent::ReplaceText`] save**, and that is a
    /// property rather than an accident: such a save re-encodes no scalar and
    /// moves no item, so there is no presentation change this application could
    /// have authored. `tests/persist_raw_save.rs` asserts it rather than
    /// assuming it.
    pub notes: Vec<PresentationNote>,
    /// Every finding the semantic gate reported about the candidate.
    ///
    /// **Non-empty on a success is normal**: it is the set of suspicions the
    /// caller acknowledged, returned so that a save which proceeded past
    /// something can say what it proceeded past. It never holds a
    /// [`FindingClass::EditorModelError`] — that verdict has no success path.
    pub findings: Vec<Finding>,
    /// Whether the file was actually rewritten.
    ///
    /// `false` when the candidate came out **byte-identical** to what the file
    /// already held, which an empty batch always produces and an edit that
    /// writes a scalar's existing value can. Both gates still ran; the rename
    /// did not. Every save drops eight classes of file metadata (2a-1 notes
    /// section 4) and installs a new inode, so paying that for a document that
    /// did not change is pure loss.
    pub committed: bool,
    /// Step 13: where this save's pre-save copy of the target was written, and
    /// what rotation did.
    ///
    /// `None` — which is **not** a failure — in four cases, each of them a
    /// decision recorded in `docs/decisions/2a-3b-notes.md`:
    ///
    /// - [`SaveRequest::backups`] was `None`, so the caller asked for none —
    ///   which only a [`SaveContent::Edits`] save may ask for, since a
    ///   replacement with no session is refused before the lock;
    /// - [`SavedDocument::committed`] is `false`, so nothing was rewritten and
    ///   there is nothing to have a pristine copy of;
    /// - this session had already copied this file, which is plan section 6.6's
    ///   *"before the **first** modification of each file per session"*;
    /// - the document was refused, in which case there is no [`SavedDocument`] at
    ///   all.
    ///
    /// A `Some` is **not a promise that the file is recoverable**. Retention is
    /// ten batches, and a batch is a session; the eleventh session after this one
    /// removes this one's copies. No string built on this field may say
    /// otherwise.
    pub backup: Option<BackupRecord>,
}

/// Why the semantic gate refused — step 5's answer, with its evidence.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SaveRefusal {
    /// Which arm of the policy refused.
    pub verdict: SaveVerdict,
    /// **Every** finding the candidate produced, of both classes, in
    /// [`crate::validate::validate`]'s order.
    ///
    /// All of them rather than only the blocking ones, because a caller that
    /// shows the user one list and then asks for an acknowledgement needs the
    /// list it will be handed back.
    pub findings: Vec<Finding>,
}

// ---------------------------------------------------------------------------
// The failures
// ---------------------------------------------------------------------------

/// Why a save did not commit.
///
/// Codes plus structured data, never prose (plan section 9); the `Display` impl
/// is for logs, panics and test output.
///
/// **A refusal is not a failure**, and [`SaveError::is_refusal`] is how a caller
/// tells them apart without matching every variant: a refusal is a check
/// deciding not to write, a failure is the environment stopping the write from
/// happening. Both leave the file alone except where
/// [`SaveError::may_have_written`] says otherwise.
///
/// Serializes as an externally tagged variant, with every path rendered through
/// [`WirePathRef`] and every carried error kept whole — see the `Serialize` impl
/// below for why neither is a default.
#[derive(Debug)]
pub enum SaveError {
    /// The document is one the editor must not write at all: a Hub package
    /// under `match/packages/` (see [`crate::discovery::FileKind`]).
    ///
    /// Refused **before the lock is taken**, because there is nothing to
    /// serialise against.
    DocumentIsReadOnly {
        /// The path as the caller spelled it. Nothing was resolved.
        path: PathBuf,
    },
    /// A [`SaveContent::ReplaceText`] save was set up with no
    /// [`SaveRequest::backups`] session, so committing it would destroy every
    /// byte of the file with no recoverable image of what it replaced.
    ///
    /// Refused **before the lock is taken**, beside
    /// [`SaveError::DocumentIsReadOnly`] and for the same reason: nothing the
    /// file holds changes the answer, so serialising against other writers buys
    /// nothing and the target is never even opened.
    ///
    /// **It is a rule about the replacement mode alone.** `backups: None` stays
    /// legal for [`SaveContent::Edits`], where the patch engine bounds what a
    /// commit can destroy to the planned spans and every other byte of the
    /// pre-edit file is still on disk afterwards. A replacement has no such
    /// bound, which is why the design consult's Q6 rules that *every committed
    /// raw replacement must have a recoverable pre-commit image* — and a caller
    /// with no session cannot leave one.
    ///
    /// **A backup that is merely unnecessary is not this.** A session that has
    /// already copied this file already holds the image plan section 6.6 asks
    /// for — *before the **first** modification of each file per session* — so
    /// `take_backup` answering `None` there is that rule working rather than a
    /// missing image, and such a save commits. Only the **absence of a session**
    /// is refused here, and `tests/persist_raw_save.rs` pins both sides.
    ///
    /// [`SaveError::is_refusal`] answers **`true`**: a check of this application
    /// declined to write, and the caller retries it differently by supplying a
    /// session.
    ReplacementRequiresBackups {
        /// The path as the caller spelled it. Nothing was resolved.
        path: PathBuf,
    },
    /// Steps 1 and 2: the target could not be resolved, locked or read.
    ///
    /// Carries [`WriteError`] unflattened, so [`WriteError::path`] and the
    /// [`WriteStep`] of an I/O failure survive.
    Target(WriteError),
    /// Step 2: the target's bytes are not valid UTF-8, so there is no text to
    /// patch.
    ///
    /// The same refusal [`crate::workspace::WorkspaceError::NotUtf8`] makes for
    /// reading, made here for writing. Widening it would mean patching bytes
    /// this crate cannot decode, which no part of the edit engine is built for.
    TargetNotUtf8 {
        /// The resolved path.
        path: PathBuf,
        /// Byte offset of the first invalid sequence.
        offset: usize,
    },
    /// Step 2: under the lock, the file does not hold what the caller believed
    /// it held. Nothing was written.
    ///
    /// Hazard 1. Distinct from a [`WriteError::RevisionMismatch`] arriving
    /// inside [`SaveError::Write`]: this one is the check *before* the patch is
    /// built, and that one is the primitive's own re-check at the commit.
    RevisionMismatch {
        /// The resolved path.
        path: PathBuf,
        /// The revision the caller based its edits on.
        expected: ContentRevision,
        /// The revision the file holds.
        found: ContentRevision,
    },
    /// Steps 3 and 4: the edits could not be planned, or the candidate did not
    /// survive being reparsed and checked.
    ///
    /// **Step 4 is inside this variant, not beside it.**
    /// [`crate::patch::apply_edits`] reparses the whole candidate and verifies
    /// it before returning, so an [`EditError::Verification`] here *is* the
    /// syntax gate's answer; [`SaveError::syntax_gate_failure`] picks it out
    /// without flattening the rest away.
    Patch(EditError),
    /// Step 5: the candidate parsed inside step 4 and then did **not** parse
    /// here. Nothing was written.
    ///
    /// **Two calls to one parser have contradicted each other about one
    /// candidate.** [`crate::patch::apply_edits`] cannot return a
    /// [`crate::patch::PatchedDocument`] without [`SyntaxIndex::parse`]
    /// accepting the candidate, and the projection parses the very same bytes
    /// again a few microseconds later; so this is not the syntax gate refusing —
    /// the syntax gate *passed*. It is a defect in this crate or a parser that
    /// is not a function of its input, and it is a distinct variant precisely so
    /// that it cannot be read as, or mistaken in a test for,
    /// [`SaveError::Patch`] carrying
    /// [`crate::patch::VerificationFailure::DoesNotParse`].
    ///
    /// [`SaveError::is_refusal`] answers `false` for it: a refusal is a check
    /// declining to write, and there is nothing here for a user to decide.
    CandidateParseDisagrees {
        /// The resolved path.
        path: PathBuf,
        /// What the projection's parse said. The other parse said nothing.
        error: SyntaxError,
    },
    /// Step 5: the semantic gate refused. Nothing was written.
    Refused(SaveRefusal),
    /// Step 13: the pre-save copy could not be written, so **this call did not
    /// reach its rename**.
    ///
    /// **A save whose safety net cannot be put in place does not proceed**, and
    /// that is a policy rather than an accident. It is the same argument 2a-3a
    /// makes for a metadata copy that fails (`docs/decisions/2a-3a-notes.md`
    /// section 4): committing anyway would make an unread field the only thing
    /// between a user and a destructive operation performed without the copy that
    /// exists to survive it, while stopping costs the attempt — the caller still
    /// holds the candidate, and this call has not rewritten the target. What the
    /// target holds *now* is a question only a re-read answers, here as
    /// everywhere else, because an external writer is always possible.
    ///
    /// What it can leave behind is stated rather than denied: an **empty batch
    /// directory** carrying its ownership marker, which the next rotation counts
    /// and eventually removes. No older batch is removed on this path, because
    /// rotation runs only after a copy has been written
    /// (`docs/decisions/2a-3b-notes.md` section 7).
    ///
    /// A caller that does not want backups says so with
    /// `SaveRequest { backups: None, .. }`, which cannot produce this.
    ///
    /// [`SaveError::is_refusal`] answers **`false`**: no check declined anything.
    /// The filesystem refused an operation, exactly as it does for
    /// [`WriteError::Io`], and a caller shows it as a problem rather than as a
    /// choice.
    Backup(BackupError),
    /// Steps 6 to 11: the commit itself.
    ///
    /// Carries [`WriteError`] whole so that [`WriteError::may_have_written`]
    /// survives — the one question whose answer changes what a caller does
    /// next.
    Write(WriteError),
}

impl SaveError {
    /// Whether **this call's** rename may have completed.
    ///
    /// `false` for every refusal and for every failure before the commit.
    /// Otherwise it is [`WriteError::may_have_written`]'s answer, with its
    /// qualification intact: it is a statement about this call's rename, **not**
    /// about what the target holds now. The target must be re-read whenever
    /// external writers are possible, which for an espanso configuration is
    /// always.
    pub fn may_have_written(&self) -> bool {
        match self {
            SaveError::DocumentIsReadOnly { .. }
            | SaveError::ReplacementRequiresBackups { .. }
            | SaveError::Target(_)
            | SaveError::TargetNotUtf8 { .. }
            | SaveError::RevisionMismatch { .. }
            | SaveError::Patch(_)
            | SaveError::CandidateParseDisagrees { .. }
            | SaveError::Refused(_)
            | SaveError::Backup(_) => false,
            SaveError::Write(error) => error.may_have_written(),
        }
    } // End of function may_have_written()

    /// Whether a **check** declined to write, as opposed to the environment
    /// stopping the write.
    ///
    /// A refusal is this application's decision and is what the user is shown
    /// as a choice — reload, fix, acknowledge. A failure is a disk, a
    /// permission or a filesystem, and is what the user is shown as a problem.
    /// The distinction is not cosmetic: only a refusal is worth offering to
    /// retry differently.
    ///
    /// The [`WriteError`] arms are matched exhaustively rather than by a
    /// catch-all, so a new variant of that type is a compile error here instead
    /// of a silent default.
    ///
    /// [`SaveError::CandidateParseDisagrees`] is a **failure**, not a refusal:
    /// no check declined anything — both parses ran, and they disagreed. There
    /// is no different way for the user to retry it, which is the question this
    /// predicate exists to answer.
    ///
    /// [`WriteError::TempFileChangedDuringWrite`] is a **refusal**, for the same
    /// reason [`WriteError::TargetChangedDuringWrite`] is: a check this
    /// application makes declined to commit, the file on disk is untouched, and
    /// retrying is exactly the right response — the next attempt mints a fresh
    /// temp name.
    ///
    /// [`SaveError::Backup`] is a **failure**, not a refusal, for the same reason
    /// [`WriteError::Io`] is: the environment stopped an operation. That it
    /// happens to stop the save before the commit makes it safe, not a choice.
    ///
    /// [`SaveError::ReplacementRequiresBackups`] is a **refusal**, and the
    /// distinction from [`SaveError::Backup`] beside it is exactly the one this
    /// predicate exists to draw: no copy was attempted and no filesystem said no
    /// — a policy of this application declined, and supplying a
    /// [`BackupSession`] is the different retry.
    pub fn is_refusal(&self) -> bool {
        match self {
            SaveError::DocumentIsReadOnly { .. }
            | SaveError::ReplacementRequiresBackups { .. }
            | SaveError::TargetNotUtf8 { .. }
            | SaveError::RevisionMismatch { .. }
            | SaveError::Patch(_)
            | SaveError::Refused(_) => true,
            SaveError::CandidateParseDisagrees { .. } | SaveError::Backup(_) => false,
            SaveError::Target(error) | SaveError::Write(error) => match error {
                WriteError::TargetMissing { .. }
                | WriteError::TargetNotRegularFile { .. }
                | WriteError::RevisionMismatch { .. }
                | WriteError::TargetChangedDuringWrite { .. }
                | WriteError::TempFileChangedDuringWrite { .. } => true,
                WriteError::VerificationFailed { .. } | WriteError::Io { .. } => false,
            },
        }
    } // End of function is_refusal()

    /// The findings this error carries, which is a non-empty list only for
    /// [`SaveError::Refused`].
    ///
    /// Exists so that a caller building an [`Acknowledgement`] does not have to
    /// match the variant to reach the list it is acknowledging.
    pub fn findings(&self) -> &[Finding] {
        match self {
            SaveError::Refused(refusal) => &refusal.findings,
            _ => &[],
        }
    }

    /// The syntax gate's own answer, when that is what refused.
    ///
    /// Step 4 is discharged inside [`crate::patch::apply_edits`], whose
    /// `verify` reparses the whole candidate and answers a failed parse with
    /// [`VerificationFailure::DoesNotParse`]. This picks that answer out of
    /// [`SaveError::Patch`] without collapsing the other planning failures into
    /// it, so a caller can say *"the result would not have been valid YAML"*
    /// where that is true and something else where it is not.
    ///
    /// **[`SaveError::CandidateParseDisagrees`] is not this**, and answering
    /// `None` for it is the whole point of that variant: there the syntax gate
    /// succeeded and the projection's parse of the same bytes did not, which is
    /// a contradiction inside this crate rather than a verdict about the
    /// candidate.
    pub fn syntax_gate_failure(&self) -> Option<&VerificationFailure> {
        match self {
            SaveError::Patch(EditError::Verification(failure)) => Some(failure),
            _ => None,
        }
    }
}

impl Serialize for SaveError {
    /// Externally tagged, exactly as its neighbours are, and hand-written for the
    /// two reasons [`crate::persist::WriteError`]'s impl states: five variants
    /// carry a [`PathBuf`], and `serde`'s own path serializer **fails** on a path
    /// that is not valid UTF-8 — which would replace a typed refusal with the
    /// serializer's English prose at the one moment nothing is left to send.
    /// [`WirePathRef`] renders lossily and cannot fail.
    ///
    /// **The nesting is deliberate.** [`SaveError::Target`] and
    /// [`SaveError::Write`] both carry a whole [`WriteError`] rather than a
    /// flattened copy of its fields, because [`WriteError::may_have_written`] is
    /// the one question whose answer changes what a caller does next, and
    /// flattening loses the [`crate::persist::WriteStep`] it is computed from.
    /// The same argument
    /// keeps [`SaveError::Patch`], [`SaveError::Backup`] and
    /// [`SaveError::Refused`] whole. A *shell* type that wants nine flat codes to
    /// switch on builds them from these, the way `CommandError` already does for
    /// the read surface; it does not get them from here.
    ///
    /// A variant added to this enum is a compile error in this `match`, which is
    /// the prompt to add its two dictionary entries.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            SaveError::DocumentIsReadOnly { path } => {
                let mut out =
                    serializer.serialize_struct_variant("SaveError", 0, "DocumentIsReadOnly", 1)?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            SaveError::ReplacementRequiresBackups { path } => {
                let mut out = serializer.serialize_struct_variant(
                    "SaveError",
                    1,
                    "ReplacementRequiresBackups",
                    1,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            SaveError::Target(error) => {
                serializer.serialize_newtype_variant("SaveError", 2, "Target", error)
            }
            SaveError::TargetNotUtf8 { path, offset } => {
                let mut out =
                    serializer.serialize_struct_variant("SaveError", 3, "TargetNotUtf8", 2)?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("offset", offset)?;
                out.end()
            }
            SaveError::RevisionMismatch {
                path,
                expected,
                found,
            } => {
                let mut out =
                    serializer.serialize_struct_variant("SaveError", 4, "RevisionMismatch", 3)?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("expected", expected)?;
                out.serialize_field("found", found)?;
                out.end()
            }
            SaveError::Patch(error) => {
                serializer.serialize_newtype_variant("SaveError", 5, "Patch", error)
            }
            SaveError::CandidateParseDisagrees { path, error } => {
                let mut out = serializer.serialize_struct_variant(
                    "SaveError",
                    6,
                    "CandidateParseDisagrees",
                    2,
                )?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("error", error)?;
                out.end()
            }
            SaveError::Refused(refusal) => {
                serializer.serialize_newtype_variant("SaveError", 7, "Refused", refusal)
            }
            SaveError::Backup(error) => {
                serializer.serialize_newtype_variant("SaveError", 8, "Backup", error)
            }
            SaveError::Write(error) => {
                serializer.serialize_newtype_variant("SaveError", 9, "Write", error)
            }
        }
    } // End of function serialize() for SaveError
}

impl fmt::Display for SaveError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SaveError::DocumentIsReadOnly { path } => {
                write!(
                    formatter,
                    "{} belongs to an installed package and is not editable here",
                    path.display()
                )
            }
            SaveError::ReplacementRequiresBackups { path } => {
                write!(
                    formatter,
                    "replacing the whole of {} needs a backup session and none was supplied",
                    path.display()
                )
            }
            SaveError::Target(error) => write!(formatter, "{error}"),
            SaveError::TargetNotUtf8 { path, offset } => {
                write!(
                    formatter,
                    "{} is not valid UTF-8 at byte {offset}",
                    path.display()
                )
            }
            SaveError::RevisionMismatch {
                path,
                expected,
                found,
            } => write!(
                formatter,
                "{} holds {found}, not {expected}",
                path.display()
            ),
            SaveError::Patch(error) => write!(formatter, "{error}"),
            SaveError::CandidateParseDisagrees { path, error } => write!(
                formatter,
                "the candidate for {} parsed once and not again: {error}",
                path.display()
            ),
            SaveError::Refused(refusal) => write!(
                formatter,
                "{} with {} finding(s)",
                refusal.verdict,
                refusal.findings.len()
            ),
            SaveError::Backup(error) => write!(formatter, "{error}"),
            SaveError::Write(error) => write!(formatter, "{error}"),
        }
    } // End of function fmt() for SaveError
}

impl std::error::Error for SaveError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            SaveError::Target(error) | SaveError::Write(error) => Some(error),
            SaveError::Patch(error) => Some(error),
            SaveError::Backup(error) => Some(error),
            SaveError::CandidateParseDisagrees { error, .. } => Some(error),
            _ => None,
        }
    }
}

// ---------------------------------------------------------------------------
// The transaction
// ---------------------------------------------------------------------------

/// Runs steps 1 to 12 of plan section 6.6 for one document.
///
/// The whole of it happens under **one** [`crate::persist::PathWriteLock`],
/// taken once and dropped when this function returns.
///
/// # Steps, and who performs each
///
/// 1. **lock** — [`crate::persist::lock_path`] on
///    [`DocumentContext::path`], which canonicalises it first;
/// 2. **read and compare** — the target's bytes are read *inside* the lock,
///    decoded as UTF-8 and hashed, and a hash that is not
///    [`SaveRequest::base_revision`] is [`SaveError::RevisionMismatch`];
/// 3. **patch** — [`crate::patch::apply_edits`] against those bytes, for
///    [`SaveContent::Edits`]. For [`SaveContent::ReplaceText`] the candidate is
///    the submitted text and this step does not run at all;
/// 4. **reparse the whole candidate** — performed by that same call, whose
///    `verify` parses the candidate with [`SyntaxIndex::parse`] before a
///    [`crate::patch::PatchedDocument`] exists at all. There is deliberately no
///    second syntax gate here: two of them are two places to disagree about
///    whether a candidate parsed. For [`SaveContent::ReplaceText`] there is no
///    such prior parse, and step 5's is the only one — see below;
/// 5. **project and validate the candidate** — a fresh [`SyntaxIndex::parse`]
///    and [`TriviaIndex::scan`], [`crate::model::DocumentView::project`], then
///    [`crate::validate::validate`]. The *candidate*, never the original: a
///    report about the document the user is leaving behind is not a report
///    about the one being written. Then [`verdict`] decides;
/// 13. **back the target up, and rotate** —
///     [`crate::persist::BackupSession`], between the verdict and the commit and
///     only when the candidate really differs from the target. Numbered last by
///     the plan and executed here before the commit, because a copy taken after
///     the rename is a copy of the new bytes;
/// 6. to 11. **commit** — [`crate::persist::replace_locked_file`], which is
///    the one entry point that does not take the lock again;
/// 12. **hand back the facts** — [`SavedDocument`]. This module writes no
///     cache.
///
/// # Nothing is written to the target unless both gates pass
///
/// Every path that returns [`Err`] before [`SaveError::Write`] leaves the target
/// byte-identical, because the only code in this crate that opens the *target*
/// for writing is reached after the verdict.
///
/// **That is a claim about the target, not about the disk.** A committed save
/// writes one more file — the backup — and it writes it before the rename, so a
/// commit that then fails at [`SaveError::Write`] can leave a backup of a file
/// that was never replaced. The backup is a copy of bytes that really were on
/// disk, so it is never wrong; it is sometimes unnecessary, and
/// `docs/decisions/2a-3b-notes.md` records that as a hole rather than a defect.
///
/// # The commit is skipped when the candidate changed nothing
///
/// A candidate that is byte-identical to what the file already holds is not
/// written: [`SavedDocument::committed`] is `false`. Every rename installs a new
/// inode and drops eight classes of metadata (2a-1 notes section 4), and paying
/// that for an unchanged document buys nothing.
///
/// **That path re-reads the target before it returns.** The committed path ends
/// with the primitive's own read-back (step 11), and skipping the commit would
/// otherwise skip every check between the step-2 read and the return, leaving
/// [`SavedDocument::revision`] a claim about bytes last seen before a patch, two
/// parses, a projection and a validation. So the file is read again under the
/// lock and compared with [`SaveRequest::base_revision`]; a disagreement is
/// [`SaveError::RevisionMismatch`], which is the same answer the committed path
/// gives for the same situation.
///
/// This **narrows** the window to one read. It does not close it: the lock
/// excludes only this process's cooperating writers, so a non-cooperating writer
/// can still replace the file between that read and this function returning.
/// Nothing at this layer can close it (2a-1 notes D4).
///
/// # A replacement text that does not parse is reported, not refused
///
/// For [`SaveContent::ReplaceText`] the step-5 parse is the **only** parse of
/// the candidate, and it is a fact rather than a gate. A failure produces one
/// [`crate::validate::FindingCode::DocumentDoesNotParse`] finding — a
/// [`FindingClass::SuspiciousButPermitted`] one, carrying the parser's own
/// position when it reported one — and validation is skipped, because there is
/// no projection to validate. The verdict then does what it does for every other
/// suspicion: it refuses the first attempt and proceeds on the second, when the
/// caller hands that exact finding back as an [`Acknowledgement`].
///
/// **The finding carries the candidate's [`ContentRevision`]**, so *that exact
/// finding* means *that exact text*. A caller cannot collect an acknowledgement
/// for one unparseable text and spend it on another that happens to stop the
/// parser in the same place — see [`does_not_parse`].
///
/// It is emphatically **not** [`SaveError::CandidateParseDisagrees`]. That
/// variant means two calls to one parser contradicted each other about one
/// candidate, which can only happen where a *prior* parse succeeded — inside
/// [`apply_edits`]. A replacement text has no prior parse to contradict.
///
/// # A replacement with no backup session is refused before the lock
///
/// [`SaveContent::Edits`] may be saved with [`SaveRequest::backups`] set to
/// `None`; [`SaveContent::ReplaceText`] may not, and asking is
/// [`SaveError::ReplacementRequiresBackups`] raised beside the read-only check,
/// before the target is opened. An edit's commit can destroy only the spans the
/// engine planned, so what it replaced is largely still on disk; a replacement's
/// destroys the file, so the design consult's Q6 requires a recoverable
/// pre-commit image and a caller with no session cannot leave one.
///
/// A session that has **already copied** this file is not that case. It holds
/// the image plan section 6.6 asks for, `take_backup` answers `None` because the
/// first modification per session already happened, and the save commits.
///
/// # Errors
///
/// See [`SaveError`], and [`SaveError::is_refusal`] for the distinction that
/// matters most to a caller.
pub fn save_document(request: SaveRequest<'_>) -> Result<SavedDocument, SaveError> {
    let SaveRequest {
        context,
        base_revision,
        content,
        acknowledgement,
        backups,
    } = request;

    // Before the lock: a package file is one the editor must refuse to write at
    // all (`FileKind::is_read_only`). Locking it first would serialise against
    // writers that are never allowed to exist.
    if context.kind.is_read_only() {
        return Err(SaveError::DocumentIsReadOnly {
            path: context.path.clone(),
        });
    }

    // Also before the lock, and for the replacement mode **only**: committing one
    // destroys every byte of the file, so the design consult's Q6 requires a
    // recoverable pre-commit image and a caller with no `BackupSession` cannot
    // leave one. `SaveContent::Edits` is untouched — the patch engine bounds what
    // a commit can destroy to the planned spans — and a session that has already
    // copied this file is not this: that copy *is* the image, and such a save goes
    // on to commit.
    //
    // It sits below the read-only check on purpose: a package file must not be
    // written whatever the caller supplies, so that answer is the more
    // fundamental one and the one worth reporting.
    if matches!(content, SaveContent::ReplaceText(_)) && backups.is_none() {
        return Err(SaveError::ReplacementRequiresBackups {
            path: context.path.clone(),
        });
    }

    // Step 1. Held until this function returns.
    let lock = lock_path(&context.path).map_err(SaveError::Target)?;
    let target = lock.path().to_path_buf();

    // Step 2, and the reason it is here rather than at the call site: bytes read
    // before the lock can be stale by the time the lock is taken, and a patch
    // built against stale bytes is a patch against a document that no longer
    // exists.
    //
    // It goes through the primitive's own `inspect_target` rather than
    // `fs::read`, because the lock is already held: a plain read of a fifo
    // planted at the resolved path waits for a writer that may never come, and
    // waits holding a lock nothing else can take.
    //
    // The whole `InspectedTarget` is kept rather than only its bytes, because
    // step 13's copy needs the target's mode bits and its extended attributes and
    // must take them from **this** file description — the one the bytes and the
    // revision came from. A second `open` for the backup would reintroduce
    // exactly the TOCTOU 2a-1 removed.
    let inspected = read_target_under_the_lock(&target, base_revision)?;
    let source =
        std::str::from_utf8(&inspected.bytes).map_err(|error| SaveError::TargetNotUtf8 {
            path: target.clone(),
            offset: error.valid_up_to(),
        })?;

    // Steps 3 and 4, and **the only two statements the two content modes do not
    // share**. `apply_edits` plans every edit against the original index,
    // splices, then reparses and verifies the whole candidate; a
    // `PatchedDocument` cannot be built any other way. A replacement text skips
    // both steps by construction: there is nothing to plan against and nothing
    // for a verification to compare with, so the submitted bytes *are* the
    // candidate.
    let produced = match content {
        SaveContent::Edits(edits) => {
            Candidate::Patched(apply_edits(source, edits).map_err(SaveError::Patch)?)
        }
        SaveContent::ReplaceText(text) => Candidate::Replaced(text),
    };

    // Step 5, over the candidate. The edit branch treats a failed parse as a
    // contradiction — `apply_edits` has already parsed these very bytes — and the
    // replacement branch treats it as the finding the user acknowledges.
    let candidate = produced.text();
    let findings = match &produced {
        Candidate::Patched(_) => {
            // Only the edits mode can reach the patched arm, and the edits are
            // what the duplicate-specific finding is derived from.
            let edits = match content {
                SaveContent::Edits(edits) => edits,
                SaveContent::ReplaceText(_) => &[],
            };
            findings_of(context, &target, candidate, edits)?
        }
        Candidate::Replaced(_) => findings_of_replacement(context, candidate),
    };
    let verdict = verdict(&findings, acknowledgement);
    if !verdict.proceeds() {
        return Err(SaveError::Refused(SaveRefusal { verdict, findings }));
    }

    // Steps 6 to 11, under the lock this function has held since step 1.
    let committed = candidate != source;

    // Step 13, and both halves of where it sits are decisions. **After the
    // verdict**, so a refused save never leaves a backup of a file nobody
    // changed; **before the commit**, because a copy taken after the rename is a
    // copy of the new bytes. It is skipped entirely when nothing is about to be
    // rewritten, for the same reason the rename is: there is no pristine version
    // of a file that is not being replaced.
    let backup = if committed {
        take_backup(backups, &target, &inspected)?
    } else {
        None
    };

    let revision = if committed {
        match replace_locked_file(&lock, base_revision, candidate.as_bytes()) {
            Ok(revision) => revision,
            Err(error) => {
                // The copy was taken before this, and this did not commit. The
                // session must not go on believing the file has been backed up:
                // a retry would then rewrite a target another writer may have
                // changed in between, with no copy of the bytes it replaced.
                //
                // **Unless the rename may have happened**, in which case the copy
                // is of bytes that may already be gone and is the only one there
                // is. Then it stays, and so does the record of it.
                if !error.may_have_written() {
                    discard_backup(backups, &target, backup.as_ref());
                }
                return Err(SaveError::Write(error));
            }
        }
    } else {
        // The commit is skipped, so nothing has looked at the file since step 2
        // — and steps 3 to 5 are a patch, two parses, a projection and a
        // validation, which is time. The revision this function is about to
        // report is re-established by reading the target again, so that it
        // describes a read rather than a memory.
        read_target_under_the_lock(&target, base_revision)?;
        base_revision
    };

    // Step 12: facts, not a cache write.
    let (replacements, notes) = produced.outcome(source);
    let text = produced.text().to_owned();
    Ok(SavedDocument {
        revision,
        text,
        replacements,
        notes,
        findings,
        committed,
        backup,
    })
} // End of function save_document()

/// The candidate bytes, and the provenance that decides what may be said about
/// them.
///
/// Private, and it exists so that [`save_document`] branches **once**. A pair of
/// `Option`s would leave the two modes representable together and would need an
/// unreachable arm at every use; this cannot express *neither* or *both*.
enum Candidate<'a> {
    /// The patch engine planned, spliced and verified these bytes.
    Patched(PatchedDocument),
    /// The caller submitted these bytes and nothing has altered them.
    Replaced(&'a str),
}

impl Candidate<'_> {
    /// The candidate text, whichever mode produced it.
    fn text(&self) -> &str {
        match self {
            Candidate::Patched(patched) => patched.text(),
            Candidate::Replaced(text) => text,
        }
    }

    /// What [`SavedDocument`] reports about how the candidate came to be:
    /// its replacements and its presentation notes.
    ///
    /// The patched arm hands back the engine's own two lists. The replaced arm
    /// reports **one** replacement covering the whole original document, and
    /// **no** notes — see [`SavedDocument::replacements`] and
    /// [`SavedDocument::notes`] for why each is the honest answer rather than the
    /// convenient one. `source` is the original text, and is needed only for its
    /// length: the span is the whole of it.
    fn outcome(&self, source: &str) -> (Vec<Replacement>, Vec<PresentationNote>) {
        match self {
            Candidate::Patched(patched) => {
                (patched.replacements().to_vec(), patched.notes().to_vec())
            }
            Candidate::Replaced(text) => (
                vec![Replacement {
                    span: ByteSpan::new(0, source.len()),
                    text: (*text).to_owned(),
                }],
                Vec::new(),
            ),
        }
    } // End of function outcome()
} // End of impl Candidate

/// Step 13's first half: copy the target as it stands, unless there is nothing
/// to copy or nobody to copy it for.
///
/// Split out so that [`save_document`]'s own body says *when* the backup happens
/// and this says *what it is*. It answers `None` for a caller that supplied no
/// [`BackupSession`] and for a file the session has already copied — the second
/// being plan section 6.6's *"before the **first** modification of each file per
/// session"*.
///
/// **No read of the target happens here.** The bytes are
/// [`InspectedTarget::bytes`], whose hash the revision check already verified;
/// the mode and the extended attributes come from the same open file. That is
/// what `docs/decisions/2a-2b-notes.md` section 8 requires of every later reader
/// of a save target, and it is why the transaction holds the descriptor this far.
fn take_backup(
    session: Option<&BackupSession>,
    target: &Path,
    inspected: &InspectedTarget,
) -> Result<Option<BackupRecord>, SaveError> {
    let Some(session) = session else {
        return Ok(None);
    };
    session
        .capture(target, &inspected.bytes, &inspected.mode, &inspected.handle)
        .map_err(SaveError::Backup)
} // End of function take_backup()

/// Step 13's other half: **unrecord** a copy whose save then did not commit.
///
/// The backup is taken before [`replace_locked_file`]'s own pre-commit checks,
/// and those can still refuse — a target changed under the write, a temp pathname
/// repointed. Leaving the file marked as copied would mean the retry commits
/// without a copy of the bytes it replaces, which is the one thing step 13 exists
/// to prevent (`docs/decisions/2a-3b-notes.md` section 9, hole 2).
///
/// This is the **cheap** half of that hole. The full answer is a locked writer
/// split into a preparation phase that makes every refusal and a commit phase
/// that cannot, which is a redesign of 2a-1's primitive rather than a review fix.
fn discard_backup(session: Option<&BackupSession>, target: &Path, record: Option<&BackupRecord>) {
    if let (Some(session), Some(record)) = (session, record) {
        session.discard(target, record);
    }
} // End of function discard_backup()

/// Reads `target` through the primitive's checked open and confirms it still
/// hashes to `expected`.
///
/// **Both of the transaction's reads go through here**, and both are inside the
/// lock: the step-2 read the patch is built against, and the second read that
/// re-establishes the revision when the commit is skipped.
///
/// It answers the whole [`InspectedTarget`] rather than only its bytes, because
/// step 13's backup needs the target's mode bits and the descriptor its extended
/// attributes are read through, and both must come from **this** open — the one
/// whose bytes were hashed. Handing back only the bytes and re-opening later is
/// the TOCTOU `docs/decisions/2a-1-notes.md` section 4 records as fixed.
///
/// The open is [`crate::persist::write`]'s [`inspect_target`], not
/// [`std::fs::read`], for three reasons that only matter because the path lock
/// is already held: it opens the final component with `O_NOFOLLOW`, it opens
/// **non-blocking** so a fifo is a refusal rather than a wait for a writer that
/// may never arrive, and it refuses anything that is not a regular file. A
/// blocking read here would hold a non-reentrant lock forever, and every later
/// save of the same resolved path would queue behind it.
///
/// **What the revision check establishes is a read, not a guarantee.** The lock
/// excludes only this process's cooperating writers, so the answer describes the
/// file at the instant of the read and nothing later. See
/// [`crate::persist::write`]'s residual race.
fn read_target_under_the_lock(
    target: &Path,
    expected: ContentRevision,
) -> Result<InspectedTarget, SaveError> {
    let inspected = inspect_target(target).map_err(SaveError::Target)?;
    let found = ContentRevision::of_bytes(&inspected.bytes);
    if found != expected {
        return Err(SaveError::RevisionMismatch {
            path: target.to_path_buf(),
            expected,
            found,
        });
    }
    Ok(inspected)
} // End of function read_target_under_the_lock()

/// Step 5's first half: project `candidate` and run the semantic gate over it.
///
/// **This is a second parse of the candidate, and the cost is real rather than
/// hidden.** [`crate::patch::PatchedDocument`] exposes its text, its
/// replacements and its notes but not the [`SyntaxIndex`] its own verification
/// built, so the projection has to build one. The alternative — widening a
/// Phase 0 type so a candidate carries an index — was measured against and
/// rejected; `docs/decisions/2a-2b-notes.md` section 5 records the timing.
///
/// A candidate that will not parse **here** after parsing inside `verify` is a
/// contradiction between two calls to the same parser, and it is reported as
/// exactly that: [`SaveError::CandidateParseDisagrees`], never as the syntax
/// gate's own answer. Attributing it to
/// [`crate::patch::VerificationFailure::DoesNotParse`] would say the patch
/// engine's verification refused when in fact it *passed* — a false provenance,
/// and one that hides a regression in step 4 behind a second parse that cleans
/// up after it.
fn findings_of(
    context: &DocumentContext,
    target: &Path,
    candidate: &str,
    edits: &[DocumentEdit],
) -> Result<Vec<Finding>, SaveError> {
    let index =
        SyntaxIndex::parse(candidate).map_err(|error| SaveError::CandidateParseDisagrees {
            path: target.to_path_buf(),
            error,
        })?;
    let trivia = TriviaIndex::scan(candidate, &index);
    let revision = ContentRevision::of_bytes(candidate.as_bytes());
    let view = DocumentView::project(context, candidate, revision, &index, &trivia);
    let mut findings = validate(&view);
    // The two operation-specific findings, appended after the projection pass so
    // that the editor-model findings keep their precedence in `verdict`: an
    // `EditorModelError` anywhere refuses the save whatever else is present.
    for edit in edits {
        if let DocumentEdit::DuplicateItem(duplicate) = edit {
            findings.extend(duplicate_keeps_trigger_definition(
                &view, duplicate, revision,
            ));
        }
    } // End of the loop over the batch's edits, of which at most one duplicates
      // The insertion's own suspicion, for **every** insertion in the batch and
      // in batch order. The address each new item took is
      // `crate::patch::insertion_landings`, which reads the whole batch: a
      // removal above the anchor shifts the arrival left and a second insertion
      // above it shifts it right, so the placement and the candidate's own length
      // are not enough to name the item that landed.
    for (position, edit) in edits.iter().enumerate() {
        let DocumentEdit::InsertItem(insertion) = edit else {
            continue;
        };
        let items = matches_directly_in(&view, insertion.sequence());
        let landed = insertion_landings(edits, insertion.sequence(), items.len())
            .into_iter()
            .find_map(|(at, landed)| (at == position).then_some(landed));
        let Some(landed) = landed else {
            continue;
        };
        findings.extend(new_match_repeats_literal_trigger(&items, landed, revision));
    } // End of the loop over the batch's insertions
    Ok(findings)
} // End of function findings_of()

/// The suspicion a duplicate owes its first save attempt — the 2c-3c design
/// consult's Q3.
///
/// Produced when the **clone**, looked up in the candidate's own projection at
/// the path [`DuplicateItem::resulting_path`] derives, is a match with exactly
/// one modelled trigger form (`Single`, `Multiple` or `Regex`). When it has none
/// or several, [`FindingCode::MatchHasNoTriggerField`] or
/// [`FindingCode::MatchHasSeveralTriggerForms`] is already among the projection
/// pass's findings — for the source and the clone both — and that
/// `EditorModelError` wins in [`verdict`]; producing this suspicion beside it
/// would add nothing and must not weaken that precedence. A duplicated item that
/// does not project as a match at all — a `vars` item, say — owes no trigger
/// warning either.
///
/// # The candidate's own hash is an operand, and the acknowledgement depends on it
///
/// `revision` is the **candidate's** [`ContentRevision`], and it goes into the
/// finding for [`does_not_parse`]'s exact reason. The clone's path, span and
/// node also travel — they are what a screen points at — but none of the three
/// identifies a text: rewrite the source trigger to another value of the same
/// byte length and the new candidate's clone has the same path, the same span
/// and the same freshly minted node number, so an acknowledgement retained from
/// the old candidate would cover the new one and a clone nobody was shown would
/// commit (the 2c-3c-1 review's finding 1). With the operand, a different
/// candidate is a different finding and [`Acknowledgement::covers_all`]'s
/// exact-multiset match does the rest.
fn duplicate_keeps_trigger_definition(
    view: &DocumentView,
    edit: &DuplicateItem,
    revision: ContentRevision,
) -> Option<Finding> {
    let clone_path = edit.resulting_path()?;
    let clone = view
        .matches
        .iter()
        .find(|candidate| candidate.path.as_ref() == Some(&clone_path))?;
    if !matches!(
        clone.trigger.kind,
        TriggerKind::Single | TriggerKind::Multiple | TriggerKind::Regex
    ) {
        return None;
    }
    Some(Finding {
        code: FindingCode::DuplicateKeepsTriggerDefinition { revision },
        span: Some(clone.span),
        node: Some(clone.source_node),
        path: Some(clone_path),
    })
} // End of function duplicate_keeps_trigger_definition()

/// The suspicion a creation owes when the item it inserts repeats literal
/// trigger text its destination sequence already holds — the 2c-4c design
/// consult's Q1 and Q5.
///
/// # A pure inspection of the candidate, and nothing else
///
/// It reads the candidate's own projection and the insertion request. It
/// consults no disk, no earlier revision and no caller's opinion, so the same
/// candidate always produces the same finding — which is what makes
/// [`Acknowledgement::covers_all`]'s exact-multiset match a round trip rather
/// than a race.
///
/// # The item that landed is named by the caller, and the caller asks the engine
///
/// `items` is every match the candidate projects as a **direct** item of the
/// destination sequence, paired with the index its own path ends in
/// ([`matches_directly_in`]), and `landed` is the index the new item took —
/// [`crate::patch::insertion_landings`], the patch engine's own arithmetic over
/// the **whole batch**, called rather than re-spelled. Deriving it here from the
/// placement and the candidate's length would be right only while the insertion
/// is the batch's one cardinality-changing edit, which no type enforces: with a
/// removal above the anchor the address shifts left, and the finding would be
/// attached to a pre-existing item whose trigger the new one never repeated.
/// When no landing can be derived the caller produces nothing, which is also the
/// answer for a destination this projection does not model as a match list.
///
/// **The count handed to the engine is the projection's matches for that
/// sequence, and that is the sequence's own item count rather than an
/// approximation of it**, on the precedent `create_one_match` records: a
/// `matches` entry the schema does not recognise still produces one
/// `MatchView`, recorded by span and not descended into, so positions never
/// shift.
///
/// # What counts as "literal", on both sides
///
/// [`literal_trigger_texts`] — `trigger:`, or the scalar entries of `triggers:`,
/// and only where this crate decoded the scalar. A `regex:` contributes nothing,
/// an undecodable scalar contributes nothing, and a match with no trigger form
/// or several contributes nothing (those two are already
/// [`FindingCode::MatchHasNoTriggerField`] and
/// [`FindingCode::MatchHasSeveralTriggerForms`], which are `EditorModelError`s
/// and win in [`verdict`]). So an unmodelled or non-literal trigger produces
/// **no semantic claim at all**, in either direction.
///
/// The comparison is exact string equality of decoded text. It is deliberately
/// not a similarity, an overlap or a prefix test: this crate can say that two
/// texts are the same text, and it cannot say what espanso does with two
/// definitions that merely interact.
///
/// # Every other item of the destination counts, newly inserted ones included
///
/// The comparison is against the **candidate's** list, so a batch inserting two
/// items that repeat each other reports both. Nothing in `DocumentEdit` forbids
/// such a batch and no caller in `src-tauri/` builds one — `create_one_match`
/// issues exactly one insertion — but reporting it is the answer that claims
/// least: the repetition really is in the list the person would be left with.
fn new_match_repeats_literal_trigger(
    items: &[(usize, &MatchView)],
    landed: usize,
    revision: ContentRevision,
) -> Option<Finding> {
    let new_match = items
        .iter()
        .find_map(|(index, item)| (*index == landed).then_some(*item))?;
    let repeated = literal_trigger_texts(new_match);
    if repeated.is_empty() {
        return None;
    }
    let repeats = items.iter().any(|(index, other)| {
        *index != landed
            && literal_trigger_texts(other)
                .into_iter()
                .any(|text| repeated.contains(&text))
    });
    if !repeats {
        return None;
    }
    Some(Finding {
        code: FindingCode::NewMatchRepeatsLiteralTrigger { revision },
        span: Some(new_match.span),
        node: Some(new_match.source_node),
        path: new_match.path.clone(),
    })
} // End of function new_match_repeats_literal_trigger()

/// Every match `view` projects as a **direct** item of `sequence`, paired with
/// the index its own path ends in.
///
/// Direct, and both halves of that are checked: the path's document index must
/// be the sequence's, and everything before its final index segment must be the
/// sequence's segments. A [`DocumentPath`] names no file, so two documents can
/// carry the same path and mean two sequences; the document index is what keeps
/// them apart here.
fn matches_directly_in<'a>(
    view: &'a DocumentView,
    sequence: &DocumentPath,
) -> Vec<(usize, &'a MatchView)> {
    view.matches
        .iter()
        .filter_map(|item| {
            let path = item.path.as_ref()?;
            if path.document_index() != sequence.document_index() {
                return None;
            }
            let (last, parent) = path.segments().split_last()?;
            let PathSegment::Index(index) = last else {
                return None;
            };
            if parent != sequence.segments() {
                return None;
            }
            Some((*index, item))
        })
        .collect()
} // End of function matches_directly_in()

/// The literal trigger texts a match exposes, in source order.
///
/// Empty for every shape this crate does not model as literal text: a `regex:`,
/// a match with no trigger form, a match with several, and any entry whose
/// scalar this crate could not decode — an undecodable [`crate::model::ScalarView`]
/// holds the raw source slice rather than the logical text, so comparing one
/// would be comparing bytes against text and calling the result equality.
fn literal_trigger_texts(item: &MatchView) -> Vec<&str> {
    let scalars: Vec<&crate::model::ScalarView> = match item.trigger.kind {
        TriggerKind::Single => item.trigger.trigger.iter().collect(),
        TriggerKind::Multiple => item
            .trigger
            .triggers
            .iter()
            .filter_map(ValueView::as_scalar)
            .collect(),
        TriggerKind::Regex | TriggerKind::Several | TriggerKind::Absent => Vec::new(),
    };
    scalars
        .into_iter()
        .filter(|scalar| scalar.decoded)
        .map(|scalar| scalar.text.as_str())
        .collect()
} // End of function literal_trigger_texts()

/// Step 5 for a [`SaveContent::ReplaceText`] candidate, where a failed parse is
/// **the answer** rather than a contradiction.
///
/// The two differences from [`findings_of`] are the whole of what the owner's
/// ruling changed. There is no earlier parse of these bytes to disagree with, so
/// a rejection is not [`SaveError::CandidateParseDisagrees`]; and a rejection is
/// not disqualifying, so it is not an error at all. It becomes one
/// [`FindingCode::DocumentDoesNotParse`] finding, which
/// [`FindingCode::class`] makes [`FindingClass::SuspiciousButPermitted`] and
/// [`verdict`] therefore refuses until it is acknowledged by content.
///
/// **Validation is skipped when the parse fails**, because there is no
/// projection to validate — not because the rules were waived. The finding says
/// so: it is a claim about the text's shape, and this pass makes no claim about
/// its espanso semantics at all.
///
/// No `target` argument, and its absence is deliberate: nothing on this path can
/// produce a [`SaveError`], so there is no path to name.
fn findings_of_replacement(context: &DocumentContext, candidate: &str) -> Vec<Finding> {
    match SyntaxIndex::parse(candidate) {
        Ok(index) => project_and_validate(context, candidate, &index),
        Err(error) => vec![does_not_parse(candidate, &error)],
    }
} // End of function findings_of_replacement()

/// The semantic gate over a candidate that has already been indexed.
///
/// Shared by both content modes so that a raw save and an edited one are judged
/// by the same pass rather than by two that agree today.
fn project_and_validate(
    context: &DocumentContext,
    candidate: &str,
    index: &SyntaxIndex,
) -> Vec<Finding> {
    let trivia = TriviaIndex::scan(candidate, index);
    let revision = ContentRevision::of_bytes(candidate.as_bytes());
    let view = DocumentView::project(context, candidate, revision, index, &trivia);
    validate(&view)
} // End of function project_and_validate()

/// Turns the parser's rejection of a submitted text into the acknowledgeable
/// finding the user is shown.
///
/// [`SyntaxError::Parse`] is a rejection of the *text* and carries the
/// substrate's own line, column and byte offset, which is what an editor needs
/// to put a caret where the trouble is. The other two arms are defects in this
/// crate rather than properties of the text — the type's own documentation says
/// so — and they carry no position; they are reported through the same finding
/// anyway, because the owner's ruling is that the user's bytes are never
/// withheld from them over this crate's opinion of their shape.
///
/// [`Finding::span`] stays `None`: a rejection is a position, and an empty
/// [`ByteSpan`] would be a range of bytes pretending to be one.
///
/// # The candidate's own hash is an operand, and the acknowledgement depends on it
///
/// `candidate` is here for one reason: its [`ContentRevision`] goes into the
/// finding. The position and the message describe where the parser **stopped**,
/// so they are a property of the text's invalid prefix rather than of the text —
/// `matches: broken: here\nfirst` and `matches: broken: here\nsecond` are
/// different documents that fail at the same line, the same column, the same byte
/// and with the same words. [`Acknowledgement`] matches findings as an exact
/// multiset and has no other handle on which candidate the user agreed to, so
/// without this operand consent collected for one broken text would silently
/// commit another. With it, a different text is a different finding and the
/// existing machinery refuses — no new concept, and no change to the protocol.
///
/// It is the **submitted** text that is hashed, not the target's: the finding is
/// about the candidate, and the candidate is what would be written.
fn does_not_parse(candidate: &str, error: &SyntaxError) -> Finding {
    let (line, column, byte_index, detail) = match error {
        SyntaxError::Parse(failure) => (
            Some(failure.line),
            Some(failure.column),
            failure.byte_index,
            failure.detail.clone(),
        ),
        // The position is already in the operands for the arm that has one, so
        // the whole `Display` is used only where there is nothing else to say.
        SyntaxError::Offset(_) | SyntaxError::Invariant(_) => (None, None, None, error.to_string()),
    };
    Finding {
        code: FindingCode::DocumentDoesNotParse {
            revision: ContentRevision::of_bytes(candidate.as_bytes()),
            line,
            column,
            byte_index,
            detail,
        },
        span: None,
        node: None,
        path: None,
    }
} // End of function does_not_parse()

#[cfg(test)]
mod tests {
    use super::{
        matches_directly_in, new_match_repeats_literal_trigger, read_target_under_the_lock,
        verdict, Acknowledgement, DocumentContext, DocumentPath, DocumentView, MatchView,
        SaveError, SaveVerdict, SyntaxIndex, TriviaIndex,
    };
    use crate::persist::write::lock_path;
    use crate::validate::{Finding, FindingClass, FindingCode};
    use crate::{ContentRevision, DocumentId};

    /// A finding with no span, node or path, of the code given.
    fn finding(code: FindingCode) -> Finding {
        Finding {
            code,
            span: None,
            node: None,
            path: None,
        }
    }

    /// An `EditorModelError` finding.
    fn an_error() -> Finding {
        finding(FindingCode::MatchHasNoContentField)
    }

    /// A `SuspiciousButPermitted` finding.
    fn a_suspicion(name: &str) -> Finding {
        finding(FindingCode::ReferenceHasNoDeclaration {
            name: name.to_owned(),
        })
    }

    /// The two fixtures really are the classes the policy is written against.
    ///
    /// Without this the tests below could all be about one class and read as
    /// though they covered both.
    #[test]
    fn the_policy_fixtures_are_one_finding_of_each_class() {
        assert_eq!(an_error().class(), FindingClass::EditorModelError);
        assert_eq!(
            a_suspicion("x").class(),
            FindingClass::SuspiciousButPermitted
        );
    }

    /// No findings, no acknowledgement, no obstacle.
    #[test]
    fn a_candidate_with_no_finding_proceeds() {
        assert_eq!(verdict(&[], &Acknowledgement::none()), SaveVerdict::Proceed);
    }

    /// An editor-model error refuses, and **keeps refusing** however much the
    /// caller acknowledges. This is the half of the policy that has no override.
    #[test]
    fn an_editor_model_error_refuses_and_cannot_be_acknowledged() {
        let findings = vec![an_error()];
        assert_eq!(
            verdict(&findings, &Acknowledgement::none()),
            SaveVerdict::RefusedForEditorModelErrors
        );
        assert_eq!(
            verdict(&findings, &Acknowledgement::of(&findings)),
            SaveVerdict::RefusedForEditorModelErrors,
            "acknowledging an error must not be a way past it"
        );
    }

    /// `Acknowledgement::of` drops what it cannot acknowledge at construction,
    /// so a caller cannot come to believe it has waved an error past.
    #[test]
    fn an_acknowledgement_holds_only_suspicions() {
        let mixed = vec![an_error(), a_suspicion("who")];
        let acknowledgement = Acknowledgement::of(&mixed);
        assert_eq!(acknowledgement.len(), 1);
        assert!(!acknowledgement.covers(&an_error()));
        assert!(acknowledgement.covers(&a_suspicion("who")));
    }

    /// An **undecodable** trigger scalar contributes no literal trigger text, on
    /// either side of the comparison.
    ///
    /// # Why the flag is set by hand here
    ///
    /// An undecodable [`crate::model::ScalarView`] holds the raw source slice
    /// rather than the logical text, so comparing one would be comparing bytes
    /// against text and calling the result equality — that is the rule
    /// `literal_trigger_texts` enforces with one `filter`. Reaching it through a
    /// real document would need a double-quoted scalar the **substrate** accepts
    /// and `crate::emit::decode` rejects, and no such text has been found:
    /// measured against `SyntaxIndex::parse`, an unknown escape, a malformed
    /// numeric escape, a lone surrogate and an out-of-range code point are all
    /// rejected by the parser first, so the projection never gets the chance.
    /// The exclusion is therefore pinned on a projection whose flag this test
    /// clears, and the premise — that the same pair **does** produce the finding
    /// while both scalars are decoded — is asserted first, so removing the
    /// `filter` fails this rather than leaving it green.
    #[test]
    fn an_undecodable_trigger_scalar_contributes_no_literal_text() {
        let source = "matches:\n  - trigger: ':one'\n    replace: 'first'\n  \
                      - trigger: ':one'\n    replace: 'second'\n";
        let context = DocumentContext::detached(DocumentId(1), "base.yml");
        let index = SyntaxIndex::parse(source).expect("the fixture parses");
        let trivia = TriviaIndex::scan(source, &index);
        let revision = ContentRevision::of_bytes(source.as_bytes());
        let view = DocumentView::project(&context, source, revision, &index, &trivia);
        let sequence = DocumentPath::parse("matches").expect("the test's own path parses");

        let mut items: Vec<(usize, MatchView)> = matches_directly_in(&view, &sequence)
            .into_iter()
            .map(|(at, item)| (at, item.clone()))
            .collect();
        assert_eq!(items.len(), 2, "the fixture projects two matches");
        for (at, item) in &items {
            assert!(
                item.trigger
                    .trigger
                    .as_ref()
                    .expect("each item has a single trigger")
                    .decoded,
                "the premise: item {at}'s trigger really is decoded logical text"
            );
        } // End of the loop that asserts both premises

        // The positive control: while both are decoded, the repetition is found.
        assert!(
            new_match_repeats_literal_trigger(&borrowed(&items), 1, revision).is_some(),
            "the premise: this pair really is an exact repetition"
        );

        // The **existing** item's scalar holds raw bytes rather than text.
        set_decoded(&mut items[0].1, false);
        assert!(
            new_match_repeats_literal_trigger(&borrowed(&items), 1, revision).is_none(),
            "an undecodable existing scalar is not literal trigger text"
        );

        // And the **new** item's own, which is the other side of the comparison.
        set_decoded(&mut items[0].1, true);
        set_decoded(&mut items[1].1, false);
        assert!(
            new_match_repeats_literal_trigger(&borrowed(&items), 1, revision).is_none(),
            "an undecodable new scalar exposes no literal trigger text either"
        );
    } // End of function an_undecodable_trigger_scalar_contributes_no_literal_text()

    /// Sets the `decoded` flag of a match's single `trigger` scalar.
    fn set_decoded(item: &mut MatchView, decoded: bool) {
        item.trigger
            .trigger
            .as_mut()
            .expect("the fixture's items each have a single trigger")
            .decoded = decoded;
    } // End of function set_decoded()

    /// The borrowed pair list `new_match_repeats_literal_trigger` takes.
    fn borrowed(items: &[(usize, MatchView)]) -> Vec<(usize, &MatchView)> {
        items.iter().map(|(at, item)| (*at, item)).collect()
    }

    /// A suspicion refuses until it is acknowledged, and then it proceeds.
    #[test]
    fn a_suspicion_refuses_until_it_is_acknowledged() {
        let findings = vec![a_suspicion("who")];
        assert_eq!(
            verdict(&findings, &Acknowledgement::none()),
            SaveVerdict::RefusedForUnacknowledgedSuspicions
        );
        assert_eq!(
            verdict(&findings, &Acknowledgement::of(&findings)),
            SaveVerdict::Proceed
        );
    }

    /// An acknowledgement of **a different** suspicion covers nothing.
    ///
    /// This is what makes the acknowledgement a claim about one candidate: a
    /// caller cannot acknowledge whatever it happens to have and proceed past
    /// something else.
    #[test]
    fn acknowledging_one_suspicion_does_not_acknowledge_another() {
        let shown = vec![a_suspicion("who")];
        let candidate = vec![a_suspicion("when")];
        assert_eq!(
            verdict(&candidate, &Acknowledgement::of(&shown)),
            SaveVerdict::RefusedForUnacknowledgedSuspicions
        );
    }

    /// Acknowledging some of them is not acknowledging all of them.
    #[test]
    fn one_unacknowledged_suspicion_among_many_still_refuses() {
        let shown = vec![a_suspicion("who")];
        let candidate = vec![a_suspicion("who"), a_suspicion("when")];
        assert_eq!(
            verdict(&candidate, &Acknowledgement::of(&shown)),
            SaveVerdict::RefusedForUnacknowledgedSuspicions
        );
        assert_eq!(
            verdict(&candidate, &Acknowledgement::of(&candidate)),
            SaveVerdict::Proceed
        );
    }

    /// An error outranks an unacknowledged suspicion, because it is the fact
    /// the caller most needs to hear first.
    #[test]
    fn an_error_beside_a_suspicion_reports_the_error() {
        let findings = vec![a_suspicion("who"), an_error()];
        assert_eq!(
            verdict(&findings, &Acknowledgement::none()),
            SaveVerdict::RefusedForEditorModelErrors
        );
    }

    /// An acknowledgement is content-addressed, so a finding whose span moved
    /// is a different finding.
    #[test]
    fn a_finding_whose_operand_changed_is_not_the_finding_that_was_acknowledged() {
        let shown = Acknowledgement::of(&[a_suspicion("who")]);
        let mut moved = a_suspicion("who");
        moved.span = Some(crate::syntax::ByteSpan::new(10, 20));
        assert!(!shown.covers(&moved));
    }

    /// **Two equal suspicions need two acknowledgements.**
    ///
    /// `validate` reports an unresolved reference once per occurrence and each
    /// finding records the whole scalar's span, node and path, so a scalar
    /// holding `{{who}}` twice produces two findings that are equal in every
    /// field. Under set membership one acknowledged copy would cover both, and
    /// the second occurrence would never be shown to anyone.
    #[test]
    fn two_equal_suspicions_are_not_covered_by_one_acknowledgement() {
        let candidate = vec![a_suspicion("who"), a_suspicion("who")];
        assert_eq!(
            candidate[0], candidate[1],
            "the fixture is only about multiplicity if the two really are equal"
        );

        let one = Acknowledgement::of(&candidate[..1]);
        assert!(
            one.covers(&candidate[1]),
            "membership cannot tell the two apart, which is why the gate does not use it"
        );
        assert!(!one.covers_all(&candidate));
        assert_eq!(
            verdict(&candidate, &one),
            SaveVerdict::RefusedForUnacknowledgedSuspicions
        );

        let both = Acknowledgement::of(&candidate);
        assert_eq!(both.len(), 2);
        assert!(both.covers_all(&candidate));
        assert_eq!(verdict(&candidate, &both), SaveVerdict::Proceed);
    } // End of function two_equal_suspicions_are_not_covered_by_one_acknowledgement()

    /// **The multiset distinction survives the wire, in both directions.**
    ///
    /// The test above proves the *policy* counts occurrences; this one proves it
    /// still counts them when the acknowledgement was **built by `serde` from
    /// JSON** rather than by [`Acknowledgement::of`] in this process. That is the
    /// only shape a Phase 2b-2 command ever sees, and it is a separate claim: a
    /// `Deserialize` that collapsed the list — into a set, or through a
    /// `HashSet`, or by deduplicating "identical" entries — would leave every
    /// assertion above green and would let one acknowledgement wave two
    /// occurrences past. The one-copy payload is asserted to **refuse** and the
    /// two-copy payload to **proceed**, so the test fails from either side.
    #[test]
    fn a_deserialized_acknowledgement_still_counts_occurrences() {
        let candidate = vec![a_suspicion("who"), a_suspicion("who")];
        assert_eq!(
            candidate[0], candidate[1],
            "the fixture is only about multiplicity if the two really are equal"
        );

        let one = serde_json::to_string(&Acknowledgement::of(&candidate[..1]))
            .expect("an acknowledgement serializes");
        let two = serde_json::to_string(&Acknowledgement::of(&candidate))
            .expect("an acknowledgement serializes");
        assert_ne!(
            one, two,
            "the two payloads must differ, or the wire has already lost the count"
        );

        let one: Acknowledgement = serde_json::from_str(&one).expect("and reads back");
        let two: Acknowledgement = serde_json::from_str(&two).expect("and reads back");
        assert_eq!(one.len(), 1);
        assert_eq!(two.len(), 2);
        assert_eq!(
            verdict(&candidate, &one),
            SaveVerdict::RefusedForUnacknowledgedSuspicions,
            "one acknowledged copy must not cover two equal suspicions"
        );
        assert_eq!(verdict(&candidate, &two), SaveVerdict::Proceed);
    } // End of function a_deserialized_acknowledgement_still_counts_occurrences()

    /// An acknowledgement read from the wire holds only what the type admits.
    ///
    /// [`Acknowledgement::of`] drops everything that is not a suspicion, and the
    /// hand-written `Deserialize` re-applies that filter rather than trusting the
    /// payload. Without it a caller could put an [`FindingClass::EditorModelError`]
    /// into the array and [`Acknowledgement::len`] would report a finding the
    /// value cannot acknowledge — the verdict would still refuse, and the type
    /// would still be lying about itself.
    #[test]
    fn a_deserialized_acknowledgement_drops_what_it_cannot_acknowledge() {
        let payload = serde_json::to_string(&serde_json::json!({
            "accepted": [
                serde_json::to_value(an_error()).expect("a finding serializes"),
                serde_json::to_value(a_suspicion("who")).expect("a finding serializes"),
            ]
        }))
        .expect("the payload serializes");

        let acknowledgement: Acknowledgement =
            serde_json::from_str(&payload).expect("the payload reads back");
        assert_eq!(acknowledgement.len(), 1);
        assert!(!acknowledgement.covers(&an_error()));
        assert!(acknowledgement.covers(&a_suspicion("who")));
        assert_eq!(
            verdict(&[an_error()], &acknowledgement),
            SaveVerdict::RefusedForEditorModelErrors
        );
    } // End of function a_deserialized_acknowledgement_drops_what_it_cannot_acknowledge()

    /// Every operand of a finding survives the round trip.
    ///
    /// The acknowledgement is matched by [`Finding`]'s own equality — the code,
    /// its operands, the span, the node and the path — so a payload that lost any
    /// of them would silently stop matching and every save would be refused
    /// twice. The fixture carries all four, and the assertion is equality of the
    /// whole value rather than of its code.
    #[test]
    fn a_finding_survives_the_round_trip_with_all_four_of_its_parts() {
        let index = SyntaxIndex::parse("matches:\n  - trigger: ':one'\n").expect("a parse");
        let original = Finding {
            code: FindingCode::VariableMissingRequiredParam {
                kind: crate::model::VariableKind::Shell,
                param: "cmd".to_owned(),
            },
            span: Some(crate::syntax::ByteSpan::new(4, 19)),
            node: Some(index.nodes()[0].id),
            path: Some(crate::patch::DocumentPath::root(0).with_key("matches")),
        };
        let json = serde_json::to_string(&original).expect("a finding serializes");
        let read: Finding = serde_json::from_str(&json).expect("and reads back");
        assert_eq!(read, original);
        assert_eq!(read.class(), FindingClass::EditorModelError);
    } // End of function a_finding_survives_the_round_trip_with_all_four_of_its_parts()

    /// An acknowledgement carrying an inverted span is refused at the boundary.
    ///
    /// The review of Phase 2b-2a found the hole this closes: every other test on
    /// this path builds its payload with `serde` from a finding this crate made,
    /// so all of them use a well-ordered [`crate::syntax::ByteSpan`] and none of
    /// them could see that the derive filled the two fields directly. The payload
    /// below is the one the review wrote out, and an accepted `20..10` would be a
    /// span retained as a suspicion whose `len()` underflows.
    ///
    /// It asserts the well-ordered twin is accepted first, so the test cannot pass
    /// by refusing every payload of this shape.
    #[test]
    fn an_acknowledgement_cannot_carry_an_inverted_span() {
        let payload = |start: usize, end: usize| {
            serde_json::json!({
                "accepted": [{
                    "code": { "ReferenceHasNoDeclaration": { "name": "x" } },
                    "span": { "start": start, "end": end },
                    "node": null,
                    "path": null
                }]
            })
        };

        let well_ordered: Acknowledgement = serde_json::from_value(payload(10, 20))
            .expect("a payload whose span is well ordered must still read back");
        assert_eq!(well_ordered.len(), 1);

        let inverted = serde_json::from_value::<Acknowledgement>(payload(20, 10));
        assert!(
            inverted.is_err(),
            "an inverted span must not reach an acknowledgement: {inverted:?}"
        );
    } // End of function an_acknowledgement_cannot_carry_an_inverted_span()

    /// An acknowledgement of more copies than the candidate produces still
    /// proceeds: the multiset match is *every candidate suspicion is covered*,
    /// not *every acknowledged finding is used*.
    #[test]
    fn a_surplus_acknowledgement_does_not_refuse() {
        let shown = vec![a_suspicion("who"), a_suspicion("who")];
        let candidate = vec![a_suspicion("who")];
        assert_eq!(
            verdict(&candidate, &Acknowledgement::of(&shown)),
            SaveVerdict::Proceed
        );
    }

    /// The projection's parse disagreeing with step 4's is **its own failure**,
    /// and is not the syntax gate's answer.
    ///
    /// Named for what it is rather than for what it resembles: step 4 passed —
    /// a `PatchedDocument` cannot exist otherwise — so reporting this as
    /// `Patch(Verification(DoesNotParse))` would attribute a refusal to a check
    /// that succeeded, and would let a regression in step 4 hide behind step
    /// 5's second parse.
    #[test]
    fn a_parse_disagreement_is_its_own_error_and_not_the_syntax_gates() {
        let error = SyntaxIndex::parse("matches:\n  - replace: \"unclosed\n")
            .expect_err("the fixture must not parse");
        let disagreement = SaveError::CandidateParseDisagrees {
            path: std::path::PathBuf::from("/nowhere/base.yml"),
            error,
        };

        assert!(
            matches!(disagreement, SaveError::CandidateParseDisagrees { .. }),
            "the variant is distinguishable by matching, which is what a test can pin"
        );
        assert!(
            disagreement.syntax_gate_failure().is_none(),
            "the syntax gate passed; saying otherwise is a false provenance"
        );
        assert!(
            !disagreement.is_refusal(),
            "no check declined: two parses of one candidate contradicted each other"
        );
        assert!(!disagreement.may_have_written());
        assert!(disagreement.findings().is_empty());
    } // End of function a_parse_disagreement_is_its_own_error_and_not_the_syntax_gates()

    /// The read the transaction uses answers the bytes that are there.
    #[test]
    fn the_locked_read_returns_the_targets_bytes() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let target = directory.path().join("base.yml");
        std::fs::write(&target, b"matches: []\n").expect("write");
        let lock = lock_path(&target).expect("the lock is taken");

        let inspected =
            read_target_under_the_lock(lock.path(), ContentRevision::of_bytes(b"matches: []\n"))
                .expect("an unchanged target reads");
        assert_eq!(inspected.bytes, b"matches: []\n");
    } // End of function the_locked_read_returns_the_targets_bytes()

    /// The same read refuses when the file no longer holds what the caller
    /// believes it holds.
    ///
    /// This is the check the skipped-commit path gained: the file is replaced
    /// **between** the two calls, from this thread, which is the only way to
    /// schedule the case deterministically. The lock is held throughout and does
    /// not prevent it, because the replacement here is what a non-cooperating
    /// writer is — vim, espanso, a sync agent.
    #[test]
    fn the_locked_read_refuses_a_target_replaced_since_the_first_read() {
        let directory = tempfile::tempdir().expect("a temp directory");
        let target = directory.path().join("base.yml");
        std::fs::write(&target, b"matches: []\n").expect("write");
        let base = ContentRevision::of_bytes(b"matches: []\n");
        let lock = lock_path(&target).expect("the lock is taken");
        read_target_under_the_lock(lock.path(), base).expect("the first read agrees");

        std::fs::write(&target, b"matches:\n  - trigger: ':vim'\n").expect("the other writer");

        let error = read_target_under_the_lock(lock.path(), base).expect_err("the second refuses");
        match error {
            SaveError::RevisionMismatch {
                expected, found, ..
            } => {
                assert_eq!(expected, base);
                assert_eq!(
                    found,
                    ContentRevision::of_bytes(b"matches:\n  - trigger: ':vim'\n")
                );
            }
            other => panic!("expected a revision mismatch, got {other}"),
        }
    } // End of function the_locked_read_refuses_a_target_replaced_since_the_first_read()

    /// Every verdict has a distinct stable name, and only one of them proceeds.
    #[test]
    fn every_verdict_has_its_own_name_and_only_one_proceeds() {
        let all = [
            SaveVerdict::Proceed,
            SaveVerdict::RefusedForEditorModelErrors,
            SaveVerdict::RefusedForUnacknowledgedSuspicions,
        ];
        let mut names: Vec<&str> = all.iter().map(|v| v.name()).collect();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), all.len());
        assert_eq!(all.iter().filter(|v| v.proceeds()).count(), 1);
    } // End of function every_verdict_has_its_own_name_and_only_one_proceeds()
}
