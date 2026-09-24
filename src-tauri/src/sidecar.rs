//! The application sidecar store — Phase 3-12.
//!
//! Per-workspace application metadata: a display name, a sort position and the
//! seven textual new-snippet defaults for each file of the workspace. It is
//! **application metadata, not a user file** (ruling 25): nothing here goes
//! through `espansoconfig_core::persist::save_document`, and nothing here can
//! write anywhere but the application's own storage. `save_document` stays the
//! only writer of user espanso configuration contents; [`store`] is the
//! separate application-metadata writer, it writes only the sidecar store, and
//! it accepts no destination path. Format and I/O live in this crate, and the
//! core stays Tauri-free (ruling 26).
//!
//! # Where it lives
//!
//! `<app data dir>/workspaces/<sha256>.json`, the storage root installed by
//! `main.rs`'s setup from Tauri's `app_data_dir()` (a temporary directory in
//! tests), and the file named by [`format::WorkspaceKey`] after the canonical
//! workspace root. [`format`] documents the version-1 format and its lossless
//! path encoding; [`store`] documents the symlink refusals, the cross-process
//! lock, the atomic replacement and the quarantine.
//!
//! # No watcher: reload on open and before each mutation, last write wins
//!
//! [`SidecarSession::load`] reads the file every time it is asked, and
//! [`SidecarSession::update`] reads it again immediately before applying a
//! change and writing. Within one process the two are serialized by one mutex.
//! **Across processes they are serialized by an exclusive advisory lock** on
//! `workspaces/sidecar.lock` ([`store::LockedDirectory`]), held by one load or
//! update from its reload, through the schema check, the quarantine, the
//! orphan policy and every write, to its end. So an update always applies to
//! what the file holds at that moment, and two instances changing different
//! fields both keep their change. **Last write wins** for one field: when two
//! instances set it, the update that takes the lock second is what the file
//! holds, and neither instance is told; an instance's displayed state is as
//! old as its last load or update. The lock is advisory and blocks without a
//! timeout (see [`store`]). Immediately before each rename, under the lock, the
//! target is re-read and a replacement over a newer-schema file is refused, so
//! a newer build's file is kept even if it arrived by a writer that ignored the
//! lock — up to the gap between that re-read and the rename, which the lock
//! alone covers. `tests::a_two_instance_race_is_serialized_and_last_write_wins`
//! and `tests::a_future_schema_written_between_read_and_replace_is_retained`
//! pin both.
//!
//! # Corruption: truthful outcomes
//!
//! Every load ends in exactly one [`SidecarStatus`]:
//!
//! - `Fresh` / `Loaded` — there is no file yet, or it was read and is valid.
//! - `Quarantined { aside }` — the file was not a valid version-1 sidecar for
//!   this workspace, and it **has been** renamed aside to `aside` in the same
//!   directory: the status is built from the rename's success and nothing else.
//!   Preferences start empty and saving works.
//! - `QuarantineFailed` — the file was corrupt and the rename failed. The
//!   original bytes are untouched, preferences are empty in memory, and every
//!   write is refused (`NotWritable`) for as long as that stays so, which keeps
//!   the bytes intact. Each later load or update tries the quarantine again.
//! - `FutureSchema { version }` — a newer build wrote it. It is not
//!   interpreted, not renamed and never rewritten; writes are refused.
//! - `Unreadable` — the file exists but could not be read; nothing is touched
//!   and writes are refused.
//! - `RootUnresolved` / `StorageUnavailable` — the workspace root could not be
//!   canonicalized, or no storage root was installed, or the sidecar directory
//!   could not be created, verified or locked (a `workspaces` directory or
//!   lock file that is a symlink is refused this way); nothing is read or
//!   written. A sidecar file that is a symlink is `Unreadable`.
//!
//! Deleting the sidecar loses the display names, the ordering and the defaults
//! and changes no espanso file (split-notes §5 row 6): the next load is
//! `Fresh`.
//!
//! # Orphans: kept thirty days
//!
//! An entry whose relative path is not among the workspace's listed files is an
//! **orphan**. The first load or update that sees it so records the time in the
//! entry (`orphanedSince`); one that sees the file back clears it; one that
//! runs [`ORPHAN_RETENTION_SECONDS`] or more after the recorded time prunes the
//! entry. Orphans are kept, not shown: [`SidecarState::files`] lists only the
//! files the workspace has, and [`SidecarState::retained_orphans`] counts the
//! rest. The time is the caller's argument, never read here, so the tests
//! control it. A clock that goes backwards never prunes early (the difference
//! saturates at zero), and a mark recorded from a clock that was ahead delays
//! the prune by as much. A load persists a change to the marks only when the
//! file is writable, best effort; a failure there is not reported, and the next
//! load computes the same marks again.
//!
//! The retention is thirty days of *this application's observations*: an entry
//! whose file disappears while no instance of the application runs is marked on
//! the next run, not when the file went.
//!
//! # Rust returns codes, never prose
//!
//! [`SidecarStatus`] and [`SidecarUpdateOutcome`] each own a `code.*`
//! namespace in both dictionaries. Display names are user data and are carried
//! as written, never translated (ruling 28).

