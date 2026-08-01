# Phase 2a-3a — metadata preservation across the atomic rename

**What this sub-phase is.** The blocking finding the 2a-2b review handed to 2a-3, paid: plan §7 row 11
(*"changing permissions / ownership / line endings / BOM → capture and restore all four"*). The atomic
save installs a **new inode**, and a new inode is born with no access control list and no extended
attributes — so until now every save silently dropped Finder tags, Finder comments,
`com.apple.quarantine`, every `com.apple.metadata:*` attribute, the resource fork, and the ACL. The
last of those is a security property: a **denying** ACL is access control, and dropping it left the
replacement *more* accessible than the file it replaced while the mode bits looked identical.

It is **not** step 13. No backup is written, no directory is created and nothing is rotated; backup
rotation is 2a-3b's. Nothing crosses the IPC boundary, no wire type gains `Serialize` and no dictionary
key is added (§9.4).

**The one sentence that defines it:**

> **The candidate carries the target's ACL and extended attributes onto the new inode before the
> rename — copied through the descriptor the bytes were hashed from — or the write refuses.**

Everything else in this document is either a consequence of that sentence or a decision the sentence
does not make. The three sharpest are §2 (the dependency), §3 (the flag set) and §4 (the failure
policy).

---

## 1. What was built

**`crates/espansoconfig-core/src/persist/write.rs`** — step 7 became two steps:

| Step | What | Where |
|---|---|---|
| 6 | uniquely named temp file in the target's directory, `0o600` | unchanged |
| **8** | the bytes, `flush`, `sync_all` — while still `0o600` | moved **before** step 7 (review round, §11 finding 5) |
| **7a** | copy the target's **ACL and extended attributes** onto it | **new** — `copy_metadata` |
| **7b** | copy the target's **mode bits** onto it, with `fchmod` on the open descriptor | moved **after** 7a and after the bytes |
| **8 again** | a second `sync_all`, for what 7a and 7b just wrote | **new** (review round, §11 finding 14) |
| **9** | prove the temp **pathname** still names the inode that was written | **new** — `verify_temp_identity` (review round, §11 finding 12) |
| 9–11 | pre-commit re-check, rename, directory sync, read-back | unchanged |

Three things changed beside the new function:

- **`InspectedTarget` now keeps the open `File`.** The metadata copy reads the ACL and the attributes
  from **the same file description** the mode bits and the bytes came from. Re-opening the target by
  path would have reintroduced exactly the TOCTOU that 2a-1 §4 records as fixed — a second `open` can
  land on a different inode and copy *its* protection onto this candidate. The cost is one file
  descriptor held for the life of the transaction.
- **`WriteStep` gained `CopyMetadata`**, code `copyMetadata`, placed between `CreateTempFile` and
  `ApplyModeBits`. `WriteStep::after_rename()` answers `false` for it and
  `WriteError::may_have_written()` answers `false` for an `Io` carrying it, which is §4's decision made
  visible in the type. Adding the variant was a compile-error-driven change in `code()`, and two tests
  that enumerate every step were updated with it.
- **The mode bits are applied after the metadata copy**, so they have exactly one owner. §3 records
  that the chosen flag set was *measured* not to touch the mode; the ordering is what makes that a
  belt-and-braces rather than a dependency on the measurement staying true.

**The review round (§11) added three more**, all inside the same function:

- **`WriteStep` gained `VerifyTempIdentity`**, code `verifyTempIdentity`, and **`WriteError` gained
  `TempFileChangedDuringWrite`**. `may_have_written()` answers `false` for the new variant and
  `after_rename()` answers `false` for the new step. `SaveError::is_refusal()` matches `WriteError`
  exhaustively, so the new variant was a compile error there until it was classified: it is a
  **refusal**, for the same reason `TargetChangedDuringWrite` is — a check this application makes
  declined to commit, the file on disk is untouched, and the next attempt mints a fresh temp name.
- **The mode is applied with `File::set_permissions` (`fchmod`) instead of `fs::set_permissions`**,
  so the inode chmod-ed is provably the inode this call wrote rather than whatever the temp *name*
  resolves to at that instant.
- **The bytes and their `fsync` moved ahead of step 7**, and a second `sync_all` was added after 7a
  and 7b.

No public signature changed. `replace_file_atomically`, `replace_locked_file`, `lock_path` and
`temp_file_name` are exactly as 2a-1 left them; `WriteError` and `WriteStep` each gained one variant
in the review round, and the only call site that had to react is `SaveError::is_refusal()` — one arm.

**Tests: eight new in the first pass, five more in the review round**, and the macOS-only ones are
gated in the same way the implementation is.

| Where | Test | What it pins |
|---|---|---|
| `tests/persist_write.rs` | `extended_attributes_on_the_target_survive_the_write` | three attributes — a Finder tag, a Finder comment and an application attribute — survive with their exact bytes, and the file's data is exactly what was written |
| | `an_access_control_list_on_the_target_survives_the_write` | an `everyone deny write` entry is on the file afterwards, unchanged |
| | `the_mode_bits_survive_beside_an_access_control_list_and_an_attribute` | the two-mechanisms guard: `0o640` is still `0o640` with an ACL and an attribute on the same file |
| | `an_access_control_list_that_denies_delete_refuses_and_can_leave_a_temp_file` | the one case where preserving an ACL and committing conflict — and that it is **not** a regression (§6, measurement 5). Renamed in the review round, where it also gained the leftover observation |
| | `a_metadata_copy_failure_is_a_refusal_that_has_written_nothing` | §4's policy, at the classification level |
| `persist/write.rs` | `the_metadata_copy_moves_an_extended_attribute_between_two_open_files` | the syscall wrapper itself, so a wrong flag constant fails here and not only through an integration test |
| | `the_metadata_copy_reports_a_failure_instead_of_succeeding_silently` | the error arm exists and returns the OS error (EBADF, 9) |
| `tests/persist_save.rs` | `a_committed_save_carries_the_targets_attributes_and_access_control_list` | the same property through **`save_document`**, which is the entry point a user's edit actually travels |

The review round's five:

| Where | Test | What it pins |
|---|---|---|
| `tests/persist_write.rs` | `the_temp_file_is_not_widened_before_its_bytes_are_on_disk` | the reordering. A poller stats the temp file throughout an 8 MiB write; **no sample may wear a mode wider than `0o600` while the file is shorter than the payload** |
| `persist/write.rs` | `the_temp_identity_check_accepts_a_name_nobody_touched` | the check passes what it must pass |
| | `the_temp_identity_check_refuses_a_name_repointed_at_another_inode` | the review's attacker-writable-directory finding, reproduced **deterministically**: the directory entry is replaced under an open descriptor, and the commit is refused |
| | `the_temp_identity_check_refuses_a_name_replaced_by_a_symlink` | that the comparison is `lstat` and not `stat` — a symlink is a mismatch, never a dereference |
| | `the_temp_identity_check_reports_a_vanished_name_as_an_io_failure` | a name that is *gone* is a different fact from a name that points elsewhere, and the step marker separates them |

**`crates/espansoconfig-core/src/persist/mod.rs`** — the module documentation's *"Mode bits, not
permissions … a decision a later phase must revisit"* paragraph is gone. In its place is §5's four-way
statement of row 11. **`src/lib.rs`** gained a 2a-3a row in the phase table. Both were revisited in
the review round, which added the ordering and the one thing a failure actually guarantees (§11
findings 5, 7 and 8) and removed the implication that a failure deletes the temp file.

