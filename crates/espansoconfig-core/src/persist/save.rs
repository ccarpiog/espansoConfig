//! The save transaction — the thirteen steps of plan section 6.6, less backups.
//!
//! **Phase 2a-2b scope: steps 3, 4 and 12**, wrapped around the primitive 2a-1
//! built (steps 1, 2 and 6 to 11) and the report 2a-2a built (step 5). Nothing
//! here opens a file for writing, parses a scalar or knows an espanso rule: it
//! is the **order** those three things happen in, the **lock** they happen
//! under, and the **policy** that decides whether the rename happens at all.
//!
//! ```text
//!  1. lock_path                       persist::write   (2a-1)
//!  2. read the target, hash it,       here + persist::write
//!     compare with base_revision
//!  3. apply the edits in memory       patch::apply_edits (0c)
//!  4. reparse the whole candidate     patch::apply_edits's own verify (0c)
//!  5. project it and validate it      model + validate    (1a, 2a-2a)
//!     -> the blocking policy          here
//!  6-11. temp file, mode bits, fsync, persist::write   (2a-1)
//!     re-check, rename, dir sync,
//!     read back and hash
//! 12. hand the caller the facts       here
//! 13. rotate backups                  NOT BUILT — sub-phase 2a-3
//! ```
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
//! # Not on the wire
//!
//! Nothing here derives `Serialize`, deliberately and for the same reason
//! [`crate::persist::WriteError`] and [`crate::validate::Finding`] do not: a
//! wire-visible enum owes `code.` namespaces in **both** `src/lib/i18n/en.json`
//! and `es.json`, and `src-tauri/src/dictionary_contract.rs` fails the build
//! without them. Putting a save on the wire is Phase 2b's change, and it lands
//! with the strings or it does not land.

use std::fmt;
use std::path::{Path, PathBuf};

use crate::model::{DocumentContext, DocumentView};
use crate::patch::{
    apply_edits, DocumentEdit, EditError, PresentationNote, Replacement, VerificationFailure,
};
use crate::persist::write::{inspect_target, lock_path, replace_locked_file, WriteError};
use crate::syntax::{SyntaxError, SyntaxIndex, TriviaIndex};
use crate::validate::{validate, Finding, FindingClass};
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
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Acknowledgement {
    /// The suspicions the caller accepted, in the order it supplied them.
    accepted: Vec<Finding>,
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
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
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
    /// The changes to apply, in the batch protocol
    /// [`crate::patch::apply_edits`] defines. An empty batch is legal and
    /// produces a candidate identical to the source.
    pub edits: &'a [DocumentEdit],
    /// The suspicions the caller has already shown someone.
    ///
    /// Pass [`Acknowledgement::none`] on a first attempt.
    pub acknowledgement: &'a Acknowledgement,
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
    pub replacements: Vec<Replacement>,
    /// Presentation changes the patch had to make, for the caller to surface
    /// (plan section 6.2: never silently normalise).
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
}

/// Why the semantic gate refused — step 5's answer, with its evidence.
#[derive(Debug, Clone, PartialEq, Eq)]
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
/// No `Serialize`, deliberately — see the module documentation.
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
            | SaveError::Target(_)
            | SaveError::TargetNotUtf8 { .. }
            | SaveError::RevisionMismatch { .. }
            | SaveError::Patch(_)
            | SaveError::CandidateParseDisagrees { .. }
            | SaveError::Refused(_) => false,
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
    pub fn is_refusal(&self) -> bool {
        match self {
            SaveError::DocumentIsReadOnly { .. }
            | SaveError::TargetNotUtf8 { .. }
            | SaveError::RevisionMismatch { .. }
            | SaveError::Patch(_)
            | SaveError::Refused(_) => true,
            SaveError::CandidateParseDisagrees { .. } => false,
            SaveError::Target(error) | SaveError::Write(error) => match error {
                WriteError::TargetMissing { .. }
                | WriteError::TargetNotRegularFile { .. }
                | WriteError::RevisionMismatch { .. }
                | WriteError::TargetChangedDuringWrite { .. } => true,
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
            SaveError::Write(error) => write!(formatter, "{error}"),
        }
    } // End of function fmt() for SaveError
}