mod format;
mod store;

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use espansoconfig_core::draft::BulkOption;
use espansoconfig_core::DocumentId;

use crate::error::CommandError;

pub use format::WorkspaceKey;
pub use store::SidecarStore;

use format::{encode_path, parse, render, FileEntry, Parsed, SidecarFile};
use store::{no_probe, LockedDirectory, Probe, QuarantineError, ReplaceError};

/// How long an orphaned entry is kept after it was first seen orphaned:
/// thirty days, in seconds (plan section 8.9).
pub const ORPHAN_RETENTION_SECONDS: u64 = 30 * 24 * 60 * 60;

/// How many times a load re-reads after a quarantine found the file already
/// gone — moved by another instance between this one's read and its rename.
const QUARANTINE_ATTEMPTS: usize = 3;

/// The workspace as the sidecar needs it: its root and each listed file's
/// identity and relative path.
///
/// Built by `crate::commands` from the open workspace. **Not a destination**:
/// the root is hashed into a file name and never written under, and the
/// relative paths become keys.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceFiles {
    /// The configuration root, as the workspace holds it; canonicalized here.
    pub root: PathBuf,
    /// Every listed file: its session identity and its path relative to `root`.
    pub files: Vec<(DocumentId, PathBuf)>,
}

/// What a load found. Each variant is one truthful outcome; see the module
/// documentation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum SidecarStatus {
    /// There is no sidecar for this workspace yet.
    Fresh {},
    /// The sidecar was read and is valid.
    Loaded {},
    /// The sidecar was corrupt and has been renamed aside.
    Quarantined {
        /// The name it now has, in the same directory.
        aside: String,
    },
    /// The sidecar is corrupt and could not be renamed aside; it is untouched
    /// and writes are refused.
    QuarantineFailed {},
    /// The sidecar declares a newer schema; it is untouched and writes are
    /// refused.
    FutureSchema {
        /// The declared version, in decimal.
        version: String,
    },
    /// The sidecar exists and could not be read; writes are refused.
    Unreadable {},
    /// The workspace root could not be canonicalized; nothing was read.
    RootUnresolved {},
    /// No application storage root is installed, or its sidecar directory
    /// could not be created, verified (it or its lock file is a symlink, for
    /// one) or locked; nothing was read.
    StorageUnavailable {},
}

impl SidecarStatus {
    /// Whether a write may follow a load that ended so.
    pub fn writable(&self) -> bool {
        matches!(
            self,
            SidecarStatus::Fresh {} | SidecarStatus::Loaded {} | SidecarStatus::Quarantined { .. }
        )
    }
} // End of impl SidecarStatus

/// One new-snippet default: an option key and its source **text**.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SidecarDefault {
    /// Which of the seven options.
    pub option: BulkOption,
    /// Its text, exactly as stored; `""` is an empty default, not an absent one.
    pub value: String,
}

/// The preferences of one listed file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SidecarFilePreferences {
    /// The file.
    pub document: DocumentId,
    /// Its display name, if one is set.
    pub display_name: Option<String>,
    /// Its sort position, if one is set.
    pub sort_order: Option<u32>,
    /// Its defaults, in option order; an option not listed has no default.
    pub defaults: Vec<SidecarDefault>,
}

/// What `load_sidecar` answers, and what `update_sidecar` answers beside its
/// outcome.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SidecarState {
    /// How the load ended.
    pub status: SidecarStatus,
    /// Whether an update may write; derived from `status`.
    pub writable: bool,
    /// The listed files that have preferences, in the workspace's order.
    pub files: Vec<SidecarFilePreferences>,
    /// How many entries are kept for files the workspace does not list.
    pub retained_orphans: usize,
}

/// One change to one file's preferences.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum SidecarChange {
    /// Sets the display name.
    SetDisplayName {
        /// The name, as the person wrote it.
        name: String,
    },
    /// Removes the display name.
    ClearDisplayName {},
    /// Sets the sort position.
    SetSortOrder {
        /// The position.
        order: u32,
    },
    /// Removes the sort position.
    ClearSortOrder {},
    /// Sets one default's text; `""` sets an empty default.
    SetDefault {
        /// Which option.
        option: BulkOption,
        /// Its text.
        value: String,
    },
    /// Removes one default, so the option has none.
    ClearDefault {
        /// Which option.
        option: BulkOption,
    },
}

