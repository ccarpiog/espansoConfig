//! The sidecar store's tests: storage confinement (symlinks included), the
//! corruption outcomes, interrupted replacement, the cross-process lock, the
//! two-instance race and the orphan policy.
//!
//! Every tree here is a temporary directory holding synthetic, neutral files
//! (CLAUDE.md section 1). Time is an argument; no test sleeps or reads a clock.

use std::cell::Cell;
use std::fs;
use std::io;
use std::os::unix::fs::PermissionsExt as _;
use std::path::{Path, PathBuf};

use tempfile::TempDir;

use super::format::{render, FileEntry, SidecarFile};
use super::store::{lock_is_held, no_probe, Step, LOCK_FILE};
use super::*;

/// An arbitrary, fixed "now": 2026-01-01T00:00:00Z.
const T0: u64 = 1_767_225_600;

/// One day, in seconds.
const DAY: u64 = 24 * 60 * 60;

/// A storage root and a two-file synthetic workspace, both temporary.
struct Fixture {
    /// The application storage root.
    storage: TempDir,
    /// The workspace directory.
    workspace: TempDir,
    /// The workspace as the sidecar sees it.
    files: WorkspaceFiles,
}

impl Fixture {
    /// A fresh storage root and a workspace listing `match/base.yml` (1) and
    /// `match/other.yml` (2).
    fn new() -> Fixture {
        let storage = TempDir::new().expect("a storage root");
        let workspace = TempDir::new().expect("a workspace");
        fs::create_dir_all(workspace.path().join("match")).unwrap();
        fs::write(
            workspace.path().join("match/base.yml"),
            "matches:\n  - trigger: ':a'\n    replace: a\n",
        )
        .unwrap();
        fs::write(workspace.path().join("match/other.yml"), "matches: []\n").unwrap();
        let files = WorkspaceFiles {
            root: workspace.path().to_path_buf(),
            files: vec![
                (DocumentId(1), PathBuf::from("match/base.yml")),
                (DocumentId(2), PathBuf::from("match/other.yml")),
            ],
        };
        Fixture {
            storage,
            workspace,
            files,
        }
    } // End of function new()

    /// A store over this fixture's storage root — one "instance".
    fn store(&self) -> SidecarStore {
        SidecarStore::new(self.storage.path().to_path_buf())
    }

    /// The directory the sidecar files live in.
    fn directory(&self) -> PathBuf {
        self.storage.path().join("workspaces")
    }

    /// This workspace's key.
    fn key(&self) -> WorkspaceKey {
        WorkspaceKey::of_canonical_root(&fs::canonicalize(self.workspace.path()).unwrap())
    }

    /// This workspace's sidecar file.
    fn sidecar(&self) -> PathBuf {
        self.directory().join(self.key().file_name())
    }

    /// Loads with no failure injected.
    fn load(&self, now: u64) -> SidecarState {
        load_with(Some(&self.store()), &self.files, now, &mut no_probe)
    }

    /// Applies `changes` to document `document` with no failure injected.
    fn update(&self, document: u64, changes: Vec<SidecarChange>, now: u64) -> SidecarUpdateResult {
        update_with(
            Some(&self.store()),
            &self.files,
            &request(document, changes),
            now,
            &mut no_probe,
        )
        .expect("a listed document")
    }
} // End of impl Fixture

/// A request for `document`.
fn request(document: u64, changes: Vec<SidecarChange>) -> SidecarUpdateRequest {
    SidecarUpdateRequest {
        document: DocumentId(document),
        changes,
    }
}

/// A change that sets a display name.
fn name(text: &str) -> SidecarChange {
    SidecarChange::SetDisplayName {
        name: text.to_owned(),
    }
}

/// The display name the state holds for `document`, if any.
fn name_of(state: &SidecarState, document: u64) -> Option<String> {
    state
        .files
        .iter()
        .find(|file| file.document == DocumentId(document))
        .and_then(|file| file.display_name.clone())
}

/// Every file under `root`, with its bytes, in path order.
fn snapshot(root: &Path) -> Vec<(PathBuf, Vec<u8>)> {
    let mut found = Vec::new();
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(&directory).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                pending.push(path);
            } else {
                let bytes = fs::read(&path).unwrap();
                found.push((path, bytes));
            }
        }
    } // End of the walk over the tree
    found.sort();
    found
} // End of function snapshot()

/// The names in the sidecar directory, sorted, **leaving out the lock file**,
/// which every opened directory holds (`store::LOCK_FILE`).
fn names_in(directory: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(directory)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|name| name != LOCK_FILE)
        .collect();
    names.sort();
    names
}

/// Sets a Unix mode on `path`.
fn chmod(path: &Path, mode: u32) {
    fs::set_permissions(path, fs::Permissions::from_mode(mode)).unwrap();
}

// ---------------------------------------------------------------------------
// Confinement: every write under app storage, and no destination path
// ---------------------------------------------------------------------------

