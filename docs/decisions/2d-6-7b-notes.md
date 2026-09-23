# Phase 2d-6-7b — the three operation panels' external-conflict rendering

**Status: implemented, reviewed once (`ship-with-fixes`, 0 blockers, 2 should-fix, both held),
fixed, gates green.** §5 records the fix round.
Risk class: **high** (the orchestrator's classification). The phase changes markup on three components and adds three view fields
and one pure helper in the model. It also fixes two model or markup defects, each pinned by a case
that was shown failing first (§2 rulings 2 and 3). **No new module, no new component, no Rust, no
`src-tauri/` file.** The fix round added one dictionary key (§5, finding 1). No window was launched: the window reading is
2d-6-7c's.

This is the second of the three sub-phases 2d-6-7 was cut into
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of 2d-6-7*). It starts
from [`2d-6-7a-notes.md`](2d-6-7a-notes.md) §4 item 1 and copies the shape
[`2d-6-6c-1-notes.md`](2d-6-6c-1-notes.md) gave the three authored panels. It is bound by the split
record's §3 entries 1, 10, 23, 34-36 and 38.

Abbreviations: `MD` is `src/lib/components/MatchDeleter.svelte`, `MM` `MatchMover.svelte`, `MU`
`MatchDuplicator.svelte`, `D` `src/lib/browser/matchDeletion.ts`, `M` `matchMove.ts`, `U`
`matchDuplication.ts`, `OD` `observationDelivery.ts`, `DPT` `src/lib/components/DetailPane.test.ts`.

---

## 1. What landed

### 1.1 The rendering (entries 10 and 23), on all three panels

Each panel now follows the shape of `MatchEditor.svelte`:

- **An external conflict is drawn in a panel of its own**, `div.panel.external[role=status]`,
  outside the save-outcome branch. It sits between `RecoveryWithoutCreation` and the outcome panel.
  Which arm is drawn is decided by a `$derived` `external`, through `isExternalConflict`, the one
  tested guard. The nested `source.kind` is not used, because it does not narrow the model.
- **The origin.** The panel opens with
  `tConflictOriginMessage(conflictOriginMessage(external.source))`, which draws `changedWhileOpen`.
  **The save arm now draws its origin too** (`refusedSave`), as the authored panels have since
  6c-1 (§2 ruling 5).
- **The model's lines** for this origin come from `view.externalMessages`, rendered through
  `tConflictMessage`. They are `fileChangedWhileOpen`, `operationKeptInMemory` and
  `reloadAbandonsOperation`. The panel never draws `view.messages`, which are a save's lines.
- **The revision.** Only the observed revision is drawn, through `conflictRevisionsOf` and
  `browser.externalConflict.revisionObserved`. No *expected* and no *found* appear.
- **The comparison is one `comparison` snippet per component**, and both arms render it:
  - the retained operation and `operationIdentityIsOld`;
  - the whole disk text, through `SourceText … documentStart`;
  - the surface's reload warning and the reload-unavailable line;
  - the readiness line;
  - `view.conflictChoices`.

  `conflictChoicesFor` is still the only producer of the choices.
- **Reapply or manual resolution.** This is the existing `keepMyDraft` handler and the existing
  `.panel.reapply` report. The report now shows the external obstacles (`externalEvidence.*`,
  `supersededConflict`) through each surface's obstacle accessor.
- **Reload.** This is the existing two-step `reloadDiskVersion` → `confirmReload` flow, with each
  surface's real close. It works for either origin.
- **Notices.**
  - `MD` draws `view.externalNotices` under the question's controls.
  - `MM` and `MU` draw the new `view.noticesBesideRefusal` under their refusal line (§2 ruling 4).
- **The reveal.** An active external conflict gives the cue `conflict`, and the target is the
  external panel, **ahead of any outcome kept as history** (§5, finding 2). The target is chosen
  by an `externalShown` boolean `$derived`. `MM`'s second-step cue is now `view.awaitingReloadConfirmation`. It used to be
  `reloadWarning !== null`, which §2 ruling 3 made a different fact.

### 1.2 Model changes (each is a view value; components only draw it)

| Where | What | Why |
|---|---|---|
| `D` `MatchDeletionView.canConfirm` | `pending !== null && canRequestDelete(session)` | §2 ruling 2 |
| `M` `MatchMoveView.awaitingReloadConfirmation` | new boolean | §2 ruling 3 |
| `M` `conflictOperation`, `reloadWarning` | `null` when the conflict's draft is not dirty (`isDirty` in `draft.ts`) | §2 ruling 3 |
| `OD` `noticesBesideRefusal(notices, refusalSays)` | new pure helper | §2 ruling 4 |
| `M` / `U` `noticesBesideRefusal` view fields | the notices less the one the refusal line renders | §2 ruling 4 |

