# Phase 3-10 — The per-file bulk coordinator

**Spec:** `docs/decisions/3-split-notes.md` §2 step "3-10", §3 rulings 19–22 (and 20's seven
fields). **Risk:** high. **Driven**, one worker, with no window half (ruling 30). Depends on 3-1 and
3-5, both closed.

No window reading was performed or claimed.

---

## 1. What the tree could not do before this phase

Every writer saved one file for one operation. Nothing could apply one option intent to several
snippets, several snippets of one file could only be saved one save at a time, and nothing
preflighted a set of files before writing any of them.

## 2. What changed

### 2.1 The core (`crates/espansoconfig-core`)

- **`draft/bulk.rs` (new)** — the bounded bulk planning:
  - `BulkOption`: exactly ruling 20's seven options, serialized as the espanso key
    (`snake_case`). Any other field name, `paragraph` and `anchor` included, does not deserialize.
  - `BulkValue`: `Set(String)` or `Remove`, externally tagged like `DraftField`, with **no
    `Unchanged` arm**: an untouched control emits nothing. A `Set` is **source text**, written
    verbatim as a plain scalar (§7).
  - `BulkOptionChange { option, value }`, `deny_unknown_fields`.
  - `BulkPlanError`, nine struct variants: five refuse the request as a whole (`NoOptionChanges`,
    `OptionRepeated`, `OptionNotPlainSource`, `NoFiles`, `DocumentRepeated`) and four are one file's
    blocker (`NoMatches`, `MatchRepeated`, `Identity { index, error: IdentityError }`,
    `Draft { index, error: DraftError }`).
  - `check_bulk_changes`, `check_bulk_documents`, `is_plain_source` and
    `plan_bulk_option_edits(source, view, matches, changes)`. The last runs `plan_match_edits` once
    per selected snippet, turns every value it writes into plain source text, and concatenates the
    batches. It is **one batch per file**: several snippets and several absent options become one
    save.
- **`persist/save.rs`** — `preflight_edits(context, source, edits, acknowledgement) ->
  SavePreflight { candidate, changes, findings, verdict }`. It runs the save's in-memory half (the
  read-only check, `apply_edits`, the private `findings_of`, `verdict`) over text already held. It
  takes no lock, reads nothing and writes nothing. It shares the transaction's code, so the two
  cannot judge a candidate differently. Re-exported from `persist`.
- `draft/mod.rs` documents the new section and re-exports the bulk items.

### 2.2 The command layer (`src-tauri/`)

- **`bulk.rs` (new)**: the wire types. `BulkOptionsRequest { changes, files, excluded }`,
  `BulkFileRequest { document, base_revision, matches, consent }` and `BulkConsent { document,
  base_revision, intent, candidate, acknowledgement }` are all `deny_unknown_fields`, so there is no `force` flag at any level.
  `BulkResult { preflight_passed, nothing_written, files }` has `nothing_written` derived by
  `BulkResult::new`. `BulkFileReport { document, #[flatten] outcome }` and `BulkFileOutcome` are
  flat, `{ "outcome": … }`, like `SaveResult`, with a hand-written `Serialize`. Also
  `every_bulk_file_outcome()` for the contracts.
- **`commands.rs`**:
  - `WorkspaceSession::apply_bulk_options` and the `#[tauri::command] apply_bulk_options(request)`,
    the eighth writer and the nineteenth workspace command. Registered in `main.rs`.
  - `apply_bulk_options_with(workspace, side, request, save: &mut BulkSave)`. It refuses a malformed
    request (`CommandError::BulkRefused`), preflights every file (`preflight_one_file`), and then, only
    if all files passed, calls `save` once per file in order (`execute_one_file`), stopping at the
    first outcome that is neither *saved* nor *already unchanged*. Excluded files are reported last.
  - `BulkSave` is the test seam: `dyn FnMut(&mut Workspace, SessionSideOfASave, OneSave) ->
    Result<SaveResult, CommandError>`. Production passes `run_one_save` itself. Tests pass a
    closure that injects a failure for one file and hands the rest to `run_one_save`.
- **`error.rs`**: `CommandError::BulkRefused { error: BulkPlanError }` (code `bulkRefused`, one
  operand). It is sampled in `every_command_error`.
- The module docs whose counts this invalidated were edited in place: `commands.rs` (eight of
  nineteen write), `main.rs` and `dispatch_check.rs` (twenty commands).

### 2.3 Wire and i18n

- `src/lib/ipc/types.ts`: `BulkOption`, `BulkValue`, `BulkOptionChange`, `BulkConsent`,
  `BulkFileRequest`, `BulkOptionsRequest`, `IdentityError` (+ `Name`), `BulkPlanError` (+ `Name`),
  `BulkFileOutcomeName`, ten `Bulk…Outcome` interfaces, `BulkFileOutcome`, `BulkFileReport` and
  `BulkResult`.
