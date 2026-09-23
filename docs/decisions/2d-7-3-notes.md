# Phase 2d-7-3 — the instrument, Rust side

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2, the *2d-7-3* block; bound by §3 entries
2–5 and 8–13, narrowed by §5.1, §5.10, §5.12, §5.13 and §5.16.
**Risk:** `high`. **Touched:** `src-tauri/src/probe.rs` only, which stays untracked and uncommitted
(entry 2). No page-side file, no hook line, no committed source file and no real-config file was
touched or opened. No window was launched, and **no window claim is made**: every Tauri-side
mechanism below is proven only as far as a compiler and `cargo test` prove it. 2d-7-4's shakedowns
are the first run against a webview.

---

## 0. Provenance (entry 3, §5.16)

Before any change, the pre-step file was copied:

| File | SHA-256 |
|---|---|
| `/private/tmp/2d7-3-probe.rs.orig` (pre-step) | `d2f6681d255c5767dc65e9454bce18cdcd0ad714184ee477536558c94f4c0942` |
| `src-tauri/src/probe.rs` (post-step, before the review fix) | `5d4f503dc020b839fd08f2fbb72ae5c3553649ac9e5ac9717717e282d63ef93a` |
| `src-tauri/src/probe.rs` (after the review fix, §7) | `7db7e05865efdd72979440b6f6f6993ce8a991d228c22a06f65bd2d5861b4789` |

`git diff --no-index --stat /private/tmp/2d7-3-probe.rs.orig src-tauri/src/probe.rs`:
`1 file changed, 1264 insertions(+), 105 deletions(-)` (976 lines before, 2134 after). The review
diffs against the `.orig` copy. These hashes are this step's record; the instrument's reviewed hashes
are 2d-7-4's (entry 3).

---

## 1. What changed in `probe.rs`, entry by entry

### 1.1 `rustfmt` on that file only (entry 4)

`rustfmt --edition 2021 src-tauri/src/probe.rs`, run on that one path after each edit. `cargo fmt
--check` now exits 0 with the instrument present; the ten `Diff in` hunks §1 recorded are gone.

### 1.2 True header counts (consult Q2 item 3)

- "Eight IPC commands" became **fourteen**, which `rg -c '#\[tauri::command\]' src-tauri/src/probe.rs`
  confirms (`14`). The header list now names all fourteen: the 2d-6-9c four
  (`probe_extra_writer`, `probe_remove_other`, `probe_remove_extra`, `probe_lock_other`) were
  missing, and the two new read-only commands are added.
- "Those last two are the dangerous part" pointed at the snapshot pair while describing the
  writers. It now names what it describes: the seven writers (four document writers, the extra
  writer, two removers) and the locker; the snapshot's own confinement is stated separately.
- `register_with_probe`'s "eight commands" / "eight more" became fourteen and "the same seventeen
  application commands and the fourteen of `PROBE_COMMANDS`". Its unchecked sentence "Every command
  `main.rs` registers is named again here" now cites the test that enforces it.
- Every `which` - `"second"` or `"third"` argument doc now says what `which` actually is.
- `rg -n -e Eight -e eight -e 'four probe' src-tauri/src/probe.rs` finds nothing.
- **The four-rebindings paragraph (`probe.rs:41-54` before, `:54-67` after) is byte-for-byte
  unchanged** (`sed -n 54,67p` of the new file `cmp`s equal to `sed -n 41,54p` of the `.orig`); the
  fifth and sixth are a new paragraph after it (§2 below).

### 1.3 Command parity and `const PROBE_COMMANDS` (entry 8)

- `pub const PROBE_COMMANDS: [&str; 14]` lists the probe's commands.
- `pub const WRITE_COMMANDS: [&str; 6]` lists the six write commands of `main.rs`'s `register` doc
  comment.
- `#[cfg(test)] probe::tests::command_parity` reads `main.rs` and `probe.rs` with `include_str!`,
  lexes each with `proc_macro2` (so comments and strings never match), finds the first
  `generate_handler ! [ … ]` after `fn register` / `fn register_with_probe`, and parses the list as
  `syn::Path`s. A leading `crate::` is stripped before comparing, and the test's doc says so.
  - **Application half:** the probe macro's non-probe paths must equal `register`'s as an
    **ordered list** (so an omission, addition, duplicate or reordering fails).
  - **Probe half:** its names must equal `PROBE_COMMANDS` as a set, and neither may hold a
    duplicate.
  - The test's doc states that it cannot see a command registered by any other mechanism, and it
    exists only while the instrument does.
