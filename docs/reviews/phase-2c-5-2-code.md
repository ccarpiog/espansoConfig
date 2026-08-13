VERDICT: NOT READY

## High findings

None.

## Medium findings

### Medium — `crates/espansoconfig-core/src/persist/backup.rs:3634` — pathname containment is described as though the macOS descriptor guarantee applied everywhere

The comment says every later component is resolved against the successfully opened root rather than against its name again. That is true on macOS, where traversal is descriptor-relative. Off macOS, `ResolvedDirectory` retains a pathname and later metadata, listing, and open operations re-resolve it; a component swapped for a symlink between check and use can therefore be followed.

The same overstatement appears in the lexical-containment comments at:

- `crates/espansoconfig-core/src/persist/backup.rs:2916`
- `crates/espansoconfig-core/src/persist/backup.rs:3027`
- `crates/espansoconfig-core/src/persist/backup.rs:3045`
- `crates/espansoconfig-core/src/persist/backup.rs:3717`
- `src-tauri/src/error.rs:418`
- `src/lib/ipc/types.ts:1990`

Those constructors exclude absolute paths, `.` and `..`, which establishes lexical containment. They do not by themselves establish filesystem containment against raced substitutions off macOS.

Two still broader pre-existing statements also overclaim:

- `crates/espansoconfig-core/src/persist/backup.rs:1518` says the module “never follows” a symbolic link, although the non-macOS race can do so.
- `crates/espansoconfig-core/src/persist/backup.rs:2397` says rotation cannot follow a link out of the backup root. The write side uses pathname checks on every platform; a same-user substitution between `symlink_metadata` and a later pathname operation can be followed, even though that principal is explicitly outside the threat model.

No test catches these statements because the macOS tests exercise the descriptor implementation, while the non-macOS limitation is deliberate and cannot make a documentation assertion fail.

Exact replacements:

- For `backup.rs:3634`:

  > On macOS, every later component is resolved relative to the opened root descriptor. Off macOS, later operations re-resolve the stored pathname and retain the substitution race documented by `ResolvedDirectory`.

- For the lexical-containment comments:

  > The identity contains only plain relative components, so joining it introduces no lexical `.` or `..` escape; filesystem containment retains the target-specific guarantees documented by `ResolvedDirectory`.

- For `backup.rs:1518`:

  > a symbolic link observed by this operation and refused

- For `backup.rs:2397`:

  > A symlink present when `symlink_metadata` runs is skipped, and `remove_dir_all` does not traverse a symlink it encounters; the same-user substitution race remains outside the stated write-side threat model.

### Medium — `crates/espansoconfig-core/src/persist/backup.rs:39` — retention is still described as chronological

The module says the eleventh session after this one removes this session’s batch. That is not guaranteed. Rotation orders sortable, clock-derived directory labels, explicitly excludes only the current batch during its own rotation, and can fail or encounter unreadable entries. A clock adjustment or future-dated label can cause a later session to remove this batch much sooner, while cleanup failures can retain more than ten.

The same forbidden chronology or retention promise appears at:

- `src/lib/ipc/types.ts:734`
- `src/lib/ipc/types.ts:1457`
- `src/lib/ipc/types.ts:1480`
- `src/lib/ipc/types.ts:1738`
- `src/lib/i18n/en.json:155`
- `src/lib/i18n/en.json:699`
- `src/lib/i18n/en.json:701`
- `src/lib/i18n/es.json:155`
- `src/lib/i18n/es.json:699`
- `src/lib/i18n/es.json:701`

In particular, “older backups,” “the last ten sessions,” and “the eleventh session after this one” claim chronology that the label ordering and best-effort cleanup do not establish.

Vocabulary scans cannot catch this because they blacklist a few exact phrases, not meanings such as “older,” “last ten,” or “eleventh session.”

Exact replacements:

- `backup.rs:39`:

  > Rotation attempts to retain at most ten recognised batch directories, chosen by their sortable names. A later session may remove this batch, and no retention duration or recoverability is promised.

- `src/lib/ipc/types.ts:734`:

  > How far the retention tidy-up of recognised backup batches got.

- `src/lib/ipc/types.ts:1457`:

  > What the retention tidy-up of recognised backup batches did, on the one save per session that runs it.

