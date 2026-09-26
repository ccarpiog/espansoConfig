# Phase 4-14-1 — The seven kind submodels for a new variable

**Status:** implementation record for step 4-14-1 of [`4-split-notes.md`](4-split-notes.md) §2 — the first
of the two pieces the dated 2026-09-26 addendum under `### 4-14` cut 4-14 into (4-14-2, existing
variables' parameters and the plain `offset`/`trim`/`debug` rewrite, is not touched here). **No Rust
source and no wire type changed**: the core already emits all nine closed `NewVariableParams` variants
since 4-4, and every one of the seven reaches it through 4-9's `addVariable` / `insertVariable`. **Model
and wiring only**; the `+ Insert` popovers stay 4-15's. **No window reading was performed or claimed** —
the mounted evidence is recorded as mounted (ruling 29).

---

## 1. What changed and why

### 1.1 Browser: `src/lib/browser/variableKinds.ts` (new module)

The seven kinds' decisions as values.

- **Kinds and parts.** `NewVariableKind` (`date`, `random`, `echo`, `clipboard`, `shell`, `script`,
  `match`; offered in `NEW_VARIABLE_KINDS` order, echo first), `KindPart` (the twelve parameters, each
  spelled as the espanso key), `PARTS_OF_KIND` (each kind's own parts, in Rust's writing order —
  `NewVariableParams::entries`), `PART_SHAPE` (`oneLine` / `text` / `list`), `PLAIN_SOURCE_PARTS`
  (`offset`, `trim`, `debug`, as `PLAIN_SOURCE_PARAMS` in `new_variable.rs`), `KNOWN_SHELLS`.
- **Required-parameter readiness.** `REQUIRED_PART` transcribes `required_param`
  (`crates/espansoconfig-core/src/validate/mod.rs`): `choices`, `echo`, `cmd`, `args`, `trigger`; **none
  for `date`** (espanso's source answers RFC 2822 without `format`) and none for `clipboard`.
  `kindProblemOf` answers the first `KindProblem` (`required`, `emptyItem`, `carriageReturn`,
  `lineBreak`; `noTarget` for an *Insert*).
- **Warning values.** `kindWarningsOf` / `KindWarning`: `offsetNotAnInteger`, `notTrueOrFalse` (`trim`,
  `debug`), `unfamiliarShell`, `formatWithoutSpecifier`, `surroundingSpace` (one-line parts). Advisory
  only: a warning never refuses and never rewrites.
- **The form value.** `KindDraft` holds the kind, the provisional name and **every** part's text, so a
  change of kind (`withKind`) loses nothing typed; `kindDraftOf` opens a kind blank with a provisional
  name (`date`, `date2`, … via `suggestedName`); `withKind` re-proposes the name only while it is the old
  kind's untouched proposal. `editKindDraft` is the edit gate (`KindEdit`, `KindEditRefusal`).
- **The closed shape.** `kindVariableOf` builds exactly one variant from the chosen kind's own parts —
  every text as typed, a blank optional part `null` (not written), no `inject_vars`, `depends_on` or extra
  parameter.
- **The view.** `kindAdditionViewOf` (`KindAdditionView`, `KindPartView`): the kinds, the chosen kind's
  boxes (shape, required, plain source, text, warnings), the name verdict (as a name, not a reference, as
  4-11's echo form), the problem, the warnings, `withheld`, `executes` (shell, script), `readsClipboard`
  (clipboard), `canAdd`.
- **The two presses.** `addKindVariable` (over `addVariable`: one history step, no reference) and
  `insertKindVariable` (over `insertVariable`, targets as `choiceTargetsOf`: the reference and the
  variable as one step). Only *Add* is on screen; *Insert* is 4-15's to press (§5 item 1).
- `addedParamsOf` (`AddedParam`): what a drafted addition of these kinds will be written with, for the
  selected addition's panel.
- Key functions: `newVariableKindKey`, `kindPartKey`, `kindProblemKey`, `kindWarningKey`,
  `kindEditRefusalKey`.

### 1.2 `src/lib/browser/variableGroup.ts`

- The selection `{ kind: 'echo' }` became `{ kind: 'add' }` (`GroupSelection`, `sameSelection`,
  `liveSelection`, `selectedOf`): the form now adds any of seven kinds.
- **4-11's echo-only functions were removed** (`EchoDraft`, `echoDraftOf`, `echoVariableOf`,
  `EchoAdditionView`, `echoAdditionViewOf`, `addEcho`): the echo kind of `variableKinds.ts` replaces them,
  so there is one path, not two. 4-11's model test of them was migrated to the new functions with the
  same assertions.
- `withheldOf` became the exported `additionWithheldOf` with its type `AdditionWithheld`, shared by the
  Choice form and the kind form (no copy).
- `SelectedAddition` gained `params` (the drafted `NewVariableParams`, as sent).

### 1.3 `src/lib/components/VariableGroup.svelte`

The echo *Add variable* form became the ***Add a variable*** form (`.addForm`): a kind picker (seven
buttons, `aria-pressed`), the name box with its verdict, one textual box per owned part (`<input>` for
`oneLine`, `<textarea>` for `text`/`list`, each in a `[data-part]` block labelled with the translated
label **and the espanso key**), *Required* / *Optional: left blank, it is not written*, *Written exactly as
typed* beside a plain-source part, each warning beside its part, the note that espanso may run the
command (shell, script) or reads the clipboard (clipboard) **and that this application never does**, the
problem, the withheld reason, the insertion refusal, *Add* and *Cancel*. A refused edit puts the box back
to the form's text and says why (role `status`). The selected new variable's panel now lists its
parameters (`addedParamsOf`, drawn through `SourceText`). Every press still mints its grant and names from
a read taken at the press (R37).

### 1.4 i18n

**38 keys added per language**, 4 removed (`browser.variableGroup.echo.{open,heading,text,add}`): 4 under
`browser.variableGroup` (`addVariable.{open,heading,add}`, `added.params`) and 34 under
`browser.variableKinds` (7 kind names, 12 part labels, `kindLabel`, `required`, `optional`, `plainSource`,
2 notes, 4 problems, 5 warnings). Problems and warnings take `{part}`, filled with the espanso key, the
same in both languages. Wrappers in `src/lib/i18n/index.ts`: `tNewVariableKind`, `tKindPart`,
`tKindProblem`, `tKindWarning`, `tKindEditRefusal` (the `*Key` / `t*` precedent of 4-9 … 4-12). Two
Spanish values are deliberately identical to English and were listed in `IDENTICAL_BY_DESIGN`
(`src/lib/i18n/dictionaries.test.ts`) with the reasons the existing `code.matchBadge.{shell,script}` rows
give: `browser.variableKinds.kind.script` ("Script") and `browser.variableKinds.part.shell` ("Shell").

### 1.5 Tests

- `src/lib/browser/variableKinds.test.ts` (new, 70 cases, node): per kind (`it.each` over the seven) the
  closed shape through `beginSave`, readiness, the three `\r` gates, undo, *Insert* plus undo, the
  conflict's retained rows, reapply (`reapplied` over an unchanged container, `alreadySatisfied` over the
  variable exactly as Rust writes it, `manualResolution` over a changed parameter) and recovery
  (`variablesNotCarried`); `REQUIRED_PART` checked against the **text of `validate/mod.rs`** (the
  `required_param` arms parsed), warnings, unfamiliar text kept, both languages.
- `src/lib/components/MatchEditorVariables.test.ts`: **suite 8** (13 cases, mounted, the file's
  invoke-zero guard): each kind chosen, filled, added, listed and sent by one save; *Add* disabled until
  the required part is given, with the sentence and the execution / clipboard notes; a warning drawn and
  the text sent as typed; `\r` at edit; one undo; a conflict's retained rows and the recovery refusal;
  Spanish kind labels. Suite 2's echo case now presses the renamed keys.
- `scripts/lint/no-execution.test.ts` (new, 5 cases): the no-execution / no-clipboard-read scan (§3
  item 7).
- `src/lib/browser/variableGroup.test.ts`: the echo suite migrated (§1.2).

## 2. How each acceptance clause is met

`VK` = `src/lib/browser/variableKinds.test.ts` (model); `MEV8` = suite 8 of
`src/lib/components/MatchEditorVariables.test.ts` (mounted); `NE` = `scripts/lint/no-execution.test.ts`.

| Clause | Evidence |
|---|---|
| Each kind produces its closed shape | VK *each kind produces its closed shape…* (7 cases: one `InsertVariable` holding exactly its variant, nothing else drafted), *writes a blank optional part not at all*, *sends only the chosen kind's own parts…*; MEV8 *$word: chosen, filled, added…* (7 mounted cases, the save's `var_intents` compared whole) |
| Required-parameter readiness (`date.format` not required) | VK *names the same required part as validate/mod.rs…* (parsed from the Rust file), *$kind: ready only once its required part is given* (7), *refuses an empty line…*; MEV8 *keeps Add disabled until the required part is given…* (a blank `date` form is addable) |
| Warning values | VK *warns about an unusual text without refusing it…*, *earns no warning for a text it recognises…*, *warns only about the chosen kind's own parts*; MEV8 *draws a warning beside an unfamiliar text…* |
| Unfamiliar text kept | VK *warns about an unusual text…* (`fish`, `yes`, `on `, `1d`, ` Mars/Olympus` sent verbatim), *refuses an empty line…* (a space item kept); MEV8 *…sends the text exactly as typed* |
| `\r` refused at load, edit and send | VK *opens every form holding no text…* (load), *refuses one at edit in every box…* (edit), *$kind: refuses a forged form at the press, a forged description at addVariable, and a forged buffer at beginSave* (7, send); MEV8 *never takes a carriage return at edit…* (a text area normalizes CRLF; a forged value is refused, the box put back, the sentence drawn, nothing with `\r` sent) |
| Undo | VK *$kind: one undo takes the addition back* (7), *$kind: an Insert … one undo takes both back* (7); MEV8 *takes an added shell variable back with one undo* |
| Conflict | VK *$kind: a save conflict retains the name, the type and every parameter, row by row…* (7), *$kind: reapplies … already satisfied…* (7); MEV8 *retains a new script variable under a save conflict…* |
| Recovery | VK *$kind: recovery refuses to recreate the snippet as new (ruling 21)* (7); MEV8 *…draws the recovery refusal after Keep my draft* |
| No execution, no clipboard-read path | NE (5 cases, §3 item 7) |

