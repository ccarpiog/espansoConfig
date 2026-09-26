# Phase 4-10 — Form editor model

**Status:** implementation record for step 4-10 of [`4-split-notes.md`](4-split-notes.md) §2, under
rulings 15–19, 21, 22, 23 and 24 of §3 and override rows 1 and 2 of §5. A **model step**: no Svelte
control drafts a form yet (4-12 draws them). No component changed. **No Rust source and no wire type
changed**; one Rust test was added. The step was **not cut**. No window reading was performed or
claimed.

---

## 1. What changed and why

### 1.1 Browser: `src/lib/browser/formEditor.ts` (new module)

The pure form submodel, composed into `MatchBuffers` (ruling 24), one model with two adapters
(ruling 17):

- **Baseline** (`FormsBaseline`, `FormBaseline`, `DefinitionBaseline`, `FormScalarBaseline`): one
  `FormBaseline` per form — the shorthand form (when the snippet holds `form` or `form_fields`) and one
  per `type: form` variable — each with its `FormAddress`, its definitions container's shape, one row
  per definition (decoded name, option mapping shape, the four drafted options `type`, `default`,
  `multiline`, `trim_string_values` with presence, position and eligibility), and its Rust-cut
  container (`form_fields_container` for shorthand, `vars_container` for verbose).
- **The shorthand adapter keeps the existing `form` content buffer**: `FormBaseline.layout` and
  `FormBuffer.layout` are `null` for shorthand, so the one box, history and save path of that scalar
  stay `matchEditor.ts`'s `form` field. The **verbose adapter** drafts `params.layout` in its own
  box, because no other model drafts that open `params` entry.
- **Buffer** (`FormsBuffer`, `FormBuffer`, `DefinitionBuffer`, `AddedDefinition`): a verbose layout
  box, four option boxes and a removal flag per existing definition, and the new definitions (the
  closed `NewFormField` plus `placeholderInserted`, whether *Add field* put `[[name]]` into the layout
  in the same action).
- **Derivation** (`formsDerivationOf`): the one producer of `MatchDraft.form_fields`,
  `MatchDraft.form_intents` and a verbose form's `VariableDraft.params` (the layout entry), `fields`
  and `field_intents`. `withVerboseForms` merges the verbose parts into the variable editor's
  `VariableDraft`s. Problem `formFieldsWouldBeEmpty` withholds the save.
- **Rows** (`formRowsOf`): derived, never stored — one row per placeholder name in order of first
  occurrence (repetitions are one row, with a count), then the **definition-only rows** with their
  advisory (`noOccurrence`, or `noOccurrenceUnverified` over a layout holding syntax outside the
  subset); a placeholder with no live definition carries `noDefinition`.
- **The placeholder parser** (`layoutPiecesOf`, `isSupportedIdentifier`): a transcription of
  `PlaceholderLayout::parse` (`crates/espansoconfig-core/src/analysis/placeholder.rs`), the named
  supported subset of ruling 16, linear as the Rust one is since the 4-7 review.
- **Transitions** (`withLayoutText`, `withOptionText`, `withDefinitionRemoval`,
  `formAdditionRefusal`, `withDefinitionAdded`, `withDefinitionDiscarded`), the **send gate**
  (`formsWriteUnreadable`), the **reapply** (`formsReapply`), **retention** (`formRowsRetained`),
  **recovery** (`formsCarryDefinitions`), `excludedVariablesOf`, and the key functions.

### 1.2 `matchEditor.ts` at its composition point

`MatchBaseline.forms`, `MatchBuffers.forms`, `CapturedStructure.forms` (read once); `draftWith` sends
`form_fields`, `form_intents` and the merged `vars` from the derivation (4-9's comment that they were
4-10's was rewritten, as were the header's "`form_fields` stays read-only" and "still goes out empty"
sentences); `StructureProblem` widened by `FormsProblem`; `beginSave` asks `formsWriteUnreadable`
beside `writesACarriageReturn`; `committedBaseline` owes a re-projection to both the forms and the
variables when either changed (a verbose form lives in `vars`); `CollisionSubject` gained
`form_fields`; `MatchReapplyPlan.forms`; `planMatchReapply` adds the forms' verdict, their collided
containers and the *Add field* together rule; `retainedDraftOf` appends the form rows;
`TypingSubject` gained the verbose layout and option boxes. New session transitions:
`isFormEditable`, `editFormLayout`, `editFormOption`, `removeFormField`, `restoreFormField`,
`discardAddedFormField`, `addFormField` (with `FormFieldOutcome`), `formRows`,
`formFieldRemovalPreview`.

