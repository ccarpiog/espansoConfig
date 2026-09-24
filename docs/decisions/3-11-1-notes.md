# Phase 3-11-1 — Bulk selection: the model and the coordination

**Spec:** `docs/decisions/3-split-notes.md` §2 step "3-11" and its addendum of 2026-09-24 (the
3-11-1 / 3-11-2 / 3-11-3 cut); §3 rulings 19–22 and 29–31. The 3-10 command this stands on is in
`docs/decisions/3-10-notes.md` (§3 the wire, §5 open items).
**Risk:** high. **Model and coordination only.** 3-11-2 owns the components, the multi-select in
`SnippetList.svelte` and the mounted tests; 3-11-3 owns the window half.

No window reading was performed or claimed.

---

## 1. What changed, and why

### 1.1 A read-only spelling accessor (core, command, wire)

Ruling 20 makes *Mixed* a comparison of presence and **exact source spelling, sliced in Rust**, and
`ScalarView.text` is decoded. No existing read carried an option's source bytes (`MatchView.options`
holds `ScalarView`s; `match_item_text` hands out a whole snippet), so one was added.

- **Core** (`crates/espansoconfig-core/src/draft/bulk.rs`): `OptionSpelling` (`Absent {}`,
  `Written { source }`, `NotOneScalar {}`), `BulkOptionSpellings` (one field per bulk option, named
  by its espanso key, with `of(option)`), and `option_spellings(source, found)`. A spelling is the
  scalar's own byte span cut out of the snapshot's text with `ByteSpan::slice`. An option written
  but not as one modelled scalar — a collection, an alias, a repeated key (any unknown entry under
  that key) — is `NotOneScalar` and carries no bytes. Re-exported from `draft`.
- **Command** (`src-tauri/src/commands.rs`): `WorkspaceSession::match_option_spellings(id)` over
  `with_workspace` (the same cached source `document_text` serves; resolves the identity through
  `match_by_id`, so a stale one is `identityStaleRevision`) and the thin
  `#[tauri::command] match_option_spellings`. Registered in `main.rs`: the twentieth workspace
  command and the twelfth reader; writers stay eight.
- **Wire** (`src/lib/ipc/types.ts`, `commands.ts`): `OptionSpelling`, `BulkOptionSpellings`,
  `matchOptionSpellings(id)` and its name in `COMMAND_NAMES`.
- **Contracts:** `wire_contract.rs` — the command-list test is now
  `the_registered_commands_are_the_workspace_twenty_and_the_menu_command` (20 / 21, twelve readers,
  the new name asserted a reader), plus `the_option_spellings_declare_exactly_what_rust_writes`
  (interface keys, the three tags against the Rust declaration, each payload).
  `dictionary_contract.rs` — `OptionSpelling` in `NOT_A_CODE` (a value shape; its TypeScript union
  has only object members, so the namespace scan skips it and the exempted list is unchanged).
  `dispatch_check.rs` — the remote-origin sweep attempts the new command (21), and
  `the_option_spelling_reader_is_reachable_and_refuses_a_stale_identity` drives it through the
  real dispatcher, including `identityStaleRevision` after a re-read.
- Module docs whose counts this invalidated were edited in place (`commands.rs`, `main.rs`,
  `dispatch_check.rs`, `commands.ts`, `commands.test.ts`, `draft/mod.rs`).

### 1.2 The bulk model (`src/lib/browser/bulkEdit.ts`, new)

Values and pure functions; it draws nothing.

- **The seven options.** `BULK_OPTIONS` is the only list `bulkChangesOf` reads, so an intent under
  any other key (`paragraph`, `anchor`, a trigger smuggled by a cast) is never sent;
  `setBulkIntent` refuses a non-bulk option at run time as well.
- **Selection and staleness.** `BulkSelection` (identities in selection order, each once, copied on
  entry), `toggleInBulkSelection`, `sameMatchId` (all three fields), `matchKeyOf`.
  `bulkSelectionFreshness(selection, views, reads)` is `stale` when a file's live projection is
  missing, at another revision, or no longer holds the node, or when a spelling read answered
  `identityStaleRevision` (`spellingReadOf` turns that failure into `{ kind: 'stale' }` — handled,
  never unwrapped). Nothing re-resolves a stale identity.
