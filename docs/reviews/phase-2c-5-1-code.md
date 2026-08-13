VERDICT: NOT READY

# Aggregate code review — Phase 2c-5 step 1

The catalogue is read-only, keeps its new types out of the wire layer, shares the batch ordering with rotation, preserves exact bytes, and has useful static-path tests. It is not ready because the pathname checks and the later opens/listings are separate operations. A writable backup tree can therefore be changed between check and use so that the catalogue follows a symlink. The strict path validator also accepts an interior `.` although Q2 requires rejection. The prose audit found several narrower guarantee claims that remain false even apart from those behavioural defects.

## Defects in behaviour

### High — `crates/espansoconfig-core/src/persist/backup.rs:2787` — a checked entry can be replaced by a symlink before it is opened

`read_entry` first calls `observe_entry`, then opens the assembled pathname with `File::open`. `File::open` follows a symlink. The descriptor check at line 2800 proves only that the object ultimately opened is a regular file; it does not prove that the leaf or any parent component was not a symlink during the open. A process able to write the backup root can replace the checked leaf or a checked ancestor after `symlink_metadata` and before `File::open`, causing bytes outside the batch to be returned as `BackupBytes`. This is a confirmed reachable TOCTOU defect, not merely a hypothetical API concern.

The same check/use split occurs at the other read boundaries: `scan_batches` checks the root and then calls `read_dir` by name at `crates/espansoconfig-core/src/persist/backup.rs:2660`; `scan_entries` revalidates the batch and then calls `read_dir` by name at line 2718; recursive walking checks a directory and then calls `read_dir` by name at line 3015; and `carries_batch_marker` checks the marker with `symlink_metadata` and then reads its name at line 1525. Any of those path components can be swapped between the operations. Component-by-component `symlink_metadata` rejects links that are already present, but it does not make the subsequent pathname operation non-following.

It should instead anchor traversal in opened directory descriptors and resolve each child relative to its already-open parent with non-following semantics (for example, `openat`/equivalent with `O_NOFOLLOW`, followed by `fstat`). The marker, recursive directory listings, and entry leaf must all be opened relative to those descriptors. Reading must use the same safely opened leaf descriptor. Adding `O_NOFOLLOW` only to the final entry open would not protect parent components.

### Medium — `crates/espansoconfig-core/src/persist/backup.rs:2905` — `validated_relative_path` normalises an interior `.` instead of rejecting it

`Path::components()` removes interior `.` components before this loop sees them. Consequently `match/./base.yml` is accepted as `match/base.yml`, and the test at `crates/espansoconfig-core/src/persist/backup.rs:4543` explicitly requires that incorrect behaviour. Empty components from repeated separators are likewise normalised away. Q2 and rule 4 require `.` and every non-normal component to be rejected, not silently normalised.

It should validate the original spelling without losing components first, reject any `.` or empty component, and only then construct the stored `PathBuf`. The test should assert that `BackupEntryId::in_batch(..., Path::new("match/./base.yml"))` is `None` (and should cover repeated separators if those count as non-normal under the chosen grammar).

## Claims in prose

### High — `crates/espansoconfig-core/src/persist/backup.rs:154` — the module header says no symlink is followed at any depth

The third of the new header's four rules says “no symlink is followed at any depth.” The same absolute claim appears on `scan_entries` at line 2706 and in `observe_entry` at line 2940. The behaviour finding above shows that a component swapped after its metadata check is followed by the later pathname open or listing. The `read_entry` documentation at lines 2772–2774 does acknowledge that its window is not closed, but that narrower caveat does not repair the absolute header and API claims.

It should either implement descriptor-relative, non-following traversal and retain the guarantee, or narrow every claim consistently to say that links observed by the pathname checks are rejected and that the check/use race remains. Given Q2's mandatory “never follow” rule, the implementation fix is required rather than merely weakening the prose.

### Medium — `crates/espansoconfig-core/src/persist/backup.rs:1149` — `BackupTarget` is described as identifying what a copy is of

