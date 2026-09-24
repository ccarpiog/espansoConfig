# Phase 3-8-2 — The local raw UI: the components and the i18n

**Spec:** `docs/decisions/3-split-notes.md` §2 step "3-8" and its addendum of 2026-09-24 (the 3-8-1 /
3-8-2 / 3-8-3 cut); §3 rulings 11, 12, 13 and 30; §4.2. It draws the model 3-8-1 delivered
(`docs/decisions/3-8-1-notes.md`) and answers that record's open items 1-5 that were 3-8-2's, and
3-7's §5 item 2 (the trailing blank line).
**Risk:** high. **Components, detail integration and wording.** 3-8-3 owns the window half.

No window reading was performed or claimed.

Everything below that says a control or sentence is drawn is **mounted jsdom evidence** (ruling 30):
it proves a handler fires and a node is in the DOM, never that a window draws it.

---

## 1. What changed, and why

### 1.1 The snippet text editor (`src/lib/components/RawSnippetEditor.svelte`, new)

A component drawing `rawSnippet.ts`'s values, in the shape of `RawEditor.svelte`.

- **Load.** On start it reads `match_item_text` through its `read` prop, by the identity the pane
  captured, and hands the answer whole to `openRawSnippet`. It draws *Reading this snippet's text…*
  until the read answers, then either the box or the refusal (sentence, the operand through
  `tEditError`/`tIpcFailure`, and the fallback offer when `fallback` is `wholeDocumentEditor`). A
  refused opening draws no box and no save control. No document text and no byte span is held here.
- **Draft and save.** The text area is controlled (`value={view.text}`, `oninput` → `editText`).
  *Undo*, *Redo* and *Save* are disabled from `view.canUndo`, `view.canRedo`, `view.canSave`. A save
  sends `started.match`, the submission's base revision, its exact candidate and
  `acknowledgementOf(submission)`, and settles `MatchSaveAnswer`'s three arms as `MatchEditor.svelte`
  does (`applySave` / `saveCouldNotBeSent`).
- **Refusals and retention.** The refusal-for-findings arm draws the verdict, the findings
  (`tFindingCode`), the stale-findings line and `view.refusalChoices` (*Save anyway* sends consent
  bound to the candidate). A save conflict and an external conflict draw the origin line, the
  revisions and one shared `comparison` snippet: the whole disk file through `SourceText`, the
  unknown-outcome acknowledgement (`SnapshotAcknowledgement`), the reload-unavailable line, the copy
  disclosure and `view.conflictChoices`. The confirmed reload is `reloadTheDiskVersion`; when it
  answers a closed session the component calls `close()` (`closesSurface`).
