# Phase 3-13-1 — Display names and visible creation defaults: the model and the coordination

**Spec:** `docs/decisions/3-split-notes.md` §2 step "3-13" and its addendum of 2026-09-24 (the
3-13-1 / 3-13-2 / 3-13-3 cut); §3 rulings 23 and 25–30. The store this stands on is
`docs/decisions/3-12-notes.md` (§3 design, §5 the lock has no timeout, §6 items 2, 3 and 5 decided
here).
**Risk:** high. **Model and coordination only.** 3-13-2 owns `Sidebar.svelte`, `MatchCreator.svelte`,
the preferences control and the mounted tests; 3-13-3 owns the window half.

No window reading was performed or claimed.

---

## 1. What changed, and why

### 1.1 Rust: the two sidecar commands run off the main thread

`load_sidecar` and `update_sidecar` in `src-tauri/src/commands.rs` are now
`#[tauri::command(async)]`. Tauri runs a command declared without `async` on the **main thread**; the
sidecar store's `flock(2)` has **no timeout** (3-12 notes §5), so a second instance stopped while
holding it would have frozen this window's whole event loop. With the attribute Tauri runs the same
synchronous body on its async runtime; no `.await` appears in either body, so the module's rule
against holding a `std::sync` guard across an `.await` still holds. The module header ("Why every
command but two is synchronous") says so. Test:
`wire_contract::the_sidecar_commands_run_off_the_main_thread` parses `commands.rs` with `syn` and
requires the `async` argument on exactly those two of the twenty-two commands and on no other, and no
`async fn` anywhere. Mutation check, run once and reverted: dropping the attribute from
`update_sidecar` fails it. No capability or permission changed.

### 1.2 The preferences model (`src/lib/browser/preferences.ts`, new)

Values and pure functions; it draws nothing.

- **`WorkspacePreferences`** (`reading`, `writable`, `files`, `retainedOrphans`) built by
  `preferencesOf(state)` from a `SidecarState`, copied at ingress and frozen;
  `preferencesReadFailed(failure)` for a call that failed; `NO_PREFERENCES` before any read.
  **Empty is always legal** and means *no preferences*, never an error.
- **Display names:** `fileLabelOf(preferences, summary)` answers `filename { path }` or
  `displayName { name, path }` — the real relative path is in **both** arms.
  `displayNameChanges(draft)` builds the one `SidecarChange`; `isBlankName`.
- **Ordering:** `orderedDocuments(documents, preferences)` and `reorderRequests(order, preferences)`.
- **Defaults:** `FileDefaults` (the seven `BulkOption`s, each `string | null`), `NO_FILE_DEFAULTS`,
  `fileDefaultsOf`, `presentDefaults`, `defaultChanges(current, next)` (`SetDefault` /
  `ClearDefault`, absent and empty kept apart), `isSuggestedDefault` (`===` over
  `bulkSuggestionsFor`), `defaultRefusal` (`carriageReturn`).
- **Creation snapshot:** `CreationDefaults` (a `ReadonlyMap<DocumentId, FileDefaults>`),
  `NO_CREATION_DEFAULTS`, `creationDefaultsOf(preferences)`.
- **Save report:** `PreferenceSaveReport` (`saved` / `unchanged` / `notWritable { status }` /
  `writeFailed` / `failed { failure }` / `withdrawn`) and `preferenceSaveReportOf(answer)`.
- Key builders: `displayNameRefusalKey`, `defaultRefusalKey`, `withdrawnPreferenceSaveKey`.

### 1.3 The creation model (`src/lib/browser/matchCreation.ts`)

- **`CreationBuffers` gained `options: CreationOptions`** (`Readonly<Record<BulkOption, string |
  null>>`, `NO_CREATION_OPTIONS`). The seven options are ordinary drafted values: in the undo
  history, retained by a conflict, compared and copied, reapplied, transferred to recovery (ruling
  23). The type was widened rather than a second one added so that every `CreationBuffers` a
  component names (`MatchCreator.svelte`, `RecoveryPanel.svelte`, `MatchEditor.svelte`) still
  type-checks unchanged — no `.svelte` file changed.
- **`MatchCreationSession` gained `defaults` (the snapshot) and `seeding`** (`CreationSeeding`:
  `pending`, or `seeded { from, seeded, kept, withheld }`).
- `startMatchCreation(documents, views, held, clock, defaults = NO_CREATION_DEFAULTS)` copies the
  snapshot (a frozen copy of every record, §9) and seeds; `chooseDestination` seeds, including the
  explicit resolution of a destination-less form's external conflict when it drops the conflict
  (§9); **`seedDefaults(session)`** is the rule (§2 D4–D7).
- `editCreationOption(session, option, text)` (typing coalesces per option; `\r` refused),
  `removeCreationOption(session, option)` (its own step; the key goes). `focus` / `group` widened to
  `CreationTypingField = CreationField | BulkOption`.
- `newMatchOf` spreads in every present option and no absent one; `capturedTexts` and
  `creationRefusal` check the options' text for `\r` too.
- `MatchCreationView` gained `options: CreationOptionView[]` (option, detail label, value, `seeded`,
  exact suggestions) and `seeding`; `retainedDraft` lists every present option after the two fields,
  `setting`, so conflict compare and *Copy draft* carry them.
- Sentences this invalidated were edited in place (the module header's "no absent key in this form",
  the reapply and copy paragraphs, the `retainedDraft` field doc).

### 1.4 Recovery (`src/lib/browser/recovery.ts`)

- `transferOfCreationDraft` carries each option the creator's retained draft held (`carried` with
  its exact text, `''` included) and `notInTheFile` for an absent one. Recovery reads **no**
  preference: nothing in `recovery.ts` imports `./preferences`.
