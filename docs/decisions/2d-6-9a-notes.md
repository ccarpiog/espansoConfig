# Phase 2d-6-9a — the reconciliation-status decisions as values, and their words

**Status: implemented, gates green, not yet reviewed.**
Risk class: **high**. This is the first step that names a coordinator state to a person, so it
owns the EN/ES keys and typed accessors (`2d-5-split-notes.md` §6 item 6 is discharged here). The
change adds **one new `.ts` module** that reaches the bundle, **32 new dictionary keys per locale**,
four describers and four reactive wrappers. **No component was changed and no Rust was changed.**

This is the first of the three sub-phases 2d-6-9 was cut into
([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of 2d-6-9, taken
2026-09-23*). The rendering and wiring (9b) and the window reading (9c) are not done here.

Abbreviations: `RS` is `src/lib/browser/reconciliationStatus.ts`, `W`
`src/lib/browser/workspace.svelte.ts`, `C` `src/lib/i18n/codes.ts`, `I` `src/lib/i18n/index.ts`.

---

## 1. What changed

| File | Change |
|---|---|
| `src/lib/browser/reconciliationStatus.ts` | **New.** The decisions (§2), four outcome-to-refusal maps, two adapters over `BrowserState`, four key functions |
| `src/lib/browser/reconciliationStatus.test.ts` | **New.** 35 model cases, `environment: 'node'`, including two over a real `createBrowserState`. Holds the `invoke` spy at zero |
| `src/lib/i18n/reconciliationStatusCodes.test.ts` | **New.** 18 accessor cases: every accessor in both locales, exhaustive tables, literal EN/ES pins, word scans |
| `src/lib/i18n/en.json`, `es.json` | 32 keys each. Namespaces: `browser.reconciliation.*` (22), `browser.externalDocument.*` (8), `browser.externalConflict.*` (2: `route.writeOutcomeUnknown`, `action.retry`) |
| `src/lib/i18n/codes.ts` | `describeReconciliationWorkspaceState`, `…FileState`, `…Control`, `…Refusal`; header sentence widened to name the two new namespaces |
| `src/lib/i18n/index.ts` | `tReconciliationWorkspaceState`, `…FileState`, `…Control`, `…Refusal` |
| `src/lib/i18n/externalConflictCodes.test.ts` | `BOUNDED_KEYS` takes the two new `browser.externalConflict.*` keys and all 30 keys of the two new namespaces. The namespace count goes from 7 to 9. The guard failed on the first run until this was done, which is the guard working |
| `W`, `reconciliationCoordinator.ts`, `observationTransitions.ts` | Comments only (entry 41). Four sentences this step falsified said the keys were still owed. Each now names where the words live |

`CODE_NAMESPACE_KEY_BUILDERS` is untouched: it covers the `code.*` namespaces only, and entry 39
forbids putting frontend state under `code.*`. `src-tauri/src/dictionary_contract.rs` does not
apply for the same reason. Rust's contract compares `code.` alone.

## 2. The decisions

**Facts in, values out.** `WorkspaceReconciliationFacts` and `FileReconciliationFacts` are plain
data. `workspaceFactsOf(browser)` and `fileFactsOf(browser, document)` are the only adapters that
fill them, and they read only `BrowserState` readers (`ReconciliationStatusReader` is a `Pick` of
13 of them; since the fix round, `uncertaintyAcknowledgementEligibility` replaces
`standingConflictFor` among them, §7). Every fact is one the frontend can observe (§5.4). **No input says anything about
native polling**, and the module header says so.

### 2.1 The ten states

| State | Source | Placement |
|---|---|---|
| `stale` | `externalDocumentStatus` | `sidebarRow` (only when a row exists) + `header` |
| `unavailable` (+ wire reason) | `externalDocumentStatus` | `sidebarRow` (only when a row exists) + `header`. The reason is drawn through the existing `tUnreadableReason` |
| `removed` | `externalDocumentStatus` | `header` + `selectionNotice`, **never a row** |
| `pathDrift` (one per entry; display path + detail) | `externalPathDrift()` | workspace banner |
| `notWatched` | `watchState.kind === 'notWatched'` | workspace banner |
| `registrationFailed` (`noTransport` \| `rejected`) | sanitized `reconciliationRegistration()` | workspace banner |
| `lostHistory` | `block.kind === 'blockedByLostHistory'` | workspace banner |
| `membershipReloadWanted` | `membershipReloadWanted()` | workspace banner |
| held observation | `automaticReloadGuardFor().observationRetained` | `surface` while a surface targets the file, otherwise `workspaceRoute` |
| uncertain write | `…uncertaintyUnresolved` | as above |

**Deliberately not drawn:**
- `notObserved`. Before the first accepted batch nothing observed an absence of coverage.
- `idle`, `registering`, `registered` and `abandoned` registrations. None is a restriction a person
  can act on.

### 2.2 The five controls

Each control is decided as *offered or not*. An offered control is *enabled*, or *disabled* with
the `ReconciliationRefusal` code its press would get. That code set is the union of the five
requests' refusals (16 codes), so a disabled control and a refused press say the same sentence.

| Control | Offered when | Disabled by (the request's own order) |
|---|---|---|
| `membershipReload` | the flag stands | not ready → write in flight → surface open |
| `lostHistoryRecovery` | blocked | the same |
| `staleFileReread` | `stale` **and no surface over the file** (entry 32) | not ready → no row → blocked → `decideAutomaticReload`'s three → write in flight |
| `retryRetainedObservation` | held, on a surface or on the route | write in flight only (entry 16) |
| `acknowledgeUncertainty` | hold stands **and** a conflict origin stands for the file | the mint's own guards: write in flight → projection replaced (since the fix round, §7.2) |

**Closing the last surface permits and does not trigger.** The decision re-derives to enabled and
has no way to press anything. A model case pins this.

**What is predicted and what is not.** A decision is a snapshot, so an enabled control is a
prediction, and the requests recheck at the press.

Three guards have no public reader, so no decision predicts them. For each, the control stays
enabled and the press answers:
- the coordinator's disposal (a disposed state's shell has unmounted anyway);
- a row the open workspace does not resolve (`notAddressable` for an `Added`-invented row);
- the acknowledgement spend's refusals about a token (`spent`, `holdMoved` after a later hold).
  *(Corrected in the fix round: `projectionReplaced` is now predicted through
  `uncertaintyAcknowledgementEligibility`, §7.2.)*

`reloadRefusalOf`, `rereadRefusalOf`, `retryRefusalOf` and `acknowledgementRefusalOf` map each
press's outcome to the same codes. A reread `failed` is not a refusal: it is drawn through
`tIpcFailure`.

### 2.3 Empty-workspace retention (§3 entry 31, §5.2; §6 item 13)

`decideShellComposition` restates, as a value, `AppShell.svelte`'s inline condition that 2d-6-6b
delivered: loading → failed (with a failure held) → `empty` only when **no row and no registered
surface** → otherwise `panes`. The panes stay over an empty list while any surface is open.

`workspaceBannersDrawnIn` adds the half the banners need. **The banners are drawn in `empty` as well
as `panes`**, so the removal that empties the list cannot take the membership-reload banner and its
control with it.

`filesToDecide` lists each row, then each surface target that no row names. A removed file's
surface therefore stays decided.

The model cases pin all of this, and two cases over a real `createBrowserState` do too: empty,
then panes while a raw-editor surface is registered over no row, then empty again after the lease
is dropped. This is **re-asserted, not re-implemented**. 9b makes the shell draw from this value
rather than keep a second copy.

## 3. Rulings decided here, by name

### 3.1 Orchestrator ruling (2): the acknowledgement operand stays `ConflictSource` — **stands**

Entry 14 binds the acknowledgement to the *standing source the person reviewed*. A `DocumentId`
operand would acknowledge whatever stands at the press, including a snapshot nobody was shown.
Keeping `ConflictSource` keeps `uncertaintyAcknowledgementFor`'s identity-only read, where no
caller getter runs.

This step's consequence: `acknowledgeUncertainty` is **offered only while a conflict origin stands
for the file** (since the fix round, `acknowledgement` is not `noStandingOrigin`, §7.2). With none, the uncertain state is drawn but there is nothing to
acknowledge. The exits that remain are a later write and `open()`.

**What that does not force.** Which snapshot a renderer draws beside the control is the renderer's
rule. On the workspace route, 9b must draw `standingConflictFor(document)`'s disk text beside the
control, and mint from that same source. Otherwise the press acknowledges a snapshot nobody was
shown. `RS`'s JSDoc says this, and nothing checks it.

### 3.2 Orchestrator ruling (3): `projectionReplaced` at an outlived arrival generation — **stands**

A snapshot that arrived before the file's projection was replaced describes a window state that no
longer exists. Acknowledging it would acknowledge evidence the window has moved past. This is the
same comparison `adoptDiskVersion` makes, and for the same reason.

It is not a dead end:
- the hold still has its other two exits (a later write that ends on a named revision, and
  `open()` through the membership reload);
- the next observation of the file arrives as `raisedWithoutReload` with a fresh origin at the
  current generation, which can be acknowledged.

This step's consequence, **as corrected by the fix round (§7.2)**: the refusal is predicted
through `uncertaintyAcknowledgementEligibility`, which shares the mint's guard. The control is
drawn *disabled* with `browser.reconciliation.refusal.projectionReplaced` (*"…the snapshot no longer
describes what it shows"*) rather than enabled for a press that would mint nothing. The ruling still
stands: the fix round's reproduction reaches exactly this state, and its exits are the three listed
above.

### 3.3 `2d-6-8c-notes.md` §4 item 4 — **deliberate**, diagnosed from the code

The observation: after a save was refused under the lock because another writer had just changed
the file, no drain delivered the watcher's reading of that change. `drains=1` was the opening drain
only.

**The cause is in the backend, and it is by design.** The chain:

1. The refusal path is `conflict_after_the_lock` (`src-tauri/src/commands.rs:2613`). It re-reads
   the file under the session lock and **marks** the state it read as the path's coalescing entry,
   through `WriteLedger::mark_under_the_session_lock` (`commands.rs:2680`, `ledger.rs:1480`). It
   spends no sequence and publishes nothing.
2. When the watcher's engine stabilizes on the same bytes, `WriteLedger::admit` finds that state
   already announced and answers `Admission::Duplicate` (`ledger.rs:702`).
3. `admitting_sink` hands only `Admitted` downstream (`ledger.rs:2308-2317`). The queue's `enqueue`
   is the only producer of a `workspace://reconciliation-ready` wake (`reconciliation.rs:1088`,
   `:1129`). So no sequence is spent and no wake is emitted, and no drain can follow.
4. `ledger.rs:3552` (`a_marker_coalesces_a_stabilized_twin_and_a_withheld_reading_does_not`) pins
   exactly this. It carries the reason from the 2d design consult's Q5: *a save-origin conflict
   registered by `conflict_after_the_lock` wins over a native duplicate at the same
   document/revision … the duplicate is coalesced*. The person has that state already, in the
   conflict payload.

So the window's `drains=1` was correct. The frontend was never told, because there was nothing new
to tell it. **No model-layer defect produced the observation**, and no case was written to fail.

**A consequence noticed while diagnosing, recorded and not fixed here** (`CLAUDE.md` §7; handed on
in §5 item 1):
- Because the stabilized reading is coalesced, nothing marks the file `stale` on the frontend.
  `noteDocumentStatus(…, 'stale')` is reached only from the observation transitions
  (`W`:3546, `observationTransitions.ts:1175`).
- A person who dismisses the save panel without loading the disk version leaves the viewer and the
  sidebar showing the pre-conflict projection, with no `stale` mark. No later reading of those bytes
  will arrive.
- The window does hold the newer snapshot, as the standing save-origin conflict.
- Fixing this is model work in `W`: mark on the six save wrappers' conflict arm only where the
  conflict's disk revision differs from the installed projection, and clear on the
  `adoptDiskVersion` install, which today clears no status. It changes what `stale` means from
  observation-derived to "any held snapshot newer than the projection". That is a decision about
  the state's meaning, not a fix to what the item named.

## 4. The words

The two new namespaces and the two new `browser.externalConflict.*` keys are listed in §1.
Selection is by `switch` with a `never` terminus in `RS`'s four key functions. **No key is built
from a string.**

The only operand is `{path}`, on the three `pathDrift` sentences. It is the lossy display path and
never a command argument. A registration failure has no operand at all, so no rejection value can
leak into it.

The uncertain write has **two sentences**:
- On a surface it reuses 2d-6-1a's reviewed `writeOutcomeUnknown`, which says *reviewing this disk
  snapshot*.
- On the workspace route it gets `route.writeOutcomeUnknown`, because no snapshot is drawn there.

The acknowledgement's label reuses `action.acknowledgeSnapshot`, so the surface and the route label
the one exit alike.

**Entry 40's seven bounds.** Five are pinned literally in EN and ES (stale, not watched, a failed
registration, removed, the route's unknown outcome), plus the supersession refusal. The origin and
reapply bounds are 2d-6-1a's sentences, unchanged.

All 30 new sentences of the two namespaces also joined `externalConflictCodes.test.ts`'s
forbidden-claim scan. The first draft of the route sentence said *not read again automatically*,
which that scan's *automatic processing* form rejected. It was reworded to *does not read the file
again on its own*. The negation was true, but the scan pins wording, not truth.

**What is not pinned**, stated as entry 40 requires:
- The Spanish was written by the implementer and has had **no bilingual review**. The literal pins
  protect this draft; they do not prove its quality.
- Parity and placeholder agreement do not prove meaning.
- The markup scan sees no `.ts` string.
- Rust's contract excludes `browser.*`.
- The locale switch on a mounted status panel is 9b's (nothing is mounted here).

## 5. Open items handed on (not fixed here, `CLAUDE.md` §7)

1. **To the orchestrator — decide the meaning of `stale` after a refused save** (§3.3's
   consequence). The fix sketch is in §3.3. It is model-only (`W`), and it needs a ruling on
   whether `stale` may come from a held save snapshot as well as from an observation. It could be
   taken with 9b's model half or as a small corrective item.
2. **To 9b — draw from these decisions and wire the five controls.**
   - `AppShell.svelte` should replace its inline empty-state condition with `decideShellComposition`
     and draw the banners per `workspaceBannersDrawnIn`.
   - The acknowledgement on the route must draw the standing origin's disk text beside it and mint
     from that source (§3.1).
   - The control refusals are drawn through `tReconciliationRefusal` over the four `*RefusalOf`
     maps.
   - `acknowledgeSnapshot` / `acknowledgeRestoreSnapshot` are still drawn by nothing
     (`2d-6-8b-notes.md` §4 item 6). This step did not touch them.
3. **To 9b — the files `filesToDecide` cannot list.** No public reader enumerates a held
   observation or an uncertainty hold on a file that neither a row nor a surface names (for
   example, a removed file whose surface has closed). If 9b needs the route for such a file, it
   needs a `BrowserState` reader that lists the barrier's and the uncertain set's files.
4. **To 9b — `workspaceFactsOf`'s `writeInFlight` is a floor.** It asks `writeInFlight` for rows
   and surface targets only. The reload requests recheck at the press.
5. **To 9b — a membership reload nobody asked for.** `requestMembershipReload` permits one, and
   this step offers the control only beside its banner. Whether a reload control exists outside the
   banners is a rendering decision, not a status.
6. **Carried unchanged:** `2d-6-8c-notes.md` §4 items 1-3 and 5-8. The `SourceText` marker wrap
   remains a candidate corrective item.

## 6. Verification

Each gate was run on its own, with its output redirected to a file and read from that file. The
tree includes the uncommitted instrument.

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **452 files**, 0 errors, 0 warnings |
| `npm test` | 0 | **3212 passed**, 67 files |
| `npm run build` | 0 | **194 modules**. Server-only oracle absent; client-only oracle present (2) |
| `git diff --stat -- src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)`, unchanged |

**The new rung is `1323 / 452 / 3212 / 194`**, with the instrument in the tree.

| Figure | Change | Why |
|---|---|---|
| Rust tests | unchanged | no Rust changed and none was run |
| svelte-check files | +3 | the three new `.ts` files |
| vitest tests | +56 | 35 model cases + 18 accessor cases + 3 `scripts/lint/ipc-detail.test.ts` rows (one per new `.ts` file). `externalConflictCodes.test.ts` keeps its count. Attributed per file against a pristine `git archive HEAD` copy, which measured 3155: the recorded 3156 less the instrument's one `ipc-detail` row |
| Vite modules | +1 | `RS`, which enters the bundle through `C`'s key-function imports. This was expected, as the brief's budget said |

Only read-only git commands were run. There was no commit, no stash, and no edit to `PROGRESS.md`,
`PROGRESS.json` or any `.svelte` file.

## 7. Review fix round — `docs/reviews/phase-2d-6-9a.md`

**Verdict: `ship-with-fixes`, 1 BLOCKER and 1 SHOULD-FIX** (Codex, adversarial, on the working
tree). I re-derived both against the code before changing anything. **Both hold.** Each was
reproduced by a case that failed before the fix and passes after it.

### 7.1 BLOCKER — the adapters did not react to hold, barrier and standing-origin changes (`RS`:774)

**Re-derivation.**
- `writeInFlight`, `retainedObservationFor`, `writeOutcomeUncertain`, `standingConflictFor` and
  `automaticReloadGuardFor` in `W` answered from plain `Map`s and `Set`s. Those are
  `writesInFlight`, `retainedObservations`, `uncertainWrites`, `standingConflicts` and
  `projectionGenerations`.
- `automaticReloadGuardFor` also read the registry directly rather than the `surfaceGeneration`
  mirror.
- Nothing about a plain table invalidates a reaction, so a panel's `$derived`/`$effect` over
  `fileFactsOf` would keep drawing the state it first computed.

**The pre-fix failure.** The first draft of the case read a bare `$derived` outside any effect, and
it **passed before the fix**. That was vacuous: such a read may simply recompute. Under
`environment: 'node'` no effect runs at all, because Svelte resolves its server build there.

So `src/lib/browser/reconciliationStatus.svelte.test.ts` (new) opts into jsdom by docblock. It
mounts no component, as `reveal.test.ts` does not, and declares its `invoke` guard. It observes
through a real `$effect` flushed with `flushSync`.

Run against the pre-fix tree, its three finding-1 cases failed:

- `follow a write in flight, …`: `expected false to be true` — the effect still saw
  `writeInFlight: false` after `saveRawDocument` closed the barrier;
- `follow a surface registered over the file …`: `expected false to be true` — `surfaceOpen` stayed
  `false` after `registerWriteSurface`;
- `follow a held observation and its release`: `expected true to be false` — `observationRetained`
  stayed `true` after the settlement released it.

**The fix** is in `W` only:
- A `holdRevision` signal, assigned from a plain counter so that a bump never reads the signal it
  writes.
- `noticeHolds()` is called after every mutation of the five tables. That is **fifteen sites**:
  - the projection-generation bump and its clear;
  - the standing-origin write;
  - the held-observation write, its three deletes and the retry's restore;
  - the barrier's open, its re-count and its close;
  - the uncertain set's add, its two deletes and its clear.
- Every one of the six readers reads `holdRevision` first, and `automaticReloadGuardFor` reads
  `surfaceGeneration` too.

The comment at the signal says what it forces and what it cannot: it cannot force a sixteenth
mutation site to call `noticeHolds()`.

### 7.2 SHOULD-FIX — the acknowledgement was enabled when no token could be minted (`RS`:603)

**Re-derivation.** The decision enabled the control from *a standing origin + no write in flight*.
`uncertaintyAcknowledgementFor` also refuses an origin whose arrival generation the projection has
moved past, and the reviewer's reproduction reaches exactly that:

1. An observation is retained during a raw save.
2. The save answers `may_have_written`.
3. The settlement releases the observation at its **arrival** generation, which is correct (the
   2d-6-1b review's finding 1).
4. The failed save's own re-read has replaced the projection, so the origin now standing is
   outlived.

At that point the hold and the origin both stand, and the mint answers `null`.

**The pre-fix failure.** `is disabled, with the mint's refusal, when no token can be minted`
failed with `expected { …(2) } to match object { enabled: false }`: the control was
`{ enabled: true }` while `uncertaintyAcknowledgementFor` answered `null`.

**The fix** has three parts:

- **In `W`, a new non-mutating reader.** `BrowserState.uncertaintyAcknowledgementEligibility(document)`
  answers `eligible` or `ineligible` with a typed `UncertaintyAcknowledgementIneligibility`:
  `writeInFlight`, then `noHold`, then `noStandingOrigin`, then `projectionReplaced`.
- **One guard for both.** The reader and the mint now ask one private predicate,
  `acknowledgementMintRefusal`, so they cannot disagree about the four facts it covers. The mint's
  inline guard was replaced by a call to it, and its answer is unchanged.
- **In `RS`, the decision uses it.** `FileReconciliationFacts.standingSnapshot: boolean` is replaced
  by `acknowledgement: UncertaintyAcknowledgementEligibility`, read through the reader.
  - `eligible` → enabled;
  - `writeInFlight` or `projectionReplaced` → disabled with that refusal;
  - `noHold` or `noStandingOrigin` → no control.

The case now pins `projectionReplaced` exactly, on the reader and on the control. A model case pins
the `projectionReplaced` and `noHold` arms by hand.

**What it still does not predict**: the spend's refusals about a particular token (`spent`, and
`holdMoved` after a later uncertain write), and currency at the press. Both remain the press's to
answer.

### 7.3 Noticed in the fix round, not fixed (`CLAUDE.md` §7)

1. **The reproduction is a hold with no acknowledgeable origin.** A write that answers
   `may_have_written`, with an observation held during it, leaves a hold whose standing origin is
   already outlived. The acknowledgement is disabled, and the file's remaining exits are:
   - the next observation, which arrives as `raisedWithoutReload` at the current generation;
   - a later write that ends on a named revision;
   - `open()`.

   Ruling (3) stands (§3.2), but a person in this state sees a disabled exit until one of those
   happens. **Candidate for 9b's wording or a later ruling**: whether that situation deserves a
   sentence of its own, or a guarded path to a fresh origin.
2. **The other readers `fileFactsOf` and `workspaceFactsOf` ask were checked and are already
   reactive.** `externalDocumentStatus` and `externalPathDrift` read `$state` arrays. The four
   coordinator readers read `reconciliationRevision`. `documents`, `status` and `failure` are
   `$state`, and `openWriteSurfaces` reads the registry mirror. No further reader was changed.

### 7.4 Gates after the fix round

Each gate was run alone, with its output redirected to a file and read from that file:

| Command | Exit | Evidence |
|---|---|---|
| `npm run check` | 0 | **453 files**, 0 errors, 0 warnings (+1: the new `.svelte.test.ts`) |
| `npm test` | 0 | **3218 passed**, 68 files |
| `npm run build` | 0 | **194 modules**, unchanged; server-only oracle absent, client-only present (2) |

The +6 tests are:
- 4 reactive cases;
- 1 model case (the `projectionReplaced`/`noHold` arms);
- 1 `ipc-detail` row for the new file (146 → 147).

**The rung is now `1323 / 453 / 3218 / 194`**, with the instrument in the tree. No Rust changed.
No `.svelte` file changed, and none of the four instrument paths was touched. Only read-only git
commands were run.
