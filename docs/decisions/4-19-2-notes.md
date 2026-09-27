# Phase 4-19-2 — Preview components and i18n

**Status:** implementation record for the second piece of step 4-19 of
[`4-split-notes.md`](4-split-notes.md) §2 (the dated 2026-09-27 addendum under `### 4-19` cuts the step
into 4-19-1 and 4-19-2). It draws 4-19-1's preview model ([`4-19-1-notes.md`](4-19-1-notes.md)) inside
the small editor: sample inputs, the sample instant and zone beside the result, the illustrative output
and its limitation states, with their EN and ES strings and the mounted acceptance. No Rust source
changed. No window reading was performed or claimed. The window half stays 4-20's.

---

## 1. What changed and why

### 1.1 The drawing decisions: `src/lib/browser/previewView.ts` (new)

Decisions as values, so the component is a walk (`CLAUDE.md` §6, *Frontend structure*):

- **`draftPreviewTargetOf(session)`** — the draft target an open editor previews: the session's
  `MatchId`, `baseRevisionOf(session)` and `matchDraftOf(baseline, draft.value)`. **Always the
  candidate route**, dirty or not, so the sample positions a shown answer offers are always the
  candidate's own (`4-19-1-notes.md` §3.2) and a saved analysis never addresses a draft.
- **`drawnAnswerOf` / `drawnShownOf`** — the answer drawn: the state's own, or, while a newer request is
  pending, its `last`, so the output does not blink away at each keystroke.
- **`previewBehindDraft(state, current)`** — whether the drawn answer's request no longer describes the
  draft (another identity, base revision or draft, compared in wire form).
- **`PreviewNotice`** (`pending`, `noMatchInCandidate`, `behindDraft`, `noSamples`, `noContent`,
  `instantMissing`) with `previewNoticeKey`, and `previewPlaceholderChipKey` for a placeholder's short
  in-output label.
