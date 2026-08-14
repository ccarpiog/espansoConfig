# Phase 2a-3b — backups, and the rotation that bounds them

**What this sub-phase is.** Plan §6.6 **step 13** and plan §6.6's *"Backups"* paragraph: before the
first modification of each file per session, copy the file somewhere espanso does not load from, and
retain the last ten save batches. It is pure Rust in `crates/espansoconfig-core` — no UI, no IPC, no
tauri — exactly like 2a-1, 2a-2a, 2a-2b and 2a-3a. *Reveal backups in Finder* is a user interface and
belongs to 2c; what 2a-3b owes it is a **path**, and that path is `BackupSession::root()`.

**The one sentence that defines it:**

> **A batch is a session.** One session mints one batch directory, copies each file it modifies into it
> at most once, and rotates the backup root exactly once — **after** the first copy is safely on disk,
> and with that session's own batch excluded from removal by identity rather than by where its name
> sorts.

Everything else here is either a consequence of that sentence or a decision it does not make. The four
sharpest are §2 (the location), §3 (where the session state lives), §4 (rotation, the one destructive
operation) and §5 (what the copy carries, and the ACL it deliberately does not).

**§12 is a review disposition**, finding by finding, for the eleven an adversarial review returned
against the first version of this sub-phase. Two of the sentences that version wrote — rotation runs
"at the moment that directory is created", and a failed backup costs "the attempt, and nothing else" —
were **false**, and §4, §6 and §7 below are rewritten rather than annotated.

---

## 1. What was built

**`crates/espansoconfig-core/src/persist/backup.rs`** — new, and the whole of step 13.

| Item | What it is |
|---|---|
| `BackupSession` | the caller-owned session: a configuration root, the backup root under it, and one `Mutex` holding *this session's batch* and *the set of files already copied* |
| `BackupSession::root()` | **the path Phase 2c reveals in Finder**, and the only thing this sub-phase owes it |
| `BackupSession::capture()` | `pub(super)`: mint the batch if needed, write one copy, rotate once. Answers `Ok(None)` for a file this session already copied |
| `BackupSession::discard()` | `pub(super)`: un-record a copy whose save then did **not** commit, and remove it |
| `BackupRecord` | where the copy went, which batch it is in, and what rotation did |
| `Rotation` | an outcome and four counts — `removed`, `failed`, `unrecognised`, `unreadable`. **Never an error** |
| `RotationOutcome` | `NotAttempted`, `Refused`, `ScanFailed`, `Scanned` — *how far it got*, which the counts alone cannot say |
| `BackupError` / `BackupStep` | twelve steps and eight failures, codes not prose, the same shape as `WriteStep` |
| `BACKUP_DIRECTORY_NAME`, `BATCHES_RETAINED`, `OUTSIDE_CONFIG_ROOT` | `.espansoconfig-backups`, `10`, `_outside` |
| `BATCH_MARKER_NAME`, `BATCH_MARKER_FORMAT` | `.espansoconfig-batch` and the format identifier inside it — **the ownership marker rotation trusts** |

**`crates/espansoconfig-core/src/persist/save.rs`** — the placement, which is this module's whole
contribution to step 13:

- `SaveRequest` gained **`backups: Option<&BackupSession>`**. `SaveRequest` is still `Copy`;
- `SavedDocument` gained **`backup: Option<BackupRecord>`**;
- `SaveError` gained **`Backup(BackupError)`** — a **failure**, not a refusal, and `may_have_written()`
  answers `false` for it. Both classifiers match `SaveError` exhaustively, so the new variant was a
  compile error in each until it was classified;
- `read_target_under_the_lock` now answers the whole `InspectedTarget` rather than only its bytes, so
  the copy takes the mode bits and the extended attributes from **the same open file** the bytes and
  the revision came from. `String::from_utf8` became `str::from_utf8`, which also removes one copy of
  the whole document per save;
- the call sits between `let committed = candidate != source;` and `replace_locked_file`, guarded by
  `if committed`;
- **the review round added `discard_backup`**: when `replace_locked_file` returns an error whose
  `may_have_written()` is `false`, the session is told to forget the file it just copied and to remove
  the copy. Without it a retry would commit over a target another writer may have changed, with no copy
  of the bytes it replaced (§9 hole 2, and §12 finding 4). A commit that **may** have happened keeps
  its copy and its record: that copy is of bytes the rename may already have replaced, and it is the
  only one there is.

**`crates/espansoconfig-core/src/persist/write.rs`** — the one `fcopyfile` call site became
`copy_through_copyfile(source, destination, flags)`, with **two named policies** on it:
`copy_metadata` (`COPYFILE_ACL | COPYFILE_XATTR`, the atomic write, unchanged) and a new `pub(super)`
`copy_extended_attributes` (`COPYFILE_XATTR`, the backup). Both have their `cfg(not(target_os =
"macos"))` twins. `InspectedTarget` gained `#[derive(Debug)]`, which a test needed.

The review round added one more, and it is an extraction rather than a change: `verify_temp_identity`'s
comparison became `pub(super) names_the_same_inode(&File, &Path) -> io::Result<bool>`, and
`verify_temp_identity` is now the two-line wrapper that turns a `false` into
`WriteError::TempFileChangedDuringWrite`. The backup's own temp file asks the same question and answers
it with a `BackupError`. **One shared question, two callers, one implementation that cannot drift** —
2a-3a's four unit tests over `verify_temp_identity` still call it unchanged and still pass.

`persist/mod.rs` and `lib.rs` gained the 2a-3b paragraph and the re-exports. **No public signature of
2a-1 or 2a-3a changed**; `replace_file_atomically`, `replace_locked_file`, `lock_path`,
`temp_file_name`, `WriteError` and `WriteStep` are exactly as they were.

**Tests: 51 new** — 28 unit tests in `persist/backup.rs`, 23 acceptance tests in
`tests/persist_backup.rs`. The split is deliberate: the batch-name grammar, the date arithmetic, the
ordering and the `_outside` path rule are properties of functions and are tested beside them; the
placement inside the transaction is a property only a whole transaction can show. **Fifteen of the
fifty-one are the review round's** and **two are the confirmation round's**, and every one of them fires
when its fix is removed (§7.2, E30 to E39c).

| Where | Test | What it pins |
|---|---|---|
| `tests/persist_backup.rs` | `a_committed_save_copies_the_targets_pre_save_bytes` | the property the sub-phase exists for |
| | `a_refused_save_leaves_no_backup_of_a_file_nobody_changed` | step 13 is **after** the verdict |
| | `a_save_that_rewrites_nothing_takes_no_backup` | and skipped when `committed == false` |
| | `the_second_save_of_one_file_in_one_session_takes_no_second_backup` | *first modification per session*, and that the one copy is the **pristine** one |
| | `a_new_session_over_the_same_file_takes_its_own_backup` | the other half of "per session" |
| | `the_backup_is_not_anywhere_espansos_include_glob_can_reach` | structurally **and** by asking `discovery::enumerate` |
| | `a_session_that_saves_more_files_than_the_retention_window_keeps_every_copy` | **the tension** (§6) — twenty files, one session, every copy alive |
| | `the_eleventh_session_rotates_the_oldest_batch_away` | ten kept, oldest first |
| | `rotation_through_a_save_leaves_a_foreign_directory_alone` | two foreign directories, one sorting before every batch and one after |
| | `the_backup_wears_the_targets_mode_bits_inside_a_private_tree` | `0o640` stays `0o640`, inside `0o700` |
| | `the_backup_carries_the_targets_extended_attributes` | macOS; two attributes arrive with their exact bytes |
| | `the_backup_does_not_carry_the_targets_access_control_list` | **§5's decision, asserted** — and that the copy is then deletable |
| | `a_backup_that_cannot_be_written_stops_the_save_before_the_commit` | §7's policy, with the target byte-identical afterwards |
| | `the_session_hands_out_the_backup_root_as_a_path` | what 2c is owed |
| | `two_threads_of_one_session_produce_two_copies_in_one_batch` | the lock order (§3.3) |
| | `backing_up_the_real_configuration_copies_every_file_once_into_one_batch` | 13 real files, one session, one batch |
| | `a_backup_that_fails_after_its_batch_exists_removes_no_older_batch` | **§4's ordering** — eleven older batches, a failing copy, nothing removed |
| | `a_save_whose_commit_fails_leaves_the_file_free_to_be_copied_again` | §9 hole 2's cheap half: the retry copies again, into the same batch |
| | `a_symlinked_backup_root_stops_the_save_and_touches_nothing_behind_it` | the review's finding 1, and the damage it named |
| | `a_session_rooted_at_an_auto_loaded_directory_writes_nothing` | `rooted_at(root.join("match"))` creates nothing at all |
| | `a_rotation_that_ran_says_so_even_when_it_removed_nothing` | `Scanned` is not `NotAttempted` |
| `persist/backup.rs` | eleven rotation tests | the grammar, the ordering, the **marker**, the symlink, the foreign entry, the wrong root, the missing root, the **current batch** |
| | six naming and path tests | the stamp, the leap day, the round trip, `_outside`, the collision, the **two disjoint namespaces** |
| | eight writing tests | the modes, the empty session, the batch collision, the **marker at birth**, the **unpublished copy**, the auto-loaded root, and the confirmation round's two: **a retry beside a copy that could not be removed**, and the sibling name it takes |
| | three backup-root tests | a symlink, a regular file, and a root anybody else can reach |

