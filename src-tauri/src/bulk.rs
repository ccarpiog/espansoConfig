//! The bulk option edit's request and result — Phase 3-10.
//!
//! What `apply_bulk_options` (`crate::commands`) takes and answers. The
//! coordinator itself lives beside [`crate::commands`]'s other writers, because
//! it ends in the same `run_one_save` they do; this module holds only the wire
//! shapes, so the rules that govern them are written once, here.
//!
//! # Per-file atomicity, not cross-file atomicity (ruling 19)
//!
//! A request names several files. Every file is **preflighted** first — its
//! base revision checked against this session's projection, its batch planned,
//! its candidate built, validated and judged against that file's own consent —
//! and a single blocker anywhere means **no file is written**. Only then is
//! each file saved, in request order, one save transaction per file, stopping
//! at the first save that did not end in *saved* or *already unchanged*. What
//! was committed before the stop stays committed and is reported as such; what
//! comes after it is reported *not attempted*. No outcome here is ever a
//! statement that *nothing was written* unless [`BulkResult::nothing_written`]
//! says so, and that flag is derived from the outcomes, not asserted beside
//! them.
//!
//! # Consent is per file, base revision, intent and candidate (ruling 22)
//!
//! There is **no `force` flag** anywhere in this request, and every struct here
//! is `deny_unknown_fields`, so a caller that sends one is refused while the
//! arguments are read. A file's consent is a [`BulkConsent`]: the document and
//! the base revision it was collected for, the intent fingerprint
//! ([`bulk_intent`]) of the selection and the changes it covered, the candidate
//! revision it was shown, and the exact findings acknowledged for it, which the
//! save gate matches as a multiset. A finding holds only document-local spans
//! and paths, so the candidate alone would not bind consent to a file; all four
//! identities are compared. Consent that disagrees with this file's request in
//! any of them — another file, an earlier base revision, a changed selection or
//! intent, another candidate — is [`BulkFileOutcome::ConsentStale`] rather
//! than spent.
//!
//! # Rust returns codes, never prose
//!
//! [`BulkFileOutcome`] crosses as `{ "outcome": …, … operands }`, flat, like
//! [`crate::save::SaveResult`], and each discriminant owns a
//! `code.bulkFileOutcome.*` sentence in both languages.

use serde::ser::SerializeStruct;
use serde::{Deserialize, Serialize, Serializer};

use espansoconfig_core::draft::{BulkOptionChange, BulkValue};
use espansoconfig_core::model::MatchId;
use espansoconfig_core::patch::PresentationNote;
use espansoconfig_core::persist::{Acknowledgement, SaveVerdict};
use espansoconfig_core::validate::Finding;
use espansoconfig_core::{ContentRevision, DocumentId};

use crate::error::CommandError;

/// One bulk option edit: the option intents, the files they apply to, and the
/// files the caller took out of the apply before sending.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BulkOptionsRequest {
    /// The option intents, applied to every selected snippet. Each option at
    /// most once; an option the person did not touch is absent.
    pub changes: Vec<BulkOptionChange>,
    /// The files to apply them to, **in the order they are attempted**.
    pub files: Vec<BulkFileRequest>,
    /// Files the caller excluded before sending — for example because every
    /// snippet it selected there is one the visual editor cannot write. They are
    /// never read or written, and each is reported
    /// [`BulkFileOutcome::ExcludedBeforeApply`] so the result accounts for them.
    pub excluded: Vec<DocumentId>,
}

/// One file of a bulk option edit.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BulkFileRequest {
    /// The file.
    pub document: DocumentId,
    /// The revision the selection was made against. Checked against this
    /// session's projection in the preflight and again under the write lock.
    pub base_revision: ContentRevision,
    /// The selected snippets of this file, each at most once.
    pub matches: Vec<MatchId>,
    /// The consent collected for this file's candidate, when the person has
    /// been shown its findings; `None` on a first attempt.
    pub consent: Option<BulkConsent>,
}

