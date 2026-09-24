# Phase 3-12 — The application sidecar store

**Spec:** `docs/decisions/3-split-notes.md` §2 step "3-12", §3 rulings 25–28, §4.6, §5 rows 6–8;
`IMPLEMENTATION_PLAN.md` §8.9 (lines 820–856) as overridden by §5. **Risk:** high. **Driven**, one
worker, with no window half (ruling 30). Depends on nothing in the editor.

No window reading was performed or claimed.

---

## 1. What the tree could not do before this phase

Nothing in the application stored anything of its own. Every byte it wrote was a user's espanso file
(through `save_document`) or a backup copy of one. There was nowhere to keep a display name, an
ordering preference or a new-snippet default, and no second writer existed. This phase adds that
second writer, for application metadata only. It draws nothing; 3-13 consumes it.

## 2. What changed

### 2.1 `src-tauri/` — the new module

- **`src/sidecar.rs` (new)** — the orchestration and the wire types.
  - `WorkspaceFiles { root, files: Vec<(DocumentId, PathBuf)> }`: what the sidecar needs from the open
    workspace. The root is canonicalized and hashed, never written under.
  - `SidecarStatus` (8 variants), `SidecarUpdateOutcome` (4), `SidecarState`,
    `SidecarFilePreferences`, `SidecarDefault`, `SidecarUpdateResult` (all `Serialize`), and
    `SidecarChange` (6 variants) and `SidecarUpdateRequest` (both `Deserialize`,
    `deny_unknown_fields`, so a request carrying a `path` property is refused).
  - `SidecarSession`: the managed state, holding the storage root behind one mutex that serializes
    this process's loads and updates. `install_storage_root` installs or replaces the root.
  - `load_with` / `update_with`: the logic, with the store, the time (`now`, Unix seconds) and a
    failure-injection probe as arguments. `SidecarSession::load` / `update` call them with
    `no_probe`. `unix_now()` is the production clock.
  - `ORPHAN_RETENTION_SECONDS` = 30 days.
- **`src/sidecar/format.rs` (new)** — the version-1 format, the lossless path encoding,
  `WorkspaceKey` (the file name), `parse` and `render`.
- **`src/sidecar/store.rs` (new)** — **the application-metadata writer**: `SidecarStore::{new,
  open}`, `LockedDirectory::{read, quarantine, replace}` (the only type with reading or writing
  methods, and it holds the cross-process lock while it lives), `ReplaceError`, `QuarantineError`,
  `Step`, `Probe`, `no_probe`. It writes only inside `<storage root>/workspaces/` and refuses any
  component there that is a symlink (§9). No method but `new` takes a path.
- **`src/sidecar/tests.rs` (new)** — 19 tests (§4, §9). `format.rs` carries 5 more.
- **`src/commands.rs`** — `WorkspaceSession::sidecar_files()` (reads the session's file list under
  the session lock, then releases it) and two `#[tauri::command]`s: `load_sidecar()` and
  `update_sidecar(request)`, each two lines.
- **`src/main.rs`** — `mod sidecar`; `register` manages a `SidecarSession` and, in `setup`, installs
  `app.path().app_data_dir()` as its storage root when Tauri resolves one. Nothing is created at
  launch. Both commands are registered. The crate header and `register`'s doc name the pair and say
  that neither writes a user file.
- **`Cargo.toml`** — `libc.workspace = true` (§9, finding 2: `flock(2)`; `File::lock` is newer
  than the workspace's `rust-version` 1.82, so clippy's `incompatible_msrv` refuses it) and
  `sha2.workspace = true` (already in the lockfile through the core). The
  digest is the sidecar's own, so a stored file's name never depends on what the core decides a
  `ContentRevision` is.

### 2.2 Contracts

- **`dictionary_contract.rs`** — `SidecarStatus` and `SidecarUpdateOutcome` registered as
  `CODE_ENUMS` namespaces (variant counts 8 and 4).
- **`wire_contract.rs`** — the command-count test becomes
  `the_registered_commands_are_the_workspace_twenty_two_and_the_menu_command` (22 workspace, 23 in
  all). The two sidecar commands are asserted declared and **not** in the list of commands that
  write a user's file, which stays at eight. Three new tests:
  `the_sidecar_route_names_no_user_file_writer`,
  `every_sidecar_union_declares_exactly_the_rust_variants_and_operands` and
  `the_sidecar_structs_and_request_declare_exactly_what_rust_writes_and_reads`.