#[test]
fn every_write_stays_under_app_storage_and_no_espanso_file_changes() {
    let fixture = Fixture::new();
    let before = snapshot(fixture.workspace.path());
    assert_eq!(fixture.load(T0).status, SidecarStatus::Fresh {});
    assert!(
        !fixture.storage.path().join("workspaces").exists(),
        "a load of nothing creates nothing"
    );
    let saved = fixture.update(1, vec![name("Everyday")], T0);
    assert_eq!(saved.outcome, SidecarUpdateOutcome::Saved {});
    assert_eq!(name_of(&saved.state, 1).as_deref(), Some("Everyday"));
    assert_eq!(fixture.load(T0).status, SidecarStatus::Loaded {});
    fs::write(fixture.sidecar(), b"{ not json").unwrap();
    let quarantined = fixture.load(T0);
    assert!(matches!(
        quarantined.status,
        SidecarStatus::Quarantined { .. }
    ));
    fixture.update(2, vec![SidecarChange::SetSortOrder { order: 4 }], T0);

    // Every file the store ever made is directly inside <storage>/workspaces.
    for (path, _) in snapshot(fixture.storage.path()) {
        assert_eq!(
            path.parent(),
            Some(fixture.directory().as_path()),
            "{} is outside the sidecar directory",
            path.display()
        );
    }
    assert_eq!(
        names_in(&fixture.directory()).len(),
        2,
        "the sidecar and one aside"
    );

    // Deleting the sidecar loses the preferences and changes no espanso file.
    fs::remove_file(fixture.sidecar()).unwrap();
    let after_delete = fixture.load(T0);
    assert_eq!(after_delete.status, SidecarStatus::Fresh {});
    assert!(after_delete.files.is_empty());
    assert_eq!(
        snapshot(fixture.workspace.path()),
        before,
        "no byte of the workspace changed"
    );
} // End of function every_write_stays_under_app_storage_and_no_espanso_file_changes()

/// The writer's methods take a key, bytes, a time and a probe — never a path.
///
/// Read out of the source with `syn`, so a parameter added later is seen. It
/// checks the one module that writes: `sidecar.rs` itself calls no writing
/// filesystem function, which the second half asserts over its parsed tokens.
#[test]
fn the_writer_accepts_no_destination_path() {
    let root = crate::prose_sweep::workspace_root();
    let store = fs::read_to_string(root.join("src-tauri/src/sidecar/store.rs")).unwrap();
    let file = syn::parse_file(&store).expect("store.rs parses");
    let mut methods = 0usize;
    for item in &file.items {
        let syn::Item::Impl(block) = item else {
            continue;
        };
        for member in &block.items {
            let syn::ImplItem::Fn(method) = member else {
                continue;
            };
            let name = method.sig.ident.to_string();
            if name == "new" {
                continue; // The storage root, fixed once, is the constructor's.
            }
            methods += 1;
            for input in &method.sig.inputs {
                let spelled = quote_tokens(input);
                for forbidden in [
                    "Path",
                    "PathBuf",
                    "OsStr",
                    "OsString",
                    "str",
                    "String",
                    "UnreadType",
                ] {
                    assert!(
                        !spelled
                            .split(|c: char| !c.is_alphanumeric())
                            .any(|word| word == forbidden),
                        "SidecarStore::{name} takes `{spelled}`, which could name a destination"
                    );
                }
            }
        } // End of the loop over the impl's members
    } // End of the loop over store.rs's items
    assert!(
        methods >= 4,
        "open, read, quarantine, replace and verify were examined"
    );

    let orchestration = fs::read_to_string(root.join("src-tauri/src/sidecar.rs")).unwrap();
    for writer in [
        "fs::write",
        "fs::rename",
        "create_dir",
        "OpenOptions",
        "remove_file",
        "File::create",
    ] {
        assert!(
            !orchestration.contains(writer),
            "sidecar.rs calls {writer}; only store.rs may write"
        );
    }
} // End of function the_writer_accepts_no_destination_path()

/// Every identifier named in one function parameter's type, in order; empty
/// for `self`.
fn quote_tokens(input: &syn::FnArg) -> String {
    let mut idents = Vec::new();
    if let syn::FnArg::Typed(typed) = input {
        type_idents(&typed.ty, &mut idents);
    }
    idents.join(" ")
}

/// Appends every identifier `ty` names, generic arguments included.
fn type_idents(ty: &syn::Type, out: &mut Vec<String>) {
    match ty {
        syn::Type::Reference(reference) => type_idents(&reference.elem, out),
        syn::Type::Slice(slice) => type_idents(&slice.elem, out),
        syn::Type::Array(array) => type_idents(&array.elem, out),
        syn::Type::Paren(paren) => type_idents(&paren.elem, out),
        syn::Type::Ptr(pointer) => type_idents(&pointer.elem, out),
        syn::Type::Tuple(tuple) => tuple.elems.iter().for_each(|elem| type_idents(elem, out)),
        syn::Type::Path(path) => path_idents(&path.path, out),
        syn::Type::TraitObject(object) => bound_idents(object.bounds.iter(), out),
        syn::Type::ImplTrait(implemented) => bound_idents(implemented.bounds.iter(), out),
        // Any other type form is one this check cannot read, so it fails
        // loudly rather than passing a type it did not look inside.
        _ => out.push("UnreadType".to_owned()),
    }
} // End of function type_idents()

/// Appends the identifiers of trait bounds.
fn bound_idents<'a>(bounds: impl Iterator<Item = &'a syn::TypeParamBound>, out: &mut Vec<String>) {
    for bound in bounds {
        if let syn::TypeParamBound::Trait(trait_bound) = bound {
            path_idents(&trait_bound.path, out);
        }
    }
}