- The recovery form's own buffers hold `NO_CREATION_OPTIONS` and never read them;
  `newMatchOfRecovery` takes options from the transfer, as before. `withField` keeps the options.

### 1.5 The coordination (`src/lib/browser/workspace.svelte.ts`)

- `BrowserCommands` gained `loadSidecar` and `updateSidecar` (required; `REAL_COMMANDS` binds the
  3-12 wrappers). The count of members that can change a user file stays eight, and the interface
  doc says why.
- `BrowserState` gained `preferences`, `preferenceSave` (`idle` / `saving` / `ended { report }`),
  `refreshPreferences()`, `updatePreferences(document, changes)` and `creationDefaults()`.
- **`open()`** resets the three to empty, drops the in-flight read handle and starts a fresh
  preference queue, then — right after the listed rows are published — calls `void state.refreshPreferences()`,
  **never awaited**.
- Reads and updates share **one queue** (`enqueuePreferenceRequest`, §9): each request is sent only
  after every earlier one has settled, and an idle queue sends at once. `refreshPreferences` joins a
  read still queued or out unless an update has been queued behind it; `updatePreferences` copies
  the changes before any await. Both **never reject**: a failed or throwing call is
  reported through the state's `report` and becomes empty preferences (read) or a `failed` report
  (update). `installPreferences` drops an answer asked under a replaced workspace, or older than the
  one installed; since the queue, send order is the order Rust serves them in.

### 1.6 i18n

- `src/lib/i18n/{en,es}.json`: three keys each, `browser.sidecar.displayNameRefusal.lineBreak`,
  `browser.sidecar.defaultRefusal.carriageReturn`, `browser.sidecar.saveWithdrawn`.
- `codes.ts`: `describeDisplayNameRefusal`, `describeDefaultRefusal`,
  `describeWithdrawnPreferenceSave`.
- `index.ts`: the reactive wrappers `tSidecarStatus` and `tSidecarUpdateOutcome` (3-12 notes §6 item
  5), `tDisplayNameRefusal`, `tDefaultRefusal`, `tWithdrawnPreferenceSave`.

### 1.7 Tests and test-only fixes

