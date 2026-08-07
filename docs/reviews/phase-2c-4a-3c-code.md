# Phase 2c-4a step 3c aggregate code review

## Verdict

**NOT READY.** The five findings from the window reading are correctly repaired on the paths that
produced them, but the type-level sweep finds the same operation/authored-text label distinction
still missing from the refused arm. That is the narrower instance this phase's history says not to
leave behind. The new reveal also collapses distinct outcome-arm transitions into one reactive cue,
so one of its broader guarantees is not implemented.

This review covers the uncommitted step-3c source files and new untracked files, excluding the
temporary probe and its four marked hook lines as requested. No implementation file was changed.

## Findings

### Medium — the refused arm still labels an operation as editing

**File:** `src/lib/browser/rawSave.ts:152` (production at lines 281–285 and 379–385; rendered, for
example, by `src/lib/components/MatchDuplicator.svelte:671`)

`RawSaveChoice` has one context-free `keepEditing`, `refusalChoices()` returns it without knowing
what the surface drafts, and `rawSaveChoiceKey()` always maps it to
`browser.rawSave.choice.keepEditing`. Consequently an acknowledgeable duplication refusal—the
duplicator's documented ordinary first outcome—draws *Keep editing* / *Seguir editando*. The mover
and deleter do the same for any refusal with findings. Nothing is being edited on those three
`operationChoice` surfaces.

This is not a sound deferral. It is exactly the narrower-instance pattern cited by the decision
record: the type now says the meaning of the non-destructive conflict choice depends on
`ConflictDraftKind`, while the adjacent refusal-choice type still cannot express that fact. The age
of `rawSave.ts` does not make its current output truthful, and absence from a prior window transcript
is a gap in evidence, not evidence that a reachable label is correct. In particular, duplication's
acknowledgeable refusal is already an ordinary modeled and mounted path.

Why it matters: it leaves the same Medium user-facing semantic defect open immediately after the
record claims to have swept beyond `conflictChoiceKey`. It also makes the record's rationale circular:
the earlier round missed a narrower arm, so this round deliberately leaves the next narrower arm.

Smallest correct fix: pass the surface's `ConflictDraftKind` through `describeRefused()` (the public
`describeEditSave()` already receives `ConflictCapabilities`), and make the refusal choice or its
accessor carry that kind. Use `keepOperation` for the three operation surfaces and `keepEditing` for
the three authored-text surfaces. Add model and mounted refusal cases for both kinds, including the
duplicator's normal acknowledgeable refusal, then take the previously missing refusal arm in a
window. This is a signature change, but it is a narrow, local one and is the change required for the
type to state the rule.

### Low — the reveal cue does not distinguish one outcome arm replacing another

**File:** `src/lib/components/reveal.ts:73`

`outcomeReveal()` maps `saved`, `refused`, and an idle `conflict` to the same primitive value,
`'panel'`. Each component's `$effect` therefore depends on a cue that does not change when one of
those arms replaces another while the same bound panel element remains mounted. A concrete path is
an acknowledgeable refusal followed by *Save anyway*: `beginSave()` retains the old outcome while
the request is in flight, and the successful result replaces `refused` with `saved` without a
`null` interval. The panel node and the `'panel'` cue are unchanged, so the effect need not run and
the new saved outcome's first line is not brought into view.

This contradicts `reveal.ts`'s “for every arm as it appears” contract and the decision record's
claim that the earlier committed-panel Low is closed generally. The new tests cover `null → arm`
and `conflict idle → confirming`, but not `refused → saved` or any other arm-to-arm replacement;
`reveal.test.ts:71` only calls the pure function separately and cannot exercise Svelte dependency
identity.

Why it matters: after pressing a control at the bottom of a long refused panel, the replacement
success panel may begin above the viewport while the user remains near the old controls—the same
class the reveal was introduced to fix.

Smallest correct fix: make the reactive cue retain arm identity, for example distinct
`savedPanel`, `refusedPanel`, and `conflictPanel` values (plus `conflictChoices`), while mapping the
three panel values to `block: 'start'` in the DOM helper. Add one mounted refusal-to-saved case that
clears the scroll spy before the second result and requires a new `start` reveal.