### 1.3 Sentences corrected in place (entry 41)

Each sentence below said "no component reads it yet", or "2d-6-7 does / draws", or "the other five
panels are 2d-6-7's". Each is now false and was corrected in place:
- the `externalMessages` and `externalNotices` docs of `D`, `M` and `U`;
- `OD`'s `ExternalConflictNotice` doc;
- `i18n/index.ts`: the docs of `tConflictMessage`, `tConflictOriginMessage` and
  `tExternalConflictNotice`;
- `saveOutcome.ts`'s `ExternalConflictModel` doc;
- the receiver comment and the conflict-panel paragraph in the header of each of `MD`, `MM` and
  `MU`;
- `MM`'s reveal comment;
- the comment on `DPT`'s 7a suite.

### 1.4 Tests (+89 vitest cases, 2964 → 3053)

| File | Added | What |
|---|---|---|
| `MatchDeleter.test.ts` | 25 | Suite *under an external conflict, in English and Spanish* (12 cases × EN/ES, one of them × 3 adoptions) and one reveal case |
| `MatchMover.test.ts` | 29 | The same suite, plus *nobody touched* and *reading behind a conflict* (13 cases), and one reveal case |
| `MatchDuplicator.test.ts` | 27 | The same suite as the mover's without *nobody touched*, and one reveal case |
| `DetailPane.test.ts` | 6 | *The operation panels' drawn sentences through the pane*, 3 kinds × EN/ES, through the real registry and coordinator |
| `matchMove.test.ts` | 1 | *names no operation and no chosen destination for a mover raised before anything was chosen* |
| `observationDelivery.test.ts` | 1 | `noticesBesideRefusal` |

The mount helpers of the three panel suites now capture the reported receiver as `deliver`, as
`MatchCreator.test.ts` does since 6c-1. When the delivered verdict replaces the conflict, the stand-in
`standingConflictFor` answers the delivered origin. The envelopes are sealed by the real
`arbitratedDelivery` / `retainedDelivery`.

## 2. Rulings taken here, and what each does and does not force

1. **The deleter gets no refusal line of its own.** An external conflict withdraws the question
   (entry 12), and the external panel's first lines say why: the origin, then
   `fileChangedWhileOpen`. A held reading keeps the question and blocks the send, and the
   `observationRetained` notice under it says why. The mover and the duplicator already had a
   refusal line with its own external codes (2d-6-4), so this adds **no key**. **Forced:** nothing
   compels a panel to draw the notice. The mounted cases read it in both languages.
2. **Defect: under a held reading, *Delete it* stayed live and answered with a false sentence.**
   The `retained` verdict withdraws no question, but `confirmDelete` refuses a session that holds a
   wait. So the button stayed enabled, and a press set `confirmationRefused`. That draws *"This
   window has read the file again since you were asked…"*, which is false: nothing was read or
   installed.
   - **Case:** *holds the question while a reading waits, refuses to send it, and says why*
     (`MatchDeleter.test.ts`, EN + ES).
   - **Pre-fix failure, verbatim** (`/tmp/7b-deleter-prefix.txt`), both rows:
     `AssertionError: expected false to be true // Object.is equality`, at
     `expect(confirm.disabled).toBe(true)`.
   - With that assertion skipped for one run (`/tmp/7b-deleter-prefix-click.txt`), the panel said
     nothing about why: `AssertionError: expected 'Deleting a snippet Leave this alone F…' to
     contain 'An observed change is waiting to be c…'`.
   - **Fix:** `MatchDeletionView.canConfirm`, which `MD` uses to disable the button, plus the
     notices drawn under it.
   - **Forced:** the view says the button is off, and `confirmDelete` still refuses either way.
     **Not forced:** that a panel reads `canConfirm`.
3. **Defect: a mover nobody touched claimed the person had asked for a move.** A save conflict needs
   a send, and a send needs a chosen destination that moves the snippet. An observation needs
   neither. The draft of a mover left alone is its origin, so the view described the external
   conflict as, for example, *"You asked to move this snippet to the front of this file's snippet
   list"*. At the reload step it said *"The destination you chose is not kept…"*.
   - **Case:** `matchMove.test.ts`, *names no operation and no chosen destination…*.
   - **Pre-fix failure, verbatim** (`/tmp/7b-move-prefix.txt`):
     `AssertionError: expected 'moveToTop' to be null`.
   - **Fix:** `conflictOperation` and `reloadWarning` are `null` when `isDirty(conflict.draft)` is
     false, which also covers a destination chosen and then chosen back. `MM` draws the *"What you
     asked for, kept here"* heading only together with an operation.
   - `reloadWarning` could then no longer mean "at the warning step", so `MM`'s reveal moved to the
     new `awaitingReloadConfirmation`, which the other five surfaces already carry. Its doc and
     `reloadWarning`'s doc were rewritten. The mover reveal case below discriminates this.
   - **Not fixed here:** the reapply offer on such a mover. The review's first finding fixed it
     (§5). The vaguer sentences that still assume an ask are §4 item 2.
