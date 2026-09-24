# Phase 3-8-1 — The local raw UI: the model and the coordination

**Spec:** `docs/decisions/3-split-notes.md` §2 step "3-8" and its addendum of 2026-09-24 (the 3-8-1 /
3-8-2 / 3-8-3 cut); §3 rulings 11, 12, 13 and 30; §4.2; §7 (CF-55). The 3-7 core and commands this
stands on are in `docs/decisions/3-7-notes.md`.
**Risk:** high. **Model and coordination only.** 3-8-2 owns the components, the detail integration and
the wording; 3-8-3 owns the window half.

No window reading was performed or claimed.

---

## 1. What changed, and why

### 1.1 The raw-snippet model (`src/lib/browser/rawSnippet.ts`, new)

The browser half of 3-7's `ItemTextReplacement`: a value with pure transitions, in the shape of
`rawEditor.ts` and `matchEditor.ts`, drawing nothing.

- **Opening.** `openRawSnippet(match, answer)` takes what `BrowserState.matchItemText` answered and
  returns `opened` (a clean session whose draft is the command's text, at `match.revision`) or
  `refused` with a `RawSnippetRefusal` code and a `RawSnippetFallback`. `itemTextRefused` carrying
  `ItemRangeNotContiguous` → `rangeNotContiguous`, whose `fallbackOf` is `'wholeDocumentEditor'`;
  `ItemTextHoldsCarriageReturn`, or a text that carries a `\r` anyway → `lineEndingsNotPreserved`;
  any other `EditError` → `notEditable` (carried whole); any other failure → `unreadable` (carried
  whole).
- **No byte slicing.** The text is the command's answer, taken whole; the module reads no span, offset
  or document text. The display lines are the command's `first_line`/`line_count`.
- **The `\r` refusal at load, edit and send.** The module drafts `RoundTripText` from `rawEditor.ts`
  and mints it only through `roundTripText`, so the rule is one rule for both raw editors:
  `openRawSnippet`, `editText` (a text with `\r` leaves the session unchanged) and `beginSave` (checked
  on the submission's own candidate, because a brand is a cast at bottom).
- **Retention.** A save conflict or an external conflict freezes the box over the retained draft,
  which `textToCopy` answers exactly; *Keep editing* gives a save conflict's box back. A refusal for
  findings keeps the draft and the submission `acknowledgeFindings` needs. An engine refusal
  (`saveFailed` carrying `SaveError::Patch(EditError)`) keeps the draft as a `notSent` failure and
  allows a corrected retry; `editErrorOf` reads its `EditError`, and the view's `fallback` offers the
  whole-document editor when that error is `ItemRangeNotContiguous`.
- **Conflict capabilities.** `authoredText`, copy offered, reload `closesSurface`, reapply
  `unavailable` (§2 D2). `reloadTheDiskVersion` is `matchEditor.ts`'s closing reload, with the same
  three installed-session reads.
- **A commit invalidates the old identity.** `applySave(session, result, adoption, current)` adopts
  `saved.moved` as the session's `match`, rebases the draft on the text sent at `result.revision`
  (`savedDraft`), and sets `identityStale` when a commit answered no `moved` or its adoption failed;
  the failure is an extra line beside the `saved` outcome, never an error.
- **An uncertain write needs reconciliation.** `saveCouldNotBeSent(…, mayHaveWritten: true, …)` keeps
  the draft, raises the `mayHaveWritten` notice and sets `needsReconciliation`, which refuses every
  save (an edit, an undo and *Keep editing* keep both the flag and the notice).
  `reconcileWithDisk(session, match, answer)` is the only way out: handed a fresh read at the
  window's new identity, it rebases only when the fresh text is the one the session opened over or
  the one the send carried (restarting the draft on it and drafting the retained text on top,
  `written: true` for the latter), and answers `diverged`, changing nothing, for any other text (§7).
- **CF-55's model half.** `canUndoEdit` / `canRedoEdit` are `isEditable && canUndo/canRedo(draft)`,
  exactly the checks `undoEdit` / `redoEdit` make; the view's `canUndo` / `canRedo` are those
  predicates. Under a held save neither is enabled and neither mutates.
- **The external session.** `applyObservation` (the seven-verdict table, `never` terminus),
  held deliveries replayed after the save's answer through a required `ReadTheInstalledSession`,
  `awaitingReconciliation`, `uncertaintyUnresolved` and `acknowledgeSnapshot` — `rawEditor.ts`'s
  receiver shape, so 3-8-2 registers a receiver without adding model logic.
- `rawSnippetView` derives everything a screen needs; `rawSnippetRefusalKey` is the key function;
  `baseRevisionOf` and `acknowledgementOf` are the named reads a caller sends.

### 1.2 `rawEditor.ts` — CF-55 on the whole-document surface

`canUndoEdit` and `canRedoEdit` were added with the same definition, `undoEdit`/`redoEdit` refuse
through them, and `rawEditorView`'s `canUndo`/`canRedo` are now those predicates rather than the
history alone (the `rawEditor.ts:1863` line ruling 13 names). `RawEditor.svelte` already disabled
*Undo* and *Redo* from `view.canUndo`/`view.canRedo`, so the controls are now disabled under a held
save **with no component change**; that is a consequence of the model, not a claim about a screen
(§5 item 1).

### 1.3 The coordination (`src/lib/browser/workspace.svelte.ts`)

- `BrowserCommands` gained `matchItemText` and `saveMatchItemText` (required, as every member is), and
  `REAL_COMMANDS` binds the 3-7 wrappers from `../ipc/commands`.
- `BrowserState.matchItemText(id)` is a reported-and-answered read, like `listBackupBatches`.
- `BrowserState.saveMatchItemText(id, baseRevision, text, acknowledgement)` is the **seventh writer**.
  `saveMatch`'s body became the private `saveOneSnippetInPlace(id, send)`, which both call, so the
  `notAttempted` refusal, ruling 27's barrier, the re-read after a send that may have written,
  `adoptAfterTheCommit` (a commit re-points a held selection of the snippet to `moved`, and is never
  reported as an error) and the conflict that installs nothing are one body. `saveMatch`'s behaviour is
  unchanged.
- The doc comments whose "six writers" counts the change invalidated were edited in place.

### 1.4 i18n

Four keys in each language, `browser.rawSnippet.refused.{rangeNotContiguous,
lineEndingsNotPreserved, notEditable, unreadable}`, produced by `rawSnippetRefusalKey` and rendered by
the new `tRawSnippetRefusal` in `src/lib/i18n/index.ts`. No `code.` key, no wire type and no Rust
change, so `wire_contract.rs` and `dictionary_contract.rs` are untouched.

### 1.5 Tests and compile fixes

- `src/lib/browser/rawSnippet.test.ts` (new, 28 cases with the review's three), `rawEditor.test.ts` (+2), `workspace.test.ts`
  (+5, and `saveMatchItemText` joins `BARRIERED_MEMBERS`, so the open-lease audit covers it).
- **Compile fixes only**, because `BrowserCommands` gained two required members: the command
  literals in `src/lib/components/{DetailPane,MatchDeleter,MatchDuplicator,MatchMover,RestorePane}.test.ts`
  each gained two refusing stubs. No `.svelte` file changed.

### 1.6 `CLAUDE.md`

§6's carriage-return sentence said "The raw editor", which is ambiguous with two raw editors; it now
names both modules and the three doors.

## 2. Decisions

- **D1 — one carriage-return rule for both raw editors.** The snippet model drafts `RoundTripText`
  and calls `roundTripText` / `rawEditorRefusal` from `rawEditor.ts` rather than minting a second
  brand, so the refusal cannot be relaxed on one surface alone.
- **D2 — the reload closes the surface; the reapply is unavailable.** A conflict's disk side is the
  whole file, and locating the snippet's range in it is a read only Rust makes (3-7's `owned_range`);
  reseeding from it would need that read. So the confirmed reload adopts the disk version and ends the
  session, as the match editor's does. Re-applying a free-form text over a changed range is a text
  merge, which the plan forbids. This is the answer to 3-7 §5 item 5: the `ExactItem` evidence stays
  unread, because nothing here re-resolves a target.
- **D3 — an uncertain write blocks the save until a fresh read.** The match editor lets a retry go
  out after `mayHaveWritten`; this surface does not, because the retry would replace a range whose
  current bytes this session has not seen. `reconcileWithDisk` makes the fresh read an explicit input
  and keeps the person's text whichever way the write went.
- **D4 — `saveMatch` and `saveMatchItemText` share one body**, rather than a seventh copy of the
  writing wrapper; the difference is the command, which the caller's closure issues.
- **D5 — the refusal codes have sentences now.** The addendum puts "the wording" in 3-8-2, but a new
  code with no sentence would be a code no accessor can render (`CLAUDE.md` §2). The four sentences are
  provisional and 3-8-2 may revise them; the fallback control's label and the trailing-blank-line
  wording are not written here.

## 3. Deviations

- The addendum lists "retention under conflict" and the uncertain write; this phase also delivers the
  external-observation receiver for the new model (§1.1, last bullet), because it is model logic 3-8-2
  would otherwise have to write inside a component step.
- `workspace.svelte.ts`'s `saveMatch` was restructured (D4). Behaviour is unchanged and every existing
  `saveMatch` case passes unmodified.

## 4. Acceptance, clause by clause

| Clause | Test(s) |
|---|---|
| No JavaScript byte slicing — the text comes from the command | `drafts exactly the text the command answered, at the identity’s revision`; `holds no slicing method anywhere in the module` (`rawSnippet.test.ts`); `answers the read unchanged, and reports a refusal as well as answering it`; `sends the identity, the base revision, the exact text and the acknowledgement` (`workspace.test.ts`) |
| `\r` refused at load | `refuses at load, whether Rust refused the range or the text carries one` |
| `\r` refused at edit | `refuses at edit, leaving the session exactly as it was` |
| `\r` refused at send | `refuses at send, on the submission’s own candidate` |
| `ItemRangeNotContiguous` → the whole-document fallback | `turns ItemRangeNotContiguous into a value offering the whole-document editor`; `carries every other refusal whole, and offers no fallback for it`; `offers the fallback beside a send the engine refused as a range with holes` |
| Retention under conflict and refusal | `keeps the draft on a save conflict, freezes the box and copies exactly it`; `keeps the draft under an external conflict raised by the watcher`; `keeps the draft on a refusal for findings, …`; `keeps the draft on an engine refusal, and allows a corrected retry`; `closes the surface on a confirmed reload, and closes nothing when the window refuses` |
| A committed save invalidates the old identities | `adopts the edited snippet’s new identity and rebases the draft on the text sent`; `stops offering to save when the commit answered no identity`; `stays a committed save when the adoption failed, …`; `keeps the identity on a byte-identical save that committed nothing` (`rawSnippet.test.ts`); `retires the old identity on a commit: the selection follows moved` (`workspace.test.ts`) |
| An uncertain write keeps the text and needs reconciliation | `keeps the draft and refuses every save until reconciled, even after an edit`; `reconciles against a fresh read that holds the sent text: …`; `… that does not: the draft is kept, dirty`; `refuses a reconciliation nothing owes, or one whose read is refused` (`rawSnippet.test.ts`); `answers a send that may have written as such, and re-reads the file`; `answers an engine refusal as a failure that wrote nothing, …` (`workspace.test.ts`) |
| Under a held save, Undo/Redo neither enabled nor mutating — new model | `disables and refuses both while a save is in flight`; `enables each exactly when its transition would change the session`; `holds a delivery that arrives during the save, and replays it after the answer` |
| The same — `rawEditor.ts` | `neither enables nor applies Undo or Redo under one held save (CF-55, ruling 13)`; `enables Undo and Redo exactly when the transitions would change the session` (`rawEditor.test.ts`) |
| Dictionary keys EN and ES with a typed accessor | `gives every refusal a sentence in both languages, through the key function`; key parity in the i18n suites |

The CF-55 *mounted* test and the window half are not this phase's (3-8-2, 3-8-3).

## 5. Open items (noticed, not fixed here)

1. **CF-55 on screen.** `RawEditor.svelte` now draws *Undo*/*Redo* disabled under a held save through
   the view alone. 3-8-2 owes the mounted test on both surfaces; 3-8-3 owes the window reading, with
   *Stop editing* read in the same launch as its DOM state (§4.2).
2. **The write-surface kind.** No `OpenWriteSurfaceKind` exists for the snippet editor: adding one
   forces the exhaustive assembly in `DetailPane.svelte`, which is 3-8-2's. Until then no receiver of
   this kind is registered, a restore does not see an open snippet editor as a competing surface, and
   `documentHasUnsavedDraft` does not count it.
3. **Where reconciliation's fresh identity comes from.** After a send that may have written, the
   window re-reads the file; the component has to take the snippet's identity from the window's fresh
   projection (the repaired selection) and read again before calling `reconcileWithDisk`. That wiring
   is 3-8-2's.
4. **Wording.** The four refusal sentences are provisional (D5). 3-8-2 owes the range's wording, the
   fallback control's label, the trailing-blank-line refusal (`ItemTextEscapesTheItem`, 3-7 §5 item
   2), and the `needsReconciliation` notice beside the existing `mayHaveWritten` sentence.
5. **A save refused as `identityStaleRevision`** is a `notSent` failure, so the session still offers
   a retry that will be refused the same way. The watcher normally raises the external conflict
   first; a later phase could treat that refusal as needing reconciliation too.
6. **`reconcileWithDisk` under an external conflict** proceeds and leaves the conflict standing (the
   box stays frozen until its reload). Whether a reconciliation should retire the external conflict is
   left open.
7. **The display line count after a commit** is computed from the candidate's line feeds, which
   assumes 3-7's property 7 (the new owned runs are exactly the written text).

## 6. Gates and the rung

Each command below exited 0.

- `cargo build --workspace`
- `cargo test --workspace -- --test-threads=1 > /private/tmp/3-8-1-cargo.log 2>&1`: 33 `test result`
  lines, **1465 passed, 0 failed** (no Rust change).
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo fmt --check`
- `cargo tree -p espansoconfig-core | rg tauri`: found nothing.
- `npm run check`: 468 files, 0 errors, 0 warnings.
- `npm test`: 3730 passed, 77 files (after the review fixes, §8).
- `npm run build`: 202 modules. The server-only oracle is absent and the client-only oracle is
  present (2).

**Rung: `1465 / 468 / 3730 / 202`**, against `1465 / 466 / 3693 / 201`.

- **svelte-check +2:** `rawSnippet.ts` and `rawSnippet.test.ts`.
- **Vitest +37:** 28 in `rawSnippet.test.ts`, 5 in `workspace.test.ts`, 2 in `rawEditor.test.ts`, and
  2 from `scripts/lint/ipc-detail.test.ts`'s per-file scan of the two new files.
- **Vite +1:** `rawSnippet.ts`, imported by the app through `src/lib/i18n/index.ts`
  (`tRawSnippetRefusal`).

## 7. New Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

| Key | Producer |
|---|---|
| `browser.rawSnippet.refused.{rangeNotContiguous, lineEndingsNotPreserved, notEditable, unreadable}` (4) | `rawSnippetRefusalKey` (`rawSnippet.ts`), via `openRawSnippet` / `reconcileWithDisk` |

No `code.` key was added and no existing sentence changed.

## 8. Review fixes

`docs/reviews/phase-3-8-1.md` (Codex): 2 blockers and 1 should-fix, all in `rawSnippet.ts`. Each
regression test below failed with its fix reverted and passes with it.

1. **BLOCKER — reconciliation rebased onto another writer's text.** `reconcileWithDisk` accepted any
   fresh read. It now rebases only when the fresh text equals `draft.baseValue` (the write did not
   land) or the submitted candidate (it did), and answers the new `diverged` arm otherwise, leaving the
   session unchanged: the draft kept, every save refused, the way on the conflict path. Test: `never
   rebases onto a fresh read another writer produced (finding 1)`. 3-8-2 owes the wording for
   `diverged`.
2. **BLOCKER — a failed retry bound old findings to a new candidate.** `beginSave` replaced
   `submitted` but kept the previous `outcome`. It now clears `outcome`, `extraMessages` and the reload
   step when a submission starts, so no outcome can outlive the submission it describes; the consent
   the send carries is already inside `submission`. Test: `binds no old findings to a different
   candidate after a failed retry (finding 2)`.
3. **SHOULD-FIX — Keep editing could discard an in-flight submission.** `keepEditing` now refuses while
   saving, and `rawSnippetView` offers no refusal or conflict choice then; the reload steps refuse too
   (`reloadableConflictOf`). Test: `offers and applies no dismissal while a save is in flight (finding 3)`.

After the fixes, each exited 0: `npm run check` (468 files, 0 errors, 0 warnings), `npm test` (3730
passed), `npm run build` (202 modules). The Rust tree did not change.
