# Phase 4-9 — Shared variable editor lifecycle

**Status:** implementation record for step 4-9 of [`4-split-notes.md`](4-split-notes.md) §2, under
rulings 8, 20, 21, 22, 23 and 24 of §3, the consult's Q5, Q9 and Q10
([`phase-4-design.md`](../reviews/phase-4-design.md)), and `PROGRESS.md` R25, R36 and R37. A **model over
the completed core**: no Svelte control drafts a variable yet (4-11 draws them). Two existing components
changed by one call each (§1.5). The step was **not cut**. No window reading was performed or claimed.

---

## 1. What changed and why

### 1.1 Core: the container baseline is carried by every projected match

- `ContainerBaseline` (Phase 4-8's `Absent {}` / `Present { text, fingerprint }` / `Uncut {}`) moved from
  `authoring.rs` to `crates/espansoconfig-core/src/model/match_view.rs`, re-exported from `authoring` and
  `model`. `MatchView` gained **`vars_container`** and **`form_fields_container`**, cut once per match in
  `MatchView::project` from the same source and value span the snapshot used. `authoring_snapshot` now
  clones them from the match, so the snapshot and the projection cannot disagree about a container.
- **Why on the projection:** the editor's reapply (`reapplyToDiskVersion`) is synchronous over the
  `MatchView` a conflict already carries (a save conflict's disk projection, an observation's). Asking a
  command for the target's snapshot would make the reapply asynchronous and add a second read between
  the evidence and the door; slicing the value span in TypeScript is forbidden (`CLAUDE.md` §6). The
  consult asks for "exact source slices or content fingerprints" from Rust (Q9); this is that, on the
  value the reapply already holds.
- Tests (`tests/authoring_snapshots.rs`): every projected match carries exactly the snapshot's
  baselines; a line inserted above the match leaves the fingerprint unchanged; an edit inside `vars`
  changes it; an edit outside the value hull (the label) does not.

### 1.2 Browser: `src/lib/browser/variableEditor.ts` (new module)

The pure submodel, composed into `MatchBuffers` (ruling 24):

- **Baseline** (`VariablesBaseline`): the `vars` shape (`absent`/`empty`/`block`/`flow`/`unsupported`),
  the Rust-cut container, one row per variable (its `name`, `type`, `inject_vars` as
  `VariableScalarBaseline`s with eligibility, its other projected values, and an owned copy of the
  `VariableView`), `formFieldsHeld`, and `reprojectionOwed`.
- **Buffer** (`VariablesBuffer`): per existing variable three one-line boxes and a removal flag, the new
  variables (`DraftedVariable`: the closed `NewVariable` plus the content key an *Insert* wrote its
  reference into), and the explicit container removal.
- **Derivation** (`variablesDerivationOf`): the one producer of `MatchDraft.vars` and `var_intents` for
  the editor; problems `varsWouldBeEmpty` and `variableAdditionsCollide` withhold the save.
- **Reapply** (`variablesReapply`): whole-container verdict (§3 item 5).
- **Retention** (`variableRowsOf`): the retained rows a conflict draws and copies (§3 item 9).
- **Recovery test** (`carriesDefinitions`), **R36/R37** (`variableStructureReadOf`,
  `variableStructureGrantOf`, `grantCovers`, `variableMoveOfferOf`, `variableMoveSubmissionOf`), key
  functions, and `variableTextsOf` for the carriage-return gate.

### 1.3 Browser: `src/lib/browser/variableInsertion.ts` (new module)

The compound *Insert* (`insertVariable`) and *Add variable* (`addVariable`), the name rules
(`nameContextOf`, `nameVerdictOf`, `suggestedName`) and their key functions. An *Insert* puts `{{name}}`
in place of the selection in `replace`, `markdown` or `html`, adds the new variable at the end of `vars`,
and lands through `recordCompoundChange` as **one** history step; the reference is built from the
description's own `name`, so the shared name is one value.

### 1.4 `matchEditor.ts` at its composition point

`MatchBaseline.variables`, `MatchBuffers.variables`, `CapturedStructure.variables` (read once),
`draftWith` now sends `vars`/`var_intents` from the derivation (`form_fields`/`form_intents` stay empty —
4-10's), `StructureProblem` widened by the two variable problems, `writesACarriageReturn` covers every
variable text, `committedBaseline` marks `reprojectionOwed`, `planMatchReapply` carries a `variables`
verdict, collides `vars` by name and applies the compound rule (`reapplyTogether`), and
`retainedDraftOf` appends the variable rows. New session transitions: `isVariablesEditable`,
`editVariableField`, `removeVariable`, `restoreVariable`, `removeVariables`, `restoreVariables`,
`discardAddedVariable`, `recordCompoundChange`, `variableMoveOffer`. `CollisionSubject` gained `vars`.
The header, the `CompanionKey` sentence and the `draftWith`/`matchDraftOf` comments that said the
editor sends `vars: []` were rewritten.

### 1.5 Recovery, workspace, components, wire mirror, i18n

- `recovery.ts`: `RecoveryUnavailable` gained **`variablesNotCarried`**; the new
  `matchRecoveryAvailability` asks `recoveryAvailability` then refuses a draft that `carriesDefinitions`;
  `startMatchFieldRecovery` opens from it. The header's "what is not carried" sentence was corrected.
- `workspace.svelte.ts` (thin): `BrowserState.variableStructureRead(document, drafts)` reads the
  projections once and hands them to `variableStructureReadOf`; `ownedMatchOf` copies the two new fields
  and its comment names them (E6, for the comment this step changed).
- `MatchEditor.svelte`: the recovery offer is `matchRecoveryAvailability(…, session.baseline, …)` (one
  call), and the retained comparison's label is `tRetainedLabel`. `MatchCreator.svelte`: the same label
  accessor. No new markup.
- `saveOutcome.ts`: `RetainedLabel` (`DetailFieldName | 'variableName' | 'vars'`) and `retainedLabelKey`;
  `DraftFieldStatus` gained `variableAdded`, `variableRemoved`, `variablesRemoved`, `parameterName`,
  `parameterValue`.
- IPC mirror `types.ts`: the two `MatchView` fields; three doc sentences that said no caller sends
  `var_intents` / a `NewVariable` / a `VariableDraft` corrected. `fixtures.ts`: `fixtureContainer` and a
  `varsContainer` override. `wire_contract.rs` points at the new declaration; `dictionary_contract.rs`'s
  `NOT_A_CODE` reason for `ContainerBaseline` names the projection.
- **i18n: 33 keys per language**, all frontend codes (no new Rust code enum): `browser.saveOutcome.field.*`
  (5), `browser.saveOutcome.label.*` (2), `browser.matchEditor.saveWithheld.*` (2),
  `browser.recovery.unavailable.variablesNotCarried`, and 23 under `browser.variableEditor.*`. Reactive
  wrappers in `src/lib/i18n/index.ts`: `tVariableFieldRefusal`, `tVariableAdditionRefusal`,
  `tVariableMoveRefusal`, `tNameVerdict`, `tInsertRefusal`, `tRetainedLabel`. `browser.saveOutcome.label.vars`
  is `Variables` in both languages and is on `dictionaries.test.ts`'s identical-by-design list with the
  reason `browser.detail.section.variables` already has.

## 2. How each acceptance clause is met

All in `src/lib/browser/variableEditor.test.ts` (45 cases at implementation, 50 after the review fixes of §8) unless named.

| Clause | Evidence |
|---|---|
| Every drafted scalar and structural action survives both conflict origins | *every drafted variable action survives both conflict origins* — five drafts (rename, `type` edit, removal, container removal, compound insertion) × save conflict (retained draft, rows, copy byte for byte) and × external conflict (retained, nothing drafted over it); *lists the drafted variables with their status* |
| An unchanged container baseline reapplies | *reapplies over an unchanged container baseline* (save and external origins, through `reapplyToDiskVersion`; the rebuilt session sends the same `vars` and `var_intents` against the new revision) |
| A shifted or changed list collides | *collides the whole container when the list changed or shifted* (an insertion before the drafted index, a reorder, a changed parameter of an untouched variable; both origins; obstacle `fieldCollisions: ['vars']`); *collides an Uncut container*; Rust: *a_shift_is_not_a_container_change_and_an_edit_inside_it_is* |
| A completely present intended result is satisfied | *is satisfied by a completely present intended result* (both origins → `alreadySatisfied`; one differing parameter collides); *keeps a compound Insert together*; *never claims a logical string written plain…* |
| Recovery never creates a snippet whose references lost their definitions | *recovery never creates a snippet…* — refused for a snippet holding `vars` whatever the draft changed (availability **and** `startMatchFieldRecovery`), for a draft adding a variable to a snippet with none, for a shorthand `form_fields`; still offered with neither; the sentence exists in both languages |
| R36's conservative rule, R37's single read, through callers | *R36's conservative rule and R37's one read* (model) and, through the caller, `workspace.test.ts` *the variable structure read — Phase 4-9*: grant, removal, reorder offer and submission from one `state.variableStructureRead`; after `rereadDocument` a fresh read refuses `staleDraftInDocument`, and a kept offer still answers its old revision (R37's limit, stated in `variableMoveOffer`'s comment: TypeScript cannot force it) |
| B1's regression coverage extended to variable lists | *B1, extended to variable lists — the model layer*: a draft with two `variableName` rows under external removal and change is raised over, retained, and its rows repeat the label; a source scan pins the comparison's `(index)` key in `MatchEditor.svelte`. The mounted half is 4-11's (§5 item 1) |
| History, one step per compound action | *walks a rename, a removal and a scalar field edit back and forward*; *makes the compound Insert one step*; *inserts into a snippet with no vars* |
| Consent discarded when the draft changes (4-8 open item 2) | *discards consent whenever the variable draft changes* |
| Carriage return / line feed | *a carriage return is refused for every new control…* (edit, insertion and `beginSave` over a forged buffer) |

## 3. Decisions

1. **The container baseline travels on `MatchView`** (§1.1), not in a separately fetched snapshot.
2. **The value hull is a sufficient correspondence unit** (4-8 §5 item 1). *Corrected by the review (§8
   item 2): it was not — a removal deletes owned comments outside the hull — and the cut is now the
   container's owned hull. The reasoning below stands for the positional intents.* Every variable intent is
   positional *inside* the list: an index names the same variable exactly when the items' bytes are the
   same, which the hull's fingerprint decides. The key's spelling and a comment after the last item move
   no index and change no variable. Rust re-plans every intent against the parse it locks and verifies
   the bytes it writes, so a change outside the hull is at worst a surfaced refusal, never a variable
   misaddressed. A wider unit (the engine's owned runs) is not defined for a container anywhere yet.
3. **Consent is bound to the whole buffer set** (4-8 §5 item 2): `Draft` binds consent to the candidate
   by deep equality and `MatchBuffers` now holds the variables, so any variable change sends no
   acknowledgement. Nothing in Rust forces it; the test pins the editor's side.
4. **One new variable per draft**, always at `End`: Rust refuses two insertions at one landing. Refused
   at the action (`additionPending`), withheld for a hand-built buffer (`variableAdditionsCollide`).
   Front/after placements for a new variable are not offered.
5. **"Already there" is conservative by construction.** Kept variables are compared value by value,
   style included; additions against what Rust writes (`NewVariableParams::entries` order, `type` text,
   plain-source settings plain). A logical string written plain counts only when it is identifier-shaped
   and not a YAML boolean/null word; a new form with field definitions is never compared. Every "cannot
   tell" collides.
6. **A compound *Insert* reapplies together**: the added variable remembers its content key, and a
   reapply where one half is `applicable` and the other `satisfied` collides both (`reapplyTogether`).
   A content key the draft no longer changes (the reference typed away) does not hold the variable back.
7. **An absent scalar of an existing variable is read-only** (`notInVariable`): Rust's `VariableDraft`
   refuses to insert one. Only `name`, `type` and `inject_vars` are drafted; `params`, `depends_on` and
   the lists stay 4-14's.
8. **Recovery refuses more widely than "a body reference resolves to a local"** (`carriesDefinitions`:
   `vars` not absent/empty, `form_fields` held, or a draft addition). Re-deriving reference resolution in
   TypeScript would be a second analysis; the refusal costs a copy and a discard, never a broken file.
9. **Retained rows are labelled references, never YAML**: a new variable is its name, its `type`, its
   common fields, then per parameter a `parameterName` row holding the key and one `parameterValue` row
   per value. `RetainedLabel` widens the label union instead of `DetailFieldName`, which
   `detail.test.ts` pins to exactly what `describeMatch` emits.
10. **R36/R37 as a grant**: structural transitions (`removeVariable`, `removeVariables`, *Insert*, *Add
    variable*) spend a `VariableStructureGrant` minted from one `VariableStructureRead` for the exact
    identity; restorations need none (they move the draft back towards the file). R36 is asked before the
    snippet is looked up, so a stale session's reason is the stale draft. The reorder is an **offer and a
    submission only** (§5 item 2).
11. **After a commit that changed `vars`, the variables baseline is `reprojectionOwed`**: nothing derives
    or drafts until a re-projection seeds a new baseline (the session already owes one). For a
    `committed: false` answer this also locks the variable controls until a re-projection — conservative,
    and not otherwise reachable.
12. **Projection data is copied through JSON, not `structuredClone`**, before a baseline freezes it: the
    window's projections can be Svelte `$state` proxies, which `deepFreeze` must never freeze (the first
    run of the mounted suites failed with `state_descriptors_fixed` until this was done).

## 4. What is and is not guaranteed

- **Guaranteed by construction and pinned by tests, not by the compiler:** the wire's `vars` and
  `var_intents` come only from `variablesDerivationOf` over one captured read; a compound *Insert* is one
  `editDraft`; a structural transition changes nothing without a grant for the session's exact identity;
  a reapply collides the whole container unless the fingerprint is the same or the whole intended list is
  there; `beginSave` refuses any variable text a control could not hold.
- **Not guaranteed:** that a caller builds a grant or an offer from a *current* read (R37) — a kept read
  gives a consistent, old answer that the command refuses as stale (D2v); that `nameContextOf` is handed
  the snippet's current analysis (without one, the scope is open and captures unknown, which is the honest
  answer); that "available among visible names" means espanso will accept the name (imports are never
  resolved); anything about how espanso evaluates variables (R16, R30). **A `form_fields` container is
  carried but no form intent is drafted** — its reapply is 4-10's.
- **Not guaranteed by this step at all:** that any screen draws these values. No component drafts a
  variable; the mounted and window evidence is 4-11's and 4-13's.

## 5. Open items noticed, not fixed

1. **B1's mounted half for variable lists** (a draft with two variable rows drawn in `.panel.external`)
   needs the variable controls; owed to 4-11, visible counterpart 4-13.
2. **The reorder writer's lifecycle is not built**: `variableMoveOffer`/`variableMoveSubmissionOf` decide
   what may be sent, but nothing sends `moveVariable` in `src/lib/ipc/commands.ts`, handles its outcome,
   retains or reapplies it. 4-8 §5 item 5 (its conflict payload compares no container) stays open with it;
   the step that draws the reorder control (4-11) takes both.
3. **`BrowserCommands` has no `matchAuthoringSnapshot`/`analyzeMatchCandidate` wrapper**, so
   `nameContextOf` has no production source for the analysis yet; 4-11 wires it.
4. **Existing variables' parameters, `depends_on` and list items** are not drafted (4-14).
5. **No variables view model** (`MatchEditorView` carries no per-variable rows beyond the retained draft);
   4-11 decides the shape it draws.
6. **A variable-bearing recovery could carry more than it refuses** once creation grows variables — a
   later phase, not Phase 4 (ruling 21).
7. The 33 new keys per language join the Phase 4 translation inventory (4-24); none has been read on a
   window.
8. `git status` was run once by mistake during this step (read-only, output discarded). No other git
   command was run.

## 6. Failing-first evidence, by mutation

Git was not used. `/private/tmp/4-9/mutate.py` applied each mutation, ran the new suites and restored
the file byte for byte (asserted); outputs `/private/tmp/4-9/mutation-*.txt`, summary
`mutation-summary.txt`. Every mutation failed at least one test (runtime assertions, not build errors):

| Mutation | What it restores or breaks | Failing cases |
|---|---|---|
| M1 | `matchRecoveryAvailability` offers recovery for a variable-bearing draft — **the unchanged tree's behaviour** (a recreated snippet lost its definitions) | 2 recovery cases |
| M2 | container fingerprints always "the same" | 6 reapply cases |
| M3 | `draftWith` sends `vars: []` — **the unchanged tree's composition point** | 4 |
| M4 | R36 check skipped | 2 (model and the workspace caller) |
| M5 | no carriage-return gate for variable texts at `beginSave` | 1 |
| M6 | compound *Insert* halves not kept together | 1 |
| M7 | a plain `true` taken as the logical string `true` | 1 |
| M8 | *Insert* recorded as two history steps | 1 |

## 7. Gate and rung

All exit 0, run serially, outputs under `/private/tmp/4-9/`: `cargo test --workspace -- --test-threads=1`
(`cargo-test.txt`), `cargo clippy --workspace --all-targets -- -D warnings` (`clippy.txt`),
`cargo fmt --check` (`fmt-check.txt`), `npm run check` (`npm-check.txt`: 491 files, 0 errors, 0
warnings), `npm test` (`npm-test.txt`: 90 files), `npm run build` (`npm-build.txt`); bundle oracle —
server-only markers absent (`oracle-server.txt` empty), client-only present (`oracle-client.txt`, 2);
`cargo tree -p espansoconfig-core` holds no `tauri` (`cargo-tree.txt`).

Rung **`1729 / 491 / 4141 / 216`** (was `1727 / 488 / 4092 / 214`): +2 Rust tests (the two projection
cases); +3 `svelte-check` files (the two new modules and `variableEditor.test.ts`); +49 vitest tests (45
in `variableEditor.test.ts`, 1 in `workspace.test.ts`, 3 elsewhere that were not traced to a file); **+2 Vite modules**: `variableEditor.ts` (imported by
`matchEditor.ts`, `recovery.ts` and `workspace.svelte.ts`) and `variableInsertion.ts` (imported by the
i18n wrappers in `src/lib/i18n/index.ts`), one each, as a new `.ts` module costs.

## 8. Review fixes

The adversarial review (`docs/reviews/4-9.md`) returned one blocker and two should-fix findings. Each
was fixed in the files it named (plus the Rust the blocker and the second finding needed); nothing else
was changed. Failing-first evidence under `/private/tmp/4-9/fix/` (git was not used: each pre-fix file
was copied to `orig/` before editing, swapped back for the run, and restored byte for byte, checked by
`cmp`).

1. **BLOCKER — an existing `inject_vars` was written as a logical string.** `plan_variable_scalar`
   (`crates/espansoconfig-core/src/draft/plan.rs`) now routes a `Set` of `VariableField::InjectVars`
   through the 4-6 pattern: `is_plain_source` first, refused by name otherwise
   (`DraftError::NewVariableSettingNotPlainSource` with a `VariableScalar` target — no new wire code,
   the variant's doc in `error.rs` now says it covers an existing variable's `inject_vars`), then
   `plan_plain_source_scalar`, so `false` → `true` writes `inject_vars: true`, and a quoted `'true'`
   drafted as `true` is rewritten plain. `name` and `type` stay logical strings. Tests
   (`tests/draft_plan.rs`): the editor's exact wire JSON for `false` → `true` writes plain `true` and
   moves no other byte; the source comparison and the quoted rewrite; the refusal for eight texts. The
   `OPEN_KEYS` fixture's `inject_vars: 'false'` became plain `false`, because its property (every value
   drafted as itself derives nothing) no longer holds for a quoted typed setting; the fixture's comment
   says why. `variableEditor.test.ts` pins the TypeScript half: the derivation emits exactly that JSON.
   Failing first: `failfirst-1-inject-vars.txt` (3 of 3 Rust cases).
   **Not the same code path, so recorded, not fixed:** an existing `offset`/`trim`/`debug` in a
   variable's `params` still goes through `plan_open_mapping` → `plan_scalar` as a logical string
   (4-6 notes' open item). No 4-9 control drafts `params`; 4-14 owns that surface and must take it.
2. **SHOULD-FIX — the container fingerprint excluded comments a removal deletes.**
   `ContainerBaseline::cut` (`crates/espansoconfig-core/src/model/match_view.rs`) now cuts the
   container's **owned hull**: the value span widened over the entry's owned runs and, for a block
   collection, every member's owned runs — the `crate::patch` derivation a removal is bounded by, read
   through `item_owned_runs` and a new crate-private `field_owned_runs` (`patch/edit.rs`, re-exported in
   `patch/mod.rs`). A derivation that gives up is `Uncut`, never narrowed. The key's own line and
   leading comments are now inside the text (conservative: a changed `vars` key spelling collides a
   draft it would not have misaddressed); the label and other fields are still outside. The snapshot
   (4-8) and the projection share the cut, so both changed. `tests/authoring_snapshots.rs`: the two
   text assertions now name the owned hull, and a new case edits the first variable's owned leading
   comment and the key spelling (both change the fingerprint) and the label (does not). The TypeScript
   comparison was not the defect and did not change; `variableEditor.test.ts` adds the review's scenario
   at the model (removal drafted, only the Rust cut differs → `fieldCollisions: ['vars']`, both
   origins), which passes on either tree by construction — the failing-first evidence is Rust's,
   `failfirst-2-container-rust.txt`. Doc comments in `types.ts` and `variableEditor.ts` were corrected.
3. **SHOULD-FIX — a content switch moved text without its compound insertion.** New
   `withInsertionsMoved(buffer, from, to)` in `variableEditor.ts`; `chooseContentSwitch` (choosing and
   re-pointing: from the key whose text is carried) and `cancelContentSwitch` (target → source) in
   `matchEditor.ts` call it in the same transition, so `insertedInto` follows the reference and undo
   walks both back as one step. Nothing in TypeScript forces a future text-moving transition to call it;
   its comment says so. Tests: cancellation (ownership back to `replace`, and the half-on-disk reapply
   collides `['replace', 'vars']`) and choose/re-point (`replace` → `markdown` → `html`, cancel back,
   undo). Failing first: `failfirst-3-switch.txt` (2 of 2).

**Open items added:** item 1's `params` `offset`/`trim`/`debug`; a quoted `inject_vars` is shown in its
box as its decoded text (`'false'` shows `false`), and saving it unchanged writes nothing, but any edit
rewrites it plain — D2u's "source as written" for a typed setting box is 4-11's to draw.

**Gates after the fixes**, all exit 0, outputs under `/private/tmp/4-9/fix/`: `cargo-test.txt`,
`clippy.txt`, `fmt-check.txt`, `npm-check.txt` (491 files, 0 errors, 0 warnings), `npm-test.txt` (90
files), `npm-build.txt`. **Rung `1733 / 491 / 4146 / 216`** (was `1729 / 491 / 4141 / 216`): +4 Rust
tests (3 in `draft_plan.rs`, 1 in `authoring_snapshots.rs`), +5 vitest tests (all in
`variableEditor.test.ts`: 1 emission, 2 container-comment origins, 2 content-switch), no new module.
