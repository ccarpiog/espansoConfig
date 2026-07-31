# Phase 2a-1 review — the durable atomic write primitive

Reviewer: Codex (GPT-5.x), invoked through the `codex:codex-rescue` subagent.
Subject: `crates/espansoconfig-core/src/persist/write.rs` and
`crates/espansoconfig-core/tests/persist_write.rs`, as implemented before any fix round.
Brief: adversarial correctness review, ranked by severity, with the concrete destructive scenario
and the smallest correct fix for each finding. Web search and repo sweeping were forbidden; the
reviewer was pointed at the two files, `ContentRevision`, and plan §6.6.

The reply is reproduced below verbatim. Its disposition — what was fixed, what was recorded and
why — is in `PROGRESS.md` under "Phase 2a-1 review disposition".

---

## Ranked findings

### Critical — The revision check is not a compare-and-swap

File: write.rs:328, commit at write.rs:429

The target is hashed, then the candidate is written/fsynced, then `rename` replaces whatever happens
to occupy the target pathname. The mutex excludes only this process's cooperating writers. Vim,
espanso, Dropbox, iCloud Drive, and other processes do not take it.

Concrete destructive scenario:

1. App reads revision A.
2. Save hashes A successfully.
3. Vim atomically replaces the target with revision B.
4. The app renames its temp file over B.
5. The save returns success; Vim's edit is lost.

A related race occurs if the target is deleted after the hash: `rename` recreates it, contradicting
the "missing target is a refusal" contract. If a symlink is installed at the resolved pathname during
this interval, the rename destroys that symlink.

This is a real desktop-app race. Editors commonly save by temp-file-plus-rename; cloud-sync software
also replaces directory entries. The duration includes writing and syncing the complete candidate, so
it is not merely an instruction-sized theoretical window.

Smallest mitigation: immediately before rename, re-open and re-hash the target and verify its
device/inode and type against the inspected object. That materially narrows the window but does not
close it.

There is no ordinary POSIX/macOS pathname operation that atomically says "replace this name only if
its contents have this SHA-256." Advisory locks, lock files, and `flock` only work with cooperating
writers. If the absolute guarantee is required against arbitrary editors, the contract is
unimplementable as stated. The code must either:

- require/co-ordinate cooperating writers, potentially using macOS file coordination where
  applicable; or
- describe this as optimistic conflict detection, add the final identity/hash check, and rely on
  recoverable backups/conflict handling for the remaining race.

The module-level claim that replacement occurs "only if" the expected contents remain is therefore
false at write.rs:4.

### High — Every successful save discards significant file metadata

File: write.rs:402, replacement at write.rs:429

`metadata.permissions()` preserves only the Unix mode represented by `Permissions`. The rename
replaces the original inode with the temp inode.

Silently lost or changed on macOS: owner and group, POSIX ACLs, extended attributes (including Finder
tags and other `com.apple.*` attributes), resource forks, creation time and file identity, BSD flags
such as `uchg`/`SF_IMMUTABLE`, and hard-link relationships.

This can change access control, not just cosmetics. An ACL may deny access that copied mode bits
appear to allow; removing it broadens access. A group-writable directory also permits replacing a
file owned by another user, and the result becomes owned by the app user.

There's also a real metadata TOCTOU at write.rs:315: metadata can come from inode A while the bytes
subsequently read come from replacement inode B.

Smallest fix: define an exact metadata policy and copy required metadata (ownership, ACLs, xattrs,
relevant flags) from the same opened file descriptor whose bytes were hashed — not just
`Permissions`. If metadata preservation is deliberately out of scope, rename the guarantee to "mode
bits survive," not "permissions survive."

### High — "Durably" is stronger than macOS `sync_all()` provides

File: write.rs:421, write.rs:438

On macOS, Rust's `File::sync_all()` uses normal `fsync` semantics, not Darwin's `F_FULLFSYNC`, which
asks the device to flush volatile write caches. This is good crash protection but doesn't justify an
unconditional power-loss durability claim. Directory sync is a reasonable best effort but not a
proven APFS guarantee.

Smallest fix: use `fcntl(F_FULLFSYNC)` on the candidate when power-loss durability is part of the
contract, describe directory sync as best-effort, and weaken "atomically and durably" at write.rs:271
unless the stronger operation is implemented.

### Medium — Canonicalization does not stabilize the caller's symlink identity

File: write.rs:240

If the caller's symlink is retargeted while the call runs, the operation continues writing the old
referent and can report success while the symlink path now shows a different unchanged file.

Smallest fix: after taking the lock and immediately before commit, re-resolve the caller-visible path
and refuse if it no longer identifies the same target (requires retaining the original caller path in
`PathWriteLock`). The case-insensitive claim at write.rs:202 is also untested for case-variant paths
and stronger than Rust's `canonicalize` contract.

### Low — The temp-file lifetime documentation is false

File: write.rs:62, cleanup at write.rs:517

"The temp file never survives the call" is contradicted by a crash/abort (no `Drop`), deliberately
swallowed cleanup errors, and line 109's own acknowledgment of crash leftovers.

Smallest fix: state that cleanup is attempted on normal return and unwinding, and that crash/error
leftovers are harmless because of their name.

## Error classification

`may_have_written()` is structurally correct as "this call may have completed its rename" — `Rename`
is pre-commit; `SyncDirectory`, `ReadBack`, `VerificationFailed` are post-commit. But under external
concurrency it's misleading: at write.rs:562, `false` doesn't mean the target still holds `expected`
(another process may have changed it since), and `true` doesn't mean the target currently holds the
new bytes (an external writer may have replaced them again). Recommended wording: "whether this
call's rename may have completed; the target must be re-read whenever external writers are possible."

## Test audit — guarantees that are theatre

- **No temp survives**: only success-path cleanup is pinned; crash/cleanup-failure claims are
  untested and false; the rename-failure test silently no-ops when `chflags` is unavailable.
- **Permissions survive**: only mode bits are pinned; ACLs/ownership/xattrs/flags are not — the
  guarantee name overstates this.
- **Concurrent writers serialize / no mixture**: `concurrent_writers_that_reread_all_succeed...`
  would pass with atomic rename and no mutex at all — it proves nothing about serialization. The
  two-spellings blocking test is the strongest lock evidence but rests on a 300ms timing assumption.
  No external (non-cooperating) writer is ever tested.
- **Byte-exact fixtures**: theatre as written — every fixture begins with the same bytes it writes
  back, so a no-op implementation would pass.
- No test injects `SyncDirectory`/`ReadBack`/`VerificationFailed` and checks `may_have_written()`. No
  test would fail if `sync_all()` (file or directory) or read-back verification were removed
  entirely.
- Doc/count mismatches: "three byte-exact fixtures" at persist_write.rs:25 and "three of the fifteen"
  at persist_write.rs:739 both precede five-element fixture lists.

## Correct points

The same-directory temp, `create_new`, initial `0o600`, `write_all` before sync, atomic
same-filesystem rename, and normal-path RAII cleanup are sound. Resolving an ordinary stable symlink
before rename correctly preserves it. The post-rename error classification is sensibly conservative.

**Bottom line**: the primitive implemented is atomic replacement plus optimistic preflight checking,
not an atomic revision-conditional replacement against external (non-cooperating) writers — the
module-level doc comment's "only if" claim needs to be corrected to reflect that.