The public type says it describes “the file that was copied to” an entry and that scanning runs the mapping backwards “to say what each copy is of” (lines 1149–1155). The private `BackupEntry::target` field repeats “the file it was copied from” at line 2345, and `OutsideConfigRoot` says the copied file was outside the root at lines 1172–1173. None of those historical/source claims follows from an untrusted pathname. In particular, a disambiguated `base.yml-1` produced from `base.yml` is classified literally as in-root `base.yml-1`, and a forged `_outside/...` entry need never have been copied from anywhere.

It should describe only syntactic namespace classification: what live target path would map to the ordinary, undisambiguated entry name, or which namespace the entry name occupies. It must explicitly say that disambiguated and forged names do not identify a source file. The narrower statement on `BackupTarget::InConfigRoot` at line 1163 (“The path maps back…”) is truthful and is the model the surrounding comments should follow.

### Medium — `crates/espansoconfig-core/src/persist/backup.rs:1151` — the claimed reverse mapping is not total

The documentation calls `BackupTarget` “The reverse of `backup_relative_path`” without recording the known configuration-root edge. At lines 1066–1071, a target equal to the configuration root maps to `_outside_`; reversing that path yields `InConfigRoot { relative_path: "_outside" }`, not the empty relative path denoting the root. The write transaction cannot save the configuration-root directory as a regular file, so retaining the existing forward sentinel is reasonable. The public catalogue nevertheless accepts an arbitrary target path, and its unconditional invertibility claim is false.

It should document this explicitly as a deliberately non-round-tripping, unreachable-on-the-write-side sentinel, or make the read API reject that target. Tests should pin the chosen answer rather than leaving it outside the round-trip set.

### Medium — `crates/espansoconfig-core/src/persist/backup.rs:1513` — the marker helper says the marker is one this module wrote

“Whether `batch` carries a marker this module wrote” implies provenance that reading the forgeable marker cannot establish. This contradicts rule 8 and the new module header's correct trust statement at lines 158–163.

It should say “a marker whose contents this module recognises” and avoid “wrote,” “owns,” or equivalent provenance language. The helper's prefix check establishes format recognition only.

### Low — `crates/espansoconfig-core/src/persist/backup.rs:2624` — constructing a catalogue is documented as reading nothing

`BackupCatalog::rooted_at` immediately calls `fs::canonicalize` at line 2629, which consults the filesystem and resolves links. Thus “Nothing is created, and nothing is read” is too broad even though no backup contents are read and no state is mutated.

It should say that construction creates nothing and reads no backup catalogue or backup content, while it may inspect the configuration-root path to canonicalise it.

## Ten-rule assessment

1. **Read-only — satisfied.** The production read side at `crates/espansoconfig-core/src/persist/backup.rs:2606`–3030 calls only canonicalisation, metadata, directory listing, open, and read operations. No new production path calls `rotate`, `create_backup_root`, `remove_dir_all`, `fs::write`, `File::create`, or rename. The apparent writes/removals in the added diff are test setup and mutation. Rotation remains reached from successful write-side capture, not from `BackupCatalog`.

2. **Opaque identities and revalidation — satisfied subject to the TOCTOU failure in rule 3.** `BackupBatchId` stores a private exact name/stamp/counter at lines 2202–2209; `BackupEntryId` stores a private batch and relative path at lines 2296–2300. Public construction can manufacture syntactically valid identities, but cannot place an absolute path in either, and every catalogue operation rechecks them. A missing supplied batch becomes `StaleBatch`; a missing supplied entry becomes `StaleEntry`. `entry_for_target` returning `Ok(None)` for a name with no entry is the intended `Option` answer, not an empty read. The identities are questions rather than authority, which is safe. The rechecks are not atomic with use, which is the separate High defect.

3. **Never follow a symlink at any level — not satisfied.** Static symlinks at the root, batch, intermediate-directory, and leaf levels are rejected using `symlink_metadata`, but later pathname operations can follow replacements. See the High behaviour finding at line 2787 and the related listing/marker sites.

4. **Path containment and offered leaf types — not fully satisfied.** Absolute paths, parent components, the empty path, and the top-level marker are refused; static scanning offers only regular files. However, interior `.` is normalised and admitted at line 2905, contrary to the strict grammar. Containment against `..` is still preserved, but the stated rejection contract is not.