- **`dispatch_check.rs`** — `the_sidecar_pair_is_reachable_and_writes_only_under_the_storage_root`
  (it replaces the app-data root with a temporary directory before invoking anything; the
  directory holds the sidecar file and `sidecar.lock`, and nothing else), and the
  remote-origin sweep attempts both new commands (23 in all).

### 2.3 Frontend wire and i18n

- **`src/lib/ipc/types.ts`** — the sidecar wire types, one section.
- **`src/lib/ipc/commands.ts`** — `loadSidecar()`, `updateSidecar(request)`, `COMMAND_NAMES`
  (22). `commands.test.ts` calls both.
- **`src/lib/i18n/codes.ts`** — `sidecarStatusKey`, `describeSidecarStatus`,
  `sidecarUpdateOutcomeKey`, `describeSidecarUpdateOutcome`, registered in
  `CODE_NAMESPACE_KEY_BUILDERS`. No reactive wrapper in `index.ts`: nothing renders these yet, and
  3-13 adds the wrapper with its caller.
- **`en.json` / `es.json`** — 12 keys each, `code.sidecarStatus.*` (8) and
  `code.sidecarUpdateOutcome.*` (4). No `browser.sidecar.*` key: there is no UI in this step.
- **`src/lib/i18n/sidecarCodes.test.ts` (new)** — 5 tests.
- **`CLAUDE.md` §6**, first bullet under *Writing files*, now carries ruling 25's sentence and names
  the writer (`src-tauri/src/sidecar/store.rs`, driven by `src-tauri/src/sidecar.rs`).

## 3. The design

### 3.1 Where the file lives, and what names it

`<app data dir>/workspaces/<sha256 hex>.json`. In production the app data directory is Tauri's
`app_data_dir()`, which is `~/Library/Application Support/cc.carpio.espansoConfig/`. It follows the
**bundle identifier**. The plan's sketch said `…/espansoConfig/`, and that is not what is used.

The digest covers the line `espansoconfig-sidecar-root/1\n` followed by the **lossless encoding of
the canonical root** (`std::fs::canonicalize`, so symlinks and `/var` → `/private/var` are
resolved). The domain line versions the naming scheme separately from the file's own schema
version. A moved or renamed workspace canonicalizes differently, so it gets a different name and a
fresh sidecar (§5 row 7). The old file is left where it was, and nothing reclaims it (§6).

### 3.2 The format (version 1)

```text
{ "schemaVersion": 1,
  "root": "<encoded canonical root>",
  "files": { "<encoded relative path>": {
      "displayName"?: string, "sortOrder"?: u32,
      "newSnippetDefaults"?: { "<one of the seven option keys>": string },
      "orphanedSince"?: u64 } } }
```

- **Defaults are text** (ruling 28, §5 row 8). A key present with `""` is an empty default, and a
  key that is missing is an absent default. A boolean value makes the file corrupt, and so does a key
  outside the seven (`paragraph`, for example).
- The seven keys are `BulkOption`'s spellings: `word`, `left_word`, `right_word`,
  `propagate_case`, `uppercase_style`, `force_mode`, `force_clipboard`.
- `sortOrder` is a per-file `u32`, as the plan sketches. What ordering means is 3-13's to decide.
- Read strictly. An unknown field, a key that is not canonical, a `root` that is not this
  workspace's, or a `schemaVersion` of 0 or one that is not a `u64` makes the file **corrupt**. A
  `schemaVersion` greater than 1 makes it **future**.

### 3.3 Lossless keys

Each path is stored as one of two spellings. If its bytes are valid UTF-8, the spelling is `u:`
followed by the path. Otherwise it is `x:` followed by the lowercase hex of the bytes. Which one
applies depends only on the bytes, and `decode_key` refuses the other spelling (an `x:` key whose
bytes are valid UTF-8, uppercase hex, or odd length). So one byte string has exactly one key, and
two different byte strings never share one. On the wire nothing is keyed by path: requests and
answers name files by `DocumentId`.

APFS refuses non-UTF-8 names, so the `x:` form is tested over bytes (`format::tests`), not over
real files.

### 3.4 No watcher. Reload on open and before each mutation. Last write wins.