/// Appends a path's segment identifiers and those of its generic arguments.
fn path_idents(path: &syn::Path, out: &mut Vec<String>) {
    for segment in &path.segments {
        out.push(segment.ident.to_string());
        match &segment.arguments {
            syn::PathArguments::AngleBracketed(arguments) => {
                for argument in &arguments.args {
                    if let syn::GenericArgument::Type(inner) = argument {
                        type_idents(inner, out);
                    }
                }
            }
            syn::PathArguments::Parenthesized(arguments) => {
                arguments
                    .inputs
                    .iter()
                    .for_each(|input| type_idents(input, out));
                if let syn::ReturnType::Type(_, output) = &arguments.output {
                    type_idents(output, out);
                }
            }
            syn::PathArguments::None => {}
        }
    } // End of the loop over the path's segments
} // End of function path_idents()

// ---------------------------------------------------------------------------
// The corruption outcomes
// ---------------------------------------------------------------------------

#[test]
fn a_corrupt_sidecar_is_quarantined_and_reported_only_after_the_rename() {
    let fixture = Fixture::new();
    fixture.update(1, vec![name("Everyday")], T0);
    fs::write(fixture.sidecar(), b"\x00\x01 garbage").unwrap();
    let seen = Cell::new(false);
    let mut probe = |step: Step| {
        if step == Step::Quarantine {
            seen.set(true);
        }
        Ok(())
    };
    let state = load_with(Some(&fixture.store()), &fixture.files, T0, &mut probe);
    assert!(seen.get(), "the rename was attempted");
    let SidecarStatus::Quarantined { aside } = &state.status else {
        panic!("expected a quarantine: {state:?}");
    };
    assert!(state.writable && state.files.is_empty());
    assert!(aside.starts_with(&format!("{}.corrupt-{T0}-", fixture.key().digest())));
    assert_eq!(
        fs::read(fixture.directory().join(aside)).unwrap(),
        b"\x00\x01 garbage",
        "the aside file is the corrupt bytes, whole"
    );
    assert!(!fixture.sidecar().exists(), "the name is free again");
    assert_eq!(fixture.load(T0).status, SidecarStatus::Fresh {});
} // End of function a_corrupt_sidecar_is_quarantined_and_reported_only_after_the_rename()

#[test]
fn a_failed_quarantine_leaves_the_bytes_intact_and_says_so() {
    let fixture = Fixture::new();
    fixture.update(1, vec![name("Everyday")], T0);
    let corrupt = b"{\"schemaVersion\": 1, \"root\": 7}".to_vec();
    fs::write(fixture.sidecar(), &corrupt).unwrap();

    // A real refusal: the directory is read-only, so the rename fails.
    chmod(&fixture.directory(), 0o555);
    let state = fixture.load(T0);
    let refused = fixture.update(1, vec![name("Other")], T0);
    chmod(&fixture.directory(), 0o755);
    assert_eq!(state.status, SidecarStatus::QuarantineFailed {});
    assert!(
        !state.writable && state.files.is_empty(),
        "in-memory defaults"
    );
    assert_eq!(refused.outcome, SidecarUpdateOutcome::NotWritable {});
    assert_eq!(refused.state.status, SidecarStatus::QuarantineFailed {});
    assert_eq!(
        fs::read(fixture.sidecar()).unwrap(),
        corrupt,
        "bytes intact"
    );
    assert_eq!(
        names_in(&fixture.directory()),
        vec![fixture.key().file_name()],
        "nothing renamed, nothing written beside it"
    );

    // The same outcome through an injected failure, independent of the
    // permissions the test runs with.
    let mut failing = |step: Step| match step {
        Step::Quarantine => Err(io::Error::from(io::ErrorKind::PermissionDenied)),
        _ => Ok(()),
    };
    let injected = update_with(
        Some(&fixture.store()),
        &fixture.files,
        &request(1, vec![name("Other")]),
        T0,
        &mut failing,
    )
    .unwrap();
    assert_eq!(injected.outcome, SidecarUpdateOutcome::NotWritable {});
    assert_eq!(fs::read(fixture.sidecar()).unwrap(), corrupt);

    // Once the rename can happen, it does, and saving works again.
    let recovered = fixture.update(1, vec![name("Other")], T0);
    assert!(matches!(
        recovered.state.status,
        SidecarStatus::Quarantined { .. }
    ));
    assert_eq!(recovered.outcome, SidecarUpdateOutcome::Saved {});
} // End of function a_failed_quarantine_leaves_the_bytes_intact_and_says_so()

#[test]
fn a_future_schema_is_retained_and_never_rewritten() {
    let fixture = Fixture::new();
    fs::create_dir_all(fixture.directory()).unwrap();
    let future = b"{\"schemaVersion\": 2, \"somethingNew\": [1, 2, 3]}\n".to_vec();
    fs::write(fixture.sidecar(), &future).unwrap();
    let state = fixture.load(T0);
    assert_eq!(
        state.status,
        SidecarStatus::FutureSchema {
            version: "2".to_owned()
        }
    );
    assert!(!state.writable && state.files.is_empty());
    let refused = fixture.update(1, vec![name("Everyday")], T0);
    assert_eq!(refused.outcome, SidecarUpdateOutcome::NotWritable {});
    assert_eq!(
        fs::read(fixture.sidecar()).unwrap(),
        future,
        "not rewritten"
    );
    assert_eq!(
        names_in(&fixture.directory()),
        vec![fixture.key().file_name()],
        "not renamed aside either"
    );
} // End of function a_future_schema_is_retained_and_never_rewritten()