### Low — the pure reveal rule is placed in the renderer layer

**File:** `src/lib/components/reveal.ts:33`

The DOM call belongs in `components`, but `OutcomeArm`, `OutcomeReveal`, and `outcomeReveal()` decide
from save-model state whether nothing, the panel, or the confirmation choices must be revealed.
That is a rule. The file explicitly restates the browser model's arm union to avoid depending on
`src/lib/browser/`, which reverses the project's binding architecture rule rather than satisfying
it. A second renderer can still omit the cue while walking the browser view faithfully; the six
mounted suites are the only enforcement.

Why it matters: the placement repeats the precise architecture failure the project rule names. The
shared helper prevents six implementations from disagreeing, but it does not make a presentation
decision in `components` into browser-model data.

Smallest correct fix: move the pure cue type/function into `src/lib/browser/` (or expose the cue on
the six browser views through one shared browser function), and leave only the guarded
`scrollIntoView` machinery in `src/lib/components/`. The two bindings and one effect per distinct
panel are reasonable renderer wiring; they need not be folded into one large shared Svelte panel.

## Review of the five recorded fixes

1. **§10.1 Spanish creator wording — correct.** Both dictionaries use the same drafting claim:
   *drafted against* and *se redactó sobre*. The Spanish no longer says the file or snippet was
   written, and it does not conflict with *No se ha escrito nada*. Placeholder parity is intact.
   The dictionary guard is not vacuous for the reported regression: reverting to *se ha escrito*
   matches `escrito` and fails, while the control proves each locale's token list can fire. Its
   honest limit is that it recognizes only the listed forms, not every possible synonym for a file
   write. The mounted creator assertion by itself would not pin the prose because it derives its
   expectation from the same dictionary, but the dictionary invariant supplies the missing
   mutation guard.

2. **§10.2 conflict `keepEditing` label — correct on the conflict arm.**
   `conflictChoiceKey()` now branches `keepEditing` exactly as it already branches
   `confirmReload`; all six components call `tConflictChoice()` with their declared draft kind.
   Model tests distinguish the keys, check both locales against the old editing vocabulary, and
   mounted tests cover all six sides of the split. Reverting the branch or a renderer argument
   fails them. The six changed model comments now name the stable `keepEditing` choice and, where
   relevant, state its operation-surface label. The adjacent refused-arm instance remains open as
   the Medium finding above.

3. **§10.3 initial panel reveal — correct for `null → outcome`.** The Svelte 5 effect runs after DOM
   bindings are updated, so it sees the mounted panel. It does not subscribe to scroll position and
   therefore does not fight a user's manual scrolling merely because they scroll. On unmount,
   Svelte disposes the effect; null bindings are also guarded, so it cannot call a detached target
   through this state. All six mounted tests would fail if their panel binding, effect, or initial
   reveal were removed. The broader arm-replacement guarantee has the Low gap above.

4. **§10.4 confirmation-row reveal — correct.** Changing the confirmation state changes the cue to
   `choices`; `block: 'end'` targets the bound controls row, with a guarded panel fallback. The
   mover correctly uses its model's `reloadWarning !== null` representation rather than inventing a
   second boolean. The six mounted cases falsify removing the choices binding, reading the wrong
   confirmation field, or reverting to the initial-panel target.

5. **§10.5 raw reload refusal — correct.** `rawEditorDiskRefusalKey()` is exhaustive over the same
   refusal union but names the reload-specific sentence, and `RawEditor.svelte` calls the dedicated
   accessor for `view.diskRefusal`. The opening refusal retains its original accessor. The mounted
   test requires the new sentence, rejects the opening sentence in that location, checks the
   disabled confirmation, and checks that neither the draft nor window adoption changed; reverting
   the accessor fails it. The English and Spanish sentences mean the same thing. Spanish
   *no cargará esa versión en este editor* names loading—not writing—and *el archivo no se escribe
   en ningún caso* agrees with the unchanged draft and unwritten file.