/// The consent one file carries: which file, base revision, intent and
/// candidate it was collected for, and which of that candidate's findings were
/// acknowledged.
///
/// **Bound to all four** (ruling 22): the document, the base revision, the
/// [`bulk_intent`] fingerprint of the file's selection and changes, and the
/// candidate revision. The findings are matched by the save gate as an exact
/// multiset, exactly as for a single save. Nothing in the type ties these
/// fields to the request they arrive in — the coordinator's preflight
/// comparison of every one of them is what refuses a mismatch.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BulkConsent {
    /// The file the consent was collected for.
    pub document: DocumentId,
    /// The base revision the consent was collected against.
    pub base_revision: ContentRevision,
    /// The intent fingerprint the consent covered — [`bulk_intent`] of the
    /// file's selection and the request's changes, as a refusal reported it.
    pub intent: ContentRevision,
    /// The candidate revision the findings were shown for.
    pub candidate: ContentRevision,
    /// The findings the person acknowledged for it.
    pub acknowledgement: Acknowledgement,
}

/// The intent fingerprint of one file of a bulk edit: a digest of the
/// document, its base revision, the selected snippets in order and the
/// requested changes in order.
///
/// What a [`BulkConsent`] names so that consent collected for one selection or
/// one set of intents cannot be spent on another (ruling 22). The encoding is
/// line-based with every variable-length text length-prefixed, so two
/// different requests cannot encode to the same bytes; equal digests are then a
/// hash equality, never an identity of requests.
pub fn bulk_intent(
    document: DocumentId,
    base_revision: ContentRevision,
    matches: &[MatchId],
    changes: &[BulkOptionChange],
) -> ContentRevision {
    let mut encoded = format!(
        "bulk-intent/1\ndocument {}\nbase {}\n",
        document.0,
        base_revision.to_hex()
    );
    for id in matches {
        encoded.push_str(&format!(
            "match {} {} {}\n",
            id.document.0,
            id.revision.to_hex(),
            id.node.get()
        ));
    } // End of the loop over the selected snippets
    for change in changes {
        let value = match &change.value {
            BulkValue::Set(text) => format!("set {}:{}", text.len(), text),
            BulkValue::Remove => "remove".to_owned(),
        };
        encoded.push_str(&format!("change {} {value}\n", change.option.key()));
    } // End of the loop over the requested changes
    ContentRevision::of_bytes(encoded.as_bytes())
} // End of function bulk_intent()

/// What one bulk option edit did, file by file.
#[derive(Debug, Serialize)]
pub struct BulkResult {
    /// Whether every file passed the preflight. `false` means **no file was
    /// written** and no save transaction ran.
    pub preflight_passed: bool,
    /// Whether the execution shows that no file of the request was written:
    /// no outcome is [`BulkFileOutcome::Saved`] or
    /// [`BulkFileOutcome::WriteOutcomeUnknown`]. Derived from
    /// [`BulkResult::files`] by [`BulkResult::new`], which is how the
    /// coordinator builds every result. The fields are public, so the type does
    /// not stop a struct literal from pairing this flag with outcomes it does
    /// not summarise; the coordinator's single call to `new` is what keeps the
    /// two in agreement.
    pub nothing_written: bool,
    /// One report per file — the applied files in request order, then the
    /// excluded ones in request order.
    pub files: Vec<BulkFileReport>,
}

impl BulkResult {
    /// Builds a result, deriving [`BulkResult::nothing_written`] from the
    /// outcomes.
    pub fn new(preflight_passed: bool, files: Vec<BulkFileReport>) -> BulkResult {
        let nothing_written = files
            .iter()
            .all(|report| !report.outcome.may_have_written());
        BulkResult {
            preflight_passed,
            nothing_written,
            files,
        }
    }
}

/// One file's line of a [`BulkResult`].
#[derive(Debug, Serialize)]
pub struct BulkFileReport {
    /// The file.
    pub document: DocumentId,
    /// What happened to it, flattened beside `document`.
    #[serde(flatten)]
    pub outcome: BulkFileOutcome,
}