## 3. Decisions

1. **"Given" means not blank.** Rust's `required_param` asks for presence; a box cannot say "present and
   empty" apart from "untouched", and `CLAUDE.md` §6's rule for an existing field (an absent field left
   blank is `'Unchanged'`, not `Set("")`) reads the same way here. So a blank optional part is not
   written, and a blank required part keeps *Add* disabled. **Deviation from 4-11:** the echo form used to
   add `echo: ''`; it now waits for a text.
2. **One path for echo.** The echo-only functions of 4-11 were removed rather than kept beside the echo
   kind (§1.2); ruling 20 still holds — the form opens on `echo`, and nothing is inserted into a content
   key.
3. **The form keeps every part's text across a change of kind**, and only the chosen kind's own parts are
   sent; a hidden text is never written. The name is re-proposed only while untouched.
4. **Warnings are about risk, never meaning (D2u).** `notTrueOrFalse` compares the text with `true` /
   `false` only; `offsetNotAnInteger` checks the shape of a whole number; neither interprets anything.
   `KNOWN_SHELLS` (`bash`, `cmd`, `nu`, `powershell`, `pwsh`, `sh`, `wsl`, `wsl2`, `zsh`) is transcribed
   from espanso 2's shell extension, **not measured**; the sentence says "not a name this application
   knows", never "espanso refuses it".