## Svelte effect and test-quality assessment

The effect is safe with respect to DOM timing, unmount, and ordinary user scrolling. Its dependencies
are the derived cue and the two bound nodes; text edits, locale changes, and scrolling do not by
themselves retrigger it while those values stay stable. Binding changes may legitimately rerun it
when a target appears or disappears. The defect is the opposite of over-firing: distinct arms are
collapsed to the same cue, so a meaningful transition can be missed.

The new tests are mostly behavioral and mutation-sensitive:

- the label tests traverse the real accessor and mounted markup and reject the old key;
- the reload-refusal test distinguishes the two visible sentences and state effects;
- the scroll tests observe target and alignment, which is the relevant DOM behavior even though
  `scrollIntoView` must be spied in jsdom;
- the reveal helper tests correctly cover missing/throwing platform support and target fallback;
- the i18n guard really falsifies the exact Spanish revert and proves its token lists are live.

The missing behavioral case is an arm replacing another arm on the same mounted panel. Also,
`outcomeReveal()`'s “every arm” unit case asserts the mapping in isolation, not the Svelte transition
the comment claims; it therefore passes while the Low defect remains.

No component builds a translation key for the changed codes: each calls an accessor. No conflict
offers `saveAnyway`; no automatic reload, dirty-state clearing, cross-revision match
identification, diff, or “keep my draft” behavior was introduced. The reviewed change does not add
`tauri` to `crates/espansoconfig-core`.

## Commit gate

**NOT READY** until the operation-surface refused label is modeled truthfully and the reveal cue
distinguishes arm replacement. The pure reveal decision should also be moved to the browser layer
to satisfy the binding architecture rule.

## Round 2 — confirmation pass

### Verdict

**NOT READY.** All three round-1 findings are closed in production code, O1 is closed on all six
renderers, and the focused nine-file suite passes (232 tests). The fix round nevertheless introduces
one Medium documentation defect in this project's named worst class: both new records and the new
production JSDoc claim an exhaustive set of refusal causes that the implementation does not give.

### Finding

#### Medium — the records' proof that `reloadUnavailable` is window-unreachable omits two real refusal paths

**Files:** `src/lib/browser/saveOutcome.ts:1316`,
`docs/decisions/2c-4a-3c-4-notes.md:113`, and
`docs/decisions/2c-4a-3c-4-retake.md:252`

The three passages say `BrowserState.adoptDiskVersion()` answers `refused` **only** for an
unregistered conflict, an unprojected document, or a moved projection generation. The current
implementation has five refusal returns: it also refuses a confirmation issued for another conflict
at `src/lib/browser/workspace.svelte.ts:1768–1772`, and a confirmation already spent at lines
1773–1779. Therefore the exhaustive “only” claim is false by inspection of the code.

The narrower conclusion — that neither localized `reloadUnavailable` sentence is reachable through
the current window controls — is consistent with the current renderer path: `DetailPane.svelte`
forwards the conflict and confirmation together at lines 219–224, each surface obtains that
confirmation from the conflict it is showing, and after any adoption refusal its model withdraws the
reload controls. The mounted suites honestly script a `refused` adoption; they do not establish which
of `BrowserState`'s five guards produced it. The historical statement that none of the 22 launches
drew the sentence is evidence about those launches, not an exhaustive proof from the implementation.

Why it matters: the records use an incomplete description of the code as the proof of an evidence
boundary. That is precisely the decision-record/doc-comment guarantee mismatch called out in
`CLAUDE.md` section 6, even though the user-visible implementation remains correct.

Smallest correct fix: amend all three passages to name all five refusal guards, then state separately
why the current UI cannot supply a wrong or spent confirmation and cannot remove or advance the
registered projection while that conflict panel owns the interaction. Keep the mounted-only coverage
limit; do not turn the 22-launch absence into stronger evidence than it is.

### Confirmation of the code fixes

