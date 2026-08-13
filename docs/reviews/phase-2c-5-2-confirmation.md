VERDICT: NOT READY

## High findings

None.

## Medium findings

### Medium — `crates/espansoconfig-core/src/persist/backup.rs:1091` and `:4283` — pathname containment still overclaims off macOS

The comments say the constructed path “cannot escape the batch directory.” The constructors establish only lexical containment. Off macOS, a checked component can be replaced by a symlink before the later pathname operation and then followed.

No test catches this because the constructor test examines only the returned `PathBuf`; the substitution test is macOS-only.

Exact replacements:

- `backup.rs:1087`:

  > A target outside the configuration root goes under `OUTSIDE_CONFIG_ROOT`, followed by its absolute path with the root component dropped. This keeps the path visible, keeps equal basenames distinct, and introduces no lexical `.` or `..` escape; filesystem containment retains the target-specific guarantees documented by `ResolvedDirectory`.

- `backup.rs:4282`:

  > A target outside the configuration root goes under `_outside`, keeps its whole component path, and introduces no lexical `.` or `..` escape.

### Medium — sortable-name order is still repeatedly described as age or chronology

These sites claim that rotation selects “older,” “oldest,” or “newest” batches:

- `crates/espansoconfig-core/src/persist/backup.rs:2313`
- `crates/espansoconfig-core/src/persist/backup.rs:2379`
- `crates/espansoconfig-core/src/persist/backup.rs:2491`
- `crates/espansoconfig-core/src/persist/backup.rs:4116`
- `crates/espansoconfig-core/src/persist/backup.rs:4118`
- `crates/espansoconfig-core/src/persist/backup.rs:4132`
- `crates/espansoconfig-core/src/persist/backup.rs:4157`
- `crates/espansoconfig-core/src/persist/backup.rs:4163`
- `crates/espansoconfig-core/src/persist/backup.rs:4165`
- `crates/espansoconfig-core/src/persist/backup.rs:4171`
- `crates/espansoconfig-core/src/persist/backup.rs:4174`
- `crates/espansoconfig-core/src/persist/backup.rs:4191`
- `crates/espansoconfig-core/src/persist/backup.rs:4482`
- `crates/espansoconfig-core/tests/persist_backup.rs:944`
- `crates/espansoconfig-core/tests/persist_backup.rs:948`
- `crates/espansoconfig-core/tests/persist_backup.rs:951`
- `crates/espansoconfig-core/tests/persist_backup.rs:961`
- `crates/espansoconfig-core/tests/persist_backup.rs:973`
- `crates/espansoconfig-core/tests/persist_backup.rs:991`

What is true is only that rotation orders recognised directory names by `(stamp string, numeric counter)`. Clock adjustment and externally created future-dated names prevent that order from establishing age. `backup.rs:4191` is additionally wrong on its own terms: among eleven items, “eleventh-oldest” would be the newest, not the removed first item.

The tests pass because they assert which synthetic name is removed; they do not establish chronology. Their names and assertion messages merely repeat the unsupported interpretation.

Exact replacements:

- `backup.rs:2313`:

  > An existing destination may hold bytes available nowhere else, so it is skipped rather than truncated; this code attributes neither provenance nor age to those bytes.

- `backup.rs:2379`:

  > Removes all but the highest-sorting `keep` recognised batch names from `root`, lowest-sorting first, never touching `current`.

- `backup.rs:2491`:

  > The same comparison the catalogue displays with, reversed: rotation puts the lowest-sorting name first.

- `backup.rs:4116`:

  > Eleven recognised batch names, ten kept, and the lowest-sorting name removed.

- Rename the test at `backup.rs:4118` to:

  > `rotation_keeps_ten_batches_and_removes_the_lowest_sorting_name_first`

- `backup.rs:4132`:

  > the lowest-sorting batch name is the one removed

- `backup.rs:4157`:

  > The disambiguating counter orders numerically, so `-2` sorts below `-10`; a lexicographic comparison of the whole name would reverse them.

- Replace the `oldest`/`newest` local names and messages at `backup.rs:4163-4174` with `lowest_sorting`/`highest_sorting`, and:

  > the bare stamp has the lowest-sorting name of the three

  > `-10` sorts above `-2`