- New: `src/lib/browser/creationDefaults.test.ts` (30 cases, one group per acceptance clause, plus
  the seeding rule and the conflict path; 33 after §9), `src/lib/browser/preferences.test.ts` (19),
  `workspace.test.ts` +14 (+15 after §9) (one suite, "the application preferences — Phase 3-13-1"; `Script` gained
  `sidecarLoads` / `sidecarUpdates`).
- Rust: `wire_contract.rs` +1 (§1.1).
- **Test-only fixes, no `.svelte` file changed:** the `BrowserCommands` literals in
  `src/lib/components/{DetailPane,MatchDeleter,MatchDuplicator,MatchMover,RestorePane}.test.ts`
  gained two refusing stubs; `{ trigger, replace }` literals in `matchCreation.test.ts`,
  `recovery.test.ts`, `scalarFields.test.ts` and `triggerLists.test.ts` gained
  `options: NO_CREATION_OPTIONS`; **`AppShell.test.ts`** declares the new `load_sidecar` call in every
  route that lists files (the file pins the exact `invoke` sequence of the real composition), answers
  it with a fresh empty sidecar, and each `invoke` count after an open rose by one.

## 2. Decisions

- **D1 — an empty or whitespace-only display name is no name** (3-12 §6 item 2). A blank draft becomes
  `ClearDisplayName`, never `SetDisplayName("")`; a stored blank name (hand edit, another build) reads
  as `null`, so the row shows its filename instead of a blank label.
- **D2 — whitespace is kept as written.** A name with any non-whitespace character is stored and
  returned byte for byte; trimming would decide for the person. A name holding `\n` or `\r` is refused
  (`lineBreak`): an `<input>` cannot hold one, and a label that breaks would push the filename away.
- **D3 — `sortOrder` is a rank** (3-12 §6 item 3). Ranked files first, ascending; ties in workspace
  (discovery) order; unranked files after, in workspace order — so a newly added file appears after
  every ranked one and no stored value has to be rewritten when files come and go. Writes are dense
  (0…n-1 over the files handed) and ask only for the ranks that move; since `update_sidecar` names one
  file, N moved ranks are N requests, and a sequence cut short still sorts deterministically.
- **D4 — seeding happens once per form**, at the first moment the form accepts changes and names an
  **eligible** destination that has at least one default in the form's snapshot. An ineligible file,
  or one with no defaults, leaves it `pending`; after it has seeded, changing the destination neither
  re-seeds nor removes anything.
