# Phase 2d-6-6b — registration and delivery wiring

**Status: implemented, reviewed once (`ship-with-fixes`, 1 blocker, held), fixed, gates green.** §6
records the fix round.
Risk class: **high** — the first 2d-6 step that wires components. The editor, the new-snippet form
and the recovery form now report receivers that the window really delivers to. The coordinator's
registered transition now arbitrates for them. The recovery form is the eighth `OpenWriteSurfaceKind`,
and the shell's empty state no longer unmounts an open surface. **One new module**
(`src/lib/browser/surfaceReceivers.ts`), one new test file, one new dictionary key (EN + ES). **No
Rust, no `src-tauri/` file.**

This is the second of the three sub-phases 2d-6-6 was cut into
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of 2d-6-6*). It takes
what 6a owed (its §4 items 1, 2, 3 and 5) first, then the wiring. 6c's work is the three authored
panels' rendering (origin, evidence, comparison, copy and recovery), their bilingual mounted
rendering tests and the narrow window reading. None of it is done here.

---

## 1. What changed

Line numbers are of the final tree. `E` is `src/lib/browser/matchEditor.ts`, `C` `matchCreation.ts`,
`V` `recovery.ts`, `D` `matchDeletion.ts`, `M` `matchMove.ts`, `U` `matchDuplication.ts`, `S`
`restore.ts`, `R` `surfaceReceivers.ts`, `DP` `src/lib/components/DetailPane.svelte`.

### 1.1 What 6b owed 6a — first, each pinned by a case shown failing

- **The six reloads take a required reader** (6a §4 item 1): `reloadTheDiskVersion(session, adopt,
  current)` at `E:2105`, `C:1917`, `D:1264`, `M:2077`, `U:1533`, and `reloadRecoveryDiskVersion(session,
  adopt, current)` at `V:2591`. `current` is `ReadTheInstalledSession`, or `ReadTheInstalledForm` on
  the recovery form. The shape copies 2d-6-5's `loadDiskVersion` and restore's `reloadTheDiskVersion`
  (`S:3766`):
  1. The function takes its own reads first (`session.reload`, `reloadableConflictOf`). The recovery
     form's `session.closed` guard still comes before them.
  2. It reads `current()` once. A displaced session is answered with the installed one, and the
     window is never asked.
  3. It spends the confirmation.
  4. It reads `current()` again. A session that now shows **another conflict** (compared by source
     identity) is answered untouched.
  5. Otherwise the refused arm, or the closing arm, is built over the settled session, so a wait
     recorded during the adoption is carried forward on the refused arm.

  Each doc gained `@param current … Required.` and a paragraph saying what no type forces: that the
  reader is honest. Each reader type's doc now lists the reload among its users. **Every caller passes
  one**: the six components use the idiom `const held = session; const confirmed =
  confirmDiskReload(held); reload…(confirmed, adoptDiskVersion, () => session === held ? confirmed :
  session)`. On `RecoveryPanel.svelte` the reader answers `session ?? confirmed`, for 6a §2 ruling 4's
  reason. The suites rewrote 67 two-argument calls, 9 of them in `workspace.test.ts`.
- **The "another conflict after a successful adoption" arm of the three authored reapplies** (6a §4
  item 5) is pinned at `matchEditor.test.ts:2837`, `matchCreation.test.ts:2293` and
  `recovery.test.ts:2857`. The reapplies are `E:2859`, `C:2573` and `V:3019`. In each case `adopt`
  answers `installed` after the holder has become a session showing another conflict, and the
  reapply answers `manualResolution` / `supersededEvidence` and rebuilds nothing.
- **The mounted case for the reapply-handler order** (6a §7 finding 3, §4 item 5 second half):
  `DetailPane.test.ts:2056`. It runs through the real pane over a real `BrowserState`, and a delivery
  lands inside the synchronous *Keep my draft* handler (§1.4).
