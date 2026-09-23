# Phase 2d-6-9b-1 — the reconciliation status drawn, its five controls wired, and `stale` widened

**Status: implemented, gates green, not yet reviewed.**
Risk class: **high**. This is the first half of 2d-6-9b. The orchestrator cut 2d-6-9b in two on
2026-09-23, and the cut is recorded in [`2d-6-split-notes.md`](2d-6-split-notes.md) §2 under the
2d-6-9b bullet. **9b-1 was not cut further**: once measured, it fit in one coherent change.

In short:
- `AppShell.svelte`, `Sidebar.svelte` and `DetailPane.svelte` now draw 2d-6-9a's decisions, through
  two new components.
- All five controls are wired: membership reload, lost-history recovery, stale-file reread, retry,
  and acknowledgement.
- The orchestrator's ruling on `stale` is implemented in the model and pinned by tests shown
  failing first.
- The eight write renderers are **not** touched. They are 2d-6-9b-2.
- **No Rust changed.**

Abbreviations:
- `RS` — `src/lib/browser/reconciliationStatus.ts`
- `W` — `src/lib/browser/workspace.svelte.ts`
- `FRS` — `src/lib/components/FileReconciliationStatus.svelte`
- `RSv` — `src/lib/components/ReconciliationStatus.svelte`

---

## 1. What changed

| File | Change |
|---|---|
| `W` | The `stale` ruling (§2). A new reader, `BrowserState.heldDocuments()`, lists the barrier's and the uncertain set's files (9a notes §5 item 3). `adoptDiskVersion`'s interface doc gains one sentence |
| `src/lib/browser/observationTransitions.ts` | Comment only. `ExternalDocumentStatus`'s `stale` doc names the new source and the new clear (entry 41) |
| `RS` | See the list below the table |
| `FRS` | **New.** One file's states and controls, at the placements one host stands for |
| `RSv` | **New.** The workspace banners, their two controls, and the workspace route (one `FRS` per routed file) |
| `AppShell.svelte` | Draws `decideShellComposition` and mounts `RSv` wherever `workspaceBannersDrawnIn` says. The inline empty-state condition is gone |
| `Sidebar.svelte` | Each row draws its short `sidebarRow` mark. The full header sentence goes in the mark's `title` |
| `DetailPane.svelte` | One `FRS` per `headerFilesOf` file, with placements `header`, `selectionNotice` and `surface`, drawn under the selection notice |
| `src/lib/i18n/en.json`, `es.json` | 6 new keys each (§4), 1 corrected sentence (§4) |
| `src/lib/i18n/codes.ts`, `index.ts` | `describeReconciliationRouteNote` and `tReconciliationRouteNote`. Four wrapper comments that said *nothing draws one yet* are corrected |
| `src/lib/components/ReconciliationStatus.test.ts` | **New.** The sidebar/status jsdom suite (§5) |
| `src/lib/browser/workspace.test.ts` | 8 cases for the `stale` ruling |
| `src/lib/browser/reconciliationStatus.test.ts` | 8 model cases for the new decisions. The reader fixture gains `heldDocuments`, and the header comment is corrected |
| `src/lib/i18n/reconciliationStatusCodes.test.ts` | The row keys, the route note, the corrected route sentence and the exits note, pinned in both locales |
| `src/lib/i18n/externalConflictCodes.test.ts` | `BOUNDED_KEYS` takes the 6 new keys, so the forbidden-claim scan covers them |
| `src/lib/components/AppShell.test.ts` | 2 cases (EN, ES): the banner and its reload control over the empty state |
| `docs/decisions/2d-6-split-notes.md` | The orchestrator's cut of 2d-6-9b (§2) |

What `RS` gains:
- `filesToDecide` now also lists held files, through the new reader.
- `ReconciliationStatusReader` gains `heldDocuments`.
- New functions: `headerFilesOf`, `fileStatesDrawnAt`, `fileControlsDrawnAt`, `routePathOf`,
  `standingSnapshotOf`, `acknowledgementMintRefusalOf`, and `routeControlNoteOf` /
  `routeControlNoteKey`.
- `fileReconciliationStateKey` now picks the short row keys for `stale` and `unavailable` at
  `sidebarRow`.