- `write_commands_are_registered` requires each `WRITE_COMMANDS` name to be a registered
  application command. Whether a command *writes* is the doc comment's word, and the constant's doc
  says so.

### 1.4 The dispatch tally and `probe_tally` (entry 11)

- `register_with_probe` binds the generated handler as `inner` and installs
  `move |invoke| { record_dispatch(invoke.message.command()); inner(invoke) }`. The wrapper records
  the name and calls `inner` exactly once, and does nothing else. The doc comment states that **Rust
  forces none of this**.
- A small `as_handler` identity function names the closure's type so the macro's closure can be bound
  to a variable (without it, `E0282: type annotations needed`).
- `record_dispatch` classifies by `PROBE_COMMANDS`. Application dispatches are kept in order with a
  sequence number and microseconds since the tally clock's origin, which is first read by
  `register_with_probe`. Probe dispatches are **counts by name only**, so `pause`'s `probe_plan`
  trips cannot drown the application tally.
- `probe_tally` (read-only, in-memory, no plan needed) answers JSON: `probe_commands`,
  `write_commands`, `application.{dispatches, by_name, writes}`, `probe.by_name`, and `wakes`
  (§1.6). Times, epochs and wake sequences are strings, because a JSON number past 2^53 loses
  precision in the page.
- No counter was placed in `commands.rs`, `run_one_save`, `commit_and_record` or the core. The
  safety `rg` (§4) is a review check, not a guarantee.
- The tally sees only commands that reach the application's own handler, and a `plugin:…` command
  never does. That is what entry 15's "page > Rust is allowed only for `plugin:event|*`" relies on.

### 1.5 The read-only `probe_witness` (entry 12)

- `probe_witness` needs the plan and `TARGET_TAIL`'s rule to find the launch (the lookup was factored
  out of `probe_snapshot` into `confined_launch`). It then walks `<launch>/xdg` and `<launch>/home`.
- **The backup root:** `.espansoconfig-backups` is a direct child of the configuration root
  `<launch>/xdg/espanso` (`crates/espansoconfig-core/src/persist/backup.rs:228`,
  `persist/mod.rs:134`), so the `xdg` walk covers it. The answer also names it separately
  (`backup_root.path`, `backup_root.directory`) so a reading can cite it.
- Every entry is described with `symlink_metadata`. A directory is descended into only if that
  description says it is a real directory, so a symlinked directory is reported and not entered; a
  witness root that is not a real directory is reported as `not walked`.
- Each entry reports: `path` (relative to the launch), `kind`, `dev`, `ino`, `size`, `mode`,
  `mtime_ns`, `ctime_ns`. Every number that can pass 2^53 is a string.
- A regular file is hashed through `open_nofollow` (read-only, `O_NOFOLLOW | O_NONBLOCK`), and the
  hash is reported **only when the opened descriptor is a regular file with the same `dev`/`ino`**
  the description had. Otherwise, or on any error (e.g. mode `0o000`), it reports `unhashed` with the
  reason. SHA-256 is `espansoconfig_core::ContentRevision::of_bytes(..).to_hex()`, so no dependency
  was added to a tracked manifest.
- Limits: depth 16 and 4 096 entries, past which `truncated: true`.
- **What it does not see**, stated in its doc comment and section header:
  - anything outside those two trees;
  - anything between two witnesses (a write restored to its old inode and `ctime` looks unchanged);
  - a write in place between an entry's description and its read, which shows in the hash and not in
    the metadata.
- `O_NOFOLLOW` (`0x0100`) and `O_NONBLOCK` (`0x0004`) are Darwin's values, written out because
  `libc` may not be added. Nothing checks them at compile time. The test `nofollow_refuses_a_symlink`
  checks at test time that an `O_NOFOLLOW` open of a symlink answers `ELOOP` (62), and that the same
  open of a regular file succeeds.

### 1.6 The wake-emit tally, from `on_page_load` (entry 13, §5.12)

- `register_with_probe` sets `.on_page_load(|webview, _| install_counting_wake_emitter(webview))`.
  Nothing else in `src-tauri/src/` sets that hook. **There is no setup call in `probe.rs`**
  (`rg -c "\.setup\(" src-tauri/src/probe.rs` finds nothing), so `register`'s production installation
  stands.
- `install_counting_wake_emitter` runs on **every** page-load callback of any kind (`Started`
  included, never filtered). A `OnceLock` (`COUNTING_EMITTER`) builds the counting emitter once,
  wrapped around `crate::events::wake_emitter(app_handle)`. Each callback installs that same emitter
  through `WorkspaceSession::install_wake_emitter` and counts the installation.