5. **Part shapes.** `format`, `offset`, `tz`, `locale`, `shell`, `trim`, `debug` and `trigger` are
   one-line boxes and refuse a line feed at edit; `echo` and `cmd` are one multi-line text; `choices` and
   `args` are one item per line under the Choice insertion's rule (`valuesOfLines` in `formEditor.ts`,
   reused). This is stricter at edit than `variableTextsOf`'s send gate for `format`, `shell` and
   `trigger` (which it classes multi-line); the send gate is unchanged.
6. **The selected addition lists its parameters** (`addedParamsOf`) so a new shell command or trigger is
   visible before saving, as a choice's values already were.
7. **The no-execution test is a source scan**, in `scripts/lint/` beside the other tree scans: every Rust
   source of `src-tauri/src/` and the core, every non-test frontend source (the IPC layer included), both
   Cargo manifests, the workspace manifest, `package.json` and the capability files, for a process spawn
   (`process::Command`, `Command::new`, `libc` `fork`/`exec*`/`posix_spawn`/`system`/`popen`), a shell,
   process or clipboard plugin or crate, a clipboard **read** (`clipboard.read`/`readText`, a `paste`
   command) and `child_process`. `navigator.clipboard.writeText` in `clipboard.ts` (writing) is allowed and
   is asserted present, so the scan provably reads it. **The one exception is pinned, not waved through**:
   `make_fifo`'s `Command::new("mkfifo")` in `persist/write.rs`, which the test requires to sit inside that
   file's `#[cfg(test)] mod tests` beside `fn make_fifo(` and to be the only occurrence. A self-check
   feeds each forbidden spelling through the rules.