Nothing under `tests/corpus/` was added, moved or reformatted, and `tests/corpus_integrity.rs` passes
unchanged.

---

## 2. Decision — the dependency: `libc`, macOS-gated, in a target section

`copyfile(3)` is an Apple C interface. Calling it needs a declaration, and this crate had **no platform
dependency at all** — 2a-1 spelled `O_NOFOLLOW` and `O_NONBLOCK` out by hand precisely to keep that
true, pinning each constant's *meaning* with a test rather than trusting its number.

### 2.1 Why a crate rather than a hand-written `extern "C"` block

The hand-written route is what 2a-1 chose for its two constants, and it does not scale to this call.
`fcopyfile` needs a function declaration, an opaque `copyfile_state_t`, a `copyfile_flags_t` and four
flag constants — and unlike an `open` flag, **a wrong declaration here is not caught by a test that
pins the meaning**. A flag with the wrong bit silently copies the wrong class of metadata and the
`XATTR` test would still pass while the ACL quietly did not travel; a wrong ABI for the state argument
is undefined behaviour, not a test failure. The two `open` constants are one integer each with a
directly observable effect. This is not that.

### 2.2 Why `libc` and not `nix`, `xattr`, or `rustix`

| Candidate | Why not |
|---|---|
| **`nix`** | a safe wrapper over far more of POSIX than one call needs, with its own error type and its own release cadence. It does not wrap `copyfile` at all, so the `unsafe` block would still be written here — and a second dependency would be carried for nothing |
| **`xattr`** | covers extended attributes only. ACLs are the half that is a **security** property, so a crate that cannot carry them answers the smaller part of the problem and still leaves an `unsafe` call for the rest |
| **`rustix`** | a genuinely good `libc`-avoiding layer, but it does not expose `copyfile` either, and its raw-syscall approach is deliberately Linux-first |
| **`libc`** | **chosen.** It is the declaration and nothing else — no wrapper, no error type, no abstraction to be wrong about. It has **no dependencies of its own**, it is already in this workspace's lockfile and already in this crate's *normal* dependency graph transitively (`sha2 → cpufeatures → libc`, since Phase 0a), and its Apple module is generated against Apple's own headers |

### 2.3 How it is gated, and why that way

```toml
# crates/espansoconfig-core/Cargo.toml
[target.'cfg(target_os = "macos")'.dependencies]
libc.workspace = true
```

**A target section, not a `cfg`-gated call site over an unconditional dependency.** Both would compile;
the target section is stronger because it makes the *build graph* say the thing the code says. On any
other target the crate does not merely skip the call — it does not link the crate that declares it, so
"this is macOS-only" cannot rot into "this happens to be `#[cfg]`ed out today". `espansoconfig-core` is
the standalone, independently testable and fuzzable library (plan §6.1), and it still builds, tests and
fuzzes anywhere.

The call site is `cfg`-gated too, necessarily: `copy_metadata` has a second definition for
`cfg(not(target_os = "macos"))` that answers `Ok(())`, with a doc comment saying in as many words that
**the ACL and extended-attribute guarantee does not hold on that target**. `WriteStep::CopyMetadata`
exists on every target, so the enum, its codes and every exhaustive match over it stay
platform-independent — a step that vanished off macOS would make `code()` and `after_rename()` differ
by platform, which is the kind of difference nobody tests.

The version is declared in the root `Cargo.toml` `[workspace.dependencies]` with the established
comment style, saying what it is for and that it pulls in no tauri.

### 2.4 The architecture rule, checked

```sh
cargo tree -p espansoconfig-core | rg tauri     # exit 1 — nothing found, which is the pass
cargo tree -p espansoconfig-core | rg libc      # libc v0.2.189, now a direct edge
```

`libc` was **already in this crate's normal graph** before this sub-phase, two levels down —
`espansoconfig-core → sha2 → cpufeatures → libc`, since Phase 0a. What changed is that the edge is now
direct and declared, which is the honest state, and `rg libc` over that tree was therefore never a
check of anything. The check that matters is the tauri one above, and it is unchanged.

---

## 3. Decision — `COPYFILE_ACL | COPYFILE_XATTR`, through `fcopyfile`, with a `NULL` state

### 3.1 Why the descriptor form

`fcopyfile` **resolves no path**. Both ends are already open — the source is the descriptor
`inspect_target` opened `O_NOFOLLOW` and hashed from, the destination is the temp file this call
created — so there is no second name lookup to race, no symlink question, and no way for either end to
be a different inode than the one the caller means. The path form `copyfile()` would have to re-resolve
the target between the step-2 read and the rename, which is the TOCTOU 2a-1's review made this module
remove. The descriptor form is not a convenience; it is the only form that preserves an invariant the
module already had.

### 3.2 Why `COPYFILE_STAT` is **not** in the flag set

`COPYFILE_STAT` would additionally carry mode, owner, group, timestamps and BSD flags. Each of those is
a separate reason not to use it, and all were measured (§6), not assumed:

1. **Timestamps.** It restores the source's `mtime` onto a file whose contents just changed —
   measured: the destination's mtime became the source's year-2000 value. Every mtime-driven tool
   (a backup, a cloud-sync agent, `rsync`, `make`, anything watching for modification) would then be
   told the file did not change. **Restoring a stale mtime is not preservation; it is a lie about the
   edit that just happened**, and its failure mode is a save that never leaves the machine.
2. **BSD flags.** A `uchg` target puts `uchg` on the temp file, and then — measured — the very next
   `rename()` fails with `EPERM` *and* the cleanup guard's `remove_file` fails too, leaving a temp file
   behind that the process cannot delete. Experiment E22 (§7) fires exactly this in the existing suite.
3. **Mode bits.** Step 7b already sets them, from an `fstat` on the same descriptor whose bytes were
   hashed. Two mechanisms writing one property is how they come to disagree.
4. **Owner and group.** They need privilege this process does not have, and §5 says what actually
   happens to each instead of implying they are handled.

`COPYFILE_SECURITY` (= `STAT | ACL`) and `COPYFILE_METADATA` (= `SECURITY | XATTR`) are the named
combinations, and both include `STAT`, so both are out for the same four reasons. `COPYFILE_DATA` is
deliberately absent: the candidate's bytes are written by `write_all`, verified at step 11, and
`copyfile` must never be the thing that puts data on disk. **Measured: the data is untouched** — a
destination holding 19 bytes still held exactly those 19 bytes after the copy, and three acceptance
tests assert the file's contents afterwards.

### 3.3 The ordering, restated after the review round

The order the code executes, and it is **not** the order the plan numbers the steps:

```
create temp (0o600, write-only)
  → write_all → flush → sync_all              (step 8, while still 0o600)
  → copy_metadata                             (step 7a)
  → File::set_permissions, i.e. fchmod        (step 7b)
  → sync_all again                            (step 8's second half)
  → verify_temp_identity                      (the temp *name* still names this inode)
  → drop(handle) → recheck_target → rename → sync the directory
```

Each hop of it buys one thing:

1. **The bytes go in while the file is still `0o600`.** This is the review's finding 5. The candidate
   is never more permissive than `0o600` until it is complete, so there is no window in which a
   legitimate reader of the target's mode — someone the mode bits admit — can open the named temp file
   and observe an empty, partial or unvalidated candidate. The previous order (copy → chmod → write)
   was not *less* protected than the final file, which is why the review called it should-fix rather
   than blocking; it was simply readable earlier than it needed to be.