/// What `update_sidecar` takes: one file and the changes to apply, in order.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SidecarUpdateRequest {
    /// The file, by session identity.
    pub document: DocumentId,
    /// The changes, applied in order; a later change to one field wins.
    pub changes: Vec<SidecarChange>,
}

/// What one update did.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum SidecarUpdateOutcome {
    /// The sidecar was replaced with the changed preferences.
    Saved {},
    /// The preferences already held the changes; nothing was written for them.
    Unchanged {},
    /// The load's status forbids writing; nothing was written.
    NotWritable {},
    /// The replacement failed before its rename; the sidecar holds what it held.
    WriteFailed {},
}

/// What `update_sidecar` answers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SidecarUpdateResult {
    /// What the update did.
    pub outcome: SidecarUpdateOutcome,
    /// The preferences in effect afterwards: the changed ones when saved, the
    /// reloaded ones otherwise.
    pub state: SidecarState,
}

/// The sidecar's managed state: the storage root, and the mutex that
/// serializes this process's loads and updates.
#[derive(Debug, Default)]
pub struct SidecarSession {
    /// The store, once `main.rs`'s setup has installed a storage root.
    store: Mutex<Option<SidecarStore>>,
}

impl SidecarSession {
    /// A session with no storage root: every load is `StorageUnavailable`
    /// until [`SidecarSession::install_storage_root`] runs.
    pub fn new() -> SidecarSession {
        SidecarSession::default()
    }

    /// Installs, or replaces, the application storage root.
    pub fn install_storage_root(&self, root: PathBuf) {
        *self.lock() = Some(SidecarStore::new(root));
    }

    /// Reads the sidecar of `workspace`; see [`load_with`].
    pub fn load(&self, workspace: &WorkspaceFiles, now: u64) -> SidecarState {
        let guard = self.lock();
        load_with(guard.as_ref(), workspace, now, &mut no_probe)
    }

    /// Applies `request` to the sidecar of `workspace`; see [`update_with`].
    ///
    /// # Errors
    ///
    /// [`CommandError::UnknownDocument`] for a file the workspace does not list,
    /// before anything is read.
    pub fn update(
        &self,
        workspace: &WorkspaceFiles,
        request: &SidecarUpdateRequest,
        now: u64,
    ) -> Result<SidecarUpdateResult, CommandError> {
        let guard = self.lock();
        update_with(guard.as_ref(), workspace, request, now, &mut no_probe)
    }

    /// Locks the store, absorbing poisoning: the guarded value is a path.
    fn lock(&self) -> MutexGuard<'_, Option<SidecarStore>> {
        self.store.lock().unwrap_or_else(PoisonError::into_inner)
    }
} // End of impl SidecarSession

/// The current Unix time in whole seconds; `0` for a clock before 1970.
pub fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs())
}

/// One load's result before it is projected for the wire.
struct Reading {
    /// How the load ended.
    status: SidecarStatus,
    /// The key and the locked directory to write through, when a write may
    /// follow. Holding it holds the cross-process lock.
    target: Option<(WorkspaceKey, LockedDirectory)>,
    /// The interpreted file, orphan marks applied; empty unless `Loaded`.
    file: SidecarFile,
    /// Whether the orphan marks changed what the disk holds.
    marks_changed: bool,
}

impl Reading {
    /// A load that found nothing it may write over.
    fn unwritable(status: SidecarStatus) -> Reading {
        Reading {
            status,
            target: None,
            file: SidecarFile::default(),
            marks_changed: false,
        }
    }
} // End of impl Reading

/// Reads the sidecar of `workspace`, quarantining a corrupt one and applying
/// the orphan policy at `now`. Writes back changed orphan marks, best effort,
/// when the file is writable. Creates nothing when there is no sidecar
/// directory; holds the cross-process lock throughout when there is one.
pub fn load_with(
    store: Option<&SidecarStore>,
    workspace: &WorkspaceFiles,
    now: u64,
    probe: Probe<'_>,
) -> SidecarState {
    let reading = read(store, workspace, now, false, probe);
    if reading.marks_changed {
        if let Some((key, store)) = &reading.target {
            // Best effort: see the module documentation.
            let _ = store.replace(key, &render(&reading.file, key), probe);
        }
    }
    project(&reading.status, &reading.file, workspace)
} // End of function load_with()

