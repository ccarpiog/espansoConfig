VERDICT: NOT READY

# Confirmation review — Phase 2c-5 step 1 fix round

The behavioural fixes are sound for the owner's chosen platform split. On macOS the five affected read boundaries now resolve children relative to open directory descriptors and `read_entry` reads the descriptor that established the leaf's type. The original strict-path defect and the four mapping/authorship/construction prose defects are also closed. This round is not ready because the fix left the original unconditional symlink-guarantee finding open in narrower statements and introduced additional copies of that same false claim in the new traversal prose. Those sentences state the macOS result without a target qualification even though the non-macOS implementation can follow a component swapped between its check and its pathname use.

## The seven original findings

### Defects in behaviour

#### 1. High — checked entries and directories could be replaced by symlinks before use — CLOSED for the decided target split

The macOS implementation closes the race below the backup root. `ResolvedDirectory::child_directory` opens each directory with descriptor-relative `openat(..., O_NOFOLLOW)` at `crates/espansoconfig-core/src/persist/backup.rs:1652`; `child_regular_file` does the same for leaves at `crates/espansoconfig-core/src/persist/backup.rs:1683`; both confirm the opened object with `fstat` at lines 1662 and 1690. Directory listing duplicates the already-open descriptor and gives that duplicate to `fdopendir` at `crates/espansoconfig-core/src/persist/backup.rs:1711`, and `read_entry` reads the `File` returned by `open_entry` rather than opening the path again at `crates/espansoconfig-core/src/persist/backup.rs:3450`.

All affected sites use the primitive: root/batch enumeration at lines 3301 and 3315, marker recognition at line 2118, batch and recursive entry listings at lines 3360 and 3786, target observation through `walk_to_parent` at line 3699, and entry reading through the same walk at line 3730. There is no surviving macOS `File::open`, `fs::read_dir`, `fs::metadata`, or `fs::symlink_metadata` on an assembled catalogue read path; the pathname operations at lines 1857, 1872, 1913 and 1925 are confined to the `#[cfg(not(target_os = "macos"))]` body.

The descriptor ownership is correct. A successful `open`/`openat` is transferred exactly once to `File`; `fdopendir` takes the duplicated descriptor only on success; failure closes that duplicate; and `closedir` is the sole successful-path release. `rewinddir` at line 1729 compensates for the shared open-file offset. The unsafe calls check negative/null/error returns, initialise `stat` only after success, clear and inspect thread-local `errno` around `readdir`, copy `d_name` before the next stream operation, and neither double-close nor leak a descriptor on the represented paths.

The remaining whole-path `open` is only `open_root` at `crates/espansoconfig-core/src/persist/backup.rs:1592`. Its final component is protected by `O_NOFOLLOW`; its ancestors, including the canonicalised configuration-root pathname, remain subject to ordinary pathname resolution. That residue is honestly documented at `crates/espansoconfig-core/src/persist/backup.rs:1528` and `crates/espansoconfig-core/src/persist/backup.rs:3223`, and I found no second macOS pathname residue below the opened root.

Off macOS, the original race deliberately remains: `File::open` and `fs::read_dir` at lines 1913 and 1925 can follow a raced replacement after `symlink_metadata`. The module header names that limitation at `crates/espansoconfig-core/src/persist/backup.rs:175` and `crates/espansoconfig-core/src/persist/mod.rs:71`. Under the owner's explicit per-target decision, the correct replacement is exactly the present behavioural split: descriptor-anchored non-following traversal for the shipping macOS target and an explicit weaker guarantee elsewhere.

The macOS race test is genuinely falsifiable. Its discriminating second resolution at `crates/espansoconfig-core/src/persist/backup.rs:5034` asks an already-resolved parent for the leaf after the parent name is replaced by a symlink; a pathname implementation reaches the decoy while the descriptor implementation retains the original directory. Its `#[cfg(target_os = "macos")]` at line 4989 is honest because the asserted property is intentionally false in the non-macOS body; it does not hide a claimed cross-platform guarantee.

#### 2. Medium — `validated_relative_path` normalised interior `.` and empty components — CLOSED

The validator now examines the original Unix spelling by splitting its bytes on `/` at `crates/espansoconfig-core/src/persist/backup.rs:3582` and rejects empty, `.` and `..` parts at line 3584. `Path::components()` is no longer the validation source. The falsifiable cases at `crates/espansoconfig-core/src/persist/backup.rs:5556` include interior/leading/trailing `.`, repeated separators, a trailing separator, absolute paths and parent traversal.

The correct replacement is the current byte-spelling grammar: reject every non-plain spelled component before constructing the `PathBuf`.

### Claims in prose

#### 3. High — unconditional claim that no symlink is followed at any depth — NOT CLOSED

The principal module headers are now accurate: the macOS guarantee and root-path residue are stated at `crates/espansoconfig-core/src/persist/backup.rs:164`, and the non-macOS check/use race is stated at line 175; `persist/mod.rs` repeats the split at `crates/espansoconfig-core/src/persist/mod.rs:65`. `BatchSkipped::NotADirectory` and `EntrySkipped::Symlink` are also properly qualified at `crates/espansoconfig-core/src/persist/backup.rs:2532` and line 2589.

However, `scan_entries` still begins with the unconditional statement “The walk follows no symlink at any depth” at `crates/espansoconfig-core/src/persist/backup.rs:3342`, then concedes in the same paragraph that off macOS a raced replacement can be followed. The new helper headings repeat the absolute claim: `observe_entry` says “following nothing” at line 3682, `open_entry` says the same at line 3716, and the recursive walker says no symlink is recursed into and no descended pathname is re-resolved at lines 3749–3752. The latter is directly false off macOS: `ResolvedDirectory::names` calls `fs::read_dir(&self.path)` at line 1925, re-resolving the pathname and potentially following a swapped ancestor.