Nothing under `tests/corpus/` was added, moved or reformatted, and `tests/corpus_integrity.rs` passes
unchanged.

---

## 2. Decision — the location, and what happens to a target outside the configuration root

### 2.1 `<config root>/.espansoconfig-backups/<timestampZ>/<the file's own relative path>`

Plan §6.6 names this path, and **three of its properties are load-bearing rather than cosmetic**:

1. **The placement at the configuration root, not inside `match/`.** This is the half that actually
   works. Espanso's include glob is rooted at `match/`; **no glob rooted at `match/` can reach a
   sibling of `match/`**, whatever the sibling is called. A backup under `match/` would be loaded as
   configuration — every snippet in every backed-up file would come back as a live snippet, silently,
   ten batches deep.
2. **The leading dot.** It keeps the directory out of Finder's ordinary listing and out of shell
   globs. It is **belt-and-braces and is deliberately not relied on**: the `glob` crate's
   `require_literal_leading_dot` is `false` by default, so `*` matches a leading dot and a dot alone
   is not a defence. Saying so is the point — the first pass of this reasoning had the dot as the
   defence and the placement as the detail, which is backwards.
3. **The preserved relative path.** `config/base.yml` and `match/base.yml` are two files, and
   flattening to a bare file name would make them one backup. It is also what lets a user look at a
   batch and recognise their own tree.

`crate::discovery::enumerate` walks `config/` and `match/` and nothing else, so the backup tree is
invisible to this application's own file list too — asserted, not assumed.

### 2.2 A target outside the configuration root goes under `_outside`, and keeps its whole path

This is not a hypothetical: every test that does not build a configuration-root-shaped fixture hits
it, and so does any caller that constructs a session for one root and saves a file under another.
Three answers were available:

| Answer | Why not / why |
|---|---|
| **refuse the backup** | it would make the failure policy (§7) fire on a mistake that is not the user's, and it would mean a save can be refused for a reason that has nothing to do with the file being saved |
| **flatten to the bare file name** | two files called `base.yml` become one backup, silently, and the second overwrites the first. That is data loss inside the mechanism that exists to prevent it |
| **`_outside/` plus the absolute path with its root component dropped** | **chosen** |

So `/somewhere/else/base.yml` is copied to `<batch>/_outside/somewhere/else/base.yml`. The whole path
stays visible, two same-named files stay two backups, and the `_outside` marker tells a reader that
this path is not relative to anything. The construction **cannot escape the batch directory**: every
component that is not a plain name — the root, a prefix, `.`, `..` — is dropped rather than joined,
which is asserted directly on `/../../../etc/passwd`. Its leading `_` also puts it out of espanso's
glob a second time, so the answer does not depend on §2.1 alone.

> **Correction (2c-5-2).** The sentence directly above — *"The construction **cannot escape the batch
> directory**"* — is an **unconditional** containment claim, and the macOS/non-macOS split introduced at
> 2c-5-1 made it false off macOS. It was named by 2c-5-2's review rounds
> (`docs/reviews/phase-2c-5-2-code.md`, `docs/reviews/phase-2c-5-2-confirmation.md`), which corrected the
> same wording in `crates/espansoconfig-core/src/persist/backup.rs`. The prose above is left exactly as it
> was written; this block is what is true, and it states the limitation in the same breath as the
> guarantee because a record that claims more than the code gives is this project's worst defect class.
>
> **What the code does force, and it is a claim about the *constructed path*.**
> `backup_relative_path()` in `crates/espansoconfig-core/src/persist/backup.rs` keeps only
> `Component::Normal` components: the root, a prefix, `.` and `..` are **dropped rather than joined**, so
> the relative path it builds holds nothing but plain names and introduces no lexical `.` or `..` escape.
> That is the whole of what `/../../../etc/passwd` asserts — it inspects the value the function returned.
> It holds on **every** target, because it is arithmetic on a `Path` and touches no filesystem.
>
> **What it does not force, and never did.** Containment *on disk* is a second question: a component of
> the batch path replaced by a symbolic link **between the moment it was checked and the moment it is
> used** is a filesystem race, and a lexically clean path says nothing about it. That race is closed **on
> macOS only**, and there only for the read-only catalogue walk added at 2c-5-1: `ResolvedDirectory`
> opens the backup root `O_DIRECTORY | O_NOFOLLOW`, resolves every child relative to its already-open
> parent with `openat(…, O_NOFOLLOW)`, and confirms what it opened with `fstat` **on the descriptor**, so
> nothing inside the backup tree is resolved by pathname twice and there is no second name lookup to
> race. Its one remaining pathname resolution is the backup root's own, whose final component
> `O_NOFOLLOW` protects and whose ancestors are the caller's configuration root. On **every other
> target** `ResolvedDirectory` holds only the pathname: a symbolic link **already there** is refused by
> `fs::symlink_metadata`, and a component **swapped between the check and the use can still be
> followed**. `ResolvedDirectory`'s own doc comment writes both answers out rather than averaging them.
>
> **§9 hole 15 is unchanged, and it still describes the write side.** `create_backup_root`,
> `create_batch`, `write_backup`, `publish_backup` and `rotate` resolve by pathname on **every** target,
> macOS included; only the catalogue's read walk is descriptor-anchored. So the sentence that may be
> written here is the per-target one — *the constructed path introduces no lexical `.` or `..` escape;
> filesystem containment retains the target-specific guarantees documented by `ResolvedDirectory`* — and
> no sentence anywhere in this record may state that containment unconditionally.

**The two namespaces have to be disjoint, and the first version's were not** (review finding 6). An
in-root `<config root>/_outside/foo` and an external `/foo` both produced `_outside/foo` — one backup
for two files, which is the data loss flattening was rejected for, reached by a different road. The fix
is one line of work and it is **injective**: an in-root relative path whose first component is
`_outside`, or `_outside` followed by any run of `_`, gains one more `_`. So `_outside/foo` is
`_outside_/foo`, `_outside_/foo` is `_outside__/foo`, and nothing in-root can ever produce a first
component of exactly `_outside`. Two in-root paths still cannot collide, because appending is
injective; an in-root path and an external one cannot collide, because only the external namespace is
`_outside`. Codex's suggestion of a path digest was heavier than the problem: a digest would have cost
the readable path §2.2 chose on purpose.

**What this does not fix is a property of the destination volume, and it is stated as a hole** (§9
hole 13): two external files that differ only by case, or only by Unicode normalisation, still map to
one path on a case-insensitive or normalisation-insensitive backup volume. The failure is loud rather
than silent — the second save fails at the destination-exists check with `BackupError::DestinationExists`
and the save does not commit — which is the direction that cannot overwrite a backup, but it is a save
the user cannot complete.

### 2.3 The configuration root is canonicalised, and that is not a nicety

`BackupSession::rooted_at` canonicalises its argument where that succeeds. The paths it is later
compared against are `PathWriteLock::path()`'s, which always are. On macOS a `TempDir` under `/var`
canonicalises to `/private/var`, and a symlinked home directory does the same thing to a real user's
configuration: without this, `strip_prefix` would fail for **every** file and every backup would land
under `_outside`. A root that cannot be canonicalised — it does not exist yet — is kept as spelled
rather than refused, because nothing is written until a save actually happens.

---

## 3. Decision — where the session state lives

*"Before the first modification of each file per session"* is a statement about **session** state, and
`crate::persist` held none before this sub-phase. Three shapes were available.

| Shape | Verdict |
|---|---|
| **a process global** | **rejected.** Two configuration roots — a real one and a test's — would share one set of "already copied" paths; tests could not run in parallel without interfering; nothing could ever be reset; and *when a session begins* would be unanswerable, because a process has no such event |
| **a second reader of `crate::workspace::Workspace`** | **rejected.** 2a-2b deliberately refused to become a second owner of the session's state, and a transaction that reached into the caller's cache to decide whether to copy a file would be exactly that. It would also make `persist` depend on `workspace`, which is the wrong direction |
| **an explicit value the caller owns, threaded through the request** | **chosen** |

`SaveRequest::backups` is `Option<&BackupSession>`.

### 3.1 Why an `Option`, and not a mandatory argument

So that *"this save takes no backup"* is something a caller **says** rather than something it forgets.
A mandatory argument would have forced `save_document` to derive a configuration root from a
`DocumentContext`, and a detached context has none; the derivation would have been a guess, and a
guess about where to write files is how a backup ends up under `match/`.

The cost is stated: a caller that passes `None` gets no backups and no warning. That is a **caller's**
decision, and `tests/persist_save.rs` passes `None` throughout precisely so that "no backup was taken"
is a claim that file is entitled to make.

### 3.2 Why one `Mutex` and interior mutability

`SaveRequest` is `Copy` and holds shared references, so `capture` takes `&self`. Two threads saving
two documents of one session must not both mint a batch directory, and the set of already-copied files
must not be read and written by two threads at once. One mutex answers both. Poison is treated as *the
previous holder panicked* and ignored, exactly as `persist::write` treats its own: the state behind it
is a set and an `Option`, neither of which a panic can leave half-updated, and propagating the poison
would turn one panicked save into a session that can never back anything up again.

### 3.3 The lock order, stated because it is the shape a deadlock has

A save takes `PathWriteLock` **first** and the session's mutex **second**, and **nothing anywhere
takes a path lock while holding the session's**. The order is total, so two threads saving two
different documents of one session cannot deadlock — the second waits out the first's copy.
`two_threads_of_one_session_produce_two_copies_in_one_batch` runs it.