#[test]
fn an_unreadable_sidecar_is_left_untouched_and_refuses_writes() {
    let fixture = Fixture::new();
    fixture.update(1, vec![name("Everyday")], T0);
    let bytes = fs::read(fixture.sidecar()).unwrap();
    chmod(&fixture.sidecar(), 0o000);
    let state = fixture.load(T0);
    let refused = fixture.update(1, vec![name("Other")], T0);
    chmod(&fixture.sidecar(), 0o600);
    assert_eq!(state.status, SidecarStatus::Unreadable {});
    assert_eq!(refused.outcome, SidecarUpdateOutcome::NotWritable {});
    assert_eq!(fs::read(fixture.sidecar()).unwrap(), bytes);
}

#[test]
fn a_quarantine_that_finds_the_file_gone_reads_again() {
    let fixture = Fixture::new();
    fs::create_dir_all(fixture.directory()).unwrap();
    fs::write(fixture.sidecar(), b"corrupt").unwrap();
    let sidecar = fixture.sidecar();
    // Another instance quarantines it first, between this one's read and its
    // rename.
    let mut probe = |step: Step| {
        if step == Step::Quarantine {
            fs::remove_file(&sidecar)?;
        }
        Ok(())
    };
    let state = load_with(Some(&fixture.store()), &fixture.files, T0, &mut probe);
    assert_eq!(state.status, SidecarStatus::Fresh {});
}

#[test]
fn no_storage_root_or_no_workspace_root_reads_and_writes_nothing() {
    let fixture = Fixture::new();
    let unavailable = load_with(None, &fixture.files, T0, &mut no_probe);
    assert_eq!(unavailable.status, SidecarStatus::StorageUnavailable {});
    let refused = update_with(
        None,
        &fixture.files,
        &request(1, vec![name("A")]),
        T0,
        &mut no_probe,
    )
    .unwrap();
    assert_eq!(refused.outcome, SidecarUpdateOutcome::NotWritable {});

    let gone = WorkspaceFiles {
        root: fixture.workspace.path().join("does-not-exist"),
        files: fixture.files.files.clone(),
    };
    let unresolved = load_with(Some(&fixture.store()), &gone, T0, &mut no_probe);
    assert_eq!(unresolved.status, SidecarStatus::RootUnresolved {});
    assert!(!unresolved.writable);
    assert!(fs::read_dir(fixture.storage.path())
        .unwrap()
        .next()
        .is_none());
}

#[test]
fn an_unknown_document_is_refused_before_anything_is_read() {
    let fixture = Fixture::new();
    let error = update_with(
        Some(&fixture.store()),
        &fixture.files,
        &request(99, vec![name("A")]),
        T0,
        &mut no_probe,
    )
    .expect_err("document 99 is not listed");
    assert!(matches!(
        error,
        CommandError::UnknownDocument { document: 99 }
    ));
    assert!(!fixture.directory().exists());
}

// ---------------------------------------------------------------------------
// Atomic replacement
// ---------------------------------------------------------------------------

#[test]
fn an_interrupted_replacement_leaves_the_old_or_the_new_state_valid() {
    // Before the rename: the old state stands, and no temporary file is left.
    for failing_step in [
        Step::CreateTemp,
        Step::WriteTemp,
        Step::SyncTemp,
        Step::Rename,
    ] {
        let fixture = Fixture::new();
        fixture.update(1, vec![name("Old")], T0);
        let old = fs::read(fixture.sidecar()).unwrap();
        let mut probe = |step: Step| {
            if step == failing_step {
                Err(io::Error::other("interrupted"))
            } else {
                Ok(())
            }
        };
        let result = update_with(
            Some(&fixture.store()),
            &fixture.files,
            &request(1, vec![name("New")]),
            T0,
            &mut probe,
        )
        .unwrap();
        assert_eq!(
            result.outcome,
            SidecarUpdateOutcome::WriteFailed {},
            "{failing_step:?}"
        );
        assert_eq!(name_of(&result.state, 1).as_deref(), Some("Old"));
        assert_eq!(
            fs::read(fixture.sidecar()).unwrap(),
            old,
            "{failing_step:?}"
        );
        assert_eq!(name_of(&fixture.load(T0), 1).as_deref(), Some("Old"));
        assert_eq!(
            names_in(&fixture.directory()),
            vec![fixture.key().file_name()],
            "{failing_step:?} left no temporary file behind"
        );
    } // End of the loop over the steps before the rename

    // After the rename: the directory sync failing is not a failed write.
    let fixture = Fixture::new();
    fixture.update(1, vec![name("Old")], T0);
    let sidecar = fixture.sidecar();
    let mut after_rename = |step: Step| {
        if step == Step::SyncDirectory {
            let on_disk = fs::read(&sidecar)?;
            assert!(String::from_utf8_lossy(&on_disk).contains("\"New\""));
            return Err(io::Error::other("interrupted"));
        }
        Ok(())
    };
    let result = update_with(
        Some(&fixture.store()),
        &fixture.files,
        &request(1, vec![name("New")]),
        T0,
        &mut after_rename,
    )
    .unwrap();
    assert_eq!(result.outcome, SidecarUpdateOutcome::Saved {});
    assert_eq!(name_of(&fixture.load(T0), 1).as_deref(), Some("New"));

    // A crash mid-write: a partial temporary file beside the sidecar is never
    // read, and the target still holds a whole, valid file at every instant
    // before the rename.
    let target = fixture.sidecar();
    let temporary = fixture
        .directory()
        .join(format!("{}.tmp-1-1", fixture.key().file_name()));
    fs::write(&temporary, b"{\"schemaVersion\": 1, \"ro").unwrap();
    let mut at_rename = |step: Step| {
        if step == Step::Rename {
            let whole = fs::read(&target)?;
            assert!(String::from_utf8_lossy(&whole).contains("\"New\""));
        }
        Ok(())
    };
    let later = update_with(
        Some(&fixture.store()),
        &fixture.files,
        &request(1, vec![name("Newer")]),
        T0,
        &mut at_rename,
    )
    .unwrap();
    assert_eq!(later.outcome, SidecarUpdateOutcome::Saved {});
    assert_eq!(later.state.status, SidecarStatus::Loaded {});
    assert_eq!(name_of(&fixture.load(T0), 1).as_deref(), Some("Newer"));
} // End of function an_interrupted_replacement_leaves_the_old_or_the_new_state_valid()