- The header sentences this step falsified are corrected: *no component reads this module yet*, and
  *`projectionReplaced` is not predicted*. The second one was already false after 9a's fix round.

## 2. The orchestrator's ruling on `stale`, implemented

The ruling: **`stale` means "the window holds a disk snapshot of this file newer than its installed
projection"**, whether that snapshot came from an observation or from a save refused as a conflict.

### Marking the file

All six save wrappers' conflict arms now call `rememberTheSaveConflict` (`W`) instead of
`rememberTheConflict`. It marks the file `{ kind: 'stale' }` and then registers the origin, but only
when all three of these hold:
- a projection is installed;
- the conflict's `disk_revision` differs from that projection's revision;
- the file's current status is `null` or already `stale`.

Two choices were taken here and are recorded as such:
- **An `unavailable` or `removed` status is not overwritten.** It is an observation's statement, and
  a refusal carries no sequence to order itself against it.
- **With no projection installed, nothing is marked.** There is nothing the snapshot could be newer
  than.

### Clearing the mark

`rememberTheConflict` records the file's status-write count in a new
`conflictStatusWrites: WeakMap<ConflictSource, number>`. The save arm marks *before* it registers,
so the recorded count includes its own mark.

On the `installed` arm, `adoptDiskVersion` clears a `stale` status only if that count is still the
file's count. In other words, it clears only when nothing has written the file's status since the
conflict arrived. A mark some later observation wrote belongs to that observation.

This applies to both origins. The external arm's mark is written by `tellTheSurfaceAbout` *before*
the transition registers the origin, so the same count rule clears it on the install. Every
observation-derived path is unchanged. Neither `refused` nor `alreadyThere` clears anything.

### The wording still holds

The 9a `stale` sentences stay true under the wider meaning:
- *"What this window shows of this file has not been reconciled with the file on disk."*
- *"Lo que esta ventana muestra de este archivo no se ha conciliado con el archivo del disco."*

Neither says how the window learned it. The new row mark (*Not reconciled* / *Sin conciliar*)
makes no further claim.

### The failures before the fix, verbatim

These are the tests shown failing first, run against the unfixed `W`.

**Mark absent.** The run gave `Tests 7 failed | 5 passed | 358 skipped (370)`. Each of the six
`marks the file stale when '<writer>' conflicts on a revision the window does not show` cases, and
`clears the conflict's stale mark when a confirmed adoption installs the disk version`, failed with:

```
AssertionError: expected null to deeply equal { kind: 'stale' }
```

**Mark present, clear absent.** This run proves the clear half on its own:

```
 FAIL  src/lib/browser/workspace.test.ts > what a conflict does to this window, and what only a confirmed reload does > clears the conflict’s stale mark when a confirmed adoption installs the disk version
AssertionError: expected { kind: 'stale' } to be null
 ❯ src/lib/browser/workspace.test.ts:7338:45
```

`marks nothing when the conflict names the revision the window already shows` passed both before
and after the fix. It is a guard against over-marking, not a reproduction.

## 3. The rendering

All three hosts draw 9a's values. **None of them re-decides what 9a decides.** The only choices
left to markup are which placements a host stands for. Those choices are now values in `RS`, as
listed below.

### Placements

- **`headerFilesOf(surfaces, shown)`.** While any surface is registered, the pane's header speaks
  for the surfaces' target files. Otherwise it speaks for the file the pane shows. A `removed` file
  therefore stays reachable through its surface, with no row.
- **`fileStatesDrawnAt(decision, placements)`.** Each state is drawn **at most once**, at the first
  of the host's placements the decision gave it. That is how the pane's single status block stands
  for both `header` and `selectionNotice`, so `removed` is drawn once and not twice.
- **`fileControlsDrawnAt(decision, placements)`** places each per-file control:
  - the reread beside the header;
  - the retry wherever the held observation is drawn;
  - the acknowledgement **on `workspaceRoute` only**. On a surface, the acknowledgement has to mint
    from the origin that surface's panel shows (`model.source`, entry 14), and only the write
    renderer holds that. That presentation is 9b-2's.

### Presses

Each press calls one `BrowserState` request and draws the refusal it answered, through
`tReconciliationRefusal`:
- the two workspace reloads use `reloadRefusalOf`;
- the reread uses `rereadRefusalOf`, and a `failed` reread is drawn through `tIpcFailure`;
- the retry uses `retryRefusalOf`;
- the acknowledgement uses `acknowledgementRefusalOf`.