The cost is that one copy — a write and one `fsync` — is serialised across a session. For the
kilobytes an espanso configuration holds that is not worth a second lock, and it is written down
rather than discovered.

---

## 4. Decision — rotation, the one destructive operation in this sub-phase

`rotate` deletes directories, and it is the only code in this crate that deletes anything but its own
temp file. **Seven properties** make that safe, and **each is a check rather than an intention**. Three
of them — 2, 5 and 7 — are the review round's, and the first version of this section claimed four
properties where it had three and a half.

1. **It only ever considers entries whose *name* is one this module mints.** `parse_batch_name` is a
   strict grammar — `YYYY-MM-DDTHHMMSSZ`, optionally `-` and one to nine digits, every separator
   checked in its own position and every other character an ASCII digit. `backups`, `.DS_Store`,
   `2026-07-29`, `2026-07-29T143012Z.old` and `2026-07-29T143012z` are all unrecognised. This is the
   "by shape, not by hope" requirement, and it is discharged by a function with thirteen negative
   cases in one test.
2. **A name is a shape, not a claim of ownership, so the batch must also carry a marker.**
   `.espansoconfig-batch` is written into every batch as it is created and holds
   `espansoconfig-backup-batch` plus a version; `carries_batch_marker` requires it, matching the format
   identifier as a **prefix** so a newer build's batch is not orphaned by an older one. This is review
   finding 2 and it is the sharpest of the seven: the grammar does not check calendar ranges, so
   `9999-99-99T999999Z` parses, and anything at all can create a directory called that. A marker is
   **forgeable by a principal who can write inside the backup root**; that principal is out of scope
   here for exactly the reason `2a-3a-notes.md` hole 14 puts it out of scope for the rename — every
   path this module touches is resolved by pathname, not by descriptor.
3. **An unrecognised entry does not consume one of the ten slots.** It is counted as
   `Rotation::unrecognised`, left exactly as found, and excluded from the retention arithmetic — so a
   foreign directory cannot silently shorten the retention window.
4. **It only ever considers real directories, and never follows a link.** The type comes from
   `fs::symlink_metadata`, so a *symlink* named like a batch is not a directory and is skipped
   entirely. `fs::remove_dir_all` does not follow symlinks either, so a link planted *inside* a batch
   is removed rather than traversed. `rotation_does_not_follow_a_symlink_named_like_a_batch` plants a
   link to a directory holding a file and asserts the file survives.
5. **The batch this session is writing into is never a candidate**, and it is excluded by
   `(device, inode)` identity with its path as a fallback — not by where its name sorts. *Newly
   created* does not imply *newest by name* (review finding 10): a wall clock adjusted backwards, or
   ten future-dated directories somebody left in the root, would otherwise make the directory holding
   this session's own copies the oldest candidate. `rotation_never_removes_the_batch_it_was_told_is_current`
   seeds exactly that state.
6. **It refuses a root that is not a backup root.** The directory's own name must be
   `.espansoconfig-backups`. The function is private and its one caller passes `BackupSession::root()`,
   so this can only ever fire on a programming error — which is exactly when a recursive delete most
   needs a guard. Pinned by `rotation_refuses_a_root_that_is_not_the_backup_root`.
7. **The root it is handed has been checked, once, before anything was created in it.** An existing
   `.espansoconfig-backups` is adopted only if `symlink_metadata` says it is a **real directory** and
   its mode grants nothing to group or other. A symlinked root is the case that matters: `read_dir`
   follows one, so rotation would enumerate — and `remove_dir_all` would then delete inside — a tree
   this application does not own. E33 measures exactly that: with the check removed, the save succeeds
   and rotation reports `removed: 2` in the linked tree.

### 4.0 The order: **write the copy, then rotate**

The first version rotated at the moment the batch directory was minted, and argued that the empty new
directory was the newest of the set and therefore safe. The argument was true and the ordering was
still wrong (review finding 3): if the copy then failed — a permission, a full disk, a parent that
cannot be created — the save did not commit, **and an older batch was already permanently gone**. A
backup that produced nothing had spent a retention slot.

So rotation now runs after `write_backup` returns, and the session carries a separate `rotated` flag
rather than inferring it from *the batch exists*: a session whose first copy failed has a batch and has
not rotated, and its next copy must still rotate exactly once.

**Nothing about §6's structural argument depends on the old order**, and that is worth saying rather
than assuming. The claim §6 makes is *rotation can never remove a copy this session took*. Under the
old order it rested on the new batch being empty and newest-by-name; under the new one it rests on
property 5, which excludes that batch **categorically**. The second is strictly stronger: it survives a
backwards clock, which the first did not. `a_session_that_saves_more_files_than_the_retention_window_keeps_every_copy`
is unchanged and still passes, and `a_backup_that_fails_after_its_batch_exists_removes_no_older_batch`
is the new half.

### 4.1 A rotation failure is **counted, never returned**

`rotate` cannot produce a `BackupError` at all; it answers a `Rotation` and nothing else. A
`remove_dir_all` that fails increments `failed` and the loop continues.

**Counted, never returned is not the same as counted, and the first version was not counting**
(review finding 8). A root that could not be listed and an entry the iterator could not produce were
both silently `Rotation::default()` — an all-zero answer indistinguishable from *there was nothing to
do*, which is the opposite fact. `Rotation` therefore now carries a `RotationOutcome`
(`NotAttempted` / `Refused` / `ScanFailed` / `Scanned`) and an `unreadable` count, and
`Rotation::bounded()` is the one question a caller actually has: **is the backup root known to hold at
most ten batches now?** It answers `true` only for a full scan with no failed removal and no unreadable
entry.

That is the answer to *"reported, swallowed, or a non-fatal field"*: **a non-fatal field**, and
specifically `SavedDocument::backup.rotation`. The three options were weighed as follows.

- **Failing the save** is wrong on its face: the save has already been decided, and tidying old copies
  has nothing to do with whether this file should be written.
- **Swallowing it entirely** would mean a backup root that quietly grows without bound — a permission
  problem, a locked directory, a file the application cannot remove — with nothing anywhere able to
  say so. The user's disk fills and the application's own documentation says retention is ten.
- **A field** costs one struct with an enum and four `usize`s, cannot be ignored *silently* by 2c (a
  `bounded()` of `false` is a fact 2c can choose to show), and cannot break anything by existing. A
  `false` there means the root is not known to hold at most ten batches, which is untidy and is not
  dangerous.

### 4.2 Ordering is by `(stamp, counter)`, and the counter is a number

The stamp format sorts lexicographically in the same order it sorts chronologically, which is why the
comparison is a string comparison and not a date library. The disambiguating counter is parsed and
compared **as a number**, because `…Z-2` is older than `…Z-10` and a lexicographic comparison of the
whole name gets that backwards. `the_disambiguating_counter_orders_as_a_number_and_not_as_text` fires
on it.

### 4.3 The timestamp is written by hand, and why that is not a false economy

`batch_stamp` formats UTC as `YYYY-MM-DDTHHMMSSZ` using Howard Hinnant's `civil_from_days`. **UTC, not
local time**, for three reasons: `:` is a poor directory-name character; a local-time stamp goes
backwards an hour once a year, which would silently reorder rotation; and the format has to sort. A
date crate would have brought time zones, parsing and localisation for **one directory name**, and the
whole conversion is fifteen lines pinned by five known values including a leap day and the epoch.

`every_stamp_this_module_mints_is_a_name_rotation_recognises` closes the loop the other way: a format
and a grammar that disagreed would make every batch foreign to rotation and nothing would ever be
removed — a failure that no test of either half alone would catch.

---

## 5. Decision — what the copy carries, and the ACL it deliberately does not

A backup is a new inode, so 2a-3a's question arrives again. The answer is **not** the same answer.

| Class | Carried? | Why |
|---|---|---|
| **the bytes** | yes, from the transaction's in-memory `source` | they are the exact bytes whose hash the revision check verified. `COPYFILE_DATA` would read them from the descriptor again, and another process can write an inode in place under an open descriptor — so reading from memory is *strictly stronger*, not merely cheaper |
| **mode bits** | yes, `fchmod` from the same `fstat` | a copy should be as accessible as what it copies, and no more |
| **extended attributes** | yes, `fcopyfile(COPYFILE_XATTR)` | including the resource fork where the filesystem exposes it as one, so the copy is the whole file rather than only its data fork |
| **the access control list** | **no** | below |
| `COPYFILE_STAT` (owner, group, timestamps, BSD flags) | no | 2a-3a's four reasons, plus a fifth specific here: a `uchg` backup is an unrotatable backup |

### 5.1 Why the ACL is dropped, when the atomic write carries it

**Rotation deletes directories, and a copied denying entry makes a copy undeletable.** This is
measured, not supposed: 2a-3a §6 measurement 5 found that `everyone deny delete` on a file makes
`remove_file` fail with `EACCES`. Carry the ACL onto a backup and *retain the last ten batches* becomes
unbounded growth of directories this application can never clean up — silently, because §4.1 makes a
rotation failure a count rather than an error. The mechanism that exists to bound the backup tree
would be defeated by the mechanism that exists to make the backups faithful.

**The argument for carrying it, and where it is answered.** An ACL can *deny* as well as grant, so
dropping one can leave a copy **more** reachable than the original — which is the exact class of
change 2a-3a exists to stop, in the exact permissive direction. Three things answer it, and the third
is the one that settles it:

1. **the copy keeps the target's own mode bits.** A `0o600` file is copied `0o600`;
2. **every directory of the backup tree is created `0o700`, and an existing root is *checked* to be
   no wider.** The check is the review round's (finding 9): the first version requested `0o700` when it
   created a directory and adopted an existing root without looking at it at all, so the premise
   *"nobody but the owner can traverse into it"* was an assumption about a directory this application
   may not have made. `create_backup_root` now refuses an existing root whose mode grants anything to
   group or other. **It is a mode-bit boundary and nothing more** — §8 states it as an assumption and
   §9 hole 14 states what defeats it;
3. **the denying ACLs that would matter for confidentiality are unreachable here.** A `deny read`
   entry makes the target unopenable, so `inspect_target` refuses the save before any of this
   (2a-3a §6 measurement 6). What remains reachable — `deny write`, `deny writeattr`, `deny chown`,
   `deny delete` — restricts *modification*, not reading, so dropping it cannot make a copy more
   *readable* than the file it copies. It can make the copy easier to modify or delete, which is
   precisely what rotation needs.

The residue is stated as a hole (§8 hole 3) rather than argued away: a *granting* entry that widened
access on the original is not reproduced on the copy, so a backup is sometimes **less** reachable than
its original — which is the safe direction but is still a difference, and a restore by hand will not
reproduce it.

### 5.2 One call site, two named policies

`copy_metadata` was not exposed and no `pub(super)` twin was bolted beside it. Instead the `unsafe`
block became `copy_through_copyfile(source, destination, flags)` and two named functions sit on it:
`copy_metadata` (`ACL | XATTR`) and `copy_extended_attributes` (`XATTR`). The difference between what
a save carries and what a backup carries is therefore **one visible constant** rather than two
independently maintained `unsafe` blocks that can drift, and 2a-3a §10's *"one answer to what a copy
carries"* survives as *one call, two declared policies*.

---

## 6. The tension between the two rules, and how it is removed

**The tension, stated plainly.** If a file is copied only on its *first* modification per session, and
rotation keeps only the newest ten batches, then a long session can rotate away a file's only pristine
copy — and the per-session rule guarantees it will never be taken again.

**It is real if and only if a batch is a save.** With a batch per save, a session that modifies eleven
different files mints eleven batches; the eleventh rotates the first away; and the first file is now
recorded as already copied, so nothing will ever copy it again. That is the failure mode.

**A batch is a session, so it cannot happen.** One session mints one directory, lazily, at its first
copy. Rotation runs **once**, and the directory this session is writing into is **excluded from removal
by identity** (§4 property 5) — so the only directory that could hold a copy this session took is not a
candidate at all, for any retention of one or more, however many files the session saves and whatever
the wall clock does in the meantime.

The first version of this paragraph made the same claim from a weaker premise: rotation ran while the
new directory was still empty and newest *by name*, and *newest by name* is a claim about a clock. The
conclusion is unchanged and the reason for it is now a check.

This is a **structural** answer rather than a documented hazard, and it is pinned twice:

- `a_session_that_saves_more_files_than_the_retention_window_keeps_every_copy` — twenty files (twice
  the window) in one session; every copy is read back and every one is intact;
- **E27** (§7.2) restores the per-save batch **and the per-save rotation** and the test fires with
  `…/match/file00.yml was rotated away`, which is the tension reproduced rather than described. It
  takes both halves now: minting a batch per save is no longer enough to lose a copy, because rotation
  runs once per session whatever the batches do;
- **E32** removes the identity exclusion and `rotation_never_removes_the_batch_it_was_told_is_current`
  fires — the same loss reached through a clock rather than through a retention window.

**What retention still means, and the sentence that must never be written.** Ten *sessions*, not
forever. The eleventh session after this one removes this one's batch, and nothing in this crate can
promise a file is recoverable. ***Your file is recoverable* joins the forbidden sentences** — beside
*espanso will reject this*, *your edit cannot be lost*, *this file is valid* and *nothing was
written*. No variant name, doc comment, test name or assertion message in this sub-phase says it.

---

## 7. Decision — a backup that cannot be written **fails the save**

If `capture` fails, the save stops before the commit and the caller gets `SaveError::Backup`. **This
call has not renamed anything over the target**, which is a statement about this call and not about
what the file holds now — an external writer is always possible, and the target must be re-read.

**Why.** A save whose safety net cannot be put in place is a destructive operation performed without
the copy that exists to survive it. It is 2a-3a §4's argument, one level up, and 2a-2b §9's rule in the
same words: *refusing a save never destroys data; permitting one might; the reversible direction is to
refuse*. Committing anyway would put an unread field between a user and that, and a `Result` is
`#[must_use]` where a field is not.

**What it costs, honestly — and the first version of this paragraph was wrong.** It said *"the attempt,
and nothing else"*, and review finding 3 showed that to be false: rotation ran when the batch directory
was minted, so a backup that then failed had **already removed an older batch**. The ordering is fixed
(§4.0) and the sentence is rewritten rather than defended:

> A failed backup costs the attempt **and one empty batch directory**. The caller still holds the
> candidate, the document in the editor is untouched, and this call has not renamed anything over the
> target. **No older batch is removed**, because rotation now runs only after a copy has been written
> and fsynced. The empty directory carries its ownership marker, so the next session's rotation counts
> it and it leaves in its turn — it is litter with a bounded lifetime, not a leak.

A caller that does not want backups says `backups: None`, which cannot produce this at all.

**It is a failure, not a refusal.** `is_refusal()` answers `false`. No check declined anything — the
filesystem refused an operation, exactly as it does for `WriteError::Io` — so 2b shows it as a problem
rather than as a choice. `may_have_written()` answers `false`, because it happens before the rename.

`a_backup_that_cannot_be_written_stops_the_save_before_the_commit` reaches it by putting a **regular
file** where the backup root belongs, which is now `BackupError::NotADirectory` rather than an
`ENOTDIR` deeper in. `a_backup_that_fails_after_its_batch_exists_removes_no_older_batch` reaches the
harder case — a failure **after** the batch exists — by giving the configuration root a directory named
exactly like a batch's ownership marker, so the copy's own parent cannot be created inside the batch.
Eleven older batches are waiting, and all eleven survive.

### 7.1 The other half: a backup whose **save** then fails

`SaveError::Backup` is a backup that failed. The opposite case is a backup that **succeeded** and a
commit that then did not, and the first version left the file recorded as copied — so a retry committed
over a target another writer may have changed, with no copy of the bytes it replaced (review finding 4,
inside §9 hole 2). `save_document` now calls `BackupSession::discard` when `replace_locked_file` fails
with an error whose `may_have_written()` is `false`: the target leaves `captured` and the copy is
removed, so the retry takes a fresh one.

**An error that *may* have written keeps its copy and its record**, and that asymmetry is the whole
care in it: that copy is of bytes a rename may already have replaced, and it is the only one there is.
Deleting it would be the one deletion this module must never make.

**The removal is best effort; the un-capture is unconditional.** The un-capture is what stops a retry
from committing with no copy of the bytes it replaces, and that has to hold whether or not the
filesystem let the copy go — so it is not made conditional on the removal, and *"un-capture only when
the removal succeeded"* was considered and rejected for exactly that reason: it would reopen finding 4
precisely on the failure it is meant to survive.

**A removal that fails is now recorded rather than ignored, and that is the confirmation round's
change.** The first version left it at *best effort*: the copy stayed at the name a retry would publish
under, the retry was refused with `BackupError::DestinationExists`, and so was every later attempt on
that file — one refused `unlink` made a file unsaveable for the rest of the session, on a failure that
had nothing to do with it. The direction was right (refusing beats committing with no backup) and the
**permanence** was a trap.

The target now joins `SessionState::abandoned`, and `publish_backup` is allowed to choose the next free
**sibling** name for it — `base.yml-1`, `base.yml-2`, … — with `create_batch`'s own bounded counter loop
one level down (`BACKUP_NAME_ATTEMPTS`, 64), and the undisambiguated name tried first so a copy that was
removed after all is published where it belongs. Two properties hold together:

- **nothing is ever overwritten.** Every candidate is checked to be free before the `rename`, and a
  candidate that is not free is *skipped, never truncated*. The stale copy may be the only pristine copy
  of an older version of that file;
- **a retry can always take its own backup**, so no file becomes permanently unsaveable through a
  session. Exhaustion is bounded and loud — `BackupError::BackupNameExhausted`, the file-level twin of
  `BatchNameExhausted` — and it needs 64 published-then-unremovable copies of one file in one session.

`BackupError::DestinationExists` **survives**, deliberately, for the case it was written for: two
different targets resolving to one backup path is a **defect, not a race**, and that copy has no
business existing under another name. Only the session can tell the two apart, because only the session
knows which name it left behind, so `capture` passes the answer down rather than `publish_backup`
guessing it.

### 7.2 The disabling experiments

Each sabotage was applied to production code, the affected binaries were run, and the change was
reverted; each file was then compared byte for byte against a copy taken beforehand and restored
identically. **E25 to E29b were re-run after the review round**, because five new acceptance tests
change what some of them catch; the counts below are the re-measured ones, and where the review round
changed an experiment's meaning that is said rather than left to be inferred.