/// What happened to one file of a bulk option edit (ruling 19's outcomes).
///
/// Ruling 19 names six outcomes — saved, already unchanged, refused or
/// conflicted, write outcome unknown, not attempted, excluded before apply.
/// The third is split here by what the caller can do next: a conflict is
/// reloaded, a refusal is shown for consent, a stale consent is asked for
/// again, a preflight blocker is fixed before anything runs, and an execution
/// failure is a problem the environment caused. Serializes as
/// `{ "outcome": …, … operands }`.
#[derive(Debug)]
pub enum BulkFileOutcome {
    /// The save committed: the file was rewritten.
    Saved {
        /// The revision read back after the rename.
        revision: ContentRevision,
        /// Whether this save wrote a pre-save copy of the file. `false` is a
        /// success: this session had already copied the file. It is not a
        /// promise that the file is recoverable.
        backup_taken: bool,
        /// Presentation changes the patch had to make.
        notes: Vec<PresentationNote>,
    },
    /// Every selected snippet already held every requested value, so the save
    /// transaction ran, re-read the file under its lock, and wrote nothing and
    /// copied nothing.
    AlreadyUnchanged {
        /// The revision the file held at that re-read.
        revision: ContentRevision,
    },
    /// The file no longer held the base revision under the write lock; nothing
    /// was written to it.
    Conflicted {
        /// The revision the request was based on.
        expected: ContentRevision,
        /// The revision the locked read found.
        found: ContentRevision,
        /// The revision of the fresh read taken after the refusal.
        disk_revision: ContentRevision,
    },
    /// The save gate refused this file's candidate, in the preflight or in the
    /// transaction; nothing was written to it.
    Refused {
        /// Which arm of the policy refused.
        verdict: SaveVerdict,
        /// Every finding the candidate produced, in report order.
        findings: Vec<Finding>,
        /// The candidate those findings belong to — what a [`BulkConsent`] for
        /// them must name.
        candidate: ContentRevision,
        /// The intent fingerprint a [`BulkConsent`] for them must name.
        intent: ContentRevision,
    },
    /// The consent sent for this file was collected for another document,
    /// base revision, intent or candidate; nothing was written anywhere.
    ConsentStale {
        /// The intent fingerprint a fresh consent for this request must name.
        intent: ContentRevision,
        /// The candidate the preflight derived, which a fresh consent must name.
        candidate: ContentRevision,
    },
    /// The preflight could not plan or judge this file — a stale base
    /// revision, an unknown document, a snippet the planner refuses, a batch
    /// the patch engine refuses. Nothing was written anywhere.
    Blocked {
        /// Why, as every other command reports it.
        error: CommandError,
    },
    /// The save failed in a way that **did not** write this file.
    Failed {
        /// The failure, as every other command reports it.
        error: CommandError,
    },
    /// The save failed after its rename may have happened: what the file now
    /// holds is unknown. Later files are not attempted.
    WriteOutcomeUnknown {
        /// The failure, as every other command reports it.
        error: CommandError,
    },
    /// An earlier file stopped the run, or another file's preflight blocker
    /// stopped it before any save; this file was not touched.
    NotAttempted {},
    /// The caller excluded this file before sending; it was not touched.
    ExcludedBeforeApply {},
}

impl BulkFileOutcome {
    /// The stable machine code this outcome crosses the boundary as — the only
    /// spelling of each in this crate.
    pub fn outcome(&self) -> &'static str {
        match self {
            BulkFileOutcome::Saved { .. } => "saved",
            BulkFileOutcome::AlreadyUnchanged { .. } => "alreadyUnchanged",
            BulkFileOutcome::Conflicted { .. } => "conflicted",
            BulkFileOutcome::Refused { .. } => "refused",
            BulkFileOutcome::ConsentStale { .. } => "consentStale",
            BulkFileOutcome::Blocked { .. } => "blocked",
            BulkFileOutcome::Failed { .. } => "failed",
            BulkFileOutcome::WriteOutcomeUnknown { .. } => "writeOutcomeUnknown",
            BulkFileOutcome::NotAttempted {} => "notAttempted",
            BulkFileOutcome::ExcludedBeforeApply {} => "excludedBeforeApply",
        }
    } // End of function outcome()

    /// Whether this outcome lets the coordinator go on to the next file:
    /// *saved* and *already unchanged*, and nothing else.
    pub fn lets_the_run_continue(&self) -> bool {
        matches!(
            self,
            BulkFileOutcome::Saved { .. } | BulkFileOutcome::AlreadyUnchanged { .. }
        )
    }

    /// Whether this outcome may mean the file was written: a commit, or a
    /// failure whose rename may have happened.
    pub fn may_have_written(&self) -> bool {
        matches!(
            self,
            BulkFileOutcome::Saved { .. } | BulkFileOutcome::WriteOutcomeUnknown { .. }
        )
    }

    /// How many operand fields this outcome writes, beside its code.
    fn operand_count(&self) -> usize {
        match self {
            BulkFileOutcome::NotAttempted {} | BulkFileOutcome::ExcludedBeforeApply {} => 0,
            BulkFileOutcome::AlreadyUnchanged { .. }
            | BulkFileOutcome::Blocked { .. }
            | BulkFileOutcome::Failed { .. }
            | BulkFileOutcome::WriteOutcomeUnknown { .. } => 1,
            BulkFileOutcome::ConsentStale { .. } => 2,
            BulkFileOutcome::Saved { .. } | BulkFileOutcome::Conflicted { .. } => 3,
            BulkFileOutcome::Refused { .. } => 4,
        }
    } // End of function operand_count()
} // End of impl BulkFileOutcome