- **Mixed.** `summarizeOption(selection, reads, option)` compares spellings by presence and exact
  bytes: `unknown` / `absent` / `same { source }` / `notOneScalar` / `mixed`. Its only input is the
  Rust spelling read. `bulkControls` puts each summary beside its intent; `showsMixed` is true only
  for an untouched control.
- **Intents and undo.** `BulkDraft { intents, past, future }` with `setBulkIntent`,
  `clearBulkIntent`, `undoBulkDraft`, `redoBulkDraft`, `canUndo…`/`canRedo…`, bounded by
  `HISTORY_LIMIT`. An untouched option is absent from `intents`, so it emits nothing; there is no
  "keep" value. Undo restores the unsaved intents only.
- **Exclusions.** `planBulkApply(selection, views, openDrafts)`: a file with **any** open match
  editor is excluded whole (`documentHasUnsavedDraft` — an open editor, not a dirty one); a snippet
  that is not `safely_editable` or has a blocking hazard is excluded (`readOnly`); a file whose
  every selected snippet is excluded goes into the request's `excluded` list so the answer accounts
  for it.
- **Blockers and the request.** `prepareBulkApply(inputs)` answers `blocked` with every reason
  (`noSelection`, `staleSelection`, `noChanges`, `emptyValue`, `nothingToApply`) or `ready` with a
  `BulkSubmission` (the `BulkOptionsRequest` plus one key per file). Base revisions are the live
  projections'.
- **Consent (ruling 22).** `bulkConsentReview(result)` lists the refused files with their findings
  and whether acknowledging could move the verdict. `acknowledgeBulkRefusal(grants, submission,
  result, document)` is the one producer of a `BulkConsentGrant`: it binds the refusal's exact
  findings (`refusalAcknowledgement`, cloned and frozen) to the file, the base revision sent, and
  the `intent` and `candidate` Rust reported, beside the browser key `bulkFileKey` (document, base
  revision, ordered selection, ordered changes). `prepareBulkApply` attaches a grant only while
  the key matches, so a changed intent or selection drops the consent instead of sending it.