// ---------------------------------------------------------------------------
// Concurrency: the cross-process lock, the future-schema re-check, last write
// wins
// ---------------------------------------------------------------------------

/// Two store handles over one storage root stand for two application
/// instances: each opens its own lock file description, and `flock(2)` locks
/// conflict between descriptions within one process exactly as across
/// processes, which `lock_is_held` observes inside the first one's update.
#[test]
fn a_two_instance_race_is_serialized_and_last_write_wins() {
    let fixture = Fixture::new();
    let first = fixture.store();
    let second = fixture.store();

    // In sequence, each reloads first, so neither loses the other's change.
    update_with(
        Some(&first),
        &fixture.files,
        &request(1, vec![name("From first")]),
        T0,
        &mut no_probe,
    )
    .unwrap();
    update_with(
        Some(&second),
        &fixture.files,
        &request(2, vec![name("From second")]),
        T0,
        &mut no_probe,
    )
    .unwrap();
    let both = fixture.load(T0);
    assert_eq!(name_of(&both, 1).as_deref(), Some("From first"));
    assert_eq!(name_of(&both, 2).as_deref(), Some("From second"));
    assert!(
        !lock_is_held(fixture.storage.path()),
        "released after each update"
    );

    // Overlapping: the second instance starts while the first holds the lock,
    // between the first's read and its write. It waits, then reloads what the
    // first wrote, so both changes are kept.
    let storage = fixture.storage.path().to_path_buf();
    let files = fixture.files.clone();
    let mut racing = None;
    let mut interleave = |step: Step| {
        if step == Step::CreateTemp && racing.is_none() {
            assert!(lock_is_held(&storage), "the first holds the lock");
            let (second, files) = (second.clone(), files.clone());
            racing = Some(std::thread::spawn(move || {
                update_with(
                    Some(&second),
                    &files,
                    &request(2, vec![name("Second, racing")]),
                    T0,
                    &mut no_probe,
                )
                .unwrap()
            }));
        }
        Ok(())
    };
    let outer = update_with(
        Some(&first),
        &fixture.files,
        &request(1, vec![name("First, racing")]),
        T0,
        &mut interleave,
    )
    .unwrap();
    let inner = racing.expect("the second instance started").join().unwrap();
    assert_eq!(outer.outcome, SidecarUpdateOutcome::Saved {});
    assert_eq!(inner.outcome, SidecarUpdateOutcome::Saved {});
    assert_eq!(
        name_of(&inner.state, 1).as_deref(),
        Some("First, racing"),
        "the second read after the first had written"
    );
    let kept = fixture.load(T0);
    assert_eq!(name_of(&kept, 1).as_deref(), Some("First, racing"));
    assert_eq!(name_of(&kept, 2).as_deref(), Some("Second, racing"));

    // One field set by both: the update that takes the lock second wins, and
    // the other instance is not told.
    let earlier = update_with(
        Some(&first),
        &fixture.files,
        &request(1, vec![name("First's name")]),
        T0,
        &mut no_probe,
    )
    .unwrap();
    update_with(
        Some(&second),
        &fixture.files,
        &request(1, vec![name("Second's name")]),
        T0,
        &mut no_probe,
    )
    .unwrap();
    assert_eq!(earlier.outcome, SidecarUpdateOutcome::Saved {});
    assert_eq!(
        name_of(&fixture.load(T0), 1).as_deref(),
        Some("Second's name")
    );
} // End of function a_two_instance_race_is_serialized_and_last_write_wins()

