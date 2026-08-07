# Phase 2c-4a step 3c-4 — the review fix round

`docs/reviews/phase-2c-4a-3c-code.md` returned **NOT READY** over three findings; the orchestrator
found a fourth instance of the first one. This step fixes all four, extends the suites, corrects the
previous round's record where it argued for what has now been fixed, and re-takes the window reading
on all six write surfaces in both languages (`docs/decisions/2c-4a-3c-4-retake.md`).

**The probe harness stays in the tree.** Removing it is the next step, and every gate below was run
with it there.

---

## 1. What changed

| File | What |
|---|---|
| **`src/lib/browser/draftKind.ts`** | **new** — `ConflictDraftKind` (moved) and `draftKindWording`, the rule stated once |
| `src/lib/browser/saveOutcome.ts` | re-exports the type; `conflictChoiceKey`, `reloadWarningFor` and `describeConflict` call the shared rule; **`reloadUnavailableKey`** is new; **`OutcomeArm`, `OutcomeReveal` and `outcomeReveal` moved in** from `components/` and the cue gained arm identity |
| `src/lib/browser/rawSave.ts` | `rawSaveChoiceKey(choice, draftKind)` — the review's Medium |
| `src/lib/components/reveal.ts` | keeps `revealOutcome` and `scrollQuietly` only; imports `OutcomeReveal` from the browser layer |
| `src/lib/i18n/index.ts` | `tRawSaveChoice(choice, draftKind)`; **`tReloadUnavailable`** is new |
| `src/lib/i18n/en.json`, `es.json` | 1 new key each, at parity |
| the six `.svelte` write surfaces | `outcomeReveal` imported from `../browser/saveOutcome`; `tRawSaveChoice` and the withdrawn-reload sentence given the surface's own `CONFLICT_CAPABILITIES.draftKind` |
| `src/lib/browser/saveOutcome.test.ts` | +9 cases: the shared rule, the new key, and the cue suite moved here from `reveal.test.ts` |
| `src/lib/browser/rawSave.test.ts` | +1 case, 3 existing cases widened over both draft kinds |
| `src/lib/components/reveal.test.ts` | −4 cases (the cue suite moved out), the rest rewritten for the five-valued cue |
| the six mounted component suites | +2 cases each: the refused arm's label, and the arm-to-arm reveal |
| `docs/decisions/2c-4a-3c-3-notes.md` | **four correction blocks**, §2.2, §2.3 (decisions 1 and 3), §4.3 and §7.3 |
| `src/probe.ts` | two temporary additions: a three-armed outcome classification, and the `anyway` step |
| `<scratch>/launch.sh` | a `suspect` flag, and a fix for a two-minute stall per launch (retake §1) |

Nothing in `src-tauri/` changed. Nothing in `crates/` changed. **No wire type, no command, no
transition and no state machine changed** — every fix is a key, a label, a sentence or a scroll cue.

---

## 2. The four findings

### 2.1 The Medium — the refused arm still labelled an operation as editing

`rawSaveChoiceKey` mapped `keepEditing` to `browser.rawSave.choice.keepEditing` unconditionally, so
the **duplicator's ordinary acknowledgeable refusal** — a byte-exact copy keeps its source's trigger
definition, the transaction says so on the first attempt, and the panel offers *Save anyway* beside a
way out — drew *Keep editing* / *Seguir editando* about a copy nobody typed. The mover and the
deleter did the same for any refusal carrying findings.

**3c-3 deferred this deliberately and the review overruled the deferral.** The refutation is worth
keeping in the words it was written in: *the age of `rawSave.ts` does not make its current output
truthful, and absence from a prior window transcript is a gap in evidence, not evidence that a
reachable label is correct.* `2c-4a-3c-3-notes.md` §2.2 and §4.3 now carry correction blocks saying
so, in place, with the original reasoning left legible beside its refutation.

**The fix is on the accessor, not on the choice**, which is what made the "signature change to a
module three sub-phases older" objection evaporate: `rawSaveChoiceKey(choice, draftKind)` and
`tRawSaveChoice(choice, draftKind)`. `refusalChoices`, `offeredRefusalChoices` and all six views that
carry their answer are untouched.

**`RawSaveChoice` gained no third member, and that was a decision.** A `keepOperation` value would
make both arms nameable on every surface, so each of the six components' exhaustive `refusalAction`
switches would grow an arm it can never reach — six unreachable branches to buy one label. The
choice's name is stable; the label is chosen from it.