- `backup.rs:4191`:

  > only the lowest-sorting recognised batch name goes

- `backup.rs:4482`:

  > the lowest-sorting marked batch name is the one removed

- `tests/persist_backup.rs:944`:

  > `b"fixture payload"`

- `tests/persist_backup.rs:948`:

  > A backup that fails removes no existing recognised batch.

- `tests/persist_backup.rs:951`:

  > Eleven recognised batches are present, and a save whose copy cannot be written must leave all eleven where they are: rotation must not run for an attempt that produced no copy.

- Rename `tests/persist_backup.rs:961` to:

  > `a_backup_that_fails_after_its_batch_exists_removes_no_existing_batch`

- Replace “older batch” at `tests/persist_backup.rs:973` and `:991` with:

  > existing batch

### Medium — retention and pre-commit copies still claim recoverability guarantees the implementation does not give

The following sites say retention “is” ten batches/sessions, that a committed replacement has a “recoverable pre-commit image,” or that replacement commits require “recoverability”:

- `crates/espansoconfig-core/src/lib.rs:100`
- `crates/espansoconfig-core/src/persist/backup.rs:130`
- `crates/espansoconfig-core/src/persist/backup.rs:441`
- `crates/espansoconfig-core/src/persist/save.rs:511`
- `crates/espansoconfig-core/src/persist/save.rs:657`
- `crates/espansoconfig-core/src/persist/save.rs:669`
- `crates/espansoconfig-core/src/persist/save.rs:1150`
- `crates/espansoconfig-core/src/persist/save.rs:1181`
- `crates/espansoconfig-core/tests/persist_backup.rs:45`
- `crates/espansoconfig-core/tests/persist_raw_save.rs:41`
- `crates/espansoconfig-core/tests/persist_raw_save.rs:45`
- `crates/espansoconfig-core/tests/persist_raw_save.rs:1127`
- `crates/espansoconfig-core/tests/persist_raw_save.rs:1134`
- `crates/espansoconfig-core/tests/persist_raw_save.rs:1210`
- `src-tauri/src/commands.rs:5964`
- `src/lib/i18n/saveCodes.test.ts:210`

Rotation only attempts to retain ten recognised, name-selected batches and can fail. More importantly, the session captures a file only before its first change: a later replacement in that session does not necessarily have a copy of its immediately preceding state. Thus “every committed raw replacement has a recoverable pre-commit image” is false independently of eventual rotation.

Tests observe an immediate copy in selected fixtures. They do not prove later availability, successful rotation, or an immediate pre-commit copy for every subsequent replacement in the same session.

Exact replacement for the retention-only statements:

> Rotation attempts to retain at most ten recognised batch directories chosen by sortable name; it promises neither successful cleanup nor any retention duration.

Exact replacement for the replacement-policy statements:

> Replacement mode requires a `BackupSession`. Before that session’s first committed change to a file, capture writes the bytes then held by the target; later saves in the same session write no new copy. This is not a promise that any particular state can later be recovered.

Exact replacement for `src-tauri/src/commands.rs:5962`:

> This session already copied the file before its first change, so a second copy is deliberately not taken. That first-session copy is not necessarily the state immediately preceding this write and is not a recoverability guarantee.

### Medium — `crates/espansoconfig-core/src/persist/backup.rs:4451` — the marker is still called proof that this module minted a directory

The comment first says a timestamp-shaped name is not proof, then says “Only the ownership marker is.” A marker is deliberately forgeable; it establishes recognition of the format, not creation or provenance.

The test checks only whether rotation accepts the marker bytes. It cannot establish who created the marker or directory.

Exact replacement:

> A timestamp-shaped name is not evidence that this module minted a directory. A recognised ownership marker makes the directory eligible for rotation, but remains forgeable and proves neither creation nor provenance; a batch-shaped directory without one is left alone and is not counted against retention.

## Low findings

### Low — `src/lib/ipc/errors.ts:475` — the `NotUtf8` narrowing is incomplete

The field still says it explains why the backup folder “could not be read.” In `NotUtf8`, the entry opened and all bytes were read; only conversion to a JavaScript-compatible UTF-8 string failed.

Structural and dictionary tests do not evaluate the meaning of this field comment.

Exact replacement:

> The reason the backup-catalogue request did not produce its requested result, exactly as Rust reports it.