- **A send that produced no outcome** draws `sendFailed` or `mayHaveWritten` (never "nothing was
  written" for the second), then `view.failureLines` through the four accessors, then — when
  `view.trailingBlankLineRefused` — the trailing-blank-line explanation, and — when `view.fallback`
  is set — the whole-document offer.
- **Uncertain write and reconciliation** (3-8-1 §5 item 3). While `view.needsReconciliation` the
  panel says the snippet must be read again and offers *Read the snippet from the file again*. The
  press asks `identityInWindow(document)` for the snippet the window points at **now**, reads it by
  that identity, and hands the answer to `reconcileWithDisk` over the session installed when the read
  answers (so an edit made meanwhile is the text kept). The four answers are drawn as four sentences:
  `written`, `notWritten`, `diverged`, and `noIdentity` (no snippet of this file is selected; nothing
  is read); a refused read draws its refusal.
- **Stale identity.** `view.identityStale` draws one sentence, worded to be true of both of its causes
  (a commit that answered no identity, and — §2 D1 — a save refused as `identityStaleRevision`).
- **Leaving.** *Stop editing* and the whole-document offer both go through one `requestLeave`: refused
  while a save is held (both controls disabled), a confirmation when the draft is dirty.
- **The receiver** is reported synchronously during initialisation and withdrawn in `onDestroy`,
  `RawEditor.svelte`'s pattern, so the pane's registration effect always finds one.

### 1.2 The model additions (`src/lib/browser/rawSnippet.ts`)

Three values the component needed, kept in the model so no renderer decides them:

- **`saveCouldNotBeSent` sets `identityStale`** for a refusal that is `identityStaleRevision` and wrote
  nothing (`refusedAsStaleIdentity`). §2 D1.
- **`reconcileWithDisk` answers `diverged` when the fresh range starts on another line** than the
  session's (`lines.first`), in addition to the two-text check. §2 D2.
- **`RawSnippetView` gained `failureLines`** (`sendFailureLines` over the failure's reason) and
  **`trailingBlankLineRefused`**: the send's `EditError` is `Verification(ItemTextEscapesTheItem)`
  **and** the submitted candidate ends with a blank line (a line feed ending a line of only spaces and
  tabs, tested by a pattern — the module's no-slicing scan still passes). §2 D3.

The header comments that said the component and the write-surface kind were "3-8-2's" now name them.

### 1.3 The write-surface kind and its registration (3-8-1 §5 item 2)

- `OpenWriteSurfaceKind` gained **`rawSnippetEditor`** (`src/lib/browser/restore.ts`); it joins
  `CompetingWriteSurfaceKind` by exclusion, so `openWriteSurfaceKey` gained
  `browser.restore.refused.rawSnippetEditorOpen`, which claims an open editor and never unsaved edits
  (R36).
- `ReceivingSurfaceKind` and `isReceivingKind` (`src/lib/browser/surfaceReceivers.ts`) list it.
- The count sentences these changes invalidated ("eight kinds", "seven that compete", "a ninth kind")
  were edited in place in `restore.ts`, `surfaceReceivers.ts` and `DetailPane.svelte`.

### 1.4 The detail integration (`src/lib/components/DetailPane.svelte`)

- A captured `SnippetTextSession` (`match` and `file` in one assignment) and an *Edit this snippet's
  text* opener beside the match editor's, offered for any snippet of a writable file — the core's own
  refusal decides the rest and the editor says why (§2 D5).
- The exhaustive assembly has a `rawSnippetEditor` entry; `busy`, `invalidateEverySurface`,
  `unsavedDraftFor` and `openMatchDrafts` count the new session, so a restore sees it as a competing
  surface and `documentHasUnsavedDraft` counts it.
- The mount arm hands it `browser.matchItemText`, `browser.saveMatchItemText`, `selectedIdentityIn`
  (the selected snippet's identity when it is in that file), `adoptDiskVersion`, the receiver binding,
  the acknowledgement port, and `openWholeDocument` — `openWholeDocumentInstead` while
  `browser.fileTextTarget` is this file, `null` otherwise.
- `openWholeDocumentInstead` closes the snippet editor and shows the file's text; the viewer's own
  *Edit this file's text* control, with its own refusals, opens the whole-document editor (§2 D4).

### 1.5 `RawEditor.svelte` and CF-55 (3-8-1 §5 item 1)

`RawEditor.svelte` needed **no change**: since 3-8-1 its *Undo*/*Redo* are disabled from
`view.canUndo`/`view.canRedo`, which are now `canUndoEdit`/`canRedoEdit`. What 3-8-2 owed on this
surface was the mounted test, added to `RawEditor.test.ts`: with a history holding an undo step and a
redo step, a held save draws both disabled, a synthetic click on each leaves the box unchanged, and
*Stop editing* is disabled. The same case exists on the new surface in `RawSnippetEditor.test.ts`.
*Stop editing* drawn dark (CF-55's other half, §4.2) is a window observation and stays 3-8-3's.

### 1.6 i18n (EN and ES)

- The four provisional `browser.rawSnippet.refused.*` sentences are finalized (§3): three reworded,
  `notEditable` kept as written.
- 31 new `browser.rawSnippet.*` keys and `browser.restore.refused.rawSnippetEditorOpen`, each language.
  Every one is rendered by `t()` with a literal key or by `tRawSnippetRefusal`; no key is built.
- Keys shared with the whole-document editor where the sentence is literally true of a snippet:
  `browser.rawEditor.{notes, findings, findingsAreStale, revisionExpected, revisionFound,
  revisionDisk}`; the disk heading is the surface's own (`browser.rawSnippet.diskVersion`, "the whole
  file"), because the draft is a snippet and the disk side is the file.

### 1.7 Tests

- `src/lib/components/RawSnippetEditor.test.ts` (new, 20 cases, jsdom, `invokeZero` guard,
  inventoried in `scripts/lint/composition-guards.test.ts`): load and reading; save gating, the exact
  send and the adopted identity; refusal for findings with consent; save conflict frozen and closed
  only by a confirmed reload; external conflict frozen; leaving; **CF-55**; range refusal and its
  fallback, with and without the pane able to show the file; carriage return at load (both routes, no
  fallback); engine refusal of a range with holes offering the fallback and asking first; the
  trailing blank line, and its absence; the stale-identity refusal; the uncertain write reconciled as
  written, as not written, as diverged (another text; another line) and with no identity; EN and ES.
- `RawEditor.test.ts` (+1): CF-55 under a held save.
- `DetailPane.test.ts` (+4): the `rawSnippetEditor` walk registers and unregisters; the opener reads by
  the captured identity and draws the answer whole; the range refusal's fallback reaches the
  whole-document editor through the pane; the offer is replaced by its sentence when the window points
  at another file. `PaneScript` gained `matchItemText`.
- `rawSnippet.test.ts` (+4): §2 D1, D2, D3 and `failureLines`.
- Kind enumerations extended: `restore.test.ts`, `RestorePane.test.ts`, `writeSurfaceRegistry.test.ts`,
  `restoreCodes.test.ts` (16 refusal keys).
- **Not mounted, deliberately:** the carriage return at the edit door. jsdom normalizes a textarea's
  `\r\n` to `\n` before `input` reaches the handler, as the shipped WKWebView does (`CLAUDE.md` §6), so
  a mounted case would test the DOM; the model suite pins the door.

## 2. Decisions

- **D1 — a save refused as `identityStaleRevision` offers no retry** (3-8-1 §5 item 5, ruled here).
  The same identity sent again is refused the same way, so a retry control would be a control that
  cannot succeed. The session is treated like a commit that left no identity: `identityStale`, box
  read-only, save withdrawn, text kept, one sentence telling the person to reopen the snippet. A send
  that may have written is excluded: its `needsReconciliation` restriction is the stronger one.
  Reconciling a stale identity in place (re-reading by the window's identity, as after an uncertain
  write) was not taken: it would rebase a draft onto a text the session has no claim to have seen.
- **D2 — reconciliation also compares the range's first line.** The text check alone accepts any
  snippet whose text equals the opened or the sent text, and a *Duplicate* is byte-identical by design,
  so an identity naming the duplicate would pass. No byte before the range changes under this session's
  own write, landed or not, so a range that starts elsewhere is not this session's range → `diverged`.
- **D3 — the trailing-blank-line sentence is conditioned on both halves.** `ItemTextEscapesTheItem`
  also covers a comment the file would own, so the explanation is drawn only when the refused text
  really ends with a blank line, and it says that such a text is refused and not trimmed — never that
  the blank line was the only objection. The generic verifier sentence is still drawn beside it.
- **D4 — the fallback goes through the file's text view, not straight into the whole-document
  editor.** Opening that editor needs the text and the revision captured with it, and the viewer
  already decides read-only, unreadable and carriage-return files; a second copy of those gates in a
  handler would be a second opinion. The control is withheld (with a sentence) while
  `browser.fileTextTarget` is another file, so it can never show the wrong file.
- **D5 — the opener is offered for any snippet of a writable file.** The core's refusals (sequence
  hazards, holes, `\r`) are the ones that decide, and the editor draws them, as the deletion, move and
  duplicate panels do. A read-only file is the one gate.
- **D6 — the recovery sentence is not mounted on this surface.** `RecoveryWithoutCreation.svelte`'s
  only authored-text kind is `wholeDocumentText`, whose sentence is about the whole file; drawing it
  here would say something untrue of a snippet. §5 item 3.

## 3. Wording (R39: a sentence claims only what its producer guarantees)

| Key | Producer, and what the sentence is held to |
|---|---|
| `refused.rangeNotContiguous` | `ItemRangeNotContiguous`: a file-owned comment inside the item's hull (`raw_item.rs` module doc). Says "at least one comment … belongs to the file", and that the whole file's text can be edited instead |
| `refused.lineEndingsNotPreserved` | Rust's `ItemTextHoldsCarriageReturn` or the load door's `roundTripText`. Says the text contains a carriage return; offers no fallback, because the whole-document editor refuses one too |
| `refused.notEditable` / `refused.unreadable` | Carried whole; the operand is drawn beside the sentence |
| `trailingBlankLine` | `view.trailingBlankLineRefused` (D3) |
| `reconciled.diverged` | `reconcileWithDisk`'s `diverged`: neither text, or another first line. Says the editor cannot tell what became of the save — not that someone else changed the file, which a wrong selection would make false |
| `reconciled.noIdentity` | `identityInWindow` answered `null`: no snippet of this file is selected |
| `identityStale` | Both causes of `identityStale` (D1); claims no write |
| `mayHaveWritten` | The `mayHaveWritten` arm; says the app cannot tell |
| `restore.refused.rawSnippetEditorOpen` | An open surface; never unsaved edits (R36) |

## 4. Acceptance, clause by clause

| Clause | Evidence |
|---|---|
| Snippet component draws load / draft / save / refusal states | `RawSnippetEditor.test.ts`: *reads the text by the captured identity…*, *says it is reading…*, *gates the save…*, *keeps the draft on a refusal for findings…*, *freezes the box… save conflict…*, *…external conflict…*, the refusals suite |
| `ItemRangeNotContiguous` → offer of the whole-document editor | *opens no box for a range with holes…*, *offers the whole-document editor beside a save the engine refused…*; `DetailPane.test.ts` *offers the whole-document editor for a range with holes, and the offer reaches it* |
| Uncertain write, reconciliation, `diverged` | The *after a save that may have written* suite (four cases) |
| Detail integration and the write-surface kind | `DetailPane.test.ts` *registers and unregisters its rawSnippetEditor*, *opens over the selected snippet…* |
| CF-55: *Undo*/*Redo* disabled and not mutating under a held save, both surfaces, mounted | `RawSnippetEditor.test.ts` *draws both disabled while the save is held…*; `RawEditor.test.ts` *draws Undo and Redo disabled under a held save…* |
| Wording EN and ES via typed accessors | *draws the range refusal, the trailing-blank-line explanation and diverged in %s*; i18n key-parity suites; `built-translation-keys` and `hardcoded-strings` scans of the new component |
| `identityStaleRevision` retry decided | D1; `rawSnippet.test.ts` *treats a save refused as identityStaleRevision as a stale identity…*; *stops offering to save after a refusal for a stale identity…* |

## 5. Open items (noticed, not fixed here)

1. **The window half is 3-8-3's**: EN and ES through the picker, a contiguous snippet, a
   disjoint-ownership refusal and a `\r` refusal, with the held-save *Undo*/*Redo* and *Stop editing*
   read in the same launch as their DOM state (§4.2). Nothing in this record is a screen.
2. ~~A delivery that arrives while the start-up read is in flight installs nothing.~~ Fixed by the
   review (§8 item 1): it is held and replayed over the opened session.
3. **No recovery sentence on this surface** (D6). A `RecoveryWithoutCreationKind` for a snippet's own
   text would need its own sentence; a later phase may add one.
4. **A stale identity is terminal on this surface** (D1): the person closes and reopens. A later phase
   could offer a guarded re-read.
5. **The pane's captured identity is the opening one.** After a commit the component holds `moved`;
   the pane's `unsavedDraftFor`/`openMatchDrafts` answer the captured identity, as they do for the
   small editor. Both are unreachable while `busy` excludes the move and duplicate panels.
6. **The line count is not drawn**, only the first line (a count would need a plural form); 3-8-1 §5
   item 7 (the count after a commit) therefore has no reader yet.
7. 3-8-1 §5 item 6 (`reconcileWithDisk` under an external conflict leaves the conflict standing) is
   unchanged.
8. The Vite build's chunk-size warning is printed as before; not this phase's.

## 6. Gates and the rung

Each command below exited 0.

- `cargo test --workspace -- --test-threads=1 > /private/tmp/3-8-2-cargo.log 2>&1`: 33 `test result:
  ok` lines, **1465 passed, 0 failed** (no `.rs` file touched).
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo fmt --check`
- `cargo tree -p espansoconfig-core | rg tauri`: found nothing.
- `npm run check`: 470 files, 0 errors, 0 warnings.
- `npm test`: 3769 passed, 78 files.
- `npm run build`: 204 modules. The server-only oracle is absent and the client-only oracle is
  present (2).

**Rung: `1465 / 470 / 3769 / 204`**, against `1465 / 468 / 3730 / 202`.

- **Rust ±0:** no Rust change.
- **svelte-check +2:** `RawSnippetEditor.svelte` and `RawSnippetEditor.test.ts`.
- **Vitest +39:** 20 in `RawSnippetEditor.test.ts`; 4 in `DetailPane.test.ts` (1 walk, 3 pane cases);
  4 in `rawSnippet.test.ts`; 1 in `RawEditor.test.ts`; and 10 from per-file or per-kind loops over the
  new file and kind — `RestorePane.test.ts` 2 (EN/ES claim scan over the new competing kind),
  `restore.test.ts` 2 (two per-kind cases), `scripts/lint/ipc-detail.test.ts` 2 (the component and
  its suite), `composition-guards.test.ts` 2 (boundary imports; suite inventory),
  `hardcoded-strings.test.ts` 1, `built-translation-keys.test.ts` 1.
- **Vite +2:** a new styled component costs two modules (`CLAUDE.md` §4).

## 7. New or changed Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

| Key | Producer |
|---|---|
| `browser.rawSnippet.refused.{rangeNotContiguous, lineEndingsNotPreserved, unreadable}` (3, changed; `notEditable` kept as 3-8-1 wrote it, in both languages) | `rawSnippetRefusalKey` via `openRawSnippet` / `reconcileWithDisk` |
| `browser.rawSnippet.{open, label, scope, startsAt, loading, close, save, saving, undo, redo, unsaved, savingCannotBeStopped, discardWarning, discard, sendFailed, mayHaveWritten, failureReason, trailingBlankLine, needsReconciliation, readAgain, reading, identityStale, openWholeDocument, wholeDocumentElsewhere, diskVersion, draftCopied, draftCopyFailed}` (27, new) | `RawSnippetEditor.svelte` (`open`: `DetailPane.svelte`) |
| `browser.rawSnippet.reconciled.{written, notWritten, diverged, noIdentity}` (4, new) | `RawSnippetEditor.svelte`, from `reconcileWithDisk`'s answer |
| `browser.restore.refused.rawSnippetEditorOpen` (1, new) | `openWriteSurfaceKey` (`restore.ts`) |

## 8. Review fixes

The phase review (Codex, ship-with-fixes, 0 blockers) named two SHOULD-FIX items, both in
`src/lib/components/RawSnippetEditor.svelte`. Each regression test below failed with its fix reverted
and passes with it.

1. **SHOULD-FIX — watcher conflicts were discarded during the initial read.** The receiver dropped
   every delivery while no session existed, so a conflict raised before `match_item_text` answered left
   `start()` installing an unrestricted session. The receiver now holds such deliveries
   (`heldWhileReading`), and `start()` replays them, first to last, through `applyObservation` over the
   opened session before installing it; a refused opening drops them. Tests (`RawSnippetEditor.test.ts`,
   *review fixes*): *replays a conflict raised during the start-up read over the opened session*
   (box frozen, save disabled, disk side drawn) and *replays a held observation from the start-up read
   as a restriction on saving*.
2. **SHOULD-FIX — the discard confirmation ruled out an uncertain write.** After a `mayHaveWritten`
   failure the draft stays dirty, and *Stop editing* raised a confirmation whose EN and ES sentence
   began "Your changes have not been written to the file", which may be false.
   `browser.rawSnippet.discardWarning` (rendered through `t()`'s typed `TranslationKey`) now promises
   only what leaving does, in both languages: it discards the box's text, which cannot be brought back,
   and writes nothing to the file. It claims nothing about what the file holds. Test: *asks before
   leaving after a send that may have written, claiming nothing about the file* (EN and ES), which
   checks the sentence for the phrases of an unwritten file.

After the fixes, each exited 0: `npm test` (**3773 passed**, 78 files), `npm run check` (470 files,
0 errors, 0 warnings), `npm run build` (204 modules). No Rust file was touched.

**Rung after the fixes: `1465 / 470 / 3773 / 204`** (vitest +4: two finding-1 cases and the
finding-2 case in each of two languages; nothing else moved). The ES sentence
`browser.rawSnippet.discardWarning` changed and joins §7's inventory under the same producer.
