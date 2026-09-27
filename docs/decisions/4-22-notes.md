# Phase 4-22 — Regex bench UI and capture insertion

**Status:** implementation record for step 4-22 of [`4-split-notes.md`](4-split-notes.md) §2, under
ruling 20 (the *Regex capture* row is the last of the ten `+ Insert` rows), ruling 28 (the bench runs in
Rust and says so in both languages) and ruling 29 (the window half is owed to 4-23). It draws what 4-21
built (`test_regex`, `docs/decisions/4-21-notes.md`). Driven step; **no window reading was performed or
claimed**. D11 wording is **proposed to the owner in §4, not adopted**: the shipped sentence is unchanged.

---

## 1. What changed and why

### 1.1 Model: `src/lib/browser/regexBench.ts` (new)

Values and pure functions plus one coordinator, following `preview.ts`:

- **`RegexBenchCommands`** (`testRegex` only) and **`REAL_REGEX_BENCH_COMMANDS`** — a separate injectable
  surface holding one reader, as `PreviewCommands` is.
- **`createRegexBenchCoordinator(commands, onChange)`**: every request takes the next number, and that
  number is the `request_id` sent. An answer is installed only when its number is still the latest
  (compared immediately before installing) **and** Rust echoed it; an earlier reply resolving after a
  later one is dropped. A mismatched echo settles as `failed { wrongRequest }`, a failed call or a
  rejection as `failed { ipc }`, so every request settles. `clear()` supersedes what is in flight. This
  closes 4-21 §5 item 2 (stale-reply handling is the caller's).
- **State** `idle | pending { request, last } | answered { request, answer } | failed { request, failure }`;
  `pending.last` keeps the previous result drawn while the next request is out.
- **`benchPatternOf(session)`**: the drafted `regex` box's text while the **drafted** trigger form is
  `regex`, else `null`. The bench has no pattern box of its own (decision 1).
- **`regexBenchViewOf(state, pattern, sample)`**: `testable`, `pending`, the last settled result
  (`found` / `notFound` / `refused` with its `compileFailure` / `failed`) with its group rows
  (`reference` is `{{name}}` or `null` outside the supported subset), and `behind` when the pattern or
  the sample differs from what the result was tested with.
- **`captureOfferOf(session, state)`**: the *Regex capture* row is `offered` only when the drafted form
  is `regex`, the last settled request tested **exactly** the pattern the draft holds now, and Rust
  answered `Tested` (compiled). The names are that answer's `group_names`, so a sample that does not
  match keeps them (Q7: "A capture name remains insertable even when the current sample does not
  match"). A refusal of any kind (compile, pattern or sample too large, capture or output limit)
  withholds the row: no group list came back.
- **`insertCaptureReference(session, state, name, field, selection)`**: re-derives the offer from the
  state it is handed, refuses `notOffered` / `notACapture` / `notAReference` / `noTarget`, and otherwise
  puts `{{name}}` in place of the selection through `recordCompoundChange` — one history step, focus
  moved to the key, caret after the reference. **It writes only the content key**: `vars` is untouched,
  so it spends no structure grant (decision 4).
- `captureTargetOf` (chosen → focused → focused last → first of `choiceTargetsOf`) and
  `captureInsertRefusalKey`.

`variableInsertion.ts` now exports `isReferenceIdentifier` (ruling 16's `[A-Za-z_][A-Za-z0-9_]*`), used by
`nameVerdictOf` as before and by the bench; behaviour unchanged.

### 1.2 Components

- **`src/lib/components/RegexBench.svelte` (new)**: an intro sentence, the sample `<textarea>` with a
  sentence saying line breaks are sent as line feeds, *Test the regular expression*, the pending and
  behind notices, and the result: the first match (through `SourceText`, or the empty-match sentence),
  each named group with what it captured, "took no part in the match" or "captured empty text", its
  `{{name}}` or the not-a-reference sentence; a refusal through `tRegexRefusal` plus
  `tRegexCompileFailure` for a compile failure; a failure through `tIpcFailure` or the wrong-request
  sentence. **Every result carrying an engine draws the compatibility sentence** with the version Rust
  named (decision 5).
- **`MatchEditor.svelte`**: new required prop `regexBenchCommands`; owns the coordinator and its
  mirrored `$state.raw`, clears it on destroy, draws `RegexBench` inside the trigger-side group while
  `benchPatternOf` is not `null`, and hands `VariableGroup` a `regexBench: () => benchState` reader.
- **`VariableGroup.svelte`**: new prop `regexBench`; the *Insert a regex capture* row after the six kind
  rows, drawn only while `captureOfferOf` offers it; its panel (new `GroupSelection` kind `capture` in
  `variableGroup.ts`) says only a reference is inserted and no variable is created, offers the target
  keys, one *Insert {{name}}* per insertable group, the non-subset names with the reason, the
  success line or the refusal (`tCaptureInsertRefusal`), and *Hide these controls*. A press reads the
  bench state **at the press** and the model re-derives the offer from it.

### 1.3 Plumbing

`createBrowserState` takes a seventh optional argument `regexBench` (default
`REAL_REGEX_BENCH_COMMANDS`) exposed as `BrowserState.regexBenchCommands`; `AppShell.svelte` passes the real
one; `DetailPane.svelte` hands it to the editor. `scripts/lint/composition-guards.ts` lists
`REAL_REGEX_BENCH_COMMANDS` in `BOUNDARY_BINDINGS`; its test names it in the composition root's reason
and inventories `RegexBench.test.ts` (`invokeZero`). `fixtures.ts`: `inertRegexBenchCommands()`, now
passed by the six suites that mount the editor.

### 1.4 i18n — 26 keys per language

`browser.regexBench.*` (18) and `browser.variableGroup.capture.*` (8), EN and ES; one accessor
`tCaptureInsertRefusal` in `src/lib/i18n/index.ts` over `captureInsertRefusalKey`. The target label and
the no-target sentence reuse `browser.variableGroup.choice.target` / `.noTarget`. No sentence states a
limit number (4-21 §5 item 5 stays as it was). The compatibility sentence (ruling 28, wording from
`phase-4-design.md` Q7):

- EN: *"Tested with this editor’s regex {version}. espanso 2.3.0 uses regex 1.5.5, so this result
  establishes nothing about whether espanso accepts this pattern or when it triggers."*
- ES: *"Probado con la versión {version} de regex de este editor. espanso 2.3.0 usa regex 1.5.5, así que
  este resultado no establece nada sobre si espanso acepta este patrón ni sobre cuándo se dispara."*

`{version}` is `RegexBenchAnswer.engine.version`, so the drawn number is Rust's (pinned to `Cargo.lock`
by 4-21's test); **2.3.0 and 1.5.5 are written into the dictionaries** — facts about espanso, which
nothing in the repository measures.

## 2. How each acceptance clause is met

Mounted: `src/lib/components/RegexBench.test.ts` (19, jsdom, the whole editor with a scripted
`test_regex` fake; `invoke` guarded at zero). Model: `src/lib/browser/regexBench.test.ts` (11, node).

| Clause | Evidence |
|---|---|
| Out-of-order replies ignored | *an earlier reply arriving after a later one is ignored* (EN, ES: ids 1 and 2 sent, 2 answered first, 1's text never drawn, no pending or behind notice); *a late reply for an old pattern brings back neither its result nor its captures*; *a reply echoing another request is not drawn as the answer*; model: supersession, `onChange` never saw the stale install, `clear()` drops in-flight |
| Captures from the current pattern | *an edit of the regex withdraws the row until the new pattern is tested, then offers its groups only* (row gone after typing, the new request carries the new pattern, the old group absent from bench and panel, an optional group drawn unmatched); *a sample that does not match keeps the pattern’s captures insertable*; model `captureOfferOf` |
| Row only for a current, compiling regex trigger | not drawn for a literal trigger (no bench either), before any test, while the only test is out, after a compile refusal, `PatternTooLarge`, `OutputLimit`; *draws a compile refusal and its reason, distinct from no match* |
| Inserts `{{name}}`, creates no variable | *inserts {{name}} at the selection and creates no variable* (EN, ES): selection (1,1) of `xy` becomes `x{{alpha}}y`, the success line is drawn, no *new* row appears, and the save sends `replace: Set("x{{alpha}}y")` with `var_intents` and `vars` empty; a non-subset name has no *Insert*; model refusals |
| Compatibility sentence EN and ES | *is drawn beside a result with the engine Rust named* and *beside a compile refusal too* (EN, ES): exact sentence with `1.13.1` from the answer, containing `1.5.5` and `2.3.0`; absent before any answer |

**What these prove and do not.** They prove which elements jsdom holds, what reached the injected reader
and the save port, and what the drafted buffers hold — over **scripted** answers: no pattern is compiled
in these suites, and nothing here says what `regex` accepts (4-21's Rust tests do). **A green suite is not
a screen**: whether the bench reads well, fits beside the trigger side, whether the caret lands where a
person expects in WKWebView (a real `selectionStart` after a button press), and whether the sentences are
readable are 4-23's window half and the owner's.

## 3. Decisions

1. **The bench tests the drafted regex box; it has no pattern box.** "Captures from the current
   pattern" and "a current, compiling regex trigger" are then one pattern, and a second pattern box
   would have been a second draft of the same key. Narrowest reading of "the bench component".
2. **Sent on *Test* only, never while typing.** The regex box's shipped sentence ("checked when you
   save, not while you type") stays true, and a request is a deliberate act; the result is kept and
   marked *behind* after any edit. The cost: the row disappears after every regex edit until *Test* is
   pressed again.
3. **The row's panel lives in the variables group** (ruling 20's list of ten rows), and the bench lists
   each group's `{{name}}` as text (Q7's "corresponding insertion choices") without a second *Insert*
   of its own, so there is one insertion path.
4. **No structure grant.** Inserting a reference is a content-text edit like *Insert cursor position*;
   R36/R37 govern variable and form structural actions, and this action creates none. It still refuses
   a key `choiceTargetsOf` does not offer (not editable, removed, or absent and empty).
5. **The compatibility sentence is drawn with every engine-carrying result**, a refusal included
   ("compilation failure describes this engine", Q7), not before the first answer, because the version
   is Rust's to name.
6. **Group names outside ruling 16's subset** (for example a Unicode letter) are listed with the reason
   and are not insertable. That is this application's rule, not a claim about espanso.
7. **Sample line breaks** (4-21 §5 item 3): said beside the box, not reconstructed. A sample is never
   written, so no carriage-return refusal applies to it.
8. **A mismatched echo is a failure of its own**, drawn with a sentence, rather than silently dropped,
   so a request always settles.

## 4. D11 — replacement wording presented to the owner (not adopted)

D11: when a save is refused because the regex does not compile, the outcome panel opens with
`code.saveVerdict.refusedForEditorModelErrors` — *"The result contradicts the shape espansoConfig models
for a snippet, so it was not saved."* / *"El resultado contradice la forma que espansoConfig modela para
un fragmento, así que no se guardó."* — above the `RegexDoesNotCompile` finding
(`3-6-3-notes.md` §4 item 3). **The shipped sentence is unchanged by this step.** Two options for the
owner's disposition at 4-23:

- **A — neutral verdict, every editor-model refusal** (one key changes; nothing else):
  - EN: *"Nothing was saved. The draft has a problem, listed below, that has to be fixed first."*
  - ES: *"No se guardó nada. El borrador tiene un problema, indicado debajo, que hay que corregir antes."*
- **B — a regex-specific lead when every finding is `RegexDoesNotCompile`** (a new verdict key and a
  model rule choosing it):
  - EN: *"Nothing was saved: this snippet’s regular expression did not compile under the version
    espansoConfig uses. The regex test under the trigger can try it on a sample before you save again."*
  - ES: *"No se guardó nada: la expresión regular de este fragmento no compiló con la versión que usa
    espansoConfig. La prueba de expresiones regulares bajo el disparador puede probarla con un ejemplo
    antes de volver a guardar."*

Either stays owed until the owner rules (split notes §4.6: 4-23's disposition may be "stays owed").

## 5. Open items

1. **Window half (4-23)**: EN/ES readings of compile failure versus no match, optional captures and
   Unicode, insertion at the intended caret, the engine-version sentence; D11's disposition.
2. **The row needs a *Test* after every regex edit** (decision 2). If the owner prefers the row to
   follow the regex live, that is a debounced automatic request — a later step, and the regex box's
   hint sentence would then need rewording.
3. **Fault position for a syntax error** (4-21 §5 item 1) is still not reported.
4. **26 new keys per language** join the Phase 4 translation inventory (4-24). None read on a window.
5. **The capture panel is not drawn when the variables section is not** — it is always pushed today
   (`matchEditorView`), so this is a dependency, not a gap.
6. Nothing enforces that `VariableGroup` is handed the editor's own bench state rather than another
   one: the type is a reader function, and the model re-derives the offer from whatever it is given.

## 6. Failing-first evidence, by mutation

The tests were written with the code; failing-first is shown by mutation (git not used). Ten mutations
applied, run against the two new suites, and restored byte for byte by `/private/tmp/4-22/mutate.py`;
outputs `/private/tmp/4-22/mutations/M*.txt`, summary `summary.txt`. **Every mutation was caught.**

| # | Mutation | Failed |
|---|---|---|
| M1 | the latest-request check removed from the coordinator | both out-of-order mounted cases (EN, ES), the old-pattern case, model supersession and `clear()` |
| M2 | the echoed id not compared | mounted wrong-echo case, model failures case |
| M3 | the offer does not compare the pattern | mounted *an edit of the regex withdraws the row…*, model offer and stale-refusal cases |
| M4 | the offer made for a refused answer | the three *is not drawn after …* cases, model offer |
| M5 | the pattern read whatever the drafted form | *not drawn for a literal trigger*, model literal case |
| M6 | the compatibility sentence removed | all four compatibility cases |
| M7 | the row drawn unconditionally | seven mounted row cases |
| M8 | the non-subset refusal removed from the insertion | model refusals case |
| M9 | every name treated as a reference | mounted non-subset case, model refusals case |
| M10 | the insertion also appends a variable | both mounted insertion cases and the model insertion case (the fabricated variable also broke two later ES cases in the same run) |

## 7. Verification

All exit 0; outputs under `/tmp/4-22-*.txt`: `cargo test --workspace -- --test-threads=1`,
`cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`, `npm run check` (519 files,
0 errors, 0 warnings), `npm test` (105 files, 4583 tests), `npm run build` (234 modules); bundle oracle:
server-only pattern absent, client-only present (2).

Rung **`1809 / 519 / 4583 / 234`** (was `1809 / 515 / 4545 / 231`): Rust unchanged (no Rust source
touched); +4 `svelte-check` files (`regexBench.ts`, `regexBench.test.ts`, `RegexBench.svelte`,
`RegexBench.test.ts`); +38 vitest tests — 19 + 11 in the two new suites and 8 from existing suites that
iterate files (`built-translation-keys`, `hardcoded-strings`, two in `composition-guards`, four in
`ipc-detail`); +3 Vite modules — `regexBench.ts` (1) and the styled `RegexBench.svelte` (2).

## 8. Review fix — 2026-09-27 (`docs/reviews/4-22.md`, one should-fix)

**Finding:** `VariableGroup.svelte`'s capture handler installed the new session but dropped the
insertion's `selection`. Replacing a textarea's value puts its caret at the end, so a second insertion
from the still-open panel landed after the text instead of after the first reference.

**Fix** (the two files the finding concerns): `MatchEditor.svelte` gains `placeCaret(field, selection)`,
which awaits `tick()`, focuses the `textarea[data-field=…]` and calls `setSelectionRange` — the same
steps `onInsertCursor` already takes for *Insert cursor position*. `VariableGroup.svelte` takes it as a
required `placeCaret` prop and calls it with the target key and `outcome.selection` after a successful
insertion. The model is unchanged.

**Test** (`RegexBench.test.ts`, +2, EN and ES): *each lands at the caret the previous one left, and
each is one undo step*: body `xy`, caret at 1; `{{alpha}}` gives `x{{alpha}}y` with the caret at 10,
then `{{beta}}` gives `x{{alpha}}{{beta}}y` with the caret at 18; one *Undo* restores `x{{alpha}}y`, a
second restores `xy`. **Failing-first:** against the unfixed handler both cases failed (`expected [ 11,
11 ] to deeply equal [ 10, 10 ]`; `/private/tmp/4-22/fix/failfirst.txt`). As with all mounted evidence,
this is jsdom's selection model, not WKWebView's; the caret on a real window is 4-23's.

**Verification** (outputs `/private/tmp/4-22/fix/`): `npm run check` exit 0 (519 files, 0 errors, 0
warnings), `npm test` exit 0 (4585 tests), `npm run build` exit 0 (234 modules); bundle oracle
unchanged (server-only absent, client-only present). Rung **`1809 / 519 / 4585 / 234`**; no Rust changed.
