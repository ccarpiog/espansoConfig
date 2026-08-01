//! Phase 2a-1 acceptance: the atomic file-replacement primitive.
//!
//! This is the first test binary in the project whose subject **modifies a
//! file**, and every test in it works in a `tempfile::TempDir`. Nothing here
//! writes inside `tests/corpus/`; the byte-exactness sweep copies a fixture out
//! and writes to the copy, because a fixture's whitespace *is* the test data
//! (`CLAUDE.md` section 4).
//!
//! What is pinned, in the order the plan's steps run:
//!
//! - a successful replace returns the revision of the bytes **read back from
//!   disk**, and the file holds exactly them;
//! - a stale base revision refuses and the file is byte-identical afterwards;
//! - a target replaced **while the call runs** is refused by the pre-commit
//!   re-check, and nothing is written;
//! - a missing target refuses and creates nothing, temp file included;
//! - a directory refuses;
//! - the temp name the implementation actually generates cannot be matched by
//!   `[!_]*.yml` — asserted against a transcription of that glob, not against a
//!   hard-coded string, and observed **mid-write** as well as generated;
//! - no temp file survives a success, a refusal, or a rename that fails after
//!   the temp file already exists — **except** the one case that is measured
//!   here rather than promised away: a target carrying `everyone deny delete`
//!   puts that entry on the candidate too, and the leftover then cannot be
//!   unlinked. What is asserted about it is what actually protects the user:
//!   espanso's glob cannot match its name;
//! - the temp file is **not widened from `0o600` before its bytes are on disk**,
//!   so no reader the target's mode admits can observe a partial candidate;
//! - the target's **mode bits**, its **access control list** and its **extended
//!   attributes** all survive, and the mode bits survive *beside* the other two
//!   rather than being overwritten by them. Ownership, creation time, BSD flags
//!   and hard links are still dropped by the new inode —
//!   `docs/decisions/2a-3a-notes.md` section 5 states all four of plan section 7
//!   row 11 in one place;
//! - a symlinked target has its **real** file written and stays a symlink;
//! - concurrent writers never lose an update, two spellings of one path contend
//!   on one lock, and the file never holds a mixture;
//! - five byte-exact fixtures survive a round trip through the writer, each
//!   **overwriting different bytes** so a no-op writer cannot pass.
//!
//! # What this binary does **not** pin
//!
//! Stated here rather than left to be discovered: **no test in this file would
//! fail if either `sync_all()` call or the step-11 read-back verification were
//! deleted.** All three are invisible while the filesystem behaves. Nothing here
//! involves a second *process* either, which is the case the residual race is
//! about. `docs/decisions/2a-1-notes.md` section 10 carries both as holes.
//!
//! **Nor does anything here make step 7a's copy fail inside the primitive.** No
//! input is known that does; what is pinned is the *classification* of such a
//! failure — before the rename, never a possible write — plus a unit test in
//! `persist::write` that reaches the syscall's error arm directly.
//! `docs/decisions/2a-3a-notes.md` section 8 records it as a hole.
//!
//! **Nor does anything here reach the temp-pathname identity check through the
//! whole primitive**, which would need the temp file's directory entry replaced
//! inside a window a few syscalls wide. `verify_temp_identity` is pinned by unit
//! tests in `persist::write` instead, which replace the entry directly and
//! deterministically.
//!
//! # Privacy
//!
//! The real corpus is the owner's private configuration (`CLAUDE.md` section 1).
//! Nothing here reads it: every byte written by this file is either hand-written
//! neutral YAML or a committed synthetic fixture.

mod common;

use common::corpus_root;
use espansoconfig_core::persist::{
    lock_path, replace_file_atomically, replace_locked_file, temp_file_name, TargetDifference,
    WriteError, WriteStep, TEMP_NAME_PREFIX, TEMP_NAME_SUFFIX,
};
use espansoconfig_core::ContentRevision;
use std::ffi::OsStr;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Barrier};
use std::time::Duration;

/// Neutral YAML the tests start from. No real content, ever.
const ORIGINAL: &[u8] = b"matches:\n  - trigger: ':one'\n    replace: 'first'\n";

/// Neutral YAML the tests write.
const REPLACEMENT: &[u8] = b"matches:\n  - trigger: ':two'\n    replace: 'second'\n";

/// Creates a temp directory holding one file with the given bytes.
///
/// Returns the directory (which deletes itself on drop) and the file's path.
fn fixture(bytes: &[u8]) -> (tempfile::TempDir, PathBuf) {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("base.yml");
    fs::write(&target, bytes).expect("the fixture file is written");
    (directory, target)
}

