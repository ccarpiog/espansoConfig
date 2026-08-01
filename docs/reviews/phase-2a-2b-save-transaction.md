1. **Blocking** — [write.rs:102](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/write.rs:102>), [write.rs:570](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/write.rs:570>), [IMPLEMENTATION_PLAN.md:617](</Users/ccarpio/Developer/espansoConfig/IMPLEMENTATION_PLAN.md:617>)

   Hazard 11 is not implemented as registered. The replacement copies only Unix mode bits; the new inode loses ownership/group, ACLs, extended attributes, flags, resource forks, creation time, and hard-link relationships. The implementation documents this limitation but still commits through it.

   Concrete failure: saving a `0644` config protected by a denying ACL produces byte-correct YAML with the same mode but without that ACL, making the config readable to accounts previously denied. Saving a hard-linked config also silently separates it from its other name. This is configuration/security metadata corruption on every real commit, with no Phase-2a backup yet.

2. **Should-fix** — [save.rs:658](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/save.rs:658>), [save.rs:295](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/save.rs:295>), [2a-2b-notes.md:136](</Users/ccarpio/Developer/espansoConfig/docs/decisions/2a-2b-notes.md:136>)

   The byte-identical fast path skips not only the write, but also every final path/identity/content recheck. Its returned `revision` and `text` therefore are not necessarily facts about the file at return time, despite `SavedDocument` saying the file “provably holds” them.

   Concrete failure: an empty-batch save reads revision A, then vim atomically replaces the file with revision B while projection/validation runs. The transaction returns `Ok { committed: false, revision: A, text: A }`. A caller following step 12 resets its snapshot to stale bytes and may report a successful save for a document that no longer exists on disk. The existing unchanged-candidate tests perform no concurrent replacement and cannot detect this.

3. **Should-fix** — [save.rs:146](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/save.rs:146>), [validate/mod.rs:640](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:640>), [validate/mod.rs:655](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:655>)

   `Acknowledgement::covers()` uses set-style `contains`, but `validate()` can produce equal duplicate findings: unresolved references are reported per occurrence while each finding records the entire scalar span, node, and path rather than the occurrence’s subspan. Multiplicity is therefore lost.

   Concrete failure: first submit a scalar of fixed length containing one `{{x}}` and acknowledge its refusal. Then submit another same-length value in that scalar containing two `{{x}}` occurrences. Both new findings can have the same code, operand, scalar span, node, and path as the single acknowledged finding, so one acknowledgement covers both. The user is not shown the added occurrence. Matching must either preserve occurrence spans or compare acknowledged and candidate findings as multisets.

4. **Should-fix** — [2a-2b-notes.md:98](</Users/ccarpio/Developer/espansoConfig/docs/decisions/2a-2b-notes.md:98>), [validate/mod.rs:321](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:321>), [save.rs:126](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/save.rs:126>)

   Content matching does not establish that anybody saw a finding. `Finding` is publicly constructible and `validate()` is public, so a caller can compute or manufacture the candidate’s findings and call `Acknowledgement::of()` on them without first receiving or displaying a refusal. The notes’ claim that blanket acceptance “cannot be written” is false.

   Concrete failure: a frontend validates its pending candidate locally, wraps every returned suspicion in an acknowledgement, and submits only once. The transaction proceeds past every warning although no refusal or user confirmation occurred. Exact matching protects against changed findings, subject to finding 3, but is not proof of presentation or consent.

5. **Should-fix** — [validate/mod.rs:273](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:273>), [validate/mod.rs:281](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:281>), [2a-2b-notes.md:344](</Users/ccarpio/Developer/espansoConfig/docs/decisions/2a-2b-notes.md:344>)

   `DuplicateVariableName` is classified as an unoverrideable `EditorModelError`, although the supplied notes state that espanso uses last-wins behavior and such configurations load and run. This contradicts the classifier’s stated boundary and leaves no usable escape hatch.

   Concrete failure: open an existing file containing duplicate variable names and change an unrelated replacement string. The duplicate remains, so the entire save is refused. The visual editor cannot preserve the working file and the planned raw editor does not exist.

6. **Should-fix** — [validate/mod.rs:63](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:63>), [validate/mod.rs:282](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/validate/mod.rs:282>), [2a-2b-notes.md:349](</Users/ccarpio/Developer/espansoConfig/docs/decisions/2a-2b-notes.md:349>)

   `RegexDoesNotCompile` is also unoverrideable even though it tests a different regex implementation/version from espanso’s. The code itself says the result is evidence in only one direction, which is insufficient support for an `EditorModelError` with no escape hatch.

   Concrete failure: if an existing expression is accepted by espanso’s pinned engine but rejected by this crate’s engine, changing any unrelated field is permanently refused. The notes correctly identify the risk but overstate that it can happen “today”: no concrete divergent pattern or parity experiment is supplied in the reviewed material.

7. **Should-fix** — [save.rs:565](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/save.rs:565>), [save.rs:687](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/save.rs:687>), [persist_save.rs:332](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/tests/persist_save.rs:332>), [edit.rs:4693](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/patch/edit.rs:4693>)

   `apply_edits()` genuinely reparses the entire candidate, so the step-4 implementation claim is accurate. However, `findings_of()` is operationally a second syntax gate: its parse failure aborts the transaction, and it falsely wraps that failure as `EditError::Verification` even though `apply_edits()` already returned a verified `PatchedDocument`.

   Concrete failure: regress or disable the parse at `verify()`. The public save acceptance test remains green because the projection parse refuses instead, and the returned error falsely attributes that refusal to patch verification. The recorded disabling experiment confirms this masking. A distinct projection-parse error, or carrying the verified index forward, is needed to preserve provenance and independently test step 4.

8. **Should-fix** — [save.rs:617](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/save.rs:617>), [save.rs:625](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/save.rs:625>), [write.rs:506](</Users/ccarpio/Developer/espansoConfig/crates/espansoconfig-core/src/persist/write.rs:506>)

   The transaction’s initial read bypasses `inspect_target()` and therefore performs neither its regular-file check nor `O_NOFOLLOW` open. This creates a lock-held blocking path before the primitive can refuse the target.

   Concrete failure: a caller supplies a context naming a FIFO, or another process replaces the resolved file with a FIFO after `lock_path()` resolves it. `std::fs::read()` opens the FIFO and waits for a writer while retaining the non-reentrant path lock; every later save of that resolved path then waits indefinitely. Early UTF-8 and other error returns are otherwise RAII-safe and do not re-enter `lock_path()`.

Codex session ID: 019fbcd6-dd08-7b03-8bc4-269d340b0f67
Resume in Codex: codex resume 019fbcd6-dd08-7b03-8bc4-269d340b0f67
