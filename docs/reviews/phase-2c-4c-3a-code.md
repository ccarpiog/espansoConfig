# Phase 2c-4c-3a — code review

## Round 1

**Provenance.** This round ran with the workspace mounted read-only, so Codex could not append its
own section. The brief asked for the full review text in the final message; what follows is that
message **transcribed by the orchestrator**, not Codex's own bytes. The job is
`task-msqf823x-1al4vg`, Codex session `019ff73a-1665-7d20-b4fa-2a78f8591154`. The brief forbade web
search, named the thirteen changed paths as the review target, listed the nine rules the step is
bound by, and excluded four things as out of scope: `browser.saveOutcome.reloadClosesSurface`, the
four untouched 3b surfaces, the window reading owed at 2c-4c-5, and step 2's seven dispositioned
rounds.

**Verdict: NOT READY.**

### Transcribed review

## Confirmed defects

### High

1. **High — `src/lib/components/RecoveryPanel.svelte:342`** — `runCreate` never installs the `saving` session returned by `beginRecoveryCreate` before awaiting, leaving every control active and permitting concurrent writes, abandonment, and stale-result replacement.

   Failure scenario: open a valid recovery form → click Create twice before the first promise resolves → two `create_match` requests use the same base revision; one commits and the other conflicts → the later handler assignment can replace the committed state with the conflict, reporting an error after a committed write. Alternatively, clicking Close during the request abandons the form because `view.saving` remains false, and the eventual result resurrects it. This violates rules 7 and 8. The ordinary editor and creator correctly assign `started.session` before awaiting.

2. **High — `src/lib/i18n/en.json:360`, `src/lib/i18n/es.json:360`** — the `sourceConflict.retained` sentence claims the source change "is still here, exactly as it was," although the `retained` predicate establishes only that recovery has neither committed nor ordered reconciliation and cannot observe subsequent host edits.

   Failure scenario: manual reapply fails → open recovery → dismiss the host conflict with Keep editing → edit the host's trigger or replacement while leaving recovery open → recovery still derives `retained`, so the panel says the source change remains exactly as it was even though the host draft has changed. This is an outcome claim unsupported by the predicate and conflicts with the act-only rule.

### Medium

3. **Medium — `src/lib/components/RecoveryPanel.svelte:107`** — the JSDoc says recovery has no trustworthy anchor "by definition" because the anchor went missing, but `manualResolution` can also result from a field collision or an unsuitable destination while the source snippet still exists.

   Failure scenario: reapply reaches manual resolution because a supported field collided while the original snippet remains identifiable → recovery correctly uses fixed `End` as policy → the contract nevertheless tells maintainers that the anchor necessarily disappeared. This contradicts the step record's own correction at `docs/decisions/2c-4c-3a-notes.md:189` and overstates what the code guarantees.

### Low

4. **Low — `docs/decisions/2c-4c-3a-notes.md:35`** — the decision record claims six new `MatchCreator.test.ts` cases, while the diff adds five and the same record later gives the correct count at line 299.

   Failure scenario: a reviewer uses the summary to audit the promised mounted coverage → searches for six creator cases → the sixth case does not exist, making the evidence inventory internally inconsistent.

## Suggestions

- Add a deferred-promise component test that asserts the recovery form enters `saving` synchronously, rejects a second Create and Close, and cannot have a committed result replaced by another request.
- The i18n placement deviation is sound: keeping frontend-only key functions in `recovery.ts` avoids polluting the Rust-wire `code.*` contract. Returning `TranslationKey` preserves compile-time checking against English, while dictionary parity tests cover the corresponding Spanish key. I found no missing-key regression from that decision.

## Verdict

**NOT READY** — the asynchronous handler currently permits duplicate concurrent writes and can display an error after a committed create.

### Orchestrator's independent confirmation of finding 1

Checked before commissioning the fix, because a worker's report and a reviewer's claim are both
claims. `MatchEditor.svelte:499` assigns `session = started.session;` synchronously and awaits
afterwards. `RecoveryPanel.svelte:342` has no such assignment: it awaits `sendRecoveryCreate`, whose
body (`recovery.ts:1833`) calls `beginRecoveryCreate` internally and returns the saving session only
on resolution, so the component's `session` — and therefore `view.saving` — stays pre-send for the
whole flight. The asymmetry Codex names is real and it is in the direction claimed.

---

## Round 1 fixes