- **The real standing origin, never `standing: null`** (6a §4 item iii). All six components that call
  a reapply now take a required `standingConflictFor: (document: DocumentId) => ConflictSource | null`
  prop, which `DP` wires to `browser.standingConflictFor`:
  - `MatchEditor.svelte` and `MatchCreator.svelte`, and through them `RecoveryPanel.svelte`
  - `MatchDeleter.svelte`, `MatchMover.svelte` and `MatchDuplicator.svelte`

  Each reapply hands `() => standingConflictFor(<its file>)`: the editor's `session.match.document`,
  the form's `chosen` (`null` answered only for a form that names none, which is refused
  `destinationRequired` before the guard is asked), and the operation panel's `projection.id`.

### 1.2 Registration and delivery (`R`, `DP`, the three authored components)

- **`R` — the parent's binding record** (the consult's Q1: "put the receiver, instance token and
  registry lease together in the parent's binding record"):
  - `ReceivingSurfaceKind` (`R:69`) = `matchEditor | matchCreator | recovery`.
  - `SurfaceBinding` (`R:81`) has two members. `reportTarget(target | null)` is used by the recovery
    panel. `withdraw()` is one-shot.
  - `BindObservationReceiver` (`R:111`) is the required callback prop type.
  - `ReceiverRosterHost` (`R:119`) is `register(document, receiver)` plus a `reportTarget` sink.
  - `ReceiverRoster` (`R:138`) has four members:
    - `bind(kind, receiver)` displaces an earlier binding of the kind, returns its registrations at
      once, and registers the new one immediately over the files the last reconciliation wanted.
    - `reconcile(surfaces, eligible)` makes each live binding's registrations exactly the file its
      surface names, or every eligible file while it names none.
    - `receives(kind)`
    - `dispose()`
  - `createReceiverRoster` is at `R:221`. Every registered closure names its own binding and checks it
    is still the live one before calling through, so a displaced instance's registration can deliver
    to nothing.
- **`DP`**:
  - `recoveryTarget` (`DP:526`) is where the eighth kind's target lands.
  - `receivers` (`DP:556`) is the roster over `browser.registerObservationReceiver`. A reported target
    is assigned only when it differs.
  - `bindReceiver(kind)` (`DP:571`) is the prop handed to children.
  - `transitionOf(kind)` (`DP:758`) is what the pane now registers with each write surface, in place
    of the removed `tellNobodyYet`. It hands the observation to `browser.observeExternalChange` when
    `receivers.receives(kind)`, and is a no-op otherwise (§2 ruling 3).
  - `eligibleDocuments` (`DP:918`) is `creatorEligibilityOf` over `browser.documents` and this pane's
    projections.
  - A second `$effect` (`DP:938`) reconciles the roster against `openSurfaces`.
  - `onDestroy` disposes the roster (`DP:959`).
  - The editor and the creator are handed `reportReceiver`, `reportRecovery` and
    `standingConflictFor` (`DP:1333`, `:1417`). The three operation panels are handed
    `standingConflictFor` (`DP:1353`, `:1374`, `:1396`).
- **`MatchEditor.svelte:372`, `MatchCreator.svelte:296`**: each reports a receiver that installs
  `applyObservation(session, delivery)` over the session held now. The call is synchronous in the
  component's initialisation, so the host's registration effect, which runs later, never sees the
  surface without its receiver. The binding is withdrawn in `onDestroy`. `reportRecovery` is passed to
  `RecoveryPanel` as `reportSurface`, untouched.
- **`RecoveryPanel.svelte:216`** reports a receiver that applies `applyRecoveryObservation` to the form
  held now, and to nothing while no form is open. From an effect (`:235`) it reports
  `recoveryTargetOf(session)`, or `null` while no form is open or once the form has closed. It
  withdraws in `onDestroy`.
- **The first live component path for `observeExternalChange` and `supersedeConflict`**:
  1. The coordinator's `tellTheSurfaceAbout` (`observationTransitions.ts`) calls `transitionOf(kind)`.
  2. `observeExternalChange` arbitrates once.
  3. The one envelope reaches every receiver registered over the file.
  4. A `supersedes` verdict reaches `supersedeConflict` inside the receiver's transition. The
     one-decision case below delivers exactly that.