### 1.3 Recovery, retained labels, IPC doc, i18n

- `recovery.ts`: `matchRecoveryAvailability` also refuses (`variablesNotCarried`, the existing
  sentence, which already names form fields) a draft that `formsCarryDefinitions`; the header sentence
  says so.
- `saveOutcome.ts`: `RetainedLabel` gained `formFields`, `formField`, `formOption`, `layout`;
  `DraftFieldStatus` gained `fieldAdded`, `fieldRemoved`, `fieldEdited`, `optionName`,
  `optionValue`.
- `src/lib/ipc/types.ts`: `MatchDraft.form_intents`' "no production caller sends one yet" corrected.
  `variableInsertion.ts`: the `ReferenceField` comment that called `[[…]]` "Phase 4-10's" corrected.
- **i18n: 24 keys per language**, all frontend codes (no Rust code enum): `browser.saveOutcome.field.*`
  (5), `browser.saveOutcome.label.*` (4), `browser.matchEditor.saveWithheld.formFieldsWouldBeEmpty`,
  and 14 under `browser.formEditor.*` (`readOnly` 2, `addition` 5, `name` 4, `row` 3). Reactive
  wrappers in `src/lib/i18n/index.ts`: `tFormFieldRefusal`, `tFormAdditionRefusal`,
  `tFormRowAdvisory`; labels and statuses render through the existing `tRetainedLabel` and
  `tDraftFieldStatus`.

### 1.4 Rust: one test

`the_form_editors_wire_draft_keeps_a_crlf_files_untouched_bytes` in
`crates/espansoconfig-core/tests/form_definitions.rs` applies the exact wire draft the model emits for
*Add field* on a CRLF file (the `CRLF_WIRE` literal, pinned on the TypeScript side) and compares the
whole result byte for byte.

## 2. How each acceptance clause is met

All in `src/lib/browser/formEditor.test.ts` (41 cases) unless named.

| Clause | Evidence |
|---|---|
| A layout edit creates or deletes no definition | *rewrites the shorthand layout alone, and only the rows follow it* (the `form` `Set`, `form_fields: []`, `form_intents: []`, the forms buffer untouched; emptying the layout deletes nothing); *rewrites a verbose layout as its params entry alone*; *merges a verbose layout edit into the variable editor's own draft* |
| *Add field* changes both parts and undo restores both | *puts [[name]] into the shorthand layout and adds the definition, as one history step* (`past` of length 1, both halves on the wire, undo equal to the original buffers and clean, redo sends the same draft); *replaces a selection, in a verbose layout, and undo restores both there too*; *adds a definition alone for a placeholder the layout already holds*; refusals by code; explicit removal with its preview |
| Repeated placeholders share one row | *draws one row per name, in layout order, then the definition-only rows*; *does not claim a definition has no occurrence over syntax outside the supported subset*; *transcribes the Rust parser* (the Rust suite's own samples: every character kept, every malformed reason, the reopened opener, linearity) |
| An absent field left blank is `'Unchanged'` | *sends nothing for an absent option left blank, and inserts it once typed into* (typed then cleared is clean; a present option cleared is `Set('')`); *leaves an absent shorthand layout Unchanged, and shows an absent verbose layout read-only*; *shows an option of a definition that is not a block mapping read-only* |
| A layout holding `\r` is refused at load, edit and send | *at load* (shorthand layout, verbose layout and an option read-only; *Add field* into such a layout refused `layoutNotEditable`); *at edit* (every box, *Add field* texts; a one-line option refuses a line feed); *at send* (forged verbose layout, shorthand `form`, one-line option and new definition name — each shown to reach the derivation, then refused by `beginSave`) |
| … and a CRLF file's untouched bytes are checked separately | Rust `the_form_editors_wire_draft_keeps_a_crlf_files_untouched_bytes` (whole-file equality: the lines before the layout, the existing definition and the next snippet keep every `\r\n`, and the new lines follow the file's convention); TS *emits, for a CRLF file, exactly the wire draft the Rust untouched-bytes test applies* |
| Every new value has a lifecycle disposition | §4's table; tests: both conflict origins for five drafted actions (retained, rows, copy byte for byte; nothing drafted over an external conflict); the exact retained rows; reapply over unchanged containers (both origins, both shapes); collision of a changed container (`form_fields` / `vars`); *Add field* half on disk collides `form` and `form_fields`; commit owes a re-projection (and `vars` for a verbose form); a verbose form out of reach while its variable is drafted for removal; recovery refused for a draft adding a definition, offered without; consent discarded when the form draft changes |

