# Phase 2d-1 — the core observation engine: code review

Captured verbatim by the orchestrator; the review ran in a read-only sandbox and could not
write this file itself.

## Round 1

NOT READY

The workspace is read-only, so this review could not be written to `docs/reviews/phase-2d-1-engine.md`.

### High

- `crates/espansoconfig-core/src/watch/engine.rs:397` — `ObservationEngine::start` installs each baseline after one read, contrary to Q7 item 1’s consecutive-read stability requirement. A truncate/write race can therefore seed `tracked` and `snapshot_of` with partial bytes that never stably existed; if the native watcher is not yet active or misses the race, the false baseline persists and later correspondence evidence is built from it. The record acknowledges the torn-read window at `docs/decisions/2d-1-notes.md:321` but nevertheless calls the handoff snapshot “stabilized” at line 212 without authorization from the consult.

- `crates/espansoconfig-core/src/watch/engine.rs:581` — hint admission checks only lexical root membership and filename extension, while `FsWatchSource::read` at line 185 follows symlinks and discovery accepts only regular files at `src/discovery.rs:360`. A `.yml` symlink inside `match/` can therefore read and emit content from outside both watched roots, and a directory named `*.yml` becomes an `Unreadable` observation instead of being excluded. This directly falsifies the record’s claims that hint filtering cannot disagree with discovery (`docs/decisions/2d-1-notes.md:140`) and that directory-shaped hints are dropped (`docs/decisions/2d-1-notes.md:303`).

### Medium

- `crates/espansoconfig-core/src/watch/engine.rs:592` — projection reaches the process-wide mutable identity registry through `identity_of`, so the engine is not wholly deterministic from its injected clock, hints, and reader. Prior or concurrent identity allocation at `src/workspace/mod.rs:224` changes the `DocumentId` and `MatchId` values in otherwise identical observation and correspondence outputs, making the record’s “one input schedule produces one output sequence” guarantee at `docs/decisions/2d-1-notes.md:77` incomplete.

- `crates/espansoconfig-core/src/watch/mod.rs:55` — `self_write_suppresses` compares two bare revisions and cannot enforce that `last_committed` belongs to the observed document, current workspace epoch, or latest committed save. Passing an entry from another document or replaced workspace with the same hash returns `true` and suppresses the observation; the helper itself is permitted in 2d-1, but the record at `docs/decisions/2d-1-notes.md:61` must state in the same guarantee sentence that correct document/epoch/latest-entry selection remains a caller obligation.

### Low

- `crates/espansoconfig-core/tests/watch_engine.rs:87` — the new test file contains 25 functions longer than ten lines without the required closing-bracket comments; the new test at `src/watch/mod.rs:207` has the same violation. This fails the binding `CLAUDE.md` convention despite formatting and lint gates remaining green.

### Checks found sound

- The four observation variants, validated 150–300 ms trailing-edge debounce, two-read pending-path stability, exact byte hashing, projection/validation, rescan pipeline, and snapshot revision binding are otherwise implemented coherently.
- No consuming-operation result is discarded in the production observation path, and correspondence operands are derived against one fresh snapshot.
- `notify` imports are currently confined to `watch/native.rs`; no Tauri, command, Svelte, i18n, save, ledger, sequence, or epoch implementation entered this step.
- The synthetic corpus tests read without writing or logging fixture text. The optional real-corpus test skips when absent and prints only names, counts, and revisions; no real-corpus path appears in status.
- Public documentation is substantive and English, and the independently supplied cargo, clippy, formatting, and Tauri-dependency gates are consistent with the inspected tree.

Codex session ID: 01a03508-4d55-72d3-967e-31aef7a3b5c4

## Round 2

NOT READY

### High

- `crates/espansoconfig-core/src/watch/engine.rs:208-225,602-607`, `crates/espansoconfig-core/src/discovery.rs:360-370`, `docs/decisions/2d-1-notes.md:170-173` — H2 remains open because replacing an ancestor of a tracked file with a symlink makes `rescan` re-hint that tracked path, after which the final-component-only metadata check follows the intermediate symlink and can emit outside content that discovery’s walk excludes.