- The emitter records `{sequence, workspace_epoch, newest_sequence, at_us}` and then calls the
  production emitter once. It counts **calls into the emitter**, and the production emitter drops a
  failed emit silently, so a counted wake is one handed to Tauri, not one proven sent. The doc says so.
- **The tally counts from installation on, never "since launch"** (§5.12). The doc and the JSON's
  `first_installed_us` carry that window.

### 1.7 The snapshot request token (entry 10, §5.10)

- The single global `SNAPSHOT_PATH`/`SNAPSHOT_STATE` pair is replaced by one `SnapshotLedger`
  mutex, holding `next_token`, `paths` (by token) and `states` (by token, the last 64 kept).
- `probe_snapshot` takes the next token, records the path under it, and puts the token into the block
  literal as a trailing field (`BlockLiteral.token`). It returns `requested#<n>`.
- `snapshot_done` reads the token **from its own block**, not from a global. It writes only to that
  token's path and sets only that token's state. A late completion of an earlier request (a
  keep-alive) can therefore no longer write to a shot's path or report `written` for it.
- `probe_snapshot_state(token: Option<u64>)` answers `pending#<n>`, `written#<n>`, `refused#<n>: …`,
  `forgotten#<n>` (older than the last 64), or `none` (no request yet). With no token it answers the
  **latest request's** state, and its doc says that this is not necessarily the caller's request.
- **The token names the request. It does not prove that the image on disk is that request's** if two
  requests share a tag, because both write the same path. The section comment says so.
- The trailing block field relies on a `BLOCK_IS_GLOBAL` block's copy being the same pointer. That is
  the blocks runtime's documented behaviour, and no type checks it, as with every call in that
  section.

### 1.8 Confinement: the fifth and sixth rebindings (entry 9, §5.1) — see §2

---

## 2. The fifth and sixth rebindings

"Four" is kept in its present words. The fifth and sixth are listed as a new header paragraph and
never folded into "four".

- **Fifth — closed for the final component.**
  - **Before:** `probe_lock_other` changed the mode by pathname (`set_permissions`), which follows a
    symlink planted at the final component after the check.
  - **Now:** it opens the canonical target with `O_NOFOLLOW` (read-only, plus `O_NONBLOCK`). It
    requires the descriptor to be a regular file, then calls `File::set_permissions`, which acts
    through the descriptor (`fchmod`).
  - **Not closed:** a directory above the target rebound between the check and the open. The header
    and the function's doc place it in the third rebinding's class.
  - **Behaviour change:** opening for reading needs the read bit, so locking a file that is already
    unreadable is now a refusal where the pathname call succeeded. `probe.ts` calls the locker once
    per plan (`runStatusWriter('probe_lock_other')`), on a readable file.
- **Sixth — narrowed and disclosed, not closed.**
  - **Before:** `probe_snapshot` joined `shots` onto the launch directory unchecked.
  - **Now:** `check_shot_path` requires two things, using `symlink_metadata`: `<launch>/shots` is a
    real directory (not a symlink), and the image's own pathname holds nothing, or a regular file. The
    check runs once at request time and again in the completion handler, just before Cocoa writes.
  - **Still open:** the interval between that second check and Cocoa's `writeToFile:atomically:`, in
    which a `shots` replaced by a symlink would be followed. Nothing in `std` or in the Cocoa call
    pins the directory.
  - **Untested:** that `atomically:YES` writes an auxiliary file and renames it, so it replaces rather
    than follows a symlink at the final component. That is Apple's documentation, not tested here.
  - The doc sentence "nothing is written outside a launch tree" was restated to say exactly this.