2. **The mode still goes on after the metadata copy**, so it keeps exactly one owner. Measured,
   `COPYFILE_ACL | COPYFILE_XATTR` leaves the destination's mode untouched (`0o600` stayed `0o600`),
   so the two do not in fact collide today; the ordering is what stops that measurement from being
   load-bearing. Whatever `copyfile` does to the mode, step 7b runs after it and is the last word.
3. **No data write follows `fcopyfile`.** That disposes of the review's finding 1 entirely: the
   question of whether a metadata-only `fcopyfile` leaves either descriptor's file offset where it
   found it can no longer affect anything, because nothing after the call depends on an offset. The
   defensive `lseek` the review offered as an alternative is therefore not needed and was not added.
4. **The metadata is copied as late as it can be**, which *shrinks* the window in the review's finding
   11 — another process changing the target's ACL, xattrs, mode or flags after the copy and before the
   rename. It does not close it; §8 hole 13 records that as a hole.
5. **A second `sync_all`** (finding 14) persists the ACL, the extended attributes and the mode bits,
   which the first one ran too early to cover.
6. **The temp pathname is proved before it is used.** Everything above is done to an open descriptor,
   which resolves no path; `rename()` is the one step that cannot be, so `verify_temp_identity`
   compares `fstat` on the descriptor against `lstat` on the name immediately before the commit.

One argument from the first pass **no longer carries weight and is recorded as superseded**: it said
the temp file must be opened before the ACL is copied onto it, so that a copied `everyone deny write`
entry cannot stop `write_all` — the descriptor's permission check already happened at `open` time.
That is still true, and it is now moot: the bytes are in before the ACL arrives at all.

### 3.4 The state argument is `NULL`, deliberately

`copyfile(3)` documents a `NULL` state as *"both functions will work normally, but less control will be
available to the caller"*. Nothing here wants that control — no progress callback, no per-attribute
filter, no `COPYFILE_STATE_COPIED` accounting — and a `copyfile_state_t` would be an allocation to free
on every early return, in a function whose whole body is one call. A leak or a double free is a real
cost; the control is not a real benefit.

---

## 4. Decision — a metadata copy that fails **refuses the write**

If `copy_metadata` fails, the write stops. **The target is left byte-identical and keeps its
protection**, deletion of the candidate is *attempted*, and the caller gets
`WriteError::Io { step: WriteStep::CopyMetadata }`, for which `WriteStep::after_rename()` and
`WriteError::may_have_written()` both answer `false`.

The wording of that first sentence is load-bearing and was corrected in the review round (§11 findings
7 and 8): the guarantee is about **the target**, not about the temp file. A candidate inode may hold
the whole of the new bytes and may survive the failure, because `TempFile` swallows a failing
`remove_file` and a copied denying ACL can make that `remove_file` fail.

### 4.1 Why the typed representation is a `WriteStep` and not a new `WriteError` variant

`WriteError::Io` already exists to mean *the filesystem refused an operation*, and it already carries a
`WriteStep` so a caller can tell **which** operation without parsing English (2a-1 §7, plan §9). A
metadata-copy failure is exactly that: an OS call returned `-1`. Giving it a variant of its own would
have said it is a different *kind* of thing, and it is not — what makes it distinguishable is which
step it happened on, which is what the step marker is for.

The classification that follows is the one 2a-2b's `SaveError::is_refusal()` already computes:
`WriteError::Io` is a **failure**, not a refusal. That is right. No check declined anything and there is
no different way for the user to retry; the environment refused. A caller shows it as a problem, not as
a choice.

### 4.2 The argument against the alternative

The alternative — commit the bytes, report the lost metadata on the success value — is defensible and
is worse, for four reasons:

1. **It converts a metadata failure into a silent access-control change.** A caller that does not read
   the new field writes a file more accessible than the one it replaced, and nothing anywhere says so.
   A `Result` is `#[must_use]`; a field on a struct is not. This project has repeatedly chosen the
   shape that cannot be ignored, and this is the same choice.
2. **The refusal costs the user nothing but the attempt.** This is the point the "it costs the user
   their edit" framing gets wrong: the transaction returns an error, the caller still holds the
   candidate, the document in the editor is untouched, and the file on disk keeps **both** its old
   bytes and its old protection. Nothing is destroyed and nothing is unrecoverable. The user retries,
   or investigates, or is told what happened.
3. **It is the project's own established rule.** 2a-2b §9 findings 5 and 6 decided a strictly harder
   version of this question in the same direction, in these words: *"Refusing a save never destroys
   data; permitting one might. The reversible direction is to refuse."* Answering it the other way here
   would be two rules for one principle.
4. **There is no undo for the permissive direction.** If the write commits without the ACL, the ACL is
   gone; nothing in this crate knows what it was, and 2a-3b's backups will not help because a backup of
   the *old* file is not a way to put an ACL back on the new one. A refusal, by contrast, leaves the
   target exactly as it found it — bytes and protection both.

**What the argument for the alternative gets right, and where it is answered.** It is genuinely
unpleasant that a problem unrelated to the user's edit can stop the edit from landing. The honest
mitigation is not to weaken the policy but to keep the refusal **rare and legible**: the step marker
names the exact operation, the failure happens before the rename so the caller can say *the file on
disk was left as it was*, and §6's measurements say the call succeeds on ordinary files, on files with
no metadata at all, and on a destination opened write-only. If a real-world failure mode is ever found
that is both common and benign, the place to revisit this is here, with that failure mode named — not
now, on the strength of one that has not been observed.

### 4.3 The i18n obligation, checked rather than assumed

`WriteStep` and `WriteError` are **not** `Serialize`, and this sub-phase did not make them so. So
`src-tauri/src/dictionary_contract.rs`'s
`every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code` does not see them and **no dictionary
key is owed today** — verified by the check passing unchanged. The obligation transfers to 2b exactly
like the others: the day `WriteError` gains `Serialize`, `WriteStep::CopyMetadata` owes a string in
**both** `src/lib/i18n/en.json` and `es.json`, together with the other ten steps and with `WriteError`,
`TargetDifference`, `SaveError`, `SaveVerdict`, `SaveRefusal`, `Acknowledgement`, `Finding`,
`FindingCode`, `FindingClass` and `EditError`. That is the same large, single, indivisible change 2a-2b
§8 addressed to 2b, one variant larger.

No i18n JSON file was touched by this sub-phase.

---

## 5. Plan §7 row 11, all four of it, in one place

Row 11 reads *"changing permissions / ownership / line endings / BOM → capture and restore all four"*.
The four have **three different mechanisms**, and saying so is the point of this section — the row's
phrasing implies one, and two of the four were never this module's to restore.

| Row 11 names | Status | By what mechanism |
|---|---|---|
| **line endings** | **preserved, by construction** | the span layer, not this code. Every edit is a byte-span replacement and everything outside the span comes out byte-identical, so there is nothing to capture and nothing to restore. `crlf-line-endings.yml` and `file-comments-and-mixed-endings.yml` go through the whole transaction and commit |
| **BOM** | **preserved, by construction** | the same. `bom-utf8.yml` goes through the whole transaction and commits |
| **permissions** | **restored** — mode bits **and ACL** | mode bits by `fstat` on the same descriptor whose bytes were hashed, applied at step 7b with `File::set_permissions` — `fchmod` on the candidate's own descriptor, never on its name; the ACL by `fcopyfile(COPYFILE_ACL)` through that same descriptor at step 7a |
| **ownership** | **not restored**, and cannot be by an unprivileged process | below |