8. **The mounted suite joined `MatchEditorVariables.test.ts`** (suite 8) rather than a new file: it reuses
   the harness and the file's composition-guard inventory entry.

## 4. Lifecycle dispositions of every new value

| Value | Save | Discard (undo, reload, close) | Reapply / conflict | Recovery | Reparse |
|---|---|---|---|---|---|
| `KindDraft` (component state `adding`) | Not sent until *Add* | Lost on *Cancel*, close, re-seed or a chip press | Not retained (not drafted) | — | Lost |
| The refused edit (component state `editRefused`) | Not sent | Drawn only while the form holds the value it was refused over | — | — | Lost |
| A drafted addition of one of the seven kinds (4-9's `VariablesBuffer.added` entry) | One `InsertVariable` at `End` (plus the key's `Set` for an *Insert*), one save; `\r` refused by `beginSave` | One undo takes it (and an *Insert*'s reference) back | Retained as `variableAdded` / `parameterName` / `parameterValue` rows; reapply `applicable` over an unchanged container, `alreadySatisfied` when the disk holds exactly what Rust writes, else a `vars` collision (4-9's `additionIntended`, unchanged) | Refused, `variablesNotCarried` (ruling 21) | Re-seeded from the projection after a commit |
| `SelectedAddition.params`, `AddedParam` | Derived on read | Follow the draft | Drawn under a conflict like the rest of the panel | — | Recomputed |
| `KindAdditionView`, `KindPartView`, `KindProblem`, `KindWarning`, `KindEdit`, `KindOutcome` | Derived on a read or a press, never stored | — | — | — | — |
| Selection `{ kind: 'add' }` (renamed from `'echo'`) | Not sent | Bound to its baseline by `SeededSelection` (4-11) | Cleared by a reapply's new baseline | — | Cleared |

## 5. Open items noticed, not fixed

1. **`insertKindVariable` has no screen caller**: the `+ Insert` rows with caret and selection insertion
   are 4-15's; only *Add* is drawn.
2. **Plain-source text is not pre-checked in TypeScript**: an `offset`, `trim` or `debug` that Rust's
   `is_plain_source` rejects (for example one with a leading space, which only earns `surroundingSpace`
   here) is refused at save by name (`NewVariableSettingNotPlainSource`), the draft kept — as 4-12 §5
   records for its own refusals.
3. **No `match`-kind check that the trigger exists** among the loaded snippets, nor that it is the
   snippet's own trigger (a self-reference).
4. **`KNOWN_SHELLS` is transcribed, not measured** (§3 item 4); the tz and locale texts earn no shape
   warning at all.
5. **The form cannot set `inject_vars`, `depends_on` or extra parameters** of a new variable, although
   the wire carries them; nothing asked for it here.
6. **One new variable per draft still holds** (4-9 decision 4; 4-11 §3 item 5).
7. The form's contents are component state and are lost when the editor closes or re-seeds (4-11 §5
   item 4 applies unchanged).
8. The 38 new keys per language join the Phase 4 translation inventory (4-24); none has been read on a
   window. The window half of these controls is owed to 4-16.
9. The ES labels and sentences were written by the worker and are owed the owner's native-speaker review
   with the rest of R35.
10. Git: `git diff` was run once, read-only, to inspect a dictionary reformatting of this step's own
    making, and `git show HEAD:src/lib/i18n/{en,es}.json` was read once to rebuild the two dictionaries
    with their original blank-line grouping. No git command changed the tree or the index.

## 6. Failing-first evidence, by mutation

Git was not used for it. `/private/tmp/4-14-1/mutate.py` applied each mutation, ran the clause's tests and
restored the file byte for byte (SHA-256 asserted); outputs `/private/tmp/4-14-1/mutation-M*.txt`, summary
`mutation-summary.txt`. Every mutation failed at least one test on a runtime assertion. **M11 is the
unchanged tree's behaviour** (the form offers echo only).