impl std::error::Error for SaveError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            SaveError::Target(error) | SaveError::Write(error) => Some(error),
            SaveError::Patch(error) => Some(error),
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
/// 3. **patch** — [`crate::patch::apply_edits`] against those bytes;
/// 4. **reparse the whole candidate** — performed by that same call, whose
///    `verify` parses the candidate with [`SyntaxIndex::parse`] before a
///    [`crate::patch::PatchedDocument`] exists at all. There is deliberately no
///    second syntax gate here: two of them are two places to disagree about
///    whether a candidate parsed;
/// 5. **project and validate the candidate** — a fresh [`SyntaxIndex::parse`]
///    and [`TriviaIndex::scan`], [`crate::model::DocumentView::project`], then
///    [`crate::validate::validate`]. The *candidate*, never the original: a
///    report about the document the user is leaving behind is not a report
///    about the one being written. Then [`verdict`] decides;
/// 6. to 11. **commit** — [`crate::persist::replace_locked_file`], which is
///    the one entry point that does not take the lock again;
/// 12. **hand back the facts** — [`SavedDocument`]. This module writes no
///     cache.
///
/// Step 13, rotating backups, is **not built**: it is sub-phase 2a-3's.
///
/// # Nothing is written unless both gates pass
///
/// Every path that returns [`Err`] before [`SaveError::Write`] leaves the target
/// byte-identical, because the only code in this crate that opens a file for
/// writing is reached after the verdict.
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
/// # Errors
///
/// See [`SaveError`], and [`SaveError::is_refusal`] for the distinction that
/// matters most to a caller.
pub fn save_document(request: SaveRequest<'_>) -> Result<SavedDocument, SaveError> {
    let SaveRequest {
        context,
        base_revision,
        edits,
        acknowledgement,
    } = request;

    // Before the lock: a package file is one the editor must refuse to write at
    // all (`FileKind::is_read_only`). Locking it first would serialise against
    // writers that are never allowed to exist.
    if context.kind.is_read_only() {
        return Err(SaveError::DocumentIsReadOnly {
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
    let bytes = read_target_under_the_lock(&target, base_revision)?;
    let source = String::from_utf8(bytes).map_err(|error| SaveError::TargetNotUtf8 {
        path: target.clone(),
        offset: error.utf8_error().valid_up_to(),
    })?;

    // Steps 3 and 4. `apply_edits` plans every edit against the original index,
    // splices, then reparses and verifies the whole candidate; a
    // `PatchedDocument` cannot be built any other way.
    let patched = apply_edits(&source, edits).map_err(SaveError::Patch)?;

    // Step 5, over the candidate.
    let candidate = patched.text();
    let findings = findings_of(context, &target, candidate)?;
    let verdict = verdict(&findings, acknowledgement);
    if !verdict.proceeds() {
        return Err(SaveError::Refused(SaveRefusal { verdict, findings }));
    }

    // Steps 6 to 11, under the lock this function has held since step 1.
    let committed = candidate != source;
    let revision = if committed {
        replace_locked_file(&lock, base_revision, candidate.as_bytes()).map_err(SaveError::Write)?
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
    let text = patched.text().to_owned();
    Ok(SavedDocument {
        revision,
        text,
        replacements: patched.replacements().to_vec(),
        notes: patched.notes().to_vec(),
        findings,
        committed,
    })
} // End of function save_document()

/// Reads `target` through the primitive's checked open and confirms it still
/// hashes to `expected`.
///
/// **Both of the transaction's reads go through here**, and both are inside the
/// lock: the step-2 read the patch is built against, and the second read that
/// re-establishes the revision when the commit is skipped.
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
) -> Result<Vec<u8>, SaveError> {
    let inspected = inspect_target(target).map_err(SaveError::Target)?;
    let found = ContentRevision::of_bytes(&inspected.bytes);
    if found != expected {
        return Err(SaveError::RevisionMismatch {
            path: target.to_path_buf(),
            expected,
            found,
        });
    }
    Ok(inspected.bytes)
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
) -> Result<Vec<Finding>, SaveError> {
    let index =
        SyntaxIndex::parse(candidate).map_err(|error| SaveError::CandidateParseDisagrees {
            path: target.to_path_buf(),
            error,
        })?;
    let trivia = TriviaIndex::scan(candidate, &index);
    let revision = ContentRevision::of_bytes(candidate.as_bytes());
    let view = DocumentView::project(context, candidate, revision, &index, &trivia);
    Ok(validate(&view))
} // End of function findings_of()

#[cfg(test)]
mod tests {
    use super::{
        read_target_under_the_lock, verdict, Acknowledgement, SaveError, SaveVerdict, SyntaxIndex,
    };
    use crate::persist::write::lock_path;
    use crate::validate::{Finding, FindingClass, FindingCode};
    use crate::ContentRevision;

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

        let bytes =
            read_target_under_the_lock(lock.path(), ContentRevision::of_bytes(b"matches: []\n"))
                .expect("an unchanged target reads");
        assert_eq!(bytes, b"matches: []\n");
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