- **D5 — the snapshot is taken when the form opens** (`BrowserState.creationDefaults()` handed to
  `startMatchCreation`, copied there — the map and, since §9, each record's seven values, frozen). A preference changed later reaches the next form only — even a
  destination chosen later in the same form seeds from the snapshot.
- **D6 — a default never overrides a value.** Seeding fills only options the draft holds as absent; an
  option already holding a value (typed, or carried by whatever built the draft) is left as it is and
  listed in `kept`. A default holding `\r` is not seeded and is listed in `withheld`.
- **D7 — where the seeded values land in history.** On a pristine draft (nothing typed, no history) they
  become the draft's starting value, so a form holding only seeded defaults is not dirty and closing
  it asks nothing; on a draft with history they are one ordinary step, so *Undo* takes the seeding
  back whole. Removal is `removeCreationOption`, its own step.
- **D8 — recovery never seeds** (ruling 28, "never override recovery values"). The creator's recovery
  carries exactly the options its retained draft held; the recovery form drafts no option; no
  function in `recovery.ts` takes a defaults snapshot.
- **D9 — the stalling lock** (3-12 §5). Two layers: (a) Rust runs the two commands off the main thread
  (§1.1), which is what keeps the *window* responsive — a promise that is merely not awaited in
  TypeScript would not have helped while the main thread was blocked; (b) TypeScript never awaits a
  sidecar call on any path something else waits for (`open()` fires and forgets; creation reads the
  synchronous `creationDefaults()`), and keeps at most one sidecar request of either kind out per
  workspace (one queue for reads and updates, §9; a read joins a queued one), so a stall costs one
  runtime worker thread, not one per click.
- **D10 — "reload before each mutation" is Rust's.** Ruling 26's reload happens inside
  `update_sidecar`, under the lock, immediately before the change; the window adopts the state the
  update answers. The window reads on `open()`; it does not add a second read before each update.
- **D11 — a queued update is withdrawn across `open()`.** A `DocumentId` is session-local, so an update
  still waiting its turn when the workspace is replaced is never sent (`withdrawn`, with a sentence).
- **D12 — `startMatchCreation`'s `defaults` parameter is optional**, defaulting to *no defaults*, so
  `MatchCreator.svelte` (3-13-2's to change) compiles and behaves as before. §5 says what that costs.

## 3. Deviations

- **Rust was touched** (§1.1), in a phase cut as "the model and the coordination". It is the only way
  the lock-stall decision the addendum requires could keep the UI from freezing; it is two attributes,
  one doc paragraph and one contract test.
- **`AppShell.test.ts` was edited** (test-only): the real composition now makes one more `invoke`
  per successful open, and that file exists to pin the exact route.
- **The seven options enter the creation form's draft here**, not only the defaults: ruling 23 makes
  draft retention, compare, reapply and recovery owed in the same step as a newly editable field, and
  a seeded default must be removable. The creator's *content kind* and its other optional fields
  (3-5-2-1 notes §2) are **not** taken here.

## 4. Acceptance, clause by clause

| Clause (3-13, the model's half) | Test(s) |
|---|---|
| Every emitted default was in the draft before *Create*, and removing one suppresses its key | `creationDefaults.test.ts` group 1: `seeds the chosen file’s defaults into the draft the view hands a screen, and sends exactly those`; `suppresses the key of a removed default, and only that key`; `removes an empty default by removal, not by emptying: the key goes`; `sends a seeded value the person then edited as edited, and nothing unseen`; `never sends paragraph or anchor, which are not creation defaults`; `workspace.test.ts`: `asks for the preferences on open and installs them, …` |
| Empty differs from absent | group 2: `seeds an empty default as an empty value and sends the key with it; an absent one sends no key`; `keeps an option set to empty by the person apart from one removed`; `reads a sidecar entry’s empty default as empty and a missing one as absent`; `keeps every default as text: …`; `preferences.test.ts`: `keeps absent and empty apart at ingress, …`, `turns absent → empty into a set and empty → absent into a clear, …` |
| A later preference change does not touch an open draft | group 3: `keeps the snapshot it was opened with when the caller’s map changes afterwards`; `seeds once: changing the destination afterwards neither re-seeds nor takes a seeded value back`; `workspace.test.ts`: `does not touch an open creation draft when a preference changes later` |
| Recovery values are never overridden | group 4: `never seeds over an option the draft already holds, and lists it as kept`; `recovers a creator’s conflicted draft with exactly its own options, whatever the destination’s defaults`; `keeps the retained options through a reapply to the disk version, unseeded again`. Mutation check, run once and reverted: letting `seedDefaults` fill a held option fails the first |
| An absent or corrupt sidecar leaves creation working | group 5 (all seven non-`Loaded` statuses, a failed read, no snapshot at all); `workspace.test.ts`: `reaches ready and creates while a stalled read never answers`; `leaves creation working with no defaults over a sidecar that is …` (seven statuses); `leaves creation working when the read fails or throws, reporting it and rejecting nothing` |
| A failed save of preferences is a code, never thrown into creation | `workspace.test.ts`: `reports every failed preference save as a value, never a rejection, and changes nothing else`; `sends updates one at a time, copies the changes, and withdraws one queued across open()`; `discards a read answered after open() replaced the workspace it was asked about`; `preferences.test.ts`: `maps every outcome to a report, …` |
| Real filename always beside a display name; D1–D3 | `preferences.test.ts` groups "display names" and "ordering" |
| Ruling 23 for the options (retention, compare, copy, reapply, recovery) | `creationDefaults.test.ts`: `retains, lists and copies every option the draft held, …`, and group 4's reapply and recovery cases |
| Sidecar commands off the main thread (D9) | `wire_contract::the_sidecar_commands_run_off_the_main_thread` |

## 5. What is not guaranteed

- **Nothing forces a caller to pass the live defaults.** `startMatchCreation`'s `defaults` is optional
  (D12); a caller that omits it gets a form that seeds nothing. `MatchCreator.svelte` omits it today —
  so **no default is seeded in the running application until 3-13-2 passes
  `browser.creationDefaults()`**.
- **Nothing forces a component to show `view.options`.** "Every emitted default was on screen" is, in
  this phase, a statement about the model's view value; whether a screen draws it is 3-13-2's and a
  window reading's (3-13-3).
- **The off-main-thread claim is about the declaration.** The contract test reads the attribute; it
  does not observe which thread Tauri uses. A stalled call still waits forever and holds one runtime
  worker thread while it does; the lock itself still has no timeout (3-12 §6 item 8).
- **Answer ordering is by send order, and send order is serve order within one window.** Since §9
  no two of this window's sidecar requests overlap, so `installPreferences`' newer-*sent* rule matches
  the order Rust served them in. What it cannot see is **another instance** writing between two of
  them; the next read corrects that, and there is no watcher (ruling 26).
- **A stalled request holds every later read and update of the same workspace** (they queue behind
  it), and their promises do not settle until it does; `open()` starts a fresh queue, so a request of
  the replaced workspace still out may overlap the new workspace's first one (its answer is
  discarded by the open generation).
- **`updatePreferences` checks the open generation before sending, not Rust's session.** Rust's
  `open_workspace` and a sidecar command can now run concurrently (one on the main thread, one on the
  runtime), so an update sent just before a replacement in Rust could resolve its `DocumentId` in the
  new session. The browser-side check closes the window it can see.
- **The snapshot is as fresh as the last read.** Another instance's change is seen only after this
  window's next `open()` or `refreshPreferences()` (no watcher).
- `CreationBuffers.options` on the recovery form is always `NO_CREATION_OPTIONS`; nothing in the type
  stops a caller from building a recovery draft that holds options, and `newMatchOfRecovery` would
  ignore them.

## 6. Open items (noticed, not fixed here)

1. **3-13-2 must pass `browser.creationDefaults()` to `startMatchCreation`** in both of
   `MatchCreator.svelte`'s calls, draw `view.options` / `view.seeding` (a removable control per
   present option, the file the defaults came from, the withheld ones via `tDefaultRefusal`), and
   draw `fileLabelOf` / `orderedDocuments` in `Sidebar.svelte`.
2. **Nothing refreshes the preferences except `open()`.** 3-13-2 may call `refreshPreferences()` when
   the preferences control opens.
3. **The sidebar model does not apply the order yet** (`buildSidebar` in `./sidebar.ts` is
   unchanged); `orderedDocuments` is ready for 3-13-2 to use.
4. **The creator's content kind and its other optional fields** (label, comment, `paragraph`,
   `anchor`, trigger forms, `search_terms`) remain unauthored (3-5-2-1 notes §2).