| Mutation | Clause | What it breaks | Failing cases |
|---|---|---|---|
| M1 | readiness | `date` requires `format` | 3 |
| M2 | closed shape | a blank optional part written as `''` | 5 |
| M3 | `\r` at edit | the edit gate takes a carriage return | 2 |
| M4 | unfamiliar text kept | `debug` trimmed before sending | 1 |
| M5 | closed shape | a change of kind drops the typed texts | 1 |
| M6 | no execution | no "espanso may run this" note for shell/script | 2 |
| M7 | `\r` at edit (mounted) | a refused edit leaves the refused text in the box | 1 |
| M8 | warnings | `fish` counted as a known shell | 2 |
| M9 | no execution | a `std::process::Command::new` line in `src-tauri/src/commands.rs` | 1 |
| M10 | no clipboard read | a `navigator.clipboard.readText()` line in `src/lib/ipc/commands.ts` | 1 |
| M11 | all seven kinds | the form offers echo only | 13 |

## 7. Gate and rung

All exit 0, run serially, outputs under `/private/tmp/4-14-1/`: `cargo build --workspace`
(`cargo-build.txt`), `cargo test --workspace -- --test-threads=1` (`cargo-test.txt`: 1735 passed, 0
failed), `cargo clippy --workspace --all-targets -- -D warnings` (`clippy.txt`), `cargo fmt --check`,
`npm run check` (`npm-check.txt`: 504 files, 0 errors, 0 warnings), `npm test` (`npm-test.txt`: 97 files,
4391 tests), `npm run build` (`npm-build.txt`: 224 modules); bundle oracle — server-only markers absent,
client-only present (2); `cargo tree -p espansoconfig-core` holds no `tauri`.

Rung **`1735 / 504 / 4391 / 224`** (was `1735 / 501 / 4301 / 223`): no Rust test added; +3 `svelte-check`
files (`variableKinds.ts`, `variableKinds.test.ts`, `scripts/lint/no-execution.test.ts`); +90 vitest tests —
70 `variableKinds.test.ts`, 13 suite 8 of `MatchEditorVariables.test.ts`, 5 `no-execution.test.ts`, and 2
per-file inventory cases `scripts/lint/ipc-detail.test.ts` generates for the two new `src/` files (traced
with vitest's JSON reporter, `vitest.json`); **+1 Vite module**: `variableKinds.ts` (a new `.ts` module; no
new component).

## 8. Review

The adversarial review ([`docs/reviews/4-14-1.md`](../reviews/4-14-1.md)) returned **ship-with-fixes: 0
BLOCKERS + 2 SHOULD-FIX**. Each was fixed in the file it named and pinned by a regression that failed
first on the unfixed code; nothing else was changed. Evidence under `/private/tmp/4-14-1/`.

1. **SHOULD-FIX — check and spend separated by property reads** (`src/lib/browser/variableKinds.ts`).
   `kindProblemOf` validated one read of the form and `paramsOf` read it again, so a getter-backed
   `choices`/`args`/`echo` answering `valid` and then `bad\rvalue` passed the check and a different text
   was built. Fix: `snapshotOf` reads the kind, the name and each owned part **once** into owned plain
   values (`KindSnapshot`); `snapshotProblem` validates, `paramsOf` builds and list parsing runs from that
   snapshot only — `kindVariableOf`, `kindProblemOf`, `kindWarningsOf` and `kindAdditionViewOf` all go
   through it. Regression: `variableKinds.test.ts` *review fix — one snapshot of the form is validated and
   spent* (3 cases: `random`/`choices`, `script`/`args`, `echo`/`echo`; the description and the sent draft
   hold `valid` and no `\r`, and the getter is read exactly once). Failing first:
   `review-F1-failfirst.txt` (3 failed); fixed: `review-F1-fixed.txt`.
2. **SHOULD-FIX — the `mkfifo` exception checked only the module's opening**
   (`scripts/lint/no-execution.test.ts`). A `make_fifo` moved after the test module still passed. Fix:
   `testModuleRange` finds the `#[cfg(test)] mod tests { … }` braces by bounded brace matching (braces in
   strings, character literals and line comments not counted; a module that never closes answers
   `null`), and `isTheTestFifoIn` requires the hit strictly inside them, on a line that is exactly
   `std::process::Command::new("mkfifo")`, in `fn make_fifo`. Regression: *allows the fifo call only
   inside the cfg(test) module's braces* (the call inside passes; the same function after the module's
   closing brace, another command inside, and an unclosed module all fail). Failing first:
   `review-F2-failfirst.txt` (1 failed — the moved function was accepted); fixed: `review-F2-fixed.txt`.

**Gates after the fixes**, exit 0: `npm run check` (`review-npm-check.txt`), `npm test`
(`review-npm-test.txt`). Rung **`1735 / 504 / 4395 / 224`** (+4 vitest: 3 in `variableKinds.test.ts`, 1 in
`no-execution.test.ts`); no new file or module.
