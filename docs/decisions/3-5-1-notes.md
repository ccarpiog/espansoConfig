# Phase 3-5-1 — Scalar content and options: the model and the coordination

**Spec:** `docs/decisions/3-split-notes.md` §2 "3-5" and its addendum of 2026-09-23 (the 3-5-1 / 3-5-2
cut), §3 rulings 8, 9, 10, 18, 23, 24 and 29; `docs/decisions/3-4-notes.md` §7 item 4.
**Risk:** high. **Model, coordination, one core wire field.** 3-5-2 owns the components, the drawn
strings and the window half.

No window reading was performed or claimed.

---

## 1. What changed, and why

### 1.1 The editor model (`src/lib/browser/matchEditor.ts`)

- **Seventeen editable fields** (six before): `trigger`, the five content keys (`replace`, `markdown`,
  `html`, `image_path`, `form` — layout text only, ruling 9), `label`, `comment` and the nine options.
  `EDITABLE_FIELDS` is `trigger`, `CONTENT_FIELDS`, `label`, `comment`, `OPTION_FIELDS`, which is
  `MatchField::ALL`'s relative order. `projectedScalar` and `fieldLabelName` are exhaustive switches,
  so an eighteenth field is a compile error. `regex` and the four lists still go out `'Unchanged'`
  (3-6).
- **`MatchBuffers` carries the drafted content switch** beside the fields
  (`contentSwitch: DraftedContentSwitch | null`, with `from`, `to` and `confirmed`). It is part of the
  drafted value, so it is snapshotted, undone, retained by a conflict, copied, reapplied and
  recovered with the fields.