4. **The observationRetained sentence is not printed twice.** `moveSubmissionRefusalKey` and
   `duplicationSubmissionRefusalKey` render `observationRetained` through the notice's own key. So a
   panel drawing both the refusal and every notice would print one sentence twice, one line apart.
   - `noticesBesideRefusal` in `OD` drops the notice the refusal line already says. `M` and `U`
     expose the result as a view field, and the components draw that field.
   - **Forced:** the rule is decided in one place.
   - **Not forced:** it compares kinds. It is correct only while a refusal that names a notice kind
     renders that notice's sentence. Both key functions do this today by calling
     `externalConflictNoticeKey`, and nothing checks it.
5. **The save arm draws its origin line** (`refusedSave`), which is 6c-1 §2 ruling 1 carried to the
   operation panels. **Forced:** nothing. The *save origin* cases read it in both languages.
6. **Shared snippet, not shared component** (entry 10, 6c-1 §2 ruling 2). **Forced:** the two arms of
   one panel render one block. **Not forced:** that the three snippets stay alike. Each one is
   carried by its own suite.
7. **R39 — each reused sentence was checked against this producer.** The following were found true
   of the external origin on these surfaces:
   - `retainedOperation`, `operationIdentityIsOld` and `diskVersion`;
   - `deleteSnippet` and `duplicateSnippet`: opening either panel is the ask, because the pane's
     control reads *Delete this snippet…* / *Duplicate…*;
   - each surface's `reloadIdentifiesNoSnippet`;
   - `reloadUnavailableOperation` and `readyOperation`;
   - the `externalEvidence.*` and `supersededConflict` obstacles;
   - `recovery.unavailable.operationDraft`.

   Two sentences were **not** true for a mover nobody touched: the operation summary and the
   destination warning (ruling 3). The remaining overclaims are §4 item 2.
8. **The suites press conflict choices inside the external panel.** In Spanish, the header's close
   control on the deleter and the duplicator reads the same as the operation's *keep editing* choice
   (*Dejarlo como está*). A search of the whole panel finds the close control first. That is a
   wording defect, recorded in §4 item 1. The suites do not paper over it by pressing whichever
   control comes first.

## 3. Acceptance, clause by clause

| Clause | Where it is checked |
|---|---|
| The three panels draw the **origin** for an external conflict, EN and ES | *draws the origin, evidence and comparison…* in each panel suite. `DPT` *drawn sentences through the pane* (3 × 2). Both assert `changedWhileOpen` and the absence of `refusedSave` and *expected*. |
| The **comparison** | The same cases: the retained operation, `operationIdentityIsOld`, the whole disk text (a marker word), the readiness line, and the three choices in the case's locale. |
| **Reapply** (only where something was asked; §5, finding 1) | *rebuilds … through Keep what I asked for*: one adoption of this conflict, the `reapplied` report, the external panel gone. The next send carries the twin's identity at the observed revision. |
| **Manual resolution** | *refuses Keep what I asked for without evidence*: `manualResolution` plus `externalEvidence.noCorrespondence`, no adoption, the conflict kept. |
| **Reload** | *reloads in two steps and closes on what the window answers*, × `installed` / `alreadyThere` / `refused` × EN/ES on each panel. Entry 34's three adoption effects: close, close, and stay open with the reload-unavailable line. |
| **Every offered control** | *Leave this as it is* (keep), *Keep what I asked for* (both outcomes), *Load the version on disk*, *Close this and load it* — on every panel, in EN and ES. |
| **Direct submission refused** | Deleter: the question is withdrawn and no request is offered. Mover and duplicator: the send is disabled, a press sends nothing, and the reason sits beside it. Held reading: *Delete it* is disabled (ruling 2), and *Move* / *Duplicate* are disabled. |
| **Supersession withdraws the warning** | *withdraws the reload warning when a later reading supersedes the conflict*: the second step, its warning and the old revision go; the new revision is drawn. |
| **Locale switch keeps the session** (entry 35) | *keeps its session across a change of language*, on each panel. |
| **7a §4 item 1: the mover's and duplicator's `externalConflict` refusal** | `.actions` contains `fileChangedWhileOpen`, in the panel suites and in `DPT`. |
| **7a §4 item 1: `RecoveryWithoutCreation` over `view.conflict`** | `recoveryNote === 'operationDraft'` and its sentence, in the panel suites and in `DPT`. |
| **7a §4 item 1: the deleter's withdrawn question** | The origin case (question gone, and the external panel says why) and the held-question case (the notice says why). |
| **Uncertainty and waits** | *withholds the reload and the reapply while an earlier write's outcome is unknown* (`writeOutcomeUnknown` notice, only *keep*). *says a reading waits behind a conflict* and *refuses … while a reading waits, and says so once* (mover and duplicator). |