### 1.3 Recovery as the eighth centrally assembled kind (`S`, `writeSurfaceRegistry.ts`, `DP`)

- `OpenWriteSurfaceKind` (`S:421`) gains `'recovery'`, and its doc is corrected: it had seven
  members, and it now says what the union forces and what it cannot.
- New `DestinationChoosingKind` (`S:448`) = `matchCreator | recovery`. `OpenWriteSurface` (`S:520`)
  lets both carry an `unknown` target.
- `CompetingWriteSurfaceKind` grows to seven by exclusion. `openWriteSurfaceKey` (`S:841`) answers
  the new key `browser.restore.refused.recoveryOpen` (§2 ruling 5).
- The `targetingSurfaceFor` doc says an unknown recovery is attributed as an unknown creator is. The
  function switches on the target arm, so its code did not change.
- The registry's `ownedSurface` / `ownedDocumentSurface` (`writeSurfaceRegistry.ts:422`, `:457`)
  accept `recovery` over the unknown arm. Its three "no-op" and "seven" sentences were corrected.
- `DP`'s `satisfies Record<OpenWriteSurfaceKind, PaneWriteSurface>` assembly has an eighth entry
  (`DP:694`). Every "seven" sentence in the pane says eight, or says why `busy` still counts seven:
  recovery opens *beside* the editor or the form that mounts it.

### 1.4 The shell kept mounted, the creator's destination gate

- `AppShell.svelte:131`: the empty state draws only when
  `browser.documents.length === 0 && browser.openWriteSurfaces().length === 0`. The comment beside it
  says what the predicate cannot keep: a surface the pane has not registered yet.
- `MatchCreator.svelte:800`: the destination buttons are gated on `view.canChooseDestination`, not
  `view.editable` (2d-6-3 §4 item 1). The view field's doc in `C` now says the component reads it.

### 1.5 Sentences corrected in place (entry 41)

Each of these said "no component registers", "2d-6-6 wires" or "no-op" and is now false:

- **`workspace.svelte.ts`**: the `ObservationReceiver` doc, the `observeExternalChange` doc's "who is
  registered", the `registerObservationReceiver` doc's "no production code registers … in this phase"
  and "the mounted test is 2d-6-6's", and the `observationReceivers` comment.
- **`observationDelivery.ts`**, **`conflictSource.ts`** and **`saveOutcome.ts`**: the module headers
  and `ExternalConflictModel`.
- **`observationTransitions.ts`**: `transitionFor`'s "every registered transition is a no-op".
- **`writeSurfaceRegistry.ts`**: its module and `WriteSurfaceTransition` docs.
- **`E`, `C`, `V` module headers**: now "registered since 2d-6-6b".
- **`D`, `M`, `U`**: the headers say "2d-6-7 wires", which was "2d-6-6 wires".
- **`E`, `C`, `D`, `M`, `U`, `V` receiver and reapply docs**: "the wiring is 2d-6-6's", "does not
  yet hand the live closure down, and passes `null`", and the six `unaskedGuard` docs' "passes `null`
  until 2d-6-6b hands the live closure down".
- **`V`**: `recoveryTargetOf` and its module paragraph on what the form reports upward.
- **`C`**: `creationTargetOf`.
- **`MatchCreator.svelte`**: "the one surface `OpenWriteSurface` lets name none".
- **The split record**: its 2d-6-6b bullet had said the capability file gains two entries (§2 ruling
  7).

## 2. Rulings taken here, and what each does not force

1. **A destination-less recovery form is registered as an `unknown` target.** It is not left
   unregistered. `OpenWriteSurface` widens through `DestinationChoosingKind`, as 2d-6-3 §4 item 3
   allowed. What it forces: an open form is always a surface, so it protects its file, or every
   eligible file while it names none. What it does not force: that the recovery form's own
   destination set equals the creator-eligible set it is attributed to (§4 item 4).