These should instead say: “Every symlink observed by the walk is refused. On macOS, descriptor-relative resolution also prevents a raced symlink substitution below the opened root from being followed; off macOS, a substitution between check and pathname use can be followed.” The recursive-walk claim must likewise say that only the macOS body avoids re-resolving descended pathnames.

#### 4. Medium — `BackupTarget` claimed source/provenance rather than syntactic classification — CLOSED

`BackupTarget` is now defined as a syntactic namespace classification at `crates/espansoconfig-core/src/persist/backup.rs:1198`, explicitly disclaims history and provenance at line 1208, and documents disambiguated names at line 1219. `BackupEntry::target` repeats the correct limitation at `crates/espansoconfig-core/src/persist/backup.rs:2991`. The disambiguated-sibling test at line 5172 pins both literal classification and the forward lookup's use of the undisambiguated name.

The correct replacement is the current wording: which live target path would map to an ordinary entry name, never what file the bytes came from.

#### 5. Medium — reverse mapping was described as total — CLOSED

The configuration-root exception is documented at `crates/espansoconfig-core/src/persist/backup.rs:1224`, and `entry_for_target` now explicitly returns `Ok(None)` for a target equal to `config_root` at line 3415 instead of offering the real in-root `_outside` file's entry. This is the correct behavioural change: the write side cannot back up the configuration-root directory as a regular file, while returning the sentinel's reverse would be a real wrong answer.

The test at `crates/espansoconfig-core/src/persist/backup.rs:5108` pins the sentinel, its non-round-trip reverse, the `None` catalogue answer, and continued lookup of the genuine `_outside` file. The correct replacement is this explicit partial mapping and refusal.

#### 6. Medium — marker prose implied this module wrote the marker — CLOSED

`BATCH_MARKER_NAME` now says the file recognises the application's format and explicitly denies proof of authorship at `crates/espansoconfig-core/src/persist/backup.rs:233`. `carries_batch_marker` is described as recognising the format at lines 2115–2117. The correct replacement is recognition-only wording, as now used.

#### 7. Low — catalogue construction claimed to read nothing — CLOSED

`BackupCatalog::rooted_at` now says construction reads no backup catalogue or content while explicitly acknowledging that canonicalisation consults the filesystem at `crates/espansoconfig-core/src/persist/backup.rs:3258`. The correct replacement is this distinction between configuration-root inspection and backup-content reads.

## Anything new the fix round introduced

### Defects in behaviour

No new behavioural defect was found.

The macOS resolver covers the original five read boundaries, the only remaining assembled-path opens/listings are compiled off macOS, and the read side has no production route to `rotate`, `create_backup_root`, `remove_dir_all`, `fs::write`, `File::create`, or rename. The added mutations found in the diff are test setup or assertions. The core crate adds no Tauri use or dependency, and the supplied dependency-tree result remains consistent with the source. Public additions are documented under `#![deny(missing_docs)]`.

The `_outside_/` latent fix is real and its test can falsify it: `escape_in_root_path` conditionally pushes only a non-empty remainder at `crates/espansoconfig-core/src/persist/backup.rs:1145`, while the assertion at line 5126 compares `OsStr` spellings byte-for-byte rather than relying on component-wise `Path` equality. The repeated-listing latent fix is likewise falsifiable: the test calls `names()` twice on the same resolver at lines 5081–5085 and would return a short/empty second result without `rewinddir`.

The temporary cfg inversion is adequate evidence that the non-macOS body is syntactically and type-correct against the host's Rust standard library, and running its backup tests and Clippy is useful evidence for the shared logic. It is not a real Linux cross-build: it does not prove Linux target dependency/cfg resolution, linker/ABI compatibility, target-specific standard-library differences, or behaviour on a Linux filesystem/kernel. That unproved platform evidence does not alter this verdict because the non-macOS limitation is explicit and the reported inversion exercised the body, but a true target build remains the stronger confirmation.

### Claims in prose

#### High — the new shared-walk prose itself repeats the platform-averaging defect

The new `open_entry` heading at `crates/espansoconfig-core/src/persist/backup.rs:3716` and the new recursive-walk assertion at line 3752 were introduced as part of the descriptor fix, yet state the macOS result without limiting it to macOS. This is not a new behavioural race beyond the deliberately retained non-macOS one, but it is a new false claim created by the fix round and is the project's identified worst prose class.

They should use the explicit per-target sentence given under original finding 3, with no unconditional “following nothing” or “never re-resolves” lead-in.

## Narrower instances still standing

### Defects in behaviour

None beyond the owner's deliberately accepted and documented non-macOS pathname race and the documented macOS backup-root ancestor-resolution residue. I found no unnamed residual macOS race below the opened backup root.

### Claims in prose

#### High — local helper/API absolutes survive beneath accurate module-level qualifications

The narrower instance is the mismatch between the accurate platform split in the headers and the absolute local claims at `crates/espansoconfig-core/src/persist/backup.rs:3342`, line 3682, line 3716 and lines 3749–3752. A reader following the local API/helper contract is told “no symlink”/“following nothing”/“never re-resolves,” while the compiled non-macOS implementation performs pathname operations that can follow a raced ancestor.

Each local claim should carry the same target qualification as `ResolvedDirectory`: observed links are always refused; raced substitutions below the opened root cannot be followed on macOS; raced substitutions can be followed off macOS. Until those local contracts agree with the implementation on every target, the original High prose finding is not closed.