/// Reloads the sidecar of `workspace` and applies `request` to it at `now`.
///
/// # Errors
///
/// [`CommandError::UnknownDocument`] for a file the workspace does not list,
/// before anything is read. Every other outcome is a [`SidecarUpdateOutcome`].
pub fn update_with(
    store: Option<&SidecarStore>,
    workspace: &WorkspaceFiles,
    request: &SidecarUpdateRequest,
    now: u64,
    probe: Probe<'_>,
) -> Result<SidecarUpdateResult, CommandError> {
    let relative = workspace
        .files
        .iter()
        .find(|(document, _)| *document == request.document)
        .map(|(_, relative)| encode_path(relative))
        .ok_or(CommandError::UnknownDocument {
            document: request.document.0,
        })?;
    // Held until the end of this function: the lock covers the reload, the
    // checks and the replacement.
    let reading = read(store, workspace, now, true, probe);
    let Some((key, store)) = &reading.target else {
        return Ok(SidecarUpdateResult {
            outcome: SidecarUpdateOutcome::NotWritable {},
            state: project(&reading.status, &reading.file, workspace),
        });
    };
    let mut changed = reading.file.clone();
    apply(&mut changed, relative, &request.changes);
    if changed == reading.file {
        if reading.marks_changed {
            // Best effort, as a load's.
            let _ = store.replace(key, &render(&reading.file, key), probe);
        }
        return Ok(SidecarUpdateResult {
            outcome: SidecarUpdateOutcome::Unchanged {},
            state: project(&reading.status, &reading.file, workspace),
        });
    }
    let (outcome, file) = match store.replace(key, &render(&changed, key), probe) {
        Ok(()) => (SidecarUpdateOutcome::Saved {}, &changed),
        Err(ReplaceError::FutureSchema { version }) => {
            // A newer build's file arrived after the read; it is kept.
            return Ok(SidecarUpdateResult {
                outcome: SidecarUpdateOutcome::NotWritable {},
                state: project(
                    &SidecarStatus::FutureSchema { version },
                    &SidecarFile::default(),
                    workspace,
                ),
            });
        }
        Err(ReplaceError::Failed) => (SidecarUpdateOutcome::WriteFailed {}, &reading.file),
    };
    Ok(SidecarUpdateResult {
        outcome,
        state: project(&reading.status, file, workspace),
    })
} // End of function update_with()

/// One load: resolve, lock, read, interpret, quarantine, apply the orphan
/// policy. `create` makes the sidecar directory when it is missing; without
/// it, a missing directory is `Fresh` with nothing to write through.
fn read(
    store: Option<&SidecarStore>,
    workspace: &WorkspaceFiles,
    now: u64,
    create: bool,
    probe: Probe<'_>,
) -> Reading {
    let Some(store) = store else {
        return Reading::unwritable(SidecarStatus::StorageUnavailable {});
    };
    let Ok(canonical) = std::fs::canonicalize(&workspace.root) else {
        return Reading::unwritable(SidecarStatus::RootUnresolved {});
    };
    let key = WorkspaceKey::of_canonical_root(&canonical);
    let directory = match store.open(create) {
        Ok(Some(directory)) => directory,
        // No directory, so no file, and a load creates nothing.
        Ok(None) => return Reading::unwritable(SidecarStatus::Fresh {}),
        Err(_) => return Reading::unwritable(SidecarStatus::StorageUnavailable {}),
    };
    let mut found = None;
    for _ in 0..QUARANTINE_ATTEMPTS {
        let bytes = match directory.read(&key) {
            Ok(Some(bytes)) => bytes,
            Ok(None) => {
                found = Some((SidecarStatus::Fresh {}, SidecarFile::default(), false));
                break;
            }
            Err(_) => return Reading::unwritable(SidecarStatus::Unreadable {}),
        };
        match parse(&bytes, &key) {
            Parsed::Current(mut file) => {
                let marks_changed = mark_orphans(&mut file, workspace, now);
                found = Some((SidecarStatus::Loaded {}, file, marks_changed));
                break;
            }
            Parsed::Future { version } => {
                return Reading::unwritable(SidecarStatus::FutureSchema { version });
            }
            Parsed::Corrupt => match directory.quarantine(&key, &bytes, now, probe) {
                Ok(aside) => {
                    let status = SidecarStatus::Quarantined { aside };
                    found = Some((status, SidecarFile::default(), false));
                    break;
                }
                // Moved, removed or rewritten by somebody else since the read
                // (a writer that ignored the lock): read again.
                Err(QuarantineError::Changed) => continue,
                Err(QuarantineError::Failed) => {
                    return Reading::unwritable(SidecarStatus::QuarantineFailed {});
                }
            },
        }
    } // End of the loop over the quarantine attempts
    let Some((status, file, marks_changed)) = found else {
        return Reading::unwritable(SidecarStatus::Unreadable {});
    };
    Reading {
        status,
        target: Some((key, directory)),
        file,
        marks_changed,
    }
} // End of function read()

