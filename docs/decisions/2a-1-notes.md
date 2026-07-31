# Phase 2a-1 — the atomic file-replacement primitive

**What this sub-phase is.** The first code in the project that modifies a user's file. It implements
steps **1, 2 and 6–11** of `IMPLEMENTATION_PLAN.md` §6.6 and nothing else: an app-level per-path write
lock, a base-revision check, a uniquely named temp file in the target's own directory, a mode-bit copy,
an fsync, a **pre-commit re-check**, an atomic rename, a directory sync, and a read-back-and-hash
verification. It takes **finished bytes**. It does not build them, does not parse them, does not
validate them and writes no backup — steps 3–5 and 12–13 belong to 2a-2 and 2a-3.

**The one sentence that defines it, after the review:**

> **atomic replacement of an existing regular file, with optimistic conflict detection.**

The first version of this document said something stronger — *"replaces the bytes … only if the file
still holds what the caller believed it held"* — and the Codex review was right that this is false.
That sentence describes a **compare-and-swap on file contents**, and no ordinary POSIX or macOS
pathname operation provides one: `rename()` replaces whatever occupies the name at the instant it runs,
unconditionally. §2 is the whole of what was done about it. It is the most important change in the fix
round, and it is a change to *claims* far more than to code.

Nothing crosses the IPC boundary. There is no command, no wire type, no dictionary key and no screen;
§7 records why that is a decision about `Serialize` rather than an omission.

---

## 1. What was built

**`crates/espansoconfig-core/src/persist/write.rs`** — the whole primitive, and the only code in the
crate that opens a file for writing. Public surface:

| Item | What it is |
|---|---|
| `replace_file_atomically(path, expected, bytes)` | the primitive: steps 1, 2, 6–11. Returns the `ContentRevision` **read back from disk** |
| `lock_path(path)` | step 1 alone, returning a `PathWriteLock` guard |
| `replace_locked_file(&lock, expected, bytes)` | steps 2 and 6–11 for a caller that already holds the lock |
| `temp_file_name(&OsStr)` | step 6's naming rule, exposed so a test can assert against the name the code actually mints |
| `TEMP_NAME_PREFIX` · `TEMP_NAME_INFIX` · `TEMP_NAME_SUFFIX` | the `_` … `.espansoconfig-` … `.tmp` shape as data |
| `WriteError` · `WriteStep` · `TargetDifference` | the typed failures, which of the eleven steps an I/O error came from, and what changed under a write |

`PathWriteLock` exposes `path()` (the canonical target) **and** `requested_path()` (the caller's own
spelling, kept so it can be re-resolved before the commit — §2.2).

