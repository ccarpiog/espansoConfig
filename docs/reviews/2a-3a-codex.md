1. **should-fix — Q1, source/destination offsets.** The metadata-only `fcopyfile` call is appropriate. Because `COPYFILE_DATA` is absent, the source’s EOF offset is not used for copying the main data fork, and the destination’s main-data offset should remain suitable for the subsequent `write_all`—normally offset 0 from creation. Resource-fork copying is handled separately from the main file descriptor offset. For defensive clarity, explicitly seek the destination to offset 0 before `write_all`; this also protects against future flag changes. I am slightly **unsure** whether every supported macOS release promises that metadata-only `fcopyfile` leaves both observable offsets unchanged, so relying on an explicit seek is preferable.

2. **nit — Q1, truncation and data writes.** Without `COPYFILE_DATA`, `fcopyfile` does not truncate or copy the destination’s main data fork. However, saying it performs no “data” writes at all would be misleading: `COPYFILE_XATTR` can copy the contents of a resource fork and writes extended-attribute storage. Document this as “does not copy or truncate the main data fork.”

3. **nit — Q1, descriptor access modes.** The access modes are correct:

   - The source must be readable; read-only is sufficient.
   - The destination must be writable; write-only is sufficient for installing ACLs and extended attributes.
   - Neither operation inherently requires reading the destination’s main data fork.
   - `O_NONBLOCK` has no meaningful effect on an already-open regular file here.

   Failures caused by authorization, unsupported attributes, or filesystem limitations are correctly surfaced through `errno`.

4. **nit — Q1, resource forks and quarantine.** On modern macOS filesystems, resource forks are exposed through `com.apple.ResourceFork` and are handled by `COPYFILE_XATTR`. It is reasonable to document that resource forks are preserved, but qualify it as filesystem-dependent rather than promising that every destination filesystem supports them. Preserving `com.apple.quarantine` is appropriate when replacing the contents of the same logical file: removing it merely because a new inode is installed would be an accidental metadata/security change.

5. **should-fix — Q2, temporary-file exposure window.** `0o600 → copied ACL → target mode → write bytes` does not make the temp inode more permissive than the intended final target metadata: it receives the target ACL and target mode. It does, however, make the named temporary file accessible to legitimate target readers while its new contents are being written. In a searchable/listable directory, they could observe empty, partial, or unvalidated contents. Prefer:

   1. Create and write while `0o600`.
   2. Flush/sync the data.
   3. Copy xattrs and ACL.
   4. Apply final mode.
   5. `sync_all` again to persist metadata.
   6. Recheck and rename.

   This shortens the exposure window substantially. It does not solve hostile-directory pathname replacement by itself.

6. **nit — Q2, `chmod` after ACL copying.** Ordinary `chmod`/`set_permissions` on macOS does not clear the extended NFSv4-style ACL; removing it requires an ACL-specific operation such as `chmod -N`. Therefore the presented ordering does not silently discard the copied ACL. `chmod` updates the traditional mode bits, which coexist with the extended ACL. The behavior should not be generalized to POSIX ACL implementations on other operating systems, but this function is macOS-only.

7. **should-fix — Q2/Q3, a copied ACL can defeat cleanup.** An ACL installed after the temp file was opened normally cannot revoke access already granted to that open descriptor, so it should not make the later `write_all` or `fsync` fail merely by denying write access. Rename and unlink are different: macOS evaluates deletion/rename authorization using directory `delete_child` rights and the file’s `delete` rights. A denying ACL copied onto the temp inode can cause `rename` or the guard’s `remove_file` to fail.

   Such a rename failure is safe for the original target, but cleanup is not guaranteed. The guard may silently leave a fully populated temp file with target-like permissions. The concrete fix is to make cleanup able to neutralize the copied ACL before unlinking—preferably while retaining the open descriptor—or stage the file in a private `0700` directory and report cleanup failure. At minimum, remove the claim that every failure deletes the temp file.

8. **BLOCKING — Q3, “nothing was written” is too strong.** Before rename, the target pathname and target inode are untouched, so `after_rename() == false` is correct. But `may_have_written() == false` is only correct if that method explicitly means “the requested target may have been replaced.” Metadata and possibly full contents have been written to a temp inode, and that inode can remain because cleanup errors are swallowed. Rename the semantic to something like `may_have_replaced_target`, or return/report cleanup failure and guarantee private staging. Do not externally promise “nothing was written” under the present implementation.