/// Every entry name directly inside `directory`, sorted.
fn entries(directory: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(directory)
        .expect("the directory is readable")
        .map(|entry| {
            entry
                .expect("the entry is readable")
                .file_name()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    names.sort();
    names
} // End of function entries()

/// Whether `name` is matched by espanso's default include glob `[!_]*.yml`.
///
/// An independent transcription of the glob rather than a call into the code
/// under test: `[!_]` is one character that is not an underscore, `*` is any
/// run, and `.yml` is literal. Written here so the assertion is about espanso's
/// rule, not about our opinion of it.
fn matched_by_espanso_glob(name: &str) -> bool {
    let mut characters = name.chars();
    match characters.next() {
        None => false,
        Some('_') => false,
        // `[!_]` consumed one character; `*` may consume the rest, so all that
        // is left to require is the literal ending — and the `.yml` must not be
        // the very character `[!_]` already ate.
        Some(_) => characters.as_str().ends_with(".yml") || name == ".yml",
    }
} // End of function matched_by_espanso_glob()

// ---------------------------------------------------------------------------
// 1. A successful replace
// ---------------------------------------------------------------------------

#[test]
fn a_successful_replace_returns_the_revision_of_the_bytes_on_disk() {
    let (directory, target) = fixture(ORIGINAL);
    let base = ContentRevision::of_bytes(ORIGINAL);

    let revision = replace_file_atomically(&target, base, REPLACEMENT).expect("the write succeeds");

    let on_disk = fs::read(&target).expect("the file is readable");
    assert_eq!(
        on_disk, REPLACEMENT,
        "the file holds exactly what was asked"
    );
    assert_eq!(
        revision,
        ContentRevision::of_bytes(&on_disk),
        "the returned revision is the revision of the bytes on disk"
    );
    assert_eq!(
        revision,
        ContentRevision::of_bytes(REPLACEMENT),
        "and therefore of the bytes that were handed in"
    );
    assert_eq!(entries(directory.path()), vec!["base.yml".to_owned()]);
} // End of function a_successful_replace_returns_the_revision_of_the_bytes_on_disk()

#[test]
fn writing_the_same_bytes_back_is_a_no_op_that_still_verifies() {
    let (_directory, target) = fixture(ORIGINAL);
    let base = ContentRevision::of_bytes(ORIGINAL);

    let revision = replace_file_atomically(&target, base, ORIGINAL).expect("the write succeeds");

    assert_eq!(revision, base);
    assert_eq!(fs::read(&target).expect("readable"), ORIGINAL);
}

// ---------------------------------------------------------------------------
// 2. A stale base revision, and a target that changes mid-call
// ---------------------------------------------------------------------------

#[test]
fn a_stale_base_revision_refuses_and_leaves_the_file_byte_identical() {
    let (directory, target) = fixture(ORIGINAL);
    let stale = ContentRevision::of_bytes(b"matches: []\n");
    let before = fs::read(&target).expect("readable");

    let error = replace_file_atomically(&target, stale, REPLACEMENT).expect_err("must refuse");

    match error {
        WriteError::RevisionMismatch {
            ref path,
            expected,
            found,
        } => {
            assert_eq!(path, &fs::canonicalize(&target).expect("canonical"));
            assert_eq!(expected, stale, "the caller's revision is reported back");
            assert_eq!(
                found,
                ContentRevision::of_bytes(ORIGINAL),
                "and so is the one the file actually holds"
            );
        }
        other => panic!("expected a revision mismatch, got {other}"),
    }
    assert!(!error.may_have_written(), "a refusal renames nothing");
    assert_eq!(
        fs::read(&target).expect("readable"),
        before,
        "the file is byte-identical after a refusal"
    );
    assert_eq!(entries(directory.path()), vec!["base.yml".to_owned()]);
} // End of function a_stale_base_revision_refuses_and_leaves_the_file_byte_identical()

#[test]
fn a_revision_taken_before_an_external_edit_is_refused() {
    // The hazard the check exists for: the file changed in another editor after
    // this process read it.
    let (_directory, target) = fixture(ORIGINAL);
    let base = ContentRevision::of_bytes(ORIGINAL);
    fs::write(&target, b"matches:\n  - trigger: ':vim'\n").expect("the external edit");

    let error = replace_file_atomically(&target, base, REPLACEMENT).expect_err("must refuse");

    assert!(matches!(error, WriteError::RevisionMismatch { .. }));
    assert_eq!(
        fs::read(&target).expect("readable"),
        b"matches:\n  - trigger: ':vim'\n",
        "the other editor's bytes survive untouched"
    );
} // End of function a_revision_taken_before_an_external_edit_is_refused()

#[test]
fn a_target_replaced_while_the_call_runs_is_refused_by_the_pre_commit_recheck() {
    // The window the pre-commit re-check narrows. The writer is given a payload
    // big enough that writing and fsyncing it takes milliseconds, and an
    // "external editor" thread replaces the target during that time.
    //
    // Three outcomes are possible and two of them are correct refusals, so the
    // test asserts over ATTEMPTS runs that the *during-the-write* refusal is
    // observed at least once — otherwise it would pass without ever exercising
    // the re-check. It also asserts that no attempt silently succeeded while
    // holding the intruder's bytes.
    const ATTEMPTS: usize = 24;
    let payload: Vec<u8> = vec![b'z'; 12 * 1024 * 1024];
    let intruder = b"matches:\n  - trigger: ':vim'\n";

    let mut during = 0usize;
    let mut before = 0usize;
    let mut committed = 0usize;

    for attempt in 0..ATTEMPTS {
        let (_directory, target) = fixture(ORIGINAL);
        let base = ContentRevision::of_bytes(ORIGINAL);
        let replacement_source = target.with_file_name("_intruder.tmp");

        let writer_target = target.clone();
        let writer_payload = payload.clone();
        let writer = std::thread::spawn(move || {
            replace_file_atomically(&writer_target, base, &writer_payload)
        });

        // A rename, exactly as vim and every other atomic-save editor does it,
        // so the target gets a genuinely different inode.
        std::thread::sleep(Duration::from_micros(200 * (attempt as u64 % 8 + 1)));
        fs::write(&replacement_source, intruder).expect("the intruder's temp file");
        fs::rename(&replacement_source, &target).expect("the intruder's rename");

        match writer.join().expect("the writer thread") {
            Err(WriteError::TargetChangedDuringWrite { .. }) => during += 1,
            Err(WriteError::RevisionMismatch { .. }) => before += 1,
            Err(other) => panic!("unexpected failure: {other}"),
            Ok(_) => committed += 1,
        }
    } // End of the loop over attempts

    assert!(
        during > 0,
        "the pre-commit re-check never fired in {ATTEMPTS} attempts \
         ({before} refused before the write, {committed} committed), \
         so this test measured nothing"
    );
} // End of function a_target_replaced_while_the_call_runs_is_refused_by_the_pre_commit_recheck()

#[test]
fn a_during_the_write_refusal_reports_which_thing_changed() {
    // The deterministic half of the test above: the four `TargetDifference`
    // arms are pinned as unit tests beside `recheck_target` in write.rs, where
    // the check can be called directly. What is pinned here is that the variant
    // reaches a caller of the public entry point at all, and that it is a
    // refusal — `may_have_written()` false, target untouched.
    let (directory, target) = fixture(ORIGINAL);
    let base = ContentRevision::of_bytes(ORIGINAL);
    let payload: Vec<u8> = vec![b'q'; 12 * 1024 * 1024];
    let intruder = b"matches:\n  - trigger: ':vim'\n";

    let writer_target = target.clone();
    let writer =
        std::thread::spawn(move || replace_file_atomically(&writer_target, base, &payload));
    std::thread::sleep(Duration::from_millis(1));
    let source = target.with_file_name("_intruder.tmp");
    fs::write(&source, intruder).expect("write");
    fs::rename(&source, &target).expect("rename");

    match writer.join().expect("the writer thread") {
        Err(error @ WriteError::TargetChangedDuringWrite { .. }) => {
            assert!(!error.may_have_written(), "a refusal renames nothing");
            let WriteError::TargetChangedDuringWrite { difference, .. } = &error else {
                unreachable!()
            };
            assert!(
                matches!(
                    difference,
                    TargetDifference::Identity | TargetDifference::Contents { .. }
                ),
                "an intruding rename changes the inode or the bytes, got {difference}"
            );
            assert_eq!(
                fs::read(&target).expect("readable"),
                intruder,
                "the intruder's bytes survive: the refusal wrote nothing"
            );
        }
        Err(WriteError::RevisionMismatch { .. }) | Ok(_) => {
            println!(
                "SKIP a_during_the_write_refusal_reports_which_thing_changed: \
                 the intruder did not land inside the window on this run. \
                 a_target_replaced_while_the_call_runs_is_refused_by_the_pre_commit_recheck \
                 is the test that cannot degrade this way."
            );
        }
        Err(other) => panic!("unexpected failure: {other}"),
    }
    assert!(entries(directory.path())
        .iter()
        .all(|name| name == "base.yml"));
} // End of function a_during_the_write_refusal_reports_which_thing_changed()

// ---------------------------------------------------------------------------
// 3. A missing target
// ---------------------------------------------------------------------------

#[test]
fn a_missing_target_refuses_and_creates_nothing() {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("absent.yml");

    let error = replace_file_atomically(&target, ContentRevision::of_bytes(b""), REPLACEMENT)
        .expect_err("must refuse");

    assert!(
        matches!(error, WriteError::TargetMissing { .. }),
        "expected a missing target, got {error}"
    );
    assert!(!error.may_have_written());
    assert!(!target.exists(), "the primitive never creates a file");
    assert!(
        entries(directory.path()).is_empty(),
        "not even a temp file: {:?}",
        entries(directory.path())
    );
} // End of function a_missing_target_refuses_and_creates_nothing()

#[test]
fn a_dangling_symlink_is_a_missing_target_rather_than_a_file_to_create() {
    let directory = tempfile::tempdir().expect("a temp directory");
    let link = directory.path().join("link.yml");
    std::os::unix::fs::symlink(directory.path().join("nowhere.yml"), &link).expect("symlink");

    let error = replace_file_atomically(&link, ContentRevision::of_bytes(b""), REPLACEMENT)
        .expect_err("must refuse");

    assert!(
        matches!(error, WriteError::TargetMissing { .. }),
        "expected a missing target, got {error}"
    );
    assert!(
        fs::symlink_metadata(&link)
            .expect("the link is still there")
            .file_type()
            .is_symlink(),
        "the dangling link is left exactly as it was"
    );
    assert!(!directory.path().join("nowhere.yml").exists());
    assert_eq!(entries(directory.path()), vec!["link.yml".to_owned()]);
} // End of function a_dangling_symlink_is_a_missing_target_rather_than_a_file_to_create()

// ---------------------------------------------------------------------------
// 4. A target that is not a regular file
// ---------------------------------------------------------------------------

#[test]
fn a_directory_as_target_refuses() {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("match");
    fs::create_dir(&target).expect("mkdir");
    fs::write(target.join("base.yml"), ORIGINAL).expect("write");

    let error = replace_file_atomically(&target, ContentRevision::of_bytes(b""), REPLACEMENT)
        .expect_err("must refuse");

    assert!(
        matches!(error, WriteError::TargetNotRegularFile { .. }),
        "expected a non-regular target, got {error}"
    );
    assert!(!error.may_have_written());
    assert!(target.is_dir(), "the directory survives");
    assert_eq!(entries(&target), vec!["base.yml".to_owned()]);
} // End of function a_directory_as_target_refuses()

// ---------------------------------------------------------------------------
// 5. The temp file's name
// ---------------------------------------------------------------------------

#[test]
fn the_generated_temp_name_cannot_be_matched_by_espansos_include_glob() {
    // The glob transcription itself has to be shown to work, or an assertion
    // against it proves nothing.
    assert!(matched_by_espanso_glob("base.yml"));
    assert!(matched_by_espanso_glob("a.yml"));
    assert!(!matched_by_espanso_glob("_private.yml"));
    assert!(!matched_by_espanso_glob("base.yaml"));
    assert!(!matched_by_espanso_glob("base.yml.tmp"));

    for name in ["base.yml", "_private.yml", "a.yml", "weird name.yml"] {
        let generated = temp_file_name(OsStr::new(name));
        let text = generated.to_string_lossy().into_owned();
        assert!(
            !matched_by_espanso_glob(&text),
            "espanso's glob would load the temp file {text}"
        );
        assert!(text.starts_with(TEMP_NAME_PREFIX), "{text}");
        assert!(text.ends_with(TEMP_NAME_SUFFIX), "{text}");
        assert!(!text.ends_with(".yml"), "{text}");
    } // End of the loop over target names
} // End of function the_generated_temp_name_cannot_be_matched_by_espansos_include_glob()

#[test]
fn the_temp_file_observed_mid_write_is_the_one_the_name_generator_describes() {
    // Generating a name proves what the generator does; this proves the writer
    // uses it. The observation is taken from another thread while the writer is
    // inside the call, by making the payload large enough to take a measurable
    // time and polling the directory.
    let (directory, target) = fixture(ORIGINAL);
    let payload: Vec<u8> = vec![b'x'; 8 * 1024 * 1024];
    let base = ContentRevision::of_bytes(ORIGINAL);

    let watched = directory.path().to_path_buf();
    let stop = Arc::new(AtomicBool::new(false));
    let watcher_stop = Arc::clone(&stop);
    let watcher = std::thread::spawn(move || {
        let mut seen: Vec<String> = Vec::new();
        while !watcher_stop.load(Ordering::SeqCst) {
            for name in entries(&watched) {
                if name != "base.yml" && !seen.contains(&name) {
                    seen.push(name);
                }
            }
        } // End of the polling loop
        seen
    });

    replace_file_atomically(&target, base, &payload).expect("the write succeeds");
    stop.store(true, Ordering::SeqCst);
    let seen = watcher.join().expect("the watcher thread");

    assert!(
        !seen.is_empty(),
        "the poller never caught the temp file, so this test measured nothing"
    );
    for name in &seen {
        assert!(
            !matched_by_espanso_glob(name),
            "espanso's glob would have loaded {name} mid-write"
        );
        assert!(name.starts_with(TEMP_NAME_PREFIX), "{name}");
        assert!(name.ends_with(TEMP_NAME_SUFFIX), "{name}");
        assert!(name.contains("base.yml"), "{name} must name its target");
    } // End of the loop over the names the poller saw
    assert_eq!(entries(directory.path()), vec!["base.yml".to_owned()]);
} // End of function the_temp_file_observed_mid_write_is_the_one_the_name_generator_describes()

#[test]
fn the_temp_file_is_created_in_the_targets_own_directory() {
    // Same-directory is what makes the rename atomic. Observed from the same
    // poller, which only ever looks in the target's directory.
    let (directory, target) = fixture(ORIGINAL);
    let payload: Vec<u8> = vec![b'y'; 8 * 1024 * 1024];

    let watched = directory.path().to_path_buf();
    let stop = Arc::new(AtomicBool::new(false));
    let watcher_stop = Arc::clone(&stop);
    let watcher = std::thread::spawn(move || {
        let mut count = 0usize;
        while !watcher_stop.load(Ordering::SeqCst) {
            if entries(&watched).len() > 1 {
                count += 1;
            }
        } // End of the polling loop
        count
    });

    replace_file_atomically(&target, ContentRevision::of_bytes(ORIGINAL), &payload)
        .expect("the write succeeds");
    stop.store(true, Ordering::SeqCst);

    assert!(
        watcher.join().expect("the watcher thread") > 0,
        "no second entry ever appeared beside the target, so the temp file was \
         not in the target's directory"
    );
} // End of function the_temp_file_is_created_in_the_targets_own_directory()

// ---------------------------------------------------------------------------
// 6. No temp file survives
// ---------------------------------------------------------------------------

#[test]
fn no_temp_file_survives_a_failure_after_the_temp_file_exists() {
    // The guard's whole reason for existing: a failure *after* the temp file was
    // created, permissioned, written and fsynced. `chflags uchg` on the target
    // makes `rename()` fail with EPERM on macOS, which is the only step that can
    // be made to fail from outside the process without a hook in the code.
    //
    // There is deliberately **no skip path**. A test that quietly turns into a
    // pass when its instrument is missing is worse than no test, so an
    // unavailable `chflags` is a failure, not a notice.
    let (directory, target) = fixture(ORIGINAL);
    assert!(
        set_immutable(&target, true),
        "chflags could not be run, so the only test of the RAII guard's failure \
         path cannot be performed on this system"
    );

    let result = replace_file_atomically(&target, ContentRevision::of_bytes(ORIGINAL), REPLACEMENT);
    assert!(
        set_immutable(&target, false),
        "the immutable flag could not be cleared; the temp directory will not delete"
    );

    match result {
        Err(WriteError::Io {
            step, ref source, ..
        }) => {
            assert_eq!(
                step,
                WriteStep::Rename,
                "the failure must be attributed to the rename, not to prose"
            );
            assert!(!step.after_rename(), "the rename did not commit");
            assert_eq!(source.kind(), std::io::ErrorKind::PermissionDenied);
        }
        Err(other) => panic!("expected an I/O failure at the rename, got {other}"),
        Ok(_) => panic!("the immutable flag did not stop the rename, so nothing was measured"),
    }
    assert_eq!(
        fs::read(&target).expect("readable"),
        ORIGINAL,
        "the target is untouched"
    );
    assert_eq!(
        entries(directory.path()),
        vec!["base.yml".to_owned()],
        "the temp file did not survive the failure"
    );
} // End of function no_temp_file_survives_a_failure_after_the_temp_file_exists()

#[test]
fn a_directory_that_refuses_a_temp_file_fails_at_the_named_step() {
    let (directory, target) = fixture(ORIGINAL);
    let mut permissions = fs::metadata(directory.path())
        .expect("metadata")
        .permissions();
    permissions.set_mode(0o500);
    fs::set_permissions(directory.path(), permissions).expect("chmod");

    let result = replace_file_atomically(&target, ContentRevision::of_bytes(ORIGINAL), REPLACEMENT);

    let mut restore = fs::metadata(directory.path())
        .expect("metadata")
        .permissions();
    restore.set_mode(0o700);
    fs::set_permissions(directory.path(), restore).expect("chmod");

    match result {
        Err(WriteError::Io { step, .. }) => {
            assert_eq!(step, WriteStep::CreateTempFile);
            assert!(!step.after_rename());
        }
        Err(other) => panic!("expected an I/O failure creating the temp file, got {other}"),
        Ok(_) => panic!("a read-only directory accepted a temp file"),
    }
    assert_eq!(fs::read(&target).expect("readable"), ORIGINAL);
    assert_eq!(entries(directory.path()), vec!["base.yml".to_owned()]);
} // End of function a_directory_that_refuses_a_temp_file_fails_at_the_named_step()

/// Sets or clears macOS's user-immutable flag. Returns whether it worked.
fn set_immutable(path: &Path, immutable: bool) -> bool {
    let flag = if immutable { "uchg" } else { "nouchg" };
    std::process::Command::new("chflags")
        .arg(flag)
        .arg(path)
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// 7. Mode bits
// ---------------------------------------------------------------------------

#[test]
fn the_targets_mode_bits_survive_the_write() {
    // Step 7b, and a regression guard on what already worked before 2a-3a added
    // step 7a beside it: the metadata copy runs first and the mode bits are set
    // afterwards, so a `copyfile` flag set that touched the mode would show up
    // here rather than silently.
    for mode in [0o600u32, 0o640, 0o755] {
        let (_directory, target) = fixture(ORIGINAL);
        let mut permissions = fs::metadata(&target).expect("metadata").permissions();
        permissions.set_mode(mode);
        fs::set_permissions(&target, permissions).expect("chmod");

        replace_file_atomically(&target, ContentRevision::of_bytes(ORIGINAL), REPLACEMENT)
            .expect("the write succeeds");

        let after = fs::metadata(&target)
            .expect("metadata")
            .permissions()
            .mode()
            & 0o7777;
        assert_eq!(
            after, mode,
            "mode {mode:o} became {after:o} across the write"
        );
    } // End of the loop over the modes
} // End of function the_targets_mode_bits_survive_the_write()

#[test]
fn the_temp_file_is_not_widened_before_its_bytes_are_on_disk() {
    // The review's temporary-file exposure window. The candidate is created
    // 0o600 and only takes the target's mode **after** `write_all` and
    // `sync_all` have returned, so no reader the target's mode admits can open
    // the named temp file and find it empty, partial or unvalidated.
    //
    // The assertion is an invariant, not a schedule: *if* the poller sees the
    // temp file wearing the target's mode, its length must already be the
    // payload's. Under a correct ordering that can never fail however the
    // threads interleave; under the ordering this replaced — mode bits before
    // the bytes — a widened, short temp file is exactly what appears.
    //
    // What is deliberately **not** asserted is that the poller caught anything
    // at all. "The window was sampled" is a claim about the machine's scheduler,
    // and a test that fails when the machine is busy is a worse instrument than
    // one that says out loud that it measured nothing.
    let (directory, target) = fixture(ORIGINAL);
    let mut permissions = fs::metadata(&target).expect("metadata").permissions();
    permissions.set_mode(0o644);
    fs::set_permissions(&target, permissions).expect("chmod");
    let payload: Vec<u8> = vec![b'z'; 8 * 1024 * 1024];
    let complete = payload.len() as u64;

    let watched = directory.path().to_path_buf();
    let stop = Arc::new(AtomicBool::new(false));
    let watcher_stop = Arc::clone(&stop);
    let watcher = std::thread::spawn(move || {
        // The mode and the length of every temp file the poller managed to stat
        // before it was renamed away.
        let mut samples: Vec<(u32, u64)> = Vec::new();
        while !watcher_stop.load(Ordering::SeqCst) {
            for name in entries(&watched) {
                if name == "base.yml" {
                    continue;
                }
                if let Ok(metadata) = fs::metadata(watched.join(&name)) {
                    samples.push((metadata.permissions().mode() & 0o7777, metadata.len()));
                }
            } // End of the loop over the directory's entries
        } // End of the polling loop
        samples
    });

    replace_file_atomically(&target, ContentRevision::of_bytes(ORIGINAL), &payload)
        .expect("the write succeeds");
    stop.store(true, Ordering::SeqCst);
    let samples = watcher.join().expect("the watcher thread");

    let exposed: Vec<(u32, u64)> = samples
        .iter()
        .copied()
        .filter(|(mode, length)| *mode != 0o600 && *length != complete)
        .collect();
    assert!(
        exposed.is_empty(),
        "the temp file wore a mode wider than 0o600 while it was still \
         incomplete: {exposed:?} (the payload is {complete} bytes)"
    );
    if samples.is_empty() {
        println!(
            "NOTE the_temp_file_is_not_widened_before_its_bytes_are_on_disk: \
             the poller never caught the temp file, so the invariant held vacuously"
        );
    } else {
        println!(
            "NOTE the_temp_file_is_not_widened_before_its_bytes_are_on_disk: \
             {} samples, of which {} were still 0o600",
            samples.len(),
            samples.iter().filter(|(mode, _)| *mode == 0o600).count()
        );
    }
    assert_eq!(
        fs::metadata(&target)
            .expect("metadata")
            .permissions()
            .mode()
            & 0o7777,
        0o644,
        "the mode still has to arrive, just later"
    );
} // End of function the_temp_file_is_not_widened_before_its_bytes_are_on_disk()

#[test]
fn the_write_installs_a_new_inode_which_is_why_metadata_has_to_be_copied() {
    // Not a wish, a measurement: the file identity changes, and that is the
    // mechanism behind every entry in the notes' metadata list. It is why the
    // ACL and the extended attributes have to be copied **explicitly** at step
    // 7a — there is no inode left to inherit them from — and why ownership,
    // creation time, BSD flags and hard links are still lost.
    use std::os::unix::fs::MetadataExt;
    let (_directory, target) = fixture(ORIGINAL);
    let before = fs::metadata(&target).expect("metadata").ino();

    replace_file_atomically(&target, ContentRevision::of_bytes(ORIGINAL), REPLACEMENT)
        .expect("the write succeeds");

    let after = fs::metadata(&target).expect("metadata").ino();
    assert_ne!(
        before, after,
        "the rename must install a new inode; if it did not, the metadata hole \
         in the notes is describing something that does not happen"
    );
} // End of function the_write_installs_a_new_inode_which_is_why_only_mode_bits_survive()

// ---------------------------------------------------------------------------
// 7b. Plan section 7 row 11's other half: the ACL and the extended attributes
//
// Everything in this section is macOS-only, exactly as `copy_metadata` is:
// `copyfile(3)` is an Apple interface and the step is a documented no-op
// elsewhere, so a test asserting the guarantee would be asserting something the
// implementation does not claim off macOS.
// ---------------------------------------------------------------------------

/// Sets one extended attribute on `path`. Answers whether it worked.
///
/// The syscall rather than `xattr(1)`, so the test depends on the platform and
/// not on a binary being installed.
#[cfg(target_os = "macos")]
fn set_extended_attribute(path: &Path, name: &str, value: &[u8]) -> bool {
    let path = std::ffi::CString::new(path.as_os_str().as_encoded_bytes()).expect("no NUL");
    let name = std::ffi::CString::new(name).expect("no NUL");
    // SAFETY: both C strings and `value` outlive the call, and the length passed
    // is `value`'s own.
    let written = unsafe {
        libc::setxattr(
            path.as_ptr(),
            name.as_ptr(),
            value.as_ptr().cast(),
            value.len(),
            0,
            0,
        )
    };
    written == 0
} // End of function set_extended_attribute()

/// Reads one extended attribute from `path`, or answers `None` if it is absent.
#[cfg(target_os = "macos")]
fn extended_attribute(path: &Path, name: &str) -> Option<Vec<u8>> {
    let path = std::ffi::CString::new(path.as_os_str().as_encoded_bytes()).expect("no NUL");
    let name = std::ffi::CString::new(name).expect("no NUL");
    let mut buffer = vec![0u8; 4096];
    // SAFETY: both C strings outlive the call and `buffer` is `buffer.len()`
    // bytes long, which is the limit passed.
    let read = unsafe {
        libc::getxattr(
            path.as_ptr(),
            name.as_ptr(),
            buffer.as_mut_ptr().cast(),
            buffer.len(),
            0,
            0,
        )
    };
    if read < 0 {
        return None;
    }
    buffer.truncate(read as usize);
    Some(buffer)
} // End of function extended_attribute()

/// Adds one access control entry to `path` with `chmod +a`. Answers whether the
/// command succeeded.
///
/// A shell command, because setting an ACL from Rust means `acl_from_text`,
/// `acl_set_fd` and a hand-built `acl_t` — far more platform surface in a test
/// than in the code it tests. A machine or a volume where it does not work makes
/// the caller **skip with a printed reason**, which is this project's convention
/// for an unavailable instrument.
#[cfg(target_os = "macos")]
fn add_access_control_entry(path: &Path, entry: &str) -> bool {
    std::process::Command::new("/bin/chmod")
        .arg("+a")
        .arg(entry)
        .arg(path)
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
} // End of function add_access_control_entry()

/// The access control entries `ls -lde` reports for `path`, one per element.
///
/// `ls` prints the mode line first and then one numbered entry per line; the
/// mode line is dropped here so the answer is the ACL and nothing else. An empty
/// vector means the file has no ACL.
#[cfg(target_os = "macos")]
fn access_control_entries(path: &Path) -> Vec<String> {
    let output = std::process::Command::new("/bin/ls")
        .arg("-lde")
        .arg(path)
        .output()
        .expect("ls runs");
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .skip(1)
        .map(|line| line.trim().to_owned())
        .collect()
} // End of function access_control_entries()

/// Removes every ACL under `directory`, so a `TempDir` can delete itself.
///
/// A `deny delete` entry stops `remove_file`, which would otherwise leave the
/// temp directory — and its contents — behind for the life of the machine.
#[cfg(target_os = "macos")]
fn strip_access_control_lists(directory: &Path) {
    let _ = std::process::Command::new("/bin/chmod")
        .arg("-R")
        .arg("-N")
        .arg(directory)
        .status();
}

#[cfg(target_os = "macos")]
#[test]
fn extended_attributes_on_the_target_survive_the_write() {
    // The loss this step exists to stop, and on macOS it is ordinary rather than
    // exotic: a Finder tag, a Finder comment and an application's own attribute
    // are all just extended attributes, and before 2a-3a the first save dropped
    // every one of them silently.
    let (_directory, target) = fixture(ORIGINAL);
    let attributes: [(&str, &[u8]); 3] = [
        ("com.apple.metadata:_kMDItemUserTags", b"espansoconfig-test"),
        (
            "com.apple.metadata:kMDItemFinderComment",
            b"a neutral comment",
        ),
        ("com.espansoconfig.test.probe", b"carried across the rename"),
    ];
    for (name, value) in attributes {
        assert!(
            set_extended_attribute(&target, name, value),
            "setxattr failed for {name}, so this test would measure nothing"
        );
    } // End of the loop that seeds the target's attributes

    replace_file_atomically(&target, ContentRevision::of_bytes(ORIGINAL), REPLACEMENT)
        .expect("the write succeeds");

    for (name, value) in attributes {
        assert_eq!(
            extended_attribute(&target, name).as_deref(),
            Some(value),
            "{name} did not survive the write"
        );
    } // End of the loop that checks the attributes survived

    assert_eq!(
        fs::read(&target).expect("readable"),
        REPLACEMENT,
        "the metadata copy must not touch the data"
    );
} // End of function extended_attributes_on_the_target_survive_the_write()

#[cfg(target_os = "macos")]
#[test]
fn an_access_control_list_on_the_target_survives_the_write() {
    // The one item on the dropped-metadata list that is a **security** property.
    // A denying ACL takes away access the mode bits appear to grant, so a write
    // that dropped it left the file *more* accessible than it found it while the
    // mode bits looked untouched.
    //
    // `deny write` is used rather than `deny delete` deliberately: a `deny
    // delete` entry stops the `rename()` itself, which the test below pins.
    let (directory, target) = fixture(ORIGINAL);
    if !add_access_control_entry(&target, "everyone deny write") {
        println!(
            "SKIP an_access_control_list_on_the_target_survives_the_write: \
             chmod +a could not set an ACL here"
        );
        return;
    }
    let before = access_control_entries(&target);
    if before.is_empty() {
        println!(
            "SKIP an_access_control_list_on_the_target_survives_the_write: \
             this volume did not keep the ACL that was set on it"
        );
        strip_access_control_lists(directory.path());
        return;
    }

    replace_file_atomically(&target, ContentRevision::of_bytes(ORIGINAL), REPLACEMENT)
        .expect("the write succeeds");

    let after = access_control_entries(&target);
    assert_eq!(
        after, before,
        "the access control list did not survive the write, so this save broadened access"
    );
    assert_eq!(
        fs::read(&target).expect("readable"),
        REPLACEMENT,
        "the metadata copy must not touch the data"
    );
    strip_access_control_lists(directory.path());
} // End of function an_access_control_list_on_the_target_survives_the_write()

#[cfg(target_os = "macos")]
#[test]
fn the_mode_bits_survive_beside_an_access_control_list_and_an_attribute() {
    // Two mechanisms write the candidate's protection — `fcopyfile` for the ACL
    // and the extended attributes, `set_permissions` for the mode — and the
    // whole reason step 7b runs *after* step 7a is so they cannot disagree. This
    // is the test that would notice if they did.
    let (directory, target) = fixture(ORIGINAL);
    let mut permissions = fs::metadata(&target).expect("metadata").permissions();
    permissions.set_mode(0o640);
    fs::set_permissions(&target, permissions).expect("chmod");
    assert!(set_extended_attribute(
        &target,
        "com.espansoconfig.test.probe",
        b"beside the mode bits"
    ));
    let has_acl = add_access_control_entry(&target, "everyone deny write")
        && !access_control_entries(&target).is_empty();

    replace_file_atomically(&target, ContentRevision::of_bytes(ORIGINAL), REPLACEMENT)
        .expect("the write succeeds");

    let mode = fs::metadata(&target)
        .expect("metadata")
        .permissions()
        .mode()
        & 0o7777;
    assert_eq!(mode, 0o640, "the mode became {mode:o} across the write");
    assert_eq!(
        extended_attribute(&target, "com.espansoconfig.test.probe").as_deref(),
        Some(b"beside the mode bits".as_slice())
    );
    if has_acl {
        assert!(
            !access_control_entries(&target).is_empty(),
            "the ACL was lost while the mode bits survived"
        );
    } else {
        println!(
            "NOTE the_mode_bits_survive_beside_an_access_control_list_and_an_attribute: \
             no ACL could be set here, so only the mode bits and the attribute were measured"
        );
    }
    assert_eq!(fs::read(&target).expect("readable"), REPLACEMENT);
    strip_access_control_lists(directory.path());
} // End of function the_mode_bits_survive_beside_an_access_control_list_and_an_attribute()

#[cfg(target_os = "macos")]
#[test]
fn an_access_control_list_that_denies_delete_refuses_and_can_leave_a_temp_file() {
    // Recorded because it is the one case where preserving an ACL and committing
    // a save are in conflict, and because it is **not** a regression: measured
    // both ways, a `deny delete` entry on the target makes `rename()` fail with
    // EACCES whether or not the candidate carries a copy of it. So the file was
    // already unsaveable through this primitive before 2a-3a, and it still is.
    //
    // The second half of the name is the review's point, and it is measured here
    // rather than only described: the same copied entry that stops the rename
    // stops the guard's `remove_file` too, so **a fully written temp file can
    // survive the failure**. The guarantee a failure carries is about the
    // target — it keeps its bytes and its protection — and what makes the
    // leftover harmless is its **name**, which is asserted below against an
    // independent transcription of espanso's glob.
    let (directory, target) = fixture(ORIGINAL);
    if !add_access_control_entry(&target, "everyone deny delete")
        || access_control_entries(&target).is_empty()
    {
        println!(
            "SKIP an_access_control_list_that_denies_delete_refuses_and_can_leave_a_temp_file: \
             chmod +a could not set an ACL here"
        );
        strip_access_control_lists(directory.path());
        return;
    }

    let result = replace_file_atomically(&target, ContentRevision::of_bytes(ORIGINAL), REPLACEMENT);

    match result {
        Err(WriteError::Io { step, .. }) => {
            assert_eq!(
                step,
                WriteStep::Rename,
                "the refusal must be attributed to the rename"
            );
            assert!(!step.after_rename(), "nothing was committed");
        }
        Err(other) => panic!("expected an I/O failure at the rename, got {other}"),
        Ok(_) => panic!("a deny-delete ACL did not stop the rename, so nothing was measured"),
    }
    assert_eq!(
        fs::read(&target).expect("readable"),
        ORIGINAL,
        "the target must keep its bytes"
    );

    // What is left in the directory is the observation this test exists to make,
    // and it is not asserted in one direction: whether the unlink is refused is
    // the platform's answer, not this crate's. Whatever survives must be
    // invisible to espanso, which is the property that actually protects the
    // user.
    let leftovers: Vec<String> = entries(directory.path())
        .into_iter()
        .filter(|name| name != "base.yml")
        .collect();
    for name in &leftovers {
        assert!(
            !matched_by_espanso_glob(name),
            "espanso's glob would load the leftover {name}"
        );
    } // End of the loop over the leftovers
    println!(
        "NOTE an_access_control_list_that_denies_delete_refuses_and_can_leave_a_temp_file: \
         {} temp file(s) survived the refusal",
        leftovers.len()
    );
    strip_access_control_lists(directory.path());
} // End of function an_access_control_list_that_denies_delete_refuses_and_can_leave_a_temp_file()

#[test]
fn a_metadata_copy_failure_is_a_refusal_that_has_written_nothing() {
    // The failure policy, pinned at the only level a test can reach it without a
    // fault-injection hook: the classification. `copy_metadata` runs **before**
    // the rename, so a caller that sees this step must be told the target is
    // untouched. `docs/decisions/2a-3a-notes.md` section 8 records that no
    // known input makes the copy itself fail inside the primitive.
    assert!(
        !WriteStep::CopyMetadata.after_rename(),
        "the metadata copy happens before the commit"
    );
    let failure = WriteError::Io {
        step: WriteStep::CopyMetadata,
        path: PathBuf::from("/nowhere/_base.yml.tmp"),
        source: std::io::Error::from_raw_os_error(9),
    };
    assert!(
        !failure.may_have_written(),
        "a metadata-copy failure must never be reported as a possible write"
    );
    assert_eq!(WriteStep::CopyMetadata.code(), "copyMetadata");
} // End of function a_metadata_copy_failure_is_a_refusal_that_has_written_nothing()

// ---------------------------------------------------------------------------
// 8. Symlinks
// ---------------------------------------------------------------------------

#[test]
fn a_symlinked_target_has_its_real_file_written_and_stays_a_symlink() {
    // The decision this pins: the primitive resolves. `rename()` over a symlink
    // would replace the link itself and detach a dotfiles repository silently.
    let directory = tempfile::tempdir().expect("a temp directory");
    let real_directory = directory.path().join("dotfiles");
    fs::create_dir(&real_directory).expect("mkdir");
    let real = real_directory.join("base.yml");
    fs::write(&real, ORIGINAL).expect("write");

    let link_directory = directory.path().join("match");
    fs::create_dir(&link_directory).expect("mkdir");
    let link = link_directory.join("base.yml");
    std::os::unix::fs::symlink(&real, &link).expect("symlink");

    let revision = replace_file_atomically(&link, ContentRevision::of_bytes(ORIGINAL), REPLACEMENT)
        .expect("the write succeeds");

    assert_eq!(revision, ContentRevision::of_bytes(REPLACEMENT));
    assert_eq!(
        fs::read(&real).expect("readable"),
        REPLACEMENT,
        "the real file received the bytes"
    );
    assert!(
        fs::symlink_metadata(&link)
            .expect("the link is still there")
            .file_type()
            .is_symlink(),
        "the symlink is still a symlink"
    );
    assert_eq!(
        fs::read_link(&link).expect("readable link"),
        real,
        "and still points where it pointed"
    );
    assert_eq!(
        entries(&link_directory),
        vec!["base.yml".to_owned()],
        "no temp file was left beside the link"
    );
    assert_eq!(
        entries(&real_directory),
        vec!["base.yml".to_owned()],
        "and none beside the real file"
    );
} // End of function a_symlinked_target_has_its_real_file_written_and_stays_a_symlink()

#[test]
fn a_symlink_and_its_target_are_one_lock_and_one_revision() {
    let directory = tempfile::tempdir().expect("a temp directory");
    let real = directory.path().join("base.yml");
    fs::write(&real, ORIGINAL).expect("write");
    let link = directory.path().join("link.yml");
    std::os::unix::fs::symlink(&real, &link).expect("symlink");

    let lock = lock_path(&link).expect("the link resolves");
    assert_eq!(
        lock.path(),
        fs::canonicalize(&real).expect("canonical"),
        "the lock is keyed by the real file, not by the link"
    );
    assert_eq!(
        lock.requested_path(),
        link,
        "and the caller's own spelling is kept, for the pre-commit re-resolution"
    );

    // A write through the link consumes the revision the *real* file has.
    replace_locked_file(&lock, ContentRevision::of_bytes(ORIGINAL), REPLACEMENT)
        .expect("the write succeeds");
    drop(lock);

    let error = replace_file_atomically(&real, ContentRevision::of_bytes(ORIGINAL), ORIGINAL)
        .expect_err("the old revision is stale for the real path too");
    assert!(matches!(error, WriteError::RevisionMismatch { .. }));
} // End of function a_symlink_and_its_target_are_one_lock_and_one_revision()

// ---------------------------------------------------------------------------
// 9. Concurrency
// ---------------------------------------------------------------------------

#[test]
fn concurrent_writers_from_one_base_leave_exactly_one_writers_bytes() {
    let (directory, target) = fixture(ORIGINAL);
    let base = ContentRevision::of_bytes(ORIGINAL);
    let writers = 8usize;
    let barrier = Arc::new(Barrier::new(writers));

    let payloads: Vec<Vec<u8>> = (0..writers)
        .map(|index| format!("matches:\n  - trigger: ':w{index}'\n").into_bytes())
        .collect();

    let mut handles = Vec::new();
    for payload in payloads.clone() {
        let path = target.clone();
        let gate = Arc::clone(&barrier);
        handles.push(std::thread::spawn(move || {
            gate.wait();
            replace_file_atomically(&path, base, &payload)
        }));
    } // End of the loop that spawns the writers

    let results: Vec<Result<ContentRevision, WriteError>> = handles
        .into_iter()
        .map(|handle| handle.join().expect("a writer thread"))
        .collect();

    let winners = results.iter().filter(|result| result.is_ok()).count();
    assert_eq!(
        winners, 1,
        "exactly one writer may consume one base revision"
    );
    for result in &results {
        match result {
            Ok(_) => {}
            Err(error) => assert!(
                matches!(
                    error,
                    WriteError::RevisionMismatch { .. }
                        | WriteError::TargetChangedDuringWrite { .. }
                ),
                "a loser must get a typed refusal, got {error}"
            ),
        }
    } // End of the loop over the results

    let on_disk = fs::read(&target).expect("readable");
    assert!(
        payloads.contains(&on_disk),
        "the file holds one writer's complete bytes, never a mixture"
    );
    assert_eq!(entries(directory.path()), vec!["base.yml".to_owned()]);
} // End of function concurrent_writers_from_one_base_leave_exactly_one_writers_bytes()

#[test]
fn concurrent_read_modify_write_never_loses_an_update() {
    // The review's point about the previous version of this test was right: a
    // test in which each writer *replaces* the file passes with no mutex at all,
    // because any single winner leaves a complete file.
    //
    // So each writer here **appends** a line it alone writes, under
    // read-then-write-with-retry. A lost update — two writers both passing their
    // checks and both renaming, so one append disappears — is then visible as a
    // missing line, and only serialisation prevents it.
    let (directory, target) = fixture(b"seed\n");
    let writers = 6usize;
    let rounds = 5usize;
    let barrier = Arc::new(Barrier::new(writers));

    let mut handles = Vec::new();
    for index in 0..writers {
        let path = target.clone();
        let gate = Arc::clone(&barrier);
        handles.push(std::thread::spawn(move || {
            gate.wait();
            for round in 0..rounds {
                loop {
                    let current = fs::read(&path).expect("readable");
                    let mut next = current.clone();
                    next.extend_from_slice(format!("w{index}r{round}\n").as_bytes());
                    match replace_file_atomically(&path, ContentRevision::of_bytes(&current), &next)
                    {
                        Ok(_) => break,
                        // The two refusals a loser is *supposed* to get. Both
                        // mean nothing was written, so re-reading and retrying
                        // cannot double-append.
                        Err(WriteError::RevisionMismatch { .. })
                        | Err(WriteError::TargetChangedDuringWrite { .. }) => continue,
                        // Anything else means two writers were inside the
                        // primitive at once: a verification failure or a
                        // post-commit I/O error is only reachable when another
                        // writer replaced the target between this one's commit
                        // and its read-back. They are not retried, because a
                        // committed-then-overwritten append cannot be repeated
                        // without risking a double count — they are the
                        // serialisation failure itself.
                        Err(other) => panic!(
                            "a writer reached {other}, which is only reachable when another \
                             writer interleaved: the per-path lock did not serialise"
                        ),
                    }
                } // End of the retry loop
            } // End of the loop over rounds
        }));
    } // End of the loop that spawns the writers

    for handle in handles {
        handle.join().expect("a writer thread");
    }

    let text = String::from_utf8(fs::read(&target).expect("readable")).expect("utf-8");
    let mut lines: Vec<&str> = text.lines().collect();
    lines.sort_unstable();
    let mut wanted: Vec<String> = vec!["seed".to_owned()];
    for index in 0..writers {
        for round in 0..rounds {
            wanted.push(format!("w{index}r{round}"));
        }
    } // End of the loop that builds the expected line set
    wanted.sort();
    assert_eq!(
        lines,
        wanted,
        "an append was lost: {} lines on disk, {} expected",
        lines.len(),
        wanted.len()
    );
    assert_eq!(entries(directory.path()), vec!["base.yml".to_owned()]);
} // End of function concurrent_read_modify_write_never_loses_an_update()

#[test]
fn two_spellings_of_one_path_contend_on_the_same_lock() {
    // A held lock on one spelling must block a write through the other. The
    // observation is the *negative* one — the writer has not finished while the
    // lock is held — which is the direction that can only be true if the lock is
    // shared.
    //
    // **This is a timing assumption**, and the only one in the binary: 300 ms is
    // assumed to be more than enough for a spawned thread to reach the lock and
    // write 48 bytes, and the assertion fires if it finished. On a machine so
    // loaded that a 48-byte write takes longer than 300 ms this test would pass
    // vacuously rather than fail; there is no way to distinguish "blocked" from
    // "very slow" without a hook inside the lock.
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("base.yml");
    fs::write(&target, ORIGINAL).expect("write");
    fs::create_dir(directory.path().join("sub")).expect("mkdir");
    let other_spelling = directory.path().join("sub").join("..").join("./base.yml");

    let lock = lock_path(&target).expect("the target resolves");

    let finished = Arc::new(AtomicBool::new(false));
    let started = Arc::new(Barrier::new(2));
    let writer_finished = Arc::clone(&finished);
    let writer_started = Arc::clone(&started);
    let writer = std::thread::spawn(move || {
        writer_started.wait();
        let result = replace_file_atomically(
            &other_spelling,
            ContentRevision::of_bytes(ORIGINAL),
            REPLACEMENT,
        );
        writer_finished.store(true, Ordering::SeqCst);
        result
    });

    started.wait();
    std::thread::sleep(Duration::from_millis(300));
    assert!(
        !finished.load(Ordering::SeqCst),
        "a write through `sub/../base.yml` finished while the lock on `base.yml` \
         was held, so the two spellings resolved to two different locks"
    );
    assert_eq!(
        fs::read(&target).expect("readable"),
        ORIGINAL,
        "and nothing was written behind the lock"
    );

    drop(lock);
    let revision = writer
        .join()
        .expect("the writer thread")
        .expect("the write succeeds once the lock is released");
    assert_eq!(revision, ContentRevision::of_bytes(REPLACEMENT));
    assert_eq!(fs::read(&target).expect("readable"), REPLACEMENT);
} // End of function two_spellings_of_one_path_contend_on_the_same_lock()

#[test]
fn a_lock_on_one_file_does_not_block_another() {
    // The complement of the test above: if it did not hold, "the writer had not
    // finished" would be evidence of a global lock rather than a per-path one.
    let directory = tempfile::tempdir().expect("a temp directory");
    let held = directory.path().join("held.yml");
    let free = directory.path().join("free.yml");
    fs::write(&held, ORIGINAL).expect("write");
    fs::write(&free, ORIGINAL).expect("write");

    let lock = lock_path(&held).expect("resolves");
    let revision = replace_file_atomically(&free, ContentRevision::of_bytes(ORIGINAL), REPLACEMENT)
        .expect("another file writes while this one is locked");
    drop(lock);

    assert_eq!(revision, ContentRevision::of_bytes(REPLACEMENT));
    assert_eq!(fs::read(&held).expect("readable"), ORIGINAL);
} // End of function a_lock_on_one_file_does_not_block_another()

// ---------------------------------------------------------------------------
// 10. Byte-exactness through the writer
// ---------------------------------------------------------------------------

/// The committed fixtures whose distinguishing bytes this sweep re-checks.
///
/// **Five** of the fifteen of `CLAUDE.md` section 4, chosen because each one is
/// a byte a careless writer loses: a line ending, a byte-order mark, a final
/// newline, a run of terminal spaces, and a document with no line break at all.
/// Each is **copied** into a temp directory; nothing under `tests/corpus/` is
/// written.
const BYTE_EXACT_FIXTURES: [&str; 5] = [
    "crlf-line-endings.yml",
    "bom-utf8.yml",
    "no-trailing-newline.yml",
    "block-scalar-terminal-spaces.yml",
    "single-line-no-line-ending.yml",
];

/// What the temp copy holds *before* the fixture's own bytes are written to it.
///
/// The point of the sweep is that the distinguishing bytes travel **through the
/// writer**. Seeding the copy with the fixture's own bytes — which the first
/// version of this test did — makes a writer that does nothing at all pass, so
/// the copy starts as a short ASCII placeholder with no BOM, LF endings and a
/// final newline: the opposite of every property under test.
const PLACEHOLDER: &[u8] = b"placeholder\n";

#[test]
fn a_byte_exact_fixture_survives_a_round_trip_through_the_writer() {
    for name in BYTE_EXACT_FIXTURES {
        let source = corpus_root().join("synthetic").join(name);
        let bytes = fs::read(&source)
            .unwrap_or_else(|error| panic!("cannot read the fixture {name}: {error}"));
        assert_ne!(
            bytes, PLACEHOLDER,
            "{name} happens to equal the placeholder, so this sweep would be a no-op"
        );

        let directory = tempfile::tempdir().expect("a temp directory");
        let target = directory.path().join(name);
        fs::write(&target, PLACEHOLDER).expect("the placeholder is written");

        let revision =
            replace_file_atomically(&target, ContentRevision::of_bytes(PLACEHOLDER), &bytes)
                .unwrap_or_else(|error| panic!("{name} could not be written: {error}"));

        let after = fs::read(&target).expect("readable");
        assert_eq!(
            after, bytes,
            "{name} did not survive the writer byte for byte"
        );
        assert_eq!(revision, ContentRevision::of_bytes(&bytes));
        assert_eq!(
            entries(directory.path()),
            vec![name.to_owned()],
            "{name} left a temp file behind"
        );
    } // End of the loop over the byte-exact fixtures
} // End of function a_byte_exact_fixture_survives_a_round_trip_through_the_writer()

#[test]
fn the_named_bytes_are_actually_in_the_fixtures_this_sweep_uses() {
    // A round trip of bytes that do not contain the hazard proves nothing, so
    // the distinguishing bytes are asserted present before the sweep is trusted.
    let crlf = fs::read(
        corpus_root()
            .join("synthetic")
            .join("crlf-line-endings.yml"),
    )
    .expect("the CRLF fixture");
    assert!(
        crlf.windows(2).any(|pair| pair == b"\r\n"),
        "the CRLF fixture has no CRLF in it"
    );

    let bom =
        fs::read(corpus_root().join("synthetic").join("bom-utf8.yml")).expect("the BOM fixture");
    assert_eq!(&bom[..3], &[0xef, 0xbb, 0xbf], "the BOM fixture has no BOM");

    let bare = fs::read(
        corpus_root()
            .join("synthetic")
            .join("no-trailing-newline.yml"),
    )
    .expect("the no-final-newline fixture");
    assert_ne!(
        bare.last(),
        Some(&b'\n'),
        "the no-final-newline fixture ends in a newline"
    );

    let spaces = fs::read(
        corpus_root()
            .join("synthetic")
            .join("block-scalar-terminal-spaces.yml"),
    )
    .expect("the terminal-spaces fixture");
    assert!(
        spaces.ends_with(b"  "),
        "the terminal-spaces fixture does not end in two spaces"
    );

    let single = fs::read(
        corpus_root()
            .join("synthetic")
            .join("single-line-no-line-ending.yml"),
    )
    .expect("the single-line fixture");
    assert!(
        !single.contains(&b'\n'),
        "the single-line fixture has a line break in it"
    );

    // And the placeholder must contradict all five, or seeding with it proves
    // nothing.
    assert!(!PLACEHOLDER.windows(2).any(|pair| pair == b"\r\n"));
    assert_ne!(&PLACEHOLDER[..3], &[0xef, 0xbb, 0xbf]);
    assert_eq!(PLACEHOLDER.last(), Some(&b'\n'));
    assert!(PLACEHOLDER.contains(&b'\n'));
} // End of function the_named_bytes_are_actually_in_the_fixtures_this_sweep_uses()

// ---------------------------------------------------------------------------
// The step marker
// ---------------------------------------------------------------------------

#[test]
fn a_caller_can_tell_the_steps_apart_without_reading_a_sentence() {
    // Declared in the order they execute, which is **not** the order the plan
    // numbers them: step 8 (the bytes and their fsync) runs before step 7 (the
    // metadata and the mode bits), so the candidate is only widened from 0o600
    // once it is complete.
    let steps = [
        WriteStep::ResolveTarget,
        WriteStep::InspectTarget,
        WriteStep::ReadTarget,
        WriteStep::CreateTempFile,
        WriteStep::WriteTempFile,
        WriteStep::SyncTempFile,
        WriteStep::CopyMetadata,
        WriteStep::ApplyModeBits,
        WriteStep::VerifyTempIdentity,
        WriteStep::RecheckTarget,
        WriteStep::Rename,
        WriteStep::SyncDirectory,
        WriteStep::ReadBack,
    ];
    let codes: std::collections::BTreeSet<&str> = steps.iter().map(|step| step.code()).collect();
    assert_eq!(codes.len(), steps.len(), "two steps share a code");
    assert_eq!(
        steps.iter().filter(|step| step.after_rename()).count(),
        2,
        "only the directory sync and the read-back happen after the commit"
    );
} // End of function a_caller_can_tell_the_steps_apart_without_reading_a_sentence()