2. **A surface that names no file is registered over every creator-eligible file** (2d-6-3 §4 item 2
   pointed here). It is the exact set `targetingSurfaceFor` attributes an unknown target to. The set
   comes from `creatorEligibilityOf` over the pane's own summaries and projections, re-derived in the
   reconciliation effect. It cannot force the set to be current between a projection change and the
   next flush. That is the same gap every registration in the pane already has. Nothing asks the
   window inside it, because the coordinator runs on microtasks and a flush is synchronous.
3. **The registered transition arbitrates only for a kind with a live binding, and is a no-op
   otherwise.**
   - Arbitrating for a surface nobody is told of would register a standing origin no session knows.
     A later save conflict on that file would then meet an origin it did not produce.
   - The five kinds whose receivers are 2d-6-7's and 2d-6-8's keep the 2d-5 behaviour: the file is
     marked stale and not reloaded, and the command's revision check refuses a stale write.
   - Entry 1's "a missing receiver must retain delivery and block submission" is met by **ordering,
     not by retention**:
     - Every receiving child reports during its own initialisation, which comes before the pane's
       effect registers its surface.
     - It withdraws in the same flush that unregisters the surface.
     - So the no-binding state is not reachable through this pane.
   - No type forces that ordering.
4. **Instance-bound through binding identity, not a counter.** A later `bind` displaces the previous
   binding and makes its two methods inert. It also registers the new binding at once over the files
   the last reconciliation wanted, so a same-flush replacement is not left undelivered. What it
   cannot force: that a child calls `bind`, installs the envelope into its own session, or withdraws.
   The mounted suites establish all three for the three components.
5. **A new key, `browser.restore.refused.recoveryOpen`, over reusing `matchCreatorOpen`.**
   - `restore.test.ts` pins one distinct sentence per competing surface, and a recovery form is not
     "a form for adding a snippet" in the creator's sense.
   - The Spanish is this implementer's draft and awaits ruling 40's bilingual review (2d-6-11).
   - The competing refusal is unreachable today, because `busy` keeps a restore from opening beside
     an editor or a form.
6. **The live standing guard goes to the three operation panels too.** 6a §4 item iii names every
   component. Only the reapply's guard changed there: those panels register no receiver (2d-6-7).
   Their mounted suites stand in for the window with a per-file map that a scripted `conflict`
   answer fills, mirroring what `BrowserState` registers. The four other component suites do the
   same, because `() => null` would make every reapply refuse as superseded.
7. **`src-tauri/capabilities/default.json` is unchanged, and so is the Rust gate.** Both event
   permissions have been granted since 2d-5-7a. `AppShell.svelte` already registers the frontend's
   one Tauri listener. 6b's receivers are in-process callbacks on `BrowserState` and register no
   Tauri listener, so the item's condition ("only if this phase registers the first Tauri event
   listener") does not hold. Nothing under `src-tauri/` or `crates/` was edited.
8. **A closed recovery form is not a surface**: it writes nothing more, and reporting it would keep
   its file from reloading for nothing.
9. **The shell's predicate is the registry's reactive `openWriteSurfaces()`**, not a pane-local flag.
   It is the one live set the coordinator also reads. It cannot keep a surface the pane has not yet
   registered.
10. **Delivery tests use `DetailPane.test.ts`.** It already carries the entry-37 invoke guard, and no
    new jsdom file was needed. Its blanket zero-drain became an exact per-case count
    (`expectedDrains`, entry 36). `scriptedCommands` gained an optional `PaneScript` (files, views,
    `save_match`, and a finite batch queue). `mountPane` gained a wake transport, and with one it
    starts the lifecycle in `AppShell.svelte`'s order.

## 3. Pinning cases, and their failures before the fix, verbatim

**The six reloads.** The model cases were written before the source edit and run against the
untouched modules:

| Suite | Displaced before the adoption | Another conflict during it | A wait carried through a refusal |
|---|---|---|---|
| `matchEditor.test.ts` | :2885 | :2894 | :2913 |
| `matchCreation.test.ts` | :2340 | :2349 | :2368 |
| `matchDeletion.test.ts` | :1895 | :1904 | :1923 |
| `matchMove.test.ts` | :3002 | :3011 | :3030 |
| `matchDuplication.test.ts` | :2195 | :2204 | :2223 |
| `recovery.test.ts` | :2907 | :2916 | :2936 |

