//! Atomic save transaction and backups.
//!
//! **Phase 2a-1 scope:** the atomic file-replacement primitive — steps 1, 2 and
//! 6 to 11 of the 13-step save transaction of `IMPLEMENTATION_PLAN.md`
//! section 6.6. [`write`] holds it, and [`replace_file_atomically`] is the whole
//! of the entry point: **atomic replacement of an existing regular file, with
//! optimistic conflict detection.**
//!
//! **Phase 2a-2b scope:** the transaction around it — steps 3, 4 and 12, plus
//! the blocking policy. [`save`] holds it, and [`save_document`] is the entry
//! point: lock once, read and hash *under the lock*, patch, let
//! [`crate::patch::apply_edits`] reparse the whole candidate, project and
//! validate that candidate, decide, and only then commit through
//! [`replace_locked_file`].
//!
//! **Phase 2a-3b scope:** step 13. [`backup`] holds it, and [`BackupSession`] is
//! the entry point — an explicit, caller-owned value threaded through
//! [`SaveRequest::backups`]. Before the **first modification of each file per
//! session** the target's current bytes, mode bits and extended attributes are
//! copied into
//! `<config root>/.espansoconfig-backups/<timestampZ>/<the file's own relative
//! path>`, between the verdict and the commit; the last
//! [`backup::BATCHES_RETAINED`] batches are kept and the rest are removed. **A
//! batch is a session**, so rotation runs once per session, after that session's
//! first copy is on disk, and with that session's own batch excluded from removal
//! by identity.
//!
//! It is *not* a compare-and-swap on file contents. No ordinary POSIX or macOS
//! pathname operation provides one, so the revision is checked twice — once
//! before the candidate is built and once immediately before the commit — and a
//! window one `rename()` wide remains, in which a **non-cooperating** writer
//! (vim, espanso, a sync agent) can be overwritten. [`write`]'s module
//! documentation states the residual race in full; it is a property of the
//! platform, not of this code, and backups (step 13) are what makes it
//! recoverable.
//!
//! **Phase 2a-3a scope:** plan section 7 row 11's unpaid half. [`write`]'s step 7
//! became two — the target's **access control list and extended attributes** are
//! copied onto the temp file with macOS's `fcopyfile(3)` before its **mode bits**
//! are applied — so the new inode the rename installs carries the protection the
//! old one had. Both happen **after** the candidate's bytes are written and
//! fsynced, so the temp file is only widened from `0o600` once it is complete,
//! and both are applied to the open descriptor rather than to the temp file's
//! name. Nothing else about the primitive changed, and [`save`] is untouched.
//!
//! **A failure before the rename promises one thing, and it is about the
//! target**: it keeps its bytes *and* its protection. It does **not** promise
//! that no temp file survives — deletion is attempted, a failure to delete is
//! swallowed, and a denying ACL copied from the target can forbid the unlink.
//! [`WriteError::may_have_written`] is a statement about the target for exactly
//! that reason.
//!
//! **Still to come:** nothing of plan section 6.6. What remains for Phase 2 is
//! the IPC surface (2b) and the user interface (2c) — including *Reveal backups
//! in Finder*, whose only obligation on this module was a path, and that is
//! [`BackupSession::root`].
//!
//! Two details here are load-bearing and easy to get wrong, and both are now
//! executed by [`write`] rather than only described:
//!
//! - The temp file must live in the *same directory* as the target, because
//!   `rename()` is only atomic within a filesystem. It is created in
//!   `target.parent()` — the parent of the **resolved** target, so a symlink
//!   that crosses a filesystem cannot move the temp file off the target's own.
//! - The temp file must be named so espanso's default include glob
//!   `../match/**/[!_]*.yml` cannot match it mid-write, e.g.
//!   `_match-file.yml.espansoconfig-<random>.tmp`. The leading `_` excludes it
//!   from the glob and the suffix means it is not a `.yml` file at all.
//!   [`temp_file_name`] builds exactly that, and both ends of the name are
//!   asserted by `tests/persist_write.rs` against the name the code generates.
//!
//! **Symlinks resolve.** The target is canonicalised before it is locked,
//! hashed or written, so the real file receives the bytes and a symlink pointing
//! at it survives as a symlink. The caller's own spelling is kept and
//! re-resolved before the commit, so a link retargeted mid-call is a refusal.
//! `write`'s module documentation carries the decision and its cost.
//!
//! **Plan section 7 row 11, all four of it.** The row names permissions,
//! ownership, line endings and BOM, and the four have three different answers:
//!
//! - **line endings and BOM are preserved by construction**, not by
//!   capture-and-restore. Every edit is a byte-span replacement and everything
//!   outside the span comes out byte-identical, so there is nothing to capture.
//!   That is the span layer's property, discharged before this module runs;
//! - **permissions are restored — mode bits *and* ACL.** The mode comes from an
//!   `fstat` on the same descriptor whose bytes were hashed; the ACL and every
//!   extended attribute (Finder tags, Finder comments, `com.apple.*`, and the
//!   resource fork where the filesystem exposes it as an extended attribute)
//!   come from that same descriptor through `fcopyfile(3)`. A copy that fails
//!   **refuses the write** rather than committing a file with less protection
//!   than the one it replaces;
//! - **ownership is not restored**, and cannot be by an unprivileged process.
//!   The uid matches by construction when the user owns the file, which is the
//!   ordinary case; the gid matches when the target's group matches its
//!   directory's, because a new file inherits the directory's group.
//!
//! A new inode still drops **owner and group, creation time, BSD flags and
//! hard-link relationships**. [`write`]'s module documentation states each, and
//! `docs/decisions/2a-3a-notes.md` is the decision record.
//!
//! **What this module still cannot do**, deliberately: create a file that does
//! not exist, or delete one. A missing target is
//! [`WriteError::TargetMissing`], never an invitation to create. Creating the
//! first file of a new match set is a later sub-phase's problem and needs its
//! own answers about the mode to give it, about the parent directory and about
//! what espanso does with a file that appears empty.
//!
//! **Backups go under `.espansoconfig-backups/`, a direct child of the
//! configuration root**, which is what keeps them outside any auto-loaded glob:
//! espanso's include glob is rooted at `match/`, and no glob rooted at `match/`
//! can reach a *sibling* of `match/`. The leading dot is belt-and-braces. They
//! are **a safety net, not a substitute** for revision checks and atomic writes,
//! and retention is ten batches rather than forever — no string anywhere may say
//! *your file is recoverable*.
//!
//! **A backup deliberately does not carry the target's access control list**,
//! though the atomic write does. Rotation deletes directories, and a copied
//! `deny delete` entry makes a backup undeletable; [`backup`] argues it and
//! `docs/decisions/2a-3b-notes.md` section 5 records the trade.

pub mod backup;
pub mod save;
pub mod write;

pub use backup::{
    BackupError, BackupRecord, BackupSession, BackupStep, Rotation, RotationOutcome,
    BACKUP_DIRECTORY_NAME, BATCHES_RETAINED, BATCH_MARKER_FORMAT, BATCH_MARKER_NAME,
    OUTSIDE_CONFIG_ROOT,
};
pub use save::{
    save_document, verdict, Acknowledgement, SaveContent, SaveError, SaveRefusal, SaveRequest,
    SaveVerdict, SavedDocument,
};
pub use write::{
    lock_path, replace_file_atomically, replace_locked_file, temp_file_name, PathWriteLock,
    TargetDifference, WriteError, WriteStep, TEMP_NAME_INFIX, TEMP_NAME_PREFIX, TEMP_NAME_SUFFIX,
};