/// The lock is held at every disk step of an update, a quarantine and a
/// load's orphan-mark write, and released when each returns.
#[test]
fn the_lock_is_held_from_the_reload_to_the_last_write() {
    let fixture = Fixture::new();
    fixture.update(1, vec![name("Everyday")], T0);
    let storage = fixture.storage.path().to_path_buf();
    let steps = std::cell::RefCell::new(Vec::new());
    let mut observe = |step: Step| {
        assert!(lock_is_held(&storage), "{step:?} ran without the lock");
        steps.borrow_mut().push(step);
        Ok(())
    };

    // An update: every replacement step.
    let saved = update_with(
        Some(&fixture.store()),
        &fixture.files,
        &request(1, vec![name("Other")]),
        T0,
        &mut observe,
    )
    .unwrap();
    assert_eq!(saved.outcome, SidecarUpdateOutcome::Saved {});

    // A quarantine, then the update's write after it.
    fs::write(fixture.sidecar(), b"corrupt").unwrap();
    let recovered = update_with(
        Some(&fixture.store()),
        &fixture.files,
        &request(1, vec![name("Again")]),
        T0,
        &mut observe,
    )
    .unwrap();
    assert!(matches!(
        recovered.state.status,
        SidecarStatus::Quarantined { .. }
    ));

    // A load whose orphan marks change: its best-effort write.
    let orphaning = WorkspaceFiles {
        root: fixture.files.root.clone(),
        files: vec![(DocumentId(2), PathBuf::from("match/other.yml"))],
    };
    let loaded = load_with(Some(&fixture.store()), &orphaning, T0, &mut observe);
    assert_eq!(loaded.retained_orphans, 1);
    assert!(
        String::from_utf8_lossy(&fs::read(fixture.sidecar()).unwrap()).contains("orphanedSince")
    );

    let seen = steps.into_inner();
    for step in [
        Step::Quarantine,
        Step::CreateTemp,
        Step::WriteTemp,
        Step::SyncTemp,
        Step::Rename,
        Step::SyncDirectory,
    ] {
        assert!(seen.contains(&step), "{step:?} was observed");
    }
    assert_eq!(seen.iter().filter(|step| **step == Step::Rename).count(), 3);
    assert!(!lock_is_held(&storage), "released after the load");
} // End of function the_lock_is_held_from_the_reload_to_the_last_write()

/// A newer build's file that lands after an instance's read — by a writer
/// that ignored the lock, simulated inside the probe — is kept: the update is
/// refused at the re-check before its rename, a load's orphan-mark write is
/// dropped, and a quarantine re-reads and reports the future schema instead.
#[test]
fn a_future_schema_written_between_read_and_replace_is_retained() {
    let future = b"{\"schemaVersion\": 2, \"somethingNew\": true}\n".to_vec();

    // An update.
    let fixture = Fixture::new();
    fixture.update(1, vec![name("Everyday")], T0);
    let sidecar = fixture.sidecar();
    let mut newer_lands = |step: Step| {
        if step == Step::Rename {
            fs::write(&sidecar, &future)?;
        }
        Ok(())
    };
    let refused = update_with(
        Some(&fixture.store()),
        &fixture.files,
        &request(1, vec![name("Other")]),
        T0,
        &mut newer_lands,
    )
    .unwrap();
    assert_eq!(refused.outcome, SidecarUpdateOutcome::NotWritable {});
    assert_eq!(
        refused.state.status,
        SidecarStatus::FutureSchema {
            version: "2".to_owned()
        }
    );
    assert!(!refused.state.writable && refused.state.files.is_empty());
    assert_eq!(fs::read(&sidecar).unwrap(), future, "not overwritten");
    assert_eq!(
        names_in(&fixture.directory()),
        vec![fixture.key().file_name()],
        "no temporary file left, nothing set aside"
    );

    // A load's orphan-mark write.
    let fixture = Fixture::new();
    fixture.update(1, vec![name("Everyday")], T0);
    let sidecar = fixture.sidecar();
    let mut newer_lands = |step: Step| {
        if step == Step::Rename {
            fs::write(&sidecar, &future)?;
        }
        Ok(())
    };
    let orphaning = WorkspaceFiles {
        root: fixture.files.root.clone(),
        files: vec![(DocumentId(2), PathBuf::from("match/other.yml"))],
    };
    load_with(Some(&fixture.store()), &orphaning, T0, &mut newer_lands);
    assert_eq!(
        fs::read(&sidecar).unwrap(),
        future,
        "marks not written over it"
    );

    // A quarantine.
    let fixture = Fixture::new();
    fs::create_dir_all(fixture.directory()).unwrap();
    fs::write(fixture.sidecar(), b"corrupt").unwrap();
    let sidecar = fixture.sidecar();
    let mut newer_lands = |step: Step| {
        if step == Step::Quarantine {
            fs::write(&sidecar, &future)?;
        }
        Ok(())
    };
    let state = load_with(Some(&fixture.store()), &fixture.files, T0, &mut newer_lands);
    assert_eq!(
        state.status,
        SidecarStatus::FutureSchema {
            version: "2".to_owned()
        }
    );
    assert_eq!(fs::read(&sidecar).unwrap(), future, "not set aside");
    assert_eq!(
        names_in(&fixture.directory()),
        vec![fixture.key().file_name()]
    );
} // End of function a_future_schema_written_between_read_and_replace_is_retained()

// ---------------------------------------------------------------------------
// Confinement: symlinks below the storage root are refused
// ---------------------------------------------------------------------------

