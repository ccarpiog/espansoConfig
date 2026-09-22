# Phase 2d-6-6c-1 — the three authored panels' external-conflict rendering

**Status: implemented, reviewed once (`ship-with-fixes`, 2 blockers, both held), fixed, gates
green.** §7 records the fix round. Risk class: **medium**. The phase changes
markup on three components. It adds no transition and no model rule. Three dictionary keys were
added (EN and ES), and one test-only completeness alias. **No new module, no new component, no Rust,
no `src-tauri/` file.** The window reading is 2d-6-6c-2's, and no window was launched here.

This is the first half of 2d-6-6c ([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The
orchestrator's cut of 2d-6-6*). It covers four things:
- the rendering on the three authored panels;
- 6b's carried items ([`2d-6-6b-notes.md`](2d-6-6b-notes.md) §4 items 1, 2, 4, 5 and 7);
- the declared-gap decision (6b §2 ruling 3);
- the bilingual mounted tests of 2d-6-6's acceptance.

It is bound by the split record's §3 entries 1-5, 10, 21, 23, 25, 31, 34-36 and 38-40.

---

## 1. What changed

Line numbers are of the final tree. `ME` is `src/lib/components/MatchEditor.svelte`, `MC`
`MatchCreator.svelte`, `RP` `RecoveryPanel.svelte`, `DPT` `DetailPane.test.ts`.

### 1.1 The rendering (entries 10, 21, 23, 25)

The three panels share one shape:

- **An external conflict is drawn in a panel of its own, outside the save-outcome branch** (`ME:1149`,
  `MC:1112`, `RP:885`, each `div.panel.external[role=status]`). The session keeps an external
  conflict in `externalConflict`, beside `outcome` and never inside it, so before this phase the
  panels drew nothing for it. Only the boxes froze.
- **Which arm to draw is decided by `isExternalConflict`** (`ME:462`, `MC:387`, `RP:326`). This is the
  one tested guard. The nested `source.kind` is not used, because it does not narrow the model.
- **Origin.** Each conflict panel of either origin now opens with
  `tConflictOriginMessage(conflictOriginMessage(conflict.source))`:
  - the external panel draws `changedWhileOpen`;
  - the save arm inside the outcome panel draws `refusedSave`;
  - the recovery form draws the line for **its own** conflict, never for the one it was opened from.
    That source is still described only by `tSourceConflictState` (entry 25).
- **The model's lines for the origin.** The external panel draws `view.externalMessages` through
  `tConflictMessage`. It never draws `view.messages`, which are a save's lines.
- **Revisions.** The panels read revisions from `conflictRevisionsOf(external.source)`. The external
  arm has only `observed`, which is drawn through the new `browser.externalConflict.revisionObserved`.
  No *expected* and no *found* are drawn for an observation (entry 10).
- **The affected file** is drawn on the creator and the recovery form
  (`browser.externalConflict.affectedFile`, operand `conflict.disk.relative_path`, a display path by
  entry 39). These two surfaces *choose* a file, so the panel cannot assume the person knows which
  file changed. The editor's header already names its file.
- **A destination-less form's one way forward.** `view.destinationRequired` draws
  `browser.externalConflict.destinationRequired` (entry 21). The `noDestination` refusal is still drawn
  beside the send control, as before.
- **The comparison is one Svelte snippet per component** (`ME:825`, `MC:824`, `RP:650`). The save
  arm and the external arm both render it (entry 23). It holds:
  - the retained draft (editor and creator only);
  - the whole-file disk text through `SourceText … documentStart`;
  - the surface's own reload warning and the refused-reload line;
  - the copy disclosure (editor and creator only);
  - the readiness line and `view.conflictChoices`.

  `conflictChoicesFor` stays the only producer of the choices. `RP`'s snippet takes the view as a
  parameter, because the view is `null` while no form is open. The recovery form has no retained-draft
  list and no copy, because `RECOVERY_CONFLICT_CAPABILITIES` declares no copy.
- **Copy** is unchanged code. `copyTheDraft` guards on `view.conflict`, which already covered both
  origins. It goes through `copyReferenceText` in `clipboard.ts`, so the `\r` refusal applies
  unchanged.
- **Recovery.** Recovery is offered after a *Keep my draft* over an external conflict reaches manual
  resolution. `recoveryAvailability` and `startMatchFieldRecovery` already took `view.conflict` of
  either origin, so no code changed. Recovery is now reachable on screen, and the mounted case walks
  it.
- **Notices.** `view.externalNotices` (`writeOutcomeUnknown`, `observationRetained`) are drawn through
  `tExternalConflictNotice` beside each panel's send control (`ME:1072`, `MC:1027`, `RP:833`). The
  acknowledgement control is 2d-6-9's.
- **The reveal.** An external conflict with no outcome now gives the reveal the cue `conflict`, with
  `externalPanel` as the target. A `saved` or `refused` outcome kept as history keeps its own cue. The
  target choice is a boolean `$derived`, `outcomeShown` (`ME:484`, `MC:407`, `RP:346`), rather than a
  read of `view` inside the effect. The first draft read `view` inside the effect, which re-ran the
  effect on every transition. That draft failed both *arm replacing an arm* cases with two scroll
  requests where one was expected.

### 1.2 6b's carried items

- **Item 1, fixed.** The destination buttons in `RP` are gated on `form.canChooseDestination`
  (`RP:762`), not on `form.editable`.
- **Item 2, fixed.** `MC`'s `runCreate` settles a `create` that throws. It calls
  `createCouldNotBeSent(session, true, classifyFailure(raw), () => session)`, so the form settles as a
  send that *may have written*, against the form installed now. The failure is drawn and not
  re-thrown, because the only caller is a click handler that discards the promise. **Corrected by the
  fix round (§7, finding 1):** the first version said the window's barrier records every thrown
  wrapper as uncertain. That was wrong. The barrier releases on whatever the wrapper had already
  established, and `BrowserState.createMatch` records a commit before its adoption. So a throw after
  a commit was drawn as an unsuccessful create. `createMatch` now answers such a throw as a `failed`
  adoption beside the `saved` outcome. The catch here is reached only by a throw before any answer
  was established.
- **Item 7, both comments.**
  - `MC`'s destination-report comment no longer says `targetingSurfaceFor` "has no production caller
    yet". It names the coordinator's read (`observationTransitions.ts`, `tellTheSurfaceAbout`).
  - `restoreCodes.test.ts`'s `COMPETING` comment now says what the array `satisfies` forces and what
    it does not. The comment's original claim is made true by `_CompetingKindsAreComplete`
    (`ExpectNever<Missing<…>>`, `restoreCodes.test.ts:65`): a new competing kind is now an
    `npm run check` failure that names it.
- **Items 4 and 5 are decided and recorded, not changed** (§2 rulings 3 and 4).

### 1.3 The dictionaries

`en.json:206-208` and `es.json:206-208` add these keys:
- `browser.externalConflict.revisionObserved` (`{revision}`);
- `browser.externalConflict.affectedFile` (`{path}`);
- `browser.externalConflict.destinationRequired`.

All three are bounded by the entry-40 scans: they are in `BOUNDED_KEYS`, and the namespace count
went from 4 to 7. They are pinned literally in both languages by *pins the three panel sentences
Phase 2d-6-6c-1 added* (`externalConflictCodes.test.ts:301`). The Spanish is the implementer's draft
and awaits ruling 40's bilingual review (2d-6-11).

### 1.4 Sentences corrected (entry 41)

Each sentence below said "no component draws / calls / reads this yet", or named 2d-6-6c as future
work. Each is now false and was corrected in place:

- **`i18n/index.ts`**: the docs of `tConflictMessage`, `tExternalConflictNotice` and
  `tConflictOriginMessage`, and the external-evidence refusal doc.
- **`saveOutcome.ts`**: `ExternalConflictModel`'s last sentence.
- **`observationDelivery.ts`**: the `ExternalConflictNotice` doc.
- **`matchEditor.ts`**: the module header, and the view's `externalMessages` and `externalNotices`.
- **`matchCreation.ts`**: the view's `externalMessages`, `externalNotices` and `destinationRequired`.
- **`recovery.ts`**: the view's `externalMessages`, `externalNotices`, `destinationRequired` and
  `canChooseDestination`.
- **`DPT`**: the 6b suite's comment, which said the rendering "is 2d-6-6c's".

## 2. Rulings and decisions, with what the code does and does not force

1. **The origin line is drawn on both arms, even though it overlaps the external message.**
   `changedWhileOpen` and `fileChangedWhileOpen` both say that no save was initiated in response to
   the observation. The origin line is 2d-5-1's vocabulary. The first message line is the model's
   typed first element. Both were written to be shown, and the task names the origin as a deliverable.
   **Forced:** nothing; a panel may omit either line and compile. `DPT` reads both off the screen. The
   repetition is left for ruling 40's bilingual prose review (§4 item 1).
2. **The shared comparison is a snippet inside each component, not a shared component.** Entry 10
   forbids a generic conflict component. **Forced:** the two arms of one panel cannot diverge, because
   they render one block. **Not forced:** that the three components' snippets stay alike. Each snippet
   is carried by its own component's mounted suites. The snippet binds one `outcomeChoices` element,
   which assumes only one conflict is active (entry 7). A hand-built session with both a save-conflict
   outcome and an external conflict would draw two comparisons, and the later binding would win. The
   transitions never build that state.
3. **Item 4, the unknown recovery form's attribution: decided, not changed.** Both sides reduce to
   `destinationEligibility(…).kind === 'eligible'`:
   - `targetingSurfaceFor` and the roster use `creatorEligibilityOf`;
   - `recoveryDestinationsOf` uses the same predicate.

   They differ in three ways:
   - **when** the answer is taken: the form's list is frozen when it opens, and the roster's set is
     re-derived on every reconciliation;
   - **whose facts** are read: the projection's `kind` / `read_only`, or the summary's;
   - **the conflict's own file**: the recovery form reads it from the disk projection.

   Both failure directions fail safe:
   - A file the roster protects and the form does not list is over-protected. It is marked stale
     rather than reloaded, and nothing is installed.
   - A file the form lists and the roster does not is not delivered about. Naming it and sending is
     still guarded twice: by the create's revision check in Rust, which refuses a stale base, and then
     by the ordinary save conflict.

   Making the two sets one would mean threading the form's frozen list up through the binding. That is
   a wider interface for a gap that has no unsafe direction. **Forced:** nothing new. The record is
   the decision.
4. **Item 5, the one-slot limit of a destination-less form: recorded deliberately.** Suppose two
   eligible files change while no file is chosen. The form shows the later one, and the new affected-
   file line names which. The earlier change is not lost to the window: that file is `stale` and its
   standing origin stays registered. The form then behaves as follows:
   - Naming the file that changed later keeps the conflict.
   - Naming the file that changed earlier drops the displayed conflict and re-points the draft at the
     revision this window still holds for that file. That revision is stale, so a send is refused by
     the create's revision check and becomes an ordinary save conflict over the file.
   - No path writes over the earlier change unseen.

   A list of conflicts per form would widen every session type for a state that already fails into a
   refusal. **Forced:** nothing; this is a model fact of 2d-6-3 (its §2 item 8), and it is not
   changed here.
5. **The declared gap (6b §2 ruling 3): no hold is implemented here.** 2d-6-7 and 2d-6-8 own the
   five kinds whose receivers are not yet registered. 2d-6-9 owns anything a hold would still need
   after that. The reasons:
   - For the three authored kinds, the no-binding state cannot be reached through the pane. Each
     child reports during its own initialisation, which runs before the pane's registration effect,
     and withdraws in the same flush that unregisters its surface. So a hold here would guard a state
     that has no route in.
   - For the five other kinds, the right fix is a registered receiver, which is 2d-6-7's and 2d-6-8's
     scope. A hold would only postpone the observation. Meanwhile those kinds keep the 2d-5 behaviour:
     the file is marked stale and not reloaded, and the command's revision check refuses a stale
     write.
   - If a hold is still wanted once all eight kinds report, it belongs with the retained-observation
     machinery. Entries 16-18 already give that machinery a person-requested retry, and it is 2d-6-9's.

   **Not forced:** the ordering argument rests on Svelte's initialisation-before-effect order, which
   no type expresses. The mounted suites establish it.
6. **A thrown `create` is settled in the component, not in a new model function.** This covers only a
   throw before any answer was established. A throw after a commit is answered at the
   `BrowserState` boundary instead (§7, finding 1). The model already has the settling transition,
   `createCouldNotBeSent`. The component only classifies the throw with
   `classifyFailure`, as `sendRecoveryCreate` does for the recovery form. A new export would duplicate
   that one line. `classifyFailure` is imported from `../ipc/errors`, which is not a command module,
   so entry 37's scoped check does not apply. **Not forced:** that a future caller of `create` catches
   a throw too.

## 3. Acceptance checked

**The six scenarios, bilingual, mounted through the real registry and coordinator boundary** (`DPT`,
the suite *the conflict panels' drawn sentences*). Every case works the same way:
- it opens its surfaces through the pane's controls, found by the case's locale;
- it starts the lifecycle over a finite drain queue, with `expectedDrains` exact;
- it wakes the window;
- it asserts dictionary values in that locale.

| Scenario | Cases | What is read off the screen |
|---|---|---|
| A pristine editor conflicts | `DPT:2191`, EN + ES | Origin, `fileChangedWhileOpen`, and the observed revision; no save origin, no *expected*, no `changedElsewhere`. The retained draft, the disk text and the copy disclosure. *Copy my text* then shows `draftCopied`. *Keep my draft* then shows `manualResolution` and `noCorrespondence`. The recovery form then shows the source-conflict `retained` sentence. |
| An unknown-target creator blocks every eligible target | `DPT:2265`, EN/ES × file 1/3 | Origin, affected file, `destinationRequired`, and the `noDestination` refusal. The only choices are *Keep editing* and *Copy my text*. After the affected file is named: the line goes, the reload is offered, and *Add* stays disabled. |
| Recovery over B protects B while its host stays over A | `DPT:2320`, EN + ES | The form shows origin, affected `match/c.yml`, the observed revision, and the `externalConflict` refusal. The host's outcome panel still shows `refusedSave` and *expected*, and no external panel. |
| Host and recovery over one file get one decision | `DPT:2369`, EN + ES | Both panels show the external origin and the same observed revision (`d…`). The host's save panel is gone. |
| A reopened editor cannot receive an old instance's delivery | `DPT:2406`, EN + ES | Nothing external is drawn after the editor is reopened. After the second wake, only the `d…` revision is drawn, never `c…`. |
| A settlement lands in order | `DPT:2457`, EN + ES | While the save is in flight: *cannot be stopped*, and no external panel. After settlement: the save's `sendFailed` and the external panel, with *Save* disabled. |

**Carried-item cases:**
- *keeps the destination choosable when a form naming none is told of a change*
  (`RecoveryPanel.test.ts:784`);
- *settles a create that throws* (`MatchCreator.test.ts:806`);
- *pins the three panel sentences* (`externalConflictCodes.test.ts:301`).

**Adjusted case:** `DPT`'s *reapply handler order* case. Its old discriminator was "*Keep my draft*
absent", and that label is now legitimately offered by the external panel. It now asserts that the
save origin is absent and the external origin is present. That discriminates the same regression: a
reinstalled capture would redraw the save panel.

**Each new case was shown discriminating.** For each mutation below, the file was backed up, mutated
for one run, then restored and checked with `cmp` (identical):

| Mutation | Result |
|---|---|
| `RP` gate reverted to `form.editable` | the recovery case failed: `AssertionError: expected true to be false // Object.is equality` |
| `MC`'s catch re-throwing | the thrown-create case failed: `AssertionError: expected false to be true // Object.is equality` |
| All three `{#if external !== null}` set to `{#if false}` | all 14 new `DPT` cases, the reapply-order case and the recovery case failed |

**Gates**, each run on its own with the exit read directly:

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings (unchanged: no new file) |
| `npm test` | 0 | **2916 passed**, 65 files: +17 from 2899 (`DetailPane.test.ts` +14, `MatchCreator.test.ts` +1, `RecoveryPanel.test.ts` +1, `externalConflictCodes.test.ts` +1) |
| `npm run build` | 0 | **193 modules** (unchanged). `rg -c '\$\$payload\|head_payload\|push_element'` finds nothing; `rg -c 'window\.__svelte\|svelte-trusted-html'` finds `2` |
| `cargo test --workspace -- --test-threads=1` (to `/tmp/cargo-6c1.txt`) | 0 | **1323 passed**, 0 failed (unchanged; run because both dictionaries changed) |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean |
| `cargo fmt --check` | 0 | clean |

**Git:** read-only commands only (`git status`). The four instrument paths, `PROGRESS.md` and
`PROGRESS.json` were not touched.

## 4. Open items for later phases (not fixed here, `CLAUDE.md` §7)

1. **The origin line and the external first message repeat one clause** ("No save was initiated in
   response to this observation"). The same is true of `refusedSave` beside `nothingWasWritten` /
   `changedElsewhere` on the save arm. Merging or trimming them is a wording decision for ruling 40's
   bilingual prose review (2d-6-11), not for the renderer.
2. **The window reading is 2d-6-6c-2's.** jsdom lays nothing out. So nothing here establishes:
   - where the external panel lands in the scroller;
   - whether its reveal moves it into view;
   - how the snippet's two uses look in WKWebView.

   The reading should include the destination-less creator (hard to reach in a window: it needs a
   change to an eligible file while the form is open) and the recovery form's external panel.
3. **The recovery form's refusal line repeats the panel's first message.**
   `recoveryRefusalKey('externalConflict')` and the creator's refusal reuse
   `fileChangedWhileOpen`'s sentence, which the external panel also draws. This is the same sentence
   twice on one screen. A shorter refusal key would be a dictionary change for 2d-6-11.
4. **Five surfaces still draw nothing for an external conflict**: the deleter, mover, duplicator, raw
   editor and restore (2d-6-7, 2d-6-8). Their view docs still say "no component reads it yet", which
   remains true.
5. **`recovery.ts:3050`'s "Nothing draws this yet"** (the closed-form `notAttempted` reapply) was not
   re-audited. Whether a closed form can still offer *Keep my draft* on screen was not checked here.
6. **`MatchEditor.svelte` has the same component-wide `copied` flag** that the fix round replaced in
   `MatchCreator.svelte` (§7, finding 2). Its reset points differ: *Keep editing* and a new save
   reset it, and an editor's external conflict can be superseded while it stays open. So a copy
   disclosure made under one conflict can still be shown under the next. Binding it to the snapshot,
   as `MC`'s `CopyDisclosure` / `copyShown` now do, is 2d-6-6c-2's. `RecoveryPanel.svelte` draws no
   copy and has no such flag.
7. **`BrowserState.saveMatch` has the same post-commit shape** that finding 1 named in
   `createMatch`: it records the commit, then awaits its adoption and re-read with no catch. This was
   read, not tested. The delete, move, duplicate and raw wrappers were not read. Only `createMatch`
   was changed here, because the finding named it. The others need the same audit in a later phase.

## 7. The review's findings, re-derived and fixed

**Codex adversarial review, `ship-with-fixes`: 2 blockers, no should-fix**
([`docs/reviews/phase-2d-6-6c-1.md`](../reviews/phase-2d-6-6c-1.md)). The finding bodies in that file
are truncated. Each finding was re-derived by writing its case first against the tree as reviewed and
reading the failure. **Both held.** No re-review follows this fix (`CLAUDE.md` §7).

### Finding 1 — a post-commit exception was rendered as an unsuccessful create (`MC:634`)

**Re-derived.** `BrowserState.createMatch` records the transaction's outcome with
`write.expect(settlementOfOutcome(…))` and then awaits `adoptTheCreatedSnippet` and `readFileText`.
An exception out of either awaited step rejected the wrapper's promise. `MatchCreator`'s new catch
then settled the create as a failed send that *may have written*. That reports a committed write
afterwards as an error (`PROGRESS.md` D2, `CLAUDE.md` §6). The notes' claim that the barrier records
every thrown wrapper as uncertain was false: the barrier releases on what was already established.

**Case**, through the real `BrowserState`: *answers a committed create as saved when the
getDocument / documentText that follows it throws* (`workspace.test.ts`, the *creating a snippet*
suite, `it.each` over the two reads). **Pre-fix failure, verbatim, both rows:**
`Error: the read after the commit threw`. The promise rejected instead of answering.

**Fix, at the `BrowserState` boundary** (`workspace.svelte.ts`, `createMatch`). The adoption and the
re-read after a `saved` answer are wrapped in a `try`/`catch`:
- An exception is answered as `adoption: { kind: 'failed', failure: classifyFailure(raw) }` beside
  the unchanged `saved` result.
- If the adoption had not answered, the replaced projection is dropped, as it is for a read that
  failed.
- If the re-read threw after a successful adoption, the new projection stays.
- A failure the adoption had already answered is kept, not replaced.

The component shows `failed` as its existing *window out of step* line beside the success. `MC`'s
catch comment and this record's §1.2 item 2 and §2 ruling 6 were corrected to say which throws are
still possible there. **Not forced:** that the four sibling wrappers behave the same (§4 item 7).

### Finding 2 — a new conflict could claim an edited draft was already copied (`MC:865`)

**Re-derived.** The comparison snippet drew one component-wide `copied` flag. The flag was reset
only by *Keep editing* and by a new create. The reviewer's path reproduces the defect:
1. A destination-less draft is told of a change to file A.
2. The draft is copied.
3. File B is named, which drops the conflict.
4. The draft is edited.
5. A change to B is delivered.

The new panel then said the draft had been copied. The same flag also installed a late clipboard
answer over whatever conflict was on screen when the answer landed.

**Cases** (`MatchCreator.test.ts`): the receiver is now captured by `mountCreator` as `deliver`, and
envelopes are sealed by `changeTo`.
- *never shows a copy of one retained draft as the copy of another*: the reviewer's path, through
  the selection route.
- *ignores a clipboard completion that arrives for a snapshot no longer shown*:
  `navigator.clipboard.writeText` is held open. The same path runs, and the clipboard then answers.

**Pre-fix failure, verbatim, both cases:** `AssertionError: expected true to be false //
Object.is equality`, at the `draftCopied` assertion.

**Fix, in `MC` only.** `copied` is now a `CopyDisclosure` recording three things:
- the conflict object the copy was made under;
- the exact text handed to the clipboard (`tDraftCopy(view.retainedDraft)`, taken **before** the
  clipboard is asked);
- the result.

The drawn disclosure is `copyShown`, a `$derived` that answers the result only while `view.conflict`
is that same object **and** the retained draft still renders to that exact text. A late answer is
recorded against the snapshot it was about, so it is never drawn over another. **Not forced:** that
the clipboard still holds the text. The sentence says a copy was made. `MatchEditor.svelte`'s
identical flag is recorded, not fixed (§4 item 6).

### Gates after the fix round

Each gate was run on its own, and each exit was read directly:

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings |
| `npm test` | 0 | **2920 passed**, 65 files: +4 from 2916 (`workspace.test.ts` +2, `MatchCreator.test.ts` +2) |
| `npm run build` | 0 | **193 modules**. The server-only markers are absent, and the client-only markers are present (`2`) |

No Rust and no dictionary changed in the fix round, so the Rust cell stays at 1323 from §3. Only
read-only git commands were run. The four instrument paths, `PROGRESS.md` and `PROGRESS.json` were
not touched.
