1. **Rotation can follow a replaced or symlinked backup root and recursively delete outside it — critical**  
   `crates/espansoconfig-core/src/persist/backup.rs:397-400, 660-669, 812-850`  
   `create_backup_root` treats any `AlreadyExists` as success, including a symlink. `rotate` checks only that the lexical final component is `.espansoconfig-backups`; `read_dir` then follows a root symlink. There is also a TOCTOU gap between listing/type-checking an entry and `remove_dir_all(path)`: replacing the backup-root path redirects resolution of every stored child path. The batch-entry symlink test does not cover either case. This can delete timestamp-shaped directories in an unrelated tree.  
   Suggested fix: open the configuration root and backup root as verified directory descriptors using no-follow semantics; verify type, owner, permissions, and inode identity; enumerate and delete relative to those descriptors (`openat`/`unlinkat`-style operations). Revalidate the root and each candidate immediately before deletion. Refuse rotation if descriptor-anchored deletion is unavailable.

2. **Timestamp-shaped names are not proof that this application created a directory — high**  
   `crates/espansoconfig-core/src/persist/backup.rs:608-649, 821-850`  
   Any real directory with a syntactically matching name is treated as owned and eventually deleted. The parser does not even validate calendar ranges, so names such as `9999-99-99T999999Z` qualify. This directly contradicts the test assertion that rotation “may only ever remove directories it minted itself” (`tests/persist_backup.rs:631-635`). A user or another program can innocently create such a directory; a principal able to write the root can plant one deliberately.  
   Suggested fix: give each batch an unambiguous ownership marker created atomically with it, including a format/version identifier, and rotate only verified batches. Combine this with a private, owner-verified, non-symlink root; a marker alone is forgeable in an attacker-writable directory.

3. **A failed backup can first delete an older valid backup — high**  
   `crates/espansoconfig-core/src/persist/backup.rs:473-495`  
   Rotation runs immediately after creating the empty batch, before `write_backup`. If writing, copying xattrs, applying mode bits, or fsync then fails, the save does not commit—but an older batch may already have been permanently removed. The new empty or partial batch remains. The design record’s statement that a failed backup costs “the attempt, and nothing else” is therefore false (`docs/decisions/2a-3b-notes.md:339-352`). Rotation results are also lost because no `SavedDocument` is returned.  
   Suggested fix: finish and verify the backup first, then rotate. Prefer publishing the batch atomically only once it contains a complete copy. Rotation should never consume retention for an unsuccessful backup attempt.

4. **The backup precedes a later refusal, violating the explicit no-backup-on-refusal constraint — high**  
   `crates/espansoconfig-core/src/persist/save.rs:856-876`  
   The semantic verdict is passed first, but `replace_locked_file` performs the pre-commit target/temp identity checks after the backup. If either check refuses the commit, a backup has already been taken and the session marks the file captured. A retry can consequently commit over a newer target without backing up the version actually replaced. The design record admits this at §9 hole 2 rather than resolving it (`docs/decisions/2a-3b-notes.md:424-432`), but it violates constraint 2.  
   Suggested fix: refactor the locked writer into a preparation phase that completes every refusal-producing check, followed by backup publication and a commit phase that cannot return a refusal. Alternatively stage the backup privately and publish/record it only after a successful commit.

5. **The public constructor permits backups inside espanso’s auto-loaded tree — high**  
   `crates/espansoconfig-core/src/persist/backup.rs:383-405`  
   Nothing proves that `config_root` is the actual espanso root. For example, `BackupSession::rooted_at(actual_root.join("match"))` writes beneath `match/.espansoconfig-backups/.../*.yml`. Under the glob semantics stated by this change, the dotted ancestor does not prevent matching, so those files may be auto-loaded. Supporting arbitrary outside targets makes a mistaken session root especially easy to conceal under `_outside`.  
   Suggested fix: construct `BackupSession` from an already-validated configuration-root type, or validate its relationship to the document context before capture. At minimum, reject roots whose resolved location is within `match` or `config` beneath the applicable espanso root.

6. **Path derivation has real cross-filesystem and namespace collisions — medium**  
   `crates/espansoconfig-core/src/persist/backup.rs:488-489, 516-549`  
   An in-root target `<config-root>/_outside/foo` and an outside target `/foo` both map to `_outside/foo`. Separately, two external files on a case-sensitive or normalization-sensitive source volume can map to one path when the backup volume is case-insensitive or normalization-insensitive. `create_new` prevents silent overwrite, but the second legitimate save fails and the session cannot back it up. This is a path-identity failure, not merely cosmetic naming.  
   Suggested fix: place in-root and external paths in disjoint namespaces and include an ASCII, collision-resistant encoding or digest of the canonical source-path bytes. Preserve the readable path only as supplementary presentation.