**No new key.** `browser.saveOutcome.choice.keepOperation` — *Leave this as it is* / *Dejarlo como
está* — is drawn on the refused arm too, because it is the same offer with the same consequence: the
panel goes and the operation stays set up. Two keys reading the same is what `conflictChoiceKey`'s own
comment argued against.

### 2.2 The first Low — the reveal cue did not distinguish one arm replacing another

`outcomeReveal` answered a single `'panel'` for `saved`, `refused` and an idle `conflict`, so each
component's `$effect` depended on a value that **did not change** when one arm replaced another over
the same bound element. The path is this application's most ordinary one: an acknowledgeable refusal
followed by *Save anyway*. `beginSave` retains the outcome in flight, so `saved` replaces `refused`
with no `null` interval — same panel node, same cue — and the effect need not run at all, leaving the
person near the controls of the panel that has just gone with *The file was written* above the
viewport.

The cue is now `'none' | 'savedPanel' | 'refusedPanel' | 'conflictPanel' | 'conflictChoices'`. **All
three panel values still map to `block: 'start'`**, so nothing about *where* anything is scrolled
changed; what they buy is arm identity, which is upstream of the DOM helper entirely.

`reveal.test.ts` calls the pure function separately and **cannot** exercise Svelte dependency
identity — the review says so — so the case that proves this is *mounted*, once per surface, and it
clears the scroll spy before the second result so what it asserts is a **new** reveal. The deleter
reaches the same transition by a route of its own: its *Save anyway* records consent and re-raises
the confirmation without sending, so it is the second *Delete it* that replaces `refused` with
`saved`. That is written into its case rather than worked around.

### 2.3 The second Low — the pure reveal rule sat in the renderer layer

`OutcomeArm`, `OutcomeReveal` and `outcomeReveal` decided from save-model state what had to be
revealed, in `src/lib/components/`, and the file **restated the browser model's arm union as three
literals specifically to avoid depending on `src/lib/browser/`**. Avoiding the dependency is the
reverse of the architecture rule rather than a way of satisfying it.

They are in `src/lib/browser/saveOutcome.ts` now, and `OutcomeArm` is `SaveOutcomeModel<unknown>['kind']`
rather than three written-out literals — so a fourth save arm is a compile error in `outcomeReveal`
instead of a silent gap in the cue. `src/lib/components/reveal.ts` keeps `revealOutcome` and
`scrollQuietly`: pointing a viewport is a question only a document can answer, and that half really is
DOM machinery. The two `bind:this` and one `$effect` per surface are unchanged.

### 2.4 O1 — a third instance of the same sentence, found by the orchestrator

`browser.saveOutcome.reloadUnavailable` ends *"…Keep editing, or stop and open the file again."* /
*"…Sigue editando, o cierra esto y vuelve a abrir el archivo."* and was rendered by a **bare key
literal** on all six surfaces, three of which draft an operation and edit nothing. It is the same
defect as reading finding §10.2 and as the review's Medium, one sentence along.

Fixed by the same rule: `reloadUnavailableKey(draftKind)` in `saveOutcome.ts`, `tReloadUnavailable` in
the i18n layer, and one new key per language. A bare key literal was legal only while there was one
key; there are two now, and a code reaches a screen through an accessor in this project.

**This arm is not reachable from a window, and that is said plainly rather than dressed up.** The
sentence is drawn for a `DiskAdoptionOutcome` of `refused`, and `BrowserState.adoptDiskVersion`
answers `refused` only for a conflict the window did not register, an unprojected document, or a
projection generation that has moved — and **no control on a conflict panel can move a projection
generation** (`2c-4a-3c-2-window-reading.md` §11). What covers it is the six mounted suites, which
script the adoption answer directly; the re-take does not claim to have drawn it.