| # | Sabotage | Result |
|---|---|---|
| **E25** | `take_backup` always answers `Ok(None)` | **fires (20 of 23)** in `tests/persist_backup.rs`. The acceptance criterion's experiment: remove the call, watch the tests fail, restore |
| **E26** | `copy_extended_attributes` uses `COPYFILE_ACL \| COPYFILE_XATTR` | **fires (1)** — `the_backup_does_not_carry_the_targets_access_control_list`. Deliberately narrow: it isolates §5's decision from everything else, so a suite that only proved "some metadata moved" would be caught here |
| **E27** | a batch is minted **per save**, and rotated per save, instead of per session | **fires (5)**, and the message is the tension itself: `…/match/file00.yml was rotated away`. §6's experiment. **It now needs both halves**: minting per batch alone fires on the batch count and *not* on a lost copy, because §4.0's `rotated` flag keeps rotation to once per session however many directories are minted. The tension needs a rotation per save to reproduce, and saying so is more useful than a green half-experiment |
| **E28** | `parse_batch_name` accepts every name | **fires (3)** — three unit tests. It fired four before, and the fourth was `rotation_through_a_save_leaves_a_foreign_directory_alone`, which now survives a grammar that recognises everything **because the ownership marker (finding 2) is a second, independent defence**. That is the marker's whole point, and the drop from four to three is evidence it works rather than evidence of a weakened test. E31 covers the marker separately |
| **E29a** | the backup is taken regardless of `committed` | **fires (1)** — `a_save_that_rewrites_nothing_takes_no_backup` |
| **E29b** | the backup is taken **before** the verdict | **fires (16)**, led by `a_refused_save_leaves_no_backup_of_a_file_nobody_changed`. This is the placement 2a-2b §8 established, checked rather than assumed |

**The review round's nine**, run the same way. Each was applied to production code alone, the affected
binaries were run, and both files were restored and compared byte for byte afterwards (`cmp`, both
identical).

| # | Sabotage | Result |
|---|---|---|
| **E30** | rotation runs when the batch is **minted**, as the first version had it | **fires (1)** — `a_backup_that_fails_after_its_batch_exists_removes_no_older_batch`, with `…/2026-07-29T140000Z was removed for a backup that never happened`. Review finding 3, reproduced |
| **E31** | `rotate` drops the `carries_batch_marker` requirement | **fires (1)** — `rotation_leaves_a_batch_shaped_directory_that_carries_no_marker`. Deliberately narrow: it isolates finding 2 from the name grammar, which E28 already covers |
| **E32** | `rotate` drops the current-batch exclusion | **fires (1)** — `rotation_never_removes_the_batch_it_was_told_is_current`. Finding 10 |
| **E33** | `create_backup_root` adopts every `AlreadyExists`, as the first version did | **fires (4)** — three unit tests and `a_symlinked_backup_root_stops_the_save_and_touches_nothing_behind_it`. **This is the experiment worth reading**: the acceptance test does not merely fail, it reports `rotation: Rotation { removed: 2 }` *inside the linked tree*. Findings 1 and 9, and the damage each names |
| **E34** | `write_backup` writes straight to the destination with `create_new` | **fires (1)** — `a_backup_that_cannot_be_published_leaves_no_temporary_file_behind`, on the step in the error: a creation failure, not a publication one. Finding 7 |
| **E35** | `save_document` does not discard the copy when the commit fails | **fires (1)** — `a_save_whose_commit_fails_leaves_the_file_free_to_be_copied_again`. Finding 4's cheap half |
| **E36** | `capture` ignores `refuse_an_auto_loaded_root` | **fires (1)** — `a_session_rooted_at_an_auto_loaded_directory_writes_nothing`. Finding 5 |
| **E37** | `backup_relative_path` stops escaping an in-root `_outside` | **fires (1)** — `an_in_root_outside_directory_does_not_collide_with_an_external_path`. Finding 6's namespace half |
| **E38** | `Rotation` loses its outcome, and `entries` goes back to `.flatten()` | **fires (5)** — four unit tests and `a_rotation_that_ran_says_so_even_when_it_removed_nothing`. Finding 8 |

**The confirmation round's three**, run the same way — applied to `persist/backup.rs` alone, the tests
run, the file restored from a copy taken beforehand and compared byte for byte (`cmp`, identical after
each). They cover both halves of the fix and the variant it deliberately keeps.

| # | Sabotage | Result |
|---|---|---|
| **E39a** | `discard` goes back to `let _ = fs::remove_file(…)`, recording nothing when the removal fails | **fires (1)** — `a_retry_publishes_beside_a_copy_that_could_not_be_removed`, with `the retry is not refused by the copy it could not remove: DestinationExists { … /match/base.yml }`. This is the residue itself, reproduced: the session forgets it left the name occupied, and the retry is refused |
| **E39b** | `publish_backup` ignores `disambiguate` and always refuses a taken name | **fires (2)** — the same acceptance test and `a_disambiguated_copy_keeps_its_name_and_gains_a_counter`. The other half: recording the abandoned name buys nothing if the publish will not use it |
| **E39c** | `publish_backup` disambiguates **unconditionally**, dropping the `!disambiguate` guard | **fires (1)** — `a_backup_that_cannot_be_published_leaves_no_temporary_file_behind`. The experiment for what the fix does **not** widen: `DestinationExists` still fires for two targets resolving to one backup path, which is a defect rather than a race |

**One review fix has no experiment of its own, and saying so is the point**: `Rotation::unreadable`
counts an entry the directory iterator could not produce, and no input is known that makes `read_dir`'s
iterator fail on this machine without also making the test's own cleanup impossible. It is the same
shape as `Rotation::failed` and is recorded as §9 hole 4 alongside it. E38 fires on the outcome half of
finding 8, not on this count.

**One experiment was considered and not run, because it would fire nothing**, and saying so is worth
more than running it: moving the backup to **after** the rename does not change the bytes it writes.
They come from memory, and the descriptor `fcopyfile` reads the attributes from still refers to the old
inode after a rename. What the ordering buys is **durability before the target is replaced**, and
nothing in this repository can observe that without a crash (§8 hole 1).

---

## 8. What is proven, and what is assumed

**Proven, by a test that fails when the property is removed:**

- a committed save copies the target's pre-save bytes, byte for byte;
- a refusal, a byte-identical candidate and a second modification each copy nothing;
- the backup path is a sibling of `match/`, and `discovery::enumerate` cannot see it;
- twenty files in one session keep twenty copies;
- eleven sessions leave ten batches and remove the oldest;
- a foreign directory, a foreign file, a batch-named symlink and a **batch-shaped directory carrying no
  ownership marker** all survive rotation, and none of them consumes a retention slot;
- the batch a session is writing into survives rotation **even when ten future-dated directories make
  it the oldest by name**;
- a backup that fails after its batch exists removes **no** older batch, and leaves nothing at the
  destination name — the next attempt on that file is not refused by the wreck of the last one;
- a save whose **commit** fails leaves the file free to be copied again, and the retry's copy is the
  bytes the retry replaced;
- **a copy this session could not remove does not make its file unsaveable for the rest of the
  session**: the retry publishes under the next free sibling name, and the copy left behind still holds
  its own bytes;
- an existing backup root that is a symlink, a regular file, or reachable by group or other is refused
  before anything is created — and nothing behind the symlink is read, listed or removed;
- a session rooted at `match/` or `config/` writes nothing at all, and `discovery::enumerate` still
  sees exactly the configuration files it saw before;
- an in-root `_outside/…` and an external path are two backups, and the escape stays injective;
- the copy wears the target's mode bits inside a `0o700` tree, carries its extended attributes, and
  carries **no** access control list — and is therefore deletable;
- a backup that cannot be written fails the save with the target byte-identical;
- 13 real configuration files go through one session into one batch, each copy byte-identical to its
  original.

**Assumed, and named as assumptions:**