7. **A partial backup permanently poisons retries in the same session — medium**  
   `crates/espansoconfig-core/src/persist/backup.rs:477-490, 719-778`  
   Once the destination is created, any later failure leaves it in place. The target is not added to `captured`, so a retry addresses the same path and fails at `create_new` with `AlreadyExists` forever. The design record mentions an undetected partial and says “the next session writes its own,” but omits that the current session becomes unusable for that file (`docs/decisions/2a-3b-notes.md:453-464`).  
   Suggested fix: write to a unique temporary name, fsync it, verify its identity, and rename it into place. On failure, remove the verified temporary inode best-effort and separately surface cleanup failure.

8. **Rotation failures are frequently swallowed rather than counted — medium**  
   `crates/espansoconfig-core/src/persist/backup.rs:812-839`  
   An unreadable/missing root returns an all-zero `Rotation`, and `entries.flatten()` silently discards per-entry iteration errors. Only `remove_dir_all` failures increment `failed`. Thus the documented policy that failures are exposed through `SavedDocument::backup.rotation` is incomplete and the tree can grow without any nonzero diagnostic. Finding 3 adds another path where counts are computed but discarded.  
   Suggested fix: distinguish “not attempted,” scan failure, metadata failure, and deletion failure. Preserve the result in session state or return it through an error-side report when the subsequent backup operation fails.

9. **The ACL confidentiality argument assumes directory protection that the code never verifies — medium**  
   `crates/espansoconfig-core/src/persist/backup.rs:69-78, 655-669, 725-741`; `crates/espansoconfig-core/src/persist/write.rs:831-852`  
   Mode `0700` is requested only when creating directories. Existing roots are accepted without checking mode, owner, ACL, or symlink status, and recursively created directories can inherit filesystem ACLs. Consequently the “nobody but the owner can traverse” premise is not established.  
   Platform claim: on macOS, an inheritable granting ACL on the containing tree can make newly created `0700` directories traversable to another principal; if the source has an explicit deny-read ACL for that principal and mode `0644`, dropping the file ACL can make the backup readable where the original was not. `COPYFILE_XATTR` does not compensate for the deliberately omitted `COPYFILE_ACL`; it may carry unrelated metadata such as Finder, quarantine, provenance, or resource-fork attributes, none of which is a general access-control replacement.  
   Suggested fix: verify and enforce ownership and access policy on every existing backup-tree directory, reject inherited/granting ACLs where confidentiality depends on mode bits, and document which xattr namespaces are intentionally retained.

10. **Clock ordering can select the newly created batch for deletion, invalidating the retention invariant — medium**  
    `crates/espansoconfig-core/src/persist/backup.rs:473-489, 563-575, 842-850`  
    “Newly created” does not imply “newest by name.” A backward wall-clock adjustment, or ten existing future-dated timestamp-shaped directories, makes the current empty batch the oldest candidate. Rotation deletes it; `write_backup` then recreates the path recursively, leaving eleven batches and a misleading `removed == 1`. Concurrent sessions make the path-identity window larger because session mutexes do not coordinate with each other.  
    Suggested fix: pass the newly created batch’s verified identity to rotation and exclude it categorically. Serialize rotation across sessions with a root-scoped lock, and do not derive ownership or protection from wall-clock ordering.

11. **Several new comments and tests make stronger promises than the transaction supports — low**  
    `crates/espansoconfig-core/src/persist/save.rs:534-543`; `crates/espansoconfig-core/tests/persist_backup.rs:288-314, 860-890`; `docs/decisions/2a-3b-notes.md:317-335`  
    Phrases such as “the target keeps its bytes,” “a refusal creates nothing on disk,” and “can never remove a copy” are prophecies in the presence of external writers and are false in the failure and clock cases above. This conflicts with constraint 7’s risk-not-prophecy rule.  
    Suggested fix: scope statements to this call—for example, “this call has not renamed the target; callers must re-read it”—and describe rotation as an attempted retention policy, not a guarantee.

The placement after the semantic verdict and `committed` calculation, use of the existing path lock, use of the initially inspected bytes, omission of `COPYFILE_STAT`, and avoidance of `replace_file_atomically` inside the transaction are otherwise sound. I found no new `Serialize` derive or Tauri dependency in the reviewed change.

Section 9 is not complete: it omits the symlinked-root and root-replacement deletion hazards, timestamp-shaped foreign directories, wrong-root auto-loading, destructive rotation before backup success, same-session partial-file poisoning, path collisions under destination filesystem semantics, and clock/concurrent-session invalidation.

**Verdict: not safe to commit as-is.** The descriptor-anchored rotation/root validation and the ordering issues require redesign before this destructive operation is safe.

Codex session ID: 019fbdda-8e19-75c1-b82e-f952e14450d3
Resume in Codex: codex resume 019fbdda-8e19-75c1-b82e-f952e14450d3