- Both go on 2d-7-10's carried-forward list as entry 33 requires: the fifth for its directory-above
  residue (the third rebinding's class), and the sixth as disclosed.

---

## 3. The parity test, shown failing once

`crate::commands::read_backup_text,` was deleted from `register_with_probe`'s macro, and the single
test was run: `cargo test -p espansoconfig probe::tests::command_parity -- --test-threads=1`, output
redirected to a file. It **exited 101**. The failing lines (the `left`/`right` lists are abridged
here; both are the seventeen command paths, `left` lacking `commands::read_backup_text`):

```
test probe::tests::command_parity ... FAILED
thread 'probe::tests::command_parity' (6373323) panicked at src-tauri/src/probe.rs:2009:9:
assertion `left == right` failed: the instrumented handler's application commands differ from crate::register's
  left: ["commands::open_workspace", …, "commands::list_backup_entries", "commands::drain_external_changes", "menu::set_menu_labels"]
 right: ["commands::open_workspace", …, "commands::list_backup_entries", "commands::read_backup_text", "commands::drain_external_changes", "menu::set_menu_labels"]
test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 302 filtered out; finished in 0.02s
```

The file was then restored from a copy taken just before the deletion, and `cmp` against that copy
reported no difference. The test passes on the restored file (§4).

---

## 4. Gates

Every cargo and npm command's output was redirected to a file under `/private/tmp/2d7-3-*.txt`, and
its exit status was read from the tool, never through a pipe.

| Command | Exit | Figure |
|---|---|---|
| `rustfmt --edition 2021 src-tauri/src/probe.rs` | 0 | — |
| `cargo build --workspace` | 0 | — |
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | — |
| `cargo test --workspace -- --test-threads=1` | 0 | **1328 passed**, 0 failed (baseline 1323) |
| `npm run check` | 0 | 462 files, 0 errors, 0 warnings |
| `npm test` | 0 | 3547 tests passed |
| `npm run build` | 0 | 201 modules transformed |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `2 files changed, 5 insertions(+), 1 deletion(-)` |
| safety `rg` (below) | — | nothing |
| `rg -c "\.setup\(" src-tauri/src/probe.rs` | 1 | nothing |

**The Rust delta is +5, and this step added exactly five tests**, all in `probe::tests`:
`command_parity`, `write_commands_are_registered`, `nofollow_refuses_a_symlink`,
`the_witness_reads_without_following` and `snapshot_states_carry_their_token`.
- The instrument's Rust share is now 5 (entry 5). The committed tree's count never includes them.
- The frontend figures are unchanged, because no TypeScript was touched.

**The safety check:**
`rg -n "save_document|replace_file_atomically|replace_locked_file|run_one_save|begin_commit" src-tauri/src/probe.rs | rg -v '^[0-9]+:\s*//'`
finds nothing. Without the filter, the one hit is the `//!` doc comment at `probe.rs:93` (formerly
`:56`) stating that `save_document` stays the only writer. **It was kept unchanged.**
`rg -n '\.lock\(\)' src-tauri/src/probe.rs` finds only the probe's own statics: `SNAPSHOTS`,
`DISPATCHES` and `WAKES`.

**`git status --short --untracked-files=all`** shows the same four instrument paths as before
(`src-tauri/src/probe.rs` and `src/probe.ts` untracked; `main.rs` and `main.ts` modified), plus
`PROGRESS.json`. No fifth instrument path exists.

---

## 5. Deviations

1. **The counting emitter is installed on every page-load callback, not once.** The record says
   "guarded by a `OnceLock`". Here the `OnceLock` guards the emitter's **construction**, so the count
   is never lost, and each callback re-installs that same emitter.
   - **Why:** Tauri 2.11.5 builds the configured windows and then runs the setup hook in a single
     function on the main thread (`app.rs:2521-2535`), which suggests that no page-load callback can
     precede `register`'s own installation. That order was **read in the source and not observed**.
     A re-install means that if the order were ever the other way, the next callback restores the
     counting emitter instead of leaving the production one in place for the whole launch.
   - **Cost:** a wake emitted in between would go uncounted. The function's doc states this.
2. **The contract sweep reworded three phrases.** `retained_state_contract` sweeps every file under
   `src-tauri/src/`, the untracked `probe.rs` included. On the first full run it flagged "in one
   call", "never removed" and "never reset" in the new comments. The three were reworded in
   `probe.rs` ("within a single function", "narrowed but still open", "keeps its count" / "carries
   across installs"). The contract's `INVENTORY` was not touched, because it is a committed file and
   outside this step's one path.
3. **`probe_snapshot`'s and `probe_snapshot_state`'s answers changed shape** (`requested#<n>`,
   `pending#<n>`, …). The unmodified `probe.ts` compares against the bare `'pending'`, so until
   2d-7-4 updates the page, its `shot()` wait ends at once and prints `webview=pending#<n>`. That is
   loud, never a false `written`. No launch is planned before 2d-7-4.

---

## 6. Open items

For **2d-7-4**, all page side:

1. `shot()` must pass the token `probe_snapshot` returned to `probe_snapshot_state` and accept only
   `written#<its token>`. The keep-alive's wait must stop comparing against the bare `'pending'`.
   The forced-overlap shakedown prints the token it waited for (consult Q2 item 5).
2. `PROBE_OWN_COMMANDS` (currently eight names) must list all fourteen, and must be checked at run
   time against `probe_tally`'s `probe_commands`, printing `--- instrument MISMATCH` on a difference
   (entry 7 item 2). Until then, the six unlisted probe commands are recorded by the page as
   application traffic, and every reconciliation would show a page surplus.
3. The page's stale comments: "The four probe commands are never recorded" (`probe.ts:174-175`),
   "Every one of the four probe commands" (`:535-536`) and "The eight commands this instrument itself
   invokes" (`:179`).
4. `--- tally` checkpoints and the reconciliation lines (entry 15) read `probe_tally` and
   `probe_witness`. The page must treat the witness's string-typed numbers as strings.
5. **The spy control is the first evidence that installation from `on_page_load` precedes the
   page's listener** (entry 13). That the counting emitter is installed at all is shown by `wakes.installations ≥ 1`
   and `first_installed_us`.
6. **Unverified:** whether reading a watched file (the witness's hash) wakes the file watcher. An
   open for reading makes no modification, but whether an access-time update reaches FSEvents on this
   host was not checked. The identical-bytes and agreement shakedowns should show whether a witness
   alone produces a wake.

For **2d-7-10** (carried forward, entry 33): the fifth rebinding's directory-above residue, and the
sixth rebinding as disclosed.

---

## 7. Review fix

The phase review (`docs/reviews/phase-2d-7-3.md`) returned ship-with-fixes, with 0 blockers and one
SHOULD-FIX:

> The witness traversal follows directories replaced by symlinks. If a directory is swapped for a
> symlink after `symlink_metadata` described it, the recursive `read_dir` follows the symlink.

Only that finding was fixed, in `probe.rs` only.

**How `probe_witness` now traverses**, through pinned directory descriptors:

1. The canonical launch directory is opened once, with `O_DIRECTORY`.
2. Each witness root, and each subdirectory, is opened with `openat(O_DIRECTORY | O_NOFOLLOW)`
   relative to its parent's descriptor. A subdirectory is descended into only if its descriptor's
   `dev`/`ino` equal the `fstatat` description taken before the open.
3. Listings are read through the pinned descriptor itself: `fdopendir` over a duplicate, then
   `readdir`.
4. Entries are described with `fstatat(AT_SYMLINK_NOFOLLOW)` relative to the pinned parent.
5. Files are hashed through `openat(O_NOFOLLOW | O_NONBLOCK)` relative to the pinned parent, with
   the same `dev`/`ino` check.

**Nothing below the launch directory is resolved by pathname any more.** A directory swapped for a
symlink after it was described is an `ELOOP` refusal at its open. It is reported as `unlisted` and
never descended into.

**How the system calls are reached:**
- `openat`, `fstatat`, `fdopendir`, `readdir`, `closedir` and `__error` are declared as
  `extern "C"`. `$INODE64` link names are used on x86_64.
- Darwin's `struct stat` and `struct dirent` are written out as `repr(C)` structs, because no crate
  may be added to a tracked manifest.
- **Nothing checks those layouts at compile time.** The comments say so, and the tests check them at
  test time.
- A first attempt listed directories through `/dev/fd/<n>`. On this host that answers `ENOTDIR` for
  a directory, so it was replaced by `fdopendir` before any gate was run.

**What stays open**, and the doc says so:
- The launch directory, and every directory above it, is resolved by pathname once. That is the
  third rebinding's class.
- The `backup_root.directory` flag is a label, read by pathname. It describes no entry.

**Two tests were added:**
- **`the_witness_does_not_descend_a_swapped_directory`** is deterministic: a `before_open` seam swaps
  `xdg/espanso/sub` for a symlink to an outside directory, exactly between the directory's description
  and its open.
  - It asserts that the entry is `unlisted` with an `open:` error.
  - It asserts that no outside or original child is reported.
  - It asserts that a `home` root that is a symlink is `not walked`.
- **`fstatat_agrees_with_std`** checks that the `stat` layout reads the same `dev`, `ino`, `size`,
  `mode`, `mtime` and `ctime` as `std`'s `lstat`, for a file and for a symlink.
- The `readdir` layout is covered by the existing witness test, which requires each created name to
  be listed.
- The new test was not run against the pre-fix code, whose walk had no seam.

**Gates after the fix**, output redirected to files and exit statuses read from the tool:

| Command | Exit | Figure |
|---|---|---|
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | — |
| `cargo test --workspace -- --test-threads=1` | 0 | **1330 passed** (1323 baseline + 7 instrument tests) |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

The safety `rg` still finds only the `//!` comment at `probe.rs:93`, and nothing once comment lines
are filtered. The instrument's Rust share is now 7.