**Shown discriminating.** For each mutation below, the files were backed up, mutated for one run,
restored, and compared with `cmp` (identical):

| Mutation | Result |
|---|---|
| The three `{#if external !== null}` changed to `{#if false}` | **75 failed** across the four component suites (`/tmp/7b-mut1.txt`) |
| `MM`'s reveal cue put back to `reloadWarning !== null` | The mover reveal case failed: `AssertionError: expected [] to have a length of 1 but got +0` |
| `noticesBesideRefusal` filtering nothing | 5 failed: `expected 2 to be 1` (mover and duplicator × EN/ES) and the unit case |

**Gates.** Each was run on its own, with the output redirected to a file and the exit read from that
file:

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings |
| `npm test` | 0 | **3053 passed**, 65 files |
| `npm run build` | 0 | **193 modules** (unchanged: no new module) |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | no match: the server-only markers are absent |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2`: the client-only markers are present |
| `cargo test --workspace -- --test-threads=1` | 0 | **1323 passed**, 0 failed |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean |
| `cargo fmt --check` | 0 | clean |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

New rung: **`1323 / 449 / 3053 / 193`**. Only read-only git commands were run. The four instrument
paths, `PROGRESS.md` and `PROGRESS.json` were not touched.

## 4. Open items (not fixed here, `CLAUDE.md` §7)

1. **Spanish label collision.** `browser.matchDeletion.close` and `browser.matchDuplication.close`
   read *Dejarlo como está*, and so does `browser.saveOutcome.choice.keepOperation`. Under any
   conflict, the panel shows two controls with one label and different effects: one closes the
   panel, the other keeps it. Both write nothing. The English labels differ (*Leave this alone* /
   *Leave this as it is*). This is for ruling 40's bilingual review (2d-6-11).
2. **A mover nobody touched still meets sentences that assume an ask.** These are
   `operationKeptInMemory` (*"What you asked for here is still set up"*), `reloadAbandonsOperation`
   and `recovery.unavailable.operationDraft`. *Keep what I asked for* and `readyOperation` are no
   longer offered to it: §5, finding 1 withholds and refuses that reapply.
3. **The mover's and the duplicator's `externalConflict` refusal repeats the external panel's first
   message** (`fileChangedWhileOpen`), just as 6c-1 §4 item 3 found for the recovery form. A shorter
   key is a dictionary decision for 2d-6-11.
4. **`recovery.unavailable.operationDraft` advises *Load the version on disk*** even while the reload
   is withheld under an unknown write outcome. The save arm had the same case after a refused spend.
5. **The superseded-evidence manual resolution** (`supersededConflict`) is driven by the model suites
   and not by a mounted operation case. The mount stand-ins cannot make the window's standing origin
   disagree with the delivered one without a further hook.
6. **`MD`'s `confirmationRefused` flag is not cleared by a delivery.** A stale-reading sentence set by
   an earlier press stays beside a later external panel. It stays true, because it is about that
   press, but it is one more line on the screen.
7. **What 7c's window reading should look at:**
   - each panel's external panel, and its reveal into view, in EN and ES;
   - a mover opened and left alone when the file changes (no summary, no destination warning);
   - the deleter's question withdrawn, and *Delete it* disabled under a held reading (hard to
     reach: it needs a reading held during a write in flight);
   - the Spanish *Dejarlo como está* pair (item 1);
   - the mover's refusal line beside the external panel (item 3).

   jsdom lays nothing out, so nothing here says where these land or how they look.
8. **`MatchEditor.svelte`, `MatchCreator.svelte` and `RecoveryPanel.svelte` have the reveal shape
   §5 finding 2 fixed here** (`outcome?.kind ?? (external ? 'conflict' : null)`, targeted through
   `outcomeShown`). The editor, for one, keeps a `saved` outcome as history beside an external
   conflict. The review named only the three operation panels, so those three were not changed.
9. **Still open from earlier records:** 7a §4 items 3-5 and 7a §7 item 1, 6b §7 items 1 and 3, and
   the acknowledgement control for `writeOutcomeUnknown` (2d-6-9).

## 5. The review's findings, re-derived and fixed

**Codex adversarial review, `ship-with-fixes`: 0 blockers, 2 should-fix**
([`docs/reviews/phase-2d-6-7b.md`](../reviews/phase-2d-6-7b.md)). Each finding was re-derived by
writing its case first against the tree as reviewed. **Both held.** No re-review follows (`CLAUDE.md`
§7).

### Finding 1 — a mover nobody touched was offered *Keep what I asked for* (`MM:806`)

**Re-derived.** §2 ruling 3 removed the false summary and warning, but it left the reapply offered.
Pressing it rebuilt the snippet's own origin placement against the disk version. Where the snippet
had moved on disk, that rebuild set up a destination the person never chose.

**Cases:**
- `matchMove.test.ts`, *withholds and refuses the reapply for a mover raised before anything was
  chosen*. The evidence is good enough to rebuild, so only the missing request can refuse.
  - Pre-fix, verbatim (`/tmp/7b-f1-prefix.txt`):
    `AssertionError: expected [ 'keepEditing', 'keepMyDraft', …(1) ] to deeply equal [ 'keepEditing', 'reloadDiskVersion' ]`.
  - With the choice assertions skipped for one run (`/tmp/7b-f1-prefix-reapply.txt`):
    `AssertionError: expected { kind: 'reapplied', …(1) } to deeply equal { kind: 'manualResolution', …(1) }`.
- `MatchMover.test.ts`, *describes no operation, offers no reapply and no lost destination for a
  mover nobody touched* (EN + ES) now also asserts that there is no *Keep what I asked for* and no
  readiness line. With the withholding mutated off for one run: `AssertionError: expected true to be
  false // Object.is equality` (both rows). The file was restored and compared with `cmp`.

