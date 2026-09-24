# Phase 3-13-2 — Display names and creation defaults: the components and the i18n

**Spec:** `docs/decisions/3-split-notes.md` §2 step "3-13" and its addendum of 2026-09-24 (the
3-13-1 / 3-13-2 / 3-13-3 cut); ruling 28. The model this draws is `docs/decisions/3-13-1-notes.md`
(§6 item 1 is this phase's brief).
**Risk:** high. **Components, i18n and mounted tests.** 3-13-3 owns the window half.

No window reading was performed or claimed.

---

## 1. What changed, and why

### 1.1 The sidebar (`Sidebar.svelte`, `workspace.svelte.ts`, `sidebar.ts`)

- Each row draws `fileLabelOf(browser.preferences, row.document)`: a display name is drawn as a
  `.displayName` line **above the real path**, which stays in the row as `.path`; a file with no name
  draws its path as before. The name is user data, never translated, and its spaces are kept
  (`white-space: pre-wrap`).
- **The order is the model's.** `BrowserState.sidebar` now hands `buildSidebar`
  `orderedDocuments(documents, preferences)` (3-13-1 D3: ranked first, ascending; ties and unranked
  files in workspace order), so each group keeps that order. `buildSidebar` itself still never
  reorders; the sentences in `sidebar.ts` and on `BrowserState.sidebar` that said "path order" were
  edited in place.

### 1.2 The new-snippet form (`MatchCreator.svelte`, `DetailPane.svelte`)

- New **required** prop `defaults: () => CreationDefaults`; `DetailPane.svelte` hands
  `() => browser.creationDefaults()`. It is read at both `startMatchCreation` calls (mount and *Add
  another*) and never again, so the form keeps 3-13-1's snapshot (D5).
- An **Options** block draws all seven `view.options`, each as a textual control — never a checkbox
  (D2u): a present value is an `<input type="text">` (or, when it holds a line break, a read-only
  `SourceText` rendering); an absent one says the key will not be written and offers *Add this
  option* (which sets `''`); an empty one says the key will be written with no value; *Remove* is
  `removeCreationOption`; the option's exact suggestions are buttons that set that text. A seeded
  option carries a *From this file's defaults* mark.
- Above the options, `seedingNoticeOf(view)` says which file's defaults were filled in, which options
  kept a value already in the draft (`kept`), and which default was withheld (`withheld`, through
  `tDefaultRefusal`).
- A sentence under the options discloses the `<input>` normalisation (see §2 D4).

### 1.3 The preferences control (`FilePreferences.svelte`, new; `SnippetList.svelte`)

- Mounted in the list pane under `FileScope`, only when the sidebar selects one file, from that
  file's **listed summary** (`preferencesTargetOf`, since the review fix in §9), inside
  `{#key target.id}` so a draft never survives into another file's control. It starts collapsed
  behind *File preferences*.
- Expanded: the file's path in the heading, a sentence that no espanso file is changed, how the
  sidecar was read, a display-name box, and — for a snippet file only — the seven defaults with the
  creator's absent / box / shown / empty rules, *Add a default*, *Remove the default* and the
  suggestions. *Save preferences* sends **one** `BrowserState.updatePreferences` call with every
  change, so it joins the window's single serial queue of sidecar reads and updates.
- Read and save lines are drawn through the 3-13-1 reactive wrappers: `tSidecarStatus`,
  `tSidecarUpdateOutcome`, `tWithdrawnPreferenceSave`, `tDisplayNameRefusal`, `tDefaultRefusal`, and
  `tIpcFailure` for a failed call.

### 1.4 The model (`src/lib/browser/preferencesControl.ts`, new)

Values and pure functions only: `preferenceTextControlOf`, `defaultsApplyTo`, `PreferencesDraft` with
`startPreferencesDraft` / `editDraftName` / `editDraftDefault` / `removeDraftDefault` /
`followPreferences`, `preferencesPlanOf`, `preferencesTargetOf` (§9), `defaultControlsOf`, `preferencesEditable`,
`preferencesReadingLineOf`, `preferenceSaveLinesOf`, `seedingNoticeOf`. `preferences.ts`'s module
header sentence "3-13-2 draws them" was edited in place.

### 1.5 i18n

34 keys, EN and ES: eleven `browser.matchCreation.*` (the options block and the seeding notice) and
twenty-three `browser.filePreferences.*` (the control). Every one is rendered through `t('…')` with a
literal key or through an existing typed accessor; no key is built.

### 1.6 Tests

- `src/lib/components/MatchCreator.test.ts`: `mountCreator` takes a fifth argument (the defaults the
  reader answers) and `Mounted` gained `redefault`; new suite "the seeded defaults, drawn — Phase
  3-13-2" (11 cases).
- `src/lib/components/FilePreferences.test.ts` (new, mounted, `invokeZero`, 26 cases after §9): the
  sidebar, the control, creation over a real `BrowserState`, and the §9 regression.
- `src/lib/browser/preferencesControl.test.ts` (new, 13 cases after §9).
- `scripts/lint/composition-guards.test.ts`: the new mounted suite added to the inventory.

## 2. Decisions

- **D1 — the display name sits above the path, both in the row.** Never a tooltip, never a
  replacement; the path keeps the row's `.name` span, so the existing wrap rule holds.
- **D2 — the order is applied in `BrowserState.sidebar`, not in the component**, so every reader of
  the sidebar model (the component and its tests) sees one order. `buildSidebar` keeps its
  "order handed in" contract.
- **D3 — the control is a single request per save.** Name and defaults changes go in one
  `update_sidecar` request, in the order name, then defaults in option order. The draft keeps the
  baseline it opened with and asks only for what the person changed, so a value another instance
  saved meanwhile and the person did not touch is left as Rust reloads it (ruling 26).
- **D4 — every new text control is an `<input type="text">`, decided deliberately (`CLAUDE.md` §6).**
  An `<input>` deletes carriage returns and line feeds. So: (a) a value that holds either — a stored
  default or name from a hand edit, or a seeded default holding a line feed — is drawn read-only
  through `SourceText` with only its removal offered (`preferenceTextControlOf` answers `shown`); (b)
  typed text has already lost both characters, and nothing reconstructs one; (c) a sentence beside
  the boxes says what a pasted one becomes. A seeded default holding `\r` never reaches the form
  (3-13-1 D6, `withheld`).
- **D5 — defaults are offered for a snippet file only** (`defaultsApplyTo`: `kind === 'MatchFile'`).
  A profile holds no snippets and a package is never written; both still take a display name.
- **D6 — an untouched draft follows the preferences** (`followPreferences`, run in an effect with the
  draft untracked): a control opened before the first read answered shows the file's values once they
  arrive. A draft with changes keeps them.
- **D7 — the control's editable state is `writable && !saving`**, where *saving* is this control's own
  save or any save the window reports out. A non-writable sidecar (and the time before the first read)
  leaves every control read-only and the save disabled; the reading line says why.
- **D8 — the save result shown is the control's own**, from the promise its call returned, not the
  window-wide `preferenceSave`, so opening the control on another file does not show this file's
  result.
- **D9 — the preferences control does not call `refreshPreferences()` on opening** (3-13-1 §6 item 2
  offered it). D6 would absorb a refresh into an untouched draft, but a refresh under a changed draft
  would need a rebase rule nobody has asked for; left as an open item.

## 3. Deviations

- `SnippetList.svelte` and `DetailPane.svelte` were touched although the cut names only
  `Sidebar.svelte`, `MatchCreator.svelte` and "a preferences control": the control has to be mounted
  somewhere, and the creator's new required prop has to be handed by its host.
- `workspace.svelte.ts` (`BrowserState.sidebar`, D2) and `sidebar.ts` (doc sentences only) were
  touched for the ordering.

## 4. Acceptance, clause by clause

| Clause | Test(s) |
|---|---|
| 1. Sidebar draws display names with the real filename visible, in rank order | `FilePreferences.test.ts` "the sidebar with preferences, in en/es": `draws a display name with the real path beside it, …`; `orders the rows by rank: …`; `keeps the workspace order and plain paths while the sidecar is corrupt` |
| 2a. Every seeded default drawn before Create | `MatchCreator.test.ts`: `draws every seeded default before Add, marked as seeded, and sends exactly those`; `draws the options and the seeding notice in en/es` |
| 2b. Removing one suppresses its key | `suppresses the key of a removed default, and only that key` |
| 2c. Empty ≠ absent | `keeps empty apart from absent: an empty value is said and sent, an absent one is not` |
| 2d. A later preference change does not touch an open draft | `does not touch an open draft when the preferences change, and the next form sees them` |
| 2e. Recovery values never overridden | `never replaces a value already in the draft, and says so`; `recovers exactly the options the draft held, never the file’s defaults again` |
| 2f. Textual controls, line breaks | `puts a suggestion into an option as its exact text`; `draws a default holding a line feed read-only, and names one withheld for a carriage return`; the checkbox count is asserted zero in the first case |
| 3a. The control sets name and defaults through the serial queue | `FilePreferences.test.ts`: `sets a display name and the defaults in one request through the queue, behind a read still out` (the update is not sent while a refresh is out, and is sent after it settles); `clears a name emptied by the person, and removes a default as a clear` |
| 3b. Sidecar save/corruption codes drawn via the wrappers | `says how the sidecar read (…) and is editable only when writable` (five statuses); `says a failed read and stays read-only`; `draws a save refused as not writable with its reason`; the saved outcome in 3a |
| 3c. Absent/corrupt sidecar leaves creation working | `creates with no seeded option when the sidecar is corrupt, set aside / corrupt, left in place / absent / unreachable`; `MatchCreator.test.ts`: `creates with no option key at all when there are no defaults — the absent sidecar` |
| 4. EN/ES parity | the existing i18n suites (key parity, placeholder parity) pass; the control and the creator are also drawn in both locales |

## 5. What is not guaranteed

- **Nothing in TypeScript forces a component to obey `preferenceTextControlOf`.** The model answers
  `shown` for a value with a line break; the two mounted suites check that the creator and the control
  draw such a value without a box, in the cases they run.
- **Nothing forces a host to hand the live defaults.** `MatchCreator`'s `defaults` prop is required, so
  a host must hand *something*; `DetailPane.svelte` hands `browser.creationDefaults()`, and an empty map
  would compile and seed nothing.
- **jsdom is not WebKit.** The mounted suites prove the nodes and the values sent; whether the long
  display name wraps well, and whether WKWebView's `<input>` strips a pasted line break exactly as
  stated, is 3-13-3's window reading. The `<input>` claim for a carriage return rests on the measured
  2c-2-2 reading; for a line feed it rests on the HTML value-sanitisation rule and has not been
  measured in this application's window.
- **The draft survives a re-read of its file, not a change of selection or an `open()`** (§9): both
  of those end the control, and its unsaved draft with it, on purpose and without asking.
- **The control's draft is as fresh as the last read.** It follows the preferences only while
  untouched (D6); a changed draft keeps its baseline, and nothing refreshes the preferences except
  `open()` (3-13-1 §5).
- **The saving guard is per control plus the window's `preferenceSave`.** The queue, not the control,
  is what serialises requests; the disabled button is a courtesy against double presses.
- **The mounted order test reads the files group only.** Profiles and packages go through the same
  `orderedDocuments` call and are not separately asserted.

## 6. Open items (noticed, not fixed here)

1. **The creator's destination list still shows only paths**, not display names. Showing the name
   there too (with the path) would be consistent; not in this phase's acceptance.
2. **No control sets `sortOrder`.** The model has `reorderRequests` (3-13-1) and the sidebar applies
   the order, but nothing on screen writes a rank yet; a reorder control is a later phase's.
3. **Nothing refreshes the preferences except `open()`** (carried from 3-13-1 §6 item 2; D9).
4. Carried: 3-13-1 §6 items 4 and 5.

## 7. New Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

Thirty-four sentences were added, and none was changed.

| Key | Producer |
|---|---|
| `browser.matchCreation.optionsHeading` | `MatchCreator.svelte` |
| `browser.matchCreation.seededFrom` | `MatchCreator.svelte` (`seedingNoticeOf`) |
| `browser.matchCreation.defaultKept` | `MatchCreator.svelte` (`seedingNoticeOf`) |
| `browser.matchCreation.optionSeeded` | `MatchCreator.svelte` |
| `browser.matchCreation.optionAbsent` | `MatchCreator.svelte` |
| `browser.matchCreation.optionEmpty` | `MatchCreator.svelte` |
| `browser.matchCreation.optionShown` | `MatchCreator.svelte` (`preferenceTextControlOf`) |
| `browser.matchCreation.optionValueLabel` | `MatchCreator.svelte` (an `aria-label`) |
| `browser.matchCreation.optionAdd` | `MatchCreator.svelte` |
| `browser.matchCreation.optionRemove` | `MatchCreator.svelte` |
| `browser.matchCreation.lineEndings.options` | `MatchCreator.svelte` |
| `browser.filePreferences.open` | `FilePreferences.svelte` |
| `browser.filePreferences.close` | `FilePreferences.svelte` |
| `browser.filePreferences.label` | `FilePreferences.svelte` (heading and `aria-label`) |
| `browser.filePreferences.appOnly` | `FilePreferences.svelte` |
| `browser.filePreferences.reading` | `FilePreferences.svelte` (`preferencesReadingLineOf`) |
| `browser.filePreferences.readFailed` | `FilePreferences.svelte` (`preferencesReadingLineOf`) |
| `browser.filePreferences.displayName` | `FilePreferences.svelte` |
| `browser.filePreferences.displayNameHint` | `FilePreferences.svelte` |
| `browser.filePreferences.displayNameShown` | `FilePreferences.svelte` (`preferenceTextControlOf`) |
| `browser.filePreferences.clearName` | `FilePreferences.svelte` |
| `browser.filePreferences.defaultsHeading` | `FilePreferences.svelte` |
| `browser.filePreferences.defaultsHint` | `FilePreferences.svelte` |
| `browser.filePreferences.defaultsNotApplicable` | `FilePreferences.svelte` (`defaultsApplyTo`) |
| `browser.filePreferences.noDefault` | `FilePreferences.svelte` |
| `browser.filePreferences.emptyDefault` | `FilePreferences.svelte` |
| `browser.filePreferences.shownDefault` | `FilePreferences.svelte` (`preferenceTextControlOf`) |
| `browser.filePreferences.valueLabel` | `FilePreferences.svelte` (an `aria-label`) |
| `browser.filePreferences.addDefault` | `FilePreferences.svelte` |
| `browser.filePreferences.removeDefault` | `FilePreferences.svelte` |
| `browser.filePreferences.suggestions` | `FilePreferences.svelte` |
| `browser.filePreferences.lineEndings` | `FilePreferences.svelte` |
| `browser.filePreferences.save` | `FilePreferences.svelte` |
| `browser.filePreferences.saving` | `FilePreferences.svelte` (`preferenceSaveLinesOf`) |

## 8. Verification

Each command was run from the repository root with its output redirected to a file under `/tmp/`,
which was then searched.

- `cargo test --workspace -- --test-threads=1`: exit 0, **1534 passed** (no Rust change).
- `cargo clippy --workspace --all-targets -- -D warnings`: exit 0. `cargo fmt --check`: exit 0.
- `npm run check`: exit 0, **487 files**, 0 errors, 0 warnings (+4: `preferencesControl.ts`,
  `preferencesControl.test.ts`, `FilePreferences.svelte`, `FilePreferences.test.ts`).
- `npm test`: exit 0, **4062 passed** (88 files; +56: 11 `MatchCreator.test.ts`, 25
  `FilePreferences.test.ts`, 12 `preferencesControl.test.ts`, and the per-file scans of the lint suites
  over the new files).
- `npm run build`: exit 0, **214 modules** (+3: `preferencesControl.ts`, and `FilePreferences.svelte`
  with its style). Bundle oracle: the server-only markers are absent; the client-only markers are
  present (2).

**Rung: `1534 / 487 / 4062 / 214`**, against `1534 / 483 / 4006 / 211`.

## 9. Review fixes

The adversarial review (`docs/reviews/phase-3-13-2.md`) found one should-fix item and no blocker.

1. **A whole-file save destroyed an unsaved preferences draft** (`src/lib/components/SnippetList.svelte`).
   The control was mounted inside the `browser.scopedDocument` guard, and a whole-file save retires
   the file's projection (`forgetTheReplacedDocument`) before it awaits the re-read, so
   `scopedDocument` became `null`, the control unmounted, and its draft was thrown away without a
   word. **Fix:** the control is mounted from `preferencesTargetOf(browser.selection,
   browser.documents)` in `src/lib/browser/preferencesControl.ts` — the sidebar's selected file looked
   up among the **listed** files, which outlive a re-read — outside the projection guard, still keyed
   by the file's identity. `FileScope` stays under the projection guard. **Tests:**
   `FilePreferences.test.ts`, `survives the projection being retired and read again` (mounts
   `SnippetList` over a real state, drafts a name and a default, runs `saveRawDocument` with the
   re-read held, and checks the draft while the projection is retired and after it is read again);
   `preferencesControl.test.ts`, `targets the selected listed file, …`. Mutation check, run once and
   reverted: mounting the control from `scopedDocument` again fails the first.

No other change was made, and nothing further was noticed for §6.

**Verification after the fix** (output redirected to files under `/tmp/` and searched):

- `cargo test --workspace -- --test-threads=1`: exit 0, **1534 passed** (no Rust change).
- `cargo clippy --workspace --all-targets -- -D warnings`: exit 0. `cargo fmt --check`: exit 0.
- `npm run check`: exit 0, **487 files**, 0 errors, 0 warnings.
- `npm test`: exit 0, **4064 passed** (88 files; +2: the two tests above).
- `npm run build`: exit 0, **214 modules**. Bundle oracle: server-only markers absent; client-only
  markers present (2).

**Rung: `1534 / 487 / 4064 / 214`.**