- **that espanso's include globs are rooted at `match/` and `config/`.** The claim *"no glob rooted at
  `match/` reaches a sibling of `match/`"* is arithmetic; the premise is read out of espanso's
  documentation and its default configuration, not observed against a running daemon. Nothing in this
  repository has ever been checked against a running espanso (2a-2b's standing note);
- **that `fs::remove_dir_all` does not follow symlinks.** This is `std`'s documented behaviour and the
  test that plants a link inside the backup root exercises the *skip* rather than the removal, because
  the link is not a directory and never reaches `remove_dir_all` at all;
- **that a `0o700` directory is a confidentiality boundary.** It is, for **mode-bit** access control;
  it is not against a process running as the same user, and it is not against a backup agent with full
  disk access. The review round narrowed this from an assumption about *every* directory in the tree to
  an assumption about *mode bits*: an existing root is now checked, so the untested part is what mode
  bits cannot see. **An inheritable granting ACL on a containing directory can make a newly created
  `0o700` directory traversable by another principal**, and nothing here looks for one. That is
  Codex's platform claim, taken as stated rather than measured — this repository has measured denying
  entries (2a-3a §6) and has never measured an inherited granting one;
- **that `COPYFILE_XATTR` carries no access-control meaning.** The backup carries extended attributes
  and not the ACL, and the argument for that assumes the attributes it does carry — Finder metadata,
  quarantine, provenance, the resource fork — are not access control. That is true of the ones this
  repository has looked at and is not a claim about every namespace macOS may add;
- **that an ownership marker is a defence against accident and not against a principal.** Anything able
  to write inside the backup root can write a marker, so property 2 of §4 bounds mistakes rather than
  attacks. The attacker it does not stop is the same-user attacker `2a-3a-notes.md` hole 14 puts out of
  scope for the rename, and for the same reason: pathnames, not descriptors.

---

## 9. Coverage holes, stated as holes

1. **Nothing here survives a crash on purpose, and no test can tell.** The copy is `fsync`ed before the
   rename, so the bytes are durable before the target is replaced — but the **directory entries that
   name it** (the backup root, the batch, the mirrored parents) are not. A power cut can therefore
   leave a durable copy nobody can find. The write path syncs the target's containing directory after
   the rename and calls even that best effort; this path does less, deliberately, because a backup
   defends against *this application's own bad write* and against the residual race, both of which
   leave the machine running. If backups are ever meant to survive power loss, this is where to start.
2. **A backup can be taken for a save that then refuses, and the *ordering* is still unfixed.**
   `capture` runs before `replace_locked_file`, whose pre-commit re-checks can refuse — a target
   changed under the write, a temp pathname repointed — so a copy is sometimes taken for a save that
   does not happen. The copy is of bytes that really were on disk, so it is never *wrong*; it is
   sometimes *unnecessary*.

   **The consequence the first version of this hole missed is fixed** (review finding 4): the file is
   no longer left recorded as copied. `save_document` calls `BackupSession::discard` when the commit
   fails with an error that did not reach its rename, so a retry takes a fresh copy of the bytes it
   actually replaces (§7.1). What remains is the unnecessary attempt itself, and one directory entry's
   worth of churn.

   **The full fix is out of this sub-phase's scope, and it is a redesign rather than a fix**: the
   locked writer would have to split into a preparation phase that completes every refusal-producing
   check and a commit phase that cannot refuse, with the backup published between them. That is 2a-1's
   write primitive re-cut, it changes what `replace_locked_file` is, and it should be decided with the
   rest of the residual-race work rather than inside a review round. Not reachable from a test in this
   repository either way, because the refusals it is about need a second process; the *commit failure*
   half is reachable, and `a_save_whose_commit_fails_leaves_the_file_free_to_be_copied_again` reaches
   it with an unwritable directory.
3. **A granting ACL is not reproduced on a copy** (§5.1). A backup can therefore be *less* reachable
   than its original, and a restore by hand will not put the entry back. The safe direction, and still
   a difference.
4. **No test makes `remove_dir_all` fail**, so `Rotation::failed` is proven as a *type* and not as an
   observed failure. The same shape as 2a-3a's hole 1, and for the same reason: no input is known that
   produces it on this machine without also making the test's own cleanup impossible.
5. **No test measures what happens when the backup root is on a different filesystem** from the
   configuration root — a `.espansoconfig-backups` that is itself a symlink to another volume, say.
   Nothing here renames across it, so the `rename()` argument does not apply, but the claim is
   untested.
6. **Off macOS the extended-attribute half does not exist**, exactly as 2a-3a's does not, and every
   test of it is `cfg`-gated away there. A Linux CI would report this sub-phase as fully passing while
   testing none of that half.
7. **The ACL test can skip.** It prints a reason and returns when `chmod +a` fails or the volume does
   not keep the entry. On such a volume §5's decision has **no coverage at all** and the suite is
   still green.
8. **Nothing bounds the size of the backup tree in bytes.** Retention is ten *batches*, and a batch is
   a session with no limit on how many files it holds. A session that edits a large configuration ten
   times over ten sessions keeps ten whole copies of it. For an espanso configuration measured in
   kilobytes that is not a problem; it is also not a promise, and no code here checks.
9. **A leftover temp file is still nobody's to clean up** (2a-3a hole 6, inherited unchanged), and the
   backup now has one of its own. `write_backup` writes to `_<name>.espansoconfig-<pid>-….tmp` inside
   the batch and removes it on every failing path through a `Drop` guard — *attempted*, not
   guaranteed, exactly as the atomic write's is. What a failed backup can leave is that temp file, and
   it is inside a batch rotation will eventually take.
10. ~~**A partially written backup is not detected.**~~ **Fixed** (review finding 7). The first version
    wrote straight to the destination with `create_new`, so a failure after the create left a short
    file under a name nothing would revisit — and, worse than the undetectability this hole described,
    every later attempt on that file **in the same session** failed at `create_new` with
    `AlreadyExists`, forever. `write_backup` now writes to a temporary name, fsyncs, proves the name
    still holds the inode it wrote (`names_the_same_inode`, 2a-3a's check with a different error type),
    requires the destination to be free, and renames. A failed backup leaves the destination name
    **free**. The scope argument the first version made for not doing this was simply wrong: it costs
    one guard and one extracted function.

    **A residue of the same shape survived that fix and is fixed too** (confirmation pass, question 2).
    A copy that *succeeded* and could then not be **removed** — `discard`'s best-effort `unlink`,
    refused — left the destination name occupied while the file was un-captured, and every later attempt
    on it in that session was refused with `DestinationExists`. `publish_backup` now disambiguates with
    a bounded counter for a name this session itself abandoned, so a retry always has somewhere to
    write and nothing is overwritten (§7.1, §12 finding 7).

    What survives is narrower and is stated as its own hole (13, 15).
11. **`BackupSession` has no way to be told a session ended.** It ends when it is dropped, and a
    caller that keeps one for the life of the process has a session for the life of the process — in
    which case each file is copied exactly once, ever, and that is what "per session" means for that
    caller. 2c owns the decision about what a session is in the user interface, and this crate cannot
    make it.
12. **No test runs two sessions concurrently.** One session across two threads is tested (§3.3); two
    sessions minting batches at the same instant is only tested by `create_batch` directly, not
    through two `save_document` calls. Two sessions **rotating** at the same instant is not serialised
    at all: nothing takes a root-scoped lock, so two rotations can both decide to remove the same
    batch and one of them counts a `failed` for a directory the other removed. The counts are then
    wrong in the harmless direction, and neither can remove the other's current batch, because §4
    property 5 excludes it by identity.
13. **Two source paths can still map to one backup path, on a destination volume that folds them.**
    The `_outside` collision is fixed (§2.2), but a case-insensitive or normalisation-insensitive
    backup volume folds `A.yml` and `a.yml`, or a precomposed and a decomposed `é`, into one name. The
    failure is **loud rather than silent** — the second save fails at the destination-exists check
    with `BackupError::DestinationExists` and does not commit — which is the direction that cannot
    overwrite a backup, but it is a save the user cannot complete and no code here detects why. The
    fix Codex proposed, a digest of the canonical source-path bytes in the name, was weighed and
    rejected for now: it costs the readable path §2.2 chose deliberately, for a case that needs a file
    outside the configuration root on a folding volume.
14. **The privacy check on the backup root is a mode-bit check.** `create_backup_root` refuses an
    existing root that grants anything to group or other, which is what §5's confidentiality argument
    rests on — and an **inheritable granting ACL** on a containing directory can make a `0o700`
    directory traversable to another principal without changing a single mode bit. Nothing here looks
    for one, `COPYFILE_ACL` is deliberately not carried onto a backup (§5, and rotation depends on
    that), and no test on this machine has measured an inherited granting entry at all. It is stated
    as an assumption in §8 rather than argued away.
15. **Every check on the root and the batch is by pathname, and none is descriptor-anchored.** The
    review's suggested `openat`/`unlinkat` rotation would close the window between checking an entry
    and deleting it. It is not built here, and the reason is the standing scope statement rather than
    disagreement: `2a-3a-notes.md` hole 14 puts **a directory writable by an untrusted principal out
    of scope** for the rename, because the rename is by pathname and there is no descriptor form of
    it; rotation is in exactly that position. The checks that were added — the symlink refusal, the
    mode refusal, the ownership marker — remove a class of **accident**, and none of them is claimed
    to survive a concurrent same-user attacker.
16. **A configuration root nested more deeply inside an auto-loaded directory is not caught.**
    `refuse_an_auto_loaded_root` compares the resolved root's **final component** with `match` and
    `config`, so `rooted_at(root.join("match"))` is refused and `rooted_at(root.join("match/sub"))` is
    not. Widening the check to every component would refuse a legitimate `~/config/espanso`, which is
    a worse failure than the one it prevents; the caller's obligation is to pass espanso's own
    configuration root, and this catches the one mistake that is easy to make.

---

## 10. Verification

Each command run separately, at the repository root. **Every row was re-run after the confirmation
round**; the numbers below are the ones it produced.

| Command | Exit |
|---|---|
| `cargo fmt --check` | 0 |
| `cargo build --workspace` | 0 |
| `cargo test --workspace` | 0 — 20 test binaries, **787 tests**, 0 failed, 0 ignored |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0, no warnings |
| `cargo tree -p espansoconfig-core \| rg tauri` | **1 — nothing found**, which is the required result (`CLAUDE.md` §3, D2x) |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 cargo test -p espansoconfig-core --test persist_save -- saving_the_real_configuration` | 0 — 13 files, 65 matches, 13 committed, **0 refusals** |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 cargo test -p espansoconfig-core --test persist_backup -- backing_up_the_real` | 0 — **13 files copied, 0 with no editable scalar**, one batch |
| `npm test` | 0 — 27 files, 662 tests |
| `npm run check` | 0 — 374 files, 0 errors, 0 warnings |
| `git status --short --untracked-files=all` | **no path under `tests/corpus/real/`** |

The baseline was **736**; this sub-phase adds **51** — 28 unit tests in `persist/backup.rs` and 23
acceptance tests in `tests/persist_backup.rs`. Fifteen of those are the review round's and two are the
confirmation round's, and neither round **weakened or deleted an existing test**: the confirmation round
amended three `write_backup` call sites in the unit tests because the function gained a parameter, and
asserts exactly what it asserted before. Of the review round's amendments, three were made because the
code they describe changed on
purpose (`seed_batch` now writes the ownership marker; `copies_under` names the marker instead of
counting it as a copy; `rotation_through_a_save_leaves_a_foreign_directory_alone` creates its backup
root `0o700` because a wide one is now refused before rotation is reached), and three assertions on
`Rotation::default()` became assertions on a specific `RotationOutcome`, which is strictly stronger.
**No dependency was added or removed.**
`tests/corpus_integrity.rs` passes unchanged, and no file under `tests/corpus/` was written, moved or
reformatted.

### 10.1 The i18n obligation, checked rather than assumed

**Nothing new derives `Serialize`.** `BackupError`, `BackupStep`, `BackupRecord`, `Rotation`,
`RotationOutcome` and `BackupSession` do not — including the review round's five new `BackupError`
variants (`NotADirectory`, `BackupRootNotPrivate`, `ConfigRootIsAutoLoaded`,
`TempFileChangedDuringWrite`, `DestinationExists`), its four new `BackupStep` variants
(`InspectBackupRoot`, `WriteBatchMarker`, `VerifyBackupFile`, `PublishBackupFile`) and the new
`RotationOutcome` enum, and the confirmation round's sixth `BackupError` variant
(`BackupNameExhausted`) — and neither does `SaveError`'s `Backup` variant carry anything that does.
So `src-tauri/src/dictionary_contract.rs`'s
`every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code` does not see them, **no dictionary
key is owed today**, and **no i18n JSON file was touched** — verified by the whole `src-tauri` suite
(75 tests) passing unchanged.

The obligation transfers to 2b exactly like the others: the day `SaveError` gains `Serialize`,
`BackupError`, `BackupStep` and `RotationOutcome` join `WriteError`, `WriteStep`, `TargetDifference`,
`SaveVerdict`, `SaveRefusal`, `Acknowledgement`, `Finding`, `FindingCode`, `FindingClass` and
`EditError` in owing `code.` namespaces in **both** `en.json` and `es.json`. That is the same large,
single, indivisible change 2a-2b §8 addressed to 2b, **three** enums larger — the review round grew
`BackupError` by five variants and `BackupStep` by four, and added `RotationOutcome`, so the bill 2b
inherits is nine strings bigger than the first version's.

### 10.2 Privacy

The one real-corpus test copies each file into a `TempDir` before touching it, never writes inside
`tests/corpus/`, and prints **counts only** (`13 files copied, 0 with no editable scalar`). Every byte
the other seventeen tests write is hand-authored neutral YAML declared as a `const`, and every extended
attribute they set is a neutral literal (`"espansoconfig-test"`, `"carried into the backup"`).

---

## 11. What 2a-3c, 2b and 2c inherit, and should not rebuild

**Addressed to whatever follows in 2a-3:**

- **`save_document` is still the only entry point that should ever write a user's file**, and it now
  writes **two**: the target and, on a first modification, one backup. Any sentence that says a save
  writes one file is now wrong.
- **`inspect_target` is still the only read of a save target**, and the transaction now holds its
  `InspectedTarget` — descriptor included — from step 2 until after the backup. A later step that
  needs the target's bytes, mode or attributes has them; opening the file again reintroduces 2a-2b
  finding 8's deadlock and 2a-1 §4's TOCTOU at once.
- **Do not call `replace_file_atomically` from inside the transaction.** The lock is not reentrant and
  the process hangs silently and forever. Unchanged, and still true.
- **Rotation is the only destructive operation in the crate**, and its **seven** safety properties
  (§4) are checks, not conventions. Anything that adds a second caller of `rotate` — a *"clear my
  backups"* command, say — inherits all seven: the name grammar, the **ownership marker**, the
  unrecognised-does-not-count rule, the symlink refusal, the **current-batch exclusion**, the
  `.espansoconfig-backups` name check and the checked root. A second caller that has no current batch
  passes `None`, and then every batch is a candidate — which is what a *"clear my backups"* command
  means and is why the parameter is an `Option` rather than a convention.

**Addressed to 2b (the IPC surface):**

- **`SavedDocument::backup` is `Option<BackupRecord>` and a `None` is not a failure.** It means one of
  four things — no session, nothing committed, already copied this session, or a refusal with no
  `SavedDocument` at all — and 2b must not present it as "the backup failed".
- **`SaveError::Backup` is a failure, not a refusal**, so it is shown as a problem and never as an
  offer to retry differently. Its sentence is closer to *the copy this save takes before it writes
  could not be created, so the file was left as it was* than to anything else — and note that
  *nothing was written* is a phrase 2a-3a removed, and *your file is recoverable* is a phrase this
  sub-phase forbids.
- **`BackupError`, `BackupStep` and `RotationOutcome` owe `code.` namespaces in both dictionaries the
  day `SaveError` gains `Serialize`** (§10.1). Nothing is owed today. The review round made that bill
  nine strings bigger and the confirmation round one more (`BackupNameExhausted`); six of the new
  `BackupError` variants are **checks this application makes**
  (`NotADirectory`, `BackupRootNotPrivate`, `ConfigRootIsAutoLoaded`, `TempFileChangedDuringWrite`,
  `DestinationExists`, `BackupNameExhausted`) and they still arrive as `SaveError::Backup`, which
  `is_refusal()` classifies as
  a **failure**. That is deliberate and is stated so 2b does not have to guess: reclassifying them
  would mean splitting `SaveError::Backup` in two, and the user-visible difference — *retry this
  differently* versus *something is wrong with the backup location* — is a 2b decision, not a 2a one.
- **The save command's wire shape has to carry a backup path outward.** It is a `PathBuf`, so it goes
  through `WirePath` like every other path this crate puts on the wire.
- **`Rotation` is an outcome and four counts, and `bounded() == false` is the only thing worth a
  sentence.** `removed` is routine, `unrecognised` is somebody else's directory, and the outcome exists
  so that *"rotation could not look"* is never presented as *"there was nothing to do"*. The honest
  sentence for a `false` is about tidiness, never about safety: the backup root may now hold more than
  ten batches.

**Addressed to 2c (the user interface):**

- ***Reveal backups in Finder* points at `BackupSession::root()`**, and **that directory may not
  exist**. A session that has saved nothing creates nothing, deliberately, so the affordance has to
  decide what it does about an absent directory rather than assume one.
- **The user interface owns what a session is.** This crate cannot know; it copies once per
  `BackupSession`, and a `BackupSession` that lives for the process's lifetime means once per launch.
  Hole 11.
- **No string may say a file is recoverable.** Retention is ten sessions. The honest sentence names
  the number: *the last ten editing sessions' copies are kept*.
- **A backup is not a version history and must not be presented as one.** It holds the file as it was
  before the session's first change to it — not before each change, and not after any of them.

**Addressed to Phase 2 as a whole:**

- **`forgetFileText()`** in `src/lib/browser/workspace.svelte.ts` still has no caller and still must
  be called after a successful write. Unchanged from 2a-2b.
- **Hazard 11 is still three-quarters closed** (2a-3a §5), and this sub-phase does not change that.
  What it does change is what the plan's *"Backups are a safety net, not a substitute for revision
  checks and atomic writes"* now means concretely: the residual race is still one `rename()` wide, and
  a backup makes it **recoverable by hand for ten sessions**, which is not the same as closed.

---

## 12. Review disposition — the eleven findings

`docs/reviews/2a-3b-codex.md` is an adversarial review of the first version of this sub-phase. Its
verdict was **not safe to commit as-is**. Every finding below is *fixed*, *partly fixed* or *disposed*,
and a disposal names the standing rule or precedent it rests on. Nothing here is left silent.

Two of them falsified sentences this document had written, and those sections were **rewritten rather
than annotated**: §4 (the ordering of rotation) and §7 (*"the attempt, and nothing else"*).

**A confirmation pass over the review round then asked whether each fix actually held, and its question
2 is why there is a third round.** It found one residue, in the two findings that meet: finding 7 removed
the *partial copy* that poisoned every retry, and finding 4's `discard` reintroduced the same permanence
through a *copy that could not be removed*. The disposition below is the state after that round, and
findings 4 and 7 are written to describe what the code does **now** rather than what the second round
left. The other nine dispositions are unchanged and were not re-opened.

| # | Finding | Disposition |
|---|---|---|
| **1** | rotation can follow a replaced or symlinked backup root and delete outside it | **partly fixed** |
| **2** | a timestamp-shaped name is not proof this application created a directory | **fixed** |
| **3** | a failed backup can first delete an older valid backup | **fixed** |
| **4** | the backup precedes `replace_locked_file`'s own refusals | **partly fixed**, the rest disposed; `discard`'s contract restated in the confirmation round |
| **5** | the public constructor permits backups inside espanso's auto-loaded tree | **fixed** |
| **6** | `_outside` namespace collision, and destination-volume folding | **partly fixed**, the rest a hole |
| **7** | a partial backup permanently poisons retries in the same session | **fixed**, and the confirmation round fixed the residue of the same shape |
| **8** | rotation failures are frequently swallowed rather than counted | **fixed** |
| **9** | the ACL confidentiality argument assumes protection the code never verifies | **partly fixed**, the rest an assumption and a hole |
| **10** | clock ordering can select the newly created batch for deletion | **fixed** |
| **11** | comments and tests promise more than the transaction supports | **fixed** |

### 12.1 The findings, one at a time

**1 — a symlinked or replaced backup root. Partly fixed; the TOCTOU half disposed.**
`create_backup_root` now `symlink_metadata`s an existing root and refuses anything that is not a real
directory (`BackupError::NotADirectory`), and `create_batch` does the same for the directory it just
made. E33 shows what the check is worth: without it the save **succeeds** and rotation reports
`removed: 2` inside the tree the link points at. The *TOCTOU* half — an attacker replacing the root
between the check and the deletion — is **disposed**, and it rests on
`docs/decisions/2a-3a-notes.md` hole 14's standing scope statement: **a directory writable by an
untrusted principal is out of scope**, because every operation here is by pathname and macOS gives no
descriptor form of the ones that matter. Descriptor-anchored `openat`/`unlinkat` rotation is the fix
that would close it, and it is a design change rather than a review fix (§9 hole 15).

**2 — a timestamp-shaped name is not ownership. Fixed.** Every batch carries `.espansoconfig-batch`,
written as the directory is created, holding a format identifier and a version; `rotate` removes only
directories that carry it, and matches the identifier as a **prefix** so a newer build's batch is not
orphaned by an older one. `9999-99-99T999999Z` still parses — the grammar checks shape, not calendars
— and is now left alone, which the test asserts by name. **A marker is forgeable by anything that can
write inside the backup root**, and that principal is out of scope for finding 1's reason. E31 fires.

**3 — a failed backup could delete an older one. Fixed, and §4 and §7 rewritten.** Rotation runs after
`write_backup` returns, and a `rotated` flag on the session — separate from *the batch exists* — keeps
it exactly once even when the first copy failed. §4.0 records the ordering and, as the acceptance
criteria required, **checks that §6's structural argument survives it**: it does, and from a stronger
premise, because finding 10's fix excludes the current batch categorically rather than by name order.
E30 fires with the review's own scenario.

**4 — the backup precedes `replace_locked_file`'s pre-commit refusals. Cheap half fixed; the redesign
disposed.** `save_document` now calls `BackupSession::discard` when the commit fails with an error
whose `may_have_written()` is `false`: the file leaves `captured` and the copy is removed, so a retry
takes a fresh copy of the bytes it actually replaces. An error that **may** have written keeps both,
because that copy is of bytes the rename may already have replaced. The full fix — splitting the locked
writer into a preparation phase that makes every refusal and a commit phase that cannot — is
**disposed as out of this sub-phase's scope**: it re-cuts 2a-1's write primitive, and it belongs with
the residual-race work rather than inside a review round. §9 hole 2 is restated accurately rather than
left as it was. E35 fires.

**`discard`'s contract changed in the confirmation round**, and both halves are now stated rather than
implied. **The un-capture is unconditional** — it is what stops a retry committing with no copy of the
bytes it replaces, so it cannot be made conditional on a removal succeeding; *"un-capture only when the
removal succeeded"* was weighed and rejected, because it would reopen this very finding on the failure
it is meant to survive. **The removal is still best effort, but a removal that fails is recorded**
(`SessionState::abandoned`) instead of being dropped on the floor, which is what lets the retry publish
beside the copy rather than be refused by it. See finding 7 and §7.1. E39a fires.

**5 — a session root inside `match/`. Fixed.** `capture` refuses a configuration root whose final
component is `match` or `config`, before anything is created, with
`BackupError::ConfigRootIsAutoLoaded`. It is checked at capture rather than at construction because
`rooted_at` deliberately writes nothing and refuses nothing (§2.3, unchanged) — the refusal belongs
where the first byte would be written. The check is the **final component** only; a root nested more
deeply is not caught, and §9 hole 16 says so and says why widening it would refuse a legitimate
`~/config/espanso`. E36 fires.

**6 — path derivation collisions. Namespace half fixed; the volume half a hole.** The two namespaces
are now disjoint through an injective escape (§2.2), so an in-root `_outside/foo` and an external
`/foo` are two backups. The case-insensitive and normalisation-insensitive half is a property of the
**destination volume**, and it is recorded as §9 hole 13 with its concrete failure: the second save
fails at the destination-exists check and does not commit. The digest Codex suggested was weighed and
not adopted — it costs the readable path §2.2 chose deliberately, for a case that needs a file outside
the configuration root on a folding volume. E37 fires.

**7 — a partial backup poisons every retry. Fixed with the pattern this project already owns.**
`write_backup` writes to a unique temporary name inside the batch, fsyncs, proves the pathname still
holds the inode it wrote, requires the destination to be free, and renames; a `Drop` guard removes the
temporary on every failing path, *attempted* and not guaranteed, exactly as the atomic write's is. The
identity check is 2a-3a's `verify_temp_identity`, extracted to `names_the_same_inode` so that one
implementation serves both error types. §9 hole 10 is now marked fixed with the reason its original
scope argument was wrong. E34 fires on the step in the error — a publication failure, not a creation
one.

**The confirmation round found a residue of the same shape, and it is now fixed too.** The temporary
name removed *"a partial copy poisons every retry"*; it did not remove *"a copy that could not be
removed poisons every retry"*. `discard` un-captured the file and removed the copy best effort, so a
refused `unlink` left the file un-captured **and** its backup name occupied, and `write_backup`'s
exclusive publish then answered `DestinationExists` on that retry and on every later attempt in the
session — a file made permanently unsaveable by a failure that had nothing to do with it.

`publish_backup` now **disambiguates instead of refusing** when the occupied name is one this session
left behind: `create_batch`'s bounded counter loop, one level down, appending `-1`, `-2`, … to the file
name, with the undisambiguated name always tried first. Nothing is overwritten — every candidate is
checked to be free and a taken one is skipped, never truncated — and a retry can always take its own
backup. `DestinationExists` **survives** for the case it was written for, two different targets
resolving to one backup path, which is a defect and not a race; `capture` is what separates the two,
because only the session knows which name it abandoned. Exhaustion is `BackupNameExhausted`, bounded at
64. §7.1 argues it in full; E39a, E39b and E39c fire, the third on the half that is deliberately **not**
widened.

**8 — rotation failures swallowed. Fixed.** `Rotation` gained a `RotationOutcome`
(`NotAttempted` / `Refused` / `ScanFailed` / `Scanned`) and an `unreadable` count, `entries.flatten()`
became an explicit match, and `Rotation::bounded()` answers the one question a caller has. The policy
is unchanged: **counted, never returned**. E38 fires on five tests. The `unreadable` count itself has
no experiment, because no input is known that makes the iterator fail on this machine without also
breaking the test's own cleanup — §9 hole 4, beside `failed`, and said out loud rather than papered
over.

**9 — the ACL confidentiality argument. Narrow half fixed; the broad half an assumption and a hole.**
`create_backup_root` now refuses an existing root that grants anything to group or other
(`BackupError::BackupRootNotPrivate`), which composes with finding 1's symlink check in the same
place. The broader claim — an **inheritable granting ACL** on a containing directory defeating a
`0o700` boundary without changing a mode bit — is recorded as an assumption in §8 and as §9 hole 14,
stated plainly and not measured: this repository has measured denying entries (2a-3a §6) and has never
measured an inherited granting one. **`COPYFILE_ACL` is still not carried onto a backup**; §5's
rotation argument stands, and carrying it would make a copy undeletable. E33 fires on the mode check.

**10 — a backward clock can select the new batch. Fixed.** `rotate` takes the current batch and
excludes it by `(device, inode)` identity, with its path as a fallback, before any ordering is
considered. The retention arithmetic accounts for it: `keep` counts survivors, and the current batch is
one of them although it was never a candidate. The exclusion holds **after** finding 3's reordering,
which is when it matters most — the batch now holds a copy by the time rotation runs. E32 fires.

**11 — comments and tests promise more than the transaction supports. Fixed.** Every phrase the review
named was scoped to *this call*: `SaveError::Backup`'s doc no longer says "the target keeps its bytes"
but "this call did not reach its rename", and names what it *can* leave behind; the refusal test's
message is "this refusal created no backup root"; the foreign-directory test's is "this rotation removed
nothing without the ownership marker"; the module's summary line describes rotation as an attempted
retention policy. Constraint 7 — **risk, not prophecy** — is a `CLAUDE.md`-level rule, and the five
forbidden sentences (*espanso will reject this*, *your edit cannot be lost*, *this file is valid*,
*nothing was written*, *your file is recoverable*) were re-checked by grep across
`crates/espansoconfig-core/src/persist/` and `tests/persist_backup.rs`: none appears as a claim, and the
only occurrences are the prohibitions themselves.

### 12.2 What the review got right that is **not** changed

- **rotation is still counted, never returned** (§4.1). Finding 8 asked for the counts to be complete,
  not for a rotation failure to fail a save, and it is still a field;
- **the placement after the semantic verdict and the `committed` calculation is unchanged**, and the
  review agreed with it;
- **the copy still comes from the transaction's in-memory bytes**, and `inspect_target` is still the
  only read of a save target;
- **`COPYFILE_STAT` is still out**, and `COPYFILE_ACL` is still out for backups;
- **nothing new derives `Serialize`** — five `BackupError` variants, four `BackupStep` variants and one
  new enum were added in the review round and a sixth `BackupError` variant
  (`BackupNameExhausted`) in the confirmation round, and `src-tauri/src/dictionary_contract.rs` passes
  unchanged with no i18n JSON touched (§10.1);
- **nothing under `tests/corpus/` was added, moved or reformatted**, and no existing test was weakened
  or deleted (§10).