5. **One shared ordering — satisfied.** `compare_batches_newest_first` at `crates/espansoconfig-core/src/persist/backup.rs:1340` is the sole stamp/counter comparison. Catalogue ordering uses it through `BackupBatchId::newest_first` at line 2262; rotation reverses it at line 1862. Algebraically, reversing `right.cmp(left)` restores the prior ascending `(stamp, numeric counter)` order, so the deletion behaviour is preserved. Tests at lines 3994 and 4042 exercise numeric counter order and the exact batch rotation removes. No read-side code parses the stamp as a time.

6. **Missing/refused roots — satisfied for stable filesystem state.** `inspect_root` maps `NotFound` to `BackupRootState::Missing` at line 2832 and rejects non-directories/symlinks and non-private modes at lines 2843–2854. The check/use race remains governed by rule 3.

7. **UTF-8 refusal and offset — satisfied.** `String::from_utf8` is exact and `valid_up_to()` supplies the first invalid-byte offset at `crates/espansoconfig-core/src/persist/backup.rs:2523`–2532. No lossy decode, normalisation, or replacement occurs, and the new API does not label the text as “raw bytes.”

8. **Marker recognition, not authenticity — not fully satisfied in prose.** The core type documentation correctly calls all entries untrusted at lines 2597–2604, and no behavioural decision trusts their contents. The helper documentation at line 1513 nevertheless claims a marker “this module wrote”; see the Medium prose finding.

9. **No Tauri dependency — satisfied.** The new types have no Tauri references or dependency, and the orchestrator's dependency-tree check found none.

10. **Documentation/style — satisfied mechanically, with semantic prose defects above.** The crate retains `#![deny(missing_docs)]` at `crates/espansoconfig-core/src/lib.rs:126`; the public items are documented, long new functions/loops carry closing comments, and the added prose is English. The false guarantee claims are semantic documentation failures even though the missing-docs and style rules pass.

## Implementer-flagged items

1. **Disambiguated `base.yml-1` — behaviour acceptable; surrounding documentation not fully truthful.** `entry_for_target` correctly seeks only the ordinary mapped name at `crates/espansoconfig-core/src/persist/backup.rs:2756`, while scanning lists the sibling and classifies its literal path. `BackupTarget::InConfigRoot`'s own line-1163 claim is true as a syntactic mapping. The broader “what each copy is of” and “file it was copied from” claims are false; see the prose finding at line 1149. There is no catalogue test for this flagged interaction.

2. **Target equal to configuration root — leaving the unreachable write-side edge is acceptable, but it is not honestly documented.** The special case at `crates/espansoconfig-core/src/persist/backup.rs:1066` prevents an empty backup path and keeps the sentinel in the in-root namespace. It reverse-maps to the in-root file named `_outside`, not to the configuration root. The unconditional reverse claim must record that exception or the public read operation must reject it. No test covers it.

3. **Non-UTF-8 entry name — safe in this step, but untested.** `BackupEntryId` retains the exact `PathBuf` at `crates/espansoconfig-core/src/persist/backup.rs:2300`; `WirePath` also retains exact path bytes internally and becomes lossy only when serialized/displayed. None of the new types serializes in this step, so lossy display data is not used for `read_entry` revalidation. A future wire identity reconstructed from the lossy path would necessarily name a different component and must be rejected as stale; Phase 2c-5-2 must use a genuinely opaque machine identity rather than round-tripping `WirePath`. This step has no non-UTF-8 filename test (distinct from its invalid-UTF-8 file-content test).

4. **Serialization and code accessors — satisfied.** None of `BackupCatalog`, `BackupBatchId`, `BackupEntryId`, `BackupBatch`, `BackupEntry`, `BackupTarget`, `BackupBatchScan`, `BackupEntryScan`, `BackupRootState`, `BackupReadStep`, `BackupReadError`, `BackupBytes`, or `BackupText` derives or implements `Serialize`. `BackupRootState`, `BatchSkipped`, `EntrySkipped`, `BackupReadStep`, and `BackupTarget` expose explicit lower-camel `code()` values following `BackupStep`; `BackupReadError`, like `BackupError`, does not invent a separate error `code()` accessor in this non-wire step. There is no caller outside the module/re-export in the repository.

## Q7 item 1 — test adequacy and falsifiability