**Fix, in `M`:**
- `effectiveCapabilitiesOf` withholds the reapply when the conflict's retained draft is not dirty.
- `reapplyToDiskVersion` refuses it before reading any evidence, with a new obstacle,
  `{ kind: 'nothingRequested' }`. No adoption happens.
- The obstacle's sentence is a new key, `browser.matchMove.reapply.nothingRequested`, in EN and ES.
  It is rendered through `moveReapplyObstacleKey` and the `describeMoveReapplyObstacle` switch in
  `i18n/index.ts`. The exhaustive arm list in `reapplyCodes.test.ts` gained the arm.
- The panel now offers only *Leave this as it is* and the reload.

**Forced:** a pristine move is never rebuilt. Both the choice list and the transition read the
same `isDirty(conflict.draft)`. **Not forced:** that a caller does not hand the transition a
hand-built session whose draft differs from its conflict's.

### Finding 2 — a refusal kept as history took the reveal from the active conflict (`MM:466`, also `MD`, `MU`)

**Re-derived.** A replacing verdict keeps a `refused` or `saved` outcome as history (entry 7). The
reveal cue was `outcome?.kind ?? …`, and the target was chosen through `outcomeShown`. So after a
refused send, a delivered conflict pointed the reveal at the old refusal, and the reload's second
step was never revealed.

**Case:** the same case in each of the three suites' reveal describes: *reveals the external panel
over a refusal kept as history, and its controls at the reload step*. It covers delivery after a
refusal, then the reload step. **Pre-fix, verbatim** (`/tmp/7b-f2-prefix.txt`), all three:
`AssertionError: expected <div …(2)><p …(1)></p> …(4)</div> to be <div …(2)>…(12)</div> //
Object.is equality`. The scroll target was `div.panel` (the refusal), not `div.panel.external`.

**Fix, in `MD`, `MM` and `MU`:**
- The cue is now `external !== null ? 'conflict' : (outcome?.kind ?? null)`.
- The target is chosen by `externalShown`.
- The comments say so.

The authored panels have the same shape (§4 item 8).

### Gates after the fix round

Each command was run on its own, with its output redirected to a file and the exit read from that
file:

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings |
| `npm test` | 0 | **3057 passed**, 65 files (+4: the model case, and the three reveal cases) |
| `npm run build` | 0 | **193 modules** |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | no match: the server-only markers are absent |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2`: the client-only markers are present |

New rung: **`1323 / 449 / 3057 / 193`**. `cargo test --workspace -- --test-threads=1` was re-run because both dictionaries changed: exit 0, **1323 passed** (no Rust changed). Only
read-only git commands were run. The four instrument paths, `PROGRESS.md` and `PROGRESS.json` were
not touched.