- `src/lib/ipc/types.ts:1480`:

  > Not a promise that the file is recoverable. Rotation attempts to retain ten recognised batch directories by sortable name, but it promises neither how long this batch remains nor that cleanup succeeds.

- `src/lib/ipc/types.ts:1738`:

  > A `true` is not a promise that the file can be recovered: rotation is best-effort, orders batches by directory label and promises no retention duration.

- EN `browser.saveOutcome.backupTaken`:

  > A copy of this file as it was before this session’s first change to it was kept. Retention is best-effort and orders session batches by their folder labels, so this does not promise how long the copy remains or that the file can be recovered later.

- ES `browser.saveOutcome.backupTaken`:

  > Se ha guardado una copia de este archivo tal y como estaba antes del primer cambio de esta sesión. La retención se aplica según las etiquetas de las carpetas de sesión y puede fallar, así que esto no garantiza cuánto tiempo seguirá la copia ni que el archivo pueda recuperarse más adelante.

- EN `code.rotationOutcome.notAttempted`:

  > Backup batches were not examined for retention on this save.

- ES `code.rotationOutcome.notAttempted`:

  > En este guardado no se examinaron los lotes de copias para aplicar la retención.

- EN `code.rotationOutcome.scanFailed`:

  > The backups folder could not be listed, so recognised batches were neither counted nor removed.

- ES `code.rotationOutcome.scanFailed`:

  > No se pudo listar la carpeta de copias, así que los lotes reconocidos ni se contaron ni se borraron.

### Medium — `src/lib/i18n/en.json:706` — document-mismatch messages assert backup provenance

The English message calls the requested entry “the copy this backup folder holds for the file you chose.” The command proves only that the entry identity equals the literal entry name produced by mapping the authoritative `DocumentContext.path`. The marker and entry are forgeable, and no check proves that the bytes were copied from the selected document.

Spanish makes the same false claim at `src/lib/i18n/es.json:706`: “la copia que esta carpeta guarda del archivo que elegiste.”

Key and placeholder parity tests cannot evaluate the meaning of either sentence, while the forbidden-word scan does not reject ordinary provenance words such as “copy” or “copia.”

Exact replacements:

- EN:

  > This backup entry does not match the entry name computed from the file you chose, so nothing was read.

- ES:

  > Esta entrada de copia no coincide con el nombre de entrada calculado a partir del archivo que elegiste, así que no se leyó nada.

### Medium — `src/lib/i18n/en.json:735` — stale messages falsely imply prior successful resolution

`StaleBatch` means that a syntactically admissible identity does not resolve to a recognised batch now. A caller can forge a grammatically valid name that never resolved at all, so “no longer one espansoConfig recognises” is too strong. The public core `StaleEntry` type has the same issue for a valid entry identity that never existed.

The same historical assertion appears at:

- `src/lib/i18n/en.json:736`
- `src/lib/i18n/es.json:735`
- `src/lib/i18n/es.json:736`
- `crates/espansoconfig-core/src/persist/backup.rs:2737`
- `crates/espansoconfig-core/src/persist/backup.rs:2746`
- `src-tauri/src/error.rs:392`
- `src/lib/ipc/errors.ts:385`

The tests cover entries or batches deliberately removed after creation, so they demonstrate one cause of staleness without proving it is the only cause. Dictionary tests check structure, not the temporal meaning of “no longer” or “ya no.”

Exact replacements:

- EN `staleBatch`:

  > That name does not currently resolve to a backup folder espansoConfig recognises. List the backups again.

- ES `staleBatch`:

  > Ese nombre no corresponde ahora a una carpeta de copias que espansoConfig reconozca. Vuelve a listar las copias.

- EN `staleEntry`:

  > That entry does not currently resolve in that backup folder. List its entries again.

- ES `staleEntry`:

  > Esa entrada no corresponde ahora a una entrada de esa carpeta de copias. Vuelve a listar sus entradas.

- Core operand comments:

  > The identity that does not resolve now.

- Rust/TypeScript distinction between malformed and stale batches:

  > The stale-batch arm means that a name admitted by the grammar does not name a recognised batch now; it does not imply that the identity resolved previously.

### Medium — `src/lib/i18n/en.json:714` — the no-marker message says the marker proves who created the directory