- **`fieldIntent(baseline, buffer, role)`** takes the field's part in a switch (`SwitchRole`:
  `none` / `source` / `destination` with a reference text). The source's intent is `'Unchanged'` (it
  is renamed, not written); the destination's is `'Unchanged'` when its text equals the reference
  (the bytes are kept by Rust's rename) and `Set` otherwise, `Set('')` included. **`intentsOf`** is
  the one production caller: it reads the switch once and each buffer once. `matchDraftOf` builds
  the exhaustive twenty-two-field literal plus `content_switch` from that one read (`draftWith`).
- **Content roles** (`contentRoleOf`): `current`, `open` (the file holds no content key), `dormant`
  (another content key is held — writing this one would make two), `switchedAway`, `switchTarget`.
  `isFieldEditable` refuses `dormant` and `switchedAway`; the view reports the role per field.
- **The switch transitions**: `contentSwitchTargets`, `chooseContentSwitch` (always unconfirmed; the
  text moves to the destination's box unconverted; re-pointing drops the confirmation),
  `confirmContentSwitch`, `cancelContentSwitch` (the text goes back to the source's box). Each is its
  own history step. `switchIsReady` (confirmed, two different keys, source held and editable,
  destination not held in any shape) gates `canSave`, and `beginSave` re-checks it on the captured
  candidate. `removeField` refuses either key while a switch stands. `committedBaseline` makes the
  source absent and the destination present after a commit.
- **Preview data**: `MatchEditorView.contentSwitch` (`from`, `to`, both labels, the text, `textKept`,
  `companionsKept`, `confirmed`), `switchTargets`, and `saveWithheld: 'contentSwitchUnconfirmed'`.
  `companionsKept` lists the `vars`, `form_fields` and `paragraph` keys the snippet held when the
  session was seeded (`MatchEditorSession.companions`); a switch removes none of them.
- **The cursor action** (`insertCursorPosition`, ruling 18): `replace` only, while its box accepts
  changes. No marker: one `$|$` in place of the selection (UTF-16 indices, clamped), one history step,
  the marker's range answered for the control to select. One marker: its range, nothing changed.
  Several: `{ kind: 'severalMarkers', count }`, nothing changed; `cursorAdvisoryKey` and
  `tCursorAdvisory` render it. The body is read once. No `FindingCode`, no core work.
- **Suggestions** (`OPTION_SUGGESTIONS`): `uppercase_style` → `uppercase`, `capitalize`,
  `capitalize_words`; `force_mode` → `clipboard`, `keys`. Compared by `===` only; `applySuggestion`
  refuses anything not in the list; an unfamiliar value (`Keys`) is kept and reported
  `suggested: false`. No option is turned into a boolean anywhere; `force_mode` and `force_clipboard`
  are two fields with no inferred precedence.
- **Which control draws a field is the model's** (`fieldControlOf`): the five content keys and the
  comment are `multiLine`, the rest `singleLine`. A `singleLine` field whose value holds a line feed
  is read-only (new `FieldRefusal` `lineBreak`), and `editField` and `beginSave` refuse one there,
  because an `<input type="text">` strips line breaks (§3 D5).
- **Reapply** (`planMatchReapply`): the switch is compound (`switchReapply`): `applicable` only when
  both keys are in their seeded state, `satisfied` when the disk already holds the destination as the
  intended editable text and no longer holds the source, otherwise **both** keys collide. The plan
  gains `contentSwitch`; the rebuilt buffers carry the switch only when it applies.
- **Conflict compare and copy**: `retainedDraft` lists all seventeen fields; the two switch keys carry
  the new statuses `switchingAway` / `switchingTo` (`DraftFieldStatus` in `saveOutcome.ts`, with keys).

### 1.2 Recovery (`src/lib/browser/recovery.ts`)

- `transferOfField(baseline, buffer, role)`: a switch's source is `notCarried { switchedAway }`, its
  destination is carried with its box's text. `transferOfMatchDraft` covers seventeen fields and keeps
  **one** carried content key (the first in `CONTENT_FIELDS` order; any later one is
  `notCarried { oneContentOnly }`). `transferOfCreationDraft` covers seventeen fields.
- `recoveryBodyFieldOf(transfer)` names the body's content key (`replace` when none is carried);
  `openedRecovery` seeds the body box from it; `newMatchOfRecovery` writes the body under that key's
  `NewContent` arm and every carried optional field (`label`, `comment`, the nine options).
  `RecoveryView.bodyField` is new; the body row is the editable one.

### 1.3 R36 (`src/lib/browser/matchMove.ts`)

`hasStaleMatchDraft(document, drafts)`: a draft of this file whose revision is not the projection's.
`moveEligibility` refuses **every** move in the file with the new `MoveRefusal`
`staleDraftInDocument` while one is open, before the narrow `unsavedDraft` rule. It compares the
document number and the revision string only — no node is looked up in any projection. The
`DetailPane.svelte` wiring already hands the open editor's identity in, so no component changed for it.

### 1.4 The core and the wire

- `ContentForm` serializes as the espanso key (`snake_case`). New `ContentSwitch { from, to }`, whose
  only constructor refuses `from == to`, deserialized through the same check (`try_from`) with
  `deny_unknown_fields`.
- `MatchDraft.content_switch: Option<ContentSwitch>` (`#[serde(default)]`), with a builder.
  `plan_match_edits_with` appends it to the structure's substitutions, so every 3-1 rule applies
  unchanged and `plan_match_edits` alone plans a switch. No new `DraftError`.
- TypeScript: `ContentForm`, `ContentSwitch`, `MatchDraft.content_switch` in `src/lib/ipc/types.ts`.
  `ContentForm` is on `NOT_A_CODE` in `dictionary_contract.rs` (a field identifier, like `MatchField`),
  and the exempted-union list there grew to five.

## 2. Decisions

- **D1 — the switch is a field of `MatchDraft`, not a new command argument.** A switch is one save
  intention with the value it carries (ruling 8), and the draft already is the one intention; the
  component's call path (`started.draft` → `saveMatch`) needed no change. 3-1 §4.4 deferred the wire
  shape until a UI step needed one.
- **D2 — confirmation is part of the drafted value.** Undo walks it back, a conflict retains it, and a
  reapply that applies carries it. Editing the destination's text after confirming keeps it (the
  preview's substance is the rename, the unconverted text and the kept companions); re-pointing the
  switch drops it.
- **D3 — an absent content key is `dormant` while another is held**, rather than editable: typing
  into it would insert a second content key. A snippet with no content key leaves all five `open`; a
  snippet with two offers no switch and edits each in place.
- **D4 — R36 lives in `moveEligibility`**, the one model rule for a move, fed by the pane's existing
  producer; duplication already refuses any open draft in the file (stronger), so it needed nothing.
- **D5 — `lineBreak` applies to every `singleLine` field, the six pre-3-5-1 ones included.** The
  decision is per control kind; a label or trigger with a line feed was already corruptible through
  its `<input>`, and it is now read-only. Stated here because it changes what those fields accept.

## 3. Deviations

- **`src/lib/components/MatchEditor.svelte` was edited**, though no type forced it: the textarea was
  chosen by `field.field === 'replace'`, which would have drawn `markdown`, `html`, `form` and
  `comment` in an `<input>` that strips their line breaks — a data-loss path the widened model opened.
  The condition now reads the model's `field.control === 'multiLine'`. Three comments there that the
  widening made false were corrected. Nothing else in any component changed.
- The generic renderer now draws the eleven added fields (read-only boxes for dormant content keys,
  the six other options under the one *matching* heading) and the conflict panel's retained draft has
  seventeen rows. Mounted evidence only; nothing is claimed about a window.
- One read-only `git stash list` was run by mistake while counting tests; it listed nothing and
  changed nothing. No other git command was run.

## 4. Acceptance, criterion by criterion

| Criterion | Evidence |
|---|---|
| Every eligible scalar field in the model | `lists seventeen fields…`, `seeds each added field…` (`scalarFields.test.ts`); `describes all seventeen fields…` (`matchEditor.test.ts`) |
| Absent field left blank emits no key | `sends Unchanged for every added field nobody touched…`; `sends Set for a typed absent field, Set("") …, Remove …` |
| `\r` refused at eligibility, `editField`, `beginSave`, every added field | the three `the carriage return, at all three gates` cases; line feed in one-line fields: `refuses a line feed in a one-line field…` |
| Save, per field | `sends the field, adopts the identity and moves its baseline…` |
| Conflict compare and copy, per field | `retains every added field with its text and status, and copies it byte for byte` |
| Reapply, per field | `applies over an unchanged disk field, is satisfied by an equal one, collides with a changed one` |
| Recovery, per field (explicit disposition) | `carries a drafted value, omits an absent-and-blank field…`, `writes the body under the one content key…`, `carries one content key when the source held two…`; `recovers a drafted content switch under the destination key…` (`recovery.test.ts`); the widened layout test there |
| Switch: compound, all or nothing, needs confirmation, converts nothing, removes no companion | the fourteen `the content switch` cases, including `cannot be submitted unconfirmed…`, `removes no companion key…`, `reapplies all of it or none of it`, `reapplies through the transition…`, `reads a switch behind a getter once…` |
| Switch reaches the file in place | Rust: `a_drafted_content_switch_plans_through_plan_match_edits`, `…carries_the_destination_value_and_other_fields`, `…is_refused_by_the_substitution_rules`, `the_content_switch_wire_form_is_closed`, `a_drafted_switch_commits_through_the_save_transaction` (`tests/draft_compose.rs`); `a_drafted_content_switch_renames_the_key_through_save_match` (`commands.rs`) |
| Cursor action: `replace` only, one/several markers, undoable | the five `the cursor action` cases |
| Textual options, exact-string suggestions, unfamiliar kept, no boolean, `force_mode`/`force_clipboard` separate | the four `textual options` cases |
| R36 pinned | `withholds every move in the file while a stale draft is open — R36, ruling 24` (`matchMove.test.ts`), which replaced the test pinning the old allowed move |
| R37 stated | `contentSwitchTargets`' doc comment: view, choices and submission identity from one read, and TypeScript does not force it |
| New codes have mirrors, dictionaries and tests | `ContentForm` on `NOT_A_CODE`; keys in both dictionaries; `tCursorAdvisory`; sentence tests in `scalarFields.test.ts`, `matchMove.test.ts`, `matchEditor.test.ts`, `recovery.test.ts` |

## 5. Gates and the rung

Every gate exited 0 on 2026-09-24: `cargo build --workspace`; `cargo test --workspace --
--test-threads=1 > /private/tmp/3-5-1-cargo.log 2>&1` (1418 passed, 0 failed, summed from the log);
`cargo clippy --workspace --all-targets -- -D warnings`; `cargo fmt --check`; `npm run check` (462
files, 0 errors, 0 warnings); `npm test` (3590 passed, 73 files); `npm run build` (200 modules). The
server-only oracle found nothing; the client-only oracle found 2. `cargo tree -p espansoconfig-core |
rg tauri` printed nothing.

| | 3-4 | 3-5-1 | Why |
|---|---|---|---|
| Rust tests passed | 1412 | **1418** | +5 in `tests/draft_compose.rs`, +1 command test in `commands.rs` |
| svelte-check files | 461 | **462** | +1: the new `src/lib/browser/scalarFields.test.ts` |
| vitest tests | 3550 | **3590** | +38 in `scalarFields.test.ts`; +1 in `recovery.test.ts`; +1 generated by `ipc-detail.test.ts`'s per-source-file scan for the new file. `matchMove.test.ts` replaced one test with one |
| Vite modules | 200 | **200** | no module added; a test file is not bundled |

Tests changed rather than added: the recovery layout and creator-transfer expectations, the editor's
field-list and retained-draft expectations, and two mounted `MatchEditor.test.ts` counts (eighteen
`SourceText`s; six textareas) now expect seventeen fields; the test-side `MatchDraft` literals gained
`content_switch: null`.

## 6. Open items (noticed, not fixed here)

1. **The creation form still authors `trigger` + `replace` only** (`matchCreation.ts`,
   `MatchCreator.svelte`). The task's requirement list names the editor; the creator's content kind
   and optional fields need a placement (3-5-2 or 3-13).
2. **Deletion has no model arm for R36.** It is withheld today only by `DetailPane.svelte`'s `busy`
   exclusion; `deletionEligibility` takes no draft identity.
3. **3-5-2 owns the drawing**: dormant content keys currently draw as empty read-only boxes with the
   *absent* sentence and no role sentence; the nine options share one heading; no switch, preview,
   confirmation, cursor or suggestion control exists; `saveWithheld` and the companion keys are not
   drawn.
4. `browser.recovery.cannotCreate.replaceEmpty` names the replacement text even when the body is
   written under another content key.
5. A switch is offered only from a snippet holding exactly one content key; a `Several` content shape
   has no repair route in the structured editor.
6. `ContentSwitch` from a `form` leaves `form_fields` behind, and to `form` writes none: both are
   disclosed as companions, neither is migrated (ruling 9).

## 7. New Spanish sentences for the Phase 3 translation-review inventory (ruling 29)

| Key | Producer |
|---|---|
| `browser.saveOutcome.field.switchingAway` | `draftFieldStatusKey` (`saveOutcome.ts`), via `retainedStatusOf` |
| `browser.saveOutcome.field.switchingTo` | the same |
| `browser.recovery.transfer.switchedAway` | `transferRefusalKey` (`recovery.ts`), via `transferOfField` |
| `browser.recovery.transfer.oneContentOnly` | `transferRefusalKey`, via `transferOfMatchDraft` |
| `browser.matchMove.refused.staleDraftInDocument` | `moveRefusalKey` (`matchMove.ts`), via `moveEligibility` |
| `browser.matchEditor.cursor.severalMarkers` | `cursorAdvisoryKey` (`matchEditor.ts`), via `insertCursorPosition` |
| `browser.matchEditor.readOnly.lineBreak` | `fieldRefusalKey` (`matchEditor.ts`), via `fieldEligibility` |

No existing sentence was changed. No `code.` key was added.

## 8. Review fix

`docs/reviews/phase-3-5-1.md`: ship-with-fixes, one SHOULD-FIX, fixed in the file it named plus the
core planner that can receive the same batch.

1. **The switch preview could promise to keep a companion the draft deletes**
   (`src/lib/browser/matchEditor.ts`, `switchPreviewOf`): with `paragraph` present, a confirmed
   `replace`→`markdown` followed by `removeField(session, 'paragraph')` let `beginSave` send
   `paragraph: 'Remove'` beside the switch while the preview listed `paragraph` as kept. Now:
   - `removesACompanion(draft)` refuses a built draft carrying `content_switch` and
     `paragraph: 'Remove'`; `beginSave` asks it of the draft built from the captured candidate, and
     `canSave` of the live draft, so a removal drafted before or after the switch is refused alike;
   - `removeField` refuses `paragraph` while a switch is drafted, and `chooseContentSwitch` refuses
     while a `paragraph` removal is drafted;
   - the preview is derived from the same captured switch and intents as the save: `companionsKept`
     lists only companions the draft keeps, the new `companionsRemoved` lists any it removes, and
     `saveWithheld` answers the new code `switchRemovesCompanion` (a model code; 3-5-2 owns its
     sentence).
   - **Core**: `check_substitutions_are_coherent` (`crates/espansoconfig-core/src/draft/plan.rs`)
     refuses a content substitution beside a `paragraph` `Remove` as the existing
     `SubstitutionConflictsWithField { field: paragraph }` — no new wire code, dictionary key or
     Spanish sentence.

   Regressions: `refuses a companion removal drafted after the switch was confirmed (review fix)` and
   `refuses a switch over a companion removal drafted before it was chosen (review fix)`
   (`scalarFields.test.ts`); `a_content_switch_with_a_removed_paragraph_is_refused`
   (`tests/draft_compose.rs`, both the draft field and the 3-1 argument, and a `paragraph` `Set`
   beside a switch still plans). `vars` and `form_fields` are companions this editor never drafts, so
   no draft of it can remove them.

Rung after the fix: **1419 / 462 / 3592 / 200** (+1 Rust test, +2 vitest tests).