- **Outcomes.** `bulkFileEffect(outcome)` (`committed` / `unchanged` / `uncertain` /
  `nothingWritten`) is what the window's coordination acts on. `summarizeBulkResult(result, plan)`
  counts `saved`, `alreadyUnchanged`, `notWritten` (conflicted, refused, consentStale, blocked,
  failed), `writeOutcomeUnknown`, `notAttempted`, and — separately — `excludedFiles`
  (`excludedBeforeApply`) and `excludedSnippets` (the plan's exclusions). The headline is
  `complete` / `partial` / `uncertain` / `nothingWritten`; a file that was saved never makes it
  `nothingWritten`, and nothing in the summary names an undo.
- Key functions: `bulkExclusionKey`, `bulkBlockerKey`, `optionSummaryKey` (not for `same`, which a
  screen draws as the file's own bytes), `bulkOutcomeHeadlineKey`.

### 1.3 The coordination (`src/lib/browser/workspace.svelte.ts`)

- `BrowserCommands` gained `matchOptionSpellings` and `applyBulkOptions` (required); `REAL_COMMANDS`
  binds the wrappers.
- `BrowserState.matchOptionSpellings(id)` is a reported-and-answered read.
- `BrowserState.applyBulkOptions(request)` is the **eighth writer** on the state. It copies the
  applied documents before any await, answers `notAttempted` when one is not projected, opens ruling
  27's barrier on every applied file (none on an excluded one), sends the request unchanged, records
  every file's settlement before any adoption (`settlementOfBulkEffect`: saved and already unchanged
  end on their revision, write outcome unknown is `uncertain`, the rest wrote nothing), then adopts
  per file through `adoptAfterTheBulkFile` and closes every lease in a `finally`.
  - A **committed** file: `forgetFileText`, then `adoptAfterTheCommit(document, () =>
    reprojectTheReplacedDocument(document))` — the whole-document door: `forgetTheReplacedDocument`
    first (every identity in the file stale, synchronously), the re-read, and the positional,
    checked re-resolution of a held selection (R27).
  - An **already unchanged** file at a revision the window does not project: re-read as an external
    change through the same policy.
  - A **possibly written** file: re-read and not trusted; an exception there is a `failed`
    adoption, not a rejection.
  - A committed file is never reported as an error: an exception while re-reading it is that
    file's `failed` adoption beside the `answered` result (`PROGRESS.md` D2).
  - A command that rejects as a whole (`bulkRefused`, `noWorkspaceOpen`) is `failed` with
    `mayHaveWritten`; the leases settle on it.
- `adoptTheReplacedDocument` was split: its first half is the new `reprojectTheReplacedDocument`
  (forget, re-read, re-resolve), which the bulk path hands to `adoptAfterTheCommit` so the viewer's
  text is not read twice. `saveRawDocument`'s behaviour is unchanged.
- Doc sentences this invalidated were edited in place (the entry-point count, the barrier's callers,
  the settlement mapping). `run_one_save` stays the backend's single writer path; nothing here
  writes around it.

### 1.4 i18n

Fifteen `browser.bulkEdit.*` keys in each language — two exclusions, five blockers, four option
summaries, four headlines — with typed accessors `describeBulkExclusion`, `describeBulkBlocker`,
`describeBulkOptionSummary`, `describeBulkOutcomeHeadline` in `src/lib/i18n/codes.ts` and the
reactive `tBulkExclusion`, `tBulkBlocker`, `tBulkOptionSummary`, `tBulkOutcomeHeadline` in
`index.ts`. No sentence quotes configuration content, promises an undo of a save, or claims unsaved
edits exist. The per-outcome lines reuse 3-10's `describeBulkFileOutcome`.

### 1.5 Tests and compile fixes

- `src/lib/browser/bulkEdit.test.ts` (new, 37 cases), `workspace.test.ts` (+7, and
  `applyBulkOptions` joins `BARRIERED_MEMBERS`, with `filesWrittenThrough` reading a bulk request's
  files so the open-lease audit covers it), `commands.test.ts` (+1, and the wrapper list).
- `crates/espansoconfig-core/tests/draft_bulk.rs` (+3), `wire_contract.rs` (+1),
  `dispatch_check.rs` (+1).
- **Compile fixes only:** the `BrowserCommands` literals in
  `src/lib/components/{DetailPane,MatchDeleter,MatchDuplicator,MatchMover,RestorePane}.test.ts`
  each gained two refusing stubs. No `.svelte` file changed.

## 2. Decisions

- **D1 — one read per snippet, not per selection.** `match_option_spellings(id)` mirrors
  `match_item_text`: one identity, one answer, and the identity refusal is the ordinary code. A
  selection of N snippets costs N reads; a batch accessor can come later if that is slow (§5
  item 5).
- **D2 — `NotOneScalar` is its own state.** Reporting a collection or a repeated key as `Absent`
  would call a written option unset, and reporting its bytes would show a value the projection does
  not model. It compares equal only to itself.
- **D3 — an open editor excludes the whole file.** A committed bulk save invalidates every
  `MatchId` in the file, so an editor over any of its snippets would be stranded (the duplicate's
  rule, consult Q6). It is an exclusion, not a blocker: the other files still apply.
- **D4 — consent keyed twice.** Rust binds consent to document, base revision, intent and
  candidate; the browser additionally keys it to the file's selection and changes so a changed
  request drops consent rather than sending it to come back `consentStale`.
- **D5 — the whole-document doors after a commit.** A bulk commit has no `moved` identity for the
  snippets it touched, like a raw save, so the file is forgotten and re-read exactly as a raw save's
  is. The selection follows R27's positional check.
- **D6 — wording.** The addendum puts "the dictionary keys EN and ES" in 3-11-2 as well; a model
  code with no sentence would be a code no accessor renders (`CLAUDE.md` §2), so the fifteen
  sentences land now and 3-11-2 may revise them.

## 3. Deviations

- The addendum places the dictionary keys in both 3-11-1 and 3-11-2; this phase adds only the keys
  its own values produce (D6). Control labels, counted lines and the consent review's wording are
  3-11-2's.
- `adoptTheReplacedDocument` was split (§1.3); behaviour unchanged, every existing case passes.

## 4. Acceptance, clause by clause

| Clause | Test(s) |
|---|---|
| Only the seven allowed options can be submitted | `names exactly the seven options, in the core’s order`; `refuses to draft an eighth option, and never sends one smuggled into the intents`; `sends the touched options in the fixed order, whatever order they were set in` (`bulkEdit.test.ts`); Rust's `only_the_seven_options_and_no_force_flag_deserialize` (3-10) stands |
| An untouched Mixed control emits nothing; Mixed is exact source spelling from Rust | `shows Mixed on an untouched control, and that control adds nothing to the request`; `stops showing Mixed once the control is touched, and emits exactly that intent`; `calls one decoded text in two spellings Mixed, and the same bytes Same`; `calls presence against absence Mixed, and a missing read Unknown`; `keeps an option not written as one scalar apart from both absent and spelled`; `never compares or sends a decoded text: every summary comes from a Rust spelling`; Rust: `the_spelling_is_cut_in_rust_and_distinguishes_what_decoding_merges`, `an_option_written_but_not_as_one_scalar_is_neither_absent_nor_spelled`, `the_spellings_cross_as_the_seven_keys_with_one_key_variants` (`draft_bulk.rs`), `the_option_spelling_reader_is_reachable_and_refuses_a_stale_identity` (`dispatch_check.rs`), `the_option_spellings_declare_exactly_what_rust_writes` (`wire_contract.rs`) |
| A stale selection blocks | `is stale when a file’s projection moved on, and blocks without re-resolving`; `is stale when a spelling read answered identityStaleRevision, handled rather than unwrapped`; `is stale when the file is no longer projected at all`; `answers a spelling read unchanged, and reports a refusal as well as answering it` (`workspace.test.ts`) |
| Open drafts are respected (excluded) | `excludes every selected snippet of a file with any open editor, and sends the file as excluded`; `counts an editor over an earlier parse of the same file too`; `blocks when every selected snippet is excluded`; `never says unsaved edits exist, in either language`; `opens no lease for an excluded file, …` (`workspace.test.ts`) |
| Exclusions and execution failures are counted separately | `counts excluded files and snippets apart from every execution outcome`; `keeps a committed file saved beside a later failure, and never calls it an error`; `reports an uncertain write as uncertain, …`; `counts a preflight blocker as not written and its siblings as not attempted`; `keeps a committed file’s success beside a later failure, and retires that file’s identities`; `never turns a committed file into an error when re-reading it throws` (`workspace.test.ts`) |
| Draft undo works; no disk batch undo promised | `undoes and redoes the drafted intents, one edit per step`; `adds no step for an edit that changes nothing, …`; `restores an intent the request then carries again, and touches nothing else`; `offers no undo of a save: the draft and the summary name nothing that could` (every `browser.bulkEdit.*` sentence in both languages is checked for undo wording) |
| Consent review over `BulkConsent` (no force flag) | the four cases of the consent suite (`bulkEdit.test.ts`) |
| Workspace coordination after a committed file | `keeps a committed file’s success …` (the selection's identity moves to the new revision, the projection is the re-read one, only that file is re-read, every lease closed); `re-reads a file whose write may have happened, and leaves it marked uncertain`; `answers a request refused as a whole as a failure that wrote nothing, and closes every lease` |

## 5. Open items (noticed, not fixed here)

1. **The selection notice after a bulk commit** uses the external-change sentences
   (`browser.notice.kept` / `differentMatch`: "This file changed on disk…"), because no
   `RepairAttribution` names a bulk edit. A snippet whose options the edit changed is, by bytes, a
   different snippet at that position, so a held selection of it is usually cleared. 3-11-2 decides
   whether a bulk attribution is owed.
2. **A `conflicted` bulk file registers no conflict origin.** It carries revisions only (3-10 §5 item
   2), and `rememberTheSaveConflict` needs a `SaveConflictSource` built from a `ConflictResult`. The
   window relies on the watcher's observation of that file.
3. **No `OpenWriteSurfaceKind` for a bulk edit.** As 3-8-1 found for the snippet editor, adding one
   forces the exhaustive assembly in `DetailPane.svelte`, which is 3-11-2's; until then a restore
   does not see a bulk edit in flight as a competing surface.
4. **The open-editor exclusion counts match editors only**, as `documentHasUnsavedDraft` states; an
   open whole-document raw draft is not counted. 3-11-2 decides whether the inspector refuses while
   the raw editor is open (the eight surfaces are mutually exclusive through `busy` today).
5. **One spelling read per selected snippet** (D1).
6. **Pre-existing stale sentences in `workspace.svelte.ts`**, not touched: the header's "holds the
   twelve", `BrowserCommands`' "a thirteenth member", and `beginWrite`'s "the six call sites".
7. **A `NotOneScalar` option can still be targeted by a bulk intent**; what the planner does with a
   repeated key or a collection is the 3-10 planner's (it refuses or rewrites per `plan_match_edits`);
   the inspector does not warn beside it yet.
8. Carried from 3-10 §5 item 1: the single-match options editor still writes quoted booleans.

## 6. New Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

| Key | Producer |
|---|---|
| `browser.bulkEdit.exclusion.{readOnly, editorOpen}` (2, new) | `bulkExclusionKey` / `describeBulkExclusion` / `tBulkExclusion` |
| `browser.bulkEdit.blocked.{noSelection, staleSelection, noChanges, emptyValue, nothingToApply}` (5, new) | `bulkBlockerKey` / `describeBulkBlocker` / `tBulkBlocker` |
| `browser.bulkEdit.option.{unknown, absent, notOneScalar, mixed}` (4, new) | `optionSummaryKey` / `describeBulkOptionSummary` / `tBulkOptionSummary` |
| `browser.bulkEdit.outcome.{complete, partial, uncertain, nothingWritten}` (4, new) | `bulkOutcomeHeadlineKey` / `describeBulkOutcomeHeadline` / `tBulkOutcomeHeadline` |

## 7. Gates and the rung

Each command below was run by this worker and exited 0. Output went to files under `/private/tmp`,
which were then searched.

- `cargo build --workspace`
- `cargo test --workspace -- --test-threads=1`: 34 `test result` lines, **1504 passed, 0 failed**
  (+5: 3 `draft_bulk`, 1 `wire_contract`, 1 `dispatch_check`)
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo fmt --check`
- `cargo tree -p espansoconfig-core | rg tauri`: no match
- `npm run check`: **477 files**, 0 errors, 0 warnings (+2: `bulkEdit.ts`, `bulkEdit.test.ts`)
- `npm test`: **3880 passed**, 82 files (+47: 37 `bulkEdit.test.ts`, 7 `workspace.test.ts`, 1
  `commands.test.ts`, 2 from the per-file lint scan of the two new files)
- `npm run build`: **208 modules** (+1: `bulkEdit.ts`, reachable through `src/lib/i18n/codes.ts`).
  Bundle oracle: the server-only markers are absent, the client-only markers present (2).

**Rung: `1504 / 477 / 3880 / 208`**, against `1499 / 475 / 3833 / 207`.

## § Review fixes

The phase review (`docs/reviews/phase-3-11-1.md`, Codex, ship-with-fixes) named one blocker and two
should-fix items. Each was fixed in the file it named, with regression tests, and every gate was
re-run (figures below replace §7's).

1. **Blocker — block-scalar headers were not part of the spelling**
   (`crates/espansoconfig-core/src/draft/bulk.rs`). `ScalarView.span` is a block scalar's body only
   (`SyntaxIndex::push_scalar` publishes the layout's content span), so the same body under `|`,
   `>`, `|+` or `|2` compared equal. `option_spellings` now takes the `SourceDocument` and, for a
   block scalar, cuts from the syntax index's `header_span.start` to the body's end, keeping the
   header bytes as written; a flow or plain scalar is unchanged. If the index cannot vouch for the
   envelope the option is `NotOneScalar`. Callers updated (`commands.rs`, `wire_contract.rs`,
   `draft_bulk.rs`). Test: `identical_block_bodies_under_different_headers_are_different_spellings`.
2. **Should-fix — committed files were invalidated one at a time**
   (`src/lib/browser/workspace.svelte.ts`). `applyBulkOptions` now retires every committed file
   (`forgetTheReplacedDocument`) and the viewer's text in one synchronous block before the first
   await, then re-reads each inside `adoptAfterTheCommit`. Test: `retires every committed file
   before the first re-read is awaited` (two committed files, `getDocument` deferred for the first).
3. **Should-fix — a re-read restored an old selection over a newer intent**
   (`workspace.svelte.ts`). The re-read half is now `rereadRetiredDocument(document, held, intent)`,
   which restores the selection and sets its notice only while `selectGeneration` still equals the
   value captured after the forgetting. **`saveRawDocument` is equally corrected**, not unchanged:
   `reprojectTheReplacedDocument` (its path through `adoptTheReplacedDocument`) now calls the same
   guarded re-read. Tests: `does not restore a selection over a newer intent expressed during the
   re-read`, `restores the selection when no newer intent was expressed`, `guards the raw save’s
   re-read the same way`. Removing the guard fails the first and the third.

Rung after the fixes: **`1505 / 477 / 3884 / 208`**.