The English message says the directory lacks a marker “saying espansoConfig made it.” The marker establishes only recognition of a format and is deliberately forgeable. Its presence would not prove creation by espansoConfig, so its absence cannot honestly be described as absence of that proof.

Spanish makes the same claim at `src/lib/i18n/es.json:714`: “la marca que dice que la hizo espansoConfig.”

Meaning is not covered by dictionary parity, placeholder parity, or the narrow forbidden-vocabulary test.

Exact replacements:

- EN:

  > carries no ownership marker in a format espansoConfig recognises, so it was left exactly as it is

- ES:

  > no lleva una marca de propiedad con un formato que espansoConfig reconozca, así que se dejó tal cual

## Low findings

### Low — `crates/espansoconfig-core/src/persist/backup.rs:3104` — a filesystem `u64` length is assumed to fit exactly in JavaScript

`BackupEntry.length` is a `u64`, serialized as a JSON number and declared as a TypeScript `number`. The comment claims a real file’s size is far below `MAX_EXACT_WIRE_INTEGER`, but a recognised batch is untrusted and can contain a sparse regular file larger than `2^53 - 1`. JavaScript will then round the observed length.

The length is display metadata rather than authority, so this does not expose a wrong-file read, but the wire value no longer means the exact byte length its Rust and TypeScript documentation promises.

The fixture contains only small files, and the shape contracts check field names and types rather than numeric boundary behavior.

Required behavioral fix: serialize `length` losslessly, for example as a decimal string, or refuse/cap values above the exact wire range with a typed indication.

Exact replacement for the false sentence:

> A filesystem length is a `u64` and is not inherently bounded by JavaScript’s exact-integer range, so it must cross in a lossless representation.

### Low — `src-tauri/src/wire_contract.rs:1518` — read-only tests are regression tripwires, not sound proofs

The identifier scan rejects a fixed blacklist in selected source bodies, and the byte oracle exercises one fixture. A new writer with an unlisted name, a side-effecting helper, metadata-only mutation, or a route not exercised by that fixture can pass both.

The surrounding comment commendably acknowledges that each half is incomplete, but the test name and the module claim that read-only status is “checked rather than asserted” still overstate what their combination establishes.

No further test catches this because this is a limitation of the checking method itself.

Exact replacement:

> These are regression tripwires for the known read-only routes: the source scan rejects a fixed writer vocabulary and the byte oracle covers one exercised tree, so neither their combination nor either test alone proves arbitrary callees side-effect-free.

A more accurate test heading would be:

> Regression checks for the intended read-only backup-command paths.

### Low — `src/lib/i18n/en.json:707` — the generic read-failure message is false for `NotUtf8`

`BackupReadFailed` also carries `BackupReadError::NotUtf8`. In that arm the file was opened and all bytes were read successfully; only conversion of those bytes into a `String` failed. Saying espansoConfig “could not read the backups folder” is therefore false.

Spanish has the same defect at `src/lib/i18n/es.json:707`.

The same overbroad taxonomy description occurs at:

- `src-tauri/src/error.rs:452`
- `src/lib/ipc/errors.ts:450`
- `src/lib/i18n/codes.ts:1386`
- `src/lib/i18n/codes.ts:1467`
- `src/lib/i18n/index.ts:1769`

Tests prove that `NotUtf8` is typed and that its offset renders, but do not compare the generic outer sentence with the nested reason.

Exact replacements:

- EN:

  > espansoConfig could not complete this backup-catalogue request. What it reports beside this is the reason.

- ES:

  > espansoConfig no pudo completar esta solicitud del catálogo de copias. Lo que se indica junto a esto es el motivo.

- Developer-facing taxonomy sentence:

  > A backup-catalogue request could not return its requested result, for a reason reported by the catalogue.

### Low — `src/lib/ipc/commands.ts:836` — a disk-reading command says it has no route to disk

`readBackupText` opens and reads an entry in the backup tree. The intended claim is that it has no route to write or restore, but “has no route to the disk” denies its actual read path.

A suite can verify the invoked command name and returned data without evaluating this JSDoc sentence.

Exact replacement:

> This function is not a restore and has no route to write to disk.

### Low — `src-tauri/src/backup.rs:24` — exposed string identities are described as impossible to turn into paths