- **`instantLabelOf(instant)`** — the instant as a fixed, locale-free `YYYY-MM-DD HH:MM:SS` in UTC
  (`null` beyond `Date`'s range, when the seconds count is drawn instead) and the zone as its IANA name
  or a `+HH:MM[:SS]` offset (`offsetText`).
- **`slotViewsOf(state, inputs)`** — one control per `sampleSlotsOf` slot of the shown answer's
  (candidate's) analysis, with what the inputs hold; **`editSlot`** — an entry box takes a whole number
  from 1 (sent as position `n - 1`) or nothing; anything else is refused and the inputs kept; a form
  field or capture value is used exactly as given.
- **`piecesOf(segments)`** — the output as drawable pieces (`literal`, `sample`, `choice` with its label
  and nested pieces, `placeholder` by name, `unresolved` with its text as written and its reason). Texts
  are carried unchanged.

`preview.ts` changed in one place: `placeholderName` is exported (JSDoc widened), for `piecesOf`.

### 1.2 The component: `src/lib/components/PreviewPanel.svelte` (new)

- Props `target: () => PreviewTarget` (read at each request and to compute *behind*), `commands:
  PreviewCommands`, `clock: SampleClock` — all required. It builds one coordinator
  (`createPreviewCoordinator`) whose `onChange` mirrors the state into `$state.raw`; `onDestroy` clears
  it, so an answer arriving after unmount installs nothing.
- **On request.** Nothing is sent until *Preview this draft* is pressed; after that *Refresh the
  preview*, or any sample edit, sends the next request, and *Close the preview* clears. A preview never
  follows draft keystrokes by itself (no debouncing exists — `4-19-1-notes.md` §5 item 4); instead the
  *behind the draft* notice says the drawn answer is out of date.
- **Output as text.** Every piece's text goes through `sourceSegments` (`sourceText.ts`) into text
  nodes — a line break a `<br>`, an invisible character (a lone `\r` among them) a named marker through
  `tInvisible` — inside a `white-space: pre` container written on one line of markup, as
  `SourceText.svelte` draws file text. The file holds no raw-HTML tag. No output text reaches a
  `<textarea>` or `<input>` (`CLAUDE.md` §6); the only boxes are the sample inputs.
- **Unresolved values** are drawn as written inside `<mark class="unresolved" data-unresolved={reason}
  title={tPreviewUnresolved(reason)}>`, and listed under the output (each distinct reason through
  `tPreviewUnresolved`, each placeholder kind through the new `tPreviewPlaceholderName`, the limit
  through `tPreviewLimit`, and a count line).
- **Placeholders** (`shell`, `script`, `clipboard`, `match`) are a bordered short label
  (`tPreviewPlaceholderChip`) whose tooltip is the 4-17 sentence; the authored command is not drawn in
  the output. No control runs, tests or reads anything; the only buttons are request and close.
- **The instant and zone are drawn beside the output** (an `<aside>` in the same flex row), taken from
  the drawn answer's own request (`answer.request.samples.instant`), with a sentence saying the zone
  stands in for the system zone espanso would use. A failure is drawn through `tIpcFailure`; a
  candidate holding no snippet at that place is its own notice.

### 1.3 Composition: the preview readers enter through `BrowserState`

The components could have defaulted to `REAL_PREVIEW_COMMANDS`, but a surface component reaches the
Tauri boundary only through the `BrowserState` it is handed (the 2d-6 record's §3 entry 37, checked by
`scripts/lint/composition-guards.ts`). So:

- `createBrowserState` (`workspace.svelte.ts`) takes a sixth parameter, `preview: PreviewCommands =
  REAL_PREVIEW_COMMANDS`, exposed as the plain member **`BrowserState.previewCommands`**; nothing in the
  state calls it.
- `AppShell.svelte` passes `REAL_PREVIEW_COMMANDS` explicitly (its composition comment names the sixth
  source); `DetailPane.svelte` hands `browser.previewCommands` to `MatchEditor.svelte`, whose new
  **required** prop `previewCommands` goes to the panel. `sampleClock` is optional on `MatchEditor`,
  defaulting to `SYSTEM_SAMPLE_CLOCK`, for the reason its `clock` prop has a default (a clock is not a
  boundary).
- `composition-guards.ts`: `BOUNDARY_BINDINGS` gains `src/lib/browser/preview` →
  `REAL_PREVIEW_COMMANDS`, so a component importing it is now reported. The test file's composition-root
  reason names it, and `PreviewPanel.test.ts` is inventoried as an `invokeZero` suite.
- `fixtures.ts`: `inertPreviewCommands()`, handed by the five existing `MatchEditor` mount sites
  (`MatchEditor`, `…Forms`, `…Scalar`, `…Triggers`, `…Variables` `.test.ts`).
- The panel's root class is `matchPreview`, not `preview`: `MatchEditorScalar.test.ts` queries `.preview`
  for the content-kind change's own preview, and the first run collided with it.

### 1.4 i18n

- **34 new keys per language** under `browser.preview.*` (`en.json`, `es.json`), real Spanish (tú
  imperative, as the existing dictionary): heading, the illustration sentence ("not espanso's own
  expansion: nothing is run, the clipboard is not read, and nothing is saved"), the three buttons, the
  failure line, six notices, the sample heading, six slot labels and the refusal, output and limitation
  headings, the choice label, the unresolved count, the instant heading and note, the UTC and
  seconds spellings, the two zone lines and four placeholder labels.
- `codes.ts`: `describePreviewPlaceholderName(locale, name)` (the 4-17 sentence by variant name, for the
  limitation list, which carries names). `index.ts`: reactive `tPreviewPlaceholderName`,
  `tPreviewPlaceholderChip`, `tPreviewNotice`. Static strings use `t('literal.key')`; codes go through
  the accessors; no key is built in a component.
- `dictionary_contract.rs` is unchanged: no Rust code was added. The parity suites cover the new keys.

### 1.5 Lint

`scripts/lint/no-execution.test.ts`: the preview case now also asserts that `previewView.ts` and
`PreviewPanel.svelte` are among the scanned frontend sources and hold no forbidden spelling (widened,
no new test).

## 2. How each acceptance clause is met

Mounted: `src/lib/components/PreviewPanel.test.ts` (18, jsdom by docblock, `invoke` mocked and asserted
never called after every case). Model: `src/lib/browser/previewView.test.ts` (10).

| Clause | Evidence |
|---|---|
| A superseded response cannot overwrite the current one on screen | two requests, the later answered first and the earlier after it: the screen keeps the later; the same with two sample edits in flight; an answer arriving after *Close* draws nothing |
| Preview changes no draft and no file; no writing command | a deep-frozen target is read and still equal afterwards, and a `Proxy` over the readers sees only `previewMatchCandidate`; inside the editor, after an edit and a preview, the box still holds the edit, **one** undo step exists and undoing restores the saved text, the reader got the editor's drafted `replace`, the save and reorder ports got nothing, and `invoke` — the one door to a file — was never called |
| Unresolved values stay identifiable | each `Unresolved` segment, a nested one in a `Choice` included, is a `mark.unresolved` holding its text as written with its reason's sentence as title (EN, and ES under an override); the reasons and the count are listed; a literal is never marked |
| HTML escaped | `<b>`, `<script>`, `<img onerror>`, `<i>` in a label and `<u>` in an unresolved text are characters in the output and no such element exists; no script ran; the component source holds no raw-HTML tag; a `\r` is a named marker, no `<textarea>` exists and no input holds a `\r` |
| No execution or clipboard-read control | with `Shell`, `Script` and `Clipboard` placeholders drawn, the only buttons are request and close; pressing every one never calls a stubbed `navigator.clipboard.read`/`readText`; the placeholder labels and sentences are drawn and the command text is not; the two new sources hold no clipboard-read, process, shell-plugin or `execCommand` spelling |
| Sample inputs, instant and zone beside the result | one box per candidate slot; an entry `2` sends position 1, a form value is sent as given (markup included), `0` is refused with its sentence and sends nothing; the request's instant is the injected clock's (`2024-03-31 01:00:00`, `Europe/Madrid`) and the `<aside>` drawing it is the output's sibling; a fixed offset is drawn as `+02:00`; `noMatchInCandidate` and a failure each draw their line |

## 3. Decisions and deviations

1. **Always the candidate route** for the editor (§1.1), rather than `preview_match` for a clean draft:
   one route means one source of sample positions.
2. **On request, not live**: the panel sends nothing until asked, then follows sample edits and
   *Refresh*; draft edits only raise the *behind* notice. This keeps the five existing editor suites'
   `invoke`-zero guard meaningful and the Rust side unloaded while typing (§5 item 2).
3. **A stale identity is drawn as the failure it is** (`tIpcFailure`) and does not re-read the file
   (`4-19-1-notes.md` §3.5 left this to 4-19-2).
4. **The instant is not editable** and not pinnable from the screen: `withPinnedInstant` exists in the
   model; no control uses it (§5 item 3).
5. **The instant is spelled in UTC** with the zone beside it, not as a local wall-clock time: a
   locale-free spelling needs no `Intl` formatting and cannot disagree with Rust's zone data.
6. **`BrowserState.previewCommands`** is a plain member rather than two wrapper methods: the readers
   hold no state and adopt nothing, and the coordinator's `PreviewCommands` surface (4-19-1 §3.5) is
   kept as the one injectable shape.

## 4. What is and is not guaranteed

- **Pinned by mounted tests and mutations (§6):** supersession on screen; no draft write and only the
  candidate reader reached; unresolved marking; text-only drawing; no run or clipboard-read control.
- **Not forced by TypeScript:** that a host hands a `target` that reads rather than writes (the
  `MatchEditor` one is pinned by M2); that `previewCommands` are the real readers; that the renderer
  draws pieces as text — the source scan and the mounted cases are what check this one renderer.
- **Not measured:** anything on a screen — layout, the `<aside>` really sitting beside the output at the
  editor's width, wrapping, tooltip behaviour, WebKit's rendering of the markers. That is 4-20's window
  half. The illustration sentence's claim is about this application; what espanso itself produces is
  not established (R16, R30).

## 5. Open items

1. **Window half (4-20):** EN and ES readings of the panel — the illustration sentence, the instant and
   zone lines, placeholder labels, unresolved marking, long output, a form's samples.
2. **Live preview while typing** is not offered; if wanted, it needs a debounce (4-19-1 §5 item 4).
3. **Pinning or choosing the sample instant** from the screen is not offered.
4. **Global `choice`/`random` variables** still have no sample slot (4-19-1 §5 item 3), and an entry
   box takes any number, an out-of-range one answering `SampleOutOfRange`.
5. **Sample positions versus revision** (4-19-1 §5 item 2): *corrected after the review (§8)* — the
   panel now drops every positional sample before requesting a draft whose drafted `vars` or
   `var_intents` differ from the ones it was entered against. What stays unchecked is the finer
   question: the comparison is of drafts, not candidates, so it is conservative — editing a variable's
   own text (a `choice` entry, a form layout) also drops that match's selections and form values, and
   the person re-enters them. Mapping a sample across a change instead would need Rust to report how
   candidate positions moved.
6. **The `+ Insert` popovers** (4-15) still say `notYetAvailable` — "this application does not show what
   espanso would produce for this variable" — and have no preview of their own; a popover sample before
   insertion would need a candidate that does not yet exist.
7. **34 new keys per language** join the Phase 4 translation inventory (4-24); no sentence has been read
   on a window.
8. A choice label or placeholder label drawn inside the `white-space: pre` output is prose styled as a
   marker (`nowrap`); whether that reads well is a window question.
9. **After the review (§8):** a refused entry is put back to the accepted one, but its sentence goes
   away at the next edit of any box (one shared `refusedSlot`), so a person who edits another box no
   longer sees why their `0` vanished. Whether a per-box sentence is wanted is a window question (4-20).
10. **After the review (§8):** closing the preview keeps the samples; reopening sends them again, a
   positional one only if the drafted variables are unchanged. Nothing says so on screen.

## 6. Failing-first evidence, by mutation

The tests were written against the new code, so failing-first is shown by mutation (git was not used):
eight mutations, each applied, the mounted suite run, and the file restored byte for byte (sha-256
checked) by `/private/tmp/4-19-2/mutate.py`; outputs `/private/tmp/4-19-2/mutation-M*.txt`, summary
`mutation-summary.txt`. Every one failed tests:

| # | Mutation | Failed |
|---|---|---|
| M1 | each request through a fresh coordinator (no shared generation) | the three supersession cases, and the sample-input case |
| M2 | the editor's `target` rewrites the session it reads | the in-editor no-draft-change case and the *behind* case |
| M3 | the panel writes the target it is handed | the frozen-target case |
| M4 | an unresolved value drawn as a plain literal | both unresolved cases |
| M5 | a literal drawn as markup (raw-HTML tag) | both markup cases |
| M6 | a literal drawn as a raw text node | the carriage-return case |
| M7 | a *run* button that reads the clipboard | the control case and the source scan |
| M8 | the *behind the draft* notice never drawn | the *behind* case |

## 7. Verification

All exit 0, run serially, outputs under `/private/tmp/4-19-2/`: `cargo test --workspace --
--test-threads=1` (`cargo-test.txt`, **1789 passed**, 0 failed, result lines summed); `cargo clippy
--workspace --all-targets -- -D warnings` (`clippy.txt`); `cargo fmt --check` (`fmt-check.txt`); `npm run
check` (`npm-check-4.txt`: **514 files**, 0 errors, 0 warnings); `npm test` (`npm-test.txt`: **4534
passed**, 102 files); `npm run build` (`npm-build.txt`: **231 modules**); bundle oracle — server-only
pattern absent, client-only present (2); `cargo tree -p espansoconfig-core` (`cargo-tree.txt`) holds no
`tauri`.

Rung **`1789 / 514 / 4534 / 231`** (was `1789 / 510 / 4498 / 227`):

- **+0 Rust tests**: no Rust source changed.
- **+4 `svelte-check` files**: `previewView.ts`, `previewView.test.ts`, `PreviewPanel.svelte`,
  `PreviewPanel.test.ts`.
- **+36 vitest tests**: 18 in `PreviewPanel.test.ts`, 10 in `previewView.test.ts`, and 8 from the
  parameterised per-file lint sweeps over the new sources (not traced individually).
- **+4 Vite modules**: `preview.ts` joins the bundle (+1, as 4-19-1 §5 item 1 foresaw), `previewView.ts`
  (+1), `PreviewPanel.svelte`, a styled component (+2).

## 8. Adversarial review and fixes

Review: `docs/reviews/4-19-2.md` (Codex adversarial review of the working tree), verdict
**ship-with-fixes**, **0 BLOCKERS + 2 SHOULD-FIX**. Both were fixed in the files the review named plus
the model and test files they need; nothing else was changed (anything else noticed is §5 items 5, 9
and 10).

1. **`PreviewPanel.svelte:116` — positional samples outlived the candidate they were entered for.**
   Select entry 2 of the variable at position 0, remove that variable, refresh: the request sent the
   selection to the variable now at position 0. **Fix:** `previewView.ts` gains `AnchoredInputs` (the
   inputs plus `variablesAnchorOf` the target their positional samples were entered against — identity,
   base revision, drafted `vars` and `var_intents`), `anchoredForRequest` and `editAnchoredSlot`;
   `preview.ts` gains `isPositionalSource` and `withoutPositionalSamples`. The panel's `refresh()`
   re-anchors before every request, dropping every selection and every `type: form` value when the
   anchor differs (captures, shorthand-form values and the pinned instant are kept), so the boxes clear
   and show what is sent; an edit is anchored to the drawn answer's own request target. Conservative
   by design (§5 item 5).
2. **`PreviewPanel.svelte:129` — a refused entry stayed on screen.** Enter `2`, replace it with `0`
   (refused), edit another box: `2` was sent while the box still read `0`. **Fix:** the first of the
   review's two options — `editSlot`'s refusal now carries the text the box held under the kept inputs
   (`slotTextOf`, also used by `slotViewsOf`), and the panel puts the box back to it at once, so a box
   never shows a value other than the one sent. No request is sent for the refused text (unchanged).

**New tests.** `PreviewPanel.test.ts` (mounted): *puts a refused entry back to the accepted one…*,
*drops a positional sample before requesting a candidate whose variables changed*, and a guard, *keeps
a positional sample while the drafted variables stay as they were*. `previewView.test.ts`: the
refusal's text, and three cases for the anchor (kept for the same variables; only positional samples
dropped on a change; samples from other variables dropped before an edit against the drawn answer).

**Failing-first.** The three mounted tests were added and run against the unfixed code before any fix
(`/private/tmp/4-19-2/review-failfirst.txt`): the two review regressions **failed** (`expected '0' to be
'2'`; the selection `[{ index: 1, variable: { Local: { index: 0 } } }]` sent where `[]` was expected),
and the guard passed, as a guard should.

**Verification after the fixes** (outputs `/private/tmp/4-19-2/*-after-fix.txt`), all exit 0: `npm run
check` (**514 files**, 0 errors, 0 warnings); `npm test` (**4540 passed**, 102 files); `npm run build`
(**231 modules**); bundle oracle — server-only pattern absent, client-only present (2). No Rust was
touched, so the Rust gate was not re-run.

Rung **`1789 / 514 / 4540 / 231`** (was `1789 / 514 / 4534 / 231`): +6 vitest tests (3 mounted, 3 in
`previewView.test.ts`); no new module or file.