/// `workspaces` a symlink to a directory outside storage: every load and
/// update is refused as `StorageUnavailable`, and nothing lands outside.
#[test]
fn a_symlinked_storage_directory_is_refused_and_nothing_is_written_outside() {
    let fixture = Fixture::new();
    let outside = TempDir::new().expect("a directory outside storage");
    std::os::unix::fs::symlink(outside.path(), fixture.directory()).unwrap();

    let loaded = fixture.load(T0);
    assert_eq!(loaded.status, SidecarStatus::StorageUnavailable {});
    assert!(!loaded.writable);
    let refused = fixture.update(1, vec![name("Everyday")], T0);
    assert_eq!(refused.outcome, SidecarUpdateOutcome::NotWritable {});
    assert_eq!(refused.state.status, SidecarStatus::StorageUnavailable {});
    assert!(
        fs::read_dir(outside.path()).unwrap().next().is_none(),
        "nothing was created in the directory the link points at"
    );
    assert!(fs::symlink_metadata(fixture.directory())
        .unwrap()
        .file_type()
        .is_symlink());
} // End of function a_symlinked_storage_directory_is_refused_and_nothing_is_written_outside()

/// The lock file or the sidecar file a symlink, or the directory swapped for
/// a symlink between the open and the write: each is refused, and the file
/// outside keeps its bytes (or is never created).
#[test]
fn a_symlinked_lock_file_sidecar_file_or_swapped_directory_is_refused() {
    let outside = TempDir::new().expect("a directory outside storage");

    // The lock file, dangling: following it would create the target.
    let fixture = Fixture::new();
    fs::create_dir_all(fixture.directory()).unwrap();
    let target = outside.path().join("created-through-the-lock");
    std::os::unix::fs::symlink(&target, fixture.directory().join(LOCK_FILE)).unwrap();
    let refused = fixture.update(1, vec![name("Everyday")], T0);
    assert_eq!(refused.outcome, SidecarUpdateOutcome::NotWritable {});
    assert_eq!(refused.state.status, SidecarStatus::StorageUnavailable {});
    assert!(fs::symlink_metadata(&target).is_err(), "never created");

    // The sidecar file, pointing at a valid-looking file outside.
    let fixture = Fixture::new();
    fixture.update(1, vec![name("Everyday")], T0);
    let foreign = outside.path().join("foreign.json");
    fs::rename(fixture.sidecar(), &foreign).unwrap();
    let foreign_bytes = fs::read(&foreign).unwrap();
    std::os::unix::fs::symlink(&foreign, fixture.sidecar()).unwrap();
    assert_eq!(fixture.load(T0).status, SidecarStatus::Unreadable {});
    let refused = fixture.update(1, vec![name("Other")], T0);
    assert_eq!(refused.outcome, SidecarUpdateOutcome::NotWritable {});
    assert_eq!(fs::read(&foreign).unwrap(), foreign_bytes, "untouched");
    assert!(fs::symlink_metadata(fixture.sidecar())
        .unwrap()
        .file_type()
        .is_symlink());

    // The directory swapped for a symlink after it was opened and locked.
    let fixture = Fixture::new();
    fixture.update(1, vec![name("Everyday")], T0);
    let swapped = outside.path().join("swapped");
    fs::create_dir(&swapped).unwrap();
    let directory = fixture.directory();
    let moved = fixture.storage.path().join("moved-away");
    let mut swap = |step: Step| {
        if step == Step::CreateTemp {
            fs::rename(&directory, &moved)?;
            std::os::unix::fs::symlink(&swapped, &directory)?;
        }
        Ok(())
    };
    let failed = update_with(
        Some(&fixture.store()),
        &fixture.files,
        &request(1, vec![name("Other")]),
        T0,
        &mut swap,
    )
    .unwrap();
    assert_eq!(failed.outcome, SidecarUpdateOutcome::WriteFailed {});
    assert!(
        fs::read_dir(&swapped).unwrap().next().is_none(),
        "nothing was written through the swapped link"
    );
} // End of function a_symlinked_lock_file_sidecar_file_or_swapped_directory_is_refused()

// ---------------------------------------------------------------------------
// Orphans: thirty days, controlled paths and time
// ---------------------------------------------------------------------------