**`crates/espansoconfig-core/src/persist/mod.rs`** — the placeholder's doc comment kept both of its
load-bearing details (same directory; a name espanso's glob cannot match) and now states the contract
in the corrected terms, the mode-bit limitation, and that a missing target is a refusal rather than an
invitation to create.

**`crates/espansoconfig-core/tests/persist_write.rs`** — 25 tests. It is the first test binary whose
subject writes, and every one of them works inside a `tempfile::TempDir`. **14 more unit tests** live
beside the code in `write.rs` because they reach private items — the RAII guard, the mutex registry,
`inspect_target` and `recheck_target`, whose four refusal arms can only be pinned deterministically
from inside.

**`crates/espansoconfig-core/src/lib.rs`** — the phase table gained a **2a-1** row and the sentence
calling `persist` a stub was corrected.

---

## 2. Decision — what the primitive actually promises, and the residual race

### 2.1 The claim, corrected

**Atomic**, unconditionally: the bytes appear at the target in one indivisible step, and no reader ever
sees a partial file. That half was never in doubt.

**Conditional, optimistically**: the target's revision is compared with the caller's `expected` at
**two** moments — once at step 2, before the candidate is built, and once immediately before the
`rename()`. A difference at either is a refusal that writes nothing.

**Not a compare-and-swap.** Between the second check and the `rename()` there remains a window in which
a **non-cooperating** writer — vim, espanso, a cloud-sync agent, a second copy of this application —
can replace the target; this call then renames over that replacement and reports success, and the other
program's write is lost. The reviewer's scenario is exact and is reproduced here without softening:

1. the app reads revision A; 2. the save hashes A; 3. vim atomically replaces the target with revision
B; 4. the app renames its temp file over B; 5. the save returns success and vim's edit is gone.

The per-path lock does **not** address this. It excludes only this process's cooperating callers.

### 2.2 What the fix round did about it

A **pre-commit re-check** (`recheck_target`), run immediately before the rename, asking three
questions in the order a difference is cheapest to detect:

1. **does the caller's own path still resolve to this target?** This is the reviewer's medium finding
   about a symlink retargeted mid-call, and it is why `PathWriteLock` now keeps `requested_path()`.
   Failure → `TargetDifference::Retargeted { now }`;
2. **is it still the same inode, and still a regular file?** Compared as the `(dev, ino)` pair taken by
   `fstat`. Failure → `TargetDifference::Identity`, or `Vanished` if the entry is gone;
3. **does it still hash to `expected`?** Failure → `TargetDifference::Contents { expected, found }`.

**Why the identity check is not redundant with the hash.** It catches the case a revision comparison
*cannot express*: another process replaced the file with a different inode whose bytes happen to be
identical. `the_recheck_refuses_a_target_replaced_by_another_inode_with_identical_bytes` pins exactly
that, and asserts the bytes are unchanged first so the identity check is the only thing that can fire.

**What this buys, stated as a measurement rather than a feeling.** The window used to span *building,
writing and fsyncing an entire candidate file* — 4 ms of fsync alone on this machine (§6), plus the
write itself. It now spans the gap between the re-check and the `rename()`: a `canonicalize`, an
`open`/`fstat`/`read`/hash, and then the rename. **It is narrower, not closed, and it cannot be closed
at this layer.** Recoverability from what remains is backups (step 13) plus a conflict path, not a
stronger primitive.

**Cost:** one extra full read of the target per write. For an espanso configuration that is kilobytes.

### 2.3 A new variant, not a reused one

`TargetChangedDuringWrite` is **separate from** `RevisionMismatch`. The brief asked for this to be
decided and justified:

- they are **different facts about the user's world**. `RevisionMismatch` means *your document was
  already stale when you pressed save* — reload and re-apply. `TargetChangedDuringWrite` means *another
  program is writing this file right now* — which is a different sentence, a different likely cause,
  and plausibly a different offer to the user;
- `RevisionMismatch` carries two revisions and **cannot express** `TargetDifference::Identity`, where
  the two revisions are equal and the file is still a different object. Folding them would have thrown
  away the one thing the new check adds over the old one.

---

## 3. Decision — the target is **resolved** before it is locked, hashed or written

`fs::canonicalize` is called on the caller's path as the very first thing `lock_path` does.

**Why.** Espanso configurations are routinely symlinked out of a dotfiles repository, and `rename()`
over a symlink replaces **the symlink itself**. The link disappears, is silently replaced by a regular
file, and the file it used to point at keeps the old contents — the user's repository still holds the
snippet they just edited and the editor shows them a file that is no longer the one they manage. That
is hazard 9 of the plan's register, and it is the kind of failure discovered weeks later.

**What resolving buys, beyond the symlink:** one lock per real file; the temp file beside the real file
so the rename stays inside one filesystem (hazard 10 by construction); the revision verified against
the bytes that will be replaced.

**Measured, on this machine (APFS, macOS 27):** `canonicalize` collapses `.` and `..`, follows
symlinks, and rewrites `/var/folders/…` to `/private/var/folders/…`. It also folded the case of
`BASE.YML` onto the stored `Base.yml`. **That last one is a property of the volume, not of
`canonicalize`**, whose contract promises no such normalisation — the review was right that the
original wording claimed more than the API does. It is now written as a volume property and *measured*
by `two_case_variant_spellings_share_a_lock_on_a_case_insensitive_volume`, which skips with a printed
notice on a case-sensitive volume rather than asserting.

**What it costs, stated rather than hidden.**

1. A caller who genuinely wanted to *replace a symlink with a regular file* cannot do it here.
2. A path whose final component is a **dangling** symlink is `TargetMissing`, not a file this primitive
   creates.
3. Resolution happens **before** the lock, so it is not itself serialised. §2.2's re-check is what
   covers the interval; §10 hole 1 records what remains.

**`O_NOFOLLOW`.** The step-2 open requests it, so the final component is opened as *itself* and a
symlink planted at the resolved path is `ELOOP` rather than a second dereference. The constant is
hand-written (`0x100` on Apple/BSD, `0o400000` on Linux) because this crate has no `libc` dependency —
so `the_no_follow_flag_really_refuses_a_symlink` pins its **meaning**: a plain open of a symlink
succeeds, the same open with the flag fails with `ELOOP` (62). A wrong constant is a test failure, not
a silently weaker open.

---

## 4. Decision — mode bits, and everything a rename drops

Step 7 copies the Unix **mode bits**. That is the whole guarantee, and the wording was corrected
everywhere the review found it overstated — the doc comments, the step marker (`ApplyPermissions` →
**`ApplyModeBits`**), the test name (`the_targets_permissions_survive_the_write` →
**`the_targets_mode_bits_survive_the_write`**) and this document.

**Why nothing more was attempted.** Ownership needs `chown` and privileges; ACLs need `acl_get_fd`;
extended attributes need `flistxattr`/`fgetxattr`; BSD flags need `fchflags`. Every one of them needs
`libc`, and this sub-phase was scoped to add no production dependency. The decision is therefore
**recorded, not resolved** — §10 hole 4 is addressed to a later phase by name.

**What a temp file plus a rename drops**, enumerated because the review was right that "permissions
survive" hid it:

| Dropped | Consequence |
|---|---|
| owner (uid) | preserved *in practice* only because the same user creates the temp file. Under a group-writable directory, replacing another user's file makes the result owned by the app user |
| group (gid) | can differ under a setgid directory |
| **POSIX ACLs** | **an access-control change, not a cosmetic one.** An ACL that *denies* access the mode bits appear to allow is removed by this write, so the result is **more** accessible than the file it replaced |
| extended attributes | Finder tags, quarantine flags, every `com.apple.*` attribute |
| resource forks | themselves an xattr on modern macOS |
| creation time, file identity | `st_birthtime` resets; the inode number changes |
| BSD flags (`uchg`, `SF_IMMUTABLE`) | a user-locked file that this write *could* replace comes back unlocked |
| hard links | other links keep the old inode, so they no longer see the edit |

`the_write_installs_a_new_inode_which_is_why_only_mode_bits_survive` pins the mechanism rather than
asserting the list: it measures that the inode number changes across a write. If that ever stopped
being true, this table would be describing something that does not happen, and the test says so.

**The metadata TOCTOU is fixed, not documented away.** The review's High finding was that
`fs::metadata(path)` followed by `fs::read(path)` can straddle a replacement and copy inode A's mode
onto inode B's contents. `inspect_target` now does **one** open, one `fstat` on that descriptor and one
read from that same descriptor, so the mode bits, the bytes and the `(dev, ino)` pair provably describe
a single inode. `the_inspection_reads_mode_and_bytes_from_one_descriptor` pins it.

---

## 5. The temp file, and the two independent reasons espanso cannot load it

Name shape: `_<target name>.espansoconfig-<pid>-<nanos>-<counter>.tmp`.

Espanso's default include glob is `[!_]*.yml`. **Both** ends of the name defeat it, and either alone
would be enough: `[!_]` excludes a name starting with `_`, and a name ending in `.tmp` is not a `.yml`
file at all. Hazard 17 is the reason for the redundancy — a temp file the daemon picks up mid-write is
a half-written configuration loaded as if it were finished — and the cost of the second defence is zero.

**The test asserts against a transcription of the glob, not against a string.**
`matched_by_espanso_glob` in the test file spells out espanso's rule independently, and its own
correctness is shown first. **And it asserts against a name the writer actually used**:
`the_temp_file_observed_mid_write_is_the_one_the_name_generator_describes` hands the writer an 8 MiB
payload, polls the directory from another thread, and asserts the poller **saw something** before
judging what it saw.

**The temp file is created `0o600` and then widened**, never created at `0o666 & !umask` and narrowed.
Experiment E5 (§9) is the evidence that the creation mode really is `0o600`.

**What the guard does and does not guarantee** — reworded after the review's Low finding, which was
correct that "the temp file never survives the call" is false:

> Cleanup is **attempted** on a normal return and on an unwind. It does not happen if the process is
> killed, if it aborts, or under `panic = "abort"`, and a failing `remove_file` is swallowed. So a temp
> file *can* be left behind. **What makes that harmless is the name, not the guard.**

The guard is hygiene; the name is the safety property. `a_guard_still_deletes_when_the_stack_unwinds`
was added because the "and on an unwind" half of the claim had nothing behind it.

---

## 6. macOS measurements — the fsync question, settled from the toolchain source

Measured on this machine, APFS, 50 iterations each, with a throwaway program (`/tmp`, not committed):

| Operation | Per call |
|---|---|
| create + write + `sync_all()` on a regular file | **4.05 ms** |
| create + write, no sync | 0.106 ms |
| `File::open(dir)` + `sync_all()` on the directory | **0.093 ms** |

**The review asserted that `File::sync_all()` on macOS uses normal `fsync` semantics rather than
`F_FULLFSYNC`. That is not what this toolchain does.** `rust-src` was installed for the local stable
toolchain and the implementation reads, in `library/std/src/sys/fs/unix.rs`:

```rust
pub fn fsync(&self) -> io::Result<()> {
    cvt_r(|| unsafe { os_fsync(self.as_raw_fd()) })?;
    #[cfg(target_vendor = "apple")]
    unsafe fn os_fsync(fd: c_int) -> c_int { libc::fcntl(fd, libc::F_FULLFSYNC) }
    #[cfg(not(target_vendor = "apple"))]
    unsafe fn os_fsync(fd: c_int) -> c_int { libc::fsync(fd) }
}
```

The 4 ms measurement corroborates it: that is two orders of magnitude above a plain `fsync` on an
NVMe SSD. So `libc` was **not** added, and the file sync is already the strong call.

**The reviewer's conclusion nevertheless stands, for two reasons the source does not remove**, and
every "durable" claim was weakened accordingly:

1. `F_FULLFSYNC` returns `ENOTSUP` on filesystems that do not implement it, and `std` has **no
   fallback** — the code above is the whole function. On such a volume this surfaces as an
   `Io { step: SyncTempFile }`, which happens *before* the rename, so the target is untouched and the
   failure mode is a refusal. Acceptable, and now documented rather than discovered;
2. **the directory sync is best effort.** The third row of the table is the reason: at 93 µs including
   the open, it is plainly not doing what the 4 ms call does. Nothing here proves the *rename* survives
   a power cut.

So the contract now reads: the **bytes** get the strongest sync the standard library offers; the
**rename** does not. Its failure mode is a silently lost save, never a corrupt file, because the old
inode is intact and complete — which is the right side of the trade, and the reason this is recorded
rather than escalated.

Two smaller things checked rather than assumed, both on APFS: `sync_all()` on a directory descriptor
opened read-only **succeeds** (on some platforms `fsync` on a read-only directory fd is an error, and
the code would then be failing every successful write); and `sync_data()` succeeds too.

---

## 7. The error type — steps, not sentences, and one question the caller must be able to ask

`WriteError` has six variants: `TargetMissing`, `TargetNotRegularFile`, `RevisionMismatch`,
`TargetChangedDuringWrite`, `VerificationFailed` and `Io`. The first five are the refusals a caller
must distinguish; `RevisionMismatch` carries **both** revisions, because "the file changed" is useless
without "into what", and `TargetChangedDuringWrite` carries a `TargetDifference` saying which of four
things changed.

`Io` carries a `WriteStep` — eleven variants, each with a `code()` — so a caller can tell **which**
operation failed without parsing English (plan §9). The `io::Error` is carried and reachable through
`source()`, but nothing downstream has to read it.

**`WriteStep::after_rename()` is the variant the type exists for**, and its documentation was corrected
to the reviewer's wording. Exactly two steps happen after the commit (`SyncDirectory`, `ReadBack`).
`WriteError::may_have_written()` lifts it to the whole enum — and now says explicitly what it is
**not**:

> Whether **this call's** rename may have completed. It is not a statement about what the target holds
> now: `false` does not mean the target still holds `expected`, and `true` does not mean it currently
> holds the new bytes. The target must be re-read whenever external writers are possible — which for an
> espanso configuration is always.

**No `Serialize`, deliberately.** Copying `WorkspaceError`'s hand-written impl would have **failed the
build**: `src-tauri/src/dictionary_contract.rs`'s
`every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code` demands that every enum `serde` can
write either owns a `code.` namespace in `en.json` **and** `es.json`, or is excluded by name with a
reason. The sub-phase that exposes saving adds the impl and the strings in the same change, which is
the property that check exists to enforce. This is not a hole; it is the guard working.

---

## 8. Verification

Each command run separately, after the review fix round.

| Command | Exit |
|---|---|
| `cargo fmt --check` | 0 |
| `cargo build --workspace` | 0 |
| `cargo test --workspace` | 0 — 16 test binaries plus doc-tests, **600 tests**, 0 failed, 0 ignored |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | **1 — nothing found**, which is the required result (CLAUDE.md §3, D2x) |

`tests/persist_write.rs` contributes 25 of those tests and `write.rs`'s own module contributes 14.
`tests/corpus_integrity.rs` passes unchanged: **no file under `tests/corpus/` was written, moved or
reformatted.** The byte-exactness sweep copies each fixture into a `TempDir` first.

**No new dependency was added, in any section.** `std::fs`, `std::io`, `std::os::unix::fs` and the
existing `sha2` were sufficient. `rust-src` was added as a *toolchain component* to settle §6's
question; it is not a dependency of anything.

**Privacy:** nothing here reads `tests/corpus/real/`. Every byte written by the test binary is either
hand-written neutral YAML declared as a `const` or a committed synthetic fixture.

---

## 9. The disabling experiments

Each sabotage was applied to production code, the acceptance binary was run, and the change was
reverted. An experiment that fires nothing is a test that measures nothing.

| # | Sabotage | Result |
|---|---|---|
| E1 | `TempFile::drop` never deletes | **fires** — `no_temp_file_survives_a_failure_after_the_temp_file_exists`, reporting the surviving `_base.yml.espansoconfig-….tmp` by name |
| E2 | the revision comparison is never made | **fires (4)** — both stale-revision tests, the symlink-revision test, and `concurrent_writers_from_one_base…` (8 winners instead of 1) |
| E3 | `canonicalize` is called but its answer discarded | **fires (4)** — both symlink tests, `two_spellings_of_one_path_contend_on_the_same_lock`, and the mismatch test that asserts the resolved path is reported back |
| E4 | the temp name loses its `_` and ends in `.yml` | **fires (2)** — the generated-name test and the mid-write observation |
| E5 | the mode-bit copy applies the temp file's own mode | **fires** — `the_targets_mode_bits_survive_the_write`, `0o600` where `0o640` was wanted. Also the evidence that creation really is `0o600` |
| E6 | the target is opened and truncated in place; no temp file | **fires (4)** — both mid-write observations, the guard test, the read-only-directory test |
| **E7** | `mutex_for` leaks a fresh mutex per call, so nothing serialises | **fires (3)** — `two_spellings…`, `concurrent_writers_from_one_base…`, and **`concurrent_read_modify_write_never_loses_an_update`**, which is the test the review said did not exist |
| **E8** | the pre-commit re-check is skipped | **fires** — `a_target_replaced_while_the_call_runs_is_refused_by_the_pre_commit_recheck` |
| **E9** | `replace_locked_file` returns the intended revision without writing anything (a **no-op writer**) | **fires** — `a_byte_exact_fixture_survives_a_round_trip_through_the_writer`, `crlf-line-endings.yml did not survive the writer byte for byte`. **Under the pre-review version of that test this sabotage passed**, which is precisely the "theatre" the review identified |

**An incidental finding from E7, recorded because it is true and surprising.** With the lock removed,
the failures that appeared were `VerificationFailed` and post-commit `Io` errors — i.e. **step 11's
read-back verification does fire under concurrency**, even though nothing exercises it in the shipped
configuration. That does not make hole 2 of §10 go away; it narrows the claim to what it should be.

---

## 10. Coverage holes, stated as holes

1. **The residual race is real and is not closed** (§2). The pre-commit re-check leaves a window one
   `rename()` wide in which a non-cooperating writer can be overwritten. Closing it properly means
   holding an open descriptor across the whole transaction and operating relative to it
   (`openat`/`renameat`, therefore `libc`), and even then `renameat` has no "only if" condition. **No
   test in this repository involves a second process**, which is the case that matters for vim and
   espanso; the in-process tests approximate it with threads.
2. **Neither `sync_all()` call, nor the step-11 read-back, is covered.** In the reviewer's own terms:
   *no test would fail if `sync_all()` (file or directory) or read-back verification were removed
   entirely.* They are invisible while the filesystem behaves and while writers serialise. §9's E7
   footnote is the one circumstance in which read-back was observed firing, and it required breaking
   the lock to produce. Durability is a claim about a power cut and cannot be tested from user space at
   all; §6 measures cost, which is evidence the calls are made, not evidence about a crash.
3. **The directory sync is best effort** (§6), and its weakness is measured rather than suspected. A
   crash between the rename and the directory's metadata reaching stable storage can leave the entry
   naming the old inode: a silently lost save. Unfixed, and named here so it is not mistaken for a
   guarantee.
4. **Ownership, ACLs, xattrs, resource forks, creation time, BSD flags and hard links are dropped**
   (§4), and the ACL case is an **access-control change** — removing a denying ACL broadens access.
   This is a decision a later phase must revisit, not an accepted cost, and it needs `libc`.
5. **A target that is a socket, a fifo or a device is refused by the same code path as a directory but
   is not tested.** Only the directory case has a test.
6. **`two_spellings_of_one_path_contend_on_the_same_lock` rests on a 300 ms timing assumption**, now
   stated in the test itself. A machine so loaded that a 48-byte write takes longer than 300 ms would
   make it pass vacuously; there is no way to distinguish "blocked" from "very slow" without a hook
   inside the lock. It remains the **only** direct evidence that the lock blocks anything.
7. **`a_target_replaced_while_the_call_runs…` is probabilistic.** It runs 24 attempts with staggered
   delays and asserts the during-the-write refusal was observed at least once, so it cannot pass
   vacuously — but on a machine where the intruder never lands in the window it would *fail* rather
   than degrade. Its deterministic counterpart is the four `recheck_target` unit tests, which cover all
   four `TargetDifference` arms with no timing at all.
   `a_during_the_write_refusal_reports_which_thing_changed` **can** print a skip notice, and says in
   that notice which test cannot.
8. **`no_temp_file_survives_a_failure_after_the_temp_file_exists` depends on `chflags uchg` making
   `rename()` fail with `EPERM`** (measured here, errno 1). The review believed it silently no-ops when
   `chflags` is unavailable; that was true of the first version's skip notice and **has been removed** —
   an unavailable `chflags` is now an assertion failure, because a test that degrades into a pass on the
   one path that exercises the RAII guard is worse than no test.
9. **The 8–12 MiB payloads of the mid-write observations are timing devices.** Each asserts it saw
   something, so none can pass vacuously, but on a much faster filesystem they would fail rather than
   degrade.
10. **Nothing writes a real espanso config, or inside a real config directory.** Every test runs in a
    `TempDir`. The interaction that actually matters — espanso's daemon watching the directory while
    the rename happens — has never been observed and cannot be from a `cargo test`.
11. **The primitive cannot create a file.** Named as future work rather than left implicit. It needs
    its own answers about the mode to give a new file, about creating the parent directory, and about
    what espanso does with a file that appears empty for an instant.
12. **The case-folding claim is a measurement on one volume** (§3). It is now written as a property of
    the volume and skips on a case-sensitive one, so hazard 16 is *observed here*, not *guaranteed*.

---

## 11. Review disposition

Every finding of `docs/reviews/phase-2a-1-atomic-write.md`, with what was done.

| # | Finding | Disposition |
|---|---|---|
| C1 | The revision check is not a compare-and-swap | **Fixed and recorded.** Pre-commit re-check added (path re-resolution + `(dev, ino)` + type + hash), new `TargetChangedDuringWrite` variant with a four-arm `TargetDifference`. The window is narrowed to one rename and **said to be** narrowed, not closed (§2, §10 hole 1) |
| C2 | The module-level "only if" claim is false | **Fixed.** Both module docs and `replace_file_atomically`'s doc now say *atomic replacement with optimistic conflict detection*, with a `# The residual race` section naming vim, espanso and sync agents |
| H3 | Metadata discarded; the guarantee overstated | **Renamed, enumerated, deferred.** `ApplyPermissions` → `ApplyModeBits`, the test renamed, and §4's table enumerates all eight dropped classes with the ACL access-control consequence called out. No `libc`, per the brief; §10 hole 4 is addressed to a later phase |
| H4 | Metadata TOCTOU | **Fixed.** `inspect_target` does one open, one `fstat` on that descriptor and one read from it, plus `O_NOFOLLOW`. Mode, bytes and identity provably come from one inode |
| H5 | "Durably" is stronger than macOS `sync_all()` gives | **Half corrected, half rebutted, wording weakened either way.** The premise is wrong for this toolchain — `std` issues `F_FULLFSYNC` on Apple targets, shown from the local `rust-src` (§6). But `ENOTSUP` has no fallback and the directory sync is measurably not doing the same work, so every durability claim was weakened and the directory sync is now called best effort in the code, in §6 and in hole 3 |
| M6 | Symlink retarget mid-call | **Fixed.** `PathWriteLock::requested_path()` retained and re-resolved before the commit; `the_recheck_refuses_a_symlink_retargeted_while_the_call_ran` pins it |
| M7 | The case-insensitivity claim | **Reworded and pinned.** Stated as a property of the volume rather than of `canonicalize`, and measured by a test that skips with a notice on a case-sensitive volume (§3, hole 12) |
| L8 | Temp-file lifetime documentation is false | **Fixed.** Reworded to "attempted on normal return and on unwinding; a leftover is harmless **because of the name**", and `a_guard_still_deletes_when_the_stack_unwinds` was added for the half that had no test |
| E9 | `may_have_written()` wording | **Adopted verbatim in substance** — "whether this call's rename may have completed; the target must be re-read whenever external writers are possible" (§7) |
| T10 | Byte-exact fixture test is theatre | **Fixed.** Each copy is seeded with a `PLACEHOLDER` that contradicts all five properties, then the fixture's real bytes are written through the primitive. Experiment E9 confirms a no-op writer now fails it |
| T11 | The concurrency test proves nothing about serialisation | **Replaced.** `concurrent_read_modify_write_never_loses_an_update` has each writer **append** a unique line under read-then-write-with-retry, so a lost update is a missing line. E7 confirms it fails with the lock removed. The old replace-based test is kept under its true name (`…leave_exactly_one_writers_bytes`) |
| T12 | The 300 ms timing assumption | **Stated in the test**, with a failure message naming both spellings, plus hole 6 |
| T13 | The `chflags` test can silently no-op | **Resolved by reading the body: both were partly right.** It panicked when `chflags` *succeeded* but the rename did not fail, and printed a skip when `chflags` could not be run at all. **The skip path is gone**; an unavailable `chflags` is now an assertion failure (hole 8) |
| T14 | Two count mismatches | **Fixed.** Both now say **five**, and the fixture list's own doc comment names all five bytes |
| T15 | The uncoverable sabotages | **Stated as holes in the reviewer's terms** — hole 2 says outright that *no test would fail if these were removed*, in the module header of the test binary as well as here |

The reviewer's "correct points" are unchanged by this round: same-directory temp, `create_new`, initial
`0o600`, `write_all` before sync, same-filesystem rename, normal-path RAII cleanup, symlink resolution
before the rename, and the conservative post-rename error classification.

---

## 12. What 2a-2 inherits, and should not rebuild

- **`replace_locked_file` exists so the lock can be held across steps 2 to 11.** 2a-2's shape is
  `lock_path` → read → parse → patch → reparse → validate → `replace_locked_file`, with the lock alive
  for the whole of it. Do **not** call `replace_file_atomically` inside a `PathWriteLock` scope; it
  deadlocks.
- **The revision returned is the one to keep.** It is the hash of bytes read from disk, so it is
  simultaneously the new base revision and the hash the watcher must ignore (plan §6.5 step 4).
- **Two refusals, two different sentences.** `RevisionMismatch` is "your document is stale";
  `TargetChangedDuringWrite` is "another program is writing this file right now". They will need
  different strings and possibly different offers.
- **`may_have_written()` must reach the user**, and its qualification with it: it is about this call's
  rename, not about what the file holds now.
- **This primitive validates nothing.** 2a-2 owns the syntax gate (step 4) and the structural gate
  (step 5), and it is the only thing that should ever call this with bytes a user's edit produced.
- **Backups are the answer to the residual race**, not a stronger primitive (§2, hole 1). 2a-3 should
  be read as a *correctness* dependency of 2a-1's contract, not only as a convenience.
- **The `Serialize` impl and the dictionary keys are one change, not two** (§7). `WriteError`,
  `WriteStep` and `TargetDifference` will all owe `code.` namespaces in both dictionaries.
- **Hazard 11 is a quarter closed** (§4, hole 4) and hazard 12 is closed only *in process* (hole 1).
  Both should be re-read before Phase 2 claims the register is satisfied.