All four findings are closed. The step's own record,
`docs/decisions/2c-4c-3a-notes.md`, was corrected to match what the code now does — §6 is the
new account, and §1, §2.9, §4.4, §4.6 and §5 were each edited where they described something
this round changed. The gates after the last edit: `cargo test --workspace` **1112 passed, 0
failed** (no Rust file was touched), `npm test` **1744 passed, 51 files** (from 1740),
`npm run check` **422 files, 0 errors, 0 warnings**, `npm run build` **178 modules** (unchanged
— no source module was added).

### 1 — High, the create in flight. Fixed **in the model**, not in the renderer.

`sendRecoveryCreate` in `src/lib/browser/recovery.ts` now takes a **required** third argument,
`InstallTheWaitingForm`, and invokes it with `started.session` immediately before it authorizes
the request — and not at all for a form `beginRecoveryCreate` refuses.
`RecoveryPanel.svelte`'s `runCreate` passes `(waiting) => { session = waiting; }`, so
`view.saving` is true from the press: the create control refuses with `saveInFlight`, *Stop
creating this snippet* is disabled and cannot abandon the form, both boxes are read-only and
every destination is inert.

The model was chosen over the renderer deliberately. The alternative — splitting the
composition so the component calls `beginRecoveryCreate` itself — would have moved the base
revision, the `NewMatch`, the fixed placement and the folding of three answers into a renderer,
which is the duplication D2's one shared panel exists to avoid, and it would close no hole the
callback leaves open. **What the type forces**: that every caller supplies an installer, and
that this module calls it before anything is sent. **What it does not force**, stated in the
same sentence on `InstallTheWaitingForm` itself and in the record: that the body of the
callback installs the form anywhere a screen reads — `() => {}` type-checks.

Evidence, in two places because the residue above is real:

- **model**, `src/lib/browser/recovery.test.ts` — two new cases. One asserts the ordering
  (`['install', 'create']`), that the wire revision is the waiting form's own, and that the
  value handed over has `phase: 'saving'` with a view whose `saving` is true, `canCreate`
  false, `refusal` `saveInFlight` and `editable` false; the other asserts that a form which
  will not be sent installs nothing and calls nothing. The closed-form probe table now passes
  an installer that **throws**, so a terminal form reaching that moment fails the suite.
- **mounted**, `src/lib/components/RecoveryPanel.test.ts` — the deferred-promise cases the
  review asked for. `ScriptedAnswer` gained `defer`, and `Mounted` gained `pending`, so a
  create can be held open. The first case asserts the whole inert state **with no `await`
  between the click and the assertions**, then presses *Stop creating this snippet* and shows
  the form still there with its text. The second gets a refusal on screen, presses *Save
  anyway* to start a save, and presses it again while that save is outstanding — that row
  carries no `disabled`, here or on the other five surfaces — showing the second send refused
  by the **model** and the eventual commit standing with no second answer that could replace
  it. Both cases were confirmed non-vacuous: with the installation reverted to `() => {}`,
  both fail.

The existing call sites of `sendRecoveryCreate` in `recovery.test.ts` (29) and
`workspace.test.ts` (7) were updated to pass an explicit no-op installer rather than the
argument being made optional, so no caller can omit the concept.

### 2 — High, the `retained` sentence. Both languages, and both siblings swept with it.

`src/lib/i18n/en.json` and `es.json`, keys `browser.recovery.sourceConflict.{retained,
windowMoved, spent}`.