> **Correction (2c-4a-3c-5), the confirmation pass's Medium.** The paragraph above proves a true
> conclusion from a **false premise**, which is this project's named worst defect class
> (`CLAUDE.md` §6): the word *only* names three refusal causes and
> `BrowserState.adoptDiskVersion` has **five** refusal returns
> (`src/lib/browser/workspace.svelte.ts:1768–1811`). In the code's own order they are:
>
> 1. **the confirmation was issued for another conflict** — `authorizeDiskAdoption` answers `null`
>    (1768–1772);
> 2. **the confirmation has already been spent** through this state — `spentConfirmations.has`
>    (1773–1779);
> 3. **this state never registered that conflict**, or the origin `rememberTheConflict` recorded
>    names a different document from the one the payload carries (1780–1786);
> 4. **the document is no longer projected here** — `viewOf(origin.document)` is `undefined`
>    (1787–1792);
> 5. **the projection generation has moved** since the conflict arrived (1802–1811).
>
> Guards 1 and 2 were omitted, and the omission is not cosmetic: they are the two a *caller* can
> supply, so a list without them describes the window's reach instead of the method's.
>
> **The conclusion stands, and here is the argument for it rather than the assertion.** Guards 1
> and 2 are closed by how a confirmation is minted and spent — `reloadConfirmed` issues it from the
> conflict the session is showing and stores it on that session's `ReloadStep`; every surface mints
> and spends in **one synchronous expression** (`MatchEditor.svelte:510` and its four twins,
> `RawEditor.svelte:278`); `DetailPane.svelte:219–224` forwards the conflict and that confirmation
> together and retains neither; and the spend leaves the `confirmed` step in the same handler
> (`NOT_RELOADING` on a success, `RELOAD_REFUSED` on a refusal), after which `offeredReloadStep`
> returns `unavailable` and `conflictChoicesFor` names no reload label at all. So no control can
> pair a confirmation with another conflict, and none can present a spent one. Guard 3 is closed
> because every conflict a surface can show arrived through one of the six writing wrappers, each of
> which calls `rememberTheConflict` for that document at the moment it arrived; there is no other
> route by which a `ConflictModel` reaches a surface. Guards 4 and 5 ask about the projection, and
> **no control drawn while a conflict panel owns the interaction removes or replaces one**: the
> panel offers *Keep editing*, the copy where it is honest, and the reload pair, and the single
> control that calls `BrowserState.rereadDocument` — `reloadFile`, on the mover and the duplicator —
> is offered only from `session.sendFailure`, which a conflict outcome does not set.
>
> **What that argument is worth is stated with it.** It is about the controls this window draws. It
> is **not** a proof that a reprojection begun before the panel appeared cannot land while it is
> open — that is exactly the case guard 5 exists for, and the JSDoc on
> `BrowserState.adoptDiskVersion` says so. The coverage limit is unchanged and is not strengthened
> here: the six mounted suites script the adoption answer directly, so they do **not** establish
> which of the five guards produced it, and the twenty-two launches that drew neither sentence are
> evidence about those launches.
>
> The production JSDoc on `reloadUnavailableKey` in `src/lib/browser/saveOutcome.ts` and
> `2c-4a-3c-4-retake.md` §8 item 1 carried the same false *only* and are corrected in the same
> round; `2c-4a-3c-5-notes.md` §1 is that round's own record.

### 2.5 The rule, stated once

All three instances now call one function:

```ts
// src/lib/browser/draftKind.ts
draftKindWording(draftKind, { authoredText, operationChoice }): TranslationKey
```

It is **generic**, and that is load-bearing rather than decoration: three callers choose a
`TranslationKey` — `conflictChoiceKey`, `reloadUnavailableKey`, `rawSaveChoiceKey` — and two choose a
`SaveOutcomeMessage` code and leave the key to `saveOutcomeMessageKey`: `reloadWarningFor` and
`describeConflict`. Written as two functions those would be two rules, and one rule written twice is
precisely what the review's Medium cost.

**It is a module of its own rather than a function in `saveOutcome.ts`** for one mechanical reason:
`saveOutcome.ts` already imports `rawSave.ts`, so a rule the lower module imports from the higher one
is a cycle, and a rule both import from a third is not.

**One `draftKind === 'authoredText'` deliberately did not move**, and it is written down in
`draftKind.ts` itself: `conflictChoicesFor`'s copy guard asks whether a copy could be honest at all
and answers *offer it* or *do not*. That is one branch, not a choice between two forms, and folding
it in would make the rule mean two things.

What it forces is that a caller supplies **both** wordings and picks neither. What it cannot force —
in the same sentence — is that a caller passes the draft kind *its own surface* declares. It takes an
ordinary `ConflictDraftKind`, so a component may hand over the wrong one; what is closed is that it
cannot omit the question. That is the same limit `tConflictChoice` has carried since 2c-4a-3b.

---

## 3. The keys