**Re-implementing the first two would have been the wrong answer**, and it is worth saying why: a
capture-and-restore of line endings or of a BOM would mean *re-encoding the file*, which is precisely
what this application exists not to do. They are preserved because nothing reformats, and that is a
stronger guarantee than restoring them would be.

### Ownership, honestly

`chown` to another user needs privilege the app does not have, and `COPYFILE_STAT` — which is what
would attempt owner and group — is out for the four reasons in §3.2. So:

- **uid.** When the user owns the file — the ordinary case for an espanso configuration under their own
  home directory — the temp file is created by that same user and the uid matches **by construction**.
  When they do not own it, this write makes them the owner. No flag set available to an unprivileged
  process could have prevented that: `COPYFILE_STAT` would attempt the `chown`, and an unprivileged
  `chown` to another uid is `EPERM`. **This is a residual, and it is unfixable at this privilege
  level.**
- **gid.** Measured (§6, measurement 1): on macOS a new file inherits the **containing directory's**
  group, not the creating process's. The temp file is created in the target's own directory, so the
  group matches whenever the target's group matches its directory's — again by construction rather than
  by capture. **A target whose group was changed away from its directory's loses that group**, and this
  is not detected and not reported.

### What a new inode still drops

Even with step 7a, a temp file plus a rename installs a new inode. 2a-1 §4 enumerated eight classes;
this sub-phase answers **three** of them and continues to drop **five**:

| 2a-1 §4's class | Now |
|---|---|
| POSIX ACLs | **restored** (§3) |
| extended attributes | **restored** — Finder tags, Finder comments, `com.apple.quarantine`, every `com.apple.metadata:*` |
| resource forks | **restored where the filesystem exposes them as an extended attribute** (`com.apple.ResourceFork`), which is what modern macOS filesystems do. Not a promise about every destination volume — the review's finding 4, accepted as a qualification |
| owner (uid) | dropped; matches by construction in the ordinary case |
| group (gid) | dropped; matches by construction in the ordinary case |
| creation time, file identity | dropped — `st_birthtime` resets and the inode number changes |
| BSD flags (`uchg`, `SF_IMMUTABLE`) | dropped **on purpose** (§3.2, measurement 4) |
| hard links | dropped — other links keep the old inode, so they no longer see the edit |

**`com.apple.quarantine` is carried forward on purpose, and that is the *correct* behaviour** — the
review's finding 4 confirms it and the first pass listed the attribute without saying why. This call
replaces the contents of **one logical file**; the quarantine attribute is a property of that file,
so dropping it merely because a new inode is installed would silently un-quarantine something the
system had marked. That is an accidental security change in the permissive direction, which is the
exact class of change this whole sub-phase exists to stop. The alternative — deliberately clearing it
because "our app wrote these bytes" — would be a policy decision about macOS's quarantine system that
this crate has no business making.

