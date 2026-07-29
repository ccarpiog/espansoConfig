//! Atomic save transaction and backups.
//!
//! **Phase 0a scope:** none. This module is a placeholder.
//!
//! **Later responsibility:** the 13-step save transaction of
//! `IMPLEMENTATION_PLAN.md` section 6.6 — per-path write lock, revision
//! re-check, in-memory patch, full reparse, structural validation, temp file
//! **in the same directory**, permission copy, fsync, atomic rename, directory
//! sync, re-read-and-hash verification, snapshot update, backup rotation.
//!
//! Two details here are load-bearing and easy to get wrong:
//!
//! - The temp file must live in the *same directory* as the target, because
//!   `rename()` is only atomic within a filesystem.
//! - The temp file must be named so espanso's default include glob
//!   `../match/**/[!_]*.yml` cannot match it mid-write, e.g.
//!   `_match-file.yml.espansoconfig-<random>.tmp`. The leading `_` excludes it
//!   from the glob and the suffix means it is not a `.yml` file at all.
//!
//! Backups go under `.espansoconfig-backups/`, which is deliberately outside
//! any auto-loaded glob, and are a safety net rather than a substitute for
//! revision checks.