When the mint answers `null`, the press asks `uncertaintyAcknowledgementEligibility`, and
`acknowledgementMintRefusalOf` maps the answer:

| Eligibility answer | Refusal drawn |
|---|---|
| `eligible` | `superseded` (the drawn origin no longer stands) |
| `noStandingOrigin` | `superseded` |
| `noHold` | `holdMoved` |
| `writeInFlight` | itself |
| `projectionReplaced` | itself |

A disabled control shows the same sentence as its decided `reason`.

### The route acknowledgement

This discharges 9a notes §3.1 and §5 item 2. In `FRS`, `source` is `standingConflictFor(document)`,
read in the same render as the disk text drawn above the control:
- the text comes from `standingSnapshotOf(source)`, through `SourceText documentStart`, under
  *"The disk snapshot this acknowledgement is about:"*;
- the press hands **that object** to `uncertaintyAcknowledgementFor`.

A newer origin re-renders the text and the handler together, because `standingConflictFor`
subscribes to the hold tables (9a's `holdRevision`). What nothing can force is that a person read
the text before pressing.

### The held-file reader

This discharges 9a notes §5 item 3. The route needs the reader: a removed file whose surface has
closed has no row and no surface, so without `heldDocuments` its hold would stand with nowhere to be
drawn. `routePathOf` names such a file by the display path of the snapshot the window holds, in
this order:
1. the row;
2. the standing origin's projection;
3. the held observation's projection;
4. otherwise the words *"A file this window no longer lists"*.

The path is never a command argument (entry 39).

## 4. Rulings taken here, and wording

1. **9a notes §5 item 5 — no membership reload nobody asked for.** The control exists only beside
   its banner. A reload clears the selection, and with no observation to explain why, an offered
   reload would be an unexplained loss. `RSv`'s header says so.
2. **The route exits of an outlived acknowledgement, measured rather than assumed.** This is
   9a notes §4 point (c).
   - 9a named three exits: the next observation, a later write, and `open()`.
   - **On the workspace route the next observation is not an exit.** No surface receives it, so the
     coordinator's automatic reread installs it (§6 item 1). The projection generation moves further
     and the outlived origin keeps standing.
   - On a surface the next observation *is* an exit: it is registered as a fresh origin at the
     current generation.
   - So the refusal's own sentence (shared by both placements) stays as it was. The route draws a
     **route-only** note beside it, `browser.reconciliation.route.projectionReplacedExits`: *"Acknowledging
     stays unavailable here until a later write to this file from this window ends with a known
     outcome, or the workspace is reloaded."*
   - `routeControlNoteOf` decides when the note is drawn.
   - **9b-2 owes the surface wording**, including the observation exit.
3. **A sentence 9a wrote was false, and is corrected (entry 41).**
   `browser.externalConflict.route.writeOutcomeUnknown` ended *"Until that is resolved, this window
   does not read the file again on its own."* (ES: *"Mientras no se resuelva, esta ventana no vuelve
   a leer el archivo por su cuenta."*).
   - This was measured false: with an uncertainty hold and no surface, a drained `Changed`
     observation issued one `reload_document` and installed `rev-c` while `writeOutcomeUncertain`
     stayed `true`.
   - The clause is removed in both locales. Its literal pin is updated, and a new case asserts that
     neither locale makes the claim.
   - I found this while checking the words I was about to draw. The model gap behind it is **not**
     fixed here (§6 item 1).
4. **Row marks are short.** A row is one line. The new keys `browser.externalDocument.row.stale` and
   `.row.unavailable` read *Not reconciled* / *Sin conciliar* and *Unreadable when observed* /
   *Ilegible al observarse*. The full header sentence is in the mark's `title`, and the header draws
   it once the file is shown.

**New keys, EN and ES:**
- the two row marks;
- `browser.reconciliation.label` (the region's `aria-label`);
- `browser.reconciliation.route.unlistedFile`;
- `browser.reconciliation.route.snapshot`;
- `browser.reconciliation.route.projectionReplacedExits`.

All six are in the forbidden-claim scan. None contains *más reciente* or *newer*. **The new Spanish
has had no bilingual review** (R35), like 9a's.

## 5. The mounted evidence

`src/lib/components/ReconciliationStatus.test.ts` is **new**, opts into jsdom by docblock and
**declares its invoke guard** (entry 37):
- `@tauri-apps/api/core` is mocked to reject, and the `afterEach` holds it at **exact zero**
  (entry 36).
- Every command is a scripted `vi.fn`, and the backup surface is injected.
- It mounts `RSv`, `Sidebar` and `DetailPane` over one real `createBrowserState`, with a scripted
  wake transport.

There are 25 cases. Twelve run once per locale:
- **Banners:**
  - path drift and wanted membership reload, where the press reruns the open (`openWorkspace` 1→2);
  - the reload disabled by an open surface, where dropping the lease permits it and triggers
    nothing;
  - lost history, held by a surface, then recovered on the press;
  - `notWatched` (epoch 0) and a rejected subscription, each with no control.
- **Per file:**
  - `stale` after a refused save, in the row and the header, where the reread issues one
    `reload_document` and clears both;
  - `unavailable` with its reason;
  - `removed`, drawn exactly once in the pane over a surface still open, with no row;
  - the route's unknown outcome beside the snapshot, where the acknowledgement ends it and **calls no
    command**;
  - the outlived acknowledgement, disabled, with its refusal and the exits note;
  - a held observation behind a write in flight, where the retry is disabled with `writeInFlight`
    until the settlement releases it;
  - a retry pressed once, calling no command;
  - a held observation drawn on the pane's surface placement and not on the route.

The retry-enabled state is reached through the one path that holds with no barrier. A getter on the
observation registers a newer origin during the arbitration, so `arbitrateHere` retains it. That is
contrived, and it is the only such path.

**A locale switch on a mounted status panel** moves EN to ES and asserts all of the following:
- the words changed;
- every command's call count is unchanged (so there was no drain and no command);
- `workspaceFactsOf` and `fileFactsOf` are unchanged;
- the selection object is identical;
- the standing origin is identical.

**Negative control.** With the `FRS` mount removed from `DetailPane` and the row marks removed from
`Sidebar`, 8 of the 25 cases failed. They passed again once both were restored.

**Empty-workspace retention with banners** is in `AppShell.test.ts`, in EN and ES, because the
shell builds its own state over the real boundary:
- a drifted `Removed` path raises the banner over the empty state;
- its control is enabled;
- the press is exactly one `open_workspace` / `list_documents` / `drain_external_changes`, inside the
  file's exact invoke list.

The existing 2d-6-6b case (panes kept while a surface is open over an emptied list) still passes
over `decideShellComposition`.

**What none of this shows** is a window. That is 2d-6-9c's reading.

## 6. Open items handed on (not fixed here)

1. **To the orchestrator — entry 15 is not enforced on the coordinator's automatic path.** Measured
   with a scratch test, since deleted:
   - with an uncertainty hold on a file and no surface over it, a drained `Changed` observation made
     the coordinator's guarded reread issue `reload_document` and install the new projection;
   - the hold stayed standing throughout.

   `decideAutomaticReload` is asked only by `requestFileReread`. `2d-6-1c-notes.md` §1.4 says the
   automatic path was left untouched on purpose. Entry 15 says *"The hold blocks automatic rereading
   after its surface closes."*

   Enforcing it is model work (the host's `rereadUnderGuard` member in `W`). But it would leave a
   `stale` file under a hold with **no origin to acknowledge**: the observation that marked it was
   never registered. That is a new dead end, so it needs a ruling on whether a refused automatic
   reread should register the observation as an origin. The corrected route sentence (§4 item 3)
   claims nothing either way.
2. **To 9b-2:**
   - The acknowledgement on a surface, minted from the panel's own `model.source`, together with
     `acknowledgeSnapshot` / `acknowledgeRestoreSnapshot`.
   - Its `projectionReplaced` wording, which on a surface **does** have the observation exit.
   - **The held and uncertain sentences are already drawn once on the surface placement**, by the
     pane's `FRS` block. A renderer must not draw them a second time. It adds only the
     acknowledgement and its snapshot.
3. **To 9c:**
   - Read the banners, the route (including the snapshot), the row marks and the pane's status block
     in a window, EN and ES, over a ruling-38 hard fixture.
   - The retry-enabled state has no natural reproduction, and a reading should name it as unread
     unless it finds one.
4. **Carried:**
   - 9a notes §7.3 item 1: the dead end of an outlived origin. The route now says its real exits.
   - `2d-6-8c-notes.md` §4 items 1-3 and 5-8.
   - The bilingual review of 9a's and 9b-1's Spanish.

## 7. Verification

Each gate was run on its own, with its output redirected to a file and read from that file. The
tree includes the uncommitted instrument. No Rust changed, so no Cargo gate is owed.

| Command | Exit | Evidence |
|---|---|---|
| `npm test` | 0 | **3271 passed**, 69 files |
| `npm run check` | 0 | **456 files**, 0 errors, 0 warnings |
| `npm run build` | 0 | **198 modules** |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | nothing found (server-only oracle absent) |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2` (client-only oracle present) |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)`, unchanged |

**New rung: `1323 / 456 / 3271 / 198`**, with the instrument in the tree.

The test deltas were attributed per file with the JSON reporter, against a pristine `git archive HEAD`
copy. That copy measured 3217, which is the recorded 3218 less the instrument's one `ipc-detail`
row.

| Figure | Change | Per file |
|---|---|---|
| Rust tests | unchanged | no Rust touched |
| svelte-check files | +3 | `FRS`, `RSv`, `ReconciliationStatus.test.ts` |
| vitest tests | +53 | See the breakdown below |
| Vite modules | +4 | two new styled components, two each. `RS` was already in the bundle |

The +53 vitest tests break down as:
- `ReconciliationStatus.test.ts`: +25
- `workspace.test.ts`: +8 (6 writers + no-mark + clear)
- `reconciliationStatus.test.ts`: +8
- `reconciliationStatusCodes.test.ts`: +3
- `AppShell.test.ts`: +2
- `scripts/lint/ipc-detail.test.ts`: +3 (one row per new file)
- `scripts/lint/hardcoded-strings.test.ts`: +2 (one per new component)
- `scripts/lint/built-translation-keys.test.ts`: +2 (one per new component)

Only read-only git commands were run. There was no commit, no stash, and no edit to `PROGRESS.md`
or `PROGRESS.json`, and none of the four instrument paths was touched. The pristine copy and the
scratch test were deleted after use.

## 8. Fix round — `docs/reviews/phase-2d-6-9b-1.md`

**Verdict: `ship-with-fixes`, 0 BLOCKERS, 2 SHOULD-FIX.** The review was written by the fallback
reviewer after Codex returned a malformed result. I re-derived both findings against the code, and
**both hold**. Each fix stays inside the files the finding named. The additions to
`reconciliationStatus.ts`, its tests and the mounted suite were asked for by finding 2.

### 8.1 Finding 1 — the failing side of the `stale` guard was not tested (`workspace.test.ts`)

**Re-derivation.** The 9b-1 cases pinned only the positive side: the six writers mark, a conflict
at the shown revision marks nothing, and an install clears. Nothing pinned a clear being *refused*,
nor a mark being *withheld*.

**Five cases were added**, in the "what a conflict does" suite. The ones that need an
observation-written status drive it through the real coordinator (`startedWithOneWake`: three
declared drains, the third carrying the observation):

1. **A stale mark written after the conflict survives an installed adoption.** A later `Changed`
   takes the automatic path, marks the file `stale`, and its `reload_document` fails. The adoption
   still answers `installed`, and the mark stands.
2. **An `unavailable` written after the conflict survives an installed adoption.**
3. **`rememberTheSaveConflict` leaves an `unavailable` alone**, and a later installed adoption
   does not clear it either.
4. **It leaves a `removed` alone.**
5. **Nothing is marked when the file has no projection installed** (a save to document 4, which
   this window never loaded).

**Against deliberately broken guards.** Each variant was written into `W` in turn, the six
conflict cases were run, and `W` was restored (checked with `cmp` afterwards):

| Broken guard | Failed |
|---|---|
| Install clear without the status-count comparison | case 1 |
| Install clear without the `kind === 'stale'` test | case 3 |
| Mark without the `null`-or-`stale` status condition | case 3 |
| Mark with `held?.revision !== diskRevision`, so a missing projection counts as different | case 5 |

Two cases fail only when **both** guards on their path are broken:
- **Case 2.** The later `unavailable` moves the count, *and* it is not `stale`.
- **Case 4.** A removal drops the projection, so the missing-projection guard also holds.

### 8.2 Finding 2 — the pane decided which file it shows (`DetailPane.svelte`)

**Re-derivation.** The pane's inline `shownFile` derivation took the whole-text target, else the
selected snippet's file, else nothing. So a file picked in the sidebar, with no snippet selected
and no text shown, got no header block. Its `stale` sentence and reread control could not be
reached from the row.

**The fix.** The decision moves into `reconciliationStatus.ts`:
- `ShownFileFacts` and `shownFileOf` are the value. The file the sidebar selects is now the third
  fallback, after the whole text's file and the selected snippet's file.
- `shownFileFactsOf` is the adapter that reads those facts off `BrowserState`.
- `DetailPane.svelte` now draws `headerFilesOf(openWriteSurfaces(), shownFileOf(shownFileFactsOf(browser)))`.

**No binding reason stood against the fix.** Entry 27 places `stale` and `unavailable` in the
affected header and says nothing that confines the header to a snippet or a text.

**Tests added:**
- two model cases: the fallback order, and the adapter over each fact;
- one mounted case per locale: after a refused save, clicking the row alone (no snippet, text not
  shown) draws the `stale` sentence and the reread control, and the reread clears the status.

**Shown failing first.** With `shownFileOf` stripped back to the old two facts, the mounted case
failed in both locales. EN:

```
AssertionError: expected '  Show this file’s text Add a snippet…' to contain 'What this window shows of this file h…'
```

ES:

```
AssertionError: expected '  Mostrar el texto de este archivo Añ…' to contain 'Lo que esta ventana muestra de este a…'
```

### 8.3 The reviewer's NOT-VERIFIED item — the retained-observation release path

**Traced; the clear rule holds, and nothing was changed.**

On `close()`, `beginWrite` (`W`) releases the held observation through `releaseBarrier`, then
`arbitrateAndDeliver`, then `arbitrateHere`. That registers the origin through
`rememberTheConflict(document, source, arrival)` and then `deliver`s to the receivers. **No status
is written on this path, before or after the registration.** The receivers are session transitions,
and none of them calls `noteDocumentStatus`, which is a host member.

The retained observation's `stale` was written at its *arrival*:
1. `tellTheSurfaceAbout` marks the file stale.
2. The surface's transition then calls `observeExternalChange`.
3. That call answers `retained`.

So the count recorded at the later registration **includes** the arrival mark. It also includes any
status written in between, such as the save's own conflict mark.

The install therefore clears marks written up to the registration. That is right for the cases the
barrier can produce:
- The barrier keeps only the newest held reading.
- A reading that arrives during the write is routed to the open surface, so it is coalesced rather
  than registered.
- An `unavailable` written in between is protected by the `kind === 'stale'` test.

**The one sequence I could not rule out.** Suppose:
1. The writer's surface closes while its write is in flight.
2. A newer `Changed` for the file takes the automatic path.
3. Its reread fails.

That mark predates the older held origin's registration, so it would be cleared if that origin were
later installed. **It is not reachable as far as I can see.** Installing needs a surface holding
that origin's `ConflictModel`, and with the surface closed no receiver ever received the model.
**It is recorded as an open item, not fixed.** Recording the count at arrival on the retained
record would close it if a later step makes it reachable.

### 8.4 Gates after the fix round

Each gate was run on its own, with its output redirected to a file and read from that file:

| Command | Exit | Evidence |
|---|---|---|
| `npm test` | 0 | **3280 passed**, 69 files |
| `npm run check` | 0 | **456 files**, 0 errors, 0 warnings |
| `npm run build` | 0 | **198 modules** |
| server-only oracle | 1 | nothing found |
| client-only oracle | 0 | `2` |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)`, unchanged |

The **+9** tests are:
- `workspace.test.ts`: +5
- `reconciliationStatus.test.ts`: +2
- `ReconciliationStatus.test.ts`: +2

No new file was added, so the svelte-check files and the Vite modules are unchanged.

**The rung is now `1323 / 456 / 3280 / 198`**, with the instrument in the tree. No Rust changed.
Only read-only git commands were run, and none of the four instrument paths was touched.