#[test]
fn an_orphan_is_kept_thirty_days_with_controlled_paths_and_time() {
    let fixture = Fixture::new();
    fixture.update(2, vec![name("Other")], T0);
    let with_both = fixture.files.clone();
    let without_other = WorkspaceFiles {
        root: fixture.files.root.clone(),
        files: vec![(DocumentId(1), PathBuf::from("match/base.yml"))],
    };
    let load = |files: &WorkspaceFiles, now: u64| {
        load_with(Some(&fixture.store()), files, now, &mut no_probe)
    };
    let recorded = || -> Option<u64> {
        match super::format::parse(&fs::read(fixture.sidecar()).unwrap(), &fixture.key()) {
            super::format::Parsed::Current(file) => file
                .files
                .get("u:match/other.yml")
                .and_then(|e| e.orphaned_since),
            other => panic!("expected a current file: {other:?}"),
        }
    };

    // First seen missing: marked, kept, counted, not listed.
    let missing = load(&without_other, T0 + DAY);
    assert!(missing.files.is_empty());
    assert_eq!(missing.retained_orphans, 1);
    assert_eq!(recorded(), Some(T0 + DAY), "the mark is persisted");

    // Still missing a second before thirty days: kept, mark unchanged.
    assert_eq!(
        load(&without_other, T0 + DAY + ORPHAN_RETENTION_SECONDS - 1).retained_orphans,
        1
    );
    assert_eq!(recorded(), Some(T0 + DAY));

    // Back again (a rename and a rename back): the name returns, the mark goes.
    let back = load(&with_both, T0 + 10 * DAY);
    assert_eq!(name_of(&back, 2).as_deref(), Some("Other"));
    assert_eq!(back.retained_orphans, 0);
    assert_eq!(recorded(), None);

    // Missing again from day 20; a clock that went backwards prunes nothing.
    load(&without_other, T0 + 20 * DAY);
    assert_eq!(load(&without_other, T0).retained_orphans, 1);

    // Exactly thirty days after the new mark: pruned, and gone for good.
    let pruned = load(&without_other, T0 + 20 * DAY + ORPHAN_RETENTION_SECONDS);
    assert_eq!(pruned.retained_orphans, 0);
    assert!(load(&with_both, T0 + 60 * DAY).files.is_empty());
} // End of function an_orphan_is_kept_thirty_days_with_controlled_paths_and_time()

// ---------------------------------------------------------------------------
// Content: defaults are text, absent differs from empty; moved workspaces
// ---------------------------------------------------------------------------

#[test]
fn defaults_are_text_and_absent_differs_from_empty() {
    let fixture = Fixture::new();
    let saved = fixture.update(
        1,
        vec![
            SidecarChange::SetDefault {
                option: BulkOption::ForceMode,
                value: "clipboard".to_owned(),
            },
            SidecarChange::SetDefault {
                option: BulkOption::Word,
                value: String::new(),
            },
            SidecarChange::SetDefault {
                option: BulkOption::PropagateCase,
                value: "true".to_owned(),
            },
            SidecarChange::ClearDefault {
                option: BulkOption::PropagateCase,
            },
        ],
        T0,
    );
    assert_eq!(saved.outcome, SidecarUpdateOutcome::Saved {});
    let defaults = &saved.state.files[0].defaults;
    assert_eq!(
        defaults,
        &vec![
            SidecarDefault {
                option: BulkOption::Word,
                value: String::new(),
            },
            SidecarDefault {
                option: BulkOption::ForceMode,
                value: "clipboard".to_owned(),
            },
        ],
        "empty word is listed; the cleared option is absent"
    );
    assert_eq!(fixture.load(T0).files, saved.state.files, "it reads back");

    // The same changes again change nothing and write nothing.
    let bytes = fs::read(fixture.sidecar()).unwrap();
    let again = fixture.update(
        1,
        vec![SidecarChange::SetDefault {
            option: BulkOption::Word,
            value: String::new(),
        }],
        T0,
    );
    assert_eq!(again.outcome, SidecarUpdateOutcome::Unchanged {});
    assert_eq!(fs::read(fixture.sidecar()).unwrap(), bytes);

    // Clearing everything drops the entry rather than keeping an empty one.
    let cleared = fixture.update(
        1,
        vec![
            SidecarChange::ClearDefault {
                option: BulkOption::Word,
            },
            SidecarChange::ClearDefault {
                option: BulkOption::ForceMode,
            },
        ],
        T0,
    );
    assert!(cleared.state.files.is_empty());
    let expected = SidecarFile::default();
    assert_eq!(
        fs::read(fixture.sidecar()).unwrap(),
        render(&expected, &fixture.key())
    );
} // End of function defaults_are_text_and_absent_differs_from_empty()

#[test]
fn a_moved_workspace_opens_a_fresh_sidecar() {
    let fixture = Fixture::new();
    fixture.update(
        1,
        vec![name("Everyday"), SidecarChange::SetSortOrder { order: 2 }],
        T0,
    );
    let old_sidecar = fixture.sidecar();
    let moved_root = fixture.workspace.path().with_extension("moved");
    fs::rename(fixture.workspace.path(), &moved_root).unwrap();
    let moved = WorkspaceFiles {
        root: moved_root.clone(),
        files: fixture.files.files.clone(),
    };
    let state = load_with(Some(&fixture.store()), &moved, T0, &mut no_probe);
    // Put it back so the TempDir cleans up.
    fs::rename(&moved_root, fixture.workspace.path()).unwrap();
    assert_eq!(state.status, SidecarStatus::Fresh {});
    assert!(state.files.is_empty());
    assert!(
        old_sidecar.exists(),
        "the old workspace's sidecar is left alone"
    );
    let entry = FileEntry::default();
    assert!(entry.holds_nothing());
} // End of function a_moved_workspace_opens_a_fresh_sidecar()

#[test]
fn a_display_name_is_carried_as_written() {
    let fixture = Fixture::new();
    let written = "  Correo  del colegio \u{1F600} ";
    let saved = fixture.update(1, vec![name(written)], T0);
    assert_eq!(name_of(&saved.state, 1).as_deref(), Some(written));
    let cleared = fixture.update(1, vec![SidecarChange::ClearDisplayName {}], T0);
    assert!(cleared.state.files.is_empty());
}