### Low — the new length documentation falsely says every value above `2^53 - 1` is rounded

Affected sites:

- `crates/espansoconfig-core/src/persist/backup.rs:3786`
- `crates/espansoconfig-core/src/persist/backup.rs:5815`
- `crates/espansoconfig-core/src/persist/backup.rs:5841`
- `src/lib/ipc/types.ts:2026`

`2^53` itself is exactly representable as a JavaScript number. The first nearby integer demonstrating loss is `2^53 + 1`. The decimal-string representation is still the correct design because not every `u64` is exactly representable.

The new test catches a regression back to numeric serialization, but its “rounded” control uses `2^53`, which would not be rounded as a JSON number.

Exact replacement for the serializer and TypeScript prose:

> A filesystem length can exceed JavaScript’s safe-integer range, where not every `u64` is exactly representable as a JSON number—for example, `2^53 + 1` is rounded. Decimal digits therefore carry every value losslessly.

Exact replacement for the test comment:

> The first integer above `2^53` demonstrates the loss a JSON number can introduce.

The illustrative control should use `MAX_EXACT_WIRE_INTEGER + 2` and expect `"9007199254740993"`.

## `batch_stamp` adjudication

Not a defect.

At `crates/espansoconfig-core/src/persist/backup.rs:1331`, the grammatical subject is the fixed UTC format applied to `when`: it explains why those formatted values can be compared lexicographically. It does not claim that directory order proves the chronology of directories or files. The nearby `rotate()` documentation explicitly says on-disk ordering establishes no chronology and that a batch name is only a label.

## `length` wire-format verdict

Sound.

`serialize_byte_length` uses `u64::to_string()` and `serialize_str`, so `0`, `2^53 - 1`, `2^53`, and `u64::MAX` cross as exact decimal strings. The TypeScript field is honestly `string` and advises `BigInt(length)`. No consumer or fixture still treats `BackupEntry.length` as a number.

`BackupEntry` is response-only, so there is intentionally no Rust `Deserialize` path for the whole structure. JSON parsing preserves the string exactly, and `BigInt` reconstructs the integer exactly. Refusing would omit an otherwise addressable entry from a listing claiming completeness; capping would report a length never observed. Decimal digits are the correct choice. Only the explanatory rounding example identified above is unsound.

## Checked and found clean

- All eleven originally named sites were changed; the remaining findings above are narrower or further instances missed by the sweep.
- The corrected macOS/off-macOS `ResolvedDirectory` descriptions accurately state descriptor-relative traversal on macOS and the pathname substitution race elsewhere.
- The `batch_stamp` sentence is format-scoped and does not claim tree chronology.
- The new `BackupEntry.length` representation is lossless and has no stale numeric consumer.
- EN `code.backupStep.writeBatchMarker` and ES `code.backupStep.writeBatchMarker` both describe writing the marker used for recognition; neither says the marker or directory was created by espansoConfig.
- EN `code.entrySkipped.marker` and ES `code.entrySkipped.marker` have equivalent meaning and identify the reserved marker entry without claiming its creator.
- The corrected EN/ES document-mismatch, stale identity, no-marker, generic catalogue-failure, and retention messages are meaning-equivalent and avoid provenance, prior-resolution, and recoverability claims.
- The read-only tripwire is now accurately described as a fixed-vocabulary/source-fixture regression check, not a proof of arbitrary side-effect freedom.
- `readBackupText` now says it has no route to write to disk, which is accurate.
- The registration inventory correctly states nine readers, six writers, one menu command, and sixteen total.
- Changes in `persist/mod.rs`, the changed hunks of `persist/save.rs`, `src-tauri/src/save.rs`, and `src/lib/browser/saveOutcome.ts` are documentation-only. The save transaction behavior was not altered. The separate standing recoverability prose in `persist/save.rs` is listed above.
- No new chronology, provenance, or recoverability defect was found in the user-facing EN/ES backup-catalogue strings beyond the source/test findings listed above.
- Per instruction, no test suite was rerun, no URL was fetched, and no repository file was modified.

Codex session ID: 019ffc5a-1739-7863-a342-619111f7fa46
Resume in Codex: codex resume 019ffc5a-1739-7863-a342-619111f7fa46