- `src/lib/ipc/errors.ts`: `bulkRefused`, `BulkRefusedError`, its operand row and an
  `identityRecovery` arm (`none`). `src/lib/ipc/commands.ts`: `applyBulkOptions(request)` and the
  name in `COMMAND_NAMES`.
- `src/lib/i18n/codes.ts`: `bulkPlanErrorKey` / `describeBulkPlanError`,
  `bulkFileOutcomeKey` / `describeBulkFileOutcome`, and `identityErrorKey` /
  `describeIdentityError`. All three are registered in `CODE_NAMESPACE_KEY_BUILDERS`. `index.ts`
  gains `tBulkPlanError`, `tBulkFileOutcome` and `tIdentityError`.
- **`identityError` left `CODE_NAMESPACES_WITHOUT_A_BUILDER`.** Its stated reason, "never crosses
  the boundary in its own shape", stopped being true once `BulkPlanError::Identity` carried it
  whole. The sentences that made that claim in `codes.ts`, `codes.test.ts` and
  `dictionary_contract.rs` were corrected.
- `en.json` / `es.json`: 21 new `code.*` keys each (1 `commandError`, 9 `bulkPlanError`, 10
  `bulkFileOutcome`, 1 `verificationFailure`). No sentence quotes configuration content. Only `optionRepeated` interpolates an
  operand, `{option}`, which is an espanso key.
- Contract tables: `dictionary_contract.rs` (two `CODE_ENUMS` entries, three counts, `BulkOption`
  and `BulkValue` in `NOT_A_CODE`, the exempted-union list), `wire_contract.rs` (the command-list
  test, now nineteen workspace commands / twenty in all / eight writers, plus four new bulk tests),
  `dispatch_check.rs` (the remote-origin sweep and a reachability test), `codes.test.ts` (the
  `bulkRefused` sample, count 23, three namespace samples, the exceptions list) and
  `commands.test.ts`.

## 3. The design

### 3.1 Per-file atomicity, not cross-file atomicity (ruling 19)

1. **The request as a whole.** `check_bulk_changes` and `check_bulk_documents`. A malformed request is
   the command's `Err(bulkRefused)`, and no file is read.
2. **Every file's preflight, all of them**, even after one is blocked, so the result names every
   blocker. The steps: the context; `document_at` (the base revision against the session's
   projection); `plan_bulk_option_edits`; `preflight_edits` under the file's own consent; a consent
   naming another candidate is `consentStale`; a verdict that does not proceed is `refused`, with the
   candidate. **Any blocker stops the run**: blocked files carry their reason, every other applied file
   is `notAttempted`, and no save runs, so no file is written and no backup is taken.