## 3. Decisions

1. **No second draft of the shorthand layout** (the step's own sentence): the shorthand layout is the
   `form` field, its `\r` gates at load (`fieldEligibility`), edit (`editField`) and send
   (`writesACarriageReturn`) are the match editor's, and *Add field* writes through that buffer.
2. **An absent verbose `layout` is read-only** (`notInForm`), as an absent key of an existing variable
   is (4-9 decision 7); inserting one would be an `insert_params` entry no step has asked for.
3. **The placeholder parser runs in TypeScript as a transcription**, because rows must follow every
   keystroke of a draft Rust has not seen; the Rust `LayoutSummary` stays the authority for a saved
   file. Its parity is pinned on the Rust suite's samples, not proven (§6 item 7).
4. **A new definition's name must be a supported identifier** — this application's rule, so the
   placeholder *Add field* writes is one the subset reads; not a claim about espanso's keys.
   `selection: null` adds a definition alone (a layout-only row's definition).
5. **Definitions are appended** (`after: null`, "after the last one the draft leaves"). This answers
   4-6 §5 item 4 for this model: display order is the layout's, so neither front placement nor a
   reorder of definitions is needed by it.
6. **Forms are addressed by position in `MatchBaseline.forms`**, a verbose one also by its variable's
   position. A verbose form of a variable drafted for removal (or under a `vars` container removal) is
   **out of reach**: nothing of it is derived or sent, its boxes keep their text, and a restoration
   brings its edits back — as a removed variable's own boxes behave.
7. **Reapply has no `satisfied` for a form**: "already there" is not compared for nested definitions,
   so a form whose intended result is on disk collides — a manual resolution, never a lost edit. The
   shorthand *Add field* together rule (the `form` field `satisfied` beside definitions `applicable`
   collides both) mirrors 4-9's `reapplyTogether`; a verbose form's two halves share one container.
8. **R36 covers form structure actions with the variables' grant** (ruling 23): `addFormField` and
   `removeFormField` spend a `VariableStructureGrant`; restorations, discards and typing need none.
9. **A commit that changed a form or `vars` owes both baselines a re-projection**: verbose positions
   live inside `vars`, and the variables baseline's projected `params` no longer describe the file.
10. **Only four scalar options are drafted**, and none is removed; `values` items stay 4-12's
    (§6 item 1).
11. **Accessor naming follows 4-9's precedent** (`*Key` functions in the model, `t*` wrappers in
    `index.ts`), not a `describeFormEdit` family in `codes.ts`, which bridges Rust codes; none of
    these codes is Rust's.

## 4. Lifecycle dispositions of every new value

| Value | Save | Discard (undo, reload, close) | Reapply / conflict | Recovery | Reparse |
|---|---|---|---|---|---|
| `MatchBaseline.forms` (`FormsBaseline`, `FormBaseline`, `DefinitionBaseline`, `FormScalarBaseline`) | Not sent; after a commit that changed a form or `vars`, `reprojectionOwed` (every form transition refuses, nothing derives) | Not drafted, untouched | Replaced by the new projection's on a rebuilt session; its `container` is the correspondence unit | Read (with the variables baseline) by the refusal | Reseeded by `startMatchEditor` over the new projection |
| `FormsBaseline.reprojectionOwed` | Set by `committedBaseline` | — | An owed baseline collides a drafted form | — | `false` on a fresh session |
| `MatchBuffers.forms` (`FormsBuffer`, `FormBuffer`, `DefinitionBuffer`) | Captured once, derived by `formsDerivationOf`, gated by `formsWriteUnreadable`; the draft's base moves to the candidate on commit | Walked back by the one `Draft` history; a reload installs the disk version's fresh buffer | Retained in the conflict's draft, drawn and copied by `formRowsRetained`; `applicable` holds it over the new baseline, `collision` rebuilds from the new projection | A draft adding a definition is refused (`formsCarryDefinitions`) | Fresh buffer from the new baseline |
| `FormBuffer.layout` (verbose layout box) | A `params` entry `Set` in its variable's `VariableDraft`; `\r` refused at send | As above | Keyed on the `vars` container | Snippet holds `vars`: refused (4-9) | Fresh |
| `AddedDefinition.placeholderInserted` | Not sent | As above (one undo takes both halves) | Drives the together rule for a shorthand form | Any addition refuses recovery | Gone with the draft |
| Consent (existing, now over forms too) | Bound to the whole buffer set, so any form change sends no acknowledgement (test) | — | — | — | — |
| `FormRows`, `FormFieldOutcome`, removal preview | Derived on read, never stored or sent | Follow the draft | Recomputed from the retained draft | — | Recomputed |
| `MatchReapplyPlan.forms`, `CollisionSubject` `form_fields` | — | — | Named by the `fieldCollisions` obstacle through `tRetainedLabel` | — | — |
| New `RetainedLabel`s and `DraftFieldStatus`es | — | — | Retained rows and the copy | — | — |
| New `TypingSubject`s | Typing runs end at a structural action | Undo steps follow runs | — | — | — |

## 5. What is and is not guaranteed

- **Guaranteed by construction and pinned by tests, not by the compiler:** every form intent comes
  from `formsDerivationOf` over one captured read; no function derives a definition from layout text;
  *Add field* is one `editDraft`; a structural form transition changes nothing without a grant for the
  session's exact identity; `beginSave` refuses any form text a control could not hold, classified by
  the baseline's keys; a reapply collides the whole container unless its fingerprint, shape, count and
  address are the same.
- **Not guaranteed:** that a caller hands a grant minted from a current read (R37 — TypeScript cannot
  force it; the grant's own comment says so); that the TypeScript parser agrees with the Rust one
  beyond the pinned samples; anything about how espanso reads a layout, a definition or `[[name]]`
  (R16, R30, ruling 16).
- **Not guaranteed by this step at all:** that any screen draws these values (4-12 mounted, 4-13
  window).

## 6. Open items noticed, not fixed

1. **Existing definitions' `values` items, option removal and extra options are not drafted**; 4-12's
   Choice/List controls need a model extension (the core supports them since 4-6).
2. **No `satisfied` verdict for forms** (decision 7); a form whose result is already on disk costs a
   manual resolution.
3. **An absent verbose `layout` cannot be written** (decision 2).
4. **No whole-container removal of definitions** (`RemoveFields`) is offered.
5. **The shorthand form model exists only when the baseline holds `form` or `form_fields`**: a content
   switch drafted *to* `form` offers no *Add field* until saved and re-projected.
6. **A shorthand `form` drafted for removal and then given a field by *Add field* is un-removed** by
   the layout write, as `insertVariable` does for a content key; a screen may want to say so.
7. **Parser parity is by transcription**: no test runs both parsers on the same generated inputs.
8. The 24 new keys per language join the Phase 4 translation inventory (4-24); none has been read on
   a window.
9. **+2 vitest tests not traced to a file**: the new file holds 41, the suite grew by 43 (4-9 recorded
   the same kind of residue, 3). No per-file count of the previous run exists to diff against.
10. `git` was not run in this step.

## 7. Failing-first evidence, by mutation

Git was not used. `/private/tmp/4-10/mutate.py` applied each mutation, ran the clause's tests and
restored the file byte for byte (SHA-256 asserted); outputs `/private/tmp/4-10/mutation-M*.txt`,
summary `mutation-summary.txt`. Every mutation failed at least one test (runtime assertions, not build
errors). M3 and M12 **are the unchanged tree's behaviour** at the composition point and in recovery.

| Mutation | Clause | What it breaks | Failing cases |
|---|---|---|---|
| M1 | 1 | a layout edit removes the definitions it no longer shows (plan override row 1's "vice versa") | 8 |
| M2 | 2 | *Add field* recorded as two history steps | 2 |
| M3 | 2 | `draftWith` sends `form_intents: []` — the unchanged tree | 7 |
| M4 | 3 | one row per occurrence rather than per name | 1 |
| M5 | 4 | an absent option left blank sent as `Set('')` | 8 |
| M6 | 5, load | a scalar holding `\r` editable | 1 |
| M7 | 5, edit | the verbose layout box accepts `\r` | 1 |
| M8 | 5, send | no form gate at `beginSave` | 1 |
| M9 | 5, CRLF | the engine's `line_ending_before` answers LF in a CRLF file (Rust) | 1 |
| M10 | 6, reapply | every container taken as unchanged | 2 |
| M11 | 6, together | a half-applied *Add field* reapplied | 2 |
| M12 | 6, recovery | a draft adding a definition recreated without it — the unchanged tree | 1 |
| M13 | 6, save | a commit owes no re-projection | 1 |
| M14 | 6, conflict | the retained draft drops the form rows | 5 |

## 8. Gate and rung

All exit 0, run serially, outputs under `/private/tmp/4-10/`: `cargo test --workspace --
--test-threads=1` (`cargo-test.txt`), `cargo clippy --workspace --all-targets -- -D warnings`
(`clippy.txt`), `cargo fmt --check` (`fmt-check.txt`), `npm run check` (`npm-check.txt`: 493 files,
0 errors, 0 warnings), `npm test` (`npm-test.txt`: 91 files), `npm run build` (`npm-build.txt`);
bundle oracle — server-only markers absent (`oracle-server.txt` empty), client-only present
(`oracle-client.txt`, 2); `cargo tree -p espansoconfig-core` holds no `tauri` (`cargo-tree.txt`).

Rung **`1734 / 493 / 4189 / 217`** (was `1733 / 491 / 4146 / 216`): +1 Rust test (the CRLF case);
+2 `svelte-check` files (`formEditor.ts`, `formEditor.test.ts`); +43 vitest tests (41 in
`formEditor.test.ts`, 2 untraced, §6 item 9); **+1 Vite module**: `formEditor.ts` (imported by
`matchEditor.ts`, `recovery.ts` and `src/lib/i18n/index.ts`), as a new `.ts` module costs.

## 9. Review fixes

The adversarial review (`docs/reviews/4-10.md`, Codex) returned one blocker. It was fixed in the file
it named (`src/lib/browser/formEditor.ts`), with its regression in `formEditor.test.ts`; nothing else
changed. Git was not used: the pre-fix file was copied to `/private/tmp/4-10/fix/formEditor.ts.orig`.

1. **BLOCKER — reapply carried stale buffers for forms it never checked.** `formsReapply` verified the
   container of each *drafted* form only, then on `applicable` returned the whole retained buffer. For
   a snippet holding a shorthand and a verbose form, with only a shorthand option drafted and the
   untouched verbose layout changed on disk, the rebuilt session held the old layout text in the
   verbose box, `formScalarIntent` over the new baseline derived a `Set` of it, and the next save would
   silently overwrite the external change. **Fix:** an `applicable` result is now built from the new
   projection's fresh buffer, carrying the retained buffer only for each drafted form whose container
   the loop verified unchanged; a collision still rebuilds entirely from fresh. The function's doc
   says so. Regression *carries no stale buffer for a form it did not check, and sends only the drafted
   edits* (both origins): after the reapply the wire draft holds exactly the drafted option edit —
   `vars: []`, `var_intents: []`, `form_intents: []` — and the verbose box holds the disk's layout.
   Failing first on the unfixed tree: `/private/tmp/4-10/fix/failfirst-stale-buffer.txt` (2 of 2, the
   received draft re-sending `X: [[x]]`); after the fix `after-stale-buffer.txt` (43 of 43).
   A verbose form of a variable drafted for removal is not a drafted form, so its retained boxes are
   now replaced by fresh ones on an `applicable` reapply; the removal itself is the variable editor's
   and is unaffected.

**Gates after the fix**, all exit 0, outputs under `/private/tmp/4-10/fix/`: `cargo-test.txt`,
`clippy.txt`, `fmt-check.txt`, `npm-check.txt` (493 files, 0 errors, 0 warnings), `npm-test.txt` (91
files), `npm-build.txt`. **Rung `1734 / 493 / 4191 / 217`** (was `1734 / 493 / 4189 / 217`): +2 vitest
tests (the regression, over two origins), no new module.
