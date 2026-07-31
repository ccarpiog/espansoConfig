//! Atomic save transaction and backups.
//!
//! **Phase 2a-1 scope:** the atomic file-replacement primitive — steps 1, 2 and
//! 6 to 11 of the 13-step save transaction of `IMPLEMENTATION_PLAN.md`
//! section 6.6. [`write`] holds it, and [`replace_file_atomically`] is the whole
//! of the entry point: **atomic replacement of an existing regular file, with
//! optimistic conflict detection.**
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
//! **Still to come:** steps 3 to 5 (apply the patches in memory, reparse the
//! whole candidate, structural validation) in 2a-2, and steps 12 and 13
//! (snapshot update, backup rotation) in 2a-2 and 2a-3. This module writes
//! finished bytes and inspects none of them.
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
//! **Mode bits, not "permissions".** Step 7 copies the Unix mode and nothing
//! else. The rename installs a new inode, so ownership, ACLs, extended
//! attributes, resource forks, BSD flags and hard links are dropped — and
//! dropping a *denying* ACL broadens access. `docs/decisions/2a-1-notes.md`
//! section 10 records it as a decision a later phase must revisit.
//!
//! **What this module still cannot do**, deliberately: create a file that does
//! not exist, or delete one. A missing target is
//! [`WriteError::TargetMissing`], never an invitation to create. Creating the
//! first file of a new match set is a later sub-phase's problem and needs its
//! own answers about the mode to give it, about the parent directory and about
//! what espanso does with a file that appears empty.
//!
//! Backups go under `.espansoconfig-backups/`, which is deliberately outside
//! any auto-loaded glob, and are a safety net rather than a substitute for
//! revision checks. Nothing here writes one yet (step 13, sub-phase 2a-3).

pub mod write;

pub use write::{
    lock_path, replace_file_atomically, replace_locked_file, temp_file_name, PathWriteLock,
    TargetDifference, WriteError, WriteStep, TEMP_NAME_INFIX, TEMP_NAME_PREFIX, TEMP_NAME_SUFFIX,
};