3. **One `run_one_save` per file, in request order.** Each file has its own batch, base revision and
   consent. `committed: true` is `saved` (with `backup_taken`, the transaction's own answer).
   `committed: false` is `alreadyUnchanged`. A conflict is `conflicted`, a gate refusal is `refused`,
   and an error is `writeOutcomeUnknown` exactly when `SaveError::may_have_written` says so,
   `failed` otherwise. The first outcome other than *saved* / *already unchanged* stops the run, and
   later files are `notAttempted`. Earlier commits stand and are reported. **A committed write is never
   reported as an error**: every per-file failure is an outcome in `Ok`.
4. `nothing_written` is true only when no outcome is `saved` or `writeOutcomeUnknown`, so an uncertain
   write never licenses "nothing was written".

Ruling 19's "refused or conflicted" bucket is split five ways: `conflicted`, `refused`,
`consentStale`, `blocked` (preflight) and `failed` (execution). Each asks something different of the
caller. "Exclusions and execution failures are counted separately" (3-11) can read the split
directly.

### 3.2 Consent (ruling 22)

Consent is per file: `BulkConsent { document, base_revision, intent, candidate, acknowledgement }`.
The preflight compares all four identities with the file's own request — its document, its base
revision, the `bulk_intent` fingerprint of its selection and changes, and the candidate it derives —
and the save gate matches the acknowledgement as an exact multiset. Any disagreement is **not
spent**: it is `consentStale` (carrying the intent and candidate a fresh consent must name), and
nothing is written. `refused` reports the `intent` beside the candidate. There is no batch-wide bit.
(Fixed at review: the first version bound consent to the candidate alone; see §7.)

### 3.3 Locks

The coordinator holds the session mutex, as every writer does through `with_open`, and **no path
lock**. Each save takes and releases its file's lock inside `save_document`.
`no_path_lock_is_held_around_a_save` proves it: at every hand-over a second thread takes and drops
every file's write lock within a bounded wait.

### 3.4 Conflict evidence

A bulk batch names several snippets and no single one, so each save carries `at: None` and
`ReapplyMode::Unsupported`. The bulk outcome reports the conflict's three revisions and not the disk
text or the evidence. The caller re-reads (§5 item 2).

## 4. Acceptance clauses and the tests that pin them

| Clause | Test(s) |
|---|---|
| Several matches and absent options share one save per file | `several_matches_and_absent_options_share_one_save_per_file` (`src-tauri/src/commands/bulk_check.rs`: exactly one save per file, in order, with both options in both snippets); `several_snippets_and_absent_options_become_one_batch` (`crates/espansoconfig-core/tests/draft_bulk.rs`); `the_bulk_option_edit_is_reachable_and_accounts_for_each_file` (`dispatch_check.rs`) |
| A preflight blocker writes nothing | `a_preflight_blocker_writes_nothing` (a stale base revision and an empty selection: the valid file is `notAttempted`, no save runs, bytes unchanged, no backup directory); `a_suspicion_is_refused_per_file_until_that_candidate_is_consented_to` (a refusal and a stale consent in the preflight write nothing) |
| An injected second-file failure keeps the first file's success and reports it | `an_injected_second_file_failure_keeps_the_first_files_success` (`saved`, `failed`, `notAttempted`; the first file's bytes and backup stand; `nothing_written: false` on the wire) |
| An uncertain write stops later attempts | `an_uncertain_write_stops_later_attempts` (one attempt only, `writeOutcomeUnknown` then `notAttempted` ×2, `nothing_written: false`) |
| Each file's actual backup or no-op result is visible | `each_files_actual_backup_or_no_op_result_is_visible` (`backup_taken: true` for the first save; `alreadyUnchanged` with no copy in the batch; a second bulk save in the session reports `backup_taken: false`) |
| Review fix: boolean options written as plain source | `inserting_absent_options_writes_plain_true_and_false`, `replacing_existing_options_writes_plain_true_and_false`, `a_text_that_is_not_one_plain_scalar_is_refused_rather_than_quoted`, `the_engine_refuses_plain_source_that_does_not_read_back` (`tests/draft_bulk.rs`); `bulk_booleans_are_written_as_plain_source_and_an_ineligible_spelling_writes_nothing` (`bulk_check.rs`) |
| Review fix: consent bound to document, base revision, intent and candidate | `consent_from_one_file_replayed_on_another_is_refused`, `consent_for_an_earlier_base_revision_is_refused`, `consent_for_a_different_intent_is_refused_even_for_the_same_candidate` (`bulk_check.rs`) |
| No `force` flag, and no path lock held around `run_one_save` | `there_is_no_force_flag_on_the_wire`, `only_the_seven_options_and_no_force_flag_deserialize`, `the_bulk_request_declares_exactly_what_rust_reads`, `sends a bulk option edit as one request…` (`commands.test.ts`); `no_path_lock_is_held_around_a_save` |

Also added: `a_conflict_under_the_lock_stops_the_run_and_keeps_earlier_commits`,
`a_malformed_request_is_refused_before_any_file_is_read`,
`an_excluded_file_is_accounted_for_and_untouched`, the core refusal and preflight tests in
`tests/draft_bulk.rs`, three wire-contract tests over the bulk unions, outcomes, result and
request, and `src/lib/i18n/bulkCodes.test.ts`. The last checks that every accessor renders a
finished sentence in both languages, and that only `blocked` and `consentStale`, which only a
preflight produces, say that no file was written.

## 5. Open items

1. **The single-match editor still quotes option values** (`save_match` → `plan_match_edits` →
   the codec writes `word: 'true'`; 3-1 recorded the spelling). Bulk edit no longer does (§7), but
   the 3-5 option controls do, and the review found that espanso reads a quoted `'true'` as a string
   where it expects a boolean. It was not fixed here, per the review's instruction. A later phase
   can move the nine option controls onto `ScalarEdit::plain_source` /
   `EntryValue::PlainSource`.
2. `conflicted` carries revisions only, not the disk text, the projection or the reapply evidence.
   3-11 decides whether it needs more than a re-read.
3. `excluded` is the caller's claim. The backend echoes each document as `excludedBeforeApply`
   without resolving it, and refuses only a document that is both applied and excluded, or excluded
   twice.
4. Findings are whole-document, as for every save. A file that already holds a suspicion anywhere
   needs consent for a bulk edit too.
5. Seen on the way and not touched: the `Open::backups` field doc in `commands.rs` still names
   `move_match`/`save_match` as the only savers, `with_open`'s doc says "the six methods that write",
   and `dictionary_contract.rs`'s header says "the other thirty-three enumerations". All three were
   already stale before this phase.