5. Carried: 3-12 notes §6 items 1, 4, 6–9 (item 8, a bounded lock wait, would make D9's residue go
   away).

## 7. New Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

Three sentences were added, and none was changed.

| Key | Producer |
|---|---|
| `browser.sidecar.displayNameRefusal.lineBreak` | `displayNameRefusalKey` / `describeDisplayNameRefusal` / `tDisplayNameRefusal` |
| `browser.sidecar.defaultRefusal.carriageReturn` | `defaultRefusalKey` / `describeDefaultRefusal` / `tDefaultRefusal` |
| `browser.sidecar.saveWithdrawn` | `withdrawnPreferenceSaveKey` / `describeWithdrawnPreferenceSave` / `tWithdrawnPreferenceSave` |

## 8. Verification

Each command below was run from the repository root with its output redirected to a file under
`/private/tmp/3131/`, which was then searched.

- `cargo test --workspace -- --test-threads=1`: exit 0, **1534 passed** (+1:
  `the_sidecar_commands_run_off_the_main_thread`).
- `cargo clippy --workspace --all-targets -- -D warnings`: exit 0.
- `cargo fmt --check`: exit 0.
- `cargo tree -p espansoconfig-core | rg tauri`: nothing found.
- `npm run check`: exit 0, **483 files**, 0 errors, 0 warnings (+3: `preferences.ts`,
  `preferences.test.ts`, `creationDefaults.test.ts`).