1. **Round-1 Medium — closed.** `rawSaveChoiceKey(choice, draftKind)` requires the kind with no
   default (`src/lib/browser/rawSave.ts:412–426`), and `tRawSaveChoice` requires and forwards it
   (`src/lib/i18n/index.ts:464–466`). All six components pass their own
   `CONFLICT_CAPABILITIES.draftKind`. Keeping `refusalChoices()` context-free is sound: it produces
   stable actions, while the accessor is where those actions become labels. A caller can pass the
   wrong kind, but cannot silently omit it; every mounted surface asserts its own label and rejects
   the other one. No unreachable `RawSaveChoice` member was added.
2. **Round-1 reveal Low — closed.** `OutcomeReveal` has distinct `savedPanel`, `refusedPanel`, and
   `conflictPanel` identities plus `conflictChoices` (`saveOutcome.ts:1376–1386`), and
   `outcomeReveal()` returns them exhaustively at lines 1411–1428. `revealOutcome()` maps the three
   panels to the same `block: 'start'` DOM operation and choices to `block: 'end'`
   (`components/reveal.ts:87–105`). Each mounted arm-to-arm case clears its scroll log before the
   retry, asserts the same panel node, and requires exactly one new start reveal; for example,
   `RawEditor.test.ts:1044–1068` and the deleter's distinct two-confirmation route at
   `MatchDeleter.test.ts:721–753`. The component would not do that anyway with the former shared cue.
3. **Round-1 placement Low — closed.** `OutcomeArm` is derived from
   `SaveOutcomeModel<unknown>['kind']` in `saveOutcome.ts:1347`; the pure rule and cue type now live in
   `src/lib/browser/`. `components/reveal.ts` retains only DOM machinery and imports
   `OutcomeReveal` as a type, so this creates no runtime import cycle. It widens `saveOutcome.ts`'s
   exports only by relocating the public cue API, and changes behavior only through the intended arm
   identity.
4. **O1 — closed in code.** `reloadUnavailableKey()` uses the shared branch at
   `saveOutcome.ts:1329–1334`, `tReloadUnavailable()` is the accessor at `i18n/index.ts:712–714`, and
   all six components call it with their surface declaration. English and Spanish have the same two
   meanings at `en.json:150–151` and `es.json:150–151`; no component retains the old bare key.

The production sweep finds five callers of `draftKindWording`: `conflictChoiceKey`,
`reloadUnavailableKey`, `reloadWarningFor`, `describeConflict`, and `rawSaveChoiceKey`. The only
other production comparison with `draftKind === 'authoredText'` is
`conflictChoicesFor()` at `saveOutcome.ts:354`. Its purpose is genuinely different: it gates whether
one action exists, rather than choosing authored-text versus operation wording. No sixth wording site
was found as a bare key, hardcoded sentence, or unbranched accessor.

The generic signature constrains both supplied arms to a common `T` and requires both properties; it
also lets the message-code callers share the same branch. It does **not** prove semantic pairing: a
caller can swap the two values, or provide two wrong values of the same `T`, and type-check. The code
and records state this limit honestly (`draftKind.ts:54–71,89–93` and 3c-4 notes lines 144–147), and
the callers' focused tests pin the actual pairs. Thus the generic centralizes the branch; it does not
make wording meaning a type-level guarantee.

### Records and test quality

The correction material in `2c-4a-3c-3-notes.md` leaves the rejected reasoning visible and appends
its refutation. The corrections at lines 125–149, 177–187, 198–207, and 335–341 agree with the current
code. Section 7.3's appended qualification at lines 433–436 is also true, although it is inline rather
than a separately headed correction block. None rewrites the historical argument.

The new tests are mutation-sensitive by construction. Reverting the refused-label branch changes the
key expected by two model assertions and all six mounted surfaces; collapsing reveal identity leaves
the second same-node transition with no new reactive dependency; reverting the unavailable branch
draws the opposite key on operation surfaces. The reported historical mutation counts cannot be
reconstructed from current files alone, but their stated failure modes match these assertions. The
current focused run is **9 files / 232 tests, all passing**.

### Commit gate

**NOT READY** until the false exhaustive refusal-cause claim is corrected in the production JSDoc and
both new records. No source behavior change is required.