9. **should-fix — Q3/Q5, `fcopyfile` is not transactional.** On failure, `fcopyfile` may already have copied some xattrs or ACL state; it does not roll the destination back. That is harmless to the original target but aggravates the cleanup issue because a partially installed denying ACL may prevent deletion. A zero return is the API’s success indication for the requested operations; it should not be described as a verified byte-for-byte inventory match of all source xattrs. Some filesystem-managed or unsupported attributes may have special behavior. I am **unsure** whether current macOS silently filters any particular ACL entry while returning success, so documentation should claim use of the OS copying facility, not independently verified equivalence.

10. **nit — Q4, unsafe call.** The Rust safety preconditions are met:

    - Both `File` objects remain alive for the synchronous call.
    - The descriptors have suitable access modes.
    - A null state is documented.
    - The flag combination is valid.
    - Failure is obtained through `errno`.

    `AsRawFd` is conventional and correct for a C API accepting integer descriptors. `AsFd` would express the borrow more strongly in Rust but ultimately still requires `as_raw_fd()` for this libc call and provides no substantive additional lifetime protection here. There is no UB unless unrelated unsafe code concurrently closes or replaces a raw descriptor.

    The comment should say “file objects referenced by the descriptors,” not “files named”; descriptors do not name paths. It should also avoid implying that xattr/resource-fork operations only modify the main data stream.

11. **should-fix — Q5, the security improvement is real but incomplete.** Successful copying closes the direct “rename installs a new inode and drops the old denying ACL” broadening. It remains incomplete because metadata changes are not part of the final recheck. Another process can change the target ACL, xattrs, mode, or flags after `copy_metadata` but before rename; the byte hash and `(dev, ino)` can still match, and the newer protection is then lost. If external writers are in scope, capture and compare relevant metadata immediately before rename, or serialize with an interprocess lock. The in-process per-path lock alone cannot close this race.

12. **BLOCKING when the directory is attacker-writable — Q2/Q7, pathname race on the temp file.** `fs::set_permissions(guard.path(), ...)` acts on a pathname even though the trusted temp inode is already open. A process able to modify the directory can replace that entry between creation, permission setting, writing, and rename. The code could chmod one inode, continue writing another through the descriptor, and eventually rename an attacker-supplied entry over the target. Use `handle.set_permissions(...)`/`fchmod` for the open inode, keep the descriptor open through rename, and verify immediately before rename that the pathname still resolves to the descriptor’s `(dev, ino)`. A directory not writable by untrusted principals must be an explicit precondition because pathname verification alone still has a final race.

13. **nit — Q6, flag selection.** Excluding `COPYFILE_STAT` is correct. It would restore timestamps and BSD flags, including immutable flags that can obstruct rename and cleanup. Consequently:

    - `COPYFILE_SECURITY` is worse because it includes `COPYFILE_STAT | COPYFILE_ACL`.
    - `COPYFILE_METADATA` is worse because it includes stat information along with ACLs and xattrs.
    - `COPYFILE_NOFOLLOW*` flags are irrelevant to `fcopyfile`, which receives already-open descriptors; the source was also safely opened with `O_NOFOLLOW`.
    - The explicit `COPYFILE_ACL | COPYFILE_XATTR` combination is the right narrowly scoped choice.

14. **nit — Q7, durability and minor details.** If metadata copying is moved after the initial data sync, perform another `sync_all` after the ACL, xattr, and mode changes. `File::flush()` itself adds little because `File` is not userspace-buffered, but it is harmless. Excluding `COPYFILE_STAT` also means ownership is not copied; that is normally desirable because changing ownership may be unauthorized and could alter access semantics, but the behavior should be documented as preserving ACLs, xattrs, and mode—not all security metadata.

**Verdict: No—`fcopyfile` itself is suitable, but the guaranteed-cleanup/“nothing written” claim and the named-temp pathname race should be fixed before committing as safe.**

Codex session ID: 019fbd77-5d08-7090-a648-1227ee7861a9
Resume in Codex: codex resume 019fbd77-5d08-7090-a648-1227ee7861a9