impl Serialize for BulkFileOutcome {
    /// Serializes as `{ "outcome": …, … operands }` — codes and data, no prose.
    ///
    /// Hand-written for [`crate::save::SaveResult`]'s reasons: one spelling of
    /// each discriminant, and a new variant is a compile error here.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut out = serializer.serialize_struct("BulkFileOutcome", 1 + self.operand_count())?;
        out.serialize_field("outcome", self.outcome())?;
        match self {
            BulkFileOutcome::Saved {
                revision,
                backup_taken,
                notes,
            } => {
                out.serialize_field("revision", revision)?;
                out.serialize_field("backup_taken", backup_taken)?;
                out.serialize_field("notes", notes)?;
            }
            BulkFileOutcome::AlreadyUnchanged { revision } => {
                out.serialize_field("revision", revision)?;
            }
            BulkFileOutcome::Conflicted {
                expected,
                found,
                disk_revision,
            } => {
                out.serialize_field("expected", expected)?;
                out.serialize_field("found", found)?;
                out.serialize_field("disk_revision", disk_revision)?;
            }
            BulkFileOutcome::Refused {
                verdict,
                findings,
                candidate,
                intent,
            } => {
                out.serialize_field("verdict", verdict)?;
                out.serialize_field("findings", findings)?;
                out.serialize_field("candidate", candidate)?;
                out.serialize_field("intent", intent)?;
            }
            BulkFileOutcome::ConsentStale { intent, candidate } => {
                out.serialize_field("intent", intent)?;
                out.serialize_field("candidate", candidate)?;
            }
            BulkFileOutcome::Blocked { error }
            | BulkFileOutcome::Failed { error }
            | BulkFileOutcome::WriteOutcomeUnknown { error } => {
                out.serialize_field("error", error)?;
            }
            BulkFileOutcome::NotAttempted {} | BulkFileOutcome::ExcludedBeforeApply {} => {}
        } // End of the match over the outcomes' operands
        out.end()
    } // End of function serialize() for BulkFileOutcome
}

/// One instance of every outcome, in declaration order — compiled only for
/// tests, for `crate::wire_contract` and `crate::dictionary_contract`, exactly
/// as `crate::save::every_save_result` is.
#[cfg(test)]
pub(crate) fn every_bulk_file_outcome() -> Vec<BulkFileOutcome> {
    let revision = ContentRevision::of_bytes(b"a");
    vec![
        BulkFileOutcome::Saved {
            revision,
            backup_taken: true,
            notes: Vec::new(),
        },
        BulkFileOutcome::AlreadyUnchanged { revision },
        BulkFileOutcome::Conflicted {
            expected: revision,
            found: ContentRevision::of_bytes(b"b"),
            disk_revision: ContentRevision::of_bytes(b"b"),
        },
        BulkFileOutcome::Refused {
            verdict: SaveVerdict::RefusedForUnacknowledgedSuspicions,
            findings: Vec::new(),
            candidate: revision,
            intent: ContentRevision::of_bytes(b"i"),
        },
        BulkFileOutcome::ConsentStale {
            intent: ContentRevision::of_bytes(b"i"),
            candidate: ContentRevision::of_bytes(b"c"),
        },
        BulkFileOutcome::Blocked {
            error: CommandError::UnknownDocument { document: 7 },
        },
        BulkFileOutcome::Failed {
            error: CommandError::NoWorkspaceOpen,
        },
        BulkFileOutcome::WriteOutcomeUnknown {
            error: CommandError::NoWorkspaceOpen,
        },
        BulkFileOutcome::NotAttempted {},
        BulkFileOutcome::ExcludedBeforeApply {},
    ]
} // End of function every_bulk_file_outcome()