- **Missing root — falsifiable.** `a_missing_backup_root_is_an_outcome_and_reading_it_creates_nothing` at `crates/espansoconfig-core/src/persist/backup.rs:3890` checks the typed `Missing` result, stale supplied identities, and absence of a created directory. It would fail if scanning created the root or returned an error/present state.
- **Refused roots — falsifiable for stable states, not for replacement races.** `a_backup_root_that_is_a_symlink_a_file_or_not_private_is_refused` at line 3927 separately checks a symlink, a regular file, several forbidden modes, and a restored private mode. It would pass even if a root replaced by a symlink after inspection were followed.
- **Stamp/counter order — falsifiable.** `the_catalogue_lists_batches_newest_name_first_with_the_counter_as_a_number` at line 3994 checks the full expected order including `-10` versus `-2`; `the_order_the_catalogue_displays_is_the_order_rotation_removes_from` at line 4042 couples that order to actual deletion.
- **Foreign, unmarked, and symlinked batches — falsifiable for pre-existing objects.** `the_catalogue_reports_what_it_skipped_instead_of_hiding_it` at line 4077 checks eligibility, exact reason counts, and that the symlink target remains untouched. It would pass despite the marker/batch check-use races because it performs no concurrent replacement.
- **Symlinks at every entry depth — only partially falsifiable.** `a_symlink_inside_a_batch_is_skipped_at_every_depth` at line 4126 genuinely falsifies handling of symlinks already present at three leaf depths and at a directory. It would still pass if the implementation followed a component swapped to a symlink between `symlink_metadata` and `read_dir`/`File::open`; that is exactly the High defect. Thus it does not falsify the full “never follow at any depth” claim.
- **Marker exclusion — falsifiable.** `the_batch_marker_is_excluded_from_the_entries_and_cannot_be_addressed` at line 4190 checks both scan exclusion and constructor refusal, while proving that the same name below the top level remains ordinary.
- **Non-UTF-8 offset — falsifiable.** `an_entry_reads_back_byte_for_byte_and_invalid_utf8_is_refused_at_its_offset` at line 4233 checks exact BOM/CRLF bytes, unchanged revision, refusal rather than lossy text, and the exact offset 12.
- **Disappearing entries/batches — falsifiable between calls, not during a call.** `a_batch_or_an_entry_that_disappears_between_calls_is_stale` at line 4277 checks removal of the leaf, marker, and batch directory and distinguishes `StaleEntry`, `StaleBatch`, and `entry_for_target`'s ordinary `None`. It would pass if a replacement during `read_entry` escaped the stale result, because all mutations finish before each call.
- **`_outside` namespace escaping — falsifiable for the exercised ordinary paths.** The pre-existing `an_in_root_outside_directory_does_not_collide_with_an_external_path` at line 3578 checks namespace disjointness and repeated underscores; the new bidirectional test at line 4348 checks external classification and unescaping. Both would catch common escaping regressions. They omit the target-equals-config-root edge, so they would pass with the documented total-reverse claim still false.
- **Target mapping both directions — falsifiable for ordinary, external, and escaped in-root targets.** `the_target_mapping_runs_forwards_and_backwards` at line 4348 checks actual entry lookup and reverse classifications. It would pass if disambiguated entries were misleadingly described as source mappings, and it omits the configuration-root sentinel and non-UTF-8 filename cases.
- **Enumeration and reading never create or rotate — strongly falsifiable for the exercised calls.** `enumerating_and_reading_never_create_remove_or_rotate_anything` at line 4446 snapshots path/type/bytes before and after scanning, mapping, and reading fifteen batches, then checks that all fifteen remain. Together with the missing-root test, it would fail on creation, mutation, removal, or retention rotation. Static call inspection also confirms no production read-side route reaches a writer.

Additional gaps relevant to the flagged items: there is no catalogue-level test for a disambiguated sibling, no test for a non-UTF-8 filename/identity, no test for the target-equals-config-root sentinel, and no adversarial replacement test at any metadata/open or metadata/list boundary. The strict-path test at line 4543 is worse than a gap: it would pass while the required rejection of `.` is wrong because it asserts normalisation as the expected result.

## Open questions

None blocks the verdict. The only platform-design choice left to the fix is which descriptor-relative API is acceptable for the macOS-only target; the required property is clear regardless of the wrapper chosen.