### Medium

- `crates/espansoconfig-core/src/watch/engine.rs:481-495,515-525`, `crates/espansoconfig-core/src/watch/native.rs:15-20`, `docs/decisions/2d-1-notes.md:368-375` — H1’s residual-window record incorrectly says the racing writer’s hint corrects an equal torn baseline even though native delivery is expressly not guaranteed, so that baseline can persist until some later hint or rescan actually occurs.

- `crates/espansoconfig-core/src/lib.rs:127-135`, `Cargo.toml:30-35`, `crates/espansoconfig-core/Cargo.toml:29-34`, `crates/espansoconfig-core/src/workspace/mod.rs:218-231,247-257` — M1 remains open because multiple crate and dependency docs still call the whole engine deterministic without the process-wide identity-registry qualification.

- `crates/espansoconfig-core/src/watch/mod.rs:53-70,86-91` — M2 remains open because `ContentRevision` still describes self-write suppression as answering “did we just write this?”, restating the authorship claim that the corrected predicate documentation explicitly disallows.

### Low

- `crates/espansoconfig-core/tests/watch_engine.rs:887-897`, `CLAUDE.md:102-103` — L1 remains open because the eleven-line loop over correspondence entries has no closing-bracket comment.

### Claimed-closure confirmation

- H1: The original one-read installation is fixed—`start` compares two reads before either present or failed state enters `tracked`, and disagreement enters `Pending::Probing`—but its residual persistence is recorded inaccurately (`crates/espansoconfig-core/src/watch/engine.rs:464-495`; `docs/decisions/2d-1-notes.md:368-375`).
- H2: Direct final-component symlinks and YAML-shaped directories are pinned correctly, but the production rescan route through a newly symlinked ancestor leaves the finding’s narrower shape standing (`crates/espansoconfig-core/src/watch/engine.rs:821-888,597-607`).
- M1: The edited engine module and `tick` documentation now qualify identity values correctly, but the unqualified crate and Cargo documentation above prevents full closure (`crates/espansoconfig-core/src/watch/engine.rs:23-32,527-536`; `crates/espansoconfig-core/src/lib.rs:127-135`).
- M2: The function documentation and record now state the document/epoch/latest-entry caller obligation, but the authorship gloss at the third site prevents closure (`crates/espansoconfig-core/src/watch/mod.rs:55-78,86-91`; `docs/decisions/2d-1-notes.md:63-73`).
- L1: The new pinning functions have closing comments, but the longer correspondence loop does not (`crates/espansoconfig-core/tests/watch_engine.rs:887-897`; `crates/espansoconfig-core/src/watch/engine.rs:821-888`).

Section 6 is therefore a false complete-closure record where it says every finding was closed (`docs/decisions/2d-1-notes.md:387-420`).

No scope-expansion finding: the engine still expressly excludes the ledger, epochs, sequences, and command caller, while the watch module declares no caller in this step (`crates/espansoconfig-core/src/watch/engine.rs:8-14`; `crates/espansoconfig-core/src/watch/mod.rs:21-27`).

Codex session ID: 01a0352e-e026-7883-b2b8-274180835e5e

## Round 3

**NOT READY**

### High

None.

### Medium

- `crates/espansoconfig-core/src/watch/engine.rs:1`, `docs/decisions/2d-1-notes.md:487-492` — the module headline still calls this “The deterministic observation engine” without the identity-registry qualification, so M1’s shape survives and §7’s complete-closure record is false.

### Low

None.

### Closure confirmation

1. **High — closed:** Combined lexical admission and `FsWatchSource::read` match discovery’s extension, component, directory, and regular-file rules on baseline, hint, and rescan routes; the injected-source contract states both its obligation and Rust’s inability to enforce it, and the pinning test would fail with only the final-component check. Retaining tracked paths during rescan is necessary for vanished subtrees to stabilize as `Removed`.
2. **Medium H1 residual — closed:** `start` and notes §5 item 9 truthfully allow an equal torn baseline to persist until a later hint or rescan actually occurs.
3. **Medium M1 determinism — still open:** all named second-round sites are qualified, but the broader conceptual sweep found the unqualified module headline above.
4. **Medium M2 authorship — closed:** `ContentRevision` now describes byte identity to the latest recorded committed revision, and notes §2.1 corrects the quoted plan wording in the same paragraph.
5. **Low — closed:** the correspondence loop has its closing comment, and the second fix’s newly added or enlarged functions and loops satisfy the over-ten-line convention.