Failures verbatim, for the first two columns (displaced before the adoption, and another conflict
during it):

- **Editor**: `AssertionError: expected { match: { document: 1, …(2) }, …(19) } to be { match: {
  document: 1, …(2) }, …(19) } // Object.is equality`
- **Creation**: `AssertionError: expected { …(21) } to be { …(21) } // Object.is equality`
- **Deletion**: `AssertionError: expected { match: { document: 2, …(2) }, …(16) } to be { match: {
  document: 2, …(2) }, …(16) } // Object.is equality`
- **Move**: the deletion line with `…(21) }` in place of `…(16) }`.
- **Duplication**: the deletion line with `…(19) }` in place of `…(16) }`.
- **Recovery**: `AssertionError: expected { Object (origin, transfer, ...) } to be { Object (origin,
  transfer, ...) } // Object.is equality`

Failures verbatim, for the third column (a wait carried through a refusal):

- **Editor**: `AssertionError: expected null to be { sequence: 6, document: 1, …(6) } //
  Object.is equality`
- **The other five**: `AssertionError: expected undefined to be { sequence: 6, document: 2, …(6) } //
  Object.is equality`

**The reapplies' post-adoption "another conflict" arm** (6a §4 item 5). The code already existed, so
each case was shown discriminating by disabling that check for one run with a `false &&`, then
restoring the three modules from backups (`cmp` identical). All three failed with the same line:
`AssertionError: expected { kind: 'reapplied', …(1) } to deeply equal { kind: 'manualResolution',
…(1) }`.

**The mounted cases.** The wiring landed before these cases were written. Each case was then shown
discriminating: its fix was reverted for one run, and the file restored from a backup copy with
`cmp` identical:

| Reverted to | Case | Failure, verbatim |
|---|---|---|
| The pre-6a handler `attemptOfReapply(session, reapplyToDiskVersion(session, …))` | reapply-handler order (`DetailPane.test.ts:2056`) | `AssertionError: expected ' Show this file’s text  File match/a.…' not to contain 'Keep my draft'` |
| `null` in place of the live standing guard in `MatchEditor.svelte` | the same case (its guard is asked through the pane's prop) | `AssertionError: expected true to be false // Object.is equality` |
| The creator's destination gated on `view.editable` | both unknown-target creator cases (`:1839`) | `AssertionError: expected true to be false // Object.is equality` |
| The pre-6b no-op transition | every delivery case | pristine editor (EN, ES): `AssertionError: expected [] to deeply equal [ 'raised' ]`; creator: `… [ [ 1, 'raised' ] ]`; recovery over B: `… [ [ 3, 'raised' ] ]`; one decision: `AssertionError: expected [] to have a length of 2 but got +0`; reopened editor: `AssertionError: expected false to be true // Object.is equality`; settlement: `AssertionError: expected [] to deeply equal [ 'retained' ]` |
| `AppShell.svelte`'s old `browser.documents.length === 0` | emptied workspace (`AppShell.test.ts:535`) | `AssertionError: expected 'espansoConfig Language Follow the sys…' not to contain 'This configuration holds no files'` |

**The delivery acceptance, case by case** (`DetailPane.test.ts:1789`). Each case opens its surfaces
through the pane's controls. Each starts the lifecycle over a finite drain queue, counted exactly.
Each wakes the window, so the observation is admitted by the real coordinator and routed by
`targetingSurfaceFor` to the pane's transition. A wrapped `registerObservationReceiver` records which
registration was handed which envelope.

- *A pristine editor conflicts, and refuses to submit*, in EN and ES (`:1801`): the controls are
  found by each locale's label; one `raised`; the box becomes read-only and *Save* disabled; the file
  is `stale` and not reloaded; no save command.
- *An unknown-target creator is delivered about every eligible file*, for file 1 and for file 3
  (`:1839`): it is registered over `[1, 3]` and not over the read-only `b`; the affected file's change
  freezes the boxes; the destination stays choosable; naming the affected file keeps the send refused
  and re-registers over that file alone.
- *Recovery over B protects B while its host stays over A* (`:1884`): exactly one delivery, to the
  form's registration over `c`; the form is frozen and its create is disabled; the host's
  registration and its standing save origin are untouched.
- *Host and recovery over one file get one decision* (`:1930`): two registrations are handed the
  **same** envelope object, `supersedes`.
- *A reopened editor cannot receive an old instance's delivery* (`:1965`): the first registration is
  told once and never again; the reopened editor starts editable.
- *A settlement lands in order* (`:2007`): `retained` while the save is in flight, then `raised` from
  the settlement. The editor ends frozen under the external conflict: the continuation did not
  overwrite it (entry 5).

## 4. Open items, deliberately left (none fixed here, `CLAUDE.md` §7)

1. **`RecoveryPanel.svelte` still gates its destination buttons on `form.editable`.** This is the same
   defect 2d-6-3 recorded for the creator. `RecoveryView.canChooseDestination` exists and nothing
   reads it, so a destination-less recovery form under an external conflict has no way forward on
   screen. The task named the creator only; the recovery panel's rendering is 6c's.
2. **`MatchCreator.svelte` still does not settle a thrown `create`** (2d-6-3). It is 6c's with the
   rendering; the wiring did not need it.
3. **No new rendering.** The external conflict, the notices, `destinationRequired` and the origin
   line are drawn by nothing yet. The mounted cases assert what 6b wires: frozen boxes, disabled
   submission, registrations and envelopes. They do not assert sentences (6c).
4. **An unknown recovery form is attributed to the creator-eligible set** (`targetingSurfaceFor` and
   the roster alike). Its own destinations come from `recoveryDestinationsOf`, a different predicate.
   A file one lists and the other does not is either over-protected or not delivered about. Neither
   installs anything.
5. **The one-slot limit of a destination-less form** (2d-6-3 §2 item 8) is now reachable: two eligible
   files changing are shown as the later one.
6. **`PROGRESS.md`'s *Next action* says the capability file needs the two event entries.** That is
   false (§2 ruling 7). The orchestrator owns that file; the split record's sentence is corrected.
7. **Noticed, pre-existing, not touched:**
   - `MatchCreator.svelte`'s destination-report comment says "It is `targetingSurfaceFor` that has no
     production caller yet", which has been false since 2d-5-4.
   - `restoreCodes.test.ts`'s `COMPETING` comment claims a `satisfies readonly
     CompetingWriteSurfaceKind[]` array turns a missing member into a compile error, which an array
     `satisfies` does not do.
   - The rewritten `workspace.test.ts` reload calls are long single lines.
8. **The window reading is 6c's.** 6b draws nothing new, and no window was read here.
9. **6a's §2 item 2 and §4 items 1, 3, iii and 5 are closed by this phase.** They are left in 6a's
   record as statements of that phase's state.

## 5. Verification

Each gate ran on its own on the final tree, and each exit was read directly, never through a pipe.

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings (+2 from 447: `surfaceReceivers.ts`, `surfaceReceivers.test.ts`) |
| `npm test` | 0 | **2875 passed, 65 files** (+42 from 2833; below) |
| `npm run build` | 0 | **193 modules** (+1 from 192: `surfaceReceivers.ts`). `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` prints nothing; `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` prints `2` |

**Per-file test deltas.** These were re-derived against a `git archive HEAD` copy with the four
instrument files copied in (2833 there):

| File | Before → after | What was added |
|---|---|---|
| `scripts/lint/ipc-detail.test.ts` | 141 → 143 | one row per new file under the scanned roots |
| `matchCreation.test.ts` | 98 → 102 | |
| `matchDeletion.test.ts` | 65 → 68 | |
| `matchDuplication.test.ts` | 77 → 80 | |
| `matchEditor.test.ts` | 131 → 135 | |
| `matchMove.test.ts` | 107 → 110 | |
| `recovery.test.ts` | 93 → 97 | |
| `restore.test.ts` | 253 → 255 | the seventh competing kind in two table-driven cases |
| `surfaceReceivers.test.ts` | new → 4 | |
| `AppShell.test.ts` | 6 → 7 | |
| `DetailPane.test.ts` | 24 → 34 | the recovery walk, plus 9 delivery cases |
| `RestorePane.test.ts` | 61 → 63 | |

Every other file is unchanged.

**The Rust cell is held at 1323 and was not re-measured**: nothing under `src-tauri/` or `crates/`
changed beyond the instrument, whose pair diff is still `5 insertions(+), 1 deletion(-)`. **Git:**
read-only commands only (`git status`, `git diff --stat`, `git archive HEAD` into `/tmp`). The
concurrent worker disabled checks with `false &&` and restored from backups (`cmp` identical), and
this phase's mutation runs restored the same way. No stash, add, checkout or commit was run.
`PROGRESS.md` and `PROGRESS.json` were not edited.

## 6. The review's finding, re-derived and fixed

**Codex adversarial review, ship-with-fixes: 1 BLOCKER, no should-fix**
([`docs/reviews/phase-2d-6-6b.md`](../reviews/phase-2d-6-6b.md)). The finding was re-derived by
writing the cases first against the landed tree and reading their failures. **It held**, on all six
reloads and, as the fix round was asked to check, on the three authored reapplies. No re-review
follows this fix (`CLAUDE.md` §7).

**[BLOCKER] Caller-controlled reads ran after the last installed-session read** (first reported at
`matchEditor.ts:2139`). A reload read `current()` after the adoption and then went on to read the
settled session: `conflictOf(settled)` and the `...settled` spread. A getter or `Proxy` trap there
could tell the window of a later reading, and its receiver would install a new session. The reload
then answered a session built over the old one, which a caller that installs the answer would put
over the delivery. The same class sat before the adoption, where `spendTheConfirmedReload` read
`step.kind` after the pre-adoption check. The three reapplies had it twice:
- the installed session's three facts were read after `current()`, and `adoptForReapply` then read
  the conflict's origin;
- the settled session's conflict and waits were read after the post-adoption `current()`.

**Cases**, written first, each reusing its suite's own fixtures.

The reloads have three cases in each of the six model suites:
- a session `Proxy` armed inside `adopt`, over an `installed` and over a `refused` adoption (`it.each`);
- a reload step `Proxy` on a reload not attempted.

Each asserts the answer is the session the trap installed.

| Suite | Settled read, `installed` / `refused` | Step read, not attempted |
|---|---|---|
| `matchEditor.test.ts` | :2899 | :2919 |
| `matchCreation.test.ts` | :2354 | :2373 |
| `matchDeletion.test.ts` | :1977 | :2001 |
| `matchMove.test.ts` | :3084 | :3108 |
| `matchDuplication.test.ts` | :2277 | :2301 |
| `recovery.test.ts` | :2919 | :2939 |

The reapplies have two cases in each of the three authored suites:
- a `Proxy` armed by the pre-adoption `current()`, whose case asserts `manualResolution` and no adoption;
- a `Proxy` armed inside `adopt`, whose case asserts `supersededEvidence`.

| Suite | Before the adoption | After the adoption |
|---|---|---|
| `matchEditor.test.ts` | :3046 | :3070 |
| `matchCreation.test.ts` | :2499 | :2523 |
| `recovery.test.ts` | :3069 | :3093 |

**Pre-fix failures, verbatim.** The reload lines are the same for all three cases in a suite:

| Suite | Pre-fix failure |
|---|---|
| Editor reloads | `AssertionError: expected { match: { document: 1, …(2) }, …(19) } to be { match: { document: 1, …(2) }, …(19) } // Object.is equality` |
| Creation reloads | `AssertionError: expected { …(21) } to be { …(21) } // Object.is equality` |
| Deletion reloads | `AssertionError: expected { match: { document: 2, …(2) }, …(16) } to be { match: { document: 2, …(2) }, …(16) } // Object.is equality` |
| Move reloads | the deletion line with `…(21) }` in place of `…(16) }` |
| Duplication reloads | the deletion line with `…(19) }` in place of `…(16) }` |
| Recovery reloads | `AssertionError: expected { Object (origin, transfer, ...) } to be { Object (origin, transfer, ...) } // Object.is equality` |
| Reapplies before the adoption, all three suites | `AssertionError: expected 'reapplied' to be 'manualResolution' // Object.is equality` |
| Reapplies after the adoption, all three suites | `AssertionError: expected { kind: 'reapplied', …(1) } to deeply equal { kind: 'manualResolution', …(1) }` |

**Resolution.** Two helpers were added to `src/lib/browser/editorSave.ts`:
- `confirmationOf(step)` (`:436`) reads the confirmation off a step once.
- `settledAnswer(settled, proposed, current)` (`:462`) takes the last `current()` and compares
  identities, which runs no user code. The caller builds its proposed answer as the argument, so
  JavaScript evaluates every read and spread of the settled session before the call.

The six reloads (`E:2111`, `C:1923`, `D:1270`, `M:2083`, `U:1539`, `V:2597`) now run in this order:
1. They snapshot the confirmation before the pre-adoption read.
2. They return `session` for a reload not attempted, with nothing read after that check.
3. They call `adopt(conflict, confirmation)` directly.
4. They answer every post-adoption arm through `settledAnswer`: another conflict, the refused step
   and the closed session. A settled session displaced while the answer was built is answered with
   what is installed now.

`spendTheConfirmedReload` is no longer imported by these six. Raw and restore still use it (§7 item 1).

The three reapplies (`E:2881`, `C:2593`, `V:3040`) now run in this order:
1. They read the installed session's three facts.
2. They mint the authorization with `reapplyAuthorizationFor` from `./saveOutcome`, which replaces
   `adoptForReapply` in these three.
3. They take one last look. A displaced session is answered
   `manualResolution` / `supersededEvidence`, and the window is not asked.
4. They call `adopt(adopted, authorization)` with nothing caller-controlled in between.
5. After the adoption they build the result, then take a last look. A displaced session is answered
   `supersededEvidence` and nothing is rebuilt over it.

The reload docs ("read twice" is now "read three times") and the reapply docs and comments ("nothing
caller-controlled runs between this read and the door") were corrected in place to say what the
code now does. **What no type forces**: that the reader is honest, and that a caller builds
everything before calling `settledAnswer`.

**Gates after the fix round**, each on its own, exit read directly:
- `npm run check`: **449 files**, 0 errors, 0 warnings, exit 0.
- `npm test`: **2899 passed, 65 files**, exit 0. That is +24 from 2875: `matchEditor`,
  `matchCreation` and `recovery` +5 each, and `matchDeletion`, `matchMove` and `matchDuplication` +3
  each.
- `npm run build`: **193 modules**, exit 0. The server-only markers are absent, and the client-only
  markers are present (`2`).

No git write command was run, nothing under `src-tauri/` or `crates/` was edited, and the four
instrument paths are untouched.

## 7. Open items noticed in the fix round (not fixed, `CLAUDE.md` §7)

1. **Raw's `loadDiskVersion` and restore's `reloadTheDiskVersion` (2d-6-5) have the same shape the
   blocker named.** Both call `spendTheConfirmedReload(conflict, step, …)` after their pre-adoption
   `current()` read, which reads the step. Both then read `conflictOf(settled)` and spread `settled`
   after the post-adoption read. Restore also calls `revokeConfirmation(settled)` and `measuredAgainst`
   over it. Their receivers are 2d-6-8's; the fix is `settledAnswer` and `confirmationOf`, the same
   as here.
2. **The three operation reapplies (`D:1784`, `M:2736`, `U:2048`) keep 2d-6-4's pattern (c)**: the
   installed session is read once before `adoptForReapply`. Whether reads follow that look was not
   audited here. Their receivers are 2d-6-7's.
3. **The doors and settling transitions of all eight sessions** (`beginSave`, `applySave`,
   `consumingHeldDeliveries`, and their twins) were not re-audited for reads after their last
   `current()`. 2d-6-5 §7 and 6a §7 fixed the doors they named.