- `retained` no longer says the source change *"is still here, exactly as it was"*. It claims
  what the predicate establishes: nothing has been written **from here**, **this panel** has
  asked the window for nothing, nothing here touches that change — and what it holds now is
  shown where it is being made, not here. Its second clause was also unscoped (*"this window
  has not been asked…"*), which a host surface reloading its own disk version falsifies;
  `windowWasReconciled` records only what this panel asked for.
- `spent` no longer says *"The change you were making was not carried out"* — an outcome claim
  about a draft this panel cannot observe. It says this panel did not carry it out and has
  written nothing else.
- `windowMoved` was already correct about the **act**; what it lacked was the same limit, which
  it now carries.

The type-level contracts were corrected with the strings: `SourceConflictState`'s `'retained'`
arm no longer says *"nothing has moved: it and its draft are still the person's to resolve"*,
and `sourceConflictStateKey`'s JSDoc now states the host limit beside the act rule.
`browser.saveOutcome.reloadClosesSurface` was **not** touched, in either language.

### 3 — Medium, the placement contract.

`src/lib/components/RecoveryPanel.svelte`'s header no longer says recovery has no trustworthy
anchor *"by definition"*. It states fixed `End` as **policy**, names the two other routes into
`manualResolution` — a field collision, an unusable destination — under which the source
snippet still exists, and says what is actually missing: a position this application could
justify. That now agrees with the `position` row of `docs/decisions/2c-4c-3a-notes.md` §2.10
— the row that corrected the same claim in the *string* — instead of contradicting it.

### 4 — Low, the evidence count.

`docs/decisions/2c-4c-3a-notes.md` §1 said six new `MatchCreator.test.ts` cases and three
ordinary repeated-trigger cases. Counted from the diff
(`git diff -U0 … | rg '^\+\s+it\('`): **five** and **two**. Both corrected, along with the
`RecoveryPanel.test.ts` figure, which this round moved from 17 to 19.

### Not fixed, and why

Nothing. One thing is worth naming as deliberately out of scope rather than missed: the
refusal panel's choice row still carries no `disabled` while a save is in flight. That is
true of all six write surfaces, the review did not raise it, and the model refuses the second
send — which the second mounted case now asserts by pressing it.

---

## Round 2

**Provenance.** Read-only mount again, so this is the final message **transcribed by the
orchestrator**, not Codex's own bytes. Job `task-msqg6z59-oe45c9`, Codex session
`019ff752-f098-7d91-90b3-3bcb61ab1a21`. The brief scoped the round to round 1's fix and only that
fix — this project's record is that fix rounds introduce their own defects — and asked specifically
whether any of the 36 updated call sites had quietly weakened a probe with an inert installer.

**Verdict: NOT READY**, on one Low against the decision record. **The implementation fix is
confirmed sound.**

### Transcribed review

## Round 2

### Confirmed defects

#### High

None.

#### Medium

None.

#### Low

1. **Low — `docs/decisions/2c-4c-3a-notes.md:358`** — the evidence record calls *Save anyway* "the one control" left live during an in-flight save, but the entire refusal choice row remains enabled, including *Keep editing*.

   Failure scenario: a refused form starts a deferred save through *Save anyway* → while it is pending, both *Save anyway* and *Keep editing* remain clickable at `RecoveryPanel.svelte:725-730` → a reviewer relying on §5 incorrectly concludes that only one control remains live. Section 6.1 correctly acknowledges the plural "choices," so the record is internally inconsistent.

All four Round 1 defects are otherwise closed:

- The waiting session is installed synchronously before the create callback, and the production caller installs it in the state the view reads.
- No no-op test installer weakens a claim that depends on visible installation; the relevant model and mounted tests use recording, throwing, or real state-installing callbacks.
- `InstallTheWaitingForm` and the decision record explicitly acknowledge that the type cannot force the callback body to install anything.
- The three source-conflict sentences are supported by their predicates and have equivalent meanings in English and Spanish.
- The fixed-`End` placement documentation now covers every route into `manualResolution`.
- Leaving the refusal choice row enabled is adequately declared and does not permit a second request because the model refuses it.

### Suggestions

None.

## Verdict

**NOT READY** — the implementation fix is sound, but the edited decision record still contains one false statement and should say that the refusal choice row remains live, while *Save anyway* is the live control capable of attempting another send.

### Round 2 fix

Taken by the orchestrator directly — one sentence, one file, no ambiguity. Confirmed against
`RecoveryPanel.svelte` first: the `{#each form.refusalChoices}` row renders its buttons with no
`disabled`, so the finding is correct and *Keep editing* does stay clickable beside *Save anyway*.

`docs/decisions/2c-4c-3a-notes.md` §5 no longer calls *Save anyway* "the one control a save in
flight leaves live". It now states that the **whole refusal choice row** stays live, that what makes
that safe is the model refusing the second send rather than the markup withholding the press, and
that *Save anyway* is merely the one live choice that can **attempt** another send — which is why it
is the control the mounted case presses. The contradiction with §6.1 is gone.

**No executable line changed in this round**, so the four gates carry over from the round-1 fix
unchanged: 1112 / 1744 / 422 / 178.

**Round 3 is judged not worth spending.** Round 2 found no High and no Medium, its one Low was a
prose contradiction inside a record, and the fix for it is a single paragraph that adds no claim the
round did not already state in its own words. Recorded here so it can be overruled on evidence
rather than silently assumed.