The sweep covered every `WatchSource::read` call and implementation, discovery’s literal walk acceptance, determinism and authorship claims, long functions and loops in the touched files, §6/§7 history, and the scope guard. §6 preserves the original closure record with an explicit correction block; no Tauri implementation, commands, Svelte, i18n, saves, ledger, epochs, or sequences entered the step.

The workspace is read-only, so this section was not appended.

Codex session ID: 01a03547-3325-7e11-a645-550e9d50d113

## Round 4

**NOT READY**

### Medium

- `docs/decisions/2d-1-notes.md:79`, `docs/reviews/phase-2d-design.md:9` — M1's
  name-position shape still survives at two standalone sites. The notes' D2 heading claims
  "determinism by injection" even though the identity table is deliberately not injected, and
  the design consult's Q1 ruling names this same debounce/stability/read/hash/project/validate
  pipeline "the deterministic reconciliation engine" without the identity-value qualification.
  The qualifying prose below each title does not qualify the independently read heading/ruling,
  for the same reason prose below `engine.rs`'s former headline did not qualify that headline.
  Consequently §7's correction block preserves the earlier history honestly but remains an
  incomplete correction of its `rg -i determinis` claim (`docs/decisions/2d-1-notes.md:489-495`),
  and §8's complete-closure account is not true of the current documentation set
  (`docs/decisions/2d-1-notes.md:510-527`).

The repaired `engine.rs` headline is honest: rustdoc's first-sentence summary ends only after
"process-wide session identity table.", so it includes both the shape qualification and the
identity-value exception. The round-3 correction block is additive rather than a rewrite, and §8
accurately reports what rounds 1–3 recorded; only its claim of closure is contradicted by the two
name-position sites above.

Codex session ID: 01a03551-3cc2-7213-a29b-5e4a5282539e

## Round 5

**READY**

Findings: none.

1. **Both round-4 closures confirmed:** the D2 heading is true and complete when read alone—its
   guarantee is determinism in observation shape from the injected clock/reader schedule, including
   one read per path per tick, and it names the process-wide session table as the source of identity
   values (`docs/decisions/2d-1-notes.md:79`; `crates/espansoconfig-core/src/watch/engine.rs:580-632`;
   `crates/espansoconfig-core/src/workspace/mod.rs:218-267`). The consult's Q1 ruling remains as
   written, and the immediately following correction gives that same shape/identity qualification
   (`docs/reviews/phase-2d-design.md:9-15`).
2. **History and §9 confirmed:** §8 keeps its original round-3 account and adds an adjacent
   correction that says only its closure claim was false; §9 accurately records round 4's sole
   Medium, both fixes, the post-fix name-position sweep, and unchanged re-measured gates
   (`docs/decisions/2d-1-notes.md:510-551`; `docs/reviews/phase-2d-1-engine.md:104-125`). The code and
   documents support that account, and an independent re-run completed at 1198 passed / 0 failed,
   clippy with `-D warnings` clean, and `cargo fmt --check` clean.
3. **Final name-position sweep confirmed:** a whole-tree `rg -i determinis` review covered markdown
   headings and bold lines, Rust module/struct/test first sentences, and both Cargo dependency
   comments. The anchored `^#`/`^**` pattern structurally misses
   `crates/espansoconfig-core/tests/watch_engine.rs:1`, but its statement that the engine is *driven*
   deterministically describes the injected test schedule, not deterministic identity values; it is
   true as written. All M1-shaped engine claims are qualified in place or preserved historical
   quotations with adjacent corrections; the other hits concern separate subsystems.

Codex session ID: 01a03556-359a-7d93-b8dd-90eb7b576d54