6. No browser model, `BrowserCommands` member or component calls `applyBulkOptions` yet. That is
   3-11's.

## 6. New Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

| Key | Producer |
|---|---|
| `code.commandError.bulkRefused` (1, new) | `describeCommandError` (`CommandError::BulkRefused`) |
| `code.bulkPlanError.{noOptionChanges, optionRepeated, optionNotPlainSource, noFiles, documentRepeated, noMatches, matchRepeated, identity, draft}` (9, new) | `describeBulkPlanError` / `tBulkPlanError` |
| `code.verificationFailure.plainSourceNotReadBack` (1, new) | `describeVerificationFailure` |
| `code.bulkFileOutcome.{saved, alreadyUnchanged, conflicted, refused, consentStale, blocked, failed, writeOutcomeUnknown, notAttempted, excludedBeforeApply}` (10, new) | `describeBulkFileOutcome` / `tBulkFileOutcome` |

## 7. Review fixes

The phase review (`docs/reviews/phase-3-10.md`, Codex, ship-with-fixes) named one blocker and one
should-fix item. Both were fixed in the files named, and every gate was re-run (§8).

1. **Blocker: boolean options were written as YAML strings** (`draft/bulk.rs`). Delegating to the
   string-valued planner turned `Set("true")` into `word: 'true'`. First the 3-5 single-match
   options editor was checked: it goes through the same planner and codec, so it has no verbatim
   path to reuse, and it also quotes (§5 item 1, not fixed there). The fix adds a plain-source mode
   to the engine:
   - `ScalarEdit::plain_source(path, text)` and `EntryValue::PlainSource(text)` write the text
     verbatim as a plain scalar (`patch/edit.rs`).
   - Verification requires the candidate's scalar to be **plain** and its bytes to be **exactly** that
     text. Anything else is the new `VerificationFailure::PlainSourceNotReadBack`.
   - Written plain-source nodes are exempt from the ambiguous-plain-scalar property. The raw-item edit
     takes the same stance: a person authored those bytes and no emitter chose them. Every other node
     is charged as before. A `PlainSource` field in a new item is rendered verbatim but not exempted,
     and a shape switch refuses one.

   The planner (`plan_bulk_option_edits`) now takes the source text and compares by **source
   spelling**. An option already written as exactly that plain text derives nothing. An option with
   the same decoded text in another spelling (`'true'`) is rewritten in place. Everything else goes
   through `plan_match_edits` and is converted to plain source. `check_bulk_changes` refuses any text
   that `is_plain_source` rejects, with the typed, i18n'd `BulkPlanError::OptionNotPlainSource`,
   before any file is read. `is_plain_source` asks the parser whether the text is exactly one plain
   scalar after a key; quotes, comments, line breaks, indicators, anchors, tags and aliases all fail
   it. The draft_bulk assertion that pinned `'true'` now pins `true`.
2. **Should-fix: consent was bound to resulting bytes only** (`commands.rs`). `BulkConsent` now
   carries `document`, `base_revision` and `intent`, where `intent` is `bulk_intent`, a
   length-prefixed digest of the document, the base revision, the ordered selection and the ordered
   changes. The preflight compares all of them beside the candidate. The exact findings multiset is
   still the save gate's. `Refused` reports `intent`, and `ConsentStale` now carries the `intent` and
   `candidate` a fresh consent must name instead of the stale `consented` revision.

Open items noticed while fixing, continuing §5's list (not fixed):

6. A `PlainSource` text is accepted when it parses as one plain scalar in the probe's block
   context. The real value's context (for example inside a flow mapping) is only re-checked by the
   engine's read-back, which refuses rather than writes.
7. `bulk_intent` covers the selection's `MatchId`s, which already carry the base revision. It does
   not cover the excluded list, so excluding a different file does not invalidate another file's
   consent. That is deliberate (exclusions write nothing), but it is a choice a review may want
   stated differently.

## 8. Verification

Every command below was run by this worker and exited 0. Output went to files under `/private/tmp`,
which were then searched.

- `cargo build --workspace`
- `cargo test --workspace -- --test-threads=1`: **1499 passed**, 0 failed (+34 over the previous
  rung: 14 core, 15 `bulk_check`, 4 `wire_contract`, 1 `dispatch_check`)
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo fmt --check`
- `cargo tree -p espansoconfig-core | rg tauri`: no match
- `npm run check`: **475 files**, 0 errors, 0 warnings (+1, `bulkCodes.test.ts`)
- `npm test`: **3833 passed**
- `npm run build`: **207 modules** (unchanged: no new production module is imported by the app yet)
- Bundle oracle: the server-only markers are absent, and the client-only markers are present (2).

Rung **`1499 / 475 / 3833 / 207`** after the review fixes (previous `1465 / 474 / 3824 / 207`).