One added per language, at parity. **No key was removed**, and
`browser.saveOutcome.choice.keepOperation` gained a second drawing site rather than a twin.

| Key | en | es |
|---|---|---|
| `browser.saveOutcome.reloadUnavailableOperation` | *"…nothing was discarded. **What you asked for here is still set up: leave it as it is**, or stop and open the file again."* | *"…ni se ha descartado nada. **Lo que has pedido aquí sigue preparado: déjalo como está**, o cierra esto y vuelve a abrir el archivo."* |

The guarantee — *the version on disk was not loaded, nothing was written, nothing was discarded* — is
word for word the existing sentence's; only the clause that advises what to do next differs, and
`saveOutcome.test.ts` checks that the shared prefix really is shared rather than pinning either
string verbatim.

---

## 4. What no test can pin

1. **Whether either new sentence reads well, or is grammatical, or is Spanish at all.** The i18n
   suites check key-set parity and placeholder agreement, never meaning (`CLAUDE.md` §6). What was
   added is a **word check with a falsifiability half**: the `operationChoice` sentence must not
   contain *keep editing* / *sigue editando*, and the `authoredText` one must — so a word list typo'd
   into matching nothing fails rather than passing vacuously. The same shape as 3c-3's §4.1 guard,
   and the same honest limit: it fires on the defect that was found and says nothing about the
   replacement.
2. **That a component passes its own surface's draft kind.** Three accessors now take one, and all
   three take an ordinary `ConflictDraftKind`. The six mounted suites each assert that the surface
   draws its own half and not the other's, which is the only enforcement there is.
3. **That the arm-to-arm reveal helps.** The mounted cases prove the effect re-runs and points at the
   panel; whether the jump reads well, and what happens at window sizes other than 1180 × 728, is
   what no transcript in this phase answers. Unchanged from 3c-3 §5.6.
4. **`reloadUnavailable`'s two sentences on a screen.** Not reachable from a window (§2.4). Both are
   drawn in mounted tests over a scripted `refused` adoption, and that is the whole of the evidence.
5. **That `outcomeReveal` is called at all.** Moving it to the browser layer changes nothing about
   this: a component can delete its `$effect` or its `bind:this` in silence, which is why each of the
   six mounted suites still carries a case for them.

---

## 5. What the fixes broke, revealed or left open

1. **Nothing broke.** 47 test files and 1 483 tests pass, `svelte-check` is clean over 416 files, the
   build is 175 modules with no server build in the bundle, and every behaviour 3c-3's retake
   recorded still behaves that way (retake §5).
2. **`reveal.test.ts` is smaller and no longer tests a rule.** Four cases moved to
   `saveOutcome.test.ts` with the function; the file keeps its jsdom docblock because `revealOutcome`
   still takes `HTMLElement`s. It is still the eighth docblock that renders no component (3c-3 §5.3).
3. **A `describe` in `saveOutcome.test.ts` now owns a presentation cue.** That file is long, and this
   is a deliberate acceptance: the alternative is a third module for a five-valued union derived from
   a type in that same file.
4. **The `suspect` launch fixture is new instrument, not new production behaviour.** A synthetic
   fourth snippet declaring `type: notatype` raises `VariableTypeNotRecognised`, a
   `SuspiciousButPermitted` finding, so every save of that document is refused with findings — which
   is the only way a window can be driven to the mover's and the deleter's refused arm. It asserts
   nothing about espanso semantics; it is a `type` value this application's own table has no entry
   for.
5. **The probe grew a three-armed outcome classification, and the old two-armed one was a hole.**
   Every transcript before this step reported a refusal as *"not a conflict"*, which is exactly why a
   reading could be taken over a surface whose refused arm had a wrong label and say nothing about
   it.
6. **The probe is still in the tree**, now with five temporary additions across 3c-3 and 3c-4. Its
   removal is the next step and will take the build from 175 modules back to 174.

---

## 6. The gates, and every count

```
npm test                 47 files, 1483 tests, all passing
npm run check            416 files, 0 errors, 0 warnings
npm run build            175 modules
cargo build --workspace  ok
cargo clippy --workspace --all-targets -- -D warnings   ok
cargo fmt --check        ok
cargo test -p espansoconfig   149 passed, 0 failed
```

**Every move from 3c-3's 47 / 1464 / 415 / 174.**

- **Test files 47 → 47.** No file added and none removed. `draftKindWording` is tested in
  `saveOutcome.test.ts` beside the two key functions that call it, rather than in a suite of its own.