**Hazard 11 is now three-quarters closed rather than a quarter** (2a-1 §12's phrasing). It is not
closed, and it should not be described as closed: ownership and hard links remain, and both are
properties no unprivileged rename-based writer can preserve.

---

## 6. macOS measurements — what was measured rather than asserted

All on this machine: APFS, macOS 27 (build 26A5388g), arm64, as an unprivileged user in groups 20
(`staff`) and 12 (`everyone`). A throwaway program in `/tmp`, not committed.

| # | Question | Measurement |
|---|---|---|
| 1 | Does a new file inherit the process's group or the directory's? | **the directory's.** A directory `chgrp`ed to gid 12 produced a child with gid 12 while the process's egid was 20. This is what makes §5's gid claim "by construction" and not a hope |
| 2 | Does `COPYFILE_ACL \| COPYFILE_XATTR` touch the **mode**? | **No.** A `0o600` destination stayed `0o600` while the source was `0o640`. §3.3's ordering is belt-and-braces, not a dependency on this |
| 3 | Does it touch the **data**? | **No.** A destination holding 19 bytes held exactly those 19 bytes afterwards, with the source holding different bytes |
| 4 | Does `COPYFILE_STAT` do what §3.2 claims? | **Yes, all of it.** mode `0o600 → 0o640`, gid `20 → 12`, **mtime restored to the source's year-2000 value**, and `st_flags` `0 → 0x2` (`UF_IMMUTABLE`) — after which `rename()` of that temp file failed with `EPERM` (errno 1) and `chflags` on the leftover could not find it to clear |
| 5 | Does copying a `deny delete` ACL break the rename? | **It fails either way, so it is not a regression.** With the copy, `rename()` → `EACCES` (13) and `remove_file` on the temp file → `EACCES`. **Without** the copy — that is, the code exactly as 2a-1 left it — `rename()` → `EACCES` (13) just the same, because the entry is on the *target*. A file carrying `everyone deny delete` was never saveable through this primitive |
| 6 | Are the other denying entries safe? | **Yes.** `deny write`, `deny writeattr,writeextattr` and `deny chown` all copied **and** renamed successfully, and the entry was on the target afterwards. `deny read` is a different story: the target cannot be opened at all, so `inspect_target` refuses before any of this — pre-existing, unchanged |
| 7 | What does the code do **today** with a `deny write` ACL? | **Drops it silently.** `ls -lde` on the target after a rename showed no ACL at all. This is the defect, reproduced before it was fixed |
| 8 | Do several attributes survive at once, including a large one? | **Yes.** A Finder tag, a Finder comment, `com.apple.quarantine` and a 200 KB `com.apple.ResourceFork` all arrived. `com.apple.quarantine`'s value is rewritten by the OS on `setxattr`, which is why the acceptance test does not assert equality on that one |
| 9 | Does the destination need to be opened for **reading**? | **No.** A destination opened `write(true)` only — which is exactly what `create_temp_file` does — carried both the ACL and the attributes. No change to the temp file's open flags was needed |
| 10 | Does a source opened `O_NOFOLLOW \| O_NONBLOCK` work? | **Yes.** Which matters, because that is the only descriptor this code has |
| 11 | What does it cost? | **112.9 µs** per call with an ACL and an attribute to copy; **66.4 µs** with nothing to copy. Release build, 200 iterations each |
| 12 | How does an invalid descriptor fail? | source `i32::MAX` → `EBADF` (9); source `-1` → `EINVAL` (22); a **closed destination** → **`0`, success** (§8 hole 3) |

**On cost.** 2a-1 §6 measured a single `sync_all()` on a regular file at **4.05 ms**. So step 7a costs
**about 2.8% of one fsync the same save already pays**, and about 1.6% when there is nothing to carry.
It is not free and it is not worth optimising.

---

## 7. The disabling experiments

Each sabotage was applied to production code, the affected binaries were run, and the change was
reverted; `persist/write.rs` was then compared byte for byte against a copy taken beforehand and
restored identically. **An experiment that fires nothing is a test that measures nothing**, and one of
these fired nothing — it is recorded as what it is.

| # | Sabotage | Result |
|---|---|---|
| **E20** | `copy_metadata` is never called | **fires (4)** — `extended_attributes_on_the_target_survive_the_write`, `an_access_control_list_on_the_target_survives_the_write`, `the_mode_bits_survive_beside_an_access_control_list_and_an_attribute`, and `a_committed_save_carries_the_targets_attributes_and_access_control_list` in the transaction's own binary. This is the acceptance criterion's experiment: remove the call, watch the tests fail, restore |
| **E21** | the flag set loses `COPYFILE_ACL`, keeping `COPYFILE_XATTR` | **fires (3)** — the two ACL tests and the save-level test; the attribute test stays green. Deliberately narrower than E20: it isolates the **ACL** flag from the attribute flag, so a suite that only ever proved "some metadata moved" would be caught here |
| **E22** | the flag set **gains** `COPYFILE_STAT` | **fires (1)**, and not the one anybody would predict: `no_temp_file_survives_a_failure_after_the_temp_file_exists` fails with `["_base.yml.espansoconfig-….tmp", "base.yml"]` where only `base.yml` was wanted. The `uchg` flag on that test's target is copied onto the temp file, the rename fails as it already did, and then the guard **cannot delete the candidate**. §3.2's second reason, reproduced by an existing test that was written for something else entirely |
| **E23** | the source descriptor is a fresh `File::open(target)` instead of `inspected.handle` | **fires nothing.** It cannot: the difference is a TOCTOU window between two opens, and reproducing it needs a second process replacing the file inside a window a few syscalls wide. Recorded as hole 4 rather than left as an untested claim |

| **E24** | *(review round)* the mode bits are applied **before** `write_all` again — the ordering §11 finding 5 replaced | **fires (1)** — `the_temp_file_is_not_widened_before_its_bytes_are_on_disk`, with samples of a temp file wearing `0o644` while it was still shorter than the 8 MiB payload. Applied by moving the `set_permissions` block, run, then `persist/write.rs` restored and compared byte for byte |

E20 is the criterion the brief named, and it was run in both directions in **both** rounds: the four
failures above, then the call restored and the whole suite green again — 731 tests in the first pass,
736 after the review round.

---

## 8. Coverage holes, stated as holes

1. **No test makes `copy_metadata` fail inside the primitive.** No input is known that does. What is
   pinned is the *classification* — `CopyMetadata` is before the rename, and an `Io` carrying it never
   reports a possible write — plus a unit test that reaches the syscall's error arm directly with an
   invalid descriptor. §4's policy is therefore proven **as a decision about types**, not as an
   observed refusal of a real save. This is the same shape as 2a-2b's hole 16, and for the same reason.
2. **Nothing measures the failure the policy is designed for.** The scenario §4 argues about — an ACL
   that cannot be copied — has never been produced on this machine, and it is not known whether it is
   reachable at all on APFS. A volume with no extended-attribute support was *not* tested, and the
   likely result there is success-with-nothing-to-copy rather than failure, so it would not settle the
   question either. If the refusal turns out to be reachable in a benign way, §4.2's last paragraph is
   where the decision should be re-opened.
3. **An invalid *destination* descriptor is not detected by `fcopyfile` at all** — measured: it answers
   `0`. So the error arm covers a bad source and not a bad destination. It does not matter here (the
   destination is a `File` this function's caller just created and still owns) but it means the call is
   **not** a general integrity check, and a future caller must not treat a `0` as proof the copy landed.
4. **The "same descriptor" argument is untested** (E23). Holding `inspected.handle` instead of
   re-opening by path is correct reasoning about a TOCTOU, and nothing in this repository can
   demonstrate it — it needs a second process replacing the target between two opens, and **no test in
   this repository involves a second process** (2a-1 hole 1, 2a-2b hole 5, unchanged).
5. **The mtime argument against `COPYFILE_STAT` has no test.** E22 fires on the BSD-flag consequence
   alone. Nothing in the suite would notice if a future change restored the source's mtime onto a
   modified file, and that is the consequence §3.2 considers most damaging. A test would have to assert
   that the target's mtime *moved forward* across a save, which is a claim about the clock; it was not
   written, and the gap is named here instead.
6. **A file carrying `everyone deny delete` cannot be saved through this application**, and now cannot
   be for two reasons instead of one. It was already unsaveable (measurement 5) because the entry sits
   on the target and stops the rename; the copy adds a second instance of the same block on the
   candidate. The refusal is clean — the target keeps its bytes — but the **temp file cannot be
   deleted**, so a leftover accumulates on every attempt. 2a-1's guard documentation already covers why
   a leftover is harmless (the *name*, not the guard, is the safety property), but "harmless" is not
   "absent", and nothing cleans them up. **The review round stopped this being only a note**: the test
   now observes the leftover and asserts the property that actually protects the user — espanso's glob
   cannot match its name — and every claim in the crate that a failure *deletes* the temp file was
   removed (§11 findings 7 and 8).
7. **The ACL tests read `ls -lde` and compare strings.** That is a transcription of what `ls` prints,
   not an inspection of the ACL structure, so an ACL that changed in a way `ls` renders identically
   would pass. Setting an ACL from Rust means `acl_from_text`, `acl_set_fd` and a hand-built `acl_t` —
   more platform surface in the test than in the code it tests — so the shell command was chosen
   deliberately, with a clean skip when it is unavailable.
8. **Every ACL test can skip.** They print a reason and return when `chmod +a` fails or the volume does
   not keep the entry. On a volume without ACL support the ACL half of this sub-phase has **no
   coverage at all** and the suite still passes green. The extended-attribute tests cannot skip, and
   the save-level test degrades to measuring only the attribute.
9. **Nothing here has been checked against a real espanso configuration directory with Finder tags on
   it.** The real-corpus sweep copies files into a `TempDir` first (`CLAUDE.md` §1), and a copy does
   not necessarily carry the tags the original had. So the claim *"a user who tagged their config in
   Finder keeps the tag"* is supported by synthetic attributes on synthetic files, never by an
   observation of the owner's own tagged file.
10. **Off macOS the guarantee simply does not exist**, and no test says so out loud because every test
    of it is `cfg`-gated away there. A CI on Linux would report this sub-phase as fully passing while
    testing none of it.
11. **Ownership and hard links remain dropped** (§5), and both are unfixable by a rename-based writer at
    this privilege level. A dotfiles setup that **hard-links** its espanso config instead of symlinking
    it is still silently separated from its other name by the first save. 2a-1 §3 answered the symlink
    case; the hard-link case has no answer and is not detected.
12. **The `st_birthtime` reset is not tested**, only inherited from 2a-1's inode measurement. Nothing
    asserts what a file's creation date looks like after a save.

The review round added three more, and they are holes rather than fixes on purpose:

13. **The pre-commit re-check does not compare *metadata*, so a protection change made under the write
    is silently lost.** Another process can change the target's ACL, extended attributes, mode or BSD
    flags after `copy_metadata` has read them and before the `rename()`. The content hash still
    matches and the `(dev, ino)` pair still matches, so `recheck_target` sees nothing, and the
    candidate — carrying the *older* protection — is committed over the newer one. This is the
    review's finding 11, accepted in full. §3.3's reordering **shrinks** the window to the few
    syscalls between the copy and the rename and does not close it. Closing it needs one of two
    things, and both are design changes beyond a review round: either the re-check captures the
    target's ACL, xattrs, mode and flags at step 7a and compares them again immediately before the
    commit — which means deciding what a *difference* means, since the copy has already happened and
    the answer is probably "start again" rather than "refuse" — or an inter-process lock, which
    nothing outside this application takes (2a-1's residual race, unchanged). **The in-process
    per-path lock cannot close it**, because the writers this hole is about do not take it.
14. **The temp-pathname identity check narrows a race it cannot close, and the precondition it leaves
    standing is not testable here.** `verify_temp_identity` proves the name still refers to the
    descriptor's inode; the `rename()` a few instructions later still takes a *name*, and there is no
    descriptor-based form of it on macOS. **A directory writable by an untrusted principal is
    therefore an explicit precondition**, stated as such in `persist/write.rs`'s module documentation
    rather than described as solved. Nothing in this repository can demonstrate either the attack or
    the defence end to end, because that needs a second process (2a-1 hole 1, unchanged); what is
    demonstrated is the check itself, by four unit tests that replace the directory entry directly.
    The window is also **wider than the check's own placement suggests**: `recheck_target` runs between
    it and the `rename()`, and that is a full re-read of the target. Ordering the two the other way
    would move the window from the temp name to the target, which is the object that matters; both
    cannot be last.
15. **The widening test can measure nothing and still pass.** `the_temp_file_is_not_widened_before_its_bytes_are_on_disk`
    asserts an invariant over whatever its poller managed to sample, and prints a NOTE when it sampled
    the temp file zero times. That is deliberate: "the window was sampled" is a claim about the
    machine's scheduler, and a test that fails on a busy machine is a worse instrument than one that
    says out loud it measured nothing. Observed on this machine it takes hundreds of samples (§9), and
    E24 fires it — but a green run is not by itself proof that the ordering was exercised.

---

## 9. Verification

Each command run separately, at the repository root.

| Command | Exit |
|---|---|
| `cargo fmt --check` | 0 |
| `cargo build --workspace` | 0 |
| `cargo test --workspace` | 0 — 19 test binaries, **731 tests**, 0 failed, 0 ignored |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0, no warnings |
| `cargo tree -p espansoconfig-core \| rg tauri` | **1 — nothing found**, which is the required result (`CLAUDE.md` §3, D2x) |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 cargo test -p espansoconfig-core --test persist_save -- saving_the_real_configuration` | 0 — 13 files, 65 matches, 13 committed, **0 refusals** |
| `npm test` | 0 — 27 files, 662 tests. Run for completeness; **no i18n JSON was touched** |

The baseline was **723**; this sub-phase adds **8** — five in `tests/persist_write.rs`, two unit tests
in `persist/write.rs` and one in `tests/persist_save.rs`. One dependency was added, `libc`, in a
`cfg(target_os = "macos")` target section of `espansoconfig-core` and in the workspace's version table.
`tests/corpus_integrity.rs` passes unchanged, and no file under `tests/corpus/` was written, moved or
reformatted.

### 9.1 The review round, re-run

| Command | Exit |
|---|---|
| `cargo fmt --check` | 0 |
| `cargo build --workspace` | 0 |
| `cargo test --workspace` | 0 — 19 test binaries, **736 tests**, 0 failed, 0 ignored |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0, no warnings |
| `cargo tree -p espansoconfig-core \| rg tauri` | **1 — nothing found**, which is the required result (`CLAUDE.md` §3, D2x) |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 cargo test -p espansoconfig-core --test persist_save -- saving_the_real_configuration` | 0 — 13 files, 65 matches, 13 committed, **0 refusals** |

**731 → 736**: four unit tests on `verify_temp_identity` in `persist/write.rs` and one acceptance test
in `tests/persist_write.rs`. No dependency was added or removed, no file under `tests/corpus/` was
touched, and **no i18n JSON was touched** — `WriteError` still does not implement `Serialize`, so the
new `TempFileChangedDuringWrite` variant and the new `VerifyTempIdentity` step owe no dictionary key
today and join the list §4.3 addresses to 2b. `npm test` was **not** re-run in this round for that
reason: nothing under `src/` changed.

Two numbers observed rather than asserted: `the_temp_file_is_not_widened_before_its_bytes_are_on_disk`
took **437 samples of the temp file, 269 of them still `0o600`**, and none of the widened ones was
short; `an_access_control_list_that_denies_delete_refuses_and_can_leave_a_temp_file` reported **1 temp
file surviving the refusal**, which is finding 7 measured rather than argued.

**Privacy.** Nothing here reads `tests/corpus/real/` except the pre-existing sweep, which copies files
into a `TempDir` and prints counts and nothing else. Every byte written by the new tests is
hand-authored neutral YAML declared as a `const`, and every extended attribute they set is a neutral
literal (`"espansoconfig-test"`, `"a neutral comment"`, `"carried across the rename"`).

---

## 10. What the rest of 2a-3 and 2b inherit, and should not rebuild

- **Hazard 11 is three-quarters closed, not closed.** ACLs, extended attributes and resource forks
  travel; ownership, group, creation time, BSD flags and hard links do not, and the last four cannot at
  this privilege level. Phase 2 must not describe row 11 as satisfied — §5 is the sentence to quote.
- **Backups (2a-3b) inherit the same question and should get the same answer.** A backup copy is a new
  inode too, and a backup that drops the original's ACL is a backup that cannot restore it.
  `copy_metadata` is right there, private to `persist::write`; making it `pub(super)` when the backup
  step needs it keeps **one** answer to "what does a copy carry" rather than two that drift.
  `COPYFILE_STAT` will be as wrong there as it is here — a restored backup with the original's mtime is
  the same lie — but `COPYFILE_DATA` becomes *right* there, because a backup **is** the data.
- **Every read of a save target still goes through `inspect_target`**, and it now hands back the open
  descriptor as well. A backup step that needs the target's bytes has them in `InspectedTarget::bytes`
  already and must not open the file again (2a-2b §9 finding 8's deadlock).
- **`WriteStep::CopyMetadata` and `WriteStep::VerifyTempIdentity` owe a dictionary entry the day
  `WriteError` gains `Serialize`**, in both `en.json` and `es.json`, as one indivisible change with the
  other eleven steps and the six enums 2a-2b §8 lists — and so does the new
  `WriteError::TempFileChangedDuringWrite`. Nothing is owed today (§4.3).
- **No sentence anywhere may say that a failed save deletes the temp file.** The true sentence is
  about the target: *it keeps its bytes and its protection*. A temp file may survive, and on a target
  carrying `everyone deny delete` it certainly does. This joins the forbidden sentences 2a-2b §8
  lists.
- **A hostile directory is a precondition, not a solved problem.** `verify_temp_identity` narrows the
  temp-pathname race and the `rename()` after it is still by name. Any later sub-phase that moves file
  writing anywhere else — backups included — inherits the same precondition and must not describe it
  as handled.
- **A user-facing string must never say the file's metadata is preserved.** The true sentence is
  narrower and is §5's: *permissions and extended attributes are carried across; ownership and hard
  links are not.* That joins the three sentences 2a-2b §8 already forbids — *espanso will reject this*,
  *your edit cannot be lost*, *this file is valid* — and 2a-3b will add a fourth, *your file is
  recoverable*.
- **The refusal at `CopyMetadata` needs a sentence 2b can show**, and it is not a retry prompt: nothing
  the user does differently will change it, and the file is untouched. It is closer to *this file's
  protection could not be carried over, so the file was left as it was* than to any offer — and note
  the wording, because *nothing was written* is the phrase §11 finding 8 removed.
- **This sub-phase is macOS-only in a way the rest of the crate is not.** `espansoconfig-core` still
  builds and tests anywhere; what it no longer *promises* anywhere is this guarantee. Any future claim
  that the core is platform-independent has to be read with §2.3 beside it.

---

## 11. Review disposition — the fourteen findings

`docs/reviews/2a-3a-codex.md` returned fourteen findings on the `fcopyfile` step: **two blocking**
(8 and 12), **five should-fix** (1, 5, 7, 9, 11) and **seven nits**. The verdict was *"`fcopyfile`
itself is suitable, but the guaranteed-cleanup / 'nothing written' claim and the named-temp pathname
race should be fixed before committing as safe."*

**Both blocking findings are fixed in code.** Of the rest: four are fixed in code, six are fixed in
documentation, and **four required no change because they are confirmations** — the review checked
something and found it correct, which is worth recording as a checked thing rather than omitting.

Two of the review's own factual claims were **measured on this machine before being acted on**, and
both held; each is cited where it is used.

### 1 — should-fix — source/destination offsets after a metadata-only `fcopyfile`. **Fixed, by the reordering, not by a seek.**

The review was unsure whether every supported macOS release promises that a metadata-only `fcopyfile`
leaves both descriptors' observable offsets unchanged, and offered an explicit `lseek` to 0 before
`write_all` as a defensive measure.

The reordering in finding 5 **removes the question instead of defending against it**: `write_all` now
happens *before* `copy_metadata`, so no data write follows the copy at all and no offset either call
leaves behind can affect anything. A defensive seek would have been dead code that looked like a
precaution. §3.3 point 3 records it.

### 2 — nit — "no data writes" was misleading. **Fixed, documentation.**

`copy_metadata`'s doc comment and its `SAFETY` comment both implied the call touches nothing but
metadata. It does write: an ACL, extended-attribute storage, and through `COPYFILE_XATTR` a resource
fork. The wording is now *"does not copy or truncate the destination's **main data fork**"*, which is
the true and narrower claim, and the `SAFETY` comment says the same.

### 3 — nit — descriptor access modes. **Confirmation. No change.**

The review checked all four of the access-mode claims and found them correct: a readable source is
enough, a **write-only** destination is enough for installing ACLs and extended attributes, neither
end needs the destination's data fork read, and `O_NONBLOCK` is meaningless on an already-open regular
file. That is exactly measurement 9 of §6, independently confirmed. Nothing changed, and the
confirmation is recorded here so that a future reader does not re-open a settled question.

### 4 — nit — resource forks and `com.apple.quarantine`. **Fixed, documentation, both halves.**

- **Resource forks** are now documented as preserved **where the filesystem exposes them as an
  extended attribute** (`com.apple.ResourceFork`), rather than as a universal promise about every
  destination volume. §5's table row and `copy_metadata`'s doc comment both carry the qualification.
- **`com.apple.quarantine`** was listed among the attributes that travel without saying *why carrying
  it is the correct behaviour*. It now is, in §5 and in `copy_metadata`: this call replaces the
  contents of one logical file, so dropping the attribute merely because a new inode is installed
  would silently un-quarantine something the system had marked — an accidental security change in the
  permissive direction, which is the class of change this whole sub-phase exists to stop.

### 5 — should-fix — the temporary file's exposure window. **Fixed in code. It also disposes of finding 1, carries finding 14's second `sync_all`, and shrinks 11.**

The old order was `create 0o600 → copy ACL → apply target mode → write bytes`. That never made the
candidate *more* permissive than the final file will be — it receives the target's own ACL and mode —
but it did make a **named, incomplete** file readable by everyone the target's mode admits, in a
directory they can list. The new order is the review's own:

```
create 0o600 → write → flush → sync_all → copy ACL and xattrs → fchmod → sync_all again
  → verify the temp pathname → recheck the target → rename → sync the directory
```

The mode still goes on **after** the metadata copy, so it keeps exactly one owner — that part of the
first pass was correct and was preserved deliberately. §3.3 states the whole ordering and what each
hop buys.

Pinned by `the_temp_file_is_not_widened_before_its_bytes_are_on_disk`, which asserts an invariant
rather than a schedule — *no sample may wear a mode wider than `0o600` while the file is shorter than
the payload* — and by **E24**, which restores the old ordering and fires it. Hole 15 records what the
test cannot promise.

### 6 — nit — `chmod` after copying an ACL. **Confirmation, and measured here before being trusted. No change.**

The review states that an ordinary `chmod` on macOS does not clear the extended NFSv4-style ACL, so
the existing ordering never silently discarded the copied ACL. **Verified on this machine** rather
than taken on trust:

```sh
touch f; chmod +a "everyone deny write" f; ls -le f; chmod 0644 f; ls -le f
```

the entry survives the `chmod`. The ordering is therefore safe as it stands, and the review's
qualification — that this must not be generalised to POSIX ACL implementations on other operating
systems — is not a problem here, because the function is macOS-only by construction (§2.3).

### 7 — should-fix — a copied ACL can defeat cleanup. **Accepted. The claim was removed; the cleanup was not strengthened.**

The review is right on both halves: an ACL installed after the temp file was opened cannot revoke the
open descriptor's own access, so it does not break `write_all` or `fsync`; but deletion and rename are
authorised differently, and a copied denying entry **can** make both `rename` and the guard's
`remove_file` fail. §6 measurement 5 had already measured exactly that for `everyone deny delete`.

What was done is the review's *minimum*: **every claim in the crate that a failure deletes the temp
file is gone.** The sentence it named — step 7a's *"the guard deletes the candidate"* — is replaced,
and so are the same implication in `recheck_target`, in `TempFile`'s `Drop`, in `persist/mod.rs`, in
`lib.rs` and in §4 of this document. What replaces them all is the one thing that is true: **the
target keeps its bytes and its protection; a temp file may be left behind.**

`persist/write.rs` gained a *"What a failure leaves behind, stated exactly"* section saying it once,
and `an_access_control_list_that_denies_delete_refuses_and_can_leave_a_temp_file` now **observes** the
leftover and asserts the property that actually protects the user — espanso's glob cannot match its
name. It reported one surviving temp file.

The two stronger remedies the review offered were **not** taken, and the reason is scope rather than
disagreement. Neutralising the copied ACL before unlinking means writing ACLs from Rust
(`acl_from_text`, `acl_set_fd`, a hand-built `acl_t`), which is more platform surface than the code it
would protect; staging in a private `0700` directory changes where the temp file lives, and the temp
file's directory is load-bearing — `rename()` is only atomic within one filesystem, and the same-
directory rule is asserted by an existing test. Both are design changes, and hole 6 names the residue.

### 8 — BLOCKING — "nothing was written" is too strong. **Fixed, and the method deliberately kept its name.**

The review is correct that `may_have_written() == false` is only defensible if it means *the requested
target may have been replaced*, because a temp inode can hold the full contents and can survive.

**The method was not renamed.** `WriteError::may_have_written` is public API, its own doc comment
already said "Whether **this call's** rename may have completed" — which is the correct semantic — and
a rename would ripple through `SaveError::may_have_written`, its callers and its tests for no change
in meaning. What was fixed is the documentation, in the two places that matter:

- `may_have_written` now says explicitly that it is **a statement about the target**, that a `false`
  says this call did not replace the target and does **not** say that no inode anywhere received
  bytes, and that a candidate holding the whole new content plus the target's ACL and extended
  attributes may exist and may survive;
- the module documentation's new *"What a failure leaves behind"* section says the same once, for
  everything below it.

Finding 8 is closed by those two plus finding 7's bullet. The phrase *nothing was written* is gone
from every public-facing sentence about a failure; where a test name still contains it
(`a_metadata_copy_failure_is_a_refusal_that_has_written_nothing`) it is a statement about the target,
and the test's body asserts exactly that and nothing more.

### 9 — should-fix — `fcopyfile` is not transactional, and a `0` is not a verified inventory. **Fixed, documentation.**

`copy_metadata` gained a *"What a zero return proves, and what it does not"* section. It now says a
`0` is **the OS copying facility reporting success for the operations requested** — not an
independently verified, byte-for-byte inventory match — and names the three reasons: the call rolls
nothing back on failure, so a partially protected candidate can exist (which is also one of the ways
finding 7's cleanup fails); a filesystem may treat particular attributes specially and whether an ACL
entry could be silently filtered while the call still returns `0` is **not known here and was not
measured**; and an invalid *destination* descriptor is not detected at all. That last one is
pre-existing hole 3, which stays exactly as it was and is now cross-referenced from the code.

§3.2's *"Measured: the data is untouched"* is unchanged, because that one **is** a measurement.

### 10 — nit — the `unsafe` call. **Half confirmation, half fixed.**

The review confirms the Rust safety preconditions are met — both `File`s outlive the synchronous call,
the access modes suit, a `NULL` state is documented, the flag combination is valid, failure comes
through `errno` — and confirms that **`AsRawFd` is conventional and correct** for a C API taking
integer descriptors, with `AsFd` offering no substantive additional protection here since it would
still end in `as_raw_fd()`. **No change was made to the call**, and this half is recorded as a
confirmation.

The wording was wrong and is fixed: the comment said `fcopyfile` *"reads and writes only the two files
named"*. Descriptors name no path. It now says *"the file objects the two descriptors refer to"*, adds
that a descriptor naming no path is precisely why no third file can be reached from there, and drops
the implication that only the main data stream is involved.

### 11 — should-fix — the pre-commit re-check does not compare metadata. **Accepted in full. Not implemented. Recorded as hole 13.**

The review is right: another process can change the target's ACL, xattrs, mode or flags after
`copy_metadata` and before the rename; the content hash and the `(dev, ino)` pair still match, so
`recheck_target` sees nothing, and the newer protection is lost.

**No metadata recheck was implemented**, deliberately. It is a design change rather than a review fix:
it means deciding what a metadata *difference* means at a point where the copy has already happened
(the honest answer is probably "start again", not "refuse"), and the alternative the review also names
— an inter-process lock — is exactly the thing 2a-1's residual race records as unavailable, because no
other program takes it.

What this round *did* do is shrink the window: moving `copy_metadata` after the data write (finding 5)
leaves only a few syscalls between the copy and the rename, where before it was a whole file write and
an `fsync`. **Hole 13** states the hole, why it is left open, and what closing it would take.

### 12 — BLOCKING (attacker-writable directory) — the temp-file pathname race. **Fixed in code, with the residual precondition stated.**

Two changes, both the review's:

1. **`fs::set_permissions(guard.path(), …)` became `handle.set_permissions(…)`** — `fchmod` on the
   open descriptor. The `WriteStep::ApplyModeBits` marker and its error mapping are unchanged; only
   the object being chmod-ed changed, from a **name** to the **trusted inode**. With that, *every*
   operation between the temp file's creation and the commit is descriptor-based: the bytes, both
   `fsync`s, the metadata copy and the mode.
2. **A new check immediately before `drop(handle)`**: `verify_temp_identity` compares `fstat` on the
   descriptor against **`lstat`** — not `stat` — on the temp pathname, and refuses when they name
   different `(dev, ino)`. `lstat` is what makes an entry swapped for a symlink a mismatch rather than
   a dereference.

The typed shape, decided rather than defaulted: a **new `WriteStep::VerifyTempIdentity`** (a genuinely
new operation deserves its own marker, and `WriteStep` exists so a caller can tell operations apart),
and a **new `WriteError::TempFileChangedDuringWrite`**, because a name pointing at a different inode
is not "the filesystem refused an operation" and folding it into `WriteError::Io` would have been a
false statement in a type. It is not folded into `TargetChangedDuringWrite` either: nothing about the
target changed, and what did change says something different about the user's world — the *containing
directory* is being written by something else. A stat that fails outright is still
`WriteError::Io { step: VerifyTempIdentity }`, which is a third fact again.

`after_rename()` answers `false` for the new step and `may_have_written()` answers `false` for the new
variant, so both existing enumerating tests
(`a_caller_can_tell_the_steps_apart_without_reading_a_sentence`,
`only_the_two_post_rename_steps_report_a_possible_write`) still pass with the new members added to
their lists. `SaveError::is_refusal()` matches `WriteError` exhaustively and so was a compile error
until the new variant was classified: it is a **refusal**.

**The precondition the review demands is stated as a precondition**, in `persist/write.rs`'s new
*"Preconditions: the containing directory"* section: `rename()` takes two pathnames and has no
descriptor-based form, so a final race remains and **a directory writable by an untrusted principal is
out of scope**. Hole 14 records it too.

Four unit tests pin the check deterministically — an untouched name, a name repointed at another
inode, a name replaced by a symlink, and a name that vanished — by replacing the directory entry
directly, which is reachable from a test in a way the mid-write window is not.

**Two details where the implementation is not literally the review's sentence, said rather than
glossed.** The review asked to *"keep the descriptor open through rename"*; the descriptor is dropped
immediately after the identity check, because holding it open would not prevent an entry swap — only
the check does that, and the check has already run. And the identity check sits **before**
`recheck_target`, not in the last instruction before `rename()`, so the target's own re-read (a
`canonicalize`, an `open`, a full read and a hash) sits between it and the commit. That widens the
window this check narrows, from a handful of syscalls to a small file read; the trade is deliberate,
since `recheck_target` is what defends the *target*, which is the object that matters, and it must
stay as close to the rename as possible. Hole 14 carries it.

### 13 — nit — the flag selection. **Confirmation. No change.**

The review checked the flag set against every named alternative and agreed with all of it: excluding
`COPYFILE_STAT` is correct because it would restore timestamps and BSD flags including immutable ones
that obstruct rename and cleanup; `COPYFILE_SECURITY` (= `STAT | ACL`) and `COPYFILE_METADATA` are
both worse for containing `STAT`; the `COPYFILE_NOFOLLOW*` flags are irrelevant to a descriptor-taking
call; and `COPYFILE_ACL | COPYFILE_XATTR` is the right narrowly scoped choice. That is §3.2 and §6
measurement 4, independently confirmed. Recorded rather than omitted.

### 14 — nit — durability and ownership wording. **Fixed in code and in documentation.**

- **The second `sync_all`.** The review asked for one after the ACL, xattr and mode changes if the
  metadata copy moved after the initial data sync — which finding 5 did. It is there, carrying the
  existing `WriteStep::SyncTempFile` marker, since it is the same operation on the same file for the
  same reason.
- **`File::flush()`.** The review notes it adds little because `File` is not userspace-buffered, and
  is harmless. It is kept: it costs nothing and it is what makes the sequence read correctly.
- **Ownership wording.** `COPYFILE_STAT`'s absence means ownership is not copied, which is normally
  desirable — an unprivileged `chown` may be refused and could alter access semantics. The
  documentation already said what happens to uid and gid (§5); `copy_metadata` now also says in one
  sentence that what it preserves is *the ACL, the extended attributes and, through step 7b beside it,
  the mode bits* — **not** "the security metadata".

### The one measurement that made a fix safe

Reordering the metadata copy to *after* the data write is only sound if writing a file's data does not
disturb its extended attributes. **Verified on this machine** before the reordering was applied: a
`com.apple.metadata:kMDItemFinderComment` set on a file and then fully overwritten reads back intact.
Had it not held, finding 5 would have had to be answered differently — the exposure window traded
against losing the attributes it exists to preserve.