The module says callers “cannot build a filesystem path” from a batch or entry identity. Both identities serialize their component names, the workspace exposes its root, and structurally typed callers can construct or concatenate arbitrary strings. Safety comes from treating those strings as questions, validating them, and re-resolving them beneath the authoritative root—not from making path construction impossible.

The same overstatement appears at:

- `src-tauri/src/commands.rs:2107`
- `crates/espansoconfig-core/src/persist/backup.rs:2886`
- `crates/espansoconfig-core/src/persist/backup.rs:3024`

Tests prove that forged strings are refused or re-resolved, but cannot make TypeScript values opaque at runtime.

Exact replacements:

- Module identity contract:

  > Both identities are opaque by contract: callers should compare them and hand them back, while every command validates their exposed string fields and re-resolves them beneath the workspace-owned backup root.

- Command argument contract:

  > This identity is not authority: although its strings can be composed into a pathname, the command accepts only the identity and re-resolves it beneath the workspace-owned backup root.

### Low — `src-tauri/src/main.rs:73` — the registration documentation was not updated for the three new readers

The function now registers nine read-only workspace commands, six writers, and one menu command. Its documentation still says six readers, six writers, and the menu command. It also calls the menu command “the thirteenth” at line 87 and says none of “the thirteen” commands is a plugin command at line 99, although the registered total is now sixteen.

The dispatcher contract correctly checks fifteen workspace commands plus one menu command, so all executable tests pass while the adjacent documentation describes the previous inventory.

Exact replacements:

- Line 73:

  > Registers the nine read-only workspace commands, the six commands that write, the menu command, and the state they share.

- Lines 81–90:

  > The original six workspace readers and the three backup-catalogue commands are read-only. The six save commands write through `espansoconfig_core::persist::save_document`; the menu command does not write a user file.

- Line 99:

  > none of the sixteen commands is a plugin command.

## Checked and found clean

- `read_backup_text` resolves the supplied `DocumentId` through the workspace’s authoritative `DocumentContext`, derives the permitted entry from that resolved path, requires exact `BackupEntryId` equality, and reads only after that check. `DocumentSummary.relative_path` and `BackupTarget.relative_path` never act as authority.
- Structurally valid forged batch names, malformed relative paths, unknown documents, wrong targets, stale batches, stale entries, unreadable entries, and non-UTF-8 contents all reach typed refusal paths. No production refusal path uses `unwrap`, panics, or returns a silent empty success.
- A target equal to the configuration root produces `None` from `entry_for_target` and is folded into `backupEntryIsNotThisDocument`, alongside the other two intended shapes.
- Disambiguated entries such as `base.yml-1` are listed and classified solely by their literal entry path. Reading one for `base.yml` is refused; no executable classification treats its name as provenance.
- Non-UTF-8 entry identities are exact-or-absent: `is_exactly_spellable` compares the rendered `OsStr` spelling byte-for-byte, unspellable entries are omitted, `unaddressable` counts them, and `complete` becomes false.
- The new catalogue commands themselves use immutable workspace access and `BackupCatalog`; no writer or `BackupSession` is present on their inspected call path. The caveat above concerns the strength of the regression tests, not an observed write.
- The macOS implementation uses descriptor-relative traversal, `O_NOFOLLOW`, descriptor confirmation, and same-descriptor leaf reads as specified. The executable platform split matches the handoff; the remaining defects are unqualified prose at the sites listed above.
- The new `BackupTarget` dictionary phrases describe names rather than byte provenance, including the disambiguated-copy case.
- The `EntrySkipped::Symlink` dictionary phrase is sound in context: that code represents a link the walk actually observed and refused. It does not state that a later raced substitution is impossible.
- Batch ordering in the new catalogue surface is consistently described as “newest name first,” not as file chronology. The chronology findings above concern the remaining unqualified “older,” “last ten,” and “eleventh session” claims.
- Rust/TypeScript wire shapes, enum namespaces, command-error operands, dictionary keys, placeholder parity, and EN/ES key parity are covered by the passing gates reported by the caller.
- The core remains Tauri-free according to the independently verified dependency gate.
- Per instruction, no test suite was rerun, no URL was fetched, and no repository file was modified.

Codex session ID: 019ffc39-37ac-79b3-a960-dac89e270ee5
Resume in Codex: codex resume 019ffc39-37ac-79b3-a960-dac89e270ee5