- **`svelte-check` files 415 → 416.** One new source file, `src/lib/browser/draftKind.ts`.
- **Build modules 174 → 175.** The same one new **source** module. This is the *"moved by exactly the
  number of new source modules"* shape `CLAUDE.md` §6 names and not the `resolve.conditions`
  regression — checked rather than assumed: `rg -c "internal/server|async_hooks"` over the built
  bundle finds nothing. The 175 is 173 plus `src/probe.ts` plus `draftKind.ts`… stated the other way
  round, deleting the probe returns it to 174.
- **Tests 1464 → 1483, +19**, and all nineteen are accounted for:

  | Where | + | What |
  |---|---|---|
  | `src/lib/browser/saveOutcome.test.ts` | **+9** | 5 in the new *one rule* suite — the rule, its genericity, the new key, the word check and the shared guarantee — and 4 for the cue suite moved in from `reveal.test.ts` |
  | `src/lib/browser/rawSave.test.ts` | +1 | the refusal label by draft kind |
  | `src/lib/components/reveal.test.ts` | **−4** | the cue suite moved out with the function |
  | `src/lib/components/RawEditor.test.ts` | +2 | the refused arm's label, the arm-to-arm reveal |
  | `src/lib/components/MatchEditor.test.ts` | +2 | the same two |
  | `src/lib/components/MatchCreator.test.ts` | +2 | the same two |
  | `src/lib/components/MatchDeleter.test.ts` | +2 | the same two, the second by this surface's own route |
  | `src/lib/components/MatchMover.test.ts` | +2 | the same two |
  | `src/lib/components/MatchDuplicator.test.ts` | +2 | the same two |
  | `scripts/lint/ipc-detail.test.ts` | **+1** | nothing was written there |

  The last row is 3c-3's §6 note one file along: that suite is `it.each(scannableFiles()…)` over
  every `.ts` and `.svelte` file under `src/`, so one new `.ts` file adds one case. It is a scanner
  over the tree, not a suite with an opinion about this change.

  Eleven existing cases changed without changing the count: the three `reloadUnavailable` assertions
  on the operation surfaces and the three on the authored-text ones now go through
  `reloadUnavailableKey` and assert the *other* half is absent; three cases in `rawSave.test.ts` were
  widened over both draft kinds; and two `reveal.test.ts` cases were rewritten for the five-valued
  cue.

### 6.1 The three mutations

Each fix guards something deletable, so each was reverted and the suite re-run:

| Mutation | Failures |
|---|---|
| `outcomeReveal` answers one shared value for `saved` and `refused` | **8** — 2 in `saveOutcome.test.ts`, and the arm-to-arm case in **all six** mounted suites |
| `rawSaveChoiceKey` ignores `draftKind` | **8** — 2 in `rawSave.test.ts`, and the refused-label case in **all six** mounted suites |
| `reloadUnavailableKey` ignores `draftKind` | **10** — 2 in `saveOutcome.test.ts` and 8 across the six mounted suites |

---

## 7. What this hands the next reviewer

1. **Four findings closed**, three from `phase-2c-4a-3c-code.md` and one the orchestrator found. The
   window evidence is `2c-4a-3c-4-retake.md`, with a verdict table at its §7.
2. **The refusal arm has a transcript now**, for the first time in this project — the thing the
   previous round said did not exist and used as its reason not to fix a label.
3. **Four correction blocks in `2c-4a-3c-3-notes.md`**, appended in place rather than rewritten, so
   the deferral, its argument and its refutation are all legible. §2.2, §2.3 decisions 1 and 3, §4.3
   and §7.3.
4. **Three claims to check against the code rather than against this file:**
   - `rg -n "draftKind === 'authoredText'" src/lib/browser/*.ts` should find the rule in
     `draftKind.ts` and exactly **one** other production line — `conflictChoicesFor`'s copy guard,
     which §2.5 says is deliberately not this rule;
   - `rg -n "browser.saveOutcome.reloadUnavailable'" src/lib/components/` should find **nothing** —
     all six surfaces call the accessor;
   - the six mounted arm-to-arm cases really do clear the scroll spy before the second result, and
     really do fail when the cue is collapsed (§6.1).
5. **One count that moved in a file this step did not touch**, explained in §6.
6. **The harness is still in the tree**, and every gate above was run with it there. Removing it is
   3c-5.