`load_sidecar` reads the file on every call, and `update_sidecar` reads it again immediately before
applying the change. Within one process, one mutex serializes the two. **Across processes, an
exclusive advisory lock serializes them** (`flock(2)` on `workspaces/sidecar.lock`, §9 finding 2).
One load or update holds it from its reload through the schema check, the quarantine, the orphan
policy and every write to its end, so an update always applies to what the file holds at that
moment and two instances changing different fields both keep their change. **Last write wins for
one field**: when two instances set the same field, the update that takes the lock second is what
the file holds, and neither instance is told. An instance's displayed state is as old as its last
load or update. `a_two_instance_race_is_serialized_and_last_write_wins` pins all three: in
sequence, overlapping (the second instance starts on another thread while the first holds the lock
at its `CreateTemp` step, waits, and reloads the first one's write), and one field set by both.
A load of a storage root with no `workspaces` directory takes no lock and creates nothing.

### 3.5 Atomic replacement

The writer creates a temporary file in the same directory, exclusively and with mode `0600`
(`<digest>.json.tmp-<pid>-<n>`). It writes the whole content and calls `sync_all`, which issues
`F_FULLFSYNC` on Apple targets. Then, under the lock, it re-verifies the directory and re-reads
the target, and refuses the replacement if the target is a symlink or declares a newer schema
(§9). Then it `rename`s the temporary file over `<digest>.json`. After
that it calls `sync_all` on the directory, **best effort**: a failure there is not reported, because
the rename has already happened. If a step before the rename fails, the writer removes the temporary
file (also best effort) and reports `WriteFailed`. Nothing reads a leftover temporary file.

### 3.6 Corruption: the outcomes (ruling 27)

| Outcome | What happened on disk | Writes | Test |
|---|---|---|---|
| `Fresh` / `Loaded` (success) | nothing / a read | allowed | every test's happy path |
| `Quarantined { aside }` | the file **was** renamed aside to `aside`, in the same directory. The status is built from the rename's `Ok` and from nothing else | allowed; starts empty | `a_corrupt_sidecar_is_quarantined_and_reported_only_after_the_rename` |
| `QuarantineFailed` | the rename failed; the original bytes are untouched; preferences are empty in memory | **refused** (`NotWritable`), so the bytes stay intact; each later load or update retries the quarantine | `a_failed_quarantine_leaves_the_bytes_intact_and_says_so` |
| `FutureSchema { version }` | nothing: not interpreted, not renamed, not rewritten | **refused** | `a_future_schema_is_retained_and_never_rewritten` |
| `Unreadable` | nothing (a read error other than *not found*, or three quarantine attempts that each found the file gone) | refused | `an_unreadable_sidecar_is_left_untouched_and_refuses_writes` |
| `RootUnresolved` / `StorageUnavailable` | nothing is read or written. `StorageUnavailable` also covers a sidecar directory that could not be created, verified or locked — a `workspaces` directory or lock file that is a symlink, for one (§9) | refused | `no_storage_root_or_no_workspace_root_reads_and_writes_nothing`, `a_symlinked_storage_directory_is_refused_and_nothing_is_written_outside` |

A sidecar file that is itself a symlink is `Unreadable` (`a_symlinked_lock_file_sidecar_file_or_swapped_directory_is_refused`).

The failed-quarantine test uses a **real** refusal: the sidecar directory is set to `0555`, so
`rename` fails with `EACCES`. It then repeats the check with an injected failure, which does not
depend on the permissions the test runs with. Run as root, the real half would fail loudly, not
pass vacuously. If the quarantine rename finds the file already gone (`NotFound`, because another
instance moved it first), the load reads again. `a_quarantine_that_finds_the_file_gone_reads_again`
covers that.

Deleting the sidecar loses display names, ordering and defaults, and changes no espanso file (§5
row 6). The next load is `Fresh`. This is pinned inside
`every_write_stays_under_app_storage_and_no_espanso_file_changes`.

### 3.7 Orphans: kept thirty days

The rulings name "orphan retention" and the plan says "keep orphans for 30 days". This phase
defines the rule as follows:

- An entry whose relative path is **not among the workspace's listed files** is an orphan.
- The first load or update that sees an orphan records `orphanedSince = now`.
- A load or update that sees the file listed again clears the mark.
- A load or update at `now - orphanedSince >= 30 days` prunes the entry.
- The difference saturates at zero, so a clock that went backwards never prunes early. A mark
  recorded from a clock that was ahead delays the prune by that amount.
- Orphans are not in `SidecarState.files`. They are counted in `retained_orphans`.
- A load writes changed marks back only when the file is writable, best effort. A failure is not
  reported, and the next load computes the same marks again.
- `now` is always an argument. `an_orphan_is_kept_thirty_days_with_controlled_paths_and_time` drives
  the rule through hand-built `WorkspaceFiles` lists and fixed timestamps (a second before thirty
  days, a return, a backwards clock, exactly thirty days). No test sleeps.

## 4. Acceptance clauses and the tests that pin them

| 3-12 acceptance (split notes §2) | Test(s) |
|---|---|
| Every write stays under app storage, and the writer takes no destination path | `sidecar::tests::every_write_stays_under_app_storage_and_no_espanso_file_changes` (every file the store makes is directly in `<storage>/workspaces`; workspace bytes unchanged); `sidecar::tests::the_writer_accepts_no_destination_path` (parses `store.rs` with `syn`: no writer method takes a `Path`, `PathBuf`, `OsStr`, `OsString`, `str` or `String`; `sidecar.rs` calls no writing fs function); `wire_contract::the_sidecar_structs_and_request_declare_exactly_what_rust_writes_and_reads` (a request with a `path` property is refused); `dispatch_check::the_sidecar_pair_is_reachable_and_writes_only_under_the_storage_root`; `wire_contract::the_sidecar_route_names_no_user_file_writer` |
| A failed quarantine leaves the bytes intact and says so | `sidecar::tests::a_failed_quarantine_leaves_the_bytes_intact_and_says_so` |
| A future schema version is not overwritten | `sidecar::tests::a_future_schema_is_retained_and_never_rewritten`; `sidecar::tests::a_future_schema_written_between_read_and_replace_is_retained` (§9) |
| An interrupted replacement leaves the old or the new state valid | `sidecar::tests::an_interrupted_replacement_leaves_the_old_or_the_new_state_valid` (a failure at each of `CreateTemp`, `WriteTemp`, `SyncTemp` and `Rename` leaves the old state and no temporary file; a failure at `SyncDirectory` leaves the new one; a leftover partial temporary file is ignored; at the moment of the rename the target still holds a whole, valid file) |
| A two-instance race behaves as documented (last write wins) | `sidecar::tests::a_two_instance_race_is_serialized_and_last_write_wins`; `sidecar::tests::the_lock_is_held_from_the_reload_to_the_last_write` (§9) |
| The 30-day orphan policy is tested with controlled paths and time | `sidecar::tests::an_orphan_is_kept_thirty_days_with_controlled_paths_and_time` |
| `CLAUDE.md` §6's first bullet gains ruling 25's sentence | edited in this phase (§2.3) |

Also pinned: `a_moved_workspace_opens_a_fresh_sidecar` (§5 row 7);
`defaults_are_text_and_absent_differs_from_empty` (ruling 28, §5 row 8; a no-op update is
`Unchanged` and writes nothing; an entry cleared of everything is dropped);
`a_display_name_is_carried_as_written`; `an_unknown_document_is_refused_before_anything_is_read`;
and the five `format::tests`.

## 5. What is not guaranteed

These are stated because each one is easy to assume.

- **Rename atomicity is the operating system's.** The tests inject failures at step boundaries and
  simulate a leftover partial temporary file. They do not crash a process or cut power.
  Durability across power loss is not claimed. The directory sync is best effort, and a
  `SyncDirectory` failure is reported as `Saved`.
- **The cross-process lock is advisory, and it blocks without a timeout.** It excludes only
  writers that take it: every instance of this build does, a writer that ignores it is not stopped.
  Against such a writer the future-schema re-read before each rename is the defence, and it leaves
  the gap between that re-read and the `rename` call, where a newer-schema file could still be
  replaced. An instance stopped while holding the lock (a debugger, `SIGSTOP`) stalls every other
  instance's sidecar load and update until it resumes or exits; the lock is released when the
  holding process ends. Last write wins for one field set by two instances (§3.4).
- **Symlink refusal narrows, and does not close, a swap window.** Every app-owned component below
  the storage root is refused when it is a symlink, checked with `symlink_metadata` (and, for the
  lock file and a read, the device and inode of what was actually opened), and the directory is
  re-verified before the temporary file is created, before the replacing rename and before a
  quarantine rename. `std` has no directory-relative operations (`openat`, `renameat`), so every
  step still resolves `<storage root>/workspaces/<name>` by path: a process that swaps `workspaces`
  for a symlink after one check and back before the next could redirect the one operation in
  between. The storage root and its ancestors are the platform's application data directory and are
  not checked; a storage root that is a symlink is followed.
- **A quarantine name taken between the existence check and the rename would be replaced.** Names
  carry the time, the process id and a per-process counter, so this would take a second process with
  the same pid. It is not excluded mechanically. A quarantine that races another instance's fresh
  write can set that valid file aside instead. Its bytes are then preserved in the aside file, not
  lost.
- **"Orphan" means "not in this session's file list."** The list comes from discovery at open time.
  A file deleted or created outside the application while a workspace is open is not seen until the
  workspace is opened again. The thirty days count this application's observations: a file that
  disappears while no instance runs is marked on the next run, not when it went.
- **`the_writer_accepts_no_destination_path` reads one file.** It establishes that `store.rs`'s
  methods take no path-like parameter and that `sidecar.rs` names no writing fs function by those
  spellings. A path smuggled through another type, or a writer added under another name, would pass.
  The same holds for `the_sidecar_route_names_no_user_file_writer`, which is a fixed-vocabulary
  tripwire exactly like the backup one.
- **The `x:` encoding is tested over bytes only**, because APFS refuses non-UTF-8 names. The
  encoding function is Unix-only (`OsStrExt`), as the application is.
- **`version` on a future file is only the declared number.** Nothing establishes that a newer
  build wrote it.

## 6. Open items (not fixed here)

1. **Quarantined files and leftover temporary files are never reclaimed.** Neither are sidecars of
   workspaces that moved. A later phase may add a bounded cleanup inside the storage directory.
2. **Display names are not validated.** `SetDisplayName { name: "" }` stores an empty name. 3-13
   must decide whether an empty name clears the entry, and must trim or keep whitespace
   deliberately (the name is user data and is carried as written).
3. **`sortOrder` semantics** (a dense order, ties, what happens when a file is added) are 3-13's
   decision. 3-13's acceptance list does not mention ordering at all.
4. **The plan text** (`IMPLEMENTATION_PLAN.md` §8.9) still shows a boolean default and the
   `…/espansoConfig/` path. Per split-notes §4.6 the plan is not edited here. §5 of the split notes
   and this record are the overrides.
5. **No reactive `index.ts` wrapper** for the two new `describe*` accessors. 3-13 adds it with the
   first caller.
6. **A rename done by the application** ("when the app renames a file it moves the sidecar entry
   too", plan §8.9) has no subject: ruling 14 forbids a rename command. If one is ever added, it
   must move the entry.

7. **The storage root itself is not checked for symlinks**, and the swap window of §5 remains.
   Closing it needs directory-relative operations (`openat`/`renameat`/`mkdirat` with
   `O_NOFOLLOW`, e.g. through `rustix`), which a later phase may adopt deliberately.
8. **The lock has no timeout** (§5). A later phase may bound the wait and add a status for it (it
   would need EN and ES strings).
9. **The lock file is never removed.** It is one empty file in the application's own directory.

## 7. New Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

Twelve sentences were added, and none was changed. Producer: `src-tauri/src/sidecar.rs`
(`SidecarStatus`, `SidecarUpdateOutcome`), rendered through `describeSidecarStatus` and
`describeSidecarUpdateOutcome` in `src/lib/i18n/codes.ts`.

| Key | Producer |
|---|---|
| `code.sidecarStatus.fresh` | `SidecarStatus::Fresh` |
| `code.sidecarStatus.loaded` | `SidecarStatus::Loaded` |
| `code.sidecarStatus.quarantined` | `SidecarStatus::Quarantined` (`{aside}`) |
| `code.sidecarStatus.quarantineFailed` | `SidecarStatus::QuarantineFailed` |
| `code.sidecarStatus.futureSchema` | `SidecarStatus::FutureSchema` (`{version}`) |
| `code.sidecarStatus.unreadable` | `SidecarStatus::Unreadable` |
| `code.sidecarStatus.rootUnresolved` | `SidecarStatus::RootUnresolved` |
| `code.sidecarStatus.storageUnavailable` | `SidecarStatus::StorageUnavailable` |
| `code.sidecarUpdateOutcome.saved` | `SidecarUpdateOutcome::Saved` |
| `code.sidecarUpdateOutcome.unchanged` | `SidecarUpdateOutcome::Unchanged` |
| `code.sidecarUpdateOutcome.notWritable` | `SidecarUpdateOutcome::NotWritable` |
| `code.sidecarUpdateOutcome.writeFailed` | `SidecarUpdateOutcome::WriteFailed` |

## 8. Verification

All gates were run from the repository root, with output redirected to files and checked:

- `cargo build --workspace`: exit 0.
- `cargo test --workspace -- --test-threads=1`: exit 0, **1533 passed** (1529 before §9).
- `cargo clippy --workspace --all-targets -- -D warnings`: exit 0.
- `cargo fmt --check`: exit 0.
- `npm run check`: exit 0, **480 files**, 0 errors, 0 warnings.
- `npm test`: exit 0, **3936 passed** (84 files).
- `npm run build`: exit 0, **210 modules**. The new code is in existing modules plus one test file,
  so the count is unchanged.
- Bundle oracle: server-only markers absent, client-only markers present.
- `cargo tree -p espansoconfig-core | rg tauri`: nothing found.

Rung: **`1533 / 480 / 3936 / 210`** (after the §9 review fixes; `1529 / 480 / 3936 / 210` before).

## 9. Review fixes

The adversarial review (`docs/reviews/phase-3-12.md`) found two blockers. Both are answered in the
files it named (`src-tauri/src/sidecar/store.rs`, `src-tauri/src/sidecar.rs`), plus the tests
(`src-tauri/src/sidecar/tests.rs`, and one assertion in `src-tauri/src/dispatch_check.rs` that now
expects the lock file beside the sidecar file), the
`libc` line in `src-tauri/Cargo.toml` and this record. No i18n key was added or changed: both
refusals reuse existing codes.

**Finding 1 — `store.rs:143`, symlinked storage directories redirected writes outside app
storage.** `create_dir_all`, the temporary file's creation and the rename all followed a
`workspaces` symlink. Now `SidecarStore::open` creates `workspaces` with `create_dir` (an existing
link is `AlreadyExists`, never followed) and refuses it unless `symlink_metadata` says it is a
directory, recording its device and inode. The lock file is refused unless it is a regular file whose
opened device and inode match; a missing one is created with `create_new`. A sidecar file is read
only if it is a regular file, through the descriptor whose identity was compared. The temporary file
was already `create_new`, which never follows a symlink. The directory is re-verified before the
temporary file, before the replacing rename and before a quarantine rename, and the replacement
re-reads the target first, so a sidecar path that became a symlink refuses it. Outcomes: a refused
directory or lock file is `StorageUnavailable` (`NotWritable` for an update), a refused sidecar file
is `Unreadable`, and a directory swapped during a write is `WriteFailed`. The residual swap window
(no `openat` in `std`) is stated in §5 and in `store.rs`'s module documentation, in the same
sentences as what the code forces. Regression tests:
`a_symlinked_storage_directory_is_refused_and_nothing_is_written_outside` (`workspaces` is a
symlink to a temporary directory outside storage; a load and an update are refused and the outside
directory stays empty) and `a_symlinked_lock_file_sidecar_file_or_swapped_directory_is_refused` (a
dangling lock-file link whose target is never created; a sidecar-file link whose foreign target
keeps its bytes; the directory swapped for a link at `CreateTemp`, with nothing written through it).

**Finding 2 — `sidecar.rs:406`, concurrent replacement bypassed future-schema protection.** The
schema check ran only at read time. Now `SidecarStore::open` takes an exclusive `flock(2)` on
`workspaces/sidecar.lock` and answers a `LockedDirectory`, the only type that reads, quarantines or
replaces; `read()` returns it inside the `Reading`, so one lock is held by each load or update from
its reload through validation, quarantine, orphan pruning and every write. `File::lock` is stable
only since Rust 1.89 and the workspace declares 1.82, so the call goes through `libc` (already a
workspace dependency). Under the lock, immediately before the rename, `replace` re-reads the target
and refuses with `ReplaceError::FutureSchema`, which an update reports as `NotWritable` with a
`FutureSchema` status and a load's best-effort mark write drops. A quarantine re-reads the file
and renames it only if it still holds the bytes judged corrupt; otherwise it reads again, and so
reports a newer file as `FutureSchema`. Regression tests:
`a_future_schema_written_between_read_and_replace_is_retained` (a version-2 file written between the
read and the rename of an update, of a load's orphan-mark write, and of a quarantine, is retained
each time) and `the_lock_is_held_from_the_reload_to_the_last_write` (at every `Step` of an update,
a quarantine and a load's mark write, a non-blocking `flock` on a second description fails, and it
succeeds after each returns). `a_two_instance_race_is_last_write_wins` became
`a_two_instance_race_is_serialized_and_last_write_wins` (§3.4): the old overlapping half ran the
second update inside the first one's critical section, which now waits for the lock.

Mutation checks, run once and reverted: disabling the pre-rename schema re-check fails the
future-schema test; disabling the directory symlink checks fails both symlink tests; removing the
`flock` call fails the race test and the lock test.