/// Applies the orphan policy at `now`; answers whether any entry changed.
fn mark_orphans(file: &mut SidecarFile, workspace: &WorkspaceFiles, now: u64) -> bool {
    let listed: BTreeSet<String> = workspace
        .files
        .iter()
        .map(|(_, relative)| encode_path(relative))
        .collect();
    let mut changed = false;
    file.files.retain(|key, entry| {
        if listed.contains(key) {
            changed |= entry.orphaned_since.take().is_some();
            return true;
        }
        match entry.orphaned_since {
            None => {
                entry.orphaned_since = Some(now);
                changed = true;
                true
            }
            Some(since) if now.saturating_sub(since) >= ORPHAN_RETENTION_SECONDS => {
                changed = true;
                false
            }
            Some(_) => true,
        }
    });
    changed
} // End of function mark_orphans()

/// Applies `changes`, in order, to the entry keyed `relative`, and drops the
/// entry if it ends holding nothing.
fn apply(file: &mut SidecarFile, relative: String, changes: &[SidecarChange]) {
    let entry = file.files.entry(relative.clone()).or_default();
    // The file is listed, so its entry is not an orphan.
    entry.orphaned_since = None;
    for change in changes {
        match change {
            SidecarChange::SetDisplayName { name } => entry.display_name = Some(name.clone()),
            SidecarChange::ClearDisplayName {} => entry.display_name = None,
            SidecarChange::SetSortOrder { order } => entry.sort_order = Some(*order),
            SidecarChange::ClearSortOrder {} => entry.sort_order = None,
            SidecarChange::SetDefault { option, value } => {
                entry.new_snippet_defaults.insert(*option, value.clone());
            }
            SidecarChange::ClearDefault { option } => {
                entry.new_snippet_defaults.remove(option);
            }
        }
    } // End of the loop over the changes
    if entry.holds_nothing() {
        file.files.remove(&relative);
    }
} // End of function apply()

/// The wire state of `file` under `status`, for the files `workspace` lists.
fn project(status: &SidecarStatus, file: &SidecarFile, workspace: &WorkspaceFiles) -> SidecarState {
    let files = workspace
        .files
        .iter()
        .filter_map(|(document, relative)| {
            let entry: &FileEntry = file.files.get(&encode_path(relative))?;
            Some(SidecarFilePreferences {
                document: *document,
                display_name: entry.display_name.clone(),
                sort_order: entry.sort_order,
                defaults: BulkOption::ALL
                    .iter()
                    .filter_map(|option| {
                        entry
                            .new_snippet_defaults
                            .get(option)
                            .map(|value| SidecarDefault {
                                option: *option,
                                value: value.clone(),
                            })
                    })
                    .collect(),
            })
        })
        .collect();
    SidecarState {
        status: status.clone(),
        writable: status.writable(),
        files,
        retained_orphans: file
            .files
            .values()
            .filter(|entry| entry.orphaned_since.is_some())
            .count(),
    }
} // End of function project()

/// One instance of every [`SidecarStatus`] variant, for the contract checks.
#[cfg(test)]
pub(crate) fn every_sidecar_status() -> Vec<SidecarStatus> {
    vec![
        SidecarStatus::Fresh {},
        SidecarStatus::Loaded {},
        SidecarStatus::Quarantined {
            aside: "0.corrupt-1-2-3.json".to_owned(),
        },
        SidecarStatus::QuarantineFailed {},
        SidecarStatus::FutureSchema {
            version: "2".to_owned(),
        },
        SidecarStatus::Unreadable {},
        SidecarStatus::RootUnresolved {},
        SidecarStatus::StorageUnavailable {},
    ]
}

/// One instance of every [`SidecarUpdateOutcome`] variant, for the contract
/// checks.
#[cfg(test)]
pub(crate) fn every_sidecar_update_outcome() -> Vec<SidecarUpdateOutcome> {
    vec![
        SidecarUpdateOutcome::Saved {},
        SidecarUpdateOutcome::Unchanged {},
        SidecarUpdateOutcome::NotWritable {},
        SidecarUpdateOutcome::WriteFailed {},
    ]
}

#[cfg(test)]
mod tests;