- `npm test`: exit 0, **4002 passed** (86 files; +66: 30 `creationDefaults.test.ts`, 19
  `preferences.test.ts`, 14 `workspace.test.ts`, and 3 from `scripts/lint/ipc-detail.test.ts`'s
  per-file scan of the three new files).
- `npm run build`: exit 0, **211 modules** (+1: `preferences.ts`, reached through
  `workspace.svelte.ts`, `matchCreation.ts` and `i18n/codes.ts`). Bundle oracle: the server-only
  markers are absent; the client-only markers are present (2).

**Rung: `1534 / 483 / 4002 / 211`**, against `1533 / 480 / 3936 / 210`.

## 9. Review fixes

The adversarial review (`docs/reviews/phase-3-13-1.md`) found three should-fix items and no blocker.

1. **A later-sent read could serve pre-update values and win** (`workspace.svelte.ts`,
   `installPreferences`). Reads and updates ran independently, so a read sent after an update could
   take Rust's lock first, answer the old values, and install over the update's answer by its higher
   number. **Fix:** one queue for both kinds, `enqueuePreferenceRequest` in
   `src/lib/browser/workspace.svelte.ts`: a request is sent only after every earlier one has settled,
   and is numbered when sent, so send order is serve order. An idle queue sends in the caller's
   synchronous turn, so `open()`'s read keeps its place in the invoke sequence `AppShell.test.ts`
   pins. A read queued before an update is no longer joined by a later refresh. Nothing on the
   creation path awaits a sidecar call, and neither method rejects. **Test:** `workspace.test.ts`,
   `sends a read called while an update is out only after it, so the read never serves pre-update
   values`. Mutation check, run once and reverted: sending every request at once fails it.
2. **The snapshot kept the caller's records** (`matchCreation.ts`, `startMatchCreation`).
   `new Map(defaults)` copied the map only, so changing a caller's mutable record after the form
   opened changed what a later destination seeded. **Fix:** `snapshotDefaults` reads each record's
   seven values once into a new frozen record (a non-string value reads as `null`). **Test:**
   `creationDefaults.test.ts`, `keeps its own copy of every record when the caller changes one of its
   records afterwards`.
3. **Resolving an unrelated external conflict skipped seeding** (`matchCreation.ts`,
   `chooseDestination`). Only the ordinary branch called `seedDefaults`. **Fix:** the explicit
   resolution now passes the resolved form through `seedDefaults` when it drops the conflict; one
   naming the affected file keeps the conflict and seeds nothing. `seedDefaults` still seeds once and
   never over a held value. **Tests:** `creationDefaults.test.ts`, suite "the destination-less form
   resolving an external conflict": `seeds the named file’s defaults when choosing another file drops
   the conflict`; `never seeds over an option the draft already holds when the resolution seeds`.

No other change was made, and nothing further was noticed for §6.

**Verification after the fixes** (output redirected to `/private/tmp/3131f/` and searched):
- `cargo test --workspace -- --test-threads=1`: exit 0, **1534 passed** (no Rust change).
- `cargo clippy --workspace --all-targets -- -D warnings`: exit 0. `cargo fmt --check`: exit 0.
- `npm run check`: exit 0, **483 files**, 0 errors, 0 warnings.
- `npm test`: exit 0, **4006 passed** (+4: 3 `creationDefaults.test.ts`, 1 `workspace.test.ts`).
- `npm run build`: exit 0, **211 modules**. Bundle oracle: server-only markers absent, client-only
  markers present (2).

**Rung: `1534 / 483 / 4006 / 211`.**
